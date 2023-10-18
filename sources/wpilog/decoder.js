import * as util from "../../util.mjs";

import * as core from "../../core.mjs";


const HEADERSTRING = "WPILOG";
const HEADERVERSION = 0x0100;
const CONTROLENTRY = 0;
const CONTROLSTART = 0;
const CONTROLFINISH = 1;
const CONTROLMETADATA = 2;

const TEXTDECODER = new TextDecoder("UTF-8");
const TEXTENCODER = new TextEncoder("UTF-8");

export function toUint8Array(v) {
    if (v instanceof Uint8Array) return v;
    if (util.is(v, "str")) return TEXTENCODER.encode(v);
    try {
        return Uint8Array.from(v);
    } catch (e) {}
    return new Uint8Array();
}

export default class WPILOGDecoder extends core.Target {
    #data;
    #dataView;

    #records;

    constructor(data) {
        super();

        this.#data = toUint8Array(data);
        this.#dataView = new DataView(this.data.buffer);

        this.#records = [];
    }

    get data() { return this.#data; }
    get dataView() { return this.#dataView; }

    isValid() {
        return (
            this.data.length >= 12 &&
            TEXTDECODER.decode(this.data.subarray(0, 6)) == HEADERSTRING &&
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
        return TEXTDECODER.decode(this.data.subarray(12, 12+l));
    }

    #readVariableInteger(x, l) {
        let v = 0;
        for (let i = 0; i < l; i++)
            v |= this.data[x+i] << (i*8);
        return v;
    }

    get records() { return [...this.#records]; }

    build() {
        this.#records = [];
        if (!this.isValid()) return this.records;
        let x = 8;
        let extraHeaderL = this.dataView.getUint32(8, true);
        x += 4 + extraHeaderL;
        while (1) {
            if (this.data.length < x+4) break;
            let entryL = (this.data[x] & 0x3) + 1;
            let sizeL = ((this.data[x] >> 2) & 0x3) + 1;
            let tsL = ((this.data[x] >> 4) & 0x7) + 1;
            let headerL = 1 + entryL + sizeL + tsL;
            if (this.data.length < x+headerL) break;
            let entry = this.#readVariableInteger(x+1, entryL);
            let size = this.#readVariableInteger(x+1+entryL, sizeL);
            let ts = this.#readVariableInteger(x+1+entryL+sizeL, tsL);
            if (this.data.length < x+headerL+size || entry < 0 || size < 0 || ts < 0) break;
            this.#records.push(new Decoder.Record(
                entry, ts,
                this.data.subarray(x+headerL, x+headerL+size)
            ));
            x += headerL+size;
        }
        return this.records;
    }
}
WPILOGDecoder.Record = class WPILOGDecoderRecord extends core.Target {
    #entryId;
    #ts;
    #data;
    #dataView;

    constructor(entryId, ts, data) {
        super();

        this.#entryId = util.ensure(entryId, "int");
        this.#ts = util.ensure(ts, "num");
        this.#data = toUint8Array(data);
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
        if (!this.isControlStart()) return null;
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
        if (!this.isControlFinish()) return null;
        let entry = this.dataView.getUint32(1, true);
        return {
            entry: entry,
        };
    }

    getControlMetadataData() {
        if (!this.isControlMetadata()) return null;
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
    getBool() { return (this.data.length == 1) ? (this.data[0] != 0) : null; }
    getInt() { return (this.data.length == 8) ? Number(this.dataView.getBigInt64(0, true)) : null; }
    getFloat() { return (this.data.length == 4) ? this.dataView.getFloat32(0, true) : null; }
    getDouble() { return (this.data.length == 8) ? this.dataView.getFloat64(0, true) : null; }
    getStr() { return TEXTDECODER.decode(this.data); }
    getBoolArr() { return [...this.data.map(x => x != 0)]; }
    getIntArr() { return (this.data.length%8 == 0) ? Array.from(new Array(this.data.length/8).keys()).map(i => Number(this.dataView.getBigInt64(i*8, true))) : null; }
    getFloatArr() { return (this.data.length%4 == 0) ? Array.from(new Array(this.data.length/4).keys()).map(i => this.dataView.getFloat32(i*4, true)) : null; }
    getDoubleArr() { return (this.data.length%8 == 0) ? Array.from(new Array(this.data.length/8).keys()).map(i => this.dataView.getFloat64(i*8, true)) : null; }
    getStrArr() {
        let l = this.dataView.getUint32(0, true);
        if (l > (this.data.length-4)/4) return null;
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
        if (x+4+l > this.data.length) return null;
        return {
            str: TEXTDECODER.decode(this.data.subarray(x+4, x+4+l)),
            shift: 4+l,
        };
    }
};
