import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";


class FeatureButton extends util.Target {
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
        this.addHandler("post-setup", () => {
            this.#eBackground = document.querySelector("#PAGE > .background");
            this.#eCanvas = document.querySelector("#PAGE > .background > div > #canvas");
            if (this.hasECanvas()) {
                const canvas = this.eCanvas;

                const quality = 3;

                const scene = new THREE.Scene();
                scene.fog = new THREE.Fog(0x000000, 7.5, 10);
                const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
                
                const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });

                const controls = new OrbitControls(camera, renderer.domElement);

                const hemLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
                scene.add(hemLight);

                const starGeometries = [
                    new THREE.SphereGeometry(0.02, 8, 8),
                    new THREE.SphereGeometry(0.015, 8, 8),
                    new THREE.SphereGeometry(0.01, 8, 8),
                ];
                const starCylinderGeometries = [{}, {}, {}];
                const starMaterials = [
                    new THREE.MeshBasicMaterial({ color: 0xffffff }),
                    new THREE.MeshBasicMaterial({ color: 0xffffff }),
                ];
                const stars = [];

                const near = camera.near;
                const fov = camera.fov;
                const height = 2 * Math.tan((fov*(Math.PI/180))/2) * near;
                const width = height * camera.aspect;

                let starSpawn = 0;

                let first = true;

                this.addHandler("update", delta => {
                    controls.target.set(0, 0, 0);
                    controls.update();

                    let scroll = (this.hasEContent() ? this.eContent.scrollTop : 0) / window.innerHeight;
                    let starSpeed = util.lerp(1, 25, (scroll<0) ? 0 : (scroll>1) ? 1 : scroll)*0.02;

                    canvas.style.opacity = (util.lerp(100, 0, (scroll<0.5) ? 0 : (scroll>1) ? 1 : ((scroll-0.5)/0.5)))+"%";

                    for (let i = 0; i < (first ? 60*10 : 1); i++) {
                        if (stars.length < 1000) {
                            while (starSpawn < 0) {
                                starSpawn += util.lerp(0.01, 0.1, Math.random());
                                let geometry = Math.floor(starGeometries.length*Math.random());
                                let material = starMaterials[Math.floor(starMaterials.length*Math.random())];
                                const starHead = new THREE.Mesh(
                                    starGeometries[geometry],
                                    material,
                                );
                                const starTail = starHead.clone();
                                const starMid = new THREE.Mesh(
                                    starGeometries[geometry],
                                    material,
                                );
                                starMid.rotateX(Math.PI/2);
                                const starGlobal = new THREE.Group();
                                starGlobal.add(starHead);
                                starGlobal.add(starTail);
                                starGlobal.add(starMid);
                                const star = {
                                    geometry: geometry,
                                    head: starHead,
                                    tail: starTail,
                                    mid: starMid,
                                    global: starGlobal,
                                };
                                let pos;
                                do {
                                    pos = new V(Math.random(), Math.random()).map(v => util.lerp(-15, +15, v));
                                } while (Math.abs(pos.x) < width && Math.abs(pos.y) < height);
                                star.global.position.set(pos.x, pos.y, -15);
                                scene.add(star.global);
                                stars.push(star);
                            }
                            starSpawn -= 2*starSpeed;
                        }
                        [...stars].forEach(star => {
                            let streakSize = Math.round((Math.abs(starSpeed) * 2.5) * 100000) / 100000;
                            star.head.position.setZ(+streakSize/2);
                            star.tail.position.setZ(-streakSize/2);
                            if (!(streakSize in starCylinderGeometries[star.geometry]))
                                starCylinderGeometries[star.geometry][streakSize] = new THREE.CylinderGeometry([0.02, 0.015, 0.01][star.geometry], [0.02, 0.015, 0.01][star.geometry], streakSize, 8, 1, true);
                            star.mid.geometry = starCylinderGeometries[star.geometry][streakSize];
                            star.global.position.setZ(star.global.position.z+starSpeed);
                            if (star.global.position.z < +15) return;
                            stars.splice(stars.indexOf(star), 1);
                            scene.remove(star.global);
                        });
                    }
                    first = false;

                    let colorW = new util.Color(getComputedStyle(document.body).getPropertyValue("--v8"));
                    let colorA = new util.Color(getComputedStyle(document.body).getPropertyValue("--a"));
                    let colorV = new util.Color(getComputedStyle(document.body).getPropertyValue("--v2"));
                    starMaterials[0].color.set(colorW.toHex(false));
                    starMaterials[1].color.set(colorA.toHex(false));
                    scene.fog.color.set(colorV.toHex(false));
                    
                    camera.aspect = window.innerWidth/window.innerHeight;
                    camera.updateProjectionMatrix();

                    renderer.setSize(window.innerWidth*quality, window.innerHeight*quality);
                    renderer.domElement.style.transform = "scale("+(100*(1/quality))+"%)";
                    renderer.render(scene, camera);
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
                this.addHandler("update", delta => {
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
                    if (dbHostAnchor instanceof HTMLAnchorElement)
                        dbHostAnchor.href = await window.api.get("val-db-host");
                    const assetsHostAnchor = this.eInfo.querySelector(":scope > .nav > a#assets-host");
                    if (assetsHostAnchor instanceof HTMLAnchorElement)
                        assetsHostAnchor.href = await window.api.get("assets-host");
                    const repoAnchor = this.eInfo.querySelector(":scope > .nav > a#repo");
                    if (repoAnchor instanceof HTMLAnchorElement)
                        repoAnchor.href = await window.api.get("val-repo");
                }, 250);
            }
            this.#eLoads = document.querySelector("#PAGE > .loads");

            this.addHandler("cmd-spawn", async name => {
                let isDevMode = await window.api.get("devmode");
                if (!isDevMode && [].includes(name)) {
                    let pop = this.confirm();
                    pop.eContent.innerText = "Are you sure you want to open this feature?\nThis feature is in development and might contain bugs";
                    let result = await pop.whenResult();
                    if (!result) return;
                }
                window.api.send("spawn", name);
            });
            
            let btn;

            btn = this.addFeatureButton(new FeatureButton("Panel", "grid"));
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PANEL"));

            btn = this.addFeatureButton(new FeatureButton("Planner", "analytics"));
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PLANNER"));

            btn = this.addFeatureButton(new FeatureButton("Perception", "eye"));
            btn.tooltip = "Coming soon!";
            btn.tooltipColor = "var(--a)";
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PERCEPTION"));

            btn = this.addUpperFeatureButton(new UpperFeatureButton("grid"));
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PANEL"));

            btn = this.addUpperFeatureButton(new UpperFeatureButton("analytics"));
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PLANNER"));

            btn = this.addUpperFeatureButton(new UpperFeatureButton("eye"));
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PERCEPTION"));

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
