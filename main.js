"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const os = require("os");

const path = require("path");
const fs = require("fs");

const cp = require("child_process");

const electron = require("electron");
const app = electron.app;
const ipc = electron.ipcMain;

const util = require("./util-node");
const V = util.V;

const core = require("./core-node");

let n = 0;
const log = (...a) => {
    return console.log(++n, ...a);
};

const FEATURES = ["LOAD", "PORTAL", "PANEL", "PLANNER"];

class Portal extends core.Target {
    #started;

    #features;

    constructor() {
        super();

        this.#started = false;

        this.#features = new Set();

        this.log();
    }

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
            for (let i = 0; i < feats.length; i++)
                if (e.sender.id == feats[i].window.webContents.id)
                    return feats[i];
            return null;
        };

        ipc.handle("get-feature", async e => {
            let feat = identifyFeature(e);
            if (!(feat instanceof Portal.Feature)) return null;
            return feat.name;
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
        ipc.handle("file-delete", async (e, pth, content) => {
            let feat = identifyFeature(e);
            if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
            return await feat.fileDelete(pth, content);
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

        ipc.handle("ask", async (e, cmd, args) => {
            let feat = identifyFeature(e);
            if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
            return await feat.ask(cmd, args);
        });

        this.affirm();
        this.post("start", null);

        this.addFeature(new Portal.Feature("LOAD"));
        this.addFeature(new Portal.Feature("PORTAL"));
        return true;
    }
    async stop() {
        this.log("STOP");
        await this.post("stop", null);
        let feats = this.features;
        let all = true;
        for (let i = 0; i < feats.length; i++)
            all &&= await this.remFeature(feats[i]);
        return all;
    }

    async fileHas(pth) {
        try {
            await fs.promises.access(pth);
            return true;
        } catch (e) {}
        return false;
    }
    async fileRead(pth) {
        return await fs.promises.readFile(pth, { encoding: "utf-8" });
    }
    async fileWrite(pth, content) {
        return await fs.promises.writeFile(pth, content, { encoding: "utf-8" });
    }
    async fileDelete(pth) {
        return await fs.promises.unlink(pth);
    }

    async dirHas(pth) {
        try {
            await fs.promises.access(pth);
            return true;
        } catch (e) {}
        return false;
    }
    async dirList(pth) {
        let dirents = await fs.promises.readdir(pth, { withFileTypes: true });
        return dirents.map(dirent => {
            return {
                type: dirent.isFile() ? "file" : "dir",
                name: dirent.name,
            };
        });
    }
    async dirMake(pth) {
        return await fs.promises.mkdir(pth);
    }
    async dirDelete(pth) {
        return await fs.promises.rmdir(pth);
    }

    get dataPath() { return path.join(app.getPath("appData"), "PeninsulaPortal"); }

    async affirm() {
        let hasAppData = await this.dirHas(this.dataPath);
        if (!hasAppData) await this.dirMake(this.dataPath);
        return true;
    }

    update() {
        this.features.forEach(feat => feat.update());
    }

    log(...a) {
        log("*", ...a);
    }
}
Portal.Feature = class PortalFeature extends core.Target {
    #portal;

    #name;

    #window;
    #perm;

    #started;

    constructor(name) {
        super();

        this.#portal = null;

        name = String(name).toUpperCase();
        this.#name = FEATURES.includes(name) ? name : null;
        
        this.#window = null;
        this.#perm = false;

        this.#started = false;

        this.log();
    }

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
    hasWindow() { return this.window instanceof electron.BrowserWindow; }
    get perm() { return this.#perm; }
    set perm(v) { this.#perm = !!v; }

    async getPerm() {
        if (!this.started) return true;
        if (!this.hasName()) return false;
        this.log("GET PERM");
        let perm = await new Promise((res, rej) => {
            this.window.webContents.send("perm");
            ipc.once("perm", (e, given) => {
                if (!this.window || !this.window.webContents) return;
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
            titleBarStyle: "hidden",
            trafficLightPosition: { x: 12, y: 12 },
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
            },
        };
        namefs = {
            LOAD: () => {
                options.width = 750;
                options.height = 450;
                options.resizable = false;
                options.frame = false;
                delete options.titleBarStyle;
                delete options.trafficLightPosition;
            },
        };
        if (this.name in namefs) namefs[this.name]();
        const window = this.#window = new electron.BrowserWindow(options);
        window.once("ready-to-show", () => {
            window.show();
            this.post("show", null);
        });

        window.on("unresponsive", () => {});
        window.webContents.on("did-fail-load", () => window.close());
        window.webContents.on("will-navigate", (_, url) => {
            if (url != e.sender.getURL()) {
                e.preventDefault();
                electron.shell.openExternal(url);
            }
        });

        this.perm = false;
        window.on("close", e => {
            this.log("CLOSE");
            if (this.perm) return this.log("CLOSE - yes perm");
            this.log("CLOSE - no perm");
            e.preventDefault();
            this.stop();
        });

        window.loadURL("file://"+path.join(__dirname, this.name.toLowerCase(), "index.html"));

        namefs = {
            LOAD: () => {
                window.setAlwaysOnTop(true);
                let t = 0, lock = false, nTimes = 0;
                const host = "https://peninsula-db.jfancode.repl.co";
                let info = {};
                this.addHandler("update", async data => {
                    if (!this.hasPortal()) return;
                    this.window.webContents.send("ask", "info-set", [Object.values(info)]);
                    if (lock) return;
                    lock = true;
                    let success = await (async () => {
                        let tNow = util.getTime();
                        if (tNow-t < 1000) return false;
                        t = tNow;
                        const fetch = (await import("node-fetch")).default;
                        info._ = "Contacting Database";
                        try {
                            await fetch(host);
                        } catch (e) {
                            this.log("POLL db ERROR");
                            return false;
                        }
                        delete info._;
                        await Promise.all(FEATURES.map(async name => {
                            const root = host+"/"+name.toLowerCase();
                            info[name] = "Searching for feature: "+name;
                            let resp = null;
                            try {
                                resp = await fetch(root+"/confirm.json");
                            } catch (e) {}
                            if (resp == null || resp.status != 200) {
                                delete info[name];
                                return;
                            }
                            info[name] = "Updating feature: "+name;
                            this.log("FOUND FEATURE: "+name);
                            let namefs = {
                                PLANNER: async () => {
                                    let funcs = [
                                        async () => {
                                            info[name+"_template-json"] = `[${name}] template.json`;
                                            this.log(name+" : template.json");
                                            try {
                                                let resp = await fetch(root+"/template.json");
                                                if (resp.status == 200) {
                                                    await new Promise((res, rej) => {
                                                        const file = fs.createWriteStream(path.join(this.portal.dataPath, name.toLowerCase(), "template.json"));
                                                        resp.body.pipe(file);
                                                        resp.body.on("end", () => res(true));
                                                        resp.body.on("error", e => rej(e));
                                                    });
                                                }
                                            } catch (e) {}
                                            delete info[name+"_template-json"];
                                        },
                                        async () => {
                                            info[name+"_template-png"] = `[${name}] template.png`;
                                            this.log(name+" : template.png");
                                            try {
                                                let resp = await fetch(root+"/template.png");
                                                if (resp.status == 200) {
                                                    await new Promise((res, rej) => {
                                                        const file = fs.createWriteStream(path.join(this.portal.dataPath, name.toLowerCase(), "template.png"));
                                                        resp.body.pipe(file);
                                                        resp.body.on("end", () => res(true));
                                                        resp.body.on("error", e => rej(e));
                                                    });
                                                }
                                            } catch (e) {}
                                            delete info[name+"_template-png"];
                                        },
                                    ];
                                    await Promise.all(funcs.map(f => f()));
                                },
                            };
                            if (name in namefs) await namefs[name]();
                            delete info[name];
                        }));
                        info = {};
                        info._ = "Complete";
                        return true;
                    })();
                    if (success || nTimes >= 5) {
                        if (this.hasPortal()) {
                            let feats = this.portal.features;
                            let hasPortal = false;
                            feats.forEach(feat => ((feat.name == "PORTAL") ? (hasPortal = true) : null));
                            if (!hasPortal) this.portal.addFeature(new Portal.Feature("PORTAL"));
                        }
                        await this.stop();
                    } else nTimes++;
                    lock = false;
                });
            },
            PORTAL: () => {
                const checkForShow = () => {
                    if (!this.hasPortal()) return;
                    let feats = this.portal.features;
                    let nFeats = 0;
                    feats.forEach(feat => (["LOAD", "PORTAL"].includes(feat.name) ? null : nFeats++));
                    if (this.window instanceof electron.BrowserWindow)
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
            PLANNER: () => {
            },
        };

        if (namefs[this.name]) namefs[this.name]();

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
        if (this.window instanceof electron.BrowserWindow)
            this.window.close();
        this.#window = null;
        this.portal = null;
        return this;
    }
    
    get dataPath() {
        if (!this.canOperateFS) return null;
        return path.join(this.portal.dataPath, this.name.toLowerCase());
    }

    async affirm() {
        if (!this.canOperateFS) return false;
        await this.portal.affirm();
        let hasFeatureData = await this.portal.dirHas(this.dataPath);
        if (!hasFeatureData) await this.portal.dirMake(this.dataPath);
        return true;
    }

    get canOperateFS() {
        if (!this.hasPortal()) return false;
        if (!this.started) return false;
        if (!this.hasName()) return false;
        return true;
    }
    convertPath(pth) {
        if (!this.canOperateFS) return null;
        return path.join(this.dataPath, pth);
    }

    async fileHas(pth) {
        if (!this.canOperateFS) return null;
        await this.affirm();
        return await this.portal.fileHas(this.convertPath(pth));
    }
    async fileRead(pth) {
        if (!this.canOperateFS) return null;
        await this.affirm();
        return await this.portal.fileRead(this.convertPath(pth));
    }
    async fileWrite(pth, content) {
        if (!this.canOperateFS) return null;
        await this.affirm();
        return await this.portal.fileWrite(this.convertPath(pth), content);
    }
    async fileDelete(pth) {
        if (!this.canOperateFS) return null;
        await this.affirm();
        return await this.portal.fileDelete(this.convertPath(pth));
    }

    async dirHas(pth) {
        if (!this.canOperateFS) return null;
        await this.affirm();
        return await this.portal.dirHas(this.convertPath(pth));
    }
    async dirList(pth) {
        if (!this.canOperateFS) return null;
        await this.affirm();
        return await this.portal.dirList(this.convertPath(pth));
    }
    async dirMake(pth) {
        if (!this.canOperateFS) return null;
        await this.affirm();
        return await this.portal.dirMake(this.convertPath(pth));
    }
    async dirDelete(pth) {
        if (!this.canOperateFS) return null;
        await this.affirm();
        return await this.portal.dirDelete(this.convertPath(pth));
    }

    async ask(cmd, args) {
        if (!this.started) return;
        if (!this.hasName()) return;
        cmd = String(cmd);
        args = Array.isArray(args) ? Array.from(args) : [];
        this.log(`ASK - ${cmd}(${args.join(', ')})`);
        let namefs = {
            _: async () => {
                if (this.name == "PORTAL") return;
                if (cmd == "back") await this.stop();
            },
            PORTAL: {
                spawn: async name => {
                    name = String(name);
                    if (!this.hasPortal()) return;
                    let feats = this.portal.features;
                    let hasFeat = null;
                    feats.forEach(feat => {
                        if (feat.name != name) return;
                        hasFeat = feat;
                    });
                    if (hasFeat instanceof Portal.Feature) {
                        hasFeat.window.show();
                        return;
                    }
                    if (!FEATURES.includes(name)) return;
                    let feat = new Portal.Feature(name);
                    this.portal.addFeature(feat);
                },
            },
            PLANNER: {
                exec: async (script, data) => {
                    if (!this.hasPortal()) return false;
                    if (script == null) return false;
                    script = String(script);
                    let has = await this.portal.fileHas(script);
                    if (!has) return null;
                    let root = path.dirname(script);
                    let content = JSON.stringify(data, null, "\t");
                    this.log("REMOVE data.out");
                    if (await this.portal.fileHas(path.join(root, "data.out")))
                        await this.portal.fileDelete(path.join(root, "data.out"));
                    this.log("CREATE data.in");
                    await this.portal.fileWrite(path.join(root, "data.in"), content);
                    return new Promise((res, rej) => {
                        this.log("SPAWN");
                        const process = this.process = cp.spawn("python3", [script], { cwd: root });
                        this.process_res = res;
                        this.process_rej = rej;
                        process.on("exit", async code => {
                            this.log("SPAWN exit: "+code);
                            delete this.process;
                            delete this.process_res;
                            delete this.process_rej;
                            res(code);
                        });
                        process.on("error", err => {
                            this.log("SPAWN err");
                            delete this.process;
                            delete this.process_res;
                            delete this.process_rej;
                            rej(err);
                        });
                    });
                },
                exec_term: async () => {
                    if (!("process" in this)) return;
                    this.log("SPAWN term");
                    this.process.kill("SIGTERM");
                    this.process_res(null);
                    delete this.process;
                    delete this.process_res;
                    delete this.process_rej;
                },
                exec_get: async script => {
                    if (!this.hasPortal()) return false;
                    if (script == null) return false;
                    script = String(script);
                    let has = await this.portal.fileHas(script);
                    if (!has) return null;
                    let root = path.dirname(script);
                    let content = await this.portal.fileRead(path.join(root, "data.out"));
                    let data = JSON.parse(content);
                    return data;
                },
            },
        };
        cmd = String(cmd).replace("-", "_");
        if (namefs._) await namefs._();
        if (namefs[this.name]) {
            let fs = namefs[this.name];
            if (fs._) await fs._();
            if (fs[cmd]) return await fs[cmd](...args);
        }
        return null;
    }

    update() {
        this.post("update", null);
    }

    log(...a) {
        log(`[${this.name}]`, ...a);
    }
} 

const portal = new Portal();

app.on("ready", () => {
    log("# ready");
    portal.start();
});

app.on("activate", () => {
    log("# activate");
    portal.start();
});

app.on("window-all-closed", async () => {
    log("# all-closed");
    let quit = true;
    try {
        quit = await portal.stop();
    } catch (e) {}
    if (!quit) return;
    app.quit();
});
app.on("quit", () => {
    log("# quit");
});

setInterval(() => portal.update(), 10);
