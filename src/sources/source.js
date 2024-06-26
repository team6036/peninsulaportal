import * as util from "../util.mjs";
import * as lib from "../lib.mjs";

import StructHelper from "./struct-helper.js";


export default class Source extends util.Target {
    #fields;
    #tree;

    #ts;
    #tsMin;
    #tsMax;

    #structHelper;
    #structDecodes;

    #playback;

    static getName() { return "Source"; }

    constructor() {
        super();

        this.#fields = {};
        this.#tree = new Source.Node(this, "");

        this.#ts = 0;
        this.#tsMin = this.#tsMax = 0;

        this.#structHelper = new StructHelper();
        this.structHelper.addHandler("change", () => this.dequeueStructDecode());
        this.#structDecodes = [];

        this.#playback = new util.Playback();
        this.playback.signal = this;

        this.addHandler("update", delta => this.playback.update(delta));
    }

    get fields() { return Object.keys(this.#fields); }
    get fieldObjects() { return Object.values(this.#fields); }
    set fields(v) {
        v = util.ensure(v, "arr");
        this.clearFields();
        this.addField(v);
    }
    clearFields() {
        let fields = this.fieldObjects;
        this.remField(fields);
        return fields;
    }
    hasField(v) {
        if (v instanceof Source.Field) return this.hasField(v.path) && v.source == this;
        v = util.generatePath(v);
        return v in this.#fields;
    }
    getField(pth) {
        if (!this.hasField(pth)) return null;
        pth = util.generatePath(pth);
        return this.#fields[pth];
    }
    addField(...fields) {
        return util.Target.resultingForEach(fields, field => {
            if (!(field instanceof Source.Field)) return false;
            if (field.source != this) return false;
            if (this.hasField(field)) return false;
            this.#fields[field.path] = field;
            let pth = field.path.split("/");
            let node = this.tree;
            while (pth.length > 0) {
                let name = pth.shift();
                if (!node.hasNode(name))
                    node.addNode(new Source.Node(node, name));
                node = node.getNode(name);
            }
            node.field = field;
            field.node = node;
            return field;
        });
    }
    remField(...fields) {
        return util.Target.resultingForEach(fields, field => {
            if (!(field instanceof Source.Field)) return false;
            if (field.source != this) return false;
            if (!this.hasField(field)) return false;
            delete this.#fields[field.path];
            let pth = field.path.split("/").filter(part => part.length > 0);
            let node = this.tree;
            while (pth.length > 0) {
                let name = pth.shift();
                if (!node.hasNode(name)) {
                    node = null;
                    break;
                }
                node = node.getNode(name);
            }
            if (node instanceof Source.Node && node.parent instanceof Source.Node)
                node.parent.remNode(node);
            if (node instanceof Source.Node)
                node.field = null;
            field.node = null;
            return field;
        });
    }

    get tree() { return this.#tree; }

    get ts() { return this.#ts; }
    set ts(v) { this.#ts = Math.min(this.tsMax, Math.max(this.tsMin, util.ensure(v, "num"))); }
    get tsMin() { return this.#tsMin; }
    set tsMin(v) { this.#tsMin = util.ensure(v, "num"); }
    get tsMax() { return this.#tsMax; }
    set tsMax(v) { this.#tsMax = util.ensure(v, "num"); }

    get playback() { return this.#playback; }

    get structHelper() { return this.#structHelper; }

    add(pth, type) {
        pth = util.generatePath(pth);
        let field = new this.constructor.Field(this, pth, type);
        return this.addField(field);
    }
    rem(pth) {
        return this.remField(pth);
    }
    update(pth, v, ts=null, volatile=false) {
        if (arguments.length == 1) return this.post("update", arguments[0]);
        if (!this.hasField(pth)) return false;
        return this.getField(pth).update(v, ts, volatile);
    }
    clear() {
        this.clearFields();
        this.tree.clearNodes();
        this.structHelper.clearPatterns();
        return this;
    }

    queueStructDecode(pth, type, array, v, ts) {
        this.#structDecodes.push({ pth: pth, type: type, array: array, v: v, ts: ts });
    }
    dequeueStructDecode() {
        this.#structDecodes = this.#structDecodes.filter(decode => {
            let { pth, type, array, v, ts } = decode;
            return !this.structDecode(pth, type, array, v, ts);
        });
    }
    structDecode(pth, type, array, v, ts, updateDecoded=true) {
        pth = util.generatePath(pth);
        type = String(type);
        array = !!array;
        v = util.toUint8Array(v);
        ts = util.ensure(ts, "num");
        if (!this.hasField(pth)) return null;
        const field = this.getField(pth);
        if (!this.structHelper.hasPattern(type)) return null;
        const pattern = this.structHelper.getPattern(type);
        if (pattern.length == null) return null;
        let decoded = null;
        if (array) {
            let datas = util.ensure(pattern.splitData(v), "arr");
            decoded = datas.map((data, i) => {
                let pth2 = pth+"/"+i;
                let f = this.getField(pth2);
                if (!f) (f = this.addField(new this.constructor.Field(this, pth2, "struct:"+type))).real = false;
                return f.update(data, ts, true);
            });
            if (updateDecoded) field.updateDecoded(decoded, ts);
        } else {
            let data = util.ensure(pattern.decode(v), "obj");
            decoded = {};
            pattern.fields.forEach(field => {
                let pth2 = pth+"/"+field.name;
                let f = this.getField(pth2);
                if (!f) (f = this.addField(new this.constructor.Field(this, pth2, field.isStruct ? ("struct:"+field.type) : field.type))).real = false;
                decoded[field.name] = f.update(data[field.name], ts, true);
            });
            if (updateDecoded) field.updateDecoded(decoded, ts);
        }
        return decoded;
    }
    createStruct(name, data) {
        name = String(name);
        if (this.structHelper.hasPattern(name)) return false;
        let pattern = this.structHelper.addPattern(new StructHelper.Pattern(this.structHelper, name, util.TEXTDECODER.decode(util.toUint8Array(data))));
        pattern.build();
        return pattern;
    }
    createAllStructs() {
        this.fieldObjects.forEach(field => {
            if (!field.name.startsWith("struct:")) return;
            if (field.type != "structschema") return;
            if (field.logsN <= 0) return;
            this.createStruct(field.name.slice(7), field.logsV[0]);
        });
    }

    toSerialized() {
        const fields = {};
        for (let name in this.#fields)
            fields[name] = this.#fields[name].toSerialized();
        return {
            ts: this.ts,
            tsMin: this.tsMin, tsMax: this.tsMax,
            fields: fields,
            tree: this.tree.toSerialized(),
            structDecodes: this.#structDecodes,
        };
    }
    fromSerialized(data) {
        data = util.ensure(data, "obj");
        this.clear();
        this.#structDecodes = util.ensure(data.structDecodes, "arr").map(decode => {
            decode = util.ensure(decode, "obj");
            decode.pth = util.generatePath(decode.pth);
            decode.type = String(decode.type);
            decode.array = !!decode.array;
            decode.v = util.toUint8Array(decode.v);
            decode.ts = util.ensure(decode.ts, "num");
            return decode;
        });
        this.#tree = Source.Node.fromSerialized(this, data.tree);
        const fields = util.ensure(data.fields, "obj");
        for (let name in fields) {
            fields[name] = Source.Field.fromSerialized(this, fields[name]);
            // relinking nodes and fields
            const node = this.tree.lookup(name);
            fields[name].node = node;
            node.field = fields[name];
        }
        this.#fields = fields;
        this.createAllStructs();
        this.ts = data.ts;
        this.tsMin = data.tsMin;
        this.tsMax = data.tsMax;
        return this;
    }
}
Source.Field = class SourceField {
    #source;

    #node;

    #real;

    #path;
    #pathArray;
    #name;
    #isHidden;
    #type;
    #isStruct;
    #isArray;
    #baseType;
    #isPrimitive;
    #isJustPrimitive;
    #isNumerical;

    #logsTS;
    #logsV;
    #logsDec;
    #metaLogsTS;
    #metaLogsV;

    static TYPES = [
        "boolean", "boolean[]",
        "double", "double[]",
        "float", "float[]",
        "int", "int[]",
        "raw",
        "json",
        "string", "string[]",
        "structschema",
    ];

    static ensureType(t, v) {
        t = String(t);
        const map = {
            boolean: "bool",
            double: "float",
            float: "float",
            int: "int",
            string: "str",
            json: "str",
        };
        if (t in map) return util.ensure(v, map[t]);
        if (t.startsWith("struct:")) return v;
        if (t.endsWith("[]")) {
            t = t.slice(0, -2);
            return util.ensure(v, "arr").map(v => Source.Field.ensureType(t, v));
        }
        if (t == "structschema") return util.toUint8Array(v);
        return v;
    }
    static getType(v) {
        if (util.is(v, "bool")) return "boolean";
        if (util.is(v, "int")) return "int";
        if (util.is(v, "num")) return "double";
        if (util.is(v, "str")) return "string";
        if (v instanceof Uint8Array) return "raw";
        if (util.is(v, "arr")) return this.getType(v[0])+"[]";
        return "raw";
    }

    static getDisplay(t, v=null) {
        if (arguments.length == 1 && arguments[0] instanceof this)
            [t, v] = [arguments[0].type, arguments[0].get()];
        if (arguments.length == 1 && arguments[0] instanceof Source.Node)
            [t, v] = arguments[0].hasField() ? [arguments[0].field.type, arguments[0].field.get()] : [null, null];
        t = (t == null) ? null : String(t);
        if (t == null || t.length <= 0) return {
            name: v ? "folder" : "folder-outline",
            color: "",
        };
        if (t.endsWith("[]")) {
            t = t.slice(0, -2);
            let display = this.getDisplay(t, (t == "boolean") ? true : null);
            if (display == null) return null;
            return {
                src: "./assets/icons/array.svg",
                color: display.color,
            };
        }
        if (t.startsWith("struct:")) return {
            name: "cube-outline",
        };
        if (!this.TYPES.includes(t)) return {
            name: "document-outline",
            color: "var(--cr)",
        };
        if (["double", "float", "int"].includes(t)) return {
            src: "./assets/icons/number.svg",
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
        if (t == "json") return {
            src: "./assets/icons/object.svg",
            color: "var(--co)",
        };
        return {
            src: "./assets/icons/variable.svg",
        };
    }
    static getRepresentation(o, alt=false) {
        if (
            util.is(o, "num") ||
            util.is(o, "bool") ||
            util.is(o, "str")
        ) return (alt && util.is(o, "str")) ? `"${o}"` : String(o);
        if (o instanceof Uint8Array) return alt ? util.TEXTDECODER.decode(o) : [...o].map(x => x.toString(16).padStart(2, "0")).join("");
        if (util.is(o, "arr")) return (alt ? "" : "[")+[...o].map(o => this.getRepresentation(o)).join(", ")+(alt ? "" : "]");
        if (util.is(o, "obj")) return JSON.stringify(o);
        return String(o);
    }

    constructor(source, pth, type) {
        if (!(source instanceof Source)) throw new Error("Source is not of class Source");
        this.#source = source;

        this.#node = null;

        this.#real = true;

        this.#path = util.generatePath(pth);
        this.#pathArray = this.path.split("/");
        pth = this.path.split("/");
        this.#name = (pth.length > 0) ? pth.at(-1) : "";
        this.#isHidden = this.name.startsWith(".");
        if (type == null) throw new Error("Type is null");
        this.#type = String(type);
        this.#isStruct = this.type.startsWith("struct:");
        this.#isArray = this.type.endsWith("[]");
        this.#baseType = this.type.slice(this.isStruct ? 7 : 0, this.type.length - (this.isArray ? 2 : 0));
        this.#isPrimitive = Source.Field.TYPES.includes(this.baseType) && (this.type != "json");
        this.#isJustPrimitive = this.isPrimitive && !this.isArray;
        this.#isNumerical = this.isJustPrimitive && ["double", "float", "int"].includes(this.baseType);

        this.#logsTS = [];
        this.#logsV = [];
        this.#logsDec = [];
        this.#metaLogsTS = [];
        this.#metaLogsV = [];
    }

    get source() { return this.#source; }

    get node() { return this.#node; }
    set node(v) {
        v = (v instanceof Source.Node) ? v : null;
        if (this.node == v) return;
        this.#node = v;
    }
    hasNode() { return !!this.node; }

    get real() { return this.#real; }
    set real(v) { this.#real = !!v; }

    get path() { return this.#path; }
    get pathArray() { return this.#pathArray; }

    get name() { return this.#name; }
    get isHidden() { return this.#isHidden; }

    get type() { return this.#type; }
    get isStruct() { return this.#isStruct; }
    get isArray() { return this.#isArray; }
    get baseType() { return this.#baseType; }
    get isPrimitive() { return this.#isPrimitive; }
    get isJustPrimitive() { return this.#isJustPrimitive; }
    get isNumerical() { return this.#isNumerical; }
    get useDec() { return this.isStruct || (this.type == "json"); }

    get logsN() {
        if (!this.useDec) return Math.min(this.#logsTS.length, this.#logsV.length);
        return Math.min(this.#logsTS.length, this.#logsV.length, this.#logsDec.length);
    }
    get logsTS() { return [...this.#logsTS]; }
    set logsTS(v) { this.#logsTS = util.ensure(v, "arr"); }
    get logsV() { return [...this.#logsV]; }
    set logsV(v) { this.#logsV = util.ensure(v, "arr"); }
    get logsDec() { return [...this.#logsDec]; }
    set logsDec(v) {
        if (!this.useDec) return;
        this.#logsDec = util.ensure(v, "arr");
    }

    get metaLogsN() { return Math.min(this.#metaLogsTS.length, this.#metaLogsV.length); }
    get metaLogsTS() { return [...this.#metaLogsTS]; }
    set metaLogsTS(v) { this.#metaLogsTS = util.ensure(v, "arr"); }
    get metaLogsV() { return [...this.#metaLogsV]; }
    set metaLogsV(v) { this.#metaLogsV = util.ensure(v, "arr"); }

    #getIndex(ts) {
        const n = this.logsN;
        if (n <= 0) return -1;
        if (ts >= this.#logsTS[n-1]) return n-1;
        if (ts < this.#logsTS[0]) return -1;
        let l = 0, r = n-2;
        while (l <= r) {
            let m = Math.floor((l+r)/2);
            if (ts < this.#logsTS[m]) r = m-1;
            else if (ts >= this.#logsTS[m+1]) l = m+1;
            else return m;
        }
        return -1;
    }
    getIndex(ts=null) { return this.#getIndex(util.ensure(ts, "num", this.source.ts)); }
    #get(ts) {
        const n = this.logsN;
        let i = this.#getIndex(ts);
        if (i < 0 || i >= n) return null;
        return this.#logsV[i];
    }
    get(ts=null) { return this.#get(util.ensure(ts, "num", this.source.ts)); }
    getRange(tsStart=null, tsStop=null) {
        tsStart = util.ensure(tsStart, "num");
        tsStop = util.ensure(tsStop, "num");
        let start = this.getIndex(tsStart)+1;
        let stop = this.getIndex(tsStop)+1;
        return {
            start: start, stop: stop, n: stop-start,
            ts: this.#logsTS.slice(start, stop),
            v: this.#logsV.slice(start, stop),
        };
    }
    getDecoded(ts=null) {
        if (!this.useDec) return this.get(ts);
        ts = util.ensure(ts, "num", this.source.ts);
        const n = this.logsN;
        let i = this.getIndex(ts);
        if (i < 0 || i >= n) return null;
        return this.#logsDec[i];
    }
    getDecodedRange(tsStart=null, tsStop=null) {
        if (!this.useDec) return this.getRange(tsStart, tsStop);
        tsStart = util.ensure(tsStart, "num");
        tsStop = util.ensure(tsStop, "num");
        let start = this.getIndex(tsStart)+1;
        let stop = this.getIndex(tsStop)+1;
        return {
            start: start, stop: stop, n: stop-start,
            ts: this.#logsTS.slice(start, stop),
            v: this.#logsDec.slice(start, stop),
        };
    }
    update(v, ts=null, volatile=false) {
        if (!volatile) {
            v = Source.Field.ensureType(this.type, v);
            ts = util.ensure(ts, "num", this.source.ts);
        }
        const n = this.logsN;
        const i = volatile ? this.#getIndex(ts) : this.getIndex(ts);
        if (this.isJustPrimitive) {
            if (i >= 0 && i < n)
                if (this.#logsV[i] == v)
                    return v;
            if (i+2 >= 0 && i+2 < n)
                if (this.#logsV[i+2] == v) {
                    this.#logsTS[i+2] = ts;
                    return v;
                }
        }
        this.#logsTS.splice(i+1, 0, ts);
        this.#logsV.splice(i+1, 0, v);
        if (this.isStruct) {
            this.#logsDec.splice(i+1, 0, { r: null });
            const decoded = this.source.structDecode(this.path, this.baseType, this.isArray, v, ts, false);
            if (decoded != null) this.#logsDec[i+1].r = decoded;
            else this.source.queueStructDecode(this.path, this.baseType, this.isArray, v, ts);
            v = this.#logsDec[i+1];
        } else if (this.isArray) {
            v.forEach((v, i) => {
                let pth = this.path+"/"+i;
                if (!this.source.hasField(pth))
                    this.source.addField(new this.source.constructor.Field(this.source, pth, this.baseType)).real = false;
                this.source.getField(pth).update(v, ts, volatile);
            });
        } else if (this.type == "json") {
            let vDec = null;
            try {
                vDec = JSON.parse(v);
            } catch (e) {}
            this.#logsDec.splice(i+1, 0, vDec);
            v = vDec;
            if (util.is(v, "arr")) {
                v.forEach((value, i) => {
                    let pth = this.path+"/"+i;
                    let type = Source.Field.getType(value);
                    if (util.is(value, "arr") || util.is(value, "obj")) {
                        type = "json";
                        value = JSON.stringify(value);
                    }
                    if (!this.source.hasField(pth))
                        this.source.addField(new this.source.constructor.Field(this.source, pth, type)).real = false;
                    this.source.getField(pth).update(value, ts, volatile);
                });
            } else if (util.is(v, "obj")) {
                for (let k in v) {
                    let value = v[k];
                    let pth = this.path+"/"+k;
                    let type = Source.Field.getType(value);
                    if (util.is(value, "arr") || util.is(value, "obj")) {
                        type = "json";
                        value = JSON.stringify(value);
                    }
                    if (!this.source.hasField(pth))
                        this.source.addField(new this.source.constructor.Field(this.source, pth, type)).real = false;
                    this.source.getField(pth).update(value, ts, volatile);
                }
            }
        }
        if (n == 0)
            if (this.name.startsWith("struct:") && this.type == "structschema")
                this.source.createStruct(this.name.slice(7), v);
        return v;
    }
    updateDecoded(dec, ts=null) {
        if (!this.useDec) return this.update(dec, ts);
        dec = util.ensure(dec, "obj");
        ts = util.ensure(ts, "num", this.source.ts);
        const n = this.logsN;
        let i = this.getIndex(ts);
        if (i < 0 || i >= n) return null;
        if (this.isStruct)
            this.#logsDec[i].r = dec;
        else this.#logsDec[i] = dec;
        return dec;
    }

    getMetaIndex(ts=null) {
        ts = util.ensure(ts, "num", this.source.ts);
        const n = this.metaLogsN;
        if (n <= 0) return -1;
        if (ts >= this.#metaLogsTS[n-1]) return n-1;
        if (ts < this.#metaLogsTS[0]) return -1;
        let l = 0, r = n-2;
        while (l <= r) {
            let m = Math.floor((l+r)/2);
            if (ts < this.#metaLogsTS[m]) r = m-1;
            else if (ts >= this.#metaLogsTS[m+1]) l = m+1;
            else return m;
        }
        return -1;
    }
    getMeta(ts=null) {
        ts = util.ensure(ts, "num", this.source.ts);
        let i = this.getMetaIndex(ts);
        const n = this.metaLogsN;
        if (i < 0 || i >= n) return null;
        return this.#metaLogsV[i];
    }
    getMetaRange(tsStart=null, tsStop=null) {
        tsStart = util.ensure(tsStart, "num");
        tsStop = util.ensure(tsStop, "num");
        let start = this.getMetaIndex(tsStart);
        let stop = this.getMetaIndex(tsStop);
        return Array.from(new Array(stop-start).keys()).map(i => {
            i += start+1;
            return {
                i: i,
                ts: this.#metaLogsTS[i],
                v: this.#metaLogsV[i],
            };
        });
    }
    updateMeta(v, ts=null) {
        if (!util.is(v, "obj"))
            try {
                v = JSON.parse(String(v));
            } catch (e) {}
        ts = util.ensure(ts, "num", this.source.ts);
        let i = this.getMetaIndex(ts);
        this.#metaLogsTS.splice(i+1, 0, ts);
        this.#metaLogsV.splice(i+1, 0, v);
        return v;
    }

    toSerialized() {
        const data = {
            real: this.real,
            path: this.path,
            type: this.type,
            logsTS: this.#logsTS,
            logsV: this.#logsV,
            metaLogsTS: this.#metaLogsTS,
            metaLogsV: this.#metaLogsV,
        };
        if (this.useDec) data.logsDec = this.#logsDec;
        return data;
    }
    static fromSerialized(source, data) {
        data = util.ensure(data, "obj");
        let field = new Source.Field(source, data.path, data.type);
        field.real = data.real;
        field.logsTS = data.logsTS;
        field.logsV = data.logsV;
        if (field.useDec) field.logsDec = data.logsDec;
        field.metaLogsTS = data.metaLogsTS;
        field.metaLogsV = data.metaLogsV;
        return field;
    }
};
Source.Node = class SourceNode {
    #parent;

    #field;

    #name;
    #path;

    #nodes;

    constructor(parent, name, nodes) {
        if (!(parent instanceof Source || parent instanceof Source.Node)) throw new Error("Parent is not of class Source nor of class SourceNode");
        this.#parent = parent;

        this.#field = null;

        this.#name = String(name);
        let pth = (this.parent instanceof Source) ? "" : this.parent.path;
        if (pth.length > 0) pth += "/";
        pth += this.name;
        this.#path = pth;

        this.#nodes = {};

        this.nodes = nodes;
    }

    get parent() { return this.#parent; }
    get source() { return (this.parent instanceof Source) ? this.parent : this.parent.source; }

    get field() { return this.#field; }
    set field(v) {
        v = (v instanceof Source.Field) ? v : null;
        if (this.field == v) return;
        this.#field = v;
    }
    hasField() { return !!this.field; }

    get name() { return this.#name; }
    get path() { return this.#path; }

    get nodes() { return Object.keys(this.#nodes); }
    get nodeObjects() { return Object.values(this.#nodes); }
    get nNodes() {
        let n = 1;
        this.nodeObjects.forEach(node => (n += node.nNodes));
        return n;
    }
    get nFields() {
        if (this.hasField()) return 1;
        let n = 0;
        this.nodeObjects.forEach(node => (n += node.nFields));
        return n;
    }
    set nodes(v) {
        v = util.ensure(v, "arr");
        this.clearNodes();
        this.addNode(v);
    }
    clearNodes() {
        let nodes = this.nodeObjects;
        this.remNode(nodes);
        return nodes;
    }
    hasNode(v) {
        if (v instanceof Source.Node) return this.hasNode(v.name) && v.parent == this;
        return v in this.#nodes;
    }
    getNode(name) {
        if (!this.hasNode(name)) return null;
        return this.#nodes[name];
    }
    addNode(...nodes) {
        return util.Target.resultingForEach(nodes, node => {
            if (!(node instanceof Source.Node)) return false;
            if (node.parent != this) return false;
            if (this.hasNode(node)) return false;
            this.#nodes[node.name] = node;
            return node;
        });
    }
    remNode(...nodes) {
        return util.Target.resultingForEach(nodes, node => {
            if (!(node instanceof Source.Node)) return false;
            if (node.parent != this) return false;
            if (!this.hasNode(node)) return false;
            delete this.#nodes[node.name];
            return node;
        });
    }
    lookup(pth) {
        pth = util.generateArrayPath(pth);
        let node = this;
        while (pth.length > 0) {
            let name = pth.shift();
            if (!node.hasNode(name)) return null;
            node = node.getNode(name);
        }
        return node;
    }

    toSerialized() {
        return {
            name: this.name,
            nodes: this.nodeObjects.map(node => node.toSerialized()),
        };
    }
    static fromSerialized(parent, data) {
        data = util.ensure(data, "obj");
        let node = new Source.Node(parent, data.name, []);
        node.nodes = util.ensure(data.nodes, "arr").map(data => this.fromSerialized(node, data));
        return node;
    }
};
