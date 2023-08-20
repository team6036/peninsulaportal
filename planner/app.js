import * as util from "../util.js";
import { V } from "../util.js";

import * as core from "../core.js";

import * as subcore from "./core.js";


class ProjectButton extends core.Target {
    #app;

    #project;

    #time;

    #elem;
    #eImage;
    #eInfo;
    #eName;
    #eTime;
    #eNav;
    #eEdit;

    constructor(project) {
        super();

        this.#app = null;

        this.#project = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eImage = document.createElement("div");
        this.elem.appendChild(this.eImage);
        this.eImage.classList.add("image");
        this.#eInfo = document.createElement("div");
        this.elem.appendChild(this.eInfo);
        this.eInfo.classList.add("info");
        this.#eName = document.createElement("div");
        this.eInfo.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eTime = document.createElement("div");
        this.eInfo.appendChild(this.eTime);
        this.eTime.classList.add("time");
        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");
        this.#eEdit = document.createElement("button");
        this.eNav.appendChild(this.eEdit);
        this.eEdit.innerHTML = "Edit <ion-icon name='arrow-forward'></ion-icon>";

        this.eEdit.addEventListener("click", e => this.post("edit"));

        this.project = project;

        this.addHandler("update", data => {
            if (!this.hasProject()) return;
            this.name = this.project.meta.name;
            this.time = this.project.meta.modified;
            this.eImage.style.backgroundImage = "url('"+this.project.meta.thumb+"')";
        });
    }

    get app() { return this.#app; }
    set app(v) {
        v = (v instanceof App) ? v : null;
        if (this.app == v) return;
        this.#app = v;
    }
    hasApp() { return this.app instanceof App; }

    get project() { return this.#project; }
    set project(v) {
        v = (v instanceof subcore.Project) ? v : null;
        if (this.project == v) return;
        this.#project = v;
        this.post("set", { v: v });
    }
    hasProject() { return this.project instanceof subcore.Project; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }

    get time() { return this.#time; }
    set time(v) {
        v = util.ensure(v, "num");
        if (this.time == v) return;
        this.#time = v;
        let date = new Date(this.time);
        this.eTime.textContent = "Modified "+[date.getMonth()+1, date.getDate(), date.getFullYear()].join("-");
    }

    get elem() { return this.#elem; }
    get eImage() { return this.#eImage; }
    get eInfo() { return this.#eInfo; }
    get eName() { return this.#eName; }
    get eTime() { return this.#eTime; }
    get eNav() { return this.#eNav; }
    get eEdit() { return this.#eEdit; }

    update() {
        this.post("update", null);
    }
}

class PathButton extends core.Target {
    #app;

    #path;

    #elem;
    #eName;

    constructor(path) {
        super();

        this.#app = null;

        this.#path = null;

        this.#elem = document.createElement("button");
        this.elem.classList.add("item");
        this.#eName = document.createElement("input");
        this.elem.appendChild(this.eName);
        this.eName.classList.add("override")
        this.eName.type = "text";
        this.eName.placeholder = "Path Name";
        this.eName.autocomplete = "off";
        this.eName.spellcheck = "false";

        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", null);
        });

        this.eName.addEventListener("change", e => {
            if (!this.hasPath()) return;
            this.path.name = this.eName.value;
            this.post("change", null);
        });

        this.addHandler("set", data => {
            this.eName.value = this.hasPath() ? this.path.name : "";
        });

        let show = false;
        this.addHandler("add", data => {
            show = true;
            this.post("udpate", null);
        });
        this.addHandler("rem", data => {
            show = false;
            this.post("udpate", null);
        });
        let prevPath = "";
        let pthItems = [];
        this.addHandler("udpate", data => {
            if (!this.hasApp()) return;
            if (!this.app.hasProject()) return;
            let nodes = (show && this.hasPath()) ? this.path.nodes : [];
            let path = nodes.join("");
            if (prevPath == path) return;
            pthItems.forEach(itm => this.app.remRenderItem(itm));
            pthItems = [];
            prevPath = path;
            for (let i = 0; i < nodes.length; i++) {
                let id = nodes[i];
                let node = this.app.project.getItem(id);
                pthItems.push(this.app.addRenderItem(new RIPathIndex(node)));
                pthItems.at(-1).value = i+1;
                if (i > 0) {
                    let id2 = nodes[i-1];
                    let node2 = this.app.project.getItem(id2);
                    pthItems.push(this.app.addRenderItem(new RIPathLine(node, node2)));
                }
            }
        });

        this.path = path;
    }

    get app() { return this.#app; }
    set app(v) {
        v = (v instanceof App) ? v : null;
        if (this.app == v) return;
        this.#app = v;
    }
    hasApp() { return this.app instanceof App; }

    get path() { return this.#path; }
    set path(v) {
        v = (v instanceof subcore.Project.Path) ? v : null;
        if (this.path == v) return;
        this.#path = v;
        this.post("set", { v: v });
    }
    hasPath() { return this.path instanceof subcore.Project.Path; }

    get selected() { return this.elem.classList.contains("this"); }
    set selected(v) { v ? this.elem.classList.add("this") : this.elem.classList.remove("this"); }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }

    update() {
        this.post("udpate", null);
    }
}

class PathVisual extends core.Target {
    #app;

    #id;

    #show;

    #visual;
    #item;

    #t;
    #tPrev;
    #paused;

    constructor() {
        super();

        this.#app = null;

        this.#id = null;

        this.#show = false;

        this.#visual = new RIPathVisual();
        this.#item = new RIPathVisualItem(this.visual);

        this.#t = 0;
        this.#tPrev = 0;
        this.#paused = true;
    }

    get app() { return this.#app; }
    set app(v) {
        v = (v instanceof App) ? v : null;
        if (this.app == v) return;
        if (this.hasApp())
            if (this.app.remRenderItem) {
                this.app.remRenderItem(this.visual);
                this.app.remRenderItem(this.item);
            }
        this.#app = v;
        if (this.hasApp() && this.show)
            if (this.app.addRenderItem) {
                this.app.addRenderItem(this.visual);
                this.app.addRenderItem(this.item);
            }
    }
    hasApp() { return this.app instanceof App; }

    get id() { return this.#id; }
    set id(v) {
        v = (v == null) ? null : String(v);
        if (this.id == v) return;
        this.#id = v;
    }

    get show() { return this.#show; }
    set show(v) {
        v = !!v;
        if (this.show == v) return;
        this.#show = v;
        if (!this.hasApp()) return;
        if (this.show) {
            if (this.app.addRenderItem) {
                this.app.addRenderItem(this.visual);
                this.app.addRenderItem(this.item);
            }
        } else {
            if (this.app.remRenderItem) {
                this.app.remRenderItem(this.visual);
                this.app.remRenderItem(this.item);
            }
        }
    }

    get visual() { return this.#visual; }
    get item() { return this.#item; }

    get totalTime() { return this.visual.dt * this.visual.nodes.length; }
    get nowTime() { return this.#t; }
    set nowTime(v) {
        v = Math.min(this.totalTime, Math.max(0, util.ensure(v, "num")));
        if (this.nowTime == v) return;
        this.#t = v;
        this.item.interp = this.nowTime / this.totalTime;
        this.post("change", null);
    }
    get isFinished() { return this.nowTime >= this.totalTime; }

    start() { return this.#tPrev = util.getTime(); }

    get paused() { return this.#paused; }
    set paused(v) {
        v = !!v;
        if (this.paused == v) return;
        this.#paused = v;
        this.post("change", null);
    }
    get playing() { return !this.paused; }
    set playing(v) { this.paused = !v; }
    pause() { return this.paused = true; }
    play() { return this.playing = true; }

    update() {
        let deltaTime = util.getTime() - this.#tPrev;
        if (this.show && this.playing) this.nowTime += deltaTime;
        this.#tPrev += deltaTime;
    }
}

class RenderItem extends core.Target {
    #app;

    #pos;
    #dir;
    #scale;
    #align;
    #show;

    #applyGlobalToPos;
    #applyGlobalToScale;

    #elem;

    constructor() {
        super();

        this.#app = null;

        this.#pos = new V();
        this.#dir = 0;
        this.#scale = new V(1);
        this.#align = new V();
        this.#show = true;

        this.#applyGlobalToPos = true;
        this.#applyGlobalToScale = true;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
    }

    get app() { return this.#app; }
    set app(v) {
        v = (v instanceof App) ? v : null;
        if (this.app == v) return;
        this.#app = v;
    }
    hasApp() { return this.app instanceof App; }

    get pos() { return this.#pos; }
    set pos(v) { this.pos.set(v); }
    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }
    get dir() { return this.#dir; }
    set dir(v) {
        v = ((util.ensure(v, "num")%360)+360)%360;
        if (this.dir == v) return;
        this.#dir = v;
        this.post("dir-set", { v: v });
    }
    get scale() { return this.#scale; }
    set scale(v) { this.scale.set(v); }
    get scaleX() { return this.scale.x; }
    set scaleX(v) { this.scale.x = v; }
    get scaleY() { return this.scale.y; }
    set scaleY(v) { this.scale.y = v; }
    get align() { return this.#align; }
    set align(v) { this.#align.set(v); }
    get alignX() { return this.align.x; }
    set alignX(v) { this.align.x = v; }
    get alignY() { return this.align.y; }
    set alignY(v) { this.align.y = v; }
    get show() { return this.#show; }
    set show(v) {
        v = !!v;
        if (this.show == v) return;
        this.#show = v;
        this.post("show-set", { v: v });
    }

    get applyGlobalToPos() { return this.#applyGlobalToPos; }
    set applyGlobalToPos(v) { this.#applyGlobalToPos = !!v; }
    get applyGlobalToScale() { return this.#applyGlobalToScale; }
    set applyGlobalToScale(v) { this.#applyGlobalToScale = !!v; }

    get elem() { return this.#elem; }

    get parentElem() { return this.elem.parentElement; }
    hasParentElem() { return this.parentElem instanceof HTMLElement; }

    update() {
        this.post("update", null);
        let globalScale = this.hasApp() ? this.app.globalScale : 1;
        let posScale = this.applyGlobalToPos ? globalScale : 1;
        let scaleScale = this.applyGlobalToScale ? globalScale : 1;
        this.elem.style.transform = [
            "translate("+(this.x * posScale)+"px, "+(-this.y * posScale)+"px)",
            "translate("+(this.alignX<0?-100:this.alignX>0?0:-50)+"%, "+(this.alignY<0?100:this.alignY>0?0:50)+"%)",
            "scale("+this.scale.mul(scaleScale).xy.join(",")+")",
            "rotate("+(-this.dir)+"deg)",
        ].join(" ");
        this.elem.style.visibility = this.show ? "inherit" : "hidden";
    }

    pageToMap(...pos) {
        pos = new V(...pos);
        if (!this.hasParentElem()) return pos;
        let r = this.parentElem.getBoundingClientRect();
        let x = pos.x;
        let y = pos.y;
        x -= r.left;
        y -= r.top;
        x /= r.width;
        y /= r.height;
        y = 1 - y;
        x *= (this.hasApp() && this.app.hasProject()) ? this.app.project.w : 0;
        y *= (this.hasApp() && this.app.hasProject()) ? this.app.project.h : 0;
        return new V(x, y);
    }
}

class RIBackground extends RenderItem {
    #img;

    constructor(src) {
        super();

        this.elem.classList.add("background");

        this.#img = document.createElement("img");
        this.elem.appendChild(this.img);

        this.img.src = "../assets/field.png";

        this.src = src;
    }

    get img() { return this.#img; }

    get src() { return this.img.src; }
    set src(v) {
        if (v == null) this.img.style.visibility = "hidden";
        else {
            this.img.style.visibility = "inherit";
            this.img.src = v;
        }
    }
}

class RIPathIndex extends RenderItem {
    #item;

    constructor(item) {
        super();

        this.#item = null;

        this.elem.classList.add("pathindex");
        this.applyGlobalToScale = false;

        this.addHandler("update", data => {
            if (this.hasItem()) this.pos = this.item.pos;
        });

        this.item = item;
    }

    get item() { return this.#item; }
    set item(v) {
        v = (v instanceof subcore.Project.Item) ? v : null;
        if (this.item == v) return;
        this.#item = v;
    }
    hasItem() { return this.item instanceof subcore.Project.Item; }

    get value() { return this.elem.textContent; }
    set value(v) { this.elem.textContent = v; }
}
class RIPathLine extends RenderItem {
    #itemA; #itemB;

    constructor(itemA, itemB) {
        super();

        this.elem.classList.add("pathline");

        this.#itemA = null;
        this.#itemB = null;

        let a = new V(), b = new V();

        this.addHandler("update", data => {
            if (this.hasItemA()) a.set(this.itemA.pos);
            if (this.hasItemB()) b.set(this.itemB.pos);
            this.pos = a;
            this.dir = a.towards(b);
            this.elem.style.setProperty("--dist", b.dist(a)+"px");
        });

        this.itemA = itemA;
        this.itemB = itemB;
    }

    get itemA() { return this.#itemA; }
    set itemA(v) {
        v = (v instanceof subcore.Project.Item) ? v : null;
        if (this.item == v) return;
        this.#itemA = v;
    }
    hasItemA() { return this.itemA instanceof subcore.Project.Item; }
    get itemB() { return this.#itemB; }
    set itemB(v) {
        v = (v instanceof subcore.Project.Item) ? v : null;
        if (this.item == v) return;
        this.#itemB = v;
    }
    hasItemB() { return this.itemB instanceof subcore.Project.Item; }
}
class RIPathVisual extends RenderItem {
    #dt;
    #nodes;

    #canvas;
    #ctx;

    constructor(dt, nodes) {
        super();

        this.#dt = 0;
        this.#nodes = [];

        this.elem.classList.add("pathvisual");

        const canvas = this.#canvas = document.createElement("canvas");
        this.elem.appendChild(canvas);
        const ctx = this.#ctx = canvas.getContext("2d");
        const scale = 3;

        this.addHandler("update", data => {
            let style = getComputedStyle(document.body);
            let size = new V((this.hasApp() && this.app.hasProject()) ? this.app.project.size : 0);
            this.pos = size.div(2);
            canvas.width = scale*size.x;
            canvas.height = scale*size.y;
            canvas.style.width = size.x+"px";
            canvas.style.height = size.y+"px";
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // ctx.strokeStyle = style.getPropertyValue("--cg-8");
            ctx.lineWidth = scale*5;
            ctx.lineCap = "butt";
            ctx.lineJoin = "round";
            let nodes = this.nodes;
            let colors = {};
            "roygbpm".split("").forEach(name => {
                let c = String(style.getPropertyValue("--c"+name));
                c = c.startsWith("rgba") ? c.slice(4) : c.startsWith("rgb") ? c.slice(3) : null;
                if (c == null) c = [0, 0, 0];
                else {
                    c = (c.at(0) == "(" && c.at(-1) == ")") ? c.slice(1, c.length-1) : null;
                    if (c == null) c = [0, 0, 0];
                    else {
                        c = c.split(",").map(v => v.replaceAll(" ", ""));
                        if (![3, 4].includes(c.length)) c = [0, 0, 0];
                        else {
                            if (c.length > 3) c.pop();
                            c = c.map(v => Math.min(255, Math.max(0, util.ensure(parseFloat(v), "num"))));
                        }
                    }
                }
                colors[name] = c;
            });
            for (let i = 0; i+1 < nodes.length; i++) {
                let j = i+1;
                let ni = nodes[i], nj = nodes[j];
                let pi = new V(ni.x, size.y-ni.y).mul(scale), pj = new V(nj.x, size.y-nj.y).mul(scale);
                let vi = ni.velocity.dist(), vj = nj.velocity.dist();
                let thresh1 = 0, thresh2 = 500;
                let colorks = ["g", "y", "r"];
                const fc = v => {
                    v = Math.min(1, Math.max(0, (v - thresh1) / (thresh2 - thresh1)));
                    for (let i = 0; i+1 < colorks.length; i++) {
                        let j = i+1;
                        let vi = i / (colorks.length-1), vj = j / (colorks.length-1);
                        if (v >= vi && v <= vj) {
                            let ci = colors[colorks[i]], cj = colors[colorks[j]];
                            return Array.from(new Array(3).keys()).map(k => util.lerp(ci[k], cj[k], (v-vi)/(vj-vi)));
                        }
                    }
                    return null;
                };
                let ci = fc(vi), cj = fc(vj);
                let grad = ctx.createLinearGradient(...pi.xy, ...pj.xy);
                grad.addColorStop(0, "rgb("+ci.join(",")+")");
                grad.addColorStop(1, "rgb("+cj.join(",")+")");
                ctx.beginPath();
                ctx.strokeStyle = grad;
                ctx.moveTo(...pi.xy);
                ctx.lineTo(...pj.xy);
                ctx.stroke();
            }
        });

        this.dt = dt;
        this.nodes = nodes;
    }

    get dt() { return this.#dt; }
    set dt(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.dt == v) return;
        this.#dt = v;
    }

    get nodes() { return [...this.#nodes]; }
    set nodes(v) {
        v = util.ensure(v, "arr");
        this.#nodes = v.map(v => new subcore.Project.Node(v));
    }

    get canvas() { return this.#canvas; }
    get ctx() { return this.#ctx; }
}
class RIPathVisualItem extends RenderItem {
    #visual;
    #interp;

    constructor(visual) {
        super();

        this.#visual = null;
        this.#interp = 0;

        this.applyGlobalToScale = false;

        this.elem.classList.add("pathvisualitem");

        this.elem.classList.add("selectable");

        this.elem.classList.add("this");

        this.elem.innerHTML = "<button></button>";

        this.elem.classList.add("node");

        this.elem.classList.add("velocity");

        const eArrow = document.createElement("button");
        this.elem.appendChild(eArrow);
        eArrow.classList.add("arrow");

        const eBody = document.createElement("button");
        this.elem.appendChild(eBody);
        eBody.classList.add("body");

        this.addHandler("update", data => {
            this.elem.style.setProperty("--body-w", ((this.hasApp() && this.app.hasProject()) ? this.app.project.robotW : 0)+"px");
            this.elem.style.setProperty("--body-h", ((this.hasApp() && this.app.hasProject()) ? this.app.project.robotW : 0)+"px");
            if (!this.hasVisual()) return;
            let p = this.interp;
            let nodes = this.visual.nodes;
            let i = Math.floor((nodes.length-1)*p);
            let j = Math.min(i+1, nodes.length-1);
            let ni = nodes[i], nj = nodes[j];
            p = ((nodes.length-1)*p) - i;
            let node = new subcore.Project.Node(
                util.lerp(ni.pos, nj.pos, p),
                ni.heading + util.angleRelRadians(ni.heading, nj.heading)*p, true,
                util.lerp(ni.velocity, nj.velocity),
                0, true,
            );
            this.pos = node.pos;
            this.elem.style.setProperty("--dir-vel", (180-node.velocity.towards())+"deg");
            this.elem.style.setProperty("--dist", node.velocity.dist()+"px");
            this.elem.style.setProperty("--dir-head", (-(180/Math.PI)*node.heading)+"deg");
        });

        this.visual = visual;
    }

    get visual() { return this.#visual; }
    set visual(v) {
        v = (v instanceof RIPathVisual) ? v : null;
        if (this.visual == v) return;
        this.#visual = v;
    }
    hasVisual() { return this.visual instanceof RIPathVisual; }

    get interp() { return this.#interp; }
    set interp(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.interp == v) return;
        this.#interp = v;
    }
}

class RISelect extends RenderItem {
    #a; #b;

    constructor() {
        super();

        this.#a = new V();
        this.#b = new V();

        this.elem.classList.add("select");

        this.addHandler("update", data => {
            this.pos = [(this.aX+this.bX)/2, (this.aY+this.bY)/2];
            this.elem.style.width = Math.abs(this.aX-this.bX)+"px";
            this.elem.style.height = Math.abs(this.aY-this.bY)+"px";
        });
    }

    get a() { return this.#a; }
    set a(v) { this.a.set(v); }
    get aX() { return this.a.x; }
    set aX(v) { this.a.x = v; }
    get aY() { return this.a.y; }
    set aY(v) { this.a.y = v; }
    get b() { return this.#b; }
    set b(v) { this.b.set(v); }
    get bX() { return this.b.x; }
    set bX(v) { this.b.x = v; }
    get bY() { return this.b.y; }
    set bY(v) { this.b.y = v; }
}
class RISelectable extends RenderItem {
    #ghost;

    #item;

    constructor(item) {
        super();

        this.#ghost = false;

        this.#item = null;

        this.elem.classList.add("selectable");

        this.elem.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            this.post("trigger", { shift: e.shiftKey });
        });

        this.addHandler("update", data => {
            if (this.ghost) this.elem.style.opacity = "50%";
            else this.elem.style.opacity = "100%";
        });

        this.addHandler("set", data => {
            this.elem.innerHTML = "<button></button>";
            [...this.elem.classList].forEach(cls => ["item", "selectable", "this"].includes(cls) ? null : this.elem.classList.remove(cls));
            if (!this.hasItem()) return;

            this.applyGlobalToPos = true;
            this.applyGlobalToScale = false;

            if (this.item instanceof subcore.Project.Node) {
                this.elem.classList.add("node");

                const eArrow = document.createElement("button");
                this.elem.appendChild(eArrow);
                eArrow.classList.add("arrow");

                eArrow.addEventListener("mousedown", e => {
                    if (e.button != 0) return;
                    e.stopPropagation();
                    const mouseup = () => {
                        document.body.removeEventListener("mouseup", mouseup);
                        document.body.removeEventListener("mousemove", mousemove);
                    };
                    const mousemove = e => {
                        let pos = this.pageToMap(e.pageX, e.pageY);
                        this.item.velocity = pos.sub(this.pos);
                        this.post("change", null);
                    };
                    document.body.addEventListener("mouseup", mouseup);
                    document.body.addEventListener("mousemove", mousemove);
                });

                const eBody = document.createElement("button");
                this.elem.appendChild(eBody);
                eBody.classList.add("body");

                eBody.addEventListener("mousedown", e => {
                    if (e.button != 0) return;
                    e.stopPropagation();
                    const mouseup = () => {
                        document.body.removeEventListener("mouseup", mouseup);
                        document.body.removeEventListener("mousemove", mousemove);
                    };
                    const mousemove = e => {
                        let pos = this.pageToMap(e.pageX, e.pageY);
                        this.item.heading = (Math.PI/180) * this.pos.towards(pos);
                        this.post("change", null);
                    };
                    document.body.addEventListener("mouseup", mouseup);
                    document.body.addEventListener("mousemove", mousemove);
                });
                
                const update = data => {
                    this.pos = this.item.pos;
                    if (this.item.useVelocity) this.elem.classList.add("velocity");
                    else this.elem.classList.remove("velocity");
                    this.elem.style.setProperty("--dir-vel", (180-this.item.velocity.towards())+"deg");
                    this.elem.style.setProperty("--dist", this.item.velocity.dist()+"px");
                    this.elem.style.setProperty("--dir-head", (-(180/Math.PI)*this.item.heading)+"deg");
                    this.elem.style.setProperty("--body-w", ((this.hasApp() && this.app.hasProject()) ? this.app.project.robotW : 0)+"px");
                    this.elem.style.setProperty("--body-h", ((this.hasApp() && this.app.hasProject()) ? this.app.project.robotW : 0)+"px");
                };
                this.addHandler("update", update);

                const set = () => {
                    this.remHandler("update", update);
                    this.remHandler("set", set);
                };
                this.addHandler("set", set);
            }

            if (this.item instanceof subcore.Project.Obstacle) {
                this.elem.classList.add("obstacle");
        
                const eRadius = document.createElement("div");
                this.elem.appendChild(eRadius);
                eRadius.classList.add("radius");
                const eRadiusDrag = document.createElement("button");
                this.elem.appendChild(eRadiusDrag);
                eRadiusDrag.classList.add("radiusdrag");
        
                eRadiusDrag.addEventListener("mousedown", e => {
                    if (e.button != 0) return;
                    e.stopPropagation();
                    const mouseup = () => {
                        document.body.removeEventListener("mouseup", mouseup);
                        document.body.removeEventListener("mousemove", mousemove);
                    };
                    const mousemove = e => {
                        let pos = this.pageToMap(e.pageX, e.pageY);
                        let r = this.pos.dist(pos);
                        this.item.radius = r;
                        this.post("change", null);
                        this.dir = this.pos.towards(pos);
                    };
                    document.body.addEventListener("mouseup", mouseup);
                    document.body.addEventListener("mousemove", mousemove);
                });

                const update = data => {
                    this.pos = this.item.pos;
                    this.elem.style.setProperty("--radius", this.item.radius+"px");
                    this.elem.style.setProperty("--dir", this.dir+"deg");
                };
                this.addHandler("update", update);

                const set = () => {
                    this.remHandler("update", update);
                    this.remHandler("set", set);
                };
                this.addHandler("set", set);
            }
        });

        this.item = item;
    }

    get ghost() { return this.#ghost; }
    set ghost(v) { this.#ghost = !!v; }

    get item() { return this.#item; }
    set item(v) {
        v = (v instanceof subcore.Project.Item) ? v : null;
        if (this.item == v) return;
        this.#item = v;
        this.post("set", { v: v });
    }
    hasItem() { return this.item instanceof subcore.Project.Item; }

    get selected() { return this.elem.classList.contains("this"); }
    set selected(v) { v ? this.elem.classList.add("this") : this.elem.classList.remove("this"); }
}

export default class App extends core.App {
    #changes;

    #projects;
    #projectId;
    #globalScale;

    #pages;
    #page;

    #eTitleBtn;
    #eProjectsBtn;
    #eCreateBtn;
    #eFileBtn;
    #eEditBtn;
    #eNameInput;
    #eSaveBtn;

    constructor() {
        super();

        this.#changes = new Set();

        this.#projects = {};
        this.#projectId = false;
        this.#globalScale = 1;

        this.#pages = {};
        this.#page = null;

        this.addHandler("setup", async data => {
            try {
                await this.syncWithFiles();
            } catch (e) {
                let alert = this.alert("There was an error loading your projects!", "warning");
                alert.hasInfo = true;
                alert.info = String(e);
                alert.iconColor = "var(--cr)";
            }
        })
        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#mount > .content > .title > .logo > .title");
        });
        this.addHandler("start-complete", data => {
            this.addBackButton();

            this.#eTitleBtn = document.getElementById("titlebtn");
            if (this.hasETitleBtn())
                this.eTitleBtn.addEventListener("click", e => {
                    this.page = "TITLE";
                });
            this.#eProjectsBtn = document.getElementById("projectsbtn");
            if (this.hasEProjectsBtn())
                this.eProjectsBtn.addEventListener("click", e => {
                    this.page = "PROJECTS";
                });
            this.#eCreateBtn = document.getElementById("createbtn");
            if (this.hasECreateBtn())
                this.eCreateBtn.addEventListener("click", e => {
                    this.page = "PROJECT";
                });

            this.#eFileBtn = document.getElementById("filebtn");
            if (this.hasEFileBtn())
                this.eFileBtn.addEventListener("click", e => {
                    let itm;
                    let menu = new core.App.ContextMenu();
                    itm = menu.addItem(new core.App.ContextMenu.Item("New", "document"));
                    itm.shortcut = "⌘N";
                    itm.addHandler("trigger", data => {
                        this.page = "PROJECT";
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Delete", ""));
                    itm.addHandler("trigger", data => {
                        let pop = this.addPopup(new core.App.Confirm());
                        pop.eContent.innerText = "Are you sure you want to delete this project?\nThis action is not reversible!";
                        pop.addHandler("result", data => {
                            let v = !!util.ensure(data, "obj").v;
                            if (v) {
                                this.remProject(this.projectId);
                                this.page = "PROJECTS";
                            }
                        });
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Close", "close"));
                    itm.addHandler("trigger", data => {
                        this.page = "PROJECTS";
                    });
                    menu.addItem(new core.App.ContextMenu.Divider());
                    itm = menu.addItem(new core.App.ContextMenu.Item("Save"));
                    itm.shortcut = "⌘S";
                    itm.addHandler("trigger", async data => {
                        try {
                            await this.syncFilesWith();
                        } catch (e) {
                            let alert = this.alert("There was an error saving your projects!", "warning");
                            alert.hasInfo = true;
                            alert.info = String(e);
                            alert.iconColor = "var(--cr)";
                        }
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Save as copy"));;
                    itm.shortcut = "⇧⌘S";
                    itm.addHandler("trigger", data => {
                        let project = new subcore.Project(this.project);
                        project.meta.name += " copy";
                        this.setPage("PROJECT", { project: project });
                    });
                    menu.addItem(new core.App.ContextMenu.Divider());
                    itm = menu.addItem(new core.App.ContextMenu.Item("Add Node", "add"));
                    itm.addHandler("trigger", data => {
                        let state = this.#pages["PROJECT"];
                        if (!util.is(state, "obj")) return;
                        if (!util.is(state.options, "obj")) return;
                        if (!util.is(state.options.map, "obj")) return;
                        if (!util.is(state.options.map.spawns, "obj")) return;
                        if (!util.is(state.options.map.spawns["node"], "obj")) return;
                        state.options.map.spawns["node"].trigger();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Add Obstacle", "add"));
                    itm.addHandler("trigger", data => {
                        let state = this.#pages["PROJECT"];
                        if (!util.is(state, "obj")) return;
                        if (!util.is(state.options, "obj")) return;
                        if (!util.is(state.options.map, "obj")) return;
                        if (!util.is(state.options.map.spawns, "obj")) return;
                        if (!util.is(state.options.map.spawns["obstacle"], "obj")) return;
                        state.options.map.spawns["obstacle"].trigger();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Add Path", "add"));
                    itm.addHandler("trigger", data => {
                        let state = this.#pages["PROJECT"];
                        if (!util.is(state, "obj")) return;
                        if (!util.is(state.options, "obj")) return;
                        if (!util.is(state.options.path, "obj")) return;
                        if (!util.is(state.options.path.ePathAdd, "obj")) return;
                        state.options.path.ePathAdd.click();
                    });
                    this.contextMenu = menu;
                    let r = this.eFileBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eEditBtn = document.getElementById("editbtn");
            if (this.hasEEditBtn())
                this.eEditBtn.addEventListener("click", e => {
                    let itm;
                    let menu = new core.App.ContextMenu();
                    itm = menu.addItem(new core.App.ContextMenu.Item("Cut"));
                    itm.shortcut = "⌘X";
                    itm.addHandler("trigger", data => {
                        let state = this.#pages["PROJECT"];
                        if (!util.is(state, "obj")) return;
                        state.cut();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Copy"));
                    itm.shortcut = "⌘C";
                    itm.addHandler("trigger", data => {
                        let state = this.#pages["PROJECT"];
                        if (!util.is(state, "obj")) return;
                        state.copy();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Paste"));
                    itm.shortcut = "⌘V";
                    itm.addHandler("trigger", data => {
                        let state = this.#pages["PROJECT"];
                        if (!util.is(state, "obj")) return;
                        state.paste();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Select All"));
                    itm.shortcut = "⌘A";
                    itm.addHandler("trigger", data => {
                        let state = this.#pages["PROJECT"];
                        if (!util.is(state, "obj")) return;
                        if (!this.hasProject()) return;
                        state.setSelected(this.project.items);
                    });
                    this.contextMenu = menu;
                    let r = this.eEditBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eNameInput = document.querySelector("#nameinput > input");
            this.#eSaveBtn = document.querySelector("#save > button");
            if (this.hasESaveBtn())
                this.eSaveBtn.addEventListener("click", async e => {
                    if (this.changes.length <= 0) return;
                    try {
                        await this.syncFilesWith();
                    } catch (e) {
                        let alert = this.alert("There was an error saving your projects!", "warning");
                        alert.hasInfo = true;
                        alert.info = String(e);
                        alert.iconColor = "var(--cr)";
                    }
                });
            let saving = false;
            this.addHandler("sync-files-with", data => {
                saving = true;
            });
            this.addHandler("synced-files-with", data => {
                saving = false;
            });
            this.addHandler("update", data => {
                if (this.hasESaveBtn()) this.eSaveBtn.textContent = saving ? "Saving" : (this.changes.length > 0) ? "Save" : "Saved";
            });

            const update = () => {
                this.post("update", null);
                window.requestAnimationFrame(update);
            };

            this.clearChanges();

            this.addPage("TITLE", document.getElementById("TITLEPAGE"));
            this.addPage("PROJECTS", document.getElementById("PROJECTSPAGE"));
            this.addPage("PROJECT", document.getElementById("PROJECTPAGE"));

            this.projectId = null;
            this.page = "TITLE";

            window.requestAnimationFrame(update);
        });
    }

    get changes() { return [...this.#changes]; }
    markChange(change) {
        change = String(change);
        if (this.hasChange(change)) return true;
        this.#changes.add(change);
        this.post("change", { change: change });
        return true;
    }
    hasChange(change) {
        change = String(change);
        return this.#changes.has(change);
    }
    clearChanges() {
        let changes = this.changes;
        this.#changes.clear();
        this.post("change-clear", { changes: changes });
        return changes;
    }
    async syncWithFiles() {
        try {
            await this.post("sync-with-files", null);
        } catch (e) {}
        let hasProjectIds = await window.api.fileHas("projects.json");
        if (!hasProjectIds) {
            // console.log("no projects.json found > creating");
            await window.api.fileWrite("projects.json", "[]");
        }
        let projectIdsContent = "";
        try {
            projectIdsContent = await window.api.fileRead("projects.json");
        } catch (e) {
            // console.log("error reading projects.json:");
            // console.log(e);
            projectIdsContent = "";
        }
        let projectIds = null;
        try {
            projectIds = JSON.parse(projectIdsContent, subcore.REVIVER.f);
        } catch (e) {
            // console.log("error parsing projects.json:", projectIdsContent);
            // console.log(e);
            projectIds = null;
        }
        projectIds = util.ensure(projectIds, "arr").map(id => String(id));
        // console.log("projects.json: ", projectIds);
        let hasProjectsDir = await window.api.dirHas("projects");
        if (!hasProjectsDir) {
            // console.log("no projects directory found > creating");
            await window.api.dirMake("projects");
        }
        let projects = {};
        for (let i = 0; i < projectIds.length; i++) {
            let id = projectIds[i];
            let projectContent = "";
            try {
                projectContent = await window.api.fileRead(["projects", id+".json"]);
            } catch (e) {
                // console.log("error reading projects/"+id+".json:");
                // console.log(e);
                projectContent = "";
            }
            let project = null;
            try {
                project = JSON.parse(projectContent, subcore.REVIVER.f);
            } catch (e) {
                // console.log("error parsing projects/"+id+".json:", projectContent);
                // console.log(e);
                project = null;
            }
            if (!(project instanceof subcore.Project)) continue;
            // console.log("projects/"+id+".json: ", project);
            projects[id] = project;
        }
        this.projects = projects;
        this.clearChanges();
        try {
            await this.post("synced-with-files", null);
        } catch (e) {}
    }
    async syncFilesWith() {
        try {
            await this.post("sync-files-with", null);
        } catch (e) {}
        let changes = new Set(this.changes);
        this.clearChanges();
        // console.log("CHANGES:", this.changes);
        if (changes.has("*all")) {
            // console.log("CHANGE:*all > updating global list");
            let projectIds = this.projects;
            let projectIdsContent = JSON.stringify(projectIds, null, "\t");
            await window.api.fileWrite("projects.json", projectIdsContent);
            for (let i = 0; i < projectIds.length; i++) {
                let id = projectIds[i];
                // console.log("CHANGE:*all > creating/updating project id:"+id);
                let project = this.getProject(id);
                project.meta.thumb = this.generateRepresentation(project);
                let projectContent = JSON.stringify(project, null, "\t");
                await window.api.fileWrite(["projects", id+".json"], projectContent);
            }
            if (await window.api.dirHas("projects")) {
                let dirents = await window.api.dirList("projects");
                for (let i = 0; i < dirents.length; i++) {
                    let dirent = dirents[i];
                    if (dirent.type != "file") continue;
                    let id = dirent.name.split(".")[0];
                    if (this.hasProject(id)) continue;
                    // console.log("CHANGE:*all > removing project id:"+id);
                    await window.api.fileDelete(["projects", id+".json"]);
                }
            }
        } else {
            let projectIds = this.projects;
            if (this.hasChange("*")) {
                // console.log("CHANGE:* > updating global list");
                let projectIdsContent = JSON.stringify(projectIds, null, "\t");
                await window.api.fileWrite("projects.json", projectIdsContent);
            }
            for (let i = 0; i < projectIds.length; i++) {
                let id = projectIds[i];
                if (!changes.has("proj:"+id)) continue;
                // console.log("CHANGE:proj:"+id+" > creating/updating project id:"+id);
                let project = this.getProject(id);
                project.meta.modified = util.getTime();
                project.meta.thumb = this.generateRepresentation(project);
                let projectContent = JSON.stringify(project, null, "\t");
                await window.api.fileWrite(["projects", id+".json"], projectContent);
            }
            for (let i = 0; i < changes.length; i++) {
                let change = changes[i];
                if (!change.startsWith("proj:")) continue;
                let id = change.substring(5);
                if (this.hasProject(id)) continue;
                // console.log("CHANGE:proj:"+id+" > removing project id:"+id);
                if (await window.api.fileHas(["project", id+".json"]))
                    await window.api.fileDelete(["projects", id+".json"]);
            }
        }
        try {
            await this.post("synced-files-with", null);
        } catch (e) {}
    }
    get projects() { return Object.keys(this.#projects); }
    set projects(v) {
        v = util.ensure(v, "obj");
        this.clearProjects();
        for (let id in v) this.addProject(id, v[id]);
    }
    clearProjects() {
        let projs = this.projects;
        projs.forEach(id => this.remProject(id));
        return projs;
    }
    hasProject(id) {
        if (id == null) id = this.projectId;
        id = String(id);
        return id in this.#projects;
    }
    getProject(id) {
        id = String(id);
        if (!this.hasProject(id)) return null;
        return this.#projects[id];
    }
    addProject(id, proj) {
        id = String(id);
        if (!(proj instanceof subcore.Project)) return false;
        if (this.hasProject(proj.id)) return false;
        if (this.hasProject(id)) return false;
        this.#projects[id] = proj;
        proj.id = id;
        proj._onChange = () => this.markChange("proj:"+proj.id);
        proj.addHandler("change", proj._onChange);
        this.markChange("*");
        this.markChange("proj:"+id);
        return proj;
    }
    remProject(id) {
        id = String(id);
        if (!this.hasProject(id)) return false;
        let proj = this.getProject(id);
        delete this.#projects[id];
        proj.remHandler("change", proj._onChange);
        delete proj._onChange;
        proj.id = null;
        this.markChange("*");
        this.markChange("proj:"+id);
        return proj;
    }

    get projectId() { return this.#projectId; }
    set projectId(v) {
        v = this.hasProject(v) ? String(v) : null;
        if (this.projectId == v) return;
        this.#projectId = v;
        this.post("project-set", { v: this.projectId });
    }
    get project() { return this.getProject(this.projectId); }
    set project(v) {
        v = (v instanceof subcore.Project) ? v : null;
        if (this.project == v) return;
        if (v instanceof subcore.Project) {
            if (!this.hasProject(v.id)) {
                let id;
                do {
                    id = new Array(10).fill(null).map(_ => util.BASE64[Math.floor(64*Math.random())]).join("");
                } while (this.hasProject(id));
                this.addProject(id, v);
            }
            this.projectId = v.id;
        } else this.projectId = null;
    }
    generateRepresentation(proj) {
        if (!(proj instanceof subcore.Project)) return null;
        let style = getComputedStyle(document.body);
        let canv = document.createElement("canvas");
        canv.width = proj.w;
        canv.height = proj.h;
        let ctx = canv.getContext("2d");
        ctx.fillStyle = style.getPropertyValue("--v1");
        ctx.fillRect(0, 0, canv.width, canv.height);
        proj.items.forEach(id => {
            let itm = proj.getItem(id);
            if (itm instanceof subcore.Project.Node) {
                ctx.fillStyle = style.getPropertyValue("--cb");
                ctx.beginPath();
                ctx.arc(itm.x, proj.h-itm.y, 10, 0, 2*Math.PI);
                ctx.fill();
                ctx.strokeStyle = style.getPropertyValue("--v8");
                ctx.lineWidth = 2;
                ctx.beginPath();
                let corners = [[+1,+1], [+1,-1], [-1,-1], [-1,+1]];
                corners = corners.map(v => new V(proj.robotW).div(2).mul(v).rotateOrigin(itm.heading));
                for (let i = 0; i <= corners.length; i++) {
                    let p = corners[i % corners.length];
                    if (i < 0) ctx.moveTo(itm.x+p.x, proj.h-(itm.y+p.y));
                    else ctx.lineTo(itm.x+p.x, proj.h-(itm.y+p.y));
                }
                ctx.stroke();
            }
            if (itm instanceof subcore.Project.Obstacle) {
                ctx.fillStyle = style.getPropertyValue("--cr");
                ctx.beginPath();
                ctx.arc(itm.x, proj.h-itm.y, itm.radius, 0, 2*Math.PI);
                ctx.fill();
            }
        });
        return canv.toDataURL();
    };

    get globalScale() { return this.#globalScale; }
    set globalScale(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.globalScale == v) return;
        this.#globalScale = v;
    }

    get pages() { return Object.keys(this.#pages); }
    hasPage(name) {
        name = String(name);
        return name in this.#pages;
    }
    addPage(name, elem) {
        name = String(name);
        if (this.hasPage(name)) return false;
        let state = this.#pages[name] = new core.Target();
        state.elem = elem;
        let namefs = {
            TITLE: () => {
                if (!(state.elem instanceof HTMLDivElement)) return;
                let createBtn = state.elem.querySelector(":scope > .nav > #createbtn");
                if (createBtn instanceof HTMLButtonElement)
                    createBtn.addEventListener("click", e => {
                        this.page = "PROJECT";
                    });
                let projectsBtn = state.elem.querySelector(":scope > .nav > #projectsbtn");
                if (projectsBtn instanceof HTMLButtonElement)
                    projectsBtn.addEventListener("click", e => {
                        this.page = "PROJECTS";
                    });
            },
            PROJECTS: () => {
                let buttons = new Set();
                this.getProjectButtons = () => [...buttons];
                this.setProjectButtons = v => {
                    v = util.ensure(v, "arr");
                    this.clearProjectButtons();
                    v.forEach(v => this.addProjectButton(v));
                };
                this.clearProjectButtons = () => {
                    let btns = this.getProjectButtons();
                    btns.forEach(btn => this.remProjectButton(btn));
                    return btns;
                };
                this.hasProjectButton = btn => {
                    if (!(btn instanceof ProjectButton)) return false;
                    return buttons.has(btn);
                };
                this.addProjectButton = btn => {
                    if (!(btn instanceof ProjectButton)) return false;
                    if (this.hasProjectButton(btn)) return false;
                    buttons.add(btn);
                    btn._onEdit = () => {
                        this.setPage("PROJECT", { id: btn.project.id });
                    };
                    btn.addHandler("edit", btn._onEdit);
                    btn.app = this;
                    if (state.eContent instanceof HTMLDivElement) state.eContent.appendChild(btn.elem);
                    return btn;
                };
                this.remProjectButton = btn => {
                    if (!(btn instanceof ProjectButton)) return false;
                    if (!this.hasProjectButton(btn)) return false;
                    buttons.delete(btn);
                    btn.remHandler("edit", btn._onEdit);
                    delete btn._onEdit;
                    btn.app = null;
                    if (state.eContent instanceof HTMLDivElement) state.eContent.removeChild(btn.elem);
                    return btn;
                };
                this.addHandler("update", data => {
                    this.getProjectButtons().forEach(btn => btn.update());
                });
                if (!(state.elem instanceof HTMLDivElement)) return;
                state.eSearchBox = state.elem.querySelector(":scope > .nav > .search");
                if (state.eSearchBox instanceof HTMLDivElement) {
                    state.eSearchInput = state.eSearchBox.querySelector(":scope > input");
                    if (state.eSearchInput instanceof HTMLInputElement)
                        state.eSearchInput.addEventListener("input", e => {
                            state.refresh();
                        });
                    state.eSearchButton = state.eSearchBox.querySelector(":scope > button");
                    if (state.eSearchButton instanceof HTMLButtonElement)
                        state.eSearchButton.addEventListener("click", e => {
                            if (state.eSearchInput instanceof HTMLInputElement)
                                state.eSearchInput.value = "";
                            state.refresh();
                        });
                }
                state.eCreate = state.elem.querySelector(":scope > .nav > .nav > button#createbtn");
                if (state.eCreate instanceof HTMLButtonElement)
                    state.eCreate.addEventListener("click", e => {
                        this.page = "PROJECT";
                    });
                state.eContent = state.elem.querySelector(":scope > .content");
                state.eLoading = state.elem.querySelector(":scope > .content > .loading");
                state.eEmpty = state.elem.querySelector(":scope > .content > .empty");
                state.refresh = async () => {
                    this.clearProjectButtons();
                    if (state.eLoading instanceof HTMLDivElement) state.eLoading.style.display = "block";
                    if (state.eEmpty instanceof HTMLDivElement) state.eEmpty.style.display = "none";
                    try {
                        await this.syncWithFiles();
                    } catch (e) {
                        let alert = this.alert("There was an error loading your projects!", "warning");
                        alert.hasInfo = true;
                        alert.info = String(e);
                        alert.iconColor = "var(--cr)";
                    }
                    if (state.eLoading instanceof HTMLDivElement) state.eLoading.style.display = "none";
                    if (this.projects.length > 0) {
                        let projects = this.projects.map(id => this.getProject(id));
                        let query = (state.eSearchInput instanceof HTMLInputElement) ? state.eSearchInput.value : "";
                        if (query.length > 0) {
                            const fuse = new Fuse(projects, {
                                isCaseSensitive: false,
                                keys: [
                                    "meta.name",
                                ],
                            });
                            projects = fuse.search(query).map(item => item.item);
                        }
                        projects.forEach(project => this.addProjectButton(new ProjectButton(project)));
                    } else {
                        if (state.eEmpty instanceof HTMLDivElement) state.eEmpty.style.display = "block";
                    }
                };
            },
            PROJECT: () => {
                this.addHandler("perm", async data => {
                    this.markChange("*all");
                    try {
                        await this.syncFilesWith();
                    } catch (e) {
                        let alert = this.alert("There was an error saving your projects!", "warning");
                        alert.hasInfo = true;
                        alert.info = String(e);
                        alert.iconColor = "var(--cr)";
                        return false;
                    }
                    return true;
                });
                let lock = false;
                setInterval(async () => {
                    if (lock) return;
                    lock = true;
                    try {
                        await this.syncFilesWith();
                    } catch (e) {
                        let alert = this.alert("There was an error saving your projects!", "warning");
                        alert.hasInfo = true;
                        alert.info = String(e);
                        alert.iconColor = "var(--cr)";
                    }
                    lock = false;
                }, 10000);
                document.body.addEventListener("keydown", async e => {
                    if (this.page != "PROJECT") return;
                    if (e.code == "KeyS")
                        if (e.ctrlKey || e.metaKey) {
                            if (e.shiftKey) {
                                let project = new subcore.Project(this.project);
                                project.meta.name += " copy";
                                await this.setPage("PROJECT", { project: project });
                                try {
                                    await this.syncFilesWith();
                                } catch (e) {
                                    let alert = this.alert("There was an error saving your projects!", "warning");
                                    alert.hasInfo = true;
                                    alert.info = String(e);
                                    alert.iconColor = "var(--cr)";
                                }
                            }
                            else {
                                try {
                                    await this.syncFilesWith();
                                } catch (e) {
                                    let alert = this.alert("There was an error saving your projects!", "warning");
                                    alert.hasInfo = true;
                                    alert.info = String(e);
                                    alert.iconColor = "var(--cr)";
                                }
                            }
                        }
                    if (e.code == "KeyN")
                        if (e.ctrlKey || e.metaKey)
                            this.page = "PROJECT";
                });
                state.refresh = async () => {
                    try {
                        await this.syncWithFiles();
                    } catch (e) {
                        let alert = this.alert("There was an error loading your projects!", "warning");
                        alert.hasInfo = true;
                        alert.info = String(e);
                        alert.iconColor = "var(--cr)";
                    }
                    if (util.is(state.options, "obj")) {
                        for (let name in state.options) {
                            let o = state.options[name];
                            if (name == "map") o.show();
                            else o.hide();
                        }
                    }
                };
                if (this.hasENameInput())
                    this.eNameInput.addEventListener("change", e => {
                        if (getChoosing()) return;
                        if (!this.hasProject()) return;
                        this.project.meta.name = this.eNameInput.value;
                        state.post("refresh-options", null);
                    });
                state.addHandler("refresh-options", data => {
                    let names = new Set();
                    this.projects.forEach(id => {
                        let project = this.getProject(id);
                        if (project.meta.name.length <= 0) project.meta.name = "Unnamed";
                        if (names.has(project.meta.name)) {
                            let n = 2;
                            while (names.has(project.meta.name+" "+n)) n++;
                            project.meta.name += " "+n;
                        }
                        names.add(project.meta.name);
                        let pathNames = new Set();
                        project.paths.forEach(id => {
                            let path = project.getPath(id);
                            if (path.name.length <= 0) path.name = "Unnamed";
                            if (pathNames.has(path.name)) {
                                let n = 2;
                                while (pathNames.has(path.name+" "+n)) n++;
                                path.name += " "+n;
                            }
                            pathNames.add(path.name);
                        });
                    });
                    if (this.hasENameInput())
                        this.eNameInput.value = this.hasProject() ? this.project.meta.name : "";
                });
                let renderItems = new Set();
                this.getRenderItems = () => [...renderItems];
                this.setRenderItems = v => {
                    v = util.ensure(v, "arr");
                    let itms = this.clearRenderItems();
                    v.forEach(v => this.addRenderItem(v));
                    return itms;
                };
                this.clearRenderItems = () => {
                    let itms = this.getRenderItems();
                    itms.forEach(itm => this.remRenderItem(itm));
                    return itms;
                };
                this.hasRenderItem = itm => {
                    if (!(itm instanceof RenderItem)) return false;
                    return renderItems.has(itm);
                };
                this.addRenderItem = itm => {
                    if (!(itm instanceof RenderItem)) return false;
                    if (itm.app != null) return false;
                    if (this.hasRenderItem(itm)) return false;
                    renderItems.add(itm);
                    itm.app = this;
                    itm._onChange = () => {
                        state.post("refresh-selectitem", null);
                        state.post("refresh-options", null);
                    };
                    itm.addHandler("change", itm._onChange);
                    if (itm instanceof RISelectable) {
                        itm._onTrigger = data => {
                            if (getChoosing()) {
                                getChooseData().post("choose", { itm: itm.item });
                            } else {
                                if (util.ensure(data, "obj").shift) {
                                    if (isSelected(itm)) remSelected(itm);
                                    else addSelected(itm);
                                } else {
                                    if (isSelected(itm)) return;
                                    clearSelected();
                                    addSelected(itm);
                                }
                            }
                        };
                        itm.addHandler("trigger", itm._onTrigger);
                    }
                    if (state.eRender instanceof HTMLDivElement) state.eRender.appendChild(itm.elem);
                    return itm;
                };
                this.remRenderItem = itm => {
                    if (!(itm instanceof RenderItem)) return false;
                    if (itm.app != this) return false;
                    if (!this.hasRenderItem(itm)) return false;
                    renderItems.delete(itm);
                    itm.app = null;
                    if (itm instanceof RISelectable) {
                        itm.remHandler("trigger", itm._onTrigger);
                        delete itm._onTrigger;
                    }
                    itm.remHandler("change", itm._onChange);
                    delete itm._onChange;
                    if (state.eRender instanceof HTMLDivElement) state.eRender.removeChild(itm.elem);
                    return itm;
                };
                let selected = new Set();
                let selectItem = null;
                state.addHandler("refresh-selectitem", data => {
                    getSelected().forEach(id => {
                        if (!this.hasProject() || !this.project.hasItem(id)) return;
                        let itm = this.project.getItem(id);
                        itm.x = Math.min(this.project.w, Math.max(0, itm.x));
                        itm.y = Math.min(this.project.h, Math.max(0, itm.y));
                        itm.post("change", null);
                    });
                    if (selected.size > 1) {
                        if (selectItem == null)
                            selectItem = this.addRenderItem(new RISelect());
                        let maxPos = new V(), minPos = new V();
                        let first = true;
                        for (let i = 0; i < selected.size; i++) {
                            let id = [...selected][i];
                            if (!this.hasProject() || !this.project.hasItem(id)) continue;
                            let itm = this.project.getItem(id);
                            let bbox = itm.getBBox();
                            if (first) {
                                first = false;
                                maxPos.set(bbox.tr);
                                minPos.set(bbox.bl);
                                continue;
                            }
                            maxPos.x = Math.max(maxPos.x, bbox.r);
                            maxPos.y = Math.max(maxPos.y, bbox.t);
                            minPos.x = Math.min(minPos.x, bbox.l);
                            minPos.y = Math.min(minPos.y, bbox.b);
                        }
                        selectItem.a = minPos;
                        selectItem.b = maxPos;
                    } else {
                        this.remRenderItem(selectItem);
                        selectItem = null;
                    }
                });
                const getSelected = state.getSelected = () => [...selected];
                const setSelected = state.setSelected = v => {
                    v = util.ensure(v, "arr");
                    let sels = clearSelected();
                    v.forEach(v => addSelected(v));
                    return sels;
                };
                const clearSelected = state.clearSelected = () => {
                    let sels = getSelected();
                    sels.forEach(id => remSelected(id));
                    return sels;
                };
                const isSelected = state.isSelected = v => {
                    if (util.is(v, "str")) return selected.has(v);
                    if (v instanceof subcore.Project.Item) return isSelected(v.id);
                    if (v instanceof RISelectable) return isSelected(v.item);
                    return false;
                };
                const addSelected = state.addSelected = v => {
                    if (util.is(v, "str")) {
                        if (this.hasProject() && this.project.hasItem(v)) {
                            selected.add(v);
                            state.post("refresh-selectitem", null);
                            state.post("refresh-options", null);
                            return v;
                        }
                        return false;
                    }
                    if (v instanceof subcore.Project.Item) return addSelected(v.id);
                    if (v instanceof RISelectable) return addSelected(v.item);
                    return false;
                };
                const remSelected = state.remSelected = v => {
                    if (util.is(v, "str")) {
                        selected.delete(v);
                        state.post("refresh-selectitem", null);
                        state.post("refresh-options", null);
                        return v;
                    }
                    if (v instanceof subcore.Project.Item) return remSelected(v.id);
                    if (v instanceof RISelectable) return remSelected(v.item);
                    return false;
                };
                let selectedPaths = new Set();
                const getSelectedPaths = state.getSelectedPaths = () => [...selectedPaths];
                const setSelectedPaths = state.setSelectedPaths = v => {
                    v = util.ensure(v, "arr");
                    clearSelectedPaths();
                    v.forEach(v => addSelectedPath(v));
                };
                const clearSelectedPaths = state.clearSelectedPaths = () => {
                    let pths = getSelectedPaths();
                    pths.forEach(id => remSelectedPath(id));
                    return pths;
                };
                const isPathSelected = state.isPathSelected = v => {
                    if (util.is(v, "str")) return selectedPaths.has(v);
                    if (v instanceof subcore.Project.Path) return isPathSelected(v.id);
                    if (v instanceof PathButton) return isPathSelected(v.path);
                    return false;
                };
                const addSelectedPath = state.addSelectedPath = v => {
                    if (util.is(v, "str")) {
                        if (this.hasProject() && this.project.hasPath(v)) {
                            selectedPaths.add(v);
                            state.post("refresh-options", null);
                            return v;
                        }
                        return false;
                    }
                    if (v instanceof subcore.Project.Path) return addSelectedPath(v.id);
                    if (v instanceof PathButton) return addSelectedPath(v.path);
                    return false;
                };
                const remSelectedPath = state.remSelectedPath = v => {
                    if (util.is(v, "str")) {
                        selectedPaths.delete(v);
                        state.post("refresh-options", null);
                        return v;
                    }
                    if (v instanceof subcore.Project.Path) return remSelectedPath(v.id);
                    if (v instanceof PathButton) return remSelectedPath(v.path);
                    return false;
                };
                this.addHandler("project-set", data => {
                    state.post("refresh-options", null);
                });
                const background = new RIBackground();
                let oldW = null, oldH = null, padding = 40;
                this.addHandler("update", data => {
                    this.addRenderItem(background);
                    let w = this.hasProject() ? this.project.w : 0;
                    let h = this.hasProject() ? this.project.h : 0;
                    background.src = this.hasProject() ? this.project.meta.backgroundImage : null;
                    background.pos = this.hasProject() ? this.project.meta.backgroundPos : 0;
                    background.scale = this.hasProject() ? this.project.meta.backgroundScale : 0;
                    let newW = false, newH = false;
                    if (oldW != w) [oldW, newW] = [w, true];
                    if (oldH != h) [oldH, newH] = [h, true];
                    this.globalScale = 1;
                    if (state.eRender instanceof HTMLDivElement) {
                        let parent = state.eRender.parentElement;
                        let rParent = document.body.getBoundingClientRect();
                        if (parent instanceof HTMLElement) {
                            let r = rParent = parent.getBoundingClientRect();
                            this.globalScale = Math.min((r.width-(padding*2)) / w, (r.height-(padding*2)) / h);
                        }
                        state.eRender.style.width = (w*this.globalScale)+"px";
                        state.eRender.style.height = (h*this.globalScale)+"px";
                        let r = state.eRender.getBoundingClientRect();
                        let xGrid = Array.from(state.eRender.querySelectorAll(":scope > .grid.x"));
                        let nXGrid = xGrid.length;
                        while (nXGrid < Math.max(0, Math.ceil(h/100)-1)) {
                            nXGrid++;
                            let grid = document.createElement("div");
                            grid.classList.add("grid");
                            grid.classList.add("x");
                            if (state.eRender.children.length > 0) state.eRender.insertBefore(grid, state.eRender.children[0]);
                            else state.eRender.appendChild(grid);
                        }
                        while (nXGrid > Math.max(0, Math.ceil(h/100)-1)) {
                            nXGrid--;
                            xGrid.pop().remove();
                        }
                        Array.from(state.eRender.querySelectorAll(":scope > .grid.x")).forEach((grid, i) => { grid.style.bottom = ((i+1) * (100/h) * (r.height - 4))+"px"; });
                        let yGrid = Array.from(state.eRender.querySelectorAll(":scope > .grid.y"));
                        let nYGrid = yGrid.length;
                        while (nYGrid < Math.max(0, Math.ceil(w/100)-1)) {
                            nYGrid++;
                            let grid = document.createElement("div");
                            grid.classList.add("grid");
                            grid.classList.add("y");
                            if (state.eRender.children.length > 0) state.eRender.insertBefore(grid, state.eRender.children[0]);
                            else state.eRender.appendChild(grid);
                        }
                        while (nYGrid > Math.max(0, Math.ceil(w/100)-1)) {
                            nYGrid--;
                            yGrid.pop().remove();
                        }
                        Array.from(state.eRender.querySelectorAll(":scope > .grid.y")).forEach((grid, i) => { grid.style.left = ((i+1) * (100/w) * (r.width - 4))+"px"; });
                        if (state.eXAxis instanceof HTMLDivElement) {
                            let axis = state.eXAxis;
                            axis.style.right = ((rParent.left + rParent.width) - r.left) + "px";
                            axis.style.top = (r.top - rParent.top) + "px";
                            axis.style.height = (r.height - 4) + "px";
                            if (newH) {
                                axis.innerHTML = "";
                                for (let i = 0; i <= h/100; i++) {
                                    let mark = document.createElement("div");
                                    mark.style.bottom = ((i * 100 / h) * 100) + "%";
                                    mark.style.right = "10px";
                                    mark.style.transform = "translateY(50%)";
                                    mark.style.textAlign = "right";
                                    mark.textContent = ((i%2 == 0) || (i >= h/100)) ? i : "";
                                    axis.appendChild(mark);
                                }
                            }
                        }
                        if (state.eYAxis instanceof HTMLDivElement) {
                            let axis = state.eYAxis;
                            axis.style.top = ((r.top + r.height) - rParent.top) + "px";
                            axis.style.left = (r.left - rParent.left) + "px";
                            axis.style.width = (r.width - 4) + "px";
                            if (newW) {
                                axis.innerHTML = "";
                                for (let i = 0; i <= w/100; i++) {
                                    let mark = document.createElement("div");
                                    mark.style.left = ((i * 100 / w) * 100) + "%";
                                    mark.style.top = "10px";
                                    mark.style.transform = "translateX(-50%)";
                                    mark.style.textAlign = "center";
                                    mark.textContent = ((i%2 == 0) || (i >= w/100)) ? i : "";
                                    axis.appendChild(mark);
                                }
                            }
                        }
                        state.eRender.style.setProperty("--scale", this.globalScale);
                    }
                    let itmsUsed = new Set();
                    this.getRenderItems().forEach(itm => {
                        itm.update();
                        if (itm instanceof RISelectable) {
                            if (itm.ghost) return;
                            if (!this.hasProject() || !this.project.hasItem(itm.item))
                                itm.item = null;
                            if (itm.hasItem()) {
                                itmsUsed.add(itm.item.id);
                                itm.selected = isSelected(itm);
                            } else this.remRenderItem(itm);
                        } 
                    });
                    if (this.hasProject()) {
                        let need;
                        need = new Set(this.project.items);
                        if (itmsUsed.size < need.size) {
                            itmsUsed.forEach(id => need.delete(id));
                            need.forEach(id => this.addRenderItem(new RISelectable(this.project.getItem(id))));
                        }
                    }
                });
                state.cut = async () => {
                    await state.copy();
                    getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).forEach(id => this.project.remItem(id));
                    state.post("refresh-selectitem");
                    state.post("refresh-options");
                };
                state.copy = async () => {
                    let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                    if (itms.length <= 0) return;
                    let itm = new ClipboardItem({ "text/plain": new Blob([util.MAGIC+JSON.stringify(itms)], { type: "text/plain" })});
                    await navigator.clipboard.write([itm]);
                    return true;
                };
                state.paste = async () => {
                    let itms = await navigator.clipboard.read();
                    itms.forEach(itm => {
                        itm.types.forEach(async type => {
                            if (type != "text/plain") return;
                            let blob = await itm.getType(type);
                            let text = await blob.text();
                            if (!text.startsWith(util.MAGIC)) return;
                            text = text.substring(util.MAGIC.length);
                            try {
                                let data = JSON.parse(text, subcore.REVIVER.f);
                                if (!util.is(data, "arr")) return;
                                if (!this.hasProject()) return;
                                data.forEach(itm => this.project.addItem(itm));
                            } catch (e) {}
                        });
                    });
                    return true;
                };
                if (!(state.elem instanceof HTMLDivElement)) return;
                state.eDisplay = state.elem.querySelector(":scope > .display");
                if (state.eDisplay instanceof HTMLDivElement) {
                    state.eDisplay.addEventListener("keydown", e => {
                        if (getChoosing()) return;
                        if (!this.hasProject()) return;
                        if (["Backspace", "Delete"].includes(e.code)) {
                            getSelected().forEach(id => this.project.remItem(id));
                            setSelected(getSelected());
                        } else if (e.code == "KeyA") {
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                setSelected(this.project.items);
                            }
                        } else if (e.code == "KeyX") {
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                state.cut();
                            }
                        } else if (e.code == "KeyC") {
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                state.copy();
                            }
                        } else if (e.code == "KeyV") {
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                state.paste();
                            }
                        }
                    });
                }
                let chooseData = null;
                let choosing = null;
                const getChoosing = () => choosing;
                const setChoosing = v => {
                    v = !!v;
                    if (getChoosing() == v) return true;
                    clearSelected();
                    choosing = v;
                    chooseData = choosing ? new core.Target() : null;
                    if (choosing)
                        chooseData.temp = [];
                    choosing ? state.eDisplay.classList.add("choose") : state.eDisplay.classList.remove("choose");
                    return true;
                };
                const getChooseData = () => chooseData;
                state.eChooseDoneBtn = state.elem.querySelector(":scope > .display > .render > .nav > button#donebtn");
                state.eChooseCancelBtn = state.elem.querySelector(":scope > .display > .render > .nav > button#cancelbtn");
                if (state.eChooseDoneBtn instanceof HTMLButtonElement)
                    state.eChooseDoneBtn.addEventListener("click", e => {
                        let chooseData = util.ensure(getChooseData(), "obj");
                        util.ensure((chooseData.temp), "arr").forEach(itm => this.remRenderItem(itm));
                        chooseData.post("done", null);
                        setChoosing(false);
                    });
                if (state.eChooseCancelBtn instanceof HTMLButtonElement)
                    state.eChooseCancelBtn.addEventListener("click", e => {
                        let chooseData = util.ensure(getChooseData(), "obj");
                        util.ensure((chooseData.temp), "arr").forEach(itm => this.remRenderItem(itm));
                        chooseData.post("cancel", null);
                        setChoosing(false);
                    });
                let dragData = null;
                let dragging = null;
                const getDragging = () => dragging;
                const setDragging = v => {
                    v = !!v;
                    if (getDragging() == v) return true;
                    dragging = v;
                    dragData = dragging ? new core.Target() : null;
                    if (dragging) {
                        dragData.elem = document.getElementById("drag");
                        const mouseup = () => {
                            document.body.removeEventListener("mouseup", mouseup);
                            document.body.removeEventListener("mousemove", mousemove);
                            dragData.post("stop", null);
                            setDragging(false);
                        };
                        const mousemove = e => {
                            placeDrag(e.pageX, e.pageY);
                            dragData.post("move", null);
                        };
                        document.body.addEventListener("mouseup", mouseup);
                        document.body.addEventListener("mousemove", mousemove);
                    }
                };
                const placeDrag = (...v) => {
                    v = new V(...v);
                    if (!getDragging()) return false;
                    if (dragData.elem instanceof HTMLDivElement) {
                        dragData.elem.style.left = v.x+"px";
                        dragData.elem.style.top = v.y+"px";
                    }
                    dragData.post("place", { pos: v });
                    return true;
                };
                const getDragData = () => dragData;
                state.eRender = state.elem.querySelector(":scope > .display > .render");
                if (state.eRender instanceof HTMLDivElement)
                    state.eRender.addEventListener("mousedown", e => {
                        if (getChoosing()) return;
                        if (e.button != 0) return;
                        if (e.target == state.eRender || selected.size <= 0) {
                            clearSelected();
                            let selectItem = this.addRenderItem(new RISelect());
                            selectItem.a = selectItem.pageToMap(e.pageX, e.pageY);
                            selectItem.b = selectItem.a;
                            const mouseup = () => {
                                document.body.removeEventListener("mouseup", mouseup);
                                document.body.removeEventListener("mousemove", mousemove);
                                this.remRenderItem(selectItem);
                                let a = selectItem.a, b = selectItem.b;
                                let r = new util.Rect(a, b.sub(a)).normalize();
                                if (!this.hasProject()) return;
                                this.project.items.forEach(id => {
                                    let itm = this.project.getItem(id);
                                    if (r.collides(itm.getBBox())) addSelected(itm);
                                });
                            };
                            const mousemove = e => {
                                selectItem.b = selectItem.pageToMap(e.pageX, e.pageY);
                            };
                            document.body.addEventListener("mouseup", mouseup);
                            document.body.addEventListener("mousemove", mousemove);
                        } else {
                            let selectItem = this.addRenderItem(new RISelect());
                            selectItem.show = false;
                            let oldPos = selectItem.pageToMap(e.pageX, e.pageY);
                            const mouseup = () => {
                                document.body.removeEventListener("mouseup", mouseup);
                                document.body.removeEventListener("mousemove", mousemove);
                                this.remRenderItem(selectItem);
                            };
                            const mousemove = e => {
                                let newPos = selectItem.pageToMap(e.pageX, e.pageY);
                                let rel = newPos.sub(oldPos);
                                getSelected().forEach(id => {
                                    if (!this.hasProject() || !this.project.hasItem(id)) return;
                                    let itm = this.project.getItem(id);
                                    itm.pos.iadd(rel);
                                    itm.post("change", null);
                                });
                                oldPos.set(newPos);
                                state.post("refresh-selectitem", null);
                                state.post("refresh-options", null);
                            };
                            document.body.addEventListener("mouseup", mouseup);
                            document.body.addEventListener("mousemove", mousemove);
                        }
                    });
                state.eXAxis = state.elem.querySelector(":scope > .display > .axis.x");
                state.eYAxis = state.elem.querySelector(":scope > .display > .axis.y");
                state.eEdit = state.elem.querySelector(":scope > .edit");
                let divPos = null;
                state.getDivPos = () => divPos;
                state.setDivPos = v => {
                    v = Math.min(1, Math.max(0, util.ensure(v, "num")));
                    if (state.getDivPos() == v) return true;
                    if (state.eDisplay instanceof HTMLDivElement)
                        state.eDisplay.style.width = "calc("+(v*100)+"% - 6px)";
                    if (state.eEdit instanceof HTMLDivElement)
                        state.eEdit.style.width = "calc("+((1-v)*100)+"% - 6px)";
                };
                state.eDivider = state.elem.querySelector(":scope > .divider");
                if (state.eDivider instanceof HTMLDivElement)
                    state.eDivider.addEventListener("mousedown", e => {
                        if (getChoosing()) return;
                        if (e.button != 0) return;
                        const mouseup = () => {
                            document.body.removeEventListener("mouseup", mouseup);
                            document.body.removeEventListener("mousemove", mousemove);
                            state.eDivider.classList.remove("this");
                        };
                        const mousemove = e => {
                            let parent = state.eDivider.parentElement;
                            if (!(parent instanceof HTMLDivElement)) return;
                            let r = parent.getBoundingClientRect();
                            state.setDivPos(Math.min(0.9, Math.max(0.1, (e.pageX-r.left) / r.width)));
                        };
                        document.body.addEventListener("mouseup", mouseup);
                        document.body.addEventListener("mousemove", mousemove);
                        state.eDivider.classList.add("this");
                    });
                state.options = {
                    map: (o, elem) => {
                        this.addHandler("project-set", data => {
                            let has = this.hasProject();
                            o.btn.disabled = !has;
                            if (util.is(o.spawns, "obj"))
                                for (let name in o.spawns)
                                    o.spawns[name].disabled = !has;
                            if (o.eSizeWInput instanceof HTMLInputElement)
                                o.eSizeWInput.disabled = !has;
                            if (o.eSizeHInput instanceof HTMLInputElement)
                                o.eSizeHInput.disabled = !has;
                            if (o.eRobotSizeWInput instanceof HTMLInputElement)
                                o.eRobotSizeWInput.disabled = !has;
                            if (o.eRobotSizeHInput instanceof HTMLInputElement)
                                o.eRobotSizeHInput.disabled = !has;
                            if (o.eRobotMassInput instanceof HTMLInputElement)
                                o.eRobotMassInput.disabled = !has;
                            if (o.eBackgroundXInput instanceof HTMLInputElement)
                                o.eBackgroundXInput.disabled = !has;
                            if (o.eBackgroundYInput instanceof HTMLInputElement)
                                o.eBackgroundYInput.disabled = !has;
                            if (o.eBackgroundScaleInput instanceof HTMLInputElement)
                                o.eBackgroundScaleInput.disabled = !has;
                        });
                        state.addHandler("refresh-options", data => {
                            let has = this.hasProject();
                            if (o.eSizeWInput instanceof HTMLInputElement)
                                o.eSizeWInput.value = has ? this.project.w/100 : "";
                            if (o.eSizeHInput instanceof HTMLInputElement)
                                o.eSizeHInput.value = has ? this.project.h/100 : "";
                            if (o.eRobotSizeWInput instanceof HTMLInputElement)
                                o.eRobotSizeWInput.value = has ? this.project.robotW/100 : "";
                            if (o.eRobotSizeHInput instanceof HTMLInputElement)
                                o.eRobotSizeHInput.value = has ? this.project.robotH/100 : "";
                            if (o.eRobotMassInput instanceof HTMLInputElement)
                                o.eRobotMassInput.value = has ? this.project.robotMass : "";
                            if (o.eBackgroundXInput instanceof HTMLInputElement)
                                o.eBackgroundXInput.value = has ? this.project.meta.backgroundX/100 : "";
                            if (o.eBackgroundYInput instanceof HTMLInputElement)
                                o.eBackgroundYInput.value = has ? this.project.meta.backgroundY/100 : "";
                            if (o.eBackgroundScaleInput instanceof HTMLInputElement)
                                o.eBackgroundScaleInput.value = has ? this.project.meta.backgroundScale*100 : "";
                        });
                        o.eSpawnBox = elem.querySelector(":scope #spawnbox");
                        if (o.eSpawnBox instanceof HTMLDivElement) {
                            o.eSpawnDelete = o.eSpawnBox.querySelector(":scope > button.delete");
                            o.spawns = {};
                            ["node", "obstacle"].forEach(name => {
                                let btn = o.spawns[name] = o.eSpawnBox.querySelector(":scope > button.item#spawn"+name);
                                if (btn instanceof HTMLButtonElement) {
                                    btn.trigger = e => {
                                        if (getChoosing()) return;
                                        if (getDragging()) return;
                                        setDragging(true);
                                        let dragData = getDragData();
                                        dragData.name = name;
                                        if (dragData.elem instanceof HTMLDivElement)
                                            dragData.elem.innerHTML = {
                                                node: "<div class='global item selectable node'><div class='button'></div></div>",
                                                obstacle: "<div class='global item selectable obstacle'><div class='button'></div><div class='radius'></div><div class='button radiusdrag'></div></div>"
                                            }[name];
                                        if (e instanceof MouseEvent)
                                            placeDrag(e.pageX, e.pageY);
                                        let prevOver = false;
                                        let ghostItem = null;
                                        let item = {
                                            node: new subcore.Project.Node(
                                                0,
                                                0, true,
                                                0, 0, false,
                                            ),
                                            obstacle: new subcore.Project.Obstacle(0, 100),
                                        }[name];
                                        dragData.addHandler("place", data => {
                                            if (!(state.eRender instanceof HTMLDivElement)) return;
                                            let pos = new V(util.ensure(data, "obj").pos);
                                            let r, over;
                                            r = state.eRender.getBoundingClientRect();
                                            over = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                                            if (prevOver != over) {
                                                prevOver = over;
                                                if (over) {
                                                    ghostItem = this.addRenderItem(new RISelectable(item));
                                                    ghostItem.ghost = true;
                                                    if (dragData.elem instanceof HTMLDivElement)
                                                        if (dragData.elem.children[0] instanceof HTMLDivElement)
                                                            dragData.elem.children[0].style.visibility = "hidden";
                                                } else {
                                                    this.remRenderItem(ghostItem);
                                                    ghostItem = null;
                                                    if (dragData.elem instanceof HTMLDivElement)
                                                        if (dragData.elem.children[0] instanceof HTMLDivElement)
                                                            dragData.elem.children[0].style.visibility = "inherit";
                                                }
                                            }
                                            if (ghostItem instanceof RISelectable)
                                                if (ghostItem.hasItem())
                                                    ghostItem.item.pos.set(ghostItem.pageToMap(pos));
                                            if (!(o.eSpawnDelete instanceof HTMLButtonElement)) return;
                                            r = o.eSpawnDelete.getBoundingClientRect();
                                            over = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                                            if (over) o.eSpawnDelete.classList.add("hover");
                                            else o.eSpawnDelete.classList.remove("hover");
                                            
                                        });
                                        dragData.addHandler("stop", data => {
                                            this.remRenderItem(ghostItem);
                                            if (dragData.elem instanceof HTMLDivElement)
                                                dragData.elem.innerHTML = "";
                                            if (ghostItem instanceof RISelectable)
                                                if (ghostItem.hasItem())
                                                    if (this.hasProject())
                                                        this.project.addItem(ghostItem.item);
                                            o.eSpawnBox.classList.remove("delete");
                                        });
                                        o.eSpawnBox.classList.add("delete");
                                    };
                                    btn.addEventListener("mousedown", btn.trigger);
                                }
                            });
                        }
                        o.eSizeBox = elem.querySelector(":scope #size");
                        if (o.eSizeBox instanceof HTMLDivElement) {
                            o.eSizeWInput = o.eSizeBox.querySelector(":scope > input.w");
                            o.eSizeHInput = o.eSizeBox.querySelector(":scope > input.h");
                            if (o.eSizeWInput instanceof HTMLInputElement)
                                o.eSizeWInput.addEventListener("change", e => {
                                    let v = o.eSizeWInput.value;
                                    if (v.length > 0) {
                                        v = Math.max(util.ensure(parseFloat(v), "num"));
                                        if (this.hasProject()) {
                                            this.project.w = v*100;
                                            this.project.post("change", null);
                                            state.post("refresh-selectitem");
                                        }
                                    }
                                    state.post("refresh-options", null);
                                });
                            if (o.eSizeHInput instanceof HTMLInputElement)
                                o.eSizeHInput.addEventListener("change", e => {
                                    let v = o.eSizeHInput.value;
                                    if (v.length > 0) {
                                        v = Math.max(util.ensure(parseFloat(v), "num"));
                                        if (this.hasProject()) {
                                            this.project.h = v*100;
                                            this.project.post("change", null);
                                            state.post("refresh-selectitem");
                                        }
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eRobotSizeBox = elem.querySelector(":scope #robotsize");
                        if (o.eRobotSizeBox instanceof HTMLDivElement) {
                            o.eRobotSizeWInput = o.eRobotSizeBox.querySelector(":scope > input.w");
                            o.eRobotSizeHInput = o.eRobotSizeBox.querySelector(":scope > input.h");
                            if (o.eRobotSizeWInput instanceof HTMLInputElement)
                                o.eRobotSizeWInput.addEventListener("change", e => {
                                    let v = o.eRobotSizeWInput.value;
                                    if (v.length > 0) {
                                        v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                        if (this.hasProject()) {
                                            this.project.robotW = v*100;
                                            this.project.post("change", null);
                                            state.post("refresh-selectitem");
                                        }
                                    }
                                    state.post("refresh-options", null);
                                });
                            if (o.eRobotSizeHInput instanceof HTMLInputElement)
                                o.eRobotSizeHInput.addEventListener("change", e => {
                                    let v = o.eRobotSizeHInput.value;
                                    if (v.length > 0) {
                                        v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                        if (this.hasProject()) {
                                            this.project.robotH = v*100;
                                            this.project.post("change", null);
                                        }
                                        state.post("refresh-selectitem");
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eRobotMassBox = elem.querySelector(":scope #robotmass");
                        if (o.eRobotMassBox instanceof HTMLDivElement) {
                            o.eRobotMassInput = o.eRobotMassBox.querySelector(":scope > input");
                            if (o.eRobotMassInput instanceof HTMLInputElement)
                                o.eRobotMassInput.addEventListener("change", e => {
                                    let v = o.eRobotMassInput.value;
                                    if (v.length > 0) {
                                        v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                        if (this.hasProject())
                                            this.project.robotMass = v;
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eBackgroundBox = elem.querySelector(":scope #background");
                        if (o.eBackgroundBox instanceof HTMLDivElement) {
                            o.eBackgroundXInput = o.eBackgroundBox.querySelector(":scope > div > input.x");
                            if (o.eBackgroundXInput instanceof HTMLInputElement)
                                o.eBackgroundXInput.addEventListener("change", e => {
                                    let v = o.eBackgroundXInput.value;
                                    if (v.length > 0) {
                                        v = util.ensure(parseFloat(v), "num");
                                        if (this.hasProject()) {
                                            this.project.meta.backgroundX = v*100;
                                            this.project.post("change", null);
                                        }
                                    }
                                    state.post("refresh-options", null);
                                });
                            o.eBackgroundYInput = o.eBackgroundBox.querySelector(":scope > div > input.y");
                            if (o.eBackgroundYInput instanceof HTMLInputElement)
                                o.eBackgroundYInput.addEventListener("change", e => {
                                    let v = o.eBackgroundYInput.value;
                                    if (v.length > 0) {
                                        v = util.ensure(parseFloat(v), "num");
                                        if (this.hasProject()) {
                                            this.project.meta.backgroundY = v*100;
                                            this.project.post("change", null);
                                        }
                                    }
                                    state.post("refresh-options", null);
                                });
                            o.eBackgroundScaleInput = o.eBackgroundBox.querySelector(":scope > input");
                            if (o.eBackgroundScaleInput instanceof HTMLInputElement)
                                o.eBackgroundScaleInput.addEventListener("change", e => {
                                    let v = o.eBackgroundScaleInput.value;
                                    if (v.length > 0) {
                                        v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                        if (this.hasProject())
                                            this.project.meta.backgroundScale = v/100;
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                    },
                    trajectory: (o, elem) => {
                        let generating = false;
                        o.getGenerating = () => generating;
                        o.setGenerating = v => {
                            v = !!v;
                            if (v == o.getGenerating()) return true;
                            generating = v;
                            state.post("refresh-options", null);
                            return true;
                        };
                        this.addHandler("project-set", data => {
                            let has = this.hasProject();
                            o.btn.disabled = !has;
                            if (o.eMomentOfInertiaInput instanceof HTMLInputElement)
                                o.eMomentOfInertiaInput.disabled = !has;
                            if (o.eEfficiencyInput instanceof HTMLInputElement)
                                o.eEfficiencyInput.disabled = !has;
                            if (o.eIs12MotorModeInput instanceof HTMLInputElement)
                                o.eIs12MotorModeInput.disabled = !has;
                            if (o.eScriptInput instanceof HTMLInputElement)
                                o.eScriptInput.disabled = !has;
                            if (o.eScriptBrowse instanceof HTMLInputElement)
                                o.eScriptBrowse.disabled = !has;
                            o.checkPathVisual();
                        });
                        state.addHandler("refresh-options", data => {
                            let has = this.hasProject();
                            if (o.eMomentOfInertiaInput instanceof HTMLInputElement)
                                o.eMomentOfInertiaInput.value = has ? this.project.config.momentOfInertia : "";
                            if (o.eEfficiencyInput instanceof HTMLInputElement)
                                o.eEfficiencyInput.value = has ? this.project.config.efficiency*100 : "";
                            if (o.eIs12MotorModeInput instanceof HTMLInputElement)
                                o.eIs12MotorModeInput.checked = has ? this.project.config.is12MotorMode : false;
                            if (o.eScriptInput instanceof HTMLInputElement)
                                o.eScriptInput.value = has ? this.project.config.script : "";
                            if (o.eGenerationBtn instanceof HTMLButtonElement) {
                                o.eGenerationBtn.disabled = !o.getGenerating() && (!has || getSelectedPaths().length <= 0);
                                o.eGenerationBtn.textContent = o.getGenerating() ? "Terminate" : "Generate";
                                o.getGenerating() ? o.eGenerationBtn.classList.add("term") : o.eGenerationBtn.classList.remove("term");
                            }
                        });
                        o.eMomentOfInertiaBox = elem.querySelector(":scope #momentofinertia");
                        if (o.eMomentOfInertiaBox instanceof HTMLDivElement) {
                            o.eMomentOfInertiaInput = o.eMomentOfInertiaBox.querySelector(":scope > input");
                            if (o.eMomentOfInertiaInput instanceof HTMLInputElement)
                                o.eMomentOfInertiaInput.addEventListener("change", e => {
                                    let v = o.eMomentOfInertiaInput.value;
                                    if (v.length > 0) {
                                        v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                        if (this.hasProject())
                                            this.project.config.momentOfInertia = v;
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eEfficiencyBox = elem.querySelector(":scope #efficiency");
                        if (o.eEfficiencyBox instanceof HTMLDivElement) {
                            o.eEfficiencyInput = o.eEfficiencyBox.querySelector(":scope > input");
                            if (o.eEfficiencyInput instanceof HTMLInputElement)
                                o.eEfficiencyInput.addEventListener("change", e => {
                                    let v = o.eEfficiencyInput.value;
                                    if (v.length > 0) {
                                        v = Math.min(100, Math.max(0, util.ensure(parseFloat(v), "num")));
                                        if (this.hasProject())
                                            this.project.config.efficiency = v/100;
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eIs12MotorModeBox = elem.querySelector(":scope #is12motormode");
                        if (o.eIs12MotorModeBox instanceof HTMLLabelElement) {
                            o.eIs12MotorModeInput = o.eIs12MotorModeBox.querySelector("input[type='checkbox']");
                            if (o.eIs12MotorModeInput instanceof HTMLInputElement)
                                o.eIs12MotorModeInput.addEventListener("change", e => {
                                    let v = o.eIs12MotorModeInput.checked;
                                    this.project.config.is12MotorMode = v;
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eScriptBox = elem.querySelector(":scope #trajectoryscript");
                        if (o.eScriptBox instanceof HTMLDivElement) {
                            o.eScriptInput = o.eScriptBox.querySelector(":scope > .filedialog > input");
                            if (o.eScriptInput instanceof HTMLInputElement)
                                o.eScriptInput.addEventListener("change", e => {
                                    let v = o.eScriptInput.value;
                                    if (this.hasProject())
                                        this.project.config.script = (v.length > 0) ? v : null;
                                    state.post("refresh-options", null);
                                });
                            o.eScriptBrowse = o.eScriptBox.querySelector(":scope > .filedialog > button");
                            if (o.eScriptBrowse instanceof HTMLButtonElement)
                                o.eScriptBrowse.addEventListener("click", e => {
                                    let dialog = document.createElement("input");
                                    dialog.type = "file";
                                    dialog.accept = ".py";
                                    dialog.addEventListener("change", e => {
                                        if (o.eScriptInput instanceof HTMLInputElement) {
                                            let v = o.eScriptInput.value = (dialog.files[0] instanceof File) ? dialog.files[0].path : "";
                                            if (this.hasProject())
                                                this.project.config.script = (v.length > 0) ? v : null;
                                            state.post("refresh-options", null);
                                        }
                                    });
                                    dialog.click();
                                });
                        }
                        if (state.eRender instanceof HTMLDivElement) {
                            o.eProgress = state.eRender.querySelector(":scope > .progress");
                            if (o.eProgress instanceof HTMLDivElement) {
                                o.eProgressBtn = o.eProgress.querySelector(":scope > button");
                                if (o.eProgressBtn instanceof HTMLButtonElement)
                                    o.eProgressBtn.addEventListener("click", e => {
                                        let visuals = this.getPathVisuals().filter(id => isPathSelected(id));
                                        if (visuals.length <= 0) return;
                                        let id = visuals[0];
                                        let visual = this.getPathVisual(id);
                                        if (visual.isFinished) {
                                            visual.nowTime = 0;
                                            visual.play();
                                        } else visual.paused = !visual.paused;
                                    });
                                o.eProgressTimeNow = o.eProgress.querySelector(":scope > .time.now");
                                o.eProgressTimeTotal = o.eProgress.querySelector(":scope > .time.total");
                                o.eProgressBar = o.eProgress.querySelector(":scope > .bar");
                                if (o.eProgressBar instanceof HTMLDivElement)
                                    o.eProgressBar.addEventListener("mousedown", e => {
                                        if (getChoosing()) return;
                                        if (e.button != 0) return;
                                        e.stopPropagation();
                                        const mouseup = () => {
                                            document.body.removeEventListener("mouseup", mouseup);
                                            document.body.removeEventListener("mousemove", mousemove);
                                        };
                                        const mousemove = e => {
                                            let r = o.eProgressBar.getBoundingClientRect();
                                            let p = (e.pageX-r.left) / r.width;
                                            let visuals = this.getPathVisuals().filter(id => isPathSelected(id));
                                            if (visuals.length <= 0) return;
                                            let id = visuals[0];
                                            let visual = this.getPathVisual(id);
                                            visual.nowTime = visual.totalTime*p;
                                        };
                                        mousemove(e);
                                        document.body.addEventListener("mouseup", mouseup);
                                        document.body.addEventListener("mousemove", mousemove);
                                    });
                            }
                        }
                        let pathVisuals = {};
                        this.getPathVisuals = () => Object.keys(pathVisuals);
                        this.setPathVisuals = v => {
                            v = util.ensure(v, "obj");
                            this.clearPathVisuals();
                            for (let id in v) this.addPathVisual(id, v[id]);
                            return true;
                        };
                        this.clearPathVisuals = () => {
                            let ids = this.getPathVisuals();
                            ids.forEach(id => this.remPathVisual(id));
                            return ids;
                        };
                        this.hasPathVisual = v => {
                            if (util.is(v, "str")) return v in pathVisuals;
                            if (v instanceof PathVisual) return this.hasPathVisual(v.id);
                            return false;
                        };
                        this.getPathVisual = id => {
                            id = String(id);
                            if (!this.hasPathVisual(id)) return null;
                            return pathVisuals[id];
                        };
                        this.addPathVisual = (id, visual) => {
                            id = String(id);
                            if (!(visual instanceof PathVisual)) return false;
                            if (visual.app != null || visual.id != null) return false;
                            if (this.hasPathVisual(id) || this.hasPathVisual(visual)) return false;
                            pathVisuals[id] = visual;
                            visual.id = id;
                            visual.app = this;
                            return visual;
                        };
                        this.remPathVisual = v => {
                            if (util.is(v, "str")) {
                                if (!this.hasPathVisual(v)) return false;
                                let visual = pathVisuals[v];
                                delete pathVisuals[v];
                                visual.id = null;
                                visual.app = null;
                                return visual;
                            }
                            if (v instanceof PathVisual) return this.remPathVisual(v.id);
                            return false;
                        };
                        this.addHandler("update", data => {
                            let visuals = [];
                            this.getPathVisuals().forEach(id => {
                                let visual = this.getPathVisual(id);
                                visual.show = isPathSelected(id);
                                if (visual.show) visuals.push(id);
                                visual.update();
                                if (!this.hasProject() || !this.project.hasPath(id))
                                    this.remPathVisual(id);
                            });
                            if (visuals.length <= 0) {
                                if (state.eDisplay instanceof HTMLDivElement)
                                    state.eDisplay.classList.remove("progress");
                                return;
                            }
                            if (state.eDisplay instanceof HTMLDivElement)
                                state.eDisplay.classList.add("progress");
                            let id = visuals[0];
                            let visual = this.getPathVisual(id);
                            if (o.eProgress instanceof HTMLDivElement)
                                o.eProgress.style.setProperty("--progress", (100*visual.item.interp)+"%");
                            if (o.eProgressBtn instanceof HTMLButtonElement)
                                if (o.eProgressBtn.children[0] instanceof HTMLElement)
                                    o.eProgressBtn.children[0].setAttribute("name", visual.isFinished ? "refresh" : visual.paused ? "play" : "pause");
                            if (o.eProgressTimeNow instanceof HTMLDivElement) {
                                let split = util.splitTimeUnits(visual.nowTime);
                                split[0] = Math.round(split[0]);
                                while (split.length > 3) {
                                    if (split.at(-1) > 0) break;
                                    split.pop();
                                }
                                split = split.map((v, i) => {
                                    v = String(v);
                                    if (i >= split.length-1) return v;
                                    let l = String(Object.values(util.UNITVALUES)[i+1]).length;
                                    while (v.length < l) {
                                        if (i > 0) v = "0"+v;
                                        else v += "0";
                                    }
                                    return v;
                                });
                                o.eProgressTimeNow.textContent = split.slice(1).reverse().join(":")+"."+split[0];
                            }
                            if (o.eProgressTimeTotal instanceof HTMLDivElement) {
                                let split = util.splitTimeUnits(visual.totalTime);
                                split[0] = Math.round(split[0]);
                                while (split.length > 3) {
                                    if (split.at(-1) > 0) break;
                                    split.pop();
                                }
                                split = split.map((v, i) => {
                                    v = String(v);
                                    if (i >= split.length-1) return v;
                                    let l = String(Object.values(util.UNITVALUES)[i+1]).length;
                                    while (v.length < l) {
                                        if (i > 0) v = "0"+v;
                                        else v += "0";
                                    }
                                    return v;
                                });
                                o.eProgressTimeTotal.textContent = split.slice(1).reverse().join(":")+"."+split[0];
                            }
                        });
                        o.checkPathVisual = async () => {
                            this.clearPathVisuals();
                            if (!this.hasProject()) return;
                            try {
                                let datas = await window.api.ask("exec-get", [this.projectId]);
                                if (!util.is(datas, "obj")) return;
                                for (let id in datas) {
                                    let data = datas[id];
                                    if (!util.is(data, "obj")) continue;
                                    console.log(data);
                                    let visual = this.addPathVisual(id, new PathVisual());
                                    visual.visual.dt = data.dt*1000;
                                    visual.visual.nodes = util.ensure(data.state, "arr").map(node => {
                                        node = util.ensure(node, "obj");
                                        node = new subcore.Project.Node(
                                            new V(node.x, node.y).mul(100),
                                            node.theta, true,
                                            new V(node.vx, node.vy).mul(100),
                                            0, true,
                                        );
                                        return node;
                                    });
                                }
                            } catch (e) {
                                let alert = this.alert("There was an error checking for generated trajectories!", "warning");
                                alert.hasInfo = true;
                                alert.info = String(e);
                                alert.iconColor = "var(--cr)";
                            }
                        };
                        o.eGenerationBox = elem.querySelector(":scope #trajectorygeneration");
                        if (o.eGenerationBox instanceof HTMLDivElement) {
                            o.eGenerationBtn = o.eGenerationBox.querySelector(":scope > button");
                            if (o.eGenerationBtn instanceof HTMLButtonElement)
                                o.eGenerationBtn.addEventListener("click", e => {
                                    if (o.getGenerating()) {
                                        window.api.ask("exec-term");
                                        return;
                                    }
                                    let projectId = this.projectId;
                                    if (!this.hasProject(projectId)) return;
                                    let project = this.getProject(projectId);
                                    if (getSelectedPaths().length <= 0) return;
                                    let id = getSelectedPaths()[0];
                                    if (!project.hasPath(id)) return;
                                    let path = project.getPath(id);
                                    e.stopPropagation();
                                    o.setGenerating(false);
                                    (async () => {
                                        o.setGenerating(true);
                                        this.markChange("*all");
                                        try {
                                            await this.syncFilesWith();
                                        } catch (e) {
                                            let alert = this.alert("There was an error saving your projects!", "warning");
                                            alert.hasInfo = true;
                                            alert.info = String(e);
                                            alert.iconColor = "var(--cr)";
                                        }
                                        try {
                                            await window.api.ask("exec", [project.id, path.id]);
                                            await o.checkPathVisual();
                                            this.getPathVisuals().forEach(id => {
                                                let visual = this.getPathVisual(id);
                                                if (!isPathSelected(id)) return;
                                                visual.play();
                                            });
                                            o.setGenerating(false);
                                        } catch (e) {
                                            o.setGenerating(false);
                                            let alert = this.alert("There was an error executing the generation script!", "warning");
                                            alert.hasInfo = true;
                                            alert.info = String(e);
                                            alert.iconColor = "var(--cr)";
                                        }
                                    })();
                                });
                        }
                    },
                    path: (o, elem) => {
                        let buttons = new Set();
                        document.body.addEventListener("click", e => {
                            if (getChoosing()) return;
                            if (state.eRender instanceof HTMLDivElement && state.eRender.contains(e.target)) return;
                            clearSelectedPaths();
                        });
                        this.getPathButtons = () => [...buttons];
                        this.setPathButtons = v => {
                            v = util.ensure(v, "arr");
                            this.clearPathButtons();
                            v.forEach(v => this.addPathButton(v));
                        };
                        this.clearPathButtons = () => {
                            let pths = this.getPathButtons();
                            pths.forEach(btn => this.remPathButton(btn));
                            return pths;
                        };
                        this.hasPathButton = btn => {
                            if (!(btn instanceof PathButton)) return false;
                            return buttons.has(btn);
                        };
                        this.addPathButton = btn => {
                            if (!(btn instanceof PathButton)) return false;
                            if (this.hasPathButton(btn)) return false;
                            buttons.add(btn);
                            btn.app = this;
                            btn._onTrigger = () => {
                                clearSelectedPaths();
                                addSelectedPath(btn);
                            };
                            btn._onChange = () => {
                                state.post("refresh-selectitem", null);
                                state.post("refresh-options", null);
                            };
                            btn.addHandler("trigger", btn._onTrigger);
                            btn.addHandler("change", btn._onChange);
                            if (o.ePathsBox instanceof HTMLDivElement) o.ePathsBox.appendChild(btn.elem);
                            state.post("refresh-options", null);
                            return btn;
                        };
                        this.remPathButton = btn => {
                            if (!(btn instanceof PathButton)) return false;
                            if (!this.hasPathButton(btn)) return false;
                            buttons.delete(btn);
                            btn.remHandler(btn._onTrigger);
                            btn.remHandler(btn._onChange);
                            delete btn._onTrigger;
                            delete btn._onChange;
                            btn.post("rem", null);
                            if (o.ePathsBox instanceof HTMLDivElement) o.ePathsBox.removeChild(btn.elem);
                            btn.app = null;
                            state.post("refresh-options", null);
                            return btn;
                        };
                        this.addHandler("update", data => {
                            let pthsUsed = new Set();
                            this.getPathButtons().forEach(btn => {
                                btn.update();
                                if (!this.hasProject() || !this.project.hasPath(btn.path))
                                    btn.path = null;
                                if (btn.hasPath()) {
                                    pthsUsed.add(btn.path.id);
                                    btn.selected = isPathSelected(btn);
                                } else this.remPathButton(btn);
                            });
                            if (this.hasProject()) {
                                let need;
                                need = new Set(this.project.paths);
                                if (pthsUsed.size < need.size) {
                                    pthsUsed.forEach(id => need.delete(id));
                                    need.forEach(id => this.addPathButton(new PathButton(this.project.getPath(id))));
                                }
                            }
                        });
                        this.addHandler("project-set", data => {
                            let has = this.hasProject();
                            o.btn.disabled = !has;
                            if (o.ePathAdd instanceof HTMLButtonElement)
                                o.ePathAdd.disabled = !has;
                        });
                        state.addHandler("refresh-options", data => {
                            let has = this.hasProject();
                            if (o.ePathRem instanceof HTMLButtonElement)
                                o.ePathRem.disabled = !has || (getSelectedPaths().length <= 0);
                            if (o.ePathEdit instanceof HTMLButtonElement)
                                o.ePathEdit.disabled = !has || (getSelectedPaths().length <= 0);
                            this.getPathButtons().forEach(btn => {
                                btn.post("set", data);
                                if (isPathSelected(btn)) btn.post("add", null);
                                else btn.post("rem", null);
                            });
                        });
                        o.ePathsBox = elem.querySelector(":scope #pathsbox");
                        if (o.ePathsBox instanceof HTMLDivElement) {
                            o.ePathAdd = o.ePathsBox.querySelector(":scope > button.item#addbtn");
                            if (o.ePathAdd instanceof HTMLButtonElement)
                                o.ePathAdd.addEventListener("click", e => {
                                    if (getChoosing()) return;
                                    if (!this.hasProject()) return;
                                    setChoosing(true);
                                    let chooseData = getChooseData();
                                    chooseData.path = new subcore.Project.Path();
                                    chooseData.addHandler("choose", data => {
                                        if (!(chooseData.path instanceof subcore.Project.Path)) return;
                                        let path = chooseData.path;
                                        data = util.ensure(data, "obj");
                                        let itm = data.itm;
                                        if (!(itm instanceof subcore.Project.Node)) return;
                                        if (path.hasNode(itm)) path.remNode(itm);
                                        else path.addNode(itm);
                                        util.ensure(chooseData.temp, "arr").forEach(itm => this.remRenderItem(itm));
                                        chooseData.temp = [];
                                        let nodes = path.nodes.filter(id => this.hasProject() && this.project.hasItem(id));
                                        for (let i = 0; i < nodes.length; i++) {
                                            let id = nodes[i];
                                            let node = this.project.getItem(id);
                                            chooseData.temp.push(this.addRenderItem(new RIPathIndex(node)));
                                            chooseData.temp.at(-1).value = i+1;
                                            if (i > 0) {
                                                let id2 = nodes[i-1];
                                                let node2 = this.project.getItem(id2);
                                                chooseData.temp.push(this.addRenderItem(new RIPathLine(node, node2)));
                                            }
                                        }
                                    });
                                    chooseData.addHandler("done", data => {
                                        if (!(chooseData.path instanceof subcore.Project.Path)) return;
                                        let path = chooseData.path;
                                        if (!this.hasProject()) return;
                                        this.project.addPath(path);
                                    });
                                    chooseData.addHandler("cancel", data => {
                                    });
                                });
                        }
                        o.ePathEditBox = elem.querySelector(":scope #patheditbox");
                        if (o.ePathEditBox instanceof HTMLDivElement) {
                            o.ePathRem = o.ePathEditBox.querySelector(":scope > button#removebtn");
                            if (o.ePathRem instanceof HTMLButtonElement)
                                o.ePathRem.addEventListener("click", e => {
                                    if (getChoosing()) return;
                                    if (!this.hasProject()) return;
                                    getSelectedPaths().forEach(id => this.project.remPath(id));
                                });
                            o.ePathEdit = o.ePathEditBox.querySelector(":scope > button#editbtn");
                            if (o.ePathEdit instanceof HTMLButtonElement)
                                o.ePathEdit.addEventListener("click", e => {
                                    if (getChoosing()) return;
                                    if (!this.hasProject()) return;
                                    let pths = getSelectedPaths();
                                    if (pths.length <= 0) return;
                                    let id = pths[0];
                                    if (!this.project.hasPath(id)) return;
                                    let pth = this.project.getPath(id);
                                    setChoosing(true);
                                    let chooseData = getChooseData();
                                    chooseData.path = pth;
                                    let nodes = pth.nodes;
                                    chooseData.addHandler("choose", data => {
                                        if (!(chooseData.path instanceof subcore.Project.Path)) return;
                                        let path = chooseData.path;
                                        data = util.ensure(data, "obj");
                                        let itm = data.itm;
                                        if (!(itm instanceof subcore.Project.Node)) return;
                                        if (path.hasNode(itm)) path.remNode(itm);
                                        else path.addNode(itm);
                                        util.ensure(chooseData.temp, "arr").forEach(itm => this.remRenderItem(itm));
                                        chooseData.temp = [];
                                        let nodes = path.nodes.filter(id => this.hasProject() && this.project.hasItem(id));
                                        for (let i = 0; i < nodes.length; i++) {
                                            let id = nodes[i];
                                            let node = this.project.getItem(id);
                                            chooseData.temp.push(this.addRenderItem(new RIPathIndex(node)));
                                            chooseData.temp.at(-1).value = i+1;
                                            if (i > 0) {
                                                let id2 = nodes[i-1];
                                                let node2 = this.project.getItem(id2);
                                                chooseData.temp.push(this.addRenderItem(new RIPathLine(node, node2)));
                                            }
                                        }
                                    });
                                    chooseData.addHandler("done", data => {
                                    });
                                    chooseData.addHandler("cancel", data => {
                                        if (!(chooseData.path instanceof subcore.Project.Path)) return;
                                        chooseData.path.nodes = nodes;
                                    });
                                });
                        }
                    },
                    item: (o, elem) => {
                        this.addHandler("project-set", data => {
                            let has = this.hasProject();
                            if (o.ePositionXInput instanceof HTMLButtonElement)
                                o.ePositionXInput.disabled = !has;
                            if (o.ePositionYInput instanceof HTMLButtonElement)
                                o.ePositionYInput.disabled = !has;
                            if (o.eItemRem instanceof HTMLButtonElement)
                                o.eItemRem.disabled = !has;
                        });
                        state.addHandler("refresh-options", data => {
                            let has = this.hasProject();
                            let forNode = Array.from(elem.querySelectorAll(":scope .fornode"));
                            let forObstacle = Array.from(elem.querySelectorAll(":scope .forobstacle"));
                            let itms = getSelected().filter(id => has && this.project.hasItem(id)).map(id => this.project.getItem(id));
                            o.btn.disabled = !has || itms.length <= 0;
                            let allNode = (itms.length > 0), allObstacle = (itms.length > 0);
                            itms.forEach(itm => {
                                if (!(itm instanceof subcore.Project.Node)) allNode = false;
                                if (!(itm instanceof subcore.Project.Obstacle)) allObstacle = false;
                            });
                            forNode.forEach(elem => (allNode ? elem.classList.add("this") : elem.classList.remove("this")));
                            forObstacle.forEach(elem => (allObstacle ? elem.classList.add("this") : elem.classList.remove("this")));
                            if (o.ePositionXInput instanceof HTMLInputElement) {
                                let x = itms.map(itm => itm.x);
                                let center = (Math.max(...x) + Math.min(...x)) / 2;
                                o.ePositionXInput.value = center/100;
                            }
                            if (o.ePositionYInput instanceof HTMLInputElement) {
                                let y = itms.map(itm => itm.y);
                                let center = (Math.max(...y) + Math.min(...y)) / 2;
                                o.ePositionYInput.value = center/100;
                            }
                            if (o.eHeadingUse instanceof HTMLInputElement) {
                                o.eHeadingUse.disabled = !has || !allNode;
                                if (allNode) {
                                    let same = true, sameValue = null, first = true;
                                    itms.forEach(itm => {
                                        if (!same) return;
                                        if (first) {
                                            first = false;
                                            sameValue = itm.useHeading;
                                            return;
                                        }
                                        if (itm.useHeading != sameValue) same = false;
                                    });
                                    o.eHeadingUse.checked = same ? sameValue : false;
                                } else o.eHeadingUse.checked = false;
                            }
                            if (o.eHeadingBox instanceof HTMLDivElement) {
                                let v = 0;
                                if (allNode) {
                                    let same = true, sameValue = null, first = true;
                                    itms.forEach(itm => {
                                        if (!same) return;
                                        if (first) {
                                            first = false;
                                            sameValue = itm.heading;
                                            return;
                                        }
                                        if (itm.heading != sameValue) same = false;
                                    });
                                    v = same ? sameValue : 0;
                                } else v = 0;
                                o.eHeadingBox.style.setProperty("--dir", (-(180/Math.PI)*v)+"deg");
                            }
                            if (o.eHeadingInput instanceof HTMLInputElement) {
                                o.eHeadingInput.disabled = !has || !allNode || (o.eHeadingUse instanceof HTMLInputElement && !o.eHeadingUse.checked);
                                if (allNode) {
                                    let same = true, sameValue = null, first = true;
                                    itms.forEach(itm => {
                                        if (!same) return;
                                        if (first) {
                                            first = false;
                                            sameValue = itm.heading;
                                            return;
                                        }
                                        if (itm.heading != sameValue) same = false;
                                    });
                                    o.eHeadingInput.value = same ? sameValue : "";
                                } else o.eHeadingInput.value = "";
                            }
                            if (o.eVelocityUse instanceof HTMLInputElement) {
                                o.eVelocityUse.disabled = !has || !allNode;
                                if (allNode) {
                                    let same = true, sameValue = null, first = true;
                                    itms.forEach(itm => {
                                        if (!same) return;
                                        if (first) {
                                            first = false;
                                            sameValue = itm.useVelocity;
                                            return;
                                        }
                                        if (itm.useVelocity != sameValue) same = false;
                                    });
                                    o.eVelocityUse.checked = same ? sameValue : false;
                                } else o.eVelocityUse.checked = false;
                            }
                            if (o.eVelocityXInput instanceof HTMLInputElement) {
                                o.eVelocityXInput.disabled = !has || !allNode || (o.eVelocityUse instanceof HTMLInputElement && !o.eVelocityUse.checked);
                                if (allNode) {
                                    let same = true, sameValue = null, first = true;
                                    itms.forEach(itm => {
                                        if (!same) return;
                                        if (first) {
                                            first = false;
                                            sameValue = itm.velocityX;
                                            return;
                                        }
                                        if (itm.velocityX != sameValue) same = false;
                                    });
                                    o.eVelocityXInput.value = same ? sameValue/100 : "";
                                } else o.eVelocityXInput.value = "";
                            }
                            if (o.eVelocityYInput instanceof HTMLInputElement) {
                                o.eVelocityYInput.disabled = !has || !allNode || (o.eVelocityUse instanceof HTMLInputElement && !o.eVelocityUse.checked);
                                if (allNode) {
                                    let same = true, sameValue = null, first = true;
                                    itms.forEach(itm => {
                                        if (!same) return;
                                        if (first) {
                                            first = false;
                                            sameValue = itm.velocityY;
                                            return;
                                        }
                                        if (itm.velocityY != sameValue) same = false;
                                    });
                                    o.eVelocityYInput.value = same ? sameValue/100 : "";
                                } else o.eVelocityYInput.value = "";
                            }
                            if (o.eVelocityRotInput instanceof HTMLInputElement) {
                                o.eVelocityRotInput.disabled = !has || !allNode || (o.eVelocityUse instanceof HTMLInputElement && !o.eVelocityUse.checked);
                                if (allNode) {
                                    let same = true, sameValue = null, first = true;
                                    itms.forEach(itm => {
                                        if (!same) return;
                                        if (first) {
                                            first = false;
                                            sameValue = itm.velocityRot;
                                            return;
                                        }
                                        if (itm.velocityRot != sameValue) same = false;
                                    });
                                    o.eVelocityRotInput.value = same ? sameValue : "";
                                } else o.eVelocityRotInput.value = "";
                            }
                            if (o.eRadiusInput instanceof HTMLInputElement) {
                                o.eRadiusInput.disabled = !has || !allObstacle;
                                if (allObstacle) {
                                    let same = true, sameValue = null, first = true;
                                    itms.forEach(itm => {
                                        if (!same) return;
                                        if (first) {
                                            first = false;
                                            sameValue = itm.radius;
                                            return;
                                        }
                                        if (itm.radius != sameValue) same = false;
                                    });
                                    o.eRadiusInput.value = same ? sameValue/100 : "";
                                } else o.eRadiusInput.value = "";
                            }
                        });
                        o.ePositionBox = elem.querySelector(":scope #position");
                        if (o.ePositionBox instanceof HTMLDivElement) {
                            o.ePositionXInput = o.ePositionBox.querySelector(":scope > input.x");
                            o.ePositionYInput = o.ePositionBox.querySelector(":scope > input.y");
                            if (o.ePositionXInput instanceof HTMLInputElement)
                                o.ePositionXInput.addEventListener("change", e => {
                                    let v = o.ePositionXInput.value;
                                    if (v.length > 0) {
                                        let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                        let x = itms.map(itm => itm.x);
                                        let newCenter = util.ensure(parseFloat(v), "num")*100;
                                        let oldCenter = (Math.max(...x) + Math.min(...x)) / 2;
                                        let rel = newCenter - oldCenter;
                                        itms.forEach(itm => {
                                            itm.pos.iadd(rel, 0);
                                            itm.post("change", null);
                                        });
                                        state.post("refresh-selectitem", null);
                                    }
                                    state.post("refresh-options", null);
                                });
                            if (o.ePositionYInput instanceof HTMLInputElement)
                                o.ePositionYInput.addEventListener("change", e => {
                                    let v = o.ePositionYInput.value;
                                    if (v.length > 0) {
                                        let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                        let y = itms.map(itm => itm.y);
                                        let newCenter = util.ensure(parseFloat(v), "num")*100;
                                        let oldCenter = (Math.max(...y) + Math.min(...y)) / 2;
                                        let rel = newCenter - oldCenter;
                                        itms.forEach(itm => {
                                            itm.pos.iadd(0, rel);
                                            itm.post("change", null);
                                        });
                                        state.post("refresh-selectitem", null);
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eHeadingUseBox = elem.querySelector(":scope #headinguse");
                        if (o.eHeadingUseBox instanceof HTMLLabelElement) {
                            o.eHeadingUse = o.eHeadingUseBox.querySelector("input[type='checkbox']");
                            if (o.eHeadingUse instanceof HTMLInputElement)
                                o.eHeadingUse.addEventListener("change", e => {
                                    let v = o.eHeadingUse.checked;
                                    let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                    itms.forEach(itm => {
                                        if (!(itm instanceof subcore.Project.Node)) return;
                                        itm.useHeading = v;
                                    });
                                    state.post("refresh-selectitem", null);
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eHeadingBox = elem.querySelector(":scope #heading");
                        if (o.eHeadingBox instanceof HTMLDivElement) {
                            o.eHeadingInput = o.eHeadingBox.querySelector(":scope > input");
                            if (o.eHeadingInput instanceof HTMLInputElement)
                                o.eHeadingInput.addEventListener("change", e => {
                                    let v = o.eHeadingInput.value;
                                    if (v.length > 0) {
                                        const fullTurn = 2*Math.PI;
                                        v = util.ensure(parseFloat(v), "num");
                                        while (v >= fullTurn) v -= fullTurn;
                                        while (v < 0) v += fullTurn;
                                        let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                        itms.forEach(itm => {
                                            if (!(itm instanceof subcore.Project.Node)) return;
                                            itm.heading = v;
                                        });
                                        state.post("refresh-selectitem", null);
                                    }
                                    state.post("refresh-options", null);
                                });
                            o.eHeadingDragBox = o.eHeadingBox.querySelector(":scope > .dragbox");
                            if (o.eHeadingDragBox instanceof HTMLDivElement)
                                o.eHeadingDragBox.addEventListener("mousedown", e => {
                                    const place = e => {
                                        let r = o.eHeadingDragBox.getBoundingClientRect();
                                        let center = new V(r.left + r.width/2, r.top + r.height/2).mul(+1, -1);
                                        let to = new V(e.pageX, e.pageY).mul(+1, -1);
                                        let v = (Math.PI/180)*center.towards(to);
                                        let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                        itms.forEach(itm => {
                                            if (!(itm instanceof subcore.Project.Node)) return;
                                            itm.heading = v;
                                        });
                                        state.post("refresh-selectitem", null);
                                        state.post("refresh-options", null);
                                    };
                                    place(e);
                                    const mouseup = () => {
                                        document.body.removeEventListener("mouseup", mouseup);
                                        document.body.removeEventListener("mousemove", mousemove);
                                    };
                                    const mousemove = e => {
                                        place(e);
                                    };
                                    document.body.addEventListener("mouseup", mouseup);
                                    document.body.addEventListener("mousemove", mousemove);
                                });
                        }
                        o.eVelocityUseBox = elem.querySelector(":scope #velocityuse");
                        if (o.eVelocityUseBox instanceof HTMLLabelElement) {
                            o.eVelocityUse = o.eVelocityUseBox.querySelector("input[type='checkbox']");
                            if (o.eVelocityUse instanceof HTMLInputElement)
                                o.eVelocityUse.addEventListener("change", e => {
                                    let v = o.eVelocityUse.checked;
                                    let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                    itms.forEach(itm => {
                                        if (!(itm instanceof subcore.Project.Node)) return;
                                        itm.useVelocity = v;
                                    });
                                    state.post("refresh-selectitem", null);
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eVelocityBox = elem.querySelector(":scope #velocity");
                        if (o.eVelocityBox instanceof HTMLDivElement) {
                            o.eVelocityXInput = o.eVelocityBox.querySelector(":scope > input.x");
                            if (o.eVelocityXInput instanceof HTMLInputElement)
                                o.eVelocityXInput.addEventListener("change", e => {
                                    let v = o.eVelocityXInput.value;
                                    if (v.length > 0) {
                                        v = util.ensure(parseFloat(v), "num");
                                        let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                        itms.forEach(itm => {
                                            if (!(itm instanceof subcore.Project.Node)) return;
                                            itm.velocityX = v*100;
                                            itm.post("change", null);
                                        });
                                        state.post("refresh-selectitem", null);
                                    }
                                    state.post("refresh-options", null);
                                });
                            o.eVelocityYInput = o.eVelocityBox.querySelector(":scope > input.y");
                            if (o.eVelocityYInput instanceof HTMLInputElement)
                                o.eVelocityYInput.addEventListener("change", e => {
                                    let v = o.eVelocityYInput.value;
                                    if (v.length > 0) {
                                        v = util.ensure(parseFloat(v), "num");
                                        let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                        itms.forEach(itm => {
                                            if (!(itm instanceof subcore.Project.Node)) return;
                                            itm.velocityY = v*100;
                                            itm.post("change", null);
                                        });
                                        state.post("refresh-selectitem", null);
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eVelocityRotBox = elem.querySelector(":scope #velocityrot");
                        if (o.eVelocityRotBox instanceof HTMLDivElement) {
                            o.eVelocityRotInput = o.eVelocityRotBox.querySelector(":scope > input");
                            if (o.eVelocityRotInput instanceof HTMLInputElement)
                                o.eVelocityRotInput.addEventListener("change", e => {
                                    let v = o.eVelocityRotInput.value;
                                    if (v.length > 0) {
                                        v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                        let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                        itms.forEach(itm => {
                                            if (!(itm instanceof subcore.Project.Node)) return;
                                            itm.velocityRot = v;
                                        });
                                        state.post("refresh-selectitem", null);
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eRadiusBox = elem.querySelector(":scope #radius");
                        if (o.eRadiusBox instanceof HTMLDivElement) {
                            o.eRadiusInput = o.eRadiusBox.querySelector(":scope > input");
                            if (o.eRadiusInput instanceof HTMLInputElement)
                                o.eRadiusInput.addEventListener("change", e => {
                                    let v = o.eRadiusInput.value;
                                    if (v.length > 0) {
                                        v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                        let itms = getSelected().filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
                                        itms.forEach(itm => {
                                            if (!(itm instanceof subcore.Project.Obstacle)) return;
                                            itm.radius = v*100;
                                        });
                                        state.post("refresh-selectitem", null);
                                    }
                                    state.post("refresh-options", null);
                                });
                        }
                        o.eItemControls = elem.querySelector(":scope #itemcontrols");
                        if (o.eItemControls instanceof HTMLDivElement) {
                            o.eItemRem = o.eItemControls.querySelector(":scope > button#removebtn");
                            if (o.eItemRem instanceof HTMLButtonElement)
                                o.eItemRem.addEventListener("click", e => {
                                    if (getChoosing()) return;
                                    if (!this.hasProject()) return;
                                    getSelected().forEach(id => this.project.remItem(id));
                                    setSelected(getSelected());
                                });
                        }
                    },
                };
                for (let name in state.options) {
                    let f = state.options[name];
                    let elem = document.getElementById(name+"options");
                    if (!(elem instanceof HTMLDivElement)) continue;
                    let btn = elem.querySelector(":scope > .title");
                    if (!(btn instanceof HTMLButtonElement)) continue;
                    let o = state.options[name] = new core.Target();
                    btn.addEventListener("click", e => {
                        if (getChoosing()) return;
                        e.stopPropagation();
                        o.setShown(!o.getShown());
                    });
                    o.btn = btn;
                    let shown = null;
                    o.getShown = () => shown;
                    o.setShown = v => {
                        v = !!v;
                        if (o.getShown() == v) return true;
                        shown = v;
                        o.post("show-change", { v: v });
                        return true;
                    };
                    o.getHidden = () => !o.getShown();
                    o.setHidden = v => o.setShown(!v);
                    o.show = () => o.setShown(true);
                    o.hide = () => o.setHidden(true);
                    new MutationObserver(() => o.post("show-change")).observe(btn, { attributes: true });
                    o.addHandler("show-change", data => {
                        let show = o.getShown() && !btn.disabled;
                        if (show) elem.classList.add("this");
                        else elem.classList.remove("this");
                    });
                    f(o, elem);
                }
                state.setDivPos(0.75);
                setChoosing(false);
                setDragging(false);
            },
        };
        if (name in namefs) namefs[name]();
        return true;
    }
    getPage(name) {
        name = String(name);
        if (!this.hasPage(name)) return null;
        return this.#pages[name].elem;
    }
    get page() { return this.#page; }
    set page(v) { this.setPage(v, null); }
    async setPage(name, data) {
        name = String(name);
        data = util.ensure(data, "obj");

        if (this.page == name) {
            let samefs = {
                PROJECT: () => {
                    if (this.hasProject(data.id)) return this.projectId == data.id;
                    else if (data.project instanceof subcore.Project) return this.project == data.project;
                    return false;
                },
            };
            if (this.page in samefs) {
                if (samefs[this.page]())
                    return;
            } else return;
        }
        if (!this.hasPage(name)) return;

        this.pages.forEach(name => this.getPage(name).classList.remove("this"));

        let namefs, state;

        state = this.#pages[this.page];
        namefs = {
            PROJECT: async () => {
                this.markChange("*all");
                try {
                    await this.syncFilesWith();
                } catch (e) {
                    let alert = this.alert("There was an error saving your projects!", "warning");
                    alert.hasInfo = true;
                    alert.info = String(e);
                    alert.iconColor = "var(--cr)";
                }
                this.project = null;
            },
        };
        if (this.page in namefs) await namefs[this.page]();

        this.#page = name;

        state = this.#pages[this.page];
        namefs = {
            TITLE: async () => {
                if (this.hasEProjectsBtn()) this.eProjectsBtn.classList.remove("this");
                if (this.hasEFileBtn()) this.eFileBtn.style.visibility = "hidden";
                if (this.hasEEditBtn()) this.eEditBtn.style.visibility = "hidden";
                if (this.hasENameInput()) this.eNameInput.style.visibility = "hidden";
                if (this.hasESaveBtn()) this.eSaveBtn.style.visibility = "hidden";
            },
            PROJECTS: async () => {
                if (this.hasEProjectsBtn()) this.eProjectsBtn.classList.add("this");
                if (this.hasEFileBtn()) this.eFileBtn.style.visibility = "hidden";
                if (this.hasEEditBtn()) this.eEditBtn.style.visibility = "hidden";
                if (this.hasENameInput()) this.eNameInput.style.visibility = "hidden";
                if (this.hasESaveBtn()) this.eSaveBtn.style.visibility = "hidden";
                if (state.refresh) await state.refresh();
            },
            PROJECT: async () => {
                if (this.hasEProjectsBtn()) this.eProjectsBtn.classList.remove("this");
                if (this.hasEFileBtn()) this.eFileBtn.style.visibility = "";
                if (this.hasEEditBtn()) this.eEditBtn.style.visibility = "";
                if (this.hasENameInput()) this.eNameInput.style.visibility = "";
                if (this.hasESaveBtn()) this.eSaveBtn.style.visibility = "";
                if (state.refresh) await state.refresh();
                if (state.eDisplay instanceof HTMLDivElement) state.eDisplay.focus();
                if (this.hasProject(data.id)) this.project = this.getProject(data.id);
                else if (data.project instanceof subcore.Project) this.project = data.project;
                else {
                    this.project = new subcore.Project();
                    this.project.meta.created = this.project.meta.modified = util.getTime();
                    let hasTemplate = await window.api.fileHas("template.json");
                    if (!hasTemplate) return console.log("no template found");
                    let templateContent = null;
                    try {
                        templateContent = await window.api.fileRead("template.json");
                    } catch (e) {}
                    if (templateContent == null) return console.log("invalid template content");
                    let template = null;
                    try {
                        template = JSON.parse(templateContent);
                    } catch (e) {}
                    if (template == null) return console.log("error parsing template");
                    template = util.ensure(template, "obj");
                    for (let k in template) {
                        let v = template[k];
                        k = String(k).split(".");
                        while (k.length > 0 && k.at(0).length <= 0) k.shift();
                        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
                        let obj = this.project;
                        while (k.length > 1) {
                            if (!util.is(obj, "obj")) {
                                obj = null;
                                break;
                            }
                            obj = obj[k.shift()];
                        }
                        if (obj == null || k.length != 1) continue;
                        obj[k] = v;
                    }
                    state.post("refresh-options", null);
                }
            },
        };
        if (this.page in namefs) await namefs[this.page]();

        this.pages.forEach(name => this.getPage(name).classList[(name == this.page ? "add" : "remove")]("this"));
    }

    get eTitleBtn() { return this.#eTitleBtn; }
    hasETitleBtn() { return this.eTitleBtn instanceof HTMLButtonElement; }
    get eProjectsBtn() { return this.#eProjectsBtn; }
    hasEProjectsBtn() { return this.eProjectsBtn instanceof HTMLButtonElement; }
    get eCreateBtn() { return this.#eCreateBtn; }
    hasECreateBtn() { return this.eCreateBtn instanceof HTMLButtonElement; }
    get eFileBtn() { return this.#eFileBtn; }
    hasEFileBtn() { return this.eFileBtn instanceof HTMLButtonElement; }
    get eEditBtn() { return this.#eEditBtn; }
    hasEEditBtn() { return this.eEditBtn instanceof HTMLButtonElement; }
    get eNameInput() { return this.#eNameInput; }
    hasENameInput() { return this.eNameInput instanceof HTMLInputElement; }
    get eSaveBtn() { return this.#eSaveBtn; }
    hasESaveBtn() { return this.eSaveBtn instanceof HTMLButtonElement; }
}