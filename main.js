"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const os = require("os");

const path = require("path");
const fs = require("fs");

const cp = require("child_process");

const electron = require("electron");
const app = electron.app;
const ipc = electron.ipcMain;

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

const MAIN = async () => {
    log("< IMPORTING ASYNCHRONOUSLY >");

    const util = await import("./util.mjs");
    const V = util.V;

    const core = await import("./core.mjs");

    log("< IMPORTED ASYNCHRONOUSLY >");

    const FEATURES = ["PORTAL", "PRESETS", "PANEL", "PLANNER"];

    const PLATFORM = process.platform;

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

        constructor() {
            super();

            this.#started = false;

            this.#stream = null;

            this.#manager = new ProcessManager();

            this.#features = new Set();

            this.#loads = new Set();

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
        }

        async isDevMode() {
            if (!(await Portal.fileHas(path.join(__dirname, ".config")))) return false;
            let content = "";
            try {
                content = await Portal.fileRead(path.join(__dirname, ".config"));
            } catch (e) { return false; }
            let data = null;
            try {
                data = JSON.parse(content);
            } catch (e) { return false; }
            data = util.ensure(data, "obj");
            return data.isDevMode;
        }
        async isSpooky() {
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
            return !!data.spooky;
        }

        get stream() { return this.#stream; }
        hasStream() { return this.stream instanceof fs.WriteStream; }

        get manager() { return this.#manager; }

        get features() { return [...this.#features]; }
        set features(v) {
            v = Array.isArray(v) ? Array.from(v) : [];
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
            const window = feat.window;
            feat._onFocus = () => {
                if (feat.hasMenu()) {
                    if (PLATFORM == "darwin")
                        electron.Menu.setApplicationMenu(feat.menu);
                    return;
                }
                window.removeListener("focus", feat._onFocus);
                delete feat._onFocus;
            };
            window.on("focus", feat._onFocus);
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
        async tryLoad() {
            await this.affirm();
            const fetch = (await import("node-fetch")).default;
            this.log("DB finding host");
            this.clearLoads();
            this.addLoad("find");
            let content = "";
            try {
                content = await this.fileRead(".config");
            } catch (e) {}
            let data = null;
            try {
                data = JSON.parse(content);
            } catch (e) {}
            data = util.ensure(data, "obj");
            this.remLoad("find");
            const host = data.dbHost || "https://peninsula-db.jfancode.repl.co";
            this.log(`DB poll - ${host}`);
            this.addLoad("poll");
            try {
                await fetch(host);
            } catch (e) {
                this.log(`DB poll - ${host} - fail`);
                this.remLoad("poll");
                this.addLoad("poll:"+e);
                return false;
            }
            this.log(`DB poll - ${host} - success`);
            this.remLoad("poll");
            const fetchAndPipe = async (url, pth) => {
                let fileName = path.basename(pth);
                let superPth = path.dirname(pth);
                let thePth = path.join(superPth, fileName);
                let tmpPth = path.join(superPth, fileName+"-tmp");
                let resp = await fetch(url);
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
            /*
            this.log("DB version get");
            this.addLoad("version-get");
            let newVersion = "";
            try {
                let resp = await fetch(host+"/version.txt");
                newVersion = await resp.text();
            } catch (e) {
                this.log(`DB version get - error - ${e}`);
                this.remLoad("version-get");
                this.addLoad("version-get:"+e);
                return false;
            }
            this.log("DB version get - success");
            this.remLoad("version-get");
            this.log("DB version set");
            this.addLoad("version-set");
            let oldVersion = "";
            try {
                oldVersion = (await this.fileHas(".version")) ? (await this.fileRead(".version")) : "";
            } catch (e) {
                this.log(`DB version set - error - ${e}`);
                this.remLoad("version-set");
                this.addLoad("version-set:"+e);
                return false;
            }
            this.log("DB version set - success");
            this.remLoad("version-set");
            if (oldVersion == newVersion) {
                this.log(`DB version same (${JSON.stringify(oldVersion)} == ${JSON.stringify(newVersion)}) - skipping`);
                return true;
            }
            this.log(`DB version diff (${JSON.stringify(oldVersion)} != ${JSON.stringify(newVersion)}) - continuing`);
            await this.fileWrite(".version", newVersion);
            */
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
                        this.remLoad("templates.json-check:"+e);
                    }
                    this.remLoad("templates.json-check");
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
                        this.remLoad("robots.json-check:"+e);
                    }
                    this.remLoad("robots.json-check");
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
                ...FEATURES.map(async name => {
                    const subhost = host+"/"+name.toLowerCase();
                    const log = (...a) => this.log(`DB [${name}]`, ...a);
                    log("search");
                    this.addLoad(name+":search");
                    try {
                        let resp = await fetch(subhost+"/confirm.txt");
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
        }

        get started() { return this.#started; }
        start() {
            if (this.started) return false;
            this.#started = true;

            this.log("START");

            ipc.handle("os", async () => {
                return {
                    arch: os.arch(),
                    platform: os.platform(),
                    cpus: os.cpus(),
                    user: os.userInfo(),
                };
            });

            const identifyFeature = e => {
                if (!util.is(e, "obj")) return null;
                if (!util.is(e.sender, "obj")) return null;
                let feats = this.features;
                for (let i = 0; i < feats.length; i++) {
                    if (!feats[i].hasWindow()) continue;
                    if (e.sender.id == feats[i].window.webContents.id)
                        return feats[i];
                }
                return null;
            };
            /*
            const identifyPopup = e => {
                if (!util.is(e, "obj")) return null;
                if (!util.is(e.sender, "obj")) return null;
                let feats = this.features;
                for (let i = 0; i < feats.length; i++)
                    for (let j = 0; j < feats[i].popups.length; j++)
                        if (e.sender.id == feats[i].popups[j].webContents.id)
                            return feats[i].popups[j];
                return null;
            };
            */

            ipc.handle("get", async (e, k) => {
                k = String(k);
                let kfs = {
                    feature: async () => {
                        let feat = identifyFeature(e);
                        if (!(feat instanceof Portal.Feature)) return null;
                        return feat.name;
                    },
                    fullscreenable: async () => {
                        let feat = identifyFeature(e);
                        if (!(feat instanceof Portal.Feature)) return null;
                        if (!feat.hasWindow()) return null;
                        return feat.window.isFullScreenable();
                    },
                    fullscreen: async () => {
                        let feat = identifyFeature(e);
                        if (!(feat instanceof Portal.Feature)) return null;
                        if (!feat.hasWindow()) return null;
                        return feat.window.isFullScreen();
                    },
                    closeable: async () => {
                        let feat = identifyFeature(e);
                        if (!(feat instanceof Portal.Feature)) return null;
                        if (!feat.hasWindow()) return null;
                        return feat.window.isClosable();
                    },
                    devmode: async () => {
                        return await this.isDevMode();
                    },
                    spooky: async () => {
                        return await this.isSpooky();
                    },
                    loads: async () => {
                        return this.loads;
                    },
                    templates: async () => {
                        let content = "";
                        try {
                            content = await this.fileRead(["templates", "templates.json"]);
                        } catch (e) {}
                        let data = null;
                        try {
                            data = JSON.parse(content);
                        } catch (e) {}
                        data = util.ensure(data, "obj");
                        return util.ensure(data.templates, "obj");
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
                        let content = "";
                        try {
                            content = await this.fileRead(["templates", "templates.json"]);
                        } catch (e) {}
                        let data = null;
                        try {
                            data = JSON.parse(content);
                        } catch (e) {}
                        data = util.ensure(data, "obj");
                        let templates = await kfs.templates();
                        return (data.active in templates) ? data.active : null;
                    },
                    robots: async () => {
                        let content = "";
                        try {
                            content = await this.fileRead(["robots", "robots.json"]);
                        } catch (e) {}
                        let data = null;
                        try {
                            data = JSON.parse(content);
                        } catch (e) {}
                        data = util.ensure(data, "obj");
                        return util.ensure(data.robots, "obj");
                    },
                    "robot-models": async () => {
                        let robots = await kfs.robots();
                        let models = {};
                        Object.keys(robots).map(name => (models[name] = path.join(this.dataPath, "robots", "models", name+".glb")));
                        return models;
                    },
                    "active-robot": async () => {
                        let content = "";
                        try {
                            content = await this.fileRead(["robots", "robots.json"]);
                        } catch (e) {}
                        let data = null;
                        try {
                            data = JSON.parse(content);
                        } catch (e) {}
                        data = util.ensure(data, "obj");
                        let robots = await kfs.robots();
                        return (data.active in robots) ? data.active : null;
                    },
                };
                if (k in kfs) return await kfs[k]();
                return null;
            });
            ipc.handle("set", async (e, k, v) => {
                k = String(k);
                let kfs = {
                    fullscreenable: async () => {
                        let feat = identifyFeature(e);
                        if (!(feat instanceof Portal.Feature)) return;
                        if (!feat.hasWindow()) return;
                        feat.window.setFullScreenable(!!v);
                    },
                    fullscreen: async () => {
                        let feat = identifyFeature(e);
                        if (!(feat instanceof Portal.Feature)) return;
                        if (!feat.hasWindow()) return;
                        feat.window.setFullScreen(!!v);
                    },
                    closeable: async () => {
                        let feat = identifyFeature(e);
                        if (!(feat instanceof Portal.Feature)) return;
                        if (!feat.hasWindow()) return;
                        let maximizable = feat.window.isMaximizable();
                        feat.window.setClosable(!!v);
                        feat.window.setMaximizable(maximizable);
                    },
                };
                if (k in kfs) await kfs[k]();
            });

            ipc.handle("file-has", async (e, pth) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileHas(pth);
            });
            ipc.handle("file-read", async (e, pth) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileRead(pth);
            });
            ipc.handle("file-write", async (e, pth, content) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileWrite(pth, content);
            });
            ipc.handle("file-append", async (e, pth, content) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileAppend(pth, content);
            });
            ipc.handle("file-delete", async (e, pth) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.fileDelete(pth);
            });

            ipc.handle("dir-has", async (e, pth) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.dirHas(pth);
            });
            ipc.handle("dir-list", async (e, pth) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.dirList(pth);
            });
            ipc.handle("dir-make", async (e, pth) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.dirMake(pth);
            });
            ipc.handle("dir-delete", async (e, pth) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return await feat.dirDelete(pth);
            });

            ipc.handle("menu-change", (e, changes) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                return feat.menuChange(changes);
            });

            /*
            ipc.handle("popup", (e, type) => {
                let feat = identifyFeature(e);
                if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
                feat.addPopup(new Portal.Feature.Popup(type));
                return true;
            });
            */

            ipc.handle("on", async (e, k, args) => {
                let feat = identifyFeature(e);
                if (feat instanceof Portal.Feature) return await feat.on(k, args);
                throw "Nonexistent feature corresponding with id: "+e.sender.id;
                // let pop = identifyPopup(e);
                // if (pop instanceof Portal.Feature.Popup) return await pop.on(k, args);
                // throw "Nonexistent feature and popup corresponding with id: "+e.sender.id;
            });

            /*
            ipc.handle("submit", async (e, result) => {
                let pop = identifyPopup(e);
                if (!(pop instanceof Portal.Feature.Popup)) throw "Nonexistent popup corresponding with id: "+e.sender.id;
                return await pop.submit(result);
            });
            */

            (async () => {
                await this.affirm();
                await this.post("start", null);

                this.addFeature(new Portal.Feature("PORTAL"));
                setTimeout(() => this.tryLoad(), 1000);
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

        // #popups;

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

            // this.#popups = new Set();
            
            this.#window = null;
            this.#menu = null;
            this.#perm = false;

            this.#started = false;

            this.log();
        }

        async isDevMode() {
            if (!this.hasPortal()) return false;
            return await this.portal.isDevMode();
        }
        async isSpooky() {
            if (!this.hasPortal()) return false;
            return await this.portal.isSpooky();
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

        /*
        get popups() { return [...this.#popups]; }
        set popups(v) {
            v = util.ensure(v, "arr");
            this.clearPopups();
            v.forEach(v => this.addPopup(v));
        }
        clearPopups() {
            let pops = this.popups;
            pops.forEach(pop => this.remPopup(pop));
            return pops;
        }
        hasPopup(pop) {
            if (!(pop instanceof Portal.Feature.Popup)) return false;
            return this.#popups.has(pop) && pop.feature == this;
        }
        addPopup(pop) {
            if (!(pop instanceof Portal.Feature.Popup)) return false;
            if (this.hasPopup(pop)) return false;
            this.#popups.add(pop);
            pop.feature = this;
            pop.start();
            return pop;
        }
        remPopup(pop) {
            if (!(pop instanceof Portal.Feature.Popup)) return false;
            if (!this.hasPopup(pop)) return false;
            this.#popups.delete(pop);
            pop.feature = null;
            pop.stop();
            return pop;
        }
        */

        get window() { return this.#window; }
        hasWindow() { return this.window instanceof electron.BrowserWindow; }
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

                titleBarStyle: "hidden",
                trafficLightPosition: { x: 17, y: 17 },

                webPreferences: {
                    preload: path.join(__dirname, "preload.js"),
                },
            };
            namefs = {
                _: () => {
                    (async () => {
                        let spooky = await this.isSpooky();
                        if (PLATFORM == "win32") {
                            if (spooky) window.setIcon(path.join(__dirname, ...["assets", "app", "icon-spooky.png"]));
                            else window.setIcon(path.join(__dirname, ...["assets", "app", "icon.png"]));
                        }
                        if (PLATFORM == "darwin") {
                            if (spooky) app.dock.setIcon(path.join(__dirname, ...["assets", "app", "icon-spooky.png"]));
                            else app.dock.setIcon(path.join(__dirname, ...["assets", "app", "icon.png"]));
                        }
                        if (PLATFORM == "linux") {
                            if (spooky) window.setIcon(path.join(__dirname, ...["assets", "app", "icon-spooky.png"]));
                            else window.setIcon(path.join(__dirname, ...["assets", "app", "icon.png"]));
                        }
                    })();
                },
            };
            if ("_" in namefs) namefs._();
            if (this.name in namefs) namefs[this.name]();
            const window = this.#window = new electron.BrowserWindow(options);
            window.once("ready-to-show", () => {
                window.show();
                this.post("show", null);
            });

            window.on("unresponsive", () => {});
            window.webContents.on("did-fail-load", () => window.close());
            window.webContents.on("will-navigate", (e, url) => {
                if (url != window.webContents.getURL()) {
                    e.preventDefault();
                    electron.shell.openExternal(url);
                }
            });
            if (this.hasPortal()) {
                let any = false;
                this.portal.features.filter(feat => feat.hasWindow()).forEach(feat => (any ||= feat.window.webContents.isDevToolsOpened()));
                if (any) window.webContents.openDevTools();
            }
            window.webContents.on("devtools-opened", () => {
                if (!this.hasPortal()) return;
                this.portal.features.filter(feat => feat.hasWindow()).forEach(feat => feat.window.webContents.openDevTools());
            });
            window.webContents.on("devtools-closed", () => {
                if (!this.hasPortal()) return;
                this.portal.features.filter(feat => feat.hasWindow()).forEach(feat => feat.window.webContents.closeDevTools());
            });

            window.on("enter-full-screen", () => { window.webContents.send("send", "win-fullscreen", [true]); });
            window.on("leave-full-screen", () => { window.webContents.send("send", "win-fullscreen", [false]); });

            this.perm = false;
            window.on("close", e => {
                this.log("CLOSE");
                if (this.perm) return this.log("CLOSE - yes perm");
                this.log("CLOSE - no perm");
                e.preventDefault();
                this.stop();
            });

            window.loadFile(path.join(__dirname, this.name.toLowerCase(), "index.html"));

            const build = {
                about: [
                    {
                        label: "About Peninsula "+util.capitalize(this.name),
                        click: () => window.webContents.send("send", "about"),
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
                        label: "Github Repository",
                        click: () => {
                            electron.shell.openExternal("https://github.com/team6036/peninsulaportal");
                        },
                    },
                    {
                        label: "Open Database",
                        click: () => {
                            (async () => {
                                if (!this.hasPortal()) return;
                                await this.portal.affirm();
                                let content = "";
                                try {
                                    content = await this.portal.fileRead(".config");
                                } catch (e) {}
                                let data = null;
                                try {
                                    data = JSON.parse(content);
                                } catch (e) {}
                                data = util.ensure(data, "obj");
                                electron.shell.openExternal(data.dbHost);
                            })();
                        },
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
                            (PLATFORM == "darwin") ?
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
                        let feats = this.portal.features;
                        let nFeats = 0;
                        feats.forEach(feat => (["PORTAL"].includes(feat.name) ? null : nFeats++));
                        (nFeats > 0) ? window.hide() : window.show();
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
                            click: () => window.webContents.send("send", "newproject"),
                        },
                        {
                            id: "newtab",
                            label: "New Tab",
                            accelerator: "CmdOrCtrl+Shift+N",
                            click: () => window.webContents.send("send", "newtab"),
                        },
                        build.div,
                        {
                            id: "openclose",
                            label: "Toggle Open / Closed",
                            accelerator: "Ctrl+F",
                            click: () => window.webContents.send("send", "openclose"),
                        },
                        {
                            id: "expandcollapse",
                            label: "Toggle Title Collapsed",
                            accelerator: "Ctrl+Shift+F",
                            click: () => window.webContents.send("send", "expandcollapse"),
                        },
                        build.div,
                        {
                            id: "close",
                            label: "Close Tab",
                            accelerator: "CmdOrCtrl+Shift+W",
                            click: () => window.webContents.send("send", "close"),
                        },
                    );
                },
                PLANNER: () => {
                    template[1].submenu.splice(
                        2, 0,
                        {
                            id: "newproject",
                            label: "New Project",
                            accelerator: "CmdOrCtrl+N",
                            click: () => window.webContents.send("send", "newproject"),
                        },
                        build.div,
                        {
                            id: "addnode",
                            label: "Add Node",
                            click: () => window.webContents.send("send", "addnode"),
                        },
                        {
                            id: "addobstacle",
                            label: "Add Obstacle",
                            click: () => window.webContents.send("send", "addobstacle"),
                        },
                        {
                            id: "addpath",
                            label: "Add Path",
                            click: () => window.webContents.send("send", "addpath"),
                        },
                        build.div,
                        {
                            id: "save",
                            label: "Save",
                            accelerator: "CmdOrCtrl+S",
                            click: () => window.webContents.send("send", "save"),
                        },
                        {
                            id: "savecopy",
                            label: "Save as copy",
                            accelerator: "CmdOrCtrl+Shift+S",
                            click: () => window.webContents.send("send", "savecopy"),
                        },
                        build.div,
                        {
                            id: "delete",
                            label: "Delete Project",
                            click: () => window.webContents.send("send", "delete"),
                        },
                        {
                            id: "close",
                            label: "Close Project",
                            accelerator: "CmdOrCtrl+Shift+W",
                            click: () => window.webContents.send("send", "close"),
                        },
                    );
                    template[3].submenu.unshift(
                        {
                            id: "maxmin",
                            label: "Toggle Maximized",
                            accelerator: "Ctrl+F",
                            click: () => window.webContents.send("send", "maxmin"),
                        },
                        {
                            id: "resetdivider",
                            label: "Reset Divider",
                            click: () => window.webContents.send("send", "resetdivider"),
                        },
                        build.div,
                    );
                },
            };

            if (namefs[this.name]) namefs[this.name]();

            this.#menu = electron.Menu.buildFromTemplate(template);
            if (PLATFORM == "linux" || PLATFORM == "win32")
                window.setMenu(this.menu);
            
            (async () => {
                let prevIsDevMode = null;
                const checkLocalConfig = async () => {
                    let isDevMode = await this.isDevMode();
                    this.menuChange({ toggleDevTools: { ".enabled": isDevMode } });
                    if (prevIsDevMode != isDevMode) {
                        console.log("devmode = "+isDevMode);
                        prevIsDevMode = isDevMode;
                        window.webContents.send("send", "win-devmode", [isDevMode]);
                    }
                };
                let prevIsSpooky = null;
                const checkConfig = async () => {
                    let isSpooky = await this.isSpooky();
                    if (prevIsSpooky != isSpooky) {
                        console.log("spooky = "+isSpooky);
                        prevIsSpooky = isSpooky;
                        window.webContents.send("send", "win-spooky", [isSpooky]);
                    }
                };
                fs.watchFile(path.join(__dirname, ".config"), () => checkLocalConfig());
                fs.watchFile(path.join(this.portal.dataPath, ".config"), () => checkConfig());
                console.log(path.join(this.portal.dataPath, ".config"));
                await checkLocalConfig();
                await checkConfig();
                if (!this.hasName()) return;
                if (!this.hasPortal()) return;
                await this.portal.affirm();
                let stateContent = "";
                try {
                    stateContent = await this.portal.fileRead(".state");
                } catch (e) {}
                let state = null;
                try {
                    state = JSON.parse(stateContent);
                } catch (e) {}
                state = util.ensure(state, "obj");
                if (!(this.name in state)) return;
                state = state[this.name];
                if (!("bounds" in state)) return;
                let bounds = util.ensure(state.bounds, "obj");
                if (!this.hasWindow()) return;
                if (("width" in bounds) && (bounds.width < 50)) delete bounds.width;
                if (("height" in bounds) && (bounds.height < 50)) delete bounds.height;
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
            this.#started = false;
            this.manager.processes.forEach(process => process.terminate());
            if (this.hasPortal()) {
                await this.portal.affirm();
                let stateContent = "";
                try {
                    stateContent = await this.portal.fileRead(".state");
                } catch (e) {}
                let state = null;
                try {
                    state = JSON.parse(stateContent);
                } catch (e) {}
                state = util.ensure(state, "obj");
                if (!util.is(state[this.name], "obj")) state[this.name] = {};
                if (this.hasWindow())
                    state[this.name].bounds = this.window.getBounds();
                await this.portal.fileWrite(".state", JSON.stringify(state, null, "\t"));
            }
            // this.popups.forEach(pop => pop.stop());
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

        menuChange(changes) {
            if (!this.hasMenu()) return false;
            changes = util.ensure(changes, "obj");
            for (let id in changes) {
                let change = util.ensure(changes[id], "obj");
                let menu = this.menu.getMenuItemById(id);
                if (!(menu instanceof electron.MenuItem)) continue;
                for (let k in change) {
                    let v = change[k];
                    k = String(k).split(".");
                    while (k.length > 0 && k.at(0).length <= 0) k.shift();
                    while (k.length > 0 && k.at(-1).length <= 0) k.pop();
                    let obj = menu;
                    while (k.length > 1) {
                        if (!util.is(obj, "obj")) {
                            obj = null;
                            break;
                        }
                        obj = obj[k.shift()];
                    }
                    if (obj == null || k.length != 1) continue;
                    obj[k] = v;
                }
            }
        }

        async on(k, args) {
            if (!this.started) return;
            if (!this.hasName()) return;
            k = String(k);
            args = Array.isArray(args) ? Array.from(args) : [];
            this.log(`ON - ${k}(${args.map(v => JSON.stringify(v)).join(', ')})`);
            let namefs = {
                PLANNER: {
                    exec: async (id, pathId) => {
                        id = String(id);
                        pathId = String(pathId);

                        // const subcore = require("./planner/core-node");
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
                                this.log("SPAWN exit", data.e);
                                await finish();
                                if (!this.hasWindow() || !this.window.isVisible() || !this.window.isFocused()) {
                                    const notif = new electron.Notification({
                                        title: "Script Process Finished",
                                        body: "Your script finished executing with no errors!",
                                    });
                                    notif.show();
                                }
                                return res(data.e);
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
                    exec_term: async () => {
                        this.log("SPAWN term");
                        const process = this.manager.getProcessById("script");
                        if (!(process instanceof Process)) return;
                        process.terminate();
                    },
                    exec_get: async id => {
                        id = String(id);

                        // const subcore = require("./planner/core-node");
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
            k = String(k).replace("-", "_");
            if (k == "back")
                if (this.name != "PORTAL")
                    return await this.stop();
            if (k == "spawn") {
                let name = String(args[0]);
                if (!this.hasPortal()) return false;
                let feats = this.portal.features;
                let hasFeat = null;
                feats.forEach(feat => {
                    if (feat.name != name) return;
                    hasFeat = feat;
                });
                if (hasFeat instanceof Portal.Feature) {
                    if (hasFeat.hasWindow()) hasFeat.window.show();
                    return;
                }
                if (!FEATURES.includes(name)) return false;
                let feat = new Portal.Feature(name);
                this.portal.addFeature(feat);
                return true;
            }
            if (namefs[this.name])
                if (namefs[this.name][k])
                    return await namefs[this.name][k](...args);
            return null;
        }

        update() { this.post("update", null); }

        static log(name, ...a) {
            return log(`[${name}]`, ...a);
        }
        log(...a) { Portal.Feature.log(this.name, ...a); }
    };
    /*
    Portal.Feature.Popup = class PortalFeaturePopup extends core.Target {
        #feature;

        #type;

        #resolutions;
        #rejections;

        #window;

        #started;

        constructor(type) {
            super();

            this.#feature = null;

            type = String(type).toUpperCase();
            this.#type = POPUPS.includes(type) ? type : null;

            this.#resolutions = [];
            this.#rejections = [];

            this.#window = null;

            this.#started = false;

            this.log();
        }

        async isDevMode() {
            if (!this.hasFeature()) return false;
            return await this.feature.isDevMode();
        }

        get feature() { return this.#feature; }
        set feature(v) {
            v = (v instanceof Portal.Feature) ? v : null;
            if (this.feature == v) return;
            (async () => {
                if (this.hasFeature()) {
                    await this.feature.remPopup(this);
                    this.post("feature-unhook", { feature: this.feature });
                }
                this.#feature = v;
                if (this.hasFeature()) {
                    this.portal.addPopup(this);
                    this.post("feature-hook", { feature: this.feature });
                }
            })();
        }
        hasFeature() { return this.feature instanceof Portal.Feature; }
        
        get type() { return this.#type; }
        hasType() { return util.is(this.type, "str"); }

        get window() { return this.#window; }
        hasWindow() { return this.window instanceof electron.BrowserWindow; }

        get started() { return this.#started; }
        start() {
            if (this.started) return false;
            if (!this.hasName()) return false;
            this.log("START");
            this.#started = true;
        }
        stop() {
            if (!this.started) return false;
            if (!this.hasType()) return false;
            this.log("STOP");
            if (this.window instanceof electron.BrowserWindow)
                this.window.close();
            this.#window = null;
            this.#menu = null;
            this.submit(null);
            this.feature = null;
            return this;
        }

        update() { this.post("update", null); }

        log(...a) {
            return log(`[${this.hasFeature() ? this.feature.name : null}] [${this.name}]`, ...a);
        }
    };
    */

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
