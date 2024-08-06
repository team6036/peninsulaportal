import * as util from "./util.mjs";
import { V } from "./util.mjs";
import * as lib from "./lib.mjs";

import * as core from "./core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "./core.mjs";

import { Odometry2d, Odometry3d } from "./odometry.mjs";


window.util = util;
window.lib = lib;

Object.defineProperty(window, "app", {
    get: () => App.instance,
});


let APPINSTANCE = null;
export class App extends util.Target {
    #setupDone;

    #packaged;

    #fullscreen;
    #holiday;

    #popups;

    #hints;

    #menu;

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
    #eOverlay;
    #eRunInfo;

    static get instance() {
        if (!APPINSTANCE) (new this()).start();
        return APPINSTANCE;
    }

    constructor() {
        super();

        if (APPINSTANCE) throw new Error("An instance of App has already been created");
        APPINSTANCE = this;

        this.#setupDone = false;

        this.#packaged = true;

        this.#fullscreen = null;
        this.#holiday = null;

        this.#popups = new Set();

        this.#hints = new Set();

        this.#menu = null;

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

        this.addHandler("start", async () => {
            await window.buildAgent();
            this.menu = core.Menu.buildWholeMenu();
            let id = setInterval(async () => {
                if (document.readyState != "complete") return;
                clearInterval(id);

                await GLOBALSTATE.get();

                await this.postResult("pre-setup");

                await this.setup();

                const eRunInfoCanvas = document.createElement("canvas");
                this.eRunInfo.appendChild(eRunInfoCanvas);
                eRunInfoCanvas.width = 400;
                eRunInfoCanvas.height = 200;
                eRunInfoCanvas.style.width = "200px";
                eRunInfoCanvas.style.height = "100px";
                const ctx = eRunInfoCanvas.getContext("2d");
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 1;

                const eRunInfoDeltaEntry = document.createElement("div");
                this.eRunInfo.appendChild(eRunInfoDeltaEntry);
                eRunInfoDeltaEntry.innerHTML = "<div>DELTA (ms):</div><div></div>";
                const eRunInfoDeltaEntryValue = eRunInfoDeltaEntry.children[1];

                const eRunInfoFPSInstEntry = document.createElement("div");
                this.eRunInfo.appendChild(eRunInfoFPSInstEntry);
                eRunInfoFPSInstEntry.innerHTML = "<div>FPS (inst):</div><div></div>";
                const eRunInfoFPSInstEntryValue = eRunInfoFPSInstEntry.children[1];

                const eRunInfoFPSEntry = document.createElement("div");
                this.eRunInfo.appendChild(eRunInfoFPSEntry);
                eRunInfoFPSEntry.innerHTML = "<div>FPS:</div><div></div>";
                const eRunInfoFPSEntryValue = eRunInfoFPSEntry.children[1];

                await this.postResult("post-setup");

                await Promise.all(this.pages.map(async name => await this.getPage(name).setup()));

                let appState = null;
                try {
                    appState = await window.api.get("state", "app-state");
                } catch (e) { await this.doError("State Error", "AppState Get", e); }

                try {
                    await this.loadState(appState);
                } catch (e) { await this.doError("Load Error", "AppState", e); }

                let page = "";
                try {
                    page = await window.api.get("state", "page");
                } catch (e) { await this.doError("State Error", "CurrentPage Get", e); }

                let pageState = null;
                try {
                    pageState = await window.api.get("state", "page-state");
                } catch (e) { await this.doError("State Error", "PageState Get", e); }

                let pagePersistentStates = {};
                try {
                    pagePersistentStates = util.ensure(await window.api.get("state", "page-persistent-states"), "obj");
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
                let buff = [];

                const update = async () => {
                    window.requestAnimationFrame(update);
                    let t1 = util.getTime();
                    if (t0 == null || error) return t0 = t1;
                    const delta = t1-t0;
                    if (delta > 1000) this.post("cmd-check");
                    try {
                        if (this.runInfoShown) {
                            buff.unshift(delta);
                            let l = ctx.canvas.width;
                            if (buff.length > l) buff.splice(l);
                            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                            ctx.beginPath();
                            let py = null;
                            for (let i = 0; i < l; i++) {
                                if (i >= buff.length) break;
                                let x = ctx.canvas.width * (1 - i/l);
                                let y = ctx.canvas.height * (1 - buff[i]/Math.max(100, ...buff));
                                x = Math.round(x);
                                y = Math.round(y);
                                if (py == null) ctx.moveTo(x, y);
                                else {
                                    ctx.lineTo(x, py);
                                    ctx.lineTo(x, y);
                                }
                                py = y;
                            }
                            ctx.stroke();
                            eRunInfoDeltaEntryValue.textContent = delta;
                            eRunInfoFPSInstEntryValue.textContent = Math.floor(1000/delta);
                            eRunInfoFPSEntryValue.textContent = fps;
                        }
                        fpst += delta; fpsn++;
                        if (fpst >= 1000) {
                            fpst -= 1000;
                            fps = fpsn;
                            fpsn = 0;
                        }
                        this.update(delta);
                    } catch (e) {
                        error = true;
                        await this.doError("Update Error", "", e);
                        error = false;
                        return t0 = null;
                    }
                    t0 = t1;
                };
                update();
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
    get name() { return window.agent().name; }
    getName() { return lib.getName(this.name); }
    getIcon() { return lib.getIcon(this.name); }
    get id() { return window.agent().id; }

    static async createMarkdown(pth, signal) {
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
        article.innerHTML = converter.makeHtml(await (await fetch(pth)).text());
        const dfs = async elem => {
            let skip = await (async () => {
                if (elem instanceof HTMLImageElement && elem.classList.contains("docs-icon")) {
                    const onHolidayState = async () => {
                        const holiday = await window.api.get("active-holiday");
                        const holidayData = util.ensure(util.ensure(await window.api.get("holidays"), "obj")[holiday], "obj");
                        elem.src = 
                            ((holiday == null) || ("icon" in holidayData && !holidayData.icon)) ?
                                "./assets/app/icon.png" :
                            "file://"+util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").png;
                    };
                    signal.addHandler("check", onHolidayState);
                    await onHolidayState();
                    return true;
                }
                if (elem instanceof HTMLAnchorElement) {
                    if (elem.classList.contains("back")) {
                        elem.setAttribute("href", "");
                        elem.addEventListener("click", e => {
                            e.stopPropagation();
                            e.preventDefault();
                            signal.post("back", e);
                        });
                        return false;
                    }
                    let href = elem.getAttribute("href");
                    if (!href.startsWith("./") && !href.startsWith("../")) return false;
                    elem.setAttribute("href", "");
                    elem.addEventListener("click", e => {
                        e.stopPropagation();
                        e.preventDefault();
                        const eBase = document.querySelector("base");
                        signal.post("nav", e, String(new URL(href, new URL(pth, eBase ? new URL(eBase.href, window.location) : window.location))));
                    });
                    return false;
                }
                if (elem.tagName == "BLOCKQUOTE") {
                    if (elem.children.length != 1) return false;
                    let p = elem.children[0];
                    if (!(p instanceof HTMLParagraphElement)) return false;
                    let text = p.childNodes[0];
                    if (!(text instanceof Text)) return;
                    const tags = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];
                    const trueTags = tags.map(tag => "[!"+tag+"]");
                    if (!trueTags.includes(text.textContent)) return;
                    const tag = tags[trueTags.indexOf(text.textContent)];
                    elem.style.setProperty("--color", "var(--"+{
                        NOTE: "a",
                        TIP: "cg",
                        IMPORTANT: "cp",
                        WARNING: "cy",
                        CAUTION: "cr",
                    }[tag]+"5)");
                    if (text.nextElementSibling instanceof HTMLBRElement) text.nextElementSibling.remove();
                    text.remove();
                    let header = document.createElement("p");
                    elem.insertBefore(header, p);
                    header.classList.add("header");
                    header.innerHTML = "<ion-icon></ion-icon>";
                    header.children[0].name = {
                        NOTE: "information-circle-outline",
                        TIP: "bulb-outline",
                        IMPORTANT: "alert-circle-outline",
                        WARNING: "warning-outline",
                        CAUTION: "warning-outline",
                    }[tag];
                    header.appendChild(document.createTextNode(util.formatText(tag)));
                    return false;
                }
            })();
            if (skip) return;
            ["href", "src"].forEach(attr => {
                if (!elem.hasAttribute(attr)) return;
                let v = elem.getAttribute(attr);
                if (!v.startsWith("./") && !v.startsWith("../")) return;
                const eBase = document.querySelector("base");
                v = String(new URL(v, new URL(pth, eBase ? new URL(eBase.href, window.location) : window.location)));
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
    async createMarkdown(pth, signal) {
        if (!(signal instanceof util.Target)) signal = new util.Target();
        this.addHandler("cmd-check", () => signal.post("check"));
        return await App.createMarkdown(pth, signal);
    }
    static evaluateLoad(load) {
        let loadValue = String(load);
        load = loadValue.split(":");
        let elem = document.createElement("div");
        const name = load.shift();
        (() => {
            let namefs = {
                "fs-version": () => {
                    if (load.length > 0) {
                        elem.textContent = "Check data version error: "+load.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Checking data version";
                    return true;
                },
                "get-host": () => {
                    if (load.length > 0) {
                        elem.textContent = "Get host error: "+load.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Getting host";
                    return true;
                },
                "get-next-host": () => {
                    if (load.length > 0) {
                        elem.textContent = "Get next host error: "+load.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Getting next host";
                    return true;
                },
                "poll-host": () => {
                    if (load.length > 0) {
                        elem.textContent = "Poll host error: "+load.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Polling host";
                    return true;
                },
                "assets-data": () => {
                    if (load.length > 0) {
                        elem.textContent = "Find assets data error: "+load.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Finding assets data";
                    return true;
                },
                "assets": () => {
                    if (load.length > 0) {
                        elem.textContent = "Find assets error: "+load.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Finding assets";
                    return true;
                },
                
                "config.json": () => {
                    if (load.length > 0) {
                        elem.textContent = "Download config error: "+load.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Downloading config";
                    return true;
                },
            };
            if (name in namefs) if (namefs[name]()) return;
            if (name.startsWith("dl-")) {
                const type = name.split("-").slice(1).join("-");
                let typefs = {
                    themes: () => {
                        if (load.length < 1) return false;
                        const id = load.shift();
                        if (id == "config") {
                            if (load.length > 0) {
                                elem.textContent = `Download themes config error: `+load.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading themes config`;
                            return true;
                        }
                        if (load.length < 1) return false;
                        const name = load.shift();
                        let namefs = {
                            "config.json": "config",
                        };
                        if (!(name in namefs)) return false;
                        if (load.length > 0) {
                            elem.textContent = `Download theme ${id} ${namefs[name]} error: `+load.join(":");
                            elem.style.color = "var(--cr)";
                        } else elem.textContent = `Downloading theme ${id} ${namefs[name]}`;
                        return true;
                    },
                    templates: () => {
                        if (load.length < 1) return false;
                        const id = load.shift();
                        if (id == "config") {
                            if (load.length > 0) {
                                elem.textContent = `Download templates config error: `+load.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading templates config`;
                            return true;
                        }
                        if (load.length < 1) return false;
                        const name = load.shift();
                        let namefs = {
                            "config.json": "config",
                            "model.glb": "model",
                            "image.png": "image",
                        };
                        if (!(name in namefs)) return false;
                        if (load.length > 0) {
                            elem.textContent = `Download template ${id} ${namefs[name]} error: `+load.join(":");
                            elem.style.color = "var(--cr)";
                        } else elem.textContent = `Downloading template ${id} ${namefs[name]}`;
                        return true;
                    },
                    robots: () => {
                        if (load.length < 1) return false;
                        const id = load.shift();
                        if (id == "config") {
                            if (load.length > 0) {
                                elem.textContent = `Download robots config error: `+load.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading robots config`;
                            return true;
                        }
                        if (load.length < 1) return false;
                        const name = load.shift();
                        if (name.endsWith(".glb")) {
                            if (load.length > 0) {
                                elem.textContent = `Download robot ${id} ${name.slice(0, -4)} error: `+load.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading robot ${id} ${name.slice(0, -4)}`;
                            return true;
                        }
                        let namefs = {
                            "config.json": "config",
                        };
                        if (!(name in namefs)) return false;
                        if (load.length > 0) {
                            elem.textContent = `Download robot ${id} ${namefs[name]} error: `+load.join(":");
                            elem.style.color = "var(--cr)";
                        } else elem.textContent = `Downloading robot ${id} ${namefs[name]}`;
                        return true;
                    },
                    holidays: () => {
                        if (load.length < 1) return false;
                        const id = load.shift();
                        if (id == "config") {
                            if (load.length > 0) {
                                elem.textContent = `Download holidays config error: `+load.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading holidays config`;
                            return true;
                        }
                        if (load.length < 1) return false;
                        const name = load.shift();
                        let namefs = {
                            "config.json": "config",
                            "svg.svg": "svg icon",
                            "png.png": "png icon",
                            "hat-1.svg": "hat 1 svg",
                            "hat-2.svg": "hat 2 svg",
                        };
                        if (!(name in namefs)) return false;
                        if (load.length > 0) {
                            elem.textContent = `Download holiday ${id} ${namefs[name]} error: `+load.join(":");
                            elem.style.color = "var(--cr)";
                        } else elem.textContent = `Downloading holiday ${id} ${namefs[name]}`;
                        return true;
                    },
                };
                if (type in typefs) if (typefs[type]()) return;
            }
            elem.textContent = loadValue;
            elem.style.color = "var(--cy)";
        })();
        return elem;
    }

    get packaged() { return this.#packaged; }

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
    get holiday() { return this.#holiday; }
    set holiday(v) {
        v = (v == null) ? null : String(v);
        if (this.holiday == v) return;
        this.#holiday = v;
        this.updateDynamicStyle();
    }

    async setup() {
        if (this.setupDone) return false;

        window.api.onPerm(async () => {
            let perm = await this.getPerm();
            try {
                window.api.sendPerm(perm);
            } catch (e) { await this.doError("Permission Send Error", "", e); }
        });
        window.api.on((_, cmd, ...a) => {
            cmd = String(cmd);
            this.post("cmd", cmd, ...a);
            this.post("cmd-"+cmd, ...a);
        });
        window.api.onMessage((_, name, ...a) => {
            name = String(name);
            this.post("msg", name, ...a);
            this.post("msg-"+name, ...a);
        });
        this.addHandler("perm", async () => {
            try {
                await window.api.set("state", "app-state", this.state);
            } catch (e) { await this.doError("State Error", "AppState Set", e); }
            if (this.hasPage(this.page)) {
                try {
                    await window.api.set("state", "page", this.page);
                } catch (e) { await this.doError("State Error", "CurrentPage Set", e); }
                try {
                    await window.api.set("state", "page-state", this.getPage(this.page).state);
                } catch (e) { await this.doError("State Error", "PageState Set", e); }
            }
            let pagePersistentStates = {};
            this.pages.forEach(name => (pagePersistentStates[name] = this.getPage(name).persistentState));
            try {
                await window.api.set("state", "page-persistent-states", pagePersistentStates);
            } catch (e) { await this.doError("State Error", "PagePersistentStates Set", e); }
            return true;
        });
        this.addHandler("cmd-check", async () => {
            const templatesPrev = GLOBALSTATE.getProperty("templates").value;
            const robotsPrev = GLOBALSTATE.getProperty("robots").value;
            await GLOBALSTATE.get();
            const templatesCurr = GLOBALSTATE.getProperty("templates").value;
            const robotsCurr = GLOBALSTATE.getProperty("robots").value;
            if (!util.equals(templatesCurr, templatesPrev)) Odometry3d.decacheAllFields();
            if (!util.equals(robotsCurr, robotsPrev)) Odometry3d.decacheAllRobots();
        });
        this.addHandler("cmd-about", async () => {
            const holiday = this.holiday;
            const holidayData = util.ensure(util.ensure(await window.api.get("holidays"), "obj")[holiday], "obj");
            let pop = this.confirm();
            pop.cancel = "Documentation";
            pop.iconSrc = 
                ((holiday == null) || ("icon" in holidayData && !holidayData.icon)) ?
                    "./assets/app/icon.svg" :
                "file://"+util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").svg;
            pop.iconColor = "var(--a)";
            pop.subIcon = util.is(this.getIcon(), "str") ? this.getIcon() : "";
            pop.title = "Peninsula "+this.getName();
            pop.infos = [this.getAgent().join("\n")];
            let r = await pop.whenResult();
            if (r) return;
            this.post("cmd-documentation");
        });
        this.addHandler("cmd-documentation", async () => {
            const name = this.getName();
            if (name == "PORTAL") this.addPopup(new App.MarkdownPopup("../README.md"));
            else this.addPopup(new App.MarkdownPopup("../docs/"+name.toLowerCase()+"/MAIN.md"));
        });
        this.addHandler("cmd-spawn", async name => {
            name = String(name);
            if (!this.packaged && ["PYTHONTK"].includes(name)) {
                let pop = this.confirm(
                    "Open "+lib.getName(name),
                    "Are you sure you want to open this feature?\nThis feature is in development and might contain bugs",
                );
                let result = await pop.whenResult();
                if (!result) return;
            }
            try {
                await window.api.send("spawn", name);
            } catch (e) { await this.doError("Spawn Error", "SpawnName: "+name, e); }
        });
        this.addHandler("cmd-reload", async () => await window.api.send("reload"));
        this.addHandler("cmd-helpurl", async id => await window.api.send("open", await window.api.get(id)));
        this.addHandler("cmd-fullscreen", async v => {
            this.fullscreen = v;
        });
        this.addHandler("cmd-check", async () => (this.holiday = await window.api.get("active-holiday")));

        this.addHandler("cmd-menu-click", async id => {
            let itm = this.menu.getItemById(id);
            if (!itm) return;
            itm.post("trigger", null);
        });

        this.#packaged = !!(await window.api.get("packaged"));

        this.#eTitle = document.querySelector("head > title");
        if (!(this.eTitle instanceof HTMLTitleElement)) this.#eTitle = document.createElement("title");
        document.head.appendChild(this.eTitle);
        this.title = "";

        this.#eCoreStyle = document.createElement("link");
        document.head.appendChild(this.eCoreStyle);
        this.eCoreStyle.rel = "stylesheet";
        this.eCoreStyle.href = "./style.css";

        this.#eStyle = document.createElement("link");
        document.head.appendChild(this.eStyle);
        this.eStyle.rel = "stylesheet";
        this.eStyle.href = new URL("style.css", window.location);

        this.#eDynamicStyle = document.createElement("style");
        document.head.appendChild(this.eDynamicStyle);

        this.#eTitleBar = document.getElementById("titlebar");
        if (!(this.#eTitleBar instanceof HTMLDivElement)) this.#eTitleBar = document.createElement("div");
        document.body.appendChild(this.eTitleBar);
        this.eTitleBar.id = "titlebar";

        this.#eMount = document.getElementById("mount");
        if (!(this.#eMount instanceof HTMLDivElement)) this.#eMount = document.createElement("div");
        this.eMount.remove();
        if (document.body.children[0] instanceof HTMLElement)
            document.body.insertBefore(this.eMount, document.body.children[0]);
        else document.body.appendChild(this.eMount);
        this.eMount.id = "mount";

        this.#eOverlay = document.getElementById("overlay");
        if (!(this.#eOverlay instanceof HTMLDivElement)) this.#eOverlay = document.createElement("div");
        this.eOverlay.remove();
        if (document.body.children[1] instanceof HTMLElement)
            document.body.insertBefore(this.eOverlay, document.body.children[1]);
        else document.body.appendChild(this.eOverlay);
        this.eOverlay.id = "overlay";

        this.#eRunInfo = document.getElementById("runinfo");
        if (!(this.#eRunInfo instanceof HTMLDivElement)) this.#eRunInfo = document.createElement("div");
        this.eRunInfo.remove();
        this.eMount.appendChild(this.eRunInfo);
        this.eRunInfo.id = "runinfo";
        this.eRunInfo.innerHTML = "";
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
        }, 500);
        this.eTitleBar.style.opacity = "0%";
        this.eMount.style.opacity = "0%";

        this.#eDrag = document.getElementById("drag");
        if (!(this.#eDrag instanceof HTMLDivElement)) this.#eDrag = document.createElement("div");
        document.body.appendChild(this.eDrag);
        this.eDrag.id = "drag";

        const ionicons1 = document.createElement("script");
        document.body.appendChild(ionicons1);
        ionicons1.type = "module";
        ionicons1.src = "../node_modules/ionicons/dist/ionicons/ionicons.esm.js";
        const ionicons2 = document.createElement("script");
        document.body.appendChild(ionicons2);
        ionicons2.noModule = true;
        ionicons2.src = "../node_modules/ionicons/dist/ionicons/ionicons.js";

        const showdown = document.createElement("script");
        document.head.appendChild(showdown);
        showdown.src = "./assets/modules/showdown.min.js";

        const highlight1 = document.createElement("script");
        document.head.appendChild(highlight1);
        highlight1.src = "./assets/modules/highlight.min.js";
        const highlight2 = document.createElement("link");
        document.head.appendChild(highlight2);
        highlight2.rel = "stylesheet";

        const qrcode = document.createElement("script");
        document.head.appendChild(qrcode);
        qrcode.src = "./assets/modules/qrcode.min.js";
        
        let t = util.getTime();
        
        this.fullscreen = await window.api.get("fullscreen");
        this.holiday = await window.api.get("active-holiday");

        let agent = window.agent();
        document.documentElement.style.setProperty(
            "--WIN32",
            +(util.is(agent.os, "obj") && (agent.os.platform == "win32")),
        );
        document.documentElement.style.setProperty(
            "--DARWIN",
            +(util.is(agent.os, "obj") && (agent.os.platform == "darwin")),
        );
        document.documentElement.style.setProperty(
            "--LINUX",
            +(util.is(agent.os, "obj") && (agent.os.platform == "linux")),
        );
        PROPERTYCACHE.clear();

        let lock = false;
        const update = async () => {
            if (lock) return;
            lock = true;
            if (await window.api.get("reduced-motion"))
                document.documentElement.style.setProperty("--t", "0s");
            else document.documentElement.style.removeProperty("--t");
            let theme = await window.api.get("active-theme");
            theme = util.is(theme, "obj") ? theme : String(theme);
            let data = 
                util.is(theme, "obj") ?
                    theme :
                util.ensure(util.ensure(await window.api.get("themes"), "obj")[theme], "obj");
            this.base = data.base || Array.from(new Array(9).keys()).map(i => new Array(3).fill(255*i/9));
            let darkWanted = !!(await window.api.get("dark-wanted"));
            highlight2.href = "./assets/modules/" + (darkWanted ? "highlight-dark.min.css" : "highlight-light.min.css");
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
            lock = false;
        };
        this.addHandler("cmd-check", update);
        await update();

        await this.postResult("setup");

        const updatePage = () => {
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
                    elem.children[1].textContent = this.getName();
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
                const onHolidayState = async () => {
                    const holiday = await window.api.get("active-holiday");
                    if (holiday == null) return elem.classList.remove("special");
                    const holidayIconData = util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj");
                    if (!("hat1" in holidayIconData) && !("hat2" in holidayIconData)) return elem.classList.remove("special");
                    elem.classList.add("special");
                    if ("hat2" in holidayIconData) {
                        let eSpecialBack = elem.querySelector(".special.back");
                        if (eSpecialBack instanceof HTMLImageElement)
                            eSpecialBack.src = "file://"+holidayIconData.hat2;
                    }
                    if ("hat1" in holidayIconData) {
                        let eSpecialFront = elem.querySelector(".special.front");
                        if (eSpecialFront instanceof HTMLImageElement)
                            eSpecialFront.src = "file://"+holidayIconData.hat1;
                    }
                };
                this.addHandler("cmd-check", onHolidayState);
                await onHolidayState();
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
        // }, Math.max(0, 1250 - (util.getTime()-t) + 1000));
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
        let accent = 
            (this.holiday == null) ?
                this.accent :
            util.ensure(util.ensure(await window.api.get("holidays"), "obj")[this.holiday], "obj").accent;
        let style = {};
        let v0 = this.getBase(0), v4 = this.getBase(4), v8 = this.getBase(8);
        if (!(v0 instanceof util.Color)) v0 = new util.Color(0, 0, 0);
        if (!(v4 instanceof util.Color)) v4 = new util.Color(128, 128, 128);
        if (!(v8 instanceof util.Color)) v8 = new util.Color(255, 255, 255);
        let v0Avg = (v0.r+v0.g+v0.b)/3, v8Avg = (v8.r+v8.g+v8.b)/3;
        let dark = v8Avg > v0Avg;
        for (let i = 0; i <= 9; i++) {
            let normal = (i < 9);
            for (let j = 0; j < 16; j++) {
                let alpha = j/15;
                let hex = "0123456789abcdef"[j];
                if (normal) {
                    let vi = this.getBase(i);
                    if (!(vi instanceof util.Color)) vi = new util.Color(...new Array(3).fill(255*(i/8)));
                    // vi = (i < 2) ? v0 : util.lerp(vi, v8, 0.5);
                    style["v"+i+"-"+hex] = "rgba("+[...vi.rgb, alpha].join(",")+")";
                } else style["v-"+hex] = "var(--v4-"+hex+")";
            }
            if (normal) style["v"+i] = "var(--v"+i+"-f)";
            else style["v"] = "var(--v-f)";
        }
        let black = this.getBase(dark ? 1 : 8), middle = this.getBase(4), white = this.getBase(dark ? 8 : 1);
        if (!(black instanceof util.Color)) black = new util.Color(0, 0, 0);
        if (!(middle instanceof util.Color)) middle = new util.Color(128, 128, 128);
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
        await window.api.set("title-bar-overlay", {
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
        return this.#popups.has(pop);
    }
    addPopup(...pops) {
        return util.Target.resultingForEach(pops, pop => {
            if (!(pop instanceof App.PopupBase)) return false;
            if (this.hasPopup(pop)) this.remPopup(pop);
            this.#popups.add(pop);
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
            this.#popups.delete(pop);
            pop.clearLinkedHandlers(this, "result");
            window.api.set("closeable", this.popups.length <= 0);
            return pop;
        });
    }
    alert(...a) { return this.addPopup(new App.Alert(...a)); }
    error(...a) { return this.addPopup(new App.Error(...a)); }
    warn(...a) { return this.addPopup(new App.Warn(...a)); }
    success(...a) { return this.addPopup(new App.Success(...a)); }
    confirm(...a) { return this.addPopup(new App.Confirm(...a)); }
    prompt(...a) { return this.addPopup(new App.Prompt(...a)); }
    async doAlert(...a) { return await this.alert(...a).whenResult(); }
    async doError(...a) { return await this.error(...a).whenResult(); }
    async doWarn(...a) { return await this.warn(...a).whenResult(); }
    async doSuccess(...a) { return await this.success(...a).whenResult(); }
    async doConfirm(...a) { return await this.confirm(...a).whenResult(); }
    async doPrompt(...a) { return await this.prompt(...a).whenResult(); }

    get hints() { return [...this.#hints]; }
    set hints(v) {
        v = util.ensure(v, "arr");
        this.clearHints();
        this.addHint(v);
    }
    clearHints() {
        let hints = this.hints;
        this.remHint(hints);
        return hints;
    }
    hasHint(hint) {
        if (!(hint instanceof core.Hint)) return false;
        return this.#hints.has(hint);
    }
    addHint(...hints) {
        return util.Target.resultingForEach(hints, hint => {
            if (!(hint instanceof core.Hint)) return false;
            if (this.hasHint(hint)) return false;
            this.#hints.add(hint);
            this.eOverlay.appendChild(hint.elem);
            return hint;
        });
    }
    remHint(...hints) {
        return util.Target.resultingForEach(hints, hint => {
            if (!(hint instanceof core.Hint)) return false;
            if (!this.hasHint(hint)) return false;
            this.#hints.delete(hint);
            this.eOverlay.removeChild(hint.elem);
            return hint;
        });
    }

    get menu() { return this.#menu; }
    set menu(v) {
        if (!(v instanceof core.Menu)) return;
        if (this.menu == v) return;
        this.unbindMenu(this.menu);
        if (this.menu instanceof core.Menu)
            this.menu.clearLinkedHandlers(this, "change");
        this.#menu = v;
        this.menu.addLinkedHandler(this, "change", () => window.api.set("menu", this.menu.toObj()));
        window.api.set("menu", this.menu.toObj());
        this.bindMenu(this.menu);
    }
    bindMenu(menu) {
        if (!(menu instanceof core.Menu)) return false;
        lib.APPFEATURES.forEach(name => {
            let itm = menu.getItemById("spawn:"+name);
            if (!itm) return;
            itm.addLinkedHandler(this, "trigger", e => this.post("cmd-spawn", name));
        });
        ["repo", "db-host", "scout-url"].forEach(id => {
            let itm = menu.getItemById(id);
            if (!itm) return;
            itm.addLinkedHandler(this, "trigger", e => this.post("cmd-helpurl", id));
        });
        let itm;
        itm = menu.getItemById("about");
        if (itm) itm.addLinkedHandler(this, "trigger", e => this.post("cmd-about"));
        itm = menu.getItemById("settings");
        if (itm) itm.addLinkedHandler(this, "trigger", e => this.post("cmd-spawn", "PRESETS"));
        itm = menu.getItemById("reload");
        if (itm) itm.addLinkedHandler(this, "trigger", e => this.post("cmd-reload"));
        itm = menu.getItemById("documentation");
        if (itm) itm.addLinkedHandler(this, "trigger", e => this.post("cmd-documentation"));
        return menu;
    }
    unbindMenu(menu) {
        if (!(menu instanceof core.Menu)) return false;
        lib.APPFEATURES.forEach(name => {
            let itm = menu.getItemById("spawn:"+name);
            if (!itm) return;
            itm.clearLinkedHandlers(this, "trigger");
        });
        ["repo", "db-host", "scout-url"].forEach(id => {
            let itm = menu.getItemById(id);
            if (!itm) return;
            itm.clearLinkedHandlers(this, "trigger");
        });
        let itm;
        itm = menu.getItemById("about");
        if (itm) itm.clearLinkedHandlers(this, "trigger");
        itm = menu.getItemById("settings");
        if (itm) itm.clearLinkedHandlers(this, "trigger");
        itm = menu.getItemById("reload");
        if (itm) itm.clearLinkedHandlers(this, "trigger");
        return menu;
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

        let ids = {};

        this.pages.forEach(name => {
            const page = this.getPage(name);
            page.elem.classList.remove("this");
            page.post("pre-hide");
            ids[name] = setTimeout(() => page.post("post-hide"), 250);
        });

        if (this.hasPage(this.page)) await this.getPage(this.page).leave(data);

        this.#page = name;

        if (this.hasPage(this.page)) await this.getPage(this.page).enter(data);

        this.pages.forEach(name => {
            const page = this.getPage(name);
            if (name != this.page) return;
            clearTimeout(ids[name]);
            page.elem.classList.add("this");
            page.post("pre-show");
            setTimeout(() => page.post("post-show"), 250);
        });
    }

    get title() { return this.#title; }
    set title(v) {
        v = String(v);
        if (this.title == v) return;
        this.#title = v;
        let name = this.getName();
        this.eTitle.textContent = (v.length > 0) ? (v+" — "+name) : name;
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
    get eOverlay() { return this.#eOverlay; }
    get eRunInfo() { return this.#eRunInfo; }
    get runInfoShown() { return this.eRunInfo.classList.contains("this"); }
    set runInfoShown(v) {
        v = !!v;
        if (this.runInfoShown == v) return;
        if (v) this.eRunInfo.classList.add("this");
        else this.eRunInfo.classList.remove("this");
    }
    get runInfoHidden() { return !this.runInfoShown; }
    set runInfoHidden(v) { this.runInfoShown = !v; }
    showRunInfo() { return this.runInfoShown = true; }
    hideRunInfo() { return this.runInfoHidden = true; }

    get progress() {
        if (!this.eTitleBar.classList.contains("progress")) return null;
        let progress = this.eTitleBar.style.getPropertyValue("--progress");
        progress = progress.slice(0, -1);
        return Math.min(1, Math.max(0, util.ensure(parseFloat(progress), "num")/100));
    }
    set progress(v) {
        v = (v == null) ? null : Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (v == null) return this.eTitleBar.classList.remove("progress");
        this.eTitleBar.classList.add("progress");
        this.eTitleBar.style.setProperty("--progress", (v*100)+"%");
    }

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

        const onModify = data => {
            data = util.ensure(data, "obj");
            const props = util.ensure(data.props, "obj");
            const cmds = util.ensure(data.cmds, "arr");
            for (let k in props)
                this[k] = props[k];
            cmds.forEach(cmd => this.post("cmd-"+cmd));
        };

        this.addHandler("add", async () => {
            let agent = window.agent();
            this.#id = null;
            if (util.is(agent, "obj") && agent.os.platform == "darwin")
                this.#id = await window.modal.spawn(this.constructor.NAME, {
                    id: this.app.id,
                    props: this.generateParams(),
                });
            if (this.id == null) {
                document.body.appendChild(this.elem);
                setTimeout(() => {
                    this.elem.classList.add("in");
                }, 10);
            } else {
                const onChange = async () => await this.doModify({ props: this.generateParams() });
                this.addHandler("change", onChange);
                onChange();
                this.app.addLinkedHandler(this, "msg-modify", onModify);
                this.post("post-add");
            }
        });
        this.addHandler("rem", async () => {
            this.app.clearLinkedHandlers(this, "msg-modify");
            await this.doModify({
                cmds: ["close"],
            });
            if (document.body.contains(this.elem)) {
                this.elem.classList.remove("in");
                setTimeout(() => {
                    document.body.removeChild(this.elem);
                }, 250);
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

    get app() { return App.instance; }

    get id() { return this.#id; }
    async doModify(data) { return await window.api.sendMessage(this.id, "modify", data); }

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
        if (this.#resolver.state) return false;
        this.#resolver.state = true;
        this.#result = r;
        this.post("result", r);
        return true;
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
            if (!document.body.contains(this.elem))
                return document.body.removeEventListener("keydown", onKeyDown);
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
        const eBase = document.querySelector("base");
        href = 
            (this.#history.length > 0) ?
                String(new URL(href, new URL(this.#history.at(-1), eBase ? new URL(eBase.href, window.location) : window.location))) :
            String(new URL(href, eBase ? new URL(eBase.href, window.location) : window.location));
        this.#history.push(href);
        if (this.hasEArticle()) {
            let article = this.eArticle;
            this.#eArticle = null;
            if (direction == +1) article.classList.add("out-right");
            if (direction == -1) article.classList.add("out-left");
            setTimeout(() => article.remove(), 250);
        }
        try {
            this.#eArticle = await App.createMarkdown(href, this.signal);
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
        this.eIcon.removeAttribute("name");
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
        this.#infos = util.ensure(v, "arr").map(v => util.stringifyError(v));
        Array.from(this.inner.querySelectorAll(":scope > .info")).forEach(elem => elem.remove());
        let sibling = this.eContent.nextElementSibling;
        this.infos.forEach(info => {
            let elem = document.createElement("div");
            this.inner.insertBefore(elem, sibling);
            elem.classList.add("info");
            elem.innerHTML = info.replaceAll("<", "&lt").replaceAll(">", "&gt");
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

        this.addHandler("cmd-button", () => this.eButton.click());

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

        infos.map(info => console.error(info));
        this.infos = infos;
    }
};
App.Warn = class AppError extends App.Alert {
    constructor(title, content, ...infos) {
        super(title, content, "warning");

        this.iconColor = "var(--cy)";

        infos.map(info => console.warn(info));
        this.infos = infos;
    }
};
App.Success = class AppError extends App.Alert {
    constructor(title, content, ...infos) {
        super(title, content, "checkmark-circle");

        this.iconColor = "var(--cg)";

        infos.map(info => console.log(info));
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

        this.addHandler("cmd-confirm", () => this.eConfirm.click());
        this.addHandler("cmd-cancel", () => this.eCancel.click());

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
        this.addHandler("pre-result", r => this.result((r == null) ? null : !!r));

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
    #value;

    #eInput;
    #eConfirm;
    #eCancel;

    static NAME = "PROMPT";

    static {
        this.PARAMS = [...this.PARAMS, "type", "confirm", "cancel", "value", "placeholder"];
    }

    constructor(title, content, value="", icon="pencil", confirm="OK", cancel="Cancel", placeholder="...") {
        super(title, content, icon);

        this.addHandler("cmd-confirm", () => this.eConfirm.click());
        this.addHandler("cmd-cancel", () => this.eCancel.click());

        this.elem.classList.add("prompt");

        this.#type = "str";
        this.#doCast = v => v;
        this.#value = null;

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
            this.value = this.eInput.value;
        });
        this.eInput.addEventListener("keydown", e => {
            if (e.code != "Enter" && e.code != "Return") return;
            e.preventDefault();
            this.value = this.eInput.value;
            this.eConfirm.click();
        });
        this.eConfirm.addEventListener("click", e => {
            e.stopPropagation();
            this.result(this.value);
        });
        this.eCancel.addEventListener("click", e => {
            e.stopPropagation();
            this.result(null);
        });
        this.addHandler("pre-result", r => {
            this.value = r;
            this.result(this.value);
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
        this.value = this.cast(this.value);
    }
    customType() { return this.type == null; }
    get doCast() { return this.#doCast; }
    set doCast(v) {
        v = util.ensure(v, "func");
        if (this.doCast == v) return;
        this.change("doCast", this.doCast, this.#doCast=v);
        this.value = this.cast(this.value);
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

    get value() { return this.#value; }
    set value(v) {
        v = this.cast(v);
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
    }

    get placeholder() { return this.eInput.placeholder; }
    set placeholder(v) {
        [v, this.eInput.placeholder] = [this.placeholder, v];
        this.change("placeholder", v, this.placeholder);
    }

    cast(v) {
        if (v == null) return null;
        if (this.customType())
            return this.doCast(v);
        if (["any_num", "num", "float"].includes(this.type)) v = util.ensure(parseFloat(v), this.type);
        else if (["int"].includes(this.type)) v = util.ensure(parseInt(v), this.type);
        else v = util.ensure(v, this.type);
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
App.Page = class AppPage extends util.Target {
    #name;
    #elem;

    constructor(name) {
        super();

        this.#name = String(name);

        this.#elem = document.createElement("div");
        this.elem.id = this.name+"PAGE";
        this.elem.classList.add("page");
    }

    get name() { return this.#name; }
    get app() { return App.instance; }
    get elem() { return this.#elem; }

    async setup() {}

    get state() { return {}; }
    async loadState(state) {}
    get persistentState() { return {}; }
    async loadPersistentState(state) {}

    async enter(data) { return await this.postResult("enter", data); }
    async leave(data) { return await this.postResult("leave", data); }
    async determineSame(data) { return false; }

    update(delta) { this.post("update", delta); }
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

    static PROJECTCLASS = lib.Project;

    constructor() {
        super();

        this.#changes = new Set();

        this.#projects = {};

        this.addHandler("setup", async () => {
            this.#eFeatureStyle = document.createElement("link");
            document.head.appendChild(this.eFeatureStyle);
            this.eFeatureStyle.rel = "stylesheet";
            this.eFeatureStyle.href = "./style-feature.css";

            const checkSizes = async () => {
                let left = PROPERTYCACHE.get("--LEFT");
                left = util.ensure(parseFloat(left.slice(0, -2)), "num");
                let right = PROPERTYCACHE.get("--RIGHT");
                right = util.ensure(parseFloat(right.slice(0, -2)), "num");
                let w = left+right;
                w += Array.from(this.eTitleBar.querySelectorAll(":scope > *:not(.space)"))
                    .map(elem => elem.getBoundingClientRect().width)
                    .sum();
                w += window.outerWidth - window.innerWidth;
                await window.api.set("min-width", w);
                let h = PROPERTYCACHE.get("--TOP");
                h = util.ensure(parseFloat(h.slice(0, -2)), "num");
                h += window.outerHeight - window.innerHeight;
                await window.api.set("min-height", h);
            };
            new ResizeObserver(checkSizes).observe(document.body);

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
                core.Menu.contextMenu = this.bindMenu(core.Menu.buildMainMenu());
                core.Menu.placeContextMenu(e.pageX, e.pageY);
            });
            new ResizeObserver(checkSizes).observe(this.eTitleBtn);

            this.#eFileBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eFileBtn);
            this.eFileBtn.classList.add("nav");
            this.eFileBtn.classList.add("forproject");
            this.eFileBtn.textContent = "File";
            this.eFileBtn.addEventListener("click", e => {
                e.stopPropagation();
                let itm = this.menu.getItemById("menu:file");
                if (!itm) return;
                core.Menu.contextMenu = itm.menu;
                let r = this.eFileBtn.getBoundingClientRect();
                core.Menu.placeContextMenu(r.left, r.bottom);
            });
            new ResizeObserver(checkSizes).observe(this.eFileBtn);

            this.#eEditBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eEditBtn);
            this.eEditBtn.classList.add("nav");
            this.eEditBtn.classList.add("forproject");
            this.eEditBtn.textContent = "Edit";
            this.eEditBtn.addEventListener("click", e => {
                e.stopPropagation();
                let itm = this.menu.getItemById("menu:edit");
                if (!itm) return;
                core.Menu.contextMenu = itm.menu;
                let r = this.eEditBtn.getBoundingClientRect();
                core.Menu.placeContextMenu(r.left, r.bottom);
            });
            new ResizeObserver(checkSizes).observe(this.eEditBtn);

            this.#eViewBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eViewBtn);
            this.eViewBtn.classList.add("nav");
            this.eViewBtn.classList.add("forproject");
            this.eViewBtn.textContent = "View";
            this.eViewBtn.addEventListener("click", e => {
                e.stopPropagation();
                let itm = this.menu.getItemById("menu:view");
                if (!itm) return;
                core.Menu.contextMenu = itm.menu;
                let r = this.eViewBtn.getBoundingClientRect();
                core.Menu.placeContextMenu(r.left, r.bottom);
            });
            new ResizeObserver(checkSizes).observe(this.eViewBtn);

            this.#eProjectInfo = document.createElement("div");
            this.eTitleBar.appendChild(this.eProjectInfo);
            this.eProjectInfo.id = "projectinfo";
            this.eProjectInfo.classList.add("forproject");
            new ResizeObserver(checkSizes).observe(this.eProjectInfo);

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
            this.eProjectInfoBtnIcon.name = this.getIcon();

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
            new ResizeObserver(checkSizes).observe(this.eSaveBtn);

            this.#eProjectsBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eProjectsBtn);
            this.eProjectsBtn.classList.add("nav");
            this.eProjectsBtn.innerHTML = "<ion-icon name='folder'></ion-icon>";
            this.eProjectsBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.page = "PROJECTS";
            });
            new ResizeObserver(checkSizes).observe(this.eProjectsBtn);

            this.#eCreateBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eCreateBtn);
            this.eCreateBtn.classList.add("nav");
            this.eCreateBtn.innerHTML = "<ion-icon name='add'></ion-icon>";
            this.eCreateBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.page = "PROJECT";
            });
            new ResizeObserver(checkSizes).observe(this.eCreateBtn);
            
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
                if (!((source instanceof lib.Project) && (source instanceof this.constructor.PROJECTCLASS))) source = page.project;
                if (!((source instanceof lib.Project) && (source instanceof this.constructor.PROJECTCLASS))) return;
                let project = new this.constructor.PROJECTCLASS(source);
                if (!(project instanceof lib.Project)) return;
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
                let pop = this.confirm(
                    "Delete Projects",
                    "Are you sure you want to delete these projects?\nThis action is not reversible!",
                );
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
                let menu = this.menu.getItemById(id);
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
                            let itm = core.Menu.Item.fromObj(data);
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
            let itm = this.menu.getItemById("close");
            if (itm) itm.accelerator = "CmdOrCtrl+Shift+W";

            await this.postResult("pre-post-setup");

            [this.#titlePage, this.#projectsPage, this.#projectPage] = this.addPage(
                new this.constructor.TitlePage(),
                new this.constructor.ProjectsPage(),
                new this.constructor.ProjectPage(),
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
        let projectIds = util.ensure(await window.api.get("projects"), "arr").map(id => String(id));
        let projects = [];
        await Promise.all(projectIds.map(async id => {
            let projectContent = await window.api.get("project", id);
            let project = JSON.parse(projectContent, util.REVIVER.f);
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
        let oldIds = util.ensure(await window.api.get("projects"), "arr").map(id => String(id));
        let newIds = this.projects;
        await Promise.all(oldIds.map(async id => {
            if (newIds.includes(id)) return;
            await window.api.del("project", id);
        }));
        await Promise.all(newIds.map(async id => {
            if (!(changes.has("*") || changes.has(":"+id))) return;
            let project = this.getProject(id);
            if (!changes.has("*")) project.meta.modified = util.getTime();
            let projectContent = JSON.stringify(project);
            await window.api.set("project", id, projectContent);
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
        if ((id instanceof lib.Project) && (id instanceof this.constructor.PROJECTCLASS)) return this.hasProject(id.id);
        return id in this.#projects;
    }
    getProject(id) {
        if (!this.hasProject(id)) return null;
        return this.#projects[id];
    }
    addProject(...projs) {
        return util.Target.resultingForEach(projs, proj => {
            if (!((proj instanceof lib.Project) && (proj instanceof this.constructor.PROJECTCLASS))) return false;
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
            if ((id instanceof lib.Project) && (id instanceof this.constructor.PROJECTCLASS)) id = id.id;
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
AppFeature.Dirent = class AppFeatureDirent extends util.Target {
    #parent;
    #name;

    constructor(parent, name) {
        super();

        if (!(parent instanceof AppFeature.DirentFolder)) parent = null;
        this.#parent = parent;
        if (this.hasParent()) this.parent.addChild(this);

        this.#name = String(name);
    }

    get app() { return App.instance; }
    get parent() { return this.#parent; }
    hasParent() { return !!this.parent; }

    get name() { return this.#name; }

    get icon() { return "help-circle"; }
};
AppFeature.DirentFolder = class AppFeatureDirentFolder extends util.Target {
    #children;

    constructor(parent, name, children) {
        super(parent, name);

        this.#children = new Set();

        this.children = children;
    }

    get children() { return [...this.#children]; }
    set children(v) {
        v = util.ensure(v, "arr");
        this.clearChildren();
        this.addChild(v);
    }
    clearChildren() {
        let children = this.children;
        this.remChild(children);
        return children;
    }
    hasChild(dirent) {
        if (!(dirent instanceof AppFeature.Dirent)) return false;
        return this.#children.has(dirent);
    }
    addChild(...dirents) {
        return util.Target.resultingForEach(dirents, dirent => {
            if (!(dirent instanceof AppFeature.Dirent)) return false;
            if (this.hasChild(dirent)) return false;
            this.#children.add(dirent);
            return dirent;
        });
    }
    remChild(...dirents) {
        return util.Target.resultingForEach(dirents, dirent => {
            if (!(dirent instanceof AppFeature.Dirent)) return false;
            if (!this.hasChild(dirent)) return false;
            this.#children.delete(dirent);
            return dirent;
        });
    }

    get icon() { return "folder-outline"; }
};
AppFeature.DirentProject = class AppFeatureDirentProject extends util.Target {
    #id;

    constructor(parent, id) {
        super(parent, "");

        this.#id = String(id);
    }

    get id() { return this.#id; }

    get project() { return this.app.getProject(id); }
    hasProject() { return !!this.project; }

    get name() { return this.hasProject() ? this.project.meta.name : "?"; }

    get icon() { return "document-outline"; }
};
AppFeature.TitlePage = class AppFeatureTitlePage extends App.Page {
    #eTitle;
    #eSubtitle;
    #eNav;
    #eCreateBtn;
    #eProjectsBtn;

    static DESCRIPTION = "";

    constructor() {
        super("TITLE");

        this.#eTitle = document.createElement("div");
        this.elem.appendChild(this.eTitle);
        this.eTitle.classList.add("title");
        this.eTitle.innerHTML = "<span>Peninsula</span><span></span>";
        this.eTitle.children[1].textContent = this.app.getName();
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

    constructor() {
        super("PROJECTS");

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

        this.addHandler("add", () => {
            this.app.addHandler("saved-projects", () => this.refresh());
            this.app.addHandler("loaded-projects", () => this.refresh());
        });

        this.eContent.addEventListener("click", e => {
            e.stopPropagation();
            selected.clear();
            lastSelected = null;
            lastAction = null;
        });
        const contextMenu = e => {
            let ids = [...selected];
            let itm;
            let menu = new core.Menu();
            itm = menu.addItem(new core.Menu.Item("Create"));
            itm.addHandler("trigger", e => {
                this.app.post("cmd-newproject");
            });
            menu.addItem(new core.Menu.Divider());
            itm = menu.addItem(new core.Menu.Item("Open"));
            itm.disabled = ids.length != 1;
            itm.addHandler("trigger", e => {
                this.app.setPage("PROJECT", { id: ids[0] });
            });
            itm = menu.addItem(new core.Menu.Item("Rename"));
            itm.disabled = ids.length != 1;
            itm.addHandler("trigger", async e => {
                let project = this.app.getProject(ids[0]);
                if (!(project instanceof this.app.constructor.PROJECTCLASS)) return;
                let result = await this.app.doPrompt("Rename", "", project.meta.name);
                if (result == null) return;
                project.meta.name = result;
                await this.app.saveProjectsClean();
            });
            menu.addItem(new core.Menu.Divider());
            itm = menu.addItem(new core.Menu.Item("Delete"));
            itm.disabled = ids.length <= 0;
            itm.addHandler("trigger", e => {
                this.app.post("cmd-delete", ids);
            });
            itm = menu.addItem(new core.Menu.Item("Duplicate"));
            itm.disabled = ids.length <= 0;
            itm.addHandler("trigger", async e => {
                for (let i = 0; i < ids.length; i++)
                    this.app.post("cmd-savecopy", this.app.getProject(ids[i]));
            });
            menu.addItem(new core.Menu.Divider());
            itm = menu.addItem(new core.Menu.Item("Export"));
            itm.disabled = ids.length != 1;
            itm.addHandler("trigger", async e => {
                const result = util.ensure(await core.fileSaveDialog({
                    title: "Export "+this.app.getName()+" Project...",
                    buttonLabel: "Save",
                }), "obj");
                if (result.canceled) return;
                const pth = result.filePath;
                try {
                    await window.api.send("project-export", pth, ids[0]);
                } catch (e) { this.app.doError("Project Export Error", ids[0]+", "+pth, e); }
            });
            itm = menu.addItem(new core.Menu.Item("Import"));
            itm.addHandler("trigger", async e => {
                const result = util.ensure(await core.fileOpenDialog({
                    title: "Import "+this.app.getName()+" Project...",
                    buttonLabel: "Open",
                    filters: [{
                        name: "P"+this.app.getName()+" Project",
                        extensions: ["p"+this.name.toLowerCase()],
                    }],
                    properties: [
                        "openFile",
                    ],
                }), "obj");
                if (result.canceled) return;
                const pth = result.filePaths[0];
                try {
                    await window.api.send("project-import", pth);
                } catch (e) { this.app.doError("Project Import Error", pth, e); }
                this.app.loadProjectsClean();
            });
            core.Menu.contextMenu = menu;
            e = util.ensure(e, "obj");
            core.Menu.placeContextMenu(e.pageX, e.pageY);
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
        this.addHandler("add", () => {
            this.app.addHandler("change-addProject", updateSelected);
            this.app.addHandler("change-remProject", updateSelected);
        });
        this.addHandler("refresh", updateSelected);
        this.addHandler("trigger", (_, id, shift) => {
            id = (id == null) ? null : String(id);
            shift = !!shift;
            if (!this.app.hasProject(id)) return;
            if (shift && this.app.hasProject(lastSelected)) {
                let ids = this.app.projects
                    .map(id => this.app.getProject(id))
                    .sort((a, b) => b.meta.modified-a.meta.modified)
                    .map(project => project.id);
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
            btn.addLinkedHandler(this, "trigger", e => {
                this.post("trigger", e, (btn.hasProject() ? btn.project.id : null), !!(util.ensure(e, "obj").shiftKey));
            });
            btn.addLinkedHandler(this, "trigger2", e => {
                this.app.setPage("PROJECT", { id: (btn.hasProject() ? btn.project.id : null) });
            });
            btn.addLinkedHandler(this, "contextmenu", e => {
                this.post("contextmenu", e, btn.hasProject() ? btn.project.id : null);
            });
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

        this.project = project;
    }

    get project() { return this.#project; }
    set project(v) {
        v = (v instanceof lib.Project) ? v : null;
        if (this.project == v) return;
        if (this.hasProject()) this.project.clearLinkedHandlers(this, "change");
        this.change("project", this.project, this.#project=v);
        if (this.hasProject()) this.project.addLinkedHandler(this, "change", (c, f, t) => this.change("project."+c, f, t));
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
            chunks.push(v.slice((i > 0) ? indices[i-1][1] : 0, range[0]));
            chunks.push(v.slice(...range));
        });
        chunks.push(v.slice((indices.length > 0) ? indices.at(-1)[1] : 0, v.length));
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

    constructor() {
        super("PROJECT");

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
        this.eNavProgress.innerHTML = "<div class='hover'><p-tooltip class='hov nx'></p-tooltip></div>";
        this.#eNavProgressTooltip = this.eNavProgress.querySelector(":scope > .hover > p-tooltip");
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
                this.post("nav-back-small", e.shiftKey);
                this.eNav.focus();
            }
            if (e.code == "Period") {
                this.post("nav-forward-small", e.shiftKey);
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

        this.addHandler("add", () => {
            this.app.addHandler("perm", async () => {
                this.app.markChange("*");
                return await this.app.saveProjectsClean();
            });
        });

        const timer = new util.Timer(true);
        let lock = false;
        this.addHandler("update", async () => {
            if (lock) return;
            if (!timer.dequeueAll(10000)) return;
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
                let itm = this.app.menu.getItemById(id);
                if (!itm) return;
                itm.exists = true;
            });
            Array.from(document.querySelectorAll(".forproject")).forEach(elem => (elem.style.display = ""));
            let itm;
            itm = this.app.menu.getItemById("closeproject");
            if (itm) itm.accelerator = "CmdOrCtrl+W";
            itm = this.app.menu.getItemById("close");
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
                let itm = this.app.menu.getItemById(id);
                if (!itm) return;
                itm.exists = false;
            });
            Array.from(document.querySelectorAll(".forproject")).forEach(elem => (elem.style.display = "none"));
            let itm;
            itm = this.app.menu.getItemById("closeproject");
            if (itm) itm.accelerator = null;
            itm = this.app.menu.getItemById("close");
            if (itm) itm.accelerator = null;
            this.app.markChange("*");
            await this.app.post("cmd-save");
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
        v = ((v instanceof lib.Project) && (v instanceof this.app.constructor.PROJECTCLASS)) ? v : null;
        if (this.project == v) return;
        if ((v instanceof lib.Project) && (v instanceof this.app.constructor.PROJECTCLASS)) {
            if (!this.app.hasProject(v)) this.app.addProject(v);
            this.projectId = v.id;
        } else this.projectId = null;
    }
    hasProject() { return (this.project instanceof lib.Project) && (this.project instanceof this.app.constructor.PROJECTCLASS); }

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
        else if ((data.project instanceof lib.Project) && (data.project instanceof this.app.constructor.PROJECTCLASS))
            return this.project == data.project;
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

    get text() { return this.elem.textContent; }
    set text(v) { this.elem.textContent = v; }
    
    get elem() { return this.#elem; }
};
