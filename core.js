import * as util from "./util.js";
import { V } from "./util.js";

// https://www.svgrepo.com/collection/untitled-ui-oval-interface-icons

const DEVELOPER = true;

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
    #setupDone;

    #popups;

    #contextMenu;

    #eCoreStyle;
    #eStyle;
    #eDynamicStyle;
    #eTitleBar;
    #eLoading;
    #eLoadingTo;

    constructor() {
        super();

        if (DEVELOPER) {
            window.app = this;
        } else {
            document.body.addEventListener("keydown", e => {
                if (e.code == "KeyI")
                    if (e.altKey && (e.ctrlKey || e.metaKey))
                        e.preventDefault();
            });
            /*
            window.addEventListener("beforeunload", e => {
                e.preventDefault();
                return "NO";
            });
            */
        }

        this.#setupDone = false;

        this.#popups = [];

        this.#contextMenu = null;
        document.body.addEventListener("click", e => {
            this.contextMenu = null;
        }, { capture: true });

        this.addHandler("start", data => {
            let id = setInterval(() => {
                if (document.readyState != "complete") return;
                clearInterval(id);
                (async () => {
                    this.post("start-begin", null);
                    await this.setup();
                    this.post("start-complete", null);
                })();
            }, 10);
        });
    }

    get setupDone() { return this.#setupDone; }

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

    start() { this.post("start", null); }

    async setup() {
        if (this.setupDone) return false;

        this.#setupDone = true;

        window.api.onPerm(() => {
            (async () => {
                let perm = await this.getPerm();
                window.api.sendPerm(perm);
            })();
        });

        const coreStyle = this.#eCoreStyle = document.createElement("link");
        document.head.appendChild(coreStyle);
        coreStyle.rel = "stylesheet";
        coreStyle.href = "../style.css";

        const theStyle = this.#eStyle = document.createElement("link");
        document.head.appendChild(theStyle);
        theStyle.rel = "stylesheet";
        theStyle.href = "./style.css";

        const dynamicStyle = this.#eDynamicStyle = document.createElement("style");
        document.head.appendChild(dynamicStyle);
        dynamicStyle.innerHTML = "#mount{animation: mount-in 0.25s forwards;}@keyframes mount-in{0%{visibility:hidden;}99%{visibility:hidden;}100%{visibility:inherit;}}";

        const titleBar = this.#eTitleBar = document.createElement("div");
        document.body.appendChild(titleBar);
        titleBar.id = "titlebar";
        const titleBarText = document.createElement("div");
        titleBar.appendChild(titleBarText);
        titleBarText.style.flexBasis = "100%";
        titleBarText.style.textAlign = "center";

        this.#eLoading = document.getElementById("loading");
        if (this.hasELoading()) this.eLoading.classList.add("this");
        let t = util.getTime();

        const ionicons1 = document.createElement("script");
        document.body.appendChild(ionicons1);
        ionicons1.type = "module";
        ionicons1.src = "../node_modules/ionicons/dist/ionicons/ionicons.esm.js";
        const ionicons2 = document.createElement("script");
        document.body.appendChild(ionicons2);
        ionicons2.noModule = true;
        ionicons2.src = "../node_modules/ionicons/dist/ionicons/ionicons.js";

        const updatePage = () => {
            let title = document.head.querySelector("title");
            titleBarText.textContent = (title instanceof HTMLTitleElement) ? title.textContent : window.location.toString();
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

        let resp = await fetch("../theme.json");
        let data = await resp.json();
        let base = util.ensure(data._, "arr");
        delete data._;
        base = base.map(rgb => {
            rgb = util.ensure(rgb, "arr");
            while (rgb.length > 3) rgb.pop();
            while (rgb.length < 3) rgb.push(0);
            return rgb.map(v => Math.min(255, Math.max(0, util.ensure(v, "num"))));
        });
        while (base.length > 9) base.shift();
        while (base.length < 9) base.unshift([0, 0, 0]);
        // base = base.map(v => new Array(3).fill((v[0]+v[1]+v[2])/3))
        for (let color in data) {
            let rgb = util.ensure(data[color], "arr");
            while (rgb.length > 3) rgb.pop();
            while (rgb.length < 3) rgb.push(0);
            rgb = rgb.map(v => Math.min(255, Math.max(0, util.ensure(v, "num"))));
            data[color] = rgb;
        }
        let style = {};
        for (let i = 0; i <= 9; i++) {
            let normal = (i < 9);
            for (let j = 0; j < 16; j++) {
                let alpha = j/15;
                let hex = "0123456789abcdef"[j];
                if (normal) style["v"+i+"-"+hex] = "rgba("+[...base[i], alpha].join(",")+")";
                else style["v-"+hex] = style["v4-"+hex];
            }
            if (normal) style["v"+i] = style["v"+i+"-f"];
            else style["v"] = style["v-f"];
        }
        let black = base[1], white = base[8];
        data._ = data.b;
        for (let color in data) {
            let rgb = data[color];
            let header = (color == "_") ? "a" : "c"+color;
            for (let i = 0; i <= 9; i++) {
                let normal = (i < 9);
                let newRgb = normal ?
                    Array.from(new Array(3).keys()).map(k => util.lerp(
                        rgb[k],
                        (i < 4) ? black[k] : (i > 4) ? white[k] : rgb[k],
                        Math.abs(i-4)/4,
                    )) :
                    null;
                for (let j = 0; j < 16; j++) {
                    let alpha = j/15;
                    let hex = "0123456789abcdef"[j];
                    if (normal) style[header+i+"-"+hex] = "rgba("+[...newRgb, alpha].join(",")+")";
                    else style[header+"-"+hex] = style[header+"4-"+hex];
                }
                if (normal) style[header+i] = style[header+i+"-f"];
                else style[header] = style[header+"-f"];
            }
        }
        let styleStr = "";
        for (let k in style) styleStr += "--"+k+":"+style[k]+";";
        dynamicStyle.innerHTML += ":root{"+styleStr+"}";

        await this.post("setup", null);

        setTimeout(() => {
            if (this.hasELoading()) {
                this.eLoading.classList.remove("this");
                let introTitle = this.eLoading.querySelector(":scope > .introtitle");
                if (this.hasELoadingTo() && (introTitle instanceof HTMLElement)) {
                    this.eLoadingTo.style.visibility = "hidden";
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
        return this.contextMenu;
    }

    addBackButton() {
        if (!(this.eTitleBar instanceof HTMLDivElement)) return false;
        let btn = document.createElement("button");
        this.eTitleBar.appendChild(btn);
        btn.classList.add("icon");
        btn.style.setProperty("--bg", "transparent");
        btn.style.setProperty("--bgd", "transparent");
        btn.innerHTML = "<ion-icon name='chevron-back'></ion-icon>";
        btn.addEventListener("click", e => {
            window.api.ask("back");
        });
        return btn;
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
    #eButton;

    constructor(content, icon="alert-circle", button="OK") {
        super();

        this.elem.classList.add("alert");

        this.#eIcon = document.createElement("div");
        this.inner.appendChild(this.eIcon);
        this.eIcon.classList.add("icon");
        this.eIcon.innerHTML = "<ion-icon></ion-icon>";
        this.#eContent = document.createElement("div");
        this.inner.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eButton = document.createElement("button");
        this.inner.appendChild(this.eButton);
        this.eButton.classList.add("special");

        this.eButton.addEventListener("click", e => this.close());

        this.content = content;
        this.icon = icon;
        this.button = button;

        this.iconColor = "var(--v5)";
    }

    get eIcon() { return this.#eIcon; }
    get eContent() { return this.#eContent; }
    get eButton() { return this.#eButton; }

    get icon() { return this.eIcon.children[0].getAttribute("name"); }
    set icon(v) { this.eIcon.children[0].setAttribute("name", v); }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }
    
    get content() { return this.eContent.textContent; }
    set content(v) { this.eContent.textContent = v; }

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
    set icon(v) { this.eIcon.children[0].setAttribute("name", v); }
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
    set icon(v) { this.eIcon.children[0].setAttribute("name", v); }
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
    set icon(v) { this.eIcon.setAttribute("name", v); }

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
};
App.ContextMenu.Divider = class AppContextMenuDivider extends App.ContextMenu.Item {
    constructor() {
        super();

        this.elem.classList.add("divider");
    }
}

export class Reviver {
    #rules;

    constructor(reviver=null) {
        this.#rules = {};

        if (reviver instanceof Reviver)
            reviver.rules.forEach(cons => this.addRule(cons));
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
REVIVER.addRule(V);
