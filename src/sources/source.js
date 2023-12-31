import * as util from "../util.mjs";

import StructHelper from "./struct-helper.js";


export function toUint8Array(v) {
    if (v instanceof Uint8Array) return v;
    if (util.is(v, "str")) return util.TEXTENCODER.encode(v);
    try {
        return Uint8Array.from(v);
    } catch (e) {}
    return new Uint8Array();
}


export default class Source extends util.Target {
    #fields;
    #tree;
    #buildTree;

    #ts;
    #tsMin;
    #tsMax;

    #structHelper;
    #structDecodes;

    #playback;

    constructor(buildTree=true) {
        super();

        this.#fields = {};
        this.#tree = new Source.Node(this, "");
        this.#buildTree = !!buildTree;

        this.#ts = 0;
        this.#tsMin = this.#tsMax = 0;

        this.#structHelper = new StructHelper();
        this.structHelper.addHandler("change", () => this.dequeueStructDecode());
        this.#structDecodes = [];

        this.#playback = new util.Playback();
        this.playback.signal = this;
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
        v = Source.generatePath(v);
        return v in this.#fields;
    }
    getField(path) {
        if (!this.hasField(path)) return null;
        path = Source.generatePath(path);
        return this.#fields[path];
    }
    addField(...fields) {
        return util.Target.resultingForEach(fields, field => {
            if (!(field instanceof Source.Field)) return false;
            if (field.source != this) return false;
            if (this.hasField(field)) return false;
            this.#fields[field.path] = field;
            if (this.buildTree) {
                let path = field.path.split("/").filter(part => part.length > 0);
                let node = this.tree;
                while (path.length > 0) {
                    let name = path.shift();
                    if (!node.hasNode(name))
                        node.addNode(new Source.Node(node, name));
                    node = node.getNode(name);
                }
                node.field = field;
                field.node = node;
            }
            field.onAdd();
            return field;
        });
    }
    remField(...fields) {
        return util.Target.resultingForEach(fields, field => {
            if (!(field instanceof Source.Field)) return false;
            if (field.source != this) return false;
            if (!this.hasField(field)) return false;
            field.onRem();
            delete this.#fields[field.path];
            if (this.buildTree) {
                let path = field.path.split("/").filter(part => part.length > 0);
                let node = this.tree;
                while (path.length > 0) {
                    let name = path.shift();
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
            }
            return field;
        });
    }

    get tree() { return this.#tree; }
    get buildTree() { return this.#buildTree; }

    get ts() { return this.#ts; }
    set ts(v) { this.#ts = Math.min(this.tsMax, Math.max(this.tsMin, util.ensure(v, "num"))); }
    get tsMin() { return this.#tsMin; }
    set tsMin(v) { this.#tsMin = util.ensure(v, "num"); }
    get tsMax() { return this.#tsMax; }
    set tsMax(v) { this.#tsMax = util.ensure(v, "num"); }

    get playback() { return this.#playback; }

    get structHelper() { return this.#structHelper; }

    static generateArrayPath(...path) { return path.flatten().join("/").split("/").filter(part => part.length > 0); }
    static generatePath(...path) { return this.generateArrayPath(...path).join("/"); }

    add(path, type) {
        path = Source.generatePath(path);
        let field = new this.constructor.Field(this, path, type);
        return this.addField(field);
    }
    rem(path) {
        return this.remField(path);
    }
    update(path, v, ts=null) {
        if (!this.hasField(path)) return false;
        return this.getField(path).update(v, ts);
    }
    clear() {
        this.clearFields();
        this.tree.clearNodes();
        this.structHelper.clearPatterns();
        return this;
    }

    queueStructDecode(path, type, array, v, ts) {
        this.#structDecodes.push({ path: path, type: type, array: array, v: v, ts: ts });
    }
    dequeueStructDecode() {
        this.#structDecodes = this.#structDecodes.filter(decode => {
            let { path, type, array, v, ts } = decode;
            return !this.structDecode(path, type, array, v, ts);
        });
    }
    structDecode(path, type, array, v, ts) {
        path = Source.generatePath(path);
        type = String(type);
        array = !!array;
        v = toUint8Array(v);
        ts = util.ensure(ts, "num");
        if (!this.structHelper.hasPattern(type)) return false;
        let pattern = this.structHelper.getPattern(type);
        if (pattern.length == null) return false;
        if (array) {
            let datas = util.ensure(pattern.splitData(v), "arr");
            datas.forEach((data, i) => {
                let path2 = path+"/"+i;
                if (!this.hasField(path2)) this.addField(new this.constructor.Field(this, path2, "struct:"+type));
                this.getField(path2).update(data, ts);
            });
        } else {
            let data = util.ensure(pattern.decode(v), "obj");
            pattern.fields.forEach(field => {
                let path2 = path+"/"+field.name;
                if (!this.hasField(path2)) this.addField(new this.constructor.Field(this, path2, field.isStruct ? ("struct:"+field.type) : field.type));
                this.getField(path2).update(data[field.name], ts);
            });
        }
        return true;
    }
    createStruct(name, data) {
        name = String(name);
        if (this.structHelper.hasPattern(name)) return false;
        let pattern = this.structHelper.addPattern(new StructHelper.Pattern(this.structHelper, name, util.TEXTDECODER.decode(toUint8Array(data))));
        pattern.build();
        return pattern;
    }
    createAllStructs() {
        this.fieldObjects.forEach(field => {
            if (field.name.startsWith("struct:") && field.type == "structschema")
                if (field.valueLog.length > 0)
                    this.createStruct(field.name.substring(7), field.valueLog[0].v);
        });
    }

    toSerialized() {
        return {
            ts: this.ts,
            tsMin: this.tsMin, tsMax: this.tsMax,
            fields: this.fieldObjects.map(field => field.toSerialized()),
            tree: this.tree.toSerialized(),
            structDecodes: this.#structDecodes,
        };
    }
    fromSerialized(data) {
        data = util.ensure(data, "obj");
        this.clear();
        this.#structDecodes = util.ensure(data.structDecodes, "arr").map(decode => {
            decode = util.ensure(decode, "obj");
            decode.path = Source.generatePath(decode.path);
            decode.type = String(decode.type);
            decode.array = !!decode.array;
            decode.v = toUint8Array(decode.v);
            decode.ts = util.ensure(decode.ts, "num");
            return decode;
        });
        this.addField(util.ensure(data.fields, "arr").map(data => Source.Field.fromSerialized(this, data)));
        this.createAllStructs();
        this.ts = data.ts;
        this.tsMin = data.tsMin;
        this.tsMax = data.tsMax;
        return this;
    }
}
Source.Field = class SourceField extends util.Target {
    #source;

    #node;

    #path;
    #name;
    #type;
    #valueLog;

    static TYPES = [
        "boolean", "boolean[]",
        "double", "double[]",
        "float", "float[]",
        "int", "int[]",
        "raw",
        "string", "string[]",
        "null",
        "structschema",
    ];

    static ensureType(t, v) {
        t = String(t);
        if (t.startsWith("struct:")) return v;
        if (t.endsWith("[]")) {
            t = t.slice(0, t.length-2);
            return util.ensure(v, "arr").map(v => Source.Field.ensureType(t, v));
        }
        if (t == "structschema") return toUint8Array(v);
        const map = {
            boolean: "bool",
            double: "float",
            float: "float",
            int: "int",
            string: "str",
            null: "null",
        };
        return (t in map) ? util.ensure(v, map[t]) : v;
    }

    constructor(source, path, type) {
        super();

        if (!(source instanceof Source)) throw new Error("Source is not of class Source");
        this.#source = source;

        this.#node = null;

        this.#path = Source.generatePath(path);
        path = this.path.split("/").filter(part => part.length > 0);
        this.#name = (path.length > 0) ? path.at(-1) : "";
        if (type == null) throw new Error("Type is null");
        this.#type = String(type);

        this.#valueLog = [];
    }

    get source() { return this.#source; }

    get node() { return this.#node; }
    set node(v) {
        v = (v instanceof Source.Node) ? v : null;
        if (this.node == v) return;
        this.#node = v;
    }
    hasNode() { return !!this.node; }

    get path() { return this.#path; }

    get name() { return this.#name; }
    get isHidden() { return this.name.startsWith("."); }

    get type() { return this.#type; }
    get isStruct() { return this.type.startsWith("struct:"); }
    get structType() {
        if (!this.isStruct) return this.type;
        return this.type.slice(7);
    }
    get clippedType() {
        if (this.isStruct) return this.structType;
        return this.type;
    }
    get isArray() { return this.clippedType.endsWith("[]"); }
    get arrayType() {
        if (!this.isArray) return this.clippedType;
        return this.clippedType.slice(0, this.clippedType.length-2);
    }
    get isPrimitive() { return Source.Field.TYPES.includes(this.arrayType); }
    get isJustPrimitive() { return this.isPrimitive && !this.isArray; }

    get valueLog() { return [...this.#valueLog]; }
    set valueLog(v) {
        this.#valueLog = util.ensure(v, "arr").map(log => {
            log = util.ensure(log, "obj");
            return {
                ts: util.ensure(log.ts, "num"),
                v: Source.Field.ensureType(this.type, log.v),
                meta: util.ensure(log.meta, "obj"),
            };
        }).sort((a, b) => a.ts-b.ts);
    }

    getIndex(ts=null) {
        ts = util.ensure(ts, "num", this.source.ts);
        if (this.#valueLog.length <= 0) return -1;
        if (ts < this.#valueLog.at(0).ts) return -1;
        if (ts >= this.#valueLog.at(-1).ts) return this.#valueLog.length-1;
        let l = 0, r = this.#valueLog.length-2;
        while (l <= r) {
            let m = Math.floor((l+r)/2);
            let range = [this.#valueLog[m].ts, this.#valueLog[m+1].ts];
            if (ts < range[0]) r = m-1;
            else if (ts >= range[1]) l = m+1;
            else return m;
        }
        return -1;
    }
    get(ts=null) {
        ts = util.ensure(ts, "num", this.source.ts);
        let i = this.getIndex(ts);
        if (i < 0 || i >= this.#valueLog.length) return null;
        let v = this.#valueLog[i].v;
        return v;
    }
    getRange(tsStart=null, tsStop=null) {
        tsStart = util.ensure(tsStart, "num");
        tsStop = util.ensure(tsStop, "num");
        let start = this.getIndex(tsStart);
        let stop = this.getIndex(tsStop);
        return this.#valueLog.slice(start+1, stop+1).map(log => {
            let { ts, v, meta } = log;
            return { ts: ts, v: v, meta: meta };
        });
    }
    update(v, ts=null) {
        v = Source.Field.ensureType(this.type, v);
        ts = util.ensure(ts, "num", this.source.ts);
        let i = this.getIndex(ts);
        this.#valueLog.splice(i+1, 0, { ts: ts, v: v, meta: {} });
        if (this.isStruct) {
            if (this.source.structDecode(this.path, this.arrayType, this.isArray, v, ts)) return;
            this.source.queueStructDecode(this.path, this.arrayType, this.isArray, v, ts);
        } else if (this.isArray) {
            v.forEach((v, i) => {
                let path = this.path+"/"+i;
                if (!this.source.hasField(path)) this.source.addField(new this.source.constructor.Field(this.source, path, this.arrayType));
                this.source.getField(path).update(v, ts);
            });
        } else if (this.name.startsWith("struct:") && this.type == "structschema") this.source.createStruct(this.name.substring(7), v);
    }

    toSerialized() {
        return {
            path: this.path,
            type: this.type,
            valueLog: this.#valueLog,
        };
    }
    static fromSerialized(source, data) {
        data = util.ensure(data, "obj");
        let field = new Source.Field(source, data.path, data.type);
        field.valueLog = data.valueLog;
        return field;
    }
};
Source.Node = class SourceNode extends util.Target {
    #parent;

    #field;

    #name;

    #nodes;

    constructor(parent, name, nodes) {
        super();

        if (!(parent instanceof Source || parent instanceof Source.Node)) throw new Error("Parent is not of class Source nor of class SourceNode");
        this.#parent = parent;

        this.#field = null;

        this.#name = String(name);

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
    get path() {
        let path = (this.parent instanceof Source) ? "" : this.parent.path;
        if (path.length > 0) path += "/";
        path += this.name;
        return path;
    }

    get nodes() { return Object.keys(this.#nodes); }
    get nodeObjects() { return Object.values(this.#nodes); }
    get nNodes() {
        let n = 1;
        this.nodeObjects.forEach(node => (n += node.nNodes));
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
    lookup(path) {
        path = Source.generateArrayPath(path);
        let node = this;
        while (path.length > 0) {
            let name = path.shift();
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
        let node = new Source.Node(parent, null, data.name, data.nodes);
        return node;
    }
};
