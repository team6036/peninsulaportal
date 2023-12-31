import * as util from "../../util.mjs";

import { toUint8Array } from "../source.js";


const HEADERSTRING = "WPILOG";
const HEADERVERSION = 0x0100;
const CONTROLENTRY = 0;
const CONTROLSTART = 0;
const CONTROLFINISH = 1;
const CONTROLMETADATA = 2;


export default class WPILOGEncoder extends util.Target {
    #extraHeader;

    #records;

    constructor(extraHeader) {
        super();

        this.#extraHeader = String(extraHeader);

        this.#records = new Set();
    }
    
    get extraHeader() { return this.#extraHeader; }

    get records() { return [...this.#records]; }
    set records(v) {
        v = util.ensure(v, "arr");
        this.clearRecords();
        this.addRecord(v);
    }
    clearRecords() {
        let records = this.records;
        this.remRecord(records);
        return records;
    }
    hasRecord(record) {
        if (!(record instanceof WPILOGEncoder.Record)) return false;
        return this.#records.has(record);
    }
    addRecord(...records) {
        return util.Target.resultingForEach(records, record => {
            if (!(record instanceof WPILOGEncoder.Record)) return false;
            if (this.hasRecord(record)) return false;
            this.#records.add(record);
            record.onAdd();
            return record;
        });
    }
    remRecord(...records) {
        return util.Target.resultingForEach(records, record => {
            if (!(record instanceof WPILOGEncoder.Record)) return false;
            if (!this.hasRecord(record)) return false;
            record.onRem();
            this.#records.delete(record);
            return record;
        });
    }

    build(callback) {
        let records = this.records;
        records = records.map((record, i) => {
            let data = record.build();
            if (util.is(callback, "func"))
                callback(util.lerp(0, 0.5, (i+1)/record.length));
            return data;
        });
        let l = 0;
        records.forEach(record => (l += record.length));
        let header = util.TEXTENCODER.encode(HEADERSTRING);
        let extraHeader = util.TEXTENCODER.encode(this.extraHeader);

        let data = new Uint8Array(header.length+2+4+extraHeader.length+l);
        let dataView = new DataView(data.buffer, 0);
        data.set(header, 0);
        dataView.setUint16(header.length, HEADERVERSION, true);
        dataView.setUint32(header.length+2, extraHeader.length, true);
        data.set(extraHeader, header.length+2+4);

        let x = header.length+2+4+extraHeader.length;
        records.forEach(record => {
            data.set(record, x);
            x += record.length;
            if (util.is(callback, "func"))
                callback(util.lerp(0.5, 1, x/data.length));
        });
        return data;
    }
}
WPILOGEncoder.Record = class WPILOGEncoderRecord extends util.Target {
    #entryId;
    #ts;
    #data;

    constructor(...a) {
        super();

        if (a.length <= 0 || [2].includes(a.length) || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof WPILOGEncoder.Record) a = [a.entryId, a.ts, a.data];
            else if (util.is(a, "arr")) {
                a = new WPILOGEncoder.Record(...a);
                a = [a.entryId, a.ts, a.data];
            }
            else if (util.is(a, "obj")) a = [a.entryId, a.ts, a.data];
            else a = [0, 0, null];
        }

        a[0] = util.ensure(a[0], "int");
        a[1] = util.ensure(a[1], "num");
        a[2] = toUint8Array(a[2]);

        [this.#entryId, this.#ts, this.#data] = a;
    }

    get entryId() { return this.#entryId; }
    get ts() { return this.#ts; }
    get data() { return this.#data; }

    static makeControlStart(ts, startData) {
        ts = util.ensure(ts, "num");
        startData = util.ensure(startData, "obj");
        let entry = util.ensure(startData.entry, "num");
        let name = util.TEXTENCODER.encode(String(startData.name));
        let type = util.TEXTENCODER.encode(String(startData.type));
        let metadata = util.TEXTENCODER.encode(String(startData.metadata));

        let data = new Uint8Array(1+4+4+name.length+4+type.length+4+metadata.length);
        let dataView = new DataView(data.buffer);
        data[0] = CONTROLSTART;
        dataView.setUint32(1, entry, true);
        dataView.setUint32(1+4, name.length, true);
        data.set(name, 1+4+4);
        dataView.setUint32(1+4+4+name.length, type.length, true);
        data.set(type, 1+4+4+name.length+4);
        dataView.setUint32(1+4+4+name.length+4+type.length, metadata.length, true);
        data.set(metadata, 1+4+4+name.length+4+type.length+4);

        return this.makeRaw(CONTROLENTRY, ts, data);
    }
    static makeControlFinish(ts, finishData) {
        ts = util.ensure(ts, "num");
        finishData = util.ensure(finishData, "obj");
        let entry = util.ensure(finishData.entry, "num");

        let data = new Uint8Array(1+4);
        let dataView = new DataView(data.buffer);
        data[0] = CONTROLFINISH;
        dataView.setUint32(1, entry, true);

        return this.makeRaw(CONTROLENTRY, ts, data);
    }
    static makeControlMetadata(ts, metadataData) {
        ts = util.ensure(ts, "num");
        metadataData = util.ensure(metadataData, "obj");
        let entry = util.ensure(metadataData.entry, "num");
        let metadata = util.TEXTENCODER.encode(String(metadataData.metadata));

        let data = new Uint8Array(1+4+4+metadata.length);
        let dataView = new DataView(data.buffer);
        data[0] = CONTROLMETADATA;
        dataView.setUint32(1, entry, true);
        data.set(metadata, 1+4);

        return this.makeRaw(CONTROLENTRY, ts, data);
    }
    static makeRaw(entry, ts, data) { return new WPILOGEncoder.Record(entry, ts, data); }
    static makeBool(entry, ts, v) {
        let data = new Uint8Array(1);
        data[0] = v ? 1 : 0;
        return this.makeRaw(entry, ts, data);
    }
    static makeInt(entry, ts, v) {
        let data = new Uint8Array(8);
        let dataView = new DataView(data.buffer);
        dataView.setBigInt64(0, BigInt(util.ensure(v, "int")), true);
        return this.makeRaw(entry, ts, data);
    }
    static makeFloat(entry, ts, v) {
        let data = new Uint8Array(4);
        let dataView = new DataView(data.buffer);
        dataView.setFloat32(0, util.ensure(v, "num"), true);
        return this.makeRaw(entry, ts, data);
    }
    static makeDouble(entry, ts, v) {
        let data = new Uint8Array(8);
        let dataView = new DataView(data.buffer);
        dataView.setFloat64(0, util.ensure(v, "num"), true);
        return this.makeRaw(entry, ts, data);
    }
    static makeStr(entry, ts, v) {
        return this.makeRaw(entry, ts, util.TEXTENCODER.encode(String(v)));
    }
    static makeBoolArr(entry, ts, v) {
        v = util.ensure(v, "arr").map(v => !!v);
        let data = new Uint8Array(v.length);
        v.forEach((v, i) => (data[i] = (v ? 1 : 0)));
        return this.makeRaw(entry, ts, data);
    }
    static makeIntArr(entry, ts, v) {
        v = util.ensure(v, "arr").map(v => util.ensure(v, "int"));
        let data = new Uint8Array(v.length*8);
        v.forEach((v, i) => {
            let dataView = new DataView(data.buffer, i*8);
            dataView.setBigInt64(0, BigInt(v), true);
        });
        return this.makeRaw(entry, ts, data);
    }
    static makeFloatArr(entry, ts, v) {
        v = util.ensure(v, "arr").map(v => util.ensure(v, "num"));
        let data = new Uint8Array(v.length*4);
        v.forEach((v, i) => {
            let dataView = new DataView(data.buffer, i*4);
            dataView.setFloat32(0, v, true);
        });
        return this.makeRaw(entry, ts, data);
    }
    static makeDoubleArr(entry, ts, v) {
        v = util.ensure(v, "arr").map(v => util.ensure(v, "num"));
        let data = new Uint8Array(v.length*8);
        v.forEach((v, i) => {
            let dataView = new DataView(data.buffer, i*8);
            dataView.setFloat64(0, v, true);
        });
        return this.makeRaw(entry, ts, data);
    }
    static makeStrArr(entry, ts, v) {
        v = util.ensure(v, "arr").map(v => util.TEXTENCODER.encode(String(v)));
        let l = 4+v.length*4;
        v.forEach(v => (l += v.length));
        let data = new Uint8Array(l);
        let dataView = new DataView(data.buffer);
        dataView.setUint32(0, v.length, true);
        let x = 4;
        v.forEach(v => {
            let dataView = new DataView(data.buffer, x);
            dataView.setUint32(0, v.length, true);
            data.set(v, x+4);
            x += 4+v.length;
        });
        return this.makeRaw(entry, ts, data);
    }

    #encodeInt(v) {
        v = util.ensure(v, "int");
        if (v == 0) return new Uint8Array(1);
        let l = Math.floor(Math.log(v) / Math.log(256)) + 1;
        let arr = new Uint8Array(l);
        for (let i = 0; i < l; i++)
            arr[i] = (v >> (i * 8)) & 0xff;
        return arr;
    }

    build() {
        let entry = this.#encodeInt(this.entryId);
        let payloadSize = this.#encodeInt(this.data.length);
        let ts = this.#encodeInt(this.ts);
        let lBitfield = 0;
        lBitfield |= entry.length - 1;
        lBitfield |= (payloadSize.length - 1) << 2;
        lBitfield |= (ts.length - 1) << 4;

        let arr = new Uint8Array(1+entry.length+payloadSize.length+ts.length+this.data.length);
        arr[0] = lBitfield;
        arr.set(entry, 1);
        arr.set(payloadSize, 1+entry.length);
        arr.set(ts, 1+entry.length+payloadSize.length);
        arr.set(this.data, 1+entry.length+payloadSize.length+ts.length);
        return arr;
    }

    toJSON() {
        return {
            entryId: this.entryId,
            ts: this.ts,
            data: [...this.data],
        };
    }
};
