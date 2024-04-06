import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import { HEADERSTRING, HEADERVERSION, CONTROLENTRY, CONTROLSTART, CONTROLFINISH, CONTROLMETADATA } from "./util.js";


// Rework of: https://github.com/Mechanical-Advantage/AdvantageScope/blob/main/src/hub/dataSources/wpilog/WPILOGDecoder.ts

export default class WPILOGDecoder extends util.Target {
    #data;
    #dataView;

    constructor(data) {
        super();

        this.#data = util.toUint8Array(data);
        this.#dataView = new DataView(this.data.buffer);
    }

    get data() { return this.#data; }
    get dataView() { return this.#dataView; }

    isValid() {
        return (
            this.data.length >= 12 &&
            lib.TEXTDECODER.decode(this.data.subarray(0, 6)) == HEADERSTRING &&
            this.version == HEADERVERSION
        );
    }
    get version() {
        if (this.data.length < 12) return 0;
        return this.dataView.getUint16(6, true);
    }
    get extraHeader() {
        if (this.data.length < 12) return "";
        let l = this.dataView.getUint32(8, true);
        return lib.TEXTDECODER.decode(this.data.subarray(12, 12+l));
    }

    #readInt(x, l) {
        let v = BigInt(0);
        for (let i = 0; i < Math.min(8,l); i++) {
            let byte = this.data[x+i];
            if (i == 7) {
                if ((byte & (1 << 7)) != 0)
                    v -= (BigInt(1) << BigInt(63));
                byte &= ~(1 << 7);
            }
            v |= BigInt(byte) << BigInt(i * 8);
        }
        return Number(v);
    }

    build(callback) {
        if (!this.isValid()) throw new Error("Unsupported version: "+this.version);
        let extraHeaderL = this.dataView.getUint32(8, true);
        let x = 12 + extraHeaderL;
        while (true) {
            if (this.data.length < x+4) break;
            let entryL = (this.data[x] & 0x3) + 1;
            let sizeL = ((this.data[x] >> 2) & 0x3) + 1;
            let tsL = ((this.data[x] >> 4) & 0x7) + 1;
            let headerL = 1 + entryL + sizeL + tsL;
            if (this.data.length < x+headerL) break;
            let entry = this.#readInt(x+1, entryL);
            let size = this.#readInt(x+1+entryL, sizeL);
            let ts = this.#readInt(x+1+entryL+sizeL, tsL);
            if (this.data.length < x+headerL+size || entry < 0 || size < 0) break;
            const record = new WPILOGDecoder.Record({
                entryId: entry, ts: ts,
                data: this.data.subarray(x+headerL, x+headerL+size),
            });
            x += headerL+size;
            if (util.is(callback, "func"))
                callback(record, x/this.data.byteLength);
        }
    }
}
WPILOGDecoder.Record = class WPILOGDecoderRecord extends util.Target {
    #entryId;
    #ts;
    #data;
    #dataView;

    constructor(o) {
        super();

        o = util.ensure(o, "obj");
        this.#entryId = util.ensure(o.entryId, "int");
        this.#ts = util.ensure(o.ts, "num");
        this.#data = util.toUint8Array(o.data);

        this.#dataView = new DataView(this.data.buffer.slice(this.data.byteOffset, this.data.byteOffset+this.data.byteLength));
    }
    
    get entryId() { return this.#entryId; }
    get ts() { return this.#ts; }
    get data() { return this.#data; }
    get dataView() { return this.#dataView; }

    isControl() { return this.entryId == CONTROLENTRY; }
    #getControlType() { return this.isControl() ? this.#data[0] : null; }
    isControlStart() { return this.isControl() && (this.data.length >= 17) && (this.#getControlType() == CONTROLSTART); }
    isControlFinish() { return this.isControl() && (this.data.length == 5) && (this.#getControlType() == CONTROLFINISH); }
    isControlMetadata() { return this.isControl() && (this.data.length >= 9) && (this.#getControlType() == CONTROLMETADATA); }

    getControlStartData() {
        if (!this.isControlStart()) throw new Error("getControlStartData: Is not controlStart");
        let entry = this.dataView.getUint32(1, true);
        let r, x = 5;
        r = this.#readStr(x);
        let name = r.str;
        r = this.#readStr(x += r.shift);
        let type = r.str;
        r = this.#readStr(x += r.shift);
        let metadata = r.str;
        return {
            entry: entry,
            name: name,
            type: type,
            metadata: metadata,
        };
    }
    
    getControlFinishData() {
        if (!this.isControlFinish()) throw new Error("getControlFinishData: Is not controlFinish");
        let entry = this.dataView.getUint32(1, true);
        return {
            entry: entry,
        };
    }

    getControlMetadataData() {
        if (!this.isControlMetadata()) throw new Error("getControlMetadataData: Is not controlMetadata");
        let entry = this.dataView.getUint32(1, true);
        let r, x = 5;
        r = this.#readStr(x);
        let metadata = r.str;
        return {
            entry: entry,
            metadata: metadata,
        };
    }

    getRaw() { return new Uint8Array(this.data.buffer.slice(this.data.byteOffset, this.data.byteOffset+this.data.byteLength)); }
    getBool() {
        if (this.data.length != 1) throw new Error("getBool: Unexpected length: "+this.data.length);
        return !!this.data[0];
    }
    getInt() {
        if (this.data.length != 8) throw new Error("getInt: Unexpected length: "+this.data.length);
        return Number(this.dataView.getBigInt64(0, true));
    }
    getFloat() {
        if (this.data.length != 8) throw new Error("getFloat: Unexpected length: "+this.data.length);
        return this.dataView.getFloat32(0, true);
    }
    getDouble() {
        if (this.data.length != 8) throw new Error("getDouble: Unexpected length: "+this.data.length);
        return this.dataView.getFloat64(0, true);
    }
    getStr() { return lib.TEXTDECODER.decode(this.data); }
    getBoolArr() { return [...this.data.map(x => x != 0)]; }
    getIntArr() {
        if (this.data.length%8 != 0) throw new Error("getIntArr: Unexpected length: "+this.data.length);
        return Array.from(new Array(this.data.length/8).keys()).map(i => Number(this.dataView.getBigInt64(i*8, true)));
    }
    getFloatArr() {
        if (this.data.length%4 != 0) throw new Error("getFloatArr: Unexpected length: "+this.data.length);
        return Array.from(new Array(this.data.length/4).keys()).map(i => this.dataView.getFloat32(i*4, true));
    }
    getDoubleArr() {
        if (this.data.length%8 != 0) throw new Error("getDoubleArr: Unexpected length: "+this.data.length);
        return (this.data.length%8 == 0) ? Array.from(new Array(this.data.length/8).keys()).map(i => this.dataView.getFloat64(i*8, true)) : null;
    }
    getStrArr() {
        let l = this.dataView.getUint32(0, true);
        if (l > (this.data.length-4)/4) throw new Error("getStrArr: Minimum length exceeded: "+l+" > ("+this.data.length+"-4)/4");
        let arr = [], x = 4;
        while (l-- > 0) {
            let r = this.#readStr(x);
            arr.push(r.str);
            x += r.shift;
        }
        return arr;
    }

    #readStr(x) {
        let l = this.dataView.getUint32(x, true);
        if (x+4+l > this.data.length) throw new Error("readStr: Length exceeded: "+(x+4+l)+" > "+this.data.length);
        return {
            str: lib.TEXTDECODER.decode(this.data.subarray(x+4, x+4+l)),
            shift: 4+l,
        };
    }
};
