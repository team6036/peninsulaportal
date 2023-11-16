import * as util from "./util.mjs";
import { V } from "./util.mjs";


export class App extends util.Target {
    #setupConfig;
    #setupDone;

    #fullscreen;
    #devMode;
    #holiday;

    #popups;

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

    constructor() {
        super();

        this.#setupConfig = {};
        this.#setupDone = false;

        this.#fullscreen = false;
        this.#devMode = false;
        this.#holiday = null;

        this.#popups = [];

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

        window.api.onPerm(() => {
            if (this.setupDone) return;
            window.api.sendPerm(true);
        });

        this.addHandler("start", () => {
            let id = setInterval(() => {
                if (document.readyState != "complete") return;
                clearInterval(id);
                (async () => {
                    await this.post("pre-setup");
                    await this.setup();
                    await this.post("post-setup");
                    let page = await window.api.send("state-get", "page");
                    let pageState = await window.api.send("state-get", "page-state");
                    let pageLazyStates = util.ensure(await window.api.send("state-get", "page-lazy-states"), "obj");
                    for (let name in pageLazyStates) {
                        if (!this.hasPage(name)) continue;
                        await this.getPage(name).loadLazyState(util.ensure(pageLazyStates[name], "obj"));
                    }
                    if (this.hasPage(page)) {
                        await this.getPage(page).loadState(util.ensure(pageState, "obj"));
                        if (this.page != page) this.page = page;
                    }
                    let t0 = null;
                    const update = () => {
                        window.requestAnimationFrame(update);
                        let t1 = util.getTime();
                        if (t0 == null) return t0 = t1;
                        this.post("update", t1-t0);
                        t0 = t1;
                    };
                    update();
                })();
            }, 10);
        });

        this.addHandler("update", delta => {
            this.pages.forEach(name => this.getPage(name).update(delta));
        });
    }

    get setupConfig() { return this.#setupConfig; }
    get setupDone() { return this.#setupDone; }

    start() { this.post("start"); }

    async getAbout() {
        let os = util.ensure(await window.version.os(), "obj");
        os.platform = util.ensure(os.platform, "str", "?");
        os.arch = util.ensure(os.arch, "str", "?");
        os.cpus = util.ensure(os.cpus, "arr").map(cpu => {
            cpu = util.ensure(cpu, "obj");
            cpu.model = util.ensure(cpu.model, "str", "?");
            return cpu;
        });
        let app = await window.api.get("version");
        return {
            node: String(window.version.node()),
            chrome: String(window.version.chrome()),
            electron: String(window.version.electron()),
            os: os,
            app: String(app),
        };
    }
    async getAboutLines() {
        let about = await this.getAbout();
        let lines = new Array(5).fill("");
        lines[0] = "NodeJS: "+about.node;
        lines[1] = "Chrome: "+about.chrome;
        lines[2] = "Electron: "+about.electron;
        lines[3] = "OS: "+about.os.platform+" "+about.os.arch;
        if (about.os.cpus.length > 0) {
            let models = [...new Set(about.os.cpus.map(obj => obj.model))];
            lines[3] += " / ";
            if (models.length > 1) lines[3] += "CPUS: "+models.join(", ");
            else lines[3] += models[0];
        }
        lines[4] = "App: "+about.app;
        return lines;
    }

    async createMarkdown(text) {
        const converter = new showdown.Converter({
            ghCompatibleHeaderId: true,
            strikethrough: true,
            tables: true,
            tasklists: true,
            openLinksInNewWindow: false,
        });
        converter.setFlavor("github");
        let article = document.createElement("article");
        document.querySelector("#PAGE > .content").appendChild(article);
        article.classList.add("md");
        article.innerHTML = converter.makeHtml(text);
        const dfs = async elem => {
            if (elem instanceof HTMLAnchorElement) {
                let href = elem.href;
                if (href.startsWith(window.location.href)) {
                    let hash = href.substring(window.location.href.length);
                    elem.addEventListener("click", e => {
                        e.preventDefault();
                        let target = document.querySelector(hash);
                        if (!(target instanceof HTMLElement)) return;
                        this.eContent.scrollTo({ top: target.offsetTop-100, behavior: "smooth" });
                    });
                }
            }
            if (elem instanceof HTMLImageElement) {
                let location = window.location.href.split("/");
                location.pop();
                location = location.join("/");
                if (elem.src.startsWith(location)) {
                    let path = elem.src.substring(location.length);
                    location = location.split("/");
                    location.pop();
                    location = location.join("/");
                    if (path.endsWith("icon.png")) {
                        const onHolidayState = async holiday => {
                            elem.src = (holiday == null) ? (location + path) : util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").png;
                        };
                        this.addHandler("cmd-win-holiday", async holiday => {
                            await onHolidayState(holiday);
                        });
                        await onHolidayState(await window.api.get("active-holiday"));
                    } else elem.src = location + path;
                }
            }
            await Promise.all(Array.from(elem.children).map(child => dfs(child)));
        };
        await dfs(article);
        hljs.configure({ cssSelector: "article.md pre code" });
        hljs.highlightAll();
        return article;
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
        (async () => {
            let about = await this.getAbout();
            document.documentElement.style.setProperty("--fs", (v ? 1 : 0));
            document.documentElement.style.setProperty("--LEFT", ((v || about.os.platform != "darwin") ? 0 : 80)+"px");
        })();
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
                        if (c == "_") rgb = getComputedStyle(document.body).getPropertyValue("--v"+i);
                        else rgb = getComputedStyle(document.body).getPropertyValue("--c"+c+i);
                        out.push("padding:10px;background:"+rgb+";");
                    }
                    console.log(...out);
                });
            };
        } else { 
            if (window.app == this) delete window.app;
            delete window.colors;
        }
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

        const root = ("root" in this.setupConfig) ? this.setupConfig.root : "..";

        window.api.onPerm(() => {
            (async () => {
                let perm = await this.getPerm();
                window.api.sendPerm(perm);
            })();
        });
        window.api.on((_, cmd, ...a) => {
            cmd = String(cmd);
            this.post("cmd", cmd, ...a);
            this.post("cmd-"+cmd, ...a);
        });
        this.addHandler("perm", async () => {
            if (this.hasPage(this.page)) {
                await window.api.send("state-set", "page", this.page);
                await window.api.send("state-set", "page-state", this.getPage(this.page).state);
                let pageLazyStates = {};
                this.pages.forEach(name => (pageLazyStates[name] = this.getPage(name).lazyState));
                await window.api.send("state-set", "page-lazy-states", pageLazyStates);
            }
            return true;
        });
        this.addHandler("cmd-about", async () => {
            let name = String(await window.api.get("name"));
            let holiday = await window.api.get("active-holiday");
            let pop = this.alert();
            pop.iconSrc = (holiday == null) ? (root+"/assets/app/icon.svg") : util.ensure(util.ensure(await window.api.get("holiday-icons"), "obj")[holiday], "obj").svg;
            pop.iconColor = "var(--a)";
            pop.subIcon = util.is(this.constructor.ICON, "str") ? this.constructor.ICON : "";
            pop.content = "Peninsula "+util.capitalize(name);
            pop.info = (await this.getAboutLines()).join("\n");
            pop.hasInfo = true;
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
        this.eStyle.href = "./style.css";

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
        ionicons1.src = root+"/node_modules/ionicons/dist/ionicons/ionicons.esm.js";
        const ionicons2 = document.createElement("script");
        document.body.appendChild(ionicons2);
        ionicons2.noModule = true;
        ionicons2.src = root+"/node_modules/ionicons/dist/ionicons/ionicons.js";

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
        highlight2.href = root+"/assets/modules/highlight.min.css";

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

        if (this.hasELoadingTo())
            this.eLoadingTo.style.visibility = "hidden";
        
        let t = util.getTime();
        
        this.fullscreen = await window.api.get("fullscreen");
        this.devMode = await window.api.get("devmode");
        this.holiday = await window.api.get("active-holiday");

        let about = await this.getAbout();
        document.documentElement.style.setProperty("--WIN32", ((about.os.platform == "win32") ? 1 : 0));
        document.documentElement.style.setProperty("--DARWIN", ((about.os.platform == "darwin") ? 1 : 0));
        document.documentElement.style.setProperty("--LINUX", ((about.os.platform == "linux") ? 1 : 0));

        const themeUpdate = async () => {
            let data = util.ensure(util.ensure(await window.api.get("themes"), "obj")[await window.api.get("theme")], "obj");
            this.base = data.base || Array.from(new Array(9).keys()).map(i => new Array(3).fill(255*i/9));
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
        };
        this.addHandler("cmd-theme", () => themeUpdate());
        await themeUpdate();

        await this.post("setup");

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
        for (let i = 0; i <= 9; i++) {
            let normal = (i < 9);
            for (let j = 0; j < 16; j++) {
                let alpha = j/15;
                let hex = "0123456789abcdef"[j];
                if (normal) style["v"+i+"-"+hex] = "rgba("+[...this.getBase(i).rgb, alpha].join(",")+")";
                else style["v-"+hex] = style["v4-"+hex];
            }
            if (normal) style["v"+i] = style["v"+i+"-f"];
            else style["v"] = style["v-f"];
        }
        let black = this.getBase(1), white = this.getBase(8);
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
                    else style[header+"-"+hex] = style[header+"4-"+hex];
                }
                if (normal) style[header+i] = style[header+i+"-f"];
                else style[header] = style[header+"-f"];
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
    }

    async getPerm() {
        let perms = await this.post("perm");
        let all = this.popups.length <= 0;
        perms.forEach(v => { all &&= v; });
        return all;
    }

    get popups() { return [...this.#popups]; }
    set popups(v) {
        v = util.ensure(v, "arr");
        this.clearPopups();
        v.forEach(v => this.addPopup(v));
    }
    clearPopups() {
        let pops = this.popups;
        pops.forEach(pop => this.remPopup(pop));
        return pops;
    }
    hasPopup(pop) {
        if (!(pop instanceof App.PopupBase)) return false;
        return this.#popups.includes(pop);
    }
    addPopup(pop) {
        if (!(pop instanceof App.PopupBase)) return false;
        if (this.hasPopup(pop)) this.remPopup(pop);
        this.#popups.push(pop);
        pop._onClose = () => {
            this.remPopup(pop);
        };
        pop.addHandler("close", pop._onClose);
        document.body.appendChild(pop.elem);
        setTimeout(() => {
            if (!this.hasPopup(pop)) return;
            pop.elem.classList.add("in");
        }, 0.01*1000);
        window.api.set("closeable", this.popups.length <= 0);
        return pop;
    }
    remPopup(pop) {
        if (!(pop instanceof App.PopupBase)) return false;
        if (!this.hasPopup(pop)) return false;
        this.#popups.splice(this.#popups.indexOf(pop), 1);
        pop.remHandler("close", pop._onClose);
        delete pop._onClose;
        pop.elem.classList.remove("in");
        setTimeout(() => {
            if (this.hasPopup(pop)) return;
            document.body.removeChild(pop.elem);
        }, 0.25*1000);
        window.api.set("closeable", this.popups.length <= 0);
        return pop;
    }
    alert(...a) { return this.addPopup(new App.Alert(...a)); }
    error(...a) { return this.addPopup(new App.Error(...a)); }
    confirm(...a) { return this.addPopup(new App.Confirm(...a)); }
    prompt(...a) { return this.addPopup(new App.Prompt(...a)); }

    get contextMenu() { return this.#contextMenu; }
    set contextMenu(v) {
        v = (v instanceof App.ContextMenu) ? v : null;
        if (this.contextMenu == v) return;
        if (this.hasContextMenu())
            document.body.removeChild(this.contextMenu.elem);
        this.#contextMenu = v;
        if (this.hasContextMenu())
            document.body.appendChild(this.contextMenu.elem);
    }
    hasContextMenu() { return this.contextMenu instanceof App.ContextMenu; }
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
    addPage(page) {
        if (!(page instanceof App.Page)) return false;
        if (page.app != this) return false;
        if (this.hasPage(page.name)) return false;
        this.#pages[page.name] = page;
        this.eMount.appendChild(page.elem);
        page.leave(null);
        return page;
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
    #elem;
    #inner;

    #hasResult;
    #result;
    #resultRes;

    constructor() {
        super();

        this.#hasResult = false;
        this.#result = null;
        this.#resultRes = [];

        this.#elem = document.createElement("div");
        this.elem.classList.add("popup");
        this.#inner = document.createElement("div");
        this.elem.appendChild(this.inner);
        this.inner.classList.add("inner");

        this.addHandler("result", result => {
            this.#hasResult = true;
            this.#result = result;
            this.#resultRes.forEach(res => res(this.result));
            this.#resultRes = [];
            this.close();
        });
    }

    get hasResult() { return this.#hasResult; }
    get result() { return this.#result; }
    async whenResult() {
        if (this.hasResult) return this.result;
        return await new Promise((res, rej) => this.#resultRes.push(res));
    }

    get elem() { return this.#elem; }
    get inner() { return this.#inner; }

    close() { this.post("close"); }
};
App.Popup = class AppPopup extends App.PopupBase {
    #eClose;
    #eTitle;
    #eContent;

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

        this.eClose.addEventListener("click", e => this.close());
    }

    get eClose() { return this.#eClose; }
    get eTitle() { return this.#eTitle; }
    get eContent() { return this.#eContent; }

    get title() { return this.eTitle.textContent; }
    set title(v) { this.eTitle.textContent = v; }
};
App.CorePopup = class AppCorePopup extends App.PopupBase {
    #eIconBox;
    #eIcon;
    #eSubIcon;
    #eContent;
    #eInfo;

    constructor(content, icon="") {
        super();

        this.elem.classList.add("core");

        this.#eIconBox = document.createElement("div");
        this.inner.appendChild(this.eIconBox);
        this.eIconBox.classList.add("icon");
        this.#eIcon = document.createElement("ion-icon");
        this.eIconBox.appendChild(this.eIcon);
        this.#eSubIcon = document.createElement("ion-icon");
        this.eIconBox.appendChild(this.eSubIcon);
        this.#eContent = document.createElement("div");
        this.inner.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eInfo = document.createElement("pre");
        this.eInfo.classList.add("info");

        this.content = content;
        this.icon = icon;
    }

    get eIconBox() { return this.#eIconBox; }
    get eIcon() { return this.#eIcon; }
    get eSubIcon() { return this.#eSubIcon; }
    get eContent() { return this.#eContent; }
    get eInfo() { return this.#eInfo; }

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
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }

    get subIcon() { return this.eSubIcon.getAttribute("name"); }
    set subIcon(v) {
        this.eSubIcon.removeAttribute("src");
        this.eSubIcon.setAttribute("name", v);
    }
    get subIconSrc() { return this.eSubIcon.getAttribute("src"); }
    set subIconSrc(v) {
        this.eSubIcon.removeAttribute("name");
        this.eSubIcon.setAttribute("src", v);
    }
    get subIconColor() { return this.eSubIcon.style.color; }
    set subIconColor(v) { this.eSubIcon.style.color = v; }
    
    get content() { return this.eContent.textContent; }
    set content(v) { this.eContent.textContent = v; }

    get hasInfo() { return this.elem.contains(this.eInfo); }
    set hasInfo(v) {
        v = !!v;
        if (this.hasInfo == v) return;
        if (v) this.inner.insertBefore(this.eInfo, this.eButton);
        else this.inner.removeChild(this.eInfo);
    }
    get info() { return this.eInfo.innerHTML; }
    set info(v) { this.eInfo.innerHTML = String(v).replaceAll("<", "&lt").replaceAll(">", "&gt"); }
}
App.Alert = class AppAlert extends App.CorePopup {
    #eButton;

    constructor(content, icon="alert-circle", button="OK") {
        super(content, icon);

        this.elem.classList.add("alert");

        this.#eButton = document.createElement("button");
        this.inner.appendChild(this.eButton);
        this.eButton.classList.add("special");

        this.eButton.addEventListener("click", e => this.post("result", null));

        this.button = button;
    }

    get eButton() { return this.#eButton; }

    get button() { return this.eButton.textContent; }
    set button(v) { this.eButton.textContent = v; }
};
App.Error = class AppError extends App.Alert {
    constructor(content, info) {
        super(content, "warning");

        this.iconColor = "var(--cr)";

        this.hasInfo = true;
        this.info = info;
    }
};
App.Confirm = class AppConfirm extends App.CorePopup {
    #eConfirm;
    #eCancel;

    constructor(content, icon="help-circle", confirm="OK", cancel="Cancel") {
        super(content, icon);

        this.elem.classList.add("confirm");

        this.#eConfirm = document.createElement("button");
        this.inner.appendChild(this.eConfirm);
        this.eConfirm.classList.add("special");
        this.#eCancel = document.createElement("button");
        this.inner.appendChild(this.eCancel);

        this.eConfirm.addEventListener("click", async e => {
            await this.post("result", true);
        });
        this.eCancel.addEventListener("click", async e => {
            await this.post("result", false);
        });

        this.confirm = confirm;
        this.cancel = cancel;
    }

    get eCancel() { return this.#eCancel; }
    get eConfirm() { return this.#eConfirm; }

    get confirm() { return this.eConfirm.textContent; }
    set confirm(v) { this.eConfirm.textContent = v; }
    get cancel() { return this.eCancel.textContent; }
    set cancel(v) { this.eCancel.textContent = v; }
};
App.Prompt = class AppPrompt extends App.CorePopup {
    #eInput;
    #eConfirm;
    #eCancel;

    constructor(content, value="", icon="pencil", confirm="OK", cancel="Cancel", placeholder="...") {
        super(content, icon);

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

        this.eConfirm.addEventListener("click", async e => {
            await this.post("result", this.eInput.value);
        });
        this.eCancel.addEventListener("click", async e => {
            await this.post("result", null);
        });

        this.eInput.value = value;
        this.confirm = confirm;
        this.cancel = cancel;
        this.placeholder = placeholder;
    }

    get eInput() { return this.#eInput; }
    get eCancel() { return this.#eCancel; }
    get eConfirm() { return this.#eConfirm; }

    get confirm() { return this.eConfirm.textContent; }
    set confirm(v) { this.eConfirm.textContent = v; }
    get cancel() { return this.eCancel.textContent; }
    set cancel(v) { this.eCancel.textContent = v; }

    get placeholder() { return this.eInput.placeholder; }
    set placeholder(v) { this.eInput.placeholder = v; }
};
App.ContextMenu = class AppContextMenu extends util.Target {
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
        v.forEach(v => this.addItem(v));
    }
    clearItems() {
        let itms = this.items;
        itms.forEach(itm => this.remItem(itm));
        return itms;
    }
    hasItem(itm) {
        if (!(itm instanceof App.ContextMenu.Item)) return false;
        return this.#items.includes(itm);
    }
    addItem(itm) {
        if (!(itm instanceof App.ContextMenu.Item)) return false;
        if (this.hasItem(itm)) return false;
        this.#items.push(itm);
        this.elem.appendChild(itm.elem);
        return itm;
    }
    remItem(itm) {
        if (!(itm instanceof App.ContextMenu.Item)) return false;
        if (!this.hasItem(itm)) return false;
        this.#items.splice(this.#items.indexOf(itm), 1);
        this.elem.removeChild(itm.elem);
        return itm;
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
};
App.ContextMenu.Item = class AppContextMenuItem extends util.Target {
    #items;

    #elem;
    #eIcon;
    #eLabel;
    #eShortcut;
    #eDropdownIcon;
    #eDropdown;

    constructor(label, icon="") {
        super();

        this.#items = [];

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.eIcon.classList.add("icon");
        this.#eLabel = document.createElement("div");
        this.elem.appendChild(this.eLabel);
        this.eLabel.classList.add("label");
        this.#eShortcut = document.createElement("div");
        this.elem.appendChild(this.eShortcut);
        this.eShortcut.classList.add("shortcut");
        this.#eDropdownIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eDropdownIcon);
        this.eDropdownIcon.classList.add("dropdown");
        this.eDropdownIcon.setAttribute("name", "chevron-forward");
        this.#eDropdown = document.createElement("div");
        this.elem.appendChild(this.eDropdown);
        this.eDropdown.classList.add("dropdown");

        this.elem.addEventListener("mouseenter", e => this.fix());
        this.elem.addEventListener("click", e => {
            if (this.disabled) return;
            this.post("trigger", e);
        });

        this.icon = icon;
        this.label = label;

        this.eDropdownIcon.style.display = (this.items.length > 0) ? "" : "none";
    }

    get items() { return [...this.#items]; }
    set items(v) {
        v = util.ensure(v, "arr");
        this.clearItems();
        v.forEach(v => this.addItem(v));
    }
    clearItems() {
        let itms = this.items;
        itms.forEach(itm => this.remItem(itm));
        return itms;
    }
    hasItem(itm) {
        if (!(itm instanceof App.ContextMenu.Item)) return false;
        return this.#items.includes(itm);
    }
    addItem(itm) {
        if (!(itm instanceof App.ContextMenu.Item)) return false;
        if (this.hasItem(itm)) return false;
        this.#items.push(itm);
        this.eDropdown.appendChild(itm.elem);
        this.eDropdownIcon.style.display = (this.items.length > 0) ? "" : "none";
        return itm;
    }
    remItem(itm) {
        if (!(itm instanceof App.ContextMenu.Item)) return false;
        if (!this.hasItem(itm)) return false;
        this.#items.splice(this.#items.indexOf(itm), 1);
        this.eDropdown.removeChild(itm.elem);
        this.eDropdownIcon.style.display = (this.items.length > 0) ? "" : "none";
        return itm;
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eLabel() { return this.#eLabel; }
    get eShortcut() { return this.#eShortcut; }
    get eDropdownIcon() { return this.#eDropdownIcon; }
    get eDropdown() { return this.#eDropdown; }

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

    get label() { return this.eLabel.textContent; }
    set label(v) { this.eLabel.textContent = v; }

    get shortcut() { return this.eShortcut.textContent; }
    set shortcut(v) {
        this.eShortcut.textContent = v;
        this.eShortcut.style.display = (this.eShortcut.textContent.length > 0) ? "" : "none";
    }
    get shortcut() { return this.eShortcut.textContent; }
    set shortcut(v) {
        this.eShortcut.textContent = v;
        this.eShortcut.style.display = (this.eShortcut.textContent.length > 0) ? "" : "none";
    }

    get disabled() { return this.elem.classList.contains("disabled"); }
    set disabled(v) {
        if (v) this.elem.classList.add("disabled");
        else this.elem.classList.remove("disabled");
    }

    fix() {
        let r = this.eDropdown.getBoundingClientRect();
        let ox = 0, oy = 0;
        if (r.right > window.innerWidth) ox = window.innerWidth-r.right;
        if (r.left < 0) ox = 0-r.left;
        if (r.bottom > window.innerHeight) oy = window.innerHeight-r.bottom;
        if (r.top < 0) oy = 0-r.top;
        this.eDropdown.style.transform = "translate("+ox+"px, "+oy+"px)";
    }
};
App.ContextMenu.Divider = class AppContextMenuDivider extends App.ContextMenu.Item {
    constructor() {
        super();

        this.elem.classList.add("divider");
    }
};
App.Page = class AppPage extends util.Target {
    #name;
    #app;
    #elem;

    constructor(name, app) {
        super();

        this.#name = String(name);

        if (!(app instanceof App)) throw "App is not of class App";
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
    get lazyState() { return {}; }
    async loadLazyState(state) {}

    async enter(data) {}
    async leave(data) {}
    async determineSame(data) { return false; }

    update(delta) { this.post("update", delta); }
};
export class Project extends util.Target {
    #id;

    #configChange;
    #metaChange;

    #config;
    #meta;

    constructor(...a) {
        super();

        this.#id = null;

        this.#configChange = (c, f, t) => this.change("config."+c, f, t);
        this.#metaChange = (c, f, t) => this.change("meta."+c, f, t);

        this.#config = new this.constructor.Config();
        this.#meta = new this.constructor.Meta();

        if (a.length <= 0 || a.length > 2) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project) a = [a.config, a.meta];
            else if (util.is(a, "arr")) {
                a = new Project(...a);
                a = [a.config, a.meta];
            }
            else if (a instanceof this.constructor.Config) a = [a, null];
            else if (a instanceof this.constructor.Meta) a = [null, a];
            else if (util.is(a, "str")) a = [null, a];
            else if (util.is(a, "obj")) a = [a.config, a.meta];
            else a = [null, null];
        }

        [this.config, this.meta] = a;
    }

    get id() { return this.#id; }
    set id(v) { this.#id = (v == null) ? null : String(v); }

    get config() { return this.#config; }
    set config(v) {
        v = new this.constructor.Config(v);
        if (this.config == v) return;
        if (this.config instanceof this.constructor.Config)
            this.config.remHandler("change", this.#configChange);
        this.change("config", this.config, this.#config=v);
        if (this.config instanceof this.constructor.Config)
            this.config.addHandler("change", this.#configChange);
    }

    get meta() { return this.#meta; }
    set meta(v) {
        v = new this.constructor.Meta(v);
        if (this.meta == v) return;
        if (this.meta instanceof this.constructor.Meta)
            this.meta.remHandler("change", this.#metaChange);
        this.change("meta", this.meta, this.#meta=v);
        if (this.meta instanceof this.constructor.Meta)
            this.meta.addHandler("change", this.#metaChange);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
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

            this.#eTitleBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eTitleBtn);
            this.eTitleBtn.id = "titlebtn";
            this.eTitleBtn.classList.add("logo");
            this.eTitleBtn.classList.add("override");
            this.eTitleBtn.innerHTML = "<div class='title introtitle noanimation'></div>";
            this.eTitleBtn.addEventListener("click", e => {
                this.page = "TITLE";
            });

            this.#eFileBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eFileBtn);
            this.eFileBtn.classList.add("nav");
            this.eFileBtn.classList.add("forproject");
            this.eFileBtn.textContent = "File";
            this.eFileBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("file", e);
            });

            this.#eEditBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eEditBtn);
            this.eEditBtn.classList.add("nav");
            this.eEditBtn.classList.add("forproject");
            this.eEditBtn.textContent = "Edit";
            this.eEditBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("edit", e);
            });

            this.#eViewBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eViewBtn);
            this.eViewBtn.classList.add("nav");
            this.eViewBtn.classList.add("forproject");
            this.eViewBtn.textContent = "View";
            this.eViewBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("view", e);
            });

            this.#eProjectInfo = document.createElement("div");
            this.eTitleBar.appendChild(this.eProjectInfo);
            this.eProjectInfo.id = "projectinfo";
            this.eProjectInfo.classList.add("forproject");

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
            this.eProjectInfoSaveBtn.addEventListener("click", e => this.post("cmd-save"));

            this.#eProjectInfoCopyBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoCopyBtn);
            this.eProjectInfoCopyBtn.textContent = "Copy";
            this.eProjectInfoCopyBtn.addEventListener("click", e => this.post("cmd-savecopy"));

            this.#eProjectInfoDeleteBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoDeleteBtn);
            this.eProjectInfoDeleteBtn.classList.add("off");
            this.eProjectInfoDeleteBtn.textContent = "Delete";
            this.eProjectInfoDeleteBtn.addEventListener("click", e => this.post("cmd-delete"));

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

            this.#eProjectsBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eProjectsBtn);
            this.eProjectsBtn.classList.add("nav");
            this.eProjectsBtn.innerHTML = "<ion-icon name='folder'></ion-icon>";
            this.eProjectsBtn.addEventListener("click", e => {
                this.page = "PROJECTS";
            });

            this.#eCreateBtn = document.createElement("button");
            this.eTitleBar.appendChild(this.eCreateBtn);
            this.eCreateBtn.classList.add("nav");
            this.eCreateBtn.innerHTML = "<ion-icon name='add'></ion-icon>";
            this.eCreateBtn.addEventListener("click", e => {
                this.page = "PROJECT";
            });
            
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");

            let saving = false;
            this.addHandler("sync-files-with", () => {
                saving = true;
            });
            this.addHandler("synced-files-with", () => {
                saving = false;
            });
            this.addHandler("update", delta => {
                this.eSaveBtn.textContent = saving ? "Saving" : (this.changes.length > 0) ? "Save" : "Saved";
            });

            this.clearChanges();

            this.addHandler("cmd-newproject", async () => {
                this.page = "PROJECT";
            });
            this.addHandler("cmd-save", async () => {
                await this.syncFilesWithClean();
            });
            this.addHandler("cmd-savecopy", async source => {
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                let results = await this.post("cmd-savecopy-block");
                let anyBlock = false;
                results.forEach(result => result ? null : (anyBlock = true));
                if (anyBlock) return;
                if (!((source instanceof Project) && (source instanceof this.constructor.PROJECTCLASS))) source = page.project;
                if (!((source instanceof Project) && (source instanceof this.constructor.PROJECTCLASS))) return;
                let project = new this.constructor.PROJECTCLASS(source);
                if (!(project instanceof Project)) return;
                project.meta.name += " copy";
                await this.setPage("PROJECT", { project: project });
                await this.post("cmd-save");
            });
            this.addHandler("cmd-delete", async ids => {
                ids = util.ensure(ids, "arr").map(id => String(id));
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                let results = await this.post("cmd-delete-block");
                let anyBlock = false;
                results.forEach(result => result ? null : (anyBlock = true));
                if (anyBlock) return;
                ids = ids.filter(id => this.hasProject(id));
                if (ids.length <= 0) ids.push(page.projectId);
                ids = ids.filter(id => this.hasProject(id));
                if (ids.length <= 0) return;
                let pop = this.confirm();
                pop.eContent.innerText = "Are you sure you want to delete these projects?\nThis action is not reversible!";
                pop.hasInfo = true;
                pop.info = ids.map(id => this.getProject(id).meta.name).join("\n");
                let result = await pop.whenResult();
                if (!result) return;
                ids.forEach(id => this.remProject(id));
                await this.post("cmd-save");
                this.page = "PROJECTS";
            });
            this.addHandler("cmd-close", () => {
                if (this.page != "PROJECT") return;
                this.page = "PROJECTS";
            });

            await this.syncWithFilesClean();
        });
        this.addHandler("post-setup", async () => {
            await this.post("pre-post-setup");

            this.addPage(new this.constructor.TitlePage(this));
            this.addPage(new this.constructor.ProjectsPage(this));
            this.addPage(new this.constructor.ProjectPage(this));

            this.page = "TITLE";
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
    async syncWithFiles() {
        await this.post("sync-with-files");
        let projectIdsContent = await window.api.send("projects-get");
        let projectIds = JSON.parse(projectIdsContent);
        projectIds = util.ensure(projectIds, "arr").map(id => String(id));
        let projects = {};
        await Promise.all(projectIds.map(async id => {
            let projectContent = await window.api.send("project-get", id);
            let project = JSON.parse(projectContent, this.constructor.REVIVER.f);
            projects[id] = project;
        }));
        this.projects = projects;
        this.clearChanges();
        await this.post("synced-with-files");
    }
    async syncWithFilesClean() {
        try {
            await this.syncWithFiles();
        } catch (e) {
            this.error("There was an error loading your projects!", e);
            return false;
        }
        return true;
    }
    async syncFilesWith() {
        await this.post("sync-files-with");
        let changes = new Set(this.changes);
        this.clearChanges();
        if (changes.has("*") || changes.has("projects")) {
            let projectIds = this.projects;
            let projectIdsContent = JSON.stringify(projectIds);
            await window.api.send("projects-set", projectIdsContent);
        }
        if (changes.has("*")) {
            let projectIds = this.projects;
            await Promise.all(projectIds.map(async id => {
                let project = this.getProject(id);
                let projectContent = JSON.stringify(project);
                await window.api.send("project-set", id, projectContent);
            }));
            await Promise.all(util.ensure(await window.api.send("projects-list"), "arr").map(async dirent => {
                if (dirent.type != "file") return;
                let id = dirent.name.split(".")[0];
                if (this.hasProject(id)) return;
                await window.api.send("project-del", id);
            }));
        } else {
            let projectIds = this.projects;
            await Promise.all(projectIds.map(async id => {
                if (!changes.has(":"+id)) return;
                let project = this.getProject(id);
                project.meta.modified = util.getTime();
                let projectContent = JSON.stringify(project);
                await window.api.send("project-set", id, projectContent);
            }));
            await Promise.all([...changes].map(async change => {
                if (!change.startsWith(":")) return;
                let id = change.substring(1);
                if (this.hasProject(id)) return;
                await window.api.send("project-del", id);
            }));
        }
        await this.post("synced-files-with");
    }
    async syncFilesWithClean() {
        try {
            await this.syncFilesWith();
        } catch (e) {
            this.error("There was an error saving your projects!", e);
            return false;
        }
        return true;
    }
    get projects() { return Object.keys(this.#projects); }
    set projects(v) {
        v = util.ensure(v, "obj");
        this.clearProjects();
        for (let id in v) this.addProject(id, v[id]);
    }
    clearProjects() {
        let projs = this.projects;
        projs.forEach(id => this.remProject(id));
        return projs;
    }
    hasProject(id) {
        id = String(id);
        return id in this.#projects;
    }
    getProject(id) {
        id = String(id);
        if (!this.hasProject(id)) return null;
        return this.#projects[id];
    }
    addProject(id, proj) {
        id = String(id);
        if (!((proj instanceof Project) && (proj instanceof this.constructor.PROJECTCLASS))) return false;
        if (this.hasProject(proj.id)) return false;
        if (this.hasProject(id)) return false;
        this.#projects[id] = proj;
        proj.id = id;
        proj._onChange = c => {
            this.markChange(":"+proj.id);
        };
        proj.addHandler("change", proj._onChange);
        this.markChange("projects");
        this.markChange(":"+id);
        return proj;
    }
    remProject(id) {
        id = String(id);
        if (!this.hasProject(id)) return false;
        let proj = this.getProject(id);
        delete this.#projects[id];
        proj.remHandler("change", proj._onChange);
        delete proj._onChange;
        proj.id = null;
        this.markChange("projects");
        this.markChange(":"+id);
        return proj;
    }

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
            this.app.page = "PROJECT";
        });
        this.#eProjectsBtn = document.createElement("button");
        this.eNav.appendChild(this.eProjectsBtn);
        this.eProjectsBtn.innerHTML = "Projects<ion-icon name='chevron-forward'></ion-icon>";
        this.eProjectsBtn.addEventListener("click", e => {
            this.app.page = "PROJECTS";
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

    async enter(data) {
        this.app.title = "";
    }
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

        this.addHandler("update", delta => this.buttons.forEach(btn => btn.update(delta)));

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
        this.eCreateBtn.innerHTML = "Create<ion-icon name='add'></ion-icon>";
        this.eCreateBtn.addEventListener("click", e => {
            this.app.page = "PROJECT";
        });
        this.#eInfo = document.createElement("div");
        this.eNav.appendChild(this.eInfo);
        this.eInfo.classList.add("info");
        this.#eInfoDisplayBtn = document.createElement("button");
        this.eInfo.appendChild(this.eInfoDisplayBtn);
        this.eInfoDisplayBtn.innerHTML = "<ion-icon></ion-icon>";
        this.eInfoDisplayBtn.addEventListener("click", e => {
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
            if (this.eSearchInput instanceof HTMLInputElement)
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
        this.app.addHandler("synced-files-with", () => this.refresh());
        this.app.addHandler("synced-with-files", () => this.refresh());

        this.eContent.addEventListener("click", e => {
            selected.clear();
            lastSelected = null;
            lastAction = null;
        });
        const contextMenu = e => {
            let ids = [...selected];
            let itm;
            let menu = new App.ContextMenu();
            itm = menu.addItem(new App.ContextMenu.Item("Create"));
            itm.addHandler("trigger", e => {
                this.app.post("cmd-newproject");
            });
            menu.addItem(new App.ContextMenu.Divider());
            itm = menu.addItem(new App.ContextMenu.Item("Open"));
            itm.disabled = ids.length != 1;
            itm.addHandler("trigger", e => {
                this.app.setPage("PROJECT", { id: ids[0] });
            });
            itm = menu.addItem(new App.ContextMenu.Item("Rename"));
            itm.disabled = ids.length != 1;
            itm.addHandler("trigger", async e => {
                let project = this.app.getProject(ids[0]);
                if (!(project instanceof this.app.constructor.PROJECTCLASS)) return;
                let pop = this.app.prompt("Rename", project.meta.name);
                let result = await pop.whenResult();
                if (result == null) return;
                project.meta.name = result;
                await this.app.syncFilesWithClean();
            });
            menu.addItem(new App.ContextMenu.Divider());
            itm = menu.addItem(new App.ContextMenu.Item("Delete"));
            itm.disabled = ids.length <= 0;
            itm.addHandler("trigger", e => {
                this.app.post("cmd-delete", ids);
            });
            itm = menu.addItem(new App.ContextMenu.Item("Duplicate"));
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
        });
        this.addHandler("contextmenu", (e, id) => {
            if (selected.size == 1) this.post("trigger", e, [...selected][0]);
            if (selected.size == 0) this.post("trigger", e, id);
            contextMenu(e);
        });

        this.addHandler("update", delta => {
            let projects = new Set(this.app.projects);
            [...selected].forEach(name => {
                if (projects.has(name)) return;
                selected.delete(name);
            });
            this.buttons.sort((a, b) => b.time-a.time).forEach((btn, i) => {
                btn.elemList.style.order = i;
                btn.elemGrid.style.order = i;
                btn.selected = selected.has(btn.hasProject() ? btn.project.id : null);
                btn.update(delta);
            });
        });
    }

    async refresh() {
        await this.post("refresh");
        this.clearButtons();
        this.eLoading.style.display = "block";
        this.eEmpty.style.display = "none";
        this.eLoading.style.display = "none";
        let projects = this.app.projects.map(id => this.app.getProject(id));
        if (projects.length > 0) {
            projects = util.search(projects, ["meta.name"], this.eSearchInput.value);
            projects.forEach(project => this.addButton(new this.constructor.Button(this, project)));
        } else this.eEmpty.style.display = "block";
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
        if (this.eInfoDisplayBtn.children[0] instanceof HTMLElement)
            this.eInfoDisplayBtn.children[0].setAttribute("name", (v == "list") ? "grid" : (v == "grid") ? "list" : null);
    }

    get buttons() { return [...this.#buttons]; }
    set buttons(v) {
        v = util.ensure(v, "arr");
        this.clearButtons();
        v.forEach(v => this.addButton(v));
    }
    clearButtons() {
        let btns = this.buttons;
        btns.forEach(btn => this.remButton(btn));
        return btns;
    }
    hasButton(btn) {
        if (!(btn instanceof this.constructor.Button)) return false;
        return this.#buttons.has(btn) && btn.page == this;
    }
    addButton(btn) {
        if (!(btn instanceof this.constructor.Button)) return false;
        if (btn.page != this) return false;
        if (this.hasButton(btn)) return false;
        this.#buttons.add(btn);
        btn._onTrigger = e => this.post("trigger", e, (btn.hasProject() ? btn.project.id : null), !!(util.ensure(e, "obj").shiftKey));
        btn._onContextMenu = e => this.post("contextmenu", e, btn.hasProject() ? btn.project.id : null);
        btn.addHandler("trigger", btn._onTrigger);
        btn.addHandler("contextmenu", btn._onContextMenu);
        this.eContent.appendChild(btn.elemList);
        this.eContent.appendChild(btn.elemGrid);
        return btn;
    }
    remButton(btn) {
        if (!(btn instanceof this.constructor.Button)) return false;
        if (btn.page != this) return false;
        if (!this.hasButton(btn)) return false;
        this.#buttons.delete(btn);
        btn.remHandler("trigger", btn._onTrigger);
        btn.remHandler("contextmenu", btn._onContextMenu);
        delete btn._onTrigger;
        delete btn._onContextMenu;
        this.eContent.removeChild(btn.elemList);
        this.eContent.removeChild(btn.elemGrid);
        return btn;
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
        this.eSearchInput.value = state.query || "";
        await this.refresh();
    }
    get lazyState() {
        return {
            displayMode: this.displayMode,
        };
    }
    async loadLazyState(state) {
        state = util.ensure(state, "obj");
        this.displayMode = state.displayMode;
    }

    async enter(data) {
        this.app.title = "Projects";
        this.app.eProjectsBtn.classList.add("this");
        await this.refresh();
    }
    async leave(data) {
        this.app.eProjectsBtn.classList.remove("this");
    }
};
AppFeature.ProjectsPage.Button = class AppFeatureProjectsPageButton extends util.Target {
    #page;

    #project;

    #time;

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

    constructor(page, project) {
        super();

        if (!(page instanceof AppFeature.ProjectsPage)) throw "Page is not of class ProjectsPage";
        this.#page = page;

        this.#project = null;

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
            e.preventDefault();
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
        const dblClick = () => {
            this.app.setPage("PROJECT", { id: this.project.id });
        };
        this.elemList.addEventListener("dblclick", dblClick);
        this.elemGrid.addEventListener("dblclick", dblClick);

        this.project = project;

        this.addHandler("update", delta => {
            this.eListIcon.setAttribute("name", this.app.constructor.ICON);
            this.eGridIcon.setAttribute("name", this.app.constructor.ICON);
            if (!this.hasProject()) return;
            this.name = this.project.meta.name;
            this.time = this.project.meta.modified;
            this.eGridImage.style.backgroundImage = "url('"+this.project.meta.thumb+"')";
        });
    }

    get page() { return this.#page; }
    get app() { return this.page.app; }

    get project() { return this.#project; }
    set project(v) {
        if (this.project == v) return;
        this.change("project", this.project, this.#project=v);
    }
    hasProject() { return (this.#project instanceof Project) && (this.project instanceof this.app.constructor.PROJECTCLASS); }

    get name() { return this.eListName.textContent; }
    set name(v) { this.eListName.textContent = this.eGridName.textContent = v; }

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

    update(delta) { this.post("update", delta); }
};
AppFeature.ProjectPage = class AppFeatureProjectPage extends App.Page {
    #projectId;

    constructor(app) {
        super("PROJECT", app);

        this.app.addHandler("perm", async () => {
            this.app.markChange("*");
            return await this.app.syncFilesWithClean();
        });

        let lock = false;
        setInterval(async () => {
            if (lock) return;
            lock = true;
            await this.app.post("cmd-save");
            lock = false;
        }, 10000);

        this.#projectId = null;
    }

    async refresh() {
        await this.app.syncWithFilesClean();
        this.app.dragging = false;
        await this.post("refresh");
    }

    get projectId() { return this.#projectId; }
    set projectId(v) {
        v = String(v);
        v = this.app.hasProject(v) ? v : null;
        if (this.projectId == v) return;
        let project = this.project;
        this.#projectId = v;
        this.change("project", project, this.project);
    }
    get project() { return this.app.getProject(this.projectId); }
    set project(v) {
        v = ((v instanceof Project) && (v instanceof this.app.constructor.PROJECTCLASS)) ? v : null;
        if (this.project == v) return;
        if ((v instanceof Project) && (v instanceof this.app.constructor.PROJECTCLASS)) {
            if (!this.app.hasProject(v.id)) {
                let id;
                do {
                    id = new Array(10).fill(null).map(_ => util.BASE64[Math.floor(64*Math.random())]).join("");
                } while (this.app.hasProject(id));
                this.app.addProject(id, v);
            }
            this.projectId = v.id;
        } else this.projectId = null;
    }
    hasProject() { return (this.project instanceof Project) && (this.project instanceof this.app.constructor.PROJECTCLASS); }

    get state() {
        return {
            id: this.projectId,
        };
    }
    async loadState(state) {
        state = util.ensure(state, "obj");
        await this.app.syncWithFilesClean();
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

    #connected;
    #connectedRes;
    #disconnectedRes;
    #socketId;

    #destroyed;
    #destroyedRes;
    #notDestroyedRes;

    constructor(location) {
        super();

        this.#id = new Array(8).fill(null).map(_ => util.BASE64[Math.floor(util.BASE64.length*Math.random())]).join("");

        this.#location = String(location);

        this.#connected = false;
        this.#connectedRes = [];
        this.#disconnectedRes = [];
        this.#socketId = null;

        this.#destroyed = true;
        this.#destroyedRes = [];
        this.#notDestroyedRes = [];

        const confirm = (id, meta) => {
            if (this.id != id) return false;
            meta = util.ensure(meta, "obj");
            if (this.location != meta.location) return false;
            let connected = !!meta.connected;
            if (this.#connected != connected) {
                console.log(this.id+":meta.connected = "+connected);
                this.#connected = connected;
                if (this.connected) {
                    this.#connectedRes.forEach(res => res());
                    this.#connectedRes = [];
                } else {
                    this.#disconnectedRes.forEach(res => res());
                    this.#disconnectedRes = [];
                }
            }
            let socketId = (meta.socketId == null) ? null : String(meta.socketId);
            if (this.#socketId != socketId) {
                console.log(this.id+":meta.socketId = "+socketId);
                this.#socketId = socketId;
            }
            return true;
        };
        window.api.onClientMsg((_, id, name, payload, meta) => {
            if (!confirm(id, meta)) return;
            name = String(name);
            console.log(this.id+":msg", name, payload);
            this.post("msg", name, payload);
            this.post("msg-"+name, payload);
        });
        window.api.onClientStreamStart((_, id, name, pth, fname, payload, meta) => {
            if (!confirm(id, meta)) return;
            name = String(name);
            pth = String(pth);
            fname = String(fname);
            console.log(this.id+":stream-start", name, pth, fname, payload);
            this.post("stream-start", name, pth, fname, payload);
            this.post("stream-start-"+name, pth, fname, payload);
        });
        window.api.onClientStreamStop((_, id, name, pth, fname, payload, meta) => {
            if (!confirm(id, meta)) return;
            name = String(name);
            pth = String(pth);
            fname = String(fname);
            console.log(this.id+":stream-stop", name, pth, fname, payload);
            this.post("stream-stop", name, pth, fname, payload);
            this.post("stream-stop-"+name, pth, fname, payload);
        });

        (async () => {
            await window.api.clientMake(this.id, this.location);
            this.#destroyed = false;
            this.#notDestroyedRes.forEach(res => res());
            this.#notDestroyedRes = [];
        })();
    }

    get id() { return this.#id; }

    get location() { return this.#location; }

    get connected() { return this.#connected; }
    get disconnected() { return !this.connected; }
    get socketId() { return this.#socketId; }

    get destroyed() { return this.#destroyed; }

    async whenDestroyed() {
        if (this.destroyed) return;
        return new Promise((res, rej) => this.#destroyedRes.push(res));
    }
    async whenNotDestroyed() {
        if (!this.destroyed) return;
        return new Promise((res, rej) => this.#notDestroyedRes.push(res));
    }
    async whenConnected() {
        if (this.connected) return;
        return new Promise((res, rej) => this.#connectedRes.push(res));
    }
    async whenDisconnected() {
        if (this.disconnected) return;
        return new Promise((res, rej) => this.#disconnectedRes.push(res));
    }

    async connect() {
        if (this.destroyed) return false;
        if (this.connected) return false;
        await window.api.clientConn(this.id);
        return true;
    }
    async disconnect() {
        if (this.destroyed) return false;
        if (this.disconnected) return false;
        await window.api.clientDisconn(this.id);
        return true;
    }
    async emit(name, payload) {
        if (this.destroyed) return null;
        if (this.disconnected) return null;
        let r = await window.api.clientEmit(this.id, name, payload);
        return r;
    }
    async stream(pth, name, payload) {
        if (this.destroyed) return null;
        if (this.disconnected) return null;
        let r = await window.api.clientStream(this.id, pth, name, payload);
        return r;
    }

    async destroy() {
        if (this.destroyed) return false;
        await window.api.clientDestroy(this.id);
        this.#destroyed = true;
        this.#destroyedRes.forEach(res => res());
        this.#destroyedRes = [];
        return true;
    }
}

export class Odometry2d extends util.Target {
    #canvas;
    #ctx;
    #quality;
    #mouse;

    #renders;

    #image;
    #imageShow;
    #imageScale;

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

        this.#renders = new Set();

        this.#image = new Image();
        this.#imageScale = false;
        this.#imageScale = 1;

        this.#doRender = true;

        this.#padding = 0;

        this.#size = new V();

        this.canvas = canvas;
        this.quality = 3;

        this.padding = 40;

        this.size = 1000;

        this.addHandler("update", delta => {
            if (!this.doRender) return;
            if (!this.hasCanvas()) return;
            const ctx = this.ctx, quality = this.quality, padding = this.padding, scale = this.scale;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.renders.filter(render => render.z == 0).sort((a, b) => a.z2-b.z2).forEach(render => render.render());

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.lineWidth = 2*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--v4");
            ctx.font = (12*quality)+"px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            let y0 = (ctx.canvas.height - this.h*scale*quality)/2;
            let y1 = (ctx.canvas.height + this.h*scale*quality)/2;
            let y2 = (ctx.canvas.height + this.h*scale*quality)/2 + 5*quality;
            let y3 = (ctx.canvas.height + this.h*scale*quality)/2 + 10*quality;
            for (let i = 0; i <= Math.floor(this.w/100); i++) {
                let x = (i*100) / this.w;
                x = ctx.canvas.width/2 + util.lerp(-0.5, +0.5, x)*this.w*scale*quality;
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v4");
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v2");
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, y1);
                ctx.stroke();
                if (i%2 == 1 && i < Math.floor(this.w/100)) continue;
                ctx.fillText(i, x, y3);
            }
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            let x0 = (ctx.canvas.width + this.w*scale*quality)/2;
            let x1 = (ctx.canvas.width - this.w*scale*quality)/2;
            let x2 = (ctx.canvas.width - this.w*scale*quality)/2 - 5*quality;
            let x3 = (ctx.canvas.width - this.w*scale*quality)/2 - 10*quality;
            for (let i = 0; i <= Math.floor(this.h/100); i++) {
                let y = (i*100) / this.h;
                y = ctx.canvas.height/2 - util.lerp(-0.5, +0.5, y)*this.h*scale*quality;
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v4");
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v2");
                ctx.beginPath();
                ctx.moveTo(x0, y);
                ctx.lineTo(x1, y);
                ctx.stroke();
                if (i%2 == 1 && i < Math.floor(this.h/100)) continue;
                ctx.fillText(i, x3, y);
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(
                (ctx.canvas.width - this.w*scale*quality)/2,
                (ctx.canvas.height - this.h*scale*quality)/2,
                ...this.size.mul(scale*quality).xy,
            );
            ctx.clip();

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.renders.filter(render => render.z == 1).sort((a, b) => a.z2-b.z2).forEach(render => render.render());

            try {
                if (this.#imageShow) {
                    ctx.globalAlpha = 0.25;
                    ctx.globalCompositeOperation = "overlay";
                    ctx.drawImage(
                        this.#image,
                        (ctx.canvas.width - this.w*scale*quality)/2,
                        (ctx.canvas.height - this.h*scale*quality)/2,
                        this.#image.width*this.imageScale*scale*quality,
                        this.#image.height*this.imageScale*scale*quality,
                    );
                }
            } catch (e) {}

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.renders.filter(render => render.z == 2).sort((a, b) => a.z2-b.z2).forEach(render => render.render());

            ctx.restore();

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v4");
            ctx.lineWidth = 2*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.strokeRect(
                (ctx.canvas.width - this.w*scale*quality)/2,
                (ctx.canvas.height - this.h*scale*quality)/2,
                ...this.size.mul(scale*quality).xy,
            );

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            this.renders.filter(render => render.z == 3).sort((a, b) => a.z2-b.z2).forEach(render => render.render());
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
    hasCanvas() { return this.canvas instanceof HTMLCanvasElement; }
    get ctx() { return this.#ctx; }
    get quality() { return this.#quality; }
    set quality(v) { this.#quality = Math.max(1, util.ensure(v, "int")); }
    get mouse() { return new V(this.#mouse); }

    get renders() { return [...this.#renders]; }
    set renders(v) {
        v = util.ensure(v, "arr");
        this.clearRenders();
        v.forEach(v => this.addRender(v));
    }
    clearRenders() {
        let renders = this.renders;
        renders.forEach(render => this.remRender(render));
        return renders;
    }
    hasRender(render) {
        if (!(render instanceof Odometry2d.Render)) return false;
        return this.#renders.has(render) && render.odometry == this;
    }
    addRender(render) {
        if (!(render instanceof Odometry2d.Render)) return false;
        if (render.odometry != this) return false;
        if (this.hasRender(render)) return false;
        this.#renders.add(render);
        return render;
    }
    remRender(render) {
        if (!(render instanceof Odometry2d.Render)) return false;
        if (render.odometry != this) return false;
        if (!this.hasRender(render)) return false;
        this.#renders.delete(render);
        return render;
    }

    get imageSrc() { return this.#image.src; }
    set imageSrc(v) {
        if (v == null) return this.#imageShow = false;
        this.#imageShow = true;
        this.#image.src = v;
    }
    get imageScale() { return this.#imageScale; }
    set imageScale(v) { this.#imageScale = Math.max(0, util.ensure(v, "num")); }

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

    get hovered() {
        let hovered = null;
        this.renders.forEach(render => {
            if (hovered != null) return;
            if (render.hovered == null) return;
            hovered = render;
        });
        return hovered;
    }
    get hoveredPart() {
        let hovered = this.hovered;
        if (hovered == null) return;
        return hovered.hovered;
    }

    worldToCanvas(...p) {
        p = new V(...p);
        if (!this.hasCanvas()) return p;
        const scale = this.scale;
        p.x = (p.x - this.w/2) * (scale*this.quality) + this.canvas.width/2;
        p.y = (this.h/2 - p.y) * (scale*this.quality) + this.canvas.height/2;
        return p;
    }
    worldLenToCanvas(l) {
        l = util.ensure(l, "num");
        if (!this.hasCanvas()) return l;
        return l*(this.scale*this.quality);
    }
    canvasToWorld(...p) {
        p = new V(...p);
        if (!this.hasCanvas()) return p;
        const scale = this.scale;
        p.x = (p.x - this.canvas.width/2) / (scale*this.quality) + this.w/2;
        p.y = this.h/2 - (p.y - this.canvas.height/2) / (scale*this.quality);
        return p;
    }
    canvasLenToWorld(l) {
        l = util.ensure(l, "num");
        if (!this.hasCanvas()) return l;
        return l/(this.scale*this.quality);
    }
    canvasToPage(...p) {
        p = new V(...p);
        if (!this.hasCanvas()) return p;
        let r = this.canvas.getBoundingClientRect();
        p.idiv(this.quality);
        p.iadd(r.left, r.top);
        return p;
    }
    canvasLenToPage(l) {
        l = util.ensure(l, "num");
        if (!this.hasCanvas()) return l;
        return l/this.quality;
    }
    pageToCanvas(...p) {
        p = new V(...p);
        if (!this.hasCanvas()) return p;
        let r = this.canvas.getBoundingClientRect();
        p.isub(r.left, r.top);
        p.imul(this.quality);
        return p;
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
    #odometry;
    
    #pos;
    #z; #z2;
    #alpha;

    #canHover;

    constructor(odometry, pos) {
        super(odometry);

        if (!(odometry instanceof Odometry2d)) throw "Odometry is not of class Odometry2d";
        this.#odometry = odometry;

        this.#pos = new V();
        this.#z = this.#z2 = 0;
        this.#alpha = 1;

        this.#canHover = true;

        this.pos = pos;
        this.z = Odometry2d.AFTERIMAGE;
        this.z2 = 0;
    }

    get odometry() { return this.#odometry; }

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

    get canHover() { return this.#canHover; }
    set canHover(v) { this.#canHover = !!v; }
    get hovered() { return null; }

    render() {
        this.odometry.ctx.globalAlpha = this.alpha;
        this.post("render");
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

    static Types = {
        DEFAULT: Symbol("DEFAULT"),
        NODE: Symbol("NODE"),
        BOX: Symbol("BOX"),
        ARROW: Symbol("ARROW"),
    };
    static lookupTypeName(type) {
        for (let name in Odometry2d.Robot.Types)
            if (Odometry2d.Robot.Types[name] == type)
                return name;
        return null;
    }

    constructor(odometry, pos, size, heading, velocity) {
        super(odometry, pos);

        this.#type = null;

        this.#size = new V();
        this.#velocity = new V();
        this.#showVelocity = true;
        this.#heading = 0;

        this.#color = "cb";
        this.#colorH = "cb5";

        this.type = Odometry2d.Robot.Types.DEFAULT;

        this.size = size;
        this.heading = heading;
        this.velocity = velocity;

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            if (![Odometry2d.Robot.Types.NODE, Odometry2d.Robot.Types.ARROW].includes(this.type)) {
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--"+this.color+"-8");
                ctx.lineWidth = 7.5*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "square";
                ctx.beginPath();
                let path = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]].map(v => this.size.sub(this.odometry.pageLenToWorld(7.5)).div(2).mul(v)).map(v => v.rotateOrigin(this.heading));
                for (let i = 0; i <= path.length; i++) {
                    let j = i%path.length;
                    let p = this.odometry.worldToCanvas(this.pos.add(path[j]));
                    if (i > 0) ctx.lineTo(...p.xy);
                    else ctx.moveTo(...p.xy);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v8");
                ctx.lineWidth = 2*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "square";
                ctx.beginPath();
                path = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]].map(v => this.size.div(2).mul(v)).map(v => v.rotateOrigin(this.heading));
                for (let i = 0; i <= path.length; i++) {
                    let j = i%path.length;
                    let p = this.odometry.worldToCanvas(this.pos.add(path[j]));
                    if (i > 0) ctx.lineTo(...p.xy);
                    else ctx.moveTo(...p.xy);
                }
                ctx.closePath();
                ctx.stroke();
            }
            if (this.type == Odometry2d.Robot.Types.ARROW) {
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--"+((this.hovered == "heading") ? this.colorH : this.color));
                ctx.lineWidth = 5*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                let dir = this.heading;
                let tail = this.pos.add(V.dir(dir, -this.w/2));
                let head = this.pos.add(V.dir(dir, +this.w/2));
                ctx.beginPath();
                ctx.moveTo(...this.odometry.worldToCanvas(tail).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir-135, this.odometry.pageLenToWorld(15)))).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head).xy);
                ctx.lineTo(...this.odometry.worldToCanvas(head.add(V.dir(dir+135, this.odometry.pageLenToWorld(15)))).xy);
                ctx.stroke();
            } else {
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--"+((this.hovered == "heading") ? "v8" : "v8-8"));
                ctx.lineWidth = 2*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "square";
                ctx.beginPath();
                ctx.arc(...this.odometry.worldToCanvas(this.pos.add(V.dir(this.heading, this.w/2))).xy, 5*quality, 0, 2*Math.PI);
                ctx.fill();
            }
            if (![Odometry2d.Robot.Types.BOX, Odometry2d.Robot.Types.ARROW].includes(this.type)) {
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--"+((this.hovered == "main") ? this.colorH : this.color));
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v8");
                ctx.lineWidth = 2*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "square";
                ctx.beginPath();
                ctx.arc(...this.odometry.worldToCanvas(this.pos).xy, 7.5*quality, 0, 2*Math.PI);
                ctx.fill();
                if (this.selected) ctx.stroke();
            }
            if (this.showVelocity) {
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--"+((this.hovered == "velocity") ? "v8" : "v8-8"));
                ctx.lineWidth = 2*quality;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                let dir = 180+this.velocity.towards();
                let tail = this.pos;
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
        if (this.showVelocity && this.pos.add(this.velocity).dist(m) < this.odometry.pageLenToWorld(5)) return "velocity";
        if (this.pos.add(V.dir(this.heading, this.w/2)).dist(m) < this.odometry.pageLenToWorld(5)) return "heading";
        if (this.pos.dist(m) < this.odometry.pageLenToWorld(7.5)) return "main";
        return null;
    }

    get type() { return this.#type; }
    set type(v) {
        if (!Object.values(Odometry2d.Robot.Types)) return;
        if (Object.keys(Odometry2d.Robot.Types).includes(v)) v = Odometry2d.Robot.Types[v];
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
    set heading(v) { this.#heading = ((util.ensure(v, "num")%360)+360)%360; }

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
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--"+((this.hovered == "main") ? "cr-8" : "cr-4"));
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v8");
            ctx.lineWidth = 2*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(this.pos).xy, this.odometry.worldLenToCanvas(this.radius), 0, 2*Math.PI);
            ctx.fill();
            if (this.selected) ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(...this.odometry.worldToCanvas(this.pos).xy);
            ctx.lineTo(...this.odometry.worldToCanvas(this.pos.add(V.dir(this.dir, this.radius))).xy);
            ctx.stroke();
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--"+((this.hovered == "radius") ? "a" : "v8"));
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(this.pos.add(V.dir(this.dir, this.radius))).xy, 5*quality, 0, 2*Math.PI);
            ctx.fill();
        });
    }

    get hovered() {
        if (!this.canHover) return null;
        let m = this.odometry.pageToWorld(this.odometry.mouse);
        if (this.pos.add(V.dir(this.dir, this.radius)).dist(m) < this.odometry.pageLenToWorld(5)) return "radius";
        if (this.pos.dist(m) < this.radius) return "main";
        return null;
    }

    get radius() { return this.#radius; }
    set radius(v) { this.#radius = Math.max(0, util.ensure(v, "num")); }

    get dir() { return this.#dir; }
    set dir(v) { this.#dir = ((util.ensure(v, "num")%360)+360)%360; }

    get selected() { return this.#selected; }
    set selected(v) { this.#selected = !!v; }
};
