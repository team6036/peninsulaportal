import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

import { Client } from "./nt4.js";


export default class NTSource extends core.Target {
    #client;
    #logs;
    #root;

    constructor(address) {
        super();

        this.#client = null;
        this.#logs = null;
        this.#root = null;

        this.address = address;
    }

    #hasClient() { return this.#client instanceof Client; }
    get root() { return this.#root; }
    hasRoot() { return this.#root instanceof NTSource.Table; }

    announceTopic(k, type) {
        if (!this.hasRoot()) return false;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (!NTSource.Topic.TYPES.includes(type)) return false;
        if (k.length <= 0) return false;
        let path = k.join("/");
        if (!(path in this.#logs)) this.#logs[path] = [];
        let o = this.root, oPrev = this;
        while (k.length > 0) {
            let name = k.shift();
            [o, oPrev] = [o.lookup(name), o];
            if (k.length > 0) {
                if (!(o instanceof NTSource.Table)) {
                    oPrev.rem(o);
                    o = new NTSource.Table(oPrev, name);
                    oPrev.add(o);
                }
                continue;
            }
            if (!(o instanceof NTSource.Topic)) {
                oPrev.rem(o);
                o = new NTSource.Topic(oPrev, name, type);
                oPrev.add(o);
            }
        }
        return true;
    }
    unannounceTopic(k) {
        if (!this.hasRoot()) return false;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return false;
        let o = this.root, oPrev = this;
        while (k.length > 0) {
            let name = k.shift();
            [o, oPrev] = [o.lookup(name), o];
            if (k.length > 0) {
                if (!(o instanceof NTSource.Table)) {
                    oPrev.rem(o);
                    o = new NTSource.Table(oPrev, name);
                    oPrev.add(o);
                }
                continue;
            }
            oPrev.rem(o);
            o = oPrev;
            while (1) {
                if (!(o instanceof NTSource.Table)) break;
                if (!(o.parent instanceof NTSource.Table)) break;
                if (o.children.length > 0) break;
                o.parent.rem(o);
            }
        }
        return true;
    }
    updateTopic(k, value, ts=null) {
        ts = util.ensure(ts, "num", this.serverTime);
        if (!this.hasRoot()) return false;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return false;
        let path = k.join("/");
        if (!(path in this.#logs)) this.#logs[path] = [];
        this.#logs[path].push([ts, value]);
        let o = this.root, oPrev = this;
        while (k.length > 0) {
            let name = k.shift();
            [o, oPrev] = [o.lookup(name), o];
            if (k.length > 0) {
                if (!(o instanceof NTSource.Table)) {
                    oPrev.rem(o);
                    o = new NTSource.Table(oPrev, name);
                    oPrev.add(o);
                }
                continue;
            }
            if (!(o instanceof NTSource.Topic)) throw "Nonexistent topic with path: "+k;
            o.value = value;
            if (o.isArray) {
                o.value.forEach((v, i) => {
                    let subpath = path+"/"+i;
                    if (!(subpath in this.#logs)) this.#logs[subpath] = [];
                    this.#logs[subpath].push([ts, v]);
                });
            }
        }
        return true;
    }

    getSectionIndexOf(k, ts=null) {
        ts = util.ensure(ts, "num", this.serverTime);
        if (!this.hasRoot()) return null;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return null;
        let path = k.join("/");
        if (!(path in this.#logs)) return null;
        let log = this.#logs[path];
        if (log.length <= 0) return null;
        if (ts < log.at(0)[0]) return -1;
        if (ts >= log.at(-1)[0]) return log.length-1;
        let l = 0, r = log.length-2;
        while (l <= r) {
            let m = Math.floor((l+r)/2);
            let range = [log[m][0], log[m+1][0]];
            if (ts < range[0]) r = m-1;
            else if (ts >= range[1]) l = m+1;
            else return m;
        }
        return null;
    }
    getValueAt(k, ts=null) {
        ts = util.ensure(ts, "num", this.serverTime);
        if (!this.hasRoot()) return null;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return null;
        let path = k.join("/");
        if (!(path in this.#logs)) return null;
        let log = this.#logs[path];
        let i = this.getSectionIndexOf(path, ts);
        if (i == null || i < 0 || i >= log.length) return null;
        return log[i][1];
    }
    getLogLengthFor(k) {
        if (!this.hasRoot()) return null;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return null;
        let path = k.join("/");
        if (!(path in this.#logs)) return null;
        return this.#logs[path].length;
    }
    getLogFor(k, tsStart=null, tsStop=null) {
        tsStart = util.ensure(tsStart, "num", this.serverStartTime);
        tsStop = util.ensure(tsStop, "num", this.serverTime);
        if (!this.hasRoot()) return null;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return null;
        let path = k.join("/");
        if (!(path in this.#logs)) return null;
        let log = this.#logs[path];
        let start = this.getSectionIndexOf(path, tsStart);
        let stop = this.getSectionIndexOf(path, tsStop);
        if (start == null || stop == null) return null;
        return log.slice(start+1, stop+1).map(p => { return { ts: p[0], v: p[1] }; });
    }

    get address() { return this.#hasClient() ? this.#client.baseAddr : null; }
    set address(v) {
        v = (v == null) ? null : String(v);
        if (this.address == v) return;
        if (this.#hasClient()) this.#client.disconnect();
        if (this.hasRoot()) {
            this.root.remHandler("change", this.root._onChange);
            delete this.root._onChange;
        }
        this.#root = (v == null) ? null : new NTSource.Table(this, "");
        if (this.hasRoot()) {
            this.root._onChange = data => this.post("change", data);
            this.root.addHandler("change", this.root._onChange);
        }
        this.#logs = (v == null) ? null : {};
        const client = this.#client = (v == null) ? null : new Client(
            v,
            "Peninsula",
            topic => {
                if (client != this.#client) return;
                this.announceTopic(topic.name, topic.type);
            },
            topic => {
                if (client != this.#client) return;
                this.unannounceTopic(topic.name);
            },
            (topic, ts, v) => {
                if (client != this.#client) return;
                ts /= 1000;
                this.updateTopic(topic.name, v, ts);
            },
            () => {
                if (client != this.#client) return;
                this.#client.startTime = this.#client.clientTime;
                this.post("connected", null);
                this.post("connect-state", this.connected);
                client.subscribe(["/"], true, true, 0.001);
            },
            () => {
                if (client != this.#client) return;
                this.post("disconnected", null);
                this.post("connect-state", this.connected);
            },
        );
        if (this.#hasClient()) this.#client.connect();
    }
    get fullAddress() { return this.#hasClient() ? this.#client.addr : null; }

    get connecting() { return this.#hasClient() && this.disconnected; }
    get connected() { return this.#hasClient() ? this.#client.connectionActive : false; }
    get disconnected() { return !this.connected; }

    get clientStartTime() { return this.#hasClient() ? this.#client.startTime/1000 : null; }
    get serverStartTime() { return this.#hasClient() ? this.#client.clientToServer(this.#client.startTime)/1000 : null; }
    get clientTime() { return this.#hasClient() ? this.#client.clientTime/1000 : null; }
    get serverTime() { return this.#hasClient() ? this.#client.clientToServer(this.#client.clientTime)/1000 : null; }
    get clientTimeSince() { return this.#hasClient() ? (this.clientTime - this.clientStartTime) : null; }
    get serverTimeSince() { return this.#hasClient() ? (this.serverTime - this.serverStartTime) : null; }
}
NTSource.Generic = class NTSourceGeneric extends core.Target {
    #parent;
    #name;

    constructor(parent, name) {
        super();

        if (!(parent instanceof NTSource.Generic || parent instanceof NTSource)) throw "Parent is not valid";

        this.#parent = parent;
        this.#name = String(name);
    }

    get parent() { return this.#parent; }
    get name() { return this.#name; }

    get path() {
        if (this.parent instanceof NTSource) return this.name;
        return this.parent.path + "/" + this.name;
    }

    get nFields() { return 0; }

    lookup(k) {
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length > 0) return null;
        return this;
    }
};
NTSource.Table = class NTSourceTable extends NTSource.Generic {
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
        if (!(child instanceof NTSource.Generic)) return false;
        if (child.parent != this) return false;
        return this.#children.has(child);
    }
    get(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.children.length) return null;
        return this.children[i];
    }
    add(child) {
        if (!(child instanceof NTSource.Generic)) return false;
        if (child.parent != this) return false;
        this.#children.add(child);
        child._onChange = data => {
            let path = this.name+"/"+util.ensure(data, "obj").path;
            this.post("change", { path: path });
        }
        child.addHandler("change", child._onChange);
        this.post("change", null);
        return child;
    }
    rem(child) {
        if (!(child instanceof NTSource.Generic)) return false;
        if (child.parent != this) return false;
        this.#children.delete(child);
        child.remHandler("change", child._onChange);
        delete child._onChange;
        this.post("change", null);
        return child;
    }

    lookup(k) {
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return this;
        let name = k.shift();
        for (let i = 0; i < this.children.length; i++)
            if (this.get(i).name == name)
                return this.get(i).lookup(k.join("/"));
        return null;
    }
}
NTSource.Topic = class NTSourceTopic extends NTSource.Generic {
    #type;
    #value;

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
        if (!NTSource.Topic.TYPES.includes(t)) return null;
        if (t.endsWith("[]")) {
            t = t.substring(0, t.length-2);
            return util.ensure(v, "arr").map(v => NTSource.Topic.ensureType(t, v));
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

    constructor(parent, name, type, value=null) {
        super(parent, name);

        if (!NTSource.Topic.TYPES.includes(type)) throw "Type "+type+" is not a valid type";
        this.#type = type;
        this.#value = null;

        this.value = value;
    }

    get nFields() { return 1; }

    get type() { return this.#type; }
    get isArray() { return this.type.endsWith("[]"); }
    get arraylessType() {
        if (!this.isArray) return this.type;
        return this.type.substring(0, this.type.length-2);
    }
    get value() { return (this.isArray && util.is(this.#value, "arr")) ? this.#value.map(topic => topic.value) : this.#value; }
    set value(v) {
        this.#value = NTSource.Topic.ensureType(this.type, v);
        if (this.isArray) this.#value = this.#value.map((v, i) => new NTSource.Topic(this, i, this.arraylessType, v));
        this.post("change", { path: this.name });
    }

    lookup(k) {
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return this;
        if (!this.isArray) return null;
        let i = parseInt(k);
        if (!util.is(i, "int")) return null;
        if (i < 0 || i >= this.#value.length) return null;
        return this.#value[i];
    }
}
