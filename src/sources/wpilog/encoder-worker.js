import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import { WorkerBase } from "../../worker.js";

import WPILOGEncoder from "./encoder.js";

import Source from "../source.js";


class WPILOGEncoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                data = util.ensure(data, "obj");
                const opt = util.ensure(data.opt, "obj");
                const prefix = util.generatePath(data.prefix)+"/";
                this.progress(0);
                const encoder = new WPILOGEncoder();
                const source = new Source();
                source.fromSerialized(data.source);
                let fields = source.fieldObjects;
                fields = fields.filter(field => field.real);
                fields.forEach((field, i) => {
                    let entryId = i+1;
                    let type = field.type;
                    if (type == "int") type = "int64";
                    if (type == "int[]") type = "int64[]";
                    const logsN = field.logsN;
                    const logsTS = field.logsTS;
                    const logsV = field.logsV;
                    const metaLogsN = field.metaLogsN;
                    const metaLogsTS = field.metaLogsTS;
                    const metaLogsV = field.metaLogsV;
                    if (logsN <= 0 && metaLogsN <= 0) return;
                    encoder.addRecord(
                        WPILOGEncoder.Record.makeControlStart(
                            logs[0].ts,
                            {
                                entry: entryId,
                                name: prefix+field.path,
                                type: type,
                                metadata: "",
                            },
                        ),
                    );
                    for (let i = 0; i < logsN; i++) {
                        let ts = logsTS[i]*1000, v = logsV[i];
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
                        else encoder.addRecord(WPILOGEncoder.Record.makeRaw(entryId, ts, v));
                    }
                    for (let i = 0; i < metaLogsN; i++) {
                        let ts = metaLogsTS[i]*1000, v = metaLogsV[i];
                        if (!util.is(v, "str"))
                            try {
                                v = JSON.stringify(v);
                            } catch (e) { v = String(v); }
                        encoder.addRecord(WPILOGEncoder.Record.makeControlMetadata(ts, {
                            entry: entryId,
                            v: v,
                        }));
                    }
                    this.progress(util.lerp(0, 0.5, (i+1)/fields.length));
                });
                data = encoder.build(progress => this.progress(util.lerp(0.5, 1, progress)));
                this.progress(1);
                this.send("finish", [...data]);
            } catch (e) { this.send("error", e); }
        });
    }
}

new WPILOGEncoderWorker();
