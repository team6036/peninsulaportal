import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import { WorkerClient } from "../../worker.js";

import Source from "../source.js";


export default class DSSource extends Source {
    static getName() { return "DriverStation"; }

    constructor() {
        super();
    }

    static async importFrom(logPth, eventsPth) {
        const source = new this();
        await source.importFrom(logPth, eventsPth);
        return source;
    }
    async importFrom(logPth, eventsPth) {
        let logData, eventsData;
        await Promise.all([
            (async () => {
                if (window && window.api) logData = await window.api.send("read", "dslog", logPth);
                else logData = (await (await fetch(logPth)).blob()).arrayBuffer();
            })(),
            (async () => {
                if (window && window.api) eventsData = await window.api.send("read", "dslog", eventsPth);
                else eventsData = (await (await fetch(eventsPth)).blob()).arrayBuffer();
            })(),
        ]);
        return await this.import(logData, eventsData);
    }
    static async import(logData, eventsData) {
        const source = new this();
        await source.import(logData, eventsData);
        return source;
    }
    async import(logData, eventsData) {
        logData = util.toUint8Array(logData);
        eventsData = util.toUint8Array(eventsData);
        this.tsMin = this.tsMax = 0;
        this.clear();
        const client = new WorkerClient("../sources/ds/decoder-worker.js");
        return await new Promise((res, rej) => {
            client.addHandler("error", e => rej(e));
            client.addHandler("stop", data => rej("WORKER TERMINATED"));
            client.addHandler("cmd-progress", progress => this.post("progress", progress));
            client.addHandler("cmd-finish", data => {
                this.fromSerialized(data);
                res(this);
                client.stop();
            });
            client.start({
                opt: {},
                source: {
                    logData: logData,
                    eventsData: eventsData,
                },
            });
        });
    }
}
