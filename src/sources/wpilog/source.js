import * as util from "../../util.mjs";

import { WorkerClient } from "../../worker.js";

import Source from "../source.js";
import { toUint8Array } from "../source.js";


export default class WPILOGSource extends Source {
    #data;

    constructor(data) {
        super();

        this.postFlat = false;

        this.#data = null;

        this.data = data;
    }

    get data() { return this.#data; }
    set data(v) {
        v = (v == null) ? null : toUint8Array(v);
        if (this.data == v) return;
        this.#data = v;
    }
    hasData() { return this.data instanceof Uint8Array; }

    async build() {
        this.tsMin = this.tsMax = 0;
        if (!this.hasData()) return false;
        this.clear();
        const client = new WorkerClient("../sources/wpilog/decoder-worker.js");
        return await new Promise((res, rej) => {
            client.addHandler("error", e => rej(e));
            client.addHandler("stop", data => rej("WORKER TERMINATED"));
            client.addHandler("cmd-progress", progress => this.post("progress", progress));
            client.addHandler("cmd-finish", data => {
                this.fromSerialized(data);
                res(this);
            });
            client.start({
                opt: {},
                source: [...this.data],
            });
        });
    }

    static async export(source, prefix="") {
        if (!(source instanceof Source)) return null;
        const client = new WorkerClient("../sources/wpilog/encoder-worker.js");
        return await new Promise((res, rej) => {
            client.addHandler("error", e => rej(e));
            client.addHandler("stop", data => rej("WORKER TERMINATED"));
            client.addHandler("cmd-progress", progress => source.post("progress", progress));
            client.addHandler("cmd-finish", data => res(Uint8Array.from(util.ensure(data, "arr"))));
            client.start({
                opt: { prefix: prefix },
                source: source.toSerialized(),
            });
        });
    }
    async export(prefix="") { return await WPILOGSource.export(this, prefix); }
}