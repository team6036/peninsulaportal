"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

let context = {};

/*

   ______   ______   _______   __   _______   ______   ___  __   __      _______
  / ______\/ ______\/ _______\/ __\/ _______\/ ______\/ __\/\__\/ __\   / _______\
 / /  __  / /  __  / /  _    / /  / /  _    /\/  ____/ /  / /  / /  /  / /  __   /
/ /  ____/ /  ____/ /  / /  / /  / /  / /  /\_\___ \/ /  /_/  / /  /_\/ /  __   /
\/__/    \/______/\/__/\/__/\/__/\/__/\/__/\/______/\/_______/\/_____/\/__/\/__/

Welcome to Peninsula Portal!

Developed by FRC 6036

*/

const MAIN = async () => {

    const log = (...a) => {
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
        return console.log(`${yr}-${mon}-${d} ${hr}:${min}:${s}.${ms}`, ...a);
    };

    log("< IMPORTING ASYNCHRONOUSLY >");

    const util = await import("./util.mjs");
    const V = util.V;

    log("< IMPORTED ASYNCHRONOUSLY >");

    const os = require("os");

    const path = require("path");
    const fs = require("fs");

    const cp = require("child_process");

    const electron = require("electron");
    const showError = context.showError = (name, e) => electron.dialog.showErrorBox(String(name), String(e));
    const app = context.app = electron.app;
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

    const OS = {
        arch: os.arch(),
        platform: os.platform(),
        cpus: os.cpus(),
        user: os.userInfo(),
    };

    function simplify(s) {
        s = String(s);
        if (s.length > 20) s = s.substring(0, 20)+"...";
        return s;
    }

    const FEATURES = ["PORTAL", "PANEL", "PLANNER", "PRESETS"];

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

            this.#process = (mode == "exec") ? cp.exec(...a) : (mode == "execFile") ? cp.execFile(...a) : (mode == "fork") ? cp.fork(...a) : (mode == "spawn") ? cp.spawn(...a) : null;
            if (!(this.process instanceof cp.ChildProcess)) throw "Invalid mode: "+mode;
            this.process.stdout.on("data", data => this.post("data", data));
            this.process.stderr.on("data", data => {
                this.post("error", String(data));
                this.terminate();
            });
            this.process.on("exit", code => this.post("exit", code));
            this.process.on("error", e => {
                this.post("error", String(e));
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
            v.forEach(v => this.addTag(v));
        }
        clearTags() {
            let tags = this.tags;
            tags.forEach(tag => this.remTag(tag));
            return tags;
        }
        hasTag(tag) {
            return this.#tags.has(tag);
        }
        addTag(tag) {
            this.#tags.add(tag);
            return true;
        }
        remTag(tag) {
            this.#tags.delete(tag);
            return true;
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
        hasParent() { return this.parent instanceof ProcessManager; }

        get process() { return this.#process; }

        async terminate() {
            if (this.process.exitCode != null) return false;
            this.process.kill("SIGKILL");
            await this.post("exit", null);
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
            v.forEach(v => this.addProcess(v));
        }
        clearProcesses() {
            let processes = this.processes;
            processes.forEach(process => this.remProcess(process));
            return processes;
        }
        hasProcess(process) {
            if (!(process instanceof Process)) return false;
            return this.#processes.has(process) && process.parent == this;
        }
        addProcess(process) {
            if (!(process instanceof Process)) return false;
            if (this.hasProcess(process)) return false;
            this.#processes.add(process);
            process.parent = this;
            return process;
        }
        remProcess(process) {
            if (!(process instanceof Process)) return false;
            if (!this.hasProcess(process)) return false;
            this.#processes.delete(process);
            process.parent = null;
            return process;
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
                results.push(...(await this.post("msg", name, payload, meta)));
                results.push(...(await this.post("msg-"+name, payload, meta)));
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
                results.push(...(await this.post("stream", name, fname, payload, meta, ssStream)));
                results.push(...(await this.post("stream-"+name, fname, payload, meta, ssStream)));
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
            v.forEach(v => this.addTag(v));
        }
        clearTags() {
            let tags = this.tags;
            tags.forEach(tag => this.remTag(tag));
            return tags;
        }
        hasTag(tag) {
            return this.#tags.has(tag);
        }
        addTag(tag) {
            this.#tags.add(tag);
            return true;
        }
        remTag(tag) {
            this.#tags.delete(tag);
            return true;
        }

        get location() { return this.#location; }

        get connected() { return this.#socket.connected; }
        get socketId() { return this.#socket.id; }

        connect() { this.#socket.connect(); }
        disconnect() { this.#socket.disconnect(); }

        #parseResponse(res, rej, response) {
            response = util.ensure(response, "obj");
            const serverTs = util.ensure(response.ts, "num");
            const clientTs = util.getTime();
            // console.log(`INC:latency ${clientTs-serverTs}ms\n\tclient: ${clientTs}\n\tserver: ${serverTs}`);
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
            pth = Portal.makePath(pth);
            if (!Portal.fileHas(pth)) return null;
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
            v.forEach(v => this.addClient(v));
        }
        clearClients() {
            let clients = this.clients;
            clients.forEach(client => this.remClient(client));
            return clients;
        }
        hasClient(client) {
            if (!(client instanceof Client)) return false;
            return this.#clients.has(client);
        }
        addClient(client) {
            if (!(client instanceof Client)) return false;
            if (this.hasClient(client)) return false;
            this.#clients.add(client);
            return client;
        }
        remClient(client) {
            if (!(client instanceof Client)) return false;
            if (!this.hasClient(client)) return false;
            this.#clients.delete(client);
            return client;
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
    class TbaClient extends util.Target {
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
            v.forEach(v => this.addTag(v));
        }
        clearTags() {
            let tags = this.tags;
            tags.forEach(tag => this.remTag(tag));
            return tags;
        }
        hasTag(tag) {
            return this.#tags.has(tag);
        }
        addTag(tag) {
            this.#tags.add(tag);
            return true;
        }
        remTag(tag) {
            this.#tags.delete(tag);
            return true;
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
            if (ref.length != 2) throw "Invalid invocation (split length) ("+invoke+")";
            let [api, f] = ref;
            if (!api.endsWith("API")) throw "Invalid invocation (api name) ("+invoke+")";
            if (!(api in this)) throw "Invalid invocation (api existence) ("+invoke+")";
            api = this[api];
            if (!(f in api)) throw "Invalid invocation (method existence) ("+invoke+")";
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
    class TbaClientManager extends util.Target {
        #clients;

        constructor() {
            super();

            this.#clients = new Set();
        }

        get clients() { return [...this.#clients]; }
        set clients(v) {
            v = util.ensure(v, "arr");
            this.clearClients();
            v.forEach(v => this.addClient(v));
        }
        clearClients() {
            let clients = this.clients;
            clients.forEach(client => this.remClient(client));
            return clients;
        }
        hasClient(client) {
            if (!(client instanceof TbaClient)) return false;
            return this.#clients.has(client);
        }
        addClient(client) {
            if (!(client instanceof TbaClient)) return false;
            if (this.hasClient(client)) return false;
            this.#clients.add(client);
            return client;
        }
        remClient(client) {
            if (!(client instanceof TbaClient)) return false;
            if (!this.hasClient(client)) return false;
            this.#clients.delete(client);
            return client;
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
    const makeMenuDefault = (name, aboutCallback, settingsCallback) => {
        name = String(name);
        aboutCallback = util.ensure(aboutCallback, "func");
        settingsCallback = util.ensure(settingsCallback, "func");
        return [
            {
                label: (name.length > 0) ? util.capitalize(name) : "Portal",
                submenu: [
                    {
                        label: (name.length > 0) ? ("About Peninsula "+util.capitalize(name)) : "About Peninsula",
                        click: () => aboutCallback(),
                    },
                    { type: "separator" },
                    {
                        label: "Settings",
                        accelerator: "CmdOrCtrl+,",
                        click: () => settingsCallback(),
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
    class Portal extends util.Target {
        #started;

        #stream;

        #processManager;
        #clientManager;
        #tbaClientManager;

        #features;

        #loads;
        #isLoading;

        constructor() {
            super();

            this.#started = false;

            this.#stream = null;

            this.#processManager = new ProcessManager();
            this.#clientManager = new ClientManager();
            this.#tbaClientManager = new TbaClientManager();

            this.#features = new Set();

            this.#loads = new Set();
            this.#isLoading = false;
        }

        async init() {
            try {
                await this.affirm();
            } catch (e) {
                showError("Portal Initialize - Affirmation Error", e);
                return;
            }
            let version = await this.get("base-version");
            if (!(await this.canFS(version))) {
                let fsVersion = await this.get("fs-version");
                showError("Portal Initialize - Version Error", "Cannot operate file system due to deprecated application version ("+version+" < "+fsVersion+")");
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
            app.dock.setMenu(electron.Menu.buildFromTemplate([
                {
                    label: "Features...",
                    submenu: [
                        {
                            label: "Panel",
                            accelerator: "CmdOrCtrl+1",
                            click: () => this.on("spawn", "PANEL"),
                        },
                        {
                            label: "Planner",
                            accelerator: "CmdOrCtrl+2",
                            click: () => this.on("spawn", "PLANNER"),
                        },
                    ],
                },
            ]));
            electron.nativeTheme.on("updated", () => this.send("native-theme"));
            electron.nativeTheme.themeSource = await this.get("native-theme");
            return true;
        }
        async quit() {}

        get stream() { return this.#stream; }
        hasStream() { return this.stream instanceof fs.WriteStream; }

        get processManager() { return this.#processManager; }
        get clientManager() { return this.#clientManager; }
        get tbaClientManager() { return this.#tbaClientManager; }

        get features() { return [...this.#features]; }
        set features(v) {
            v = util.ensure(v, "arr");
            (async () => {
                await this.clearFeatures();
                v.forEach(v => this.addFeature(v));
            })();
        }
        async clearFeatures() {
            let feats = this.features;
            await Promise.all(feats.map(async feat => await this.remFeature(feat)));
            return feats;
        }
        hasFeature(feat) {
            if (!(feat instanceof Portal.Feature)) return false;
            return this.#features.has(feat) && feat.portal == this;
        }
        addFeature(feat) {
            if (!(feat instanceof Portal.Feature)) return false;
            if (feat.portal != this) return false;
            if (this.hasFeature(feat)) return false;
            this.#features.add(feat);
            try {
                feat.start();
            } catch (e) {
                this.#features.delete(feat);
                showError("Feature Start Error", e);
                return false;
            }
            this.change("addFeature", null, feat);
            this.checkMenu();
            return feat;
        }
        async remFeature(feat) {
            if (!(feat instanceof Portal.Feature)) return false;
            if (feat.portal != this) return false;
            if (!this.hasFeature(feat)) return false;
            feat.log("REM");
            if (feat.started) {
                try {
                    return await feat.stop();
                } catch (e) {
                    this.#features.delete(feat);
                    this.change("remFeature", feat, null);
                    showError("Feature Stop Error", e);
                    return;
                }
            }
            feat.log("REM - already stopped");
            this.#features.delete(feat);
            this.change("remFeature", feat, null);
            this.checkMenu();
            return feat;
        }

        checkMenu() {
            electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(makeMenuDefault("")));
            let window = electron.BrowserWindow.getFocusedWindow();
            for (let feat of this.features) {
                if (!feat.hasWindow()) continue;
                let menu = feat.hasMenu() ? feat.menu : electron.Menu.buildFromTemplate(makeMenuDefault(feat.name));
                feat.window.setMenu(menu);
                if (feat.window != window) continue;
                electron.Menu.setApplicationMenu(menu);
            }
        }

        get loads() { return [...this.#loads]; }
        set loads(v) {
            v = util.ensure(v, "arr");
            this.clearLoads();
            v.forEach(v => this.addLoad(v));
        }
        clearLoads() {
            let loads = this.loads;
            loads.forEach(load => this.remLoad(load));
            return loads;
        }
        hasLoad(load) {
            load = String(load);
            return this.#loads.has(load);
        }
        addLoad(load) {
            load = String(load);
            if (this.hasLoad(load)) return false;
            this.#loads.add(load);
            this.change("addLoad", null, load);
            return true;
        }
        remLoad(load) {
            load = String(load);
            if (!this.hasLoad(load)) return false;
            this.#loads.delete(load);
            this.change("remLoad", load, null);
            return true;
        }
        get isLoading() { return this.#isLoading; }
        async tryLoad() {
            if (this.isLoading) return false;
            let version = await this.get("base-version");
            this.#isLoading = true;
            let r = await (async () => {
                try {
                    await this.affirm();
                } catch (e) {
                    showError("Load - Affirmation Error", e);
                    return false;
                }
                this.clearLoads();
                let fsVersion = await this.get("fs-version");
                this.log(`DB fs-version check (${version} ?>= ${fsVersion})`);
                this.addLoad("fs-version");
                if (!(await this.canFS(version))) {
                    this.log(`DB fs-version mismatch (${version} !>= ${fsVersion})`);
                    this.remLoad("fs-version");
                    this.addLoad("fs-version:"+version+" < "+fsVersion);
                    return false;
                }
                this.log(`DB fs-version match (${version} >= ${fsVersion})`);
                this.remLoad("fs-version");
                await this.set("fs-version", version);
                this.log("DB finding host");
                this.addLoad("find");
                const host = (await this.get("db-host")) || "https://peninsula-db.jfancode.repl.co";
                const assetsHost = String(await this.get("assets-host"));
                const isCompMode = await this.get("val-comp-mode");
                this.remLoad("find");
                this.log("DB poll");
                this.log(`DB ^ host: ${host}`);
                this.log(`DB ^ assetsHost: ${assetsHost}`);
                if (isCompMode) {
                    this.log(`DB poll - SKIP (COMP MODE)`);
                    this.addLoad("comp-mode");
                    return true;
                }
                this.log(`DB polling`);
                this.addLoad("poll");
                try {
                    await util.timeout(10000, fetch(host));
                } catch (e) {
                    this.log(`DB polling - fail`);
                    this.remLoad("poll");
                    this.addLoad("poll:"+e);
                    return false;
                }
                this.log(`DB polling - success`);
                this.remLoad("poll");
                const fetchAndPipe = async (url, pth) => {
                    this.log(`DB :: f&p(${url})`);
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
                this.log("DB config");
                this.addLoad("config");
                try {
                    await fetchAndPipe(host+"/config.json", path.join(this.dataPath, ".config"));
                    this.log("DB config - success");
                } catch (e) {
                    this.log(`DB config - error - ${e}`);
                    this.addLoad("config:"+e);
                }
                this.remLoad("config");
                this.log("DB finding next host");
                this.addLoad("find-next");
                const nextHost = (await this.get("db-host")) || "https://peninsula-db.jfancode.repl.co";
                this.remLoad("find-next");
                if (nextHost != host) {
                    this.log("DB next host and current host mismatch - retrying");
                    this.#isLoading = false;
                    return await this.tryLoad(version);
                }
                this.log("DB next host and current host match - continuing");
                await Promise.all([
                    (async () => {
                        this.log("DB templates.json");
                        this.addLoad("templates.json");
                        try {
                            await fetchAndPipe(host+"/templates.json", path.join(this.dataPath, "templates", "templates.json"));
                            this.log("DB templates.json - success");
                        } catch (e) {
                            this.log(`DB templates.json - error - ${e}`);
                            this.addLoad("templates.json:"+e);
                        }
                        this.remLoad("templates.json");
                        this.log("DB checking templates.json");
                        let content = await this.fileRead(["templates", "templates.json"]);
                        let data = null;
                        try {
                            data = JSON.parse(content);
                            this.log("DB checking templates.json - success");
                        } catch (e) {
                            log(`DB checking templates.json - error - ${e}`);
                        }
                        data = util.ensure(data, "obj");
                        let templates = util.ensure(data.templates, "obj");
                        await Promise.all(Object.keys(templates).map(async name => {
                            name = String(name);
                            await Promise.all(["images", "models"].map(async section => {
                                let tag = { "images": "png", "models": "glb" }[section];
                                this.log(`DB templates/${name}.${tag}`);
                                this.addLoad(`templates/${name}.${tag}`);
                                try {
                                    await fetchAndPipe(assetsHost+"/templates."+name+"."+tag, path.join(this.dataPath, "templates", section, name+"."+tag));
                                    this.log(`DB templates/${name}.${tag} - success`);
                                } catch (e) {
                                    this.log(`DB templates/${name}.${tag} - error - ${e}`);
                                    this.addLoad(`templates/${name}.${tag}:`+e);
                                }
                                this.remLoad(`templates/${name}.${tag}`);
                            }));
                        }));
                    })(),
                    (async () => {
                        this.log("DB robots.json");
                        this.addLoad("robots.json");
                        try {
                            await fetchAndPipe(host+"/robots.json", path.join(this.dataPath, "robots", "robots.json"));
                            this.log("DB robots.json - success");
                        } catch (e) {
                            this.log(`DB robots.json - error - ${e}`);
                            this.addLoad("robots.json:"+e);
                        }
                        this.remLoad("robots.json");
                        this.log("DB checking robots.json");
                        let content = await this.fileRead(["robots", "robots.json"]);
                        let data = null;
                        try {
                            data = JSON.parse(content);
                            this.log("DB checking robots.json - success");
                        } catch (e) {
                            log(`DB checking robots.json - error - ${e}`);
                        }
                        data = util.ensure(data, "obj");
                        let robots = util.ensure(data.robots, "obj");
                        await Promise.all(Object.keys(robots).map(async name => {
                            name = String(name);
                            await Promise.all(["models"].map(async section => {
                                let tag = { "models": "glb" }[section];
                                this.log(`DB robots/${name}.${tag}`);
                                this.addLoad(`robots/${name}.${tag}`);
                                try {
                                    await fetchAndPipe(assetsHost+"/robots."+name+"."+tag, path.join(this.dataPath, "robots", section, name+"."+tag));
                                    this.log(`DB robots/${name}.${tag} - success`);
                                } catch (e) {
                                    this.log(`DB robots/${name}.${tag} - error - ${e}`);
                                    this.addLoad(`robots/${name}.${tag}:`+e);
                                }
                                this.remLoad(`robots/${name}.${tag}`);
                            }));
                        }));
                    })(),
                    (async () => {
                        this.log("DB holidays.json");
                        this.addLoad("holidays.json");
                        try {
                            await fetchAndPipe(host+"/holidays.json", path.join(this.dataPath, "holidays", "holidays.json"));
                            this.log("DB holidays.json - success");
                        } catch (e) {
                            this.log(`DB holidays.json - error - ${e}`);
                            this.addLoad("holidays.json:"+e);
                        }
                        this.remLoad("holidays.json");
                        this.log("DB checking holidays.json");
                        let content = await this.fileRead(["holidays", "holidays.json"]);
                        let data = null;
                        try {
                            data = JSON.parse(content);
                            this.log("DB checking holidays.json - success");
                        } catch (e) {
                            log(`DB checking holidays.json - error - ${e}`);
                        }
                        data = util.ensure(data, "obj");
                        let holidays = util.ensure(data.holidays, "obj");
                        await Promise.all(Object.keys(holidays).map(async name => {
                            name = String(name);
                            await Promise.all([
                                "svg", "png", // "ico", "icns",
                                "hat1", "hat2",
                            ].map(async tag => {
                                let pth = name+((tag == "hat1") ? "-hat-1.svg" : (tag == "hat2") ? "-hat-2.svg" : "."+tag);
                                this.log(`DB holidays/${pth}`);
                                this.addLoad(`holidays/${pth}`);
                                try {
                                    await fetchAndPipe(assetsHost+"/holidays."+pth, path.join(this.dataPath, "holidays", "icons", pth));
                                    this.log(`DB holidays/${pth} - success`);
                                } catch (e) {
                                    this.log(`DB holidays/${pth} - error - ${e}`);
                                    this.addLoad(`holidays/${pth}:`+e);
                                }
                                this.remLoad(`holidays/${pth}`);
                            }));
                        }));
                        await Promise.all(Object.keys(holidays).map(async name => {
                            name = String(name);
                            let input = await fs.promises.readFile(path.join(this.dataPath, "holidays", "icons", name+".png"));
                            await Promise.all([
                                "ico", "icns",
                            ].map(async tag => {
                                let pth = name+"."+tag;
                                this.log(`DB holidays/${pth} conversion`);
                                this.addLoad(`holidays/${pth}-conv`);
                                try {
                                    let output = {
                                        ico: () => png2icons.createICO(input, png2icons.BILINEAR, 0, true, true),
                                        icns: () => png2icons.createICNS(input, png2icons.BILINEAR, 0),
                                    }[tag]();
                                    await fs.promises.writeFile(path.join(this.dataPath, "holidays", "icons", pth), output);
                                    this.log(`DB holidays/${pth} conversion - success`);
                                } catch (e) {
                                    this.log(`DB holidays/${pth} conversion - error - ${e}`);
                                    this.addLoad(`holidays/${pth}-conv:`+e);
                                }
                                this.remLoad(`holidays/${pth}-conv`);
                            }));
                        }));
                    })(),
                    (async () => {
                        this.log("DB themes.json");
                        this.addLoad("themes.json");
                        try {
                            await fetchAndPipe(host+"/themes.json", path.join(this.dataPath, "themes.json"));
                            this.log("DB themes.json - success");
                        } catch (e) {
                            this.log(`DB themes.json - error - ${e}`);
                            this.addLoad("themes.json:"+e);
                        }
                        this.remLoad("themes.json");
                        await this.send("theme");
                    })(),
                    ...FEATURES.map(async name => {
                        const subhost = host+"/"+name.toLowerCase();
                        const log = (...a) => this.log(`DB [${name}]`, ...a);
                        log("search");
                        this.addLoad(name+":search");
                        try {
                            let resp = await util.timeout(10000, fetch(subhost+"/confirm.txt"));
                            if (resp.status != 200) throw resp.status;
                        } catch (e) {
                            log(`search - not found - ${e}`);
                            this.remLoad(name+":search");
                            return;
                        }
                        log("search - found");
                        this.remLoad(name+":search");
                        let namefs = {
                            PLANNER: async () => {
                                await Portal.Feature.affirm(this, name);
                                await Promise.all([
                                    async () => {
                                        log("solver");
                                        this.addLoad(name+":solver");
                                        try {
                                            if (await Portal.dirHas(path.join(__dirname, name.toLowerCase(), "solver")))
                                                await fs.promises.cp(
                                                    path.join(__dirname, name.toLowerCase(), "solver"),
                                                    path.join(Portal.Feature.getDataPath(this, name), "solver"),
                                                    {
                                                        force: true,
                                                        recursive: true,
                                                    },
                                                );
                                            log("solver - success");
                                        } catch (e) {
                                            log(`solver - error - ${e}`);
                                            this.addLoad(name+":solver:"+e);
                                        }
                                        this.remLoad(name+":solver");
                                    },
                                    async () => {
                                        log("templates.json");
                                        this.addLoad(name+":templates.json");
                                        try {
                                            await fetchAndPipe(subhost+"/templates.json", path.join(Portal.Feature.getDataPath(this, name), "templates.json"));
                                            log("templates.json - success");
                                        } catch (e) {
                                            log(`templates.json - error - ${e}`);
                                            this.addLoad(name+":templates.json:"+e);
                                        }
                                        this.remLoad(name+":templates.json");
                                    },
                                ].map(f => f()));
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

        get started() { return this.#started; }
        start() {
            if (this.started) {
                for (let feat of this.features) {
                    if (!feat.hasWindow()) continue;
                    if (!feat.window.isVisible()) continue;
                    feat.window.focus();
                    break;
                }
                return false;
            }
            this.#started = true;

            this.log("START");

            ipc.handle("os", async () => {
                return OS;
            });

            const identify = e => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return feat;
            };

            ipc.handle("get-root", async (e, type) => {
                let feat = identify(e);
                if (type == "app") return __dirname;
                if (type == "feature") return path.join(__dirname, feat.name.toLowerCase());
                if (type == "repo") return path.join(__dirname, "..");
                return null;
            });

            ipc.handle("get", async (e, k) => await this.getCallback(e.sender.id, k));
            ipc.handle("set", async (e, k, v) => await this.setCallback(e.sender.id, k, v));

            ipc.handle("on", async (e, k, ...a) => {
                return await this.onCallback(e.sender.id, k, ...a);
            });

            ipc.handle("file-has", async (e, pth) => {
                let feat = identify(e);
                return await feat.fileHas(pth);
            });
            ipc.handle("file-read", async (e, pth) => {
                let feat = identify(e);
                return await feat.fileRead(pth);
            });
            ipc.handle("file-read-raw", async (e, pth) => {
                let feat = identify(e);
                return await feat.fileReadRaw(pth);
            });
            ipc.handle("file-write", async (e, pth, content) => {
                let feat = identify(e);
                return await feat.fileWrite(pth, content);
            });
            ipc.handle("file-write-raw", async (e, pth, content) => {
                let feat = identify(e);
                return await feat.fileWriteRaw(pth, content);
            });
            ipc.handle("file-append", async (e, pth, content) => {
                let feat = identify(e);
                return await feat.fileAppend(pth, content);
            });
            ipc.handle("file-delete", async (e, pth) => {
                let feat = identify(e);
                return await feat.fileDelete(pth);
            });

            ipc.handle("dir-has", async (e, pth) => {
                let feat = identify(e);
                return await feat.dirHas(pth);
            });
            ipc.handle("dir-list", async (e, pth) => {
                let feat = identify(e);
                return await feat.dirList(pth);
            });
            ipc.handle("dir-make", async (e, pth) => {
                let feat = identify(e);
                return await feat.dirMake(pth);
            });
            ipc.handle("dir-delete", async (e, pth) => {
                let feat = identify(e);
                return await feat.dirDelete(pth);
            });

            ipc.handle("client-make", async (e, id, location) => {
                let feat = identify(e);
                return await feat.clientMake(id, location);
            });
            ipc.handle("client-destroy", async (e, id) => {
                let feat = identify(e);
                return await feat.clientDestroy(id);
            });
            ipc.handle("client-has", async (e, id) => {
                let feat = identify(e);
                return await feat.clientHas(id);
            });
            ipc.handle("client-conn", async (e, id) => {
                let feat = identify(e);
                return await feat.clientConn(id);
            });
            ipc.handle("client-disconn", async (e, id) => {
                let feat = identify(e);
                return await feat.clientDisconn(id);
            });
            ipc.handle("client-emit", async (e, id, name, payload) => {
                let feat = identify(e);
                return await feat.clientEmit(id, name, payload);
            });
            ipc.handle("client-stream", async (e, id, pth, name, payload) => {
                let feat = identify(e);
                return await feat.clientStream(id, pth, name, payload);
            });

            ipc.handle("tba-client-make", async (e, id) => {
                let feat = identify(e);
                return await feat.tbaClientMake(id);
            });
            ipc.handle("tba-client-destroy", async (e, id) => {
                let feat = identify(e);
                return await feat.tbaClientDestroy(id);
            });
            ipc.handle("tba-client-has", async (e, id) => {
                let feat = identify(e);
                return await feat.tbaClientHas(id);
            });
            ipc.handle("tba-client-invoke", async (e, id, invoke, ...a) => {
                let feat = identify(e);
                return await feat.tbaClientInvoke(id, invoke, ...a);
            });

            (async () => {
                try {
                    await this.affirm();
                } catch (e) {
                    showError("Portal Start Error - Affirmation Error", e);
                    return;
                }
                try {
                    await this.post("start");
                } catch (e) {
                    showError("Portal Start Error - 'start' event", e);
                    return;
                }

                let feats = util.ensure(await this.on("state-get", "features"), "arr");
                feats.forEach(name => {
                    let feat = null;
                    try {
                        feat = new Portal.Feature(this, name);
                    } catch (e) { return showError("Portal Start Error - Feature:"+name, e); }
                    this.addFeature(feat);
                });

                if (this.features.length <= 0) this.addFeature(new Portal.Feature(this, "PORTAL"));
                
                try {
                    await this.tryLoad();
                } catch (e) { showError("Portal Start Error - Load Error", e); }
            })();

            return true;
        }
        async stop() {
            this.log("STOP");
            await Promise.all(this.processManager.processes.map(async process => await process.terminate()));
            await Promise.all(this.clientManager.clients.map(async client => await this.clientDestroy(client)));
            await Promise.all(this.tbaClientManager.clients.map(async client => await this.tbaClientDestroy(client)));
            try {
                await this.post("stop");
            } catch (e) {
                showError("Portal Stop Error - 'stop' event", e);
                return true;
            }
            let feats = this.features;
            let all = true;
            await Promise.all(feats.map(async feat => {
                let r = await this.remFeature(feat);
                all &&= !!r;
            }));
            feats = feats.map(feat => feat.name);
            await this.on("state-set", "features", feats);
            return all;
        }

        get dataPath() { return path.join(app.getPath("appData"), "PeninsulaPortal"); }

        static async affirm(dataPath) {
            let hasAppData = await this.dirHas(dataPath);
            if (!hasAppData) await this.dirMake(dataPath);
            let hasLogDir = await this.dirHas([dataPath, "logs"]);
            if (!hasLogDir) await this.dirMake([dataPath, "logs"]);
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
            if (!hasConfig) await this.fileWrite([dataPath, ".config"], JSON.stringify({}, null, "\t"));
            let hasClientConfig = await this.fileHas([dataPath, ".clientconfig"]);
            if (!hasClientConfig) await this.fileWrite([dataPath, ".clientconfig"], JSON.stringify({}, null, "\t"));
            let hasVersion = await this.fileHas([dataPath, ".version"]);
            if (!hasVersion) await this.fileWrite([dataPath, ".version"], "");
            let hasState = await this.fileHas([dataPath, ".state"]);
            if (!hasState) await this.fileWrite([dataPath, ".state"], "");
            return true;
        }
        async affirm() {
            let r = await Portal.affirm(this.dataPath);
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
                this.#stream = fs.createWriteStream(Portal.makePath(this.dataPath, "logs", name));
                await new Promise((res, rej) => this.stream.on("open", () => res()));
            }
            return r;
        }
        static async getCleanup(dataPath) {
            log(". get-cleanup");
            const l = (...a) => log(". get-cleanup - found: "+Portal.makePath(...a));
            const format = [
                //~/logs
                {
                    type: "dir", name: "logs",
                    children: [
                        //~/logs/*.log
                        { type: "file", match: (_, name) => name.endsWith(".log") },
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
                                { type: "file", match: (_, name) => (name.endsWith(".png") || name.endsWith(".png-tmp")) },
                            ],
                        },
                        //~/templates/models
                        {
                            type: "dir", name: "models",
                            children: [
                                //~/templates/models/*.glb
                                //~/templates/models/*.glb-tmp
                                { type: "file", match: (_, name) => (name.endsWith(".glb") || name.endsWith(".glb-tmp")) }
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
                                { type: "file", match: (_, name) => (name.endsWith(".glb") || name.endsWith(".glb-tmp")) }
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
                                { type: "file", match: (_, name) => (
                                    name.endsWith(".svg") ||
                                    name.endsWith(".png") ||
                                    name.endsWith(".ico") ||
                                    name.endsWith(".icns") ||
                                    name.endsWith(".svg-tmp") ||
                                    name.endsWith(".png-tmp") ||
                                    name.endsWith(".ico-tmp") ||
                                    name.endsWith(".icns-tmp")
                                ) }
                            ],
                        },
                        //~/holidays/holidays.json
                        { type: "file", name: "holidays.json" }
                    ],
                },
                //~/<feature>
                { type: "dir", match: (_, name) => FEATURES.includes(name.toUpperCase()) },
                //~/panel
                {
                    type: "dir", name: "panel",
                    children: [
                        //~/panel/logs
                        {
                            type: "dir", name: "logs",
                            children: [
                                //~/panel/logs/*.wpilog
                                { type: "file", match: (_, name) => name.endsWith(".wpilog") },
                            ],
                        },
                        //~/panel/projects
                        {
                            type: "dir", name: "projects",
                            children: [
                                //~/panel/projects/*.json
                                { type: "file", match: (_, name) => name.endsWith(".json") },
                            ],
                        },
                        //~/panel/projects.json
                        { type: "file", name: "projects.json" },
                        //~/panel/projects.meta.json
                        { type: "file", name: "projects.meta.json" },
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
                                { type: "file", match: (_, name) => name.endsWith(".json") },
                            ],
                        },
                        //~/planner/projects.json
                        { type: "file", name: "projects.json" },
                        //~/panel/projects.meta.json
                        { type: "file", name: "projects.meta.json" },
                        //~/planner/templates.json
                        { type: "file", name: "templates.json" },
                        //~/planner/solver
                        { type: "dir", name: "solver" },
                    ],
                },
                //~/themes.json
                { type: "file", name: "themes.json" }
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
                        if (("match" in pattern) && !pattern.match(dirent.type, dirent.name)) return;
                        any = true;
                        if (("children" in pattern) && (dirent.type == "dir"))
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
        async getCleanup() { return await Portal.getCleanup(this.dataPath); }
        static async cleanup(dataPath, version) {
            version = String(version);
            log(". cleanup");
            const l = (...a) => log(". cleanup - delete: "+Portal.makePath(...a));
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
        async cleanup() { return await Portal.cleanup(this.dataPath, await this.get("base-version")); }

        static makePath(...pth) {
            return path.join(...pth.flatten());
        }
        static async fileHas(pth) {
            pth = this.makePath(pth);
            this.fsLog(`fs:file-has ${pth}`);
            try {
                await fs.promises.access(pth);
                return true;
            } catch (e) {}
            return false;
        }
        static async fileRead(pth) {
            pth = this.makePath(pth);
            this.fsLog(`fs:file-read ${pth}`);
            return await fs.promises.readFile(pth, { encoding: "utf-8" });
        }
        static async fileReadRaw(pth) {
            pth = this.makePath(pth);
            this.fsLog(`fs:file-read-raw ${pth}`);
            return [...(await fs.promises.readFile(pth))];
        }
        static async fileWrite(pth, content) {
            pth = this.makePath(pth);
            content = String(content);
            this.fsLog(`fs:file-write ${pth}`);
            return await fs.promises.writeFile(pth, content, { encoding: "utf-8" });
        }
        static async fileWriteRaw(pth, content) {
            pth = this.makePath(pth);
            content = Buffer.from(content);
            this.fsLog(`fs:file-write-raw ${pth}`);
            return await fs.promises.writeFile(pth, content);
        }
        static async fileAppend(pth, content) {
            pth = this.makePath(pth);
            this.fsLog(`fs:file-append ${pth}`);
            return await fs.promises.appendFile(pth, content, { encoding: "utf-8" });
        }
        static async fileDelete(pth) {
            pth = this.makePath(pth);
            this.fsLog(`fs:file-delete ${pth}`);
            return await fs.promises.unlink(pth);
        }

        static async dirHas(pth) {
            pth = this.makePath(pth);
            this.fsLog(`fs:dir-has ${pth}`);
            try {
                await fs.promises.access(pth);
                return true;
            } catch (e) {}
            return false;
        }
        static async dirList(pth) {
            pth = this.makePath(pth);
            this.fsLog(`fs:dir-list ${pth}`);
            let dirents = await fs.promises.readdir(pth, { withFileTypes: true });
            return dirents.map(dirent => {
                return {
                    type: dirent.isFile() ? "file" : "dir",
                    name: dirent.name,
                };
            });
        }
        static async dirMake(pth) {
            pth = this.makePath(pth);
            this.fsLog(`fs:dir-make ${pth}`);
            return await fs.promises.mkdir(pth);
        }
        static async dirDelete(pth) {
            pth = this.makePath(pth);
            this.fsLog(`fs:dir-delete ${pth}`);
            return await fs.promises.rm(pth, { force: true, recursive: true });
        }

        static async getFSVersion(pth) {
            try {
                return await this.fileRead([pth, ".version"]);
            } catch (e) {}
            return "";
        }
        static async setFSVersion(pth, version) {
            try {
                await this.fileWrite([pth, ".version"], String(version));
            } catch (e) {}
        }
        static async canFS(pth, version) {
            let fsVersion = await this.getFSVersion(pth);
            version = String(version);
            if (!compareVersions.validateStrict(fsVersion)) return true;
            if (!compareVersions.validateStrict(version)) return false;
            return compareVersions.compare(version, fsVersion, ">=");
        }

        async fileHas(pth) { return await Portal.fileHas([this.dataPath, pth]); }
        async fileRead(pth) { return await Portal.fileRead([this.dataPath, pth]); }
        async fileReadRaw(pth) { return await Portal.fileReadRaw([this.dataPath, pth]); }
        async fileWrite(pth, content) { return await Portal.fileWrite([this.dataPath, pth], content); }
        async fileWriteRaw(pth, content) { return await Portal.fileWriteRaw([this.dataPath, pth], content); }
        async fileAppend(pth, content) { return await Portal.fileAppend([this.dataPath, pth], content); }
        async fileDelete(pth) { return await Portal.fileDelete([this.dataPath, pth]); }

        async dirHas(pth) { return await Portal.dirHas([this.dataPath, pth]); }
        async dirList(pth) { return await Portal.dirList([this.dataPath, pth]); }
        async dirMake(pth) { return await Portal.dirMake([this.dataPath, pth]); }
        async dirDelete(pth) { return await Portal.dirDelete([this.dataPath, pth]); }

        async getFSVersion() { return await Portal.getFSVersion(this.dataPath); }
        async setFSVersion(verison) { return await Portal.setFSVersion(this.dataPath, verison); }
        async canFS(version) { return await Portal.canFS(this.dataPath, version); }

        async clientMake(id, location) {
            if (await this.clientHas(id)) return null;
            this.log(`CLIENT:make - ${id} = ${location}`);
            let client = this.clientManager.addClient(new Client(location));
            client.id = id;
            return client;
        }
        async clientDestroy(id) {
            if (!(await this.clientHas(id))) return null;
            await this.clientDisconn(id);
            this.log(`CLIENT:destroy - ${id}`);
            let client = this.clientManager.remClient((id instanceof Client) ? id : this.clientManager.getClientById(id));
            return client;
        }
        async clientHas(id) { return (id instanceof Client) ? this.clientManager.clients.includes(id) : (this.clientManager.getClientById(id) instanceof Client); }
        async clientGet(id) {
            if (!(await this.clientHas(id))) return null;
            return (id instanceof Client) ? id : this.clientManager.getClientById(id);
        }
        async clientConn(id) {
            if (!(await this.clientHas(id))) return null;
            let client = (id instanceof Client) ? id : this.clientManager.getClientById(id);
            this.log(`CLIENT:conn - ${client.id}`);
            client.connect();
            return client;
        }
        async clientDisconn(id) {
            if (!(await this.clientHas(id))) return null;
            let client = (id instanceof Client) ? id : this.clientManager.getClientById(id);
            this.log(`CLIENT:disconn - ${client.id}`);
            client.disconnect();
            return client;
        }
        async clientEmit(id, name, payload) {
            if (!(await this.clientHas(id))) return null;
            let client = (id instanceof Client) ? id : this.clientManager.getClientById(id);
            this.log(`CLIENT:emit - ${client.id} > ${name}`);
            return await client.emit(name, payload);
        }
        async clientStream(id, pth, name, payload) {
            if (!(await this.clientHas(id))) return null;
            let client = (id instanceof Client) ? id : this.clientManager.getClientById(id);
            this.log(`CLIENT:stream - ${client.id} > ${name}`);
            return await client.stream(pth, name, payload);
        }

        async tbaClientMake(id) {
            if (await this.tbaClientHas(id)) return null;
            this.log(`TBACLIENT:make - ${id}`);
            let client = this.tbaClientManager.addClient(new TbaClient());
            client.id = id;
            return client;
        }
        async tbaClientDestroy(id) {
            if (!(await this.tbaClientHas(id))) return null;
            this.log(`TBACLIENT:destroy - ${id}`);
            let client = this.tbaClientDestroy.remClient((id instanceof TbaClient) ? id : this.tbaClientManager.getClientById(id));
            return client;
        }
        async tbaClientHas(id) { return (id instanceof TbaClient) ? this.tbaClientManager.clients.includes(id) : (this.tbaClientManager.getClientById(id) instanceof TbaClient); }
        async tbaClientGet(id) {
            if (!(await this.tbaClientHas(id))) return null;
            return (id instanceof TbaClient) ? id : this.tbaClientManager.getClientById(id);
        }
        async tbaClientInvoke(id, invoke, ...a) {
            if (!(await this.tbaClientHas(id))) return null;
            let client = (id instanceof TbaClient) ? id : this.tbaClientManager.getClientById(id);
            this.log(`TBACLIENT:emit - ${client.id} > ${invoke}`);
            return await client.invoke(invoke, ...a);
        }

        identifyFeature(id) {
            for (let feat of this.features) {
                if (!feat.hasWindow()) continue;
                if (feat.window.webContents.id != id) continue;
                return feat;
            }
            return null;
        }

        async get(k) {
            k = String(k);
            let kfs = {
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
                    return (active in holidays) ? active : null;
                },
                "production": async () => {
                    return app.isPackaged;
                },
                "fs-version": async () => await this.getFSVersion(),
                "_fullpackage": async () => {
                    let content = "";
                    try {
                        content = await Portal.fileRead(path.join(__dirname, "..", "package.json"));
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
                "_fulldevconfig": async () => {
                    let content = "";
                    try {
                        content = await Portal.fileRead(path.join(__dirname, ".config"));
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    return data;
                },
                "devmode": async () => {
                    return !(await kfs.production()) && ((await kfs._fulldevconfig()).isDevMode);
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
                    return util.ensure(host, "str") || "https://peninsula-db.jfancode.repl.co";
                },
                "assets-host": async () => {
                    return String((await kfs._fullconfig()).assetsHost);
                },
                "socket-host": async () => {
                    let host = (await kfs._fullconfig()).socketHost;
                    return util.ensure(host, "str") || (await kfs["db-host"]());
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
                    return util.ensure((await kfs._fullclientconfig()).theme, "str", await kfs["active-theme"]());
                },
                "native-theme": async () => {
                    return util.ensure((await kfs._fullclientconfig()).nativeTheme, "str", "system");
                },
                "dark-wanted": async () => electron.nativeTheme.shouldUseDarkColors,
                "cleanup": async () => await this.getCleanup(),
            };
            if (k in kfs) return await kfs[k]();
            if (k.startsWith("val-")) {
                try {
                    return await this.getValue(k.substring(4));
                } catch (e) { if (!String(e).startsWith("§GV ")) throw e; }
            }
            throw "§G No possible \"get\" for key: "+k;
        }
        async getValue(k) {
            k = String(k);
            let kfs = {
                "version": async () => await this.get("version"),
                "db-host": async () => await this.get("db-host"),
                "assets-host": async () => await this.get("assets-host"),
                "socket-host": async () => await this.get("socket-host"),
                "repo": async () => await this.get("repo"),
                "holiday": async () => await this.get("active-holiday"),
                "comp-mode": async () => await this.get("comp-mode"),
                "theme": async () => await this.get("theme"),
                "native-theme": async () => await this.get("native-theme"),
            };
            if (k in kfs) return await kfs[k]();
            throw "§GV No possible \"getValue\" for key: "+k;
        }
        async getCallback(id, k) {
            try {
                return await this.get(k);
            } catch (e) { if (!String(e).startsWith("§G ")) throw e; }
            let feat = this.identifyFeature(id);
            if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+id;
            return await feat.get(k);
        }
        async set(k, v) {
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
                "db-host": async () => await kfs._fullconfig("dbHost", String(v)),
                "assets-host": async () => await kfs._fullconfig("assetsHost", String(v)),
                "socket-host": async () => await kfs._fullconfig("socketHost", String(v)),
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
                    await kfs._fullclientconfig("theme", String(v));
                    await this.send("theme");
                },
                "native-theme": async () => {
                    await kfs._fullclientconfig("nativeTheme", String(v)),
                    electron.nativeTheme.themeSource = await this.get("native-theme");
                },
            };
            if (k in kfs) return await kfs[k]();
            if (k.startsWith("val-")) {
                try {
                    return await this.setValue(k.substring(4), v);
                } catch (e) { if (!String(e).startsWith("§SV ")) throw e; }
            }
            throw "§S No possible \"set\" for key: "+k;
        }
        async setValue(k, v) {
            k = String(k);
            let kfs = {
                "db-host": async () => await this.set("db-host", v),
                "assets-host": async () => await this.set("assets-host", v),
                "socket-host": async () => await this.set("socket-host", v),
                "comp-mode": async () => await this.set("comp-mode", v),
            };
            if (k in kfs) return await kfs[k]();
            throw "§SV No possible \"setValue\" for key: "+k;
        }
        async setCallback(id, k, v) {
            try {
                return await this.set(k, v);
            } catch (e) { if (!String(e).startsWith("§S ")) throw e; }
            let feat = this.identifyFeature(id);
            if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+id;
            return await feat.set(k, v);
        }
        async on(k, ...a) {
            k = String(k);
            let kfs = {
                "spawn": async name => {
                    name = String(name);
                    for (let feat of this.features) {
                        if (feat.name != name) continue;
                        return false;
                    }
                    if (!FEATURES.includes(name)) return false;
                    let feat = new Portal.Feature(this, name);
                    this.addFeature(feat);
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
            };
            if (k in kfs) return await kfs[k](...a);
            throw "§O No possible \"on\" for key: "+k;
        }
        async onCallback(id, k, ...a) {
            let feat = this.identifyFeature(id);
            if (!(feat instanceof Portal.Feature)) {
                try {
                    return await this.on(k, ...a);
                } catch (e) { if (!String(e).startsWith("§O ")) throw e; }
            }
            if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+id;
            return await feat.on(k, ...a);
        }
        async send(k, ...a) {
            await Promise.all(this.features.map(async feat => await feat.send(k, ...a)));
            return true;
        }
        cacheSet(k, v) {
            this.features.map(async feat => await feat.cacheSet(k, v))
            return true;
        }
        cacheDel(k) {
            this.features.map(async feat => await feat.cacheDel(k))
            return true;
        }
        cacheClear() {
            this.features.map(async feat => await feat.cacheClear())
            return true;
        }

        update(delta) {
            this.post("update", delta);
            this.features.forEach(feat => feat.update(delta));
        }

        static log(...a) {
            return log(".", ...a);
        }
        static fsLog(...a) {
            return;
            return this.log(...a);
        }
        log(...a) {
            return log(":", ...a);
        }
    }
    Portal.Feature = class PortalFeature extends util.Target {
        #portal;

        #processManager;
        #clientManager;
        #tbaClientManager;

        #name;

        #window;
        #menu;
        #perm;

        #started;
        #resolver;

        #state;

        constructor(portal, name) {
            super();

            if (!(portal instanceof Portal)) throw "Portal is not of class Portal";
            this.#portal = portal;

            this.#processManager = new ProcessManager();
            this.#clientManager = new ClientManager();
            this.#tbaClientManager = new TbaClientManager();

            name = String(name).toUpperCase();
            if (!FEATURES.includes(name)) throw "Feature name "+name+" is not valid";
            this.#name = name;
            
            this.#window = null;
            this.#menu = null;
            this.#perm = false;

            this.#started = false;

            this.#resolver = new util.Resolver(0);

            this.#state = {};

            this.log();
        }

        get processManager() { return this.#processManager; }
        get clientManager() { return this.#clientManager; }
        get tbaClientManager() { return this.#tbaClientManager; }

        get portal() { return this.#portal; }
        
        get name() { return this.#name; }

        get window() { return this.#window; }
        hasWindow() { return (this.window instanceof electron.BrowserWindow) && !this.window.isDestroyed() && !this.window.webContents.isDestroyed(); }
        get menu() { return this.#menu; }
        hasMenu() { return this.menu instanceof electron.Menu; }
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
                }, 500);
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

        get ready() { return this.#resolver.state == 2; }
        async whenReady() { await this.#resolver.when(2); }
        async whenNotReady() { await this.#resolver.whenNot(2); }

        get started() { return this.#started; }
        start() {
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
                maximizable: false,

                titleBarStyle: (OS.platform == "darwin" ? "hidden" : "default"),
                trafficLightPosition: { x: (40-16)/2, y: (40-16)/2 },

                webPreferences: {
                    preload: path.join(__dirname, "preload.js"),
                    webviewTag: true,
                },
            };
            const onHolidayState = async holiday => {
                let tag = "png";
                let defaultIcon = path.join(__dirname, "assets", "app", "icon."+tag);
                let icon = (holiday == null) ? defaultIcon : util.ensure(util.ensure(await this.get("holiday-icons"), "obj")[holiday], "obj")[tag];
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
            this.window.once("ready-to-show", () => {
                if (!this.hasWindow()) return;
                this.#resolver.state++;
            });
            let id = setTimeout(() => {
                showError("Feature Start Error - Startup", "The application did not acknowledge readyness within 1 second");
                clear();
                this.stop();
            }, 10000);
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
            this.window.webContents.on("did-fail-load", () => { if (this.hasWindow()) this.window.close(); });
            this.window.webContents.on("will-navigate", (e, url) => {
                if (!this.hasWindow()) return;
                if (url != this.window.webContents.getURL()) {
                    e.preventDefault();
                    this.on("open", url);
                }
            });
            let any = false;
            for (let feat of this.portal.features.filter(feat => feat.hasWindow())) {
                if (!feat.hasWindow()) continue;
                if (!feat.window.webContents.isDevToolsOpened()) continue;
                any = true;
                break;
            }
            if (this.hasWindow() && any) this.window.webContents.openDevTools();
            this.window.webContents.on("devtools-opened", () => {
                this.portal.features.filter(feat => feat.hasWindow()).forEach(feat => feat.window.webContents.openDevTools());
            });
            this.window.webContents.on("devtools-closed", () => {
                this.portal.features.filter(feat => feat.hasWindow()).forEach(feat => feat.window.webContents.closeDevTools());
            });

            this.window.on("enter-full-screen", () => this.send("win-fullscreen", true));
            this.window.on("leave-full-screen", () => this.send("win-fullscreen", false));

            this.window.on("focus", () => this.portal.checkMenu());
            this.window.on("blur", () => this.portal.checkMenu());

            this.perm = false;
            this.window.on("close", e => {
                this.log("CLOSE");
                if (this.perm) return this.log("CLOSE - yes perm");
                this.log("CLOSE - no perm");
                e.preventDefault();
                this.stop();
            });

            this.window.loadFile(path.join(__dirname, this.name.toLowerCase(), "index.html"));

            namefs = {
                PORTAL: () => {
                    let resolver = new util.Resolver(false);
                    const checkForShow = async () => {
                        if (!this.hasWindow()) return;
                        await this.whenReady();
                        await resolver.whenFalse();
                        resolver.state = true;
                        let nFeats = 0;
                        for (let feat of this.portal.features) {
                            if (feat.name == "PORTAL") continue;
                            nFeats++;
                        }
                        if (nFeats > 0) this.window.hide();
                        else this.window.show();
                        resolver.state = false;
                    };
                    checkForShow();
                    this.portal.addHandler("change-addFeature", () => checkForShow());
                    this.portal.addHandler("change-remFeature", () => checkForShow());
                    this.window.on("show", checkForShow);
                },
                PANEL: () => {
                    this.addHandler("client-stream-logs", async () => ["logs"]);
                },
                PLANNER: () => {
                }
            };

            if (namefs[this.name]) namefs[this.name]();
            
            (async () => {
                await this.whenReady();
                if (!this.hasWindow()) return;
                let prevIsDevMode = null;
                const checkDevConfig = async () => {
                    let isDevMode = !!(await this.get("devmode"));
                    if (prevIsDevMode != isDevMode) {
                        prevIsDevMode = isDevMode;
                        this.send("win-devmode", isDevMode);
                    }
                };
                let prevHoliday = null;
                const checkHoliday = async () => {
                    let holiday = await this.get("active-holiday");
                    holiday = (holiday == null) ? null : String(holiday);
                    await onHolidayState(holiday);
                    if (prevHoliday != holiday) {
                        prevHoliday = holiday;
                        this.send("win-holiday", holiday);
                    }
                };
                fs.watchFile(path.join(__dirname, ".config"), () => checkDevConfig());
                fs.watchFile(path.join(this.portal.dataPath, "holidays", "holidays.json"), () => checkHoliday());
                await checkDevConfig();
                await checkHoliday();
                if (!this.canOperate) return;
                let bounds = util.ensure(await this.on("state-get", "bounds"), "obj");
                if (!this.hasWindow()) return;
                this.window.show();
                if (("width" in bounds) && (bounds.width < 50)) return;
                if (("height" in bounds) && (bounds.height < 50)) return;
                this.window.setContentBounds(bounds);
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
            if (this.canOperate && this.hasWindow()) await this.on("state-set", "bounds", this.window.getBounds());
            this.#started = false;
            await Promise.all(this.processManager.processes.map(async process => await process.terminate()));
            await Promise.all(this.clientManager.clients.map(async client => await this.clientDestroy(client)));
            await Promise.all(this.tbaClientManager.clients.map(async client => await this.tbaClientDestroy(client)));
            if (this.hasWindow()) this.window.close();
            this.#window = null;
            this.#menu = null;
            await this.portal.remFeature(this);
            return this;
        }
        
        static getDataPath(portal, name, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            return path.join(portal.dataPath, name.toLowerCase());
        }
        get dataPath() { return Portal.Feature.getDataPath(this.portal, this.name, this.started); }

        static getCanOperate(portal, name, started=true) {
            return (portal instanceof Portal) && FEATURES.includes(name) && started;
        }
        get canOperate() { return Portal.Feature.getCanOperate(this.portal, this.name, this.started); }

        static async affirm(portal, name, started=true) {
            if (!this.getCanOperate(portal, name, started)) return false;
            await portal.affirm();
            let hasFeatureData = await Portal.dirHas(this.getDataPath(portal, name, started));
            if (!hasFeatureData) await Portal.dirMake(this.getDataPath(portal, name, started));
            let hasConfig = await Portal.fileHas([this.getDataPath(portal, name, started), ".config"]);
            if (!hasConfig) await Portal.fileWrite([this.getDataPath(portal, name, started), ".config"], JSON.stringify({}, null, "\t"));
            let hasState = await Portal.fileHas([this.getDataPath(portal, name, started), ".state"]);
            if (!hasState) await Portal.fileWrite([this.getDataPath(portal, name, started), ".state"], JSON.stringify({}, null, "\t"));
            return true;
        }
        async affirm() { return await Portal.Feature.affirm(this.portal, this.name, this.started); }

        static async fileHas(portal, name, pth, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.fileHas(Portal.makePath(this.getDataPath(portal, name, started), pth));
        }
        static async fileRead(portal, name, pth, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.fileRead(Portal.makePath(this.getDataPath(portal, name, started), pth));
        }
        static async fileReadRaw(portal, name, pth, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.fileReadRaw(Portal.makePath(this.getDataPath(portal, name, started), pth));
        }
        static async fileWrite(portal, name, pth, content, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.fileWrite(Portal.makePath(this.getDataPath(portal, name, started), pth), content);
        }
        static async fileWriteRaw(portal, name, pth, content, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.fileWriteRaw(Portal.makePath(this.getDataPath(portal, name, started), pth), content);
        }
        static async fileAppend(portal, name, pth, content, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.fileAppend(Portal.makePath(this.getDataPath(portal, name, started), pth), content);
        }
        static async fileDelete(portal, name, pth, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.fileDelete(Portal.makePath(this.getDataPath(portal, name, started), pth));
        }

        static async dirHas(portal, name, pth, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.dirHas(Portal.makePath(this.getDataPath(portal, name, started), pth));
        }
        static async dirList(portal, name, pth, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.dirList(Portal.makePath(this.getDataPath(portal, name, started), pth));
        }
        static async dirMake(portal, name, pth, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.dirMake(Portal.makePath(this.getDataPath(portal, name, started), pth));
        }
        static async dirDelete(portal, name, pth, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.dirDelete(Portal.makePath(this.getDataPath(portal, name, started), pth));
        }

        async fileHas(pth) { return Portal.Feature.fileHas(this.portal, this.name, pth, this.started); }
        async fileRead(pth) { return Portal.Feature.fileRead(this.portal, this.name, pth, this.started); }
        async fileReadRaw(pth) { return Portal.Feature.fileReadRaw(this.portal, this.name, pth, this.started); }
        async fileWrite(pth, content) { return Portal.Feature.fileWrite(this.portal, this.name, pth, content, this.started); }
        async fileWriteRaw(pth, content) { return Portal.Feature.fileWriteRaw(this.portal, this.name, pth, content, this.started); }
        async fileAppend(pth, content) { return Portal.Feature.fileAppend(this.portal, this.name, pth, content, this.started); }
        async fileDelete(pth) { return Portal.Feature.fileDelete(this.portal, this.name, pth, this.started); }

        async dirHas(pth) { return Portal.Feature.dirHas(this.portal, this.name, pth, this.started); }
        async dirList(pth) { return Portal.Feature.dirList(this.portal, this.name, pth, this.started); }
        async dirMake(pth) { return Portal.Feature.dirMake(this.portal, this.name, pth, this.started); }
        async dirDelete(pth) { return Portal.Feature.dirDelete(this.portal, this.name, pth, this.started); }

        async clientMake(id, location) {
            let client = await this.portal.clientMake(this.name+":"+id, location);
            client = this.clientManager.addClient(client);
            client.addTag(this.name);
            client.addHandler("msg", async (name, payload, meta) => {
                name = String(name);
                meta = util.ensure(meta, "obj");
                if (!this.hasWindow()) return { success: false, reason: "No window" };
                await this.post("client-msg", id, name, payload, meta);
                await this.post("client-msg-"+name, id, payload, meta);
                this.window.webContents.send("client-msg", id, name, payload, meta);
                return { success: true };
            });
            client.addHandler("stream", async (name, fname, payload, meta, ssStream) => {
                name = String(name);
                fname = String(fname);
                meta = util.ensure(meta, "obj");
                await this.affirm();
                let results = [];
                results.push(...(await this.post("client-stream", id, name, fname, payload, meta)));
                results.push(...(await this.post("client-stream-"+name, id, fname, payload, meta)));
                let pth = (results.length > 0) ? results[0] : [];
                if (!(await this.dirHas(pth)))
                    await this.dirMake(pth);
                pth = Portal.makePath(this.dataPath, pth, fname);
                const stream = fs.createWriteStream(pth);
                try {
                    await new Promise((res, rej) => {
                        stream.on("open", async () => {
                            await this.post("client-stream-start", id, name, pth, fname, payload, meta);
                            await this.post("clietn-stream-start-"+name, id, pth, fname, payload, meta);
                            this.window.webContents.send("client-stream-start", id, name, pth, fname, payload, meta);
                            ssStream.pipe(stream);
                            ssStream.on("end", async () => {
                                await this.post("client-stream-stop", id, name, pth, fname, payload, meta);
                                await this.post("client-stream-stop-"+name, id, pth, fname, payload, meta);
                                this.window.webContents.send("client-stream-stop", id, name, pth, fname, payload, meta);
                                res();
                            });
                            ssStream.on("error", e => rej(e));
                        });
                    });
                } catch (e) { return { success: false, reason: String(e) }; }
                return { success: true };
            });
            return client;
        }
        async clientDestroy(id) {
            return await this.portal.clientDestroy((id instanceof Client) ? id : (this.name+":"+id));
        }
        async clientHas(id) {
            if (!(await this.portal.clientHas((id instanceof Client) ? id : (this.name+":"+id)))) return false;
            return (id instanceof Client) ? this.clientManager.clients.includes(id) : (this.clientManager.getClientById(this.name+":"+id) instanceof Client);
        }
        async clientGet(id) {
            if (!(await this.clientHas(id))) return null;
            return (id instanceof Client) ? id : this.portal.clientGet(this.name+":"+id);
        }
        async clientConn(id) {
            return await this.portal.clientConn((id instanceof Client) ? id : (this.name+":"+id));
        }
        async clientDisconn(id) {
            return await this.portal.clientDisconn((id instanceof Client) ? id : (this.name+":"+id));
        }
        async clientEmit(id, name, payload) {
            return await this.portal.clientEmit((id instanceof Client) ? id : (this.name+":"+id), name, payload);
        }
        async clientStream(id, pth, name, payload) {
            return await this.portal.clientStream((id instanceof Client) ? id : (this.name+":"+id), pth, name, payload);
        }

        async tbaClientMake(id) {
            let client = await this.portal.tbaClientMake(this.name+":"+id, location);
            client = this.tbaClientManager.addClient(client);
            client.addTag(this.name);
            return client;
        }
        async tbaClientDestroy(id) {
            return await this.portal.tbaClientDestroy((id instanceof TbaClient) ? id : (this.name+":"+id));
        }
        async tbaClientHas(id) {
            if (!(await this.portal.tbaClientHas((id instanceof TbaClient) ? id : (this.name+":"+id)))) return false;
            return (id instanceof TbaClient) ? this.tbaClientManager.clients.includes(id) : (this.tbaClientManager.getClientById(this.name+":"+id) instanceof TbaClient);
        }
        async tbaClientGet(id) {
            if (!(await this.tbaClientHas(id))) return null;
            return (id instanceof TbaClient) ? id : this.portal.tbaClientGet(this.name+":"+id);
        }
        async tbaClientInvoke(id, invoke, ...a) {
            return await this.portal.tbaClientInvoke((id instanceof TbaClient) ? id : (this.name+":"+id), invoke, ...a);
        }

        async get(k) {
            if (!this.started) return null;
            k = String(k);
            try {
                return await this.portal.get(k);
            } catch (e) { if (!String(e).startsWith("§G ")) throw e; }
            let doLog = true;
            let kfs = {
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
                    return !(await this.get("focused"));
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
                    return !(await this.get("visible"));
                },

                "modal": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isModal();
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
                    return !(await this.get("enabled"));
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
            };
            let r = null;
            if (k in kfs) r = await kfs[k]();
            else {
                let namefs = {
                    PANEL: {
                        "logs": async () => {
                            doLog = false;
                            let hasLogsDir = await this.dirHas("logs");
                            if (!hasLogsDir) return [];
                            let dirents = await this.dirList("logs");
                            return dirents.filter(dirent => dirent.type == "file" && dirent.name.endsWith(".wpilog")).map(dirent => {
                                return {
                                    name: dirent.name,
                                    path: path.join(this.dataPath, "logs", dirent.name),
                                };
                            });
                        },
                    },
                };
                if (this.name in namefs)
                    if (k in namefs[this.name])
                        r = await namefs[this.name][k]();
            }
            if (doLog) this.log(`GET - ${k}`);
            return r;
        }
        async set(k, v) {
            if (!this.started) return false;
            k = String(k);
            try {
                return await this.portal.set(k, v);
            } catch (e) { if (!String(e).startsWith("§S ")) throw e; }
            let doLog = true;
            let kfs = {
                "menu": async () => {
                    const dfs = itms => {
                        if (!util.is(itms, "arr")) return;
                        itms.forEach(itm => {
                            if (!util.is(itm, "obj")) return;
                            itm.click = () => this.send("menu-click", itm.id);
                            dfs(itm.submenu);
                        });
                    };
                    dfs(v);
                    this.#menu = null;
                    try {
                        this.#menu = electron.Menu.buildFromTemplate([...makeMenuDefault(this.name, () => this.send("about"), () => this.on("spawn", "PRESETS")), ...util.ensure(v, "arr")]);
                    } catch (e) {}
                    this.portal.checkMenu();
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
            };
            let r = false;
            if (k in kfs) r = await kfs[k]();
            else {
                let namefs = {
                };
                if (this.name in namefs)
                    if (k in namefs[this.name])
                        r = await namefs[this.name][k]();
            }
            if (doLog) this.log(`SET - ${k} = ${simplify(JSON.stringify(v))}`);
            return r;
        }
        async on(k, ...a) {
            if (!this.started) return null;
            k = String(k);
            let doLog = true;
            let kfs = {
                "reload": async () => {
                    const portal = this.portal, name = this.name;
                    portal.remFeature(this);
                    portal.addFeature(new Portal.Feature(portal, name));
                },
                "close": async () => await this.stop(),
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
                    const img = await ((rect == null) ? this.window.webContents.capturePage() : this.window.webContents.capturePage(rect));
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
                    let hasDir = await Portal.dirHas(root);
                    if (!hasDir) await Portal.dirMake(root);
                    let hasProjectsContent = await Portal.fileHas([root, "projects.json"]);
                    if (!hasProjectsContent) await Portal.fileWrite([root, "projects.json"], "");
                    let hasProjectsMetaContent = await Portal.fileHas([root, "projects.meta.json"]);
                    if (!hasProjectsMetaContent) await Portal.fileWrite([root, "projects.meta.json"], "");
                    let hasProjectsDir = await Portal.dirHas([root, "projects"]);
                    if (!hasProjectsDir) await Portal.dirMake([root, "projects"]);
                },
                "projects-get": async () => {
                    await kfs["project-affirm"]();
                    const root = await kfs["root-get"]();
                    let content = null;
                    try {
                        content = await Portal.fileRead([root, "projects.json"]);
                    } catch (e) {}
                    return content;
                },
                "projects-set": async content => {
                    await kfs["project-affirm"]();
                    const root = await kfs["root-get"]();
                    await Portal.fileWrite([root, "projects.json"], content);
                },
                "projects-list": async () => {
                    await kfs["project-affirm"]();
                    const root = await kfs["root-get"]();
                    let dirents = null;
                    try {
                        dirents = Portal.dirList([root, "projects"]);
                    } catch (e) {}
                    return util.ensure(dirents, "arr");
                },
                "project-get": async id => {
                    await kfs["project-affirm"]();
                    id = String(id);
                    const root = await kfs["root-get"]();
                    let content = null;
                    try {
                        content = await Portal.fileRead([root, "projects", id+".json"]);
                    } catch (e) {}
                    return content;
                },
                "project-set": async (id, content) => {
                    await kfs["project-affirm"]();
                    id = String(id);
                    const root = await kfs["root-get"]();
                    await Portal.fileWrite([root, "projects", id+".json"], content);
                },
                "project-del": async id => {
                    await kfs["project-affirm"]();
                    id = String(id);
                    const root = await kfs["root-get"]();
                    try {
                        await Portal.fileDelete([root, "projects", id+".json"]);
                    } catch (e) { return false; }
                    return true;
                },
                "projects-meta-get": async () => {
                    await kfs["project-affirm"]();
                    const root = await kfs["root-get"]();
                    let content = null;
                    try {
                        content = await Portal.fileRead([root, "projects", id+".meta.json"]);
                    } catch (e) {}
                    return content;
                },
                "projects-meta-set": async content => {
                    await kfs["project-affirm"]();
                    const root = await kfs["root-get"]();
                    await Portal.fileWrite([root, "projects", id+".meta.json"], content);
                },
            };
            if (k in kfs)
                return await kfs[k](...a);
            let namefs = {
                PANEL: {
                    "wpilog-read": async pth => {
                        return await Portal.fileReadRaw(pth);
                    },
                    "wpilog-write": async (pth, content) => {
                        return await Portal.fileWriteRaw(pth, content);
                    },
                    "log-delete": async name => {
                        let logs = await this.get("logs");
                        let has = false;
                        for (let log of logs) {
                            if (log.name != name) continue;
                            has = true;
                        }
                        if (!has) return false;
                        if (await this.fileHas(["logs", name]))
                            await this.fileDelete(["logs", name]);
                        return true;
                    },
                    "log-cache": async pth => {
                        pth = String(pth);
                        if (!(await Portal.fileHas(pth))) return false;
                        await this.portal.affirm();
                        if (!(await this.dirHas(["logs"])))
                            await this.portal.dirMake(["logs"]);
                        const name = path.basename(pth);
                        let pthDest = path.join(this.dataPath, "logs", name);
                        if (path.resolve(pth) == path.resolve(pthDest)) return true;
                        await fs.promises.cp(
                            pth,
                            pthDest,
                            {
                                force: true,
                                recursive: true,
                            },
                        );
                        return true;
                    },
                },
                PLANNER: {
                    "exec": async (id, pathId) => {
                        id = String(id);
                        pathId = String(pathId);

                        const subcore = await import("./planner/core.mjs");

                        let project = null;
                        try {
                            project = JSON.parse(await kfs["project-get"](id), subcore.REVIVER.f);
                        } catch (e) {}
                        if (!(project instanceof subcore.Project)) throw "Invalid project content with id: "+id;
                        if (!project.hasPath(pathId)) throw "Nonexistent path with id: "+pathId+" for project id: "+id;
                        let pth = project.getPath(pathId);

                        let script = project.config.scriptUseDefault ? Portal.makePath(this.dataPath, "solver", "solver.py") : project.config.script;
                        if (script == null) throw "No script for project with id: "+id;
                        script = String(script);
                        let hasScript = await Portal.fileHas(script);
                        if (!hasScript) throw "Script ("+script+") does not exist for project id: "+id;
                        const root = path.dirname(script);

                        let dataIn = { config: {}, nodes: [], obstacles: [] };
                        dataIn.config.map_w = project.w / 100;
                        dataIn.config.map_h = project.h / 100;
                        dataIn.config.side_length = project.robotW / 100;
                        dataIn.config.mass = project.robotMass;
                        dataIn.config.moment_of_inertia = project.config.momentOfInertia;
                        dataIn.config.efficiency_percent = project.config.efficiency;
                        dataIn.config["12_motor_mode"] = project.config.is12MotorMode;
                        pth.nodes.forEach(id => {
                            if (!project.hasItem(id)) return;
                            let itm = project.getItem(id);
                            if (!(itm instanceof subcore.Project.Node)) return;
                            dataIn.nodes.push({
                                x: itm.x/100, y: itm.y/100,
                                vx: itm.useVelocity ? itm.velocityX/100 : null,
                                vy: itm.useVelocity ? itm.velocityY/100 : null,
                                vt: itm.useVelocity ? itm.velocityRot : null,
                                theta: itm.useHeading ? itm.heading : null,
                            });
                        });
                        project.items.forEach(id => {
                            let itm = project.getItem(id);
                            if (!(itm instanceof subcore.Project.Obstacle)) return;
                            dataIn.obstacles.push({
                                x: itm.x/100, y: itm.y/100,
                                radius: itm.radius/100,
                            });
                        });
                        let contentIn = JSON.stringify(dataIn, null, "\t");

                        this.log("REMOVE data.in/data.out");
                        if (await Portal.fileHas(path.join(root, "data.in")))
                            await Portal.fileDelete(path.join(root, "data.in"));
                        if (await Portal.fileHas(path.join(root, "data.out")))
                            await Portal.fileDelete(path.join(root, "data.out"));
                        this.log("REMOVE stdout.log/stderr.log");
                        if (await Portal.fileHas(path.join(root, "stdout.log")))
                            await Portal.fileDelete(path.join(root, "stdout.log"));
                        if (await Portal.fileHas(path.join(root, "stderr.log")))
                            await Portal.fileDelete(path.join(root, "stderr.log"));
                        this.log("CREATE data.in");
                        await Portal.fileWrite(path.join(root, "data.in"), contentIn);
                        this.log("CREATE stdout.log/stderr.log");
                        await Portal.fileWrite(path.join(root, "stdout.log"), "");
                        await Portal.fileWrite(path.join(root, "stderr.log"), "");
                        return new Promise((res, rej) => {
                            if (this.processManager.getProcessById("script") instanceof Process) return rej("Existing process has not terminated");
                            this.log("SPAWN");
                            const process = this.processManager.addProcess(new Process("spawn", project.config.scriptPython, [script], { cwd: root }));
                            process.id = "script";
                            const finish = async () => {
                                const appRoot = await this.on("root-get");
                                const doAppRoot = appRoot != this.dataPath;
                                let hasMainDir = await Portal.dirHas(path.join(root, "paths"));
                                if (!hasMainDir) await Portal.dirMake(path.join(root, "paths"));
                                if (doAppRoot) {
                                    let hasMainDir = await Portal.dirHas(path.join(appRoot, "paths"));
                                    if (!hasMainDir) await Portal.dirMake(path.join(appRoot, "paths"));
                                }
                                let hasProjectDir = await Portal.dirHas(path.join(root, "paths", project.meta.name));
                                if (!hasProjectDir) await Portal.dirMake(path.join(root, "paths", project.meta.name));
                                if (doAppRoot) {
                                    let hasProjectDir = await Portal.dirHas(path.join(appRoot, "paths", project.meta.name));
                                    if (!hasProjectDir) await Portal.dirMake(path.join(appRoot, "paths", project.meta.name));
                                }
                                let hasPathDir = await Portal.dirHas(path.join(root, "paths", project.meta.name, pth.name));
                                if (!hasPathDir) await Portal.dirMake(path.join(root, "paths", project.meta.name, pth.name));
                                if (doAppRoot) {
                                    let hasPathDir = await Portal.dirHas(path.join(appRoot, "paths", project.meta.name, pth.name));
                                    if (!hasPathDir) await Portal.dirMake(path.join(appRoot, "paths", project.meta.name, pth.name));
                                }
                                let hasDataIn = await Portal.fileHas(path.join(root, "data.in"));
                                if (hasDataIn) {
                                    if (doAppRoot)
                                        await fs.promises.cp(
                                            path.join(root, "data.in"),
                                            path.join(appRoot, "paths", project.meta.name, pth.name, "data.in"),
                                            {
                                                force: true,
                                                recursive: true,
                                            },
                                        );
                                    await fs.promises.rename(path.join(root, "data.in"), path.join(root, "paths", project.meta.name, pth.name, "data.in"));
                                }
                                let hasDataOut = await Portal.fileHas(path.join(root, "data.out"));
                                if (hasDataOut) {
                                    if (doAppRoot)
                                        await fs.promises.cp(
                                            path.join(root, "data.out"),
                                            path.join(appRoot, "paths", project.meta.name, pth.name, "data.out"),
                                            {
                                                force: true,
                                                recursive: true,
                                            },
                                        );
                                    await fs.promises.rename(path.join(root, "data.out"), path.join(root, "paths", project.meta.name, pth.name, "data.out"));
                                }
                                let hasOutLog = await Portal.fileHas(path.join(root, "stdout.log"));
                                if (hasOutLog) await fs.promises.rename(path.join(root, "stdout.log"), path.join(root, "paths", project.meta.name, pth.name, "stdout.log"));
                                let hasErrLog = await Portal.fileHas(path.join(root, "stderr.log"));
                                if (hasErrLog) await fs.promises.rename(path.join(root, "stderr.log"), path.join(root, "paths", project.meta.name, pth.name, "stderr.log"));
                            };
                            process.addHandler("data", async data => {
                                Portal.fileAppend(path.join(root, "stdout.log"), data);
                            });
                            let already = false;
                            const resolve = async data => {
                                if (already) return;
                                already = true;
                                this.log("SPAWN exit", data);
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
                                this.log("SPAWN err", data);
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
                        this.log("SPAWN term");
                        const process = this.processManager.getProcessById("script");
                        if (!(process instanceof Process)) return false;
                        await process.terminate();
                        return true;
                    },
                    "exec-get": async id => {
                        id = String(id);

                        const subcore = await import("./planner/core.mjs");

                        let project = null;
                        try {
                            project = JSON.parse(await kfs["project-get"](id), subcore.REVIVER.f);
                        } catch (e) {}
                        if (!(project instanceof subcore.Project)) throw "Invalid project content with id: "+id;

                        let script = project.config.scriptUseDefault ? Portal.makePath(this.dataPath, "solver", "solver.py") : project.config.script;
                        if (script == null) return {}; // throw "No script for project with id: "+id;
                        script = String(script);
                        let has = await Portal.fileHas(script);
                        if (!has) throw "Script ("+script+") does not exist for project id: "+id;
                        let root = path.dirname(script);

                        let hasMainDir = await Portal.dirHas(path.join(root, "paths"));
                        if (!hasMainDir) return {};
                        let hasProjectDir = await Portal.dirHas(path.join(root, "paths", project.meta.name));
                        if (!hasProjectDir) return {};
                        let datas = {};
                        let pathNames = project.paths.map(id => project.getPath(id).name);
                        let pathList = await Portal.dirList(path.join(root, "paths", project.meta.name));
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
                                contentOut = await Portal.fileRead(path.join(root, "paths", project.meta.name, name, "data.out"));
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
                PRESETS: {
                    "cmd-open-app-data-dir": async () => {
                        await new Promise((res, rej) => {
                            const process = this.processManager.addProcess(new Process("spawn", "open", ["."], { cwd: this.portal.dataPath }));
                            process.addHandler("exit", code => res(code));
                            process.addHandler("error", e => rej(e));
                        });
                    },
                    "cmd-cleanup-app-data-dir": async () => {
                        // await this.portal.cleanup();
                        await this.on("cleanup");
                    },
                    "cmd-open-app-log-dir": async () => {
                        await new Promise((res, rej) => {
                            const process = this.processManager.addProcess(new Process("spawn", "open", ["."], { cwd: Portal.makePath(this.portal.dataPath, "logs") }));
                            process.addHandler("exit", code => res(code));
                            process.addHandler("error", e => rej(e));
                        });
                    },
                    "cmd-clear-app-log-dir": async () => {
                        let dirents = await this.portal.dirList("logs");
                        let n = 0, nTotal = dirents.length;
                        await Promise.all(dirents.map(async dirent => {
                            await this.portal.fileDelete(["logs", dirent.name]);
                            n++;
                            this.cacheSet("clear-app-log-dir-progress", n/nTotal);
                        }));
                        this.cacheSet("clear-app-log-dir-progress", 1);
                    },
                    "cmd-poll-db-host": async () => {
                        (async () => {
                            await this.portal.tryLoad();
                        })();
                    },
                    "feature": async (name, cmd, k, ...a) => {
                        let cmdfs = {
                            get: {
                                "root": async () => {
                                    let content = "";
                                    try {
                                        content = await Portal.Feature.fileRead(this.portal, name, [".config"]);
                                    } catch (e) {}
                                    let data = null;
                                    try {
                                        data = JSON.parse(content);
                                    } catch (e) {}
                                    data = util.ensure(data, "obj");
                                    return util.ensure(data.root, "str", Portal.Feature.getDataPath(this.portal, name));
                                },
                            },
                            set: {
                                "root": async v => {
                                    let content = "";
                                    try {
                                        content = await Portal.Feature.fileRead(this.portal, name, [".config"]);
                                    } catch (e) {}
                                    let data = null;
                                    try {
                                        data = JSON.parse(content);
                                    } catch (e) {}
                                    data = util.ensure(data, "obj");
                                    data.root = util.ensure(v, "str", Portal.Feature.getDataPath(this.portal, name));
                                    if (data.root == Portal.Feature.getDataPath(this.portal, name)) delete data.root;
                                    content = JSON.stringify(data);
                                    await Portal.Feature.fileWrite(this.portal, name, [".config"], content);
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
            };
            let r = null, hasR = false;
            if (this.name in namefs) {
                if (k in namefs[this.name]) {
                    r = await namefs[this.name][k](...a);
                    hasR = true;
                }
            }
            if (doLog) this.log(`ON - ${k}(${a.map(v => simplify(JSON.stringify(v))).join(', ')})`);
            if (!hasR) {
                try {
                    r = await this.portal.on(k, ...a);
                } catch (e) { if (!String(e).startsWith("§O ")) throw e; }
            }
            return r;
        }
        async send(k, ...a) {
            if (!this.started) return false;
            k = String(k);
            this.log(`SEND - ${k}(${a.map(v => simplify(JSON.stringify(v))).join(', ')})`);
            if (!this.hasWindow()) return false;
            this.window.webContents.send("send", k, ...a);
            return true;
        }
        cacheSet(k, v) {
            if (!this.started) return false;
            k = String(k);
            if (!this.hasWindow()) return false;
            this.window.webContents.send("cache-set", k, v);
        }
        cacheDel(k) {
            if (!this.started) return false;
            k = String(k);
            if (!this.hasWindow()) return false;
            this.window.webContents.send("cache-del", k);
        }
        cacheClear() {
            if (!this.started) return false;
            if (!this.hasWindow()) return false;
            this.window.webContents.send("cache-clear");
        }

        update(delta) { this.post("update", delta); }

        static log(name, ...a) {
            return log(`[${name}]`, ...a);
        }
        log(...a) { Portal.Feature.log(this.name, ...a); }
    };

    log("< BUILT PORTAL >");

    const portal = new Portal();

    let initializeResolver = new util.Resolver(false);
    async function whenInitialized() { await initializeResolver.whenTrue(); }

    app.on("activate", async () => {
        log("> activate");
        await whenInitialized();
        portal.start();
    });
    app.on("second-instance", async () => {
        log("> second-instance");
        await whenInitialized();
        portal.start();
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
            stopped = await portal.stop();
        } catch (e) {
            stopped = true;
            showError("Portal Stop Error", e);
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
            await portal.quit();
        } catch (e) { showError("Portal Quit Error", e); }
    });

    await app.whenReady();

    log("> ready");

    let allowStart = await portal.init();
    if (!allowStart) {
        allowQuit = true;
        app.quit();
        return;
    }

    portal.start();
    initializeResolver.state = true;

    let t0 = null;
    let id = setInterval(() => {
        let t1 = util.getTime();
        if (t0 == null) return t1 = t0;
        try {
            portal.update(t1-t0);
        } catch (e) {
            showError("Portal Update Error", e);
            clearInterval(id);
            allowQuit = true;
            app.quit();
            return;
        }
        t1 = t0;
    }, 10);

};
(async () => {
    try {
        await MAIN();
    } catch (e) {
        if (context.showError)
            context.showError("Main Script Error", e);
        if (context.app && context.app.quit)
            context.app.quit();
        process.exit();
    }
})();
