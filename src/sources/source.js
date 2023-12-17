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

    #playback;

    constructor(buildTree=true) {
        super();

        this.#fields = {};
        this.#tree = new Source.Node(this, "");
        this.#buildTree = !!buildTree;

        this.#ts = 0;
        this.#tsMin = this.#tsMax = 0;

        this.#structHelper = new StructHelper();
        this.structHelper.addHandler("change", () => this.post("struct"));

        this.#playback = new Source.Playback(this);
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
        fields = fields.flatten();
        let r;
        if (fields.length == 1) {
            let field = fields[0];
            r = false;
            if (!(field instanceof Source.Field));
            else if (field.source != this);
            else if (this.hasField(field));
            else {
                this.#fields[field.path] = field;
                r = field;
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
            }
        } else {
            r = [];
            fields.forEach(field => {
                let r2 = this.addField(field);
                if (!r2) return;
                r.push(r2);
            });
        }
        return r;
    }
    remField(...fields) {
        fields = fields.flatten();
        let r;
        if (fields.length == 1) {
            let field = fields[0];
            r = false;
            if (!(field instanceof Source.Field));
            else if (field.source != this);
            else if (!this.hasField(field));
            else {
                delete this.#fields[field.path];
                r = field;
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
                    if (node instanceof Source.Field && node.parent instanceof Source.Field)
                        node.parent.remNode(node);
                    if (node instanceof Source.Field)
                        node.field = null;
                    field.node = null;
                }
            }
        } else {
            r = [];
            fields.forEach(field => {
                let r2 = this.remField(field);
                if (!r2) return;
                r.push(r2);
            });
        }
        return r;
    }

    get tree() { return this.#tree; }
    get buildTree() { return this.#buildTree; }

    get ts() { return this.#ts; }
    set ts(v) { this.#ts = util.ensure(v, "num"); }
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
        };
    }
    fromSerialized(data) {
        data = util.ensure(data, "obj");
        this.clear();
        this.addField(util.ensure(data.fields, "arr").map(data => Source.Field.fromSerialized(this, data)));
        this.createAllStructs();
        this.ts = data.ts;
        this.tsMin = data.tsMin;
        this.tsMax = data.tsMax;
        return this;
    }
}
Source.Playback = class SourcePlayback extends util.Target {
    #source;

    #paused;

    constructor(source) {
        super();

        if (!(source instanceof Source)) throw new Error("Source is not of class Source");
        if (source.playback != null) throw new Error("Source already has a playback");

        this.#source = source;

        this.#paused = false;
    }

    get source() { return this.#source; }

    get paused() { return this.#paused; }
    set paused(v) { this.#paused = !!v; }
    get playing() { return !this.paused; }
    set playing(v) { this.paused = !v; }
    pause() { return this.paused = true; }
    play() { return this.playing = true; }

    get finished() { return this.source.ts >= this.source.tsMax; }

    update(delta) {
        delta = util.ensure(delta, "num");
        if (this.paused) return;
        this.source.ts = Math.min(this.source.tsMax, Math.max(this.source.tsMin, this.source.ts+delta));
    }
};
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
    hasNode() { return this.node instanceof Source.Node; }

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
        console.log(this.path, this.valueLog.length, v.length);
        this.#valueLog = util.ensure(v, "arr").map(log => {
            log = util.ensure(log, "obj");
            return { ts: util.ensure(log.ts, "num"), v: Source.Field.ensureType(this.type, log.v) };
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
            let ts = log.ts, v = log.v;
            return { ts: ts, v: v };
        });
    }
    update(v, ts=null) {
        v = Source.Field.ensureType(this.type, v);
        ts = util.ensure(ts, "num", this.source.ts);
        let i = this.getIndex(ts);
        this.#valueLog.splice(i+1, 0, { ts: ts, v: v });
        if (this.isStruct) {
            const checkStructFail = () => this.source.addLinkedHandler(this, "struct", checkStruct);
            const checkStruct = () => {
                this.source.remLinkedHandler(this, "struct", checkStruct);
                if (!this.source.structHelper.hasPattern(this.arrayType)) return checkStructFail();
                let pattern = this.source.structHelper.getPattern(this.arrayType);
                if (pattern.length == null) return checkStructFail();
                if (this.isArray) {
                    let datas = util.ensure(pattern.splitData(v), "arr");
                    datas.forEach((data, i) => {
                        let path = this.path+"/"+i;
                        if (!this.source.hasField(path)) this.source.addField(new this.source.constructor.Field(this.source, path, "struct:"+this.arrayType));
                        this.source.getField(path).update(data, ts);
                    });
                } else {
                    let data = util.ensure(pattern.decode(v), "obj");
                    pattern.fields.forEach(field => {
                        let path = this.path+"/"+field.name;
                        if (!this.source.hasField(path)) this.source.addField(new this.source.constructor.Field(this.source, path, field.isStruct ? ("struct:"+field.type) : field.type));
                        this.source.getField(path).update(data[field.name], ts);
                    });
                }
            };
            checkStruct();
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
        // field.#valueLog = util.ensure(data.valueLog, "arr").map(log => {
        //     log = util.ensure(log, "obj");
        //     return { ts: util.ensure(log.ts, "num"), v: Source.Field.ensureType(field.type, log.v) };
        // }).sort((a, b) => a.ts-b.ts);
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
    hasField() { return this.field instanceof Source.Field; }

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
        nodes = nodes.flatten();
        let r;
        if (nodes.length == 1) {
            let node = nodes[0];
            r = false;
            if (!(node instanceof Source.Node));
            else if (node.parent != this);
            else if (this.hasNode(node));
            else {
                this.#nodes[node.name] = node;
                r = node;
            }
        } else {
            r = [];
            nodes.forEach(node => {
                let r2 = this.addNode(node);
                if (!r2) return;
                r.push(r2);
            });
        }
        return r;
    }
    remNode(...nodes) {
        nodes = nodes.flatten();
        let r;
        if (nodes.length == 1) {
            let node = nodes[0];
            r = false;
            if (!(node instanceof Source.Node));
            else if (node.parent != this);
            else if (!this.hasNode(node));
            else {
                delete this.#nodes[node.name];
                r = node;
            }
        } else {
            r = [];
            nodes.forEach(node => {
                let r2 = this.remNode(node);
                if (!r2) return;
                r.push(r2);
            });
        }
        return r;
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
