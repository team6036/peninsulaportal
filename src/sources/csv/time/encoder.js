import * as util from "../../../util.mjs";


export default class CSVTimeEncoder extends util.Target {
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
        let grid = this.grid;
        const h = grid.length;
        if (h < 2) throw new Error("Invalid height ("+h+")");
        const w = grid[0].length;
        if (w < 1) throw new Error("Invalid width ("+w+")");
        let i = 0;
        for (let row of grid) {
            if (row.length != w)
                throw new Error("Invalid row length for row "+i);
            i++;
        }
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                if (i <= 1 && j <= 0) {
                    grid[i][j] = null;
                    continue;
                }
                if (i <= 1) {
                    grid[i][j] = String(grid[i][j]);
                    continue;
                }
                if (j <= 0) {
                    grid[i][j] = parseFloat(grid[i][j]);
                    continue;
                }
            }
        }
        grid = grid.filter((row, i) => (i <= 1) || util.is(row[0], "num")).sort((a, b) => {
            if (a[0] == null && b[0] == null) return 0;
            if (a[0] == null) return -1;
            if (b[0] == null) return +1;
            return a[0]-b[0];
        });
        let data = [];
        for (let i = 0; i < h; i++) {
            let row = [];
            for (let j = 0; j < w; j++) {
                if (util.is(callback, "func"))
                    callback((i*w+j)/(w*h));
                if (i <= 1 && j <= 0) {
                    row.push("");
                    continue;
                }
                if (i <= 1) {
                    row.push(String(grid[i][j]));
                    continue;
                }
                if (j <= 0) {
                    row.push(String(grid[i][j]));
                    continue;
                }
                row.push(JSON.stringify(grid[i][j]));
            }
            let row2 = [];
            for (let data of row) {
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
