import * as util from "../../util.mjs";

import * as core from "../../core.mjs";

import Client from "./nt4.js";

import Source from "../source.js";


export default class NTSource extends Source {
    #client;

    constructor(address) {
        super();

        this.#client = null;

        this.address = address;
    }

    #hasClient() { return this.#client instanceof Client; }

    hasRoot() { return true; }

    announceTopic(k, type) { return this.create(k, type); }
    unannounceTopic(k) { return this.delete(k); }
    updateTopic(k, v, ts=null) { return this.update(k, v, ts); }

    get address() { return this.#hasClient() ? this.#client.baseAddr : null; }
    set address(v) {
        v = (v == null) ? null : String(v);
        if (this.address == v) return;
        if (this.#hasClient()) this.#client.disconnect();
        this.clear();
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

    get ts() { return this.serverTime; }
    set ts(v) { return; }
}
