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
    #useNestRoot;
    #postNest;
    #postFlat;

    #nestRoot;
    #flatRoot;

    #ts;
    #tsMin;
    #tsMax;

    #structHelper;

    #playback;

    constructor(root) {
        super();

        this.#useNestRoot = String(root) == "nest";

        this.#postNest = true;
        this.#postFlat = true;

        this.#nestRoot = new Source.Field(this, "", null);
        this.#flatRoot = new Source.Field(this, "", null);

        this.nestRoot.addHandler("change", data => this.post("change", data));
        this.flatRoot.addHandler("change", data => this.post("change", data));

        this.#ts = 0;
        this.#tsMin = this.#tsMax = 0;

        this.#structHelper = new StructHelper();

        this.#playback = new Source.Playback(this);
    }

    get useNestRoot() { return this.#useNestRoot; }
    get useFlatRoot() { return !this.useNestRoot; }

    get postNest() { return this.#postNest; }
    set postNest(v) { this.#postNest = !!v; }
    get postFlat() { return this.#postFlat; }
    set postFlat(v) { this.#postFlat = !!v; }

    get root() { return this.useNestRoot ? this.nestRoot : this.flatRoot; }
    get nestRoot() { return this.#nestRoot; }
    get flatRoot() { return this.#flatRoot; }

    get ts() { return this.#ts; }
    set ts(v) { this.#ts = util.ensure(v, "num"); }
    get tsMin() { return this.#tsMin; }
    set tsMin(v) { this.#tsMin = util.ensure(v, "num"); }
    get tsMax() { return this.#tsMax; }
    set tsMax(v) { this.#tsMax = util.ensure(v, "num"); }

    get playback() { return this.#playback; }

    get structHelper() { return this.#structHelper; }

    create(k, type) {
        k = util.ensure(k, "arr");
        if (k.length <= 0) return false;
        if (this.postFlat) {
            this.flatRoot.add(new Source.Field(this.flatRoot, k.join("/"), type));
        }
        if (this.postNest) {
            let kk = [...k];
            let o = this.nestRoot, oPrev = this;
            while (kk.length > 0) {
                let name = kk.shift();
                [o, oPrev] = [o.lookup([name]), o];
                if (kk.length > 0) {
                    if (!(o instanceof Source.Field)) {
                        o = new Source.Field(oPrev, name, null);
                        oPrev.add(o);
                    }
                    continue;
                }
                if (!(o instanceof Source.Field)) {
                    o = new Source.Field(oPrev, name, type);
                    oPrev.add(o);
                }
            }
        }
        return true;
    }
    delete(k) {
        k = util.ensure(k, "arr");
        if (k.length <= 0) return false;
        if (this.postFlat) {
            this.flatRoot.rem(this.flatRoot.lookup([k.join("/")]));
        }
        if (this.postNest) {
            let o = this.nestRoot.lookup([...k]), first = true;
            while (o instanceof Source.Field) {
                let oPrev = o.parent;
                if (oPrev instanceof Source.Field) {
                    if (first || (!o.hasType() && o.nFields.length <= 0)) {
                        first = false;
                        oPrev.rem(o);
                    }
                }
                o = oPrev;
            }
        }
        return true;
    }
    update(k, v, ts=null) {
        ts = util.ensure(ts, "num", this.ts);
        k = util.ensure(k, "arr");
        if (k.length <= 0) return false;
        if (this.postFlat) {
            let o = this.flatRoot.lookup([k.join("/")]);
            if (o instanceof Source.Field)
                o.update(v, ts);
        }
        if (this.postNest) {
            let o = this.nestRoot.lookup([...k]);
            if (o instanceof Source.Field) {
                o.update(v, ts);
                if (
                    k.length == 2 &&
                    String(k[0]) == ".schema" &&
                    String(k[1]).startsWith("struct:") &&
                    o.type == "structschema"
                ) {
                    let struct = String(k[1]);
                    if (struct.startsWith("struct:")) {
                        struct = struct.slice(7);
                        if (this.structHelper.hasPattern(struct)) return; // this.structHelper.remPattern(struct);
                        let pattern = this.structHelper.addPattern(new StructHelper.Pattern(this.structHelper, struct, util.TEXTDECODER.decode(v)));
                        pattern.build();
                        this.structHelper.build();
                        this.nestRoot.build();
                        this.flatRoot.build();
                    }
                }
            }
        }
        return true;
    }
    clear() {
        if (this.postNest) this.nestRoot.fields.forEach(field => this.nestRoot.rem(field));
        if (this.postFlat) this.flatRoot.fields.forEach(field => this.flatRoot.rem(field));
    }

    toSerialized() {
        return {
            postNest: this.postNest,
            postFlat: this.postFlat,
            nestRoot: this.nestRoot.toSerialized(),
            flatRoot: this.flatRoot.toSerialized(),
            ts: this.ts,
            tsMin: this.tsMin, tsMax: this.tsMax,
        };
    }
    fromSerialized(data) {
        data = util.ensure(data, "obj");
        this.structHelper.clearPatterns();
        this.postNest = data.postNest;
        this.postFlat = data.postFlat;
        if (this.postNest) this.#nestRoot = Source.Field.fromSerialized(this, data.nestRoot);
        if (this.postFlat) this.#flatRoot = Source.Field.fromSerialized(this, data.flatRoot);
        this.nestRoot.addHandler("change", data => this.post("change", data));
        this.flatRoot.addHandler("change", data => this.post("change", data));
        let schema = this.nestRoot.lookup([".schema"]);
        if (schema instanceof Source.Field)
            schema.fields.forEach(field => {
                if (!field.name.startsWith("struct:")) return;
                if (field.type != "structschema") return;
                let struct = field.name.slice(7);
                if (this.structHelper.hasPattern(struct)) return; // this.structHelper.remPattern(struct);
                let pattern = this.structHelper.addPattern(new StructHelper.Pattern(this.structHelper, struct, util.TEXTDECODER.decode(field.valueLog[0].v)));
                pattern.build();
                this.nestRoot.build();
                this.flatRoot.build();
            });
        this.ts = data.ts;
        this.tsMin = data.tsMin;
        this.tsMax = data.tsMax;
        this.post("change", null);
        return this;
    }
}
Source.Playback = class SourcePlayback extends util.Target {
    #source;

    #paused;

    constructor(source) {
        super();

        if (!(source instanceof Source)) throw "Source "+source+" is not a Source";
        if (source.playback != null) throw "Source already has a playback";

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
    #parent;
    #name;
    #type;
    #valueLog;
    #fields;

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
        if (t.startsWith("struct:")) return util.ensure(v, "obj");
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

    constructor(parent, name, type) {
        super();

        if (!(parent instanceof Source.Field || parent instanceof Source)) throw "Parent "+(util.is(parent, "obj") ? parent.constructor.name : parent)+" is not valid";

        this.#parent = parent;

        this.#name = String(name);
        this.#type = (type == null) ? null : String(type);

        this.#valueLog = [];

        this.#fields = {};
    }

    get parent() { return this.#parent; }
    hasFieldParent() { return this.parent instanceof Source.Field; }
    hasSourceParent() { return this.parent instanceof Source; }
    get source() { return this.hasSourceParent() ? this.parent : this.parent.source; }

    get path() {
        if (this.hasSourceParent()) return [];
        return [...this.parent.path, this.name];
    }
    get textPath() { return this.path.join("/"); }

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

    get valueLog() { return [...this.#valueLog]; }
    set valueLog(v) {
        if (!this.hasType()) return;
        v = util.ensure(v, "arr");
        this.#fields = {};
        let typeCheck = {};
        this.#valueLog = v.map(log => {
            log = util.ensure(log, "obj");
            let ts = util.ensure(log.ts, "num"), v = log.v;
            v = Source.Field.ensureType(this.type, v);
            if (this.isStruct) {
                if (util.is(v, "obj") && v["%"]) {
                    v = util.ensure(v, "obj");
                    v["%"] = true;
                    v.unbuilt = toUint8Array(v.unbuilt);
                    v.built = (v.built == null) ? null : util.ensure(v.built, "obj");
                } else v = { "%": true, unbuilt: toUint8Array(v), built: null };
            } else if (this.isArray) {
                v.forEach((v, i) => {
                    if ((i in typeCheck) && (typeCheck[i] == v)) return;
                    typeCheck[i] = v;
                    if (!(i in this.#fields)) this.add(new Source.Field(this, i, this.arrayType));
                    this.#fields[i].update(v, ts);
                });
            } else;
            return { ts: ts, v: v };
        }).sort((a, b) => a.ts-b.ts);
        this.build();
    }
    getIndex(ts=null) {
        if (!this.hasType()) return -1;
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
        if (!this.hasType()) return null;
        ts = util.ensure(ts, "num", this.source.ts);
        let i = this.getIndex(ts);
        if (i < 0 || i >= this.#valueLog.length) return null;
        let v = this.#valueLog[i].v;
        if (this.isStruct && !this.isArray) v = v.built;
        return v;
    }
    getRange(tsStart=null, tsStop=null) {
        if (!this.hasType()) return [];
        tsStart = util.ensure(tsStart, "num");
        tsStop = util.ensure(tsStop, "num");
        let start = this.getIndex(tsStart);
        let stop = this.getIndex(tsStop);
        return this.#valueLog.slice(start+1, stop+1).map(log => {
            let ts = log.ts, v = log.v;
            if (this.isStruct && !this.isArray) v = v.built;
            return { ts: ts, v: v };
        });
    }
    update(v, ts=null) {
        if (!this.hasType()) return;
        v = Source.Field.ensureType(this.type, v);
        ts = util.ensure(ts, "num", this.source.ts);
        let i = this.getIndex(ts);
        if (this.isStruct) {
            if (util.is(v, "obj") && v["%"]) {
                v = util.ensure(v, "obj");
                v["%"] = true;
                v.unbuilt = toUint8Array(v.unbuilt);
                v.built = (v.built == null) ? null : util.ensure(v.built, "obj");
            } else v = { "%": true, unbuilt: toUint8Array(v), built: null };
        } else if (this.isArray) {
            v.forEach((v, i) => {
                if (!(i in this.#fields)) this.add(new Source.Field(this, i, this.arrayType));
                this.#fields[i].update(v, ts);
            });
        } else;
        this.#valueLog.splice(i+1, 0, { ts: ts, v: v });
        this.build();
        this.post("change", { path: [this.name] });
    }
    build() {
        if (this.isStruct) {
            let pattern = this.source.structHelper.getPattern(this.arrayType);
            let hasPattern = pattern instanceof StructHelper.Pattern;
            this.#valueLog.forEach(log => {
                if (!hasPattern) return;
                if (pattern.length == null) return;
                let ts = log.ts, v = log.v;
                if (util.is(v.built, "obj")) return;
                if (this.isArray) {
                    v.built = util.ensure(pattern.splitData(v.unbuilt), "arr");
                    v.built.forEach((v, i) => {
                        if (!(i in this.#fields)) this.add(new Source.Field(this, i, "struct:"+this.arrayType));
                        this.#fields[i].update(v, ts);
                    });
                } else {
                    v.built = util.ensure(pattern.decode(v.unbuilt), "obj");
                    pattern.fields.forEach(field => {
                        if (!(field.name in this.#fields)) this.add(new Source.Field(this, field.name, field.isStruct ? ("struct:"+field.type) : field.type));
                        this.#fields[field.name].update(v.built[field.name], ts);
                    });
                }
            });
        }
        this.fields.forEach(field => field.build());
    }

    get nFields() {
        let n = 1;
        this.fields.forEach(field => (n += field.nFields));
        return n;
    }
    get fields() { return Object.values(this.#fields); }
    lookup(k) {
        k = util.ensure(k, "arr");
        if (k.length <= 0) return this;
        let kname = k.shift();
        for (let name in this.#fields)
            if (name == kname)
                return this.#fields[name].lookup(k);
        return null;
    }
    has(field) {
        if (!(field instanceof Source.Field)) return false;
        if (field.parent != this) return false;
        return field.name in this.#fields;
    }
    add(field) {
        if (!(field instanceof Source.Field)) return false;
        if (field.parent != this) return false;
        if (field.name in this.#fields) return false;
        this.#fields[field.name] = field;
        field._onChange = () => this.post("change", { path: field.path });
        field.addHandler("change", field._onChange);
        this.post("change", { path: this.path });
        return field;
    }
    rem(field) {
        if (!(field instanceof Source.Field)) return false;
        if (field.parent != this) return false;
        if (!(field.name in this.#fields)) return false;
        delete this.#fields[field.name];
        field.remHandler("change", field._onChange);
        delete field._onChange;
        this.post("change", { path: this.path });
        return field;
    }

    toSerialized() {
        let fields = {};
        this.fields.forEach(field => (fields[field.name] = field.toSerialized()));
        return {
            name: this.name,
            type: this.type,
            valueLog: this.#valueLog,
            fields: fields,
        };
    }
    static fromSerialized(parent, data) {
        data = util.ensure(data, "obj");
        let field = new Source.Field(parent, data.name, data.type);
        field.valueLog = data.valueLog;
        let fields = util.ensure(data.fields, "obj");
        for (let name in fields) field.add(Source.Field.fromSerialized(field, fields[name]));
        return field;
    }
};
