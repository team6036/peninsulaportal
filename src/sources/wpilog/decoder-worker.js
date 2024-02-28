import * as util from "../../util.mjs";

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
                const source = new Source(false);
                let entryId2Name = {};
                let entryId2Type = {};
                let entryId2Field = {};
                let first = true;
                decoder.build((record, progress) => {
                    this.progress(progress);
                    if (record.isControl()) {
                        if (record.isControlStart()) {
                            let startData = record.getControlStartData();
                            let id = startData.entry;
                            let name = entryId2Name[id] = startData.name;
                            let type = entryId2Type[id] = startData.type;
                            if (type == "int64") type = "int";
                            if (type == "int64[]") type = "int[]";
                            source.add(name, type);
                            entryId2Field[id] = source.getField(name);
                        } else if (record.isControlMetadata()) {
                            let metadataData = record.getControlMetadataData();
                            let id = metadataData.entry;
                            let metadata = metadataData.metadata;
                            if (!(id in entryId2Name)) return;
                            if (!(id in entryId2Type)) return;
                            if (!(id in entryId2Field)) return;
                            let name = entryId2Name[id];
                            let type = entryId2Type[id];
                            const field = entryId2Field[id];
                            let ts = record.ts / 1000;
                            field.updateMetadata(metadata, ts);
                            if (first) {
                                first = false;
                                source.tsMin = source.tsMax = ts;
                            } else {
                                source.tsMin = Math.min(source.tsMin, ts);
                                source.tsMax = Math.max(source.tsMax, ts);
                            }
                        }
                        return;
                    }
                    let id = record.entryId;
                    if (!(id in entryId2Name)) return;
                    if (!(id in entryId2Type)) return;
                    if (!(id in entryId2Field)) return;
                    let name = entryId2Name[id];
                    let type = entryId2Type[id];
                    const field = entryId2Field[id];
                    let ts = record.ts / 1000;
                    let typefs = {
                        boolean: () => record.getBool(),
                        int: () => record.getInt(),
                        int64: () => typefs["int"](),
                        float: () => record.getFloat(),
                        double: () => record.getDouble(),
                        string: () => record.getStr(),
                        json: () => typefs["string"](),
                        "boolean[]": () => record.getBoolArr(),
                        "int[]": () => record.getIntArr(),
                        "int64[]": () => typefs["int[]"](),
                        "float[]": () => record.getFloatArr(),
                        "double[]": () => record.getDoubleArr(),
                        "string[]": () => record.getStrArr(),
                    };
                    let v = (type in typefs) ? typefs[type]() : record.getRaw();
                    field.update(v, ts);
                    if (first) {
                        first = false;
                        source.tsMin = source.tsMax = ts;
                    } else {
                        source.tsMin = Math.min(source.tsMin, ts);
                        source.tsMax = Math.max(source.tsMax, ts);
                    }
                });
                this.progress(1);
                this.send("finish", source.toSerialized());
            } catch (e) { this.send("error", e); }
        });
    }
}

new WPILOGDecoderWorker();
