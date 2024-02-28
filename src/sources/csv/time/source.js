import * as util from "../../../util.mjs";

import { WorkerClient } from "../../../worker.js";

import Source from "../../source.js";


export default class CSVTimeSource extends Source {
    #data;

    constructor(data) {
        super();

        this.#data = null;

        this.data = data;
    }

    get data() { return this.#data; }
    set data(v) {
        v = (v == null) ? null : String(v);
        if (this.data == v) return;
        this.#data = v;
    }
    hasData() { return this.data != null; }

    async build() {
        this.tsMin = this.tsMax = 0;
        if (!this.hasData()) return false;
        this.clear();
        const client = new WorkerClient("../sources/csv/time/decoder-worker.js");
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
                source: this.data,
            });
        });
    }

    async import(pth) {
        if (window && window.api) this.data = await window.api.send("read", "csv", pth);
        else this.data = await (await fetch(pth)).text();
        return await this.build();
    }
    static async export(source, prefix="") {
        if (!(source instanceof Source)) return null;
        const client = new WorkerClient("../sources/csv/time/encoder-worker.js");
        return await new Promise((res, rej) => {
            client.addHandler("error", e => rej(e));
            client.addHandler("stop", data => rej("WORKER TERMINATED"));
            client.addHandler("cmd-progress", progress => source.post("progress", progress));
            client.addHandler("cmd-finish", data => {
                res(String(data));
                client.stop();
            });
            client.start({
                opt: { prefix: prefix },
                source: source.toSerialized(),
            });
        });
    }
    async export(prefix="") { return await CSVTimeSource.export(this, prefix); }
}
