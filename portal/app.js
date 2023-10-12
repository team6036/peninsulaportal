import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

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

        this.name = name;
        this.icon = icon;
        this.tooltip = "";
        this.tooltipColor = "";
    }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }
    get eIcon() { return this.#eIcon; }
    get eTooltip() { return this.#eTooltip; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }
    get icon() { return this.eIcon.getAttribute("name"); }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        this.eIcon.setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }
    get tooltip() { return this.eTooltip.textContent; }
    set tooltip(v) {
        this.eTooltip.textContent = v;
        if (this.eTooltip.textContent.length > 0) this.eTooltip.style.visibility = "";
        else this.eTooltip.style.visibility = "hidden";
    }
    get tooltipColor() { return this.eTooltip.style.getPropertyValue("--bg"); }
    set tooltipColor(v) { return this.eTooltip.style.setProperty("--bg", v); }
}

class UpperFeatureButton extends core.Target {
    #elem;
    #eIcon;

    constructor(icon) {
        super();

        this.#elem = document.createElement("button");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);

        this.icon = icon;
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }

    get icon() { return this.eIcon.getAttribute("name"); }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        this.eIcon.setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }
}

class Star extends core.Target {
    #pos;
    #size;
    #streakSize;
    #speed;
    #color;
    #alpha;

    constructor(pos, size, color="--v8") {
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
    #featureButtons;
    #upperFeatureButtons;

    #eBackground;
    #eCanvas;
    #eMain;
    #eContent;
    #eDown; #eUp;
    #eNav;
    #eInfo;
    #eSettingsBtn;
    #eLoads;

    constructor() {
        super();

        this.#featureButtons = new Set();
        this.#upperFeatureButtons = new Set();

        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#PAGE > .main > .title");
        });
        this.addHandler("start-complete", data => {
            this.#eBackground = document.querySelector("#PAGE > .background");
            this.#eCanvas = document.querySelector("#PAGE > .background > div > #canvas");
            if (this.hasECanvas()) {
                const canvas = this.eCanvas;
                const ctx = canvas.getContext("2d");
                const quality = 3;
                const aspect = 16 / 9;
                const aspectBase = 1000;
                let zNear = 1;
                let stars = [], starSpawn = 0;
                let starSize = 0.01, starMaxDist = 0.01, starFadeDist = starMaxDist*0.5, starSpeed = 1;
                let first = true;
                this.addHandler("update", data => {
                    let scroll = (this.hasEContent() ? this.eContent.scrollTop : 0) / window.innerHeight;
                    starSpeed = util.lerp(1, 25, (scroll<0) ? 0 : (scroll>1) ? 1 : scroll);
                    canvas.style.opacity = (util.lerp(100, 0, (scroll<0.5) ? 0 : (scroll>1) ? 1 : ((scroll-0.5)/0.5)))+"%";
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
                                star._speed = -0.01 * util.lerp(0.5, 1.5, Math.random());
                                star.size *= util.lerp(0.75, 1.25, Math.random());
                                star.color = colors[Math.floor(colors.length*Math.random())];
                                star.alpha *= util.lerp(0.5, 1, Math.random());
                                stars.push(star);
                            }
                            starSpawn -= 0.01 * starSpeed;
                        }
                        [...stars].sort((a, b) => b.z-a.z).forEach(star => {
                            star.speed = star._speed * starSpeed;
                            star.streakSize = star.size * Math.abs(star.speed) * 0.25;
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
                            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue(star.color);
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
            this.#eMain = document.querySelector("#PAGE > .main");
            this.#eContent = document.querySelector("#PAGE > .content");
            if (this.hasEContent()) {
                (async () => {
                    let resp = await fetch("../README.md");
                    let text = await resp.text();
                    this.eContent.appendChild(await this.createMarkdown(text));
                })();
                this.addHandler("update", data => {
                    let scroll = this.eContent.scrollTop / window.innerHeight;
                    if (this.hasEMain()) {
                        let p = (scroll<0) ? 0 : (scroll>1) ? 1 : scroll;
                        this.eMain.style.zIndex = (p > 0.5) ? -1 : "";
                        this.eMain.style.transform = "translate(-50%, -50%) scale("+util.lerp(100, 200, p)+"%)";
                        this.eMain.style.opacity = util.lerp(100, 0, p)+"%";
                        this.eMain.style.pointerEvents = (p > 0) ? "none" : "";
                        this.eMain.style.visibility = (p >= 1) ? "hidden" : "";
                    }
                    if (this.hasENav()) {
                        this.eNav.style.opacity = util.lerp(100, 0, (scroll<0) ? 0 : (scroll>0.25) ? 1 : (scroll/0.25))+"%";
                        this.eNav.style.visibility = (scroll < 0.25) ? "" : "hidden";
                    }
                    if (this.hasEDown()) {
                        this.eDown.style.opacity = util.lerp(100, 0, (scroll<0) ? 0 : (scroll>0.25) ? 1 : (scroll/0.25))+"%";
                        this.eDown.style.visibility = (scroll < 0.25) ? "" : "hidden";
                    }
                    if (this.hasEUp()) {
                        if (scroll > 1) this.eUp.classList.add("this");
                        else this.eUp.classList.remove("this");
                    }
                    if (scroll > 1) this.eTitleBar.classList.add("this");
                    else this.eTitleBar.classList.remove("this");
                });
            }
            this.#eNav = document.querySelector("#PAGE > .main > .nav");
            this.#eDown = document.querySelector("#PAGE > .main > button");
            this.#eUp = document.querySelector("#PAGE > button");
            if (this.hasEDown())
                this.eDown.addEventListener("click", e => {
                    if (!this.hasEContent()) return;
                    if (this.eContent.children[0] instanceof HTMLElement)
                        this.eContent.scrollTo({ top: this.eContent.children[0].offsetTop-100, behavior: "smooth" });
                });
            if (this.hasEUp())
                this.eUp.addEventListener("click", e => {
                    if (!this.hasEContent()) return;
                    this.eContent.scrollTo({ top: 0, behavior: "smooth" });
                });
            this.#eInfo = document.querySelector("#PAGE > .info");
            if (this.hasEInfo()) {
                let eLoading = document.createElement("div");
                eLoading.classList.add("loading");
                eLoading.style.setProperty("--size", "5px");
                eLoading.style.setProperty("--color", "var(--v2)");
                eLoading.style.padding = "5px";
                this.eInfo.appendChild(eLoading);
                (async () => {
                    eLoading.remove();
                    (await this.getAboutLines()).forEach(line => {
                        let elem = document.createElement("div");
                        this.eInfo.appendChild(elem);
                        elem.textContent = line;
                    });
                })();
                this.#eSettingsBtn = this.eInfo.querySelector(":scope > .nav > button#settings");
                if (this.hasESettingsBtn())
                    this.eSettingsBtn.addEventListener("click", e => this.post("cmd-spawn", "PRESETS"));
                setInterval(async () => {
                    const dbHostAnchor = this.eInfo.querySelector(":scope > .nav > a#db-host");
                    if (!(dbHostAnchor instanceof HTMLAnchorElement)) return;
                    dbHostAnchor.href = await window.api.get("val-db-host");
                }, 250);
            }
            this.#eLoads = document.querySelector("#PAGE > .loads");

            this.addHandler("cmd-spawn", async name => {
                let isDevMode = await window.api.get("devmode");
                if (!isDevMode && [].includes(name)) {
                    let pop = this.confirm();
                    pop.eContent.innerText = "Are you sure you want to open this feature?\nThis feature is in development and might contain bugs";
                    pop.addHandler("result", async data => {
                        let v = !!util.ensure(data, "obj").v;
                        if (!v) return;
                        window.api.send("spawn", [name]);
                    });
                    return;
                }
                window.api.send("spawn", [name]);
            });
            
            let btn;

            btn = this.addFeatureButton(new FeatureButton("Panel", "grid"));
            // btn.tooltip = "Experimental!";
            // btn.tooltipColor = "var(--cr)";
            btn.elem.addEventListener("click", e => this.post("cmd-spawn", "PANEL"));

            btn = this.addFeatureButton(new FeatureButton("Planner", "analytics"));
            btn.elem.addEventListener("click", e => this.post("cmd-spawn", "PLANNER"));

            btn = this.addFeatureButton(new FeatureButton("Perception", "eye"));
            btn.tooltip = "Coming soon!";
            btn.tooltipColor = "var(--a)";
            btn.elem.addEventListener("click", e => this.post("cmd-spawn", "PERCEPTION"));

            btn = this.addUpperFeatureButton(new UpperFeatureButton("grid"));
            btn.elem.addEventListener("click", e => this.post("cmd-spawn", "PANEL"));

            btn = this.addUpperFeatureButton(new UpperFeatureButton("analytics"));
            btn.elem.addEventListener("click", e => this.post("cmd-spawn", "PLANNER"));

            btn = this.addUpperFeatureButton(new UpperFeatureButton("eye"));
            btn.elem.addEventListener("click", e => this.post("cmd-spawn", "PERCEPTION"));

            let prevLoads = [];
            let lock = false;
            this.addHandler("update", async data => {
                if (lock) return;
                lock = true;
                let loads = await window.api.get("loads");
                if (prevLoads.length == loads.length) {
                    let all = true;
                    for (let i = 0; i < loads.length; i++) {
                        if (loads[i] == prevLoads[i]) continue;
                        all = false;
                        break;
                    }
                    if (all) return lock = false;
                }
                prevLoads = loads;
                if (this.hasELoads()) {
                    this.eLoads.innerHTML = "";
                    loads.forEach(load => this.eLoads.appendChild(core.App.evaluateLoad(load)));
                }
                lock = false;
            });
        });
    }

    get featureButtons() { return [...this.#featureButtons]; }
    set featureButtons(v) {
        v = util.ensure(v, "arr");
        this.clearFeatureButtons();
        v.forEach(v => this.addFeatureButton(v));
    }
    clearFeatureButtons() {
        let btns = this.featureButtons;
        btns.forEach(btn => this.remFeatureButton(btn));
        return btns;
    }
    hasFeatureButton(btn) {
        if (!(btn instanceof FeatureButton)) return false;
        return this.#featureButtons.has(btn);
    }
    addFeatureButton(btn) {
        if (!(btn instanceof FeatureButton)) return false;
        if (this.hasFeatureButton(btn)) return false;
        this.#featureButtons.add(btn);
        if (this.hasENav()) this.eNav.appendChild(btn.elem);
        return btn;
    }
    remFeatureButton(btn) {
        if (!(btn instanceof FeatureButton)) return false;
        if (!this.hasFeatureButton(btn)) return false;
        this.#featureButtons.delete(btn);
        if (this.hasENav()) this.eNav.removeChild(btn.elem);
        return btn;
    }

    get upperFeatureButtons() { return [...this.#upperFeatureButtons]; }
    set upperFeatureButtons(v) {
        v = util.ensure(v, "arr");
        this.clearUpperFeatureButtons();
        v.forEach(v => this.addUpperFeatureButton(v));
    }
    clearUpperFeatureButtons() {
        let btns = this.upperFeatureButtons;
        btns.forEach(btn => this.remUpperFeatureButton(btn));
        return btns;
    }
    hasUpperFeatureButton(btn) {
        if (!(btn instanceof UpperFeatureButton)) return false;
        return this.#featureButtons.has(btn);
    }
    addUpperFeatureButton(btn) {
        if (!(btn instanceof UpperFeatureButton)) return false;
        if (this.hasUpperFeatureButton(btn)) return false;
        this.#upperFeatureButtons.add(btn);
        this.eTitleBar.appendChild(btn.elem);
        return btn;
    }
    remUpperFeatureButton(btn) {
        if (!(btn instanceof UpperFeatureButton)) return false;
        if (!this.hasUpperFeatureButton(btn)) return false;
        this.#upperFeatureButtons.delete(btn);
        this.eTitleBar.removeChild(btn.elem);
        return btn;
    }

    get eBackground() { return this.#eBackground; }
    hasEBackground() { return this.eBackground instanceof HTMLDivElement; }
    get eCanvas() { return this.#eCanvas; }
    hasECanvas() { return this.eCanvas instanceof HTMLCanvasElement; }
    get eMain() { return this.#eMain; }
    hasEMain() { return this.eMain instanceof HTMLDivElement; }
    get eContent() { return this.#eContent; }
    hasEContent() { return this.eContent instanceof HTMLDivElement; }
    get eNav() { return this.#eNav; }
    hasENav() { return this.eNav instanceof HTMLDivElement; }
    get eDown() { return this.#eDown; }
    hasEDown() { return this.eDown instanceof HTMLButtonElement; }
    get eUp() { return this.#eUp; }
    hasEUp() { return this.eUp instanceof HTMLButtonElement; }
    get eInfo() { return this.#eInfo; }
    hasEInfo() { return this.eInfo instanceof HTMLDivElement; }
    get eSettingsBtn() { return this.#eSettingsBtn; }
    hasESettingsBtn() { return this.eSettingsBtn instanceof HTMLButtonElement; }
    get eLoads() { return this.#eLoads; }
    hasELoads() { return this.eLoads instanceof HTMLDivElement; }
}
