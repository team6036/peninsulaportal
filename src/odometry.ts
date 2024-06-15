import * as util from "./util";
import { Vec1, Vec2, Vec3, Vec4 } from "./util";
import * as lib from "./lib";

import * as core from "./core";
import { PROPERTYCACHE, GLOBALSTATE } from "./core";

import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

import { Components } from "ionicons";


export { THREE };

export const LOADER = new GLTFLoader();
/** Loads a GLTF model through a promise. */
export async function loadPromised(src: string): Promise<GLTF> {
    return await new Promise((res, rej) => LOADER.load(src, res, undefined, rej));
}

/** Generates a ThreeJS quaternion from a rotation sequence. */
export function fromRotationSequence(...rotations: lib.RobotRotation[]) {
    let quaternion = new THREE.Quaternion();
    rotations.forEach(rotation => {
        let axis = rotation.axis, angle = rotation.angle;
        let axisVector = new THREE.Vector3(+(axis=="x"), +(axis=="y"), +(axis=="z"));
        quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axisVector, (Math.PI/180)*angle));
    });
    return quaternion;
}

export const WPILIB2THREE = fromRotationSequence(
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


export type OdometryOrigin = "blue+" | "blue-" | "red+" | "red-";

export type Odometry3dRenderType = "proj" | "iso" | null;
export type Odometry3dControlType = "orbit" | "free" | "pan" | null;


export type MenuStructure = (null | string | {
    name: string, key?: string,
    sub: MenuStructure,
})[];

class HintList extends util.List<core.Hint> {
    convert(value: core.Hint): core.Hint | false { return value; }
}
/** An odometry controller and manager */
export abstract class Odometry extends util.Target {
    readonly elem;
    readonly eCanvas;
    readonly eOverlay;
    private _quality: number;
    readonly mouse;

    public doRender: boolean;

    private _template: string | null;

    readonly size;
    readonly emptySize;

    readonly hints;

    constructor(elem: HTMLDivElement | null) {
        super();

        if (!elem) elem = document.createElement("div");
        this.elem = elem;
        this.elem.classList.add("odom");

        this.eCanvas = (elem.querySelector(":scope > canvas") as HTMLCanvasElement) || document.createElement("canvas");
        this.elem.appendChild(this.eCanvas);
        this.eCanvas.tabIndex = 1;

        this.eOverlay = (elem.querySelector(":scope > .overlay") as HTMLDivElement) || document.createElement("div");
        this.elem.appendChild(this.eOverlay);
        this.eOverlay.classList.add("overlay");

        this._quality = 0;
        this.mouse = new Vec2(-1);

        this.doRender = true;

        this._template = null;

        this.size = new Vec2(0);
        this.emptySize = new Vec2(10);

        this.hints = new HintList();
        this.hints.addHandler("change", (attribute: string, from: any, to: any) => this.change("hints."+attribute, from, to));

        this.eCanvas.addEventListener("mousemove", e => this.mouse.set([e.pageX, e.pageY]));
        this.eCanvas.addEventListener("mouseleave", e => this.mouse.set(-1e9));

        this.quality = 2;

        this.addHandler("update", (delta: number) => {
            const templates = (GLOBALSTATE.properties.get("templates") as core.GlobalStateProperty<lib.Templates>).value;
            if (templates && this.template != null && templates[this.template])
                this.size.set(templates[this.template].size);
            else this.size.set(this.emptySize);
            if (!this.doRender) return;
            this.fullRender(delta);
        });
    }

    /** Triggers a render on this odometry object. */
    fullRender(delta: number): void { this.post("render", delta); }

    get quality() { return this._quality; }
    set quality(value) {
        value = Math.round(Math.max(1, value));
        if (this.quality === value) return;
        this.change("quality", this.quality, this._quality=value);
    }

    get template() { return this._template; }
    set template(value) {
        if (this.template === value) return;
        this.change("template", this.template, this._template=value);
    }

    get eW() { return this.emptySize.x; }
    set eW(v) { this.emptySize.x = v; }
    get eH() { return this.emptySize.y; }
    set eH(v) { this.emptySize.y = v; }

    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }

    /** Updates this odometry. */
    update(delta: number): void { this.post("update", delta); }
}

/** A 2d odometry rendering class */
export class Odometry2d extends Odometry {
    readonly ctx;
    readonly worldMouse;

    readonly render;

    private image: HTMLImageElement;
    private imageShow: string | null;
    private _imageAlpha: number;

    readonly padding;
    private _axisInteriorX: boolean;
    private _axisInteriorY: boolean;
    private _drawGrid: boolean;

    private _unit: string;

    static readonly BEFOREGRID = 0;
    static readonly AFTERGRID = 1;
    static readonly BEFOREIMAGE = 1;
    static readonly AFTERIMAGE = 2;
    static readonly BEFOREBORDER = 2;
    static readonly AFTERBORDER = 3;

    /** Gets the field url string from a field name. */
    static async loadField(name: string): Promise<string | null> {
        const templates = (GLOBALSTATE.properties.get("templates") as core.GlobalStateProperty<lib.Templates>).value;
        const templateImages = (GLOBALSTATE.properties.get("template-images") as core.GlobalStateProperty<lib.TemplateImages>).value;

        if (!templates) return null;
        if (!templateImages) return null;

        if (!(name in templates)) return null;
        if (!(name in templateImages)) return null;

        const template = templates[name];

        return templateImages[name];
    }

    constructor(elem: HTMLDivElement | null) {
        super(elem);

        const update = () => {
            let rect = this.elem.getBoundingClientRect();
            this.eCanvas.width = rect.width * this.quality;
            this.eCanvas.height = rect.height * this.quality;
            this.eCanvas.style.width = rect.width+"px";
            this.eCanvas.style.height = rect.height+"px";
            this.update(0);
        };
        new ResizeObserver(update).observe(this.elem);
        this.addHandler("change-quality", update);

        this.ctx = this.eCanvas.getContext("2d") as CanvasRenderingContext2D;
        this.worldMouse = new Vec2(-1e9);
        this.mouse.addHandler("change", () => {
            if (this.mouse.x < 0 && this.mouse.y < 0) return this.worldMouse.set(-1e9);
            this.worldMouse.set(this.pageToWorld(this.mouse));
        });

        this.render = new Odometry2dRender(this, 0);

        this.image = new Image();
        this.imageShow = null;
        this._imageAlpha = 0.25;

        this.padding = new Vec4();
        this._axisInteriorX = false;
        this._axisInteriorY = false;
        this._drawGrid = true;

        this._unit = "m";

        this.padding.set(40);

        let fieldLock = false;

        const timer = new util.Timer(true);
        this.addHandler("render", (delta: number) => {
            if (timer.dequeueAll(250)) update();

            if (!fieldLock)
                (async () => {
                    fieldLock = true;
                    this.imageSrc = (this.template == null) ? null : await Odometry2d.loadField(this.template);
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
            let step = lib.findStepValue((w+h)/2, 10);
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
                ctx.fillText(String(i), x, y3);
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
                ctx.fillText(String(i), x3, y);
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(mnx, mny, mxx-mnx, mxy-mny);
            ctx.clip();

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(1);

            try {
                if (this.imageShow) {
                    let imageScale = ((this.w/this.image.width)+(this.h/this.image.height))/2;
                    ctx.globalAlpha = this.imageAlpha;
                    ctx.globalCompositeOperation = "overlay";
                    ctx.drawImage(
                        this.image,
                        (ctx.canvas.width - this.image.width*imageScale*scale*quality)/2,
                        (ctx.canvas.height - this.image.height*imageScale*scale*quality)/2,
                        this.image.width*imageScale*scale*quality,
                        this.image.height*imageScale*scale*quality,
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

    get imageSrc() { return this.image ? this.image.src : null; }
    set imageSrc(value) {
        if (value == null) {
            this.imageShow = null;
            return;
        }
        if (this.imageShow === value) return;
        this.imageShow = value;
        this.image.src = value;
    }
    get imageAlpha() { return this._imageAlpha; }
    set imageAlpha(value) {
        value = Math.min(1, Math.max(0, value));
        if (this.imageAlpha === value) return;
        this.change("imageAlpha", this.imageAlpha, this._imageAlpha=value);
    }

    get paddingTop() { return this.padding.t; }
    set paddingTop(v) { this.padding.t = v; }
    get paddingBottom() { return this.padding.b; }
    set paddingBottom(v) { this.padding.b = v; }
    get paddingLeft() { return this.padding.l; }
    set paddingLeft(v) { this.padding.l = v; }
    get paddingRight() { return this.padding.r; }
    set paddingRight(v) { this.padding.r = v; }

    get axisInteriorX() { return this._axisInteriorX; }
    set axisInteriorX(value) {
        if (this.axisInteriorX === value) return;
        this._axisInteriorX = value;
    }
    get axisExteriorX() { return !this.axisInteriorX; }
    set axisExteriorX(value) { this.axisInteriorX = !value; }
    get axisInteriorY() { return this._axisInteriorY; }
    set axisInteriorY(value) {
        if (this.axisInteriorY === value) return;
        this._axisInteriorY = value;
    }
    get axisExteriorY() { return !this.axisInteriorY; }
    set axisExteriorY(value) { this.axisInteriorY = !value; }

    get drawGrid() { return this._drawGrid; }
    set drawGrid(value) {
        if (this.drawGrid === value) return;
        this._drawGrid = value;
    }

    get unit() { return this._unit; }
    set unit(value) { this._unit = value; }

    get scale() {
        return Math.min(
            ((this.eCanvas.width/this.quality) - (this.padding.l+this.padding.r))/this.w,
            ((this.eCanvas.height/this.quality) - (this.padding.t+this.padding.b))/this.h,
        );
    }

    get hovered(): Odometry2dRender | null { return this.render.theHovered; }
    get hoveredPart(): string | null {
        let hovered = this.hovered;
        if (!hovered) return null;
        return hovered.hovered;
    }

    /** Converts a position from world to canvas coordinate space. */
    worldToCanvas(pos: util.VectorLike): Vec2 {
        const scale = this.scale;
        let [x, y] = Vec2.args(pos);
        x = (x - this.w/2) * (scale*this.quality) + this.eCanvas.width/2;
        y = (this.h/2 - y) * (scale*this.quality) + this.eCanvas.height/2;
        return new Vec2([x, y]);
    }
    /** Converts a length from world to canvas coordinate space. */
    worldLenToCanvas(length: number): number {
        return length*(this.scale*this.quality);
    }
    /** Converts a position from canvas to world coordinate space. */
    canvasToWorld(pos: util.VectorLike): Vec2 {
        const scale = this.scale;
        let [x, y] = Vec2.args(pos);
        x = (x - this.eCanvas.width/2) / (scale*this.quality) + this.w/2;
        y = this.h/2 - (y - this.eCanvas.height/2) / (scale*this.quality);
        return new Vec2([x, y]);
    }
    /** Converts a length from canvas to world coordinate space. */
    canvasLenToWorld(length: number): number {
        return length/(this.scale*this.quality);
    }
    /** Converts a position from canvas to page/screen coordinate space. */
    canvasToPage(pos: util.VectorLike): Vec2 {
        let [x, y] = Vec2.args(pos);
        let r = this.eCanvas.getBoundingClientRect();
        x /= this.quality; y /= this.quality;
        x += r.left; y += r.top;
        return new Vec2([x, y]);
    }
    /** Converts a length from canvas to page/screen coordinate space. */
    canvasLenToPage(length: number): number {
        return length/this.quality;
    }
    /** Converts a position from page/screen to canvas coordinate space. */
    pageToCanvas(pos: util.VectorLike): Vec2 {
        let [x, y] = Vec2.args(pos);
        let r = this.eCanvas.getBoundingClientRect();
        x -= r.left; y -= r.top;
        x *= this.quality; y *= this.quality;
        return new Vec2([x, y]);
    }
    /** Converts a length from page/screen to canvas coordinate space. */
    pageLenToCanvas(length: number): number {
        return length*this.quality;
    }
    /** Converts a position from world to page/screen coordinate space. */
    worldToPage(pos: util.VectorLike): Vec2 { return this.canvasToPage(this.worldToCanvas(pos)); }
    /** Converts a length from world to page/screen coordinate space. */
    worldLenToPage(length: number): number { return this.canvasLenToPage(this.worldLenToCanvas(length)); }
    /** Converts a position from page/screen to world coordinate space. */
    pageToWorld(pos: util.VectorLike): Vec2 { return this.canvasToWorld(this.pageToCanvas(pos)); }
    /** Converts a length from page/screen to world coordinate space. */
    pageLenToWorld(length: number): number { return this.canvasLenToWorld(this.pageLenToCanvas(length)); }
}
class Odometry2dRenderList extends util.List<Odometry2dRender> {
    readonly render;
    constructor(render: Odometry2dRender) {
        super();
        this.render = render;
    }
    convert(value: Odometry2dRender): Odometry2dRender | false { return value; }
    addFilter(value: Odometry2dRender): boolean { return value.parent === this.render; }
    remFilter(value: Odometry2dRender): boolean { return value.parent === this.render; }
    protected addCallback(value: Odometry2dRender): void { value.onAdd(); }
    protected remCallback(value: Odometry2dRender): void { value.onRem(); }
}
/** A single render object unit of Odometry2d */
export class Odometry2dRender extends util.Target {
    readonly parent: Odometry2dRender | null;
    readonly odometry: Odometry2d;
    
    readonly pos;
    private _z: number;
    private _z2: number;
    private _alpha: number;
    
    private _rPos: Vec2;
    private _rAlpha: number;

    readonly renders;

    public canHover: boolean;

    constructor(parent: Odometry2d | Odometry2dRender, pos: util.VectorLike) {
        super();

        if (!(parent instanceof Odometry2d || parent instanceof Odometry2dRender))
            throw new Error("Parent is not of class Odometry2d nor of class Odometry2dRender");
        this.parent = (parent instanceof Odometry2d) ? null : parent;
        this.odometry = (parent instanceof Odometry2d) ? parent : parent.odometry;

        this.pos = new Vec2();
        this._z = this._z2 = 0;
        this._alpha = 1;

        this._rPos = new Vec2();
        this._rAlpha = 1;

        this.renders = new Odometry2dRenderList(this);

        this.canHover = true;

        this.pos.set(pos);
        this.z = Odometry2d.AFTERIMAGE;
        this.z2 = 0;

        this.addHandler("add", () => this.renders.list.forEach(render => render.onAdd()));
        this.addHandler("rem", () => this.renders.list.forEach(render => render.onRem()));
    }

    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }

    get z() { return this._z; }
    set z(value) { this._z = Math.round(value); }
    get z2() { return this._z2; }
    set z2(value) { this._z2 = Math.round(value); }

    get alpha() { return this._alpha; }
    set alpha(value) { this._alpha = Math.min(1, Math.max(0, value)); }

    get rPos() { return this._rPos; }
    get rX() { return this.rPos.x; }
    get rY() { return this.rPos.y; }
    get rAlpha() { return this._rAlpha; }

    get hovered(): string | null { return null; }
    get theHovered(): Odometry2dRender | null {
        for (let render of this.renders.list) {
            let hovered = render.theHovered;
            if (hovered) return hovered;
        }
        let hovered = this.hovered;
        return hovered ? this : null;
    }

    /** Render the subrenders of this object with a wanted z value. */
    render(wantedZ: number | null = null) {
        this._rPos = new Vec2(this.parent ? this.parent.rPos : 0).iadd(this.pos);
        this._rAlpha = (this.parent ? this.parent.rAlpha : 1) * this.alpha;
        this.odometry.ctx.globalAlpha = this.rAlpha;
        this.post("render");
        this.renders.list.filter(render => (wantedZ == null || render.z == wantedZ)).sort((a, b) => {
            if (a.z < b.z) return -1;
            if (a.z > b.z) return +1;
            return a.z2-b.z2;
        }).forEach(render => render.render());
    }
}
/** A robot on the odometry 2d field */
export class Odometry2dRobot extends Odometry2dRender {
    private _type: string | null;
    private _builtinType: string | null;

    public name: string;
    readonly size;
    readonly velocity;
    public showVelocity: boolean;
    private _heading: number;

    public color: string;
    public colorH: string;

    public selected: boolean;

    static readonly TYPES: util.Immutable<string[]> = [
        "§default",
        "§node",
        "§box",
        "§target",
        "§arrow",
        "§arrow-h",
        "§arrow-t",
        "§2023-cone",
        "§2023-cube",
        "§2024-note",
    ];
    /** Get the human readable name of a specific type. */
    static getTypeName(type: string): string {
        let names: util.StringMap = {
            "default": "Default",
            "node": "Node",
            "box": "Box",
            "target": "Target",
            "arrow": "Arrow (Centered)",
            "arrow-h": "Arrow (Head Centered)",
            "arrow-t": "Arrow (Tail Centered)",
            "2023-cone": "2023 Cone",
            "2023-cube": "2023 Cube",
            "2024-note": "2024 Note",
        };
        if (type.startsWith("§") && type.slice(1) in names)
            return names[type.slice(1)];
        return type;
    }
    static readonly typeMenuStructure: util.Immutable<MenuStructure> = [
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
    /** Builds a Menu object from a menu structure. */
    static buildTypeMenu(menu: core.Menu, currentType: string | null, signal?: util.Target) {
        if (!signal) signal = new util.Target();
        const dfs = (menu: core.Menu, struct: MenuStructure) => {
            struct.forEach(substruct => {
                if (substruct == null) return menu.items.add(new core.MenuDivider());
                if (typeof(substruct) === "object") {
                    let item = menu.items.add(new core.MenuItem(substruct.name, (substruct.key === currentType) ? "checkmark" : "")) as core.MenuItem;
                    item.addHandler("trigger", (e: MouseEvent) => {
                        if (!substruct.key) return;
                        (signal as util.Target).post("type", substruct.key);
                    });
                    if (substruct.sub) dfs(item.menu, substruct.sub);
                    return;
                }
                let item = menu.items.add(new core.MenuItem(this.getTypeName(substruct), (substruct === currentType) ? "checkmark" : "")) as core.MenuItem;
                item.addHandler("trigger", (e: MouseEvent) => {
                    (signal as util.Target).post("type", substruct);
                });
            });
        };
        dfs(menu, [
            ...this.typeMenuStructure as MenuStructure,
        ]);
        return signal;
    }

    constructor(parent: Odometry2d | Odometry2dRender, pos: util.VectorLike, name?: string, size?: util.VectorLike, velocity?: util.VectorLike, heading?: number) {
        super(parent, pos);

        this._type = null;
        this._builtinType = null;

        this.name = "";
        this.size = new Vec2();
        this.velocity = new Vec2();
        this.showVelocity = true;
        this._heading = 0;

        this.selected = false;

        this.color = "cb";
        this.colorH = "cb5";

        this.type = "§default";

        this.name = util.castString(name);
        this.size.set(size);
        this.velocity.set(velocity);
        this.heading = util.castNumber(heading);

        const hint = new core.Hint();
        const hName = hint.entries.add(new core.HintNameEntry("")) as core.HintNameEntry;
        const hPosX = hint.entries.add(new core.HintKeyValueEntry("X", 0)) as core.HintKeyValueEntry;
        const hPosY = hint.entries.add(new core.HintKeyValueEntry("Y", 0)) as core.HintKeyValueEntry;
        const hDir = hint.entries.add(new core.HintKeyValueEntry("Dir", 0)) as core.HintKeyValueEntry;
        let showVelocity: boolean | null = null;
        const hVelX = new core.HintKeyValueEntry("VX", 0) as core.HintKeyValueEntry;
        const hVelY = new core.HintKeyValueEntry("VY", 0) as core.HintKeyValueEntry;

        this.addHandler("rem", () => this.odometry.hints.rem(hint));

        const targetScale = 2/3;

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            const hovered = this.hovered;
            if (this.type != null && this.builtinType != null) {
                const builtinType = this.builtinType;
                if (["default", "node", "box", "target", "arrow", "arrow-h", "arrow-t"].includes(builtinType)) {
                    if (!["node", "arrow", "arrow-h", "arrow-t"].includes(builtinType)) {
                        ctx.strokeStyle = PROPERTYCACHE.get("--"+this.color+"-8");
                        ctx.lineWidth = 7.5*quality;
                        ctx.lineJoin = "miter";
                        ctx.beginPath();
                        let pth = ([[+1,+1], [-1,+1], [-1,-1], [+1,-1]] as util.vec2[])
                            .map(vec => this.size.clone().isub(this.odometry.pageLenToWorld(7.5)).idiv(2).imul(vec))
                            .map(vec => vec.rotateOrigin(this.heading));
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
                            let pth = [[targetScale-w*2, 1], [1, 1], [1, targetScale-h*2]] as util.vec2[];
                            for (let xi = 0; xi < 2; xi++) {
                                let x = xi*2 - 1;
                                for (let yi = 0; yi < 2; yi++) {
                                    let y = yi*2 - 1;
                                    ctx.beginPath();
                                    let pth2 = pth
                                        .map(vec => this.size.clone().idiv(2).imul(vec).imul([x, y]))
                                        .map(vec => vec.irotateOrigin(this.heading));
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
                            let pth = ([[+1,+1], [-1,+1], [-1,-1], [+1,-1]] as util.vec2[])
                                .map(vec => this.size.clone().idiv(2).imul(vec))
                                .map(vec => vec.irotateOrigin(this.heading));
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
                                Vec2.dir(dir, -this.w).iadd(this.rPos) :
                            (builtinType == "arrow-t") ?
                                this.rPos :
                            Vec2.dir(dir, -this.w/2).iadd(this.rPos);
                        let head =
                            (builtinType == "arrow-h") ?
                                this.rPos :
                            (builtinType == "arrow-t") ?
                                Vec2.dir(dir, +this.w).iadd(this.rPos) :
                            Vec2.dir(dir, +this.w/2).iadd(this.rPos);
                        ctx.beginPath();
                        ctx.moveTo(...this.odometry.worldToCanvas(tail).xy);
                        ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                        ctx.lineTo(...this.odometry.worldToCanvas(Vec2.dir(dir-135, this.odometry.pageLenToWorld(15)).iadd(head)).xy);
                        ctx.moveTo(...this.odometry.worldToCanvas(head).xy);
                        ctx.lineTo(...this.odometry.worldToCanvas(Vec2.dir(dir+135, this.odometry.pageLenToWorld(15)).iadd(head)).xy);
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = PROPERTYCACHE.get("--"+((hovered == "heading") ? "v8" : "v8-8"));
                        ctx.lineWidth = 1*quality;
                        ctx.lineJoin = "round";
                        ctx.beginPath();
                        ctx.arc(...this.odometry.worldToCanvas(Vec2.dir(this.heading, this.w/2).iadd(this.rPos)).xy, 5*quality, 0, 2*Math.PI);
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
                    let typeMap: util.StringMap<Function> = {
                        "2023-cone": () => {
                            ctx.fillStyle = PROPERTYCACHE.get("--"+(hovered ? this.colorH : this.color));
                            ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                            ctx.lineWidth = 1*quality;
                            ctx.lineJoin = "round";
                            ctx.beginPath();
                            let pth = ([[+1,+1], [-1,+1], [-1,-1], [+1,-1]] as util.vec2[])
                                .map(vec => new Vec2(10.5).imul(vec))
                                .map(vec => vec.irotateOrigin(this.heading));
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
                            let pth = ([[+1,+1], [-1,+1], [-1,-1], [+1,-1]] as util.vec2[])
                                .map(vec => new Vec2(12).imul(vec))
                                .map(vec => vec.irotateOrigin(this.heading));
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
                    if (builtinType in typeMap) typeMap[builtinType]();
                }
            }
            if (this.showVelocity) {
                ctx.strokeStyle = PROPERTYCACHE.get("--"+((hovered == "velocity") ? "v8" : "v8-8"));
                ctx.lineWidth = 1*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                let dir = 180+this.velocity.towards(0);
                let tail = this.rPos;
                let head = tail.add(Vec2.dir(dir, this.velocity.dist(0)));
                ctx.beginPath();
                ctx.moveTo(...this.odometry.worldToCanvas(tail).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(Vec2.dir(dir-135, this.odometry.pageLenToWorld(5)).iadd(head)).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(Vec2.dir(dir+135, this.odometry.pageLenToWorld(5)).iadd(head)).xy);
                ctx.stroke();
            }
            if (hovered) {
                hName.name = this.name;
                hName.eName.style.color = "var(--"+this.color+")";
                hPosX.value = String(this.x);
                hPosY.value = String(this.y);
                hDir.value = String(this.heading);
                if (showVelocity !== this.showVelocity) {
                    showVelocity = this.showVelocity;
                    if (showVelocity)
                        hint.entries.addMultiple(hVelX, hVelY);
                    else hint.entries.remMultiple(hVelX, hVelY);
                }
                if (showVelocity) {
                    hVelX.value = String(this.velocityX);
                    hVelY.value = String(this.velocityY);
                }
                this.odometry.hints.add(hint);
                hint.place(this.odometry.worldToPage(this.pos));
            } else this.odometry.hints.rem(hint);
        });
    }

    get hovered(): string | null {
        if (!this.canHover) return null;
        let mouse = this.odometry.worldMouse;
        if (this.type != null && this.builtinType != null) {
            if (this.showVelocity && this.rPos.add(this.velocity).distSquared(mouse) < this.odometry.pageLenToWorld(5)**2) return "velocity";
            if (Vec2.dir(this.heading, this.w/2).iadd(this.rPos).distSquared(mouse) < this.odometry.pageLenToWorld(5)**2) return "heading";
            let distance = this.rPos.distSquared(mouse);
            if (distance < this.odometry.pageLenToWorld(7.5)**2) return "main";
            if (distance < this.odometry.pageLenToWorld((this.w+this.h)/4)**2) return "body";
        } else if (this.type != null) {
            let distance = this.rPos.distSquared(mouse);
            let typefs: util.StringMap<() => string | null> = {
                "2023-cone": () => {
                    if (distance < this.odometry.pageLenToWorld(10.5*(Math.sqrt(2)+1)/2)) return "main";
                    return null;
                },
                "2023-cube": () => {
                    if (distance < this.odometry.pageLenToWorld(12*(Math.sqrt(2)+1)/2)) return "main";
                    return null;
                },
                "2024-note": () => {
                    if (distance > this.odometry.pageLenToWorld(7.5) && distance < this.odometry.pageLenToWorld(18)) return "main";
                    return null;
                },
            };
            if (this.type != null && this.type in typefs) return typefs[this.type]();
        }
        return null;
    }

    get type() { return this._type; }
    set type(value) {
        if (value != null && value.startsWith("§") && !Odometry2dRobot.TYPES.includes(value)) value = Odometry2dRobot.TYPES[0];
        if (this.type === value) return;
        this._builtinType = (value == null || !value.startsWith("§")) ? null : value.slice(1);
        this.change("type", this.type, this._type=value);
    }
    get builtinType() { return this._builtinType; }

    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }
    get velocityX() { return this.velocity.x; }
    set velocityX(v) { this.velocity.x = v; }
    get velocityY() { return this.velocity.y; }
    set velocityY(v) { this.velocity.y = v; }

    get heading() { return this._heading; }
    set heading(value) { this._heading = util.clampAngleDegrees(value); }
}
/** An obstacle on the odometry 2d field */
export class Odometry2dObstacle extends Odometry2dRender {
    private _radius: number;
    private _dir: number;

    public selected: boolean;

    constructor(parent: Odometry2d | Odometry2dRender, pos: util.VectorLike, radius?: number) {
        super(parent, pos);

        this._radius = 0;
        this._dir = 0;

        this.radius = util.castNumber(radius, 1);

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
            ctx.lineTo(...this.odometry.worldToCanvas(Vec2.dir(this.dir, this.radius).iadd(this.rPos)).xy);
            ctx.stroke();
            ctx.fillStyle = PROPERTYCACHE.get("--"+((this.hovered == "radius") ? "a" : "v8"));
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(Vec2.dir(this.dir, this.radius).iadd(this.rPos)).xy, 5*quality, 0, 2*Math.PI);
            ctx.fill();
        });

        this.selected = false;
    }

    get hovered() {
        if (!this.canHover) return null;
        let mouse = this.odometry.worldMouse;
        if (Vec2.dir(this.dir, this.radius).iadd(this.rPos).distSquared(mouse) < this.odometry.pageLenToWorld(5)**2) return "radius";
        if (this.rPos.distSquared(mouse) < this.radius**2) return "main";
        return null;
    }

    get radius() { return this._radius; }
    set radius(value) { this._radius = Math.max(0, value); }

    get dir() { return this._dir; }
    set dir(value) { this._dir = util.clampAngleDegrees(value); }
}

class Odometry3dRenderList extends util.List<Odometry3dRender> {
    readonly odometry;
    constructor(odometry: Odometry3d) {
        super();
        this.odometry = odometry;
    }
    convert(value: Odometry3dRender): Odometry3dRender | false { return value; }
    addFilter(value: Odometry3dRender): boolean { return value.odometry === this.odometry; }
    remFilter(value: Odometry3dRender): boolean { return value.odometry === this.odometry; }
    protected addCallback(value: Odometry3dRender): void { value.onAdd(); }
    protected remCallback(value: Odometry3dRender): void { value.onRem(); }
}
/** A 3d odometry rendering class */
export class Odometry3d extends Odometry {
    private static loadedFields: util.StringMap<util.StringMap<THREE.Object3D>> = {};
    private static loadingFields: util.StringMap<number> = {};
    private static loadedRobots: util.StringMap<{
        default?: util.StringMap<THREE.Object3D>,
        components?: util.StringMap<util.StringMap<THREE.Object3D>>,
    }> = {};
    private static loadingRobots: util.StringMap<number> = {};

    readonly renders;

    readonly scene;
    readonly wpilibGroup;
    private _camera: THREE.Camera | null;

    readonly renderer;
    readonly cssRenderer;

    private _controls: object | null;

    // #raycaster;
    // #raycastIntersections;

    private _requestRedraw: boolean;

    readonly axisScene;
    readonly axisSceneGroup;
    readonly axisSceneXAxis;
    readonly axisSceneYAxis;
    readonly axisSceneZAxis;
    readonly axisScenePlanes: THREE.Mesh[];

    readonly axisSceneSized;
    readonly axisSceneSizedGroup;
    readonly axisSceneSizedXAxis;
    readonly axisSceneSizedYAxis;
    readonly axisSceneSizedZAxis;
    readonly axisSceneSizedPlanes: THREE.Mesh[];
    private prevAxisSceneSizedWidth: number;
    private prevAxisSceneSizedHeight: number;

    private _field: THREE.Object3D | null;
    private _theField: THREE.Object3D | null;

    private _renderType: Odometry3dRenderType;
    private _controlType: Odometry3dControlType;
    private _isCinematic: boolean;
    private _origin: OdometryOrigin;
    
    /** A recursive call to modify each mesh within an Object3d. */
    private static traverseObject(mesh: THREE.Mesh, type: string): void {
        const oldMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const newMaterials = oldMaterials.map(oldMaterial => {
            if (!(
                (oldMaterial instanceof THREE.MeshBasicMaterial) ||
                (oldMaterial instanceof THREE.MeshLambertMaterial) ||
                (oldMaterial instanceof THREE.MeshPhongMaterial) ||
                (oldMaterial instanceof THREE.MeshStandardMaterial) ||
                (oldMaterial instanceof THREE.MeshToonMaterial) ||
                (oldMaterial instanceof THREE.MeshMatcapMaterial)
            )) return oldMaterial;
            return new THREE.MeshLambertMaterial({
                color: oldMaterial.color,
                transparent: oldMaterial.transparent,
                opacity: oldMaterial.opacity,
            });
        });
        oldMaterials.forEach(oldMaterial => oldMaterial.dispose());
        mesh.material = (newMaterials.length === 1) ? newMaterials[0] : newMaterials;
    }
    /**
     * Decaches a field from internal storage, disposing of all ThreeJS resources.
     * @returns true if successfully decached, otherwise false
     */
    static decacheField(name: string): boolean {
        if (!this.loadedFields[name]) return false;
        for (let type in this.loadedFields[name])
            this.loadedFields[name][type].traverse(obj => {
                if (!(obj instanceof THREE.Mesh)) return;
                obj.material.dispose();
                obj.geometry.dispose();
            });
        delete this.loadedFields[name];
        return true;
    }
    /**
     * Decaches all field models.
     * @returns true if all were successfully decached, otherwise false
     */
    static decacheAllFields(): boolean {
        let success = true;
        for (let name in this.loadedFields)
            success &&= this.decacheField(name);
        return success;
    }
    /** Loads a field into the cache and returns that model. */
    static async loadField(name: string, type: string): Promise<THREE.Object3D | null> {
        const templates = (GLOBALSTATE.properties.get("templates") as core.GlobalStateProperty<lib.Templates>).value;
        if (!templates) return null;
        if (!(name in templates)) return null;
        const template = templates[name];

        const templateModels = (GLOBALSTATE.properties.get("template-models") as core.GlobalStateProperty<lib.TemplateModels>).value;
        if (!templateModels) return null;
        if (!(name in templateModels)) return null;
        const modelSource = templateModels[name];

        if (this.loadedFields[name]) {
            if (this.loadedFields[name][type])
                return this.loadedFields[name][type];
            return null;
        }

        let t0 = util.castNumber(this.loadingFields[name]);
        let t1 = util.getTime();
        if (t1-t0 < 1000) return null;
        this.loadingFields[name] = t1;

        try {
            const gltf = await loadPromised(modelSource);
            this.loadedFields[name] = {};
            const scene = gltf.scene;
            ["basic", "cinematic"].forEach(type => {
                const object = this.loadedFields[name][type] = scene.clone();
                object.traverse(object => {
                    if (!(object instanceof THREE.Mesh)) return;
                    this.traverseObject(object, type);
                });
            });
            scene.traverse(object => {
                if (!(object instanceof THREE.Mesh)) return;
                object.material.dispose();
            });
        } catch (e) {}

        if (!this.loadedFields[name]) return null;
        if (!this.loadedFields[name][type]) return null;
        return this.loadedFields[name][type];
    }
    /**
     * Decaches a robot or a robot component from internal storage, disposing of all ThreeJS resources.
     * @returns true if successfully decached, otherwise false
     */
    static decacheRobot(name: string, component?: string): boolean {
        if (!this.loadedRobots[name]) return false;

        if (component == null) {
            const defaultModels = this.loadedRobots[name].default;
            if (!defaultModels) return false;
            for (let type in defaultModels)
                defaultModels[type].traverse(object => {
                    if (!(object instanceof THREE.Mesh)) return;
                    object.material.dispose();
                    object.geometry.dispose();
                });
            delete this.loadedRobots[name].default;
            return true;
        }

        const componentsModels = this.loadedRobots[name].components;
        if (!componentsModels) return false;
        if (!componentsModels[component]) return false;
        for (let type in componentsModels[component])
            componentsModels[component][type].traverse(object => {
                if (!(object instanceof THREE.Mesh)) return;
                object.material.dispose();
                object.geometry.dispose();
            });
        delete componentsModels[component][component];
        return true;
    }
    /**
     * Decaches all robot associated models.
     * @returns true if all were successfully decached, otherwise false
     */
    static decacheAllRobots(): boolean {
        let success = true;
        for (let name in this.loadedRobots) {
            success &&= this.decacheRobot(name);
            if (!this.loadedRobots[name]) continue;
            if (!this.loadedRobots[name].components) continue;
            for (let id in this.loadedRobots[name].components)
                success &&= this.decacheRobot(name, id);
        }
        return success;
    }
    /** Loads a robot or robot component into the internal cache and returns that model. */
    static async loadRobot(name: string, type: string, component: string | null = null): Promise<THREE.Object3D | null> {
        const robots = (GLOBALSTATE.properties.get("robots") as core.GlobalStateProperty<lib.Robots>).value;
        if (!robots) return null;
        if (!(name in robots)) return null;
        const robot = robots[name];
        if (component == null) {
        } else {
            if (!(component in robot.components))
                return null;
        }

        const robotModels = (GLOBALSTATE.properties.get("robots-models") as core.GlobalStateProperty<lib.RobotModels>).value;
        if (!robotModels) return null;
        if (!(name in robotModels)) return null;
        const models = robotModels[name];
        if (component == null) {
            if (models.default == null) return null;
        } else {
            if (models.components[component] == null) return null;
        }

        if (this.loadedRobots[name]) {
            if (component == null) {
                const defaultModels = this.loadedRobots[name].default;
                if (defaultModels && defaultModels[type])
                    return defaultModels[type];
            } else {
                const componentsModels = this.loadedRobots[name].components;
                if (componentsModels && componentsModels[component] && componentsModels[component][type])
                    return componentsModels[component][type];
            }
        }

        const bumperDetect = robot.bumperDetect;
        const zero = (component == null) ? robot.zero : robot.components[component].zero;
        const rotations = fromRotationSequence(...zero.rotations);
        const translations = (zero.translations === "auto") ? "auto" : new Vec3(zero.translations);

        const pth = (component == null) ? (models.default as string) : (models.components as util.StringMap)[component];

        let t0 = util.castNumber(this.loadingRobots[name]);
        let t1 = util.getTime();
        if (t1-t0 < 1000) return null;
        this.loadingRobots[name] = t1;

        if (!this.loadedRobots[name]) this.loadedRobots[name] = {};

        try {
            const gltf = await loadPromised(pth);
            const scene = gltf.scene;
            ["basic", "cinematic"].forEach(type => {
                let object: THREE.Object3D, prevObject: THREE.Object3D;
                object = scene.clone();
                object.traverse(object => {
                    if (!(object instanceof THREE.Mesh)) return;
                    this.traverseObject(object, type);
                    if (!bumperDetect) return;
                    const color = new util.Color([object.material.color.r*255, object.material.color.g*255, object.material.color.b*255]);
                    const h = color.h, s = color.s, thresh = 60;
                    const score = Math.min(1, Math.max(0, (1-Math.min(Math.abs(h-210)/thresh, Math.abs(h-0)/thresh, Math.abs(h-360)/thresh))));
                    if (score*s < 0.5) return;
                    object.material._isBumper = true;
                });
                object.quaternion.copy(rotations);
                [object, prevObject] = [new THREE.Object3D(), object];
                object.add(prevObject);
                let boundingBox = new THREE.Box3().setFromObject(object);
                let translation = (translations == "auto") ? new Vec3([
                    -(boundingBox.max.x+boundingBox.min.x)/2,
                    -(boundingBox.max.y+boundingBox.min.y)/2,
                    -boundingBox.min.z,
                ]) : translations;
                object.position.set(
                    object.position.x + translation.x,
                    object.position.y + translation.y,
                    object.position.z + translation.z,
                );
                [object, prevObject] = [new THREE.Object3D(), object];
                object.add(prevObject);
                object.name = "§§§"+(component == null ? "" : component);
                object._bumperDetect = bumperDetect;
                if (component == null) {
                    let defaultModels = this.loadedRobots[name].default
                    if (!defaultModels) defaultModels = {};
                    defaultModels[type] = object;
                    
                    this.loadedRobots[name].default = defaultModels;
                } else {
                    let componentsModels = this.loadedRobots[name].components;
                    if (!componentsModels) componentsModels = {};
                    if (!componentsModels[component]) componentsModels[component] = {};
                    componentsModels[component][type] = object;

                    this.loadedRobots[name].components = componentsModels;
                }
            });
            scene.traverse(object => {
                if (!(object instanceof THREE.Mesh)) return;
                object.material.dispose();
            });
        } catch (e) {}

        if (!this.loadedRobots[name]) return null;

        if (component == null) {
            const defaultModels = this.loadedRobots[name].default;
            if (!defaultModels) return null;
            if (!defaultModels[type]) return null;
            return defaultModels[type];
        }
        const componentsModels = this.loadedRobots[name].components;
        if (!componentsModels) return null;
        if (!componentsModels[component]) return null;
        if (!componentsModels[component][type]) return null;
        return componentsModels[component][type];
    }

    /** Given some number array, generate the positioning schema. */
    static generatePositioning(value: number[], lengthUnits: string, angleUnits: string, z2d: number = 0): util.pose3d {
        if (value.length == 7)
            return {
                translation: value.slice(0, 3).map(v => lib.Unit.convert(v, lengthUnits, "m")) as util.vec3,
                rotation: value.slice(3, 7) as util.vec4,
            };
        if (value.length == 3)
            return {
                translation: [...value.slice(0, 2).map(v => lib.Unit.convert(v, lengthUnits, "m")) as util.vec2, z2d],
                rotation: (d => [Math.cos(d/2), 0, 0, Math.sin(d/2)])(lib.Unit.convert(value[2], angleUnits, "rad")), // sketchy quaternion math to make it slightly more performant
            };
        return {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 0],
        };
    }

    constructor(elem: HTMLDivElement | null) {
        super(elem);

        let contextLost = false;
        this.eCanvas.addEventListener("webglcontextlost", () => (contextLost = true));
        this.eCanvas.addEventListener("webglcontextrestored", () => {
            this.requestRedraw();
            contextLost = false;
        });

        this.renders = new Odometry3dRenderList(this);

        this.scene = new THREE.Scene();
        this.wpilibGroup = new THREE.Group();
        this.scene.add(this.wpilibGroup);
        this.wpilibGroup.quaternion.copy(WPILIB2THREE);
        this._camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        let oldCameraPosition: number[] = new Array(7).fill(-1e9);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.eCanvas, alpha: true, powerPreference: "default" });
        this.renderer.shadowMap.enabled = this.isCinematic;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.cssRenderer = new CSS2DRenderer({ element: this.eOverlay });
        
        this._controls = null;

        // this.#raycaster = new THREE.Raycaster();
        // this.#raycastIntersections = [];

        this._requestRedraw = true;

        let rect = this.elem.getBoundingClientRect();
        
        this.eCanvas.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.controls) return;
            if (this.controlType === "free") (this.controls as PointerLockControls).lock();
        });
        this.elem.addEventListener("mousemove", e => {
            if (!this.controls) return;
            let x = (e.pageX - rect.left) / rect.width;
            let y = (e.pageY - rect.top) / rect.height;
            x = (x*2)-1; y = (y*2)-1;
            if (this.controlType === "free" && (this.controls as PointerLockControls).isLocked) x = y = 0;
            // this.raycaster.setFromCamera(new THREE.Vector2(x, -y), this.camera);
            // TODO: find way to raycast just for a single object / pose
            // this.#raycastIntersections = this.raycaster.intersectObjects(this.renders.filter(render => render.hasObject()).map(render => render.theObject.children[0].children[0]), false);
        });

        const updateCamera = () => {
            if (!this.camera) return;
            if (this.renderType === "proj") {
                let camera = (this.camera as THREE.PerspectiveCamera);
                if (camera.aspect !== rect.width / rect.height) {
                    camera.aspect = rect.width / rect.height;
                    camera.updateProjectionMatrix();
                }
                return;
            }
            if (this.renderType === "iso") {
                let camera = (this.camera as THREE.OrthographicCamera);
                let size = 15;
                let aspect = rect.width / rect.height;
                camera.left = -size/2 * aspect;
                camera.right = +size/2 * aspect;
                camera.top = +size/2;
                camera.bottom = -size/2;
                return;
            }
        };
        this.addHandler("change-renderType", updateCamera);

        const updateScene = () => {
            rect = this.elem.getBoundingClientRect();
            this.renderer.setSize(Math.ceil(rect.width), Math.ceil(rect.height));
            this.cssRenderer.setSize(Math.ceil(rect.width), Math.ceil(rect.height));
            this.renderer.setPixelRatio(this.quality);
            updateCamera();
            this.requestRedraw();
        };
        new ResizeObserver(updateScene).observe(this.elem);
        this.addHandler("change-quality", updateScene);

        const radius = 0.01;
        const length = 5;

        const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);

        // TODO: fix mem leak w these scenes vvv

        this.axisScene = new THREE.Group();
        this.axisScene._builtin = "axis-scene";
        this.axisSceneGroup = new THREE.Group();
        this.axisScene.add(this.axisSceneGroup);

        this.axisSceneXAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        this.axisSceneXAxis.position.set(length/2, 0, 0);
        this.axisSceneXAxis.rotateZ(Math.PI/2);
        this.axisSceneGroup.add(this.axisSceneXAxis);

        this.axisSceneYAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        this.axisSceneYAxis.position.set(0, length/2, 0);
        this.axisSceneGroup.add(this.axisSceneYAxis);

        this.axisSceneZAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        this.axisSceneZAxis.position.set(0, 0, length/2);
        this.axisSceneZAxis.rotateX(Math.PI/2);
        this.axisSceneGroup.add(this.axisSceneZAxis);

        this.axisScenePlanes = [];

        this.axisSceneSized = new THREE.Group();
        this.axisSceneSized._builtin = "axis-scene-sized";
        this.axisSceneSizedGroup = new THREE.Group();
        this.axisSceneSized.add(this.axisSceneSizedGroup);

        this.axisSceneSizedXAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        this.axisSceneSizedXAxis.position.set(length/2, 0, 0);
        this.axisSceneSizedXAxis.rotateZ(Math.PI/2);
        this.axisSceneSizedGroup.add(this.axisSceneSizedXAxis);

        this.axisSceneSizedYAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        this.axisSceneSizedYAxis.position.set(0, length/2, 0);
        this.axisSceneSizedGroup.add(this.axisSceneSizedYAxis);

        this.axisSceneSizedZAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        this.axisSceneSizedZAxis.position.set(0, 0, length/2);
        this.axisSceneSizedZAxis.rotateX(Math.PI/2);
        this.axisSceneSizedGroup.add(this.axisSceneSizedZAxis);

        this.prevAxisSceneSizedWidth = this.prevAxisSceneSizedHeight = 0;

        this.axisSceneSizedPlanes = [];

        this._field = null;
        this._theField = null;

        const hemLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
        this.scene.add(hemLight);

        const lights: THREE.Light[][] = [[], []];

        {
            const light = new THREE.PointLight(0xffffff, 0.5);
            lights[0].push(light);
            light.position.set(0, 10, 0);
        }
        {
            const data: [util.vec3, util.vec3, number][] = [
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

        this._renderType = null;
        this._controlType = null;
        this._isCinematic = true;
        this._origin = "blue-";

        let keys: Set<string> = new Set();
        let times: util.StringMap<number> = {};
        let sprint = false, sprintBy: string | null = null;

        this.eCanvas.addEventListener("keydown", e => {
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

            let t0 = util.castNumber(times[e.code]);
            let t1 = util.getTime();
            times[e.code] = t1;

            if (t1-t0 > 250) return;
            if (t1-t0 < 50) return;

            sprint = true;
            sprintBy = e.code;
        });
        this.eCanvas.addEventListener("keyup", e => {
            e.stopPropagation();

            if (!keys.has(e.code)) return;
            keys.delete(e.code);

            if (e.code != sprintBy) return;
            sprint = false;
        });
        const velocity = new Vec3();

        const updateField = () => {
            this.wpilibGroup.scale.x = this.origin.startsWith("blue") ? 1 : -1;
            this.wpilibGroup.scale.y = this.origin.endsWith("+") ? 1 : -1;
            if (!this.theField) return;
            this.theField.scale.x = this.origin.startsWith("blue") ? 1 : -1;
            if (this.field && this.theField && this.field._builtin)
                this.theField.scale.y = this.origin.endsWith("+") ? 1 : -1;
            else this.theField.scale.z = this.origin.endsWith("+") ? 1 : -1;
        };
        this.addHandler("change-field", updateField);
        this.addHandler("change-origin", updateField);

        let fieldLock = false;

        const timer1 = new util.Timer(true);
        const timer2 = new util.Timer(true);
        this.addHandler("render", (delta: number) => {
            if (timer1.dequeueAll(250)) updateScene();
            if (contextLost && timer2.dequeueAll(500)) this.renderer.forceContextRestore();

            this.renders.list.forEach(render => render.update(delta));

            let colorR = PROPERTYCACHE.getColor("--cr");
            let colorG = PROPERTYCACHE.getColor("--cg");
            let colorB = PROPERTYCACHE.getColor("--cb");
            let colorV = PROPERTYCACHE.getColor("--v2");

            planeMaterial.color.set(colorV.toHex(false));

            if (this.field == this.axisScene) {

                this.axisSceneXAxis.material.color.set(colorR.toHex(false));
                this.axisSceneYAxis.material.color.set(colorG.toHex(false));
                this.axisSceneZAxis.material.color.set(colorB.toHex(false));

                const planes = this.axisScenePlanes;
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
                    let plane = planes.pop() as THREE.Mesh;
                    this.axisScene.remove(plane);
                    this.requestRedraw();
                }

            }
            if (this.field == this.axisSceneSized) {

                this.axisSceneSizedXAxis.material.color.set(colorR.toHex(false));
                this.axisSceneSizedYAxis.material.color.set(colorG.toHex(false));
                this.axisSceneSizedZAxis.material.color.set(colorB.toHex(false));
                this.axisSceneSizedGroup.position.set(...this.size.div(-2).xy, 0);

                const planes = this.axisSceneSizedPlanes;
                let width = this.prevAxisSceneSizedWidth;
                let height = this.prevAxisSceneSizedHeight;
                if (width != this.w || height != this.h) {
                    width = this.prevAxisSceneSizedWidth = this.w;
                    height = this.prevAxisSceneSizedHeight = this.h;
                    while (planes.length > 0) {
                        let plane = planes.pop() as THREE.Mesh;
                        this.axisSceneSized.remove(plane);
                        plane.geometry.dispose();
                    };
                    this.requestRedraw();
                }
                let i = 0;
                for (let x = 0; x < width; x++) {
                    for (let y = 0; y < height; y++) {
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
                        let planeW = Math.min(1, width-x), planeH = Math.min(1, height-y);
                        if (plane.geometry.w != planeW || plane.geometry.h != planeH) {
                            plane.geometry.dispose();
                            plane.geometry = new THREE.PlaneGeometry(planeW, planeH);
                            plane.geometry.w = planeW;
                            plane.geometry.h = planeH;
                            this.requestRedraw();
                        }
                        plane.position.set(x+planeW/2-width/2, y+planeH/2-height/2, 0);
                    }
                }
                while (planes.length > i) {
                    let plane = planes.pop() as THREE.Mesh;
                    this.axisSceneSized.remove(plane);
                    plane.geometry.dispose();
                    this.requestRedraw();
                }
            }

            if (!fieldLock)
                (async () => {
                    fieldLock = true;
                    this.field = (this.template == null) ? this.axisScene : ((await Odometry3d.loadField(
                        this.template,
                        this.isCinematic ? "cinematic" : "basic"
                    )) || this.axisSceneSized);
                    fieldLock = false;
                })();

            if (this.controlType == "orbit") {
                let controls = (this.controls as OrbitControls);
                controls.update();
            } else if (this.controlType == "free") {
                let controls = (this.controls as PointerLockControls);
                if (controls.isLocked) {
                    let xP = keys.has("KeyD") || keys.has("ArrowRight");
                    let xN = keys.has("KeyA") || keys.has("ArrowLeft");
                    let yP = keys.has("KeyW") || keys.has("ArrowUp");
                    let yN = keys.has("KeyS") || keys.has("ArrowDown");
                    let zP = keys.has("Space");
                    let zN = keys.has("ShiftLeft");
                    let x = (+xP) - (+xN);
                    let y = (+yP) - (+yN);
                    let z = (+zP) - (+zN);
                    velocity.iadd(new Vec3([x, y, z]).imul(keys.has("ShiftRight") ? 0.1 : sprint ? 1 : 0.5).imul(delta/1000));
                    velocity.imul(0.9);
                    velocity.imap(v => (Math.abs(v) < util.EPSILON ? 0 : v));
                    controls.moveRight(velocity.x);
                    controls.moveForward(velocity.y);
                    if (this.camera) this.camera.position.y += velocity.z;
                } else {
                    velocity.imul(0);
                }
            }
            let newCameraPosition: number[] = this.camera ? [
                this.camera.position.x, this.camera.position.y, this.camera.position.z,
                this.camera.quaternion.w, this.camera.quaternion.x, this.camera.quaternion.y, this.camera.quaternion.z,
            ] : new Array(7).fill(0);
            for (let i = 0; i < 7; i++) {
                if (i < 3) {
                    if (Math.abs(oldCameraPosition[i] - newCameraPosition[i]) < util.EPSILON) continue;
                } else {
                    if (oldCameraPosition[i] === newCameraPosition[i]) continue;
                }
                oldCameraPosition[i] = newCameraPosition[i];
                this.requestRedraw();
            }

            if (!this._requestRedraw) return;
            this._requestRedraw = false;

            if (!this.camera) return;
            this.renderer.render(this.scene, this.camera);
            this.cssRenderer.render(this.scene, this.camera);
        });

        this.renderType = "proj";
        this.controlType = "orbit";
        this.isCinematic = false;
        this.origin = "blue+";
    }

    get camera() { return this._camera; }
    get controls() { return this._controls; }
    // get raycaster() { return this.#raycaster; }
    // get raycastIntersections() { return this.#raycastIntersections; }

    /** Requests a redraw of the 3d scene, as constant redrawing is performant. */
    requestRedraw(): void { this._requestRedraw = true; }

    get field() { return this._field; }
    get theField() { return this._theField; }
    set field(value) {
        if (this.field === value) return;
        if (this.field && this.theField) {
            this.wpilibGroup.remove(this.theField);
            this._theField = null;
        }
        [value, this._field] = [this._field, value];
        if (this.field && this.theField) {
            this._theField = this.field._builtin ? this.field : this.field.clone();
            if (!this.field._builtin) this.theField.quaternion.copy(THREE2WPILIB);
            this.wpilibGroup.add(this.theField);
        }
        this.change("field", value, this.field);
        this.requestRedraw();
    }

    /** Reinstantiates the control object, unhooking then rehooking everything accordingly. */
    updateControls(): void {
        if (!this.camera) return;
        if (this.controls instanceof OrbitControls) {
            this.controls.dispose();
        } else if (this.controls instanceof PointerLockControls) {
            this.controls.unlock();
            this.controls.disconnect();
        }
        let controlsMap = {
            orbit: () => {
                const controls = new OrbitControls(this.camera as THREE.Camera, this.eCanvas);
                controls.target.set(0, 0, 0);
                controls.enablePan = false;
                return controls;
            },
            free: () => new PointerLockControls(this.camera as THREE.Camera, this.eCanvas),
            pan: () => {
                const controls = new OrbitControls(this.camera as THREE.Camera, this.eCanvas);
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
        this._controls = (this.controlType != null && this.controlType in controlsMap) ? (controlsMap[this.controlType]() as object) : null;
        if (this.controls instanceof OrbitControls) {
            this.elem.classList.remove("showinfo");
        } else if (this.controls instanceof PointerLockControls) {
            this.controls.addEventListener("lock", () => this.elem.classList.add("showinfo"));
            this.controls.addEventListener("unlock", () => this.elem.classList.remove("showinfo"));
        }
    }
    get renderType() { return this._renderType; }
    set renderType(value) {
        if (this.renderType === value) return;
        [value, this._renderType] = [this.renderType, value];
        let renderMap = {
            proj: () => new THREE.PerspectiveCamera(75, 1, 0.15, 1000),
            iso: () => new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000),
        };
        this._camera = (this.renderType != null && this.renderType in renderMap) ? renderMap[this.renderType]() : null;
        this.repositionCamera();
        this.change("renderType", value, this.renderType);
        this.updateControls();
        this.requestRedraw();
    }
    /** Repositions the camera where it's default spawn position would be. */
    repositionCamera(dist: number = 1): void {
        if (!this.camera) return;
        let renderMap = {
            proj: [0, 7.5, -7.5],
            iso: [10, 10, -10],
        };
        dist = Math.max(0, dist);
        this.camera.position.set(...new Vec3((this.renderType != null && this.renderType in renderMap) ? (renderMap[this.renderType] as util.vec3) : 0).imul(dist).xyz);
        this.camera.lookAt(0, 0, 0);
    }
    get controlType() { return this._controlType; }
    set controlType(value) {
        if (this.controlType === value) return;
        this.change("controlType", this.controlType, this._controlType=value);
        this.updateControls();
    }
    get isCinematic() { return this._isCinematic; }
    set isCinematic(value) {
        if (this.isCinematic === value) return;
        this.change("isCinematic", this.isCinematic, this._isCinematic=value);
    }
    get origin() { return this._origin; }
    set origin(value) {
        if (this.origin === value) return;
        this.change("origin", this.origin, this._origin=value);
        this.requestRedraw();
    }
}
/** A render object of the 3d odometry field. */
export class Odometry3dRender extends util.Target {
    static LOADEDOBJECTS: util.StringMap<THREE.Object3D> = {};
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
                pobj.quaternion.copy(fromRotationSequence(...[
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
                ][j][i] as lib.RobotRotation[]));
                this.LOADEDOBJECTS["arrow"+"+-"[i]+"xyz"[j]] = obj;
            }
        }

        const axes = new THREE.Object3D();
        const length = 1;
        const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
        let xAxis, yAxis, zAxis;
        xAxis = new THREE.Mesh(
            geometry,
            material,
        );
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        yAxis = new THREE.Mesh(
            geometry,
            material,
        );
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        zAxis = new THREE.Mesh(
            geometry,
            material,
        );
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
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

    static readonly TYPES: util.Immutable<string[]> = [
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
    /** Get the human readable name of a specific type. */
    static getTypeName(type: string): string {
        let names: util.StringMap = {
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
        let robots = (GLOBALSTATE.properties.get("robots") as core.GlobalStateProperty<lib.Robots>).value;
        if (robots && type in robots) return util.castString(robots[type].name, type);
        return type;
    }
    static readonly typeMenuStructure: util.Immutable<MenuStructure> = [
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
    /** Builds a Menu object from a menu structure. */
    static buildTypeMenu(menu: core.Menu, currentType: string | null, signal?: util.Target) {
        if (!signal) signal = new util.Target();
        const dfs = (menu: core.Menu, struct: MenuStructure) => {
            struct.forEach(substruct => {
                if (substruct == null) return menu.items.add(new core.MenuDivider());
                if (typeof(substruct) === "object") {
                    let item = menu.items.add(new core.MenuItem(substruct.name, (substruct.key === currentType) ? "checkmark" : "")) as core.MenuItem;
                    item.addHandler("trigger", (e: MouseEvent) => {
                        if (!substruct.key) return;
                        (signal as util.Target).post("type", substruct.key);
                    });
                    if (substruct.sub) dfs(item.menu, substruct.sub);
                    return;
                }
                let item = menu.items.add(new core.MenuItem(this.getTypeName(substruct), (substruct === currentType) ? "checkmark" : "")) as core.MenuItem;
                item.addHandler("trigger", (e: MouseEvent) => {
                    (signal as util.Target).post("type", substruct);
                });
            });
        };
        let robots = (GLOBALSTATE.properties.get("robots") as core.GlobalStateProperty<lib.Robots>).value;
        dfs(menu, [
            ...this.typeMenuStructure as MenuStructure,
            null,
            ...Object.keys(util.castObject(robots)),
        ]);
        return signal;
    }

    readonly odometry;
    
    private _components: util.StringMap<Odometry3dRenderComponent>;
    readonly defaultComponent: Odometry3dRenderComponent;

    public name: string;
    public color: string | null;
    public isGhost: boolean;
    public isSolid: boolean;
    public display: object;

    private _type: string | null;
    private _builtinType: string | null;

    public showObject: boolean;
    
    constructor(odometry: Odometry3d, pos?: util.VectorLike, name?: string, type?: string) {
        super();

        this.odometry = odometry;

        this.addHandler("change", (attribute: string, from: any, to: any) => this.requestRedraw());
        this._components = {};
        this.defaultComponent = new Odometry3dRenderComponent(this, null);
        this.defaultComponent.pos.set(pos);

        this.name = "";
        this.color = "";
        this.isGhost = false;
        this.isSolid = false;
        this.display = {};

        this._type = null;
        this._builtinType = null;

        this.showObject = true;

        this.addHandler("rem", () => {
            this.defaultComponent.onRem();
            for (let id in this._components)
                this._components[id].onRem();
        });

        this.addHandler("update", (delta: number) => {
            this.defaultComponent.update(delta);
            for (let id in this._components)
                this._components[id].update(delta);
        });

        this.name = util.castString(name);

        this.type = type || null;
    }

    /** Requests a redraw of the 3d scene, as constant redrawing is performant. */
    requestRedraw(): void { return this.odometry.requestRedraw(); }

    get components() { return Object.keys(this._components); }
    /** Checks if a component exists in this render object. */
    hasComponent(id: string): boolean { return id in this._components; }
    /** Gets the component associated with its component id. */
    getComponent(id: string): Odometry3dRenderComponent | null {
        if (!this.hasComponent(id)) return null;
        return this._components[id];
    }
    
    get type() { return this._type; }
    set type(value) {
        if (value != null && value.startsWith("§") && !Odometry3dRender.TYPES.includes(value)) value = Odometry3dRender.TYPES[0];
        if (this.type === value) return;
        this._builtinType = (value == null || !value.startsWith("§")) ? null : value.slice(1);
        this.change("type", this.type, this._type=value);
        for (let id in this._components)
            this._components[id].onRem();
        this._components = {};
        if (this.builtinType != null) return;
        const robots = (GLOBALSTATE.properties.get("robots") as core.GlobalStateProperty<lib.Robots>).value;
        if (!robots) return;
        const robot = robots[this.type as string];
        if (!robot) return;
        const components = robot.components;
        if (!components) return;
        for (let id in components)
            this._components[id] = new Odometry3dRenderComponent(this, id);
    }
    get builtinType() { return this._builtinType; }

    get hideObject() { return !this.showObject; }
    set hideObject(value) { this.showObject = !value; }

    update(delta: number) { this.post("update", delta); }
}
/** A component of a 3d render object. */
export class Odometry3dRenderComponent extends util.Target {
    readonly render;
    readonly component;

    readonly pos;
    readonly q;

    private _object: THREE.Object3D | null;
    private _theObject: THREE.Object3D | null;

    constructor(render: Odometry3dRender, component: string | null = null) {
        super();

        this.render = render;
        this.component = component;
        
        this.pos = new Vec3();
        this.pos.addHandler("change", (attribute: string, from: any, to: any) => this.change("pos."+attribute, from, to));
        this.q = new Vec4();
        this.q.addHandler("change", (attribute: string, from: any, to: any) => this.change("q."+attribute, from, to));
        this.addHandler("change", (attribute: string, from: any, to: any) => this.requestRedraw());

        const hint = new core.Hint();
        let hintType: number | null = null;
        const hName = hint.entries.add(new core.HintNameEntry("")) as core.HintNameEntry;
        const hPosX = new core.HintKeyValueEntry("X", 0);
        const hPosY = new core.HintKeyValueEntry("Y", 0);
        const hPosZ = new core.HintKeyValueEntry("Z", 0);
        const hDirD = new core.HintKeyValueEntry("Dir", 0);
        const hDirW = new core.HintKeyValueEntry("QW", 0);
        const hDirX = new core.HintKeyValueEntry("QX", 0);
        const hDirY = new core.HintKeyValueEntry("QY", 0);
        const hDirZ = new core.HintKeyValueEntry("QZ", 0);

        this._object = null;
        this._theObject = null;

        let loadLock = false;
        let modelObject: THREE.Object3D | null = null, theModelObject: THREE.Object3D | null = null;

        this.addHandler("rem", () => {
            this.object = null;
            this.odometry.hints.rem(hint);
        });

        this.addHandler("update", (delta: number) => {
            let color =
                (this.render.color != null && this.render.color.startsWith("--")) ?
                    PROPERTYCACHE.getColor(this.render.color) :
                new util.Color(this.render.color || undefined);
            if (this.render.type != null) {
                if (this.render.builtinType != null)
                    theModelObject = Odometry3dRender.LOADEDOBJECTS[this.render.builtinType];
                else if (!loadLock)
                    (async () => {
                        loadLock = true;
                        theModelObject = await Odometry3d.loadRobot(
                            this.render.type as string,
                            this.odometry.isCinematic ? "cinematic" : "basic",
                            this.component,
                        );
                        loadLock = false;
                    })();
            } else theModelObject = null;
            if (modelObject !== theModelObject) {
                modelObject = theModelObject;
                this.object = modelObject;
                if (this.theObject != null) {
                    this.theObject._cssObj = new CSS2DObject(document.createElement("div"));
                    this.theObject.add(this.theObject._cssObj);
                    this.theObject.traverse(object => {
                        if (!(object instanceof THREE.Mesh)) return;
                        if (!("_transparent" in object.material))
                            object.material._transparent = object.material.transparent;
                        if (!("_opacity" in object.material))
                            object.material._opacity = object.material.opacity;
                        if (!("_color" in object.material))
                            object.material._color = object.material.color.clone();
                    });
                    this.theObject.isGhost = this.theObject.isSolid = null;
                }
                this.requestRedraw();
            }
            if (!this.object || !this.theObject) return;
            this.theObject.visible = this.render.showObject;
            const cssObj = this.theObject._cssObj;
            if (this.theObject.isGhost != this.render.isGhost) {
                this.theObject.isGhost = this.render.isGhost;
                this.theObject.traverse(object => {
                    if (!(object instanceof THREE.Mesh)) return;
                    if (this.render.isGhost) {
                        object.material.transparent = true;
                        object.material.opacity = object.material._opacity * 0.25;
                    } else {
                        object.material.transparent = object.material._transparent;
                        object.material.opacity = object.material._opacity;
                    }
                    object.material.needsUpdate = true;
                });
                this.requestRedraw();
            }
            let hovered = false;
            if (this.theObject.isSolid !== this.render.isSolid) {
                this.theObject.isSolid = this.render.isSolid;
                this.theObject.traverse(object => {
                    // if (!hovered)
                    //     if (this.odometry.raycastIntersections[0])
                    //         if (obj == this.odometry.raycastIntersections[0].object)
                    //             hovered = true;
                    if (!(object instanceof THREE.Mesh)) return;
                    if (this.render.isSolid) {
                        object.material.color.set(color.toHex(false));
                    } else {
                        object.material.color.set(object.material._color);
                    }
                });
                this.requestRedraw();
            }
            this.theObject.position.set(
                this.x - this.odometry.size.x/2 + (this.component == null ? 0 : this.render.defaultComponent.x),
                this.y - this.odometry.size.y/2 + (this.component == null ? 0 : this.render.defaultComponent.y),
                this.z + (this.component == null ? 0 : this.render.defaultComponent.z),
            );
            this.theObject.quaternion.set(this.qx, this.qy, this.qz, this.qw);
            if (this.component != null && this.render.defaultComponent.theObject != null)
                this.theObject.quaternion.premultiply(this.render.defaultComponent.theObject.quaternion);
            if (this.object._bumperDetect || this.render.builtinType != null)
                this.theObject.traverse(object => {
                    if (!(object instanceof THREE.Mesh)) return;
                    if (!object.material._isBumper) {
                        if (this.render.type == null) return;
                        if (this.render.builtinType == null) return;
                        if (this.render.builtinType === "axis") return;
                    }
                    object.material.color.set(color.toHex(false));
                });
            let type = util.castNumber(this.render.display.type);
            let data = util.castStringArray(this.render.display.data);
            if (hovered && this.component == null) {
                this.odometry.hints.add(hint);
                if (hintType != type) {
                    hintType = type;
                    if (hintType == 7) {
                        hint.entries.remMultiple(hDirD);
                        hint.entries.addMultiple(hPosX, hPosY, hPosZ, hDirW, hDirX, hDirY, hDirZ);
                    } else if (hintType == 3) {
                        hint.entries.remMultiple(hPosZ, hDirW, hDirX, hDirY, hDirZ);
                        hint.entries.addMultiple(hPosX, hPosY, hDirD);
                    } else {
                        hint.entries.remMultiple(hPosX, hPosY, hPosZ, hDirD, hDirW, hDirX, hDirY, hDirZ);
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
                    let rect = cssObj.element.getBoundingClientRect();
                    hint.place([rect.left, rect.top]);
                }
            } else this.odometry.hints.rem(hint);
        });
    }

    get odometry() { return this.render.odometry; }
    /** Requests a redraw of the 3d scene, as constant redrawing is performant. */
    requestRedraw(): void { this.render.requestRedraw(); }

    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }
    get z() { return this.pos.z; }
    set z(v) { this.pos.z = v; }

    get qw() { return this.q.w; }
    set qw(v) { this.q.w = v; }
    get qx() { return this.q.x; }
    set qx(v) { this.q.x = v; }
    get qy() { return this.q.y; }
    set qy(v) { this.q.y = v; }
    get qz() { return this.q.z; }
    set qz(v) { this.q.z = v; }

    get object() { return this._object; }
    get theObject() { return this._theObject; }
    set object(value) {
        if (this.object === value) return;

        if (this.object && this.theObject) {
            this.odometry.wpilibGroup.remove(this.theObject);
            this.theObject.traverse(object => {
                if (object instanceof CSS2DObject)
                    object.removeFromParent();
                if (!(object instanceof THREE.Mesh)) return;
                object.material.dispose();
            });
            this._theObject = null;
        }

        this._object = value;

        if (this.object && this.theObject) {
            this._theObject = this.object.clone();
            this.theObject.traverse(object => {
                if (!(object instanceof THREE.Mesh)) return;
                const isBumper = !!object.material._isBumper;
                object.material = object.material.clone();
                object.material._isBumper = isBumper;
            });
            this.odometry.wpilibGroup.add(this.theObject);
        }

        this.requestRedraw();
    }

    update(delta: number): void { this.post("update", delta); }
};
