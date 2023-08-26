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

const log = async (...a) => {
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

const FEATURES = ["LOAD", "PORTAL", "PRESETS", "PANEL", "PLANNER"];

const PLATFORM = process.platform;

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
        let window = feat.window;
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
        ipc.handle("file-append", async (e, pth, content) => {
            let feat = identifyFeature(e);
            if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
            return await feat.fileAppend(pth, content);
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

        ipc.handle("menu-change", (e, changes) => {
            let feat = identifyFeature(e);
            if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
            return feat.menuChange(changes);
        });

        ipc.handle("ask", async (e, cmd, args) => {
            let feat = identifyFeature(e);
            if (!(feat instanceof Portal.Feature)) throw "Nonexistent feature corresponding with id: "+e.sender.id;
            return await feat.ask(cmd, args);
        });

        (async () => {
            await this.affirm();
            await this.post("start", null);

            this.addFeature(new Portal.Feature("LOAD"));
            this.addFeature(new Portal.Feature("PORTAL"));
        })();
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
        pth = util.is(pth, "arr") ? path.join(...pth) : pth;
        this.log(`fs:file-has ${pth}`);
        try {
            await fs.promises.access(pth);
            return true;
        } catch (e) {}
        return false;
    }
    async fileRead(pth) {
        pth = util.is(pth, "arr") ? path.join(...pth) : pth;
        this.log(`fs:file-read ${pth}`);
        return await fs.promises.readFile(pth, { encoding: "utf-8" });
    }
    async fileWrite(pth, content) {
        pth = util.is(pth, "arr") ? path.join(...pth) : pth;
        this.log(`fs:file-write ${pth}`);
        return await fs.promises.writeFile(pth, content, { encoding: "utf-8" });
    }
    async fileAppend(pth, content) {
        pth = util.is(pth, "arr") ? path.join(...pth) : pth;
        this.log(`fs:file-append ${pth}`);
        return await fs.promises.appendFile(pth, content, { encoding: "utf-8" });
    }
    async fileDelete(pth) {
        pth = util.is(pth, "arr") ? path.join(...pth) : pth;
        this.log(`fs:file-delete ${pth}`);
        return await fs.promises.unlink(pth);
    }

    async dirHas(pth) {
        pth = util.is(pth, "arr") ? path.join(...pth) : pth;
        this.log(`fs:dir-has ${pth}`);
        try {
            await fs.promises.access(pth);
            return true;
        } catch (e) {}
        return false;
    }
    async dirList(pth) {
        pth = util.is(pth, "arr") ? path.join(...pth) : pth;
        this.log(`fs:dir-list ${pth}`);
        let dirents = await fs.promises.readdir(pth, { withFileTypes: true });
        return dirents.map(dirent => {
            return {
                type: dirent.isFile() ? "file" : "dir",
                name: dirent.name,
            };
        });
    }
    async dirMake(pth) {
        pth = util.is(pth, "arr") ? path.join(...pth) : pth;
        this.log(`fs:dir-make ${pth}`);
        return await fs.promises.mkdir(pth);
    }
    async dirDelete(pth) {
        pth = util.is(pth, "arr") ? path.join(...pth) : pth;
        this.log(`fs:dir-delete ${pth}`);
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
        return log("*", ...a);
    }
}
Portal.Feature = class PortalFeature extends core.Target {
    #portal;

    #name;

    #window;
    #menu;
    #perm;

    #started;

    constructor(name) {
        super();

        this.#portal = null;

        name = String(name).toUpperCase();
        this.#name = FEATURES.includes(name) ? name : null;
        
        this.#window = null;
        this.#menu = null;
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
    get menu() { return this.#menu; }
    hasMenu() { return this.menu instanceof electron.Menu; }
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
            trafficLightPosition: { x: 17, y: 17 },
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
            },
        };
        namefs = {
            _: () => {
                if (PLATFORM == "win32")
                    options.icon = "./assets/icon.ico";
                if (PLATFORM == "linux")
                    options.icon = "./assets/icon.png";
            },
            LOAD: () => {
                options.width = 750;
                options.height = 450;
                options.resizable = false;
                options.frame = false;
                delete options.titleBarStyle;
                delete options.trafficLightPosition;
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
            if (url != e.sender.getURL()) {
                e.preventDefault();
                electron.shell.openExternal(url);
            }
        });

        window.on("enter-full-screen", () => { window.webContents.send("ask", "set-fullscreen", [true]); });
        window.on("leave-full-screen", () => { window.webContents.send("ask", "set-fullscreen", [false]); });

        this.perm = false;
        window.on("close", e => {
            this.log("CLOSE");
            if (this.perm) return this.log("CLOSE - yes perm");
            this.log("CLOSE - no perm");
            e.preventDefault();
            this.stop();
        });

        window.loadURL("file://"+path.join(__dirname, this.name.toLowerCase(), "index.html"));

        let build = {
            about: [
                {
                    label: "About Peninsula "+this.name[0].toUpperCase()+this.name.slice(1).toLowerCase(),
                    click: () => window.webContents.send("ask", "about"),
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
            div: { type: "separator" },
        };
        let template = [
            {
                label: this.name[0].toUpperCase()+this.name.slice(1).toLowerCase(),
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
                    { role: "toggleDevTools" },
                ],
            },
        ];

        namefs = {
            LOAD: () => {
                while (template.length > 1) template.pop();
                window.setAlwaysOnTop(true);
                let t = 0, lock = false, nTimes = 0;
                const host = "https://peninsula-db.jfancode.repl.co";
                let info = {};
                this.addHandler("update", async data => {
                    if (!this.hasPortal()) return;
                    window.webContents.send("ask", "info-set", [Object.values(info)]);
                    if (lock) return;
                    lock = true;
                    let success = await (async () => {
                        let tNow = util.getTime();
                        if (tNow-t < 1000) return false;
                        t = tNow;
                        const fetch = (await import("node-fetch")).default;
                        info._ = "Contacting Database";
                        this.log("POLL db");
                        try {
                            await new Promise((res, rej) => {
                                setTimeout(() => rej("timeout"), 1000);
                                fetch(host).then(res()).catch(err => rej(err));
                            });
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
                            const dataPath = path.join(this.portal.dataPath, name.toLowerCase());
                            let namefs = {
                                PLANNER: async () => {
                                    if (!(await this.portal.dirHas(dataPath)))
                                        await this.portal.dirMake(dataPath);
                                    let funcs = [
                                        async () => {
                                            info[name+"_solver"] = `[${name}] solver`;
                                            this.log(name+" : solver");
                                            if (await this.portal.dirHas(path.join(__dirname, name.toLowerCase(), "solver"))) {
                                                if (!(await this.portal.dirHas(path.join(dataPath, "solver"))))
                                                    await this.portal.dirMake(path.join(dataPath, "solver"));
                                                let dirents = await this.portal.dirList(path.join(__dirname, name.toLowerCase(), "solver"));
                                                await Promise.all(dirents.map(async dirent => {
                                                    if (dirent.type != "file") return;
                                                    let content = await this.portal.fileRead(path.join(__dirname, name.toLowerCase(), "solver", dirent.name));
                                                    await this.portal.fileWrite(path.join(dataPath, "solver", dirent.name), content);
                                                }));
                                            }
                                            delete info[name+"_solver"];
                                        },
                                        async () => {
                                            info[name+"_template-json"] = `[${name}] template.json`;
                                            this.log(name+" : template.json");
                                            try {
                                                let resp = await fetch(root+"/template.json");
                                                if (resp.status == 200) {
                                                    await new Promise((res, rej) => {
                                                        const file = fs.createWriteStream(path.join(dataPath, "template.json"));
                                                        file.on("open", () => {
                                                            resp.body.pipe(file);
                                                            resp.body.on("end", () => res(true));
                                                            resp.body.on("error", e => rej(e));
                                                        });
                                                    });
                                                }
                                            } catch (e) {}
                                            if (await this.portal.fileHas(path.join(this.portal.dataPath, name.toLowerCase(), "template.json"))) {
                                                let content = await this.portal.fileRead(path.join(dataPath, "template.json"));
                                                try {
                                                    let data = JSON.parse(content);
                                                    if (!util.is(data, "obj")) throw "";
                                                    data[".meta.backgroundImage"] = path.join(dataPath, "template.png");
                                                    content = JSON.stringify(data);
                                                    await this.portal.fileWrite(path.join(dataPath, "template.json"), content);
                                                } catch (e) {}
                                            }
                                            delete info[name+"_template-json"];
                                        },
                                        async () => {
                                            info[name+"_template-png"] = `[${name}] template.png`;
                                            this.log(name+" : template.png");
                                            try {
                                                let resp = await fetch(root+"/template.png");
                                                if (resp.status == 200) {
                                                    await new Promise((res, rej) => {
                                                        const file = fs.createWriteStream(path.join(dataPath, "template.png"));
                                                        file.on("open", () => {
                                                            resp.body.pipe(file);
                                                            resp.body.on("end", () => res(true));
                                                            resp.body.on("error", e => rej(e));
                                                        });
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
            PLANNER: () => {
                template[1].submenu.unshift(
                    {
                        id: "newproject",
                        label: "New Project",
                        accelerator: "CmdOrCtrl+N",
                        click: () => window.webContents.send("ask", "newproject"),
                    },
                    build.div,
                    {
                        id: "addnode",
                        label: "Add Node",
                        click: () => window.webContents.send("ask", "addnode"),
                    },
                    {
                        id: "addobstacle",
                        label: "Add Obstacle",
                        click: () => window.webContents.send("ask", "addobstacle"),
                    },
                    {
                        id: "addpath",
                        label: "Add Path",
                        click: () => window.webContents.send("ask", "addpath"),
                    },
                    build.div,
                    {
                        id: "save",
                        label: "Save",
                        accelerator: "CmdOrCtrl+S",
                        click: () => window.webContents.send("ask", "save"),
                    },
                    {
                        id: "savecopy",
                        label: "Save as copy",
                        accelerator: "CmdOrCtrl+Shift+S",
                        click: () => window.webContents.send("ask", "savecopy"),
                    },
                    build.div,
                    {
                        id: "delete",
                        label: "Delete Project",
                        click: () => window.webContents.send("ask", "delete"),
                    },
                    {
                        id: "close",
                        label: "Close Project",
                        accelerator: "CmdOrCtrl+Shift+W",
                        click: () => window.webContents.send("ask", "close"),
                    },
                );
                template[3].submenu.unshift(
                    {
                        id: "maxmin",
                        label: "Toggle Maximized",
                        accelerator: "F",
                        click: () => window.webContents.send("ask", "maxmin"),
                    },
                    {
                        id: "resetdivider",
                        label: "Reset Divider",
                        click: () => window.webContents.send("ask", "resetdivider"),
                    },
                    build.div,
                );
            },
        };

        if (namefs[this.name]) namefs[this.name]();

        this.#menu = electron.Menu.buildFromTemplate(template);
        if (PLATFORM == "linux" || PLATFORM == "win32")
            window.setMenu(this.menu);

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
        this.#menu = null;
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
        return path.join(this.dataPath, ...(util.is(pth, "arr") ? pth : [pth]));
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
    async fileAppend(pth, content) {
        if (!this.canOperateFS) return null;
        await this.affirm();
        return await this.portal.fileAppend(this.convertPath(pth), content);
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
                exec: async (id, pathId) => {
                    id = String(id);
                    pathId = String(pathId);

                    const subcore = require("./planner/core-node");

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

                    let script = project.config.scriptUseDefault ? this.convertPath(["solver", "solver.py"]) : project.config.script;
                    if (script == null) throw "No script for project with id: "+id;
                    script = String(script);
                    let hasScript = await this.portal.fileHas(script);
                    if (!hasScript) throw "Script ("+script+") does not exist for project id: "+id;
                    let root = path.dirname(script);

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
                    if (await this.portal.fileHas(path.join(root, "data.in")))
                        await this.portal.fileDelete(path.join(root, "data.in"));
                    if (await this.portal.fileHas(path.join(root, "data.out")))
                        await this.portal.fileDelete(path.join(root, "data.out"));
                    this.log("REMOVE stdout.log/stderr.log");
                    if (await this.portal.fileHas(path.join(root, "stdout.log")))
                        await this.portal.fileDelete(path.join(root, "stdout.log"));
                    if (await this.portal.fileHas(path.join(root, "stderr.log")))
                        await this.portal.fileDelete(path.join(root, "stderr.log"));
                    this.log("CREATE data.in");
                    await this.portal.fileWrite(path.join(root, "data.in"), contentIn);
                    this.log("CREATE stdout.log/stderr.log");
                    await this.portal.fileWrite(path.join(root, "stdout.log"), "");
                    await this.portal.fileWrite(path.join(root, "stderr.log"), "");
                    return new Promise((res, rej) => {
                        if ("process" in this) return rej("Existing process has not terminated");
                        this.log("SPAWN");
                        const process = this.process = cp.spawn("python3", [script], { cwd: root });
                        const finish = async () => {
                            let hasMainDir = await this.portal.dirHas(path.join(root, "paths"));
                            if (!hasMainDir) await this.portal.dirMake(path.join(root, "paths"));
                            let hasProjectDir = await this.portal.dirHas(path.join(root, "paths", project.meta.name));
                            if (!hasProjectDir) await this.portal.dirMake(path.join(root, "paths", project.meta.name));
                            let hasPathDir = await this.portal.dirHas(path.join(root, "paths", project.meta.name, pth.name));
                            if (!hasPathDir) await this.portal.dirMake(path.join(root, "paths", project.meta.name, pth.name));
                            let hasDataIn = await this.portal.fileHas(path.join(root, "data.in"));
                            if (hasDataIn) await fs.promises.rename(path.join(root, "data.in"), path.join(root, "paths", project.meta.name, pth.name, "data.in"));
                            let hasDataOut = await this.portal.fileHas(path.join(root, "data.out"));
                            if (hasDataOut) await fs.promises.rename(path.join(root, "data.out"), path.join(root, "paths", project.meta.name, pth.name, "data.out"));
                            let hasOutLog = await this.portal.fileHas(path.join(root, "stdout.log"));
                            if (hasOutLog) await fs.promises.rename(path.join(root, "stdout.log"), path.join(root, "paths", project.meta.name, pth.name, "stdout.log"));
                            let hasErrLog = await this.portal.fileHas(path.join(root, "stderr.log"));
                            if (hasErrLog) await fs.promises.rename(path.join(root, "stderr.log"), path.join(root, "paths", project.meta.name, pth.name, "stderr.log"));
                        };
                        this.process_res = async (...a) => {
                            await finish();
                            return res(...a);
                        };
                        this.process_rej = async (...a) => {
                            await finish();
                            return rej(...a);
                        };
                        process.stdout.on("data", data => {
                            if (!("process" in this)) return;
                            this.portal.fileAppend(path.join(root, "stdout.log"), data);
                        });
                        process.stderr.on("data", data => {
                            if (!("process" in this)) return;
                            this.portal.fileAppend(path.join(root, "stderr.log"), data);
                            this.log("SPAWN err");
                            this.process_rej(data);
                            delete this.process;
                            delete this.process_res;
                            delete this.process_rej;
                        });
                        process.on("exit", async code => {
                            if (!("process" in this)) return;
                            this.log("SPAWN exit: "+code);
                            this.process_res(code);
                            delete this.process;
                            delete this.process_res;
                            delete this.process_rej; 
                        });
                        process.on("error", err => {
                            if (!("process" in this)) return;
                            this.log("SPAWN err");
                            this.process_rej(err);
                            delete this.process;
                            delete this.process_res;
                            delete this.process_rej;
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
                exec_get: async id => {
                    id = String(id);

                    const subcore = require("./planner/core-node");

                    if (!this.hasPortal()) throw "No linked portal";
                    let hasProjectContent = await this.fileHas(["projects", id+".json"]);
                    if (!hasProjectContent) throw "Nonexistent project with id: "+id;
                    let projectContent = await this.fileRead(["projects", id+".json"]);
                    let project = null;
                    try {
                        project = JSON.parse(projectContent, subcore.REVIVER.f);
                    } catch (e) {}
                    if (!(project instanceof subcore.Project)) throw "Invalid project content with id: "+id;

                    let script = project.config.scriptUseDefault ? this.convertPath(["solver", "solver.py"]) : project.config.script;
                    if (script == null) return {}; // throw "No script for project with id: "+id;
                    script = String(script);
                    let has = await this.portal.fileHas(script);
                    if (!has) throw "Script ("+script+") does not exist for project id: "+id;
                    let root = path.dirname(script);

                    let hasMainDir = await this.portal.dirHas(path.join(root, "paths"));
                    if (!hasMainDir) return {};
                    let hasProjectDir = await this.portal.dirHas(path.join(root, "paths", project.meta.name));
                    if (!hasProjectDir) return {};
                    let datas = {};
                    let pathNames = project.paths.map(id => project.getPath(id).name);
                    let pathList = await this.portal.dirList(path.join(root, "paths", project.meta.name));
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
                            contentOut = await this.portal.fileRead(path.join(root, "paths", project.meta.name, name, "data.out"));
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
        cmd = String(cmd).replace("-", "_");
        if (cmd == "back")
            if (this.name != "PORTAL")
                return await this.stop();
        if (cmd == "get-fullscreen")
            return this.hasWindow() && this.window.isFullScreen();
        if (namefs[this.name])
            if (namefs[this.name][cmd])
                return await namefs[this.name][cmd](...args);
        return null;
    }

    update() {
        this.post("update", null);
    }

    log(...a) {
        return log(`[${this.name}]`, ...a);
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

app.on("browser-window-focus", function () {
    electron.globalShortcut.register("CmdOrCtrl+R", () => {});
    electron.globalShortcut.register("F5", () => {});
});
app.on("browser-window-blur", function () {
    electron.globalShortcut.unregister("CmdOrCtrl+R");
    electron.globalShortcut.unregister("F5");
});

setInterval(() => portal.update(), 10);
