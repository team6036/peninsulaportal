import * as util from "./util.js";
import { V } from "./util.js";

export const LOGOMESHDATA = (() => {
    let loadState = 0;

    let grid = null;

    return {
        load: async () => {
            if (loadState > 0) return false;
            loadState = 1;
            let img = await util.loadImage("../assets/logo.svg");
            let canv = document.createElement("canvas");
            let ctx = canv.getContext("2d");
            canv.width = img.width;
            canv.height = img.height;
            ctx.drawImage(img, 0, 0);
            let q = 3;
            let w = Math.floor(img.width/q), h = Math.floor(img.height/q);
            grid = [];
            for (let x = 0; x < w; x++) {
                let column = [];
                for (let y = 0; y < h; y++) {
                    let tx = x*q, ty = y*q;
                    let data = ctx.getImageData(tx, ty, 1, 1).data;
                    column.push(data[3] > 128 ? 0 : 1);
                }
                grid.push(column);
            }
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    if (grid[x][y] > 0) continue;
                    let fill = (x, y) => {
                        if (x < 0 || x >= w) return true;
                        if (y < 0 || y >= h) return true;
                        if (grid[x][y] > 0) return grid[x][y] == 1;
                        grid[x][y] = 2;
                        if (fill(x+1, y) || fill(x-1, y) || fill(x, y+1) || fill(x, y-1)) grid[x][y] = 3;
                    };
                    fill(x, y);
                }
            }
            let polys = [];
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    if (grid[x][y] != 3) continue;
                    grid[x][y] = 4+polys.length;
                    let path = [];
                    let head = [x, y];
                    while (true) {
                        let found = null;
                        for (let rx = -1; rx <= 1; rx++) {
                            for (let ry = -1; ry <= 1; ry++) {
                                if (rx == 0 && ry == 0) continue;
                                let tx = head[0]+rx, ty = head[1]+ry;
                                if (tx < 0 || tx >= w) continue;
                                if (ty < 0 || ty >= h) continue;
                                if (grid[tx][ty] == 3) {
                                    found = [tx, ty];
                                    grid[tx][ty] = 4+polys.length;
                                }
                                if (found) break;
                            }
                            if (found) break;
                        }
                        path.push(head);
                        if (found) head = found;
                        else break;
                    }
                    polys.push(path);
                }
            }
            console.log(polys);
            let all = "";
            for (let y = 0; y < h; y++) {
                let row = "";
                for (let x = 0; x < w; x++) {
                    let n = grid[x][y];
                    if (n < 4) row += "?.:#"[grid[x][y]];
                    else row += util.BASE64[(n-4)%64];
                }
                all += row+"\n";
            }
            console.log(all);
            loadState = 2;
            return true;
        },
        getLoadState: () => loadState,
        isLoading: () => (loadState == 1),
        isLoaded: () => (loadState == 2),
    }
})();

export class Target {
    #handlers;

    constructor() {
        this.#handlers = {};
    }

    addHandler(e, f) {
        e = String(e);
        if (!util.is(f, "func")) return false;
        if (!(e in this.#handlers)) this.#handlers[e] = new Set();
        if (this.#handlers[e].has(f)) return false;
        this.#handlers[e].add(f);
        return f;
    }
    remHandler(e, f) {
        e = String(e);
        if (!util.is(f, "func")) return false;
        if (!(e in this.#handlers)) return false;
        if (!this.#handlers[e].has(e)) return false;
        this.#handlers[e].delete(f);
        return f;
    }
    hasHandler(e, f) {
        e = String(e);
        if (!util.is(f, "func")) return false;
        if (!(e in this.#handlers)) return false;
        return this.#handlers[e].has(f);
    }
    async post(e, data) {
        if (!(e in this.#handlers)) return [];
        let fs = [...this.#handlers[e]];
        fs = fs.map(f => (async () => {
            if (f.constructor.name == "AsyncFunction") return await f(data);
            else if (f.constructor.name == "Function") return f(data);
        }));
        return await Promise.all(fs.map(f => f()));
    }
}

export class App extends Target {
    #setupConfig;
    #setupDone;

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

    #eCoreStyle;
    #eStyle;
    #eDynamicStyle;
    #eTitleBar;
    #eLoading;
    #eLoadingTo;

    constructor() {
        super();

        this.#setupConfig = {};
        this.#setupDone = false;

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

        this.addHandler("start", data => {
            let id = setInterval(() => {
                if (document.readyState != "complete") return;
                clearInterval(id);
                (async () => {
                    this.post("start-begin", null);
                    await this.setup();
                    this.post("start-complete", null);
                    const update = () => {
                        this.post("update", null);
                        window.requestAnimationFrame(update);
                    };
                    update();
                })();
            }, 10);
        });
    }

    get setupConfig() { return this.#setupConfig; }
    get setupDone() { return this.#setupDone; }

    start() { this.post("start", null); }

    async getAbout() {
        let os = await window.version.os();
        return {
            node: window.version.node(),
            chrome: window.version.chrome(),
            electron: window.version.electron(),
            os: os,
        };
    }

    async setup() {
        if (this.setupDone) return false;

        this.#setupDone = true;

        const root = ("root" in this.setupConfig) ? this.setupConfig.root : "..";

        window.api.onPerm(() => {
            (async () => {
                let perm = await this.getPerm();
                window.api.sendPerm(perm);
            })();
        });
        window.api.on((_, cmd, args) => {
            cmd = String(cmd);
            args = util.ensure(args, "arr");
            this.post("cmd", { cmd: cmd, args: args });
            this.post("cmd-"+cmd, args);
        });
        this.addHandler("cmd-about", async args => {
            let name = String(await window.api.getFeature());
            let about = await this.getAbout();
            let pop = this.alert();
            pop.iconSrc = root+"/assets/icon.svg";
            pop.iconColor = "var(--a)";
            pop.content = "Peninsula "+name[0].toUpperCase()+name.slice(1).toLowerCase();
            let lines = new Array(4).fill("");
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
            pop.info = lines.join("\n");
            pop.hasInfo = true;
        });
        const onFullScreenState = is => {
            document.documentElement.style.setProperty("--fs", (is ? 1 : 0));
            document.documentElement.style.setProperty("--LEFT", (is ? 0 : 80)+"px");
        };
        this.addHandler("cmd-set-fullscreen", async args => {
            args = util.ensure(args, "arr");
            onFullScreenState(!!args[0]);
        });
        const onDevModeState = is => {
            if (is) {
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
        };
        this.addHandler("cmd-devmode", async args => {
            args = util.ensure(args, "arr");
            onDevModeState(!!args[0]);
        });

        const coreStyle = this.#eCoreStyle = document.createElement("link");
        document.head.appendChild(coreStyle);
        coreStyle.rel = "stylesheet";
        coreStyle.href = root+"/style.css";

        const theStyle = this.#eStyle = document.createElement("link");
        document.head.appendChild(theStyle);
        theStyle.rel = "stylesheet";
        theStyle.href = "./style.css";

        const dynamicStyle = this.#eDynamicStyle = document.createElement("style");
        document.head.appendChild(dynamicStyle);

        if (document.getElementById("titlebar") instanceof HTMLDivElement) this.#eTitleBar = document.getElementById("titlebar");
        else this.#eTitleBar = document.createElement("div");
        const titleBar = this.#eTitleBar;
        document.body.appendChild(titleBar);
        titleBar.id = "titlebar";

        this.#eLoading = document.getElementById("loading");
        if (this.hasELoading()) this.eLoading.classList.add("this");
        setTimeout(() => {
            titleBar.style.opacity = "";
            let mount = document.getElementById("mount");
            if (!(mount instanceof HTMLDivElement)) return;
            mount.style.opacity = "";
        }, 0.5*1000);
        titleBar.style.opacity = "0%";
        let mount = document.getElementById("mount");
        if (mount instanceof HTMLDivElement) mount.style.opacity = "0%";

        this.#eDrag = document.getElementById("drag");

        const ionicons1 = document.createElement("script");
        document.body.appendChild(ionicons1);
        ionicons1.type = "module";
        ionicons1.src = root+"/node_modules/ionicons/dist/ionicons/ionicons.esm.js";
        const ionicons2 = document.createElement("script");
        document.body.appendChild(ionicons2);
        ionicons2.noModule = true;
        ionicons2.src = root+"/node_modules/ionicons/dist/ionicons/ionicons.js";

        const updatePage = () => {
            Array.from(document.querySelectorAll(".loading")).forEach(elem => {
                if (elem.innerHTML.length > 0) return;
                elem.innerHTML = "<div>"+new Array(4).fill("<div></div>").join("")+"</div>";
            });
            Array.from(document.querySelectorAll("label.filedialog")).forEach(elem => {
                if (elem.innerHTML.length > 0) return;
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
        };
        setInterval(updatePage, 500);
        updatePage();

        if (this.hasELoadingTo())
            this.eLoadingTo.style.visibility = "hidden";
        
        let t = util.getTime();
        
        onFullScreenState(await window.api.getFullScreen());
        onDevModeState(await window.api.getDevMode());

        let resp = null;
        try {
            resp = await fetch(root+"/theme.json");
            if (resp.status != 200) throw resp.status;
        } catch (e) { resp = null; }
        let data = null;
        if (resp instanceof Response) {
            try {
                data = await resp.json();
            } catch (e) {}
        }
        data = util.ensure(data, "obj");
        this.base = data.base;
        this.colors = data.colors;
        this.accent = data.accent;

        let spooky = await window.api.getSpooky();
        if (spooky) this.accent = "o";

        await this.post("setup", null);

        setTimeout(() => {
            if (this.hasELoading()) {
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
            }
        }, Math.max(0, 1250 - (util.getTime()-t)));

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
    updateDynamicStyle() {
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
        colors._ = new util.Color(this.hasColor(this.accent) ? this.getColor(this.accent) : this.getBase(4));
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
        let styleStr = "";
        for (let k in style) styleStr += "--"+k+":"+style[k]+";";
        this.eDynamicStyle.innerHTML = ":root{"+styleStr+"}";
    }

    async getPerm() {
        let perms = await this.post("perm", null);
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
        return pop;
    }
    remPopup(pop) {
        if (!(pop instanceof App.PopupBase)) return false;
        if (!this.hasPopup(pop)) return false;
        this.#popups.splice(this.#popups.indexOf(pop), 1);
        pop.remHandler("close", pop._onClose);
        delete pop._onClose;
        document.body.removeChild(pop.elem);
        return pop;
    }
    alert(...a) { return this.addPopup(new App.Alert(...a)); }
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
            this.#dragState = new Target();
            const mouseup = e => {
                this.post("drag-submit", e);
                this.dragState.post("submit", e);
                this.post("drag-stop", null);
                this.dragState.post("stop", null);
            };
            const mousemove = e => {
                if (this.hasEDrag()) {
                    this.eDrag.style.left = e.pageX+"px";
                    this.eDrag.style.top = e.pageY+"px";
                }
                this.post("drag-move", e);
                this.dragState.post("move", e);
            };
            this.dragState.addHandler("stop", data => {
                this.dragState._already = true;
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                this.dragging = false;
            });
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
            this.post("drag-start", null);
        } else {
            if (!this.dragState._already) {
                this.post("drag-cancel", null);
                this.dragState.post("cancel", null);
                this.post("drag-stop", null);
                this.dragState.post("stop", null);
            }
            this.#dragState = null;
            this.dragData = null;
        }
        if (this.hasEDrag()) this.eDrag.style.visibility = this.dragging ? "inherit" : "hidden";
    }
    submitDrag() {
        if (!this.dragging) return false;
        if (this.dragState._already) return false;
        this.post("drag-submit", e);
        this.dragState.post("submit", e);
        this.post("drag-stop", null);
        this.dragState.post("stop", null);
        return true;
    }
    get dragState() { return this.#dragState; }
    get dragData() { return this.#dragData; }
    set dragData(v) {
        if (this.dragging) return;
        this.#dragData = v;
    }
    get eDrag() { return this.#eDrag; }
    hasEDrag() { return this.eDrag instanceof HTMLDivElement; }

    get pages() { return Object.keys(this.#pages); }
    hasPage(name) {
        name = String(name);
        return name in this.#pages;
    }
    addPage(page) {
        if (!(page instanceof App.Page)) return false;
        if (this.hasPage(page.name)) return false;
        this.#pages[page.name] = page;
        document.getElementById("mount").appendChild(page.elem);
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

        let projectOnly = [
            "addnode", "addobstacle", "addpath",
            "savecopy",
            "delete", "close",
            "maxmin", "resetdivider",
        ];
        let changes = {};
        projectOnly.forEach(id => {
            changes[id] = { ".enabled": this.page == "PROJECT" };
        });
        await window.api.menuChange(changes);

        if (this.hasPage(this.page)) await this.getPage(this.page).enter(data);

        this.pages.forEach(name => this.getPage(name).elem.classList[(name == this.page ? "add" : "remove")]("this"));
    }

    addBackButton() {
        if (!(this.eTitleBar instanceof HTMLDivElement)) return false;
        let btn = document.createElement("button");
        this.eTitleBar.appendChild(btn);
        btn.classList.add("icon");
        btn.style.setProperty("--bg", "transparent");
        btn.style.setProperty("--bgh", "var(--v2)");
        btn.style.setProperty("--bgd", "transparent");
        btn.innerHTML = "<ion-icon name='chevron-back'></ion-icon>";
        btn.addEventListener("click", e => {
            window.api.ask("back");
        });
        return btn;
    }

    get eCoreStyle() { return this.#eCoreStyle; }
    get eStyle() { return this.#eStyle; }
    get eDynamicStyle() { return this.#eDynamicStyle; }
    get eTitleBar() { return this.#eTitleBar; }
    get eLoading() { return this.#eLoading; }
    hasELoading() { return this.eLoading instanceof HTMLDivElement; }
    get eLoadingTo() { return this.#eLoadingTo; }
    set eLoadingTo(v) {
        v = (v instanceof HTMLElement) ? v : null;
        if (this.eLoadingTo == v) return;
        this.#eLoadingTo = v;
    }
    hasELoadingTo() { return this.eLoadingTo instanceof HTMLElement; }

    get loading() {
        if (!this.eTitleBar.classList.contains("loading")) return null;
        let loading = this.eTitleBar.style.getPropertyValue("--loading");
        loading = loading.substring(0, loading.length-1);
        return Math.min(1, Math.max(0, util.ensure(parseFloat(loading), "num")/100));
    }
    set loading(v) {
        v = (v == null) ? null : Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (v == null) return this.eTitleBar.classList.remove("loading");
        this.eTitleBar.classList.add("loading");
        this.eTitleBar.style.setProperty("--loading", (v*100)+"%");
    }
}
App.PopupBase = class AppPopupBase extends Target {
    #elem;
    #inner;

    constructor() {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("popup");
        this.#inner = document.createElement("div");
        this.elem.appendChild(this.inner);
        this.inner.classList.add("inner");
    }

    get elem() { return this.#elem; }
    get inner() { return this.#inner; }

    close() {
        this.post("close", null);
    }
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
App.Alert = class AppAlert extends App.PopupBase {
    #eIcon;
    #eContent;
    #eInfo;
    #eButton;

    constructor(content, icon="alert-circle", button="OK", info=null) {
        super();

        this.elem.classList.add("alert");

        this.#eIcon = document.createElement("div");
        this.inner.appendChild(this.eIcon);
        this.eIcon.classList.add("icon");
        this.eIcon.innerHTML = "<ion-icon></ion-icon>";
        this.#eContent = document.createElement("div");
        this.inner.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eInfo = document.createElement("pre");
        this.eInfo.classList.add("info");
        this.#eButton = document.createElement("button");
        this.inner.appendChild(this.eButton);
        this.eButton.classList.add("special");

        this.eButton.addEventListener("click", e => this.close());

        this.content = content;
        this.icon = icon;
        this.button = button;
        this.hasInfo = (info != null);
        this.info = info;

        this.iconColor = "var(--v5)";
    }

    get eIcon() { return this.#eIcon; }
    get eContent() { return this.#eContent; }
    get eInfo() { return this.#eInfo; }
    get eButton() { return this.#eButton; }

    get icon() { return this.eIcon.children[0].getAttribute("name"); }
    set icon(v) {
        this.eIcon.children[0].removeAttribute("src");
        this.eIcon.children[0].setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.children[0].getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.children[0].removeAttribute("name");
        this.eIcon.children[0].setAttribute("src", v);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }
    
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

    get button() { return this.eButton.textContent; }
    set button(v) { this.eButton.textContent = v; }
};
App.Confirm = class AppConfirm extends App.PopupBase {
    #eIcon;
    #eContent;
    #eConfirm;
    #eCancel;

    constructor(content, icon="help-circle", confirm="OK", cancel="Cancel") {
        super();

        this.elem.classList.add("confirm");

        this.#eIcon = document.createElement("div");
        this.inner.appendChild(this.eIcon);
        this.eIcon.classList.add("icon");
        this.eIcon.innerHTML = "<ion-icon></ion-icon>";
        this.#eContent = document.createElement("div");
        this.inner.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eConfirm = document.createElement("button");
        this.inner.appendChild(this.eConfirm);
        this.eConfirm.classList.add("special");
        this.#eCancel = document.createElement("button");
        this.inner.appendChild(this.eCancel);

        this.eConfirm.addEventListener("click", e => {
            (async () => {
                await this.post("result", { v: true });
                this.close();
            })();
        });
        this.eCancel.addEventListener("click", e => {
            (async () => {
                await this.post("result", { v: false });
                this.close();
            })();
        });

        this.content = content;
        this.icon = icon;
        this.confirm = confirm;
        this.cancel = cancel;

        this.iconColor = "var(--v5)";
    }

    get eIcon() { return this.#eIcon; }
    get eContent() { return this.#eContent; }
    get eCancel() { return this.#eCancel; }
    get eConfirm() { return this.#eConfirm; }

    get icon() { return this.eIcon.children[0].getAttribute("name"); }
    set icon(v) {
        this.eIcon.children[0].removeAttribute("src");
        this.eIcon.children[0].setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.children[0].getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.children[0].removeAttribute("name");
        this.eIcon.children[0].setAttribute("src", v);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }

    get content() { return this.eContent.textContent; }
    set content(v) { this.eContent.textContent = v; }

    get confirm() { return this.eConfirm.textContent; }
    set confirm(v) { this.eConfirm.textContent = v; }
    get cancel() { return this.eCancel.textContent; }
    set cancel(v) { this.eCancel.textContent = v; }
};
App.Prompt = class AppPrompt extends App.PopupBase {
    #eIcon;
    #eContent;
    #eInput;
    #eConfirm;
    #eCancel;

    constructor(content, icon="pencil", confirm="OK", cancel="Cancel", placeholder="...") {
        super();

        this.elem.classList.add("prompt");

        this.#eIcon = document.createElement("div");
        this.inner.appendChild(this.eIcon);
        this.eIcon.classList.add("icon");
        this.eIcon.innerHTML = "<ion-icon></ion-icon>";
        this.#eContent = document.createElement("div");
        this.inner.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eInput = document.createElement("input");
        this.inner.appendChild(this.eInput);
        this.eInput.autocomplete = "off";
        this.eInput.spellcheck = false;
        this.#eConfirm = document.createElement("button");
        this.inner.appendChild(this.eConfirm); 
        this.eConfirm.classList.add("special");
        this.#eCancel = document.createElement("button");
        this.inner.appendChild(this.eCancel);

        this.eConfirm.addEventListener("click", e => {
            (async () => {
                await this.post("result", { v: this.eInput.value });
                this.close();
            })();
        });
        this.eCancel.addEventListener("click", e => {
            (async () => {
                await this.post("result", { v: null });
                this.close();
            })();
        });

        this.content = content;
        this.icon = icon;
        this.confirm = confirm;
        this.cancel = cancel;
        this.placeholder = placeholder;

        this.iconColor = "var(--v5)";
    }

    get eIcon() { return this.#eIcon; }
    get eContent() { return this.#eContent; }
    get eInput() { return this.#eInput; }
    get eCancel() { return this.#eCancel; }
    get eConfirm() { return this.#eConfirm; }

    get icon() { return this.eIcon.children[0].getAttribute("name"); }
    set icon(v) {
        this.eIcon.children[0].removeAttribute("src");
        this.eIcon.children[0].setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.children[0].getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.children[0].removeAttribute("name");
        this.eIcon.children[0].setAttribute("src", v);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }

    get content() { return this.eContent.textContent; }
    set content(v) { this.eContent.textContent = v; }

    get confirm() { return this.eConfirm.textContent; }
    set confirm(v) { this.eConfirm.textContent = v; }
    get cancel() { return this.eCancel.textContent; }
    set cancel(v) { this.eCancel.textContent = v; }

    get placeholder() { return this.eInput.placeholder; }
    set placeholder(v) { this.eInput.placeholder = v; }
};

App.ContextMenu = class AppContextMenu extends Target {
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
App.ContextMenu.Item = class AppContextMenuItem extends Target {
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
        this.elem.addEventListener("click", e => this.post("trigger", null));

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
// App.Page = class AppPage extends core.Target {
App.Page = class AppPage extends Target {
    #name;
    #app;
    #elem;

    constructor(name, app) {
        super();

        this.#name = String(name);
        this.#app = (app instanceof App) ? app : null;
        this.#elem = document.createElement("div");
        this.elem.id = this.name+"PAGE";
        this.elem.classList.add("page");
    }

    get name() { return this.#name; }
    get app() { return this.#app; }
    hasApp() { return this.app instanceof App; }
    get elem() { return this.#elem; }

    async enter(data) {}
    async leave(data) {}
    async determineSame(data) { return false; }

    update() { this.post("update", null); }
};

export class Odometry2d extends Target {
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

        this.addHandler("update", data => {
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
        this.update();
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
        if (render.odometry != null) return false;
        if (this.hasRender(render)) return false;
        this.#renders.add(render);
        render.odometry = this;
        return render;
    }
    remRender(render) {
        if (!(render instanceof Odometry2d.Render)) return false;
        if (render.odometry != this) return false;
        if (!this.hasRender(render)) return false;
        this.#renders.delete(render);
        render.odometry = null;
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
        p.idiv(this.size);
        p.y = 1-p.y;
        p.isub(0.5);
        p.imul(this.size.mul(this.scale*this.quality));
        p.iadd(new V(this.canvas.width, this.canvas.height).div(2));
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
        p.isub(new V(this.canvas.width, this.canvas.height).div(2));
        p.idiv(this.size.mul(this.scale*this.quality));
        p.iadd(0.5);
        p.y = 1-p.y;
        p.imul(this.size);
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

    update() { this.post("update"); }
}
Odometry2d.Render = class Odometry2dRender extends Target {
    #odometry;
    
    #pos;
    #z; #z2;
    #alpha;

    #canHover;

    constructor(pos) {
        super();

        this.#odometry = null;

        this.#pos = new V();
        this.#z = this.#z2 = 0;
        this.#alpha = 1;

        this.#canHover = true;

        this.pos = pos;
        this.z = Odometry2d.AFTERIMAGE;
        this.z2 = 0;
    }

    get odometry() { return this.#odometry; }
    set odometry(v) {
        v = (v instanceof Odometry2d) ? v : null;
        if (this.odometry == v) return;
        this.#odometry = v;
    }
    hasOdometry() { return this.odometry instanceof Odometry2d; }

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
        if (!this.hasOdometry()) return;
        this.odometry.ctx.globalAlpha = this.alpha;
        this.post("render", null);
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
    };

    constructor(pos, size, heading, velocity) {
        super(pos);

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
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--"+this.color+"-8");
            ctx.lineWidth = 7.5*quality;
            ctx.lineJoin = "round";
            ctx.lineCap = "square";
            ctx.beginPath();
            let path = [[+1,+1], [-1,+1], [-1,-1], [+1,-1]].map(v => this.size.div(2).mul(v)).map(v => v.rotateOrigin(this.heading));
            for (let i = 0; i <= path.length; i++) {
                let j = i%path.length;
                let p = this.odometry.worldToCanvas(this.pos.add(path[j]));
                if (i > 0) ctx.lineTo(...p.xy);
                else ctx.moveTo(...p.xy);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--"+((this.hovered == "heading") ? "v8" : "v8-8"));
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(this.pos.add(V.dir(this.heading, this.w/2))).xy, 5*quality, 0, 2*Math.PI);
            ctx.fill();
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--"+((this.hovered == "main") ? this.colorH : this.color));
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v8");
            ctx.lineWidth = 2*quality;
            ctx.beginPath();
            ctx.arc(...this.odometry.worldToCanvas(this.pos).xy, 7.5*quality, 0, 2*Math.PI);
            ctx.fill();
            if (this.selected) ctx.stroke();
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
        if (!this.hasOdometry()) return null;
        let m = this.odometry.pageToWorld(this.odometry.mouse);
        if (this.showVelocity && this.pos.add(this.velocity).dist(m) < this.odometry.pageLenToWorld(5)) return "velocity";
        if (this.pos.add(V.dir(this.heading, this.w/2)).dist(m) < this.odometry.pageLenToWorld(5)) return "heading";
        if (this.pos.dist(m) < this.odometry.pageLenToWorld(7.5)) return "main";
        return null;
    }

    get type() { return this.#type; }
    set type(v) {
        if (!Object.values(Odometry2d.Robot.Types)) return;
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

    constructor(pos, radius) {
        super(pos);

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
        if (!this.hasOdometry()) return null;
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

export class Reviver {
    #rules;

    constructor(reviver=null) {
        this.#rules = {};

        if (reviver instanceof Reviver)
            reviver.rules.forEach(cons => this.addRule(cons));
    }

    isConstructor(constructor) {
        if (!util.is(constructor, "func")) return false;
        try {
            new constructor();
            return true;
        } catch (e) {}
        return false;
    }

    get rules() { return Object.values(this.#rules); }
    set rules(v) {
        v = util.ensure(v, "arr");
        this.clearRules();
        v.forEach(v => this.addRule(v));
    }
    clearRules() {
        let rules = this.rules;
        rules.forEach(cons => this.remRule(cons));
        return rules;
    }
    hasRule(v) {
        if (util.is(v, "str")) return v in this.#rules;
        if (util.is(v, "func")) return this.hasRule(v.name);
        return false;
    }
    getRule(name) {
        name = String(name);
        if (!this.hasRule(name)) return null;
        return this.#rules[name];
    }
    addRule(constructor) {
        if (!util.is(constructor, "func")) return false;
        this.#rules[constructor.name] = constructor;
        return constructor;
    }
    remRule(constructor) {
        if (!util.is(constructor, "func")) return false;
        delete this.#rules[constructor.name];
        return constructor;
    }
    addRuleAndAllSub(constructor) {
        if (!util.is(constructor, "func")) return false;
        this.addRule(constructor);
        for (let k in constructor) this.addRuleAndAllSub(constructor[k]);
        return constructor;
    }

    get f() {
        return (k, v) =>  {
            if (util.is(v, "obj")) {
                if (!("%CUSTOM" in v)) return v;
                if (!("%OBJ" in v)) return v;
                if (!("%ARGS" in v)) return v;
                if (!v["%CUSTOM"]) return v;
                if (!this.hasRule(v["%OBJ"])) return v;
                let rule = this.getRule(v["%OBJ"]);
                return new rule(...util.ensure(v["%ARGS"], "arr"));
            }
            return v;
        };
    }
}

export const REVIVER = new Reviver();
REVIVER.addRuleAndAllSub(V);
