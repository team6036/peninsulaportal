import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";

import { convertTime, getPowerDistro } from "./util.js";


// Rework of: https://github.com/Mechanical-Advantage/AdvantageScope/blob/main/src/hub/dataSources/dslog/DSLogReader.ts

export default class DSLogDecoder extends util.Target {
    #data;
    #dataView;

    constructor(data) {
        super();

        this.#data = util.toUint8Array(data);
        this.#dataView = new DataView(this.data.buffer);
    }

    get data() { return this.#data; }
    get dataView() { return this.#dataView; }

    isValid() { return this.version == 4; }
    get version() { return this.dataView.getInt32(0); }
    get ts() { return convertTime(this.dataView.getBigInt64(4), this.dataView.getBigUint64(12)); }

    build(callback) {
        if (!this.isValid()) throw new Error("Unsupported version: "+this.version);
        let x = 4+8+8;
        let ts = 0;
        let batteryVPrev = null;
        while (true) {
            let mask = this.dataView.getUint8(x+5);
            let batteryV = this.dataView.getUint16(x+2)/(2**8);
            if (batteryV > 20) batteryV = batteryVPrev;
            batteryVPrev = batteryV;
            const data = {
                ts: ts,

                tripTime: this.dataView.getUint8(x)*0.5,
                packetLoss: this.dataView.getInt8(x+1)*4/100,
                batteryV: batteryV,
                cpuUsage: this.dataView.getUint8(x+4)*0.5/100,
                canUsage: this.dataView.getUint8(x+6)*0.5/100,

                brownout: (mask & (1<<7)) == 0,
                watchdog: (mask & (1<<6)) == 0,
                dsTeleop: (mask & (1<<5)) == 0,
                dsDisabled: (mask & (1<<3)) == 0,
                robotTeleop: (mask & (1<<2)) == 0,
                robotAuto: (mask & (1<<1)) == 0,
                robotDisabled: (mask & (1<<0)) == 0,

                wifiDB: this.dataView.getUint8(x+7)*0.5,
                wifiMB: this.dataView.getUint16(x+8)/(2**8),
            };
            x += 10;
            let distro = getPowerDistro(this.dataView.getUint8(x+3));
            x += 4;
            let currents = data.powerDistroCurrents = [];
            let distrofs = {
                REV: () => {
                    x++;
                    let bools = [];
                    this.data.subarray(x, x+27).forEach(byte => {
                        for (let i = 0; i < 8; i++)
                            bools.push((byte & (1<<i)) != 0);
                    });
                    x += 27;
                    for (let i = 0; i < 20; i++) {
                        let rx = Math.floor(i/3)*32 + (i%3)*10, v = 0;
                        for (let i = 0; i < 10; i++)
                            v += bools[rx+i] ? (2**i) : 0;
                        currents.push(v/8);
                    }
                    for (let i = 0; i < 4; i++)
                        currents[i+20] = this.data[x+i]/16;
                    x += 4;
                    x += 1;
                },
                CTRE: () => {
                    x++;
                    let bools = [];
                    this.data.subarray(x, x+21).forEach((byte) => {
                        for (let i = 0; i < 8; i++)
                            bools.push((byte & (1<<i)) != 0);
                    });
                    for (let i = 0; i < 16; i++) {
                        let rx = Math.floor(i/6)*64 + (i%6)*10, v = 0;
                        for (let i = 0; i < 8; i++)
                            v += bools[rx+i] ? (2**i) : 0;
                        currents.push(v/8);
                    }
                    x += 21 + 3;
                },
            };
            if (distro in distrofs) distrofs[distro]();
            const record = new DSLogDecoder.Record(data);
            if (util.is(callback, "func"))
                callback(record, x/this.data.byteLength);
            ts += 0.02;
            if (x >= this.data.length) break;
        }
    }
}
DSLogDecoder.Record = class DSLogDecoderRecord extends util.Target {
    #ts;

    #tripTime;
    #packetLoss;
    #batteryV;
    #cpuUsage;
    #canUsage;
    #powerDistroCurrents;

    #brownout;
    #watchdog;
    #dsTeleop;
    #dsDisabled;
    #robotTeleop;
    #robotAuto;
    #robotDisabled;

    #wifiDB;
    #wifiMB;

    constructor(o) {
        super();

        o = util.ensure(o, "obj");

        this.#ts = util.ensure(o.ts, "num");

        this.#tripTime = util.ensure(o.tripTime, "num");
        this.#packetLoss = Math.min(1, Math.max(0, util.ensure(o.packetLoss, "num")));
        this.#batteryV = Math.max(0, util.ensure(o.batteryV, "num"));
        this.#cpuUsage = Math.min(1, Math.max(0, util.ensure(o.cpuUsage, "num")));
        this.#canUsage = Math.min(1, Math.max(0, util.ensure(o.canUsage, "num")));
        this.#powerDistroCurrents = util.ensure(o.powerDistroCurrents, "arr").map(current => util.ensure(current, "num"));

        this.#brownout = !!o.brownout;
        this.#watchdog = !!o.watchdog;
        this.#dsTeleop = !!o.dsTeleop;
        this.#dsDisabled = !!o.dsDisabled;
        this.#robotTeleop = !!o.robotTeleop;
        this.#robotAuto = !!o.robotAuto;
        this.#robotDisabled = !!o.robotDisabled;

        this.#wifiDB = Math.max(0, util.ensure(o.wifiDB, "num"));
        this.#wifiMB = Math.max(0, util.ensure(o.wifiMB, "num"));
    }
    
    get ts() { return this.#ts; }

    get tripTime() { return this.#tripTime; }
    get packetLoss() { return this.#packetLoss; }
    get batteryV() { return this.#batteryV; }
    get cpuUsage() { return this.#cpuUsage; }
    get canUsage() { return this.#canUsage; }
    get powerDistroCurrents() { return [...this.#powerDistroCurrents]; }

    get brownout() { return this.#brownout; }
    get watchdog() { return this.#watchdog; }
    get dsTeleop() { return this.#dsTeleop; }
    get dsDisabled() { return this.#dsDisabled; }
    get robotTeleop() { return this.#robotTeleop; }
    get robotAuto() { return this.#robotAuto; }
    get robotDisabled() { return this.#robotDisabled; }

    get wifiDB() { return this.#wifiDB; }
    get wifiMB() { return this.#wifiMB; }
};
