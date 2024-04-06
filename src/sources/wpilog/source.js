import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import HistoricalSource from "../historical-source.js";


export default class WPILOGSource extends HistoricalSource {
    static CLIENTDECODER = "../sources/wpilog/decoder-worker.js";
    static CLIENTENCODER = "../sources/wpilog/encoder-worker.js";
    static TYPE = "wpilog";
    static WANTED = "uint8";

    constructor() {
        super();
    }
}
