import * as util from "../util.js";
import { V } from "../util.js";

import * as core from "../core.js";

import NTModel from "../nt4/model.js";


function getDisplay(t, v) {
    t = String(t);
    if (!NTModel.Topic.TYPES.includes(t)) return null;
    if (t.endsWith("[]")) {
        t = t.substring(0, t.length-2);
        let display = getDisplay(t, (t == "boolean") ? true : null);
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

        let cancel = 10;
        this.eDisplay.addEventListener("click", e => {
            if (cancel <= 0) return cancel = 10;
            this.isOpen = !this.isOpen;
        });
        this.eDisplay.addEventListener("dblclick", e => {
            this.post("trigger", { path: this.name });
        });
        this.eDisplay.addEventListener("mousedown", e => {
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                if (cancel > 0) return cancel--;
                mouseup();
                this.post("drag", { path: this.name });
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
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
        child._onDrag = data => {
            data = util.ensure(data, "obj");
            this.post("drag", { path: this.name+"/"+data.path });
        };
        child.addHandler("trigger", child._onTrigger);
        child.addHandler("drag", child._onDrag);
        this.eContent.appendChild(child.elem);
        return child;
    }
    remChild(child) {
        if (!(child instanceof BrowserItem)) return false;
        if (!this.hasChild(child)) return false;
        this.#children.splice(this.#children.indexOf(child), 1);
        child.remHandler("trigger", child._onTrigger);
        child.remHandler("trigger", child._onDrag);
        delete child._onTrigger;
        delete child._onDrag;
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
        if (!NTModel.Topic.TYPES.includes(v)) v = "raw";
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
        this.#value = NTModel.Topic.ensureType(this.type, v);
        this.post("value-set", { v: this.value });
        this.#sub.forEach(itm => this.eContent.removeChild(itm.elem));
        this.#sub = [];
        this.icon = "";
        this.eIcon.style.color = "";
        this.eName.style.color = "";
        let display = getDisplay(this.type, this.value);
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
                itm.addHandler("drag", data => {
                    data = util.ensure(data, "obj");
                    this.post("drag", { path: this.name+"/"+data.path });
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
    addChild(child, at=null) {
        if (!(child instanceof Widget)) return false;
        if (this.hasChild(child)) return false;
        if (child.parent != null) return false;
        if (at == null) at = this.#children.length;
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
        this.addChild(child, at);
        this.weights = weights;
        return child;
    }
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
            [...subchildren].reverse().forEach(subchild => this.addChild(subchild, i));
            this.weights = weights;
        });
    }
}

class Panel extends Widget {
    #pages;
    #pageIndex;

    #eClose;
    #eTop;
    #eAdd;
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
        this.#eAdd = document.createElement("button");
        this.eTop.appendChild(this.eAdd);
        this.eAdd.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.eClose.addEventListener("click", e => {
            if (this.hasAppParent()) return this.parent.rootWidget = null;
            if (this.hasParent()) return this.parent.remChild(this);
        });
        this.eAdd.addEventListener("click", e => {
            this.addPage(new Panel.AddPage());
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
    addPage(page, at=null) {
        if (!(page instanceof Panel.Page)) return false;
        if (this.hasPage(page)) return false;
        if (page.parent != null) return false;
        if (at == null) at = this.#pages.length;
        this.#pages.splice(at, 0, page);
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
        this.eAdd.style.order = this.pages.length;
    }
    collapse() {
        if (this.pages.length > 0) return;
        if (this.hasAppParent()) this.parent.rootWidget = null;
        if (this.hasParent()) this.parent.remChild(this);
    }

    get eClose() { return this.#eClose; }
    get eTop() { return this.#eTop; }
    get eAdd() { return this.#eAdd; }
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

        this.eSearchInput.addEventListener("keydown", e => {
            if (!["Backspace", "Delete"].includes(e.code)) return;
            if (this.eSearchInput.value.length > 0) return;
            this.searchPart = null;
        });
        this.eSearchInput.addEventListener("input", e => this.refresh());
        this.eSearchClear.addEventListener("click", e => {
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
            let items = [
                {
                    item: new Panel.AddPage.Button("Graph", "analytics"),
                    trigger: () => {},
                },
            ];
            items = items.map(item => {
                item.item.addHandler("trigger", item.trigger);
                return item.item;
            });
            if (this.query.length > 0) {
                const fuse = new Fuse(items, {
                    isCaseSensitive: false,
                    keys: [
                        "name",
                    ],
                });
                items = fuse.search(this.query).map(item => item.item);
            }
            this.items = items;
        } else if (["tables", "topics", "all"].includes(this.searchPart)) {
            this.tags = [new Panel.AddPage.Tag(
                this.searchPart[0].toUpperCase()+this.searchPart.substring(1).toLowerCase(),
                { tables: "folder-outline", topics: "document-outline", all: "" }[this.searchPart],
            )];
            if (this.searchPart == "all") this.tags[0].iconSrc = "../assets/icons/variable.svg";
            this.placeholder = "Search "+this.searchPart.toLowerCase();
            let items = [];
            if (this.hasApp() && this.app.hasRootModel() && this.app.rootModel.hasRoot()) {
                let root = this.app.rootModel.root;
                const dfs = generic => {
                    let itm = new Panel.AddPage.GenericButton(generic);
                    if (generic instanceof { tables: NTModel.Table, topics: NTModel.Topic, all: NTModel.Generic }[this.searchPart]) items.push({
                        item: itm,
                        trigger: () => {
                            if (!this.hasParent()) return;
                            let index = this.parent.pages.indexOf(this);
                            this.parent.addPage(new Panel.BrowserPage(generic.path), index);
                            this.parent.remPage(this);
                        },
                    });
                    if (generic instanceof NTModel.Table) generic.children.forEach(generic => dfs(generic));
                };
                dfs(root);
            }
            items = items.map(item => {
                item.item.addHandler("trigger", item.trigger);
                return item.item;
            });
            if (this.query.length > 0) {
                const fuse = new Fuse(items, {
                    isCaseSensitive: false,
                    keys: [
                        "generic.path",
                    ],
                });
                items = fuse.search(this.query).map(item => item.item);
            }
            this.items = items;
        }
        this.eSearchInput.focus();
    }

    get searchPart() { return this.#searchPart; }
    set searchPart(v) {
        v = (v == null) ? null : String(v);
        if (this.searchPart == v) return;
        this.#searchPart = v;
        this.query = "";
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

    get query() { return this.eSearchInput.value; }
    set query(v) { this.eSearchInput.value = v; }
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
            if (this.generic instanceof NTModel.Table) {
                this.icon = "folder-outline";
                this.iconColor = "";
                this.info = "";
            } else if (this.generic instanceof NTModel.Topic) {
                let display = getDisplay(this.generic.type, this.generic.value);
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
        v = (v instanceof NTModel.Generic) ? v : null;
        if (this.generic == v) return;
        this.#generic = v;
    }
    hasGeneric() { return this.generic instanceof NTModel.Generic; }
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
            window.log = true;
            let generic = this.hasApp() ? this.app.lookup(this.path) : null;
            window.log = false;
            if (prevGeneric != generic) {
                prevGeneric = generic;
                state = {};
            }
            this.eTabIcon.style.color = "";
            if (generic instanceof NTModel.Table) {
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
                    if (generic instanceof NTModel.Table) generic.children.forEach(generic => dfsGeneric(generic));
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
                    let item = (generic instanceof NTModel.Table) ? new BrowserTable(generic.name) : new BrowserTopic(generic.name, generic.type, generic.value);
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
            } else if (generic instanceof NTModel.Topic) {
                this.eBrowser.classList.remove("this");
                this.eDisplay.classList.add("this");
                let display = getDisplay(generic.type, generic.value);
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
                            let display = getDisplay(generic.type, generic.value);
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
                                    let display = getDisplay(generic.arraylessType, generic.value[i]);
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
                                    let display = getDisplay(generic.type, generic.value);
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
Panel.ToolPage = class PanelToolPage extends Panel.Page {
    constructor() {
        super();
    }
};

export default class App extends core.App {
    #browserItems;
    #rootWidget;
    #rootModel;

    #eSide;
    #eSideSections;
    #eContent;
    #eBlock;

    constructor() {
        super();

        this.#browserItems = [];
        this.#rootWidget = null;
        this.#rootModel = null;

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
            this.#eBlock = document.getElementById("block");
            
            this.formatSide();
            this.formatContent();

            if (this.hasESideSection("browser"))
                this.getESideSection("browser").open();

            this.addHandler("refactor-browser", data => {
                let newPaths = {};
                if (this.hasRootModel() && this.rootModel.hasRoot()) {
                    this.rootModel.root.children.forEach(generic => {
                        let path = [];
                        const dfs = generic => {
                            path.push(generic.name);
                            newPaths[path.join("/")] = generic;
                            if (generic instanceof NTModel.Table)
                                generic.children.forEach(generic => dfs(generic));
                            path.pop();
                        };
                        dfs(generic);
                    });
                }
                let open = [], oldPaths = {};
                this.browserItems.forEach(itm => {
                    let path = [];
                    const dfs = itm => {
                        path.push(itm.name);
                        oldPaths[path.join("/")] = itm;
                        if (itm.isOpen) open.push(path.join("/"));
                        if (itm instanceof BrowserTable)
                            itm.children.forEach(itm => dfs(itm));
                        path.pop();
                    };
                    dfs(itm);
                });
                let needRem = [], needAdd = [];
                for (let path in oldPaths)
                    if (!(path in newPaths))
                        needRem.push(path.split("/"));
                for (let path in newPaths)
                    if (!(path in oldPaths))
                        needAdd.push(path.split("/"));
                needRem.sort((a, b) => b.length-a.length);
                needAdd.sort((a, b) => a.length-b.length);
                needRem.forEach(path => {
                    let superPath = path.slice(0, path.length-1).join("/");
                    path = path.join("/");
                    let itm = oldPaths[path];
                    if (superPath in oldPaths) oldPaths[superPath].remChild(itm);
                    else this.remBrowserItem(itm);
                    delete oldPaths[path];
                });
                needAdd.forEach(path => {
                    let superPath = path.slice(0, path.length-1).join("/");
                    path = path.join("/");
                    let generic = newPaths[path];
                    let itm = (generic instanceof NTModel.Table) ? new BrowserTable(generic.name) : new BrowserTopic(generic.name, generic.type, generic.value);
                    if (superPath in oldPaths) oldPaths[superPath].addChild(itm);
                    else this.addBrowserItem(itm);
                    oldPaths[path] = itm;
                });
            });

            this.rootModel = new NTModel("localhost");
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
            let path = [];
            const build = temp => {
                if ("content" in temp) {
                    path.push(temp.name);
                    util.ensure(temp.content, "arr").forEach(temp => build(temp));
                    path.pop();
                    return;
                }
                this.rootModel.announceTopic([...path, temp.name].join("/"), temp.type, temp.value);
            };
            // build(template);

            const getHovered = (widget, pos, options) => {
                options = util.ensure(options, "obj");
                let canSub = ("canSub" in options) ? options.canSub : true;
                let canTop = ("canTop" in options) ? options.canTop : true;
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
                    if (canSub) {
                        for (let i = 0; i < widget.children.length; i++) {
                            let h = getHovered(widget.children[i], pos, options);
                            if (h) return h;
                        }
                    }
                }
                if (widget instanceof Panel) {
                    if (canTop) {
                        r = widget.eTop.getBoundingClientRect();
                        if (pos.x > r.left && pos.x < r.right) {
                            if (pos.y > r.top && pos.y < r.bottom) {
                                if (widget.pages.length <= 0) return {
                                    widget: widget,
                                    at: 0,
                                };
                                let at = null;
                                for (let i = 0; i < widget.pages.length; i++) {
                                    if (at != null) continue;
                                    let r = widget.getPage(i).eTab.getBoundingClientRect();
                                    if (i == 0) {
                                        if (pos.x < r.left+r.width/2) {
                                            at = 0;
                                            continue;
                                        }
                                    }
                                    if (i+1 >= widget.pages.length) {
                                        if (pos.x > r.left+r.width/2) at = widget.pages.length;
                                        continue;
                                    }
                                    let ri = r, rj = widget.getPage(i+1).eTab.getBoundingClientRect();
                                    if (pos.x > ri.left+ri.width/2 && pos.x < rj.left+rj.width) at = i+1;
                                }
                                if (at != null) return {
                                    widget: widget,
                                    at: at,
                                };
                            }
                        }
                        r = widget.elem.getBoundingClientRect();
                    }
                }
                let x = (pos.x-r.left)/r.width - 0.5;
                let y = (pos.y-r.top)/r.height - 0.5;
                let at;
                if (x-y > 0) at = (x+y > 0) ? "+x" : "-y";
                else at = (x+y > 0) ? "+y" : "-x";
                return {
                    widget: widget,
                    at: at,
                };
            };
            const isValid = o => {
                if (o instanceof NTModel.Generic) return true;
                if (o instanceof Widget) return true;
                if (o instanceof Panel.Page) return true;
                return false;
            };
            this.addHandler("drag-start", () => {
                if (!isValid(this.dragData)) return;
            });
            this.addHandler("drag-move", e => {
                if (!isValid(this.dragData)) return;
                if (!this.hasRootWidget()) {
                    this.showBlock();
                    if (this.hasEContent()) this.placeBlock(this.eContent.getBoundingClientRect());
                    return;
                }
                const hovered = getHovered(
                    this.rootWidget, new V(e.pageX, e.pageY),
                    {
                        canSub: true,
                        canTop: (this.dragData instanceof NTModel.Generic || this.dragData instanceof Panel.Page),
                    },
                );
                if (!util.is(hovered, "obj") || !(hovered.widget instanceof Panel))
                    return this.hideBlock();
                this.showBlock();
                let at = hovered.at;
                if (["+x", "-x", "+y", "-y"].includes(at)) {
                    let r = new util.Rect(hovered.widget.elem.getBoundingClientRect());
                    r.x += (at == "+x") ? r.w/2 : 0;
                    r.y += (at == "+y") ? r.h/2 : 0;
                    r.w /= at.includes("x") ? 2 : 1;
                    r.h /= at.includes("y") ? 2 : 1;
                    this.placeBlock(r);
                } else if (util.is(at, "int")) {
                    let r = new util.Rect(hovered.widget.eTop.getBoundingClientRect());
                    let x = (at >= hovered.widget.pages.length) ? hovered.widget.getPage(hovered.widget.pages.length-1).eTab.getBoundingClientRect().right : hovered.widget.getPage(at).eTab.getBoundingClientRect().left;
                    this.placeBlock(new util.Rect(x, r.y+10, 0, r.h-15));
                }
            });
            this.addHandler("drag-submit", e => {
                if (!isValid(this.dragData)) return;
                this.hideBlock();
                let canWidgetFromData = false;
                const getWidgetFromData = () => {
                    if (this.dragData instanceof NTModel.Generic) return new Panel([new Panel.BrowserPage(this.dragData.path)]);
                    if (this.dragData instanceof Widget) return this.dragData;
                    if (this.dragData instanceof Panel.Page) return new Panel([this.dragData]);
                    return null;
                };
                if (this.dragData instanceof NTModel.Generic) canWidgetFromData = true;
                else if (this.dragData instanceof Widget) canWidgetFromData = true;
                else if (this.dragData instanceof Panel.Page) canWidgetFromData = true;
                let canPageFromData = false;
                const getPageFromData = () => {
                    if (this.dragData instanceof NTModel.Generic) return new Panel.BrowserPage(this.dragData.path);
                    if (this.dragData instanceof Widget);
                    if (this.dragData instanceof Panel.Page) return this.dragData;
                    return null;
                };
                if (this.dragData instanceof NTModel.Generic) canPageFromData = true;
                else if (this.dragData instanceof Widget);
                else if (this.dragData instanceof Panel.Page) canPageFromData = true;
                if (!this.hasRootWidget()) {
                    this.rootWidget = getWidgetFromData();
                    return;
                }
                const hovered = getHovered(
                    this.rootWidget, new V(e.pageX, e.pageY),
                    {
                        canSub: true,
                        canTop: (this.dragData instanceof NTModel.Generic || this.dragData instanceof Panel.Page),
                    },
                );
                if (!util.is(hovered, "obj") || !(hovered.widget instanceof Panel)) return;
                let at = hovered.at;
                if (["+x", "-x", "+y", "-y"].includes(at) && canWidgetFromData) {
                    let widget = getWidgetFromData();
                    let container = new Container();
                    container.axis = at[1];
                    if (hovered.widget == this.rootWidget) {
                        this.rootWidget = null;
                        container.addChild((at[0] == "+") ? hovered.widget : widget);
                        container.addChild((at[0] != "+") ? hovered.widget : widget);
                        this.rootWidget = container;
                    } else {
                        let parent = hovered.widget.parent;
                        let weights = parent.weights, at = parent.children.indexOf(hovered.widget);
                        parent.remChild(hovered.widget);
                        container.addChild((at[0] == "+") ? hovered.widget : widget);
                        container.addChild((at[0] != "+") ? hovered.widget : widget);
                        parent.addChild(container, at);
                        parent.weights = weights;
                    }
                } else if (util.is(at, "int") && canPageFromData) {
                    hovered.widget.addPage(getPageFromData(), at);
                }
                this.rootWidget.collapse();
            });

            this.addHandler("cmd-new", data => {
                if (this.dragging) return;
                data = util.ensure(data, "obj");
                this.dragData = new Panel.AddPage();
                this.dragging = true;
            });

            this.addHandler("update", data => {
                if (this.hasRootWidget()) {
                    this.rootWidget.collapse();
                    if (this.hasRootWidget()) this.rootWidget.update();
                }
            });

            document.body.addEventListener("keydown", e => {
                if (e.code != "KeyK") return;
                if (!(e.ctrlKey || e.metaKey)) return;
                this.post("cmd-new", {});
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
        itm._onDrag = data => {
            data = util.ensure(data, "obj");
            let generic = this.lookup(data.path);
            if (!(generic instanceof NTModel.Generic)) return;
        };
        itm.addHandler("drag", itm._onDrag);
        if (this.hasESideSection("browser") && this.getESideSection("browser").eContent instanceof HTMLDivElement)
            this.getESideSection("browser").eContent.appendChild(itm.elem);
        return itm;
    }
    remBrowserItem(itm) {
        if (!(itm instanceof BrowserItem)) return false;
        if (!this.hasBrowserItem(itm)) return false;
        this.#browserItems.splice(this.#browserItems.indexOf(itm), 1);
        itm.remHandler("drag", itm._onDrag);
        delete itm._onDrag;
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
    get rootModel() { return this.#rootModel; }
    set rootModel(v) {
        v = (v instanceof NTModel) ? v : null;
        if (this.rootModel == v) return;
        if (this.hasRootModel()) {
            this.rootModel.remHandler("change", this.rootModel.root._onChange);
            delete this.rootModel._onChange;
        }
        this.#rootModel = v;
        if (this.hasRootModel()) {
            this.rootModel._onChange = () => this.post("refactor-browser", null);
            this.rootModel.addHandler("change", this.rootModel._onChange);
        }
        this.post("refactor-browser", null);
    }
    hasRootModel() { return this.rootModel instanceof NTModel; }
    lookup(path) {
        if (!this.hasRootModel() || !this.rootModel.hasRoot()) return null;
        return this.rootModel.root.lookup(path);
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
    get eBlock() { return this.#eBlock; }
    hasEBlock() { return this.eBlock instanceof HTMLDivElement; }
    get isBlockShown() { return this.hasEBlock() ? this.eBlock.classList.contains("this") : null; }
    set isBlockShown(v) {
        if (!this.hasEBlock()) return;
        v ? this.eBlock.classList.add("this") : this.eBlock.classList.remove("this");
    }
    get isBlockHidden() { return this.hasEBlock() ? !this.isBlockShown : null; }
    set isBlockHidden(v) { return this.isBlockShown = !v; }
    showBlock() { return this.isBlockShown = true; }
    hideBlock() { return this.isBlockHidden = true; }
    placeBlock(r) {
        r = new util.Rect(r);
        if (!this.hasEBlock()) return;
        r.normalize();
        this.eBlock.style.left = r.x+"px";
        this.eBlock.style.top = r.y+"px";
        this.eBlock.style.width = Math.max(0, r.w-4)+"px";
        this.eBlock.style.height = Math.max(0, r.h-4)+"px";
    }
}