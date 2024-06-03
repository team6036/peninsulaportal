import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as odometry from "../../odometry.mjs";
import { THREE, Odometry2d, Odometry3d } from "../../odometry.mjs";
import * as app from "../../app.mjs";


import PanelToolCanvasTab from "./toolcanvastab.js";
import PanelOdometryTab from "./odometrytab.js";


class RLine extends Odometry2d.Render {
    #waypoints;
    #color;
    #size;

    constructor(odometry, color, size=7.5) {
        super(odometry);

        this.#waypoints = [];
        this.#color = null;
        this.#size = 0;

        this.color = color;
        this.size = size;

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            ctx.strokeStyle = this.color.startsWith("--") ? PROPERTYCACHE.get(this.color) : this.color;
            ctx.lineWidth = this.size*quality;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.beginPath();
            for (let i = 0; i < this.nWaypoints; i++) {
                if (i > 0) ctx.lineTo(...this.odometry.worldToCanvas(this.#waypoints[i]).xy);
                else ctx.moveTo(...this.odometry.worldToCanvas(this.#waypoints[i]).xy);
            }
            ctx.stroke();
        });
    }

    get nWaypoints() { return this.#waypoints.length; }
    get waypoints() { return [...this.#waypoints]; }
    set waypoints(v) {
        v = util.ensure(v, "arr");
        this.clearWaypoints();
        this.addWaypoint(v);
    }
    clearWaypoints() {
        let waypoints = this.waypoints;
        this.#waypoints = [];
        return waypoints;
    }
    getWaypoint(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.#waypoints.length) return null;
        return this.#waypoints[i];
    }
    setWaypoint(i, pt) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.#waypoints.length) return null;
        pt = (pt instanceof V) ? pt : new V(pt);
        [pt, this.#waypoints[i]] = [this.#waypoints[i], pt];
        return pt;
    }
    addWaypoint(...pts) {
        return util.Target.resultingForEach(pts, pt => {
            pt = (pt instanceof V) ? pt : new V(pt);
            this.#waypoints.push(pt);
            return pt;
        });
    }
    remWaypoint(...pts) {
        return util.Target.resultingForEach(pts, pt => {
            pt = (pt instanceof V) ? pt : new V(pt);
            this.#waypoints.splice(this.#waypoints.indexOf(pt), 1);
            return pt;
        });
    }
    popWaypoint(...is) {
        return util.Target.resultingForEach(is, i => {
            i = util.ensure(i, "int");
            if (i < 0 || i >= this.#waypoints.length) return false;
            return this.#waypoints.splice(i, 1)[0];
        });
    }

    get color() { return this.#color; }
    set color(v) { this.#color = String(v); }

    get size() { return this.#size; }
    set size(v) { this.#size = Math.max(0, util.ensure(v, "num")); }
}


export default class PanelOdometry2dTab extends PanelOdometryTab {
    #odometry;

    #size;
    #robotSize;

    #lengthUnits;
    #angleUnits;
    #origin;

    #fSize;
    #fRobotSize;
    #fQuality;
    #fUnitsLength1;
    #fUnitsLength2;
    #fUnitsAngle;
    #fOriginBlue;
    #fOriginRed;

    static NAME = "Odometry2d";
    static NICKNAME = "Odom2d";

    static PATTERNS = {
        "Pose2d": [
            ["translation", "x"],
            ["translation", "y"],
            ["rotation", "value"],
        ],
    };

    constructor(a) {
        super(a);

        this.#odometry = new Odometry2d(this.eContent);
        this.addHandler("add", () => {
            this.app.addHint(this.odometry.hints);
        });
        this.addHandler("rem", () => {
            this.app.remHint(this.odometry.hints);
        });
        this.odometry.addHandler("change-addHint", (_, hint) => {
            this.app.addHint(hint);
        });
        this.odometry.addHandler("change-remHint", (hint, _) => {
            this.app.remHint(hint);
        });
        this.addHandler("change-lengthUnits", () => {
            this.odometry.unit = this.lengthUnits;
        });

        this.#size = new V(1000);
        this.#robotSize = new V(100);

        this.size.addHandler("change", (c, f, t) => this.change("size."+c, f, t));
        this.robotSize.addHandler("change", (c, f, t) => this.change("robotSize."+c, f, t));

        this.#lengthUnits = null;
        this.#angleUnits = null;
        this.#origin = null;

        let apply;

        const eField = this.getEOptionSection("f");
        let fieldForm = new core.Form();
        eField.appendChild(fieldForm.elem);
        this.#fSize = fieldForm.addField(new core.Form.Input2d("map-size"));
        this.fSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fSize.baseType = "m";
        this.fSize.step = 0.1;
        this.fSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
        });
        this.fSize.addHandler("change-value", () => {
            this.size = this.fSize.value;
        });
        apply = () => {
            this.fSize.value = this.size;
        };
        this.addHandler("change-size.x", apply);
        this.addHandler("change-size.y", apply);
        this.#fRobotSize = fieldForm.addField(new core.Form.Input2d("robot-size"));
        this.fRobotSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fRobotSize.baseType = "m";
        this.fRobotSize.step = 0.1;
        this.fRobotSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
        });
        this.fRobotSize.addHandler("change-value", () => {
            this.robotSize = this.fRobotSize.value;
        });
        apply = () => {
            this.fRobotSize.value = this.robotSize;
        };
        this.addHandler("change-robotSize.x", apply);
        this.addHandler("change-robotSize.y", apply);

        this.addHandler("change-template", () => {
            this.fSize.isShown = this.fRobotSize.isShown = this.template == null;
        });

        const eOptions = this.getEOptionSection("o");
        let optionsForm = new core.Form();
        eOptions.appendChild(optionsForm.elem);
        optionsForm.side = "center";

        this.#fQuality = optionsForm.addField(new core.Form.SelectInput(
            "quality",
            [{ value: 2, name: "High (4x)" }, { value: 1, name: "Low (1x)" }],
        ));
        this.fQuality.addHandler("change-value", () => {
            this.odometry.quality = this.fQuality.value;
        });
        this.fQuality.value = this.odometry.quality;

        this.#fUnitsLength1 = optionsForm.addField(new core.Form.SelectInput(
            "length-units",
            [{ value: "m", name: "Meters" }, { value: "cm", name: "Centimeters" }],
        ));
        this.fUnitsLength1.mergeBottom = true;
        this.fUnitsLength1.addHandler("change-value", () => {
            if (!this.fUnitsLength1.hasValue()) return;
            this.lengthUnits = this.fUnitsLength1.value;
        });
        this.#fUnitsLength2 = optionsForm.addField(new core.Form.SelectInput(
            "length-units",
            [{ value: "yd", name: "Yards" }, { value: "ft", name: "Feet" }],
        ));
        this.fUnitsLength2.showHeader = false;
        this.fUnitsLength2.mergeTop = true;
        this.fUnitsLength2.addHandler("change-value", () => {
            if (!this.fUnitsLength2.hasValue()) return;
            this.lengthUnits = this.fUnitsLength2.value;
        });
        this.addHandler("change-lengthUnits", () => {
            this.fUnitsLength1.value = this.lengthUnits;
            this.fUnitsLength2.value = this.lengthUnits;
        });

        this.#fUnitsAngle = optionsForm.addField(new core.Form.SelectInput(
            "angle-units",
            [{ value: "deg", name: "Degrees" }, { value: "rad", name: "Radians" }, { value: "cycle", name: "Cycles" }],
        ));
        this.fUnitsAngle.addHandler("change-value", () => {
            this.angleUnits = this.fUnitsAngle.value;
        });
        this.addHandler("change-angleUnits", () => {
            this.fUnitsAngle.value = this.angleUnits;
        });

        this.#fOriginBlue = optionsForm.addField(new core.Form.SelectInput(
            "origin",
            [{ value: "blue+", name: "+Blue" }, { value: "blue-", name: "-Blue" }],
        ));
        this.fOriginBlue.mergeBottom = true;
        this.fOriginBlue.addHandler("change-value", () => {
            if (!this.fOriginBlue.hasValue()) return;
            this.origin = this.fOriginBlue.value;
        });
        const applyBlue = () => Array.from(this.fOriginBlue.eContent.children).forEach(elem => (elem.style.color = "var(--cb)"));
        this.fOriginBlue.addHandler("change", applyBlue);
        applyBlue();

        this.#fOriginRed = optionsForm.addField(new core.Form.SelectInput(
            "origin",
            [{ value: "red+", name: "+Red" }, { value: "red-", name: "-Red" }],
        ));
        this.fOriginRed.showHeader = false;
        this.fOriginRed.mergeTop = true;
        this.fOriginRed.addHandler("change-value", () => {
            if (!this.fOriginRed.hasValue()) return;
            this.origin = this.fOriginRed.value;
        });
        const applyRed = () => Array.from(this.fOriginRed.eContent.children).forEach(elem => (elem.style.color = "var(--cr)"));
        this.fOriginRed.addHandler("change", applyRed);
        applyRed();

        this.addHandler("change-origin", () => {
            this.fOriginBlue.value = this.origin;
            this.fOriginRed.value = this.origin;
        });

        const updateResize = () => {
            let r = optionsForm.elem.getBoundingClientRect();
            let small = r.width < 250;
            const makeMapValue = f => {
                return data => {
                    if (small) {
                        if ("name2" in data) return data;
                        return { value: data.value, name: f(String(data.value), String(data.name)), name2: data.name };
                    } else {
                        if ("name2" in data) return { value: data.value, name: data.name2 };
                        return data;
                    }
                };
            };
            this.fQuality.values = this.fQuality.values.map(makeMapValue((_, n) => n.slice(0, 2)));
            this.fUnitsLength1.values = this.fUnitsLength1.values.map(makeMapValue(v => v.toUpperCase()));
            this.fUnitsLength2.values = this.fUnitsLength2.values.map(makeMapValue(v => v.toUpperCase()));
            this.fUnitsAngle.values = this.fUnitsAngle.values.map(makeMapValue(v => v.toUpperCase()));
        };
        new ResizeObserver(updateResize).observe(optionsForm.elem);
        this.addHandler("add", updateResize);

        this.quality = this.odometry.quality;

        const updateSize = () => {
            this.fSize.value = this.size;
            this.fRobotSize.value = this.robotSize;
            this.fSize.activeType = this.fRobotSize.activeType = this.lengthUnits;
        };
        this.addHandler("change-size.x", updateSize);
        this.addHandler("change-size.y", updateSize);
        this.addHandler("change-robotSize.x", updateSize);
        this.addHandler("change-robotSize.y", updateSize);
        this.addHandler("change-lengthUnits", updateSize);
        updateSize();

        this.addHandler("update", delta => {
            if (this.isClosed) return;

            if (GLOBALSTATE.getting) return;

            this.odometry.template = this.template;
            this.odometry.emptySize = this.size;

            if (this.isClosed) return;
            const source = this.page.source;
            this.poses.forEach(pose => {
                pose.hooks.forEach(hook => {
                    let node = (source && hook.hasPath()) ? source.tree.lookup(hook.path) : null;
                    hook.setFrom((node && node.hasField()) ? node.field.type : "*", (node && node.hasField()) ? node.field.get() : null);
                });
                pose.state.pose = pose;
                let node = source ? source.tree.lookup(pose.path) : null;
                pose.state.value = node ? this.getValue(node) : null;
                pose.state.trail = (pose.useTrail && node) ? this.getValueRange(node, source.playback.ts-pose.trail, source.playback.ts) : null;
                pose.state.update(delta);
            });
            this.odometry.update(delta);
        });

        this.applyGlobal();

        a = util.ensure(a, "obj");
        this.size = a.size || 10;
        this.robotSize = a.robotSize || 1;
        this.lengthUnits = util.ensure(a.lengthUnits, "str", "m");
        this.angleUnits = util.ensure(a.angleUnits, "str", "deg");
        this.origin = util.ensure(a.origin, "str", "blue+");
    }

    get odometry() { return this.#odometry; }

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
    get origin() { return this.#origin; }
    set origin(v) {
        v = String(v);
        if (!["blue+", "blue-", "red+", "red-"].includes(v)) v = "blue+";
        if (this.origin == v) return;
        this.change("origin", this.origin, this.#origin=v);
    }

    get fSize() { return this.#fSize; }
    get fRobotSize() { return this.#fRobotSize; }
    get fQuality() { return this.#fQuality; }
    get fUnitsLength1() { return this.#fUnitsLength1; }
    get fUnitsLength2() { return this.#fUnitsLength2; }
    get fUnitsAngle() { return this.#fUnitsAngle; }
    get fOriginBlue() { return this.#fOriginBlue; }
    get fOriginRed() { return this.#fOriginRed; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            poses: this.poses,
            template: this.template,
            size: this.size,
            robotSize: this.robotSize,
            lengthUnits: this.lengthUnits,
            angleUnits: this.angleUnits,
            origin: this.origin,
            optionState: this.optionState,
        });
    }
}
PanelOdometry2dTab.Pose = class PanelOdometry2dTabPose extends PanelOdometryTab.Pose {
    #ghost;
    #type;
    #trail;
    #useTrail;

    #ghostHook;

    #fTrail;
    #fType;

    #eGhostBtn;

    constructor(a) {
        super(a);

        this.#ghost = false;
        this.#type = null;
        this.#trail = null;
        this.#useTrail = null;

        this.#eGhostBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eGhostBtn);
        this.eGhostBtn.textContent = "Ghost";
        this.eGhostBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.ghost = !this.ghost;
        });

        const hooksSubform = this.fHooks.form;

        this.#ghostHook = new PanelToolCanvasTab.Hook("Ghost Hook", null);
        this.ghostHook.toggle.show();
        this.ghostHook.addHandler("change", (c, f, t) => this.change("ghostHook."+c, f, t));

        hooksSubform.addField(new core.Form.HTML("ghost-hook", this.ghostHook.elem));

        const form = new core.Form();
        this.eContent.appendChild(form.elem);

        this.#trail = null;
        this.#useTrail = null;

        this.#fTrail = form.addField(new core.Form.Input1d("trail-duration"));
        this.fTrail.types = ["ms", "s", "min"];
        this.fTrail.baseType = "ms";
        this.fTrail.activeType = "s";
        this.fTrail.step = 0.1;
        this.fTrail.showToggle = true;
        this.fTrail.addHandler("change-toggleOn", () => {
            this.useTrail = this.fTrail.toggleOn;
        });
        this.fTrail.addHandler("change-value", () => {
            this.trail = this.fTrail.value;
        });

        this.#fType = form.addField(new core.Form.DropdownInput("display-type", () => {
            let menu = new core.Menu();
            Odometry2d.Robot.buildMenu(menu, this.type).addHandler("type", k => (this.type = k));
            return menu;
        }));
        this.fType.showHeader = false;
        this.fType.addHandler("change", () => {
            this.fType.btn = Odometry2d.Robot.getTypeName(this.fType.value);
        });
        this.addHandler("change-type", () => (this.fType.value = this.type));

        this.trail = 0;
        this.useTrail = false;

        a = util.ensure(a, "obj");
        this.ghost = a.ghost;
        this.type = a.type || Odometry2d.Robot.TYPES[0];
        this.ghostHook = a.ghostHook;
        this.trail = a.trail;
        this.useTrail = a.useTrail;
    }
    
    makeContextMenu() {
        let itm;
        let menu = super.makeContextMenu();
        itm = menu.addItem(new core.Menu.Item("Types"));
        Odometry2d.Robot.buildMenu(itm.menu, this.type).addHandler("type", k => (this.type = k));
        itm = menu.addItem(new core.Menu.Item("Ghost", this.ghost ? "checkmark" : ""));
        itm.addHandler("trigger", e => {
            this.ghost = !this.ghost;
        });
        return menu;
    }

    get ghost() { return this.#ghost; }
    set ghost(v) {
        v = !!v;
        if (this.ghost == v) return;
        this.change("ghost", this.ghost, this.#ghost=v);
        if (this.ghost)
            this.eGhostBtn.classList.add("this");
        else this.eGhostBtn.classList.remove("this");
    }
    get type() { return this.#type; }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (v != null && v.startsWith("§") && !Odometry2d.Robot.TYPES.includes(v)) v = Odometry2d.Robot.TYPES[0];
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
    }

    get hooks() { return [...super.hooks, this.ghostHook]; }
    get ghostHook() { return this.#ghostHook; }
    set ghostHook(o) { this.ghostHook.from(o); }
    get isGhost() {
        if (this.ghost) return true;
        if (this.ghostHook.value == null) return false;
        if (this.ghostHook.toggle.value)
            return !this.ghostHook.value;
        return this.ghostHook.value;
    }

    get trail() { return this.#trail; }
    set trail(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.trail == v) return;
        this.change("trail", this.trail, this.#trail=v);
        this.fTrail.value = this.trail;
    }
    get useTrail() { return this.#useTrail; }
    set useTrail(v) {
        v = !!v;
        if (this.useTrail == v) return;
        this.change("useTrail", this.useTrail, this.#useTrail=v);
        this.fTrail.toggleOn = this.useTrail;
        this.fTrail.disabled = !this.useTrail;
        this.fTrail.showContent = this.useTrail;
        this.fTrail.eTypeBtn.style.display = this.useTrail ? "" : "none";
    }

    get fTrail() { return this.#fTrail; }
    get fType() { return this.#fType; }

    get eGhostBtn() { return this.#eGhostBtn; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            shown: this.shown,
            color: this.color,
            ghost: this.ghost,
            type: this.type,
            shownHook: this.shownHook.to(),
            ghostHook: this.ghostHook.to(),
            trail: this.trail,
            useTrail: this.useTrail,
        });
    }
};
PanelOdometry2dTab.Pose.State = class PanelOdometry2dTabPoseState extends PanelOdometryTab.Pose.State {
    #value;
    #trail;

    #renders;
    #trailRenders;

    constructor() {
        super();

        this.#value = [];
        this.#trail = [];

        this.#renders = [];
        this.#trailRenders = [];

        const templates = GLOBALSTATE.getProperty("templates").value;

        const convertPos = (...v) => {
            v = new V(...v);
            if (!this.hasTab()) return v;
            v = v.map(v => lib.Unit.convert(v, this.tab.lengthUnits, "m"));
            if (!this.tab.origin.startsWith("blue")) v.x = this.tab.odometry.w-v.x;
            if (!this.tab.origin.endsWith("+")) v.y = this.tab.odometry.h-v.y;
            return v;
        };
        const convertAngle = v => {
            v = util.ensure(v, "num");
            if (!this.hasTab()) return v;
            v = lib.Unit.convert(v, this.tab.angleUnits, "deg");
            if (!this.tab.origin.startsWith("blue")) v = 180-v;
            if (!this.tab.origin.endsWith("+")) v = 0-v;
            return v;
        };

        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            if (!this.hasPose()) return;
            const renders = this.#renders;
            const trailRenders = this.#trailRenders;
            if (this.value.length <= 0) return this.pose.disable("No data");
            const value = this.pose.isShown ? this.value : [];
            this.pose.enable();
            if (value.length > 0 && value.length % 3 == 0) {
                let l = value.length / 3;
                while (renders.length < l) renders.push(this.tab.odometry.render.addRender(new Odometry2d.Robot(this.tab.odometry.render)));
                if (renders.length > l) this.tab.odometry.render.remRender(renders.splice(l));
                let color = this.pose.color.slice(2);
                let colorH = color+5;
                for (let i = 0; i < l; i++) {
                    const render = renders[i];
                    render.name = this.pose.path;
                    render.color = color;
                    render.colorH = colorH;
                    render.alpha = this.pose.isGhost ? 0.5 : 1;
                    render.size = (this.tab.template in templates) ? util.ensure(templates[this.tab.template], "obj").robotSize : this.tab.robotSize;
                    render.pos = convertPos(value[3*i+0], value[3*i+1]);
                    render.heading = convertAngle(value[3*i+2]);
                    render.type = this.pose.type;
                    render.showVelocity = false;
                }
                const n = util.ensure(this.trail.n, "int");
                let m = 0;
                const v = util.ensure(this.trail.v, "arr").map((pose, i) => {
                    pose = util.ensure(pose, "arr");
                    if (i > 0) m = Math.min(m, pose.length);
                    else m = pose.length;
                    return pose;
                });
                if (m == value.length) {
                    while (trailRenders.length < l) trailRenders.push(this.tab.odometry.render.addRender(new RLine(this.tab.odometry.render, null, 2.5)));
                    if (trailRenders.length > l) this.tab.odometry.render.remRender(trailRenders.splice(l));
                    for (let i = 0; i < l; i++) {
                        const render = trailRenders[i];
                        render.color = this.pose.color;
                        render.alpha = this.pose.isGhost ? 0.25 : 0.5;
                        if (render.nWaypoints < n) render.addWaypoint(new Array(n-render.nWaypoints).fill(0));
                        if (render.nWaypoints > n) render.popWaypoint(Array.from(new Array(render.nWaypoints-n).keys()));
                        for (let j = 0; j < n; j++)
                            render.getWaypoint(j).set(convertPos(v[j][i*3+0], v[j][i*3+1]));
                    }
                } else if (trailRenders.length > 0) this.tab.odometry.render.remRender(trailRenders.splice(0));
                this.pose.fTrail.isShown = true;
                this.pose.fType.disabled = false;
            } else if (value.length > 0 && value.length % 2 == 0) {
                while (renders.length < 1) renders.push(this.tab.odometry.render.addRender(new RLine(this.tab.odometry.render)));
                if (renders.length > 1) this.tab.odometry.render.remRender(renders.splice(1));
                const render = renders[0];
                let l = value.length/2;
                if (render.nWaypoints < l) render.addWaypoint(new Array(l-render.nWaypoints).fill(0));
                if (render.nWaypoints > l) render.popWaypoint(Array.from(new Array(render.nWaypoints-l).keys()));
                for (let i = 0; i < l; i++)
                    render.getWaypoint(i).set(convertPos(value[i*2+0], value[i*2+1]));
                if (this.trail.length == this.value.length) {
                    let trailL = 0;
                    this.trail.forEach((trail, i) => {
                        let l = trail.length;
                        if (i <= 0) return trailL = l;
                        trailL = Math.min(trailL, l);
                    });
                    while (trailRenders.length < l) trailRenders.push(this.tab.odometry.render.addRender(new RLine(this.tab.odometry.render, null, 0.025)));
                    if (trailRenders.length > l) this.tab.odometry.render.remRender(trailRenders.splice(l));
                    for (let i = 0; i < l; i++) {
                        const render = trailRenders[i];
                        render.color = this.pose.color;
                        render.alpha = this.pose.isGhost ? 0.25 : 0.5;
                        if (render.nWaypoints < trailL) render.addWaypoint(new Array(trailL-render.nWaypoints).fill(0));
                        if (render.nWaypoints > trailL) render.popWaypoint(Array.from(new Array(render.nWaypoints-trailL).keys()));
                        for (let j = 0; j < trailL; j++)
                            render.getWaypoint(j).set(convertPos(this.trail[i*2+0][j].v, this.trail[i*2+1][j].v));
                    }
                } else if (trailRenders.length > 0) this.tab.odometry.render.remRender(trailRenders.splice(0));
                this.pose.fTrail.isShown = false;
                this.pose.fType.disabled = true;
            } else {
                if (renders.length > 0) this.tab.odometry.render.remRender(renders.splice(0));
                if (trailRenders.length > 0) this.tab.odometry.render.remRender(trailRenders.splice(0));
                if (value.length > 0) this.pose.disable("Unable to extrapolate type, length = "+value.length);
            }
        });
    }

    get value() { return this.#value; }
    set value(v) {
        v = util.ensure(v, "arr").map(v => util.ensure(v, "num"));
        if (this.value.length == v.length) {
            this.#value = v;
            return;
        }
        this.destroy();
        this.#value = v;
        this.create();
    }
    get trail() { return this.#trail; }
    set trail(v) { this.#trail = util.ensure(v, "obj"); }

    destroy() {
        this.destroyTrail();
        if (!this.hasTab()) return;
        this.#renders.forEach(render => this.tab.odometry.render.remRender(render));
        this.#renders = [];
    }
    create() {
        this.createTrail();
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        this.#renders = [];
    }
    destroyTrail() {
        if (!this.hasTab()) return;
        this.#trailRenders.forEach(render => this.tab.odometry.render.remRender(render));
        this.#trailRenders = [];
    }
    createTrail() {
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        this.#trailRenders = [];
    }
};
