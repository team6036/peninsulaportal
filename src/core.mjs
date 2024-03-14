import * as util from "./util.mjs";
import { V } from "./util.mjs";
import * as lib from "./lib.mjs";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";


export const LOADER = new GLTFLoader();

THREE.Quaternion.fromRotationSequence = (...seq) => {
    if (seq.length == 1 && util.is(seq[0], "arr")) return THREE.Quaternion.fromRotationSequence(...seq[0]);
    let q = new THREE.Quaternion();
    seq.forEach(rot => {
        if (!(util.is(rot, "obj"))) return;
        if (!("axis" in rot) || !("angle" in rot)) return;
        let axis = rot.axis, angle = rot.angle;
        if (!util.is(axis, "str") || !util.is(angle, "num")) return;
        axis = axis.toLowerCase();
        if (!["x","y","z"].includes(axis)) return;
        let vec = new THREE.Vector3(+(axis=="x"), +(axis=="y"), +(axis=="z"));
        q.multiply(new THREE.Quaternion().setFromAxisAngle(vec, (Math.PI/180)*angle));
    });
    return q;
};

export const WPILIB2THREE = THREE.Quaternion.fromRotationSequence(
    {
        axis: "x",
        angle: 90,
    },
    {
        axis: "y",
        angle: 180,
    },
);
export const THREE2WPILIB = WPILIB2THREE.clone().invert();


class PropertyCache extends util.Target {
    #cache;
    #colorCache;

    constructor() {
        super();

        this.#cache = {};
        this.#colorCache = {};
    }

    get(k) {
        k = String(k);
        if (k in this.#cache) return this.#cache[k];
        this.#cache[k] = getComputedStyle(document.body).getPropertyValue(k);
        return this.get(k);
    }
    getColor(k) {
        k = String(k);
        if (k in this.#colorCache) return this.#colorCache[k];
        this.#colorCache[k] = new util.Color(this.get(k));
        return this.getColor(k);
    }
    clear() {
        this.#cache = {};
        this.#colorCache = {};
    }
}
export const PROPERTYCACHE = new PropertyCache();


export class App extends util.Target {
    #setupDone;

    #fullscreen;
    #devMode;
    #holiday;

    #popups;

    #menu;
    #contextMenu;

    #base;
    #colors;
    #accent;

    #dragging;
    #dragState;
    #dragData;
    #eDrag;

    #pages;
    #page;

    #title;

    #eTitle;
    #eCoreStyle;
    #eStyle;
    #eDynamicStyle;
    #eTitleBar;
    #eLoading;
    #eLoadingTo;
    #eMount;
    #eRunInfo;

    static CLEANUPPROMPT = true;

    constructor() {
        super();

        this.#setupDone = false;

        this.#fullscreen = null;
        this.#devMode = null;
        this.#holiday = null;

        this.#popups = [];

        this.#menu = null;
        this.#contextMenu = null;
        document.body.addEventListener("click", e => {
            if (!this.hasContextMenu()) return;
            if (this.contextMenu.elem.contains(e.target) && e.target.classList.contains("blocking")) return;
            this.contextMenu = null;
        }, { capture: true });

        this.#base = [];
        this.#colors = {};
        this.#accent = null;

        this.#dragging = false;
        this.#dragState = null;
        this.#dragData = null;

        this.#pages = {};
        this.#page = null;

        this.#title = null;

        window.api.onPerm(async () => {
            if (this.setupDone) return;
            try {
                window.api.sendPerm(true);
            } catch (e) { await this.doError("Permission Send Error", "", e); }
        });

        let today = new Date();
        if (today.getMonth() == 3 && today.getDate() == 1) {
            if (localStorage.getItem("funny") == null) {
                localStorage.setItem("funny", "notnull");
                let elem = document.createElement("div");
                document.body.appendChild(elem);
                elem.style.zIndex = 1000000;
                elem.style.position = "absolute";
                elem.style.top = elem.style.left = "0px";
                elem.style.width = elem.style.height = "100%";
                const funnyFunction = async () => {
                    let t = 0;
                    let t1 = 5000, t2 = 6000, t3 = 6500, t4 = 9500, t5 = 10000;
                    let glitchT = [50, 100];
                    let pos = new V(), brightness = 1, hue = 0, T = 0;
                    let facePos = new V(), faceSize = 1, faceT = 0;
                    let percentPos = new V(), percentT = 0;
                    const funnyUpdate = delta => {
                        t += delta;
                        T += delta;
                        if (T > util.lerp(...glitchT, Math.random())) {
                            T = 0;
                            pos.set(util.lerp(-15, 15, Math.random()), util.lerp(-15, 15, Math.random()));
                            brightness = util.lerp(0.75, 1.25, Math.random());
                            hue = util.lerp(-30, 30, Math.random());
                        }
                        let y = (t < t4 ? 0 : util.lerp(0, window.innerHeight, util.ease.sinI((t-t4)/(t5-t4))));
                        theElem.style.transform = (t < t2 ? "" : t < t3 ? "translate("+pos.xy.map(v => v+"px").join(",")+")" : "translate("+V.dir(360*Math.random(), 5*Math.random()).add(0, y).xy.map(v => v+"px").join(",")+")");
                        theElem.style.filter = (t < t2 ? "" : t < t3 ? "brightness("+brightness+") hue-rotate("+hue+"deg)" : "");
                        theElem.style.background = (t < t3 ? "#357EC7" : "radial-gradient(circle,#8000,#8004), #357EC7");
                        theSadFace.textContent = (t < t2 ? ":(" : t < t3 ? util.choose([":)", ":P", ":|", ":3"]) : ">:)");
                        faceT += delta;
                        if (faceT > util.lerp(...glitchT, Math.random())) {
                            faceT = 0;
                            facePos.set(util.lerp(-25, 25, Math.random()), util.lerp(-25, 25, Math.random()));
                            faceSize = util.lerp(0.5, 1.5, Math.random());
                        }
                        theSadFace.style.transform = (t < t2 ? "" : t < t3 ? "translate("+facePos.xy.map(v => v+"px").join(",")+") scale("+faceSize+")" : "");
                        thePercentage.textContent = Math.round(100*(t < t1 ? ((t-0)/t1) : t < t2 ? 1 : (1+(t-t3)/2500)))+"% complete";
                        percentT += delta;
                        if (percentT > util.lerp(...glitchT, Math.random())) {
                            percentT = 0;
                            percentPos.set(util.lerp(-25, 25, Math.random()), util.lerp(-25, 25, Math.random()));
                        }
                        thePercentage.style.transform = (t < t2 ? "" : t < t3 ? "translate("+percentPos.xy.map(v => v+"px").join(",")+")" : "");
                        let url = (t < t3 ? "https://www.windows.com/stopcode" : "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
                        let code = (t < t3 ? "CRITICAL_PROCESS_DIED" : "CRITICAL_PROCESS_CHILLING");
                        theInfo.innerHTML = `For more information about the issue and possible fixes, visit ${url}<br><br>If you call a support person, give them this info:<br>Stop code: ${code}`;
                    };
                    await util.wait(1000);
                    await window.api.set("fullscreen", true);
                    await util.wait(1000);
                    elem.style.backgroundColor = "#000";
                    await util.wait(500);
                    elem.style.backgroundColor = "";
                    elem.style.cursor = "none";
                    elem.innerHTML = `
    <div style="width:100%;height:100%;padding:150px;display:flex;flex-direction:column;flex-wrap:nowrap;justify-content:flex-start;align-items:stretch;align-content:center;gap:20px;color:#fff;">
        <div id="thesadface" style="font-family:Roboto;font-size:160px;">:(</div>
        <div style="font-family:Roboto;font-size:32px;">Your PC ran into a problem and needs to restart as soon as we're finished collecting some error info<br><br><span id="thepercentage" style="display:inline-block;font-family:Roboto;"></span></div>
        <div style="margin-top:40px;display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:flex-start;align-items:flex-start;align-content:flex-start;gap:20px;">
            <div id="thecanvas" style="border:10px solid #fff;"></div>
            <div id="theinfo" style="font-family:Roboto;font-size:16px;text-align:left;line-height:1.75;"></div>
        </div>
    </div>
                    `;
                    let theElem = elem.children[0];
                    let theSadFace = document.getElementById("thesadface");
                    let thePercentage = document.getElementById("thepercentage");
                    let theCanvas = document.getElementById("thecanvas");
                    let theInfo = document.getElementById("theinfo");
                    new QRCode(theCanvas, {
                        text: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                        width: 500,
                        height: 500,
                        colorDark : "#0000",
                        colorLight : "#fff",
                        correctLevel : QRCode.CorrectLevel.H,
                    });
                    Array.from(theCanvas.children).forEach(elem => (elem.style.width = elem.style.height = "100px"));
                    this.addHandler("update", funnyUpdate);
                    await util.wait(t5);
                    this.remHandler("update", funnyUpdate);
                    await window.api.set("fullscreen", false);
                    elem.remove();
                };
                funnyFunction();
            }
        } else {
            localStorage.removeItem("funny");
        }

        this.addHandler("start", async () => {
            await window.buildAgent();
            this.menu = App.Menu.buildMenu();
            let id = setInterval(() => {
                if (document.readyState != "complete") return;
                clearInterval(id);
                (async () => {
                    await this.postResult("pre-setup");
                    await this.setup();
                    await this.postResult("post-setup");
                    let appState = null;
                    try {
                        appState = await window.api.send("state-get", "app-state");
                    } catch (e) { await this.doError("State Error", "AppState Get", e); }
                    try {
                        await this.loadState(appState);
                    } catch (e) { await this.doError("Load Error", "AppState", e); }
                    let page = "";
                    try {
                        page = await window.api.send("state-get", "page");
                    } catch (e) { await this.doError("State Error", "CurrentPage Get", e); }
                    let pageState = null;
                    try {
                        pageState = await window.api.send("state-get", "page-state");
                    } catch (e) { await this.doError("State Error", "PageState Get", e); }
                    let pagePersistentStates = {};
                    try {
                        pagePersistentStates = util.ensure(await window.api.send("state-get", "page-persistent-states"), "obj");
                    } catch (e) { await this.doError("State Error", "PagePersistentStates Get", e); }
                    if (this.hasPage(page)) {
                        try {
                            await this.getPage(page).loadState(util.ensure(pageState, "obj"));
                        } catch (e) { await this.doError("Load Error", "State, PageName: "+page, e); }
                        if (this.page != page) this.page = page;
                    }
                    for (let name in pagePersistentStates) {
                        if (!this.hasPage(name)) continue;
                        try {
                            await this.getPage(name).loadPersistentState(util.ensure(pagePersistentStates[name], "obj"));
                        } catch (e) { await this.doError("Load Error", "PersistentState, PageName: "+name, e); }
                    }
                    let t0 = null, error = false;
                    let fps = 0, fpst = 0, fpsn = 0;
                    const update = async () => {
                        window.requestAnimationFrame(update);
                        let t1 = util.getTime();
                        if (t0 == null || error) return t0 = t1;
                        try {
                            if (this.eMount.classList.contains("runinfo")) this.eRunInfo.innerText = `DELTA: ${String(t1-t0).padStart(15-10, " ")} ms\nFPS: ${String(fps).padStart(15-5, " ")}`;
                            fpst += t1-t0; fpsn++;
                            if (fpst >= 1000) {
                                fpst -= 1000;
                                fps = fpsn;
                                fpsn = 0;
                            }
                            this.update(t1-t0);
                        } catch (e) {
                            error = true;
                            await this.doError("Update Error", "", e);
                            error = false;
                            return t0 = null;
                        }
                        t0 = t1;
                    };
                    update();
                    if (!this.constructor.CLEANUPPROMPT) return;
                    let cleanups = util.ensure(await window.api.get("cleanup"), "arr").map(pth => {
                        return [pth].flatten().join("/");
                    });
                    if (cleanups.length <= 3) return;
                    let pop = this.confirm("Junk Files Found!", "We found some unnecessary files in your application data. Would you like to clean up these files?");
                    pop.infos = [cleanups.join("\n")];
                    let r = await pop.whenResult();
                    if (!r) return;
                    await window.api.send("cleanup");
                })();
            }, 10);
        });

        this.addHandler("update", delta => this.pages.forEach(name => this.getPage(name).update(delta)));
    }

    get setupDone() { return this.#setupDone; }

    start() { this.post("start"); }
    update(delta) { this.post("update", delta); }

    getAgent() {
        let agent = window.agent();
        if (agent.os == "web") {
            return [
                "WEB"+(agent.public ? " (public)" : ""),
                "Agent: "+navigator.userAgent,
                "App: "+agent.app,
            ];
        }
        let cpus = "";
        if (agent.os.cpus.length > 0) {
            cpus += " / ";
            let models = [...new Set(agent.os.cpus.map(obj => obj.model))];
            if (models.length > 1) cpus += "CPUS: "+models.join(", ");
            else cpus += models[0];
        }
        return [
            "DESKTOP"+(agent.public ? " (public)" : ""),
            "OS: "+agent.os.platform+" "+agent.os.arch+cpus,
            "Node: "+agent.node,
            "Chrome: "+agent.chrome,
            "Electron: "+agent.electron,
            "App: "+agent.app,
        ];
    }

    static async createMarkdown(text, signal, pth="") {
        if (!(signal instanceof util.Target)) signal = new util.Target();
        const converter = new showdown.Converter({
            ghCompatibleHeaderId: true,
            strikethrough: true,
            tables: true,
            tasklists: true,
            openLinksInNewWindow: false,
        });
        converter.setFlavor("github");
        let article = document.createElement("article");
        article.classList.add("md");
        article.innerHTML = converter.makeHtml(text);
        const repoRoot = await window.api.getRepoRoot();
        const url = "file://"+repoRoot+"/";
        const dfs = async elem => {
            await (async () => {
                if (elem instanceof HTMLImageElement && elem.classList.contains("docs-icon")) {
                    const onHolidayState = async holiday => {
                        const holidayData = util.ensure(util.ensure(await window.api.get("holidays"), "obj")[holiday], "obj");
                        elem.src = (holiday == null || ("icon" in holidayData && !holidayData.icon)) ? String(new URL("./src/assets/app/icon.png", url)) : util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").png;
                    };
                    signal.addHandler("holiday", onHolidayState);
                    await onHolidayState(await window.api.get("active-holiday"));
                    return;
                }
                if (elem instanceof HTMLAnchorElement) {
                    if (elem.classList.contains("back")) {
                        elem.setAttribute("href", "");
                        elem.addEventListener("click", e => {
                            e.stopPropagation();
                            signal.post("back", e);
                        });
                        return;
                    }
                    let href = elem.getAttribute("href");
                    if (!href.startsWith("./") && !href.startsWith("../")) return;
                    elem.setAttribute("href", "");
                    elem.addEventListener("click", e => {
                        e.stopPropagation();
                        signal.post("nav", e, String(new URL(href, new URL(pth, url))).substring(url.length));
                    });
                }
            })();
            ["href", "src"].forEach(attr => {
                if (!elem.hasAttribute(attr)) return;
                let v = elem.getAttribute(attr);
                if (!v.startsWith("./") && !v.startsWith("../")) return;
                v = String(new URL(v, new URL(pth, url)));
                elem.setAttribute(attr, v);
            });
            await Promise.all(Array.from(elem.children).map(child => dfs(child)));
        };
        await dfs(article);
        let id = setInterval(() => {
            if (!document.contains(article)) return;
            hljs.configure({ cssSelector: "article.md pre code" });
            hljs.highlightAll();
            clearInterval(id);
        }, 100);
        return article;
    }
    async createMarkdown(text, signal, pth="") {
        if (!(signal instanceof util.Target)) signal = new util.Target();
        this.addHandler("cmd-win-holiday", holiday => signal.post("holiday", holiday));
        return await App.createMarkdown(text, signal, pth);
    }
    static evaluateLoad(load) {
        let ogLoad = load = String(load);
        let elem = document.createElement("div");
        load = load.split(":");
        let name = load.shift();
        (() => {
            let namefs = {
                "fs-version": () => {
                    if (load.length > 0) elem.style.color = "var(--cr)";
                    if (load.length > 0) return elem.textContent += "App data directory verison mismatch: "+load.join(":");
                    return elem.textContent += "Checking app data version";
                },
                "find": () => (elem.textContent += "Finding database"),
                "find-next": () => (elem.textContent += "Finding next database"),
                "comp-mode": () => (elem.textContent += "Competition mode"),
                "poll": () => {
                    if (load.length > 0) elem.style.color = "var(--cr)";
                    if (load.length > 0) return elem.textContent += "Polling database failed: "+load.join(":");
                    return elem.textContent += "Polling database";
                },
                "config": () => {
                    if (load.length > 0) elem.style.color = "var(--cr)";
                    if (load.length > 0) return elem.textContent += "Configuring failed: "+load.join(":");
                    return elem.textContent += "Configuring";
                },
                "templates.json": () => {
                    if (load.length > 0) elem.style.color = "var(--cr)";
                    if (load.length > 0) return elem.textContent += "Error while downloading template datas: "+load.join(":");
                    return elem.textContent += "Downloading template datas";
                },
                "robots.json": () => {
                    if (load.length > 0) elem.style.color = "var(--cr)";
                    if (load.length > 0) return elem.textContent += "Error while downloading robot datas: "+load.join(":");
                    return elem.textContent += "Downloading robot datas";
                },
                "holidays.json": () => {
                    if (load.length > 0) elem.style.color = "var(--cr)";
                    if (load.length > 0) return elem.textContent += "Error while downloading holiday datas: "+load.join(":");
                    return elem.textContent += "Downloading holiday datas";
                },
                "themes.json": () => {
                    if (load.length > 0) elem.style.color = "var(--cr)";
                    if (load.length > 0) return elem.textContent += "Error while downloading themes: "+load.join(":");
                    return elem.textContent += "Downloading themes";
                },
            };
            if (name in namefs) return namefs[name]();
            if (name.startsWith("templates/") && name.endsWith(".png")) {
                name = name.substring(10, name.length-4);
                if (load.length > 0) elem.style.color = "var(--cr)";
                if (load.length > 0) return elem.textContent += "Error while downloading template image "+name+": "+load.join(":");
                return elem.textContent += "Downloading template image "+name;
            }
            if (name.startsWith("templates/") && name.endsWith(".glb")) {
                name = name.substring(10, name.length-4);
                if (load.length > 0) elem.style.color = "var(--cr)";
                if (load.length > 0) return elem.textContent += "Error while downloading template model "+name+": "+load.join(":");
                return elem.textContent += "Downloading template model "+name;
            }
            if (name.startsWith("robots/") && name.endsWith(".glb")) {
                name = name.substring(7, name.length-4);
                if (load.length > 0) elem.style.color = "var(--cr)";
                if (load.length > 0) return elem.textContent += "Error while downloading robot model "+name+": "+load.join(":");
                return elem.textContent += "Downloading robot model "+name;
            }
            if (name.startsWith("holidays/")) {
                name = name.substring(9);
                if (load.length > 0) elem.style.color = "var(--cr)";
                if (load.length > 0) return elem.textContent += "Error while downloading holiday icon "+name+": "+load.join(":");
                return elem.textContent += "Downloading holiday icon "+name;
            }
            if (name.startsWith("holidays/") && name.endsWith("-conv")) {
                name = name.substring(9, name.length-5);
                if (load.length > 0) elem.style.color = "var(--cr)";
                if (load.length > 0) return elem.textContent += "Error while converting holiday icon "+name+": "+load.join(":");
                return elem.textContent += "Converting holiday icon "+name;
            }
            if (name.toUpperCase() == name) {
                let fName = name;
                name = load.shift();
                elem.textContent += "["+util.formatText(fName)+"] ";
                let namefs = {
                    PLANNER: () => {
                        let namefs = {
                            "solver": () => {
                                if (load.length > 0) elem.style.color = "var(--cr)";
                                if (load.length > 0) return elem.textContent += "Error while copying default solver: "+load.join(":");
                                return elem.textContent += "Copying default solver";
                            },
                            "templates.json": () => {
                                if (load.length > 0) elem.style.color = "var(--cr)";
                                if (load.length > 0) return elem.textContent += "Error while downloading template datas: "+load.join(":");
                                return elem.textContent += "Downloading template datas";
                            },
                        };
                        if (name in namefs) return namefs[name]();
                    },
                };
                if (name == "search") return elem.textContent += "Searching";
                if (fName in namefs) return namefs[fName]();
            }
            elem.style.color = "var(--cy)";
            elem.textContent = ogLoad;
        })();
        return elem;
    }

    get fullscreen() { return this.#fullscreen; }
    set fullscreen(v) {
        v = !!v;
        if (this.fullscreen == v) return;
        this.#fullscreen = v;
        document.documentElement.style.setProperty("--fs", (v ? 1 : 0));
        let left = 0, right = 0;
        if (window.navigator.windowControlsOverlay) {
            let r = window.navigator.windowControlsOverlay.getTitlebarAreaRect();
            left = r.left;
            right = window.innerWidth-r.right;
        }
        document.documentElement.style.setProperty("--LEFT", (v ? 0 : left)+"px");
        document.documentElement.style.setProperty("--RIGHT", (v ? 0 : right)+"px");
        PROPERTYCACHE.clear();
    }
    get devMode() { return this.#devMode; }
    set devMode(v) {
        v = !!v;
        if (this.devMode == v) return;
        this.#devMode = v;
        if (v) {
            window.app = this;
            window.util = util;
            window.colors = () => {
                "roygbpm_".split("").forEach(c => {
                    let out = [new Array(9).fill("%c...").join("")];
                    for (let i = 0; i <= 8; i++) {
                        let rgb;
                        if (c == "_") rgb = PROPERTYCACHE.get("--v"+i);
                        else rgb = PROPERTYCACHE.get("--c"+c+i);
                        out.push("padding:10px;background:"+rgb+";");
                    }
                    console.log(...out);
                });
            };
        } else { 
            delete window.app;
            delete window.util;
            delete window.colors;
        }
        let itm = this.menu.findItemWithId("toggledevtools");
        if (!itm) return;
        // itm.enabled = this.devMode;
    }
    get holiday() { return this.#holiday; }
    set holiday(v) {
        v = (v == null) ? null : String(v);
        if (this.holiday == v) return;
        this.#holiday = v;
        this.updateDynamicStyle();
    }

    async setup() {
        if (this.setupDone) return false;

        const root = "file://"+(await window.api.getAppRoot());
        const theRoot = "file://"+(await window.api.getRoot());
        const repoRoot = "file://"+(await window.api.getRepoRoot());

        window.api.onPerm(async () => {
            let perm = await this.getPerm();
            try {
                window.api.sendPerm(perm);
            } catch (e) { await this.doError("Send Permission Error", "", e); }
        });
        window.api.on((_, cmd, ...a) => {
            cmd = String(cmd);
            this.post("cmd", cmd, ...a);
            this.post("cmd-"+cmd, ...a);
        });
        this.addHandler("perm", async () => {
            try {
                await window.api.send("state-set", "app-state", this.state);
            } catch (e) { await this.doError("State Error", "AppState Set", e); }
            if (this.hasPage(this.page)) {
                try {
                    await window.api.send("state-set", "page", this.page);
                } catch (e) { await this.doError("State Error", "CurrentPage Set", e); }
                try {
                    await window.api.send("state-set", "page-state", this.getPage(this.page).state);
                } catch (e) { await this.doError("State Error", "PageState Set", e); }
            }
            let pagePersistentStates = {};
            this.pages.forEach(name => (pagePersistentStates[name] = this.getPage(name).persistentState));
            try {
                await window.api.send("state-set", "page-persistent-states", pagePersistentStates);
            } catch (e) { await this.doError("State Error", "PagePersistentStates Set", e); }
            return true;
        });
        this.addHandler("cmd-about", async () => {
            let name = String(await window.api.get("name"));
            let holiday = await window.api.get("active-holiday");
            const holidayData = util.ensure(util.ensure(await window.api.get("holidays"), "obj")[holiday], "obj");
            let pop = this.confirm();
            pop.cancel = "Documentation";
            pop.iconSrc = (holiday == null || ("icon" in holidayData && !holidayData.icon)) ? (root+"/assets/app/icon.svg") : util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").svg;
            pop.iconColor = "var(--a)";
            pop.subIcon = util.is(this.constructor.ICON, "str") ? this.constructor.ICON : "";
            pop.title = "Peninsula "+util.formatText(name);
            pop.infos = [this.getAgent().join("\n")];
            let r = await pop.whenResult();
            if (r) return;
            this.post("cmd-documentation");
        });
        this.addHandler("cmd-documentation", async () => {
            let name = String(await window.api.get("name"));
            if (["PANEL", "PLANNER", "PRESETS", "DATABASE"].includes(name))
                this.addPopup(new App.MarkdownPopup("./docs/"+name.toLowerCase()+"/MAIN.md"));
            else this.addPopup(new App.MarkdownPopup("./README.md"));
        });
        this.addHandler("cmd-spawn", async name => {
            name = String(name);
            let isDevMode = await window.api.get("devmode");
            if (!isDevMode && ["DATABASE", "PIT"].includes(name)) {
                let pop = this.confirm("Open "+util.formatText(name), "Are you sure you want to open this feature?\nThis feature is in development and might contain bugs");
                let result = await pop.whenResult();
                if (!result) return;
            }
            try {
                await window.api.send("spawn", name);
            } catch (e) { await this.doError("Spawn Error", "SpawnName: "+name, e); }
        });
        this.addHandler("cmd-reload", async () => await window.api.send("reload"));
        this.addHandler("cmd-helpurl", async id => {
            let url;
            if (id == "ionicons") url = "https://ionic.io/ionicons";
            else if (id == "electronjs") url = "https://www.electronjs.org/";
            else url = await window.api.get(id);
            await window.api.send("open", url);
        });
        this.addHandler("cmd-win-fullscreen", async v => {
            this.fullscreen = v;
        });
        this.addHandler("cmd-win-devmode", async v => {
            this.devMode = v;
        });
        this.addHandler("cmd-win-holiday", async v => {
            this.holiday = v;
        });

        this.addHandler("cmd-menu-click", async id => {
            let itm = this.menu.findItemWithId(id);
            if (!itm) return;
            itm.post("trigger", null);
        });

        this.#eTitle = document.querySelector("head > title");
        if (!(this.eTitle instanceof HTMLTitleElement)) this.#eTitle = document.createElement("title");
        document.head.appendChild(this.eTitle);
        this.title = "";

        this.#eCoreStyle = document.createElement("link");
        document.head.appendChild(this.eCoreStyle);
        this.eCoreStyle.rel = "stylesheet";
        this.eCoreStyle.href = root+"/style.css";

        this.#eStyle = document.createElement("link");
        document.head.appendChild(this.eStyle);
        this.eStyle.rel = "stylesheet";
        this.eStyle.href = theRoot+"/style.css";

        this.#eDynamicStyle = document.createElement("style");
        document.head.appendChild(this.eDynamicStyle);

        this.#eTitleBar = document.getElementById("titlebar");
        if (!(this.#eTitleBar instanceof HTMLDivElement)) this.#eTitleBar = document.createElement("div");
        document.body.appendChild(this.eTitleBar);
        this.eTitleBar.id = "titlebar";

        this.#eMount = document.getElementById("mount");
        if (!(this.#eMount instanceof HTMLDivElement)) this.#eMount = document.createElement("div");
        this.eMount.remove();
        if (document.body.children[0] instanceof HTMLElement) document.body.insertBefore(this.eMount, document.body.children[0]);
        else document.body.appendChild(this.eMount);
        this.eMount.id = "mount";

        this.#eRunInfo = document.getElementById("runinfo");
        if (!(this.#eRunInfo instanceof HTMLDivElement)) this.#eRunInfo = document.createElement("div");
        this.eRunInfo.remove();
        this.eMount.appendChild(this.eRunInfo);
        this.eRunInfo.id = "runinfo";
        document.body.addEventListener("keydown", e => {
            if (!(e.code == "KeyI" && (e.ctrlKey || e.metaKey) && !e.altKey)) return;
            e.stopPropagation();
            e.preventDefault();
            this.runInfoShown = !this.runInfoShown;
        });

        this.#eLoading = document.createElement("div");
        document.body.appendChild(this.eLoading);
        this.eLoading.id = "loading";
        this.eLoading.classList.add("this");
        this.eLoading.innerHTML = "<div class='title introtitle'></div>";
        setTimeout(() => {
            this.eTitleBar.style.opacity = "";
            this.eMount.style.opacity = "";
        }, 0.5*1000);
        this.eTitleBar.style.opacity = "0%";
        this.eMount.style.opacity = "0%";

        this.#eDrag = document.getElementById("drag");
        if (!(this.#eDrag instanceof HTMLDivElement)) this.#eDrag = document.createElement("div");
        document.body.appendChild(this.eDrag);
        this.eDrag.id = "drag";

        const ionicons1 = document.createElement("script");
        document.body.appendChild(ionicons1);
        ionicons1.type = "module";
        ionicons1.src = repoRoot+"/node_modules/ionicons/dist/ionicons/ionicons.esm.js";
        const ionicons2 = document.createElement("script");
        document.body.appendChild(ionicons2);
        ionicons2.noModule = true;
        ionicons2.src = repoRoot+"/node_modules/ionicons/dist/ionicons/ionicons.js";

        const fuse = document.createElement("script");
        document.head.appendChild(fuse);
        fuse.src = root+"/assets/modules/fuse.min.js";

        const showdown = document.createElement("script");
        document.head.appendChild(showdown);
        showdown.src = root+"/assets/modules/showdown.min.js";

        const highlight1 = document.createElement("script");
        document.head.appendChild(highlight1);
        highlight1.src = root+"/assets/modules/highlight.min.js";
        const highlight2 = document.createElement("link");
        document.head.appendChild(highlight2);
        highlight2.rel = "stylesheet";

        const qrcode = document.createElement("script");
        document.head.appendChild(qrcode);
        qrcode.src = root+"/assets/modules/qrcode.min.js";
        
        let t = util.getTime();
        
        this.fullscreen = await window.api.get("fullscreen");
        this.devMode = await window.api.get("devmode");
        this.holiday = await window.api.get("active-holiday");

        let agent = window.agent();
        document.documentElement.style.setProperty("--WIN32", ((util.is(agent.os, "obj") && (agent.os.platform == "win32")) ? 1 : 0));
        document.documentElement.style.setProperty("--DARWIN", ((util.is(agent.os, "obj") && (agent.os.platform == "darwin")) ? 1 : 0));
        document.documentElement.style.setProperty("--LINUX", ((util.is(agent.os, "obj") && (agent.os.platform == "linux")) ? 1 : 0));
        PROPERTYCACHE.clear();

        let themeUpdating = false;
        const themeUpdate = async () => {
            if (themeUpdating) return;
            themeUpdating = true;
            let theme = await window.api.get("theme");
            theme = util.is(theme, "obj") ? theme : String(theme);
            let data = util.is(theme, "obj") ? theme : util.ensure(util.ensure(await window.api.get("themes"), "obj")[theme], "obj");
            this.base = data.base || Array.from(new Array(9).keys()).map(i => new Array(3).fill(255*i/9));
            let darkWanted = !!(await window.api.get("dark-wanted"));
            highlight2.href = root+"/assets/modules/" + (darkWanted ? "highlight-dark.min.css" : "highlight-light.min.css");
            if (!darkWanted) this.base = this.base.reverse();
            this.colors = data.colors || {
                r: "#ff0000",
                o: "#ff8800",
                y: "#ffff00",
                g: "#00ff00",
                c: "#00ffff",
                b: "#0088ff",
                p: "#8800ff",
                m: "#ff00ff",
            };
            this.accent = data.accent || "b";
            themeUpdating = false;
        };
        this.addHandler("cmd-theme", () => themeUpdate());
        this.addHandler("cmd-native-theme", () => themeUpdate());
        await themeUpdate();

        await this.postResult("setup");

        const updatePage = () => {
            Array.from(document.querySelectorAll(".loading")).forEach(elem => {
                if (elem.children.length > 0) return;
                elem.innerHTML = "<div>"+new Array(4).fill("<div></div>").join("")+"</div>";
            });
            Array.from(document.querySelectorAll("label.filedialog")).forEach(elem => {
                if (elem.children.length > 0) return;
                elem.innerHTML = "<input type='file'><div class='value'></div><button></button>";
                const input = elem.input = elem.children[0];
                const value = elem.value = elem.children[1];
                const button = elem.button = elem.children[2];
                input.setAttribute("accept", elem.getAttribute("accept"));
                const update = () => {
                    let file = input.files[0];
                    let has = (file instanceof File); 
                    value.textContent = has ? file.name : "Choose a file...";
                    has ? value.classList.remove("empty") : value.classList.add("empty");
                };
                update();
                input.addEventListener("change", e => update());
                button.addEventListener("click", e => {
                    e.stopPropagation();
                    input.click();
                });
            });
            Array.from(document.querySelectorAll(".introtitle")).forEach(async elem => {
                if (elem.children.length <= 0) {
                    elem.innerHTML = "<div><div>p</div><div>eninsula</div></div><div></div>";
                    elem.children[1].textContent = util.formatText(await window.api.get("name"));
                }
                let both = 0;
                if (!(elem.querySelector(".special.back") instanceof HTMLImageElement)) {
                    let eSpecialBack = document.createElement("img");
                    if (elem.children[0] instanceof HTMLElement) elem.insertBefore(eSpecialBack, elem.children[0]);
                    else elem.appendChild(eSpecialBack);
                    eSpecialBack.classList.add("special");
                    eSpecialBack.classList.add("back");
                    both++;
                }
                if (!(elem.querySelector(".special.front") instanceof HTMLImageElement)) {
                    let eSpecialFront = document.createElement("img");
                    elem.appendChild(eSpecialFront);
                    eSpecialFront.classList.add("special");
                    eSpecialFront.classList.add("front");
                    both++;
                }
                if (both < 2) return;
                const onHolidayState = async holiday => {
                    const holidayData = util.ensure(util.ensure(await window.api.get("holidays"), "obj")[holiday], "obj");
                    if (holiday == null || ("hat" in holidayData && !holidayData.hat)) return elem.classList.remove("special");
                    elem.classList.add("special");
                    let eSpecialBack = elem.querySelector(".special.back");
                    if (eSpecialBack instanceof HTMLImageElement)
                        eSpecialBack.src = util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").hat2;
                    let eSpecialFront = elem.querySelector(".special.front");
                    if (eSpecialFront instanceof HTMLImageElement)
                        eSpecialFront.src = util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").hat1;
                };
                this.addHandler("cmd-win-holiday", async holiday => {
                    await onHolidayState(holiday);
                });
                await onHolidayState(await window.api.get("active-holiday"));
            });
            Array.from(document.querySelectorAll(".tooltip.color")).forEach(elem => {
                if (elem.children.length > 0) return;
                const signal = new util.Target();
                Object.defineProperty(elem, "signal", { value: signal, writable: false });
                const color = new util.Color(255, 0, 0);
                color.addHandler("change", () => {
                    update();
                    signal.post("change");
                });
                Object.defineProperty(elem, "color", {
                    get: () => color,
                    set: v => color.set(v),
                });
                "rgba".split("").forEach(k => Object.defineProperty(elem, k, {
                    get: () => color[k],
                    set: v => (color[k] = v),
                }));
                let useAlpha = true;
                Object.defineProperty(elem, "useAlpha", {
                    get: () => useAlpha,
                    set: v => {
                        useAlpha = !!v;
                        update();
                    },
                });
                let show = {};
                "hsv".split("").forEach(k => {
                    show[k] = true;
                    Object.defineProperty(elem, "show"+k.toUpperCase(), {
                        get: () => show[k],
                        set: v => {
                            show[k] = !!v;
                            update();
                        },
                    });
                });
                elem.innerHTML = "<div class='title'></div><div class='picker'><div></div></div><div class='sliders'><input type='range' min='0' max='100'><input type='range' min='0' max='100'><input type='range' min='0' max='100'><input type='range' min='0' max='100'></div><div class='swatches'></div>";
                const title = elem.children[0];
                Object.defineProperty(elem, "title", {
                    get: () => title.textContent,
                    set: v => (title.textContent = v),
                });
                elem.title = "Pick a color";
                const picker = elem.children[1];
                picker.addEventListener("mousedown", e => {
                    const mouseup = () => {
                        document.body.removeEventListener("mouseup", mouseup);
                        document.body.removeEventListener("mousemove", mousemove);
                    };
                    const mousemove = e => {
                        e.preventDefault();
                        e.stopPropagation();
                        let r = picker.getBoundingClientRect();
                        let x = (e.pageX - r.left) / r.width;
                        let y = (e.pageY - r.top) / r.height;
                        y = 1-y;
                        color.s = x;
                        color.v = y;
                    };
                    document.body.addEventListener("mouseup", mouseup);
                    document.body.addEventListener("mousemove", mousemove);
                    mousemove(e);
                });
                const pickerThumb = picker.children[0];
                const sliders = elem.children[2];
                const sliderElements = {};
                "hsva".split("").forEach((k, i) => {
                    const slider = sliderElements[k] = sliders.children[i];
                    slider.addEventListener("input", e => {
                        let v = slider.value;
                        v /= 100;
                        if (k == "h") v *= 360;
                        color[k] = v;
                    });
                });
                const swatches = elem.children[3];
                let swatchColors = [];
                Object.defineProperty(elem, "swatches", {
                    get: () => [...swatchColors],
                    set: v => {
                        v = util.ensure(v, "arr");
                        elem.clearSwatches();
                        elem.addSwatch(v);
                    },
                });
                elem.clearSwatches = () => {
                    let swatches = elem.swatches;
                    elem.remSwatch(swatches);
                    return swatches;
                };
                const getSwatch = swatch => {
                    swatch = new util.Color(swatch);
                    for (let i = 0; i < swatchColors.length; i++)
                        if (swatch.diff(swatchColors[i]) < 2)
                            return i;
                    return -1;
                };
                elem.hasSwatch = swatch => getSwatch(swatch) >= 0;
                elem.addSwatch = (...swatches) => {
                    let r = util.Target.resultingForEach(swatches, swatch => {
                        swatch = new util.Color(swatch);
                        if (elem.hasSwatch(swatch)) return false;
                        swatchesChanged = true;
                        swatchColors.push(swatch);
                        swatch.addLinkedHandler(this, "change", () => update());
                        return swatch;
                    });
                    update();
                    return r;
                };
                elem.remSwatch = (...swatches) => {
                    let r = util.Target.resultingForEach(swatches, swatch => {
                        swatch = new util.Color(swatch);
                        if (!elem.hasSwatch(swatch)) return false;
                        swatchesChanged = true;
                        swatchColors.splice(getSwatch(swatch), 1);
                        swatch.clearLinkedHandlers(this, "change");
                        return swatch;
                    });
                    update();
                    return r;
                };
                let swatchesChanged = false;
                const importDefault = () => {
                    if (swatchesChanged || !document.body.contains(elem)) return this.remHandler("update-dynamic-style", importDefault);
                    elem.swatches = "roygcbpm".split("").map(k => PROPERTYCACHE.getColor("--c"+k));
                    swatchesChanged = false;
                };
                this.addHandler("update-dynamic-style", importDefault);
                const update = () => {
                    let c = new util.Color(255, 0, 0);
                    c.h = color.h;
                    picker.style.background = "linear-gradient(90deg, #fff, "+c.toHex(false)+")";
                    picker.style.setProperty("--thumb", color.toHex(false));
                    pickerThumb.style.left = (100*color.s)+"%";
                    pickerThumb.style.top = (100*(1-color.v))+"%";
                    for (let k in sliderElements) {
                        let v = color[k];
                        if (k == "h") v /= 360;
                        v *= 100;
                        let on = (k == "a") ? useAlpha : show[k];
                        const slider = sliderElements[k];
                        slider.value = v;
                        slider.disabled = !on;
                        slider.style.display = on ? "" : "none";
                        let cthumb = new util.Color(255, 0, 0);
                        let carr = [];
                        if (k == "h") {
                            cthumb.h = color.h;
                            for (let i = 0; i < 7; i++) {
                                let c = new util.Color();
                                c.hsv = [util.lerp(0, 360, i/6), 1, 1];
                                carr.push(c);
                            }
                        } else if (k == "s") {
                            cthumb.h = color.h;
                            cthumb.s = color.s;
                            let c = new util.Color(255, 0, 0);
                            c.h = color.h;
                            carr.push(new util.Color(255, 255, 255), c);
                        } else if (k == "v") {
                            cthumb.h = color.h;
                            cthumb.s = color.s;
                            cthumb.v = color.v;
                            let c = new util.Color(255, 0, 0);
                            c.h = color.h;
                            c.s = color.s;
                            carr.push(new util.Color(0, 0, 0), c);
                        } else {
                            cthumb.hsva = color.hsva;
                            let c = new util.Color();
                            c.hsv = color.hsv;
                            carr.push(new util.Color(c.r, c.g, c.b, 0), c);
                        }
                        slider.style.background = "linear-gradient(90deg, "+carr.map(c => c.toHex()).join(", ")+")";
                        slider.style.setProperty("--thumb", cthumb.toHex());
                    }
                    swatches.innerHTML = "";
                    for (let c of swatchColors) {
                        let btn = document.createElement("button");
                        swatches.appendChild(btn);
                        btn.classList.add("override");
                        btn.style.backgroundColor = c.toHex();
                        btn.addEventListener("click", e => {
                            e.stopPropagation();
                            color.set(c);
                        });
                    }
                };
                update();
                importDefault();
            });
        };
        setInterval(updatePage, 500);
        updatePage();

        if (this.hasELoadingTo())
            this.eLoadingTo.style.visibility = "hidden";

        setTimeout(() => {
            this.eLoading.classList.remove("this");
            let introTitle = this.eLoading.querySelector(":scope > .introtitle");
            if (this.hasELoadingTo() && (introTitle instanceof HTMLElement)) {
                let r1 = introTitle.getBoundingClientRect();
                let r2 = this.eLoadingTo.getBoundingClientRect();
                let x1 = r1.left + r1.width/2;
                let y1 = r1.top + r1.height/2;
                let x2 = r2.left + r2.width/2;
                let y2 = r2.top + r2.height/2;
                let rx = x2 - x1;
                let ry = y2 - y1;
                let sx = r2.width / r1.width;
                let sy = r2.height / r1.height;
                this.eLoading.style.setProperty("--transform", "translate("+rx+"px, "+ry+"px) scale("+sx+", "+sy+")");
                setTimeout(() => {
                    this.eLoadingTo.style.visibility = "";
                }, 250);
            }
        }, Math.max(0, 1250 - (util.getTime()-t)));

        this.#setupDone = true;

        window.api.sendReady();

        return true;
    }
    get base() { return [...this.#base]; }
    set base(v) {
        v = util.ensure(v, "arr").map(v => new util.Color(v));
        while (v.length < 9) v.push(new util.Color((v.length > 0) ? v.at(-1) : null));
        while (v.length > 9) v.pop();
        this.#base = v;
        this.updateDynamicStyle();
    }
    getBase(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= 9) return null;
        return this.#base[i];
    }
    get colorNames() { return Object.keys(this.#colors); }
    get colorValues() { return Object.keys(this.#colors); }
    get colors() {
        let colors = {};
        this.colorNames.forEach(name => (colors[name] = this.getColor(name)));
        return colors;
    }
    set colors(v) {
        v = util.ensure(v, "obj");
        this.clearColors();
        for (let name in v) this.setColor(name, v[name]);
    }
    clearColors() {
        let colors = this.colors;
        for (let name in colors) this.delColor(name);
        return colors;
    }
    hasColor(name) {
        return String(name) in this.#colors;
    }
    getColor(name) {
        if (!this.hasColor(name)) return null;
        return this.#colors[String(name)];
    }
    setColor(name, color) {
        name = String(name);
        color = new util.Color(color);
        if (this.hasColor(name))
            if (color.diff(this.getColor(name)) < 2)
                return this.getColor(name);
        color.addHandler("change", () => this.updateDynamicStyle());
        this.#colors[name] = color;
        this.updateDynamicStyle();
        return color;
    }
    delColor(name) {
        name = String(name);
        if (!this.hasColor(name)) return null;
        let color = this.getColor(name);
        delete this.#colors[name];
        this.updateDynamicStyle();
        return color;
    }
    get accent() { return this.#accent; }
    set accent(v) {
        v = this.hasColor(v) ? String(v) : null;
        if (this.accent == v) return;
        this.#accent = v;
        this.updateDynamicStyle();
    }
    async updateDynamicStyle() {
        let accent = (this.holiday == null) ? this.accent : util.ensure(util.ensure(await window.api.get("holidays"), "obj")[this.holiday], "obj").accent;
        let style = {};
        let v0 = this.getBase(0), v8 = this.getBase(8);
        if (!(v0 instanceof util.Color)) v0 = new util.Color(0, 0, 0);
        if (!(v8 instanceof util.Color)) v8 = new util.Color(255, 255, 255);
        let v0Avg = (v0.r+v0.g+v0.b)/3, v8Avg = (v8.r+v8.g+v8.b)/3;
        let dark = v8Avg > v0Avg;
        for (let i = 0; i <= 9; i++) {
            let normal = (i < 9);
            for (let j = 0; j < 16; j++) {
                let alpha = j/15;
                let hex = "0123456789abcdef"[j];
                let vi = this.getBase(i);
                if (!(vi instanceof util.Color)) vi = new util.Color(...new Array(3).fill(255*(i/8)));
                if (normal) style["v"+i+"-"+hex] = "rgba("+[...vi.rgb, alpha].join(",")+")";
                else style["v-"+hex] = "var(--v4-"+hex+")";
            }
            if (normal) style["v"+i] = "var(--v"+i+"-f)";
            else style["v"] = "var(--v-f)";
        }
        let black = this.getBase(dark ? 1 : 8), white = this.getBase(dark ? 8 : 1);
        if (!(black instanceof util.Color)) black = new util.Color(0, 0, 0);
        if (!(white instanceof util.Color)) white = new util.Color(255, 255, 255);
        let colors = {};
        this.colorNames.forEach(name => (colors[name] = this.getColor(name)));
        colors._ = new util.Color(this.hasColor(accent) ? this.getColor(accent) : this.getBase(4));
        for (let name in colors) {
            let color = colors[name];
            let header = (name == "_") ? "a" : "c"+name;
            for (let i = 0; i <= 9; i++) {
                let normal = (i < 9);
                let newColor = normal ? util.lerp(color, (i<4) ? black : (i>4) ? white : color, Math.abs(i-4)/4) : null;
                for (let j = 0; j < 16; j++) {
                    let alpha = j/15;
                    let hex = "0123456789abcdef"[j];
                    if (normal) style[header+i+"-"+hex] = "rgba("+[...newColor.rgb, alpha].join(",")+")";
                    else style[header+"-"+hex] = "var(--"+header+"4-"+hex+")";
                }
                if (normal) style[header+i] = "var(--"+header+i+"-f)";
                else style[header] = "var(--"+header+"-f)";
            }
        }
        let animKeyframes = {};
        for (let i = 0; i <= 100; i++) {
            let p = i/100;
            let x1 = (p < 0) ? 0 : (p > 0.66) ? 1 : util.ease.quadIO((p-0)/(0.66-0));
            let x2 = (p < 0.33) ? 0 : (p > 1) ? 1 : util.ease.quadIO((p-0.33)/(1-0.33));
            animKeyframes[i] = {
                left: (100*x2)+"%",
                width: (100*(x1-x2))+"%",
            };
        }
        let styleStr = "";
        styleStr += ":root{";
        for (let k in style) styleStr += "--"+k+":"+style[k]+";";
        styleStr += "}";
        styleStr += "@keyframes loading-line{";
        for (let p in animKeyframes) {
            styleStr += p + "%{";
            for (let k in animKeyframes[p]) styleStr += k+":"+animKeyframes[p][k]+";";
            styleStr += "}";
        }
        styleStr += "}";
        this.eDynamicStyle.innerHTML = styleStr;
        PROPERTYCACHE.clear();
        this.post("update-dynamic-style");
        window.api.set("title-bar-overlay", {
            color: PROPERTYCACHE.get("--v1"),
            symbolColor: PROPERTYCACHE.get("--v8"),
        });
    }

    async getPerm() {
        if (this.popups.length > 0) return false;
        for (let perm of await this.postResult("perm"))
            if (!perm) return false;
        return true;
    }

    get popups() { return [...this.#popups]; }
    set popups(v) {
        v = util.ensure(v, "arr");
        this.clearPopups();
        this.addPopup(v);
    }
    clearPopups() {
        let pops = this.popups;
        this.remPopup(pops);
        return pops;
    }
    hasPopup(pop) {
        if (!(pop instanceof App.PopupBase)) return false;
        return this.#popups.includes(pop);
    }
    addPopup(...pops) {
        return util.Target.resultingForEach(pops, pop => {
            if (!(pop instanceof App.PopupBase)) return false;
            if (this.hasPopup(pop)) this.remPopup(pop);
            this.#popups.push(pop);
            pop.addLinkedHandler(this, "result", () => this.remPopup(pop));
            window.api.set("closeable", this.popups.length <= 0);
            pop.onAdd();
            return pop;
        });
    }
    remPopup(...pops) {
        return util.Target.resultingForEach(pops, pop => {
            if (!(pop instanceof App.PopupBase)) return false;
            if (!this.hasPopup(pop)) return false;
            pop.onRem();
            this.#popups.splice(this.#popups.indexOf(pop), 1);
            pop.clearLinkedHandlers(this, "result");
            window.api.set("closeable", this.popups.length <= 0);
            return pop;
        });
    }
    alert(...a) { return this.addPopup(new App.Alert(...a)); }
    error(...a) { return this.addPopup(new App.Error(...a)); }
    warn(...a) { return this.addPopup(new App.Warn(...a)); }
    confirm(...a) { return this.addPopup(new App.Confirm(...a)); }
    prompt(...a) { return this.addPopup(new App.Prompt(...a)); }
    async doAlert(...a) { return await this.alert(...a).whenResult(); }
    async doError(...a) { return await this.error(...a).whenResult(); }
    async doWarn(...a) { return await this.warn(...a).whenResult(); }
    async doConfirm(...a) { return await this.confirm(...a).whenResult(); }
    async doPrompt(...a) { return await this.prompt(...a).whenResult(); }

    get menu() { return this.#menu; }
    set menu(v) {
        if (!(v instanceof App.Menu)) return;
        if (this.menu == v) return;
        this.unbindMenu(this.menu);
        if (this.menu instanceof App.Menu)
            this.menu.clearLinkedHandlers(this, "change");
        this.#menu = v;
        this.menu.addLinkedHandler(this, "change", () => window.api.set("menu", this.menu.toObj()));
        window.api.set("menu", this.menu.toObj());
        this.bindMenu(this.menu);
    }
    bindMenu(menu) {
        if (!(menu instanceof App.Menu)) return false;
        ["PANEL", "PLANNER", "DATABASE", "PIT"].forEach(name => {
            let itm = menu.findItemWithId("spawn:"+name);
            if (!itm) return;
            itm.addLinkedHandler(this, "trigger", e => this.post("cmd-spawn", name));
        });
        ["ionicons", "electronjs", "repo", "db-host"].forEach(id => {
            let itm = menu.findItemWithId(id);
            if (!itm) return;
            itm.addLinkedHandler(this, "trigger", e => this.post("cmd-helpurl", id));
        });
        let itm;
        itm = menu.findItemWithId("about");
        if (itm) itm.addLinkedHandler(this, "trigger", e => this.post("cmd-about"));
        itm = menu.findItemWithId("settings");
        if (itm) itm.addLinkedHandler(this, "trigger", e => this.post("cmd-spawn", "PRESETS"));
        itm = menu.findItemWithId("reload");
        if (itm) itm.addLinkedHandler(this, "trigger", e => this.post("cmd-reload"));
        itm = menu.findItemWithId("documentation");
        if (itm) itm.addLinkedHandler(this, "trigger", e => this.post("cmd-documentation"));
        return menu;
    }
    unbindMenu(menu) {
        if (!(menu instanceof App.Menu)) return false;
        ["PANEL", "PLANNER"].forEach(name => {
            let itm = menu.findItemWithId("spawn:"+name);
            if (!itm) return;
            itm.clearLinkedHandlers(this, "trigger");
        });
        ["ionicons", "electronjs", "repo", "db-host"].forEach(id => {
            let itm = menu.findItemWithId(id);
            if (!itm) return;
            itm.clearLinkedHandlers(this, "trigger");
        });
        let itm;
        itm = menu.findItemWithId("about");
        if (itm) itm.clearLinkedHandlers(this, "trigger");
        itm = menu.findItemWithId("settings");
        if (itm) itm.clearLinkedHandlers(this, "trigger");
        itm = menu.findItemWithId("reload");
        if (itm) itm.clearLinkedHandlers(this, "trigger");
        return menu;
    }
    get contextMenu() { return this.#contextMenu; }
    set contextMenu(v) {
        v = (v instanceof App.Menu) ? v : null;
        if (this.contextMenu == v) return;
        if (this.hasContextMenu())
            document.body.removeChild(this.contextMenu.elem);
        this.#contextMenu = v;
        if (this.hasContextMenu())
            document.body.appendChild(this.contextMenu.elem);
    }
    hasContextMenu() { return !!this.contextMenu; }
    placeContextMenu(...v) {
        v = new V(...v);
        if (!this.hasContextMenu()) return false;
        this.contextMenu.elem.style.left = v.x+"px";
        this.contextMenu.elem.style.top = v.y+"px";
        setTimeout(() => this.contextMenu.fix(), 10);
        return this.contextMenu;
    }

    get dragging() { return this.#dragging; }
    set dragging(v) {
        v = !!v;
        if (this.dragging == v) return;
        this.#dragging = v;
        if (this.dragging) {
            this.#dragState = new util.Target();
            const mouseup = e => {
                this.post("drag-submit", e);
                this.dragState.post("submit", e);
                this.post("drag-stop");
                this.dragState.post("stop");
            };
            const mousemove = e => {
                this.eDrag.style.left = e.pageX+"px";
                this.eDrag.style.top = e.pageY+"px";
                this.post("drag-move", e);
                this.dragState.post("move", e);
            };
            this.dragState.addHandler("stop", () => {
                this.dragState._already = true;
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                this.dragging = false;
            });
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
            this.post("drag-start");
        } else {
            if (!this.dragState._already) {
                this.post("drag-cancel");
                this.dragState.post("cancel");
                this.post("drag-stop");
                this.dragState.post("stop");
            }
            this.#dragState = null;
            this.dragData = null;
        }
        this.eDrag.style.visibility = this.dragging ? "inherit" : "hidden";
    }
    submitDrag() {
        if (!this.dragging) return false;
        if (this.dragState._already) return false;
        this.post("drag-submit", e);
        this.dragState.post("submit", e);
        this.post("drag-stop");
        this.dragState.post("stop");
        return true;
    }
    get dragState() { return this.#dragState; }
    get dragData() { return this.#dragData; }
    set dragData(v) {
        if (this.dragging) return;
        this.#dragData = v;
    }
    get eDrag() { return this.#eDrag; }

    get pages() { return Object.keys(this.#pages); }
    hasPage(name) {
        name = String(name);
        return name in this.#pages;
    }
    addPage(...pages) {
        return util.Target.resultingForEach(pages, page => {
            if (!(page instanceof App.Page)) return false;
            if (page.app != this) return false;
            if (this.hasPage(page.name)) return false;
            this.#pages[page.name] = page;
            this.eMount.appendChild(page.elem);
            page.leave(null);
            page.onAdd();
            return page;
        });
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

        if (this.hasPage(this.page)) await this.getPage(this.page).enter(data);

        this.pages.forEach(name => this.getPage(name).elem.classList[(name == this.page ? "add" : "remove")]("this"));
    }

    get title() { return this.#title; }
    set title(v) {
        v = String(v);
        if (this.title == v) return;
        this.#title = v;
        (async () => {
            let name = util.formatText(await window.api.get("name"));
            this.eTitle.textContent = (v.length > 0) ? (v+" — "+name) : name;
        })();
    }

    get eTitle() { return this.#eTitle; }
    get eCoreStyle() { return this.#eCoreStyle; }
    get eStyle() { return this.#eStyle; }
    get eDynamicStyle() { return this.#eDynamicStyle; }
    get eTitleBar() { return this.#eTitleBar; }
    get eLoading() { return this.#eLoading; }
    get eLoadingTo() { return this.#eLoadingTo; }
    set eLoadingTo(v) {
        v = (v instanceof HTMLElement) ? v : null;
        if (this.eLoadingTo == v) return;
        this.#eLoadingTo = v;
    }
    hasELoadingTo() { return this.eLoadingTo instanceof HTMLElement; }
    get eMount() { return this.#eMount; }
    get eRunInfo() { return this.#eRunInfo; }
    get runInfoShown() { return this.eMount.classList.contains("runinfo"); }
    set runInfoShown(v) {
        v = !!v;
        if (this.runInfoShown == v) return;
        if (v) this.eMount.classList.add("runinfo");
        else this.eMount.classList.remove("runinfo");
    }
    get runInfoHidden() { return !this.runInfoShown; }
    set runInfoHidden(v) { this.runInfoShown = !v; }

    get progress() {
        if (!this.eTitleBar.classList.contains("progress")) return null;
        let progress = this.eTitleBar.style.getPropertyValue("--progress");
        progress = progress.substring(0, progress.length-1);
        return Math.min(1, Math.max(0, util.ensure(parseFloat(progress), "num")/100));
    }
    set progress(v) {
        v = (v == null) ? null : Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (v == null) return this.eTitleBar.classList.remove("progress");
        this.eTitleBar.classList.add("progress");
        this.eTitleBar.style.setProperty("--progress", (v*100)+"%");
    }

    static async capture(rect) { return await window.api.send("capture", rect); }
    static async fileOpenDialog(options) { return await window.api.send("file-open-dialog", options); }
    static async fileSaveDialog(options) { return await window.api.send("file-save-dialog", options); }

    get state() { return {}; }
    async loadState(state) {}
}
App.PopupBase = class AppPopupBase extends util.Target {
    #id;
    #result;

    #resolver;

    #elem;
    #inner;

    static NAME = null;
    static PARAMS = [];

    constructor() {
        super();

        this.#id = null;
        this.#result = null;

        this.#resolver = new util.Resolver(false);

        this.#elem = document.createElement("div");
        this.elem.classList.add("popup");
        this.#inner = document.createElement("div");
        this.elem.appendChild(this.inner);
        this.inner.classList.add("inner");

        let remove = null;
        this.addHandler("add", async () => {
            let agent = window.agent();
            this.#id = (!util.is(agent, "obj") || agent.os.platform != "darwin") ? null : await window.modal.spawn(this.constructor.NAME, this.generateParams());
            if (this.id == null) {
                document.body.appendChild(this.elem);
                setTimeout(() => {
                    this.elem.classList.add("in");
                }, 0.01*1000);
            } else {
                const onChange = () => window.modal.modify(this.id, this.generateParams());
                this.addHandler("change", onChange);
                onChange();
                remove = window.modal.onResult((_, id2, r) => {
                    if (id2 != this.id) return;
                    if (util.is(remove, "func")) {
                        remove();
                        remove = null;
                    }
                    this.value = r;
                    this.result(this.value);
                    this.remHandler("change", onChange);
                });
                this.post("post-add");
            }
        });
        this.addHandler("rem", async () => {
            if (util.is(remove, "func")) {
                remove();
                remove = null;
            }
            if (document.body.contains(this.elem)) {
                this.elem.classList.remove("in");
                setTimeout(() => {
                    document.body.removeChild(this.elem);
                }, 0.25*1000);
            } else {
                this.post("post-rem");
            }
            this.#id = null;
        });
    }

    generateParams() {
        let params = {};
        this.constructor.PARAMS.forEach(param => (params[param] = this[param]));
        return params;
    }

    get id() { return this.#id; }

    get hasResult() { return this.#resolver.state; }
    get theResult() { return this.#result; }
    async whenResult() {
        if (this.hasResult) return this.theResult;
        await this.#resolver.whenTrue();
        return this.theResult;
    }

    get elem() { return this.#elem; }
    get inner() { return this.#inner; }

    result(r) {
        this.#resolver.state = true;
        this.#result = r;
        this.post("result", r);
    }
};
App.Popup = class AppPopup extends App.PopupBase {
    #eClose;
    #eTitle;
    #eContent;

    static {
        this.PARAMS = [...this.PARAMS, "title"];
    }

    constructor() {
        super();

        this.elem.classList.add("custom");

        this.#eClose = document.createElement("button");
        this.inner.appendChild(this.eClose);
        this.eClose.classList.add("close");
        this.eClose.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eTitle = document.createElement("div");
        this.inner.appendChild(this.eTitle);
        this.eTitle.classList.add("title");
        this.#eContent = document.createElement("div");
        this.inner.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.eClose.addEventListener("click", e => {
            e.stopPropagation();
            this.result(null);
        });

        const onKeyDown = e => {
            if (!document.body.contains(this.elem)) return document.body.removeEventListener("keydown", onKeyDown);
            if (e.code != "Escape") return;
            this.result(null);
        };
        this.addHandler("add", () => document.body.addEventListener("keydown", onKeyDown));
        this.addHandler("rem", () => document.body.removeEventListener("keydown", onKeyDown));
    }

    get eClose() { return this.#eClose; }
    get eTitle() { return this.#eTitle; }
    get eContent() { return this.#eContent; }

    get title() { return this.eTitle.textContent; }
    set title(v) {
        this.eTitle.textContent = v;
        this.change("title", null, this.title);
    }
};
App.MarkdownPopup = class AppMarkdownPopup extends App.Popup {
    #signal;
    #history;

    #eArticle;

    constructor(href, signal) {
        super();

        this.elem.classList.add("markdown");

        this.#signal = (signal instanceof util.Target) ? signal : new util.Target();
        this.#history = [];

        this.signal.addHandler("nav", async (e, href) => this.navigate(href));
        this.signal.addHandler("back", async () => {
            if (this.#history.length <= 1) return this.result(null);
            this.#history.pop();
            this.navigate(this.#history.pop(), +1);
        });

        this.#eArticle = null;

        this.navigate(href);
    }

    get signal() { return this.#signal; }

    async navigate(href, direction=-1) {
        this.#history.push(href);
        if (this.hasEArticle()) {
            let article = this.eArticle;
            this.#eArticle = null;
            if (direction == +1) article.classList.add("out-right");
            if (direction == -1) article.classList.add("out-left");
            setTimeout(() => article.remove(), 250);
        }
        try {
            const repoRoot = await window.api.getRepoRoot();
            const url = "file://"+repoRoot+"/";
            const hrefUrl = String(new URL(href, url));
            const relativeUrl = String(new URL("..", hrefUrl+"/")).substring(url.length);
            this.#eArticle = await App.createMarkdown(await (await fetch(hrefUrl)).text(), this.signal, "./"+relativeUrl);
            this.eContent.appendChild(this.eArticle);
        } catch (e) { return false; }
        if (!this.hasEArticle()) return false;
        let article = this.eArticle;
        article.classList.add("lighter");
        if (direction == +1) article.classList.add("in-right");
        if (direction == -1) article.classList.add("in-left");
        setTimeout(() => {
            article.classList.remove("in-right");
            article.classList.remove("in-left");
        }, 250);
        return true;
    }

    get eArticle() { return this.#eArticle; }
    hasEArticle() { return !!this.eArticle; }
};
App.CorePopup = class AppCorePopup extends App.PopupBase {
    #eIconBox;
    #eIcon;
    #eSubIcon;
    #eTitle;
    #eContent;
    #infos;

    static {
        this.PARAMS = [
            ...this.PARAMS,
            "icon", "iconSrc", "iconColor",
            "subIcon", "subIconSrc", "subIconColor",
            "title", "content",
            "infos",
        ];
    }

    constructor(title, content, icon="") {
        super();

        this.elem.classList.add("core");

        this.#eIconBox = document.createElement("div");
        this.inner.appendChild(this.eIconBox);
        this.eIconBox.classList.add("icon");
        this.#eIcon = document.createElement("ion-icon");
        this.eIconBox.appendChild(this.eIcon);
        this.#eSubIcon = document.createElement("ion-icon");
        this.eIconBox.appendChild(this.eSubIcon);
        this.#eTitle = document.createElement("div");
        this.inner.appendChild(this.eTitle);
        this.eTitle.classList.add("title");
        this.#eContent = document.createElement("div");
        this.inner.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#infos = [];

        this.title = title;
        this.content = content;
        this.icon = icon;
    }

    get eIconBox() { return this.#eIconBox; }
    get eIcon() { return this.#eIcon; }
    get eSubIcon() { return this.#eSubIcon; }
    get eTitle() { return this.#eTitle; }
    get eContent() { return this.#eContent; }

    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
        this.change("icon", null, this.icon);
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.setAttribute("src", v);
        this.change("iconSrc", null, this.iconSrc);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) {
        this.eIcon.style.color = v;
        this.change("iconColor", null, this.iconColor);
    }

    get subIcon() { return this.eSubIcon.name; }
    set subIcon(v) {
        this.eSubIcon.removeAttribute("src");
        if (this.subIcon == v) return;
        this.eSubIcon.name = v;
        this.change("subIcon", null, this.subIcon);
    }
    get subIconSrc() { return this.eSubIcon.getAttribute("src"); }
    set subIconSrc(v) {
        this.eSubIcon.setAttribute("src", v);
        this.change("subIconSrc", null, this.subIconSrc);
    }
    get subIconColor() { return this.eSubIcon.style.color; }
    set subIconColor(v) {
        this.eSubIcon.style.color = v;
        this.change("subIconColor", null, this.subIconColor);
    }
    
    get title() { return this.eTitle.textContent; }
    set title(v) {
        this.eTitle.textContent = v;
        this.change("title", null, this.title);
    }

    get content() { return this.eContent.textContent; }
    set content(v) {
        this.eContent.textContent = v;
        this.change("content", null, this.content);
    }

    get infos() { return [...this.#infos]; }
    set infos(v) {
        this.#infos = util.ensure(v, "arr").map(v => String(v));
        Array.from(this.inner.querySelectorAll(":scope > .info")).forEach(elem => elem.remove());
        let sibling = this.eContent.nextElementSibling;
        this.infos.forEach(info => {
            let elem = document.createElement("div");
            this.inner.insertBefore(elem, sibling);
            elem.classList.add("info");
            elem.innerHTML = String(info).replaceAll("<", "&lt").replaceAll(">", "&gt");
            let btn = document.createElement("button");
            elem.appendChild(btn);
            btn.innerHTML = "<ion-icon name='copy-outline'></ion-icon>";
            btn.addEventListener("click", e => {
                e.stopPropagation();
                navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([info], { type: "text/plain" })})]);
            });
        });
        this.change("infos", null, this.infos);
    }
}
App.Alert = class AppAlert extends App.CorePopup {
    #eButton;

    static NAME = "ALERT";

    static {
        this.PARAMS = [...this.PARAMS, "button"];
    }

    constructor(title, content, icon="alert-circle", button="OK") {
        super(title, content, icon);

        this.elem.classList.add("alert");

        this.#eButton = document.createElement("button");
        this.inner.appendChild(this.eButton);
        this.eButton.classList.add("special");

        this.eButton.addEventListener("click", e => {
            e.stopPropagation();
            this.result(null);
        });

        this.button = button;
    }

    get eButton() { return this.#eButton; }

    get button() { return this.eButton.textContent; }
    set button(v) {
        [v, this.eButton.textContent] = [this.button, v];
        this.change("button", v, this.button);
    }
};
App.Error = class AppError extends App.Alert {
    constructor(title, content, ...infos) {
        super(title, content, "warning");

        this.iconColor = "var(--cr)";

        this.infos = infos;
    }
};
App.Warn = class AppError extends App.Alert {
    constructor(title, content, ...infos) {
        super(title, content, "warning");

        this.iconColor = "var(--cy)";

        this.infos = infos;
    }
};
App.Confirm = class AppConfirm extends App.CorePopup {
    #eConfirm;
    #eCancel;

    static NAME = "CONFIRM";

    static {
        this.PARAMS = [...this.PARAMS, "confirm", "cancel"];
    }

    constructor(title, content, icon="help-circle", confirm="OK", cancel="Cancel") {
        super(title, content, icon);

        this.elem.classList.add("confirm");

        this.#eConfirm = document.createElement("button");
        this.inner.appendChild(this.eConfirm);
        this.eConfirm.classList.add("special");
        this.#eCancel = document.createElement("button");
        this.inner.appendChild(this.eCancel);
        this.eCancel.classList.add("heavy");

        this.eConfirm.addEventListener("click", e => {
            e.stopPropagation();
            this.result(true);
        });
        this.eCancel.addEventListener("click", e => {
            e.stopPropagation();
            this.result(false);
        });

        this.confirm = confirm;
        this.cancel = cancel;
    }

    get eCancel() { return this.#eCancel; }
    get eConfirm() { return this.#eConfirm; }

    get confirm() { return this.eConfirm.textContent; }
    set confirm(v) {
        [v, this.eConfirm.textContent] = [this.confirm, v];
        this.change("confirm", v, this.confirm);
    }
    get cancel() { return this.eCancel.textContent; }
    set cancel(v) {
        [v, this.eCancel.textContent] = [this.cancel, v];
        this.change("cancel", v, this.cancel);
    }
};
App.Prompt = class AppPrompt extends App.CorePopup {
    #type;
    #doCast;

    #eInput;
    #eConfirm;
    #eCancel;

    static NAME = "PROMPT";

    static {
        this.PARAMS = [...this.PARAMS, "type", "confirm", "cancel", "value", "placeholder"];
    }

    constructor(title, content, value="", icon="pencil", confirm="OK", cancel="Cancel", placeholder="...") {
        super(title, content, icon);

        this.elem.classList.add("prompt");

        this.#type = "str";
        this.#doCast = v => v;

        this.#eInput = document.createElement("input");
        this.inner.appendChild(this.eInput);
        this.eInput.autocomplete = "off";
        this.eInput.spellcheck = false;
        this.#eConfirm = document.createElement("button");
        this.inner.appendChild(this.eConfirm); 
        this.eConfirm.classList.add("special");
        this.#eCancel = document.createElement("button");
        this.inner.appendChild(this.eCancel);
        this.eCancel.classList.add("heavy");

        this.eInput.addEventListener("change", e => {
            this.cast();
        });
        this.eInput.addEventListener("keydown", e => {
            if (e.code != "Enter" && e.code != "Return") return;
            e.preventDefault();
            this.eConfirm.click();
        });
        this.eConfirm.addEventListener("click", e => {
            e.stopPropagation();
            this.result(this.cast());
        });
        this.eCancel.addEventListener("click", e => {
            e.stopPropagation();
            this.result(null);
        });

        let remove = null;
        this.addHandler("post-add", async () => {
            remove = window.modal.onCast((_, id2, v) => {
                if (id2 != this.id) return;
                this.value = v;
                return this.value;
            });
        });
        this.addHandler("post-rem", async () => {
            if (util.is(remove, "func")) remove();
        });

        this.value = value;
        this.confirm = confirm;
        this.cancel = cancel;
        this.placeholder = placeholder;
    }

    get type() { return this.#type; }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
        this.eInput.type = ["any_num", "num", "float", "int"].includes(this.type) ? "number" : "text";
        if (["int"].includes(this.type)) this.eInput.step = 1;
        else this.eInput.removeAttribute("step");
        this.cast();
    }
    customType() { return this.type == null; }
    get doCast() { return this.#doCast; }
    set doCast(v) {
        v = util.ensure(v, "func");
        if (this.doCast == v) return;
        this.change("doCast", this.doCast, this.#doCast=v);
        this.cast();
    }

    get eInput() { return this.#eInput; }
    get eCancel() { return this.#eCancel; }
    get eConfirm() { return this.#eConfirm; }

    get confirm() { return this.eConfirm.textContent; }
    set confirm(v) {
        [v, this.eConfirm.textContent] = [this.confirm, v];
        this.change("confirm", v, this.confirm);
    }
    get cancel() { return this.eCancel.textContent; }
    set cancel(v) {
        [v, this.eCancel.textContent] = [this.cancel, v];
        this.change("cancel", v, this.cancel);
    }

    get value() { return this.eInput.value; }
    set value(v) {
        v = String(v);
        if (this.value == v) return;
        [v, this.eInput.value] = [this.value, v];
        this.cast();
        this.change("value", v, this.value);
    }

    get placeholder() { return this.eInput.placeholder; }
    set placeholder(v) {
        [v, this.eInput.placeholder] = [this.placeholder, v];
        this.change("placeholder", v, this.placeholder);
    }

    cast() {
        if (this.customType())
            return this.value = this.doCast(this.value);
        let v = this.value;
        if (["any_num", "num", "float"].includes(this.type)) v = util.ensure(parseFloat(v), this.type);
        else if (["int"].includes(this.type)) v = util.ensure(parseInt(v), this.type);
        else v = util.ensure(v, this.type);
        this.value = v;
        return v;
    }
};
App.Progress = class AppProgress extends App.CorePopup {
    #eProgress;

    #value;

    static NAME = "PROGRESS";

    static {
        this.PARAMS = [...this.PARAMS, "value"];
    }

    constructor(title, content, value=0) {
        super(title, content, "");

        this.elem.classList.add("progress");

        this.eIconBox.style.display = "none";

        this.#eProgress = document.createElement("div");
        this.inner.appendChild(this.eProgress);
        this.eProgress.classList.add("progress");

        this.#value = null;

        this.value = value;
    }

    get eProgress() { return this.#eProgress; }

    get value() { return this.#value; }
    set value(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
        this.eProgress.style.setProperty("--progress", (100*this.value)+"%");
    }
};
App.Menu = class AppMenu extends util.Target {
    #items;

    #elem;

    constructor() {
        super();

        this.#items = [];

        this.#elem = document.createElement("div");
        this.elem.classList.add("contextmenu");
    }

    get items() { return [...this.#items]; }
    set items(v) {
        v = util.ensure(v, "arr");
        this.clearItems();
        this.addItem(v);
    }
    clearItems() {
        let itms = this.items;
        this.remItem(itms);
        return itms;
    }
    hasItem(itm) {
        if (!(itm instanceof App.Menu.Item)) return false;
        return this.#items.includes(itm);
    }
    insertItem(itm, at) {
        if (!(itm instanceof App.Menu.Item)) return false;
        if (this.hasItem(itm)) return false;
        at = Math.min(this.items.length, Math.max(0, util.ensure(at, "int")));
        this.#items.splice(at, 0, itm);
        itm.addLinkedHandler(this, "format", () => this.format());
        itm.addLinkedHandler(this, "change", (c, f, t) => this.change("items["+this.#items.indexOf(itm)+"]."+c, f, t));
        this.change("insertItem", null, itm);
        this.format();
        itm.onAdd();
        return itm;
    }
    addItem(...itms) {
        let r = util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof App.Menu.Item)) return false;
            if (this.hasItem(itm)) return false;
            this.#items.push(itm);
            itm.addLinkedHandler(this, "format", () => this.format());
            itm.addLinkedHandler(this, "change", (c, f, t) => this.change("items["+this.#items.indexOf(itm)+"]."+c, f, t));
            this.change("addItem", null, itm);
            itm.onAdd();
            return itm;
        });
        this.format();
        return r;
    }
    remItem(itm) {
        if (!(itm instanceof App.Menu.Item)) return false;
        if (!this.hasItem(itm)) return false;
        itm.onRem();
        this.#items.splice(this.#items.indexOf(itm), 1);
        itm.clearLinkedHandlers(this, "format");
        itm.clearLinkedHandlers(this, "change");
        this.change("remItem", itm, null);
        this.format();
        return itm;
    }
    findItemWithId(id) {
        for (let itm of this.items) {
            let foundItm = itm.findItemWithId(id);
            if (!foundItm) continue;
            return foundItm;
        }
        return null;
    }

    get elem() { return this.#elem; }

    fix() {
        this.elem.style.transform = "";
        this.elem.offsetWidth;
        let r = this.elem.getBoundingClientRect();
        let ox = 0, oy = 0;
        if (r.right > window.innerWidth) ox = window.innerWidth-r.right;
        if (r.left < 0) ox = 0-r.left;
        if (r.bottom > window.innerHeight) oy = window.innerHeight-r.bottom;
        if (r.top < 0) oy = 0-r.top;
        this.elem.style.transform = "translate("+ox+"px, "+oy+"px)";
    }
    format() {
        this.elem.innerHTML = "";
        let itms = this.items;
        let prevItm = null;
        for (let i = 0; i < itms.length; i++) {
            let itm = itms[i];
            if (itm.type == "separator") {
                if (prevItm != null)
                    if (prevItm.type == "separator")
                        continue;
            } else if (itm.hasRole()) continue;
            this.elem.appendChild(itm.elem);
            prevItm = itm;
        }
        if (prevItm != null)
            if (prevItm.type == "separator")
                this.elem.removeChild(prevItm.elem);
    }

    toObj() {
        return this.items.filter(itm => itm.exists && itm.type != "input").map(itm => itm.toObj());
    }
    static fromObj(data) {
        let menu = new App.Menu();
        menu.items = util.ensure(data, "arr").map(data => App.Menu.Item.fromObj(data));
        return menu;
    }

    static buildRoleItems(...roles) {
        return roles.map(role => {
            let itm = new App.Menu.Item(null);
            itm.role = role;
            if (itm.hasRole()) itm.id = itm.role;
            return itm;
        });
    }

    static buildAboutItems() {
        let itm = new App.Menu.Item("About Peninsula");
        itm.id = "about";
        return [itm];
    }
    static buildSettingsItems() {
        let itm = new App.Menu.Item("Settings", "settings-outline");
        itm.id = "settings";
        itm.accelerator = "CmdOrCtrl+,";
        return [itm];
    }
    static buildHideItems() { return this.buildRoleItems("hide", "hideOthers", "unhide"); }
    static buildQuitItems() { return this.buildRoleItems("quit"); }
    static buildCloseItems() { return this.buildRoleItems("close"); }
    static buildUndoRedoItems() { return this.buildRoleItems("undo", "redo"); }
    static buildCutCopyPasteItems() { return this.buildRoleItems("cut", "copy", "paste"); }
    static buildFullscreenItems() { return this.buildRoleItems("togglefullscreen"); }
    static buildWindowItems() { return this.buildRoleItems("minimize", "zoom"); }
    static buildFrontItems() { return this.buildRoleItems("front"); }
    static buildHelpItems() {
        let itms = [];
        let itm = new App.Menu.Item("Documentation...", "document-text-outline");
        itms.push(itm);
        itm.id = "documentation";
        itms.push(...["Ionicons", "Electron.js", "Github Repository", "Open Database"].map((label, i) => {
            let itm = new App.Menu.Item(label);
            itm.id = ["ionicons", "electronjs", "repo", "db-host"][i];
            return itm;
        }));
        return itms;
    }
    static buildReloadItems() {
        let itm = new App.Menu.Item("Reload");
        itm.id = "reload";
        itm.accelerator = "CmdOrCtrl+R";
        return [itm];
    }
    static buildSpawnItems() {
        let itm = new App.Menu.Item("Features...");
        itm.id = "spawn";
        ["PANEL", "PLANNER", "DATABASE", "PIT"].forEach((name, i) => {
            let subitm = new App.Menu.Item(util.formatText(name));
            subitm.id = "spawn:"+name;
            subitm.accelerator = "CmdOrCtrl+"+(i+1);
            itm.menu.addItem(subitm);
        });
        return [itm];
    }
    static buildDevToolsItems() { return this.buildRoleItems("toggledevtools"); }
    static buildMainMenu() {
        let menu = new App.Menu();
        let itms = [
            ...this.buildAboutItems(),
            new App.Menu.Divider(),
            ...this.buildSettingsItems(),
            new App.Menu.Divider(),
            ...this.buildHideItems(),
            new App.Menu.Divider(),
            ...this.buildQuitItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildFileMenu() {
        let menu = new App.Menu();
        let itms = [
            ...this.buildReloadItems(),
            ...this.buildSpawnItems(),
            new App.Menu.Divider(),
            ...this.buildCloseItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildEditMenu() {
        let menu = new App.Menu();
        let itms = [
            ...this.buildUndoRedoItems(),
            new App.Menu.Divider(),
            ...this.buildCutCopyPasteItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildViewMenu() {
        let menu = new App.Menu();
        let itms = [
            ...this.buildFullscreenItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildWindowMenu() {
        let agent = window.agent();
        let menu = new App.Menu();
        let itms = [
            ...this.buildWindowItems(),
            ...this.buildDevToolsItems(),
        ];
        if (util.is(agent.os, "obj") && (agent.os.platform == "darwin"))
            itms.splice(2, 0, new App.Menu.Divider(), ...this.buildFrontItems(), new App.Menu.Divider());
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildHelpMenu() {
        let menu = new App.Menu();
        let itms = [
            ...this.buildHelpItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildMenu() {
        let menu = new App.Menu();
        let menus = [
            this.buildFileMenu(),
            this.buildEditMenu(),
            this.buildViewMenu(),
            this.buildWindowMenu(),
            this.buildHelpMenu(),
        ];
        menus.forEach((submenu, i) => {
            let name = ["file", "edit", "view", "window", "help"][i];
            let itm = new App.Menu.Item(util.formatText(name));
            itm.id = "menu:"+name;
            if (name == "help") itm.role = "help";
            submenu.items.forEach(subitm => itm.menu.addItem(subitm));
            menu.addItem(itm);
        });
        return menu;
    }
    static buildWholeMenu(name) {
        name = String(name);
        let menu = new App.Menu();
        let itm = new App.Menu.item((name.length > 0) ? name : "Peninsula", "navigate");
        itm.id = "menu:main";
        this.buildMainMenu().items.forEach(subitm => itm.menu.addItem(subitm));
        menu.addItem(itm);
        this.buildMenu().items.forEach(itm => menu.addItem(itm));
        return menu;
    }
};
App.Menu.Item = class AppMenuItem extends util.Target {
    #id;

    #role;
    #type;
    #label;
    #accelerator;
    #enabled;
    #visible;
    #checked;
    #exists;
    #menu;

    #elem;
    #eIcon;
    #eLabel;
    #eAccelerator;
    #eSubIcon;
    #eInput;

    constructor(label, icon="") {
        super();

        this.#id = util.jargonBase64(64);

        this.#role = null;
        this.#type = null;
        this.#label = null;
        this.#accelerator = null;
        this.#enabled = true;
        this.#visible = true;
        this.#checked = false;
        this.#exists = true;
        this.#menu = new App.Menu();
        this.menu.addHandler("change", (c, f, t) => this.change("menu."+c, f, t));

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.eIcon.classList.add("icon");
        this.#eLabel = document.createElement("div");
        this.elem.appendChild(this.eLabel);
        this.eLabel.classList.add("label");
        this.#eAccelerator = document.createElement("div");
        this.elem.appendChild(this.eAccelerator);
        this.eAccelerator.classList.add("accelerator");
        this.#eSubIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eSubIcon);
        this.eSubIcon.classList.add("sub");
        this.eSubIcon.name = "chevron-forward";
        this.#eInput = document.createElement("input");
        this.elem.appendChild(this.eInput);
        this.eInput.classList.add("blocking");

        this.elem.appendChild(this.menu.elem);

        this.elem.addEventListener("mouseenter", e => setTimeout(() => this.fix(), 10));
        this.elem.addEventListener("click", e => {
            if (this.type == "input") return;
            if (this.disabled) return;
            e.stopPropagation();
            this.post("trigger", e);
        });
        this.eInput.addEventListener("change", e => {
            if (this.type != "input") return;
            if (this.disabled) return;
            this.post("trigger", e, this.eInput.value);
        });

        this.icon = icon;
        this.label = label;

        this.addHandler("change", () => {
            this.eSubIcon.style.display = (this.menu.items.length > 0) ? "" : "none";
        });
        this.eSubIcon.style.display = (this.menu.items.length > 0) ? "" : "none";
    }

    get id() { return this.#id; }
    set id(v) {
        v = String(v);
        if (this.id == v) return;
        this.change("id", this.id, this.#id=v);
    }

    get role() { return this.#role; }
    set role(v) {
        v = (v == null) ? null : String(v);
        if (this.role == v) return;
        this.change("role", this.role, this.#role=v);
        if (!this.hasRole()) return;
        (async () => {
            let v = this.role;
            let label = await window.api.send("menu-role-label", v);
            if (this.role != v) return;
            this.eLabel.textContent = label;
        })();
        this.#check();
    }
    hasRole() { return this.role != null; }
    get type() { return this.#type; }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
        if (this.type == "separator") this.elem.classList.add("divider");
        else this.elem.classList.remove("divider");
        if (this.type == "input") this.elem.classList.add("input");
        else this.elem.classList.remove("input");
        this.#check();
    }
    hasType() { return this.type != null; }
    get label() { return this.#label; }
    set label(v) {
        v = (v == null) ? null : String(v);
        if (this.label == v) return;
        this.change("label", this.label, this.#label=v);
        if (!this.hasRole()) return this.eLabel.textContent = this.eInput.placeholder = this.hasLabel() ? this.label : "";
        (async () => {
            let v = this.role;
            let label = await window.api.send("menu-role-label", v);
            if (this.role != v) return;
            this.eLabel.textContent = this.eInput.placeholder = label;
        })();
        this.#check();
    }
    hasLabel() { return this.label != null; }
    get accelerator() { return this.#accelerator; }
    set accelerator(v) {
        v = (v == null) ? null : String(v);
        if (this.accelerator == v) return;
        this.change("accelerator", this.accelerator, this.#accelerator=v);
        let parts = this.hasAccelerator() ? this.accelerator.split("+") : [];
        parts = parts.map(part => {
            if (["CommandOrControl", "CmdOrCtrl", "Command", "Cmd"].includes(part)) return "⌘";
            if (["Control", "Ctrl"].includes(part)) return "⌃";
            if (part == "Alt") return "⎇";
            if (part == "Option") return "⌥";
            if (part == "Shift") return "⇧";
            if (part == "Super") return "❖";
            if (part == "Meta") return "⌘";
            if (part == "Plus") return "+";
            if (part == "Tab") return "⇥";
            if (part == "Backspace") return "⌫";
            if (part == "Delete") return "⌦";
            if (["Return", "Enter"].includes(part)) return "↩︎";
            if (part == "Up") return "▲";
            if (part == "Down") return "▼";
            if (part == "Left") return "◀︎";
            if (part == "Right") return "▶︎";
            if (part == "Home") return "↑";
            if (part == "End") return "↓";
            if (part == "PageUp") return "↑";
            if (part == "PageDown") return "↓";
            if (["Escape", "Esc"].includes(part)) return "⎋";
            if (part == "numdec") return ".";
            if (part == "numadd") return "+";
            if (part == "numsub") return "-";
            if (part == "nummult") return "*";
            if (part == "numdiv") return "/";
            for (let i = 0; i < 10; i++)
                if (part == "num"+i)
                    return String(i);
            return part;
        });
        this.eAccelerator.textContent = parts.join("");
        this.eAccelerator.style.display = (this.eAccelerator.textContent.length > 0) ? "" : "none";
        this.#check();
    }
    hasAccelerator() { return this.accelerator != null; }
    get enabled() { return this.#enabled; }
    set enabled(v) {
        v = !!v;
        if (this.enabled == v) return;
        this.change("enabled", this.enabled, this.#enabled=v);
        if (this.disabled) this.elem.classList.add("disabled");
        else this.elem.classList.remove("disabled");
        this.eInput.disabled = this.disabled;
        this.#check();
    }
    get disabled() { return !this.enabled; }
    set disabled(v) { this.enabled = !v; }
    get visible() { return this.#visible; }
    set visible(v) {
        v = !!v;
        if (this.visible == v) return;
        this.change("visible", this.visible, this.#visible=v);
        this.#check();
    }
    get hidden() { return !this.visible; }
    set hidden(v) { this.visible = !v; }
    get checked() { return this.#checked; }
    set checked(v) {
        v = !!v;
        if (this.checked == v) return;
        this.change("checked", this.checked, this.#checked=v);
        this.#check();
    }
    get unchecked() { return !this.unchecked; }
    set unchecked(v) { this.unchecked = !v; }
    get exists() { return this.#exists; }
    set exists(v) {
        v = !!v;
        if (this.exists == v) return;
        this.change("exists", this.exists, this.#exists=v);
        this.#check();
    }

    #check() {
        if (this.visible && !this.hasRole()) this.elem.style.display = "";
        else this.elem.style.display = "none";
        if (this.type == "checkbox") this.icon = this.checked ? "checkmark" : "";
        else if (this.type == "radio") this.icon = this.checked ? "ellipse" : "ellipse-outline";
        this.post("format");
    }
    
    get menu() { return this.#menu; }
    set menu(v) {
        if (v instanceof App.Menu) this.menu.items = v.items;
        else if (util.is(v, "arr")) this.menu.items = v;
        else this.menu.items = [];
    }

    findItemWithId(id) {
        if (this.id == id) return this;
        return this.menu.findItemWithId(id);
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eLabel() { return this.#eLabel; }
    get eAccelerator() { return this.#eAccelerator; }
    get eSubIcon() { return this.#eSubIcon; }
    get eInput() { return this.#eInput; }

    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) { this.eIcon.setAttribute("src", v); }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }

    fix() { return this.menu.fix(); }
    format() { return this.menu.format(); }

    toObj() {
        let data = { id: this.id };
        if (this.hasRole()) data.role = this.role;
        if (this.hasType()) data.type = this.type;
        if (this.hasLabel()) data.label = this.label;
        if (this.hasAccelerator()) data.accelerator = this.accelerator;
        data.enabled = this.enabled;
        data.visible = this.visible;
        data.checked = this.checked;
        let submenu = this.menu.toObj();
        if (submenu.length > 0) data.submenu = submenu;
        return data;
    }
    static fromObj(data) {
        if (data == "separator") return this.fromObj({ type: "separator" });
        data = util.ensure(data, "obj");
        let itm = new App.Menu.Item();
        if ("id" in data) itm.id = data.id;
        itm.role = ("role" in data) ? data.role : null;
        itm.type = ("type" in data) ? data.type : null;
        itm.label = ("label" in data) ? data.label : null;
        itm.accelerator = ("accelerator" in data) ? data.accelerator : null;
        itm.enabled = ("enabled" in data) ? data.enabled : true;
        itm.visible = ("visible" in data) ? data.visible : true;
        itm.checked = ("checked" in data) ? data.checked : false;
        if (util.is(data.click, "func"))
            itm.addHandler("trigger", e => data.click(e));
        itm.menu = App.Menu.fromObj(data.submenu);
        return itm;
    }
};
App.Menu.Divider = class AppMenuDivider extends App.Menu.Item {
    constructor() {
        super();

        this.type = "separator";
    }
};
App.Page = class AppPage extends util.Target {
    #name;
    #app;
    #elem;

    constructor(name, app) {
        super();

        this.#name = String(name);

        if (!(app instanceof App)) throw new Error("App is not of class App");
        this.#app = app;

        this.#elem = document.createElement("div");
        this.elem.id = this.name+"PAGE";
        this.elem.classList.add("page");
    }

    get name() { return this.#name; }
    get app() { return this.#app; }
    get elem() { return this.#elem; }

    get state() { return {}; }
    async loadState(state) {}
    get persistentState() { return {}; }
    async loadPersistentState(state) {}

    async enter(data) { return await this.postResult("enter", data); }
    async leave(data) { return await this.postResult("leave", data); }
    async determineSame(data) { return false; }

    update(delta) { this.post("update", delta); }
};
export class AppModal extends App {
    #result;

    #iinfos;

    #resolver;

    #eModalStyle;

    #ielem;
    #iinner;
    #ieIconBox;
    #ieIcon;
    #ieSubIcon;
    #ieTitle;
    #ieContent;

    static CLEANUPPROMPT = false;

    constructor() {
        super();

        this.#result = null;

        let finished = false, modifyQueue = [];
        const checkModify = () => {
            if (!finished) return;
            while (modifyQueue.length > 0) {
                let params = modifyQueue.shift();
                for (let param in params)
                    this["i"+param] = params[param];
            }
            this.resize();
            this.post("modify");
        };

        this.#resolver = new util.Resolver(false);
        window.modal.onModify((_, params) => {
            params = util.ensure(params, "obj");
            modifyQueue.push(params);
            checkModify();
        });
        (async () => {
            await window.modal.result(await this.whenResult());
            await window.api.send("close");
        })();

        this.addHandler("setup", async () => {
            this.menu.findItemWithId("reload").disabled = true;
            this.menu.findItemWithId("spawn").disabled = true;

            this.#eModalStyle = document.createElement("link");
            document.head.appendChild(this.eModalStyle);
            this.eModalStyle.rel = "stylesheet";
            this.eModalStyle.href = "./style-modal.css";

            document.body.innerHTML = `
<div id="mount">
    <div id="PAGE" class="page this popup core override in">
        <div class="inner">
            <div class="icon">
                <ion-icon></ion-icon>
                <ion-icon></ion-icon>
            </div>
            <div class="title"></div>
            <div class="content"></div>
        </div>
    </div>
</div>
            `;
            this.#ielem = document.querySelector(".popup.core");
            this.#iinner = document.querySelector(".popup.core > .inner");
            this.#ieIconBox = document.querySelector(".popup.core > .inner > .icon");
            this.#ieIcon = document.querySelector(".popup.core > .inner > .icon > ion-icon:first-child");
            this.#ieSubIcon = document.querySelector(".popup.core > .inner > .icon > ion-icon:last-child");
            this.#ieTitle = document.querySelector(".popup.core > .inner > .title");
            this.#ieContent = document.querySelector(".popup.core > .inner > .content");

            this.ititle = "";
            this.icontent = "";
            this.iicon = "";
            this.iinfos = [];

            await this.postResult("pre-post-setup");

            await this.resize();

            finished = true;
            checkModify();
        });

        this.addHandler("perm", async () => this.hasResult);
    }

    async resize() {
        await util.wait(50);
        let r = this.iinner.getBoundingClientRect();
        await window.api.set("size", [r.width, r.height]);
    }

    get hasResult() { return this.#resolver.state; }
    get theResult() { return this.#result; }
    async whenResult() {
        if (this.hasResult) return this.theResult;
        await this.#resolver.whenTrue();
        return this.theResult;
    }

    async result(r) {
        this.#resolver.state = true;
        this.#result = r;
    }

    get eModalStyle() { return this.#eModalStyle; }

    get ielem() { return this.#ielem; }
    get iinner() { return this.#iinner; }
    get ieIconBox() { return this.#ieIconBox; }
    get ieIcon() { return this.#ieIcon; }
    get ieSubIcon() { return this.#ieSubIcon; }
    get ieTitle() { return this.#ieTitle; }
    get ieContent() { return this.#ieContent; }

    get iicon() { return this.ieIcon.name; }
    set iicon(v) {
        this.ieIcon.removeAttribute("src");
        if (this.iicon == v) return;
        this.ieIcon.name = v;
    }
    get iiconSrc() { return this.ieIcon.getAttribute("src"); }
    set iiconSrc(v) { this.ieIcon.setAttribute("src", v); }
    get iiconColor() { return this.ieIcon.style.color; }
    set iiconColor(v) { this.ieIcon.style.color = v; }

    get isubIcon() { return this.ieSubIcon.name; }
    set isubIcon(v) {
        this.ieSubIcon.removeAttribute("src");
        if (this.isubIcon == v) return;
        this.ieSubIcon.name = v;
    }
    get isubIconSrc() { return this.ieSubIcon.getAttribute("src"); }
    set isubIconSrc(v) { this.ieSubIcon.setAttribute("src", v); }
    get isubIconColor() { return this.ieSubIcon.style.color; }
    set isubIconColor(v) { this.ieSubIcon.style.color = v; }
    
    get ititle() { return this.ieTitle.textContent; }
    set ititle(v) { this.ieTitle.textContent = v; }

    get icontent() { return this.eContent.textContent; }
    set icontent(v) { this.ieContent.textContent = v; }

    get iinfos() { return [...this.#iinfos]; }
    set iinfos(v) {
        this.#iinfos = util.ensure(v, "arr").map(v => String(v));
        Array.from(this.iinner.querySelectorAll(":scope > .info")).forEach(elem => elem.remove());
        let sibling = this.ieContent.nextElementSibling;
        this.iinfos.forEach(info => {
            let elem = document.createElement("div");
            this.iinner.insertBefore(elem, sibling);
            elem.classList.add("info");
            elem.innerHTML = String(info).replaceAll("<", "&lt").replaceAll(">", "&gt");
            let btn = document.createElement("button");
            elem.appendChild(btn);
            btn.innerHTML = "<ion-icon name='copy-outline'></ion-icon>";
            btn.addEventListener("click", e => {
                e.stopPropagation();
                navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([info], { type: "text/plain" })})]);
            });
        });
    }
}
export class Project extends util.Target {
    #id;

    #config;
    #meta;

    constructor(...a) {
        super();

        this.#id = null;

        this.#config = null;
        this.#meta = null;

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project) a = [a.id, a.config, a.meta];
            else if (util.is(a, "arr")) {
                a = new Project(...a);
                a = [a.id, a.config, a.meta];
            }
            else if (a instanceof this.constructor.Config) a = [a, null];
            else if (a instanceof this.constructor.Meta) a = [null, a];
            else if (util.is(a, "str")) a = [null, a];
            else if (util.is(a, "obj")) a = [a.id, a.config, a.meta];
            else a = [null, null];
        }
        if (a.length == 2)
            a = [null, ...a];

        [this.id, this.config, this.meta] = a;
    }

    get id() { return this.#id; }
    set id(v) { this.#id = (v == null) ? null : String(v); }

    get config() { return this.#config; }
    set config(v) {
        v = new this.constructor.Config(v);
        if (this.config == v) return;
        if (this.config instanceof this.constructor.Config)
            this.config.clearLinkedHandlers(this, "change");
        this.change("config", this.config, this.#config=v);
        if (this.config instanceof this.constructor.Config)
            this.config.addLinkedHandler(this, "change", (c, f, t) => this.change("config."+c, f, t));
    }

    get meta() { return this.#meta; }
    set meta(v) {
        v = new this.constructor.Meta(v);
        if (this.meta == v) return;
        if (this.meta instanceof this.constructor.Meta) {
            this.meta.clearLinkedHandlers(this, "change");
            this.meta.clearLinkedHandlers(this, "thumb");
        }
        this.change("meta", this.meta, this.#meta=v);
        if (this.meta instanceof this.constructor.Meta) {
            this.meta.addLinkedHandler(this, "change", (c, f, t) => this.change("meta."+c, f, t));
            this.meta.addLinkedHandler(this, "thumb", () => this.post("thumb"));
        }
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            id: this.id,
            config: this.config, meta: this.meta,
        });
    }
}
Project.Config = class ProjectConfig extends util.Target {
    constructor() {
        super();
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {});
    }
};
Project.Meta = class ProjectMeta extends util.Target {
    #name;
    #modified;
    #created;
    #thumb;

    constructor(...a) {
        super();

        this.#name = "New Project";
        this.#modified = 0;
        this.#created = 0;
        this.#thumb = null;

        if (a.length <= 0 || [3].includes(a.length) || a.length > 4) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Meta) a = [a.name, a.modified, a.created, a.thumb];
            else if (util.is(a, "arr")) {
                a = new Project.Meta(...a);
                a = [a.name, a.modified, a.created, a.thumb];
            }
            else if (util.is(a, "str")) a = [a, null];
            else if (util.is(a, "obj")) a = [a.name, a.modified, a.created, a.thumb];
            else a = ["New Project", null];
        }
        if (a.length == 2) a = [a[0], 0, 0, a[1]];
        
        [this.name, this.modified, this.created, this.thumb] = a;
    }

    get name() { return this.#name; }
    set name(v) {
        v = (v == null) ? "New Project" : String(v);
        if (this.name == v) return;
        this.change("name", this.name, this.#name=v);
    }
    get modified() { return this.#modified; }
    set modified(v) {
        v = util.ensure(v, "num");
        if (this.modified == v) return;
        this.#modified = v;
    }
    get created() { return this.#created; }
    set created(v) {
        v = util.ensure(v, "num");
        if (this.created == v) return;
        this.change("created", this.created, this.#created=v);
    }
    get thumb() { return this.#thumb; }
    set thumb(v) {
        v = (v == null) ? null : String(v);
        if (this.thumb == v) return;
        this.#thumb = v;
        this.post("thumb");
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            name: this.name,
            modified: this.modified, created: this.created,
            thumb: this.thumb,
        });
    }
};
export class AppFeature extends App {
    #changes;
    
    #projects;

    #titlePage;
    #projectsPage;
    #projectPage;

    #eFeatureStyle;
    #eTitleBtn;
    #eProjectsBtn;
    #eCreateBtn;
    #eFileBtn;
    #eEditBtn;
    #eViewBtn;
    #eProjectInfo;
    #eProjectInfoBtn;
    #eProjectInfoBtnIcon;
    #eProjectInfoBtnName;
    #eProjectInfoContent;
    #eProjectInfoNameInput;
    #eProjectInfoSaveBtn;
    #eProjectInfoCopyBtn;
    #eProjectInfoDeleteBtn;
    #eSaveBtn;

    static ICON = "help-circle";
    static PROJECTCLASS = Project;
    static REVIVER = util.REVIVER;

    constructor() {
        super();

        this.#changes = new Set();

        this.#projects = {};

        this.addHandler("setup", async () => {
            this.#eFeatureStyle = document.createElement("link");
            document.head.appendChild(this.eFeatureStyle);
            this.eFeatureStyle.rel = "stylesheet";
            this.eFeatureStyle.href = "../style-feature.css";

            const checkMinWidth = async () => {
                let left = PROPERTYCACHE.get("--LEFT");
                left = util.ensure(parseFloat(left.slice(0, left.length-2)), "num");
                let right = PROPERTYCACHE.get("--RIGHT");
                right = util.ensure(parseFloat(right.slice(0, right.length-2)), "num");
                let w = left+right;
                Array.from(this.eTitleBar.querySelectorAll(":scope > *:not(.space)")).forEach(elem => (w += elem.getBoundingClientRect().width));
                await window.api.set("min-width", w);
            };

            this.#eTitleBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eTitleBtn);
            this.eTitleBtn.id = "titlebtn";
            this.eTitleBtn.classList.add("logo");
            this.eTitleBtn.classList.add("override");
            this.eTitleBtn.innerHTML = "<div class='title introtitle noanimation'></div>";
            this.eTitleBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.page = "TITLE";
            });
            this.eTitleBtn.addEventListener("contextmenu", e => {
                this.contextMenu = this.bindMenu(App.Menu.buildMainMenu());
                this.placeContextMenu(e.pageX, e.pageY);
            });
            new ResizeObserver(checkMinWidth).observe(this.eTitleBtn);

            this.#eFileBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eFileBtn);
            this.eFileBtn.classList.add("nav");
            this.eFileBtn.classList.add("forproject");
            this.eFileBtn.textContent = "File";
            this.eFileBtn.addEventListener("click", e => {
                e.stopPropagation();
                let itm = this.menu.findItemWithId("menu:file");
                if (!itm) return;
                this.contextMenu = itm.menu;
                let r = this.eFileBtn.getBoundingClientRect();
                this.placeContextMenu(r.left, r.bottom);
            });
            new ResizeObserver(checkMinWidth).observe(this.eFileBtn);

            this.#eEditBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eEditBtn);
            this.eEditBtn.classList.add("nav");
            this.eEditBtn.classList.add("forproject");
            this.eEditBtn.textContent = "Edit";
            this.eEditBtn.addEventListener("click", e => {
                e.stopPropagation();
                let itm = this.menu.findItemWithId("menu:edit");
                if (!itm) return;
                this.contextMenu = itm.menu;
                let r = this.eEditBtn.getBoundingClientRect();
                this.placeContextMenu(r.left, r.bottom);
            });
            new ResizeObserver(checkMinWidth).observe(this.eEditBtn);

            this.#eViewBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eViewBtn);
            this.eViewBtn.classList.add("nav");
            this.eViewBtn.classList.add("forproject");
            this.eViewBtn.textContent = "View";
            this.eViewBtn.addEventListener("click", e => {
                e.stopPropagation();
                let itm = this.menu.findItemWithId("menu:view");
                if (!itm) return;
                this.contextMenu = itm.menu;
                let r = this.eViewBtn.getBoundingClientRect();
                this.placeContextMenu(r.left, r.bottom);
            });
            new ResizeObserver(checkMinWidth).observe(this.eViewBtn);

            this.#eProjectInfo = document.createElement("div");
            this.eTitleBar.appendChild(this.eProjectInfo);
            this.eProjectInfo.id = "projectinfo";
            this.eProjectInfo.classList.add("forproject");
            new ResizeObserver(checkMinWidth).observe(this.eProjectInfo);

            this.#eProjectInfoBtn = document.createElement("button");
            this.eProjectInfo.appendChild(this.eProjectInfoBtn);
            this.eProjectInfoBtn.classList.add("display");
            this.eProjectInfoBtn.innerHTML = "<ion-icon name='chevron-down'></ion-icon>";
            this.eProjectInfoBtn.addEventListener("click", e => {
                if (this.eProjectInfo.classList.contains("this")) this.eProjectInfo.classList.remove("this");
                else {
                    this.eProjectInfo.classList.add("this");
                    const click = e => {
                        if (this.eProjectInfo.contains(e.target)) return;
                        e.stopPropagation();
                        document.body.removeEventListener("click", click, { capture: true });
                        this.eProjectInfo.classList.remove("this");
                    };
                    document.body.addEventListener("click", click, { capture: true });
                }
            });

            this.#eProjectInfoBtnIcon = document.createElement("ion-icon");
            this.eProjectInfoBtn.insertBefore(this.eProjectInfoBtnIcon, Array.from(this.eProjectInfoBtn.children).at(-1));
            this.eProjectInfoBtnIcon.name = this.constructor.ICON;

            this.#eProjectInfoBtnName = document.createElement("div");
            this.eProjectInfoBtn.insertBefore(this.eProjectInfoBtnName, Array.from(this.eProjectInfoBtn.children).at(-1));
            this.eProjectInfoBtnName.classList.add("value");

            this.#eProjectInfoContent = document.createElement("div");
            this.eProjectInfo.appendChild(this.eProjectInfoContent);
            this.eProjectInfoContent.classList.add("content");

            let header = document.createElement("div");
            this.eProjectInfoContent.append(header);
            header.textContent = "Name";

            this.#eProjectInfoNameInput = document.createElement("input");
            this.eProjectInfoContent.appendChild(this.eProjectInfoNameInput);
            this.eProjectInfoNameInput.type = "text";
            this.eProjectInfoNameInput.placeholder = "Name your project...";
            this.eProjectInfoNameInput.autocomplete = "off";
            this.eProjectInfoNameInput.spellcheck = false;

            let divider = document.createElement("div");
            this.eProjectInfoContent.appendChild(divider);
            divider.classList.add("divider");

            let eNav = document.createElement("div");
            this.eProjectInfoContent.appendChild(eNav);
            eNav.classList.add("nav");

            this.#eProjectInfoSaveBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoSaveBtn);
            this.eProjectInfoSaveBtn.textContent = "Save";
            this.eProjectInfoSaveBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("cmd-save");
            });

            this.#eProjectInfoCopyBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoCopyBtn);
            this.eProjectInfoCopyBtn.textContent = "Copy";
            this.eProjectInfoCopyBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("cmd-savecopy");
            });

            this.#eProjectInfoDeleteBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoDeleteBtn);
            this.eProjectInfoDeleteBtn.classList.add("off");
            this.eProjectInfoDeleteBtn.textContent = "Delete";
            this.eProjectInfoDeleteBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("cmd-delete");
            });

            let space = document.createElement("div");
            this.eTitleBar.appendChild(space);
            space.classList.add("space");

            this.#eSaveBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eSaveBtn);
            this.eSaveBtn.id = "save";
            this.eSaveBtn.classList.add("forproject");
            this.eSaveBtn.addEventListener("click", async e => {
                e.stopPropagation();
                this.post("cmd-save");
            });
            new ResizeObserver(checkMinWidth).observe(this.eSaveBtn);

            this.#eProjectsBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eProjectsBtn);
            this.eProjectsBtn.classList.add("nav");
            this.eProjectsBtn.innerHTML = "<ion-icon name='folder'></ion-icon>";
            this.eProjectsBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.page = "PROJECTS";
            });
            new ResizeObserver(checkMinWidth).observe(this.eProjectsBtn);

            this.#eCreateBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eCreateBtn);
            this.eCreateBtn.classList.add("nav");
            this.eCreateBtn.innerHTML = "<ion-icon name='add'></ion-icon>";
            this.eCreateBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.page = "PROJECT";
            });
            new ResizeObserver(checkMinWidth).observe(this.eCreateBtn);
            
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");

            const updateSave = () => {
                this.eSaveBtn.textContent = saving ? "Saving" : (this.changes.length > 0) ? "Save" : "Saved";
            };
            let saving = false;
            this.addHandler("save-projects", () => {
                saving = true;
                updateSave();
            });
            this.addHandler("saved-projects", () => {
                saving = false;
                updateSave();
            });
            this.addHandler("change-markChange", updateSave);

            this.clearChanges();

            this.addHandler("cmd-newproject", async () => {
                this.page = "PROJECT";
            });
            this.addHandler("cmd-save", async () => {
                await this.saveProjectsClean();
            });
            this.addHandler("cmd-savecopy", async source => {
                const page = this.projectPage;
                for (let perm in await this.postResult("cmd-savecopy-block")) {
                    if (perm) continue;
                    return;
                }
                if (!((source instanceof Project) && (source instanceof this.constructor.PROJECTCLASS))) source = page.project;
                if (!((source instanceof Project) && (source instanceof this.constructor.PROJECTCLASS))) return;
                let project = new this.constructor.PROJECTCLASS(source);
                if (!(project instanceof Project)) return;
                project.id = null;
                project.meta.name += " copy";
                await this.setPage("PROJECT", { project: project });
                await this.postResult("cmd-save");
            });
            this.addHandler("cmd-delete", async ids => {
                ids = util.ensure(ids, "arr").map(id => String(id));
                const page = this.projectPage;
                for (let perm of await this.postResult("cmd-delete-block")) {
                    if (perm) continue;
                    return;
                }
                ids = ids.filter(id => this.hasProject(id));
                if (ids.length <= 0) ids.push(page.projectId);
                ids = ids.filter(id => this.hasProject(id));
                if (ids.length <= 0) return;
                let pop = this.confirm("Delete Projects", "Are you sure you want to delete these projects?\nThis action is not reversible!");
                pop.infos = [ids.map(id => this.getProject(id).meta.name).join("\n")];
                let result = await pop.whenResult();
                if (!result) return;
                ids.forEach(id => this.remProject(id));
                await this.postResult("cmd-save");
                this.page = "PROJECTS";
            });
            this.addHandler("cmd-closeproject", () => {
                if (this.page != "PROJECT") return;
                this.page = "PROJECTS";
            });

            await this.loadProjects();
        });
        this.addHandler("post-setup", async () => {
            ["file", "edit", "view"].forEach(name => {
                let id = "menu:"+name;
                let menu = this.menu.findItemWithId(id);
                let namefs = {
                    file: () => {
                        let itms = [
                            { id: "newproject", label: "New Project", accelerator: "CmdOrCtrl+N" },
                            "separator",
                            { id: "save", label: "Save", accelerator: "CmdOrCtrl+S" },
                            { id: "savecopy", label: "Save as copy", accelerator: "CmdOrCtrl+Shift+S" },
                            "separator",
                            { id: "export", label: "Export Project...", visible: false },
                            { id: "import", label: "Import Project...", visible: false },
                            { type: "separator", visible: false },
                            { id: "delete", label: "Delete Project" },
                            { id: "closeproject", label: "Close Project", accelerator: "CmdOrCtrl+W" },
                        ];
                        itms.forEach((data, i) => {
                            let itm = App.Menu.Item.fromObj(data);
                            if (util.is(data, "obj")) {
                                if (!("click" in data)) data.click = () => this.post("cmd-"+data.id);
                                itm.addHandler("trigger", e => data.click());
                            }
                            menu.menu.insertItem(itm, 3+i);
                        });
                    },
                };
                if (name in namefs) namefs[name]();
            });
            let itm = this.menu.findItemWithId("close");
            if (itm) itm.accelerator = "CmdOrCtrl+Shift+W";

            await this.postResult("pre-post-setup");

            [this.#titlePage, this.#projectsPage, this.#projectPage] = this.addPage(
                new this.constructor.TitlePage(this),
                new this.constructor.ProjectsPage(this),
                new this.constructor.ProjectPage(this),
            );

            this.page = "TITLE";
        });

        this.addHandler("change", () => {
            let names = new Set();
            this.projects.forEach(id => {
                let project = this.getProject(id);
                if (project.meta.name.length <= 0) project.meta.name = "New Project";
                if (names.has(project.meta.name)) {
                    let n = 1;
                    while (names.has(project.meta.name+" ("+n+")")) n++;
                    project.meta.name += " ("+n+")";
                }
                names.add(project.meta.name);
            });
        });
    }

    get changes() { return [...this.#changes]; }
    markChange(change) {
        change = String(change);
        if (this.hasChange(change)) return true;
        this.#changes.add(change);
        this.change("markChange", null, change);
        return true;
    }
    hasChange(change) {
        change = String(change);
        return this.#changes.has(change);
    }
    clearChanges() {
        let changes = this.changes;
        this.#changes.clear();
        this.change("clearChanges", changes, []);
        return changes;
    }
    async loadProjects() {
        await this.postResult("load-projects");
        let projectIds = util.ensure(await window.api.send("projects-get"), "arr").map(id => String(id));
        let projects = [];
        await Promise.all(projectIds.map(async id => {
            let projectContent = await window.api.send("project-get", id);
            let project = JSON.parse(projectContent, this.constructor.REVIVER.f);
            projects.push(project);
        }));
        this.projects = projects;
        this.clearChanges();
        await this.postResult("loaded-projects");
    }
    async loadProjectsClean() {
        try {
            await this.loadProjects();
        } catch (e) {
            await this.doError("Projects Load Error", "", e);
            return false;
        }
        return true;
    }
    async saveProjects() {
        await this.postResult("save-projects");
        let changes = new Set(this.changes);
        this.clearChanges();
        let oldIds = util.ensure(await window.api.send("projects-get"), "arr").map(id => String(id));
        let newIds = this.projects;
        await Promise.all(oldIds.map(async id => {
            if (newIds.includes(id)) return;
            await window.api.send("project-del", id);
        }));
        await Promise.all(newIds.map(async id => {
            if (!(changes.has("*") || changes.has(":"+id))) return;
            let project = this.getProject(id);
            if (!changes.has("*")) project.meta.modified = util.getTime();
            let projectContent = JSON.stringify(project);
            await window.api.send("project-set", id, projectContent);
        }));
        await this.postResult("saved-projects");
    }
    async saveProjectsClean() {
        try {
            await this.saveProjects();
        } catch (e) {
            await this.doError("Projects Save Error", "", e);
            return false;
        }
        return true;
    }
    get projects() { return Object.keys(this.#projects); }
    get projectObjects() { return Object.values(this.#projects); }
    set projects(v) {
        v = util.ensure(v, "arr");
        this.clearProjects();
        this.addProject(v);
    }
    clearProjects() {
        let projs = this.projects;
        this.remProject(projs);
        return projs;
    }
    hasProject(id) {
        if ((id instanceof Project) && (id instanceof this.constructor.PROJECTCLASS)) return this.hasProject(id.id);
        return id in this.#projects;
    }
    getProject(id) {
        if (!this.hasProject(id)) return null;
        return this.#projects[id];
    }
    addProject(...projs) {
        return util.Target.resultingForEach(projs, proj => {
            if (!((proj instanceof Project) && (proj instanceof this.constructor.PROJECTCLASS))) return false;
            if (this.hasProject(proj)) return false;
            let id = proj.id;
            while (id == null || this.hasProject(id))
                id = util.jargonBase64(10);
            this.#projects[id] = proj;
            proj.id = id;
            proj.addLinkedHandler(this, "change", c => this.markChange(":"+id));
            this.markChange(":"+id);
            proj.onAdd();
            this.change("addProject", null, proj);
            return proj;
        });
    }
    remProject(...ids) {
        return util.Target.resultingForEach(ids, id => {
            if ((id instanceof Project) && (id instanceof this.constructor.PROJECTCLASS)) id = id.id;
            id = String(id);
            if (!this.hasProject(id)) return false;
            let proj = this.getProject(id);
            proj.onRem();
            delete this.#projects[id];
            proj.clearLinkedHandlers(this, "change");
            proj.id = null;
            this.markChange(":"+id);
            this.change("remProject", proj, null);
            return proj;
        });
    }

    get titlePage() { return this.#titlePage; }
    get projectsPage() { return this.#projectsPage; }
    get projectPage() { return this.#projectPage; }

    get eFeatureStyle() { return this.#eFeatureStyle; }
    get eTitleBtn() { return this.#eTitleBtn; }
    get eProjectsBtn() { return this.#eProjectsBtn; }
    get eCreateBtn() { return this.#eCreateBtn; }
    get eFileBtn() { return this.#eFileBtn; }
    get eEditBtn() { return this.#eEditBtn; }
    get eViewBtn() { return this.#eViewBtn; }
    get eProjectInfo() { return this.#eProjectInfo; }
    get eProjectInfoBtn() { return this.#eProjectInfoBtn; }
    get eProjectInfoBtnIcon() { return this.#eProjectInfoBtnIcon; }
    get eProjectInfoBtnName() { return this.#eProjectInfoBtnName; }
    get eProjectInfoContent() { return this.#eProjectInfoContent; }
    get eProjectInfoNameInput() { return this.#eProjectInfoNameInput; }
    get eProjectInfoSaveBtn() { return this.#eProjectInfoSaveBtn; }
    get eProjectInfoCopyBtn() { return this.#eProjectInfoCopyBtn; }
    get eProjectInfoDeleteBtn() { return this.#eProjectInfoDeleteBtn; }
    get eSaveBtn() { return this.#eSaveBtn; }
}
AppFeature.TitlePage = class AppFeatureTitlePage extends App.Page {
    #eTitle;
    #eSubtitle;
    #eNav;
    #eCreateBtn;
    #eProjectsBtn;

    static DESCRIPTION = "";

    constructor(app) {
        super("TITLE", app);

        this.#eTitle = document.createElement("div");
        this.elem.appendChild(this.eTitle);
        this.eTitle.classList.add("title");
        this.#eSubtitle = document.createElement("div");
        this.elem.appendChild(this.eSubtitle);
        this.eSubtitle.classList.add("subtitle");
        this.eSubtitle.textContent = this.constructor.DESCRIPTION;
        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");

        this.#eCreateBtn = document.createElement("button");
        this.eNav.appendChild(this.eCreateBtn);
        this.eCreateBtn.classList.add("special");
        this.eCreateBtn.innerHTML = "Create<ion-icon name='add'></ion-icon>";
        this.eCreateBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.app.page = "PROJECT";
        });
        this.#eProjectsBtn = document.createElement("button");
        this.eNav.appendChild(this.eProjectsBtn);
        this.eProjectsBtn.classList.add("normal");
        this.eProjectsBtn.innerHTML = "Projects<ion-icon name='chevron-forward'></ion-icon>";
        this.eProjectsBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.app.page = "PROJECTS";
        });

        this.addHandler("enter", async data => {
            this.app.title = "";
        });

        (async () => {
            const name = util.formatText(String(await window.api.get("name")));
            this.eTitle.innerHTML = "<span>Peninsula</span><span></span>";
            this.eTitle.children[1].textContent = name;
        })();
    }

    get eTitle() { return this.#eTitle; }
    get eSubtitle() { return this.#eSubtitle; }
    get eNav() { return this.#eNav; }
    get eCreateBtn() { return this.#eCreateBtn; }
    get eProjectsBtn() { return this.#eProjectsBtn; }
};
AppFeature.ProjectsPage = class AppFeatureProjectsPage extends App.Page {
    #buttons;

    #eTitle;
    #eNav;
    #eSubNav;
    #eCreateBtn;
    #eInfo;
    #eInfoDisplayBtn;
    #eSearchBox;
    #eSearchInput;
    #eSearchBtn;
    #eContent;
    #eLoading;
    #eEmpty;

    constructor(app) {
        super("PROJECTS", app);

        this.#buttons = new Set();

        this.#eTitle = document.createElement("div");
        this.elem.appendChild(this.eTitle);
        this.eTitle.classList.add("title");
        this.eTitle.textContent = "Projects";
        this.#eNav = document.createElement("div");
        this.elem.append(this.eNav);
        this.eNav.classList.add("nav");
        this.#eSubNav = document.createElement("div");
        this.eNav.append(this.eSubNav);
        this.eSubNav.classList.add("nav");
        this.#eCreateBtn = document.createElement("button");
        this.eSubNav.appendChild(this.eCreateBtn);
        this.eCreateBtn.classList.add("special");
        this.eCreateBtn.innerHTML = "Create<ion-icon name='add'></ion-icon>";
        this.eCreateBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.app.page = "PROJECT";
        });
        this.#eInfo = document.createElement("div");
        this.eNav.appendChild(this.eInfo);
        this.eInfo.classList.add("info");
        this.#eInfoDisplayBtn = document.createElement("button");
        this.eInfo.appendChild(this.eInfoDisplayBtn);
        this.eInfoDisplayBtn.innerHTML = "<ion-icon></ion-icon>";
        this.eInfoDisplayBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (this.displayMode == "list") return this.displayMode = "grid";
            if (this.displayMode == "grid") return this.displayMode = "list";
        });
        this.#eSearchBox = document.createElement("div");
        this.eNav.appendChild(this.eSearchBox);
        this.eSearchBox.classList.add("search");
        this.#eSearchInput = document.createElement("input");
        this.eSearchBox.appendChild(this.eSearchInput);
        this.eSearchInput.type = "text";
        this.eSearchInput.placeholder = "Search...";
        this.eSearchInput.autocomplete = "off";
        this.eSearchInput.spellcheck = false;
        this.eSearchInput.addEventListener("input", e => {
            this.refresh();
        });
        this.#eSearchBtn = document.createElement("button");
        this.eSearchBox.appendChild(this.eSearchBtn);
        this.eSearchBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.eSearchBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.eSearchInput.value = "";
            this.refresh();
        });
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.eContent.classList.add("list");
        this.#eLoading = document.createElement("div");
        this.eContent.appendChild(this.eLoading);
        this.#eEmpty = document.createElement("div");
        this.eContent.appendChild(this.eEmpty);
        this.eEmpty.classList.add("empty");
        this.eEmpty.textContent = "No projects here yet!";
        this.app.addHandler("saved-projects", () => this.refresh());
        this.app.addHandler("loaded-projects", () => this.refresh());

        this.eContent.addEventListener("click", e => {
            e.stopPropagation();
            selected.clear();
            lastSelected = null;
            lastAction = null;
        });
        const contextMenu = e => {
            let ids = [...selected];
            let itm;
            let menu = new App.Menu();
            itm = menu.addItem(new App.Menu.Item("Create"));
            itm.addHandler("trigger", e => {
                this.app.post("cmd-newproject");
            });
            menu.addItem(new App.Menu.Divider());
            itm = menu.addItem(new App.Menu.Item("Open"));
            itm.disabled = ids.length != 1;
            itm.addHandler("trigger", e => {
                this.app.setPage("PROJECT", { id: ids[0] });
            });
            itm = menu.addItem(new App.Menu.Item("Rename"));
            itm.disabled = ids.length != 1;
            itm.addHandler("trigger", async e => {
                let project = this.app.getProject(ids[0]);
                if (!(project instanceof this.app.constructor.PROJECTCLASS)) return;
                let result = await this.app.doPrompt("Rename", "", project.meta.name);
                if (result == null) return;
                project.meta.name = result;
                await this.app.saveProjectsClean();
            });
            menu.addItem(new App.Menu.Divider());
            itm = menu.addItem(new App.Menu.Item("Delete"));
            itm.disabled = ids.length <= 0;
            itm.addHandler("trigger", e => {
                this.app.post("cmd-delete", ids);
            });
            itm = menu.addItem(new App.Menu.Item("Duplicate"));
            itm.disabled = ids.length <= 0;
            itm.addHandler("trigger", async e => {
                for (let i = 0; i < ids.length; i++)
                    await this.app.post("cmd-savecopy", this.app.getProject(ids[i]));
            });
            this.app.contextMenu = menu;
            e = util.ensure(e, "obj");
            this.app.placeContextMenu(e.pageX, e.pageY);
        };
        this.eContent.addEventListener("contextmenu", contextMenu);
        
        let selected = new Set(), lastSelected = null, lastAction = null;
        const updateSelected = () => {
            [...selected].forEach(id => {
                if (this.app.hasProject(id)) return;
                selected.delete(id);
            });
            this.buttons.forEach(btn => {
                btn.selected = btn.hasProject() && selected.has(btn.project.id);
            });
        };
        this.app.addHandler("change-addProject", updateSelected);
        this.app.addHandler("change-remProject", updateSelected);
        this.addHandler("refresh", updateSelected);
        this.addHandler("trigger", (_, id, shift) => {
            id = (id == null) ? null : String(id);
            shift = !!shift;
            if (!this.app.hasProject(id)) return;
            if (shift && this.app.hasProject(lastSelected)) {
                let ids = this.app.projects.map(id => this.app.getProject(id)).sort((a, b) => b.meta.modified-a.meta.modified).map(project => project.id);
                let i = ids.indexOf(lastSelected);
                let j = ids.indexOf(id);
                for (let k = i;; k += (j>i?+1:j<i?-1:0)) {
                    if (lastAction == -1) selected.delete(ids[k]);
                    if (lastAction == +1) selected.add(ids[k]);
                    if (k == j) break;
                }
            } else {
                lastSelected = id;
                if (selected.has(id)) {
                    selected.delete(id);
                    lastAction = -1;
                } else {
                    selected.add(id);
                    lastAction = +1;
                }
            }
            updateSelected();
        });
        this.addHandler("contextmenu", (e, id) => {
            updateSelected();
            if (selected.size == 1) this.post("trigger", e, [...selected][0]);
            if (selected.size == 0) this.post("trigger", e, id);
            contextMenu(e);
        });

        this.addHandler("enter", async data => {
            this.app.title = "Projects";
            this.app.eProjectsBtn.classList.add("this");
            await this.refresh();
        });
        this.addHandler("leave", async data => {
            this.app.eProjectsBtn.classList.remove("this");
        });

        this.displayMode = "grid";
    }

    async refresh() {
        this.clearButtons();
        this.eLoading.style.display = "block";
        this.eEmpty.style.display = "none";
        this.eLoading.style.display = "none";
        let projects = this.app.projects.map(id => this.app.getProject(id));
        if (projects.length > 0) {
            projects = lib.search(projects, ["meta.name"], this.eSearchInput.value);
            this.addButton(projects.map(itm => {
                let btn = new this.constructor.Button(itm.item);
                itm.matches.forEach(match => btn.select(match.indices));
                return btn;
            }));
        } else this.eEmpty.style.display = "block";
        await this.postResult("refresh");
    }

    get displayMode() {
        if (this.eContent.classList.contains("list")) return "list";
        if (this.eContent.classList.contains("grid")) return "grid";
        return "list";
    }
    set displayMode(v) {
        v = String(v);
        if (!["list", "grid"].includes(v)) v = "list";
        this.eContent.classList.remove("list");
        this.eContent.classList.remove("grid");
        if (v == "list") this.eContent.classList.add("list");
        if (v == "grid") this.eContent.classList.add("grid");
        if (this.eInfoDisplayBtn.children[0])
            this.eInfoDisplayBtn.children[0].name = (v == "list") ? "grid" : (v == "grid") ? "list" : null;
    }

    get buttons() { return [...this.#buttons]; }
    set buttons(v) {
        v = util.ensure(v, "arr");
        this.clearButtons();
        this.addButton(v);
    }
    clearButtons() {
        let btns = this.buttons;
        this.remButton(btns);
        return btns;
    }
    hasButton(btn) {
        if (!(btn instanceof this.constructor.Button)) return false;
        return this.#buttons.has(btn);
    }
    addButton(...btns) {
        let r = util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof this.constructor.Button)) return false;
            if (this.hasButton(btn)) return false;
            this.#buttons.add(btn);
            btn.addLinkedHandler(this, "trigger", e => this.post("trigger", e, (btn.hasProject() ? btn.project.id : null), !!(util.ensure(e, "obj").shiftKey)));
            btn.addLinkedHandler(this, "trigger2", e => this.app.setPage("PROJECT", { id: (btn.hasProject() ? btn.project.id : null) }));
            btn.addLinkedHandler(this, "contextmenu", e => this.post("contextmenu", e, btn.hasProject() ? btn.project.id : null));
            this.eContent.appendChild(btn.elemList);
            this.eContent.appendChild(btn.elemGrid);
            btn.onAdd();
            btn.addLinkedHandler(this, "change", () => this.formatButtons());
            return btn;
        });
        this.formatButtons();
        return r;
    }
    remButton(...btns) {
        let r = util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof this.constructor.Button)) return false;
            if (!this.hasButton(btn)) return false;
            btn.onRem();
            this.#buttons.delete(btn);
            btn.clearLinkedHandlers(this, "trigger");
            btn.clearLinkedHandlers(this, "trigger2");
            btn.clearLinkedHandlers(this, "contextmenu");
            this.eContent.removeChild(btn.elemList);
            this.eContent.removeChild(btn.elemGrid);
            btn.clearLinkedHandlers(this, "change");
            return btn;
        });
        this.formatButtons();
        return r;
    }
    formatButtons() {
        this.buttons.sort((a, b) => b.time-a.time).forEach((btn, i) => {
            btn.elemList.style.order = i;
            btn.elemGrid.style.order = i;
        });
    }

    get eTitle() { return this.#eTitle; }
    get eNav() { return this.#eNav; }
    get eSubNav() { return this.#eSubNav; }
    get eCreateBtn() { return this.#eCreateBtn; }
    get eInfo() { return this.#eInfo; }
    get eInfoDisplayBtn() { return this.#eInfoDisplayBtn; }
    get eSearchBox() { return this.#eSearchBox; }
    get eSearchInput() { return this.#eSearchInput; }
    get eSearchBtn() { return this.#eSearchBtn; }
    get eContent() { return this.#eContent; }
    get eLoading() { return this.#eLoading; }
    get eEmpty() { return this.#eEmpty; }

    get state() {
        return {
            query: this.eSearchInput.value,
        };
    }
    async loadState(state) {
        state = util.ensure(state, "obj");
        this.eSearchInput.value = util.ensure(state.query, "str");
        await this.refresh();
    }
    get persistentState() {
        return {
            displayMode: this.displayMode,
        };
    }
    async loadPersistentState(state) {
        state = util.ensure(state, "obj");
        this.displayMode = state.displayMode;
    }
};
AppFeature.ProjectsPage.Button = class AppFeatureProjectsPageButton extends util.Target {
    #project;

    #time;
    #indices;

    #elemList;
    #eListIcon;
    #eListName;
    #eListTime;
    #eListOptions;
    #elemGrid;
    #eGridIcon;
    #eGridName;
    #eGridOptions;
    #eGridImage;

    constructor(project) {
        super();

        this.#project = null;

        this.#time = null;
        this.#indices = null;

        let eNav;

        this.#elemList = document.createElement("div");
        this.elemList.classList.add("item");
        this.elemList.classList.add("list");
        this.#eListIcon = document.createElement("ion-icon");
        this.elemList.appendChild(this.eListIcon);
        this.#eListName = document.createElement("div");
        this.elemList.appendChild(this.eListName);
        this.eListName.classList.add("name");
        this.#eListTime = document.createElement("div");
        this.elemList.appendChild(this.eListTime);
        this.eListTime.classList.add("time");
        eNav = document.createElement("div");
        this.elemList.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eListOptions = document.createElement("button");
        eNav.appendChild(this.eListOptions);
        this.eListOptions.classList.add("icon");
        this.eListOptions.innerHTML = "<ion-icon name='ellipsis-vertical'></ion-icon>";
        this.#elemGrid = document.createElement("div");
        this.elemGrid.classList.add("item");
        this.elemGrid.classList.add("grid");
        let eTop = document.createElement("div");
        this.elemGrid.appendChild(eTop);
        eTop.classList.add("top");
        this.#eGridIcon = document.createElement("ion-icon");
        eTop.appendChild(this.eGridIcon);
        this.#eGridName = document.createElement("div");
        eTop.appendChild(this.eGridName);
        this.eGridName.classList.add("name");
        eNav = document.createElement("div");
        eTop.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eGridOptions = document.createElement("button");
        eNav.appendChild(this.eGridOptions);
        this.eGridOptions.classList.add("icon");
        this.eGridOptions.innerHTML = "<ion-icon name='ellipsis-vertical'></ion-icon>";
        this.#eGridImage = document.createElement("div");
        this.elemGrid.appendChild(this.eGridImage);
        this.eGridImage.classList.add("image");

        const contextMenu = e => {
            e.stopPropagation();
            this.post("contextmenu", e);
        };
        this.elemList.addEventListener("contextmenu", contextMenu);
        this.elemGrid.addEventListener("contextmenu", contextMenu);
        this.eListOptions.addEventListener("click", contextMenu);
        this.eGridOptions.addEventListener("click", contextMenu);
        const click = e => {
            e.stopPropagation();
            this.post("trigger", e);
        };
        this.elemList.addEventListener("click", click);
        this.elemGrid.addEventListener("click", click);
        const dblClick = e => {
            e.stopPropagation();
            this.post("trigger2", e);
        };
        this.elemList.addEventListener("dblclick", dblClick);
        this.elemGrid.addEventListener("dblclick", dblClick);

        this.project = project;

        this.eListIcon.name = "document-outline";
        this.eGridIcon.name = "document-outline";

        this.addHandler("change-project", (f, t) => {
            const doThumb = () => {
                if (!this.hasProject()) return;
                this.eGridImage.style.backgroundImage = "url('"+this.project.meta.thumb+"')";
            };
            if (f) f.clearLinkedHandlers(this, "thumb");
            if (t) t.addLinkedHandler(this, "thumb", doThumb);
            doThumb();
        });

        this.addHandler("change", () => {
            if (!this.hasProject()) return;
            this.name = this.project.meta.name;
            this.time = this.project.meta.modified;
        });
    }

    get project() { return this.#project; }
    set project(v) {
        v = (v instanceof Project) ? v : null;
        if (this.project == v) return;
        if (this.hasProject()) this.project.clearLinkedHandlers(this, "change");
        this.change("project", this.project, this.#project=v);
        if (this.hasProject()) {
            this.project.addLinkedHandler(this, "change", (c, f, t) => this.change("project."+c, f, t));
            this.name = this.project.meta.name;
            this.time = this.project.meta.modified;
        }
    }
    hasProject() { return !!this.project; }

    get name() { return this.eListName.textContent; }
    set name(v) {
        this.eListName.textContent = this.eGridName.textContent = v;
        v = this.name;
        let indices = this.#indices;
        if (indices == null) return;
        let chunks = [];
        indices.forEach((range, i) => {
            chunks.push(v.substring((i > 0) ? indices[i-1][1] : 0, range[0]));
            chunks.push(v.substring(...range));
        });
        chunks.push(v.substring((indices.length > 0) ? indices.at(-1)[1] : 0, v.length));
        this.eListName.innerHTML = this.eGridName.innerHTML = "";
        chunks.forEach((chunk, i) => {
            let elem1 = document.createElement("span");
            let elem2 = document.createElement("span");
            this.eListName.appendChild(elem1);
            this.eGridName.appendChild(elem2);
            elem1.textContent = elem2.textContent = chunk;
            elem1.style.color = elem2.style.color = (i%2 == 0) ? "var(--v5)" : "";
            elem1.style.fontWeight = elem2.style.fontWeight = (i%2 == 0) ? "" : "bold";
        });
    }
    select(indices) {
        if (indices != null) {
            indices = util.ensure(indices, "arr").map(range => util.ensure(range, "arr").map(v => util.ensure(v, "int")));
            indices = indices.filter(range => range.length == 2).map(range => [range[0], range[1]+1]).sort((a, b) => a[0]-b[0]);
            let indices2 = [];
            indices.forEach(range => {
                if (indices2.length <= 0 || range[0] > indices2.at(-1)[1])
                    return indices2.push(range);
                indices2.at(-1)[1] = range[1];
            });
            this.#indices = indices2;
        }
        this.name = this.name;
    }

    get time() { return this.#time; }
    set time(v) {
        v = util.ensure(v, "num");
        if (this.time == v) return;
        this.#time = v;
        let date = new Date(this.time);
        let mon = date.getMonth()+1;
        let d = date.getDate();
        let yr = date.getFullYear();
        let hr = date.getHours();
        let am = hr < 12;
        if (!am) hr -= 12;
        if (hr == 0) hr = 12;
        let min = date.getMinutes();
        this.eListTime.textContent = `${mon}-${d}-${yr} ${hr}:${String(min).padStart(2, "0")}${am?"AM":"PM"}`;
    }

    get selected() { return this.elemList.classList.contains("selected"); }
    set selected(v) {
        if (v) this.elemList.classList.add("selected");
        else this.elemList.classList.remove("selected");
        if (v) this.elemGrid.classList.add("selected");
        else this.elemGrid.classList.remove("selected");
    }

    get elemList() { return this.#elemList; }
    get eListIcon() { return this.#eListIcon; }
    get eListName() { return this.#eListName; }
    get eListTime() { return this.#eListTime; }
    get eListOptions() { return this.#eListOptions; }
    get elemGrid() { return this.#elemGrid; }
    get eGridIcon() { return this.#eGridIcon; }
    get eGridName() { return this.#eGridName; }
    get eGridOptions() { return this.#eGridOptions; }
    get eGridImage() { return this.#eGridImage; }
};
AppFeature.ProjectPage = class AppFeatureProjectPage extends App.Page {
    #projectId;

    #progress;
    #progressHover;
    #sections;

    #eMain;
    #eNav;
    #eNavPre;
    #eNavPost;
    #eNavProgress;
    #eNavProgressTooltip;
    #eNavOptionsButton;
    #eNavActionButton;
    #eNavForwardButton;
    #eNavBackButton;
    #eNavInfo;

    constructor(app) {
        super("PROJECT", app);

        this.#progress = null;
        this.#progressHover = null;
        this.#sections = new Set();

        this.#eMain = document.createElement("div");
        this.elem.appendChild(this.eMain);
        this.eMain.classList.add("main");
        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.tabIndex = 1;
        this.eNav.classList.add("nav");
        this.#eNavPre = document.createElement("div");
        this.eNav.appendChild(this.eNavPre);
        this.eNavPre.classList.add("pre");
        this.#eNavPost = document.createElement("div");
        this.eNav.appendChild(this.eNavPost);
        this.eNavPost.classList.add("post");
        this.#eNavProgress = document.createElement("div");
        this.eNav.appendChild(this.eNavProgress);
        this.eNavProgress.classList.add("progress");
        this.eNavProgress.innerHTML = "<div class='hover'><div class='tooltip hov nx'></div></div>";
        this.#eNavProgressTooltip = this.eNavProgress.querySelector(":scope > .hover > .tooltip");
        this.#eNavOptionsButton = document.createElement("button");
        this.eNavPre.appendChild(this.eNavOptionsButton);
        this.eNavOptionsButton.innerHTML = "<ion-icon name='ellipsis-vertical'></ion-icon>";
        this.#eNavActionButton = document.createElement("button");
        this.eNavPre.appendChild(this.eNavActionButton);
        this.eNavActionButton.innerHTML = "<ion-icon name='play'></ion-icon>";
        this.#eNavBackButton = document.createElement("button");
        this.eNavPre.appendChild(this.eNavBackButton);
        this.eNavBackButton.innerHTML = "<ion-icon name='play-skip-back'></ion-icon>";
        this.#eNavForwardButton = document.createElement("button");
        this.eNavPre.appendChild(this.eNavForwardButton);
        this.eNavForwardButton.innerHTML = "<ion-icon name='play-skip-forward'></ion-icon>";
        this.#eNavInfo = document.createElement("div");
        this.eNavPost.appendChild(this.eNavInfo);
        this.eNavInfo.classList.add("info");
        
        this.navOpen = true;

        this.progress = 0;
        this.progressHover = 0;

        const onMouseMove = e => {
            let r = this.eNavProgress.getBoundingClientRect();
            let p = (e.pageX-r.left) / r.width;
            this.progressHover = p;
        };
        const onKeyDown = e => {
            if (e.target != document.body && e.target != this.eNav) return;
            if (e.code == "ArrowLeft") {
                this.post("nav-back");
                this.eNav.focus();
            }
            if (e.code == "ArrowRight") {
                this.post("nav-forward");
                this.eNav.focus();
            }
            if (e.code == "Comma") {
                this.post("nav-back-small");
                this.eNav.focus();
            }
            if (e.code == "Period") {
                this.post("nav-forward-small");
                this.eNav.focus();
            }
            if (e.code == "Space") {
                this.eNavActionButton.click();
                this.eNav.focus();
            }
        };
        this.addHandler("add", () => {
            document.body.addEventListener("mousemove", onMouseMove);
            document.body.addEventListener("keydown", onKeyDown);
        });
        this.addHandler("rem", () => {
            document.body.removeEventListener("mousemove", onMouseMove);
            document.body.removeEventListener("keydown", onKeyDown);
        });

        this.app.addHandler("perm", async () => {
            this.app.markChange("*");
            return await this.app.saveProjectsClean();
        });

        const timer = new util.Timer();
        timer.play();
        let lock = false;
        this.addHandler("update", async () => {
            if (lock) return;
            if (timer.time < 10000) return;
            timer.clear();
            lock = true;
            await this.app.post("cmd-save");
            lock = false;
        });

        this.#projectId = null;

        this.addHandler("enter", async data => {
            let projectOnly = [
                "savecopy",
                "export", "import",
                "delete", "closeproject",
            ];
            projectOnly.forEach(id => {
                let itm = this.app.menu.findItemWithId(id);
                if (!itm) return;
                itm.exists = true;
            });
            Array.from(document.querySelectorAll(".forproject")).forEach(elem => (elem.style.display = ""));
            let itm;
            itm = this.app.menu.findItemWithId("closeproject");
            if (itm) itm.accelerator = "CmdOrCtrl+W";
            itm = this.app.menu.findItemWithId("close");
            if (itm) itm.accelerator = "CmdOrCtrl+Shift+W";
            await this.postResult("post-enter", data);
        });
        this.addHandler("leave", async data => {
            let projectOnly = [
                "savecopy",
                "export", "import",
                "delete", "closeproject",
            ];
            projectOnly.forEach(id => {
                let itm = this.app.menu.findItemWithId(id);
                if (!itm) return;
                itm.exists = false;
            });
            Array.from(document.querySelectorAll(".forproject")).forEach(elem => (elem.style.display = "none"));
            let itm;
            itm = this.app.menu.findItemWithId("closeproject");
            if (itm) itm.accelerator = null;
            itm = this.app.menu.findItemWithId("close");
            if (itm) itm.accelerator = null;
            this.app.markChange("*all");
            await this.app.post("cmd-save");
            this.project = null;
            await this.postResult("post-leave", data);
        });
    }

    async refresh() {
        await this.app.loadProjectsClean();
        this.app.dragging = false;
        await this.postResult("refresh");
    }

    get projectId() { return this.#projectId; }
    set projectId(v) {
        v = String(v);
        v = this.app.hasProject(v) ? v : null;
        if (this.projectId == v) return;
        if (this.hasProject()) this.project.clearLinkedHandlers(this, "change");
        let project = this.project;
        this.#projectId = v;
        if (this.hasProject()) this.project.addLinkedHandler(this, "change", (c, f, t) => this.change("project."+c, f, t));
        this.change("project", project, this.project);
    }
    get project() { return this.app.getProject(this.projectId); }
    set project(v) {
        v = ((v instanceof Project) && (v instanceof this.app.constructor.PROJECTCLASS)) ? v : null;
        if (this.project == v) return;
        if ((v instanceof Project) && (v instanceof this.app.constructor.PROJECTCLASS)) {
            if (!this.app.hasProject(v)) this.app.addProject(v);
            this.projectId = v.id;
        } else this.projectId = null;
    }
    hasProject() { return (this.project instanceof Project) && (this.project instanceof this.app.constructor.PROJECTCLASS); }

    get progress() { return this.#progress; }
    set progress(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.progress == v) return;
        this.change("progress", this.progress, this.#progress=v);
        this.eNavProgress.style.setProperty("--progress", (this.progress*100)+"%");
    }
    get progressHover() { return this.#progressHover; }
    set progressHover(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.progressHover == v) return;
        this.change("progressHover", this.progressHover, this.#progressHover=v);
        this.eNavProgress.style.setProperty("--hover", (this.progressHover*100)+"%");
    }
    get sections() { return [...this.#sections]; }
    set sections(v) {
        v = util.ensure(v, "arr");
        this.clearSections();
        this.addSection(v);
    }
    clearSections() {
        let sections = this.sections;
        this.remSection(sections);
        return sections;
    }
    hasSection(sect) {
        if (!(sect instanceof AppFeature.ProjectPage.Section)) return false;
        return this.#sections.has(sect);
    }
    addSection(...sects) {
        return util.Target.resultingForEach(sects, sect => {
            if (!(sect instanceof AppFeature.ProjectPage.Section)) return false;
            if (this.hasSection(sect)) return false;
            this.#sections.add(sect);
            this.eNavProgress.appendChild(sect.elem);
            return sect;
        });
    }
    remSection(...sects) {
        return util.Target.resultingForEach(sects, sect => {
            if (!(sect instanceof AppFeature.ProjectPage.Section)) return false;
            if (!this.hasSection(sect)) return false;
            this.#sections.delete(sect);
            this.eNavProgress.removeChild(sect.elem);
            return sect;
        });
    }

    get eMain() { return this.#eMain; }
    get eNav() { return this.#eNav; }
    get eNavPre() { return this.#eNavPre; }
    get eNavPost() { return this.#eNavPost; }
    get eNavProgress() { return this.#eNavProgress; }
    get eNavProgressTooltip() { return this.#eNavProgressTooltip; }
    get eNavOptionsButton() { return this.#eNavOptionsButton; }
    get eNavActionButton() { return this.#eNavActionButton; }
    get eNavForwardButton() { return this.#eNavForwardButton; }
    get eNavBackButton() { return this.#eNavBackButton; }
    get eNavInfo() { return this.#eNavInfo; }

    get navOpen() { return this.elem.classList.contains("open"); }
    set navOpen(v) {
        v = !!v;
        if (this.navOpen == v) return;
        if (v) this.elem.classList.add("open");
        else this.elem.classList.remove("open");
    }
    get navClosed() { return !this.navOpen; }
    set navClosed(v) { this.navOpen = !v; }
    openNav() { return this.navOpen = true; }
    closeNav() { return this.navClosed = true; }

    get state() {
        return {
            id: this.projectId,
        };
    }
    async loadState(state) {
        state = util.ensure(state, "obj");
        await this.app.loadProjects();
        await this.app.setPage(this.name, { id: state.id });
    }

    async determineSame(data) {
        if (this.app.hasProject(data.id)) return this.projectId == data.id;
        else if ((data.project instanceof Project) && (data.project instanceof this.app.constructor.PROJECTCLASS)) return this.project == data.project;
        return false;
    }
};
AppFeature.ProjectPage.Section = class AppFeatureProjectPageSection extends util.Target {
    #l; #r; #x;

    #elem;

    constructor(l, r, x) {
        super();

        this.#l = this.#r = this.#x = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("section");

        this.addHandler("change", () => {
            this.elem.style.setProperty("--l", (this.l*100)+"%");
            this.elem.style.setProperty("--r", (this.r*100)+"%");
            this.elem.style.setProperty("--x", String(this.x));
        });

        [this.l, this.r, this.x] = [l, r, x];
    }

    get l() { return this.#l; }
    set l(v) {
        v = Math.min(1, Math.max(util.ensure(v, "num")));
        if (this.l == v) return;
        this.change("l", this.l, this.#l=v);
    }
    get r() { return this.#r; }
    set r(v) {
        v = Math.min(1, Math.max(util.ensure(v, "num")));
        if (this.r == v) return;
        this.change("r", this.r, this.#r=v);
    }
    get x() { return this.#x; }
    set x(v) {
        v = Math.max(0, util.ensure(v, "int"));
        if (this.x == v) return;
        this.change("x", this.x, this.#x=v);
    }

    get color() { return this.elem.style.backgroundColor; }
    set color(v) { this.elem.style.backgroundColor = v; }
    
    get elem() { return this.#elem; }
};

export class Odometry extends util.Target {
    #elem;
    #canvas;
    #overlay;
    #quality;
    #mouse;

    #doRender;

    #size;

    constructor(elem) {
        super();

        if (!(elem instanceof HTMLDivElement)) elem = document.createElement("div");
        this.#elem = elem;
        this.elem.classList.add("odom");
        this.#canvas = elem.querySelector(":scope > canvas") || document.createElement("canvas");
        this.elem.appendChild(this.canvas);
        this.canvas.tabIndex = 1;
        this.#overlay = elem.querySelector(":scope > .overlay") || document.createElement("div");
        this.elem.appendChild(this.overlay);
        this.overlay.classList.add("overlay");
        this.#quality = 0;
        this.#mouse = new V();

        this.#doRender = true;

        this.#size = new V();

        this.canvas.addEventListener("mousemove", e => this.mouse.set(e.pageX, e.pageY));

        this.quality = 2;

        this.size = 1000;

        this.addHandler("update", delta => {
            if (!this.doRender) return;
            this.rend(delta);
        });
    }

    rend(delta) { this.post("render", delta); }

    get elem() { return this.#elem; }
    get canvas() { return this.#canvas; }
    get overlay() { return this.#overlay; }
    get quality() { return this.#quality; }
    set quality(v) {
        v = Math.max(1, util.ensure(v, "int"));
        if (this.quality == v) return;
        this.change("quality", this.quality, this.#quality=v);
    }
    get mouse() { return this.#mouse; }

    get doRender() { return this.#doRender; }
    set doRender(v) { this.#doRender = !!v; }

    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }

    update(delta) { this.post("update", delta); }
}
export class Odometry2d extends Odometry {
    #ctx;
    #worldMouse;

    #render;

    #image;
    #imageShow;

    #padding;

    #unit;

    static BEFOREGRID = 0;
    static AFTERGRID = 1;
    static BEFOREIMAGE = 1;
    static AFTERIMAGE = 2;
    static BEFOREBORDER = 2;
    static AFTERBORDER = 3;

    constructor(elem) {
        super(elem);

        const update = () => {
            let r = this.elem.getBoundingClientRect();
            this.canvas.width = r.width * this.quality;
            this.canvas.height = r.height * this.quality;
            this.canvas.style.width = r.width+"px";
            this.canvas.style.height = r.height+"px";
            this.update(0);
        };
        new ResizeObserver(update).observe(this.elem);
        this.addHandler("change-quality", update);

        this.#ctx = this.canvas.getContext("2d");
        this.#worldMouse = new V();
        this.mouse.addHandler("change", () => this.worldMouse.set(this.pageToWorld(this.mouse)));

        this.#render = new Odometry2d.Render(this, 0);

        this.#image = new Image();
        this.#imageShow = null;

        this.#padding = 0;

        this.#unit = null;

        this.padding = 40;

        this.unit = "m";

        this.addHandler("render", delta => {
            const ctx = this.ctx, quality = this.quality, padding = this.padding, scale = this.scale;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            const mnx = (ctx.canvas.width - this.w*scale*quality)/2, mxx = (ctx.canvas.width + this.w*scale*quality)/2;
            const mny = (ctx.canvas.height - this.h*scale*quality)/2, mxy = (ctx.canvas.height + this.h*scale*quality)/2;
            
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(0);

            let w = Math.floor(util.Unit.convert(this.w, "cm", this.unit));
            let h = Math.floor(util.Unit.convert(this.h, "cm", this.unit));
            let step = lib.findStep((w+h)/2, 10);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.fillStyle = PROPERTYCACHE.get("--v6");
            ctx.font = (12*quality)+"px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            let y0 = mny;
            let y1 = mxy;
            let y2 = mxy + 5*quality;
            let y3 = mxy + 10*quality;
            for (let i = 0; i <= w; i += step) {
                let x = util.lerp(mnx, mxx, util.Unit.convert(i, this.unit, "cm") / this.w);
                ctx.strokeStyle = PROPERTYCACHE.get("--v6");
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
                ctx.strokeStyle = PROPERTYCACHE.get("--v2");
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, y1);
                ctx.stroke();
                if (i%2 == 1 && i < w) continue;
                ctx.fillText(i, x, y3);
            }
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            let x0 = mxx;
            let x1 = mnx;
            let x2 = mnx - 5*quality;
            let x3 = mnx - 10*quality;
            for (let i = 0; i <= h; i += step) {
                let y = util.lerp(mxy, mny, util.Unit.convert(i, this.unit, "cm") / this.h);
                ctx.strokeStyle = PROPERTYCACHE.get("--v6");
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();
                ctx.strokeStyle = PROPERTYCACHE.get("--v2");
                ctx.beginPath();
                ctx.moveTo(x0, y);
                ctx.lineTo(x1, y);
                ctx.stroke();
                if (i%2 == 1 && i < h) continue;
                ctx.fillText(i, x3, y);
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(mnx, mny, mxx-mnx, mxy-mny);
            ctx.clip();

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(1);

            try {
                if (this.#imageShow) {
                    let imageScale = ((this.w/this.#image.width)+(this.h/this.#image.height))/2;
                    ctx.globalAlpha = 0.25;
                    ctx.globalCompositeOperation = "overlay";
                    ctx.drawImage(
                        this.#image,
                        (ctx.canvas.width - this.#image.width*imageScale*scale*quality)/2,
                        (ctx.canvas.height - this.#image.height*imageScale*scale*quality)/2,
                        this.#image.width*imageScale*scale*quality,
                        this.#image.height*imageScale*scale*quality,
                    );
                }
            } catch (e) {}

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(2);

            ctx.restore();

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = PROPERTYCACHE.get("--v6");
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.strokeRect(mnx, mny, mxx-mnx, mxy-mny);

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(3);
        });
    }

    get ctx() { return this.#ctx; }
    get worldMouse() { return this.#worldMouse; }

    get render() { return this.#render; }

    get imageSrc() { return this.#image.src; }
    set imageSrc(v) {
        if (v == null) return this.#imageShow = null;
        if (this.#imageShow == v) return;
        this.#imageShow = v;
        this.#image.src = v;
    }

    get padding() { return this.#padding; }
    set padding(v) { this.#padding = Math.max(0, util.ensure(v, "num")); }

    get unit() { return this.#unit; }
    set unit(v) { this.#unit = String(v); }

    get scale() {
        return Math.min(((this.canvas.width/this.quality) - 2*this.padding)/this.w, ((this.canvas.height/this.quality) - 2*this.padding)/this.h);
    }

    get hovered() { return this.render.theHovered; }
    get hoveredPart() {
        let hovered = this.hovered;
        if (!hovered) return null;
        return hovered.hovered;
    }

    worldToCanvas(...p) {
        const scale = this.scale;
        let [x, y] = new V(...p).xy;
        x = (x - this.w/2) * (scale*this.quality) + this.canvas.width/2;
        y = (this.h/2 - y) * (scale*this.quality) + this.canvas.height/2;
        return new V(x, y);
    }
    worldLenToCanvas(l) {
        l = util.ensure(l, "num");
        return l*(this.scale*this.quality);
    }
    canvasToWorld(...p) {
        const scale = this.scale;
        let [x, y] = new V(...p).xy;
        x = (x - this.canvas.width/2) / (scale*this.quality) + this.w/2;
        y = this.h/2 - (y - this.canvas.height/2) / (scale*this.quality);
        return new V(x, y);
    }
    canvasLenToWorld(l) {
        l = util.ensure(l, "num");
        return l/(this.scale*this.quality);
    }
    canvasToPage(...p) {
        let [x, y] = new V(...p).xy;
        let r = this.canvas.getBoundingClientRect();
        x /= this.quality; y /= this.quality;
        x += r.left; y += r.top;
        return new V(x, y);
    }
    canvasLenToPage(l) {
        l = util.ensure(l, "num");
        return l/this.quality;
    }
    pageToCanvas(...p) {
        let [x, y] = new V(...p).xy;
        let r = this.canvas.getBoundingClientRect();
        x -= r.left; y -= r.top;
        x *= this.quality; y *= this.quality;
        return new V(x, y);
    }
    pageLenToCanvas(l) {
        l = util.ensure(l, "num");
        return l*this.quality;
    }
    worldToPage(...p) { return this.canvasToPage(this.worldToCanvas(...p)); }
    worldLenToPage(l) { return this.canvasLenToPage(this.worldLenToCanvas(l)); }
    pageToWorld(...p) { return this.canvasToWorld(this.pageToCanvas(...p)); }
    pageLenToWorld(l) { return this.canvasLenToWorld(this.pageLenToCanvas(l)); }
}
Odometry2d.Render = class Odometry2dRender extends util.Target {
    #parent;
    #hasParent;
    
    #pos;
    #z; #z2;
    #alpha;
    
    #rPos;
    #rAlpha;

    #renders;

    #canHover;

    constructor(parent, pos) {
        super();

        if (!(parent instanceof Odometry2d || parent instanceof Odometry2d.Render)) throw new Error("Parent is not of class Odometry2d nor of class Odometry2dRender");
        this.#parent = parent;
        this.#hasParent = this.parent instanceof Odometry2d.Render;

        this.#pos = new V();
        this.#z = this.#z2 = 0;
        this.#alpha = 1;

        this.#rPos = new V();
        this.#rAlpha = 1;

        this.#renders = new Set();

        this.#canHover = true;

        this.pos = pos;
        this.z = Odometry2d.AFTERIMAGE;
        this.z2 = 0;
    }

    get parent() { return this.#parent; }
    hasParent() { return this.#hasParent; }
    get odometry() { return this.hasParent() ? this.parent.odometry : this.parent; }

    get pos() { return this.#pos; }
    set pos(v) { this.#pos.set(v); }
    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }

    get z() { return this.#z; }
    set z(v) { this.#z = util.ensure(v, "int"); }
    get z2() { return this.#z2; }
    set z2(v) { this.#z2 = util.ensure(v, "int"); }

    get alpha() { return this.#alpha; }
    set alpha(v) { this.#alpha = Math.min(1, Math.max(0, util.ensure(v, "num"))); }

    get rPos() { return this.#rPos; }
    get rX() { return this.rPos.x; }
    get rY() { return this.rPos.y; }
    get rAlpha() { return this.#rAlpha; }

    get renders() { return [...this.#renders]; }
    set renders(v) {
        v = util.ensure(v, "arr");
        this.clearRenders();
        this.addRender(v);
    }
    clearRenders() {
        let renders = this.renders;
        this.remRender(renders);
        return renders;
    }
    hasRender(render) {
        if (!(render instanceof Odometry2d.Render)) return false;
        return this.#renders.has(render) && render.parent == this;
    }
    addRender(...renders) {
        return util.Target.resultingForEach(renders, render => {
            if (!(render instanceof Odometry2d.Render)) return false;
            if (render.parent != this) return false;
            if (this.hasRender(render)) return false;
            this.#renders.add(render);
            render.onAdd();
            return render;
        });
    }
    remRender(...renders) {
        return util.Target.resultingForEach(renders, render => {
            if (!(render instanceof Odometry2d.Render)) return false;
            if (render.parent != this) return false;
            if (!this.hasRender(render)) return false;
            render.onRem();
            this.#renders.delete(render);
            return render;
        });
    }

    get canHover() { return this.#canHover; }
    set canHover(v) { this.#canHover = !!v; }
    get hovered() { return null; }
    get theHovered() {
        for (let render of this.renders) {
            let hovered = render.theHovered;
            if (hovered) return hovered;
        }
        let hovered = this.hovered;
        return hovered ? this : null;
    }

    render(z=null) {
        this.#rPos = new V(this.hasParent() ? this.parent.rPos : 0).add(this.pos);
        this.#rAlpha = (this.hasParent() ? this.parent.rAlpha : 1) * this.alpha;
        this.odometry.ctx.globalAlpha = this.rAlpha;
        this.post("render");
        this.renders.filter(render => (z == null || render.z == z)).sort((a, b) => {
            if (a.z < b.z) return -1;
            if (a.z > b.z) return +1;
            return a.z2-b.z2;
        }).forEach(render => render.render());
    }
};
Odometry2d.Robot = class Odometry2dRobot extends Odometry2d.Render {
    #type;

    #size;
    #velocity;
    #showVelocity;
    #heading;

    #color;
    #colorH;

    #selected;

    static TYPES = {
        DEFAULT: Symbol("DEFAULT"),
        NODE: Symbol("NODE"),
        BOX: Symbol("BOX"),
        ARROW: Symbol("ARROW"),
    };
    static lookupTypeName(type) {
        for (let name in Odometry2d.Robot.TYPES)
            if (Odometry2d.Robot.TYPES[name] == type)
                return name;
        return null;
    }

    constructor(parent, pos, size, heading, velocity) {
        super(parent, pos);

        this.#type = null;

        this.#size = new V();
        this.#velocity = new V();
        this.#showVelocity = true;
        this.#heading = 0;

        this.#color = "cb";
        this.#colorH = "cb5";

        this.type = Odometry2d.Robot.TYPES.DEFAULT;

        this.size = size;
        this.heading = heading;
        this.velocity = velocity;

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            if (![Odometry2d.Robot.TYPES.NODE, Odometry2d.Robot.TYPES.ARROW].includes(this.type)) {
                ctx.strokeStyle = PROPERTYCACHE.get("--"+this.color+"-8");
                ctx.lineWidth = 7.5*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "square";
                ctx.beginPath();
                let path = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]].map(v => this.size.sub(this.odometry.pageLenToWorld(7.5)).div(2).mul(v)).map(v => v.rotateOrigin(this.heading));
                for (let i = 0; i <= path.length; i++) {
                    let j = i%path.length;
                    let p = this.odometry.worldToCanvas(this.rPos.add(path[j]));
                    if (i > 0) ctx.lineTo(...p.xy);
                    else ctx.moveTo(...p.xy);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                ctx.lineWidth = 1*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "square";
                ctx.beginPath();
                path = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]].map(v => this.size.div(2).mul(v)).map(v => v.rotateOrigin(this.heading));
                for (let i = 0; i <= path.length; i++) {
                    let j = i%path.length;
                    let p = this.odometry.worldToCanvas(this.rPos.add(path[j]));
                    if (i > 0) ctx.lineTo(...p.xy);
                    else ctx.moveTo(...p.xy);
                }
                ctx.closePath();
                ctx.stroke();
            }
            if (this.type == Odometry2d.Robot.TYPES.ARROW) {
                ctx.strokeStyle = PROPERTYCACHE.get("--"+((this.hovered == "heading") ? this.colorH : this.color));
                ctx.lineWidth = 5*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                let dir = this.heading;
                let tail = this.rPos.add(V.dir(dir, -this.w/2));
                let head = this.rPos.add(V.dir(dir, +this.w/2));
                ctx.beginPath();
                ctx.moveTo(...this.odometry.worldToCanvas(tail).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir-135, this.odometry.pageLenToWorld(15)))).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir+135, this.odometry.pageLenToWorld(15)))).xy);
                ctx.stroke();
            } else {
                ctx.fillStyle = PROPERTYCACHE.get("--"+((this.hovered == "heading") ? "v8" : "v8-8"));
                ctx.lineWidth = 1*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "square";
                ctx.beginPath();
                ctx.arc(...this.odometry.worldToCanvas(this.rPos.add(V.dir(this.heading, this.w/2))).xy, 5*quality, 0, 2*Math.PI);
                ctx.fill();
            }
            if (![Odometry2d.Robot.TYPES.BOX, Odometry2d.Robot.TYPES.ARROW].includes(this.type)) {
                ctx.fillStyle = PROPERTYCACHE.get("--"+((this.hovered == "main") ? this.colorH : this.color));
                ctx.strokeStyle = PROPERTYCACHE.get("--v8");
                ctx.lineWidth = 1*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "square";
                ctx.beginPath();
                ctx.arc(...this.odometry.worldToCanvas(this.rPos).xy, 7.5*quality, 0, 2*Math.PI);
                ctx.fill();
                if (this.selected) ctx.stroke();
            }
            if (this.showVelocity) {
                ctx.strokeStyle = PROPERTYCACHE.get("--"+((this.hovered == "velocity") ? "v8" : "v8-8"));
                ctx.lineWidth = 1*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                let dir = 180+this.velocity.towards();
                let tail = this.rPos;
                let head = tail.add(V.dir(dir, this.velocity.dist()));
                ctx.beginPath();
                ctx.moveTo(...this.odometry.worldToCanvas(tail).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir-135, this.odometry.pageLenToWorld(5)))).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir+135, this.odometry.pageLenToWorld(5)))).xy);
                ctx.stroke();
            }
        });
    }

    get hovered() {
        if (!this.canHover) return null;
        let m = this.odometry.worldMouse;
        if (this.showVelocity && this.rPos.add(this.velocity).distSquared(m) < this.odometry.pageLenToWorld(5)**2) return "velocity";
        if (this.rPos.add(V.dir(this.heading, this.w/2)).distSquared(m) < this.odometry.pageLenToWorld(5)**2) return "heading";
        if (this.rPos.distSquared(m) < this.odometry.pageLenToWorld(7.5)**2) return "main";
        return null;
    }

    get type() { return this.#type; }
    set type(v) {
        if (v in Odometry2d.Robot.TYPES) v = Odometry2d.Robot.TYPES[v];
        if (!Object.values(Odometry2d.Robot.TYPES).includes(v)) v = Odometry2d.Robot.TYPES.DEFAULT;
        this.#type = v;
    }

    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }
    get velocity() { return this.#velocity; }
    set velocity(v) { this.#velocity.set(v); }
    get velocityX() { return this.velocity.x; }
    set velocityX(v) { this.velocity.x = v; }
    get velocityY() { return this.velocity.y; }
    set velocityY(v) { this.velocity.y = v; }
    get showVelocity() { return this.#showVelocity; }
    set showVelocity(v) { this.#showVelocity = !!v; }

    get heading() { return this.#heading; }
    set heading(v) { this.#heading = util.clampAngle(v); }

    get color() { return this.#color; }
    set color(v) { this.#color = String(v); }
    get colorH() { return this.#colorH; }
    set colorH(v) { this.#colorH = String(v); }

    get selected() { return this.#selected; }
    set selected(v) { this.#selected = !!v; }
};
Odometry2d.Obstacle = class Odometry2dObstacle extends Odometry2d.Render {
    #radius;
    #dir;

    #selected;

    constructor(odometry, pos, radius) {
        super(odometry, pos);

        this.#radius = 0;
        this.#dir = 0;

        this.radius = radius;

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            ctx.fillStyle = PROPERTYCACHE.get("--"+((this.hovered == "main") ? "cr-8" : "cr-4"));
            ctx.strokeStyle = PROPERTYCACHE.get("--v8");
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(this.rPos).xy, this.odometry.worldLenToCanvas(this.radius), 0, 2*Math.PI);
            ctx.fill();
            if (this.selected) ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(...this.odometry.worldToCanvas(this.rPos).xy);
            ctx.lineTo(...this.odometry.worldToCanvas(this.rPos.add(V.dir(this.dir, this.radius))).xy);
            ctx.stroke();
            ctx.fillStyle = PROPERTYCACHE.get("--"+((this.hovered == "radius") ? "a" : "v8"));
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(this.rPos.add(V.dir(this.dir, this.radius))).xy, 5*quality, 0, 2*Math.PI);
            ctx.fill();
        });
    }

    get hovered() {
        if (!this.canHover) return null;
        let m = this.odometry.worldMouse;
        if (this.rPos.add(V.dir(this.dir, this.radius)).distSquared(m) < this.odometry.pageLenToWorld(5)**2) return "radius";
        if (this.rPos.distSquared(m) < this.radius**2) return "main";
        return null;
    }

    get radius() { return this.#radius; }
    set radius(v) { this.#radius = Math.max(0, util.ensure(v, "num")); }

    get dir() { return this.#dir; }
    set dir(v) { this.#dir = util.clampAngle(v); }

    get selected() { return this.#selected; }
    set selected(v) { this.#selected = !!v; }
};
export class Odometry3d extends Odometry {
    static loadedFields = {};
    static loadingFields = {};
    static loadedRobots = {};
    static loadingRobots = {};

    static templatesLoad = 0;
    static templates = {};
    static templateModels = {};
    static robotsLoad = 0;
    static robots = {};
    static robotModels = {};

    #renders;

    #scene;
    #wpilibGroup;
    #camera;

    #renderer;
    #cssRenderer;

    #controls;

    #raycaster;
    #raycastIntersections;

    #requestRedraw;

    #axisScene;
    #axisSceneSized;

    #template;

    #field;
    #theField;

    #renderType;
    #controlType;
    #isCinematic;
    #origin;
    
    static #traverseObject(obj, type) {
        const material = obj.material;
        obj.material = material.clone();
        material.dispose();
        if (type == "basic") {
            if (!(obj.material instanceof THREE.MeshStandardMaterial)) return;
            obj.material.metalness = 0;
            obj.material.roughness = 1;
            return;
        }
        if (type == "cinematic") {
            if (!(obj.material instanceof THREE.MeshStandardMaterial)) return;
            const material = new THREE.MeshLambertMaterial({
                color: obj.material.color,
                transparent: obj.material.transparent,
                opacity: obj.material.opacity,
            });
            if (obj.name.toLowerCase().includes("carpet")) {
                obj.castShadow = false;
                obj.receiveShadow = true;
            } else {
                obj.castShadow = !obj.material.transparent;
                obj.receiveShadow = !obj.material.transparent;
            }
            obj.material.dispose();
            obj.material = material;
            return;
        }
    }
    static async loadField(name, type) {
        name = String(name);
        type = String(type);
        let templatesLoad = this.templatesLoad;
        let templates = {};
        let templateModels = {};
        if (templatesLoad < 2) {
            if (templatesLoad < 1) this.templatesLoad = 1;
            templates = this.templates = util.ensure(await window.api.get("templates"), "obj");
            templateModels = this.templateModels = util.ensure(await window.api.get("template-models"), "obj");
            if (templatesLoad < 1) this.templatesLoad = 2;
        } else {
            templates = this.templates;
            templateModels = this.templateModels;
        }
        if (!(name in templates)) return null;
        if (!(name in templateModels)) return null;
        if (this.loadedFields[name]) {
            if (this.loadedFields[name][type])
                return this.loadedFields[name][type];
            return null;
        }
        let t0 = util.ensure(this.loadingFields[name], "num");
        let t1 = util.getTime();
        if (t1-t0 < 1000) return null;
        this.loadingFields[name] = t1;
        return await new Promise((res, rej) => {
            LOADER.load(templateModels[name], gltf => {
                this.loadedFields[name] = {};
                const scene = gltf.scene;
                ["basic", "cinematic"].forEach(type => {
                    const obj = this.loadedFields[name][type] = scene.clone();
                    obj.traverse(obj => {
                        if (!obj.isMesh) return;
                        this.#traverseObject(obj, type);
                    });
                });
                scene.traverse(obj => {
                    if (!obj.isMesh) return;
                    obj.material.dispose();
                });
                if (!this.loadedFields[name][type]) return null;
                res(this.loadedFields[name][type]);
            }, null, err => res(null));
        });
    }
    static async loadRobot(name, type) {
        name = String(name);
        type = String(type);
        let robotsLoad = this.robotsLoad;
        let robots = {};
        let robotModels = {};
        if (robotsLoad < 2) {
            if (robotsLoad < 1) this.robotsLoad = 1;
            robots = this.robots = util.ensure(await window.api.get("robots"), "obj");
            robotModels = this.robotModels = util.ensure(await window.api.get("robot-models"), "obj");
            if (robotsLoad < 1) this.robotsLoad = 2;
        } else {
            robots = this.robots;
            robotModels = this.robotModels;
        }
        if (!(name in robots)) return null;
        if (!(name in robotModels)) return null;
        if (this.loadedRobots[name]) {
            if (this.loadedRobots[name][type])
                return this.loadedRobots[name][type];
            return null;
        }
        let t0 = util.ensure(this.loadingRobots[name], "num");
        let t1 = util.getTime();
        if (t1-t0 < 1000) return null;
        this.loadingRobots[name] = t1;
        return await new Promise((res, rej) => {
            LOADER.load(robotModels[name], gltf => {
                this.loadedRobots[name] = {};
                const scene = gltf.scene;
                ["basic", "cinematic"].forEach(type => {
                    let obj, pobj, bbox;
                    obj = scene.clone();
                    obj.traverse(obj => {
                        if (!obj.isMesh) return;
                        this.#traverseObject(obj, type);
                    });
                    bbox = new THREE.Box3().setFromObject(obj);
                    obj.position.set(
                        obj.position.x - (bbox.max.x+bbox.min.x)/2,
                        obj.position.y - (bbox.max.y+bbox.min.y)/2,
                        obj.position.z + (bbox.max.z-bbox.min.z)/2,
                    );
                    [obj, pobj] = [new THREE.Object3D(), obj];
                    obj.add(pobj);
                    obj.quaternion.copy(THREE.Quaternion.fromRotationSequence(util.ensure(robots[name], "obj").rotations));
                    [obj, pobj] = [new THREE.Object3D(), obj];
                    obj.add(pobj);
                    this.loadedRobots[name][type] = obj;
                });
                scene.traverse(obj => {
                    if (!obj.isMesh) return;
                    obj.material.dispose();
                });
                if (!this.loadedRobots[name][type]) return null;
                res(this.loadedRobots[name][type]);
            }, null, err => res(null));
        });
    }

    constructor(elem) {
        super(elem);

        let contextLost = false;
        this.canvas.addEventListener("webglcontextlost", () => (contextLost = true));
        this.canvas.addEventListener("webglcontextrestored", () => {
            this.requestRedraw();
            contextLost = false;
        });

        this.#renders = new Set();

        this.#scene = new THREE.Scene();
        this.#wpilibGroup = new THREE.Group();
        this.scene.add(this.wpilibGroup);
        this.wpilibGroup.quaternion.copy(WPILIB2THREE);
        this.#camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        let cam = new Array(7).fill(null);

        this.#renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, powerPreference: "default" });
        this.renderer.shadowMap.enabled = this.isCinematic;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.#cssRenderer = new CSS2DRenderer({ element: this.overlay });
        
        this.#controls = null;

        this.#raycaster = new THREE.Raycaster();
        this.#raycastIntersections = [];

        this.#requestRedraw = true;

        let r = this.elem.getBoundingClientRect();
        
        this.canvas.addEventListener("click", e => {
            e.stopPropagation();
            if (this.controlType == "free") this.controls.lock();
        });
        this.elem.addEventListener("mousemove", e => {
            let x = (e.pageX - r.left) / r.width, y = (e.pageY - r.top) / r.height;
            x = (x*2)-1; y = (y*2)-1;
            if (this.controlType == "free" && this.controls.isLocked) x = y = 0;
            this.raycaster.setFromCamera(new THREE.Vector2(x, -y), this.camera);
            this.#raycastIntersections = this.raycaster.intersectObject(this.scene, true);
        });
        const updateCamera = () => {
            if (this.renderType == "proj") {
                if (this.camera.aspect != r.width / r.height) {
                    this.camera.aspect = r.width / r.height;
                    this.camera.updateProjectionMatrix();
                }
            } else if (this.renderType == "iso") {
                let size = 15;
                let aspect = r.width / r.height;
                this.camera.left = -size/2 * aspect;
                this.camera.right = +size/2 * aspect;
                this.camera.top = +size/2;
                this.camera.bottom = -size/2;
            }
        };
        this.addHandler("change-renderType", updateCamera);
        const updateScene = () => {
            r = this.elem.getBoundingClientRect();
            this.renderer.setSize(Math.ceil(r.width), Math.ceil(r.height));
            this.cssRenderer.setSize(Math.ceil(r.width), Math.ceil(r.height));
            this.renderer.setPixelRatio(this.quality);
            updateCamera();
            this.requestRedraw();
        };
        new ResizeObserver(updateScene).observe(this.elem);
        this.addHandler("change-quality", updateScene);

        const radius = 0.05;
        const length = 5;
        let axes, xAxis, yAxis, zAxis;

        const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);

        this.#axisScene = new THREE.Group();
        this.axisScene._builtin = "axis-scene";
        axes = this.axisScene.axes = new THREE.Group();
        this.axisScene.add(axes);
        xAxis = this.axisScene.xAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        xAxis.castShadow = true;
        xAxis.receiveShadow = false;
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        yAxis = this.axisScene.yAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        yAxis.castShadow = true;
        yAxis.receiveShadow = false;
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        zAxis = this.axisScene.zAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        zAxis.castShadow = true;
        zAxis.receiveShadow = false;
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        this.axisScene.planes = [];

        this.#axisSceneSized = new THREE.Group();
        this.axisSceneSized._builtin = "axis-scene-sized";
        axes = this.axisSceneSized.axes = new THREE.Group();
        this.axisSceneSized.add(axes);
        xAxis = this.axisSceneSized.xAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        xAxis.castShadow = true;
        xAxis.receiveShadow = false;
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        yAxis = this.axisSceneSized.yAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        yAxis.castShadow = true;
        yAxis.receiveShadow = false;
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        zAxis = this.axisSceneSized.zAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        zAxis.castShadow = true;
        zAxis.receiveShadow = false;
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        this.axisSceneSized.planes = [];

        this.#template = null;

        this.#field = null;
        this.#theField = null;

        const hemLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
        this.scene.add(hemLight);

        const lights = [[], []];

        {
            const light = new THREE.PointLight(0xffffff, 0.5);
            lights[0].push(light);
            light.position.set(0, 10, 0);
        }
        {
            const data = [
                [[0, 10, 0], [0, 0, 0], 0xffffff],
                // [[+5, 10, 0], [+2, 0, 0], 0xffffff],
                // [[-5, 10, 0], [-2, 0, 0], 0xffffff],
                [[+5, 10, 0], [+5, 0, 0], 0xff0000],
                [[-5, 10, 0], [-5, 0, 0], 0x0000ff],
            ];
            for (const [[x0, y0, z0], [x1, y1, z1], color] of data) {
                const light = new THREE.SpotLight(color, 150, 0, 60*(Math.PI/180), 0.25, 2);
                lights[1].push(light);
                light.position.set(x0, y0, z0);
                light.target.position.set(x1, y1, z1);
                light.castShadow = true;
                light.shadow.mapSize.width = 1024;
                light.shadow.mapSize.height = 1024;
                light.shadow.bias = -0.01;
            }
        }
        this.addHandler("change-isCinematic", () => {
            this.renderer.shadowMap.enabled = this.isCinematic;
            for (let i = 0; i < 2; i++)
                lights[i].forEach(light => {
                    if (i == +this.isCinematic)
                        this.scene.add(light);
                    else this.scene.remove(light);
                });
        });

        const singlePlaneGeometry = new THREE.PlaneGeometry(1, 1);
        const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        planeMaterial.side = THREE.DoubleSide;

        this.#renderType = null;
        this.#controlType = null;
        this.#isCinematic = null;
        this.#origin = null;

        let keys = new Set();
        this.canvas.addEventListener("keydown", e => {
            e.stopPropagation();
            keys.add(e.code);
        });
        this.canvas.addEventListener("keyup", e => {
            e.stopPropagation();
            keys.delete(e.code);
        });
        let velocity = new util.V3();

        const updateField = () => {
            this.wpilibGroup.scale.x = this.origin.startsWith("blue") ? 1 : -1;
            this.wpilibGroup.scale.y = this.origin.endsWith("+") ? 1 : -1;
            if (!this.theField) return;
            this.theField.scale.x = this.origin.startsWith("blue") ? 1 : -1;
            if (this.field._builtin) this.theField.scale.y = this.origin.endsWith("+") ? 1 : -1;
            else this.theField.scale.z = this.origin.endsWith("+") ? 1 : -1;
        };
        this.addHandler("change-field", updateField);
        this.addHandler("change-origin", updateField);

        let fieldLock = false;

        const timer = new util.Timer();
        timer.play();

        this.addHandler("render", delta => {

            if (contextLost && timer.time >= 500) {
                timer.clear();
                this.renderer.forceContextRestore();
            }

            this.renders.forEach(render => {
                [render.offsetX, render.offsetY] = this.size.div(-2).xy;
                render.update(delta);
            });

            let colorR = PROPERTYCACHE.getColor("--cr");
            let colorG = PROPERTYCACHE.getColor("--cg");
            let colorB = PROPERTYCACHE.getColor("--cb");
            let colorV = PROPERTYCACHE.getColor("--v2");
            planeMaterial.color.set(colorV.toHex(false));
            this.axisScene.xAxis.material.color.set(colorR.toHex(false));
            this.axisScene.yAxis.material.color.set(colorG.toHex(false));
            this.axisScene.zAxis.material.color.set(colorB.toHex(false));
            this.axisSceneSized.xAxis.material.color.set(colorR.toHex(false));
            this.axisSceneSized.yAxis.material.color.set(colorG.toHex(false));
            this.axisSceneSized.zAxis.material.color.set(colorB.toHex(false));
            this.axisSceneSized.axes.position.set(...this.size.div(-200).xy, 0);
            let planes, i;
            planes = this.axisScene.planes;
            let size = 10;
            i = 0;
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    if ((x+y) % 2 == 0) continue;
                    if (i >= planes.length) {
                        let plane = new THREE.Mesh(
                            singlePlaneGeometry,
                            planeMaterial,
                        );
                        plane.castShadow = false;
                        plane.receiveShadow = true;
                        planes.push(plane);
                        this.axisScene.add(plane);
                        this.requestRedraw();
                    }
                    let plane = planes[i++];
                    plane.position.set(0.5+1*(x-size/2), 0.5+1*(y-size/2), 0);
                }
            }
            while (planes.length > i) {
                let plane = planes.pop();
                this.axisScene.remove(plane);
                this.requestRedraw();
            }
            planes = this.axisSceneSized.planes;
            let w = this.axisSceneSized.w;
            let h = this.axisSceneSized.h;
            if (w != this.w/100 || h != this.h/100) {
                w = this.axisSceneSized.w = this.w/100;
                h = this.axisSceneSized.h = this.h/100;
                while (planes.length > 0) {
                    let plane = planes.pop();
                    this.axisSceneSized.remove(plane);
                    plane.geometry.dispose();
                };
                this.requestRedraw();
            }
            i = 0;
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    if ((x+y) % 2 > 0) continue;
                    if (i >= planes.length) {
                        let plane = new THREE.Mesh(
                            new THREE.PlaneGeometry(0, 0),
                            planeMaterial,
                        );
                        plane.castShadow = false;
                        plane.receiveShadow = true;
                        plane.geometry.w = plane.geometry.h = 0;
                        planes.push(plane);
                        this.axisSceneSized.add(plane);
                        this.requestRedraw();
                    }
                    let plane = planes[i++];
                    let pw = Math.min(1, w-x), ph = Math.min(1, h-y);
                    if (plane.geometry.w != pw || plane.geometry.h != ph) {
                        plane.geometry.dispose();
                        plane.geometry = new THREE.PlaneGeometry(pw, ph);
                        plane.geometry.w = pw;
                        plane.geometry.h = ph;
                        this.requestRedraw();
                    }
                    plane.position.set(x+pw/2-w/2, y+ph/2-h/2, 0);
                }
            }
            while (planes.length > i) {
                let plane = planes.pop();
                this.axisSceneSized.remove(plane);
                plane.geometry.dispose();
                this.requestRedraw();
            }

            if (!fieldLock)
                (async () => {
                    fieldLock = true;
                    this.field = (await Odometry3d.loadField(this.template, this.isCinematic ? "cinematic" : "basic")) || (this.hasTemplate() ? this.axisSceneSized : this.axisScene);
                    fieldLock = false;
                })();

            if (this.controlType == "orbit") {
                this.controls.update();
            } else if (this.controlType == "free") {
                if (this.controls.isLocked) {
                    let xP = keys.has("KeyD") || keys.has("ArrowRight");
                    let xN = keys.has("KeyA") || keys.has("ArrowLeft");
                    let yP = keys.has("KeyW") || keys.has("ArrowUp");
                    let yN = keys.has("KeyS") || keys.has("ArrowDown");
                    let zP = keys.has("Space");
                    let zN = keys.has("ShiftLeft");
                    let x = xP - xN;
                    let y = yP - yN;
                    let z = zP - zN;
                    velocity.iadd(new util.V3(x, y, z).mul(keys.has("ShiftRight") ? 0.1 : 1).mul(delta/1000));
                    velocity.imul(0.9);
                    velocity.imap(v => (Math.abs(v) < util.EPSILON ? 0 : v));
                    this.controls.moveRight(velocity.x);
                    this.controls.moveForward(velocity.y);
                    this.camera.position.y += velocity.z;
                } else {
                    velocity.imul(0);
                }
            }
            this.camera.position.x = Math.round(this.camera.position.x*1000)/1000;
            this.camera.position.y = Math.round(this.camera.position.y*1000)/1000;
            this.camera.position.z = Math.round(this.camera.position.z*1000)/1000;
            let cam2 = [
                this.camera.position.x, this.camera.position.y, this.camera.position.z,
                this.camera.quaternion.w, this.camera.quaternion.x, this.camera.quaternion.y, this.camera.quaternion.z,
            ];
            for (let i = 0; i < 7; i++) {
                if (cam[i] == cam2[i]) continue;
                cam[i] = cam2[i];
                this.requestRedraw();
            }

            if (!this.#requestRedraw) return;
            this.#requestRedraw = false;

            this.renderer.render(this.scene, this.camera);
            this.cssRenderer.render(this.scene, this.camera);
        });

        this.renderType = "proj";
        this.controlType = "orbit";
        this.isCinematic = false;
        this.origin = "blue+";
    }

    get renders() { return [...this.#renders]; }
    set renders(v) {
        v = util.ensure(v, "arr");
        this.clearRenders();
        this.addRender(v);
    }
    clearRenders() {
        let renders = this.renders;
        this.remRender(renders);
        return renders;
    }
    hasRender(render) {
        if (!(render instanceof Odometry3d.Render)) return false;
        return this.#renders.has(render) && render.odometry == this;
    }
    addRender(...renders) {
        return util.Target.resultingForEach(renders, render => {
            if (!(render instanceof Odometry3d.Render)) return false;
            if (render.odometry != this) return false;
            if (this.hasRender(render)) return false;
            this.#renders.add(render);
            render.onAdd();
            return render;
        });
    }
    remRender(...renders) {
        return util.Target.resultingForEach(renders, render => {
            if (!(render instanceof Odometry3d.Render)) return false;
            if (render.odometry != this) return false;
            if (!this.hasRender(render)) return false;
            render.onRem();
            this.#renders.delete(render);
            return render;
        });
    }

    get scene() { return this.#scene; }
    get wpilibGroup() { return this.#wpilibGroup; }
    get camera() { return this.#camera; }
    get renderer() { return this.#renderer; }
    get cssRenderer() { return this.#cssRenderer; }
    get controls() { return this.#controls; }
    get raycaster() { return this.#raycaster; }
    get raycastIntersections() { return this.#raycastIntersections; }

    requestRedraw() { return this.#requestRedraw = true; }

    get axisScene() { return this.#axisScene; }
    get axisSceneSized() { return this.#axisSceneSized; }

    get template() { return this.#template; }
    set template(v) {
        v = (v == null) ? null : String(v);
        if (this.template == v) return;
        this.change("template", this.template, this.#template=v);
    }
    hasTemplate() { return this.template != null; }

    get field() { return this.#field; }
    get theField() { return this.#theField; }
    set field(v) {
        v = (v instanceof THREE.Object3D) ? v : null;
        if (this.field == v) return;
        if (this.hasField()) {
            this.wpilibGroup.remove(this.theField);
            this.#theField = null;
        }
        [v, this.#field] = [this.#field, v];
        if (this.hasField()) {
            this.#theField = this.field._builtin ? this.field : this.field.clone();
            if (!this.field._builtin) this.theField.quaternion.copy(THREE2WPILIB);
            this.wpilibGroup.add(this.theField);
        }
        this.change("field", v, this.field);
        this.requestRedraw();
    }
    hasField() { return !!this.field; }

    updateControls() {
        if (this.controls instanceof OrbitControls) {
            this.controls.dispose();
        } else if (this.controls instanceof PointerLockControls) {
            this.controls.unlock();
            this.controls.disconnect();
        }
        let controlfs = {
            orbit: () => new OrbitControls(this.camera, this.canvas),
            free: () => new PointerLockControls(this.camera, this.canvas),
        };
        this.#controls = (this.controlType in controlfs) ? controlfs[this.controlType]() : null;
        if (this.controls instanceof OrbitControls) {
            this.elem.classList.remove("showinfo");
        } else if (this.controls instanceof PointerLockControls) {
            this.controls.addEventListener("lock", () => this.elem.classList.add("showinfo"));
            this.controls.addEventListener("unlock", () => this.elem.classList.remove("showinfo"));
        }
    }
    get renderType() { return this.#renderType; }
    set renderType(v) {
        v = String(v);
        if (!["proj", "iso"].includes(v)) v = "proj";
        if (this.renderType == v) return;
        [v, this.#renderType] = [this.renderType, v];
        let renderfs;
        renderfs = {
            proj: () => new THREE.PerspectiveCamera(75, 1, 0.1, 1000),
            iso: () => new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000),
        };
        this.#camera = (this.renderType in renderfs) ? renderfs[this.renderType]() : null;
        renderfs = {
            proj: [0, 7.5, -7.5],
            iso: [10, 10, -10],
        };
        this.camera.position.set(...((this.renderType in renderfs) ? renderfs[this.renderType] : [0, 0, 0]));
        this.camera.lookAt(0, 0, 0);
        this.change("renderType", v, this.renderType);
        this.updateControls();
        this.requestRedraw();
    }
    get controlType() { return this.#controlType; }
    set controlType(v) {
        v = String(v);
        if (!["orbit", "free"].includes(v)) v = "orbit";
        if (this.controlType == v) return;
        this.change("controlType", this.controlType, this.#controlType=v);
        this.updateControls();
    }
    get isCinematic() { return this.#isCinematic; }
    set isCinematic(v) {
        v = !!v;
        if (this.isCinematic == v) return;
        this.change("isCinematic", this.isCinematic, this.#isCinematic=v);
    }
    get origin() { return this.#origin; }
    set origin(v) {
        v = String(v);
        if (!["blue+", "blue-", "red+", "red-"].includes(v)) v = "blue+";
        if (this.origin == v) return;
        this.change("origin", this.origin, this.#origin=v);
        this.requestRedraw();
    }
};
Odometry3d.Render = class Odometry3dRender extends util.Target {
    #odometry;
    
    #pos;
    #offset;
    #q;

    #name;
    #color;
    #isGhost;
    #isSolid;
    #display;

    #robot;

    #object;
    #theObject;

    #loadedObjects;
    
    constructor(odometry, pos, name, robot) {
        super();

        if (!(odometry instanceof Odometry3d)) throw new Error("Odometry is not of class Odometry3d");
        this.#odometry = odometry;

        this.#pos = new util.V3();
        this.pos.addHandler("change", (c, f, t) => this.change("pos."+c, f, t));
        this.#offset = new util.V3();
        this.pos.addHandler("change", (c, f, t) => this.change("offset."+c, f, t));
        this.#q = new util.V4();
        this.q.addHandler("change", (c, f, t) => this.change("q."+c, f, t));
        this.addHandler("change", (c, f, t) => this.odometry.requestRedraw());

        this.#name = "";
        this.#color = "";
        this.#isGhost = false;
        this.#isSolid = false;
        this.#display = {};

        this.#robot = null;

        this.#object = null;
        this.#theObject = null;

        this.#loadedObjects = {};
        const node = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        node.castShadow = node.receiveShadow = true;
        this.#loadedObjects["§node"] = node;
        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        cube.castShadow = cube.receiveShadow = true;
        this.#loadedObjects["§cube"] = cube;
        const radius = 0.05, arrowLength = 0.25, arrowRadius = 0.1;
        const arrow = new THREE.Object3D();
        const tip = new THREE.Mesh(
            new THREE.ConeGeometry(arrowRadius, arrowLength, 8),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        arrow.castShadow = arrow.receiveShadow = true;
        tip.position.set(0, (1-arrowLength)/2, 0);
        arrow.add(tip);
        const line = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, 1-arrowLength, 8),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        line.position.set(0, -arrowLength/2, 0);
        arrow.add(line);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                let pobj, obj = arrow.clone();
                [obj, pobj] = [new THREE.Object3D(), obj];
                obj.add(pobj);
                pobj.quaternion.copy(THREE.Quaternion.fromRotationSequence([
                    [
                        [{ axis:"z", angle:-90 }],
                        [{ axis:"z", angle:90 }],
                    ],
                    [
                        [],
                        [{ axis:"z", angle:180 }],
                    ],
                    [
                        [{ axis:"x", angle:90}],
                        [{ axis:"x", angle:-90}],
                    ],
                ][j][i]));
                this.#loadedObjects["§arrow"+"+-"[i]+"xyz"[j]] = obj;
            }
        }
        const axes = new THREE.Object3D();
        axes.castShadow = axes.receiveShadow = true;
        const length = 1;
        const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
        let xAxis, yAxis, zAxis;
        xAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0xff0000 }),
        );
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        axes.xAxis = xAxis;
        yAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0x00ff00 }),
        );
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        axes.yAxis = yAxis;
        zAxis = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ color: 0x0000ff }),
        );
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        axes.zAxis = zAxis;
        this.#loadedObjects["§axes"] = axes;

        let robotLock = false;
        let modelObject = null, theModelObject = null;

        this.addHandler("rem", () => (this.object = null));

        this.addHandler("update", delta => {
            let color = (this.hasColor() && this.color.startsWith("--")) ? PROPERTYCACHE.getColor(this.color) : new util.Color(this.color);
            if (!robotLock)
                (async () => {
                    robotLock = true;
                    theModelObject = (this.hasRobot() && this.robot.startsWith("§")) ? this.#loadedObjects[this.robot] : (await Odometry3d.loadRobot(this.robot, this.odometry.isCinematic ? "cinematic" : "basic"));
                    robotLock = false;
                })();
            if (modelObject != theModelObject) {
                modelObject = theModelObject;
                this.object = modelObject;
                if (this.hasObject()) {
                    let elem = document.createElement("div");
                    this.theObject.add(new CSS2DObject(elem));
                    elem.classList.add("label");
                    elem.innerHTML = "<div><div class='title'></div><div class='info'><div class='pos'></div><div class='dir'></div></div></div>";
                    elem.elem = elem.querySelector(":scope > div");
                    elem.eTitle = elem.querySelector(":scope > div > .title");
                    elem.eInfo = elem.querySelector(":scope > div > .info");
                    elem.ePos = elem.querySelector(":scope > div > .info > .pos");
                    elem.eDir = elem.querySelector(":scope > div > .info > .dir");
                    this.theObject.traverse(obj => {
                        if (!obj.isMesh) return;
                        if (!(obj.material instanceof THREE.Material)) return;
                        obj.material._transparent = obj.material.transparent;
                        obj.material._opacity = obj.material.opacity;
                        obj.material._color = obj.material.color.clone();
                    });
                    this.theObject.isGhost = this.theObject.isSolid = null;
                    this.odometry.requestRedraw();
                }
            }
            if (!this.hasObject()) return;
            if (this.theObject.isGhost != this.isGhost) {
                this.theObject.isGhost = this.isGhost;
                this.theObject.traverse(obj => {
                    if (!obj.isMesh) return;
                    if (!(obj.material instanceof THREE.Material)) return;
                    if (this.isGhost) {
                        obj.material.transparent = true;
                        obj.material.opacity = obj.material._opacity * 0.25;
                    } else {
                        obj.material.transparent = obj.material._transparent;
                        obj.material.opacity = obj.material._opacity;
                    }
                });
            }
            if (this.theObject.isSolid != this.isSolid) {
                this.theObject.isSolid = this.isSolid;
                this.theObject.traverse(obj => {
                    if (!obj.isMesh) return;
                    if (!(obj.material instanceof THREE.Material)) return;
                    if (this.isSolid) {
                        obj.material.color.set(color.toHex(false));
                    } else {
                        obj.material.color.set(obj.material._color);
                    }
                });
            }
            let r = this.odometry.canvas.getBoundingClientRect();
            this.theObject.position.set(
                this.x + this.offsetX/100,
                this.y + this.offsetY/100,
                this.z + this.offsetZ/100,
            );
            this.theObject.quaternion.set(this.qx, this.qy, this.qz, this.qw);
            let hovered = false;
            let css2dObjects = [];
            this.theObject.traverse(obj => {
                if (obj instanceof CSS2DObject)
                    css2dObjects.push(obj);
                if (this.odometry.raycastIntersections[0])
                    if (obj == this.odometry.raycastIntersections[0].object)
                        hovered = true;
                if (!obj.isMesh) return;
                if (!this.hasRobot()) return;
                if (!this.robot.startsWith("§")) return;
                if (this.robot == "§axes") return;
                obj.material.color.set(color.toHex(false));
            });
            css2dObjects.forEach(obj => {
                obj.element.style.visibility = hovered ? "" : "hidden";
                if (!hovered) return;
                let r2 = obj.element.getBoundingClientRect();
                let x = 1, y = 1;
                if (r2.right > r.right) x *= -1;
                if (r2.bottom > r.bottom) y *= -1;
                obj.element.elem.style.transform = "translate("+(50*x)+"%, "+(50*y)+"%)";
                obj.element.eTitle.style.color = color.toRGBA();
                obj.element.eTitle.textContent = this.name;
                let type = this.display.type;
                let data = util.ensure(this.display.data, "arr");
                if (type == 7) {
                    while (obj.element.ePos.children.length < 3) obj.element.ePos.appendChild(document.createElement("div"));
                    while (obj.element.ePos.children.length > 3) obj.element.ePos.removeChild(obj.element.ePos.lastChild);
                    while (obj.element.eDir.children.length < 4) obj.element.eDir.appendChild(document.createElement("div"));
                    while (obj.element.eDir.children.length > 4) obj.element.eDir.removeChild(obj.element.eDir.lastChild);
                    for (let i = 0; i < 3; i++) obj.element.ePos.children[i].textContent = data[i];
                    for (let i = 0; i < 4; i++) obj.element.eDir.children[i].textContent = "wxyz"[i]+": "+data[3+i];
                } else if (type == 3) {
                    while (obj.element.ePos.children.length < 2) obj.element.ePos.appendChild(document.createElement("div"));
                    while (obj.element.ePos.children.length > 2) obj.element.ePos.removeChild(obj.element.ePos.lastChild);
                    while (obj.element.eDir.children.length < 1) obj.element.eDir.appendChild(document.createElement("div"));
                    while (obj.element.eDir.children.length > 1) obj.element.eDir.removeChild(obj.element.eDir.lastChild);
                    for (let i = 0; i < 2; i++) obj.element.ePos.children[i].textContent = data[i];
                    for (let i = 0; i < 1; i++) obj.element.eDir.children[i].textContent = "d"[i]+": "+data[2+i];
                } else {
                    while (obj.element.ePos.children.length > 0) obj.element.ePos.removeChild(obj.element.ePos.lastChild);
                    while (obj.element.eDir.children.length > 0) obj.element.eDir.removeChild(obj.element.eDir.lastChild);
                }
            });
        });

        this.pos = pos;

        this.name = name;

        this.robot = robot;
    }

    get odometry() { return this.#odometry; }

    get pos() { return this.#pos; }
    set pos(v) { this.#pos.set(v); }
    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }
    get z() { return this.pos.z; }
    set z(v) { this.pos.z = v; }

    get offset() { return this.#offset; }
    set offset(v) { this.#offset.set(v); }
    get offsetX() { return this.offset.x; }
    set offsetX(v) { this.offset.x = v; }
    get offsetY() { return this.offset.y; }
    set offsetY(v) { this.offset.y = v; }
    get offsetZ() { return this.offset.z; }
    set offsetZ(v) { this.offset.z = v; }

    get q() { return this.#q; }
    set q(v) { this.q.set(v); }
    get qw() { return this.q.w; }
    set qw(v) { this.q.w = v; }
    get qx() { return this.q.x; }
    set qx(v) { this.q.x = v; }
    get qy() { return this.q.y; }
    set qy(v) { this.q.y = v; }
    get qz() { return this.q.z; }
    set qz(v) { this.q.z = v; }
    
    get name() { return this.#name; }
    set name(v) { this.#name = String(v); }
    get color() { return this.#color; }
    set color(v) {
        v = (v == null) ? null : String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
    }
    hasColor() { return this.color != null; }

    get isGhost() { return this.#isGhost; }
    set isGhost(v) {
        v = !!v;
        if (this.isGhost == v) return;
        this.change("isGhost", this.isGhost, this.#isGhost=v);
    }
    get isSolid() { return this.#isSolid; }
    set isSolid(v) {
        v = !!v;
        if (this.isSolid == v) return;
        this.change("isSolid", this.isSolid, this.#isSolid=v);
    }

    get display() { return this.#display; }
    set display(v) { this.#display = util.ensure(v, "obj"); }

    get robot() { return this.#robot; }
    set robot(v) {
        v = (v == null) ? null : String(v);
        if (this.robot == v) return;
        this.change("robot", this.robot, this.#robot=v);
    }
    hasRobot() { return this.robot != null; }

    get object() { return this.#object; }
    get theObject() { return this.#theObject; }
    set object(v) {
        v = (v instanceof THREE.Object3D) ? v : null;
        if (this.object == v) return;
        if (this.hasObject()) {
            this.odometry.wpilibGroup.remove(this.theObject);
            this.theObject.traverse(obj => {
                if (obj instanceof CSS2DObject)
                    obj.removeFromParent();
                if (!obj.isMesh) return;
                obj.geometry.dispose();
                obj.material.dispose();
            });
            this.#theObject = null;
        }
        this.#object = v;
        if (this.hasObject()) {
            this.#theObject = this.object.clone();
            this.theObject.traverse(obj => {
                if (!obj.isMesh) return;
                if (!(obj.material instanceof THREE.Material)) return;
                obj.material = obj.material.clone();
            });
            this.odometry.wpilibGroup.add(this.theObject);
        }
        this.odometry.requestRedraw();
    }
    hasObject() { return !!this.object; }

    update(delta) { this.post("update", delta); }
};

export class Parallax extends util.Target {
    #canvas;
    #quality;
    #size;
    #run;
    #type;

    #scene;
    #camera;

    #renderer;

    #speed;

    constructor(canvas) {
        super();

        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Canvas is not of class HTMLCanvasElement");
        this.#canvas = canvas;
        this.#quality = 2;
        this.#size = new V(300, 150);
        this.size.addHandler("change", (c, f, t) => this.change("size."+c, f, t));
        this.#run = 1;
        this.#type = null;

        this.#scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 7.5, 10);
        this.#camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

        this.#renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, powerPreference: "default" });

        const hemLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
        this.scene.add(hemLight);

        const specks = [];

        let spawn = 0;

        const update = () => {
            const w = Math.max(0, Math.ceil(this.w));
            const h = Math.max(0, Math.ceil(this.h));
            this.renderer.setSize(w, h);
            this.renderer.setPixelRatio(this.quality);
            if (this.camera.aspect != w/h) {
                this.camera.aspect = w/h;
                this.camera.updateProjectionMatrix();
            }
        };
        new ResizeObserver(update).observe(this.canvas.parentElement);
        this.addHandler("change-quality", update);
        this.addHandler("change-size.x", update);
        this.addHandler("change-size.y", update);
        update();

        this.#speed = 0;

        this.addHandler("update", delta => {
            const height = 2 * Math.tan((this.camera.fov*(Math.PI/180))/2) * this.camera.near;
            const width = height * this.camera.aspect;

            for (let i = 0; i < this.run; i++) {
                if (specks.length < 1000) {
                    while (spawn < 0) {
                        if (this.type == "july4") {
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
                                const speck = new Parallax.Speck(
                                    Math.floor(Parallax.Speck.materials.length*Math.random()),
                                    util.choose(radii), 0,
                                );
                                speck.object.position.set(...pos.xyz);
                                [speck.velX, speck.velY, speck.velZ] = mag.mul(util.lerp(0.05, 0.15, Math.random())).xyz;
                                this.scene.add(speck.object);
                                specks.push(speck);
                                speck.addHandler("update", delta => {
                                    speck.velY -= 0.001;
                                    if (
                                        Math.abs(speck.object.position.x) <= +15 &&
                                        Math.abs(speck.object.position.y) <= +15 &&
                                        Math.abs(speck.object.position.z) <= +15
                                    ) return;
                                    specks.splice(specks.indexOf(speck), 1);
                                    this.scene.remove(speck.object);
                                });
                            }
                        } else {
                            spawn += util.lerp(0.01, 0.1, Math.random());
                            let radii = [0.02, 0.015, 0.01];
                            const speck = new Parallax.Speck(
                                Math.floor(Parallax.Speck.materials.length*Math.random()),
                                util.choose(radii), 0,
                            );
                            let pos;
                            do {
                                pos = new V(Math.random(), Math.random()).map(v => util.lerp(-15, +15, v));
                            } while (Math.abs(pos.x) < width && Math.abs(pos.y) < height);
                            speck.object.position.set(pos.x, pos.y, -15);
                            this.scene.add(speck.object);
                            specks.push(speck);
                            speck.addHandler("update", delta => {
                                speck.velX = speck.velY = speck.velZ = 0;
                                speck.cvelX = speck.cvelY = 0;
                                speck.cvelZ = this.speed;
                                if (
                                    Math.abs(speck.object.position.x) <= +15 &&
                                    Math.abs(speck.object.position.y) <= +15 &&
                                    Math.abs(speck.object.position.z) <= +15
                                ) return;
                                specks.splice(specks.indexOf(speck), 1);
                                this.scene.remove(speck.object);
                            });
                        }
                    }
                    if (this.type == "july4") spawn -= 0.1;
                    else spawn -= 2*this.speed;
                }
                [...specks].forEach(speck => speck.update(delta));
            }

            let colorW = PROPERTYCACHE.getColor("--v8");
            let colorA = PROPERTYCACHE.getColor("--a");
            let colorV = PROPERTYCACHE.getColor("--v2");
            Parallax.Speck.materials[0].color.set(colorW.toHex(false));
            Parallax.Speck.materials[1].color.set(colorA.toHex(false));
            this.scene.fog.color.set(colorV.toHex(false));
            
            this.renderer.render(this.scene, this.camera);
        });
    }

    get canvas() { return this.#canvas; }
    get quality() { return this.#quality; }
    set quality(v) {
        v = Math.max(1, util.ensure(v, "int"));
        if (this.quality == v) return;
        this.change("quality", this.quality, this.#quality=v);
    }
    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }
    get run() { return this.#run; }
    set run(v) {
        v = Math.max(0, util.ensure(v, "int"));
        if (this.run == v) return;
        this.change("run", this.run, this.#run=v);
    }
    get type() { return this.#type; }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
    }
    hasType() { return this.type != null; }

    get scene() { return this.#scene; }
    get camera() { return this.#camera; }

    get renderer() { return this.#renderer; }

    get speed() { return this.#speed; }
    set speed(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.speed == v) return;
        this.change("speed", this.speed, this.#speed=v);
    }

    update(delta) { this.post("update", delta); }
}
Parallax.Speck = class ParallaxSpeck extends util.Target {
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
        if (!(this.r in Parallax.Speck.sphereGeometryCache))
            Parallax.Speck.sphereGeometryCache[this.r] = new THREE.SphereGeometry(this.r, 8, 8);
        if (!(this.r in Parallax.Speck.cylinderGeometryCache))
            Parallax.Speck.cylinderGeometryCache[this.r] = {};
        if (!(this.l in Parallax.Speck.cylinderGeometryCache[this.r]))
            Parallax.Speck.cylinderGeometryCache[this.r][this.l] = new THREE.CylinderGeometry(this.r, this.r, this.l, 8, 1, true);
        this.#sphereGeometry = Parallax.Speck.sphereGeometryCache[this.r];
        this.#cylinderGeometry = Parallax.Speck.cylinderGeometryCache[this.r][this.l];
        this.#material = Parallax.Speck.materials[this.type];
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
        v = Math.min(Parallax.Speck.materials.length-1, Math.max(0, util.ensure(v, "int")));
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

export class Explorer extends util.Target {
    #nodes;
    #nodeKeys;
    #nodeObjects;

    #elem;

    static SORT = false;

    constructor() {
        super();

        this.#nodes = {};
        this.#nodeKeys = [];
        this.#nodeObjects = [];

        this.#elem = document.createElement("div");
        this.elem.classList.add("explorer");
    }

    get nodes() { return [...this.#nodeKeys]; }
    get nodeObjects() { return [...this.#nodeObjects]; }
    get nNodes() {
        let n = 1;
        this.nodeObjects.forEach(node => (n += node.explorer.nNodes));
        return n;
    }
    clear() {
        let nodes = this.nodeObjects;
        this.rem(nodes);
        return nodes;
    }
    has(v) {
        if (v instanceof Explorer.Node) return this.has(v.name) && this.nodeObjects.includes(v);
        return v in this.#nodes;
    }
    get(name) {
        if (!this.has(name)) return null;
        return this.#nodes[name];
    }
    add(...nodes) {
        let r = util.Target.resultingForEach(nodes, node => {
            if (!(node instanceof Explorer.Node)) return false;
            if (this.has(node)) return false;
            this.#nodes[node.name] = node;
            this.#nodeKeys.push(node.name);
            this.#nodeObjects.push(node);
            node.addLinkedHandler(this, "trigger", (e, path) => this.post("trigger", e, path));
            node.addLinkedHandler(this, "trigger2", (e, path) => this.post("trigger2", e, path));
            node.addLinkedHandler(this, "contextmenu", (e, path) => this.post("contextmenu", e, path));
            node.addLinkedHandler(this, "drag", (e, path) => this.post("drag", e, path));
            this.elem.appendChild(node.elem);
            node.onAdd();
            return node;
        });
        this.format();
        return r;
    }
    rem(...nodes) {
        let r = util.Target.resultingForEach(nodes, node => {
            if (!(node instanceof Explorer.Node)) return false;
            if (!this.has(node)) return false;
            node.onRem();
            delete this.#nodes[node.name];
            this.#nodeKeys.splice(this.#nodeKeys.indexOf(node.name), 1);
            this.#nodeObjects.splice(this.#nodeObjects.indexOf(node), 1);
            node.clearLinkedHandlers(this, "trigger");
            node.clearLinkedHandlers(this, "drag");
            this.elem.removeChild(node.elem);
            return node;
        });
        this.format();
        return r;
    }
    lookup(path) {
        path = util.generateArrayPath(path);
        let explorer = this;
        while (path.length > 0) {
            let name = path.shift();
            if (!explorer.has(name)) return null;
            let node = explorer.get(name);
            if (path.length <= 0) return node;
            explorer = node.explorer;
        }
        return null;
    }

    get elem() { return this.#elem; }

    format() {
        if (this.constructor.SORT) this.#nodeObjects.sort((a, b) => util.compareStr(a.name, b.name));
        this.#nodeObjects.forEach((node, i) => {
            node.elem.style.order = i;
            node.format();
        });
        this.#nodeKeys = this.#nodeObjects.map(node => node.name);
    }
}
Explorer.Node = class ExplorerNode extends util.Target {
    #explorer;

    #name;
    #isHidden;
    #info;
    #value;
    #showValue;

    #elem;
    #eDisplay;
    #eTooltip;
    #eMain;
    #eIcon;
    #eName;
    #eTag;
    #eValueBox;
    #eValue;
    #eSide;

    static doubleTraverse(nodeArr, enodeArr, addFunc, remFunc, dumpFunc=null) {
        let nodeMap = {}, enodeMap = {};
        util.ensure(nodeArr, "arr").forEach(node => {
            if (!node) return;
            nodeMap[node.name] = node;
        });
        util.ensure(enodeArr, "arr").forEach(enode => {
            if (!(enode instanceof this)) return;
            enodeMap[enode.name] = enode;
        });
        let add = [];
        for (let name in nodeMap) {
            let node = nodeMap[name];
            if (name in enodeMap) continue;
            let enode = enodeMap[node.name] = new this(node.name, node.info);
            add.push(enode);
        }
        if (util.is(addFunc, "func")) addFunc(...add);
        let rem = [];
        for (let name in enodeMap) {
            let enode = enodeMap[name];
            if (name in nodeMap) continue;
            rem.push(enode);
        }
        if (util.is(remFunc, "func")) remFunc(...rem);
        for (let name in nodeMap) {
            let node = nodeMap[name];
            let enode = enodeMap[name];
            if (enode.isOpen)
                this.doubleTraverse(
                    node.nodeObjects,
                    enode.explorer.nodeObjects,
                    (...en) => enode.explorer.add(...en),
                    (...en) => enode.explorer.rem(...en),
                    dumpFunc,
                );
            enode.value = node.value;
            enode.tooltip = node.tooltip;
            if (util.is(node.dump, "func")) node.dump(enode);
            if (util.is(dumpFunc, "func")) dumpFunc(node, enode);
        }
    }

    constructor(name, info) {
        super();

        this.#explorer = new Explorer();
        this.explorer.addHandler("trigger", (e, path) => {
            path = util.generatePath(path);
            if (this.name.length > 0) path = this.name+"/"+path;
            this.post("trigger", e, path);
        });
        this.explorer.addHandler("trigger2", (e, path) => {
            path = util.generatePath(path);
            if (this.name.length > 0) path = this.name+"/"+path;
            this.post("trigger2", e, path);
        });
        this.explorer.addHandler("contextmenu", (e, path) => {
            path = util.generatePath(path);
            if (this.name.length > 0) path = this.name+"/"+path;
            this.post("contextmenu", e, path);
        });
        this.explorer.addHandler("drag", (e, path) => {
            path = util.generatePath(path);
            if (this.name.length > 0) path = this.name+"/"+path;
            this.post("drag", e, path);
        });

        this.#name = String(name);
        this.#isHidden = this.name.startsWith(".");
        this.#info = (info == null) ? null : String(info);
        this.#value = null;

        this.#showValue = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("node");
        if (this.isHidden) this.elem.classList.add("hidden");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.eDisplay.innerHTML = "<div class='tooltip tog swx'></div>";
        let enterId = null, leaveId = null;
        this.eDisplay.addEventListener("mouseenter", e => {
            clearTimeout(enterId);
            clearTimeout(leaveId);
            enterId = setTimeout(() => {
                this.eDisplay.classList.add("active");
            }, 2000);
        });
        this.eDisplay.addEventListener("mouseleave", e => {
            clearTimeout(enterId);
            clearTimeout(leaveId);
            leaveId = setTimeout(() => {
                this.eDisplay.classList.remove("active");
            }, 100);
        });
        this.#eTooltip = this.eDisplay.children[0];
        this.#eMain = document.createElement("div");
        this.eDisplay.appendChild(this.eMain);
        this.eMain.classList.add("main");
        this.#eIcon = document.createElement("ion-icon");
        this.eMain.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.eMain.appendChild(this.eName);
        this.eName.classList.add("name");
        this.eName.textContent = this.name;
        this.#eTag = document.createElement("div");
        this.eMain.appendChild(this.eTag);
        this.eTag.classList.add("tag");
        this.eTag.textContent = util.ensure(this.info, "str");
        this.#eValueBox = document.createElement("div");
        this.eDisplay.appendChild(this.eValueBox);
        this.eValueBox.classList.add("value");
        this.eValueBox.innerHTML = "<ion-icon name='return-down-forward'></ion-icon>";
        this.#eValue = document.createElement("div");
        this.eValueBox.appendChild(this.eValue);
        this.elem.appendChild(this.explorer.elem);
        this.#eSide = document.createElement("button");
        this.explorer.elem.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.eSide.classList.add("override");

        let cancel = 10;
        this.eDisplay.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            this.post("trigger", e, [this.name]);
        });
        this.eDisplay.addEventListener("dblclick", e => {
            this.post("trigger2", e, this.name);
        });
        this.eDisplay.addEventListener("contextmenu", e => {
            this.post("contextmenu", e, this.name);
        });
        this.eDisplay.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                if (cancel > 0) return cancel--;
                mouseup();
                this.post("drag", e, [this.name]);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.eSide.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        this.showValue = false;
    }

    get explorer() { return this.#explorer; }

    get name() { return this.#name; }
    get isHidden() { return this.#isHidden; }

    get info() { return this.#info; }

    get value() { return this.#value; }
    set value(v) {
        this.#value = v;
        this.updateDisplay();
    }

    lookup(path) {
        path = util.generateArrayPath(path);
        if (path.length <= 0) return this;
        return this.explorer.lookup(path);
    }

    get showValue() { return this.#showValue; }
    set showValue(v) {
        v = !!v;
        if (this.showValue == v) return;
        this.#showValue = v;
        if (this.showValue) this.eValueBox.classList.add("this");
        else this.eValueBox.classList.remove("this");
        this.updateDisplay();
    }
    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eTooltip() { return this.#eTooltip; }
    get eMain() { return this.#eMain; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get eTag() { return this.#eTag; }
    get eValueBox() { return this.#eValueBox; }
    get eValue() { return this.#eValue; }
    get eSide() { return this.#eSide; }

    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) { this.eIcon.setAttribute("src", v); }
    updateDisplay() {
        if (this.showValue) this.eValue.textContent = this.value;
    }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
        this.updateDisplay();
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get tooltip() { return this.eTooltip.innerHTML; }
    set tooltip(v) { this.eTooltip.innerHTML = (v == null) ? "" : String(v).replaceAll("<", "&lt").replaceAll(">", "&gt"); }

    format() {
        this.updateDisplay();
        this.explorer.format();
    }
}

export class Form extends util.Target {
    #fields;

    #elem;
    
    constructor() {
        super();

        this.#fields = [];

        this.#elem = document.createElement("div");
        this.elem.classList.add("form");

        this.isShown = true;
    }

    get fields() { return [...this.#fields]; }
    set fields(v) {
        v = util.ensure(v, "arr");
        this.clearFields();
        this.addField(v);
    }
    hasField(field) {
        if (util.is(field, "str")) return !!this.getField(field);
        if (!(field instanceof Form.Field)) return false;
        return this.#fields.includes(field);
    }
    getField(name) {
        for (let field of this.#fields)
            if (field.name == name)
                return field;
        return null;
    }
    addField(...fields) {
        return util.Target.resultingForEach(fields, field => {
            if (!(field instanceof Form.Field)) return false;
            if (this.hasField(field)) return false;
            this.#fields.push(field);
            this.elem.appendChild(field.elem);
            return field;
        });
    }
    remField(...fields) {
        return util.Target.resultingForEach(fields, field => {
            if (!(field instanceof Form.Field)) field = this.getField(field);
            if (!this.hasField(field)) return false;
            this.#fields.splice(this.#fields.indexOf(field), 1);
            this.elem.removeChild(field.elem);
            return field;
        });
    }

    get elem() { return this.#elem; }

    get side() {
        if (this.elem.classList.contains("right")) return "right";
        if (this.elem.classList.contains("center")) return "center";
        return "left";
    }
    set side(v) {
        v = String(v);
        this.elem.classList.remove("right");
        this.elem.classList.remove("center");
        if (v == "left") return;
        if (!["right", "center"].includes(v)) return;
        this.elem.classList.add(v);
    }

    get isShown() { return this.elem.classList.contains("show"); }
    set isShown(v) {
        if (v) this.elem.classList.add("show");
        else this.elem.classList.remove("show");
    }
}
Form.Field = class FormField extends util.Target {
    #name;

    #toggleOn;

    #elem;
    #eHeader;
    #eName;
    #eType;
    #eToggle;
    #eToggleInput;
    #eContent;

    constructor(name) {
        super();

        this.#name = String(name);

        this.#toggleOn = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eHeader = document.createElement("div");
        this.elem.appendChild(this.eHeader);
        this.eHeader.classList.add("header");
        this.#eName = document.createElement("div");
        this.eHeader.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eType = document.createElement("div");
        this.eHeader.appendChild(this.eType);
        this.eType.classList.add("type");
        this.#eToggle = document.createElement("label");
        this.eHeader.appendChild(this.eToggle);
        this.eToggle.classList.add("switch");
        this.eToggle.innerHTML = "<input type='checkbox'><span><ion-icon name='checkmark'></ion-icon></span>";
        this.#eToggleInput = this.eToggle.children[0];
        this.eToggleInput.addEventListener("change", e => (this.toggleOn = this.eToggleInput.checked));
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.addHandler("change-toggleOn", () => (this.eToggleInput.checked = this.toggleOn));

        this.isShown = this.showHeader = this.showContent = true;
        this.showToggle = false;
        this.isSwitch = true;
        this.toggleOn = false;
        this.isSubHeader = true;
        this.header = util.formatText(this.name);
        this.type = "";
    }

    get name() { return this.#name; }

    get toggleOn() { return this.#toggleOn; }
    set toggleOn(v) {
        v = !!v;
        if (this.toggleOn == v) return;
        this.change("toggleOn", this.toggleOn, this.#toggleOn=v);
    }
    get toggleOff() { return !this.toggleOn; }
    set toggleOff(v) { this.toggleOn = !v; }

    get elem() { return this.#elem; }
    get eHeader() { return this.#eHeader; }
    get eName() { return this.#eName; }
    get eType() { return this.#eType; }
    get eToggle() { return this.#eToggle; }
    get eToggleInput() { return this.#eToggleInput; }
    get eContent() { return this.#eContent; }

    get isHorizontal() { return this.elem.classList.contains("horizontal"); }
    set isHorizontal(v) {
        if (v) this.elem.classList.add("horizontal");
        else this.elem.classList.remove("horizontal");
    }
    get isVertical() { return !this.isHorizontal; }
    set isVertical(v) { this.isHorizontal = !v; }

    get isShown() { return this.elem.classList.contains("show"); }
    set isShown(v) {
        if (v) this.elem.classList.add("show");
        else this.elem.classList.remove("show");
    }
    get isHidden() { return !this.isShown; }
    set isHidden(v) { this.isShown = !v; }
    get showHeader() { return this.eHeader.classList.contains("show"); }
    set showHeader(v) {
        if (v) this.eHeader.classList.add("show");
        else this.eHeader.classList.remove("show");
    }
    get showToggle() { return this.eToggle.classList.contains("show"); }
    set showToggle(v) {
        if (v) this.eToggle.classList.add("show");
        else this.eToggle.classList.remove("show");
    }
    get showContent() { return this.eContent.classList.contains("show"); }
    set showContent(v) {
        if (v) this.eContent.classList.add("show");
        else this.eContent.classList.remove("show");
    }

    get header() { return this.eName.textContent; }
    set header(v) { this.eName.textContent = v; }
    get isSubHeader() { return this.eHeader.classList.contains("sub"); }
    set isSubHeader(v) {
        if (v) this.eHeader.classList.add("sub");
        else this.eHeader.classList.remove("sub");
    }

    get isSwitch() { return this.eToggle.classList.contains("switch"); }
    set isSwitch(v) {
        if (v) {
            this.eToggle.classList.add("switch");
            this.eToggle.classList.remove("checkbox");
        } else {
            this.eToggle.classList.remove("switch");
            this.eToggle.classList.add("checkbox");
        }
    }
    get isCheckbox() { return !this.isSwitch; }
    set isCheckbox(v) { this.isSwitch = !v; }

    get type() { return this.eType.textContent; }
    set type(v) { this.eType.textContent = v; }

    get toggleDisabled() { return this.eToggleInput.disabled; }
    set toggleDisabled(v) { this.eToggleInput.disabled = v; }
};
Form.Header = class FormHeader extends Form.Field {
    constructor(name) {
        super("§");

        this.showContent = false;
        this.header = name;
        this.isSubHeader = false;
    }
};
Form.SubHeader = class FormHeader extends Form.Field {
    constructor(name) {
        super("§");

        this.showContent = false;
        this.header = name;
        this.isSubHeader = true;
    }
};
Form.GenericInput = class FormGenericInput extends Form.Field {
    #inputs;

    constructor(name, n) {
        super(name);

        this.#inputs = [];

        this.elem.classList.add("input");

        this.n = n;
    }

    get n() { return this.#inputs.length; }
    set n(v) {
        v = Math.max(0, util.ensure(v, "int"));
        if (this.n == v) return;
        this.unhook();
        this.#inputs.forEach(inp => inp.remove());
        for (let i = 0; i < v; i++) {
            let inp = document.createElement("input");
            this.eContent.appendChild(inp);
            this.#inputs.push(inp);
        }
        this.hook();
        this.apply();
    }
    get inputs() { return [...this.#inputs]; }

    unhook() {}
    hook() {}
    apply() {}

    unhookSingle(inp) {
        if (!(inp instanceof HTMLInputElement)) return false;
        inp.removeEventListener("change", inp.change);
        return true;
    }
    hookSingle(inp, f) {
        if (!(inp instanceof HTMLInputElement)) return false;
        if (!util.is(f, "func")) return false;
        Object.defineProperty(inp, "change", { value: f, writable: false });
        inp.addEventListener("change", inp.change);
        return true;
    }

    get disabled() {
        for (let inp of this.#inputs)
            if (inp.disabled)
                return true;
        return false;
    }
    set disabled(v) {
        this.#inputs.forEach(inp => (inp.disabled = !!v));
    }
};
Form.NumberInput = class FormNumberInput extends Form.GenericInput {
    #app;

    #step;

    #types;
    #baseType;
    #activeType;

    #eTypeBtn;

    constructor(name, n) {
        super(name, n);

        this.#app = null;

        this.#step = 0;

        this.#types = new Set();
        this.#baseType = null;
        this.#activeType = null;

        this.step = null;

        this.types = ["#"];
        this.baseType = "#";
        this.activeType = "#";
    }

    get app() { return this.#app; }
    set app(v) {
        v = (v instanceof App) ? v : null;
        if (this.app == v) return;
        this.#app = v;
    }
    hasApp() { return !!this.app; }

    get step() { return this.#step; }
    set step(v) {
        v = (v == null) ? null : Math.max(0, util.ensure(v, "num"));
        if (this.step == v) return;
        this.#step = v;
        this.apply();
    }
    hasStep() { return this.step != null; }

    get types() { return [...this.#types]; }
    set types(v) {
        v = util.ensure(v, "arr");
        this.clearTypes();
        this.addType(v);
    }
    clearTypes() {
        let types = this.types;
        this.remType(types);
        return types;
    }
    hasType(type) { return this.#types.has(String(type)); }
    addType(...types) {
        let r = util.Target.resultingForEach(types, type => {
            type = String(type);
            this.#types.add(type);
            return type;
        });
        this.applyType();
        return r;
    }
    remType(...types) {
        let r = util.Target.resultingForEach(types, type => {
            type = String(type);
            this.#types.delete(type);
            return type;
        });
        this.applyType();
        return r;
    }
    get baseType() { return this.#baseType; }
    set baseType(v) {
        v = String(v);
        if (this.baseType == v) return;
        this.#baseType = v;
        this.apply();
    }
    get activeType() { return this.#activeType; }
    set activeType(v) {
        v = String(v);
        if (this.activeType == v) return;
        this.#activeType = v;
        this.applyType();
        this.apply();
    }

    apply() {
        super.apply();
        try {
            this.inputs.forEach(inp => {
                inp.type = "number";
                if (this.hasStep()) inp.step = this.step;
                else inp.removeAttribute("step");
            });
        } catch (e) {}
    }
    applyType() {
        this.eType.innerHTML = "";
        this.#eTypeBtn = document.createElement("button");
        this.eType.appendChild(this.eTypeBtn);
        this.eTypeBtn.classList.add("normal");
        this.eTypeBtn.textContent = this.activeType;
        this.eTypeBtn.addEventListener("click", e => {
            if (!this.hasApp()) return;
            e.stopPropagation();
            let itm;
            let menu = new App.Menu();
            this.types.forEach(data => {
                itm = menu.addItem(new App.Menu.Item(
                    util.is(data, "obj") ? data.name : data,
                    (util.is(data, "obj") ? data.value : data) == this.activeType ? "checkmark" : "",
                ));
                itm.addHandler("trigger", e => (this.activeType = (util.is(data, "obj") ? data.value : data)));
            });
            this.app.contextMenu = menu;
            let r = this.eTypeBtn.getBoundingClientRect();
            this.app.placeContextMenu(r.left, r.bottom);
            menu.elem.style.minWidth = r.width+"px";
        });
    }
    fix(v) { return Math.round(util.ensure(v, "num")*1000000)/1000000; }

    get eTypeBtn() { return this.#eTypeBtn; }

    get typeDisabled() { return this.eTypeBtn.disabled; }
    set typeDisabled(v) { this.eTypeBtn.disabled = v; }
};
Form.Input1d = class FormInput1d extends Form.NumberInput {
    #value;

    constructor(name, value) {
        super(name, 1);

        this.#value = 0;

        this.addHandler("change-value", () => this.apply());

        this.value = value;

        this.apply();
    }

    unhook() {
        super.unhook();
        this.inputs.forEach(inp => this.unhookSingle(inp));
    }
    hook() {
        super.hook();
        this.inputs.forEach(inp => {
            this.hookSingle(inp, () => {
                if (inp.value.length <= 0) return this.apply();
                this.value = util.Unit.convert(parseFloat(inp.value), this.activeType, this.baseType);
            });
        });
    }
    apply() {
        super.apply();
        try {
            this.inputs.forEach(inp => {
                inp.value = this.hasValue() ? this.fix(util.Unit.convert(this.value, this.baseType, this.activeType)) : "";
            });
        } catch (e) {}
    }

    get value() { return this.#value; }
    set value(v) {
        v = (v == null) ? null : util.ensure(v, "num");
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
    }
    hasValue() { return this.value != null; }
};
Form.Input2d = class FormInput2d extends Form.NumberInput {
    #value;
    #hasValue;

    constructor(name, value) {
        super(name, 2);

        this.#value = new V();
        this.value.addHandler("change", (c, f, t) => {
            this.setHasValue(c, true);
            this.apply();
            this.change("value", null, this.value);
        });
        this.#hasValue = new V();

        this.value = value;

        this.apply();
    }

    unhook() {
        super.unhook();
        this.inputs.forEach(inp => this.unhookSingle(inp));
    }
    hook() {
        super.hook();
        this.inputs.forEach((inp, i) => {
            this.hookSingle(inp, () => {
                if (inp.value.length <= 0) return this.apply();
                this["xy"[i]] = util.Unit.convert(parseFloat(inp.value), this.activeType, this.baseType);
            });
        });
    }
    apply() {
        super.apply();
        try {
            this.inputs.forEach((inp, i) => {
                inp.value = this.hasValue("xy"[i]) ? this.fix(util.Unit.convert(this["xy"[i]], this.baseType, this.activeType)) : "";
            });
        } catch (e) {}
    }

    get value() { return this.#value; }
    set value(v) {
        if (v != null) this.#value.set(v);
        this.setHasValue("x", v != null);
        this.setHasValue("y", v != null);
    }
    setHasValue(k, v) {
        if (!["x", "y"].includes(k)) return false;
        if (this.#hasValue[k] == +!!v) return true;
        this.#hasValue[k] = +!!v;
        this.apply();
        this.change("value", null, this.value);
        return true;
    }
    hasValue(k) {
        if (arguments.length == 0) {
            for (let k of ["x", "y"])
                if (this.hasValue(k))
                    return true;
            return false;
        }
        if (!["x", "y"].includes(k)) return false;
        return !!this.#hasValue[k];
    }
    get x() { return this.value.x; }
    set x(v) {
        if (v != null) this.value.x = v;
        this.setHasValue("x", v != null);
    }
    get y() { return this.value.y; }
    set y(v) {
        if (v != null) this.value.y = v;
        this.setHasValue("y", v != null);
    }
};
Form.Input3d = class FormInput3d extends Form.NumberInput {
    #value;
    #hasValue;

    constructor(name, value) {
        super(name, 3);

        this.#value = new util.V3();
        this.value.addHandler("change", (c, f, t) => {
            this.setHasValue(c, true);
            this.apply();
            this.change("value", null, this.value);
        });
        this.#hasValue = new util.V3();

        this.value = value;

        this.apply();
    }

    unhook() {
        super.unhook();
        this.inputs.forEach(inp => this.unhookSingle(inp));
    }
    hook() {
        super.hook();
        this.inputs.forEach((inp, i) => {
            this.hookSingle(inp, () => {
                if (inp.value.length <= 0) return this.apply();
                this["xyz"[i]] = util.Unit.convert(parseFloat(inp.value), this.activeType, this.baseType);
            });
        });
    }
    apply() {
        super.apply();
        try {
            this.inputs.forEach((inp, i) => {
                inp.value = this.hasValue("xyz"[i]) ? this.fix(util.Unit.convert(this["xyz"[i]], this.baseType, this.activeType)) : "";
            });
        } catch (e) {}
    }

    get value() { return this.#value; }
    set value(v) {
        if (v != null) this.#value.set(v);
        this.setHasValue("x", v != null);
        this.setHasValue("y", v != null);
        this.setHasValue("z", v != null);
    }
    setHasValue(k, v) {
        if (!["x", "y", "z"].includes(k)) return false;
        this.#hasValue[k] = +!!v;
        if (this.#hasValue[k] == +!!v) return true;
        this.apply();
        this.change("value", null, this.value);
        return true;
    }
    hasValue(k) {
        if (arguments.length == 0) {
            for (let k of ["x", "y", "z"])
                if (this.hasValue(k))
                    return true;
            return false;
        }
        if (!["x", "y", "z"].includes(k)) return false;
        return !!this.#hasValue[k];
    }
    get x() { return this.value.x; }
    set x(v) {
        if (v != null) this.value.x = v;
        this.setHasValue("x", v != null);
    }
    get y() { return this.value.y; }
    set y(v) {
        if (v != null) this.value.y = v;
        this.setHasValue("y", v != null);
    }
    get z() { return this.value.z; }
    set z(v) {
        if (v != null) this.value.z = v;
        this.setHasValue("z", v != null);
    }
};
Form.TextInput = class FormTextInput extends Form.GenericInput {
    #value;

    constructor(name) {
        super(name, 1);

        this.#value = null;
        this.addHandler("change-value", () => this.apply());

        this.value = "";

        this.type = "str";
    }

    unhook() {
        super.unhook();
        this.inputs.forEach(inp => this.unhookSingle(inp));
    }
    hook() {
        super.hook();
        this.inputs.forEach(inp => {
            this.hookSingle(inp, () => {
                this.value = inp.value;
            });
        });
    }
    apply() {
        super.apply();
        try {
            this.inputs.forEach(inp => {
                inp.type = "text";
                inp.autocomplete = "off";
                inp.spellcheck = false;
                inp.value = this.value;
            });
        } catch (e) {}
    }

    get value() { return this.#value; }
    set value(v) {
        v = util.ensure(v, "str");
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
    }
};
Form.DirentInput = class FormDirentInput extends Form.GenericInput {
    #value;

    #dialogTitle;
    #dialogFilters;
    #dialogProperties;

    #eInput;
    #eBtn;

    constructor(name, value) {
        super(name, 0);

        this.elem.classList.add("dirent");

        this.#value = null;

        this.dialogTitle = "Choose a dirent";
        this.dialogFilters = [];
        this.dialogProperties = ["openFile"];

        this.#eInput = document.createElement("input");
        this.eContent.appendChild(this.eInput);
        this.eInput.type = "text";
        this.eInput.autocomplete = "off";
        this.eInput.spellcheck = false;
        this.eInput.addEventListener("change", e => {
            this.value = this.eInput.value;
        });
        this.#eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.classList.add("normal");
        this.eBtn.textContent = "Browse";
        this.eBtn.addEventListener("click", async e => {
            e.stopPropagation();
            let result = await App.fileOpenDialog({
                title: this.dialogTitle,
                filters: this.dialogFilters,
                properties: this.dialogProperties.filter(v => v != "multiSelections"),
            });
            result = util.ensure(result, "obj");
            this.value = result.canceled ? null : util.ensure(result.filePaths, "arr")[0];
        });

        this.addHandler("change-value", () => (this.eInput.value = (this.value == null) ? "" : this.value));

        this.value = value;

        this.type = ".*";
    }

    get eInput() { return this.#eInput; }
    get eBtn() { return this.#eBtn; }

    get value() { return this.#value; }
    set value(v) {
        v = (v == null) ? null : util.ensure(v, "str");
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
    }
    hasValue() { return this.value != null; }

    get disabled() { return this.eInput.disabled || this.eBtn.disabled; }
    set disabled(v) { this.eInput.disabled = this.eBtn.disabled = !!v; }

    get dialogTitle() { return this.#dialogTitle; }
    set dialogTitle(v) { this.#dialogTitle = String(v); }
    get dialogFilters() { return this.#dialogFilters; }
    set dialogFilters(v) { this.#dialogFilters = util.ensure(v, "arr"); }
    get dialogProperties() { return this.#dialogProperties; }
    set dialogProperties(v) { this.#dialogProperties = util.ensure(v, "arr"); }
};
Form.ColorInput = class FormColorInput extends Form.Field {
    #value;
    #useAlpha;

    #eColorbox;
    #eInput;

    constructor(name, value) {
        super(name);

        this.elem.classList.add("color");
        
        this.#value = new util.Color();
        this.value.addHandler("change", (c, f, t) => this.change("value."+c, f, t));
        this.#useAlpha = null;

        this.eContent.innerHTML = "<div class='tooltip tog swx color'></div>";
        let colorPicker = this.eContent.children[0];
        let ignore = false;
        let observer = new MutationObserver(() => {
            observer.disconnect();
            colorPicker.signal.addHandler("change", () => {
                if (ignore) return;
                this.value = colorPicker.color;
            });
            apply();
        });
        observer.observe(colorPicker, { childList: true });

        this.#eColorbox = document.createElement("button");
        this.eContent.appendChild(this.eColorbox);
        this.eColorbox.classList.add("override");
        this.eColorbox.addEventListener("click", e => {
            e.stopPropagation();
            this.eContent.classList.add("active");
            const onClick = e => {
                if (colorPicker.contains(e.target)) return;
                e.stopPropagation();
                this.eContent.classList.remove("active");
                document.body.removeEventListener("click", onClick, true);
            };
            document.body.addEventListener("click", onClick, true);
        });
        this.#eInput = document.createElement("input");
        this.eContent.appendChild(this.eInput);
        this.eInput.type = "text";
        this.eInput.addEventListener("change", e => {
            this.value.set(this.eInput.value);
        });
        const apply = () => {
            this.eInput.value = this.value.toHex(this.useAlpha);
            this.eColorbox.style.backgroundColor = this.value.toHex(this.useAlpha);
            ignore = true;
            colorPicker.color = this.value;
            colorPicker.useAlpha = this.useAlpha;
            ignore = false;
        };
        this.addHandler("change-value.r", apply);
        this.addHandler("change-value.g", apply);
        this.addHandler("change-value.b", apply);
        this.addHandler("change-value.a", apply);
        this.addHandler("change-useAlpha", apply);

        this.value = value;
        this.useAlpha = true;
    }

    get value() { return this.#value; }
    set value(v) { this.#value.set(v); }
    get useAlpha() { return this.#useAlpha; }
    set useAlpha(v) {
        v = !!v;
        if (this.useAlpha == v) return;
        this.change("useAlpha", this.useAlpha, this.#useAlpha=v);
    }
    
    get disabled() { return this.eInput.disabled; }
    set disabled(v) { this.eInput.disabled = this.eColorbox.disabled = v; }

    get eColorbox() { return this.#eColorbox; }
    get eInput() { return this.#eInput; }
};
Form.EnumInput = class FormEnumInput extends Form.Field {
    #values;
    #value;

    constructor(name, values, value) {
        super(name, 0);

        this.elem.classList.add("enum");

        this.#values = [];
        this.#value = null;
        this.addHandler("change-values", () => (this.value = this.value));

        this.values = values;
        this.value = value;
    }

    get values() { return [...this.#values]; }
    set values(v) {
        this.#values = util.ensure(v, "arr");
        this.change("values", null, this.values);
    }
    get value() { return this.#value; }
    set value(v) {
        v = this.#values.map(data => (util.is(data, "obj") ? data.value : data)).includes(v) ? v : null;
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
    }
    hasValue() { return this.value != null; }
};
Form.DropdownInput = class FormDropdownInput extends Form.EnumInput {
    #app;

    #eBtn;

    constructor(name, values, value) {
        super(name, values, value);

        this.elem.classList.add("dropdown");

        this.#eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.classList.add("normal");
        
        this.eBtn.addEventListener("click", e => {
            if (!this.hasApp()) return;
            e.stopPropagation();
            let itm;
            let menu = new App.Menu();
            this.values.forEach(data => {
                if (data == null) return menu.addItem(new App.Menu.Divider());
                itm = menu.addItem(new App.Menu.Item(
                    util.is(data, "obj") ? data.name : data,
                    (util.is(data, "obj") ? data.value : data) == this.value ? "checkmark" : "",
                ));
                itm.addHandler("trigger", e => (this.value = (util.is(data, "obj") ? data.value : data)));
            });
            this.app.contextMenu = menu;
            let r = this.eBtn.getBoundingClientRect();
            this.app.placeContextMenu(r.left, r.bottom);
            menu.elem.style.minWidth = r.width+"px";
        });

        const apply = () => {
            this.eBtn.innerHTML = "";
            this.eBtn.appendChild(document.createElement("div"));
            this.eBtn.lastChild.textContent = "None";
            this.eBtn.appendChild(document.createElement("ion-icon"));
            this.eBtn.lastChild.name = "chevron-forward";
            for (let data of this.values) {
                if ((util.is(data, "obj") ? data.value : data) != this.value) continue;
                this.eBtn.innerHTML = "";
                this.eBtn.appendChild(document.createElement("div"));
                this.eBtn.lastChild.textContent = (util.is(data, "obj") ? data.name : data);
                this.eBtn.appendChild(document.createElement("ion-icon"));
                this.eBtn.lastChild.name = "chevron-forward";
                break;
            }
        };
        this.addHandler("change-value", apply);
        apply();
    }

    get app() { return this.#app; }
    set app(v) {
        v = (v instanceof App) ? v : null;
        if (this.app == v) return;
        this.#app = v;
    }
    hasApp() { return !!this.app; }

    get eBtn() { return this.#eBtn; }

    get disabled() { return this.eBtn.disabled; }
    set disabled(v) { this.eBtn.disabled = v; }
};
Form.SelectInput = class FormSelectInput extends Form.EnumInput {
    constructor(name, values, value) {
        super(name, values, value);

        this.elem.classList.add("select");

        const apply = () => {
            this.eContent.innerHTML = "";
            this.values.forEach(data => {
                if (data == null) return;
                let btn = document.createElement("button");
                this.eContent.appendChild(btn);
                if ((util.is(data, "obj") ? data.value : data) == this.value) btn.classList.add("this");
                btn.textContent = (util.is(data, "obj") ? data.name : data);
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.value = (util.is(data, "obj") ? data.value : data);
                    if (util.is(data.click, "func")) data.click();
                });
                btn.style.setProperty("--n", this.values.length);
            });
            this.post("apply");
        };
        this.addHandler("change-values", apply);
        this.addHandler("change-value", apply);
        apply();
    }

    get disabled() {
        for (let btn of this.eContent.children)
            if (btn.disabled)
                return true;
        return false;
    }
    set disabled(v) {
        for (let btn of this.eContent.children)
            btn.disabled = v;
    }
};
Form.ToggleInput = class FormToggleInput extends Form.SelectInput {
    #disabled;

    constructor(name, toggleName, value) {
        // gross might migrate over to BooleanInput
        let changed = false;
        super(name, [{ value: true, name: toggleName, click: () => {
            this.value = (changed ? value : !value);
            changed = false;
        }}], !!value);
        this.addHandler("change-value", (f, t) => {
            changed = true;
            value = this.value;
        });
        value = this.value;
        this.#disabled = true;
    }

    get values() { return super.values; }
    set values(v) {
        try {
            if (this.#disabled)
                return;
        } catch (e) {}
        super.values = v;
    }

    get value() { return !!super.value; }
    set value(v) { super.value = !!v; }
};
Form.BooleanInput = class FormBooleanInput extends Form.Field {
    constructor(name, value) {
        super(name);

        this.showToggle = true;
        this.showContent = false;

        this.addHandler("change-toggleOn", () => this.change("value", !this.value, this.value));

        this.value = value;
    }

    get value() { return this.toggleOn; }
    set value(v) { this.toggleOn = v; }

    get disabled() { return this.eToggleInput.disabled; }
    set disabled(v) { this.eToggleInput.disabled = v; }
};
Form.JSONInput = class FormJSONInput extends Form.Field {
    #map;

    #eAdd;

    constructor(name, map) {
        super(name);
        
        this.elem.classList.add("json");

        this.#map = {};

        this.#eAdd = document.createElement("button");
        this.eContent.appendChild(this.eAdd);
        this.eAdd.classList.add("special");
        this.eAdd.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.eAdd.addEventListener("click", e => {
            e.stopPropagation();
            let keys = this.keys;
            let k = "new-key";
            if (keys.includes(k)) {
                let n = 1;
                while (true) {
                    if (!keys.includes(k+"-"+n)) break;
                    n++;
                }
                k += "-"+n;
            }
            this.set(k, "null");
        });

        this.addHandler("change", () => {
            Array.from(this.eContent.querySelectorAll(":scope > .item")).forEach(elem => elem.remove());
            this.keys.forEach(k => {
                let v = this.get(k);
                let elem = document.createElement("div");
                this.eContent.insertBefore(elem, this.eAdd);
                elem.classList.add("item");
                let kinput = document.createElement("input");
                elem.appendChild(kinput);
                kinput.type = "text";
                kinput.placeholder = "Key...";
                kinput.autocomplete = "off";
                kinput.spellcheck = false;
                kinput.value = k;
                let separator = document.createElement("div");
                elem.appendChild(separator);
                separator.classList.add("separator");
                separator.textContent = ":";
                let vinput = document.createElement("input");
                elem.appendChild(vinput);
                vinput.type = "text";
                vinput.placeholder = "Value...";
                vinput.autocomplete = "off";
                vinput.spellcheck = false;
                vinput.value = v;
                let color = "v4";
                try {
                    let v2 = JSON.parse(v);
                    if (util.is(v2, "str")) color = "cy";
                    else if (util.is(v2, "num")) color = "cb";
                    else if (v2 == null) color = "co";
                    else if (v2 == true || v2 == false) color = ["cr", "cg"][+v2];
                    else color = "v8";
                } catch (e) {}
                vinput.style.color = "var(--"+color+")";
                let remove = document.createElement("button");
                elem.appendChild(remove);
                remove.classList.add("remove");
                remove.innerHTML = "<ion-icon name='close'></ion-icon>";
                kinput.addEventListener("change", e => {
                    this.del(k);
                    this.set(kinput.value, v);
                });
                vinput.addEventListener("change", e => {
                    this.set(k, vinput.value);
                });
                remove.addEventListener("click", e => {
                    e.stopPropagation();
                    this.del(k);
                });
            });
        });

        this.map = map;
    }

    get keys() { return Object.keys(this.#map); }
    get values() { return Object.values(this.#map); }
    get map() {
        let map = {};
        this.keys.forEach(k => (map[k] = this.get(k)));
        return map;
    }
    set map(v) {
        v = util.ensure(v, "obj");
        this.clear();
        for (let k in v) this.set(k, v[k]);
    }
    clear() {
        let map = this.map;
        this.keys.forEach(k => this.del(k));
        return map;
    }
    has(k) { return String(k) in this.#map; }
    get(k) {
        if (!this.has(k)) return null;
        return this.#map[String(k)];
    }
    set(k, v) {
        k = String(k);
        v = String(v);
        let v2 = this.get(k);
        if (v == v2) return v2;
        this.#map[k] = v;
        this.post("set", k, v2, v);
        this.change("map", null, this.keys);
        return v;
    }
    del(k) {
        let v = this.get(k);
        if (v == null) return v;
        delete this.#map[String(k)];
        this.post("del", k, v);
        this.change("map", null, this.keys);
        return v;
    }

    get disabled() { return this.eAdd.disabled; }
    set disabled(v) {
        this.eAdd.disabled = v;
        Array.from(this.eContent.querySelectorAll("input")).forEach(inp => (inp.disabled = v));
    }

    get eAdd() { return this.#eAdd; }
};
Form.Button = class FormButton extends Form.Field {
    #eBtn;

    constructor(name, text, type="normal") {
        super(name);

        this.elem.classList.add("button");

        this.#eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
        });

        this.text = text;

        this.btnType = type;
    }

    get eBtn() { return this.#eBtn; }

    get text() { return this.eBtn.textContent; }
    set text(v) { this.eBtn.textContent = v; }

    get btnType() {
        for (let name of ["normal", "special", "on", "off"])
            if (this.eBtn.classList.contains(name))
                return name;
        return null;
    }
    set btnType(v) {
        ["normal", "special", "on", "off"].forEach(name => {
            if (name == v) this.eBtn.classList.add(name);
            else this.eBtn.classList.remove(name);
        });
    }

    get disabled() { return this.eBtn.disabled; }
    set disabled(v) { this.eBtn.disabled = v; }
};
Form.Line = class FormLine extends Form.Field {
    constructor(color="var(--v2)") {
        super("§");

        this.elem.classList.add("line");

        this.color = color;
    }

    get color() { return this.elem.style.backgroundColor; }
    set color(v) { this.elem.style.backgroundColor = v; }
};
Form.SubForm = class FormSubForm extends Form.Field {
    #form;

    constructor(name) {
        super(name);

        this.elem.classList.add("subform");

        this.eHeader.insertBefore(document.createElement("ion-icon"), this.eHeader.firstChild);
        this.eHeader.firstChild.name = "chevron-forward";
        this.eHeader.addEventListener("click", e => {
            e.stopPropagation();
            if (this.elem.classList.contains("this"))
                this.elem.classList.remove("this");
            else this.elem.classList.add("this");
        });

        this.#form = new Form();
        this.eContent.appendChild(this.form.elem);
    }

    get form() { return this.#form; }
};

export class DropTarget extends util.Target {
    #elem;
    #eOverlay;
    #observer;
    #observed;

    #dragIn;
    #dragOut;
    #drop;

    #disabled;

    constructor(elem, drop=null) {
        super();

        this.#disabled = false;

        this.#elem = null;
        this.#eOverlay = document.createElement("div");
        this.#eOverlay.classList.add("overlay");
        this.#eOverlay.innerHTML = "<div></div><div></div>";
        this.#observed = () => {
            if (!this.hasElem()) return;
            let r = this.elem.getBoundingClientRect();
            this.#eOverlay.style.setProperty("--size", Math.min(r.width, r.height)+"px");
        };
        this.#observer = new ResizeObserver(this.#observed);

        this.#dragIn = e => {
            if (this.disabled) return this.#dragOut();
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.#eOverlay.classList.add("this");
        };
        this.#dragOut = e => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.#eOverlay.classList.remove("this");
        };
        this.#drop = () => {};

        this.elem = elem;

        this.drop = drop;
    }

    get elem() { return this.#elem; }
    set elem(v) {
        v = (v instanceof HTMLElement) ? v : null;
        if (this.elem == v) return;
        this.unhook();
        this.#elem = v;
        this.hook();
    }
    hasElem() { return !!this.elem; }
    unhook() {
        this.unhookDrop();
        if (!this.hasElem()) return;
        this.elem.classList.remove("droptarget");
        if (this.disabled)
            this.elem.classList.remove("disabled");
        this.#eOverlay.remove();
        this.#observer.disconnect();
        ["dragenter", "dragover"].forEach(name => this.elem.removeEventListener(name, this.#dragIn));
        ["dragleave", "dragend", "drop"].forEach(name => this.elem.removeEventListener(name, this.#dragOut));
        this.#dragOut(null);
        this.#observed();
    }
    hook() {
        if (this.disabled) return this.unhook();
        this.hookDrop();
        if (!this.hasElem()) return;
        this.elem.classList.add("droptarget");
        this.elem.classList.remove("disabled");
        if (this.disabled)
            this.elem.classList.add("disabled");
        this.elem.appendChild(this.#eOverlay);
        this.#observer.observe(this.elem);
        ["dragenter", "dragover"].forEach(name => this.elem.addEventListener(name, this.#dragIn));
        ["dragleave", "dragend", "drop"].forEach(name => this.elem.addEventListener(name, this.#dragOut));
        this.#dragOut(null);
        this.#observed();
    }

    get drop() { return this.#drop; }
    set drop(v) {
        v = util.ensure(v, "func");
        if (this.drop == v) return;
        this.unhookDrop();
        this.#drop = v;
        this.hookDrop();
    }
    unhookDrop() {
        if (!this.hasElem()) return;
        this.elem.removeEventListener("drop", this.#drop);
    }
    hookDrop() {
        if (this.disabled) return this.unhookDrop();
        if (!this.hasElem()) return;
        this.elem.addEventListener("drop", this.#drop);
    }

    get disabled() { return this.#disabled; }
    set disabled(v) {
        v = !!v;
        if (this.disabled == v) return;
        this.change("disabled", this.disabled, this.#disabled=v);
        this.unhook();
        this.hook();
    }
    get enabled() { return !this.disabled; }
    set enabled(v) { this.disabled = !v; }
    disable() { return this.disabled = true; }
    enable() { return this.enabled = true; }
}
