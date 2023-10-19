import * as util from "../util.mjs";

import * as core from "../core.mjs";


export default class Source extends core.Target {
    #useNestRoot;

    #nestRoot;
    #flatRoot;

    #ts;

    constructor(root) {
        super();

        this.#useNestRoot = String(root) == "nest";

        this.#nestRoot = new Source.Table(this, "");
        this.#flatRoot = new Source.Table(this, "");

        this.nestRoot.addHandler("change", data => this.post("change", data));
        this.flatRoot.addHandler("change", data => this.post("change", data));

        this.#ts = 0;
    }

    get useNestRoot() { return this.#useNestRoot; }
    get useFlatRoot() { return !this.useNestRoot; }

    get root() { return this.useNestRoot ? this.nestRoot : this.flatRoot; }
    get nestRoot() { return this.#nestRoot; }
    get flatRoot() { return this.#flatRoot; }

    get ts() { return this.#ts; }
    set ts(v) { this.#ts = util.ensure(v, "num"); }
    get minTS() { return 0; }
    get maxTS() { return 0; }

    create(k, type) {
        if (!Source.Topic.TYPES.includes(type)) return false;
        k = util.ensure(k, "arr");
        if (k.length <= 0) return false;
        this.flatRoot.add(new Source.Topic(this.flatRoot, k.join("/"), type));
        let o = this.nestRoot, oPrev = this;
        while (k.length > 0) {
            let name = k.shift();
            [o, oPrev] = [o.lookup([name]), o];
            if (k.length > 0) {
                if (!(o instanceof Source.Table)) {
                    oPrev.rem(o);
                    o = new Source.Table(oPrev, name);
                    oPrev.add(o);
                }
                continue;
            }
            if (!(o instanceof Source.Topic)) {
                oPrev.rem(o);
                o = new Source.Topic(oPrev, name, type);
                oPrev.add(o);
            }
        }
        this.cleanup();
        return true;
    }
    delete(k) {
        k = util.ensure(k, "arr");
        if (k.length <= 0) return false;
        this.flatRoot.rem(this.flatRoot.lookup([k.join("/")]));
        let o = this.nestRoot, oPrev = this;
        while (k.length > 0) {
            let name = k.shift();
            [o, oPrev] = [o.lookup([name]), o];
            if (k.length > 0) {
                if (!(o instanceof Source.Table)) {
                    oPrev.rem(o);
                    o = new Source.Table(oPrev, name);
                    oPrev.add(o);
                }
                continue;
            }
            oPrev.rem(o);
            o = oPrev;
            while (1) {
                if (!(o instanceof Source.Table)) break;
                if (!(o.parent instanceof Source.Table)) break;
                if (o.children.length > 0) break;
                o.parent.rem(o);
            }
        }
        this.cleanup();
        return true;
    }
    update(k, v, ts=null) {
        ts = util.ensure(ts, "num", this.ts);
        k = util.ensure(k, "arr");
        if (k.length <= 0) return false;
        let o = this.flatRoot.lookup([k.join("/")]);
        if (o instanceof Source.Topic)
            o.update(v, ts);
        o = this.nestRoot; let oPrev = this;
        while (k.length > 0) {
            let name = k.shift();
            [o, oPrev] = [o.lookup([name]), o];
            if (k.length > 0) {
                if (!(o instanceof Source.Table)) {
                    oPrev.rem(o);
                    o = new Source.Table(oPrev, name);
                    oPrev.add(o);
                }
                continue;
            }
            if (!(o instanceof Source.Topic)) throw "Nonexistent topic with path: "+k;
            o.update(v, ts);
        }
        return true;
    }
    clear() {
        this.nestRoot.children.forEach(child => this.nestRoot.rem(child));
        this.flatRoot.children.forEach(child => this.flatRoot.rem(child));
        this.cleanup();
    }
    cleanup() {
        const dfs = generic => {
            if (generic.nFields <= 0) {
                if (generic.hasGenericParent())
                    generic.parent.rem(generic);
                return;
            }
            if (generic instanceof Source.Table)
                generic.children.forEach(child => dfs(child));
        };
        dfs(this.nestRoot);
        dfs(this.flatRoot);
    }
}
Source.Generic = class SourceGeneric extends core.Target {
    #parent;
    #name;

    constructor(parent, name) {
        super();

        if (!(parent instanceof Source.Generic || parent instanceof Source)) throw "Parent is not valid";

        this.#parent = parent;
        this.#name = String(name);
    }

    get parent() { return this.#parent; }
    get name() { return this.#name; }
    hasGenericParent() { return this.parent instanceof Source.Generic; }
    hasSourceParent() { return this.parent instanceof Source; }
    get source() { return this.hasSourceParent() ? this.parent : this.parent.source; }

    get path() {
        if (this.hasSourceParent()) return [];
        return [...this.parent.path, this.name];
    }
    get textPath() { return this.path.join("/"); }

    get nFields() { return 0; }

    lookup(k) {
        k = util.ensure(k, "arr");
        if (k.length > 0) return null;
        return this;
    }
};
Source.Table = class SourceTable extends Source.Generic {
    #children;

    constructor(parent, name) {
        super(parent, name);

        this.#children = new Set();
    }

    get nFields() {
        let n = 0;
        this.children.forEach(child => (n += child.nFields));
        return n;
    }

    get children() { return [...this.#children]; }
    has(child) {
        if (!(child instanceof Source.Generic)) return false;
        if (child.parent != this) return false;
        return this.#children.has(child);
    }
    get(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.children.length) return null;
        return this.children[i];
    }
    add(child) {
        if (!(child instanceof Source.Generic)) return false;
        if (child.parent != this) return false;
        this.#children.add(child);
        child._onChange = data => {
            let path = [this.name, ...util.ensure(util.ensure(data, "obj").path, "arr")];
            this.post("change", { path: path });
        }
        child.addHandler("change", child._onChange);
        this.post("change", null);
        return child;
    }
    rem(child) {
        if (!(child instanceof Source.Generic)) return false;
        if (child.parent != this) return false;
        this.#children.delete(child);
        child.remHandler("change", child._onChange);
        delete child._onChange;
        this.post("change", null);
        return child;
    }

    lookup(k) {
        k = util.ensure(k, "arr");
        if (k.length <= 0) return this;
        let name = k.shift();
        for (let i = 0; i < this.children.length; i++)
            if (this.get(i).name == name)
                return this.get(i).lookup(k);
        return null;
    }
};
Source.Topic = class SourceTopic extends Source.Generic {
    #type;
    #valueLog;
    #arrTopics;

    static TYPES = [
        "boolean", "boolean[]",
        "double", "double[]",
        "float", "float[]",
        "int", "int[]",
        "raw",
        "string", "string[]",
        "null",
    ];

    static ensureType(t, v) {
        t = String(t);
        if (!Source.Topic.TYPES.includes(t)) return null;
        if (t.endsWith("[]")) {
            t = t.substring(0, t.length-2);
            return util.ensure(v, "arr").map(v => Source.Topic.ensureType(t, v));
        }
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
        super(parent, name);

        if (!Source.Topic.TYPES.includes(type)) throw "Type "+type+" is not a valid type";
        this.#type = type;
        this.#valueLog = [];
        this.#arrTopics = [];
    }

    get nFields() { return 1; }

    get type() { return this.#type; }
    get isArray() { return this.type.endsWith("[]"); }
    get arraylessType() {
        if (!this.isArray) return this.type;
        return this.type.substring(0, this.type.length-2);
    }
    get valueLog() { return [...this.#valueLog]; }
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
    update(v, ts=null) {
        v = Source.Topic.ensureType(this.type, v);
        ts = util.ensure(ts, "num", this.source.ts);
        let i = this.getIndex(ts);
        this.#valueLog.splice(i+1, 0, { ts: ts, v: v });
        if (this.isArray) {
            while (this.#arrTopics.length < v.length) this.#arrTopics.push(new Source.Topic(this, this.#arrTopics.length, this.arraylessType));
            while (this.#arrTopics.length > v.length) this.#arrTopics.pop();
            v.forEach((v, i) => this.#arrTopics[i].update(v, ts));
        }
        this.post("change", { path: this.name });
    }
    get(ts=null) {
        ts = util.ensure(ts, "num", this.source.ts);
        let i = this.getIndex(ts);
        if (i < 0 || i >= this.#valueLog.length) return null;
        return this.#valueLog[i].v;
    }
    getRange(tsStart=null, tsStop=null) {
        tsStart = util.ensure(tsStart, "num");
        tsStop = util.ensure(tsStop, "num");
        let start = this.getIndex(tsStart);
        let stop = this.getIndex(tsStop);
        return this.#valueLog.slice(start+1, stop+1).map(log => { return { ts: log.ts, v: log.v }; });
    }

    lookup(k) {
        k = util.ensure(k, "arr");
        if (k.length <= 0) return this;
        if (!this.isArray) return null;
        let i = parseInt(k[0]);
        if (!util.is(i, "int")) return null;
        if (i < 0 || i >= this.#arrTopics.length) return null;
        return this.#arrTopics[i];
    }
};
