import * as util from "../util.mjs";
import * as lib from "../lib.mjs";

import { WorkerClient } from "../worker.js";

import Source from "./source.js";


export default class HistoricalSource extends Source {
    #importing;

    static CLIENTDECODER = "";
    static CLIENTENCODER = "";
    static TYPE = "";
    static WANTED = "uint8";

    constructor() {
        super();

        this.#importing = false;
    }

    get importing() { return this.#importing; }

    static async importFrom(pth) {
        const source = new this();
        await source.importFrom(pth);
        return source;
    }
    async importFrom(pth) {
        let data;
        if (window && window.api) data = await window.api.send("read", this.constructor.TYPE, pth);
        else {
            data = await fetch(pth);
            data =
                (this.constructor.WANTED == "uint8") ?
                    (await data.blob()).arrayBuffer() :
                (this.constructor.WANTED == "text") ?
                    await data.text() :
                null;
        }
        return await this.import(data);
    }
    static async import(data) {
        const source = new this();
        await source.import(data);
        return source;
    }
    async import(data) {
        this.#importing = true;
        try {
            data =
                (this.constructor.WANTED == "uint8") ?
                    util.toUint8Array(data) :
                (this.constructor.WANTED == "text") ?
                    String(data) :
                null;
            this.tsMin = this.tsMax = 0;
            this.clear();
            const client = new WorkerClient(this.constructor.CLIENTDECODER);
            await new Promise((res, rej) => {
                client.addHandler("error", e => rej(e));
                client.addHandler("stop", data => rej("WORKER TERMINATED"));
                client.addHandler("cmd-progress", progress => this.post("progress", progress));
                client.addHandler("cmd-finish", data => {
                    this.fromSerialized(data);
                    res();
                    client.stop();
                });
                client.start({
                    opt: {},
                    source: data,
                });
            });
        } catch (e) {
            this.#importing = false;
            throw e;
        }
        this.#importing = false;
        return this;
    }
    static async export(source, prefix="") {
        if (!(source instanceof Source)) return null;
        const client = new WorkerClient(this.constructor.CLIENTENCODER);
        return await new Promise((res, rej) => {
            client.addHandler("error", e => rej(e));
            client.addHandler("stop", data => rej("WORKER TERMINATED"));
            client.addHandler("cmd-progress", progress => source.post("progress", progress));
            client.addHandler("cmd-finish", data => {
                res(Uint8Array.from(util.ensure(data, "arr")));
                client.stop();
            });
            client.start({
                opt: { prefix: prefix },
                source: source.toSerialized(),
            });
        });
    }
    async export(prefix="") { return await this.constructor.export(this, prefix); }
}
