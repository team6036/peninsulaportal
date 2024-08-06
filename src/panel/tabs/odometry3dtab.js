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


export default class PanelOdometry3dTab extends PanelOdometryTab {
    #odometry;

    #fViewRenderType;
    #fViewControlType;
    #fViewCinematic;
    #fQuality;
    #fUnitsLength1;
    #fUnitsLength2;
    #fUnitsAngle;
    #fOriginBlue;
    #fOriginRed;
    #fCameraPos;

    #cameraHook;

    static NAME = "Odometry3d";
    static NICKNAME = "Odom3d";

    static CREATECTX = false;

    constructor(a) {
        super(a);

        this.addHandler("rem", () => {
            this.odometry.renderer.forceContextLoss();
        });

        const eInfo = document.createElement("div");
        this.eContent.appendChild(eInfo);
        eInfo.classList.add("info");
        eInfo.innerHTML = "   [W]\n[A][S][D]\n[ Space ] Up\n[ Shift ] Down\n[  Esc  ] Leave Pointer Lock";

        this.#odometry = new Odometry3d(this.eContent);
        this.odometry.addHandler("change", (c, f, t) => this.change("odometry."+c, f, t));
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

        this.quality = this.odometry.quality = 2;

        const eField = this.getEOptionSection("f");

        const eOptions = this.getEOptionSection("o");

        let optionsForm = new core.Form();
        eOptions.appendChild(optionsForm.elem);
        optionsForm.side = "center";

        let update;

        this.#fViewRenderType = optionsForm.addField(new core.Form.SelectInput(
            "camera-type",
            [{ value: "proj", name: "Projection" }, { value: "iso", name: "Isometric" }],
        ));
        this.fViewRenderType.showHeader = false;
        this.fViewRenderType.addHandler("change-value", () => {
            this.odometry.renderType = this.fViewRenderType.value;
        });
        update = () => {
            this.fViewRenderType.value = this.odometry.renderType;
        };
        this.addHandler("change-odometry.renderType", update);
        update();

        this.#fViewControlType = optionsForm.addField(new core.Form.SelectInput(
            "movement-type",
            [{ value: "orbit", name: "Orbit" }, { value: "free", name: "Free" }, { value: "pan", name: "Pan" }],
        ));
        this.fViewControlType.showHeader = false;
        this.fViewControlType.addHandler("change-value", () => {
            this.odometry.controlType = this.fViewControlType.value;
        });
        update = () => {
            this.fViewControlType.value = this.odometry.controlType;
        };
        this.addHandler("change-odometry.controlType", update);
        update();

        this.#fViewCinematic = optionsForm.addField(new core.Form.ToggleInput("cinematic", "Cinematic"));
        this.fViewCinematic.showHeader = false;
        this.fViewCinematic.addHandler("change-value", () => {
            this.odometry.isCinematic = this.fViewCinematic.value;
        });
        update = () => {
            this.fViewCinematic.value = this.odometry.isCinematic;
        };
        this.addHandler("change-odometry.isCinematic", update);
        update();

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
            this.odometry.origin = this.fOriginBlue.value;
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
            this.odometry.origin = this.fOriginRed.value;
        });
        const applyRed = () => Array.from(this.fOriginRed.eContent.children).forEach(elem => (elem.style.color = "var(--cr)"));
        this.fOriginRed.addHandler("change", applyRed);
        applyRed();

        update = () => {
            this.fOriginBlue.value = this.odometry.origin;
            this.fOriginRed.value = this.odometry.origin;
        };
        this.addHandler("change-odometry.origin", update);
        update();

        optionsForm.addField(new core.Form.Header("View"));

        let viewForm = new core.Form();
        eOptions.appendChild(viewForm.elem);

        this.#fCameraPos = viewForm.addField(new core.Form.Input3d("camera-position"));
        this.fCameraPos.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fCameraPos.baseType = "m";
        this.fCameraPos.step = 0.1;
        this.fCameraPos.inputs.forEach((inp, i) => {
            inp.placeholder = "XYZ"[i];
        });
        let ignore = false;
        this.fCameraPos.addHandler("change-value", () => {
            if (ignore) return;
            this.odometry.camera.position.x = this.fCameraPos.x;
            this.odometry.camera.position.y = this.fCameraPos.y;
            this.odometry.camera.position.z = this.fCameraPos.z;
        });
        this.addHandler("change-lengthUnits", () => {
            this.fCameraPos.activeType = this.lengthUnits;
        });

        this.#cameraHook = new PanelToolCanvasTab.Hook("Camera Hook");
        this.cameraHook.addHandler("change", (c, f, t) => this.change("cameraHook."+c, f, t));
        const cameraHookLock = this.cameraHook.addToggle(new PanelToolCanvasTab.Hook.Toggle("Lock", false));
        cameraHookLock.show();
        eOptions.appendChild(this.cameraHook.elem);

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
            this.fViewRenderType.values = this.fViewRenderType.values.map(makeMapValue(v => util.formatText(v)));
            this.fQuality.values = this.fQuality.values.map(makeMapValue((_, n) => n.slice(0, 2)));
            this.fUnitsLength1.values = this.fUnitsLength1.values.map(makeMapValue(v => v.toUpperCase()));
            this.fUnitsLength2.values = this.fUnitsLength2.values.map(makeMapValue(v => v.toUpperCase()));
            this.fUnitsAngle.values = this.fUnitsAngle.values.map(makeMapValue(v => v.toUpperCase()));
        };
        new ResizeObserver(updateResize).observe(optionsForm.elem);
        this.addHandler("add", updateResize);

        this.addHandler("change-lengthUnits", () => {
            this.fCameraPos.activeType = this.lengthUnits;
        });

        const render = this.odometry.addRender(new Odometry3d.Render(this.odometry, 0, "", "§box"));
        render.showObject = false;
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const rotationQuaternion = THREE.Quaternion.fromRotationSequence([
            { axis: "x", angle: -90 },
            { axis: "z", angle: -90 },
        ]);

        this.addHandler("update", delta => {
            if (this.isClosed) {
                if (this.odometry.controlType == "free")
                    this.odometry.controls.unlock();
                return;
            }
            
            const source = this.page.source;
            this.poses.forEach(pose => {
                pose.mainHooks.forEach(hook => {
                    let node = (source && hook.hasPath()) ? source.tree.lookup(hook.path) : null;
                    hook.setFrom((node && node.hasField()) ? node.field.type : "*", (node && node.hasField()) ? node.field.get() : null);
                });
                pose.poseHooks.forEach(hook => {
                    let node = (source && hook.hasPath()) ? source.tree.lookup(hook.path) : null;
                    hook.setFrom((node && node.hasField()) ? node.field.type : "*", this.getValue(node));
                });
                pose.state.pose = pose;
                let node = source ? source.tree.lookup(pose.path) : null;
                pose.state.value = this.getValue(node);
                pose.state.update(delta);
            });

            if (util.is(this.cameraHook.value, "arr")) {
                let value = this.cameraHook.value;
                const positioning = Odometry3d.generatePositioning(value, this.lengthUnits, this.angleUnits, cameraHookLock.value ? 0.5 : 0);
                render.defaultComponent.pos = positioning.pos;
                render.defaultComponent.q = positioning.q;
                if (render.defaultComponent.theObject) {
                    if (cameraHookLock.value) {
                        this.odometry.controlType = null;
                        render.defaultComponent.theObject.getWorldPosition(position);
                        quaternion.copy(render.defaultComponent.theObject.quaternion);
                        quaternion.multiply(odometry.THREE2WPILIB);
                        quaternion.premultiply(rotationQuaternion);
                        this.odometry.camera.position.copy(position);
                        this.odometry.camera.quaternion.copy(quaternion);
                    } else {
                        let [x0, y0, z0] = [position.x, position.y, position.z];
                        render.defaultComponent.theObject.getWorldPosition(position);
                        let [x1, y1, z1] = [position.x, position.y, position.z];
                        this.odometry.camera.position.set(
                            this.odometry.camera.position.x + (x1-x0),
                            this.odometry.camera.position.y + (y1-y0),
                            this.odometry.camera.position.z + (z1-z0),
                        );
                        if (this.odometry.controlType == "orbit")
                            this.odometry.controls.target.set(x1, y1, z1);
                        if (this.odometry.controlType == "pan")
                            this.odometry.controls.target.set(
                                this.odometry.controls.target.x + (x1-x0),
                                this.odometry.controls.target.y + (y1-y0),
                                this.odometry.controls.target.z + (z1-z0),
                            );
                    }
                }
            }

            ignore = true;
            for (let i = 0; i < 3; i++)
                this.fCameraPos["xyz"[i]] = this.odometry.camera.position["xyz"[i]];
            ignore = false;

            this.odometry.template = this.template;
            this.odometry.emptySize = this.size;

            this.odometry.update(delta);
        });

        this.applyGlobal();

        a = util.ensure(a, "obj");
        this.odometry.renderType = a.odometry ? a.odometry.renderType : a.renderType;
        this.odometry.controlType = a.odometry ? a.odometry.controlType : ("controlType" in a) ? a.controlType : "orbit";
        this.lengthUnits = util.ensure(a.lengthUnits, "str", "m");
        this.angleUnits = util.ensure(a.angleUnits, "str", "deg");
        this.odometry.origin = util.ensure(a.origin, "str", "blue+");
        this.cameraHook = a.cameraHook;
    }

    get odometry() { return this.#odometry; }

    get fViewRenderType() { return this.#fViewRenderType; }
    get fViewControlType() { return this.#fViewControlType; }
    get fViewCinematic() { return this.#fViewCinematic; }
    get fQuality() { return this.#fQuality; }
    get fUnitsLength1() { return this.#fUnitsLength1; }
    get fUnitsLength2() { return this.#fUnitsLength2; }
    get fUnitsAngle() { return this.#fUnitsAngle; }
    get fOriginBlue() { return this.#fOriginBlue; }
    get fOriginRed() { return this.#fOriginRed; }
    get fCameraPos() { return this.#fCameraPos; }

    get hooks() { return [...super.hooks, this.cameraHook]; }
    get cameraHook() { return this.#cameraHook; }
    set cameraHook(o) { this.cameraHook.from(o); }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            poses: this.poses,
            template: this.template,
            renderType: this.odometry.renderType,
            controlType: this.odometry.controlType,
            lengthUnits: this.lengthUnits,
            angleUnits: this.angleUnits,
            origin: this.odometry.origin,
            cameraHook: this.cameraHook.to(),
            optionState: this.optionState,
        });
    }
}
PanelOdometry3dTab.Pose = class PanelOdometry3dTabPose extends PanelOdometryTab.Pose {
    #ghost;
    #solid;
    #type;

    #ghostHook;
    #solidHook;
    #componentHooks;

    #fType;

    #eGhostBtn;
    #eSolidBtn;

    constructor(a) {
        super(a);

        this.#ghost = null;
        this.#solid = null;
        this.#type = "";

        this.#eGhostBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eGhostBtn);
        this.eGhostBtn.textContent = "Ghost";
        this.eGhostBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.ghost = !this.ghost;
        });

        this.#eSolidBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eSolidBtn);
        this.eSolidBtn.textContent = "Solid";
        this.eSolidBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.solid = !this.solid;
        });

        const hooksSubform = this.fHooks.form;

        this.#ghostHook = new PanelToolCanvasTab.Hook("Ghost Hook", null);
        this.ghostHook.toggle.show();
        this.ghostHook.addHandler("change", (c, f, t) => this.change("ghostHook."+c, f, t));
        this.#solidHook = new PanelToolCanvasTab.Hook("Solid Hook", null);
        this.solidHook.toggle.show();
        this.solidHook.addHandler("change", (c, f, t) => this.change("solidHook."+c, f, t));
        this.#componentHooks = {};

        hooksSubform.addField(
            new core.Form.HTML("ghost-hook", this.ghostHook.elem),
            new core.Form.HTML("solid-hook", this.solidHook.elem),
        );

        const form = new core.Form();
        this.eContent.appendChild(form.elem);

        this.#fType = form.addField(new core.Form.DropdownInput("display-type", () => {
            let menu = new core.Menu();
            Odometry3d.Render.buildMenu(menu, this.type).addHandler("type", k => (this.type = k));
            return menu;
        }));
        this.fType.showHeader = false;
        this.fType.addHandler("change", () => {
            this.fType.btn = Odometry3d.Render.getTypeName(this.fType.value);
        });
        this.addHandler("change-type", () => (this.fType.value = this.type));

        const componentsSubformField = form.addField(new core.Form.SubForm("components"));
        const componentsSubform = componentsSubformField.form;
        this.addHandler("change-type", () => {
            const robots = GLOBALSTATE.getProperty("robots").value;
            const robot = util.ensure(robots[this.type], "obj");
            const components = util.ensure(robot.components, "obj");
            componentsSubform.fields = [];
            this.#componentHooks = {};
            if (Object.keys(components).length <= 0) return componentsSubformField.isShown = false;
            componentsSubformField.isShown = true;
            for (let name in components) {
                const component = util.ensure(components[name], "obj");
                const hook = this.#componentHooks[name] = new PanelToolCanvasTab.Hook(component.name || name, null);
                hook.addHandler("change", (c, f, t) => this.change("componentHooks."+c, f, t));
                componentsSubform.addField(new core.Form.HTML(name, hook.elem));
            }
        });

        a = util.ensure(a, "obj");
        this.ghost = a.ghost;
        this.solid = a.solid;
        this.type = a.type || Odometry3d.Render.TYPES[0];
        this.ghostHook = a.ghostHook;
        this.solidHook = a.solidHook;
        this.componentHooks = a.componentHooks;
    }

    makeContextMenu() {
        let itm;
        let menu = super.makeContextMenu();
        itm = menu.addItem(new core.Menu.Item("Types"));
        let submenu = itm.menu;
        Odometry3d.Render.buildMenu(submenu, this.type).addHandler("type", k => (this.type = k));
        itm = menu.addItem(new core.Menu.Item("Ghost", this.ghost ? "checkmark" : ""));
        itm.addHandler("trigger", e => {
            this.ghost = !this.ghost;
        });
        itm = menu.addItem(new core.Menu.Item("Solid", this.solid ? "checkmark" : ""));
        itm.addHandler("trigger", e => {
            this.solid = !this.solid;
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
    get solid() { return this.#solid; }
    set solid(v) {
        v = !!v;
        if (this.solid == v) return;
        this.change("solid", this.solid, this.#solid=v);
        if (this.solid)
            this.eSolidBtn.classList.add("this");
        else this.eSolidBtn.classList.remove("this");
    }
    get type() { return this.#type; }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (v != null && v.startsWith("§") && !Odometry3d.Render.TYPES.includes(v)) v = Odometry3d.Render.TYPES[0];
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
    }

    get hooks() { return [...this.mainHooks, ...this.poseHooks]; }
    get mainHooks() { return [...super.hooks, this.ghostHook, this.solidHook]; }
    get poseHooks() { return Object.values(this.componentHooks); }
    get ghostHook() { return this.#ghostHook; }
    set ghostHook(o) { this.ghostHook.from(o); }
    get isGhost() {
        if (this.ghost) return true;
        if (this.ghostHook.value == null) return false;
        if (this.ghostHook.toggle.value)
            return !this.ghostHook.value;
        return this.ghostHook.value;
    }
    get solidHook() { return this.#solidHook; }
    set solidHook(o) { this.solidHook.from(o); }
    get isSolid() {
        if (this.solid) return true;
        if (this.solidHook.value == null) return false;
        if (this.solidHook.toggle.value)
            return !this.solidHook.value;
        return this.solidHook.value;
    }
    get componentHooks() {
        let hooks = {};
        for (let k in this.#componentHooks) hooks[k] = this.#componentHooks[k];
        return hooks;
    }
    set componentHooks(v) {
        v = util.ensure(v, "obj");
        for (let k in v) {
            if (!(k in this.#componentHooks)) continue;
            this.#componentHooks[k].from(v[k]);
        }
    }
    hasComponentHook(k) { return String(k) in this.#componentHooks; }
    getComponentHook(k) {
        if (!this.hasComponentHook(k)) return null;
        return this.#componentHooks[String(k)];
    }
    
    get fType() { return this.#fType; }

    get eGhostBtn() { return this.#eGhostBtn; }
    get eSolidBtn() { return this.#eSolidBtn; }

    toJSON() {
        const componentHooks = {};
        for (let k in this.#componentHooks) componentHooks[k] = this.#componentHooks[k].to();
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            shown: this.shown,
            color: this.color,
            ghost: this.ghost,
            solid: this.solid,
            type: this.type,
            shownHook: this.shownHook.to(),
            ghostHook: this.ghostHook.to(),
            solidHook: this.solidHook.to(),
            componentHooks: componentHooks,
        });
    }
};
PanelOdometry3dTab.Pose.State = class PanelOdometry3dTabPoseState extends PanelOdometryTab.Pose.State {
    #value;

    #renders;
    
    constructor() {
        super();
        
        this.#value = { type: null, values: [] };

        this.#renders = [];

        function convertAngle(v) {
            if (v.length == 1) return [Math.cos(v[0]/2), 0, 0, Math.sin(v[0]/2)];
            return v;
        }

        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            if (!this.hasPose()) return;
            const renders = this.#renders;

            const values = this.value;
            if (values.length <= 0) return this.pose.disable("No data");

            if (!this.pose.isShown) {
                if (renders.length > 0) this.tab.odometry.remRender(renders.splice(0));
                return;
            }

            this.pose.enable();

            while (renders.length < values.length) renders.push(this.tab.odometry.addRender(new Odometry3d.Render(this.tab.odometry)));
            if (renders.length > values.length) this.tab.odometry.remRender(renders.splice(values.length));
            for (let i = 0; i < values.length; i++) {
                const render = renders[i];
                render.name = this.pose.path;
                render.color = this.pose.color;
                render.isGhost = this.pose.isGhost;
                render.isSolid = this.pose.isSolid;
                render.display.type = 0;
                render.display.data = [];
                render.type = this.pose.type;
                render.defaultComponent.pos = values[i].translation;
                render.defaultComponent.q = convertAngle(values[i].rotation);
                render.components.forEach(k => {
                    const renderComp = render.getComponent(k);
                    if (!renderComp) return;
                    const poseComp = this.pose.getComponentHook(k);
                    if (!poseComp) return renderComp.pos = renderComp.q = 0;
                    const values = util.ensure(poseComp.value, "arr").map(v => {
                        v = util.ensure(v, "obj");
                        return {
                            translation: util.ensure(v.translation, "arr").map(v => util.ensure(v, "num")),
                            rotation: util.ensure(v.rotation, "arr").map(v => util.ensure(v, "num")),
                        };
                    });
                    if (values.length != 1) return renderComp.pos = renderComp.q = 0;
                    renderComp.pos = values[0].translation;
                    renderComp.q = values[0].rotation;
                });
            }
        });
    }

    get value() { return this.#value; }
    set value(v) {
        this.#value = util.ensure(v, "arr").map(v => {
            v = util.ensure(v, "obj");
            return {
                translation: util.ensure(v.translation, "arr").map(v => util.ensure(v, "num")),
                rotation: util.ensure(v.rotation, "arr").map(v => util.ensure(v, "num")),
            };
        });
    }

    destroy() {
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        this.#renders.forEach(render => this.tab.odometry.remRender(render));
        this.#renders = [];
    }
    create() {
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        this.#renders = [];
    }
};
