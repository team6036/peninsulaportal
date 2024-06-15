import * as util from "./util";
import { Vec1, Vec2, Vec3, Vec4 } from "./util";
import * as lib from "./lib";

import * as core from "./core";
import { PROPERTYCACHE, GLOBALSTATE } from "./core";

import { Odometry2d, Odometry3d } from "./odometry";

import { Components } from "ionicons";

import Showdown from "showdown";
import hljs from "highlight.js";


declare global {
    interface Window {
        util: typeof util,
        lib: typeof lib,
        app: App,
    }
}
window.util = util;
window.lib = lib;
Object.defineProperty(window, "app", {
    get: () => App.instance,
});


export class App extends util.Target {
    private static _instance: App | null = null;
    static get instance() {
        if (!this._instance) {
            this._instance = new this();
            this._instance.start();
        }
        return this._instance;
    }

    private _setupStage: number;

    private _packaged: boolean;

    private _fullscreen: boolean;
    private _holiday: string | null;

    private _popups: Set<AppPopupBase>;

    private _hints: Set<core.Hint>;

    private _menu: core.Menu | null;

    private _base: util.Color[];
    private _colors: util.StringMap<util.Color>;
    private _accent: string | null;

    private _dragging: boolean;
    private _dragState: util.Target | null;
    private _dragData: any;
    private _eDrag: HTMLDivElement | null;

    private _pages: util.StringMap<AppPage>;
    private _page: string;

    private _title: string;

    private _eTitle: HTMLTitleElement | null;
    private _eCoreStyle: HTMLLinkElement | null;
    private _eStyle: HTMLLinkElement | null;
    private _eDynamicStyle: HTMLStyleElement | null;
    private _eTitleBar: HTMLDivElement | null;
    private _eLoading: HTMLDivElement | null;
    private _eLoadingTo: HTMLElement | null;
    private _eMount: HTMLDivElement | null;
    private _eOverlay: HTMLDivElement | null;
    private _eRunInfo: HTMLDivElement | null;

    protected constructor() {
        super();

        this._setupStage = 0;

        this._packaged = true;

        this._fullscreen = false;
        this._holiday = null;

        this._popups = new Set();

        this._hints = new Set();

        this._menu = null;

        this._base = [];
        this._colors = {};
        this._accent = null;

        this._dragging = false;
        this._dragState = null;
        this._dragData = null;
        this._eDrag = null;

        this._pages = {};
        this._page = "";

        this._title = "";

        this._eTitle = null;
        this._eCoreStyle = null;
        this._eStyle = null;
        this._eDynamicStyle = null;
        this._eTitleBar = null;
        this._eLoading = null;
        this._eLoadingTo = null;
        this._eMount = null;
        this._eOverlay = null;
        this._eRunInfo = null;

        window.api.onPerm(async () => {
            if (this.setupStage) return;
            try {
                window.api.sendPerm(true);
            } catch (e) { await this.doError({
                title: "Permission Send Error",
                infos: [e],
            }); }
        });

        this.addHandler("start", async () => {
            await window.buildAgent();
            this.menu = core.Menu.buildWholeMenu(this.name);
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
                const ctx = eRunInfoCanvas.getContext("2d") as CanvasRenderingContext2D;
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

                await Promise.all(this.pages.map(async name => await (this.getPage(name) as AppPage).setup()));

                let appState: any = null;
                try {
                    appState = await window.api.get("state", "app-state");
                } catch (e) { await this.doError({
                    title: "State Error",
                    content: "AppState Get",
                    infos: [e],
                }); }

                try {
                    await this.loadState(appState);
                } catch (e) { await this.doError({
                    title: "Load Error",
                    content: "AppState",
                    infos: [e],
                }); }

                let page: string = "";
                try {
                    page = util.castString(await window.api.get("state", "page"));
                } catch (e) { await this.doError({
                    title: "State Error",
                    content: "CurrentPage Get",
                    infos: [e],
                }); }

                let pageState: any = null;
                try {
                    pageState = await window.api.get("state", "page-state");
                } catch (e) { await this.doError({
                    title: "State Error",
                    content: "PageState Get",
                    infos: [e],
                }); }

                let pagePersistentStates: any = null;
                try {
                    pagePersistentStates = await window.api.get("state", "page-persistent-states");
                } catch (e) { await this.doError({
                    title: "State Error",
                    content: "PagePersistentStates Get",
                    infos: [e],
                }); }

                if (this.hasPage(page)) {
                    try {
                        await (this.getPage(page) as AppPage).loadState(pageState);
                    } catch (e) { await this.doError({
                        title: "Load Error",
                        content: "State, PageName: "+page,
                        infos: [e],
                    }); }
                    if (this.page != page) this.page = page;
                }

                for (let name in util.castObject(pagePersistentStates)) {
                    if (!this.hasPage(name)) continue;
                    try {
                        await (this.getPage(name) as AppPage).loadPersistentState(util.castObject(pagePersistentStates)[name]);
                    } catch (e) { await this.doError({
                        title: "Load Error",
                        content: "PersistentState, PageName: "+name,
                        infos: [e],
                    }); }
                }

                let t0: number | null = null, errorPause = false;
                let fps = 0, fpsTime = 0, fpsCount = 0;
                let deltaBuffer: number[] = [];

                const update = async () => {
                    window.requestAnimationFrame(update);

                    let t1 = util.getTime();

                    if (t0 == null || errorPause) return t0 = t1;

                    const delta = t1-t0;

                    if (delta > 1000) this.post("cmd-check");
                    try {
                        if (this.runInfoShown) {
                            deltaBuffer.unshift(delta);
                            let length = ctx.canvas.width;
                            if (deltaBuffer.length > length) deltaBuffer.splice(length);
                            let deltaBufferMax = Math.max(100, ...deltaBuffer);
                            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                            ctx.beginPath();
                            let prevY: number | null = null;
                            for (let i = 0; i < length; i++) {
                                if (i >= deltaBuffer.length) break;
                                let x = ctx.canvas.width * (1 - i/length);
                                let y = ctx.canvas.height * (1 - deltaBuffer[i]/deltaBufferMax);
                                x = Math.round(x);
                                y = Math.round(y);
                                if (prevY == null) ctx.moveTo(x, y);
                                else {
                                    ctx.lineTo(x, prevY);
                                    ctx.lineTo(x, y);
                                }
                                prevY = y;
                            }
                            ctx.stroke();
                            eRunInfoDeltaEntryValue.textContent = String(delta);
                            eRunInfoFPSInstEntryValue.textContent = String(Math.floor(1000/delta));
                            eRunInfoFPSEntryValue.textContent = String(fps);
                        }
                        fpsTime += delta; fpsCount++;
                        if (fpsTime >= 1000) {
                            fpsTime -= 1000;
                            fps = fpsCount;
                            fpsCount = 0;
                        }
                        this.update(delta);
                    } catch (e) {
                        errorPause = true;
                        await this.doError({
                            title: "Update Error",
                            infos: [e],
                        });
                        errorPause = false;
                        return t0 = null;
                    }

                    t0 = t1;
                };
                update();
            }, 10);
        });

        this.addHandler("update", (delta: number) => this.pages.forEach(name => (this.getPage(name) as AppPage).update(delta)));
    }

    get setupStage() { return this._setupStage; }

    start() { this.post("start"); }
    update(delta: number) { this.post("update", delta); }

    /** Gets this current user agent, aka user info. */
    getAgent(): string[] {
        let agent = window.agent();
        if (agent.os === "web") {
            return [
                "WEB"+(agent.public ? " (public)" : ""),
                "Agent: "+navigator.userAgent,
                "App: "+agent.app,
            ];
        }
        let cpus = "";
        if (agent.os.cpus.length > 0) {
            cpus += " / ";
            let models = [...new Set(agent.os.cpus.map(object => object.model))];
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
    get name() { return String(window.agent().name); }
    getName(): string { return lib.getAppName(this.name); }
    getIcon(): string { return lib.getAppIcon(this.name); }
    get id() { return String(window.agent().id); }

    /** Generates markdown from a specific path and a signal for two-way events. */
    static async createMarkdown(pth: string, signal?: util.Target): Promise<HTMLElement> {
        if (!signal) signal = new util.Target();

        const converter = new Showdown.Converter({
            ghCompatibleHeaderId: true,
            strikethrough: true,
            tables: true,
            tasklists: true,
            openLinksInNewWindow: false,
        });
        converter.setFlavor("github");

        let eArticle = document.createElement("article");
        eArticle.classList.add("md");
        eArticle.innerHTML = converter.makeHtml(await (await fetch(pth)).text());

        const dfs = async (elem: HTMLElement) => {
            let skipURLCheck = await (async () => {
                if (elem instanceof HTMLImageElement && elem.classList.contains("docs-icon")) {
                    const onHolidayState = async () => {
                        const holiday = util.castNullishString(await window.api.get("active-holiday"));
                        const holidaysData = lib.castHolidays(await window.api.get("holidays"));
                        const holidayData = lib.castHoliday(holiday == null ? {} : holidaysData[holiday]);
                        const holidayIcons = lib.castHolidayIcons(await window.api.get("holiday-icons"));
                        const holidayIcon = lib.castHolidayIcon(holiday == null ? {} : holidayIcons[holiday]);
                        elem.src = 
                            ((holiday == null) || holidayData.icon) ?
                                "./assets/app/icon.png" :
                            "file://"+holidayIcon.png;
                    };
                    (signal as util.Target).addHandler("check", onHolidayState);
                    await onHolidayState();
                    return true;
                }
                if (elem instanceof HTMLAnchorElement) {
                    if (elem.classList.contains("back")) {
                        elem.setAttribute("href", "");
                        elem.addEventListener("click", e => {
                            e.stopPropagation();
                            e.preventDefault();
                            (signal as util.Target).post("back", e);
                        });
                        return false;
                    }
                    let href = elem.getAttribute("href");
                    if (!href || !href.startsWith(".")) return false;
                    elem.setAttribute("href", "");
                    elem.addEventListener("click", e => {
                        e.stopPropagation();
                        e.preventDefault();
                        const eBase = document.querySelector("base");
                        (signal as util.Target).post("nav", e, String(new URL(href as string, new URL(pth, eBase ? new URL(eBase.href, String(window.location)) : String(window.location)))));
                    });
                    return false;
                }
                if (elem.tagName === "BLOCKQUOTE") {
                    if (elem.children.length !== 1) return false;
                    let eParagraph = elem.children[0];
                    if (!(eParagraph instanceof HTMLParagraphElement)) return false;
                    let eText = eParagraph.childNodes[0];
                    if (!(eText instanceof Text)) return;
                    const tags = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];
                    const trueTags = tags.map(tag => "[!"+tag+"]");
                    if (eText.textContent == null || !trueTags.includes(eText.textContent)) return;
                    const tag = tags[trueTags.indexOf(eText.textContent)];
                    elem.style.setProperty("--color", "var(--"+{
                        NOTE: "a",
                        TIP: "cg",
                        IMPORTANT: "cp",
                        WARNING: "cy",
                        CAUTION: "cr",
                    }[tag]+"5)");
                    if (eText.nextElementSibling instanceof HTMLBRElement) eText.nextElementSibling.remove();
                    eText.remove();
                    let eHeader = document.createElement("p");
                    elem.insertBefore(eHeader, eParagraph);
                    eHeader.classList.add("header");
                    eHeader.innerHTML = "<ion-icon></ion-icon>";
                    (eHeader.children[0] as HTMLIonIconElement).name = {
                        NOTE: "information-circle-outline",
                        TIP: "bulb-outline",
                        IMPORTANT: "alert-circle-outline",
                        WARNING: "warning-outline",
                        CAUTION: "warning-outline",
                    }[tag];
                    eHeader.appendChild(document.createTextNode(util.formatText(tag)));
                    return false;
                }
            })();
            if (skipURLCheck) return;
            ["href", "src"].forEach(attr => {
                if (!elem.hasAttribute(attr)) return;
                let value = elem.getAttribute(attr);
                if (!value || !value.startsWith(".")) return;
                const eBase = document.querySelector("base");
                value = String(new URL(value, new URL(pth, eBase ? new URL(eBase.href, String(window.location)) : String(window.location))));
                elem.setAttribute(attr, value);
            });
            await Promise.all(Array.from(elem.children).map(child => dfs(child as HTMLElement)));
        };
        await dfs(eArticle);

        let id = setInterval(() => {
            if (!document.contains(eArticle)) return;
            hljs.configure({ cssSelector: "article.md pre code" });
            hljs.highlightAll();
            clearInterval(id);
        }, 100);

        return eArticle;
    }
    /** Generates markdown from a specific path and a signal for two-way events. */
    async createMarkdown(pth: string, signal?: util.Target): Promise<HTMLElement> {
        if (!(signal instanceof util.Target)) signal = new util.Target();
        this.addHandler("cmd-check", () => (signal as util.Target).post("check"));
        return await App.createMarkdown(pth, signal);
    }
    /** Given a load string obtained from the main process, turn it into a displayable element. */
    static evaluateLoad(loadValue: string): HTMLElement {
        let loadParts = loadValue.split(":");
        let elem = document.createElement("div");
        if (loadParts.length < 1) return elem;
        const name = String(loadParts.shift());
        (() => {
            let nameMap: util.StringMap<() => boolean> = {
                "fs-version": () => {
                    if (loadParts.length > 0) {
                        elem.textContent = "Check data version error: "+loadParts.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Checking data version";
                    return true;
                },
                "get-host": () => {
                    if (loadParts.length > 0) {
                        elem.textContent = "Get host error: "+loadParts.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Getting host";
                    return true;
                },
                "get-next-host": () => {
                    if (loadParts.length > 0) {
                        elem.textContent = "Get next host error: "+loadParts.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Getting next host";
                    return true;
                },
                "poll-host": () => {
                    if (loadParts.length > 0) {
                        elem.textContent = "Poll host error: "+loadParts.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Polling host";
                    return true;
                },
                "assets-data": () => {
                    if (loadParts.length > 0) {
                        elem.textContent = "Find assets data error: "+loadParts.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Finding assets data";
                    return true;
                },
                "assets": () => {
                    if (loadParts.length > 0) {
                        elem.textContent = "Find assets error: "+loadParts.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Finding assets";
                    return true;
                },
                
                "config.json": () => {
                    if (loadParts.length > 0) {
                        elem.textContent = "Download config error: "+loadParts.join(":");
                        elem.style.color = "var(--cr)";
                    } else elem.textContent = "Downloading config";
                    return true;
                },
            };
            if (name in nameMap) if (nameMap[name]()) return;
            if (name.startsWith("dl-")) {
                const type = name.split("-").slice(1).join("-");
                let typeMap: util.StringMap<() => boolean> = {
                    themes: () => {
                        if (loadParts.length < 1) return false;
                        const id = loadParts.shift();
                        if (id === "config") {
                            if (loadParts.length > 0) {
                                elem.textContent = `Download themes config error: `+loadParts.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading themes config`;
                            return true;
                        }
                        if (loadParts.length < 1) return false;
                        const name = String(loadParts.shift());
                        let nameMap: util.StringMap = {
                            "config.json": "config",
                        };
                        if (!(name in nameMap)) return false;
                        if (loadParts.length > 0) {
                            elem.textContent = `Download theme ${id} ${nameMap[name]} error: `+loadParts.join(":");
                            elem.style.color = "var(--cr)";
                        } else elem.textContent = `Downloading theme ${id} ${nameMap[name]}`;
                        return true;
                    },
                    templates: () => {
                        if (loadParts.length < 1) return false;
                        const id = String(loadParts.shift());
                        if (id === "config") {
                            if (loadParts.length > 0) {
                                elem.textContent = `Download templates config error: `+loadParts.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading templates config`;
                            return true;
                        }
                        if (loadParts.length < 1) return false;
                        const name = String(loadParts.shift());
                        let nameMap: util.StringMap = {
                            "config.json": "config",
                            "model.glb": "model",
                            "image.png": "image",
                        };
                        if (!(name in nameMap)) return false;
                        if (loadParts.length > 0) {
                            elem.textContent = `Download template ${id} ${nameMap[name]} error: `+loadParts.join(":");
                            elem.style.color = "var(--cr)";
                        } else elem.textContent = `Downloading template ${id} ${nameMap[name]}`;
                        return true;
                    },
                    robots: () => {
                        if (loadParts.length < 1) return false;
                        const id = String(loadParts.shift());
                        if (id === "config") {
                            if (loadParts.length > 0) {
                                elem.textContent = `Download robots config error: `+loadParts.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading robots config`;
                            return true;
                        }
                        if (loadParts.length < 1) return false;
                        const name = String(loadParts.shift());
                        if (name.endsWith(".glb")) {
                            if (loadParts.length > 0) {
                                elem.textContent = `Download robot ${id} ${name.slice(0, -4)} error: `+loadParts.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading robot ${id} ${name.slice(0, -4)}`;
                            return true;
                        }
                        let nameMap: util.StringMap = {
                            "config.json": "config",
                        };
                        if (!(name in nameMap)) return false;
                        if (loadParts.length > 0) {
                            elem.textContent = `Download robot ${id} ${nameMap[name]} error: `+loadParts.join(":");
                            elem.style.color = "var(--cr)";
                        } else elem.textContent = `Downloading robot ${id} ${nameMap[name]}`;
                        return true;
                    },
                    holidays: () => {
                        if (loadParts.length < 1) return false;
                        const id = String(loadParts.shift());
                        if (id === "config") {
                            if (loadParts.length > 0) {
                                elem.textContent = `Download holidays config error: `+loadParts.join(":");
                                elem.style.color = "var(--cr)";
                            } else elem.textContent = `Downloading holidays config`;
                            return true;
                        }
                        if (loadParts.length < 1) return false;
                        const name = String(loadParts.shift());
                        let nameMap: util.StringMap = {
                            "config.json": "config",
                            "svg.svg": "svg icon",
                            "png.png": "png icon",
                            "hat-1.svg": "hat 1 svg",
                            "hat-2.svg": "hat 2 svg",
                        };
                        if (!(name in nameMap)) return false;
                        if (loadParts.length > 0) {
                            elem.textContent = `Download holiday ${id} ${nameMap[name]} error: `+loadParts.join(":");
                            elem.style.color = "var(--cr)";
                        } else elem.textContent = `Downloading holiday ${id} ${nameMap[name]}`;
                        return true;
                    },
                };
                if (type in typeMap) if (typeMap[type]()) return;
            }
            elem.textContent = loadValue;
            elem.style.color = "var(--cy)";
        })();
        return elem;
    }

    get packaged() { return this._packaged; }

    get fullscreen() { return this._fullscreen; }
    set fullscreen(value) {
        if (this.fullscreen === value) return;
        this._fullscreen = value;
        document.documentElement.style.setProperty("--fs", String(+this.fullscreen));
        let left = 0, right = 0;
        if (window.navigator.windowControlsOverlay) {
            let rect = window.navigator.windowControlsOverlay.getTitlebarAreaRect();
            left = rect.left;
            right = window.innerWidth-rect.right;
        }
        document.documentElement.style.setProperty("--LEFT", (this.fullscreen ? 0 : left)+"px");
        document.documentElement.style.setProperty("--RIGHT", (this.fullscreen ? 0 : right)+"px");
        PROPERTYCACHE.clear();
    }
    get holiday() { return this._holiday; }
    set holiday(value) {
        if (this.holiday === value) return;
        this._holiday = value;
        this.updateDynamicStyle();
    }

    /** Sets up entire application. Meant to run only once. */
    async setup(): Promise<boolean> {
        if (this.setupStage) return false;
        this._setupStage++;

        window.api.onPerm(async () => {
            let perm = await this.getPerm();
            try {
                window.api.sendPerm(perm);
            } catch (e) { await this.doError({
                title: "Permission Send Error",
                infos: [e],
            }); }
        });
        window.api.on((_: any, command: string, ...args: any[]) => {
            this.post("cmd", command, ...args);
            this.post("cmd-"+command, ...args);
        });
        window.api.onMessage((_: any, name: string, ...args: any[]) => {
            name = String(name);
            this.post("msg", name, ...args);
            this.post("msg-"+name, ...args);
        });
        this.addHandler("perm", async () => {
            try {
                await window.api.set("state", "app-state", this.state);
            } catch (e) { await this.doError({
                title: "State Error",
                content: "AppState Set",
                infos: [e],
            }); }
            if (this.hasPage(this.page)) {
                try {
                    await window.api.set("state", "page", this.page);
                } catch (e) { await this.doError({
                    title: "State Error",
                    content: "CurrentPage Set",
                    infos: [e],
                }); }
                try {
                    await window.api.set("state", "page-state", (this.getPage(this.page) as AppPage).state);
                } catch (e) { await this.doError({
                    title: "State Error",
                    content: "PageState Set",
                    infos: [e],
                }); }
            }
            let pagePersistentStates: util.StringMap<object> = {};
            this.pages.forEach(name => (pagePersistentStates[name] = (this.getPage(name) as AppPage).persistentState));
            try {
                await window.api.set("state", "page-persistent-states", pagePersistentStates);
            } catch (e) { await this.doError({
                title: "State Error",
                content: "PagePersistentStates Set",
                infos: [e],
            }); }
            return true;
        });
        this.addHandler("cmd-check", async () => {
            const templatesPrev = (GLOBALSTATE.properties.get("templates") as core.GlobalStateProperty<lib.Templates>).value;
            const robotsPrev = (GLOBALSTATE.properties.get("robots") as core.GlobalStateProperty<lib.Robots>).value;
            await GLOBALSTATE.get();
            const templatesCurr = (GLOBALSTATE.properties.get("templates") as core.GlobalStateProperty<lib.Templates>).value;
            const robotsCurr = (GLOBALSTATE.properties.get("robots") as core.GlobalStateProperty<lib.Robots>).value;
            if (!util.equals(templatesCurr, templatesPrev)) Odometry3d.decacheAllFields();
            if (!util.equals(robotsCurr, robotsPrev)) Odometry3d.decacheAllRobots();
        });
        this.addHandler("cmd-about", async () => {
            const holiday = this.holiday;
            const holidaysData = lib.castHolidays(await window.api.get("holidays"));
            const holidayData = lib.castHoliday(holiday == null ? {} : holidaysData[holiday]);
            const holidayIcons = lib.castHolidayIcons(await window.api.get("holiday-icons"));
            const holidayIcon = lib.castHolidayIcon(holiday == null ? {} : holidayIcons[holiday]);
            let pop = this.confirm();
            pop.cancel = "Documentation";
            pop.iconSrc = 
                ((holiday == null) || holidayData.icon) ?
                    "./assets/app/icon.svg" :
                "file://"+holidayIcon.svg;
            pop.iconColor = "var(--a)";
            pop.subIcon = this.getIcon();
            pop.title = "Peninsula "+this.getName();
            pop.infos = [this.getAgent().join("\n")];
            let result = await pop.whenResult();
            if (result) return;
            this.post("cmd-documentation");
        });
        this.addHandler("cmd-documentation", async () => {
            const name = this.getName();
            if (name === "PORTAL")
                this.addPopup(new AppMarkdownPopup("../README.md"));
            else this.addPopup(new AppMarkdownPopup("../docs/"+name.toLowerCase()+"/MAIN.md"));
        });
        this.addHandler("cmd-spawn", async (name: string) => {
            if (!this.packaged && ["PYTHONTK"].includes(name)) {
                let pop = this.confirm({
                    title: "Open "+lib.getAppName(name),
                    content: "Are you sure you want to open this feature?\nThis feature is in development and might contain bugs",
                });
                let result = await pop.whenResult();
                if (!result) return;
            }
            try {
                await window.api.send("spawn", name);
            } catch (e) { await this.doError({
                title: "Spawn Error",
                content: "SpawnName: "+name,
                infos: [e],
            }); }
        });
        this.addHandler("cmd-reload", async () => await window.api.send("reload"));
        this.addHandler("cmd-helpurl", async (id: string) => await window.api.send("open", await window.api.get(id)));
        this.addHandler("cmd-fullscreen", async (value: boolean) => {
            this.fullscreen = value;
        });
        this.addHandler("cmd-check", async () => (this.holiday = await window.api.get("active-holiday")));

        this.addHandler("cmd-menu-click", async (id: string) => {
            if (!this.menu) return;
            let item = this.menu.items.getItemById(id);
            if (!item) return;
            item.post("trigger", null);
        });

        this._packaged = !!(await window.api.get("packaged"));

        let eTitle = document.querySelector("head > title");
        if (!(eTitle instanceof HTMLTitleElement)) eTitle = document.createElement("title");
        this._eTitle = eTitle as HTMLTitleElement;
        document.head.appendChild(this.eTitle);
        this.title = "";

        this._eCoreStyle = document.createElement("link");
        document.head.appendChild(this.eCoreStyle);
        this.eCoreStyle.rel = "stylesheet";
        this.eCoreStyle.href = "./style.css";

        this._eStyle = document.createElement("link");
        document.head.appendChild(this.eStyle);
        this.eStyle.rel = "stylesheet";
        this.eStyle.href = String(new URL("style.css", String(window.location)));

        this._eDynamicStyle = document.createElement("style");
        document.head.appendChild(this.eDynamicStyle);

        let eTitleBar = document.getElementById("titlebar");
        if (!(eTitleBar instanceof HTMLDivElement)) eTitleBar = document.createElement("div");
        this._eTitleBar = eTitleBar as HTMLDivElement;
        document.body.appendChild(this.eTitleBar);
        this.eTitleBar.id = "titlebar";

        let eMount = document.getElementById("mount");
        if (!(eMount instanceof HTMLDivElement)) eMount = document.createElement("div");
        this._eMount = eMount as HTMLDivElement;
        this.eMount.remove();
        if (document.body.children[0])
            document.body.insertBefore(this.eMount, document.body.children[0]);
        else document.body.appendChild(this.eMount);
        this.eMount.id = "mount";

        let eOverlay = document.getElementById("overlay");
        if (!(eOverlay instanceof HTMLDivElement)) eOverlay = document.createElement("div");
        this._eOverlay = eOverlay as HTMLDivElement;
        this.eOverlay.remove();
        if (document.body.children[1] instanceof HTMLElement)
            document.body.insertBefore(this.eOverlay, document.body.children[1]);
        else document.body.appendChild(this.eOverlay);
        this.eOverlay.id = "overlay";

        let eRunInfo = document.getElementById("runinfo");
        if (!(eRunInfo instanceof HTMLDivElement)) eRunInfo = document.createElement("div");
        this._eRunInfo = eRunInfo as HTMLDivElement;
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

        this._eLoading = document.createElement("div");
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

        let eDrag = document.getElementById("drag");
        if (!(eDrag instanceof HTMLDivElement)) eDrag = document.createElement("div");
        this._eDrag = eDrag as HTMLDivElement;
        document.body.appendChild(this.eDrag);
        this.eDrag.id = "drag";

        // const ionicons1 = document.createElement("script");
        // document.body.appendChild(ionicons1);
        // ionicons1.type = "module";
        // ionicons1.src = "../node_modules/ionicons/dist/ionicons/ionicons.esm.js";
        // const ionicons2 = document.createElement("script");
        // document.body.appendChild(ionicons2);
        // ionicons2.noModule = true;
        // ionicons2.src = "../node_modules/ionicons/dist/ionicons/ionicons.js";

        // const showdown = document.createElement("script");
        // document.head.appendChild(showdown);
        // showdown.src = "./assets/modules/showdown.min.js";

        // const highlight1 = document.createElement("script");
        // document.head.appendChild(highlight1);
        // highlight1.src = "./assets/modules/highlight.min.js";
        const highlightStylesheet = document.createElement("link");
        document.head.appendChild(highlightStylesheet);
        highlightStylesheet.rel = "stylesheet";

        // const qrcode = document.createElement("script");
        // document.head.appendChild(qrcode);
        // qrcode.src = "./assets/modules/qrcode.min.js";
        
        let startTime = util.getTime();
        
        this.fullscreen = !!(await window.api.get("fullscreen"));
        this.holiday = await window.api.get("active-holiday");

        let agent = window.agent();
        document.documentElement.style.setProperty(
            "--WIN32",
            String(+((typeof(agent.os) === "object") && (agent.os.platform === "win32"))),
        );
        document.documentElement.style.setProperty(
            "--DARWIN",
            String(+((typeof(agent.os) === "object") && (agent.os.platform === "darwin"))),
        );
        document.documentElement.style.setProperty(
            "--LINUX",
            String(+((typeof(agent.os) === "object") && (agent.os.platform === "linux"))),
        );
        PROPERTYCACHE.clear();

        let checkLock = false;
        const updateCheck = async () => {
            if (checkLock) return;
            checkLock = true;

            if (await window.api.get("reduced-motion"))
                document.documentElement.style.setProperty("--t", "0s");
            else document.documentElement.style.removeProperty("--t");

            const theme = await window.api.get("active-theme");

            const themesData = lib.castThemes(await window.api.get("themes"));
            const themeData = lib.castTheme((typeof(theme) === "string") ? themesData[theme] : theme);

            let base = Array.from(
                themeData.base || Array.from(new Array(9).keys())
                    .map(i => new util.Color(new Array(3).fill(255*i/9) as util.vec3).toHex(false)),
            );
            let darkWanted = !!(await window.api.get("dark-wanted"));
            highlightStylesheet.href = "./assets/modules/" + (darkWanted ? "highlight-dark.min.css" : "highlight-light.min.css");
            if (!darkWanted) base = base.reverse();
            this.base = base.map(color => new util.Color(color));
            
            let colorsString = themeData.colors || {
                r: "#ff0000",
                o: "#ff8800",
                y: "#ffff00",
                g: "#00ff00",
                c: "#00ffff",
                b: "#0088ff",
                p: "#8800ff",
                m: "#ff00ff",
            };
            let colorsColors: util.StringMap<util.Color> = {};
            for (let key in colorsString) colorsColors[key] = new util.Color(colorsColors[key]);
            this.colors = colorsColors;

            this.accent = util.castString(themeData.accent, "b");

            checkLock = false;
        };
        this.addHandler("cmd-check", updateCheck);
        await updateCheck();

        await this.postResult("setup");

        const updatePage = () => {
            // Array.from(document.querySelectorAll("label.filedialog")).forEach(elem => {
            //     if (elem.children.length > 0) return;
            //     elem.innerHTML = "<input type='file'><div class='value'></div><button></button>";
            //     const input = elem.input = elem.children[0];
            //     const value = elem.value = elem.children[1];
            //     const button = elem.button = elem.children[2];
            //     input.setAttribute("accept", elem.getAttribute("accept"));
            //     const update = () => {
            //         let file = input.files[0];
            //         let has = (file instanceof File); 
            //         value.textContent = has ? file.name : "Choose a file...";
            //         has ? value.classList.remove("empty") : value.classList.add("empty");
            //     };
            //     update();
            //     input.addEventListener("change", e => update());
            //     button.addEventListener("click", e => {
            //         e.stopPropagation();
            //         input.click();
            //     });
            // });
            Array.from(document.querySelectorAll(".introtitle")).forEach(async elem => {
                if (!(elem instanceof HTMLElement)) return;

                if (elem.children.length <= 0) {
                    elem.innerHTML = "<div><div>p</div><div>eninsula</div></div><div></div>";
                    elem.children[1].textContent = this.getName();
                }

                let specialCount = 0;
                if (!(elem.querySelector(".special.back") instanceof HTMLImageElement)) {
                    const eSpecialBack = document.createElement("img");
                    if (elem.children[0] instanceof HTMLElement)
                        elem.insertBefore(eSpecialBack, elem.children[0]);
                    else elem.appendChild(eSpecialBack);
                    eSpecialBack.classList.add("special");
                    eSpecialBack.classList.add("back");
                    specialCount++;
                }
                if (!(elem.querySelector(".special.front") instanceof HTMLImageElement)) {
                    const eSpecialFront = document.createElement("img");
                    elem.appendChild(eSpecialFront);
                    eSpecialFront.classList.add("special");
                    eSpecialFront.classList.add("front");
                    specialCount++;
                }
                if (specialCount < 2) return;

                const onHolidayState = async () => {
                    const holiday = await window.api.get("active-holiday");

                    if (holiday == null) return elem.classList.remove("special");
                    elem.classList.add("special");

                    const holidaysData = lib.castHolidays(await window.api.get("holidays"));
                    const holidayData = lib.castHoliday(holiday == null ? {} : holidaysData[holiday]);
                    const holidayIcons = lib.castHolidayIcons(await window.api.get("holiday-icons"));
                    const holidayIcon = lib.castHolidayIcon(holiday == null ? {} : holidayIcons[holiday]);

                    if ("hat2" in holidayIcon) {
                        let eSpecialBack = elem.querySelector(".special.back");
                        if (eSpecialBack instanceof HTMLImageElement)
                            eSpecialBack.src = "file://"+holidayIcon.hat2;
                    }
                    if ("hat1" in holidayIcon) {
                        let eSpecialFront = elem.querySelector(".special.front");
                        if (eSpecialFront instanceof HTMLImageElement)
                            eSpecialFront.src = "file://"+holidayIcon.hat1;
                    }
                };
                this.addHandler("cmd-check", onHolidayState);
                await onHolidayState();
            });
        };
        setInterval(updatePage, 500);
        updatePage();

        if (this.eLoadingTo) this.eLoadingTo.style.visibility = "hidden";

        setTimeout(() => {
            this.eLoading.classList.remove("this");
            let introTitle = this.eLoading.querySelector(":scope > .introtitle");
            if (this.eLoadingTo && (introTitle instanceof HTMLElement)) {
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
                    if (!this.eLoadingTo) return;
                    this.eLoadingTo.style.visibility = "";
                }, 250);
            }
        // }, Math.max(0, 1250 - (util.getTime()-t) + 1000));
        }, Math.max(0, 1250 - (util.getTime()-startTime)));

        this._setupStage++;

        window.api.sendReady();

        return true;
    }
    get base() { return [...this._base]; }
    set base(values) {
        let colors = values.map(value => new util.Color(value));
        while (colors.length < 9) colors.push(new util.Color(colors.at(-1)));
        while (colors.length > 9) colors.pop();
        this._base = colors;
        this.updateDynamicStyle();
    }
    /** Gets a base color given its index. */
    getBase(i: number): util.Color | null {
        i = Math.round(i);
        if (i < 0 || i >= 9) return null;
        return this._base[i];
    }
    get colorNames() { return Object.keys(this._colors); }
    get colorValues() { return Object.values(this._colors); }
    get colors() {
        let colors: util.StringMap<util.Color> = {};
        this.colorNames.forEach(name => (colors[name] = this.getColor(name) as util.Color));
        return colors;
    }
    set colors(values) {
        this.clearColors();
        for (let name in values) this.setColor(name, new util.Color(values[name]));
    }
    /**
     * Clears the colors from this app theme.
     * @returns the previous colors before clearing
     */
    clearColors(): util.StringMap<util.Color> {
        let colors = this.colors;
        for (let name in colors) this.delColor(name);
        return colors;
    }
    /** Checks if a color exists in this app theme. */
    hasColor(name: string): boolean { return name in this._colors; }
    /** Gets the color associated with its name. */
    getColor(name: string): util.Color | null {
        if (!this.hasColor(name)) return null;
        return this._colors[name];
    }
    /** Sets the color associated with its name. */
    setColor(name: string, color: util.Color): util.Color | null {
        if (this.hasColor(name))
            if (color.averageDifference(this.getColor(name) as util.Color) < 2)
                return this.getColor(name);
        color.addHandler("change", () => this.updateDynamicStyle());
        this._colors[name] = color;
        this.updateDynamicStyle();
        return color;
    }
    /** Deletes the color associated with its name. */
    delColor(name: string): util.Color | null {
        if (!this.hasColor(name)) return null;
        let color = this.getColor(name);
        delete this._colors[name];
        this.updateDynamicStyle();
        return color;
    }
    get accent() { return this._accent; }
    set accent(value) {
        if (this.accent === value) return;
        this._accent = value;
        this.updateDynamicStyle();
    }
    /** Updates the dynamic style element with the new app theme. */
    async updateDynamicStyle() {
        const holidaysData = lib.castHolidays(await window.api.get("holidays"));
        const holidayData = lib.castHoliday(this.holiday == null ? {} : holidaysData[this.holiday]);
        let accent = String((this.holiday == null) ? this.accent : holidayData.accent);

        let style: util.StringMap<string> = {};

        let base0 = this.getBase(0), base4 = this.getBase(4), base8 = this.getBase(8);
        if (!base0) base0 = new util.Color(0x000000);
        if (!base4) base4 = new util.Color(0x808080);
        if (!base8) base8 = new util.Color(0xffffff);
        let base0Average = (base0.r+base0.g+base0.b)/3;
        let base8Average = (base8.r+base8.g+base8.b)/3;
        let isDarkOriented = base8Average > base0Average;

        for (let baseIndex = 0; baseIndex <= 9; baseIndex++) {
            let aliasIter = baseIndex >= 9;
            for (let alphaIndex = 0; alphaIndex < 16; alphaIndex++) {
                let alpha = alphaIndex / 15;
                let hex = "0123456789abcdef"[alphaIndex];
                if (aliasIter) style["v-"+hex] = "var(--v4-"+hex+")";
                else {
                    let base = this.getBase(baseIndex);
                    if (!base) base = new util.Color(new Array(3).fill(255*(baseIndex/8)) as util.vec3);
                    style["v"+baseIndex+"-"+hex] = "rgba("+[...base.rgb, alpha].join(",")+")";
                }
            }
            if (aliasIter)
                style["v"] = "var(--v-f)";
            else style["v"+baseIndex] = "var(--v"+baseIndex+"-f)";
        }

        let black = this.getBase(isDarkOriented ? 1 : 8), middle = this.getBase(4), white = this.getBase(isDarkOriented ? 8 : 1);
        if (!black) black = new util.Color(0x000000);
        if (!middle) middle = new util.Color(0x808080);
        if (!white) white = new util.Color(0xffffff);

        let colors: util.StringMap<util.Color> = {};

        this.colorNames.forEach(name => (colors[name] = this.getColor(name) as util.Color));
        colors._ = new util.Color(this.hasColor(accent) ? this.getColor(accent) as util.Color : middle);

        for (let name in colors) {
            let color = colors[name];
            let header = (name === "_") ? "a" : "c"+name;
            for (let baseIndex = 0; baseIndex <= 9; baseIndex++) {
                let aliasIter = (baseIndex >= 9);
                let newColor = aliasIter ? util.lerp(color, (baseIndex<4) ? black : (baseIndex>4) ? white : color, Math.abs(baseIndex-4)/4) : null;
                for (let alphaIndex = 0; alphaIndex < 16; alphaIndex++) {
                    let alpha = alphaIndex / 15;
                    let hex = "0123456789abcdef"[alphaIndex];
                    if (aliasIter) 
                        style[header+"-"+hex] = "var(--"+header+"4-"+hex+")";
                    else style[header+baseIndex+"-"+hex] = "rgba("+[...(newColor as util.Color).rgb, alpha].join(",")+")";
                }
                if (aliasIter)
                    style[header] = "var(--"+header+"-f)";
                else style[header+baseIndex] = "var(--"+header+baseIndex+"-f)";
            }
        }

        let animKeyframes: util.StringMap<util.StringMap> = {};
        for (let i = 0; i <= 100; i++) {
            let p = i / 100;
            let x1 = (p < 0) ? 0 : (p > 0.66) ? 1 : util.ease.quadIO((p-0)/(0.66-0));
            let x2 = (p < 0.33) ? 0 : (p > 1) ? 1 : util.ease.quadIO((p-0.33)/(1-0.33));
            animKeyframes[i] = {
                left: (100*x2)+"%",
                width: (100*(x1-x2))+"%",
            };
        }

        let styleString = "";
        styleString += ":root{";
        for (let key in style) styleString += "--"+key+":"+style[key]+";";
        styleString += "}";

        styleString += "@keyframes loading-line{";
        for (let p in animKeyframes) {
            styleString += p + "%{";
            for (let key in animKeyframes[p]) styleString += key+":"+animKeyframes[p][key]+";";
            styleString += "}";
        }
        styleString += "}";
        this.eDynamicStyle.innerHTML = styleString;
        
        PROPERTYCACHE.clear();
        this.post("update-dynamic-style");
        await window.api.set("title-bar-overlay", {
            color: PROPERTYCACHE.get("--v1"),
            symbolColor: PROPERTYCACHE.get("--v8"),
        });
    }

    /** Checks permissions for window closing. */
    async getPerm() {
        if (this.popups.length > 0) return false;
        for (let perm of await this.postResult("perm"))
            if (!perm) return false;
        return true;
    }

    get popups() { return [...this._popups]; }
    set popups(values) {
        this.clearPopups();
        this.addPopup(...values);
    }
    /**
     * Clears the popups from this app.
     * @returns the previous popups before clearing
     */
    clearPopups(): AppPopupBase[] {
        let popups = this.popups;
        this.remPopup(...popups);
        return popups;
    }
    /** Checks if a popup exists on this app. */
    hasPopup(popup: AppPopupBase): boolean { return this._popups.has(popup); }
    /**
     * Adds a popup to this app.
     * @returns the added popup if successfully added, otherwise false. If multiple are added at once, an array of the successfully added ones are returned
     */
    addPopup(...popups: AppPopupBase[]): util.Result<AppPopupBase> {
        return util.Target.resultingForEach(popups, popup => {
            if (this.hasPopup(popup)) this.remPopup(popup);

            this._popups.add(popup);

            popup.addLinkedHandler(this, "result", () => this.remPopup(popup));
            window.api.set("closeable", this.popups.length <= 0);

            popup.onAdd();

            return popup;
        });
    }
    /**
     * Removes a popup from this app.
     * @returns the removed popup if successfully removed, otherwise false. If multiple are removed at once, an array of the successfully removed ones are returned
     */
    remPopup(...popups: AppPopupBase[]): util.Result<AppPopupBase> {
        return util.Target.resultingForEach(popups, popup => {
            if (!this.hasPopup(popup)) return false;

            popup.onRem();

            popup.clearLinkedHandlers(this, "result");
            window.api.set("closeable", this.popups.length <= 0);

            this._popups.delete(popup);

            return popup;
        });
    }
    /** Shorthand alert popup creation. */
    alert(cnf?: AppAlertConfig): AppAlert { return this.addPopup(new AppAlert(cnf)) as AppAlert; }
    /** Shorthand error popup creation. */
    error(cnf?: AppErrorConfig): AppError { return this.addPopup(new AppError(cnf)) as AppError; }
    /** Shorthand warn popup creation. */
    warn(cnf?: AppWarnConfig): AppWarn { return this.addPopup(new AppWarn(cnf)) as AppWarn; }
    /** Shorthand success popup creation. */
    success(cnf?: AppSuccessConfig): AppSuccess { return this.addPopup(new AppSuccess(cnf)) as AppSuccess; }
    /** Shorthand confirm popup creation. */
    confirm(cnf?: AppConfirmConfig): AppConfirm { return this.addPopup(new AppConfirm(cnf)) as AppConfirm; }
    /** Shorthand prompt popup creation. */
    prompt(cnf?: AppPromptConfig): AppPrompt { return this.addPopup(new AppPrompt(cnf)) as AppPrompt; }
    /** Shorthand alert popup result. */
    async doAlert(cnf?: AppAlertConfig): Promise<AppAlertResult> { return await this.alert(cnf).whenResult(); }
    /** Shorthand error popup result. */
    async doError(cnf?: AppErrorConfig): Promise<AppErrorResult> { return await this.error(cnf).whenResult(); }
    /** Shorthand warn popup result. */
    async doWarn(cnf?: AppWarnConfig): Promise<AppWarnResult> { return await this.warn(cnf).whenResult(); }
    /** Shorthand success popup result. */
    async doSuccess(cnf?: AppSuccessConfig): Promise<AppSuccessResult> { return await this.success(cnf).whenResult(); }
    /** Shorthand confirm popup result. */
    async doConfirm(cnf?: AppConfirmConfig): Promise<AppConfirmResult> { return await this.confirm(cnf).whenResult(); }
    /** Shorthand prompt popup result. */
    async doPrompt(cnf?: AppPromptConfig): Promise<AppPromptResult> { return await this.prompt(cnf).whenResult(); }

    get hints() { return [...this._hints]; }
    set hints(values) {
        this.clearHints();
        this.addHint(...values);
    }
    /**
     * Clears the hints from this app.
     * @returns the previous hints before clearing
     */
    clearHints(): core.Hint[] {
        let hints = this.hints;
        this.remHint(...hints);
        return hints;
    }
    /** Checks if a hint exists in this app. */
    hasHint(hint: core.Hint): boolean { return this._hints.has(hint); }
    /**
     * Adds a hint to this app.
     * @returns the added hint if successfully added, otherwise false. If multiple are added at once, an array of the successfully added ones are returned
     */
    addHint(...hints: core.Hint[]): util.Result<core.Hint> {
        return util.Target.resultingForEach(hints, hint => {
            if (this.hasHint(hint)) return false;
            this._hints.add(hint);
            this.eOverlay.appendChild(hint.elem);
            return hint;
        });
    }
    /**
     * Removes a hint from this app.
     * @returns the removed hint if successfully removed, otherwise false. If multiple are removed at once, an array of the successfully removed ones are returned
     */
    remHint(...hints: core.Hint[]): util.Result<core.Hint> {
        return util.Target.resultingForEach(hints, hint => {
            if (!this.hasHint(hint)) return false;
            this._hints.delete(hint);
            this.eOverlay.removeChild(hint.elem);
            return hint;
        });
    }

    get menu() { return this._menu; }
    set menu(value) {
        if (this.menu === value) return;
        if (this.menu) {
            this.unbindMenu(this.menu);
            this.menu.clearLinkedHandlers(this, "change");
        }
        this._menu = value;
        if (this.menu) {
            this.menu.addLinkedHandler(this, "change", () => {
                if (!this.menu) return;
                window.api.set("menu", this.menu.toObj());
            });
            window.api.set("menu", this.menu.toObj());
            this.bindMenu(this.menu);
        }
    }
    /** Binds specific app-related events to a menu object. */
    bindMenu(menu: core.Menu): core.Menu {
        lib.APPFEATURES.forEach(name => {
            let item = menu.getItemById("spawn:"+name);
            if (!item) return;
            item.addLinkedHandler(this, "trigger", (e: MouseEvent) => this.post("cmd-spawn", name));
        });
        ["repo", "db-host", "scout-url"].forEach(id => {
            let item = menu.getItemById(id);
            if (!item) return;
            item.addLinkedHandler(this, "trigger", (e: MouseEvent) => this.post("cmd-helpurl", id));
        });
        let item;
        item = menu.getItemById("about");
        if (item) item.addLinkedHandler(this, "trigger", (e: MouseEvent) => this.post("cmd-about"));
        item = menu.getItemById("settings");
        if (item) item.addLinkedHandler(this, "trigger", (e: MouseEvent) => this.post("cmd-spawn", "PRESETS"));
        item = menu.getItemById("reload");
        if (item) item.addLinkedHandler(this, "trigger", (e: MouseEvent) => this.post("cmd-reload"));
        item = menu.getItemById("documentation");
        if (item) item.addLinkedHandler(this, "trigger", (e: MouseEvent) => this.post("cmd-documentation"));
        return menu;
    }
    /** Unbinds specific app-related events from a menu object. */
    unbindMenu(menu: core.Menu) {
        lib.APPFEATURES.forEach(name => {
            let item = menu.getItemById("spawn:"+name);
            if (!item) return;
            item.clearLinkedHandlers(this, "trigger");
        });
        ["repo", "db-host", "scout-url"].forEach(id => {
            let item = menu.getItemById(id);
            if (!item) return;
            item.clearLinkedHandlers(this, "trigger");
        });
        let item;
        item = menu.getItemById("about");
        if (item) item.clearLinkedHandlers(this, "trigger");
        item = menu.getItemById("settings");
        if (item) item.clearLinkedHandlers(this, "trigger");
        item = menu.getItemById("reload");
        if (item) item.clearLinkedHandlers(this, "trigger");
        return menu;
    }

    get dragging() { return this._dragging; }
    set dragging(value) {
        if (this.dragging === value) return;
        this._dragging = value;
        if (this.dragging) {
            this._dragState = new util.Target();
            const mouseup = (e: MouseEvent) => {
                if (!this.dragState) return;
                this.post("drag-submit", e);
                this.dragState.post("submit", e);
                this.post("drag-stop");
                this.dragState.post("stop");
            };
            const mousemove = (e: MouseEvent) => {
                if (!this.dragState) return;
                this.eDrag.style.left = e.pageX+"px";
                this.eDrag.style.top = e.pageY+"px";
                this.post("drag-move", e);
                this.dragState.post("move", e);
            };
            (this.dragState as util.Target).addHandler("stop", () => {
                if (!this.dragState) return;
                this.dragState._already = true;
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                this.dragging = false;
            });
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
            this.post("drag-start");
        } else {
            if (this.dragState && !this.dragState._already) {
                this.post("drag-cancel");
                this.dragState.post("cancel");
                this.post("drag-stop");
                this.dragState.post("stop");
            }
            this._dragState = null;
            this.dragData = null;
        }
        this.eDrag.style.visibility = this.dragging ? "inherit" : "hidden";
    }
    /** Submits a drag event. */
    submitDrag(): boolean {
        if (!this.dragging) return false;
        if (!this.dragState) return false;
        if (this.dragState._already) return false;
        this.post("drag-submit");
        this.dragState.post("submit");
        this.post("drag-stop");
        this.dragState.post("stop");
        return true;
    }
    get dragState() { return this._dragState; }
    get dragData() { return this._dragData; }
    set dragData(value) {
        if (this.dragging) return;
        this._dragData = value;
    }
    get eDrag() {
        if (!this._eDrag) throw new Error("eDrag element is missing");
        return this._eDrag;
    }

    get pages() { return Object.keys(this._pages); }
    /** Checks if a page exists in this app. */
    hasPage(name: string): boolean { return name in this._pages; }
    /**
     * Adds a page to this app.
     * @returns the added page if successfully added, otherwise false. If multiple are added at once, an array of the successfully added ones are returned
     */
    addPage(...pages: AppPage[]): util.Result<AppPage> {
        return util.Target.resultingForEach(pages, page => {
            if (this.hasPage(page.name)) return false;
            this._pages[page.name] = page;
            this.eMount.appendChild(page.elem);
            page.leave(null);
            page.onAdd();
            return page;
        });
    }
    /** Gets the page associated with its name. */
    getPage(name: string): AppPage | null {
        if (!this.hasPage(name)) return null;
        return this._pages[name];
    }
    get page() { return this._page; }
    set page(value) { this.setPage(value, null); }
    async setPage(name: string, data: any) {
        if (this.page === name) {
            if (!this.hasPage(this.page)) return;
            if (await (this.getPage(this.page) as AppPage).determineSame(data)) return;
        }
        if (!this.hasPage(name)) return;

        let intervalIds: util.StringMap<NodeJS.Timeout> = {};

        this.pages.forEach(name => {
            const page = this.getPage(name) as AppPage;
            page.elem.classList.remove("this");
            page.post("pre-hide");
            intervalIds[name] = setTimeout(() => page.post("post-hide"), 250);
        });

        if (this.hasPage(this.page)) await (this.getPage(this.page) as AppPage).leave(data);

        this._page = name;

        if (this.hasPage(this.page)) await (this.getPage(this.page) as AppPage).enter(data);

        this.pages.forEach(name => {
            const page = this.getPage(name) as AppPage;
            if (name !== this.page) return;
            clearTimeout(intervalIds[name]);
            page.elem.classList.add("this");
            page.post("pre-show");
            setTimeout(() => page.post("post-show"), 250);
        });
    }

    get title() { return this._title; }
    set title(value) {
        if (this.title === value) return;
        this._title = value;
        let name = this.getName();
        this.eTitle.textContent = value ? (value+" — "+name) : name;
    }

    get eTitle() {
        if (!this._eTitle) throw new Error("eTitle element is missing");
        return this._eTitle;
    }
    get eCoreStyle() {
        if (!this._eCoreStyle) throw new Error("eCoreStyle element is missing");
        return this._eCoreStyle;
    }
    get eStyle() {
        if (!this._eStyle) throw new Error("eStyle element is missing");
        return this._eStyle;
    }
    get eDynamicStyle() {
        if (!this._eDynamicStyle) throw new Error("eDynamicStyle element is missing");
        return this._eDynamicStyle;
    }
    get eTitleBar() {
        if (!this._eTitleBar) throw new Error("eTitleBar element is missing");
        return this._eTitleBar;
    }
    get eLoading() {
        if (!this._eLoading) throw new Error("eLoading element is missing");
        return this._eLoading;
    }
    get eLoadingTo() { return this._eLoadingTo; }
    set eLoadingTo(value) {
        if (this.eLoadingTo === value) return;
        this._eLoadingTo = value;
    }
    get eMount() {
        if (!this._eMount) throw new Error("eMount element is missing");
        return this._eMount;
    }
    get eOverlay() {
        if (!this._eOverlay) throw new Error("eOverlay element is missing");
        return this._eOverlay;
    }
    get eRunInfo() {
        if (!this._eRunInfo) throw new Error("eRunInfo element is missing");
        return this._eRunInfo;
    }
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
        return Math.min(1, Math.max(0, util.castNumber(parseFloat(progress))/100));
    }
    set progress(value) {
        if (value == null) {
            this.eTitleBar.classList.remove("progress");
            return;
        }
        this.eTitleBar.classList.add("progress");
        this.eTitleBar.style.setProperty("--progress", (value*100)+"%");
    }

    get state() { return {}; }
    /** Loads a saved app state into this app. */
    async loadState(state: util.StringMap<any>) {}
}

export type AppPopupModify = {
    props: util.StringMap<any>,
    cmds: string[],
};

/** App popup base class. */
export class AppPopupBase extends util.Target {
    protected static NAME: string | null = null;
    protected static PARAMS: string[] = [];

    private _id: string | null;
    private _result: any;

    private readonly resolver;

    readonly elem;
    readonly eInner;

    constructor() {
        super();

        this._id = null;
        this._result = null;

        this.resolver = new util.Resolver(false);

        this.elem = document.createElement("div");
        this.elem.classList.add("popup");

        this.eInner = document.createElement("div");
        this.elem.appendChild(this.eInner);
        this.eInner.classList.add("inner");

        const onModify = (data: AppPopupModify) => {
            const props = data.props;
            const cmds = data.cmds;
            for (let key in props)
                (this as any)[key] = props[key];
            cmds.forEach(cmd => this.post("cmd-"+cmd));
        };

        this.addHandler("add", async () => {
            let agent = window.agent();
            this._id = null;
            if (typeof(agent.os) === "object" && agent.os.platform == "darwin")
                this._id = await window.modal.spawn(util.castString((this.constructor as typeof AppPopupBase).NAME), {
                    id: this.app.id,
                    props: this.generateParams(),
                });
            if (this.id == null) {
                document.body.appendChild(this.elem);
                setTimeout(() => {
                    this.elem.classList.add("in");
                }, 10);
            } else {
                const onChange = async () => await this.doModify({ props: this.generateParams(), cmds: [] });
                this.addHandler("change", onChange);
                onChange();
                this.app.addLinkedHandler(this, "msg-modify", onModify);
                this.post("post-add");
            }
        });
        this.addHandler("rem", async () => {
            this.app.clearLinkedHandlers(this, "msg-modify");
            await this.doModify({
                props: {},
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
            this._id = null;
        });
    }

    /** Generates parameters to be transferred between processes to the external window. */
    generateParams(): util.StringMap<any> {
        let params: util.StringMap<any> = {};
        (this.constructor as typeof AppPopupBase).PARAMS.forEach(param => (params[param] = (this as any)[param]));
        return params;
    }

    get app() { return App.instance; }

    get id() { return this._id; }
    /** Posts a modify command to the external window. */
    async doModify(data: AppPopupModify): Promise<void> {
        if (this.id == null) return;
        return await window.api.sendMessage(this.id, "modify", data);
    }

    get hasResult() { return this.resolver.state; }
    get theResult() { return this._result; }
    async whenResult(): Promise<any> {
        if (this.hasResult) return this.theResult;
        await this.resolver.when(true);
        return this.theResult;
    }

    /** Results this popup aka terminates it with a result. */
    result(value: any): boolean {
        if (this.resolver.state) return false;
        this.resolver.state = true;
        this._result = value;
        this.post("result", value);
        return true;
    }
}
export class AppPopup extends AppPopupBase {
    static {
        this.PARAMS = [...this.PARAMS, "title"];
    }

    readonly eClose;
    readonly eTitle;
    readonly eContent;

    constructor() {
        super();

        this.elem.classList.add("custom");

        this.eClose = document.createElement("button");
        this.eInner.appendChild(this.eClose);
        this.eClose.classList.add("close");
        this.eClose.innerHTML = "<ion-icon name='close'></ion-icon>";

        this.eTitle = document.createElement("div");
        this.eInner.appendChild(this.eTitle);
        this.eTitle.classList.add("title");

        this.eContent = document.createElement("div");
        this.eInner.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.eClose.addEventListener("click", e => {
            e.stopPropagation();
            this.result(null);
        });

        const onKeyDown = (e: KeyboardEvent) => {
            if (!document.body.contains(this.elem)) {
                document.body.removeEventListener("keydown", onKeyDown);
                return;
            }
            if (e.code != "Escape") return;
            this.result(null);
        };
        this.addHandler("add", () => document.body.addEventListener("keydown", onKeyDown));
        this.addHandler("rem", () => document.body.removeEventListener("keydown", onKeyDown));
    }

    get title() { return util.castString(this.eTitle.textContent); }
    set title(value) {
        this.eTitle.textContent = value;
        this.change("title", null, this.title);
    }
}
/** A popup for showing markdown */
export class AppMarkdownPopup extends AppPopup {
    readonly signal;
    private _history: string[];

    private _eArticle: HTMLElement | null;

    constructor(href: string, signal?: util.Target) {
        super();

        this.elem.classList.add("markdown");

        this.signal = (signal instanceof util.Target) ? signal : new util.Target();
        this._history = [];

        this.signal.addHandler("nav", async (e: MouseEvent, href: string) => this.navigate(href));
        this.signal.addHandler("back", async () => {
            if (this._history.length <= 1) return this.result(null);
            this._history.pop();
            this.navigate(this._history.pop() as string, +1);
        });

        this._eArticle = null;

        this.navigate(href);
    }

    /** Navigates this popup to a specific url from its current location. */
    async navigate(href: string, direction: number = -1): Promise<boolean> {
        const eBase = document.querySelector("base");
        const base = eBase ? new URL(eBase.href, String(window.location)) : String(window.location);
        href = String(new URL(href, (this._history.length > 0) ? new URL(this._history.at(-1) as string, base) : base));
        this._history.push(href);
        if (this.eArticle != null) {
            let eArticle = this.eArticle;
            this._eArticle = null;
            if (direction === +1) eArticle.classList.add("out-right");
            if (direction === -1) eArticle.classList.add("out-left");
            setTimeout(() => eArticle.remove(), 250);
        }
        try {
            this._eArticle = await App.createMarkdown(href, this.signal);
            this.eContent.appendChild(this.eArticle as HTMLElement);
        } catch (e) { return false; }
        if (this.eArticle == null) return false;
        let eArticle = this.eArticle;
        eArticle.classList.add("lighter");
        if (direction === +1) eArticle.classList.add("in-right");
        if (direction === -1) eArticle.classList.add("in-left");
        setTimeout(() => {
            eArticle.classList.remove("in-right");
            eArticle.classList.remove("in-left");
        }, 250);
        return true;
    }

    get eArticle() { return this._eArticle; }
}
export interface AppCorePopupConfigObject {
    title?: string,
    content?: string,
    icon?: string | null,
};
export type AppCorePopupConfig = AppCorePopup | AppCorePopupConfigObject | string | null;
/** A core popup, meaning its similar to the core features of prompt, alert, and confirm supported by Chrome. */
export class AppCorePopup extends AppPopupBase {
    static {
        this.PARAMS = [
            ...this.PARAMS,
            "icon", "iconSrc", "iconColor",
            "subIcon", "subIconSrc", "subIconColor",
            "title", "content",
            "infos",
        ];
    }

    readonly eIconBox;
    readonly eIcon;
    readonly eSubIcon;
    readonly eTitle;
    readonly eContent;
    private _infos: any[];

    constructor(cnf?: AppCorePopupConfig) {
        super();

        this.elem.classList.add("core");

        this.eIconBox = document.createElement("div");
        this.eInner.appendChild(this.eIconBox);
        this.eIconBox.classList.add("icon");

        this.eIcon = document.createElement("ion-icon");
        this.eIconBox.appendChild(this.eIcon);

        this.eSubIcon = document.createElement("ion-icon");
        this.eIconBox.appendChild(this.eSubIcon);

        this.eTitle = document.createElement("div");
        this.eInner.appendChild(this.eTitle);
        this.eTitle.classList.add("title");

        this.eContent = document.createElement("div");
        this.eInner.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this._infos = [];

        if (typeof(cnf) === "string") cnf = { title: cnf };
        if (cnf == null) cnf = {};

        this.title = util.castString(cnf.title);
        this.content = util.castString(cnf.content);
        this.icon = util.castString(cnf.icon);
    }

    get icon() { return this.eIcon.name || null; }
    set icon(value) {
        this.eIcon.removeAttribute("src");
        if (this.icon === value) return;
        this.eIcon.name = util.castString(value);
        this.change("icon", null, this.icon);
    }
    get iconSrc() { return util.castString(this.eIcon.getAttribute("src")); }
    set iconSrc(value) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", util.castString(value));
        this.change("iconSrc", null, this.iconSrc);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(value) {
        this.eIcon.style.color = value;
        this.change("iconColor", null, this.iconColor);
    }

    get subIcon() { return this.eSubIcon.name || null; }
    set subIcon(value) {
        this.eSubIcon.removeAttribute("src");
        if (this.subIcon === value) return;
        this.eSubIcon.name = util.castString(value);
        this.change("subIcon", null, this.subIcon);
    }
    get subIconSrc() { return this.eSubIcon.getAttribute("src"); }
    set subIconSrc(value) {
        this.eSubIcon.removeAttribute("name");
        this.eSubIcon.setAttribute("src", util.castString(value));
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

    get infos() { return [...this._infos]; }
    set infos(values) {
        this._infos = values;
        Array.from(this.eInner.querySelectorAll(":scope > .info")).forEach(elem => elem.remove());
        let eSibling = this.eContent.nextElementSibling;
        this.infos.forEach(info => {
            let elem = document.createElement("div");
            this.eInner.insertBefore(elem, eSibling);
            elem.classList.add("info");
            elem.innerHTML = String(info).replaceAll("<", "&lt").replaceAll(">", "&gt");
            let eBtn = document.createElement("button");
            elem.appendChild(eBtn);
            eBtn.innerHTML = "<ion-icon name='copy-outline'></ion-icon>";
            eBtn.addEventListener("click", e => {
                e.stopPropagation();
                navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([info], { type: "text/plain" })})]);
            });
        });
        this.change("infos", null, this.infos);
    }
}
export interface AppAlertConfigObject extends AppCorePopupConfigObject {
    button?: string,
};
export type AppAlertConfig = AppAlert | AppAlertConfigObject | string | null;
export type AppAlertResult = null;
/** An alert popup, similar to Chrome's alert() popup. */
export class AppAlert extends AppCorePopup {
    protected static NAME = "ALERT";

    static {
        this.PARAMS = [...this.PARAMS, "button"];
    }

    readonly eButton;

    constructor(cnf?: AppAlertConfig) {
        if (typeof(cnf) === "string") cnf = { title: cnf };
        if (cnf == null) cnf = {};
        cnf.icon = util.castString(cnf.icon, "alert-circle");

        super(cnf);

        this.addHandler("cmd-button", () => this.eButton.click());

        this.elem.classList.add("alert");

        this.eButton = document.createElement("button");
        this.eInner.appendChild(this.eButton);
        this.eButton.classList.add("special");

        this.eButton.addEventListener("click", e => {
            e.stopPropagation();
            this.result(null);
        });

        this.button = util.castString(cnf.button, "OK");
    }

    get theResult() { return null; }
    async whenResult(): Promise<null> { await super.whenResult(); return null; }
    result(value: null): boolean { return super.result(null); }

    get button() { return util.castString(this.eButton.textContent); }
    set button(value) {
        [value, this.eButton.textContent] = [this.button, value];
        this.change("button", value, this.button);
    }
}
export interface AppInfoedConfigObject extends AppAlertConfigObject {
    infos?: any[],
};
export type AppErrorConfig = AppError | AppInfoedConfigObject | string | null;
export type AppErrorResult = AppAlertResult;
/** An app error popup. */
export class AppError extends AppAlert {
    constructor(cnf?: AppErrorConfig) {
        if (typeof(cnf) === "string") cnf = { title: cnf };
        if (cnf == null) cnf = {};
        cnf.icon = util.castString(cnf.icon, "warning");

        super(cnf);

        this.iconColor = "var(--cr)";

        this.infos = util.castArray(cnf.infos);
        this.infos.forEach(info => console.error(info));
    }
}
export type AppWarnConfig = AppWarn | AppInfoedConfigObject | string | null;
export type AppWarnResult = AppAlertResult;
/** An app warning popup. */
export class AppWarn extends AppAlert {
    constructor(cnf?: AppWarnConfig) {
        if (typeof(cnf) === "string") cnf = { title: cnf };
        if (cnf == null) cnf = {};
        cnf.icon = util.castString(cnf.icon, "warning");

        super(cnf);

        this.iconColor = "var(--cy)";

        this.infos = util.castArray(cnf.infos);
        this.infos.forEach(info => console.warn(info));
    }
}
export type AppSuccessConfig = AppSuccess | AppInfoedConfigObject | string | null;
export type AppSuccessResult = AppAlertResult;
/** An app success popup. */
export class AppSuccess extends AppAlert {
    constructor(cnf?: AppSuccessConfig) {
        if (typeof(cnf) === "string") cnf = { title: cnf };
        if (cnf == null) cnf = {};
        cnf.icon = util.castString(cnf.icon, "checkmark-circle");

        super(cnf);

        this.iconColor = "var(--cg)";

        this.infos = util.castArray(cnf.infos);
        this.infos.forEach(info => console.warn(info));
    }
}
export interface AppConfirmConfigObject extends AppCorePopupConfigObject {
    confirm?: string,
    cancel?: string,
};
export type AppConfirmConfig = AppConfirm | AppConfirmConfigObject | string | null;
export type AppConfirmResult = boolean | null;
/** A confirm popup, similar to Chrome's prompt() popup. */
export class AppConfirm extends AppCorePopup {
    protected static NAME = "CONFIRM";

    static {
        this.PARAMS = [...this.PARAMS, "confirm", "cancel"];
    }

    readonly eConfirm;
    readonly eCancel;

    constructor(cnf?: AppConfirmConfig) {
        if (typeof(cnf) === "string") cnf = { title: cnf };
        if (cnf == null) cnf = {};
        cnf.icon = util.castString(cnf.icon, "help-circle");

        super(cnf);

        this.addHandler("cmd-confirm", () => this.eConfirm.click());
        this.addHandler("cmd-cancel", () => this.eCancel.click());

        this.elem.classList.add("confirm");

        this.eConfirm = document.createElement("button");
        this.eInner.appendChild(this.eConfirm);
        this.eConfirm.classList.add("special");

        this.eCancel = document.createElement("button");
        this.eInner.appendChild(this.eCancel);
        this.eCancel.classList.add("heavy");

        this.eConfirm.addEventListener("click", e => {
            e.stopPropagation();
            this.result(true);
        });
        this.eCancel.addEventListener("click", e => {
            e.stopPropagation();
            this.result(false);
        });
        this.addHandler("pre-result", (result: any) => this.result((result == null) ? null : !!result));

        this.confirm = util.castString(cnf.confirm, "OK");
        this.cancel = util.castString(cnf.cancel, "Cancel");
    }

    get theResult() {
        if (super.theResult == null) return null;
        return !!super.theResult;
    }
    async whenResult(): Promise<boolean | null> {
        let value = await super.whenResult();
        if (value == null) return null;
        return !!value;
    }
    result(value: boolean | null): boolean { return super.result(value); }

    get confirm() { return util.castString(this.eConfirm.textContent); }
    set confirm(value) {
        [value, this.eConfirm.textContent] = [this.confirm, value];
        this.change("confirm", value, this.confirm);
    }
    get cancel() { return util.castString(this.eCancel.textContent); }
    set cancel(value) {
        [value, this.eCancel.textContent] = [this.cancel, value];
        this.change("cancel", value, this.cancel);
    }
}
export interface AppPromptConfigObject extends AppCorePopupConfigObject {
    value?: any,
    confirm?: string,
    cancel?: string,
    placeholder?: string,
};
export type AppPromptConfig = AppPrompt | AppPromptConfigObject | string | null;
export type AppPromptResult = any;
/** A confirm popup, similar to Chrome's prompt() popup. */
export class AppPrompt extends AppCorePopup {
    protected static NAME = "PROMPT";

    static {
        this.PARAMS = [...this.PARAMS, "type", "confirm", "cancel", "value", "placeholder"];
    }

    private _type: string | null;
    private _doCast: (value: string) => any;
    private _value: any;

    readonly eInput;
    readonly eConfirm;
    readonly eCancel;

    constructor(cnf?: AppPromptConfig) {
        if (typeof(cnf) === "string") cnf = { title: cnf };
        if (cnf == null) cnf = {};
        cnf.icon = util.castString(cnf.icon, "pencil");

        super(cnf);

        this.addHandler("cmd-confirm", () => this.eConfirm.click());
        this.addHandler("cmd-cancel", () => this.eCancel.click());

        this.elem.classList.add("prompt");

        this._type = "string";
        this._doCast = value => value;
        this._value = null;

        this.eInput = document.createElement("input");
        this.eInner.appendChild(this.eInput);
        this.eInput.autocomplete = "off";
        this.eInput.spellcheck = false;

        this.eConfirm = document.createElement("button");
        this.eInner.appendChild(this.eConfirm); 
        this.eConfirm.classList.add("special");
        
        this.eCancel = document.createElement("button");
        this.eInner.appendChild(this.eCancel);
        this.eCancel.classList.add("heavy");

        this.eInput.addEventListener("change", e => {
            this.value = this.eInput.value;
        });
        this.eInput.addEventListener("keydown", e => {
            if (e.code !== "Enter" && e.code !== "Return") return;
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
        this.addHandler("pre-result", (result: any) => {
            this.value = result;
            this.result(this.value);
        });

        this.value = cnf.value || null;
        this.confirm = util.castString(cnf.confirm, "OK");
        this.cancel = util.castString(cnf.cancel, "Cancel");
        this.placeholder = util.castString(cnf.placeholder, "...");
    }

    get type() { return this._type; }
    set type(value) {
        if (this.type === value) return;
        this.change("type", this.type, this._type=value);

        this.eInput.type = (this.type != null && ["number", "integer"].includes(this.type)) ? "number" : "text";

        if (this.type != null && ["integer"].includes(this.type))
            this.eInput.step = "1";
        else this.eInput.removeAttribute("step");

        this.value = this.cast(this.value);
    }
    get doCast() { return this._doCast; }
    set doCast(value) {
        if (this.doCast === value) return;
        this.change("doCast", this.doCast, this._doCast=value);
        this.value = this.cast(this.value);
    }

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

    get value() { return this._value; }
    set value(value) {
        value = this.cast(value);
        if (this.value === value) return;
        this.change("value", this.value, this._value=value);
    }

    get placeholder() { return this.eInput.placeholder; }
    set placeholder(value) {
        [value, this.eInput.placeholder] = [this.placeholder, value];
        this.change("placeholder", value, this.placeholder);
    }

    cast(value: any): any {
        if (value == null) return null;
        if (this.type == null)
            return this.doCast(value);
        if (["number"].includes(this.type))
            return util.castNumber(parseFloat(value));
        if (["integer"].includes(this.type)) 
            return Math.round(util.castNumber(parseInt(value)));
        if (["string"].includes(this.type))
            return util.castString(this.type);
        return null;
    }
}
export interface AppProgressConfigObject extends AppCorePopupConfigObject {
    value?: number,
};
export type AppProgressConfig = AppProgress | AppProgressConfigObject | string | null;
/** A progress bar popup. */
export class AppProgress extends AppCorePopup {
    protected static NAME = "PROGRESS";

    static {
        this.PARAMS = [...this.PARAMS, "value"];
    }

    readonly eProgress;

    private _value: number;

    constructor(cnf?: AppProgressConfig) {
        if (typeof(cnf) === "string") cnf = { title: cnf };
        if (cnf == null) cnf = {};
        cnf.icon = "";

        super(cnf);

        this.elem.classList.add("progress");

        this.eIconBox.style.display = "none";

        this.eProgress = document.createElement("div");
        this.eInner.appendChild(this.eProgress);
        this.eProgress.classList.add("progress");

        this._value = 0;

        this.value = util.castNumber(cnf.value);
    }

    get value() { return this._value; }
    set value(value) {
        value = Math.min(1, Math.max(0, value));
        if (this.value === value) return;
        this.change("value", this.value, this._value=value);
        this.eProgress.style.setProperty("--progress", (100*this.value)+"%");
    }
}

/** A single page in this application. */
export class AppPage extends util.Target {
    readonly name;
    readonly elem;

    constructor(name: string) {
        super();

        this.name = name;

        this.elem = document.createElement("div");
        this.elem.id = this.name+"PAGE";
        this.elem.classList.add("page");
    }

    get app() { return App.instance; }

    /** Sets up this page, called after everything is initialized. */
    async setup(): Promise<void> {}

    get state(): util.StringMap<any> { return {}; }
    /** Loads a saved page state into this page. */
    async loadState(state: util.StringMap<any>): Promise<void> {}
    get persistentState(): util.StringMap<any> { return {}; }
    /** Loads a saved persistent page state into this page. */
    async loadPersistentState(state: util.StringMap<any>): Promise<void> {}

    /** Callback whenever this page is entered from another. */
    async enter(data: any): Promise<void> { await this.postResult("enter", data); }
    /** Callback whenever this page is left. */
    async leave(data: any): Promise<void> { await this.postResult("leave", data); }
    /** Determines if two pages loads are identical. */
    async determineSame(data: any): Promise<boolean> { return false; }

    update(delta: number) { this.post("update", delta); }
}

export class AppFeature extends App {
    static Project: typeof lib.Project = lib.Project;
    static TitlePage: typeof AppTitlePage;
    static ProjectsPage: typeof AppProjectsPage;
    static ProjectPage: typeof AppProjectPage;

    private _changes: Set<string>;
    
    private _projects: util.StringMap<lib.Project>;

    private _titlePage: AppTitlePage | null;
    private _projectsPage: AppProjectsPage | null;
    private _projectPage: AppProjectPage | null;

    private _eFeatureStyle: HTMLLinkElement | null;
    private _eTitleBtn: HTMLButtonElement | null;
    private _eProjectsBtn: HTMLButtonElement | null;
    private _eCreateBtn: HTMLButtonElement | null;
    private _eFileBtn: HTMLButtonElement | null;
    private _eEditBtn: HTMLButtonElement | null;
    private _eViewBtn: HTMLButtonElement | null;
    private _eProjectInfo: HTMLDivElement | null;
    private _eProjectInfoBtn: HTMLButtonElement | null;
    private _eProjectInfoBtnIcon: HTMLIonIconElement | null;
    private _eProjectInfoBtnName: HTMLDivElement | null;
    private _eProjectInfoContent: HTMLDivElement | null;
    private _eProjectInfoNameInput: HTMLInputElement | null;
    private _eProjectInfoSaveBtn: HTMLButtonElement | null;
    private _eProjectInfoCopyBtn: HTMLButtonElement | null;
    private _eProjectInfoDeleteBtn: HTMLButtonElement | null;
    private _eSaveBtn: HTMLButtonElement | null;

    constructor() {
        super();

        this._changes = new Set();

        this._projects = {};

        this._titlePage = null;
        this._projectsPage = null;
        this._projectPage = null;

        this._eFeatureStyle = null;
        this._eTitleBtn = null;
        this._eProjectsBtn = null;
        this._eCreateBtn = null;
        this._eFileBtn = null;
        this._eEditBtn = null;
        this._eViewBtn = null;
        this._eProjectInfo = null;
        this._eProjectInfoBtn = null;
        this._eProjectInfoBtnIcon = null;
        this._eProjectInfoBtnName = null;
        this._eProjectInfoContent = null;
        this._eProjectInfoNameInput = null;
        this._eProjectInfoSaveBtn = null;
        this._eProjectInfoCopyBtn = null;
        this._eProjectInfoDeleteBtn = null;
        this._eSaveBtn = null;

        this.addHandler("setup", async () => {
            this._eFeatureStyle = document.createElement("link");
            document.head.appendChild(this.eFeatureStyle);
            this.eFeatureStyle.rel = "stylesheet";
            this.eFeatureStyle.href = "./style-feature.css";

            const checkSizes = async () => {
                let left = PROPERTYCACHE.get("--LEFT");
                let leftValue = util.castNumber(parseFloat(left.slice(0, -2)));
                let right = PROPERTYCACHE.get("--RIGHT");
                let rightValue = util.castNumber(parseFloat(right.slice(0, -2)));
                let width = leftValue + rightValue;
                width += util.sumArray(
                    Array.from(this.eTitleBar.querySelectorAll(":scope > *:not(.space)"))
                        .map(elem => elem.getBoundingClientRect().width),
                );
                width += window.outerWidth - window.innerWidth;
                await window.api.set("min-width", width);

                let top = PROPERTYCACHE.get("--TOP");
                let topValue = util.castNumber(parseFloat(top.slice(0, -2)));
                let height = topValue;
                height += window.outerHeight - window.innerHeight;
                await window.api.set("min-height", height);
            };
            new ResizeObserver(checkSizes).observe(document.body);

            this._eTitleBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eTitleBtn);
            this.eTitleBtn.id = "titlebtn";
            this.eTitleBtn.classList.add("logo");
            this.eTitleBtn.classList.add("override");
            this.eTitleBtn.innerHTML = "<div class='title introtitle noanimation'></div>";
            this.eTitleBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.page = "TITLE";
            });
            this.eTitleBtn.addEventListener("contextmenu", (e: MouseEvent) => {
                core.Menu.contextMenu = this.bindMenu(core.Menu.buildMainMenu());
                core.Menu.placeContextMenu([e.pageX, e.pageY]);
            });
            new ResizeObserver(checkSizes).observe(this.eTitleBtn);

            this._eFileBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eFileBtn);
            this.eFileBtn.classList.add("nav");
            this.eFileBtn.classList.add("forproject");
            this.eFileBtn.textContent = "File";
            this.eFileBtn.addEventListener("click", e => {
                e.stopPropagation();
                if (!this.menu) return;
                let item = this.menu.getItemById("menu:file");
                if (!item) return;
                core.Menu.contextMenu = item.menu;
                let rect = this.eFileBtn.getBoundingClientRect();
                core.Menu.placeContextMenu([rect.left, rect.bottom]);
            });
            new ResizeObserver(checkSizes).observe(this.eFileBtn);

            this._eEditBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eEditBtn);
            this.eEditBtn.classList.add("nav");
            this.eEditBtn.classList.add("forproject");
            this.eEditBtn.textContent = "Edit";
            this.eEditBtn.addEventListener("click", e => {
                e.stopPropagation();
                if (!this.menu) return;
                let item = this.menu.getItemById("menu:edit");
                if (!item) return;
                core.Menu.contextMenu = item.menu;
                let rect = this.eEditBtn.getBoundingClientRect();
                core.Menu.placeContextMenu([rect.left, rect.bottom]);
            });
            new ResizeObserver(checkSizes).observe(this.eEditBtn);

            this._eViewBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eViewBtn);
            this.eViewBtn.classList.add("nav");
            this.eViewBtn.classList.add("forproject");
            this.eViewBtn.textContent = "View";
            this.eViewBtn.addEventListener("click", e => {
                e.stopPropagation();
                if (!this.menu) return;
                let item = this.menu.getItemById("menu:view");
                if (!item) return;
                core.Menu.contextMenu = item.menu;
                let rect = this.eViewBtn.getBoundingClientRect();
                core.Menu.placeContextMenu([rect.left, rect.bottom]);
            });
            new ResizeObserver(checkSizes).observe(this.eViewBtn);

            this._eProjectInfo = document.createElement("div");
            this.eTitleBar.appendChild(this.eProjectInfo);
            this.eProjectInfo.id = "projectinfo";
            this.eProjectInfo.classList.add("forproject");
            new ResizeObserver(checkSizes).observe(this.eProjectInfo);

            this._eProjectInfoBtn = document.createElement("button");
            this.eProjectInfo.appendChild(this.eProjectInfoBtn);
            this.eProjectInfoBtn.classList.add("display");
            this.eProjectInfoBtn.innerHTML = "<ion-icon name='chevron-down'></ion-icon>";
            this.eProjectInfoBtn.addEventListener("click", e => {
                if (this.eProjectInfo.classList.contains("this")) this.eProjectInfo.classList.remove("this");
                else {
                    this.eProjectInfo.classList.add("this");
                    const click = (e: MouseEvent) => {
                        if (!(e.target instanceof HTMLElement)) return;
                        if (this.eProjectInfo.contains(e.target)) return;
                        e.stopPropagation();
                        document.body.removeEventListener("click", click, { capture: true });
                        this.eProjectInfo.classList.remove("this");
                    };
                    document.body.addEventListener("click", click, { capture: true });
                }
            });

            this._eProjectInfoBtnIcon = document.createElement("ion-icon");
            this.eProjectInfoBtn.insertBefore(this.eProjectInfoBtnIcon, Array.from(this.eProjectInfoBtn.children).at(-1) as Element);
            this.eProjectInfoBtnIcon.name = this.getIcon();

            this._eProjectInfoBtnName = document.createElement("div");
            this.eProjectInfoBtn.insertBefore(this.eProjectInfoBtnName, Array.from(this.eProjectInfoBtn.children).at(-1) as Element);
            this.eProjectInfoBtnName.classList.add("value");

            this._eProjectInfoContent = document.createElement("div");
            this.eProjectInfo.appendChild(this.eProjectInfoContent);
            this.eProjectInfoContent.classList.add("content");

            let eHeader = document.createElement("div");
            this.eProjectInfoContent.append(eHeader);
            eHeader.textContent = "Name";

            this._eProjectInfoNameInput = document.createElement("input");
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

            this._eProjectInfoSaveBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoSaveBtn);
            this.eProjectInfoSaveBtn.textContent = "Save";
            this.eProjectInfoSaveBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("cmd-save");
            });

            this._eProjectInfoCopyBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoCopyBtn);
            this.eProjectInfoCopyBtn.textContent = "Copy";
            this.eProjectInfoCopyBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("cmd-savecopy");
            });

            this._eProjectInfoDeleteBtn = document.createElement("button");
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

            this._eSaveBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eSaveBtn);
            this.eSaveBtn.id = "save";
            this.eSaveBtn.classList.add("forproject");
            this.eSaveBtn.addEventListener("click", async e => {
                e.stopPropagation();
                this.post("cmd-save");
            });
            new ResizeObserver(checkSizes).observe(this.eSaveBtn);

            this._eProjectsBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eProjectsBtn);
            this.eProjectsBtn.classList.add("nav");
            this.eProjectsBtn.innerHTML = "<ion-icon name='folder'></ion-icon>";
            this.eProjectsBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.page = "PROJECTS";
            });
            new ResizeObserver(checkSizes).observe(this.eProjectsBtn);

            this._eCreateBtn = document.createElement("button");
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
            this.addHandler("cmd-savecopy", async (source: any) => {
                const page = this.projectPage;
                for (let perm in await this.postResult("cmd-savecopy-block")) {
                    if (perm) continue;
                    return;
                }
                if (!(source instanceof (this.constructor as typeof AppFeature).Project)) source = page.project;
                if (!(source instanceof (this.constructor as typeof AppFeature).Project)) return;
                let project = new (this.constructor as typeof AppFeature).Project(source);
                project.id = null;
                project.meta.name += " copy";
                await this.setPage("PROJECT", { project: project });
                await this.postResult("cmd-save");
            });
            this.addHandler("cmd-delete", async (values: any) => {
                let ids = util.castStringArray(values);
                const page = this.projectPage;
                for (let perm of await this.postResult("cmd-delete-block")) {
                    if (perm) continue;
                    return;
                }
                ids = ids.filter(id => this.hasProject(id));
                if (page.projectId != null && ids.length <= 0) ids.push(page.projectId);
                ids = ids.filter(id => this.hasProject(id));
                if (ids.length <= 0) return;
                let pop = this.confirm({
                    title: "Delete Projects",
                    content: "Are you sure you want to delete these projects?\nThis action is not reversible!",
                });
                pop.infos = [ids.map(id => (this.getProject(id) as lib.Project).meta.name).join("\n")];
                let result = await pop.whenResult();
                if (!result) return;
                ids.forEach(id => this.remProject(id));
                await this.postResult("cmd-save");
                this.page = "PROJECTS";
            });
            this.addHandler("cmd-closeproject", () => {
                if (this.page !== "PROJECT") return;
                this.page = "PROJECTS";
            });

            await this.loadProjects();
        });
        this.addHandler("post-setup", async () => {
            ["file", "edit", "view"].forEach(name => {
                if (!this.menu) return;
                let id = "menu:"+name;
                let menuItem = this.menu.getItemById(id);
                if (!menuItem) return;
                let menu = menuItem.menu;
                let nameMap: util.StringMap<() => void> = {
                    file: () => {
                        let items: core.MenuItemData[] = [
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
                        items.forEach((data, i) => {
                            let item = core.MenuItem.fromObj(data);
                            if (typeof(data) === "object") {
                                let click = data.click;
                                if (!click) click = () => this.post("cmd-"+data.id);
                                item.addHandler("trigger", (e: MouseEvent) => (click as Function)());
                            }
                            menu.insertItem(item, 3+i);
                        });
                    },
                };
                if (name in nameMap) nameMap[name]();
            });
            if (this.menu) {
                let item = this.menu.getItemById("close");
                if (item) item.accelerator = "CmdOrCtrl+Shift+W";
            }

            await this.postResult("pre-post-setup");

            [this._titlePage, this._projectsPage, this._projectPage] = this.addPage(
                new (this.constructor as typeof AppFeature).TitlePage(),
                new (this.constructor as typeof AppFeature).ProjectsPage(),
                new (this.constructor as typeof AppFeature).ProjectPage(),
            ) as [AppTitlePage, AppProjectsPage, AppProjectPage];

            this.page = "TITLE";
        });

        this.addHandler("change", () => {
            let names = new Set();
            this.projects.forEach(id => {
                let project = this.getProject(id) as lib.Project;
                if (project.meta.name.length <= 0) project.meta.name = "New Project";
                if (names.has(project.meta.name)) {
                    let count = 1;
                    while (names.has(project.meta.name+" ("+count+")")) count++;
                    project.meta.name += " ("+count+")";
                }
                names.add(project.meta.name);
            });
        });
    }

    get changes() { return [...this._changes]; }
    /** Marks a change in a specific project by string. */
    markChange(change: string): boolean {
        if (this.hasChange(change)) return true;
        this._changes.add(change);
        this.change("markChange", null, change);
        return true;
    }
    /** Checks if a change exists. */
    hasChange(change: string): boolean { return this._changes.has(change); }
    /**
     * Clears changes.
     * @returns the previous changes before clearing
     */
    clearChanges(): string[] {
        let changes = this.changes;
        this._changes.clear();
        this.change("clearChanges", changes, []);
        return changes;
    }
    /** Loads projects from save. */
    async loadProjects(): Promise<void> {
        await this.postResult("load-projects");
        let projectIds = util.castStringArray(await window.api.get("projects"));
        let projects: lib.Project[] = [];
        await Promise.all(projectIds.map(async id => {
            let projectContent = await window.api.get("project", id);
            let project = JSON.parse(projectContent, util.REVIVER.revivalFunction);
            projects.push(project);
        }));
        this.projectObjects = projects;
        this.clearChanges();
        await this.postResult("loaded-projects");
    }
    /**
     * Loads projects from save cleanly, with error handling.
     * @returns true if loaded without error, false if errored
     */
    async loadProjectsClean(): Promise<boolean> {
        try {
            await this.loadProjects();
        } catch (e) {
            await this.doError({
                title: "Projects Load Error", 
                infos: [e],
            });
            return false;
        }
        return true;
    }
    /** Saves projects. */
    async saveProjects(): Promise<void> {
        await this.postResult("save-projects");
        let changes = new Set(this.changes);
        this.clearChanges();
        let oldIds = util.castStringArray(await window.api.get("projects"));
        let newIds = this.projects;
        await Promise.all(oldIds.map(async id => {
            if (newIds.includes(id)) return;
            await window.api.del("project", id);
        }));
        await Promise.all(newIds.map(async id => {
            if (!(changes.has("*") || changes.has(":"+id))) return;
            let project = this.getProject(id) as lib.Project;
            if (!changes.has("*")) project.meta.modified = util.getTime();
            let projectContent = JSON.stringify(project);
            await window.api.set("project", id, projectContent);
        }));
        await this.postResult("saved-projects");
    }
    /**
     * Saves projects cleanly, with error handling.
     * @returns true if saved without error, false if errored
     */
    async saveProjectsClean(): Promise<boolean> {
        try {
            await this.saveProjects();
        } catch (e) {
            await this.doError({
                title: "Projects Save Error",
                infos: [e],
            });
            return false;
        }
        return true;
    }
    get projects() { return Object.keys(this._projects); }
    get projectObjects() { return Object.values(this._projects); }
    set projectObjects(values) {
        this.clearProjects();
        this.addProject(...values);
    }
    /**
     * Clears the projects from this app.
     * @returns the previous projects before clearing
     */
    clearProjects() {
        let projects = this.projects;
        this.remProject(...projects);
        return projects;
    }
    /** Checks if a project exists. */
    hasProject(id: lib.Project | string): boolean {
        if (typeof(id) === "string") return id in this._projects;
        if (!(id instanceof (this.constructor as typeof AppFeature).Project)) return false;
        return id.id != null && this.hasProject(id.id);
    }
    /** Gets the project by its associated id. */
    getProject(id: string): lib.Project | null {
        if (!this.hasProject(id)) return null;
        return this._projects[id];
    }
    /**
     * Adds a project to this app.
     * @returns the added project if successfully added, otherwise false. If multiple are added at once, an array of the successfully added ones are returned
     */
    addProject(...projects: lib.Project[]): util.Result<lib.Project> {
        return util.Target.resultingForEach(projects, project => {
            if (!(project instanceof (this.constructor as typeof AppFeature).Project)) return false;
            if (this.hasProject(project)) return false;

            let id = project.id;
            while (id == null || this.hasProject(id))
                id = util.jargonBase64(10);
            
            this._projects[id] = project;
            project.id = id;

            project.addLinkedHandler(this, "change", () => this.markChange(":"+id));
            this.markChange(":"+id);

            this.change("addProject", null, project);

            project.onAdd();

            return project;
        });
    }
    remProject(...projects: (lib.Project | string)[]): util.Result<lib.Project> {
        return util.Target.resultingForEach(projects, id => {
            if (typeof(id) !== "string") {
                if (id.id == null) return false;
                id = id.id;
            }
            if (!this.hasProject(id)) return false;
            
            let project = this.getProject(id) as lib.Project;

            project.onRem();

            this.change("remProject", project, null);

            project.id = null;
            delete this._projects[id];

            project.clearLinkedHandlers(this, "change");
            this.markChange(":"+id);

            return project;
        }) as util.Result<lib.Project>;
    }

    get titlePage() {
        if (!this._titlePage) throw new Error("titlePage is missing");
        return this._titlePage;
    }
    get projectsPage() {
        if (!this._projectsPage) throw new Error("projectsPage is missing");
        return this._projectsPage;
    }
    get projectPage() {
        if (!this._projectPage) throw new Error("projectPage is missing");
        return this._projectPage;
    }

    get eFeatureStyle() {
        if (!this._eFeatureStyle) throw new Error("eFeatureStyle is missing");
        return this._eFeatureStyle;
    }
    get eTitleBtn() {
        if (!this._eTitleBtn) throw new Error("eTitleBtn is missing");
        return this._eTitleBtn;
    }
    get eProjectsBtn() {
        if (!this._eProjectsBtn) throw new Error("eProjectsBtn is missing");
        return this._eProjectsBtn;
    }
    get eCreateBtn() {
        if (!this._eCreateBtn) throw new Error("eCreateBtn is missing");
        return this._eCreateBtn;
    }
    get eFileBtn() {
        if (!this._eFileBtn) throw new Error("eFileBtn is missing");
        return this._eFileBtn;
    }
    get eEditBtn() {
        if (!this._eEditBtn) throw new Error("eFileBtn is missing");
        return this._eEditBtn;
    }
    get eViewBtn() {
        if (!this._eViewBtn) throw new Error("eViewBtn is missing");
        return this._eViewBtn;
    }
    get eProjectInfo() {
        if (!this._eProjectInfo) throw new Error("eProjectInfo is missing");
        return this._eProjectInfo;
    }
    get eProjectInfoBtn() {
        if (!this._eProjectInfoBtn) throw new Error("eProjectInfoBtn is missing");
        return this._eProjectInfoBtn;
    }
    get eProjectInfoBtnIcon() {
        if (!this._eProjectInfoBtnIcon) throw new Error("eProjectInfoBtnIcon is missing");
        return this._eProjectInfoBtnIcon;
    }
    get eProjectInfoBtnName() {
        if (!this._eProjectInfoBtnName) throw new Error("eProjectInfoBtnName is missing");
        return this._eProjectInfoBtnName;
    }
    get eProjectInfoContent() {
        if (!this._eProjectInfoContent) throw new Error("eProjectInfoContent is missing");
        return this._eProjectInfoContent;
    }
    get eProjectInfoNameInput() {
        if (!this._eProjectInfoNameInput) throw new Error("eProjectInfoNameInput is missing");
        return this._eProjectInfoNameInput;
    }
    get eProjectInfoSaveBtn() {
        if (!this._eProjectInfoSaveBtn) throw new Error("eProjectInfoSaveBtn is missing");
        return this._eProjectInfoSaveBtn;
    }
    get eProjectInfoCopyBtn() {
        if (!this._eProjectInfoCopyBtn) throw new Error("eProjectInfoCopyBtn is missing");
        return this._eProjectInfoCopyBtn;
    }
    get eProjectInfoDeleteBtn() {
        if (!this._eProjectInfoDeleteBtn) throw new Error("eProjectInfoDeleteBtn is missing");
        return this._eProjectInfoDeleteBtn;
    }
    get eSaveBtn() {
        if (!this._eSaveBtn) throw new Error("eSaveBtn is missing");
        return this._eSaveBtn;
    }
}

// export class AppFeatureDirent extends util.Target {
//     readonly parent;
//     readonly name;

//     constructor(parent: AppFeatureDirentFolder | null, name: string) {
//         super();

//         this.parent = parent;
//         if (this.parent != null) this.parent.addChild(this);

//         this.name = name;
//     }

//     get app() { return App.instance; }

//     get icon() { return "help-circle"; }
// }
// export class AppFeatureDirentFolder extends AppFeatureDirent {
//     private _children: Set<AppFeatureDirent>;

//     constructor(parent: AppFeatureDirentFolder | null, name: string, children: AppFeatureDirent[]) {
//         super(parent, name);

//         this._children = new Set();

//         this.children = children;
//     }

//     get children() { return [...this._children]; }
//     set children(values) {
//         this.clearChildren();
//         this.addChild(...values);
//     }
//     clearChildren() {
//         let children = this.children;
//         this.remChild(children);
//         return children;
//     }
//     hasChild(dirent) {
//         if (!(dirent instanceof AppFeature.Dirent)) return false;
//         return this.#children.has(dirent);
//     }
//     addChild(...dirents) {
//         return util.Target.resultingForEach(dirents, dirent => {
//             if (!(dirent instanceof AppFeature.Dirent)) return false;
//             if (this.hasChild(dirent)) return false;
//             this.#children.add(dirent);
//             return dirent;
//         });
//     }
//     remChild(...dirents) {
//         return util.Target.resultingForEach(dirents, dirent => {
//             if (!(dirent instanceof AppFeature.Dirent)) return false;
//             if (!this.hasChild(dirent)) return false;
//             this.#children.delete(dirent);
//             return dirent;
//         });
//     }

//     get icon() { return "folder-outline"; }
// };
// AppFeature.DirentProject = class AppFeatureDirentProject extends util.Target {
//     #id;

//     constructor(parent, id) {
//         super(parent, "");

//         this.#id = String(id);
//     }

//     get id() { return this.#id; }

//     get project() { return this.app.getProject(id); }
//     hasProject() { return !!this.project; }

//     get name() { return this.hasProject() ? this.project.meta.name : "?"; }

//     get icon() { return "document-outline"; }
// };

export class AppTitlePage extends AppPage {
    protected static DESCRIPTION = "";

    static { AppFeature.TitlePage = this; }

    readonly eTitle;
    readonly eSubtitle;
    readonly eNav;
    readonly eCreateBtn;
    readonly eProjectsBtn;

    constructor() {
        super("TITLE");

        this.eTitle = document.createElement("div");
        this.elem.appendChild(this.eTitle);
        this.eTitle.classList.add("title");
        this.eTitle.innerHTML = "<span>Peninsula</span><span></span>";
        this.eTitle.children[1].textContent = this.app.getName();

        this.eSubtitle = document.createElement("div");
        this.elem.appendChild(this.eSubtitle);
        this.eSubtitle.classList.add("subtitle");
        this.eSubtitle.textContent = (this.constructor as typeof AppTitlePage).DESCRIPTION;

        this.eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");

        this.eCreateBtn = document.createElement("button");
        this.eNav.appendChild(this.eCreateBtn);
        this.eCreateBtn.classList.add("special");
        this.eCreateBtn.innerHTML = "Create<ion-icon name='add'></ion-icon>";
        this.eCreateBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.app.page = "PROJECT";
        });

        this.eProjectsBtn = document.createElement("button");
        this.eNav.appendChild(this.eProjectsBtn);
        this.eProjectsBtn.classList.add("normal");
        this.eProjectsBtn.innerHTML = "Projects<ion-icon name='chevron-forward'></ion-icon>";
        this.eProjectsBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.app.page = "PROJECTS";
        });

        this.addHandler("enter", async (data: any) => {
            this.app.title = "";
        });
    }

    get app() {
        if (super.app instanceof AppFeature) return super.app;
        throw new Error("App is not of class AppFeature");
    }
}
export class AppProjectsPage extends AppPage {
    private _buttons: Set<AppProjectsPageButton>;

    readonly eTitle;
    readonly eNav;
    readonly eSubNav;
    readonly eCreateBtn;
    readonly eInfo;
    readonly eInfoDisplayBtn;
    readonly eInfoDisplayBtnIcon;
    readonly eSearchBox;
    readonly eSearchInput;
    readonly eSearchBtn;
    readonly eContent;
    readonly eLoading;
    readonly eEmpty;

    constructor() {
        super("PROJECTS");

        this._buttons = new Set();

        this.eTitle = document.createElement("div");
        this.elem.appendChild(this.eTitle);
        this.eTitle.classList.add("title");
        this.eTitle.textContent = "Projects";

        this.eNav = document.createElement("div");
        this.elem.append(this.eNav);
        this.eNav.classList.add("nav");

        this.eSubNav = document.createElement("div");
        this.eNav.append(this.eSubNav);
        this.eSubNav.classList.add("nav");

        this.eCreateBtn = document.createElement("button");
        this.eSubNav.appendChild(this.eCreateBtn);
        this.eCreateBtn.classList.add("special");
        this.eCreateBtn.innerHTML = "Create<ion-icon name='add'></ion-icon>";
        this.eCreateBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.app.page = "PROJECT";
        });

        this.eInfo = document.createElement("div");
        this.eNav.appendChild(this.eInfo);
        this.eInfo.classList.add("info");

        this.eInfoDisplayBtn = document.createElement("button");
        this.eInfo.appendChild(this.eInfoDisplayBtn);
        this.eInfoDisplayBtn.innerHTML = "<ion-icon></ion-icon>";
        this.eInfoDisplayBtnIcon = this.eInfoDisplayBtn.children[0] as HTMLIonIconElement;
        this.eInfoDisplayBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (this.displayMode == "list") return this.displayMode = "grid";
            if (this.displayMode == "grid") return this.displayMode = "list";
        });

        this.eSearchBox = document.createElement("div");
        this.eNav.appendChild(this.eSearchBox);
        this.eSearchBox.classList.add("search");

        this.eSearchInput = document.createElement("input");
        this.eSearchBox.appendChild(this.eSearchInput);
        this.eSearchInput.type = "text";
        this.eSearchInput.placeholder = "Search...";
        this.eSearchInput.autocomplete = "off";
        this.eSearchInput.spellcheck = false;
        this.eSearchInput.addEventListener("input", e => {
            this.refresh();
        });

        this.eSearchBtn = document.createElement("button");
        this.eSearchBox.appendChild(this.eSearchBtn);
        this.eSearchBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.eSearchBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.eSearchInput.value = "";
            this.refresh();
        });

        this.eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.eContent.classList.add("list");

        this.eLoading = document.createElement("div");
        this.eContent.appendChild(this.eLoading);

        this.eEmpty = document.createElement("div");
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
        const contextMenu = (e: MouseEvent) => {
            let ids = [...selected];
            let item;
            let menu = new core.Menu();
            item = menu.addItem(new core.MenuItem("Create")) as core.MenuItem;
            item.addHandler("trigger", (e: MouseEvent) => {
                this.app.post("cmd-newproject");
            });
            menu.addItem(new core.MenuDivider());
            item = menu.addItem(new core.MenuItem("Open")) as core.MenuItem;
            item.disabled = ids.length != 1;
            item.addHandler("trigger", (e: MouseEvent) => {
                this.app.setPage("PROJECT", { id: ids[0] });
            });
            item = menu.addItem(new core.MenuItem("Rename")) as core.MenuItem;
            item.disabled = ids.length != 1;
            item.addHandler("trigger", async (e: MouseEvent) => {
                let project = this.app.getProject(ids[0]);
                if (!(project instanceof (this.app.constructor as typeof AppFeature).Project)) return;
                let result = await this.app.doPrompt({
                    title: "Rename", 
                    value: project.meta.name,
                });
                if (result == null) return;
                project.meta.name = result;
                await this.app.saveProjectsClean();
            });
            menu.addItem(new core.MenuDivider());
            item = menu.addItem(new core.MenuItem("Delete")) as core.MenuItem;
            item.disabled = ids.length <= 0;
            item.addHandler("trigger", (e: MouseEvent) => {
                this.app.post("cmd-delete", ids);
            });
            item = menu.addItem(new core.MenuItem("Duplicate")) as core.MenuItem;
            item.disabled = ids.length <= 0;
            item.addHandler("trigger", async (e: MouseEvent) => {
                for (let i = 0; i < ids.length; i++)
                    this.app.post("cmd-savecopy", this.app.getProject(ids[i]));
            });
            menu.addItem(new core.MenuDivider());
            item = menu.addItem(new core.MenuItem("Export")) as core.MenuItem;
            item.disabled = ids.length != 1;
            item.addHandler("trigger", async (e: MouseEvent) => {
                const result = await core.fileSaveDialog({
                    title: "Export "+this.app.getName()+" Project...",
                    buttonLabel: "Save",
                });
                if (result.canceled) return;
                const pth = result.filePath;
                try {
                    await window.api.send("project-export", pth, ids[0]);
                } catch (e) { this.app.doError({
                    title: "Project Export Error",
                    content: ids[0]+", "+pth,
                    infos: [e],
                }); }
            });
            item = menu.addItem(new core.MenuItem("Import")) as core.MenuItem;
            item.addHandler("trigger", async (e: MouseEvent) => {
                const result = await core.fileOpenDialog({
                    title: "Import "+this.app.getName()+" Project...",
                    buttonLabel: "Open",
                    filters: [{
                        name: "P"+this.app.getName()+" Project",
                        extensions: ["p"+this.name.toLowerCase()],
                    }],
                    properties: [
                        "openFile",
                    ],
                });
                if (result.canceled) return;
                const pth = result.filePaths[0];
                try {
                    await window.api.send("project-import", pth);
                } catch (e) { this.app.doError({
                    title: "Project Import Error",
                    content: pth,
                    infos: [e],
                }); }
                this.app.loadProjectsClean();
            });
            core.Menu.contextMenu = menu;
            core.Menu.placeContextMenu([e.pageX, e.pageY]);
        };
        this.eContent.addEventListener("contextmenu", contextMenu);
        
        let selected: Set<string> = new Set();
        let lastSelected: string | null = null, lastAction: number | null = null;
        const updateSelected = () => {
            [...selected].forEach(id => {
                if (this.app.hasProject(id)) return;
                selected.delete(id);
            });
            this.buttons.forEach(btn => {
                btn.selected = !!(btn.project && btn.project.id != null && selected.has(btn.project.id));
            });
        };
        this.addHandler("add", () => {
            this.app.addHandler("change-addProject", updateSelected);
            this.app.addHandler("change-remProject", updateSelected);
        });
        this.addHandler("refresh", updateSelected);
        this.addHandler("trigger", (e: MouseEvent, id: string, shift: boolean) => {
            if (!this.app.hasProject(id)) return;
            if (shift && lastSelected != null && this.app.hasProject(lastSelected)) {
                let ids = this.app.projects
                    .map(id => this.app.getProject(id) as lib.Project)
                    .sort((projectA, projectB) => projectB.meta.modified-projectA.meta.modified)
                    .map(project => project.id);
                let startIndex = ids.indexOf(lastSelected);
                let stopIndex = ids.indexOf(id);
                for (let i = Math.min(startIndex, stopIndex); i <= Math.max(startIndex, stopIndex); i++) {
                    let id = ids[i];
                    if (id == null) continue;
                    if (lastAction === -1) selected.delete(id);
                    if (lastAction === +1) selected.add(id);
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
        this.addHandler("contextmenu", (e: MouseEvent, id: string) => {
            updateSelected();
            if (selected.size === 1) this.post("trigger", e, [...selected][0]);
            if (selected.size === 0) this.post("trigger", e, id);
            contextMenu(e);
        });

        this.addHandler("enter", async (data: any) => {
            this.app.title = "Projects";
            this.app.eProjectsBtn.classList.add("this");
            await this.refresh();
        });
        this.addHandler("leave", async (data: any) => {
            this.app.eProjectsBtn.classList.remove("this");
        });

        this.displayMode = "grid";
    }

    get app() {
        if (super.app instanceof AppFeature) return super.app;
        throw new Error("App is not of class AppFeature");
    }

    /** Refreshes the UI and other elements of this page. */
    async refresh(): Promise<void> {
        this.clearButtons();
        this.eLoading.style.display = "block";
        this.eEmpty.style.display = "none";
        this.eLoading.style.display = "none";
        let projects = this.app.projects.map(id => this.app.getProject(id) as lib.Project);
        if (projects.length > 0) {
            let results = lib.search(projects, ["meta.name"], this.eSearchInput.value);
            this.addButton(...results.map(result => {
                let btn = new AppProjectsPageButton(result.item);
                if (result.matches) result.matches.forEach(match => btn.select(match.indices.map(tuple => [tuple[0], tuple[1]])));
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
    set displayMode(value) {
        this.eContent.classList.remove("list");
        this.eContent.classList.remove("grid");
        if (value === "list") this.eContent.classList.add("list");
        if (value === "grid") this.eContent.classList.add("grid");
        this.eInfoDisplayBtnIcon.name = this.displayMode;
    }

    get buttons() { return [...this._buttons]; }
    set buttons(values) {
        this.clearButtons();
        this.addButton(...values);
    }
    /**
     * Clears the buttons from this page.
     * @returns the previous buttons before clearing
     */
    clearButtons(): AppProjectsPageButton[] {
        let btns = this.buttons;
        this.remButton(...btns);
        return btns;
    }
    /** Checks if a button exists in this page. */
    hasButton(btn: AppProjectsPageButton): boolean { return this._buttons.has(btn); }
    /**
     * Adds a button to this page.
     * @returns the added button if successfully added, otherwise false. If multiple are added at once, an array of the successfully added ones are returned
     */
    addButton(...btns: AppProjectsPageButton[]): util.Result<AppProjectsPageButton> {
        let returnValue = util.Target.resultingForEach(btns, btn => {
            if (this.hasButton(btn)) return false;
            this._buttons.add(btn);
            btn.addLinkedHandler(this, "trigger", (e: MouseEvent) => {
                if (btn.project == null) return;
                this.post("trigger", e, btn.project.id, e.shiftKey);
            });
            btn.addLinkedHandler(this, "trigger2", (e: MouseEvent) => {
                if (btn.project == null) return;
                this.app.setPage("PROJECT", { id: btn.project.id });
            });
            btn.addLinkedHandler(this, "contextmenu", (e: MouseEvent) => {
                if (btn.project == null) return;
                this.post("contextmenu", e, btn.project.id);
            });
            this.eContent.appendChild(btn.elemList);
            this.eContent.appendChild(btn.elemGrid);
            btn.onAdd();
            btn.addLinkedHandler(this, "change", () => this.formatButtons());
            return btn;
        });
        this.formatButtons();
        return returnValue;
    }
    /**
     * Removes a button from this page.
     * @returns the removed button if successfully removed, otherwise false. If multiple are removed at once, an array of the successfully removed ones are returned
     */
    remButton(...btns: AppProjectsPageButton[]): util.Result<AppProjectsPageButton> {
        let returnValue = util.Target.resultingForEach(btns, btn => {
            if (!this.hasButton(btn)) return false;
            btn.onRem();
            this._buttons.delete(btn);
            btn.clearLinkedHandlers(this, "trigger");
            btn.clearLinkedHandlers(this, "trigger2");
            btn.clearLinkedHandlers(this, "contextmenu");
            this.eContent.removeChild(btn.elemList);
            this.eContent.removeChild(btn.elemGrid);
            btn.clearLinkedHandlers(this, "change");
            return btn;
        });
        this.formatButtons();
        return returnValue;
    }
    /** Formats buttons by sorting them in order of time. */
    formatButtons() {
        this.buttons.sort((buttonA, buttonB) => buttonB.time-buttonA.time).forEach((btn, i) => {
            btn.elemList.style.order = String(i);
            btn.elemGrid.style.order = String(i);
        });
    }

    get state() {
        return {
            query: this.eSearchInput.value,
        };
    }
    async loadState(state: any) {
        state = util.castObject(state);
        this.eSearchInput.value = util.castString(state.query);
        await this.refresh();
    }
    get persistentState() {
        return {
            displayMode: this.displayMode,
        };
    }
    async loadPersistentState(state: any) {
        state = util.castObject(state);
        let mode = util.castString(state.displayMode);
        this.displayMode = (mode === "list") ? "list" : (mode === "grid") ? "grid" : "list";
    }
}
export class AppProjectsPageButton extends util.Target {
    private _project: lib.Project | null;

    private _time: number;
    private _indices: util.vec2[];

    readonly elemList;
    readonly eListIcon;
    readonly eListName;
    readonly eListTime;
    readonly eListOptions;

    readonly elemGrid;
    readonly eGridIcon;
    readonly eGridName;
    readonly eGridOptions;
    readonly eGridImage;

    constructor(project?: lib.Project) {
        super();

        this._project = null;

        this._time = 0;
        this._indices = [];

        let eNav: HTMLDivElement;

        this.elemList = document.createElement("div");
        this.elemList.classList.add("item");
        this.elemList.classList.add("list");

        this.eListIcon = document.createElement("ion-icon");
        this.elemList.appendChild(this.eListIcon);

        this.eListName = document.createElement("div");
        this.elemList.appendChild(this.eListName);
        this.eListName.classList.add("name");

        this.eListTime = document.createElement("div");
        this.elemList.appendChild(this.eListTime);
        this.eListTime.classList.add("time");

        eNav = document.createElement("div");
        this.elemList.appendChild(eNav);
        eNav.classList.add("nav");

        this.eListOptions = document.createElement("button");
        eNav.appendChild(this.eListOptions);
        this.eListOptions.classList.add("icon");
        this.eListOptions.innerHTML = "<ion-icon name='ellipsis-vertical'></ion-icon>";

        this.elemGrid = document.createElement("div");
        this.elemGrid.classList.add("item");
        this.elemGrid.classList.add("grid");
        let eTop = document.createElement("div");
        this.elemGrid.appendChild(eTop);
        eTop.classList.add("top");

        this.eGridIcon = document.createElement("ion-icon");
        eTop.appendChild(this.eGridIcon);

        this.eGridName = document.createElement("div");
        eTop.appendChild(this.eGridName);
        this.eGridName.classList.add("name");

        eNav = document.createElement("div");
        eTop.appendChild(eNav);
        eNav.classList.add("nav");

        this.eGridOptions = document.createElement("button");
        eNav.appendChild(this.eGridOptions);
        this.eGridOptions.classList.add("icon");
        this.eGridOptions.innerHTML = "<ion-icon name='ellipsis-vertical'></ion-icon>";

        this.eGridImage = document.createElement("div");
        this.elemGrid.appendChild(this.eGridImage);
        this.eGridImage.classList.add("image");

        const contextMenu = (e: MouseEvent) => {
            e.stopPropagation();
            this.post("contextmenu", e);
        };
        this.elemList.addEventListener("contextmenu", contextMenu);
        this.elemGrid.addEventListener("contextmenu", contextMenu);
        this.eListOptions.addEventListener("click", contextMenu);
        this.eGridOptions.addEventListener("click", contextMenu);
        const click = (e: MouseEvent) => {
            e.stopPropagation();
            this.post("trigger", e);
        };
        this.elemList.addEventListener("click", click);
        this.elemGrid.addEventListener("click", click);
        const dblClick = (e: MouseEvent) => {
            e.stopPropagation();
            this.post("trigger2", e);
        };
        this.elemList.addEventListener("dblclick", dblClick);
        this.elemGrid.addEventListener("dblclick", dblClick);

        this.eListIcon.name = "document-outline";
        this.eGridIcon.name = "document-outline";

        this.addHandler("change-project", (from: lib.Project | null, to: lib.Project | null) => {
            const doThumb = () => {
                if (!this.project) return;
                this.eGridImage.style.backgroundImage = "url('"+this.project.meta.thumb+"')";
            };
            if (from) from.clearLinkedHandlers(this, "thumb");
            if (to) to.addLinkedHandler(this, "thumb", doThumb);
            doThumb();
        });

        this.addHandler("change", () => {
            if (!this.project) return;
            this.name = this.project.meta.name;
            this.time = this.project.meta.modified;
        });

        this.project = project || null;
    }

    get project() { return this._project; }
    set project(value) {
        if (this.project === value) return;
        if (this.project) this.project.clearLinkedHandlers(this, "change");
        this.change("project", this.project, this._project=value);
        if (this.project) this.project.addLinkedHandler(this, "change", (c, f, t) => this.change("project."+c, f, t));
    }

    get name() { return util.castString(this.eListName.textContent); }
    set name(value) {
        this.eListName.textContent = this.eGridName.textContent = value;
        value = this.name;
        const indices = this._indices;
        if (indices.length <= 0) return;
        let chunks = [];
        indices.forEach((range, i) => {
            chunks.push(value.slice((i > 0) ? indices[i-1][1] : 0, range[0]));
            chunks.push(value.slice(range[0], range[1]));
        });
        chunks.push(value.slice((indices.length > 0) ? (indices.at(-1) as util.vec2)[1] : 0, value.length));
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
    /** Selects a specific range of text (used for search finding). */
    select(indices: util.vec2[]): void {
        this._indices = indices;
        this.name = this.name;
    }

    get time() { return this._time; }
    set time(value) {
        if (this.time === value) return;
        this._time = value;
        let date = new Date(this.time);
        let mon = date.getMonth()+1;
        let d = date.getDate();
        let yr = date.getFullYear();
        let hr = date.getHours();
        let isAM = hr < 12;
        if (!isAM) hr -= 12;
        if (hr === 0) hr = 12;
        let min = date.getMinutes();
        this.eListTime.textContent = `${mon}-${d}-${yr} ${hr}:${String(min).padStart(2, "0")}${isAM?"AM":"PM"}`;
    }

    get selected() { return this.elemList.classList.contains("selected"); }
    set selected(value) {
        if (value) this.elemList.classList.add("selected");
        else this.elemList.classList.remove("selected");
        if (value) this.elemGrid.classList.add("selected");
        else this.elemGrid.classList.remove("selected");
    }
}
export class AppProjectPage extends AppPage {
    private _projectId: string | null;

    private _progress: number;
    private _progressHover: number;
    private _playbackSections: Set<AppProjectPagePlaybackSection>;

    readonly eMain;
    readonly eNav;
    readonly eNavPre;
    readonly eNavPost;
    readonly eNavProgress;
    readonly eNavProgressTooltip;
    readonly eNavOptionsButton;
    readonly eNavActionButton;
    readonly eNavForwardButton;
    readonly eNavBackButton;
    readonly eNavInfo;

    constructor() {
        super("PROJECT");

        this._progress = 0;
        this._progressHover = 0;
        this._playbackSections = new Set();

        this.eMain = document.createElement("div");
        this.elem.appendChild(this.eMain);
        this.eMain.classList.add("main");

        this.eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.tabIndex = 1;
        this.eNav.classList.add("nav");

        this.eNavPre = document.createElement("div");
        this.eNav.appendChild(this.eNavPre);
        this.eNavPre.classList.add("pre");

        this.eNavPost = document.createElement("div");
        this.eNav.appendChild(this.eNavPost);
        this.eNavPost.classList.add("post");

        this.eNavProgress = document.createElement("div");
        this.eNav.appendChild(this.eNavProgress);
        this.eNavProgress.classList.add("progress");
        this.eNavProgress.innerHTML = "<div class='hover'><p-tooltip class='hov nx'></p-tooltip></div>";

        this.eNavProgressTooltip = this.eNavProgress.querySelector(":scope > .hover > p-tooltip");
        this.eNavOptionsButton = document.createElement("button");
        this.eNavPre.appendChild(this.eNavOptionsButton);
        this.eNavOptionsButton.innerHTML = "<ion-icon name='ellipsis-vertical'></ion-icon>";

        this.eNavActionButton = document.createElement("button");
        this.eNavPre.appendChild(this.eNavActionButton);
        this.eNavActionButton.innerHTML = "<ion-icon name='play'></ion-icon>";

        this.eNavBackButton = document.createElement("button");
        this.eNavPre.appendChild(this.eNavBackButton);
        this.eNavBackButton.innerHTML = "<ion-icon name='play-skip-back'></ion-icon>";

        this.eNavForwardButton = document.createElement("button");
        this.eNavPre.appendChild(this.eNavForwardButton);
        this.eNavForwardButton.innerHTML = "<ion-icon name='play-skip-forward'></ion-icon>";

        this.eNavInfo = document.createElement("div");
        this.eNavPost.appendChild(this.eNavInfo);
        this.eNavInfo.classList.add("info");
        
        this.navOpen = true;

        this.progress = 0;
        this.progressHover = 0;

        const onMouseMove = (e: MouseEvent) => {
            let rect = this.eNavProgress.getBoundingClientRect();
            let lerp = (e.pageX-rect.left) / rect.width;
            this.progressHover = lerp;
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target !== document.body && e.target !== this.eNav) return;
            if (e.code === "ArrowLeft") {
                this.post("nav-back");
                this.eNav.focus();
            }
            if (e.code === "ArrowRight") {
                this.post("nav-forward");
                this.eNav.focus();
            }
            if (e.code === "Comma") {
                this.post("nav-back-small");
                this.eNav.focus();
            }
            if (e.code === "Period") {
                this.post("nav-forward-small");
                this.eNav.focus();
            }
            if (e.code === "Space") {
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
        let saveLock = false;
        this.addHandler("update", async () => {
            if (saveLock) return;
            if (!timer.dequeueAll(10000)) return;
            saveLock = true;
            await this.app.postResult("cmd-save");
            saveLock = false;
        });

        this._projectId = null;

        this.addHandler("enter", async (data: any) => {
            if (this.app.menu) {
                let projectOnly = [
                    "savecopy",
                    "export", "import",
                    "delete", "closeproject",
                ];
                projectOnly.forEach(id => {
                    let item = (this.app.menu as core.Menu).getItemById(id);
                    if (!item) return;
                    item.exists = true;
                });
                let item;
                item = this.app.menu.getItemById("closeproject");
                if (item) item.accelerator = "CmdOrCtrl+W";
                item = this.app.menu.getItemById("close");
                if (item) item.accelerator = "CmdOrCtrl+Shift+W";
            }
            Array.from(document.querySelectorAll(".forproject")).forEach(elem => ((elem as HTMLElement).style.display = ""));
            await this.postResult("post-enter", data);
        });
        this.addHandler("leave", async (data: any) => {
            if (this.app.menu) {
                let projectOnly = [
                    "savecopy",
                    "export", "import",
                    "delete", "closeproject",
                ];
                projectOnly.forEach(id => {
                    let item = (this.app.menu as core.Menu).getItemById(id);
                    if (!item) return;
                    item.exists = false;
                });
                let item;
                item = this.app.menu.getItemById("closeproject");
                if (item) item.accelerator = null;
                item = this.app.menu.getItemById("close");
                if (item) item.accelerator = null;
            }
            Array.from(document.querySelectorAll(".forproject")).forEach(elem => ((elem as HTMLElement).style.display = "none"));
            this.app.markChange("*");
            await this.app.post("cmd-save");
            await this.postResult("post-leave", data);
        });
    }

    get app() {
        if (super.app instanceof AppFeature) return super.app;
        throw new Error("App is not of class AppFeature");
    }

    /** Refreshes this page by triggering an event. */
    async refresh() {
        await this.app.loadProjectsClean();
        this.app.dragging = false;
        await this.postResult("refresh");
    }

    get projectId() { return this._projectId; }
    set projectId(value) {
        if (value != null && !this.app.hasProject(value)) value = null;
        if (this.projectId === value) return;
        if (this.project) this.project.clearLinkedHandlers(this, "change");
        let project = this.project;
        this._projectId = value;
        if (this.project) this.project.addLinkedHandler(this, "change", (c, f, t) => this.change("project."+c, f, t));
        this.change("project", project, this.project);
    }
    get project() { return this.projectId == null ? null : this.app.getProject(this.projectId); }
    set project(value) {
        if (!(value instanceof (this.app.constructor as typeof AppFeature).Project)) value = null;
        if (this.project === value) return;
        if (value) this.projectId = value.id;
        else this.projectId = null;
    }

    get progress() { return this._progress; }
    set progress(value) {
        value = Math.min(1, Math.max(0, value));
        if (this.progress === value) return;
        this.change("progress", this.progress, this._progress=value);
        this.eNavProgress.style.setProperty("--progress", (this.progress*100)+"%");
    }
    get progressHover() { return this._progressHover; }
    set progressHover(value) {
        value = Math.min(1, Math.max(0, value));
        if (this.progressHover === value) return;
        this.change("progressHover", this.progressHover, this._progressHover=value);
        this.eNavProgress.style.setProperty("--hover", (this.progressHover*100)+"%");
    }
    get playbackSections() { return [...this._playbackSections]; }
    set playbackSections(values) {
        this.clearPlaybackSections();
        this.addPlaybackSection(...values);
    }
    /**
     * Clears the playback sections from this page.
     * @returns the previous sections before clearing
     */
    clearPlaybackSections(): AppProjectPagePlaybackSection[] {
        let sections = this.playbackSections;
        this.remPlaybackSection(...sections);
        return sections;
    }
    /** Checks if a playback section exists in this page. */
    hasPlaybackSection(section: AppProjectPagePlaybackSection): boolean { return this._playbackSections.has(section); }
    /**
     * Adds a playback section to this page.
     * @returns the added section if successfully added, otherwise false. If multiple are added at once, an array of the successfully added ones are returned
     */
    addPlaybackSection(...sections: AppProjectPagePlaybackSection[]): util.Result<AppProjectPagePlaybackSection> {
        return util.Target.resultingForEach(sections, section => {
            if (this.hasPlaybackSection(section)) return false;
            this._playbackSections.add(section);
            this.eNavProgress.appendChild(section.elem);
            return section;
        });
    }
    /**
     * Removes a playback section from this odometry.
     * @returns the removed section if successfully removed, otherwise false. If multiple are removed at once, an array of the successfully removed ones are returned
     */
    remPlaybackSection(...sections: AppProjectPagePlaybackSection[]): util.Result<AppProjectPagePlaybackSection> {
        return util.Target.resultingForEach(sections, section => {
            if (!this.hasPlaybackSection(section)) return false;
            this._playbackSections.delete(section);
            this.eNavProgress.removeChild(section.elem);
            return section;
        });
    }

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
    async loadState(state: any) {
        state = util.castObject(state);
        await this.app.loadProjects();
        await this.app.setPage(this.name, { id: state.id });
    }

    async determineSame(data: any) {
        data = util.castObject(data);
        if (this.app.hasProject(data.id)) return this.projectId == data.id;
        else if (data.project instanceof (this.app.constructor as typeof AppFeature).Project)
            return this.project === data.project;
        return false;
    }
}
export class AppProjectPagePlaybackSection extends util.Target {
    private _l: number;
    private _r: number;
    private _y: number;

    readonly elem;

    constructor(l: number, r: number, y: number) {
        super();

        this._l = this._r = this._y = 0;

        this.elem = document.createElement("div");
        this.elem.classList.add("section");

        this.addHandler("change", () => {
            this.elem.style.setProperty("--l", (this.l*100)+"%");
            this.elem.style.setProperty("--r", (this.r*100)+"%");
            this.elem.style.setProperty("--x", String(this.y));
        });

        [this.l, this.r, this.y] = [l, r, y];
    }

    get l() { return this._l; }
    set l(value) {
        value = Math.min(1, Math.max(0, value));
        if (this.l === value) return;
        this.change("l", this.l, this._l=value);
    }
    get r() { return this._r; }
    set r(value) {
        value = Math.min(1, Math.max(0, value));
        if (this.r === value) return;
        this.change("r", this.r, this._r=value);
    }
    get y() { return this._y; }
    set y(value) {
        value = Math.max(0, Math.round(value));
        if (this.y === value) return;
        this.change("x", this.y, this._y=value);
    }

    get color() { return this.elem.style.backgroundColor; }
    set color(v) { this.elem.style.backgroundColor = v; }
}
