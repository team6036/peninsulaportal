import * as util from "../../util.mjs";

import * as core from "../../core.mjs";

import WPILOGDecoder, { toUint8Array } from "./decoder.js";

import Source from "../source.js";


export class WPILOGSource extends Source {
    #decoder;

    constructor(data) {
        super("flat");

        this.#decoder = null;

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

    get records() { return this.#hasDecoder() ? this.#decoder.records : [] }

    build() {
        if (!this.#hasDecoder()) return this.records;
        this.#decoder.build();
        return this.records;
    }
}
