import * as util from "../../util.mjs";

import { WorkerBase } from "../worker.js";

import WPILOGDecoder from "./decoder.js";

import Source from "../source.js";


class WPILOGDecoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                const fast = true;
                const decoder = new WPILOGDecoder(data);
                // crude serialized source building - find better way if possible
                // this is done to increase performance as normal method calls of an unserialized source results in way too much lag
                const source = fast ? {
                    postNest: false,
                    postFlat: true,
                    nestRoot: {},
                    flatRoot: {
                        name: "",
                        children: [],
                    },
                    tsMin: 0,
                    tsMax: 0,
                } : (() => {
                    let source = new Source();
                    source.postNest = false;
                    source.postFlat = true;
                    source.tsMin = source.tsMax = 0;
                    return source;
                })();
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
                        if (fast) {
                            const topic = entryId2Topic[id] = {
                                name: name,
                                type: type,
                                valueLog: [],
                            };
                            source.flatRoot.children.push(topic);
                        } else {
                            entryId2Topic[id] = source.create([name], type);
                        }
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
                            "boolean[]": () => record.getBoolArr(),
                            "int[]": () => record.getIntArr(),
                            "int64[]": () => typefs["int[]"](),
                            "float[]": () => record.getFloatArr(),
                            "double[]": () => record.getDoubleArr(),
                            "string[]": () => record.getStrArr(),
                            json: () => record.getStr(),
                        };
                        let v = (type in typefs) ? typefs[type]() : record.getRaw();
                        if (fast) {
                            topic.valueLog.push({ ts: ts, v: v });
                        } else {
                            source.update([name], v, ts);
                        }
                        if (first) {
                            first = false;
                            source.tsMin = source.tsMax = ts;
                        } else {
                            source.tsMin = Math.min(source.tsMin, ts);
                            source.tsMax = Math.max(source.tsMax, ts);
                        }
                    }
                });
                this.send("finish", fast ? source : source.toSerialized());
            } catch (e) { this.send("error", { e: e }); }
        });
    }
}

new WPILOGDecoderWorker();
