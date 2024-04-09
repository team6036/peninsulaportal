import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";


export default class CSVDecoder extends util.Target {
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
        callback = util.ensure(callback, "func");
        this.#grid = [];
        let grid = this.data.split("\n");
        for (let i = 0; i < grid.length; i++) {
            let row = grid[i];
            let row2 = [];
            let buff = "";
            let quotes = false;
            for (let j = 0; j < row.length; j++) {
                callback((i+(j/row.length))/grid.length);
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
        this.#grid = grid;
        return this.grid;
    }
}
