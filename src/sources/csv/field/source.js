import * as util from "../../../util.mjs";
import * as lib from "../../../lib.mjs";

import HistoricalSource from "../../historical-source.js";


export default class CSVFieldSource extends HistoricalSource {
    static CLIENTDECODER = "../sources/csv/field/decoder-worker.js";
    static CLIENTENCODER = "../sources/csv/field/encoder-worker.js";
    static TYPE = "csv-field";
    static WANTED = "text";

    constructor() {
        super();
    }
}
