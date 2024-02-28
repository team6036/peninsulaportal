import * as util from "../../../util.mjs";


export default class CSVTimeDecoder extends util.Target {
    #data;
    #grid;

    constructor(data) {
        super();

        this.#data = String(data);

        this.#grid = [];
    }

    get data() { return this.#data; }

    get grid() { return this.#grid; }

    build(callback) {
        this.#grid = [];
        let grid = this.data.split("\n");
        for (let i = 0; i < grid.length; i++) {
            let row = grid[i];
            let row2 = [];
            let buff = "";
            let quotes = false;
            for (let j = 0; j < row.length; j++) {
                let c = row[j];
                if (quotes) {
                    if (c == "\"") {
                        if (j+1 < row.length && row[j+1] == "\"") {
                            buff += "\"";
                            continue;
                        }
                        quotes = false;
                        continue;
                    }
                    buff += c;
                    continue;
                }
                if (c == "\"") {
                    if (j+1 < row.length && row[j+1] == "\"") {
                        buff += "\"";
                        continue;
                    }
                    quotes = true;
                    continue;
                }
                if (c == ",") {
                    row2.push(buff);
                    buff = "";
                    continue;
                }
                buff += c;
            }
            row2.push(buff);
            grid[i] = row2.map(data => data.trim());
        }
        console.log(grid);
        const h = grid.length;
        const w = grid[0].length;
        if (h < 2) throw new Error("Invalid height ("+h+")");
        if (w < 1) throw new Error("Invalid width ("+w+")");
        let i = 0;
        for (let row of grid) {
            if (row.length != w)
                throw new Error("Invalid row length for row "+i);
            i++;
        }
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                if (util.is(callback, "func"))
                    callback((i*w+j)/(w*h));
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
                try {
                    grid[i][j] = JSON.parse(String(grid[i][j]));
                } catch (e) { grid[i][j] = null; }
            }
        }
        grid = grid.filter((row, i) => (i <= 1) || util.is(row[0], "num")).sort((a, b) => {
            if (a[0] == null && b[0] == null) return 0;
            if (a[0] == null) return -1;
            if (b[0] == null) return +1;
            return a[0]-b[0];
        });
        this.#grid = grid;
        return this.grid;
    }
}
