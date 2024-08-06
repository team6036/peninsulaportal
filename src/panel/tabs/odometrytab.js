import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";

import Source from "../../sources/source.js";


import PanelBrowserTab from "./browsertab.js";
import PanelToolCanvasTab from "./toolcanvastab.js";


export default class PanelOdometryTab extends PanelToolCanvasTab {
    #lengthUnits;
    #angleUnits;

    #poses;

    #template;

    #fTemplate;

    static NAME = "Odometry";
    static NICKNAME = "Odom";
    static ICON = "locate";
    static ICONSRC = null;
    static ICONCOLOR = "var(--cy)";

    constructor(a) {
        super(a);

        this.elem.classList.add("odometry");

        this.#lengthUnits = null;
        this.#angleUnits = null;

        this.#poses = new Set();

        this.#template = null;

        ["p", "f", "o"].forEach(id => {
            const elem = document.createElement("div");
            elem.id = id;
            this.addEOptionSection(elem);
            elem.classList.add("section");
            let form = new core.Form();
            elem.appendChild(form.elem);
            form.side = "center";
            form.addField(new core.Form.Header({ p: "Poses", f: "Field", o: "Options" }[id]));
            let idfs = {
                p: () => {
                    elem.classList.add("list");
                    const update = () => {
                        if (this.poses.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    };
                    this.addHandler("change-addPose", update);
                    this.addHandler("change-remPose", update);
                    update();
                },
                f: () => {
                    elem.classList.add("field");
                    let form = new core.Form();
                    elem.appendChild(form.elem);
                    this.#fTemplate = form.addField(new core.Form.DropdownInput("template", []));
                    const apply = () => {
                        this.fTemplate.value = this.hasTemplate() ? this.template : "§null";
                    };
                    this.fTemplate.addHandler("change-values", apply);
                    this.addHandler("change-template", apply);
                    this.fTemplate.addHandler("change-value", () => {
                        if (!this.fTemplate.hasValue()) return;
                        this.template = (this.fTemplate.value == "§null") ? null : this.fTemplate.value;
                    });
                },
                o: () => {
                    elem.classList.add("options");
                },
            };
            if (id in idfs) idfs[id]();
        });

        this.addHandler("update", delta => {
            const source = this.page.source;
            this.hooks.forEach(hook => {
                let node = (source && hook.hasPath()) ? source.tree.lookup(hook.path) : null;
                hook.setFrom((node && node.hasField()) ? node.field.type : "*", this.getValue(node));
            });
        });

        if (util.is(a, "arr")) a = { poses: a };
        else if (util.is(a, "str")) a = { template: a };

        a = util.ensure(a, "obj");
        this.poses = a.poses;
        this.template = ("template" in a) ? a.template : GLOBALSTATE.getProperty("active-template").value;
    }

    applyGlobal() {
        const templates = GLOBALSTATE.getProperty("templates").value;
        this.fTemplate.values = [{ value: "§null", name: "No Template" }, null, ...Object.keys(templates).map(k => {
            return { value: k, name: templates[k].name || k };
        })];
    }

    compute() {
        super.compute();
        try {
            this.poses.forEach(pose => pose.state.compute());
        } catch (e) {}
    }

    get lengthUnits() { return this.#lengthUnits; }
    set lengthUnits(v) {
        v = String(v);
        if (!["m", "cm", "mm", "yd", "ft", "in"].includes(v)) v = "m";
        if (this.lengthUnits == v) return;
        this.change("lengthUnits", this.lengthUnits, this.#lengthUnits=v);
    }
    get angleUnits() { return this.#angleUnits; }
    set angleUnits(v) {
        v = String(v);
        if (!["deg", "rad", "cycle"].includes(v)) v = "deg";
        if (this.angleUnits == v) return;
        this.change("angleUnits", this.angleUnits, this.#angleUnits=v);
    }

    get poses() { return [...this.#poses]; }
    set poses(v) {
        v = util.ensure(v, "arr");
        this.clearPoses();
        this.addPose(v);
    }
    clearPoses() {
        let poses = this.poses;
        this.remPose(poses);
        return poses;
    }
    hasPose(pose) {
        if (!(pose instanceof this.constructor.Pose)) return false;
        return this.#poses.has(pose);
    }
    addPose(...poses) {
        return util.Target.resultingForEach(poses, pose => {
            if (!(pose instanceof this.constructor.Pose)) return false;
            if (this.hasPose(pose)) return false;
            this.#poses.add(pose);
            pose.addLinkedHandler(this, "remove", () => this.remPose(pose));
            pose.addLinkedHandler(this, "change", (c, f, t) => this.change("poses["+this.poses.indexOf(pose)+"."+c, f, t));
            if (this.hasEOptionSection("p"))
                this.getEOptionSection("p").appendChild(pose.elem);
            this.change("addPose", null, pose);
            pose.state.tab = this;
            pose.onAdd();
            return pose;
        });
    }
    remPose(...poses) {
        return util.Target.resultingForEach(poses, pose => {
            if (!(pose instanceof this.constructor.Pose)) return false;
            if (!this.hasPose(pose)) return false;
            pose.onRem();
            pose.state.tab = null;
            this.#poses.delete(pose);
            pose.clearLinkedHandlers(this, "remove");
            pose.clearLinkedHandlers(this, "change");
            if (this.hasEOptionSection("p"))
                this.getEOptionSection("p").removeChild(pose.elem);
            this.change("remPose", pose, null);
            return pose;
        });
    }

    get template() { return this.#template; }
    set template(v) {
        v = (v == null) ? null : String(v);
        if (this.template == v) return;
        this.change("template", this.template, this.#template=v);
    }
    hasTemplate() { return this.template != null; }

    getValue(node, ts=null) {
        if (!(node instanceof Source.Node)) return null;
        if (!node.hasField()) return null;
        const field = node.field;
        if (field.isStruct) {
            if (!["Translation2d", "Translation3d", "Rotation2d", "Rotation3d", "Pose2d", "Pose3d"].includes(field.baseType)) return null;
            if (field.isArray) {
                let values = [];
                node.nodeObjects.forEach(node => values.push(...this.getValue(node, ts)));
                return values;
            }
            const decoded = util.ensure(util.ensure(field.getDecoded(ts), "obj").r, "obj");
            if (field.baseType.startsWith("Translation")) {
                const l = parseInt(field.baseType["Translation".length]);
                let values = Object.values(decoded).map(v => util.ensure(v, "num"));
                values = values.slice(0, l);
                values.push(...new Array(Math.max(0, l-values.length)).fill(0));
                return [{
                    translation: values.map(v => lib.Unit.convert(v, this.lengthUnits, "m")),
                    rotation: [0],
                }];
            }
            if (field.baseType.startsWith("Rotation")) {
                const l = { 2: 1, 3: 7 }[parseInt(field.baseType["Rotation".length])];
                let values = Object.values(decoded).map(v => util.ensure(v, "num"));
                values = values.slice(0, l);
                values.push(...new Array(Math.max(0, l-values.length)).fill(0));
                return [{
                    translation: [0, 0],
                    rotation: values,
                }];
            }
            const translationL = parseInt(field.baseType["Pose".length]);
            const rotationL = { 2: 1, 3: 7 }[parseInt(field.baseType["Pose".length])];
            let translationValues = Object.values(util.ensure(util.ensure(decoded.translation, "obj").r, "obj")).map(v => util.ensure(v, "num"));
            translationValues = translationValues.slice(0, translationL);
            translationValues.push(...new Array(Math.max(0, translationL-translationValues.length)).fill(0));
            let rotationValues = Object.values(util.ensure(util.ensure(decoded.rotation, "obj").r, "obj")).map(v => util.ensure(v, "num"));
            rotationValues = rotationValues.slice(0, rotationL);
            rotationValues.push(...new Array(Math.max(0, rotationL-rotationValues.length)).fill(0));
            return [{
                translation: translationValues.map(v => lib.Unit.convert(v, this.lengthUnits, "m")),
                rotation: rotationValues,
            }];
        }
        if (!field.isArray) return null;
        let values = util.ensure(field.get(ts), "arr").map(v => util.ensure(v, "num"));
        if (values.length % 7 == 0) {
            const l = values.length / 7;
            return new Array(l).fill(null).map((_, i) => {
                return [{
                    translation: values.slice(i*7, i*7+3).map(v => lib.Unit.convert(v, this.lengthUnits, "m")),
                    rotation: values.slice(i*7+3, i*7+7),
                }];
            });
        }
        if (values.length % 3 == 0) {
            const l = values.length / 3;
            return new Array(l).fill(null).map((_, i) => {
                return [{
                    translation: values.slice(i*3, i*3+2).map(v => lib.Unit.convert(v, this.lengthUnits, "m")),
                    rotation: values.slice(i*3+2, i*3+3).map(v => lib.Unit.convert(v, this.angleUnits, "rad")),
                }];
            });
        }
        if (values.length % 2 == 0) {
            const l = values.length / 2;
            return new Array(l).fill(null).map((_, i) => {
                return [{
                    translation: values.slice(i*2, i*2+2).map(v => lib.Unit.convert(v, this.lengthUnits, "m")),
                    rotation: [0],
                }];
            });
        }
        return null;
    }
    getValueRange(node, tsStart=null, tsStop=null) {
        if (!(node instanceof Source.Node)) return null;
        if (!node.hasField()) return null;
        const field = node.field;
        let valueRange = [];
        for (let ts of field.getTSRange(tsStart, tsStop)) {
            let value = this.getValue(node, ts);
            if (value == null) return null;
            valueRange.push(value);
        }
        return valueRange;
    }

    get hooks() { return []; }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.optionState == 0) return null;
        if (data instanceof PanelBrowserTab) data = this.page.hasSource() ? this.page.source.tree.lookup(data.path) : null;
        if (!(data instanceof Source.Node)) return null;
        if (!data.hasField()) return null;
        for (let hook of this.hooks) {
            let r = hook.eBox.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            return {
                r: r,
                round: true,
                submit: () => {
                    hook.path = data.path;
                },
            };
        }
        const idfs = {
            p: () => {
                for (let pose of this.poses) {
                    let hovered = pose.getHovered(data, pos, options);
                    if (hovered) return hovered;
                }
                return {
                    r: r,
                    round: round,
                    submit: () => {
                        const colors = "rybgpocm";
                        const addPose = pth => {
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
                            this.addPose(new this.constructor.Pose({
                                path: pth,
                                color: "--c"+nextColor,
                            }));
                        };
                        addPose(data.path);
                    },
                };
            },
        };
        let r, round;
        r = this.eOptions.getBoundingClientRect();
        round = true;
        if (
            pos.x >= r.left && pos.x <= r.right &&
            pos.y >= r.top && pos.y <= r.bottom
        ) {
            for (let i = 0; i < this.eOptionSections.length; i++) {
                let id = this.eOptionSections[i];
                let elem = this.getEOptionSection(id);
                r = elem.getBoundingClientRect();
                if (pos.x < r.left || pos.x > r.right) continue;
                if (pos.y < r.top || pos.y > r.bottom) continue;
                if (elem.id in idfs) {
                    let data = idfs[elem.id]();
                    if (util.is(data, "obj")) return data;
                }
            }
        }
        r = this.elem.getBoundingClientRect();
        round = false;
        if (
            pos.x >= r.left && pos.x <= r.right &&
            pos.y >= r.top && pos.y <= r.bottom
        ) return idfs.p();
        return null;
    }

    get fTemplate() { return this.#fTemplate; }
}
PanelOdometryTab.Pose = class PanelOdometryTabPose extends util.Target {
    #path;
    #shown;
    #color;

    #fHooks;
    #shownHook;

    #state;

    #elem;
    #eDisplay;
    #eShowBox;
    #eShow;
    #eShowDisplay;
    #eDisplayName;
    #eWarning;
    #eWarningTooltip;
    #eRemoveBtn;
    #eContent;
    #eColorPicker;
    #eColorPickerColors;

    constructor(a) {
        super();

        this.#path = "";
        this.#shown = null;
        this.#color = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eShowBox = document.createElement("label");
        this.eDisplay.appendChild(this.eShowBox);
        this.eShowBox.classList.add("checkbox");
        this.eShowBox.style.setProperty("--size", "10px");
        this.eShowBox.innerHTML = "<input type='checkbox'><span></span>";
        this.#eShow = this.eShowBox.children[0];
        this.#eShowDisplay = this.eShowBox.children[1];
        this.#eDisplayName = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayName);
        this.eDisplayName.classList.add("name");
        this.#eWarning = document.createElement("div");
        this.eDisplay.appendChild(this.eWarning);
        this.eWarning.classList.add("warning");
        this.eWarning.innerHTML = "<ion-icon name='warning'></ion-icon><p-tooltip class='hov wy'></p-tooltip>";
        this.#eWarningTooltip = this.eWarning.children[1];
        this.#eRemoveBtn = document.createElement("button");
        this.eDisplay.appendChild(this.eRemoveBtn);
        this.eRemoveBtn.classList.add("icon");
        this.eRemoveBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eColorPicker = document.createElement("div");
        this.eContent.appendChild(this.eColorPicker);
        this.eColorPicker.classList.add("colorpicker");
        this.#eColorPickerColors = [];
        lib.COLORS.forEach(colors => {
            let btn = document.createElement("button");
            this.eColorPicker.appendChild(btn);
            this.#eColorPickerColors.push(btn);
            btn.classList.add("color");
            btn.color = "--"+colors._;
            btn.style.setProperty("--bg", "var(--"+colors._+")");
            btn.style.setProperty("--bgh", "var(--"+colors.h+")");
            btn.style.setProperty("--bgd", "var(--"+colors.d+")");
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.color = btn.color;
            });
        });

        this.eShowBox.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.eShow.addEventListener("change", e => {
            this.shown = this.eShow.checked;
        });
        this.eRemoveBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove");
        });
        this.eDisplay.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        const form = new core.Form();
        this.eContent.appendChild(form.elem);

        this.#fHooks = form.addField(new core.Form.SubForm("hooks"));
        const hooksSubform = this.fHooks.form;

        this.#shownHook = new PanelToolCanvasTab.Hook("Visibility Hook", null);
        this.shownHook.toggle.show();
        this.shownHook.addHandler("change", (c, f, t) => this.change("shownHook."+c, f, t));

        hooksSubform.addField(new core.Form.HTML("visibility-hook", this.shownHook.elem));

        this.#state = new this.constructor.State();

        this.eDisplay.addEventListener("contextmenu", async e => {
            let menu = this.makeContextMenu();
            core.Menu.contextMenu = menu;
            core.Menu.placeContextMenu(e.pageX, e.pageY);
        });

        if (util.is(a, "str")) a = { path: a };

        a = util.ensure(a, "obj");
        this.path = a.path;
        this.shown = util.ensure(a.shown, "bool", true);
        this.color = a.color;
        this.shownHook = a.shownHook;
    }

    makeContextMenu() {
        let itm;
        let menu = new core.Menu();
        itm = menu.addItem(new core.Menu.Item(this.isOpen ? "Close" : "Open"));
        itm.addHandler("trigger", e => {
            this.isOpen = !this.isOpen;
        });
        itm = menu.addItem(new core.Menu.Item(this.shown ? "Hide" : "Show"));
        itm.addHandler("trigger", e => {
            this.shown = !this.shown;
        });
        itm = menu.addItem(new core.Menu.Item("Remove"));
        itm.addHandler("trigger", e => {
            this.eRemoveBtn.click();
        });
        menu.addItem(new core.Menu.Divider());
        itm = menu.addItem(new core.Menu.Item("Colors"));
        let submenu = itm.menu;
        lib.COLORS.forEach(colors => {
            itm = submenu.addItem(new core.Menu.Item(colors.name));
            itm.eLabel.style.color = "var(--"+colors._+")";
            itm.addHandler("trigger", e => {
                this.color = "--"+colors._;
            });
        });
        return menu;
    }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.eDisplayName.textContent = this.path;
    }
    get shown() { return this.#shown; }
    set shown(v) {
        v = !!v;
        if (this.shown == v) return;
        this.change("shown", this.shown, this.#shown=v);
        this.eShow.checked = this.shown;
    }
    get hidden() { return !this.shown; }
    set hidden(v) { this.shown = !v; }
    show() { return this.shown = true; }
    hide() { return this.hidden = true; }
    get color() { return this.#color; }
    set color(v) {
        v = (v == null) ? null : String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
        let color = this.hasColor() ? this.color.startsWith("--") ? PROPERTYCACHE.get(this.color) : this.color : "#fff";
        this.eShowBox.style.setProperty("--bgc", color);
        this.eShowBox.style.setProperty("--bgch", color);
        this.eDisplayName.style.color = color;
        this.eColorPickerColors.forEach(btn => {
            if (btn.color == this.color) btn.classList.add("this");
            else btn.classList.remove("this");
        });
    }
    hasColor() { return this.color != null; }

    get fHooks() { return this.#fHooks; }

    get hooks() { return [this.shownHook]; }
    get shownHook() { return this.#shownHook; }
    set shownHook(o) { this.shownHook.from(o); }
    get isShown() {
        if (!this.shown) return false;
        if (this.shownHook.value == null) return true;
        if (this.shownHook.toggle.value)
            return !this.shownHook.value;
        return this.shownHook.value;
    }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.isClosed) return null;
        for (let hook of this.hooks) {
            let r = hook.eBox.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            return {
                r: r,
                round: true,
                submit: () => {
                    hook.path = data.path;
                },
            };
        }
        return null;
    }

    get state() { return this.#state; }

    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eShowBox() { return this.#eShowBox; }
    get eShow() { return this.#eShow; }
    get eShowDisplay() { return this.#eShowDisplay; }
    get eDisplayName() { return this.#eDisplayName; }
    get eWarning() { return this.#eWarning; }
    get eWarningTooltip() { return this.#eWarningTooltip; }
    get eRemoveBtn() { return this.#eRemoveBtn; }
    get eContent() { return this.#eContent; }
    get eColorPicker() { return this.#eColorPicker; }
    get eColorPickerColors() { return [...this.#eColorPickerColors]; }

    get isOpen() { return this.elem.classList.contains("open"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        if (v) this.elem.classList.add("open");
        else this.elem.classList.remove("open");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get disabled() { return this.elem.classList.contains("disabled"); }
    set disabled(v) {
        v = !!v;
        if (this.disabled == v) return;
        if (v) this.elem.classList.add("disabled");
        else this.elem.classList.remove("disabled");
    }
    get enabled() { return !this.enabled; }
    set enabled(v) { this.disabled = !v; }
    disable(warning) {
        this.showWarning = true;
        this.warning = warning;
        return this.disabled = true;
    }
    enable() {
        this.showWarning = false;
        return this.enabled = true;
    }

    get showWarning() { return this.eWarning.classList.contains("this"); }
    set showWarning(v) {
        if (v) this.eWarning.classList.add("this");
        else this.eWarning.classList.remove("this");
    }
    get warning() { return this.eWarningTooltip.textContent; }
    set warning(v) { this.eWarningTooltip.textContent = v; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            shown: this.shown,
            color: this.color,
            shownHook: this.shownHook.to(),
        });
    }
};
PanelOdometryTab.Pose.State = class PanelOdometryTabPoseState extends util.Target {
    #tab;
    #parent;
    #pose;

    constructor() {
        super();

        this.#tab = null;
        this.#parent = null;
        this.#pose = null;

        this.compute();
    }

    get tab() { return this.#tab; }
    set tab(v) {
        v = (v instanceof PanelOdometryTab) ? v : null;
        if (this.tab == v) return;
        this.destroy();
        this.#tab = v;
        this.compute();
        this.create();
    }
    hasTab() { return !!this.tab; }
    get parent() { return this.#parent; }
    hasParent() { return !!this.parent; }
    compute() {
        this.#parent = this.hasTab() ? this.tab.parent : null;
    }
    get app() { return app.App.instance; }
    get page() { return this.app.projectPage; }
    get pose() { return this.#pose; }
    set pose(v) {
        v = (v instanceof PanelOdometryTab.Pose) ? v : null;
        if (this.pose == v) return;
        this.destroy();
        this.#pose = v;
        this.create();
    }
    hasPose() { return !!this.pose; }

    destroy() { return; }
    create() { return; }
    update(delta) { this.post("update", delta); }
};
