import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import { WorkerClient } from "../../worker.js";

import HistoricalSource from "../historical-source.js";


export default class DSSource extends HistoricalSource {
    static CLIENTDECODER = "./sources/ds/decoder-worker.js";
    static CLIENTENCODER = null;
    static TYPE = "ds";
    static WANTED = "uint8";

    static getName() { return "DriverStation"; }

    constructor() {
        super();
    }

    static cast(data) {
        data = util.ensure(data, "obj");
        data.logData = super.cast(data.logData);
        data.eventsData = super.cast(data.eventsData);
        return data;
    }
    static async fetch(pth) {
        let {logPth, eventsPth} = lib.getDSPaths(pth);
        let [logData, eventsData] = await Promise.all([logPth, eventsPth].map(async pth => await super.fetch(pth)));
        return {
            logData: logData,
            eventsData: eventsData,
        };
    }

    static async export(source, prefix="") { throw new Error("Exporting of DSSource is not supported"); }
}
