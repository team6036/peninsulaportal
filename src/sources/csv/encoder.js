import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";


export default class CSVEncoder extends util.Target {
    #data;
    #grid;

    constructor() {
        super();

        this.#data = "";
        this.#grid = [];
    }
    
    get data() { return this.#data; }

    get grid() { return this.#grid; }
    set grid(v) { this.#grid = util.ensure(v, "arr").map(row => util.ensure(row, "arr")); }

    build(callback) {
        const grid = this.grid;
        const h = grid.length;
        if (h < 1) throw new Error("Invalid height ("+h+")");
        const w = grid[0].length;
        if (w < 1) throw new Error("Invalid width ("+w+")");
        let i = 0;
        for (let row of grid) {
            if (row.length != w)
                throw new Error("Invalid row length for row "+i+" (expected "+w+", got "+row.length+")");
            i++;
        }
        let data = [];
        for (let i = 0; i < h; i++) {
            let row = grid[i], row2 = [];
            for (let j = 0; j < w; j++) {
                if (util.is(callback, "func"))
                    callback((i*w+j)/(w*h));
                let data = String(row[j]);
                data = data.replaceAll("\"", "\"\"");
                if (data.includes(",")) row2.push("\""+data+"\"");
                else row2.push(data);
            }
            data.push(row2.join(","));
        }
        data = data.join("\n");
        this.#data = data;
        return this.data;
    }
}
