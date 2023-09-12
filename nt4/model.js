import * as util from "../util.js";
import { V } from "../util.js";

import * as core from "../core.js";

import { NT4_Subscription, NT4_SubscriptionOptions, NT4_Topic, NT4_Client } from "./nt4.js";


export default class NTModel extends core.Target {
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

    #hasClient() { return this.#client instanceof NT4_Client; }
    get root() { return this.#root; }
    hasRoot() { return this.#root instanceof NTModel.Table; }

    announceTopic(k, type, ts=null) {
        ts = util.ensure(ts, "num", this.serverTime);
        if (!this.hasRoot()) return false;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (!NTModel.Topic.TYPES.includes(type)) return false;
        if (k.length <= 0) return false;
        let path = k.join("/");
        if (!(path in this.#logs)) this.#logs[path] = [];
        let o = this.root, oPrev = this;
        while (k.length > 0) {
            let name = k.shift();
            [o, oPrev] = [o.lookup(name), o];
            if (k.length > 0) {
                if (!(o instanceof NTModel.Table)) {
                    oPrev.rem(o);
                    o = new NTModel.Table(oPrev, name);
                    oPrev.add(o);
                }
                continue;
            }
            if (!(o instanceof NTModel.Topic)) {
                oPrev.rem(o);
                o = new NTModel.Topic(oPrev, name, type);
                oPrev.add(o);
            }
        }
        return true;
    }
    unannounceTopic(k, ts=null) {
        ts = util.ensure(ts, "num", this.serverTime);
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
                if (!(o instanceof NTModel.Table)) {
                    oPrev.rem(o);
                    o = new NTModel.Table(oPrev, name);
                    oPrev.add(o);
                }
                continue;
            }
            oPrev.rem(o);
            o = oPrev;
            while (1) {
                if (!(o instanceof NTModel.Table)) break;
                if (!(o.parent instanceof NTModel.Table)) break;
                if (o.children.length > 0) break;
                o.parent.rem(o);
            }
        }
        return true;
    }
    updateTopic(k, value, ts=null) {
        ts = util.ensure(ts, "num", this.clientTime);
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
                if (!(o instanceof NTModel.Table)) {
                    oPrev.rem(o);
                    o = new NTModel.Table(oPrev, name);
                    oPrev.add(o);
                }
                continue;
            }
            if (!(o instanceof NTModel.Topic)) throw "Nonexistent topic with path: "+k;
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

    getValueAt(k, ts=null) {
        ts = util.ensure(ts, "num", this.clientTime);
        if (!this.hasRoot()) return null;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return null;
        let path = k.join("/");
        if (!(path in this.#logs)) return null;
        let log = this.#logs[path];
        if (log.length <= 0) return null;
        if (ts < log.at(0)[0]) return null;
        for (let i = 0; i+1 < log.length; i++)
            if (ts >= log[i][0] && ts < log[i+1][0])
                return log[i][1];
        return log.at(-1)[1];
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
        if (!this.hasRoot()) return null;
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length <= 0) return null;
        let path = k.join("/");
        if (!(path in this.#logs)) return null;
        return this.#logs[path].map(point => { return { ts: point[0], v: point[1] }; })
            .filter(point => (tsStart == null) || (point.ts >= tsStart))
            .filter(point => (tsStop == null) || (point.ts <= tsStop));
    }

    get address() { return this.#hasClient() ? this.#client.serverBaseAddr : null; }
    set address(v) {
        v = (v == null) ? null : String(v);
        if (this.address == v) return;
        if (this.#hasClient()) this.#client.ws.close();
        if (this.hasRoot()) {
            this.root.remHandler("change", this.root._onChange);
            delete this.root._onChange;
        }
        this.#root = (v == null) ? null : new NTModel.Table(this, "");
        if (this.hasRoot()) {
            this.root._onChange = () => this.post("change");
            this.root.addHandler("change", this.root._onChange);
        }
        this.#logs = (v == null) ? null : {};
        const client = this.#client = (v == null) ? null : new NT4_Client(
            v,
            topic => {
                if (client != this.#client) return;
                this.announceTopic(topic.name, topic.type, this.clientTime);
            },
            topic => {
                if (client != this.#client) return;
                this.unannounceTopic(topic.name, this.clientTime);
            },
            (topic, ts, value) => {
                if (client != this.#client) return;
                this.updateTopic(topic.name, value, this.clientTime);
            },
            () => {
                if (client != this.#client) return;
                this.#client.connected = true;
                this.#client.clientStartTime = this.clientTime;
                this.#client.serverStartTime = this.serverTime;
                this.post("connected", null);
                this.post("connect-state", this.connected);
                client.subscribePeriodic(["/"], 0.1);
            },
            () => {
                if (client != this.#client) return;
                this.#client.connected = false;
                this.post("disconnected", null);
                this.post("connect-state", this.connected);
            },
            () => {},
            () => {},
        );
    }

    get connected() { return this.#hasClient() ? this.#client.connected : false; }
    get disconnected() { return !this.connected; }

    get clientStartTime() { return this.#hasClient() ? this.#client.clientStartTime : null; }
    get serverStartTime() { return this.#hasClient() ? this.#client.serverStartTime : null; }
    get clientTime() { return this.#hasClient() ? this.#client.getClientTime_us()/1000 : null; }
    get serverTime() { return this.#hasClient() ? this.#client.getServerTime_us()/1000 : null; }
    get clientTimeSince() { return this.#hasClient() ? (this.clientTime - this.clientStartTime) : null; }
    get serverTimeSince() { return this.#hasClient() ? (this.serverTime - this.serverStartTime) : null; }
}
NTModel.Generic = class NTModelGeneric extends core.Target {
    #parent;
    #name;

    constructor(parent, name) {
        super();

        if (!(parent instanceof NTModel.Generic || parent instanceof NTModel)) throw "Parent is not valid";

        this.#parent = parent;
        this.#name = String(name);
    }

    get parent() { return this.#parent; }
    get name() { return this.#name; }

    get path() {
        if (this.parent instanceof NTModel) return this.name;
        return this.parent.path + "/" + this.name;
    }

    lookup(k) {
        k = String(k).split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        if (k.length > 0) return null;
        return this;
    }
};
NTModel.Table = class NTModelTable extends NTModel.Generic {
    #children;

    constructor(parent, name) {
        super(parent, name);

        this.#children = new Set();
    }

    get children() { return [...this.#children]; }
    has(child) {
        if (!(child instanceof NTModel.Generic)) return false;
        if (child.parent != this) return false;
        return this.#children.has(child);
    }
    get(i) {
        i = util.ensure(i, "int");
        if (i < 0 || i >= this.children.length) return null;
        return this.children[i];
    }
    add(child) {
        if (!(child instanceof NTModel.Generic)) return false;
        if (child.parent != this) return false;
        this.#children.add(child);
        child._onChange = () => this.post("change", null);
        child.addHandler("change", child._onChange);
        this.post("change", null);
        return child;
    }
    rem(child) {
        if (!(child instanceof NTModel.Generic)) return false;
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
NTModel.Topic = class NTModelTopic extends NTModel.Generic {
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
        if (!NTModel.Topic.TYPES.includes(t)) return null;
        if (t.endsWith("[]")) {
            t = t.substring(0, t.length-2);
            return util.ensure(v, "arr").map(v => NTModel.Topic.ensureType(t, v));
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

        if (!NTModel.Topic.TYPES.includes(type)) throw "Type "+type+" is not a valid type";
        this.#type = type;
        this.#value = null;

        this.value = value;
    }

    get type() { return this.#type; }
    get isArray() { return this.type.endsWith("[]"); }
    get arraylessType() {
        if (!this.isArray) return this.type;
        return this.type.substring(0, this.type.length-2);
    }
    get value() { return (this.isArray && util.is(this.#value, "arr")) ? this.#value.map(topic => topic.value) : this.#value; }
    set value(v) {
        this.#value = NTModel.Topic.ensureType(this.type, v);
        if (this.isArray) this.#value = this.#value.map((v, i) => new NTModel.Topic(this, i, this.arraylessType, v));
        this.post("change", null);
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
