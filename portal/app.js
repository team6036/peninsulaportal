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

export default class App extends core.App {
    #navToolButtons;

    #eBackground;
    #eCanvas;
    #eNav;
    #eInfo;

    constructor() {
        super();

        this.#navToolButtons = new Set();

        document.body.addEventListener("mousemove", e => {
            if (!this.hasEBackground()) return;
            let x = e.pageX/window.innerWidth;
            let y = e.pageY/window.innerHeight;
            let scale = 0.1;
            this.eBackground.style.setProperty("--x", (100*(scale*(x-0.5)+0.5))+"%");
            this.eBackground.style.setProperty("--y", (100*(scale*(y-0.5)+0.5))+"%");
        });

        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#TITLEPAGE > .inner > .title");
        });
        let ctx = null;
        this.addHandler("start-complete", data => {
            this.#eBackground = document.querySelector("#TITLEPAGE > .background");
            this.#eCanvas = document.querySelector("#TITLEPAGE > #canvas");
            if (this.hasECanvas())
                ctx = this.eCanvas.getContext("2d");
            this.#eNav = document.querySelector("#TITLEPAGE > .inner > .nav");
            this.#eInfo = document.querySelector("#TITLEPAGE > .info");
            if (this.hasEInfo()) {
                this.eInfo.innerHTML = "<div></div><div></div><div></div><div></div>";
                this.eInfo.children[0].textContent = "NodeJS: "+window.version.node();
                this.eInfo.children[1].textContent = "Chrome: "+window.version.chrome();
                this.eInfo.children[2].textContent = "Electron: "+window.version.electron();
                this.eInfo.children[3].innerHTML = "<div class='loading' style='--size:5px;--color:var(--v2);padding:5px;'></div>";
                (async () => {
                    let os = await window.version.os();
                    let data = os.platform+" "+os.arch;
                    if (os.cpus.length > 0) {
                        let models = new Set(os.cpus.map(obj => obj.model));
                        if (models.size > 1) data += " / CPUS: "+[...models].join(", ");
                        else data += " / "+[...models][0];
                    }
                    this.eInfo.children[3].textContent = "OS: "+data;
                })();
            }
            
            let btn;
            btn = this.addNavToolButton(new FeatureButton("Panel", "grid"));
            btn.tooltip = "Coming soon!";
            btn.elem.addEventListener("click", e => window.api.ask("spawn", ["PANEL"]));
            btn = this.addNavToolButton(new FeatureButton("Planner", "analytics"));
            // btn.tooltip = "Coming soon!";
            btn.elem.addEventListener("click", e => window.api.ask("spawn", ["PLANNER"]));
            btn = this.addNavToolButton(new FeatureButton("Pursuit", "flash"));
            btn.tooltip = "Coming soon!";
            btn.elem.addEventListener("click", e => window.api.ask("spawn", ["PURSUIT"]));
            btn = this.addNavToolButton(new FeatureButton("Perception", "eye"));
            btn.tooltip = "Coming soon!";
            btn.elem.addEventListener("click", e => window.api.ask("spawn", ["PERCEPTION"]));

            const update = () => {
                this.post("update", null);
                window.requestAnimationFrame(update);
            };
            window.requestAnimationFrame(update);
        });
        /*
        let size = new V(100, 60);
        let grid = new Array(size.x).fill(null).map((_, x) => new Array(size.y).fill(null).map((_, y) => 0));
        let frameTimer = 0;
        let heads = [];
        let headSpawnTimer = 0;
        const canvasScale = 3;
        let t = null;
        let prevScale = null;
        this.addHandler("update", data => {
            if (!(ctx instanceof CanvasRenderingContext2D)) return;
            let scale = Math.max(window.innerWidth / (size.x*100), window.innerHeight / (size.y*100));
            if (prevScale != scale) {
                prevScale = scale;
                ctx.canvas.width = size.x*100 * scale * canvasScale;
                ctx.canvas.height = size.y*100 * scale * canvasScale;
                ctx.canvas.style.width = (size.x*100 * scale) + "px";
                ctx.canvas.style.height = (size.y*100 * scale) + "px";
            }
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            let color = String(getComputedStyle(document.body).getPropertyValue("--v2"));
            color = color.startsWith("rgba") ? color.slice(4) : color.startsWith("rgb") ? color.slice(3) : null;
            if (color == null) color = [0, 0, 0];
            else {
                color = (color.at(0) == "(" && color.at(-1) == ")") ? color.slice(1, color.length-1) : null;
                if (color == null) color = [0, 0, 0];
                else {
                    color = color.split(",");
                    color = [3, 4].includes(color.length) ? color : null;
                    if (color == null) color = [0, 0, 0];
                    else {
                        if (color.length > 3) color.pop();
                        color = color.map(v => Math.min(255, Math.max(0, util.ensure(parseFloat(v.replace(" ", "")), "num"))));
                    }
                }
            }
            for (let x = 0; x < size.x; x++) {
                for (let y = 0; y < size.y; y++) {
                }
            }
            heads.forEach(head => {
                let pos = new V(head.pos);
                pos.y = size.y - pos.y;
                pos.isub(size.sub(1).div(2));
                pos.imul(100 * scale * canvasScale);
                pos.iadd(ctx.canvas.width/2, ctx.canvas.height/2);
                ctx.fillStyle = "rgb("+color.join(",")+")";
                ctx.beginPath();
                ctx.arc(...pos.xy, 100*scale*canvasScale, 0, 2*Math.PI);
                ctx.fill();
            });
            if (t == null) {
                t = util.getTime();
                return;
            }
            let deltaTime = util.getTime()-t;
            t += deltaTime;
            frameTimer += deltaTime;
            if (frameTimer < (1000/60)) return;
            frameTimer = 0;
            if (heads.length <= 10) {
                if (headSpawnTimer > 0) headSpawnTimer -= deltaTime;
                else {
                    headSpawnTimer = util.lerp(250, 750, Math.random());
                    let possibleSpawns = [];
                    for (let x = 0; x < size.x; x++) {
                        [0, size.y-1].forEach((y, i) => {
                            if (grid[x][y] > 0) return;
                            possibleSpawns.push({
                                pos: new V(x, y),
                                heading: [1, 3][i],
                            });
                        });
                    }
                    for (let y = 0; y < size.y; y++) {
                        [0, size.x-1].forEach((x, i) => {
                            if (grid[x][y] > 0) return;
                            possibleSpawns.push({
                                pos: new V(x, y),
                                heading: [0, 2][i],
                            });
                        });
                    }
                    if (possibleSpawns.length > 0) {
                        let spawn = possibleSpawns[Math.floor(possibleSpawns.length*Math.random())];
                        heads.push({
                            pos: spawn.pos,
                            heading: spawn.heading,
                            count: 0,
                        });
                    }
                }
            }
            [...heads].forEach(head => {
                let forwards = [[+1,0], [0,+1], [-1,0], [0,-1]];
                let possible = {};
                for (let i = -1; i <= 1; i++) {
                    let heading = (((head.heading+i)%4)+4)%4;
                    let nextPos = head.pos.add(forwards[heading]);
                    let g = 0;
                    if (
                        (nextPos.x < 0 || nextPos.x >= size.x) ||
                        (nextPos.y < 0 || nextPos.y >= size.y)
                    );
                    else g = grid[nextPos.x][nextPos.y];
                    if (g > 0) continue;
                    possible[i] = nextPos;
                }
                grid[head.pos.x][head.pos.y] = 10;
                if (possible.length <= 0) {
                    heads.splice(heads.indexOf(head), 1);
                    return;
                }
                let priority = [], priorityMet = false;
                if (head.count >= Math.floor(util.lerp(10, 20, Math.round()))) {
                    head.count = 0;
                    priority = [[+1,-1], [0]];
                } else {
                    head.count++;
                    priority = [[0], [+1,-1]];
                }
                priority.forEach(subPriorities => {
                    if (priorityMet) return;
                    subPriorities.forEach(i => {
                        if (priorityMet) return;
                        if (!(i in possible)) return;
                        priorityMet = true;
                        head.pos.set(possible[i]);
                    });
                });
                if (
                    !priorityMet ||
                    (head.pos.x < 0 || head.pos.x >= size.x) ||
                    (head.pos.y < 0 || head.pos.y >= size.y)
                )
                    heads.splice(heads.indexOf(head), 1);
            });
        });
        */
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
