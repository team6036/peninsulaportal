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
            this.eBackground.style.setProperty("--x", e.pageX+"px");
            this.eBackground.style.setProperty("--y", e.pageY+"px");
        });

        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#TITLEPAGE > .inner > .title");
        });
        let ctx = null;
        this.addHandler("start-complete", data => {
            this.#eBackground = document.querySelector("#TITLEPAGE > .background");
            if (this.hasEBackground() && 0) {
                let size = 50;
                this.eBackground.style.setProperty("--size", size+"px");
                let w = Math.ceil(window.screen.width / (Math.sqrt(3) * size))-5;
                let h = Math.ceil(window.screen.height / (2 * size))-5;
                w = h = Math.max(w, h);
                let totalW = w * (Math.sqrt(3) * size);
                let totalH = h * ((3/2) * size);
                for (let x = 0; x <= w; x++) {
                    for (let y = 0; y <= h; y++) {
                        let icon = document.createElement("ion-icon");
                        this.eBackground.appendChild(icon);
                        let type = "solid";
                        if (y == Math.floor(h/2)+3) {
                            if (x == Math.floor(w/2)) type = 1;
                            else if (x == Math.floor(w/2)+1) type = 2;
                        }
                        if (y == Math.floor(h/2)+2) {
                            if (x == Math.floor(w/2)) type = 3;
                            else if (x == Math.floor(w/2)+1) type = 4;
                        }
                        icon.setAttribute("src", `../assets/logo-part-${type}.svg`);
                        icon.style.setProperty("--x", (((x+0.25) * (Math.sqrt(3) * size)) - ((y%2==0)?(Math.sqrt(3)/2):0)*size - totalW/2)+"px");
                        icon.style.setProperty("--y", ((y * ((3/2) * size)) - totalH/2 + 20)+"px");
                    }
                }
            }
            this.#eCanvas = document.querySelector("#TITLEPAGE > .background > #canvas");
            if (this.hasECanvas())
                ctx = this.eCanvas.getContext("2d");
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
            
            let btn;
            btn = this.addNavToolButton(new FeatureButton("Panel", "grid"));
            // btn.tooltip = "Coming soon!";
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
