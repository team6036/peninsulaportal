import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import { WorkerBase } from "../../worker.js";

import DSLogDecoder from "./decoder-log.js";
import DSEventsDecoder from "./decoder-events.js";

import Source from "../source.js";


class DSDecoderWorker extends WorkerBase {
    constructor() {
        super(self);

        this.addHandler("cmd-start", data => {
            try {
                const opt = util.ensure(data.opt, "obj");
                this.progress(0);
                const dataSource = util.ensure(data.source, "obj");
                const logDecoder = new DSLogDecoder(dataSource.logData);
                const eventsDecoder = new DSEventsDecoder(dataSource.eventsData);
                const source = new Source();
                let first = true, tsMin = null, tsMax = null;
                const updateTime = ts => {
                    if (first) {
                        first = false;
                        return tsMin = tsMax = ts;
                    }
                    tsMin = Math.min(tsMin, ts);
                    tsMax = Math.max(tsMax, ts);
                };
                const fields = {
                    tripTime: ["TripTime", "double"],
                    packetLoss: ["PacketLoss", "double"],
                    batteryV: ["BatteryV", "double"],
                    cpuUsage: ["CPUUsage", "double"],
                    canUsage: ["CANUsage", "double"],
                    powerDistroCurrents: ["PowerDistributionCurrents", "double[]"],
                    brownout: ["Status/Brownout", "boolean"],
                    watchdog: ["Status/Watchdog", "boolean"],
                    dsTeleop: ["Status/DSTeleop", "boolean"],
                    dsDisabled: ["Status/DSDisabled", "boolean"],
                    robotTeleop: ["Status/RobotTeleop", "boolean"],
                    robotAuto: ["Status/RobotAuto", "boolean"],
                    robotDisabled: ["Status/RobotDisabled", "boolean"],
                };
                for (let k in fields) fields[k] = source.add("/DSLog/"+fields[k][0], fields[k][1]);
                logDecoder.build((record, progress) => {
                    this.progress(util.lerp(0, 0.5, progress));
                    updateTime(record.ts);
                    for (let k in fields) fields[k].update(record[k], record.ts);
                });
                const field = source.add("/DSEvents", "string");
                eventsDecoder.build((record, progress) => {
                    this.progress(util.lerp(0.5, 1, progress));
                    updateTime(record.ts);
                    field.update(record.text, record.ts);
                });
                source.tsMin = tsMin;
                source.tsMax = tsMax;
                this.progress(1);
                this.send("finish", source.toSerialized());
            } catch (e) { this.send("error", e); }
        });
    }
}

new DSDecoderWorker();
