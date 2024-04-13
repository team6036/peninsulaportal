"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const context = {};

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

    const OS = {
        arch: os.arch(),
        platform: os.platform(),
        cpus: os.cpus(),
        user: os.userInfo(),
    };

    function simplify(s) {
        s = String(s);
        if (s.length > 20) s = s.slice(0, 20)+"...";
        return s;
    }

    const FEATURES = ["PORTAL", "PRESETS", "PANEL", "PLANNER", "DATABASE", "PIT", "PYTHONTK"];
    const MODALS = ["ALERT", "CONFIRM", "PROMPT", "PROGRESS"];

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
            if (!(FEATURES.includes(name) || (name.startsWith("modal:") && MODALS.includes(name.slice(6)))))
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

            this.window.on("enter-full-screen", () => this.send("win-fullscreen", true));
            this.window.on("leave-full-screen", () => this.send("win-fullscreen", false));

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
                    let nn = 0;
                    const checkForShow = async () => {
                        nn++;
                        let n = nn;
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
                    const client = this.clientManager.addClient(new Client((await this.get("socket-host"))+"/api/panel"));
                    client.id = "logger";
                    client.addHandler("stream-logs", async (fname, payload, meta, ssStream) => {
                        await this.affirm();
                        if (!(await this.dirHas("logs")))
                            await this.dirMake("logs");
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
                let prevHoliday = null;
                const check = async () => {
                    let holiday = await this.get("active-holiday");
                    holiday = (holiday == null) ? null : String(holiday);
                    await onHolidayState(holiday);
                    if (prevHoliday != holiday) {
                        prevHoliday = holiday;
                        this.send("win-holiday", holiday);
                    }
                };
                fs.watchFile(path.join(this.rootManager.dataPath, "config.json"), check);
                fs.watchFile(path.join(this.rootManager.dataPath, "holidays", "holidays.json"), check);
                await check();
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
                let bounds = util.ensure(await this.on("state-get", "bounds"), "obj");
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
            if (this.canOperate && this.hasWindow()) await this.on("state-set", "bounds", this.window.getBounds());
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
        
        static getDataPath(manager, name, started=true) {
            if (!this.getCanOperate(manager, name, started)) return null;
            return path.join(manager.dataPath, name.toLowerCase());
        }
        get dataPath() { return Window.getDataPath(this.manager, this.name, this.started); }

        static getCanOperate(manager, name, started=true) {
            return (manager instanceof WindowManager) && FEATURES.includes(name) && started;
        }
        get canOperate() { return Window.getCanOperate(this.manager, this.name, this.started); }

        static async affirm(manager, name, started=true) {
            if (!this.getCanOperate(manager, name, started)) return false;
            await manager.affirm();
            let hasWindowData = await WindowManager.dirHas(this.getDataPath(manager, name, started));
            if (!hasWindowData) await WindowManager.dirMake(this.getDataPath(manager, name, started));
            let hasConfig = await WindowManager.fileHas([this.getDataPath(manager, name, started), ".config"]);
            if (!hasConfig) await WindowManager.fileWrite([this.getDataPath(manager, name, started), ".config"], "");
            let hasState = await WindowManager.fileHas([this.getDataPath(manager, name, started), ".state"]);
            if (!hasState) await WindowManager.fileWrite([this.getDataPath(manager, name, started), ".state"], "");
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

        async fileHas(pth) { return Window.fileHas(this.manager, this.name, pth, this.started); }
        async fileRead(pth) { return Window.fileRead(this.manager, this.name, pth, this.started); }
        async fileReadRaw(pth) { return Window.fileReadRaw(this.manager, this.name, pth, this.started); }
        async fileWrite(pth, content) { return Window.fileWrite(this.manager, this.name, pth, content, this.started); }
        async fileWriteRaw(pth, content) { return Window.fileWriteRaw(this.manager, this.name, pth, content, this.started); }
        async fileAppend(pth, content) { return Window.fileAppend(this.manager, this.name, pth, content, this.started); }
        async fileDelete(pth) { return Window.fileDelete(this.manager, this.name, pth, this.started); }

        async dirHas(pth) { return Window.dirHas(this.manager, this.name, pth, this.started); }
        async dirList(pth) { return Window.dirList(this.manager, this.name, pth, this.started); }
        async dirMake(pth) { return Window.dirMake(this.manager, this.name, pth, this.started); }
        async dirDelete(pth) { return Window.dirDelete(this.manager, this.name, pth, this.started); }

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

        async get(k) {
            try {
                return await this.getThis(k);
            } catch (e) { if (!(e instanceof MissingError)) throw e; }
            return await this.manager.get(k);
        }
        async set(k, v) {
            try {
                return await this.setThis(k, v);
            } catch (e) { if (!(e instanceof MissingError)) throw e; }
            return await this.manager.set(k, v);
        }
        async on(k, ...a) {
            try {
                return await this.onThis(k, ...a);
            } catch (e) { if (!(e instanceof MissingError)) throw e; }
            return await this.manager.on(k, ...a);
        }

        async getThis(k) {
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
            };
            if (k in kfs) return await kfs[k]();
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
                        let hasLogsDir = await this.dirHas("logs");
                        if (!hasLogsDir) return [];
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
                    return await namefs[this.name][k]();
            throw new MissingError("Could not get for key: "+k);
        }
        async setThis(k, v) {
            if (!this.started) return false;
            k = String(k);
            let kfs = {
                "menu": async () => {
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

                "fullscreen": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setFullScreen(!!v);
                    return true;
                },
                "fullscreenable": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setFullScreenable(!!v);
                    return true;
                },

                "closeable": async () => {
                    if (!this.hasWindow()) return false;
                    let maximizable = this.window.isMaximizable();
                    this.window.setClosable(!!v);
                    this.window.setMaximizable(maximizable);
                    return true;
                },

                "focused": async () => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.focus();
                    else this.window.blur();
                    return true
                },
                "blurred": async () => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.blur();
                    else this.window.focus();
                    return true;
                },
                "focusable": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setFocusable(!!v);
                    return true;
                },

                "visible": async () => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.show();
                    else this.window.hide();
                    return true;
                },
                "hidden": async () => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.hide();
                    else this.window.show();
                    return true;
                },

                "maximized": async () => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.maximize();
                    else this.window.unmaximize();
                    return true;
                },
                "maximizable": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setMaximizable(!!v);
                    return true;
                },

                "minimized": async () => {
                    if (!this.hasWindow()) return false;
                    if (v) this.window.minimize();
                    else this.window.restore();
                    return true;
                },
                "minimizable": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setMinimizable(!!v);
                    return true;
                },

                "enabled": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setEnabled(!!v);
                    return true;
                },
                "disabled": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setEnabled(!v);
                    return true;
                },

                "resizable": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setResizable(!!v);
                    return true;
                },

                "movable": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setMovable(!!v);
                    return true;
                },

                "opacity": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setOpacity(Math.min(1, Math.max(0, util.ensure(v, "num"))));
                    return true;
                },

                "size": async () => {
                    if (!this.hasWindow()) return false;
                    v = new V(v).ceil();
                    let bounds = this.window.getBounds();
                    let cx = bounds.x+bounds.width/2, cy = bounds.y+bounds.height/2;
                    this.window.setBounds({
                        x: Math.floor(cx-v.x/2),
                        y: Math.floor(cy-v.y/2),
                        width: v.x,
                        height: v.y,
                    });
                    return true;
                },
                "width": async () => {
                    if (!this.hasWindow()) return false;
                    v = Math.ceil(util.ensure(v, "num"));
                    let bounds = this.window.getBounds();
                    let c = bounds.x+bounds.width/2;
                    this.window.setBounds({
                        x: Math.floor(c-v/2),
                        y: bounds.y,
                        width: v,
                        height: bounds.height,
                    });
                    return true;
                },
                "height": async () => {
                    if (!this.hasWindow()) return false;
                    v = Math.ceil(util.ensure(v, "num"));
                    let bounds = this.window.getBounds();
                    let c = bounds.y+bounds.height/2;
                    this.window.setBounds({
                        x: bounds.x,
                        y: Math.floor(c-v/2),
                        width: bounds.width,
                        height: v,
                    });
                    return true;
                },
                "min-size": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setMinimumSize(...new V(v).ceil().xy);
                    return true;
                },
                "min-width": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setMinimumSize(Math.ceil(util.ensure(v, "num")), this.window.getMinimumSize()[1]);
                    return true;
                },
                "min-height": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setMinimumSize(this.window.getMinimumSize()[0], Math.ceil(util.ensure(v, "num")));
                    return true;
                },
                "max-size": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setMaximumSize(...new V(v).ceil().xy);
                    return true;
                },
                "max-width": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setMaximumSize(Math.ceil(util.ensure(v, "num")), this.window.getMaximumSize()[1]);
                    return true;
                },
                "max-height": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setMaximumSize(this.window.getMaximumSize()[0], Math.ceil(util.ensure(v, "num")));
                    return true;
                },
                "bounds": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setBounds(v);
                    return true;
                },

                "title-bar-overlay": async () => {
                    if (!this.hasWindow()) return false;
                    if (this.window.setTitleBarOverlay)
                        this.window.setTitleBarOverlay(v);
                    return true;
                },
            };
            if (k in kfs) return await kfs[k]();
            let namefs = {
            };
            if (this.name in namefs)
                if (k in namefs[this.name])
                    return await namefs[this.name][k]();
            throw new MissingError("Could not set for key: "+k);
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
                "_config": async () => {
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(".config");
                    } catch (e) {}
                    let config = null;
                    try {
                        config = JSON.parse(content);
                    } catch (e) {}
                    config = util.ensure(config, "obj");
                    return config;
                },
                "config-get": async k => {
                    k = String(k);
                    let config = await kfs._config();
                    return config[k];
                },
                "config-set": async (k, v) => {
                    k = String(k);
                    let config = await kfs._config();
                    config[k] = v;
                    await this.fileWrite(".config", JSON.stringify(config, null, "\t"));
                    return v;
                },
                "config-del": async k => {
                    k = String(k);
                    let config = await kfs._config();
                    let v = config[k];
                    delete config[k];
                    await this.fileWrite(".config", JSON.stringify(config, null, "\t"));
                    return v;
                },
                "root-get": async () => {
                    return (await kfs["config-get"]("root")) || this.dataPath;
                },
                "root-set": async root => {
                    root = util.ensure(root, "str", this.dataPath);
                    return await kfs["config-set"]("root", root);
                },
                "_state": async () => {
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(".state");
                    } catch (e) {}
                    let state = null;
                    try {
                        state = JSON.parse(content);
                    } catch (e) {}
                    state = util.ensure(state, "obj");
                    return state;
                },
                "state-get": async k => {
                    k = String(k);
                    let state = await kfs._state();
                    return state[k];
                },
                "state-set": async (k, v) => {
                    k = String(k);
                    let state = await kfs._state();
                    state[k] = v;
                    await this.fileWrite(".state", JSON.stringify(state, null, "\t"));
                    return v;
                },
                "state-del": async k => {
                    k = String(k);
                    let state = await kfs._state();
                    let v = state[k];
                    delete state[k];
                    await this.fileWrite(".state", JSON.stringify(state, null, "\t"));
                    return v;
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
                "project-affirm": async () => {
                    const root = await kfs["root-get"]();
                    let hasDir = await WindowManager.dirHas(root);
                    if (!hasDir) await WindowManager.dirMake(root);
                    let hasProjectsContent = await WindowManager.fileHas([root, "projects.json"]);
                    if (!hasProjectsContent) await WindowManager.fileWrite([root, "projects.json"], "");
                    let hasProjectsDir = await WindowManager.dirHas([root, "projects"]);
                    if (!hasProjectsDir) await WindowManager.dirMake([root, "projects"]);
                },
                "projects-get": async () => {
                    await kfs["project-affirm"]();
                    const root = await kfs["root-get"]();
                    return util.ensure(await WindowManager.dirList([root, "projects"]), "arr")
                        .filter(dirent => (dirent.type == "file" && dirent.name.endsWith(".json")))
                        .map(dirent => dirent.name)
                        .map(name => name.slice(0, -5));
                },
                "projects-list": async () => {
                    await kfs["project-affirm"]();
                    const root = await kfs["root-get"]();
                    let dirents = null;
                    try {
                        dirents = WindowManager.dirList([root, "projects"]);
                    } catch (e) {}
                    return util.ensure(dirents, "arr");
                },
                "project-get": async id => {
                    await kfs["project-affirm"]();
                    id = String(id);
                    const root = await kfs["root-get"]();
                    let content = null;
                    try {
                        content = await WindowManager.fileRead([root, "projects", id+".json"]);
                    } catch (e) {}
                    return content;
                },
                "project-set": async (id, content) => {
                    await kfs["project-affirm"]();
                    id = String(id);
                    const root = await kfs["root-get"]();
                    await WindowManager.fileWrite([root, "projects", id+".json"], content);
                },
                "project-del": async id => {
                    await kfs["project-affirm"]();
                    id = String(id);
                    const root = await kfs["root-get"]();
                    try {
                        await WindowManager.fileDelete([root, "projects", id+".json"]);
                    } catch (e) { return false; }
                    return true;
                },
                "projects-meta-get": async () => {
                    await kfs["project-affirm"]();
                    const root = await kfs["root-get"]();
                    let content = null;
                    try {
                        content = await WindowManager.fileRead([root, "projects.json"]);
                    } catch (e) {}
                    return content;
                },
                "projects-meta-set": async content => {
                    await kfs["project-affirm"]();
                    const root = await kfs["root-get"]();
                    await WindowManager.fileWrite([root, "projects.json"], content);
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
                            while (await WindowManager.fileHas([root, name+"-"+n+ext])) n++;
                            name += "-"+n;
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
                    "cmd-open-app-data-dir": async () => {
                        await new Promise((res, rej) => {
                            const process = this.processManager.addProcess(new Process("spawn", "open", ["."], { cwd: this.manager.dataPath }));
                            process.addHandler("exit", code => res(code));
                            process.addHandler("error", e => rej(e));
                        });
                    },
                    "cmd-cleanup-app-data-dir": async () => {
                        await this.on("cleanup");
                    },
                    "cmd-open-app-log-dir": async () => {
                        await new Promise((res, rej) => {
                            const process = this.processManager.addProcess(new Process("spawn", "open", ["."], { cwd: WindowManager.makePath(this.manager.dataPath, "logs") }));
                            process.addHandler("exit", code => res(code));
                            process.addHandler("error", e => rej(e));
                        });
                    },
                    "cmd-clear-app-log-dir": async () => {
                        let dirents = await this.manager.dirList("logs");
                        let n = 0, nTotal = dirents.length;
                        await Promise.all(dirents.map(async dirent => {
                            await this.manager.fileDelete(["logs", dirent.name]);
                            n++;
                            this.cacheSet("clear-app-log-dir-progress", n/nTotal);
                        }));
                        this.cacheSet("clear-app-log-dir-progress", 1);
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
                                        content = await Window.fileRead(this.manager, name, [".config"]);
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
                                        content = await Window.fileRead(this.manager, name, [".config"]);
                                    } catch (e) {}
                                    let data = null;
                                    try {
                                        data = JSON.parse(content);
                                    } catch (e) {}
                                    data = util.ensure(data, "obj");
                                    data.root = util.ensure(v, "str", Window.getDataPath(this.manager, name));
                                    if (data.root == Window.getDataPath(this.manager, name)) delete data.root;
                                    content = JSON.stringify(data);
                                    await Window.fileWrite(this.manager, name, [".config"], content);
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
                        if (!(await this.dirHas("logs")))
                            await this.dirMake("logs");
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
                        if (await this.fileHas(["logs", found.name]))
                            await this.fileDelete(["logs", found.name]);
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
                        if (!(await this.dirHas("videos")))
                            await this.dirMake("videos");
                        return (await this.dirList("videos"))
                            .filter(dirent => dirent.type == "file")
                            .map(dirent => dirent.name);
                    },
                    "video-has": async name => {
                        name = String(name);
                        if (!(await this.dirHas("videos")))
                            await this.dirMake("videos");
                        return !!(await this.fileHas(["videos", name]));
                    },
                    "video-get": async name => {
                        name = String(name);
                        if (!(await this.dirHas("videos")))
                            await this.dirMake("videos");
                        if (!(await this.fileHas(["videos", name])))
                            return null;
                        return WindowManager.makePath(this.dataPath, "videos", name);
                    },
                    "video-rename": async (from, to) => {
                        from = String(from);
                        to = String(to).replaceAll("/", "-").replaceAll("\\", "-");
                        if (!(await this.dirHas("videos")))
                            await this.dirMake("videos");
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
                        if (!(await this.dirHas("videos")))
                            await this.dirMake("videos");
                        const l = 11;
                        const id = url.slice(url.length-l).split("").filter(c => util.BASE64.includes(c)).join("");
                        const name = id+".mp4";
                        if (await this.fileHas(["videos", name]))
                            await this.fileDelete(["videos", name]);
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
                    "video-add-file": async (pth, name) => {
                        pth = WindowManager.makePath(pth);
                        name = (name == null) ? path.basename(pth) : (String(name)+path.extname(pth));
                        if (!(await this.dirHas("videos")))
                            await this.dirMake("videos");
                        if (await this.fileHas(["videos", name]))
                            await this.fileDelete(["videos", name]);
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
                        name = String(name);
                        if (!(await this.dirHas("videos")))
                            await this.dirMake("videos");
                        if (!(await this.fileHas(["videos", name])))
                            return null;
                        await this.fileDelete(["videos", name]);
                        return name;
                    },
                },
                PLANNER: {
                    "read-data": async pth => await WindowManager.fileRead(pth),
                    "exec": async (id, pathId) => {
                        if (this.processManager.getProcessById("script") instanceof Process)
                            throw new Error("Existing process has not terminated");

                        id = String(id);
                        pathId = String(pathId);

                        const sublib = await import("./planner/lib.mjs");

                        let project = null;
                        try {
                            project = JSON.parse(await kfs["project-get"](id), sublib.REVIVER.f);
                        } catch (e) {}
                        if (!(project instanceof sublib.Project)) throw new Error("Invalid project content with id: "+id);
                        if (!project.hasPath(pathId)) throw new Error("Nonexistent path with id: "+pathId+" for project id: "+id);
                        let pth = project.getPath(pathId);

                        let script = project.config.scriptUseDefault ? WindowManager.makePath(this.dataPath, "solver", "solver.py") : project.config.script;
                        if (script == null) throw new Error("No script for project with id: "+id);
                        script = String(script);
                        let hasScript = await WindowManager.fileHas(script);
                        if (!hasScript) throw new Error("Script ("+script+") does not exist for project id: "+id);
                        const root = path.dirname(script);

                        let dataIn = { config: {}, nodes: [], obstacles: [] };
                        dataIn.config.map_w = project.w / 100;
                        dataIn.config.map_h = project.h / 100;
                        dataIn.config.side_length = project.robotW / 100;
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
                                x: itm.x/100, y: itm.y/100,
                                vx: itm.useVelocity ? itm.velocityX/100 : null,
                                vy: itm.useVelocity ? itm.velocityY/100 : null,
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
                                x: itm.x/100, y: itm.y/100,
                                radius: itm.radius/100,
                            });
                        });
                        let contentIn = JSON.stringify(dataIn, null, "\t");

                        this.log("exec: REMOVE data.in/data.out");
                        if (await WindowManager.fileHas(path.join(root, "data.in")))
                            await WindowManager.fileDelete(path.join(root, "data.in"));
                        if (await WindowManager.fileHas(path.join(root, "data.out")))
                            await WindowManager.fileDelete(path.join(root, "data.out"));
                        this.log("exec: REMOVE stdout.log/stderr.log");
                        if (await WindowManager.fileHas(path.join(root, "stdout.log")))
                            await WindowManager.fileDelete(path.join(root, "stdout.log"));
                        if (await WindowManager.fileHas(path.join(root, "stderr.log")))
                            await WindowManager.fileDelete(path.join(root, "stderr.log"));
                        this.log("exec: CREATE data.in");
                        await WindowManager.fileWrite(path.join(root, "data.in"), contentIn);
                        this.log("exec: CREATE stdout.log/stderr.log");
                        await WindowManager.fileWrite(path.join(root, "stdout.log"), "");
                        await WindowManager.fileWrite(path.join(root, "stderr.log"), "");
                        return new Promise((res, rej) => {
                            this.log("exec: SPAWN");
                            const process = this.processManager.addProcess(new Process("spawn", project.config.scriptPython, [script], { cwd: root }));
                            process.id = "script";
                            const finish = async () => {
                                const appRoot = await this.on("root-get");
                                const doAppRoot = appRoot != this.dataPath;
                                let hasMainDir = await WindowManager.dirHas(path.join(root, "paths"));
                                if (!hasMainDir) await WindowManager.dirMake(path.join(root, "paths"));
                                if (doAppRoot) {
                                    let hasMainDir = await WindowManager.dirHas(path.join(appRoot, "paths"));
                                    if (!hasMainDir) await WindowManager.dirMake(path.join(appRoot, "paths"));
                                }
                                let hasProjectDir = await WindowManager.dirHas(path.join(root, "paths", project.meta.name));
                                if (!hasProjectDir) await WindowManager.dirMake(path.join(root, "paths", project.meta.name));
                                if (doAppRoot) {
                                    let hasProjectDir = await WindowManager.dirHas(path.join(appRoot, "paths", project.meta.name));
                                    if (!hasProjectDir) await WindowManager.dirMake(path.join(appRoot, "paths", project.meta.name));
                                }
                                let hasPathDir = await WindowManager.dirHas(path.join(root, "paths", project.meta.name, pth.name));
                                if (!hasPathDir) await WindowManager.dirMake(path.join(root, "paths", project.meta.name, pth.name));
                                if (doAppRoot) {
                                    let hasPathDir = await WindowManager.dirHas(path.join(appRoot, "paths", project.meta.name, pth.name));
                                    if (!hasPathDir) await WindowManager.dirMake(path.join(appRoot, "paths", project.meta.name, pth.name));
                                }
                                let hasDataIn = await WindowManager.fileHas(path.join(root, "data.in"));
                                if (hasDataIn) {
                                    if (doAppRoot)
                                        await fs.promises.cp(
                                            path.join(root, "data.in"),
                                            path.join(appRoot, "paths", project.meta.name, pth.name, "data.in"),
                                            { force: true, recursive: true },
                                        );
                                    await fs.promises.rename(path.join(root, "data.in"), path.join(root, "paths", project.meta.name, pth.name, "data.in"));
                                }
                                let hasDataOut = await WindowManager.fileHas(path.join(root, "data.out"));
                                if (hasDataOut) {
                                    if (doAppRoot)
                                        await fs.promises.cp(
                                            path.join(root, "data.out"),
                                            path.join(appRoot, "paths", project.meta.name, pth.name, "data.out"),
                                            { force: true, recursive: true },
                                        );
                                    await fs.promises.rename(path.join(root, "data.out"), path.join(root, "paths", project.meta.name, pth.name, "data.out"));
                                }
                                let hasOutLog = await WindowManager.fileHas(path.join(root, "stdout.log"));
                                if (hasOutLog) await fs.promises.rename(path.join(root, "stdout.log"), path.join(root, "paths", project.meta.name, pth.name, "stdout.log"));
                                let hasErrLog = await WindowManager.fileHas(path.join(root, "stderr.log"));
                                if (hasErrLog) await fs.promises.rename(path.join(root, "stderr.log"), path.join(root, "paths", project.meta.name, pth.name, "stderr.log"));
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
                            project = JSON.parse(await kfs["project-get"](id), sublib.REVIVER.f);
                        } catch (e) {}
                        if (!(project instanceof sublib.Project)) throw new Error("Invalid project content with id: "+id);

                        let script = project.config.scriptUseDefault ? WindowManager.makePath(this.dataPath, "solver", "solver.py") : project.config.script;
                        if (script == null) return {};
                        script = String(script);
                        let has = await WindowManager.fileHas(script);
                        if (!has) throw new Error("Script ("+script+") does not exist for project id: "+id);
                        let root = path.dirname(script);
                        this.log(`exec-get: looking in ${root} for ${project.meta.name}`);

                        let hasMainDir = await WindowManager.dirHas(path.join(root, "paths"));
                        if (!hasMainDir) return {};
                        let hasProjectDir = await WindowManager.dirHas(path.join(root, "paths", project.meta.name));
                        if (!hasProjectDir) return {};
                        let datas = {};
                        let pathNames = project.paths.map(id => project.getPath(id).name);
                        let pathList = await WindowManager.dirList(path.join(root, "paths", project.meta.name));
                        pathList = pathList.filter(dirent => (dirent.type != "file" && pathNames.includes(dirent.name))).map(dirent => dirent.name);
                        await Promise.all(pathList.map(async name => {
                            let pathId = null;
                            for (let id of project.paths) {
                                let pth = project.getPath(id);
                                if (pth.name != name) continue;
                                pathId = id;
                                break;
                            }
                            if (pathId == null) return;
                            let contentOut = "";
                            try {
                                contentOut = await WindowManager.fileRead(path.join(root, "paths", project.meta.name, name, "data.out"));
                            } catch (e) {}
                            let dataOut = null;
                            try {
                                dataOut = JSON.parse(contentOut);
                            } catch (e) {}
                            if (dataOut == null) return;
                            datas[pathId] = dataOut;
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
                            r => r.replaceAll(
                                "new URL(\"node_modules/mathjs/lib/browser/math.js\",\"file://\"+String(await window.api.getAppRoot()))",
                                "\"../node_modules/mathjs/lib/browser/math.js\"",
                            ),
                        );
                        await writeMini(path.join(pth, "ptk", "app", "core.mjs"));

                        await writeMini(path.join(pth, "ptk", "app", "main.js"));
                        await writeMini(path.join(pth, "ptk", "app", "preload.js"));

                        await new Promise((res, rej) => {
                            const process = this.processManager.addProcess(new Process("spawn", "npm", ["install"], { cwd: path.join(pth, "ptk") }));
                            process.addHandler("exit", code => res(code));
                            process.addHandler("error", e => rej(e));
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
            let version = await this.get("base-version");
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
                        submenu: ["PANEL", "PLANNER", "DATABASE", "PIT", "PYTHONTK"].map((name, i) => {
                            return {
                                label: lib.getName(name),
                                accelerator: "CmdOrCtrl+"+(i+1),
                                click: () => this.on("spawn", name),
                            };
                        }),
                    },
                ]));
            electron.nativeTheme.on("updated", () => this.send("native-theme"));
            electron.nativeTheme.themeSource = await this.get("native-theme");
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
            let version = await this.get("base-version");
            this.#isLoading = true;
            let r = await (async () => {
                try {
                    await this.affirm();
                } catch (e) {
                    await showError("Load", "Affirmation Error", e);
                    return false;
                }
                this.clearLoads();
                let fsVersion = await this.get("fs-version");
                log(`fs-version check (${version} ?>= ${fsVersion})`);
                this.addLoad("fs-version");
                if (!(await this.canFS(version))) {
                    log(`fs-version mismatch (${version} !>= ${fsVersion})`);
                    this.remLoad("fs-version");
                    this.addLoad("fs-version:"+version+" < "+fsVersion);
                    return false;
                }
                log(`fs-version match (${version} >= ${fsVersion})`);
                this.remLoad("fs-version");
                await this.set("fs-version", version);
                log("finding host");
                this.addLoad("find");
                const host = await this.get("db-host");
                const doFallback = host == null;
                const theHost = host + "/api";
                const isCompMode = await this.get("comp-mode");
                this.remLoad("find");
                if (doFallback) log(`poll ( host: FALLBACK )`);
                else log(`poll ( host: ${host} )`);
                if (isCompMode) {
                    log(`poll - SKIP (COMP MODE)`);
                    this.addLoad("comp-mode");
                    return true;
                }
                if (doFallback) {
                    log(`no polling ( FALLBACK )`);
                } else {
                    log(`polling`);
                    this.addLoad("poll");
                    try {
                        let resp = await util.timeout(10000, fetch(theHost));
                        if (resp.status != 200) throw resp.status;
                    } catch (e) {
                        log(`polling - fail`);
                        this.remLoad("poll");
                        this.addLoad("poll:"+e);
                        return false;
                    }
                    log(`polling - success`);
                    this.remLoad("poll");
                }
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
                            resp.body.on("error", e => rej(e));
                        });
                    });
                    await fs.promises.rename(tmpPth, thePth);
                };
                log("config");
                this.addLoad("config");
                try {
                    if (doFallback) await fs.promises.cp(
                        path.join(__dirname, "assets", "fallback", "config.json"),
                        path.join(this.dataPath, ".config"),
                        { recursive: true, force: true },
                    );
                    else await fetchAndPipe(theHost+"/config", path.join(this.dataPath, ".config"));
                    log("config - success");
                } catch (e) {
                    log(`config - error - ${e}`);
                    this.addLoad("config:"+e);
                }
                this.remLoad("config");
                log("finding next host");
                this.addLoad("find-next");
                const nextHost = await this.get("db-host");
                this.remLoad("find-next");
                if (nextHost != host) {
                    log("next host and current host mismatch - retrying");
                    this.#isLoading = false;
                    return await this.tryLoad(version);
                }
                log("next host and current host match - continuing");
                const assetsHost = String(await this.get("assets-host"));
                const fullConfig = util.ensure(await this.get("_fullconfig"), "obj");
                const assetsGHUser = fullConfig.assetsGHUser;
                const assetsGHRepo = fullConfig.assetsGHRepo;
                const assetsGHRelease = fullConfig.assetsGHRelease;
                let kit = null, releaseId = null, assets = null;
                if (false && [assetsGHUser, assetsGHRepo, assetsGHRelease].map(v => util.is(v, "str")).all()) {
                    kit = new octokit.Octokit({
                        auth: fullConfig.assetsGHAuth,
                    });
                }
                if (doFallback) log("poll ( SKIP HOST )");
                else {
                    log("poll ( USING HOST )");
                    log(`poll ( host = ${host} )`);
                }
                if (kit) {
                    log("poll ( USING OCTOKIT )");
                    log(`poll ( assetsGHUser = ${assetsGHUser} )`);
                    log(`poll ( assetsGHRepo = ${assetsGHRepo} )`);
                    log(`poll ( assetsGHRelease = ${assetsGHRelease} )`);
                } else log("poll ( SKIP OCTOKIT )");
                log(`poll ( assetsHost = ${assetsHost} )`);
                if (kit) {
                    try {
                        log("poll OCTOKIT : find release ID");
                        let resp = await util.timeout(kit.request(`GET /repos/${assetsGHUser}/${assetsGHRepo}/releases`), 2000);
                        resp = util.ensure(resp, "obj");
                        if (resp.status != 200 && resp.status != 302) throw resp.status;
                        let data = util.ensure(resp.data, "arr");
                        for (let release of data) {
                            release = util.ensure(release, "obj");
                            if (release.tag_name != assetsGHRelease) continue;
                            releaseId = release.id;
                            break;
                        }
                        log(`poll OCTOKIT : find release ID ( id = ${releaseId} )`);
                    } catch (e) {
                        releaseId = null;
                        log(`poll OCTOKIT : find release ID - error - ${e}`);
                    }
                }
                if (kit && releaseId) {
                    try {
                        log("poll OCTOKIT : find assets");
                        let resp = await util.timeout(kit.request(`GET /repos/${assetsGHUser}/${assetsGHRepo}/releases/${releaseId}/assets`), 2000);
                        resp = util.ensure(resp, "obj");
                        if (resp.status != 200 && resp.status != 302) throw resp.status;
                        assets = util.ensure(resp.data, "arr");
                        let assets2 = {};
                        assets.forEach(asset => {
                            asset = util.ensure(asset, "obj");
                            assets2[asset.name] = asset.id;
                        });
                        assets = assets2;
                    } catch (e) {
                        log(`poll OCTOKIT : find assets - error - ${e}`);
                    }
                }
                await Promise.all([
                    (async () => {
                        log("templates.json");
                        this.addLoad("templates.json");
                        try {
                            if (doFallback) await fs.promises.cp(
                                path.join(__dirname, "assets", "fallback", "templates.json"),
                                path.join(this.dataPath, "templates", "templates.json"),
                                { recursive: true, force: true },
                            );
                            else await fetchAndPipe(theHost+"/templates", path.join(this.dataPath, "templates", "templates.json"));
                            log("templates.json - success");
                        } catch (e) {
                            log(`templates.json - error - ${e}`);
                            this.addLoad("templates.json:"+e);
                        }
                        this.remLoad("templates.json");
                        log("checking templates.json");
                        let content = await this.fileRead(["templates", "templates.json"]);
                        let data = null;
                        try {
                            data = JSON.parse(content);
                            log("checking templates.json - success");
                        } catch (e) {
                            log(`checking templates.json - error - ${e}`);
                        }
                        data = util.ensure(data, "obj");
                        let templates = util.ensure(data.templates, "obj");
                        await Promise.all(Object.keys(templates).map(async name => {
                            name = String(name);
                            const template = templates[name];
                            await Promise.all(["images", "models"].map(async section => {
                                let tag = { images: "png", models: "glb" }[section];
                                if (section.slice(0, -1) in template)
                                    if (!template[section.slice(0, -1)]) {
                                        log(`templates/${name}.${tag} IGNORED`);
                                        return;
                                    }
                                const pth = path.join(this.dataPath, "templates", section, name+"."+tag);
                                const key = "templates."+name+"."+tag;
                                if (kit && releaseId && assets && (key in assets)) {
                                    let successful = false;
                                    log(`templates/${name}.${tag} using OCTOKIT`);
                                    this.addLoad(`templates/${name}.${tag}-ok`);
                                    try {
                                        let resp = await util.timeout(kit.request(`GET /repos/${assetsGHUser}/${assetsGHRepo}/releases/assets/${assets[key]}`, {
                                            headers: {
                                                Accept: "application/octet-stream",
                                            },
                                        }), 2000);
                                        resp = util.ensure(resp, "obj");
                                        if (resp.status != 200 && resp.status != 302) throw resp.status;
                                        await WindowManager.fileWriteRaw(pth, resp.data);
                                        successful = true;
                                        log(`templates/${name}.${tag} using OCTOKIT - success`);
                                    } catch (e) {
                                        log(`templates/${name}.${tag} using OCTOKIT - error - ${e}`);
                                        this.addLoad(`templates/${name}.${tag}-ok:`+e);
                                    }
                                    this.remLoad(`templates/${name}.${tag}-ok`);
                                    if (successful) return;
                                }
                                log(`templates/${name}.${tag}`);
                                this.addLoad(`templates/${name}.${tag}`);
                                try {
                                    await fetchAndPipe(assetsHost+"/templates."+name+"."+tag, pth);
                                    log(`templates/${name}.${tag} - success`);
                                } catch (e) {
                                    log(`templates/${name}.${tag} - error - ${e}`);
                                    this.addLoad(`templates/${name}.${tag}:`+e);
                                }
                                this.remLoad(`templates/${name}.${tag}`);
                            }));
                        }));
                    })(),
                    (async () => {
                        log("robots.json");
                        this.addLoad("robots.json");
                        try {
                            if (doFallback) await fs.promises.cp(
                                path.join(__dirname, "assets", "fallback", "robots.json"),
                                path.join(this.dataPath, "robots", "robots.json"),
                                { recursive: true, force: true },
                            );
                            else await fetchAndPipe(theHost+"/robots", path.join(this.dataPath, "robots", "robots.json"));
                            log("robots.json - success");
                        } catch (e) {
                            log(`robots.json - error - ${e}`);
                            this.addLoad("robots.json:"+e);
                        }
                        this.remLoad("robots.json");
                        log("checking robots.json");
                        let content = await this.fileRead(["robots", "robots.json"]);
                        let data = null;
                        try {
                            data = JSON.parse(content);
                            log("checking robots.json - success");
                        } catch (e) {
                            log(`checking robots.json - error - ${e}`);
                        }
                        data = util.ensure(data, "obj");
                        let robots = util.ensure(data.robots, "obj");
                        await Promise.all(Object.keys(robots).map(async name => {
                            name = String(name);
                            await Promise.all(["models"].map(async section => {
                                let tag = { images: "png", models: "glb" }[section];
                                const pth = path.join(this.dataPath, "robots", section, name+"."+tag);
                                const key = "robots."+name+"."+tag;
                                if (kit && releaseId && assets && (key in assets)) {
                                    let successful = false;
                                    log(`robots/${name}.${tag} using OCTOKIT`);
                                    this.addLoad(`robots/${name}.${tag}-ok`);
                                    try {
                                        let resp = await util.timeout(kit.request(`GET /repos/${assetsGHUser}/${assetsGHRepo}/releases/assets/${assets[key]}`, {
                                            headers: {
                                                Accept: "application/octet-stream",
                                            },
                                        }), 2000);
                                        resp = util.ensure(resp, "obj");
                                        if (resp.status != 200 && resp.status != 302) throw resp.status;
                                        await WindowManager.fileWriteRaw(pth, resp.data);
                                        successful = true;
                                        log(`robots/${name}.${tag} using OCTOKIT - success`);
                                    } catch (e) {
                                        log(`robots/${name}.${tag} using OCTOKIT - error - ${e}`);
                                        this.addLoad(`robots/${name}.${tag}-ok:`+e);
                                    }
                                    this.remLoad(`robots/${name}.${tag}-ok`);
                                    if (successful) return;
                                }
                                log(`robots/${name}.${tag}`);
                                this.addLoad(`robots/${name}.${tag}`);
                                try {
                                    await fetchAndPipe(assetsHost+"/robots."+name+"."+tag, pth);
                                    log(`robots/${name}.${tag} - success`);
                                } catch (e) {
                                    log(`robots/${name}.${tag} - error - ${e}`);
                                    this.addLoad(`robots/${name}.${tag}:`+e);
                                }
                                this.remLoad(`robots/${name}.${tag}`);
                            }));
                        }));
                    })(),
                    (async () => {
                        log("holidays.json");
                        this.addLoad("holidays.json");
                        try {
                            if (doFallback) await fs.promises.cp(
                                path.join(__dirname, "assets", "fallback", "holidays.json"),
                                path.join(this.dataPath, "holidays", "holidays.json"),
                                { recursive: true, force: true },
                            );
                            else await fetchAndPipe(theHost+"/holidays", path.join(this.dataPath, "holidays", "holidays.json"));
                            log("holidays.json - success");
                        } catch (e) {
                            log(`holidays.json - error - ${e}`);
                            this.addLoad("holidays.json:"+e);
                        }
                        this.remLoad("holidays.json");
                        log("checking holidays.json");
                        let content = await this.fileRead(["holidays", "holidays.json"]);
                        let data = null;
                        try {
                            data = JSON.parse(content);
                            log("checking holidays.json - success");
                        } catch (e) {
                            log(`checking holidays.json - error - ${e}`);
                        }
                        data = util.ensure(data, "obj");
                        let holidays = util.ensure(data.holidays, "obj");
                        await Promise.all(Object.keys(holidays).map(async name => {
                            name = String(name);
                            const holiday = holidays[name];
                            await Promise.all([
                                "svg", "png", // "ico", "icns",
                                "hat1", "hat2",
                            ].map(async tag => {
                                if (["svg", "png"].includes(tag))
                                    if ("icon" in holiday && !holiday.icon)
                                        return;
                                if (["hat1", "hat2"].includes(tag))
                                    if ("hat" in holiday && !holiday.hat)
                                        return;
                                let fullname = name+((tag == "hat1") ? "-hat-1.svg" : (tag == "hat2") ? "-hat-2.svg" : "."+tag);
                                const pth = path.join(this.dataPath, "holidays", "icons", fullname);
                                const key = "holidays."+fullname;
                                if (kit && releaseId && assets && (key in assets)) {
                                    let successful = false;
                                    log(`holidays/${name}.${tag} using OCTOKIT`);
                                    this.addLoad(`holidays/${name}.${tag}-ok`);
                                    try {
                                        let resp = await util.timeout(kit.request(`GET /repos/${assetsGHUser}/${assetsGHRepo}/releases/assets/${assets[key]}`, {
                                            headers: {
                                                Accept: "application/octet-stream",
                                            },
                                        }), 2000);
                                        resp = util.ensure(resp, "obj");
                                        if (resp.status != 200 && resp.status != 302) throw resp.status;
                                        await WindowManager.fileWriteRaw(pth, resp.data);
                                        successful = true;
                                        log(`holidays/${name}.${tag} using OCTOKIT - success`);
                                    } catch (e) {
                                        log(`holidays/${name}.${tag} using OCTOKIT - error - ${e}`);
                                        this.addLoad(`holidays/${name}.${tag}-ok:`+e);
                                    }
                                    this.remLoad(`holidays/${name}.${tag}-ok`);
                                    if (successful) return;
                                }
                                log(`holidays/${fullname}`);
                                this.addLoad(`holidays/${fullname}`);
                                try {
                                    await fetchAndPipe(assetsHost+"/holidays."+fullname, pth);
                                    log(`holidays/${fullname} - success`);
                                } catch (e) {
                                    log(`holidays/${fullname} - error - ${e}`);
                                    this.addLoad(`holidays/${fullname}:`+e);
                                }
                                this.remLoad(`holidays/${fullname}`);
                            }));
                        }));
                        await Promise.all(Object.keys(holidays).map(async name => {
                            name = String(name);
                            const holiday = holidays[name];
                            if ("icon" in holiday && !holiday.icon) return;
                            if (!(await WindowManager.fileHas([this.dataPath, "holidays", "icons", name+".png"]))) return;
                            let input = await fs.promises.readFile(path.join(this.dataPath, "holidays", "icons", name+".png"));
                            await Promise.all([
                                "ico", "icns",
                            ].map(async tag => {
                                let pth = name+"."+tag;
                                log(`holidays/${pth} conversion`);
                                this.addLoad(`holidays/${pth}-conv`);
                                try {
                                    let output = {
                                        ico: () => png2icons.createICO(input, png2icons.BILINEAR, 0, true, true),
                                        icns: () => png2icons.createICNS(input, png2icons.BILINEAR, 0),
                                    }[tag]();
                                    await fs.promises.writeFile(path.join(this.dataPath, "holidays", "icons", pth), output);
                                    log(`holidays/${pth} conversion - success`);
                                } catch (e) {
                                    log(`holidays/${pth} conversion - error - ${e}`);
                                    this.addLoad(`holidays/${pth}-conv:`+e);
                                }
                                this.remLoad(`holidays/${pth}-conv`);
                            }));
                        }));
                    })(),
                    (async () => {
                        log("themes.json");
                        this.addLoad("themes.json");
                        try {
                            if (doFallback) await fs.promises.cp(
                                path.join(__dirname, "assets", "fallback", "themes.json"),
                                path.join(this.dataPath, "themes.json"),
                                { recursive: true, force: true },
                            );
                            else await fetchAndPipe(theHost+"/themes", path.join(this.dataPath, "themes.json"));
                            log("themes.json - success");
                        } catch (e) {
                            log(`themes.json - error - ${e}`);
                            this.addLoad("themes.json:"+e);
                        }
                        this.remLoad("themes.json");
                        await this.send("theme");
                    })(),
                    ...FEATURES.map(async name => {
                        let namefs;
                        const subhost = theHost+"/"+name.toLowerCase();
                        const sublog = (...a) => log(`[${name}]`, ...a);
                        namefs = {
                            PLANNER: async () => {
                                await Window.affirm(this, name);
                                sublog("solver");
                                this.addLoad(name+":solver");
                                try {
                                    if (await WindowManager.dirHas(path.join(__dirname, name.toLowerCase(), "solver")))
                                        await fs.promises.cp(
                                            path.join(__dirname, name.toLowerCase(), "solver"),
                                            path.join(Window.getDataPath(this, name), "solver"),
                                            { force: true, recursive: true },
                                        );
                                    sublog("solver - success");
                                } catch (e) {
                                    sublog(`solver - error - ${e}`);
                                    this.addLoad(name+":solver:"+e);
                                }
                                this.remLoad(name+":solver");
                            },
                        };
                        if (name in namefs) await namefs[name]();
                        sublog("search");
                        this.addLoad(name+":search");
                        try {
                            if (doFallback);
                            else {
                                let resp = await util.timeout(10000, fetch(subhost));
                                if (resp.status != 200) throw resp.status;
                            }
                        } catch (e) {
                            sublog(`search - not found - ${e}`);
                            this.remLoad(name+":search");
                            return;
                        }
                        sublog("search - found");
                        this.remLoad(name+":search");
                        namefs = {
                            PLANNER: async () => {
                                sublog("templates.json");
                                this.addLoad(name+":templates.json");
                                try {
                                    if (doFallback) await fs.promises.cp(
                                        path.join(__dirname, "assets", "fallback", "planner", "templates.json"),
                                        path.join(Window.getDataPath(this, name), "templates.json"),
                                        { recursive: true, force: true },
                                    );
                                    else await fetchAndPipe(subhost+"/templates", path.join(Window.getDataPath(this, name), "templates.json"));
                                    sublog("templates.json - success");
                                } catch (e) {
                                    sublog(`templates.json - error - ${e}`);
                                    this.addLoad(name+":templates.json:"+e);
                                }
                                this.remLoad(name+":templates.json");
                            },
                        };
                        if (name in namefs) await namefs[name]();
                    }),
                ]);
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

            const identify = e => {
                let win = this.identifyWindow(e.sender.id);
                if (!(win instanceof Window)) throw new Error("Nonexistent window corresponding with id: "+e.sender.id);
                return win;
            };
            
            ipc.handle("get-root", decorate(async (e, type) => {
                let win = identify(e);
                if (type == "app") return __dirname;
                if (type == "window") {
                    if (win.isModal) return path.join(__dirname, "modal", win.name.slice(6).toLowerCase());
                    return path.join(__dirname, win.name.toLowerCase());
                }
                if (type == "repo") return path.join(__dirname, "..");
                return null;
            }));

            ipc.handle("get", decorate(async (e, k) => await this.getCallback(e.sender.id, k)));
            ipc.handle("set", decorate(async (e, k, v) => await this.setCallback(e.sender.id, k, v)));

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

                let windows = await this.on("state-get", "windows");
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
                    await util.wait(2000);
                    const buildTree = async (pth, indent) => {
                        let dirents = await WindowManager.dirList(pth);
                        let tree = [];
                        for (let dirent of dirents) {
                            if (dirent.name[0] == ".") continue;
                            if (pth.endsWith("node_modules") && !["three", "ionicons"].includes(dirent.name)) continue;
                            if (pth.endsWith(path.join(__dirname, "..")) && ["build", "dist", "temp"].includes(dirent.name)) continue;
                            tree.push(new Array(indent).fill("| ").join("")+dirent.name);
                            if (dirent.type == "dir") tree.push(...(await buildTree(path.join(pth, dirent.name), indent+1)));
                        }
                        return tree;
                    };
                    showError("Info", null, (await buildTree(path.join(__dirname, ".."), 0)).join("\n"));
                });

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
                    windows[window.name] = {};
                    dfs(window.windowManager, windows[window.name]);
                });
            };
            dfs(this, windows);
            await this.on("state-set", "windows", windows);

            return await this.clearWindows();
        }

        get dataPath() {
            if (this.hasWindow()) return this.window.dataPath;
            return path.join(app.getPath("appData"), "PeninsulaPortal");
        }
        get root() { return this.dataPath; }
        set root(v) {}

        static async basicAffirm(dataPath) {
            let hasData = await this.dirHas(dataPath);
            if (!hasData) await this.dirMake(dataPath);
            return true;
        }
        static async affirm(dataPath) {
            await this.basicAffirm(dataPath);
            let hasLogDir = await this.dirHas([dataPath, "logs"]);
            if (!hasLogDir) await this.dirMake([dataPath, "logs"]);
            let hasDumpDir = await this.dirHas([dataPath, "dump"]);
            if (!hasDumpDir) await this.dirMake([dataPath, "dump"]);
            let hasTemplatesDir = await this.dirHas([dataPath, "templates"]);
            if (!hasTemplatesDir) await this.dirMake([dataPath, "templates"]);
            let hasTemplateImagesDir = await this.dirHas([dataPath, "templates", "images"]);
            if (!hasTemplateImagesDir) await this.dirMake([dataPath, "templates", "images"]);
            let hasTemplateModelsDir = await this.dirHas([dataPath, "templates", "models"]);
            if (!hasTemplateModelsDir) await this.dirMake([dataPath, "templates", "models"]);
            let hasRobotsDir = await this.dirHas([dataPath, "robots"]);
            if (!hasRobotsDir) await this.dirMake([dataPath, "robots"]);
            let hasRobotModelsDir = await this.dirHas([dataPath, "robots", "models"]);
            if (!hasRobotModelsDir) await this.dirMake([dataPath, "robots", "models"]);
            let hasHolidaysDir = await this.dirHas([dataPath, "holidays"]);
            if (!hasHolidaysDir) await this.dirMake([dataPath, "holidays"]);
            let hasHolidayIconsDir = await this.dirHas([dataPath, "holidays", "icons"]);
            if (!hasHolidayIconsDir) await this.dirMake([dataPath, "holidays", "icons"]);
            let hasConfig = await this.fileHas([dataPath, ".config"]);
            if (!hasConfig) await this.fileWrite([dataPath, ".config"], "");
            let hasClientConfig = await this.fileHas([dataPath, ".clientconfig"]);
            if (!hasClientConfig) await this.fileWrite([dataPath, ".clientconfig"], "");
            let hasVersion = await this.fileHas([dataPath, ".version"]);
            if (!hasVersion) await this.fileWrite([dataPath, ".version"], "");
            let hasState = await this.fileHas([dataPath, ".state"]);
            if (!hasState) await this.fileWrite([dataPath, ".state"], "");
            return true;
        }
        async affirm() {
            if (this.hasWindow())
                return (await this.window.manager.affirm()) && (await WindowManager.basicAffirm(this.dataPath));
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
            const l = (...a) => log(". get-cleanup - found: "+WindowManager.makePath(...a));
            const format = [
                //~/logs
                {
                    type: "dir", name: "logs",
                    children: [
                        //~/logs/*.log
                        {
                            type: "file",
                            match: [/\.log$/],
                        },
                    ],
                },
                //~/dump
                {
                    type: "dir", name: "dump",
                    children: [
                        //~/dump/*
                        { type: "file" },
                    ],
                },
                //~/templates
                {
                    type: "dir", name: "templates",
                    children: [
                        //~/templates/images
                        {
                            type: "dir", name: "images",
                            children: [
                                //~/templates/images/*.png
                                //~/templates/images/*.png-tmp
                                {
                                    type: "file",
                                    match: [/\.png$/, /\.png-tmp$/],
                                },
                            ],
                        },
                        //~/templates/models
                        {
                            type: "dir", name: "models",
                            children: [
                                //~/templates/models/*.glb
                                //~/templates/models/*.glb-tmp
                                {
                                    type: "file",
                                    match: [/\.glb$/, /\.glb-tmp$/],
                                }
                            ],
                        },
                        //~/templates/templates.json
                        { type: "file", name: "templates.json" }
                    ],
                },
                //~/robots
                {
                    type: "dir", name: "robots",
                    children: [
                        //~/robots/models
                        {
                            type: "dir", name: "models",
                            children: [
                                //~/robots/models/*.glb
                                //~/robots/models/*.glb-tmp
                                {
                                    type: "file",
                                    match: [/\.glb$/, /\.glb-tmp$/],
                                }
                            ],
                        },
                        //~/robots/robots.json
                        { type: "file", name: "robots.json" }
                    ],
                },
                //~/holidays
                {
                    type: "dir", name: "holidays",
                    children: [
                        //~/holidays/icons
                        {
                            type: "dir", name: "icons",
                            children: [
                                //~/holidays/icons/*.svg
                                //~/holidays/icons/*.png
                                //~/holidays/icons/*.ico
                                //~/holidays/icons/*.icns
                                //~/holidays/icons/*.svg-tmp
                                //~/holidays/icons/*.png-tmp
                                //~/holidays/icons/*.ico-tmp
                                //~/holidays/icons/*.icns-tmp
                                {
                                    type: "file",
                                    match: [
                                        /\.svg$/,
                                        /\.png$/,
                                        /\.ico$/,
                                        /\.icns$/,
                                        /\.svg-tmp$/,
                                        /\.png-tmp$/,
                                        /\.ico-tmp$/,
                                        /\.icns-tmp$/,
                                    ],
                                }
                            ],
                        },
                        //~/holidays/holidays.json
                        { type: "file", name: "holidays.json" }
                    ],
                },
                //~/<feature>
                {
                    type: "dir",
                    match: (_, name) => FEATURES.includes(name.toUpperCase()),
                },
                //~/panel
                {
                    type: "dir", name: "panel",
                    children: [
                        //~/panel/logs
                        {
                            type: "dir", name: "logs",
                            children: [
                                //~/panel/logs/*.wpilog
                                {
                                    type: "file",
                                    match: [/\.wpilog$/],
                                },
                            ],
                        },
                        //~/panel/videos
                        {
                            type: "dir", name: "videos",
                            children: [
                                //~/panel/videos/*.mp4
                                //~/panel/videos/*.mov
                                {
                                    type: "file",
                                    match: [/\.mp4$/, /\.mov$/],
                                },
                            ],
                        },
                        //~/panel/projects
                        {
                            type: "dir", name: "projects",
                            children: [
                                //~/panel/projects/*.json
                                {
                                    type: "file",
                                    match: [/\.json$/],
                                },
                            ],
                        },
                        //~/panel/projects.json
                        { type: "file", name: "projects.json" },
                    ],
                },
                //~/planner
                {
                    type: "dir", name: "planner",
                    children: [
                        //~/planner/projects
                        {
                            type: "dir", name: "projects",
                            children: [
                                //~/planner/projects/*.json
                                {
                                    type: "file",
                                    match: [/\.json$/],
                                },
                            ],
                        },
                        //~/planner/projects.json
                        { type: "file", name: "projects.json" },
                        //~/planner/templates.json
                        { type: "file", name: "templates.json" },
                        //~/planner/solver
                        { type: "dir", name: "solver" },
                    ],
                },
                //~/themes.json
                { type: "file", name: "themes.json" },
            ];
            let pths = [];
            const cleanup = async (pth, patterns) => {
                let dirents = await this.dirList(pth);
                await Promise.all(dirents.map(async dirent => {
                    if (dirent.name[0] == ".") return;
                    let any = false;
                    await Promise.all(patterns.map(async pattern => {
                        if (("type" in pattern) && (dirent.type != pattern.type)) return;
                        if (("name" in pattern) && (dirent.name != pattern.name)) return;
                        if ("match" in pattern) {
                            if (util.is(pattern.match, "func")) {
                                if (!pattern.match(dirent.type, dirent.name))
                                    return;
                            } else if (util.is(pattern.match, "arr")) {
                                if (!pattern.match.any(v => new RegExp(v).test(dirent.name)))
                                    return;
                            } else if (!new RegExp(pattern.match).test(dirent.name)) return;
                        }
                        any = true;
                        if (dirent.type != "dir") return;
                        if (!("children" in pattern)) return;
                        await cleanup([...pth, dirent.name], pattern.children);
                    }));
                    if (any) return;
                    l(...pth, dirent.name);
                    pths.push([pth, dirent.name]);
                }));
            };
            await cleanup([dataPath], format);
            return pths;
        }
        async getCleanup() {
            if (this.hasWindow()) return await this.window.manager.getCleanup();
            return await WindowManager.getCleanup(this.dataPath);
        }
        static async cleanup(dataPath, version) {
            version = String(version);
            log(". cleanup");
            const l = (...a) => log(". cleanup - delete: "+WindowManager.makePath(...a));
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
                l(...pth);
                try { return await this.dirDelete(pth); }
                catch (e) {}
                try { return await this.fileDelete(pth); }
                catch (e) {}
            }));
            return true;
        }
        async cleanup() {
            if (this.hasWindow()) return await this.window.manager.cleanup();
            return await WindowManager.cleanup(this.dataPath, await this.get("base-version"));
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
            if (!MODALS.includes(name)) return null;
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

        async get(k) { return await this.getThis(k); }
        async set(k, v) { return await this.setThis(k, v); }
        async on(k, ...a) { return await this.onThis(k, ...a); }

        async getCallback(id, k) {
            if (this.hasWindow()) return await this.window.manager.getCallback(id, k);
            let win = this.identifyWindow(id);
            if (!win) throw new Error("Nonexistent window corresponding with id: "+id);
            return await win.get(k);
        }
        async setCallback(id, k, v) {
            if (this.hasWindow()) return await this.window.manager.setCallback(id, k, v);
            let win = this.identifyWindow(id);
            if (!win) throw new Error("Nonexistent window corresponding with id: "+id);
            return await win.set(k, v);
        }
        async onCallback(id, k, ...a) {
            if (this.hasWindow()) return await this.window.manager.onCallback(id, k, ...a);
            let win = this.identifyWindow(id);
            if (!win) throw new Error("Nonexistent window corresponding with id: "+id);
            return await win.on(k, ...a);
        }

        async getThis(k) {
            if (this.hasWindow()) return await this.window.manager.getThis(k);
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
                "_fullthemes": async () => {
                    let content = "";
                    try {
                        content = await this.fileRead("themes.json");
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    return data;
                },
                "themes": async () => {
                    return util.ensure((await kfs._fullthemes()).themes, "obj");
                },
                "active-theme": async () => {
                    let active = (await kfs._fullthemes()).active;
                    let themes = await kfs.themes();
                    return (active in themes) ? active : null;
                },
                "_fulltemplates": async () => {
                    let content = "";
                    try {
                        content = await this.fileRead(["templates", "templates.json"]);
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    return data;
                },
                "templates": async () => {
                    return util.ensure((await kfs._fulltemplates()).templates, "obj");
                },
                "template-images": async () => {
                    let templates = await kfs.templates();
                    let images = {};
                    Object.keys(templates).map(name => (images[name] = path.join(this.dataPath, "templates", "images", name+".png")));
                    return images;
                },
                "template-models": async () => {
                    let templates = await kfs.templates();
                    let models = {};
                    Object.keys(templates).map(name => (models[name] = path.join(this.dataPath, "templates", "models", name+".glb")));
                    return models;
                },
                "active-template": async () => {
                    let active = (await kfs._fulltemplates()).active;
                    let templates = await kfs.templates();
                    return (active in templates) ? active : null;
                },
                "_fullrobots": async () => {
                    let content = "";
                    try {
                        content = await this.fileRead(["robots", "robots.json"]);
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    return data;
                },
                "robots": async () => {
                    return util.ensure((await kfs._fullrobots()).robots, "obj");
                },
                "robot-models": async () => {
                    let robots = await kfs.robots();
                    let models = {};
                    Object.keys(robots).map(name => (models[name] = path.join(this.dataPath, "robots", "models", name+".glb")));
                    return models;
                },
                "active-robot": async () => {
                    let active = (await kfs._fullrobots()).active;
                    let robots = await kfs.robots();
                    return (active in robots) ? active : null;
                },
                "_fullholidays": async () => {
                    let content = "";
                    try {
                        content = await this.fileRead(["holidays", "holidays.json"]);
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    return data;
                },
                "holidays": async () => {
                    return util.ensure((await kfs._fullholidays()).holidays, "obj");
                },
                "holiday-icons": async () => {
                    let holidays = await kfs.holidays();
                    let icons = {};
                    Object.keys(holidays).map(name => (icons[name] = {
                        svg: path.join(this.dataPath, "holidays", "icons", name+".svg"),
                        png: path.join(this.dataPath, "holidays", "icons", name+".png"),
                        ico: path.join(this.dataPath, "holidays", "icons", name+".ico"),
                        icns: path.join(this.dataPath, "holidays", "icons", name+".icns"),
                        hat1: path.join(this.dataPath, "holidays", "icons", name+"-hat-1.svg"),
                        hat2: path.join(this.dataPath, "holidays", "icons", name+"-hat-2.svg"),
                    }));
                    return icons;
                },
                "active-holiday": async () => {
                    let active = (await kfs._fullholidays()).active;
                    let holidays = await kfs.holidays();
                    if (await this.get("holiday-opt")) return null;
                    return (active in holidays) ? active : null;
                },
                "holiday": async () => await this.getThis("active-holiday"),
                "production": async () => {
                    return app.isPackaged;
                },
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
                "base-version": async () => {
                    return String((await kfs._fullpackage()).version);
                },
                "version": async () => {
                    return String((await kfs["base-version"]()) + ((await this.get("production")) ? "" : "-dev"));
                },
                "repo": async () => {
                    let repo = (await kfs._fullpackage()).repository;
                    return String(util.is(repo, "obj") ? repo.url : repo);
                },
                "_fullconfig": async () => {
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(".config");
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    return data;
                },
                "db-host": async () => {
                    let host = (await kfs._fullconfig()).dbHost;
                    return (host == null) ? null : String(host);
                },
                "assets-host": async () => {
                    return String((await kfs._fullconfig()).assetsHost);
                },
                "socket-host": async () => {
                    let host = (await kfs._fullconfig()).socketHost;
                    return (host == null) ? (await kfs["db-host"]()) : String(host);
                },
                "scout-url": async () => {
                    return String((await kfs._fullconfig()).scoutURL);
                },
                "_fullclientconfig": async () => {
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(".clientconfig");
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    return data;
                },
                "comp-mode": async () => {
                    return !!(await kfs._fullclientconfig()).isCompMode;
                },
                "theme": async () => {
                    let theme = (await kfs._fullclientconfig()).theme;
                    if (util.is(theme, "obj")) return theme;
                    return util.ensure(theme, "str", await kfs["active-theme"]());
                },
                "native-theme": async () => {
                    return util.ensure((await kfs._fullclientconfig()).nativeTheme, "str", "system");
                },
                "holiday-opt": async () => {
                    return !!(await kfs._fullclientconfig()).holidayOpt;
                },
                "dark-wanted": async () => electron.nativeTheme.shouldUseDarkColors,
                "cleanup": async () => await this.getCleanup(),
            };
            if (k in kfs) return await kfs[k]();
            throw new MissingError("Could not get for key: "+k);
        }
        async setThis(k, v) {
            if (this.hasWindow()) return await this.window.manager.setThis(k, v);
            k = String(k);
            let kfs = {
                "fs-version": async () => await this.setFSVersion(v),
                "_fullconfig": async (k=null, v=null) => {
                    if (k == null) return;
                    let content = "";
                    try {
                        content = await this.fileRead(".config");
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    data[k] = v;
                    content = JSON.stringify(data, null, "\t");
                    await this.fileWrite(".config", content);
                },
                "db-host": async () => await kfs._fullconfig("dbHost", (v == null) ? null : String(v)),
                "assets-host": async () => await kfs._fullconfig("assetsHost", String(v)),
                "socket-host": async () => await kfs._fullconfig("socketHost", (v == null) ? null : String(v)),
                "scout-url": async () => await kfs._fullconfig("scoutURL", (v == null) ? null : String(v)),
                "_fullclientconfig": async (k=null, v=null) => {
                    if (k == null) return;
                    let content = "";
                    try {
                        content = await this.fileRead(".clientconfig");
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    data[k] = v;
                    content = JSON.stringify(data, null, "\t");
                    await this.fileWrite(".clientconfig", content);
                },
                "comp-mode": async () => await kfs._fullclientconfig("isCompMode", !!v),
                "theme": async () => {
                    await kfs._fullclientconfig("theme", util.is(v, "obj") ? v : String(v));
                    await this.send("theme");
                },
                "native-theme": async () => {
                    await kfs._fullclientconfig("nativeTheme", String(v));
                    electron.nativeTheme.themeSource = await this.get("native-theme");
                },
                "holiday-opt": async () => {
                    await kfs._fullclientconfig("holidayOpt", !!v);
                },
            };
            if (k in kfs) return await kfs[k]();
            throw new MissingError("Could not set for key: "+k);
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
                "_state": async () => {
                    await this.affirm();
                    let content = "";
                    try {
                        content = await this.fileRead(".state");
                    } catch (e) {}
                    let state = null;
                    try {
                        state = JSON.parse(content);
                    } catch (e) {}
                    state = util.ensure(state, "obj");
                    return state;
                },
                "state-get": async k => {
                    k = String(k);
                    let state = await kfs._state();
                    return state[k];
                },
                "state-set": async (k, v) => {
                    k = String(k);
                    let state = await kfs._state();
                    state[k] = v;
                    await this.fileWrite(".state", JSON.stringify(state, null, "\t"));
                    return v;
                },
                "state-del": async k => {
                    k = String(k);
                    let state = await kfs._state();
                    let v = state[k];
                    delete state[k];
                    await this.fileWrite(".state", JSON.stringify(state, null, "\t"));
                    return v;
                },
                "open": async url => await electron.shell.openExternal(url),
                "cleanup": async () => await this.cleanup(),
                "try-load": async () => await this.tryLoad(),
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

    log("< DATAPATH = "+manager.root+" >");

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
