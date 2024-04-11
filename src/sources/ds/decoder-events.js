import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import { convertTime, getPowerDistro } from "./util.js";


// Rework of: https://github.com/Mechanical-Advantage/AdvantageScope/blob/main/src/hub/dataSources/dslog/DSEventsReader.ts

export default class DSEventsDecoder extends util.Target {
    #data;
    #dataView;

    constructor(data) {
        super();

        this.#data = util.toUint8Array(data);
        this.#dataView = new DataView(this.data.buffer);
    }

    get data() { return this.#data; }
    get dataView() { return this.#dataView; }

    isValid() { return this.version == 4; }
    get version() { return this.dataView.getInt32(0); }
    get ts() { return convertTime(this.dataView.getBigInt64(4), this.dataView.getBigUint64(12)); }

    build(callback) {
        callback = util.ensure(callback, "func");
        if (!this.isValid()) throw new Error("Unsupported version: "+this.version);
        let ts0 = this.ts;
        let x = 4+8+8;
        while (true) {
            let ts = convertTime(this.dataView.getBigInt64(x), this.dataView.getBigUint64(x+8));
            x += 8+8;
            let l = this.dataView.getInt32(x);
            x += 4;
            let text = lib.TEXTDECODER.decode(this.data.subarray(x, x+l));
            x += l;
            ["<TagVersion>", "<time>", "<count>", "<flags>", "<Code>", "<location>", "<stack>"].forEach(tag => {
                while (text.includes(tag)) {
                    let i = text.indexOf(tag);
                    let j = text.indexOf("<", i+1);
                    text = text.slice(0, i) + text.slice(j);
                }
            });
            text = text.replaceAll("<message> ", "");
            text = text.replaceAll("<details> ", "");
            text = text.trim();
            const record = new DSEventsDecoder.Record({
                ts: ts-ts0,
                text: text,
            });
            callback(record, x/this.data.byteLength);
            if (x >= this.data.length) break;
        }
    }
}
DSEventsDecoder.Record = class DSEventsDecoderRecord extends util.Target {
    #ts;
    #text;

    constructor(o) {
        super();

        this.#ts = util.ensure(o.ts, "num");
        this.#text = String(text);
    }
    
    get ts() { return this.#ts; }
    get text() { return this.#text; }
};
