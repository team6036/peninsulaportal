import * as util from "../../../util.mjs";
import * as lib from "../../../lib.mjs";

import HistoricalSource from "../../historical-source.js";


export default class CSVTimeSource extends HistoricalSource {
    static CLIENTDECODER = "../sources/csv/time/decoder-worker.js";
    static CLIENTENCODER = "../sources/csv/time/encoder-worker.js";
    static TYPE = "csv-time";
    static WANTED = "text";

    constructor() {
        super();
    }
}
