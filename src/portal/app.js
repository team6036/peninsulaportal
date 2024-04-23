import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";

import * as THREE from "three";


class FeatureButton extends util.Target {
    #elem;
    #eName;
    #eIcon;
    #eTooltip;

    constructor(name, icon) {
        super();

        this.#elem = document.createElement("button");
        this.elem.classList.add("item");
        this.elem.classList.add("normal");
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.insertBefore(this.eIcon, this.eName);
        this.#eTooltip = document.createElement("p-tooltip");
        this.eTooltip.classList.add("hov");
        this.eTooltip.classList.add("sx");

        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
        });

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
    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) { this.eIcon.setAttribute("src", v); }
    get tooltip() { return this.eTooltip.textContent; }
    set tooltip(v) {
        this.eTooltip.textContent = v;
        if (this.eTooltip.textContent.length > 0) this.eTooltip.style.visibility = "";
        else this.eTooltip.style.visibility = "hidden";
    }
    get tooltipColor() { return this.eTooltip.style.getPropertyValue("--bg"); }
    set tooltipColor(v) { return this.eTooltip.style.setProperty("--bg", v); }
}

class UpperFeatureButton extends util.Target {
    #elem;
    #eIcon;

    constructor(icon) {
        super();

        this.#elem = document.createElement("button");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);

        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
        });

        this.icon = icon;
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }

    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) { this.eIcon.setAttribute("src", v); }
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

        this.addHandler("pre-setup", () => {
            this.eLoadingTo = document.querySelector("#PAGE > .main > .title");
        });
        let reducedMotion = false;
        this.addHandler("cmd-check", async () => (reducedMotion = !!(await window.api.get("reduced-motion"))));
        this.addHandler("post-setup", () => {
            this.#eBackground = document.querySelector("#PAGE > .background");
            this.#eCanvas = document.querySelector("#PAGE > .background > div > #canvas");
            if (this.hasECanvas()) {
                let opacity = 0;
                const getScroll = () => (this.hasEContent() ? this.eContent.scrollTop : 0) / window.innerHeight;
                const getSpeed = () => {
                    let scroll = getScroll();
                    return util.lerp(1, 25, (scroll<0) ? 0 : (scroll>1) ? 1 : scroll)*0.02;
                };
                let ff = 10;
                const parallax = new core.Parallax(this.eCanvas);
                this.addHandler("update", delta => {
                    opacity = util.lerpE(opacity, +!reducedMotion, 0.25);
                    parallax.run = ff ? 60 : 1;
                    if (ff) ff--;
                    const scroll = getScroll();
                    parallax.canvas.style.opacity = (opacity * util.lerp(100, 0, (scroll<0.5) ? 0 : (scroll>1) ? 1 : ((scroll-0.5)/0.5)))+"%";
                    parallax.w = window.innerWidth;
                    parallax.h = window.innerHeight;
                    parallax.speed = getSpeed();
                    parallax.update(delta);
                    parallax.type = (this.holiday == "july4") ? "july4" : null;
                });
            }
            this.#eMain = document.querySelector("#PAGE > .main");
            this.#eContent = document.querySelector("#PAGE > .content");
            if (this.hasEContent()) {
                (async () => {
                    let signal = new util.Target();
                    signal.addHandler("nav", (e, href) => this.addPopup(new App.MarkdownPopup(href)));
                    this.eContent.appendChild(await this.createMarkdown("../README.md", signal));
                })();
                this.addHandler("update", delta => {
                    let scroll = this.eContent.scrollTop / window.innerHeight;
                    if (this.hasEMain()) {
                        let p = (scroll<0) ? 0 : (scroll>1) ? 1 : scroll;
                        this.eMain.style.zIndex = (p > 0.5) ? -1 : "";
                        this.eMain.style.transform = "translate(-50%, -50%) scale("+util.lerp(1, 2, p)+")";
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
                const form = new core.Form();
                form.addField(new core.Form.BooleanInput("bool-inp", false));
                form.addField(new core.Form.BooleanInput("bool-inp", true));
                form.addField(new core.Form.Button("btn", "Button", "normal"));
                form.addField(new core.Form.Button("btn", "Button", "special"));
                form.addField(new core.Form.ColorInput("color-inp", "#00ffff"));
                form.addField(new core.Form.DirentInput("dirent-inp", "/path/to/file.txt"));
                form.addField(new core.Form.DropdownInput("dropdown-inp", ["a", "b", "c"], null)).app = this;
                form.addField(new core.Form.Header("Header"));
                form.addField(new core.Form.Input1d("inp-1d", 1));
                form.addField(new core.Form.Input2d("inp-2d", [2, 3]));
                form.addField(new core.Form.Input3d("inp-3d", [4, 5, 6]));
                form.addField(new core.Form.JSONInput("json-inp"));
                form.addField(new core.Form.Line());
                form.addField(new core.Form.SelectInput("select-inp", ["d", "e", "f"], null));
                form.addField(new core.Form.SubHeader("SubHeader"));
                form.addField(new core.Form.TextInput("text-inp"));
                form.addField(new core.Form.ToggleInput("toggle-inp", "Toggle", false));
                form.addField(new core.Form.ToggleInput("toggle-inp", "Toggle", true));
                // this.eContent.appendChild(form.elem);
            }
            this.#eNav = document.querySelector("#PAGE > .main > .nav");
            this.#eDown = document.querySelector("#PAGE > .main > button");
            this.#eUp = document.querySelector("#PAGE > button");
            if (this.hasEDown())
                this.eDown.addEventListener("click", e => {
                    e.stopPropagation();
                    if (!this.hasEContent()) return;
                    if (this.eContent.children[0])
                        this.eContent.scrollTo({ top: this.eContent.children[0].offsetTop-100, behavior: "smooth" });
                });
            if (this.hasEUp())
                this.eUp.addEventListener("click", e => {
                    e.stopPropagation();
                    if (!this.hasEContent()) return;
                    this.eContent.scrollTo({ top: 0, behavior: "smooth" });
                });
            this.#eInfo = document.querySelector("#PAGE > .info");
            if (this.hasEInfo()) {
                const putAgent = () => {
                    Array.from(this.eInfo.querySelectorAll(":scope > div:not(.nav)")).forEach(elem => elem.remove());
                    this.getAgent().forEach(line => {
                        let elem = document.createElement("div");
                        this.eInfo.appendChild(elem);
                        elem.textContent = line;
                    });
                }
                putAgent();
                window.onBuildAgent(putAgent);
                this.#eSettingsBtn = this.eInfo.querySelector(":scope > .nav > button#settings");
                if (this.hasESettingsBtn())
                    this.eSettingsBtn.addEventListener("click", e => {
                        e.stopPropagation();
                        this.post("cmd-spawn", "PRESETS");
                    });
                const timer = new util.Timer(true);
                this.addHandler("update", async () => {
                    if (!timer.dequeueAll(250)) return;
                    await Promise.all(["repo", "db-host", "scout-url"].map(async name => {
                        const anchor = this.eInfo.querySelector(":scope > .nav > a#"+name);
                        if (!(anchor instanceof HTMLAnchorElement)) return;
                        anchor.href = await window.api.get(name);
                    }));
                });
            }
            this.#eLoads = document.querySelector("#PAGE > .loads");

            lib.APPFEATURES.forEach(name => {
                let btn;
                btn = this.addFeatureButton(new FeatureButton(lib.getName(name), lib.getIcon(name)));
                btn.addHandler("trigger", e => this.post("cmd-spawn", name));
                btn = this.addUpperFeatureButton(new UpperFeatureButton(lib.getIcon(name)));
                btn.addHandler("trigger", e => this.post("cmd-spawn", name));
            });

            let prevLoads = [];
            let lock = false;
            this.addHandler("update", async delta => {
                if (lock) return;
                lock = true;
                let loads = util.ensure(await window.api.get("loads"), "arr");
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
        this.addFeatureButton(v);
    }
    clearFeatureButtons() {
        let btns = this.featureButtons;
        this.addFeatureButton(btns);
        return btns;
    }
    hasFeatureButton(btn) {
        if (!(btn instanceof FeatureButton)) return false;
        return this.#featureButtons.has(btn);
    }
    addFeatureButton(...btns) {
        return util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof FeatureButton)) return false;
            if (this.hasFeatureButton(btn)) return false;
            this.#featureButtons.add(btn);
            if (this.hasENav()) this.eNav.appendChild(btn.elem);
            btn.onAdd();
            return btn;
        });
    }
    remFeatureButton(...btns) {
        return util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof FeatureButton)) return false;
            if (!this.hasFeatureButton(btn)) return false;
            btn.onRem();
            this.#featureButtons.delete(btn);
            if (this.hasENav()) this.eNav.removeChild(btn.elem);
            return btn;
        });
    }

    get upperFeatureButtons() { return [...this.#upperFeatureButtons]; }
    set upperFeatureButtons(v) {
        v = util.ensure(v, "arr");
        this.clearUpperFeatureButtons();
        this.addUpperFeatureButton(v);
    }
    clearUpperFeatureButtons() {
        let btns = this.upperFeatureButtons;
        this.remUpperFeatureButton(btns);
        return btns;
    }
    hasUpperFeatureButton(btn) {
        if (!(btn instanceof UpperFeatureButton)) return false;
        return this.#featureButtons.has(btn);
    }
    addUpperFeatureButton(...btns) {
        return util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof UpperFeatureButton)) return false;
            if (this.hasUpperFeatureButton(btn)) return false;
            this.#upperFeatureButtons.add(btn);
            this.eTitleBar.appendChild(btn.elem);
            return btn;
        });
    }
    remUpperFeatureButton(...btns) {
        return util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof UpperFeatureButton)) return false;
            if (!this.hasUpperFeatureButton(btn)) return false;
            this.#upperFeatureButtons.delete(btn);
            this.eTitleBar.removeChild(btn.elem);
            return btn;
        });
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
