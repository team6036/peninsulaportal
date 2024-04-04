import * as util from "./util.mjs";
import { V } from "./util.mjs";
import * as lib from "./lib.mjs";


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
            const odom = new Odometry2d();
            document.body.appendChild(odom.elem);
            odom.size = [1654, 821];
            odom.imageSrc = "2024.png";
            const robots = {};
            window.api.onData((_, data) => {
                data.forEach(([id, k, v]) => {
                    if (!(id in robots)) robots[id] = odom.render.addRender(new Odometry2d.Robot(odom.render));
                    if (k == "rem") {
                        odom.render.remRender(robots[id]);
                        return delete robots[id];
                    }
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

    static getTypeName(type) {
        let names = {
            "§default": "Default",
            "§node": "Node",
            "§box": "Box",
            "§arrow": "Arrow (Centered)",
            "§arrow-h": "Arrow (Head Centered)",
            "§arrow-t": "Arrow (Tail Centered)",
            "§2023-cone": "2023 Cone",
            "§2023-cube": "2023 Cube",
            "§2024-note": "2024 Note",
        };
        if (type in names) return names[type];
        return String(type);
    }
    static menuStructure = [
        "§default",
        "§node",
        "§box",
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
    static buildMenu(menu, current, signal) {
        if (!(menu instanceof App.Menu)) return null;
        if (!(signal instanceof util.Target)) signal = new util.Target();
        const dfs = (menu, structs) => {
            util.ensure(structs, "arr").forEach(struct => {
                if (struct == null) return menu.addItem(new App.Menu.Divider());
                if (util.is(struct, "obj")) {
                    let itm = menu.addItem(new App.Menu.Item(struct.name, (struct.key == current) ? "checkmark" : ""));
                    itm.addHandler("trigger", e => {
                        if (!struct.key) return;
                        signal.post("type", struct.key);
                    });
                    dfs(itm.menu, struct.sub);
                    return;
                }
                let itm = menu.addItem(new App.Menu.Item(this.getTypeName(struct), (struct == current) ? "checkmark" : ""));
                itm.addHandler("trigger", e => {
                    signal.post("type", struct);
                });
            });
        };
        dfs(menu, this.menuStructure);
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
                        let path = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]]
                            .map(v => this.size.sub(this.odometry.pageLenToWorld(7.5)).div(2).mul(v))
                            .map(v => v.rotateOrigin(this.heading));
                        for (let i = 0; i <= path.length; i++) {
                            let j = i%path.length;
                            let p = this.odometry.worldToCanvas(this.rPos.add(path[j]));
                            if (i > 0) ctx.lineTo(...p.xy);
                            else ctx.moveTo(...p.xy);
                        }
                        ctx.closePath();
                        ctx.stroke();
                        ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                        ctx.lineWidth = 1*quality;
                        ctx.lineJoin = "round";
                        ctx.beginPath();
                        path = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]].map(v => this.size.div(2).mul(v)).map(v => v.rotateOrigin(this.heading));
                        for (let i = 0; i <= path.length; i++) {
                            let j = i%path.length;
                            let p = this.odometry.worldToCanvas(this.rPos.add(path[j]));
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
                            let path = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]]
                                .map(v => new V(10.5).mul(v))
                                .map(v => v.rotateOrigin(this.heading));
                            for (let i = 0; i <= path.length; i++) {
                                let j = i%path.length;
                                let p = this.odometry.worldToCanvas(this.rPos.add(path[j]));
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
                            let path = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]]
                                .map(v => new V(12).mul(v))
                                .map(v => v.rotateOrigin(this.heading));
                            for (let i = 0; i <= path.length; i++) {
                                let j = i%path.length;
                                let p = this.odometry.worldToCanvas(this.rPos.add(path[j]));
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
