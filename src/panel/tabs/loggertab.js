import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";


import PanelToolTab from "./tooltab.js";


class LoggerContext extends util.Target {
    #location;
    #connected;

    #serverLogs;
    #clientLogs;

    #loading;

    constructor() {
        super();

        this.#location = null;
        this.#connected = false;

        this.#serverLogs = new Set();
        this.#clientLogs = {};

        this.#loading = {};

        const timer1 = new util.Timer(true);
        const timer2 = new util.Timer(true);
        this.addHandler("update", delta => {
            if (timer1.dequeueAll(1000)) this.pollServer();
            if (timer2.dequeueAll(100)) {
                this.pollClient();
                (async () => (this.#location = await window.api.get("client-location")))();
                (async () => (this.#connected = await window.api.get("client-connected")))();
            }
        });
    }

    get location() { return this.#location; }
    hasLocation() { return this.location != null; }
    get connected() { return this.#connected; }
    get disconnected() { return !this.connected; }

    get serverLogs() { return [...this.#serverLogs]; }
    hasServerLog(name) {
        name = String(name);
        return this.#serverLogs.has(name);
    }
    get clientLogs() { return Object.keys(this.#clientLogs); }
    hasClientLog(name) {
        name = String(name);
        return name in this.#clientLogs;
    }
    getClientPath(name) {
        if (!this.hasClientLog(name)) return null;
        return this.#clientLogs[name];
    }
    get logs() {
        let logs = new Set();
        this.serverLogs.forEach(name => logs.add(name));
        this.clientLogs.forEach(name => logs.add(name));
        return [...logs];
    }
    hasLog(name) {
        name = String(name);
        return this.hasServerLog(name) || this.hasClientLog(name);
    }

    get loading() {
        Object.keys(this.#loading).forEach(name => {
            if (this.hasLog(name) || name[0] == "§") return;
            delete this.#loading[name];
        });
        return Object.keys(this.#loading);
    }
    incLoading(name) {
        name = String(name);
        if (!this.hasLog(name) && name[0] != "§") return false;
        this.#loading[name] = util.ensure(this.#loading[name], "int")+1;
        return true;
    }
    decLoading(name) {
        name = String(name);
        if (!this.hasLog(name) && name[0] != "§") return false;
        this.#loading[name] = util.ensure(this.#loading[name], "int")-1;
        if (this.#loading[name] <= 0) delete this.#loading[name];
        return true;
    }
    isLoading(name) { return this.loading.includes(name); }

    async logsCache(pths) {
        pths = util.ensure(pths, "arr").map(pth => String(pth));
        let names = await Promise.all(pths.map(async pth => {
            this.incLoading("§caching");
            let name = null;
            try {
                name = await window.api.send("log-cache", pth);
            } catch (e) {
                this.decLoading("§caching");
                throw e;
            }
            this.decLoading("§caching");
            return name;
        }));
        await this.pollClient();
        return names.filter(name => name != null);
    }
    async logsUpload(names) {
        names = util.ensure(names, "arr").map(name => String(name));
        if (this.disconnected) return;
        await Promise.all(names.map(async name => {
            if (!this.hasClientLog(name)) return;
            this.incLoading(name);
            try {
                await window.api.send("log-upload", name);
            } catch (e) {
                this.decLoading(name);
                throw e;
            }
            this.decLoading(name);
        }));
        await this.pollServer();
    }
    async logsDownload(names) {
        names = util.ensure(names, "arr").map(name => String(name));
        if (this.disconnected) return;
        await Promise.all(names.map(async name => {
            this.incLoading(name);
            try {
                await window.api.send("log-download", name);
            } catch (e) {
                this.decLoading(name);
                throw e;
            }
            this.decLoading(name);
        }));
        await this.pollServer();
    }
    async logsClientDelete(names) {
        names = util.ensure(names, "arr").map(name => String(name));
        await Promise.all(names.map(async name => {
            this.incLoading(name);
            try {
                await window.api.send("log-client-delete", name);
            } catch (e) {
                this.decLoading(name);
                throw e;
            }
            this.decLoading(name);
        }));
        await this.pollClient();
    }
    async logsServerDelete(names) {
        names = util.ensure(names, "arr").map(name => String(name));
        if (this.disconnected) return;
        await Promise.all(names.map(async name => {
            this.incLoading(name);
            try {
                await window.api.send("log-server-delete", name);
            } catch (e) {
                this.decLoading(name);
                throw e;
            }
            this.decLoading(name);
        }));
        await this.pollServer();
    }

    async pollServer() {
        let logs = util.ensure(await window.api.get("logs-server"), "arr");
        this.#serverLogs.clear();
        logs.map(log => this.#serverLogs.add(String(log)));
    }
    async pollClient() {
        let logs = util.ensure(await window.api.get("logs-client"), "arr");
        this.#clientLogs = {};
        logs.map(log => {
            log = util.ensure(log, "obj");
            let name = String(log.name), pth = String(log.pth);
            this.#clientLogs[name] = pth;
        });
    }

    update(delta) { this.post("update", delta); }
}
export const LOGGERCONTEXT = new LoggerContext();

export default class PanelLoggerTab extends PanelToolTab {
    #logs;

    #eStatusBox;
    #eStatus;
    #eUploadBtn;
    #eLogs;

    static NAME = "Logger";
    static NICKNAME = "Logger";
    static ICON = "list";
    static ICONSRC = null;
    static ICONCOLOR = "var(--cc)";

    constructor(a) {
        super(a);

        this.elem.classList.add("logger");

        this.#logs = new Set();

        this.#eStatusBox = document.createElement("div");
        this.elem.appendChild(this.eStatusBox);
        this.eStatusBox.classList.add("status");
        let eIcon = document.createElement("ion-icon");
        this.eStatusBox.appendChild(eIcon);
        this.#eStatus = document.createElement("a");
        this.eStatusBox.appendChild(this.eStatus);
        let space = document.createElement("div");
        this.eStatusBox.appendChild(space);
        space.classList.add("space");
        this.#eUploadBtn = document.createElement("button");
        this.eStatusBox.appendChild(this.eUploadBtn);
        this.eUploadBtn.classList.add("icon");
        this.eUploadBtn.classList.add("special");
        this.eUploadBtn.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.#eLogs = document.createElement("div");
        this.elem.appendChild(this.eLogs);
        this.eLogs.classList.add("logs");

        this.eUploadBtn.addEventListener("click", async e => {
            e.stopPropagation();
            if (LOGGERCONTEXT.disconnected) return;
            let result = await core.fileOpenDialog({
                title: "Choose a WPILOG log file",
                buttonLabel: "Upload",
                filters: [{
                    name: "WPILOG",
                    extensions: ["wpilog"],
                }],
                properties: [
                    "openFile",
                    "multiSelections",
                ],
            });
            result = util.ensure(result, "obj");
            if (result.canceled) return;
            const names = await LOGGERCONTEXT.logsCache(result.filePaths);
            await LOGGERCONTEXT.logsUpload(names);
        });

        this.addHandler("format", () => {
            this.logs.sort((a, b) => util.compareStr(a.name, b.name)).forEach((log, i) => {
                log.elem.style.order = i;
            });
        });

        this.addHandler("log-download", async name => {
            name = String(name);
            if (LOGGERCONTEXT.disconnected) return;
            if (!LOGGERCONTEXT.hasServerLog(name)) return;
            try {
                await LOGGERCONTEXT.logsDownload([name]);
            } catch (e) {
                this.app.doError("Log Download Error", "LogName: "+name, e);
            }
        });
        this.addHandler("log-trigger2", (e, name) => {
            name = String(name);
            if (!LOGGERCONTEXT.hasClientLog(name)) return;
            const page = this.page;
            if (!page.hasProject()) return;
            page.project.config.sourceType = "wpilog";
            page.project.config.source = LOGGERCONTEXT.getClientPath(name);
            page.update(0);
            this.app.post("cmd-action");
        });
        let selected = new Set(), lastSelected = null, lastAction = null;
        this.addHandler("log-trigger", (e, name, shift) => {
            name = String(name);
            shift = !!shift;
            if (!LOGGERCONTEXT.hasLog(name)) return;
            if (shift && LOGGERCONTEXT.hasLog(lastSelected)) {
                let logs = LOGGERCONTEXT.logs.sort(util.compareStr);
                let i = logs.indexOf(lastSelected);
                let j = logs.indexOf(name);
                for (let k = i;; k += (j>i?+1:j<i?-1:0)) {
                    if (lastAction == -1) selected.delete(logs[k]);
                    if (lastAction == +1) selected.add(logs[k]);
                    if (k == j) break;
                }
            } else {
                lastSelected = name;
                if (selected.has(name)) {
                    selected.delete(name);
                    lastAction = -1;
                } else {
                    selected.add(name);
                    lastAction = +1;
                }
            }
        });
        const contextMenu = e => {
            let names = [...selected];
            let anyClientHas = false, anyServerHas = false;
            names.forEach(name => LOGGERCONTEXT.hasClientLog(name) ? (anyClientHas = true) : null);
            names.forEach(name => LOGGERCONTEXT.hasServerLog(name) ? (anyServerHas = true) : null);
            let itm;
            let menu = new core.Menu();
            itm = menu.addItem(new core.Menu.Item("Upload"));
            itm.addHandler("trigger", e => {
                this.eUploadBtn.click();
            });
            itm = menu.addItem(new core.Menu.Item("Upload Selected"));
            itm.disabled = names.length <= 0 || !anyClientHas;
            itm.addHandler("trigger", e => {
                LOGGERCONTEXT.logsUpload(names);
            });
            menu.addItem(new core.Menu.Divider());
            itm = menu.addItem(new core.Menu.Item("Open"));
            itm.disabled = names.length != 1;
            itm.addHandler("trigger", e => {
                this.post("log-trigger2", e, names[0]);
            });
            itm = menu.addItem(new core.Menu.Item("Download"));
            itm.disabled = names.length <= 0;
            itm.addHandler("trigger", e => {
                names.forEach(name => this.post("log-download", name));
            });
            menu.addItem(new core.Menu.Divider());
            itm = menu.addItem(new core.Menu.Item("Delete locally"));
            itm.disabled = !anyClientHas;
            itm.addHandler("trigger", e => {
                this.post("log-client-delete", names);
            });
            itm = menu.addItem(new core.Menu.Item("Delete from server"));
            itm.disabled = !anyServerHas;
            itm.addHandler("trigger", e => {
                this.post("log-server-delete", names);
            });
            core.Menu.contextMenu = menu;
            e = util.ensure(e, "obj");
            core.Menu.placeContextMenu(e.pageX, e.pageY);
        };
        this.addHandler("log-contextmenu", (e, name) => {
            if (selected.size == 1) this.post("log-trigger", e, [...selected][0]);
            if (selected.size == 0) this.post("log-trigger", e, name);
            contextMenu(e);
        });
        this.addHandler("log-client-delete", async names => {
            names = util.ensure(names, "arr").map(name => String(name));
            names = names.filter(name => LOGGERCONTEXT.hasClientLog(name));
            await LOGGERCONTEXT.logsClientDelete(names);
        });
        this.addHandler("log-server-delete", async names => {
            names = util.ensure(names, "arr").map(name => String(name));
            if (LOGGERCONTEXT.disconnected) return;
            names = names.filter(name => LOGGERCONTEXT.hasServerLog(name));
            let pop = this.app.confirm("Delete Logs", "Are you sure you want to delete these logs from the server?\nThis will remove the logs for everyone");
            pop.infos = [names.join("\n")];
            let result = await pop.whenResult();
            if (!result) return;
            try {
                await LOGGERCONTEXT.logsServerDelete(names);
            } catch (e) { this.app.doError("Log Delete Error", "Names:", names.join("\n"), e); }
        });

        this.eLogs.addEventListener("click", e => {
            e.stopPropagation();
            selected.clear();
            lastSelected = null;
            lastAction = null;
        });
        this.eLogs.addEventListener("contextmenu", contextMenu);

        let logObjects = {};

        let pub = null;

        this.addHandler("update", delta => {
            if (this.isClosed) return;

            if (pub != window.agent().public) {
                pub = window.agent().public;
                if (pub) {
                    this.elem.style.opacity = "50%";
                    this.elem.style.pointerEvents = "none";
                } else {
                    this.elem.style.opacity = "";
                    this.elem.style.pointerEvents = "";
                }
            }

            this.eUploadBtn.disabled = !LOGGERCONTEXT.hasLocation() || LOGGERCONTEXT.disconnected;
            this.status = LOGGERCONTEXT.hasLocation() ? LOGGERCONTEXT.connected ? LOGGERCONTEXT.location : "Connecting to "+LOGGERCONTEXT.location : "Missing Location";
            if (LOGGERCONTEXT.hasLocation() && LOGGERCONTEXT.connected) {
                eIcon.name = "cloud";
                this.eStatus.setAttribute("href", LOGGERCONTEXT.location);
            } else {
                eIcon.name = "cloud-offline";
                this.eStatus.removeAttribute("href");
            }
            this.loading = LOGGERCONTEXT.isLoading("§caching");

            let logs = LOGGERCONTEXT.logs;
            logs.forEach(name => {
                if (name in logObjects) return;
                logObjects[name] = this.addLog(new PanelLoggerTab.Log(name));
            });
            Object.keys(logObjects).forEach(name => {
                if (logs.includes(name)) return;
                this.remLog(logObjects[name]);
                delete logObjects[name];
            });
            [...selected].forEach(name => {
                if (LOGGERCONTEXT.hasLog(name)) return;
                selected.delete(name);
            });

            this.logs.forEach(log => {
                log.downloaded = LOGGERCONTEXT.hasClientLog(log.name);
                log.deprecated = !LOGGERCONTEXT.hasServerLog(log.name);
                log.loading = LOGGERCONTEXT.isLoading(log.name);
                log.selected = selected.has(log.name);
            });
        });
    }

    get logs() { return [...this.#logs]; }
    set logs(v) {
        v = util.ensure(v, "arr");
        this.clearLogs();
        this.addLog(v);
    }
    clearLogs() {
        let logs = this.logs;
        this.remLog(logs);
        return logs;
    }
    hasLog(log) {
        if (!(log instanceof PanelLoggerTab.Log)) return false;
        return this.#logs.has(log);
    }
    addLog(...logs) {
        let r = util.Target.resultingForEach(logs, log => {
            if (!(log instanceof PanelLoggerTab.Log)) return false;
            if (this.hasLog(log)) return false;
            this.#logs.add(log);
            log.addLinkedHandler(this, "download", () => this.post("log-download", log.name));
            log.addLinkedHandler(this, "trigger", e => this.post("log-trigger", e, log.name, !!(util.ensure(e, "obj").shiftKey)));
            log.addLinkedHandler(this, "trigger2", e => this.post("log-trigger2", e, log.name));
            log.addLinkedHandler(this, "contextmenu", e => this.post("log-contextmenu", e, log.name));
            this.eLogs.appendChild(log.elem);
            log.onAdd();
            return log;
        });
        this.format();
        return r;
    }
    remLog(...logs) {
        return util.Target.resultingForEach(logs, log => {
            if (!(log instanceof PanelLoggerTab.Log)) return false;
            if (!this.hasLog(log)) return false;
            log.onRem();
            this.#logs.delete(log);
            log.clearLinkedHandlers(this, "download");
            log.clearLinkedHandlers(this, "trigger");
            log.clearLinkedHandlers(this, "trigger2");
            log.clearLinkedHandlers(this, "contextmenu");
            this.eLogs.removeChild(log.elem);
            return log;
        });
    }

    get loading() { return this.elem.classList.contains("loading_"); }
    set loading(v) {
        v = !!v;
        if (this.loading == v) return;
        if (v) this.elem.classList.add("loading_");
        else this.elem.classList.remove("loading_");
    }

    get eStatusBox() { return this.#eStatusBox; }
    get eStatus() { return this.#eStatus; }
    get status() { return this.eStatus.textContent; }
    set status(v) { this.eStatus.textContent = v; }
    get eUploadBtn() { return this.#eUploadBtn; }

    get eLogs() { return this.#eLogs; }
}
PanelLoggerTab.Log = class PanelLoggerTabLog extends util.Target {
    #elem;
    #eName;
    #eNav;
    #eDownloadBtn;
    #eUseBtn;

    constructor(name) {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        this.eName.classList.add("name");
        let space = document.createElement("div");
        this.elem.appendChild(space);
        space.classList.add("space");
        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");
        this.#eDownloadBtn = document.createElement("button");
        this.eNav.appendChild(this.eDownloadBtn);
        this.eDownloadBtn.innerHTML = "<ion-icon name='download-outline'></ion-icon>";
        this.#eUseBtn = document.createElement("button");
        this.eNav.appendChild(this.eUseBtn);
        this.eUseBtn.innerHTML = "<ion-icon name='open-outline'></ion-icon>";

        this.eDownloadBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.deprecated) this.post("download");
        });
        this.eUseBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (this.downloaded) this.post("trigger2");
        });
        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
        });
        this.elem.addEventListener("dblclick", e => {
            if (this.downloaded) this.post("trigger2");
            else if (!this.deprecated) this.post("download");
        });
        this.elem.addEventListener("contextmenu", e => {
            e.preventDefault();
            e.stopPropagation();
            this.post("contextmenu", e);
        });

        this.name = name;
    }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }
    get eNav() { return this.#eNav; }
    get eDownloadBtn() { return this.#eDownloadBtn; }
    get eUseBtn() { return this.#eUseBtn; }

    get downloaded() { return this.elem.classList.contains("downloaded"); }
    set downloaded(v) {
        v = !!v;
        if (this.downloaded == v) return;
        if (v) this.elem.classList.add("downloaded");
        else this.elem.classList.remove("downloaded");
        this.eUseBtn.style.display = v ? "" : "none";
    }
    get deprecated() { return this.elem.classList.contains("deprecated"); }
    set deprecated(v) {
        v = !!v;
        if (this.deprecated == v) return;
        if (v) this.elem.classList.add("deprecated");
        else this.elem.classList.remove("deprecated");
        this.eDownloadBtn.style.display = v ? "none" : "";
    }
    get loading() { return this.elem.classList.contains("loading_"); }
    set loading(v) {
        v = !!v;
        if (this.loading == v) return;
        if (v) this.elem.classList.add("loading_");
        else this.elem.classList.remove("loading_");
        Array.from(this.eNav.querySelectorAll(":scope > button")).forEach(btn => (btn.disabled = v));
    }
    get selected() { return this.elem.classList.contains("selected"); }
    set selected(v) {
        v = !!v;
        if (this.selected == v) return;
        if (v) this.elem.classList.add("selected");
        else this.elem.classList.remove("selected");
    }
};
