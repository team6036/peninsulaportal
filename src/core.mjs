import * as util from "./util.mjs";
import { V } from "./util.mjs";


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
    #USERAGENT;

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

    constructor() {
        super();

        this.#USERAGENT = {};

        this.#setupDone = false;

        this.#fullscreen = null;
        this.#devMode = null;
        this.#holiday = null;

        this.#popups = [];

        this.#menu = null;
        this.#contextMenu = null;
        document.body.addEventListener("click", e => {
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
            } catch (e) { await this.doError("Permission Send Error", e); }
        });

        let today = new Date();
        if (today.getMonth() == 3 && today.getDate() == 1) {
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
                    theSadFace.textContent = (t < t2 ? ":(" : t < t3 ? [":)", ":P", ":|", ":3"][Math.floor(4*Math.random())] : ">:)");
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

        this.addHandler("start", async () => {
            this.#USERAGENT = util.ensure(await window.ver(), "obj");
            let app;
            try { app = await window.api.get("version"); }
            catch (e) { app = util.stringifyError(e); }
            this.USERAGENT.app = String(app);
            if (this.USERAGENT.os != "web") {
                let os = this.USERAGENT.os = util.ensure(this.USERAGENT.os, "obj");
                os.platform = util.ensure(os.platform, "str", "?");
                os.arch = util.ensure(os.arch, "str", "?");
                os.cpus = util.ensure(os.cpus, "arr").map(cpu => {
                    cpu = util.ensure(cpu, "obj");
                    cpu.model = util.ensure(cpu.model, "str", "?");
                    return cpu;
                });
                this.USERAGENT.node = String(this.USERAGENT.node);
                this.USERAGENT.chrome = String(this.USERAGENT.chrome);
                this.USERAGENT.electron = String(this.USERAGENT.electron);
            }
            this.USERAGENT.isPublic = !!(await window.api.isPublic());
            this.menu = App.Menu.buildMenu(this.USERAGENT);
            let id = setInterval(() => {
                if (document.readyState != "complete") return;
                clearInterval(id);
                (async () => {
                    await this.postResult("pre-setup");
                    await this.setup();
                    await this.postResult("post-setup");
                    let page = "";
                    try {
                        page = await window.api.send("state-get", "page");
                    } catch (e) { await this.doError("State CurrentPage Get Error", e); }
                    let pageState = null;
                    try {
                        pageState = await window.api.send("state-get", "page-state");
                    } catch (e) { await this.doError("State PageState Get Error", e); }
                    let pagePersistentStates = {};
                    try {
                        pagePersistentStates = util.ensure(await window.api.send("state-get", "page-persistent-states"), "obj");
                    } catch (e) { await this.doError("State PagePersistentStates Get Error", e); }
                    for (let name in pagePersistentStates) {
                        if (!this.hasPage(name)) continue;
                        try {
                            await this.getPage(name).loadPersistentState(util.ensure(pagePersistentStates[name], "obj"));
                        } catch (e) { await this.doError("Load PersistentState Error ("+name+")", e); }
                    }
                    if (this.hasPage(page)) {
                        try {
                            await this.getPage(page).loadState(util.ensure(pageState, "obj"));
                        } catch (e) { await this.doError("Load State Error ("+page+")", e); }
                        if (this.page != page) this.page = page;
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
                            await this.doError("Update Error", e);
                            error = false;
                            return t0 = null;
                        }
                        t0 = t1;
                    };
                    update();
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

    get USERAGENT() { return this.#USERAGENT; }

    getUserAgent() {
        let userAgent = this.USERAGENT;
        if (userAgent.os == "web") {
            return [
                "WEB",
                "Agent: "+navigator.userAgent,
                "App: "+userAgent.app,
            ];
        }
        let cpus = "";
        if (userAgent.os.cpus.length > 0) {
            cpus += " / ";
            let models = [...new Set(userAgent.os.cpus.map(obj => obj.model))];
            if (models.length > 1) cpus += "CPUS: "+models.join(", ");
            else cpus += models[0];
        }
        return [
            "DESKTOP",
            "OS: "+userAgent.os.platform+" "+userAgent.os.arch+cpus,
            "Node: "+userAgent.node,
            "Chrome: "+userAgent.chrome,
            "Electron: "+userAgent.electron,
            "App: "+userAgent.app,
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
                        elem.src = (holiday == null) ? String(new URL("./src/assets/app/icon.png", url)) : util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").png;
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
                elem.textContent += "["+util.capitalize(fName)+"] ";
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
            if (window.app == this) delete window.app;
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
            } catch (e) { await this.doError("Send Permission Error", e); }
        });
        window.api.on((_, cmd, ...a) => {
            cmd = String(cmd);
            this.post("cmd", cmd, ...a);
            this.post("cmd-"+cmd, ...a);
        });
        this.addHandler("perm", async () => {
            if (this.hasPage(this.page)) {
                try {
                    await window.api.send("state-set", "page", this.page);
                } catch (e) { await this.doError("State CurrentPage Set Error", e); }
                try {
                    await window.api.send("state-set", "page-state", this.getPage(this.page).state);
                } catch (e) { await this.doError("State PageState Set Error", e); }
                let pagePersistentStates = {};
                this.pages.forEach(name => (pagePersistentStates[name] = this.getPage(name).persistentState));
                try {
                    await window.api.send("state-set", "page-persistent-states", pagePersistentStates);
                } catch (e) { await this.doError("State PagePersistentStates Set Error", e); }
            }
            return true;
        });
        this.addHandler("cmd-about", async () => {
            let name = String(await window.api.get("name"));
            let holiday = await window.api.get("active-holiday");
            let pop = this.confirm();
            pop.cancel = "Documentation";
            pop.iconSrc = (holiday == null) ? (root+"/assets/app/icon.svg") : util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").svg;
            pop.iconColor = "var(--a)";
            pop.subIcon = util.is(this.constructor.ICON, "str") ? this.constructor.ICON : "";
            pop.title = "Peninsula "+util.capitalize(name);
            pop.infos = [this.getUserAgent().join("\n")];
            let r = await pop.whenResult();
            if (r) return;
            this.post("cmd-documentation");
        });
        this.addHandler("cmd-documentation", async () => {
            let name = String(await window.api.get("name"));
            if (["PANEL", "PLANNER", "PRESETS"].includes(name))
                this.addPopup(new App.MarkdownPopup("./docs/"+name.toLowerCase()+"/MAIN.md"));
            else this.addPopup(new App.MarkdownPopup("./README.md"));
        });
        this.addHandler("cmd-spawn", async name => {
            name = String(name);
            let isDevMode = await window.api.get("devmode");
            if (!isDevMode && [].includes(name)) {
                let pop = this.confirm("Open "+util.capitalize(name), "Are you sure you want to open this feature?\nThis feature is in development and might contain bugs");
                let result = await pop.whenResult();
                if (!result) return;
            }
            try {
                await window.api.send("spawn", name);
            } catch (e) { await this.doError("Spawn Error: "+name, e); }
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
                    elem.children[1].textContent = util.capitalize(await window.api.get("name"));
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
                    if (holiday == null) return elem.classList.remove("special");
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
        };
        setInterval(updatePage, 500);
        updatePage();
        
        let t = util.getTime();
        
        this.fullscreen = await window.api.get("fullscreen");
        this.devMode = await window.api.get("devmode");
        this.holiday = await window.api.get("active-holiday");

        document.documentElement.style.setProperty("--WIN32", ((util.is(this.USERAGENT.os, "obj") && (this.USERAGENT.os.platform == "win32")) ? 1 : 0));
        document.documentElement.style.setProperty("--DARWIN", ((util.is(this.USERAGENT.os, "obj") && (this.USERAGENT.os.platform == "darwin")) ? 1 : 0));
        document.documentElement.style.setProperty("--LINUX", ((util.is(this.USERAGENT.os, "obj") && (this.USERAGENT.os.platform == "linux")) ? 1 : 0));
        PROPERTYCACHE.clear();

        let themeUpdating = false;
        const themeUpdate = async () => {
            if (themeUpdating) return;
            themeUpdating = true;
            let data = util.ensure(util.ensure(await window.api.get("themes"), "obj")[await window.api.get("theme")], "obj");
            this.base = data.base || Array.from(new Array(9).keys()).map(i => new Array(3).fill(255*i/9));
            let darkWanted = !!(await window.api.get("dark-wanted"));
            highlight2.href = root+"/assets/modules/" + (darkWanted ? "highlight-dark.min.css" : "highlight-light.min.css");
            if (!darkWanted) this.base = this.base.reverse();
            this.colors = data.colors || {
                r: [255, 0, 0],
                o: [255, 128, 0],
                y: [255, 255, 0],
                g: [0, 255, 0],
                c: [0, 255, 255],
                b: [0, 0, 255],
                p: [128, 0, 255],
                m: [255, 0, 255],
            };
            this.accent = data.accent || "b";
            themeUpdating = false;
        };
        this.addHandler("cmd-theme", () => themeUpdate());
        this.addHandler("cmd-native-theme", () => themeUpdate());
        await themeUpdate();

        await this.postResult("setup");

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
    get colors() { return Object.keys(this.#colors); }
    set colors(v) {
        v = util.ensure(v, "obj");
        this.clearColors();
        for (let name in v) this.addColor(name, v[name]);
    }
    clearColors() {
        let colors = this.colors;
        colors.forEach(name => this.remColor(name));
        return colors;
    }
    hasColor(name) {
        name = String(name);
        return name in this.#colors;
    }
    getColor(name) {
        name = String(name);
        if (!this.hasColor(name)) return null;
        return this.#colors[name];
    }
    addColor(name, color) {
        name = String(name);
        color = new util.Color(color);
        if (this.hasColor(name)) return false;
        this.#colors[name] = color;
        this.updateDynamicStyle();
        return color;
    }
    remColor(name) {
        name = String(name);
        if (this.hasColor(name)) return false;
        let color = this.getColor(name);
        delete this.#colors[name];
        this.updateDynamicStyle();
        return color;
    }
    setColor(name, color) {
        name = String(name);
        color = new util.Color(color);
        this.#colors[name] = color;
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
        this.colors.forEach(name => (colors[name] = this.getColor(name)));
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
    confirm(...a) { return this.addPopup(new App.Confirm(...a)); }
    prompt(...a) { return this.addPopup(new App.Prompt(...a)); }
    async doAlert(...a) { return await this.alert(...a).whenResult(); }
    async doError(...a) { return await this.error(...a).whenResult(); }
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
        ["PANEL", "PLANNER"].forEach(name => {
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
        this.contextMenu.fix();
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
            let name = util.capitalize(await window.api.get("name"));
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

    async capture(rect) { return await window.api.send("capture", rect); }
    async fileOpenDialog(options) { return await window.api.send("file-open-dialog", options); }
    async fileSaveDialog(options) { return await window.api.send("file-save-dialog", options); }
}
App.PopupBase = class AppPopupBase extends util.Target {
    #result;

    #resolver;

    #elem;
    #inner;

    static NAME = null;
    static PARAMS = [];

    constructor() {
        super();

        this.#result = null;

        this.#resolver = new util.Resolver(false);

        this.#elem = document.createElement("div");
        this.elem.classList.add("popup");
        this.#inner = document.createElement("div");
        this.elem.appendChild(this.inner);
        this.inner.classList.add("inner");

        this.addHandler("add", async () => {
            let id = await window.modal.spawn(this.constructor.NAME, this.generateParams());
            if (id == null) {
                document.body.appendChild(this.elem);
                setTimeout(() => {
                    this.elem.classList.add("in");
                }, 0.01*1000);
            } else {
                const onChange = () => window.modal.modify(id, this.generateParams());
                this.addHandler("change", onChange);
                onChange();
                const remove = window.modal.onResult((_, id2, r) => {
                    if (id2 != id) return;
                    this.result(r);
                    remove();
                    this.remHandler("change", onChange);
                });
            }
        });
        this.addHandler("rem", async () => {
            if (document.body.contains(this.elem)) {
                this.elem.classList.remove("in");
                setTimeout(() => {
                    document.body.removeChild(this.elem);
                }, 0.25*1000);
            }
        });
    }

    generateParams() {
        let params = {};
        this.constructor.PARAMS.forEach(param => (params[param] = this[param]));
        return params;
    }

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

    get icon() { return this.eIcon.getAttribute("name"); }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        this.eIcon.setAttribute("name", v);
        this.change("icon", null, this.icon);
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
        this.change("iconSrc", null, this.iconSrc);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) {
        this.eIcon.style.color = v;
        this.change("iconColor", null, this.iconColor);
    }

    get subIcon() { return this.eSubIcon.getAttribute("name"); }
    set subIcon(v) {
        this.eSubIcon.removeAttribute("src");
        this.eSubIcon.setAttribute("name", v);
        this.change("subIcon", null, this.subIcon);
    }
    get subIconSrc() { return this.eSubIcon.getAttribute("src"); }
    set subIconSrc(v) {
        this.eSubIcon.removeAttribute("name");
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
        this.eButton.textContent = v;
        this.change("button", null, this.button);
    }
};
App.Error = class AppError extends App.Alert {
    constructor(title, content, info) {
        super(title, content, "warning");

        this.iconColor = "var(--cr)";

        this.infos = [info];
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
        this.eConfirm.textContent = v;
        this.change("confirm", null, this.confirm);
    }
    get cancel() { return this.eCancel.textContent; }
    set cancel(v) {
        this.eCancel.textContent = v;
        this.change("cancel", null, this.cancel);
    }
};
App.Prompt = class AppPrompt extends App.CorePopup {
    #eInput;
    #eConfirm;
    #eCancel;

    static NAME = "PROMPT";

    static {
        this.PARAMS = [...this.PARAMS, "confirm", "cancel", "value", "placeholder"];
    }

    constructor(title, content, value="", icon="pencil", confirm="OK", cancel="Cancel", placeholder="...") {
        super(title, content, icon);

        this.elem.classList.add("prompt");

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

        this.eConfirm.addEventListener("click", e => {
            e.stopPropagation();
            this.result(this.value);
        });
        this.eCancel.addEventListener("click", e => {
            e.stopPropagation();
            this.result(null);
        });

        this.value = value;
        this.confirm = confirm;
        this.cancel = cancel;
        this.placeholder = placeholder;
    }

    get eInput() { return this.#eInput; }
    get eCancel() { return this.#eCancel; }
    get eConfirm() { return this.#eConfirm; }

    get confirm() { return this.eConfirm.textContent; }
    set confirm(v) {
        this.eConfirm.textContent = v;
        this.change("confirm", null, this.confirm);
    }
    get cancel() { return this.eCancel.textContent; }
    set cancel(v) {
        this.eCancel.textContent = v;
        this.change("cancel", null, this.cancel);
    }

    get value() { return this.eInput.value; }
    set value(v) {
        this.eInput.value = v;
        this.change("value", null, this.value);
    }

    get placeholder() { return this.eInput.placeholder; }
    set placeholder(v) {
        this.eInput.placeholder = v;
        this.change("placeholder", null, this.placeholder);
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
        return this.items.filter(itm => itm.exists).map(itm => itm.toObj());
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
        ["PANEL", "PLANNER"].forEach((name, i) => {
            let subitm = new App.Menu.Item(util.capitalize(name));
            subitm.id = "spawn:"+name;
            subitm.accelerator = "CmdOrCtrl+"+(i+1);
            itm.menu.addItem(subitm);
        });
        return [itm];
    }
    static buildDevToolsItems() { return this.buildRoleItems("toggledevtools"); }
    static buildMainMenu(userAgent) {
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
    static buildFileMenu(userAgent) {
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
    static buildEditMenu(userAgent) {
        let menu = new App.Menu();
        let itms = [
            ...this.buildUndoRedoItems(),
            new App.Menu.Divider(),
            ...this.buildCutCopyPasteItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildViewMenu(userAgent) {
        let menu = new App.Menu();
        let itms = [
            ...this.buildFullscreenItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildWindowMenu(userAgent) {
        userAgent = util.ensure(userAgent, "obj");
        let menu = new App.Menu();
        let itms = [
            ...this.buildWindowItems(),
            ...this.buildDevToolsItems(),
        ];
        if (util.is(userAgent.os, "obj") && (userAgent.os.platform == "darwin"))
            itms.splice(2, 0, new App.Menu.Divider(), ...this.buildFrontItems(), new App.Menu.Divider());
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildHelpMenu(userAgent) {
        let menu = new App.Menu();
        let itms = [
            ...this.buildHelpItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildMenu(userAgent) {
        let menu = new App.Menu();
        let menus = [
            this.buildFileMenu(userAgent),
            this.buildEditMenu(userAgent),
            this.buildViewMenu(userAgent),
            this.buildWindowMenu(userAgent),
            this.buildHelpMenu(userAgent),
        ];
        menus.forEach((submenu, i) => {
            let name = ["file", "edit", "view", "window", "help"][i];
            let itm = new App.Menu.Item(util.capitalize(name));
            itm.id = "menu:"+name;
            if (name == "help") itm.role = "help";
            submenu.items.forEach(subitm => itm.menu.addItem(subitm));
            menu.addItem(itm);
        });
        return menu;
    }
    static buildWholeMenu(name, userAgent) {
        name = String(name);
        let menu = new App.Menu();
        let itm = new App.Menu.item((name.length > 0) ? name : "Peninsula", "navigate");
        itm.id = "menu:main";
        this.buildMainMenu().items.forEach(subitm => itm.menu.addItem(subitm));
        menu.addItem(itm);
        this.buildMenu(userAgent).items.forEach(itm => menu.addItem(itm));
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

    constructor(label, icon="") {
        super();

        this.#id = new Array(64).fill(null).map(_ => util.BASE64[Math.floor(util.BASE64.length*Math.random())]).join("");

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
        this.eSubIcon.setAttribute("name", "chevron-forward");
        this.elem.appendChild(this.menu.elem);

        this.elem.addEventListener("mouseenter", e => this.fix());
        this.elem.addEventListener("click", e => {
            if (this.disabled) return;
            e.stopPropagation();
            this.post("trigger", e);
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
        this.#check();
    }
    hasType() { return this.type != null; }
    get label() { return this.#label; }
    set label(v) {
        v = (v == null) ? null : String(v);
        if (this.label == v) return;
        this.change("label", this.label, this.#label=v);
        if (!this.hasRole()) return this.eLabel.textContent = this.hasLabel() ? this.label : "";
        (async () => {
            let v = this.role;
            let label = await window.api.send("menu-role-label", v);
            if (this.role != v) return;
            this.eLabel.textContent = label;
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

    get icon() { return this.eIcon.getAttribute("name"); }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        this.eIcon.setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.children[0].getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }
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

    constructor() {
        super();

        this.#result = null;

        this.#resolver = new util.Resolver(false);
        window.modal.onModify((_, params) => {
            params = util.ensure(params, "obj");
            for (let param in params) {
                if (params[param] == null) continue;
                this["i"+param] = params[param];
            }
            this.resize();
        });
        (async () => {
            await window.modal.result(await this.whenResult());
            await window.api.send("close");
        })();

        this.addHandler("setup", async () => {
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

    get iicon() { return this.ieIcon.getAttribute("name"); }
    set iicon(v) {
        this.ieIcon.removeAttribute("src");
        this.ieIcon.setAttribute("name", v);
    }
    get iiconSrc() { return this.ieIcon.getAttribute("src"); }
    set iiconSrc(v) {
        this.ieIcon.removeAttribute("name");
        this.ieIcon.setAttribute("src", v);
    }
    get iiconColor() { return this.ieIcon.style.color; }
    set iiconColor(v) { this.ieIcon.style.color = v; }

    get isubIcon() { return this.ieSubIcon.getAttribute("name"); }
    set isubIcon(v) {
        this.ieSubIcon.removeAttribute("src");
        this.ieSubIcon.setAttribute("name", v);
    }
    get isubIconSrc() { return this.ieSubIcon.getAttribute("src"); }
    set isubIconSrc(v) {
        this.ieSubIcon.removeAttribute("name");
        this.ieSubIcon.setAttribute("src", v);
    }
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
                e.stopPropagation();
                if (this.eProjectInfo.classList.contains("this")) this.eProjectInfo.classList.remove("this");
                else {
                    this.eProjectInfo.classList.add("this");
                    const click = e => {
                        if (this.eProjectInfo.contains(e.target)) return;
                        document.body.removeEventListener("click", click, { capture: true });
                        this.eProjectInfo.classList.remove("this");
                    };
                    document.body.addEventListener("click", click, { capture: true });
                }
            });

            this.#eProjectInfoBtnIcon = document.createElement("ion-icon");
            this.eProjectInfoBtn.insertBefore(this.eProjectInfoBtnIcon, Array.from(this.eProjectInfoBtn.children).at(-1));
            this.eProjectInfoBtnIcon.setAttribute("name", this.constructor.ICON);

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
            await this.doError("Projects Load Error", e);
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
            await this.doError("Projects Save Error", e);
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
                id = new Array(10).fill(null).map(_ => util.BASE64[Math.floor(Math.random()*64)]).join("");
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
            const name = util.capitalize(String(await window.api.get("name")));
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
                let pop = this.app.prompt("Rename", "", project.meta.name);
                let result = await pop.whenResult();
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
            projects = util.search(projects, ["meta.name"], this.eSearchInput.value);
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
            this.eInfoDisplayBtn.children[0].setAttribute("name", (v == "list") ? "grid" : (v == "grid") ? "list" : null);
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

        this.eListIcon.setAttribute("name", "document-outline");
        this.eGridIcon.setAttribute("name", "document-outline");

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

    #eMain;
    #eNav;
    #eNavPre;
    #eNavPost;
    #eNavProgress;
    #eNavProgressTooltip;
    #eNavActionButton;
    #eNavForwardButton;
    #eNavBackButton;
    #eNavInfo;

    constructor(app) {
        super("PROJECT", app);

        this.#progress = null;
        this.#progressHover = null;

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
            if (e.code == "ArrowLeft") {
                this.post("nav-back");
                this.eNav.focus();
            }
            if (e.code == "ArrowRight") {
                this.post("nav-forward");
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

        let lock = false;
        setInterval(async () => {
            if (lock) return;
            lock = true;
            await this.app.post("cmd-save");
            lock = false;
        }, 10000);

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

    get eMain() { return this.#eMain; }
    get eNav() { return this.#eNav; }
    get eNavPre() { return this.#eNavPre; }
    get eNavPost() { return this.#eNavPost; }
    get eNavProgress() { return this.#eNavProgress; }
    get eNavProgressTooltip() { return this.#eNavProgressTooltip; }
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

export class Client extends util.Target {
    #id;

    #location;

    #connectionResolver;
    #socketId;

    #destructionResolver;

    constructor(location) {
        super();

        this.#id = new Array(8).fill(null).map(_ => util.BASE64[Math.floor(util.BASE64.length*Math.random())]).join("");

        this.#location = String(location);

        this.#connectionResolver = new util.Resolver(false);
        this.#connectionResolver.addHandler("change-state", () => console.log(this.id+":meta.connected = "+this.connected));
        this.#socketId = null;

        this.#destructionResolver = new util.Resolver(true);

        const confirm = (id, meta) => {
            if (this.destroyed) {
                remClientMsg();
                remClientStreamStart();
                remClientStreamStop();
                return false;
            }
            if (this.id != id) return false;
            meta = util.ensure(meta, "obj");
            if (this.location != meta.location) return false;
            this.#connectionResolver.state = !!meta.connected;
            let socketId = (meta.socketId == null) ? null : String(meta.socketId);
            if (this.#socketId != socketId) {
                console.log(this.id+":meta.socketId = "+socketId);
                this.#socketId = socketId;
            }
            return true;
        };
        const remClientMsg = window.sio.onClientMsg((_, id, name, payload, meta) => {
            if (!confirm(id, meta)) return;
            name = String(name);
            console.log(this.id+":msg", name, payload);
            this.post("msg", name, payload);
            this.post("msg-"+name, payload);
        });
        const remClientStreamStart = window.sio.onClientStreamStart((_, id, name, pth, fname, payload, meta) => {
            if (!confirm(id, meta)) return;
            name = String(name);
            pth = String(pth);
            fname = String(fname);
            console.log(this.id+":stream-start", name, pth, fname, payload);
            this.post("stream-start", name, pth, fname, payload);
            this.post("stream-start-"+name, pth, fname, payload);
        });
        const remClientStreamStop = window.sio.onClientStreamStop((_, id, name, pth, fname, payload, meta) => {
            if (!confirm(id, meta)) return;
            name = String(name);
            pth = String(pth);
            fname = String(fname);
            console.log(this.id+":stream-stop", name, pth, fname, payload);
            this.post("stream-stop", name, pth, fname, payload);
            this.post("stream-stop-"+name, pth, fname, payload);
        });

        (async () => {
            await window.sio.clientMake(this.id, this.location);
            this.#destructionResolver.state = false;
        })();
    }

    get id() { return this.#id; }

    get location() { return this.#location; }

    get connected() { return this.#connectionResolver.state; }
    get disconnected() { return !this.connected; }
    get socketId() { return this.#socketId; }

    get destroyed() { return this.#destructionResolver.state; }
    get created() { return !this.destroyed; }

    async whenConnected() { await this.#connectionResolver.whenTrue(); }
    async whenNotConnected() { await this.#connectionResolver.whenFalse(); }
    async whenDisconnected() { return await this.whenNotConnected(); }
    async whenNotDisconnected() { return await this.whenConnected(); }
    async whenDestroyed() { await this.#destructionResolver.whenTrue(); }
    async whenNotDestroyed() { await this.#destructionResolver.whenFalse(); }
    async whenCreated() { return this.whenNotDestroyed(); }
    async whenNotCreated() { return this.whenDestroyed(); }

    async connect() {
        if (this.destroyed) return false;
        if (this.connected) return false;
        await window.sio.clientConn(this.id);
        return true;
    }
    async disconnect() {
        if (this.destroyed) return false;
        if (this.disconnected) return false;
        await window.sio.clientDisconn(this.id);
        return true;
    }
    async emit(name, payload) {
        if (this.destroyed) return null;
        if (this.disconnected) return null;
        return await window.sio.clientEmit(this.id, name, payload);
    }
    async stream(pth, name, payload) {
        if (this.destroyed) return null;
        if (this.disconnected) return null;
        return await window.sio.clientStream(this.id, pth, name, payload);
    }

    async destroy() {
        if (this.destroyed) return false;
        await window.sio.clientDestroy(this.id);
        this.#destructionResolver.state = true;
        return true;
    }
}

export class Odometry2d extends util.Target {
    #canvas;
    #ctx;
    #quality;
    #mouse;

    #render;

    #image;
    #imageShow;

    #doRender;

    #padding;

    #size;

    static BEFOREGRID = 0;
    static AFTERGRID = 1;
    static BEFOREIMAGE = 1;
    static AFTERIMAGE = 2;
    static BEFOREBORDER = 2;
    static AFTERBORDER = 3;

    constructor(canvas) {
        super();

        this.#canvas = null;
        this.#ctx = null;
        this.#quality = 1;
        this.#mouse = new V();

        this.#render = new Odometry2d.Render(this, 0);

        this.#image = new Image();
        this.#imageShow = null;

        this.#doRender = true;

        this.#padding = 0;

        this.#size = new V();

        this.canvas = canvas;
        this.quality = 2;

        this.padding = 40;

        this.size = 1000;

        this.addHandler("update", delta => {
            if (!this.doRender) return;
            if (!this.hasCanvas()) return;
            const ctx = this.ctx, quality = this.quality, padding = this.padding, scale = this.scale;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            const mnx = (ctx.canvas.width - this.w*scale*quality)/2, mxx = (ctx.canvas.width + this.w*scale*quality)/2;
            const mny = (ctx.canvas.height - this.h*scale*quality)/2, mxy = (ctx.canvas.height + this.h*scale*quality)/2;
            
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(0);

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.fillStyle = PROPERTYCACHE.get("--v4");
            ctx.font = (12*quality)+"px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            let y0 = mny;
            let y1 = mxy;
            let y2 = mxy + 5*quality;
            let y3 = mxy + 10*quality;
            for (let i = 0; i <= Math.floor(this.w/100); i++) {
                let x = util.lerp(mnx, mxx, (i*100) / this.w);
                ctx.strokeStyle = PROPERTYCACHE.get("--v4");
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
                ctx.strokeStyle = PROPERTYCACHE.get("--v2");
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, y1);
                ctx.stroke();
                if (i%2 == 1 && i < Math.floor(this.w/100)) continue;
                ctx.fillText(i, x, y3);
            }
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            let x0 = mxx;
            let x1 = mnx;
            let x2 = mnx - 5*quality;
            let x3 = mnx - 10*quality;
            for (let i = 0; i <= Math.floor(this.h/100); i++) {
                let y = util.lerp(mxy, mny, (i*100) / this.h);
                ctx.strokeStyle = PROPERTYCACHE.get("--v4");
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();
                ctx.strokeStyle = PROPERTYCACHE.get("--v2");
                ctx.beginPath();
                ctx.moveTo(x0, y);
                ctx.lineTo(x1, y);
                ctx.stroke();
                if (i%2 == 1 && i < Math.floor(this.h/100)) continue;
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
            ctx.strokeStyle = PROPERTYCACHE.get("--v4");
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.strokeRect(mnx, mny, mxx-mnx, mxy-mny);

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.render.render(3);
        });
    }

    get canvas() { return this.#canvas; }
    set canvas(v) {
        v = (v instanceof HTMLCanvasElement) ? v : null;
        if (this.canvas == v) return;
        if (this.hasCanvas()) {
            this.canvas.removeEventListener("mousemove", this.canvas._onMouseMove);
            delete this.canvas._onMouseMove;
        }
        this.#canvas = v;
        if (this.hasCanvas()) {
            this.canvas._onMouseMove = e => this.#mouse.set(e.pageX, e.pageY);
            this.canvas.addEventListener("mousemove", this.canvas._onMouseMove);
        }
        this.#ctx = this.hasCanvas() ? this.canvas.getContext("2d") : null;
        this.update(0);
    }
    hasCanvas() { return !!this.canvas; }
    get ctx() { return this.#ctx; }
    get quality() { return this.#quality; }
    set quality(v) { this.#quality = Math.max(1, util.ensure(v, "int")); }
    get mouse() { return new V(this.#mouse); }

    get render() { return this.#render; }

    get imageSrc() { return this.#image.src; }
    set imageSrc(v) {
        if (v == null) return this.#imageShow = null;
        if (this.#imageShow == v) return;
        this.#imageShow = v;
        this.#image.src = v;
    }

    get doRender() { return this.#doRender; }
    set doRender(v) { this.#doRender = !!v; }

    get padding() { return this.#padding; }
    set padding(v) { this.#padding = Math.max(0, util.ensure(v, "num")); }

    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }

    get scale() {
        if (!this.hasCanvas()) return;
        return Math.min(((this.canvas.width/this.quality) - 2*this.padding)/this.w, ((this.canvas.height/this.quality) - 2*this.padding)/this.h);
    }

    get hovered() { return this.render.theHovered; }
    get hoveredPart() {
        let hovered = this.hovered;
        if (!hovered) return null;
        return hovered.hovered;
    }

    worldToCanvas(...p) {
        if (!this.hasCanvas()) return new V(...p);
        const scale = this.scale;
        let [x, y] = new V(...p).xy;
        x = (x - this.w/2) * (scale*this.quality) + this.canvas.width/2;
        y = (this.h/2 - y) * (scale*this.quality) + this.canvas.height/2;
        return new V(x, y);
    }
    worldLenToCanvas(l) {
        l = util.ensure(l, "num");
        if (!this.hasCanvas()) return l;
        return l*(this.scale*this.quality);
    }
    canvasToWorld(...p) {
        if (!this.hasCanvas()) return new V(...p);
        const scale = this.scale;
        let [x, y] = new V(...p).xy;
        x = (x - this.canvas.width/2) / (scale*this.quality) + this.w/2;
        y = this.h/2 - (y - this.canvas.height/2) / (scale*this.quality);
        return new V(x, y);
    }
    canvasLenToWorld(l) {
        l = util.ensure(l, "num");
        if (!this.hasCanvas()) return l;
        return l/(this.scale*this.quality);
    }
    canvasToPage(...p) {
        if (!this.hasCanvas()) return new V(...p);
        let [x, y] = new V(...p).xy;
        let r = this.canvas.getBoundingClientRect();
        x /= this.quality; y /= this.quality;
        x += r.left; y += r.top;
        return new V(x, y);
    }
    canvasLenToPage(l) {
        l = util.ensure(l, "num");
        if (!this.hasCanvas()) return l;
        return l/this.quality;
    }
    pageToCanvas(...p) {
        let [x, y] = new V(...p).xy;
        if (!this.hasCanvas()) return new V(x, y);
        let r = this.canvas.getBoundingClientRect();
        x -= r.left; y -= r.top;
        x *= this.quality; y *= this.quality;
        return new V(x, y);
    }
    pageLenToCanvas(l) {
        l = util.ensure(l, "num");
        if (!this.hasCanvas()) return l;
        return l*this.quality;
    }
    worldToPage(...p) { return this.canvasToPage(this.worldToCanvas(...p)); }
    worldLenToPage(l) { return this.canvasLenToPage(this.worldLenToCanvas(l)); }
    pageToWorld(...p) { return this.canvasToWorld(this.pageToCanvas(...p)); }
    pageLenToWorld(l) { return this.canvasLenToWorld(this.pageLenToCanvas(l)); }

    update(delta) { this.post("update", delta); }
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

        if (!(parent instanceof Odometry2d || parent instanceof Odometry2d.Render)) throw new Error("Odometry is not of class Odometry2d nor of class Odometry2dRender");
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
        let m = this.odometry.pageToWorld(this.odometry.mouse);
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
        let m = this.odometry.pageToWorld(this.odometry.mouse);
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

export class Explorer extends util.Target {
    #nodes;

    #elem;

    constructor() {
        super();

        this.#nodes = {};

        this.#elem = document.createElement("div");
        this.elem.classList.add("explorer");
    }

    get nodes() { return Object.keys(this.#nodes); }
    get nodeObjects() { return Object.values(this.#nodes); }
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
            node.addLinkedHandler(this, "trigger", (e, path) => this.post("trigger", e, path));
            node.addLinkedHandler(this, "trigger2", (e, path) => this.post("trigger2", e, path));
            node.addLinkedHandler(this, "drag", (e, path) => this.post("drag", e, path));
            this.elem.appendChild(node.elem);
            node.onAdd();
            return node;
        });
        this.format();
        return r;
    }
    rem(...nodes) {
        return util.Target.resultingForEach(nodes, node => {
            if (!(node instanceof Explorer.Node)) return false;
            if (!this.has(node)) return false;
            node.onRem();
            delete this.#nodes[node.name];
            node.clearLinkedHandlers(this, "trigger");
            node.clearLinkedHandlers(this, "drag");
            this.elem.removeChild(node.elem);
            return node;
        });
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
        this.nodeObjects.sort((a, b) => util.compareStr(a.name, b.name)).forEach((node, i) => {
            node.elem.style.order = i;
            node.format();
        });
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
    #eMain;
    #eIcon;
    #eName;
    #eTag;
    #eValueBox;
    #eValue;
    #eSide;

    static doubleTraverse(nodeArr, enodeArr, addFunc, remFunc, dumpFunc) {
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
            this.post("trigger2", e, [this.name]);
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
        this.updateDisplay();
    }
    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eMain() { return this.#eMain; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get eTag() { return this.#eTag; }
    get eValueBox() { return this.#eValueBox; }
    get eValue() { return this.#eValue; }
    get eSide() { return this.#eSide; }

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
    updateDisplay() {
        this.eValueBox.style.display = this.showValue ? "" : "none";
        this.eValue.textContent = this.value;
        this.post("update-display");
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

    format() {
        this.updateDisplay();
        this.explorer.format();
    }
}
