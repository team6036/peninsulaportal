"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const os = require("os");

const path = require("path");
const fs = require("fs");

const cp = require("child_process");

const electron = require("electron");
const app = electron.app;
const ipc = electron.ipcMain;

const fetch = require("electron-fetch").default;
const png2icons = require("png2icons");
const compareVersions = require("compare-versions");

const log = (...a) => {
    let now = new Date();
    let yr = now.getFullYear();
    let mon = String(now.getMonth()+1);
    let d = String(now.getDate());
    let hr = String(now.getHours());
    let min = String(now.getMinutes());
    let s = String(now.getSeconds());
    let ms = String(now.getMilliseconds());
    while (mon.length < 2) mon = "0"+mon;
    while (d.length < 2) d = "0"+d;
    while (hr.length < 2) hr = "0"+hr;
    while (min.length < 2) min = "0"+min;
    while (s.length < 2) s = "0"+s;
    while (ms.length < 3) ms += "0";
    return console.log(`[${yr}-${mon}-${d}/${hr}:${min}:${s}.${ms}]`, ...a);
};

const OS = {
    arch: os.arch(),
    platform: os.platform(),
    cpus: os.cpus(),
    user: os.userInfo(),
};

const MAIN = async () => {
    log("< IMPORTING ASYNCHRONOUSLY >");

    const util = await import("./util.mjs");
    const V = util.V;

    const core = await import("./core.mjs");

    log("< IMPORTED ASYNCHRONOUSLY >");

    const FEATURES = ["PORTAL", "PANEL", "PLANNER", "PRESETS"];

    class Process extends core.Target {
        #id;
        #tags;

        #parent;

        #process;

        constructor(process) {
            super();

            this.#id = null;
            this.#tags = new Set();

            this.#parent = null;

            this.#process = (process instanceof cp.ChildProcess) ? process : cp.exec(process);
            this.process.stdout.on("data", data => this.post("data", { data: data }));
            this.process.stderr.on("data", data => {
                this.post("error", { e: data.toString() });
                this.terminate();
            });
            this.process.on("exit", code => this.post("exit", { code: code }));
            this.process.on("error", e => {
                this.post("error", { e: e });
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
            tag = String(tag);
            return this.#tags.has(tag);
        }
        addTag(tag) {
            tag = String(tag);
            this.#tags.add(tag);
            return true;
        }
        remTag(tag) {
            tag = String(tag);
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

        terminate() {
            if (this.process.exitCode != null) return false;
            this.process.kill("SIGKILL");
            this.post("exit", { code: null });
            return true;
        }
    }
    class ProcessManager extends core.Target {
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
            for (let i = 0; i < this.processes.length; i++)
                if (this.processes[i].id == id)
                    return this.processes[i];
            return null;
        }
        getProcessesByTag(tag) {
            tag = String(tag);
            let processes = [];
            this.processes.forEach(process => (process.hasTag(tag) ? processes.push(process) : null));
            return processes;
        }
    }
    class Portal extends core.Target {
        #started;

        #stream;

        #manager;

        #features;

        #loads;
        #isLoading;

        constructor() {
            super();

            this.#started = false;

            this.#stream = null;

            this.#manager = new ProcessManager();

            this.#features = new Set();

            this.#loads = new Set();
            this.#isLoading = false;

            // electron.nativeTheme.themeSource = "dark";
        }

        async init() {
            await this.affirm();
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
                    label: "New Feature",
                    submenu: [
                        {
                            label: "Peninsula Panel",
                            accelerator: "CmdOrCtrl+1",
                            click: () => this.on("spawn", ["PANEL"]),
                        },
                        {
                            label: "Peninsula Planner",
                            accelerator: "CmdOrCtrl+2",
                            click: () => this.on("spawn", ["PLANNER"]),
                        },
                    ],
                },
            ]));
            return true;
        }

        get stream() { return this.#stream; }
        hasStream() { return this.stream instanceof fs.WriteStream; }

        get manager() { return this.#manager; }

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
            for (let i = 0; i < feats.length; i++)
                await this.remFeature(feats[i]);
            return feats;
        }
        hasFeature(feat) {
            if (!(feat instanceof Portal.Feature)) return false;
            return this.#features.has(feat) && feat.portal == this;
        }
        addFeature(feat) {
            if (!(feat instanceof Portal.Feature)) return false;
            if (this.hasFeature(feat)) return false;
            this.#features.add(feat);
            feat.portal = this;
            feat.start();
            feat._onFocus = () => {
                if (feat.hasMenu()) {
                    if (OS.platform == "darwin")
                        electron.Menu.setApplicationMenu(feat.menu);
                    return;
                }
                if (feat.hasWindow())
                    feat.window.removeListener("focus", feat._onFocus);
                delete feat._onFocus;
            };
            if (feat.hasWindow())
                feat.window.on("focus", feat._onFocus);
            this.post("feature-start", { feat: feat });
            return feat;
        }
        async remFeature(feat) {
            if (!(feat instanceof Portal.Feature)) return false;
            if (!this.hasFeature(feat)) return false;
            feat.log("REM");
            if (feat.started) {
                feat.log("REM - not stopped");
                let r = await feat.stop();
                feat.log(`REM - stop: ${!!r}`);
                return r;
            }
            feat.log("REM - already stopped");
            this.#features.delete(feat);
            feat.portal = null;
            this.post("feature-stop", { feat: feat });
            return feat;
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
            this.post("load-change", { loads: this.loads });
            return true;
        }
        remLoad(load) {
            load = String(load);
            if (!this.hasLoad(load)) return false;
            this.#loads.delete(load);
            this.post("load-change", { loads: this.loads });
            return true;
        }
        get isLoading() { return this.#isLoading; }
        async tryLoad(version) {
            if (this.isLoading) return false;
            version = String(version);
            this.#isLoading = true;
            let r = await (async () => {
                await this.affirm();
                this.log("DB finding host");
                this.clearLoads();
                this.addLoad("find");
                const host = (await this.get("val-db-host")) || "https://peninsula-db.jfancode.repl.co";
                const isCompMode = await this.get("val-comp-mode");
                this.remLoad("find");
                if (isCompMode) {
                    this.log(`DB poll - ${host} - SKIP (COMP MODE)`);
                    this.addLoad("comp-mode");
                    return true;
                }
                this.log(`DB poll - ${host}`);
                this.addLoad("poll");
                try {
                    await util.timeout(10000, fetch(host));
                } catch (e) {
                    this.log(`DB poll - ${host} - fail`);
                    this.remLoad("poll");
                    this.addLoad("poll:"+e);
                    return false;
                }
                this.log(`DB poll - ${host} - success`);
                this.remLoad("poll");
                let fsVersion = "";
                try {
                    fsVersion = await this.fileRead(".version");
                } catch (e) {}
                this.log(`DB fs-version check (${fsVersion} ?<= ${version})`);
                this.addLoad("fs-version");
                if (compareVersions.validateStrict(fsVersion) && compareVersions.compare(fsVersion, version, ">")) {
                    this.log(`DB fs-version mismatch (${fsVersion} !<= ${version})`);
                    this.remLoad("fs-version");
                    this.addLoad("fs-version:"+fsVersion+" > "+version);
                    return false;
                }
                this.log(`DB fs-version match (${fsVersion} <= ${version})`);
                this.remLoad("fs-version");
                await this.fileWrite(".version", version);
                const fetchAndPipe = async (url, pth) => {
                    let fileName = path.basename(pth);
                    let superPth = path.dirname(pth);
                    let thePth = path.join(superPth, fileName);
                    let tmpPth = path.join(superPth, fileName+"-tmp");
                    let resp = await util.timeout(10000, fetch(url));
                    if (resp.status != 200) throw resp.status;
                    await new Promise((res, rej) => {
                        const stream = fs.createWriteStream(tmpPth);
                        stream.on("open", () => {
                            resp.body.pipe(stream);
                            resp.body.on("end", () => res(true));
                            resp.body.on("error", e => rej(e));
                            resp.body.on("progress", e => console.log(url, e.loaded/e.total));
                        });
                    });
                    await fs.promises.rename(tmpPth, thePth);
                };
                await Promise.all([
                    (async () => {
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
                    })(),
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
                                    await fetchAndPipe(host+"/templates/"+name+"."+tag, path.join(this.dataPath, "templates", section, name+"."+tag));
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
                                    await fetchAndPipe(host+"/robots/"+name+"."+tag, path.join(this.dataPath, "robots", section, name+"."+tag));
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
                                    await fetchAndPipe(host+"/holidays/"+pth, path.join(this.dataPath, "holidays", "icons", pth));
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
                                                    path.join(__dirname, name.toLowerCase(), "solver"), path.join(Portal.Feature.getDataPath(this, name), "solver"),
                                                    {
                                                        force: true,
                                                        recursive: true,
                                                    }
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
            if (this.started) return false;
            this.#started = true;

            this.log("START");

            ipc.handle("os", async () => {
                return OS;
            });

            ipc.handle("get", async (e, k) => await this.getCallback(e.sender.id, k));
            ipc.handle("set", async (e, k, v) => await this.setCallback(e.sender.id, k, v));

            ipc.handle("on", async (e, k, args) => {
                return await this.onCallback(e.sender.id, k, args);
            });

            ipc.handle("file-has", async (e, pth) => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileHas(pth);
            });
            ipc.handle("file-read", async (e, pth) => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileRead(pth);
            });
            ipc.handle("file-write", async (e, pth, content) => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileWrite(pth, content);
            });
            ipc.handle("file-append", async (e, pth, content) => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileAppend(pth, content);
            });
            ipc.handle("file-delete", async (e, pth) => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileDelete(pth);
            });

            ipc.handle("dir-has", async (e, pth) => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.dirHas(pth);
            });
            ipc.handle("dir-list", async (e, pth) => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.dirList(pth);
            });
            ipc.handle("dir-make", async (e, pth) => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.dirMake(pth);
            });
            ipc.handle("dir-delete", async (e, pth) => {
                let feat = this.identifyFeature(e.sender.id);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.dirDelete(pth);
            });

            (async () => {
                await this.affirm();
                await this.post("start", null);

                this.addFeature(new Portal.Feature("PORTAL"));
                setTimeout(async () => {
                    await this.tryLoad(await this.get("version"));
                }, 1000);
            })();

            return true;
        }
        async stop() {
            this.log("STOP");
            this.manager.processes.forEach(process => process.terminate());
            await this.post("stop", null);
            let feats = this.features;
            let all = true;
            for (let i = 0; i < feats.length; i++)
                all &&= await this.remFeature(feats[i]);
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
            let hasVersion = await this.fileHas([dataPath, ".version"]);
            if (!hasVersion) await this.fileWrite([dataPath, ".version"], "");
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
                while (mon.length < 2) mon = "0"+mon;
                while (d.length < 2) d = "0"+d;
                while (hr.length < 2) hr = "0"+hr;
                while (min.length < 2) min = "0"+min;
                while (s.length < 2) s = "0"+s;
                while (ms.length < 3) ms += "0";
                let name = `${yr}-${mon}-${d} ${hr}-${min}-${s}-${ms}.log`;
                this.#stream = fs.createWriteStream(Portal.makePath(this.dataPath, "logs", name));
                await new Promise((res, rej) => this.stream.on("open", () => res()));
            }
            return r;
        }
        static async cleanup(dataPath, version) {
            version = String(version);
            log(". cleanup");
            let fsVersion = "";
            try {
                fsVersion = await this.fileRead([dataPath, ".version"]);
            } catch (e) {}
            log(`. cleanup - fs-version check (${fsVersion} ?<= ${version})`);
            if (compareVersions.validateStrict(fsVersion) && compareVersions.compare(fsVersion, version, ">")) {
                log(`. cleanup - fs-version mismatch (${fsVersion} !<= ${version})`);
                return false;
            }
            log(`. cleanup - fs-version match (${fsVersion} <= ${version})`);
            await this.fileWrite([dataPath, ".version"], version);
            const l = (...a) => log(". deleting "+Portal.makePath(...a));
            const format = [
                // ./logs
                {
                    type: "dir", name: "logs",
                    children: [
                        // ./logs/*.log
                        { type: "file", match: (_, name) => name.endsWith(".log") },
                    ],
                },
                // ./templates
                {
                    type: "dir", name: "templates",
                    children: [
                        // ./templates/images
                        {
                            type: "dir", name: "images",
                            children: [
                                // ./templates/images/*.png
                                // ./templates/images/*.png-tmp
                                { type: "file", match: (_, name) => (name.endsWith(".png") || name.endsWith(".png-tmp")) },
                            ],
                        },
                        // ./templates/models
                        {
                            type: "dir", name: "models",
                            children: [
                                // ./templates/models/*.glb
                                // ./templates/models/*.glb-tmp
                                { type: "file", match: (_, name) => (name.endsWith(".glb") || name.endsWith(".glb-tmp")) }
                            ],
                        },
                        // ./templates/templates.json
                        { type: "file", name: "templates.json" }
                    ],
                },
                // ./robots
                {
                    type: "dir", name: "robots",
                    children: [
                        // ./robots/models
                        {
                            type: "dir", name: "models",
                            children: [
                                // ./robots/models/*.glb
                                // ./robots/models/*.glb-tmp
                                { type: "file", match: (_, name) => (name.endsWith(".glb") || name.endsWith(".glb-tmp")) }
                            ],
                        },
                        // ./robots/robots.json
                        { type: "file", name: "robots.json" }
                    ],
                },
                // ./holidays
                {
                    type: "dir", name: "holidays",
                    children: [
                        // ./holidays/icons
                        {
                            type: "dir", name: "icons",
                            children: [
                                // ./holidays/icons/*.svg
                                // ./holidays/icons/*.png
                                // ./holidays/icons/*.ico
                                // ./holidays/icons/*.icns
                                // ./holidays/icons/*.svg-tmp
                                // ./holidays/icons/*.png-tmp
                                // ./holidays/icons/*.ico-tmp
                                // ./holidays/icons/*.icns-tmp
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
                        // ./holidays/holidays.json
                        { type: "file", name: "holidays.json" }
                    ],
                },
                // ./<feature>
                { type: "dir", match: (_, name) => FEATURES.includes(name.toUpperCase()) },
                // ./panel
                {
                    type: "dir", name: "panel",
                    children: [
                        // ./panel/projects
                        {
                            type: "dir", name: "projects",
                            children: [
                                // ./panel/projects/*.json
                                { type: "file", match: (_, name) => name.endsWith(".json") },
                            ],
                        },
                        // ./panel/projects.json
                        { type: "file", name: "projects.json" },
                    ],
                },
                // ./planner
                {
                    type: "dir", name: "planner",
                    children: [
                        // ./planner/projects
                        {
                            type: "dir", name: "projects",
                            children: [
                                // ./planner/projects/*.json
                                { type: "file", match: (_, name) => name.endsWith(".json") },
                            ],
                        },
                        // ./planner/projects.json
                        { type: "file", name: "projects.json" },
                        // ./planner/templates.json
                        { type: "file", name: "templates.json" },
                        // ./planner/solver
                        { type: "dir", name: "solver" },
                    ],
                },
            ];
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
                    if (dirent.type == "dir") await this.dirDelete([...pth, dirent.name]);
                    else await this.fileDelete([...pth, dirent.name]);
                }));
            };
            await cleanup([dataPath], format);
            return true;
        }
        async cleanup() { return await Portal.cleanup(this.dataPath, await this.get("version")); }

        static makePath(...pth) {
            let flattened = [];
            const dfs = itm => {
                if (util.is(itm, "arr")) util.ensure(itm, "arr").forEach(itm => dfs(itm));
                else flattened.push(itm);
            };
            dfs(pth);
            return path.join(...flattened);
        }
        static async fileHas(pth) {
            pth = this.makePath(pth);
            this.log(`fs:file-has ${pth}`);
            try {
                await fs.promises.access(pth);
                return true;
            } catch (e) {}
        }
        static async fileRead(pth) {
            pth = this.makePath(pth);
            this.log(`fs:file-read ${pth}`);
            return await fs.promises.readFile(pth, { encoding: "utf-8" });
        }
        static async fileWrite(pth, content) {
            pth = this.makePath(pth);
            this.log(`fs:file-write ${pth}`);
            return await fs.promises.writeFile(pth, content, { encoding: "utf-8" });
        }
        static async fileAppend(pth, content) {
            pth = this.makePath(pth);
            this.log(`fs:file-append ${pth}`);
            return await fs.promises.appendFile(pth, content, { encoding: "utf-8" });
        }
        static async fileDelete(pth) {
            pth = this.makePath(pth);
            this.log(`fs:file-delete ${pth}`);
            return await fs.promises.unlink(pth);
        }

        static async dirHas(pth) {
            pth = this.makePath(pth);
            this.log(`fs:dir-has ${pth}`);
            try {
                await fs.promises.access(pth);
                return true;
            } catch (e) {}
            return false;
        }
        static async dirList(pth) {
            pth = this.makePath(pth);
            this.log(`fs:dir-list ${pth}`);
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
            this.log(`fs:dir-make ${pth}`);
            return await fs.promises.mkdir(pth);
        }
        static async dirDelete(pth) {
            pth = this.makePath(pth);
            this.log(`fs:dir-delete ${pth}`);
            return await fs.promises.rmdir(pth);
        }

        async fileHas(pth) { return Portal.fileHas([this.dataPath, pth]); }
        async fileRead(pth) { return Portal.fileRead([this.dataPath, pth]); }
        async fileWrite(pth, content) { return Portal.fileWrite([this.dataPath, pth], content); }
        async fileAppend(pth, content) { return Portal.fileAppend([this.dataPath, pth], content); }
        async fileDelete(pth) { return Portal.fileDelete([this.dataPath, pth]); }

        async dirHas(pth) { return Portal.dirHas([this.dataPath, pth]); }
        async dirList(pth) { return Portal.dirList([this.dataPath, pth]); }
        async dirMake(pth) { return Portal.dirMake([this.dataPath, pth]); }
        async dirDelete(pth) { return Portal.dirDelete([this.dataPath, pth]); }

        identifyFeature(id) {
            let feats = this.features;
            for (let i = 0; i < feats.length; i++) {
                if (!feats[i].hasWindow()) continue;
                if (id == feats[i].window.webContents.id)
                    return feats[i];
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
                "fs-version": async () => await this.fileRead(".version"),
                "_fullpackage": async () => {
                    let content = "";
                    try {
                        content = await Portal.fileRead(path.join(__dirname, "package.json"));
                    } catch (e) {}
                    let data = null;
                    try {
                        data = JSON.parse(content);
                    } catch (e) {}
                    data = util.ensure(data, "obj");
                    return data;
                },
                "version": async () => {
                    return String((await kfs._fullpackage()).version) + ((await this.get("production")) ? "" : "-dev");
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
                    return host || "https://peninsula-db.jfancode.repl.co";
                },
                "comp-mode": async () => {
                    return !!(await kfs._fullconfig()).isCompMode;
                },
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
                "repo": async () => await this.get("repo"),
                "holiday": async () => await this.get("active-holiday"),
                "comp-mode": async () => await this.get("comp-mode"),
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
                "comp-mode": async () => await kfs._fullconfig("isCompMode", !!v),
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
        async on(k, args) {
            k = String(k);
            args = util.ensure(args, "arr");
            let kfs = {
                "spawn": async name => {
                    name = String(name);
                    let feats = this.features;
                    let hasFeat = null;
                    feats.forEach(feat => {
                        if (feat.name != name) return;
                        hasFeat = feat;
                    });
                    if (hasFeat instanceof Portal.Feature) {
                        if (hasFeat.hasWindow()) hasFeat.window.show();
                        return false;
                    }
                    if (!FEATURES.includes(name)) return false;
                    let feat = new Portal.Feature(name);
                    this.addFeature(feat);
                    return true;
                },
                "notify": async options => {
                    const notif = new electron.Notification(options);
                    notif.show();
                },
            };
            if (k in kfs) return await kfs[k](...args);
            throw "§O No possible \"on\" for key: "+k;
        }
        async onCallback(id, k, args) {
            try {
                return await this.on(k, args);
            } catch (e) { if (!String(e).startsWith("§O ")) throw e; }
            let feat = this.identifyFeature(id);
            if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+id;
            return await feat.on(k, args);
        }
        async send(k, args) {
            await Promise.all(this.features.map(async feat => await feat.send(k, args)));
            return true;
        }

        update() {
            this.post("update", null);
            this.features.forEach(feat => feat.update());
        }

        static log(...a) {
            return;
            return log(".", ...a);
        }
        log(...a) {
            return log(":", ...a);
        }
    }
    Portal.Feature = class PortalFeature extends core.Target {
        #portal;

        #manager;

        #name;

        #window;
        #menu;
        #perm;

        #started;

        constructor(name) {
            super();

            this.#portal = null;

            this.#manager = new ProcessManager();

            name = String(name).toUpperCase();
            this.#name = FEATURES.includes(name) ? name : null;
            
            this.#window = null;
            this.#menu = null;
            this.#perm = false;

            this.#started = false;

            this.log();
        }

        get manager() { return this.#manager; }

        get portal() { return this.#portal; }
        set portal(v) {
            v = (v instanceof Portal) ? v : null;
            if (this.portal == v) return;
            (async () => {
                if (this.hasPortal()) {
                    await this.portal.remFeature(this);
                    this.post("portal-unhook", { portal: this.portal });
                }
                this.#portal = v;
                if (this.hasPortal()) {
                    this.portal.addFeature(this);
                    this.post("portal-hook", { portal: this.portal });
                }
            })();
        }
        hasPortal() { return this.portal instanceof Portal; }
        
        get name() { return this.#name; }
        hasName() { return util.is(this.name, "str"); }

        get window() { return this.#window; }
        hasWindow() { return (this.window instanceof electron.BrowserWindow) && !this.window.isDestroyed() && !this.window.webContents.isDestroyed(); }
        get menu() { return this.#menu; }
        hasMenu() { return this.menu instanceof electron.Menu; }
        get perm() { return this.#perm; }
        set perm(v) { this.#perm = !!v; }

        async getPerm() {
            if (!this.started) return true;
            if (!this.hasName()) return false;
            this.log("GET PERM");
            let perm = await new Promise((res, rej) => {
                if (!this.hasWindow()) return;
                this.window.webContents.send("perm");
                ipc.once("perm", (e, given) => {
                    if (!this.hasWindow()) return;
                    if (e.sender.id != this.window.webContents.id) return;
                    res(!!given);
                });
                setTimeout(() => res(true), 5000);
            });
            let namefs = {
            };
            if (this.name in namefs) perm &&= namefs[this.name]();
            return perm;
        }

        get started() { return this.#started; }
        start() {
            if (this.started) return false;
            if (!this.hasName()) return false;
            this.log("START");
            this.#started = true;

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
                if (!this.hasPortal()) return;
                let tag = "png";
                let icon = (holiday == null) ? path.join(__dirname, "assets", "app", "icon."+tag) : util.ensure(util.ensure(await this.get("holiday-icons"), "obj")[holiday], "obj")[tag];
                if (!this.hasWindow()) return;
                if (OS.platform == "win32") this.window.setIcon(icon);
                if (OS.platform == "darwin") app.dock.setIcon(icon);
                if (OS.platform == "linux") this.window.setIcon(icon);
            };
            (async () => await onHolidayState(await this.get("active-holiday")))();
            this.#window = new electron.BrowserWindow(options);
            this.window.once("ready-to-show", () => {
                if (!this.hasWindow()) return;
                this.window.show();
                this.post("show", null);
            });

            this.window.on("unresponsive", () => {});
            this.window.webContents.on("did-fail-load", () => { if (this.hasWindow()) this.window.close(); });
            this.window.webContents.on("will-navigate", (e, url) => {
                if (!this.hasWindow()) return;
                if (url != this.window.webContents.getURL()) {
                    e.preventDefault();
                    electron.shell.openExternal(url);
                }
            });
            if (this.hasPortal()) {
                let any = false;
                this.portal.features.filter(feat => feat.hasWindow()).forEach(feat => (any ||= feat.hasWindow() && feat.window.webContents.isDevToolsOpened()));
                if (this.hasWindow() && any) this.window.webContents.openDevTools();
            }
            this.window.webContents.on("devtools-opened", () => {
                if (!this.hasPortal()) return;
                this.portal.features.filter(feat => feat.hasWindow()).forEach(feat => feat.window.webContents.openDevTools());
            });
            this.window.webContents.on("devtools-closed", () => {
                if (!this.hasPortal()) return;
                this.portal.features.filter(feat => feat.hasWindow()).forEach(feat => feat.window.webContents.closeDevTools());
            });

            this.window.on("enter-full-screen", () => this.send("win-fullscreen", [true]));
            this.window.on("leave-full-screen", () => this.send("win-fullscreen", [false]));

            this.perm = false;
            this.window.on("close", e => {
                this.log("CLOSE");
                if (this.perm) return this.log("CLOSE - yes perm");
                this.log("CLOSE - no perm");
                e.preventDefault();
                this.stop();
            });

            this.window.loadFile(path.join(__dirname, this.name.toLowerCase(), "index.html"));

            const build = {
                about: [
                    {
                        label: "About Peninsula "+util.capitalize(this.name),
                        click: () => this.send("about"),
                    },
                ],
                settings: [
                    {
                        label: "Settings",
                        accelerator: "CmdOrCtrl+,",
                        click: () => this.on("spawn", ["PRESETS"]),
                    },
                ],
                hide: [
                    { role: "hide" },
                    { role: "hideOthers" },
                    { role: "unhide" },
                ],
                quit: [
                    { role: "quit" },
                ],
                close: [
                    { role: "close" },
                ],
                undoredo: [
                    { role: "undo" },
                    { role: "redo" },
                ],
                cutcopypaste: [
                    { role: "cut" },
                    { role: "copy" },
                    { role: "paste" },
                ],
                fullscreen: [
                    { role: "togglefullscreen" },
                ],
                window: [
                    { role: "minimize" },
                    { role: "zoom" },
                ],
                front: [
                    { role: "front" },
                ],
                help: [
                    {
                        label: "Ionicons",
                        click: () => electron.shell.openExternal("https://ionic.io/ionicons"),
                    },
                    {
                        label: "Github Repository",
                        click: async () => await electron.shell.openExternal(await this.get("repo")),
                    },
                    {
                        label: "Open Database",
                        click: async () => await electron.shell.openExternal(await this.get("db-host")),
                    },
                ],
                spawn: [
                    {
                        label: "New Feature",
                        submenu: [
                            {
                                label: "Peninsula Panel",
                                accelerator: "CmdOrCtrl+1",
                                click: () => this.on("spawn", ["PANEL"]),
                            },
                            {
                                label: "Peninsula Planner",
                                accelerator: "CmdOrCtrl+2",
                                click: () => this.on("spawn", ["PLANNER"]),
                            },
                        ],
                    },
                ],
                div: { type: "separator" },
            };
            let template = [
                {
                    label: util.capitalize(this.name),
                    submenu: [
                        ...build.about,
                        build.div,
                        ...build.settings,
                        build.div,
                        ...build.hide,
                        build.div,
                        ...build.quit,
                    ],
                },
                {
                    label: "File",
                    submenu: [
                        ...build.spawn,
                        build.div,
                        ...build.close,
                    ],
                },
                {
                    label: "Edit",
                    submenu: [
                        ...build.undoredo,
                        build.div,
                        ...build.cutcopypaste,
                    ],
                },
                {
                    label: "View",
                    submenu: [
                        ...build.fullscreen,
                    ],
                },
                {
                    label: "Window",
                    submenu: [
                        ...build.window,
                        ...(
                            (OS.platform == "darwin") ?
                            [
                                { type: "separator" },
                                { role: "front" },
                            ] :
                            []
                        ),
                        { id: "toggleDevTools", role: "toggleDevTools" },
                    ],
                },
                {
                    role: "help",
                    submenu: [
                        ...build.help,
                    ],
                },
            ];

            namefs = {
                PORTAL: () => {
                    const checkForShow = () => {
                        if (!this.hasPortal()) return;
                        if (!this.hasWindow()) return;
                        let feats = this.portal.features;
                        let nFeats = 0;
                        feats.forEach(feat => (["PORTAL"].includes(feat.name) ? null : nFeats++));
                        (nFeats > 0) ? this.window.hide() : this.window.show();
                    };
                    const hook = () => {
                        if (!this.hasPortal()) return;
                        this.portal.addHandler("feature-start", checkForShow);
                        this.portal.addHandler("feature-stop", checkForShow);
                    };
                    const unhook = () => {
                        if (!this.hasPortal()) return;
                        this.portal.remHandler("feature-start", checkForShow);
                        this.portal.remHandler("feature-stop", checkForShow);
                    };
                    this.addHandler("portal-hook", data => hook());
                    this.addHandler("portal-unhook", data => unhook());
                    hook();
                    checkForShow();
                },
                PANEL: () => {
                    template[1].submenu.splice(
                        2, 0,
                        {
                            id: "newproject",
                            label: "New Project",
                            accelerator: "CmdOrCtrl+N",
                            click: () => this.send("newproject"),
                        },
                        {
                            id: "newtab",
                            label: "New Tab",
                            accelerator: "CmdOrCtrl+Shift+N",
                            click: () => this.send("newtab"),
                        },
                        build.div,
                        {
                            id: "save",
                            label: "Save",
                            accelerator: "CmdOrCtrl+S",
                            click: () => this.send("save"),
                        },
                        {
                            id: "savecopy",
                            label: "Save as copy",
                            accelerator: "CmdOrCtrl+Shift+S",
                            click: () => this.send("savecopy"),
                        },
                        build.div,
                        {
                            id: "delete",
                            label: "Delete Project",
                            click: () => this.send("delete"),
                        },
                        {
                            id: "closetab",
                            label: "Close Tab",
                            accelerator: "CmdOrCtrl+Shift+W",
                            click: () => this.send("closetab"),
                        },
                        {
                            id: "close",
                            label: "Close Project",
                            click: () => this.send("close"),
                        },
                    );
                    template[2].submenu.unshift(
                        {
                            id: "conndisconn",
                            label: "Toggle Connect / Disconnect",
                            click: () => this.send("conndisconn"),
                        },
                        build.div,
                    );
                    template[3].submenu.unshift(
                        {
                            id: "openclose",
                            label: "Toggle Options Opened / Closed",
                            accelerator: "Ctrl+F",
                            click: () => this.send("openclose"),
                        },
                        {
                            id: "expandcollapse",
                            label: "Toggle Title Collapsed",
                            accelerator: "Ctrl+Shift+F",
                            click: () => this.send("expandcollapse"),
                        },
                        build.div,
                    );
                },
                PLANNER: () => {
                    template[1].submenu.splice(
                        2, 0,
                        {
                            id: "newproject",
                            label: "New Project",
                            accelerator: "CmdOrCtrl+N",
                            click: () => this.send("newproject"),
                        },
                        build.div,
                        {
                            id: "addnode",
                            label: "Add Node",
                            click: () => this.send("addnode"),
                        },
                        {
                            id: "addobstacle",
                            label: "Add Obstacle",
                            click: () => this.send("addobstacle"),
                        },
                        {
                            id: "addpath",
                            label: "Add Path",
                            click: () => this.send("addpath"),
                        },
                        build.div,
                        {
                            id: "save",
                            label: "Save",
                            accelerator: "CmdOrCtrl+S",
                            click: () => this.send("save"),
                        },
                        {
                            id: "savecopy",
                            label: "Save as copy",
                            accelerator: "CmdOrCtrl+Shift+S",
                            click: () => this.send("savecopy"),
                        },
                        build.div,
                        {
                            id: "delete",
                            label: "Delete Project",
                            click: () => this.send("delete"),
                        },
                        {
                            id: "close",
                            label: "Close Project",
                            accelerator: "CmdOrCtrl+Shift+W",
                            click: () => this.send("close"),
                        },
                    );
                    template[3].submenu.unshift(
                        {
                            id: "maxmin",
                            label: "Toggle Maximized",
                            accelerator: "Ctrl+F",
                            click: () => this.send("maxmin"),
                        },
                        {
                            id: "resetdivider",
                            label: "Reset Divider",
                            click: () => this.send("resetdivider"),
                        },
                        build.div,
                    );
                },
            };

            if (namefs[this.name]) namefs[this.name]();

            this.#menu = electron.Menu.buildFromTemplate(template);
            this.window.setMenu(this.menu);
            
            (async () => {
                let fsVersion = String(await this.get("fs-version"));
                let version = String(await this.get("version"));
                if (compareVersions.validateStrict(fsVersion) && compareVersions.compare(fsVersion, version, ">")) {
                    setTimeout(() => {
                        this.send("deprecated", [version]);
                    }, 500);
                } else {
                    await this.portal.fileWrite(".version", version);
                }
                let prevIsDevMode = null;
                const checkDevConfig = async () => {
                    let isDevMode = !!(await this.get("devmode"));
                    this.on("menu-ables", [{ toggleDevTools: isDevMode }]);
                    if (prevIsDevMode != isDevMode) {
                        prevIsDevMode = isDevMode;
                        this.send("win-devmode", [isDevMode]);
                    }
                };
                let prevHoliday = null;
                const checkHoliday = async () => {
                    let holiday = await this.get("active-holiday");
                    holiday = (holiday == null) ? null : String(holiday);
                    await onHolidayState(holiday);
                    if (prevHoliday != holiday) {
                        prevHoliday = holiday;
                        this.send("win-holiday", [holiday]);
                    }
                };
                fs.watchFile(path.join(__dirname, ".config"), () => checkDevConfig());
                fs.watchFile(path.join(this.portal.dataPath, "holidays", "holidays.json"), () => checkHoliday());
                await checkDevConfig();
                await checkHoliday();
                if (!this.canOperate) return;
                let bounds = util.ensure(await this.on("state-get", ["bounds"]), "obj");
                if (!this.hasWindow()) return;
                if (("width" in bounds) && (bounds.width < 50)) return;
                if (("height" in bounds) && (bounds.height < 50)) return;
                this.window.setContentBounds(bounds);
            })();

            return this;
        }
        async stop() {
            if (!this.started) return false;
            if (!this.hasName()) return false;
            this.log("STOP");
            if (!this.perm) {
                this.log("STOP - no perm > get perm");
                this.perm = await this.getPerm();
            }
            this.log(`STOP - perm: ${this.perm}`);
            if (!this.perm) return false;
            if (this.canOperate && this.hasWindow()) await this.on("state-set", ["bounds", this.window.getBounds()]);
            this.#started = false;
            this.manager.processes.forEach(process => process.terminate());
            if (this.hasWindow()) this.window.close();
            this.#window = null;
            this.#menu = null;
            this.portal = null;
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
        static async fileWrite(portal, name, pth, content, started=true) {
            if (!this.getCanOperate(portal, name, started)) return null;
            await this.affirm(portal, name, started);
            return await Portal.fileWrite(Portal.makePath(this.getDataPath(portal, name, started), pth), content);
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
        async fileWrite(pth, content) { return Portal.Feature.fileWrite(this.portal, this.name, pth, content, this.started); }
        async fileAppend(pth, content) { return Portal.Feature.fileAppend(this.portal, this.name, pth, content, this.started); }
        async fileDelete(pth) { return Portal.Feature.fileDelete(this.portal, this.name, pth, this.started); }

        async dirHas(pth) { return Portal.Feature.dirHas(this.portal, this.name, pth, this.started); }
        async dirList(pth) { return Portal.Feature.dirList(this.portal, this.name, pth, this.started); }
        async dirMake(pth) { return Portal.Feature.dirMake(this.portal, this.name, pth, this.started); }
        async dirDelete(pth) { return Portal.Feature.dirDelete(this.portal, this.name, pth, this.started); }

        async get(k) {
            if (!this.started) return null;
            if (!this.hasName()) return null;
            k = String(k);
            if (this.hasPortal()) {
                try {
                    return await this.portal.get(k);
                } catch (e) { if (!String(e).startsWith("§G ")) throw e; }
            }
            this.log(`GET - ${k}`);
            let kfs = {
                "name": async () => {
                    return this.name;
                },
                "fullscreenable": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isFullScreenable();
                },
                "fullscreen": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isFullScreen();
                },
                "closeable": async () => {
                    if (!this.hasWindow()) return null;
                    return this.window.isClosable();
                },
            };
            if (k in kfs) return await kfs[k]();
            return null;
        }
        async set(k, v) {
            if (!this.started) return false;
            if (!this.hasName()) return false;
            k = String(k);
            if (this.hasPortal()) {
                try {
                    return await this.portal.set(k, v);
                } catch (e) { if (!String(e).startsWith("§S ")) throw e; }
            }
            this.log(`SET - ${k} = ${JSON.stringify(v)}`);
            let kfs = {
                "fullscreenable": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setFullScreenable(!!v);
                    return true;
                },
                "fullscreen": async () => {
                    if (!this.hasWindow()) return false;
                    this.window.setFullScreen(!!v);
                    return true;
                },
                "closeable": async () => {
                    if (!this.hasWindow()) return false;
                    let maximizable = this.window.isMaximizable();
                    this.window.setClosable(!!v);
                    this.window.setMaximizable(maximizable);
                    return true;
                },
            };
            if (k in kfs) return await kfs[k]();
            return false;
        }
        async on(k, args) {
            if (!this.started) return null;
            if (!this.hasName()) return null;
            k = String(k);
            args = util.ensure(args, "arr");
            if (this.hasPortal()) {
                try {
                    return await this.portal.on(k, args);
                } catch (e) { if (!String(e).startsWith("§O ")) throw e; }
            }
            this.log(`ON - ${k}(${args.map(v => JSON.stringify(v)).join(', ')})`);
            let kfs = {
                "close": async () => await this.stop(),
                "menu-ables": async menuAbles => {
                    menuAbles = util.ensure(menuAbles, "obj");
                    for (let id in menuAbles) {
                        let able = !!menuAbles[id];
                        let menu = this.menu.getMenuItemById(id);
                        if (!(menu instanceof electron.MenuItem)) continue;
                        menu.enabled = able;
                    }
                    return true;
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
            };
            if (k in kfs)
                return await kfs[k](...args);
            let namefs = {
                PRESETS: {
                    "cmd-open-app-data-dir": async () => {
                        if (!this.hasPortal()) throw "No linked portal";
                        await new Promise((res, rej) => {
                            const process = this.manager.addProcess(new Process(cp.spawn("open", ["."], { cwd: this.portal.dataPath })));
                            process.addHandler("exit", data => res(data.code));
                            process.addHandler("error", data => rej(data.e));
                        });
                    },
                    "cmd-cleanup-app-data-dir": async () => {
                        if (!this.hasPortal()) throw "No linked portal";
                        await this.portal.cleanup();
                    },
                    "cmd-open-app-log-dir": async () => {
                        if (!this.hasPortal()) throw "No linked portal";
                        await new Promise((res, rej) => {
                            const process = this.manager.addProcess(new Process(cp.spawn("open", ["."], { cwd: Portal.makePath(this.portal.dataPath, "logs") })));
                            process.addHandler("exit", data => res(data.code));
                            process.addHandler("error", data => rej(data.e));
                        });
                    },
                    "cmd-clear-app-log-dir": async () => {
                        if (!this.hasPortal()) throw "No linked portal";
                        await Promise.all((await this.portal.dirList("logs")).map(dirent => this.portal.fileDelete(["logs", dirent.name])));
                    },
                    "cmd-poll-db-host": async () => {
                        if (!this.hasPortal()) throw "No linked portal";
                        (async () => {
                            await this.portal.tryLoad(await this.get("version"));
                        })();
                    },
                },
                PLANNER: {
                    "exec": async (id, pathId) => {
                        id = String(id);
                        pathId = String(pathId);

                        const subcore = await import("./planner/core.mjs");

                        if (!this.hasPortal()) throw "No linked portal";
                        let hasProjectContent = await this.fileHas(["projects", id+".json"]);
                        if (!hasProjectContent) throw "Nonexistent project with id: "+id;
                        let projectContent = await this.fileRead(["projects", id+".json"]);
                        let project = null;
                        try {
                            project = JSON.parse(projectContent, subcore.REVIVER.f);
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
                            if (this.manager.getProcessById("script") instanceof Process) return rej("Existing process has not terminated");
                            this.log("SPAWN");
                            const process = this.manager.addProcess(new Process(cp.spawn(project.config.scriptPython, [script], { cwd: root })));
                            process.id = "script";
                            const finish = async () => {
                                let hasMainDir = await Portal.dirHas(path.join(root, "paths"));
                                if (!hasMainDir) await Portal.dirMake(path.join(root, "paths"));
                                let hasProjectDir = await Portal.dirHas(path.join(root, "paths", project.meta.name));
                                if (!hasProjectDir) await Portal.dirMake(path.join(root, "paths", project.meta.name));
                                let hasPathDir = await Portal.dirHas(path.join(root, "paths", project.meta.name, pth.name));
                                if (!hasPathDir) await Portal.dirMake(path.join(root, "paths", project.meta.name, pth.name));
                                let hasDataIn = await Portal.fileHas(path.join(root, "data.in"));
                                if (hasDataIn) await fs.promises.rename(path.join(root, "data.in"), path.join(root, "paths", project.meta.name, pth.name, "data.in"));
                                let hasDataOut = await Portal.fileHas(path.join(root, "data.out"));
                                if (hasDataOut) await fs.promises.rename(path.join(root, "data.out"), path.join(root, "paths", project.meta.name, pth.name, "data.out"));
                                let hasOutLog = await Portal.fileHas(path.join(root, "stdout.log"));
                                if (hasOutLog) await fs.promises.rename(path.join(root, "stdout.log"), path.join(root, "paths", project.meta.name, pth.name, "stdout.log"));
                                let hasErrLog = await Portal.fileHas(path.join(root, "stderr.log"));
                                if (hasErrLog) await fs.promises.rename(path.join(root, "stderr.log"), path.join(root, "paths", project.meta.name, pth.name, "stderr.log"));
                            };
                            process.addHandler("data", async data => {
                                Portal.fileAppend(path.join(root, "stdout.log"), util.ensure(data, "obj").data);
                            });
                            let already = false;
                            const resolve = async data => {
                                data = util.ensure(data, "obj");
                                if (already) return;
                                already = true;
                                this.log("SPAWN exit", data.code);
                                await finish();
                                if (!this.hasWindow() || !this.window.isVisible() || !this.window.isFocused()) {
                                    const notif = new electron.Notification({
                                        title: "Script Process Finished",
                                        body: "Your script finished executing with no errors!",
                                    });
                                    notif.show();
                                }
                                return res(data.code);
                            };
                            const reject = async data => {
                                data = util.ensure(data, "obj");
                                if (already) return;
                                already = true;
                                this.log("SPAWN err", data.e);
                                await finish();
                                if (!this.hasWindow() || !this.window.isVisible() || !this.window.isFocused()) {
                                    const notif = new electron.Notification({
                                        title: "Script Process Finished",
                                        body: "Your script finished executing with an error!",
                                    });
                                    notif.show();
                                }
                                return rej(data.e);
                            };
                            process.addHandler("exit", data => resolve(data));
                            process.addHandler("error", data => reject(data));
                        });
                    },
                    "exec-term": async () => {
                        this.log("SPAWN term");
                        const process = this.manager.getProcessById("script");
                        if (!(process instanceof Process)) return false;
                        process.terminate();
                        return true;
                    },
                    "exec-get": async id => {
                        id = String(id);

                        const subcore = await import("./planner/core.mjs");

                        if (!this.hasPortal()) throw "No linked portal";
                        let hasProjectContent = await this.fileHas(["projects", id+".json"]);
                        if (!hasProjectContent) throw "Nonexistent project with id: "+id;
                        let projectContent = await this.fileRead(["projects", id+".json"]);
                        let project = null;
                        try {
                            project = JSON.parse(projectContent, subcore.REVIVER.f);
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
                        for (let i = 0; i < pathList.length; i++) {
                            let name = pathList[i];
                            let pathId = null;
                            project.paths.forEach(id => {
                                let pth = project.getPath(id);
                                if (pth.name == name) pathId = id;
                            });
                            let contentOut = "";
                            try {
                                contentOut = await Portal.fileRead(path.join(root, "paths", project.meta.name, name, "data.out"));
                            } catch (e) {}
                            let dataOut = null;
                            try {
                                dataOut = JSON.parse(contentOut);
                            } catch (e) {}
                            if (dataOut == null) continue;
                            datas[pathId] = dataOut;
                        }
                        return datas;
                    },
                },
            };
            if (this.name in namefs)
                if (k in namefs[this.name])
                    return await namefs[this.name][k](...args);
            return null;
        }
        async send(k, args) {
            if (!this.started) return false;
            if (!this.hasName()) return false;
            k = String(k);
            args = util.ensure(args, "arr");
            this.log(`SEND - ${k}(${args.map(v => JSON.stringify(v)).join(', ')})`);
            if (!this.hasWindow()) return false;
            this.window.webContents.send("send", k, args);
            return true;
        }

        update() { this.post("update", null); }

        static log(name, ...a) {
            return log(`[${name}]`, ...a);
        }
        log(...a) { Portal.Feature.log(this.name, ...a); }
    };

    log("< BUILT PORTAL >");

    return Portal;
};

let portal = null;

let ready = false, readyResolves = [];
async function untilReady() {
    return await new Promise((res, rej) => {
        if (ready) return res();
        readyResolves.push(res);
    });
}
(async () => {
    portal = new (await MAIN())();
    await portal.init();
    ready = true;
    readyResolves.forEach(res => res());
    setInterval(() => portal.update(), 10);
})();

app.on("ready", async () => {
    await untilReady();
    log("> ready");
    portal.start();
});

app.on("activate", async () => {
    await untilReady();
    log("> activate");
    portal.start();
});

let allow = false;
app.on("before-quit", async e => {
    if (allow) return;
    e.preventDefault();
    await untilReady();
    log("> before-quit");
    let quit = true;
    try {
        quit = await portal.stop();
    } catch (e) {}
    if (!quit) return;
    allow = true;
    app.quit();
});
app.on("window-all-closed", async () => {
    await untilReady();
    log("> all-closed");
    app.quit();
});
app.on("quit", async () => {
    await untilReady();
    log("> quit");
});
