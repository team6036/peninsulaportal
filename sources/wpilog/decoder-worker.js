import * as util from "../../util.mjs";

import { WorkerBase } from "../worker.js";

import WPILOGDecoder from "./decoder.js";

import Source from "../source.js";


class WPILOGDecoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                const decoder = new WPILOGDecoder(data);
                // crude serialized source building - find better way if possible
                // this is done to increase performance as normal method calls of an unserialized source results in way too much lag
                const source = {
                    postNest: true,
                    postFlat: false,
                    nestRoot: {
                        name: "",
                        children: [],
                    },
                    flatRoot: {},
                    tsMin: 0,
                    tsMax: 0,
                };
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
                        const topic = entryId2Topic[id] = {
                            name: path.pop(),
                            type: type,
                            valueLog: [],
                        };
                        let children = source.nestRoot.children;
                        while (path.length > 0) {
                            let name = path.shift();
                            let found = null;
                            children.forEach(child => {
                                if (found) return;
                                if (child.name != name) return;
                                if (!child.children) return;
                                found = child;
                            });
                            if (!found) {
                                found = {
                                    name: name,
                                    children: [],
                                };
                                children.push(found);
                            }
                            children = found.children;
                        }
                        children.push(topic);
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
                        topic.valueLog.push({ ts: ts, v: v });
                        if (first) {
                            first = false;
                            source.tsMin = source.tsMax = ts;
                        } else {
                            source.tsMin = Math.min(source.tsMin, ts);
                            source.tsMax = Math.max(source.tsMax, ts);
                        }
                    }
                });
                this.send("finish", source);
            } catch (e) { this.send("error", { e: e }); }
        });
    }
}

new WPILOGDecoderWorker();
