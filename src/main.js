"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

/*

   ______   ______   _______   __   _______   ______   ___  __   __      _______
  / ______\/ ______\/ _______\/ __\/ _______\/ ______\/ __\/\__\/ __\   / _______\
 / /  __  / /  __  / /  _    / /  / /  _    /\/  ____/ /  / /  / /  /  / /  __   /
/ /  ____/ /  ____/ /  / /  / /  / /  / /  /\_\___ \/ /  /_/  / /  /_\/ /  __   /
\/__/    \/______/\/__/\/__/\/__/\/__/\/__/\/______/\/_______/\/_____/\/__/\/__/

Welcome to Peninsula Portal!

Developed by FRC 6036 - Jeffrey Fan

Haha no documentation!

*/

const MAIN = async () => {

    const makePureEscape = v => ("\x1B["+v);
    const makeEscape = (...a) => makePureEscape(a.join(";")+"m");
    const CONSOLERESET = makeEscape(0);
    const CONSOLEDEFAULT = makeEscape(1, 39);
    const CONSOLEYELLOW = makeEscape(1, 33);
    const CONSOLERED = makeEscape(1, 31);

    const log = (...a) => {
        let now = new Date();
        let yr = now.getFullYear();
        let mon = String(now.getMonth()+1).padStart(2, "0");
        let d = String(now.getDate()).padStart(2, "0");
        let hr = String(now.getHours()).padStart(2, "0");
        let min = String(now.getMinutes()).padStart(2, "0");
        let s = String(now.getSeconds()).padStart(2, "0");
        let ms = String(now.getMilliseconds()).padEnd(3, "0");
        return console.log(`${yr}-${mon}-${d} ${hr}:${min}:${s}.${ms}`, ...a);
    };

    log("< IMPORTING ASYNCHRONOUSLY >");

    const util = await import("./util.mjs");
    const V = util.V;
    const lib = await import("./lib.mjs");

    log("< IMPORTED ASYNCHRONOUSLY >");

    const os = require("os");

    const path = require("path");
    const fs = require("fs");
    lib.FSOperator.path = path;
    lib.FSOperator.fs = fs;

    const cp = require("child_process");
    const { URL } = require("url");

    const electron = require("electron");
    let showError = this.showError = async (name, type, e) => {
        let message = String(name);
        if (type) message += " - "+String(type);
        electron.dialog.showErrorBox(message, (e == null) ? "" : util.stringifyError(e));
    };
    let showWarn = async (name, type, e) => {
        let message = String(name);
        if (type) message += " - "+String(type);
        await electron.dialog.showMessageBox({
            message: message,
            detail: (e == null) ? "" : util.stringifyError(e),
            type: "warning",
            buttons: ["OK"],
        });
    };
    let showSuccess = async (name, type, e) => {
        let message = String(name);
        if (type) message += " - "+String(type);
        await electron.dialog.showMessageBox({
            message: message,
            detail: (e == null) ? "" : util.stringifyError(e),
            type: "info",
            buttons: ["OK"],
        });
    };
    let showConfirm = async (name, type, e, ok="OK", cancel="Cancel") => {
        let message = String(name);
        if (type) message += " - "+String(type);
        let i = (await electron.dialog.showMessageBox({
            message: message,
            detail: (e == null) ? "" : util.stringifyError(e),
            type: "question",
            buttons: [ok, cancel],
            cancelId: 1,
        })).response;
        return i == 0;
    };
    let showTerminationConfirm = async (name, type, e) => await showConfirm(name, type, e, "Terminate", "Continue anyway");
    const app = this.app = electron.app;
    const ipc = electron.ipcMain;

    const lock = app.requestSingleInstanceLock();
    if (!lock) {
        log("< PRE-EXISTING INSTANCE - QUIT >");
        app.quit();
        return;
    }

    const fetch = require("electron-fetch").default;
    const png2icons = require("png2icons");
    const compareVersions = require("compare-versions");

    const sc = require("socket.io-client");
    const ss = require("socket.io-stream");

    const tba = require("tba-api-v3client");

    const ytdl = require("ytdl-core");

    const octokit = require("octokit");

    const zlib = require("zlib");
    const zlibCompress = async (src, dst) => {
        await new Promise(async (res, rej) => {
            const z = new zlib.createDeflate();
            z.on("error", rej);

            const streamIn = fs.createReadStream(src);
            streamIn.on("error", rej);
            const streamOut = fs.createWriteStream(dst);
            streamOut.on("error", rej);

            streamOut.on("finish", res);

            streamIn.pipe(z).pipe(streamOut);
        });
        return true;
    };
    const zlibDecompress = async (src, dst) => {
        await new Promise(async (res, rej) => {
            const z = new zlib.createInflate();
            z.on("error", rej);

            const streamIn = fs.createReadStream(src);
            streamIn.on("error", rej);
            const streamOut = fs.createWriteStream(dst);
            streamOut.on("error", rej);

            streamOut.on("finish", res);

            streamIn.pipe(z).pipe(streamOut);
        });
        return true;
    };
    const tar = require("tar");
    const tarCompress = async (src, dst) => {
        await new Promise((res, rej) => {
            const stream = fs.createWriteStream(dst);
            stream.on("error", rej);

            const t = tar.create(
                {
                    sync: false,
                    gzip: true,
                    cwd: path.dirname(src),
                    preservePaths: false,
                },
                [path.basename(src)],
            );
            t.on("error", rej);

            stream.on("finish", res);

            t.pipe(stream);
        });
        return true;
    };
    const tarDecompress = async (src, dst) => {
        await new Promise((res, rej) => {
            const stream = fs.createReadStream(src);
            stream.on('error', rej);

            const t = tar.extract(
                {
                    sync: false,
                    cwd: dst,
                    preservePaths: false,
                },
            );
            t.on("error", rej);

            t.on("finish", res);

            stream.pipe(t);
        });
    };

    const OS = Object.freeze({
        arch: os.arch(),
        platform: os.platform(),
        cpus: os.cpus(),
        user: os.userInfo(),
    });
    const args = [...process.argv];
    args.shift();
    if (!app.isPackaged) args.shift();
    const bootParams = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith("--") || arg.startsWith("-")) {
            const arg2 = arg.startsWith("--") ? arg.slice(2) : arg.slice(1);
            if (arg.includes("=")) {
                let k = arg2.split("=")[0];
                let v = arg2.split("=").slice(1).join("=");
                try {
                    v = JSON.parse(v);
                } catch (e) {}
                bootParams[k] = v;
            } else {
                bootParams[arg2] = true;
            }
            continue;
        }
        if (arg.includes("=")) {
            let k = arg.split("=")[0];
            let v = arg.split("=").slice(1).join("=");
            try {
                v = JSON.parse(v);
            } catch (e) {}
            bootParams[k] = v;
        } else {
            bootParams[arg] = true;
        }
    }
    Object.freeze(bootParams);

    function simplify(s) {
        s = String(s);
        if (s.length > 20) s = s.slice(0, 20)+"...";
        return s;
    }
    function mergeThings(dest, src) {
        if (util.is(dest, "arr")) {
            dest.push(...util.ensure(src, "arr"));
            return dest;
        } else if (util.is(dest, "obj")) {
            src = util.ensure(src, "obj");
            for (let k in src) {
                if (k in dest) dest[k] = mergeThings(dest[k], src[k]);
                else dest[k] = src[k];
            }
            return dest;
        }
        return (src == null) ? dest : src;
    }
    function isEmpty(o) {
        if (util.is(o, "arr")) return o.length <= 0;
        if (util.is(o, "obj")) return isEmpty(Object.keys(o));
        return o == null;
    }
    function cleanupEmpties(o) {
        if (util.is(o, "arr"))
            return Array.from(o).map(o => cleanupEmpties(o)).filter(o => !isEmpty(o));
        if (util.is(o, "obj")) {
            for (let k in o) {
                o[k] = cleanupEmpties(o[k]);
                if (isEmpty(o[k])) delete o[k];
            }
            return o;
        }
        return isEmpty(o) ? null : o;
    }

    const DATASCHEMA = [
        /\.DS_Store/,
        /thumb\.db/,
        /desktop\.ini/,

        /^logs$/,
        /^logs\/[^\/]+\.log$/,

        /^dump.*$/,

        /^db\.json$/,
        /^\.version$/,
        /^state\.json$/,

        /^(data|override)$/,

        /^(data|override)\/templates$/,
        /^(data|override)\/templates\/[^\/]+$/,
        /^(data|override)\/templates\/[^\/]+\/config\.json$/,
        /^(data|override)\/templates\/[^\/]+\/[^\/]+\.(glb|png|glb-tmp|png-tmp)$/,
        /^(data|override)\/templates\/config\.json$/,

        /^(data|override)\/robots$/,
        /^(data|override)\/robots\/[^\/]+$/,
        /^(data|override)\/robots\/[^\/]+\/config\.json$/,
        /^(data|override)\/robots\/[^\/]+\/[^\/]+\.(glb|glb-tmp)$/,
        /^(data|override)\/robots\/config\.json$/,

        /^(data|override)\/holidays$/,
        /^(data|override)\/holidays\/[^\/]+$/,
        /^(data|override)\/holidays\/[^\/]+\/config\.json$/,
        /^(data|override)\/holidays\/[^\/]+\/[^\/]+\.(svg|png|ico|icns|svg-tmp|png-tmp|ico-tmp|icns-tmp|json)$/,
        /^(data|override)\/holidays\/config\.json$/,

        /^(data|override)\/themes$/,
        /^(data|override)\/themes\/[^\/]+$/,
        /^(data|override)\/themes\/[^\/]+\/config\.json$/,
        /^(data|override)\/themes\/config\.json$/,

        /^(data|override)\/config\.json$/,
    ];
    lib.FEATURES.forEach(name => {
        name = name.toLowerCase();
        DATASCHEMA.push(
            new RegExp("^"+name+"$"),
            new RegExp("^"+name+"/config\\.json$"),
            new RegExp("^"+name+"/state\\.json$"),
        );
        if (!lib.APPFEATURES.includes(name.toUpperCase())) return;
        DATASCHEMA.push(
            new RegExp("^"+name+"/projects$"),
            new RegExp("^"+name+"/projects/[^/]+\\.json$"),
            new RegExp("^"+name+"/projects\\.json$"),
        );
    });

    DATASCHEMA.push(
        /^panel\/logs$/,
        /^panel\/logs\/[^\/]+\.wpilog$/,
        /^panel\/videos$/,
        /^panel\/videos\/[^\/]+\.(mp4|mov)$/,
    );

    DATASCHEMA.push(
        /^planner\/solver.*$/,
    );

    const DATATYPES = ["data", "override"];

    class MissingError extends Error {
        constructor(message, ...a) {
            super(message, ...a);
        }
    }

    class Process extends util.Target {
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
    class ProcessManager extends util.Target {
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
    class Client extends util.Target {
        #id;
        #tags;

        #location;

        #socket;

        constructor(location) {
            super();

            this.#id = null;
            this.#tags = new Set();

            this.#location = String(location);

            this.#socket = sc.connect(this.location, {
                autoConnect: false,
            });
            const msg = async (data, ack) => {
                data = util.ensure(data, "obj");
                const name = String(data.name);
                const payload = data.payload;
                const meta = {
                    location: this.location,
                    connected: this.connected,
                    socketId: this.socketId,
                };
                let results = [];
                results.push(...(await this.postResult("msg", name, payload, meta)));
                results.push(...(await this.postResult("msg-"+name, payload, meta)));
                ack = util.ensure(ack, "func");
                let r = util.ensure(results[0], "obj");
                r.success = ("success" in r) ? (!!r.success) : true;
                r.ts = util.getTime();
                ack(r);
            };
            this.#socket.on("connect", () => msg({ name: "connect", ts: util.getTime() }));
            this.#socket.on("disconnect", () => msg({ name: "disconnect", ts: util.getTime() }));
            this.#socket.on("msg", (data, ack) => msg(data, ack));
            ss(this.#socket).on("stream", async (ssStream, data, ack) => {
                data = util.ensure(data, "obj");
                const name = String(data.name);
                const fname = String(data.fname);
                const payload = data.payload;
                const meta = {
                    location: this.location,
                    connected: this.connected,
                    socketId: this.socketId,
                };
                let results = [];
                results.push(...(await this.postResult("stream", name, fname, payload, meta, ssStream)));
                results.push(...(await this.postResult("stream-"+name, fname, payload, meta, ssStream)));
                ack = util.ensure(ack, "func");
                let r = util.ensure(results[0], "obj");
                r.success = ("success" in r) ? (!!r.success) : true;
                r.ts = util.getTime();
                ack(r);
            });
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
            this.remTag(tags);
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

        get location() { return this.#location; }

        get connected() { return this.#socket.connected; }
        get disconnected() { return !this.connected; }
        get socketId() { return this.#socket.id; }

        connect() { this.#socket.connect(); }
        disconnect() { this.#socket.disconnect(); }

        #parseResponse(res, rej, response) {
            response = util.ensure(response, "obj");
            const serverTs = util.ensure(response.ts, "num");
            const clientTs = util.getTime();
            if (!response.success) return rej(response.reason);
            return res(response.payload);
        }
        async emit(name, payload) {
            name = String(name);
            return await new Promise((res, rej) => {
                this.#socket.emit(
                    "msg",
                    {
                        name: name,
                        ts: util.getTime(),
                        payload: payload,
                    },
                    response => this.#parseResponse(res, rej, response),
                );
            });
        }
        async stream(pth, name, payload) {
            pth = WindowManager.makePath(pth);
            if (!WindowManager.fileHas(pth)) return null;
            const stream = fs.createReadStream(pth);
            name = String(name);
            const fname = path.basename(pth);
            const ssStream = ss.createStream();
            return await new Promise((res, rej) => {
                ss(this.#socket).emit(
                    "stream",
                    ssStream,
                    {
                        name: name,
                        fname: fname,
                        payload: payload,
                    },
                    response => this.#parseResponse(res, rej, response),
                );
                stream.pipe(ssStream);
            });
        }
    }
    class ClientManager extends util.Target {
        #clients;

        constructor() {
            super();

            this.#clients = new Set();
        }

        get clients() { return [...this.#clients]; }
        set clients(v) {
            v = util.ensure(v, "arr");
            this.clearClients();
            this.addClient(v);
        }
        clearClients() {
            let clients = this.clients;
            this.remClient(clients);
            return clients;
        }
        hasClient(client) {
            if (!(client instanceof Client)) return false;
            return this.#clients.has(client);
        }
        addClient(...clients) {
            return util.Target.resultingForEach(clients, client => {
                if (!(client instanceof Client)) return false;
                if (this.hasClient(client)) return false;
                this.#clients.add(client);
                client.onAdd();
                return client;
            });
        }
        remClient(...clients) {
            return util.Target.resultingForEach(clients, client => {
                if (!(client instanceof Client)) return false;
                if (!this.hasClient(client)) return false;
                client.onRem();
                this.#clients.delete(client);
                return client;
            });
        }

        getClientById(id) {
            for (let client of this.clients)
                if (client.id == id)
                    return client;
            return null;
        }
        getClientsByTag(tag) {
            tag = String(tag);
            return this.clients.filter(client => client.hasTag(tag));
        }
    }
    class TBAClient extends util.Target {
        #id;
        #tags;

        #client;
        #tbaAPI;
        #listAPI;
        #teamAPI;
        #eventAPI;
        #matchAPI;
        #districtAPI;

        constructor() {
            super();

            this.#id = null;
            this.#tags = new Set();

            this.#client = tba.ApiClient.instance;
            this.#tbaAPI = new tba.TBAApi();
            this.#listAPI = new tba.ListApi();
            this.#teamAPI = new tba.TeamApi();
            this.#eventAPI = new tba.EventApi();
            this.#matchAPI = new tba.MatchApi();
            this.#districtAPI = new tba.DistrictApi();
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
            this.remTag(tags);
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

        get client() { return this.#client; }
        get tbaAPI() { return this.#tbaAPI; }
        get listAPI() { return this.#listAPI; }
        get teamAPI() { return this.#teamAPI; }
        get eventAPI() { return this.#eventAPI; }
        get matchAPI() { return this.#matchAPI; }
        get districtAPI() { return this.#districtAPI; }

        async invoke(invoke, ...a) {
            let ref = String(invoke).split(".");
            if (ref.length != 2) throw new Error(`Invalid invocation (split length) (${invoke})`);
            let [api, f] = ref;
            if (!api.endsWith("API")) throw new Error(`Invalid invocation (api name) (${invoke})`);
            if (!(api in this)) throw new Error(`Invalid invocation (api existence) (${invoke})`);
            api = this[api];
            if (!(f in api)) throw new Error(`Invalid invocation (method existence) (${invoke})`);
            let l = 1;
            let apifs = {
                tbaAPI: {
                    getStatus: 0,
                },
                listAPI: {
                    getTeamEventsStatusesByYear: 2,
                    getTeamsByYear: 2,
                    getTeamsByYearKeys: 2,
                    getTeamsByYearSimple: 2,
                },
                teamAPI: {
                    getTeamAwardsByYear: 2,
                    getTeamEventAwards: 2,
                    getTeamEventMatches: 2,
                    getTeamEventMatchesKeys: 2,
                    getTeamEventMatchesSimple: 2,
                    getTeamEventStatus: 2,
                    getTeamEventsByYear: 2,
                    getTeamEventsByYearKeys: 2,
                    getTeamEventsByYearSimple: 2,
                    getTeamEventsStatusesByYear: 2,
                    getTeamMatchesByYear: 2,
                    getTeamMatchesByYearKeys: 2,
                    getTeamMatchesByYearSimple: 2,
                    getTeamMediaByTag: 2,
                    getTeamMediaByTagYear: 3,
                    getTeamMediaByYear: 2,
                    getTeamsByYear: 2,
                    getTeamsByYearKeys: 2,
                    getTeamsByYearSimple: 2,
                },
                eventAPI: {
                    getTeamEventAwards: 2,
                    getTeamEventMatches: 2,
                    getTeamEventMatchesKeys: 2,
                    getTeamEventMatchesSimple: 2,
                    getTeamEventStatus: 2,
                    getTeamEventsByYear: 2,
                    getTeamEventsByYearKeys: 2,
                    getTeamEventsByYearSimple: 2,
                    getTeamEventsStatusesByYear: 2,
                },
                matchAPI: {
                    getTeamEventMatches: 2,
                    getTeamEventMatchesKeys: 2,
                    getTeamEventMatchesSimple: 2,
                    getTeamMatchesByYear: 2,
                    getTeamMatchesByYearKeys: 2,
                    getTeamMatchesByYearSimple: 2,
                },
            };
            if ((api in apifs) && (f in apifs[api])) l = apifs[api][f];
            while (a.length > l+1) a.pop();
            while (a.length < l) a.push(null);
            if (a.length == l) a.push({});
            a[l] = util.ensure(a[l], "obj");
            return await new Promise((res, rej) => {
                api[f](...a, (e, data, resp) => {
                    if (e) return rej(e);
                    res(data);
                });
            });
        }
    }
    class TBAClientManager extends util.Target {
        #clients;

        constructor() {
            super();

            this.#clients = new Set();
        }

        get clients() { return [...this.#clients]; }
        set clients(v) {
            v = util.ensure(v, "arr");
            this.clearClients();
            this.addClient(v);
        }
        clearClients() {
            let clients = this.clients;
            this.remClient(clients);
            return clients;
        }
        hasClient(client) {
            if (!(client instanceof TBAClient)) return false;
            return this.#clients.has(client);
        }
        addClient(...clients) {
            return util.Target.resultingForEach(clients, client => {
                if (!(client instanceof TBAClient)) return false;
                if (this.hasClient(client)) return false;
                this.#clients.add(client);
                client.onAdd();
                return client;
            });
        }
        remClient(...clients) {
            return util.Target.resultingForEach(clients, client => {
                if (!(client instanceof TBAClient)) return false;
                if (!this.hasClient(client)) return false;
                client.onRem();
                this.#clients.delete(client);
                return client;
            });
        }

        getClientById(id) {
            for (let client of this.clients)
                if (client.id == id)
                    return client;
            return null;
        }
        getClientsByTag(tag) {
            tag = String(tag);
            return this.clients.filter(client => client.hasTag(tag));
        }
    }
    const makeMenuDefault = (name, signal) => {
        if (!(signal instanceof util.Target)) signal = new util.Target();
        name = String(name);
        return [
            {
                label: (name.length > 0) ? lib.getName(name) : "Portal",
                submenu: [
                    {
                        label:
                            (name.length > 0) ?
                                ("About Peninsula "+lib.getName(name)) :
                            "About Peninsula",
                        enabled: !!("about" in signal ? signal.about : true),
                        click: () => signal.post("about"),
                    },
                    { type: "separator" },
                    {
                        label: "Settings",
                        accelerator: "CmdOrCtrl+,",
                        enabled: !!("about" in signal ? signal.about : true),
                        click: () => signal.post("settings"),
                    },
                    { type: "separator" },
                    { role: "hide" },
                    { role: "hideOthers" },
                    { role: "unhide" },
                    { type: "separator" },
                    { role: "quit" },
                ],
            },
        ];
    };
    class Window extends util.Target {
        #manager;

        #id;

        #started;
        #resolver;

        #processManager;
        #clientManager;
        #tbaClientManager;

        #windowManager;

        #name;

        #window;
        #menu;
        #perm;

        #state;

        constructor(manager, name) {
            super();

            if (!(manager instanceof WindowManager)) throw new Error("Manager is not of class WindowManager");
            this.#manager = manager;

            this.#id = util.jargonBase64(10);

            this.#started = false;
            this.#resolver = new util.Resolver(0);

            this.#processManager = new ProcessManager();
            this.#clientManager = new ClientManager();
            this.#tbaClientManager = new TBAClientManager();

            this.#windowManager = new WindowManager(this);

            name = String(name);
            if (!(lib.FEATURES.includes(name) || (name.startsWith("modal:") && lib.MODALS.includes(name.slice(6)))))
                throw new Error(`Name '${name}' is not valid`);
            this.#name = name;

            this.#window = null;
            this.#menu = null;
            this.#perm = false;

            this.#started = false;

            this.#resolver = new util.Resolver(0);

            this.#state = {};

            this.log();

            this.addHandler("update", delta => this.windowManager.update(delta));
        }

        get manager() { return this.#manager; }
        get rootManager() { return this.manager.rootManager; }

        get id() { return this.#id; }

        get started() { return this.#started; }

        get ready() { return this.#resolver.state == 3; }
        async whenReady() { await this.#resolver.when(3); }
        async whenPartiallyReady() { await this.#resolver.when(2); }
        async whenNotReady() { await this.#resolver.whenNot(3); }

        get processManager() { return this.#processManager; }
        get clientManager() { return this.#clientManager; }
        get tbaClientManager() { return this.#tbaClientManager; }

        get windowManager() { return this.#windowManager; }

        get name() { return this.#name; }
        get isModal() { return this.name.startsWith("modal:"); }

        get window() { return this.#window; }
        hasWindow() { return !!this.window && !this.window.isDestroyed() && !this.window.webContents.isDestroyed(); }
        get menu() { return this.#menu; }
        hasMenu() { return !!this.menu; }
        get perm() { return this.#perm; }
        set perm(v) { this.#perm = !!v; }

        async getPerm() {
            if (!this.started) return true;
            this.log("GET PERM");
            let perm = await new Promise((res, rej) => {
                if (!this.hasWindow()) return;
                this.window.webContents.send("perm");
                let id = setTimeout(() => {
                    clear();
                    res(true);
                }, 10000);
                const clear = () => {
                    clearTimeout(id);
                    ipc.removeListener("permack", permack);
                    ipc.removeListener("perm", perm);
                };
                const permack = e => {
                    if (!this.hasWindow()) return;
                    if (e.sender.id != this.window.webContents.id) return;
                    clear();
                };
                const perm = (e, given) => {
                    if (!this.hasWindow()) return;
                    if (e.sender.id != this.window.webContents.id) return;
                    clear();
                    res(!!given);
                };
                ipc.on("permack", permack);
                ipc.on("perm", perm);
            });
            let namefs = {
            };
            if (this.name in namefs) perm &&= namefs[this.name]();
            return perm;
        }

        get state() { return this.#state; }

        start(params=null) {
            if (this.started) return false;
            this.log("START");
            this.#started = true;
            this.#resolver.state = 0;

            let namefs;

            let options = {
                width: 1250,
                height: 750,

                show: false,
                resizable: true,

                titleBarStyle: "hidden",
                titleBarOverlay: {
                    height: 40,
                },
                trafficLightPosition: {
                    x: (40-16)/2,
                    y: (40-16)/2,
                },

                webPreferences: {
                    preload: path.join(__dirname, "preload.js"),
                    webviewTag: true,
                },
            };
            let isModal = this.manager.hasWindow() && this.manager.window.hasWindow();
            if (isModal) {
                options.modal = true;
                options.parent = this.manager.window.window;
                options.width = Math.ceil(this.manager.window.window.getBounds().width*0.5);
                options.height = Math.ceil(this.manager.window.window.getBounds().height*0.5);
            }
            if (isModal || this.isModal) {
                options.frame = false;
                delete options.titleBarStyle;
                delete options.trafficLightPosition;
            }
            if (this.isModal) {
                options.alwaysOnTop = true;
                options.hiddenInMissionControl = true;
            }
            const onHolidayState = async holiday => {
                let tag = "png";
                let defaultIcon = path.join(__dirname, "assets", "app", "icon."+tag);
                let icon = 
                    (holiday == null) ? defaultIcon :
                    util.ensure(util.ensure(await this.get("holiday-icons"), "obj")[holiday], "obj")[tag];
                if (!this.hasWindow()) return;
                if (OS.platform == "win32") this.window.setIcon(defaultIcon);
                if (OS.platform == "darwin") app.dock.setIcon(defaultIcon);
                if (OS.platform == "linux") this.window.setIcon(defaultIcon);
                try {
                    if (OS.platform == "win32") this.window.setIcon(icon);
                    if (OS.platform == "darwin") app.dock.setIcon(icon);
                    if (OS.platform == "linux") this.window.setIcon(icon);
                } catch (e) {}
            };
            (async () => await onHolidayState(await this.get("active-holiday")))();
            this.#window = new electron.BrowserWindow(options);
            this.window.once("ready-to-show", async () => {
                if (!this.hasWindow()) return;
                this.#resolver.state++;
                return;
                await util.wait(100);
                this.window.show();
                this.window.webContents.openDevTools();
            });
            const readiness = 2000;
            let id = setTimeout(async () => {
                clear();
                if (this.isModal) return;
                let r = await showTerminationConfirm(
                    "Window Start Error", "Startup",
                    `The application (${this.name}) did not acknowledge readiness within ${readiness/1000} second${readiness==1000?"":"s"}`,
                );
                if (r || !this.hasWindow()) return this.stop();
                // ew
                ready({ sender: { id: this.window.webContents.id } });
                this.window.webContents.openDevTools();
            }, readiness);
            const clear = () => {
                clearInterval(id);
                ipc.removeListener("ready", ready);
            };
            const ready = e => {
                if (!this.hasWindow()) return;
                if (e.sender.id != this.window.webContents.id) return;
                clear();
                this.#resolver.state++;
            };
            ipc.on("ready", ready);

            this.window.on("unresponsive", () => {});
            this.window.webContents.on("will-navigate", e => {
                e.preventDefault();
                if (!this.hasWindow()) return;
                if (e.url != this.window.webContents.getURL())
                    this.on("open", e.url);
            });
            let any = false;
            for (let win of this.manager.windows) {
                if (!win.hasWindow()) continue;
                if (!win.window.webContents.isDevToolsOpened()) continue;
                any = true;
                break;
            }
            if (this.hasWindow() && any) this.window.webContents.openDevTools();
            this.window.webContents.on("devtools-opened", () => {
                this.manager.windows.filter(win => win.hasWindow()).forEach(win => win.window.webContents.openDevTools());
            });
            this.window.webContents.on("devtools-closed", () => {
                this.manager.windows.filter(win => win.hasWindow()).forEach(win => win.window.webContents.closeDevTools());
            });

            this.window.on("enter-full-screen", () => this.send("fullscreen", true));
            this.window.on("leave-full-screen", () => this.send("fullscreen", false));

            this.window.on("focus", () => this.manager.checkMenu());
            this.window.on("blur", () => this.manager.checkMenu());

            this.perm = false;
            this.window.on("close", e => {
                this.log("CLOSE");
                if (this.perm) return this.log("CLOSE - yes perm");
                this.log("CLOSE - no perm");
                e.preventDefault();
                this.stop();
            });

            if (this.isModal)
                this.window.loadURL("file://"+path.join(__dirname, "modal", "index.html")+"?name="+this.name.slice(6).toLowerCase());
            else this.window.loadFile(path.join(__dirname, this.name.toLowerCase(), "index.html"));

            namefs = {
                PORTAL: () => {
                    let resolver = new util.Resolver(false);
                    const checkForShow = async () => {
                        if (!this.hasWindow()) return;
                        await this.whenReady();
                        await resolver.whenFalse();
                        resolver.state = true;
                        let nWins = 0;
                        for (let win of this.manager.windows) {
                            if (win.isModal) continue;
                            if (win.name == "PORTAL") continue;
                            nWins++;
                        }
                        if (nWins > 0) this.window.hide();
                        else this.window.show();
                        resolver.state = false;
                    };
                    checkForShow();
                    this.manager.addHandler("change-addWindow", () => checkForShow());
                    this.manager.addHandler("change-remWindow", () => checkForShow());
                },
                PANEL: async () => {
                    const client = this.clientManager.addClient(new Client(new URL("./api/panel", await this.get("socket-host"))));
                    client.id = "logger";
                    client.addHandler("stream-logs", async (fname, payload, meta, ssStream) => {
                        await this.affirm();
                        await this.dirAffirm("logs");
                        const pth = WindowManager.makePath(this.dataPath, "logs", fname);
                        const stream = fs.createWriteStream(pth);
                        try {
                            await new Promise((res, rej) => {
                                stream.on("open", () => {
                                    ssStream.pipe(stream);
                                    ssStream.on("end", () => res());
                                    ssStream.on("error", e => rej(e));
                                });
                            });
                        } catch (e) { return { success: false, reason: util.stringifyError(e) }; }
                        return { success: true };
                    });
                },
                PLANNER: () => {
                }
            };

            if (namefs[this.name]) namefs[this.name]();

            let finished = false, messageQueue = [["init", params]];
            const checkMessages = () => {
                if (!finished) return;
                if (!this.hasWindow()) return;
                while (messageQueue.length > 0)
                    this.window.webContents.send("message", ...messageQueue.shift());
            };
            const addMessage = (name, ...a) => {
                name = String(name);
                messageQueue.push([name, ...a]);
                checkMessages();
            };
            this.addHandler("message", addMessage);
            
            (async () => {
                await this.whenPartiallyReady();
                if (!this.hasWindow()) return;
                await this.check();
                if (!this.hasWindow()) return;
                let size = this.window.getSize();
                const finishAndShow = () => {
                    if (!this.hasWindow()) return;
                    this.#resolver.state++;
                    this.window.show();
                    this.window.setSize(...size);
                    finished = true;
                    checkMessages();
                };
                if (!this.canOperate) return finishAndShow();
                let bounds = util.ensure(await this.get("state", "bounds"), "obj");
                if (("width" in bounds) && (bounds.width < 50)) return finishAndShow();
                if (("height" in bounds) && (bounds.height < 50)) return finishAndShow();
                this.window.setBounds(bounds);
                size = this.window.getSize();
                finishAndShow();
            })();

            return this;
        }
        async stop() {
            if (!this.started) return false;
            this.log("STOP");
            if (!this.perm) {
                this.log("STOP - no perm > get perm");
                this.perm = await this.getPerm();
            }
            this.log(`STOP - perm: ${this.perm}`);
            if (!this.perm) return false;
            this.log("STOP children");
            let perm = true;
            for (let window of this.windowManager.windows)
                perm &&= !!(await window.stop());
            this.log(`STOP children - perm: ${perm}`);
            if (!perm) return this.perm = false;
            if (this.canOperate && this.hasWindow()) await this.set("state", "bounds", this.window.getBounds());
            this.#started = false;
            await Promise.all(this.processManager.processes.map(async process => await process.terminate()));
            await Promise.all(this.clientManager.clients.map(async client => {
                await client.disconnect();
                this.clientManager.remClient(client);
            }));
            await Promise.all(this.tbaClientManager.clients.map(async client => await this.tbaClientDestroy(client)));
            if (this.hasWindow()) this.window.close();
            this.#window = null;
            this.#menu = null;
            await this.manager.remWindow(this);
            return this;
        }
        async check() {
            this.send("check");
            await this.windowManager.check();
        }
        
        static getDataPath(manager, name, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            return path.join(manager.dataPath, name.toLowerCase());
        }
        get dataPath() { return Window.getDataPath(this.manager, this.name, this.started); }

        static getCanOperate(manager, name, started=true) {
            return (manager instanceof WindowManager) && lib.FEATURES.includes(name) && started;
        }
        get canOperate() { return Window.getCanOperate(this.manager, this.name, this.started); }

        static async affirm(manager, name, started=true) {
            if (!this.getCanOperate(manager, name, started)) return false;
            await manager.affirm();
            await WindowManager.dirAffirm(this.getDataPath(manager, name, started));
            await WindowManager.fileAffirm([this.getDataPath(manager, name, started), "config.json"]);
            await WindowManager.fileAffirm([this.getDataPath(manager, name, started), "state.json"]); 
            return true;
        }
        async affirm() { return await Window.affirm(this.manager, this.name, this.started); }

        static async fileHas(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.fileHas(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }
        static async fileRead(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.fileRead(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }
        static async fileReadRaw(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.fileReadRaw(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }
        static async fileWrite(manager, name, pth, content, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.fileWrite(WindowManager.makePath(this.getDataPath(manager, name, started), pth), content);
        }
        static async fileWriteRaw(manager, name, pth, content, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.fileWriteRaw(WindowManager.makePath(this.getDataPath(manager, name, started), pth), content);
        }
        static async fileAppend(manager, name, pth, content, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.fileAppend(WindowManager.makePath(this.getDataPath(manager, name, started), pth), content);
        }
        static async fileDelete(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.fileDelete(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }
        static async fileAffirm(manager, name, pth, content="", started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.fileAffirm(WindowManager.makePath(this.getDataPath(manager, name, started), pth), content);
        }
        static async fileDeny(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.fileDeny(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }

        static async dirHas(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.dirHas(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }
        static async dirList(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.dirList(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }
        static async dirMake(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.dirMake(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }
        static async dirDelete(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.dirDelete(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }
        static async dirAffirm(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.dirAffirm(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }
        static async dirDeny(manager, name, pth, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            await this.affirm(manager, name, started);
            return await WindowManager.dirDeny(WindowManager.makePath(this.getDataPath(manager, name, started), pth));
        }

        async fileHas(pth) { return Window.fileHas(this.manager, this.name, pth, this.started); }
        async fileRead(pth) { return Window.fileRead(this.manager, this.name, pth, this.started); }
        async fileReadRaw(pth) { return Window.fileReadRaw(this.manager, this.name, pth, this.started); }
        async fileWrite(pth, content) { return Window.fileWrite(this.manager, this.name, pth, content, this.started); }
        async fileWriteRaw(pth, content) { return Window.fileWriteRaw(this.manager, this.name, pth, content, this.started); }
        async fileAppend(pth, content) { return Window.fileAppend(this.manager, this.name, pth, content, this.started); }
        async fileDelete(pth) { return Window.fileDelete(this.manager, this.name, pth, this.started); }
        async fileAffirm(pth, content="") { return Window.fileAffirm(this.manager, this.name, pth, content, this.started); }
        async fileDeny(pth) { return Window.fileDeny(this.manager, this.name, pth, this.started); }

        async dirHas(pth) { return Window.dirHas(this.manager, this.name, pth, this.started); }
        async dirList(pth) { return Window.dirList(this.manager, this.name, pth, this.started); }
        async dirMake(pth) { return Window.dirMake(this.manager, this.name, pth, this.started); }
        async dirDelete(pth) { return Window.dirDelete(this.manager, this.name, pth, this.started); }
        async dirAffirm(pth) { return Window.dirAffirm(this.manager, this.name, pth, this.started); }
        async dirDeny(pth) { return Window.dirDeny(this.manager, this.name, pth, this.started); }

        receiveMessage(name, ...a) {
            name = String(name);
            this.post("message", name, ...a);
            return true;
        }
        sendMessage(id, name, ...a) {
            this.post("sent-message", id, name, ...a);
            return this.manager.sendMessage(id, name, ...a);
        }
        async whenModalResult() {
            return new Promise((res, rej) => {
                const r = v => {
                    this.remHandler("sent-message", f);
                    res(v);
                };
                const f = (id, name, data) => {
                    if (id != null) return;
                    if (name != "modify") return;
                    data = util.ensure(data, "obj");
                    const cmds = util.ensure(data.cmds, "arr");
                    for (const cmd of cmds) {
                        if (cmd == "button") return r(null);
                        if (cmd == "confirm") return r(true);
                        if (cmd == "cancel") return r(false);
                    }
                };
                this.addHandler("sent-message", f);
            });
        }

        modalSpawn(name, params) {
            let win = this.windowManager.modalSpawn(name, params);
            if (!win) return null;
            return win.id;
        }
        modalAlert(params) { return this.modalSpawn("ALERT", params); }
        modalConfirm(params) { return this.modalSpawn("CONFIRM", params); }
        modalPrompt(params) { return this.modalSpawn("PROMPT", params); }
        modalProgress(params) { return this.modalSpawn("PROGRESS", params); }

        async tbaClientMake(id) {
            let client = await this.manager.tbaClientMake(this.name+":"+id, location);
            client = this.tbaClientManager.addClient(client);
            client.addTag(this);
            return client;
        }
        async tbaClientDestroy(id) {
            return await this.manager.tbaClientDestroy((id instanceof TBAClient) ? id : (this.name+":"+id));
        }
        async tbaClientHas(id) {
            if (!(await this.manager.tbaClientHas((id instanceof TBAClient) ? id : (this.name+":"+id)))) return false;
            return (id instanceof TBAClient) ? this.tbaClientManager.clients.includes(id) : (this.tbaClientManager.getClientById(this.name+":"+id) instanceof TBAClient);
        }
        async tbaClientGet(id) {
            if (!(await this.tbaClientHas(id))) return null;
            return (id instanceof TBAClient) ? id : this.manager.tbaClientGet(this.name+":"+id);
        }
        async tbaClientInvoke(id, invoke, ...a) {
            return await this.manager.tbaClientInvoke((id instanceof TBAClient) ? id : (this.name+":"+id), invoke, ...a);
        }

        async ytdlDownload(url, options) {
            return await this.manager.ytdlDownload(url, options);
        }

        async get(k, ...a) {
            try {
                return await this.getThis(k, ...a);
            } catch (e) { if (!(e instanceof MissingError)) throw e; }
            return await this.manager.get(k, ...a);
        }
        async set(k, ...a) {
            try {
                return await this.setThis(k, ...a);
            } catch (e) { if (!(e instanceof MissingError)) throw e; }
            return await this.manager.set(k, ...a);
        }
        async del(k, ...a) {
            try {
                return await this.delThis(k, ...a);
            } catch (e) { if (!(e instanceof MissingError)) throw e; }
            return await this.manager.del(k, ...a);
        }
        async on(k, ...a) {
            try {
                return await this.onThis(k, ...a);
            } catch (e) { if (!(e instanceof MissingError)) throw e; }
            return await this.manager.on(k, ...a);
        }

        async getThis(k, ...a) {
            if (!this.started) return null;
            k = String(k);
            let kfs = {
                "id": async () => this.id,

                "name": async () => {
                    return this.name;
                },

                "fullscreen": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isFullScreen();
                },
                "fullscreenable": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isFullScreenable();
                },

                "closeable": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isClosable();
                },

                "focused": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isFocused();
                },
                "blurred": async () => {
                    if (!this.hasWindow()) return null;
                    return !(await this.getThis("focused"));
                },
                "focusable": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isFocusable();
                },

                "visible": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isVisible();
                },
                "hidden": async () => {
                    if (!this.hasWindow()) return null;
                    return !(await this.getThis("visible"));
                },

                "modal": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isModal;
                },

                "maximized": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isMaximized();
                },
                "maximizable": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isMaximizable();
                },

                "minimized": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isMinimized();
                },
                "minimizable": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isMinimizable();
                },

                "enabled": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isEnabled();
                },
                "disabled": async () => {
                    if (!this.hasWindow()) return null;
                    return !(await this.getThis("enabled"));
                },

                "resizable": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isResizable();
                },

                "movable": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isMovable();
                },

                "opacity": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getOpacity();
                },

                "size": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getSize();
                },
                "width": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getSize()[0];
                },
                "height": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getSize()[1];
                },
                "min-size": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getMinimumSize();
                },
                "min-width": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getMinimumSize()[0];
                },
                "min-height": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getMinimumSize()[1];
                },
                "max-size": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getMaximumSize();
                },
                "max-width": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getMaximumSize()[0];
                },
                "max-height": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getMaximumSize()[1];
                },
                "bounds": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.getBounds();
                },

                "_writable": async (pth, k="") => {
                    k = String(k).split(".").filter(part => part.length > 0);
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(pth);
                    } catch (e) {}
                    let o = null;
                    try {
                        o = JSON.parse(content);
                    } catch (e) {}
                    o = util.ensure(o, "obj");
                    let stack = o;
                    while (k.length > 0) {
                        let name = k.shift();
                        if (!util.is(stack, "obj")) return null;
                        if (!(name in stack)) return null;
                        stack = stack[name];
                    }
                    return stack;
                },
                "config": async (k="") => await kfs._writable("config.json", k),
                "root": async () => ((await kfs["config"]("root")) || this.dataPath),
                "state": async (k="") => await kfs._writable("state.json", k),

                "projects": async () => {
                    await this.onThis("projects-affirm");
                    const root = await this.getThis("root");
                    return util.ensure(await WindowManager.dirList([root, "projects"]), "arr")
                        .filter(dirent => (dirent.type == "file" && dirent.name.endsWith(".json")))
                        .map(dirent => dirent.name)
                        .map(name => name.slice(0, -5));
                },
                "project": async id => {
                    await this.onThis("projects-affirm");
                    id = lib.keyify(lib.sanitize(id));
                    const root = await this.getThis("root");
                    let content = null;
                    try {
                        content = await WindowManager.fileRead([root, "projects", id+".json"]);
                    } catch (e) {}
                    return content;
                },
                "projects-meta": async () => {
                    await this.onThis("projects-affirm");
                    const root = await this.getThis("root");
                    let content = null;
                    try {
                        content = await WindowManager.fileRead([root, "projects.json"]);
                    } catch (e) {}
                    return content;
                },
            };
            if (k in kfs) return await kfs[k](...a);
            let namefs = {
                PANEL: {
                    "client-location": async () => {
                        const client = this.clientManager.getClientById("logger");
                        if (!client) return null;
                        return client.location;
                    },
                    "client-connected": async () => {
                        const client = this.clientManager.getClientById("logger");
                        if (!client) return null;
                        return client.connected;
                    },
                    "logs-client": async () => {
                        await this.dirAffirm("logs");
                        let dirents = await this.dirList("logs");
                        return dirents
                            .filter(dirent => (dirent.type == "file" && dirent.name.endsWith(".wpilog")))
                            .map(dirent => {
                                return {
                                    name: dirent.name,
                                    pth: path.join(this.dataPath, "logs", dirent.name),
                                };
                            });
                    },
                    "logs-server": async () => {
                        const client = this.clientManager.getClientById("logger");
                        if (!client) return [];
                        if (client.disconnected) {
                            client.connect();
                            return [];
                        }
                        return util.ensure(await client.emit("logs-get", null), "arr").map(name => String(name));
                    },
                },
            };
            if (this.name in namefs)
                if (k in namefs[this.name])
                    return await namefs[this.name][k](...a);
            throw new MissingError("Could not get for key: "+k);
        }
        async setThis(k, ...a) {
            if (!this.started) return false;
            k = String(k);
            let kfs = {
                "menu": async v => {
                    this.#menu = null;
                    try {
                        let signal = new util.Target();
                        signal.addHandler("about", () => this.send("about"));
                        signal.addHandler("settings", () => this.on("spawn", "PRESETS"));
                        this.#menu = electron.Menu.buildFromTemplate(util.ensure(v, "arr"));
                        const dfs = menu => {
                            if (!menu) return;
                            menu.items.forEach(itm => {
                                let click = itm.click;
                                // monkey patching
                                itm.click = (...a) => {
                                    click.apply(itm, a);
                                    if (!itm.id) return;
                                    this.send("menu-click", itm.id);
                                };
                                dfs(itm.submenu);
                            });
                        };
                        dfs(this.#menu);
                    } catch (e) {}
                    this.manager.checkMenu();
                },

                "fullscreen": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setFullScreen(!!v);
                    return true;
                },
                "fullscreenable": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setFullScreenable(!!v);
                    return true;
                },

                "closeable": async v => {
                    if (!this.hasWindow()) return false;
                    let maximizable = this.window.isMaximizable();
                    this.window.setClosable(!!v);
                    this.window.setMaximizable(maximizable);
                    return true;
                },

                "focused": async v => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.focus();
                    else this.window.blur();
                    return true
                },
                "blurred": async v => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.blur();
                    else this.window.focus();
                    return true;
                },
                "focusable": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setFocusable(!!v);
                    return true;
                },

                "visible": async v => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.show();
                    else this.window.hide();
                    return true;
                },
                "hidden": async v => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.hide();
                    else this.window.show();
                    return true;
                },

                "maximized": async v => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.maximize();
                    else this.window.unmaximize();
                    return true;
                },
                "maximizable": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setMaximizable(!!v);
                    return true;
                },

                "minimized": async v => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.minimize();
                    else this.window.restore();
                    return true;
                },
                "minimizable": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setMinimizable(!!v);
                    return true;
                },

                "enabled": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setEnabled(!!v);
                    return true;
                },
                "disabled": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setEnabled(!v);
                    return true;
                },

                "resizable": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setResizable(!!v);
                    return true;
                },

                "movable": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setMovable(!!v);
                    return true;
                },

                "opacity": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setOpacity(Math.min(1, Math.max(0, util.ensure(v, "num"))));
                    return true;
                },

                "size": async (v, type=null) => {
                    if (!this.hasWindow()) return false;
                    type = util.ensure(type, "str");
                    v = new V(v).ceil();
                    let bounds = this.window.getBounds();
                    this.window.setBounds({
                        x:
                            type.includes("l") ? bounds.x :
                            type.includes("r") ? bounds.x+bounds.width-v.x :
                            Math.floor(bounds.x+bounds.width/2-v.x/2),
                        y:
                            type.includes("t") ? bounds.y :
                            type.includes("b") ? bounds.y+bounds.height-v.y :
                            Math.floor(bounds.y+bounds.height/2-v.y/2),
                        width: v.x,
                        height: v.y,
                    });
                    return true;
                },
                "width": async (v, type=null) => {
                    if (!this.hasWindow()) return false;
                    type = util.ensure(type, "str");
                    v = Math.ceil(util.ensure(v, "num"));
                    let bounds = this.window.getBounds();
                    this.window.setBounds({
                        x:
                            type.includes("l") ? bounds.x :
                            type.includes("r") ? bounds.x+bounds.width-v :
                            Math.floor(bounds.x+bounds.width/2-v/2),
                        y: bounds.y,
                        width: v,
                        height: bounds.height,
                    });
                    return true;
                },
                "height": async (v, type=null) => {
                    if (!this.hasWindow()) return false;
                    type = util.ensure(type, "str");
                    v = Math.ceil(util.ensure(v, "num"));
                    let bounds = this.window.getBounds();
                    this.window.setBounds({
                        x: bounds.x,
                        y:
                            type.includes("t") ? bounds.y :
                            type.includes("b") ? bounds.y+bounds.height-v :
                            Math.floor(bounds.y+bounds.height/2-v/2),
                        width: bounds.width,
                        height: v,
                    });
                    return true;
                },
                "min-size": async v => {
                    if (!this.hasWindow()) return false;
                    v = new V(v).ceil();
                    this.window.setMinimumSize(...v.xy);
                    if (this.window.getBounds().width < v.x) await this.setThis("width", v.x, "tl");
                    if (this.window.getBounds().height < v.y) await this.setThis("height", v.y, "tl");
                    return true;
                },
                "min-width": async v => {
                    if (!this.hasWindow()) return false;
                    v = Math.ceil(util.ensure(v, "num"));
                    this.window.setMinimumSize(v, this.window.getMinimumSize()[1]);
                    if (this.window.getBounds().width < v) await this.setThis("width", v, "tl");
                    return true;
                },
                "min-height": async v => {
                    if (!this.hasWindow()) return false;
                    v = Math.ceil(util.ensure(v, "num"));
                    this.window.setMinimumSize(this.window.getMinimumSize()[0], v);
                    if (this.window.getBounds().height < v) await this.setThis("height", v, "tl");
                    return true;
                },
                "max-size": async v => {
                    if (!this.hasWindow()) return false;
                    v = new V(v).ceil();
                    this.window.setMaximumSize(...v.xy);
                    if (this.window.getBounds().width > v.x) await this.setThis("width", v.x, "tl");
                    if (this.window.getBounds().height > v.y) await this.setThis("height", v.y, "tl");
                    return true;
                },
                "max-width": async v => {
                    if (!this.hasWindow()) return false;
                    v = Math.ceil(util.ensure(v, "num"));
                    this.window.setMaximumSize(v, this.window.getMaximumSize()[1]);
                    if (this.window.getBounds().width > v) await this.setThis("width", v, "tl");
                    return true;
                },
                "max-height": async v => {
                    if (!this.hasWindow()) return false;
                    v = Math.ceil(util.ensure(v, "num"));
                    this.window.setMaximumSize(this.window.getMaximumSize()[0], v);
                    if (this.window.getBounds().height > v) await this.setThis("height", v, "tl");
                    return true;
                },
                "bounds": async v => {
                    if (!this.hasWindow()) return false;
                    this.window.setBounds(v);
                    return true;
                },

                "title-bar-overlay": async v => {
                    if (!this.hasWindow()) return false;
                    if (this.window.setTitleBarOverlay)
                        this.window.setTitleBarOverlay(v);
                    return true;
                },

                "_writable": async (pth, k="", v=null) => {
                    k = String(k).split(".").filter(part => part.length > 0);
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(pth);
                    } catch (e) {}
                    let o = null;
                    try {
                        o = JSON.parse(content);
                    } catch (e) {}
                    o = util.ensure(o, "obj");
                    let stack = o;
                    while (k.length > 0) {
                        let name = k.shift();
                        if (!util.is(stack, "obj")) return null;
                        if (k.length > 0) {
                            if (!(name in stack)) return null;
                            stack = stack[name];
                        } else [stack[name], stack] = [v, stack[name]];
                    }
                    o = cleanupEmpties(o);
                    await this.fileWrite(pth, JSON.stringify(o, null, "\t"));
                    this.rootManager.check();
                    return stack;
                },
                "config": async (k="", v=null) => await kfs._writable("config.json", k, v),
                "root": async (v=null) => await kfs["config"]("root", v),
                "state": async (k="", v=null) => await kfs._writable("state.json", k, v),

                "project": async (id, content) => {
                    await this.onThis("projects-affirm");
                    id = lib.keyify(lib.sanitize(id));
                    const root = await this.getThis("root");
                    await WindowManager.fileWrite([root, "projects", id+".json"], content);
                },
                "projects-meta": async content => {
                    await this.onThis("projects-affirm");
                    const root = await this.getThis("root");
                    await WindowManager.fileWrite([root, "projects.json"], content);
                },
            };
            if (k in kfs) return await kfs[k](...a);
            let namefs = {
            };
            if (this.name in namefs)
                if (k in namefs[this.name])
                    return await namefs[this.name][k](...a);
            throw new MissingError("Could not set for key: "+k);
        }
        async delThis(k, ...a) {
            if (!this.started) return null;
            k = String(k);
            let kfs = {
                "_writable": async (pth, k="") => {
                    k = String(k).split(".").filter(part => part.length > 0);
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(pth);
                    } catch (e) {}
                    let o = null;
                    try {
                        o = JSON.parse(content);
                    } catch (e) {}
                    o = util.ensure(o, "obj");
                    let stack = o;
                    while (k.length > 0) {
                        let name = k.shift();
                        if (!util.is(stack, "obj")) return null;
                        if (k.length > 0) {
                            if (!(name in stack)) return null;
                            stack = stack[name];
                        } else {
                            let v = stack[name];
                            delete stack[name];
                            stack = v;
                        }
                    }
                    o = cleanupEmpties(o);
                    await this.fileWrite(pth, JSON.stringify(o, null, "\t"));
                    this.rootManager.check();
                    return stack;
                },
                "config": async (k="") => await kfs._writable("config.json", k),
                "root": async () => await kfs["config"]("root"),
                "state": async (k="") => await kfs._writable("state.json", k),

                "project": async id => {
                    await this.onThis("projects-affirm");
                    id = lib.keyify(lib.sanitize(id));
                    const root = await this.getThis("root");
                    try {
                        await WindowManager.fileDelete([root, "projects", id+".json"]);
                    } catch (e) { return false; }
                    return true;
                },
            };
            if (k in kfs) return await kfs[k](...a);
            let namefs = {
            };
            if (this.name in namefs)
                if (k in namefs[this.name])
                    return await namefs[this.name][k](...a);
            throw new MissingError("Could not del for key: "+k);
        }
        async onThis(k, ...a) {
            if (!this.started) return null;
            k = String(k);
            let kfs = {
                "reload": async () => {
                    const manager = this.manager, name = this.name;
                    manager.remWindow(this);
                    manager.addWindow(new this.constructor(manager, name));
                },
                "close": async () => {
                    await this.stop();
                },
                "capture": async rect => {
                    if (!this.hasWindow()) return;
                    const img = await (
                        rect ? this.window.webContents.capturePage(rect) :
                        this.window.webContents.capturePage()
                    );
                    return img.toDataURL();
                },
                "file-open-dialog": async options => {
                    return await electron.dialog.showOpenDialog(this.window, options);
                },
                "file-save-dialog": async options => {
                    return await electron.dialog.showSaveDialog(this.window, options);
                },
                "projects-affirm": async () => {
                    const root = await this.getThis("root");
                    await WindowManager.dirAffirm(root);
                    await WindowManager.fileAffirm([root, "projects.json"]);
                    await WindowManager.dirAffirm([root, "projects"]);
                },
                "project-export": async (pthDst, id) => {
                    pthDst += ".p"+this.name.toLowerCase();
                    const pthSrc = WindowManager.makePath(await this.getThis("root"), "projects", lib.keyify(lib.sanitize(id))+".json");
                    await zlibCompress(pthSrc, pthDst);
                    return pthDst;
                },
                "project-import": async pthSrc => {
                    const pthDst = WindowManager.makePath(await this.getThis("root"), "projects", ".json");
                    await zlibDecompress(pthSrc, pthDst);
                    let content = await this.getThis("project", "");
                    let data = JSON.parse(content);
                    if (
                        data &&
                        data["%a"] &&
                        data["%a"][0]
                    ) data["%a"][0].id = null;
                    await this.setThis("project", "", JSON.stringify(data));
                },
                "read": async (type, pth) => {
                    if (["wpilog", "ds", "dslog", "dsevents"].includes(type))
                        return await WindowManager.fileReadRaw(pth);
                    if (["csv", "csv-time", "csv-field"].includes(type))
                        return await WindowManager.fileRead(pth);
                    return null;
                },
                "write": async (type, pth, content, force=true) => {
                    pth = WindowManager.makePath(pth);
                    if (!force) {
                        let root = path.dirname(pth);
                        let ext = path.extname(pth);
                        let name = path.basename(pth, ext);
                        if (await WindowManager.fileHas([root, name+ext])) {
                            let n = 1;
                            while (await WindowManager.fileHas([root, name+" ("+n+")"+ext])) n++;
                            name += " ("+n+")";
                        }
                        pth = path.join(root, name+ext);
                    }
                    if (type == "wpilog") {
                        await WindowManager.fileWriteRaw(pth, content);
                        return pth;
                    }
                    if (type == "csv") {
                        await WindowManager.fileWrite(pth, content);
                        return pth;
                    }
                    return null;
                },
            };
            if (k in kfs) return await kfs[k](...a);
            let namefs = {
                PRESETS: {
                    "cmd-app-data": async () => {
                        await new Promise((res, rej) => {
                            const process = this.processManager.addProcess(new Process("spawn", "open", ["."], { cwd: this.manager.dataPath }));
                            process.addHandler("exit", res);
                            process.addHandler("error", rej);
                        });
                    },
                    "cmd-app-logs": async () => {
                        await new Promise((res, rej) => {
                            const process = this.processManager.addProcess(new Process("spawn", "open", ["."], { cwd: WindowManager.makePath(this.manager.dataPath, "logs") }));
                            process.addHandler("exit", res);
                            process.addHandler("error", rej);
                        });
                    },
                    "cmd-app-data-cleanup": async () => {
                        await this.on("cleanup");
                    },
                    "cmd-app-logs-clear": async () => {
                        let dirents = await this.manager.dirList("logs");
                        let n = 0, nTotal = dirents.length;
                        await Promise.all(dirents.map(async dirent => {
                            await this.manager.fileDelete(["logs", dirent.name]);
                            this.cacheSet("app-logs-clear-progress", (++n)/nTotal);
                        }));
                        this.cacheSet("app-logs-clear-progress", 1);
                    },
                    "cmd-poll-db-host": async () => {
                        this.on("try-load");
                    },
                    "feature": async (name, cmd, k, ...a) => {
                        let cmdfs = {
                            get: {
                                "root": async () => {
                                    let content = "";
                                    try {
                                        content = await Window.fileRead(this.manager, name, ["config.json"]);
                                    } catch (e) {}
                                    let data = null;
                                    try {
                                        data = JSON.parse(content);
                                    } catch (e) {}
                                    data = util.ensure(data, "obj");
                                    return util.ensure(data.root, "str", Window.getDataPath(this.manager, name));
                                },
                            },
                            set: {
                                "root": async v => {
                                    let content = "";
                                    try {
                                        content = await Window.fileRead(this.manager, name, ["config.json"]);
                                    } catch (e) {}
                                    let data = null;
                                    try {
                                        data = JSON.parse(content);
                                    } catch (e) {}
                                    data = util.ensure(data, "obj");
                                    data.root = util.ensure(v, "str", Window.getDataPath(this.manager, name));
                                    if (data.root == Window.getDataPath(this.manager, name)) delete data.root;
                                    content = JSON.stringify(data);
                                    await Window.fileWrite(this.manager, name, ["config.json"], content);
                                },
                            },
                        };
                        let namefs = {
                        };
                        if (cmd in cmdfs)
                            if (k in cmdfs[cmd])
                                return await cmdfs[cmd][k](...a);
                        if (name in namefs)
                            if (cmd in namefs[name])
                                if (k in namefs[name][cmd])
                                    return await namefs[name][cmd][k](...a);
                        return null;
                    },
                },
                PANEL: {
                    "log-cache": async pth => {
                        pth = String(pth);
                        if (!(await WindowManager.fileHas(pth))) return null;
                        await this.manager.affirm();
                        await this.dirAffirm("logs");
                        const name = path.basename(pth);
                        let pthDest = path.join(this.dataPath, "logs", name);
                        if (path.resolve(pth) == path.resolve(pthDest)) return name;
                        await fs.promises.cp(pth, pthDest, { force: true, recursive: true });
                        return name;
                    },
                    "log-upload": async name => {
                        name = String(name);
                        await this.manager.affirm();
                        let logs = await this.getThis("logs-client");
                        let found = null;
                        for (let log of logs) {
                            if (log.name != name) continue;
                            found = log;
                            break;
                        }
                        if (!found) return false;
                        const client = this.clientManager.getClientById("logger");
                        if (!client) return false;
                        if (client.disconnected) {
                            client.connect();
                            return false;
                        }
                        await client.stream(found.path, "logs", null);
                        return true;
                    },
                    "log-download": async name => {
                        name = String(name);
                        await this.manager.affirm();
                        let logs = await this.getThis("logs-server");
                        if (!logs.includes(name)) return false;
                        const client = this.clientManager.getClientById("logger");
                        if (!client) return false;
                        if (client.disconnected) {
                            client.connect();
                            return false;
                        }
                        await client.emit("log-download", name);
                        return true;
                    },
                    "log-client-delete": async name => {
                        name = String(name);
                        await this.manager.affirm();
                        let logs = await this.getThis("logs-client");
                        let found = null;
                        for (let log of logs) {
                            if (log.name != name) continue;
                            found = log;
                            break;
                        }
                        if (!found) return false;
                        await this.fileDeny(["logs", found.name]);
                        return true;
                    },
                    "log-server-delete": async name => {
                        name = String(name);
                        await this.manager.affirm();
                        let logs = await this.getThis("logs-server");
                        if (!logs.includes(name)) return false;
                        const client = this.clientManager.getClientById("logger");
                        if (!client) return false;
                        if (client.disconnected) {
                            client.connect();
                            return false;
                        }
                        await client.emit("log-delete", name);
                        return true;
                    },
                    "videos": async () => {
                        await this.dirAffirm("videos");
                        return (await this.dirList("videos"))
                            .filter(dirent => dirent.type == "file")
                            .map(dirent => dirent.name);
                    },
                    "video-has": async name => {
                        name = lib.sanitize(name);
                        await this.dirAffirm("videos");
                        return !!(await this.fileHas(["videos", name]));
                    },
                    "video-get": async name => {
                        name = lib.sanitize(name);
                        await this.dirAffirm("videos");
                        if (!(await this.fileHas(["videos", name])))
                            return null;
                        return WindowManager.makePath(this.dataPath, "videos", name);
                    },
                    "video-rename": async (from, to) => {
                        from = lib.sanitize(from);
                        to = lib.sanitize(to);
                        await this.dirAffirm("videos");
                        if (!(await this.fileHas(["videos", from])))
                            return null;
                        await fs.promises.rename(
                            WindowManager.makePath(this.dataPath, "videos", from),
                            WindowManager.makePath(this.dataPath, "videos", to),
                        );
                        return to;
                    },
                    "video-add-url": async url => {
                        url = String(url);
                        const ytStream = await this.ytdlDownload(url, { quality: "136" });
                        await this.dirAffirm("videos");
                        const l = 11;
                        const id = url.slice(url.length-l).split("").filter(c => util.BASE64.includes(c)).join("");
                        const name = id+".mp4";
                        await this.fileDeny(["videos", name]);
                        const pth = WindowManager.makePath(this.dataPath, "videos", name);
                        const fsStream = fs.createWriteStream(pth);
                        await new Promise((res, rej) => {
                            fsStream.on("open", () => {
                                ytStream.pipe(fsStream);
                                ytStream.on("end", () => res());
                                ytStream.on("error", e => rej(e));
                            });
                        });
                        if (await this.fileHas(["videos", name]))
                            return name;
                        return null;
                    },
                    "video-add-file": async (pth, name=null) => {
                        pth = WindowManager.makePath(pth);
                        name = (name == null) ? path.basename(pth) : (lib.sanitize(name)+path.extname(pth));
                        await this.dirAffirm("videos");
                        await this.fileDeny(["videos", name]);
                        const pth2 = WindowManager.makePath(this.dataPath, "videos", name);
                        await fs.promises.cp(
                            pth, pth2,
                            { force: true, recursive: true },
                        );
                        if (await this.fileHas(["videos", name]))
                            return name;
                        return null;
                    },
                    "video-rem": async name => {
                        name = lib.sanitize(name);
                        await this.dirAffirm("videos");
                        return (await this.fileDeny(["videos", name])) ? name : null;
                    },
                },
                PLANNER: {
                    "read-data": async pth => await WindowManager.fileRead(pth),
                    "exec": async (id, pthId) => {
                        if (this.processManager.getProcessById("script") instanceof Process)
                            throw new Error("Existing process has not terminated");

                        id = String(id);
                        pthId = String(pthId);

                        const sublib = await import("./planner/lib.mjs");

                        let project = null;
                        try {
                            project = JSON.parse(await this.get("project", id), sublib.REVIVER.f);
                        } catch (e) {}
                        if (!(project instanceof sublib.Project)) throw new Error("Invalid project content with id: "+id);
                        if (!project.hasPath(pthId)) throw new Error("Nonexistent path with id: "+pthId+" for project id: "+id);
                        let pth = project.getPath(pthId);

                        const projectName = lib.sanitize(project.meta.name);
                        const pthName = lib.sanitize(pth.name);

                        let script = project.config.scriptUseDefault ? WindowManager.makePath(this.dataPath, "solver", "solver.py") : project.config.script;
                        if (script == null) throw new Error("No script for project with id: "+id);
                        script = String(script);
                        let hasScript = await WindowManager.fileHas(script);
                        if (!hasScript) throw new Error("Script ("+script+") does not exist for project id: "+id);
                        const root = path.dirname(script);

                        let dataIn = { config: {}, nodes: [], obstacles: [] };
                        dataIn.config.map_w = project.w;
                        dataIn.config.map_h = project.h;
                        dataIn.config.side_length = project.robotW;
                        dataIn.config.mass = project.robotMass;
                        project.config.optionKeys.forEach(k => {
                            let v = project.config.getOption(k);
                            try { v = JSON.parse(v); }
                            catch (e) { return; }
                            dataIn.config[k] = v;
                        });
                        pth.nodes.forEach(id => {
                            if (!project.hasItem(id)) return;
                            let itm = project.getItem(id);
                            if (!(itm instanceof sublib.Project.Node)) return;
                            let data = {
                                x: itm.x, y: itm.y,
                                vx: itm.useVelocity ? itm.velocityX : null,
                                vy: itm.useVelocity ? itm.velocityY : null,
                                vt: itm.useVelocity ? itm.velocityRot : null,
                                theta: itm.useHeading ? itm.heading : null,
                            };
                            itm.optionKeys.forEach(k => {
                                let v = itm.getOption(k);
                                try { v = JSON.parse(v); }
                                catch (e) { return; }
                                data[k] = v;
                            });
                            dataIn.nodes.push(data);
                        });
                        project.items.forEach(id => {
                            let itm = project.getItem(id);
                            if (!(itm instanceof sublib.Project.Obstacle)) return;
                            if (itm.disabled) return;
                            dataIn.obstacles.push({
                                x: itm.x, y: itm.y,
                                radius: itm.radius,
                            });
                        });
                        let contentIn = JSON.stringify(dataIn, null, "\t");

                        this.log("exec: REMOVE data.in/data.out");
                        await WindowManager.fileDeny([root, "data.in"]);
                        await WindowManager.fileDeny([root, "data.out"]);
                        this.log("exec: REMOVE stdout.log/stderr.log");
                        await WindowManager.fileDeny([root, "stdout.log"]);
                        await WindowManager.fileDeny([root, "stderr.log"]);
                        this.log("exec: CREATE data.in");
                        await WindowManager.fileWrite([root, "data.in"], contentIn);
                        this.log("exec: CREATE stdout.log/stderr.log");
                        await WindowManager.fileWrite([root, "stdout.log"], "");
                        await WindowManager.fileWrite([root, "stderr.log"], "");
                        return new Promise((res, rej) => {
                            this.log("exec: SPAWN");
                            const process = this.processManager.addProcess(new Process("spawn", project.config.scriptPython, [script], { cwd: root }));
                            process.id = "script";
                            const finish = async () => {
                                const appRoot = await this.get("root");
                                const doAppRoot = appRoot != this.dataPath;
                                await WindowManager.dirAffirm([root, "paths"]);
                                if (doAppRoot) await WindowManager.dirAffirm([appRoot, "paths"]);
                                await WindowManager.dirAffirm([root, "paths", projectName]);
                                if (doAppRoot) await WindowManager.dirAffirm([appRoot, "paths", projectName]);
                                await WindowManager.dirAffirm([root, "paths", projectName, pthName]);
                                if (doAppRoot) await WindowManager.dirAffirm([appRoot, "paths", projectName, pthName]);
                                if (await WindowManager.fileHas(path.join(root, "data.in"))) {
                                    if (doAppRoot)
                                        await fs.promises.cp(
                                            path.join(root, "data.in"),
                                            path.join(appRoot, "paths", projectName, pthName, "data.in"),
                                            { force: true, recursive: true },
                                        );
                                    await fs.promises.rename(
                                        path.join(root, "data.in"),
                                        path.join(root, "paths", projectName, pthName, "data.in"),
                                    );
                                }
                                if (await WindowManager.fileHas(path.join(root, "data.out"))) {
                                    if (doAppRoot)
                                        await fs.promises.cp(
                                            path.join(root, "data.out"),
                                            path.join(appRoot, "paths", projectName, pthName, "data.out"),
                                            { force: true, recursive: true },
                                        );
                                    await fs.promises.rename(
                                        path.join(root, "data.out"),
                                        path.join(root, "paths", projectName, pthName, "data.out"),
                                    );
                                }
                                if (await WindowManager.fileHas(path.join(root, "stdout.log"))) await fs.promises.rename(
                                    path.join(root, "stdout.log"),
                                    path.join(root, "paths", projectName, pthName, "stdout.log"),
                                );
                                if (await WindowManager.fileHas(path.join(root, "stderr.log"))) await fs.promises.rename(
                                    path.join(root, "stderr.log"),
                                    path.join(root, "paths", projectName, pthName, "stderr.log"),
                                );
                            };
                            process.addHandler("data", async data => {
                                WindowManager.fileAppend(path.join(root, "stdout.log"), data);
                            });
                            let already = false;
                            const resolve = async data => {
                                if (already) return;
                                already = true;
                                this.log("exec: SPAWN exit", data);
                                await finish();
                                if (!this.hasWindow() || !this.window.isVisible() || !this.window.isFocused()) {
                                    const notif = new electron.Notification({
                                        title: "Script Process Finished",
                                        body: "Your script finished executing with no errors!",
                                    });
                                    notif.show();
                                }
                                return res(data);
                            };
                            const reject = async data => {
                                if (already) return;
                                already = true;
                                this.log("exec: SPAWN err", data);
                                await finish();
                                if (!this.hasWindow() || !this.window.isVisible() || !this.window.isFocused()) {
                                    const notif = new electron.Notification({
                                        title: "Script Process Finished",
                                        body: "Your script finished executing with an error!",
                                    });
                                    notif.show();
                                }
                                return rej(data);
                            };
                            process.addHandler("exit", data => resolve(data));
                            process.addHandler("error", data => reject(data));
                        });
                    },
                    "exec-term": async () => {
                        this.log("exec: SPAWN term");
                        const process = this.processManager.getProcessById("script");
                        if (!(process instanceof Process)) return false;
                        await process.terminate();
                        return true;
                    },
                    "exec-get": async id => {
                        id = String(id);

                        const sublib = await import("./planner/lib.mjs");

                        let project = null;
                        try {
                            project = JSON.parse(await this.get("project", id), util.REVIVER.f);
                        } catch (e) {}
                        if (!(project instanceof sublib.Project)) throw new Error("Invalid project content with id: "+id);

                        const projectName = lib.sanitize(project.meta.name);

                        let script = project.config.scriptUseDefault ? WindowManager.makePath(this.dataPath, "solver", "solver.py") : project.config.script;
                        if (script == null) return {};
                        script = String(script);
                        if (!(await WindowManager.fileHas(script))) throw new Error("Script ("+script+") does not exist for project id: "+id);
                        let root = path.dirname(script);
                        this.log(`exec-get: looking in ${root} for ${projectName}`);

                        if (!(await WindowManager.dirHas([root, "paths"]))) return {};
                        if (!(await WindowManager.dirHas([root, "paths", projectName]))) return {};
                        let datas = {};
                        let pthList = await WindowManager.dirList([root, "paths", projectName]);
                        pthList = pthList.filter(dirent => dirent.type != "file").map(dirent => dirent.name);
                        await Promise.all(pthList.map(async name => {
                            let pthId = null;
                            for (let id of project.paths) {
                                let pth = project.getPath(id);
                                if (lib.sanitize(pth.name) != name) continue;
                                pthId = id;
                                break;
                            }
                            if (pthId == null) return;
                            let contentOut = "";
                            try {
                                contentOut = await WindowManager.fileRead(path.join(root, "paths", projectName, name, "data.out"));
                            } catch (e) {}
                            let dataOut = null;
                            try {
                                dataOut = JSON.parse(contentOut);
                            } catch (e) {}
                            if (dataOut == null) return;
                            datas[pthId] = dataOut;
                        }));
                        return datas;
                    },
                },
                PYTHONTK: {
                    "install": async pth => {
                        const blacklist = ["__pycache__", "node_modules", "package-lock.json"];
                        await fs.promises.cp(
                            path.join(__dirname, "..", "apps", "ptk"),
                            path.join(pth, "ptk"),
                            {
                                recursive: true, force: true,
                                filter: (src, dest) => {
                                    const name = path.basename(src);
                                    if (name.startsWith(".")) return false;
                                    if (blacklist.includes(name)) return false;
                                    return true;
                                },
                            },
                        );
                        const splitByDelimiters = (start, stop, data) => {
                            start = String(start);
                            stop = String(stop);
                            data = String(data);
                            let include = "", exclude = "";
                            while (true) {
                                let i;
                                i = data.indexOf(start);
                                if (i < 0) {
                                    exclude += data;
                                    break;
                                }
                                exclude += data.slice(0, i);
                                data = data.slice(i+start.length);
                                i = data.indexOf(stop);
                                if (i < 0) {
                                    include += data;
                                    break;
                                }
                                include += data.slice(0, i);
                                data = data.slice(i+stop.length);
                            }
                            return [include, exclude];
                        };
                        const splitByLWDelimiters = data => splitByDelimiters("/*.lw{*/", "/*.lw}*/", data);
                        const removeComments = data => {
                            data = String(data).split("\n").map(line => {
                                if (!line.trim().startsWith("//")) return line;
                                return line.split("//")[0];
                            }).join("\n");
                            return splitByDelimiters("/*", "*/", data)[1];
                        };
                        const simplify = data => {
                            data = String(data).replaceAll("\n", " ");
                            while (data.includes("  ")) data = data.replaceAll("  ", " ");
                            const ignoresWSChars = [];
                            ignoresWSChars.push(...",.;:?()[]{}".split(""));
                            ignoresWSChars.push("==", "<", "<=", ">", ">=", "!=", "!");
                            ignoresWSChars.push("=>", "...");
                            const operators = ["+", "-", "/", "*", "**", "%", "^", "~", "&", "|", "<<", ">>", "&&", "||"];
                            ignoresWSChars.push("=", ...operators, ...operators.map(op => op+"="), "--", "++");
                            for (let c of ignoresWSChars) data = data.replaceAll(" "+c, c).replaceAll(c+" ", c);
                            const finalItemChars = ")]}";
                            for (let c of finalItemChars) data = data.replaceAll(","+c, c);
                            data = data.replaceAll(";}", "}");
                            return data.trim();
                        };
                        const makeMini = data => simplify(removeComments(data));
                        const makeLW = data => makeMini(splitByLWDelimiters(data)[0]);
                        const writeMini = async (src, dest=null, f=null) => {
                            if (dest == null) dest = src;
                            let r = makeMini(await WindowManager.fileRead(src));
                            r = util.ensure(f, "func", r => r)(r);
                            await WindowManager.fileWrite(dest, r);
                        };
                        const writeLW = async (src, dest=null, f=null) => {
                            if (dest == null) dest = src;
                            let r = makeLW(await WindowManager.fileRead(src));
                            r = util.ensure(f, "func", r => r)(r);
                            await WindowManager.fileWrite(dest, r);
                        };

                        await writeLW(
                            path.join(__dirname, "style.css"),
                            path.join(path.join(pth, "ptk", "app", "style.css")),
                        );
                        await writeMini(path.join(pth, "ptk", "app", "style2.css"));

                        await writeMini(
                            path.join(__dirname, "util.mjs"),
                            path.join(path.join(pth, "ptk", "app", "util.mjs")),
                        );
                        await writeLW(
                            path.join(__dirname, "lib.mjs"),
                            path.join(pth, "ptk", "app", "lib.mjs"),
                        );
                        await writeMini(path.join(pth, "ptk", "app", "core.mjs"));

                        await writeMini(path.join(pth, "ptk", "app", "main.js"));
                        await writeMini(path.join(pth, "ptk", "app", "preload.js"));

                        await new Promise((res, rej) => {
                            const process = this.processManager.addProcess(new Process("spawn", "npm", ["install"], { cwd: path.join(pth, "ptk") }));
                            process.addHandler("exit", res);
                            process.addHandler("error", rej);
                        });
                    },
                },
            };
            if (this.name in namefs)
                if (k in namefs[this.name])
                    return await namefs[this.name][k](...a);
            throw new MissingError("Could not on for key: "+k);
        }
        async send(k, ...a) {
            if (!this.started) return false;
            this.windowManager.send(k, ...a);
            k = String(k);
            this.log(`SEND - ${k}(${a.map(v => simplify(JSON.stringify(v))).join(', ')})`);
            if (!this.hasWindow()) return false;
            this.window.webContents.send("send", k, ...a);
            return true;
        }
        cacheSet(k, v) {
            this.windowManager.cacheSet(k, v);
            if (!this.started) return false;
            k = String(k);
            if (!this.hasWindow()) return false;
            this.window.webContents.send("cache-set", k, v);
        }
        cacheDel(k) {
            this.windowManager.cacheDel(k);
            if (!this.started) return false;
            k = String(k);
            if (!this.hasWindow()) return false;
            this.window.webContents.send("cache-del", k);
        }
        cacheClear() {
            this.windowManager.cacheClear();
            if (!this.started) return false;
            if (!this.hasWindow()) return false;
            this.window.webContents.send("cache-clear");
        }
        buildAgent() {
            this.windowManager.buildAgent();
            if (!this.started) return false;
            if (!this.hasWindow()) return false;
            this.window.webContents.send("build-agent");
        }

        update(delta) { this.post("update", delta); }

        log(...a) { return this.manager.log(`[${this.name}]`, ...a); }
    }
    class WindowManager extends lib.FSOperator {
        #window;

        #started;

        #stream;

        #processManager;
        #clientManager;
        #tbaClientManager;

        #windows;

        #loads;
        #isLoading;

        constructor(window) {
            super();

            this.#window = (window instanceof Window) ? window : null;

            this.#started = false;

            this.#stream = null;

            this.#processManager = new ProcessManager();
            this.#clientManager = new ClientManager();
            this.#tbaClientManager = new TBAClientManager();

            this.#windows = new Set();

            this.#loads = new Set();
            this.#isLoading = false;

            this.addHandler("update", delta => this.windows.forEach(win => win.update(delta)));
        }

        get window() { return this.#window; }
        get rootManager() {
            if (this.hasWindow()) return this.window.rootManager;
            return this;
        }

        async init() {
            if (this.hasWindow()) return await this.window.manager.init();
            try {
                await this.affirm();
            } catch (e) {
                await showError("WindowManager Initialize", "Affirmation Error", e);
                return;
            }
            let version = await this.get("version");
            if (!(await this.canFS(version))) {
                let fsVersion = await this.get("fs-version");
                await showError("WindowManager Initialize", "Version Error", "Cannot operate file system due to deprecated application version ("+version+" < "+fsVersion+")");
                return false;
            }
            // monkey patching
            const stdoutWrite = process.stdout.write;
            const stderrWrite = process.stderr.write;
            process.stdout.write = (...a) => {
                stdoutWrite.apply(process.stdout, a);
                this.stream.write.apply(this.stream, a);
            };
            process.stderr.write = (...a) => {
                stderrWrite.apply(process.stderr, a);
                this.stream.write.apply(this.stream, a);
            };
            this.log();
            if (app.dock)
                app.dock.setMenu(electron.Menu.buildFromTemplate([
                    {
                        label: "Features...",
                        submenu: lib.APPFEATURES.map((name, i) => {
                            return {
                                label: lib.getName(name),
                                accelerator: "CmdOrCtrl+"+(i+1),
                                click: () => this.on("spawn", name),
                            };
                        }),
                    },
                ]));
            app.on("browser-window-blur", () => this.checkMenu());
            app.on("browser-window-focus", () => this.checkMenu());
            return true;
        }
        async quit() {
            if (this.hasWindow()) return await this.window.manager.quit();
        }

        get stream() { return this.#stream; }
        hasStream() { return !!this.stream; }

        get processManager() { return this.#processManager; }
        get clientManager() { return this.#clientManager; }
        get tbaClientManager() { return this.#tbaClientManager; }

        get windows() { return [...this.#windows]; }
        set windows(v) {
            v = util.ensure(v, "arr");
            (async () => {
                if (!(await this.clearWindows())) return;
                v.forEach(v => this.addWindow(v));
            })();
        }
        async clearWindows() {
            let r = true;
            await Promise.all(this.windows.map(async win => {
                r &&= await win.windowManager.clearWindows();
                r &&= await this.remWindow(win);
            }));
            return r;
        }
        hasWindow(win) {
            if (win == null) return !!this.window;
            if (!(win instanceof Window)) return false;
            return this.#windows.has(win) && win.manager == this;
        }
        addWindow(win, params=null) {
            if (!(win instanceof Window)) return false;
            if (win.manager != this) return false;
            if (this.hasWindow(win)) return false;
            this.#windows.add(win);
            try {
                win.start(params);
            } catch (e) {
                this.#windows.delete(win);
                showError("Window Start Error", null, e);
                return false;
            }
            this.change("addWindow", null, win);
            this.checkMenu();
            win.onAdd();
            return win;
        }
        async remWindow(win) {
            if (!(win instanceof Window)) return false;
            if (win.manager != this) return false;
            if (!this.hasWindow(win)) return false;
            win.log("REM");
            if (win.started) {
                try {
                    return await win.stop();
                } catch (e) {
                    this.#windows.delete(win);
                    this.change("remWindow", win, null);
                    showError("Window Stop Error", null, e);
                    return win;
                }
            }
            win.log("REM - already stopped");
            win.onRem();
            this.#windows.delete(win);
            this.change("remWindow", win, null);
            this.checkMenu();
            return win;
        }

        checkMenu() {
            if (this.hasWindow()) return this.window.manager.checkMenu();

            let signal = new util.Target();
            signal.about = false;
            // signal.settings = false;
            signal.addHandler("settings", () => this.on("spawn", "PRESETS"));
            electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(makeMenuDefault("", signal)));
            let window = electron.BrowserWindow.getFocusedWindow();
            let windows = [];
            const dfs = manager => {
                if (manager.hasWindow()) windows.push(manager.window);
                manager.windows.forEach(window => dfs(window.windowManager));
            };
            dfs(this);
            for (let win of windows) {
                if (!win.hasWindow()) continue;
                // if (win.isModal) continue;
                let signal = new util.Target();
                signal.addHandler("about", () => win.send("about"));
                signal.addHandler("settings", () => win.on("spawn", "PRESETS"));
                let menu = win.hasMenu() ? win.menu : electron.Menu.buildFromTemplate(makeMenuDefault(win.name, signal));
                win.window.setMenu(menu);
                if (win.window != window) continue;
                electron.Menu.setApplicationMenu(menu);
            }
        }

        get loads() {
            if (this.hasWindow()) return this.window.manager.loads;
            return [...this.#loads];
        }
        set loads(v) {
            if (this.hasWindow()) return this.window.manager.loads = v;
            v = util.ensure(v, "arr");
            this.clearLoads();
            this.addLoad(v);
        }
        clearLoads() {
            if (this.hasWindow()) return this.window.manager.clearLoads();
            let loads = this.loads;
            this.remLoad(loads);
            return loads;
        }
        hasLoad(load) {
            if (this.hasWindow()) return this.window.manager.hasLoad(load);
            load = String(load);
            return this.#loads.has(load);
        }
        addLoad(...loads) {
            if (this.hasWindow()) return this.window.manager.addLoad(...loads);
            return util.Target.resultingForEach(loads, load => {
                load = String(load);
                if (this.hasLoad(load)) return false;
                this.#loads.add(load);
                this.change("addLoad", null, load);
                return load;
            });
        }
        remLoad(...loads) {
            if (this.hasWindow()) return this.window.manager.remLoad(...loads);
            return util.Target.resultingForEach(loads, load => {
                load = String(load);
                if (!this.hasLoad(load)) return false;
                this.#loads.delete(load);
                this.change("remLoad", load, null);
                return load;
            });
        }
        get isLoading() {
            if (this.hasWindow()) return this.window.manager.isLoading;
            return this.#isLoading;
        }
        async tryLoad() {
            if (this.hasWindow()) return await this.window.manager.tryLoad();
            if (this.isLoading) return false;
            const log = (...a) => this.log("DB", ...a);
            let version = await this.get("version");
            this.#isLoading = true;
            let r = await (async () => {

                try {
                    await this.affirm();
                } catch (e) {
                    await showError("Load", "Affirmation Error", e);
                    return false;
                }

                this.clearLoads();

                this.addLoad("fs-version");
                let fsVersion = await this.get("fs-version");
                log(`fs-version check (${version} ?>= ${fsVersion})`);
                if (!(await this.canFS(version))) {
                    log(`fs-version mismatch (${version} !>= ${fsVersion})`);
                    this.remLoad("fs-version");
                    this.addLoad("fs-version:"+version+" < "+fsVersion);
                    return false;
                }
                log(`fs-version match (${version} >= ${fsVersion})`);
                await this.set("fs-version", version);
                this.remLoad("fs-version");

                if (await this.get("comp-mode")) {
                    log(`SKIP (COMP MODE)`);
                    this.addLoad("comp-mode");
                    return true;
                }

                log("getting host");
                this.addLoad("get-host");
                const host = await this.get("db-host");
                const hasHost = host != null;
                this.remLoad("get-host");
                if (!hasHost) {
                    log("got host - failed");
                    log(`+ HOST = ${host}`);
                    return false;
                }
                log("got host");
                log(`+ HOST = ${host}`);

                const theHost = hasHost ? String(new URL("./api/", host)) : null;
                
                const fetchAndPipe = async (url, pth) => {
                    // log(`:: f&p(${url})`);
                    let fileName = path.basename(pth);
                    let superPth = path.dirname(pth);
                    let thePth = path.join(superPth, fileName);
                    let tmpPth = path.join(superPth, fileName+"-tmp");
                    let resp = await util.timeout(30000, fetch(url));
                    if (resp.status != 200) throw resp.status;
                    await new Promise((res, rej) => {
                        const stream = fs.createWriteStream(tmpPth);
                        stream.on("open", () => {
                            resp.body.pipe(stream);
                            resp.body.on("end", () => res(true));
                            resp.body.on("error", rej);
                        });
                    });
                    await fs.promises.rename(tmpPth, thePth);
                    this.check();
                };

                log("polling host");
                this.addLoad("poll-host");
                try {
                    if (hasHost) await fetchAndPipe(theHost, path.join(this.dataPath, "db.json"));
                    log("polling host - success");
                } catch (e) {
                    log(`polling host - error - ${e}`);
                    this.remLoad("poll-host");
                    this.addLoad("poll-host:"+e);
                    return false;
                }
                this.remLoad("poll-host");

                log("getting next host");
                this.addLoad("get-next-host");
                const nextHost = await this.get("db-host");
                this.remLoad("get-next-host");
                if (nextHost != host) {
                    log("next host and current host mismatch - retrying");
                    this.#isLoading = false;
                    return await this.tryLoad(version);
                }
                log("next host and current host match - continuing");
                
                log("finding assets-data");
                this.addLoad("assets-data");
                const assetsOwner = await this.get("assets-owner");
                const assetsRepo = await this.get("assets-repo");
                const assetsTag = await this.get("assets-tag");
                const assetsAuth = await this.get("assets-auth");
                const hasAssets = (assetsOwner != null) && (assetsRepo != null) && (assetsTag != null);
                const kit = new octokit.Octokit({
                    auth: assetsAuth,
                });
                this.remLoad("assets-data");
                if (!hasAssets) {
                    log("found assets-data - failed");
                    log(`+ OWNER = ${assetsOwner}`);
                    log(`+ REPO = ${assetsRepo}`);
                    log(`+ TAG = ${assetsTag}`);
                    return false;
                }
                log("found assets-data");
                log(`+ OWNER = ${assetsOwner}`);
                log(`+ REPO = ${assetsRepo}`);
                log(`+ TAG = ${assetsTag}`);

                log("finding assets");
                this.addLoad("assets");
                const assetsMap = [];
                try {
                    let data = null;
                    try {
                        let content = await this.fileRead(["dump", "assets.json"]);
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    let time = util.ensure(data.time, "num");
                    if (util.getTime()-time > 60*1000) {
                        log("finding assets ( USING OCTO )");
                        let resp = util.ensure(await kit.request("GET /repos/{owner}/{repo}/releases", {
                            owner: assetsOwner,
                            repo: assetsRepo,
                            headers: {
                                "X-GitHub-Api-Version": "2022-11-28",
                            },
                        }), "obj");
                        if (![200, 302].includes(resp.status)) throw resp.status;
                        data = resp.data;
                        await this.fileWrite(["dump", "assets.json"], JSON.stringify({
                            time: util.getTime(),
                            data: data,
                        }));
                    } else {
                        log("finding assets ( USING CACHE )");
                        data = data.data;
                    }
                    let found = false;
                    let releases = util.ensure(data, "arr");
                    for (let release of releases) {
                        release = util.ensure(release, "obj");
                        if (release.tag_name != assetsTag) continue;
                        found = true;
                        let assets = util.ensure(release.assets, "arr");
                        assets.forEach(asset => {
                            asset = util.ensure(asset, "obj");
                            assetsMap.push(asset.name);
                        });
                        break;
                    }
                    if (!found) throw "No release found";
                } catch (e) {
                    log(`finding assets - error - ${e}`);
                    this.remLoad("assets");
                    this.addLoad("assets:"+e);
                    return false;
                }
                log("finding assets - success");
                this.remLoad("assets");

                let maps = {};
                await Promise.all(["themes", "templates", "robots", "holidays"].map(async type => {
                    maps[type] = {};
                    await Promise.all((await this.dirList(["data", type])).map(async dirent => {
                        if (dirent.type != "dir") return;
                        maps[type][dirent.name] = new Set();
                        (await this.dirList(["data", type, dirent.name])).forEach(subdirent => maps[type][dirent.name].add(subdirent.name));
                    }));
                }));
                await Promise.all(assetsMap.map(async key => {
                    const asset = String(key);
                    const assetURL = `https://github.com/${assetsOwner}/${assetsRepo}/releases/download/${assetsTag}/${asset}`;
                    let keyfs = {
                        "config.json": async () => {
                            await fetchAndPipe(assetURL, WindowManager.makePath(this.dataPath, "data", "config.json"));
                            this.check();
                        },
                    };
                    if (key in keyfs) {
                        log(`${key}`);
                        this.addLoad(key);
                        try {
                            await keyfs[key]();
                            log(`${key} - success`);
                        } catch (e) {
                            log(`${key} - error - ${e}`);
                            this.addLoad(key+":"+e);
                        }
                        this.remLoad(key);
                        return;
                    }
                    key = asset.split(".");
                    if (key.length < 2) return;
                    const type = key.shift();
                    if (key.join(".") == "config.json") {
                        let typefs = {
                            themes: async () => {
                                await fetchAndPipe(assetURL, WindowManager.makePath(this.dataPath, "data", "themes", "config.json"));
                            },
                            templates: async () => {
                                await fetchAndPipe(assetURL, WindowManager.makePath(this.dataPath, "data", "templates", "config.json"));
                            },
                            robots: async () => {
                                await fetchAndPipe(assetURL, WindowManager.makePath(this.dataPath, "data", "robots", "config.json"));
                            },
                        };
                        log(`dl ${type} : config`);
                        this.addLoad(`dl-${type}:config`);
                        try {
                            if (type in typefs) {
                                await typefs[type]();
                            } else throw "No found type ("+type+")";
                            log(`dl ${type} : config - success`);
                        } catch (e) {
                            log(`dl ${type} : config - error - ${e}`);
                            this.addLoad(`dl-${type}:config:${e}`);
                        }
                        this.remLoad(`dl-${type}:config`);
                        return;
                    }
                    const id = lib.keyify(lib.sanitize(key.shift()));
                    const name = key.join(".");
                    let typefs = {
                        themes: async () => {
                            if (!["config.json"].includes(name)) throw "Name Error ("+name+")";
                            await fetchAndPipe(assetURL, WindowManager.makePath(this.dataPath, "data", "themes", id, name));
                            if (!(id in maps[type])) return;
                            maps[type][id].delete(name);
                        },
                        templates: async () => {
                            if (!["config.json", "model.glb", "image.png"].includes(name)) throw "Name Error ("+name+")";
                            await fetchAndPipe(assetURL, WindowManager.makePath(this.dataPath, "data", "templates", id, name));
                            if (!(id in maps[type])) return;
                            maps[type][id].delete(name);
                        },
                        robots: async () => {
                            if (!["config.json"].includes(name) && !name.endsWith(".glb")) throw "Name Error ("+name+")";
                            await fetchAndPipe(assetURL, WindowManager.makePath(this.dataPath, "data", "robots", id, name));
                            if (!(id in maps[type])) return;
                            maps[type][id].delete(name);
                        },
                        holidays: async () => {
                            if (!["config.json", "svg.svg", "png.png", "hat-1.svg", "hat-2.svg"].includes(name)) throw "Name Error ("+name+")";
                            await fetchAndPipe(assetURL, WindowManager.makePath(this.dataPath, "data", "holidays", id, name));
                            if (!(id in maps[type])) return;
                            maps[type][id].delete(name);
                            if (name != "png.png") return;
                            const input = await fs.promises.readFile(WindowManager.makePath(this.dataPath, "data", "holidays", id, name));
                            await Promise.all([
                                "ico", "icns",
                            ].map(async tag => {
                                const name2 = tag+"."+tag;
                                const output = {
                                    ico: () => png2icons.createICO(input, png2icons.BILINEAR, 0, true, true),
                                    icns: () => png2icons.createICNS(input, png2icons.BILINEAR, 0),
                                }[tag]();
                                await fs.promises.writeFile(WindowManager.makePath(this.dataPath, "data", "holidays", id, name2), output);
                                if (!(id in maps[type])) return;
                                maps[type][id].delete(name2);
                                this.check();
                            }));
                        },
                    };
                    log(`dl ${type} : ${id} : ${name}`);
                    this.addLoad(`dl-${type}:${id}:${name}`);
                    try {
                        if (type in typefs) {
                            try {
                                await this.dirAffirm(["data", type, id]);
                            } catch (e) {}
                            await typefs[type]();
                        } else throw "No found type ("+type+")";
                        log(`dl ${type} : ${id} : ${name} - success`);
                    } catch (e) {
                        log(`dl ${type} : ${id} : ${name} - error - ${e}`);
                        this.addLoad(`dl-${type}:${id}:${name}:${e}`);
                    }
                    this.remLoad(`dl-${type}:${id}:${name}`);
                }));
                this.check();
                return true;
            })();
            this.#isLoading = false;
            return r;
        }

        get started() {
            if (this.hasWindow()) return this.window.manager.started;
            return this.#started;
        }
        start(params=null) {
            if (this.hasWindow()) return this.window.manager.start(params);

            if (this.started) return false;
            this.#started = true;

            this.log("START");

            const decorate = f => {
                return async (...a) => {
                    try {
                        return await f(...a);
                    } catch (e) {
                        console.error(e);
                        throw util.stringifyError(e);
                    }
                };
            };

            ipc.handle("os", decorate(() => OS));
            ipc.handle("boot-params", decorate(() => bootParams));

            const identify = e => {
                let win = this.identifyWindow(e.sender.id);
                if (!(win instanceof Window)) throw new Error("Nonexistent window corresponding with id: "+e.sender.id);
                return win;
            };

            ipc.handle("get", decorate(async (e, k, ...a) => await this.getCallback(e.sender.id, k, ...a)));
            ipc.handle("set", decorate(async (e, k, ...a) => await this.setCallback(e.sender.id, k, ...a)));
            ipc.handle("del", decorate(async (e, k, ...a) => await this.delCallback(e.sender.id, k, ...a)));

            ipc.handle("on", decorate(async (e, k, ...a) => await this.onCallback(e.sender.id, k, ...a)));

            ipc.handle("file-has", decorate(async (e, pth) => {
                let win = identify(e);
                return await win.fileHas(pth);
            }));
            ipc.handle("file-read", decorate(async (e, pth) => {
                let win = identify(e);
                return await win.fileRead(pth);
            }));
            ipc.handle("file-read-raw", decorate(async (e, pth) => {
                let win = identify(e);
                return await win.fileReadRaw(pth);
            }));
            ipc.handle("file-write", decorate(async (e, pth, content) => {
                let win = identify(e);
                return await win.fileWrite(pth, content);
            }));
            ipc.handle("file-write-raw", decorate(async (e, pth, content) => {
                let win = identify(e);
                return await win.fileWriteRaw(pth, content);
            }));
            ipc.handle("file-append", decorate(async (e, pth, content) => {
                let win = identify(e);
                return await win.fileAppend(pth, content);
            }));
            ipc.handle("file-delete", decorate(async (e, pth) => {
                let win = identify(e);
                return await win.fileDelete(pth);
            }));

            ipc.handle("dir-has", decorate(async (e, pth) => {
                let win = identify(e);
                return await win.dirHas(pth);
            }));
            ipc.handle("dir-list", decorate(async (e, pth) => {
                let win = identify(e);
                return await win.dirList(pth);
            }));
            ipc.handle("dir-make", decorate(async (e, pth) => {
                let win = identify(e);
                return await win.dirMake(pth);
            }));
            ipc.handle("dir-delete", decorate(async (e, pth) => {
                let win = identify(e);
                return await win.dirDelete(pth);
            }));

            ipc.handle("message", decorate(async (e, id, name, ...a) => {
                let win = identify(e);
                return await win.sendMessage(id, name, ...a);
            }));

            ipc.handle("modal-spawn", decorate(async (e, name, params) => {
                let win = identify(e);
                return win.modalSpawn(name, params);
            }));

            ipc.handle("tba-client-make", decorate(async (e, id) => {
                let win = identify(e);
                return await win.tbaClientMake(id);
            }));
            ipc.handle("tba-client-destroy", decorate(async (e, id) => {
                let win = identify(e);
                return await win.tbaClientDestroy(id);
            }));
            ipc.handle("tba-client-has", decorate(async (e, id) => {
                let win = identify(e);
                return await win.tbaClientHas(id);
            }));
            ipc.handle("tba-client-invoke", decorate(async (e, id, invoke, ...a) => {
                let win = identify(e);
                return await win.tbaClientInvoke(id, invoke, ...a);
            }));

            if (bootParams["allow-debug"]) {
                ipc.on("log", (e, ...a) => console.log(...a));
                ipc.on("warn", (e, ...a) => console.warn(...a));
                ipc.on("error", (e, ...a) => console.error(...a));
            }

            (async () => {
                try {
                    await this.affirm();
                } catch (e) {
                    await showError("WindowManager Start Error", "Affirmation Error", e);
                    return;
                }
                try {
                    await this.postResult("start");
                } catch (e) {
                    let r = await showTerminationConfirm("WindowManager Start Error", "'start' event", e);
                    if (r) return;
                }

                this.addWindow(new Window(this, "PORTAL"));

                let windows = await this.get("state", "windows");
                const dfs = (manager, windows) => {
                    windows = util.ensure(windows, "obj");
                    for (let name in windows) {
                        if (name == "PORTAL") continue;
                        let window;
                        try {
                            window = new Window(manager, name);
                        } catch (e) { continue; }
                        if (window.isModal) continue;
                        manager.addWindow(window);
                        dfs(window.windowManager, windows[name]);
                    }
                };
                dfs(this, windows);

                (async () => {
                    let pths = await this.getCleanup();
                    if (pths.length <= 3) return;
                    let r = await showConfirm(
                        "Junk Files",
                        "We found some junk files located in the app data directory. Would you like to clean up?",
                        pths.join("\n"),
                    );
                    if (!r) return;
                    await this.cleanup();
                })();

                try {
                    await this.tryLoad();
                } catch (e) { await showError("WindowManager Start Error", "Load Error", e); }
            })();

            return true;
        }
        async stop() {
            await Promise.all(this.clientManager.clients.map(async client => {
                await client.disconnect();
                this.clientManager.remClient(client);
            }));

            if (this.hasWindow()) return this.window.manager.stop();

            this.log("STOP");
            await Promise.all(this.processManager.processes.map(async process => await process.terminate()));
            await Promise.all(this.tbaClientManager.clients.map(async client => await this.tbaClientDestroy(client)));
            try {
                await this.postResult("stop");
            } catch (e) {
                let r = await showTerminationConfirm("WindowManager Stop Error", "'stop' event", e);
                if (r) return false;
            }

            let windows = {};
            const dfs = (manager, windows) => {
                manager.windows.forEach(window => {
                    if (window.isModal) return;
                    windows[window.name] = { _keep: true };
                    dfs(window.windowManager, windows[window.name]);
                });
            };
            dfs(this, windows);
            await this.set("state", "windows", windows);

            return await this.clearWindows();
        }
        async check() {
            if (!this.hasWindow()) electron.nativeTheme.themeSource = await this.get("native-theme");
            await Promise.all(this.windows.map(async win => await win.check()));
        }

        get dataPath() {
            if (this.hasWindow()) return this.window.dataPath;
            return path.join(app.getPath("appData"), "PeninsulaPortal");
        }
        get root() { return this.dataPath; }
        set root(v) {}

        static async affirm(dataPath) {
            await this.dirAffirm(dataPath);
            await this.dirAffirm([dataPath, "logs"]);
            await this.dirAffirm([dataPath, "dump"]);
            await Promise.all(["data", "override"].map(async sect => {
                await this.dirAffirm([dataPath, sect]);

                await this.dirAffirm([dataPath, sect, "themes"]);
                await this.fileAffirm([dataPath, sect, "themes", "config.json"]);

                await this.dirAffirm([dataPath, sect, "templates"]);
                await this.fileAffirm([dataPath, sect, "templates", "config.json"]);

                await this.dirAffirm([dataPath, sect, "robots"]);
                await this.fileAffirm([dataPath, sect, "robots", "config.json"]);

                await this.dirAffirm([dataPath, sect, "holidays"]);

                await this.fileAffirm([dataPath, sect, "config.json"]);
            }));
            await this.fileAffirm([dataPath, "db.json"]);
            await this.fileAffirm([dataPath, ".version"]);
            await this.fileAffirm([dataPath, "state.json"]);
            return true;
        }
        async affirm() {
            if (this.hasWindow()) return await this.window.manager.affirm();
            let r = await WindowManager.affirm(this.dataPath);
            if (!r) return r;
            if (!this.hasStream()) {
                let now = new Date();
                let yr = now.getFullYear();
                let mon = String(now.getMonth()+1);
                let d = String(now.getDate());
                let hr = String(now.getHours());
                let min = String(now.getMinutes());
                let s = String(now.getSeconds());
                let ms = String(now.getMilliseconds());
                mon = mon.padStart(2, "0");
                d = d.padStart(2, "0");
                hr = hr.padStart(2, "0");
                min = min.padStart(2, "0");
                s = s.padStart(2, "0");
                ms = ms.padEnd(3, "0");
                let name = `${yr}-${mon}-${d} ${hr}-${min}-${s}-${ms}.log`;
                this.#stream = fs.createWriteStream(WindowManager.makePath(this.dataPath, "logs", name));
                await new Promise((res, rej) => this.stream.on("open", () => res()));
            }
            return r;
        }
        static async getCleanup(dataPath) {
            log(". get-cleanup");
            dataPath = WindowManager.makePath(dataPath);
            const pths = [];
            const dfs = async pth => {
                let dirents = await this.dirList(pth);
                await Promise.all(dirents.map(async dirent => {
                    let pth2 = path.join(pth, dirent.name);
                    pths.push(pth2.slice(dataPath.length+1).replaceAll(path.sep, "/"));
                    if (dirent.type == "dir") await dfs(pth2);
                }));
            };
            await dfs(dataPath);
            let successes = {};
            pths.forEach(pth => {
                successes[pth] = 0;
                DATASCHEMA.forEach(schema => {
                    successes[pth] += schema.test(pth);
                });
            });
            return pths.filter(pth => successes[pth] <= 0).map(pth => path.join(dataPath, pth));
        }
        async getCleanup() {
            if (this.hasWindow()) return await this.window.manager.getCleanup();
            return await WindowManager.getCleanup(this.dataPath);
        }
        static async cleanup(dataPath, version) {
            version = String(version);
            log(". cleanup");
            const l = pth => log(". cleanup - delete: "+WindowManager.makePath(pth));
            let fsVersion = await this.getFSVersion(dataPath);
            log(`. cleanup - fs-version check (${version} ?>= ${fsVersion})`);
            if (!(await this.canFS(dataPath, version))) {
                log(`. cleanup - fs-version mismatch (${version} !>= ${fsVersion})`);
                return false;
            }
            log(`. cleanup - fs-version match (${version} >= ${fsVersion})`);
            await this.setFSVersion(dataPath, version);
            let pths = await this.getCleanup(dataPath);
            await Promise.all(pths.map(async pth => {
                l(pth);
                try { return await this.dirDelete(pth); }
                catch (e) {}
                try { return await this.fileDelete(pth); }
                catch (e) {}
            }));
            return true;
        }
        async cleanup() {
            if (this.hasWindow()) return await this.window.manager.cleanup();
            return await WindowManager.cleanup(this.dataPath, await this.get("version"));
        }

        static async getFSVersion(pth) {
            try {
                return await this.fileRead([pth, ".version"]);
            } catch (e) {}
            return "";
        }
        static async setFSVersion(pth, version) {
            try {
                let preVersion = String(await this.getFSVersion(pth));
                await this.fileWrite([pth, ".version"], String(version));
                await this.bumpVersion(preVersion, String(version));
            } catch (e) {}
        }
        static async canFS(pth, version) {
            let fsVersion = await this.getFSVersion(pth);
            version = String(version);
            if (!compareVersions.validateStrict(fsVersion)) return true;
            if (!compareVersions.validateStrict(version)) return false;
            return compareVersions.compare(version, fsVersion, ">=");
        }

        async getFSVersion() {
            if (this.hasWindow()) return await this.window.manager.getFSVersion();
            return await WindowManager.getFSVersion(this.dataPath);
        }
        async setFSVersion(verison) {
            if (this.hasWindow()) return await this.window.manager.setFSVersion(verison);
            return await WindowManager.setFSVersion(this.dataPath, verison);
        }
        async canFS(version) {
            if (this.hasWindow()) return await this.window.manager.canFS(cachedDataVersionTag);
            return await WindowManager.canFS(this.dataPath, version);
        }

        async bumpVersion(from, to) {
            from = String(from);
            to = String(to);
        }

        sendMessage(id, name, ...a) {
            if (this.hasWindow()) return this.window.sendMessage(id, name, ...a);
            id = String(id);
            name = String(name);
            const dfs = manager => {
                if (manager.hasWindow())
                    if (manager.window.id == id)
                        return manager.window.receiveMessage(name, ...a);
                manager.windows.forEach(win => dfs(win.windowManager));
            };
            return dfs(this);
        }

        modalSpawn(name, params) {
            name = String(name);
            if (!lib.MODALS.includes(name)) return null;
            let win = this.addWindow(new Window(this, "modal:"+name), params);
            if (!win) return null;
            return win;
        }
        modalAlert(params) { return this.modalSpawn("ALERT", params); }
        modalConfirm(params) { return this.modalSpawn("CONFIRM", params); }
        modalPrompt(params) { return this.modalSpawn("PROMPT", params); }
        modalProgress(params) { return this.modalSpawn("PROGRESS", params); }

        async tbaClientMake(id) {
            if (this.hasWindow()) return await this.window.tbaClientMake(id);
            if (await this.tbaClientHas(id)) return null;
            this.log(`TBACLIENT:make - ${id}`);
            let client = this.tbaClientManager.addClient(new TBAClient());
            client.id = id;
            return client;
        }
        async tbaClientDestroy(id) {
            if (this.hasWindow()) return await this.window.tbaClientDestroy(id);
            if (!(await this.tbaClientHas(id))) return null;
            this.log(`TBACLIENT:destroy - ${id}`);
            let client = this.tbaClientDestroy.remClient((id instanceof TBAClient) ? id : this.tbaClientManager.getClientById(id));
            return client;
        }
        async tbaClientHas(id) {
            if (this.hasWindow()) return await this.window.tbaClientHas(id);
            return (id instanceof TBAClient) ? this.tbaClientManager.clients.includes(id) : (this.tbaClientManager.getClientById(id) instanceof TBAClient);
        }
        async tbaClientGet(id) {
            if (this.hasWindow()) return await this.window.tbaClientGet(id);
            if (!(await this.tbaClientHas(id))) return null;
            return (id instanceof TBAClient) ? id : this.tbaClientManager.getClientById(id);
        }
        async tbaClientInvoke(id, invoke, ...a) {
            if (this.hasWindow()) return await this.window.tbaClientInvoke(id, invoke, ...a);
            if (!(await this.tbaClientHas(id))) return null;
            let client = (id instanceof TBAClient) ? id : this.tbaClientManager.getClientById(id);
            this.log(`TBACLIENT:emit - ${client.id} > ${invoke}`);
            return await client.invoke(invoke, ...a);
        }

        async ytdlDownload(url, options) {
            if (this.hasWindow()) return await this.window.ytdlDownload(url, options);
            this.log(`YTDL - ${url}`);
            return ytdl(url, options);
        }

        identifyWindow(id) {
            for (let win of this.windows) {
                let found = win.windowManager.identifyWindow(id);
                if (found) return found;
                if (!win.hasWindow()) continue;
                if (win.window.webContents.id != id) continue;
                return win;
            }
            return null;
        }

        async get(k, ...a) { return await this.getThis(k, ...a); }
        async set(k, ...a) { return await this.setThis(k, ...a); }
        async del(k, ...a) { return await this.delThis(k, ...a); }
        async on(k, ...a) { return await this.onThis(k, ...a); }

        async getCallback(id, k, ...a) {
            if (this.hasWindow()) return await this.window.manager.getCallback(id, k, ...a);
            let win = this.identifyWindow(id);
            if (!win) throw new Error("Nonexistent window corresponding with id: "+id+" (get "+k+")");
            return await win.get(k, ...a);
        }
        async setCallback(id, k, ...a) {
            if (this.hasWindow()) return await this.window.manager.setCallback(id, k, ...a);
            let win = this.identifyWindow(id);
            if (!win) throw new Error("Nonexistent window corresponding with id: "+id+" (set "+k+")");
            return await win.set(k, ...a);
        }
        async delCallback(id, k, ...a) {
            if (this.hasWindow()) return await this.window.manager.delCallback(id, k, ...a);
            let win = this.identifyWindow(id);
            if (!win) throw new Error("Nonexistent window corresponding with id: "+id+" (del "+k+")");
            return await win.del(k, ...a);
        }
        async onCallback(id, k, ...a) {
            if (this.hasWindow()) return await this.window.manager.onCallback(id, k, ...a);
            let win = this.identifyWindow(id);
            if (!win) throw new Error("Nonexistent window corresponding with id: "+id+" (on "+k+")");
            return await win.on(k, ...a);
        }

        async getThis(k, ...a) {
            if (this.hasWindow()) return await this.window.manager.getThis(k, ...a);
            k = String(k);
            let kfs = {
                "packaged": async () => {
                    return app.isPackaged;
                },
                "loads": async () => {
                    return this.loads;
                },
                "loading": async () => {
                    return this.isLoading;
                },

                "_writable": async (pth, k="") => {
                    k = String(k).split(".").filter(part => part.length > 0);
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(pth);
                    } catch (e) {}
                    let o = null;
                    try {
                        o = JSON.parse(content);
                    } catch (e) {}
                    o = util.ensure(o, "obj");
                    let stack = o;
                    while (k.length > 0) {
                        let name = k.shift();
                        if (!util.is(stack, "obj")) return null;
                        if (!(name in stack)) return null;
                        stack = stack[name];
                    }
                    return stack;
                },

                "themes": async (type=null) => {
                    let data = {};
                    if (DATATYPES.includes(type)) {
                        await Promise.all((await this.dirList([type, "themes"])).map(async dirent => {
                            if (dirent.type != "dir") return;
                            try {
                                let subdata = util.ensure(JSON.parse(await this.fileRead([type, "themes", dirent.name, "config.json"])), "obj");
                                subdata._source = type;
                                data[dirent.name] = subdata;
                            } catch (e) { return; }
                        }));
                    } else {
                        for (let type of DATATYPES) {
                            let data2 = await kfs["themes"](type);
                            for (let k in data2) data[k] = data2[k];
                        }
                    }
                    return util.ensure(data, "obj");
                },
                "theme": async (id, type=null) => {
                    let themes = await kfs["themes"](type);
                    if (!(id in themes)) return null;
                    return themes[id];
                },
                "active-theme": async (type=null) => {
                    let data = null;
                    if (DATATYPES.includes(type)) data = await kfs._writable([type, "themes", "config.json"], "active");
                    else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["active-theme"](type));
                    }
                    return (data == null) ? null : String(data);
                },

                "templates": async (type=null) => {
                    let data = {};
                    if (DATATYPES.includes(type)) {
                        await Promise.all((await this.dirList([type, "templates"])).map(async dirent => {
                            if (dirent.type != "dir") return;
                            try {
                                let subdata = util.ensure(JSON.parse(await this.fileRead([type, "templates", dirent.name, "config.json"])), "obj");
                                subdata._source = type;
                                data[dirent.name] = subdata;
                            } catch (e) { return; }
                        }));
                    } else {
                        for (let type of DATATYPES) {
                            let data2 = await kfs["templates"](type);
                            for (let k in data2) data[k] = data2[k];
                        }
                    }
                    return util.ensure(data, "obj");
                },
                "template": async (id, type=null) => {
                    let templates = await kfs["templates"](type);
                    if (!(id in templates)) return null;
                    return templates[id];
                },
                "template-images": async (type=null) => {
                    let images = {};
                    if (DATATYPES.includes(type)) {
                        let templates = await kfs["templates"](type);
                        await Promise.all(Object.keys(templates).map(async id => {
                            const pth = WindowManager.makePath(this.dataPath, type, "templates", id, "image.png");
                            if (!(await WindowManager.fileHas(pth))) return;
                            images[id] = pth;
                        }));
                    } else {
                        for (let type of DATATYPES) {
                            let images2 = await kfs["template-images"](type);
                            for (let k in images2) images[k] = images2[k];
                        }
                    }
                    return images;
                },
                "template-models": async (type=null) => {
                    let models = {};
                    if (DATATYPES.includes(type)) {
                        let templates = await kfs["templates"](type);
                        await Promise.all(Object.keys(templates).map(async id => {
                            const pth = WindowManager.makePath(this.dataPath, type, "templates", id, "model.glb");
                            if (!(await WindowManager.fileHas(pth))) return;
                            models[id] = pth;
                        }));
                    } else {
                        for (let type of DATATYPES) {
                            let models2 = await kfs["template-models"](type);
                            for (let k in models2) models[k] = models2[k];
                        }
                    }
                    return models;
                },
                "active-template": async (type=null) => {
                    let data = null;
                    if (DATATYPES.includes(type)) data = await kfs._writable([type, "templates", "config.json"], "active");
                    else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["active-template"](type));
                    }
                    return (data == null) ? null : String(data);
                },
                
                "robots": async (type=null) => {
                    let data = {};
                    if (DATATYPES.includes(type)) {
                        await Promise.all((await this.dirList([type, "robots"])).map(async dirent => {
                            if (dirent.type != "dir") return;
                            try {
                                let subdata = util.ensure(JSON.parse(await this.fileRead([type, "robots", dirent.name, "config.json"])), "obj");
                                subdata._source = type;
                                data[dirent.name] = subdata;
                            } catch (e) { return; }
                        }));
                    } else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["robots"](type));
                    }
                    return util.ensure(data, "obj");
                },
                "robot": async (id, type=null) => {
                    let robots = await kfs["robots"](type);
                    if (!(id in robots)) return null;
                    return robots[id];
                },
                "robot-models": async (type=null) => {
                    let models = {};
                    if (DATATYPES.includes(type)) {
                        let robots = await kfs["robots"](type);
                        await Promise.all(Object.keys(robots).map(async id => {
                            models[id] = { components: {} };
                            let robot = util.ensure(robots[id], "obj");
                            await Promise.all([
                                robot.default || "model",
                                ...Object.keys(util.ensure(robot.components, "obj")),
                            ].map(async (name, i) => {
                                const pth = WindowManager.makePath(this.dataPath, type, "robots", id, lib.sanitize(name)+".glb");
                                if (!(await WindowManager.fileHas(pth))) return;
                                if (i > 0) models[id].components[name] = pth;
                                else models[id].default = pth;
                            }));
                        }));
                    } else {
                        for (let type of DATATYPES) {
                            let models2 = await kfs["robot-models"](type);
                            for (let k in models2) models[k] = models2[k];
                        }
                    }
                    return models;
                },
                "active-robot": async (type=null) => {
                    let data = null;
                    if (DATATYPES.includes(type)) data = await kfs._writable([type, "robots", "config.json"], "active");
                    else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["active-robot"](type));
                    }
                    return (data == null) ? null : String(data);
                },

                "holidays": async (type=null) => {
                    let data = {};
                    if (DATATYPES.includes(type)) {
                        await Promise.all((await this.dirList([type, "holidays"])).map(async dirent => {
                            if (dirent.type != "dir") return;
                            try {
                                let subdata = util.ensure(JSON.parse(await this.fileRead([type, "holidays", dirent.name, "config.json"])), "obj");
                                subdata._source = type;
                                data[dirent.name] = subdata;
                            } catch (e) { return; }
                        }));
                    } else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["holidays"](type));
                    }
                    return util.ensure(data, "obj");
                },
                "holiday": async (id, type=null) => {
                    let holidays = await kfs["holidays"](type);
                    if (!(id in holidays)) return null;
                    return holidays[id];
                },
                "holiday-icons": async (type=null) => {
                    let icons = {};
                    if (DATATYPES.includes(type)) {
                        let holidays = await kfs["holidays"](type);
                        await Promise.all(Object.keys(holidays).map(async id => {
                            icons[id] = {};
                            await Promise.all(["svg", "png", "ico", "icns", "hat1", "hat2"].map(async tag => {
                                let name = ["hat1", "hat2"].includes(tag) ? ("hat-"+tag.slice(3)+".svg") : (tag+"."+tag);
                                const pth = WindowManager.makePath(this.dataPath, type, "holidays", "icons", name);
                                if (!(await WindowManager.fileHas(pth))) return;
                                icons[id][tag] = pth;
                            }));
                        }));
                    } else {
                        for (let type of DATATYPES) {
                            let icons2 = await kfs["holiday-icons"](type);
                            for (let k in icons2) icons[k] = icons2[k];
                        }
                    }
                    return icons;
                },

                "active-holiday": async () => {
                    if (await this.get("holiday-opt")) return null;
                    const now = new Date();
                    const nowDate = now.getDate();
                    const nowMonth = now.getMonth()+1;
                    let holidays = await kfs["holidays"]();
                    for (let name in holidays) {
                        let holidayData = util.ensure(holidays[name], "obj");
                        let days = util.ensure(holidayData.days, "arr");
                        for (let range of days) {
                            range = util.ensure(range, "arr");
                            if (range.length != 2) continue;
                            let [start, stop] = range;
                            start = util.ensure(start, "arr");
                            stop = util.ensure(stop, "arr");
                            if (start.length != 2) continue;
                            if (stop.length != 2) continue;
                            start = start.map(v => util.ensure(v, "int"));
                            stop = stop.map(v => util.ensure(v, "int"));
                            if (start[0] < 1 || start[0] > 31) continue;
                            if (start[1] < 1 || start[1] > 12) continue;
                            if (stop[0] < 1 || stop[0] > 31) continue;
                            if (stop[1] < 1 || stop[1] > 12) continue;
                            if (start[1] > stop[1]) continue;
                            if (start[1] == stop[1] && start[0] > stop[0]) continue;
                            if (nowMonth < start[1] || nowMonth > stop[1]) continue;
                            if (nowMonth == start[1] && nowDate < start[0]) continue;
                            if (nowMonth == stop[1] && nowDate > stop[0]) continue;
                            return name;
                        }
                    }
                    return null;
                },
                "socket-host": async (type=null) => {
                    let data = null;
                    if (DATATYPES.includes(type)) data = await kfs._writable([type, "config.json"], "socketHost");
                    else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["socket-host"](type));
                    }
                    return (data == null) ? (await kfs["db-host"](type)) : String(data);
                },
                "scout-url": async (type=null) => {
                    let data = null;
                    if (DATATYPES.includes(type)) data = await kfs._writable([type, "config.json"], "scoutURL");
                    else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["scout-url"](type));
                    }
                    return (data == null) ? null : String(data);
                },
                "comp-mode": async (type=null) => {
                    let data = null;
                    if (DATATYPES.includes(type)) data = await kfs._writable([type, "config.json"], "isCompMode");
                    else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["comp-mode"](type));
                    }
                    return !!data;
                },
                "native-theme": async (type=null) => {
                    let data = null;
                    if (DATATYPES.includes(type)) data = await kfs._writable([type, "config.json"], "nativeTheme");
                    else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["native-theme"](type));
                    }
                    return util.ensure(data, "str", "system");
                },
                "holiday-opt": async (type=null) => {
                    let data = null;
                    if (DATATYPES.includes(type)) data = await kfs._writable([type, "config.json"], "holidayOpt");
                    else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["holiday-opt"](type));
                    }
                    return !!data;
                },
                "reduced-motion": async (type=null) => {
                    let data = null;
                    if (DATATYPES.includes(type)) data = await kfs._writable([type, "config.json"], "reducedMotion");
                    else {
                        for (let type of DATATYPES) data = mergeThings(data, await kfs["reduced-motion"](type));
                    }
                    return !!data;
                },

                "db-host": async () => {
                    let data = await kfs._writable("db.json", "dbHost");
                    return (data == null) ? null : String(data);
                },
                "assets-owner": async () => {
                    let data = await kfs._writable("db.json", "assetsOwner");
                    return (data == null) ? null : String(data);
                },
                "assets-repo": async () => {
                    let data = await kfs._writable("db.json", "assetsRepo");
                    return (data == null) ? null : String(data);
                },
                "assets-tag": async () => {
                    let data = await kfs._writable("db.json", "assetsTag");
                    return (data == null) ? null : String(data);
                },
                "assets-auth": async () => {
                    let data = await kfs._writable("db.json", "assetsAuth");
                    return (data == null) ? null : String(data);
                },

                "dark-wanted": async () => electron.nativeTheme.shouldUseDarkColors,
                "cleanup": async () => util.ensure(await this.getCleanup(), "arr").map(pth => WindowManager.makePath(pth)),
                "fs-version": async () => await this.getFSVersion(),

                "_fullpackage": async () => {
                    let content = "";
                    try {
                        content = await WindowManager.fileRead(path.join(__dirname, "..", "package.json"));
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    return data;
                },
                "version": async () => {
                    return String((await kfs._fullpackage()).version);
                },
                "repo": async () => {
                    let repo = (await kfs._fullpackage()).repository;
                    return String(util.is(repo, "obj") ? repo.url : repo);
                },

                "state": async (k="") => await kfs._writable("state.json", k),
            };
            if (k in kfs) return await kfs[k](...a);
            throw new MissingError("Could not get for key: "+k);
        }
        async setThis(k, ...a) {
            if (this.hasWindow()) return await this.window.manager.setThis(k, ...a);
            k = String(k);
            let kfs = {
                "_writable": async (pth, k="", v=null) => {
                    k = String(k).split(".").filter(part => part.length > 0);
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(pth);
                    } catch (e) {}
                    let o = null;
                    try {
                        o = JSON.parse(content);
                    } catch (e) {}
                    o = util.ensure(o, "obj");
                    let stack = o;
                    while (k.length > 0) {
                        let name = k.shift();
                        if (!util.is(stack, "obj")) return null;
                        if (k.length > 0) {
                            if (!(name in stack)) return null;
                            stack = stack[name];
                        } else {
                            [stack[name], stack] = [v, stack[name]];
                        }
                    }
                    o = cleanupEmpties(o);
                    await this.fileWrite(pth, JSON.stringify(o, null, "\t"));
                    this.rootManager.check();
                    return stack;
                },

                "active-theme": async v => {
                    v = (v == null) ? null : String(v);
                    let v2 = await this.getThis("active-theme", "data");
                    if (v == v2) return await this.delThis("active-theme");
                    return await kfs._writable(["override", "themes", "config.json"], "active", v);
                },
                "theme": async (id, k="", v=null) => {
                    id = lib.keyify(lib.sanitize(id));
                    return await kfs._writable(["override", "themes", id, "config.json"], k, v);
                },

                "active-template": async v => {
                    v = (v == null) ? null : String(v);
                    let v2 = await this.getThis("active-template", "data");
                    if (v == v2) return await this.delThis("active-template");
                    return await kfs._writable(["override", "templates", "config.json"], "active", v);
                },
                "template": async (id, k="", v=null) => {
                    id = lib.keyify(lib.sanitize(id));
                    return await kfs._writable(["override", "templates", id, "config.json"], k, v);
                },
                "template-image": async (id, pth) => {
                    id = lib.keyify(lib.sanitize(id));
                    await fs.promises.cp(
                        WindowManager.makePath(pth),
                        WindowManager.makePath(this.dataPath, "override", "templates", id, "image.png"),
                        { force: true, recursive: true },
                    );
                    this.rootManager.check();
                },
                "template-model": async (id, pth) => {
                    id = lib.keyify(lib.sanitize(id));
                    await fs.promises.cp(
                        WindowManager.makePath(pth),
                        WindowManager.makePath(this.dataPath, "override", "templates", id, "model.glb"),
                        { force: true, recursive: true },
                    );
                    this.rootManager.check();
                },

                "active-robot": async v => {
                    v = (v == null) ? null : String(v);
                    let v2 = await this.getThis("active-robot", "data");
                    if (v == v2) return await this.delThis("active-robot");
                    return await kfs._writable(["override", "robots", "config.json"], "active", v);
                },
                "robot": async (id, k="", v=null) => {
                    id = lib.keyify(lib.sanitize(id));
                    return await kfs._writable(["override", "robots", id, "config.json"], k, v);
                },
                "robot-default": async (id, pth) => {
                    const robot = util.ensure(await this.getThis("robot", id), "obj");
                    id = lib.keyify(lib.sanitize(id));
                    await fs.promises.cp(
                        WindowManager.makePath(pth),
                        WindowManager.makePath(this.dataPath, "override", "robots", id, lib.sanitize(robot.default || "model")+".glb"),
                        { force: true, recursive: true },
                    );
                    this.rootManager.check();
                },
                "robot-component": async (id, k, pth) => {
                    const robot = util.ensure(await this.getThis("robot", id), "obj");
                    const components = util.ensure(robot.components, "obj");
                    id = lib.keyify(lib.sanitize(id));
                    k = String(k);
                    if (!(k in components)) return;
                    await fs.promises.cp(
                        WindowManager.makePath(pth),
                        WindowManager.makePath(this.dataPath, "override", "robots", id, lib.sanitize(k)+".glb"),
                        { force: true, recursive: true },
                    );
                    this.rootManager.check();
                },
                
                "holiday": async (id, k="", v=null) => {
                    id = lib.keyify(lib.sanitize(id));
                    return await kfs._writable(["override", "holidays", id, "config.json"], k, v);
                },

                "comp-mode": async v => {
                    v = !!v;
                    let v2 = await this.getThis("comp-mode", "data");
                    if (v == v2) return await this.delThis("comp-mode");
                    return await kfs._writable(["override", "config.json"], "isCompMode", v);
                },
                "native-theme": async v => {
                    v = String(v);
                    let v2 = await this.getThis("native-theme", "data");
                    if (v == v2) return await this.delThis("native-theme");
                    return await kfs._writable(["override", "config.json"], "nativeTheme", v);
                },
                "holiday-opt": async v => {
                    v = !!v;
                    let v2 = await this.getThis("holiday-opt", "data");
                    if (v == v2) return await this.delThis("holiday-opt");
                    return await kfs._writable(["override", "config.json"], "holidayOpt", v);
                },
                "reduced-motion": async v => {
                    v = !!v;
                    let v2 = await this.getThis("reduced-motion", "data");
                    if (v == v2) return await this.delThis("reduced-motion");
                    return await kfs._writable(["override", "config.json"], "reducedMotion", v);
                },

                "db-host": async v => await kfs._writable("db.json", "dbHost", (v == null) ? null : String(v)),
                "assets-owner": async v => await kfs._writable("db.json", "assetsOwner", (v == null) ? null : String(v)),
                "assets-repo": async v => await kfs._writable("db.json", "assetsRepo", (v == null) ? null : String(v)),
                "assets-tag": async v => await kfs._writable("db.json", "assetsTag", (v == null) ? null : String(v)),
                "assets-auth": async v => await kfs._writable("db.json", "assetsAuth", (v == null) ? null : String(v)),
                "fs-version": async v => await this.setFSVersion(v),

                "state": async (k="", v=null) => await kfs._writable("state.json", k, v),
            };
            if (k in kfs) return await kfs[k](...a);
            throw new MissingError("Could not set for key: "+k);
        }
        async delThis(k, ...a) {
            if (this.hasWindow()) return await this.window.manager.delThis(k, ...a);
            k = String(k);
            let kfs = {
                "_writable": async (pth, k="") => {
                    k = String(k).split(".").filter(part => part.length > 0);
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(pth);
                    } catch (e) {}
                    let o = null;
                    try {
                        o = JSON.parse(content);
                    } catch (e) {}
                    o = util.ensure(o, "obj");
                    let stack = o;
                    while (k.length > 0) {
                        let name = k.shift();
                        if (!util.is(stack, "obj")) return null;
                        if (k.length > 0) {
                            if (!(name in stack)) return null;
                            stack = stack[name];
                        } else {
                            let v = stack[name];
                            delete stack[name];
                            stack = v;
                        }
                    }
                    o = cleanupEmpties(o);
                    await this.fileWrite(pth, JSON.stringify(o, null, "\t"));
                    this.rootManager.check();
                    return stack;
                },

                "active-theme": async () => await kfs._writable(["override", "themes", "config.json"], "active"),
                "theme": async (id, k=null) => {
                    id = lib.keyify(lib.sanitize(id));
                    if (k == null) return await this.dirDelete(["override", "themes", id]);
                    return kfs._writable(["override", "themes", id, "config.json"], k);
                },

                "active-template": async () => await kfs._writable(["override", "templates", "config.json"], "active"),
                "template": async (id, k=null) => {
                    id = lib.keyify(lib.sanitize(id));
                    if (k == null) return await this.dirDelete(["override", "templates", id]);
                    return await kfs._writable(["override", "templates", id, "config.json"], k);
                },
                "template-image": async id => {
                    await this.fileDelete(["override", "templates", lib.keyify(lib.sanitize(id)), "image.png"]);
                    this.rootManager.check();
                },
                "template-model": async id => {
                    await this.fileDelete(["override", "templates", lib.keyify(lib.sanitize(id)), "model.glb"]);
                    this.rootManager.check();
                },

                "active-robot": async () => await kfs._writable(["override", "robots", "config.json"], "active"),
                "robot": async (id, k=null) => {
                    id = lib.keyify(lib.sanitize(id));
                    if (k == null) return await this.dirDelete(["override", "robots", id]);
                    return await kfs._writable(["override", "robots", id, "config.json"], k);
                },
                "robot-default": async id => {
                    const robot = util.ensure(await this.getThis("robot", id), "obj");
                    await this.fileDelete(["override", "robots", lib.keyify(lib.sanitize(id)), lib.sanitize(robot.default || "model")+".glb"]);
                    this.rootManager.check();
                },
                "robot-component": async (id, k) => {
                    const robot = util.ensure(await this.getThis("robot", id), "obj");
                    const components = util.ensure(robot.components, "obj");
                    k = String(k);
                    if (!(k in components)) return;
                    await this.fileDelete(["override", "robots", lib.keyify(lib.sanitize(id)), lib.sanitize(k)+".glb"]);
                    this.rootManager.check();
                },

                "holiday": async (id, k=null) => {
                    id = lib.keyify(lib.sanitize(id));
                    if (k == null) return await this.dirDelete(["override", "holidays", id]);
                    return await kfs._writable(["override", "holidays", id, "config.json"], k);
                },

                "comp-mode": async () => await kfs._writable(["override", "config.json"], "isCompMode"),
                "native-theme": async () => await kfs._writable(["override", "config.json"], "nativeTheme"),
                "holiday-opt": async () => await kfs._writable(["override", "config.json"], "holidayOpt"),
                "reduced-motion": async () => await kfs._writable(["override", "config.json"], "reducedMotion"),

                "db-host": async () => await kfs._writable("db.json", "dbHost"),
                "assets-owner": async () => await kfs._writable("db.json", "assetsOwner"),
                "assets-repo": async () => await kfs._writable("db.json", "assetsRepo"),
                "assets-tag": async () => await kfs._writable("db.json", "assetsTag"),
                "assets-auth": async () => await kfs._writable("db.json", "assetsAuth"),

                "state": async (k="") => await kfs._writable("state.json", k),
            };
            if (k in kfs) return await kfs[k](...a);
            throw new MissingError("Could not del for key: "+k);
        }
        async onThis(k, ...a) {
            if (this.hasWindow()) return await this.window.manager.onThis(k, ...a);
            k = String(k);
            let kfs = {
                "spawn": async name => {
                    name = String(name);
                    for (let win of this.windows) {
                        if (win.name != name) continue;
                        return false;
                    }
                    this.addWindow(new Window(this, name));
                    return true;
                },
                "notify": async options => {
                    const notif = new electron.Notification(options);
                    notif.show();
                },
                "menu-role-label": async role => {
                    role = String(role);
                    return electron.Menu.buildFromTemplate([{ role: role }]).items[0].label;
                },
                "compress": async data => {
                    return new Promise((res, rej) => {
                        zlib.deflate(util.TEXTENCODER.encode(String(data)), (err, buff) => {
                            if (err) return rej(err);
                            res(buff);
                        });
                    });
                },
                "decompress": async data => {
                    return new Promise((res, rej) => {
                        zlib.inflate(data, (err, buff) => {
                            if (err) return rej(err);
                            res(util.TEXTDECODER.decode(buff));
                        });
                    });
                },
                "open": async url => await electron.shell.openExternal(url),
                "cleanup": async () => await this.cleanup(),
                "try-load": async () => await this.tryLoad(),

                "_export": async (k, pthDst, id, type=null) => {
                    k = lib.keyify(lib.sanitize(k));
                    let datas = await this.getThis(k, type);
                    if (!(id in datas)) throw new Error(util.formatText(k)+" with id: "+id+" does not exist");
                    const source = datas[id]._source;
                    if (!["data", "override"].includes(source)) throw new Error(util.formatText(k)+" with id: "+id+" has an invalid source ("+source+")");
                    pthDst += ".pd"+k.slice(0, -1);
                    const pthSrc = WindowManager.makePath(this.dataPath, source, k, lib.keyify(lib.sanitize(id)));
                    await tarCompress(pthSrc, pthDst);
                    return pthDst;
                },
                "_import": async (k, pthSrc) => {
                    k = lib.keyify(lib.sanitize(k));
                    const pthDst = WindowManager.makePath(this.dataPath, "override", k);
                    await tarDecompress(pthSrc, pthDst);
                },
                "_rekey": async (k, idSrc, idDst) => {
                    k = lib.keyify(lib.sanitize(k));
                    await fs.promises.rename(
                        WindowManager.makePath(this.dataPath, "override", k, lib.keyify(lib.sanitize(idSrc))),
                        WindowManager.makePath(this.dataPath, "override", k, lib.keyify(lib.sanitize(idDst))),
                    );
                },
                "_make": async (k, id, o) => {
                    k = lib.keyify(lib.sanitize(k));
                    id = lib.keyify(lib.sanitize(id));
                    await this.dirAffirm(["override", k, id]);
                    await this.fileAffirm(["override", k, id, "config.json"], JSON.stringify(o));
                    return id;
                },

                "theme-export": async (pthDst, id, type=null) => await kfs._export("themes", pthDst, id, type),
                "theme-import": async pthSrc => await kfs._import("themes", pthSrc),
                "theme-rekey": async (idSrc, idDst) => await kfs._rekey("themes", idSrc, idDst),
                "theme-make": async (id, o) => await kfs._make("themes", id, o),

                "template-export": async (pthDst, id, type=null) => await kfs._export("templates", pthDst, id, type),
                "template-import": async pthSrc => await kfs._import("templates", pthSrc),
                "template-rekey": async (idSrc, idDst) => await kfs._rekey("templates", idSrc, idDst),
                "template-make": async (id, o) => await kfs._make("templates", id, o),

                "robot-export": async (pthDst, id, type=null) => await kfs._export("robots", pthDst, id, type),
                "robot-import": async pthSrc => await kfs._import("robots", pthSrc),
                "robot-rekey": async (idSrc, idDst) => await kfs._rekey("robots", idSrc, idDst),
                "robot-make": async (id, o) => await kfs._make("robots", id, o),

                "holiday-export": async (pthDst, id, type=null) => await kfs._export("holidays", pthDst, id, type),
                "holiday-import": async pthSrc => await kfs._import("holidays", pthSrc),
                "holiday-rekey": async (idSrc, idDst) => await kfs._rekey("holidays", idSrc, idDst),
                "holiday-make": async (id, o) => await kfs._make("holidays", id, o),
            };
            if (k in kfs) return await kfs[k](...a);
            throw new MissingError("Could not on for key: "+k);
        }
        async send(k, ...a) {
            await Promise.all(this.windows.map(async win => await win.send(k, ...a)));
            return true;
        }
        cacheSet(k, v) {
            this.windows.map(win => win.cacheSet(k, v));
            return true;
        }
        cacheDel(k) {
            this.windows.map(win => win.cacheDel(k));
            return true;
        }
        cacheClear() {
            this.windows.map(win => win.cacheClear());
            return true;
        }
        buildAgent() {
            this.windows.map(win => win.buildAgent());
            return true;
        }

        update(delta) { this.post("update", delta); }

        static log(...a) {
            return log(".", ...a);
        }
        static fsLog(...a) {
            return;
            return this.log(...a);
        }
        log(...a) {
            if (this.hasWindow()) return this.window.log(":", ...a);
            return log(":", ...a);
        }
    }

    log("< BUILT CLASSES >");

    const manager = new WindowManager();

    let initializeResolver = new util.Resolver(false);
    async function whenInitialized() { await initializeResolver.whenTrue(); }

    app.on("activate", async () => {
        log("> activate");
        await whenInitialized();
        manager.start();
    });
    app.on("second-instance", async () => {
        log("> second-instance");
        await whenInitialized();
        manager.start();
    });

    let allowQuit = false, beforeQuitResolver = new util.Resolver(false);
    app.on("before-quit", async e => {
        if (allowQuit) return;
        e.preventDefault();
        await beforeQuitResolver.whenFalse();
        if (allowQuit) return;
        beforeQuitResolver.state = true;
        await whenInitialized();
        if (allowQuit) return;
        log("> before-quit");
        let stopped = true;
        try {
            stopped = await manager.stop();
        } catch (e) {
            stopped = false;
            await showError("WindowManager Stop Error", null, e);
        }
        if (!stopped) return beforeQuitResolver.state = false;
        allowQuit = true;
        beforeQuitResolver.state = false;
        app.quit();
    });
    app.on("window-all-closed", async () => {
        log("> all-closed");
        await whenInitialized();
        app.quit();
    });
    app.on("quit", async () => {
        log("> quit");
        await whenInitialized();
        try {
            await manager.quit();
        } catch (e) { await showError("WindowManager Quit Error", null, e); }
    });

    await app.whenReady();

    log("> ready");

    let allowStart = await manager.init();
    if (!allowStart) {
        allowQuit = true;
        app.quit();
        return;
    }

    showError = this.showError = async (name, type, e) => {
        const win = manager.modalAlert({
            props: {
                icon: "warning", iconColor: "var(--cr)",
                title: name, content: type, infos: (e == null) ? [] : [e],
            },
        });
        let r = await win.whenModalResult();
        win.stop();
        return r;
    }
    showWarn = async (name, type, e) => {
        const win = manager.modalAlert({
            props: {
                icon: "warning", iconColor: "var(--cy)",
                title: name, content: type, infos: (e == null) ? [] : [e],
            },
        });
        let r = await win.whenModalResult();
        win.stop();
        return r;
    }
    showSuccess = async (name, type, e) => {
        const win = manager.modalAlert({
            props: {
                icon: "checkmark-circle", iconColor: "var(--cg)",
                title: name, content: type, infos: (e == null) ? [] : [e],
            },
        });
        let r = await win.whenModalResult();
        win.stop();
        return r;
    };
    showConfirm = async (name, type, e, ok="OK", cancel="Cancel") => {
        const win = manager.modalConfirm({
            props: {
                icon: "help-circle",
                title: name, content: type, infos: (e == null) ? [] : [e],
                confirm: ok, cancel: cancel,
            },
        });
        let r = await win.whenModalResult();
        win.stop();
        return r;
    };

    manager.start();
    initializeResolver.state = true;

    let t0 = null;
    let id = setInterval(async () => {
        let t1 = util.getTime();
        if (t0 == null) return t0 = t1;
        try {
            manager.update(t1-t0);
        } catch (e) {
            clearInterval(id);
            await showError("WindowManager Update Error", null, e);
            allowQuit = true;
            app.quit();
            return;
        }
        t1 = t0;
    }, 100);

};
(async () => {
    const context = {};
    try {
        await MAIN.call(context);
    } catch (e) {
        if (context.showError) context.showError("Main Script Error", null, e);
        else console.log("Main Script Error", e);
        if (context.app && context.app.quit)
            context.app.quit();
        process.exit();
    }
})();
