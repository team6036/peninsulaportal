import * as util from "../util.mjs";
import { V } from "../util.mjs";

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

class Speck extends util.Target {
    #type;
    #r; #l;

    #vel;
    #cvel;

    #sphereGeometry;
    #cylinderGeometry;
    #material;
    #headMesh; #tailMesh; #midMesh;
    #object;

    static sphereGeometryCache = {};
    static cylinderGeometryCache = {};
    static materials = [
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
    ];

    constructor(type, r, l) {
        super();

        this.#type = 0;
        this.#r = 0;
        this.#l = 0;

        this.#vel = [0, 0, 0];
        this.#cvel = [0, 0, 0];

        this.type = type;
        this.r = r;
        this.l = l;

        let vel = [null, null, null];

        this.addHandler("update", delta => {
            let newVel = [
                this.velX+this.cvelX,
                this.velY+this.cvelY,
                this.velZ+this.cvelZ,
            ];
            let changed = false;
            for (let i = 0; i < 3; i++) {
                if (vel[i] == newVel[i]) continue;
                vel[i] = newVel[i];
                changed = true;
            }
            let d = Math.sqrt(vel[0]**2 + vel[1]**2 + vel[2]**2);
            this.l = Math.min(2.5, d * 2.5);
            this.object.position.set(
                this.object.position.x+vel[0],
                this.object.position.y+vel[1],
                this.object.position.z+vel[2],
            );
            this.#headMesh.position.setZ(+this.l/2);
            this.#tailMesh.position.setZ(-this.l/2);
            if (changed) {
                this.object.lookAt(
                    this.object.position.x+vel[0],
                    this.object.position.y+vel[1],
                    this.object.position.z+vel[2],
                );
            }
            let p = 0.99 ** (5/delta);
            this.velX *= p;
            this.velY *= p;
            this.velZ *= p;
        });
    }

    #check() {
        if (!(this.r in Speck.sphereGeometryCache))
            Speck.sphereGeometryCache[this.r] = new THREE.SphereGeometry(this.r, 8, 8);
        if (!(this.r in Speck.cylinderGeometryCache))
            Speck.cylinderGeometryCache[this.r] = {};
        if (!(this.l in Speck.cylinderGeometryCache[this.r]))
            Speck.cylinderGeometryCache[this.r][this.l] = new THREE.CylinderGeometry(this.r, this.r, this.l, 8, 1, true);
        this.#sphereGeometry = Speck.sphereGeometryCache[this.r];
        this.#cylinderGeometry = Speck.cylinderGeometryCache[this.r][this.l];
        this.#material = Speck.materials[this.type];
        if (!this.#headMesh) this.#headMesh = new THREE.Mesh(this.#sphereGeometry, this.#material);
        if (!this.#tailMesh) this.#tailMesh = new THREE.Mesh(this.#sphereGeometry, this.#material);
        if (!this.#midMesh) {
            this.#midMesh = new THREE.Mesh(this.#cylinderGeometry, this.#material);
            this.#midMesh.rotateX(Math.PI/2);
        }
        this.#headMesh.geometry = this.#tailMesh.geometry = this.#sphereGeometry;
        this.#midMesh.geometry = this.#cylinderGeometry;
        this.#headMesh.material = this.#tailMesh.material = this.#midMesh.material = this.#material;
        if (!this.#object) {
            this.#object = new THREE.Object3D();
            this.#object.add(this.#headMesh);
            this.#object.add(this.#tailMesh);
            this.#object.add(this.#midMesh);
        }
    }

    get type() { return this.#type; }
    set type(v) {
        v = Math.min(Speck.materials.length-1, Math.max(0, util.ensure(v, "int")));
        if (this.type == v) return;
        this.#type = v;
        this.#check();
    }

    get r() { return this.#r; }
    set r(v) {
        v = Math.max(0, Math.floor(util.ensure(v, "num")*100)/100);
        if (this.r == v) return;
        this.#r = v;
        this.#check();
    }
    get l() { return this.#l; }
    set l(v) {
        v = Math.max(0, Math.floor(util.ensure(v, "num")*100)/100);
        if (this.l == v) return;
        this.#l = v;
        this.#check();
    }

    get velX() { return this.#vel[0]; }
    set velX(v) { this.#vel[0] = util.ensure(v, "num"); }
    get velY() { return this.#vel[1]; }
    set velY(v) { this.#vel[1] = util.ensure(v, "num"); }
    get velZ() { return this.#vel[2]; }
    set velZ(v) { this.#vel[2] = util.ensure(v, "num"); }
    get cvelX() { return this.#cvel[0]; }
    set cvelX(v) { this.#cvel[0] = util.ensure(v, "num"); }
    get cvelY() { return this.#cvel[1]; }
    set cvelY(v) { this.#cvel[1] = util.ensure(v, "num"); }
    get cvelZ() { return this.#cvel[2]; }
    set cvelZ(v) { this.#cvel[2] = util.ensure(v, "num"); }

    get object() { return this.#object; }

    update(delta) { this.post("update", delta); }
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

                const hemLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
                scene.add(hemLight);

                const specks = [];

                const near = camera.near;
                const fov = camera.fov;
                const height = 2 * Math.tan((fov*(Math.PI/180))/2) * near;
                const width = height * camera.aspect;

                let spawn = 0;

                let first = true;

                const getScroll = () => (this.hasEContent() ? this.eContent.scrollTop : 0) / window.innerHeight;
                const getSpeed = () => {
                    let scroll = getScroll();
                    return util.lerp(1, 25, (scroll<0) ? 0 : (scroll>1) ? 1 : scroll)*0.02;
                };

                this.addHandler("update", delta => {
                    let scroll = getScroll();
                    let speed = getSpeed();

                    canvas.style.opacity = (util.lerp(100, 0, (scroll<0.5) ? 0 : (scroll>1) ? 1 : ((scroll-0.5)/0.5)))+"%";

                    for (let i = 0; i < (first ? 60*10 : 1); i++) {
                        if (specks.length < 1000) {
                            while (spawn < 0) {
                                if (this.holiday == "july4") {
                                    spawn += util.lerp(1, 10, Math.random());
                                    let radii = [0.02, 0.015, 0.01];
                                    let pos = new util.V3(util.lerp(-5, +5, Math.random()), util.lerp(-5, +5, Math.random()), -5);
                                    for (let i = 0; i < 20; i++) {
                                        let azimuth = util.lerp(0, 360, Math.random());
                                        let elevation = util.lerp(0, 360, Math.random());
                                        let xz = V.dir(azimuth);
                                        let y = V.dir(elevation);
                                        xz.imul(y.x);
                                        let mag = new util.V3(xz.x, y.y, xz.y);
                                        const speck = new Speck(
                                            Math.floor(Speck.materials.length*Math.random()),
                                            radii[Math.floor(radii.length*Math.random())], 0,
                                        );
                                        speck.object.position.set(...pos.xyz);
                                        [speck.velX, speck.velY, speck.velZ] = mag.mul(util.lerp(0.05, 0.15, Math.random())).xyz;
                                        scene.add(speck.object);
                                        specks.push(speck);
                                        speck.addHandler("update", delta => {
                                            speck.velY -= 0.001;
                                            if (
                                                Math.abs(speck.object.position.x) <= +15 &&
                                                Math.abs(speck.object.position.y) <= +15 &&
                                                Math.abs(speck.object.position.z) <= +15
                                            ) return;
                                            specks.splice(specks.indexOf(speck), 1);
                                            scene.remove(speck.object);
                                        });
                                    }
                                } else {
                                    spawn += util.lerp(0.01, 0.1, Math.random());
                                    let radii = [0.02, 0.015, 0.01];
                                    const speck = new Speck(
                                        Math.floor(Speck.materials.length*Math.random()),
                                        radii[Math.floor(radii.length*Math.random())], 0,
                                    );
                                    let pos;
                                    do {
                                        pos = new V(Math.random(), Math.random()).map(v => util.lerp(-15, +15, v));
                                    } while (Math.abs(pos.x) < width && Math.abs(pos.y) < height);
                                    speck.object.position.set(pos.x, pos.y, -15);
                                    scene.add(speck.object);
                                    specks.push(speck);
                                    speck.addHandler("update", delta => {
                                        speck.velX = speck.velY = speck.velZ = 0;
                                        speck.cvelX = speck.cvelY = 0;
                                        speck.cvelZ = getSpeed();
                                        if (
                                            Math.abs(speck.object.position.x) <= +15 &&
                                            Math.abs(speck.object.position.y) <= +15 &&
                                            Math.abs(speck.object.position.z) <= +15
                                        ) return;
                                        specks.splice(specks.indexOf(speck), 1);
                                        scene.remove(speck.object);
                                    });
                                }
                            }
                            if (this.holiday == "july4") spawn -= 0.1;
                            else spawn -= 2*speed;
                        }
                        [...specks].forEach(speck => speck.update(delta));
                    }
                    first = false;

                    let colorW = core.PROPERTYCACHE.getColor("--v8");
                    let colorA = core.PROPERTYCACHE.getColor("--a");
                    let colorV = core.PROPERTYCACHE.getColor("--v2");
                    Speck.materials[0].color.set(colorW.toHex(false));
                    Speck.materials[1].color.set(colorA.toHex(false));
                    scene.fog.color.set(colorV.toHex(false));
                    
                    camera.aspect = window.innerWidth/window.innerHeight;
                    camera.updateProjectionMatrix();

                    renderer.setSize(window.innerWidth*quality, window.innerHeight*quality);
                    renderer.domElement.style.transform = "scale("+(1/quality)+")";
                    renderer.render(scene, camera);
                });
            }
            this.#eMain = document.querySelector("#PAGE > .main");
            this.#eContent = document.querySelector("#PAGE > .content");
            if (this.hasEContent()) {
                (async () => {
                    let resp = await fetch("../../README.md");
                    let text = await resp.text();
                    let signal = new util.Target();
                    signal.addHandler("nav", (e, href) => this.addPopup(new App.MarkdownPopup(href)));
                    this.eContent.appendChild(await this.createMarkdown(text, signal));
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
                this.getAgent().forEach(line => {
                    let elem = document.createElement("div");
                    this.eInfo.appendChild(elem);
                    elem.textContent = line;
                });
                this.#eSettingsBtn = this.eInfo.querySelector(":scope > .nav > button#settings");
                if (this.hasESettingsBtn())
                    this.eSettingsBtn.addEventListener("click", e => {
                        e.stopPropagation();
                        this.post("cmd-spawn", "PRESETS");
                    });
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
            
            let btn;

            btn = this.addFeatureButton(new FeatureButton("Panel", "grid"));
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PANEL"));

            btn = this.addFeatureButton(new FeatureButton("Planner", "analytics"));
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PLANNER"));

            btn = this.addUpperFeatureButton(new UpperFeatureButton("grid"));
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PANEL"));

            btn = this.addUpperFeatureButton(new UpperFeatureButton("analytics"));
            btn.addHandler("trigger", e => this.post("cmd-spawn", "PLANNER"));

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
