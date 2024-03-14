import * as util from "./util.mjs";
import * as lib from "./lib.mjs";


export class WorkerClient extends util.Target {
    #script;

    #worker;

    constructor(script) {
        super();

        this.#script = "";

        this.#worker = null;

        this.script = script;

        this.addHandler("cmd-log", data => console.log("WORKER:"+this.script+" ::", ...util.ensure(data, "arr")));
        this.addHandler("cmd-error", e => {
            this.post("error", e);
            this.stop();
        });
    }

    get script() { return this.#script; }
    set script(v) {
        v = String(v);
        if (this.script == v) return;
        this.#script = v;
    }

    #hasWorker() { return this.#worker instanceof Worker; }

    start(data) {
        if (this.#hasWorker()) return false;
        const worker = this.#worker = new Worker(this.script, { type: "module" });
        worker.addEventListener("error", e => {
            if (this.#worker != worker) return;
            this.post("error", e);
            this.stop();
        });
        worker.addEventListener("message", e => {
            if (this.#worker != worker) return;
            if (!(e instanceof MessageEvent)) return console.warn(e);
            let data = util.ensure(e.data, "obj");
            let cmd = String(data.cmd);
            data = data.data;
            this.post("cmd-"+cmd, data);
        });
        this.send("start", data);
        this.post("start");
        return true;
    }
    stop() {
        if (!this.#hasWorker()) return false;
        this.#worker.terminate();
        this.post("stop");
        this.#worker = null;
        return true;
    }
    send(cmd, data) {
        if (!this.#hasWorker()) return false;
        this.#worker.postMessage({ cmd: String(cmd), data: data });
        return true;
    }
}

export class WorkerBase extends util.Target {
    #self;

    #progressT;

    constructor(self) {
        super();

        if (!(self instanceof DedicatedWorkerGlobalScope))
            throw new Error("Self is not of class DedicatedWorkerGlobalScope");
        this.#self = self;

        this.self.addEventListener("message", e => {
            if (!(e instanceof MessageEvent)) return;
            let data = util.ensure(e.data, "obj");
            let cmd = String(data.cmd);
            data = data.data;
            this.post("cmd-"+cmd, data);
        });

        this.#progressT = 0;

        self.console.log = (...a) => this.send("log", a);
    }

    get self() { return this.#self; }

    send(cmd, data) {
        this.self.postMessage({ cmd: String(cmd), data: data });
        return true;
    }
    progress(progress) {
        if (util.getTime()-this.#progressT < 1000/60) return false;
        this.#progressT = util.getTime();
        return this.send("progress", Math.min(1, Math.max(0, util.ensure(progress, "num"))));
    }
}
