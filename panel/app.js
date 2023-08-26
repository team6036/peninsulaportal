import * as util from "../util.js";
import { V } from "../util.js";

import * as core from "../core.js";


class Dirent extends core.Target {
    #parent;

    #name;

    constructor(parent, name) {
        super();

        this.#parent = null;

        this.#name = null;

        this.parent = parent;
        this.name = name;
    }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Directory) ? v : (v instanceof App) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return this.parent instanceof Dirent; }
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

class Directory extends Dirent {
    #children;

    constructor(parent, name) {
        super(parent, name);
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
        if (!(child instanceof Dirent)) return false;
        return this.#children.includes(child) && child.parent == this;
    }
    getChild(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.#children.length) return null;
        return this.#children[i];
    }
    addChild(child) {
        if (!(child instanceof Dirent)) return false;
        if (this.hasChild(child)) return false;
        if (child.parent != null) return false;
        this.#children.push(child);
        child.parent = this;
        child._onChange = () => this.post("change", null);
        child.addHandler("change", child._onChange);
        return child;
    }
    remChild(child) {
        if (!(child instanceof Dirent)) return false;
        if (!this.hasChild(child)) return false;
        if (child.parent != this) return false;
        this.#children.splice(this.#children.indexOf(child), 1);
        child.parent = null;
        child.remHandler("change", child._onChange);
        delete child._onChange;
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

class Topic extends Dirent {
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
    static typeToDisplay(t, v) {
        t = String(t);
        if (!Topic.TYPES.includes(t)) return null;
        if (t.endsWith("[]")) {
            t = t.substring(0, t.length-2);
            let display = Topic.typeToDisplay(t, (t == "boolean") ? true : null);
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

    constructor(parent, name, type, value) {
        super(parent, name);

        this.#type = null;
        this.#value = null;

        this.type = type;
        this.value = value;
    }

    get type() { return this.#type; }
    set type(v) {
        v = String(v);
        if (!Topic.TYPES.includes(v)) return;
        if (this.type == v) return;
        this.#type = v;
        this.post("type-set", { v: v });
        this.post("change", { k: "type" });
        this.value = this.value;
    }
    get isArray() { return this.type.endsWith("[]"); }
    get value() { return (this.isArray && util.is(this.#value, "arr")) ? [...this.#value] : this.#value; }
    set value(v) {
        this.#value = Topic.ensureType(this.type, v);
        this.post("value-set", { v: this.value });
        this.post("change", { k: "value" });
    }
}


class BrowserItem extends core.Target {
    #elem;
    #eDisplay;
    #eIcon;
    #eName;
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

class BrowserDirectory extends BrowserItem {
    #children;

    constructor(name) {
        super(name);

        this.elem.classList.add("directory");

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
        this.eContent.appendChild(child.elem);
        return child;
    }
    remChild(child) {
        if (!(child instanceof BrowserItem)) return false;
        if (!this.hasChild(child)) return false;
        this.#children.splice(this.#children.indexOf(child), 1);
        this.eContent.removeChild(child.elem);
        return child;
    }
}

class BrowserVariable extends BrowserItem {
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
        if (!Topic.TYPES.includes(v)) v = "string";
        if (this.type == v) return;
        this.#type = v;
        this.post("type-set", { v: v });
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
        let display = Topic.typeToDisplay(this.type, this.value);
        if (display != null) {
            if ("src" in display) this.iconSrc = display.src;
            else this.icon = display.name;
            if ("color" in display) this.eIcon.style.color = display.color;
        }
        if (this.isArray) {
            this.value.forEach((value, i) => {
                let itm = new BrowserVariable(i, this.arraylessType, value);
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

    update() { this.post("update", null); }
}

class Container extends Widget {
    #childA; #childB;
    #divider;
    #axis;

    #eDivider;

    constructor(childA, childB) {
        super();

        this.elem.classList.add("container");
        
        this.#childA = null;
        this.#childB = null;

        this.#divider = 0.5;
        this.#axis = null;

        this.#eDivider = document.createElement("div");
        this.eDivider.classList.add("divider");

        new ResizeObserver(() => this.format()).observe(this.elem);

        this.eDivider.addEventListener("mousedown", e => {
            const mouseup = () => {
                this.eDivider.classList.remove("this");
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                let r = this.elem.getBoundingClientRect()
                let p = (this.axis == "x") ? ((e.pageX-r.left)/r.width) : ((e.pageY-r.top)/r.height);
                this.divider = p;
            };
            this.eDivider.classList.add("this");
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.addHandler("update", data => {
            this.childA.update();
            this.childB.update();
        });

        this.axis = "x";

        this.childA = childA;
        this.childB = childB;
    }

    get childA() { return this.#childA; }
    set childA(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.isChildA(v)) return;
        if (v instanceof Widget)
            if (v.parent != null)
                return;
        if (this.hasChildA()) {
            this.childA.parent = null;
            this.elem.removeChild(this.childA.elem);
        }
        this.#childA = v;
        if (this.hasChildA()) {
            this.childA.parent = this;
            this.elem.appendChild(this.childA.elem);
        }
        this.format();
    }
    hasChildA() { return this.childA instanceof Widget; }
    isChildA(v) { return this.childA == v; }
    get childB() { return this.#childB; }
    set childB(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.isChildB(v)) return;
        if (v instanceof Widget)
            if (v.parent != null)
                return;
        if (this.hasChildB()) {
            this.childB.parent = null;
            this.elem.removeChild(this.childB.elem);
        }
        this.#childB = v;
        if (this.hasChildB()) {
            this.childB.parent = this;
            this.elem.appendChild(this.childB.elem);
        }
        this.format();
    }
    hasChildB() { return this.childB instanceof Widget; }
    isChildB(v) { return this.childB == v; }

    hasBothChildren() { return this.hasChildA() && this.hasChildB(); }
    hasNoChildren() { return !this.hasChildA() && !this.hasChildB(); }
    hasOneChild() { return this.hasChildA() != this.hasChildB(); }

    get divider() { return this.#divider; }
    set divider(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.divider == v) return;
        this.#divider = v;
        this.format();
    }
    get axis() { return this.#axis; }
    set axis(v) {
        v = String(v).toLowerCase();
        if (!["x", "y"].includes(v)) return;
        if (this.axis == v) return;
        this.#axis = v;
        this.format();
    }

    get eDivider() { return this.#eDivider; }

    format() {
        this.elem.classList.remove("x");
        this.elem.classList.remove("y");
        this.elem.classList.add(this.axis);
        this.eDivider.remove();
        if (this.hasNoChildren()) return;
        let r = this.elem.getBoundingClientRect();
        if (this.hasOneChild()) {
            let child = this.hasChildA() ? this.childA : this.childB;
            child.elem.style.order = 0;
            child.elem.style.setProperty("--w", r.width+"px");
            child.elem.style.setProperty("--h", r.height+"px");
            if (child instanceof Container) child.format();
        } else {
            this.childA.elem.style.order = 0;
            if (this.axis == "x") {
                this.childA.elem.style.setProperty("--w", ((r.width-12)*this.divider)+"px");
                this.childA.elem.style.setProperty("--h", r.height+"px");
            } else {
                this.childA.elem.style.setProperty("--w", r.width+"px");
                this.childA.elem.style.setProperty("--h", ((r.height-12)*this.divider)+"px");
            }
            this.childB.elem.style.order = 2;
            if (this.axis == "x") {
                this.childB.elem.style.setProperty("--w", ((r.width-12)*(1-this.divider))+"px");
                this.childB.elem.style.setProperty("--h", r.height+"px");
            } else {
                this.childB.elem.style.setProperty("--w", r.width+"px");
                this.childB.elem.style.setProperty("--h", ((r.height-12)*(1-this.divider))+"px");
            }
            this.elem.appendChild(this.eDivider);
            this.eDivider.style.order = 1;
            if (this.childA instanceof Container) this.childA.format();
            if (this.childB instanceof Container) this.childB.format();
        }
    }

    collapse() {
        if (this.hasChildA())
            if (this.childA instanceof Container)
                this.childA.collapse();
        if (this.hasChildB())
            if (this.childB instanceof Container)
                this.childB.collapse();
        if (!this.hasParent()) return;
        if (!this.parent.isChildA(this) && !this.parent.isChildB(this)) return;
        let childIndex = this.parent.isChildA(this) ? "childA" : "childB";
        if (this.hasNoChildren()) this.parent[childIndex] = null;
        else if (this.hasOneChild()) {
            let child = this.hasChildA() ? this.childA : this.childB;
            this.childA = this.childB = null;
            this.parent[childIndex] = child;
        }
    }

    lookup(k) {
        k = String(k).toUpperCase();
        if (k.length <= 0) return this;
        let at = k[0];
        k = k.substring(1);
        if (at == "A") {
            if (!this.hasChildA()) return null;
            return this.childA.lookup(k);
        } else if (at == "B") {
            if (!this.hasChildB()) return null;
            return this.childB.lookup(k);
        }
        return null;
    }
}

class Panel extends Widget {
    #pages;
    #pageIndex;

    #eTop;
    #eClose;
    #eContent;

    constructor() {
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

        this.#pageIndex = null;
        this.pageIndex = 0;

        this.addPage(new Panel.VariablePage());
        this.addPage(new Panel.VariablePage());
        this.addPage(new Panel.VariablePage());
        this.addPage(new Panel.VariablePage());
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
        page.close();
        this.format();
        let index = this.pageIndex;
        this.#pageIndex = null;
        this.pageIndex = index;
        return page;
    }

    format() {
        this.pages.forEach((page, i) => { page.eTab.style.order = i; });
    }

    lookup(k) {
        k = String(k).toUpperCase();
        if (k.length <= 0) return this;
        if (k[0] == "-") {
            let i = parseInt(k.substring(1));
            if (!util.is(i, "int")) return null;
            return this.getPage(i);
        }
        return null;
    }

    get eTop() { return this.#eTop; }
    get eClose() { return this.#eClose; }
    get eContent() { return this.#eContent; }
}
Panel.Page = class PanelPage extends core.Target {
    #parent;

    #eTab;
    #eTabIcon;
    #eTabName;
    #eTabClose;

    constructor() {
        super();

        this.#parent = null;

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

        // this.name = "lkasdjklfkljasdklfjjklaslkdkljfjasdf";
    }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Panel) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return this.parent instanceof Panel; }

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

    get name() { return this.eTabName.textContent; }
    set name(v) { this.eTabName.textContent = v; }
};
Panel.VariablePage = class PanelVariablePage extends Panel.Page {
    constructor() {
        super();
    }
};

export default class App extends core.App {
    #browserItems;
    #rootWidget;
    #rootDirectory;

    #eSide;
    #eSideSections;
    #eContent;

    constructor() {
        super();

        this.#browserItems = [];
        this.#rootWidget = null;
        this.#rootDirectory = null;

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
            
            /*
            let itms = [
                {
                    name: "Folder1",
                    content: [
                        {
                            name: "Folder2",
                            content: [
                                {
                                    name: "Variable1",
                                    type: "boolean[]",
                                    value: [true, false, true],
                                },
                                {
                                    name: "Variable2",
                                    type: "null",
                                    value: null,
                                },
                            ],
                        },
                        {
                            name: "Variable3",
                            type: "string[]",
                            value: ["hello", "world", "!"],
                        },
                        {
                            name: "Variable4",
                            type: "int",
                            value: 1.23,
                        },
                    ]
                },
                {
                    name: "Variable5",
                    type: "boolean",
                    value: false,
                },
                {
                    name: "Variable6",
                    type: "double[]",
                    value: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
                },
            ];
            const buildItms = arr => {
                arr = util.ensure(arr, "arr").map(v => util.ensure(v, "obj"));
                arr = arr.map(v => {
                    if (v.content) {
                        let itm = new BrowserDirectory(v.name);
                        let subitms = buildItms(v.content);
                        subitms.forEach(subitm => itm.addChild(subitm));
                        return itm;
                    } else {
                        let itm = new BrowserVariable(v.name, v.type, v.value);
                        return itm;
                    }
                });
                return arr;
            };
            buildItms(itms).forEach(itm => this.addBrowserItem(itm));
            */

            let widget = {
                axis: "x",
                sub: [
                    null,
                    {
                        axis: "y",
                        sub: [
                            null,
                            null,
                        ],
                    },
                ],
            };
            const buildWidget = o => {
                if (!util.is(o, "obj")) return new Panel();
                let c = new Container();
                c.childA = buildWidget(util.ensure(o.sub, "arr")[0]);
                c.childB = buildWidget(util.ensure(o.sub, "arr")[1]);
                c.axis = o.axis;
                return c;
            };
            this.rootWidget = buildWidget(widget);
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
        if (this.hasBrowserItem(itm)) return false;
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
    get rootDirectory() { return this.#rootDirectory; }
    set rootDirectory(v) {
        v = (v instanceof Directory) ? v : null;
        if (this.rootDirectory == v) return;
        if (this.hasRootDirectory()) {
            this.rootDirectory.parent = null;
        }
        this.#rootDirectory = v;
        if (this.hasRootDirectory()) {
            this.rootDirectory.parent = this;
        }
    }
    hasRootDirectory() { return this.rootDirectory instanceof Directory; }

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
        if (this.rootWidget instanceof Container) this.rootWidget.format();
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