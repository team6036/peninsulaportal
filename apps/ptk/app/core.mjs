import * as util from "./util.mjs";
import { V } from "./util.mjs";
import * as lib from "./lib.mjs";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

export { THREE };

export const LOADER = new GLTFLoader();

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


class PropertyCache extends util.Target {
    #cache;
    #colorCache;

    constructor() {
        super();

        this.#cache = {};
        this.#colorCache = {};
    }

    get(k) {
        k = String(k);
        if (k in this.#cache) return this.#cache[k];
        this.#cache[k] = getComputedStyle(document.body).getPropertyValue(k);
        return this.get(k);
    }
    getColor(k) {
        k = String(k);
        if (k in this.#colorCache) return this.#colorCache[k];
        this.#colorCache[k] = new util.Color(this.get(k));
        return this.getColor(k);
    }
    clear() {
        this.#cache = {};
        this.#colorCache = {};
    }
}
export const PROPERTYCACHE = new PropertyCache();


export class LoadingElement extends HTMLElement {
    #type;
    #axis;

    static observedAttributes = ["type", "axis"];

    constructor() {
        super();

        this.#type = null;
        this.#axis = null;

        this.type = "scroll";
        this.axis = "x";
    }

    #update() {
        this.innerHTML = "<div>"+Array.from(new Array(4).keys()).map(i => "<div style='--i:"+i+";'></div>").join("")+"</div>";
    }

    get type() { return this.#type; }
    set type(v) {
        v = String(v);
        if (!["scroll", "bounce"].includes(v)) return;
        if (this.type == v) return;
        this.#type = v;
        this.setAttribute("type", this.type);
        return this.#update();
    }
    get axis() { return this.#axis; }
    set axis(v) {
        v = String(v);
        if (!["x", "y"].includes(v)) return;
        if (this.axis == v) return;
        this.#axis = v;
        this.setAttribute("axis", this.axis);
        return this.#update();
    }

    attributeChangedCallback(name, prev, curr) {  this[name] = curr; }
}
window.customElements.define("p-loading", LoadingElement);


export default class App extends util.Target {
    #setupDone;

    #base;
    #colors;
    #accent;

    constructor() {
        super();

        this.#setupDone = false;

        this.#base = [];
        this.#colors = {};
        this.#accent = null;

        this.addHandler("start", async () => {
            let id = setInterval(async () => {
                if (document.readyState != "complete") return;
                clearInterval(id);
                await this.postResult("pre-setup");
                await this.setup();
                await this.postResult("post-setup");
                let t0 = null;
                const update = async () => {
                    window.requestAnimationFrame(update);
                    let t1 = util.getTime();
                    if (t0 == null) return t0 = t1;
                    this.update(t1-t0);
                    t0 = t1;
                };
                update();
            }, 10);
        });

        this.addHandler("setup", () => {
            const params = new URLSearchParams(window.location.search);
            const KEY = String(params.get("key"));
            const ID = String(params.get("id"));
            const odom = (KEY == "ptk_odom2d") ? new Odometry2d() : (KEY == "ptk_odom3d") ? new Odometry3d() : null;
            document.body.appendChild(odom.elem);
            odom.size = [1654, 821];
            odom.imageSrc = "2024.png";
            const robots = {};
            window.api.onData((_, data) => {
                data.forEach((cmd) => {
                    if (cmd.length <= 0) return;
                    const name = String(cmd.shift());
                    let namefs = {
                        add: () => {
                            if (cmd.length != 1) return console.error("ADD: Command length", cmd.length);
                            const id = String(cmd.shift());
                            if (id in robots) return console.error("ADD: Preexisting robot with id", id);
                            robots[id] = odom.render.addRender(new Odometry2d.Robot(odom.render));
                        },
                        rem: () => {
                            if (cmd.length != 1) return console.error("REM: Command length", cmd.length);
                            const id = String(cmd.shift());
                            if (!(id in robots)) return console.error("REM: Nonexistent robot with id", id);
                        },
                        c: () => {
                            if (cmd.length != 3) return console.error("C: Command length", cmd.length);
                            const id = String(cmd.shift());
                            let k = String(cmd.shift());
                            let v = cmd.shift();
                            if (!(id in robots)) return console.error("C: Nonexistent robot with id", id);
                            let k2 = "";
                            for (let i = 0; i < k.length; i++) {
                                let c = k[i];
                                if (c == "_") continue;
                                if (i-1 >= 0 && k[i-1] == "_") k2 += c.toUpperCase();
                                else k2 += c.toLowerCase();
                            }
                            k = k2;
                            if (["x", "y", "w", "h", "velocityX", "velocityY"].includes(k)) v *= 100;
                            if (["heading"].includes(k)) v *= 180/Math.PI;
                            if (k == "color") {
                                robots[id].color = "c"+v;
                                robots[id].colorH = "c"+v+"5";
                                return;
                            }
                            robots[id][k] = v;
                        },
                    };
                    if (name in namefs) namefs[name]();
                });
            });
            window.api.sendReady();
            this.addHandler("update", delta => {
                odom.update(delta);
            });
        });
    }

    get setupDone() { return this.#setupDone; }

    start() { this.post("start"); }
    update(delta) { this.post("update", delta); }

    async setup() {
        if (this.setupDone) return false;

        const ionicons1 = document.createElement("script");
        document.body.appendChild(ionicons1);
        ionicons1.type = "module";
        ionicons1.src = "../node_modules/ionicons/dist/ionicons/ionicons.esm.js";
        const ionicons2 = document.createElement("script");
        document.body.appendChild(ionicons2);
        ionicons2.noModule = true;
        ionicons2.src = "../node_modules/ionicons/dist/ionicons/ionicons.js";

        PROPERTYCACHE.clear();

        let data = util.ensure(await (await fetch("theme.json")).json(), "obj");
        this.base = data.base || Array.from(new Array(9).keys()).map(i => new Array(3).fill(255*i/9));
        this.colors = data.colors || {
            r: "#ff0000",
            o: "#ff8800",
            y: "#ffff00",
            g: "#00ff00",
            c: "#00ffff",
            b: "#0088ff",
            p: "#8800ff",
            m: "#ff00ff",
        };
        this.accent = data.accent || "b";

        await this.postResult("setup");

        this.#setupDone = true;

        return true;
    }


    get base() { return [...this.#base]; }
    set base(v) {
        v = util.ensure(v, "arr").map(v => new util.Color(v));
        while (v.length < 9) v.push(new util.Color((v.length > 0) ? v.at(-1) : null));
        while (v.length > 9) v.pop();
        this.#base = v;
        this.updateDynamicStyle();
    }
    getBase(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= 9) return null;
        return this.#base[i];
    }
    get colorNames() { return Object.keys(this.#colors); }
    get colorValues() { return Object.keys(this.#colors); }
    get colors() {
        let colors = {};
        this.colorNames.forEach(name => (colors[name] = this.getColor(name)));
        return colors;
    }
    set colors(v) {
        v = util.ensure(v, "obj");
        this.clearColors();
        for (let name in v) this.setColor(name, v[name]);
    }
    clearColors() {
        let colors = this.colors;
        for (let name in colors) this.delColor(name);
        return colors;
    }
    hasColor(name) {
        return String(name) in this.#colors;
    }
    getColor(name) {
        if (!this.hasColor(name)) return null;
        return this.#colors[String(name)];
    }
    setColor(name, color) {
        name = String(name);
        color = new util.Color(color);
        if (this.hasColor(name))
            if (color.diff(this.getColor(name)) < 2)
                return this.getColor(name);
        color.addHandler("change", () => this.updateDynamicStyle());
        this.#colors[name] = color;
        this.updateDynamicStyle();
        return color;
    }
    delColor(name) {
        name = String(name);
        if (!this.hasColor(name)) return null;
        let color = this.getColor(name);
        delete this.#colors[name];
        this.updateDynamicStyle();
        return color;
    }
    get accent() { return this.#accent; }
    set accent(v) {
        v = this.hasColor(v) ? String(v) : null;
        if (this.accent == v) return;
        this.#accent = v;
        this.updateDynamicStyle();
    }
    async updateDynamicStyle() {
        let accent = this.accent;
        let style = {};
        let v0 = this.getBase(0), v8 = this.getBase(8);
        if (!(v0 instanceof util.Color)) v0 = new util.Color(0, 0, 0);
        if (!(v8 instanceof util.Color)) v8 = new util.Color(255, 255, 255);
        let v0Avg = (v0.r+v0.g+v0.b)/3, v8Avg = (v8.r+v8.g+v8.b)/3;
        let dark = v8Avg > v0Avg;
        for (let i = 0; i <= 9; i++) {
            let normal = (i < 9);
            for (let j = 0; j < 16; j++) {
                let alpha = j/15;
                let hex = "0123456789abcdef"[j];
                let vi = this.getBase(i);
                if (!(vi instanceof util.Color)) vi = new util.Color(...new Array(3).fill(255*(i/8)));
                if (normal) style["v"+i+"-"+hex] = "rgba("+[...vi.rgb, alpha].join(",")+")";
                else style["v-"+hex] = "var(--v4-"+hex+")";
            }
            if (normal) style["v"+i] = "var(--v"+i+"-f)";
            else style["v"] = "var(--v-f)";
        }
        let black = this.getBase(dark ? 1 : 8), white = this.getBase(dark ? 8 : 1);
        if (!(black instanceof util.Color)) black = new util.Color(0, 0, 0);
        if (!(white instanceof util.Color)) white = new util.Color(255, 255, 255);
        let colors = {};
        this.colorNames.forEach(name => (colors[name] = this.getColor(name)));
        colors._ = new util.Color(this.hasColor(accent) ? this.getColor(accent) : this.getBase(4));
        for (let name in colors) {
            let color = colors[name];
            let header = (name == "_") ? "a" : "c"+name;
            for (let i = 0; i <= 9; i++) {
                let normal = (i < 9);
                let newColor = normal ? util.lerp(color, (i<4) ? black : (i>4) ? white : color, Math.abs(i-4)/4) : null;
                for (let j = 0; j < 16; j++) {
                    let alpha = j/15;
                    let hex = "0123456789abcdef"[j];
                    if (normal) style[header+i+"-"+hex] = "rgba("+[...newColor.rgb, alpha].join(",")+")";
                    else style[header+"-"+hex] = "var(--"+header+"4-"+hex+")";
                }
                if (normal) style[header+i] = "var(--"+header+i+"-f)";
                else style[header] = "var(--"+header+"-f)";
            }
        }
        let animKeyframes = {};
        for (let i = 0; i <= 100; i++) {
            let p = i/100;
            let x1 = (p < 0) ? 0 : (p > 0.66) ? 1 : util.ease.quadIO((p-0)/(0.66-0));
            let x2 = (p < 0.33) ? 0 : (p > 1) ? 1 : util.ease.quadIO((p-0.33)/(1-0.33));
            animKeyframes[i] = {
                left: (100*x2)+"%",
                width: (100*(x1-x2))+"%",
            };
        }
        let styleStr = "";
        styleStr += ":root{";
        for (let k in style) styleStr += "--"+k+":"+style[k]+";";
        styleStr += "}";
        styleStr += "@keyframes loading-line{";
        for (let p in animKeyframes) {
            styleStr += p + "%{";
            for (let k in animKeyframes[p]) styleStr += k+":"+animKeyframes[p][k]+";";
            styleStr += "}";
        }
        styleStr += "}";
        document.getElementById("dynamic-style").innerHTML = styleStr;
        PROPERTYCACHE.clear();
        this.post("update-dynamic-style");
    }
}


export class Odometry extends util.Target {
    #elem;
    #canvas;
    #overlay;
    #quality;
    #mouse;

    #doRender;

    #size;

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
        this.#mouse = new V();

        this.#doRender = true;

        this.#size = new V();

        this.canvas.addEventListener("mousemove", e => this.mouse.set(e.pageX, e.pageY));

        this.quality = 2;

        this.size = 1000;

        this.addHandler("update", delta => {
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

    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }

    update(delta) { this.post("update", delta); }
}
export class Odometry2d extends Odometry {
    #ctx;
    #worldMouse;

    #render;

    #image;
    #imageShow;

    #padding;
    #axisInteriorX;
    #axisInteriorY;

    #unit;

    static BEFOREGRID = 0;
    static AFTERGRID = 1;
    static BEFOREIMAGE = 1;
    static AFTERIMAGE = 2;
    static BEFOREBORDER = 2;
    static AFTERBORDER = 3;

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
        this.#worldMouse = new V();
        this.mouse.addHandler("change", () => this.worldMouse.set(this.pageToWorld(this.mouse)));

        this.#render = new Odometry2d.Render(this, 0);

        this.#image = new Image();
        this.#imageShow = null;

        this.#padding = new util.V4();
        this.#axisInteriorX = false;
        this.#axisInteriorY = false;

        this.#unit = null;

        this.padding = 40;

        this.unit = "m";

        const timer = new util.Timer(true);
        this.addHandler("render", delta => {
            if (timer.dequeueAll(250)) update();

            const ctx = this.ctx, quality = this.quality, padding = this.padding, scale = this.scale;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            const cx = (ctx.canvas.width - quality*(padding.l+padding.r))/2 + quality*padding.l;
            const cy = (ctx.canvas.height - quality*(padding.t+padding.b))/2 + quality*padding.t;
            const mnx = cx - this.w*scale*quality/2, mxx = cx + this.w*scale*quality/2;
            const mny = cy - this.h*scale*quality/2, mxy = cy + this.h*scale*quality/2;
            
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(0);

            let w = Math.floor(lib.Unit.convert(this.w, "cm", this.unit));
            let h = Math.floor(lib.Unit.convert(this.h, "cm", this.unit));
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
                let x = util.lerp(mnx, mxx, lib.Unit.convert(i, this.unit, "cm") / this.w);
                ctx.strokeStyle = PROPERTYCACHE.get("--v2");
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, y1);
                ctx.stroke();
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
                let y = util.lerp(mxy, mny, lib.Unit.convert(i, this.unit, "cm") / this.h);
                ctx.strokeStyle = PROPERTYCACHE.get("--v2");
                ctx.beginPath();
                ctx.moveTo(x0, y);
                ctx.lineTo(x1, y);
                ctx.stroke();
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
                    ctx.globalAlpha = 0.25;
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
        let [x, y] = new V(...p).xy;
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
        let [x, y] = new V(...p).xy;
        x = (x - this.canvas.width/2) / (scale*this.quality) + this.w/2;
        y = this.h/2 - (y - this.canvas.height/2) / (scale*this.quality);
        return new V(x, y);
    }
    canvasLenToWorld(l) {
        l = util.ensure(l, "num");
        return l/(this.scale*this.quality);
    }
    canvasToPage(...p) {
        let [x, y] = new V(...p).xy;
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
        let [x, y] = new V(...p).xy;
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
        this.#rPos = new V(this.hasParent() ? this.parent.rPos : 0).add(this.pos);
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

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            const hovered = this.hovered;
            if (this.hasType() && this.hasBuiltinType()) {
                const builtinType = this.builtinType;
                if (["default", "node", "box", "arrow", "arrow-h", "arrow-t"].includes(builtinType)) {
                    if (!["node", "arrow", "arrow-h", "arrow-t"].includes(builtinType)) {
                        ctx.strokeStyle = PROPERTYCACHE.get("--"+this.color+"-8");
                        ctx.lineWidth = 7.5*quality;
                        ctx.lineJoin = "round";
                        ctx.beginPath();
                        let pth = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]]
                            .map(v => this.size.sub(this.odometry.pageLenToWorld(7.5)).div(2).mul(v))
                            .map(v => v.rotateOrigin(this.heading));
                        for (let i = 0; i < pth.length; i++) {
                            let p = this.odometry.worldToCanvas(this.rPos.add(pth[i]));
                            if (i > 0) ctx.lineTo(...p.xy);
                            else ctx.moveTo(...p.xy);
                        }
                        ctx.closePath();
                        ctx.stroke();
                        ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                        ctx.lineWidth = 1*quality;
                        ctx.lineJoin = "round";
                        ctx.beginPath();
                        pth = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]].map(v => this.size.div(2).mul(v)).map(v => v.rotateOrigin(this.heading));
                        for (let i = 0; i < pth.length; i++) {
                            let p = this.odometry.worldToCanvas(this.rPos.add(pth[i]));
                            if (i > 0) ctx.lineTo(...p.xy);
                            else ctx.moveTo(...p.xy);
                        }
                        ctx.closePath();
                        ctx.stroke();
                    }
                    if (["arrow", "arrow-h", "arrow-t"].includes(builtinType)) {
                        ctx.strokeStyle = PROPERTYCACHE.get("--"+((hovered == "heading") ? this.colorH : this.color));
                        ctx.lineWidth = 5*quality;
                        ctx.lineJoin = "round";
                        ctx.lineCap = "round";
                        let dir = this.heading;
                        let tail =
                            (builtinType == "arrow-h") ?
                                this.rPos.add(V.dir(dir, -this.w)) :
                            (builtinType == "arrow-t") ?
                                this.rPos :
                            this.rPos.add(V.dir(dir, -this.w/2));
                        let head =
                            (builtinType == "arrow-h") ?
                                this.rPos :
                            (builtinType == "arrow-t") ?
                                this.rPos.add(V.dir(dir, +this.w)) :
                            this.rPos.add(V.dir(dir, +this.w/2));
                        ctx.beginPath();
                        ctx.moveTo(...this.odometry.worldToCanvas(tail).xy);
                        ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                        ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir-135, this.odometry.pageLenToWorld(15)))).xy);
                        ctx.moveTo(...this.odometry.worldToCanvas(head).xy);
                        ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir+135, this.odometry.pageLenToWorld(15)))).xy);
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = PROPERTYCACHE.get("--"+((hovered == "heading") ? "v8" : "v8-8"));
                        ctx.lineWidth = 1*quality;
                        ctx.lineJoin = "round";
                        ctx.beginPath();
                        ctx.arc(...this.odometry.worldToCanvas(this.rPos.add(V.dir(this.heading, this.w/2))).xy, 5*quality, 0, 2*Math.PI);
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
                                .map(v => new V(10.5).mul(v))
                                .map(v => v.rotateOrigin(this.heading));
                            for (let i = 0; i < pth.length; i++) {
                                let p = this.odometry.worldToCanvas(this.rPos.add(pth[i]));
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
                                .map(v => new V(12).mul(v))
                                .map(v => v.rotateOrigin(this.heading));
                            for (let i = 0; i <= pth.length; i++) {
                                let p = this.odometry.worldToCanvas(this.rPos.add(pth[i]));
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
                ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir-135, this.odometry.pageLenToWorld(5)))).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir+135, this.odometry.pageLenToWorld(5)))).xy);
                ctx.stroke();
            }
        });
    }

    get hovered() {
        if (!this.canHover) return null;
        let m = this.odometry.worldMouse;
        if (this.hasType() && this.hasBuiltinType()) {
            if (this.showVelocity && this.rPos.add(this.velocity).distSquared(m) < this.odometry.pageLenToWorld(5)**2) return "velocity";
            if (this.rPos.add(V.dir(this.heading, this.w/2)).distSquared(m) < this.odometry.pageLenToWorld(5)**2) return "heading";
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
            ctx.lineTo(...this.odometry.worldToCanvas(this.rPos.add(V.dir(this.dir, this.radius))).xy);
            ctx.stroke();
            ctx.fillStyle = PROPERTYCACHE.get("--"+((this.hovered == "radius") ? "a" : "v8"));
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(this.rPos.add(V.dir(this.dir, this.radius))).xy, 5*quality, 0, 2*Math.PI);
            ctx.fill();
        });
    }

    get hovered() {
        if (!this.canHover) return null;
        let m = this.odometry.worldMouse;
        if (this.rPos.add(V.dir(this.dir, this.radius)).distSquared(m) < this.odometry.pageLenToWorld(5)**2) return "radius";
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

    #template;

    #field;
    #theField;

    #renderType;
    #controlType;
    #isCinematic;
    #origin;
    
    static #traverseObject(obj, type) {
        const material = obj.material;
        obj.material = material.clone();
        material.dispose();
        if (type == "basic") {
            if (!(obj.material instanceof THREE.MeshStandardMaterial)) return;
            obj.material.metalness = 0;
            obj.material.roughness = 1;
            return;
        }
        if (type == "cinematic") {
            if (!(obj.material instanceof THREE.MeshStandardMaterial)) return;
            const material = new THREE.MeshLambertMaterial({
                color: obj.material.color,
                transparent: obj.material.transparent,
                opacity: obj.material.opacity,
            });
            if (obj.name.toLowerCase().includes("carpet")) {
                obj.castShadow = false;
                obj.receiveShadow = true;
            } else {
                obj.castShadow = !obj.material.transparent;
                obj.receiveShadow = !obj.material.transparent;
            }
            obj.material.dispose();
            obj.material = material;
            return;
        }
    }
    static async loadField(name, type) {
        name = String(name);
        type = String(type);
        const templates = util.ensure(await (await fetch("templates.json")).json(), "obj");
        if (!(name in templates)) return null;
        if (this.loadedFields[name]) {
            if (this.loadedFields[name][type])
                return this.loadedFields[name][type];
            return null;
        }
        let t0 = util.ensure(this.loadingFields[name], "num");
        let t1 = util.getTime();
        if (t1-t0 < 1000) return null;
        this.loadingFields[name] = t1;
        return await new Promise((res, rej) => {
            LOADER.load(name+".glb", gltf => {
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
                if (!this.loadedFields[name][type]) return null;
                res(this.loadedFields[name][type]);
            }, null, err => res(null));
        });
    }
    static async loadRobot(name, type) {
        name = String(name);
        type = String(type);
        const robots = GLOBALSTATE.getProperty("robots").value;
        const robotModels = GLOBALSTATE.getProperty("robot-models").value;
        if (!(name in robots)) return null;
        if (!(name in robotModels)) return null;
        if (this.loadedRobots[name]) {
            if (this.loadedRobots[name][type])
                return this.loadedRobots[name][type];
            return null;
        }
        let t0 = util.ensure(this.loadingRobots[name], "num");
        let t1 = util.getTime();
        if (t1-t0 < 1000) return null;
        this.loadingRobots[name] = t1;
        return await new Promise((res, rej) => {
            LOADER.load(robotModels[name], gltf => {
                this.loadedRobots[name] = {};
                const scene = gltf.scene;
                ["basic", "cinematic"].forEach(type => {
                    let obj, pobj, bbox;
                    obj = scene.clone();
                    obj.traverse(obj => {
                        if (!obj.isMesh) return;
                        this.#traverseObject(obj, type);
                        const color = new util.Color(obj.material.color.r*255, obj.material.color.g*255, obj.material.color.b*255);
                        const h = color.h, s = color.s, thresh = 60;
                        const score = Math.min(1, Math.max(0, (1-Math.min(Math.abs(h-210)/thresh, Math.abs(h-0)/thresh, Math.abs(h-360)/thresh))));
                        if (score*s < 0.5) return;
                        obj.material._allianceMaterial = true;
                    });
                    obj.quaternion.copy(THREE.Quaternion.fromRotationSequence(util.ensure(robots[name], "obj").rotations));
                    [obj, pobj] = [new THREE.Object3D(), obj];
                    obj.add(pobj);
                    bbox = new THREE.Box3().setFromObject(obj);
                    obj.position.set(
                        obj.position.x - (bbox.max.x+bbox.min.x)/2,
                        obj.position.y - (bbox.max.y+bbox.min.y)/2,
                        obj.position.z - bbox.min.z,
                    );
                    [obj, pobj] = [new THREE.Object3D(), obj];
                    obj.add(pobj);
                    this.loadedRobots[name][type] = obj;
                });
                scene.traverse(obj => {
                    if (!obj.isMesh) return;
                    obj.material.dispose();
                });
                if (!this.loadedRobots[name][type]) return null;
                res(this.loadedRobots[name][type]);
            }, null, err => res(null));
        });
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
            this.#raycastIntersections = this.raycaster.intersectObject(this.scene, true);
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

        const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);

        // TODO: fix mem leak w these scenes vvv

        this.#axisScene = new THREE.Group();
        this.axisScene._builtin = "axis-scene";
        axes = this.axisScene.axes = new THREE.Group();
        this.axisScene.add(axes);
        xAxis = this.axisScene.xAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        xAxis.castShadow = true;
        xAxis.receiveShadow = false;
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        yAxis = this.axisScene.yAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        yAxis.castShadow = true;
        yAxis.receiveShadow = false;
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        zAxis = this.axisScene.zAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        zAxis.castShadow = true;
        zAxis.receiveShadow = false;
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        this.axisScene.planes = [];

        this.#axisSceneSized = new THREE.Group();
        this.axisSceneSized._builtin = "axis-scene-sized";
        axes = this.axisSceneSized.axes = new THREE.Group();
        this.axisSceneSized.add(axes);
        xAxis = this.axisSceneSized.xAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        xAxis.castShadow = true;
        xAxis.receiveShadow = false;
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        yAxis = this.axisSceneSized.yAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        yAxis.castShadow = true;
        yAxis.receiveShadow = false;
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        zAxis = this.axisSceneSized.zAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        zAxis.castShadow = true;
        zAxis.receiveShadow = false;
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        this.axisSceneSized.planes = [];

        this.#template = null;

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
                [[+5, 10, 0], [+5, 0, 0], 0xff0000],
                [[-5, 10, 0], [-5, 0, 0], 0x0000ff],
            ];
            for (const [[x0, y0, z0], [x1, y1, z1], color] of data) {
                const light = new THREE.SpotLight(color, 150, 0, 60*(Math.PI/180), 0.25, 2);
                lights[1].push(light);
                light.position.set(x0, y0, z0);
                light.target.position.set(x1, y1, z1);
                light.castShadow = true;
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
        this.canvas.addEventListener("keydown", e => {
            e.stopPropagation();
            keys.add(e.code);
        });
        this.canvas.addEventListener("keyup", e => {
            e.stopPropagation();
            keys.delete(e.code);
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
            this.axisScene.xAxis.material.color.set(colorR.toHex(false));
            this.axisScene.yAxis.material.color.set(colorG.toHex(false));
            this.axisScene.zAxis.material.color.set(colorB.toHex(false));
            this.axisSceneSized.xAxis.material.color.set(colorR.toHex(false));
            this.axisSceneSized.yAxis.material.color.set(colorG.toHex(false));
            this.axisSceneSized.zAxis.material.color.set(colorB.toHex(false));
            this.axisSceneSized.axes.position.set(...this.size.div(-200).xy, 0);
            let planes, i;
            planes = this.axisScene.planes;
            let size = 10;
            i = 0;
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    if ((x+y) % 2 == 0) continue;
                    if (i >= planes.length) {
                        let plane = new THREE.Mesh(
                            singlePlaneGeometry,
                            planeMaterial,
                        );
                        plane.castShadow = false;
                        plane.receiveShadow = true;
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
            planes = this.axisSceneSized.planes;
            let w = this.axisSceneSized.w;
            let h = this.axisSceneSized.h;
            if (w != this.w/100 || h != this.h/100) {
                w = this.axisSceneSized.w = this.w/100;
                h = this.axisSceneSized.h = this.h/100;
                while (planes.length > 0) {
                    let plane = planes.pop();
                    this.axisSceneSized.remove(plane);
                    plane.geometry.dispose();
                };
                this.requestRedraw();
            }
            i = 0;
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    if ((x+y) % 2 > 0) continue;
                    if (i >= planes.length) {
                        let plane = new THREE.Mesh(
                            new THREE.PlaneGeometry(0, 0),
                            planeMaterial,
                        );
                        plane.castShadow = false;
                        plane.receiveShadow = true;
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
                    velocity.iadd(new util.V3(x, y, z).mul(keys.has("ShiftRight") ? 0.1 : 1).mul(delta/1000));
                    velocity.imul(0.9);
                    velocity.imap(v => (Math.abs(v) < util.EPSILON ? 0 : v));
                    this.controls.moveRight(velocity.x);
                    this.controls.moveForward(velocity.y);
                    this.camera.position.y += velocity.z;
                } else {
                    velocity.imul(0);
                }
            }
            this.camera.position.x = Math.round(this.camera.position.x*1000)/1000;
            this.camera.position.y = Math.round(this.camera.position.y*1000)/1000;
            this.camera.position.z = Math.round(this.camera.position.z*1000)/1000;
            let cam2 = [
                this.camera.position.x, this.camera.position.y, this.camera.position.z,
                this.camera.quaternion.w, this.camera.quaternion.x, this.camera.quaternion.y, this.camera.quaternion.z,
            ];
            for (let i = 0; i < 7; i++) {
                if (cam[i] == cam2[i]) continue;
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

    get template() { return this.#template; }
    set template(v) {
        v = (v == null) ? null : String(v);
        if (this.template == v) return;
        this.change("template", this.template, this.#template=v);
    }
    hasTemplate() { return this.template != null; }

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
        let renderfs;
        renderfs = {
            proj: () => new THREE.PerspectiveCamera(75, 1, 0.1, 1000),
            iso: () => new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000),
        };
        this.#camera = (this.renderType in renderfs) ? renderfs[this.renderType]() : null;
        renderfs = {
            proj: [0, 7.5, -7.5],
            iso: [10, 10, -10],
        };
        this.camera.position.set(...((this.renderType in renderfs) ? renderfs[this.renderType] : [0, 0, 0]));
        this.camera.lookAt(0, 0, 0);
        this.change("renderType", v, this.renderType);
        this.updateControls();
        this.requestRedraw();
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
    
    #pos;
    #q;

    #name;
    #color;
    #isGhost;
    #isSolid;
    #display;

    #type;
    #builtinType;

    #object;
    #theObject;
    #showObject;

    static LOADEDOBJECTS = {};
    static {
        const node = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        node.castShadow = node.receiveShadow = true;
        this.LOADEDOBJECTS["node"] = node;
        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        cube.castShadow = cube.receiveShadow = true;
        this.LOADEDOBJECTS["cube"] = cube;
        const radius = 0.05, arrowLength = 0.25, arrowRadius = 0.1;
        const arrow = new THREE.Object3D();
        const tip = new THREE.Mesh(
            new THREE.ConeGeometry(arrowRadius, arrowLength, 8),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        arrow.castShadow = arrow.receiveShadow = true;
        tip.position.set(0, (1-arrowLength)/2, 0);
        arrow.add(tip);
        const line = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, 1-arrowLength, 8),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
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
        axes.castShadow = axes.receiveShadow = true;
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
            new THREE.MeshLambertMaterial({ color: 0x0000ff }),
        );
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        axes.zAxis = zAxis;
        this.LOADEDOBJECTS["axes"] = axes;
        {
            // 2023
            const cone = new THREE.Object3D();
            cone.castShadow = cone.receiveShadow = true;
            const r = 0.105, h = 0.33;
            const coneInner = new THREE.Mesh(
                new THREE.ConeGeometry(r, h, 12),
                new THREE.MeshLambertMaterial({ color: 0xffffff }),
            );
            coneInner.position.set(0, 0, h/2);
            coneInner.rotateX(Math.PI/2);
            cone.add(coneInner);
            this.LOADEDOBJECTS["2023-cone"] = cone;
            const cube = new THREE.Object3D();
            cube.castShadow = cube.receiveShadow = true;
            const s = 0.24;
            const cubeInner = new THREE.Mesh(
                new THREE.BoxGeometry(s, s, s),
                new THREE.MeshLambertMaterial({ color: 0xffffff }),
            );
            cubeInner.position.set(0, 0, s/2);
            cube.add(cubeInner);
            this.LOADEDOBJECTS["2023-cube"] = cube;
        }
        {
            // 2024
            const note = new THREE.Object3D();
            note.castShadow = note.receiveShadow = false;
            const r1 = 0.18, r2 = 0.125;
            const noteInner = new THREE.Mesh(
                new THREE.TorusGeometry(r1-(r1-r2)/2, (r1-r2)/2, 8, 12),
                new THREE.MeshLambertMaterial({ color: 0xffffff }),
            );
            noteInner.position.set(0, 0, (r1-r2)/2);
            note.add(noteInner);
            this.LOADEDOBJECTS["2024-note"] = note;
        }
    }
    
    constructor(odometry, pos, name, type) {
        super();

        if (!(odometry instanceof Odometry3d)) throw new Error("Odometry is not of class Odometry3d");
        this.#odometry = odometry;

        this.#pos = new util.V3();
        this.pos.addHandler("change", (c, f, t) => this.change("pos."+c, f, t));
        this.#q = new util.V4();
        this.q.addHandler("change", (c, f, t) => this.change("q."+c, f, t));
        this.addHandler("change", (c, f, t) => this.odometry.requestRedraw());

        this.#name = "";
        this.#color = "";
        this.#isGhost = false;
        this.#isSolid = false;
        this.#display = {};

        this.#type = null;
        this.#builtinType = null;

        this.#object = null;
        this.#theObject = null;
        this.#showObject = true;

        let robotLock = false;
        let modelObject = null, theModelObject = null;

        this.addHandler("rem", () => {
            this.object = null;
            this.odometry.remHint(hint);
        });

        this.addHandler("update", delta => {
            let color =
                (this.hasColor() && this.color.startsWith("--")) ?
                    PROPERTYCACHE.getColor(this.color) :
                new util.Color(this.color);
            if (this.hasType()) {
                if (this.hasBuiltinType()) theModelObject = this.constructor.LOADEDOBJECTS[this.builtinType];
                else if (!robotLock)
                    (async () => {
                        robotLock = true;
                        theModelObject = await Odometry3d.loadRobot(
                            this.type,
                            this.odometry.isCinematic ? "cinematic" : "basic",
                        );
                        robotLock = false;
                    })();
            } else theModelObject = null;
            if (modelObject != theModelObject) {
                modelObject = theModelObject;
                this.object = modelObject;
                if (this.hasObject()) {
                    let elem = document.createElement("div");
                    this.theObject.add(new CSS2DObject(elem));
                    this.theObject.traverse(obj => {
                        if (!obj.isMesh) return;
                        obj.material.transparent = true;
                        if (!("_opacity" in obj.material))
                            obj.material._opacity = obj.material.opacity;
                        if (!("_color" in obj.material))
                            obj.material._color = obj.material.color.clone();
                    });
                    this.theObject.isGhost = this.theObject.isSolid = null;
                }
                this.odometry.requestRedraw();
            }
            if (!this.hasObject()) return;
            if (this.theObject.isGhost != this.isGhost) {
                this.theObject.isGhost = this.isGhost;
                this.theObject.traverse(obj => {
                    if (!obj.isMesh) return;
                    if (this.isGhost) {
                        obj.material.opacity = obj.material._opacity * 0.25;
                    } else {
                        obj.material.opacity = obj.material._opacity;
                    }
                });
                this.odometry.requestRedraw();
            }
            if (this.theObject.isSolid != this.isSolid) {
                this.theObject.isSolid = this.isSolid;
                this.theObject.traverse(obj => {
                    if (!obj.isMesh) return;
                    if (this.isSolid) {
                        obj.material.color.set(color.toHex(false));
                    } else {
                        obj.material.color.set(obj.material._color);
                    }
                });
                this.odometry.requestRedraw();
            }
            this.theObject.position.set(
                this.x - this.odometry.size.x/200,
                this.y - this.odometry.size.y/200,
                this.z,
            );
            this.theObject.quaternion.set(this.qx, this.qy, this.qz, this.qw);
            let hovered = false;
            let cssObj = null;
            this.theObject.traverse(obj => {
                if (!cssObj)
                    if (obj instanceof CSS2DObject)
                        cssObj = obj;
                if (!hovered)
                    if (this.odometry.raycastIntersections[0])
                        if (obj == this.odometry.raycastIntersections[0].object)
                            hovered = true;
                if (!obj.isMesh) return;
                if (!obj.material._allianceMaterial) {
                    if (!this.hasType()) return;
                    if (!this.hasBuiltinType()) return;
                    if (this.builtinType == "axis") return;
                }
                obj.material.color.set(color.toHex(false));
            });
            let type = this.display.type;
            let data = util.ensure(this.display.data, "arr");
            if (hovered) {
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
                hName.name = this.name;
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

        this.pos = pos;

        this.name = name;

        this.type = type;
    }

    get odometry() { return this.#odometry; }

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
        if (this.type == v) return;
        this.#builtinType = (v == null || !v.startsWith("§")) ? null : v.slice(1);
        this.change("type", this.type, this.#type=v);
    }
    get builtinType() { return this.#builtinType; }
    hasType() { return this.type != null; }
    hasBuiltinType() { return this.builtinType != null; }

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
                obj.geometry.dispose();
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
                const allianceMaterial = !!obj.material._allianceMaterial;
                obj.material = obj.material.clone();
                obj.material._allianceMaterial = allianceMaterial;
            });
            if (this.showObject) this.theObject.scale.set(1, 1, 1);
            else this.theObject.scale.set(0, 0, 0);
            this.odometry.wpilibGroup.add(this.theObject);
        }
        this.odometry.requestRedraw();
    }
    hasObject() { return !!this.object; }
    get showObject() { return this.#showObject; }
    set showObject(v) {
        v = !!v;
        if (this.showObject == v) return;
        this.change("showObject", this.showObject, this.#showObject=v);
        if (!this.hasObject()) return;
        if (this.showObject) this.theObject.scale.set(1, 1, 1);
        else this.theObject.scale.set(0, 0, 0);
    }

    update(delta) { this.post("update", delta); }
};
