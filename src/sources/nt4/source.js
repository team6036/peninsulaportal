import * as util from "../../util.mjs";

import NTClient from "./nt4.js";

import Source from "../source.js";


export default class NTSource extends Source {
    #client;

    constructor(address) {
        super("nest");

        this.postFlat = false;

        this.#client = null;

        this.address = address;
    }

    #hasClient() { return this.#client instanceof NTClient; }

    hasRoot() { return true; }

    announceTopic(k, type) {
        k = k.split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        return this.create(k, type);
    }
    unannounceTopic(k) {
        k = k.split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        return this.delete(k);
    }
    updateTopic(k, v, ts=null) {
        k = k.split("/");
        while (k.length > 0 && k.at(0).length <= 0) k.shift();
        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
        return this.update(k, v, ts);
    }

    get address() { return this.#hasClient() ? this.#client.baseAddr : null; }
    set address(v) {
        v = (v == null) ? null : String(v);
        if (this.address == v) return;
        if (this.#hasClient()) this.#client.disconnect();
        if (v != null) this.clear();
        const client = this.#client = (v == null) ? null : new NTClient(
            v,
            "Peninsula",
            topic => {
                if (client != this.#client) return client.disconnect();
                this.announceTopic(topic.name, topic.type);
            },
            topic => {
                if (client != this.#client) return client.disconnect();
                this.unannounceTopic(topic.name);
            },
            (topic, ts, v) => {
                if (client != this.#client) return client.disconnect();
                ts /= 1000;
                this.updateTopic(topic.name, v, ts);
            },
            () => {
                if (client != this.#client) return client.disconnect();
                this.#client.startTime = this.#client.clientTime;
                this.post("connected");
                this.post("connect-state", this.connected);
                this.clear();
                client.subscribe(["/"], true, true, 0.001);
            },
            () => {
                if (client != this.#client) return client.disconnect();
                this.post("disconnected");
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

    get ts() { return Math.min(this.tsMax, Math.max(this.tsMin, super.ts)); }
    set ts(v) { super.ts = Math.min(this.tsMax, Math.max(this.tsMin, util.ensure(v, "num"))); }
    get tsMin() { return this.serverStartTime; }
    set tsMin(v) { return; }
    get tsMax() { return this.serverTime; }
    set tsMax(v) { return; }
}
