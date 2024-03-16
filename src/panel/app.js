import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";

import Source from "../sources/source.js";
import NTSource from "../sources/nt4/source.js";
import WPILOGSource from "../sources/wpilog/source.js";
import CSVTimeSource from "../sources/csv/time/source.js";
import CSVFieldSource from "../sources/csv/field/source.js";
import { WorkerClient } from "../worker.js";


class RLine extends core.Odometry2d.Render {
    #a; #b;
    #color;

    constructor(odometry, a, b, color) {
        super(odometry);

        this.#a = new V();
        this.#b = new V();
        this.#color = null;

        this.a = a;
        this.b = b;
        this.color = color;

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            ctx.strokeStyle = this.color.startsWith("--") ? core.PROPERTYCACHE.get(this.color) : this.color;
            ctx.lineWidth = 7.5*quality;
            ctx.lineJoin = "round";
            ctx.lineCap = "square";
            ctx.beginPath();
            ctx.moveTo(...this.odometry.worldToCanvas(this.a).xy);
            ctx.lineTo(...this.odometry.worldToCanvas(this.b).xy);
            ctx.stroke();
        });
    }

    get a() { return this.#a; }
    set a(v) { this.#a.set(v); }
    get aX() { return this.a.x; }
    set aX(v) { this.a.x = v; }
    get aY() { return this.a.y; }
    set aY(v) { this.a.y = v; }
    get b() { return this.#b; }
    set b(v) { this.#b.set(v); }
    get bX() { return this.b.x; }
    set bX(v) { this.b.x = v; }
    get bY() { return this.b.y; }
    set bY(v) { this.b.y = v; }

    get color() { return this.#color; }
    set color(v) { this.#color = String(v); }
}


function getDisplay(t, v) {
    t = (t == null) ? null : String(t);
    if (t == null || t.length <= 0) return {
        name: v ? "folder" : "folder-outline",
        color: "",
    };
    if (t.endsWith("[]")) {
        t = t.substring(0, t.length-2);
        let display = getDisplay(t, (t == "boolean") ? true : null);
        if (display == null) return null;
        return {
            src: "../assets/icons/array.svg",
            color: display.color,
        };
    }
    if (t.startsWith("struct:")) return {
        name: "cube-outline",
    };
    if (!Source.Field.TYPES.includes(t)) return {
        name: "document-outline",
        color: "var(--cr)",
    };
    if (["double", "float", "int"].includes(t)) return {
        src: "../assets/icons/number.svg",
        color: "var(--cb)",
    };
    if (t == "boolean") return {
        name: v ? "checkmark-circle" : "close-circle",
        color: v ? "var(--cg)" : "var(--cr)",
    };
    if (t == "string") return {
        name: "text",
        color: "var(--cy)",
    };
    if (t == "structschema") return {
        name: "map-outline",
    };
    return {
        src: "../assets/icons/variable.svg",
    };
}

function getRepresentation(o, alt=false) {
    if (
        util.is(o, "num") ||
        util.is(o, "bool") ||
        util.is(o, "str")
    ) return (alt && util.is(o, "str")) ? `"${o}"` : String(o);
    if (o instanceof Uint8Array) return alt ? lib.TEXTDECODER.decode(o) : [...o].map(x => x.toString(16).padStart(2, "0")).join("");
    if (util.is(o, "arr")) return (alt ? "" : "[")+[...o].map(o => getRepresentation(o)).join(", ")+(alt ? "" : "]");
    if (util.is(o, "obj")) return JSON.stringify(o);
    return String(o);
}

function getTabDisplay(name) {
    name = String(name);
    if (name == "graph") return {
        name: "analytics",
        color: "var(--cb)",
    };
    if (name == "table") return {
        src: "../assets/icons/table.svg",
        color: "var(--cb)",
    };
    if (name.startsWith("odometry")) return {
        name: "locate",
        color: "var(--cy)",
    };
    if (name == "webview") return {
        name: "globe-outline",
        color: "var(--cc)",
    };
    if (name == "videosync") return {
        name: "play-outline",
        color: "var(--cc)",
    };
    if (name == "logger" || name == "logworks") return {
        name: "list",
        color: "var(--cc)",
    };
    if (name == "scout") return {
        name: "search-outline",
        color: "var(--cc)",
    };
}

function stringify(data) {
    const dfs = (data, indent=0) => {
        const space = new Array(indent).fill("  ").join("");
        indent++;
        if (util.is(data, "obj"))
            return "\n"+Object.keys(data).map(k => space+k+": "+dfs(data[k], indent)).join("\n");
        if (util.is(data, "arr"))
            return "\n"+data.map((v, i) => space+i+": "+dfs(v, indent)).join("\n");
        return String(data);
    };
    return dfs(data).trim();
}

class FieldExplorer extends core.Explorer {
    static SORT = true;
};
FieldExplorer.Node = class FieldExplorerNode extends FieldExplorer.Node {
    #canShowValue;

    static doubleTraverse(nodeArr, enodeArr, addFunc, remFunc, dumpFunc=null) {
        return super.doubleTraverse(
            util.ensure(nodeArr, "arr").filter(node => (node instanceof Source.Node)).map(node => {
                node.info = node.hasField() ? node.field.type : null;
                node.value = node.hasField() ? node.field.get() : null;
                node.tooltip = node.hasField() ? stringify(node.field.getMetadata()) : null;
                return node;
            }),
            enodeArr,
            addFunc,
            remFunc,
            dumpFunc,
        );
    }

    constructor(name, type) {
        super(name, type);

        this.addHandler("trigger", e => {
            if (!this.eDisplay.contains(e.target)) return;
            if (this.isJustPrimitive || e.shiftKey) this.showValue = this.canShowValue && !this.showValue;
            else this.isOpen = !this.isOpen;
        });

        this.canShowValue = true;
    }

    get canShowValue() { return this.#canShowValue; }
    set canShowValue(v) {
        v = !!v;
        if (this.canShowValue == v) return;
        this.#canShowValue = v;
        this.showValue &&= this.canShowValue;
    }

    get info() { return this.type; }
    set info(v) {}

    get type() { return super.info; }
    hasType() { return super.info != null; }
    get isStruct() { return this.hasType() && this.type.startsWith("struct:"); }
    get structType() {
        if (!this.hasType()) return null;
        if (!this.isStruct) return this.type;
        return this.type.slice(7);
    }
    get clippedType() {
        if (!this.hasType()) return null;
        if (this.isStruct) return this.structType;
        return this.type;
    }
    get isArray() { return this.hasType() && this.clippedType.endsWith("[]"); }
    get arrayType() {
        if (!this.hasType()) return null;
        if (!this.isArray) return this.clippedType;
        return this.clippedType.slice(0, this.clippedType.length-2);
    }
    get isPrimitive() { return this.hasType() && Source.Field.TYPES.includes(this.arrayType); }
    get isJustPrimitive() { return this.isPrimitive && !this.isArray; }

    get value() {
        if (!this.hasType()) return this.isOpen;
        return this.isArray ? [...util.ensure(super.value, "arr")] : super.value;
    }
    set value(v) {
        v = Source.Field.ensureType(this.type, v);
        super.value = v;
    }

    updateDisplay() {
        let display = getDisplay(this.type, this.value);
        if (display != null) {
            if ("src" in display) this.iconSrc = display.src;
            else this.icon = display.name;
            let color = util.ensure(display.color, "str");
            if (this.eIcon.style.color != color) this.eIcon.style.color = this.eValue.style.color = display.color;
        } else {
            this.icon = "";
            this.eIcon.style.color = this.eValue.style.color = "";
        }
        if (this.showValue) this.eValue.textContent = getRepresentation(this.value, this.type == "structschema");
    }
};

class ToolButton extends util.Target {
    #elem;
    #eIcon;
    #eName;

    constructor(dname, name) {
        super();

        this.#elem = document.createElement("button");
        this.elem.classList.add("item");
        this.elem.classList.add("light");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);

        let cancel = 10;
        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            this.post("trigger", e);
        });
        this.elem.addEventListener("contextmenu", e => {
            this.post("contextmenu", e);
        });
        this.elem.addEventListener("mousedown", e => {
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
                this.post("drag", e);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.name = dname;

        let display = getTabDisplay(name);
        if (display != null) {
            if ("src" in display) this.iconSrc = display.src;
            else this.icon = display.name;
            if ("color" in display) this.iconColor = display.color;
            else this.iconColor = "";
        }
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }

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

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }
}

class LoggerContext extends util.Target {
    #location;
    #connected;

    #serverLogs;
    #clientLogs;

    #loading;

    constructor() {
        super();

        this.#location = null;
        this.#connected = false;

        this.#serverLogs = new Set();
        this.#clientLogs = {};

        this.#loading = {};

        const timer1 = new util.Timer();
        const timer2 = new util.Timer();
        timer1.play();
        timer2.play();
        this.addHandler("update", delta => {
            if (timer1.time >= 1000) {
                timer1.clear();
                this.pollServer();
            }
            if (timer2.time >= 100) {
                timer2.clear();
                this.pollClient();
                (async () => (this.#location = await window.api.get("client-location")))();
                (async () => (this.#connected = await window.api.get("client-connected")))();
            }
        });
    }

    get location() { return this.#location; }
    hasLocation() { return this.location != null; }
    get connected() { return this.#connected; }
    get disconnected() { return !this.connected; }

    get serverLogs() { return [...this.#serverLogs]; }
    hasServerLog(name) {
        name = String(name);
        return this.#serverLogs.has(name);
    }
    get clientLogs() { return Object.keys(this.#clientLogs); }
    hasClientLog(name) {
        name = String(name);
        return name in this.#clientLogs;
    }
    getClientPath(name) {
        if (!this.hasClientLog(name)) return null;
        return this.#clientLogs[name];
    }
    get logs() {
        let logs = new Set();
        this.serverLogs.forEach(name => logs.add(name));
        this.clientLogs.forEach(name => logs.add(name));
        return [...logs];
    }
    hasLog(name) {
        name = String(name);
        return this.hasServerLog(name) || this.hasClientLog(name);
    }

    get loading() {
        Object.keys(this.#loading).forEach(name => {
            if (this.hasLog(name) || name[0] == "§") return;
            delete this.#loading[name];
        });
        return Object.keys(this.#loading);
    }
    incLoading(name) {
        name = String(name);
        if (!this.hasLog(name) && name[0] != "§") return false;
        this.#loading[name] = util.ensure(this.#loading[name], "int")+1;
        return true;
    }
    decLoading(name) {
        name = String(name);
        if (!this.hasLog(name) && name[0] != "§") return false;
        this.#loading[name] = util.ensure(this.#loading[name], "int")-1;
        if (this.#loading[name] <= 0) delete this.#loading[name];
        return true;
    }
    isLoading(name) { return this.loading.includes(name); }

    async logsCache(paths) {
        paths = util.ensure(paths, "arr").map(path => String(path));
        let names = await Promise.all(paths.map(async path => {
            this.incLoading("§caching");
            let name = null;
            try {
                name = await window.api.send("log-cache", path);
            } catch (e) {
                this.decLoading("§caching");
                throw e;
            }
            this.decLoading("§caching");
            return name;
        }));
        await this.pollClient();
        return names.filter(name => name != null);
    }
    async logsUpload(names) {
        names = util.ensure(names, "arr").map(name => String(name));
        if (this.disconnected) return;
        await Promise.all(names.map(async name => {
            if (!this.hasClientLog(name)) return;
            this.incLoading(name);
            try {
                await window.api.send("log-upload", name);
            } catch (e) {
                this.decLoading(name);
                throw e;
            }
            this.decLoading(name);
        }));
        await this.pollServer();
    }
    async logsDownload(names) {
        names = util.ensure(names, "arr").map(name => String(name));
        if (this.disconnected) return;
        await Promise.all(names.map(async name => {
            this.incLoading(name);
            try {
                await window.api.send("log-download", name);
            } catch (e) {
                this.decLoading(name);
                throw e;
            }
            this.decLoading(name);
        }));
        await this.pollServer();
    }
    async logsClientDelete(names) {
        names = util.ensure(names, "arr").map(name => String(name));
        await Promise.all(names.map(async name => {
            this.incLoading(name);
            try {
                await window.api.send("log-client-delete", name);
            } catch (e) {
                this.decLoading(name);
                throw e;
            }
            this.decLoading(name);
        }));
        await this.pollClient();
    }
    async logsServerDelete(names) {
        names = util.ensure(names, "arr").map(name => String(name));
        if (this.disconnected) return;
        await Promise.all(names.map(async name => {
            this.incLoading(name);
            try {
                await window.api.send("log-server-delete", name);
            } catch (e) {
                this.decLoading(name);
                throw e;
            }
            this.decLoading(name);
        }));
        await this.pollServer();
    }

    async pollServer() {
        let logs = util.ensure(await window.api.get("logs-server"), "arr");
        this.#serverLogs.clear();
        logs.map(log => this.#serverLogs.add(String(log)));
    }
    async pollClient() {
        let logs = util.ensure(await window.api.get("logs-client"), "arr");
        this.#clientLogs = {};
        logs.map(log => {
            log = util.ensure(log, "obj");
            let name = String(log.name), path = String(log.path);
            this.#clientLogs[name] = path;
        });
    }

    update(delta) { this.post("update", delta); }
}
const LOGGERCONTEXT = new LoggerContext();

const COLORS = [
    { _: "cr", h: "cr5", d: "cr3", name: "Red" },
    { _: "co", h: "co5", d: "co3", name: "Orange" },
    { _: "cy", h: "cy5", d: "cy3", name: "Yellow" },
    { _: "cg", h: "cg5", d: "cg3", name: "Green" },
    { _: "cc", h: "cc5", d: "cc3", name: "Cyan" },
    { _: "cb", h: "cb5", d: "cb3", name: "Blue" },
    { _: "cp", h: "cp5", d: "cp3", name: "Purple" },
    { _: "cm", h: "cm5", d: "cm3", name: "Magenta" },
    { _: "v8", h: "v8", d: "v6", name: "White" },
    { _: "v4", h: "v5", d: "v2", name: "Grey" },
];

class Widget extends util.Target {
    #elem;

    #parent;
    #hasParent;
    #hasPageParent;
    #page;
    #app;

    constructor() {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.elem.classList.add("widget");

        this.#parent = 0;

        this.parent = null;
    }

    get elem() { return this.#elem; }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Container) ? v : (v instanceof App.ProjectPage) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
        this.compute();
    }
    hasParent() { return this.#hasParent; }
    hasPageParent() { return this.#hasPageParent; }
    get page() { return this.#page; }
    hasPage() { return !!this.page; }
    get app() { return this.#app; }
    hasApp() { return !!this.app; }
    compute() {
        this.#hasParent = this.parent instanceof Container;
        this.#hasPageParent = this.parent instanceof App.ProjectPage;
        this.#page = this.hasPageParent() ? this.parent : this.hasParent() ? this.parent.page : null;
        this.#app = this.hasPage() ? this.page.app : null;
    }

    contains(v) { return v == this; }

    format() {}
    collapse() {}

    update(delta) { this.post("update", delta); }
}

class Container extends Widget {
    #children;
    #weights;
    #dividers;
    #axis;

    constructor(...a) {
        super();

        this.elem.classList.add("container");
        
        this.#children = [];
        this.#weights = [];
        this.#dividers = [];
        this.#axis = null;

        new ResizeObserver(() => this.format()).observe(this.elem);

        this.addHandler("add", () => this.children.forEach(child => child.onAdd()));
        this.addHandler("rem", () => this.children.forEach(child => child.onRem()));

        this.addHandler("update", delta => this.children.forEach(child => child.update(delta)));

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Container) a = [a.children, a.weights, a.axis];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof Widget) a = [a, [], "x"];
                else {
                    a = new Container(...a);
                    a = [a.children, a.weights, a.axis];
                }
            }
            else if (util.is(a, "obj")) a = [a.children, a.weights, a.axis];
            else a = [[], [], "x"];
        }
        if (a.length == 2) {
            if (util.is(a[1], "str")) a = [a[0], [], a[1]];
            else a = [...a, "x"];
        }

        this.children = a[0];
        this.weights = a[1];
        this.axis = a[2];
    }

    compute() {
        super.compute();
        try {
            this.children.forEach(child => child.compute());
        } catch (e) {}
    }

    get children() { return [...this.#children]; }
    set children(v) {
        v = util.ensure(v, "arr");
        this.clearChildren();
        v.forEach(v => this.addChild(v));
        this.weights = (this.children.length > 0) ? new Array(this.children.length).fill(1 / this.children.length) : [];
    }
    get weights() { return [...this.#weights]; }
    set weights(v) {
        let weights = this.weights;
        v = util.ensure(v, "arr").map(v => Math.max(0, util.ensure(v, "num")));
        let wSum = 0;
        v.forEach(w => (wSum += w));
        if (v.length <= 0 || wSum <= 0)
            this.#weights = (this.children.length > 0) ? new Array(this.children.length).fill(1 / this.children.length) : [];
        else {
            let wAvg = wSum / v.length;
            while (v.length > this.children.length) v.pop();
            while (v.length < this.children.length) v.push(wAvg);
            wSum = 0;
            v.forEach(w => (wSum += w));
            this.#weights = (this.children.length > 0) ? v.map(w => w/wSum) : [];
        }
        this.change("weights", weights, this.weights);
        this.format();
    }
    clearChildren() {
        let children = this.children;
        children.forEach(child => this.remChild(child));
        return children;
    }
    hasChild(child) {
        if (!(child instanceof Widget)) return false;
        return this.#children.includes(child) && child.parent == this;
    }
    addChild(child, at=null) {
        if (!(child instanceof Widget)) return false;
        if (this.hasChild(child)) return false;
        if (child.parent != null) return false;
        if (at == null) at = this.#children.length;
        at = Math.min(this.#children.length, Math.max(0, util.ensure(at, "int")));
        child.parent = this;
        this.elem.appendChild(child.elem);
        let weights = this.weights;
        if (this.#children.length <= 0) {
            this.#children.push(child);
            this.#weights.push(1);
        } else {
            let wSum = 0;
            this.#weights.forEach(w => (wSum += w));
            let wAvg = wSum / this.#children.length;
            this.#weights.splice(at, 0, wAvg);
            wSum = 0;
            this.#weights.forEach(w => (wSum += w));
            this.#weights = this.#weights.map(w => w/wSum);
            this.#children.splice(at, 0, child);
        }
        child.addLinkedHandler(this, "change", (c, f, t) => this.change("children["+this.#children.indexOf(child)+"]."+c, f, t));
        this.change("addChild", null, child);
        this.change("weights", weights, this.weights);
        this.format();
        child.onAdd();
        return child;
    }
    replaceChild(child, at) {
        if (!(child instanceof Widget)) return false;
        if (this.hasChild(child)) return false;
        if (child.parent != null) return false;
        if (this.#children.length <= 0) return false;
        at = Math.min(this.#children.length-1, Math.max(0, util.ensure(at, "int")));
        let weights = this.weights;
        let oldChild = this.#children[at];
        this.remChild(oldChild);
        this.addChild(child, at);
        this.weights = weights;
        return child;
    }
    remChild(child) {
        if (!(child instanceof Widget)) return false;
        if (!this.hasChild(child)) return false;
        if (child.parent != this) return false;
        child.onRem();
        let at = this.#children.indexOf(child);
        child.parent = null;
        this.elem.removeChild(child.elem);
        this.#children.splice(at, 1);
        let weights = this.weights;
        this.#weights.splice(at, 1);
        if (this.#children.length > 0) {
            let wSum = 0;
            this.#weights.forEach(w => (wSum += w));
            this.#weights = this.#weights.map(w => w/wSum);
        }
        child.clearLinkedHandlers(this, "change");
        this.change("remChild", child, null);
        this.change("weights", weights, this.weights);
        this.format();
        return child;
    }

    get axis() { return this.#axis; }
    set axis(v) {
        v = String(v).toLowerCase();
        if (!["x", "y"].includes(v)) return;
        if (this.axis == v) return;
        this.change("axis", this.axis, this.#axis=v);
        this.format();
    }

    contains(v) {
        if (v == this) return true;
        for (let child of this.children)
            if (child.contains(v))
                return true;
        return false;
    }

    format() {
        this.elem.classList.remove("x");
        this.elem.classList.remove("y");
        this.elem.classList.add(this.axis);
        let r = this.elem.getBoundingClientRect();
        let wAlloc = r.width - (this.axis == "x") * (2 * Math.max(0, this.children.length-1));
        let hAlloc = r.height - (this.axis == "y") * (2 * Math.max(0, this.children.length-1));
        this.children.forEach((child, i) => {
            child.elem.style.order = i*2;
            child.elem.style.setProperty("--w", ((this.axis == "x") ? (wAlloc * this.weights[i]) : wAlloc)+"px");
            child.elem.style.setProperty("--h", ((this.axis == "y") ? (hAlloc * this.weights[i]) : hAlloc)+"px");
            child.format();
        });
        let l = Math.max(0, this.children.length-1);
        while (this.#dividers.length > l) {
            let divider = this.#dividers.pop();
            this.elem.removeChild(divider.elem);
        }
        while (this.#dividers.length < l) {
            let divider = {};
            this.#dividers.push(divider);
            let elem = divider.elem = document.createElement("div");
            this.elem.appendChild(elem);
            elem.classList.add("divider");
            elem.addEventListener("mousedown", e => {
                if (e.button != 0) return;
                e.preventDefault();
                e.stopPropagation();
                const mouseup = () => {
                    elem.classList.remove("this");
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                };
                const mousemove = e => {
                    let i = divider.i;
                    let r = this.elem.getBoundingClientRect()
                    let p = (this.axis == "x") ? ((e.pageX-r.left)/r.width) : ((e.pageY-r.top)/r.height);
                    let mnBound = 0, mxBound = 1;
                    for (let j = 0; j < i; j++) mnBound += this.#weights[j];
                    for (let j = this.#weights.length-1; j > i+1; j--) mxBound -= this.#weights[j];
                    p = Math.min(mxBound, Math.max(mnBound, p));
                    let weights = this.weights;
                    this.#weights[i] = p-mnBound;
                    this.#weights[i+1] = mxBound-p;
                    this.change("weights", weights, this.weights);
                    this.format();
                };
                elem.classList.add("this");
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
            });
            elem.addEventListener("contextmenu", e => {
                let itm;
                let menu = new core.App.Menu();
                itm = menu.addItem(new core.App.Menu.Item("Center Divider"));
                itm.addHandler("trigger", e => {
                    let i = divider.i;
                    let mnBound = 0, mxBound = 1;
                    for (let j = 0; j < i; j++) mnBound += this.#weights[j];
                    for (let j = this.#weights.length-1; j > i+1; j--) mxBound -= this.#weights[j];
                    let p = (mxBound+mnBound) / 2;
                    let weights = this.weights;
                    this.#weights[i] = p-mnBound;
                    this.#weights[i+1] = mxBound-p;
                    this.change("weights", weights, this.weights);
                    this.format();
                });
                itm = menu.addItem(new core.App.Menu.Item("Rotate", "refresh"));
                itm.addHandler("trigger", e => {
                    this.axis = (this.axis == "x") ? "y" : "x";
                });
                this.app.contextMenu = menu;
                this.app.placeContextMenu(e.pageX, e.pageY);
            });
        }
        for (let i = 0; i < this.children.length-1; i++) {
            this.#dividers[i].i = i;
            this.#dividers[i].elem.style.order = (2*i)+1;
        }
    }
    collapse() {
        this.children.forEach(child => child.collapse());
        if (this.children.length <= 0) {
            if (this.hasPageParent()) this.parent.widget = null;
            else if (this.hasParent()) this.parent.remChild(this);
            return;
        }
        if (this.children.length <= 1) {
            let child = this.children[0];
            this.clearChildren();
            if (this.hasPageParent()) this.parent.widget = child;
            else if (this.hasParent()) this.parent.replaceChild(child, this.parent.children.indexOf(this));
            return;
        }
        this.children.forEach((child, i) => {
            if (!(child instanceof Container)) return;
            if (child.axis != this.axis) return;
            let weights = this.weights;
            let childweight = weights[i];
            let subweights = child.weights;
            let subchildren = child.children;
            weights.splice(i, 1);
            [...subweights].reverse().forEach(w => weights.splice(i, 0, w*childweight));
            subchildren.forEach(subchild => child.remChild(subchild));
            this.remChild(child);
            [...subchildren].reverse().forEach(subchild => this.addChild(subchild, i));
            this.weights = weights;
        });
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            children: this.children,
            weights: this.weights,
            axis: this.axis,
        });
    }
}

class Panel extends Widget {
    #tabs;
    #tabIndex;

    #eOptions;
    #eTop;
    #eAdd;
    #eContent;

    static getTools() {
        return [
            {
                id: "graph",
                name: "Graph", nickname: "Graph",
                tab: Panel.GraphTab,
            },
            {
                id: "table",
                name: "Table", nickname: "Table",
                tab: Panel.TableTab,
            },
            {
                id: "odometry2d",
                name: "Odometry2d", nickname: "Odom2d",
                tab: Panel.Odometry2dTab,
            },
            {
                id: "odometry3d",
                name: "Odometry3d", nickname: "Odom3d",
                tab: Panel.Odometry3dTab,
            },
            {
                id: "scout",
                name: "Scout", nickname: "Scout",
                tab: Panel.ScoutTab,
            },
            {
                id: "videosync",
                name: "VideoSync", nickname: "VidSync",
                tab: Panel.VideoSyncTab,
            },
            {
                id: "logger",
                name: "Logger", nickname: "Logger",
                tab: Panel.LoggerTab,
                disabled: window.agent().public,
            },
            {
                id: "logworks",
                name: "LogWorks", nickname: "LogWorks",
                tab: Panel.LogWorksTab,
            },
            {
                id: "webview",
                name: "WebView", nickname: "WebView",
                tab: Panel.WebViewTab,
            },
        ];
    }

    constructor(...a) {
        super();

        this.elem.classList.add("panel");
        this.elem.addEventListener("click", e => {
            if (!this.hasPage()) return;
            this.page.activeWidget = this;
        }, { capture: true });

        this.#tabs = [];
        this.#tabIndex = null;

        this.#eOptions = document.createElement("button");
        this.elem.appendChild(this.eOptions);
        this.eOptions.classList.add("options");
        this.eOptions.innerHTML = "<ion-icon name='ellipsis-vertical'></ion-icon>";
        this.#eTop = document.createElement("div");
        this.elem.appendChild(this.eTop);
        this.eTop.classList.add("top");
        this.#eAdd = document.createElement("button");
        this.eTop.appendChild(this.eAdd);
        this.eAdd.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.tabIndex = 0;

        this.addHandler("add", () => this.tabs.forEach(tab => tab.onAdd()));
        this.addHandler("rem", () => this.tabs.forEach(tab => tab.onRem()));

        this.eOptions.addEventListener("click", e => {
            if (!this.hasApp()) return;
            e.stopPropagation();
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item(this.isTitleCollapsed ? "Expand Title" : "Collapse Title", this.isTitleCollapsed ? "chevron-down" : "chevron-up"));
            itm.accelerator = "Ctrl+Shift+F";
            itm.addHandler("trigger", e => {
                this.isTitleCollapsed = !this.isTitleCollapsed;
            });
            itm = menu.addItem(new core.App.Menu.Item(this.isMaximized ? "Minimize" : "Maximize", this.isMaximized ? "contract" : "expand"));
            itm.accelerator = "Ctrl+Option+F";
            itm.addHandler("trigger", e => {
                this.isMaximized = !this.isMaximized;
            });
            menu.addItem(new core.App.Menu.Divider());
            itm = menu.addItem(new core.App.Menu.Item("Close"));
            itm.addHandler("trigger", e => {
                if (this.hasPageParent()) return this.parent.widget = null;
                if (this.hasParent()) return this.parent.remChild(this);
            });
            this.app.contextMenu = menu;
            let r = this.eOptions.getBoundingClientRect();
            this.app.placeContextMenu(r.left, r.bottom);
            menu.elem.style.minWidth = r.width+"px";
        });
        this.eAdd.addEventListener("click", e => {
            e.stopPropagation();
            this.addTab(new Panel.AddTab());
        });

        this.addHandler("update", delta => this.tabs.forEach(tab => tab.update(delta)));

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel) a = [a.tabs, a.tabIndex, a.isTitleCollapsed];
            else if (a instanceof Panel.Tab) a = [[a], 0];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof Panel.Tab) a = [a, 0];
                else {
                    a = new Panel(...a);
                    a = [a.tabs, a.tabIndex, a.isTitleCollapsed];
                }
            }
            else if (util.is(a, "obj")) a = [a.tabs, a.tabIndex, a.isCollapsed];
            else a = [[], 0];
        }
        if (a.length == 2)
            a = [...a, false];

        let isTitleCollapsed = null;
        new MutationObserver(() => {
            if (isTitleCollapsed != this.isTitleCollapsed)
                this.change("isTitleCollapsed", isTitleCollapsed, isTitleCollapsed=this.isTitleCollapsed);
        }).observe(this.elem, { attributes: true, attributeFilter: ["class"] });

        [this.tabs, this.tabIndex, this.isTitleCollapsed] = a;

        if (this.tabs.length <= 0) this.addTab(new Panel.AddTab());
    }

    compute() {
        super.compute();
        try {
            this.tabs.forEach(tab => tab.compute());
        } catch (e) {}
    }

    get tabs() { return [...this.#tabs]; }
    set tabs(v) {
        v = util.ensure(v, "arr");
        this.clearTabs();
        v.forEach(v => this.addTab(v));
    }
    get tabIndex() { return this.#tabIndex; }
    set tabIndex(v) {
        v = Math.min(this.#tabs.length-1, Math.max(0, util.ensure(v, "int")));
        this.change("tabIndex", this.tabIndex, this.#tabIndex=v);
        this.#tabs.forEach((tab, i) => (i == this.tabIndex) ? tab.open() : tab.close());
        if (this.tabs[this.tabIndex]) this.tabs[this.tabIndex].eTab.scrollIntoView({ behavior: "smooth" });
        this.format();
    }
    clearTabs() {
        let tabs = this.tabs;
        tabs.forEach(tab => this.remTab(tab));
        return tabs;
    }
    hasTab(tab) {
        if (!(tab instanceof Panel.Tab)) return false;
        return this.#tabs.includes(tab) && tab.parent == this;
    }
    getTab(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.#tabs.length) return null;
        return this.#tabs[i];
    }
    addTab(tab, at=null) {
        if (!(tab instanceof Panel.Tab)) return false;
        if (this.hasTab(tab)) return false;
        if (tab.parent != null) return false;
        if (at == null) at = this.#tabs.length;
        this.#tabs.splice(at, 0, tab);
        tab.parent = this;
        tab.addLinkedHandler(this, "change", (c, f, t) => this.change("tabs["+this.#tabs.indexOf(tab)+"]."+c, f, t));
        this.change("addTab", null, tab);
        this.eTop.appendChild(tab.eTab);
        this.eContent.appendChild(tab.elem);
        this.tabIndex = this.#tabs.indexOf(tab);
        this.format();
        tab.onAdd();
        return tab;
    }
    remTab(tab) {
        if (!(tab instanceof Panel.Tab)) return false;
        if (!this.hasTab(tab)) return false;
        if (tab.parent != this) return false;
        tab.onRem();
        let activeTab = this.tabs[this.tabIndex];
        let at = this.#tabs.indexOf(tab);
        this.#tabs.splice(at, 1);
        tab.parent = null;
        tab.clearLinkedHandlers(this, "change");
        this.change("remTab", tab, null);
        this.eTop.removeChild(tab.eTab);
        this.eContent.removeChild(tab.elem);
        tab.close();
        this.format();
        at = this.#tabs.indexOf(activeTab);
        if (at >= 0) this.tabIndex = at;
        else {
            let index = this.tabIndex;
            this.#tabIndex = null;
            this.tabIndex = index;
        }
        return tab;
    }

    format() {
        this.tabs.forEach((tab, i) => {
            tab.eTab.style.order = i;
            tab.format();
        });
        this.eAdd.style.order = this.tabs.length;
    }
    collapse() {
        if (this.tabs.length > 0) return;
        if (this.hasPageParent()) this.parent.widget = null;
        if (this.hasParent()) this.parent.remChild(this);
    }

    get eOptions() { return this.#eOptions; }
    get eTop() { return this.#eTop; }
    get eAdd() { return this.#eAdd; }
    get eContent() { return this.#eContent; }

    get isTitleCollapsed() { return this.elem.classList.contains("collapsed"); }
    set isTitleCollapsed(v) {
        v = !!v;
        if (this.isTitleCollapsed == v) return;
        if (v) this.elem.classList.add("collapsed");
        else this.elem.classList.remove("collapsed");
    }
    get isTitleExpanded() { return !this.isTitleCollapsed; }
    set isTitleExpanded(v) { this.isTitleCollapsed = !v; }
    collapseTitle() { return this.isTitleCollapsed = true; }
    expandTitle() { return this.isTitleExpanded = true; }
    get isMaximized() { return this.elem.classList.contains("maximized"); }
    set isMaximized(v) {
        v = !!v;
        if (this.isMaximized == v) return;
        if (v) this.elem.classList.add("maximized");
        else this.elem.classList.remove("maximized");
    }
    get isMinimized() { return !this.isMaximized; }
    set isMinimized(v) { this.isMaximized = !v; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            tabs: this.tabs,
            tabIndex: this.tabIndex,
            isCollapsed: this.isTitleCollapsed,
        });
    }
}
Panel.Tab = class PanelTab extends util.Target {
    #parent;
    #page;
    #app;

    #elem;
    #eTab;
    #eTabIcon;
    #eTabName;
    #eTabClose;

    constructor() {
        super();

        this.#parent = 0;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eTab = document.createElement("div");
        this.eTab.classList.add("item");
        this.#eTabIcon = document.createElement("ion-icon");
        this.eTab.appendChild(this.eTabIcon);
        this.#eTabName = document.createElement("div");
        this.eTab.appendChild(this.eTabName);
        this.eTabName.classList.add("name");
        this.#eTabClose = document.createElement("button");
        this.eTab.appendChild(this.eTabClose);
        this.eTabClose.classList.add("icon");
        this.eTabClose.innerHTML = "<ion-icon name='close'></ion-icon>";

        let cancel = 10;
        this.eTab.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            if (!this.hasParent()) return;
            this.parent.tabIndex = this.parent.tabs.indexOf(this);
        });
        this.eTab.addEventListener("contextmenu", e => {
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item("Open"));
            itm.addHandler("trigger", e => {
                this.eTab.click();
            });
            itm = menu.addItem(new core.App.Menu.Item("Close"));
            itm.addHandler("trigger", e => {
                this.eTabClose.click();
            });
            itm = menu.addItem(new core.App.Menu.Item("Start Dragging"));
            itm.addHandler("trigger", e => {
                onDrag(e);
            });
            if (!this.hasApp()) return;
            this.app.contextMenu = menu;
            this.app.placeContextMenu(e.pageX, e.pageY);
        });
        const onDrag = e => {
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
                if (!this.hasApp() || !this.hasParent()) return;
                const app = this.app;
                this.parent.remTab(this);
                app.dragData = this;
                app.dragging = true;
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        };
        this.eTab.addEventListener("mousedown", onDrag);
        this.eTabClose.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasParent()) return;
            this.parent.remTab(this);
        });
        
        let isOpen = null;
        new MutationObserver(() => {
            if (isOpen != this.isOpen)
                this.change("isOpen", isOpen, isOpen=this.isOpen);
        }).observe(this.elem, { attributes: true, attributeFilter: ["class"] });

        this.parent = null;
    }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Panel) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
        this.compute();
    }
    hasParent() { return !!this.parent; }
    get page() { return this.#page; }
    hasPage() { return !!this.page; }
    get app() { return this.#app; }
    hasApp() { return !!this.app; }
    compute() {
        this.#page = this.hasParent() ? this.parent.page : null;
        this.#app = this.hasPage() ? this.page.app : null;
    }

    get elem() { return this.#elem; }
    get eTab() { return this.#eTab; }
    get eTabIcon() { return this.#eTabIcon; }
    get eTabName() { return this.#eTabName; }
    get eTabClose() { return this.#eTabClose; }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        this.post("openState", this.isOpen, v);
        if (v) this.post("open");
        else this.post("close");
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
        if (v) this.eTab.classList.add("this");
        else this.eTab.classList.remove("this");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get icon() { return this.eTabIcon.name; }
    set icon(v) {
        this.eTabIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eTabIcon.name = v;
    }
    get iconSrc() { return this.eTabIcon.getAttribute("src"); }
    set iconSrc(v) { this.eTabIcon.setAttribute("src", v); }
    get iconColor() { return this.eTabIcon.style.color; }
    set iconColor(v) { this.eTabIcon.style.color = v; }
    get hasIcon() { return this.eTab.contains(this.eTabIcon); }
    set hasIcon(v) {
        v = !!v;
        if (this.hasIcon == v) return;
        if (v) this.eTab.appendChild(this.eTabIcon);
        else this.eTab.removeChild(this.eTabIcon);
    }

    get name() { return this.eTabName.textContent; }
    set name(v) { this.eTabName.textContent = v; }

    update(delta) { this.post("update", delta); }
    format() { this.post("format"); }

    getHovered(pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        return null;
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {});
    }
};
Panel.AddTab = class PanelAddTab extends Panel.Tab {
    #searchPart;
    #tags;
    #items;

    #eSearch;
    #eSearchTags;
    #eSearchInput;
    #eSearchClear;
    #eContent;

    constructor(...a) {
        super();

        this.elem.classList.add("add");

        this.name = "New Tab";
        this.hasIcon = false;

        this.#searchPart = "";
        this.#tags = [];
        this.#items = [];

        this.#eSearch = document.createElement("div");
        this.elem.appendChild(this.eSearch);
        this.eSearch.classList.add("search");
        this.#eSearchTags = document.createElement("div");
        this.eSearch.appendChild(this.eSearchTags);
        this.eSearchTags.classList.add("tags");
        this.#eSearchInput = document.createElement("input");
        this.eSearch.appendChild(this.eSearchInput);
        this.eSearchInput.type = "text";
        this.eSearchInput.placeholder = "";
        this.eSearchInput.autocomplete = "off";
        this.eSearchInput.spellcheck = false;
        this.#eSearchClear = document.createElement("button");
        this.eSearch.appendChild(this.eSearchClear);
        this.eSearchClear.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.eSearchInput.addEventListener("keydown", e => {
            e.stopPropagation();
            if (!["Backspace", "Delete"].includes(e.code)) return;
            if (this.eSearchInput.value.length > 0) return;
            this.searchPart = null;
        });
        this.eSearchInput.addEventListener("input", e => {
            this.change("query", null, this.eSearchInput.value);
            this.refresh();
        });
        this.eSearchClear.addEventListener("click", e => {
            e.stopPropagation();
            this.searchPart = null;
        });

        this.addHandler("update", delta => {
            if (this.isClosed) return;
            this.items.forEach(itm => itm.update(delta));
        });

        this.addHandler("add", () => this.refresh());
        this.addHandler("rem", () => this.refresh());

        if (a.length <= 0 || a.length > 1) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.AddTab) a = [a.searchPart, a.query];
            else if (util.is(a, "arr")) {
                a = new Panel.AddTab(...a);
                a = [a.searchPart, a.query];
            }
            else if (util.is(a, "obj")) a = [a.searchPart, a.query];
            else a = [null, ""];
        }

        [this.searchPart, this.query] = a;

        this.refresh();
    }

    refresh() {
        this.clearTags();
        this.placeholder = "";
        this.clearItems();
        let toolItems = Panel.getTools();
        toolItems = toolItems.map(data => {
            let display = getTabDisplay(data.id);
            let itm = new Panel.AddTab.Button(data.name, "", "");
            let btn = itm;
            itm.btn.disabled = !!data.disabled;
            if (display != null) {
                if ("src" in display) itm.iconSrc = display.src;
                else itm.icon = display.name;
                if ("color" in display) itm.iconColor = display.color;
                else itm.iconColor = "";
            }
            return {
                item: itm,
                trigger: () => {
                    if (!this.hasParent()) return;
                    if (!!data.disabled) return;
                    let index = this.parent.tabs.indexOf(this);
                    this.parent.addTab(new data.tab(), index);
                    this.parent.remTab(this);
                },
                contextmenu: e => {
                    let itm;
                    let menu = new core.App.Menu();
                    itm = menu.addItem(new core.App.Menu.Item("Open"));
                    itm.addHandler("trigger", e => {
                        btn.post("trigger", e);
                    });
                    itm = menu.addItem(new core.App.Menu.Item("Start Dragging"));
                    itm.addHandler("trigger", e => {
                        btn.post("drag", e);
                    });
                    if (!this.hasApp()) return;
                    this.app.contextMenu = menu;
                    this.app.placeContextMenu(e.pageX, e.pageY);
                },
                drag: () => {
                    if (!this.hasApp()) return;
                    if (!!data.disabled) return;
                    this.app.dragData = new data.tab();
                    this.app.dragging = true;
                },
            };
        });
        toolItems = toolItems.map(item => {
            if (item.init) item.init(item.item);
            item.item.addHandler("trigger", item.trigger);
            item.item.addHandler("contextmenu", item.contextmenu);
            item.item.addHandler("drag", item.drag);
            return item.item;
        });
        const toolItemSelect = itm => {
            itm.item.selectName(null);
            itm.matches.forEach(match => itm.item.selectName(match.indices));
            return itm.item;
        };
        const nodeItemSelect = itm => {
            itm.item.selectName(null);
            itm.item.selectInfo(null);
            itm.matches.forEach(match => {
                if (match.key == "node.path") itm.item.selectName(match.indices);
                if (match.key == "node.field.type") itm.item.selectInfo(match.indices);
            });
            return itm.item;
        };
        if (this.searchPart == null) {
            this.tags = [];
            this.placeholder = "Search tools, tables, and topics";
            toolItems = lib.search(toolItems, ["name"], this.query).map(toolItemSelect);
            if (this.query.length > 0) {
                let nodeItems = [];
                if (this.hasPage() && this.page.hasSource()) {
                    let node = this.page.source.tree;
                    const dfs = node => {
                        let itm = new Panel.AddTab.NodeButton(node);
                        let btn = itm;
                        nodeItems.push({
                            item: itm,
                            trigger: () => {
                                if (!this.hasParent()) return;
                                let index = this.parent.tabs.indexOf(this);
                                this.parent.addTab(new Panel.BrowserTab(node.path), index);
                                this.parent.remTab(this);
                            },
                            contextmenu: e => {
                                let itm;
                                let menu = new core.App.Menu();
                                itm = menu.addItem(new core.App.Menu.Item("Open"));
                                itm.addHandler("trigger", e => {
                                    btn.post("trigger", e);
                                });
                                itm = menu.addItem(new core.App.Menu.Item("Start Dragging"));
                                itm.addHandler("trigger", e => {
                                    btn.post("drag", e);
                                });
                                if (!this.hasApp()) return;
                                this.app.contextMenu = menu;
                                this.app.placeContextMenu(e.pageX, e.pageY);
                            },
                            drag: () => {
                                if (!this.hasApp() || !this.hasPage()) return;
                                this.app.dragData = this.page.hasSource() ? this.page.source.tree.lookup(node.path) : null;
                                this.app.dragging = true;
                            },
                        });
                        node.nodeObjects.forEach(node => dfs(node));
                    };
                    dfs(node);
                }
                nodeItems = nodeItems.map(item => {
                    if (item.init) item.init(item.item);
                    item.item.addHandler("trigger", item.trigger);
                    item.item.addHandler("contextmenu", item.contextmenu);
                    item.item.addHandler("drag", item.drag);
                    return item.item;
                });
                nodeItems = lib.search(nodeItems, ["node.path", "node.field.type"], this.query).map(nodeItemSelect);
                this.items = [
                    new Panel.AddTab.Header("Tools"),
                    ...toolItems,
                    new Panel.AddTab.Header("Tables and Topics"),
                    ...nodeItems,
                ];
            } else {
                this.items = [
                    new Panel.AddTab.Button("Tables", "folder-outline", "", true),
                    new Panel.AddTab.Button("Topics", "document-outline", "", true),
                    new Panel.AddTab.Button("All", "", "", true),
                    new Panel.AddTab.Divider(),
                    new Panel.AddTab.Header("Tools"),
                    new Panel.AddTab.Button("Tools", "hammer", "", true),
                    ...toolItems,
                ];
                this.items[0].addHandler("trigger", () => {
                    this.searchPart = "tables";
                });
                this.items[1].addHandler("trigger", () => {
                    this.searchPart = "topics";
                });
                this.items[2].iconSrc = "../assets/icons/variable.svg";
                this.items[2].addHandler("trigger", () => {
                    this.searchPart = "all";
                });
                this.items[5].addHandler("trigger", () => {
                    this.searchPart = "tools";
                });
            }
        } else if (this.searchPart == "tools") {
            this.tags = [new Panel.AddTab.Tag("Tools", "hammer")];
            this.placeholder = "Search tools";
            toolItems = lib.search(toolItems, ["name"], this.query).map(toolItemSelect);
            this.items = toolItems;
        } else if (["tables", "topics", "all"].includes(this.searchPart)) {
            this.tags = [new Panel.AddTab.Tag(
                util.formatText(this.searchPart),
                { tables: "folder-outline", topics: "document-outline", all: "" }[this.searchPart],
            )];
            if (this.searchPart == "all") this.tags[0].iconSrc = "../assets/icons/variable.svg";
            this.placeholder = "Search "+this.searchPart.toLowerCase();
            let items = [];
            if (this.hasPage() && this.page.hasSource()) {
                let node = this.page.source.tree;
                const dfs = node => {
                    let itm = new Panel.AddTab.NodeButton(node);
                    let btn = itm;
                    if ({
                        tables: !node.hasField(),
                        topics: node.hasField(),
                        all: true,
                    }[this.searchPart])
                        items.push({
                            item: itm,
                            trigger: () => {
                                if (!this.hasParent()) return;
                                let index = this.parent.tabs.indexOf(this);
                                this.parent.addTab(new Panel.BrowserTab(node.path), index);
                                this.parent.remTab(this);
                            },
                            contextmenu: e => {
                                let itm;
                                let menu = new core.App.Menu();
                                itm = menu.addItem(new core.App.Menu.Item("Open"));
                                itm.addHandler("trigger", e => {
                                    btn.post("trigger", e);
                                });
                                itm = menu.addItem(new core.App.Menu.Item("Start Dragging"));
                                itm.addHandler("trigger", e => {
                                    btn.post("drag", e);
                                });
                                if (!this.hasApp()) return;
                                this.app.contextMenu = menu;
                                this.app.placeContextMenu(e.pageX, e.pageY);
                            },
                            drag: () => {
                                if (!this.hasApp() || !this.hasPage()) return;
                                this.app.dragData = this.page.hasSource() ? this.page.source.tree.lookup(node.path) : null;
                                this.app.dragging = true;
                            },
                        });
                    node.nodeObjects.forEach(node => dfs(node));
                };
                dfs(node);
            }
            items = items.map(item => {
                if (item.init) item.init(item.item);
                item.item.addHandler("trigger", item.trigger);
                item.item.addHandler("contextmenu", item.contextmenu);
                item.item.addHandler("drag", item.drag);
                return item.item;
            });
            items = lib.search(items, ["node.path", "node.field.type"], this.query).map(nodeItemSelect);
            this.items = items;
        }
        this.eSearchInput.focus();
    }

    get searchPart() { return this.#searchPart; }
    set searchPart(v) {
        v = (v == null) ? null : String(v);
        if (this.searchPart == v) return;
        this.change("searchPart", this.searchPart, this.#searchPart=v);
        this.query = "";
        this.refresh();
    }
    hasSearchPart() { return this.searchPart != null; }

    get tags() { return [...this.#tags]; }
    set tags(v) {
        v = util.ensure(v, "arr");
        this.clearTags();
        this.addTag(v);
    }
    clearTags() {
        let tags = this.tags;
        this.remTag(tags);
        return tags;
    }
    hasTag(tag) {
        if (!(tag instanceof Panel.AddTab.Tag)) return false;
        return this.#tags.includes(tag);
    }
    addTag(...tags) {
        return util.Target.resultingForEach(tags, tag => {
            if (!(tag instanceof Panel.AddTab.Tag)) return false;
            if (this.hasTag(tag)) return false;
            this.#tags.push(tag);
            this.eSearchTags.appendChild(tag.elem);
            return tag;
        });
    }
    remTag(...tags) {
        return util.Target.resultingForEach(tags, tag => {
            if (!(tag instanceof Panel.AddTab.Tag)) return false;
            if (!this.hasTag(tag)) return false;
            this.#tags.splice(this.#tags.indexOf(tag), 1);
            this.eSearchTags.removeChild(tag.elem);
            return tag;
        });
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
        if (!(itm instanceof Panel.AddTab.Item)) return false;
        return this.#items.includes(itm);
    }
    addItem(...itms) {
        return util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof Panel.AddTab.Item)) return false;
            if (this.hasItem(itm)) return false;
            this.#items.push(itm);
            this.eContent.appendChild(itm.elem);
            itm.onAdd();
            return itm;
        });
    }
    remItem(...itms) {
        return util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof Panel.AddTab.Item)) return false;
            if (!this.hasItem(itm)) return false;
            itm.onRem();
            this.#items.splice(this.#items.indexOf(itm), 1);
            this.eContent.removeChild(itm.elem);
            return itm;
        });
    }

    get eSearch() { return this.#eSearch; }
    get eSearchTags() { return this.#eSearchTags; }
    get eSearchInput() { return this.#eSearchInput; }
    get eSearchClear() { return this.#eSearchClear; }
    get eContent() { return this.#eContent; }

    get placeholder() { return this.eSearchInput.placeholder; }
    set placeholder(v) { this.eSearchInput.placeholder = v; }

    get query() { return this.eSearchInput.value; }
    set query(v) {
        v = String(v);
        this.change("query", this.query, this.eSearchInput.value=v);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            searchPart: this.searchPart,
            query: this.query,
        });
    }
};
Panel.AddTab.Tag = class PanelAddTabTag extends util.Target {
    #elem;
    #eIcon;
    #eName;

    constructor(name, icon="") {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        let chevron = document.createElement("ion-icon");
        this.elem.appendChild(chevron);
        chevron.name = "chevron-forward";

        this.name = name;
        this.icon = icon;
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }
    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.children[0].getAttribute("src"); }
    set iconSrc(v) { this.eIcon.setAttribute("src", v); }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }
};
Panel.AddTab.Item = class PanelAddTabItem extends util.Target {
    #elem;

    constructor() {
        super();

        this.#elem = document.createElement("div");
    }

    get elem() { return this.#elem; }

    update(delta) { this.post("update", delta); }
};
Panel.AddTab.Header = class PanelAddTabHeader extends Panel.AddTab.Item {
    constructor(value) {
        super();

        this.elem.classList.add("header");

        this.value = value;
    }

    get value() { return this.elem.textContent; }
    set value(v) { this.elem.textContent = v; }
};
Panel.AddTab.Divider = class PanelAddTabDivider extends Panel.AddTab.Item {
    constructor() {
        super();

        this.elem.classList.add("divider");
    }
};
Panel.AddTab.Button = class PanelAddTabButton extends Panel.AddTab.Item {
    #nameIndices;
    #infoIndices;

    #btn;
    #eIcon;
    #eName;
    #eInfo;
    #eChevron;

    constructor(name, icon="", color="", hasChevron=false) {
        super();

        this.elem.classList.add("item");

        this.#nameIndices = null;
        this.#infoIndices = null;
        
        this.#btn = document.createElement("button");
        this.elem.appendChild(this.btn);
        this.#eIcon = document.createElement("ion-icon");
        this.btn.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.btn.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eInfo = document.createElement("div");
        this.btn.appendChild(this.eInfo);
        this.eInfo.classList.add("info");
        this.#eChevron = document.createElement("ion-icon");
        this.btn.appendChild(this.eChevron);
        this.eChevron.name = "chevron-forward";

        let cancel = 10;
        this.btn.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            this.post("trigger", e);
        });
        this.btn.addEventListener("contextmenu", e => {
            this.post("contextmenu", e);
        });
        this.btn.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = e => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                if (cancel > 0) return;
                this.post("drag");
            };
            const mousemove = e => {
                if (cancel > 0) return cancel--;
                mouseup();
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.name = name;
        this.icon = icon;
        this.iconColor = color;
        this.hasChevron = hasChevron;
    }

    get btn() { return this.#btn; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get eInfo() { return this.#eInfo; }
    get eChevron() { return this.#eChevron; }

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

    get name() { return this.eName.textContent; }
    set name(v) {
        this.eName.textContent = v;
        v = this.name;
        let indices = this.#nameIndices;
        if (indices == null) return;
        let chunks = [];
        indices.forEach((range, i) => {
            chunks.push(v.substring((i > 0) ? indices[i-1][1] : 0, range[0]));
            chunks.push(v.substring(...range));
        });
        chunks.push(v.substring((indices.length > 0) ? indices.at(-1)[1] : 0, v.length));
        this.eName.innerHTML = "";
        chunks.forEach((chunk, i) => {
            let elem = document.createElement("span");
            this.eName.appendChild(elem);
            elem.textContent = chunk;
            elem.style.color = (i%2 == 0) ? "var(--v5)" : "";
            elem.style.fontWeight = (i%2 == 0) ? "" : "bold";
        });
    }

    get info() { return this.eInfo.textContent; }
    set info(v) {
        this.eInfo.textContent = v;
        v = this.info;
        let indices = this.#infoIndices;
        if (indices == null) return;
        let chunks = [];
        indices.forEach((range, i) => {
            chunks.push(v.substring((i > 0) ? indices[i-1][1] : 0, range[0]));
            chunks.push(v.substring(...range));
        });
        chunks.push(v.substring((indices.length > 0) ? indices.at(-1)[1] : 0, v.length));
        this.eInfo.innerHTML = "";
        chunks.forEach((chunk, i) => {
            let elem = document.createElement("span");
            this.eInfo.appendChild(elem);
            elem.textContent = chunk;
            elem.style.opacity = (i%2 == 0) ? "50%" : "";
        });
    }

    selectName(indices) {
        if (indices != null) {
            indices = util.ensure(indices, "arr").map(range => util.ensure(range, "arr").map(v => util.ensure(v, "int")));
            indices = indices.filter(range => range.length == 2).map(range => [range[0], range[1]+1]).sort((a, b) => a[0]-b[0]);
            let indices2 = [];
            indices.forEach(range => {
                if (indices2.length <= 0 || range[0] > indices2.at(-1)[1])
                    return indices2.push(range);
                indices2.at(-1)[1] = range[1];
            });
            this.#nameIndices = indices2;
        }
        this.name = this.name;
    }
    selectInfo(indices) {
        if (indices != null) {
            indices = util.ensure(indices, "arr").map(range => util.ensure(range, "arr").map(v => util.ensure(v, "int")));
            indices = indices.filter(range => range.length == 2).map(range => [range[0], range[1]+1]).sort((a, b) => a[0]-b[0]);
            let indices2 = [];
            indices.forEach(range => {
                if (indices2.length <= 0 || range[0] > indices2.at(-1)[1])
                    return indices2.push(range);
                indices2.at(-1)[1] = range[1];
            });
            this.#infoIndices = indices2;
        }
        this.info = this.info;
    }

    get hasChevron() { return this.elem.contains(this.eChevron); }
    set hasChevron(v) {
        v = !!v;
        if (v == this.hasChevron) return;
        if (v) this.btn.appendChild(this.eChevron);
        else this.btn.removeChild(this.eChevron);
    }
};
Panel.AddTab.NodeButton = class PanelAddTabNodeButton extends Panel.AddTab.Button {
    #node;

    constructor(node) {
        super();

        this.elem.classList.remove("item");
        this.elem.classList.add("explorernode");
        this.btn.classList.add("display");
        let children = Array.from(this.btn.children);
        children.forEach(child => this.btn.removeChild(child));
        this.btn.innerHTML = "<div class='main'></div>";
        children.forEach(child => this.btn.children[0].appendChild(child));
        this.eInfo.classList.add("tag");

        const update = () => {
            if (!this.hasNode()) {
                this.icon = "document-outline";
                this.name = "?";
                return;
            }
            this.name = this.node.path;
            if (this.name.length <= 0) this.name = "/";
            this.info = util.ensure(this.node.hasField() ? this.node.field.clippedType : "", "str");
        };
        this.addHandler("change", update);

        this.addHandler("update", delta => {
            if (!this.hasNode()) return;
            let display = getDisplay(this.node.hasField() ? this.node.field.type : null, this.node.hasField() ? this.node.field.get() : null);
            if (display != null) {
                if ("src" in display) this.iconSrc = display.src;
                else this.icon = display.name;
                if ("color" in display) this.iconColor = display.color;
                else this.iconColor = "";
            } else {
                this.icon = "";
                this.iconColor = "";
            }
        });

        this.node = node;
    }

    get node() { return this.#node; }
    set node(v) {
        v = (v instanceof Source.Node) ? v : null;
        if (this.node == v) return;
        this.change("node", this.node, this.#node=v);
    }
    hasNode() { return !!this.node; }
};
Panel.BrowserTab = class PanelBrowserTab extends Panel.Tab {
    #path;

    #explorer;

    #ePath;
    #eDisplay;

    constructor(...a) {
        super();

        this.elem.classList.add("browser");

        this.#path = null;

        this.#explorer = new FieldExplorer();
        this.explorer.addHandler("trigger2", (e, path) => (this.path += "/"+path));
        this.explorer.addHandler("contextmenu", (e, path) => {
            e = util.ensure(e, "obj");
            let enode = this.explorer.lookup(path);
            if (!enode) return;
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item((enode.isJustPrimitive && enode.isOpen) ? "Close" : "Open"));
            itm.disabled = enode.isJustPrimitive;
            itm.addHandler("trigger", e => {
                enode.isOpen = !enode.isOpen;
            });
            itm = menu.addItem(new core.App.Menu.Item(enode.showValue ? "Hide Value" : "Show Value"));
            itm.disabled = !enode.hasType();
            itm.addHandler("trigger", e => {
                enode.showValue = !enode.showValue;
            });
            menu.addItem(new core.App.Menu.Divider());
            itm = menu.addItem(new core.App.Menu.Item("Start Dragging"));
            itm.addHandler("trigger", e => {
                enode.post("drag", e, enode.name);
            });
            if (!this.hasApp()) return;
            this.app.contextMenu = menu;
            this.app.placeContextMenu(e.pageX, e.pageY);
        });
        this.explorer.addHandler("drag", (e, path) => {
            path = util.generatePath(this.path+"/"+path);
            if (!this.hasApp() || !this.hasPage()) return;
            this.app.dragData = this.page.hasSource() ? this.page.source.tree.lookup(path) : null;
            this.app.dragging = true;
        });

        this.#ePath = document.createElement("div");
        this.elem.appendChild(this.ePath);
        this.ePath.classList.add("path");
        this.elem.appendChild(this.explorer.elem);
        this.#eDisplay = document.createElement("div");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");

        if (a.length <= 0 || a.length > 1) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.BrowserTab) a = [a.path];
            else if (util.is(a, "arr")) {
                a = new Panel.BrowserTab(...a);
                a = [a.path];
            }
            else if (util.is(a, "obj")) a = [a.path];
            else a = [a];
        }

        [this.path] = a;

        let prevNode = 0;
        let state = {};

        this.addHandler("update", delta => {
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            const node = source ? source.tree.lookup(this.path) : null;
            if (prevNode != node) {
                prevNode = node;
                state = {};
                this.name = node ? (node.name.length > 0) ? node.name : "/" : "?";
                if (node) {
                    if (!node.hasField() || node.field.isArray || node.field.isStruct) {
                        this.explorer.elem.classList.add("this");
                        this.eDisplay.classList.remove("this");
                    } else {
                        this.explorer.elem.classList.remove("this");
                        this.eDisplay.classList.add("this");
                    }
                    this.eTabName.style.color = "";
                } else {
                    this.explorer.elem.classList.remove("this");
                    this.eDisplay.classList.remove("this");
                    this.icon = "document-outline";
                    let path = this.path.split("/").filter(part => part.length > 0);
                    this.name = (path.length > 0) ? path.at(-1) : "/";
                    this.eTabName.style.color = "var(--cr)";
                    this.iconColor = "var(--cr)";
                }
            }
            if (!node) return;
            let display = getDisplay((node && node.hasField()) ? node.field.type : null, (node && node.hasField()) ? node.field.get() : null);
            if (display != null) {
                if ("src" in display) this.iconSrc = display.src;
                else this.icon = display.name;
                if ("color" in display) this.iconColor = display.color;
                else this.iconColor = "";
            } else {
                this.icon = "";
                this.iconColor = "";
            }
            if (this.isClosed) return;
            if (!node.hasField() || node.field.isArray || node.field.isStruct) {
                FieldExplorer.Node.doubleTraverse(
                    node.nodeObjects,
                    this.explorer.nodeObjects,
                    (...enodes) => this.explorer.add(...enodes),
                    (...enodes) => this.explorer.rem(...enodes),
                );
            } else {
                if (state.type != node.field.type) {
                    state.type = node.field.type;
                    this.eDisplay.innerHTML = "";
                    let item = document.createElement("div");
                    this.eDisplay.appendChild(item);
                    item.classList.add("item");
                    let eIcon = null, eType = null, eValue = null;
                    if (node.field.type == "boolean") {
                        item.innerHTML = "<ion-icon></ion-icon>";
                        eIcon = item.children[0];
                    } else {
                        item.innerHTML = "<div class='type'></div><div class='value'></div>";
                        eType = item.children[0];
                        eValue = item.children[1];
                    }
                    state.update = () => {
                        let value = node.field.get();
                        if (node.field.type == "boolean") {
                            item.style.backgroundColor = value ? "var(--cg3)" : "var(--cr3)";
                            eIcon.name = value ? "checkmark" : "close";
                            let r = item.getBoundingClientRect();
                            eIcon.style.fontSize = Math.max(16, Math.min(64, r.width-40, r.height-40))+"px";
                        } else {
                            eType.textContent = node.field.type;
                            let display = getDisplay(node.field.type, value);
                            eValue.style.color = (display == null) ? "" : util.ensure(display.color, "str");
                            eValue.style.fontSize = (["double", "float", "int"].includes(node.field.arrayType) ? 32 : 16)+"px";
                            eValue.textContent = getRepresentation(value, node.field.type == "structschema");
                        }
                    };
                }
                if (state.update) state.update();
            }
        });
    }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.ePath.innerHTML = "";
        let path = this.path.split("/").filter(part => part.length > 0);
        if (path.length > 0) {
            let btn = document.createElement("button");
            this.ePath.appendChild(btn);
            btn.classList.add("back");
            btn.classList.add("icon");
            btn.innerHTML = "<ion-icon name='chevron-back'></ion-icon>";
            btn.addEventListener("click", e => {
                e.stopPropagation();
                path.pop();
                this.path = path.join("/");
            });
        }
        for (let i = 0; i <= path.length; i++) {
            if (i > 1) {
                let divider = document.createElement("div");
                this.ePath.appendChild(divider);
                divider.classList.add("divider");
                divider.textContent = "/";
            }
            let pth = path.slice(0, i);
            let btn = document.createElement("button");
            this.ePath.appendChild(btn);
            btn.classList.add("item");
            btn.classList.add("override");
            btn.textContent = (i > 0) ? path[i-1] : "/";
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.path = pth.join("/");
            });
        }
    }

    get explorer() { return this.#explorer; }

    get ePath() { return this.#ePath; }
    get eDisplay() { return this.#eDisplay; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
        });
    }
};
Panel.ToolTab = class PanelToolTab extends Panel.Tab {
    constructor(dname, name) {
        super();

        this.elem.classList.add("tool");

        this.name = dname;
        
        let display = getTabDisplay(name);
        if (display != null) {
            if ("src" in display) this.iconSrc = display.src;
            else this.icon = display.name;
            if ("color" in display) this.iconColor = display.color;
            else this.iconColor = "";
        }
    }
};
Panel.TableTab = class PanelTableTab extends Panel.ToolTab {
    #vars;
    #ts;
    #tsNow;
    #tsOverride;

    #eSide;
    #eSideHeader;
    #eTSInput;
    #eFollowBtn;

    constructor(...a) {
        super("Table", "table");

        this.elem.classList.add("table");

        this.#vars = [];
        this.#ts = [];
        this.#tsNow = 0;

        this.#eSide = document.createElement("div");
        this.elem.appendChild(this.eSide);
        this.eSide.classList.add("column");
        this.eSide.classList.add("side");
        this.#eSideHeader = document.createElement("div");
        this.eSide.appendChild(this.eSideHeader);
        this.eSideHeader.classList.add("header");

        this.#eTSInput = document.createElement("input");
        this.eSideHeader.appendChild(this.eTSInput);
        this.eTSInput.type = "number";
        this.eTSInput.placeholder = "Timestamp...";
        this.eTSInput.step = 0.01;
        this.#eFollowBtn = document.createElement("button");
        this.eSideHeader.appendChild(this.eFollowBtn);
        this.eFollowBtn.innerHTML = "<ion-icon src='../assets/icons/jump.svg'></ion-icon>";

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.TableTab) a = [a.vars, a.tsNow, a.tsOverride];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof Panel.TableTab.Variable) a = [a, 0];
                else {
                    a = new Panel.TableTab(...a);
                    a = [a.vars, a.tsNow, a.tsOverride];
                }
            }
            else if (util.is(a, "obj")) a = [a.vars, a.tsNow, a.tsOverride];
            else a = [[], 0];
        }
        if (a.length == 2)
            a = [...a, false];

        [this.vars, this.tsNow, this.tsOverride] = a;

        this.eTSInput.addEventListener("change", e => {
            let v = this.eTSInput.value;
            if (v.length <= 0) return;
            v = parseFloat(v);
            if (!this.tsOverride) {
                if (this.hasPage() && this.page.hasSource())
                    this.page.source.ts = v;
            }
            else this.tsNow = v;
        });
        this.eFollowBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.tsOverride = !this.tsOverride;
        });

        const bSearch = (arr, v) => {
            let l = 0, r = arr.length-1;
            while (l <= r) {
                let m = Math.floor((l+r)/2);
                if (arr[m] == v) return m;
                if (arr[m] > v) r = m-1;
                else l = m+1;
            }
            return -1;
        };

        let entries = [];
        this.addHandler("update", delta => {
            if (this.isClosed) return;
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            if (!this.tsOverride) this.tsNow = source ? source.ts : 0;
            let ts = new Set();
            this.vars.forEach(v => {
                v.node = source ? source.tree.lookup(v.path) : null;
                if (!v.hasNode() || !v.node.hasField()) return;
                let valueLog = v.node.field.valueLog;
                valueLog.forEach(log => ts.add(log.ts));
            });
            this.#ts = ts = [...ts].sort((a, b) => a-b);
            this.vars.forEach(v => v.update(delta));
            while (entries.length < ts.length) {
                let elem = document.createElement("div");
                this.eSide.appendChild(elem);
                elem.classList.add("entry");
                entries.push(elem);
            }
            while (entries.length > ts.length) {
                let elem = entries.pop();
                this.eSide.removeChild(elem);
            }
            for (let i = 0; i < ts.length; i++) {
                let elem = entries[i];
                elem.textContent = ts[i];
                let v = (
                    this.tsNow >= ts[i] &&
                    this.tsNow < ((i+1 >= ts.length) ? Infinity : ts[i+1])
                );
                if (v == elem.classList.contains("this")) continue;
                if (v) elem.classList.add("this");
                else elem.classList.remove("this");
            }
        });
    }

    get vars() { return [...this.#vars]; }
    set vars(v) {
        v = util.ensure(v, "arr");
        this.clearVars();
        v.forEach(v => this.addVar(v));
    }
    clearVars() {
        let vars = this.vars;
        vars.forEach(v => this.remVar(v));
        return vars;
    }
    hasVar(v) {
        if (!(v instanceof Panel.TableTab.Variable)) return false;
        return this.#vars.includes(v) && v.tab == this;
    }
    insertVar(v, at) {
        if (!(v instanceof Panel.TableTab.Variable)) return false;
        if (v.tab != null) return false;
        if (this.hasVar(v)) return false;
        at = Math.min(this.vars.length, Math.max(0, util.ensure(at, "int")));
        this.#vars.splice(at, 0, v);
        v.tab = this;
        this.elem.appendChild(v.elem);
        v.addLinkedHandler(this, "remove", () => this.remVar(v));
        v.addLinkedHandler(this, "change", (c, f, t) => this.change("vars["+this.#vars.indexOf(v)+"]."+c, f, t));
        v.addLinkedHandler(this, "drag", () => {
            if (!this.hasPage() || !this.page.hasSource() || !this.hasApp()) return;
            this.app.dragData = this.page.source.tree.lookup(v.path);
            this.app.dragging = true;
            v.post("remove");
        });
        this.change("insertVar", null, v);
        v.onAdd();
        return v;
    }
    addVar(v) { return this.insertVar(v, this.vars.length); }
    remVar(v) {
        if (!(v instanceof Panel.TableTab.Variable)) return false;
        if (v.tab != this) return false;
        if (!this.hasVar(v)) return false;
        v.onRem();
        this.#vars.splice(this.#vars.indexOf(v), 1);
        v.tab = null;
        this.elem.removeChild(v.elem);
        v.clearLinkedHandlers(this, "remove");
        v.clearLinkedHandlers(this, "change");
        v.clearLinkedHandlers(this, "drag");
        this.change("remVar", v, null);
        return v;
    }

    get ts() { return [...this.#ts]; }
    lookupTS(ts) {
        ts = util.ensure(ts, "num");
        if (this.#ts.length <= 0) return -1;
        if (ts < this.#ts.at(0)) return -1;
        if (ts >= this.#ts.at(-1)) return this.#ts.length-1;
        let l = 0, r = this.#ts.length-2;
        while (l <= r) {
            let m = Math.floor((l+r)/2);
            let range = [this.#ts[m], this.#ts[m+1]];
            if (ts < range[0]) r = m-1;
            else if (ts >= range[1]) l = m+1;
            else return m;
        }
        return -1;
    }
    get tsNow() { return this.#tsNow; }
    set tsNow(v) {
        v = util.ensure(v, "num");
        if (this.tsNow == v) return;
        if (this.tsOverride) this.change("tsNow", this.tsNow, this.#tsNow=v);
        else this.#tsNow = v;
        this.eTSInput.value = this.tsNow;
    }
    get tsOverride() { return this.#tsOverride; }
    set tsOverride(v) {
        v = !!v;
        if (this.tsOverride == v) return;
        this.change("tsOverride", this.tsOverride, this.#tsOverride=v);
        if (this.tsOverride) this.eFollowBtn.classList.remove("this");
        else this.eFollowBtn.classList.add("this");
    }

    get eSide() { return this.#eSide; }
    get eSideHeader() { return this.#eSideHeader; }
    get eTSInput() { return this.#eTSInput; }
    get eFollowBtn() { return this.#eFollowBtn; }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        let r;
        r = this.elem.getBoundingClientRect();
        if (pos.x < r.left || pos.x > r.right) return null;
        if (pos.y < r.top || pos.y > r.bottom) return null;
        if (data instanceof Panel.BrowserTab) data = (this.hasPage() && this.page.hasSource()) ? this.page.source.tree.lookup(data.path) : null;
        if (!(data instanceof Source.Node)) return null;
        if (!data.hasField()) return null;
        let y = r.top, h = r.height;
        let at = 0;
        const addVar = node => {
            let pth = node.path;
            if (node.hasField() && node.field.isJustPrimitive) {
                this.insertVar(new Panel.TableTab.Variable(pth), at);
                at++;
            }
            node.nodeObjects.forEach(node => addVar(node));
        };
        let vars = this.vars;
        for (let i = 0; i <= vars.length; i++) {
            if (vars.length <= 0) break;
            if (i <= 0) {
                r = vars.at(0).elem.getBoundingClientRect();
                if (pos.x < r.left+r.width/2) return {
                    r: [[r.left, y], [0, h]],
                    submit: () => {
                        at = i;
                        addVar(data);
                    },
                };
                continue;
            }
            if (i >= vars.length) {
                r = vars.at(-1).elem.getBoundingClientRect();
                if (pos.x >= r.left+r.width/2) return {
                    r: [[r.right, y], [0, h]],
                    submit: () => {
                        at = i;
                        addVar(data);
                    },
                };
                continue;
            }
            let rj = vars[i-1].elem.getBoundingClientRect(), ri = vars[i].elem.getBoundingClientRect();
            if (pos.x < rj.left+rj.width/2) continue;
            if (pos.x >= ri.left+ri.width/2) continue;
            return {
                r: [[ri.left, y], [0, h]],
                submit: () => {
                    at = i;
                    addVar(data);
                },
            };
        }
        r = this.eSide.getBoundingClientRect();
        return {
            r: [[r.right, y], [0, h]],
            submit: () => {
                at = 0;
                addVar(data);
            },
        };
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            vars: this.vars,
            tsNow: this.tsNow,
            tsOverride: this.tsOverride,
        });
    }
};
Panel.TableTab.Variable = class PanelTableTabVariable extends util.Target {
    #tab;

    #path;

    #node;

    #elem;
    #eHeader;

    constructor(...a) {
        super();

        this.#tab = null;

        this.#path = "";

        this.#node = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("column");
        this.#eHeader = document.createElement("div");
        this.elem.appendChild(this.eHeader);
        this.eHeader.classList.add("header");

        this.eHeader.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            let trigger = 0;
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                trigger++;
                if (trigger < 10) return;
                mouseup();
                this.post("drag", e);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        if (a.length <= 0 || a.length > 1) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.TableTab.Variable) a = [a.path];
            else if (util.is(a, "arr")) {
                a = [new Panel.GraphTab.Variable(...a).path];
            }
            else if (util.is(a, "obj")) a = [a.path];
            else a = [a];
        }

        [this.path] = a;

        let entries = [];
        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            let valueLog = (this.hasNode() && this.node.hasField() && this.node.field.isJustPrimitive) ? this.node.field.valueLog : [];
            while (entries.length < valueLog.length) {
                let entry = {};
                let elem = entry.elem = document.createElement("div");
                this.elem.appendChild(elem);
                elem.classList.add("entry");
                let valueTS = entry.valueTS = document.createElement("div");
                elem.appendChild(valueTS);
                valueTS.classList.add("value");
                valueTS.classList.add("ts");
                let value = entry.value = document.createElement("div");
                elem.appendChild(value);
                value.classList.add("value");
                entries.push(entry);
            }
            while (entries.length > valueLog.length) {
                let entry = entries.pop();
                this.elem.removeChild(entry.elem);
            }
            for (let i = 0; i < valueLog.length; i++) {
                let entry = entries[i];
                let j1 = this.tab.lookupTS(valueLog[i].ts);
                if (i <= 0) entry.elem.style.marginTop = (j1*30)+"px";
                let j2 = (i+1 >= valueLog.length) ? this.tab.ts.length : this.tab.lookupTS(valueLog[i+1].ts);
                let j3 = this.tab.lookupTS(this.tab.tsNow);
                entry.elem.style.height = entry.elem.style.maxHeight = ((j2-j1)*30)+"px";
                entry.value.textContent = entry.valueTS.textContent = valueLog[i].v;
                entry.valueTS.style.top = (Math.max(0, Math.min(j2-j1-1, j3-j1))*30)+"px";
                let v = (
                    this.tab.tsNow >= valueLog[i].ts &&
                    this.tab.tsNow < ((i+1 >= valueLog.length) ? Infinity : valueLog[i+1].ts)
                );
                if (v == entry.elem.classList.contains("this")) continue;
                if (v) entry.elem.classList.add("this");
                else entry.elem.classList.remove("this");
            }
        });
    }

    get tab() { return this.#tab; }
    set tab(v) {
        v = (v instanceof Panel.TableTab) ? v : null;
        if (this.tab == v) return;
        this.#tab = v;
    }
    hasTab() { return !!this.tab; }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        let path = this.path.split("/").filter(part => part.length > 0);
        this.eHeader.innerHTML = "";
        let name = document.createElement("div");
        this.eHeader.appendChild(name);
        name.textContent = (path.length > 0) ? path.at(-1) : "/";
        let tooltip = document.createElement("div");
        this.eHeader.appendChild(tooltip);
        tooltip.classList.add("tooltip");
        tooltip.classList.add("hov");
        tooltip.classList.add("swx");
        tooltip.textContent = "/"+this.path;
        let removeBtn = document.createElement("button");
        this.eHeader.appendChild(removeBtn);
        removeBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        removeBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove");
        });
        removeBtn.addEventListener("mousedown", e => {
            e.stopPropagation();
        });
    }

    get node() { return this.#node; }
    set node(v) {
        v = (v instanceof Source.Node) ? v : null;
        if (this.node == v) return;
        this.#node = v;
    }
    hasNode() { return !!this.node; }

    get elem() { return this.#elem; }
    get eHeader() { return this.#eHeader; }

    update(delta) { this.post("update", delta); }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
        });
    }
};
Panel.WebViewTab = class PanelWebViewTab extends Panel.ToolTab {
    #src;

    #eNav;
    #eBackBtn;
    #eForwardBtn;
    #eLoadBtn;
    #eSrcInput;
    #eWebView;

    constructor(...a) {
        super("WebView", "webview");

        this.elem.classList.add("webview");

        this.#src = "";

        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");
        this.#eBackBtn = document.createElement("button");
        this.eNav.appendChild(this.eBackBtn);
        this.eBackBtn.innerHTML = "<ion-icon name='arrow-back'></ion-icon>";
        this.#eForwardBtn = document.createElement("button");
        this.eNav.appendChild(this.eForwardBtn);
        this.eForwardBtn.innerHTML = "<ion-icon name='arrow-forward'></ion-icon>";
        this.#eLoadBtn = document.createElement("button");
        this.eNav.appendChild(this.eLoadBtn);
        this.eLoadBtn.innerHTML = "<ion-icon></ion-icon>";
        this.#eSrcInput = document.createElement("input");
        this.eNav.appendChild(this.eSrcInput);
        this.eSrcInput.type = "text";
        this.eSrcInput.placeholder = "URL";
        this.#eWebView = document.createElement("webview");
        this.elem.appendChild(this.eWebView);
        this.eWebView.setAttribute("src", "https://www.example.com");

        if (a.length > 1 || a.length <= 0) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.WebViewTab) a = [a.src];
            else if (util.is(a, "arr")) a = [new Panel.WebViewTab(...a).src];
            else if (util.is(a, "obj")) a = [a.src];
            else a = [""];
        }

        [this.src] = a;

        this.eBackBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!ready) return;
            this.eWebView.goBack();
        });
        this.eForwardBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!ready) return;
            this.eWebView.goForward();
        });
        this.eLoadBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!ready) return;
            if (this.eWebView.isLoading()) this.eWebView.stop();
            else this.eWebView.reload();
        });
        this.eSrcInput.addEventListener("change", e => (this.src = this.eSrcInput.value));

        let ready = false;
        this.eWebView.addEventListener("dom-ready", () => (ready = true));
        this.addHandler("rem", () => (ready = false));

        let src = null;

        this.addHandler("update", delta => {
            if (!ready || !document.body.contains(this.eWebView)) return;
            if (this.isOpen) {
                if (document.activeElement != this.eSrcInput)
                    this.eSrcInput.value = this.eWebView.getURL();
                if (this.eLoadBtn.children[0])
                    this.eLoadBtn.children[0].name = this.eWebView.isLoading() ? "close" : "refresh";
                this.eBackBtn.disabled = !this.eWebView.canGoBack();
                this.eForwardBtn.disabled = !this.eWebView.canGoForward();
            }
            if (this.eWebView.isLoading()) return;
            if (src == this.src) return;
            src = this.src;
            this.eWebView.loadURL(this.src);
        });
    }

    get src() { return this.#src; }
    set src(v) {
        v = String(v);
        if (this.src == v) return;
        this.change("src", this.src, this.#src=v);
    }

    get eNav() { return this.#eNav; }
    get eBackBtn() { return this.#eBackBtn; }
    get eForwardBtn() { return this.#eForwardBtn; }
    get eLoadBtn() { return this.#eLoadBtn; }
    get eSrcInput() { return this.#eSrcInput; }
    get eWebView() { return this.#eWebView; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            src: this.src,
        });
    }
};
Panel.ScoutTab = class PanelScoutTab extends Panel.ToolTab {
    #eWebView;

    constructor() {
        super("Scout", "scout");

        this.elem.classList.add("scout");

        this.#eWebView = document.createElement("webview");
        this.elem.appendChild(this.eWebView);
        (async () => {
            const scoutURL = await window.api.get("scout-url");
            this.eWebView.setAttribute("src", scoutURL);
        })();
    }

    get eWebView() { return this.#eWebView; }
};
Panel.LoggerTab = class PanelLoggerTab extends Panel.ToolTab {
    #logs;

    #eStatusBox;
    #eStatus;
    #eUploadBtn;
    #eLogs;

    constructor() {
        super("Logger", "logger");

        this.elem.classList.add("logger");

        this.#logs = new Set();

        this.#eStatusBox = document.createElement("div");
        this.elem.appendChild(this.eStatusBox);
        this.eStatusBox.classList.add("status");
        let eIcon = document.createElement("ion-icon");
        this.eStatusBox.appendChild(eIcon);
        this.#eStatus = document.createElement("a");
        this.eStatusBox.appendChild(this.eStatus);
        let space = document.createElement("div");
        this.eStatusBox.appendChild(space);
        space.classList.add("space");
        this.#eUploadBtn = document.createElement("button");
        this.eStatusBox.appendChild(this.eUploadBtn);
        this.eUploadBtn.classList.add("icon");
        this.eUploadBtn.classList.add("special");
        this.eUploadBtn.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.#eLogs = document.createElement("div");
        this.elem.appendChild(this.eLogs);
        this.eLogs.classList.add("logs");

        this.eUploadBtn.addEventListener("click", async e => {
            e.stopPropagation();
            if (LOGGERCONTEXT.disconnected) return;
            let result = await App.fileOpenDialog({
                title: "Choose a WPILOG log file",
                buttonLabel: "Upload",
                filters: [{
                    name: "WPILOG",
                    extensions: ["wpilog"],
                }],
                properties: [
                    "openFile",
                    "multiSelections",
                ],
            });
            result = util.ensure(result, "obj");
            if (result.canceled) return;
            const names = await LOGGERCONTEXT.logsCache(result.filePaths);
            await LOGGERCONTEXT.logsUpload(names);
        });

        this.addHandler("format", () => {
            this.logs.sort((a, b) => util.compareStr(a.name, b.name)).forEach((log, i) => {
                log.elem.style.order = i;
            });
        });

        this.addHandler("log-download", async name => {
            name = String(name);
            if (LOGGERCONTEXT.disconnected) return;
            if (!LOGGERCONTEXT.hasServerLog(name)) return;
            try {
                await LOGGERCONTEXT.logsDownload([name]);
            } catch (e) {
                if (this.hasApp())
                    this.app.doError("Log Download Error", "LogName: "+name, e);
            }
        });
        this.addHandler("log-trigger2", (e, name) => {
            name = String(name);
            if (!LOGGERCONTEXT.hasClientLog(name)) return;
            if (!this.hasPage()) return;
            const page = this.page;
            if (!page.hasProject()) return;
            page.project.config.sourceType = "wpilog";
            page.project.config.source = LOGGERCONTEXT.getClientPath(name);
            page.update(0);
            if (!this.hasApp()) return;
            this.app.post("cmd-action");
        });
        let selected = new Set(), lastSelected = null, lastAction = null;
        this.addHandler("log-trigger", (e, name, shift) => {
            name = String(name);
            shift = !!shift;
            if (!LOGGERCONTEXT.hasLog(name)) return;
            if (shift && LOGGERCONTEXT.hasLog(lastSelected)) {
                let logs = LOGGERCONTEXT.logs.sort(util.compareStr);
                let i = logs.indexOf(lastSelected);
                let j = logs.indexOf(name);
                for (let k = i;; k += (j>i?+1:j<i?-1:0)) {
                    if (lastAction == -1) selected.delete(logs[k]);
                    if (lastAction == +1) selected.add(logs[k]);
                    if (k == j) break;
                }
            } else {
                lastSelected = name;
                if (selected.has(name)) {
                    selected.delete(name);
                    lastAction = -1;
                } else {
                    selected.add(name);
                    lastAction = +1;
                }
            }
        });
        const contextMenu = e => {
            let names = [...selected];
            let anyClientHas = false, anyServerHas = false;
            names.forEach(name => LOGGERCONTEXT.hasClientLog(name) ? (anyClientHas = true) : null);
            names.forEach(name => LOGGERCONTEXT.hasServerLog(name) ? (anyServerHas = true) : null);
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item("Upload"));
            itm.addHandler("trigger", e => {
                this.eUploadBtn.click();
            });
            itm = menu.addItem(new core.App.Menu.Item("Upload Selected"));
            itm.disabled = names.length <= 0 || !anyClientHas;
            itm.addHandler("trigger", e => {
                LOGGERCONTEXT.logsUpload(names);
            });
            menu.addItem(new core.App.Menu.Divider());
            itm = menu.addItem(new core.App.Menu.Item("Open"));
            itm.disabled = names.length != 1;
            itm.addHandler("trigger", e => {
                this.post("log-trigger2", e, names[0]);
            });
            itm = menu.addItem(new core.App.Menu.Item("Download"));
            itm.disabled = names.length <= 0;
            itm.addHandler("trigger", e => {
                names.forEach(name => this.post("log-download", name));
            });
            menu.addItem(new core.App.Menu.Divider());
            itm = menu.addItem(new core.App.Menu.Item("Delete locally"));
            itm.disabled = !anyClientHas;
            itm.addHandler("trigger", e => {
                this.post("log-client-delete", names);
            });
            itm = menu.addItem(new core.App.Menu.Item("Delete from server"));
            itm.disabled = !anyServerHas;
            itm.addHandler("trigger", e => {
                this.post("log-server-delete", names);
            });
            if (!this.hasApp()) return;
            this.app.contextMenu = menu;
            e = util.ensure(e, "obj");
            this.app.placeContextMenu(e.pageX, e.pageY);
        };
        this.addHandler("log-contextmenu", (e, name) => {
            if (selected.size == 1) this.post("log-trigger", e, [...selected][0]);
            if (selected.size == 0) this.post("log-trigger", e, name);
            contextMenu(e);
        });
        this.addHandler("log-client-delete", async names => {
            names = util.ensure(names, "arr").map(name => String(name));
            names = names.filter(name => LOGGERCONTEXT.hasClientLog(name));
            await LOGGERCONTEXT.logsClientDelete(names);
        });
        this.addHandler("log-server-delete", async names => {
            names = util.ensure(names, "arr").map(name => String(name));
            if (LOGGERCONTEXT.disconnected) return;
            names = names.filter(name => LOGGERCONTEXT.hasServerLog(name));
            let pop = this.app.confirm("Delete Logs", "Are you sure you want to delete these logs from the server?\nThis will remove the logs for everyone");
            pop.infos = [names.join("\n")];
            let result = await pop.whenResult();
            if (!result) return;
            try {
                await LOGGERCONTEXT.logsServerDelete(names);
            } catch (e) {
                if (this.hasApp())
                    this.app.doError("Log Delete Error", "Names:", names.join("\n"), e);
            }
        });

        this.eLogs.addEventListener("click", e => {
            e.stopPropagation();
            selected.clear();
            lastSelected = null;
            lastAction = null;
        });
        this.eLogs.addEventListener("contextmenu", contextMenu);

        let logObjects = {};

        let pub = null;

        this.addHandler("update", delta => {
            if (this.isClosed) return;

            if (pub != window.agent().public) {
                pub = window.agent().public;
                if (pub) {
                    this.elem.style.opacity = "50%";
                    this.elem.style.pointerEvents = "none";
                } else {
                    this.elem.style.opacity = "";
                    this.elem.style.pointerEvents = "";
                }
            }

            this.eUploadBtn.disabled = !LOGGERCONTEXT.hasLocation() || LOGGERCONTEXT.disconnected;
            this.status = LOGGERCONTEXT.hasLocation() ? LOGGERCONTEXT.connected ? LOGGERCONTEXT.location : "Connecting to "+LOGGERCONTEXT.location : "Missing Location";
            if (LOGGERCONTEXT.hasLocation() && LOGGERCONTEXT.connected) {
                eIcon.name = "cloud";
                this.eStatus.setAttribute("href", LOGGERCONTEXT.location);
            } else {
                eIcon.name = "cloud-offline";
                this.eStatus.removeAttribute("href");
            }
            this.loading = LOGGERCONTEXT.isLoading("§caching");

            let logs = LOGGERCONTEXT.logs;
            logs.forEach(name => {
                if (name in logObjects) return;
                logObjects[name] = this.addLog(new Panel.LoggerTab.Log(name));
            });
            Object.keys(logObjects).forEach(name => {
                if (logs.includes(name)) return;
                this.remLog(logObjects[name]);
                delete logObjects[name];
            });
            [...selected].forEach(name => {
                if (LOGGERCONTEXT.hasLog(name)) return;
                selected.delete(name);
            });

            this.logs.forEach(log => {
                log.downloaded = LOGGERCONTEXT.hasClientLog(log.name);
                log.deprecated = !LOGGERCONTEXT.hasServerLog(log.name);
                log.loading = LOGGERCONTEXT.isLoading(log.name);
                log.selected = selected.has(log.name);
            });
        });
    }

    get logs() { return [...this.#logs]; }
    set logs(v) {
        v = util.ensure(v, "arr");
        this.clearLogs();
        this.addLog(v);
    }
    clearLogs() {
        let logs = this.logs;
        this.remLog(logs);
        return logs;
    }
    hasLog(log) {
        if (!(log instanceof Panel.LoggerTab.Log)) return false;
        return this.#logs.has(log);
    }
    addLog(...logs) {
        let r = util.Target.resultingForEach(logs, log => {
            if (!(log instanceof Panel.LoggerTab.Log)) return false;
            if (this.hasLog(log)) return false;
            this.#logs.add(log);
            log.addLinkedHandler(this, "download", () => this.post("log-download", log.name));
            log.addLinkedHandler(this, "trigger", e => this.post("log-trigger", e, log.name, !!(util.ensure(e, "obj").shiftKey)));
            log.addLinkedHandler(this, "trigger2", e => this.post("log-trigger2", e, log.name));
            log.addLinkedHandler(this, "contextmenu", e => this.post("log-contextmenu", e, log.name));
            this.eLogs.appendChild(log.elem);
            log.onAdd();
            return log;
        });
        this.format();
        return r;
    }
    remLog(...logs) {
        return util.Target.resultingForEach(logs, log => {
            if (!(log instanceof Panel.LoggerTab.Log)) return false;
            if (!this.hasLog(log)) return false;
            log.onRem();
            this.#logs.delete(log);
            log.clearLinkedHandlers(this, "download");
            log.clearLinkedHandlers(this, "trigger");
            log.clearLinkedHandlers(this, "trigger2");
            log.clearLinkedHandlers(this, "contextmenu");
            this.eLogs.removeChild(log.elem);
            return log;
        });
    }

    get loading() { return this.elem.classList.contains("loading_"); }
    set loading(v) {
        v = !!v;
        if (this.loading == v) return;
        if (v) this.elem.classList.add("loading_");
        else this.elem.classList.remove("loading_");
    }

    get eStatusBox() { return this.#eStatusBox; }
    get eStatus() { return this.#eStatus; }
    get status() { return this.eStatus.textContent; }
    set status(v) { this.eStatus.textContent = v; }
    get eUploadBtn() { return this.#eUploadBtn; }

    get eLogs() { return this.#eLogs; }
};
Panel.LoggerTab.Log = class PanelLoggerTabLog extends util.Target {
    #elem;
    #eName;
    #eNav;
    #eDownloadBtn;
    #eUseBtn;

    constructor(name) {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        this.eName.classList.add("name");
        let space = document.createElement("div");
        this.elem.appendChild(space);
        space.classList.add("space");
        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");
        this.#eDownloadBtn = document.createElement("button");
        this.eNav.appendChild(this.eDownloadBtn);
        this.eDownloadBtn.innerHTML = "<ion-icon name='download-outline'></ion-icon>";
        this.#eUseBtn = document.createElement("button");
        this.eNav.appendChild(this.eUseBtn);
        this.eUseBtn.innerHTML = "<ion-icon name='open-outline'></ion-icon>";

        this.eDownloadBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.deprecated) this.post("download");
        });
        this.eUseBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (this.downloaded) this.post("trigger2");
        });
        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
        });
        this.elem.addEventListener("dblclick", e => {
            if (this.downloaded) this.post("trigger2");
            else if (!this.deprecated) this.post("download");
        });
        this.elem.addEventListener("contextmenu", e => {
            e.preventDefault();
            e.stopPropagation();
            this.post("contextmenu", e);
        });

        this.name = name;
    }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }
    get eNav() { return this.#eNav; }
    get eDownloadBtn() { return this.#eDownloadBtn; }
    get eUseBtn() { return this.#eUseBtn; }

    get downloaded() { return this.elem.classList.contains("downloaded"); }
    set downloaded(v) {
        v = !!v;
        if (this.downloaded == v) return;
        if (v) this.elem.classList.add("downloaded");
        else this.elem.classList.remove("downloaded");
        this.eUseBtn.style.display = v ? "" : "none";
    }
    get deprecated() { return this.elem.classList.contains("deprecated"); }
    set deprecated(v) {
        v = !!v;
        if (this.deprecated == v) return;
        if (v) this.elem.classList.add("deprecated");
        else this.elem.classList.remove("deprecated");
        this.eDownloadBtn.style.display = v ? "none" : "";
    }
    get loading() { return this.elem.classList.contains("loading_"); }
    set loading(v) {
        v = !!v;
        if (this.loading == v) return;
        if (v) this.elem.classList.add("loading_");
        else this.elem.classList.remove("loading_");
        Array.from(this.eNav.querySelectorAll(":scope > button")).forEach(btn => (btn.disabled = v));
    }
    get selected() { return this.elem.classList.contains("selected"); }
    set selected(v) {
        v = !!v;
        if (this.selected == v) return;
        if (v) this.elem.classList.add("selected");
        else this.elem.classList.remove("selected");
    }
};
Panel.LogWorksTab = class PanelLogWorksTab extends Panel.ToolTab {
    #actions;
    #actionPage;

    #eActions;

    constructor(...a) {
        super("LogWorks", "logworks");

        this.elem.classList.add("logworks");

        this.#actions = new Set();
        this.#actionPage = 0;

        this.#eActions = document.createElement("div");
        this.elem.appendChild(this.eActions);
        this.eActions.classList.add("actions");

        this.addAction(new Panel.LogWorksTab.Action(this, "merge"));
        this.addAction(new Panel.LogWorksTab.Action(this, "export"));

        this.actionPage = null;

        if (a.length <= 0 || a.length > 1) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.LogWorksTab) a = [a.actionPage];
            else if (util.is(a, "arr")) a = [new Panel.LogWorksTab(...a).actionPage];
            else if (util.is(a, "obj")) a = [a.actionPage];
            else a = [a];
        }

        [this.actionPage] = a;

        this.addHandler("update", delta => this.actions.forEach(action => action.update(delta)));
    }

    compute() {
        super.compute();
        try {
            this.actions.forEach(action => action.compute());
        } catch (e) {}
    }

    get actions() { return [...this.#actions]; }
    set actions(v) {
        v = util.ensure(v, "arr");
        this.clearActions();
        this.addAction(v);
    }
    clearActions() {
        let actions = this.actions;
        this.remAction(actions);
        return actions;
    }
    hasAction(action) {
        if (!(action instanceof Panel.LogWorksTab.Action)) return false;
        return this.#actions.has(action) && action.tab == this;
    }
    addAction(...actions) {
        return util.Target.resultingForEach(actions, action => {
            if (!(action instanceof Panel.LogWorksTab.Action)) return false;
            if (action.tab != this) return false;
            if (this.hasAction(action)) return false;
            this.#actions.add(action);
            this.elem.appendChild(action.elem);
            this.eActions.appendChild(action.eBtn);
            action.onAdd();
            return action;
        });
    }
    remAction(...actions) {
        return util.Target.resultingForEach(actions, action => {
            if (!(action instanceof Panel.LogWorksTab.Action)) return false;
            if (action.tab != this) return false;
            if (!this.hasAction(action)) return false;
            action.onRem();
            this.#actions.delete(action);
            this.elem.removeChild(action.elem);
            this.eActions.removeChild(action.eBtn);
            return action;
        });
    }

    get actionPage() { return this.#actionPage; }
    set actionPage(v) {
        v = (v == null) ? null : String(v);
        if (this.actionPage == v) return;
        this.change("actionPage", this.actionPage, this.#actionPage=v);
        if (this.hasActionPage()) this.elem.classList.remove("home");
        else this.elem.classList.add("home");
        this.actions.forEach(action => {
            if (action.name == this.actionPage) action.show();
            else action.hide();
        });
    }
    hasActionPage() { return this.actionPage != null; }

    get eActions() { return this.#eActions; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            actionPage: this.actionPage,
        });
    }
};
Panel.LogWorksTab.Action = class PanelLogWorksTabAction extends util.Target {
    #tab;
    #parent;
    #page;
    #app;

    #name;
    #state;    

    #eBtn;
    #eIcon;
    #eName;
    #elem;
    #eHeader;
    #eBackBtn;
    #eTitle;
    #eContent;

    constructor(tab, name) {
        super();

        if (!(tab instanceof Panel.LogWorksTab)) throw new Error("Tab is not of class LogWorksTab");
        this.#tab = tab;
        this.compute();

        this.#name = String(name);
        this.#state = new util.Target();

        this.#eBtn = document.createElement("button");
        this.eBtn.classList.add("normal");
        this.#eIcon = document.createElement("ion-icon");
        this.eBtn.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.eBtn.appendChild(this.eName);

        this.#elem = document.createElement("div");
        this.elem.classList.add("action");
        this.elem.classList.add(this.name);
        this.#eHeader = document.createElement("div");
        this.elem.appendChild(this.eHeader);
        this.eHeader.classList.add("header");
        this.#eBackBtn = document.createElement("button");
        this.eHeader.appendChild(this.eBackBtn);
        this.eBackBtn.classList.add("icon");
        this.eBackBtn.innerHTML = "<ion-icon name='arrow-back'><ion-icon>";
        this.#eTitle = document.createElement("div");
        this.eHeader.appendChild(this.eTitle);
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.eBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.tab.actionPage = this.name;
        });
        this.eBackBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.tab.actionPage = null;
        });

        this.#init();
    }

    get tab() { return this.#tab; }
    get parent() { return this.#parent; }
    hasParent() { return !!this.parent; }
    get page() { return this.#page; }
    hasPage() { return !!this.page; }
    get app() { return this.#app; }
    hasApp() { return !!this.app; }
    compute() {
        this.#parent = this.tab.parent;
        this.#page = this.hasParent() ? this.parent.page : null;
        this.#app = this.hasPage() ? this.page.app : null;
    }

    get name() { return this.#name; }

    #init() {
        const state = this.#state;
        let namefs = {
            merge: () => {
                this.elem.classList.add("form");

                this.displayName = this.title = "Merge Logs";
                this.iconSrc = "../assets/icons/merge.svg";

                const conflictAffixMap = {
                    prefix: "prefix",
                    suffix: "suffix",
                };
                const conflictCountMap = {
                    numerical: "numerically",
                    hexadecimal: "hexadecimally",
                    alphabetical: "alphabetically",
                };

                let conflictAffix = null;
                Object.defineProperty(state, "conflictAffix", {
                    get: () => conflictAffix,
                    set: v => {
                        v = String(v);
                        if (!(v in conflictAffixMap)) return;
                        conflictAffix = v;
                        state.eConflictAffixBtnName.textContent = conflictAffixMap[state.conflictAffix];
                    },
                });
                let conflictCount = null;
                Object.defineProperty(state, "conflictCount", {
                    get: () => conflictCount,
                    set: v => {
                        v = String(v);
                        if (!(v in conflictCountMap)) return;
                        conflictCount = v;
                        state.eConflictCountBtnName.textContent = conflictCountMap[state.conflictCount];
                    },
                });
                let logs = new Set();
                Object.defineProperty(state, "logs", {
                    get: () => [...logs],
                    set: v => {
                        v = util.ensure(v, "arr");
                        state.clearLogs();
                        v.forEach(v => state.addLog(v));
                    },
                });
                state.clearLogs = () => {
                    let logs = state.logs;
                    logs.forEach(log => state.remLog(log));
                    return logs;
                };
                state.hasLog = log => {
                    log = String(log);
                    return logs.has(log);
                };
                state.addLog = log => {
                    log = String(log);
                    if (state.hasLog(log)) return false;
                    logs.add(log);
                    state.refresh();
                    return true;
                };
                state.remLog = log => {
                    log = String(log);
                    if (!state.hasLog(log)) return false;
                    logs.delete(log);
                    state.refresh();
                    return true;
                };

                let eHeader;

                eHeader = document.createElement("div");
                eHeader.classList.add("header");
                eHeader.textContent = "Merge Configuration";
                this.eContent.appendChild(eHeader);
                state.eConflict = document.createElement("div");
                this.eContent.appendChild(state.eConflict);
                state.eConflict.classList.add("select");
                state.eConflict.innerHTML = "<div>Merge conflicts with</div>";
                state.eConflictAffixBtn = document.createElement("button");
                state.eConflict.appendChild(state.eConflictAffixBtn);
                state.eConflictAffixBtn.classList.add("normal");
                state.eConflictAffixBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
                state.eConflictAffixBtnName = state.eConflictAffixBtn.children[0];
                state.eConflictAffixBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    if (!this.hasApp()) return;
                    let itm;
                    let menu = new core.App.Menu();
                    Object.keys(conflictAffixMap).forEach(affix => {
                        itm = menu.addItem(new core.App.Menu.Item(conflictAffixMap[affix], (state.conflictAffix == affix) ? "checkmark" : ""));
                        itm.addHandler("trigger", e => {
                            state.conflictAffix = affix;
                        });
                    });
                    this.app.contextMenu = menu;
                    let r = state.eConflictAffixBtn.getBoundingClientRect();
                    this.app.placeContextMenu(r.left, r.bottom);
                    menu.elem.style.minWidth = r.width+"px";
                });
                state.eConflictCountBtn = document.createElement("button");
                state.eConflict.appendChild(state.eConflictCountBtn);
                state.eConflictCountBtn.classList.add("normal");
                state.eConflictCountBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
                state.eConflictCountBtnName = state.eConflictCountBtn.children[0];
                state.eConflictCountBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    if (!this.hasApp()) return;
                    let itm;
                    let menu = new core.App.Menu();
                    Object.keys(conflictCountMap).forEach(count => {
                        itm = menu.addItem(new core.App.Menu.Item(conflictCountMap[count], (state.conflictCount == count) ? "checkmark" : ""));
                        itm.addHandler("trigger", e => {
                            state.conflictCount = count;
                        });
                    });
                    this.app.contextMenu = menu;
                    let r = state.eConflictCountBtn.getBoundingClientRect();
                    this.app.placeContextMenu(r.left, r.bottom);
                    menu.elem.style.minWidth = r.width+"px";
                });
                state.ePrefix = document.createElement("div");
                this.eContent.appendChild(state.ePrefix);
                state.ePrefix.classList.add("prefix");
                state.ePrefix.innerHTML = "<div>Global prefix</div>";
                state.ePrefixInput = document.createElement("input");
                state.ePrefix.appendChild(state.ePrefixInput);
                state.ePrefixInput.type = "text";
                state.ePrefixInput.placeholder = "No prefix";
                state.ePrefixInput.autocomplete = "off";
                state.ePrefixInput.spellcheck = false;
                eHeader = document.createElement("div");
                eHeader.classList.add("header");
                eHeader.textContent = "Selected Logs";
                this.eContent.appendChild(eHeader);
                state.eLogs = document.createElement("div");
                this.eContent.appendChild(state.eLogs);
                state.eLogs.classList.add("logs");
                new core.DropTarget(state.eLogs, e => {
                    let items = e.dataTransfer.items ? [...e.dataTransfer.items] : [];
                    items = items.map(item => item.getAsFile()).filter(file => file instanceof File);
                    if (items.length <= 0) items = e.dataTransfer.files ? [...e.dataTransfer.files] : [];
                    items = items.filter(item => item instanceof File);
                    if (items.length <= 0) return;
                    items.forEach(file => state.addLog(file.path));
                });
                state.eSubmit = document.createElement("button");
                this.eContent.appendChild(state.eSubmit);
                state.eSubmit.classList.add("special");
                state.eSubmit.textContent = "Merge";
                state.eSubmit.addEventListener("click", async e => {
                    e.stopPropagation();
                    if (!this.hasApp()) return;
                    const app = this.app;
                    state.eSubmit.disabled = true;
                    const progress = v => (app.progress = v);
                    try {
                        progress(0);
                        const sum = [];
                        const updateSum = () => progress(util.lerp(0, 1/3, sum.sum()/sum.length));
                        const sources = (await Promise.all(state.logs.map(async (log, i) => {
                            sum.push(0);
                            let source = null;
                            try {
                                source = new WPILOGSource(null);
                                const progress = v => {
                                    sum[i] = v;
                                    updateSum();
                                };
                                source.addHandler("progress", progress);
                                await source.import(log);
                                source.remHandler("progress", progress);
                            } catch (e) {}
                            sum[i] = 1;
                            updateSum();
                            return source;
                        }))).filter(source => !!source);
                        const client = new WorkerClient("./merge-worker.js");
                        const sourceData = await new Promise((res, rej) => {
                            client.addHandler("error", e => rej(e));
                            client.addHandler("stop", data => rej("WORKER TERMINATED"));
                            client.addHandler("cmd-progress", v => progress(util.lerp(1/3, 1, v)));
                            client.addHandler("cmd-finish", data => {
                                res(data);
                                client.stop();
                            });
                            client.start({
                                opt: {
                                    affix: state.conflictAffix,
                                    count: state.conflictCount,
                                },
                                sources: sources.map(source => source.toSerialized()),
                            });
                        });
                        const source = new WPILOGSource(null);
                        source.fromSerialized(sourceData);
                        progress(null);
                        const result = util.ensure(await App.fileSaveDialog({
                            title: "Save merged log to...",
                            buttonLabel: "Save",
                        }), "obj");
                        if (!result.canceled && result.filePath) {
                            let pth = String(result.filePath);
                            if (!pth.endsWith(".wpilog")) pth += ".wpilog";
                            source.addHandler("progress", progress);
                            let data = await source.export(state.ePrefixInput.value);
                            source.remHandler("progress", progress);
                            await window.api.send("write", "wpilog", pth, data);
                        }
                    } catch (e) {
                        app.doError("Log Merge Error", "", e);
                    }
                    progress(null);
                    state.eSubmit.disabled = false;
                });

                state.refresh = () => {
                    Array.from(state.eLogs.querySelectorAll(":scope > div:not(.overlay)")).forEach(elem => elem.remove());
                    state.logs.forEach(log => {
                        let elem = document.createElement("div");
                        state.eLogs.appendChild(elem);
                        elem.innerHTML = "<div></div>";
                        elem.children[0].textContent = log;
                        let btn = document.createElement("button");
                        elem.appendChild(btn);
                        btn.innerHTML = "<ion-icon name='close'></ion-icon>";
                        btn.addEventListener("click", e => {
                            e.stopPropagation();
                            state.remLog(log);
                        });
                    });
                    let v = state.eSubmit.disabled = state.logs.length <= 0;
                    if (v == state.eLogs.classList.contains("empty")) return;
                    if (v) state.eLogs.classList.add("empty");
                    else state.eLogs.classList.remove("empty");
                };

                state.conflictAffix = "suffix";
                state.conflictCount = "numerical";
                state.refresh();
            },
            export: () => {
                this.elem.classList.add("form");

                this.displayName = this.title = "Export Logs";
                this.icon = "repeat";

                const portMap = {
                    session: {
                        name: "Current Session",
                        command: "session",
                    },
                    wpilog: {
                        name: "WPILOG",
                        command: "wpilog",
                        decoder: "../wpilog/decoder-worker.js",
                        encoder: "../wpilog/encoder-worker.js",
                        source: WPILOGSource,
                        tag: "wpilog",
                    },
                    "csv-time": {
                        name: "CSV-Time",
                        command: "csv",
                        decoder: "../csv/time/decoder-worker.js",
                        encoder: "../csv/time/encoder-worker.js",
                        source: CSVTimeSource,
                        tag: "time.csv",
                    },
                    "csv-field": {
                        name: "CSV-Field",
                        command: "csv",
                        decoder: "../csv/field/decoder-worker.js",
                        encoder: "../csv/field/encoder-worker.js",
                        source: CSVFieldSource,
                        tag: "field.csv",
                    },
                };

                let importFrom = null;
                Object.defineProperty(state, "importFrom", {
                    get: () => importFrom,
                    set: v => {
                        v = String(v);
                        if (!(v in portMap)) return;
                        importFrom = v;
                        state.refresh();
                        state.eImportFromBtnName.textContent = portMap[state.importFrom].name;
                        if (state.importFrom == "session") {
                            dropTarget.disabled = true;
                            return;
                        }
                        dropTarget.disabled = false;
                    },
                });
                let exportTo = null;
                Object.defineProperty(state, "exportTo", {
                    get: () => exportTo,
                    set: v => {
                        v = String(v);
                        if (!(v in portMap)) return;
                        exportTo = v;
                        state.refresh();
                        state.eExportToBtnName.textContent = portMap[state.exportTo].name;
                    },
                });
                let logs = new Set();
                Object.defineProperty(state, "logs", {
                    get: () => [...logs],
                    set: v => {
                        v = util.ensure(v, "arr");
                        state.clearLogs();
                        v.forEach(v => state.addLog(v));
                    },
                });
                state.clearLogs = () => {
                    let logs = state.logs;
                    logs.forEach(log => state.remLog(log));
                    return logs;
                };
                state.hasLog = log => {
                    log = String(log);
                    return logs.has(log);
                };
                state.addLog = log => {
                    log = String(log);
                    if (state.hasLog(log)) return false;
                    logs.add(log);
                    state.refresh();
                    return true;
                };
                state.remLog = log => {
                    log = String(log);
                    if (!state.hasLog(log)) return false;
                    logs.delete(log);
                    state.refresh();
                    return true;
                };

                let eHeader;

                eHeader = document.createElement("div");
                eHeader.classList.add("header");
                eHeader.textContent = "Export Configuration";
                this.eContent.appendChild(eHeader);
                state.eImport = document.createElement("div");
                this.eContent.appendChild(state.eImport);
                state.eImport.classList.add("select");
                state.eImport.innerHTML = "<div>Import from</div>";
                state.eImportFromBtn = document.createElement("button");
                state.eImport.appendChild(state.eImportFromBtn);
                state.eImportFromBtn.classList.add("normal");
                state.eImportFromBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
                state.eImportFromBtnName = state.eImportFromBtn.children[0];
                state.eImportFromBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    if (!this.hasApp()) return;
                    let itm;
                    let menu = new core.App.Menu();
                    Object.keys(portMap).forEach(type => {
                        itm = menu.addItem(new core.App.Menu.Item(portMap[type].name, (state.importFrom == type) ? "checkmark" : ""));
                        itm.addHandler("trigger", e => {
                            state.importFrom = type;
                        });
                    });
                    this.app.contextMenu = menu;
                    let r = state.eImportFromBtn.getBoundingClientRect();
                    this.app.placeContextMenu(r.left, r.bottom);
                    menu.elem.style.minWidth = r.width+"px";
                });
                state.eExport = document.createElement("div");
                this.eContent.appendChild(state.eExport);
                state.eExport.classList.add("select");
                state.eExport.innerHTML = "<div>Export to</div>";
                state.eExportToBtn = document.createElement("button");
                state.eExport.appendChild(state.eExportToBtn);
                state.eExportToBtn.classList.add("normal");
                state.eExportToBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
                state.eExportToBtnName = state.eExportToBtn.children[0];
                state.eExportToBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    if (!this.hasApp()) return;
                    let itm;
                    let menu = new core.App.Menu();
                    Object.keys(portMap).forEach(type => {
                        itm = menu.addItem(new core.App.Menu.Item(portMap[type].name, (state.exportTo == type) ? "checkmark" : ""));
                        itm.addHandler("trigger", e => {
                            state.exportTo = type;
                        });
                    });
                    this.app.contextMenu = menu;
                    let r = state.eExportToBtn.getBoundingClientRect();
                    this.app.placeContextMenu(r.left, r.bottom);
                    menu.elem.style.minWidth = r.width+"px";
                });
                state.ePrefix = document.createElement("div");
                this.eContent.appendChild(state.ePrefix);
                state.ePrefix.classList.add("prefix");
                state.ePrefix.innerHTML = "<div>Global prefix</div>";
                state.ePrefixInput = document.createElement("input");
                state.ePrefix.appendChild(state.ePrefixInput);
                state.ePrefixInput.type = "text";
                state.ePrefixInput.placeholder = "No prefix";
                state.ePrefixInput.autocomplete = "off";
                state.ePrefixInput.spellcheck = false;
                eHeader = document.createElement("div");
                eHeader.classList.add("header");
                eHeader.textContent = "Logs to Export";
                this.eContent.appendChild(eHeader);
                state.eLogs = document.createElement("div");
                this.eContent.appendChild(state.eLogs);
                state.eLogs.classList.add("logs");
                const dropTarget = new core.DropTarget(state.eLogs, e => {
                    let items = e.dataTransfer.items ? [...e.dataTransfer.items] : [];
                    items = items.map(item => item.getAsFile()).filter(file => file instanceof File);
                    if (items.length <= 0) items = e.dataTransfer.files ? [...e.dataTransfer.files] : [];
                    items = items.filter(item => item instanceof File);
                    if (items.length <= 0) return;
                    items.forEach(file => state.addLog(file.path));
                });
                state.eSubmit = document.createElement("button");
                this.eContent.appendChild(state.eSubmit);
                state.eSubmit.classList.add("special");
                state.eSubmit.textContent = "Export";
                state.eSubmit.addEventListener("click", async e => {
                    e.stopPropagation();
                    if (!this.hasApp()) return;
                    const app = this.app;
                    if (!this.hasPage()) return;
                    const page = this.page;
                    if (state.importFrom == state.exportTo) return;
                    if (state.importFrom == "session") {
                    } else if (state.exportTo == "session") {
                        if (state.logs.length != 1) return;
                        if (!page.hasProject()) return;
                        const project = this.page.project;
                        project.config.sourceType = state.importFrom;
                        project.config.source = state.logs[0];
                        page.update(0);
                        app.post("cmd-action");
                    } else {
                        if (state.logs.length <= 0) return;
                    }
                    state.eSubmit.disabled = true;
                    const progress = v => (app.progress = v);
                    try {
                        progress(0);
                        let sum, a, b;
                        const updateSum = () => progress(util.lerp(a, b, sum.sum()/sum.length));
                        [sum, a, b] = [[], 0, 0.5];
                        const sources = 
                            ((state.importFrom == "session") ?
                                [this.hasPage() ? { pth: null, source: this.page.source } : null] :
                            (await Promise.all(state.logs.map(async (log, i) => {
                                sum.push(0);
                                updateSum();
                                let source = null;
                                try {
                                    source = new portMap[state.importFrom].source(null);
                                    const progress = v => {
                                        sum[i] = v;
                                        updateSum();
                                    };
                                    source.addHandler("progress", progress);
                                    await source.import(log);
                                    source.remHandler("progress", progress);
                                    source = { pth: log, source: source };
                                } catch (e) {}
                                sum[i] = 1;
                                updateSum();
                                return source;
                            }))))
                            .filter(source => !!source);
                        [sum, a, b] = [[], 0.5, 1];
                        const datas = (await Promise.all(sources.map(async (source, i) => {
                            sum.push(0);
                            updateSum();
                            let data = null;
                            try {
                                const progress = v => {
                                    sum[i] = v;
                                    updateSum();
                                };
                                source.source.addHandler("progress", progress);
                                data = await portMap[state.exportTo].source.export(source.source, state.ePrefixInput.value);
                                source.source.remHandler("progress", progress);
                                data = { pth: source.pth, source: source, data: data };
                            } catch (e) {}
                            sum[i] = 1;
                            updateSum();
                            return data;
                        })))
                            .filter(data => !!data);
                        const tag = "."+portMap[state.exportTo].tag;
                        for (const data of datas) {
                            const content = data.data;
                            let pth = data.pth;
                            if (pth == null) {
                                const result = util.ensure(await App.fileSaveDialog({
                                    title: "Save exported session to...",
                                    buttonLabel: "Save",
                                }), "obj");
                                if (result.canceled || !result.filePath) continue;
                                pth = String(result.filePath);
                            } else {
                                if (pth.endsWith(tag))
                                    pth = pth.substring(0, pth.length-tag.length);
                            }
                            pth = String(pth);
                            if (!pth.endsWith(tag)) pth += tag;
                            await window.api.send("write", portMap[state.exportTo].command, pth, content);
                        }
                    } catch (e) {
                        app.doError("Log Export Error", "", e);
                    }
                    progress(null);
                    state.refresh();
                });

                state.refresh = () => {
                    Array.from(state.eLogs.querySelectorAll(":scope > div:not(.overlay)")).forEach(elem => elem.remove());
                    state.logs.forEach(log => {
                        let elem = document.createElement("div");
                        state.eLogs.appendChild(elem);
                        elem.innerHTML = "<div></div>";
                        elem.children[0].textContent = log;
                        let btn = document.createElement("button");
                        elem.appendChild(btn);
                        btn.innerHTML = "<ion-icon name='close'></ion-icon>";
                        btn.addEventListener("click", e => {
                            e.stopPropagation();
                            state.remLog(log);
                        });
                    });
                    if (state.importFrom == state.exportTo)
                        state.eSubmit.disabled = true;
                    else {
                        if (state.importFrom == "session") {
                            state.eSubmit.disabled = false;
                        } else if (state.exportTo == "session") {
                            state.eSubmit.disabled = state.logs.length != 1;
                        } else {
                            state.eSubmit.disabled = state.logs.length <= 0;
                        }
                    }
                    let v = state.logs.length <= 0;
                    if (v == state.eLogs.classList.contains("empty")) return;
                    if (v) state.eLogs.classList.add("empty");
                    else state.eLogs.classList.remove("empty");
                };

                state.importFrom = "session";
                state.exportTo = "wpilog";
                state.refresh();
            },
        };
        if (this.name in namefs) namefs[this.name]();
    }

    update(delta) { this.post("update", delta); }

    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) { this.eIcon.setAttribute("src", v); }

    get displayName() { return this.eName.textContent; }
    set displayName(v) { this.eName.textContent = v; }

    get title() { return this.eTitle.textContent; }
    set title(v) { this.eTitle.textContent = v; }

    get isShown() { return this.elem.classList.contains("this"); }
    set isShown(v) {
        v = !!v;
        if (this.isShown == v) return;
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
    }
    get isHidden() { return !this.isShown; }
    set isHidden(v) { this.isShown = !v; }
    show() { return this.isShown = true; }
    hide() { return this.isHidden = true; }

    get eBtn() { return this.#eBtn; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get elem() { return this.#elem; }
    get eHeader() { return this.#eHeader; }
    get eBackBtn() { return this.#eBackBtn; }
    get eTitle() { return this.#eTitle; }
    get eContent() { return this.#eContent; }
};
Panel.VideoSyncTab = class PanelVideoSyncTab extends Panel.ToolTab {
    #video;
    #offsets;
    #locked;

    #duration;

    #eVideoBox;
    #eVideo;
    #eNav;
    #eSource;
    #eSourceTitle;
    #eTime;
    #eTimeTitle;
    #eTimeBox;
    #eTimeSourceBox;
    #eTimeVideoBox;
    #eTimeNav;
    #eTimeNavBack;
    #eTimeNavAction;
    #eTimeNavForward;
    #eTimeNavZeroLeft;
    #eTimeNavZeroRight;
    #eTimeNavEdit;
    #eTimeNavLock;

    constructor(...a) {
        super("VideoSync", "videosync");

        this.elem.classList.add("videosync");

        this.#video = null;
        this.#offsets = {};
        this.#locked = false;

        this.#duration = 0;

        this.#eVideoBox = document.createElement("div");
        this.elem.appendChild(this.eVideoBox);
        this.eVideoBox.classList.add("video");
        this.#eVideo = document.createElement("video");
        this.eVideoBox.appendChild(this.eVideo);
        this.eVideo.muted = true;
        this.eVideo.loop = false;

        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");

        this.#eSource = document.createElement("div");
        this.eNav.appendChild(this.eSource);
        this.eSource.classList.add("source");
        this.#eSourceTitle = document.createElement("div");
        this.eSource.appendChild(this.eSourceTitle);
        this.eSourceTitle.classList.add("title");
        this.eSourceTitle.innerHTML = "<div>Videos</div>";

        ["yt", "file"].forEach(name => {
            let elem = document.createElement("button");
            this.eSourceTitle.appendChild(elem);
            elem.style.setProperty("--color", {
                yt: "var(--cr)",
                file: "var(--a)",
            }[name]);
            elem.innerHTML = "<ion-icon></ion-icon>";
            elem.children[0].name = {
                yt: "logo-youtube",
                file: "document",
            }[name];
            elem.addEventListener("click", async e => {
                if (!this.hasApp()) return;
                e.stopPropagation();
                let namefs = {
                    yt: async () => {
                        elem.disabled = true;
                        let pop = this.app.prompt("Youtube Video URL", "");
                        pop.doCast = v => {
                            v = String(v);
                            if (v.length <= 0) return v;
                            if (v.startsWith("https://www.youtube.com/watch?v=")) v = v.substring("https://".length);
                            if (v.startsWith("www.youtube.com/watch?v=")) v = v.substring("www.".length);
                            if (!v.startsWith("youtube.com/watch?v=")) {
                                if (v.length != 11) return v;
                                v = "youtube.com/watch?v="+v;
                            }
                            return v;
                        };
                        pop.type = null;
                        pop.icon = "logo-youtube";
                        pop.iconColor = "var(--cr)";
                        let result = await pop.whenResult();
                        if (result == null) return elem.disabled = false;
                        result = "https://"+result;
                        try {
                            await window.api.send("video-add-url", result);
                        } catch (e) { this.app.doError("Youtube Add Error", result, e); }
                        elem.disabled = false;
                    },
                    file: async () => {
                        elem.disabled = true;
                        let file = await App.fileOpenDialog({
                            title: "Choose a video",
                            properties: [
                                "openFile",
                            ],
                        });
                        file = util.ensure(file, "obj");
                        if (file.canceled) return elem.disabled = false;
                        file = util.ensure(file.filePaths, "arr")[0];
                        let name = await this.app.doPrompt("Name", "Will take file name if not defined");
                        try {
                            await window.api.send("video-add-file", file, name);
                        } catch (e) { this.app.doError("File Add Error", file+" -> "+name, e); }
                        elem.disabled = false;
                    },
                };
                if (name in namefs)
                    await namefs[name]();
            });
        });

        this.#eTime = document.createElement("div");
        this.eNav.appendChild(this.eTime);
        this.eTime.classList.add("time");
        this.#eTimeTitle = document.createElement("div");
        // this.eTime.appendChild(this.eTimeTitle);
        this.eTimeTitle.classList.add("title");
        this.eTimeTitle.textContent = "<div>Sync</div>";
        this.#eTimeBox = document.createElement("div");
        this.eTime.appendChild(this.eTimeBox);
        this.eTimeBox.classList.add("box");
        this.#eTimeSourceBox = document.createElement("div");
        this.eTimeBox.appendChild(this.eTimeSourceBox);
        this.eTimeSourceBox.classList.add("source");
        this.#eTimeVideoBox = document.createElement("div");
        this.eTimeBox.appendChild(this.eTimeVideoBox);
        this.eTimeVideoBox.classList.add("video");
        this.eTimeVideoBox.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            let r = this.eTimeVideoBox.getBoundingClientRect();
            let offset = r.left-e.pageX;
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                let x = e.pageX+offset;
                let r = this.eTimeBox.getBoundingClientRect();
                let p = Math.min(1, Math.max(0, (x-r.left)/r.width));
                if (!this.hasPage()) return;
                if (!this.page.hasSource()) return;
                const len = this.duration * 1000;
                const playback = this.page.source.playback;
                const slen = playback.tsMax-playback.tsMin;
                const blen = slen+2*len;
                let t = blen*p - len;
                this.setOffset(this.video, -t);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
            mousemove(e);
        });
        this.#eTimeNav = document.createElement("div");
        this.eTime.appendChild(this.eTimeNav);
        this.eTimeNav.classList.add("nav");

        this.#eTimeNavEdit = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavEdit);
        this.eTimeNavEdit.innerHTML = "<ion-icon name='pencil'></ion-icon>";
        this.eTimeNavEdit.addEventListener("click", async e => {
            e.stopPropagation();
            if (!this.hasApp()) return;
            let pop = this.app.prompt("Time Offset", "Shift video this many seconds", String(-util.ensure(this.getOffset(this.video), "num")/1000), "time");
            pop.type = "num";
            let result = await pop.whenResult();
            if (result == null) return;
            result = util.ensure(parseFloat(result), "num");
            this.setOffset(this.video, -result*1000);
        });

        this.#eTimeNavZeroLeft = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavZeroLeft);
        this.eTimeNavZeroLeft.innerHTML = "<ion-icon name='arrow-back'></ion-icon>";
        this.eTimeNavZeroLeft.addEventListener("click", e => {
            e.stopPropagation();
            this.setOffset(this.video, 0);
        });

        this.#eTimeNavBack = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavBack);
        this.eTimeNavBack.innerHTML = "<ion-icon name='play-skip-back'></ion-icon>";
        this.eTimeNavBack.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasPage()) return;
            if (!this.page.hasSource()) return;
            const playback = this.page.source.playback;
            playback.ts = playback.tsMin - util.ensure(this.getOffset(this.video), "num");
        });

        this.#eTimeNavAction = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavAction);
        this.eTimeNavAction.innerHTML = "<ion-icon></ion-icon>";
        this.eTimeNavAction.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasPage()) return;
            this.page.eNavActionButton.click();
        });
        const actionIcon = this.eTimeNavAction.children[0];

        this.#eTimeNavForward = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavForward);
        this.eTimeNavForward.innerHTML = "<ion-icon name='play-skip-forward'></ion-icon>";
        this.eTimeNavForward.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasPage()) return;
            if (!this.page.hasSource()) return;
            const playback = this.page.source.playback;
            playback.ts = this.duration*1000 + playback.tsMin - util.ensure(this.getOffset(this.video), "num");
        });

        this.#eTimeNavZeroRight = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavZeroRight);
        this.eTimeNavZeroRight.innerHTML = "<ion-icon name='arrow-forward'></ion-icon>";
        this.eTimeNavZeroRight.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasPage()) return;
            if (!this.page.hasSource()) return;
            const len = this.duration * 1000;
            const playback = this.page.source.playback;
            const slen = playback.tsMax-playback.tsMin;
            this.setOffset(this.video, len-slen);
        });

        this.#eTimeNavLock = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavLock);
        this.eTimeNavLock.innerHTML = "<ion-icon></ion-icon>";
        this.eTimeNavLock.addEventListener("click", e => {
            e.stopPropagation();
            this.locked = !this.locked;
        });
        const lockIcon = this.eTimeNavLock.children[0];

        this.addHandler("change", () => {
            if (this.locked)
                this.eTimeBox.classList.add("disabled");
            else this.eTimeBox.classList.remove("disabled");
            this.eTimeNavZeroLeft.disabled = this.locked;
            this.eTimeNavZeroRight.disabled = this.locked;
            this.eTimeNavEdit.disabled = this.locked;
            lockIcon.name = this.locked ? "lock-closed" : "lock-open";
        });

        let elems = {};

        const timer = new util.Timer();
        timer.play();
        this.addHandler("change", () => timer.set(1000));
        let desync = 0;
        this.#duration = 0;
        this.addHandler("update", async delta => {
            if (this.isClosed) return;
            if (this.hasVideo()) {
                if (util.is(this.eVideo.duration, "num")) this.#duration = this.eVideo.duration;
            } else this.#duration = 0;
            const len = this.duration * 1000;
            let time = 0;
            let thresh = 0.05;
            if (this.hasPage() && this.page.hasSource()) {
                const offset = util.ensure(this.getOffset(this.video), "num");
                const playback = this.page.source.playback;
                const slen = playback.tsMax-playback.tsMin;
                let stime = playback.ts-playback.tsMin;
                time = stime + offset;
                time = Math.min(len, Math.max(0, time)) / 1000;
                if (this.eVideo.readyState > 0) {
                    if (playback.paused || playback.finished || time < 0 || time >= len/1000) {
                        thresh = 0.001;
                        if (!this.eVideo.paused)
                            this.eVideo.pause();
                    } else {
                        if (this.eVideo.paused)
                            this.eVideo.play();
                    }
                }
                const blen = slen + 2*len;
                let l, r;
                [l, r] = [len, slen+len];
                l = Math.min(1, Math.max(0, l/blen));
                r = Math.min(1, Math.max(0, r/blen));
                this.eTimeSourceBox.style.setProperty("--l", (l*100)+"%");
                this.eTimeSourceBox.style.setProperty("--r", (r*100)+"%");
                [l, r] = [len-offset, 2*len-offset];
                l = Math.min(1, Math.max(0, l/blen));
                r = Math.min(1, Math.max(0, r/blen));
                this.eTimeVideoBox.style.setProperty("--l", (l*100)+"%");
                this.eTimeVideoBox.style.setProperty("--r", (r*100)+"%");
                if (this.page.eNavActionButton.children[0])
                    actionIcon.name = this.page.eNavActionButton.children[0].name;
            } else {
                this.eTimeSourceBox.style.setProperty("--l", "0%");
                this.eTimeSourceBox.style.setProperty("--r", "0%");
                this.eTimeVideoBox.style.setProperty("--l", "0%");
                this.eTimeVideoBox.style.setProperty("--r", "0%");
                actionIcon.name = "play";
            }
            if (Math.abs(this.eVideo.currentTime-time) > thresh) {
                desync++;
                if (desync >= 5)
                    this.eVideo.currentTime = time;
            } else desync = 0;
            if (timer.time < 1000) return;
            timer.clear();
            const videos = util.ensure(await window.api.send("videos"), "arr").map(name => String(name));
            videos.forEach(name => {
                if (name in elems) return;
                let elem = document.createElement("div");
                elems[name] = elem;
                this.eSource.appendChild(elem);
                elem.classList.add("item");
                elem.innerHTML = "<div></div><button><ion-icon name='ellipsis-vertical'></ion-icon></button>";
                elem.addEventListener("click", e => {
                    e.stopPropagation();
                    this.video = name;
                });
                const [eName, eBtn] = elem.children;
                eName.textContent = name;
                eBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.Menu();
                    itm = menu.addItem(new core.App.Menu.Item("Remove", "close"));
                    itm.addHandler("trigger", async e => {
                        if (this.video == name) this.video = null;
                        try {
                            await window.api.send("video-rem", name);
                        } catch (e) { this.app.doError("Video Remove Error", name, e); }
                    });
                    itm = menu.addItem(new core.App.Menu.Item("Rename"));
                    itm.addHandler("trigger", async e => {
                        if (!this.hasApp()) return;
                        let result = await this.app.doPrompt("Rename", name, name);
                        if (result == null) return;
                        try {
                            result = await window.api.send("video-rename", name, result);
                            if (this.video == name) this.video = result;
                        } catch (e) { this.app.doError("Video Rename Error", name, e); }
                    });
                    if (!this.hasApp()) return;
                    this.app.contextMenu = menu;
                    let r = eBtn.getBoundingClientRect();
                    this.app.placeContextMenu(r.left, r.bottom);
                });
            });
            Object.keys(elems).forEach(name => {
                if (videos.includes(name)) return;
                let elem = elems[name];
                delete elems[name];
                elem.remove();
            });
            videos.forEach((name, i) => {
                elems[name].style.order = i+1;
                if (this.video == name)
                    elems[name].classList.add("this");
                else elems[name].classList.remove("this");
            });
        });

        this.addHandler("change-video", async () => {
            this.eVideo.src = "file://"+(await window.api.send("video-get", this.video));
        });

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.VideoSyncTab) a = [a.video, a.offsets, a.locked];
            else if (util.is(a, "arr")) {
                a = new Panel.VideoSyncTab(...a);
                a = [a.video, a.offsets, a.locked];
            }
            else if (util.is(a, "obj")) a = [a.video, a.offsets, a.locked];
            else a = [String(a), {}];
        }
        if (a.length == 2)
            a = [...a, false];

        [this.video, this.offsets, this.locked] = a;
    }

    get video() { return this.#video; }
    set video(v) {
        v = (v == null) ? null : String(v);
        if (this.video == v) return;
        this.change("video", this.video, this.#video=v);
    }
    hasVideo() { return this.video != null; }

    get offsetKeys() { return Object.keys(this.#offsets); }
    get offsetValues() { return Object.values(this.#offsets); }
    get offsets() {
        let offsets = {};
        this.offsetKeys.forEach(k => (offsets[k] = this.getOffset(k)));
        return offsets;
    }
    set offsets(v) {
        v = util.ensure(v, "obj");
        this.clearOffsets();
        for (let k in v) this.setOffset(k, v[k]);
    }
    clearOffsets() {
        let offsets = this.offsets;
        for (let k in offsets) this.delOffset(k);
        return offsets;
    }
    hasOffset(k) { return String(k) in this.#offsets }
    getOffset(k) {
        if (!this.hasOffset(k)) return null;
        return this.#offsets[String(k)];
    }
    setOffset(k, v) {
        k = String(k);
        v = util.ensure(v, "num");
        let v2 = this.getOffset(k);
        if (v == v2) return v2;
        this.#offsets[k] = v;
        this.change("setOffset", v2, v);
        return v;
    }
    delOffset(k) {
        let v = this.getOption(k);
        if (v == null) return v;
        delete this.#offsets[String(k)];
        this.change("delOffset", v, null);
        return v;
    }

    get locked() { return this.#locked; }
    set locked(v) {
        v = !!v;
        if (this.locked == v) return;
        this.change("locked", this.locked, this.#locked=v);
    }
    get unlocked() { return !this.locked; }
    set unlocked(v) { this.locked = !v; }
    lock() { return this.locked = true; }
    unlock() { return this.unlocked = true; }

    get duration() { return this.#duration; }

    get eVideoBox() { return this.#eVideoBox; }
    get eVideo() { return this.#eVideo; }
    get eNav() { return this.#eNav; }
    get eSource() { return this.#eSource; }
    get eSourceTitle() { return this.#eSourceTitle; }
    get eTime() { return this.#eTime; }
    get eTimeTitle() { return this.#eTimeTitle; }
    get eTimeBox() { return this.#eTimeBox; }
    get eTimeSourceBox() { return this.#eTimeSourceBox; }
    get eTimeVideoBox() { return this.#eTimeVideoBox; }
    get eTimeNav() { return this.#eTimeNav; }
    get eTimeNavBack() { return this.#eTimeNavBack; }
    get eTimeNavAction() { return this.#eTimeNavAction; }
    get eTimeNavForward() { return this.#eTimeNavForward; }
    get eTimeNavZeroLeft() { return this.#eTimeNavZeroLeft; }
    get eTimeNavZeroRight() { return this.#eTimeNavZeroRight; }
    get eTimeNavEdit() { return this.#eTimeNavEdit; }
    get eTimeNavLock() { return this.#eTimeNavLock; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            video: this.video,
            offsets: this.offsets,
            locked: this.locked,
        });
    }
};
Panel.ToolCanvasTab = class PanelToolCanvasTab extends Panel.ToolTab {
    #quality;

    #eOpen;
    #eOptions;
    #eOptionSections;
    #eContent;
    #canvas; #ctx;

    static CREATECTX = true;

    constructor(dname, name) {
        super(dname, name);

        this.elem.classList.add("canvas");

        this.#quality = null;

        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#canvas = document.createElement("canvas");
        this.eContent.appendChild(this.canvas);
        this.canvas.tabIndex = 1;
        if (this.constructor.CREATECTX) this.#ctx = this.canvas.getContext("2d");
        this.#eOpen = document.createElement("div");
        this.elem.appendChild(this.eOpen);
        this.eOpen.classList.add("open");
        this.#eOptions = document.createElement("div");
        this.elem.appendChild(this.eOptions);
        this.eOptions.classList.add("options");
        this.#eOptionSections = {};

        let cancel = 10;
        this.eOpen.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            this.optionState = (this.optionState == 0) ? ((this.elem.getBoundingClientRect().height < 500) ? 1 : 0.5) : 0;
        });
        this.eOpen.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            let offset = e.offsetY;
            const mouseup = e => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                if (cancel > 0) return;
                this.elem.style.removeProperty("--options");
                this.elem.classList.remove("drag");
                let r = this.elem.getBoundingClientRect();
                let y = e.pageY;
                y -= r.top;
                y += offset;
                y /= r.height;
                this.optionState = (y < 0.25) ? 1 : (y < 0.75) ? 0.5 : 0;
            };
            const mousemove = e => {
                if (cancel > 0) return cancel--;
                let r = this.elem.getBoundingClientRect();
                let y = e.pageY;
                y -= r.top;
                y += offset;
                y /= r.height;
                this.elem.style.setProperty("--options", (y*100)+"%");
                this.elem.classList.add("drag");
                this.optionState = (y < 0.1) ? 1 : (y < 0.66) ? 0.5 : 0;
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.addHandler("openclose", () => {
            let x = this.optionState;
            if (x > 0) return this.optionState = 0;
            this.optionState = (this.elem.getBoundingClientRect().height < 500) ? 1 : 0.5;
        });

        if (this.constructor.CREATECTX) {
            new ResizeObserver(() => {
                let r = this.eContent.getBoundingClientRect();
                this.canvas.width = r.width * this.quality;
                this.canvas.height = r.height * this.quality;
                this.canvas.style.width = r.width+"px";
                this.canvas.style.height = r.height+"px";
                this.update(0);
            }).observe(this.eContent);
        }

        let optionState = null;
        new MutationObserver(() => {
            if (optionState != this.optionState)
                this.change("optionState", optionState, optionState=this.optionState);
        }).observe(this.elem, { attributes: true, attributeFilter: ["class"] });

        this.optionState = 1;
        this.closeOptions();
    }

    get quality() { return this.#quality; }
    set quality(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (util.is(this.quality, "num")) return;
        this.change("quality", this.quality, this.#quality=v);
    }

    get eContent() { return this.#eContent; }
    get canvas() { return this.#canvas; }
    get ctx() { return this.#ctx; }
    get eOpen() { return this.#eOpen; }
    get eOptions() { return this.#eOptions; }
    get eOptionSections() { return Object.keys(this.#eOptionSections); }
    hasEOptionSection(id) { return id in this.#eOptionSections; }
    getEOptionSection(id) { return this.#eOptionSections[id]; }
    addEOptionSection(elem) {
        if (!(elem instanceof HTMLDivElement)) return false;
        if (this.hasEOptionSection(elem.id)) return false;
        this.#eOptionSections[elem.id] = elem;
        this.eOptions.appendChild(elem);
        return elem;
    }

    get optionState() {
        if (this.elem.classList.contains("open")) return 1;
        if (this.elem.classList.contains("half-open")) return 0.5;
        return 0;
    }
    set optionState(v) {
        v = [0, 0.5, 1].includes(v) ? v : 0;
        if (this.optionState == v) return;
        this.elem.classList.remove("open");
        this.elem.classList.remove("half-open");
        if (v == 1) {
            this.elem.classList.add("open");
            this.eOpen.innerHTML = "<ion-icon name='chevron-down'></ion-icon>";
        } else if (v == 0.5) {
            this.elem.classList.add("half-open");
            this.eOpen.innerHTML = "<ion-icon name='chevron-expand'></ion-icon>";
        } else {
            this.eOpen.innerHTML = "<ion-icon name='chevron-up'></ion-icon>";
        }
    }
    closeOptions() { return this.optionState = 0; }
};
Panel.ToolCanvasTab.Hook = class PanelToolCanvasTabHook extends util.Target {
    #path;
    #value;
    #toggle;
    #toggles;

    #elem;
    #eName;
    #eBox;
    #eIcon;

    constructor(name, path) {
        super();

        this.#path = 0;
        this.#value = null;
        this.#toggle = new Panel.ToolCanvasTab.Hook.Toggle("!");
        this.toggle.addHandler("change", (c, f, t) => this.change("toggle."+c, f, t));
        this.#toggles = new Set();

        this.#elem = document.createElement("div");
        this.elem.classList.add("hook");
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eBox = document.createElement("div");
        this.elem.appendChild(this.eBox);
        this.eBox.classList.add("box");
        this.#eIcon = null;

        this.elem.insertBefore(this.toggle.elem, this.eBox);

        this.name = name;
        this.path = path;
    }

    #update() {
        if (!this.hasPath()) {
            this.eBox.innerHTML = "";
            this.#eIcon = null;
            return;
        }
        this.eBox.innerHTML = "<div class='explorernode'><button class='display'><div class='main'><ion-icon></ion-icon><div class='name'></div><ion-icon name='close'></ion-icon></div></button></div>";
        this.#eIcon = this.eBox.children[0].children[0].children[0].children[0];
        const eName = this.eBox.children[0].children[0].children[0].children[1];
        eName.style.flexBasis = "100%";
        eName.style.textAlign = "left";
        eName.textContent = this.path;
        const eRem = this.eBox.children[0].children[0].children[0].children[2];
        eRem.addEventListener("click", e => {
            e.stopPropagation();
            this.path = null;
        });
    }

    get path() { return this.#path; }
    set path(v) {
        v = (v == null) ? null : util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.#update();
        this.setFrom("*", null);
    }
    hasPath() { return this.path != null; }

    setFrom(t, v) {
        this.#value = v;
        if (!this.eIcon) return;
        const icon = this.eIcon;
        let display = getDisplay(t, v);
        if (display != null) {
            if ("src" in display) icon.setAttribute("src", display.src);
            else icon.name = display.name;
            if ("color" in display) icon.style.color = display.color;
            else icon.style.color = "";
        } else {
            icon.name = "document";
            icon.style.color = "var(--cr)";
        }
    }
    get value() { return this.#value; }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }
    get eBox() { return this.#eBox; }
    get eIcon() { return this.#eIcon; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }

    get toggle() { return this.#toggle; }
    set toggle(v) { this.toggle.from(v); }
    get toggles() { return [...this.#toggles]; }
    set toggles(v) {
        v = util.ensure(v, "arr");
        this.clearToggles();
        this.addToggle(v);
    }
    clearToggles() {
        let toggles = this.toggles;
        this.remToggle(toggles);
        return toggles;
    }
    hasToggle(toggle) {
        if (!(toggle instanceof Panel.ToolCanvasTab.Hook.Toggle)) return false;
        return this.#toggles.has(toggle);
    }
    addToggle(...toggles) {
        return util.Target.resultingForEach(toggles, toggle => {
            if (!(toggle instanceof Panel.ToolCanvasTab.Hook.Toggle)) toggle = Panel.ToolCanvasTab.Hook.Toggle.from(toggle);
            if (toggle == this.toggle) return false;
            if (this.hasToggle(toggle)) return false;
            this.#toggles.add(toggle);
            this.elem.insertBefore(toggle.elem, this.eBox);
            toggle.addLinkedHandler(this, "change", (c, f, t) => this.change("toggles."+c, f, t));
            this.change("addToggle", null, toggle);
            return toggle;
        });
    }
    remToggle(...toggles) {
        return util.Target.resultingForEach(toggles, toggle => {
            if (!(toggle instanceof Panel.ToolCanvasTab.Hook.Toggle)) toggle = Panel.ToolCanvasTab.Hook.Toggle.from(toggle);
            if (toggle == this.toggle) return false;
            if (!this.hasToggle(toggle)) return false;
            this.#toggles.delete(toggle);
            this.elem.removeChild(toggle.elem);
            toggle.clearLinkedHandlers(this, "change");
            this.change("remToggle", toggle, null);
            return toggle;
        });
    }
    getToggleByName(name) {
        name = String(name);
        for (let toggle of this.toggles)
            if (toggle.name == name)
                return toggle;
        return null;
    }

    to() {
        return {
            path: this.path,
            toggle: this.toggle.to(),
            toggles: this.toggles.map(toggle => toggle.to()),
        };
    }
    from(o) {
        o = util.ensure(o, "obj");
        this.path = o.path;
        this.toggle = o.toggle;
        this.toggles = o.toggles;
        return this;
    }
};
Panel.ToolCanvasTab.Hook.Toggle = class PanelToolCanvasTabHookToggle extends util.Target {
    #name;
    #value;

    #elem;

    constructor(name, value=false) {
        super();

        this.#name = String(name);
        this.#value = null;

        this.#elem = document.createElement("button");
        this.elem.classList.add("normal");
        this.elem.textContent = this.name;
        this.elem.addEventListener("click", e => (this.value = !this.value));

        this.value = value;
    }

    get shown() { return this.elem.classList.contains("this"); }
    set shown(v) {
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
    }
    get hidden() { return !this.shown; }
    set hidden(v) { this.shown = !v; }
    show() { return this.shown = true; }
    hide() { return this.hidden = true; }
    get name() { return this.#name; }
    get value() { return this.#value; }
    set value(v) {
        v = !!v;
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
        if (v) this.elem.classList.add("on");
        else this.elem.classList.remove("on");
    }

    get elem() { return this.#elem; }

    to() {
        return {
            name: this.name,
            value: this.value,
        };
    }
    from(o) {
        o = util.ensure(o, "obj");
        this.value = o.value;
        return this;
    }
    static from(o) {
        o = util.ensure(o, "obj");
        return new this(o.name, o.value);
    }
};
Panel.GraphTab = class PanelGraphTab extends Panel.ToolCanvasTab {
    #lVars; #rVars;

    #viewMode;
    #viewParams;

    constructor(...a) {
        super("Graph", "graph");

        this.elem.classList.add("graph");

        this.#lVars = new Set();
        this.#rVars = new Set();

        this.#viewMode = "all";
        this.#viewParams = {};

        ["l", "v", "r"].forEach(id => {
            const elem = document.createElement("div");
            elem.id = id;
            this.addEOptionSection(elem);
            elem.classList.add("section");
            let form = new core.Form();
            elem.appendChild(form.elem);
            form.side = "center";
            form.addField(new core.Form.Header({ l: "Left Axis", v: "View Window", r: "Right Axis" }[id]));
            let idfs = {
                l: () => {
                    elem.classList.add("list");
                    const update = () => {
                        if (this.lVars.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    };
                    this.addHandler("change-addLVar", update);
                    this.addHandler("change-remLVar", update);
                    update();
                },
                r: () => {
                    elem.classList.add("list");
                    const update = () => {
                        if (this.rVars.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    };
                    this.addHandler("change-addRVar", update);
                    this.addHandler("change-remRVar", update);
                    update();
                },
                v: () => {
                    elem.classList.add("view");
                    const viewModes = ["left", "right", "section", "all"];
                    let fViewMode = form.addField(new core.Form.SelectInput("view-mode", viewModes));
                    fViewMode.showHeader = false;
                    fViewMode.addHandler("change-value", () => (this.viewMode = fViewMode.value));
                    new ResizeObserver(() => {
                        let r = fViewMode.elem.getBoundingClientRect();
                        let small = r.width < 250;
                        fViewMode.values = fViewMode.values.map(data => {
                            if (small) {
                                if (util.is(data, "obj")) return data;
                                return { value: data, name: {
                                    left: "L", right: "R",
                                    section: "Sect",
                                    all: "*",
                                }[data] };
                            } else {
                                if (util.is(data, "obj")) return data.value;
                                return data;
                            }
                        });
                    }).observe(fViewMode.elem);
                    form.addField(new core.Form.Line());
                    let forms = {};
                    viewModes.forEach(mode => {
                        let form = forms[mode] = new core.Form();
                        elem.appendChild(form.elem);
                        let modefs = {
                            left: () => {
                                let input = form.addField(new core.Form.Input1d("forwards-view-time"));
                                this.addHandler("add", () => (input.app = this.app));
                                this.addHandler("rem", () => (input.app = this.app));
                                input.types = ["ms", "s", "min"];
                                input.baseType = "ms";
                                input.activeType = "s";
                                input.step = 0.1;
                                input.inputs.forEach(inp => {
                                    inp.placeholder = "...";
                                    inp.min = 0;
                                });
                                input.addHandler("change-value", () => {
                                    let v = Math.max(0, input.value);
                                    this.change("viewParams.time", this.viewParams.time, this.viewParams.time=v);
                                });
                                this.addHandler("change-viewParams.time", () => (input.value = this.viewParams.time));
                                this.change("viewParams.time", null, this.viewParams.time=5000);
                            },
                            right: () => {
                                let input = form.addField(new core.Form.Input1d("backwards-view-time"));
                                this.addHandler("add", () => (input.app = this.app));
                                this.addHandler("rem", () => (input.app = this.app));
                                input.types = ["ms", "s", "min"];
                                input.baseType = "ms";
                                input.activeType = "s";
                                input.step = 0.1;
                                input.inputs.forEach(inp => {
                                    inp.placeholder = "...";
                                    inp.min = 0;
                                });
                                input.addHandler("change-value", () => {
                                    let v = Math.max(0, input.value);
                                    this.change("viewParams.time", this.viewParams.time, this.viewParams.time=v);
                                });
                                this.addHandler("change-viewParams.time", () => (input.value = this.viewParams.time));
                                this.change("viewParams.time", null, this.viewParams.time=5000);
                            },
                            section: () => {
                                let startInput = form.addField(new core.Form.Input1d("range-start"));
                                this.addHandler("add", () => (startInput.app = this.app));
                                this.addHandler("rem", () => (startInput.app = this.app));
                                startInput.types = ["ms", "s", "min"];
                                startInput.baseType = "ms";
                                startInput.activeType = "s";
                                startInput.step = 0.1;
                                startInput.inputs.forEach(inp => {
                                    inp.placeholder = "...";
                                });
                                startInput.addHandler("change-value", () => {
                                    let v = Math.max(0, startInput.value);
                                    this.change("viewParams.start", this.viewParams.start, this.viewParams.start=v);
                                });
                                let stopInput = form.addField(new core.Form.Input1d("range-start"));
                                this.addHandler("add", () => (stopInput.app = this.app));
                                this.addHandler("rem", () => (stopInput.app = this.app));
                                stopInput.types = ["ms", "s", "min"];
                                stopInput.baseType = "ms";
                                stopInput.activeType = "s";
                                stopInput.step = 0.1;
                                stopInput.inputs.forEach(inp => {
                                    inp.placeholder = "...";
                                });
                                stopInput.addHandler("change-value", () => {
                                    let v = Math.max(0, stopInput.value);
                                    this.change("viewParams.stop", this.viewParams.stop, this.viewParams.stop=v);
                                });
                                this.addHandler("change-viewParams.start", () => (startInput.value = this.viewParams.start));
                                this.addHandler("change-viewParams.stop", () => (stopInput.value = this.viewParams.stop));
                                this.change("viewParams.start", null, this.viewParams.start=0);
                                this.change("viewParams.stop", null, this.viewParams.stop=5000);
                            },
                        };
                        if (mode in modefs) modefs[mode]();
                    });
                    const update = () => {
                        fViewMode.value = this.viewMode;
                        for (let mode in forms)
                            forms[mode].isShown = mode == this.viewMode;
                    };
                    this.addHandler("change-viewMode", update);
                    update();
                },
            };
            if (id in idfs) idfs[id]();
        });

        const quality = this.quality = 2;
        const padding = 40;
        const qpadding = padding*quality;

        let mouseX = 0, mouseY = 0, mouseDown = false, mouseAlt = false;
        this.canvas.addEventListener("mousemove", e => {
            eGraphTooltip.style.left = e.pageX+"px";
            eGraphTooltip.style.top = e.pageY+"px";
            let r = this.canvas.getBoundingClientRect();
            let x = e.pageX;
            x -= r.left + padding;
            x /= r.width - 2*padding;
            mouseX = x;
            let y = e.pageY;
            y -= r.top + padding;
            y /= r.height - 2*padding;
            mouseY = y;
        });
        this.canvas.addEventListener("mouseenter", e => {
            if (!(overlay instanceof HTMLDivElement)) return;
            overlay.appendChild(eGraphTooltip);
        });
        this.canvas.addEventListener("mouseleave", e => eGraphTooltip.remove());
        this.canvas.addEventListener("mousedown", e => {
            e.preventDefault();
            e.stopPropagation();
            mouseDown = true;
            mouseAlt = e.shiftKey || e.button != 0;
        });
        this.canvas.addEventListener("mouseup", e => {
            mouseDown = false;
            mouseAlt = false;
        });
        let scrollX = 0, scrollY = 0, scrollAxis = null;
        this.canvas.addEventListener("wheel", e => {
            scrollX += e.deltaX;
            scrollY += e.deltaY;
        });

        const overlay = document.getElementById("overlay");
        let eGraphTooltip = document.createElement("div");
        eGraphTooltip.id = "graphtooltip";
        let eName = eGraphTooltip.eName = document.createElement("div");
        eGraphTooltip.appendChild(eName);
        eName.classList.add("name");
        eName.textContent = "Tooltip Name";
        let eContent = eGraphTooltip.eContent = document.createElement("div");
        eGraphTooltip.appendChild(eContent);
        eContent.classList.add("content");
        eContent.innerHTML = "<ion-icon name='return-down-forward'></ion-icon>";
        let eValue = eGraphTooltip.eValue = document.createElement("div");
        eContent.appendChild(eValue);
        eValue.classList.add("value");
        eValue.textContent = "0.1";

        let tooltipCycle = 0;
        const onKeyDown = e => {
            if (e.code != "Tab") return;
            e.preventDefault();
            e.stopPropagation();
            tooltipCycle++;
        };
        this.addHandler("add", () => document.body.addEventListener("keydown", onKeyDown));
        this.addHandler("rem", () => document.body.removeEventListener("keydown", onKeyDown));

        let t0 = null;
        this.addHandler("update", delta => {
            if (this.isClosed) return;
            
            const ctx = this.ctx;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            if (!this.hasPage() || !this.page.hasSource()) return;
            const source = this.page.source;
            let minTime = source.tsMin, maxTime = source.tsMax;
            const graphRange = {
                left: () => [
                    minTime,
                    Math.min(maxTime, minTime+Math.max(0, util.ensure(this.viewParams.time, "num", 5000))),
                ],
                right: () => [
                    Math.max(minTime, maxTime-Math.max(0, util.ensure(this.viewParams.time, "num", 5000))),
                    maxTime,
                ],
                section: () => {
                    let start = util.ensure(this.viewParams.start, "num", minTime);
                    let stop = util.ensure(this.viewParams.stop, "num", maxTime);
                    start = Math.min(maxTime, Math.max(minTime, start));
                    stop = Math.min(maxTime, Math.max(minTime, stop));
                    stop = Math.max(start, stop);
                    return [start, stop];
                },
                all: () => [minTime, maxTime],
            }[this.viewMode]();
            let graphVars = [
                { vars: this.lVars },
                { vars: this.rVars },
            ];
            graphVars.forEach((o, i) => {
                let vars = o.vars;
                let range = [null, null];
                let logs = {}, nodes = {};
                vars.forEach(v => {
                    let node;
                    node = v.shownHook.hasPath() ? source.tree.lookup(v.shownHook.path) : null;
                    v.shownHook.setFrom((node && node.hasField()) ? node.field.type : "*", (node && node.hasField()) ? node.field.get() : null);
                    if (!v.shown) return;
                    node = source.tree.lookup(v.path);
                    if (!node) return v.disable();
                    if (!node.hasField()) return v.disable();
                    if (!node.field.isJustPrimitive) return v.disable();
                    let log = node.field.getRange(...graphRange).map(log => {
                        return { ts: log.ts, v: v.execExpr(log.v) };
                    });
                    if (!util.is(log, "arr")) return v.disable();
                    let start = node.field.get(graphRange[0]), stop = node.field.get(graphRange[1]);
                    if (start != null) log.unshift({ ts: graphRange[0], v: start });
                    if (stop != null) log.push({ ts: graphRange[1], v: stop });
                    if (log.length <= 0) return v.disable();
                    if (v.isShown) {
                        logs[v.path] = log;
                        nodes[v.path] = node;
                    }
                    if (!["double", "float", "int"].includes(node.field.type)) return v.disable();
                    v.enable();
                    let subrange = [Math.min(...log.map(p => p.v)), Math.max(...log.map(p => p.v))];
                    if (range[0] == null || range[1] == null) return range = subrange;
                    range[0] = Math.min(range[0], subrange[0]);
                    range[1] = Math.max(range[1], subrange[1]);
                });
                range = range.map(v => util.ensure(v, "num"));
                let step = lib.findStep(range[1]-range[0], 5);
                range[0] = Math.floor(range[0]/step) - 1;
                range[1] = Math.ceil(range[1]/step) + 1;
                o.range = range;
                o.step = step;
                o.logs = logs;
                o.nodes = nodes;
            });
            let maxNSteps = 0;
            graphVars.forEach(o => {
                let range = o.range;
                maxNSteps = Math.max(maxNSteps, range[1]-range[0]);
            });
            graphVars.forEach(o => {
                let range = o.range;
                let nSteps = range[1]-range[0];
                let addAbove = Math.ceil((maxNSteps-nSteps) / 2);
                let addBelow = (maxNSteps-nSteps) - addAbove;
                range[0] -= addBelow;
                range[1] += addAbove;
                o.range = range;
            });
            const timeStep = lib.findStep(graphRange[1]-graphRange[0], 10);
            const mnx = qpadding, mxx = ctx.canvas.width-qpadding;
            const mny = qpadding, mxy = ctx.canvas.height-qpadding;
            let y0 = mny, y1 = mxy;
            let y2 = mxy + 5*quality;
            let y3 = mxy + 10*quality;
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.fillStyle = core.PROPERTYCACHE.get("--v6");
            ctx.font = (12*quality)+"px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            for (let i = Math.ceil(graphRange[0]/timeStep); i <= Math.floor(graphRange[1]/timeStep); i++) {
                let x = (i*timeStep - graphRange[0]) / (graphRange[1]-graphRange[0]);
                x = util.lerp(mnx, mxx, x);
                ctx.strokeStyle = core.PROPERTYCACHE.get("--v6");
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
                let t = i*timeStep, unit = "ms";
                if (t/1000 >= 1) {
                    t /= 1000;
                    unit = "s";
                }
                ctx.fillText(t+unit, x, y3);
                ctx.strokeStyle = core.PROPERTYCACHE.get("--v2");
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, y1);
                ctx.stroke();
            }
            ctx.strokeStyle = core.PROPERTYCACHE.get("--v2");
            for (let i = 0; i <= maxNSteps; i++) {
                let y = i / maxNSteps;
                y = util.lerp(mny, mxy, 1-y);
                ctx.beginPath();
                ctx.moveTo(mnx, y);
                ctx.lineTo(mxx, y);
                ctx.stroke();
            }
            let mouseXCanv = util.lerp(mnx, mxx, mouseX);
            let mouseYCanv = util.lerp(mny, mxy, mouseY);
            let foundTooltips = [];
            let nDiscrete = 0;
            graphVars.forEach((o, i) => {
                let vars = o.vars;
                let range = o.range;
                let step = o.step;
                let logs = o.logs;
                let nodes = o.nodes;
                let x1 = [mnx, mxx][i];
                let x2 = [mnx - 5*quality, mxx + 5*quality][i];
                let x3 = [mnx - 10*quality, mxx + 10*quality][i];
                ctx.strokeStyle = ctx.fillStyle = core.PROPERTYCACHE.get("--v6");
                ctx.lineWidth = 1*quality;
                ctx.lineJoin = "miter";
                ctx.lineCap = "square";
                ctx.font = (12*quality)+"px monospace";
                ctx.textAlign = ["right", "left"][i];
                ctx.textBaseline = "middle";
                for (let j = range[0]; j <= range[1]; j++) {
                    let y = (j-range[0]) / (range[1]-range[0]);
                    y = util.lerp(mny, mxy, 1-y);
                    ctx.beginPath();
                    ctx.moveTo(x1, y);
                    ctx.lineTo(x2, y);
                    ctx.stroke();
                    ctx.fillText(j*step, x3, y);
                }
                vars.forEach(v => {
                    if (!(v.path in logs)) return;
                    if (!(v.path in nodes)) return;
                    let log = logs[v.path];
                    let node = nodes[v.path];
                    if (!["double", "float", "int"].includes(node.field.type)) {
                        log = log.filter((p, i) => {
                            if (i <= 0) return true;
                            return p.v != log[i-1].v;
                        });
                        log.forEach((p, i) => {
                            let pts = p.ts, pv = p.v;
                            let npts = (i+1 >= log.length) ? graphRange[1] : log[i+1].ts;
                            let x = util.lerp(mnx, mxx, (pts-graphRange[0])/(graphRange[1]-graphRange[0]));
                            let nx = util.lerp(mnx, mxx, (npts-graphRange[0])/(graphRange[1]-graphRange[0]));
                            ctx.fillStyle = v.hasColor() ? v.color.startsWith("--") ? core.PROPERTYCACHE.get(v.color+(i%2==0?"2":"")) : v.color : "#fff";
                            ctx.fillRect(
                                x, (padding+10+20*nDiscrete)*quality,
                                Math.max(0, nx-x), 15*quality,
                            );
                            ctx.fillStyle = core.PROPERTYCACHE.get("--v"+(i%2==0?"8":"1"));
                            ctx.font = (12*quality)+"px monospace";
                            ctx.textAlign = "left";
                            ctx.textBaseline = "middle";
                            ctx.fillText(pv, x+5*quality, (padding+10+20*nDiscrete+7.5)*quality);
                        });
                        nDiscrete++;
                        return;
                    }
                    let ranges = [];
                    for (let i = 0; i < log.length; i++) {
                        let p = log[i];
                        let ts = p.ts, v = p.v;
                        let x = util.lerp(mnx, mxx, (ts-graphRange[0])/(graphRange[1]-graphRange[0]));
                        if (ranges.length > 0) {
                            let px = ranges.at(-1).x;
                            let r = ranges.at(-1).r;
                            if (x-px > quality) ranges.push({ x: x, r: [v, v], v: v });
                            else {
                                r[0] = Math.min(r[0], v);
                                r[1] = Math.max(r[1], v);
                            }
                        } else ranges.push({ x: x, r: [v, v], v: v });
                    }
                    ctx.strokeStyle = v.hasColor() ? v.color.startsWith("--") ? core.PROPERTYCACHE.get(v.color) : v.color : "#fff";
                    ctx.lineWidth = 1*quality;
                    ctx.lineJoin = "round";
                    ctx.lineCap = "square";
                    ctx.beginPath();
                    let py = null;
                    ranges.forEach((p, i) => {
                        let x = p.x, r = p.r, v = p.v;
                        let y1 = r[0], y2 = r[1];
                        y1 = (y1-(step*range[0])) / (step*(range[1]-range[0]));
                        y2 = (y2-(step*range[0])) / (step*(range[1]-range[0]));
                        y1 = util.lerp(mny, mxy, 1-y1);
                        y2 = util.lerp(mny, mxy, 1-y2);
                        if (i > 0) {
                            ctx.lineTo(x, py);
                            ctx.lineTo(x, (y1+y2)/2);
                        } else ctx.moveTo(x, (y1+y2)/2);
                        ctx.lineTo(x, y1);
                        ctx.lineTo(x, y2);
                        ctx.lineTo(x, (y1+y2)/2);
                        py = (y1+y2)/2
                        if (mouseXCanv >= x && (i+1 >= ranges.length || mouseXCanv < ranges[i+1].x)) {
                            if (Math.abs(py-mouseYCanv) < 2*quality) {
                                foundTooltips.push({
                                    name: node.path,
                                    color: ctx.strokeStyle,
                                    value: v,
                                });
                            }
                        }
                    });
                    ctx.stroke();
                });
            });
            if (foundTooltips.length > 0) {
                tooltipCycle %= foundTooltips.length;
                eGraphTooltip.classList.add("this");
                eName.textContent = foundTooltips[tooltipCycle].name;
                eName.style.color = foundTooltips[tooltipCycle].color;
                eValue.textContent = foundTooltips[tooltipCycle].value;
            } else eGraphTooltip.classList.remove("this");
            ctx.strokeStyle = core.PROPERTYCACHE.get("--v6");
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.beginPath();
            ctx.strokeRect(mnx, mny, mxx-mnx, mxy-mny);
            ctx.font = (12*quality)+"px monospace";
            ctx.textBaseline = "top";
            ctx.textAlign = "left";
            let ranges = [];
            [
                {
                    value: (this.hasPage() && this.page.hasSource()) ? this.page.source.ts : 0,
                    color: "v4",
                },
                {
                    value: util.lerp(...graphRange, mouseX),
                    color: "v4-8",
                    show: !mouseDown || mouseAlt,
                },
                {
                    value: t0,
                    color: "v4-8",
                    show: mouseAlt,
                },
            ].forEach(data => {
                ctx.fillStyle = ctx.strokeStyle = core.PROPERTYCACHE.get("--"+data.color);
                let progress = (data.value-graphRange[0]) / (graphRange[1]-graphRange[0]);
                let x = util.lerp(mnx, mxx, progress);
                if ((!("show" in data) || data.show) && progress >= 0 && progress <= 1) {
                    ctx.setLineDash([5*quality, 5*quality]);
                    ctx.beginPath();
                    ctx.moveTo(x, mny);
                    ctx.lineTo(x, mxy);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    let text = util.formatTime(data.value);
                    let newRange = [x, x+ctx.measureText(text).width+10*quality];
                    if (newRange[1] > mxx) newRange = [newRange[0]-(newRange[1]-newRange[0]), newRange[1]-(newRange[1]-newRange[0])];
                    let rangeY = 0;
                    while (true) {
                        let any = false;
                        while (ranges.length <= rangeY) ranges.push([]);
                        for (let range of ranges[rangeY]) {
                            if (newRange[1] < range[0]) continue;
                            if (newRange[0] > range[1]) continue;
                            any = true;
                            break;
                        }
                        if (!any) break;
                        rangeY++;
                    }
                    ranges[rangeY].push(newRange);
                    ctx.fillText(text, newRange[0]+5*quality, mny + 10*quality + 20*quality*nDiscrete + (12+5)*rangeY*quality);
                }
            });
            if (mouseDown && !mouseAlt)
                if (this.hasPage() && this.page.hasSource())
                    this.page.source.ts = util.lerp(...graphRange, mouseX);
            if (mouseAlt) {
                if (t0 == null)
                    t0 = util.lerp(...graphRange, mouseX);
            } else t0 = null;
            if (mouseAlt) {
                let t1 = util.lerp(...graphRange, mouseX);
                let t0Value = Math.min(graphRange[1], Math.max(graphRange[0], t0));
                let t1Value = Math.min(graphRange[1], Math.max(graphRange[0], t1));
                let x0 = util.lerp(mnx, mxx, (t0Value-graphRange[0])/(graphRange[1]-graphRange[0]));
                let x1 = util.lerp(mnx, mxx, (t1Value-graphRange[0])/(graphRange[1]-graphRange[0]));
                let y = mxy-10*quality;
                ctx.strokeStyle = ctx.fillStyle = core.PROPERTYCACHE.get("--a");
                ctx.beginPath();
                ctx.moveTo(x0, y);
                ctx.lineTo(x1, y);
                if (t0 == t0Value) {
                    ctx.moveTo(x0, y-5*quality);
                    ctx.lineTo(x0, y+5*quality);
                }
                if (t1 == t1Value) {
                    ctx.moveTo(x1, y-5*quality);
                    ctx.lineTo(x1, y+5*quality);
                }
                ctx.stroke();
                ctx.textBaseline = "bottom";
                ctx.textAlign = "center";
                ctx.fillText("∆ "+util.formatTime(t1-t0), (x0+x1)/2, y-5*quality);
            }
            let scroll = new V(scrollX, scrollY);
            let scrollAngle = util.clampAngle(scroll.towards(0, 0)+180);
            let scrollMag = scroll.dist();
            if (scrollMag > 3) {
                if (scrollAxis == null)
                    scrollAxis = (Math.min(Math.abs(scrollAngle-90), Math.abs(scrollAngle-270)) < 45) ? "y" : "x";
                if (Math.min(Math.abs(scrollAngle-180), Math.abs(scrollAngle-270)) < 45) scrollMag *= -1;
                scrollMag *= 0.0005;
                let newGraphRange = [...graphRange];
                if (scrollAxis == "x") {
                    let shift = (newGraphRange[1]-newGraphRange[0]) * scrollMag;
                    newGraphRange = newGraphRange.map(v => v+shift);
                } else {
                    let ts = util.lerp(...graphRange, mouseX);
                    newGraphRange = newGraphRange.map(v => util.lerp(v, ts, scrollMag));
                }
                this.viewMode = "section";
                if (newGraphRange[1]-newGraphRange[0] <= 0) newGraphRange[1] = newGraphRange[0]+0.001;
                if (newGraphRange[1]-newGraphRange[0] > maxTime-minTime) newGraphRange[1] = newGraphRange[0]+(maxTime-minTime);
                if (newGraphRange[0] < minTime) newGraphRange = newGraphRange.map(v => v+(minTime-newGraphRange[0]));
                if (newGraphRange[1] > maxTime) newGraphRange = newGraphRange.map(v => v+(maxTime-newGraphRange[1]));
                newGraphRange = newGraphRange.map(v => Math.min(maxTime, Math.max(minTime, Math.round(v*1000000)/1000000)));
                this.change("viewParams.start", this.viewParams.start, this.viewParams.start=newGraphRange[0]);
                this.change("viewPrams.stop", this.viewParams.stop, this.viewParams.stop=newGraphRange[1]);
            } else scrollAxis = null;
            scrollX = scrollY = 0;
        });

        if (a.length <= 0 || [4].includes(a.length) || a.length > 5) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.GraphTab) a = [a.lVars, a.rVars, a.viewMode, a.viewParams, a.optionState];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof Panel.GraphTab.Variable) a = [a, []];
                else {
                    a = new Panel.GraphTab(...a);
                    a = [a.lVars, a.rVars, a.viewMode, a.viewParams, a.optionState];
                }
            }
            else if (a instanceof Panel.GraphTab.Variable) a = [[a], []];
            else if (util.is(a, "obj")) a = [a.lVars, a.rVars, a.viewMode, a.viewParams, a.optionState];
            else a = [[], []];
        }
        if (a.length == 2)
            a = [...a, true];
        if (a.length == 3) {
            if (util.is(a[2], "str")) a = [...a, {}, 0.5];
            else a = [a[0], a[1], "all", {}, a[2]];
        }

        [this.lVars, this.rVars, this.viewMode, this.viewParams, this.optionState] = a;
    }

    compute() {
        super.compute();
        try {
            this.lVars.forEach(v => v.compute());
            this.rVars.forEach(v => v.compute());
        } catch (e) {}
    }

    get lVars() { return [...this.#lVars]; }
    set lVars(v) {
        v = util.ensure(v, "arr");
        this.clearLVars();
        this.addLVar(v);
    }
    clearLVars() {
        let lVars = this.lVars;
        this.remLVar(lVars);
        return lVars;
    }
    hasLVar(lVar) {
        if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
        return this.#lVars.has(lVar) && lVar.tab == this;
    }
    addLVar(...lVars) {
        return util.Target.resultingForEach(lVars, lVar => {
            if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
            if (this.hasLVar(lVar)) return false;
            if (lVar.tab != null) return false;
            this.#lVars.add(lVar);
            lVar.addLinkedHandler(this, "remove", () => this.remLVar(lVar));
            lVar.addLinkedHandler(this, "change", (c, f, t) => this.change("lVars["+this.lVars.indexOf(lVar)+"]."+c, f, t));
            if (this.hasEOptionSection("l"))
                this.getEOptionSection("l").appendChild(lVar.elem);
            this.change("addLVar", null, lVar);
            lVar.tab = this;
            lVar.onAdd();
            return lVar;
        });
    }
    remLVar(...lVars) {
        return util.Target.resultingForEach(lVars, lVar => {
            if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
            if (!this.hasLVar(lVar)) return false;
            if (lVar.tab != this) return false;
            lVar.onRem();
            lVar.tab = null;
            this.#lVars.delete(lVar);
            lVar.clearLinkedHandlers(this, "remove");
            lVar.clearLinkedHandlers(this, "change");
            if (this.hasEOptionSection("l"))
                this.getEOptionSection("l").removeChild(lVar.elem);
            this.change("remLVar", lVar, null);
            return lVar;
        });
    }
    get rVars() { return [...this.#rVars]; }
    set rVars(v) {
        v = util.ensure(v, "arr");
        this.clearRVars();
        this.addRVar(v);
    }
    clearRVars() {
        let rVars = this.rVars;
        this.remRVar(rVars);
        return rVars;
    }
    hasRVar(rVar) {
        if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
        return this.#rVars.has(rVar) && rVar.tab == this;
    }
    addRVar(...rVars) {
        return util.Target.resultingForEach(rVars, rVar => {
            if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
            if (this.hasRVar(rVar)) return false;
            if (rVar.tab != null) return false;
            this.#rVars.add(rVar);
            rVar.addLinkedHandler(this, "remove", () => this.remRVar(rVar));
            rVar.addLinkedHandler(this, "change", (c, f, t) => this.change("rVars["+this.rVars.indexOf(rVar)+"]."+c, f, t));
            if (this.hasEOptionSection("r"))
                this.getEOptionSection("r").appendChild(rVar.elem);
            this.change("addRVar", null, rVar);
            rVar.tab = this;
            rVar.onAdd();
            return rVar;
        });
    }
    remRVar(...rVars) {
        return util.Target.resultingForEach(rVars, rVar => {
            if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
            if (!this.hasRVar(rVar)) return false;
            if (rVar.tab != this) return false;
            rVar.onRem();
            rVar.tab = null;
            this.#rVars.delete(rVar);
            rVar.clearLinkedHandlers(this, "remove");
            rVar.clearLinkedHandlers(this, "change");
            if (this.hasEOptionSection("r"))
                this.getEOptionSection("r").removeChild(rVar.elem);
            this.change("remRVar", rVar, null);
            return rVar;
        });
    }

    get viewMode() { return this.#viewMode; }
    set viewMode(v) {
        v = String(v);
        if (this.viewMode == v) return;
        if (!["right", "left", "section", "all"].includes(v)) return;
        this.change("viewMode", this.viewMode, this.#viewMode=v);
    }
    get viewParams() { return this.#viewParams; }
    set viewParams(v) {
        v = util.ensure(v, "obj");
        this.#viewParams = {};
        for (let k in v) {
            this.#viewParams[k] = v[k];
            this.change("viewParams."+k, null, this.viewParams[k]);
        }
    }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.optionState == 0) return null;
        let r;
        r = this.eOptions.getBoundingClientRect();
        if (pos.x < r.left || pos.x > r.right) return null;
        if (pos.y < r.top || pos.y > r.bottom) return null;
        if (data instanceof Panel.BrowserTab) data = (this.hasPage() && this.page.hasSource()) ? this.page.source.tree.lookup(data.path) : null;
        if (!(data instanceof Source.Node)) return null;
        if (!data.hasField()) return null;
        for (let i = 0; i < this.eOptionSections.length; i++) {
            let id = this.eOptionSections[i];
            let elem = this.getEOptionSection(id);
            r = elem.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            let idfs = {
                _: side => {
                    for (let v of this[side+"Vars"]) {
                        let hovered = v.getHovered(data, pos, options);
                        if (hovered) return hovered;
                    }
                    return {
                        r: r,
                        submit: () => {
                            const colors = "rybgpocm";
                            const addVar = node => {
                                let pth = node.path;
                                if (node.hasField() && node.field.isJustPrimitive) {
                                    let taken = new Array(colors.length).fill(false);
                                    [...this.lVars, ...this.rVars].forEach(v => {
                                        colors.split("").forEach((c, i) => {
                                            if (v.color == "--c"+c) taken[i] = true;
                                        });
                                    });
                                    let nextColor = null;
                                    taken.forEach((v, i) => {
                                        if (v) return;
                                        if (nextColor != null) return;
                                        nextColor = colors[i];
                                    });
                                    if (nextColor == null) nextColor = colors[(this.lVars.length+this.rVars.length)%colors.length];
                                    this["add"+side.toUpperCase()+"Var"](new Panel.GraphTab.Variable(pth, "--c"+nextColor));
                                }
                                node.nodeObjects.forEach(node => addVar(node));
                            };
                            addVar(data);
                        },
                    };
                },
                l: () => idfs._("l"),
                r: () => idfs._("r"),
            };
            if (elem.id in idfs) {
                let data = idfs[elem.id]();
                if (util.is(data, "obj")) return data;
            }
        }
        return null;
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            lVars: this.lVars,
            rVars: this.rVars,
            viewMode: this.viewMode,
            viewParams: this.viewParams,
            optionState: this.optionState,
        });
    }
};
Panel.GraphTab.Variable = class PanelGraphTabVariable extends util.Target {
    #tab;
    #parent;
    #page;
    #app;

    #path;
    #shown;
    #color;

    #shownHook;

    #expr;
    #exprCompiled;
    #fExpr;

    #elem;
    #eDisplay;
    #eShowBox;
    #eShow;
    #eShowDisplay;
    #eDisplayName;
    #eRemoveBtn;
    #eContent;
    #eColorPicker;
    #eColorPickerColors;

    constructor(...a) {
        super();

        this.#tab = null;
        this.#parent = null;
        this.#page = null;
        this.#app = null;

        this.#path = "";
        this.#shown = null;
        this.#color = null;

        this.#shownHook = new Panel.ToolCanvasTab.Hook("Visibility Hook", null);
        this.shownHook.toggle.show();
        this.shownHook.addHandler("change", (c, f, t) => this.change("shownHook."+c, f, t));

        const form = new core.Form();

        this.#expr = null;
        this.#exprCompiled = null;
        this.#fExpr = form.addField(new core.Form.TextInput("expression"));
        this.fExpr.type = "";
        this.fExpr.isHorizontal = true;
        this.fExpr.addHandler("change-value", () => {
            const value = this.fExpr.value;
            this.expr = (value.length > 0) ? value : null;
        });

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eShowBox = document.createElement("label");
        this.eDisplay.appendChild(this.eShowBox);
        this.eShowBox.classList.add("checkbox");
        this.eShowBox.style.setProperty("--size", "10px");
        this.eShowBox.innerHTML = "<input type='checkbox'><span></span>";
        this.#eShow = this.eShowBox.children[0];
        this.#eShowDisplay = this.eShowBox.children[1];
        this.#eDisplayName = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayName);
        this.#eRemoveBtn = document.createElement("button");
        this.eDisplay.appendChild(this.eRemoveBtn);
        this.eRemoveBtn.classList.add("icon");
        this.eRemoveBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eColorPicker = document.createElement("div");
        this.eContent.appendChild(this.eColorPicker);
        this.eColorPicker.classList.add("colorpicker");
        this.#eColorPickerColors = [];
        COLORS.forEach(colors => {
            let btn = document.createElement("button");
            this.eColorPicker.appendChild(btn);
            this.#eColorPickerColors.push(btn);
            btn.color = "--"+colors._;
            btn.style.setProperty("--bg", "var(--"+colors._+")");
            btn.style.setProperty("--bgh", "var(--"+colors.h+")");
            btn.style.setProperty("--bgd", "var(--"+colors.d+")");
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.color = btn.color;
            });
        });

        this.eContent.appendChild(this.shownHook.elem);
        this.eContent.appendChild(form.elem);

        this.eDisplay.addEventListener("contextmenu", e => {
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item(this.isOpen ? "Close" : "Open"));
            itm.addHandler("trigger", e => {
                this.isOpen = !this.isOpen;
            });
            itm = menu.addItem(new core.App.Menu.Item(this.shown ? "Hide" : "Show"));
            itm.addHandler("trigger", e => {
                this.shown = !this.shown;
            });
            itm = menu.addItem(new core.App.Menu.Item("Remove"));
            itm.addHandler("trigger", e => {
                this.eRemoveBtn.click();
            });
            menu.addItem(new core.App.Menu.Divider());
            itm = menu.addItem(new core.App.Menu.Item("Colors"));
            let submenu = itm.menu;
            COLORS.forEach(colors => {
                itm = submenu.addItem(new core.App.Menu.Item(colors.name));
                itm.eLabel.style.color = "var(--"+colors._+")";
                itm.addHandler("trigger", e => {
                    this.color = "--"+colors._;
                });
            });
            if (!this.hasApp()) return;
            this.app.contextMenu = menu;
            this.app.placeContextMenu(e.pageX, e.pageY);
        });

        this.eShowBox.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.eShow.addEventListener("change", e => {
            this.shown = this.eShow.checked;
        });
        this.eRemoveBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove");
        });
        this.eDisplay.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        if (a.length <= 0 || a.length > 5) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.GraphTab.Variable) a = [a.path, a.shown, a.color, a.shownHook.to(), a.expr];
            else if (util.is(a, "arr")) {
                a = new Panel.GraphTab.Variable(...a);
                a = [a.path, a.shown, a.color, a.shownHook.to(), a.expr];
            }
            // TODO: remove when fixed
            else if (util.is(a, "obj")) a = [a.path, a.shown || a.isShown, a.color, a.shownHook, a.expr];
            else a = [[], null];
        }
        if (a.length == 2) a = [a[0], true, a[1]];
        if (a.length == 3) a = [...a, null];
        if (a.length == 4) a = [...a, null];

        [this.path, this.shown, this.color, this.shownHook, this.expr] = a;
    }

    get tab() { return this.#tab; }
    set tab(v) {
        v = (v instanceof Panel.GraphTab) ? v : null;
        if (this.tab == v) return;
        this.#tab = v;
        this.compute();
    }
    hasTab() { return !!this.tab; }
    get parent() { return this.#parent; }
    hasParent() { return !!this.parent; }
    get page() { return this.#page; }
    hasPage() { return !!this.page; }
    get app() { return this.#app; }
    hasApp() { return !!this.app; }
    compute() {
        this.#parent = this.hasTab() ? this.tab.parent : null;
        this.#page = this.hasParent() ? this.parent.page : null;
        this.#app = this.hasPage() ? this.page.app : null;
    }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.eDisplayName.textContent = this.path;
    }
    get shown() { return this.#shown; }
    set shown(v) {
        v = !!v;
        if (this.shown == v) return;
        this.change("shown", this.shown, this.#shown=v);
        this.eShow.checked = this.shown;
    }
    get hidden() { return !this.shown; }
    set hidden(v) { this.shown = !v; }
    show() { return this.shown = true; }
    hide() { return this.hidden = true; }
    get color() { return this.#color; }
    set color(v) {
        v = (v == null) ? null : String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
        let color = this.hasColor() ? this.color.startsWith("--") ? core.PROPERTYCACHE.get(this.color) : this.color : "#fff";
        this.eShowBox.style.setProperty("--bgc", color);
        this.eShowBox.style.setProperty("--bgch", color);
        this.eDisplayName.style.color = color;
        this.eColorPickerColors.forEach(btn => {
            if (btn.color == this.color) btn.classList.add("this");
            else btn.classList.remove("this");
        });
    }
    hasColor() { return this.color != null; }

    get hooks() { return [this.shownHook]; }
    get shownHook() { return this.#shownHook; }
    set shownHook(o) { this.shownHook.from(o); }
    get isShown() {
        if (!this.shown) return false;
        if (this.shownHook.value == null) return true;
        if (this.shownHook.toggle.value)
            return !this.shownHook.value;
        return this.shownHook.value;
    }

    get expr() { return this.#expr; }
    set expr(v) {
        v = (v == null) ? null : String(v);
        if (this.expr == v) return;
        this.change("expr", this.expr, this.#expr=v);
        this.fExpr.value = this.hasExpr() ? this.expr : "";
        this.compileExpr();
    }
    hasExpr() { return this.expr != null; }
    get exprCompiled() { return this.#exprCompiled; }
    compileExpr() {
        if (!this.hasExpr()) return this.#exprCompiled = null;
        return this.#exprCompiled = lib.mathjs.compile(this.expr);
    }
    execExpr(x) {
        if (!this.hasExpr()) return x;
        if (!this.#exprCompiled) return x;
        return this.exprCompiled.evaluate({ x: x });
    }
    get fExpr() { return this.#fExpr; }
    
    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.isClosed) return null;
        if (data instanceof Panel.BrowserTab) data = (this.hasPage() && this.page.hasSource()) ? this.page.source.tree.lookup(data.path) : null;
        if (!(data instanceof Source.Node)) return null;
        if (!data.hasField()) return null;
        if (!data.field.isJustPrimitive) return null;
        for (let hook of this.hooks) {
            let r = hook.eBox.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            return {
                r: r,
                submit: () => {
                    hook.path = data.path;
                },
            };
        }
        return null;
    }

    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eShowBox() { return this.#eShowBox; }
    get eShow() { return this.#eShow; }
    get eShowDisplay() { return this.#eShowDisplay; }
    get eDisplayName() { return this.#eDisplayName; }
    get eRemoveBtn() { return this.#eRemoveBtn; }
    get eContent() { return this.#eContent; }
    get eColorPicker() { return this.#eColorPicker; }
    get eColorPickerColors() { return [...this.#eColorPickerColors]; }

    get isOpen() { return this.elem.classList.contains("open"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        if (v) this.elem.classList.add("open");
        else this.elem.classList.remove("open");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get disabled() { return this.elem.classList.contains("disabled"); }
    set disabled(v) {
        v = !!v;
        if (this.disabled == v) return;
        if (v) this.elem.classList.add("disabled");
        else this.elem.classList.remove("disabled");
    }
    get enabled() { return !this.enabled; }
    set enabled(v) { this.disabled = !v; }
    disable() { return this.disabled = true; }
    enable() { return this.enabled = true; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            shown: this.shown,
            color: this.color,
            shownHook: this.shownHook.to(),
            expr: this.expr,
        });
    }
};
Panel.OdometryTab = class PanelOdometryTab extends Panel.ToolCanvasTab {
    #poses;

    #template;

    #fTemplate;

    static PATTERNS = {};

    constructor(tail="") {
        super("Odometry"+tail, "odometry"+String(tail).toLowerCase());

        this.elem.classList.add("odometry");

        this.#poses = new Set();

        this.#template = "§null";

        let ignore = false;
        let templates = {};
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
            ignore = true;
            this.fTemplate.values = [{ value: "§null", name: "No Template" }, null, ...Object.keys(templates)];
            ignore = false;
            if (this.template != "§null") return;
            this.template = await window.api.get("active-template");
        })();

        ["p", "f", "o"].forEach(id => {
            const elem = document.createElement("div");
            elem.id = id;
            this.addEOptionSection(elem);
            elem.classList.add("section");
            let form = new core.Form();
            elem.appendChild(form.elem);
            form.side = "center";
            form.addField(new core.Form.Header({ p: "Poses", f: "Field", o: "Options" }[id]));
            let idfs = {
                p: () => {
                    elem.classList.add("list");
                    const update = () => {
                        if (this.poses.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    };
                    this.addHandler("change-addPose", update);
                    this.addHandler("change-remPose", update);
                    update();
                },
                f: () => {
                    elem.classList.add("field");
                    let form = new core.Form();
                    elem.appendChild(form.elem);
                    this.#fTemplate = form.addField(new core.Form.DropdownInput("template", []));
                    const apply = () => {
                        this.fTemplate.value = (this.template == null) ? "§null" : this.template;
                    };
                    this.fTemplate.addHandler("change-values", apply);
                    this.addHandler("change-template", apply);
                    this.fTemplate.addHandler("change-value", () => {
                        if (ignore) return;
                        this.template = this.fTemplate.value == "§null" ? null : this.fTemplate.value;
                    });
                    this.addHandler("add", () => (this.fTemplate.app = this.app));
                    this.addHandler("rem", () => (this.fTemplate.app = this.app));
                },
                o: () => {
                    elem.classList.add("options");
                },
            };
            if (id in idfs) idfs[id]();
        });
    }

    compute() {
        super.compute();
        try {
            this.poses.forEach(pose => pose.state.compute());
        } catch (e) {}
    }

    get poses() { return [...this.#poses]; }
    set poses(v) {
        v = util.ensure(v, "arr");
        this.clearPoses();
        this.addPose(v);
    }
    clearPoses() {
        let poses = this.poses;
        this.remPose(poses);
        return poses;
    }
    hasPose(pose) {
        if (!(pose instanceof this.constructor.Pose)) return false;
        return this.#poses.has(pose);
    }
    addPose(...poses) {
        return util.Target.resultingForEach(poses, pose => {
            if (!(pose instanceof this.constructor.Pose)) return false;
            if (this.hasPose(pose)) return false;
            this.#poses.add(pose);
            pose.addLinkedHandler(this, "remove", () => this.remPose(pose));
            pose.addLinkedHandler(this, "change", (c, f, t) => this.change("poses["+this.poses.indexOf(pose)+"]."+c, f, t));
            if (this.hasEOptionSection("p"))
                this.getEOptionSection("p").appendChild(pose.elem);
            this.change("addPose", null, pose);
            pose.state.tab = this;
            pose.onAdd();
            return pose;
        });
    }
    remPose(...poses) {
        return util.Target.resultingForEach(poses, pose => {
            if (!(pose instanceof this.constructor.Pose)) return false;
            if (!this.hasPose(pose)) return false;
            pose.onRem();
            pose.state.tab = null;
            this.#poses.delete(pose);
            pose.clearLinkedHandlers(this, "remove");
            pose.clearLinkedHandlers(this, "change");
            if (this.hasEOptionSection("p"))
                this.getEOptionSection("p").removeChild(pose.elem);
            this.change("remPose", pose, null);
            return pose;
        });
    }

    get template() { return this.#template; }
    set template(v) {
        if (v == "§null") return;
        v = (v == null) ? null : String(v);
        if (this.template == v) return;
        this.change("template", this.template, this.#template=v);
    }

    getValue(node) {
        if (!(node instanceof Source.Node)) return null;
        if (!node.hasField()) return null;
        const field = node.field;
        if (field.isStruct && (field.structType in this.constructor.PATTERNS)) {
            let paths = util.ensure(this.constructor.PATTERNS[field.structType], "arr").map(path => util.ensure(path, "arr").map(v => String(v)));
            let value = paths.map(path => {
                let subnode = node.lookup(path.join("/"));
                if (!(subnode instanceof Source.Node)) return null;
                if (!subnode.hasField()) return null;
                return subnode.field.get();
            });
            return value;
        }
        return field.get();
    }
    getValueRange(node, tsStart=null, tsStop=null) {
        if (!(node instanceof Source.Node)) return null;
        if (!node.hasField()) return null;
        const field = node.field;
        if (field.isStruct && (field.structType in this.constructor.PATTERNS)) {
            let paths = util.ensure(this.constructor.PATTERNS[field.structType], "arr").map(path => util.ensure(path, "arr").map(v => String(v)));
            let range = paths.map(path => {
                let subnode = node.lookup(path.join("/"));
                if (!(subnode instanceof Source.Node)) return null;
                if (!subnode.hasField()) return null;
                return subnode.field.getRange(tsStart, tsStop);
            });
            return range;
        }
        return field.get(tsStart, tsStop);
    }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.optionState == 0) return null;
        let r;
        r = this.eOptions.getBoundingClientRect();
        if (pos.x < r.left || pos.x > r.right) return null;
        if (pos.y < r.top || pos.y > r.bottom) return null;
        if (data instanceof Panel.BrowserTab) data = (this.hasPage() && this.page.hasSource()) ? this.page.source.tree.lookup(data.path) : null;
        for (let i = 0; i < this.eOptionSections.length; i++) {
            let id = this.eOptionSections[i];
            let elem = this.getEOptionSection(id);
            r = elem.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            let idfs = {
                p: () => {
                    for (let pose of this.poses) {
                        let hovered = pose.getHovered(data, pos, options);
                        if (hovered) return hovered;
                    }
                    if (!(data instanceof Source.Node)) return null;
                    if (!data.hasField()) return null;
                    return {
                        r: r,
                        submit: () => {
                            const colors = "rybgpocm";
                            const addPose = pth => {
                                let taken = new Array(colors.length).fill(false);
                                this.poses.forEach(pose => {
                                    colors.split("").forEach((c, i) => {
                                        if (pose.color == "--c"+c) taken[i] = true;
                                    });
                                });
                                let nextColor = null;
                                taken.forEach((v, i) => {
                                    if (v) return;
                                    if (nextColor != null) return;
                                    nextColor = colors[i];
                                });
                                if (nextColor == null) nextColor = colors[this.poses.length%colors.length];
                                this.addPose(new this.constructor.Pose(pth, "--c"+nextColor));
                            };
                            addPose(data.path);
                        },
                    };
                },
            };
            if (elem.id in idfs) {
                let data = idfs[elem.id]();
                if (util.is(data, "obj")) return data;
            }
        }
        return null;
    }

    get fTemplate() { return this.#fTemplate; }
};
Panel.OdometryTab.Pose = class PanelOdometryTabPose extends util.Target {
    #path;
    #shown;
    #color;

    #shownHook;

    #state;

    #elem;
    #eDisplay;
    #eShowBox;
    #eShow;
    #eShowDisplay;
    #eDisplayName;
    #eRemoveBtn;
    #eContent;
    #eColorPicker;
    #eColorPickerColors;

    constructor(...a) {
        super();

        this.#path = "";
        this.#shown = null;
        this.#color = null;

        this.#shownHook = new Panel.ToolCanvasTab.Hook("Visibility Hook", null);
        this.shownHook.toggle.show();
        this.shownHook.addHandler("change", (c, f, t) => this.change("shownHook."+c, f, t));

        this.#state = new this.constructor.State();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eShowBox = document.createElement("label");
        this.eDisplay.appendChild(this.eShowBox);
        this.eShowBox.classList.add("checkbox");
        this.eShowBox.style.setProperty("--size", "10px");
        this.eShowBox.innerHTML = "<input type='checkbox'><span></span>";
        this.#eShow = this.eShowBox.children[0];
        this.#eShowDisplay = this.eShowBox.children[1];
        this.#eDisplayName = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayName);
        this.#eRemoveBtn = document.createElement("button");
        this.eDisplay.appendChild(this.eRemoveBtn);
        this.eRemoveBtn.classList.add("icon");
        this.eRemoveBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eColorPicker = document.createElement("div");
        this.eContent.appendChild(this.eColorPicker);
        this.eColorPicker.classList.add("colorpicker");
        this.#eColorPickerColors = [];
        COLORS.forEach(colors => {
            let btn = document.createElement("button");
            this.eColorPicker.appendChild(btn);
            this.#eColorPickerColors.push(btn);
            btn.color = "--"+colors._;
            btn.style.setProperty("--bg", "var(--"+colors._+")");
            btn.style.setProperty("--bgh", "var(--"+colors.h+")");
            btn.style.setProperty("--bgd", "var(--"+colors.d+")");
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.color = btn.color;
            });
        });

        this.eContent.appendChild(this.shownHook.elem);

        this.eDisplay.addEventListener("contextmenu", async e => {
            let menu = await this.makeContextMenu();
            if (!this.state.hasApp()) return;
            this.state.app.contextMenu = menu;
            this.state.app.placeContextMenu(e.pageX, e.pageY);
        });

        this.eShowBox.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.eShow.addEventListener("change", e => {
            this.shown = this.eShow.checked;
        });
        this.eRemoveBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove");
        });
        this.eDisplay.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        if (a.length <= 0 || a.length > 4) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof this.constructor) a = [a.path, a.shown, a.color, a.shownHook.to()];
            else if (util.is(a, "arr")) {
                a = new this.constructor(...a);
                a = [a.path, a.shown, a.color, a.shownHook.to()];
            }
            // TODO: remove when fixed
            else if (util.is(a, "obj")) a = [a.path, a.shown || a.isShown, a.color, a.shownHook];
            else a = [[], null];
        }
        if (a.length == 2) a = [a[0], true, a[1]];
        if (a.length == 3) a = [...a, null];

        [this.path, this.shown, this.color, this.shownHook] = a;
    }

    async makeContextMenu() {
        let itm;
        let menu = new core.App.Menu();
        itm = menu.addItem(new core.App.Menu.Item(this.isOpen ? "Close" : "Open"));
        itm.addHandler("trigger", e => {
            this.isOpen = !this.isOpen;
        });
        itm = menu.addItem(new core.App.Menu.Item(this.shown ? "Hide" : "Show"));
        itm.addHandler("trigger", e => {
            this.shown = !this.shown;
        });
        itm = menu.addItem(new core.App.Menu.Item("Remove"));
        itm.addHandler("trigger", e => {
            this.eRemoveBtn.click();
        });
        menu.addItem(new core.App.Menu.Divider());
        itm = menu.addItem(new core.App.Menu.Item("Colors"));
        let submenu = itm.menu;
        COLORS.forEach(colors => {
            itm = submenu.addItem(new core.App.Menu.Item(colors.name));
            itm.eLabel.style.color = "var(--"+colors._+")";
            itm.addHandler("trigger", e => {
                this.color = "--"+colors._;
            });
        });
        return menu;
    }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.eDisplayName.textContent = this.path;
    }
    get shown() { return this.#shown; }
    set shown(v) {
        v = !!v;
        if (this.shown == v) return;
        this.change("shown", this.shown, this.#shown=v);
        this.eShow.checked = this.shown;
    }
    get hidden() { return !this.shown; }
    set hidden(v) { this.shown = !v; }
    show() { return this.shown = true; }
    hide() { return this.hidden = true; }
    get color() { return this.#color; }
    set color(v) {
        v = (v == null) ? null : String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
        let color = this.hasColor() ? this.color.startsWith("--") ? core.PROPERTYCACHE.get(this.color) : this.color : "#fff";
        this.eShowBox.style.setProperty("--bgc", color);
        this.eShowBox.style.setProperty("--bgch", color);
        this.eDisplayName.style.color = color;
        this.eColorPickerColors.forEach(btn => {
            if (btn.color == this.color) btn.classList.add("this");
            else btn.classList.remove("this");
        });
    }
    hasColor() { return this.color != null; }

    get hooks() { return [this.shownHook]; }
    get shownHook() { return this.#shownHook; }
    set shownHook(o) { this.shownHook.from(o); }
    get isShown() {
        if (!this.shown) return false;
        if (this.shownHook.value == null) return true;
        if (this.shownHook.toggle.value)
            return !this.shownHook.value;
        return this.shownHook.value;
    }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.isClosed) return null;
        console.log(this.hooks);
        for (let hook of this.hooks) {
            let r = hook.eBox.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            return {
                r: r,
                submit: () => {
                    hook.path = data.path;
                },
            };
        }
        return null;
    }

    get state() { return this.#state; }

    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eShowBox() { return this.#eShowBox; }
    get eShow() { return this.#eShow; }
    get eShowDisplay() { return this.#eShowDisplay; }
    get eDisplayName() { return this.#eDisplayName; }
    get eRemoveBtn() { return this.#eRemoveBtn; }
    get eContent() { return this.#eContent; }
    get eColorPicker() { return this.#eColorPicker; }
    get eColorPickerColors() { return [...this.#eColorPickerColors]; }

    get isOpen() { return this.elem.classList.contains("open"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        if (v) this.elem.classList.add("open");
        else this.elem.classList.remove("open");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get disabled() { return this.elem.classList.contains("disabled"); }
    set disabled(v) {
        v = !!v;
        if (this.disabled == v) return;
        if (v) this.elem.classList.add("disabled");
        else this.elem.classList.remove("disabled");
    }
    get enabled() { return !this.enabled; }
    set enabled(v) { this.disabled = !v; }
    disable() { return this.disabled = true; }
    enable() { return this.enabled = true; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            shown: this.shown,
            color: this.color,
            shownHook: this.shownHook.to(),
        });
    }
};
Panel.OdometryTab.Pose.State = class PanelOdometryTabPoseState extends util.Target {
    #tab;
    #parent;
    #page;
    #app;
    #pose;

    constructor() {
        super();

        this.#tab = null;
        this.#parent = null;
        this.#page = null;
        this.#app = null;
        this.#pose = null;

        this.compute();
    }

    get tab() { return this.#tab; }
    set tab(v) {
        v = (v instanceof Panel.OdometryTab) ? v : null;
        if (this.tab == v) return;
        this.destroy();
        this.#tab = v;
        this.compute();
        this.create();
    }
    hasTab() { return !!this.tab; }
    get parent() { return this.#parent; }
    hasParent() { return !!this.parent; }
    get page() { return this.#page; }
    hasPage() { return !!this.page; }
    get app() { return this.#app; }
    hasApp() { return !!this.app; }
    compute() {
        this.#parent = this.hasTab() ? this.tab.parent : null;
        this.#page = this.hasParent() ? this.parent.page : null;
        this.#app = this.hasPage() ? this.page.app : null;
    }
    get pose() { return this.#pose; }
    set pose(v) {
        v = (v instanceof Panel.OdometryTab.Pose) ? v : null;
        if (this.pose == v) return;
        this.destroy();
        this.#pose = v;
        this.create();
    }
    hasPose() { return !!this.pose; }

    destroy() { return; }
    create() { return; }
    update(delta) { this.post("update", delta); }
};
Panel.Odometry2dTab = class PanelOdometry2dTab extends Panel.OdometryTab {
    #odometry;

    #size;
    #robotSize;

    #lengthUnits;
    #angleUnits;
    #origin;

    #fSize;
    #fRobotSize;
    #fQuality;
    #fUnitsLength1;
    #fUnitsLength2;
    #fUnitsAngle;
    #fOriginBlue;
    #fOriginRed;

    static PATTERNS = {
        "Pose2d": [
            ["translation", "x"],
            ["translation", "y"],
            ["rotation", "value"],
        ],
    };

    constructor(...a) {
        super("2d");

        this.#odometry = new core.Odometry2d(this.eContent);
        this.addHandler("change-lengthUnits", () => {
            this.odometry.unit = this.lengthUnits;
        });

        this.#size = new V(1000);
        this.#robotSize = new V(100);

        this.size.addHandler("change", (c, f, t) => this.change("size."+c, f, t));
        this.robotSize.addHandler("change", (c, f, t) => this.change("robotSize."+c, f, t));

        this.#lengthUnits = null;
        this.#angleUnits = null;
        this.#origin = null;

        let apply;

        const eField = this.getEOptionSection("f");
        let fieldForm = new core.Form();
        eField.appendChild(fieldForm.elem);
        this.#fSize = fieldForm.addField(new core.Form.Input2d("map-size"));
        this.addHandler("add", () => (this.fSize.app = this.app));
        this.addHandler("rem", () => (this.fSize.app = this.app));
        this.fSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fSize.baseType = "cm";
        this.fSize.step = 0.1;
        this.fSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
        });
        this.fSize.addHandler("change-value", () => {
            this.size.set(this.fSize.value);
        });
        apply = () => {
            this.fSize.value.set(this.size);
        };
        this.addHandler("change-size.x", apply);
        this.addHandler("change-size.y", apply);
        this.#fRobotSize = fieldForm.addField(new core.Form.Input2d("robot-size"));
        this.addHandler("add", () => (this.fRobotSize.app = this.app));
        this.addHandler("rem", () => (this.fRobotSize.app = this.app));
        this.fRobotSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fRobotSize.baseType = "cm";
        this.fRobotSize.step = 0.1;
        this.fRobotSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
        });
        this.fRobotSize.addHandler("change-value", () => {
            this.robotSize.set(this.fRobotSize.value);
        });
        apply = () => {
            this.fRobotSize.value.set(this.robotSize);
        };
        this.addHandler("change-robotSize.x", apply);
        this.addHandler("change-robotSize.y", apply);

        this.addHandler("change-template", () => {
            fieldForm.isShown = this.template == null;
        });

        const eOptions = this.getEOptionSection("o");
        let optionsForm = new core.Form();
        eOptions.appendChild(optionsForm.elem);
        optionsForm.side = "center";

        this.#fQuality = optionsForm.addField(new core.Form.SelectInput("quality", [{ value: 2, name: "High (4x)" }, { value: 1, name: "Low (1x)" }]));
        this.fQuality.addHandler("change-value", () => {
            this.odometry.quality = this.fQuality.value;
        });
        this.fQuality.value = this.odometry.quality;

        this.#fUnitsLength1 = optionsForm.addField(new core.Form.SelectInput("length-units", [{ value: "m", name: "Meters" }, { value: "cm", name: "Centimeters" }]));
        this.fUnitsLength1.addHandler("change-value", () => {
            if (!this.fUnitsLength1.hasValue()) return;
            this.lengthUnits = this.fUnitsLength1.value;
        });
        this.#fUnitsLength2 = optionsForm.addField(new core.Form.SelectInput("length-units", [{ value: "yd", name: "Yards" }, { value: "ft", name: "Feet" }]));
        this.fUnitsLength2.showHeader = false;
        this.fUnitsLength2.addHandler("change-value", () => {
            if (!this.fUnitsLength2.hasValue()) return;
            this.lengthUnits = this.fUnitsLength2.value;
        });
        this.addHandler("change-lengthUnits", () => {
            this.fUnitsLength1.value = this.lengthUnits;
            this.fUnitsLength2.value = this.lengthUnits;
        });

        this.#fUnitsAngle = optionsForm.addField(new core.Form.SelectInput("angle-units", [{ value: "deg", name: "Degrees" }, { value: "rad", name: "Radians" }, { value: "cycle", name: "Cycles" }]));
        this.fUnitsAngle.addHandler("change-value", () => {
            this.angleUnits = this.fUnitsAngle.value;
        });
        this.addHandler("change-angleUnits", () => {
            this.fUnitsAngle.value = this.angleUnits;
        });

        this.#fOriginBlue = optionsForm.addField(new core.Form.SelectInput("origin", [{ value: "blue+", name: "+Blue" }, { value: "blue-", name: "-Blue" }]));
        this.fOriginBlue.addHandler("change-value", () => {
            if (!this.fOriginBlue.hasValue()) return;
            this.origin = this.fOriginBlue.value;
        });
        const applyBlue = () => Array.from(this.fOriginBlue.eContent.children).forEach(elem => (elem.style.color = "var(--cb)"));
        this.fOriginBlue.addHandler("apply", applyBlue);
        applyBlue();

        this.#fOriginRed = optionsForm.addField(new core.Form.SelectInput("origin", [{ value: "red+", name: "+Red" }, { value: "red-", name: "-Red" }]));
        this.fOriginRed.showHeader = false;
        this.fOriginRed.addHandler("change-value", () => {
            if (!this.fOriginRed.hasValue()) return;
            this.origin = this.fOriginRed.value;
        });
        const applyRed = () => Array.from(this.fOriginRed.eContent.children).forEach(elem => (elem.style.color = "var(--cr)"));
        this.fOriginRed.addHandler("apply", applyRed);
        applyRed();

        this.addHandler("change-origin", () => {
            this.fOriginBlue.value = this.origin;
            this.fOriginRed.value = this.origin;
        });

        new ResizeObserver(() => {
            let r = optionsForm.elem.getBoundingClientRect();
            let small = r.width < 250;
            const makeMapValue = f => {
                return data => {
                    if (small) {
                        if ("name2" in data) return data;
                        return { value: data.value, name: f(String(data.value), String(data.name)), name2: data.name };
                    } else {
                        if ("name2" in data) return { value: data.value, name: data.name2 };
                        return data;
                    }
                };
            };
            this.fQuality.values = this.fQuality.values.map(makeMapValue((_, n) => n.substring(0, 2)));
            this.fUnitsLength1.values = this.fUnitsLength1.values.map(makeMapValue(v => v.toUpperCase()));
            this.fUnitsLength2.values = this.fUnitsLength2.values.map(makeMapValue(v => v.toUpperCase()));
            this.fUnitsAngle.values = this.fUnitsAngle.values.map(makeMapValue(v => v.toUpperCase()));
        }).observe(optionsForm.elem);

        this.quality = this.odometry.quality;

        if (a.length <= 0 || [6, 7].includes(a.length) || a.length > 8) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.Odometry2dTab) a = [a.poses, a.template, a.size, a.robotSize, a.lengthUnits, a.angleUnits, a.origin, a.optionState];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof this.constructor.Pose) a = [a, null];
                else {
                    a = new Panel.Odometry2dTab(...a);
                    a = [a.poses, a.template, a.size, a.robotSize, a.lengthUnits, a.angleUnits, a.origin, a.optionState];
                }
            }
            else if (util.is(a, "obj")) a = [a.poses, a.template, a.size, a.robotSize, a.lengthUnits, a.angleUnits, a.origin, a.optionState];
            else a = [[], "§null"];
        }
        if (a.length == 2) a = [...a, 1000];
        if (a.length == 3) a = [...a, 100];
        if (a.length == 4) a = [...a, 0.5];
        if (a.length == 5) a = [...a.slice(0, 4), "m", "deg", "blue+", a[4]];

        [this.poses, this.template, this.size, this.robotSize, this.lengthUnits, this.angleUnits, this.origin, this.optionState] = a;

        let templates = {};
        let templateImages = {};
        let finished = false;
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
            templateImages = util.ensure(await window.api.get("template-images"), "obj");
            finished = true;
        })();

        const updateSize = () => {
            this.fSize.value = this.size;
            this.fRobotSize.value = this.robotSize;
            this.fSize.activeType = this.fRobotSize.activeType = this.lengthUnits;
        };
        this.addHandler("change-size.x", updateSize);
        this.addHandler("change-size.y", updateSize);
        this.addHandler("change-robotSize.x", updateSize);
        this.addHandler("change-robotSize.y", updateSize);
        this.addHandler("change-lengthUnits", updateSize);
        updateSize();

        this.addHandler("update", delta => {
            if (this.isClosed) return;

            if (!finished) return;

            this.odometry.size = (this.template in templates) ? util.ensure(templates[this.template], "obj").size : this.size;
            this.odometry.imageSrc = (this.template in templateImages) ? templateImages[this.template] : null;

            if (this.isClosed) return;
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            this.poses.forEach(pose => {
                pose.fTrail.app = this.app;
                let node;
                node = (source && pose.shownHook.hasPath()) ? source.tree.lookup(pose.shownHook.path) : null;
                pose.shownHook.setFrom((node && node.hasField()) ? node.field.type : "*", (node && node.hasField()) ? node.field.get() : null);
                node = (source && pose.ghostHook.hasPath()) ? source.tree.lookup(pose.ghostHook.path) : null;
                pose.ghostHook.setFrom((node && node.hasField()) ? node.field.type : "*", (node && node.hasField()) ? node.field.get() : null);
                pose.state.pose = pose.isShown ? pose : null;
                node = source ? source.tree.lookup(pose.path) : null;
                pose.state.value = this.getValue(node);
                pose.state.trail = this.getValueRange(node);
                pose.state.update(delta);
            });
            this.odometry.update(delta);
        });
    }

    addPose(...poses) {
        let r = super.addPose(...poses);
        let r2 = [r].flatten();
        r2.forEach(r => {
            const onType = () => {
                let current = core.Odometry2d.Robot.lookupTypeName(r.type);
                if (!this.hasApp()) return;
                let itm;
                let menu = new core.App.Menu();
                for (let k in core.Odometry2d.Robot.TYPES) {
                    let name = util.formatText(k);
                    itm = menu.addItem(new core.App.Menu.Item(name, (current == k) ? "checkmark" : ""));
                    itm.addHandler("trigger", e => {
                        r.type = k;
                    });
                };
                this.app.contextMenu = menu;
                let rect = r.eDisplayType.getBoundingClientRect();
                this.app.placeContextMenu(rect.left, rect.bottom);
                menu.elem.style.minWidth = rect.width+"px";
            };
            r.addLinkedHandler(this, "type", onType);
        });
        return r;
    }
    remPose(...poses) {
        let r = super.remPose(...poses);
        let r2 = [r].flatten();
        r2.forEach(r => {
            r.clearLinkedHandlers(this, "type");
        });
        return r;
    }

    get odometry() { return this.#odometry; }

    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }
    get robotSize() { return this.#robotSize; }
    set robotSize(v) { this.#robotSize.set(v); }
    get robotW() { return this.robotSize.x; }
    set robotW(v) { this.robotSize.x = v; }
    get robotH() { return this.robotSize.y; }
    set robotH(v) { this.robotSize.y = v; }

    get lengthUnits() { return this.#lengthUnits; }
    set lengthUnits(v) {
        v = String(v);
        if (!["m", "cm", "mm", "yd", "ft", "in"].includes(v)) v = "m";
        if (this.lengthUnits == v) return;
        this.change("lengthUnits", this.lengthUnits, this.#lengthUnits=v);
    }
    get angleUnits() { return this.#angleUnits; }
    set angleUnits(v) {
        v = String(v);
        if (!["deg", "rad", "cycle"].includes(v)) v = "deg";
        if (this.angleUnits == v) return;
        this.change("angleUnits", this.angleUnits, this.#angleUnits=v);
    }
    get origin() { return this.#origin; }
    set origin(v) {
        v = String(v);
        if (!["blue+", "blue-", "red+", "red-"].includes(v)) v = "blue+";
        if (this.origin == v) return;
        this.change("origin", this.origin, this.#origin=v);
    }

    get fSize() { return this.#fSize; }
    get fRobotSize() { return this.#fRobotSize; }
    get fQuality() { return this.#fQuality; }
    get fUnitsLength1() { return this.#fUnitsLength1; }
    get fUnitsLength2() { return this.#fUnitsLength2; }
    get fUnitsAngle() { return this.#fUnitsAngle; }
    get fOriginBlue() { return this.#fOriginBlue; }
    get fOriginRed() { return this.#fOriginRed; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            poses: this.poses,
            template: this.template,
            size: this.size,
            robotSize: this.robotSize,
            lengthUnits: this.lengthUnits,
            angleUnits: this.angleUnits,
            origin: this.origin,
            optionState: this.optionState,
        });
    }
};
Panel.Odometry2dTab.Pose = class PanelOdometry2dTabPose extends Panel.OdometryTab.Pose {
    #ghost;
    #type;

    #ghostHook;

    #trail;
    #useTrail;
    #fTrail;

    #eGhostBtn;
    #eDisplayType;

    constructor(...a) {
        super();

        this.#ghost = false;
        this.#type = null;

        this.#ghostHook = new Panel.ToolCanvasTab.Hook("Ghost Hook", null);
        this.ghostHook.toggle.show();
        this.ghostHook.addHandler("change", (c, f, t) => this.change("ghostHook."+c, f, t));

        const form = new core.Form();

        this.#trail = null;
        this.#useTrail = null;
        this.#fTrail = form.addField(new core.Form.Input1d("trail"));
        this.fTrail.types = ["ms", "s", "min"];
        this.fTrail.baseType = "ms";
        this.fTrail.activeType = "s";
        this.fTrail.step = 0.1;
        this.fTrail.showToggle = true;
        this.fTrail.addHandler("change-toggleOn", () => {
            this.useTrail = this.fTrail.toggleOn;
        });
        this.fTrail.addHandler("change-value", () => {
            this.trail = this.fTrail.value;
        });
        this.trail = 0;
        this.useTrail = false;

        this.eContent.appendChild(this.ghostHook.elem);
        this.eContent.appendChild(form.elem);

        this.#eGhostBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eGhostBtn);
        this.eGhostBtn.classList.add("custom");
        this.eGhostBtn.textContent = "Ghost";
        this.eGhostBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.ghost = !this.ghost;
        });

        this.#eDisplayType = document.createElement("button");
        this.eContent.appendChild(this.eDisplayType);
        this.eDisplayType.classList.add("display");
        this.eDisplayType.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eDisplayType.addEventListener("click", e => {
            e.stopPropagation();
            this.post("type");
        });

        if (a.length <= 0 || [6].includes(a.length) || a.length > 9) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof this.constructor) a = [a.path, a.shown, a.color, a.ghost, a.type, a.shownHook.to(), a.ghostHook.to(), a.trail, a.useTrail];
            else if (util.is(a, "arr")) {
                if (util.is(a[0], "str")) a = [a, null];
                else {
                    a = new this.constructor(...a);
                    a = [a.path, a.shown, a.color, a.ghost, a.type, a.shownHook.to(), a.ghostHook.to(), a.trail, a.useTrail];
                }
            }
            // TODO: remove when fixed
            else if (util.is(a, "obj")) a = [a.path, a.shown || a.isShown, a.color, a.ghost || a.isGhost, a.type, a.shownHook, a.ghostHook, a.trail, a.useTrail];
            else a = [[], null];
        }
        if (a.length == 2) a = [a[0], true, a[1]];
        if (a.length == 3) a = [...a, false];
        if (a.length == 4) a = [...a, core.Odometry2d.Robot.TYPES.DEFAULT];
        if (a.length == 5) a = [...a, null, null];
        if (a.length == 7) a = [...a, 0];
        if (a.length == 8) a = [...a, false];

        [this.path, this.shown, this.color, this.ghost, this.type, this.shownHook, this.ghostHook, this.trail, this.useTrail] = a;
    }
    
    async makeContextMenu() {
        let itm;
        let menu = await super.makeContextMenu();
        itm = menu.addItem(new core.App.Menu.Item("Types"));
        let submenu = itm.menu;
        for (let name in core.Odometry2d.Robot.TYPES) {
            itm = submenu.addItem(new core.App.Menu.Item(util.formatText(name), (this.type == core.Odometry2d.Robot.TYPES[name]) ? "checkmark" : ""));
            itm.addHandler("trigger", e => {
                this.type = core.Odometry2d.Robot.TYPES[name];
            });
        }
        itm = menu.addItem(new core.App.Menu.Item("Ghost", this.ghost ? "checkmark" : ""));
        itm.addHandler("trigger", e => {
            this.ghost = !this.ghost;
        });
        return menu;
    }

    get ghost() { return this.#ghost; }
    set ghost(v) {
        v = !!v;
        if (this.ghost == v) return;
        this.change("ghost", this.ghost, this.#ghost=v);
        if (this.ghost)
            this.eGhostBtn.classList.add("this");
        else this.eGhostBtn.classList.remove("this");
    }
    get type() { return this.#type; }
    set type(v) {
        if (v in core.Odometry2d.Robot.TYPES) v = core.Odometry2d.Robot.TYPES[v];
        if (!Object.values(core.Odometry2d.Robot.TYPES).includes(v)) v = core.Odometry2d.Robot.TYPES.DEFAULT;
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
        if (this.eDisplayType.children[0] instanceof HTMLDivElement)
            this.eDisplayType.children[0].textContent = util.formatText(core.Odometry2d.Robot.lookupTypeName(this.type));
    }

    get hooks() { return [this.shownHook, this.ghostHook]; }
    get ghostHook() { return this.#ghostHook; }
    set ghostHook(o) { this.ghostHook.from(o); }
    get isGhost() {
        if (this.ghost) return true;
        if (this.ghostHook.value == null) return false;
        if (this.ghostHook.toggle.value)
            return !this.ghostHook.value;
        return this.ghostHook.value;
    }

    get trail() { return this.#trail; }
    set trail(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.trail == v) return;
        this.change("trail", this.trail, this.#trail=v);
        this.fTrail.value = this.trail;
    }
    get useTrail() { return this.#useTrail; }
    set useTrail(v) {
        v = !!v;
        if (this.useTrail == v) return;
        this.change("useTrail", this.useTrail, this.#useTrail=v);
        this.fTrail.toggleOn = this.useTrail;
        this.fTrail.disabled = !this.useTrail;
    }
    get fTrail() { return this.#fTrail; }

    get eGhostBtn() { return this.#eGhostBtn; }
    get eDisplayType() { return this.#eDisplayType; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            shown: this.shown,
            color: this.color,
            ghost: this.ghost,
            type: core.Odometry2d.Robot.lookupTypeName(this.type),
            shownHook: this.shownHook.to(),
            ghostHook: this.ghostHook.to(),
            trail: this.trail,
            useTrail: this.useTrail,
        });
    }
};
Panel.Odometry2dTab.Pose.State = class PanelOdometry2dTabPoseState extends Panel.OdometryTab.Pose.State {
    #value;
    #trail;

    #renders;

    constructor() {
        super();

        this.#value = [];
        this.#trail = [];

        this.#renders = [];

        let templates = {};
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
        })();

        const convertPos = (...v) => {
            v = new V(...v);
            if (!this.hasTab()) return v;
            v = v.map(v => lib.Unit.convert(v, this.tab.lengthUnits, "cm"));
            if (!this.tab.origin.startsWith("blue")) v.x = this.tab.odometry.w-v.x;
            if (!this.tab.origin.endsWith("+")) v.y = this.tab.odometry.h-v.y;
            return v;
        };
        const convertAngle = v => {
            v = util.ensure(v, "num");
            if (!this.hasTab()) return v;
            v = lib.Unit.convert(v, this.tab.angleUnits, "deg");
            if (!this.tab.origin.startsWith("blue")) v = 180-v;
            if (!this.tab.origin.endsWith("+")) v = 0-v;
            return v;
        };

        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            if (!this.hasPose()) return;
            const renders = this.#renders;
            this.pose.enable();
            if (this.value.length % 3 == 0) {
                let l = this.value.length / 3;
                while (renders.length < l) renders.push(this.tab.odometry.render.addRender(new core.Odometry2d.Robot(this.tab.odometry.render)));
                while (renders.length > l) this.tab.odometry.render.remRender(renders.pop());
                let color = this.pose.color.substring(2);
                let colorH = color+5;
                for (let i = 0; i < l; i++) {
                    let render = renders[i];
                    render.color = color;
                    render.colorH = colorH;
                    render.alpha = this.pose.isGhost ? 0.5 : 1;
                    render.size = (this.tab.template in templates) ? util.ensure(templates[this.tab.template], "obj").robotSize : this.tab.robotSize;
                    render.pos = convertPos(this.value[3*i+0], this.value[3*i+1]);
                    render.heading = convertAngle(this.value[3*i+2]);
                    render.type = this.pose.type;
                }
                this.pose.eDisplayType.style.display = "";
            } else if (this.value.length % 2 == 0) {
                let l = Math.max(0, (this.value.length/2) - 1);
                while (renders.length < l) renders.push(this.tab.odometry.render.addRender(new RLine(this.tab.odometry.render)));
                while (renders.length > l) this.tab.odometry.render.remRender(renders.pop());
                for (let i = 0; i < l; i++) {
                    let render = renders[i];
                    render.a = convertPos(this.value[i*2+0], this.value[i*2+1]);
                    render.b = convertPos(this.value[i*2+2], this.value[i*2+3]);
                    render.color = this.pose.color;
                    render.alpha = this.pose.isGhost ? 0.5 : 1;
                }
                this.pose.eDisplayType.style.display = "none";
            } else this.pose.disable();
        });
    }

    get value() { return this.#value; }
    set value(v) {
        v = util.ensure(v, "arr").map(v => util.ensure(v, "num"));
        if (this.value.length == v.length) {
            this.#value = v;
            return;
        }
        this.destroy();
        this.#value = v;
        this.create();
    }
    get trail() { return this.#trail; }
    set trail(v) {
    }

    destroy() {
        if (!this.hasTab()) return;
        this.#renders.forEach(render => this.tab.odometry.render.remRender(render));
        this.#renders = [];
    }
    create() {
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        this.#renders = [];
    }
};
Panel.Odometry3dTab = class PanelOdometry3dTab extends Panel.OdometryTab {
    #odometry;

    #lengthUnits;
    #angleUnits;

    #fViewRenderType;
    #fViewControlType;
    #fViewCinematic;
    #fQuality;
    #fUnitsLength1;
    #fUnitsLength2;
    #fUnitsAngle;
    #fOriginBlue;
    #fOriginRed;
    #fCameraPos;

    static CREATECTX = false;

    static PATTERNS = {
        "Pose2d": [
            ["translation", "x"],
            ["translation", "y"],
            ["rotation", "value"],
        ],
        "Pose3d": [
            ["translation", "x"],
            ["translation", "y"],
            ["translation", "z"],
            ["rotation", "q", "w"],
            ["rotation", "q", "x"],
            ["rotation", "q", "y"],
            ["rotation", "q", "z"],
        ],
    };

    constructor(...a) {
        super("3d");

        this.addHandler("rem", () => {
            this.odometry.renderer.forceContextLoss();
        });

        const eInfo = document.createElement("div");
        this.eContent.appendChild(eInfo);
        eInfo.classList.add("info");
        eInfo.innerHTML = "   [W]\n[A][S][D]\n[ Space ] Up\n[ Shift ] Down\n[  Esc  ] Leave Pointer Lock";

        this.#odometry = new core.Odometry3d(this.eContent);
        this.odometry.addHandler("change", (c, f, t) => this.change("odometry."+c, f, t));

        this.quality = this.odometry.quality = 2;

        this.#lengthUnits = null;
        this.#angleUnits = null;

        const eField = this.getEOptionSection("f");

        const eOptions = this.getEOptionSection("o");

        let optionsForm = new core.Form();
        eOptions.appendChild(optionsForm.elem);
        optionsForm.side = "center";

        let update;

        this.#fViewRenderType = optionsForm.addField(new core.Form.SelectInput("camera-type", [{ value: "proj", name: "Projection" }, { value: "iso", name: "Isometric" }]));
        this.fViewRenderType.showHeader = false;
        this.fViewRenderType.addHandler("change-value", () => {
            this.odometry.renderType = this.fViewRenderType.value;
        });
        update = () => {
            this.fViewRenderType.value = this.odometry.renderType;
        };
        this.addHandler("change-odometry.renderType", update);
        update();

        this.#fViewControlType = optionsForm.addField(new core.Form.SelectInput("movement-type", [{ value: "orbit", name: "Orbit" }, { value: "free", name: "Free" }, { value: "pan", name: "Pan" }]));
        this.fViewControlType.showHeader = false;
        this.fViewControlType.addHandler("change-value", () => {
            this.odometry.controlType = this.fViewControlType.value;
        });
        update = () => {
            this.fViewControlType.value = this.odometry.controlType;
        };
        this.addHandler("change-odometry.controlType", update);
        update();

        this.#fViewCinematic = optionsForm.addField(new core.Form.ToggleInput("cinematic", "Cinematic"));
        this.fViewCinematic.showHeader = false;
        this.fViewCinematic.addHandler("change-value", () => {
            this.odometry.isCinematic = this.fViewCinematic.value;
        });
        update = () => {
            this.fViewCinematic.value = this.odometry.isCinematic;
        };
        this.addHandler("change-odometry.isCinematic", update);
        update();

        this.#fQuality = optionsForm.addField(new core.Form.SelectInput("quality", [{ value: 2, name: "High (4x)" }, { value: 1, name: "Low (1x)" }]));
        this.fQuality.addHandler("change-value", () => {
            this.odometry.quality = this.fQuality.value;
        });
        this.fQuality.value = this.odometry.quality;

        this.#fUnitsLength1 = optionsForm.addField(new core.Form.SelectInput("length-units", [{ value: "m", name: "Meters" }, { value: "cm", name: "Centimeters" }]));
        this.fUnitsLength1.addHandler("change-value", () => {
            if (!this.fUnitsLength1.hasValue()) return;
            this.lengthUnits = this.fUnitsLength1.value;
        });
        this.#fUnitsLength2 = optionsForm.addField(new core.Form.SelectInput("length-units", [{ value: "yd", name: "Yards" }, { value: "ft", name: "Feet" }]));
        this.fUnitsLength2.showHeader = false;
        this.fUnitsLength2.addHandler("change-value", () => {
            if (!this.fUnitsLength2.hasValue()) return;
            this.lengthUnits = this.fUnitsLength2.value;
        });
        this.addHandler("change-lengthUnits", () => {
            this.fUnitsLength1.value = this.lengthUnits;
            this.fUnitsLength2.value = this.lengthUnits;
        });

        this.#fUnitsAngle = optionsForm.addField(new core.Form.SelectInput("angle-units", [{ value: "deg", name: "Degrees" }, { value: "rad", name: "Radians" }, { value: "cycle", name: "Cycles" }]));
        this.fUnitsAngle.addHandler("change-value", () => {
            this.angleUnits = this.fUnitsAngle.value;
        });
        this.addHandler("change-angleUnits", () => {
            this.fUnitsAngle.value = this.angleUnits;
        });

        this.#fOriginBlue = optionsForm.addField(new core.Form.SelectInput("origin", [{ value: "blue+", name: "+Blue" }, { value: "blue-", name: "-Blue" }]));
        this.fOriginBlue.addHandler("change-value", () => {
            if (!this.fOriginBlue.hasValue()) return;
            this.odometry.origin = this.fOriginBlue.value;
        });
        const applyBlue = () => Array.from(this.fOriginBlue.eContent.children).forEach(elem => (elem.style.color = "var(--cb)"));
        this.fOriginBlue.addHandler("apply", applyBlue);
        applyBlue();

        this.#fOriginRed = optionsForm.addField(new core.Form.SelectInput("origin", [{ value: "red+", name: "+Red" }, { value: "red-", name: "-Red" }]));
        this.fOriginRed.showHeader = false;
        this.fOriginRed.addHandler("change-value", () => {
            if (!this.fOriginRed.hasValue()) return;
            this.odometry.origin = this.fOriginRed.value;
        });
        const applyRed = () => Array.from(this.fOriginRed.eContent.children).forEach(elem => (elem.style.color = "var(--cr)"));
        this.fOriginRed.addHandler("apply", applyRed);
        applyRed();

        update = () => {
            this.fOriginBlue.value = this.odometry.origin;
            this.fOriginRed.value = this.odometry.origin;
        };
        this.addHandler("change-odometry.origin", update);
        update();

        optionsForm.addField(new core.Form.Header("View"));

        let viewForm = new core.Form();
        eOptions.appendChild(viewForm.elem);

        this.#fCameraPos = viewForm.addField(new core.Form.Input3d("camera-position"));
        this.addHandler("add", () => (this.fCameraPos.app = this.app));
        this.addHandler("rem", () => (this.fCameraPos.app = this.app));
        this.fCameraPos.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fCameraPos.baseType = "m";
        this.fCameraPos.step = 0.1;
        this.fCameraPos.inputs.forEach((inp, i) => {
            inp.placeholder = "XYZ"[i];
        });
        let ignore = false;
        this.fCameraPos.addHandler("change-value", () => {
            if (ignore) return;
            this.odometry.camera.position.x = this.fCameraPos.x;
            this.odometry.camera.position.y = this.fCameraPos.y;
            this.odometry.camera.position.z = this.fCameraPos.z;
        });
        this.addHandler("change-lengthUnits", () => {
            this.fCameraPos.activeType = this.lengthUnits;
        });

        new ResizeObserver(() => {
            let r = optionsForm.elem.getBoundingClientRect();
            let small = r.width < 250;
            const makeMapValue = f => {
                return data => {
                    if (small) {
                        if ("name2" in data) return data;
                        return { value: data.value, name: f(String(data.value), String(data.name)), name2: data.name };
                    } else {
                        if ("name2" in data) return { value: data.value, name: data.name2 };
                        return data;
                    }
                };
            };
            this.fViewRenderType.values = this.fViewRenderType.values.map(makeMapValue(v => util.formatText(v)));
            this.fQuality.values = this.fQuality.values.map(makeMapValue((_, n) => n.substring(0, 2)));
            this.fUnitsLength1.values = this.fUnitsLength1.values.map(makeMapValue(v => v.toUpperCase()));
            this.fUnitsLength2.values = this.fUnitsLength2.values.map(makeMapValue(v => v.toUpperCase()));
            this.fUnitsAngle.values = this.fUnitsAngle.values.map(makeMapValue(v => v.toUpperCase()));
        }).observe(optionsForm.elem);

        if (a.length <= 0 || [4, 5, 6, 7].includes(a.length) || a.length > 8) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.Odometry3dTab) a = [a.poses, a.template, a.odometry.renderType, a.odometry.controlType, a.lengthUnits, a.angleUnits, a.odometry.origin, a.optionState];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof this.constructor.Pose) a = [a, null];
                else {
                    a = new Panel.Odometry3dTab(...a);
                    a = [a.poses, a.template, a.odometry.renderType, a.odometry.controlType, a.lengthUnits, a.angleUnits, a.odometry.origin, a.optionState];
                }
            }
            else if (util.is(a, "obj")) a = [a.poses, a.template, a.renderType, a.controlType, a.lengthUnits, a.angleUnits, a.origin, a.optionState];
            else a = [[], "§null"];
        }
        if (a.length == 2) a = [...a, 0.5];
        if (a.length == 3) a = [...a.slice(0, 2), true, true, true, true, "blue+", a[2]];

        [this.poses, this.template, this.odometry.renderType, this.odometry.controlType, this.lengthUnits, this.angleUnits, this.odometry.origin, this.optionState] = a;

        let templates = {};
        let templateModels = {};
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
            templateModels = util.ensure(await window.api.get("template-models"), "obj");
        })();

        this.addHandler("change-lengthUnits", () => {
            this.fCameraPos.activeType = this.lengthUnits;
        });
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

        this.addHandler("update", delta => {
            if (this.isClosed) {
                if (this.odometry.controlType == "free")
                    this.odometry.controls.unlock();
                return;
            }
            
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            this.poses.forEach(pose => {
                let node;
                node = (source && pose.shownHook.hasPath()) ? source.tree.lookup(pose.shownHook.path) : null;
                pose.shownHook.setFrom((node && node.hasField()) ? node.field.type : "*", (node && node.hasField()) ? node.field.get() : null);
                node = (source && pose.ghostHook.hasPath()) ? source.tree.lookup(pose.ghostHook.path) : null;
                pose.ghostHook.setFrom((node && node.hasField()) ? node.field.type : "*", (node && node.hasField()) ? node.field.get() : null);
                node = (source && pose.solidHook.hasPath()) ? source.tree.lookup(pose.solidHook.path) : null;
                pose.solidHook.setFrom((node && node.hasField()) ? node.field.type : "*", (node && node.hasField()) ? node.field.get() : null);
                pose.state.pose = pose.isShown ? pose : null;
                [pose.state.offsetX, pose.state.offsetY] = new V(util.ensure(templates[this.template], "obj").size).div(-2).xy;
                node = source ? source.tree.lookup(pose.path) : null;
                pose.state.value = this.getValue(node);
                pose.state.update(delta);
            });

            ignore = true;
            for (let i = 0; i < 3; i++)
                this.fCameraPos["xyz"[i]] = this.odometry.camera.position["xyz"[i]];
            ignore = false;

            this.odometry.size = (this.template in templates) ? util.ensure(templates[this.template], "obj").size : this.size;
            this.odometry.template = this.template;

            this.odometry.update(delta);
        });
    }

    get odometry() { return this.#odometry; }

    addPose(...poses) {
        let r = super.addPose(...poses);
        let r2 = [r].flatten();
        r2.forEach(r => {
            const onType = async () => {
                let robots = util.ensure(await window.api.get("robots"), "obj");
                let current = r.type;
                if (!this.hasApp()) return;
                let itm;
                let menu = new core.App.Menu();
                let menuData = {
                    "§node": "Node",
                    "§cube": "Cube",
                    "Arrows": {
                        "§arrow+x": "Arrow (+X)",
                        "§arrow-x": "Arrow (-X)",
                        "§arrow+y": "Arrow (+Y)",
                        "§arrow-y": "Arrow (-Y)",
                        "§arrow+z": "Arrow (+Z)",
                        "§arrow-z": "Arrow (-Z)",
                    },
                    "§axes": "Axes",
                };
                const dfs = (menu, k, v) => {
                    if (util.is(v, "obj")) {
                        let itm = menu.addItem(new core.App.Menu.Item(k));
                        for (let k2 in v) dfs(itm.menu, k2, v[k2]);
                        return;
                    }
                    let itm = menu.addItem(new core.App.Menu.Item(v, (current == k) ? "checkmark" : ""));
                    itm.addHandler("trigger", e => {
                        r.type = k;
                    });
                };
                for (let k in menuData) dfs(menu, k, menuData[k]);
                menu.addItem(new core.App.Menu.Divider());
                Object.keys(robots).forEach(k => {
                    itm = menu.addItem(new core.App.Menu.Item(k, (current == k) ? "checkmark" : ""));
                    itm.addHandler("trigger", e => {
                        r.type = k;
                    });
                });
                this.app.contextMenu = menu;
                let rect = r.eDisplayType.getBoundingClientRect();
                this.app.placeContextMenu(rect.left, rect.bottom);
                menu.elem.style.minWidth = rect.width+"px";
            };
            r.addLinkedHandler(this, "type", onType);
        });
        return r;
    }
    remPose(...poses) {
        let r = super.remPose(...poses);
        let r2 = [r].flatten();
        r2.forEach(r => {
            r.clearLinkedHandlers(this, "type");
        });
        return r;
    }

    get lengthUnits() { return this.#lengthUnits; }
    set lengthUnits(v) {
        v = String(v);
        if (!["m", "cm", "mm", "yd", "ft", "in"].includes(v)) v = "m";
        if (this.lengthUnits == v) return;
        this.change("lengthUnits", this.lengthUnits, this.#lengthUnits=v);
    }
    get angleUnits() { return this.#angleUnits; }
    set angleUnits(v) {
        v = String(v);
        if (!["deg", "rad", "cycle"].includes(v)) v = "deg";
        if (this.angleUnits == v) return;
        this.change("angleUnits", this.angleUnits, this.#angleUnits=v);
    }

    get fViewRenderType() { return this.#fViewRenderType; }
    get fViewControlType() { return this.#fViewControlType; }
    get fViewCinematic() { return this.#fViewCinematic; }
    get fQuality() { return this.#fQuality; }
    get fUnitsLength1() { return this.#fUnitsLength1; }
    get fUnitsLength2() { return this.#fUnitsLength2; }
    get fUnitsAngle() { return this.#fUnitsAngle; }
    get fOriginBlue() { return this.#fOriginBlue; }
    get fOriginRed() { return this.#fOriginRed; }
    get fCameraPos() { return this.#fCameraPos; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            poses: this.poses,
            template: this.template,
            renderType: this.odometry.renderType,
            controlType: this.odometry.controlType,
            lengthUnits: this.lengthUnits,
            angleUnits: this.angleUnits,
            origin: this.odometry.origin,
            optionState: this.optionState,
        });
    }
};
Panel.Odometry3dTab.Pose = class PanelOdometry3dTabPose extends Panel.OdometryTab.Pose {
    #ghost;
    #solid;
    #type;

    #ghostHook;
    #solidHook;

    #eGhostBtn;
    #eSolidBtn;
    #eDisplayType;

    constructor(...a) {
        super();

        this.#ghost = null;
        this.#solid = null;
        this.#type = "";

        this.#ghostHook = new Panel.ToolCanvasTab.Hook("Ghost Hook", null);
        this.ghostHook.toggle.show();
        this.ghostHook.addHandler("change", (c, f, t) => this.change("ghostHook."+c, f, t));
        this.#solidHook = new Panel.ToolCanvasTab.Hook("Solid Hook", null);
        this.solidHook.toggle.show();
        this.solidHook.addHandler("change", (c, f, t) => this.change("solidHook."+c, f, t));

        this.eContent.appendChild(this.ghostHook.elem);
        this.eContent.appendChild(this.solidHook.elem);

        this.#eGhostBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eGhostBtn);
        this.eGhostBtn.classList.add("custom");
        this.eGhostBtn.textContent = "Ghost";
        this.eGhostBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.ghost = !this.ghost;
        });

        this.#eSolidBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eSolidBtn);
        this.eSolidBtn.classList.add("custom");
        this.eSolidBtn.textContent = "Solid";
        this.eSolidBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.solid = !this.solid;
        });

        this.#eDisplayType = document.createElement("button");
        this.eContent.appendChild(this.eDisplayType);
        this.eDisplayType.classList.add("display");
        this.eDisplayType.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eDisplayType.addEventListener("click", e => {
            e.stopPropagation();
            this.post("type");
        });

        if (a.length <= 0 || [3, 4, 5, 7, 8].includes(a.length) || a.length > 9) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof this.constructor) a = [a.path, a.shown, a.color, a.ghost, a.solid, a.type, a.shownHook.to(), a.ghostHook.to(), a.solidHook.to()];
            else if (util.is(a, "arr")) {
                if (util.is(a[0], "str")) a = [a, null];
                else {
                    a = new this.constructor(...a);
                    a = [a.path, a.shown, a.color, a.ghost, a.solid, a.type, a.shownHook.to(), a.ghostHook.to(), a.solidHook.to()];
                }
            }
            // TODO: remove when fixed
            else if (util.is(a, "obj")) a = [a.path, a.shown || a.isShown, a.color, a.ghost || a.isGhost, a.solid || a.isSolid, a.type, a.shownHook, a.ghostHook, a.solidHook];
            else a = [null, null];
        }
        if (a.length == 2) a = [a[0], true, a[1], false, false];
        if (a.length == 5) a = [...a, "KitBot"];
        if (a.length == 6) a = [...a, null, null, null];

        [this.path, this.shown, this.color, this.ghost, this.solid, this.type, this.shownHook, this.ghostHook, this.solidHook] = a;
    }

    async makeContextMenu() {
        let itm;
        let menu = await super.makeContextMenu();
        itm = menu.addItem(new core.App.Menu.Item("Types"));
        let submenu = itm.menu;
        let menuData = {
            "§node": "Node",
            "§cube": "Cube",
            "Arrows": {
                "§arrow+x": "Arrow (+X)",
                "§arrow-x": "Arrow (-X)",
                "§arrow+y": "Arrow (+Y)",
                "§arrow-y": "Arrow (-Y)",
                "§arrow+z": "Arrow (+Z)",
                "§arrow-z": "Arrow (-Z)",
            },
            "§axes": "Axes",
        };
        const dfs = (menu, k, v) => {
            if (util.is(v, "obj")) {
                let itm = menu.addItem(new core.App.Menu.Item(k));
                for (let k2 in v) dfs(itm.menu, k2, v[k2]);
                return;
            }
            let itm = menu.addItem(new core.App.Menu.Item(v, (this.type == k) ? "checkmark" : ""));
            itm.addHandler("trigger", e => {
                this.type = k;
            });
        };
        for (let k in menuData) dfs(submenu, k, menuData[k]);
        submenu.addItem(new core.App.Menu.Divider());
        let robots = util.ensure(await window.api.get("robots"), "obj");
        Object.keys(robots).forEach(k => {
            itm = submenu.addItem(new core.App.Menu.Item(k, (this.type == k) ? "checkmark" : ""));
            itm.addHandler("trigger", e => {
                this.type = k;
            });
        });
        itm = menu.addItem(new core.App.Menu.Item("Ghost", this.ghost ? "checkmark" : ""));
        itm.addHandler("trigger", e => {
            this.ghost = !this.ghost;
        });
        itm = menu.addItem(new core.App.Menu.Item("Solid", this.solid ? "checkmark" : ""));
        itm.addHandler("trigger", e => {
            this.solid = !this.solid;
        });
        return menu;
    }

    get ghost() { return this.#ghost; }
    set ghost(v) {
        v = !!v;
        if (this.ghost == v) return;
        this.change("ghost", this.ghost, this.#ghost=v);
        if (this.ghost)
            this.eGhostBtn.classList.add("this");
        else this.eGhostBtn.classList.remove("this");
    }
    get solid() { return this.#solid; }
    set solid(v) {
        v = !!v;
        if (this.solid == v) return;
        this.change("solid", this.solid, this.#solid=v);
        if (this.solid)
            this.eSolidBtn.classList.add("this");
        else this.eSolidBtn.classList.remove("this");
    }
    get type() { return this.#type; }
    set type(v) {
        v = String(v);
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
        let type = this.type;
        if (type.startsWith("§"))
            type = {
                "§node": "Node",
                "§cube": "Cube",
                "§arrow+x": "Arrow (+X)",
                "§arrow-x": "Arrow (-X)",
                "§arrow+y": "Arrow (+Y)",
                "§arrow-y": "Arrow (-Y)",
                "§arrow+z": "Arrow (+Z)",
                "§arrow-z": "Arrow (-Z)",
                "§axes": "Axes",
            }[type];
        if (this.eDisplayType.children[0] instanceof HTMLDivElement)
            this.eDisplayType.children[0].textContent = type;
    }

    get hooks() { return [this.shownHook, this.ghostHook, this.solidHook]; }
    get ghostHook() { return this.#ghostHook; }
    set ghostHook(o) { this.ghostHook.from(o); }
    get isGhost() {
        if (this.ghost) return true;
        if (this.ghostHook.value == null) return false;
        if (this.ghostHook.toggle.value)
            return !this.ghostHook.value;
        return this.ghostHook.value;
    }
    get solidHook() { return this.#solidHook; }
    set solidHook(o) { this.solidHook.from(o); }
    get isSolid() {
        if (this.solid) return true;
        if (this.solidHook.value == null) return false;
        if (this.solidHook.toggle.value)
            return !this.solidHook.value;
        return this.solidHook.value;
    }

    get eGhostBtn() { return this.#eGhostBtn; }
    get eSolidBtn() { return this.#eSolidBtn; }
    get eDisplayType() { return this.#eDisplayType; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            shown: this.shown,
            color: this.color,
            ghost: this.ghost,
            solid: this.solid,
            type: this.type,
            shownHook: this.shownHook.to(),
            ghostHook: this.ghostHook.to(),
            solidHook: this.solidHook.to(),
        });
    }
};
Panel.Odometry3dTab.Pose.State = class PanelOdometry3dTabPoseState extends Panel.OdometryTab.Pose.State {
    #offset;

    #value;

    #renders;
    
    constructor() {
        super();
        
        this.#offset = new util.V3();

        this.#value = [];

        this.#renders = [];

        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            if (!this.hasPose()) return;
            const renders = this.#renders;
            this.pose.enable();
            if (this.value.length % 7 == 0 || this.value.length % 3 == 0) {
                let l = this.value.length;
                let type = (l % 7 == 0) ? 7 : (l % 3 == 0) ? 3 : 0;
                l /= type;
                while (renders.length < l) renders.push(this.tab.odometry.addRender(new core.Odometry3d.Render(this.tab.odometry)));
                while (renders.length > l) this.tab.odometry.remRender(renders.pop());
                for (let i = 0; i < l; i++) {
                    let value = this.value.slice(i*type, (i+1)*type);
                    let render = renders[i];
                    render.name = this.pose.path;
                    render.color = this.pose.color;
                    render.isGhost = this.pose.isGhost;
                    render.isSolid = this.pose.isSolid;
                    render.display.type = type;
                    render.display.data = value;
                    render.robot = this.pose.type;
                    render.pos =
                        (type == 7) ?
                            value.slice(0, 3).map(v => lib.Unit.convert(v, this.tab.lengthUnits, "m")) :
                        (type == 3) ?
                            [...value.slice(0, 2).map(v => lib.Unit.convert(v, this.tab.lengthUnits, "m")), 0] :
                        [0, 0, 0];
                    render.q = 
                        (type == 7) ?
                            value.slice(3, 7) :
                        (type == 3) ?
                            (d => [Math.cos(d/2), 0, 0, Math.sin(d/2)])(lib.Unit.convert(value[2], this.tab.angleUnits, "rad")) :
                        [0, 0, 0, 0];
                }
            } else this.pose.disable();
        });
    }

    get offset() { return this.#offset; }
    set offset(v) { this.#offset.set(v); }
    get offsetX() { return this.offset.x; }
    set offsetX(v) { this.offset.x = v; }
    get offsetY() { return this.offset.y; }
    set offsetY(v) { this.offset.y = v; }
    get offsetZ() { return this.offset.z; }
    set offsetZ(v) { this.offset.z = v; }

    get value() { return this.#value; }
    set value(v) {
        v = util.ensure(v, "arr").map(v => util.ensure(v, "num"));
        if (this.value.length == v.length) {
            this.#value = v;
            return;
        }
        this.destroy();
        this.#value = v;
        this.create();
    }

    destroy() {
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        this.#renders.forEach(render => this.tab.odometry.remRender(render));
        this.#renders = [];
    }
    create() {
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        this.#renders = [];
    }
};

class Project extends core.Project {
    #widgetData;
    #sidePos;
    #sideSectionPos;

    constructor(...a) {
        super();

        this.#widgetData = "";
        this.#sidePos = 0.15;
        this.#sideSectionPos = {};

        if (a.length <= 0 || a.length == 4 || a.length > 6) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project) a = [a.id, a.widgetData, a.sidePos, a.sideSectionPos, a.config, a.meta];
            else if (util.is(a, "arr")) {
                a = new Project(...a);
                a = [a.id, a.widgetData, a.sidePos, a.sideSectionPos, a.config, a.meta];
            }
            else if (a instanceof Project.Config) a = ["", a, null];
            else if (a instanceof Project.Meta) a = ["", null, a];
            else if (util.is(a, "str")) a = ["", null, a];
            else if (util.is(a, "obj")) a = [a.id, a.widgetData, a.sidePos, a.sideSectionPos, a.config, a.meta];
            else a = ["", null, null];
        }
        if (a.length == 2) {
            if (a[0] instanceof Project.Config && a[1] instanceof Project.Meta) a = ["", ...a];
            else a = ["", null, null];
        }
        if (a.length == 3) a = [a[0], 0.15, { source: 0, browser: 1, tools: 0 }, ...a.slice(1)];
        if (a.length == 5) a = [null, ...a];

        [this.id, this.widgetData, this.sidePos, this.sideSectionPos, this.config, this.meta] = a;
    }

    get widgetData() { return this.#widgetData; }
    set widgetData(v) {
        v = String(v);
        if (this.widgetData == v) return;
        this.change("widgetData", this.widgetData, this.#widgetData=v);
    }

    get sidePos() { return this.#sidePos; }
    set sidePos(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num", 0.15)));
        if (this.sidePos == v) return;
        this.change("sidePos", this.sidePos, this.#sidePos=v);
    }
    
    get sideSectionPos() {
        let sideSectionPos = {};
        for (let k in this.#sideSectionPos)
            sideSectionPos[k] = this.#sideSectionPos[k];
        return sideSectionPos;
    }
    set sideSectionPos(v) {
        v = util.ensure(v, "obj");
        this.clearSideSectionPos();
        for (let k in v) this.setSideSectionPos(k, v[k], false);
        this.fixSideSectionPos();
    }
    clearSideSectionPos() {
        let sideSectionPos = this.sideSectionPos;
        for (let k in sideSectionPos) this.delSideSectionPos(k);
        return sideSectionPos;
    }
    hasSideSectionPos(k) { return String(k) in this.#sideSectionPos; }
    getSideSectionPos(k) {
        if (!this.hasSideSectionPos(k)) return null;
        return this.#sideSectionPos[k];
    }
    setSideSectionPos(k, v, fix=true) {
        let v2 = this.getSideSectionPos(k);
        k = String(k);
        if (!["source", "browser", "tools"].includes(k)) return v2;
        this.#sideSectionPos[k] = Math.max(0, util.ensure(v, "num"));
        v = this.getSideSectionPos(k);
        if (fix) this.fixSideSectionPos();
        this.change("setSideSectionPos", v, v2);
        return v2;
    }
    delSideSectionPos(k, fix=true) {
        if (!this.hasSideSectionPos(k)) return null;
        let v = this.getSideSectionPos(k);
        k = String(k);
        delete this.#sideSectionPos[k];
        if (fix) this.fixSideSectionPos();
        this.change("delSideSectionPos", v, null);
        return v;
    }
    fixSideSectionPos(force=false) {
        let sideSectionPos = this.sideSectionPos;
        let n = Object.keys(sideSectionPos).length;
        if (n <= 0) return;
        let sum = 0;
        for (let k in sideSectionPos) sum += sideSectionPos[k];
        if (sum <= (force ? 0 : 1)) return;
        for (let k in sideSectionPos)
            this.#sideSectionPos[k] /= sum;
        this.change("fixSideSectionPos", null, this.sideSectionPos);
    }

    buildWidget() {
        try {
            let widget = JSON.parse(this.widgetData, REVIVER.f);
            if (!(widget instanceof Widget)) throw widget;
            return widget;
        } catch (e) {}
        this.widgetData = JSON.stringify(new Panel());
        return this.buildWidget();
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            id: this.id,
            widgetData: this.widgetData,
            sidePos: this.sidePos,
            sideSectionPos: this.sideSectionPos,
            config: this.config, meta: this.meta,
        });
    }
}
Project.Config = class ProjectConfig extends Project.Config {
    #sources;
    #sourceType;

    constructor(...a) {
        super();

        this.#sources = {};
        this.#sourceType = "";

        if (a.length <= 0 || a.length > 2) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Config) a = [a.sources, a.sourceType];
            else if (util.is(a, "arr")) {
                a = new Project.Config(...a);
                a = [a.sources, a.sourceType];
            }
            else if (util.is(a, "obj")) a = [a.sources, a.sourceType];
            else a = [{}, "nt"];
        }

        [this.sources, this.sourceType] = a;
    }

    get sourceTypes() { return Object.keys(this.#sources); }
    get sourceValues() { return Object.values(this.#sources); }
    get sources() {
        let sources = {};
        this.sourceTypes.forEach(type => (sources[type] = this.getSource(type)));
        return sources;
    }
    set sources(v) {
        v = util.ensure(v, "obj");
        this.clearSources();
        for (let type in v) this.setSource(type, v[type]);
    }
    clearSources() {
        let sources = this.sources;
        for (let type in sources) this.delSource(type);
        return sources;
    }
    hasSource(type) {
        return String(type) in this.#sources;
    }
    getSource(type) {
        if (!this.hasSource(type)) return null;
        return this.#sources[String(type)];
    }
    setSource(type, v) {
        type = String(type);
        v = (v == null) ? null : String(v);
        if (this.hasSource(type))
            if (this.getSource(type) == v)
                return this.getSource(type);
        this.change("setSource", this.getSource(type), this.#sources[type]=v);
        return v;
    }
    delSource(type) {
        type = String(type);
        if (!this.hasSource(type)) return null;
        let v = this.getSource(type);
        delete this.#sources[type];
        this.change("delSource", v, null);
        return v;
    }
    get source() { return this.getSource(this.sourceType); }
    set source(v) {
        v = (v == null) ? null : String(v);
        if (this.source == v) return;
        this.setSource(this.sourceType, v);
    }
    get sourceType() { return this.#sourceType; }
    set sourceType(v) {
        v = String(v).toLowerCase();
        if (this.sourceType == v) return;
        this.change("sourceType", this.sourceType, this.#sourceType=v);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            sources: this.sources,
            sourceType: this.sourceType,
        });
    }
};

const REVIVER = new util.Reviver(util.REVIVER);
REVIVER.addRuleAndAllSub(Container, Panel, Project);

export default class App extends core.AppFeature {
    #eBlock;

    #eProjectInfoSourceTypes;
    #eProjectInfoSourceInput;
    #eProjectInfoActionBtn;

    static ICON = "grid";
    static PROJECTCLASS = Project;
    static REVIVER = REVIVER;

    constructor() {
        super();

        this.#eProjectInfoSourceTypes = {};

        this.addHandler("pre-post-setup", () => {
            ["file", "edit", "view"].forEach(name => {
                let id = "menu:"+name;
                let menu = this.menu.getItemById(id);
                let namefs = {
                    file: () => {
                        let itms = [
                            { id: "newtab", label: "New Tab", accelerator: "CmdOrCtrl+T" },
                            "separator",
                            { id: "nexttab", label: "Next Tab", accelerator: "CmdOrCtrl+]" },
                            { id: "prevtab", label: "Previous Tab", accelerator: "CmdOrCtrl+[" },
                            { id: "closetab", label: "Close Tab", accelerator: "CmdOrCtrl+W" },
                        ];
                        itms = itms.map((data, i) => {
                            let itm = App.Menu.Item.fromObj(data);
                            if (util.is(data, "obj")) {
                                if (!("click" in data)) data.click = () => this.post("cmd-"+data.id);
                                itm.addHandler("trigger", e => data.click());
                            }
                            return itm;
                        });
                        menu.menu.insertItem(itms.pop(), 12);
                        menu.menu.insertItem(itms.pop(), 4);
                        menu.menu.insertItem(itms.pop(), 4);
                        menu.menu.insertItem(itms.pop(), 4);
                        menu.menu.insertItem(itms.pop(), 4);
                    },
                    edit: () => {
                        let itms = [
                            { id: "action", label: "?", accelerator: "CmdOrCtrl+K" },
                            {
                                id: "source", label: "Select Source...", click: () => {},
                                submenu: [
                                    {
                                        id: "source:nt", label: "NT4", type: "radio",
                                        click: () => {
                                            const page = this.projectPage;
                                            if (!page.hasProject()) return;
                                            page.project.config.sourceType = "nt";
                                        },
                                    },
                                    {
                                        id: "source:wpilog", label: "WPILOG", type: "radio",
                                        click: () => {
                                            const page = this.projectPage;
                                            if (!page.hasProject()) return;
                                            page.project.config.sourceType = "wpilog";
                                        },
                                    },
                                    {
                                        id: "source:csv-time", label: "CSV-Time", type: "radio",
                                        click: () => {
                                            const page = this.projectPage;
                                            if (!page.hasProject()) return;
                                            page.project.config.sourceType = "csv-time";
                                        },
                                    },
                                    {
                                        id: "source:csv-field", label: "CSV-Field", type: "radio",
                                        click: () => {
                                            const page = this.projectPage;
                                            if (!page.hasProject()) return;
                                            page.project.config.sourceType = "csv-field";
                                        },
                                    },
                                ],
                            },
                            "separator",
                        ];
                        itms.forEach((data, i) => {
                            let itm = App.Menu.Item.fromObj(data);
                            if (util.is(data, "obj")) {
                                if (!("click" in data)) data.click = () => this.post("cmd-"+data.id);
                                itm.addHandler("trigger", e => data.click());
                            }
                            menu.menu.insertItem(itm, 0+i);
                        });
                    },
                    view: () => {
                        let itms = [
                            { id: "openclose", label: "Toggle Options", accelerator: "Ctrl+F" },
                            { id: "expandcollapse", label: "Toggle Titlebar", accelerator: "Ctrl+Shift+F" },
                            { id: "minmax", label: "Toggle Maximized", accelerator: "Ctrl+Option+F" },
                            { id: "resetdivider", label: "Reset Divider" },
                            "separator",
                        ];
                        itms.forEach((data, i) => {
                            let itm = App.Menu.Item.fromObj(data);
                            if (util.is(data, "obj")) {
                                if (!("click" in data)) data.click = () => this.post("cmd-"+data.id);
                                itm.addHandler("trigger", e => data.click());
                            }
                            menu.menu.insertItem(itm, 0+i);
                        });
                    },
                };
                if (name in namefs) namefs[name]();
            });

            let eNav;

            eNav = document.createElement("div");
            this.eProjectInfoContent.appendChild(eNav);
            eNav.classList.add("nav");
            eNav.classList.add("source");
            ["nt", "wpilog", "csv-time", "csv-field"].forEach(name => {
                let btn = document.createElement("button");
                eNav.appendChild(this.#eProjectInfoSourceTypes[name] = btn);
                btn.textContent = {
                    "nt": "NT4",
                    "wpilog": "WPILOG",
                    "csv-time": "CSV-Time",
                    "csv-field": "CSV-Field",
                }[name];
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.post("cmd-source-type", name);
                });
            });

            this.#eProjectInfoSourceInput = document.createElement("input");
            this.eProjectInfoContent.appendChild(this.eProjectInfoSourceInput);
            this.eProjectInfoSourceInput.type = "text";
            this.eProjectInfoSourceInput.autocomplete = "off";
            this.eProjectInfoSourceInput.spellcheck = false;

            eNav = document.createElement("div");
            this.eProjectInfoContent.appendChild(eNav);
            eNav.classList.add("nav");
            this.#eProjectInfoActionBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoActionBtn);
            this.eProjectInfoActionBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("cmd-action");
            });

            this.#eBlock = document.getElementById("block");

            const getHovered = (widget, pos, options) => {
                options = util.ensure(options, "obj");
                let canSub = ("canSub" in options) ? options.canSub : true;
                let canTop = ("canTop" in options) ? options.canTop : true;
                const page = this.projectPage;
                pos = new V(pos);
                let r;
                r = page.eContent.getBoundingClientRect();
                pos.x = Math.min(r.right, Math.max(r.left, pos.x));
                pos.y = Math.min(r.bottom, Math.max(r.top, pos.y));
                if (!(widget instanceof Widget)) return null;
                r = widget.elem.getBoundingClientRect();
                if (pos.x < r.left || pos.x > r.right) return null;
                if (pos.y < r.top || pos.y > r.bottom) return null;
                if (widget instanceof Container) {
                    if (canSub) {
                        for (let i = 0; i < widget.children.length; i++) {
                            let h = getHovered(widget.children[i], pos, options);
                            if (h) return h;
                        }
                    }
                }
                if (widget instanceof Panel) {
                    if (canTop) {
                        r = widget.eTop.getBoundingClientRect();
                        if (pos.x > r.left && pos.x < r.right) {
                            if (pos.y > r.top && pos.y < r.bottom) {
                                if (widget.tabs.length <= 0) return {
                                    widget: widget,
                                    at: 0,
                                };
                                let at = null;
                                for (let i = 0; i < widget.tabs.length; i++) {
                                    if (at != null) continue;
                                    let r = widget.getTab(i).eTab.getBoundingClientRect();
                                    if (i == 0) {
                                        if (pos.x < r.left+r.width/2) {
                                            at = 0;
                                            continue;
                                        }
                                    }
                                    if (i+1 >= widget.tabs.length) {
                                        if (pos.x > r.left+r.width/2) at = widget.tabs.length;
                                        continue;
                                    }
                                    let ri = r, rj = widget.getTab(i+1).eTab.getBoundingClientRect();
                                    if (pos.x > ri.left+ri.width/2 && pos.x < rj.left+rj.width) at = i+1;
                                }
                                if (at != null) return {
                                    widget: widget,
                                    at: at,
                                };
                            }
                        }
                    }
                    let tab = widget.getTab(widget.tabIndex);
                    if (tab instanceof Panel.Tab) {
                        let hovered = tab.getHovered(this.dragData, pos, options);
                        if (util.is(hovered, "obj")) return {
                            widget: widget,
                            at: "custom",
                            data: hovered,
                        };
                    }
                    r = widget.elem.getBoundingClientRect();
                }
                let x = (pos.x-r.left)/r.width - 0.5;
                let y = (pos.y-r.top)/r.height - 0.5;
                let at;
                if (x-y > 0) at = (x+y > 0) ? "+x" : "-y";
                else at = (x+y > 0) ? "+y" : "-x";
                return {
                    widget: widget,
                    at: at,
                };
            };
            const isValid = o => {
                if (o instanceof Source.Node) return true;
                if (o instanceof Widget) return true;
                if (o instanceof Panel.Tab) return true;
                return false;
            };
            const canGetWidgetFromData = () => {
                if (this.dragData instanceof Source.Node) return true;
                if (this.dragData instanceof Widget) return true;
                if (this.dragData instanceof Panel.Tab) return true;
                return false;
            };
            const getWidgetFromData = () => {
                if (this.dragData instanceof Source.Node) return new Panel([new Panel.BrowserTab(this.dragData.path)]);
                if (this.dragData instanceof Widget) return this.dragData;
                if (this.dragData instanceof Panel.Tab) return new Panel([this.dragData]);
                return null;
            };
            const canGetTabFromData = () => {
                if (this.dragData instanceof Source.Node) return true;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return true;
                return false;
            };
            const getTabFromData = () => {
                if (this.dragData instanceof Source.Node) return new Panel.BrowserTab(this.dragData.path);
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return this.dragData;
                return null;
            };
            const canGetNodeFromData = () => {
                if (this.dragData instanceof Source.Node) return true;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) {
                    if (!(this.dragData instanceof Panel.BrowserTab)) return false;
                    const page = this.projectPage;
                    if (!page.hasSource()) return false;
                    if (!(page.source.tree.lookup(this.dragData.path) instanceof Source.Node)) return false;
                    return true;
                }
                return false;
            };
            const getNodeFromData = () => {
                if (this.dragData instanceof Source.Node) return this.dragData;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) {
                    if (!(this.dragData instanceof Panel.BrowserTab)) return null;
                    const page = this.projectPage;
                    if (!page.hasSource()) return null;
                    return page.source.tree.lookup(this.dragData.path);
                }
                return null;
            };
            this.addHandler("drag-start", () => {
                if (this.page != "PROJECT") return;
                if (!isValid(this.dragData)) return;
                let canWidget = canGetWidgetFromData();
                let canTab = canGetTabFromData();
                let canNode = canGetNodeFromData();
                if (canNode) {
                    let node = getNodeFromData();
                    this.eDrag.innerHTML = "<div class='explorernode'><button class='display'><div class='main'><ion-icon></ion-icon><div class='name'></div></div></button></div>";
                    let btn = this.eDrag.children[0].children[0].children[0];
                    let icon = btn.children[0], name = btn.children[1];
                    name.textContent = (node.name.length > 0) ? node.name : "/";
                    let display = getDisplay(node.hasField() ? node.field.type : null, node.hasField() ? node.field.get() : null);
                    if (display != null) {
                        if ("src" in display) icon.setAttribute("src", display.src);
                        else icon.name = display.name;
                        if ("color" in display) icon.style.color = display.color;
                        else icon.style.color = "";
                    } else {
                        icon.name = "";
                        icon.style.color = "";
                    }
                    return;
                }
                if (canTab) {
                    if (this.dragData instanceof Panel.Tab) {
                        this.eDrag.innerHTML = "<div class='explorernode'><button class='display'><div class='main'><ion-icon></ion-icon><div class='name'></div></div></button></div>";
                        let btn = this.eDrag.children[0].children[0].children[0];
                        let icon = btn.children[0], name = btn.children[1];
                        name.textContent = this.dragData.name;
                        if (this.dragData.hasIcon) {
                            if (this.dragData.eTabIcon.hasAttribute("src")) icon.setAttribute("src", this.dragData.eTabIcon.getAttribute("src"));
                            else icon.name = this.dragData.eTabIcon.name;
                            icon.style.cssText = this.dragData.eTabIcon.style.cssText;
                        } else icon.style.display = "none";
                    }
                }
            });
            this.addHandler("drag-move", e => {
                if (this.page != "PROJECT") return;
                const page = this.projectPage;
                if (!isValid(this.dragData)) return;
                if (!page.hasWidget()) {
                    this.showBlock();
                    this.placeBlock(page.eContent.getBoundingClientRect());
                    return;
                }
                const hovered = getHovered(
                    page.widget, new V(e.pageX, e.pageY),
                    {
                        canSub: true,
                        canTop: canGetTabFromData(),
                    },
                );
                if (!util.is(hovered, "obj") || !(hovered.widget instanceof Panel))
                    return this.hideBlock();
                this.showBlock();
                let at = hovered.at;
                if (["+x", "-x", "+y", "-y"].includes(at)) {
                    let r = new util.Rect(hovered.widget.elem.getBoundingClientRect());
                    r.x += (at == "+x") ? r.w/2 : 0;
                    r.y += (at == "+y") ? r.h/2 : 0;
                    r.w /= at.includes("x") ? 2 : 1;
                    r.h /= at.includes("y") ? 2 : 1;
                    this.placeBlock(r);
                } else if (util.is(at, "int")) {
                    let r = new util.Rect(hovered.widget.eTop.getBoundingClientRect());
                    let x = (at >= hovered.widget.tabs.length) ? hovered.widget.getTab(hovered.widget.tabs.length-1).eTab.getBoundingClientRect().right : hovered.widget.getTab(at).eTab.getBoundingClientRect().left;
                    this.placeBlock(new util.Rect(x, r.y+5, 0, r.h-10));
                } else if (at == "custom") {
                    let data = util.ensure(hovered.data, "obj");
                    this.placeBlock(new util.Rect(data.r));
                }
            });
            this.addHandler("drag-submit", e => {
                if (this.page != "PROJECT") return;
                const page = this.projectPage;
                if (!isValid(this.dragData)) return;
                this.hideBlock();
                let canWidget = canGetWidgetFromData();
                let canTab = canGetTabFromData();
                if (!page.hasWidget()) {
                    page.widget = getWidgetFromData();
                    return;
                }
                const hovered = getHovered(
                    page.widget, new V(e.pageX, e.pageY),
                    {
                        canSub: true,
                        canTop: canTab,
                    },
                );
                if (!util.is(hovered, "obj") || !(hovered.widget instanceof Panel)) return;
                let at = hovered.at;
                if (["+x", "-x", "+y", "-y"].includes(at) && canWidget) {
                    let widget = getWidgetFromData();
                    let container = new Container();
                    container.axis = at[1];
                    if (hovered.widget == page.widget) {
                        page.widget = null;
                        container.addChild((at[0] == "+") ? hovered.widget : widget);
                        container.addChild((at[0] != "+") ? hovered.widget : widget);
                        page.widget = container;
                    } else {
                        let parent = hovered.widget.parent;
                        let weights = parent.weights, thisAt = parent.children.indexOf(hovered.widget);
                        parent.remChild(hovered.widget);
                        container.addChild((at[0] == "+") ? hovered.widget : widget);
                        container.addChild((at[0] != "+") ? hovered.widget : widget);
                        parent.addChild(container, thisAt);
                        parent.weights = weights;
                    }
                } else if (util.is(at, "int") && canTab) {
                    hovered.widget.addTab(getTabFromData(), at);
                } else if (at == "custom") {
                    let data = util.ensure(hovered.data, "obj");
                    if (util.is(data.submit, "func")) data.submit();
                }
                page.widget.collapse();
            });
        });
    }

    get eProjectInfoSourceTypes() { return Object.keys(this.#eProjectInfoSourceTypes); }
    hasEProjectInfoSourceType(type) { return type in this.#eProjectInfoSourceTypes; }
    getEProjectInfoSourceType(type) { return this.#eProjectInfoSourceTypes[type]; }
    get eProjectInfoSourceInput() { return this.#eProjectInfoSourceInput; }
    get eProjectInfoActionBtn() { return this.#eProjectInfoActionBtn; }
    
    get eBlock() { return this.#eBlock; }
    hasEBlock() { return this.eBlock instanceof HTMLDivElement; }
    get isBlockShown() { return this.hasEBlock() ? this.eBlock.classList.contains("this") : null; }
    set isBlockShown(v) {
        if (!this.hasEBlock()) return;
        v = !!v;
        if (this.isBlockShown == v) return;
        if (v) this.eBlock.classList.add("this")
        else this.eBlock.classList.remove("this");
    }
    get isBlockHidden() { return this.hasEBlock() ? !this.isBlockShown : null; }
    set isBlockHidden(v) { return this.isBlockShown = !v; }
    showBlock() { return this.isBlockShown = true; }
    hideBlock() { return this.isBlockHidden = true; }
    placeBlock(r) {
        r = new util.Rect(r);
        if (!this.hasEBlock()) return;
        r.normalize();
        this.eBlock.style.left = r.x+"px";
        this.eBlock.style.top = r.y+"px";
        this.eBlock.style.width = Math.max(0, r.w)+"px";
        this.eBlock.style.height = Math.max(0, r.h)+"px";
    }
}
App.TitlePage = class AppTitlePage extends App.TitlePage {
    static DESCRIPTION = "The tool for debugging network tables";
};
App.ProjectPage = class AppProjectPage extends App.ProjectPage {
    #explorer;
    #metaExplorer;

    #toolButtons;
    #widget;
    #activeWidget;
    #source;

    #eNavPreInfo;
    #eSide;
    #eSideSections;
    #eContent;
    #eDivider;
    
    constructor(app) {
        super(app);

        this.app.eProjectInfoNameInput.addEventListener("change", e => {
            if (this.choosing) return;
            if (!this.hasProject()) return;
            this.project.meta.name = this.app.eProjectInfoNameInput.value;
        });
        this.app.eProjectInfoSourceInput.addEventListener("change", e => {
            this.project.config.source = this.app.eProjectInfoSourceInput.value;
        });
        this.app.addHandler("cmd-newtab", () => {
            if (!this.hasActivePanel()) return;
            const active = this.activeWidget;
            active.addTab(new Panel.AddTab(), active.tabIndex+1);
        });
        this.app.addHandler("cmd-nexttab", () => {
            if (!this.hasActivePanel()) return;
            const active = this.activeWidget;
            active.tabIndex++;
        });
        this.app.addHandler("cmd-prevtab", () => {
            if (!this.hasActivePanel()) return;
            const active = this.activeWidget;
            active.tabIndex--;
        });
        this.app.addHandler("cmd-closetab", () => {
            if (!this.hasActivePanel()) return;
            const active = this.activeWidget;
            active.remTab(active.tabs[active.tabIndex]);
        });
        this.app.addHandler("cmd-openclose", () => {
            if (!this.hasActivePanel()) return;
            const active = this.activeWidget;
            if (!active.tabs[active.tabIndex]) return;
            active.tabs[active.tabIndex].post("openclose");
        });
        this.app.addHandler("cmd-expandcollapse", () => {
            if (!this.hasActivePanel()) return;
            const active = this.activeWidget;
            active.isTitleCollapsed = !active.isTitleCollapsed;
        });
        this.app.addHandler("cmd-minmax", () => {
            if (!this.hasActivePanel()) return;
            const active = this.activeWidget;
            active.isMaximized = !active.isMaximized;
        });
        this.app.addHandler("cmd-resetdivider", () => {
            if (!this.hasProject()) return;
            this.project.sidePos = null;
        });
        this.app.addHandler("cmd-source-type", type => {
            if (!this.hasProject()) return;
            type = String(type);
            if (!["nt", "wpilog", "csv-time", "csv-field"].includes(type)) return;
            this.project.config.sourceType = type;
            this.update(0);
            this.app.post("cmd-action");
        });
        this.app.addHandler("cmd-action", () => {
            if (!this.hasProject() || !this.hasSource()) return;
            if (this.source instanceof NTSource) {
                this.source.address = (this.source.address == null) ? this.project.config.source : null;
                return;
            }
            if (
                (this.source instanceof WPILOGSource) ||
                (this.source instanceof CSVTimeSource) ||
                (this.source instanceof CSVFieldSource)
            ) {
                if (this.source.importing) return;
                if (this.project.config.source == null) return;
                (async () => {
                    const source = this.source;
                    source.importing = true;
                    this.app.progress = 0;
                    try {
                        let file = this.project.config.source;
                        let i1 = file.lastIndexOf("/");
                        let i2 = file.lastIndexOf("\\");
                        let i = Math.max(i1, i2);
                        source.file = file;
                        source.shortFile = file.substring(i+1);
                        const progress = v => (this.app.progress = v);
                        source.addHandler("progress", progress);
                        await source.import(file);
                        source.remHandler("progress", progress);
                        this.app.progress = 1;
                    } catch (e) {
                        this.app.doError({
                            NTSource: "NT",
                            WPILOGSource: "WPILOG",
                            CSVTimeSource: "CSV-Time",
                            CSVFieldSource: "CSV-Field",
                        }[source.constructor.name]+" Load Error", "File: "+this.project.config.source, e);
                    }
                    this.app.progress = null;
                    delete source.importing;
                })();
                return;
            }
        });

        this.eNavProgress.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            if (!this.hasSource()) return;
            e.preventDefault();
            e.stopPropagation();
            let paused = this.source.playback.paused;
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                if (!this.hasSource()) return;
                this.source.playback.paused = paused;
            };
            const mousemove = e => {
                if (!this.hasSource()) return;
                this.source.playback.paused = true;
                this.source.ts = util.lerp(this.source.tsMin, this.source.tsMax, this.progressHover);
            };
            mousemove(e);
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.eNavOptionsButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasSource()) return;
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item(
                this.source.playback.finished ? "Replay" : this.source.playback.paused ? "Play" : "Pause",
                this.source.playback.finished ? "refresh" : this.source.playback.paused ? "play" : "pause",
            ));
            itm.addHandler("trigger", e => {
                this.eNavActionButton.click();
            });
            itm = menu.addItem(new core.App.Menu.Item("Skip to front"));
            itm.addHandler("trigger", e => {
                this.eNavBackButton.click();
            });
            itm = menu.addItem(new core.App.Menu.Item("Skip to end"));
            itm.addHandler("trigger", e => {
                this.eNavForwardButton.click();
            });
            itm = menu.addItem(new core.App.Menu.Item("Custom timestamp..."));
            let subitm;
            subitm = itm.menu.addItem(new core.App.Menu.Item("Exact timestamp"));
            subitm.addHandler("trigger", async e => {
                let pop = this.app.prompt("Custom Timestamp", "Exact timestamp in seconds");
                pop.type = "num";
                pop.icon = "time";
                let result = await pop.whenResult();
                if (result == null) return;
                if (!this.hasSource()) return;
                this.source.ts = parseFloat(result)*1000;
                // 199.461
            });
            subitm = itm.menu.addItem(new core.App.Menu.Item("Time since beginning"));
            subitm.addHandler("trigger", async e => {
                let pop = this.app.prompt("Custom Timestamp", "Time since beginning in seconds");
                pop.type = "num";
                pop.icon = "time";
                let result = await pop.whenResult();
                if (result == null) return;
                if (!this.hasSource()) return;
                this.source.ts = this.source.tsMin+parseFloat(result)*1000;
            });
            this.app.contextMenu = menu;
            let r = this.eNavOptionsButton.getBoundingClientRect();
            this.app.placeContextMenu(r.left, r.top);
        });
        this.eNavActionButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasSource()) return;
            if (this.source.playback.finished) return this.source.ts = this.source.tsMin;
            this.source.playback.paused = !this.source.playback.paused;
        });
        this.eNavBackButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasSource()) return;
            this.source.ts = this.source.tsMin;
        });
        this.eNavForwardButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasSource()) return;
            this.source.ts = this.source.tsMax;
        });
        this.addHandler("nav-back", () => {
            if (!this.hasSource()) return;
            this.source.ts -= 5*1000;
        });
        this.addHandler("nav-forward", () => {
            if (!this.hasSource()) return;
            this.source.ts += 5*1000;
        });
        this.addHandler("nav-back-small", () => {
            if (!this.hasSource()) return;
            this.source.ts -= 1;
        });
        this.addHandler("nav-forward-small", () => {
            if (!this.hasSource()) return;
            this.source.ts += 1;
        });

        this.#explorer = new FieldExplorer();
        this.explorer.addHandler("contextmenu", (e, path) => {
            e = util.ensure(e, "obj");
            let enode = this.explorer.lookup(path);
            if (!enode) return;
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item((enode.isJustPrimitive && enode.isOpen) ? "Close" : "Open"));
            itm.disabled = enode.isJustPrimitive;
            itm.addHandler("trigger", e => {
                enode.isOpen = !enode.isOpen;
            });
            itm = menu.addItem(new core.App.Menu.Item(enode.showValue ? "Hide Value" : "Show Value"));
            itm.disabled = !enode.hasType();
            itm.addHandler("trigger", e => {
                enode.showValue = !enode.showValue;
            });
            menu.addItem(new core.App.Menu.Divider());
            itm = menu.addItem(new core.App.Menu.Item("Start Dragging"));
            itm.addHandler("trigger", e => {
                enode.post("drag", e, enode.name);
            });
            this.app.contextMenu = menu;
            this.app.placeContextMenu(e.pageX, e.pageY);
        });
        this.explorer.addHandler("drag", (e, path) => {
            path = util.generatePath(path);
            let node = this.hasSource() ? this.source.tree.lookup(path) : null;
            if (!node) return;
            this.app.dragData = node;
            this.app.dragging = true;
        });
        this.#metaExplorer = new core.Explorer();

        this.#toolButtons = new Set();
        this.#widget = null;
        this.#activeWidget = null;
        this.#source = null;

        this.#eNavPreInfo = document.createElement("div");
        this.eNavPre.appendChild(this.eNavPreInfo);
        this.eNavPreInfo.classList.add("info");

        this.#eSide = document.createElement("div");
        this.eMain.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.#eSideSections = {};
        const names = ["source", "browser", "tools"];
        names.forEach((name, i) => {
            if (i > 0) {
                let elem = document.createElement("div");
                this.eSide.appendChild(elem);
                elem.classList.add("divider");
                elem.addEventListener("mousedown", e => {
                    const mouseup = () => {
                        document.removeEventListener("mouseup", mouseup);
                        document.removeEventListener("mousemove", mousemove);
                    };
                    const mousemove = e => {
                        if (!this.hasProject()) return;
                        const available = this.sideAvailable;
                        let r = this.eSide.getBoundingClientRect();
                        let y = e.pageY-r.top;
                        let top = 0;
                        for (let j = 0; j < i-1; j++)
                            top += this.getESideSection(names[j]).elem.getBoundingClientRect().height;
                        top += available.heightBtn;
                        let bottom = r.height;
                        for (let j = names.length-1; j > i; j--)
                            bottom -= this.getESideSection(names[j]).elem.getBoundingClientRect().height;
                        bottom -= available.heightBtn;
                        y = Math.min(bottom, Math.max(top, y));
                        // const names2 = names.filter(name => this.project.getSideSectionPos(name) > 0);
                        // let i2 = names2.indexOf(names[i-1]);
                        // if (names2.length <= 1) {
                        //     this.project.setSideSectionPos(names[i-1], );
                        //     this.project.fixSideSectionPos(true);
                        // } else {
                        //     // let p = (e.pageY-r.top) / r.height;
                        //     let mnBound = 0, mxBound = 0;
                        //     for (let j = 0; j < names2.length; j++) mxBound += this.project.getSideSectionPos(names2[j]);
                        //     for (let j = 0; j < i2-1; j++) mnBound += this.project.getSideSectionPos(names2[j]);
                        //     for (let j = names2.length-1; j > i2; j--) mxBound -= this.project.getSideSectionPos(names2[j]);
                        //     // p = Math.min(mxBound, Math.max(mnBound, p));
                        //     let p = util.lerp(mnBound, mxBound, (y-top)/(bottom-top));
                        //     this.project.setSideSectionPos(names2[i2-1], p-mnBound, false);
                        //     this.project.setSideSectionPos(names2[i2], mxBound-p, false);
                        //     this.project.fixSideSectionPos();
                        // }
                    };
                    document.addEventListener("mouseup", mouseup);
                    document.addEventListener("mousemove", mousemove);
                });
            }
            let elem = document.createElement("div");
            this.eSide.appendChild(elem);
            elem.id = name;
            elem.classList.add("section");
            let s = this.#eSideSections[name] = new util.Target();
            s.elem = elem;
            let btn = s.eBtn = document.createElement("button");
            elem.appendChild(btn);
            btn.classList.add("override");
            btn.innerHTML = "<ion-icon name='chevron-forward'></ion-icon><span></span>";
            btn.children[1].textContent = name.toUpperCase();
            btn.addEventListener("click", e => {
                e.stopPropagation();
                if (!this.hasProject()) return;
                if (this.project.hasSideSectionPos(name) && this.project.getSideSectionPos(name) > 0)
                    this.project.delSideSectionPos(name);
                else {
                    let sideSectionPos = this.project.sideSectionPos;
                    let sum = 0, n = 0;
                    for (let k in sideSectionPos) {
                        if (sideSectionPos[k] <= 0) continue;
                        sum += sideSectionPos[k];
                        n++;
                    }
                    this.project.setSideSectionPos(name, (n > 0) ? (sum/n) : 1);
                }
                this.project.fixSideSectionPos(true);
            });
            s.eContent = document.createElement("div");
            elem.appendChild(s.eContent);
            s.eContent.classList.add("content");
            let idfs = {
                source: () => {
                    s.eContent.remove();
                    s.eContent = this.metaExplorer.elem;
                    elem.appendChild(s.eContent);
                    s.eContent.classList.add("content");
                },
                browser: () => {
                    s.eContent.remove();
                    s.eContent = this.explorer.elem;
                    elem.appendChild(s.eContent);
                    s.eContent.classList.add("content");
                },
            };
            if (elem.id in idfs) idfs[elem.id]();
        });
        new ResizeObserver(() => this.formatSide()).observe(this.eSide);
        this.#eContent = document.createElement("div");
        this.eMain.appendChild(this.eContent);
        this.eContent.classList.add("content");
        new ResizeObserver(() => this.formatContent()).observe(this.eContent);
        this.addHandler("change-project", () => this.formatSide());
        this.addHandler("change-project.setSideSectionPos", () => this.formatSide());
        this.addHandler("change-project.delSideSectionPos", () => this.formatSide());
        this.addHandler("change-project.fixSideSectionPos", () => this.formatSide());
        
        let toolButtons = Panel.getTools();
        this.addToolButton(toolButtons.map(data => {
            let btn = new ToolButton(data.nickname, data.id);
            btn.elem.disabled = !!data.disabled;
            btn.addHandler("trigger", () => {
                if (!!data.disabled) return;
                if (!this.hasActivePanel()) return;
                const active = this.activeWidget;
                active.addTab(new data.tab(), active.tabIndex+1);
            });
            btn.addHandler("contextmenu", e => {
                let itm;
                let menu = new core.App.Menu();
                itm = menu.addItem(new core.App.Menu.Item("Open"));
                itm.addHandler("trigger", e => {
                    btn.post("trigger", e);
                });
                itm = menu.addItem(new core.App.Menu.Item("Start Dragging"));
                itm.addHandler("trigger", e => {
                    btn.post("drag", e);
                });
                this.app.contextMenu = menu;
                this.app.placeContextMenu(e.pageX, e.pageY);
            });
            btn.addHandler("drag", () => {
                if (!!data.disabled) return;
                this.app.dragData = new data.tab();
                this.app.dragging = true;
            });
            return btn;
        }));

        new core.DropTarget(this.elem, e => {
            let items = e.dataTransfer.items ? [...e.dataTransfer.items] : [];
            items = items.map(item => item.getAsFile()).filter(file => file instanceof File);
            if (items.length <= 0) items = e.dataTransfer.files ? [...e.dataTransfer.files] : [];
            items = items.filter(item => item instanceof File);
            if (items.length <= 0) return;
            const file = items[0];
            const path = file.path;
            if (!this.hasProject()) return;
            let type = "wpilog";
            if (path.endsWith(".wpilog")) type = "wpilog";
            else if (path.endsWith(".time.csv")) type = "csv-time";
            else if (path.endsWith(".field.csv")) type = "csv-field";
            else if (path.endsWith(".csv")) type = "csv-time";
            this.project.config.sourceType = type;
            this.project.config.source = path;
            this.update(0);
            this.app.post("cmd-action");
        });

        this.#eDivider = document.createElement("div");
        this.eMain.appendChild(this.eDivider);
        this.eDivider.classList.add("divider");
        this.eDivider.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = () => {
                this.eDivider.classList.remove("this");
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                let r = this.eMain.getBoundingClientRect();
                let p = (e.pageX-r.left) / r.width;
                if (!this.hasProject()) return;
                this.project.sidePos = p;
            };
            this.eDivider.classList.add("this");
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.source = null;

        this.format();

        let requestCollapse = false;
        this.addHandler("change-widget", () => (requestCollapse = true));
        
        const update = () => {
            this.widget = this.hasProject() ? this.project.buildWidget() : null;

            this.app.eProjectInfoBtnName.textContent = this.hasProject() ? this.project.meta.name : "";
            this.app.eProjectInfoNameInput.value = this.hasProject() ? this.project.meta.name : "";
            this.app.eProjectInfoSourceInput.value = this.hasProject() ? this.project.config.source : "";

            ["nt", "wpilog", "csv-time", "csv-field"].forEach(type => {
                let itm = this.app.menu.getItemById("source:"+type);
                if (!itm) return;
                itm.checked = this.hasProject() ? (type == this.project.config.sourceType) : false;
            });
        };
        this.addHandler("change-project", update);
        this.addHandler("change-project.meta.name", update);
        this.addHandler("change-project.config.setSource", update);
        this.addHandler("change-project.config.delSource", update);
        this.addHandler("change-project.config.sourceType", update);

        let timer = 0;
        this.addHandler("update", async delta => {
            LOGGERCONTEXT.update(delta);

            if (this.app.page == this.name)
                this.app.title = this.hasProject() ? (this.project.meta.name+" — "+this.sourceInfo) : "?";
            
            if (this.hasProject()) {
                const constructor = {
                    nt: NTSource,
                    wpilog: WPILOGSource,
                    "csv-time": CSVTimeSource,
                    "csv-field": CSVFieldSource,
                }[this.project.config.sourceType];
                if (!util.is(constructor, "func")) this.source = null;
                else {
                    if (!(this.source instanceof constructor)) this.source = {
                        nt: () => new NTSource(null),
                        wpilog: () => new WPILOGSource(null),
                        "csv-time": () => new CSVTimeSource(null),
                        "csv-field": () => new CSVFieldSource(null),
                    }[this.project.config.sourceType]();
                    let typefs = {
                        nt: () => {
                            if (this.source.address == null) return;
                            if (this.source.address == this.project.config.source) return;
                            this.source.address = null;
                        },
                    };
                    if (this.project.config.sourceType in typefs) typefs[this.project.config.sourceType]();
                }
            } else this.source = null;

            if (this.hasSource())
                this.source.playback.update(delta);

            this.app.eProjectInfoSourceTypes.forEach(type => {
                let elem = this.app.getEProjectInfoSourceType(type);
                if (this.hasProject() && this.project.config.sourceType == type) elem.classList.add("special");
                else elem.classList.remove("special");
            });

            if (this.hasWidget()) {
                this.widget.update(delta);
                if (requestCollapse) {
                    requestCollapse = false;
                    this.widget.collapse();
                }
                if (this.hasSource()) {
                    const sstart = this.source.tsMin, sstop = this.source.tsMax, slen = sstop-sstart;
                    let n = 0;
                    const dfs = widget => {
                        if (widget instanceof Container)
                            return widget.children.forEach(widget => dfs(widget));
                        const tab = widget.tabs[widget.tabIndex];
                        if (!(tab instanceof Panel.VideoSyncTab)) return;
                        if (!tab.hasVideo()) return;
                        const offset = util.ensure(tab.getOffset(tab.video), "num");
                        const len = util.ensure(tab.duration, "num") * 1000;
                        const buffered = tab.eVideo.buffered;
                        while (this.sections.length < n+buffered.length+1)
                            this.addSection(new core.AppFeature.ProjectPage.Section(0, 0, 0));
                        for (let i = 0; i < buffered.length+1; i++) {
                            let sect = this.sections[n+i];
                            if (i <= 0) {
                                sect.l = Math.min(1, Math.max(0, (-offset)/slen));
                                sect.r = Math.min(1, Math.max(0, (len-offset)/slen));
                                sect.x = 0;
                                sect.color = "var(--a)";
                                continue;
                            }
                            sect.l = Math.min(1, Math.max(0, (buffered.start(i-1)*1000-offset)/slen));
                            sect.r = Math.min(1, Math.max(0, (buffered.end(i-1)*1000-offset)/slen));
                            sect.x = 1;
                            sect.color = "var(--v8)";
                        }
                        n += buffered.length+1;
                    };
                    dfs(this.widget);
                    while (this.sections.length > n)
                        this.remSection(this.sections.at(-1));
                }
            } else {
                this.widget = new Panel();
                this.sections = [];
            }
            if (!this.hasWidget() || !this.widget.contains(this.activeWidget))
                this.activeWidget = null;
            
            if (!this.hasSource());
            else if (this.source instanceof NTSource) {
                let on = !this.source.connecting && !this.source.connected;
                if (on) this.app.eProjectInfoActionBtn.classList.add("on");
                else this.app.eProjectInfoActionBtn.classList.remove("on");
                if (!on) this.app.eProjectInfoActionBtn.classList.add("off");
                else this.app.eProjectInfoActionBtn.classList.remove("off");
                this.app.eProjectInfoActionBtn.textContent = on ? "Connect" : "Disconnect";
            } else if (
                (this.source instanceof WPILOGSource) ||
                (this.source instanceof CSVTimeSource) ||
                (this.source instanceof CSVFieldSource)
            ) {
                this.app.eProjectInfoActionBtn.disabled = this.source.importing;
            }

            let itm = this.app.menu.getItemById("action");
            if (itm) {
                if (!this.hasSource()) {
                    itm.enabled = false;
                    itm.label = "No source";
                } else if (this.source instanceof NTSource) {
                    let on = !this.source.connecting && !this.source.connected;
                    itm.enabled = true;
                    itm.label = on ? "Connect" : "Disconnect";
                } else if (
                    (this.source instanceof WPILOGSource) ||
                    (this.source instanceof CSVTimeSource) ||
                    (this.source instanceof CSVFieldSource)
                ) {
                    itm.enabled = true;
                    itm.label = "Import";
                }
            }

            if (this.hasSource()) {
                this.navOpen = true;
                let tMin = this.source.tsMin, tMax = this.source.tsMax;
                let tNow = this.source.ts;
                this.progress = (tNow - tMin) / (tMax - tMin);
                if (this.eNavActionButton.children[0])
                    this.eNavActionButton.children[0].name = this.source.playback.finished ? "refresh" : this.source.playback.paused ? "play" : "pause";
                this.eNavProgressTooltip.textContent = util.formatTime(util.lerp(tMin, tMax, this.progressHover));
                this.eNavPreInfo.textContent = [tNow-tMin, tMax-tMin].map(v => util.formatTime(v)).join(" / ");
                this.eNavInfo.textContent = [tMin, tNow, tMax].map(v => util.formatTime(v)).join(" / ");
            } else this.navOpen = false;
            
            FieldExplorer.Node.doubleTraverse(
                this.hasSource() ? this.source.tree.nodeObjects : [],
                this.explorer.nodeObjects,
                (...enodes) => this.explorer.add(...enodes),
                (...enodes) => this.explorer.rem(...enodes),
            );
            const dfs = data => {
                data.dump = enode => {
                    if ("iconSrc" in data) enode.iconSrc = data.iconSrc;
                    else enode.icon = data.icon;
                    if ("value" in data) enode.tooltip = data.value;
                    enode.data = data;
                    if (enode._done) return;
                    enode._done = true;
                    enode.eValue.style.color = "var(--a)";
                    enode.eTooltip.style.color = "var(--a)";
                    enode.addHandler("trigger", e => {
                        if (!enode.eDisplay.contains(e.target)) return;
                        if (("value" in enode.data) || e.shiftKey) enode.showValue = !enode.showValue;
                        else enode.isOpen = !enode.isOpen;
                    });
                };
                util.ensure(data.children, "arr").forEach(data => dfs(data));
                data.nodeObjects = data.children;
            };
            let info = this.sourceMetaInfo;
            dfs(info);
            this.getESideSection("source").eBtn.children[1].textContent = info.name;
            core.Explorer.Node.doubleTraverse(
                info.nodeObjects,
                this.metaExplorer.nodeObjects,
                (...enodes) => this.metaExplorer.add(...enodes),
                (...enodes) => this.metaExplorer.rem(...enodes),
            );

            this.eMain.style.setProperty("--side", (100*(this.hasProject() ? this.project.sidePos : 0.15))+"%");

            if (timer > 0) return timer -= delta;
            timer = 5000;
            if (!this.hasProject()) return;
            let r = this.eContent.getBoundingClientRect();
            this.project.meta.thumb = await App.capture({
                x: Math.round(r.left), y: Math.round(r.top),
                width: Math.round(r.width), height: Math.round(r.height),
            });
        });

        this.addHandler("enter", async data => {
            let projectOnly = [
                "newtab",
                "closetab",
                "action",
                "openclose", "expandcollapse", "resetdivider",
            ];
            projectOnly.forEach(id => {
                let itm = this.app.menu.getItemById(id);
                if (!itm) return;
                itm.exists = true;
            });
            await this.refresh();
            if (this.app.hasProject(data.id)) {
                this.project = this.app.getProject(data.id);
            } else if (data.project instanceof Project) {
                this.project = data.project;
            } else {
                this.project = new Project();
                this.project.meta.created = this.project.meta.modified = util.getTime();
                this.project.config.setSource("nt", "http://localhost");
            }
        });
        this.addHandler("post-enter", async data => {
            let itm;
            itm = this.app.menu.getItemById("closeproject");
            if (itm) itm.accelerator = "CmdOrCtrl+Shift+W";
            itm = this.app.menu.getItemById("close");
            if (itm) itm.accelerator = "";
        });
        this.addHandler("leave", async data => {
            let projectOnly = [
                "newtab",
                "closetab",
                "action",
                "openclose", "expandcollapse", "resetdivider",
            ];
            projectOnly.forEach(id => {
                let itm = this.app.menu.getItemById(id);
                if (!itm) return;
                itm.exists = false;
            });
        });
        this.addHandler("post-leave", async data => {
            let itm;
            itm = this.app.menu.getItemById("closeproject");
            if (itm) itm.accelerator = null;
            itm = this.app.menu.getItemById("close");
            if (itm) itm.accelerator = null;
        });
    }

    get explorer() { return this.#explorer; }
    get metaExplorer() { return this.#metaExplorer; }

    get toolButtons() { return [...this.#toolButtons]; }
    set toolButtons(v) {
        v = util.ensure(v, "arr");
        this.clearToolButtons();
        this.addToolButton(v);
    }
    clearToolButtons() {
        let btns = this.toolButtons;
        this.remToolButton(btns);
        return btns;
    }
    hasToolButton(btn) {
        if (!(btn instanceof ToolButton)) return false;
        return this.#toolButtons.has(btn);
    }
    addToolButton(...btns) {
        return util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof ToolButton)) return false;
            if (this.hasToolButton(btn)) return false;
            this.#toolButtons.add(btn);
            this.getESideSection("tools").eContent.appendChild(btn.elem);
            btn.onAdd();
            return btn;
        });
    }
    remToolButton(...btns) {
        return util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof ToolButton)) return false;
            if (!this.hasToolButton(btn)) return false;
            btn.onRem();
            this.#toolButtons.delete(btn);
            this.getESideSection("tools").eContent.removeChild(btn.elem);
            return btn;
        });
    }

    get widget() { return this.#widget; }
    set widget(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.widget == v) return;
        if (this.hasWidget()) {
            this.widget.onRem();
            this.widget.parent = null;
            this.widget.clearLinkedHandlers(this, "change");
            this.eContent.removeChild(this.widget.elem);
        }
        this.#widget = v;
        if (this.hasWidget()) {
            this.widget.parent = this;
            const onChange = () => {
                if (this.hasProject())
                    this.project.widgetData = JSON.stringify(this.widget);
                this.change("widget", null, this.widget);
            };
            this.widget.addLinkedHandler(this, "change", onChange);
            this.eContent.appendChild(this.widget.elem);
            this.activeWidget = this.widget;
            this.widget.onAdd();
        }
        if (this.hasProject())
            this.project.widgetData = JSON.stringify(this.widget);
        this.formatContent();
    }
    hasWidget() { return !!this.widget; }
    get activeWidget() { return this.#activeWidget; }
    set activeWidget(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.activeWidget == v) return;
        if (this.hasActiveWidget()) this.activeWidget.elem.classList.remove("active");
        this.#activeWidget = v;
        if (this.hasActiveWidget()) this.activeWidget.elem.classList.add("active");
    }
    hasActiveWidget() { return !!this.activeWidget; }
    hasActiveContainer() { return this.activeWidget instanceof Container; }
    hasActivePanel() { return this.activeWidget instanceof Panel; }
    get source() { return this.#source; }
    set source(v) {
        v = (v instanceof Source) ? v : null;
        if (this.source == v) return;
        if (this.hasSource()) {
            if (this.source instanceof NTSource) this.source.address = null;
        }
        this.#source = v;
        if (!this.hasSource()) {
            this.app.eProjectInfoNameInput.placeholder = "No source";
            this.app.eProjectInfoActionBtn.disabled = true;
            this.app.eProjectInfoActionBtn.classList.remove("on");
            this.app.eProjectInfoActionBtn.classList.remove("off");
            this.app.eProjectInfoActionBtn.classList.remove("special");
            this.app.eProjectInfoActionBtn.textContent = "No source";
        } else if (this.source instanceof NTSource) {
            this.app.eProjectInfoSourceInput.placeholder = "Provide an IP...";
            this.app.eProjectInfoActionBtn.disabled = false;
            this.app.eProjectInfoActionBtn.classList.remove("special");
        } else if (
            (this.source instanceof WPILOGSource) ||
            (this.source instanceof CSVTimeSource) ||
            (this.source instanceof CSVFieldSource)
        ) {
            this.app.eProjectInfoSourceInput.placeholder = "Path...";
            this.app.eProjectInfoActionBtn.classList.remove("on");
            this.app.eProjectInfoActionBtn.classList.remove("off");
            this.app.eProjectInfoActionBtn.classList.add("special");
            this.app.eProjectInfoActionBtn.textContent = "Import";
        } else {
            this.app.eProjectInfoNameInput.placeholder = "Unknown source: "+this.source.constructor.name;
            this.app.eProjectInfoActionBtn.disabled = true;
            this.app.eProjectInfoActionBtn.classList.remove("on");
            this.app.eProjectInfoActionBtn.classList.remove("off");
            this.app.eProjectInfoActionBtn.classList.remove("special");
            this.app.eProjectInfoActionBtn.textContent = "Unknown source: "+this.source.constructor.name;
        }
        let itm = this.app.menu.getItemById("action");
        if (!itm) return;
        if (!this.hasSource()) {
            itm.enabled = false;
            itm.label = "No source";
        } else if (this.source instanceof NTSource) {
            let on = !this.source.connecting && !this.source.connected;
            itm.enabled = true;
            itm.label = on ? "Connect" : "Disconnect";
        } else if (
            (this.source instanceof WPILOGSource) ||
            (this.source instanceof CSVTimeSource) ||
            (this.source instanceof CSVFieldSource)
        ) {
            itm.enabled = true;
            itm.label = "Import";
        } else {
            itm.enabled = false;
            itm.label = "Unknown source: "+this.source.constructor.name;
        }
    }
    hasSource() { return !!this.source; }
    get sourceInfo() {
        if (!this.hasSource()) return "No source";
        if (this.source instanceof NTSource) {
            if (!this.source.connecting && !this.source.connected) return "Disconnected";
            if (this.source.connecting) return "Connecting to "+this.source.address;
            return this.source.address;
        }
        if (
            (this.source instanceof WPILOGSource) ||
            (this.source instanceof CSVTimeSource) ||
            (this.source instanceof CSVFieldSource)
        ) {
            if (!this.source.importing && !this.source.hasData()) return "Nothing imported";
            if (this.source.importing) return "Importing from "+this.source.shortFile;
            return this.source.shortFile;
        }
        return "Unknown source: "+this.source.constructor.name;
    }
    get sourceMetaInfo() {
        let data = { name: this.sourceInfo, children: [] };
        if (!this.hasSource()) return data;
        data.children.push({
            name: null,
            icon: "book",
        });
        if (this.source instanceof NTSource) {
            data.children.at(-1).name = "NT4";
            data.children.push(
                {
                    name: "IP",
                    value: this.source.address,
                    icon: "navigate",
                },
                {
                    name: "State",
                    value: ((!this.source.connecting && !this.source.connected) ? "Disconnected" : (this.source.connecting) ? "Connecting" : "Connected"),
                    icon: "cube-outline",
                },
            );
        } else if (
            (this.source instanceof WPILOGSource) ||
            (this.source instanceof CSVTimeSource) ||
            (this.source instanceof CSVFieldSource)
        ) {
            data.children.at(-1).name = {
                WPILOGSource: "WPILOG",
                CSVTimeSource: "CSV-Time",
                CSVFieldSource: "CSV-Field",
            }[this.source.constructor.name];
            data.children.push(
                {
                    name: "File",
                    value: this.source.file,
                    icon: "document-outline",
                },
                {
                    name: "State",
                    value: ((!this.source.importing && !this.source.hasData()) ? "Not imported" : (this.source.importing) ? "Importing" : "Imported"),
                    icon: "cube-outline",
                },
            );
        } else {
            data.children.at(-1).name = "Unkown: "+this.source.constructor.name;
        }
        const tMin = this.source.tsMin, tMax = this.source.tsMax;
        data.children.push(
            {
                name: "Fields",
                value: this.source.tree.nFields,
                iconSrc: "../assets/icons/number.svg",
            },
            {
                name: "Duration",
                value: ((tMin == 0) ? util.formatTime(tMax) : `[${util.formatTime(tMin)} - ${util.formatTime(tMax)}]`),
                icon: "time-outline",
            },
        );
        return data;
    }

    get eNavPreInfo() { return this.#eNavPreInfo; }
    get eSide() { return this.#eSide; }
    get eSideSections() { return Object.keys(this.#eSideSections); }
    hasESideSection(id) { return id in this.#eSideSections; }
    getESideSection(id) { return this.#eSideSections[id]; }
    get eContent() { return this.#eContent; }
    get eDivider() { return this.#eDivider; }

    format() {
        this.formatSide();
        this.formatContent();
    }
    get sideAvailable() {
        let ids = this.eSideSections;
        let elems = ids.map(id => this.getESideSection(id).elem);
        let height = this.eSide.getBoundingClientRect().height;
        Array.from(this.eSide.children).forEach(elem => {
            if (elems.includes(elem)) return;
            if (elem.classList.contains("divider")) return;
            height -= elem.getBoundingClientRect().height;
        });
        let h = 0, n = 0;
        elems.forEach(elem => {
            let btn = elem.querySelector(":scope > button");
            if (!btn) return;
            h = Math.max(h, btn.getBoundingClientRect().height);
            n++;
        });
        return {
            height: height,
            heightBtn: h,
            nBtn: n,
        };
    }
    formatSide() {
        const available = this.sideAvailable;
        const availableHeight = available.height - available.heightBtn*available.nBtn;
        this.eSideSections.forEach(id => {
            let s = this.getESideSection(id);
            let x = (this.hasProject() && this.project.hasSideSectionPos(id)) ? this.project.getSideSectionPos(id) : 0;
            if (x > 0) s.elem.classList.add("this");
            else s.elem.classList.remove("this");
            s.elem.style.setProperty("--h", (availableHeight*x + available.heightBtn)+"px");
        });
        this.metaExplorer.format();
        this.explorer.format();
        return true;
    }
    formatContent() {
        if (!this.hasWidget()) return false;
        let r = this.eContent.getBoundingClientRect();
        this.widget.elem.style.setProperty("--w", r.width+"px");
        this.widget.elem.style.setProperty("--h", r.height+"px");
        this.widget.format();
        return true;
    }

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
};
