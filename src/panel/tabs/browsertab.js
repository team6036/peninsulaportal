import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE, FieldExplorer } from "../../core.mjs";

import * as app from "../../app.mjs";

import Source from "../../sources/source.js";


import PanelTab from "./tab.js";


export default class PanelBrowserTab extends PanelTab {
    #path;

    #explorer;

    #ePath;
    #eShowToggle;
    #eDisplay;
    #eDisplayChange;

    static NAME = "Browser";
    static NICKNAME = "Browser";
    static ICON = null;
    static ICONSRC = null;

    constructor(a) {
        super(a);

        this.elem.classList.add("browser");

        this.#path = null;

        this.#explorer = new FieldExplorer();
        this.explorer.addHandler("change-showHidden", (f, t) => this.change("explorer.showHidden", f, t));
        this.explorer.addHandler("trigger2", (e, pth) => (this.path += "/"+pth));
        this.explorer.addHandler("contextmenu", (e, pth) => {
            e = util.ensure(e, "obj");
            let enode = this.explorer.lookup(pth);
            if (!enode) return;
            let itm;
            let menu = new core.Menu();
            itm = menu.addItem(new core.Menu.Item((enode.isJustPrimitive && enode.isOpen) ? "Close" : "Open"));
            itm.disabled = enode.isJustPrimitive;
            itm.addHandler("trigger", e => {
                enode.isOpen = !enode.isOpen;
            });
            itm = menu.addItem(new core.Menu.Item(enode.showValue ? "Hide Value" : "Show Value"));
            itm.disabled = !enode.hasType();
            itm.addHandler("trigger", e => {
                enode.showValue = !enode.showValue;
            });
            menu.addItem(new core.Menu.Divider());
            itm = menu.addItem(new core.Menu.Item("Start Dragging"));
            itm.addHandler("trigger", e => {
                enode.post("drag", e, enode.name);
            });
            core.Menu.contextMenu = menu;
            core.Menu.placeContextMenu(e.pageX, e.pageY);
        });
        this.explorer.addHandler("drag", (e, pth) => {
            pth = util.generatePath(this.path+"/"+pth);
            this.app.dragData = this.page.hasSource() ? this.page.source.tree.lookup(pth) : null;
            this.app.dragging = true;
        });

        this.#ePath = document.createElement("div");
        this.elem.appendChild(this.ePath);
        this.ePath.classList.add("path");
        this.#eShowToggle = document.createElement("button");
        this.eShowToggle.classList.add("icon");
        this.eShowToggle.innerHTML = "<ion-icon></ion-icon>";
        const update = () => {
            if (this.eShowToggle.children[0])
                this.eShowToggle.children[0].name = this.explorer.showHidden ? "eye" : "eye-off";
        };
        this.addHandler("change-explorer.showHidden", update);
        update();
        this.eShowToggle.addEventListener("click", e => {
            e.stopPropagation();
            this.explorer.showHidden = !this.explorer.showHidden;
        });
        this.elem.appendChild(this.explorer.elem);
        this.#eDisplay = document.createElement("div");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eDisplayChange = document.createElement("button");
        this.eDisplay.appendChild(this.eDisplayChange);
        this.eDisplayChange.innerHTML = "<ion-icon name='ellipsis-horizontal'></ion-icon>";
        this.eDisplayChange.addEventListener("click", e => {
            e.stopPropagation();
            let dType = this.type;
            let itm;
            let menu = new core.Menu();
            itm = menu.addItem(new core.Menu.Item("Default", (dType == null) ? "checkmark" : ""));
            itm.addHandler("trigger", e => {
                this.type = null;
            });
            menu.addItem(new core.Menu.Divider());
            ["raw", "bool", "range-meter", "range-h", "range-v"].forEach(k => {
                itm = menu.addItem(new core.Menu.Item({
                    raw: "Raw",
                    bool: "Boolean",
                    "range-meter": "Speedometer",
                    "range-h": "Horizontal Range",
                    "range-v": "Vertical Range",
                }[k], (dType == k) ? "checkmark" : ""));
                itm.addHandler("trigger", e => {
                    this.type = k;
                });
            });
            core.Menu.contextMenu = menu;
            e = util.ensure(e, "obj");
            core.Menu.placeContextMenu(e.pageX, e.pageY);
        });

        const displayInits = {
            raw: elem => {
                let eType = document.createElement("div");
                elem.appendChild(eType);
                eType.classList.add("type");
                let eValue = document.createElement("div");
                elem.appendChild(eValue);
                eValue.classList.add("value");
                return {
                    update: (node, value, display, typeData) => {
                        value = Source.Field.getRepresentation(value, node.field.type == "structschema");
                        eType.textContent = node.field.type;
                        eValue.style.color = (display == null) ? "" : util.ensure(display.color, "str");
                        eValue.style.fontSize = ((value.length < 25) ? 32 : 16)+"px";
                        eValue.textContent = value;
                    },
                };
            },
            bool: elem => {
                let eIcon = document.createElement("ion-icon");
                elem.appendChild(eIcon);
                new ResizeObserver(() => {
                    let r = elem.getBoundingClientRect();
                    eIcon.style.fontSize = Math.max(16, Math.min(64, r.width-40, r.height-40))+"px";
                }).observe(elem);
                return {
                    update: (node, value, display, typeData) => {
                        elem.style.backgroundColor = value ? "var(--cg2)" : "var(--cr2)";
                        eIcon.name = value ? "checkmark" : "close-outline";
                    },
                };
            },
            "range-meter": elem => {
                elem.classList.add("range");
                let eContent = document.createElement("div");
                elem.appendChild(eContent);
                eContent.classList.add("content");
                let eRange = document.createElement("div");
                eContent.appendChild(eRange);
                eRange.classList.add("range");
                let eValue = document.createElement("div");
                eContent.appendChild(eValue);
                eValue.classList.add("value");
                let eValueDisplay = document.createElement("div");
                eValue.appendChild(eValueDisplay);
                eValueDisplay.classList.add("display");
                let eValueReal = document.createElement("div");
                eValue.appendChild(eValueReal);
                eValueReal.classList.add("real");
                let mn = 0, mx = 0;
                let eMin = document.createElement("input");
                eContent.appendChild(eMin);
                eMin.classList.add("min");
                eMin.addEventListener("change", e => {
                    let mn = Math.min(mx, util.ensure(parseFloat(eMin.value), "num"));
                    let typeData = this.typeData;
                    typeData.min = mn;
                    this.typeData = typeData;
                });
                let eMax = document.createElement("input");
                eContent.appendChild(eMax);
                eMax.classList.add("max");
                eMax.addEventListener("change", e => {
                    let mx = Math.max(mn, util.ensure(parseFloat(eMax.value), "num"));
                    let typeData = this.typeData;
                    typeData.max = mx;
                    this.typeData = typeData;
                });
                new ResizeObserver(() => {
                    let r = elem.getBoundingClientRect();
                    eContent.style.setProperty("--size", Math.min(r.width-40, r.height-40)+"px");
                }).observe(elem);
                return {
                    update: (node, value, display, typeData) => {
                        value = util.ensure(+value, "num");
                        mn = util.ensure(typeData.min, "num", 0);
                        if (document.activeElement != eMin) eMin.value = mn;
                        mx = util.ensure(typeData.max, "num", node.field.type == "boolean" ? 1 : 100);
                        if (document.activeElement != eMax) eMax.value = mx;
                        eRange.style.setProperty("--value", Math.min(1, Math.max(0, (value-mn)/(mx-mn))));
                        eRange.style.setProperty("--color", (display == null) ? "" : util.ensure(display.color, "str"));
                        eValueDisplay.textContent = Math.round(value*100000)/100000;
                        eValueReal.textContent = value;
                    },
                };
            },
            "_range": elem => {
                elem.classList.add("range");
                let eContent = document.createElement("div");
                elem.appendChild(eContent);
                eContent.classList.add("content");
                let eValue = document.createElement("div");
                eContent.appendChild(eValue);
                eValue.classList.add("value");
                let eValueDisplay = document.createElement("div");
                eValue.appendChild(eValueDisplay);
                eValueDisplay.classList.add("display");
                let eValueReal = document.createElement("div");
                eValue.appendChild(eValueReal);
                eValueReal.classList.add("real");
                let eRange = document.createElement("div");
                eContent.appendChild(eRange);
                eRange.classList.add("range");
                let eMinMax = document.createElement("div");
                eContent.appendChild(eMinMax);
                eMinMax.classList.add("minmax");
                let mn = 0, mx = 0;
                let eMin = document.createElement("input");
                eMinMax.appendChild(eMin);
                eMin.classList.add("min");
                eMin.addEventListener("change", e => {
                    let mn = Math.min(mx, util.ensure(parseFloat(eMin.value), "num"));
                    let typeData = this.typeData;
                    typeData.min = mn;
                    this.typeData = typeData;
                });
                let eMax = document.createElement("input");
                eMinMax.appendChild(eMax);
                eMax.classList.add("max");
                eMax.addEventListener("change", e => {
                    let mx = Math.max(mn, util.ensure(parseFloat(eMax.value), "num"));
                    let typeData = this.typeData;
                    typeData.max = mx;
                    this.typeData = typeData;
                });
                return {
                    update: (node, value, display, typeData) => {
                        value = util.ensure(+value, "num");
                        mn = util.ensure(typeData.min, "num", 0);
                        if (document.activeElement != eMin) eMin.value = mn;
                        mx = util.ensure(typeData.max, "num", 100);
                        if (document.activeElement != eMax) eMax.value = mx;
                        eRange.style.setProperty("--value", Math.min(1, Math.max(0, (value-mn)/(mx-mn))));
                        eRange.style.setProperty("--color", (display == null) ? "" : util.ensure(display.color, "str"));
                        eValueDisplay.textContent = Math.round(value*100000)/100000;
                        eValueReal.textContent = value;
                    },
                };
            },
            "range-h": elem => displayInits["_range"](elem),
            "range-v": elem => {
                let r = displayInits["_range"](elem);
                let eContent = elem.querySelector(":scope > .content");
                let eRange = eContent.querySelector(":scope > .range");
                let eMinMax = eContent.querySelector(":scope > .minmax");
                let eMin = eMinMax.querySelector(":scope > input.min");
                let eMax = eMinMax.querySelector(":scope > input.max");
                eMin.remove();
                eMax.remove();
                eContent.appendChild(eMax);
                eContent.insertBefore(eMin, eRange);
                return r;
            },
        };
        const displays = {};
        for (let k in displayInits) {
            let elem = document.createElement("div");
            this.eDisplay.insertBefore(elem, this.eDisplayChange);
            elem.classList.add("item");
            elem.classList.add(k);
            displays[k] = util.ensure(displayInits[k](elem), "obj");
            displays[k].elem = elem;
            displays[k].update = util.ensure(displays[k].update, "func");
        }

        let prevNode = 0;
        let prevDType = null;

        this.addHandler("update", delta => {
            const source = this.page.source;
            const node = source ? source.tree.lookup(this.path) : null;
            if (prevNode != node) {
                prevNode = node;
                this.name = node ? (node.name.length > 0) ? node.name : "/" : "?";
                if (node) {
                    if (!node.hasField() || (node.field.type == "json") || node.field.isArray || node.field.isStruct) {
                        this.explorer.elem.classList.add("this");
                        this.eDisplay.classList.remove("this");
                    } else {
                        this.explorer.elem.classList.remove("this");
                        this.eDisplay.classList.add("this");
                    }
                    this.eTabName.style.color = "";
                } else {
                    this.explorer.elem.classList.remove("this");
                    this.eDisplay.classList.remove("this");
                    this.icon = "document-outline";
                    let pth = this.path.split("/").filter(part => part.length > 0);
                    this.name = (pth.length > 0) ? pth.at(-1) : "/";
                    this.eTabName.style.color = "var(--cr)";
                    this.iconColor = "var(--cr)";
                }
            }
            if (!node) return;
            let value = (node && node.hasField()) ? node.field.get() : null;
            let display = Source.Field.getDisplay(node);
            if (display != null) {
                if ("src" in display) this.iconSrc = display.src;
                else this.icon = display.name;
                if ("color" in display) this.iconColor = display.color;
                else this.iconColor = "";
            } else {
                this.icon = "";
                this.iconColor = "";
            }
            if (this.isClosed) return;
            if (!node.hasField() || (node.field.type == "json") || node.field.isArray || node.field.isStruct) {
                FieldExplorer.Node.doubleTraverse(
                    node.nodeObjects,
                    this.explorer.nodeObjects,
                    (...enodes) => this.explorer.add(...enodes),
                    (...enodes) => this.explorer.rem(...enodes),
                );
            } else {
                let dType = this.type, dTypeData = this.typeData;
                if (dType == null) dType = (node.field.type == "boolean") ? "bool" : "raw";
                if (prevDType != dType) {
                    if (prevDType in displays) displays[prevDType].elem.classList.remove("this");
                    prevDType = dType;
                    if (prevDType in displays) displays[prevDType].elem.classList.add("this");
                }
                if (dType in displays) displays[dType].update(node, value, display, dTypeData);
            }
        });

        if (util.is(a, "str")) a = { path: a };
        
        a = util.ensure(a, "obj");
        this.path = a.path;
        this.explorer.showHidden = a.explorer ? a.explorer.showHidden : a.showHidden;
    }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.ePath.innerHTML = "";
        this.ePath.appendChild(this.eShowToggle);
        let pth = this.path.split("/").filter(part => part.length > 0);
        if (pth.length > 0) {
            let btn = document.createElement("button");
            this.ePath.appendChild(btn);
            btn.classList.add("icon");
            btn.innerHTML = "<ion-icon name='chevron-back'></ion-icon>";
            btn.addEventListener("click", e => {
                e.stopPropagation();
                pth.pop();
                this.path = pth.join("/");
            });
        }
        for (let i = 0; i <= pth.length; i++) {
            if (i > 1) {
                let divider = document.createElement("div");
                this.ePath.appendChild(divider);
                divider.classList.add("divider");
                divider.textContent = "/";
            }
            let pth2 = pth.slice(0, i);
            let btn = document.createElement("button");
            this.ePath.appendChild(btn);
            btn.classList.add("item");
            btn.classList.add("override");
            btn.textContent = (i > 0) ? pth[i-1] : "/";
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.path = pth2.join("/");
            });
        }
    }

    get explorer() { return this.#explorer; }

    get type() {
        if (!this.page.hasProject()) return null;
        const k = "browsertab:"+this.path;
        if (!this.page.project.hasProfile(k)) return null;
        let v = this.page.project.getProfile(k).value;
        if (v == null) return null;
        return String(v);
    }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (!this.page.hasProject()) return;
        const k = "browsertab:"+this.path;
        if (v == null) {
            this.page.project.remProfile(k);
            return this.change("type", this.type, v);
        }
        if (!this.page.project.hasProfile(k))
            this.page.project.addProfile(new this.page.project.constructor.Profile(k));
        [v, this.page.project.getProfile(k).value] = [this.page.project.getProfile(k).value, v];
        this.change("type", v, this.type);
    }
    get typeData() {
        if (!this.page.hasProject()) return {};
        const k = "browsertab:"+this.path+":data";
        if (!this.page.project.hasProfile(k)) return {};
        return util.ensure(this.page.project.getProfile(k).value, "obj");
    }
    set typeData(v) {
        v = util.ensure(v, "obj");
        if (!this.page.hasProject()) return;
        const k = "browsertab:"+this.path+":data";
        if (!this.page.project.hasProfile(k))
            this.page.project.addProfile(new this.page.project.constructor.Profile(k));
        [v, this.page.project.getProfile(k).value] = [this.page.project.getProfile(k).value, v];
        this.change("typeData", v, this.typeData);
    }

    get ePath() { return this.#ePath; }
    get eShowToggle() { return this.#eShowToggle; }
    get eDisplay() { return this.#eDisplay; }
    get eDisplayChange() { return this.#eDisplayChange; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            showHidden: this.explorer.showHidden,
        });
    }
}
