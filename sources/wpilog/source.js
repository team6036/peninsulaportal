import * as util from "../../util.mjs";

import * as core from "../../core.mjs";

import WPILOGDecoder, { toUint8Array } from "./decoder.js";

import Source from "../source.js";


export default class WPILOGSource extends Source {
    #decoder;
    #minTS;
    #maxTS;

    constructor(data) {
        super("flat");

        this.#decoder = null;
        this.#minTS = this.#maxTS = 0;

        this.data = data;
    }

    #hasDecoder() { return this.#decoder instanceof WPILOGDecoder; }

    get data() { return this.#hasDecoder() ? this.#decoder.data : null; }
    set data(v) {
        v = toUint8Array(v);
        if (this.data == v) return;
        this.#decoder = new WPILOGDecoder(v);
    }
    hasData() { return this.data instanceof Uint8Array; }

    isValid() { return this.#hasDecoder() ? this.#decoder.isValid() : false; }
    get version() { return this.#hasDecoder() ? this.#decoder.version : null; }
    get extraHeader() { return this.#hasDecoder() ? this.#decoder.extraHeader : null; }

    build() {
        this.#minTS = this.#maxTS = 0;
        this.clear();
        if (!this.#hasDecoder()) return;
        this.#decoder.build();
        let entryId2Name = {};
        let entryId2Type = {};
        let first = true;
        this.#decoder.records.forEach(record => {
            if (record.isControl()) {
                if (!record.isControlStart()) return;
                let startData = record.getControlStartData();
                let id = startData.entry;
                let name = entryId2Name[id] = startData.name;
                let type = entryId2Type[id] = startData.type;
                if (["int64"].includes(type)) type = "int";
                if (["int64[]"].includes(type)) type = "int[]";
                this.create([name], type);
            } else {
                let id = record.entryId;
                if (!(id in entryId2Name)) return;
                if (!(id in entryId2Type)) return;
                let name = entryId2Name[id];
                let type = entryId2Type[id];
                let ts = record.ts / 1000;
                let v = record.getRaw();
                let typefs = {
                    boolean: () => record.getBool(),
                    int: () => record.getInt(),
                    int64: () => typefs["int"](),
                    float: () => record.getFloat(),
                    double: () => record.getDouble(),
                    string: () => record.getStr(),
                    "boolean[]": () => record.getBoolArr(),
                    "int[]": () => record.getIntArr(),
                    "int64[]": () => typefs["int[]"](),
                    "float[]": () => record.getFloatArr(),
                    "double[]": () => record.getDoubleArr(),
                    "string[]": () => record.getStrArr(),
                    json: () => record.getStr(),
                };
                if (type in typefs) v = typefs[type]();
                this.update([name], v, ts);
                if (first) {
                    first = false;
                    this.#minTS = this.#maxTS = ts;
                } else {
                    this.#minTS = Math.min(this.#minTS, ts);
                    this.#maxTS = Math.max(this.#maxTS, ts);
                }
            }
        });
    }

    get ts() { return this.maxTS; }
    get minTS() { return this.#minTS; }
    get maxTS() { return this.#maxTS; }
}
