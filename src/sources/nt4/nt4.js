import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as msgpack from "./msgpack.js";


const typestrIdxLookup = {
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

class NTSubscription {
    uid = -1;
    topics = new Set();
    options = new NTSubscriptionOptions();
  
    toSubscribeObj() {
        return {
            topics: Array.from(this.topics),
            subuid: this.uid,
            options: this.options.toObj(),
        };
    }
  
    toUnsubscribeObj() {
        return {
            subuid: this.uid,
        };
    }
}

class NTSubscriptionOptions {
    periodic = 0.1;
    all = false;
    topicsOnly = false;
    prefix = false;

    toObj() {
        return {
            periodic: this.periodic,
            all: this.all,
            topicsonly: this.topicsOnly,
            prefix: this.prefix,
        };
    }
}

export class NTTopic {
    uid = -1;
    name = "";
    type = "";
    properties = {};

    toPublishObj() {
        return {
            name: this.name,
            type: this.type,
            pubuid: this.uid,
            properties: this.properties,
        };
    }

    toUnpublishObj() {
        return {
            pubuid: this.uid,
        };
    }

    getTypeIdx() {
        if (this.type in typestrIdxLookup)
            return typestrIdxLookup[this.type];
        return 5;
    }
}

export default class NTClient {
    #name;
    #onTopicAnnounce;
    #onTopicUnannounce;
    #onNewTopicData;
    #onConnect;
    #onDisconnect;
    #onTimestamp;

    #baseAddr;
    #ws;
    #timestampInterval;
    #addr;
    #connectionActive;
    #connectionRequested;
    #serverTimeOffset;
    #networkLatency;
    #rxLengthCounter;

    #subscriptions;
    #publishedTopics;
    #serverTopics;

    constructor(addr, name, onTopicAnnounce, onTopicUnannounce, onNewTopicData, onConnect, onDisconnect, onTimestamp) {
        this.#name = String(name);
        this.#onTopicAnnounce = () => {};
        this.#onTopicUnannounce = () => {};
        this.#onNewTopicData = () => {};
        this.#onConnect = () => {};
        this.#onDisconnect = () => {};
        this.#onTimestamp = () => {};

        this.#baseAddr = "";
        this.#ws = null;
        this.#timestampInterval = null;
        this.#addr = "";
        this.#connectionActive = false;
        this.#connectionRequested = false;
        this.#serverTimeOffset = 0;
        this.#networkLatency = 0;
        this.#rxLengthCounter = 0;

        this.#subscriptions = {};
        this.#publishedTopics = {};
        this.#serverTopics = {};

        this.baseAddr = addr;

        this.onTopicAnnounce = onTopicAnnounce;
        this.onTopicUnannounce = onTopicUnannounce;
        this.onNewTopicData = onNewTopicData;
        this.onConnect = onConnect;
        this.onDisconnect = onDisconnect;
        this.onTimestamp = onTimestamp;
    }

    get name() { return this.#name; }
    get onTopicAnnounce() { return this.#onTopicAnnounce; }
    set onTopicAnnounce(v) {
        v = util.is(v, "func") ? v : (() => {});
        if (this.onTopicAnnounce == v) return;
        this.#onTopicAnnounce = v;
    }
    get onTopicUnannounce() { return this.#onTopicUnannounce; }
    set onTopicUnannounce(v) {
        v = util.is(v, "func") ? v : (() => {});
        if (this.onTopicUnannounce == v) return;
        this.#onTopicUnannounce = v;
    }
    get onNewTopicData() { return this.#onNewTopicData; }
    set onNewTopicData(v) {
        v = util.is(v, "func") ? v : (() => {});
        if (this.onNewTopicData == v) return;
        this.#onNewTopicData = v;
    }
    get onConnect() { return this.#onConnect; }
    set onConnect(v) {
        v = util.is(v, "func") ? v : (() => {});
        if (this.onConnect == v) return;
        this.#onConnect = v;
    }
    get onDisconnect() { return this.#onDisconnect; }
    set onDisconnect(v) {
        v = util.is(v, "func") ? v : (() => {});
        if (this.onDisconnect == v) return;
        this.#onDisconnect = v;
    }
    get onTimestamp() { return this.#onTimestamp; }
    set onTimestamp(v) {
        v = util.is(v, "func") ? v : (() => {});
        if (this.onTimestamp == v) return;
        this.#onTimestamp = v;
    }

    get baseAddr() { return this.#baseAddr; }
    set baseAddr(v) {
        v = String(v);
        if (this.baseAddr == v) return;
        this.#baseAddr = v;
    }
    #hasWS() { return !!this.#ws; }
    get addr() { return this.#addr; }

    get connectionActive() { return this.#connectionActive; }
    get connectionRequested() { return this.#connectionRequested; }
    set connectionRequested(v) {
        v = !!v;
        if (this.connectionRequested == v) return;
        this.#connectionRequested = v;
    }

    connect() {
        if (this.connectionRequested) return;
        this.connectionRequested = true;
        this.#ws_connect();
        this.#timestampInterval = setInterval(() => {
            this.#ws_sendTimestamp();
            let bitrateKbPerSec = ((this.#rxLengthCounter / 1000) * 8) / 5;
            this.#rxLengthCounter = 0;
            // console.log("[NT4] Bitrate: " + Math.round(bitrateKbPerSec).toString() + " kb/s");
        }, 5000);
    }

    disconnect() {
        if (!this.connectionRequested) return;
        this.connectionRequested = false;
        if (this.connectionActive && this.#hasWS()) this.#ws.close();
        clearInterval(this.#timestampInterval);
    }

    subscribe(patterns, prefix, all=false, periodic=0.1) {
        let sub = new NTSubscription();
        sub.uid = this.#newUID();
        sub.topics = new Set(patterns);
        sub.options.prefix = !!prefix;
        sub.options.all = !!all;
        sub.options.periodic = Math.max(0, util.ensure(periodic, "num"));
        this.#subscriptions[sub.uid] = sub;
        if (this.connectionActive) this.#ws_subscribe(sub);
        return sub.uid;
    }

    subscribeTopicsOnly(patterns, prefix) {
        let sub = new NTSubscription();
        sub.uid = this.#newUID();
        sub.topics = new Set(patterns);
        sub.options.prefix = !!prefix;
        sub.options.topicsOnly = true;
        this.#subscriptions[sub.uid] = sub;
        if (this.connectionActive) this.#ws_subscribe(sub);
        return sub.uid;
    }

    unsubscribe(uid) {
        let sub = this.#subscriptions[uid];
        if (!sub) return;
        delete this.#subscriptions[uid];
        if (this.connectionActive)
            this.#ws_unsubscribe(subscription);
    }
    
    clearSubscriptions() {
        for (let uid in this.#subscriptions)
            this.unsubscribe(uid);
    }

    setProperties(topic, properties) {
        topic = String(topic);
        properties = util.ensure(properties, "obj");

        let top = (topic in this.#publishedTopics) ? this.#publishedTopics[topic] : (topic in this.#serverTopics) ? this.#serverTopics[topic] : null;
        if (top) {
            for (let k in properties) {
                let v = properties[k];
                if (v == null) delete top.properties[k];
                else top.properties[k] = v;
            }
        }
        if (this.connectionActive)
            this.#ws_setProperties(topic, properties);
    }
    setPersistent(topic, persistent) {
        this.setProperties(topic, { persistent: !!persistent });
    }
    setRetained(topic, retained) {
        this.setProperties(topic, { retained: !!retained });
    }

    publishTopic(topic, type) {
        topic = String(topic);
        type = String(type);
        let top = new NTTopic();
        top.name = topic;
        top.uid = this.#newUID();
        top.type = type;
        this.#publishedTopics[topic] = top;
        if (this.connectionActive)
            this.#ws_publish(top);
    }
    unpublishTopic(topic) {
        topic = String(topic);
        let top = this.#publishedTopics[topic];
        if (!top) return;
        delete this.#publishedTopics[topic];
        if (this.connectionActive)
            this.#ws_unpublish(top);
    }

    addSample(topic, v) {
        this.addTSSample(topic, this.serverTime, v);
    }
    addTSSample(topic, ts, v) {
        topic = String(topic);
        ts = util.ensure(ts, "num");
        let top = this.#publishedTopics[topic];
        if (!top) return;
        let txData = msgpack.serialize([top.uid, ts, top.getTypeIdx(), v]);
        this.#ws_sendBinary(txData);
    }

    get clientTime() { return util.getTime() * 1000; }
    clientToServer(ts=null) {
        return NTClient.clientToServer(util.ensure(ts, "num", this.clientTime), this.serverTimeOffset);
    }
    static clientToServer(ts, offset) {
        ts = util.ensure(ts, "num", 0);
        offset = util.ensure(offset, "num", 0);
        return ts + offset;
    }
    get serverTime() { return this.clientToServer(); }
    get networkLatency() { return this.#networkLatency; }
    get serverTimeOffset() { return this.#serverTimeOffset; }

    #ws_sendTimestamp() {
        let ts = this.clientTime;
        let txData = msgpack.serialize([-1, 0, typestrIdxLookup["int"], ts]);
        this.#ws_sendBinary(txData);
    }
    #ws_handleReceiveTimestamp(serverTS, clientTS) {
        let rxTime = this.clientTime;
        let rtt = rxTime - clientTS;
        this.#networkLatency = rtt / 2.0;
        let serverTSAtRx = serverTS + this.#networkLatency;
        this.#serverTimeOffset = serverTSAtRx - rxTime;
        this.onTimestamp(this.serverTimeOffset);
    }

    #ws_subscribe(sub) {
        this.#ws_sendJSON("subscribe", sub.toSubscribeObj());
    }
    #ws_unsubscribe(sub) {
        this.#ws_sendJSON("unsubscribe", sub.toUnsubscribeObj());
    }
    #ws_publish(topic) {
        this.#ws_sendJSON("publish", topic.toPublishObj());
    }
    #ws_unpublish(topic) {
        this.#ws_sendJSON("unpublish", topic.toUnpublishObj());
    }
    #ws_setProperties(topic, properties) {
        this.#ws_sendJSON("setproperties", {
            name: topic,
            update: properties,
        });
    }
    #ws_sendJSON(method, params) {
        if (!this.#hasWS()) return;
        if (this.#ws.readyState != WebSocket.OPEN) return;
        this.#ws.send(JSON.stringify([{ method: method, params: params }]));
    }
    #ws_sendBinary(data) {
        if (!this.#hasWS()) return;
        if (this.#ws.readyState != WebSocket.OPEN) return;
        this.#ws.send(data);
    }

    #ws_onOpen() {
        this.#connectionActive = true;
        this.#ws_sendTimestamp();
        Object.values(this.#publishedTopics).forEach(topic => this.#ws_publish(topic));
        Object.values(this.#subscriptions).forEach(sub => this.#ws_subscribe(sub));
        this.onConnect();
    }
    #ws_onClose(e) {
        this.#ws = null;
        this.#connectionActive = false;
        this.onDisconnect();
        this.#serverTopics = {};
        if (this.connectionRequested)
            setTimeout(() => this.#ws_connect(), 500);
        if (e.reason != "") throw e.reason;
    }
    #ws_onError() {
        if (!this.#hasWS()) return;
        this.#ws.close();
    }
    #ws_onMessage(e) {
        if (util.is(e.data, "str")) {
            this.#rxLengthCounter += e.data.length;
            let msgData = JSON.parse(e.data);
            if (!util.is(msgData, "arr")) return;
            msgData.forEach(msg => {
                if (!util.is(msg, "obj")) return;
                if (!("method" in msg) || !("params" in msg)) return;
                let method = msg["method"];
                let params = msg["params"];
                if (!util.is(method, "str")) return;
                if (!util.is(params, "obj")) return;
                let methodfs = {
                    announce: () => {
                        let top = new NTTopic();
                        top.uid = params.id;
                        top.name = params.name;
                        top.type = params.type;
                        top.properties = params.properties;
                        this.#serverTopics[top.name] = top;
                        this.onTopicAnnounce(top);
                    },
                    unannounce: () => {
                        let top = this.#serverTopics.get(params.name);
                        if (!top) return;
                        delete this.#serverTopics[top.name];
                        this.onTopicUnannounce(top);
                    },
                    properties: () => {
                        let top = this.#serverTopics.get(params.name);
                        if (!top) return;
                        for (let k in params.update) {
                            let v = params.update[k];
                            if (v == null) delete top.properties[k];
                            else top.properties[k] = v;
                        }
                    },
                };
                if (method in methodfs) methodfs[method]();
            });
        } else {
            this.#rxLengthCounter += e.data.byteLength;
            let rxArray = msgpack.deserialize(e.data, { multiple: true });
            util.ensure(rxArray, "arr").forEach(data => {
                data = util.ensure(data, "arr");
                let uid = util.ensure(data[0], "num");
                let ts = util.ensure(data[1], "num");
                let typeIdx = util.ensure(data[2], "num");
                let v = data[3];
                if (uid >= 0) {
                    let topic = null;
                    for (let thisTopic of Object.values(this.#serverTopics)) {
                        if (uid != thisTopic.uid) continue;
                        topic = thisTopic;
                        break;
                    }
                    if (!topic) return;
                    this.onNewTopicData(topic, ts, v);
                    return;
                }
                if (uid == -1) {
                    this.#ws_handleReceiveTimestamp(ts, v);
                    return;
                }
            });
        }
    }

    #ws_connect() {
        const port = 5810;
        const prefix = "ws://";

        this.#addr = prefix + this.#baseAddr + ":" + port + "/nt/" + this.name;

        this.#ws = new WebSocket(this.addr, "networktables.first.wpi.edu");
        this.#ws.binaryType = "arraybuffer";
        this.#ws.addEventListener("open", () => this.#ws_onOpen());
        this.#ws.addEventListener("message", e => this.#ws_onMessage(e));
        this.#ws.addEventListener("close", e => this.#ws_onClose(e));
        this.#ws.addEventListener("error", () => this.#ws_onError());
    }

    #newUID() {
        return Math.floor(Math.random() * 100000000);
    }
}
