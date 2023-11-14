import * as util from "../../util.mjs";

import { WorkerBase } from "../worker.js";

import WPILOGEncoder from "./encoder.js";

import Source from "../source.js";


class WPILOGEncoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                this.progress(0);
                const encoder = new WPILOGEncoder();
                const source = new Source();
                source.fromSerialized(data);
                let fields = [];
                const dfs = field => {
                    if (!field.hasType()) return field.fields.forEach(field => dfs(field));
                    fields.push(field);
                };
                dfs(source.root);
                fields.forEach((field, i) => {
                    let entryId = i+1;
                    let type = field.type;
                    if (type == "int") type = "int64";
                    if (type == "int[]") type = "int64[]";
                    let valueLog = field.valueLog;
                    if (valueLog.length <= 0) return;
                    encoder.addRecord(
                        WPILOGEncoder.Record.makeControlStart(
                            valueLog[0].ts,
                            {
                                entry: entryId,
                                name: field.path.join("/"),
                                type: type,
                                metadata: "",
                            },
                        ),
                    );
                    valueLog.forEach(log => {
                        let ts = log.ts * 1000, v = log.v;
                        let typefs = {
                            boolean: () => WPILOGEncoder.Record.makeBool(entryId, ts, v),
                            int64: () => WPILOGEncoder.Record.makeInt(entryId, ts, v),
                            float: () => WPILOGEncoder.Record.makeFloat(entryId, ts, v),
                            double: () => WPILOGEncoder.Record.makeDouble(entryId, ts, v),
                            string: () => WPILOGEncoder.Record.makeStr(entryId, ts, v),
                            json: () => typefs["string"](),
                            "boolean[]": () => WPILOGEncoder.Record.makeBoolArr(entryId, ts, v),
                            "int64[]": () => WPILOGEncoder.Record.makeIntArr(entryId, ts, v),
                            "float[]": () => WPILOGEncoder.Record.makeFloatArr(entryId, ts, v),
                            "double[]": () => WPILOGEncoder.Record.makeDoubleArr(entryId, ts, v),
                            "string[]": () => WPILOGEncoder.Record.makeStrArr(entryId, ts, v),
                        };
                        if (type in typefs) encoder.addRecord(typefs[type]());
                        else encoder.addRecord(WPILOGEncoder.makeRaw(entryId, ts, v));
                    });
                    this.progress(util.lerp(0, 0.5, (i+1)/fields.length));
                });
                let data = encoder.build(progress => this.progress(util.lerp(0.5, 1, progress)));
                this.progress(1);
                this.send("finish", data);
            } catch (e) { this.send("error", e); }
        });
    }
}

new WPILOGEncoderWorker();
