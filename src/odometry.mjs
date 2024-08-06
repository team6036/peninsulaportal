import * as util from "./util.mjs";
import { V } from "./util.mjs";
import * as lib from "./lib.mjs";

import * as core from "./core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "./core.mjs";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { MeshLine, MeshLineGeometry, MeshLineMaterial } from "../node_modules/@lume/three-meshline/dist/index.js";


export { THREE };

export const LOADER = new GLTFLoader();
Object.getPrototypeOf(LOADER).loadPromised = async function(url) {
    return await new Promise((res, rej) => this.load(url, res, null, rej));
};

THREE.Quaternion.fromRotationSequence = (...seq) => {
    if (seq.length == 1 && util.is(seq[0], "arr")) return THREE.Quaternion.fromRotationSequence(...seq[0]);
    let q = new THREE.Quaternion();
    seq.forEach(rot => {
        if (!(util.is(rot, "obj"))) return;
        if (!("axis" in rot) || !("angle" in rot)) return;
        let axis = rot.axis, angle = rot.angle;
        if (!util.is(axis, "str") || !util.is(angle, "num")) return;
        axis = axis.toLowerCase();
        if (!["x","y","z"].includes(axis)) return;
        let vec = new THREE.Vector3(+(axis=="x"), +(axis=="y"), +(axis=="z"));
        q.multiply(new THREE.Quaternion().setFromAxisAngle(vec, (Math.PI/180)*angle));
    });
    return q;
};

export const WPILIB2THREE = THREE.Quaternion.fromRotationSequence(
    {
        axis: "x",
        angle: 90,
    },
    {
        axis: "y",
        angle: 180,
    },
);
export const THREE2WPILIB = WPILIB2THREE.clone().invert();


export class Odometry extends util.Target {
    #elem;
    #canvas;
    #overlay;
    #quality;
    #mouse;

    #doRender;

    #template;

    #size;
    #emptySize;

    #hints;

    constructor(elem) {
        super();

        if (!(elem instanceof HTMLDivElement)) elem = document.createElement("div");
        this.#elem = elem;
        this.elem.classList.add("odom");
        this.#canvas = elem.querySelector(":scope > canvas") || document.createElement("canvas");
        this.elem.appendChild(this.canvas);
        this.canvas.tabIndex = 1;
        this.#overlay = elem.querySelector(":scope > .overlay") || document.createElement("div");
        this.elem.appendChild(this.overlay);
        this.overlay.classList.add("overlay");
        this.#quality = 0;
        this.#mouse = new V(-1);

        this.#doRender = true;

        this.#template = null;

        this.#size = new V();
        this.#emptySize = new V();

        this.#hints = new Set();

        this.canvas.addEventListener("mousemove", e => this.mouse.set(e.pageX, e.pageY));
        this.canvas.addEventListener("mouseleave", e => this.mouse.set(-1));

        this.quality = 2;

        this.size = 0;
        this.emptySize = 10;

        this.addHandler("update", delta => {
            const templates = GLOBALSTATE.getProperty("templates").value;
            if (this.hasTemplate() && templates[this.template])
                this.size = templates[this.template].size;
            else this.size = this.emptySize;
            if (!this.doRender) return;
            this.rend(delta);
        });
    }

    rend(delta) { this.post("render", delta); }

    get elem() { return this.#elem; }
    get canvas() { return this.#canvas; }
    get overlay() { return this.#overlay; }
    get quality() { return this.#quality; }
    set quality(v) {
        v = Math.max(1, util.ensure(v, "int"));
        if (this.quality == v) return;
        this.change("quality", this.quality, this.#quality=v);
    }
    get mouse() { return this.#mouse; }

    get doRender() { return this.#doRender; }
    set doRender(v) { this.#doRender = !!v; }

    get template() { return this.#template; }
    set template(v) {
        v = (v == null) ? null : String(v);
        if (this.template == v) return;
        this.change("template", this.template, this.#template=v);
    }
    hasTemplate() { return this.template != null; }

    get emptySize() { return this.#emptySize; }
    set emptySize(v) { this.#emptySize.set(v); }
    get eW() { return this.emptySize.x; }
    set eW(v) { this.emptySize.x = v; }
    get eH() { return this.emptySize.y; }
    set eH(v) { this.emptySize.y = v; }

    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }

    get hints() { return [...this.#hints]; }
    set hints(v) {
        v = util.ensure(v, "arr");
        this.clearHints();
        this.addHint(v);
    }
    clearHints() {
        let hints = this.hints;
        this.remHint(hints);
        return hints;
    }
    hasHint(hint) {
        if (!(hint instanceof core.Hint)) return false;
        return this.#hints.has(hint);
    }
    addHint(...hints) {
        return util.Target.resultingForEach(hints, hint => {
            if (!(hint instanceof core.Hint)) return false;
            if (this.hasHint(hint)) return false;
            this.#hints.add(hint);
            this.change("addHint", null, hint);
            return hint;
        });
    }
    remHint(...hints) {
        return util.Target.resultingForEach(hints, hint => {
            if (!(hint instanceof core.Hint)) return false;
            if (!this.hasHint(hint)) return false;
            this.#hints.delete(hint);
            this.change("remHint", hint, null);
            return hint;
        });
    }

    update(delta) { this.post("update", delta); }
}

export class Odometry2d extends Odometry {
    #ctx;
    #worldMouse;

    #render;

    #image;
    #imageShow;
    #imageAlpha;

    #padding;
    #axisInteriorX;
    #axisInteriorY;
    #drawGrid;

    #unit;

    static BEFOREGRID = 0;
    static AFTERGRID = 1;
    static BEFOREIMAGE = 1;
    static AFTERIMAGE = 2;
    static BEFOREBORDER = 2;
    static AFTERBORDER = 3;

    static async loadField(name) {
        name = String(name);
        const templates = GLOBALSTATE.getProperty("templates").value;
        const templateImages = GLOBALSTATE.getProperty("template-images").value;
        if (!(name in templates)) return null;
        if (!(name in templateImages)) return null;
        const template = util.ensure(templates[name], "obj");
        return templateImages[name];
    }

    constructor(elem) {
        super(elem);

        const update = () => {
            let r = this.elem.getBoundingClientRect();
            this.canvas.width = r.width * this.quality;
            this.canvas.height = r.height * this.quality;
            this.canvas.style.width = r.width+"px";
            this.canvas.style.height = r.height+"px";
            this.update(0);
        };
        new ResizeObserver(update).observe(this.elem);
        this.addHandler("change-quality", update);

        this.#ctx = this.canvas.getContext("2d");
        this.#worldMouse = new V(-(10**9));
        this.mouse.addHandler("change", () => {
            if (this.mouse.x < 0 && this.mouse.y < 0 )return this.worldMouse.set(-(10**9));
            this.worldMouse.set(this.pageToWorld(this.mouse));
        });

        this.#render = new Odometry2d.Render(this, 0);

        this.#image = new Image();
        this.#imageShow = null;
        this.#imageAlpha = 0.25;

        this.#padding = new util.V4();
        this.#axisInteriorX = false;
        this.#axisInteriorY = false;
        this.#drawGrid = true;

        this.#unit = null;

        this.padding = 40;

        this.unit = "m";

        let fieldLock = false;

        const timer = new util.Timer(true);
        this.addHandler("render", delta => {
            if (timer.dequeueAll(250)) update();

            if (!fieldLock)
                (async () => {
                    fieldLock = true;
                    this.imageSrc = await Odometry2d.loadField(this.template);
                    fieldLock = false;
                })();

            const ctx = this.ctx, quality = this.quality, padding = this.padding, scale = this.scale;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            const cx = (ctx.canvas.width - quality*(padding.l+padding.r))/2 + quality*padding.l;
            const cy = (ctx.canvas.height - quality*(padding.t+padding.b))/2 + quality*padding.t;
            const mnx = cx - this.w*scale*quality/2, mxx = cx + this.w*scale*quality/2;
            const mny = cy - this.h*scale*quality/2, mxy = cy + this.h*scale*quality/2;
            
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(0);

            let w = Math.floor(lib.Unit.convert(this.w, "m", this.unit));
            let h = Math.floor(lib.Unit.convert(this.h, "m", this.unit));
            let step = lib.findStep((w+h)/2, 10);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.fillStyle = PROPERTYCACHE.get("--v6");
            ctx.font = (12*quality)+"px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = this.axisInteriorX ? "bottom" : "top";
            let y0 = mny;
            let y1 = mxy;
            let y2 = mxy + 5*quality*(this.axisInteriorX ? -1 : 1);
            let y3 = mxy + 10*quality*(this.axisInteriorX ? -1 : 1);
            for (let i = +this.axisInteriorX; i <= w; i += step) {
                let x = util.lerp(mnx, mxx, lib.Unit.convert(i, this.unit, "m") / this.w);
                if (this.drawGrid) {
                    ctx.strokeStyle = PROPERTYCACHE.get("--v2");
                    ctx.beginPath();
                    ctx.moveTo(x, y0);
                    ctx.lineTo(x, y1);
                    ctx.stroke();
                }
                ctx.strokeStyle = PROPERTYCACHE.get("--v6");
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
                if (i%2 == 1 && i < w) continue;
                ctx.fillText(i, x, y3);
            }
            ctx.textAlign = this.axisInteriorY ? "left" : "right";
            ctx.textBaseline = "middle";
            let x0 = mxx;
            let x1 = mnx;
            let x2 = mnx - 5*quality*(this.axisInteriorY ? -1 : 1);
            let x3 = mnx - 10*quality*(this.axisInteriorY ? -1 : 1);
            for (let i = +this.axisInteriorY; i <= h; i += step) {
                let y = util.lerp(mxy, mny, lib.Unit.convert(i, this.unit, "m") / this.h);
                if (this.drawGrid) {
                    ctx.strokeStyle = PROPERTYCACHE.get("--v2");
                    ctx.beginPath();
                    ctx.moveTo(x0, y);
                    ctx.lineTo(x1, y);
                    ctx.stroke();
                }
                ctx.strokeStyle = PROPERTYCACHE.get("--v6");
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();
                if (i%2 == 1 && i < h) continue;
                ctx.fillText(i, x3, y);
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(mnx, mny, mxx-mnx, mxy-mny);
            ctx.clip();

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(1);

            try {
                if (this.#imageShow) {
                    let imageScale = ((this.w/this.#image.width)+(this.h/this.#image.height))/2;
                    ctx.globalAlpha = this.imageAlpha;
                    ctx.globalCompositeOperation = "overlay";
                    ctx.drawImage(
                        this.#image,
                        (ctx.canvas.width - this.#image.width*imageScale*scale*quality)/2,
                        (ctx.canvas.height - this.#image.height*imageScale*scale*quality)/2,
                        this.#image.width*imageScale*scale*quality,
                        this.#image.height*imageScale*scale*quality,
                    );
                }
            } catch (e) {}

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(2);

            ctx.restore();

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = PROPERTYCACHE.get("--v6");
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.strokeRect(mnx, mny, mxx-mnx, mxy-mny);

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(3);
        });
    }

    get ctx() { return this.#ctx; }
    get worldMouse() { return this.#worldMouse; }

    get render() { return this.#render; }

    get imageSrc() { return this.#image.src; }
    set imageSrc(v) {
        if (v == null) return this.#imageShow = null;
        if (this.#imageShow == v) return;
        this.#imageShow = v;
        this.#image.src = v;
    }
    get imageAlpha() { return this.#imageAlpha; }
    set imageAlpha(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.imageAlpha == v) return;
        this.change("imageAlpha", this.imageAlpha, this.#imageAlpha=v);
    }

    get padding() { return this.#padding; }
    set padding(v) { this.#padding.set(v); }
    get paddingTop() { return this.padding.t; }
    set paddingTop(v) { this.padding.t = v; }
    get paddingBottom() { return this.padding.b; }
    set paddingBottom(v) { this.padding.b = v; }
    get paddingLeft() { return this.padding.l; }
    set paddingLeft(v) { this.padding.l = v; }
    get paddingRight() { return this.padding.r; }
    set paddingRight(v) { this.padding.r = v; }

    get axisInteriorX() { return this.#axisInteriorX; }
    set axisInteriorX(v) {
        v = !!v;
        if (this.axisInteriorX == v) return;
        this.#axisInteriorX = v;
    }
    get axisExteriorX() { return !this.axisInteriorX; }
    set axisExteriorX(v) { this.axisInteriorX = !v; }
    get axisInteriorY() { return this.#axisInteriorY; }
    set axisInteriorY(v) {
        v = !!v;
        if (this.axisInteriorY == v) return;
        this.#axisInteriorY = v;
    }
    get axisExteriorY() { return !this.axisInteriorY; }
    set axisExteriorY(v) { this.axisInteriorY = !v; }

    get drawGrid() { return this.#drawGrid; }
    set drawGrid(v) {
        v = !!v;
        if (this.drawGrid == v) return;
        this.#drawGrid = v;
    }

    get unit() { return this.#unit; }
    set unit(v) { this.#unit = String(v); }

    get scale() {
        return Math.min(
            ((this.canvas.width/this.quality) - (this.padding.l+this.padding.r))/this.w,
            ((this.canvas.height/this.quality) - (this.padding.t+this.padding.b))/this.h,
        );
    }

    get hovered() { return this.render.theHovered; }
    get hoveredPart() {
        let hovered = this.hovered;
        if (!hovered) return null;
        return hovered.hovered;
    }

    worldToCanvas(...p) {
        const scale = this.scale;
        let [x, y] = V.args(...p);
        x = (x - this.w/2) * (scale*this.quality) + this.canvas.width/2;
        y = (this.h/2 - y) * (scale*this.quality) + this.canvas.height/2;
        return new V(x, y);
    }
    worldLenToCanvas(l) {
        l = util.ensure(l, "num");
        return l*(this.scale*this.quality);
    }
    canvasToWorld(...p) {
        const scale = this.scale;
        let [x, y] = V.args(...p);
        x = (x - this.canvas.width/2) / (scale*this.quality) + this.w/2;
        y = this.h/2 - (y - this.canvas.height/2) / (scale*this.quality);
        return new V(x, y);
    }
    canvasLenToWorld(l) {
        l = util.ensure(l, "num");
        return l/(this.scale*this.quality);
    }
    canvasToPage(...p) {
        let [x, y] = V.args(...p);
        let r = this.canvas.getBoundingClientRect();
        x /= this.quality; y /= this.quality;
        x += r.left; y += r.top;
        return new V(x, y);
    }
    canvasLenToPage(l) {
        l = util.ensure(l, "num");
        return l/this.quality;
    }
    pageToCanvas(...p) {
        let [x, y] = V.args(...p);
        let r = this.canvas.getBoundingClientRect();
        x -= r.left; y -= r.top;
        x *= this.quality; y *= this.quality;
        return new V(x, y);
    }
    pageLenToCanvas(l) {
        l = util.ensure(l, "num");
        return l*this.quality;
    }
    worldToPage(...p) { return this.canvasToPage(this.worldToCanvas(...p)); }
    worldLenToPage(l) { return this.canvasLenToPage(this.worldLenToCanvas(l)); }
    pageToWorld(...p) { return this.canvasToWorld(this.pageToCanvas(...p)); }
    pageLenToWorld(l) { return this.canvasLenToWorld(this.pageLenToCanvas(l)); }
}
Odometry2d.Render = class Odometry2dRender extends util.Target {
    #parent;
    #hasParent;
    
    #pos;
    #z; #z2;
    #alpha;
    
    #rPos;
    #rAlpha;

    #renders;

    #canHover;

    constructor(parent, pos) {
        super();

        if (!(parent instanceof Odometry2d || parent instanceof Odometry2d.Render))
            throw new Error("Parent is not of class Odometry2d nor of class Odometry2dRender");
        this.#parent = parent;
        this.#hasParent = this.parent instanceof Odometry2d.Render;

        this.#pos = new V();
        this.#z = this.#z2 = 0;
        this.#alpha = 1;

        this.#rPos = new V();
        this.#rAlpha = 1;

        this.#renders = new Set();

        this.#canHover = true;

        this.pos = pos;
        this.z = Odometry2d.AFTERIMAGE;
        this.z2 = 0;

        this.addHandler("add", () => this.renders.forEach(render => render.onAdd()));
        this.addHandler("rem", () => this.renders.forEach(render => render.onRem()));
    }

    get parent() { return this.#parent; }
    hasParent() { return this.#hasParent; }
    get odometry() { return this.hasParent() ? this.parent.odometry : this.parent; }

    get pos() { return this.#pos; }
    set pos(v) { this.#pos.set(v); }
    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }

    get z() { return this.#z; }
    set z(v) { this.#z = util.ensure(v, "int"); }
    get z2() { return this.#z2; }
    set z2(v) { this.#z2 = util.ensure(v, "int"); }

    get alpha() { return this.#alpha; }
    set alpha(v) { this.#alpha = Math.min(1, Math.max(0, util.ensure(v, "num"))); }

    get rPos() { return this.#rPos; }
    get rX() { return this.rPos.x; }
    get rY() { return this.rPos.y; }
    get rAlpha() { return this.#rAlpha; }

    get renders() { return [...this.#renders]; }
    set renders(v) {
        v = util.ensure(v, "arr");
        this.clearRenders();
        this.addRender(v);
    }
    clearRenders() {
        let renders = this.renders;
        this.remRender(renders);
        return renders;
    }
    hasRender(render) {
        if (!(render instanceof Odometry2d.Render)) return false;
        return this.#renders.has(render) && render.parent == this;
    }
    addRender(...renders) {
        return util.Target.resultingForEach(renders, render => {
            if (!(render instanceof Odometry2d.Render)) return false;
            if (render.parent != this) return false;
            if (this.hasRender(render)) return false;
            this.#renders.add(render);
            render.onAdd();
            return render;
        });
    }
    remRender(...renders) {
        return util.Target.resultingForEach(renders, render => {
            if (!(render instanceof Odometry2d.Render)) return false;
            if (render.parent != this) return false;
            if (!this.hasRender(render)) return false;
            render.onRem();
            this.#renders.delete(render);
            return render;
        });
    }

    get canHover() { return this.#canHover; }
    set canHover(v) { this.#canHover = !!v; }
    get hovered() { return null; }
    get theHovered() {
        for (let render of this.renders) {
            let hovered = render.theHovered;
            if (hovered) return hovered;
        }
        let hovered = this.hovered;
        return hovered ? this : null;
    }

    render(z=null) {
        this.#rPos = new V(this.hasParent() ? this.parent.rPos : 0).iadd(this.pos);
        this.#rAlpha = (this.hasParent() ? this.parent.rAlpha : 1) * this.alpha;
        this.odometry.ctx.globalAlpha = this.rAlpha;
        this.post("render");
        this.renders.filter(render => (z == null || render.z == z)).sort((a, b) => {
            if (a.z < b.z) return -1;
            if (a.z > b.z) return +1;
            return a.z2-b.z2;
        }).forEach(render => render.render());
    }
};
Odometry2d.Robot = class Odometry2dRobot extends Odometry2d.Render {
    #type;
    #builtinType;

    #name;
    #size;
    #velocity;
    #showVelocity;
    #heading;

    #color;
    #colorH;

    #selected;

    static TYPES = [
        "§default",
        "§node",
        "§box",
        "§target",
        "§arrow",
        "§arrow-h",
        "§arrow-t",
        "§traj",
        "§2023-cone",
        "§2023-cube",
        "§2024-note",
    ];
    static getTypeName(type) {
        type = String(type);
        let names = {
            "default": "Default",
            "node": "Node",
            "box": "Box",
            "target": "Target",
            "arrow": "Arrow (Centered)",
            "arrow-h": "Arrow (Head Centered)",
            "arrow-t": "Arrow (Tail Centered)",
            "traj": "Trajectory",
            "2023-cone": "2023 Cone",
            "2023-cube": "2023 Cube",
            "2024-note": "2024 Note",
        };
        if (type.startsWith("§") && type.slice(1) in names) return names[type.slice(1)];
        return type;
    }
    static menuStructure = [
        "§default",
        "§node",
        "§box",
        "§target",
        {
            name: "Arrow", key: "§arrow",
            sub: [
                "§arrow",
                "§arrow-h",
                "§arrow-t",
            ],
        },
        "§traj",
        null,
        {
            name: "2023",
            sub: [
                "§2023-cone",
                "§2023-cube",
            ],
        },
        {
            name: "2024", key: "§2024-note",
            sub: [
                "§2024-note",
            ],
        },
    ];
    static buildMenu(menu, current, signal) {
        if (!(menu instanceof core.Menu)) return null;
        if (!(signal instanceof util.Target)) signal = new util.Target();
        const dfs = (menu, structs) => {
            util.ensure(structs, "arr").forEach(struct => {
                if (struct == null) return menu.addItem(new core.Menu.Divider());
                if (util.is(struct, "obj")) {
                    let itm = menu.addItem(new core.Menu.Item(struct.name, (struct.key == current) ? "checkmark" : ""));
                    itm.addHandler("trigger", e => {
                        if (!struct.key) return;
                        signal.post("type", struct.key);
                    });
                    dfs(itm.menu, struct.sub);
                    return;
                }
                let itm = menu.addItem(new core.Menu.Item(this.getTypeName(struct), (struct == current) ? "checkmark" : ""));
                itm.addHandler("trigger", e => {
                    signal.post("type", struct);
                });
            });
        };
        dfs(menu, [
            ...this.menuStructure,
        ]);
        return signal;
    }

    constructor(parent, pos, name, size, velocity, heading) {
        super(parent, pos);

        this.#type = null;
        this.#builtinType = null;

        this.#name = null;
        this.#size = new V();
        this.#velocity = new V();
        this.#showVelocity = true;
        this.#heading = 0;

        this.#color = "cb";
        this.#colorH = "cb5";

        this.type = "§default";

        this.name = name;
        this.size = size;
        this.velocity = velocity;
        this.heading = heading;

        const hint = new core.Hint();
        const hName = hint.addEntry(new core.Hint.NameEntry(""));
        const hPosX = hint.addEntry(new core.Hint.KeyValueEntry("X", 0));
        const hPosY = hint.addEntry(new core.Hint.KeyValueEntry("Y", 0));
        const hDir = hint.addEntry(new core.Hint.KeyValueEntry("Dir", 0));
        let useVelocity = null;
        const hVelX = new core.Hint.KeyValueEntry("VX", 0);
        const hVelY = new core.Hint.KeyValueEntry("VY", 0);

        this.addHandler("rem", () => this.odometry.remHint(hint));

        const targetScale = 2/3;

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            const hovered = this.hovered;
            if (this.hasType() && this.hasBuiltinType()) {
                const builtinType = this.builtinType;
                if (["default", "node", "box", "target", "arrow", "arrow-h", "arrow-t"].includes(builtinType)) {
                    if (!["node", "arrow", "arrow-h", "arrow-t"].includes(builtinType)) {
                        ctx.strokeStyle = PROPERTYCACHE.get("--"+this.color+"-8");
                        ctx.lineWidth = 7.5*quality;
                        ctx.lineJoin = "miter";
                        ctx.beginPath();
                        let pth = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]]
                            .map(v => this.size.clone().isub(this.odometry.pageLenToWorld(7.5)).idiv(2).imul(v))
                            .map(v => v.rotateOrigin(this.heading));
                        for (let i = 0; i < pth.length; i++) {
                            let p = this.odometry.worldToCanvas(pth[i].iadd(this.rPos));
                            if (i > 0) ctx.lineTo(...p.xy);
                            else ctx.moveTo(...p.xy);
                        }
                        ctx.closePath();
                        ctx.stroke();
                        ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                        ctx.lineWidth = 1*quality;
                        if (builtinType == "target") {
                            ctx.lineCap = "square";
                            let w = this.odometry.pageLenToWorld(0.075)/this.odometry.pageLenToWorld(this.w);
                            let h = this.odometry.pageLenToWorld(0.075)/this.odometry.pageLenToWorld(this.h);
                            let pth = [[targetScale-w*2, 1], [1, 1], [1, targetScale-h*2]];
                            for (let xi = 0; xi < 2; xi++) {
                                let x = xi*2 - 1;
                                for (let yi = 0; yi < 2; yi++) {
                                    let y = yi*2 - 1;
                                    ctx.beginPath();
                                    let pth2 = pth
                                        .map(v => this.size.clone().idiv(2).imul(v).imul(x, y))
                                        .map(v => v.irotateOrigin(this.heading));
                                    for (let i = 0; i < pth2.length; i++) {
                                        let p = this.odometry.worldToCanvas(pth2[i].iadd(this.rPos));
                                        if (i > 0) ctx.lineTo(...p.xy);
                                        else ctx.moveTo(...p.xy);
                                    }
                                    ctx.stroke();
                                }
                            }
                        } else {
                            ctx.beginPath();
                            let pth = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]]
                                .map(v => this.size.clone().idiv(2).imul(v))
                                .map(v => v.irotateOrigin(this.heading));
                            for (let i = 0; i < pth.length; i++) {
                                let p = this.odometry.worldToCanvas(pth[i].iadd(this.rPos));
                                if (i > 0) ctx.lineTo(...p.xy);
                                else ctx.moveTo(...p.xy);
                            }
                            ctx.closePath();
                            ctx.stroke();
                        }
                    }
                    if (["arrow", "arrow-h", "arrow-t"].includes(builtinType)) {
                        ctx.strokeStyle = PROPERTYCACHE.get("--"+((hovered == "heading") ? this.colorH : this.color));
                        ctx.lineWidth = 5*quality;
                        ctx.lineJoin = "round";
                        ctx.lineCap = "round";
                        let dir = this.heading;
                        let tail =
                            (builtinType == "arrow-h") ?
                                V.dir(dir, -this.w).iadd(this.rPos) :
                            (builtinType == "arrow-t") ?
                                this.rPos :
                            V.dir(dir, -this.w/2).iadd(this.rPos);
                        let head =
                            (builtinType == "arrow-h") ?
                                this.rPos :
                            (builtinType == "arrow-t") ?
                                V.dir(dir, +this.w).iadd(this.rPos) :
                            V.dir(dir, +this.w/2).iadd(this.rPos);
                        ctx.beginPath();
                        ctx.moveTo(...this.odometry.worldToCanvas(tail).xy);
                        ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                        ctx.lineTo(...this.odometry.worldToCanvas(V.dir(dir-135, this.odometry.pageLenToWorld(15)).iadd(head)).xy);
                        ctx.moveTo(...this.odometry.worldToCanvas(head).xy);
                        ctx.lineTo(...this.odometry.worldToCanvas(V.dir(dir+135, this.odometry.pageLenToWorld(15)).iadd(head)).xy);
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = PROPERTYCACHE.get("--"+((hovered == "heading") ? "v8" : "v8-8"));
                        ctx.lineWidth = 1*quality;
                        ctx.lineJoin = "round";
                        ctx.beginPath();
                        ctx.arc(...this.odometry.worldToCanvas(V.dir(this.heading, this.w/2).iadd(this.rPos)).xy, 5*quality, 0, 2*Math.PI);
                        ctx.closePath();
                        ctx.fill();
                    }
                    if (!["box", "arrow", "arrow-h", "arrow-t"].includes(builtinType)) {
                        ctx.fillStyle = PROPERTYCACHE.get("--"+((hovered == "main") ? this.colorH : this.color));
                        ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                        ctx.lineWidth = 1*quality;
                        ctx.lineJoin = "round";
                        ctx.beginPath();
                        ctx.arc(...this.odometry.worldToCanvas(this.rPos).xy, 7.5*quality, 0, 2*Math.PI);
                        ctx.closePath();
                        ctx.fill();
                        if (this.selected) ctx.stroke();
                    }
                } else {
                    let typefs = {
                        "2023-cone": () => {
                            ctx.fillStyle = PROPERTYCACHE.get("--"+(hovered ? this.colorH : this.color));
                            ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                            ctx.lineWidth = 1*quality;
                            ctx.lineJoin = "round";
                            ctx.beginPath();
                            let pth = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]]
                                .map(v => new V(10.5).imul(v))
                                .map(v => v.irotateOrigin(this.heading));
                            for (let i = 0; i < pth.length; i++) {
                                let p = this.odometry.worldToCanvas(pth[i].iadd(this.rPos));
                                if (i > 0) ctx.lineTo(...p.xy);
                                else ctx.moveTo(...p.xy);
                            }
                            ctx.closePath();
                            ctx.fill();
                            if (this.selected) ctx.stroke();
                            ctx.fillStyle = "#00000044";
                            ctx.beginPath();
                            ctx.arc(...this.odometry.worldToCanvas(this.rPos).xy, this.odometry.worldLenToCanvas(8.5), 0, 2*Math.PI);
                            ctx.fill();
                        },
                        "2023-cube": () => {
                            ctx.fillStyle = PROPERTYCACHE.get("--"+(hovered ? this.colorH : this.color));
                            ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                            ctx.lineWidth = 1*quality;
                            ctx.lineJoin = "round";
                            ctx.beginPath();
                            let pth = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]]
                                .map(v => new V(12).imul(v))
                                .map(v => v.irotateOrigin(this.heading));
                            for (let i = 0; i < pth.length; i++) {
                                let p = this.odometry.worldToCanvas(pth[i].iadd(this.rPos));
                                if (i > 0) ctx.lineTo(...p.xy);
                                else ctx.moveTo(...p.xy);
                            }
                            ctx.closePath();
                            ctx.fill();
                            if (this.selected) ctx.stroke();
                        },
                        "2024-note": () => {
                            ctx.beginPath();
                            ctx.arc(...this.odometry.worldToCanvas(this.rPos).xy, this.odometry.worldLenToCanvas(15.25), 0, 2*Math.PI);
                            ctx.closePath();
                            ctx.lineJoin = "round";
                            if (this.selected) {
                                ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                                ctx.lineWidth = 2*quality + this.odometry.worldLenToCanvas(5.5);
                                ctx.stroke();
                            }
                            ctx.strokeStyle = PROPERTYCACHE.get("--"+(hovered ? this.colorH : this.color));
                            ctx.lineWidth = this.odometry.worldLenToCanvas(5.5);
                            ctx.stroke();
                        },
                    };
                    if (builtinType in typefs) typefs[builtinType]();
                }
            }
            if (this.showVelocity) {
                ctx.strokeStyle = PROPERTYCACHE.get("--"+((hovered == "velocity") ? "v8" : "v8-8"));
                ctx.lineWidth = 1*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                let dir = 180+this.velocity.towards();
                let tail = this.rPos;
                let head = tail.add(V.dir(dir, this.velocity.dist()));
                ctx.beginPath();
                ctx.moveTo(...this.odometry.worldToCanvas(tail).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(V.dir(dir-135, this.odometry.pageLenToWorld(5)).iadd(head)).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(V.dir(dir+135, this.odometry.pageLenToWorld(5)).iadd(head)).xy);
                ctx.stroke();
            }
            if (hovered) {
                hName.name = this.name;
                hName.eName.style.color = "var(--"+this.color+")";
                hPosX.value = this.x;
                hPosY.value = this.y;
                hDir.value = this.heading;
                if (useVelocity != this.useVelocity) {
                    useVelocity = this.useVelocity;
                    if (useVelocity) hint.addEntry(hVelX, hVelY);
                    else hint.remEntry(hVelX, hVelY);
                }
                if (useVelocity) {
                    hVelX.value = this.velocityX;
                    hVelY.value = this.velocityY;
                }
                this.odometry.addHint(hint);
                hint.place(this.odometry.worldToPage(this.pos));
            } else this.odometry.remHint(hint);
        });
    }

    get hovered() {
        if (!this.canHover) return null;
        let m = this.odometry.worldMouse;
        if (this.hasType() && this.hasBuiltinType()) {
            if (this.showVelocity && this.rPos.add(this.velocity).distSquared(m) < this.odometry.pageLenToWorld(5)**2) return "velocity";
            if (V.dir(this.heading, this.w/2).iadd(this.rPos).distSquared(m) < this.odometry.pageLenToWorld(5)**2) return "heading";
            let d = this.rPos.distSquared(m);
            if (d < this.odometry.pageLenToWorld(7.5)**2) return "main";
            if (d < this.odometry.pageLenToWorld((this.w+this.h)/4)**2) return "body";
        } else if (this.hasType()) {
            let d = this.rPos.distSquared(m);
            let typefs = {
                "2023-cone": () => {
                    if (d < this.odometry.pageLenToWorld(10.5*(Math.sqrt(2)+1)/2)) return "main";
                    return null;
                },
                "2023-cube": () => {
                    if (d < this.odometry.pageLenToWorld(12*(Math.sqrt(2)+1)/2)) return "main";
                    return null;
                },
                "2024-note": () => {
                    if (d > this.odometry.pageLenToWorld(7.5) && d < this.odometry.pageLenToWorld(18)) return "main";
                    return null;
                },
            };
            if (this.type in typefs) return typefs[this.type]();
        }
        return null;
    }

    get type() { return this.#type; }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (v != null && v.startsWith("§") && !Odometry2d.Robot.TYPES.includes(v)) v = Odometry2d.Robot.TYPES[0];
        if (this.type == v) return;
        this.#builtinType = (v == null || !v.startsWith("§")) ? null : v.slice(1);
        this.change("type", this.type, this.#type=v);
    }
    get builtinType() { return this.#builtinType; }
    hasType() { return this.type != null; }
    hasBuiltinType() { return this.builtinType != null; }

    get name() { return this.#name; }
    set name(v) { this.#name = String(v); }

    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }
    get velocity() { return this.#velocity; }
    set velocity(v) { this.#velocity.set(v); }
    get velocityX() { return this.velocity.x; }
    set velocityX(v) { this.velocity.x = v; }
    get velocityY() { return this.velocity.y; }
    set velocityY(v) { this.velocity.y = v; }
    get showVelocity() { return this.#showVelocity; }
    set showVelocity(v) { this.#showVelocity = !!v; }

    get heading() { return this.#heading; }
    set heading(v) { this.#heading = util.clampAngle(v); }

    get color() { return this.#color; }
    set color(v) { this.#color = String(v); }
    get colorH() { return this.#colorH; }
    set colorH(v) { this.#colorH = String(v); }

    get selected() { return this.#selected; }
    set selected(v) { this.#selected = !!v; }
};
Odometry2d.Obstacle = class Odometry2dObstacle extends Odometry2d.Render {
    #radius;
    #dir;

    #selected;

    constructor(odometry, pos, radius) {
        super(odometry, pos);

        this.#radius = 0;
        this.#dir = 0;

        this.radius = radius;

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            ctx.fillStyle = PROPERTYCACHE.get("--"+((this.hovered == "main") ? "cr-8" : "cr-4"));
            ctx.strokeStyle = PROPERTYCACHE.get("--v8");
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(this.rPos).xy, this.odometry.worldLenToCanvas(this.radius), 0, 2*Math.PI);
            ctx.fill();
            if (this.selected) ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(...this.odometry.worldToCanvas(this.rPos).xy);
            ctx.lineTo(...this.odometry.worldToCanvas(V.dir(this.dir, this.radius).iadd(this.rPos)).xy);
            ctx.stroke();
            ctx.fillStyle = PROPERTYCACHE.get("--"+((this.hovered == "radius") ? "a" : "v8"));
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(V.dir(this.dir, this.radius).iadd(this.rPos)).xy, 5*quality, 0, 2*Math.PI);
            ctx.fill();
        });
    }

    get hovered() {
        if (!this.canHover) return null;
        let m = this.odometry.worldMouse;
        if (V.dir(this.dir, this.radius).iadd(this.rPos).distSquared(m) < this.odometry.pageLenToWorld(5)**2) return "radius";
        if (this.rPos.distSquared(m) < this.radius**2) return "main";
        return null;
    }

    get radius() { return this.#radius; }
    set radius(v) { this.#radius = Math.max(0, util.ensure(v, "num")); }

    get dir() { return this.#dir; }
    set dir(v) { this.#dir = util.clampAngle(v); }

    get selected() { return this.#selected; }
    set selected(v) { this.#selected = !!v; }
};

export class Odometry3d extends Odometry {
    static loadedFields = {};
    static loadingFields = {};
    static loadedRobots = {};
    static loadingRobots = {};

    #renders;

    #scene;
    #wpilibGroup;
    #camera;

    #renderer;
    #cssRenderer;

    #controls;

    #raycaster;
    #raycastIntersections;

    #requestRedraw;

    #axisScene;
    #axisSceneSized;

    #field;
    #theField;

    #renderType;
    #controlType;
    #isCinematic;
    #origin;
    
    static #traverseObject(obj, type) {
        const material = new THREE.MeshLambertMaterial({
            color: obj.material.color,
            transparent: obj.material.transparent,
            opacity: obj.material.opacity,
        });
        obj.material.dispose();
        obj.material = material;
    }
    static decacheField(name) {
        name = String(name);
        if (!this.loadedFields[name]) return false;
        for (let type in this.loadedFields[name])
            this.loadedFields[name][type].traverse(obj => {
                if (!obj.isMesh) return;
                obj.material.dispose();
                obj.geometry.dispose();
            });
        delete this.loadedFields[name];
        return true;
    }
    static decacheAllFields() {
        for (let name in this.loadedFields)
            this.decacheField(name);
        return true;
    }
    static async loadField(name, type) {
        name = String(name);
        type = String(type);
        const templates = GLOBALSTATE.getProperty("templates").value;
        const templateModels = GLOBALSTATE.getProperty("template-models").value;
        if (!(name in templates)) return null;
        if (!(name in templateModels)) return null;
        const template = util.ensure(templates[name], "obj");
        if (this.loadedFields[name]) {
            if (this.loadedFields[name][type])
                return this.loadedFields[name][type];
            return null;
        }
        let t0 = util.ensure(this.loadingFields[name], "num");
        let t1 = util.getTime();
        if (t1-t0 < 1000) return null;
        this.loadingFields[name] = t1;
        try {
            const gltf = await LOADER.loadPromised(templateModels[name]);
            this.loadedFields[name] = {};
            const scene = gltf.scene;
            ["basic", "cinematic"].forEach(type => {
                const obj = this.loadedFields[name][type] = scene.clone();
                obj.traverse(obj => {
                    if (!obj.isMesh) return;
                    this.#traverseObject(obj, type);
                });
            });
            scene.traverse(obj => {
                if (!obj.isMesh) return;
                obj.material.dispose();
            });
        } catch (e) {}
        if (!this.loadedFields[name]) return null;
        if (!this.loadedFields[name][type]) return null;
        return this.loadedFields[name][type];
    }
    static decacheRobot(name, component=null) {
        name = String(name);
        component = (component == null) ? null : String(component);

        if (!this.loadedRobots[name]) return false;

        if (component == null) {
            if (!this.loadedRobots[name].default) return false;
            for (let type in this.loadedRobots[name].default)
                this.loadedRobots[name].default[type].traverse(obj => {
                    if (!obj.isMesh) return;
                    obj.material.dispose();
                    obj.geometry.dispose();
                });
            delete this.loadedRobots[name].default;
            return true;
        }
        if (!this.loadedRobots[name].components) return false;
        if (!this.loadedRobots[name].components[component]) return false;
        for (let type in this.loadedRobots[name].components[component])
            this.loadedRobots[name].components[component][type].traverse(obj => {
                if (!obj.isMesh) return;
                obj.material.dispose();
                obj.geometry.dispose();
            });
        delete this.loadedRobots[name].components[component];
        return true;
    }
    static decacheAllRobots() {
        for (let name in this.loadedRobots) {
            this.decacheRobot(name);
            if (!this.loadedRobots[name]) continue;
            if (!this.loadedRobots[name].components) continue;
            for (let k in this.loadedRobots[name].components)
                this.decacheRobot(name, k);
        }
        return true;
    }
    static async loadRobot(name, type, component=null) {
        name = String(name);
        type = String(type);
        component = (component == null) ? null : String(component);

        const robots = GLOBALSTATE.getProperty("robots").value;
        const robotModels = GLOBALSTATE.getProperty("robot-models").value;

        if (!(name in robots)) return null;
        const robot = util.ensure(robots[name], "obj");
        const components = util.ensure(robot.components, "obj");
        if (component == null) {
        } else {
            if (!(component in components))
                return null;
        }

        if (!(name in robotModels)) return null;
        if (component == null) {
            if (!robotModels[name].default) return null;
        } else {
            if (!robotModels[name].components[component]) return null;
        }

        if (this.loadedRobots[name]) {
            if (component == null) {
                if (this.loadedRobots[name].default && this.loadedRobots[name].default[type])
                    return this.loadedRobots[name].default[type];
            } else {
                if (this.loadedRobots[name].components && this.loadedRobots[name].components[component] && this.loadedRobots[name].components[component][type])
                    return this.loadedRobots[name].components[component][type];
            }
        }

        const bumperDetect = ("bumperDetect" in robot) ? !!robot["bumperDetect"] : true;
        const data = (component == null) ? robot : util.ensure(components[component], "obj");
        const zero = util.ensure(data.zero, "obj");
        const rotations = THREE.Quaternion.fromRotationSequence(zero.rotations);
        const translations = (zero.translations == "auto") ? "auto" : new util.V3(zero.translations);

        const pth = (component == null) ? robotModels[name].default : robotModels[name].components[component];

        let t0 = util.ensure(this.loadingRobots[name], "num");
        let t1 = util.getTime();
        if (t1-t0 < 1000) return null;
        this.loadingRobots[name] = t1;

        if (!this.loadedRobots[name]) this.loadedRobots[name] = {};

        try {
            const gltf = await LOADER.loadPromised(pth);
            const scene = gltf.scene;
            ["basic", "cinematic"].forEach(type => {
                let obj, pobj, bbox;
                obj = scene.clone();
                obj.traverse(obj => {
                    if (!obj.isMesh) return;
                    this.#traverseObject(obj, type);
                    if (!bumperDetect) return;
                    const color = new util.Color(obj.material.color.r*255, obj.material.color.g*255, obj.material.color.b*255);
                    const h = color.h, s = color.s, thresh = 60;
                    const score = Math.min(1, Math.max(0, (1-Math.min(Math.abs(h-210)/thresh, Math.abs(h-0)/thresh, Math.abs(h-360)/thresh))));
                    if (score*s < 0.5) return;
                    obj.material._isBumper = true;
                });
                obj.quaternion.copy(rotations);
                [obj, pobj] = [new THREE.Object3D(), obj];
                obj.add(pobj);
                bbox = new THREE.Box3().setFromObject(obj);
                let translation = (translations == "auto") ? new util.V3(
                    -(bbox.max.x+bbox.min.x)/2,
                    -(bbox.max.y+bbox.min.y)/2,
                    -bbox.min.z,
                ) : translations;
                obj.position.set(
                    obj.position.x + translation.x,
                    obj.position.y + translation.y,
                    obj.position.z + translation.z,
                );
                [obj, pobj] = [new THREE.Object3D(), obj];
                obj.add(pobj);
                obj.name = "§§§"+(component == null ? "" : component);
                obj._bumperDetect = bumperDetect;
                if (component == null) {
                    if (!this.loadedRobots[name].default) this.loadedRobots[name].default = {};
                    this.loadedRobots[name].default[type] = obj;
                } else {
                    if (!this.loadedRobots[name].components) this.loadedRobots[name].components = {};
                    if (!this.loadedRobots[name].components[component]) this.loadedRobots[name].components[component] = {};
                    this.loadedRobots[name].components[component][type] = obj;
                }
            });
            scene.traverse(obj => {
                if (!obj.isMesh) return;
                obj.material.dispose();
            });
        } catch (e) {}

        if (!this.loadedRobots[name]) return null;

        if (component == null) {
            if (!this.loadedRobots[name].default) return null;
            if (!this.loadedRobots[name].default[type]) return null;
            return this.loadedRobots[name].default[type];
        }
        if (!this.loadedRobots[name].components) return null;
        if (!this.loadedRobots[name].components[component]) return null;
        if (!this.loadedRobots[name].components[component][type]) return null;
        return this.loadedRobots[name].components[component][type];
    }

    static generatePositioning(value, lengthUnits, angleUnits, z2d=0) {
        value = util.ensure(value, "arr").map(v => util.ensure(v, "num"));
        if (value.length == 7)
            return {
                pos: value.slice(0, 3).map(v => lib.Unit.convert(v, lengthUnits, "m")),
                q: value.slice(3, 7),
            };
        if (value.length == 3)
            return {
                pos: [...value.slice(0, 2).map(v => lib.Unit.convert(v, lengthUnits, "m")), util.ensure(z2d, "num")],
                q: (d => [Math.cos(d/2), 0, 0, Math.sin(d/2)])(lib.Unit.convert(value[2], angleUnits, "rad")),
            };
        return {
            pos: [0, 0, 0],
            q: [0, 0, 0, 0],
        };
    }

    constructor(elem) {
        super(elem);

        let contextLost = false;
        this.canvas.addEventListener("webglcontextlost", () => (contextLost = true));
        this.canvas.addEventListener("webglcontextrestored", () => {
            this.requestRedraw();
            contextLost = false;
        });

        this.#renders = new Set();

        this.#scene = new THREE.Scene();
        this.#wpilibGroup = new THREE.Group();
        this.scene.add(this.wpilibGroup);
        this.wpilibGroup.quaternion.copy(WPILIB2THREE);
        this.#camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        let cam = new Array(7).fill(null);

        this.#renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, powerPreference: "default" });
        this.renderer.shadowMap.enabled = this.isCinematic;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.#cssRenderer = new CSS2DRenderer({ element: this.overlay });
        
        this.#controls = null;

        this.#raycaster = new THREE.Raycaster();
        this.#raycastIntersections = [];

        this.#requestRedraw = true;

        let r = this.elem.getBoundingClientRect();
        
        this.canvas.addEventListener("click", e => {
            e.stopPropagation();
            if (this.controlType == "free") this.controls.lock();
        });
        this.elem.addEventListener("mousemove", e => {
            let x = (e.pageX - r.left) / r.width, y = (e.pageY - r.top) / r.height;
            x = (x*2)-1; y = (y*2)-1;
            if (this.controlType == "free" && this.controls.isLocked) x = y = 0;
            this.raycaster.setFromCamera(new THREE.Vector2(x, -y), this.camera);
            // TODO: find way to raycast just for a single object / pose
            // this.#raycastIntersections = this.raycaster.intersectObjects(this.renders.filter(render => render.hasObject()).map(render => render.theObject.children[0].children[0]), false);
        });
        const updateCamera = () => {
            if (this.renderType == "proj") {
                if (this.camera.aspect != r.width / r.height) {
                    this.camera.aspect = r.width / r.height;
                    this.camera.updateProjectionMatrix();
                }
            } else if (this.renderType == "iso") {
                let size = 15;
                let aspect = r.width / r.height;
                this.camera.left = -size/2 * aspect;
                this.camera.right = +size/2 * aspect;
                this.camera.top = +size/2;
                this.camera.bottom = -size/2;
            }
        };
        this.addHandler("change-renderType", updateCamera);
        const updateScene = () => {
            r = this.elem.getBoundingClientRect();
            this.renderer.setSize(Math.ceil(r.width), Math.ceil(r.height));
            this.cssRenderer.setSize(Math.ceil(r.width), Math.ceil(r.height));
            this.renderer.setPixelRatio(this.quality);
            updateCamera();
            this.requestRedraw();
        };
        new ResizeObserver(updateScene).observe(this.elem);
        this.addHandler("change-quality", updateScene);

        const radius = 0.05;
        const length = 5;
        let axes, xAxis, yAxis, zAxis;

        // TODO: fix mem leak w these scenes vvv

        const xAxisGeo = new MeshLineGeometry();
        xAxisGeo.setPoints([0, 0, 0, length, 0, 0]);
        const yAxisGeo = new MeshLineGeometry();
        yAxisGeo.setPoints([0, 0, 0, 0, length, 0]);
        const zAxisGeo = new MeshLineGeometry();
        zAxisGeo.setPoints([0, 0, 0, 0, 0, length]);

        this.#axisScene = new THREE.Group();
        this.axisScene._builtin = "axis-scene";
        axes = this.axisScene.axes = new THREE.Group();
        this.axisScene.add(axes);
        xAxis = this.axisScene.xAxis = new MeshLine(
            xAxisGeo,
            new MeshLineMaterial({
                color: 0xffffff,
                lineWidth: radius,
            }),
        );
        axes.add(xAxis);
        yAxis = this.axisScene.yAxis = new MeshLine(
            yAxisGeo,
            new MeshLineMaterial({
                color: 0xffffff,
                lineWidth: radius,
            }),
        );
        axes.add(yAxis);
        zAxis = this.axisScene.zAxis = new THREE.Mesh(
            zAxisGeo,
            new MeshLineMaterial({
                color: 0xffffff,
                lineWidth: radius,
            }),
        );
        axes.add(zAxis);

        this.axisScene.planes = [];

        this.#axisSceneSized = new THREE.Group();
        this.axisSceneSized._builtin = "axis-scene-sized";
        axes = this.axisSceneSized.axes = new THREE.Group();
        this.axisSceneSized.add(axes);
        xAxis = this.axisSceneSized.xAxis = new MeshLine(
            xAxisGeo,
            new MeshLineMaterial({
                color: 0xffffff,
                lineWidth: radius,
            }),
        );
        axes.add(xAxis);
        yAxis = this.axisSceneSized.yAxis = new MeshLine(
            yAxisGeo,
            new MeshLineMaterial({
                color: 0xffffff,
                lineWidth: radius,
            }),
        );
        axes.add(yAxis);
        zAxis = this.axisSceneSized.zAxis = new MeshLine(
            zAxisGeo,
            new MeshLineMaterial({
                color: 0xffffff,
                lineWidth: radius,
            }),
        );
        axes.add(zAxis);
        this.axisSceneSized.planes = [];

        this.#field = null;
        this.#theField = null;

        const hemLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
        this.scene.add(hemLight);

        const lights = [[], []];

        {
            const light = new THREE.PointLight(0xffffff, 0.5);
            lights[0].push(light);
            light.position.set(0, 10, 0);
        }
        {
            const data = [
                [[0, 10, 0], [0, 0, 0], 0xffffff],
                // [[+5, 10, 0], [+2, 0, 0], 0xffffff],
                // [[-5, 10, 0], [-2, 0, 0], 0xffffff],
                [[+5, 10, 0], [+5, 0, 0], 0x0000ff],
                [[-5, 10, 0], [-5, 0, 0], 0xff0000],
            ];
            for (const [[x0, y0, z0], [x1, y1, z1], color] of data) {
                const light = new THREE.SpotLight(color, 150, 0, 60*(Math.PI/180), 0.25, 2);
                lights[1].push(light);
                light.position.set(x0, y0, z0);
                light.target.position.set(x1, y1, z1);
                light.shadow.mapSize.width = 1024;
                light.shadow.mapSize.height = 1024;
                light.shadow.bias = -0.01;
            }
        }
        this.addHandler("change-isCinematic", () => {
            this.renderer.shadowMap.enabled = this.isCinematic;
            for (let i = 0; i < 2; i++)
                lights[i].forEach(light => {
                    if (i == +this.isCinematic)
                        this.scene.add(light);
                    else this.scene.remove(light);
                });
        });

        const singlePlaneGeometry = new THREE.PlaneGeometry(1, 1);
        const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        planeMaterial.side = THREE.DoubleSide;

        this.#renderType = null;
        this.#controlType = null;
        this.#isCinematic = null;
        this.#origin = null;

        let keys = new Set();
        let times = {}, sprint = false, sprintBy = null;
        this.canvas.addEventListener("keydown", e => {
            e.stopPropagation();
            if (keys.has(e.code)) return;
            keys.add(e.code);
            if (![
                "KeyD", "ArrowRight",
                "KeyA", "ArrowLeft",
                "KeyW", "ArrowUp",
                "KeyS", "ArrowDown",
                "Space",
                "ShiftLeft",
            ].includes(e.code)) return;
            let t0 = util.ensure(times[e.code], "num");
            let t1 = util.getTime();
            times[e.code] = t1;
            if (t1-t0 > 250) return;
            if (t1-t0 < 50) return;
            sprint = true;
            sprintBy = e.code;
        });
        this.canvas.addEventListener("keyup", e => {
            e.stopPropagation();
            if (!keys.has(e.code)) return;
            keys.delete(e.code);
            if (e.code != sprintBy) return;
            sprint = false;
        });
        let velocity = new util.V3();

        const updateField = () => {
            this.wpilibGroup.scale.x = this.origin.startsWith("blue") ? 1 : -1;
            this.wpilibGroup.scale.y = this.origin.endsWith("+") ? 1 : -1;
            if (!this.theField) return;
            this.theField.scale.x = this.origin.startsWith("blue") ? 1 : -1;
            if (this.field._builtin) this.theField.scale.y = this.origin.endsWith("+") ? 1 : -1;
            else this.theField.scale.z = this.origin.endsWith("+") ? 1 : -1;
        };
        this.addHandler("change-field", updateField);
        this.addHandler("change-origin", updateField);

        let fieldLock = false;

        const timer1 = new util.Timer(true);
        const timer2 = new util.Timer(true);
        this.addHandler("render", delta => {
            if (timer1.dequeueAll(250)) updateScene();
            if (contextLost && timer2.dequeueAll(500)) this.renderer.forceContextRestore();

            this.renders.forEach(render => render.update(delta));

            let colorR = PROPERTYCACHE.getColor("--cr");
            let colorG = PROPERTYCACHE.getColor("--cg");
            let colorB = PROPERTYCACHE.getColor("--cb");
            let colorV = PROPERTYCACHE.getColor("--v2");

            planeMaterial.color.set(colorV.toHex(false));

            if (this.field == this.axisScene) {

                this.axisScene.xAxis.material.color.set(colorR.toHex(false));
                this.axisScene.yAxis.material.color.set(colorG.toHex(false));
                this.axisScene.zAxis.material.color.set(colorB.toHex(false));

                let planes = this.axisScene.planes;
                let size = 10;
                let i = 0;
                for (let x = 0; x < size; x++) {
                    for (let y = 0; y < size; y++) {
                        if ((x+y) % 2 == 0) continue;
                        if (i >= planes.length) {
                            let plane = new THREE.Mesh(
                                singlePlaneGeometry,
                                planeMaterial,
                            );
                            planes.push(plane);
                            this.axisScene.add(plane);
                            this.requestRedraw();
                        }
                        let plane = planes[i++];
                        plane.position.set(0.5+1*(x-size/2), 0.5+1*(y-size/2), 0);
                    }
                }
                while (planes.length > i) {
                    let plane = planes.pop();
                    this.axisScene.remove(plane);
                    this.requestRedraw();
                }

            }
            if (this.field == this.axisSceneSized) {

                this.axisSceneSized.xAxis.material.color.set(colorR.toHex(false));
                this.axisSceneSized.yAxis.material.color.set(colorG.toHex(false));
                this.axisSceneSized.zAxis.material.color.set(colorB.toHex(false));
                this.axisSceneSized.axes.position.set(...this.size.div(-2).xy, 0);

                let planes = this.axisSceneSized.planes;
                let w = this.axisSceneSized.w;
                let h = this.axisSceneSized.h;
                if (w != this.w || h != this.h) {
                    w = this.axisSceneSized.w = this.w;
                    h = this.axisSceneSized.h = this.h;
                    while (planes.length > 0) {
                        let plane = planes.pop();
                        this.axisSceneSized.remove(plane);
                        plane.geometry.dispose();
                    };
                    this.requestRedraw();
                }
                let i = 0;
                for (let x = 0; x < w; x++) {
                    for (let y = 0; y < h; y++) {
                        if ((x+y) % 2 > 0) continue;
                        if (i >= planes.length) {
                            let plane = new THREE.Mesh(
                                new THREE.PlaneGeometry(0, 0),
                                planeMaterial,
                            );
                            plane.geometry.w = plane.geometry.h = 0;
                            planes.push(plane);
                            this.axisSceneSized.add(plane);
                            this.requestRedraw();
                        }
                        let plane = planes[i++];
                        let pw = Math.min(1, w-x), ph = Math.min(1, h-y);
                        if (plane.geometry.w != pw || plane.geometry.h != ph) {
                            plane.geometry.dispose();
                            plane.geometry = new THREE.PlaneGeometry(pw, ph);
                            plane.geometry.w = pw;
                            plane.geometry.h = ph;
                            this.requestRedraw();
                        }
                        plane.position.set(x+pw/2-w/2, y+ph/2-h/2, 0);
                    }
                }
                while (planes.length > i) {
                    let plane = planes.pop();
                    this.axisSceneSized.remove(plane);
                    plane.geometry.dispose();
                    this.requestRedraw();
                }
            }

            if (!fieldLock)
                (async () => {
                    fieldLock = true;
                    this.field = (await Odometry3d.loadField(
                        this.template,
                        this.isCinematic ? "cinematic" : "basic"
                    )) || (
                        this.hasTemplate() ? this.axisSceneSized : this.axisScene
                    );
                    fieldLock = false;
                })();

            if (this.controlType == "orbit") {
                this.controls.update();
            } else if (this.controlType == "free") {
                if (this.controls.isLocked) {
                    let xP = keys.has("KeyD") || keys.has("ArrowRight");
                    let xN = keys.has("KeyA") || keys.has("ArrowLeft");
                    let yP = keys.has("KeyW") || keys.has("ArrowUp");
                    let yN = keys.has("KeyS") || keys.has("ArrowDown");
                    let zP = keys.has("Space");
                    let zN = keys.has("ShiftLeft");
                    let x = xP - xN;
                    let y = yP - yN;
                    let z = zP - zN;
                    velocity.iadd(new util.V3(x, y, z).imul(keys.has("ShiftRight") ? 0.1 : sprint ? 1 : 0.5).imul(delta/1000));
                    velocity.imul(0.9);
                    velocity.imap(v => (Math.abs(v) < util.EPSILON ? 0 : v));
                    this.controls.moveRight(velocity.x);
                    this.controls.moveForward(velocity.y);
                    this.camera.position.y += velocity.z;
                } else {
                    velocity.imul(0);
                }
            }
            let cam2 = [
                this.camera.position.x, this.camera.position.y, this.camera.position.z,
                this.camera.quaternion.w, this.camera.quaternion.x, this.camera.quaternion.y, this.camera.quaternion.z,
            ];
            for (let i = 0; i < 7; i++) {
                if (i < 3) {
                    if (Math.abs(cam[i] - cam2[i]) < util.EPSILON) continue;
                } else {
                    if (cam[i] == cam2[i]) continue;
                }
                cam[i] = cam2[i];
                this.requestRedraw();
            }

            if (!this.#requestRedraw) return;
            this.#requestRedraw = false;

            this.renderer.render(this.scene, this.camera);
            this.cssRenderer.render(this.scene, this.camera);
        });

        this.renderType = "proj";
        this.controlType = "orbit";
        this.isCinematic = false;
        this.origin = "blue+";
    }

    get renders() { return [...this.#renders]; }
    set renders(v) {
        v = util.ensure(v, "arr");
        this.clearRenders();
        this.addRender(v);
    }
    clearRenders() {
        let renders = this.renders;
        this.remRender(renders);
        return renders;
    }
    hasRender(render) {
        if (!(render instanceof Odometry3d.Render)) return false;
        return this.#renders.has(render) && render.odometry == this;
    }
    addRender(...renders) {
        return util.Target.resultingForEach(renders, render => {
            if (!(render instanceof Odometry3d.Render)) return false;
            if (render.odometry != this) return false;
            if (this.hasRender(render)) return false;
            this.#renders.add(render);
            render.onAdd();
            return render;
        });
    }
    remRender(...renders) {
        return util.Target.resultingForEach(renders, render => {
            if (!(render instanceof Odometry3d.Render)) return false;
            if (render.odometry != this) return false;
            if (!this.hasRender(render)) return false;
            render.onRem();
            this.#renders.delete(render);
            return render;
        });
    }

    get scene() { return this.#scene; }
    get wpilibGroup() { return this.#wpilibGroup; }
    get camera() { return this.#camera; }
    get renderer() { return this.#renderer; }
    get cssRenderer() { return this.#cssRenderer; }
    get controls() { return this.#controls; }
    get raycaster() { return this.#raycaster; }
    get raycastIntersections() { return this.#raycastIntersections; }

    requestRedraw() { return this.#requestRedraw = true; }

    get axisScene() { return this.#axisScene; }
    get axisSceneSized() { return this.#axisSceneSized; }

    get field() { return this.#field; }
    get theField() { return this.#theField; }
    set field(v) {
        v = (v instanceof THREE.Object3D) ? v : null;
        if (this.field == v) return;
        if (this.hasField()) {
            this.wpilibGroup.remove(this.theField);
            this.#theField = null;
        }
        [v, this.#field] = [this.#field, v];
        if (this.hasField()) {
            this.#theField = this.field._builtin ? this.field : this.field.clone();
            if (!this.field._builtin) this.theField.quaternion.copy(THREE2WPILIB);
            this.wpilibGroup.add(this.theField);
        }
        this.change("field", v, this.field);
        this.requestRedraw();
    }
    hasField() { return !!this.field; }

    updateControls() {
        if (this.controls instanceof OrbitControls) {
            this.controls.dispose();
        } else if (this.controls instanceof PointerLockControls) {
            this.controls.unlock();
            this.controls.disconnect();
        }
        let controlfs = {
            orbit: () => {
                const controls = new OrbitControls(this.camera, this.canvas);
                controls.target.set(0, 0, 0);
                controls.enablePan = false;
                return controls;
            },
            free: () => new PointerLockControls(this.camera, this.canvas),
            pan: () => {
                const controls = new OrbitControls(this.camera, this.canvas);
                controls.target.set(0, 0, 0);
                controls.screenSpacePanning = false;
                controls.mouseButtons = {
                    LEFT: THREE.MOUSE.PAN,
                    MIDDLE: THREE.MOUSE.DOLLY,
                    RIGHT: THREE.MOUSE.ROTATE,
                };
                return controls;
            },
        };
        this.#controls = (this.controlType in controlfs) ? controlfs[this.controlType]() : null;
        if (this.controls instanceof OrbitControls) {
            this.elem.classList.remove("showinfo");
        } else if (this.controls instanceof PointerLockControls) {
            this.controls.addEventListener("lock", () => this.elem.classList.add("showinfo"));
            this.controls.addEventListener("unlock", () => this.elem.classList.remove("showinfo"));
        }
    }
    get renderType() { return this.#renderType; }
    set renderType(v) {
        v = String(v);
        if (!["proj", "iso"].includes(v)) v = "proj";
        if (this.renderType == v) return;
        [v, this.#renderType] = [this.renderType, v];
        let renderfs = {
            proj: () => new THREE.PerspectiveCamera(75, 1, 0.15, 1000),
            iso: () => new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000),
        };
        this.#camera = (this.renderType in renderfs) ? renderfs[this.renderType]() : null;
        this.repositionCamera();
        this.change("renderType", v, this.renderType);
        this.updateControls();
        this.requestRedraw();
    }
    repositionCamera(dist=1) {
        let renderfs = {
            proj: [0, 7.5, -7.5],
            iso: [10, 10, -10],
        };
        dist = Math.max(0, util.ensure(dist, "num"));
        this.camera.position.set(...new util.V3((this.renderType in renderfs) ? renderfs[this.renderType] : 0).imul(dist).xyz);
        this.camera.lookAt(0, 0, 0);
    }
    get controlType() { return this.#controlType; }
    set controlType(v) {
        v = (v == null) ? null : String(v);
        if (!["orbit", "free", "pan", null].includes(v)) v = "orbit";
        if (this.controlType == v) return;
        this.change("controlType", this.controlType, this.#controlType=v);
        this.updateControls();
    }
    hasControlType() { return this.controlType != null; }
    get isCinematic() { return this.#isCinematic; }
    set isCinematic(v) {
        v = !!v;
        if (this.isCinematic == v) return;
        this.change("isCinematic", this.isCinematic, this.#isCinematic=v);
    }
    get origin() { return this.#origin; }
    set origin(v) {
        v = String(v);
        if (!["blue+", "blue-", "red+", "red-"].includes(v)) v = "blue+";
        if (this.origin == v) return;
        this.change("origin", this.origin, this.#origin=v);
        this.requestRedraw();
    }
};
Odometry3d.Render = class Odometry3dRender extends util.Target {
    #odometry;
    
    #components;
    #defaultComponent;

    #name;
    #color;
    #isGhost;
    #isSolid;
    #display;

    #type;
    #builtinType;

    #showObject;

    static LOADEDOBJECTS = {};
    static {
        const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const node = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            material,
        );
        this.LOADEDOBJECTS["node"] = node;
        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            material,
        );
        this.LOADEDOBJECTS["cube"] = cube;
        const radius = 0.01, arrowLength = 0.25, arrowRadius = 0.05;
        const arrow = new THREE.Object3D();
        const tip = new THREE.Mesh(
            new THREE.ConeGeometry(arrowRadius, arrowLength, 8),
            material,
        );
        tip.position.set(0, (1-arrowLength)/2, 0);
        arrow.add(tip);
        const line = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, 1-arrowLength, 8),
            material,
        );
        line.position.set(0, -arrowLength/2, 0);
        arrow.add(line);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                let pobj, obj = arrow.clone();
                [obj, pobj] = [new THREE.Object3D(), obj];
                obj.add(pobj);
                pobj.quaternion.copy(THREE.Quaternion.fromRotationSequence([
                    [
                        [{ axis: "z", angle: -90 }],
                        [{ axis: "z", angle: 90 }],
                    ],
                    [
                        [],
                        [{ axis: "z", angle: 180 }],
                    ],
                    [
                        [{ axis: "x", angle: 90 }],
                        [{ axis: "x", angle: -90 }],
                    ],
                ][j][i]));
                this.LOADEDOBJECTS["arrow"+"+-"[i]+"xyz"[j]] = obj;
            }
        }
        const axes = new THREE.Object3D();
        const length = 1;
        const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
        let xAxis, yAxis, zAxis;
        xAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xff0000 }),
        );
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        axes.xAxis = xAxis;
        yAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0x00ff00 }),
        );
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        axes.yAxis = yAxis;
        zAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0x0088ff }),
        );
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        axes.zAxis = zAxis;
        this.LOADEDOBJECTS["axes"] = axes;
        {
            // 2023
            const cone = new THREE.Object3D();
            const r = 0.105, h = 0.33;
            const coneInner = new THREE.Mesh(
                new THREE.ConeGeometry(r, h, 12),
                material,
            );
            coneInner.position.set(0, 0, h/2);
            coneInner.rotateX(Math.PI/2);
            cone.add(coneInner);
            this.LOADEDOBJECTS["2023-cone"] = cone;
            const cube = new THREE.Object3D();
            const s = 0.24;
            const cubeInner = new THREE.Mesh(
                new THREE.BoxGeometry(s, s, s),
                material,
            );
            cubeInner.position.set(0, 0, s/2);
            cube.add(cubeInner);
            this.LOADEDOBJECTS["2023-cube"] = cube;
        }
        {
            // 2024
            const note = new THREE.Object3D();
            const r1 = 0.18, r2 = 0.125;
            const noteInner = new THREE.Mesh(
                new THREE.TorusGeometry(r1-(r1-r2)/2, (r1-r2)/2, 8, 12),
                material,
            );
            noteInner.position.set(0, 0, (r1-r2)/2);
            note.add(noteInner);
            this.LOADEDOBJECTS["2024-note"] = note;
        }
    }

    static TYPES = [
        "§node",
        "§cube",
        "§arrow+x",
        "§arrow-x",
        "§arrow+y",
        "§arrow-y",
        "§arrow+z",
        "§arrow-z",
        "§axes",
        "§2023-cone",
        "§2023-cube",
        "§2024-note",
    ];
    static getTypeName(type) {
        type = String(type);
        let names = {
            "node": "Node",
            "cube": "Cube",
            "arrow+x": "Arrow (+X)",
            "arrow-x": "Arrow (-X)",
            "arrow+y": "Arrow (+Y)",
            "arrow-y": "Arrow (-Y)",
            "arrow+z": "Arrow (+Z)",
            "arrow-z": "Arrow (-Z)",
            "axes": "Axes",
            "2023-cone": "2023 Cone",
            "2023-cube": "2023 Cube",
            "2024-note": "2024 Note",
        };
        if (type.startsWith("§") && type.slice(1) in names) return names[type.slice(1)];
        let robots = GLOBALSTATE.getProperty("robots").value;
        if (type in robots) return String(util.ensure(robots[type], "obj").name || type);
        return type;
    }
    static menuStructure = [
        "§node",
        "§cube",
        {
            name: "Arrows", key: "§arrow+x",
            sub: [
                "§arrow+x",
                "§arrow-x",
                "§arrow+y",
                "§arrow-y",
                "§arrow+z",
                "§arrow-z",
            ],
        },
        "§axes",
        null,
        {
            name: "2023",
            sub: [
                "§2023-cone",
                "§2023-cube",
            ],
        },
        {
            name: "2024", key: "§2024-note",
            sub: [
                "§2024-note",
            ],
        },
    ];
    static buildMenu(menu, current, signal) {
        if (!(menu instanceof core.Menu)) return null;
        if (!(signal instanceof util.Target)) signal = new util.Target();
        const dfs = (menu, structs) => {
            util.ensure(structs, "arr").forEach(struct => {
                if (struct == null) return menu.addItem(new core.Menu.Divider());
                if (util.is(struct, "obj")) {
                    let itm = menu.addItem(new core.Menu.Item(struct.name, (struct.key == current) ? "checkmark" : ""));
                    itm.addHandler("trigger", e => {
                        if (!struct.key) return;
                        signal.post("type", struct.key);
                    });
                    dfs(itm.menu, struct.sub);
                    return;
                }
                let itm = menu.addItem(new core.Menu.Item(this.getTypeName(struct), (struct == current) ? "checkmark" : ""));
                itm.addHandler("trigger", e => {
                    signal.post("type", struct);
                });
            });
        };
        let robots = GLOBALSTATE.getProperty("robots").value;
        dfs(menu, [
            ...this.menuStructure,
            null,
            ...Object.keys(robots),
        ]);
        return signal;
    }
    
    constructor(odometry, pos, name, type) {
        super();

        if (!(odometry instanceof Odometry3d)) throw new Error("Odometry is not of class Odometry3d");
        this.#odometry = odometry;

        this.addHandler("change", (c, f, t) => this.requestRedraw());
        this.#components = {};
        this.#defaultComponent = new this.constructor.Component(this, null);

        this.#name = "";
        this.#color = "";
        this.#isGhost = false;
        this.#isSolid = false;
        this.#display = {};

        this.#type = null;
        this.#builtinType = null;

        this.#showObject = true;

        this.addHandler("rem", () => {
            this.object = null;
            this.defaultComponent.onRem();
            for (let k in this.#components)
                this.#components[k].onRem();
        });

        this.addHandler("update", delta => {
            this.defaultComponent.update(delta);
            for (let k in this.#components)
                this.#components[k].update(delta);
        });

        this.pos = pos;

        this.name = name;

        this.type = type;
    }

    get odometry() { return this.#odometry; }
    requestRedraw() { return this.odometry.requestRedraw(); }

    get components() { return Object.keys(this.#components); }
    hasComponent(k) { return String(k) in this.#components; }
    getComponent(k) {
        if (!this.hasComponent(k)) return null;
        return this.#components[String(k)];
    }
    get defaultComponent() { return this.#defaultComponent; }
    
    get name() { return this.#name; }
    set name(v) { this.#name = String(v); }
    get color() { return this.#color; }
    set color(v) {
        v = (v == null) ? null : String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
    }
    hasColor() { return this.color != null; }

    get isGhost() { return this.#isGhost; }
    set isGhost(v) {
        v = !!v;
        if (this.isGhost == v) return;
        this.change("isGhost", this.isGhost, this.#isGhost=v);
    }
    get isSolid() { return this.#isSolid; }
    set isSolid(v) {
        v = !!v;
        if (this.isSolid == v) return;
        this.change("isSolid", this.isSolid, this.#isSolid=v);
    }

    get display() { return this.#display; }
    set display(v) { this.#display = util.ensure(v, "obj"); }

    get type() { return this.#type; }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (v != null && v.startsWith("§") && !Odometry3d.Render.TYPES.includes(v)) v = Odometry3d.Render.TYPES[0];
        if (this.type == v) return;
        this.#builtinType = (v == null || !v.startsWith("§")) ? null : v.slice(1);
        this.change("type", this.type, this.#type=v);
        for (let k in this.#components)
            this.#components[k].onRem();
        this.#components = {};
        if (this.hasBuiltinType()) return;
        const robots = GLOBALSTATE.getProperty("robots").value;
        const robot = util.ensure(robots[this.type], "obj");
        const components = util.ensure(robot.components, "obj");
        for (let k in components)
            this.#components[k] = new this.constructor.Component(this, k);
    }
    get builtinType() { return this.#builtinType; }
    hasType() { return this.type != null; }
    hasBuiltinType() { return this.builtinType != null; }

    get showObject() { return this.#showObject; }
    set showObject(v) {
        v = !!v;
        if (this.showObject == v) return;
        this.change("showObject", this.showObject, this.#showObject=v);
    }
    get hideObject() { return !this.showObject; }
    set hideObject(v) { this.showObject = !v; }

    update(delta) { this.post("update", delta); }
};
Odometry3d.Render.Component = class Odometry3dRenderComponent extends util.Target {
    #render;
    #component;

    #pos;
    #q;

    #object;
    #theObject;

    constructor(render, component=null) {
        super();

        if (!(render instanceof Odometry3d.Render)) throw new Error("Render is not of class Odometry3dRender");
        this.#render = render;
        this.#component = (component == null) ? null : String(component);
        
        this.#pos = new util.V3();
        this.pos.addHandler("change", (c, f, t) => this.change("pos."+c, f, t));
        this.#q = new util.V4();
        this.q.addHandler("change", (c, f, t) => this.change("q."+c, f, t));
        this.addHandler("change", (c, f, t) => this.requestRedraw());

        const hint = new core.Hint();
        let hintType = null;
        const hName = hint.addEntry(new core.Hint.NameEntry(""));
        const hPosX = new core.Hint.KeyValueEntry("X", 0);
        const hPosY = new core.Hint.KeyValueEntry("Y", 0);
        const hPosZ = new core.Hint.KeyValueEntry("Z", 0);
        const hDirD = new core.Hint.KeyValueEntry("Dir", 0);
        const hDirW = new core.Hint.KeyValueEntry("QW", 0);
        const hDirX = new core.Hint.KeyValueEntry("QX", 0);
        const hDirY = new core.Hint.KeyValueEntry("QY", 0);
        const hDirZ = new core.Hint.KeyValueEntry("QZ", 0);

        this.#object = null;
        this.#theObject = null;

        let loadLock = false;
        let modelObject = null, theModelObject = null;

        this.addHandler("rem", () => {
            this.object = null;
            this.odometry.remHint(hint);
        });

        this.addHandler("update", delta => {
            let color =
                (this.render.hasColor() && this.render.color.startsWith("--")) ?
                    PROPERTYCACHE.getColor(this.render.color) :
                new util.Color(this.render.color);
            if (this.render.hasType()) {
                if (this.render.hasBuiltinType()) theModelObject = this.render.constructor.LOADEDOBJECTS[this.render.builtinType];
                else if (!loadLock)
                    (async () => {
                        loadLock = true;
                        theModelObject = await Odometry3d.loadRobot(
                            this.render.type,
                            this.odometry.isCinematic ? "cinematic" : "basic",
                            this.component,
                        );
                        loadLock = false;
                    })();
            } else theModelObject = null;
            if (modelObject != theModelObject) {
                modelObject = theModelObject;
                this.object = modelObject;
                if (this.hasObject()) {
                    this.theObject._cssObj = new CSS2DObject(document.createElement("div"));
                    this.theObject.add(this.theObject._cssObj);
                    this.theObject.traverse(obj => {
                        if (!obj.isMesh) return;
                        if (!("_transparent" in obj.material))
                            obj.material._transparent = obj.material.transparent;
                        if (!("_opacity" in obj.material))
                            obj.material._opacity = obj.material.opacity;
                        if (!("_color" in obj.material))
                            obj.material._color = obj.material.color.clone();
                    });
                    this.theObject.isGhost = this.theObject.isSolid = null;
                }
                this.requestRedraw();
            }
            if (!this.hasObject()) return;
            this.theObject.visible = this.render.showObject;
            const cssObj = this.theObject._cssObj;
            if (this.theObject.isGhost != this.render.isGhost) {
                this.theObject.isGhost = this.render.isGhost;
                this.theObject.traverse(obj => {
                    if (!obj.isMesh) return;
                    if (this.render.isGhost) {
                        obj.material.transparent = true;
                        obj.material.opacity = obj.material._opacity * 0.25;
                    } else {
                        obj.material.transparent = obj.material._transparent;
                        obj.material.opacity = obj.material._opacity;
                    }
                    obj.material.needsUpdate = true;
                });
                this.requestRedraw();
            }
            let hovered = false;
            if (this.theObject.isSolid != this.render.isSolid) {
                this.theObject.isSolid = this.render.isSolid;
                this.theObject.traverse(obj => {
                    // if (!hovered)
                    //     if (this.odometry.raycastIntersections[0])
                    //         if (obj == this.odometry.raycastIntersections[0].object)
                    //             hovered = true;
                    if (!obj.isMesh) return;
                    if (this.isSolid) {
                        obj.material.color.set(color.toHex(false));
                    } else {
                        obj.material.color.set(obj.material._color);
                    }
                });
                this.requestRedraw();
            }
            this.theObject.position.set(
                this.x - this.odometry.size.x/2 + (this.isDefault() ? 0 : this.render.defaultComponent.x),
                this.y - this.odometry.size.y/2 + (this.isDefault() ? 0 : this.render.defaultComponent.y),
                this.z + (this.isDefault() ? 0 : this.render.defaultComponent.z),
            );
            this.theObject.quaternion.set(this.qx, this.qy, this.qz, this.qw);
            if (!this.isDefault() && this.render.defaultComponent.hasObject())
                this.theObject.quaternion.premultiply(this.render.defaultComponent.theObject.quaternion);
            if (this.object._bumperDetect || this.render.hasBuiltinType())
                this.theObject.traverse(obj => {
                    if (!obj.isMesh) return;
                    if (!obj.material._isBumper) {
                        if (!this.render.hasType()) return;
                        if (!this.render.hasBuiltinType()) return;
                        if (this.render.builtinType == "axes") return;
                    }
                    obj.material.color.set(color.toHex(false));
                });
            let type = this.render.display.type;
            let data = util.ensure(this.render.display.data, "arr");
            if (hovered && this.isDefault()) {
                this.odometry.addHint(hint);
                if (hintType != type) {
                    hintType = type;
                    if (hintType == 7) {
                        hint.remEntry(hDirD);
                        hint.addEntry(hPosX, hPosY, hPosZ, hDirW, hDirX, hDirY, hDirZ);
                    } else if (hintType == 3) {
                        hint.remEntry(hPosZ, hDirW, hDirX, hDirY, hDirZ);
                        hint.addEntry(hPosX, hPosY, hDirD);
                    } else {
                        hint.remEntry(hPosX, hPosY, hPosZ, hDirD, hDirW, hDirX, hDirY, hDirZ);
                    }
                }
                hName.name = this.render.name;
                hName.eName.style.color = color.toRGBA();
                if (hintType == 7) {
                    [
                        hPosX.value,
                        hPosY.value,
                        hPosZ.value,
                        hDirW.value,
                        hDirX.value,
                        hDirY.value,
                        hDirZ.value,
                    ] = data;
                } else if (hintType == 3) {
                    [
                        hPosX.value,
                        hPosY.value,
                        hDirD.value,
                    ] = data;
                }
                if (cssObj) {
                    let r = cssObj.element.getBoundingClientRect();
                    hint.place(r.left, r.top);
                }
            } else this.odometry.remHint(hint);
        });
    }

    get render() { return this.#render; }
    get odometry() { return this.render.odometry; }
    requestRedraw() { return this.render.requestRedraw(); }

    get component() { return this.#component; }
    isDefault() { return this.component == null; }

    get pos() { return this.#pos; }
    set pos(v) { this.#pos.set(v); }
    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }
    get z() { return this.pos.z; }
    set z(v) { this.pos.z = v; }

    get q() { return this.#q; }
    set q(v) { this.q.set(v); }
    get qw() { return this.q.w; }
    set qw(v) { this.q.w = v; }
    get qx() { return this.q.x; }
    set qx(v) { this.q.x = v; }
    get qy() { return this.q.y; }
    set qy(v) { this.q.y = v; }
    get qz() { return this.q.z; }
    set qz(v) { this.q.z = v; }

    get object() { return this.#object; }
    get theObject() { return this.#theObject; }
    set object(v) {
        v = (v instanceof THREE.Object3D) ? v : null;
        if (this.object == v) return;

        if (this.hasObject()) {
            this.odometry.wpilibGroup.remove(this.theObject);
            this.theObject.traverse(obj => {
                if (obj instanceof CSS2DObject)
                    obj.removeFromParent();
                if (!obj.isMesh) return;
                obj.material.dispose();
            });
            this.#theObject = null;
        }

        this.#object = v;

        if (this.hasObject()) {
            this.#theObject = this.object.clone();
            this.theObject.traverse(obj => {
                if (!obj.isMesh) return;
                if (!(obj.material instanceof THREE.Material)) return;
                const isBumper = !!obj.material._isBumper;
                obj.material = obj.material.clone();
                obj.material._isBumper = isBumper;
            });
            this.odometry.wpilibGroup.add(this.theObject);
        }

        this.requestRedraw();
    }
    hasObject() { return !!this.object; }

    update(delta) { this.post("update", delta); }
};
