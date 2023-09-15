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

        this.elem.addEventListener("contextmenu", e => this.post("contextmenu", { e: e }));
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
    #page;

    #path;
    #showIndices;
    #showLines;

    #elem;
    #eName;
    #eEdit;
    #eRemove;

    constructor(path) {
        super();

        this.#page = null;

        this.#path = null;
        this.#showIndices = true;
        this.#showLines = true;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eName = document.createElement("input");
        this.elem.appendChild(this.eName);
        this.eName.type = "text";
        this.eName.placeholder = "Path Name";
        this.eName.autocomplete = "off";
        this.eName.spellcheck = false;
        this.#eEdit = document.createElement("button");
        this.elem.appendChild(this.eEdit);
        this.eEdit.innerHTML = "<ion-icon name='pencil'></ion-icon>";
        this.#eRemove = document.createElement("button");
        this.elem.appendChild(this.eRemove);
        this.eRemove.innerHTML = "<ion-icon name='trash'></ion-icon>";

        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", null);
        });
        this.eEdit.addEventListener("click", e => {
            e.stopPropagation();
            this.post("edit", null);
        });
        this.eRemove.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove", null);
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
        let prevShowIndicies = null, prevShowLines = null;
        let pthItems = {};
        this.addHandler("udpate", data => {
            if (!this.hasApp()) return;
            if (!this.app.hasProject()) return;
            let nodes = (show && this.hasPath()) ? this.path.nodes : [];
            let path = nodes.join("");
            if (prevPath == path && prevShowIndicies == this.showIndices && prevShowLines == this.showLines) return;
            for (let id in pthItems) this.page.remRenderItem(pthItems[id]);
            pthItems = {};
            prevPath = path;
            prevShowIndicies = this.showIndices;
            prevShowLines = this.showLines;
            for (let i = 0; i < nodes.length; i++) {
                let id = nodes[i];
                let node = this.app.project.getItem(id);
                if (this.showIndices) {
                    if (id in pthItems) {
                        pthItems[id].value += ", "+(i+1);
                    } else {
                        pthItems[id] = this.page.addRenderItem(new RIPathIndex(node));
                        pthItems[id].value = i+1;
                    }
                }
                if (i > 0 && this.showLines) {
                    let id2 = nodes[i-1];
                    let node2 = this.app.project.getItem(id2);
                    pthItems[id+"~"+id2] = this.page.addRenderItem(new RIPathLine(node, node2));
                }
            }
        });

        this.path = path;
    }

    get page() { return this.#page; }
    set page(v) {
        v = (v instanceof App.ProjectPage) ? v : null;
        if (this.page == v) return;
        this.#page = v;
    }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() { return this.hasPage() ? this.page.app : null; }
    hasApp() { return this.app instanceof App; }

    get path() { return this.#path; }
    set path(v) {
        v = (v instanceof subcore.Project.Path) ? v : null;
        if (this.path == v) return;
        this.#path = v;
        this.post("set", { v: v });
    }
    hasPath() { return this.path instanceof subcore.Project.Path; }
    get showIndices() { return this.#showIndices; }
    set showIndices(v) {
        v = !!v;
        if (this.showIndices == v) return;
        this.#showIndices = v;
    }
    get showLines() { return this.#showLines; }
    set showLines(v) {
        v = !!v;
        if (this.showLines == v) return;
        this.#showLines = v;
    }

    get selected() { return this.elem.classList.contains("this"); }
    set selected(v) { v ? this.elem.classList.add("this") : this.elem.classList.remove("this"); }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }
    get eEdit() { return this.#eEdit; }
    get eRemove() { return this.#eRemove; }

    update() {
        this.post("udpate", null);
    }
}

class PathVisual extends core.Target {
    #page;

    #id;

    #show;

    #visual;
    #item;

    #t;
    #tPrev;
    #paused;

    constructor() {
        super();

        this.#page = null;

        this.#id = null;

        this.#show = false;

        this.#visual = new RIPathVisual();
        this.#item = new RIPathVisualItem(this.visual);

        this.#t = 0;
        this.#tPrev = 0;
        this.#paused = true;
    }

    get page() { return this.#page; }
    set page(v) {
        v = (v instanceof App.ProjectPage) ? v : null;
        if (this.page == v) return;
        if (this.hasPage()) {
            this.page.remRenderItem(this.visual);
            this.page.remRenderItem(this.item);
        }
        this.#page = v;
        if (this.hasPage() && this.show) {
            this.page.addRenderItem(this.visual);
            this.page.addRenderItem(this.item);
        }
    }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() { return this.hasPage() ? this.page.app : null; }
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
        if (!this.hasPage()) return;
        if (this.show) {
            this.page.addRenderItem(this.visual);
            this.page.addRenderItem(this.item);
        } else {
            this.page.remRenderItem(this.visual);
            this.page.remRenderItem(this.item);
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
    #page;

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

        this.#page = null;

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

    get page() { return this.#page; }
    set page(v) {
        v = (v instanceof App.ProjectPage) ? v : null;
        if (this.page == v) return;
        this.#page = v;
    }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() { return this.hasPage() ? this.page.app : null; }
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
        let globalScale = this.hasPage() ? this.page.globalScale : 1;
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

        this.elem.classList.add("heading");
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
                    if (this.item.useHeading) this.elem.classList.add("heading");
                    else this.elem.classList.remove("heading");
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

    #pages;
    #page;

    #eTitleBtn;
    #eProjectsBtn;
    #eCreateBtn;
    #eFileBtn;
    #eEditBtn;
    #eViewBtn;
    #eProjectInfo;
    #eProjectInfoBtn;
    #eProjectInfoNameInput;
    #eProjectInfoSaveBtn;
    #eProjectInfoCopyBtn;
    #eProjectInfoDeleteBtn;
    #eSaveBtn;

    constructor() {
        super();

        this.#changes = new Set();

        this.#projects = {};
        this.#projectId = false;

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
        });
        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("start-complete", data => {
            this.addBackButton();

            this.#eTitleBtn = document.getElementById("titlebtn");
            if (this.hasETitleBtn())
                this.eTitleBtn.addEventListener("click", e => {
                    this.page = "TITLE";
                });
            this.#eProjectsBtn = document.querySelector("#titlebar > button.nav#projectsbtn");
            if (this.hasEProjectsBtn())
                this.eProjectsBtn.addEventListener("click", e => {
                    this.page = "PROJECTS";
                });
            this.#eCreateBtn = document.querySelector("#titlebar > button.nav#createbtn");
            if (this.hasECreateBtn())
                this.eCreateBtn.addEventListener("click", async e => {
                    this.page = "PROJECT";
                });

            this.#eFileBtn = document.querySelector("#titlebar > button.nav#filebtn");
            if (this.hasEFileBtn())
                this.eFileBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.ContextMenu();
                    itm = menu.addItem(new core.App.ContextMenu.Item("New Project", "add"));
                    itm.shortcut = "⌘N";
                    itm.addHandler("trigger", data => {
                        this.post("cmd-newproject", null);
                    });
                    menu.addItem(new core.App.ContextMenu.Divider());
                    itm = menu.addItem(new core.App.ContextMenu.Item("Add Node", "add"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-addnode", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Add Obstacle", "add"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-addobstacle", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Add Path", "add"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-addpath", null);
                    });
                    menu.addItem(new core.App.ContextMenu.Divider());
                    itm = menu.addItem(new core.App.ContextMenu.Item("Save", "document-outline"));
                    itm.shortcut = "⌘S";
                    itm.addHandler("trigger", async data => {
                        this.post("cmd-save", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Save as copy", "documents-outline"));
                    itm.shortcut = "⇧⌘S";
                    itm.addHandler("trigger", data => {
                        this.post("cmd-savecopy", null);
                    });
                    menu.addItem(new core.App.ContextMenu.Divider());
                    itm = menu.addItem(new core.App.ContextMenu.Item("Delete Project"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-delete", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Close Project"));
                    itm.shortcut = "⇧⌘W";
                    itm.addHandler("trigger", data => {
                        this.post("cmd-close", null);
                    });
                    this.contextMenu = menu;
                    let r = this.eFileBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eEditBtn = document.querySelector("#titlebar > button.nav#editbtn");
            if (this.hasEEditBtn())
                this.eEditBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.ContextMenu();
                    itm = menu.addItem(new core.App.ContextMenu.Item("Cut"));
                    itm.shortcut = "⌘X";
                    itm.addHandler("trigger", data => {
                        if (!this.hasPage("PROJECT")) return;
                        this.getPage("PROJECT").cut();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Copy"));
                    itm.shortcut = "⌘C";
                    itm.addHandler("trigger", data => {
                        if (!this.hasPage("PROJECT")) return;
                        this.getPage("PROJECT").copy();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Paste"));
                    itm.shortcut = "⌘V";
                    itm.addHandler("trigger", data => {
                        if (!this.hasPage("PROJECT")) return;
                        this.getPage("PROJECT").paste();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Select All"));
                    itm.shortcut = "⌘A";
                    itm.addHandler("trigger", data => {
                        if (!this.hasPage("PROJECT")) return;
                        this.getPage("PROJECT").selected = this.project.items;
                    });
                    this.contextMenu = menu;
                    let r = this.eEditBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eViewBtn = document.querySelector("#titlebar > button.nav#viewbtn");
            if (this.hasEViewBtn())
                this.eViewBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.ContextMenu();
                    itm = menu.addItem(new core.App.ContextMenu.Item("Toggle Maximized"));
                    itm.shortcut = "⌃F";
                    itm.addHandler("trigger", data => {
                        this.post("cmd-maxmin", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Reset Divider"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-resetdivider", null);
                    });
                    this.contextMenu = menu;
                    let r = this.eViewBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eProjectInfo = document.querySelector("#titlebar > #projectinfo");
            if (this.hasEProjectInfo()) {
                this.#eProjectInfoBtn = this.eProjectInfo.querySelector(":scope > button.display");
                if (this.hasEProjectInfoBtn())
                    this.eProjectInfoBtn.addEventListener("click", e => {
                        e.stopPropagation();
                        if (this.eProjectInfo.classList.contains("this")) this.eProjectInfo.classList.remove("this");
                        else {
                            this.eProjectInfo.classList.add("this");
                            const click = () => {
                                document.body.removeEventListener("click", click);
                                this.eProjectInfo.classList.remove("this");
                            };
                            document.body.addEventListener("click", click);
                        }
                    });
                this.#eProjectInfoNameInput = this.eProjectInfo.querySelector(":scope > .content > input#infoname");
                this.#eProjectInfoSaveBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infosave");
                this.#eProjectInfoCopyBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infocopy");
                this.#eProjectInfoDeleteBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infodelete");
                if (this.hasEProjectInfoSaveBtn())
                    this.eProjectInfoSaveBtn.addEventListener("click", e => this.post("cmd-save"));
                if (this.hasEProjectInfoCopyBtn())
                    this.eProjectInfoCopyBtn.addEventListener("click", e => this.post("cmd-savecopy"));
                if (this.hasEProjectInfoDeleteBtn())
                    this.eProjectInfoDeleteBtn.addEventListener("click", e => this.post("cmd-delete"));
            }
            this.#eSaveBtn = document.querySelector("#save");
            if (this.hasESaveBtn())
                this.eSaveBtn.addEventListener("click", async e => {
                    e.stopPropagation();
                    this.post("cmd-save", null);
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
                this.pages.forEach(name => this.getPage(name).update());
            });

            this.clearChanges();

            this.addHandler("cmd-newproject", async () => {
                this.page = "PROJECT";
            });
            const cmdAdd = name => {
                if (this.dragging) return;
                name = String(name);
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (page.choosing) return;
                if (!this.hasProject()) return;
                this.dragData = name;
                this.dragging = true;
                if (this.hasEDrag())
                    this.eDrag.innerHTML = {
                        node: "<div class='global item selectable node'><div class='button'></div></div>",
                        obstacle: "<div class='global item selectable obstacle'><div class='button'></div><div class='radius'></div><div class='button radiusdrag'></div></div>"
                    }[this.dragData];
                let prevOverRender = false;
                let ghostItem = null;
                let item = {
                    node: new subcore.Project.Node(
                        0,
                        0, true,
                        0, 0, false,
                    ),
                    obstacle: new subcore.Project.Obstacle(0, 100),
                }[this.dragData];
                this.dragState.addHandler("move", e => {
                    let pos = new V(e.pageX, e.pageY);
                    let overRender = false;
                    if (page.hasERender()) {
                        let r = page.eRender.getBoundingClientRect();
                        overRender = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                    }
                    if (prevOverRender != overRender) {
                        prevOverRender = overRender;
                        if (overRender) {
                            ghostItem = page.addRenderItem(new RISelectable(item));
                            ghostItem.ghost = true;
                        } else {
                            page.remRenderItem(ghostItem);
                            ghostItem = null;
                        }
                    }
                    if (this.hasEDrag())
                        if (this.eDrag.children[0] instanceof HTMLElement)
                            this.eDrag.children[0].style.visibility = overRender ? "hidden" : "inherit";
                    if (ghostItem instanceof RISelectable)
                        if (ghostItem.hasItem())
                            ghostItem.item.pos.set(ghostItem.pageToMap(pos));
                    if (!util.is(page.panels.objects, "obj")) return;
                    let o = page.panels.objects;
                    if (!(o.eSpawnDelete instanceof HTMLButtonElement)) return;
                    let r = o.eSpawnDelete.getBoundingClientRect();
                    let over = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                    if (over) o.eSpawnDelete.classList.add("hover");
                    else o.eSpawnDelete.classList.remove("hover");
                });
                const stop = cancel => {
                    page.remRenderItem(ghostItem);
                    if (this.hasEDrag()) this.eDrag.innerHTML = "";
                    if (!cancel && prevOverRender && this.hasProject()) this.project.addItem(item);
                    if (!util.is(page.panels.objects, "obj")) return;
                    let o = page.panels.objects;
                    o.eSpawnBox.classList.remove("delete");
                };
                this.dragState.addHandler("submit", data => stop(false));
                this.dragState.addHandler("cancel", data => stop(true));
                if (!util.is(page.panels.objects, "obj")) return;
                let o = page.panels.objects;
                o.eSpawnBox.classList.add("delete");
            };
            this.addHandler("cmd-addnode", () => cmdAdd("node"));
            this.addHandler("cmd-addobstacle", () => cmdAdd("obstacle"));
            this.addHandler("cmd-addpath", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (page.choosing) return;
                if (!this.hasProject()) return;
                page.choosing = true;
                let chooseState = page.chooseState;
                chooseState.path = new subcore.Project.Path();
                chooseState.addHandler("choose", data => {
                    if (!(chooseState.path instanceof subcore.Project.Path)) return;
                    let path = chooseState.path;
                    data = util.ensure(data, "obj");
                    let itm = data.itm, shift = data.shift;
                    if (!(itm instanceof subcore.Project.Node)) return;
                    if (shift) path.remNode(itm);
                    else path.addNode(itm);
                    for (let id in chooseState.temp) page.remRenderItem(chooseState.temp[id]);
                    chooseState.temp = {};
                    let nodes = path.nodes.filter(id => this.hasProject() && this.project.hasItem(id));
                    for (let i = 0; i < nodes.length; i++) {
                        let id = nodes[i];
                        let node = this.project.getItem(id);
                        if (id in chooseState.temp) {
                            chooseState.temp[id].value += ", "+(i+1);
                        } else {
                            chooseState.temp[id] = page.addRenderItem(new RIPathIndex(node));
                            chooseState.temp[id].value = i+1;
                        }
                        if (i > 0) {
                            let id2 = nodes[i-1];
                            let node2 = this.project.getItem(id2);
                            chooseState.temp[id+"~"+id2] = page.addRenderItem(new RIPathLine(node, node2));
                        }
                    }
                });
                chooseState.addHandler("done", data => {
                    if (!(chooseState.path instanceof subcore.Project.Path)) return;
                    let path = chooseState.path;
                    if (!this.hasProject()) return;
                    this.project.addPath(path);
                });
                chooseState.addHandler("cancel", data => {
                });
            });
            this.addHandler("cmd-save", async () => {
                try {
                    await this.syncFilesWith();
                } catch (e) {
                    let alert = this.alert("There was an error saving your projects!", "warning");
                    alert.hasInfo = true;
                    alert.info = String(e);
                    alert.iconColor = "var(--cr)";
                }
            });
            this.addHandler("cmd-savecopy", async source => {
                if (!(source instanceof subcore.Project)) source = this.project;
                if (!(source instanceof subcore.Project)) return;
                let project = new subcore.Project(source);
                project.meta.name += " copy";
                await this.setPage("PROJECT", { project: project });
                await this.post("cmd-save", null);
            });
            this.addHandler("cmd-delete", id => {
                if (!this.hasProject(String(id))) id = this.projectId;
                if (!this.hasProject(String(id))) return;
                let pop = this.confirm();
                pop.eContent.innerText = "Are you sure you want to delete this project?\nThis action is not reversible!";
                pop.addHandler("result", async data => {
                    let v = !!util.ensure(data, "obj").v;
                    if (v) {
                        this.remProject(id);
                        await this.post("cmd-save", null);
                        this.page = "PROJECTS";
                    }
                });
            });
            this.addHandler("cmd-close", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasProject()) return;
                this.page = "PROJECTS";
            });
            this.addHandler("cmd-maxmin", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                this.getPage("PROJECT").maximized = !this.getPage("PROJECT").maximized;
            });
            this.addHandler("cmd-resetdivider", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                this.getPage("PROJECT").divPos = 0.75;
            });

            this.addPage(new App.TitlePage(this));
            this.addPage(new App.ProjectsPage(this));
            this.addPage(new App.ProjectPage(this));

            this.projectId = null;
            this.page = "TITLE";
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
        const log = () => {};
        // const log = console.log;
        try {
            await this.post("sync-with-files", null);
        } catch (e) {}
        let hasProjectIds = await window.api.fileHas("projects.json");
        if (!hasProjectIds) {
            log("no projects.json found > creating");
            await window.api.fileWrite("projects.json", "[]");
        }
        let projectIdsContent = "";
        try {
            projectIdsContent = await window.api.fileRead("projects.json");
        } catch (e) {
            log("error reading projects.json:");
            log(e);
            projectIdsContent = "";
        }
        let projectIds = null;
        try {
            projectIds = JSON.parse(projectIdsContent, subcore.REVIVER.f);
        } catch (e) {
            log("error parsing projects.json:", projectIdsContent);
            log(e);
            projectIds = null;
        }
        projectIds = util.ensure(projectIds, "arr").map(id => String(id));
        log("projects.json: ", projectIds);
        let hasProjectsDir = await window.api.dirHas("projects");
        if (!hasProjectsDir) {
            log("no projects directory found > creating");
            await window.api.dirMake("projects");
        }
        let projects = {};
        for (let i = 0; i < projectIds.length; i++) {
            let id = projectIds[i];
            let projectContent = "";
            try {
                projectContent = await window.api.fileRead(["projects", id+".json"]);
            } catch (e) {
                log("error reading projects/"+id+".json:");
                log(e);
                projectContent = "";
            }
            let project = null;
            try {
                project = JSON.parse(projectContent, subcore.REVIVER.f);
            } catch (e) {
                log("error parsing projects/"+id+".json:", projectContent);
                log(e);
                project = null;
            }
            if (!(project instanceof subcore.Project)) continue;
            log("projects/"+id+".json: ", project);
            projects[id] = project;
        }
        this.projects = projects;
        this.clearChanges();
        try {
            await this.post("synced-with-files", null);
        } catch (e) {}
    }
    async syncFilesWith() {
        const log = () => {};
        // const log = console.log;
        try {
            await this.post("sync-files-with", null);
        } catch (e) {}
        let changes = new Set(this.changes);
        this.clearChanges();
        log("CHANGES:", [...changes]);
        if (changes.has("*all")) {
            log("CHANGE:*all > updating global list");
            let projectIds = this.projects;
            let projectIdsContent = JSON.stringify(projectIds, null, "\t");
            await window.api.fileWrite("projects.json", projectIdsContent);
            for (let i = 0; i < projectIds.length; i++) {
                let id = projectIds[i];
                log("CHANGE:*all > creating/updating project id:"+id);
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
                    log("CHANGE:*all > removing project id:"+id);
                    if (await window.api.fileHas(["projects", id+".json"]))
                        await window.api.fileDelete(["projects", id+".json"]);
                }
            }
        } else {
            let projectIds = this.projects;
            if (changes.has("*")) {
                log("CHANGE:* > updating global list");
                let projectIdsContent = JSON.stringify(projectIds, null, "\t");
                await window.api.fileWrite("projects.json", projectIdsContent);
            }
            for (let i = 0; i < projectIds.length; i++) {
                let id = projectIds[i];
                if (!changes.has("proj:"+id)) continue;
                log("CHANGE:proj:"+id+" > creating/updating project id:"+id);
                let project = this.getProject(id);
                project.meta.modified = util.getTime();
                project.meta.thumb = this.generateRepresentation(project);
                let projectContent = JSON.stringify(project, null, "\t");
                await window.api.fileWrite(["projects", id+".json"], projectContent);
            }
            for (let i = 0; i < [...changes].length; i++) {
                let change = [...changes][i];
                if (!change.startsWith("proj:")) continue;
                let id = change.substring(5);
                if (this.hasProject(id)) continue;
                log("CHANGE:proj:"+id+" > removing project id:"+id);
                if (await window.api.fileHas(["projects", id+".json"]))
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

    get pages() { return Object.keys(this.#pages); }
    hasPage(name) {
        name = String(name);
        return name in this.#pages;
    }
    addPage(page) {
        if (!(page instanceof App.Page)) return false;
        if (this.hasPage(page.name)) return false;
        this.#pages[page.name] = page;
        return page;
    }
    getPage(name) {
        name = String(name);
        if (!this.hasPage(name)) return null;
        return this.#pages[name];
    }
    get page() { return this.#page; }
    set page(v) { this.setPage(v, null); }
    async setPage(name, data) {
        name = String(name);
        data = util.ensure(data, "obj");

        if (this.page == name) {
            if (!this.hasPage(this.page)) return;
            if (await this.getPage(this.page).determineSame(data)) return;
        }
        if (!this.hasPage(name)) return;

        this.pages.forEach(name => this.getPage(name).elem.classList.remove("this"));

        if (this.hasPage(this.page)) await this.getPage(this.page).leave(data);

        this.#page = name;

        let projectOnly = [
            "addnode", "addobstacle", "addpath",
            "savecopy",
            "delete", "close",
            "maxmin", "resetdivider",
        ];
        let changes = {};
        projectOnly.forEach(id => {
            changes[id] = { ".enabled": this.page == "PROJECT" };
        });
        await window.api.menuChange(changes);

        if (this.hasPage(this.page)) await this.getPage(this.page).enter(data);

        this.pages.forEach(name => this.getPage(name).elem.classList[(name == this.page ? "add" : "remove")]("this"));
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
    get eViewBtn() { return this.#eViewBtn; }
    hasEViewBtn() { return this.eViewBtn instanceof HTMLButtonElement; }
    get eProjectInfo() { return this.#eProjectInfo; }
    hasEProjectInfo() { return this.eProjectInfo instanceof HTMLDivElement; }
    get eProjectInfoBtn() { return this.#eProjectInfoBtn; }
    hasEProjectInfoBtn() { return this.eProjectInfoBtn instanceof HTMLButtonElement; }
    get eProjectInfoNameInput() { return this.#eProjectInfoNameInput; }
    hasEProjectInfoNameInput() { return this.eProjectInfoNameInput instanceof HTMLInputElement; }
    get eProjectInfoSaveBtn() { return this.#eProjectInfoSaveBtn; }
    hasEProjectInfoSaveBtn() { return this.eProjectInfoSaveBtn instanceof HTMLButtonElement; }
    get eProjectInfoCopyBtn() { return this.#eProjectInfoCopyBtn; }
    hasEProjectInfoCopyBtn() { return this.eProjectInfoCopyBtn instanceof HTMLButtonElement; }
    get eProjectInfoDeleteBtn() { return this.#eProjectInfoDeleteBtn; }
    hasEProjectInfoDeleteBtn() { return this.eProjectInfoDeleteBtn instanceof HTMLButtonElement; }
    get eSaveBtn() { return this.#eSaveBtn; }
    hasESaveBtn() { return this.eSaveBtn instanceof HTMLButtonElement; }
}
App.Page = class AppPage extends core.Target {
    #name;
    #app;
    #elem;

    constructor(name, app) {
        super();

        this.#name = String(name);
        this.#app = (app instanceof App) ? app : null;
        this.#elem = document.querySelector("#"+name+"PAGE");
    }

    get name() { return this.#name; }
    get app() { return this.#app; }
    hasApp() { return this.app instanceof App; }
    get elem() { return this.#elem; }
    hasElem() { return this.elem instanceof HTMLDivElement; }

    async enter(data) {}
    async leave(data) {}
    async determineSame(data) { return false; }

    update() { this.post("update", null); }
};
App.TitlePage = class AppTitlePage extends App.Page {
    #eCreateBtn;
    #eProjectsBtn;

    constructor(app) {
        super("TITLE", app);

        if (!this.hasElem()) return;

        this.#eCreateBtn = this.elem.querySelector(":scope > .nav > #createbtn");
        if (this.hasECreateBtn())
            this.eCreateBtn.addEventListener("click", e => {
                if (!this.hasApp()) return;
                this.app.page = "PROJECT";
            });
        this.#eProjectsBtn = this.elem.querySelector(":scope > .nav > #projectsbtn");
        if (this.hasEProjectsBtn())
            this.eProjectsBtn.addEventListener("click", e => {
                if (!this.hasApp()) return;
                this.app.page = "PROJECTS";
            });
    }

    get eCreateBtn() { return this.#eCreateBtn; }
    hasECreateBtn() { return this.eCreateBtn instanceof HTMLButtonElement; }
    get eProjectsBtn() { return this.#eProjectsBtn; }
    hasEProjectsBtn() { return this.eProjectsBtn instanceof HTMLButtonElement; }

    async enter(data) {
        if (this.hasApp() && this.app.hasEProjectsBtn())
            this.app.eProjectsBtn.classList.remove("this");
        Array.from(document.querySelectorAll(".forproject")).forEach(elem => { elem.style.display = "none"; });
    }
};
App.ProjectsPage = class AppProjectsPage extends App.Page {
    #buttons;

    #eSearchBox;
    #eSearchInput;
    #eSearchBtn;
    #eCreateBtn;
    #eTemplates;
    #eContent;
    #eLoading;
    #eEmpty;

    constructor(app) {
        super("PROJECTS", app);

        if (!this.hasElem()) return;

        this.#buttons = new Set();

        this.addHandler("update", data => this.buttons.forEach(btn => btn.update()));

        this.#eSearchBox = this.elem.querySelector(":scope > .nav > .search");
        if (this.hasESearchBox()) {
            this.#eSearchInput = this.eSearchBox.querySelector(":scope > input");
            if (this.hasESearchInput())
                this.eSearchInput.addEventListener("input", e => {
                    this.refresh();
                });
            this.#eSearchBtn = this.eSearchBox.querySelector(":scope > button");
            if (this.hasESearchBtn())
                this.eSearchBtn.addEventListener("click", e => {
                    if (this.eSearchInput instanceof HTMLInputElement)
                        this.eSearchInput.value = "";
                    this.refresh();
                });
        }
        this.#eCreateBtn = this.elem.querySelector(":scope > .nav > .nav > button#createbtn");
        if (this.hasECreateBtn())
            this.eCreateBtn.addEventListener("click", e => {
                if (!this.hasApp()) return;
                this.app.page = "PROJECT";
            });
        this.#eTemplates = this.elem.querySelector(":scope > .nav > .nav > .templates");
        this.#eContent = this.elem.querySelector(":scope > .content");
        this.#eLoading = this.elem.querySelector(":scope > .content > .loading");
        this.#eEmpty = this.elem.querySelector(":scope > .content > .empty");
        if (this.hasApp()) {
            this.app.addHandler("synced-files-with", () => this.refresh());
            this.app.addHandler("synced-with-files", () => this.refresh());
        }

        this.addHandler("update", data => this.buttons.forEach(btn => btn.update()));
    }

    async refresh() {
        this.clearButtons();
        if (this.hasETemplates()) {
            this.eTemplates.innerHTML = "";
            const globalTemplates = await window.api.getTemplates();
            for (let name in globalTemplates) {
                let btn = document.createElement("button");
                this.eTemplates.appendChild(btn);
                btn.textContent = name;
                btn.addEventListener("click", e => {
                    if (!this.hasApp()) return;
                    this.app.setPage("PROJECT", { template: name });
                });
            }
            let btn = document.createElement("button");
            this.eTemplates.appendChild(btn);
            btn.textContent = "Blank Project";
            btn.addEventListener("click", e => {
                if (!this.hasApp()) return;
                this.app.setPage("PROJECT", { template: null });
            });
        }
        if (this.hasELoading()) this.eLoading.style.display = "block";
        if (this.hasEEmpty()) this.eEmpty.style.display = "none";
        if (this.hasELoading()) this.eLoading.style.display = "none";
        let projects = (this.hasApp() ? this.app.projects : []).map(id => this.app.getProject(id));
        if (projects.length > 0) {
            let query = this.hasESearchInput() ? this.eSearchInput.value : "";
            if (query.length > 0) {
                const fuse = new Fuse(projects, {
                    isCaseSensitive: false,
                    keys: [
                        "meta.name",
                    ],
                });
                projects = fuse.search(query).map(item => item.item);
            }
            projects.forEach(project => this.addButton(new App.ProjectsPage.Button(project)));
        } else {
            if (this.hasEEmpty()) this.eEmpty.style.display = "block";
        }
    }

    get buttons() { return [...this.#buttons]; }
    set buttons(v) {
        v = util.ensure(v, "arr");
        this.clearButtons();
        v.forEach(v => this.addButton(v));
    }
    clearButtons() {
        let btns = this.buttons;
        btns.forEach(btn => this.remButton(btn));
        return btns;
    }
    hasButton(btn) {
        if (!(btn instanceof App.ProjectsPage.Button)) return false;
        return this.#buttons.has(btn);
    }
    addButton(btn) {
        if (!(btn instanceof App.ProjectsPage.Button)) return false;
        if (this.hasButton(btn)) return false;
        this.#buttons.add(btn);
        btn.page = this;
        if (this.hasEContent()) this.eContent.appendChild(btn.elem);
        return btn;
    }
    remButton(btn) {
        if (!(btn instanceof App.ProjectsPage.Button)) return false;
        if (!this.hasButton(btn)) return false;
        this.#buttons.delete(btn);
        btn.page = null;
        if (this.hasEContent()) this.eContent.removeChild(btn.elem);
        return btn;
    }

    get eSearchBox() { return this.#eSearchBox; }
    hasESearchBox() { return this.eSearchBox instanceof HTMLDivElement; }
    get eSearchInput() { return this.#eSearchInput; }
    hasESearchInput() { return this.eSearchInput instanceof HTMLInputElement; }
    get eSearchBtn() { return this.#eSearchBtn; }
    hasESearchBtn() { return this.eSearchBtn instanceof HTMLButtonElement; }
    get eCreateBtn() { return this.#eCreateBtn; }
    hasECreateBtn() { return this.eCreateBtn instanceof HTMLButtonElement; }
    get eTemplates() { return this.#eTemplates; }
    hasETemplates() { return this.eTemplates instanceof HTMLDivElement; }
    get eContent() { return this.#eContent; }
    hasEContent() { return this.eContent instanceof HTMLDivElement; }
    get eLoading() { return this.#eLoading; }
    hasELoading() { return this.eLoading instanceof HTMLDivElement; }
    get eEmpty() { return this.#eEmpty; }
    hasEEmpty() { return this.eEmpty instanceof HTMLDivElement; }

    async enter(data) {
        if (this.hasApp() && this.app.hasEProjectsBtn())
            this.app.eProjectsBtn.classList.add("this");
        Array.from(document.querySelectorAll(".forproject")).forEach(elem => { elem.style.display = "none"; });
        await this.refresh();
    }
};
App.ProjectsPage.Button =  class AppProjectsPageButton extends core.Target {
    #page;

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

        this.#page = null;

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

        this.elem.addEventListener("contextmenu", e => {
            let itm;
            let menu = new core.App.ContextMenu();
            itm = menu.addItem(new core.App.ContextMenu.Item("Open"));
            itm.addHandler("trigger", data => {
                this.eEdit.click();
            });
            menu.addItem(new core.App.ContextMenu.Divider());
            itm = menu.addItem(new core.App.ContextMenu.Item("Delete"));
            itm.addHandler("trigger", data => {
                this.post("cmd-delete", this.project.id);
            });
            itm = menu.addItem(new core.App.ContextMenu.Item("Duplicate"));
            itm.addHandler("trigger", data => {
                this.post("cmd-savecopy", this.project);
            });
            if (!this.hasApp()) return;
            this.app.contextMenu = menu;
            this.app.placeContextMenu(e.pageX, e.pageY);
        });
        this.eEdit.addEventListener("click", e => {
            if (!this.hasApp()) return;
            this.app.setPage("PROJECT", { id: this.project.id });
        });

        this.project = project;

        this.addHandler("update", data => {
            if (!this.hasProject()) return;
            this.name = this.project.meta.name;
            this.time = this.project.meta.modified;
            this.eImage.style.backgroundImage = "url('"+this.project.meta.thumb+"')";
        });
    }

    get page() { return this.#page; }
    set page(v) {
        v = (v instanceof App.ProjectsPage) ? v : null;
        if (this.page == v) return;
        this.#page = v;
    }
    hasPage() { return this.page instanceof App.ProjectsPage; }
    get app() { return this.hasPage() ? this.page.app : null; }
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

    update() { this.post("update", null); }
};
App.ProjectPage = class AppProjectPage extends App.Page {
    #renderItems;
    #selected;
    #selectItem;
    #selectedPaths;

    #globalScale;

    #choosing;
    #chooseState;

    #maximized;
    #divPos;

    #panels;

    #eDisplay;
    #eChooseDoneBtn;
    #eChooseCancelBtn;
    #eRender;
    #eXAxis; #eYAxis;
    #eDisplayNav;
    #eMaxMinBtn;
    #eEdit;
    #eEditContent;
    #eEditNav;
    #eDivider;

    constructor(app) {
        super("PROJECT", app);

        if (!this.hasApp()) return;

        this.app.addHandler("perm", async data => {
            this.app.markChange("*all");
            try {
                await this.app.syncFilesWith();
            } catch (e) {
                let alert = this.app.alert("There was an error saving your projects!", "warning");
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
            await this.app.post("cmd-save", null);
            lock = false;
        }, 10000);

        if (this.app.hasEProjectInfoNameInput())
            this.app.eProjectInfoNameInput.addEventListener("change", e => {
                if (this.choosing) return;
                if (!this.app.hasProject()) return;
                this.app.project.meta.name = this.app.eProjectInfoNameInput.value;
                this.post("refresh-options", null);
            });

        this.#renderItems = new Set();

        this.#selected = new Set();
        this.#selectItem = null;

        this.#selectedPaths = new Set();

        this.#globalScale = 1;

        this.addHandler("refresh-selectitem", data => {
            this.selected.forEach(id => {
                if (!this.app.hasProject() || !this.app.project.hasItem(id)) return;
                let itm = this.app.project.getItem(id);
                itm.x = Math.min(this.app.project.w, Math.max(0, itm.x));
                itm.y = Math.min(this.app.project.h, Math.max(0, itm.y));
                itm.post("change", null);
            });
            if (this.selected.length > 1) {
                if (!this.hasSelectItem())
                    this.#selectItem = this.addRenderItem(new RISelect());
                let maxPos = new V(), minPos = new V();
                let first = true;
                this.selected.forEach(id => {
                    if (!this.app.hasProject() || !this.app.project.hasItem(id)) return;
                    let itm = this.app.project.getItem(id);
                    let bbox = itm.getBBox();
                    if (first) {
                        first = false;
                        maxPos.set(bbox.tr);
                        minPos.set(bbox.bl);
                        return;
                    }
                    maxPos.x = Math.max(maxPos.x, bbox.r);
                    maxPos.y = Math.max(maxPos.y, bbox.t);
                    minPos.x = Math.min(minPos.x, bbox.l);
                    minPos.y = Math.min(minPos.y, bbox.b);
                });
                this.selectItem.a = minPos;
                this.selectItem.b = maxPos;
            } else {
                this.remRenderItem(this.selectItem);
                this.#selectItem = null;
            }
        });
        this.addHandler("refresh-options", data => {
            let names = new Set();
            this.app.projects.forEach(id => {
                let project = this.app.getProject(id);
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
            if (this.app.hasEProjectInfoNameInput())
                this.app.eProjectInfoNameInput.value = this.app.hasProject() ? this.app.project.meta.name : "";
            if (this.app.hasEProjectInfoBtn())
                if (this.app.eProjectInfoBtn.querySelector(":scope > .value") instanceof HTMLDivElement)
                    this.app.eProjectInfoBtn.querySelector(":scope > .value").textContent = this.app.hasProject() ? this.app.project.meta.name : "";
        });

        
        this.app.addHandler("project-set", data => {
            this.post("refresh-options", null);
        });

        const background = new RIBackground();
        let oldW = null, oldH = null, padding = 40;

        this.addHandler("update", data => {
            this.addRenderItem(background);
            let w = (this.hasApp() && this.app.hasProject()) ? this.app.project.w : 0;
            let h = (this.hasApp() && this.app.hasProject()) ? this.app.project.h : 0;
            background.src = (this.hasApp() && this.app.hasProject()) ? this.app.project.meta.backgroundImage : null;
            background.pos = (this.hasApp() && this.app.hasProject()) ? this.app.project.meta.backgroundPos : 0;
            background.scale = (this.hasApp() && this.app.hasProject()) ? this.app.project.meta.backgroundScale : 0;
            let newW = false, newH = false;
            if (oldW != w) [oldW, newW] = [w, true];
            if (oldH != h) [oldH, newH] = [h, true];
            this.globalScale = 1;
            if (this.hasERender()) {
                let parent = this.eRender.parentElement;
                let rParent = document.body.getBoundingClientRect();
                if (parent instanceof HTMLElement) {
                    let r = rParent = parent.getBoundingClientRect();
                    this.globalScale = Math.min((r.width-(padding*2)) / w, (r.height-(padding*2)) / h);
                }
                this.eRender.style.width = (w*this.globalScale)+"px";
                this.eRender.style.height = (h*this.globalScale)+"px";
                let r = this.eRender.getBoundingClientRect();
                let xGrid = Array.from(this.eRender.querySelectorAll(":scope > .grid.x"));
                let nXGrid = xGrid.length;
                while (nXGrid < Math.max(0, Math.ceil(h/100)-1)) {
                    nXGrid++;
                    let grid = document.createElement("div");
                    grid.classList.add("grid");
                    grid.classList.add("x");
                    if (this.eRender.children.length > 0) this.eRender.insertBefore(grid, this.eRender.children[0]);
                    else this.eRender.appendChild(grid);
                }
                while (nXGrid > Math.max(0, Math.ceil(h/100)-1)) {
                    nXGrid--;
                    xGrid.pop().remove();
                }
                Array.from(this.eRender.querySelectorAll(":scope > .grid.x")).forEach((grid, i) => { grid.style.bottom = ((i+1) * (100/h) * (r.height - 4))+"px"; });
                let yGrid = Array.from(this.eRender.querySelectorAll(":scope > .grid.y"));
                let nYGrid = yGrid.length;
                while (nYGrid < Math.max(0, Math.ceil(w/100)-1)) {
                    nYGrid++;
                    let grid = document.createElement("div");
                    grid.classList.add("grid");
                    grid.classList.add("y");
                    if (this.eRender.children.length > 0) this.eRender.insertBefore(grid, this.eRender.children[0]);
                    else this.eRender.appendChild(grid);
                }
                while (nYGrid > Math.max(0, Math.ceil(w/100)-1)) {
                    nYGrid--;
                    yGrid.pop().remove();
                }
                Array.from(this.eRender.querySelectorAll(":scope > .grid.y")).forEach((grid, i) => { grid.style.left = ((i+1) * (100/w) * (r.width - 4))+"px"; });
                if (this.hasEXAxis()) {
                    let axis = this.eXAxis;
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
                if (this.hasEYAxis()) {
                    let axis = this.eYAxis;
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
                this.eRender.style.setProperty("--scale", this.globalScale);
            }
            let itmsUsed = new Set();
            this.renderItems.forEach(itm => {
                itm.update();
                if (itm instanceof RISelectable) {
                    if (itm.ghost) return;
                    if (!this.app.hasProject() || !this.app.project.hasItem(itm.item))
                        itm.item = null;
                    if (itm.hasItem()) {
                        itmsUsed.add(itm.item.id);
                        itm.selected = this.isSelected(itm);
                    } else this.remRenderItem(itm);
                }
            });
            if (this.app.hasProject()) {
                let need;
                need = new Set(this.app.project.items);
                itmsUsed.forEach(id => need.delete(id));
                need.forEach(id => this.addRenderItem(new RISelectable(this.app.project.getItem(id))));
            }
        });

        if (!this.hasElem()) return;

        this.#eDisplay = this.elem.querySelector(":scope > .display");
        if (this.hasEDisplay()) {
            this.eDisplay.addEventListener("keydown", e => {
                if (this.choosing) return;
                if (!this.hasApp()) return;
                if (!this.app.hasProject()) return;
                if (["Backspace", "Delete"].includes(e.code)) {
                    this.selected.forEach(id => this.app.project.remItem(id));
                    this.selected = this.selected;
                } else if (e.code == "KeyA") {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.selected = this.app.project.items;
                    }
                } else if (e.code == "KeyX") {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.cut();
                    }
                } else if (e.code == "KeyC") {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.copy();
                    }
                } else if (e.code == "KeyV") {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.paste();
                    }
                }
            });
        }

        this.#choosing = false;
        this.#chooseState = null;

        this.#eChooseDoneBtn = this.elem.querySelector(":scope > .display > .render > .nav > button#donebtn");
        this.#eChooseCancelBtn = this.elem.querySelector(":scope > .display > .render > .nav > button#cancelbtn");
        if (this.hasEChooseDoneBtn())
            this.eChooseDoneBtn.addEventListener("click", e => {
                e.stopPropagation();
                if (!this.choosing) return;
                let chooseState = this.chooseState;
                for (let id in chooseState.temp) this.remRenderItem(chooseState.temp[id]);
                chooseState.post("done", null);
                this.choosing = false;
            });
        if (this.hasEChooseCancelBtn())
            this.eChooseCancelBtn.addEventListener("click", e => {
                e.stopPropagation();
                if (!this.choosing) return;
                let chooseState = this.chooseState;
                for (let id in chooseState.temp) this.remRenderItem(chooseState.temp[id]);
                chooseState.post("cancel", null);
                this.choosing = false;
            });
        
        this.#eRender = this.elem.querySelector(":scope > .display > .render");
        if (this.hasERender()) {
            this.eRender.addEventListener("contextmenu", e => {
                if (this.choosing) return;
                let itm;
                let menu = new core.App.ContextMenu();
                itm = menu.addItem(new core.App.ContextMenu.Item("Add Node", "add"));
                itm.addHandler("trigger", data => {
                    this.app.post("cmd-addnode", null);
                });
                itm = menu.addItem(new core.App.ContextMenu.Item("Add Obstacle", "add"));
                itm.addHandler("trigger", data => {
                    this.app.post("cmd-addobstacle", null);
                });
                itm = menu.addItem(new core.App.ContextMenu.Item("Add Path", "add"));
                itm.addHandler("trigger", data => {
                    this.app.post("cmd-addpath", null);
                });
                menu.addItem(new core.App.ContextMenu.Divider());
                itm = menu.addItem(new core.App.ContextMenu.Item("Cut"));
                itm.shortcut = "⌘X";
                itm.addHandler("trigger", data => {
                    if (this.choosing) return;
                    this.cut();
                });
                itm = menu.addItem(new core.App.ContextMenu.Item("Copy"));
                itm.shortcut = "⌘C";
                itm.addHandler("trigger", data => {
                    if (this.choosing) return;
                    this.copy();
                });
                itm = menu.addItem(new core.App.ContextMenu.Item("Paste"));
                itm.shortcut = "⌘V";
                itm.addHandler("trigger", data => {
                    if (this.choosing) return;
                    this.paste();
                });
                itm = menu.addItem(new core.App.ContextMenu.Item("Select All"));
                itm.shortcut = "⌘A";
                itm.addHandler("trigger", data => {
                    if (this.choosing) return;
                    if (!this.app.hasProject()) return;
                    this.selected = this.app.project.items;
                });
                menu.addItem(new core.App.ContextMenu.Divider());
                itm = menu.addItem(new core.App.ContextMenu.Item("Edit"));
                itm.addHandler("trigger", data => {
                    this.panel = "objects";
                });
                itm = menu.addItem(new core.App.ContextMenu.Item("Delete"));
                itm.shortcut = "⌫";
                itm.addHandler("trigger", data => {
                    if (this.choosing) return;
                    if (!this.app.hasProject()) return;
                    this.selected.forEach(id => this.app.project.remItem(id));
                    this.selected = this.selected;
                });
                this.app.contextMenu = menu;
                this.app.placeContextMenu(e.pageX, e.pageY);
            });
            this.eRender.addEventListener("mousedown", e => {
                if (this.choosing) return;
                if (e.button != 0) return;
                if (e.target == this.eRender || this.selected.length <= 0) {
                    this.clearSelected();
                    let selectItem = this.addRenderItem(new RISelect());
                    selectItem.a = selectItem.pageToMap(e.pageX, e.pageY);
                    selectItem.b = selectItem.a;
                    const mouseup = () => {
                        document.body.removeEventListener("mouseup", mouseup);
                        document.body.removeEventListener("mousemove", mousemove);
                        this.remRenderItem(selectItem);
                        let a = selectItem.a, b = selectItem.b;
                        let r = new util.Rect(a, b.sub(a)).normalize();
                        if (!this.app.hasProject()) return;
                        this.app.project.items.forEach(id => {
                            let itm = this.app.project.getItem(id);
                            if (r.collides(itm.getBBox())) this.addSelected(itm);
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
                        this.selected.forEach(id => {
                            if (!this.app.hasProject() || !this.app.hasProject() || !this.app.project.hasItem(id)) return;
                            let itm = this.app.project.getItem(id);
                            itm.pos.iadd(rel);
                            itm.post("change", null);
                        });
                        oldPos.set(newPos);
                        this.post("refresh-selectitem", null);
                        this.post("refresh-options", null);
                    };
                    document.body.addEventListener("mouseup", mouseup);
                    document.body.addEventListener("mousemove", mousemove);
                }
            });
        }

        this.#eXAxis = this.elem.querySelector(":scope > .display > .axis.x");
        this.#eYAxis = this.elem.querySelector(":scope > .display > .axis.y");
        this.#eDisplayNav = this.elem.querySelector(":scope > .display > .nav");

        if (this.hasEDisplayNav()) {
            this.#eMaxMinBtn = this.eDisplayNav.querySelector("button#maxminbtn");
            if (this.hasEMaxMinBtn())
                this.eMaxMinBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.app.post("cmd-maxmin", null);
                });
        }

        this.#eEdit = this.elem.querySelector(":scope > .edit");
        this.#eEditContent = this.elem.querySelector(":scope > .edit > .content");
        this.#eEditNav = this.elem.querySelector(":scope > .edit > .nav");
        if (this.hasEEditNav())
            this.eEditNav.addEventListener("click", e => e.stopPropagation());
        
        this.#maximized = null;
        this.#divPos = null;
        
        this.#eDivider = this.elem.querySelector(":scope > .divider");
        if (this.hasEDivider())
            this.eDivider.addEventListener("mousedown", e => {
                if (this.choosing) return;
                if (e.button != 0) return;
                const mouseup = () => {
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                    this.eDivider.classList.remove("this");
                };
                const mousemove = e => {
                    let parent = this.eDivider.parentElement;
                    if (!(parent instanceof HTMLDivElement)) return;
                    let r = parent.getBoundingClientRect();
                    this.divPos = Math.min(0.9, Math.max(0.1, (e.pageX-r.left) / r.width));
                };
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
                this.eDivider.classList.add("this");
            });
        
        this.#panels = {
            objects: (o, elem) => {
                this.app.addHandler("project-set", data => {
                    let has = this.app.hasProject();
                    o.btn.disabled = !has;
                    if (o.ePositionXInput instanceof HTMLButtonElement)
                        o.ePositionXInput.disabled = !has;
                    if (o.ePositionYInput instanceof HTMLButtonElement)
                        o.ePositionYInput.disabled = !has;
                    if (o.eItemRem instanceof HTMLButtonElement)
                        o.eItemRem.disabled = !has;
                });
                this.addHandler("refresh-options", data => {
                    let has = this.app.hasProject();
                    let forAny = Array.from(elem.querySelectorAll(":scope .forany"));
                    let forNode = Array.from(elem.querySelectorAll(":scope .fornode"));
                    let forObstacle = Array.from(elem.querySelectorAll(":scope .forobstacle"));
                    let itms = this.selected.filter(id => has && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                    let allNode = (itms.length > 0), allObstacle = (itms.length > 0);
                    itms.forEach(itm => {
                        if (!(itm instanceof subcore.Project.Node)) allNode = false;
                        if (!(itm instanceof subcore.Project.Obstacle)) allObstacle = false;
                    });
                    forAny.forEach(elem => (itms.length > 0) ? elem.classList.add("this") : elem.classList.remove("this"));
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
                o.eSpawnBox = elem.querySelector(":scope #spawnbox");
                if (o.eSpawnBox instanceof HTMLDivElement) {
                    o.eSpawnDelete = o.eSpawnBox.querySelector(":scope > button.delete");
                    o.spawns = {};
                    ["node", "obstacle"].forEach(name => {
                        let btn = o.spawns[name] = o.eSpawnBox.querySelector(":scope > button.item#spawn"+name);
                        if (btn instanceof HTMLButtonElement) {
                            btn.trigger = e => {
                                if (this.choosing) return;
                                this.app.post("cmd-add"+name, null);
                            };
                            btn.addEventListener("mousedown", btn.trigger);
                        }
                    });
                }
                o.ePositionBox = elem.querySelector(":scope #position");
                if (o.ePositionBox instanceof HTMLDivElement) {
                    o.ePositionXInput = o.ePositionBox.querySelector(":scope > input.x");
                    o.ePositionYInput = o.ePositionBox.querySelector(":scope > input.y");
                    if (o.ePositionXInput instanceof HTMLInputElement)
                        o.ePositionXInput.addEventListener("change", e => {
                            let v = o.ePositionXInput.value;
                            if (v.length > 0) {
                                let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                                let x = itms.map(itm => itm.x);
                                let newCenter = util.ensure(parseFloat(v), "num")*100;
                                let oldCenter = (Math.max(...x) + Math.min(...x)) / 2;
                                let rel = newCenter - oldCenter;
                                itms.forEach(itm => {
                                    itm.pos.iadd(rel, 0);
                                    itm.post("change", null);
                                });
                                this.post("refresh-selectitem", null);
                            }
                            this.post("refresh-options", null);
                        });
                    if (o.ePositionYInput instanceof HTMLInputElement)
                        o.ePositionYInput.addEventListener("change", e => {
                            let v = o.ePositionYInput.value;
                            if (v.length > 0) {
                                let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                                let y = itms.map(itm => itm.y);
                                let newCenter = util.ensure(parseFloat(v), "num")*100;
                                let oldCenter = (Math.max(...y) + Math.min(...y)) / 2;
                                let rel = newCenter - oldCenter;
                                itms.forEach(itm => {
                                    itm.pos.iadd(0, rel);
                                    itm.post("change", null);
                                });
                                this.post("refresh-selectitem", null);
                            }
                            this.post("refresh-options", null);
                        });
                }
                o.eHeadingUseBox = elem.querySelector(":scope #headinguse");
                if (o.eHeadingUseBox instanceof HTMLLabelElement) {
                    o.eHeadingUse = o.eHeadingUseBox.querySelector("input[type='checkbox']");
                    if (o.eHeadingUse instanceof HTMLInputElement)
                        o.eHeadingUse.addEventListener("change", e => {
                            let v = o.eHeadingUse.checked;
                            let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                            itms.forEach(itm => {
                                if (!(itm instanceof subcore.Project.Node)) return;
                                itm.useHeading = v;
                            });
                            this.post("refresh-selectitem", null);
                            this.post("refresh-options", null);
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
                                let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                                itms.forEach(itm => {
                                    if (!(itm instanceof subcore.Project.Node)) return;
                                    itm.heading = v;
                                });
                                this.post("refresh-selectitem", null);
                            }
                            this.post("refresh-options", null);
                        });
                    o.eHeadingDragBox = o.eHeadingBox.querySelector(":scope > .dragbox");
                    if (o.eHeadingDragBox instanceof HTMLDivElement)
                        o.eHeadingDragBox.addEventListener("mousedown", e => {
                            const place = e => {
                                let r = o.eHeadingDragBox.getBoundingClientRect();
                                let center = new V(r.left + r.width/2, r.top + r.height/2).mul(+1, -1);
                                let to = new V(e.pageX, e.pageY).mul(+1, -1);
                                let v = (Math.PI/180)*center.towards(to);
                                let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                                itms.forEach(itm => {
                                    if (!(itm instanceof subcore.Project.Node)) return;
                                    itm.heading = v;
                                });
                                this.post("refresh-selectitem", null);
                                this.post("refresh-options", null);
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
                            let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                            itms.forEach(itm => {
                                if (!(itm instanceof subcore.Project.Node)) return;
                                itm.useVelocity = v;
                            });
                            this.post("refresh-selectitem", null);
                            this.post("refresh-options", null);
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
                                let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                                itms.forEach(itm => {
                                    if (!(itm instanceof subcore.Project.Node)) return;
                                    itm.velocityX = v*100;
                                    itm.post("change", null);
                                });
                                this.post("refresh-selectitem", null);
                            }
                            this.post("refresh-options", null);
                        });
                    o.eVelocityYInput = o.eVelocityBox.querySelector(":scope > input.y");
                    if (o.eVelocityYInput instanceof HTMLInputElement)
                        o.eVelocityYInput.addEventListener("change", e => {
                            let v = o.eVelocityYInput.value;
                            if (v.length > 0) {
                                v = util.ensure(parseFloat(v), "num");
                                let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                                itms.forEach(itm => {
                                    if (!(itm instanceof subcore.Project.Node)) return;
                                    itm.velocityY = v*100;
                                    itm.post("change", null);
                                });
                                this.post("refresh-selectitem", null);
                            }
                            this.post("refresh-options", null);
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
                                let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                                itms.forEach(itm => {
                                    if (!(itm instanceof subcore.Project.Node)) return;
                                    itm.velocityRot = v;
                                });
                                this.post("refresh-selectitem", null);
                            }
                            this.post("refresh-options", null);
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
                                let itms = this.selected.filter(id => this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
                                itms.forEach(itm => {
                                    if (!(itm instanceof subcore.Project.Obstacle)) return;
                                    itm.radius = v*100;
                                });
                                this.post("refresh-selectitem", null);
                            }
                            this.post("refresh-options", null);
                        });
                }
                o.eItemControls = elem.querySelector(":scope #itemcontrols");
                if (o.eItemControls instanceof HTMLDivElement) {
                    o.eItemRem = o.eItemControls.querySelector(":scope > button#removebtn");
                    if (o.eItemRem instanceof HTMLButtonElement)
                        o.eItemRem.addEventListener("click", e => {
                            if (this.choosing) return;
                            if (!this.app.hasProject()) return;
                            this.selected.forEach(id => this.app.project.remItem(id));
                            this.selected = this.selected;
                        });
                }
            },
            paths: (o, elem) => {
                let generating = false;
                o.getGenerating = () => generating;
                o.setGenerating = v => {
                    v = !!v;
                    if (v == o.getGenerating()) return true;
                    generating = v;
                    this.post("refresh-options", null);
                    return true;
                };
                let buttons = new Set();
                document.body.addEventListener("click", e => {
                    if (this.choosing) return;
                    if (this.hasERender() && this.eRender.contains(e.target)) return;
                    this.clearSelectedPaths();
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
                    btn.page = this;
                    btn._onTrigger = () => {
                        this.clearSelectedPaths();
                        this.addSelectedPath(btn);
                    };
                    btn._onEdit = () => {
                        btn._onTrigger();
                        if (this.choosing) return;
                        if (!this.app.hasProject()) return;
                        let pths = this.selectedPaths;
                        if (pths.length <= 0) return;
                        let id = pths[0];
                        if (!this.app.project.hasPath(id)) return;
                        let pth = this.app.project.getPath(id);
                        this.choosing = true;
                        let chooseState = this.chooseState;
                        chooseState.path = pth;
                        let nodes = pth.nodes;
                        chooseState.addHandler("choose", data => {
                            if (!(chooseState.path instanceof subcore.Project.Path)) return;
                            let path = chooseState.path;
                            data = util.ensure(data, "obj");
                            let itm = data.itm, shift = data.shift;
                            if (!(itm instanceof subcore.Project.Node)) return;
                            if (shift) path.remNode(itm);
                            else path.addNode(itm);
                            for (let id in chooseState.temp) this.remRenderItem(chooseState.temp[id]);
                            chooseState.temp = {};
                            let nodes = path.nodes.filter(id => this.app.hasProject() && this.app.project.hasItem(id));
                            for (let i = 0; i < nodes.length; i++) {
                                let id = nodes[i];
                                let node = this.app.project.getItem(id);
                                if (id in chooseState.temp) {
                                    chooseState.temp[id].value += ", "+(i+1);
                                } else {
                                    chooseState.temp[id] = this.addRenderItem(new RIPathIndex(node));
                                    chooseState.temp[id].value = i+1;
                                }
                                if (i > 0) {
                                    let id2 = nodes[i-1];
                                    let node2 = this.app.project.getItem(id2);
                                    chooseState.temp[id+"~"+id2] = this.addRenderItem(new RIPathLine(node, node2));
                                }
                            }
                        });
                        chooseState.addHandler("done", data => {
                        });
                        chooseState.addHandler("cancel", data => {
                            if (!(chooseState.path instanceof subcore.Project.Path)) return;
                            chooseState.path.nodes = nodes;
                        });
                    };
                    btn._onRemove = () => {
                        btn._onTrigger();
                        if (this.choosing) return;
                        if (!this.app.hasProject()) return;
                        this.selectedPaths.forEach(id => this.app.project.remPath(id));
                        this.selectedPaths = this.selectedPaths;
                    };
                    btn._onChange = () => {
                        this.post("refresh-selectitem", null);
                        this.post("refresh-options", null);
                    };
                    btn.addHandler("trigger", btn._onTrigger);
                    btn.addHandler("edit", btn._onEdit);
                    btn.addHandler("remove", btn._onRemove);
                    btn.addHandler("change", btn._onChange);
                    if (o.ePathsBox instanceof HTMLDivElement) o.ePathsBox.appendChild(btn.elem);
                    this.post("refresh-options", null);
                    return btn;
                };
                this.remPathButton = btn => {
                    if (!(btn instanceof PathButton)) return false;
                    if (!this.hasPathButton(btn)) return false;
                    buttons.delete(btn);
                    btn.remHandler("trigger", btn._onTrigger);
                    btn.remHandler("edit", btn._onEdit);
                    btn.remHandler("remove", btn._onRemove);
                    btn.remHandler("change", btn._onChange);
                    delete btn._onTrigger;
                    delete btn._onEdit;
                    delete btn._onRemove;
                    delete btn._onChange;
                    btn.post("rem", null);
                    if (o.ePathsBox instanceof HTMLDivElement) o.ePathsBox.removeChild(btn.elem);
                    btn.page = null;
                    this.post("refresh-options", null);
                    return btn;
                };
                this.addHandler("update", data => {
                    let pthsUsed = new Set();
                    this.getPathButtons().forEach(btn => {
                        btn.showLines = btn.hasPath() ? !this.hasPathVisual(btn.path.id) : true;
                        btn.update();
                        if (!this.app.hasProject() || !this.app.project.hasPath(btn.path))
                            btn.path = null;
                        if (btn.hasPath()) {
                            pthsUsed.add(btn.path.id);
                            btn.selected = this.isPathSelected(btn);
                        } else this.remPathButton(btn);
                    });
                    if (this.app.hasProject()) {
                        let need;
                        need = new Set(this.app.project.paths);
                        if (pthsUsed.size < need.size) {
                            pthsUsed.forEach(id => need.delete(id));
                            need.forEach(id => this.addPathButton(new PathButton(this.app.project.getPath(id))));
                        }
                    }
                });
                this.app.addHandler("project-set", data => {
                    let has = this.app.hasProject();
                    o.btn.disabled = !has;
                    if (o.ePathAdd instanceof HTMLButtonElement)
                        o.ePathAdd.disabled = !has;
                    o.checkPathVisual();
                });
                this.addHandler("refresh-options", data => {
                    let has = this.app.hasProject();
                    if (o.ePathRem instanceof HTMLButtonElement)
                        o.ePathRem.disabled = !has || (this.selectedPaths.length <= 0);
                    if (o.ePathEdit instanceof HTMLButtonElement)
                        o.ePathEdit.disabled = !has || (this.selectedPaths.length <= 0);
                    if (o.eActivateBtn instanceof HTMLButtonElement) {
                        o.eActivateBtn.disabled = !o.getGenerating() && (!has || this.selectedPaths.length <= 0);
                        o.eActivateBtn.textContent = o.getGenerating() ? "Terminate" : "Generate";
                        o.eActivateBtn.classList.remove("on");
                        o.eActivateBtn.classList.remove("off");
                        o.getGenerating() ? o.eActivateBtn.classList.add("off") : o.eActivateBtn.classList.add("on");
                    }
                    this.getPathButtons().forEach(btn => {
                        btn.post("set", data);
                        if (this.isPathSelected(btn)) btn.post("add", null);
                        else btn.post("rem", null);
                    });
                });
                o.ePathAdd = elem.querySelector(":scope #pathaddbtn");
                if (o.ePathAdd instanceof HTMLButtonElement)
                    o.ePathAdd.addEventListener("click", e => {
                        if (this.choosing) return;
                        if (!this.app.hasProject()) return;
                        this.choosing = true;
                        let chooseState = this.chooseState;
                        chooseState.path = new subcore.Project.Path();
                        chooseState.addHandler("choose", data => {
                            if (!(chooseState.path instanceof subcore.Project.Path)) return;
                            let path = chooseState.path;
                            data = util.ensure(data, "obj");
                            let itm = data.itm, shift = data.shift;
                            if (!(itm instanceof subcore.Project.Node)) return;
                            if (shift) path.remNode(itm);
                            else path.addNode(itm);
                            for (let id in chooseState.temp) this.remRenderItem(chooseState.temp[id]);
                            chooseState.temp = {};
                            let nodes = path.nodes.filter(id => this.app.hasProject() && this.app.project.hasItem(id));
                            for (let i = 0; i < nodes.length; i++) {
                                let id = nodes[i];
                                let node = this.app.project.getItem(id);
                                if (id in chooseState.temp) {
                                    chooseState.temp[id].value += ", "+(i+1);
                                } else {
                                    chooseState.temp[id] = this.addRenderItem(new RIPathIndex(node));
                                    chooseState.temp[id].value = i+1;
                                }
                                if (i > 0) {
                                    let id2 = nodes[i-1];
                                    let node2 = this.app.project.getItem(id2);
                                    chooseState.temp[id+"~"+id2] = this.addRenderItem(new RIPathLine(node, node2));
                                }
                            }
                        });
                        chooseState.addHandler("done", data => {
                            if (!(chooseState.path instanceof subcore.Project.Path)) return;
                            let path = chooseState.path;
                            if (!this.app.hasProject()) return;
                            this.app.project.addPath(path);
                        });
                        chooseState.addHandler("cancel", data => {
                        });
                    });
                o.ePathsBox = elem.querySelector(":scope #pathsbox");
                if (this.hasERender()) {
                    o.eProgress = this.eRender.querySelector(":scope > .progress");
                    if (o.eProgress instanceof HTMLDivElement) {
                        o.eProgressBtn = o.eProgress.querySelector(":scope > button");
                        if (o.eProgressBtn instanceof HTMLButtonElement)
                            o.eProgressBtn.addEventListener("click", e => {
                                let visuals = this.getPathVisuals().filter(id => this.isPathSelected(id));
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
                                if (this.choosing) return;
                                if (e.button != 0) return;
                                e.stopPropagation();
                                const mouseup = () => {
                                    document.body.removeEventListener("mouseup", mouseup);
                                    document.body.removeEventListener("mousemove", mousemove);
                                };
                                const mousemove = e => {
                                    let r = o.eProgressBar.getBoundingClientRect();
                                    let p = (e.pageX-r.left) / r.width;
                                    let visuals = this.getPathVisuals().filter(id => this.isPathSelected(id));
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
                    visual.page = this;
                    return visual;
                };
                this.remPathVisual = v => {
                    if (util.is(v, "str")) {
                        if (!this.hasPathVisual(v)) return false;
                        let visual = pathVisuals[v];
                        delete pathVisuals[v];
                        visual.id = null;
                        visual.page = null;
                        return visual;
                    }
                    if (v instanceof PathVisual) return this.remPathVisual(v.id);
                    return false;
                };
                this.addHandler("update", data => {
                    let visuals = [];
                    this.getPathVisuals().forEach(id => {
                        let visual = this.getPathVisual(id);
                        visual.show = this.isPathSelected(id);
                        if (visual.show) visuals.push(id);
                        visual.update();
                        if (!this.app.hasProject() || !this.app.project.hasPath(id))
                            this.remPathVisual(id);
                    });
                    if (visuals.length <= 0) {
                        if (this.hasEDisplay()) this.eDisplay.classList.remove("progress");
                        return;
                    }
                    if (this.hasEDisplay()) this.eDisplay.classList.add("progress");
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
                    if (!this.app.hasProject()) return;
                    try {
                        let projectId = this.app.projectId;
                        let datas = await window.api.ask("exec-get", [projectId]);
                        if (!util.is(datas, "obj")) return;
                        if (this.app.projectId != projectId) return;
                        for (let id in datas) {
                            let data = datas[id];
                            if (!util.is(data, "obj")) continue;
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
                        return;
                        let alert = this.alert("There was an error checking for generated trajectories!", "warning");
                        alert.hasInfo = true;
                        alert.info = String(e);
                        alert.iconColor = "var(--cr)";
                    }
                };
                o.eActivateBtn = elem.querySelector(":scope #activatebtn");
                if (o.eActivateBtn instanceof HTMLButtonElement)
                    o.eActivateBtn.addEventListener("click", e => {
                        e.stopPropagation();
                        if (o.getGenerating()) {
                            window.api.ask("exec-term");
                            return;
                        }
                        let projectId = this.app.projectId;
                        if (!this.app.hasProject(projectId)) return;
                        let project = this.app.getProject(projectId);
                        if (this.selectedPaths.length <= 0) return;
                        let id = this.selectedPaths[0];
                        if (!project.hasPath(id)) return;
                        let path = project.getPath(id);
                        e.stopPropagation();
                        o.setGenerating(false);
                        (async () => {
                            o.setGenerating(true);
                            this.app.markChange("*all");
                            await this.post("cmd-save", null);
                            try {
                                await window.api.ask("exec", [project.id, path.id]);
                                await o.checkPathVisual();
                                this.getPathVisuals().forEach(id => {
                                    let visual = this.getPathVisual(id);
                                    if (!this.isPathSelected(id)) return;
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
            },
            options: (o, elem) => {
                this.app.addHandler("project-set", data => {
                    let has = this.app.hasProject();
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
                    if (o.eMomentOfInertiaInput instanceof HTMLInputElement)
                        o.eMomentOfInertiaInput.disabled = !has;
                    if (o.eEfficiencyInput instanceof HTMLInputElement)
                        o.eEfficiencyInput.disabled = !has;
                    if (o.eIs12MotorModeInput instanceof HTMLInputElement)
                        o.eIs12MotorModeInput.disabled = !has;
                    if (o.eScriptDefault instanceof HTMLInputElement)
                        o.eScriptDefault.disabled = !has;
                });
                this.addHandler("refresh-options", data => {
                    let has = this.app.hasProject();
                    if (o.eSizeWInput instanceof HTMLInputElement)
                        o.eSizeWInput.value = has ? this.app.project.w/100 : "";
                    if (o.eSizeHInput instanceof HTMLInputElement)
                        o.eSizeHInput.value = has ? this.app.project.h/100 : "";
                    if (o.eRobotSizeWInput instanceof HTMLInputElement)
                        o.eRobotSizeWInput.value = has ? this.app.project.robotW/100 : "";
                    if (o.eRobotSizeHInput instanceof HTMLInputElement)
                        o.eRobotSizeHInput.value = has ? this.app.project.robotH/100 : "";
                    if (o.eRobotMassInput instanceof HTMLInputElement)
                        o.eRobotMassInput.value = has ? this.app.project.robotMass : "";
                    if (o.eBackgroundXInput instanceof HTMLInputElement)
                        o.eBackgroundXInput.value = has ? this.app.project.meta.backgroundX/100 : "";
                    if (o.eBackgroundYInput instanceof HTMLInputElement)
                        o.eBackgroundYInput.value = has ? this.app.project.meta.backgroundY/100 : "";
                    if (o.eBackgroundScaleInput instanceof HTMLInputElement)
                        o.eBackgroundScaleInput.value = has ? this.app.project.meta.backgroundScale*100 : "";
                    if (o.eMomentOfInertiaInput instanceof HTMLInputElement)
                        o.eMomentOfInertiaInput.value = has ? this.app.project.config.momentOfInertia : "";
                    if (o.eEfficiencyInput instanceof HTMLInputElement)
                        o.eEfficiencyInput.value = has ? this.app.project.config.efficiency*100 : "";
                    if (o.eIs12MotorModeInput instanceof HTMLInputElement)
                        o.eIs12MotorModeInput.checked = has ? this.app.project.config.is12MotorMode : false;
                    if (o.eScriptInput instanceof HTMLInputElement) {
                        o.eScriptInput.value = has ? this.app.project.config.script : "";
                        o.eScriptInput.disabled = !has || this.app.project.config.scriptUseDefault;
                    }
                    if (o.eScriptBrowse instanceof HTMLButtonElement)
                        o.eScriptBrowse.disabled = !has || this.app.project.config.scriptUseDefault;
                    if (o.eScriptDefault instanceof HTMLInputElement)
                        o.eScriptDefault.checked = has ? this.app.project.config.scriptUseDefault : false;
                });
                o.eSizeBox = elem.querySelector(":scope #size");
                if (o.eSizeBox instanceof HTMLDivElement) {
                    o.eSizeWInput = o.eSizeBox.querySelector(":scope > input.w");
                    o.eSizeHInput = o.eSizeBox.querySelector(":scope > input.h");
                    if (o.eSizeWInput instanceof HTMLInputElement)
                        o.eSizeWInput.addEventListener("change", e => {
                            let v = o.eSizeWInput.value;
                            if (v.length > 0) {
                                v = Math.max(util.ensure(parseFloat(v), "num"));
                                if (this.app.hasProject()) {
                                    this.app.project.w = v*100;
                                    this.app.project.post("change", null);
                                    this.post("refresh-selectitem");
                                }
                            }
                            this.post("refresh-options", null);
                        });
                    if (o.eSizeHInput instanceof HTMLInputElement)
                        o.eSizeHInput.addEventListener("change", e => {
                            let v = o.eSizeHInput.value;
                            if (v.length > 0) {
                                v = Math.max(util.ensure(parseFloat(v), "num"));
                                if (this.app.hasProject()) {
                                    this.app.project.h = v*100;
                                    this.app.project.post("change", null);
                                    this.post("refresh-selectitem");
                                }
                            }
                            this.post("refresh-options", null);
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
                                if (this.app.hasProject()) {
                                    this.app.project.robotW = v*100;
                                    this.app.project.post("change", null);
                                    this.post("refresh-selectitem");
                                }
                            }
                            this.post("refresh-options", null);
                        });
                    if (o.eRobotSizeHInput instanceof HTMLInputElement)
                        o.eRobotSizeHInput.addEventListener("change", e => {
                            let v = o.eRobotSizeHInput.value;
                            if (v.length > 0) {
                                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                if (this.app.hasProject()) {
                                    this.app.project.robotH = v*100;
                                    this.app.project.post("change", null);
                                }
                                this.post("refresh-selectitem");
                            }
                            this.post("refresh-options", null);
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
                                if (this.app.hasProject())
                                    this.app.project.robotMass = v;
                            }
                            this.post("refresh-options", null);
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
                                if (this.app.hasProject()) {
                                    this.app.project.meta.backgroundX = v*100;
                                    this.app.project.post("change", null);
                                }
                            }
                            this.post("refresh-options", null);
                        });
                    o.eBackgroundYInput = o.eBackgroundBox.querySelector(":scope > div > input.y");
                    if (o.eBackgroundYInput instanceof HTMLInputElement)
                        o.eBackgroundYInput.addEventListener("change", e => {
                            let v = o.eBackgroundYInput.value;
                            if (v.length > 0) {
                                v = util.ensure(parseFloat(v), "num");
                                if (this.app.hasProject()) {
                                    this.app.project.meta.backgroundY = v*100;
                                    this.app.project.post("change", null);
                                }
                            }
                            this.post("refresh-options", null);
                        });
                    o.eBackgroundScaleInput = o.eBackgroundBox.querySelector(":scope > input");
                    if (o.eBackgroundScaleInput instanceof HTMLInputElement)
                        o.eBackgroundScaleInput.addEventListener("change", e => {
                            let v = o.eBackgroundScaleInput.value;
                            if (v.length > 0) {
                                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                if (this.app.hasProject())
                                    this.app.project.meta.backgroundScale = v/100;
                            }
                            this.post("refresh-options", null);
                        });
                }
                o.eMomentOfInertiaBox = elem.querySelector(":scope #momentofinertia");
                if (o.eMomentOfInertiaBox instanceof HTMLDivElement) {
                    o.eMomentOfInertiaInput = o.eMomentOfInertiaBox.querySelector(":scope > input");
                    if (o.eMomentOfInertiaInput instanceof HTMLInputElement)
                        o.eMomentOfInertiaInput.addEventListener("change", e => {
                            let v = o.eMomentOfInertiaInput.value;
                            if (v.length > 0) {
                                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                                if (this.app.hasProject())
                                    this.app.project.config.momentOfInertia = v;
                            }
                            this.post("refresh-options", null);
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
                                if (this.app.hasProject())
                                    this.app.project.config.efficiency = v/100;
                            }
                            this.post("refresh-options", null);
                        });
                }
                o.eIs12MotorModeBox = elem.querySelector(":scope #is12motormode");
                if (o.eIs12MotorModeBox instanceof HTMLLabelElement) {
                    o.eIs12MotorModeInput = o.eIs12MotorModeBox.querySelector("input[type='checkbox']");
                    if (o.eIs12MotorModeInput instanceof HTMLInputElement)
                        o.eIs12MotorModeInput.addEventListener("change", e => {
                            let v = o.eIs12MotorModeInput.checked;
                            this.app.project.config.is12MotorMode = v;
                            this.post("refresh-options", null);
                        });
                }
                o.eScriptBox = elem.querySelector(":scope #script");
                if (o.eScriptBox instanceof HTMLDivElement) {
                    o.eScriptInput = o.eScriptBox.querySelector(":scope > .filedialog > input");
                    if (o.eScriptInput instanceof HTMLInputElement)
                        o.eScriptInput.addEventListener("change", e => {
                            let v = o.eScriptInput.value;
                            if (this.app.hasProject())
                                this.app.project.config.script = (v.length > 0) ? v : null;
                            this.post("refresh-options", null);
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
                                    if (this.app.hasProject())
                                        this.app.project.config.script = (v.length > 0) ? v : null;
                                    this.post("refresh-options", null);
                                }
                            });
                            dialog.click();
                        });
                }
                o.eScriptDefaultBox = elem.querySelector(":scope #scriptdefault");
                if (o.eScriptDefaultBox instanceof HTMLLabelElement) {
                    o.eScriptDefault = o.eScriptDefaultBox.querySelector("input[type='checkbox']");
                    if (o.eScriptDefault instanceof HTMLInputElement)
                        o.eScriptDefault.addEventListener("change", e => {
                            let v = o.eScriptDefault.checked;
                            if (this.app.hasProject())
                                this.app.project.config.scriptUseDefault = v;
                            this.post("refresh-options", null);
                        });
                }
            },
        };
        for (let name in this.#panels) {
            let f = this.#panels[name];
            let elem = document.getElementById(name+"panel");
            let btn = document.getElementById("editnav"+name);
            let o = this.#panels[name] = new core.Target();
            if (btn instanceof HTMLButtonElement)
                btn.addEventListener("click", e => {
                    if (this.choosing) return;
                    this.panel = name;
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
            o.addHandler("show-change", data => {
                let show = o.getShown();
                if (elem instanceof HTMLDivElement) {
                    if (show) elem.classList.add("this");
                    else elem.classList.remove("this");
                }
                if (btn instanceof HTMLButtonElement) {
                    if (show) btn.classList.add("this");
                    else btn.classList.remove("this");
                }
            });
            if (!(elem instanceof HTMLDivElement)) continue;
            if (!(btn instanceof HTMLButtonElement)) continue;
            f(o, elem);
        }
    }

    async refresh() {
        if (!this.hasApp()) return;
        try {
            await this.app.syncWithFiles();
        } catch (e) {
            let alert = this.app.alert("There was an error loading your projects!", "warning");
            alert.hasInfo = true;
            alert.info = String(e);
            alert.iconColor = "var(--cr)";
        }
        this.panel = "objects";
        this.maximized = false;
        this.divPos = 0.75;
        this.choosing = false;
        this.app.dragging = false;
    }

    get renderItems() { return [...this.#renderItems]; }
    set renderItems(v) {
        v = util.ensure(v, "arr");
        this.clearRenderItems();
        v.forEach(v => this.addRenderItem(v));
    }
    clearRenderItems() {
        let itms = this.renderItems;
        itms.forEach(itm => this.remRenderItem(itm));
        return itms;
    }
    hasRenderItem(itm) {
        if (!(itm instanceof RenderItem)) return false;
        return this.#renderItems.has(itm) && itm.page == this;
    }
    addRenderItem(itm) {
        if (!(itm instanceof RenderItem)) return false;
        if (itm.page != null) return false;
        if (this.hasRenderItem(itm)) return false;
        this.#renderItems.add(itm);
        itm.page = this;
        itm._onChange = () => {
            this.post("refresh-selectitem", null);
            this.post("refresh-options", null);
        };
        itm.addHandler("change", itm._onChange);
        if (itm instanceof RISelectable) {
            itm._onTrigger = data => {
                if (this.choosing) this.chooseState.post("choose", { itm: itm.item, shift: util.ensure(data, "obj").shift });
                else {
                    if (util.ensure(data, "obj").shift) {
                        if (this.isSelected(itm)) this.remSelected(itm);
                        else this.addSelected(itm);
                    } else {
                        if (this.isSelected(itm)) return;
                        this.clearSelected();
                        this.addSelected(itm);
                    }
                }
            };
            itm.addHandler("trigger", itm._onTrigger);
        }
        if (this.hasERender()) this.eRender.appendChild(itm.elem);
        return itm;
    }
    remRenderItem(itm) {
        if (!(itm instanceof RenderItem)) return false;
        if (itm.page != this) return false;
        if (!this.hasRenderItem(itm)) return false;
        this.#renderItems.delete(itm);
        itm.page = null;
        itm.remHandler("change", itm._onChange);
        delete itm._onChange;
        if (itm instanceof RISelectable) {
            itm.remHandler("trigger", itm._onTrigger);
            delete itm._onTrigger;
        }
        if (this.hasERender()) this.eRender.removeChild(itm.elem);
        return itm;
    }

    get selected() { return [...this.#selected]; }
    set selected(v) {
        v = util.ensure(v, "arr");
        this.clearSelected();
        v.forEach(v => this.addSelected(v));
    }
    clearSelected() {
        let sels = this.selected;
        sels.forEach(id => this.remSelected(id));
        return sels;
    }
    isSelected(v) {
        if (util.is(v, "str")) return this.#selected.has(v);
        if (v instanceof subcore.Project.Item) return this.isSelected(v.id);
        if (v instanceof RISelectable) return this.isSelected(v.item);
        return false;
    }
    addSelected(v) {
        if (util.is(v, "str")) {
            if (this.hasApp() && this.app.hasProject() && this.app.project.hasItem(v)) {
                this.#selected.add(v);
                this.post("refresh-selectitem", null);
                this.post("refresh-options", null);
                return v;
            }
            return false;
        }
        if (v instanceof subcore.Project.Item) return this.addSelected(v.id);
        if (v instanceof RISelectable) return this.addSelected(v.item);
        return false;
    }
    remSelected(v) {
        if (util.is(v, "str")) {
            this.#selected.delete(v);
            this.post("refresh-selectitem", null);
            this.post("refresh-options", null);
            return v;
        }
        if (v instanceof subcore.Project.Item) return this.remSelected(v.id);
        if (v instanceof RISelectable) return this.remSelected(v.item);
        return false;
    }

    get selectedPaths() { return [...this.#selectedPaths]; }
    set selectedPaths(v) {
        v = util.ensure(v, "arr");
        this.clearSelectedPaths();
        v.forEach(v => this.addSelectedPath(v));
    }
    clearSelectedPaths() {
        let pths = this.selectedPaths;
        pths.forEach(id => this.remSelectedPath(id));
        return pths;
    }
    isPathSelected(v) {
        if (util.is(v, "str")) return this.#selectedPaths.has(v);
        if (v instanceof subcore.Project.Path) return this.isPathSelected(v.id);
        if (v instanceof PathButton) return this.isPathSelected(v.path);
        return false;
    }
    addSelectedPath(v) {
        if (util.is(v, "str")) {
            if (this.hasApp() && this.app.hasProject() && this.app.project.hasPath(v)) {
                this.#selectedPaths.add(v);
                this.post("refresh-options", null);
                return v;
            }
            return false;
        }
        if (v instanceof subcore.Project.Path) return this.addSelectedPath(v.id);
        if (v instanceof PathButton) return this.addSelectedPath(v.path);
        return false;
    }
    remSelectedPath(v) {
        if (util.is(v, "str")) {
            this.#selectedPaths.delete(v);
            this.post("refresh-options", null);
            return v;
        }
        if (v instanceof subcore.Project.Path) return this.remSelectedPath(v.id);
        if (v instanceof PathButton) return this.remSelectedPath(v.path);
        return false;
    }

    get selectItem() { return this.#selectItem; }
    hasSelectItem() { return this.selectItem instanceof RISelect; }

    get globalScale() { return this.#globalScale; }
    set globalScale(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.globalScale == v) return;
        this.#globalScale = v;
    }

    async cut() {
        await this.copy();
        this.selected.filter(id => this.hasApp() && this.app.hasProject() && this.app.project.hasItem(id)).forEach(id => this.app.project.remItem(id));
        this.post("refresh-selectitem");
        this.post("refresh-options");
    }
    async copy() {
        let itms = this.selected.filter(id => this.hasApp() && this.app.hasProject() && this.app.project.hasItem(id)).map(id => this.app.project.getItem(id));
        if (itms.length <= 0) return;
        let itm = new ClipboardItem({ "text/plain": new Blob([util.MAGIC+JSON.stringify(itms)], { type: "text/plain" })});
        await navigator.clipboard.write([itm]);
        return true;
    }
    async paste() {
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
                    if (!this.hasApp()) return;
                    if (!this.app.hasProject()) return;
                    data.forEach(itm => this.app.project.addItem(itm));
                } catch (e) {}
            });
        });
        return true;
    }

    get choosing() { return this.#choosing; }
    set choosing(v) {
        v = !!v;
        if (this.choosing == v) return;
        this.#choosing = v;
        this.clearSelected();
        this.#chooseState = this.choosing ? new core.Target() : null;
        if (this.choosing) this.chooseState.temp = {};
        this.choosing ? this.eDisplay.classList.add("choose") : this.eDisplay.classList.remove("choose");
    }
    get chooseState() { return this.#chooseState; }

    get maximized() { return this.#maximized; }
    set maximized(v) {
        v = !!v;
        if (this.maximized == v) return;
        this.#maximized = v;
        this.format();
    }
    get minimized() { return !this.maximized; }
    set minimized(v) { this.maximized = !v; }
    maximize() { return this.maximized = true; }
    minimize() { return this.minimized = true; }
    get divPos() { return this.#divPos; }
    set divPos(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.divPos == v) return;
        this.#divPos = v;
        this.format();
    }

    get panels() { return this.#panels; }
    set panel(v) {
        v = String(v);
        for (let name in this.#panels)
            this.#panels[name].setShown(name == v);
        return v in this.#panels;
    }

    get eDisplay() { return this.#eDisplay; }
    hasEDisplay() { return this.eDisplay instanceof HTMLDivElement; }
    get eChooseDoneBtn() { return this.#eChooseDoneBtn; }
    hasEChooseDoneBtn() { return this.eChooseDoneBtn instanceof HTMLButtonElement; }
    get eChooseCancelBtn() { return this.#eChooseCancelBtn; }
    hasEChooseCancelBtn() { return this.eChooseCancelBtn instanceof HTMLButtonElement; }
    get eRender() { return this.#eRender; }
    hasERender() { return this.eRender instanceof HTMLDivElement; }
    get eXAxis() { return this.#eXAxis; }
    hasEXAxis() { return this.eXAxis instanceof HTMLDivElement; }
    get eYAxis() { return this.#eYAxis; }
    hasEYAxis() { return this.eYAxis instanceof HTMLDivElement; }
    get eDisplayNav() { return this.#eDisplayNav; }
    hasEDisplayNav() { return this.eDisplayNav instanceof HTMLDivElement; }
    get eMaxMinBtn() { return this.#eMaxMinBtn; }
    hasEMaxMinBtn() { return this.eMaxMinBtn instanceof HTMLButtonElement; }
    get eEdit() { return this.#eEdit; }
    hasEEdit() { return this.eEdit instanceof HTMLDivElement; }
    get eEditContent() { return this.#eEditContent; }
    hasEEditContent() { return this.eEditContent instanceof HTMLDivElement; }
    get eEditNav() { return this.#eEditNav; }
    hasEEditNav() { return this.eEditNav instanceof HTMLDivElement; }
    get eDivider() { return this.#eDivider; }
    hasEDivider() { return this.eDivider instanceof HTMLDivElement; }

    format() {
        if (this.hasEMaxMinBtn())
            if (this.eMaxMinBtn.children[0] instanceof HTMLElement)
            this.eMaxMinBtn.children[0].setAttribute("name", this.maximized ? "contract" : "expand");
        if (this.maximized) {
            if (this.hasEDisplay())
                this.eDisplay.style.width = "100%";
            if (this.hasEEdit())
                this.eEdit.style.display = "none";
            if (this.hasEDivider())
                this.eDivider.style.display = "none";
        } else {
            if (this.hasEDisplay())
                this.eDisplay.style.width = "calc("+(this.divPos*100)+"% - 6px)";
            if (this.hasEEdit()) {
                this.eEdit.style.display = "";
                this.eEdit.style.width = "calc("+((1-this.divPos)*100)+"% - 6px)";
            }
            if (this.hasEDivider())
                this.eDivider.style.display = "";
        }
    }

    async enter(data) {
        if (this.hasApp() && this.app.hasEProjectsBtn())
            this.app.eProjectsBtn.classList.remove("this");
        Array.from(document.querySelectorAll(".forproject")).forEach(elem => { elem.style.display = ""; });
        if (!this.hasApp()) return;
        await this.refresh();
        if (this.hasEDisplay()) this.eDisplay.focus();
        const globalTemplates = await window.api.getTemplates();
        const globalTemplateImages = await window.api.getTemplateImages();
        const activeTemplate = await window.api.getActiveTemplate();
        let hasTemplates = await window.api.fileHas("templates.json");
        if (!hasTemplates) return console.log("no templates found");
        let templatesContent = null;
        try {
            templatesContent = await window.api.fileRead("templates.json");
        } catch (e) {}
        if (templatesContent == null) return console.log("invalid templates content");
        let templates = null;
        try {
            templates = JSON.parse(templatesContent);
        } catch (e) {}
        if (templates == null) return console.log("error parsing templates");
        templates = util.ensure(templates, "obj");
        if (this.app.hasProject(data.id)) {
            this.app.project = this.app.getProject(data.id);
        } else if (data.project instanceof subcore.Project) {
            this.app.project = data.project;
        } else {
            this.app.project = new subcore.Project();
            this.app.project.meta.created = this.app.project.meta.modified = util.getTime();
            this.app.project.meta.backgroundImage = globalTemplateImages[("template" in data) ? data.template : activeTemplate];
            this.post("refresh-options", null);
        }
        if (this.app.hasProject()) {
            // REMOVE WHEN ALL FIXED
            if (this.app.project.meta.backgroundImage)
                if (this.app.project.meta.backgroundImage.endsWith("template.png"))
                    this.app.project.meta.backgroundImage = globalTemplateImages[activeTemplate];
            for (let name in globalTemplates) {
                if (this.app.project.meta.backgroundImage != globalTemplateImages[name]) continue;
                const globalTemplate = globalTemplates[name];
                let template = util.ensure(templates[name], "obj");
                template[".size"] = globalTemplate["size"];
                template[".robotW"] = globalTemplate["robotSize"];
                template[".robotMass"] = globalTemplate["robotMass"];
                template[".meta.backgroundScale"] = globalTemplate["imageScale"];
                template[".meta.backgroundImage"] = globalTemplateImages[name];
                template[".meta.backgroundPos"] = new V(template[".size"]).div(2);
                for (let k in template) {
                    let v = template[k];
                    k = String(k).split(".");
                    while (k.length > 0 && k.at(0).length <= 0) k.shift();
                    while (k.length > 0 && k.at(-1).length <= 0) k.pop();
                    let obj = this.app.project;
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
                break;
            }
        }
    }
    async leave(data) {
        if (!this.hasApp()) return;
        this.app.markChange("*all");
        await this.app.post("cmd-save", null);
        this.app.project = null;
    }
    async determineSame(data) {
        if (!this.hasApp()) return false;
        if (this.app.hasProject(data.id)) return this.app.projectId == data.id;
        else if (data.project instanceof subcore.Project) return this.app.project == data.project;
        return false;
    }
};
