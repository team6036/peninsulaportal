import * as util from "../util.js";
import { V } from "../util.js";

import * as core from "../core.js";

class FeatureButton extends core.Target {
    #elem;
    #eName;
    #eIcon;
    #eTooltip;

    constructor(name, icon) {
        super();

        this.#elem = document.createElement("button");
        this.elem.classList.add("item");
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.insertBefore(this.eIcon, this.eName);
        this.#eTooltip = document.createElement("div");
        this.elem.appendChild(this.eTooltip);
        this.eTooltip.classList.add("tooltip");
        this.eTooltip.classList.add("hov");
        this.eTooltip.classList.add("sx");
        this.eTooltip.style.setProperty("--bg", "var(--a)");

        this.name = name;
        this.icon = icon;
        this.tooltip = "";
    }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }
    get eIcon() { return this.#eIcon; }
    get eTooltip() { return this.#eTooltip; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }
    get icon() { return this.eIcon.getAttribute("name"); }
    set icon(v) { this.eIcon.setAttribute("name", v); }
    get tooltip() { return this.eTooltip.textContent; }
    set tooltip(v) {
        this.eTooltip.textContent = v;
        if (this.eTooltip.textContent.length > 0) this.eTooltip.style.visibility = "inherit";
        else this.eTooltip.style.visibility = "hidden";
    }
}

class Star extends core.Target {
    #pos;
    #size;
    #streakSize;
    #speed;
    #color;
    #alpha;

    constructor(pos, size, color="#fff") {
        super();

        this.#pos = new util.V3();
        this.#size = 0;
        this.#streakSize = 0;
        this.#speed = 0;
        this.#color = null;
        this.#alpha = 1;

        this.pos = pos;
        this.size = size;
        this.color = color;
    }

    get pos() { return this.#pos; }
    set pos(v) { this.#pos.set(v); }
    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }
    get z() { return this.pos.z; }
    set z(v) { this.pos.z = v; }

    get size() { return this.#size; }
    set size(v) { this.#size = Math.max(0, util.ensure(v, "num")); }
    get streakSize() { return this.#streakSize; }
    set streakSize(v) { this.#streakSize = Math.max(0, util.ensure(v, "num")); }
    get speed() { return this.#speed; }
    set speed(v) { this.#speed = util.ensure(v, "num"); }

    get color() { return this.#color; }
    set color(v) { this.#color = v; }

    get alpha() { return this.#alpha; }
    set alpha(v) { this.#alpha = Math.min(1, Math.max(0, util.ensure(v, "num"))); }

    update() { this.pos.z += this.speed; }
}

export default class App extends core.App {
    #navToolButtons;

    #eBackground;
    #eCanvas;
    #eNav;
    #eInfo;

    constructor() {
        super();

        this.#navToolButtons = new Set();

        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#TITLEPAGE > .inner > .title");
        });
        this.addHandler("start-complete", data => {
            this.#eBackground = document.querySelector("#TITLEPAGE > .background");
            this.#eCanvas = document.querySelector("#TITLEPAGE > .background > div > #canvas");
            if (this.hasECanvas()) {
                /*
                const fluid = new Fluid(this.eCanvas);
                fluid.mapBehaviors({
                });
                fluid.activate();
                */
                const mouse = new V(), prevMouse = new V();
                let mouseDown = false;
                document.body.addEventListener("mousemove", e => mouse.set(e.pageX, e.pageY));
                document.body.addEventListener("mousedown", e => { mouseDown = true; });
                document.body.addEventListener("mouseup", e => { mouseDown = false; });
                const canvas = this.eCanvas;
                const ctx = canvas.getContext("2d");
                const quality = 3;
                const aspect = 16 / 9;
                const aspectBase = 1000;
                let zNear = 1;
                let stars = [], starSpawn = 0;
                let starSize = 0.01, starMaxDist = 0.01, starFadeDist = starMaxDist*0.5, starSpeed = 1;
                let first = true;
                let mouseSpeedMin = 10, mouseSpeedMax = 500, mousePressed = 0;
                this.addHandler("update", data => {
                    let d = prevMouse.dist(mouse);
                    if (mouseDown && mousePressed < 100) mousePressed++;
                    if (!mouseDown && mousePressed > 0) mousePressed--;
                    starSpeed = util.lerp(1, 15, ((mousePressed/100) + 0*((d<mouseSpeedMin) ? 0 : (d>mouseSpeedMax) ? 1 : ((d-mouseSpeedMin)/(mouseSpeedMax-mouseSpeedMin)))) / 1);
                    prevMouse.set(mouse);
                    let scale = Math.max(window.innerWidth/aspect, window.innerHeight/1);
                    let w = scale*aspect, h = scale;
                    if (canvas.width != w*quality) canvas.width = w*quality;
                    if (canvas.height != w*quality) canvas.height = h*quality;
                    canvas.style.width = w+"px";
                    canvas.style.height = h+"px";
                    for (let f = (first ? 60*10 : 1)-1; f >= 0; f--) {
                        if (f <= 0) ctx.clearRect(0, 0, canvas.width, canvas.height);
                        if (stars.length < 1000) {
                            while (starSpawn < 0) {
                                starSpawn += util.lerp(0.01, 0.1, Math.random());
                                let boundW = aspectBase * aspect * zNear;
                                let boundH = aspectBase * zNear;
                                let outerW = aspectBase * aspect * zNear * 5;
                                let outerH = aspectBase * zNear * 5;
                                let pos;
                                do {
                                    pos = new V(util.lerp(-outerW/2, +outerW/2, Math.random()), util.lerp(-outerH/2, +outerH/2, Math.random()));
                                } while (Math.abs(pos.x) < boundW/2 && Math.abs(pos.y) < boundH/2);
                                let colors = ["--v8", "--a"];
                                let star = new Star([pos.x, pos.y, aspectBase*starMaxDist], aspectBase*starSize, "");
                                star.size *= util.lerp(0.75, 1.25, Math.random());
                                star.color = getComputedStyle(document.body).getPropertyValue(colors[Math.floor(colors.length*Math.random())]);
                                star.alpha *= util.lerp(0.5, 1, Math.random());
                                stars.push(star);
                            }
                            starSpawn -= 0.01 * starSpeed;
                        }
                        [...stars].forEach(star => {
                            star.speed = -0.01 * starSpeed;
                            star.streakSize = star.size * Math.abs(star.speed) * 0.1;
                            star.update();
                            if (star.z + star.streakSize/2 < zNear) {
                                stars.splice(stars.indexOf(star), 1);
                                return;
                            }
                            if (f > 0) return;
                            let z1 = Math.max(zNear, star.z + star.streakSize/2);
                            let z2 = Math.max(zNear, star.z - star.streakSize/2);
                            let pos1 = new V(star.x, star.y).div(z1).div(aspectBase).mul(scale * quality).mul(+1,-1).add(canvas.width/2, canvas.height/2);
                            let r1 = star.size / z1 * quality;
                            let pos2 = new V(star.x, star.y).div(z2).div(aspectBase).mul(scale * quality).mul(+1,-1).add(canvas.width/2, canvas.height/2);
                            let r2 = star.size / z2 * quality;
                            let a = star.alpha * ((star.z/aspectBase < (starMaxDist-starFadeDist)) ? 1 : 1-(star.z/aspectBase-(starMaxDist-starFadeDist))/starFadeDist);
                            ctx.fillStyle = star.color;
                            ctx.globalAlpha = a;
                            ctx.beginPath();
                            if (star.streakSize <= 0) {
                                for (let i = 0; i <= 12; i++) {
                                    let pos = pos1.add(V.dir((i/12)*360, r1).mul(+1,-1));
                                    if (i > 0) ctx.lineTo(...pos.xy);
                                    else ctx.moveTo(...pos.xy);
                                }
                            } else {
                                let dir = pos1.towards(pos2);
                                let rDiff = r2 - r1;
                                let d = pos2.dist(pos1);
                                let theta = new V().towards(d, rDiff);
                                let poly = [];
                                for (let i = 0; i <= 12; i++)
                                    poly.push(pos1.add(V.dir(util.lerp(dir-1*theta+270, dir-3*theta+90, i/12), r1)));
                                for (let i = 0; i <= 12; i++)
                                    poly.push(pos2.add(V.dir(util.lerp(dir-3*theta+90, dir-5*theta-90, i/12), r2)));
                                for (let i = 0; i <= poly.length; i++) {
                                    let pos = poly[i%poly.length];
                                    if (i > 0) ctx.lineTo(...pos.xy);
                                    else ctx.moveTo(...pos.xy);
                                }
                            }
                            ctx.fill();
                        });
                    }
                    if (first) first = false;
                });
            }
            this.#eNav = document.querySelector("#TITLEPAGE > .inner > .nav");
            this.#eInfo = document.querySelector("#TITLEPAGE > .info");
            if (this.hasEInfo()) {
                this.eInfo.innerHTML = "<div class='loading' style='--size:5px;--color:var(--v2);padding:5px;'></div>";
                (async () => {
                    let about = await this.getAbout();
                    this.eInfo.innerHTML = new Array(4).fill("<div></div>").join("");
                    this.eInfo.children[0].textContent = "NodeJS: "+about.node;
                    this.eInfo.children[1].textContent = "Chrome: "+about.chrome;
                    this.eInfo.children[2].textContent = "Electron: "+about.electron;
                    this.eInfo.children[3].textContent = "OS: "+about.os.platform+" "+about.os.arch;
                    if (about.os.cpus.length > 0) {
                        let models = [...new Set(about.os.cpus.map(obj => obj.model))];
                        this.eInfo.children[3].textContent += " / ";
                        if (models.length > 1) this.eInfo.children[4].textContent += "CPUS: "+models.join(", ");
                        else this.eInfo.children[3].textContent += models[0];
                    }
                })();
            }

            this.addHandler("cmd-spawn", name => window.api.ask("spawn", [name]));
            
            let btn;
            btn = this.addNavToolButton(new FeatureButton("Panel", "grid"));
            // btn.tooltip = "Coming soon!";
            btn.elem.addEventListener("click", e => this.post("cmd-spawn", "PANEL"));
            btn = this.addNavToolButton(new FeatureButton("Planner", "analytics"));
            // btn.tooltip = "Coming soon!";
            btn.elem.addEventListener("click", e => this.post("cmd-spawn", "PLANNER"));
            btn = this.addNavToolButton(new FeatureButton("Pursuit", "flash"));
            btn.tooltip = "Coming soon!";
            btn.elem.addEventListener("click", e => this.post("cmd-spawn", "PURSUIT"));
        });
    }

    get navToolButtons() { return [...this.#navToolButtons]; }
    set navToolButtons(v) {
        v = util.ensure(v, "arr");
        this.clearNavToolButtons();
        v.forEach(v => this.addNavToolButton(v));
    }
    clearNavToolButtons() {
        let btns = this.navToolButtons;
        btns.forEach(btn => this.remNavButton(btn));
        return btns;
    }
    hasNavToolButton(btn) {
        if (!(btn instanceof FeatureButton)) return false;
        return this.#navToolButtons.has(btn);
    }
    addNavToolButton(btn) {
        if (!(btn instanceof FeatureButton)) return false;
        if (this.hasNavToolButton(btn)) return false;
        this.#navToolButtons.add(btn);
        if (this.hasENav()) this.eNav.appendChild(btn.elem);
        return btn;
    }
    remNavButton(btn) {
        if (!(btn instanceof FeatureButton)) return false;
        if (!this.hasNavToolButton(btn)) return false;
        this.#navToolButtons.delete(btn);
        if (this.hasENav()) this.eNav.removeChild(btn.elem);
        return btn;
    }

    get eBackground() { return this.#eBackground; }
    hasEBackground() { return this.eBackground instanceof HTMLDivElement; }
    get eCanvas() { return this.#eCanvas; }
    hasECanvas() { return this.eCanvas instanceof HTMLCanvasElement; }
    get eNav() { return this.#eNav; }
    hasENav() { return this.eNav instanceof HTMLDivElement; }
    get eInfo() { return this.#eInfo; }
    hasEInfo() { return this.eInfo instanceof HTMLDivElement; }
}
