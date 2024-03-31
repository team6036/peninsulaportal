import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import { WorkerBase } from "../../worker.js";

import WPILOGDecoder from "./decoder.js";

import Source from "../source.js";


class WPILOGDecoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                const opt = util.ensure(data.opt, "obj");
                this.progress(0);
                const decoder = new WPILOGDecoder(data.source);
                const source = new Source(true);
                let entryId2Field = {};
                let first = true;
                const updateTime = ts => {
                    if (first) {
                        first = false;
                        return source.tsMin = source.tsMax = ts;
                    }
                    source.tsMin = Math.min(source.tsMin, ts);
                    source.tsMax = Math.max(source.tsMax, ts);
                };
                decoder.build((record, progress) => {
                    this.progress(progress);
                    if (record.isControl()) {
                        if (record.isControlStart()) {
                            let startData = record.getControlStartData();
                            let id = startData.entry;
                            let name = startData.name;
                            let type = startData.type;
                            if (type == "int64") type = "int";
                            if (type == "int64[]") type = "int[]";
                            source.add(name, type);
                            entryId2Field[id] = source.getField(name);
                        } else if (record.isControlMeta()) {
                            let metadataData = record.getControlMetadataData();
                            let id = metadataData.entry;
                            let metadata = metadataData.metadata;
                            if (!(id in entryId2Field)) return;
                            const field = entryId2Field[id];
                            let ts = record.ts / 1000;
                            field.updateMeta(metadata, ts);
                            updateTime(ts);
                        }
                        return;
                    }
                    let id = record.entryId;
                    if (!(id in entryId2Field)) return;
                    const field = entryId2Field[id];
                    let ts = record.ts / 1000;
                    let typefs = {
                        boolean: () => record.getBool(),
                        int: () => record.getInt(),
                        float: () => record.getFloat(),
                        double: () => record.getDouble(),
                        string: () => record.getStr(),
                        "boolean[]": () => record.getBoolArr(),
                        "int[]": () => record.getIntArr(),
                        "float[]": () => record.getFloatArr(),
                        "double[]": () => record.getDoubleArr(),
                        "string[]": () => record.getStrArr(),
                    };
                    let v = (field.type in typefs) ? typefs[field.type]() : record.getRaw();
                    field.update(v, ts, true);
                    updateTime(ts);
                });
                this.progress(1);
                this.send("finish", source.toSerialized());
            } catch (e) { this.send("error", e); }
        });
    }
}

new WPILOGDecoderWorker();
