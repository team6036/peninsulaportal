import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
// import { SAOPass } from "three/addons/postprocessing/SAOPass.js";
// import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import Source from "../sources/source.js";
import NTSource from "../sources/nt4/source.js";
import WPILOGSource from "../sources/wpilog/source.js";


THREE.Quaternion.fromRotationSequence = (...seq) => {
    if (seq.length == 1 && util.is(seq[0], "arr")) return THREE.Quaternion.fromRotationSequence(...seq[0]);
    let q = new THREE.Quaternion();
    seq.forEach(rot => {
        if (!(util.is(rot, "obj"))) return;
        if (!("axis" in rot) || !("angle" in rot)) return;
        let axis = rot.axis, angle = rot.angle;
        if (!util.is(axis, "str") || !util.is(angle, "num")) return;
        axis = axis.toLowerCase();
        if (!"xyz".includes(axis)) return;
        let vec = new THREE.Vector3(+(axis=="x"), +(axis=="y"), +(axis=="z"));
        q.multiply(new THREE.Quaternion().setFromAxisAngle(vec, (Math.PI/180)*angle));
    });
    return q;
};
const WPILIBQUATERNIONOFFSET = THREE.Quaternion.fromRotationSequence(
    {
        axis: "x",
        angle: -90,
    },
    {
        axis: "z",
        angle: 180,
    },
);

function compare(s1, s2) {
    s1 = String(s1).toLowerCase();
    s2 = String(s2).toLowerCase();
    if (util.is(parseInt(s1), "int") && util.is(parseInt(s2), "int")) return s1 - s2;
    if (s1 < s2) return -1;
    if (s1 > s2) return +1;
    return 0;
}


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
            ctx.strokeStyle = this.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(this.color) : this.color;
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

function getRepresentation(o) {
    if (
        util.is(o, "num") ||
        util.is(o, "bool") ||
        util.is(o, "str")
    ) return String(o);
    if (util.is(o, "arr")) return "["+[...o].map(o => getRepresentation(o)).join(", ")+"]";
    if (o instanceof Uint8Array) return util.TEXTDECODER.decode(o); // return [...o].map(x => x.toString(16).padStart(2, "0")).join("");
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


class BrowserField extends util.Target {
    #name;
    #type;
    #value;
    #fields;
    #showValue;

    #elem;
    #eDisplay;
    #eMain;
    #eIcon;
    #eName;
    #eTag;
    #eValueBox;
    #eValue;
    #eContent;
    #eSide;

    static doubleTraverse(fieldArr, bfieldArr, addFunc, remFunc) {
        let fieldMap = {}, bfieldMap = {};
        util.ensure(fieldArr, "arr").forEach(field => {
            if (!(field instanceof Source.Field)) return;
            fieldMap[field.name] = field;
        });
        util.ensure(bfieldArr, "arr").forEach(bfield => {
            if (!(bfield instanceof BrowserField)) return;
            bfieldMap[bfield.name] = bfield;
        });
        let add = [];
        for (let name in fieldMap) {
            let field = fieldMap[name];
            if (name in bfieldMap) continue;
            let bfield = bfieldMap[field.name] = new BrowserField(field.name, field.type);
            add.push(bfield);
        }
        if (util.is(addFunc, "func")) addFunc(...add);
        let rem = [];
        for (let name in bfieldMap) {
            let bfield = bfieldMap[name];
            if (name in fieldMap) continue;
            rem.push(bfield);
        }
        if (util.is(remFunc, "func")) remFunc(...rem);
        for (let name in fieldMap) {
            let field = fieldMap[name];
            let bfield = bfieldMap[name];
            if (bfield.isOpen)
                BrowserField.doubleTraverse(
                    field.fields,
                    bfield.fields,
                    (...bf) => bfield.addBulk(...bf),
                    (...bf) => bfield.remBulk(...bf),
                );
            bfield.value = field.get();
        }
    };

    constructor(name, type) {
        super();

        this.#name = String(name);
        this.#type = (type == null) ? null : String(type);

        this.#fields = {};

        this.#showValue = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("field");
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
        if (this.name.startsWith("struct:") && this.type == "structschema") {
            this.eName.textContent = this.name.slice(7);
            // this.eName.innerHTML = "<span>struct:</span>"+this.eName.innerHTML;
        }
        this.#eTag = document.createElement("div");
        this.eMain.appendChild(this.eTag);
        this.eTag.classList.add("tag");
        this.eTag.textContent = util.ensure(this.clippedType, "str");
        this.#eValueBox = document.createElement("div");
        this.eDisplay.appendChild(this.eValueBox);
        this.eValueBox.classList.add("value");
        this.eValueBox.innerHTML = "<ion-icon name='return-down-forward'></ion-icon>";
        this.#eValue = document.createElement("div");
        this.eValueBox.appendChild(this.eValue);
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eSide = document.createElement("button");
        this.eContent.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.eSide.classList.add("override");

        let cancel = 10;
        this.eDisplay.addEventListener("click", e => {
            if (cancel <= 0) return cancel = 10;
            if (this.isJustPrimitive) this.showValue = !this.showValue;
            else this.isOpen = !this.isOpen;
        });
        this.eDisplay.addEventListener("dblclick", e => {
            this.post("trigger", e, [this.name]);
        });
        this.eDisplay.addEventListener("mousedown", e => {
            e.preventDefault();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                if (cancel > 0) return cancel--;
                mouseup();
                this.post("drag", [this.name]);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.eSide.addEventListener("click", e => {
            this.isOpen = !this.isOpen;
        });

        this.showValue = false;
    }

    get name() { return this.#name; }
    get isHidden() { return this.name.startsWith("."); }

    get type() { return this.#type; }
    hasType() { return this.type != null; }
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
        return this.isArray ? [...util.ensure(this.#value, "arr")] : this.#value;
    }
    set value(v) {
        v = Source.Field.ensureType(this.type, v);
        this.#value = v;
        this.updateDisplay();
    }

    get nFields() {
        let n = 1;
        this.fields.forEach(field => (n += field.nFields));
        return n;
    }
    get fields() { return Object.values(this.#fields); }
    lookup(k) {
        k = util.ensure(k, "arr");
        let o = this;
        while (k.length > 0) {
            o = o.singlelookup(k.shift());
            if (!o) return null;
        }
        return o;
    }
    singlelookup(k) {
        k = String(k);
        if (k in this.#fields) return this.#fields[k];
        return null;
    }
    has(field) {
        if (!(field instanceof BrowserField)) return false;
        return field.name in this.#fields;
    }
    add(field) {
        let r = this.addBulk(field);
        return (r.length > 0) ? r[0] : false;
    }
    addBulk(...fields) {
        if (fields.length == 1 && util.is(fields[0], "arr")) return this.addBulk(...fields[0]);
        let doneFields = [];
        fields.forEach(field => {
            if (!(field instanceof BrowserField)) return;
            if (field.name in this.#fields) return;
            this.#fields[field.name] = field;
            field.addLinkedHandler(this, "trigger", this.post("trigger", e, [this.name, ...util.ensure(path, "arr")]));
            field.addLinkedHandler(this, "drag", this.post("drag", [this.name, ...util.ensure(path, "arr")]));
            this.eContent.appendChild(field.elem);
            doneFields.push(field);
        });
        this.format();
        return doneFields;
    }
    rem(field) {
        let r = this.remBulk(field);
        return (r.length > 0) ? r[0] : false;
    }
    remBulk(...fields) {
        if (fields.length == 1 && util.is(fields[0], "arr")) return this.addBulk(...fields[0]);
        let doneFields = [];
        fields.forEach(field => {
            if (!(field instanceof BrowserField)) return;
            if (!(field.name in this.#fields)) return;
            delete this.#fields[field.name];
            field.clearLinkedHandlers(this, "trigger");
            field.clearLinkedHandlers(this, "drag");
            this.eContent.removeChild(field.elem);
            doneFields.push(field);
        });
        return doneFields;
    }

    get showValue() { return this.#showValue; }
    set showValue(v) {
        v = !!v;
        if (this.showValue == v) return;
        this.#showValue = v;
        this.updateDisplay();
    }
    get canShowValue() { return this.showValue && this.isJustPrimitive; }

    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eMain() { return this.#eMain; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get eTag() { return this.#eTag; }
    get eValueBox() { return this.#eValueBox; }
    get eValue() { return this.#eValue; }
    get eContent() { return this.#eContent; }
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
        this.icon = "";
        this.eIcon.style.color = "";
        this.eName.style.color = "";
        let display = getDisplay(this.type, this.value);
        if (display != null) {
            if ("src" in display) this.iconSrc = display.src;
            else this.icon = display.name;
            if ("color" in display) this.eIcon.style.color = display.color;
            else this.eIcon.style.color = "";
        }
        this.eValueBox.style.display = this.canShowValue ? "" : "none";
        this.eValue.style.color = (display == null || !("color" in display)) ? "" : display.color;
        this.eValue.textContent = getRepresentation(this.value);
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
        this.fields.sort((a, b) => compare(a.name, b.name)).forEach((field, i) => {
            field.elem.style.order = i;
            field.format();
        });
    }
}

class ToolButton extends util.Target {
    #elem;
    #eIcon;
    #eName;

    constructor(dname, name) {
        super();

        this.#elem = document.createElement("button");
        this.elem.classList.add("item");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);

        let cancel = 10;
        this.elem.addEventListener("click", e => {
            if (cancel <= 0) return cancel = 10;
            this.post("trigger", e);
        });
        this.elem.addEventListener("mousedown", e => {
            e.preventDefault();
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
                if (this.#hasHost()) this.#client = new core.Client(this.#host+"/panel");
            }
            await this.pollServer();
        }, 1000);
        setInterval(async () => {
            await this.pollClient();
        }, 100);
    }

    #hasHost() { return this.#host != null; }
    #hasClient() { return this.#client instanceof core.Client; }

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

    constructor() {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");

        this.#parent = null;
    }

    get elem() { return this.#elem; }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Container) ? v : (v instanceof App.ProjectPage) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return this.parent instanceof Container; }
    hasPageParent() { return this.parent instanceof App.ProjectPage; }
    get page() {
        if (this.hasPageParent()) return this.parent;
        if (this.hasParent()) return this.parent.page;
        return null;
    }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() {
        if (!this.hasPage()) return null;
        return this.page.app;
    }
    hasApp() { return this.app instanceof App; }

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

        this.addHandler("add", o => {
            this.children.forEach(child => child.post("add", o));
        });
        this.addHandler("rem", o => {
            this.children.forEach(child => child.post("rem", o));
        });

        this.addHandler("update", delta => {
            this.children.forEach(child => child.update(delta));
        });

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
        child.addLinkedHandler(this, "change", (c, f, t) => this.change("children["+this.children.indexOf(child)+"]."+c, f, t));
        child.post("add", this);
        this.change("addChild", null, child);
        this.change("weights", weights, this.weights);
        this.format();
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
        child.post("rem", this);
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
                e.preventDefault();
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
            e.stopPropagation();
            if (!this.hasPage()) return;
            this.page.activeWidget = this;
        });

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

        this.addHandler("add", o => {
            this.tabs.forEach(tab => tab.post("add", o));
        });
        this.addHandler("rem", o => {
            this.tabs.forEach(tab => tab.post("rem", o));
        });

        this.eOptions.addEventListener("click", e => {
            if (!this.hasApp()) return;
            e.stopPropagation();
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item(this.isTitleCollapsed ? "Expand Title" : "Collapse Title", this.isTitleCollapsed ? "chevron-expand" : "chevron-collapse"));
            itm.accelerator = "Ctrl+Shift+F";
            itm.addHandler("trigger", e => {
                this.isTitleCollapsed = !this.isTitleCollapsed;
            });
            menu.addItem(new core.App.Menu.Divider());
            itm = menu.addItem(new core.App.Menu.Item("Close Panel", "close"));
            itm.addHandler("trigger", e => {
                if (this.hasPageParent()) return this.parent.widget = null;
                if (this.hasParent()) return this.parent.remChild(this);
            });
            this.app.contextMenu = menu;
            let r = this.eOptions.getBoundingClientRect();
            this.app.placeContextMenu(r.left, r.bottom);
        });
        this.eAdd.addEventListener("click", e => {
            this.addTab(new Panel.AddTab());
        });

        this.addHandler("update", delta => {
            this.tabs.forEach(tab => tab.update(delta));
        });

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

    get tabs() { return [...this.#tabs]; }
    set tabs(v) {
        v = util.ensure(v, "arr");
        this.clearTabs();
        v.forEach(v => this.addTab(v));
    }
    get tabIndex() { return this.#tabIndex; }
    set tabIndex(v) {
        v = Math.min(this.#tabs.length-1, Math.max(0, util.ensure(v, "int")));
        if (this.tabIndex == v) return;
        this.change("tabIndex", this.tabIndex, this.#tabIndex=v);
        this.#tabs.forEach((tab, i) => (i == this.tabIndex) ? tab.open() : tab.close());
        if (this.tabs[this.tabIndex] instanceof Panel.Tab)
            this.tabs[this.tabIndex].eTab.scrollIntoView({ behavior: "smooth" });
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
        tab.addLinkedHandler(this, "change", (c, f, t) => this.change("tabs["+this.tabs.indexOf(tab)+"]."+c, f, t));
        tab.post("add", this);
        this.change("addTab", null, tab);
        this.eTop.appendChild(tab.eTab);
        this.eContent.appendChild(tab.elem);
        this.tabIndex = this.#tabs.indexOf(tab);
        this.format();
        return tab;
    }
    remTab(tab) {
        if (!(tab instanceof Panel.Tab)) return false;
        if (!this.hasTab(tab)) return false;
        if (tab.parent != this) return false;
        let activeTab = this.tabs[this.tabIndex];
        let at = this.#tabs.indexOf(tab);
        this.#tabs.splice(at, 1);
        tab.parent = null;
        tab.clearLinkedHandlers(this, "change");
        tab.post("rem", this);
        this.change("remTab", tab, null);
        this.eTop.removeChild(tab.eTab);
        this.eContent.removeChild(tab.elem);
        tab.close();
        this.format();
        if (this.tabs.indexOf(activeTab) >= 0) this.tabIndex = this.tabs.indexOf(activeTab);
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

    #elem;
    #eTab;
    #eTabIcon;
    #eTabName;
    #eTabClose;

    constructor() {
        super();

        this.#parent = null;

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
            if (cancel <= 0) return cancel = 10;
            if (!this.hasParent()) return;
            this.parent.tabIndex = this.parent.tabs.indexOf(this);
        });
        this.eTab.addEventListener("mousedown", e => {
            e.preventDefault();
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
    }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Panel) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return this.parent instanceof Panel; }
    get page() {
        if (!this.hasParent()) return null;
        return this.parent.page;
    }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() {
        if (!this.hasPage()) return null;
        return this.page.app;
    }
    hasApp() { return this.app instanceof App; }

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

    get icon() { return this.eTabIcon.getAttribute("name"); }
    set icon(v) {
        this.eTabIcon.removeAttribute("src");
        this.eTabIcon.setAttribute("name", v);
    }
    get iconSrc() { return this.eTabIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eTabIcon.removeAttribute("name");
        this.eTabIcon.setAttribute("src", v);
    }
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
            if (!["Backspace", "Delete"].includes(e.code)) return;
            if (this.eSearchInput.value.length > 0) return;
            this.searchPart = null;
        });
        this.eSearchInput.addEventListener("input", e => {
            this.change("query", null, this.eSearchInput.value);
            this.refresh();
        });
        this.eSearchClear.addEventListener("click", e => {
            this.searchPart = null;
        });

        this.addHandler("update", delta => {
            this.items.forEach(itm => itm.update(delta));
        });

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
                type: Panel.GraphTab,
                name: "graph",
                dname: "Graph", 
            },
            {
                type: Panel.TableTab,
                name: "table",
                dname: "Table", 
            },
            {
                type: Panel.Odometry2dTab,
                name: "odometry2d",
                dname: "Odometry2d",
            },
            {
                type: Panel.Odometry3dTab,
                name: "odometry3d",
                dname: "Odometry3d",
            },
            {
                type: Panel.WebViewTab,
                name: "webview",
                dname: "WebView",
            },
            {
                type: Panel.LoggerTab,
                name: "logger",
                dname: "PlexusLogger",
            },
            {
                type: Panel.LogWorksTab,
                name: "logworks",
                dname: "LogWorks",
            },
        ];
        toolItems = toolItems.map(item => {
            let display = getTabDisplay(item.name);
            let itm = new Panel.AddTab.Button(item.dname, "", "");
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
                    let index = this.parent.tabs.indexOf(this);
                    this.parent.addTab(new item.type(), index);
                    this.parent.remTab(this);
                },
            };
        });
        toolItems = toolItems.map(item => {
            if (item.init) item.init(item.item);
            item.item.addHandler("trigger", item.trigger);
            return item.item;
        });
        if (this.searchPart == null) {
            this.tags = [];
            this.placeholder = "Search tools, tables, and topics";
            if (this.query.length > 0) {
                toolItems = util.search(toolItems, ["name"], this.query);
                let fieldItems = [];
                if (this.hasPage() && this.page.hasSource()) {
                    let root = this.page.source.root;
                    const dfs = field => {
                        let itm = new Panel.AddTab.FieldButton(field);
                        fieldItems.push({
                            item: itm,
                            trigger: () => {
                                if (!this.hasParent()) return;
                                let index = this.parent.tabs.indexOf(this);
                                this.parent.addTab(new Panel.BrowserTab(field.path), index);
                                this.parent.remTab(this);
                            },
                        });
                        field.fields.forEach(field => dfs(field));
                    };
                    dfs(root);
                }
                fieldItems = fieldItems.map(item => {
                    if (item.init) item.init(item.item);
                    item.item.addHandler("trigger", item.trigger);
                    return item.item;
                });
                fieldItems = util.search(fieldItems, ["field.textPath", "field.type"], this.query);
                this.items = [
                    new Panel.AddTab.Header("Tools"),
                    ...toolItems,
                    new Panel.AddTab.Header("Tables and Topics"),
                    ...fieldItems,
                ];
            } else {
                this.items = [
                    new Panel.AddTab.Button("Tables", "folder-outline", "", true),
                    new Panel.AddTab.Button("Topics", "document-outline", "", true),
                    new Panel.AddTab.Button("All", "", "", true),
                    new Panel.AddTab.Divider(),
                    new Panel.AddTab.Header("Tools"),
                    new Panel.AddTab.Button("Tools", "cube-outline", "", true),
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
            this.tags = [new Panel.AddTab.Tag("Tools", "cube-outline")];
            this.placeholder = "Search tools";
            toolItems = util.search(toolItems, ["name"], this.query);
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
                let root = this.page.source.root;
                const dfs = field => {
                    let itm = new Panel.AddTab.FieldButton(field);
                    if ({
                        tables: !field.hasType(),
                        topics: field.hasType(),
                        all: true,
                    }[this.searchPart])
                        items.push({
                            item: itm,
                            trigger: () => {
                                if (!this.hasParent()) return;
                                let index = this.parent.tabs.indexOf(this);
                                this.parent.addTab(new Panel.BrowserTab(field.path), index);
                                this.parent.remTab(this);
                            },
                        });
                    field.fields.forEach(field => dfs(field));
                };
                dfs(root);
            }
            items = items.map(item => {
                if (item.init) item.init(item.item);
                item.item.addHandler("trigger", item.trigger);
                return item.item;
            });
            items = util.search(items, ["field.textPath", "field.type"], this.query);
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
        v.forEach(v => this.addTag(v));
    }
    clearTags() {
        let tags = this.tags;
        tags.forEach(tag => this.remTag(tag));
        return tags;
    }
    hasTag(tag) {
        if (!(tag instanceof Panel.AddTab.Tag)) return false;
        return this.#tags.includes(tag);
    }
    addTag(tag) {
        if (!(tag instanceof Panel.AddTab.Tag)) return false;
        if (this.hasTag(tag)) return false;
        this.#tags.push(tag);
        this.eSearchTags.appendChild(tag.elem);
        return tag;
    }
    remTag(tag) {
        if (!(tag instanceof Panel.AddTab.Tag)) return false;
        if (!this.hasTag(tag)) return false;
        this.#tags.splice(this.#tags.indexOf(tag), 1);
        this.eSearchTags.removeChild(tag.elem);
        return tag;
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
        if (!(itm instanceof Panel.AddTab.Item)) return false;
        return this.#items.includes(itm);
    }
    addItem(itm) {
        if (!(itm instanceof Panel.AddTab.Item)) return false;
        if (this.hasItem(itm)) return false;
        this.#items.push(itm);
        this.eContent.appendChild(itm.elem);
        return itm;
    }
    remItem(itm) {
        if (!(itm instanceof Panel.AddTab.Item)) return false;
        if (!this.hasItem(itm)) return false;
        this.#items.splice(this.#items.indexOf(itm), 1);
        this.eContent.removeChild(itm.elem);
        return itm;
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
        chevron.setAttribute("name", "chevron-forward");

        this.name = name;
        this.icon = icon;
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }
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
    #btn;
    #eIcon;
    #eName;
    #eInfo;
    #eChevron;

    constructor(name, icon="", color="", hasChevron=false) {
        super();

        this.elem.classList.add("item");
        
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
        this.eChevron.setAttribute("name", "chevron-forward");

        this.btn.addEventListener("click", e => this.post("trigger", e));

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

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }

    get info() { return this.eInfo.textContent; }
    set info(v) { this.eInfo.textContent = v; }

    get hasChevron() { return this.elem.contains(this.eChevron); }
    set hasChevron(v) {
        v = !!v;
        if (v == this.hasChevron) return;
        if (v) this.btn.appendChild(this.eChevron);
        else this.btn.removeChild(this.eChevron);
    }
};
Panel.AddTab.FieldButton = class PanelAddTabFieldButton extends Panel.AddTab.Button {
    #field;

    constructor(field) {
        super();

        this.elem.classList.remove("item");
        this.elem.classList.add("browserfield");
        this.btn.classList.add("display");
        let children = Array.from(this.btn.children);
        children.forEach(child => this.btn.removeChild(child));
        this.btn.innerHTML = "<div class='main'></div>";
        children.forEach(child => this.btn.children[0].appendChild(child));
        this.eInfo.classList.add("tag");

        this.addHandler("update", delta => {
            if (!this.hasField()) {
                this.icon = "document-outline";
                this.name = "?";
                return;
            }
            this.name = this.field.textPath;
            if (this.name.length <= 0) this.name = "/";
            let display = getDisplay(this.field.type, this.hasField() ? this.field.get() : null);
            if (display != null) {
                if ("src" in display) this.iconSrc = display.src;
                else this.icon = display.name;
                if ("color" in display) this.iconColor = display.color;
                else this.iconColor = "";
            }
            this.info = util.ensure(this.field.clippedType, "str");
        });

        this.field = field;
    }

    get field() { return this.#field; }
    set field(v) {
        v = (v instanceof Source.Field) ? v : null;
        if (this.field == v) return;
        this.#field = v;
    }
    hasField() { return this.field instanceof Source.Field; }
};
Panel.BrowserTab = class PanelBrowserTab extends Panel.Tab {
    #path;

    #ePath;
    #eBrowser;
    #eDisplay;

    constructor(...a) {
        super();

        this.elem.classList.add("browser_");

        this.#path = [null];

        this.#ePath = document.createElement("div");
        this.elem.appendChild(this.ePath);
        this.ePath.classList.add("path");
        this.#eBrowser = document.createElement("div");
        this.elem.appendChild(this.eBrowser);
        this.eBrowser.classList.add("browser");
        this.#eDisplay = document.createElement("div");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");

        if (a.length <= 0 || a.length > 1) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.BrowserTab) a = [a.path];
            else if (util.is(a, "arr")) {
                if (util.is(a[0], "str")) a = [a];
                else {
                    a = new Panel.BrowserTab(...a);
                    a = [a.path];
                }
            }
            else if (util.is(a, "obj")) a = [a.path];
            else a = [a];
        }

        [this.path] = a;

        let prevField = null;
        let state = {};

        this.addHandler("format", () => {
            util.ensure(state.fields, "arr").forEach(field => field.format());
        });
        this.addHandler("update", delta => {
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            const field = (source instanceof Source) ? source.root.lookup(this.path) : null;
            if (prevField != field) {
                prevField = field;
                state = {};
            }
            this.eTabIcon.style.color = "";
            this.eTabName.style.color = "";
            this.iconColor = "";
            let display = getDisplay((field instanceof Source.Field) ? field.type : null, (field instanceof Source.Field) ? field.get() : null);
            if (display != null) {
                if ("src" in display) this.iconSrc = display.src;
                else this.icon = display.name;
                if ("color" in display) this.eTabIcon.style.color = display.color;
                else this.eTabIcon.style.color = "";
            }
            this.name = (field instanceof Source.Field) ? (field.name.length > 0) ? field.name : "/" : "?";
            if ((field instanceof Source.Field) && (!field.hasType() || field.isArray || field.isStruct || field.nFields > 1)) {
                this.eBrowser.classList.add("this");
                this.eDisplay.classList.remove("this");
                if (this.isClosed) return;
                if (!("fields" in state)) {
                    state.fields = [];
                    this.eBrowser.innerHTML = "";
                }
                BrowserField.doubleTraverse(
                    field.fields,
                    state.fields,
                    (...bfields) => {
                        bfields.forEach(bfield => {
                            state.fields.push(bfield);
                            const onTrigger = (e, path) => {
                                this.path = [...this.path, ...util.ensure(path, "arr")];
                            };
                            const onDrag = path => {
                                path = [...this.path, ...util.ensure(path, "arr")];
                                if (!this.hasApp() || !this.hasPage()) return;
                                this.app.dragData = this.page.hasSource() ? this.page.source.root.lookup(path) : null;
                                this.app.dragging = true;
                            };
                            bfield.addLinkedHandler(this, "trigger", onTrigger);
                            bfield.addLinkedHandler(this, "drag", onDrag);
                            this.eBrowser.appendChild(bfield.elem);
                        });
                        state.fields.sort((a, b) => compare(a.name, b.name)).forEach((field, i) => {
                            field.elem.style.order = i;
                            field.format();
                        });
                    },
                    (...bfields) => {
                        bfields.forEach(bfield => {
                            state.fields.splice(state.fields.indexOf(bfield), 1);
                            bfield.clearLinkedHandlers(this, "trigger");
                            bfield.clearLinkedHandlers(this, "drag");
                            this.eBrowser.removeChild(bfield.elem);
                        });
                    },
                );
            } else if (field instanceof Source.Field) {
                this.eBrowser.classList.remove("this");
                this.eDisplay.classList.add("this");
                let value = field.get();
                if (this.isClosed) return;
                if (state.type != field.type) {
                    state.type = field.type;
                    this.eDisplay.innerHTML = "";
                    let item = document.createElement("div");
                    this.eDisplay.appendChild(item);
                    item.classList.add("item");
                    let eIcon = null, eType = null, eValue = null;
                    if (field.type == "boolean") {
                        item.innerHTML = "<ion-icon></ion-icon>";
                        eIcon = item.children[0];
                    } else {
                        item.innerHTML = "<div class='type'></div><div class='value'></div>";
                        eType = item.children[0];
                        eValue = item.children[1];
                    }
                    state.update = () => {
                        let value = field.get();
                        if (field.type == "boolean") {
                            item.style.backgroundColor = value ? "var(--cg3)" : "var(--cr3)";
                            eIcon.setAttribute("name", value ? "checkmark" : "close");
                            let r = item.getBoundingClientRect();
                            eIcon.style.fontSize = Math.max(16, Math.min(64, r.width-40, r.height-40))+"px";
                        } else {
                            eType.textContent = field.type;
                            let display = getDisplay(field.type, value);
                            eValue.style.color = (display == null || !("color" in display)) ? "" : display.color;
                            eValue.style.fontSize = (["double", "float", "int"].includes(field.arrayType) ? 32 : 16)+"px";
                            eValue.textContent = getRepresentation(value);
                        }
                    };
                }
                if (state.update) state.update();
            } else {
                this.eBrowser.classList.remove("this");
                this.eDisplay.classList.remove("this");
                this.icon = "document-outline";
                this.name = (this.path.length > 0) ? this.path.at(-1) : "/";
                this.eTabName.style.color = "var(--cr)";
                this.iconColor = "var(--cr)";
            }
        });
    }

    get path() { return [...this.#path]; }
    set path(v) {
        v = util.ensure(v, "arr");
        if (util.arrEquals(v, this.path)) return;
        this.change("path", this.path, [...(this.#path=v)]);
        this.#path = v;
        this.ePath.innerHTML = "";
        let path = this.path;
        if (path.length > 0) {
            let btn = document.createElement("button");
            this.ePath.appendChild(btn);
            btn.classList.add("back");
            btn.classList.add("icon");
            btn.innerHTML = "<ion-icon name='chevron-back'></ion-icon>";
            btn.addEventListener("click", e => {
                path.pop();
                this.path = path;
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
            btn.addEventListener("click", e => (this.path = pth));
        }
    }

    get ePath() { return this.#ePath; }
    get eBrowser() { return this.#eBrowser; }
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

    #eHeader;
    #eOptions;
    #eTSInput;
    #eFollowBtn;
    #eBody;

    constructor(...a) {
        super("Table", "table");

        this.elem.classList.add("table");

        this.#vars = [];
        this.#ts = [];
        this.#tsNow = 0;

        this.#eHeader = document.createElement("div");
        this.elem.appendChild(this.eHeader);
        this.eHeader.classList.add("header");
        this.#eOptions = document.createElement("div");
        this.eHeader.appendChild(this.eOptions);
        this.eOptions.classList.add("options");
        this.#eTSInput = document.createElement("input");
        this.eOptions.appendChild(this.eTSInput);
        this.eTSInput.type = "number";
        this.eTSInput.placeholder = "Timestamp...";
        this.eTSInput.step = 0.01;
        this.#eFollowBtn = document.createElement("button");
        this.eOptions.appendChild(this.eFollowBtn);
        this.eFollowBtn.innerHTML = "<ion-icon src='../assets/icons/jump.svg'></ion-icon>";
        this.#eBody = document.createElement("div");
        this.elem.appendChild(this.eBody);
        this.eBody.classList.add("body");

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

        this.elem.addEventListener("scroll", e => this.format());
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
            this.tsOverride = !this.tsOverride;
        });
        this.eBody.addEventListener("scroll", e => this.format());

        let rows = [
            {
                elem: this.eOptions,
                x: 0,
            },
        ];
        this.addHandler("format", () => {
            let er = this.elem.getBoundingClientRect();
            let br = this.eBody.getBoundingClientRect();
            rows.forEach(row => {
                let rr = row.elem.getBoundingClientRect();
                let shift = er.left-rr.left;
                row.x = Math.max(0, Math.min(br.width-rr.width, row.x+shift));
                row.elem.style.transform = "translateX("+row.x+"px)";
            });
            this.vars.forEach(v => v.format());
        });
        this.addHandler("update", delta => {
            if (!this.tsOverride) this.eFollowBtn.classList.add("this");
            else this.eFollowBtn.classList.remove("this");
            let columns = ["150px", ...new Array(this.vars.length).fill("250px")];
            this.eHeader.style.gridTemplateColumns = this.eBody.style.gridTemplateColumns = columns.join(" ");
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            if (!this.tsOverride) this.tsNow = (source instanceof Source) ? source.ts : 0;
            if (document.activeElement != this.eTSInput)
                this.eTSInput.value = this.tsNow;
            let ts = new Set();
            this.vars.forEach((v, i) => {
                let field = v.field = (source instanceof Source) ? source.root.lookup(v.path) : null;
                v.x = i+1;
                if (!v.hasField()) return;
                let valueLog = field.valueLog;
                valueLog = valueLog.filter((log, i) => {
                    if (i <= 0) return true;
                    return log.v != valueLog[i-1].v;
                });
                valueLog.forEach(log => ts.add(log.ts));
            });
            this.#ts = ts = [...ts].sort((a, b) => a-b);
            this.eBody.style.gridTemplateRows = "repeat("+ts.length+", auto)";
            this.vars.forEach(v => v.update(delta));
            let doFormat = false;
            while (rows.length-1 < ts.length) {
                let row = {};
                row.elem = document.createElement("div");
                this.eBody.appendChild(row.elem);
                row.elem.classList.add("item");
                rows.push(row);
                row.x = 0;
                doFormat = true;
            }
            while (rows.length-1 > ts.length) {
                let row = rows.pop();
                this.eBody.removeChild(row.elem);
                doFormat = true;
            }
            this.format();
            for (let i = 0; i < ts.length; i++) {
                let row = rows[i+1];
                row.elem.style.gridRow = (i+1) + "/" + (i+2);
                row.elem.textContent = ts[i];
                if (
                    this.tsNow >= ts[i] &&
                    this.tsNow < ((i+1 >= ts.length) ? Infinity : ts[i+1])
                ) {
                    if (!row.elem.classList.contains("this"))
                        row.elem.scrollIntoView();
                    row.elem.classList.add("this");
                } else row.elem.classList.remove("this");
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
        this.eHeader.appendChild(v.eHeader);
        v.addLinkedHandler(this, "remove", () => this.remVar(v));
        v.addLinkedHandler(this, "change", (c, f, t) => this.change("vars["+this.vars.indexOf(v)+"]."+c, f, t));
        v.addLinkedHandler(this, "drag", () => {
            if (!this.hasPage() || !this.page.hasSource() || !this.hasApp()) return;
            this.app.dragData = this.page.source.root.lookup(v.path);
            this.app.dragging = true;
            v.post("remove");
        });
        this.change("addVar", null, v);
        return v;
    }
    addVar(v) { return this.insertVar(v, this.vars.length); }
    remVar(v) {
        if (!(v instanceof Panel.TableTab.Variable)) return false;
        if (v.tab != this) return false;
        if (!this.hasVar(v)) return false;
        this.#vars.splice(this.#vars.indexOf(v), 1);
        v.tab = null;
        this.eHeader.removeChild(v.eHeader);
        v.eSections.forEach(elem => this.eBody.removeChild(elem));
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
    }
    get tsOverride() { return this.#tsOverride; }
    set tsOverride(v) {
        v = !!v;
        if (this.tsOverride == v) return;
        this.change("tsOverride", this.tsOverride, this.#tsOverride=v);
    }

    get eHeader() { return this.#eHeader; }
    get eOptions() { return this.#eOptions; }
    get eTSInput() { return this.#eTSInput; }
    get eFollowBtn() { return this.#eFollowBtn; }
    get eBody() { return this.#eBody; }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        let r;
        r = this.elem.getBoundingClientRect();
        if (pos.x < r.left || pos.x > r.right) return null;
        if (pos.y < r.top || pos.y > r.bottom) return null;
        if (data instanceof Panel.BrowserTab) data = (this.hasPage() && this.page.hasSource()) ? this.page.source.root.lookup(data.path) : null;
        if (!(data instanceof Source.Field)) return null;
        if (!data.hasType()) return null;
        let y = r.top, h = r.height;
        let at = 0;
        const addVar = field => {
            let pth = field.path;
            if (field.hasType() && field.isJustPrimitive) {
                this.insertVar(new Panel.TableTab.Variable(pth), at);
                at++;
            }
            field.fields.forEach(field => addVar(field));
        };
        let vars = this.vars;
        for (let i = 0; i <= vars.length; i++) {
            if (i <= 0) {
                r = vars.at(0).eHeader.getBoundingClientRect();
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
                r = vars.at(-1).eHeader.getBoundingClientRect();
                if (pos.x >= r.left+r.width/2) return {
                    r: [[r.right, y], [0, h]],
                    submit: () => {
                        at = i;
                        addVar(data);
                    },
                };
                continue;
            }
            let rj = vars[i-1].eHeader.getBoundingClientRect(), ri = vars[i].eHeader.getBoundingClientRect();
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
        r = this.eOptions.getBoundingClientRect();
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

    #field;

    #x;

    #eHeader;
    #eSections;

    constructor(...a) {
        super();

        this.#tab = null;

        this.#path = [];

        this.#field = null;

        this.#x = 0;

        this.#eHeader = document.createElement("div");
        this.eHeader.classList.add("item");

        this.eHeader.addEventListener("mousedown", e => {
            e.preventDefault();
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
                if (util.is(a[0], "str")) a = [a];
                else a = [new Panel.GraphTab.Variable(...a).path];
            }
            else if (util.is(a, "obj")) a = [a.path];
            else a = [[]];
        }

        [this.path] = a;

        let sections = [];
        this.addHandler("format", () => {
            let r = this.tab.eBody.getBoundingClientRect();
            sections.forEach(section => {
                if (!(section.children[0] instanceof HTMLDivElement)) return;
                let sr = section.getBoundingClientRect();
                let scr = section.children[0].getBoundingClientRect();
                let shift = Math.min(sr.height-scr.height-2, Math.max(0, r.top-sr.top));
                section.children[0].style.marginTop = shift+"px";
            });
        });
        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            let valueLog = (this.hasField() && this.field.hasType() && this.field.isJustPrimitive) ? this.field.valueLog : [];
            valueLog = valueLog.filter((log, i) => {
                if (i <= 0) return true;
                return log.v != valueLog[i-1].v;
            });
            while (sections.length < valueLog.length) {
                let section = document.createElement("div");
                this.tab.eBody.appendChild(section);
                section.classList.add("section");
                let content = document.createElement("div");
                section.appendChild(content);
                let line = document.createElement("div");
                section.appendChild(line);
                line.classList.add("line");
                sections.push(section);
            }
            while (sections.length > valueLog.length) {
                let section = sections.shift();
                this.tab.eBody.removeChild(section);
            }
            for (let i = 0; i < valueLog.length; i++) {
                let section = sections[i];
                let j1 = this.tab.lookupTS(valueLog[i].ts);
                let j2 = (i+1 >= valueLog.length) ? this.tab.ts.length : this.tab.lookupTS(valueLog[i+1].ts);
                let j3 = this.tab.lookupTS(this.tab.tsNow);
                if (
                    this.tab.tsNow >= valueLog[i].ts &&
                    this.tab.tsNow < ((i+1 >= valueLog.length) ? Infinity : valueLog[i+1].ts)
                ) section.classList.add("this");
                else section.classList.remove("this");
                section.style.gridColumn = (this.x+1) + "/" + (this.x+2);
                section.style.gridRow = (j1+1) + "/" + (j2+1);
                if (section.children[0] instanceof HTMLDivElement)
                    section.children[0].textContent = valueLog[i].v;
                if (section.children[1] instanceof HTMLDivElement) {
                    section.children[1].style.top = (30*Math.min(j2-j1, Math.max(0, j3-j1)) - 2)+"px";
                    section.children[1].textContent = valueLog[i].v;
                }
            }
            this.#eSections = sections;
        });
    }

    get tab() { return this.#tab; }
    set tab(v) {
        v = (v instanceof Panel.TableTab) ? v : null;
        if (this.tab == v) return;
        this.#tab = v;
    }
    hasTab() { return this.tab instanceof Panel.TableTab; }

    get path() { return [...this.#path]; }
    set path(v) {
        v = util.ensure(v, "arr");
        if (util.arrEquals(v, this.path)) return;
        this.change("path", this.path, [...(this.#path=v)]);
        this.eHeader.innerHTML = "";
        let name = document.createElement("div");
        this.eHeader.appendChild(name);
        name.textContent = (this.path.length > 0) ? this.path.at(-1) : "/";
        let tooltip = document.createElement("div");
        this.eHeader.appendChild(tooltip);
        tooltip.classList.add("tooltip");
        tooltip.classList.add("hov");
        tooltip.classList.add("swx");
        tooltip.textContent = "/"+this.path.join("/");
        let removeBtn = document.createElement("button");
        this.eHeader.appendChild(removeBtn);
        removeBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        removeBtn.addEventListener("click", e => this.post("remove"));
        removeBtn.addEventListener("mousedown", e => e.stopPropagation());
    }

    get field() { return this.#field; }
    set field(v) {
        v = (v instanceof Source.Field) ? v : null;
        if (this.field == v) return;
        this.#field = v;
    }
    hasField() { return this.field instanceof Source.Field; }

    get eHeader() { return this.#eHeader; }
    get eSections() { return [...this.#eSections]; }
    get x() { return this.#x; }
    set x(v) {
        v = util.ensure(v, "int");
        if (this.x == v) return;
        this.#x = v;
        this.eHeader.style.gridColumn = (this.x+1) + "/" + (this.x+2);
    }

    format() { this.post("format"); }
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
            if (!ready) return;
            this.eWebView.goBack();
        });
        this.eForwardBtn.addEventListener("click", e => {
            if (!ready) return;
            this.eWebView.goForward();
        });
        this.eLoadBtn.addEventListener("click", e => {
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
            if (document.activeElement != this.eSrcInput)
                this.eSrcInput.value = this.eWebView.getURL();
            if (this.eLoadBtn.children[0] instanceof HTMLElement)
                this.eLoadBtn.children[0].setAttribute("name", this.eWebView.isLoading() ? "close" : "refresh");
            this.eBackBtn.disabled = !this.eWebView.canGoBack();
            this.eForwardBtn.disabled = !this.eWebView.canGoForward();
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
        super("PlexusLogger", "logger");

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
        this.eUploadBtn.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.#eLogs = document.createElement("div");
        this.elem.appendChild(this.eLogs);
        this.eLogs.classList.add("logs");

        this.eUploadBtn.addEventListener("click", async e => {
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
            this.logs.sort((a, b) => compare(a.name, b.name)).forEach((log, i) => {
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
                    this.app.error("Log Download Error: "+name, e);
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
            this.app.post("cmd-conndisconn");
        });
        let selected = new Set(), lastSelected = null, lastAction = null;
        this.addHandler("log-trigger", (e, name, shift) => {
            name = String(name);
            shift = !!shift;
            if (!LOGGERCONTEXT.hasLog(name)) return;
            if (shift && LOGGERCONTEXT.hasLog(lastSelected)) {
                let logs = LOGGERCONTEXT.logs.sort(compare);
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
            let pop = this.app.confirm();
            pop.eContent.innerText = "Are you sure you want to delete these logs from the server?\nThis will remove the logs for everyone";
            pop.hasInfo = true;
            pop.info = names.join("\n");
            let result = await pop.whenResult();
            if (!result) return;
            try {
                await LOGGERCONTEXT.logsServerDelete(names);
            } catch (e) {
                if (this.hasApp())
                    this.app.error("Log Delete Error: "+names.join(", "), e);
            }
        });

        this.eLogs.addEventListener("click", e => {
            selected.clear();
            lastSelected = null;
            lastAction = null;
        });
        this.eLogs.addEventListener("contextmenu", contextMenu);

        let logObjects = {};

        this.addHandler("update", delta => {
            if (this.isClosed) return;

            this.eUploadBtn.disabled = LOGGERCONTEXT.disconnected;

            this.status = LOGGERCONTEXT.initializing ? "Initializing client" : LOGGERCONTEXT.disconnected ? ("Connecting - "+LOGGERCONTEXT.location) : LOGGERCONTEXT.location;
            if (LOGGERCONTEXT.connected) {
                eIcon.setAttribute("name", "cloud");
                this.eStatus.setAttribute("href", LOGGERCONTEXT.location);
            } else {
                eIcon.setAttribute("name", "cloud-offline");
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
        v.forEach(v => this.addLog(v));
    }
    clearLogs() {
        let logs = this.logs;
        logs.forEach(log => this.remLog(log));
        return logs;
    }
    hasLog(log) {
        if (!(log instanceof Panel.LoggerTab.Log)) return false;
        return this.#logs.has(log);
    }
    addLog(log) {
        if (!(log instanceof Panel.LoggerTab.Log)) return false;
        if (this.hasLog(log)) return false;
        this.#logs.add(log);
        log.addLinkedHandler(this, "download", () => this.post("log-download", log.name));
        log.addLinkedHandler(this, "trigger", e => this.post("log-trigger", e, log.name, !!(util.ensure(e, "obj").shiftKey)));
        log.addLinkedHandler(this, "trigger2", e => this.post("log-trigger2", e, log.name));
        log.addLinkedHandler(this, "contextmenu", e => this.post("log-contextmenu", e, log.name));
        this.eLogs.appendChild(log.elem);
        this.format();
        return log;
    }
    remLog(log) {
        if (!(log instanceof Panel.LoggerTab.Log)) return false;
        if (!this.hasLog(log)) return false;
        this.#logs.delete(log);
        log.clearLinkedHandlers(this, "download");
        log.clearLinkedHandlers(this, "trigger");
        log.clearLinkedHandlers(this, "trigger2");
        log.clearLinkedHandlers(this, "contextmenu");
        this.eLogs.removeChild(log.elem);
        return log;
    }

    get loading() { return this.elem.classList.contains("loading_"); }
    set loading(v) {
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
        if (v) this.elem.classList.add("downloaded");
        else this.elem.classList.remove("downloaded");
        this.eUseBtn.style.display = v ? "" : "none";
    }
    get deprecated() { return this.elem.classList.contains("deprecated"); }
    set deprecated(v) {
        if (v) this.elem.classList.add("deprecated");
        else this.elem.classList.remove("deprecated");
        this.eDownloadBtn.style.display = v ? "none" : "";
    }
    get loading() { return this.elem.classList.contains("loading_"); }
    set loading(v) {
        if (v) this.elem.classList.add("loading_");
        else this.elem.classList.remove("loading_");
        Array.from(this.eNav.querySelectorAll(":scope > button")).forEach(btn => (btn.disabled = v));
    }
    get selected() { return this.elem.classList.contains("selected"); }
    set selected(v) {
        if (v) this.elem.classList.add("selected");
        else this.elem.classList.remove("selected");
    }
};
Panel.LogWorksTab = class PanelLogWorksTab extends Panel.ToolTab {
    constructor() {
        super("LogWorks", "logworks");
    }
};
Panel.ToolCanvasTab = class PanelToolCanvasTab extends Panel.ToolTab {
    #quality;

    #eOpen;
    #eOptions;
    #eOptionSections;
    #eContent;
    #canvas; #ctx;
    #eNav;
    #eSubNav;

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
        if (this.constructor.CREATECTX) this.#ctx = this.canvas.getContext("2d");
        this.#eNav = document.createElement("div");
        this.eContent.appendChild(this.eNav);
        this.eNav.classList.add("nav");
        this.#eSubNav = document.createElement("div");
        this.eNav.appendChild(this.eSubNav);
        this.eSubNav.classList.add("nav");
        this.#eOpen = document.createElement("div");
        this.elem.appendChild(this.eOpen);
        this.eOpen.classList.add("open");
        this.#eOptions = document.createElement("div");
        this.elem.appendChild(this.eOptions);
        this.eOptions.classList.add("options");
        this.#eOptionSections = {};

        let cancel = 10;
        this.eOpen.addEventListener("click", e => {
            if (cancel <= 0) return cancel = 10;
            this.optionState = (this.optionState == 0) ? 0.5 : 0;
        });
        this.eOpen.addEventListener("mousedown", e => {
            e.preventDefault();
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
            x *= 2;
            x++;
            x %= 3;
            x /= 2;
            this.optionState = x;
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
        this.#quality = v;
    }

    get eContent() { return this.#eContent; }
    get eNav() { return this.#eNav; }
    get eSubNav() { return this.#eSubNav; }
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

    #ePlayPauseBtn;
    #eSkipBackBtn;
    #eSkipForwardBtn;

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
                    this.addHandler("update", delta => {
                        if (this.lVars.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    });
                },
                r: () => {
                    elem.classList.add("list");
                    this.addHandler("update", delta => {
                        if (this.rVars.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    });
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
                                this.change("viewParams.time", null, this.viewParams.time=5000);
                                input.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(input.value), "num"));
                                    this.change("viewParams.time", this.viewParams.time, this.viewParams.time=v);
                                });
                                this.addHandler("update", delta => {
                                    if (document.activeElement == input) return;
                                    input.value = this.viewParams.time;
                                });
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
                                this.change("viewParams.time", null, this.viewParams.time=5000);
                                input.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(input.value), "num"));
                                    this.change("viewParams.time", this.viewParams.time, this.viewParams.time=v);
                                });
                                this.addHandler("update", delta => {
                                    if (document.activeElement == input) return;
                                    input.value = this.viewParams.time;
                                });
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
                                this.change("viewParams.start", null, this.viewParams.start=0);
                                this.change("viewParams.stop", null, this.viewParams.stop=5000);
                                startInput.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(startInput.value), "num"));
                                    this.change("viewParams.start", this.viewParams.start, this.viewParams.start=v);
                                });
                                stopInput.addEventListener("change", e => {
                                    let v = Math.max(0, util.ensure(parseFloat(stopInput.value), "num"));
                                    this.change("viewParams.stop", this.viewParams.stop, this.viewParams.stop=v);
                                });
                                this.addHandler("update", delta => {
                                    if (document.activeElement != startInput) startInput.value = this.viewParams.start;
                                    if (document.activeElement != stopInput) stopInput.value = this.viewParams.stop;
                                });
                            },
                        };
                        if (mode in modefs) modefs[mode]();
                    });
                    this.addHandler("update", delta => {
                        for (let mode in eNavButtons) {
                            if (mode == this.viewMode) eNavButtons[mode].classList.add("this");
                            else eNavButtons[mode].classList.remove("this");
                            eForModes[mode].forEach(elem => {
                                elem.style.display = (mode == this.viewMode) ? "" : "none";
                            });
                        }
                    });
                },
            };
            if (id in idfs) idfs[id]();
        });

        this.#ePlayPauseBtn = document.createElement("button");
        this.eSubNav.appendChild(this.ePlayPauseBtn);
        this.ePlayPauseBtn.innerHTML = "<ion-icon></ion-icon>";
        this.ePlayPauseBtn.addEventListener("click", e => {
            if (!this.hasPage()) return;
            if (!this.page.hasSource()) return;
            this.page.source.playback.paused = !this.page.source.playback.paused;
        });
        this.#eSkipBackBtn = document.createElement("button");
        this.eSubNav.appendChild(this.eSkipBackBtn);
        this.eSkipBackBtn.innerHTML = "<ion-icon name='play-skip-back'></ion-icon>";
        this.eSkipBackBtn.addEventListener("click", e => {
            if (!this.hasPage()) return;
            if (!this.page.hasSource()) return;
            this.page.source.ts = this.page.source.tsMin;
        });
        this.#eSkipForwardBtn = document.createElement("button");
        this.eSubNav.appendChild(this.eSkipForwardBtn);
        this.eSkipForwardBtn.innerHTML = "<ion-icon name='play-skip-forward'></ion-icon>";
        this.eSkipForwardBtn.addEventListener("click", e => {
            if (!this.hasPage()) return;
            if (!this.page.hasSource()) return;
            this.page.source.ts = this.page.source.tsMax;
        });

        const quality = this.quality = 3;
        const padding = 40;

        let mouseX = 0, mouseY = 0, mouseDown = false;
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
        this.canvas.addEventListener("mousedown", e => (mouseDown = true));
        this.canvas.addEventListener("mouseup", e => (mouseDown = false));
        let scrollX = 0, scrollY = 0;
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
            tooltipCycle++;
        };
        this.addHandler("add", () => document.body.addEventListener("keydown", onKeyDown));
        this.addHandler("rem", () => document.body.removeEventListener("keydown", onKeyDown));
        this.addHandler("update", delta => {
            if (this.isClosed) return;

            let paused = true;
            if (this.hasPage() && this.page.hasSource())
                paused = this.page.source.playback.paused;
            if (this.ePlayPauseBtn.children[0] instanceof HTMLElement)
                this.ePlayPauseBtn.children[0].setAttribute("name", paused ? "play" : "pause");
            
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
                let logs = {}, fields = {};
                vars.forEach(v => {
                    if (!v.isShown) return;
                    let field = source.root.lookup(v.path);
                    if (!(field instanceof Source.Field)) return;
                    if (!field.isJustPrimitive) return;
                    let log = field.getRange(...graphRange);
                    if (!util.is(log, "arr")) return;
                    let start = field.get(graphRange[0]), stop = field.get(graphRange[1]);
                    if (start != null) log.unshift({ ts: graphRange[0], v: start });
                    if (stop != null) log.push({ ts: graphRange[1], v: stop });
                    if (log.length <= 0) return;
                    logs[v.path] = log;
                    fields[v.path] = field;
                    if (!["double", "float", "int"].includes(field.type)) return;
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
                o.fields = fields;
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
            let y0 = padding*quality;
            let y1 = ctx.canvas.height - padding*quality;
            let y2 = ctx.canvas.height - (padding-5)*quality;
            let y3 = ctx.canvas.height - (padding-10)*quality;
            ctx.lineWidth = 2*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--v4");
            ctx.font = (12*quality)+"px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            for (let i = Math.ceil(graphRange[0]/timeStep); i <= Math.floor(graphRange[1]/timeStep); i++) {
                let x = (i*timeStep - graphRange[0]) / (graphRange[1]-graphRange[0]);
                x = util.lerp(padding*quality, ctx.canvas.width - padding*quality, x);
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v4");
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
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v2");
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, y1);
                ctx.stroke();
            }
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v2");
            for (let i = 0; i <= maxNSteps; i++) {
                let y = i / maxNSteps;
                y = util.lerp(padding*quality, ctx.canvas.height-padding*quality, 1-y);
                ctx.beginPath();
                ctx.moveTo(padding*quality, y);
                ctx.lineTo(ctx.canvas.width-padding*quality, y);
                ctx.stroke();
            }
            let mouseXCanv = util.lerp(padding*quality, ctx.canvas.width-padding*quality, mouseX);
            let mouseYCanv = util.lerp(padding*quality, ctx.canvas.height-padding*quality, mouseY);
            let foundTooltips = [];
            let nDiscrete = 0;
            graphVars.forEach((o, i) => {
                let vars = o.vars;
                let range = o.range;
                let step = o.step;
                let logs = o.logs;
                let fields = o.fields;
                let x1 = [padding*quality, ctx.canvas.width-padding*quality][i];
                let x2 = [(padding-5)*quality, ctx.canvas.width-(padding-5)*quality][i];
                let x3 = [(padding-10)*quality, ctx.canvas.width-(padding-10)*quality][i];
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v4");
                ctx.lineWidth = 2*quality;
                ctx.lineJoin = "miter";
                ctx.lineCap = "square";
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--v4");
                ctx.font = (12*quality)+"px monospace";
                ctx.textAlign = ["right", "left"][i];
                ctx.textBaseline = "middle";
                for (let j = range[0]; j <= range[1]; j++) {
                    let y = (j-range[0]) / (range[1]-range[0]);
                    y = util.lerp(padding*quality, ctx.canvas.height-padding*quality, 1-y);
                    ctx.beginPath();
                    ctx.moveTo(x1, y);
                    ctx.lineTo(x2, y);
                    ctx.stroke();
                    ctx.fillText(j*step, x3, y);
                }
                vars.forEach(v => {
                    if (!(v.path in logs)) return;
                    if (!(v.path in fields)) return;
                    let log = logs[v.path];
                    let field = fields[v.path];
                    if (!["double", "float", "int"].includes(field.type)) {
                        log = log.filter((p, i) => {
                            if (i <= 0) return true;
                            return p.v != log[i-1].v;
                        });
                        log.forEach((p, i) => {
                            let pts = p.ts, pv = p.v;
                            let npts = (i+1 >= log.length) ? graphRange[1] : log[i+1].ts;
                            let x = util.lerp(padding*quality, ctx.canvas.width-padding*quality, (pts-graphRange[0])/(graphRange[1]-graphRange[0]));
                            let nx = util.lerp(padding*quality, ctx.canvas.width-padding*quality, (npts-graphRange[0])/(graphRange[1]-graphRange[0]));
                            ctx.fillStyle = v.hasColor() ? v.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(v.color+(i%2==0?"2":"")) : v.color : "#fff";
                            ctx.fillRect(
                                x, (padding+10+20*nDiscrete)*quality,
                                Math.max(0, nx-x), 15*quality,
                            );
                            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--v"+(i%2==0?"8":"1"));
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
                        let x = util.lerp(padding*quality, ctx.canvas.width-padding*quality, (ts-graphRange[0])/(graphRange[1]-graphRange[0]));
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
                    ctx.strokeStyle = v.hasColor() ? v.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(v.color) : v.color : "#fff";
                    ctx.lineWidth = 2*quality;
                    ctx.lineJoin = "round";
                    ctx.lineCap = "square";
                    ctx.beginPath();
                    let py = null;
                    ranges.forEach((p, i) => {
                        let x = p.x, r = p.r, v = p.v;
                        let y1 = r[0], y2 = r[1];
                        y1 = (y1-(step*range[0])) / (step*(range[1]-range[0]));
                        y2 = (y2-(step*range[0])) / (step*(range[1]-range[0]));
                        y1 = util.lerp(padding*quality, ctx.canvas.height-padding*quality, 1-y1);
                        y2 = util.lerp(padding*quality, ctx.canvas.height-padding*quality, 1-y2);
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
                                    name: field.textPath,
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
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v4");
            ctx.lineWidth = 2*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.beginPath();
            ctx.strokeRect(...new V(padding*quality).xy, ...new V(ctx.canvas.width, ctx.canvas.height).sub(2*padding*quality).xy);
            ctx.font = (12*quality)+"px monospace";
            ctx.textBaseline = "top";
            ctx.textAlign = "left";
            let range = [Infinity, Infinity], y = padding*quality + 10*quality + 20*quality*nDiscrete;
            [
                {
                    value: (this.hasPage() && this.page.hasSource()) ? this.page.source.ts : 0,
                    color: "v4",
                },
                {
                    value: util.lerp(...graphRange, mouseX),
                    color: "v4-8",
                    show: !mouseDown,
                },
            ].forEach(data => {
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--"+data.color);
                ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--"+data.color);
                let progress = (data.value-graphRange[0]) / (graphRange[1]-graphRange[0]);
                let x = util.lerp(padding*quality, ctx.canvas.width-padding*quality, progress);
                if ((!("show" in data) || data.show) && progress >= 0 && progress <= 1) {
                    ctx.setLineDash([5*quality, 5*quality]);
                    ctx.beginPath();
                    ctx.moveTo(x, padding*quality);
                    ctx.lineTo(x, ctx.canvas.height-padding*quality);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    let split = util.splitTimeUnits(data.value);
                    split[0] = Math.round(split[0]);
                    while (split.length > 2) {
                        if (split.at(-1) > 0) break;
                        split.pop();
                    }
                    split = split.map((v, i) => {
                        v = String(v);
                        if (i >= split.length-1) return v;
                        let l = String(Object.values(util.UNITVALUES)[i+1]).length;
                        if (i > 0) v = v.padStart(l, "0");
                        else v = v.padEnd(l, "0");
                        return v;
                    });
                    let text = split.slice(1).reverse().join(":")+"."+split[0];
                    let newRange = [x, x+ctx.measureText(text).width+10*quality];
                    if (newRange[1] > ctx.canvas.width-padding*quality) newRange = [newRange[0]-(newRange[1]-newRange[0]), newRange[1]-(newRange[1]-newRange[0])];
                    if (!(newRange[0] > range[1]) && !(newRange[1] < range[0])) y += (12+5)*quality;
                    range = newRange;
                    ctx.fillText(text, newRange[0]+5*quality, y);
                }
            });
            if (mouseDown)
                if (this.hasPage() && this.page.hasSource())
                    this.page.source.ts = util.lerp(...graphRange, mouseX);
            let ignoreY = false;
            if (Math.abs(scrollX) > 0) {
                if (Math.abs(scrollX) > 3) {
                    ignoreY = true;
                    let q = scrollX * (0.1/50);
                    let shift = (graphRange[1]-graphRange[0]) * q;
                    let newGraphRange = [
                        graphRange[0]+shift,
                        graphRange[1]+shift,
                    ];
                    this.viewMode = "section";
                    newGraphRange = newGraphRange.map(v => Math.min(maxTime, Math.max(minTime, Math.round(v*1000000)/1000000)));
                    this.change("viewParams.start", this.viewParams.start, this.viewParams.start=newGraphRange[0]);
                    this.change("viewPrams.stop", this.viewParams.stop, this.viewParams.stop=newGraphRange[1]);
                }
                scrollX = 0;
            }
            if (Math.abs(scrollY) > 0) {
                if (!ignoreY && Math.abs(scrollY) > 3) {
                    let q = scrollY * (0.1/50);
                    let ts = util.lerp(...graphRange, mouseX);
                    let newGraphRange = [
                        util.lerp(graphRange[0], ts, q),
                        util.lerp(graphRange[1], ts, q),
                    ];
                    this.viewMode = "section";
                    newGraphRange = newGraphRange.map(v => Math.min(maxTime, Math.max(minTime, Math.round(v*1000000)/1000000)));
                    this.change("viewParams.start", this.viewParams.start, this.viewParams.start=newGraphRange[0]);
                    this.change("viewParams.stop", this.viewParams.stop, this.viewParams.stop=newGraphRange[1]);
                }
                scrollY = 0;
            }
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
        let closest = null, closests = [];
        for (let i = -1; i <= 1; i++) {
            factors.forEach(f => {
                let step = (10 ** (pow+i)) * f;
                let a = Math.abs(nSteps - Math.round(v / step));
                if (closest == null || a < closest) {
                    closest = a;
                    closests = [];
                }
                if (a == closest) closests.push(step);
            });
        }
        return Math.min(...closests);
    }

    get lVars() { return [...this.#lVars]; }
    set lVars(v) {
        v = util.ensure(v, "arr");
        this.clearLVars();
        v.forEach(v => this.addLVar(v));
    }
    clearLVars() {
        let lVars = this.lVars;
        lVars.forEach(lVar => this.remLVar(lVar));
        return lVars;
    }
    hasLVar(lVar) {
        if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
        return this.#lVars.has(lVar);
    }
    addLVar(lVar) {
        if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
        if (this.hasLVar(lVar)) return false;
        this.#lVars.add(lVar);
        lVar.addLinkedHandler(this, "remove", () => this.remLVar(lVar));
        lVar.addLinkedHandler(this, "change", (c, f, t) => this.change("lVars["+this.lVars.indexOf(lVar)+"]."+c, f, t));
        if (this.hasEOptionSection("l"))
            this.getEOptionSection("l").appendChild(lVar.elem);
        this.change("addLVar", null, lVar);
        return lVar;
    }
    remLVar(lVar) {
        if (!(lVar instanceof Panel.GraphTab.Variable)) return false;
        if (!this.hasLVar(lVar)) return false;
        this.#lVars.delete(lVar);
        lVar.clearLinkedHandlers(this, "remove");
        lVar.clearLinkedHandlers(this, "change");
        if (this.hasEOptionSection("l"))
            this.getEOptionSection("l").removeChild(lVar.elem);
        this.change("remLVar", lVar, null);
        return lVar;
    }
    get rVars() { return [...this.#rVars]; }
    set rVars(v) {
        v = util.ensure(v, "arr");
        this.clearRVars();
        v.forEach(v => this.addRVar(v));
    }
    clearRVars() {
        let rVars = this.rVars;
        rVars.forEach(rVar => this.remRVar(rVar));
        return rVars;
    }
    hasRVar(rVar) {
        if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
        return this.#rVars.has(rVar);
    }
    addRVar(rVar) {
        if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
        if (this.hasRVar(rVar)) return false;
        this.#rVars.add(rVar);
        rVar.addLinkedHandler(this, "remove", () => this.remRVar(rVar));
        rVar.addLinkedHandler(this, "change", (c, f, t) => this.change("rVars["+this.rVars.indexOf(rVar)+"]."+c, f, t));
        if (this.hasEOptionSection("r"))
            this.getEOptionSection("r").appendChild(rVar.elem);
        this.change("addRVar", null, rVar);
        return rVar;
    }
    remRVar(rVar) {
        if (!(rVar instanceof Panel.GraphTab.Variable)) return false;
        if (!this.hasRVar(rVar)) return false;
        let i = this.rVars.indexOf(rVar);
        this.#rVars.delete(rVar);
        rVar.clearLinkedHandlers(this, "remove");
        rVar.clearLinkedHandlers(this, "change");
        if (this.hasEOptionSection("r"))
            this.getEOptionSection("r").removeChild(rVar.elem);
        this.change("remRVar", rVar, null);
        return rVar;
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

    get ePlayPauseBtn() { return this.#ePlayPauseBtn; }
    get eSkipBackBtn() { return this.#eSkipBackBtn; }
    get eSkipForwardBtn() { return this.#eSkipForwardBtn; }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.optionState == 0) return null;
        let r;
        r = this.eOptions.getBoundingClientRect();
        if (pos.x < r.left || pos.x > r.right) return null;
        if (pos.y < r.top || pos.y > r.bottom) return null;
        if (data instanceof Panel.BrowserTab) data = (this.hasPage() && this.page.hasSource()) ? this.page.source.root.lookup(data.path) : null;
        for (let i = 0; i < this.eOptionSections.length; i++) {
            let id = this.eOptionSections[i];
            let elem = this.getEOptionSection(id);
            r = elem.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            let idfs = {
                _: side => {
                    if (!(data instanceof Source.Field)) return null;
                    if (!data.hasType()) return null;
                    return {
                        r: r,
                        submit: () => {
                            const colors = "rybgpocm";
                            const addVar = field => {
                                let pth = field.path;
                                if (field.hasType() && field.isJustPrimitive) {
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
                                    this[side+"Vars"].forEach(v => util.arrEquals(v.path, pth) ? (has = true) : null);
                                    if (has) return;
                                    this["add"+side.toUpperCase()+"Var"](new Panel.GraphTab.Variable(pth, "--c"+nextColor));
                                }
                                field.fields.forEach(field => addVar(field));
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

        this.#path = [];
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
            this.isOpen = !this.isOpen;
        });

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.GraphTab.Variable) a = [a.path, a.color, a.isShown];
            else if (util.is(a, "arr")) {
                if (util.is(a[0], "str")) a = [a, null];
                else {
                    a = new Panel.GraphTab.Variable(...a);
                    a = [a.path, a.color, a.isShown];
                }
            }
            else if (util.is(a, "obj")) a = [a.path, a.color, a.isShown];
            else a = [[], null];
        }
        if (a.length == 2) a = [...a, true];

        [this.path, this.color, this.isShown] = a;
    }

    get path() { return [...this.#path]; }
    set path(v) {
        v = util.ensure(v, "arr");
        if (util.arrEquals(v, this.path)) return;
        this.change("path", this.path, [...(this.#path=v)]);
        this.eDisplayName.textContent = this.path.join("/");
    }
    get color() { return this.#color; }
    set color(v) {
        v = (v == null) ? null : String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
        let color = this.hasColor() ? this.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(this.color) : this.color : "#fff";
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
        if (this.open == v) return;
        if (v) this.elem.classList.add("open");
        else this.elem.classList.remove("open");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

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

    #eProgress;
    #ePlayPauseBtn;
    #eSkipBackBtn;
    #eSkipForwardBtn;
    #eTimeDisplay;
    #eTemplateSelect;

    static PATTERNS = {};

    constructor(tail="") {
        super("Odometry"+tail, "odometry"+String(tail).toLowerCase());

        this.elem.classList.add("odometry");

        this.#poses = new Set();

        this.#template = null;

        let templates = {};
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
            if (this.template != "§null") return;
            this.template = await window.api.get("active-template");
        })();

        this.#eProgress = document.createElement("div");
        this.eNav.insertBefore(this.eProgress, this.eSubNav);
        this.eProgress.classList.add("progress");
        this.eProgress.addEventListener("mousedown", e => {
            e.preventDefault();
            e.stopPropagation();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                let r = this.eProgress.getBoundingClientRect();
                let p = (e.pageX-r.left) / r.width;
                if (!this.hasPage()) return;
                if (!this.page.hasSource()) return;
                this.page.source.ts = util.lerp(this.page.source.tsMin, this.page.source.tsMax, p);
            };
            mousemove(e);
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.#ePlayPauseBtn = document.createElement("button");
        this.eSubNav.appendChild(this.ePlayPauseBtn);
        this.ePlayPauseBtn.innerHTML = "<ion-icon></ion-icon>";
        this.ePlayPauseBtn.addEventListener("click", e => {
            if (!this.hasPage()) return;
            if (!this.page.hasSource()) return;
            this.page.source.playback.paused = !this.page.source.playback.paused;
        });
        this.#eSkipBackBtn = document.createElement("button");
        this.eSubNav.appendChild(this.eSkipBackBtn);
        this.eSkipBackBtn.innerHTML = "<ion-icon name='play-skip-back'></ion-icon>";
        this.eSkipBackBtn.addEventListener("click", e => {
            if (!this.hasPage()) return;
            if (!this.page.hasSource()) return;
            this.page.source.ts = this.page.source.tsMin;
        });
        this.#eSkipForwardBtn = document.createElement("button");
        this.eSubNav.appendChild(this.eSkipForwardBtn);
        this.eSkipForwardBtn.innerHTML = "<ion-icon name='play-skip-forward'></ion-icon>";
        this.eSkipForwardBtn.addEventListener("click", e => {
            if (!this.hasPage()) return;
            if (!this.page.hasSource()) return;
            this.page.source.ts = this.page.source.tsMax;
        });
        this.#eTimeDisplay = document.createElement("div");
        this.eSubNav.appendChild(this.eTimeDisplay);
        this.eTimeDisplay.textContent = "0:00 / 0:00";

        ["p", "f", "o"].forEach(id => {
            const elem = document.createElement("div");
            elem.id = id;
            this.addEOptionSection(elem);
            elem.classList.add("section");
            elem.innerHTML = "<div class='header'>"+{ p: "Poses", f: "Field", o: "Options" }[id]+"</div>";
            let idfs = {
                p: () => {
                    elem.classList.add("list");
                    this.addHandler("update", delta => {
                        if (this.poses.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    });
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
                        if (!this.hasApp()) return;
                        e.stopPropagation();
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
                    });
                },
                o: () => {
                    elem.classList.add("options");
                    let header = document.createElement("div");
                    elem.appendChild(header);
                    header.classList.add("header");
                    header.textContent = "View";
                },
            };
            if (id in idfs) idfs[id]();
        });

        this.addHandler("update", delta => {
            let t = 0, tTotal = 0, paused = true;
            if (this.hasPage() && this.page.hasSource()) {
                t = this.page.source.ts - this.page.source.tsMin;
                tTotal = this.page.source.tsMax - this.page.source.tsMin;
                paused = this.page.source.playback.paused;
            }
            this.eProgress.style.setProperty("--progress", (100*(t/tTotal))+"%");
            if (this.ePlayPauseBtn.children[0] instanceof HTMLElement)
                this.ePlayPauseBtn.children[0].setAttribute("name", paused ? "play" : "pause");
            let split;
            split = util.splitTimeUnits(t);
            split[0] = Math.round(split[0]);
            while (split.length > 3) {
                if (split.at(-1) > 0) break;
                split.pop();
            }
            split = split.map((v, i) => {
                v = String(v);
                if (i >= split.length-1) return v;
                let l = String(Object.values(util.UNITVALUES)[i+1]).length;
                if (i > 0) v = v.padStart(l, "0");
                else v = v.padEnd(l, "0");
                return v;
            });
            this.eTimeDisplay.textContent = split.slice(1).reverse().join(":")+"."+split[0];
            split = util.splitTimeUnits(tTotal);
            split[0] = Math.round(split[0]);
            while (split.length > 3) {
                if (split.at(-1) > 0) break;
                split.pop();
            }
            split = split.map((v, i) => {
                v = String(v);
                if (i >= split.length-1) return v;
                let l = String(Object.values(util.UNITVALUES)[i+1]).length;
                if (i > 0) v = v.padStart(l, "0");
                else v = v.padEnd(l, "0");
                return v;
            });
            this.eTimeDisplay.textContent += " / " + split.slice(1).reverse().join(":")+"."+split[0];
        });
    }

    get poses() { return [...this.#poses]; }
    set poses(v) {
        v = util.ensure(v, "arr");
        this.clearPoses();
        v.forEach(v => this.addPose(v));
    }
    clearPoses() {
        let poses = this.poses;
        poses.forEach(pose => this.remPose(pose));
        return poses;
    }
    hasPose(pose) {
        if (!(pose instanceof this.constructor.Pose)) return false;
        return this.#poses.has(pose);
    }
    addPose(pose) {
        if (!(pose instanceof this.constructor.Pose)) return false;
        if (this.hasPose(pose)) return false;
        this.#poses.add(pose);
        pose.addLinkedHandler(this, "remove", () => this.remPose(pose));
        pose.addLinkedHandler(this, "change", (c, f, t) => this.change("poses["+this.poses.indexOf(pose)+"]."+c, f, t));
        if (this.hasEOptionSection("p"))
            this.getEOptionSection("p").appendChild(pose.elem);
        this.change("addPose", null, pose);
        pose.state.tab = this;
        return pose;
    }
    remPose(pose) {
        if (!(pose instanceof this.constructor.Pose)) return false;
        if (!this.hasPose(pose)) return false;
        pose.state.tab = null;
        let i = this.poses.indexOf(pose);
        this.#poses.delete(pose);
        pose.clearLinkedHandlers(this, "remove");
        pose.clearLinkedHandlers(this, "change");
        if (this.hasEOptionSection("p"))
            this.getEOptionSection("p").removeChild(pose.elem);
        this.change("remPose", pose, null);
        return pose;
    }

    get template() { return this.#template; }
    set template(v) {
        v = (v == null) ? null : String(v);
        if (this.template == v) return;
        this.change("template", this.template, this.#template=v);
        if (this.eTemplateSelect.children[0] instanceof HTMLDivElement)
            this.eTemplateSelect.children[0].textContent = (this.template == null) ? "No Template" : this.template;
    }

    getValue(field) {
        if (!(field instanceof Source.Field)) return null;
        if (field.isStruct && (field.structType in this.constructor.PATTERNS)) {
            let paths = util.ensure(this.constructor.PATTERNS[field.structType], "arr").map(path => util.ensure(path, "arr").map(v => String(v)));
            let value = paths.map(path => {
                let subfield = field.lookup(path);
                if (!(subfield instanceof Source.Field)) return null;
                return subfield.get();
            });
            return value.filter(v => util.is(v, "num"));
        }
        return field.get();
    }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.optionState == 0) return null;
        let r;
        r = this.eOptions.getBoundingClientRect();
        if (pos.x < r.left || pos.x > r.right) return null;
        if (pos.y < r.top || pos.y > r.bottom) return null;
        if (data instanceof Panel.BrowserTab) data = (this.hasPage() && this.page.hasSource()) ? this.page.source.root.lookup(data.path) : null;
        for (let i = 0; i < this.eOptionSections.length; i++) {
            let id = this.eOptionSections[i];
            let elem = this.getEOptionSection(id);
            r = elem.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            let idfs = {
                p: () => {
                    if (!(data instanceof Source.Field)) return null;
                    if (!data.hasType()) return null;
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
                                this.poses.forEach(v => util.arrEquals(v.path, pth) ? (has = true) : null);
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

    get eProgress() { return this.#eProgress; }
    get ePlayPauseBtn() { return this.#ePlayPauseBtn; }
    get eSkipBackBtn() { return this.#eSkipBackBtn; }
    get eSkipForwardBtn() { return this.#eSkipForwardBtn; }
    get eTimeDisplay() { return this.#eTimeDisplay; }
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

        this.#path = [];
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
            this.isOpen = !this.isOpen;
        });

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof this.constructor) a = [a.path, a.color, a.isShown];
            else if (util.is(a, "arr")) {
                if (util.is(a[0], "str")) a = [a, null];
                else {
                    a = new this.constructor(...a);
                    a = [a.path, a.color, a.isShown];
                }
            }
            else if (util.is(a, "obj")) a = [a.path, a.color, a.isShown];
            else a = [[], null];
        }
        if (a.length == 2) a = [...a, true];

        [this.path, this.color, this.isShown] = a;
    }

    get path() { return [...this.#path]; }
    set path(v) {
        v = util.ensure(v, "arr");
        if (util.arrEquals(v, this.path)) return;
        this.change("path", this.path, [...(this.#path=v)]);
        this.eDisplayName.textContent = this.path.join("/");
    }
    get color() { return this.#color; }
    set color(v) {
        v = (v == null) ? null : String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
        let color = this.hasColor() ? this.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(this.color) : this.color : "#fff";
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
    #pose;

    constructor() {
        super();

        this.#tab = null;
        this.#pose = null;
    }

    get tab() { return this.#tab; }
    set tab(v) {
        v = (v instanceof Panel.OdometryTab) ? v : null;
        if (this.tab == v) return;
        this.destroy();
        this.#tab = v;
        this.create();
    }
    hasTab() { return this.tab instanceof Panel.OdometryTab; }
    get parent() { return this.hasTab() ? this.tab.parent : null; }
    hasParent() { return this.parent instanceof Panel; }
    get page() { return this.hasParent() ? this.parent.page : null; }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() { return this.hasPage() ? this.page.app : null; }
    hasApp() { return this.app instanceof App; }
    get pose() { return this.#pose; }
    set pose(v) {
        v = (v instanceof Panel.OdometryTab.Pose) ? v : null;
        if (this.pose == v) return;
        this.destroy();
        this.#pose = v;
        this.create();
    }
    hasPose() { return this.pose instanceof Panel.OdometryTab.Pose; }

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

    #eSizeWInput;
    #eSizeHInput;
    #eRobotSizeWInput;
    #eRobotSizeHInput;
    #eUnitsMeters;
    #eUnitsCentimeters;
    #eUnitsDegrees;
    #eUnitsRadians;

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

        this.#isMeters = true;
        this.#isDegrees = true;

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
        let eNav;
        const eOptions = this.getEOptionSection("o");
        let last = Array.from(eOptions.children).at(-1);
        eNav = document.createElement("div");
        eOptions.insertBefore(eNav, last);
        eNav.classList.add("nav");
        this.#eUnitsMeters = document.createElement("button");
        eNav.appendChild(this.eUnitsMeters);
        this.eUnitsMeters.textContent = "Meters";
        this.eUnitsMeters.addEventListener("click", e => (this.isMeters = true));
        this.#eUnitsCentimeters = document.createElement("button");
        eNav.appendChild(this.eUnitsCentimeters);
        this.eUnitsCentimeters.textContent = "Centimeters";
        this.eUnitsCentimeters.addEventListener("click", e => (this.isCentimeters = true));
        eNav = document.createElement("div");
        eOptions.insertBefore(eNav, last);
        eNav.classList.add("nav");
        this.#eUnitsDegrees = document.createElement("button");
        eNav.appendChild(this.eUnitsDegrees);
        this.eUnitsDegrees.textContent = "Degrees";
        this.eUnitsDegrees.addEventListener("click", e => (this.isDegrees = true));
        this.#eUnitsRadians = document.createElement("button");
        eNav.appendChild(this.eUnitsRadians);
        this.eUnitsRadians.textContent = "Radians";
        this.eUnitsRadians.addEventListener("click", e => (this.isRadians = true));

        this.quality = this.odometry.quality;

        if (a.length <= 0 || [6].includes(a.length) || a.length > 7) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.Odometry2dTab) a = [a.poses, a.template, a.size, a.robotSize, a.isMeters, a.isDegrees, a.optionState];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof this.constructor.Pose) a = [a, null];
                else {
                    a = new Panel.Odometry2dTab(...a);
                    a = [a.poses, a.template, a.size, a.robotSize, a.isMeters, a.isDegrees, a.optionState];
                }
            }
            else if (util.is(a, "obj")) a = [a.poses, a.template, a.size, a.robotSize, a.isMeters, a.isDegrees, a.optionState];
            else a = [[], "§null"];
        }
        if (a.length == 2) a = [...a, 1000];
        if (a.length == 3) a = [...a, 100];
        if (a.length == 4) a = [...a, 0.5];
        if (a.length == 5) a = [...a.slice(0, 4), true, true, a[4]];

        [this.poses, this.template, this.size, this.robotSize, this.isMeters, this.isDegrees, this.optionState] = a;

        let templates = {};
        let templateImages = {};
        let finished = false;
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
            templateImages = util.ensure(await window.api.get("template-images"), "obj");
            finished = true;
        })();

        window.hottest2d = () => {
            const page = app.getPage("PROJECT");
            page.source.announceTopic("k", "double[]");
            page.source.updateTopic("k", [2, 2, 0]);
        };

        this.addHandler("update", delta => {
            if (this.isClosed) return;

            if (this.template in templates) eField.classList.add("has");
            else eField.classList.remove("has");
            if (document.activeElement != this.eSizeWInput) this.eSizeWInput.value = this.w/(this.isMeters ? 100 : 1);
            if (document.activeElement != this.eSizeHInput) this.eSizeHInput.value = this.h/(this.isMeters ? 100 : 1);
            if (document.activeElement != this.eRobotSizeWInput) this.eRobotSizeWInput.value = this.robotW/(this.isMeters ? 100 : 1);
            if (document.activeElement != this.eRobotSizeHInput) this.eRobotSizeHInput.value = this.robotH/(this.isMeters ? 100 : 1);
            if (this.isMeters) this.eUnitsMeters.classList.add("this");
            else this.eUnitsMeters.classList.remove("this");
            if (this.isCentimeters) this.eUnitsCentimeters.classList.add("this");
            else this.eUnitsCentimeters.classList.remove("this");
            if (this.isDegrees) this.eUnitsDegrees.classList.add("this");
            else this.eUnitsDegrees.classList.remove("this");
            if (this.isRadians) this.eUnitsRadians.classList.add("this");
            else this.eUnitsRadians.classList.remove("this");
            infoUnits.forEach(elem => (elem.textContent = (this.isMeters ? "m" : "cm")));

            if (!finished) return;

            this.odometry.size = (this.template in templates) ? util.ensure(templates[this.template], "obj").size : this.size;
            this.odometry.imageSrc = (this.template in templateImages) ? templateImages[this.template] : null;
            this.odometry.imageScale = (this.template in templates) ? util.ensure(templates[this.template], "obj").imageScale : 0;
            if (this.isClosed) return;
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            this.poses.forEach(pose => {
                pose.state.pose = pose.isShown ? pose : null;
                const field = (source instanceof Source) ? source.root.lookup(pose.path) : null;
                pose.state.value = this.getValue(field);
                pose.state.update(delta);
            });
            this.odometry.update(delta);
        });
    }

    addPose(pose) {
        let r = super.addPose(pose);
        if (r instanceof this.constructor.Pose) {
            const onType = () => {
                let current = core.Odometry2d.Robot.lookupTypeName(r.type);
                if (!this.hasApp()) return;
                let itm;
                let menu = new core.App.Menu();
                Object.keys(core.Odometry2d.Robot.Types).forEach(k => {
                    let name = String(k).split(" ").map(v => util.capitalize(v)).join(" ");
                    itm = menu.addItem(new core.App.Menu.Item(name, (current == k) ? "checkmark" : ""));
                    itm.addHandler("trigger", e => {
                        r.type = k;
                    });
                });
                this.app.contextMenu = menu;
                let rect = r.eDisplayType.getBoundingClientRect();
                this.app.placeContextMenu(rect.left, rect.bottom);
            };
            r.addLinkedHandler(this, "type", onType);
        }
        return r;
    }
    remPose(pose) {
        let r = super.remPose(pose);
        if (r instanceof this.constructor.Pose) {
            r.clearLinkedHandlers(this, "type");
        }
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
    }
    get isCentimeters() { return !this.isMeters; }
    set isCentimeters(v) { this.isMeters = !v; }
    get isDegrees() { return this.#isDegrees; }
    set isDegrees(v) {
        v = !!v;
        if (this.isDegrees == v) return;
        this.change("isDegrees", this.isDegrees, this.#isDegrees=v);
    }
    get isRadians() { return !this.isDegrees; }
    set isRadians(v) { this.isDegrees = !v; }

    get eSizeWInput() { return this.#eSizeWInput; }
    get eSizeHInput() { return this.#eSizeHInput; }
    get eRobotSizeWInput() { return this.#eRobotSizeWInput; }
    get eRobotSizeHInput() { return this.#eRobotSizeHInput; }
    get eUnitsMeters() { return this.#eUnitsMeters; }
    get eUnitsCentimeters() { return this.#eUnitsCentimeters; }
    get eUnitsDegrees() { return this.#eUnitsDegrees; }
    get eUnitsRadians() { return this.#eUnitsRadians; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            poses: this.poses,
            template: this.template,
            size: this.size,
            robotSize: this.robotSize,
            isMeters: this.isMeters,
            isDegrees: this.isDegrees,
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
        this.eGhostBtn.addEventListener("click", e => (this.isGhost = !this.isGhost));

        this.#eDisplayType = document.createElement("button");
        this.eContent.appendChild(this.eDisplayType);
        this.eDisplayType.classList.add("display");
        this.eDisplayType.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eDisplayType.addEventListener("click", e => this.post("type"));

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
            // REMOVE WHEN FIXED
            else if (util.is(a, "obj")) a = [a.path, a.color, a.isShown, a.ghost || a.isGhost, a.type];
            else a = [[], null];
        }
        if (a.length == 2) a = [...a, true];
        if (a.length == 3) a = [...a, false];
        if (a.length == 4) a = [...a, core.Odometry2d.Robot.Types.DEFAULT];

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
        if (!Object.values(core.Odometry2d.Robot.Types)) return;
        if (Object.keys(core.Odometry2d.Robot.Types).includes(v)) v = core.Odometry2d.Robot.Types[v];
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
            type: this.type,
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

        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            if (!this.hasPose()) return;
            const renders = this.#renders;
            if (this.value.length % 2 == 0) {
                let l = Math.max(0, (this.value.length/2) - 1);
                while (renders.length < l) renders.push(this.tab.odometry.addRender(new RLine(this.tab.odometry)));
                while (renders.length > l) this.tab.odometry.remRender(renders.pop());
                renders.forEach((render, i) => {
                    render.a = [this.value[i*2 + 0], this.value[i*2 + 1]];
                    render.a.imul(this.tab.isMeters ? 100 : 1);
                    render.b = [this.value[i*2 + 2], this.value[i*2 + 3]];
                    render.b.imul(this.tab.isMeters ? 100 : 1);
                    render.color = this.pose.color;
                    render.alpha = this.pose.isGhost ? 0.5 : 1;
                });
                this.pose.eDisplayType.style.display = "none";
            } else if (this.value.length == 3) {
                let render = renders[0];
                render.color = this.pose.color.substring(2);
                render.colorH = this.pose.color.substring(2)+5;
                render.alpha = this.pose.isGhost ? 0.5 : 1;
                render.size = (this.tab.template in templates) ? util.ensure(templates[this.tab.template], "obj").robotSize : this.tab.robotSize;
                render.pos = new V(this.value[0], this.value[1]).mul(this.tab.isMeters ? 100 : 1);
                render.heading = this.value[2] * (this.tab.isDegrees ? 1 : (180/Math.PI));
                render.type = this.pose.type;
                this.pose.eDisplayType.style.display = "";
            }
        });
    }

    hasTab() { return this.tab instanceof Panel.Odometry2dTab; }
    hasPose() { return this.pose instanceof Panel.Odometry2dTab.Pose; }
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
        this.#renders.forEach(render => {
            this.tab.odometry.remRender(render);
        });
        this.#renders = [];
    }
    create() {
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        if (this.value.length % 2 == 0) {
            this.#renders = [];
        } else if (this.value.length == 3) {
            this.#renders = [this.tab.odometry.addRender(new core.Odometry2d.Robot(this.tab.odometry))];
            this.#renders[0].showVelocity = false;
        }
    }
};
const preloadedFields = {};
const preloadedRobots = {};
Panel.Odometry3dTab = class PanelOdometry3dTab extends Panel.OdometryTab {
    #scene;
    #camera;
    #renderer;
    #controls;
    #composer;

    #axisScene;

    #field;

    #isProjection;
    #isOrbit;
    #isMeters;
    #isDegrees;

    #eViewProjection;
    #eViewIsometric;
    #eViewOrbit;
    #eViewFree;
    #eUnitsMeters;
    #eUnitsCentimeters;
    #eUnitsDegrees;
    #eUnitsRadians;
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
            ["rotation", "q", "x"],
            ["rotation", "q", "y"],
            ["rotation", "q", "z"],
            ["rotation", "q", "w"],
        ],
    };

    constructor(...a) {
        super("3d");

        const eInfo = document.createElement("div");
        this.eContent.appendChild(eInfo);
        eInfo.classList.add("info");
        eInfo.innerHTML = "   [W]\n[A][S][D]\n[ Space ] Up\n[ Shift ] Down\n[  Esc  ] Leave Pointer Lock";

        this.quality = 3;

        this.#scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 20, 25);
        this.#camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

        this.#renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true });
        
        this.#controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.renderer.domElement.addEventListener("click", e => {
            if (this.controls instanceof PointerLockControls)
                this.controls.lock();
        });

        this.#composer = new EffectComposer(this.renderer);

        const radius = 0.05;
        const length = 5;
        this.#axisScene = new THREE.Group();
        const xAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        xAxis.position.set(length/2, 0, 0);
        xAxis.rotateZ(Math.PI/2);
        this.axisScene.add(xAxis);
        this.axisScene.xAxis = xAxis;
        const yAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        yAxis.position.set(0, length/2, 0);
        this.axisScene.add(yAxis);
        this.axisScene.yAxis = yAxis;
        const zAxis = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        zAxis.position.set(0, 0, length/2);
        zAxis.rotateX(Math.PI/2);
        this.axisScene.add(zAxis);
        this.axisScene.zAxis = zAxis;
        this.axisScene.planes = [];

        this.#field = null;

        const hemLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
        this.scene.add(hemLight);

        const light = new THREE.PointLight(0xffffff, 0.5);
        light.position.set(0, 0, 10);
        this.scene.add(light);

        const loader = new GLTFLoader();

        this.#isProjection = null;
        this.#isOrbit = null;
        this.#isMeters = null;
        this.#isDegrees = null;

        const eField = this.getEOptionSection("f");
        let eNav;
        const eOptions = this.getEOptionSection("o");
        let last = Array.from(eOptions.children).at(-1);

        eNav = document.createElement("div");
        eOptions.insertBefore(eNav, last);
        eNav.classList.add("nav");
        this.#eViewProjection = document.createElement("button");
        eNav.appendChild(this.eViewProjection);
        this.eViewProjection.textContent = "Projection";
        this.eViewProjection.addEventListener("click", e => (this.isProjection = true));
        this.#eViewIsometric = document.createElement("button");
        eNav.appendChild(this.eViewIsometric);
        this.eViewIsometric.textContent = "Isometric";
        this.eViewIsometric.addEventListener("click", e => (this.isIsometric = true));

        eNav = document.createElement("div");
        eOptions.insertBefore(eNav, last);
        eNav.classList.add("nav");
        this.#eViewOrbit = document.createElement("button");
        eNav.appendChild(this.eViewOrbit);
        this.eViewOrbit.textContent = "Orbit";
        this.eViewOrbit.addEventListener("click", e => (this.isOrbit = true));
        this.#eViewFree = document.createElement("button");
        eNav.appendChild(this.eViewFree);
        this.eViewFree.textContent = "Free";
        this.eViewFree.addEventListener("click", e => (this.isFree = true));

        eNav = document.createElement("div");
        eOptions.insertBefore(eNav, last);
        eNav.classList.add("nav");
        this.#eUnitsMeters = document.createElement("button");
        eNav.appendChild(this.eUnitsMeters);
        this.eUnitsMeters.textContent = "Meters";
        this.eUnitsMeters.addEventListener("click", e => (this.isMeters = true));
        this.#eUnitsCentimeters = document.createElement("button");
        eNav.appendChild(this.eUnitsCentimeters);
        this.eUnitsCentimeters.textContent = "Centimeters";
        this.eUnitsCentimeters.addEventListener("click", e => (this.isCentimeters = true));

        eNav = document.createElement("div");
        eOptions.insertBefore(eNav, last);
        eNav.classList.add("nav");
        this.#eUnitsDegrees = document.createElement("button");
        eNav.appendChild(this.eUnitsDegrees);
        this.eUnitsDegrees.textContent = "Degrees";
        this.eUnitsDegrees.addEventListener("click", e => (this.isDegrees = true));
        this.#eUnitsRadians = document.createElement("button");
        eNav.appendChild(this.eUnitsRadians);
        this.eUnitsRadians.textContent = "Radians";
        this.eUnitsRadians.addEventListener("click", e => (this.isRadians = true));

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
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
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
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
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
                v = Math.max(0, util.ensure(parseFloat(v), "num"));
                this.camera.position.z = v / (this.isMeters ? 1 : 100);
            }
        });

        if (a.length <= 0 || [4, 5, 6].includes(a.length) || a.length > 7) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Panel.Odometry3dTab) a = [a.poses, a.template, a.isProjection, a.isOrbit, a.isMeters, a.isDegrees, a.optionState];
            else if (util.is(a, "arr")) {
                if (a[0] instanceof this.constructor.Pose) a = [a, null];
                else {
                    a = new Panel.Odometry3dTab(...a);
                    a = [a.poses, a.template, a.isProjection, a.isOrbit, a.isMeters, a.isDegrees, a.optionState];
                }
            }
            else if (util.is(a, "obj")) a = [a.poses, a.template, a.isProjection, a.isOrbit, a.isMeters, a.isDegrees, a.optionState];
            else a = [[], "§null"];
        }
        if (a.length == 2) a = [...a, 0.5];
        if (a.length == 3) a = [...a.slice(0, 2), true, true, true, true, a[2]];

        [this.poses, this.template, this.isProjection, this.isOrbit, this.isMeters, this.isDegrees, this.optionState] = a;

        let templates = {};
        let templateModels = {};
        let finished = false;
        (async () => {
            templates = util.ensure(await window.api.get("templates"), "obj");
            templateModels = util.ensure(await window.api.get("template-models"), "obj");
            finished = true;
        })();

        window.hottest3d = () => {
            const page = app.getPage("PROJECT");
            page.source.announceTopic("k", "double[]");
            page.source.updateTopic("k", [0, 0, 0, 0, 0, 0, 0]);
        };

        let template = "§null", model = null;
        
        let keys = new Set();
        const onKeyDown = e => keys.add(e.code);
        const onKeyUp = e => keys.delete(e.code);
        this.addHandler("add", () => {
            document.body.addEventListener("keydown", onKeyDown);
            document.body.addEventListener("keyup", onKeyUp);
        });
        this.addHandler("rem", () => {
            document.body.removeEventListener("keydown", onKeyDown);
            document.body.removeEventListener("keyup", onKeyUp);
        });
        let velocity = new util.V3();

        this.addHandler("update", delta => {
            if (this.isClosed) return;

            if (this.template in templates) eField.classList.add("has");
            else eField.classList.remove("has");
            if (this.isProjection) this.eViewProjection.classList.add("this");
            else this.eViewProjection.classList.remove("this");
            if (this.isIsometric) this.eViewIsometric.classList.add("this");
            else this.eViewIsometric.classList.remove("this");
            if (this.isOrbit) this.eViewOrbit.classList.add("this");
            else this.eViewOrbit.classList.remove("this");
            if (this.isFree) this.eViewFree.classList.add("this");
            else this.eViewFree.classList.remove("this");
            if (this.isMeters) this.eUnitsMeters.classList.add("this");
            else this.eUnitsMeters.classList.remove("this");
            if (this.isCentimeters) this.eUnitsCentimeters.classList.add("this");
            else this.eUnitsCentimeters.classList.remove("this");
            if (this.isDegrees) this.eUnitsDegrees.classList.add("this");
            else this.eUnitsDegrees.classList.remove("this");
            if (this.isRadians) this.eUnitsRadians.classList.add("this");
            else this.eUnitsRadians.classList.remove("this");
            infoUnits.forEach(elem => (elem.textContent = (this.isMeters ? "m" : "cm")));
            if (document.activeElement != this.eCameraPosXInput)
                this.eCameraPosXInput.value = Math.round((this.camera.position.x * (this.isMeters ? 1 : 100))*10000)/10000;
            if (document.activeElement != this.eCameraPosYInput)
                this.eCameraPosYInput.value = Math.round((this.camera.position.y * (this.isMeters ? 1 : 100))*10000)/10000;
            if (document.activeElement != this.eCameraPosZInput)
                this.eCameraPosZInput.value = Math.round((this.camera.position.z * (this.isMeters ? 1 : 100))*10000)/10000;
            
            const source = (this.hasPage() && this.page.hasSource()) ? this.page.source : null;
            this.poses.forEach(pose => {
                pose.state.pose = pose.isShown ? pose : null;
                pose.state.offsetX = +((this.template in templates) ? new V(util.ensure(templates[this.template], "obj").size).x : 0)/2;
                pose.state.offsetZ = -((this.template in templates) ? new V(util.ensure(templates[this.template], "obj").size).y : 0)/2;
                const field = (source instanceof Source) ? source.root.lookup(pose.path) : null;
                pose.state.value = this.getValue(field);
                pose.state.composer = this.composer;
                pose.state.scene = this.scene;
                pose.state.camera = this.camera;
                pose.state.update(delta);
            });

            let colorR = new util.Color(getComputedStyle(document.body).getPropertyValue("--cr"));
            let colorG = new util.Color(getComputedStyle(document.body).getPropertyValue("--cg"));
            let colorB = new util.Color(getComputedStyle(document.body).getPropertyValue("--cb"));
            let colorV = new util.Color(getComputedStyle(document.body).getPropertyValue("--v4"));
            this.scene.fog.color.set(colorV.toHex(false));
            this.axisScene.xAxis.material.color.set(colorR.toHex(false));
            this.axisScene.yAxis.material.color.set(colorB.toHex(false));
            this.axisScene.zAxis.material.color.set(colorG.toHex(false));
            let planes = this.axisScene.planes;
            let size = 10;
            let i = 0;
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    if ((x+y) % 2 == 0) continue;
                    if (i >= planes.length) {
                        let plane = new THREE.Mesh(
                            new THREE.PlaneGeometry(1, 1),
                            new THREE.MeshBasicMaterial({ color: 0xffffff }),
                        );
                        plane.material.side = THREE.DoubleSide;
                        plane.rotateX(-Math.PI/2);
                        planes.push(plane);
                        this.axisScene.add(plane);
                    }
                    let plane = planes[i++];
                    plane.position.set(0.5+1*(x-size/2), 0, 0.5+1*(y-size/2));
                    plane.material.color.set(colorV.toHex(false));
                }
            }
            planes.slice(i).forEach(plane => {
                planes.splice(planes.indexOf(plane), 1);
                this.axisScene.remove(plane);
            });

            if ((this.template in templateModels) && !(this.template in preloadedFields)) {
                const template = this.template;
                preloadedFields[template] = null;
                loader.load(templateModels[template], gltf => {
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
                }, null, err => (delete preloadedFields[template]));
            }

            if (template != this.template || model != preloadedFields[this.template]) {
                template = this.template;
                model = preloadedFields[this.template];
                this.field = model;
            }

            if (this.controls instanceof OrbitControls) {
                this.controls.target.set(0, 0, 0);
                this.controls.update();
                this.eContent.classList.remove("showinfo");
            } else if (this.controls instanceof PointerLockControls) {
                if (this.controls.isLocked) {
                    let xP = keys.has("KeyD") || keys.has("ArrowRight");
                    let xN = keys.has("KeyA") || keys.has("ArrowLeft");
                    let yP = keys.has("KeyW") || keys.has("ArrowUp");
                    let yN = keys.has("KeyS") || keys.has("ArrowDown");
                    let zP = keys.has("Space");
                    let zN = keys.has("ShiftRight") || keys.has("ShiftLeft");
                    let x = xP - xN;
                    let y = yP - yN;
                    let z = zP - zN;
                    velocity.iadd(new util.V3(x, y, z).mul(0.01));
                    velocity.imul(0.9);
                    velocity.imap(v => (Math.abs(v) < util.EPSILON ? 0 : v));
                    this.controls.moveRight(velocity.x);
                    this.controls.moveForward(velocity.y);
                    this.camera.position.y += velocity.z;
                    this.eContent.classList.add("showinfo");
                } else {
                    velocity.imul(0);
                    this.eContent.classList.remove("showinfo");
                }
            }
            this.camera.position.x = Math.round(this.camera.position.x*10000)/10000;
            this.camera.position.y = Math.round(this.camera.position.y*10000)/10000;
            this.camera.position.z = Math.round(this.camera.position.z*10000)/10000;

            let r = this.eContent.getBoundingClientRect();

            if (this.camera instanceof THREE.PerspectiveCamera) {
                this.camera.aspect = r.width / r.height;
                this.camera.updateProjectionMatrix();
            } else if (this.camera instanceof THREE.OrthographicCamera) {
                let size = 15;
                let aspect = r.width / r.height;
                this.camera.left = -size/2 * aspect;
                this.camera.right = +size/2 * aspect;
                this.camera.top = +size/2;
                this.camera.bottom = -size/2;
            }

            this.renderer.setSize(r.width*this.quality, r.height*this.quality);
            this.renderer.domElement.style.transform = "scale("+(100*(1/this.quality))+"%) translate(-100%, -100%)";

            this.composer.setSize(r.width*this.quality, r.height*this.quality);
            this.composer.render();
        });

        this.isProjection = true;
    }

    addPose(pose) {
        let r = super.addPose(pose);
        if (r instanceof this.constructor.Pose) {
            const onType = async () => {
                let robots = util.ensure(await window.api.get("robots"), "obj");
                let current = r.type;
                if (!this.hasApp()) return;
                let itm;
                let menu = new core.App.Menu();
                let customTypes = {
                    "§node": {
                        name: "Node",
                    },
                    "§cube": {
                        name: "Cube",
                    },
                    "§arrow": {
                        name: "Arrow",
                    },
                };
                for (let k in customTypes) {
                    let data = customTypes[k];
                    itm = menu.addItem(new core.App.Menu.Item(data.name, (current == k) ? "checkmark" : ""));
                    itm.addHandler("trigger", e => {
                        r.type = k;
                    });
                }
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
            };
            r.addLinkedHandler(this, "type", onType);
        }
        return r;
    }
    remPose(pose) {
        let r = super.remPose(pose);
        if (r instanceof this.constructor.Pose) {
            r.clearLinkedHandlers(this, "type");
        }
        return r;
    }

    get scene() { return this.#scene; }
    get camera() { return this.#camera; }
    get renderer() { return this.#renderer; }
    get controls() { return this.#controls; }
    get composer() { return this.#composer; }

    get axisScene() { return this.#axisScene; }
    hasAxisScene() { return this.axisScene instanceof THREE.Object3D; }

    get field() { return this.#field; }
    set field(v) {
        v = (v instanceof THREE.Object3D) ? v : this.axisScene;
        if (this.field == v) return;
        if (this.hasField()) this.scene.remove(this.field);
        this.#field = (v instanceof THREE.Object3D) ? v.clone() : null;
        if (this.hasField()) this.scene.add(this.field);
    }
    hasField() { return this.field instanceof THREE.Object3D; }

    get isProjection() { return this.#isProjection; }
    set isProjection(v) {
        v = !!v;
        if (this.#isProjection == v) return;
        this.change("isProjection", this.isProjection, this.#isProjection=v);
        this.#camera = this.isProjection ? new THREE.PerspectiveCamera(75, 1, 0.1, 1000) : new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000);
        this.camera.position.set(...(this.isProjection ? [0, 7.5, 7.5] : [10, 10, 10]));
        if (this.controls instanceof OrbitControls) {
            this.controls.object = this.camera;
        } else if (this.controls instanceof PointerLockControls) {
            this.controls.unlock();
            this.controls.disconnect();
            this.#controls = new PointerLockControls(this.camera, this.renderer.domElement);
            this.controls.connect();
        }

        this.composer.dispose();
        this.#composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
        this.composer.addPass(outlinePass);
    }
    get isIsometric() { return !this.isProjection; }
    set isIsometric(v) { this.isProjection = !v; }
    get isOrbit() { return this.#isOrbit; }
    set isOrbit(v) {
        v = !!v;
        if (this.#isOrbit == v) return;
        this.change("isOrbit", this.isOrbit, this.#isOrbit=v);
        if (this.controls instanceof OrbitControls) {
            this.controls.dispose();
        } else if (this.controls instanceof PointerLockControls) {
            this.controls.unlock();
            this.controls.disconnect();
        }
        this.#controls = this.isOrbit ? new OrbitControls(this.camera, this.renderer.domElement) :  new PointerLockControls(this.camera, this.renderer.domElement);
    }
    get isFree() { return !this.isOrbit; }
    set isFree(v) { this.isOrbit = !v; }
    get isMeters() { return this.#isMeters; }
    set isMeters(v) {
        v = !!v;
        if (this.isMeters == v) return;
        this.change("isMeters", this.isMeters, this.#isMeters=v);
    }
    get isCentimeters() { return !this.isMeters; }
    set isCentimeters(v) { this.isMeters = !v; }
    get isDegrees() { return this.#isDegrees; }
    set isDegrees(v) {
        v = !!v;
        if (this.isDegrees == v) return;
        this.change("isDegrees", this.isDegrees, this.#isDegrees=v);
    }
    get isRadians() { return !this.isDegrees; }
    set isRadians(v) { this.isDegrees = !v; }

    get eViewProjection() { return this.#eViewProjection; }
    get eViewIsometric() { return this.#eViewIsometric; }
    get eViewOrbit() { return this.#eViewOrbit; }
    get eViewFree() { return this.#eViewFree; }
    get eUnitsMeters() { return this.#eUnitsMeters; }
    get eUnitsCentimeters() { return this.#eUnitsCentimeters; }
    get eUnitsDegrees() { return this.#eUnitsDegrees; }
    get eUnitsRadians() { return this.#eUnitsRadians; }
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
        this.eGhostBtn.addEventListener("click", e => (this.isGhost = !this.isGhost));

        this.#eSolidBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eSolidBtn);
        this.eSolidBtn.classList.add("custom");
        this.eSolidBtn.textContent = "Solid";
        this.eSolidBtn.addEventListener("click", e => (this.isSolid = !this.isSolid));

        this.#eDisplayType = document.createElement("button");
        this.eContent.appendChild(this.eDisplayType);
        this.eDisplayType.classList.add("display");
        this.eDisplayType.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eDisplayType.addEventListener("click", e => this.post("type"));

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
                "§arrow": "Arrow",
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
    #has;

    #offset;

    #value;
    #composer;
    #scene;
    #camera;

    #objs;
    #passes;

    #preloadedObjs;
    
    constructor() {
        super();
        
        this.#has = false;

        this.#offset = new util.V3();

        this.#value = [];
        this.#composer = null;
        this.#scene = null;
        this.#camera = null;

        this.#objs = [];
        this.#passes = [];

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
        this.#preloadedObjs["§arrow"] = arrow;

        const loader = new GLTFLoader();

        let robots = {};
        let robotModels = {};
        let finished = false;
        (async () => {
            robots = util.ensure(await window.api.get("robots"), "obj");
            robotModels = util.ensure(await window.api.get("robot-models"), "obj");
            finished = true;
        })();

        let type = null, model = null;
        let isGhost = null, isSolid = null;

        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            if (!this.hasPose()) return;
            if (!this.hasThree()) return;
            let color = new util.Color(this.pose.color.startsWith("--") ? getComputedStyle(document.body).getPropertyValue(this.pose.color) : this.pose.color);
            if (this.value.length == 3 || this.value.length == 7) {
                if (!this.pose.type.startsWith("§") && (this.pose.type in robotModels) && !(this.pose.type in preloadedRobots)) {
                    const robot = this.pose.type;
                    preloadedRobots[robot] = null;
                    loader.load(robotModels[robot], gltf => {
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
                            obj.position.x + (0-(bbox.max.x+bbox.min.x)/2),
                            obj.position.y + (0-(bbox.max.y+bbox.min.y)/2),
                            obj.position.z + (0-(bbox.max.z+bbox.min.z)/2),
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
                    }, null, err => (delete preloadedRobots[robot]));
                }
                let obj = this.#objs[0];
                if (!this.#has || type != this.pose.type || model != (this.pose.type.startsWith("§") ? this.#preloadedObjs[this.pose.type] : preloadedRobots[this.pose.type])) {
                    this.#has = true;
                    type = this.pose.type;
                    model = (this.pose.type.startsWith("§") ? this.#preloadedObjs[this.pose.type] : preloadedRobots[this.pose.type]);
                    if (obj instanceof THREE.Object3D) this.scene.remove(obj);
                    obj = (model instanceof THREE.Object3D) ? model.clone() : null;
                    if (obj instanceof THREE.Object3D) this.scene.add(obj);
                    isGhost = null;
                    isSolid = null;
                }
                this.#objs = (obj instanceof THREE.Object3D) ? [obj] : [];
                if (isGhost != this.pose.isGhost) {
                    isGhost = this.pose.isGhost;
                    this.#objs.forEach(obj => {
                        obj.traverse(obj => {
                            if (!obj.isMesh) return;
                            if (obj.material instanceof THREE.Material) {
                                obj.material.transparent = isGhost;
                                if (isGhost) {
                                    obj.material._opacity = obj.material.opacity;
                                    obj.material.opacity *= 0.5;
                                } else {
                                    if ("_opacity" in obj.material)
                                        obj.material.opacity = obj.material._opacity;
                                }
                            }
                        });
                    });
                }
                if (isSolid != this.pose.isSolid) {
                    isSolid = this.pose.isSolid;
                    this.#objs.forEach(obj => {
                        obj.traverse(obj => {
                            if (!obj.isMesh) return;
                            if (obj.material instanceof THREE.Material) {
                                if (isSolid) {
                                    obj.material._color = obj.material.color.clone();
                                    obj.material.color.set(color.toHex(false));
                                } else {
                                    if ("_color" in obj.material)
                                        obj.material.color.set(obj.material._color);
                                }
                            }
                        });
                    });
                }
                if (obj instanceof THREE.Object3D) {
                    if (this.value.length == 3) {
                        let bbox = new THREE.Box3().setFromObject(obj);
                        obj.position.set(
                            (this.value[0] / (this.tab.isMeters?1:100)) + (this.offsetX/100),
                            ((bbox.max.y-bbox.min.y)/2) + (this.offsetY/100),
                            (this.value[1] / (this.tab.isMeters?1:100)) + (this.offsetZ/100),
                        );
                        obj.rotation.set(0, -this.value[2] * (this.tab.isDegrees ? (Math.PI/180) : 1), 0, "XYZ");
                    } else {
                        obj.position.set(
                            -(this.value[0] / (this.tab.isMeters?1:100)) + (this.offsetX/100),
                            (this.value[2] / (this.tab.isMeters?1:100)) + (this.offsetY/100),
                            (this.value[1] / (this.tab.isMeters?1:100)) + (this.offsetZ/100),
                        );
                        obj.quaternion.copy(new THREE.Quaternion(...this.value.slice(3)).premultiply(WPILIBQUATERNIONOFFSET));
                    }
                    if (this.pose.type.startsWith("§")) {
                        let typefs = {
                            "§node": () => {
                                obj.material.color.set(color.toHex(false));
                            },
                            "§cube": () => {
                                obj.material.color.set(color.toHex(false));
                            },
                            "§arrow": () => {
                                obj.traverse(obj => {
                                    if (!obj.isMesh) return;
                                    obj.material.color.set(color.toHex(false));
                                });
                            },
                        };
                        if (this.pose.type in typefs) typefs[this.pose.type]();
                    }
                }
                let pass = this.#passes[0];
                pass.visibleEdgeColor.set(color.toHex(false));
                pass.hiddenEdgeColor.set(util.lerp(color, new util.Color(), 0.5).toHex(false));
                pass.selectedObjects = this.#objs;
                if (this.pose.type.startsWith("§")) {
                    if (this.composer.passes.includes(pass))
                        this.composer.removePass(pass);
                } else {
                    if (!this.composer.passes.includes(pass))
                        this.composer.addPass(pass);
                }
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

    hasTab() { return this.tab instanceof Panel.Odometry3dTab; }
    hasPose() { return this.pose instanceof Panel.Odometry3dTab.Pose; }
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
    get composer() { return this.#composer; }
    set composer(v) {
        v = (v instanceof EffectComposer) ? v : null;
        if (this.composer == v) return;
        this.destroy();
        this.#composer = v;
        this.create();
    }
    hasComposer() { return this.composer instanceof EffectComposer; }
    get scene() { return this.#scene; }
    set scene(v) {
        v = (v instanceof THREE.Scene) ? v : null;
        if (this.scene == v) return;
        this.destroy();
        this.#scene = v;
        this.create();
    }
    hasScene() { return this.scene instanceof THREE.Scene; }
    get camera() { return this.#camera; }
    set camera(v) {
        v = (v instanceof THREE.Camera) ? v : null;
        if (this.camera == v) return;
        this.destroy();
        this.#camera = v;
        this.create();
    }
    hasCamera() { return this.camera instanceof THREE.Camera; }
    hasThree() { return this.hasComposer() && this.hasScene() && this.hasCamera(); }

    destroy() {
        this.#has = false;
        if (!this.hasComposer()) return;
        if (!this.hasThree()) return;
        this.#objs.forEach(obj => {
            this.scene.remove(obj);
        });
        this.#objs = [];
        this.#passes.forEach(pass => {
            this.composer.removePass(pass);
        });
        this.#passes = [];
    }
    create() {
        if (!this.hasTab()) return;
        if (!this.hasPose()) return;
        if (!this.hasThree()) return;
        if (this.value.length == 3 || this.value.length == 7) {
            this.#objs = [];
            let pass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
            pass.edgeStrength = 10;
            pass.edgeGlow = 0;
            pass.edgeThickness = 5;
            this.#passes = [pass];
        }
        this.#objs.forEach(obj => {
            this.scene.add(obj);
        });
        this.#passes.forEach(pass => {
            this.composer.addPass(pass);
        });
    }
};

class Project extends core.Project {
    #widgetData;
    #sidePos;

    constructor(...a) {
        super();

        this.#widgetData = "";
        this.#sidePos = 0.15;

        if (a.length <= 0 || a.length > 4) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project) a = [a.widgetData, a.sidePos, a.config, a.meta];
            else if (util.is(a, "arr")) {
                a = new Project(...a);
                a = [a.widgetData, a.sidePos, a.config, a.meta];
            }
            else if (a instanceof Project.Config) a = ["", a, null];
            else if (a instanceof Project.Meta) a = ["", null, a];
            else if (util.is(a, "str")) a = ["", null, a];
            else if (util.is(a, "obj")) a = [a.widgetData, a.sidePos, a.config, a.meta];
            else a = ["", null, null];
        }
        if (a.length == 2) {
            if (a[0] instanceof Project.Config && a[1] instanceof Project.Meta) a = ["", ...a];
            else a = ["", null, null];
        }
        if (a.length == 3) a = [a[0], 0.15, ...a.slice(1)];


        [this.widgetData, this.sidePos, this.config, this.meta] = a;
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
REVIVER.addRuleAndAllSub(Container);
REVIVER.addRuleAndAllSub(Panel);
REVIVER.addRuleAndAllSub(Project);

export default class App extends core.AppFeature {
    #eBlock;

    #eProjectInfoSourceTypes;
    #eProjectInfoSourceInput;
    #eProjectInfoConnectionBtn;

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
                            { id: "closetab", label: "Close Tab", accelerator: "CmdOrCtrl+W" },
                        ];
                        itms = itms.map((data, i) => App.Menu.Item.fromObj(data));
                        menu.menu.insertItem(itms.pop(), 9);
                        menu.menu.insertItem(itms.pop(), 4);
                    },
                    edit: () => {
                        let itms = [
                            { id: "conndisconn", label: "Toggle Connect / Disconnect", accelerator: "CmdOrCtrl+K" },
                            "separator",
                        ];
                        itms.forEach((data, i) => {
                            let itm = App.Menu.Item.fromObj(data);
                            menu.menu.insertItem(itm, 0+i);
                        });
                    },
                    view: () => {
                        let itms = [
                            { id: "openclose", label: "Toggle Options Opened / Closed", accelerator: "Ctrl+F" },
                            { id: "expandcollapse", label: "Toggle Title Collapsed", accelerator: "Ctrl+Shift+F" },
                            { id: "resetdivider", label: "Reset Divider" },
                            "separator",
                        ];
                        itms.forEach((data, i) => menu.menu.insertItem(App.Menu.Item.fromObj(data), 0+i));
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
                btn.addEventListener("click", e => this.post("cmd-source-type", name));
            });

            this.#eProjectInfoSourceInput = document.createElement("input");
            this.eProjectInfoContent.appendChild(this.eProjectInfoSourceInput);
            this.eProjectInfoSourceInput.type = "text";
            this.eProjectInfoSourceInput.autocomplete = "off";
            this.eProjectInfoSourceInput.spellcheck = false;

            eNav = document.createElement("div");
            this.eProjectInfoContent.appendChild(eNav);
            eNav.classList.add("nav");
            this.#eProjectInfoConnectionBtn = document.createElement("button");
            eNav.appendChild(this.eProjectInfoConnectionBtn);
            this.eProjectInfoConnectionBtn.addEventListener("click", e => this.post("cmd-conndisconn"));

            this.#eBlock = document.getElementById("block");

            const getHovered = (widget, pos, options) => {
                options = util.ensure(options, "obj");
                let canSub = ("canSub" in options) ? options.canSub : true;
                let canTop = ("canTop" in options) ? options.canTop : true;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
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
                if (o instanceof Source.Field) return true;
                if (o instanceof Widget) return true;
                if (o instanceof Panel.Tab) return true;
                return false;
            };
            const canGetWidgetFromData = () => {
                if (this.dragData instanceof Source.Field) return true;
                if (this.dragData instanceof Widget) return true;
                if (this.dragData instanceof Panel.Tab) return true;
                return false;
            };
            const getWidgetFromData = () => {
                if (this.dragData instanceof Source.Field) return new Panel([new Panel.BrowserTab(this.dragData.path)]);
                if (this.dragData instanceof Widget) return this.dragData;
                if (this.dragData instanceof Panel.Tab) return new Panel([this.dragData]);
                return null;
            };
            const canGetTabFromData = () => {
                if (this.dragData instanceof Source.Field) return true;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return true;
                return false;
            };
            const getTabFromData = () => {
                if (this.dragData instanceof Source.Field) return new Panel.BrowserTab(this.dragData.path);
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) return this.dragData;
                return null;
            };
            const canGetFieldFromData = () => {
                if (this.dragData instanceof Source.Field) return true;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) {
                    if (!(this.dragData instanceof Panel.BrowserTab)) return false;
                    if (!this.hasPage("PROJECT")) return false;
                    const page = this.getPage("PROJECT");
                    if (!page.hasSource()) return false;
                    if (!(page.source.root.lookup(this.dragData.path) instanceof Source.Field)) return false;
                    return true;
                }
                return false;
            };
            const getFieldFromData = () => {
                if (this.dragData instanceof Source.Field) return this.dragData;
                if (this.dragData instanceof Widget);
                if (this.dragData instanceof Panel.Tab) {
                    if (!(this.dragData instanceof Panel.BrowserTab)) return null;
                    if (!this.hasPage("PROJECT")) return null;
                    const page = this.getPage("PROJECT");
                    if (!page.hasSource()) return null;
                    return page.source.root.lookup(this.dragData.path);
                }
                return null;
            };
            this.addHandler("drag-start", () => {
                if (this.page != "PROJECT") return;
                if (!isValid(this.dragData)) return;
                let canWidget = canGetWidgetFromData();
                let canTab = canGetTabFromData();
                let canField = canGetFieldFromData();
                if (canField) {
                    let field = getFieldFromData();
                    this.eDrag.innerHTML = "<div class='browserfield'><button class='display'><div class='main'><ion-icon></ion-icon><div></div></div></button></div>";
                    let btn = this.eDrag.children[0].children[0].children[0];
                    let icon = btn.children[0], name = btn.children[1];
                    name.textContent = (field.name.length > 0) ? field.name : "/";
                    let display = getDisplay(field.type, field.get());
                    if (display != null) {
                        if ("src" in display) icon.setAttribute("src", display.src);
                        else icon.setAttribute("name", display.name);
                        if ("color" in display) icon.style.color = display.color;
                        else icon.style.color = "";
                    }
                    return;
                }
                if (canTab) {
                    if (this.dragData instanceof Panel.Tab) {
                        this.eDrag.innerHTML = "<div class='browserfield'><button class='display'><div class='main'><ion-icon></ion-icon><div></div></div></button></div>";
                        let btn = this.eDrag.children[0].children[0].children[0];
                        let icon = btn.children[0], name = btn.children[1];
                        name.textContent = this.dragData.name;
                        if (this.dragData.hasIcon) {
                            if (this.dragData.eTabIcon.hasAttribute("src")) icon.setAttribute("src", this.dragData.eTabIcon.getAttribute("src"));
                            else icon.setAttribute("name", this.dragData.eTabIcon.getAttribute("name"));
                            icon.style.cssText = this.dragData.eTabIcon.style.cssText;
                        } else icon.style.display = "none";
                    }
                }
            });
            this.addHandler("drag-move", e => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
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
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
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
            this.addHandler("cmd-newtab", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (!page.hasActivePanel()) return;
                const active = page.activeWidget;
                active.addTab(new Panel.AddTab());
            });
            this.addHandler("cmd-closetab", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (!page.hasActivePanel()) return;
                const active = page.activeWidget;
                active.remTab(active.tabs[active.tabIndex]);
            });
            this.addHandler("cmd-openclose", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (!page.hasActivePanel()) return;
                const active = page.activeWidget;
                if (!(active.tabs[active.tabIndex] instanceof Panel.Tab)) return;
                active.tabs[active.tabIndex].post("openclose");
            });
            this.addHandler("cmd-expandcollapse", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (!page.hasActivePanel()) return;
                const active = page.activeWidget;
                active.isTitleCollapsed = !active.isTitleCollapsed;
            });
            this.addHandler("cmd-resetdivider", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (!page.hasProject()) return;
                page.project.sidePos = null;
            });
        });
    }

    get eProjectInfoSourceTypes() { return Object.keys(this.#eProjectInfoSourceTypes); }
    hasEProjectInfoSourceType(type) { return type in this.#eProjectInfoSourceTypes; }
    getEProjectInfoSourceType(type) { return this.#eProjectInfoSourceTypes[type]; }
    get eProjectInfoSourceInput() { return this.#eProjectInfoSourceInput; }
    get eProjectInfoConnectionBtn() { return this.#eProjectInfoConnectionBtn; }
    
    get eBlock() { return this.#eBlock; }
    hasEBlock() { return this.eBlock instanceof HTMLDivElement; }
    get isBlockShown() { return this.hasEBlock() ? this.eBlock.classList.contains("this") : null; }
    set isBlockShown(v) {
        if (!this.hasEBlock()) return;
        v ? this.eBlock.classList.add("this") : this.eBlock.classList.remove("this");
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
    #browserFields;
    #toolButtons;
    #widget;
    #activeWidget;
    #source;

    #eSide;
    #eSideMeta;
    #eSideSections;
    #eContent;
    #eDragBox;
    #eDivider;
    
    constructor(app) {
        super(app);

        window.hotteststruct = () => {
            this.source.create([".schema", "struct:my_struct"], "raw");
            this.source.update([".schema", "struct:my_struct"], util.TEXTENCODER.encode("bool value; double arr[4]; enum {a=1, b=2} int8 val; bool value2 : 1; enum{a=1,b=2}int8 value3:2; int16 a:4; uint16 b:5; bool c:1; int16 d:7"));
        };

        this.app.eProjectInfoNameInput.addEventListener("change", e => {
            if (this.choosing) return;
            if (!this.hasProject()) return;
            this.project.meta.name = this.app.eProjectInfoNameInput.value;
        });
        this.app.eProjectInfoSourceInput.addEventListener("change", e => {
            this.project.config.source = this.app.eProjectInfoSourceInput.value;
        });
        this.app.addHandler("cmd-source-type", type => {
            if (!this.hasProject()) return;
            type = String(type);
            if (!["nt", "wpilog"].includes(type)) return;
            this.project.config.sourceType = type;
            this.update(0);
            this.app.post("cmd-conndisconn");
        });
        this.app.addHandler("cmd-conndisconn", () => {
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
                        this.source.file = source.substring(i+1);
                        this.source.data = await window.api.send("wpilog-read", source);
                        const progress = v => (this.app.progress = v);
                        this.source.addHandler("progress", progress);
                        await this.source.build();
                        this.source.remHandler("progress", progress);
                        this.app.progress = 1;
                    } catch (e) {
                        this.app.error("WPILOG Load Error: "+this.project.config.source, e);
                    }
                    this.app.progress = null;
                    delete this.source.importing;
                })();
                return;
            }
        });

        this.#browserFields = [];
        this.#toolButtons = new Set();
        this.#widget = null;
        this.#activeWidget = null;
        this.#source = null;

        this.#eSide = document.createElement("div");
        this.elem.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.#eSideMeta = document.createElement("div");
        this.eSide.appendChild(this.eSideMeta);
        this.eSideMeta.id = "meta";
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
                    s.setIsOpen(!s.getIsOpen());
                });
            s.eContent = document.createElement("div");
            elem.appendChild(s.eContent);
            s.eContent.classList.add("content");
            let idfs = {
                browser: () => s.eContent.classList.add("browser"),
            };
            if (elem.id in idfs) idfs[elem.id]();
        });
        new ResizeObserver(() => this.formatSide()).observe(this.eSide);
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        new ResizeObserver(() => this.formatContent()).observe(this.eContent);
        
        this.addToolButton(new ToolButton("Graph", "graph")).addHandler("drag", () => {
            this.app.dragData = new Panel.GraphTab();
            this.app.dragging = true;
        });
        this.addToolButton(new ToolButton("Table", "table")).addHandler("drag", () => {
            this.app.dragData = new Panel.TableTab();
            this.app.dragging = true;
        });
        this.addToolButton(new ToolButton("Odom2d", "odometry2d")).addHandler("drag", () => {
            this.app.dragData = new Panel.Odometry2dTab();
            this.app.dragging = true;
        });
        this.addToolButton(new ToolButton("Odom3d", "odometry3d")).addHandler("drag", () => {
            this.app.dragData = new Panel.Odometry3dTab();
            this.app.dragging = true;
        });
        this.addToolButton(new ToolButton("WebView", "webview")).addHandler("drag", () => {
            this.app.dragData = new Panel.WebViewTab();
            this.app.dragging = true;
        });
        this.addToolButton(new ToolButton("PLogger", "logger")).addHandler("drag", () => {
            this.app.dragData = new Panel.LoggerTab();
            this.app.dragging = true;
        });
        this.addToolButton(new ToolButton("LogWorks", "logworks")).addHandler("drag", () => {
            this.app.dragData = new Panel.LogWorksTab();
            this.app.dragging = true;
        });

        this.format();

        let timer = 0;
        this.addHandler("update", async delta => {
            if (this.app.page == this.name)
                this.app.title = this.hasProject() ? (this.project.meta.name+" — "+this.sourceInfo) : "?";
            BrowserField.doubleTraverse(
                this.hasSource() ? this.source.root.fields : [],
                this.browserFields,
                (...bfields) => this.addBrowserFieldBulk(...bfields),
                (...bfields) => this.remBrowserFieldBulk(...bfields),
            );
            this.elem.style.setProperty("--side", (100*(this.hasProject() ? this.project.sidePos : 0.15))+"%");
            if (timer > 0) return timer -= delta;
            timer = 1000;
            if (!this.hasProject()) return;
            let r = this.eContent.getBoundingClientRect();
            this.project.meta.thumb = await this.app.capture({
                x: Math.round(r.left), y: Math.round(r.top),
                width: Math.round(r.width), height: Math.round(r.height),
            });
        });
        this.#eDragBox = document.createElement("div");
        this.elem.appendChild(this.eDragBox);
        this.eDragBox.classList.add("dragbox");
        this.eDragBox.innerHTML = "<div></div><div></div>";
        ["dragenter", "dragover"].forEach(name => document.body.addEventListener(name, e => {
            e.preventDefault();
            e.stopPropagation();
            this.eDragBox.classList.add("this");
        }, { capture: true }));
        ["dragleave", "drop"].forEach(name => document.body.addEventListener(name, e => {
            e.preventDefault();
            e.stopPropagation();
            this.eDragBox.classList.remove("this");
        }, { capture: true }));
        document.body.addEventListener("drop", e => {
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
            this.app.post("cmd-conndisconn");
        }, { capture: true });

        this.#eDivider = document.createElement("div");
        this.elem.appendChild(this.eDivider);
        this.eDivider.classList.add("divider");
        this.eDivider.addEventListener("mousedown", e => {
            e.preventDefault();
            const mouseup = () => {
                this.eDivider.classList.remove("this");
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                let r = this.elem.getBoundingClientRect();
                let p = (e.pageX-r.left) / r.width;
                if (!this.hasProject()) return;
                this.project.sidePos = p;
            };
            this.eDivider.classList.add("this");
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.source = null;

        this.addHandler("change-project", () => {
            this.widget = this.hasProject() ? this.project.buildWidget() : null;
        });
        this.addHandler("update", delta => {
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
                this.widget.collapse();
                if (this.hasWidget()) this.widget.update(delta);
            } else this.widget = new Panel();
            if (!this.hasWidget() || !this.widget.contains(this.activeWidget))
                this.activeWidget = null;
            
            this.eSideMeta.textContent = this.sourceInfo;

            this.app.eProjectInfoBtnName.textContent = this.hasProject() ? this.project.meta.name : "";

            if (document.activeElement != this.app.eProjectInfoNameInput)
                this.app.eProjectInfoNameInput.value = this.hasProject() ? this.project.meta.name : "";
            
            if (document.activeElement != this.app.eProjectInfoSourceInput)
                this.app.eProjectInfoSourceInput.value = this.hasProject() ? this.project.config.source : "";

            if (this.source instanceof NTSource) {
                this.app.eProjectInfoSourceInput.placeholder = "Provide an IP...";
                this.app.eProjectInfoConnectionBtn.disabled = false;
                let on = !this.source.connecting && !this.source.connected;
                if (on) this.app.eProjectInfoConnectionBtn.classList.add("on");
                else this.app.eProjectInfoConnectionBtn.classList.remove("on");
                if (!on) this.app.eProjectInfoConnectionBtn.classList.add("off");
                else this.app.eProjectInfoConnectionBtn.classList.remove("off");
                this.app.eProjectInfoConnectionBtn.classList.remove("special");
                this.app.eProjectInfoConnectionBtn.textContent = on ? "Connect" : "Disconnect";
            } else if (this.source instanceof WPILOGSource) {
                this.app.eProjectInfoSourceInput.placeholder = "Path...";
                this.app.eProjectInfoConnectionBtn.disabled = this.source.importing;
                this.app.eProjectInfoConnectionBtn.classList.remove("on");
                this.app.eProjectInfoConnectionBtn.classList.remove("off");
                this.app.eProjectInfoConnectionBtn.classList.add("special");
                this.app.eProjectInfoConnectionBtn.textContent = "Import";
            } else {
                this.app.eProjectInfoNameInput.placeholder = this.hasSource() ? "Unknown source: "+this.source.constructor.name : "No source";
                this.app.eProjectInfoConnectionBtn.disabled = true;
                this.app.eProjectInfoConnectionBtn.classList.remove("on");
                this.app.eProjectInfoConnectionBtn.classList.remove("off");
                this.app.eProjectInfoConnectionBtn.classList.remove("special");
                this.app.eProjectInfoConnectionBtn.textContent = this.hasSource() ? "Unknown source: "+this.source.constructor.name : "No source";
            }
        });

        this.addHandler("refresh", () => {
            this.eSideSections.forEach(name => {
                let section = this.getESideSection(name);
                if (["browser"].includes(name)) section.open();
                else section.close();
            });
        });
    }

    get browserFields() { return [...this.#browserFields]; }
    set browserFields(v) {
        v = util.ensure(v, "arr");
        this.clearBrowserFields();
        v.forEach(v => this.addBrowserField(v));
    }
    clearBrowserFields() {
        let fields = this.browserFields;
        fields.forEach(field => this.remBrowserField(field));
        return fields;
    }
    hasBrowserField(field) {
        if (!(field instanceof BrowserField)) return false;
        return this.#browserFields.includes(field);
    }
    addBrowserField(field) {
        let r = this.addBrowserFieldBulk(field);
        return (r.length > 0) ? r[0] : false;
    }
    addBrowserFieldBulk(...fields) {
        if (fields.length == 1 && util.is(fields[0], "arr")) return this.addBrowserFieldBulk(...fields[0]);
        let doneFields = [];
        fields.forEach(field => {
            if (!(field instanceof BrowserField)) return;
            if (this.hasBrowserField(field)) return;
            this.#browserFields.push(field);
            const onDrag = path => {
                path = util.ensure(path, "arr");
                let field = this.hasSource() ? this.source.root.lookup(path) : null;
                if (!(field instanceof Source.Field)) return;
                this.app.dragData = field;
                this.app.dragging = true;
            };
            field.addLinkedHandler(this, "drag", onDrag);
            this.getESideSection("browser").eContent.appendChild(field.elem);
            doneFields.push(field);
        });
        this.formatSide();
        return doneFields;
    }
    remBrowserField(field) {
        let r = this.remBrowserFieldBulk(field);
        return (r.length > 0) ? r[0] : false;
    }
    remBrowserFieldBulk(...fields) {
        if (fields.length == 1 && util.is(fields[0], "arr")) return this.addBrowserFieldBulk(...fields[0]);
        let doneFields = [];
        fields.forEach(field => {
            if (!(field instanceof BrowserField)) return;
            if (!this.hasBrowserField(field)) return;
            this.#browserFields.splice(this.#browserFields.indexOf(field), 1);
            field.clearLinkedHandlers(this, "drag");
            this.getESideSection("browser").eContent.removeChild(field.elem);
            doneFields.push(field);
        });
        return doneFields;
    }

    get toolButtons() { return [...this.#toolButtons]; }
    set toolButtons(v) {
        v = util.ensure(v, "arr");
        this.clearToolButtons();
        v.forEach(v => this.addToolButton(v));
    }
    clearToolButtons() {
        let btns = this.toolButtons;
        btns.forEach(btn => this.remToolButton(btn));
        return btns;
    }
    hasToolButton(btn) {
        if (!(btn instanceof ToolButton)) return false;
        return this.#toolButtons.has(btn);
    }
    addToolButton(btn) {
        if (!(btn instanceof ToolButton)) return false;
        if (this.hasToolButton(btn)) return false;
        this.#toolButtons.add(btn);
        this.getESideSection("tools").eContent.appendChild(btn.elem);
        return btn;
    }
    remToolButton(btn) {
        if (!(btn instanceof ToolButton)) return false;
        if (!this.hasToolButton(btn)) return false;
        this.#toolButtons.delete(btn);
        this.getESideSection("tools").eContent.removeChild(btn.elem);
        return btn;
    }

    get widget() { return this.#widget; }
    set widget(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.widget == v) return;
        if (this.hasWidget()) {
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
            };
            this.widget.addLinkedHandler(this, "change", onChange);
            this.eContent.appendChild(this.widget.elem);
            this.activeWidget = this.widget;
        }
        if (this.hasProject())
            this.project.widgetData = JSON.stringify(this.widget);
        this.formatContent();
    }
    hasWidget() { return this.widget instanceof Widget; }
    get activeWidget() { return this.#activeWidget; }
    set activeWidget(v) {
        v = (v instanceof Widget) ? v : null;
        if (this.activeWidget == v) return;
        if (this.hasActiveWidget()) this.activeWidget.elem.classList.remove("active");
        this.#activeWidget = v;
        if (this.hasActiveWidget()) this.activeWidget.elem.classList.add("active");
    }
    hasActiveWidget() { return this.activeWidget instanceof Widget; }
    hasActiveContainer() { return this.activeWidget instanceof Container; }
    hasActivePanel() { return this.activeWidget instanceof Panel; }
    get source() { return this.#source; }
    set source(v) {
        v = (v instanceof Source) ? v : null;
        if (this.source == v) return;
        if (this.hasSource()) {
            if (this.source instanceof NTSource) this.source.address = null;
            this.source.clearLinkedHandlers(this, "change");
        }
        this.#source = v;
        if (this.hasSource()) {
            this.source.addLinkedHandler(this, "change", () => {});
        }
    }
    hasSource() { return this.source instanceof Source; }
    get sourceInfo() {
        if (this.source instanceof NTSource) {
            if (!this.source.connecting && !this.source.connected) return "Disconnected";
            if (this.source.connecting) return "Connecting to "+this.source.address;
            const n = this.source.root.nFields;
            return this.source.address+" : "+n+" field"+(n==1?"":"s");
        }
        if (this.source instanceof WPILOGSource) {
            if (!this.source.importing && !this.source.hasData()) return "Nothing imported";
            if (this.source.importing) return "Importing from "+this.source.file;
            const n = this.source.root.nFields;
            return this.source.file+" : "+n+" field"+(n==1?"":"s");
        }
        if (this.hasSource()) return "Unknown source: "+this.source.constructor.name;
        return "No source";
    }

    get eSide() { return this.#eSide; }
    get eSideMeta() { return this.#eSideMeta; }
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
        this.browserFields.sort((a, b) => compare(a.name, b.name)).forEach((field, i) => {
            field.elem.style.order = i;
            field.format();
        });
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

    async enter(data) {
        let projectOnly = [
            "newtab",
            "openclose", "expandcollapse", "resetdivider",
            "savecopy",
            "delete", "closetab", "closeproject",
        ];
        projectOnly.forEach(id => {
            let itm = this.app.menu.findItemWithId(id);
            if (!(itm instanceof App.Menu.Item)) return;
            console.log(itm);
            itm.enabled = itm.visible = true;
        });
        Array.from(document.querySelectorAll(".forproject")).forEach(elem => (elem.style.display = ""));
        await this.refresh();
        if (this.app.hasProject(data.id)) {
            this.project = this.app.getProject(data.id);
        } else if (data.project instanceof Project) {
            this.project = data.project;
        } else {
            this.project = new Project();
            this.project.meta.created = this.project.meta.modified = util.getTime();
        }
    }
    async leave(data) {
        let projectOnly = [
            "newtab",
            "openclose", "expandcollapse", "resetdivider",
            "savecopy",
            "delete", "closetab", "closeproject",
        ];
        projectOnly.forEach(id => {
            let itm = this.app.menu.findItemWithId(id);
            if (!(itm instanceof App.Menu.Item)) return;
            itm.enabled = itm.visible = false;
        });
        Array.from(document.querySelectorAll(".forproject")).forEach(elem => (elem.style.display = "none"));
        this.app.markChange("*all");
        await this.app.post("cmd-save");
        this.project = null;
    }
};
