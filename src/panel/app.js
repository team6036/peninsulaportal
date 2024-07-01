import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE, FieldExplorer } from "../core.mjs";

import * as app from "../app.mjs";

import Source from "../sources/source.js";
import HistoricalSource from "../sources/historical-source.js";
import NTSource from "../sources/nt4/source.js";
import WPILOGSource from "../sources/wpilog/source.js";
import CSVTimeSource from "../sources/csv/time/source.js";
import CSVFieldSource from "../sources/csv/field/source.js";
import DSSource from "../sources/ds/source.js";


import { Widget, Container, Panel } from "./widgets.js";
import { LOGGERCONTEXT } from "./tabs/loggertab.js";


class ToolButton extends util.Target {
    #tabClass;

    #elem;
    #eIcon;
    #eName;

    constructor(tabClass) {
        super();

        if (!util.is(tabClass, "func")) throw new Error("Tab Class is not a constructor");
        if (!(tabClass.prototype instanceof Panel.Tab)) throw new Error("Tab Class is not of child class Tab");
        this.#tabClass = tabClass;

        this.#elem = document.createElement("button");
        this.elem.classList.add("item");
        this.elem.classList.add("light");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);

        let cancel = 10;
        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            this.post("trigger", e);
        });
        this.elem.addEventListener("contextmenu", e => {
            this.post("contextmenu", e);
        });
        this.elem.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                if (cancel > 0) return cancel--;
                mouseup();
                this.post("drag", e);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.name = this.tabClass.NICKNAME;

        if (this.tabClass.ICONSRC) this.iconSrc = this.tabClass.ICONSRC;
        else this.icon = this.tabClass.ICON;
        if (this.tabClass.ICONCOLOR) this.iconColor = this.tabClass.ICONCOLOR;
        else this.iconColor = "";

        this.addHandler("trigger", () => {
            if (this.elem.disabled) return;
            if (!this.app.hasActivePanel()) return;
            const active = this.app.activeWidget;
            active.addTab(new this.tabClass(), active.tabIndex+1);
        });
        this.addHandler("contextmenu", e => {
            if (this.elem.disabled) return;
            let itm;
            let menu = new core.Menu();
            itm = menu.addItem(new core.Menu.Item("Open"));
            itm.addHandler("trigger", e => {
                this.post("trigger", e);
            });
            itm = menu.addItem(new core.Menu.Item("Start Dragging"));
            itm.addHandler("trigger", e => {
                this.post("drag", e);
            });
            core.Menu.contextMenu = menu;
            core.Menu.placeContextMenu(e.pageX, e.pageY);
        });
        this.addHandler("drag", () => {
            if (this.elem.disabled) return;
            this.app.dragData = new this.tabClass();
            this.app.dragging = true;
        });
    }

    get app() { return app.App.instance; }
    get page() { return this.app.projectPage; }
    
    get tabClass() { return this.#tabClass; }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }

    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
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

class Project extends lib.Project {
    #widgetData;
    #profiles;
    #sidePos;
    #sideSectionPos;

    constructor(a) {
        super(a);

        this.#widgetData = "";
        this.#profiles = {};
        this.#sidePos = 0.15;
        this.#sideSectionPos = {};

        a = util.ensure(a, "obj");
        this.widgetData = a.widgetData;
        this.profiles = a.profiles;
        this.sidePos = a.sidePos;
        this.sideSectionPos = a.sideSectionPos || { source: 0, browser: 1, tools: 0 };
    }

    get widgetData() { return this.#widgetData; }
    set widgetData(v) {
        v = String(v);
        if (this.widgetData == v) return;
        this.change("widgetData", this.widgetData, this.#widgetData=v);
    }

    get profileKeys() { return Object.keys(this.#profiles); }
    get profileObjects() { return Object.values(this.#profiles); }
    get profiles() {
        let profiles = {};
        this.profileKeys.forEach(k => (profiles[k] = this.getProfile(k)));
        return profiles;
    }
    set profiles(v) {
        this.clearProfiles();
        if (util.is(v, "arr"))
            return this.addProfile(v);
        v = util.ensure(v, "obj");
        for (let k in v) {
            if (!(v[k] instanceof Project.Profile)) continue;
            v[k].key = k;
            this.addProfile(v[k]);
        }
    }
    clearProfiles() {
        let profiles = this.profiles;
        this.remProfile(Object.values(profiles));
        return profiles;
    }
    hasProfile(k) {
        if (k instanceof Project.Profile) return this.hasProfile(k.key);
        return String(k) in this.#profiles;
    }
    getProfile(k) {
        k = String(k);
        if (!this.hasProfile(k)) return null;
        return this.#profiles[k];
    }
    addProfile(...profiles) {
        return util.Target.resultingForEach(profiles, profile => {
            if (!(profile instanceof Project.Profile)) return false;
            if (this.hasProfile(profile)) return false;
            while (profile.key == null || this.hasProfile(profile.key))
                profile.key = util.jargonBase64(10);
            this.#profiles[profile.key] = profile;
            profile.addLinkedHandler(this, "change", (c, f, t) => this.change("getProfile("+profile.key+")."+c, f, t));
            this.change("addProfile", null, profile);
            profile.onAdd();
            return profile;
        });
    }
    remProfile(...ks) {
        return util.Target.resultingForEach(ks, k => {
            if (k instanceof Project.Profile) k = k.key;
            if (!this.hasProfile(k)) return false;
            let profile = this.getProfile(k);
            profile.onRem();
            profile.clearLinkedHandlers(this, "change");
            delete this.#profiles[k];
            this.change("remProfile", profile, null);
            return profile;
        });
    }

    get sidePos() { return this.#sidePos; }
    set sidePos(v) {
        v = Math.min(1, Math.max(-1, util.ensure(v, "num", 0.15)));
        if (this.sidePos == v) return;
        this.change("sidePos", this.sidePos, this.#sidePos=v);
    }
    get isCollapsed() { return this.sidePos < 0; }
    set isCollapsed(v) {
        v = !!v;
        if (this.isCollapsed == v) return;
        this.sidePos = v ? -Math.abs(this.sidePos) : Math.abs(this.sidePos);
    }
    collapse() { return this.isCollapsed = true; }
    uncollapse() { return this.isCollapsed = false; }
    
    get sideSectionPos() {
        let sideSectionPos = {};
        for (let k in this.#sideSectionPos)
            sideSectionPos[k] = this.#sideSectionPos[k];
        return sideSectionPos;
    }
    set sideSectionPos(v) {
        v = util.ensure(v, "obj");
        this.clearSideSectionPos();
        for (let k in v) this.setSideSectionPos(k, v[k], false);
        this.fixSideSectionPos();
    }
    clearSideSectionPos() {
        let sideSectionPos = this.sideSectionPos;
        for (let k in sideSectionPos) this.delSideSectionPos(k);
        return sideSectionPos;
    }
    hasSideSectionPos(k) { return String(k) in this.#sideSectionPos; }
    getSideSectionPos(k) {
        if (!this.hasSideSectionPos(k)) return null;
        return this.#sideSectionPos[k];
    }
    setSideSectionPos(k, v, fix=true) {
        let v2 = this.getSideSectionPos(k);
        k = String(k);
        if (!["source", "browser", "tools"].includes(k)) return v2;
        this.#sideSectionPos[k] = Math.max(0, util.ensure(v, "num"));
        v = this.getSideSectionPos(k);
        if (fix) this.fixSideSectionPos();
        this.change("setSideSectionPos", v, v2);
        return v2;
    }
    delSideSectionPos(k, fix=true) {
        if (!this.hasSideSectionPos(k)) return null;
        let v = this.getSideSectionPos(k);
        k = String(k);
        delete this.#sideSectionPos[k];
        if (fix) this.fixSideSectionPos();
        this.change("delSideSectionPos", v, null);
        return v;
    }
    fixSideSectionPos(force=false) {
        let sideSectionPos = this.sideSectionPos;
        let n = Object.keys(sideSectionPos).length;
        if (n <= 0) return;
        let sum = 0;
        for (let k in sideSectionPos) sum += sideSectionPos[k];
        if (sum <= (force ? 0 : 1)) return;
        for (let k in sideSectionPos)
            this.#sideSectionPos[k] /= sum;
        this.change("fixSideSectionPos", null, this.sideSectionPos);
    }

    buildWidget() {
        try {
            let widget = JSON.parse(this.widgetData, util.REVIVER.f);
            if (!(widget instanceof Widget)) throw widget;
            return widget;
        } catch (e) { console.error(e); }
        this.widgetData = JSON.stringify(new Panel());
        return this.buildWidget();
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            id: this.id,
            widgetData: this.widgetData,
            profiles: this.profiles,
            sidePos: this.sidePos,
            sideSectionPos: this.sideSectionPos,
            config: this.config, meta: this.meta,
        });
    }
}
Project.Config = class ProjectConfig extends Project.Config {
    #sources;
    #sourceType;

    constructor(a) {
        super(a);

        this.#sources = {};
        this.#sourceType = "";

        a = util.ensure(a, "obj");
        this.sources = a.sources;
        this.sourceType = a.sourceType || "wpilog";
    }

    get sourceTypes() { return Object.keys(this.#sources); }
    get sourceValues() { return Object.values(this.#sources); }
    get sources() {
        let sources = {};
        this.sourceTypes.forEach(type => (sources[type] = this.getSource(type)));
        return sources;
    }
    set sources(v) {
        v = util.ensure(v, "obj");
        this.clearSources();
        for (let type in v) this.setSource(type, v[type]);
    }
    clearSources() {
        let sources = this.sources;
        for (let type in sources) this.delSource(type);
        return sources;
    }
    hasSource(type) {
        return String(type) in this.#sources;
    }
    getSource(type) {
        if (!this.hasSource(type)) return null;
        return this.#sources[String(type)];
    }
    setSource(type, v) {
        type = String(type);
        v = (v == null) ? null : String(v);
        if (this.hasSource(type))
            if (this.getSource(type) == v)
                return this.getSource(type);
        this.change("setSource", this.getSource(type), this.#sources[type]=v);
        return v;
    }
    delSource(type) {
        type = String(type);
        if (!this.hasSource(type)) return null;
        let v = this.getSource(type);
        delete this.#sources[type];
        this.change("delSource", v, null);
        return v;
    }
    get source() { return this.getSource(this.sourceType); }
    set source(v) {
        v = (v == null) ? null : String(v);
        if (this.source == v) return;
        this.setSource(this.sourceType, v);
    }
    get sourceType() { return this.#sourceType; }
    set sourceType(v) {
        v = String(v).toLowerCase();
        if (this.sourceType == v) return;
        this.change("sourceType", this.sourceType, this.#sourceType=v);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            sources: this.sources,
            sourceType: this.sourceType,
        });
    }
};
Project.Profile = class ProjectProfile extends util.Target {
    #key;
    #value;

    constructor(...a) {
        super();

        this.#key = null;
        this.#value = null;

        if (a.length <= 0 || a.length > 2) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Profile) a = [a.key, a.value];
            else if (util.is(a, "arr")) {
                a = new Project.Profile(...a);
                a = [a.key, a.value];
            }
            else if (util.is(a, "obj")) a = [a.key, a.value];
            else a = [a, null];
        }
        
        [this.key, this.value] = a;
    }

    get key() { return this.#key; }
    set key(v) { this.#key = (v == null) ? null : String(v); }

    get value() { return this.#value; }
    set value(v) {
        if (util.is(this.value, "arr") && util.is(v, "arr"))
            if (util.equals(this.value, v))
                return;
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            key: this.key,
            value: this.value,
        });
    }
};

util.REVIVER.addRuleAndAllSub(Container, Panel, Project);

export default class App extends app.AppFeature {
    #eBlock;

    #eProjectInfoSourceTypes;
    #eProjectInfoSourceInput;
    #eProjectInfoActionBtn;

    static PROJECTCLASS = Project;

    constructor() {
        super();

        this.#eProjectInfoSourceTypes = {};

        this.addHandler("pre-post-setup", () => {
            ["file", "edit", "view"].forEach(name => {
                let id = "menu:"+name;
                let menu = this.menu.getItemById(id);
                let namefs = {
                    file: () => {
                        let itms = [
                            { id: "newtab", label: "New Tab", accelerator: "CmdOrCtrl+T" },
                            "separator",
                            { id: "nexttab", label: "Next Tab", accelerator: "CmdOrCtrl+]" },
                            { id: "prevtab", label: "Previous Tab", accelerator: "CmdOrCtrl+[" },
                            { id: "closetab", label: "Close Tab", accelerator: "CmdOrCtrl+W" },
                        ];
                        itms = itms.map((data, i) => {
                            let itm = core.Menu.Item.fromObj(data);
                            if (util.is(data, "obj")) {
                                if (!("click" in data)) data.click = () => this.post("cmd-"+data.id);
                                itm.addHandler("trigger", e => data.click());
                            }
                            return itm;
                        });
                        menu.menu.insertItem(itms.pop(), 12);
                        menu.menu.insertItem(itms.pop(), 4);
                        menu.menu.insertItem(itms.pop(), 4);
                        menu.menu.insertItem(itms.pop(), 4);
                        menu.menu.insertItem(itms.pop(), 4);
                    },
                    edit: () => {
                        let itms = [
                            { id: "action", label: "?", accelerator: "CmdOrCtrl+K" },
                            {
                                id: "source", label: "Select Source...", click: () => {},
                                submenu: ["nt", "wpilog", "csv-time", "csv-field", "ds"].map((name, i) => {
                                    return {
                                        id: "source:"+name,
                                        label: {
                                            nt: "NT4",
                                            wpilog: "WPILOG",
                                            "csv-time": "CSV-Time",
                                            "csv-field": "CSV-Field",
                                            ds: "DS",
                                        }[name],
                                        accelerator: "Ctrl+Shift+"+(i+1),
                                        type: "radio",
                                        click: () => {
                                            const page = this.projectPage;
                                            if (!page.hasProject()) return;
                                            page.project.config.sourceType = name;
                                        },
                                    };
                                }),
                            },
                            "separator",
                        ];
                        itms.forEach((data, i) => {
                            let itm = core.Menu.Item.fromObj(data);
                            if (util.is(data, "obj")) {
                                if (!("click" in data)) data.click = () => this.post("cmd-"+data.id);
                                itm.addHandler("trigger", e => data.click());
                            }
                            menu.menu.insertItem(itm, 0+i);
                        });
                    },
                    view: () => {
                        let itms = [
                            { id: "openclose", label: "Toggle Options", accelerator: "Ctrl+O" },
                            { id: "expandcollapse", label: "Toggle Titlebar", accelerator: "Ctrl+F" },
                            { id: "minmax", label: "Toggle Maximized", accelerator: "Ctrl+Shift+F" },
                            { id: "resetdivider", label: "Reset Divider" },
                            { id: "toggleside", label: "Toggle Side", accelerator: "Ctrl+S" },
                            "separator",
                        ];
                        itms.forEach((data, i) => {
                            let itm = core.Menu.Item.fromObj(data);
                            if (util.is(data, "obj")) {
                                if (!("click" in data)) data.click = () => this.post("cmd-"+data.id);
                                itm.addHandler("trigger", e => data.click());
                            }
                            menu.menu.insertItem(itm, 0+i);
                        });
                    },
                };
                if (name in namefs) namefs[name]();
            });

            let eNav;

            eNav = document.createElement("div");
            this.eProjectInfoContent.appendChild(eNav);
            eNav.classList.add("nav");
            eNav.classList.add("source");
            ["nt", "wpilog", "csv-time", "csv-field", "ds"].forEach(name => {
                let btn = document.createElement("button");
                eNav.appendChild(this.#eProjectInfoSourceTypes[name] = btn);
                btn.textContent = {
                    nt: "NT4",
                    wpilog: "WPILOG",
                    "csv-time": "CSV-Time",
                    "csv-field": "CSV-Field",
                    ds: "DS",
                }[name];
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.post("cmd-source-type", name);
                });
            });

            this.#eProjectInfoSourceInput = document.createElement("input");
            this.eProjectInfoContent.appendChild(this.eProjectInfoSourceInput);
            this.eProjectInfoSourceInput.type = "text";
            this.eProjectInfoSourceInput.autocomplete = "off";
            this.eProjectInfoSourceInput.spellcheck = false;

            eNav = document.createElement("div");
            this.eProjectInfoContent.appendChild(eNav);
            eNav.classList.add("nav");
            this.#eProjectInfoActionBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoActionBtn);
            this.eProjectInfoActionBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("cmd-action");
            });

            this.#eBlock = document.getElementById("block");

            const getHovered = (widget, pos, options) => {
                options = util.ensure(options, "obj");
                let canSub = ("canSub" in options) ? options.canSub : true;
                let canTop = ("canTop" in options) ? options.canTop : true;
                const page = this.projectPage;
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
                if (o instanceof Source.Node) return true;
                if (o instanceof Widget) return true;
                if (o instanceof Panel.Tab) return true;
                return false;
            };
            const canGetWidgetFromData = () => {
                if (this.dragData instanceof Source.Node) return true;
                if (this.dragData instanceof Widget) return true;
                if (this.dragData instanceof Panel.Tab) return true;
                return false;
            };
            const getWidgetFromData = () => {
                if (this.dragData instanceof Source.Node) return new Panel([new Panel.BrowserTab(this.dragData.path)]);
                if (this.dragData instanceof Widget) return this.dragData;
                if (this.dragData instanceof Panel.Tab) return new Panel([this.dragData]);
                return null;
            };
            const canGetTabFromData = () => {
                if (this.dragData instanceof Source.Node) return true;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return true;
                return false;
            };
            const getTabFromData = () => {
                if (this.dragData instanceof Source.Node) return new Panel.BrowserTab(this.dragData.path);
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return this.dragData;
                return null;
            };
            const canGetNodeFromData = () => {
                if (this.dragData instanceof Source.Node) return true;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) {
                    if (!(this.dragData instanceof Panel.BrowserTab)) return false;
                    const page = this.projectPage;
                    if (!page.hasSource()) return false;
                    if (!(page.source.tree.lookup(this.dragData.path) instanceof Source.Node)) return false;
                    return true;
                }
                return false;
            };
            const getNodeFromData = () => {
                if (this.dragData instanceof Source.Node) return this.dragData;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) {
                    if (!(this.dragData instanceof Panel.BrowserTab)) return null;
                    const page = this.projectPage;
                    if (!page.hasSource()) return null;
                    return page.source.tree.lookup(this.dragData.path);
                }
                return null;
            };
            this.addHandler("drag-start", () => {
                if (this.page != "PROJECT") return;
                if (!isValid(this.dragData)) return;
                let canWidget = canGetWidgetFromData();
                let canTab = canGetTabFromData();
                let canNode = canGetNodeFromData();
                if (canNode) {
                    let node = getNodeFromData();
                    this.eDrag.innerHTML = "<div class='explorernode'><button class='display'><div class='main'><ion-icon></ion-icon><div class='name'></div></div></button></div>";
                    let btn = this.eDrag.children[0].children[0].children[0];
                    let icon = btn.children[0], name = btn.children[1];
                    name.textContent = (node.name.length > 0) ? node.name : "/";
                    let display = Source.Field.getDisplay(node);
                    if (display != null) {
                        if ("src" in display) icon.setAttribute("src", display.src);
                        else icon.name = display.name;
                        if ("color" in display) icon.style.color = display.color;
                        else icon.style.color = "";
                    } else {
                        icon.name = "";
                        icon.style.color = "";
                    }
                    return;
                }
                if (canTab) {
                    if (this.dragData instanceof Panel.Tab) {
                        this.eDrag.innerHTML = "<div class='explorernode'><button class='display'><div class='main'><ion-icon></ion-icon><div class='name'></div></div></button></div>";
                        let btn = this.eDrag.children[0].children[0].children[0];
                        let icon = btn.children[0], name = btn.children[1];
                        name.textContent = this.dragData.name;
                        if (this.dragData.hasIcon) {
                            if (this.dragData.eTabIcon.hasAttribute("src")) icon.setAttribute("src", this.dragData.eTabIcon.getAttribute("src"));
                            else icon.name = this.dragData.eTabIcon.name;
                            icon.style.cssText = this.dragData.eTabIcon.style.cssText;
                        } else icon.style.display = "none";
                    }
                }
            });
            this.addHandler("drag-move", e => {
                if (this.page != "PROJECT") return;
                const page = this.projectPage;
                if (!isValid(this.dragData)) return;
                if (!page.hasWidget()) {
                    this.showBlock();
                    this.placeBlock(page.eContent.getBoundingClientRect());
                    return;
                }
                const hovered = getHovered(
                    page.widget, new V(e.pageX, e.pageY),
                    {
                        canSub: true,
                        canTop: canGetTabFromData(),
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
                    this.eBlock.classList.remove("round");
                } else if (util.is(at, "int")) {
                    let r = new util.Rect(hovered.widget.eTop.getBoundingClientRect());
                    let x = (at >= hovered.widget.tabs.length) ? hovered.widget.getTab(hovered.widget.tabs.length-1).eTab.getBoundingClientRect().right : hovered.widget.getTab(at).eTab.getBoundingClientRect().left;
                    this.placeBlock(new util.Rect(x, r.y+5, 0, r.h-10));
                    this.eBlock.classList.remove("round");
                } else if (at == "custom") {
                    let data = util.ensure(hovered.data, "obj");
                    this.placeBlock(new util.Rect(data.r));
                    if (data.round) this.eBlock.classList.add("round");
                    else this.eBlock.classList.remove("round");
                }
            });
            this.addHandler("drag-submit", e => {
                if (this.page != "PROJECT") return;
                const page = this.projectPage;
                if (!isValid(this.dragData)) return;
                this.hideBlock();
                let canWidget = canGetWidgetFromData();
                let canTab = canGetTabFromData();
                if (!page.hasWidget()) {
                    page.widget = getWidgetFromData();
                    return;
                }
                const hovered = getHovered(
                    page.widget, new V(e.pageX, e.pageY),
                    {
                        canSub: true,
                        canTop: canTab,
                    },
                );
                if (!util.is(hovered, "obj") || !(hovered.widget instanceof Panel)) return;
                let at = hovered.at;
                if (["+x", "-x", "+y", "-y"].includes(at) && canWidget) {
                    let widget = getWidgetFromData();
                    let container = new Container();
                    container.axis = at[1];
                    if (hovered.widget == page.widget) {
                        page.widget = null;
                        container.addChild((at[0] == "+") ? hovered.widget : widget);
                        container.addChild((at[0] != "+") ? hovered.widget : widget);
                        page.widget = container;
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
                page.widget.collapse();
            });
        });
    }

    get eProjectInfoSourceTypes() { return Object.keys(this.#eProjectInfoSourceTypes); }
    hasEProjectInfoSourceType(type) { return type in this.#eProjectInfoSourceTypes; }
    getEProjectInfoSourceType(type) { return this.#eProjectInfoSourceTypes[type]; }
    get eProjectInfoSourceInput() { return this.#eProjectInfoSourceInput; }
    get eProjectInfoActionBtn() { return this.#eProjectInfoActionBtn; }
    
    get eBlock() { return this.#eBlock; }
    hasEBlock() { return this.eBlock instanceof HTMLDivElement; }
    get isBlockShown() { return this.hasEBlock() ? this.eBlock.classList.contains("this") : null; }
    set isBlockShown(v) {
        if (!this.hasEBlock()) return;
        v = !!v;
        if (this.isBlockShown == v) return;
        if (v) this.eBlock.classList.add("this")
        else this.eBlock.classList.remove("this");
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
        this.eBlock.style.width = Math.max(0, r.w)+"px";
        this.eBlock.style.height = Math.max(0, r.h)+"px";
    }
}
App.TitlePage = class AppTitlePage extends App.TitlePage {
    static DESCRIPTION = "The tool for debugging WPILOG and network tables";
};
App.ProjectPage = class AppProjectPage extends App.ProjectPage {
    #explorer;
    #metaExplorer;

    #toolButtons;
    #widget;
    #activeWidget;
    #source;

    #eNavPreInfo;
    #eSide;
    #eSideSections;
    #eContent;
    #eDivider;
    
    constructor() {
        super();

        this.addHandler("add", () => {
            this.app.eProjectInfoNameInput.addEventListener("change", e => {
                if (this.choosing) return;
                if (!this.hasProject()) return;
                this.project.meta.name = this.app.eProjectInfoNameInput.value;
            });
            this.app.eProjectInfoSourceInput.addEventListener("change", e => {
                this.project.config.source = this.app.eProjectInfoSourceInput.value;
            });
            this.app.addHandler("cmd-newtab", () => {
                if (!this.hasActivePanel()) return;
                const active = this.activeWidget;
                active.addTab(new Panel.AddTab(), active.tabIndex+1);
            });
            this.app.addHandler("cmd-nexttab", () => {
                if (!this.hasActivePanel()) return;
                const active = this.activeWidget;
                active.tabIndex++;
            });
            this.app.addHandler("cmd-prevtab", () => {
                if (!this.hasActivePanel()) return;
                const active = this.activeWidget;
                active.tabIndex--;
            });
            this.app.addHandler("cmd-closetab", () => {
                if (!this.hasActivePanel()) return;
                const active = this.activeWidget;
                active.remTab(active.tabs[active.tabIndex]);
            });
            this.app.addHandler("cmd-openclose", () => {
                if (!this.hasActivePanel()) return;
                const active = this.activeWidget;
                if (!active.tabs[active.tabIndex]) return;
                active.tabs[active.tabIndex].post("openclose");
            });
            this.app.addHandler("cmd-expandcollapse", () => {
                if (!this.hasActivePanel()) return;
                const active = this.activeWidget;
                active.isTitleCollapsed = !active.isTitleCollapsed;
            });
            this.app.addHandler("cmd-minmax", () => {
                if (!this.hasActivePanel()) return;
                const active = this.activeWidget;
                active.isMaximized = !active.isMaximized;
            });
            this.app.addHandler("cmd-resetdivider", () => {
                if (!this.hasProject()) return;
                this.project.sidePos = null;
            });
            this.app.addHandler("cmd-toggleside", () => {
                if (!this.hasProject()) return;
                this.project.isCollapsed = !this.project.isCollapsed;
            });
            this.app.addHandler("cmd-source-type", type => {
                if (!this.hasProject()) return;
                type = String(type);
                if (!["nt", "wpilog", "csv-time", "csv-field", "ds"].includes(type)) return;
                this.project.config.sourceType = type;
                this.update(0);
                this.app.post("cmd-action");
            });
            this.app.addHandler("cmd-action", () => {
                if (!this.hasProject() || !this.hasSource()) return;
                if (this.source instanceof NTSource) {
                    if (this.source.disconnected)
                        this.source.connect();
                    else this.source.disconnect();
                    return;
                }
                if (this.source instanceof HistoricalSource) {
                    if (this.source.importing) return;
                    if (this.project.config.source == null) return;
                    (async () => {
                        const source = this.source;
                        this.app.progress = 0;
                        try {
                            let file = this.project.config.source;
                            let i1 = file.lastIndexOf("/");
                            let i2 = file.lastIndexOf("\\");
                            let i = Math.max(i1, i2);
                            source.file = file;
                            source.shortFile = file.slice(i+1);
                            const progress = v => {
                                if (this.source != source) return this.app.progress = null;
                                this.app.progress = v;
                            };
                            source.addHandler("progress", progress);
                            const t0 = util.getTime();
                            await source.importFrom(file);
                            const t1 = util.getTime();
                            console.log(t1-t0);
                            source.remHandler("progress", progress);
                            this.app.progress = 1;
                        } catch (e) {
                            this.app.doError(source.constructor.getName()+" Load Error", this.project.config.source, e);
                        }
                        this.app.progress = null;
                    })();
                    return;
                }
            });
        });

        this.eNavProgress.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            if (!this.hasSource()) return;
            e.preventDefault();
            e.stopPropagation();
            let paused = this.source.playback.paused;
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                if (!this.hasSource()) return;
                this.source.playback.paused = paused;
            };
            const mousemove = e => {
                if (!this.hasSource()) return;
                this.source.playback.paused = true;
                this.source.ts = util.lerp(this.source.tsMin, this.source.tsMax, this.progressHover);
            };
            mousemove(e);
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.eNavOptionsButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasSource()) return;
            let itm;
            let menu = new core.Menu();
            itm = menu.addItem(new core.Menu.Item(
                this.source.playback.finished ? "Replay" : this.source.playback.paused ? "Play" : "Pause",
                this.source.playback.finished ? "refresh" : this.source.playback.paused ? "play" : "pause",
            ));
            itm.addHandler("trigger", e => {
                this.eNavActionButton.click();
            });
            itm = menu.addItem(new core.Menu.Item("Skip to front"));
            itm.addHandler("trigger", e => {
                this.eNavBackButton.click();
            });
            itm = menu.addItem(new core.Menu.Item("Skip to end"));
            itm.addHandler("trigger", e => {
                this.eNavForwardButton.click();
            });
            itm = menu.addItem(new core.Menu.Item("Custom timestamp..."));
            let subitm;
            subitm = itm.menu.addItem(new core.Menu.Item("Exact timestamp"));
            subitm.addHandler("trigger", async e => {
                let pop = this.app.prompt("Custom Timestamp", "Exact timestamp in seconds");
                pop.type = "num";
                pop.icon = "time";
                let result = await pop.whenResult();
                if (result == null) return;
                if (!this.hasSource()) return;
                this.source.ts = parseFloat(result)*1000;
                // 199.461
                // 95.75
            });
            subitm = itm.menu.addItem(new core.Menu.Item("Time since beginning"));
            subitm.addHandler("trigger", async e => {
                let pop = this.app.prompt("Custom Timestamp", "Time since beginning in seconds");
                pop.type = "num";
                pop.icon = "time";
                let result = await pop.whenResult();
                if (result == null) return;
                if (!this.hasSource()) return;
                this.source.ts = this.source.tsMin+parseFloat(result)*1000;
            });
            core.Menu.contextMenu = menu;
            let r = this.eNavOptionsButton.getBoundingClientRect();
            core.Menu.placeContextMenu(r.left, r.top);
        });
        this.eNavActionButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasSource()) return;
            if (this.source.playback.finished) return this.source.ts = this.source.tsMin;
            this.source.playback.paused = !this.source.playback.paused;
        });
        this.eNavBackButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasSource()) return;
            this.source.ts = this.source.tsMin;
        });
        this.eNavForwardButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasSource()) return;
            this.source.ts = this.source.tsMax;
        });
        this.addHandler("nav-back", () => {
            if (!this.hasSource()) return;
            this.source.ts -= 5*1000;
        });
        this.addHandler("nav-forward", () => {
            if (!this.hasSource()) return;
            this.source.ts += 5*1000;
        });
        this.addHandler("nav-back-small", () => {
            if (!this.hasSource()) return;
            this.source.ts -= 1;
        });
        this.addHandler("nav-forward-small", () => {
            if (!this.hasSource()) return;
            this.source.ts += 1;
        });

        this.#explorer = new FieldExplorer();
        this.explorer.addHandler("change-showHidden", (f, t) => this.change("showHidden", f, t));
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
            pth = util.generatePath(pth);
            this.app.dragData = this.hasSource() ? this.source.tree.lookup(pth) : null;
            this.app.dragging = true;
        });
        this.#metaExplorer = new core.Explorer();

        this.#toolButtons = new Set();
        this.#widget = null;
        this.#activeWidget = null;
        this.#source = null;

        this.#eNavPreInfo = document.createElement("div");
        this.eNavPre.appendChild(this.eNavPreInfo);
        this.eNavPreInfo.classList.add("info");

        this.#eSide = document.createElement("div");
        this.eMain.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.#eSideSections = {};
        const names = ["source", "browser", "tools"];
        names.forEach((name, i) => {
            if (i > 0) {
                let elem = document.createElement("div");
                this.eSide.appendChild(elem);
                elem.classList.add("divider");
                elem.addEventListener("mousedown", e => {
                    const mouseup = () => {
                        document.removeEventListener("mouseup", mouseup);
                        document.removeEventListener("mousemove", mousemove);
                    };
                    const mousemove = e => {
                        if (!this.hasProject()) return;
                        const available = this.sideAvailable;
                        let r = this.eSide.getBoundingClientRect();
                        let y = e.pageY-r.top;
                        let top = 0;
                        for (let j = 0; j < i-1; j++)
                            top += this.getESideSection(names[j]).elem.getBoundingClientRect().height;
                        top += available.heightBtn;
                        let bottom = r.height;
                        for (let j = names.length-1; j > i; j--)
                            bottom -= this.getESideSection(names[j]).elem.getBoundingClientRect().height;
                        bottom -= available.heightBtn;
                        y = Math.min(bottom, Math.max(top, y));
                    };
                    document.addEventListener("mouseup", mouseup);
                    document.addEventListener("mousemove", mousemove);
                });
            }
            let elem = document.createElement("div");
            this.eSide.appendChild(elem);
            elem.id = name;
            elem.classList.add("section");
            let s = this.#eSideSections[name] = new util.Target();
            s.elem = elem;
            let btn = s.eBtn = document.createElement("button");
            elem.appendChild(btn);
            btn.classList.add("override");
            btn.innerHTML = "<ion-icon name='chevron-forward'></ion-icon><span></span>";
            btn.children[1].textContent = name.toUpperCase();
            btn.addEventListener("click", e => {
                e.stopPropagation();
                if (!this.hasProject()) return;
                if (this.project.hasSideSectionPos(name) && this.project.getSideSectionPos(name) > 0)
                    this.project.delSideSectionPos(name);
                else {
                    let sideSectionPos = this.project.sideSectionPos;
                    let sum = 0, n = 0;
                    for (let k in sideSectionPos) {
                        if (sideSectionPos[k] <= 0) continue;
                        sum += sideSectionPos[k];
                        n++;
                    }
                    this.project.setSideSectionPos(name, (n > 0) ? (sum/n) : 1);
                }
                this.project.fixSideSectionPos(true);
            });
            s.eContent = document.createElement("div");
            elem.appendChild(s.eContent);
            s.eContent.classList.add("content");
            let idfs = {
                source: () => {
                    s.eContent.remove();
                    s.eContent = this.metaExplorer.elem;
                    elem.appendChild(s.eContent);
                    s.eContent.classList.add("content");
                },
                browser: () => {
                    s.eContent.remove();
                    s.eContent = this.explorer.elem;
                    elem.appendChild(s.eContent);
                    s.eContent.classList.add("content");
                    const eToggle = document.createElement("div");
                    s.eBtn.appendChild(eToggle);
                    eToggle.innerHTML = "<ion-icon></ion-icon>";
                    const eIcon = eToggle.children[0];
                    const update = () => {
                        eIcon.name = this.showHidden ? "eye" : "eye-off";
                    };
                    this.addHandler("change-showHidden", update);
                    update();
                    eToggle.addEventListener("click", e => {
                        e.stopPropagation();
                        this.showHidden = !this.showHidden;
                    });
                },
            };
            if (elem.id in idfs) idfs[elem.id]();
        });
        new ResizeObserver(() => this.formatSide()).observe(this.eSide);
        this.#eContent = document.createElement("div");
        this.eMain.appendChild(this.eContent);
        this.eContent.classList.add("content");
        new ResizeObserver(() => this.formatContent()).observe(this.eContent);
        this.addHandler("change-project", () => this.formatSide());
        this.addHandler("change-project.setSideSectionPos", () => this.formatSide());
        this.addHandler("change-project.delSideSectionPos", () => this.formatSide());
        this.addHandler("change-project.fixSideSectionPos", () => this.formatSide());
        
        let toolButtons = Panel.getTools();
        this.addToolButton(toolButtons.map(data => {
            let btn = new ToolButton(data.class);
            btn.elem.disabled = !!data.disabled;
            return btn;
        }));

        (new core.DropTarget(this.elem)).addHandler("files", files => {
            files = util.ensure(files, "arr").filter(file => file instanceof File);
            if (files.length <= 0) return;
            const file = files[0];
            const pth = file.path;
            if (!this.hasProject()) return;
            let type = "wpilog";
            if (pth.endsWith(".wpilog")) type = "wpilog";
            else if (pth.endsWith(".time.csv")) type = "csv-time";
            else if (pth.endsWith(".field.csv")) type = "csv-field";
            else if (pth.endsWith(".csv")) type = "csv-time";
            else if (pth.endsWith(".dslog") || pth.endsWith(".dsevents")) type = "ds";
            this.project.config.sourceType = type;
            this.project.config.source = pth;
            this.update(0);
            this.app.post("cmd-action");
        });

        this.#eDivider = document.createElement("div");
        this.eMain.appendChild(this.eDivider);
        this.eDivider.classList.add("divider");
        this.eDivider.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = () => {
                this.eDivider.classList.remove("this");
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                let r = this.eMain.getBoundingClientRect();
                let p = (e.pageX-r.left) / r.width;
                if (!this.hasProject()) return;
                this.project.sidePos = p;
            };
            this.eDivider.classList.add("this");
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.source = null;
        this.addHandler("change-project", () => (this.source = null));

        this.format();
        this.addHandler("post-show", () => this.format());

        let requestCollapse = false;
        this.addHandler("change-widget", () => (requestCollapse = true));
        
        const update = () => {
            this.widget = this.hasProject() ? this.project.buildWidget() : null;

            this.app.eProjectInfoBtnName.textContent = this.hasProject() ? this.project.meta.name : "";
            this.app.eProjectInfoNameInput.value = this.hasProject() ? this.project.meta.name : "";
            this.app.eProjectInfoSourceInput.value = this.hasProject() ? this.project.config.source : "";

            ["nt", "wpilog", "csv-time", "csv-field", "ds"].forEach(type => {
                let itm = this.app.menu.getItemById("source:"+type);
                if (!itm) return;
                itm.checked = this.hasProject() ? (type == this.project.config.sourceType) : false;
            });
        };
        this.addHandler("change-project", update);
        this.addHandler("change-project.meta.name", update);
        this.addHandler("change-project.config.setSource", update);
        this.addHandler("change-project.config.delSource", update);
        this.addHandler("change-project.config.sourceType", update);

        let timer = 0;
        this.addHandler("update", async delta => {
            LOGGERCONTEXT.update(delta);

            if (this.app.page == this.name)
                this.app.title = this.hasProject() ? (this.project.meta.name+" — "+this.sourceInfo) : "?";
            
            if (this.hasProject()) {
                const constructor = {
                    nt: NTSource,
                    wpilog: WPILOGSource,
                    "csv-time": CSVTimeSource,
                    "csv-field": CSVFieldSource,
                    ds: DSSource,
                }[this.project.config.sourceType];
                if (!util.is(constructor, "func")) this.source = null;
                else if (!(this.source instanceof constructor)) {
                    this.source = {
                        nt: () => new NTSource(null),
                        wpilog: () => new WPILOGSource(),
                        "csv-time": () => new CSVTimeSource(),
                        "csv-field": () => new CSVFieldSource(),
                        ds: () => new DSSource(),
                    }[this.project.config.sourceType]();
                } else {
                    let typefs = {
                        nt: () => {
                            this.source.address = this.project.config.source;
                        },
                    };
                    if (this.project.config.sourceType in typefs) typefs[this.project.config.sourceType]();
                }
            } else this.source = null;

            if (this.hasSource())
                this.source.update(delta);

            this.app.eProjectInfoSourceTypes.forEach(type => {
                let elem = this.app.getEProjectInfoSourceType(type);
                if (this.hasProject() && this.project.config.sourceType == type) elem.classList.add("special");
                else elem.classList.remove("special");
            });

            if (this.hasWidget()) {
                this.widget.update(delta);
                if (requestCollapse) {
                    requestCollapse = false;
                    this.widget.collapse();
                }
                if (this.hasSource()) {
                    const sstart = this.source.tsMin, sstop = this.source.tsMax, slen = sstop-sstart;
                    let n = 0;
                    const dfs = widget => {
                        if (!(widget instanceof Widget)) return;
                        if (widget instanceof Container)
                            return widget.children.forEach(widget => dfs(widget));
                        const tab = widget.tabs[widget.tabIndex];
                        if (!(tab instanceof Panel.VideoSyncTab)) return;
                        if (!tab.hasVideo()) return;
                        const offset = tab.offset;
                        const len = util.ensure(tab.duration, "num") * 1000;
                        const buffered = tab.eVideo.buffered;
                        while (this.sections.length < n+buffered.length+1)
                            this.addSection(new App.ProjectPage.Section(0, 0, 0));
                        for (let i = 0; i < buffered.length+1; i++) {
                            let sect = this.sections[n+i];
                            if (i <= 0) {
                                sect.l = Math.min(1, Math.max(0, (-offset)/slen));
                                sect.r = Math.min(1, Math.max(0, (len-offset)/slen));
                                sect.x = 0;
                                sect.color = "var(--a)";
                                continue;
                            }
                            sect.l = Math.min(1, Math.max(0, (buffered.start(i-1)*1000-offset)/slen));
                            sect.r = Math.min(1, Math.max(0, (buffered.end(i-1)*1000-offset)/slen));
                            sect.x = 1;
                            sect.color = "var(--v8)";
                        }
                        n += buffered.length+1;
                    };
                    dfs(this.widget);
                    while (this.sections.length > n)
                        this.remSection(this.sections.at(-1));
                }
            } else {
                this.widget = new Panel();
                this.sections = [];
            }
            if (!this.hasWidget() || !this.widget.contains(this.activeWidget))
                this.activeWidget = null;
            
            if (!this.hasSource());
            else if (this.source instanceof NTSource) {
                let on = !this.source.connecting && !this.source.connected;
                if (on) this.app.eProjectInfoActionBtn.classList.add("on");
                else this.app.eProjectInfoActionBtn.classList.remove("on");
                if (!on) this.app.eProjectInfoActionBtn.classList.add("off");
                else this.app.eProjectInfoActionBtn.classList.remove("off");
                this.app.eProjectInfoActionBtn.textContent = on ? "Connect" : "Disconnect";
            } else if (this.source instanceof HistoricalSource) {
                this.app.eProjectInfoActionBtn.disabled = this.source.importing;
            }

            let itm = this.app.menu.getItemById("action");
            if (itm) {
                if (!this.hasSource()) {
                    itm.enabled = false;
                    itm.label = "No source";
                } else if (this.source instanceof NTSource) {
                    let on = !this.source.connecting && !this.source.connected;
                    itm.enabled = true;
                    itm.label = on ? "Connect" : "Disconnect";
                } else if (this.source instanceof HistoricalSource) {
                    itm.enabled = true;
                    itm.label = "Import";
                }
            }

            if (this.hasSource()) {
                this.navOpen = true;
                let tMin = this.source.tsMin, tMax = this.source.tsMax;
                let tNow = this.source.ts;
                this.progress = (tNow - tMin) / (tMax - tMin);
                if (this.eNavActionButton.children[0])
                    this.eNavActionButton.children[0].name = this.source.playback.finished ? "refresh" : this.source.playback.paused ? "play" : "pause";
                this.eNavProgressTooltip.textContent = util.formatTime(util.lerp(tMin, tMax, this.progressHover));
                this.eNavPreInfo.textContent = [tNow-tMin, tMax-tMin].map(v => util.formatTime(v)).join(" / ");
                this.eNavInfo.textContent = [tMin, tNow, tMax].map(v => util.formatTime(v)).join(" / ");
            } else this.navOpen = false;
            
            FieldExplorer.Node.doubleTraverse(
                this.hasSource() ? this.source.tree.nodeObjects : [],
                this.explorer.nodeObjects,
                (...enodes) => this.explorer.add(...enodes),
                (...enodes) => this.explorer.rem(...enodes),
            );
            const dfs = data => {
                data.dump = enode => {
                    if ("iconSrc" in data) enode.iconSrc = data.iconSrc;
                    else enode.icon = data.icon;
                    if ("value" in data) enode.tooltip = data.value;
                    enode.data = data;
                    if (enode._done) return;
                    enode._done = true;
                    enode.eValue.style.color = "var(--a)";
                    enode.eTooltip.style.color = "var(--a)";
                    enode.addHandler("trigger", e => {
                        if (!enode.eDisplay.contains(e.target)) return;
                        if (("value" in enode.data) || e.shiftKey) enode.showValue = !enode.showValue;
                        else enode.isOpen = !enode.isOpen;
                    });
                };
                util.ensure(data.children, "arr").forEach(data => dfs(data));
                data.nodeObjects = data.children;
            };
            let info = this.sourceMetaInfo;
            dfs(info);
            this.getESideSection("source").eBtn.children[1].textContent = info.name;
            core.Explorer.Node.doubleTraverse(
                info.nodeObjects,
                this.metaExplorer.nodeObjects,
                (...enodes) => this.metaExplorer.add(...enodes),
                (...enodes) => this.metaExplorer.rem(...enodes),
            );

            this.eMain.style.setProperty("--side", (100*(this.hasProject() ? Math.max(0, this.project.sidePos) : 0))+"%");

            // if (timer > 0) return timer -= delta;
            // timer = 5000;
            // if (!this.hasProject()) return;
            // let r = this.eContent.getBoundingClientRect();
            // this.project.meta.thumb = await core.capture({
            //     x: Math.round(r.left), y: Math.round(r.top),
            //     width: Math.round(r.width), height: Math.round(r.height),
            // });
        });

        this.addHandler("enter", async data => {
            let projectOnly = [
                "newtab",
                "closetab",
                "action",
                "openclose", "expandcollapse", "resetdivider",
            ];
            projectOnly.forEach(id => {
                let itm = this.app.menu.getItemById(id);
                if (!itm) return;
                itm.exists = true;
            });
            await this.refresh();
            if (this.app.hasProject(data.id)) {
                this.project = this.app.getProject(data.id);
            } else if (data.project instanceof Project) {
                this.project = data.project;
            } else {
                this.project = new Project();
                this.project.meta.created = this.project.meta.modified = util.getTime();
                this.project.config.setSource("nt", "http://localhost");
            }
        });
        this.addHandler("post-enter", async data => {
            let itm;
            itm = this.app.menu.getItemById("closeproject");
            if (itm) itm.accelerator = "CmdOrCtrl+Shift+W";
            itm = this.app.menu.getItemById("close");
            if (itm) itm.accelerator = "";
        });
        this.addHandler("leave", async data => {
            let projectOnly = [
                "newtab",
                "closetab",
                "action",
                "openclose", "expandcollapse", "resetdivider",
            ];
            projectOnly.forEach(id => {
                let itm = this.app.menu.getItemById(id);
                if (!itm) return;
                itm.exists = false;
            });
        });
        this.addHandler("post-leave", async data => {
            let itm;
            itm = this.app.menu.getItemById("closeproject");
            if (itm) itm.accelerator = null;
            itm = this.app.menu.getItemById("close");
            if (itm) itm.accelerator = null;
        });
    }

    get showHidden() { return this.explorer.showHidden; }
    set showHidden(v) { this.explorer.showHidden = v; }

    get explorer() { return this.#explorer; }
    get metaExplorer() { return this.#metaExplorer; }

    get toolButtons() { return [...this.#toolButtons]; }
    set toolButtons(v) {
        v = util.ensure(v, "arr");
        this.clearToolButtons();
        this.addToolButton(v);
    }
    clearToolButtons() {
        let btns = this.toolButtons;
        this.remToolButton(btns);
        return btns;
    }
    hasToolButton(btn) {
        if (!(btn instanceof ToolButton)) return false;
        return this.#toolButtons.has(btn);
    }
    addToolButton(...btns) {
        return util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof ToolButton)) return false;
            if (this.hasToolButton(btn)) return false;
            this.#toolButtons.add(btn);
            this.getESideSection("tools").eContent.appendChild(btn.elem);
            btn.onAdd();
            return btn;
        });
    }
    remToolButton(...btns) {
        return util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof ToolButton)) return false;
            if (!this.hasToolButton(btn)) return false;
            btn.onRem();
            this.#toolButtons.delete(btn);
            this.getESideSection("tools").eContent.removeChild(btn.elem);
            return btn;
        });
    }

    get widget() { return this.#widget; }
    set widget(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.widget == v) return;
        if (this.hasWidget()) {
            this.widget.onRem();
            this.widget.clearLinkedHandlers(this, "change");
            this.widget.clearLinkedHandlers(this, "set-widget");
            this.eContent.removeChild(this.widget.elem);
        }
        this.#widget = v;
        if (this.hasWidget()) {
            const onChange = () => {
                if (this.hasProject())
                    this.project.widgetData = JSON.stringify(this.widget);
                this.change("widget", null, this.widget);
            };
            this.widget.addLinkedHandler(this, "change", onChange);
            this.widget.addLinkedHandler(this, "set-widget", widget => this.widget = widget);
            this.eContent.appendChild(this.widget.elem);
            this.activeWidget = this.widget;
            this.widget.onAdd();
        }
        if (this.hasProject())
            this.project.widgetData = JSON.stringify(this.widget);
        this.formatContent();
    }
    hasWidget() { return !!this.widget; }
    get activeWidget() { return this.#activeWidget; }
    set activeWidget(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.activeWidget == v) return;
        if (this.hasActiveWidget()) this.activeWidget.elem.classList.remove("active");
        this.#activeWidget = v;
        if (this.hasActiveWidget()) this.activeWidget.elem.classList.add("active");
    }
    hasActiveWidget() { return !!this.activeWidget; }
    hasActiveContainer() { return this.activeWidget instanceof Container; }
    hasActivePanel() { return this.activeWidget instanceof Panel; }
    get source() { return this.#source; }
    set source(v) {
        v = (v instanceof Source) ? v : null;
        if (this.source == v) return;
        if (this.hasSource()) {
            if (this.source instanceof NTSource) this.source.address = null;
        }
        this.#source = v;
        const app = this.app;
        if (!this.hasSource()) {
            app.eProjectInfoNameInput.placeholder = "No source";
            app.eProjectInfoActionBtn.disabled = true;
            app.eProjectInfoActionBtn.classList.remove("on");
            app.eProjectInfoActionBtn.classList.remove("off");
            app.eProjectInfoActionBtn.classList.remove("special");
            app.eProjectInfoActionBtn.textContent = "No source";
        } else if (this.source instanceof NTSource) {
            app.eProjectInfoSourceInput.placeholder = "Provide an IP...";
            app.eProjectInfoActionBtn.disabled = false;
            app.eProjectInfoActionBtn.classList.remove("special");
        } else if (this.source instanceof HistoricalSource) {
            app.eProjectInfoSourceInput.placeholder = "Path...";
            app.eProjectInfoActionBtn.classList.remove("on");
            app.eProjectInfoActionBtn.classList.remove("off");
            app.eProjectInfoActionBtn.classList.add("special");
            app.eProjectInfoActionBtn.textContent = "Import";
        } else {
            app.eProjectInfoNameInput.placeholder = "Unknown source: "+this.source.constructor.getName();
            app.eProjectInfoActionBtn.disabled = true;
            app.eProjectInfoActionBtn.classList.remove("on");
            app.eProjectInfoActionBtn.classList.remove("off");
            app.eProjectInfoActionBtn.classList.remove("special");
            app.eProjectInfoActionBtn.textContent = "Unknown source: "+this.source.constructor.getName();
        }
        let itm = app.menu.getItemById("action");
        if (!itm) return;
        if (!this.hasSource()) {
            itm.enabled = false;
            itm.label = "No source";
        } else if (this.source instanceof NTSource) {
            let on = !this.source.connecting && !this.source.connected;
            itm.enabled = true;
            itm.label = on ? "Connect" : "Disconnect";
        } else if (this.source instanceof HistoricalSource) {
            itm.enabled = true;
            itm.label = "Import";
        } else {
            itm.enabled = false;
            itm.label = "Unknown source: "+this.source.constructor.getName();
        }
    }
    hasSource() { return !!this.source; }
    get sourceInfo() {
        if (!this.hasSource()) return "No source";
        if (this.source instanceof NTSource) {
            if (this.source.disconnected) return "Disconnected";
            if (this.source.connecting) return this.source.address+"...";
            return this.source.address;
        }
        if (this.source instanceof HistoricalSource) {
            if (this.source.importing) return this.source.shortFile+"...";
            if (this.source.fieldObjects.length <= 0) return "Nothing imported";
            return this.source.shortFile;
        }
        return "Unknown source: "+this.source.constructor.getName();
    }
    get sourceMetaInfo() {
        let data = { name: this.sourceInfo, children: [] };
        if (!this.hasSource()) return data;
        data.children.push({
            name: this.source.constructor.getName(),
            icon: "book",
        });
        if (this.source instanceof NTSource) {
            const state = ((!this.source.connecting && !this.source.connected) ? "Disconnected" : (this.source.connecting) ? "Connecting" : "Connected");
            data.children.push(
                {
                    name: "IP",
                    info: this.source.address,
                    value: this.source.address,
                    icon: "navigate",
                },
                {
                    name: "State",
                    info: state,
                    value: state,
                    icon: "cube-outline",
                },
                {
                    name: "Bitrate",
                    info: this.source.bitrate+" kb/s",
                    value: this.source.bitrate+" kb/s",
                    icon: "wifi",
                },
            );
        } else if (this.source instanceof HistoricalSource) {
            const state = (this.source.importing ? "Not imported" : (this.source.fieldObjects.length <= 0) ? "Importing" : "Imported");
            data.children.push(
                {
                    name: "File",
                    info: this.source.shortFile,
                    value: this.source.file,
                    icon: "document-outline",
                },
                {
                    name: "State",
                    info: state,
                    value: state,
                    icon: "cube-outline",
                },
            );
        } else {
            data.children.at(-1).name = "Unknown: "+this.source.constructor.getName();
        }
        const tMin = this.source.tsMin, tMax = this.source.tsMax;
        const duration = ((tMin == 0) ? util.formatTime(tMax) : `[${util.formatTime(tMin)} - ${util.formatTime(tMax)}]`);
        data.children.push(
            {
                name: "Fields",
                info: this.source.tree.nFields,
                value: this.source.tree.nFields,
                iconSrc: "./assets/icons/number.svg",
            },
            {
                name: "Duration",
                info: duration,
                value: duration,
                icon: "time-outline",
            },
        );
        return data;
    }

    get eNavPreInfo() { return this.#eNavPreInfo; }
    get eSide() { return this.#eSide; }
    get eSideSections() { return Object.keys(this.#eSideSections); }
    hasESideSection(id) { return id in this.#eSideSections; }
    getESideSection(id) { return this.#eSideSections[id]; }
    get eContent() { return this.#eContent; }
    get eDivider() { return this.#eDivider; }

    format() {
        this.formatSide();
        this.formatContent();
    }
    get sideAvailable() {
        let ids = this.eSideSections;
        let elems = ids.map(id => this.getESideSection(id).elem);
        let height = this.eSide.getBoundingClientRect().height;
        Array.from(this.eSide.children).forEach(elem => {
            if (elems.includes(elem)) return;
            if (elem.classList.contains("divider")) return;
            height -= elem.getBoundingClientRect().height;
        });
        let h = 0, n = 0;
        elems.forEach(elem => {
            let btn = elem.querySelector(":scope > button");
            if (!btn) return;
            h = Math.max(h, btn.getBoundingClientRect().height);
            n++;
        });
        return {
            height: height,
            heightBtn: h,
            nBtn: n,
        };
    }
    formatSide() {
        const available = this.sideAvailable;
        const availableHeight = available.height - available.heightBtn*available.nBtn;
        this.eSideSections.forEach(id => {
            let s = this.getESideSection(id);
            let x = (this.hasProject() && this.project.hasSideSectionPos(id)) ? this.project.getSideSectionPos(id) : 0;
            if (x > 0) s.elem.classList.add("this");
            else s.elem.classList.remove("this");
            s.elem.style.setProperty("--h", (availableHeight*x + available.heightBtn)+"px");
        });
        this.metaExplorer.format();
        this.explorer.format();
        return true;
    }
    formatContent() {
        if (!this.hasWidget()) return false;
        let r = this.eContent.getBoundingClientRect();
        this.widget.elem.style.setProperty("--w", r.width+"px");
        this.widget.elem.style.setProperty("--h", r.height+"px");
        this.widget.format();
        return true;
    }

    get state() {
        return {
            id: this.projectId,
        };
    }
    async loadState(state) {
        state = util.ensure(state, "obj");
        await this.app.loadProjects();
        await this.app.setPage(this.name, { id: state.id });
    }
};
