import * as util from "../../util.mjs";

import { WorkerBase } from "../../worker.js";

import WPILOGDecoder from "./decoder.js";

import Source from "../source.js";


class WPILOGDecoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                data = util.ensure(data, "obj");
                const opt = util.ensure(data.opt, "obj");
                this.progress(0);
                const decoder = new WPILOGDecoder(data.source);
                // crude serialized source building - find better way if possible
                // this is done to increase performance as normal method calls of an unserialized source results in way too much lag
                // UPDATE: might have fixed the lag issue
                // seems like repeated .lookup calls results in lag
                const source = new Source();
                let entryId2Name = {};
                let entryId2Type = {};
                let entryId2Topic = {};
                let first = true;
                decoder.build((record, progress) => {
                    this.progress(progress);
                    if (record.isControl()) {
                        if (!record.isControlStart()) return;
                        let startData = record.getControlStartData();
                        let id = startData.entry;
                        let name = entryId2Name[id] = startData.name;
                        let type = entryId2Type[id] = startData.type;
                        if (["int64"].includes(type)) type = "int";
                        if (["int64[]"].includes(type)) type = "int[]";
                        let path = String(name).split("/");
                        while (path.length > 0 && path.at(0).length <= 0) path.shift();
                        while (path.length > 0 && path.at(-1).length <= 0) path.pop();
                        source.create(path, type);
                        entryId2Topic[id] = source.root.lookup(path);
                    } else {
                        let id = record.entryId;
                        if (!(id in entryId2Name)) return;
                        if (!(id in entryId2Type)) return;
                        if (!(id in entryId2Topic)) return;
                        let name = entryId2Name[id];
                        let type = entryId2Type[id];
                        const topic = entryId2Topic[id];
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
                        topic.update(v, ts);
                        if (first) {
                            first = false;
                            source.tsMin = source.tsMax = ts;
                        } else {
                            source.tsMin = Math.min(source.tsMin, ts);
                            source.tsMax = Math.max(source.tsMax, ts);
                        }
                    }
                });
                this.progress(1);
                this.send("finish", source.toSerialized());
            } catch (e) { this.send("error", e); }
        });
    }
}

new WPILOGDecoderWorker();
