import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import Source from "../sources/source.js";
import NTSource from "../sources/nt4/source.js";
import WPILOGSource from "../sources/wpilog/source.js";
import { WorkerClient } from "../worker.js";


const LOADER = new GLTFLoader();


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

const WPILIB2THREE = THREE.Quaternion.fromRotationSequence(
    {
        axis: "x",
        angle: 90,
    },
    {
        axis: "y",
        angle: 180,
    },
);
const THREE2WPILIB = WPILIB2THREE.clone().invert();


export const VERSION = 3;

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
    if (o instanceof Uint8Array) return alt ? util.TEXTDECODER.decode(o) : [...o].map(x => x.toString(16).padStart(2, "0")).join("");
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
    if (name == "logger" || name == "logworks") return {
        name: "list",
        color: "var(--cc)",
    };
}

core.Explorer.Node = class ExplorerNode extends core.Explorer.Node {
    #canShowValue;

    static doubleTraverse(nodeArr, enodeArr, addFunc, remFunc, dumpFunc=null) {
        return super.doubleTraverse(
            util.ensure(nodeArr, "arr").filter(node => (node instanceof Source.Node)).map(node => {
                node.info = node.hasField() ? node.field.type : null;
                node.value = node.hasField() ? node.field.get() : null;
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
    #host;
    #client;

    #serverLogs;
    #clientLogs;

    #loading;

    constructor() {
        super();

        this.#host = null;
        this.#client = null;

        this.#serverLogs = new Set();
        this.#clientLogs = {};

        this.#loading = {};

        setInterval(async () => {
            if (this.#hasClient()) {
                if (this.#client.disconnected)
                    this.#client.connect();
            } else {
                this.#host = await window.api.get("socket-host");
                this.#host = (this.#host == null) ? null : String(this.#host);
                if (this.#hasHost()) this.#client = new core.Client(this.#host+"/api/panel");
            }
            await this.pollServer();
        }, 1000);
        setInterval(async () => {
            await this.pollClient();
        }, 100);
    }

    #hasHost() { return this.#host != null; }
    #hasClient() { return !!this.#client; }

    get initializing() { return !this.#hasClient(); }
    get initialized() { return !this.initializing; }
    get connected() { return this.#hasClient() && this.#client.connected; }
    get disconnected() { return !this.connected; }
    get location() { return this.#hasClient() ? this.#client.location : null; }
    get socketId() { return this.#hasClient() ? this.#client.socketId : null; }

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

    async logsUpload(paths) {
        paths = util.ensure(paths, "arr").map(path => String(path));
        if (this.disconnected) return;
        await Promise.all(paths.map(async path => {
            this.incLoading("§uploading");
            try {
                await window.api.send("log-cache", path);
                await this.#client.stream(path, "logs", {});
            } catch (e) {
                this.decLoading("§uploading");
                throw e;
            }
            this.decLoading("§uploading");
        }));
        await this.pollServer();
    }
    async logsDownload(names) {
        names = util.ensure(names, "arr").map(name => String(name));
        if (this.disconnected) return;
        await Promise.all(names.map(async name => {
            this.incLoading(name);
            try {
                await this.#client.emit("log-download", name);
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
                await window.api.send("log-delete", name);
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
                await this.#client.emit("log-delete", name);
            } catch (e) {
                this.decLoading(name);
                throw e;
            }
            this.decLoading(name);
        }));
        await this.pollServer();
    }

    async pollServer() {
        let logs = [];
        if (this.connected) {
            try {
                logs = util.ensure(await this.#client.emit("logs-get"), "arr");
            } catch (e) { logs = []; }
        }
        this.#serverLogs.clear();
        logs.map(log => this.#serverLogs.add(String(log)));
    }
    async pollClient() {
        let logs = util.ensure(await window.api.get("logs"), "arr");
        this.#clientLogs = {};
        logs.map(log => {
            log = util.ensure(log, "obj");
            let name = String(log.name), path = String(log.path);
            this.#clientLogs[name] = path;
        });
    }
}

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
        this.eTab.addEventListener("mousedown", e => {
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
        });
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
        let toolItems = [
            {
                id: "graph", name: "Graph",
                tab: Panel.GraphTab,
            },
            {
                id: "table", name: "Table",
                tab: Panel.TableTab,
            },
            {
                id: "odometry2d", name: "Odometry2d",
                tab: Panel.Odometry2dTab,
            },
            {
                id: "odometry3d", name: "Odometry3d",
                tab: Panel.Odometry3dTab,
            },
            {
                id: "webview", name: "WebView",
                tab: Panel.WebViewTab,
            },
            {
                id: "logger", name: "Logger",
                tab: Panel.LoggerTab,
                disabled: window.agent().distro,
            },
            {
                id: "logworks", name: "LogWorks",
                tab: Panel.LogWorksTab,
            },
        ];
        toolItems = toolItems.map(data => {
            let display = getTabDisplay(data.id);
            let itm = new Panel.AddTab.Button(data.name, "", "");
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
            toolItems = util.search(toolItems, ["name"], this.query).map(toolItemSelect);
            if (this.query.length > 0) {
                let nodeItems = [];
                if (this.hasPage() && this.page.hasSource()) {
                    let node = this.page.source.tree;
                    const dfs = node => {
                        let itm = new Panel.AddTab.NodeButton(node);
                        nodeItems.push({
                            item: itm,
                            trigger: () => {
                                if (!this.hasParent()) return;
                                let index = this.parent.tabs.indexOf(this);
                                this.parent.addTab(new Panel.BrowserTab(node.path), index);
                                this.parent.remTab(this);
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
                    item.item.addHandler("drag", item.drag);
                    return item.item;
                });
                nodeItems = util.search(nodeItems, ["node.path", "node.field.type"], this.query).map(nodeItemSelect);
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
            toolItems = util.search(toolItems, ["name"], this.query).map(toolItemSelect);
            this.items = toolItems;
        } else if (["tables", "topics", "all"].includes(this.searchPart)) {
            this.tags = [new Panel.AddTab.Tag(
                util.capitalize(this.searchPart),
                { tables: "folder-outline", topics: "document-outline", all: "" }[this.searchPart],
            )];
            if (this.searchPart == "all") this.tags[0].iconSrc = "../assets/icons/variable.svg";
            this.placeholder = "Search "+this.searchPart.toLowerCase();
            let items = [];
            if (this.hasPage() && this.page.hasSource()) {
                let node = this.page.source.tree;
                const dfs = node => {
                    let itm = new Panel.AddTab.NodeButton(node);
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
                item.item.addHandler("drag", item.drag);
                return item.item;
            });
            items = util.search(items, ["node.path", "node.field.type"], this.query).map(nodeItemSelect);
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

        this.#explorer = new core.Explorer();
        this.explorer.addHandler("trigger2", (e, path) => (this.path += "/"+path));
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
                core.Explorer.Node.doubleTraverse(
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
const LOGGERCONTEXT = new LoggerContext();
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
            let result = await this.app.fileOpenDialog({
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
            await LOGGERCONTEXT.logsUpload(result.filePaths);
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
                    this.app.error("Log Download Error", name, e);
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
                LOGGERCONTEXT.logsUpload(names.filter(name => LOGGERCONTEXT.hasClientLog(name)).map(name => LOGGERCONTEXT.getClientPath(name)));
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
                    this.app.error("Log Delete Error", names.join(", "), e);
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

        let distro = null;

        this.addHandler("update", delta => {
            if (this.isClosed) return;

            if (distro != window.agent().distro) {
                distro = window.agent().distro;
                if (distro) {
                    this.elem.style.opacity = "50%";
                    this.elem.style.pointerEvents = "none";
                } else {
                    this.elem.style.opacity = "";
                    this.elem.style.pointerEvents = "";
                }
            }

            this.eUploadBtn.disabled = LOGGERCONTEXT.disconnected;

            this.status = LOGGERCONTEXT.initializing ? "Initializing client" : LOGGERCONTEXT.disconnected ? ("Connecting - "+LOGGERCONTEXT.location) : LOGGERCONTEXT.location;
            if (LOGGERCONTEXT.connected) {
                eIcon.name = "cloud";
                this.eStatus.setAttribute("href", LOGGERCONTEXT.location);
            } else {
                eIcon.name = "cloud-offline";
                this.eStatus.removeAttribute("href");
            }
            this.loading = LOGGERCONTEXT.isLoading("§uploading");

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

        this.addAction(new Panel.LogWorksTab.Action(this, "edit"));
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
            edit: () => {
                this.displayName = this.title = "Edit Logs";
                this.icon = "pencil";

                const explorer = new core.Explorer();
                this.eContent.appendChild(explorer.elem);
                explorer.elem.addEventListener("scroll", () => (state.eEditor.scrollTop = explorer.elem.scrollTop));

                state.eEditor = document.createElement("div");
                this.eContent.appendChild(state.eEditor);
                state.eEditor.classList.add("editor");
                state.eEditor.addEventListener("scroll", () => (explorer.elem.scrollTop = state.eEditor.scrollTop));

                let editors = [];

                this.addHandler("update", delta => {
                    core.Explorer.Node.doubleTraverse(
                        this.page.hasSource() ? this.page.source.tree.nodeObjects : [],
                        explorer.nodeObjects,
                        (...enodes) => explorer.add(...enodes),
                        (...enodes) => explorer.rem(...enodes),
                        (node, enode) => {
                            enode.canShowValue = false;
                            enode.node = node;
                        },
                    );
                    let nodes = [];
                    const dfs = explorer => {
                        explorer.nodeObjects.forEach(enode => {
                            nodes.push(enode.node);
                            if (enode.node.hasField() && enode.node.field.isStruct)
                                enode.isClosed = true;
                            if (enode.isClosed) return;
                            dfs(enode.explorer);
                        });
                    };
                    dfs(explorer);
                    while (editors.length < nodes.length) {
                        let editor = {};
                        editors.push(editor);
                        let elem = editor.elem = document.createElement("div");
                        state.eEditor.appendChild(elem);
                        elem.classList.add("item");
                        editor.node = null;
                    }
                    while (editors.length > nodes.length) {
                        let editor = editors.pop();
                        state.eEditor.removeChild(editor.elem);
                    }
                    for (let i = 0; i < nodes.length; i++) {
                        let editor = editors[i];
                        let node = editor.node = nodes[i];
                        if (!node.hasField() || node.field.isStruct || node.field.isArray || node.field.type == "structschema") {
                            editor.elem.classList.remove("open");
                            continue;
                        }
                        editor.elem.classList.add("open");
                    }
                });
            },
            merge: () => {
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
                state.eConflict.classList.add("conflict");
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
                state.eLogsDragBox = document.createElement("div");
                state.eLogs.appendChild(state.eLogsDragBox);
                state.eLogsDragBox.classList.add("dragbox");
                state.eLogsDragBox.innerHTML = "<div></div><div></div>";
                ["dragenter", "dragover"].forEach(name => state.eLogs.addEventListener(name, e => {
                    e.preventDefault();
                    e.stopPropagation();
                    state.eLogsDragBox.classList.add("this");
                }));
                ["dragleave", "drop"].forEach(name => state.eLogs.addEventListener(name, e => {
                    e.preventDefault();
                    e.stopPropagation();
                    state.eLogsDragBox.classList.remove("this");
                }));
                state.eLogs.addEventListener("drop", e => {
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
                    state.eSubmit.disabled = true;
                    const progress = v => (this.app.progress = v);
                    try {
                        progress(0);
                        const sum = [];
                        const updateSum = () => progress(util.lerp(0, 1/3, sum.sum()/sum.length));
                        const sources = (await Promise.all(state.logs.map(async (log, i) => {
                            sum.push(0);
                            let source = null;
                            try {
                                source = new WPILOGSource();
                                source.data = await window.api.send("wpilog-read", log);
                                const progress = v => {
                                    sum[i] = v;
                                    updateSum();
                                };
                                source.addHandler("progress", progress);
                                await source.build();
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
                        const source = new WPILOGSource();
                        source.fromSerialized(sourceData);
                        progress(null);
                        const result = util.ensure(await this.app.fileSaveDialog({
                            title: "Save log to...",
                            buttonLabel: "Save",
                        }), "obj");
                        if (!result.canceled && result.filePath) {
                            let pth = String(result.filePath);
                            if (!pth.endsWith(".wpilog")) pth += ".wpilog";
                            source.addHandler("progress", progress);
                            let data = await source.export(state.ePrefixInput.value);
                            source.remHandler("progress", progress);
                            await window.api.send("wpilog-write", pth, data);
                        }
                    } catch (e) {
                        this.app.error("Log Merge Error", e);
                    }
                    progress(null);
                    state.eSubmit.disabled = false;
                });

                state.refresh = () => {
                    Array.from(state.eLogs.querySelectorAll(":scope > div:not(.dragbox)")).forEach(elem => elem.remove());
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
                this.displayName = this.title = "Export Logs";
                this.iconSrc = "../assets/icons/swap.svg";
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
            elem.innerHTML = "<div class='header'>"+{ l: "Left Axis", v: "View Window", r: "Right Axis" }[id]+"</div>";
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
                    let eNav = document.createElement("div");
                    elem.appendChild(eNav);
                    eNav.classList.add("nav");
                    const viewModes = ["left", "right", "section", "all"];
                    let eNavButtons = {};
                    let eForModes = {};
                    viewModes.forEach(mode => {
                        let btn = document.createElement("button");
                        eNav.appendChild(btn);
                        eNavButtons[mode] = btn;
                        btn.textContent = util.capitalize(mode);
                        btn.addEventListener("click", e => {
                            e.stopPropagation();
                            this.viewMode = mode;
                        });
                        let elems = eForModes[mode] = [];
                        let modefs = {
                            left: () => {
                                let info = document.createElement("div");
                                elem.appendChild(info);
                                elems.push(info);
                                info.classList.add("info");
                                info.innerHTML = "<span>Forwards View Time</span><span class='units'>ms</span>";
                                let input = document.createElement("input");
                                elem.appendChild(input);
                                elems.push(input);
                                input.type = "number";
                                input.placeholder = "...";
                                input.min = 0;
                                input.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(input.value), "num"));
                                    this.change("viewParams.time", this.viewParams.time, this.viewParams.time=v);
                                });
                                this.addHandler("change-viewParams.time", () => (input.value = this.viewParams.time));
                                this.change("viewParams.time", null, this.viewParams.time=5000);
                            },
                            right: () => {
                                let info = document.createElement("div");
                                elem.appendChild(info);
                                elems.push(info);
                                info.classList.add("info");
                                info.innerHTML = "<span>Backwards View Time</span><span class='units'>ms</span>";
                                let input = document.createElement("input");
                                elem.appendChild(input);
                                elems.push(input);
                                input.type = "number";
                                input.placeholder = "...";
                                input.min = 0;
                                input.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(input.value), "num"));
                                    this.change("viewParams.time", this.viewParams.time, this.viewParams.time=v);
                                });
                                this.addHandler("change-viewParams.time", () => (input.value = this.viewParams.time));
                                this.change("viewParams.time", null, this.viewParams.time=5000);
                            },
                            section: () => {
                                let info, input;
                                info = document.createElement("div");
                                elem.appendChild(info);
                                elems.push(info);
                                info.classList.add("info");
                                info.innerHTML = "<span>Range Start</span><span class='units'>ms</span>";
                                let startInput = input = document.createElement("input");
                                elem.appendChild(input);
                                elems.push(input);
                                input.type = "number";
                                input.placeholder = "Start";
                                input.min = 0;
                                info = document.createElement("div");
                                elem.appendChild(info);
                                elems.push(info);
                                info.classList.add("info");
                                info.innerHTML = "<span>Range Stop</span><span class='units'>ms</span>";
                                let stopInput = input = document.createElement("input");
                                elem.appendChild(input);
                                elems.push(input);
                                input.type = "number";
                                input.placeholder = "Stop";
                                input.min = 0;
                                startInput.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(startInput.value), "num"));
                                    this.change("viewParams.start", this.viewParams.start, this.viewParams.start=v);
                                });
                                stopInput.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(stopInput.value), "num"));
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
                        for (let mode in eNavButtons) {
                            if (mode == this.viewMode) eNavButtons[mode].classList.add("this");
                            else eNavButtons[mode].classList.remove("this");
                            eForModes[mode].forEach(elem => {
                                elem.style.display = (mode == this.viewMode) ? "" : "none";
                            });
                        }
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
                    if (!v.isShown) return;
                    let node = source.tree.lookup(v.path);
                    if (!node) return v.disable();
                    if (!node.hasField()) return v.disable();
                    if (!node.field.isJustPrimitive) return v.disable();
                    let log = node.field.getRange(...graphRange);
                    if (!util.is(log, "arr")) return v.disable();
                    let start = node.field.get(graphRange[0]), stop = node.field.get(graphRange[1]);
                    if (start != null) log.unshift({ ts: graphRange[0], v: start });
                    if (stop != null) log.push({ ts: graphRange[1], v: stop });
                    if (log.length <= 0) return v.disable();
                    logs[v.path] = log;
                    nodes[v.path] = node;
                    if (!["double", "float", "int"].includes(node.field.type)) return v.disable();
                    v.enable();
                    let subrange = [Math.min(...log.map(p => p.v)), Math.max(...log.map(p => p.v))];
                    if (range[0] == null || range[1] == null) return range = subrange;
                    range[0] = Math.min(range[0], subrange[0]);
                    range[1] = Math.max(range[1], subrange[1]);
                });
                range = range.map(v => util.ensure(v, "num"));
                let step = Panel.GraphTab.findStep(range[1]-range[0], 5);
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
            const timeStep = Panel.GraphTab.findStep(graphRange[1]-graphRange[0], 10);
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

    static findStep(v, nSteps) {
        v = Math.max(0, util.ensure(v, "num"));
        if (v <= 0) return 1;
        let factors = [1, 2, 5];
        let pow = Math.round(Math.log10(v));
        let closestN = null, closestStep = null;
        factors.forEach(f => {
            let step = (10 ** (pow-1)) * f;
            let d = Math.abs(nSteps - Math.round(v / step));
            if (closestN == null || d < closestN) {
                closestN = d;
                closestStep = step;
            }
            if (d > closestN) return;
            if (step < closestStep) closestStep = step;
        });
        return closestStep;
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
        return this.#lVars.has(lVar);
    }
    addLVar(...lVars) {
        return util.Target.resultingForEach(lVars, lVar => {
            if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
            if (this.hasLVar(lVar)) return false;
            this.#lVars.add(lVar);
            lVar.addLinkedHandler(this, "remove", () => this.remLVar(lVar));
            lVar.addLinkedHandler(this, "change", (c, f, t) => this.change("lVars["+this.lVars.indexOf(lVar)+"]."+c, f, t));
            if (this.hasEOptionSection("l"))
                this.getEOptionSection("l").appendChild(lVar.elem);
            this.change("addLVar", null, lVar);
            lVar.onAdd();
            return lVar;
        });
    }
    remLVar(...lVars) {
        return util.Target.resultingForEach(lVars, lVar => {
            if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
            if (!this.hasLVar(lVar)) return false;
            lVar.onRem();
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
        return this.#rVars.has(rVar);
    }
    addRVar(...rVars) {
        return util.Target.resultingForEach(rVars, rVar => {
            if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
            if (this.hasRVar(rVar)) return false;
            this.#rVars.add(rVar);
            rVar.addLinkedHandler(this, "remove", () => this.remRVar(rVar));
            rVar.addLinkedHandler(this, "change", (c, f, t) => this.change("rVars["+this.rVars.indexOf(rVar)+"]."+c, f, t));
            if (this.hasEOptionSection("r"))
                this.getEOptionSection("r").appendChild(rVar.elem);
            this.change("addRVar", null, rVar);
            rVar.onAdd();
            return rVar;
        });
    }
    remRVar(...rVars) {
        return util.Target.resultingForEach(rVars, rVar => {
            if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
            if (!this.hasRVar(rVar)) return false;
            rVar.onRem();
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
        for (let k in v) this.#viewParams[k] = v[k];
        this.change("viewParams", null, this.viewParams);
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
                _: side => {
                    if (!(data instanceof Source.Node)) return null;
                    if (!data.hasField()) return null;
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
                                    let has = false;
                                    this[side+"Vars"].forEach(v => (v.path == pth) ? (has = true) : null);
                                    if (has) return;
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
    #path;
    #color;

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
        this.#color = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eShowBox = document.createElement("label");
        this.eDisplay.appendChild(this.eShowBox);
        this.eShowBox.classList.add("checkbox");
        this.eShowBox.innerHTML = "<input type='checkbox'><span><ion-icon name='eye'></ion-icon></span>";
        this.#eShow = this.eShowBox.children[0];
        this.#eShowDisplay = this.eShowBox.children[1];
        this.#eDisplayName = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayName);
        this.#eRemoveBtn = document.createElement("button");
        this.eDisplay.appendChild(this.eRemoveBtn);
        this.eRemoveBtn.classList.add("icon");
        this.eRemoveBtn.innerHTML = "<ion-icon name='trash'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eColorPicker = document.createElement("div");
        this.eContent.appendChild(this.eColorPicker);
        this.eColorPicker.classList.add("colorpicker");
        this.#eColorPickerColors = [];
        [
            { _: "cr", h: "cr5", d: "cr3" },
            { _: "co", h: "co5", d: "co3" },
            { _: "cy", h: "cy5", d: "cy3" },
            { _: "cg", h: "cg5", d: "cg3" },
            { _: "cc", h: "cc5", d: "cc3" },
            { _: "cb", h: "cb5", d: "cb3" },
            { _: "cp", h: "cp5", d: "cp3" },
            { _: "cm", h: "cm5", d: "cm3" },
        ].forEach(colors => {
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

        this.eShowBox.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.eShow.addEventListener("change", e => {
            this.change("isShown", null, this.isShown);
        });
        this.eRemoveBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove");
        });
        this.eDisplay.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.GraphTab.Variable) a = [a.path, a.color, a.isShown];
            else if (util.is(a, "arr")) {
                a = new Panel.GraphTab.Variable(...a);
                a = [a.path, a.color, a.isShown];
            }
            else if (util.is(a, "obj")) a = [a.path, a.color, a.isShown];
            else a = [[], null];
        }
        if (a.length == 2) a = [...a, true];

        [this.path, this.color, this.isShown] = a;
    }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.eDisplayName.textContent = this.path;
    }
    get color() { return this.#color; }
    set color(v) {
        v = (v == null) ? null : String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
        let color = this.hasColor() ? this.color.startsWith("--") ? core.PROPERTYCACHE.get(this.color) : this.color : "#fff";
        this.eShowDisplay.style.setProperty("--bgc", color);
        this.eShowDisplay.style.setProperty("--bgch", color);
        this.eDisplayName.style.color = color;
        this.eColorPickerColors.forEach(btn => {
            if (btn.color == this.color) btn.classList.add("this");
            else btn.classList.remove("this");
        });
    }
    hasColor() { return this.color != null; }

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

    get isShown() { return this.eShow.checked; }
    set isShown(v) {
        v = !!v;
        this.change("isShown", this.isShown, this.eShow.checked=v);
    }
    get isHidden() { return !this.isShown; }
    set isHidden(v) { this.isShown = !v; }
    show() { return this.isShown = true; }
    hide() { return this.isHidden = true; }

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
            color: this.color,
            isShown: this.isShown,
        });
    }
};
Panel.OdometryTab = class PanelOdometryTab extends Panel.ToolCanvasTab {
    #poses;

    #template;

    #eTemplateSelect;

    static PATTERNS = {};

    constructor(tail="") {
        super("Odometry"+tail, "odometry"+String(tail).toLowerCase());

        this.elem.classList.add("odometry");

        this.#poses = new Set();

        this.#template = 0;

        let templates = {};
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
            if (this.template != "§null") return;
            this.template = await window.api.get("active-template");
        })();

        ["p", "f", "o"].forEach(id => {
            const elem = document.createElement("div");
            elem.id = id;
            this.addEOptionSection(elem);
            elem.classList.add("section");
            elem.innerHTML = "<div class='header'>"+{ p: "Poses", f: "Field", o: "Options" }[id]+"</div>";
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
                    let info = document.createElement("div");
                    elem.appendChild(info);
                    info.classList.add("info");
                    info.innerHTML = "<span>Template</span>";
                    this.#eTemplateSelect = document.createElement("button");
                    elem.appendChild(this.eTemplateSelect);
                    this.eTemplateSelect.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
                    this.eTemplateSelect.addEventListener("click", e => {
                        e.stopPropagation();
                        if (!this.hasApp()) return;
                        let itm;
                        let menu = new core.App.Menu();
                        itm = menu.addItem(new core.App.Menu.Item("No Template", (this.template == null) ? "checkmark" : ""));
                        itm.addHandler("trigger", e => {
                            this.template = null;
                        });
                        menu.addItem(new core.App.Menu.Divider());
                        for (let name in templates) {
                            itm = menu.addItem(new core.App.Menu.Item(name, (this.template == name) ? "checkmark" : ""));
                            itm.addHandler("trigger", e => {
                                this.template = name;
                            });
                        }
                        this.app.contextMenu = menu;
                        let r = this.eTemplateSelect.getBoundingClientRect();
                        this.app.placeContextMenu(r.left, r.bottom);
                        menu.elem.style.minWidth = r.width+"px";
                    });
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
        v = (v == null) ? null : String(v);
        if (this.template == v) return;
        this.change("template", this.template, this.#template=v);
        if (this.eTemplateSelect.children[0] instanceof HTMLDivElement)
            this.eTemplateSelect.children[0].textContent = (this.template == null) ? "No Template" : this.template;
    }

    getValue(node) {
        if (!(node instanceof Source.Node)) return null;
        if (!node.hasField()) return null;
        if (node.field.isStruct && (node.field.structType in this.constructor.PATTERNS)) {
            let paths = util.ensure(this.constructor.PATTERNS[node.field.structType], "arr").map(path => util.ensure(path, "arr").map(v => String(v)));
            let value = paths.map(path => {
                let subnode = node.lookup(path.join("/"));
                if (!(subnode instanceof Source.Node)) return null;
                if (!subnode.hasField()) return null;
                return subnode.field.get();
            });
            return value.filter(v => util.is(v, "num"));
        }
        return node.field.get();
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
                                let has = false;
                                this.poses.forEach(v => v.path == pth ? (has = true) : null);
                                if (has) return;
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

    get eTemplateSelect() { return this.#eTemplateSelect; }
};
Panel.OdometryTab.Pose = class PanelOdometryTabPose extends util.Target {
    #path;
    #color;

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
        this.#color = null;

        this.#state = new this.constructor.State();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eShowBox = document.createElement("label");
        this.eDisplay.appendChild(this.eShowBox);
        this.eShowBox.classList.add("checkbox");
        this.eShowBox.innerHTML = "<input type='checkbox'><span><ion-icon name='eye'></ion-icon></span>";
        this.#eShow = this.eShowBox.children[0];
        this.#eShowDisplay = this.eShowBox.children[1];
        this.#eDisplayName = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayName);
        this.#eRemoveBtn = document.createElement("button");
        this.eDisplay.appendChild(this.eRemoveBtn);
        this.eRemoveBtn.classList.add("icon");
        this.eRemoveBtn.innerHTML = "<ion-icon name='trash'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eColorPicker = document.createElement("div");
        this.eContent.appendChild(this.eColorPicker);
        this.eColorPicker.classList.add("colorpicker");
        this.#eColorPickerColors = [];
        [
            { _: "cr", h: "cr5", d: "cr3" },
            { _: "co", h: "co5", d: "co3" },
            { _: "cy", h: "cy5", d: "cy3" },
            { _: "cg", h: "cg5", d: "cg3" },
            { _: "cc", h: "cc5", d: "cc3" },
            { _: "cb", h: "cb5", d: "cb3" },
            { _: "cp", h: "cp5", d: "cp3" },
            { _: "cm", h: "cm5", d: "cm3" },
        ].forEach(colors => {
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

        this.eShowBox.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.eShow.addEventListener("change", e => {
            this.change("isShown", null, this.isShown);
        });
        this.eRemoveBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove");
        });
        this.eDisplay.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof this.constructor) a = [a.path, a.color, a.isShown];
            else if (util.is(a, "arr")) {
                a = new this.constructor(...a);
                a = [a.path, a.color, a.isShown];
            }
            else if (util.is(a, "obj")) a = [a.path, a.color, a.isShown];
            else a = [[], null];
        }
        if (a.length == 2) a = [...a, true];

        [this.path, this.color, this.isShown] = a;
    }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.eDisplayName.textContent = this.path;
    }
    get color() { return this.#color; }
    set color(v) {
        v = (v == null) ? null : String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
        let color = this.hasColor() ? this.color.startsWith("--") ? core.PROPERTYCACHE.get(this.color) : this.color : "#fff";
        this.eShowDisplay.style.setProperty("--bgc", color);
        this.eShowDisplay.style.setProperty("--bgch", color);
        this.eDisplayName.style.color = color;
        this.eColorPickerColors.forEach(btn => {
            if (btn.color == this.color) btn.classList.add("this");
            else btn.classList.remove("this");
        });
    }
    hasColor() { return this.color != null; }

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

    get isShown() { return this.eShow.checked; }
    set isShown(v) {
        v = !!v;
        this.change("isShown", this.isShown, this.eShow.checked=v);
    }
    get isHidden() { return !this.isShown; }
    set isHidden(v) { this.isShown = !v; }
    show() { return this.isShown = true; }
    hide() { return this.isHidden = true; }

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
            color: this.color,
            isShown: this.isShown,
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

    #isMeters;
    #isDegrees;
    #origin;

    #eSizeWInput;
    #eSizeHInput;
    #eRobotSizeWInput;
    #eRobotSizeHInput;
    #eUnitsMeters;
    #eUnitsCentimeters;
    #eUnitsDegrees;
    #eUnitsRadians;
    #eOriginBluePos;
    #eOriginBlueNeg;
    #eOriginRedPos;
    #eOriginRedNeg;

    static PATTERNS = {
        "Pose2d": [
            ["translation", "x"],
            ["translation", "y"],
            ["rotation", "value"],
        ],
    };

    constructor(...a) {
        super("2d");

        this.#odometry = new core.Odometry2d(this.canvas);

        this.#size = new V(1000);
        this.#robotSize = new V(100);

        this.size.addHandler("change", (c, f, t) => this.change("size."+c, f, t));
        this.robotSize.addHandler("change", (c, f, t) => this.change("robotSize."+c, f, t));

        this.#isMeters = null;
        this.#isDegrees = null;
        this.#origin = null;

        let info;
        const eField = this.getEOptionSection("f");
        let infoUnits = [];
        info = document.createElement("div");
        eField.appendChild(info);
        info.classList.add("info");
        info.classList.add("nothas");
        info.innerHTML = "<span>Map Size</span><span class='units'>m</span>";
        infoUnits.push(info.children[1]);
        let eSize = document.createElement("div");
        eField.appendChild(eSize);
        eSize.classList.add("v");
        eSize.classList.add("nothas");
        this.#eSizeWInput = document.createElement("input");
        eSize.appendChild(this.eSizeWInput);
        this.eSizeWInput.type = "number";
        this.eSizeWInput.placeholder = "Width";
        this.eSizeWInput.min = 0;
        this.eSizeWInput.step = 0.1;
        this.eSizeWInput.addEventListener("change", e => {
            let v = this.eSizeWInput.value;
            if (v.length > 0) {
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                this.w = v*(this.isMeters ? 100 : 1);
            }
        });
        this.#eSizeHInput = document.createElement("input");
        eSize.appendChild(this.eSizeHInput);
        this.eSizeHInput.type = "number";
        this.eSizeHInput.placeholder = "Height";
        this.eSizeHInput.min = 0;
        this.eSizeHInput.step = 0.1;
        this.eSizeHInput.addEventListener("change", e => {
            let v = this.eSizeHInput.value;
            if (v.length > 0) {
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                this.h = v*(this.isMeters ? 100 : 1);
            }
        });
        info = document.createElement("div");
        eField.appendChild(info);
        info.classList.add("info");
        info.classList.add("nothas");
        info.innerHTML = "<span>Robot Size</span><span class='units'>m</span>";
        infoUnits.push(info.children[1]);
        let eRobotSize = document.createElement("div");
        eField.appendChild(eRobotSize);
        eRobotSize.classList.add("v");
        eRobotSize.classList.add("nothas");
        this.#eRobotSizeWInput = document.createElement("input");
        eRobotSize.appendChild(this.eRobotSizeWInput);
        this.eRobotSizeWInput.type = "number";
        this.eRobotSizeWInput.placeholder = "Width";
        this.eRobotSizeWInput.min = 0;
        this.eRobotSizeWInput.step = 0.1;
        this.eRobotSizeWInput.addEventListener("change", e => {
            let v = this.eRobotSizeWInput.value;
            if (v.length > 0) {
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                this.robotW = v*(this.isMeters ? 100 : 1);
            }
        });
        this.#eRobotSizeHInput = document.createElement("input");
        eRobotSize.appendChild(this.eRobotSizeHInput);
        this.eRobotSizeHInput.type = "number";
        this.eRobotSizeHInput.placeholder = "Height";
        this.eRobotSizeHInput.min = 0;
        this.eRobotSizeHInput.step = 0.1;
        this.eRobotSizeHInput.addEventListener("change", e => {
            let v = this.eRobotSizeHInput.value;
            if (v.length > 0) {
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                this.robotH = v*(this.isMeters ? 100 : 1);
            }
        });

        let eNav, header;
        const eOptions = this.getEOptionSection("o");

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eUnitsMeters = document.createElement("button");
        eNav.appendChild(this.eUnitsMeters);
        this.eUnitsMeters.textContent = "Meters";
        this.eUnitsMeters.addEventListener("click", e => {
            e.stopPropagation();
            this.isMeters = true;
        });
        this.#eUnitsCentimeters = document.createElement("button");
        eNav.appendChild(this.eUnitsCentimeters);
        this.eUnitsCentimeters.textContent = "Centimeters";
        this.eUnitsCentimeters.addEventListener("click", e => {
            e.stopPropagation();
            this.isCentimeters = true;
        });

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eUnitsDegrees = document.createElement("button");
        eNav.appendChild(this.eUnitsDegrees);
        this.eUnitsDegrees.textContent = "Degrees";
        this.eUnitsDegrees.addEventListener("click", e => {
            e.stopPropagation();
            this.isDegrees = true;
        });
        this.#eUnitsRadians = document.createElement("button");
        eNav.appendChild(this.eUnitsRadians);
        this.eUnitsRadians.textContent = "Radians";
        this.eUnitsRadians.addEventListener("click", e => {
            e.stopPropagation();
            this.isRadians = true;
        });

        header = document.createElement("div");
        eOptions.appendChild(header);
        header.classList.add("header");
        header.textContent = "Origin";

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eOriginBluePos = document.createElement("button");
        eNav.appendChild(this.eOriginBluePos);
        this.eOriginBluePos.textContent = "+Blue";
        this.eOriginBluePos.addEventListener("click", e => {
            e.stopPropagation();
            this.origin = "blue+";
        });
        this.#eOriginBlueNeg = document.createElement("button");
        eNav.appendChild(this.eOriginBlueNeg);
        this.eOriginBlueNeg.textContent = "-Blue";
        this.eOriginBlueNeg.addEventListener("click", e => {
            e.stopPropagation();
            this.origin = "blue-";
        });
        this.eOriginBluePos.style.color = this.eOriginBlueNeg.style.color = "var(--cb)";

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eOriginRedPos = document.createElement("button");
        eNav.appendChild(this.eOriginRedPos);
        this.eOriginRedPos.textContent = "+Red";
        this.eOriginRedPos.addEventListener("click", e => {
            e.stopPropagation();
            this.origin = "red+";
        });
        this.#eOriginRedNeg = document.createElement("button");
        eNav.appendChild(this.eOriginRedNeg);
        this.eOriginRedNeg.textContent = "-Red";
        this.eOriginRedNeg.addEventListener("click", e => {
            e.stopPropagation();
            this.origin = "red-";
        });
        this.eOriginRedPos.style.color = this.eOriginRedNeg.style.color = "var(--cr)";

        this.quality = this.odometry.quality;

        if (a.length <= 0 || [6, 7].includes(a.length) || a.length > 8) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.Odometry2dTab) a = [a.poses, a.template, a.size, a.robotSize, a.isMeters, a.isDegrees, a.origin, a.optionState];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof this.constructor.Pose) a = [a, null];
                else {
                    a = new Panel.Odometry2dTab(...a);
                    a = [a.poses, a.template, a.size, a.robotSize, a.isMeters, a.isDegrees, a.origin, a.optionState];
                }
            }
            else if (util.is(a, "obj")) a = [a.poses, a.template, a.size, a.robotSize, a.isMeters, a.isDegrees, a.origin, a.optionState];
            else a = [[], "§null"];
        }
        if (a.length == 2) a = [...a, 1000];
        if (a.length == 3) a = [...a, 100];
        if (a.length == 4) a = [...a, 0.5];
        if (a.length == 5) a = [...a.slice(0, 4), true, true, "blue+", a[4]];

        [this.poses, this.template, this.size, this.robotSize, this.isMeters, this.isDegrees, this.origin, this.optionState] = a;

        let templates = {};
        let templateImages = {};
        let finished = false;
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
            templateImages = util.ensure(await window.api.get("template-images"), "obj");
            finished = true;
        })();

        const updateSize = () => {
            this.eSizeWInput.value = this.w/(this.isMeters ? 100 : 1);
            this.eSizeHInput.value = this.h/(this.isMeters ? 100 : 1);
            this.eRobotSizeWInput.value = this.robotW/(this.isMeters ? 100 : 1);
            this.eRobotSizeHInput.value = this.robotH/(this.isMeters ? 100 : 1);
            infoUnits.forEach(elem => (elem.textContent = (this.isMeters ? "m" : "cm")));
        };
        this.addHandler("change-size.x", updateSize);
        this.addHandler("change-size.y", updateSize);
        this.addHandler("change-robotSize.x", updateSize);
        this.addHandler("change-robotSize.y", updateSize);
        this.addHandler("change-isMeters", updateSize);

        this.addHandler("update", delta => {
            if (this.isClosed) return;

            if (this.template in templates) eField.classList.add("has");
            else eField.classList.remove("has");

            if (!finished) return;

            this.odometry.size = (this.template in templates) ? util.ensure(templates[this.template], "obj").size : this.size;
            this.odometry.imageSrc = (this.template in templateImages) ? templateImages[this.template] : null;

            if (this.isClosed) return;
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            this.poses.forEach(pose => {
                pose.state.pose = pose.isShown ? pose : null;
                const node = source ? source.tree.lookup(pose.path) : null;
                pose.state.value = this.getValue(node);
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
                    let name = String(k).split(" ").map(v => util.capitalize(v)).join(" ");
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

    get isMeters() { return this.#isMeters; }
    set isMeters(v) {
        v = !!v;
        if (this.isMeters == v) return;
        this.change("isMeters", this.isMeters, this.#isMeters=v);

        if (this.isMeters) this.eUnitsMeters.classList.add("this");
        else this.eUnitsMeters.classList.remove("this");
        if (this.isCentimeters) this.eUnitsCentimeters.classList.add("this");
        else this.eUnitsCentimeters.classList.remove("this");
    }
    get isCentimeters() { return !this.isMeters; }
    set isCentimeters(v) { this.isMeters = !v; }
    get isDegrees() { return this.#isDegrees; }
    set isDegrees(v) {
        v = !!v;
        if (this.isDegrees == v) return;
        this.change("isDegrees", this.isDegrees, this.#isDegrees=v);

        if (this.isDegrees) this.eUnitsDegrees.classList.add("this");
        else this.eUnitsDegrees.classList.remove("this");
        if (this.isRadians) this.eUnitsRadians.classList.add("this");
        else this.eUnitsRadians.classList.remove("this");
    }
    get isRadians() { return !this.isDegrees; }
    set isRadians(v) { this.isDegrees = !v; }
    get origin() { return this.#origin; }
    set origin(v) {
        v = String(v);
        if (!["blue+", "blue-", "red+", "red-"].includes(v)) v = "blue+";
        if (this.origin == v) return;
        this.change("origin", this.origin, this.#origin=v);

        if (this.origin == "blue+") this.eOriginBluePos.classList.add("this");
        else this.eOriginBluePos.classList.remove("this");
        if (this.origin == "blue-") this.eOriginBlueNeg.classList.add("this");
        else this.eOriginBlueNeg.classList.remove("this");
        if (this.origin == "red+") this.eOriginRedPos.classList.add("this");
        else this.eOriginRedPos.classList.remove("this");
        if (this.origin == "red-") this.eOriginRedNeg.classList.add("this");
        else this.eOriginRedNeg.classList.remove("this");
    }

    get eSizeWInput() { return this.#eSizeWInput; }
    get eSizeHInput() { return this.#eSizeHInput; }
    get eRobotSizeWInput() { return this.#eRobotSizeWInput; }
    get eRobotSizeHInput() { return this.#eRobotSizeHInput; }
    get eUnitsMeters() { return this.#eUnitsMeters; }
    get eUnitsCentimeters() { return this.#eUnitsCentimeters; }
    get eUnitsDegrees() { return this.#eUnitsDegrees; }
    get eUnitsRadians() { return this.#eUnitsRadians; }
    get eOriginBluePos() { return this.#eOriginBluePos; }
    get eOriginBlueNeg() { return this.#eOriginBlueNeg; }
    get eOriginRedPos() { return this.#eOriginRedPos; }
    get eOriginRedNeg() { return this.#eOriginRedNeg; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            poses: this.poses,
            template: this.template,
            size: this.size,
            robotSize: this.robotSize,
            isMeters: this.isMeters,
            isDegrees: this.isDegrees,
            origin: this.origin,
            optionState: this.optionState,
        });
    }
};
Panel.Odometry2dTab.Pose = class PanelOdometry2dTabPose extends Panel.OdometryTab.Pose {
    #isGhost;
    #type;

    #eGhostBtn;
    #eDisplayType;

    constructor(...a) {
        super();

        this.#isGhost = false;
        this.#type = null;

        this.#eGhostBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eGhostBtn);
        this.eGhostBtn.classList.add("custom");
        this.eGhostBtn.textContent = "Ghost";
        this.eGhostBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.isGhost = !this.isGhost;
        });

        this.#eDisplayType = document.createElement("button");
        this.eContent.appendChild(this.eDisplayType);
        this.eDisplayType.classList.add("display");
        this.eDisplayType.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eDisplayType.addEventListener("click", e => {
            e.stopPropagation();
            this.post("type");
        });

        if (a.length <= 0 || a.length > 5) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof this.constructor) a = [a.path, a.color, a.isShown, a.isGhost, a.type];
            else if (util.is(a, "arr")) {
                if (util.is(a[0], "str")) a = [a, null];
                else {
                    a = new this.constructor(...a);
                    a = [a.path, a.color, a.isShown, a.isGhost, a.type];
                }
            }
            else if (util.is(a, "obj")) a = [a.path, a.color, a.isShown, a.isGhost, a.type];
            else a = [[], null];
        }
        if (a.length == 2) a = [...a, true];
        if (a.length == 3) a = [...a, false];
        if (a.length == 4) a = [...a, core.Odometry2d.Robot.TYPES.DEFAULT];

        [this.path, this.color, this.isShown, this.isGhost, this.type] = a;
    }

    get isGhost() { return this.#isGhost; }
    set isGhost(v) {
        v = !!v;
        if (this.isGhost == v) return;
        this.change("isGhost", this.isGhost, this.#isGhost=v);
        if (this.isGhost) this.eGhostBtn.classList.add("this");
        else this.eGhostBtn.classList.remove("this");
    }
    get type() { return this.#type; }
    set type(v) {
        if (v in core.Odometry2d.Robot.TYPES) v = core.Odometry2d.Robot.TYPES[v];
        if (!Object.values(core.Odometry2d.Robot.TYPES).includes(v)) v = core.Odometry2d.Robot.TYPES.DEFAULT;
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
        if (this.eDisplayType.children[0] instanceof HTMLDivElement)
            this.eDisplayType.children[0].textContent = String(core.Odometry2d.Robot.lookupTypeName(this.type)).split(" ").map(v => util.capitalize(v)).join(" ");
    }

    get eGhostBtn() { return this.#eGhostBtn; }
    get eDisplayType() { return this.#eDisplayType; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            color: this.color,
            isShown: this.isShown,
            isGhost: this.isGhost,
            type: core.Odometry2d.Robot.lookupTypeName(this.type),
        });
    }
};
Panel.Odometry2dTab.Pose.State = class PanelOdometry2dTabPoseState extends Panel.OdometryTab.Pose.State {
    #value;

    #renders;

    constructor() {
        super();

        this.#value = [];

        this.#renders = [];

        let templates = {};
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
        })();

        const convertPos = (...v) => {
            v = new V(...v);
            if (!this.hasTab()) return v;
            if (this.tab.isMeters) v.imul(100);
            if (!this.tab.origin.startsWith("blue")) v.x = this.tab.odometry.w-v.x;
            if (!this.tab.origin.endsWith("+")) v.y = this.tab.odometry.h-v.y;
            return v;
        };
        const convertAngle = v => {
            v = util.clampAngle(v);
            if (!this.hasTab()) return v;
            if (this.tab.isRadians) v *= (180/Math.PI);
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
const preloadedFields = {};
const preloadedRobots = {};
Panel.Odometry3dTab = class PanelOdometry3dTab extends Panel.OdometryTab {
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

    #field;
    #theField;

    #isProjection;
    #isOrbit;
    #isMeters;
    #isDegrees;
    #origin;

    #eViewProjection;
    #eViewIsometric;
    #eViewOrbit;
    #eViewFree;
    #eUnitsMeters;
    #eUnitsCentimeters;
    #eUnitsDegrees;
    #eUnitsRadians;
    #eOriginBluePos;
    #eOriginBlueNeg;
    #eOriginRedPos;
    #eOriginRedNeg;
    #eCameraPosXInput;
    #eCameraPosYInput;
    #eCameraPosZInput;

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

        const eInfo = document.createElement("div");
        this.eContent.appendChild(eInfo);
        eInfo.classList.add("info");
        eInfo.innerHTML = "   [W]\n[A][S][D]\n[ Space ] Up\n[ Shift ] Down\n[  Esc  ] Leave Pointer Lock";

        this.quality = 2;

        this.#scene = new THREE.Scene();
        this.#wpilibGroup = new THREE.Group();
        this.scene.add(this.wpilibGroup);
        this.wpilibGroup.quaternion.copy(WPILIB2THREE);
        this.scene.fog = new THREE.Fog(0x000000, 20, 25);
        this.#camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

        this.#renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true });
        this.#cssRenderer = new CSS2DRenderer();
        this.eContent.appendChild(this.cssRenderer.domElement);
        this.cssRenderer.domElement.classList.add("css");
        
        this.#controls = new OrbitControls(this.camera, this.canvas);

        this.#raycaster = new THREE.Raycaster();
        this.#raycastIntersections = [];

        this.#requestRedraw = true;

        this.canvas.addEventListener("click", e => {
            e.stopPropagation();
            if (this.controls instanceof PointerLockControls)
                this.controls.lock();
        });
        this.canvas.addEventListener("mousemove", e => {
            let r = this.canvas.getBoundingClientRect();
            let x = (e.pageX - r.left) / r.width, y = (e.pageY - r.top) / r.height;
            x = (x*2)-1; y = (y*2)-1;
            if (this.controls instanceof PointerLockControls && this.controls.isLocked) x = y = 0;
            this.raycaster.setFromCamera(new THREE.Vector2(x, -y), this.camera);
            this.#raycastIntersections = this.raycaster.intersectObject(this.scene, true);
        });
        const updateScene = () => {
            let r = this.eContent.getBoundingClientRect();
            this.renderer.setSize(r.width*this.quality, r.height*this.quality);
            this.renderer.domElement.style.transform = "scale("+(1/this.quality)+")";
            this.cssRenderer.setSize(r.width*this.quality, r.height*this.quality);
            this.cssRenderer.domElement.style.transform = "scale("+(1/this.quality)+")";
            this.requestRedraw();
        };
        new ResizeObserver(updateScene).observe(this.eContent);
        this.addHandler("change-quality", updateScene);

        const radius = 0.05;
        const length = 5;
        let axes, xAxis, yAxis, zAxis;

        this.#axisScene = new THREE.Group();
        this.axisScene._builtin = true;
        axes = this.axisScene.axes = new THREE.Group();
        this.axisScene.add(axes);
        xAxis = this.axisScene.xAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        yAxis = this.axisScene.yAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        zAxis = this.axisScene.zAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        this.axisScene.planes = [];

        this.#axisSceneSized = new THREE.Group();
        this.axisSceneSized._builtin = true;
        axes = this.axisSceneSized.axes = new THREE.Group();
        this.axisSceneSized.add(axes);
        xAxis = this.axisSceneSized.xAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        yAxis = this.axisSceneSized.yAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        zAxis = this.axisSceneSized.zAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        this.axisSceneSized.planes = [];

        this.#field = null;
        this.#theField = null;

        const hemLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
        this.scene.add(hemLight);

        const light = new THREE.PointLight(0xffffff, 0.5);
        light.position.set(0, 0, 10);
        this.scene.add(light);

        this.#isProjection = null;
        this.#isOrbit = null;
        this.#isMeters = null;
        this.#isDegrees = null;
        this.#origin = null;

        const eField = this.getEOptionSection("f");
        let eNav, header;
        const eOptions = this.getEOptionSection("o");

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eViewProjection = document.createElement("button");
        eNav.appendChild(this.eViewProjection);
        this.eViewProjection.textContent = "Projection";
        this.eViewProjection.addEventListener("click", e => {
            e.stopPropagation();
            this.isProjection = true;
        });
        this.#eViewIsometric = document.createElement("button");
        eNav.appendChild(this.eViewIsometric);
        this.eViewIsometric.textContent = "Isometric";
        this.eViewIsometric.addEventListener("click", e => {
            e.stopPropagation();
            this.isIsometric = true;
        });

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eViewOrbit = document.createElement("button");
        eNav.appendChild(this.eViewOrbit);
        this.eViewOrbit.textContent = "Orbit";
        this.eViewOrbit.addEventListener("click", e => {
            e.stopPropagation();
            this.isOrbit = true;
        });
        this.#eViewFree = document.createElement("button");
        eNav.appendChild(this.eViewFree);
        this.eViewFree.textContent = "Free";
        this.eViewFree.addEventListener("click", e => {
            e.stopPropagation();
            this.isFree = true;
        });

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eUnitsMeters = document.createElement("button");
        eNav.appendChild(this.eUnitsMeters);
        this.eUnitsMeters.textContent = "Meters";
        this.eUnitsMeters.addEventListener("click", e => {
            e.stopPropagation();
            this.isMeters = true;
        });
        this.#eUnitsCentimeters = document.createElement("button");
        eNav.appendChild(this.eUnitsCentimeters);
        this.eUnitsCentimeters.textContent = "Centimeters";
        this.eUnitsCentimeters.addEventListener("click", e => {
            e.stopPropagation();
            this.isCentimeters = true;
        });

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eUnitsDegrees = document.createElement("button");
        eNav.appendChild(this.eUnitsDegrees);
        this.eUnitsDegrees.textContent = "Degrees";
        this.eUnitsDegrees.addEventListener("click", e => {
            e.stopPropagation();
            this.isDegrees = true;
        });
        this.#eUnitsRadians = document.createElement("button");
        eNav.appendChild(this.eUnitsRadians);
        this.eUnitsRadians.textContent = "Radians";
        this.eUnitsRadians.addEventListener("click", e => {
            e.stopPropagation();
            this.isRadians = true;
        });

        header = document.createElement("div");
        eOptions.appendChild(header);
        header.classList.add("header");
        header.textContent = "Origin";

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eOriginBluePos = document.createElement("button");
        eNav.appendChild(this.eOriginBluePos);
        this.eOriginBluePos.textContent = "+Blue";
        this.eOriginBluePos.addEventListener("click", e => {
            e.stopPropagation();
            this.origin = "blue+";
        });
        this.#eOriginBlueNeg = document.createElement("button");
        eNav.appendChild(this.eOriginBlueNeg);
        this.eOriginBlueNeg.textContent = "-Blue";
        this.eOriginBlueNeg.addEventListener("click", e => {
            e.stopPropagation();
            this.origin = "blue-";
        });
        this.eOriginBluePos.style.color = this.eOriginBlueNeg.style.color = "var(--cb)";

        eNav = document.createElement("div");
        eOptions.appendChild(eNav);
        eNav.classList.add("nav");
        this.#eOriginRedPos = document.createElement("button");
        eNav.appendChild(this.eOriginRedPos);
        this.eOriginRedPos.textContent = "+Red";
        this.eOriginRedPos.addEventListener("click", e => {
            e.stopPropagation();
            this.origin = "red+";
        });
        this.#eOriginRedNeg = document.createElement("button");
        eNav.appendChild(this.eOriginRedNeg);
        this.eOriginRedNeg.textContent = "-Red";
        this.eOriginRedNeg.addEventListener("click", e => {
            e.stopPropagation();
            this.origin = "red-";
        });
        this.eOriginRedPos.style.color = this.eOriginRedNeg.style.color = "var(--cr)";

        header = document.createElement("div");
        eOptions.appendChild(header);
        header.classList.add("header");
        header.textContent = "View";

        let infoUnits = [];
        let info = document.createElement("div");
        eOptions.appendChild(info);
        info.classList.add("info");
        info.classList.add("nothas");
        info.innerHTML = "<span>Camera Position</span><span class='units'>m</span>";
        infoUnits.push(info.children[1]);
        let eCameraPos = document.createElement("div");
        eOptions.appendChild(eCameraPos);
        eCameraPos.classList.add("v");
        eCameraPos.classList.add("nothas");
        this.#eCameraPosXInput = document.createElement("input");
        eCameraPos.appendChild(this.eCameraPosXInput);
        this.eCameraPosXInput.type = "number";
        this.eCameraPosXInput.placeholder = "X";
        this.eCameraPosXInput.step = 0.1;
        this.eCameraPosXInput.addEventListener("change", e => {
            let v = this.eCameraPosXInput.value;
            if (v.length > 0) {
                v = util.ensure(parseFloat(v), "num");
                this.camera.position.x = v / (this.isMeters ? 1 : 100);
            }
        });
        this.#eCameraPosYInput = document.createElement("input");
        eCameraPos.appendChild(this.eCameraPosYInput);
        this.eCameraPosYInput.type = "number";
        this.eCameraPosYInput.placeholder = "Y";
        this.eCameraPosYInput.step = 0.1;
        this.eCameraPosYInput.addEventListener("change", e => {
            let v = this.eCameraPosYInput.value;
            if (v.length > 0) {
                v = util.ensure(parseFloat(v), "num");
                this.camera.position.y = v / (this.isMeters ? 1 : 100);
            }
        });
        this.#eCameraPosZInput = document.createElement("input");
        eCameraPos.appendChild(this.eCameraPosZInput);
        this.eCameraPosZInput.type = "number";
        this.eCameraPosZInput.placeholder = "Z";
        this.eCameraPosZInput.step = 0.1;
        this.eCameraPosZInput.addEventListener("change", e => {
            let v = this.eCameraPosZInput.value;
            if (v.length > 0) {
                v = util.ensure(parseFloat(v), "num");
                this.camera.position.z = v / (this.isMeters ? 1 : 100);
            }
        });
        let cam = new Array(7).fill(null);

        if (a.length <= 0 || [4, 5, 6, 7].includes(a.length) || a.length > 8) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.Odometry3dTab) a = [a.poses, a.template, a.isProjection, a.isOrbit, a.isMeters, a.isDegrees, a.origin, a.optionState];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof this.constructor.Pose) a = [a, null];
                else {
                    a = new Panel.Odometry3dTab(...a);
                    a = [a.poses, a.template, a.isProjection, a.isOrbit, a.isMeters, a.isDegrees, a.origin, a.optionState];
                }
            }
            else if (util.is(a, "obj")) a = [a.poses, a.template, a.isProjection, a.isOrbit, a.isMeters, a.isDegrees, a.origin, a.optionState];
            else a = [[], "§null"];
        }
        if (a.length == 2) a = [...a, 0.5];
        if (a.length == 3) a = [...a.slice(0, 2), true, true, true, true, "blue+", a[2]];

        [this.poses, this.template, this.isProjection, this.isOrbit, this.isMeters, this.isDegrees, this.origin, this.optionState] = a;

        let templates = {};
        let templateModels = {};
        let finished = false;
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
            templateModels = util.ensure(await window.api.get("template-models"), "obj");
            finished = true;
        })();
        
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

        this.addHandler("change-isMeters", () => {
            infoUnits.forEach(elem => (elem.textContent = (this.isMeters ? "m" : "cm")));
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

        let loadTimer = 0, loadTemplate = 0;

        this.addHandler("update", delta => {
            if (this.isClosed) {
                if (this.controls instanceof PointerLockControls)
                    this.controls.unlock();
                return;
            }

            if (this.template in templates) eField.classList.add("has");
            else eField.classList.remove("has");
            if (document.activeElement != this.eCameraPosXInput)
                this.eCameraPosXInput.value = Math.round((this.camera.position.x * (this.isMeters ? 1 : 100))*10000)/10000;
            if (document.activeElement != this.eCameraPosYInput)
                this.eCameraPosYInput.value = Math.round((this.camera.position.y * (this.isMeters ? 1 : 100))*10000)/10000;
            if (document.activeElement != this.eCameraPosZInput)
                this.eCameraPosZInput.value = Math.round((this.camera.position.z * (this.isMeters ? 1 : 100))*10000)/10000;
            
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            this.poses.forEach(pose => {
                pose.state.pose = pose.isShown ? pose : null;
                [pose.state.offsetX, pose.state.offsetY] = new V(util.ensure(templates[this.template], "obj").size).div(-2).xy;
                const node = source ? source.tree.lookup(pose.path) : null;
                pose.state.value = this.getValue(node);
                pose.state.scene = this.scene;
                pose.state.group = this.wpilibGroup;
                pose.state.camera = this.camera;
                pose.state.update(delta);
            });

            let colorR = core.PROPERTYCACHE.getColor("--cr");
            let colorG = core.PROPERTYCACHE.getColor("--cg");
            let colorB = core.PROPERTYCACHE.getColor("--cb");
            let colorV = core.PROPERTYCACHE.getColor("--v2");
            this.scene.fog.color.set(colorV.toHex(false));
            this.axisScene.xAxis.material.color.set(colorR.toHex(false));
            this.axisScene.yAxis.material.color.set(colorG.toHex(false));
            this.axisScene.zAxis.material.color.set(colorB.toHex(false));
            this.axisSceneSized.xAxis.material.color.set(colorR.toHex(false));
            this.axisSceneSized.yAxis.material.color.set(colorG.toHex(false));
            this.axisSceneSized.zAxis.material.color.set(colorB.toHex(false));
            let fieldSize = new V(util.ensure(templates[this.template], "obj").size).div(100);
            this.axisSceneSized.axes.position.set(...fieldSize.div(-2).xy, 0);
            let planes, i;
            planes = this.axisScene.planes;
            let size = 10;
            i = 0;
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    if ((x+y) % 2 == 0) continue;
                    if (i >= planes.length) {
                        let plane = new THREE.Mesh(
                            new THREE.PlaneGeometry(1, 1),
                            new THREE.MeshBasicMaterial({ color: 0xffffff }),
                        );
                        plane.material.side = THREE.DoubleSide;
                        planes.push(plane);
                        this.axisScene.add(plane);
                        this.requestRedraw();
                    }
                    let plane = planes[i++];
                    plane.position.set(0.5+1*(x-size/2), 0.5+1*(y-size/2), 0);
                    plane.material.color.set(colorV.toHex(false));
                }
            }
            while (planes.length > i) {
                let plane = planes.pop();
                this.axisScene.remove(plane);
                plane.geometry.dispose();
                plane.material.dispose();
                this.requestRedraw();
            }
            planes = this.axisSceneSized.planes;
            let w = this.axisSceneSized.w;
            let h = this.axisSceneSized.h;
            if (w != fieldSize.x || h != fieldSize.y) {
                w = this.axisSceneSized.w = fieldSize.x;
                h = this.axisSceneSized.h = fieldSize.y;
                while (planes.length > 0) {
                    let plane = planes.pop();
                    this.axisSceneSized.remove(plane);
                    plane.geometry.dispose();
                    plane.material.dispose();
                    this.requestRedraw();
                };
            }
            i = 0;
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    if ((x+y) % 2 == 0) continue;
                    if (i >= planes.length) {
                        let plane = new THREE.Mesh(
                            new THREE.PlaneGeometry(0, 0),
                            new THREE.MeshBasicMaterial({ color: 0xffffff }),
                        );
                        plane.geometry.w = plane.geometry.h = 0;
                        plane.material.side = THREE.DoubleSide;
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
                    plane.material.color.set(colorV.toHex(false));
                }
            }
            while (planes.length > i) {
                let plane = planes.pop();
                this.axisSceneSized.remove(plane);
                plane.geometry.dispose();
                plane.material.dispose();
                this.requestRedraw();
            }

            if ((util.getTime()-loadTimer > 1000 || loadTemplate != this.template) && (this.template in templateModels) && !(this.template in preloadedFields)) {
                loadTimer = util.getTime();
                const template = this.template;
                loadTemplate = template;
                LOADER.load(templateModels[template], gltf => {
                    gltf.scene.traverse(obj => {
                        if (!obj.isMesh) return;
                        if (obj.material instanceof THREE.MeshStandardMaterial) {
                            obj.material.metalness = 0;
                            obj.material.roughness = 1;
                        }
                    });
                    let obj, pobj;
                    obj = gltf.scene;
                    let bbox = new THREE.Box3().setFromObject(obj);
                    obj.position.set(
                        obj.position.x + (0-(bbox.max.x+bbox.min.x)/2)*0,
                        obj.position.y + (0-(bbox.max.y+bbox.min.y)/2)*0,
                        obj.position.z + (0-(bbox.max.z+bbox.min.z)/2)*0,
                    );
                    [obj, pobj] = [new THREE.Object3D(), obj];
                    obj.add(pobj);
                    preloadedFields[template] = obj;
                }, null, err => {});
            }

            this.field = (this.template in preloadedFields) ? preloadedFields[this.template] : (this.template in templateModels) ? this.axisSceneSized : this.axisScene;

            if (this.controls instanceof OrbitControls) {
                this.controls.update();
            } else if (this.controls instanceof PointerLockControls) {
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
                    velocity.iadd(new util.V3(x, y, z).mul(keys.has("ShiftRight") ? 0.001 : 0.01));
                    velocity.imul(0.9);
                    velocity.imap(v => (Math.abs(v) < util.EPSILON ? 0 : v));
                    this.controls.moveRight(velocity.x);
                    this.controls.moveForward(velocity.y);
                    this.camera.position.y += velocity.z;
                } else {
                    velocity.imul(0);
                }
            }
            this.camera.position.x = Math.round(this.camera.position.x*10000)/10000;
            this.camera.position.y = Math.round(this.camera.position.y*10000)/10000;
            this.camera.position.z = Math.round(this.camera.position.z*10000)/10000;
            let cam2 = [
                this.camera.position.x, this.camera.position.y, this.camera.position.z,
                this.camera.quaternion.w, this.camera.quaternion.x, this.camera.quaternion.y, this.camera.quaternion.z,
            ];
            for (let i = 0; i < 7; i++) {
                if (cam[i] == cam2[i]) continue;
                cam[i] = cam2[i];
                this.requestRedraw();
            }

            let r = this.eContent.getBoundingClientRect();

            if (this.camera instanceof THREE.PerspectiveCamera) {
                if (this.camera.aspect != r.width / r.height) {
                    this.camera.aspect = r.width / r.height;
                    this.camera.updateProjectionMatrix();
                }
            } else if (this.camera instanceof THREE.OrthographicCamera) {
                let size = 15;
                let aspect = r.width / r.height;
                this.camera.left = -size/2 * aspect;
                this.camera.right = +size/2 * aspect;
                this.camera.top = +size/2;
                this.camera.bottom = -size/2;
            }

            if (!this.#requestRedraw) return;
            this.#requestRedraw = false;

            this.renderer.render(this.scene, this.camera);
            this.cssRenderer.render(this.scene, this.camera);
        });

        this.isProjection = true;
    }

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

    get field() { return this.#field; }
    get theField() { return this.#theField; }
    set field(v) {
        v = (v instanceof THREE.Object3D) ? v : null;
        if (this.field == v) return;
        if (this.hasField()) {
            this.wpilibGroup.remove(this.theField);
            this.theField.traverse(obj => {
                if (!obj.isMesh) return;
                obj.geometry.dispose();
                obj.material.dispose();
            });
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
        this.#controls = this.isOrbit ? new OrbitControls(this.camera, this.canvas) : new PointerLockControls(this.camera, this.canvas);
        if (this.controls instanceof OrbitControls) {
            this.eContent.classList.remove("showinfo");
        } else if (this.controls instanceof PointerLockControls) {
            this.controls.addEventListener("lock", () => this.eContent.classList.add("showinfo"));
            this.controls.addEventListener("unlock", () => this.eContent.classList.remove("showinfo"));
        }
    }
    get isProjection() { return this.#isProjection; }
    set isProjection(v) {
        v = !!v;
        if (this.isProjection == v) return;
        this.change("isProjection", this.isProjection, this.#isProjection=v);
        this.#camera = this.isProjection ? new THREE.PerspectiveCamera(75, 1, 0.1, 1000) : new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000);
        this.camera.position.set(...(this.isProjection ? [0, 7.5, -7.5] : [10, 10, -10]));
        this.updateControls();
        this.camera.lookAt(0, 0, 0);
        this.requestRedraw();

        if (this.isProjection) this.eViewProjection.classList.add("this");
        else this.eViewProjection.classList.remove("this");
        if (this.isIsometric) this.eViewIsometric.classList.add("this");
        else this.eViewIsometric.classList.remove("this");
    }
    get isIsometric() { return !this.isProjection; }
    set isIsometric(v) { this.isProjection = !v; }
    get isOrbit() { return this.#isOrbit; }
    set isOrbit(v) {
        v = !!v;
        if (this.isOrbit == v) return;
        this.change("isOrbit", this.isOrbit, this.#isOrbit=v);

        if (this.isOrbit) this.eViewOrbit.classList.add("this");
        else this.eViewOrbit.classList.remove("this");
        if (this.isFree) this.eViewFree.classList.add("this");
        else this.eViewFree.classList.remove("this");

        this.updateControls();
    }
    get isFree() { return !this.isOrbit; }
    set isFree(v) { this.isOrbit = !v; }
    get isMeters() { return this.#isMeters; }
    set isMeters(v) {
        v = !!v;
        if (this.isMeters == v) return;
        this.change("isMeters", this.isMeters, this.#isMeters=v);

        if (this.isMeters) this.eUnitsMeters.classList.add("this");
        else this.eUnitsMeters.classList.remove("this");
        if (this.isCentimeters) this.eUnitsCentimeters.classList.add("this");
        else this.eUnitsCentimeters.classList.remove("this");

        this.requestRedraw();
    }
    get isCentimeters() { return !this.isMeters; }
    set isCentimeters(v) { this.isMeters = !v; }
    get isDegrees() { return this.#isDegrees; }
    set isDegrees(v) {
        v = !!v;
        if (this.isDegrees == v) return;
        this.change("isDegrees", this.isDegrees, this.#isDegrees=v);

        if (this.isDegrees) this.eUnitsDegrees.classList.add("this");
        else this.eUnitsDegrees.classList.remove("this");
        if (this.isRadians) this.eUnitsRadians.classList.add("this");
        else this.eUnitsRadians.classList.remove("this");

        this.requestRedraw();
    }
    get isRadians() { return !this.isDegrees; }
    set isRadians(v) { this.isDegrees = !v; }
    get origin() { return this.#origin; }
    set origin(v) {
        v = String(v);
        if (!["blue+", "blue-", "red+", "red-"].includes(v)) v = "blue+";
        if (this.origin == v) return;
        this.change("origin", this.origin, this.#origin=v);
        
        if (this.origin == "blue+") this.eOriginBluePos.classList.add("this");
        else this.eOriginBluePos.classList.remove("this");
        if (this.origin == "blue-") this.eOriginBlueNeg.classList.add("this");
        else this.eOriginBlueNeg.classList.remove("this");
        if (this.origin == "red+") this.eOriginRedPos.classList.add("this");
        else this.eOriginRedPos.classList.remove("this");
        if (this.origin == "red-") this.eOriginRedNeg.classList.add("this");
        else this.eOriginRedNeg.classList.remove("this");

        this.requestRedraw();
    }

    get eViewProjection() { return this.#eViewProjection; }
    get eViewIsometric() { return this.#eViewIsometric; }
    get eViewOrbit() { return this.#eViewOrbit; }
    get eViewFree() { return this.#eViewFree; }
    get eUnitsMeters() { return this.#eUnitsMeters; }
    get eUnitsCentimeters() { return this.#eUnitsCentimeters; }
    get eUnitsDegrees() { return this.#eUnitsDegrees; }
    get eUnitsRadians() { return this.#eUnitsRadians; }
    get eOriginBluePos() { return this.#eOriginBluePos; }
    get eOriginBlueNeg() { return this.#eOriginBlueNeg; }
    get eOriginRedPos() { return this.#eOriginRedPos; }
    get eOriginRedNeg() { return this.#eOriginRedNeg; }
    get eCameraPosXInput() { return this.#eCameraPosXInput; }
    get eCameraPosYInput() { return this.#eCameraPosYInput; }
    get eCameraPosZInput() { return this.#eCameraPosZInput; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            poses: this.poses,
            template: this.template,
            isProjection: this.isProjection,
            isOrbit: this.isOrbit,
            isMeters: this.isMeters,
            isDegrees: this.isDegrees,
            origin: this.origin,
            optionState: this.optionState,
        });
    }
};
Panel.Odometry3dTab.Pose = class PanelOdometry3dTabPose extends Panel.OdometryTab.Pose {
    #isGhost;
    #isSolid;
    #type;

    #eGhostBtn;
    #eSolidBtn;
    #eDisplayType;

    constructor(...a) {
        super();

        this.#isGhost = false;
        this.#isSolid = false;
        this.#type = "";

        this.#eGhostBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eGhostBtn);
        this.eGhostBtn.classList.add("custom");
        this.eGhostBtn.textContent = "Ghost";
        this.eGhostBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.isGhost = !this.isGhost;
        });

        this.#eSolidBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eSolidBtn);
        this.eSolidBtn.classList.add("custom");
        this.eSolidBtn.textContent = "Solid";
        this.eSolidBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.isSolid = !this.isSolid;
        });

        this.#eDisplayType = document.createElement("button");
        this.eContent.appendChild(this.eDisplayType);
        this.eDisplayType.classList.add("display");
        this.eDisplayType.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eDisplayType.addEventListener("click", e => {
            e.stopPropagation();
            this.post("type");
        });

        if (a.length <= 0 || [3, 4, 5].includes(a.length) || a.length > 6) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof this.constructor) a = [a.path, a.color, a.isShown, a.isGhost, a.isSolid, a.type];
            else if (util.is(a, "arr")) {
                if (util.is(a[0], "str")) a = [a, null];
                else {
                    a = new this.constructor(...a);
                    a = [a.path, a.color, a.isShown, a.isGhost, a.isSolid, a.type];
                }
            }
            else if (util.is(a, "obj")) a = [a.path, a.color, a.isShown, a.isGhost, a.isSolid, a.type];
            else a = [null, null];
        }
        if (a.length == 2) a = [...a, true, false, false];
        if (a.length == 5) a = [...a, "KitBot"];

        [this.path, this.color, this.isShown, this.isGhost, this.isSolid, this.type] = a;
    }

    get isGhost() { return this.#isGhost; }
    set isGhost(v) {
        v = !!v;
        if (this.isGhost == v) return;
        this.change("isGhost", this.isGhost, this.#isGhost=v);
        if (this.isGhost) this.eGhostBtn.classList.add("this");
        else this.eGhostBtn.classList.remove("this");
    }
    get isSolid() { return this.#isSolid; }
    set isSolid(v) {
        v = !!v;
        if (this.isSolid == v) return;
        this.change("isSolid", this.isSolid, this.#isSolid=v);
        if (this.isSolid) this.eSolidBtn.classList.add("this");
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

    get eGhostBtn() { return this.#eGhostBtn; }
    get eSolidBtn() { return this.#eSolidBtn; }
    get eDisplayType() { return this.#eDisplayType; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            color: this.color,
            isShown: this.isShown,
            isGhost: this.isGhost,
            isSolid: this.isSolid,
            type: this.type,
        });
    }
};
Panel.Odometry3dTab.Pose.State = class PanelOdometry3dTabPoseState extends Panel.OdometryTab.Pose.State {
    #offset;

    #value;
    #scene;
    #group;
    #camera;

    #object;
    #theObject;

    #preloadedObjs;
    
    constructor() {
        super();
        
        this.#offset = new util.V3();

        this.#value = [];
        this.#scene = null;
        this.#group = null;
        this.#camera = null;

        this.#object = null;
        this.#theObject = null;

        this.#preloadedObjs = {};
        const node = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        this.#preloadedObjs["§node"] = node;
        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        this.#preloadedObjs["§cube"] = cube;
        const radius = 0.05, arrowLength = 0.25, arrowRadius = 0.1;
        const arrow = new THREE.Object3D();
        const tip = new THREE.Mesh(
            new THREE.ConeGeometry(arrowRadius, arrowLength, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        tip.position.set(0, (1-arrowLength)/2, 0);
        arrow.add(tip);
        const line = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, 1-arrowLength, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
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
                this.#preloadedObjs["§arrow"+"+-"[i]+"xyz"[j]] = obj;
            }
        }
        const axes = new THREE.Object3D();
        let length = 1;
        let xAxis, yAxis, zAxis;
        xAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xff0000 }),
        );
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        axes.add(xAxis);
        axes.xAxis = xAxis;
        yAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
        );
        yAxis.position.set(0, length/2, 0);
        axes.add(yAxis);
        axes.yAxis = yAxis;
        zAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0x0000ff }),
        );
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        axes.add(zAxis);
        axes.zAxis = zAxis;
        this.#preloadedObjs["§axes"] = axes;

        let robots = {};
        let robotModels = {};
        let finished = false;
        (async () => {
            robots = util.ensure(await window.api.get("robots"), "obj");
            robotModels = util.ensure(await window.api.get("robot-models"), "obj");
            finished = true;
        })();

        let loadTimer = 0, loadRobot = 0;
        let modelObject = null;

        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            if (!this.hasPose()) return;
            if (!this.hasThree()) return;
            let color = this.pose.color.startsWith("--") ? core.PROPERTYCACHE.getColor(this.pose.color) : new util.Color(this.pose.color);
            this.pose.enable();
            if (this.value.length % 7 == 0 || this.value.length % 3 == 0) {
                if ((util.getTime()-loadTimer > 1000 || loadRobot != this.pose.type) && !this.pose.type.startsWith("§") && (this.pose.type in robotModels) && !(this.pose.type in preloadedRobots)) {
                    loadTimer = util.getTime();
                    const robot = this.pose.type;
                    loadRobot = robot;
                    LOADER.load(robotModels[robot], gltf => {
                        gltf.scene.traverse(obj => {
                            if (!obj.isMesh) return;
                            if (obj.material instanceof THREE.MeshStandardMaterial) {
                                obj.material.metalness = 0;
                                obj.material.roughness = 1;
                            }
                        });
                        let obj, pobj, bbox;
                        obj = gltf.scene;
                        bbox = new THREE.Box3().setFromObject(obj);
                        obj.position.set(
                            obj.position.x - (bbox.max.x+bbox.min.x)/2,
                            obj.position.y - (bbox.max.y+bbox.min.y)/2,
                            obj.position.z - (bbox.max.z+bbox.min.z)/2,
                        );
                        [obj, pobj] = [new THREE.Object3D(), obj];
                        obj.add(pobj);
                        obj.quaternion.copy(THREE.Quaternion.fromRotationSequence(util.ensure(robots[robot], "obj").rotations));
                        [obj, pobj] = [new THREE.Object3D(), obj];
                        obj.add(pobj);
                        bbox = new THREE.Box3().setFromObject(obj);
                        obj.position.setZ((bbox.max.z-bbox.min.z)/2);
                        [obj, pobj] = [new THREE.Object3D(), obj];
                        obj.add(pobj);
                        preloadedRobots[robot] = obj;
                    }, null, err => {});
                }
                let theModelObject = this.pose.type.startsWith("§") ? this.#preloadedObjs[this.pose.type] : preloadedRobots[this.pose.type];
                let type = (this.value.length % 7 == 0) ? 7 : 3;
                if (!this.hasObject() || this.object._type != type || modelObject != theModelObject) {
                    this.object = new THREE.Group();
                    this.object._type = type;
                    modelObject = theModelObject;
                }
                let l = modelObject ? (this.value.length / type) : 0;
                while (this.theObject.children.length < l) {
                    let theObject = modelObject.clone();
                    this.theObject.add(theObject);
                    let elem = document.createElement("div");
                    theObject.add(new CSS2DObject(elem));
                    elem.classList.add("label");
                    elem.innerHTML = "<div><div class='title'></div><div class='info'><div class='pos'></div><div class='dir'></div></div></div>";
                    elem.elem = elem.querySelector(":scope > div");
                    elem.eTitle = elem.querySelector(":scope > div > .title");
                    elem.eInfo = elem.querySelector(":scope > div > .info");
                    elem.ePos = elem.querySelector(":scope > div > .info > .pos");
                    elem.eDir = elem.querySelector(":scope > div > .info > .dir");
                    theObject.traverse(obj => {
                        if (!obj.isMesh) return;
                        if (!(obj.material instanceof THREE.Material)) return;
                        obj.material = obj.material.clone();
                        obj.material._transparent = obj.material.transparent;
                        obj.material._opacity = obj.material.opacity;
                        obj.material._color = obj.material.color.clone();
                    });
                    theObject.isGhost = theObject.isSolid = null;
                    this.tab.requestRedraw();
                }
                while (this.theObject.children.length > l) {
                    let theObject = this.theObject.children.at(-1);
                    this.theObject.remove(theObject);
                    theObject.traverse(obj => {
                        if (obj instanceof CSS2DObject)
                            obj.removeFromParent();
                        if (!obj.isMesh) return;
                        obj.geometry.dispose();
                        obj.material.dispose();
                    });
                    this.tab.requestRedraw();
                }
                let r = this.tab.canvas.getBoundingClientRect();
                for (let i = 0; i < l; i++) {
                    let theObject = this.theObject.children[i];
                    let value = this.value.slice(i*type, (i+1)*type);
                    if (type == 7) {
                        value[0] /= this.tab.isMeters?1:100;
                        value[1] /= this.tab.isMeters?1:100;
                        value[2] /= this.tab.isMeters?1:100;
                        value[0] += this.offsetX/100;
                        value[1] += this.offsetY/100;
                        value[2] += this.offsetZ/100;
                        let value2 = [
                            theObject.position.x, theObject.position.y, theObject.position.z,
                            theObject.quaternion.w, theObject.quaternion.x, theObject.quaternion.y, theObject.quaternion.z,
                        ];
                        let i = 0;
                        for (; i < type; i++) {
                            if (value2[i] == value[i]) continue;
                            this.tab.requestRedraw();
                            break;
                        }
                        if (i < type) {
                            theObject.position.set(value[0], value[1], value[2]);
                            theObject.quaternion.set(value[4], value[5], value[6], value[3]);
                        }
                    } else {
                        value[0] /= this.tab.isMeters?1:100;
                        value[1] /= this.tab.isMeters?1:100;
                        value[0] += this.offsetX/100;
                        value[1] += this.offsetY/100;
                        value[2] *= this.tab.isDegrees ? (Math.PI/180) : 1;
                        let value2 = [
                            theObject.position.x, theObject.position.y,
                            theObject.rotation.z,
                        ];
                        let i = 0;
                        for (; i < type; i++) {
                            if (value2[i] == value[i]) continue;
                            this.tab.requestRedraw();
                            break;
                        }
                        if (i < type) {
                            theObject.position.set(
                                value[0], value[1],
                                (this.offsetZ/100),
                            );
                            theObject.rotation.set(0, 0, value[2], "XYZ");
                        }
                    }
                    let hovered = false;
                    let css2dObjects = [];
                    theObject.traverse(obj => {
                        if (obj instanceof CSS2DObject)
                            css2dObjects.push(obj);
                        if (this.tab.raycastIntersections[0])
                            if (obj == this.tab.raycastIntersections[0].object)
                                hovered = true;
                        if (!obj.isMesh) return;
                        if (!this.pose.type.startsWith("§")) return;
                        if (this.pose.type == "§axes") return;
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
                        obj.element.eTitle.textContent = this.pose.path;
                        let posL = (type == 7) ? 3 : 2;
                        let dirL = (type == 7) ? 4 : 1;
                        while (obj.element.ePos.children.length < posL) obj.element.ePos.appendChild(document.createElement("div"));
                        while (obj.element.ePos.children.length > posL) obj.element.ePos.removeChild(obj.element.ePos.lastChild);
                        while (obj.element.eDir.children.length < dirL) obj.element.eDir.appendChild(document.createElement("div"));
                        while (obj.element.eDir.children.length > dirL) obj.element.eDir.removeChild(obj.element.eDir.lastChild);
                        for (let i = 0; i < posL; i++) obj.element.ePos.children[i].textContent = value[i];
                        for (let i = 0; i < dirL; i++) obj.element.eDir.children[i].textContent = (type == 7 ? "wxyz"[i]+": " : "")+value[i+posL];
                    });
                }
            } else {
                this.pose.disable();
                this.object = null;
            }
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
    get scene() { return this.#scene; }
    set scene(v) {
        v = (v instanceof THREE.Scene) ? v : null;
        if (this.scene == v) return;
        this.destroy();
        this.#scene = v;
        this.create();
    }
    hasScene() { return !!this.scene; }
    get group() { return this.#group; }
    set group(v) {
        v = (v instanceof THREE.Group) ? v : null;
        if (this.group == v) return;
        this.destroy();
        this.#group = v;
        this.create();
    }
    hasGroup() { return !!this.group; }
    get camera() { return this.#camera; }
    set camera(v) {
        v = (v instanceof THREE.Camera) ? v : null;
        if (this.camera == v) return;
        this.destroy();
        this.#camera = v;
        this.create();
    }
    hasCamera() { return !!this.camera; }
    hasThree() { return this.hasScene() && this.hasGroup() && this.hasCamera(); }

    destroy() {
        if (!this.hasThree()) return;
        this.object = null;
    }
    create() {
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        if (!this.hasThree()) return;
    }

    get object() { return this.#object; }
    get theObject() { return this.#theObject; }
    set object(v) {
        v = (v instanceof THREE.Object3D) ? v : null;
        if (this.object == v) return;
        if (this.hasObject()) {
            this.group.remove(this.theObject);
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
            this.group.add(this.theObject);
        }
        if (this.hasTab()) this.tab.requestRedraw();
    }
    hasObject() { return !!this.object; }
};

class Project extends core.Project {
    #widgetData;
    #sidePos;

    constructor(...a) {
        super();

        this.#widgetData = "";
        this.#sidePos = 0.15;

        if (a.length <= 0 || a.length > 5) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project) a = [a.id, a.widgetData, a.sidePos, a.config, a.meta];
            else if (util.is(a, "arr")) {
                a = new Project(...a);
                a = [a.id, a.widgetData, a.sidePos, a.config, a.meta];
            }
            else if (a instanceof Project.Config) a = ["", a, null];
            else if (a instanceof Project.Meta) a = ["", null, a];
            else if (util.is(a, "str")) a = ["", null, a];
            else if (util.is(a, "obj")) a = [a.id, a.widgetData, a.sidePos, a.config, a.meta];
            else a = ["", null, null];
        }
        if (a.length == 2) {
            if (a[0] instanceof Project.Config && a[1] instanceof Project.Meta) a = ["", ...a];
            else a = ["", null, null];
        }
        if (a.length == 3) a = [a[0], 0.15, ...a.slice(1)];
        if (a.length == 4) a = [null, ...a];

        [this.id, this.widgetData, this.sidePos, this.config, this.meta] = a;
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
            VERSION: VERSION,
            id: this.id,
            widgetData: this.widgetData,
            sidePos: this.sidePos,
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
            if (a instanceof Project.Config) a = [a.#sources, a.sourceType];
            else if (util.is(a, "arr")) {
                a = new Project.Config(...a);
                a = [a.#sources, a.sourceType];
            }
            else if (util.is(a, "obj")) a = [a.sources, a.sourceType];
            else a = [{}, "nt"];
        }

        [this.sources, this.sourceType] = a;
    }

    get sources() { return Object.keys(this.#sources); }
    set sources(v) {
        v = util.ensure(v, "obj");
        this.clearSources();
        for (let k in v) this.addSource(k, v[k]);
    }
    clearSources() {
        let sources = this.sources;
        sources.forEach(type => this.remSource(type));
        return sources;
    }
    hasSource(type) {
        type = String(type);
        return type in this.#sources;
    }
    getSource(type) {
        type = String(type);
        if (!this.hasSource(type)) return null;
        return this.#sources[type];
    }
    addSource(type, v) {
        type = String(type);
        v = (v == null) ? null : String(v);
        if (this.getSource(type) == v) return v;
        this.#sources[type] = v;
        this.change("addSource("+type+")", null, v);
        return v;
    }
    remSource(type) {
        type = String(type);
        let v = this.getSource(type);
        delete this.#sources[type];
        this.change("remSource("+type+")", v, null);
        return v;
    }
    get source() { return this.getSource(this.sourceType); }
    set source(v) {
        v = (v == null) ? null : String(v);
        if (this.source == v) return;
        this.addSource(this.sourceType, v);
    }
    get sourceType() { return this.#sourceType; }
    set sourceType(v) {
        v = String(v).toLowerCase();
        if (this.sourceType == v) return;
        this.change("sourceType", this.sourceType, this.#sourceType=v);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            sources: this.#sources,
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
                let menu = this.menu.findItemWithId(id);
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
                                        id: "source:nt", label: "NetworkTables", type: "radio",
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
            ["nt", "wpilog"].forEach(name => {
                let btn = document.createElement("button");
                eNav.appendChild(this.#eProjectInfoSourceTypes[name] = btn);
                btn.textContent = {
                    "nt": "NetworkTables",
                    "wpilog": "WPILOG",
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

    #toolButtons;
    #widget;
    #activeWidget;
    #source;

    #eNavPreInfo;
    #eSide;
    #eSideMeta;
    #eSideMetaInfo;
    #eSideMetaBtn;
    #eSideMetaTooltip;
    #eSideSections;
    #eContent;
    #eDragBox;
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
            active.addTab(new Panel.AddTab());
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
            if (!["nt", "wpilog"].includes(type)) return;
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
            if (this.source instanceof WPILOGSource) {
                if (this.source.importing) return;
                (async () => {
                    this.source.importing = true;
                    this.app.progress = 0;
                    try {
                        let source = this.project.config.source;
                        let i1 = source.lastIndexOf("/");
                        let i2 = source.lastIndexOf("\\");
                        let i = Math.max(i1, i2);
                        this.source.file = source;
                        this.source.shortFile = source.substring(i+1);
                        this.source.data = await window.api.send("wpilog-read", source);
                        const progress = v => (this.app.progress = v);
                        this.source.addHandler("progress", progress);
                        await this.source.build();
                        this.source.remHandler("progress", progress);
                        this.app.progress = 1;
                    } catch (e) {
                        this.app.error("WPILOG Load Error", this.project.config.source, e);
                    }
                    this.app.progress = null;
                    delete this.source.importing;
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

        this.#explorer = new core.Explorer();
        this.explorer.addHandler("drag", (e, path) => {
            path = util.generatePath(path);
            let node = this.hasSource() ? this.source.tree.lookup(path) : null;
            if (!node) return;
            this.app.dragData = node;
            this.app.dragging = true;
        });

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
        this.#eSideMeta = document.createElement("div");
        this.eSide.appendChild(this.eSideMeta);
        this.eSideMeta.classList.add("meta");
        this.#eSideMetaInfo = document.createElement("div");
        this.eSideMeta.appendChild(this.eSideMetaInfo);
        this.#eSideMetaBtn = document.createElement("button");
        this.eSideMeta.appendChild(this.eSideMetaBtn);
        this.eSideMetaBtn.innerHTML = "<ion-icon name='information-circle'></ion-icon>";
        this.eSideMetaBtn.addEventListener("click", e => {
            if (this.eSideMetaBtn.classList.contains("active")) this.eSideMetaBtn.classList.remove("active");
            else {
                this.eSideMetaBtn.classList.add("active");
                const click = e => {
                    e.stopPropagation();
                    document.body.removeEventListener("click", click, true);
                    this.eSideMetaBtn.click();
                };
                document.body.addEventListener("click", click, true);
            }
        });
        this.#eSideMetaTooltip = document.createElement("div");
        this.eSideMetaBtn.appendChild(this.eSideMetaTooltip);
        this.eSideMetaTooltip.classList.add("tooltip");
        this.eSideMetaTooltip.classList.add("tog");
        this.eSideMetaTooltip.classList.add("ney");
        this.#eSideSections = {};
        ["browser", "tools"].forEach(name => {
            let elem = document.createElement("div");
            this.eSide.appendChild(elem);
            elem.id = name;
            elem.classList.add("section");
            let s = this.#eSideSections[name] = new util.Target();
            s.elem = elem;
            s.getIsOpen = () => elem.classList.contains("this");
            s.setIsOpen = v => {
                v = !!v;
                if (s.getIsOpen() == v) return true;
                if (v) elem.classList.add("this");
                else elem.classList.remove("this");
                this.formatSide();
                return true;
            };
            s.getIsClosed = () => !s.getIsOpen();
            s.setIsClosed = v => s.setIsOpen(!v);
            s.open = () => s.setIsOpen(true);
            s.close = () => s.setIsClosed(true);
            let btn = document.createElement("button");
            elem.appendChild(btn);
            btn.classList.add("override");
            btn.innerHTML = "<ion-icon name='chevron-forward'></ion-icon>";
            btn.append(name.toUpperCase());
            if (btn instanceof HTMLButtonElement)
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    s.setIsOpen(!s.getIsOpen());
                });
            s.eContent = document.createElement("div");
            elem.appendChild(s.eContent);
            s.eContent.classList.add("content");
            let idfs = {
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
        
        let toolButtons = [
            {
                id: "graph", name: "Graph",
                tab: Panel.GraphTab,
            },
            {
                id: "table", name: "Table",
                tab: Panel.TableTab,
            },
            {
                id: "odometry2d", name: "Odom2d",
                tab: Panel.Odometry2dTab,
            },
            {
                id: "odometry3d", name: "Odom3d",
                tab: Panel.Odometry3dTab,
            },
            {
                id: "webview", name: "WebView",
                tab: Panel.WebViewTab,
            },
            {
                id: "logger", name: "Logger",
                tab: Panel.LoggerTab,
                disabled: window.agent().distro,
            },
            {
                id: "logworks", name: "LogWorks",
                tab: Panel.LogWorksTab,
            },
        ];
        this.addToolButton(toolButtons.map(data => {
            let btn = new ToolButton(data.name, data.id);
            btn.elem.disabled = !!data.disabled;
            btn.addHandler("drag", () => {
                if (!!data.disabled) return;
                this.app.dragData = new data.tab();
                this.app.dragging = true;
            });
            return btn;
        }));

        this.#eDragBox = document.createElement("div");
        this.eMain.appendChild(this.eDragBox);
        this.eDragBox.classList.add("dragbox");
        this.eDragBox.innerHTML = "<div></div><div></div>";
        const dragIn = e => {
            e.preventDefault();
            e.stopPropagation();
            this.eDragBox.classList.add("this");
        };
        const dragOut = e => {
            e.preventDefault();
            e.stopPropagation();
            this.eDragBox.classList.remove("this");
        };
        const drop = e => {
            let items = e.dataTransfer.items ? [...e.dataTransfer.items] : [];
            items = items.map(item => item.getAsFile()).filter(file => file instanceof File);
            if (items.length <= 0) items = e.dataTransfer.files ? [...e.dataTransfer.files] : [];
            items = items.filter(item => item instanceof File);
            if (items.length <= 0) return;
            const file = items[0];
            if (!this.hasProject()) return;
            this.project.config.sourceType = "wpilog";
            this.project.config.source = file.path;
            this.update(0);
            this.app.post("cmd-action");
        };
        this.addHandler("add", () => {
            ["dragenter", "dragover"].forEach(name => document.body.addEventListener(name, dragIn));
            ["dragleave", "drop"].forEach(name => document.body.addEventListener(name, dragOut));
            document.body.addEventListener("drop", drop);
        });
        this.addHandler("rem", () => {
            ["dragenter", "dragover"].forEach(name => document.body.removeEventListener(name, dragIn));
            ["dragleave", "drop"].forEach(name => document.body.removeEventListener(name, dragOut));
            document.body.removeEventListener("drop", drop);
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

            ["nt", "wpilog"].forEach(type => {
                let itm = this.app.menu.findItemWithId("source:"+type);
                if (!itm) return;
                itm.checked = this.hasProject() ? (type == this.project.config.sourceType) : false;
            });
        };
        this.addHandler("change-project", update);
        this.addHandler("change-project.meta.name", update);
        this.addHandler("change-project.config.source", update);
        this.addHandler("change-project.config.sourceType", update);

        let timer = 0;
        this.addHandler("update", async delta => {
            if (this.app.page == this.name)
                this.app.title = this.hasProject() ? (this.project.meta.name+" — "+this.sourceInfo) : "?";
            
            if (this.hasProject()) {
                const constructor = {
                    nt: NTSource,
                    wpilog: WPILOGSource,
                }[this.project.config.sourceType];
                if (!util.is(constructor, "func")) this.source = null;
                else {
                    if (!(this.source instanceof constructor)) this.source = {
                        nt: () => new NTSource(null),
                        wpilog: () => new WPILOGSource(null),
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
            } else this.widget = new Panel();
            if (!this.hasWidget() || !this.widget.contains(this.activeWidget))
                this.activeWidget = null;
            
            this.eSideMetaInfo.textContent = this.sourceInfo;
            let info = this.sourceMetaInfo;
            let l = Math.max(0, info.length*2-1);
            while (this.eSideMetaTooltip.children.length < l) {
                if (this.eSideMetaTooltip.children.length%2 == 1) {
                    this.eSideMetaTooltip.appendChild(document.createElement("br"));
                    continue;
                }
                this.eSideMetaTooltip.appendChild(document.createElement("span"));
            }
            while (this.eSideMetaTooltip.children.length > l)
                this.eSideMetaTooltip.lastChild.remove();
            for (let i = 0; i < l; i++) {
                if (i%2 == 1) continue;
                let line = info[i/2];
                if (line.includes(":")) {
                    let j = line.indexOf(":");
                    line = [line.substring(0, j), line.substring(j+1)];
                    while (this.eSideMetaTooltip.children[i].children.length < line.length)
                        this.eSideMetaTooltip.children[i].appendChild(document.createElement("span"));
                    while (this.eSideMetaTooltip.children[i].children.length > line.length)
                        this.eSideMetaTooltip.children[i].lastChild.remove();
                    line.forEach((part, j) => {
                        this.eSideMetaTooltip.children[i].children[j].textContent = part + (j > 0 ? "" : ":");
                        this.eSideMetaTooltip.children[i].children[j].style.color = (j > 0) ? "var(--a)" : "";
                    });
                } else this.eSideMetaTooltip.children[i].textContent = line;
            }
            
            if (!this.hasSource());
            else if (this.source instanceof NTSource) {
                let on = !this.source.connecting && !this.source.connected;
                if (on) this.app.eProjectInfoActionBtn.classList.add("on");
                else this.app.eProjectInfoActionBtn.classList.remove("on");
                if (!on) this.app.eProjectInfoActionBtn.classList.add("off");
                else this.app.eProjectInfoActionBtn.classList.remove("off");
                this.app.eProjectInfoActionBtn.textContent = on ? "Connect" : "Disconnect";
            } else if (this.source instanceof WPILOGSource) {
                this.app.eProjectInfoActionBtn.disabled = this.source.importing;
            }

            let itm = this.app.menu.findItemWithId("action");
            if (itm) {
                if (!this.hasSource()) {
                    itm.enabled = false;
                    itm.label = "No source";
                } else if (this.source instanceof NTSource) {
                    let on = !this.source.connecting && !this.source.connected;
                    itm.enabled = true;
                    itm.label = on ? "Connect" : "Disconnect";
                } else if (this.source instanceof WPILOGSource) {
                    itm.enabled = true;
                    itm.label = "Import";
                } else {
                    itm.enabled = false;
                    itm.label = "Unknown source: "+this.source.constructor.name;
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
                this.eNavPreInfo.textContent = util.formatTime(tMin);
                this.eNavInfo.textContent = util.formatTime(tNow) + " / " + util.formatTime(tMax);
            } else this.navOpen = false;
            
            core.Explorer.Node.doubleTraverse(
                this.hasSource() ? this.source.tree.nodeObjects : [],
                this.explorer.nodeObjects,
                (...enodes) => this.explorer.add(...enodes),
                (...enodes) => this.explorer.rem(...enodes),
            );

            this.eMain.style.setProperty("--side", (100*(this.hasProject() ? this.project.sidePos : 0.15))+"%");

            if (timer > 0) return timer -= delta;
            timer = 5000;
            if (!this.hasProject()) return;
            let r = this.eContent.getBoundingClientRect();
            this.project.meta.thumb = await this.app.capture({
                x: Math.round(r.left), y: Math.round(r.top),
                width: Math.round(r.width), height: Math.round(r.height),
            });
        });

        this.addHandler("refresh", () => {
            this.eSideSections.forEach(name => {
                let section = this.getESideSection(name);
                if (["browser"].includes(name)) section.open();
                else section.close();
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
                let itm = this.app.menu.findItemWithId(id);
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
            }
        });
        this.addHandler("post-enter", async data => {
            let itm;
            itm = this.app.menu.findItemWithId("closeproject");
            if (itm) itm.accelerator = "CmdOrCtrl+Shift+W";
            itm = this.app.menu.findItemWithId("close");
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
                let itm = this.app.menu.findItemWithId(id);
                if (!itm) return;
                itm.exists = false;
            });
        });
        this.addHandler("post-leave", async data => {
            let itm;
            itm = this.app.menu.findItemWithId("closeproject");
            if (itm) itm.accelerator = null;
            itm = this.app.menu.findItemWithId("close");
            if (itm) itm.accelerator = null;
        });
    }

    get explorer() { return this.#explorer; }

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
        } else if (this.source instanceof WPILOGSource) {
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
        let itm = this.app.menu.findItemWithId("action");
        if (!itm) return;
        if (!this.hasSource()) {
            itm.enabled = false;
            itm.label = "No source";
        } else if (this.source instanceof NTSource) {
            let on = !this.source.connecting && !this.source.connected;
            itm.enabled = true;
            itm.label = on ? "Connect" : "Disconnect";
        } else if (this.source instanceof WPILOGSource) {
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
        if (this.source instanceof WPILOGSource) {
            if (!this.source.importing && !this.source.hasData()) return "Nothing imported";
            if (this.source.importing) return "Importing from "+this.source.shortFile;
            return this.source.shortFile;
        }
        return "Unknown source: "+this.source.constructor.name;
    }
    get sourceMetaInfo() {
        if (!this.hasSource()) return ["No source"];
        let r = [];
        if (this.source instanceof NTSource) {
            r.push(
                "NT4",
                "  IP: "+this.source.address,
                "  State: "+((!this.source.connecting && !this.source.connected) ? "Disconnected" : (this.source.connecting) ? "Connecting" : "Connected"),
            );
        } else if (this.source instanceof WPILOGSource) {
            r.push(
                "WPILOG",
                "  File: "+this.source.file,
                "  State: "+((!this.source.importing && !this.source.hasData()) ? "Not imported" : (this.source.importing) ? "Importing" : "Imported"),
            );
        } else {
            r.push("UNKNOWN: "+this.source.constructor.name);
        }
        const n = this.source.tree.nFields;
        const tMin = this.source.tsMin, tMax = this.source.tsMax;
        r.push(
            "",
            "#Fields: "+n,
            "Duration: "+((tMin == 0) ? util.formatTime(tMax) : `[${util.formatTime(tMin)} - ${util.formatTime(tMax)}]`),
        );
        return r;
    }

    get eNavPreInfo() { return this.#eNavPreInfo; }
    get eSide() { return this.#eSide; }
    get eSideMeta() { return this.#eSideMeta; }
    get eSideMetaInfo() { return this.#eSideMetaInfo; }
    get eSideMetaBtn() { return this.#eSideMetaBtn; }
    get eSideMetaTooltip() { return this.#eSideMetaTooltip; }
    get eSideSections() { return Object.keys(this.#eSideSections); }
    hasESideSection(id) { return id in this.#eSideSections; }
    getESideSection(id) { return this.#eSideSections[id]; }
    get eContent() { return this.#eContent; }
    get eDragBox() { return this.#eDragBox; }
    get eDivider() { return this.#eDivider; }

    format() {
        this.formatSide();
        this.formatContent();
    }
    formatSide() {
        let r = this.eSide.getBoundingClientRect();
        let ids = this.eSideSections;
        let elems = ids.map(id => this.getESideSection(id).elem);
        let idsOpen = ids.filter(id => this.getESideSection(id).getIsOpen());
        let availableHeight = r.height - ids.length*22;
        Array.from(this.eSide.children).forEach(child => {
            if (elems.includes(child)) return;
            let r = child.getBoundingClientRect();
            availableHeight -= r.height;
        });
        let divideAmong = idsOpen.length;
        idsOpen.forEach(id => this.getESideSection(id).elem.style.setProperty("--h", (availableHeight/divideAmong + 22)+"px"));
        this.explorer.format();
        return true;
    }
    formatContent() {
        if (!this.hasWidget()) return false;
        let r = this.eContent.getBoundingClientRect();
        this.widget.elem.style.setProperty("--w", (r.width-0)+"px");
        this.widget.elem.style.setProperty("--h", (r.height-0)+"px");
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
