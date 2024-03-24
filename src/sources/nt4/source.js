import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import NTClient from "./nt4.js";

import Source from "../source.js";


export default class NTSource extends Source {
    #client;

    static STATES = NTClient.STATES;

    constructor(address) {
        super();

        this.#client = new NTClient(null);
        this.#client.addHandler("change-connection", (f, t) => this.change("connection", f, t));

        this.#client.addHandler("announce", topic => this.add(topic.name, topic.type));
        this.#client.addHandler("unannounce", topic => this.rem(topic.name));
        this.#client.addHandler("topic", (topic, ts, v) => this.update(topic.name, v, ts/1000));

        this.addHandler("change-connection", (f, t) => {
            if (t == NTSource.STATES.DISCONNECTED) this.post("disconnected");
            if (t == NTSource.STATES.CONNECTING) this.post("connecting");
            if (t == NTSource.STATES.CONNECTED) this.post("connected");
        });

        this.addHandler("connected", () => {
            this.#client.subscribe(["/"], true, true, 0.001);
        });

        this.addHandler("update", delta => this.#client.update(delta));

        this.address = address;
    }

    get address() { return this.#client.address; }
    set address(v) { this.#client.address = v; }

    get autoConnect() { return this.#client.autoConnect; }
    set autoConnect(v) { this.#client.autoConnect = v; }

    get connection() { return this.#client.connection; }
    get connected() { return this.#client.connected; }
    get connecting() { return this.#client.connecting; }
    get disconnected() { return this.#client.disconnected; }

    connect() { return this.#client.connect(); }
    disconnect() { return this.#client.disconnect(); }

    get clientStartTime() { return this.#client.clientStartTime/1000; }
    get serverStartTime() { return this.#client.serverStartTime/1000; }
    get clientStopTime() { return this.#client.clientStopTime/1000; }
    get serverStopTime() { return this.#client.serverStopTime/1000; }
    get clientTime() { return this.#client.clientTime/1000; }
    get serverTime() { return this.#client.serverTime/1000; }
    get clientTimeSince() { return this.clientTime-this.clientStartTime; }
    get serverTimeSince() { return this.serverTime-this.serverStartTime; }

    get ts() { return Math.min(this.tsMax, Math.max(this.tsMin, super.ts)); }
    set ts(v) { super.ts = Math.min(this.tsMax, Math.max(this.tsMin, util.ensure(v, "num"))); }
    get tsMin() { return this.serverStartTime; }
    set tsMin(v) { return; }
    get tsMax() { return this.serverStopTime; }
    set tsMax(v) { return; }
}
