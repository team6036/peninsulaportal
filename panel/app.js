import * as util from "../util.js";
import { V } from "../util.js";

import * as core from "../core.js";


class Generic extends core.Target {
    #parent;

    #name;

    constructor(name) {
        super();

        this.#parent = null;

        this.#name = null;

        this.name = name;
    }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Table) ? v : (v instanceof App) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return this.parent instanceof Generic; }
    hasAppParent() { return this.parent instanceof App; }

    get path() {
        if (!this.hasParent()) return "";
        return this.parent.path+"/"+this.name;
    }

    get name() { return this.#name; }
    set name(v) {
        v = String(v);
        if (this.name == v) return;
        this.#name = v;
    }
}

class Table extends Generic {
    #children;

    constructor(name) {
        super(name);

        this.#children = [];
    }

    get children() { return [...this.#children]; }
    set children(v) {
        v = util.ensure(v, "arr");
        this.clearChildren();
        v.forEach(v => this.addChild(v));
    }
    clearChildren() {
        let children = this.children;
        children.forEach(child => this.remChild(child));
        return children;
    }
    hasChild(child) {
        if (!(child instanceof Generic)) return false;
        return this.#children.includes(child) && child.parent == this;
    }
    getChild(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.#children.length) return null;
        return this.#children[i];
    }
    addChild(child) {
        if (!(child instanceof Generic)) return false;
        if (this.hasChild(child)) return false;
        if (child.parent != null) return false;
        this.#children.push(child);
        child.parent = this;
        child._onChange = () => this.post("change", null);
        child.addHandler("change", child._onChange);
        this.post("change", null);
        return child;
    }
    remChild(child) {
        if (!(child instanceof Generic)) return false;
        if (!this.hasChild(child)) return false;
        if (child.parent != this) return false;
        this.#children.splice(this.#children.indexOf(child), 1);
        child.parent = null;
        child.remHandler("change", child._onChange);
        delete child._onChange;
        this.post("change", null);
        return child;
    }

    lookup(k) {
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return this;
        let name = k.shift();
        for (let i = 0; i < this.#children.length; i++)
            if (this.#children[i].name == name)
                return this.#children[i].lookup(k.join("/"));
        return null;
    }
}

class Topic extends Generic {
    #type;
    #value;

    static TYPES = [
        "boolean", "boolean[]",
        "double", "double[]",
        "float", "float[]",
        "int", "int[]",
        "raw",
        "string", "string[]",
        "null",
    ];
    static TYPE2NAME = {
        "boolean": "Boolean",
        "boolean[]": "Boolean Array",
        "double": "Double",
        "double[]": "Double Array",
        "float": "Float",
        "float[]": "Float Array",
        "int": "Integer",
        "int[]": "Integer Array",
        "raw": "Raw",
        "string": "String",
        "string[]": "String Array",
        "null": "Null",
    };
    static getDisplay(t, v) {
        t = String(t);
        if (!Topic.TYPES.includes(t)) return null;
        if (t.endsWith("[]")) {
            t = t.substring(0, t.length-2);
            let display = Topic.getDisplay(t, (t == "boolean") ? true : null);
            if (display == null) return null;
            return {
                src: "../assets/icons/array2.svg",
                color: display.color,
            };
        }
        if (["double", "float", "int"].includes(t)) return {
            src: "../assets/icons/number2.svg",
            color: "var(--cb)",
        };
        if (t == "boolean") return {
            name: v ? "checkmark-circle" : "close-circle",
            color: v ? "var(--cg)" : "var(--cr)",
        };
        if (t == "string") return {
            name: "text",
            color: "var(--cy)",
        };
        return { src: "../assets/icons/variable.svg" };
    }
    static ensureType(t, v) {
        t = String(t);
        if (!Topic.TYPES.includes(t)) return null;
        if (t.endsWith("[]")) {
            t = t.substring(0, t.length-2);
            return util.ensure(v, "arr").map(v => Topic.ensureType(t, v));
        }
        const map = {
            boolean: "bool",
            double: "float",
            float: "float",
            int: "int",
            string: "str",
            null: "null",
        };
        return (t in map) ? util.ensure(v, map[t]) : v;
    }

    constructor(name, type, value) {
        super(name);

        this.#type = null;
        this.#value = null;

        this.type = type;
        this.value = value;
    }

    get type() { return this.#type; }
    set type(v) {
        v = String(v);
        if (!Topic.TYPES.includes(v)) v = "raw";
        if (this.type == v) return;
        this.#type = v;
        this.post("type-set", { v: v });
        this.post("change", { k: "type" });
        this.value = this.value;
    }
    get isArray() { return this.type.endsWith("[]"); }
    get arraylessType() {
        if (!this.isArray) return this.type;
        return this.type.substring(0, this.type.length-2);
    }
    get value() { return (this.isArray && util.is(this.#value, "arr")) ? this.#value.map(topic => topic.value) : this.#value; }
    set value(v) {
        this.#value = Topic.ensureType(this.type, v);
        if (this.isArray) this.#value = this.#value.map((v, i) => {
            let topic = new Topic(i, this.arraylessType, v);
            Object.defineProperty(topic, "type", { get: () => this.arraylessType, set: undefined });
            return topic;
        });
        this.post("value-set", { v: this.value });
        this.post("change", { k: "value" });
    }

    lookup(k) {
        k = String(k);
        if (k.length <= 0) return this;
        if (!this.isArray) return null;
        let i = parseInt(k);
        if (!util.is(i, "int")) return null;
        if (i < 0 || i >= this.#value.length) return null;
        return this.#value[i];
    }
}


class BrowserItem extends core.Target {
    #elem;
    #eDisplay;
    #eIcon;
    #eName;
    #eTag;
    #eContent;
    #eSide;

    constructor(name, icon="") {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eIcon = document.createElement("ion-icon");
        this.eDisplay.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.eDisplay.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eTag = document.createElement("div");
        this.eDisplay.appendChild(this.eTag);
        this.eTag.classList.add("tag");
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eSide = document.createElement("button");
        this.eContent.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.eSide.classList.add("override");

        this.eDisplay.addEventListener("click", e => {
            this.isOpen = !this.isOpen;
        });
        this.eDisplay.addEventListener("dblclick", e => {
            this.post("trigger", { path: this.name });
        });
        this.eSide.addEventListener("click", e => {
            this.isOpen = !this.isOpen;
        });

        this.name = name;
        this.icon = icon;
    }

    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get eTag() { return this.#eTag; }
    get eContent() { return this.#eContent; }
    get eSide() { return this.#eSide; }

    get icon() { return this.eIcon.getAttribute("name"); }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        this.eIcon.setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }

    get tag() { return this.eTag.textContent; }
    set tag(v) { this.eTag.textContent = v; }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
        this.post("open-set", { v: v });
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }
}

class BrowserTable extends BrowserItem {
    #children;

    constructor(name) {
        super(name);

        this.elem.classList.add("table");

        this.#children = [];

        this.addHandler("open-set", data => {
            this.icon = this.isOpen ? "folder" : "folder-outline";
        });

        this.isOpen = false;
        this.isOpen = true;
        this.isOpen = false;
        this.isOpen = true;
        this.isOpen = false;
    }

    get children() { return [...this.#children]; }
    set children(v) {
        v = util.ensure(v, "arr");
        this.clearChildren();
        v.forEach(v => this.addChild(v));
    }
    clearChildren() {
        let children = this.children;
        children.forEach(child => this.remChild(child));
        return children;
    }
    hasChild(child) {
        if (!(child instanceof BrowserItem)) return false;
        return this.#children.includes(child);
    }
    addChild(child) {
        if (!(child instanceof BrowserItem)) return false;
        if (this.hasChild(child)) return false;
        this.#children.push(child);
        child._onTrigger = data => {
            data = util.ensure(data, "obj");
            this.post("trigger", { path: this.name+"/"+data.path });
        };
        child.addHandler("trigger", child._onTrigger);
        this.eContent.appendChild(child.elem);
        return child;
    }
    remChild(child) {
        if (!(child instanceof BrowserItem)) return false;
        if (!this.hasChild(child)) return false;
        this.#children.splice(this.#children.indexOf(child), 1);
        child.remHandler("trigger", child._onTrigger);
        delete child._onTrigger;
        this.eContent.removeChild(child.elem);
        return child;
    }
}

class BrowserTopic extends BrowserItem {
    #type;
    #value;
    #sub;

    constructor(name, type, value) {
        super(name);

        this.#type = null;
        this.#value = null;

        this.#sub = [];

        this.type = type;
        this.value = value;
    }

    get type() { return this.#type; }
    set type(v) {
        v = String(v);
        if (!Topic.TYPES.includes(v)) v = "raw";
        if (this.type == v) return;
        this.#type = v;
        this.post("type-set", { v: v });
        this.tag = this.type;
        this.value = this.value;
    }
    get isArray() { return this.type.endsWith("[]"); }
    get arraylessType() {
        if (!this.isArray) return this.type;
        return this.type.substring(0, this.type.length-2);
    }
    get value() { return (this.isArray && util.is(this.#value, "arr")) ? [...this.#value] : this.#value; }
    set value(v) {
        this.#value = Topic.ensureType(this.type, v);
        this.post("value-set", { v: this.value });
        this.#sub.forEach(itm => this.eContent.removeChild(itm.elem));
        this.#sub = [];
        this.icon = "";
        this.eIcon.style.color = "";
        this.eName.style.color = "";
        let display = Topic.getDisplay(this.type, this.value);
        if (display != null) {
            if ("src" in display) this.iconSrc = display.src;
            else this.icon = display.name;
            if ("color" in display) this.eIcon.style.color = display.color;
        }
        if (this.isArray) {
            this.value.forEach((value, i) => {
                let itm = new BrowserTopic(i, this.arraylessType, value);
                itm.addHandler("trigger", data => {
                    data = util.ensure(data, "obj");
                    this.post("trigger", { path: this.name+"/"+data.path });
                });
                this.#sub.push(itm);
            });
        }
        this.#sub.forEach(itm => this.eContent.appendChild(itm.elem));
    }
}

class Widget extends core.Target {
    #elem;

    #parent;

    constructor() {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");

        this.#parent = null;
    }

    get elem() { return this.#elem; }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Container) ? v : (v instanceof App) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return this.parent instanceof Container; }
    hasAppParent() { return this.parent instanceof App; }
    get app() {
        if (this.hasAppParent()) return this.parent;
        if (this.hasParent()) return this.parent.app;
        return null;
    }
    hasApp() { return this.app instanceof App; }

    format() {}
    collapse() {}

    update() { this.post("update", null); }

    get path() {
        return null;
        if (!this.hasParent()) return "";
    }
}

class Container extends Widget {
    #children;
    #weights;
    #dividers;
    #axis;

    constructor(children) {
        super();

        this.elem.classList.add("container");
        
        this.#children = [];
        this.#weights = [];
        this.#dividers = [];
        this.#axis = null;

        new ResizeObserver(() => this.format()).observe(this.elem);

        this.addHandler("update", data => {
            this.children.forEach(child => child.update());
        });

        this.axis = "x";

        this.children = children;
    }

    get children() { return [...this.#children]; }
    set children(v) {
        v = util.ensure(v, "arr");
        this.clearChildren();
        v.forEach(v => this.addChild(v));
        this.weights = (this.children.length > 0) ? new Array(this.children.length).fill(1 / this.children.length) : [];
    }
    get weights() { return [...this.#weights]; }
    set weights(v) {
        v = util.ensure(v, "arr").map(v => Math.max(0, util.ensure(v, "num")));
        let wSum = 0;
        v.forEach(w => (wSum += w));
        if (v.length <= 0 || wSum <= 0) return this.#weights = (this.children.length > 0) ? new Array(this.children.length).fill(1 / this.children.length) : [];
        let wAvg = wSum / v.length;
        while (v.length > this.children.length) v.pop();
        while (v.length < this.children.length) v.push(wAvg);
        wSum = 0;
        v.forEach(w => (wSum += w));
        this.#weights = (this.children.length > 0) ? v.map(w => w/wSum) : [];
        this.format();
    }
    clearChildren() {
        let children = this.children;
        children.forEach(child => this.remChild(child));
        return children;
    }
    hasChild(child) {
        if (!(child instanceof Widget)) return false;
        return this.#children.includes(child) && child.parent == this;
    }
    insertChild(child, at) {
        if (!(child instanceof Widget)) return false;
        if (this.hasChild(child)) return false;
        if (child.parent != null) return false;
        at = Math.min(this.#children.length, Math.max(0, util.ensure(at, "int")));
        child.parent = this;
        this.elem.appendChild(child.elem);
        if (this.#children.length <= 0) {
            this.#children.push(child);
            this.#weights.push(1);
        } else {
            let wSum = 0;
            this.#weights.forEach(w => (wSum += w));
            let wAvg = wSum / this.#children.length;
            this.#weights.splice(at, 0, wAvg);
            wSum = 0;
            this.#weights.forEach(w => (wSum += w));
            this.#weights = this.#weights.map(w => w/wSum);
            this.#children.splice(at, 0, child);
        }
        this.format();
        return child;
    }
    replaceChild(child, at) {
        if (!(child instanceof Widget)) return false;
        if (this.hasChild(child)) return false;
        if (child.parent != null) return false;
        if (this.#children.length <= 0) return false;
        at = Math.min(this.#children.length-1, Math.max(0, util.ensure(at, "int")));
        let weights = this.weights;
        let oldChild = this.#children[at];
        this.remChild(oldChild);
        this.insertChild(child, at);
        this.weights = weights;
        return child;
    }
    addChild(child) { return this.insertChild(child, this.#children.length); }
    remChild(child) {
        if (!(child instanceof Widget)) return false;
        if (!this.hasChild(child)) return false;
        if (child.parent != this) return false;
        let at = this.#children.indexOf(child);
        child.parent = null;
        this.elem.removeChild(child.elem);
        this.#children.splice(at, 1);
        this.#weights.splice(at, 1);
        if (this.#children.length > 0) {
            let wSum = 0;
            this.#weights.forEach(w => (wSum += w));
            this.#weights = this.#weights.map(w => w/wSum);
        }
        this.format();
        return child;
    }

    get axis() { return this.#axis; }
    set axis(v) {
        v = String(v).toLowerCase();
        if (!["x", "y"].includes(v)) return;
        if (this.axis == v) return;
        this.#axis = v;
        this.format();
    }

    format() {
        this.elem.classList.remove("x");
        this.elem.classList.remove("y");
        this.elem.classList.add(this.axis);
        let r = this.elem.getBoundingClientRect();
        let wAlloc = r.width - (this.axis == "x") * (12 * Math.max(0, this.children.length-1));
        let hAlloc = r.height - (this.axis == "y") * (12 * Math.max(0, this.children.length-1));
        this.children.forEach((child, i) => {
            child.elem.style.order = i*2;
            child.elem.style.setProperty("--w", ((this.axis == "x") ? (wAlloc * this.weights[i]) : wAlloc)+"px");
            child.elem.style.setProperty("--h", ((this.axis == "y") ? (hAlloc * this.weights[i]) : hAlloc)+"px");
            child.format();
        });
        let l = Math.max(0, this.children.length-1);
        while (this.#dividers.length > l) {
            let divider = this.#dividers.pop();
            this.elem.removeChild(divider.elem);
        }
        while (this.#dividers.length < l) {
            let divider = {};
            this.#dividers.push(divider);
            let elem = divider.elem = document.createElement("div");
            this.elem.appendChild(elem);
            elem.classList.add("divider");
            elem.addEventListener("mousedown", e => {
                const mouseup = () => {
                    elem.classList.remove("this");
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                };
                const mousemove = e => {
                    let i = divider.i;
                    let r = this.elem.getBoundingClientRect()
                    let p = (this.axis == "x") ? ((e.pageX-r.left)/r.width) : ((e.pageY-r.top)/r.height);
                    let mnBound = 0, mxBound = 1;
                    for (let j = 0; j < i; j++) mnBound += this.#weights[j];
                    for (let j = this.#weights.length-1; j > i+1; j--) mxBound -= this.#weights[j];
                    p = Math.min(mxBound, Math.max(mnBound, p));
                    this.#weights[i] = p-mnBound;
                    this.#weights[i+1] = mxBound-p;
                    this.format();
                };
                elem.classList.add("this");
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
            });
        }
        for (let i = 0; i < this.children.length-1; i++) {
            this.#dividers[i].i = i;
            this.#dividers[i].elem.style.order = (2*i)+1;
        }
    }
    collapse() {
        this.children.forEach(child => child.collapse());
        if (this.children.length <= 0) {
            if (this.hasAppParent()) this.parent.rootWidget = null;
            else if (this.hasParent()) this.parent.remChild(this);
            return;
        }
        if (this.children.length <= 1) {
            let child = this.children[0];
            this.clearChildren();
            if (this.hasAppParent()) this.parent.rootWidget = child;
            else if (this.hasParent()) this.parent.replaceChild(child, this.parent.children.indexOf(this));
            return;
        }
        this.children.forEach((child, i) => {
            if (!(child instanceof Container)) return;
            if (child.axis != this.axis) return;
            let weights = this.weights;
            let childweight = weights[i];
            let subweights = child.weights;
            let subchildren = child.children;
            weights.splice(i, 1);
            [...subweights].reverse().forEach(w => weights.splice(i, 0, w*childweight));
            subchildren.forEach(subchild => child.remChild(subchild));
            this.remChild(child);
            [...subchildren].reverse().forEach(subchild => this.insertChild(subchild, i));
            this.weights = weights;
        });
    }
}

class Panel extends Widget {
    #pages;
    #pageIndex;

    #eTop;
    #eClose;
    #eContent;

    constructor(pages) {
        super();

        this.elem.classList.add("panel");

        this.#pages = [];

        this.#eClose = document.createElement("button");
        this.elem.appendChild(this.eClose);
        this.eClose.classList.add("close");
        this.eClose.classList.add("icon");
        this.eClose.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eTop = document.createElement("div");
        this.elem.appendChild(this.eTop);
        this.eTop.classList.add("top");
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.eClose.addEventListener("click", e => {
            if (this.hasAppParent()) return this.parent.rootWidget = null;
            if (this.hasParent()) return this.parent.remChild(this);
        });

        this.#pageIndex = null;
        this.pageIndex = 0;

        this.addHandler("update", data => {
            this.pages.forEach(page => page.update());
        });

        this.pages = pages;

        if (this.pages.length <= 0) this.addPage(new Panel.AddPage());
    }

    get pages() { return [...this.#pages]; }
    set pages(v) {
        v = util.ensure(v, "arr");
        this.clearPages();
        v.forEach(v => this.addPage(v));
    }
    get pageIndex() { return this.#pageIndex; }
    set pageIndex(v) {
        v = Math.min(this.#pages.length-1, Math.max(0, util.ensure(v, "int")));
        if (this.pageIndex == v) return;
        this.#pageIndex = v;
        this.#pages.forEach((page, i) => (i == this.pageIndex) ? page.open() : page.close());
        this.format();
    }
    clearPages() {
        let pages = this.pages;
        pages.forEach(page => this.remPage(page));
        return pages;
    }
    hasPage(page) {
        if (!(page instanceof Panel.Page)) return false;
        return this.#pages.includes(page) && page.parent == this;
    }
    getPage(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.#pages.length) return null;
        return this.#pages[i];
    }
    addPage(page, index=null) {
        if (!(page instanceof Panel.Page)) return false;
        if (this.hasPage(page)) return false;
        if (page.parent != null) return false;
        if (index == null) this.#pages.push(page);
        else this.#pages.splice(index, 0, page);
        page.parent = this;
        this.eTop.appendChild(page.eTab);
        this.eContent.appendChild(page.elem);
        this.pageIndex = this.#pages.indexOf(page);
        this.format();
        return page;
    }
    remPage(page) {
        if (!(page instanceof Panel.Page)) return false;
        if (!this.hasPage(page)) return false;
        if (page.parent != this) return false;
        this.#pages.splice(this.#pages.indexOf(page), 1);
        page.parent = null;
        this.eTop.removeChild(page.eTab);
        this.eContent.removeChild(page.elem);
        page.close();
        this.format();
        let index = this.pageIndex;
        this.#pageIndex = null;
        this.pageIndex = index;
        return page;
    }

    format() {
        this.pages.forEach((page, i) => {
            page.eTab.style.order = i;
        });
    }
    collapse() {
        if (this.pages.length > 0) return;
        if (this.hasAppParent()) this.parent.rootWidget = null;
        if (this.hasParent()) this.parent.remChild(this);
    }

    get eTop() { return this.#eTop; }
    get eClose() { return this.#eClose; }
    get eContent() { return this.#eContent; }
}
Panel.Page = class PanelPage extends core.Target {
    #parent;

    #elem;
    #eTab;
    #eTabIcon;
    #eTabName;
    #eTabClose;

    constructor() {
        super();

        this.#parent = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eTab = document.createElement("div");
        this.eTab.classList.add("item");
        this.#eTabIcon = document.createElement("ion-icon");
        this.eTab.appendChild(this.eTabIcon);
        this.#eTabName = document.createElement("div");
        this.eTab.appendChild(this.eTabName);
        this.eTabName.classList.add("name");
        this.#eTabClose = document.createElement("button");
        this.eTab.appendChild(this.eTabClose);
        this.eTabClose.classList.add("icon");
        this.eTabClose.innerHTML = "<ion-icon name='close'></ion-icon>";

        this.eTab.addEventListener("click", e => {
            if (!this.hasParent()) return;
            this.parent.pageIndex = this.parent.pages.indexOf(this);
        });
        this.eTabClose.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasParent()) return;
            this.parent.remPage(this);
        });
    }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Panel) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return this.parent instanceof Panel; }
    get app() {
        if (!this.hasParent()) return null;
        return this.parent.app;
    }
    hasApp() { return this.app instanceof App; }

    get elem() { return this.#elem; }
    get eTab() { return this.#eTab; }
    get eTabIcon() { return this.#eTabIcon; }
    get eTabName() { return this.#eTabName; }
    get eTabClose() { return this.#eTabClose; }

    get isOpen() { return this.eTab.classList.contains("this"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        if (v) this.eTab.classList.add("this");
        else this.eTab.classList.remove("this");
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get icon() { return this.eTabIcon.getAttribute("name"); }
    set icon(v) {
        this.eTabIcon.removeAttribute("src");
        this.eTabIcon.setAttribute("name", v);
    }
    get iconSrc() { return this.eTabIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eTabIcon.removeAttribute("name");
        this.eTabIcon.setAttribute("src", v);
    }
    get iconColor() { return this.eTabIcon.style.color; }
    set iconColor(v) { this.eTabIcon.style.color = v; }
    get hasIcon() { return this.eTab.contains(this.eTabIcon); }
    set hasIcon(v) {
        v = !!v;
        if (this.hasIcon == v) return;
        if (v) this.eTab.appendChild(this.eTabIcon);
        else this.eTab.removeChild(this.eTabIcon);
    }

    get name() { return this.eTabName.textContent; }
    set name(v) { this.eTabName.textContent = v; }

    update() { this.post("update", null); }

    get path() {
        if (!this.hasParent()) return "";
        return this.parent.path + "-" + this.parent.pages.indexOf(this);
    }
};
Panel.AddPage = class PanelAddPage extends Panel.Page {
    #searchPart;
    #tags;
    #items;

    #eSearch;
    #eSearchTags;
    #eSearchInput;
    #eSearchClear;
    #eContent;

    constructor() {
        super();

        this.elem.classList.add("add");

        this.name = "New Page";
        this.hasIcon = false;

        this.#searchPart = "";
        this.#tags = [];
        this.#items = [];

        this.#eSearch = document.createElement("div");
        this.elem.appendChild(this.eSearch);
        this.eSearch.classList.add("search");
        this.#eSearchTags = document.createElement("div");
        this.eSearch.appendChild(this.eSearchTags);
        this.eSearchTags.classList.add("tags");
        this.#eSearchInput = document.createElement("input");
        this.eSearch.appendChild(this.eSearchInput);
        this.eSearchInput.type = "text";
        this.eSearchInput.placeholder = "";
        this.eSearchInput.autocomplete = "off";
        this.eSearchInput.spellcheck = false;
        this.#eSearchClear = document.createElement("button");
        this.eSearch.appendChild(this.eSearchClear);
        this.eSearchClear.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        // this.eContent.appendChild(new Panel.AddPage.Header("Header").elem);
        // this.eContent.appendChild(new Panel.AddPage.Button("Tables", "folder-outline").elem);
        // this.eContent.appendChild(new Panel.AddPage.Button("Topics", "document-outline").elem);
        // this.eContent.appendChild(new Panel.AddPage.Divider().elem);

        this.eSearchInput.addEventListener("keydown", e => {
            if (!["Backspace", "Delete"].includes(e.code)) return;
            if (this.eSearchInput.value.length > 0) return;
            this.searchPart = null;
        });
        this.eSearchClear.addEventListener("click", e => {
            this.eSearchInput.value = "";
            this.searchPart = null;
        });

        this.addHandler("update", data => {
            this.items.forEach(itm => itm.update());
        });

        this.searchPart = null;

        this.refresh();
    }

    refresh() {
        this.clearTags();
        this.placeholder = "";
        this.clearItems();
        if (this.searchPart == null) {
            this.tags = [];
            this.placeholder = "Search tools, tables, and topics";
            this.items = [
                new Panel.AddPage.Button("Tables", "folder-outline", true),
                new Panel.AddPage.Button("Topics", "document-outline", true),
                new Panel.AddPage.Button("All", "", true),
                new Panel.AddPage.Divider(),
                new Panel.AddPage.Header("Tools"),
                new Panel.AddPage.Button("Tools", "cube-outline", true),
                new Panel.AddPage.Button("Graph", "analytics"),
            ];
            this.items[0].addHandler("trigger", () => {
                this.searchPart = "tables";
            });
            this.items[1].addHandler("trigger", () => {
                this.searchPart = "topics";
            });
            this.items[2].iconSrc = "../assets/icons/variable.svg";
            this.items[2].addHandler("trigger", () => {
                this.searchPart = "all";
            });
            this.items[5].addHandler("trigger", () => {
                this.searchPart = "tools";
            });
        } else if (this.searchPart == "tools") {
            this.tags = [new Panel.AddPage.Tag("Tools", "cube-outline")];
            this.placeholder = "Search tools";
            this.items = [];
        } else if (["tables", "topics", "all"].includes(this.searchPart)) {
            this.tags = [new Panel.AddPage.Tag(
                this.searchPart[0].toUpperCase()+this.searchPart.substring(1).toLowerCase(),
                { tables: "folder-outline", topics: "document-outline", all: "" }[this.searchPart],
            )];
            if (this.searchPart == "all") this.tags[0].iconSrc = "../assets/icons/variable.svg";
            this.placeholder = "Search "+this.searchPart.toLowerCase();
            this.items = [];
            if (this.hasApp() && this.app.hasRootTable()) {
                let root = this.app.rootTable;
                const dfs = generic => {
                    let itm = new Panel.AddPage.GenericButton(generic);
                    if (generic instanceof { tables: Table, topics: Topic, all: Generic }[this.searchPart]) this.addItem(itm);
                    if (generic instanceof Table) generic.children.forEach(generic => dfs(generic));
                };
                dfs(root);
            }
        }
        this.eSearchInput.focus();
    }

    get searchPart() { return this.#searchPart; }
    set searchPart(v) {
        v = (v == null) ? null : String(v);
        if (this.searchPart == v) return;
        this.#searchPart = v;
        this.refresh();
    }
    hasSearchPart() { return this.searchPart != null; }

    get tags() { return [...this.#tags]; }
    set tags(v) {
        v = util.ensure(v, "arr");
        this.clearTags();
        v.forEach(v => this.addTag(v));
    }
    clearTags() {
        let tags = this.tags;
        tags.forEach(tag => this.remTag(tag));
        return tags;
    }
    hasTag(tag) {
        if (!(tag instanceof Panel.AddPage.Tag)) return false;
        return this.#tags.includes(tag);
    }
    addTag(tag) {
        if (!(tag instanceof Panel.AddPage.Tag)) return false;
        if (this.hasTag(tag)) return false;
        this.#tags.push(tag);
        this.eSearchTags.appendChild(tag.elem);
        return tag;
    }
    remTag(tag) {
        if (!(tag instanceof Panel.AddPage.Tag)) return false;
        if (!this.hasTag(tag)) return false;
        this.#tags.splice(this.#tags.indexOf(tag), 1);
        this.eSearchTags.removeChild(tag.elem);
        return tag;
    }

    get items() { return [...this.#items]; }
    set items(v) {
        v = util.ensure(v, "arr");
        this.clearItems();
        v.forEach(v => this.addItem(v));
    }
    clearItems() {
        let itms = this.items;
        itms.forEach(itm => this.remItem(itm));
        return itms;
    }
    hasItem(itm) {
        if (!(itm instanceof Panel.AddPage.Item)) return false;
        return this.#items.includes(itm);
    }
    addItem(itm) {
        if (!(itm instanceof Panel.AddPage.Item)) return false;
        if (this.hasItem(itm)) return false;
        this.#items.push(itm);
        this.eContent.appendChild(itm.elem);
        return itm;
    }
    remItem(itm) {
        if (!(itm instanceof Panel.AddPage.Item)) return false;
        if (!this.hasItem(itm)) return false;
        this.#items.splice(this.#items.indexOf(itm), 1);
        this.eContent.removeChild(itm.elem);
        return itm;
    }

    get eSearch() { return this.#eSearch; }
    get eSearchTags() { return this.#eSearchTags; }
    get eSearchInput() { return this.#eSearchInput; }
    get eSearchClear() { return this.#eSearchClear; }
    get eContent() { return this.#eContent; }

    get placeholder() { return this.eSearchInput.placeholder; }
    set placeholder(v) { this.eSearchInput.placeholder = v; }
};
Panel.AddPage.Tag = class PanelAddPageTag extends core.Target {
    #elem;
    #eIcon;
    #eName;

    constructor(name, icon="") {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        let chevron = document.createElement("ion-icon");
        this.elem.appendChild(chevron);
        chevron.setAttribute("name", "chevron-forward");

        this.name = name;
        this.icon = icon;
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }
    get icon() { return this.eIcon.getAttribute("name"); }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        this.eIcon.setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.children[0].getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }
};
Panel.AddPage.Item = class PanelAddPageItem extends core.Target {
    #elem;

    constructor() {
        super();

        this.#elem = document.createElement("div");
    }

    get elem() { return this.#elem; }

    update() { this.post("update", null); }
};
Panel.AddPage.Header = class PanelAddPageHeader extends Panel.AddPage.Item {
    constructor(value) {
        super();

        this.elem.classList.add("header");

        this.value = value;
    }

    get value() { return this.elem.textContent; }
    set value(v) { this.elem.textContent = v; }
};
Panel.AddPage.Divider = class PanelAddPageDivider extends Panel.AddPage.Item {
    constructor() {
        super();

        this.elem.classList.add("divider");
    }
};
Panel.AddPage.Button = class PanelAddPageButton extends Panel.AddPage.Item {
    #btn;
    #eIcon;
    #eName;
    #eInfo;
    #eChevron;

    constructor(name, icon="", hasChevron=false) {
        super();

        this.elem.classList.add("item");
        
        this.#btn = document.createElement("button");
        this.elem.appendChild(this.btn);
        this.#eIcon = document.createElement("ion-icon");
        this.btn.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.btn.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eInfo = document.createElement("div");
        this.btn.appendChild(this.eInfo);
        this.eInfo.classList.add("info");
        this.#eChevron = document.createElement("ion-icon");
        this.btn.appendChild(this.eChevron);
        this.eChevron.setAttribute("name", "chevron-forward");

        this.btn.addEventListener("click", e => this.post("trigger", null));

        this.name = name;
        this.icon = icon;
        this.hasChevron = hasChevron;
    }

    get btn() { return this.#btn; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get eInfo() { return this.#eInfo; }
    get eChevron() { return this.#eChevron; }

    get icon() { return this.eIcon.getAttribute("name"); }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        this.eIcon.setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }

    get info() { return this.eInfo.textContent; }
    set info(v) { this.eInfo.textContent = v; }

    get hasChevron() { return this.elem.contains(this.eChevron); }
    set hasChevron(v) {
        v = !!v;
        if (v == this.hasChevron) return;
        if (v) this.btn.appendChild(this.eChevron);
        else this.btn.removeChild(this.eChevron);
    }
};
Panel.AddPage.GenericButton = class PanelAddPageGenericButton extends Panel.AddPage.Button {
    #generic;

    constructor(generic) {
        super();

        this.elem.classList.remove("item");
        this.elem.classList.add("browseritem");
        this.btn.classList.add("display");
        this.eInfo.classList.add("tag");

        this.addHandler("update", data => {
            if (!this.hasGeneric()) {
                this.icon = "document-outline";
                this.name = "NONE";
                return;
            }
            this.name = this.generic.path;
            if (this.name.length <= 0) this.name = "/";
            if (this.generic instanceof Table) {
                this.icon = "folder-outline";
                this.iconColor = "";
                this.info = "";
            } else if (this.generic instanceof Topic) {
                let display = Topic.getDisplay(this.generic.type, this.generic.value);
                if (display != null) {
                    if ("src" in display) this.iconSrc = display.src;
                    else this.icon = display.name;
                    if ("color" in display) this.iconColor = display.color;
                    else this.iconColor = "";
                }
                this.info = this.generic.type;
            }
        });

        this.generic = generic;
    }

    get generic() { return this.#generic; }
    set generic(v) {
        v = (v instanceof Generic) ? v : null;
        if (this.generic == v) return;
        this.#generic = v;
    }
    hasGeneric() { return this.generic instanceof Generic; }
};
Panel.BrowserPage = class PanelBrowserPage extends Panel.Page {
    #path;

    #ePath;
    #eBrowser;
    #eDisplay;

    constructor(path) {
        super();

        this.elem.classList.add("browser_");

        this.#path = null;

        this.#ePath = document.createElement("div");
        this.elem.appendChild(this.ePath);
        this.ePath.classList.add("path");
        this.#eBrowser = document.createElement("div");
        this.elem.appendChild(this.eBrowser);
        this.eBrowser.classList.add("browser");
        this.#eDisplay = document.createElement("div");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");

        this.path = path;

        let prevGeneric = null;
        let state = {};

        this.addHandler("update", data => {
            let generic = this.hasApp() ? this.app.getGeneric(this.path) : null;
            if (prevGeneric != generic) {
                prevGeneric = generic;
                state = {};
            }
            this.eTabIcon.style.color = "";
            if (generic instanceof Table) {
                this.eBrowser.classList.add("this");
                this.eDisplay.classList.remove("this");
                this.icon = "folder-outline";
                this.name = (generic.name.length > 0) ? generic.name : "/";
                if (this.isClosed) return;
                if (!("items" in state)) {
                    state.items = [];
                    this.eBrowser.innerHTML = "";
                }
                let newPaths = {}, path = [];
                const dfsGeneric = generic => {
                    path.push(generic.name);
                    newPaths[path.slice(1).join("/")] = generic;
                    if (generic instanceof Table) generic.children.forEach(generic => dfsGeneric(generic));
                    path.pop();
                };
                dfsGeneric(generic);
                let oldPaths = {};
                const dfsItem = item => {
                    path.push(item.name);
                    oldPaths[path.join("/")] = item;
                    if (item instanceof BrowserTable) item.children.forEach(item => dfsItem(item));
                    path.pop();
                };
                state.items.forEach(item => dfsItem(item));
                for (let path in newPaths) {
                    if (path.length <= 0) continue;
                    if (path in oldPaths) continue;
                    let generic = newPaths[path];
                    let item = (generic instanceof Table) ? new BrowserTable(generic.name) : new BrowserTopic(generic.name, generic.type, generic.value);
                    let parentPath = path.split("/");
                    parentPath.pop();
                    parentPath = parentPath.join("/");
                    if (parentPath.length > 0) {
                        if (!(parentPath in oldPaths)) continue;
                        let parentItem = oldPaths[parentPath];
                        oldPaths[path] = parentItem.addChild(item);
                    } else {
                        state.items.push(item);
                        item._onTrigger = data => {
                            data = util.ensure(data, "obj");
                            this.path += "/" + data.path;
                        };
                        item.addHandler("trigger", item._onTrigger);
                        this.eBrowser.appendChild(item.elem);
                    }
                }
                for (let path in oldPaths) {
                    if (path in newPaths) continue;
                    let item = oldPaths[path];
                    let parentPath = path.split("/");
                    parentPath.pop();
                    parentPath = parentPath.join("/");
                    if (parentPath.length > 0) {
                        if (!(parentPath in oldPaths)) continue;
                        let parentItem = oldPaths[parentPath];
                        parentItem.remChild(item);
                        delete oldPaths[path];
                    } else {
                        state.items.splice(state.items.indexOf(item), 1);
                        item.remHandler("trigger", item._onTrigger);
                        delete item._onTrigger;
                        this.eBrowser.removeChild(item.elem);
                    }
                }
            } else if (generic instanceof Topic) {
                this.eBrowser.classList.remove("this");
                this.eDisplay.classList.add("this");
                let display = Topic.getDisplay(generic.type, generic.value);
                if (display != null) {
                    if ("src" in display) this.iconSrc = display.src;
                    else this.icon = display.name;
                    if ("color" in display) this.eTabIcon.style.color = display.color;
                }
                this.name = generic.name;
                if (this.isClosed) return;
                if (state.topic != generic || state.type != generic.type) {
                    state.topic = generic;
                    state.type = generic.type;
                    this.eDisplay.innerHTML = "";
                    if (generic.isArray) this.eDisplay.classList.add("array");
                    else this.eDisplay.classList.remove("array");
                    if (generic.isArray) {
                        let eType = document.createElement("div");
                        this.eDisplay.appendChild(eType);
                        eType.classList.add("type");
                        let items = [];
                        state.update = () => {
                            let display = Topic.getDisplay(generic.type, generic.value);
                            eType.innerHTML = "<span style='color:"+((display == null || !("color" in display)) ? "var(--v8)" : display.color)+";'>"+generic.arraylessType+"</span>[<span style='color:var(--a);'>"+generic.value.length+"</span>]";
                            while (items.length > generic.value.length) this.eDisplay.removeChild(items.pop().elem);
                            while (items.length < generic.value.length) {
                                let item = {};
                                items.push(item);
                                let elem = item.elem = document.createElement("button");
                                this.eDisplay.appendChild(elem);
                                elem.classList.add("item");
                                let eIndex = item.eIndex = document.createElement("div");
                                elem.appendChild(eIndex);
                                eIndex.classList.add("index");
                                let eValue = item.eValue = document.createElement("div");
                                elem.appendChild(eValue);
                                eValue.classList.add("value");
                                if (generic.arraylessType == "boolean")
                                    eValue.innerHTML = "<ion-icon></ion-icon>";
                                elem.addEventListener("dblclick", e => { this.path += "/"+item.index; });
                            }
                            items.forEach((item, i) => {
                                item.index = i;
                                item.eIndex.textContent = i;
                                if (generic.arraylessType == "boolean") {
                                    item.eValue.style.backgroundColor = generic.value[i] ? "var(--cg)" : "var(--cr)";
                                    item.eValue.style.color = "var(--v8)";
                                    if (item.eValue.children[0] instanceof HTMLElement)
                                        item.eValue.children[0].setAttribute("name", generic.value[i] ? "checkmark" : "close");
                                } else {
                                    item.eValue.style.backgroundColor = "var(--v2)";
                                    let display = Topic.getDisplay(generic.arraylessType, generic.value[i]);
                                    item.eValue.style.color = (display == null || !("color" in display)) ? "var(--v8)" : display.color;
                                    item.eValue.style.fontFamily = "monospace";
                                    if (generic.arraylessType == "raw") {
                                        let value = generic.value[i];
                                        try { value = JSON.stringify(value); }
                                        catch (e) {}
                                        item.eValue.textContent = value;
                                    } else item.eValue.textContent = String(generic.value[i]);
                                }
                            });
                        };
                    } else {
                        let item = document.createElement("div");
                        this.eDisplay.appendChild(item);
                        item.classList.add("item");
                        if (generic.type == "boolean") item.innerHTML = "<ion-icon></ion-icon>";
                        else item.innerHTML = "<div></div><div></div>";
                        state.update = () => {
                            if (generic.type == "boolean") {
                                item.style.backgroundColor = generic.value ? "var(--cg)" : "var(--cr)";
                                item.style.color = "var(--v8)";
                                if (item.children[0] instanceof HTMLElement) {
                                    item.children[0].setAttribute("name", generic.value ? "checkmark" : "close");
                                    let r = item.getBoundingClientRect();
                                    item.children[0].style.fontSize = Math.max(16, Math.min(64, r.width-40, r.height-40))+"px";
                                }
                            } else {
                                item.style.backgroundColor = "var(--v2)";
                                item.style.position = "relative";
                                if (item.children[0] instanceof HTMLDivElement) {
                                    item.children[0].style.position = "absolute";
                                    item.children[0].style.top = "10px";
                                    item.children[0].style.left = "10px";
                                    item.children[0].style.color = "var(--v4)";
                                    item.children[0].style.fontSize = "14px";
                                    item.children[0].style.fontFamily = "monospace";
                                    item.children[0].textContent = generic.type;
                                }
                                if (item.children[1] instanceof HTMLDivElement) {
                                    item.children[1].style.position = "";
                                    item.children[1].style.top = "";
                                    item.children[1].style.left = "";
                                    let display = Topic.getDisplay(generic.type, generic.value);
                                    item.children[1].style.color = (display == null || !("color" in display)) ? "var(--v8)" : display.color;
                                    item.children[1].style.fontSize = "32px";
                                    item.children[1].style.fontFamily = "monospace";
                                    if (generic.type == "raw") {
                                        let value = generic.value;
                                        try { value = JSON.stringify(value); }
                                        catch (e) {}
                                        item.children[1].textContent = value;
                                    } else item.children[1].textContent = String(generic.value);
                                }
                            }
                        };
                    }
                }
                if (state.update) state.update();
            } else {
                this.eBrowser.classList.remove("this");
                this.eDisplay.classList.remove("this");
                this.icon = "document-outline";
                this.name = "NONE";
                this.path = "/";
            }
        });
    }

    get path() { return this.#path; }
    set path(v) {
        v = String(v).split("/");
        while (v.length > 0 && v.at(0).length <= 0) v.shift();
        while (v.length > 0 && v.at(-1).length <= 0) v.pop();
        v = v.join("/");
        if (this.path == v) return;
        this.#path = v;
        this.ePath.innerHTML = "";
        let path = this.path.split("/");
        if (path.length > 0 && path[0].length > 0) {
            let btn = document.createElement("button");
            this.ePath.appendChild(btn);
            btn.classList.add("back");
            btn.classList.add("icon");
            btn.innerHTML = "<ion-icon name='chevron-back'></ion-icon>";
            btn.addEventListener("click", e => {
                let path = this.path.split("/");
                if (path.length <= 0 || path[0].length <= 0) return;
                path.pop();
                this.path = path.join("/");
            });
        }
        path.unshift(null);
        path.forEach((name, i) => {
            if (i > 1) {
                let divider = document.createElement("div");
                this.ePath.appendChild(divider);
                divider.classList.add("divider");
                divider.textContent = "/";
            }
            let pth = path.slice(0, i+1).join("/");
            let btn = document.createElement("button");
            this.ePath.appendChild(btn);
            btn.classList.add("item");
            btn.classList.add("override");
            btn.textContent = (name == null) ? "/" : name;
            btn.addEventListener("click", e => { this.path = pth; });
        });
    }

    get ePath() { return this.#ePath; }
    get eBrowser() { return this.#eBrowser; }
    get eDisplay() { return this.#eDisplay; }
};

export default class App extends core.App {
    #browserItems;
    #rootWidget;
    #rootTable;

    #dragging;
    #dragData;

    #eSide;
    #eSideSections;
    #eContent;

    constructor() {
        super();

        this.#browserItems = [];
        this.#rootWidget = null;
        this.#rootTable = null;

        this.#dragging = false;
        this.#dragData = null;

        this.addHandler("start-complete", data => {       
            this.addBackButton();

            this.#eSide = document.querySelector("#mount > .side");
            this.#eSideSections = {};
            if (this.hasESide()) {
                Array.from(this.eSide.querySelectorAll(":scope > .section")).forEach(elem => {
                    let s = this.#eSideSections[elem.id] = new core.Target();
                    s.elem = elem;
                    s.getIsOpen = () => elem.classList.contains("this");
                    s.setIsOpen = v => {
                        v = !!v;
                        if (s.getIsOpen() == v) return true;
                        if (v) elem.classList.add("this");
                        else elem.classList.remove("this");
                        this.formatSide();
                        return true;
                    };
                    s.getIsClosed = () => !s.getIsOpen();
                    s.setIsClosed = v => s.setIsOpen(!v);
                    s.open = () => s.setIsOpen(true);
                    s.close = () => s.setIsClosed(true);
                    let btn = elem.querySelector(":scope > button");
                    if (btn instanceof HTMLButtonElement)
                        btn.addEventListener("click", e => {
                            s.setIsOpen(!s.getIsOpen());
                        });
                    s.eContent = elem.querySelector(":scope > .content");
                    let idfs = {
                    };
                    if (elem.id in idfs) idfs[elem.id]();
                });
                new ResizeObserver(() => this.formatSide()).observe(this.eSide);
            }
            this.#eContent = document.querySelector("#mount > .content");
            if (this.hasEContent())
                new ResizeObserver(() => this.formatContent()).observe(this.eContent);
            
            this.formatSide();
            this.formatContent();

            if (this.hasESideSection("browser"))
                this.getESideSection("browser").open();

            this.addHandler("refactor-browser", data => {
                let open = [];
                this.browserItems.forEach(itm => {
                    let path = [];
                    const dfs = itm => {
                        path.push(itm.name);
                        if (itm.isOpen) open.push(path.join("/"));
                        if (itm instanceof BrowserTable)
                            itm.children.forEach(itm => dfs(itm));
                        path.pop();
                    };
                    dfs(itm);
                });
                this.clearBrowserItems();
                if (!this.hasRootTable()) return;
                this.rootTable.children.forEach(generic => {
                    let path = [];
                    const build = generic => {
                        path.push(generic.name);
                        let itm = (generic instanceof Table) ? new BrowserTable(generic.name) : new BrowserTopic(generic.name, generic.type, generic.value);
                        itm.isOpen = open.includes(path.join("/"));
                        if (generic instanceof Table) generic.children.forEach(generic => itm.addChild(build(generic)));
                        path.pop();
                        return itm;
                    };
                    this.addBrowserItem(build(generic));
                });
            });

            const template = {
                name: "",
                content: [
                    {
                        name: "Table1",
                        content: [
                            {
                                name: "Table2",
                                content: [
                                    {
                                        name: "Topic1",
                                        type: "boolean[]",
                                        value: [true, false, true],
                                    },
                                    {
                                        name: "Topic2",
                                        type: "null",
                                        value: null,
                                    },
                                    {
                                        name: "Topic2a",
                                        type: "raw",
                                        value: { key: "value" },
                                    },
                                ],
                            },
                            {
                                name: "Topic3",
                                type: "string[]",
                                value: ["hello", "world", "!"],
                            },
                            {
                                name: "Topic4",
                                type: "int",
                                value: 1.23,
                            },
                            {
                                name: "Topic4a",
                                type: "float",
                                value: 1.23,
                            },
                        ]
                    },
                    {
                        name: "Topic5",
                        type: "boolean",
                        value: false,
                    },
                    {
                        name: "Topic6",
                        type: "double[]",
                        value: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
                    },
                    {
                        name: "Topic6a",
                        type: "string",
                        value: "hello world",
                    },
                ],
            };
            const build = temp => {
                let generic = ("content" in temp) ? new Table(temp.name) : new Topic(temp.name, temp.type, temp.value);
                if (generic instanceof Table) util.ensure(temp.content, "arr").forEach(temp => generic.addChild(build(temp)));
                return generic;
            };
            this.rootTable = build(template);

            this.addHandler("update", data => {
                if (this.hasRootWidget()) {
                    this.rootWidget.collapse();
                    this.rootWidget.update();
                }
            });

            document.body.addEventListener("keydown", e => {
                if (e.code != "KeyK") return;
                if (!(e.ctrlKey || e.metaKey)) return;
                const panelSection = document.getElementById("panelsection");
                const showSection = () => {
                    if (!(panelSection instanceof HTMLDivElement)) return;
                    panelSection.style.visibility = "inherit";
                };
                const hideSection = () => {
                    if (!(panelSection instanceof HTMLDivElement)) return;
                    panelSection.style.visibility = "";
                };
                const placeSection = (elem, side) => {
                    if (!(panelSection instanceof HTMLDivElement)) return;
                    if (!(elem instanceof HTMLElement)) return;
                    if (!["+x", "-x", "+y", "-y", "*"].includes(side)) return;
                    let r = elem.getBoundingClientRect();
                    panelSection.style.left = (r.left + ((side == "+x") ? (r.width/2) : 0))+"px";
                    panelSection.style.top = (r.top + ((side == "+y") ? (r.height/2) : 0))+"px";
                    panelSection.style.width = ((side.includes("x") ? (r.width/2) : r.width)-4)+"px";
                    panelSection.style.height = ((side.includes("y") ? (r.height/2) : r.height)-4)+"px";
                };
                const getHovered = (widget, pos) => {
                    if (!this.hasEContent()) return null;
                    pos = new V(pos);
                    let r;
                    r = this.eContent.getBoundingClientRect();
                    pos.x = Math.min(r.right, Math.max(r.left, pos.x));
                    pos.y = Math.min(r.bottom, Math.max(r.top, pos.y));
                    if (!(widget instanceof Widget)) return null;
                    r = widget.elem.getBoundingClientRect();
                    if (pos.x < r.left || pos.x > r.right) return null;
                    if (pos.y < r.top || pos.y > r.bottom) return null;
                    if (widget instanceof Container) {
                        for (let i = 0; i < widget.children.length; i++) {
                            let h = getHovered(widget.children[i], pos);
                            if (h) return h;
                        }
                    }
                    let x = (pos.x-r.left)/r.width - 0.5;
                    let y = (pos.y-r.top)/r.height - 0.5;
                    let side;
                    if (x-y > 0) side = (x+y > 0) ? "+x" : "-y";
                    else side = (x+y > 0) ? "+y" : "-x";
                    return {
                        widget: widget,
                        side: side,
                    };
                };
                const mouseup = e => {
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                    hideSection();
                    if (!this.hasRootWidget()) {
                        this.rootWidget = new Panel();
                        return;
                    }
                    const hovered = getHovered(this.rootWidget, new V(e.pageX, e.pageY));
                    if (!util.is(hovered, "obj") || !(hovered.widget instanceof Panel)) return;
                    let container = new Container();
                    container.axis = hovered.side[1];
                    if (hovered.widget == this.rootWidget) {
                        this.rootWidget = null;
                        container.addChild((hovered.side[0] == "+") ? hovered.widget : new Panel());
                        container.addChild((hovered.side[0] != "+") ? hovered.widget : new Panel());
                        this.rootWidget = container;
                    } else {
                        let parent = hovered.widget.parent;
                        let weights = parent.weights, at = parent.children.indexOf(hovered.widget);
                        parent.remChild(hovered.widget);
                        container.addChild((hovered.side[0] == "+") ? hovered.widget : new Panel());
                        container.addChild((hovered.side[0] != "+") ? hovered.widget : new Panel());
                        parent.insertChild(container, at);
                        parent.weights = weights;
                    }
                    this.rootWidget.collapse();
                };
                const mousemove = e => {
                    if (!this.hasEContent()) return;
                    if (!this.hasRootWidget()) {
                        showSection();
                        placeSection(this.eContent, "*");
                        return;
                    }
                    const hovered = getHovered(this.rootWidget, new V(e.pageX, e.pageY));
                    if (!util.is(hovered, "obj") || !(hovered.widget instanceof Panel))
                        return hideSection();
                    showSection();
                    placeSection(hovered.widget.elem, hovered.side);
                };
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
                mousemove(e);
            });
        });
    }

    get browserItems() { return [...this.#browserItems]; }
    set browserItems(v) {
        v = util.ensure(v, "arr");
        this.clearBrowserItems();
        v.forEach(v => this.addBrowserItem(v));
    }
    clearBrowserItems() {
        let itms = this.browserItems;
        itms.forEach(itm => this.remBrowserItem(itm));
        return itms;
    }
    hasBrowserItem(itm) {
        if (!(itm instanceof BrowserItem)) return false;
        return this.#browserItems.includes(itm);
    }
    addBrowserItem(itm) {
        if (!(itm instanceof BrowserItem)) return false;
        if (this.hasBrowserItem(itm)) return false;
        this.#browserItems.push(itm);
        if (this.hasESideSection("browser") && this.getESideSection("browser").eContent instanceof HTMLDivElement)
            this.getESideSection("browser").eContent.appendChild(itm.elem);
        return itm;
    }
    remBrowserItem(itm) {
        if (!(itm instanceof BrowserItem)) return false;
        if (!this.hasBrowserItem(itm)) return false;
        this.#browserItems.splice(this.#browserItems.indexOf(itm), 1);
        if (this.hasESideSection("browser") && this.getESideSection("browser").eContent instanceof HTMLDivElement)
            this.getESideSection("browser").eContent.removeChild(itm.elem);
        return itm;
    }

    get rootWidget() { return this.#rootWidget; }
    set rootWidget(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.rootWidget == v) return;
        if (this.hasRootWidget()) {
            this.rootWidget.parent = null;
            if (this.hasEContent())
                this.eContent.removeChild(this.rootWidget.elem);
        }
        this.#rootWidget = v;
        if (this.hasRootWidget()) {
            this.rootWidget.parent = this;
            if (this.hasEContent())
                this.eContent.appendChild(this.rootWidget.elem);
        }
        this.formatContent();
    }
    hasRootWidget() { return this.rootWidget instanceof Widget; }
    get rootTable() { return this.#rootTable; }
    set rootTable(v) {
        v = (v instanceof Table) ? v : null;
        if (this.rootTable == v) return;
        if (this.hasRootTable()) {
            this.rootTable.parent = null;
            this.rootTable.remHandler("change", this.rootTable._onChange);
            delete this.rootTable._onChange;
        }
        this.#rootTable = v;
        if (this.hasRootTable()) {
            this.rootTable.parent = this;
            this.rootTable._onChange = () => {
                this.post("refactor-browser", null);
            };
            this.rootTable.addHandler("change", this.rootTable._onChange);
        }
        this.post("refactor-browser", null);
    }
    hasRootTable() { return this.rootTable instanceof Table; }
    getGeneric(path) {
        if (!this.hasRootTable()) return null;
        return this.rootTable.lookup(path);
    }

    format() {
        this.formatSide();
        this.formatContent();
    }
    formatSide() {
        if (!this.hasESide()) return false;
        let r = this.eSide.getBoundingClientRect();
        let ids = this.eSideSections;
        let idsOpen = ids.filter(id => this.getESideSection(id).getIsOpen());
        let availableHeight = r.height - ids.length*22;
        let divideAmong = idsOpen.length;
        idsOpen.forEach(id => this.getESideSection(id).elem.style.setProperty("--h", (availableHeight/divideAmong + 22)+"px"));
        return true;
    }
    formatContent() {
        if (!this.hasEContent()) return false;
        if (!this.hasRootWidget()) return false;
        let r = this.eContent.getBoundingClientRect();
        this.rootWidget.elem.style.setProperty("--w", r.width+"px");
        this.rootWidget.elem.style.setProperty("--h", r.height+"px");
        this.rootWidget.format();
        return true;
    }

    get eSide() { return this.#eSide; }
    hasESide() { return this.eSide instanceof HTMLDivElement; }
    get eSideSections() { return Object.keys(this.#eSideSections); }
    hasESideSection(id) { return id in this.#eSideSections; }
    getESideSection(id) { return this.#eSideSections[id]; }
    get eContent() { return this.#eContent; }
    hasEContent() { return this.eContent instanceof HTMLDivElement; }
}