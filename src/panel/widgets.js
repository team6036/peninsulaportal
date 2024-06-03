import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../core.mjs";

import * as app from "../app.mjs";


import PanelTab from "./tabs/tab.js";
import PanelAddTab from "./tabs/addtab.js";
import PanelBrowserTab from "./tabs/browsertab.js";
import PanelToolTab from "./tabs/tooltab.js";
import PanelTableTab from "./tabs/tabletab.js";
import PanelWebViewTab from "./tabs/webviewtab.js";
import PanelScoutTab from "./tabs/scouttab.js";
import PanelLoggerTab from "./tabs/loggertab.js";
import PanelLogWorksTab from "./tabs/logworkstab.js";
import PanelVideoSyncTab from "./tabs/videosynctab.js";
import PanelToolCanvasTab from "./tabs/toolcanvastab.js";
import PanelGraphTab from "./tabs/graphtab.js";
import PanelOdometryTab from "./tabs/odometrytab.js";
import PanelOdometry2dTab from "./tabs/odometry2dtab.js";
import PanelOdometry3dTab from "./tabs/odometry3dtab.js";


export class Widget extends util.Target {
    #elem;

    #parent;

    constructor(a) {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.elem.classList.add("widget");

        this.#parent = 0;

        this.parent = null;
    }

    get elem() { return this.#elem; }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Container) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return !!this.parent; }
    get app() { return app.App.instance; }
    get page() { return this.app.projectPage; }

    contains(v) { return v == this; }

    format() { this.post("format"); }
    collapse() {}

    update(delta) { this.post("update", delta); }
}

export class Container extends Widget {
    #children;
    #weights;
    #dividers;
    #axis;

    constructor(a) {
        super(a);

        this.elem.classList.add("container");
        
        this.#children = [];
        this.#weights = [];
        this.#dividers = [];
        this.#axis = "x";

        new ResizeObserver(() => this.format()).observe(this.elem);

        this.addHandler("add", () => this.children.forEach(child => child.onAdd()));
        this.addHandler("rem", () => this.children.forEach(child => child.onRem()));

        this.addHandler("update", delta => this.children.forEach(child => child.update(delta)));

        if (util.is(a, "arr")) a = { children: a };
        else if (util.is(a, "str")) a = { axis: a };

        a = util.ensure(a, "obj");
        this.children = a.children;
        this.weights = a.weights;
        this.axis = a.axis;
    }

    compute() {
        super.compute();
        try {
            this.children.forEach(child => child.compute());
        } catch (e) {}
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
        let weights = this.weights;
        v = util.ensure(v, "arr").map(v => Math.max(0, util.ensure(v, "num")));
        let wSum = 0;
        v.forEach(w => (wSum += w));
        if (v.length <= 0 || wSum <= 0)
            this.#weights = (this.children.length > 0) ? new Array(this.children.length).fill(1 / this.children.length) : [];
        else {
            let wAvg = wSum / v.length;
            while (v.length > this.children.length) v.pop();
            while (v.length < this.children.length) v.push(wAvg);
            wSum = 0;
            v.forEach(w => (wSum += w));
            this.#weights = (this.children.length > 0) ? v.map(w => w/wSum) : [];
        }
        this.change("weights", weights, this.weights);
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
        let weights = this.weights;
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
        child.addLinkedHandler(this, "change", (c, f, t) => this.change("children["+this.#children.indexOf(child)+"]."+c, f, t));
        this.change("addChild", null, child);
        this.change("weights", weights, this.weights);
        this.format();
        child.onAdd();
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
        child.onRem();
        let at = this.#children.indexOf(child);
        child.parent = null;
        this.elem.removeChild(child.elem);
        this.#children.splice(at, 1);
        let weights = this.weights;
        this.#weights.splice(at, 1);
        if (this.#children.length > 0) {
            let wSum = 0;
            this.#weights.forEach(w => (wSum += w));
            this.#weights = this.#weights.map(w => w/wSum);
        }
        child.clearLinkedHandlers(this, "change");
        this.change("remChild", child, null);
        this.change("weights", weights, this.weights);
        this.format();
        return child;
    }

    get axis() { return this.#axis; }
    set axis(v) {
        v = String(v).toLowerCase();
        if (!["x", "y"].includes(v)) return;
        if (this.axis == v) return;
        this.change("axis", this.axis, this.#axis=v);
        this.format();
    }

    contains(v) {
        if (v == this) return true;
        for (let child of this.children)
            if (child.contains(v))
                return true;
        return false;
    }

    format() {
        super.format();
        this.elem.classList.remove("x");
        this.elem.classList.remove("y");
        this.elem.classList.add(this.axis);
        let r = this.elem.getBoundingClientRect();
        let wAlloc = r.width - (this.axis == "x") * (2 * Math.max(0, this.children.length-1));
        let hAlloc = r.height - (this.axis == "y") * (2 * Math.max(0, this.children.length-1));
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
                if (e.button != 0) return;
                e.preventDefault();
                e.stopPropagation();
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
                    let weights = this.weights;
                    this.#weights[i] = p-mnBound;
                    this.#weights[i+1] = mxBound-p;
                    this.change("weights", weights, this.weights);
                    this.format();
                };
                elem.classList.add("this");
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
            });
            elem.addEventListener("contextmenu", e => {
                let itm;
                let menu = new core.Menu();
                itm = menu.addItem(new core.Menu.Item("Center Divider"));
                itm.addHandler("trigger", e => {
                    let i = divider.i;
                    let mnBound = 0, mxBound = 1;
                    for (let j = 0; j < i; j++) mnBound += this.#weights[j];
                    for (let j = this.#weights.length-1; j > i+1; j--) mxBound -= this.#weights[j];
                    let p = (mxBound+mnBound) / 2;
                    let weights = this.weights;
                    this.#weights[i] = p-mnBound;
                    this.#weights[i+1] = mxBound-p;
                    this.change("weights", weights, this.weights);
                    this.format();
                });
                itm = menu.addItem(new core.Menu.Item("Rotate", "refresh"));
                itm.addHandler("trigger", e => {
                    this.axis = (this.axis == "x") ? "y" : "x";
                });
                core.Menu.contextMenu = menu;
                core.Menu.placeContextMenu(e.pageX, e.pageY);
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
            if (this.hasPageParent()) this.parent.widget = null;
            else if (this.hasParent()) this.parent.remChild(this);
            return;
        }
        if (this.children.length <= 1) {
            let child = this.children[0];
            this.clearChildren();
            if (this.hasPageParent()) this.parent.widget = child;
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
        return util.Reviver.revivable(this.constructor, {
            children: this.children,
            weights: this.weights,
            axis: this.axis,
        });
    }
}

export class Panel extends Widget {
    #tabs;
    #tabIndex;

    #eOptions;
    #eTop;
    #eAdd;
    #eContent;

    static getTools() {
        return [
            { class: Panel.GraphTab },
            { class: Panel.TableTab },
            { class: Panel.Odometry2dTab },
            { class: Panel.Odometry3dTab },
            { class: Panel.ScoutTab },
            { class: Panel.VideoSyncTab },
            { class: Panel.LoggerTab, disabled: window.agent().public },
            { class: Panel.LogWorksTab },
            { class: Panel.WebViewTab },
        ];
    }

    constructor(a) {
        super(a);

        this.elem.classList.add("panel");
        this.elem.addEventListener("click", e => {
            this.page.activeWidget = this;
        }, { capture: true });

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

        this.addHandler("add", () => this.tabs.forEach(tab => tab.onAdd()));
        this.addHandler("rem", () => this.tabs.forEach(tab => tab.onRem()));

        this.eOptions.addEventListener("click", e => {
            e.stopPropagation();
            let itm;
            let menu = new core.Menu();
            itm = menu.addItem(new core.Menu.Item(this.isTitleCollapsed ? "Expand Title" : "Collapse Title", this.isTitleCollapsed ? "chevron-down" : "chevron-up"));
            itm.accelerator = "Ctrl+Shift+F";
            itm.addHandler("trigger", e => {
                this.isTitleCollapsed = !this.isTitleCollapsed;
            });
            itm = menu.addItem(new core.Menu.Item(this.isMaximized ? "Minimize" : "Maximize", this.isMaximized ? "contract" : "expand"));
            itm.accelerator = "Ctrl+Option+F";
            itm.addHandler("trigger", e => {
                this.isMaximized = !this.isMaximized;
            });
            menu.addItem(new core.Menu.Divider());
            itm = menu.addItem(new core.Menu.Item("Close"));
            itm.addHandler("trigger", e => {
                if (this.hasPageParent()) return this.parent.widget = null;
                if (this.hasParent()) return this.parent.remChild(this);
            });
            core.Menu.contextMenu = menu;
            let r = this.eOptions.getBoundingClientRect();
            core.Menu.placeContextMenu(r.left, r.bottom);
            menu.elem.style.minWidth = r.width+"px";
        });
        this.eAdd.addEventListener("click", e => {
            e.stopPropagation();
            this.addTab(new Panel.AddTab());
        });

        this.addHandler("update", delta => this.tabs.forEach(tab => tab.update(delta)));

        let isTitleCollapsed = null;
        new MutationObserver(() => {
            if (isTitleCollapsed != this.isTitleCollapsed)
                this.change("isTitleCollapsed", isTitleCollapsed, isTitleCollapsed=this.isTitleCollapsed);
        }).observe(this.elem, { attributes: true, attributeFilter: ["class"] });

        let isMaximized = null;
        new MutationObserver(() => {
            if (isMaximized != this.isMaximized)
                this.change("isMaximized", isMaximized, isMaximized=this.isMaximized);
        }).observe(this.elem, { attributes: true, attributeFilter: ["class"] });

        if (util.is(a, "arr")) a = { tabs: a };

        a = util.ensure(a, "obj");
        this.tabs = a.tabs;
        this.tabIndex = a.tabIndex;
        this.isTitleCollapsed = a.isTitleCollapsed;
        this.isMaximized = a.isMaximized;

        if (this.tabs.length <= 0) this.addTab(new Panel.AddTab());
    }

    compute() {
        super.compute();
        try {
            this.tabs.forEach(tab => tab.compute());
        } catch (e) {}
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
        this.change("tabIndex", this.tabIndex, this.#tabIndex=v);
        this.#tabs.forEach((tab, i) => (i == this.tabIndex) ? tab.open() : tab.close());
        this.format();
        if (this.tabs[this.tabIndex])
            this.eTop.scrollTo({ left: this.tabs[this.tabIndex].eTab.offsetLeft, behavior: "smooth" });
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
        tab.addLinkedHandler(this, "change", (c, f, t) => this.change("tabs["+this.#tabs.indexOf(tab)+"]."+c, f, t));
        this.change("addTab", null, tab);
        this.eTop.appendChild(tab.eTab);
        this.eContent.appendChild(tab.elem);
        this.tabIndex = this.#tabs.indexOf(tab);
        this.format();
        tab.onAdd();
        return tab;
    }
    remTab(tab) {
        if (!(tab instanceof Panel.Tab)) return false;
        if (!this.hasTab(tab)) return false;
        if (tab.parent != this) return false;
        tab.onRem();
        let activeTab = this.tabs[this.tabIndex];
        let at = this.#tabs.indexOf(tab);
        this.#tabs.splice(at, 1);
        tab.parent = null;
        tab.clearLinkedHandlers(this, "change");
        this.change("remTab", tab, null);
        this.eTop.removeChild(tab.eTab);
        this.eContent.removeChild(tab.elem);
        tab.close();
        this.format();
        at = this.#tabs.indexOf(activeTab);
        if (at >= 0) this.tabIndex = at;
        else {
            let index = this.tabIndex;
            this.#tabIndex = null;
            this.tabIndex = index;
        }
        return tab;
    }

    format() {
        super.format();
        this.tabs.forEach((tab, i) => {
            tab.eTab.style.order = i;
            tab.format();
        });
        this.eAdd.style.order = this.tabs.length;
    }
    collapse() {
        if (this.tabs.length > 0) return;
        if (this.hasPageParent()) this.parent.widget = null;
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
    get isMaximized() { return this.elem.classList.contains("maximized"); }
    set isMaximized(v) {
        v = !!v;
        if (this.isMaximized == v) return;
        if (v) this.elem.classList.add("maximized");
        else this.elem.classList.remove("maximized");
    }
    get isMinimized() { return !this.isMaximized; }
    set isMinimized(v) { this.isMaximized = !v; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            tabs: this.tabs,
            tabIndex: this.tabIndex,
            isTitleCollapsed: this.isTitleCollapsed,
            isMaximized: this.isMaximized,
        });
    }
}

Panel.Tab = PanelTab;
Panel.AddTab = PanelAddTab;
Panel.BrowserTab = PanelBrowserTab;
Panel.ToolTab = PanelToolTab;
Panel.TableTab = PanelTableTab;
Panel.WebViewTab = PanelWebViewTab;
Panel.ScoutTab = PanelScoutTab;
Panel.LoggerTab = PanelLoggerTab;
Panel.LogWorksTab = PanelLogWorksTab;
Panel.VideoSyncTab = PanelVideoSyncTab;
Panel.ToolCanvasTab = PanelToolCanvasTab;
Panel.GraphTab = PanelGraphTab;
Panel.OdometryTab = PanelOdometryTab;
Panel.Odometry2dTab = PanelOdometry2dTab;
Panel.Odometry3dTab = PanelOdometry3dTab;

PanelTab.registerPanel(Panel);
