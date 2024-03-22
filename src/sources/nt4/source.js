import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import NTClient from "./nt4.js";

import Source from "../source.js";


export default class NTSource extends Source {
    #client;
    #clientStorage;

    constructor(address) {
        super();

        this.#client = null;
        this.#clientStorage = {
            startTime: 0,
            stopTime: 0,
            timeOffset: 0,
        };

        this.address = address;
    }

    #hasClient() { return !!this.#client; }
    #hasConnectedClient() { return this.#hasClient() && this.#client.connectionActive; }

    get address() { return this.#hasClient() ? this.#client.baseAddr : null; }
    set address(v) {
        v = (v == null) ? null : String(v);
        if (this.address == v) return;
        if (this.#hasClient()) this.#client.disconnect();
        if (v != null) this.clear();
        let connected = false;
        const client = this.#client = (v == null) ? null : new NTClient(
            v,
            "Peninsula",
            topic => {
                if (client != this.#client) return client.disconnect();
                this.add(topic.name, topic.type);
            },
            topic => {
                if (client != this.#client) return client.disconnect();
                this.rem(topic.name);
            },
            (topic, ts, v) => {
                if (client != this.#client) return client.disconnect();
                ts /= 1000;
                this.update(topic.name, v, ts);
            },
            () => {
                if (client != this.#client) return client.disconnect();
                if (connected) return;
                connected = true;
                this.clear();
                this.#client.startTime = this.#client.clientTime;
                this.#clientStorage.startTime = util.getTime();
                this.post("connected");
                this.post("connect-state", this.connected);
                client.subscribe(["/"], true, true, 0.001);
            },
            () => {
                if (client != this.#client) return client.disconnect();
                if (!connected) return;
                connected = false;
                this.#client.stopTime = this.#client.clientTime;
                this.#clientStorage.stopTime = util.getTime();
                this.post("disconnected");
                this.post("connect-state", this.connected);
            },
            offset => {
                this.#clientStorage.timeOffset = util.ensure(offset, "num")/1000;
            },
        );
        if (this.#hasClient()) {
            this.#client.startTime = this.#client.clientTime;
            this.#client.stopTime = this.#client.clientTime;
            this.#clientStorage.startTime = util.getTime();
            this.#clientStorage.stopTime = util.getTime();
            this.#client.connect();
        } else {
            this.#clientStorage.stopTime = util.getTime();
        }
    }
    get fullAddress() { return this.#hasClient() ? this.#client.addr : null; }

    get connecting() { return this.#hasClient() && this.disconnected; }
    get connected() { return this.#hasClient() ? this.#client.connectionActive : false; }
    get disconnected() { return !this.connected; }

    get clientStartTime() {
        if (!this.#hasConnectedClient()) return NTClient.clientToServer(this.#clientStorage.startTime, this.#clientStorage.timeOffset);
        return this.#client.startTime/1000;
    }
    get serverStartTime() {
        if (!this.#hasConnectedClient()) return this.clientStartTime;
        return this.#client.clientToServer(this.#client.startTime)/1000;
    }
    get clientStopTime() {
        if (!this.#hasConnectedClient()) return NTClient.clientToServer(this.#clientStorage.stopTime, this.#clientStorage.timeOffset);
        return this.#client.stopTime/1000;
    }
    get serverStopTime() {
        if (!this.#hasConnectedClient()) return this.clientStopTime;
        return this.#client.clientToServer(this.#client.stopTime)/1000;
    }
    get clientTime() {
        if (!this.#hasConnectedClient()) return 0;
        return this.#client.clientTime/1000;
    }
    get serverTime() {
        if (!this.#hasConnectedClient()) return this.clientTime;
        return this.#client.clientToServer(this.#client.clientTime)/1000;
    }
    get clientTimeSince() {
        if (!this.#hasConnectedClient()) return this.clientStopTime-this.clientStartTime;
        return this.clientTime-this.clientStartTime;
    }
    get serverTimeSince() {
        if (!this.#hasConnectedClient()) return this.clientTimeSince;
        return this.serverTime-this.serverStartTime;
    }

    get ts() { return Math.min(this.tsMax, Math.max(this.tsMin, super.ts)); }
    set ts(v) { super.ts = Math.min(this.tsMax, Math.max(this.tsMin, util.ensure(v, "num"))); }
    get tsMin() { return this.serverStartTime; }
    set tsMin(v) { return; }
    get tsMax() { return this.#hasConnectedClient() ? this.serverTime : this.serverStopTime; }
    set tsMax(v) { return; }
}
