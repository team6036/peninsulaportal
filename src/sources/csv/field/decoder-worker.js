import * as util from "../../../util.mjs";
import * as lib from "../../../lib.mjs";

import { WorkerBase } from "../../../worker.js";

import CSVDecoder from "../decoder.js";

import Source from "../../source.js";


class CSVFieldDecoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                const opt = util.ensure(data.opt, "obj");
                this.progress(0);
                const decoder = new CSVDecoder(data.source);
                const source = new Source();
                decoder.build(p => this.progress(util.lerp(0, 1/3, p)));
                const grid = decoder.grid;
                const h = grid.length;
                const w = grid[0].length;
                if (w < 2) throw new Error("W < 2 ("+h+")");
                for (let i = 0; i < h; i++) {
                    for (let j = 0; j < w; j++) {
                        this.progress(util.lerp(1/3, 2/3, (i*w+j)/(w*h)));
                        if (i <= 0 && j <= 1) {
                            grid[i][j] = null;
                            continue;
                        }
                        if (i <= 0) {
                            grid[i][j] = parseFloat(grid[i][j]);
                            continue;
                        }
                        if (j <= 1) {
                            continue;
                        }
                        grid[i][j] = JSON.parse(grid[i][j]);
                    }
                }
                let first = true;
                for (let i = 1; i < h; i++) {
                    let name = grid[i][0];
                    let type = grid[i][1];
                    source.add(name, type);
                    const field = source.getField(name);
                    for (let j = 2; j < w; j++) {
                        let ts = grid[0][j];
                        if (!util.is(ts, "num")) continue;
                        let v = grid[i][j];
                        if (v == null) continue;
                        if (field.type == "structschema" || field.isStruct) v = util.toUint8Array(v);
                        field.update(v, ts);
                        if (first) {
                            first = false;
                            source.tsMin = source.tsMax = ts;
                        } else {
                            source.tsMin = Math.min(source.tsMin, ts);
                            source.tsMax = Math.max(source.tsMax, ts);
                        }
                        this.progress(util.lerp(2/3, 1, (i*w+j)/(w*h)));
                    }
                }
                this.progress(1);
                this.send("finish", source.toSerialized());
            } catch (e) { this.send("error", e); }
        });
    }
}

new CSVFieldDecoderWorker();
