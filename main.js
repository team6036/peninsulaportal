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

const _log = console.log;
let n = 0;
console.log = (...a) => {
    n++;
    return _log(n, ...a);
};

class Portal extends core.Target {
    #features;

    constructor() {
        super();

        this.#features = new Set();

        console.log("*");
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
        console.log(`[${feat.name}] REM`);
        if (feat.started) {
            console.log(`[${feat.name}] REM - not stopped`);
            let r = await feat.stop();
            console.log(`[${feat.name}] REM - stop: ${!!r}`);
            return r;
        }
        console.log(`[${feat.name}] REM - already stopped`);
        this.#features.delete(feat);
        feat.portal = null;
        this.post("feature-stop", { feat: feat });
        return feat;
    }

    start() {
        let hasPortal = false;
        this.features.forEach(feat => {
            if (feat.name != "PORTAL") return;
            hasPortal = true;
        });
        if (hasPortal) return false;
        console.log("* START");

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

        return this.addFeature(new Portal.Feature("PORTAL"));
    }
    async stop() {
        console.log("* STOP");
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
        this.#name = ["PORTAL", "PLANNER"].includes(name) ? name : null;
        
        this.#window = null;
        this.#perm = false;

        this.#started = false;

        console.log(`[${this.name}]`);
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

    getPerm() {
        if (!this.started) return true;
        if (!this.hasName()) return false;
        console.log(`[${this.name}] GET PERM`);
        return new Promise((res, rej) => {
            this.window.webContents.send("perm");
            ipc.once("perm", (e, given) => {
                if (e.sender.id != this.window.webContents.id) return;
                res(!!given);
            });
            setTimeout(() => res(true), 5000);
        });
    }

    get started() { return this.#started; }
    start() {
        if (this.started) return false;
        if (!this.hasName()) return false;
        console.log(`[${this.name}] START`);
        this.#started = true;
        const window = this.#window = new electron.BrowserWindow({
            width: 1250,
            height: 750,
            show: false,
            resizable: true,
            titleBarStyle: "hidden",
            trafficLightPosition: { x: 12, y: 12 },
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
            },
        });
        window.once("ready-to-show", () => window.show());

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
            console.log(`[${this.name}] CLOSE`);
            if (this.perm) return console.log(`[${this.name}] CLOSE - yes perm`);
            console.log(`[${this.name}] CLOSE - no perm`);
            e.preventDefault();
            this.stop();
        });

        window.loadURL("file://"+path.join(__dirname, this.name.toLowerCase(), "index.html"));

        let namefs = {
            PORTAL: () => {
                const checkForShow = () => {
                    if (!this.hasPortal()) return;
                    let feats = this.portal.features;
                    let nFeats = 0;
                    feats.forEach(feat => (feat.name == "PORTAL" ? null : nFeats++));
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
        };

        if (namefs[this.name]) namefs[this.name]();

        return this;
    }
    async stop() {
        if (!this.started) return false;
        if (!this.hasName()) return false;
        console.log(`[${this.name}] STOP`);
        if (!this.perm) {
            console.log(`[${this.name}] STOP - no perm > get perm`);
            this.perm = await this.getPerm();
        }
        console.log(`[${this.name}] STOP - perm: ${this.perm}`);
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
        let hasFeatureData = await this.portal.hasFeatureData(this.dataPath);
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
        return await this.portal.fileHas(this.convertPath(pth));
    }
    async fileRead(pth) {
        if (!this.canOperateFS) return null;
        return await this.portal.fileRead(this.convertPath(pth));
    }
    async fileWrite(pth, content) {
        if (!this.canOperateFS) return null;
        return await this.portal.fileWrite(this.convertPath(pth), content);
    }
    async fileDelete(pth) {
        if (!this.canOperateFS) return null;
        return await this.portal.fileDelete(this.convertPath(pth));
    }

    async dirHas(pth) {
        if (!this.canOperateFS) return null;
        return await this.portal.dirHas(this.convertPath(pth));
    }
    async dirList(pth) {
        if (!this.canOperateFS) return null;
        return await this.portal.dirList(this.convertPath(pth));
    }
    async dirMake(pth) {
        if (!this.canOperateFS) return null;
        return await this.portal.dirMake(this.convertPath(pth));
    }
    async dirDelete(pth) {
        if (!this.canOperateFS) return null;
        return await this.portal.dirDelete(this.convertPath(pth));
    }

    async ask(cmd, args) {
        if (!this.started) return;
        if (!this.hasName()) return;
        cmd = String(cmd);
        args = Array.isArray(args) ? Array.from(args) : [];
        console.log(`[${this.name}] ASK - ${cmd}(${args.join(', ')})`);
        let namefs = {
            _: async () => {
                if (this.name == "PORTAL") return;
                if (cmd == "back") await this.stop();
            },
            PORTAL: {
                spawn: async name => {
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
                    let feat = new Portal.Feature(name);
                    if (feat.name != name) return;
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
                    let content = "";
                    try {
                        content = JSON.stringify(data, null, "\t");
                    } catch (e) {}
                    console.log("REMOVE data.out");
                    if (await this.portal.fileHas(path.join(root, "data.out")))
                        await this.portal.fileDelete(path.join(root, "data.out"));
                    console.log("CREATE data.in");
                    await this.portal.fileWrite(path.join(root, "data.in"), content);
                    return new Promise((res, rej) => {
                        console.log("SPAWN");
                        const process = cp.spawn("python3", [script], { cwd: root });
                        process.on("exit", async code => {
                            console.log("SPAWN exit: "+code);
                            let content = "";
                            try {
                                content = await this.portal.fileRead(path.join(root, "data.out"));
                            } catch (e) { console.log("ERR: read data.out - ", e); }
                            let data = null;
                            try {
                                data = JSON.parse(content);
                            } catch (e) { console.log("ERR: parse data.out - ", e); }
                            res(data);
                        });
                        process.on("error", err => {
                            console.log("SPAWN err");
                            rej(err);
                        });
                    });
                }
            }
        };
        if (namefs._) await namefs._();
        if (namefs[this.name]) {
            let fs = namefs[this.name];
            if (fs._) await fs._();
            if (fs[cmd]) return await fs[cmd](...args);
        }
        return null;
    }
} 

const portal = new Portal();

app.on("ready", () => {
    console.log("# ready");
    portal.start();
});

app.on("activate", () => {
    console.log("# activate");
    portal.start();
});

app.on("window-all-closed", async () => {
    console.log("# all-closed");
    let quit = await portal.stop();
    if (!quit) return;
    app.quit();
});
app.on("quit", () => {
    console.log("# quit");
});
