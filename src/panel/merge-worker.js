import * as util from "../util.mjs";

import { WorkerBase } from "../worker.js";

import Source from "../sources/source.js";


class MergeWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                throw "WILL FIX LATER - REMIND ME";
                data = util.ensure(data, "obj");
                const opt = util.ensure(data.opt, "obj");
                this.progress(0);
                const sources = util.ensure(data.sources, "arr").map(sourceData => {
                    const source = new Source();
                    source.fromSerialized(sourceData);
                    return source;
                });
                const conflictAffix = ["prefix", "suffix"].includes(opt.affix) ? opt.affix : "suffix";
                const conflictCount = ["numerical", "hexadecimal", "alphabetical"].includes(opt.count) ? opt.count : "numerical";
                const getConflictCount = i => {
                    i = util.ensure(i, "int");
                    if (conflictCount == "hexadecimal") return i.toString(16);
                    else if (conflictCount == "alphabetical") {
                        let buff = "";
                        while (i > 0) {
                            let d = i % 26;
                            buff = util.ALPHABETUPPER[d]+buff;
                            i = Math.floor(i / 26);
                        }
                        return buff;
                    }
                    return String(i);
                };
                const existing = new Set();
                const existingConflicts = {};
                sources.forEach((source, i) => {
                    let fields = [];
                    const dfs = field => {
                        if (!field.hasType()) return field.fields.forEach(field => dfs(field));
                        fields.push(field);
                    };
                    dfs(source.root);
                    fields.forEach((field, j) => {
                        this.progress(util.lerp(0, 0.5, (i+(j/fields.length))/sources.length));
                        let pth = field.textPath;
                        if (existing.has(pth)) return existingConflicts[pth] = 0;
                        existing.add(pth);
                    });
                });
                const outputSource = new Source();
                sources.forEach((source, i) => {
                    let fields = [];
                    const dfs = field => {
                        if (!field.hasType()) return field.fields.forEach(field => dfs(field));
                        fields.push(field);
                    };
                    dfs(source.root);
                    fields.forEach((field, j) => {
                        this.progress(util.lerp(0.5, 1, (i+(j/fields.length))/sources.length));
                        let pth = field.path;
                        let isSchema = pth.length >= 2 && pth[0] == ".schema";
                        let txtPth = field.textPath;
                        if (!isSchema && (txtPth in existingConflicts)) {
                            let count = getConflictCount(++existingConflicts[txtPth]);
                            let name = pth.pop();
                            if (conflictAffix == "prefix") pth.push(count, name);
                            else pth.push(name, count);
                        }
                        outputSource.create(pth, field.type);
                        outputSource.root.lookup(pth).valueLog = field.valueLog;
                    });
                });
                this.progress(1);
                this.send("finish", outputSource.toSerialized());
            } catch (e) { this.send("error", e); }
        });
    }
}

new MergeWorker();
