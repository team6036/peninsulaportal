import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
// import { SAOPass } from "three/addons/postprocessing/SAOPass.js";
// import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import NTSource from "../nt4/source.js";


export const VERSION = 1;

class RLine extends core.Odometry2d.Render {
    #a; #b;
    #color;

    constructor(a, b, color) {
        super();

        this.#a = new V();
        this.#b = new V();
        this.#color = null;

        this.a = a;
        this.b = b;
        this.color = color;

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            ctx.strokeStyle = this.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(this.color) : this.color;
            ctx.lineWidth = 7.5*quality;
            ctx.lineJoin = "round";
            ctx.lineCap = "square";
            ctx.beginPath();
            ctx.moveTo(...this.odometry.worldToCanvas(this.a).xy);
            ctx.lineTo(...this.odometry.worldToCanvas(this.b).xy);
            ctx.stroke();
        });
    }

    get a() { return this.#a; }
    set a(v) { this.#a.set(v); }
    get aX() { return this.a.x; }
    set aX(v) { this.a.x = v; }
    get aY() { return this.a.y; }
    set aY(v) { this.a.y = v; }
    get b() { return this.#b; }
    set b(v) { this.#b.set(v); }
    get bX() { return this.b.x; }
    set bX(v) { this.b.x = v; }
    get bY() { return this.b.y; }
    set bY(v) { this.b.y = v; }

    get color() { return this.#color; }
    set color(v) { this.#color = String(v); }
}


function getDisplay(t, v) {
    t = String(t);
    if (!NTSource.Topic.TYPES.includes(t)) return null;
    if (t.endsWith("[]")) {
        t = t.substring(0, t.length-2);
        let display = getDisplay(t, (t == "boolean") ? true : null);
        if (display == null) return null;
        return {
            src: "../assets/icons/array.svg",
            color: display.color,
        };
    }
    if (["double", "float", "int"].includes(t)) return {
        src: "../assets/icons/number.svg",
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
        this.format();
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
        this.format();
        return child;
    }

    format() {
        this.children.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? +1 : (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 0).forEach((child, i) => {
            child.elem.style.order = i;
            if (child instanceof BrowserTable) child.format();
        });
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

        this.#sub = {};

        this.type = type;
        this.value = value;
    }

    get type() { return this.#type; }
    set type(v) {
        v = String(v);
        if (!NTSource.Topic.TYPES.includes(v)) v = "raw";
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
        this.#value = NTSource.Topic.ensureType(this.type, v);
        this.post("value-set", { v: this.value });
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
                if (!(i in this.#sub)) {
                    let itm = this.#sub[i] = new BrowserTopic(i, null, null);
                    itm.addHandler("trigger", data => {
                        data = util.ensure(data, "obj");
                        this.post("trigger", { path: this.name+"/"+data.path });
                    });
                    itm.addHandler("drag", data => {
                        data = util.ensure(data, "obj");
                        this.post("drag", { path: this.name+"/"+data.path });
                    });
                    this.eContent.appendChild(itm.elem);
                }
                let itm = this.#sub[i];
                itm.type = this.arraylessType;
                itm.value = value;
            });
        } else {
            Object.keys(this.#sub).forEach(id => {
                let itm = this.#sub[itm];
                this.eContent.removeChild(itm.elem);
                delete this.#sub[id];
            });
        }
        Object.keys(this.#sub).sort().forEach((id, i) => {
            let itm = this.#sub[id];
            itm.elem.style.order = i;
        });
    }
}

class ToolButton extends core.Target {
    #elem;
    #eIcon;
    #eName;

    constructor(name, icon) {
        super();

        this.#elem = document.createElement("button");
        this.elem.classList.add("item");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);

        let cancel = 10;
        this.elem.addEventListener("click", e => {
            if (cancel <= 0) return cancel = 10;
            this.post("trigger", null);
        });
        this.elem.addEventListener("mousedown", e => {
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                if (cancel > 0) return cancel--;
                mouseup();
                this.post("drag", null);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.name = name;
        this.icon = icon;
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }

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
        v = (v instanceof Container) ? v : (v instanceof App.ProjectPage) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return this.parent instanceof Container; }
    hasPageParent() { return this.parent instanceof App.ProjectPage; }
    get page() {
        if (this.hasPageParent()) return this.parent;
        if (this.hasParent()) return this.parent.page;
        return null;
    }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() {
        if (!this.hasPage()) return null;
        return this.page.app;
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

    constructor(...a) {
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

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Container) a = [a.children, a.weights, a.axis];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof Widget) a = [a, [], "x"];
                else {
                    a = new Container(...a);
                    a = [a.children, a.weights, a.axis];
                }
            }
            else if (util.is(a, "obj")) a = [a.children, a.weights, a.axis];
            else a = [[], [], "x"];
        }
        if (a.length == 2) {
            if (util.is(a[1], "str")) a = [a[0], [], a[1]];
            else a = [...a, "x"];
        }

        this.children = a[0];
        this.weights = a[1];
        this.axis = a[2];
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
        this.post("change", null);
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
        child._onChange = () => this.post("change", null);
        child.addHandler("change", child._onChange);
        this.post("change", null);
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
        child.remHandler("change", child._onChange);
        delete child._onChange;
        this.post("change", null);
        this.format();
        return child;
    }

    get axis() { return this.#axis; }
    set axis(v) {
        v = String(v).toLowerCase();
        if (!["x", "y"].includes(v)) return;
        if (this.axis == v) return;
        this.#axis = v;
        this.post("change", null);
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
            if (this.hasPageParent()) this.parent.rootWidget = null;
            else if (this.hasParent()) this.parent.remChild(this);
            return;
        }
        if (this.children.length <= 1) {
            let child = this.children[0];
            this.clearChildren();
            if (this.hasPageParent()) this.parent.rootWidget = child;
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

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                children: this.children,
                weights: this.weights,
                axis: this.axis,
            }],
        };
    }
}

class Panel extends Widget {
    #tabs;
    #tabIndex;

    #eOptions;
    #eTop;
    #eAdd;
    #eContent;

    constructor(...a) {
        super();

        this.elem.classList.add("panel");
        this.elem.tabIndex = 0;

        this.#tabs = [];
        this.#tabIndex = null;

        this.#eOptions = document.createElement("button");
        this.elem.appendChild(this.eOptions);
        this.eOptions.classList.add("options");
        this.eOptions.innerHTML = "<ion-icon name='ellipsis-vertical'></ion-icon>";
        this.#eTop = document.createElement("div");
        this.elem.appendChild(this.eTop);
        this.eTop.classList.add("top");
        this.#eAdd = document.createElement("button");
        this.eTop.appendChild(this.eAdd);
        this.eAdd.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.tabIndex = 0;

        this.eOptions.addEventListener("click", e => {
            if (!this.hasApp()) return;
            e.stopPropagation();
            let itm;
            let menu = new core.App.ContextMenu();
            itm = menu.addItem(new core.App.ContextMenu.Item(this.isTitleCollapsed ? "Expand Title" : "Collapse Title", this.isTitleCollapsed ? "chevron-expand" : "chevron-collapse"));
            itm.shortcut = "⇧⌃F";
            itm.addHandler("trigger", data => {
                this.isTitleCollapsed = !this.isTitleCollapsed;
            });
            menu.addItem(new core.App.ContextMenu.Divider());
            itm = menu.addItem(new core.App.ContextMenu.Item("Close Panel", "close"));
            // itm.shortcut = "⇧⌘W";
            itm.addHandler("trigger", data => {
                if (this.hasPageParent()) return this.parent.rootWidget = null;
                if (this.hasParent()) return this.parent.remChild(this);
            });
            this.app.contextMenu = menu;
            let r = this.eOptions.getBoundingClientRect();
            this.app.placeContextMenu(r.left, r.bottom);
        });
        this.eAdd.addEventListener("click", e => {
            this.addTab(new Panel.AddTab());
        });

        this.addHandler("update", data => {
            this.tabs.forEach(tab => tab.update());
        });

        if (a.length <= 0 || a.length > 2) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel) a = [a.tabs, false];
            else if (a instanceof Panel.Tab) a = [[a], false];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof Panel.Tab) a = [a, false];
                else {
                    a = new Panel(...a);
                    a = [a.tabs, a.isTitleCollapsed];
                }
            }
            else if (util.is(a, "obj")) a = [a.tabs, a.isCollapsed];
            else a = [[], false];
        }

        [this.tabs, this.isTitleCollapsed] = a;

        if (this.tabs.length <= 0) this.addTab(new Panel.AddTab());

        new MutationObserver(() => this.post("change", null)).observe(this.elem, { attributes: true, attributeFilter: ["class"] });
    }

    get tabs() { return [...this.#tabs]; }
    set tabs(v) {
        v = util.ensure(v, "arr");
        this.clearTabs();
        v.forEach(v => this.addTab(v));
    }
    get tabIndex() { return this.#tabIndex; }
    set tabIndex(v) {
        v = Math.min(this.#tabs.length-1, Math.max(0, util.ensure(v, "int")));
        if (this.tabIndex == v) return;
        this.#tabIndex = v;
        this.#tabs.forEach((tab, i) => (i == this.tabIndex) ? tab.open() : tab.close());
        if (this.tabs[this.tabIndex] instanceof Panel.Tab)
            this.tabs[this.tabIndex].eTab.scrollIntoView({ behavior: "smooth" });
        this.post("change", null);
        this.format();
    }
    clearTabs() {
        let tabs = this.tabs;
        tabs.forEach(tab => this.remTab(tab));
        return tabs;
    }
    hasTab(tab) {
        if (!(tab instanceof Panel.Tab)) return false;
        return this.#tabs.includes(tab) && tab.parent == this;
    }
    getTab(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.#tabs.length) return null;
        return this.#tabs[i];
    }
    addTab(tab, at=null) {
        if (!(tab instanceof Panel.Tab)) return false;
        if (this.hasTab(tab)) return false;
        if (tab.parent != null) return false;
        if (at == null) at = this.#tabs.length;
        this.#tabs.splice(at, 0, tab);
        tab.parent = this;
        tab._onChange = () => this.post("change", null);
        tab.addHandler("change", tab._onChange);
        this.post("change", null);
        this.eTop.appendChild(tab.eTab);
        this.eContent.appendChild(tab.elem);
        this.tabIndex = this.#tabs.indexOf(tab);
        this.format();
        return tab;
    }
    remTab(tab) {
        if (!(tab instanceof Panel.Tab)) return false;
        if (!this.hasTab(tab)) return false;
        if (tab.parent != this) return false;
        this.#tabs.splice(this.#tabs.indexOf(tab), 1);
        tab.parent = null;
        tab.remHandler("change", tab._onChange);
        delete tab._onChange;
        this.post("change", null);
        this.eTop.removeChild(tab.eTab);
        this.eContent.removeChild(tab.elem);
        tab.close();
        this.format();
        let index = this.tabIndex;
        this.#tabIndex = null;
        this.tabIndex = index;
        return tab;
    }

    format() {
        this.tabs.forEach((tab, i) => {
            tab.eTab.style.order = i;
        });
        this.eAdd.style.order = this.tabs.length;
    }
    collapse() {
        if (this.tabs.length > 0) return;
        if (this.hasPageParent()) this.parent.rootWidget = null;
        if (this.hasParent()) this.parent.remChild(this);
    }

    get eOptions() { return this.#eOptions; }
    get eTop() { return this.#eTop; }
    get eAdd() { return this.#eAdd; }
    get eContent() { return this.#eContent; }

    get isTitleCollapsed() { return this.elem.classList.contains("collapsed"); }
    set isTitleCollapsed(v) {
        v = !!v;
        if (this.isTitleCollapsed == v) return;
        if (v) this.elem.classList.add("collapsed");
        else this.elem.classList.remove("collapsed");
    }
    get isTitleExpanded() { return !this.isTitleCollapsed; }
    set isTitleExpanded(v) { this.isTitleCollapsed = !v; }
    collapseTitle() { return this.isTitleCollapsed = true; }
    expandTitle() { return this.isTitleExpanded = true; }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                tabs: this.tabs,
                isCollapsed: this.isTitleCollapsed,
            }],
        };
    }
}
Panel.Tab = class PanelTab extends core.Target {
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

        let cancel = 10;
        this.eTab.addEventListener("click", e => {
            if (cancel <= 0) return cancel = 10;
            if (!this.hasParent()) return;
            this.parent.tabIndex = this.parent.tabs.indexOf(this);
        });
        this.eTab.addEventListener("mousedown", e => {
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                if (cancel > 0) return cancel--;
                mouseup();
                if (!this.hasApp() || !this.hasParent()) return;
                const app = this.app;
                this.parent.remTab(this);
                app.dragData = this;
                app.dragging = true;
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.eTabClose.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasParent()) return;
            this.parent.remTab(this);
        });

        new MutationObserver(() => this.post("change", null)).observe(this.elem, { attributes: true, attributeFilter: ["class"] });
    }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Panel) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return this.parent instanceof Panel; }
    get page() {
        if (!this.hasParent()) return null;
        return this.parent.page;
    }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() {
        if (!this.hasPage()) return null;
        return this.page.app;
    }
    hasApp() { return this.app instanceof App; }

    get elem() { return this.#elem; }
    get eTab() { return this.#eTab; }
    get eTabIcon() { return this.#eTabIcon; }
    get eTabName() { return this.#eTabName; }
    get eTabClose() { return this.#eTabClose; }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
        if (v) this.eTab.classList.add("this");
        else this.eTab.classList.remove("this");
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
        return this.parent.path + "-" + this.parent.tabs.indexOf(this);
    }

    getHovered(pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        return null;
    }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{}],
        };
    }
};
Panel.AddTab = class PanelAddTab extends Panel.Tab {
    #searchPart;
    #tags;
    #items;

    #eSearch;
    #eSearchTags;
    #eSearchInput;
    #eSearchClear;
    #eContent;

    constructor(...a) {
        super();

        this.elem.classList.add("add");

        this.name = "New Tab";
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
        this.eSearchInput.addEventListener("input", e => {
            this.post("change", null);
            this.refresh();
        });
        this.eSearchClear.addEventListener("click", e => {
            this.searchPart = null;
        });

        this.addHandler("update", data => {
            this.items.forEach(itm => itm.update());
        });

        if (a.length <= 0 || a.length > 1) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.AddTab) a = [a.searchPart, a.query];
            else if (util.is(a, "arr")) {
                a = new Panel.AddTab(...a);
                a = [a.searchPart, a.query];
            }
            else if (util.is(a, "obj")) a = [a.searchPart, a.query];
            else a = [null, ""];
        }

        [this.searchPart, this.query] = a;

        this.refresh();
    }

    refresh() {
        this.clearTags();
        this.placeholder = "";
        this.clearItems();
        let toolItems = [
            {
                item: new Panel.AddTab.Button("Graph", "analytics", "var(--cb)"),
                trigger: () => {
                    if (!this.hasParent()) return;
                    let index = this.parent.tabs.indexOf(this);
                    this.parent.addTab(new Panel.GraphTab(), index);
                    this.parent.remTab(this);
                },
            },
            {
                item: new Panel.AddTab.Button("Odometry2d", "locate", "var(--cy)"),
                trigger: () => {
                    if (!this.hasParent()) return;
                    let index = this.parent.tabs.indexOf(this);
                    this.parent.addTab(new Panel.Odometry2dTab(), index);
                    this.parent.remTab(this);
                },
            },
            {
                item: new Panel.AddTab.Button("Odometry3d", "locate", "var(--cy)"),
                init: item => (item.btn.disabled = false),
                trigger: () => {
                    if (!this.hasParent()) return;
                    let index = this.parent.tabs.indexOf(this);
                    this.parent.addTab(new Panel.Odometry3dTab(), index);
                    this.parent.remTab(this);
                },
            },
        ];
        toolItems = toolItems.map(item => {
            if (item.init) item.init(item.item);
            item.item.addHandler("trigger", item.trigger);
            return item.item;
        });
        if (this.searchPart == null) {
            this.tags = [];
            this.placeholder = "Search tools, tables, and topics";
            if (this.query.length > 0) {
                toolItems = util.search(toolItems, ["name"], this.query);
                let genericItems = [];
                if (this.hasPage() && this.page.hasRootSource() && this.page.rootSource.hasRoot()) {
                    let root = this.page.rootSource.root;
                    const dfs = generic => {
                        let itm = new Panel.AddTab.GenericButton(generic);
                        genericItems.push({
                            item: itm,
                            trigger: () => {
                                if (!this.hasParent()) return;
                                let index = this.parent.tabs.indexOf(this);
                                this.parent.addTab(new Panel.BrowserTab(generic.path), index);
                                this.parent.remTab(this);
                            },
                        });
                        if (generic instanceof NTSource.Table) generic.children.forEach(generic => dfs(generic));
                    };
                    dfs(root);
                }
                genericItems = genericItems.map(item => {
                    if (item.init) item.init(item.item);
                    item.item.addHandler("trigger", item.trigger);
                    return item.item;
                });
                genericItems = util.search(genericItems, ["generic.path", "generic.type"], this.query);
                this.items = [
                    new Panel.AddTab.Header("Tools"),
                    ...toolItems,
                    new Panel.AddTab.Header("Tables and Topics"),
                    ...genericItems,
                ];
            } else {
                this.items = [
                    new Panel.AddTab.Button("Tables", "folder-outline", "", true),
                    new Panel.AddTab.Button("Topics", "document-outline", "", true),
                    new Panel.AddTab.Button("All", "", "", true),
                    new Panel.AddTab.Divider(),
                    new Panel.AddTab.Header("Tools"),
                    new Panel.AddTab.Button("Tools", "cube-outline", "", true),
                    ...toolItems,
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
            }
        } else if (this.searchPart == "tools") {
            this.tags = [new Panel.AddTab.Tag("Tools", "cube-outline")];
            this.placeholder = "Search tools";
            toolItems = util.search(toolItems, ["name"], this.query);
            this.items = toolItems;
        } else if (["tables", "topics", "all"].includes(this.searchPart)) {
            this.tags = [new Panel.AddTab.Tag(
                util.capitalize(this.searchPart),
                { tables: "folder-outline", topics: "document-outline", all: "" }[this.searchPart],
            )];
            if (this.searchPart == "all") this.tags[0].iconSrc = "../assets/icons/variable.svg";
            this.placeholder = "Search "+this.searchPart.toLowerCase();
            let items = [];
            if (this.hasPage() && this.page.hasRootSource() && this.page.rootSource.hasRoot()) {
                let root = this.page.rootSource.root;
                const dfs = generic => {
                    let itm = new Panel.AddTab.GenericButton(generic);
                    if (generic instanceof { tables: NTSource.Table, topics: NTSource.Topic, all: NTSource.Generic }[this.searchPart]) items.push({
                        item: itm,
                        trigger: () => {
                            if (!this.hasParent()) return;
                            let index = this.parent.tabs.indexOf(this);
                            this.parent.addTab(new Panel.BrowserTab(generic.path), index);
                            this.parent.remTab(this);
                        },
                    });
                    if (generic instanceof NTSource.Table) generic.children.forEach(generic => dfs(generic));
                };
                dfs(root);
            }
            items = items.map(item => {
                if (item.init) item.init(item.item);
                item.item.addHandler("trigger", item.trigger);
                return item.item;
            });
            items = util.search(items, ["generic.path", "generic.type"], this.query);
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
        this.post("change", null);
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
        if (!(tag instanceof Panel.AddTab.Tag)) return false;
        return this.#tags.includes(tag);
    }
    addTag(tag) {
        if (!(tag instanceof Panel.AddTab.Tag)) return false;
        if (this.hasTag(tag)) return false;
        this.#tags.push(tag);
        this.eSearchTags.appendChild(tag.elem);
        return tag;
    }
    remTag(tag) {
        if (!(tag instanceof Panel.AddTab.Tag)) return false;
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
        if (!(itm instanceof Panel.AddTab.Item)) return false;
        return this.#items.includes(itm);
    }
    addItem(itm) {
        if (!(itm instanceof Panel.AddTab.Item)) return false;
        if (this.hasItem(itm)) return false;
        this.#items.push(itm);
        this.eContent.appendChild(itm.elem);
        return itm;
    }
    remItem(itm) {
        if (!(itm instanceof Panel.AddTab.Item)) return false;
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
    set query(v) {
        this.eSearchInput.value = v;
        this.post("change", null);
    }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                searchPart: this.searchPart,
                query: this.query,
            }],
        };
    }
};
Panel.AddTab.Tag = class PanelAddTabTag extends core.Target {
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
Panel.AddTab.Item = class PanelAddTabItem extends core.Target {
    #elem;

    constructor() {
        super();

        this.#elem = document.createElement("div");
    }

    get elem() { return this.#elem; }

    update() { this.post("update", null); }
};
Panel.AddTab.Header = class PanelAddTabHeader extends Panel.AddTab.Item {
    constructor(value) {
        super();

        this.elem.classList.add("header");

        this.value = value;
    }

    get value() { return this.elem.textContent; }
    set value(v) { this.elem.textContent = v; }
};
Panel.AddTab.Divider = class PanelAddTabDivider extends Panel.AddTab.Item {
    constructor() {
        super();

        this.elem.classList.add("divider");
    }
};
Panel.AddTab.Button = class PanelAddTabButton extends Panel.AddTab.Item {
    #btn;
    #eIcon;
    #eName;
    #eInfo;
    #eChevron;

    constructor(name, icon="", color="", hasChevron=false) {
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
        this.iconColor = color;
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
Panel.AddTab.GenericButton = class PanelAddTabGenericButton extends Panel.AddTab.Button {
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
            if (this.generic instanceof NTSource.Table) {
                this.icon = "folder-outline";
                this.iconColor = "";
                this.info = "";
            } else if (this.generic instanceof NTSource.Topic) {
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
        v = (v instanceof NTSource.Generic) ? v : null;
        if (this.generic == v) return;
        this.#generic = v;
    }
    hasGeneric() { return this.generic instanceof NTSource.Generic; }
};
Panel.BrowserTab = class PanelBrowserTab extends Panel.Tab {
    #path;

    #ePath;
    #eBrowser;
    #eDisplay;

    constructor(...a) {
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

        if (a.length <= 0 || a.length > 1) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.BrowserTab) a = [a.path];
            else if (util.is(a, "arr")) {
                if (util.is(a[0], "str")) a = [a.join("/")];
                else {
                    a = new Panel.BrowserTab(...a);
                    a = [a.path];
                }
            }
            else if (util.is(a, "obj")) a = [a.path];
            else a = [a];
        }

        [this.path] = a;

        let prevGeneric = null;
        let state = {};

        this.addHandler("update", data => {
            window.log = true;
            let generic = this.hasPage() ? this.page.lookup(this.path) : null;
            window.log = false;
            if (prevGeneric != generic) {
                prevGeneric = generic;
                state = {};
            }
            this.eTabIcon.style.color = "";
            if (generic instanceof NTSource.Table) {
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
                    if (generic instanceof NTSource.Table) generic.children.forEach(generic => dfsGeneric(generic));
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
                    let item = (generic instanceof NTSource.Table) ? new BrowserTable(generic.name) : new BrowserTopic(generic.name, generic.type, generic.value);
                    let superPath = path.split("/");
                    superPath.pop();
                    superPath = superPath.join("/");
                    if (superPath.length > 0) {
                        if (!(superPath in oldPaths)) continue;
                        let parentItem = oldPaths[superPath];
                        oldPaths[path] = parentItem.addChild(item);
                    } else {
                        state.items.push(item);
                        item._onTrigger = data => {
                            data = util.ensure(data, "obj");
                            this.path += "/" + data.path;
                        };
                        item._onDrag = data => {
                            data = util.ensure(data, "obj");
                            let path = this.path + "/" + data.path;
                            if (!this.hasApp() || !this.hasPage()) return;
                            this.app.dragData = this.page.lookup(path);
                            this.app.dragging = true;
                        };
                        item.addHandler("trigger", item._onTrigger);
                        item.addHandler("drag", item._onDrag);
                        this.eBrowser.appendChild(item.elem);
                    }
                }
                for (let path in oldPaths) {
                    if (path in newPaths) continue;
                    let item = oldPaths[path];
                    let superPath = path.split("/");
                    superPath.pop();
                    superPath = superPath.join("/");
                    if (superPath.length > 0) {
                        if (!(superPath in oldPaths)) continue;
                        let parentItem = oldPaths[superPath];
                        parentItem.remChild(item);
                        delete oldPaths[path];
                    } else {
                        state.items.splice(state.items.indexOf(item), 1);
                        item.remHandler("trigger", item._onTrigger);
                        item.remHandler("drag", item._onDrag);
                        delete item._onTrigger;
                        delete item._onDrag;
                        this.eBrowser.removeChild(item.elem);
                    }
                }
                state.items.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? +1 : (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 0).forEach((itm, i) => (itm.elem.style.order = i));
            } else if (generic instanceof NTSource.Topic) {
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
                                    item.eValue.style.backgroundColor = "var(--v2-8)";
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
                                item.style.backgroundColor = "var(--v2-8)";
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
        this.post("change", null);
    }

    get ePath() { return this.#ePath; }
    get eBrowser() { return this.#eBrowser; }
    get eDisplay() { return this.#eDisplay; }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                path: this.path,
            }],
        };
    }
};
Panel.ToolTab = class PanelToolTab extends Panel.Tab {
    constructor(name, icon, color="") {
        super();

        this.elem.classList.add("tool");

        this.name = name;
        this.icon = icon;
        this.iconColor = color;
    }
};
Panel.ToolCanvasTab = class PanelToolCanvasTab extends Panel.ToolTab {
    #quality;

    #eToggle;
    #eOptions;
    #eOptionSections;
    #eContent;
    #canvas; #ctx;

    static DO = true;

    constructor(name, icon, color="") {
        super(name, icon, color);

        this.elem.classList.add("canvas");

        this.#quality = null;

        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#canvas = document.createElement("canvas");
        this.eContent.appendChild(this.canvas);
        if (this.constructor.DO) this.#ctx = this.canvas.getContext("2d");
        this.#eToggle = document.createElement("button");
        this.elem.appendChild(this.eToggle);
        this.eToggle.classList.add("toggle");
        this.eToggle.classList.add("override");
        this.eToggle.innerHTML = "<ion-icon name='chevron-up'></ion-icon>";
        this.#eOptions = document.createElement("div");
        this.elem.appendChild(this.eOptions);
        this.eOptions.classList.add("options");
        this.#eOptionSections = {};

        this.eToggle.addEventListener("click", e => {
            this.isOptionsOpen = !this.isOptionsOpen;
        });

        this.addHandler("openclose", data => {
            this.isOptionsOpen = !this.isOptionsOpen;
        });

        if (this.constructor.DO) {
            new ResizeObserver(() => {
                let r = this.eContent.getBoundingClientRect();
                this.canvas.width = (r.width-4) * this.quality;
                this.canvas.height = (r.height-4) * this.quality;
                this.canvas.style.width = (r.width-4)+"px";
                this.canvas.style.height = (r.height-4)+"px";
                this.update();
            }).observe(this.eContent);
        }

        new MutationObserver(() => this.post("change", null)).observe(this.elem, { attributes: true, attributeFilter: ["class"] });

        this.openOptions();
    }

    get quality() { return this.#quality; }
    set quality(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (util.is(this.quality, "num")) return;
        this.#quality = v;
    }

    get eToggle() { return this.#eToggle; }
    get eContent() { return this.#eContent; }
    get canvas() { return this.#canvas; }
    get ctx() { return this.#ctx; }
    get eOptions() { return this.#eOptions; }
    get eOptionSections() { return Object.keys(this.#eOptionSections); }
    hasEOptionSection(id) { return id in this.#eOptionSections; }
    getEOptionSection(id) { return this.#eOptionSections[id]; }
    addEOptionSection(elem) {
        if (!(elem instanceof HTMLDivElement)) return false;
        if (this.hasEOptionSection(elem.id)) return false;
        this.#eOptionSections[elem.id] = elem;
        this.eOptions.appendChild(elem);
        return elem;
    }

    get isOptionsOpen() { return this.elem.classList.contains("open"); }
    set isOptionsOpen(v) {
        v = !!v;
        if (this.isOptionsOpen == v) return;
        if (v) this.elem.classList.add("open");
        else this.elem.classList.remove("open");
    }
    get isOptionsClosed() { return !this.isOptionsOpen; }
    set isOptionsClosed(v) { this.isOptionsOpen = !v; }
    openOptions() { return this.isOptionsOpen = true; }
    closeOptions() { return this.isOptionsClosed = true; }
};
Panel.GraphTab = class PanelGraphTab extends Panel.ToolCanvasTab {
    #lVars; #rVars;

    #viewMode;
    #viewParams;

    constructor(...a) {
        super("Graph", "analytics", "var(--cb)");

        this.elem.classList.add("graph");

        this.#lVars = new Set();
        this.#rVars = new Set();

        this.#viewMode = "all";
        this.#viewParams = {};

        ["l", "v", "r"].forEach(id => {
            const elem = document.createElement("div");
            elem.id = id;
            this.addEOptionSection(elem);
            elem.classList.add("section");
            elem.innerHTML = "<div class='header'>"+{ l: "Left Axis", v: "View Window", r: "Right Axis" }[id]+"</div>";
            let idfs = {
                l: () => {
                    elem.classList.add("list");
                    this.addHandler("update", data => {
                        if (this.lVars.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    });
                },
                r: () => {
                    elem.classList.add("list");
                    this.addHandler("update", data => {
                        if (this.rVars.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    });
                },
                v: () => {
                    elem.classList.add("view");
                    let eNav = document.createElement("div");
                    elem.appendChild(eNav);
                    eNav.classList.add("nav");
                    const viewModes = ["left", "right", "section", "all"];
                    let eNavButtons = {};
                    let eForModes = {};
                    viewModes.forEach(mode => {
                        let btn = document.createElement("button");
                        eNav.appendChild(btn);
                        eNavButtons[mode] = btn;
                        btn.textContent = util.capitalize(mode);
                        btn.addEventListener("click", e => {
                            this.viewMode = mode;
                        });
                        let elems = eForModes[mode] = [];
                        let modefs = {
                            left: () => {
                                let info = document.createElement("div");
                                elem.appendChild(info);
                                elems.push(info);
                                info.classList.add("info");
                                info.innerHTML = "<span>Forwards View Time</span><span class='units'>ms</span>";
                                let input = document.createElement("input");
                                elem.appendChild(input);
                                elems.push(input);
                                input.type = "number";
                                input.placeholder = "...";
                                input.min = 0;
                                this.viewParams.time = 5000;
                                this.post("change", null);
                                input.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(input.value), "num"));
                                    this.viewParams.time = v;
                                    this.post("change", null);
                                });
                                this.addHandler("update", data => {
                                    if (document.activeElement == input) return;
                                    input.value = this.viewParams.time;
                                });
                            },
                            right: () => {
                                let info = document.createElement("div");
                                elem.appendChild(info);
                                elems.push(info);
                                info.classList.add("info");
                                info.innerHTML = "<span>Backwards View Time</span><span class='units'>ms</span>";
                                let input = document.createElement("input");
                                elem.appendChild(input);
                                elems.push(input);
                                input.type = "number";
                                input.placeholder = "...";
                                input.min = 0;
                                this.viewParams.time = 5000;
                                this.post("change", null);
                                input.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(input.value), "num"));
                                    this.viewParams.time = v;
                                    this.post("change", null);
                                });
                                this.addHandler("update", data => {
                                    if (document.activeElement == input) return;
                                    input.value = this.viewParams.time;
                                });
                            },
                            section: () => {
                                let info, input;
                                info = document.createElement("div");
                                elem.appendChild(info);
                                elems.push(info);
                                info.classList.add("info");
                                info.innerHTML = "<span>Range Start</span><span class='units'>ms</span>";
                                let startInput = input = document.createElement("input");
                                elem.appendChild(input);
                                elems.push(input);
                                input.type = "number";
                                input.placeholder = "Start";
                                input.min = 0;
                                info = document.createElement("div");
                                elem.appendChild(info);
                                elems.push(info);
                                info.classList.add("info");
                                info.innerHTML = "<span>Range Stop</span><span class='units'>ms</span>";
                                let stopInput = input = document.createElement("input");
                                elem.appendChild(input);
                                elems.push(input);
                                input.type = "number";
                                input.placeholder = "Stop";
                                input.min = 0;
                                this.viewParams.start = 0;
                                this.viewParams.stop = 5000;
                                this.post("change", null);
                                startInput.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(startInput.value), "num"));
                                    this.viewParams.start = v;
                                    this.post("change", null);
                                });
                                stopInput.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(stopInput.value), "num"));
                                    this.viewParams.stop = v;
                                    this.post("change", null);
                                });
                                this.addHandler("update", data => {
                                    if (document.activeElement != startInput) startInput.value = this.viewParams.start;
                                    if (document.activeElement != stopInput) stopInput.value = this.viewParams.stop;
                                });
                            },
                        };
                        if (mode in modefs) modefs[mode]();
                    });
                    this.addHandler("update", data => {
                        for (let mode in eNavButtons) {
                            if (mode == this.viewMode) eNavButtons[mode].classList.add("this");
                            else eNavButtons[mode].classList.remove("this");
                            eForModes[mode].forEach(elem => {
                                elem.style.display = (mode == this.viewMode) ? "" : "none";
                            });
                        }
                    });
                },
            };
            if (id in idfs) idfs[id]();
        });

        const quality = this.quality = 3;
        const padding = 40;

        this.addHandler("update", () => {
            if (this.isClosed) return;
            
            const ctx = this.ctx;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            if (!this.hasPage() || !this.page.hasRootSource() || !this.page.rootSource.hasRoot()) return;
            const source = this.page.rootSource;
            const graphRange = {
                left: () => [
                    source.serverStartTime,
                    Math.min(source.serverTime, source.serverStartTime+Math.max(0, util.ensure(this.viewParams.time, "num", 5000))),
                ],
                right: () => [
                    Math.max(source.serverStartTime, source.serverTime-Math.max(0, util.ensure(this.viewParams.time, "num", 5000))),
                    source.serverTime,
                ],
                section: () => {
                    let start = util.ensure(source.serverStartTime+this.viewParams.start, "num", source.serverStartTime);
                    let stop = util.ensure(source.serverStartTime+this.viewParams.stop, "num", source.serverTime);
                    start = Math.min(source.serverTime, Math.max(source.serverStartTime, start));
                    stop = Math.min(source.serverTime, Math.max(source.serverStartTime, stop));
                    stop = Math.max(start, stop);
                    return [start, stop];
                },
                all: () => [source.serverStartTime, source.serverTime],
            }[this.viewMode]();
            let graphVars = [
                { vars: this.lVars },
                { vars: this.rVars },
            ];
            graphVars.forEach((o, i) => {
                let vars = o.vars;
                let range = [null, null];
                let logs = {}, topics = {};
                vars.forEach(v => {
                    if (!v.isShown) return;
                    if (!v.hasName()) return;
                    let topic = source.root.lookup(v.name);
                    if (topic.isArray) return;
                    let log = source.getLogFor(v.name, ...graphRange);
                    if (!util.is(log, "arr")) return;
                    let start = source.getValueAt(v.name, graphRange[0]), stop = source.getValueAt(v.name, graphRange[1]);
                    if (start != null) log.unshift({ ts: graphRange[0], v: start });
                    if (stop != null) log.push({ ts: graphRange[1], v: stop });
                    if (log.length <= 0) return;
                    logs[v.name] = log;
                    topics[v.name] = topic;
                    if (!["double", "float", "int"].includes(topic.type)) return;
                    let subrange = [Math.min(...log.map(p => p.v)), Math.max(...log.map(p => p.v))];
                    if (range[0] == null || range[1] == null) return range = subrange;
                    range[0] = Math.min(range[0], subrange[0]);
                    range[1] = Math.max(range[1], subrange[1]);
                });
                range = range.map(v => util.ensure(v, "num"));
                let step = Panel.GraphTab.findStep(range[1]-range[0], 5);
                range[0] = Math.floor(range[0]/step) - 1;
                range[1] = Math.ceil(range[1]/step) + 1;
                o.range = range;
                o.step = step;
                o.logs = logs;
                o.topics = topics;
            });
            let maxNSteps = 0;
            graphVars.forEach(o => {
                let range = o.range;
                maxNSteps = Math.max(maxNSteps, range[1]-range[0]);
            });
            graphVars.forEach(o => {
                let range = o.range;
                let nSteps = range[1]-range[0];
                let addAbove = Math.ceil((maxNSteps-nSteps) / 2);
                let addBelow = (maxNSteps-nSteps) - addAbove;
                range[0] -= addBelow;
                range[1] += addAbove;
                o.range = range;
            });
            const timeStep = Panel.GraphTab.findStep(graphRange[1]-graphRange[0], 10);
            let y0 = padding*quality;
            let y1 = ctx.canvas.height - padding*quality;
            let y2 = ctx.canvas.height - (padding-5)*quality;
            let y3 = ctx.canvas.height - (padding-10)*quality;
            ctx.lineWidth = 2*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--v4");
            ctx.font = (12*quality)+"px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            for (let i = Math.ceil(graphRange[0]/timeStep); i <= Math.floor(graphRange[1]/timeStep); i++) {
                let x = (i*timeStep - graphRange[0]) / (graphRange[1]-graphRange[0]);
                x = util.lerp(padding*quality, ctx.canvas.width - padding*quality, x);
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v4");
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
                let t = i*timeStep, unit = "ms";
                if (t/1000 >= 1) {
                    t /= 1000;
                    unit = "s";
                }
                ctx.fillText(t+unit, x, y3);
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v2");
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, y1);
                ctx.stroke();
            }
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v2");
            for (let i = 0; i <= maxNSteps; i++) {
                let y = i / maxNSteps;
                y = util.lerp(padding*quality, ctx.canvas.height-padding*quality, 1-y);
                ctx.beginPath();
                ctx.moveTo(padding*quality, y);
                ctx.lineTo(ctx.canvas.width-padding*quality, y);
                ctx.stroke();
            }
            let nDiscrete = 0;
            graphVars.forEach((o, i) => {
                let vars = o.vars;
                let range = o.range;
                let step = o.step;
                let logs = o.logs;
                let topics = o.topics;
                let x1 = [padding*quality, ctx.canvas.width-padding*quality][i];
                let x2 = [(padding-5)*quality, ctx.canvas.width-(padding-5)*quality][i];
                let x3 = [(padding-10)*quality, ctx.canvas.width-(padding-10)*quality][i];
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v4");
                ctx.lineWidth = 2*quality;
                ctx.lineJoin = "miter";
                ctx.lineCap = "square";
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--v4");
                ctx.font = (12*quality)+"px monospace";
                ctx.textAlign = ["right", "left"][i];
                ctx.textBaseline = "middle";
                for (let j = range[0]; j <= range[1]; j++) {
                    let y = (j-range[0]) / (range[1]-range[0]);
                    y = util.lerp(padding*quality, ctx.canvas.height-padding*quality, 1-y);
                    ctx.beginPath();
                    ctx.moveTo(x1, y);
                    ctx.lineTo(x2, y);
                    ctx.stroke();
                    ctx.fillText(j*step, x3, y);
                }
                vars.forEach(v => {
                    if (!(v.name in logs)) return;
                    let log = logs[v.name];
                    let topic = topics[v.name];
                    if (!["double", "float", "int"].includes(topic.type)) {
                        log.forEach((p, i) => {
                            let pts = p.ts, pv = p.v;
                            let npts = (i+1 >= log.length) ? graphRange[1] : log[i+1].ts;
                            let x = util.lerp(padding*quality, ctx.canvas.width-padding*quality, (pts-graphRange[0])/(graphRange[1]-graphRange[0]));
                            let nx = util.lerp(padding*quality, ctx.canvas.width-padding*quality, (npts-graphRange[0])/(graphRange[1]-graphRange[0]));
                            ctx.fillStyle = v.hasColor() ? v.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(v.color) : v.color : "#fff";
                            ctx.fillRect(
                                x, (padding+10+20*nDiscrete)*quality,
                                Math.max(0, nx-x-5*quality), 15*quality,
                            );
                            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--v8");
                            ctx.font = (12*quality)+"px monospace";
                            ctx.textAlign = "left";
                            ctx.textBaseline = "middle";
                            ctx.fillText(pv, x+5*quality, (padding+10+20*nDiscrete+7.5)*quality);
                        });
                        nDiscrete++;
                        return;
                    }
                    let ranges = [];
                    for (let i = 0; i < log.length; i++) {
                        let p = log[i];
                        let ts = p.ts, v = p.v;
                        let x = util.lerp(padding*quality, ctx.canvas.width-padding*quality, (ts-graphRange[0])/(graphRange[1]-graphRange[0]));
                        if (ranges.length > 0) {
                            let px = ranges.at(-1).x;
                            let r = ranges.at(-1).r;
                            if (x-px > quality) ranges.push({ x: x, r: [v, v] });
                            else {
                                r[0] = Math.min(r[0], v);
                                r[1] = Math.max(r[1], v);
                            }
                        } else ranges.push({ x: x, r: [v, v] });
                    }
                    ctx.strokeStyle = v.hasColor() ? v.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(v.color) : v.color : "#fff";
                    ctx.lineWidth = 2*quality;
                    ctx.lineJoin = "round";
                    ctx.lineCap = "square";
                    ctx.beginPath();
                    let py = null;
                    ranges.forEach((p, i) => {
                        let x = p.x, r = p.r;
                        let y1 = r[0], y2 = r[1];
                        y1 = (y1-(step*range[0])) / (step*(range[1]-range[0]));
                        y2 = (y2-(step*range[0])) / (step*(range[1]-range[0]));
                        y1 = util.lerp(padding*quality, ctx.canvas.height-padding*quality, 1-y1);
                        y2 = util.lerp(padding*quality, ctx.canvas.height-padding*quality, 1-y2);
                        if (i > 0) {
                            ctx.lineTo(x, py);
                            ctx.lineTo(x, (y1+y2)/2);
                        } else ctx.moveTo(x, (y1+y2)/2);
                        ctx.lineTo(x, y1);
                        ctx.lineTo(x, y2);
                        ctx.lineTo(x, (y1+y2)/2);
                        py = (y1+y2)/2;
                    });
                    ctx.stroke();
                });
            });
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v4");
            ctx.lineWidth = 2*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.beginPath();
            ctx.strokeRect(...new V(padding*quality).xy, ...new V(ctx.canvas.width, ctx.canvas.height).sub(2*padding*quality).xy);
        });

        if (a.length <= 0 || [4].includes(a.length) || a.length > 5) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.GraphTab) a = [a.lVars, a.rVars, a.viewMode, a.viewParams, a.isOptionsOpen];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof Panel.GraphTab.Variable) a = [a, []];
                else {
                    a = new Panel.GraphTab(...a);
                    a = [a.lVars, a.rVars, a.viewMode, a.viewParams, a.isOptionsOpen];
                }
            }
            else if (a instanceof Panel.GraphTab.Variable) a = [[a], []];
            else if (util.is(a, "obj")) a = [a.lVars, a.rVars, a.viewMode, a.viewParams, a.isOpen];
            else a = [[], []];
        }
        if (a.length == 2)
            a = [...a, true];
        if (a.length == 3) {
            if (util.is(a[2], "str")) a = [...a, {}, true];
            else a = [a[0], a[1], "all", {}, a[2]];
        }

        [this.lVars, this.rVars, this.viewMode, this.viewParams, this.isOptionsOpen] = a;
    }

    static findStep(v, nSteps) {
        v = Math.max(0, util.ensure(v, "num"));
        if (v <= 0) return 1;
        let factors = [1, 2, 5];
        let pow = Math.round(Math.log10(v));
        let closest = null, closests = [];
        for (let i = -1; i <= 1; i++) {
            factors.forEach(f => {
                let step = (10 ** (pow+i)) * f;
                let a = Math.abs(nSteps - Math.round(v / step));
                if (closest == null || a < closest) {
                    closest = a;
                    closests = [];
                }
                if (a == closest) closests.push(step);
            });
        }
        return Math.min(...closests);
    }

    get lVars() { return [...this.#lVars]; }
    set lVars(v) {
        v = util.ensure(v, "arr");
        this.clearLVars();
        v.forEach(v => this.addLVar(v));
    }
    clearLVars() {
        let lVars = this.lVars;
        lVars.forEach(lVar => this.remLVar(lVar));
        return lVars;
    }
    hasLVar(lVar) {
        if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
        return this.#lVars.has(lVar);
    }
    addLVar(lVar) {
        if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
        if (this.hasLVar(lVar)) return false;
        this.#lVars.add(lVar);
        lVar._onRemove = () => this.remLVar(lVar);
        lVar._onChange = () => this.post("change", null);
        lVar.addHandler("remove", lVar._onRemove);
        lVar.addHandler("change", lVar._onChange);
        if (this.hasEOptionSection("l"))
            this.getEOptionSection("l").appendChild(lVar.elem);
        this.post("change", null);
        return lVar;
    }
    remLVar(lVar) {
        if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
        if (!this.hasLVar(lVar)) return false;
        this.#lVars.delete(lVar);
        lVar.remHandler("remove", lVar._onRemove);
        lVar.remHandler("change", lVar._onChange);
        delete lVar._onRemove;
        delete lVar._onChange;
        if (this.hasEOptionSection("l"))
            this.getEOptionSection("l").removeChild(lVar.elem);
        this.post("change", null);
        return lVar;
    }
    get rVars() { return [...this.#rVars]; }
    set rVars(v) {
        v = util.ensure(v, "arr");
        this.clearRVars();
        v.forEach(v => this.addRVar(v));
    }
    clearRVars() {
        let rVars = this.rVars;
        rVars.forEach(rVar => this.remRVar(rVar));
        return rVars;
    }
    hasRVar(rVar) {
        if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
        return this.#rVars.has(rVar);
    }
    addRVar(rVar) {
        if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
        if (this.hasRVar(rVar)) return false;
        this.#rVars.add(rVar);
        rVar._onRemove = () => this.remRVar(rVar);
        rVar._onChange = () => this.post("change", null);
        rVar.addHandler("remove", rVar._onRemove);
        rVar.addHandler("change", rVar._onChange);
        if (this.hasEOptionSection("r"))
            this.getEOptionSection("r").appendChild(rVar.elem);
        this.post("change", null);
        return rVar;
    }
    remRVar(rVar) {
        if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
        if (!this.hasRVar(rVar)) return false;
        this.#rVars.delete(rVar);
        rVar.remHandler("remove", rVar._onRemove);
        delete rVar._onRemove;
        if (this.hasEOptionSection("r"))
            this.getEOptionSection("r").removeChild(rVar.elem);
        this.post("change", null);
        return rVar;
    }

    get viewMode() { return this.#viewMode; }
    set viewMode(v) {
        v = String(v);
        if (this.viewMode == v) return;
        if (!["right", "left", "section", "all"].includes(v)) return;
        this.#viewMode = v;
        this.post("change", null);
    }
    get viewParams() { return this.#viewParams; }
    set viewParams(v) {
        v = util.ensure(v, "obj");
        for (let k in v) this.#viewParams[k] = v[k];
        this.post("change", null);
    }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.isOptionsClosed) return null;
        let r;
        r = this.eOptions.getBoundingClientRect();
        if (pos.x < r.left || pos.x > r.right) return null;
        if (pos.y < r.top || pos.y > r.bottom) return null;
        if (data instanceof Panel.BrowserTab) data = this.hasPage() ? this.page.lookup(data.path) : null;
        for (let i = 0; i < this.eOptionSections.length; i++) {
            let id = this.eOptionSections[i];
            let elem = this.getEOptionSection(id);
            r = elem.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            let idfs = {
                _: side => {
                    if (!(data instanceof NTSource.Topic)) return null;
                    return {
                        r: r,
                        submit: () => {
                            const colors = "rybgpocm";
                            const addVar = name => {
                                let taken = new Array(colors.length).fill(false);
                                [...this.lVars, ...this.rVars].forEach(v => {
                                    colors.split("").forEach((c, i) => {
                                        if (v.color == "--c"+c) taken[i] = true;
                                    });
                                });
                                let nextColor = null;
                                taken.forEach((v, i) => {
                                    if (v) return;
                                    if (nextColor != null) return;
                                    nextColor = colors[i];
                                });
                                if (nextColor == null) nextColor = colors[(this.lVars.length+this.rVars.length)%colors.length];
                                let has = false;
                                this[side+"Vars"].forEach(v => (v.name == name) ? (has = true) : null);
                                if (has) return;
                                this["add"+side.toUpperCase()+"Var"](new Panel.GraphTab.Variable(name, "--c"+nextColor));
                            };
                            if (data.isArray)
                                for (let i = 0; i < data.value.length; i++)
                                    addVar(data.path+"/"+i);
                            else addVar(data.path);
                        },
                    };
                },
                l: () => idfs._("l"),
                r: () => idfs._("r"),
            };
            if (elem.id in idfs) {
                let data = idfs[elem.id]();
                if (util.is(data, "obj")) return data;
            }
        }
        return null;
    }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                lVars: this.lVars,
                rVars: this.rVars,
                viewMode: this.viewMode,
                viewParams: this.viewParams,
                isOpen: this.isOptionsOpen,
            }],
        };
    }
};
Panel.GraphTab.Variable = class PanelGraphTabVariable extends core.Target {
    #name;
    #color;

    #elem;
    #eDisplay;
    #eShowBox;
    #eShow;
    #eShowDisplay;
    #eDisplayName;
    #eRemoveBtn;
    #eContent;
    #eColorPicker;
    #eColorPickerColors;

    constructor(...a) {
        super();

        this.#name = null;
        this.#color = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eShowBox = document.createElement("label");
        this.eDisplay.appendChild(this.eShowBox);
        this.eShowBox.classList.add("checkbox");
        this.eShowBox.innerHTML = "<input type='checkbox'><span><ion-icon name='eye'></ion-icon></span>";
        this.#eShow = this.eShowBox.children[0];
        this.#eShowDisplay = this.eShowBox.children[1];
        this.#eDisplayName = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayName);
        this.#eRemoveBtn = document.createElement("button");
        this.eDisplay.appendChild(this.eRemoveBtn);
        this.eRemoveBtn.classList.add("icon");
        this.eRemoveBtn.innerHTML = "<ion-icon name='trash'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eColorPicker = document.createElement("div");
        this.eContent.appendChild(this.eColorPicker);
        this.eColorPicker.classList.add("colorpicker");
        this.#eColorPickerColors = [];
        [
            { _: "cr", h: "cr5", d: "cr3" },
            { _: "co", h: "co5", d: "co3" },
            { _: "cy", h: "cy5", d: "cy3" },
            { _: "cg", h: "cg5", d: "cg3" },
            { _: "cc", h: "cc5", d: "cc3" },
            { _: "cb", h: "cb5", d: "cb3" },
            { _: "cp", h: "cp5", d: "cp3" },
            { _: "cm", h: "cm5", d: "cm3" },
        ].forEach(colors => {
            let btn = document.createElement("button");
            this.eColorPicker.appendChild(btn);
            this.#eColorPickerColors.push(btn);
            btn.color = "--"+colors._;
            btn.style.setProperty("--bg", "var(--"+colors._+")");
            btn.style.setProperty("--bgh", "var(--"+colors.h+")");
            btn.style.setProperty("--bgd", "var(--"+colors.d+")");
            btn.addEventListener("click", e => {
                this.color = btn.color;
            });
        });

        this.eShowBox.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.eShow.addEventListener("change", e => {
            this.post("change", null);
        });
        this.eRemoveBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove", null);
        });
        this.eDisplay.addEventListener("click", e => {
            this.isOpen = !this.isOpen;
        });

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.GraphTab.Variable) a = [a.name, a.color, a.isShown];
            else if (util.is(a, "arr")) {
                a = new Panel.GraphTab.Variable(...a);
                a = [a.name, a.color, a.isShown];
            }
            else if (util.is(a, "obj")) a = [a.name, a.color, a.isShown];
            else a = [null, null, true];
        }
        if (a.length == 2) a = [...a, true];

        [this.name, this.color, this.isShown] = a;
    }

    get name() { return this.#name; }
    set name(v) {
        this.#name = (v == null) ? null : String(v);
        this.eDisplayName.textContent = this.hasName() ? this.name : "?";
        this.post("change", null);
    }
    hasName() { return this.name != null; }
    get color() { return this.#color; }
    set color(v) {
        this.#color = (v == null) ? null : String(v);
        let color = this.hasColor() ? this.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(this.color) : this.color : "#fff";
        this.eShowDisplay.style.setProperty("--bgc", color);
        this.eShowDisplay.style.setProperty("--bgch", color);
        this.eDisplayName.style.color = color;
        this.eColorPickerColors.forEach(btn => {
            if (btn.color == this.color) btn.classList.add("this");
            else btn.classList.remove("this");
        });
        this.post("change", null);
    }
    hasColor() { return this.color != null; }

    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eShowBox() { return this.#eShowBox; }
    get eShow() { return this.#eShow; }
    get eShowDisplay() { return this.#eShowDisplay; }
    get eDisplayName() { return this.#eDisplayName; }
    get eRemoveBtn() { return this.#eRemoveBtn; }
    get eContent() { return this.#eContent; }
    get eColorPicker() { return this.#eColorPicker; }
    get eColorPickerColors() { return [...this.#eColorPickerColors]; }

    get isShown() { return this.eShow.checked; }
    set isShown(v) {
        this.eShow.checked = v;
        this.post("change", null);
    }
    get isHidden() { return !this.isShown; }
    set isHidden(v) { this.isShown = !v; }
    show() { return this.isShown = true; }
    hide() { return this.isHidden = true; }

    get isOpen() { return this.elem.classList.contains("open"); }
    set isOpen(v) {
        v = !!v;
        if (this.open == v) return;
        if (v) this.elem.classList.add("open");
        else this.elem.classList.remove("open");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                name: this.name,
                color: this.color,
                isShown: this.isShown,
            }],
        };
    }
};
Panel.OdometryTab = class PanelOdometryTab extends Panel.ToolCanvasTab {
    #poses;

    constructor(tail="") {
        super("Odometry"+tail, "locate", "var(--cy)");

        this.elem.classList.add("odometry");

        this.#poses = new Set();

        ["p", "f", "o"].forEach(id => {
            const elem = document.createElement("div");
            elem.id = id;
            this.addEOptionSection(elem);
            elem.classList.add("section");
            elem.innerHTML = "<div class='header'>"+{ p: "Poses", f: "Field", o: "Options" }[id]+"</div>";
            let idfs = {
                p: () => {
                    elem.classList.add("list");
                    this.addHandler("update", data => {
                        if (this.poses.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    });
                },
                f: () => elem.classList.add("field"),
                o: () => elem.classList.add("options"),
            };
            if (id in idfs) idfs[id]();
        });
    }

    get poses() { return [...this.#poses]; }
    set poses(v) {
        v = util.ensure(v, "arr");
        this.clearPoses();
        v.forEach(v => this.addPose(v));
    }
    clearPoses() {
        let poses = this.poses;
        poses.forEach(pose => this.remPose(pose));
        return poses;
    }
    hasPose(pose) {
        if (!(pose instanceof this.constructor.Pose)) return false;
        return this.#poses.has(pose);
    }
    addPose(pose) {
        if (!(pose instanceof this.constructor.Pose)) return false;
        if (this.hasPose(pose)) return false;
        this.#poses.add(pose);
        pose._onRemove = () => this.remPose(pose);
        pose._onChange = () => this.post("change", null);
        pose.addHandler("remove", pose._onRemove);
        pose.addHandler("change", pose._onChange);
        if (this.hasEOptionSection("p"))
            this.getEOptionSection("p").appendChild(pose.elem);
        this.post("change", null);
        return pose;
    }
    remPose(pose) {
        if (!(pose instanceof this.constructor.Pose)) return false;
        if (!this.hasPose(pose)) return false;
        this.#poses.delete(pose);
        pose.remHandler("remove", pose._onRemove);
        pose.remHandler("change", pose._onChange);
        delete pose._onRemove;
        delete pose._onChange;
        if (this.hasEOptionSection("p"))
            this.getEOptionSection("p").removeChild(pose.elem);
        this.post("change", null);
        return pose;
    }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.isOptionsClosed) return null;
        let r;
        r = this.eOptions.getBoundingClientRect();
        if (pos.x < r.left || pos.x > r.right) return null;
        if (pos.y < r.top || pos.y > r.bottom) return null;
        if (data instanceof Panel.BrowserTab) data = this.hasPage() ? this.page.lookup(data.path) : null;
        for (let i = 0; i < this.eOptionSections.length; i++) {
            let id = this.eOptionSections[i];
            let elem = this.getEOptionSection(id);
            r = elem.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            const numbers = ["double", "float", "int"];
            let idfs = {
                p: () => {
                    if (!(data instanceof NTSource.Topic)) return null;
                    if (!data.isArray || !numbers.includes(data.arraylessType)) return null;
                    if (!this.isValidPose(data)) return null;
                    return {
                        r: r,
                        submit: () => {
                            const colors = "rybgpocm";
                            const addPose = name => {
                                let taken = new Array(colors.length).fill(false);
                                this.poses.forEach(pose => {
                                    colors.split("").forEach((c, i) => {
                                        if (pose.color == "--c"+c) taken[i] = true;
                                    });
                                });
                                let nextColor = null;
                                taken.forEach((v, i) => {
                                    if (v) return;
                                    if (nextColor != null) return;
                                    nextColor = colors[i];
                                });
                                if (nextColor == null) nextColor = colors[this.poses.length%colors.length];
                                let has = false;
                                this.poses.forEach(v => (v.name == name) ? (has = true) : null);
                                if (has) return;
                                this.addPose(new this.constructor.Pose(name, "--c"+nextColor));
                            };
                            addPose(data.path);
                        },
                    };
                },
            };
            if (elem.id in idfs) {
                let data = idfs[elem.id]();
                if (util.is(data, "obj")) return data;
            }
        }
        return null;
    }
    isValidPose(topic) { return true; }
};
Panel.OdometryTab.Pose = class PanelOdometryTabPose extends core.Target {
    #name;
    #color;
    #ghost;

    #elem;
    #eDisplay;
    #eShowBox;
    #eShow;
    #eShowDisplay;
    #eDisplayName;
    #eRemoveBtn;
    #eContent;
    #eColorPicker;
    #eColorPickerColors;
    #eGhostBtn;

    constructor(...a) {
        super();

        this.#name = null;
        this.#color = null;
        this.#ghost = false;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eShowBox = document.createElement("label");
        this.eDisplay.appendChild(this.eShowBox);
        this.eShowBox.classList.add("checkbox");
        this.eShowBox.innerHTML = "<input type='checkbox'><span><ion-icon name='eye'></ion-icon></span>";
        this.#eShow = this.eShowBox.children[0];
        this.#eShowDisplay = this.eShowBox.children[1];
        this.#eDisplayName = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayName);
        this.#eRemoveBtn = document.createElement("button");
        this.eDisplay.appendChild(this.eRemoveBtn);
        this.eRemoveBtn.classList.add("icon");
        this.eRemoveBtn.innerHTML = "<ion-icon name='trash'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eColorPicker = document.createElement("div");
        this.eContent.appendChild(this.eColorPicker);
        this.eColorPicker.classList.add("colorpicker");
        this.#eColorPickerColors = [];
        [
            { _: "cr", h: "cr5", d: "cr3" },
            { _: "co", h: "co5", d: "co3" },
            { _: "cy", h: "cy5", d: "cy3" },
            { _: "cg", h: "cg5", d: "cg3" },
            { _: "cc", h: "cc5", d: "cc3" },
            { _: "cb", h: "cb5", d: "cb3" },
            { _: "cp", h: "cp5", d: "cp3" },
            { _: "cm", h: "cm5", d: "cm3" },
        ].forEach(colors => {
            let btn = document.createElement("button");
            this.eColorPicker.appendChild(btn);
            this.#eColorPickerColors.push(btn);
            btn.color = "--"+colors._;
            btn.style.setProperty("--bg", "var(--"+colors._+")");
            btn.style.setProperty("--bgh", "var(--"+colors.h+")");
            btn.style.setProperty("--bgd", "var(--"+colors.d+")");
            btn.addEventListener("click", e => {
                this.color = btn.color;
            });
        });
        this.#eGhostBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eGhostBtn);
        this.eGhostBtn.classList.add("ghost");
        this.eGhostBtn.textContent = "Ghost";
        this.eGhostBtn.addEventListener("click", e => (this.ghost = !this.ghost));

        this.eShowBox.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.eShow.addEventListener("change", e => {
            this.post("change", null);
        });
        this.eRemoveBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove", null);
        });
        this.eDisplay.addEventListener("click", e => {
            this.isOpen = !this.isOpen;
        });

        if (a.length <= 0 || a.length > 4) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof this.constructor) a = [a.name, a.color, a.isShown, a.ghost];
            else if (util.is(a, "arr")) {
                a = new this.constructor(...a);
                a = [a.name, a.color, a.isShown, a.ghost];
            }
            else if (util.is(a, "obj")) a = [a.name, a.color, a.isShown, a.ghost];
            else a = [null, null];
        }
        if (a.length == 2) a = [...a, true];
        if (a.length == 3) a = [...a, false];

        [this.name, this.color, this.isShown, this.ghost] = a;
    }

    get name() { return this.#name; }
    set name(v) {
        this.#name = (v == null) ? null : String(v);
        this.eDisplayName.textContent = this.hasName() ? this.name : "?";
        this.post("change", null);
    }
    hasName() { return this.name != null; }
    get color() { return this.#color; }
    set color(v) {
        this.#color = (v == null) ? null : String(v);
        let color = this.hasColor() ? this.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(this.color) : this.color : "#fff";
        this.eShowDisplay.style.setProperty("--bgc", color);
        this.eShowDisplay.style.setProperty("--bgch", color);
        this.eDisplayName.style.color = color;
        this.eColorPickerColors.forEach(btn => {
            if (btn.color == this.color) btn.classList.add("this");
            else btn.classList.remove("this");
        });
        this.post("change", null);
    }
    hasColor() { return this.color != null; }
    get ghost() { return this.#ghost; }
    set ghost(v) {
        this.#ghost = !!v;
        if (this.ghost) this.eGhostBtn.classList.add("this");
        else this.eGhostBtn.classList.remove("this");
        this.post("change", null);
    }

    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eShowBox() { return this.#eShowBox; }
    get eShow() { return this.#eShow; }
    get eShowDisplay() { return this.#eShowDisplay; }
    get eDisplayName() { return this.#eDisplayName; }
    get eRemoveBtn() { return this.#eRemoveBtn; }
    get eContent() { return this.#eContent; }
    get eColorPicker() { return this.#eColorPicker; }
    get eColorPickerColors() { return [...this.#eColorPickerColors]; }
    get eGhostBtn() { return this.#eGhostBtn; }

    get isShown() { return this.eShow.checked; }
    set isShown(v) {
        this.eShow.checked = v;
        this.post("change", null);
    }
    get isHidden() { return !this.isShown; }
    set isHidden(v) { this.isShown = !v; }
    show() { return this.isShown = true; }
    hide() { return this.isHidden = true; }

    get isOpen() { return this.elem.classList.contains("open"); }
    set isOpen(v) {
        v = !!v;
        if (this.open == v) return;
        if (v) this.elem.classList.add("open");
        else this.elem.classList.remove("open");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                name: this.name,
                color: this.color,
                isShown: this.isShown,
                ghost: this.ghost,
            }],
        };
    }
};
Panel.Odometry2dTab = class PanelOdometry2dTab extends Panel.OdometryTab {
    #odometry;

    #template;

    #size;
    #robotSize;

    #isMeters;
    #isDegrees;

    #eTemplateSelect;
    #eSizeWInput;
    #eSizeHInput;
    #eRobotSizeWInput;
    #eRobotSizeHInput;
    #eUnitsMeters;
    #eUnitsCentimeters;
    #eUnitsDegrees;
    #eUnitsRadians;

    constructor(...a) {
        super("2d");

        this.#odometry = new core.Odometry2d(this.canvas);

        this.#template = null;

        this.#size = new V(1000);
        this.#robotSize = new V(100);

        this.#isMeters = true;
        this.#isDegrees = true;

        let info;
        const eField = this.getEOptionSection("f");
        info = document.createElement("div");
        eField.appendChild(info);
        info.classList.add("info");
        info.innerHTML = "<span>Template</span>";
        this.#eTemplateSelect = document.createElement("button");
        eField.appendChild(this.eTemplateSelect);
        this.eTemplateSelect.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eTemplateSelect.addEventListener("click", e => {
            if (!this.hasApp()) return;
            e.stopPropagation();
            let itm;
            let menu = new core.App.ContextMenu();
            itm = menu.addItem(new core.App.ContextMenu.Item("No Template", (this.template == null) ? "checkmark" : ""));
            itm.addHandler("trigger", data => {
                this.template = null;
            });
            menu.addItem(new core.App.ContextMenu.Divider());
            for (let name in templates) {
                itm = menu.addItem(new core.App.ContextMenu.Item(name, (this.template == name) ? "checkmark" : ""));
                itm.addHandler("trigger", data => {
                    this.template = name;
                });
            }
            this.app.contextMenu = menu;
            let r = this.eTemplateSelect.getBoundingClientRect();
            this.app.placeContextMenu(r.left, r.bottom);
        });
        let infoUnits = [];
        info = document.createElement("div");
        eField.appendChild(info);
        info.classList.add("info");
        info.classList.add("nothas");
        info.innerHTML = "<span>Map Size</span><span class='units'>m</span>";
        infoUnits.push(info.children[1]);
        let eSize = document.createElement("div");
        eField.appendChild(eSize);
        eSize.classList.add("v");
        eSize.classList.add("nothas");
        this.#eSizeWInput = document.createElement("input");
        eSize.appendChild(this.eSizeWInput);
        this.eSizeWInput.type = "number";
        this.eSizeWInput.placeholder = "Width";
        this.eSizeWInput.min = 0;
        this.eSizeWInput.step = 0.1;
        this.eSizeWInput.addEventListener("change", e => {
            let v = this.eSizeWInput.value;
            if (v.length > 0) {
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                this.w = v*(this.isMeters ? 100 : 1);
                this.post("change", null);
            }
        });
        this.#eSizeHInput = document.createElement("input");
        eSize.appendChild(this.eSizeHInput);
        this.eSizeHInput.type = "number";
        this.eSizeHInput.placeholder = "Height";
        this.eSizeHInput.min = 0;
        this.eSizeHInput.step = 0.1;
        this.eSizeHInput.addEventListener("change", e => {
            let v = this.eSizeHInput.value;
            if (v.length > 0) {
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                this.h = v*(this.isMeters ? 100 : 1);
                this.post("change", null);
            }
        });
        info = document.createElement("div");
        eField.appendChild(info);
        info.classList.add("info");
        info.classList.add("nothas");
        info.innerHTML = "<span>Robot Size</span><span class='units'>m</span>";
        infoUnits.push(info.children[1]);
        let eRobotSize = document.createElement("div");
        eField.appendChild(eRobotSize);
        eRobotSize.classList.add("v");
        eRobotSize.classList.add("nothas");
        this.#eRobotSizeWInput = document.createElement("input");
        eRobotSize.appendChild(this.eRobotSizeWInput);
        this.eRobotSizeWInput.type = "number";
        this.eRobotSizeWInput.placeholder = "Width";
        this.eRobotSizeWInput.min = 0;
        this.eRobotSizeWInput.step = 0.1;
        this.eRobotSizeWInput.addEventListener("change", e => {
            let v = this.eRobotSizeWInput.value;
            if (v.length > 0) {
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                this.robotW = v*(this.isMeters ? 100 : 1);
                this.post("change", null);
            }
        });
        this.#eRobotSizeHInput = document.createElement("input");
        eRobotSize.appendChild(this.eRobotSizeHInput);
        this.eRobotSizeHInput.type = "number";
        this.eRobotSizeHInput.placeholder = "Height";
        this.eRobotSizeHInput.min = 0;
        this.eRobotSizeHInput.step = 0.1;
        this.eRobotSizeHInput.addEventListener("change", e => {
            let v = this.eRobotSizeHInput.value;
            if (v.length > 0) {
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                this.robotH = v*(this.isMeters ? 100 : 1);
                this.post("change", null);
            }
        });
        let eNav;
        const eOptions = this.getEOptionSection("o");
        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eUnitsMeters = document.createElement("button");
        eNav.appendChild(this.eUnitsMeters);
        this.eUnitsMeters.textContent = "Meters";
        this.eUnitsMeters.addEventListener("click", e => { this.isMeters = true; });
        this.#eUnitsCentimeters = document.createElement("button");
        eNav.appendChild(this.eUnitsCentimeters);
        this.eUnitsCentimeters.textContent = "Centimeters";
        this.eUnitsCentimeters.addEventListener("click", e => { this.isCentimeters = true; });
        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eUnitsDegrees = document.createElement("button");
        eNav.appendChild(this.eUnitsDegrees);
        this.eUnitsDegrees.textContent = "Degrees";
        this.eUnitsDegrees.addEventListener("click", e => { this.isDegrees = true; });
        this.#eUnitsRadians = document.createElement("button");
        eNav.appendChild(this.eUnitsRadians);
        this.eUnitsRadians.textContent = "Radians";
        this.eUnitsRadians.addEventListener("click", e => { this.isRadians = true; });

        this.quality = this.odometry.quality;

        if (a.length <= 0 || [6].includes(a.length) || a.length > 7) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.Odometry2dTab) a = [a.poses, a.template, a.size, a.robotSize, a.isMeters, a.isDegrees, a.isOptionsOpen];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof this.constructor.Pose) a = [a, null];
                else {
                    a = new Panel.Odometry2dTab(...a);
                    a = [a.poses, a.template, a.size, a.robotSize, a.isMeters, a.isDegrees, a.isOptionsClosed];
                }
            }
            else if (util.is(a, "obj")) a = [a.poses, a.template, a.size, a.robotSize, a.isMeters, a.isDegrees, a.isOpen];
            else a = [[], null];
        }
        if (a.length == 2) a = [...a, 1000];
        if (a.length == 3) a = [...a, 100];
        if (a.length == 4) a = [...a, true];
        if (a.length == 5) a = [...a.slice(0, 4), true, true, a[4]];

        [this.poses, this.template, this.size, this.robotSize, this.isMeters, this.isDegrees, this.isOptionsOpen] = a;

        let templates = {};
        let templateImages = {};
        let finished = false;
        (async () => {
            templates = await window.api.get("templates");
            templateImages = await window.api.get("template-images");
            this.template = await window.api.get("active-template");
            finished = true;
        })();

        let poses = {};

        window.hottest2d = () => {
            const page = app.getPage("PROJECT");
            page.rootSource.announceTopic("k", "double[]");
            page.rootSource.updateTopic("k", [2, 2, 0]);
        };

        this.addHandler("update", () => {
            if (this.isClosed) return;

            if (this.template in templates) eField.classList.add("has");
            else eField.classList.remove("has");
            if (document.activeElement != this.eSizeWInput) this.eSizeWInput.value = this.w/(this.isMeters ? 100 : 1);
            if (document.activeElement != this.eSizeHInput) this.eSizeHInput.value = this.h/(this.isMeters ? 100 : 1);
            if (document.activeElement != this.eRobotSizeWInput) this.eRobotSizeWInput.value = this.robotW/(this.isMeters ? 100 : 1);
            if (document.activeElement != this.eRobotSizeHInput) this.eRobotSizeHInput.value = this.robotH/(this.isMeters ? 100 : 1);
            if (this.isMeters) this.eUnitsMeters.classList.add("this");
            else this.eUnitsMeters.classList.remove("this");
            if (this.isCentimeters) this.eUnitsCentimeters.classList.add("this");
            else this.eUnitsCentimeters.classList.remove("this");
            if (this.isDegrees) this.eUnitsDegrees.classList.add("this");
            else this.eUnitsDegrees.classList.remove("this");
            if (this.isRadians) this.eUnitsRadians.classList.add("this");
            else this.eUnitsRadians.classList.remove("this");
            infoUnits.forEach(elem => (elem.textContent = (this.isMeters ? "m" : "cm")));

            if (!finished) return;

            this.odometry.size = (this.template in templates) ? templates[this.template].size : this.size;
            this.odometry.imageSrc = (this.template in templateImages) ? templateImages[this.template] : null;
            this.odometry.imageScale = (this.template in templates) ? templates[this.template].imageScale : 0;
            if (this.isClosed) return;
            let source = (this.hasPage() && this.page.hasRootSource() && this.page.rootSource.hasRoot()) ? this.page.rootSource : null;
            let newPoses = {};
            if (this.hasPage() && this.page.hasRootSource() && this.page.rootSource.hasRoot()) {
                this.poses.forEach(pose => pose.isShown ? (newPoses[pose.name] = pose) : null);
            }
            let needAdd = {}, needRem = {};
            for (let name in newPoses)
                if (!(name in poses))
                    needAdd[name] = newPoses[name];
            for (let name in poses)
                if (!(name in newPoses))
                    needRem[name] = poses[name];
            Object.keys(needAdd).forEach(name => {
                let topic = source.root.lookup(name);
                if (!(topic instanceof NTSource.Topic)) return;
                if (!topic.isArray) return;
                if (topic.value.length % 2 == 0) {
                    poses[name] = [];
                } else if (topic.value.length == 3) {
                    let renders = poses[name] = [this.odometry.addRender(new core.Odometry2d.Robot())];
                    renders[0].showVelocity = false;
                }
            });
            Object.keys(needRem).forEach(name => {
                poses[name].forEach(render => this.odometry.remRender(render));
                delete poses[name];
            });
            for (let name in poses) {
                let renders = poses[name];
                let pose = newPoses[name];
                let topic = source.root.lookup(name);
                if (!(topic instanceof NTSource.Topic)) continue;
                if (!topic.isArray) continue;
                if (topic.value.length % 2 == 0) {
                    let l = Math.max(0, (topic.value.length / 2) - 1);
                    while (renders.length < l) renders.push(this.odometry.addRender(new RLine()));
                    while (renders.length > l) this.odometry.remRender(renders.pop());
                    renders.forEach((render, i) => {
                        render.a = [topic.value[i*2 + 0], topic.value[i*2 + 1]];
                        render.a.imul(this.isMeters ? 100 : 1);
                        render.b = [topic.value[i*2 + 2], topic.value[i*2 + 3]];
                        render.b.imul(this.isMeters ? 100 : 1);
                        render.color = pose.color;
                        render.alpha = pose.ghost ? 0.5 : 1;
                    });
                    pose.eDisplayType.style.display = "none";
                } else if (topic.value.length == 3) {
                    let render = renders[0];
                    render.color = pose.color.substring(2);
                    render.colorH = pose.color.substring(2)+5;
                    render.alpha = pose.ghost ? 0.5 : 1;
                    render.size = (this.template in templates) ? templates[this.template].robotSize : this.robotSize;
                    render.pos = new V(topic.value[0], topic.value[1]).mul(this.isMeters ? 100 : 1);
                    render.heading = topic.value[2] * (this.isDegrees ? 1 : (180/Math.PI));
                    render.type = pose.type;
                    pose.eDisplayType.style.display = "";
                }
            }
            this.odometry.update();
        });
    }

    addPose(pose) {
        let r = super.addPose(pose);
        if (r instanceof this.constructor.Pose) {
            r._onType = () => {
                let current = core.Odometry2d.Robot.lookupTypeName(r.type);
                if (!this.hasApp()) return;
                let itm;
                let menu = new core.App.ContextMenu();
                Object.keys(core.Odometry2d.Robot.Types).forEach(k => {
                    let name = String(k).split(" ").map(v => util.capitalize(v)).join(" ");
                    itm = menu.addItem(new core.App.ContextMenu.Item(name, (current == k) ? "checkmark" : ""));
                    itm.addHandler("trigger", data => {
                        r.type = k;
                    });
                });
                this.app.contextMenu = menu;
                let rect = r.eDisplayType.getBoundingClientRect();
                this.app.placeContextMenu(rect.left, rect.bottom);
            };
            r.addHandler("type", r._onType);
        }
        return r;
    }
    remPose(pose) {
        let r = super.remPose(pose);
        if (r instanceof this.constructor.Pose) {
            r.remHandler("type", r._onType);
            delete r._onType;
        }
        return r;
    }

    get odometry() { return this.#odometry; }

    get template() { return this.#template; }
    set template(v) {
        this.#template = (v == null) ? null : String(v);
        if (this.eTemplateSelect.children[0] instanceof HTMLDivElement)
            this.eTemplateSelect.children[0].textContent = (this.template == null) ? "No Template" : this.template;
        this.post("change", null);
    }

    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }
    get robotSize() { return this.#robotSize; }
    set robotSize(v) { this.#robotSize.set(v); }
    get robotW() { return this.robotSize.x; }
    set robotW(v) { this.robotSize.x = v; }
    get robotH() { return this.robotSize.y; }
    set robotH(v) { this.robotSize.y = v; }

    get isMeters() { return this.#isMeters; }
    set isMeters(v) {
        v = !!v;
        if (this.isMeters == v) return;
        this.#isMeters = v;
        this.post("change", null);
    }
    get isCentimeters() { return !this.isMeters; }
    set isCentimeters(v) { this.isMeters = !v; }
    get isDegrees() { return this.#isDegrees; }
    set isDegrees(v) {
        v = !!v;
        if (this.isDegrees == v) return;
        this.#isDegrees = v;
        this.post("change", null);
    }
    get isRadians() { return !this.isDegrees; }
    set isRadians(v) { this.isDegrees = !v; }

    get eTemplateSelect() { return this.#eTemplateSelect; }
    get eSizeWInput() { return this.#eSizeWInput; }
    get eSizeHInput() { return this.#eSizeHInput; }
    get eRobotSizeWInput() { return this.#eRobotSizeWInput; }
    get eRobotSizeHInput() { return this.#eRobotSizeHInput; }
    get eUnitsMeters() { return this.#eUnitsMeters; }
    get eUnitsCentimeters() { return this.#eUnitsCentimeters; }
    get eUnitsDegrees() { return this.#eUnitsDegrees; }
    get eUnitsRadians() { return this.#eUnitsRadians; }

    isValidPose(topic) { return (topic.value.length % 2 == 0) || (topic.value.length == 3); }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                poses: this.poses,
                template: this.template,
                size: this.size,
                robotSize: this.robotSize,
                isMeters: this.isMeters,
                isDegrees: this.isDegrees,
                isOpen: this.isOptionsOpen,
            }],
        };
    }
};
Panel.Odometry2dTab.Pose = class PanelOdometry2dTabPose extends Panel.OdometryTab.Pose {
    #type;

    #eDisplayType;

    constructor(...a) {
        super();

        this.#type = null;

        this.#eDisplayType = document.createElement("button");
        this.eContent.appendChild(this.eDisplayType);
        this.eDisplayType.classList.add("display");
        this.eDisplayType.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eDisplayType.addEventListener("click", e => this.post("type", null));

        if (a.length <= 0 || a.length > 5) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof this.constructor) a = [a.name, a.color, a.isShown, a.ghost, a.type];
            else if (util.is(a, "arr")) {
                a = new this.constructor(...a);
                a = [a.name, a.color, a.isShown, a.ghost, a.type];
            }
            else if (util.is(a, "obj")) a = [a.name, a.color, a.isShown, a.ghost, a.type];
            else a = [null, null];
        }
        if (a.length == 2) a = [...a, true];
        if (a.length == 3) a = [...a, false];
        if (a.length == 4) a = [...a, core.Odometry2d.Robot.Types.DEFAULT];

        [this.name, this.color, this.isShown, this.ghost, this.type] = a;
    }

    get type() { return this.#type; }
    set type(v) {
        if (!Object.values(core.Odometry2d.Robot.Types)) return;
        if (Object.keys(core.Odometry2d.Robot.Types).includes(v)) v = core.Odometry2d.Robot.Types[v];
        this.#type = v;
        if (this.eDisplayType.children[0] instanceof HTMLDivElement)
            this.eDisplayType.children[0].textContent = String(core.Odometry2d.Robot.lookupTypeName(this.type)).split(" ").map(v => util.capitalize(v)).join(" ");
    }

    get eDisplayType() { return this.#eDisplayType; }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                name: this.name,
                color: this.color,
                isShown: this.isShown,
                ghost: this.ghost,
                type: this.type,
            }],
        };
    }
};
Panel.Odometry3dTab = class PanelOdometry3dTab extends Panel.OdometryTab {
    #scene;
    #camera;
    #renderer;
    #controls;
    #composer;

    #axisScene;

    #field;

    #template;

    #isProjection;
    #isMeters;
    #isDegrees;

    #eTemplateSelect;
    #eViewProjection;
    #eViewIsometric;
    #eUnitsMeters;
    #eUnitsCentimeters;

    static DO = false;

    constructor(...a) {
        super("3d");

        this.quality = 3;

        this.#scene = new THREE.Scene();
        this.#camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

        this.#renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true });
        
        this.#controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.#composer = new EffectComposer(this.renderer);

        const radius = 0.05;
        const length = 5;
        this.#axisScene = new THREE.Object3D();
        const xAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        this.axisScene.add(xAxis);
        this.axisScene.xAxis = xAxis;
        const yAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        yAxis.position.set(0, length/2, 0);
        this.axisScene.add(yAxis);
        this.axisScene.yAxis = yAxis;
        const zAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        this.axisScene.add(zAxis);
        this.axisScene.zAxis = zAxis;

        this.#field = null;

        const hemLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
        this.scene.add(hemLight);

        const light = new THREE.PointLight(0xffffff, 0.5);
        light.position.set(0, 0, 10);
        this.scene.add(light);

        this.controls.target.set(0, 0, 0);
        this.controls.update();

        const loader = new GLTFLoader();

        this.#template = null;

        this.#isMeters = true;
        this.#isProjection = false;

        let info;
        const eField = this.getEOptionSection("f");
        info = document.createElement("div");
        eField.appendChild(info);
        info.classList.add("info");
        info.innerHTML = "<span>Template</span>";
        this.#eTemplateSelect = document.createElement("button");
        eField.appendChild(this.eTemplateSelect);
        this.eTemplateSelect.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eTemplateSelect.addEventListener("click", e => {
            if (!this.hasApp()) return;
            e.stopPropagation();
            let itm;
            let menu = new core.App.ContextMenu();
            itm = menu.addItem(new core.App.ContextMenu.Item("No Template", (this.template == null) ? "checkmark" : ""));
            itm.addHandler("trigger", data => {
                this.template = null;
            });
            menu.addItem(new core.App.ContextMenu.Divider());
            for (let name in templates) {
                itm = menu.addItem(new core.App.ContextMenu.Item(name, (this.template == name) ? "checkmark" : ""));
                itm.addHandler("trigger", data => {
                    this.template = name;
                });
            }
            this.app.contextMenu = menu;
            let r = this.eTemplateSelect.getBoundingClientRect();
            this.app.placeContextMenu(r.left, r.bottom);
        });
        let eNav;
        const eOptions = this.getEOptionSection("o");
        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eViewProjection = document.createElement("button");
        eNav.appendChild(this.eViewProjection);
        this.eViewProjection.textContent = "Projection";
        this.eViewProjection.addEventListener("click", e => { this.isProjection = true; });
        this.#eViewIsometric = document.createElement("button");
        eNav.appendChild(this.eViewIsometric);
        this.eViewIsometric.textContent = "Isometric";
        this.eViewIsometric.addEventListener("click", e => { this.isIsometric = true; });
        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eUnitsMeters = document.createElement("button");
        eNav.appendChild(this.eUnitsMeters);
        this.eUnitsMeters.textContent = "Meters";
        this.eUnitsMeters.addEventListener("click", e => { this.isMeters = true; });
        this.#eUnitsCentimeters = document.createElement("button");
        eNav.appendChild(this.eUnitsCentimeters);
        this.eUnitsCentimeters.textContent = "Centimeters";
        this.eUnitsCentimeters.addEventListener("click", e => { this.isCentimeters = true; });

        if (a.length <= 0 || [4].includes(a.length) || a.length > 5) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.Odometry2dTab) a = [a.poses, a.template, a.isProjection, a.isMeters, a.isOptionsOpen];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof this.constructor.Pose) a = [a, null];
                else {
                    a = new Panel.Odometry2dTab(...a);
                    a = [a.poses, a.template, a.isProjection, a.isMeters, a.isOptionsClosed];
                }
            }
            else if (util.is(a, "obj")) a = [a.poses, a.template, a.isProjection, a.isMeters, a.isOpen];
            else a = [[], null];
        }
        if (a.length == 2) a = [...a, true];
        if (a.length == 3) a = [...a.slice(0, 2), true, true, a[2]];

        [this.poses, this.template, this.isProjection, this.isMeters, this.isOptionsOpen] = a;

        let templates = {};
        let templateModels = {};
        let finished = false;
        (async () => {
            templates = await window.api.get("templates");
            templateModels = await window.api.get("template-models");
            this.template = await window.api.get("active-template");
            finished = true;
        })();

        let preloadedFields = {};

        let poses = {};

        window.hottest3d = () => {
            const page = app.getPage("PROJECT");
            page.rootSource.announceTopic("k", "double[]");
            page.rootSource.updateTopic("k", [0, 0, 0, 0, 0, 0, 0]);
        };

        class Pass extends core.Target {
            #composer;
            #scene;
            #camera;

            #createPass;

            #pass;

            constructor(createPass) {
                super();

                this.#composer = null;
                this.#scene = null;
                this.#camera = null;

                this.#createPass = null;

                this.#pass = null;
                
                this.createPass = createPass;
            }

            get composer() { return this.#composer; }
            set composer(v) {
                v = (v instanceof EffectComposer) ? v : null;
                if (this.composer == v) return;
                this.#composer = v;
                this.recreate();
            }
            hasComposer() { return this.composer instanceof EffectComposer; }
            get scene() { return this.#scene; }
            set scene(v) {
                v = (v instanceof THREE.Scene) ? v : null;
                if (this.scene == v) return;
                this.#scene = v;
                this.recreate();
            }
            hasScene() { return this.scene instanceof THREE.Scene; }
            get camera() { return this.#camera; }
            set camera(v) {
                v = (v instanceof THREE.Camera) ? v : null;
                if (this.camera == v) return;
                this.#camera = v;
                this.recreate();
            }
            hasCamera() { return this.camera instanceof THREE.Camera; }

            get createPass() { return this.#createPass; }
            set createPass(v) {
                v = util.is(v, "func") ? v : null;
                if (this.createPass == v) return;
                this.#createPass = v;
                this.recreate();
            }
            hasCreatePass() { return util.is(this.createPass, "func"); }

            get pass() { return this.#pass; }
            hasPass() { return util.is(this.pass, "obj"); }

            recreate() {
                if (this.hasPass()) {
                    this.pass.composer.removePass(this.pass);
                    delete this.pass.composer;
                }
                this.#pass = (this.hasComposer() && this.hasScene() && this.hasCamera() && this.hasCreatePass()) ? this.createPass(this.composer, this.scene, this.camera) : null;
                if (this.hasPass()) {
                    this.pass.composer = this.composer;
                    this.pass.composer.addPass(this.pass);
                }
            }
        }

        this.addHandler("update", data => {
            if (this.isClosed) return;

            if (this.template in templates) eField.classList.add("has");
            else eField.classList.remove("has");
            if (this.isProjection) this.eViewProjection.classList.add("this");
            else this.eViewProjection.classList.remove("this");
            if (this.isIsometric) this.eViewIsometric.classList.add("this");
            else this.eViewIsometric.classList.remove("this");
            if (this.isMeters) this.eUnitsMeters.classList.add("this");
            else this.eUnitsMeters.classList.remove("this");
            if (this.isCentimeters) this.eUnitsCentimeters.classList.add("this");
            else this.eUnitsCentimeters.classList.remove("this");
            
            let source = (this.hasPage() && this.page.hasRootSource() && this.page.rootSource.hasRoot()) ? this.page.rootSource : null;
            let newPoses = {};
            if (this.hasPage() && this.page.hasRootSource() && this.page.rootSource.hasRoot()) {
                this.poses.forEach(pose => pose.isShown ? (newPoses[pose.name] = pose) : null);
            }
            let needAdd = {}, needRem = {};
            for (let name in newPoses)
                if (!(name in poses))
                    needAdd[name] = newPoses[name];
            for (let name in poses)
                if (!(name in newPoses))
                    needRem[name] = poses[name];
            Object.keys(needAdd).forEach(name => {
                let topic = source.root.lookup(name);
                if (!(topic instanceof NTSource.Topic)) return;
                if (!topic.isArray) return;
                if (topic.value.length == 7) {
                    let item = {};
                    item.geometry = new THREE.BoxGeometry(1, 1, 1);
                    item.material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
                    item.mesh = new THREE.Mesh(item.geometry, item.material);
                    let pass = new Pass((composer, scene, camera) => {
                        let pass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
                        pass.selectedObjects = [item.mesh];
                        pass.edgeStrength = 10;
                        pass.edgeGlow = 0;
                        pass.edgeThickness = 5;
                        return pass;
                    });
                    item.passes = [pass];
                    let items = poses[name] = [item];
                    items[0].showVelocity = false;
                }
                poses[name].forEach(item => {
                    this.scene.add(item.mesh);
                });
            });
            Object.keys(needRem).forEach(name => {
                poses[name].forEach(item => {
                    this.scene.remove(item.mesh);
                    util.ensure(item.passes, "arr").forEach(pass => {
                        pass.composer = null;
                        pass.scene = null;
                        pass.camera = null;
                    });
                });
                delete poses[name];
            });
            for (let name in poses) {
                let items = poses[name];
                items.forEach(item => {
                    util.ensure(item.passes, "arr").forEach(pass => {
                        pass.composer = this.composer;
                        pass.scene = this.scene;
                        pass.camera = this.camera;
                    });
                });
                let pose = newPoses[name];
                let topic = source.root.lookup(name);
                if (!(topic instanceof NTSource.Topic)) continue;
                if (!topic.isArray) continue;
                if (topic.value.length == 7) {
                    let item = items[0];
                    item.mesh.position.set(topic.value[0] * (this.isMeters?100:1), topic.value[1] * (this.isMeters?100:1), topic.value[2] * (this.isMeters?100:1));
                    item.mesh.rotation.setFromQuaternion(new THREE.Quaternion(...topic.value.slice(3)), "XYZ");
                    let color = new util.Color(pose.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(pose.color) : pose.color);
                    let pass = item.passes[0];
                    if (!(pass instanceof Pass)) continue;
                    if (!pass.hasPass()) continue;
                    pass = pass.pass;
                    pass.visibleEdgeColor.set(color.toHex(false));
                    pass.hiddenEdgeColor.set(util.lerp(color, new util.Color(), 0.5).toHex(false));
                }
            }

            if ((this.template in templateModels) && !(this.template in preloadedFields)) {
                const template = this.template;
                preloadedFields[template] = null;
                loader.load(templateModels[template], gltf => {
                    gltf.scene.traverse(mesh => {
                        if (!mesh.isMesh) return;
                        if (mesh.material instanceof THREE.MeshStandardMaterial) {
                            mesh.material.metalness = 0;
                            mesh.material.roughness = 1;
                        }
                    });
                    preloadedFields[template] = gltf.scene;
                }, null, err => { delete preloadedFields[template]; });
            }

            this.field = preloadedFields[this.template];

            this.axisScene.xAxis.material.color.set(getComputedStyle(document.body).getPropertyValue("--cr"));
            this.axisScene.yAxis.material.color.set(getComputedStyle(document.body).getPropertyValue("--cg"));
            this.axisScene.zAxis.material.color.set(getComputedStyle(document.body).getPropertyValue("--cb"));

            this.controls.update();

            let r = this.eContent.getBoundingClientRect();

            if (this.camera instanceof THREE.PerspectiveCamera) {
                this.camera.aspect = (r.width-4) / (r.height-4);
                this.camera.updateProjectionMatrix();
            } else if (this.camera instanceof THREE.OrthographicCamera) {
                let size = 15;
                let aspect = (r.width-4) / (r.height-4);
                this.camera.left = -size/2 * aspect;
                this.camera.right = +size/2 * aspect;
                this.camera.top = +size/2;
                this.camera.bottom = -size/2;
            }

            this.renderer.setSize((r.width-4)*this.quality, (r.height-4)*this.quality);
            this.renderer.domElement.style.transform = "scale("+(100*(1/this.quality))+"%) translate(-100%, -100%)";

            this.composer.setSize((r.width-4)*this.quality, (r.height-4)*this.quality);
            this.composer.render();
        });

        this.isProjection = true;
    }

    get scene() { return this.#scene; }
    get camera() { return this.#camera; }
    get renderer() { return this.#renderer; }
    get controls() { return this.#controls; }
    get composer() { return this.#composer; }

    get axisScene() { return this.#axisScene; }
    hasAxisScene() { return this.axisScene instanceof THREE.Object3D; }

    get field() { return this.#field; }
    set field(v) {
        v = (v instanceof THREE.Object3D) ? v : this.axisScene;
        if (this.field == v) return;
        if (this.hasField()) this.scene.remove(this.field);
        this.#field = v;
        if (this.hasField()) this.scene.add(this.field);
    }
    hasField() { return this.field instanceof THREE.Object3D; }

    get template() { return this.#template; }
    set template(v) {
        this.#template = (v == null) ? null : String(v);
        if (this.eTemplateSelect.children[0] instanceof HTMLDivElement)
            this.eTemplateSelect.children[0].textContent = (this.template == null) ? "No Template" : this.template;
        this.post("change", null);
    }

    get isProjection() { return this.#isProjection; }
    set isProjection(v) {
        v = !!v;
        if (this.#isProjection == v) return;
        this.#isProjection = v;
        this.post("change", null);
        this.#camera = this.isProjection ? new THREE.PerspectiveCamera(75, 1, 0.1, 1000) : new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000);
        this.camera.position.set(...(this.isProjection ? [0, 7.5, 7.5] : [10, 10, 10]));
        this.controls.object = this.camera;

        this.composer.dispose();
        this.#composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
        this.composer.addPass(outlinePass);
    }
    get isIsometric() { return !this.isProjection; }
    set isIsometric(v) { this.isProjection = !v; }
    get isMeters() { return this.#isMeters; }
    set isMeters(v) {
        v = !!v;
        if (this.isMeters == v) return;
        this.#isMeters = v;
        this.post("change", null);
    }
    get isCentimeters() { return !this.isMeters; }
    set isCentimeters(v) { this.isMeters = !v; }
    get isDegrees() { return this.#isDegrees; }
    set isDegrees(v) {
        v = !!v;
        if (this.isDegrees == v) return;
        this.#isDegrees = v;
        this.post("change", null);
    }
    get isRadians() { return !this.isDegrees; }
    set isRadians(v) { this.isDegrees = !v; }

    get eTemplateSelect() { return this.#eTemplateSelect; }
    get eViewProjection() { return this.#eViewProjection; }
    get eViewIsometric() { return this.#eViewIsometric; }
    get eUnitsMeters() { return this.#eUnitsMeters; }
    get eUnitsCentimeters() { return this.#eUnitsCentimeters; }

    isValidPose(topic) { return topic.value.length == 7; }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                poses: this.poses,
                template: this.template,
                isProjection: this.isProjection,
                isMeters: this.isMeters,
                isDegrees: this.isDegrees,
                isOpen: this.isOptionsOpen,
            }],
        };
    }
};

class Project extends core.Target {
    #id;

    #cache;

    #rootData;
    #config;
    #meta;

    constructor(...a) {
        super();

        this.#id = null;

        this.#cache = {};

        this.#rootData = "";
        this.#config = new Project.Config();
        this.#meta = new Project.Meta();

        if (a.length <= 0 || [2].includes(a.length) || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project) a = [a.rootData, a.config, a.meta];
            else if (util.is(a, "arr")) {
                a = new Project(...a);
                a = [a.rootData, a.config, a.meta];
            }
            else if (a instanceof Project.Config) a = ["", a, null];
            else if (a instanceof Project.Meta) a = ["", null, a];
            else if (util.is(a, "str")) a = ["", null, { name: a }];
            else if (util.is(a, "obj")) a = [a.rootData, a.config, a.meta];
            else a = ["", null, null];
        }

        [this.rootData, this.config, this.meta] = a;
    }

    get id() { return this.#id; }
    set id(v) { this.#id = (v == null) ? null : String(v); }

    get rootData() { return this.#rootData; }
    set rootData(v) {
        v = String(v);
        if (this.rootData == v) return;
        this.#rootData = v;
        this.post("change", null);
    }

    buildRootWidget() {
        try {
            let widget = JSON.parse(this.rootData, REVIVER.f);
            if (!(widget instanceof Widget)) throw widget;
            return widget;
        } catch (e) {}
        this.rootData = JSON.stringify(new Panel());
        return this.buildRootWidget();
    }

    get config() { return this.#config; }
    set config(v) {
        v = new Project.Config(v);
        if (this.config == v) return;
        if (this.config instanceof Project.Config) {
            this.config.remHandler("change", this.#cache["config_change"]);
            delete this.#cache["config_change"];
        }
        this.#config = v;
        if (this.config instanceof Project.Config) {
            this.#cache["config_change"] = () => this.post("change", null);
            this.config.addHandler("change", this.#cache["config_change"]);
        }
    }

    get meta() { return this.#meta; }
    set meta(v) {
        v = new Project.Meta(v);
        if (this.meta == v) return;
        if (this.meta instanceof Project.Meta) {
            this.meta.remHandler("change", this.#cache["meta_change"]);
            delete this.#cache["meta_change"];
        }
        this.#meta = v;
        if (this.meta instanceof Project.Meta) {
            this.#cache["meta_change"] = () => this.post("change", null);
            this.meta.addHandler("change", this.#cache["meta_change"]);
        }
        this.post("change", null);
    }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                VERSION: VERSION,
                rootData: this.rootData,
                config: this.config, meta: this.meta,
            }],
        };
    }
}
Project.Config = class ProjectConfig extends core.Target {
    #ip;

    constructor(...a) {
        super();

        if (a.length <= 0 || a.length > 1) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Config) a = [a.ip];
            else if (util.is(a, "arr")) a = [(new Project.Config(...a)).ip];
            else if (util.is(a, "obj")) a = [a.ip];
            else a = [a];
        }

        [this.ip] = a;
    }

    get ip() { return this.#ip; }
    set ip(v) {
        v = (v == null) ? "localhost" : String(v);
        if (this.ip == v) return;
        this.#ip = v;
        this.post("change", null);
    }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                VERSION: VERSION,
                ip: this.ip,
            }],
        };
    }
};
Project.Meta = class ProjectMeta extends core.Target {
    #name;
    #modified;
    #created;
    #thumb;

    constructor(...a) {
        super();

        this.#name = "Unnamed";
        this.#modified = 0;
        this.#created = 0;
        this.#thumb = null;

        if (a.length <= 0 || [3].includes(a.length) || a.length > 4) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Meta) a = [a.name, a.modified, a.created, a.thumb];
            else if (util.is(a, "arr")) {
                a = new Project.Meta(...a);
                a = [a.name, a.modified, a.created, a.thumb];
            }
            else if (util.is(a, "str")) a = [a, null];
            else if (util.is(a, "obj")) a = [a.name, a.modified, a.created, a.thumb];
            else a = ["Unnamed", null];
        }
        if (a.length == 2) a = [a[0], 0, 0, a[1]];
        
        [this.name, this.modified, this.created, this.thumb] = a;
    }

    get name() { return this.#name; }
    set name(v) {
        v = (v == null) ? "Unnamed" : String(v);
        if (this.name == v) return;
        this.#name = v;
        this.post("change", null);
    }
    get modified() { return this.#modified; }
    set modified(v) {
        v = util.ensure(v, "num");
        if (this.modified == v) return;
        this.#modified = v;
    }
    get created() { return this.#created; }
    set created(v) {
        v = util.ensure(v, "num");
        if (this.created == v) return;
        this.#created = v;
        this.post("change", null);
    }
    get thumb() { return this.#thumb; }
    set thumb(v) {
        v = (v == null) ? null : String(v);
        if (this.thumb == v) return;
        this.#thumb = v;
    }

    toJSON() {
        return {
            "%OBJ": this.constructor.name,
            "%CUSTOM": true,
            "%ARGS": [{
                VERSION: VERSION,
                name: this.name,
                modified: this.modified, created: this.created,
                thumb: this.thumb,
            }],
        };
    }
};

const REVIVER = new core.Reviver(core.REVIVER);
REVIVER.addRuleAndAllSub(Container);
REVIVER.addRuleAndAllSub(Panel);
REVIVER.addRuleAndAllSub(Project);

export default class App extends core.App {
    #eBlock;

    #eTitleBtn;
    #eProjectsBtn;
    #eCreateBtn;
    #eFileBtn;
    #eEditBtn;
    #eViewBtn;
    #eProjectInfo;
    #eProjectInfoBtn;
    #eProjectInfoNameInput;
    #eProjectInfoAddressInput;
    #eProjectInfoConnectionBtn;
    #eProjectInfoSaveBtn;
    #eProjectInfoCopyBtn;
    #eProjectInfoDeleteBtn;
    #eSaveBtn;

    constructor() {
        super();

        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("start-complete", data => {       
            this.addBackButton();

            this.#eTitleBtn = document.getElementById("titlebtn");
            if (this.hasETitleBtn())
                this.eTitleBtn.addEventListener("click", e => {
                });
            this.#eProjectsBtn = document.querySelector("#titlebar > button.nav#projectsbtn");
            if (this.hasEProjectsBtn())
                this.eProjectsBtn.addEventListener("click", e => {
                });
            this.#eCreateBtn = document.querySelector("#titlebar > button.nav#createbtn");
            if (this.hasECreateBtn())
                this.eCreateBtn.addEventListener("click", e => {
                });
            
            this.#eFileBtn = document.querySelector("#titlebar > button.nav#filebtn");
            if (this.hasEFileBtn())
                this.eFileBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.ContextMenu();
                    this.contextMenu = menu;
                    let r = this.eFileBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eEditBtn = document.querySelector("#titlebar > button.nav#editbtn");
            if (this.hasEEditBtn())
                this.eEditBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.ContextMenu();
                    this.contextMenu = menu;
                    let r = this.eEditBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eViewBtn = document.querySelector("#titlebar > button.nav#viewbtn");
            if (this.hasEViewBtn())
                this.eViewBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.ContextMenu();
                    this.contextMenu = menu;
                    let r = this.eViewBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eProjectInfo = document.querySelector("#titlebar > #projectinfo");
            if (this.hasEProjectInfo()) {
                this.#eProjectInfoBtn = this.eProjectInfo.querySelector(":scope > button.display");
                if (this.hasEProjectInfoBtn())
                    this.eProjectInfoBtn.addEventListener("click", e => {
                        e.stopPropagation();
                        if (this.eProjectInfo.classList.contains("this")) this.eProjectInfo.classList.remove("this");
                        else {
                            this.eProjectInfo.classList.add("this");
                            const click = e => {
                                if (this.eProjectInfo.contains(e.target)) return;
                                document.body.removeEventListener("click", click);
                                this.eProjectInfo.classList.remove("this");
                            };
                            document.body.addEventListener("click", click);
                        }
                    });
                this.#eProjectInfoNameInput = this.eProjectInfo.querySelector(":scope > .content > input#infoname");
                this.#eProjectInfoAddressInput = this.eProjectInfo.querySelector(":scope > .content > input#infoaddress");
                this.#eProjectInfoConnectionBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infoconnection");
                this.#eProjectInfoSaveBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infosave");
                this.#eProjectInfoCopyBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infocopy");
                this.#eProjectInfoDeleteBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infodelete");
                if (this.hasEProjectInfoSaveBtn())
                    this.eProjectInfoSaveBtn.addEventListener("click", e => this.post("cmd-save"));
                if (this.hasEProjectInfoCopyBtn())
                    this.eProjectInfoCopyBtn.addEventListener("click", e => this.post("cmd-savecopy"));
                if (this.hasEProjectInfoDeleteBtn())
                    this.eProjectInfoDeleteBtn.addEventListener("click", e => this.post("cmd-delete"));
            }
            this.#eSaveBtn = document.querySelector("#save");
            if (this.hasESaveBtn())
                this.eSaveBtn.addEventListener("click", async e => {
                    e.stopPropagation();
                    this.post("cmd-save", null);
                });

            this.#eBlock = document.getElementById("block");

            const getHovered = (widget, pos, options) => {
                options = util.ensure(options, "obj");
                let canSub = ("canSub" in options) ? options.canSub : true;
                let canTop = ("canTop" in options) ? options.canTop : true;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                pos = new V(pos);
                let r;
                r = page.eContent.getBoundingClientRect();
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
                                if (widget.tabs.length <= 0) return {
                                    widget: widget,
                                    at: 0,
                                };
                                let at = null;
                                for (let i = 0; i < widget.tabs.length; i++) {
                                    if (at != null) continue;
                                    let r = widget.getTab(i).eTab.getBoundingClientRect();
                                    if (i == 0) {
                                        if (pos.x < r.left+r.width/2) {
                                            at = 0;
                                            continue;
                                        }
                                    }
                                    if (i+1 >= widget.tabs.length) {
                                        if (pos.x > r.left+r.width/2) at = widget.tabs.length;
                                        continue;
                                    }
                                    let ri = r, rj = widget.getTab(i+1).eTab.getBoundingClientRect();
                                    if (pos.x > ri.left+ri.width/2 && pos.x < rj.left+rj.width) at = i+1;
                                }
                                if (at != null) return {
                                    widget: widget,
                                    at: at,
                                };
                            }
                        }
                    }
                    let tab = widget.getTab(widget.tabIndex);
                    if (tab instanceof Panel.Tab) {
                        let hovered = tab.getHovered(this.dragData, pos, options);
                        if (util.is(hovered, "obj")) return {
                            widget: widget,
                            at: "custom",
                            data: hovered,
                        };
                    }
                    r = widget.elem.getBoundingClientRect();
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
                if (o instanceof NTSource.Generic) return true;
                if (o instanceof Widget) return true;
                if (o instanceof Panel.Tab) return true;
                return false;
            };
            const canGetWidgetFromData = () => {
                if (this.dragData instanceof NTSource.Generic) return true;
                if (this.dragData instanceof Widget) return true;
                if (this.dragData instanceof Panel.Tab) return true;
                return false;
            };
            const getWidgetFromData = () => {
                if (this.dragData instanceof NTSource.Generic) return new Panel([new Panel.BrowserTab(this.dragData.path)]);
                if (this.dragData instanceof Widget) return this.dragData;
                if (this.dragData instanceof Panel.Tab) return new Panel([this.dragData]);
                return null;
            };
            const canGetTabFromData = () => {
                if (this.dragData instanceof NTSource.Generic) return true;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return true;
                return false;
            };
            const getTabFromData = () => {
                if (this.dragData instanceof NTSource.Generic) return new Panel.BrowserTab(this.dragData.path);
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return this.dragData;
                return null;
            };
            const canGetGenericFromData = () => {
                if (this.dragData instanceof NTSource.Generic) return true;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return (this.dragData instanceof Panel.BrowserTab) && (this.hasPage("PROJECT") && this.getPage("PROJECT").lookup(this.dragData.path) instanceof NTSource.Generic);
                return false;
            };
            const getGenericFromData = () => {
                if (this.dragData instanceof NTSource.Generic) return this.dragData;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return ((this.dragData instanceof Panel.BrowserTab) && this.hasPage("PROJECT")) ? this.getPage("PROJECT").lookup(this.dragData.path) : null;
                return null;
            };
            this.addHandler("drag-start", () => {
                if (!isValid(this.dragData)) return;
                let canWidget = canGetWidgetFromData();
                let canTab = canGetTabFromData();
                let canGeneric = canGetGenericFromData();
                if (canGeneric) {
                    let generic = getGenericFromData();
                    this.eDrag.innerHTML = "<div class='browseritem'><button class='display'><ion-icon></ion-icon><div></div></button></div>";
                    let btn = this.eDrag.children[0].children[0];
                    let icon = btn.children[0], name = btn.children[1];
                    name.textContent = (generic.name.length > 0) ? generic.name : "/";
                    if (generic instanceof NTSource.Table) {
                        icon.setAttribute("name", "folder-outline");
                    } else {
                        let display = getDisplay(generic.type, generic.value);
                        if (display != null) {
                            if ("src" in display) icon.setAttribute("src", display.src);
                            else icon.setAttribute("name", display.name);
                            if ("color" in display) icon.style.color = display.color;
                        }
                    }
                    return;
                }
                if (canTab) {
                    if (this.dragData instanceof Panel.Tab) {
                        this.eDrag.innerHTML = "<div class='browseritem'><button class='display'><ion-icon></ion-icon><div></div></button></div>";
                        let btn = this.eDrag.children[0].children[0];
                        let icon = btn.children[0], name = btn.children[1];
                        name.textContent = this.dragData.name;
                        if (this.dragData.hasIcon) {
                            if (this.dragData.eTabIcon.hasAttribute("src")) icon.setAttribute("src", this.dragData.eTabIcon.getAttribute("src"));
                            else icon.setAttribute("name", this.dragData.eTabIcon.getAttribute("name"));
                            icon.style = this.dragData.eTabIcon.style;
                        } else icon.style.display = "none";
                    }
                }
            });
            this.addHandler("drag-move", e => {
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (!isValid(this.dragData)) return;
                if (!page.hasRootWidget()) {
                    this.showBlock();
                    this.placeBlock(page.eContent.getBoundingClientRect());
                    return;
                }
                const hovered = getHovered(
                    page.rootWidget, new V(e.pageX, e.pageY),
                    {
                        canSub: true,
                        canTop: (this.dragData instanceof NTSource.Generic || this.dragData instanceof Panel.Tab),
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
                    let x = (at >= hovered.widget.tabs.length) ? hovered.widget.getTab(hovered.widget.tabs.length-1).eTab.getBoundingClientRect().right : hovered.widget.getTab(at).eTab.getBoundingClientRect().left;
                    this.placeBlock(new util.Rect(x, r.y+10, 0, r.h-15));
                } else if (at == "custom") {
                    let data = util.ensure(hovered.data, "obj");
                    this.placeBlock(new util.Rect(data.r));
                }
            });
            this.addHandler("drag-submit", e => {
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (!isValid(this.dragData)) return;
                this.hideBlock();
                let canWidget = canGetWidgetFromData();
                let canTab = canGetTabFromData();
                if (!page.hasRootWidget()) {
                    page.rootWidget = getWidgetFromData();
                    return;
                }
                const hovered = getHovered(
                    page.rootWidget, new V(e.pageX, e.pageY),
                    {
                        canSub: true,
                        canTop: (this.dragData instanceof NTSource.Generic || this.dragData instanceof Panel.Tab),
                    },
                );
                if (!util.is(hovered, "obj") || !(hovered.widget instanceof Panel)) return;
                let at = hovered.at;
                if (["+x", "-x", "+y", "-y"].includes(at) && canWidget) {
                    let widget = getWidgetFromData();
                    let container = new Container();
                    container.axis = at[1];
                    if (hovered.widget == page.rootWidget) {
                        page.rootWidget = null;
                        container.addChild((at[0] == "+") ? hovered.widget : widget);
                        container.addChild((at[0] != "+") ? hovered.widget : widget);
                        page.rootWidget = container;
                    } else {
                        let parent = hovered.widget.parent;
                        let weights = parent.weights, thisAt = parent.children.indexOf(hovered.widget);
                        parent.remChild(hovered.widget);
                        container.addChild((at[0] == "+") ? hovered.widget : widget);
                        container.addChild((at[0] != "+") ? hovered.widget : widget);
                        parent.addChild(container, thisAt);
                        parent.weights = weights;
                    }
                } else if (util.is(at, "int") && canTab) {
                    hovered.widget.addTab(getTabFromData(), at);
                } else if (at == "custom") {
                    let data = util.ensure(hovered.data, "obj");
                    if (util.is(data.submit, "func")) data.submit();
                }
                page.rootWidget.collapse();
            });

            const getWidgetFromElem = (widget, elem) => {
                if (!(widget instanceof Widget)) return null;
                if (widget.elem == elem) return widget;
                if (widget instanceof Container) {
                    for (let i = 0; i < widget.children.length; i++) {
                        let child = getWidgetFromElem(widget.children[i], elem);
                        if (child instanceof Widget) return child;
                    }
                }
                return null;
            };
            this.addHandler("cmd-newtab", data => {
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                const elem = document.activeElement;
                const active = getWidgetFromElem(page.rootWidget, elem);
                if (!(active instanceof Panel)) return;
                active.addTab(new Panel.AddTab());
            });
            this.addHandler("cmd-close", data => {
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                const elem = document.activeElement;
                const active = getWidgetFromElem(page.rootWidget, elem);
                if (!(active instanceof Panel)) return;
                active.remTab(active.tabs[active.tabIndex]);
            });
            this.addHandler("cmd-openclose", data => {
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                const elem = document.activeElement;
                const active = getWidgetFromElem(page.rootWidget, elem);
                if (!(active instanceof Panel)) return;
                if (!(active.tabs[active.tabIndex] instanceof Panel.Tab)) return;
                active.tabs[active.tabIndex].post("openclose", null);
            });
            this.addHandler("cmd-expandcollapse", data => {
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                const elem = document.activeElement;
                const active = getWidgetFromElem(page.rootWidget, elem);
                if (!(active instanceof Panel)) return;
                active.isTitleCollapsed = !active.isTitleCollapsed;
            });
            
            this.addPage(new App.ProjectPage(this));

            this.page = "PROJECT";
        });
    }

    get eTitleBtn() { return this.#eTitleBtn; }
    hasETitleBtn() { return this.eTitleBtn instanceof HTMLButtonElement; }
    get eProjectsBtn() { return this.#eProjectsBtn; }
    hasEProjectsBtn() { return this.eProjectsBtn instanceof HTMLButtonElement; }
    get eCreateBtn() { return this.#eCreateBtn; }
    hasECreateBtn() { return this.eCreateBtn instanceof HTMLButtonElement; }
    get eFileBtn() { return this.#eFileBtn; }
    hasEFileBtn() { return this.eFileBtn instanceof HTMLButtonElement; }
    get eEditBtn() { return this.#eEditBtn; }
    hasEEditBtn() { return this.eEditBtn instanceof HTMLButtonElement; }
    get eViewBtn() { return this.#eViewBtn; }
    hasEViewBtn() { return this.eViewBtn instanceof HTMLButtonElement; }
    get eProjectInfo() { return this.#eProjectInfo; }
    hasEProjectInfo() { return this.eProjectInfo instanceof HTMLDivElement; }
    get eProjectInfoBtn() { return this.#eProjectInfoBtn; }
    hasEProjectInfoBtn() { return this.eProjectInfoBtn instanceof HTMLButtonElement; }
    get eProjectInfoNameInput() { return this.#eProjectInfoNameInput; }
    hasEProjectInfoNameInput() { return this.eProjectInfoNameInput instanceof HTMLInputElement; }
    get eProjectInfoAddressInput() { return this.#eProjectInfoAddressInput; }
    hasEProjectInfoAddressInput() { return this.eProjectInfoAddressInput instanceof HTMLInputElement; }
    get eProjectInfoSaveBtn() { return this.#eProjectInfoSaveBtn; }
    hasEProjectInfoSaveBtn() { return this.eProjectInfoSaveBtn instanceof HTMLButtonElement; }
    get eProjectInfoCopyBtn() { return this.#eProjectInfoCopyBtn; }
    hasEProjectInfoCopyBtn() { return this.eProjectInfoCopyBtn instanceof HTMLButtonElement; }
    get eProjectInfoDeleteBtn() { return this.#eProjectInfoDeleteBtn; }
    hasEProjectInfoDeleteBtn() { return this.eProjectInfoDeleteBtn instanceof HTMLButtonElement; }
    get eProjectInfoConnectionBtn() { return this.#eProjectInfoConnectionBtn; }
    hasEProjectInfoConnectionBtn() { return this.eProjectInfoConnectionBtn instanceof HTMLButtonElement; }
    get eSaveBtn() { return this.#eSaveBtn; }
    hasESaveBtn() { return this.eSaveBtn instanceof HTMLButtonElement; }

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
App.ProjectPage = class AppProjectPage extends core.App.Page {
    #project;

    #browserItems;
    #toolButtons;
    #rootWidget;
    #rootSource;

    #eSide;
    #eSideMeta;
    #eSideSections;
    #eContent;
    
    constructor(app) {
        super("PROJECT", app);

        if (!this.hasApp()) return;

        this.#project = new Project();

        this.#browserItems = [];
        this.#toolButtons = new Set();
        this.#rootWidget = null;
        this.#rootSource = null;

        this.#eSide = document.createElement("div");
        this.elem.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.#eSideMeta = document.createElement("div");
        this.eSide.appendChild(this.eSideMeta);
        this.eSideMeta.id = "meta";
        this.#eSideSections = {};
        ["browser", "tools"].forEach(name => {
            let elem = document.createElement("div");
            this.eSide.appendChild(elem);
            elem.id = name;
            elem.classList.add("section");
            let s = this.#eSideSections[name] = new core.Target();
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
            let btn = document.createElement("button");
            elem.appendChild(btn);
            btn.classList.add("override");
            btn.innerHTML = "<ion-icon name='chevron-forward'></ion-icon>";
            btn.append(name.toUpperCase());
            if (btn instanceof HTMLButtonElement)
                btn.addEventListener("click", e => {
                    s.setIsOpen(!s.getIsOpen());
                });
            s.eContent = document.createElement("div");
            elem.appendChild(s.eContent);
            s.eContent.classList.add("content");
            let idfs = {
                browser: () => s.eContent.classList.add("browser"),
            };
            if (elem.id in idfs) idfs[elem.id]();
        });
        new ResizeObserver(() => this.formatSide()).observe(this.eSide);
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        new ResizeObserver(() => this.formatContent()).observe(this.eContent);
        
        this.addToolButton(new ToolButton("Graph", "analytics")).addHandler("drag", () => {
            if (!this.hasApp()) return;
            this.app.dragData = new Panel.GraphTab();
            this.app.dragging = true;
        });
        this.addToolButton(new ToolButton("Odom2d", "locate")).addHandler("drag", () => {
            if (!this.hasApp()) return;
            this.app.dragData = new Panel.Odometry2dTab();
            this.app.dragging = true;
        });
        this.addToolButton(new ToolButton("Odom3d", "locate")).addHandler("drag", () => {
            if (!this.hasApp()) return;
            this.app.dragData = new Panel.Odometry3dTab();
            this.app.dragging = true;
        });

        this.format();

        this.getESideSection("browser").open();

        let refactor = false;
        this.addHandler("refactor-browser-queue", data => { refactor = true; });
        this.addHandler("update", data => {
            if (!refactor) return;
            refactor = false;
            this.post("refactor-browser", null);
        });
        this.addHandler("refactor-browser", data => {
            let newPaths = {};
            if (this.hasRootSource() && this.rootSource.hasRoot()) {
                this.rootSource.root.children.forEach(generic => {
                    let path = [];
                    const dfs = generic => {
                        path.push(generic.name);
                        newPaths[path.join("/")] = generic;
                        if (generic instanceof NTSource.Table)
                            generic.children.forEach(generic => dfs(generic));
                        path.pop();
                    };
                    dfs(generic);
                });
            }
            let oldPaths = {};
            this.browserItems.forEach(itm => {
                let path = [];
                const dfs = itm => {
                    path.push(itm.name);
                    oldPaths[path.join("/")] = itm;
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
                let itm = (generic instanceof NTSource.Table) ? new BrowserTable(generic.name) : new BrowserTopic(generic.name, generic.type, generic.value);
                if (superPath in oldPaths) oldPaths[superPath].addChild(itm);
                else this.addBrowserItem(itm);
                oldPaths[path] = itm;
            });
            for (let path in newPaths) {
                if (!(path in oldPaths)) continue;
                oldPaths[path].value = newPaths[path].value;
            }
        });

        this.rootSource = null;

        if (this.app.hasEProjectInfoNameInput())
            this.app.eProjectInfoNameInput.addEventListener("change", e => {
                this.project.meta.name = this.app.eProjectInfoNameInput.value;
            });
        if (this.app.hasEProjectInfoAddressInput())
            this.app.eProjectInfoAddressInput.addEventListener("change", e => {
                this.project.config.ip = this.app.eProjectInfoAddressInput.value;
                this.rootSource = null;
            });
        if (this.app.hasEProjectInfoConnectionBtn())
            this.app.eProjectInfoConnectionBtn.addEventListener("click", e => {
                if (!this.hasRootSource() || (!this.rootSource.connecting && !this.rootSource.connected)) {
                    this.rootSource = new NTSource(this.project.config.ip);
                    return;
                }
                this.rootSource = null;
            });

        this.addHandler("update", data => {
            if (this.hasRootWidget()) {
                this.rootWidget.collapse();
                if (this.hasRootWidget()) this.rootWidget.update();
            } else this.rootWidget = new Panel();
            this.eSideMeta.textContent = (!this.hasRootSource() || (!this.rootSource.connecting && !this.rootSource.connected)) ? "Disconnected" : this.rootSource.connecting ? "Connecting to "+this.rootSource.address : (() => {
                let nFields = this.rootSource.root.nFields;
                return nFields + " field" + (nFields==1 ? "" : "s");
            })();
            if (!this.hasApp()) return;
            if (this.app.hasEProjectInfoBtn())
                if (this.app.eProjectInfoBtn.querySelector(":scope > .value") instanceof HTMLDivElement)
                    this.app.eProjectInfoBtn.querySelector(":scope > .value").textContent = this.project.meta.name;
            if (this.app.hasEProjectInfoNameInput())
                if (document.activeElement != this.app.eProjectInfoNameInput)
                    this.app.eProjectInfoNameInput.value = this.project.meta.name;
            if (this.app.hasEProjectInfoAddressInput())
                if (document.activeElement != this.app.eProjectInfoAddressInput)
                    this.app.eProjectInfoAddressInput.value = this.project.config.ip;
            if (this.app.hasEProjectInfoConnectionBtn()) {
                let on = !this.hasRootSource() || (!this.rootSource.connecting && !this.rootSource.connected);
                this.app.eProjectInfoConnectionBtn.textContent = on ? "Connect" : "Disconnect";
                if (on) this.app.eProjectInfoConnectionBtn.classList.add("on");
                else this.app.eProjectInfoConnectionBtn.classList.remove("on");
                if (!on) this.app.eProjectInfoConnectionBtn.classList.add("off");
                else this.app.eProjectInfoConnectionBtn.classList.remove("off");
            }
        });
    }

    get project() { return this.#project; }

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
            if (!(generic instanceof NTSource.Generic)) return;
            if (!this.hasApp()) return;
            this.app.dragData = generic;
            this.app.dragging = true;
        };
        itm.addHandler("drag", itm._onDrag);
        this.getESideSection("browser").eContent.appendChild(itm.elem);
        this.formatSide();
        return itm;
    }
    remBrowserItem(itm) {
        if (!(itm instanceof BrowserItem)) return false;
        if (!this.hasBrowserItem(itm)) return false;
        this.#browserItems.splice(this.#browserItems.indexOf(itm), 1);
        itm.remHandler("drag", itm._onDrag);
        delete itm._onDrag;
        this.getESideSection("browser").eContent.removeChild(itm.elem);
        this.formatSide();
        return itm;
    }

    get toolButtons() { return [...this.#toolButtons]; }
    set toolButtons(v) {
        v = util.ensure(v, "arr");
        this.clearToolButtons();
        v.forEach(v => this.addToolButton(v));
    }
    clearToolButtons() {
        let btns = this.toolButtons;
        btns.forEach(btn => this.remToolButton(btn));
        return btns;
    }
    hasToolButton(btn) {
        if (!(btn instanceof ToolButton)) return false;
        return this.#toolButtons.has(btn);
    }
    addToolButton(btn) {
        if (!(btn instanceof ToolButton)) return false;
        if (this.hasToolButton(btn)) return false;
        this.#toolButtons.add(btn);
        this.getESideSection("tools").eContent.appendChild(btn.elem);
        return btn;
    }
    remToolButton(btn) {
        if (!(btn instanceof ToolButton)) return false;
        if (!this.hasToolButton(btn)) return false;
        this.#toolButtons.delete(btn);
        this.getESideSection("tools").eContent.removeChild(btn.elem);
        return btn;
    }

    get rootWidget() { return this.#rootWidget; }
    set rootWidget(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.rootWidget == v) return;
        if (this.hasRootWidget()) {
            this.rootWidget.parent = null;
            this.rootWidget.remHandler("change", this.rootWidget._onChange);
            delete this.rootWidget._onChange;
            this.eContent.removeChild(this.rootWidget.elem);
        }
        this.#rootWidget = v;
        if (this.hasRootWidget()) {
            this.rootWidget.parent = this;
            this.rootWidget._onChange = () => {
                this.project.rootData = JSON.stringify(this.rootWidget);
            };
            this.rootWidget.addHandler("change", this.rootWidget._onChange);
            this.eContent.appendChild(this.rootWidget.elem);
            this.rootWidget.elem.focus();
        }
        this.project.rootData = JSON.stringify(this.rootWidget);
        this.formatContent();
    }
    hasRootWidget() { return this.rootWidget instanceof Widget; }
    get rootSource() { return this.#rootSource; }
    set rootSource(v) {
        v = (v instanceof NTSource) ? v : null;
        if (this.rootSource == v) return;
        if (this.hasRootSource()) {
            this.rootSource.remHandler("change", this.rootSource.root._onChange);
            delete this.rootSource._onChange;
        }
        this.#rootSource = v;
        if (this.hasRootSource()) {
            this.rootSource._onChange = data => this.post("refactor-browser-queue", null);
            this.rootSource.addHandler("change", this.rootSource._onChange);
        }
        this.post("refactor-browser", null);
    }
    hasRootSource() { return this.rootSource instanceof NTSource; }
    lookup(path) {
        if (!this.hasRootSource() || !this.rootSource.hasRoot()) return null;
        return this.rootSource.root.lookup(path);
    }

    get eSide() { return this.#eSide; }
    get eSideMeta() { return this.#eSideMeta; }
    get eSideSections() { return Object.keys(this.#eSideSections); }
    hasESideSection(id) { return id in this.#eSideSections; }
    getESideSection(id) { return this.#eSideSections[id]; }
    get eContent() { return this.#eContent; }

    format() {
        this.formatSide();
        this.formatContent();
    }
    formatSide() {
        let r = this.eSide.getBoundingClientRect();
        let ids = this.eSideSections;
        let idsOpen = ids.filter(id => this.getESideSection(id).getIsOpen());
        let availableHeight = r.height - 22 - ids.length*22;
        let divideAmong = idsOpen.length;
        idsOpen.forEach(id => this.getESideSection(id).elem.style.setProperty("--h", (availableHeight/divideAmong + 22)+"px"));
        this.browserItems.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? +1 : (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 0).forEach((itm, i) => {
            itm.elem.style.order = i;
            if (itm instanceof BrowserTable) itm.format();
        });
        return true;
    }
    formatContent() {
        if (!this.hasRootWidget()) return false;
        let r = this.eContent.getBoundingClientRect();
        this.rootWidget.elem.style.setProperty("--w", r.width+"px");
        this.rootWidget.elem.style.setProperty("--h", r.height+"px");
        this.rootWidget.format();
        return true;
    }
};
