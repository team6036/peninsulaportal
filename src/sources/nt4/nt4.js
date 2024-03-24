import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as msgpack from "./msgpack.js";


const TYPEINDEXLOOKUP = {
    "boolean": 0,
    "double": 1,
    "int": 2,
    "float": 3,
    "string": 4,
    "json": 4,
    "raw": 5,
    "rpc": 5,
    "msgpack": 5,
    "protobuf": 5,
    "boolean[]": 16,
    "double[]": 17,
    "int[]": 18,
    "float[]": 19,
    "string[]": 20
};

export class NTSubscription extends util.Target {
    #ID;
    #topics;
    #options;

    constructor(o) {
        super();

        this.#options = new NTSubscription.Options(o.options);
        this.set(o);
    }

    set(o) {
        o = util.ensure(o, "obj");
        this.ID = o.ID;
        this.topics = o.topics;
        this.options = o.options;
        return this;
    }

    get ID() { return this.#ID; }
    set ID(v) { this.#ID = util.ensure(v, "int", -1); }
    get topics() { return [...this.#topics]; }
    set topics(v) { this.#topics = util.ensure(v, "arr").map(topic => String(topic)); }
    get options() { return this.#options; }
    set options(v) { this.#options.set(v); }

    toSubscribeObj() {
        return {
            subuid: this.ID,
            topics: this.topics,
            options: this.options.toObj(),
        };
    }
    toUnsubscribeObj() {
        return {
            subuid: this.ID,
        };
    }
}
NTSubscription.Options = class NTSubscriptionOptions extends util.Target {
    #periodic;
    #all;
    #topicsOnly;
    #prefix;

    constructor(o) {
        super();

        this.set(o);
    }

    set(o) {
        o = util.ensure(o, "obj");
        this.periodic = o.periodic;
        this.all = o.all;
        this.topicsOnly = o.topicsOnly;
        this.prefix = o.prefix;
        return this;
    }

    get periodic() { return this.#periodic; }
    set periodic(v) { this.#periodic = Math.max(0, util.ensure(v, "num", 0.1)); }
    get all() { return this.#all; }
    set all(v) { this.#all = !!v; }
    get topicsOnly() { return this.#topicsOnly; }
    set topicsOnly(v) { this.#topicsOnly = !!v; }
    get prefix() { return this.#prefix; }
    set prefix(v) { this.#prefix = !!v; }

    toObj() {
        return {
            periodic: this.periodic,
            all: this.all,
            topicsonly: this.topicsOnly,
            prefix: this.prefix,
        };
    }
};

export class NTTopic extends util.Target {
    #ID;
    #name;
    #type;
    #properties;

    constructor(o) {
        super();

        this.#properties = {};
        this.set(o);
    }

    set(o) {
        o = util.ensure(o, "obj");
        this.ID = o.ID;
        this.name = o.name;
        this.type = o.type;
        this.properties = o.properties;
        return this;
    }

    get ID() { return this.#ID; }
    set ID(v) { this.#ID = util.ensure(v, "int", -1); }
    get name() { return this.#name; }
    set name(v) { this.#name = String(v); }
    get type() { return this.#type; }
    set type(v) { this.#type = String(v); }
    get properties() { return this.#properties; }
    set properties(v) {
        v = util.ensure(v, "obj");
        this.#properties = {};
        for (let k in v) {
            if (v[k] == null) continue;
            this.#properties[k] = v[k];
        }
    }
    get typeIndex() {
        if (this.type in TYPEINDEXLOOKUP)
            return TYPEINDEXLOOKUP[this.type];
        return 5;
    }

    toPublishObj() {
        return {
            pubuid: this.ID,
            name: this.name,
            type: this.type,
            properties: this.properties,
        };
    }
    toUnpublishObj() {
        return {
            pubuid: this.ID,
        };
    }
}

export class NTWebSocket extends util.Target {
    #address;
    #ws;

    #connection;
    #clientStartTime;
    #clientStopTime;

    #offset;
    #latency;
    #lengthCounter;

    static STATES = {
        DISCONNECTED: Symbol("DISCONNECTED"),
        CONNECTING: Symbol("CONNECTING"),
        CONNECTED: Symbol("CONNECTED"),
    };

    constructor(address) {
        super();

        this.#address = String(address);
        this.#ws = null;
        this.#clientStartTime = this.#clientStopTime = null;

        this.#connection = NTWebSocket.STATES.DISCONNECTED;

        this.#offset = 0;
        this.#latency = 0;
        this.#lengthCounter = 0;

        this.addHandler("change-connection", (f, t) => {
            if (t == NTWebSocket.STATES.DISCONNECTED) this.post("disconnected");
            if (t == NTWebSocket.STATES.CONNECTING) this.post("connecting");
            if (t == NTWebSocket.STATES.CONNECTED) this.post("connected");

            if (t == NTWebSocket.STATES.CONNECTED) {
                this.post("ws-connect");
                this.#clientStartTime = this.clientTime;
                this.#clientStopTime = null;
            }
            if (f == NTWebSocket.STATES.CONNECTED && t == NTWebSocket.STATES.DISCONNECTED) {
                this.post("ws-disconnect");
                this.#clientStopTime = this.clientTime;
            }
        });

        this.addHandler("message", data => {
            if (util.is(data, "str")) {
                this.#lengthCounter += data.length;
                let msgs = JSON.parse(data);
                if (!util.is(msgs, "arr")) return;
                msgs.forEach(msg => {
                    if (!util.is(msg, "obj")) return;
                    const method = msg["method"];
                    if (!util.is(method, "str")) return;
                    const params = msg["params"];
                    if (!util.is(params, "obj")) return;
                    let methodfs = {
                        announce: () => this.post("announce", {
                            ID: params.id,
                            name: params.name,
                            type: params.type,
                            properties: params.properties,
                        }),
                        unannounce: () => this.post("unannounce", params.name),
                        properties: () => this.post("properties", params.name, params.update),
                    };
                    if (method in methodfs) methodfs[method]();
                });
                return;
            }
            this.#lengthCounter += data.byteLength;
            data = util.ensure(msgpack.deserialize(data, { multiple: true }), "arr");
            data.forEach(data => {
                data = util.ensure(data, "arr");
                const ID = util.ensure(data[0], "num");
                const ts = util.ensure(data[1], "num");
                const typeIndex = util.ensure(data[2], "num");
                const v = data[3];
                if (ID < 0) {
                    this.onTimestamp(ts, v);
                    return;
                }
                this.post("topic", ID, ts, v);
            });
        });
    }

    get address() { return this.#address; }

    get connection() { return this.#connection; }
    get connected() { return this.connection == NTWebSocket.STATES.CONNECTED; }
    get connecting() { return this.connection == NTWebSocket.STATES.CONNECTING; }
    get disconnected() { return this.connection == NTWebSocket.STATES.DISCONNECTED; }

    get offset() { return this.#offset; }
    get latency() { return this.#latency; }

    get clientTime() { return util.getTime()*1000; }
    get serverTime() { return this.clientToServer(); }
    clientToServer(t=null) {
        t = util.ensure(t, "num", this.clientTime);
        return t + this.offset;
    }
    serverToClient(t=null) {
        t = util.ensure(t, "num", this.serverTime);
        return t - this.offset;
    }
    get clientStartTime() {
        if (this.#clientStartTime == null) return 0;
        return this.#clientStartTime;
    }
    get serverStartTime() { return this.clientToServer(this.clientStartTime); }
    get clientStopTime() {
        if (this.connected) return this.clientTime;
        if (this.#clientStopTime == null) return this.clientStartTime;
        return this.#clientStopTime;
    }
    get serverStopTime() { return this.clientToServer(this.clientStopTime); }

    connect() {
        if (!this.disconnected) return false;
        this.#offset = 0;
        this.#latency = 0;
        this.#lengthCounter = 0;
        const ws = this.#ws = new WebSocket(this.address, "networktables.first.wpi.edu");
        ws.binaryType = "arraybuffer";
        ws.addEventListener("open", () => {
            if (this.#ws != ws) return ws.close();

            this.change("connection", this.connection, this.#connection=NTWebSocket.STATES.CONNECTED);

            this.sendTimestamp();
        });
        ws.addEventListener("close", e => {
            if (this.#ws != ws) return;

            this.change("connection", this.connection, this.#connection=NTWebSocket.STATES.DISCONNECTED);

            this.#ws = null;
            if (e.reason) console.error(e.reason);
        });
        ws.addEventListener("error", e => {
            if (this.#ws != ws) return ws.close();
            
            console.error(e);

            this.post("error", e);

            ws.close();
        });
        ws.addEventListener("message", e => {
            if (this.#ws != ws) return ws.close();

            this.post("message", e.data);
        });
        this.change("connection", this.connection, this.#connection=NTWebSocket.STATES.CONNECTING);
        return true;
    }
    disconnect() {
        if (this.disconnected) return false;
        this.#ws.close();
        return true;
    }

    sendTimestamp() {
        let ts = this.clientTime;
        let txData = msgpack.serialize([-1, 0, TYPEINDEXLOOKUP["int"], ts]);
        this.sendBinary(txData);
    }
    onTimestamp(serverTS, clientTS) {
        let rxTime = this.clientTime;
        let rtt = rxTime - clientTS;
        this.#latency = rtt / 2.0;
        let serverTSAtRx = serverTS + this.#latency;
        this.#offset = serverTSAtRx - rxTime;
    }

    subscribe(subscription) {
        if (!(subscription instanceof NTSubscription)) return false;
        return this.sendJSON("subscribe", subscription.toSubscribeObj());
    }
    unsubscribe(subscription) {
        if (!(subscription instanceof NTSubscription)) return false;
        return this.sendJSON("unsubscribe", subscription.toUnsubscribeObj());
    }
    publish(topic) {
        if (!(topic instanceof NTTopic)) return false;
        return this.sendJSON("publish", topic.toPublishObj());
    }
    unpublish(topic) {
        if (!(topic instanceof NTTopic)) return false;
        return this.sendJSON("unpublish", topic.toUnpublishObj());
    }

    setProperties(topic, properties) {
        return this.sendJSON("setproperties", {
            name: String(topic),
            properties: properties,
        });
    }

    sendJSON(method, data) {
        if (!this.#ws) return false;
        if (!this.connected) return false;
        this.#ws.send(JSON.stringify([{ method: method, params: data }]));
        return true;
    }
    sendBinary(data) {
        if (!this.#ws) return false;
        if (!this.connected) return false;
        this.#ws.send(data);
        return true;
    }
}

export default class NTClient extends util.Target {
    #address;
    #ws;

    #autoConnect;

    #subscriptions;
    #publishedTopics;
    #serverTopics;

    static STATES = NTWebSocket.STATES;

    static newID() { return Math.floor(1000000000*Math.random()); }

    constructor(address) {
        super();

        this.#address = null;
        this.#ws = null;
        this.#autoConnect = false;

        this.#subscriptions = {};
        this.#publishedTopics = {};
        this.#serverTopics = {};

        this.addHandler("change-connection", (f, t) => {
            if (t == NTClient.STATES.DISCONNECTED) this.post("disconnected");
            if (t == NTClient.STATES.CONNECTING) this.post("connecting");
            if (t == NTClient.STATES.CONNECTED) this.post("connected");
        });
        this.addHandler("connected", () => {
            Object.values(this.#publishedTopics).forEach(topic => this.#ws.publish(topic));
            Object.values(this.#subscriptions).forEach(subscription => this.#ws.subscribe(subscription));
        });
        this.addHandler("disconnected", () => {
            this.#serverTopics = {};
        });

        this.address = address;

        const timer = new util.Timer();
        timer.play();
        this.addHandler("update", delta => {
            if (this.connected) {
                if (timer.time < 5000) return;
                timer.clear();
                this.#ws.sendTimestamp();
                return;
            }
            if (timer.time < 500) return;
            timer.clear();
            if (!this.autoConnect) return;
            this.connect();
        });
    }

    get address() { return this.#address; }
    set address(v) {
        v = (v == null) ? null : String(v);
        if (this.address == v) return;
        this.change("address", this.address, this.#address=v);
        if (!this.hasAddress()) {
            this.#ws.disconnect();
            return this.#ws = null;
        }
        const address = this.address;
        const port = 5810;
        const name = "PeninsulaPortal-NT4Client";
        const ws = this.#ws = new NTWebSocket("ws://"+address+":"+port+"/nt/"+name);
        ws.addHandler("change-connection", (f, t) => this.change("connection", f, t));
        ws.addHandler("error", e => {
            if (this.#ws != ws) return ws.disconnect();
            this.post("error", e);
        });
        ws.addHandler("announce", o => {
            if (this.#ws != ws) return ws.disconnect();
            const topic = new NTTopic(o);
            this.#serverTopics[topic.name] = topic;
            this.post("announce", topic);
        });
        ws.addHandler("unannounce", name => {
            if (this.#ws != ws) return ws.disconnect();
            const topic = this.#serverTopics[name];
            if (!topic) return;
            delete this.#serverTopics[name];
            this.post("unannounce", topic);
        });
        ws.addHandler("properties", (name, properties) => {
            if (this.#ws != ws) return ws.disconnect();
            const topic = this.#serverTopics[name];
            if (!topic) return;
            for (let k in properties) {
                let v = properties[k];
                if (v == null)
                    delete topic.properties[k];
                else topic.properties[k] = v;
            }
        });
        ws.addHandler("topic", (ID, ts, v) => {
            if (this.#ws != ws) return ws.disconnect();
            for (const topic of Object.values(this.#serverTopics)) {
                if (ID != topic.ID) continue;
                this.post("topic", topic, ts, v);
                break;
            }
        });
    }
    hasAddress() { return this.address != null; }

    get autoConnect() { return this.#autoConnect; }
    set autoConnect(v) {
        v = !!v;
        if (this.autoConnect == v) return;
        this.change("autoConnect", this.autoConnect, this.#autoConnect=v);
    }

    get connection() { return this.#ws ? this.#ws.connection : null; }
    get connected() { return this.#ws ? this.#ws.connected : false }
    get connecting() { return this.#ws ? this.#ws.connecting : false; }
    get disconnected() { return this.#ws ? this.#ws.disconnected : true; }

    get offset() { return this.#ws ? this.#ws.offset : null; }
    get latency() { return this.#ws ? this.#ws.latency : null; }

    get clientTime() { return this.#ws ? this.#ws.clientTime : 0; }
    get serverTime() { return this.#ws ? this.#ws.serverTime : 0; }
    get clientStartTime() { return this.#ws ? this.#ws.clientStartTime : 0; }
    get serverStartTime() { return this.#ws ? this.#ws.serverStartTime : 0; }
    get clientStopTime() { return this.#ws ? this.#ws.clientStopTime : 0; }
    get serverStopTime() { return this.#ws ? this.#ws.serverStopTime : 0; }

    connect() {
        if (!this.#ws) return false;
        return this.#ws.connect();
    }
    disconnect() {
        if (!this.#ws) return false;
        return this.#ws.disconnect();
    }

    subscribe(patterns, prefix, all=false, periodic=0.1) {
        let subscription = new NTSubscription({
            ID: NTClient.newID(),
            topics: patterns,
            options: {
                prefix: prefix,
                all: all,
                periodic: periodic,
            },
        });
        this.#subscriptions[subscription.ID] = subscription;
        if (this.connected) this.#ws.subscribe(subscription);
        return subscription.ID;
    }
    subscribeTopicsOnly(patterns, prefix) {
        let subscription = new NTSubscription({
            ID: NTClient.newID(),
            topics: patterns,
            options: {
                prefix: prefix,
                topicsOnly: topicsOnly,
            },
        });
        this.#subscriptions[subscription.ID] = subscription;
        if (this.connected) this.#ws.subscribe(subscription);
        return subscription.ID;
    }
    unsubscribe(ID) {
        let subscription = this.#subscriptions[ID];
        if (!subscription) return;
        delete this.#subscriptions[ID];
        if (this.connected) this.#ws.unsubscribe(subscription);
    }
    unsubscribeAll() {
        for (let ID in this.#subscriptions)
            this.unsubscribe(ID);
    }

    setProperties(name, properties) {
        name = String(name);
        properties = util.ensure(properties, "obj");
        let topic = (name in this.#publishedTopics) ? this.#publishedTopics[name] : (name in this.#serverTopics) ? this.#serverTopics[name] : null;
        if (topic) {
            for (let k in properties) {
                let v = properties[k];
                if (v == null)
                    delete top.properties[k];
                else top.properties[k] = v;
            }
        }
        if (this.connected) this.#ws.setProperties(name, properties);
    }
    setPersistent(name, persistent) { return this.setProperties(name, { persistent: !!persistent }); }
    setRetained(name, retained) { return this.setProperties(name, { retained: !!retained }); }

    publishTopic(name, type) {
        name = String(name);
        type = String(type);
        let topic = new NTTopic({
            ID: NTClient.newID(),
            name: name,
            type: type,
        });
        this.#publishedTopics[name] = topic;
        if (this.connected) this.#ws.publish(topic);
    }
    unpublishTopic(name) {
        name = String(name);
        let topic = this.#publishedTopics[name];
        if (!topic) return;
        delete this.#publishedTopics[name];
        if (this.connected) this.#ws.unpublish(topic);
    }

    addSampleWithTS(name, ts, v) {
        name = String(name);
        ts = util.ensure(ts, "num");
        let topic = this.#publishedTopics[name];
        if (!topic) return;
        let data = msgpack.serialize([topic.ID, ts, topic.typeIndex, v]);
        if (this.connected) this.#ws.sendBinary(data);
    }
    addSample(name, v) { return this.addSampleWithTS(name, this.serverTime, v); }

    update(delta) { this.post("update", delta); }
}
