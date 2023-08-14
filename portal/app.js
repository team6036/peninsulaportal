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
        this.addHandler("start-complete", data => {
            this.#eBackground = document.querySelector("#TITLEPAGE > .background");
            this.#eNav = document.querySelector("#TITLEPAGE > .inner > .nav");
            this.#eInfo = document.querySelector("#TITLEPAGE > .info");
            if (this.hasEInfo()) {
                this.eInfo.innerHTML = "<div style='font-size:30px;'><ion-icon name='logo-electron'></ion-icon><ion-icon name='logo-ionic'></ion-icon></div><div></div><div></div><div></div><div></div>";
                this.eInfo.children[1].textContent = "NodeJS: "+window.version.node();
                this.eInfo.children[2].textContent = "Chrome: "+window.version.chrome();
                this.eInfo.children[3].textContent = "Electron: "+window.version.electron();
                this.eInfo.children[4].innerHTML = "<div class='loading' style='--size:5px;--color:var(--v2);padding:5px;'></div>";
                (async () => {
                    let os = await window.version.os();
                    let data = os.platform+" "+os.arch;
                    if (os.cpus.length > 0) {
                        let models = new Set(os.cpus.map(obj => obj.model));
                        if (models.size > 1) data += " / CPUS: "+[...models].join(", ");
                        else data += " / "+[...models][0];
                    }
                    this.eInfo.children[4].textContent = "OS: "+data;
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
    get eNav() { return this.#eNav; }
    hasENav() { return this.eNav instanceof HTMLDivElement; }
    get eInfo() { return this.#eInfo; }
    hasEInfo() { return this.eInfo instanceof HTMLDivElement; }
}
