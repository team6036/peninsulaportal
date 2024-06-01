import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as cp from "child_process";


export class Process extends util.Target {
    #id;
    #tags;

    #parent;

    #process;

    constructor(mode, ...a) {
        super();

        this.#id = null;
        this.#tags = new Set();

        this.#parent = null;

        this.#process = 
            (mode == "exec") ? cp.exec(...a) :
            (mode == "execFile") ? cp.execFile(...a) :
            (mode == "fork") ? cp.fork(...a) :
            (mode == "spawn") ? cp.spawn(...a) :
            null;
        if (!this.process) throw new Error(`Invalid spawn mode '${mode}'`);
        this.process.stdout.on("data", data => this.post("data", data));
        let error = "";
        this.process.stderr.on("data", data => {
            error += util.TEXTDECODER.decode(data);
        });
        this.process.on("exit", () => {
            if (error) this.post("error", error);
            this.post("exit", this.process.exitCode);
            this.terminate();
        });
        this.process.on("error", e => {
            this.post("error", e);
            this.post("exit", this.process.exitCode);
            this.terminate();
        });

        this.addHandler("exit", data => (this.parent = null));
    }

    get id() { return this.#id; }
    set id(v) {
        v = (v == null) ? null : String(v);
        if (this.id == v) return;
        this.#id = v;
    }
    get tags() { return [...this.#tags]; }
    set tags(v) {
        v = util.ensure(v, "arr");
        this.clearTags();
        this.addTag(v);
    }
    clearTags() {
        let tags = this.tags;
        tags.forEach(tag => this.remTag(tag));
        return tags;
    }
    hasTag(tag) {
        return this.#tags.has(tag);
    }
    addTag(...tags) {
        return util.Target.resultingForEach(tags, tag => {
            this.#tags.add(tag);
            return tag;
        });
    }
    remTag(...tags) {
        return util.Target.resultingForEach(tags, tag => {
            this.#tags.delete(tag);
            return tag;
        });
    }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof ProcessManager) ? v : null;
        if (this.parent == v) return;
        if (this.hasParent())
            this.parent.remProcess(this);
        this.#parent = v;
        if (this.hasParent())
            this.parent.addProcess(this);
    }
    hasParent() { return !!this.parent; }

    get process() { return this.#process; }

    async terminate() {
        if (this.process.exitCode != null) return false;
        this.process.kill("SIGKILL");
        this.post("exit", null);
        return true;
    }
}

export class ProcessManager extends util.Target {
    #processes;

    constructor() {
        super();

        this.#processes = new Set();
    }

    get processes() { return [...this.#processes]; }
    set processes(v) {
        v = util.ensure(v, "arr");
        this.clearProcesses();
        this.addProcess(v);
    }
    clearProcesses() {
        let processes = this.processes;
        this.remProcess(processes);
        return processes;
    }
    hasProcess(process) {
        if (!(process instanceof Process)) return false;
        return this.#processes.has(process) && process.parent == this;
    }
    addProcess(...processes) {
        return util.Target.resultingForEach(processes, process => {
            if (!(process instanceof Process)) return false;
            if (this.hasProcess(process)) return false;
            this.#processes.add(process);
            process.parent = this;
            process.onAdd();
            return process;
        });
    }
    remProcess(...processes) {
        return util.Target.resultingForEach(processes, process => {
            if (!(process instanceof Process)) return false;
            if (!this.hasProcess(process)) return false;
            process.onRem();
            this.#processes.delete(process);
            process.parent = null;
            return process;
        });
    }

    getProcessById(id) {
        for (let process of this.processes)
            if (process.id == id)
                return process;
        return null;
    }
    getProcessesByTag(tag) {
        tag = String(tag);
        return this.processes.filter(process => process.hasTag(tag));
    }
}
