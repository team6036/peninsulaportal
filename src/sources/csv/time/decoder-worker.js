import * as util from "../../../util.mjs";

import { WorkerBase } from "../../../worker.js";

import CSVTimeDecoder from "./decoder.js";

import Source, { toUint8Array } from "../../source.js";


class CSVTimeDecoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                const opt = util.ensure(data.opt, "obj");
                this.progress(0);
                const decoder = new CSVTimeDecoder(data.source);
                const source = new Source(false);
                decoder.build(p => this.progress(util.lerp(0, 0.5, p)));
                let first = true;
                const grid = decoder.grid;
                const h = grid.length;
                const w = grid[0].length;
                for (let i = 1; i < w; i++) {
                    let name = grid[0][i];
                    let type = grid[1][i];
                    source.add(name, type);
                    const field = source.getField(name);
                    for (let j = 2; j < h; j++) {
                        let ts = grid[j][0];
                        let v = grid[j][i];
                        if (v == null) continue;
                        if (field.type == "structschema" || field.isStruct) v = toUint8Array(v);
                        field.update(v, ts);
                        if (first) {
                            first = false;
                            source.tsMin = source.tsMax = ts;
                        } else {
                            source.tsMin = Math.min(source.tsMin, ts);
                            source.tsMax = Math.max(source.tsMax, ts);
                        }
                        this.progress(util.lerp(0.5, 1, (i*h+j)/(w*h)));
                    }
                }
                this.progress(1);
                this.send("finish", source.toSerialized());
            } catch (e) { this.send("error", e); }
        });
    }
}

new CSVTimeDecoderWorker();
