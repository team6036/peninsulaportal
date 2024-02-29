import * as util from "../../../util.mjs";
import * as lib from "../../../lib.mjs";

import { WorkerBase } from "../../../worker.js";

import CSVEncoder from "../encoder.js";

import Source, { toUint8Array } from "../../source.js";


class CSVFieldEncoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                data = util.ensure(data, "obj");
                const opt = util.ensure(data.opt, "obj");
                const prefix = util.generatePath(data.prefix)+"/";
                this.progress(0);
                const encoder = new CSVEncoder();
                const source = new Source();
                source.fromSerialized(data.source);
                let tsArr = new Set(), nameArr = [], typeArr = [];
                let fields = source.fieldObjects;
                fields = fields.filter(field => field.real);
                fields.forEach(field => {
                    field.valueLog.forEach(log => tsArr.add(log.ts));
                    nameArr.push(prefix+field.path);
                    typeArr.push(field.type);
                });
                tsArr = [...tsArr].sort((a, b) => a-b);
                const grid = [["", "", ...tsArr], ...nameArr.map((name, i) => [name, typeArr[i], ...new Array(tsArr.length).fill(JSON.stringify(null))])];
                fields.forEach((field, i) => {
                    this.progress(util.lerp(0, 0.5, i/fields.length));
                    field.valueLog.forEach(log => {
                        let ts = log.ts, v = log.v;
                        if (field.type == "structschema" || field.isStruct) v = [...toUint8Array(v)];
                        grid[1+i][2+tsArr.indexOf(ts)] = JSON.stringify(v);
                    });
                });
                encoder.grid = grid;
                data = encoder.build(p => util.lerp(0.5, 1, p));
                this.progress(1);
                this.send("finish", data);
            } catch (e) { this.send("error", e); }
        });
    }
}

new CSVFieldEncoderWorker();
