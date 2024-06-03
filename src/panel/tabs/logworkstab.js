import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";

import Source from "../../sources/source.js";
import HistoricalSource from "../../sources/historical-source.js";
import NTSource from "../../sources/nt4/source.js";
import WPILOGSource from "../../sources/wpilog/source.js";
import CSVTimeSource from "../../sources/csv/time/source.js";
import CSVFieldSource from "../../sources/csv/field/source.js";
import DSSource from "../../sources/ds/source.js";

import { WorkerClient } from "../../worker.js";


import PanelToolTab from "./tooltab.js";


export default class PanelLogWorksTab extends PanelToolTab {
    #actions;
    #actionPage;

    #eActions;

    static NAME = "LogWorks";
    static NICKNAME = "LogWorks";
    static ICON = "list";
    static ICONSRC = null;
    static ICONCOLOR = "var(--cc)";

    constructor(a) {
        super(a);

        this.elem.classList.add("logworks");

        this.#actions = new Set();
        this.#actionPage = 0;

        this.#eActions = document.createElement("div");
        this.elem.appendChild(this.eActions);
        this.eActions.classList.add("actions");

        this.addAction(new PanelLogWorksTab.Action(this, "merge"));
        this.addAction(new PanelLogWorksTab.Action(this, "export"));

        this.actionPage = null;

        this.addHandler("update", delta => this.actions.forEach(action => action.update(delta)));

        if (util.is(a, "str")) a = { actionPage: a };

        a = util.ensure(a, "obj");
        this.actionPage = a.actionPage;
    }

    compute() {
        super.compute();
        try {
            this.actions.forEach(action => action.compute());
        } catch (e) {}
    }

    get actions() { return [...this.#actions]; }
    set actions(v) {
        v = util.ensure(v, "arr");
        this.clearActions();
        this.addAction(v);
    }
    clearActions() {
        let actions = this.actions;
        this.remAction(actions);
        return actions;
    }
    hasAction(action) {
        if (!(action instanceof PanelLogWorksTab.Action)) return false;
        return this.#actions.has(action) && action.tab == this;
    }
    addAction(...actions) {
        return util.Target.resultingForEach(actions, action => {
            if (!(action instanceof PanelLogWorksTab.Action)) return false;
            if (action.tab != this) return false;
            if (this.hasAction(action)) return false;
            this.#actions.add(action);
            this.elem.appendChild(action.elem);
            this.eActions.appendChild(action.eBtn);
            action.onAdd();
            return action;
        });
    }
    remAction(...actions) {
        return util.Target.resultingForEach(actions, action => {
            if (!(action instanceof PanelLogWorksTab.Action)) return false;
            if (action.tab != this) return false;
            if (!this.hasAction(action)) return false;
            action.onRem();
            this.#actions.delete(action);
            this.elem.removeChild(action.elem);
            this.eActions.removeChild(action.eBtn);
            return action;
        });
    }

    get actionPage() { return this.#actionPage; }
    set actionPage(v) {
        v = (v == null) ? null : String(v);
        if (this.actionPage == v) return;
        this.change("actionPage", this.actionPage, this.#actionPage=v);
        if (this.hasActionPage()) this.elem.classList.remove("home");
        else this.elem.classList.add("home");
        this.actions.forEach(action => {
            if (action.name == this.actionPage) action.show();
            else action.hide();
        });
    }
    hasActionPage() { return this.actionPage != null; }

    get eActions() { return this.#eActions; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            actionPage: this.actionPage,
        });
    }
}
PanelLogWorksTab.Action = class PanelLogWorksTabAction extends util.Target {
    #tab;
    #parent;

    #name;
    #state;    

    #eBtn;
    #eIcon;
    #eName;
    #elem;
    #eHeader;
    #eBackBtn;
    #eTitle;
    #eContent;

    constructor(tab, name) {
        super();

        if (!(tab instanceof PanelLogWorksTab)) throw new Error("Tab is not of class LogWorksTab");
        this.#tab = tab;
        this.compute();

        this.#name = String(name);
        this.#state = new util.Target();

        this.#eBtn = document.createElement("button");
        this.eBtn.classList.add("normal");
        this.#eIcon = document.createElement("ion-icon");
        this.eBtn.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.eBtn.appendChild(this.eName);

        this.#elem = document.createElement("div");
        this.elem.classList.add("action");
        this.elem.classList.add(this.name);
        this.#eHeader = document.createElement("div");
        this.elem.appendChild(this.eHeader);
        this.eHeader.classList.add("header");
        this.#eBackBtn = document.createElement("button");
        this.eHeader.appendChild(this.eBackBtn);
        this.eBackBtn.classList.add("icon");
        this.eBackBtn.innerHTML = "<ion-icon name='arrow-back'><ion-icon>";
        this.#eTitle = document.createElement("div");
        this.eHeader.appendChild(this.eTitle);
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.eBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.tab.actionPage = this.name;
        });
        this.eBackBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.tab.actionPage = null;
        });

        this.#init();
    }

    get tab() { return this.#tab; }
    get parent() { return this.#parent; }
    hasParent() { return !!this.parent; }
    compute() {
        this.#parent = this.tab.parent;
    }
    get app() { return app.App.instance; }
    get page() { return this.app.projectPage; }

    get name() { return this.#name; }

    #init() {
        const state = this.#state;
        let namefs = {
            merge: () => {
                this.elem.classList.add("form");

                this.displayName = this.title = "Merge Logs";
                this.iconSrc = "./assets/icons/merge.svg";

                const conflictAffixMap = {
                    prefix: "prefix",
                    suffix: "suffix",
                };
                const conflictCountMap = {
                    numerical: "numerically",
                    hexadecimal: "hexadecimally",
                    alphabetical: "alphabetically",
                };

                let conflictAffix = null;
                Object.defineProperty(state, "conflictAffix", {
                    get: () => conflictAffix,
                    set: v => {
                        v = String(v);
                        if (!(v in conflictAffixMap)) return;
                        conflictAffix = v;
                        state.eConflictAffixBtnName.textContent = conflictAffixMap[state.conflictAffix];
                    },
                });
                let conflictCount = null;
                Object.defineProperty(state, "conflictCount", {
                    get: () => conflictCount,
                    set: v => {
                        v = String(v);
                        if (!(v in conflictCountMap)) return;
                        conflictCount = v;
                        state.eConflictCountBtnName.textContent = conflictCountMap[state.conflictCount];
                    },
                });
                let logs = new Set();
                Object.defineProperty(state, "logs", {
                    get: () => [...logs],
                    set: v => {
                        v = util.ensure(v, "arr");
                        state.clearLogs();
                        v.forEach(v => state.addLog(v));
                    },
                });
                state.clearLogs = () => {
                    let logs = state.logs;
                    logs.forEach(log => state.remLog(log));
                    return logs;
                };
                state.hasLog = log => {
                    log = String(log);
                    return logs.has(log);
                };
                state.addLog = log => {
                    log = String(log);
                    if (state.hasLog(log)) return false;
                    logs.add(log);
                    state.refresh();
                    return true;
                };
                state.remLog = log => {
                    log = String(log);
                    if (!state.hasLog(log)) return false;
                    logs.delete(log);
                    state.refresh();
                    return true;
                };

                let eHeader;

                eHeader = document.createElement("div");
                eHeader.classList.add("header");
                eHeader.textContent = "Merge Configuration";
                this.eContent.appendChild(eHeader);
                state.eConflict = document.createElement("div");
                this.eContent.appendChild(state.eConflict);
                state.eConflict.classList.add("select");
                state.eConflict.innerHTML = "<div>Merge conflicts with</div>";
                state.eConflictAffixBtn = document.createElement("button");
                state.eConflict.appendChild(state.eConflictAffixBtn);
                state.eConflictAffixBtn.classList.add("normal");
                state.eConflictAffixBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
                state.eConflictAffixBtnName = state.eConflictAffixBtn.children[0];
                state.eConflictAffixBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.Menu();
                    Object.keys(conflictAffixMap).forEach(affix => {
                        itm = menu.addItem(new core.Menu.Item(conflictAffixMap[affix], (state.conflictAffix == affix) ? "checkmark" : ""));
                        itm.addHandler("trigger", e => {
                            state.conflictAffix = affix;
                        });
                    });
                    core.Menu.contextMenu = menu;
                    let r = state.eConflictAffixBtn.getBoundingClientRect();
                    core.Menu.placeContextMenu(r.left, r.bottom);
                    menu.elem.style.minWidth = r.width+"px";
                });
                state.eConflictCountBtn = document.createElement("button");
                state.eConflict.appendChild(state.eConflictCountBtn);
                state.eConflictCountBtn.classList.add("normal");
                state.eConflictCountBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
                state.eConflictCountBtnName = state.eConflictCountBtn.children[0];
                state.eConflictCountBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.Menu();
                    Object.keys(conflictCountMap).forEach(count => {
                        itm = menu.addItem(new core.Menu.Item(conflictCountMap[count], (state.conflictCount == count) ? "checkmark" : ""));
                        itm.addHandler("trigger", e => {
                            state.conflictCount = count;
                        });
                    });
                    core.Menu.contextMenu = menu;
                    let r = state.eConflictCountBtn.getBoundingClientRect();
                    core.Menu.placeContextMenu(r.left, r.bottom);
                    menu.elem.style.minWidth = r.width+"px";
                });
                state.ePrefix = document.createElement("div");
                this.eContent.appendChild(state.ePrefix);
                state.ePrefix.classList.add("prefix");
                state.ePrefix.innerHTML = "<div>Global prefix</div>";
                state.ePrefixInput = document.createElement("input");
                state.ePrefix.appendChild(state.ePrefixInput);
                state.ePrefixInput.type = "text";
                state.ePrefixInput.placeholder = "No prefix";
                state.ePrefixInput.autocomplete = "off";
                state.ePrefixInput.spellcheck = false;
                eHeader = document.createElement("div");
                eHeader.classList.add("header");
                eHeader.textContent = "Selected Logs";
                this.eContent.appendChild(eHeader);
                state.eLogs = document.createElement("div");
                this.eContent.appendChild(state.eLogs);
                state.eLogs.classList.add("logs");
                (new core.DropTarget(state.eLogs)).addHandler("files", files => {
                    files = util.ensure(files, "arr").filter(file => file instanceof File);
                    if (files.length <= 0) return;
                    files.forEach(file => state.addLog(file.path));
                });
                state.eSubmit = document.createElement("button");
                this.eContent.appendChild(state.eSubmit);
                state.eSubmit.classList.add("special");
                state.eSubmit.textContent = "Merge";
                state.eSubmit.addEventListener("click", async e => {
                    e.stopPropagation();
                    const app = this.app;
                    state.eSubmit.disabled = true;
                    const progress = v => {
                        app.progress = v;
                    };
                    try {
                        progress(0);
                        const sum = [];
                        const updateSum = () => progress(util.lerp(0, 1/3, sum.sum()/sum.length));
                        const sources = (await Promise.all(state.logs.map(async (log, i) => {
                            sum.push(0);
                            let source = null;
                            try {
                                source = new WPILOGSource();
                                const progress = v => {
                                    sum[i] = v;
                                    updateSum();
                                };
                                source.addHandler("progress", progress);
                                await source.importFrom(log);
                                source.remHandler("progress", progress);
                            } catch (e) {}
                            sum[i] = 1;
                            updateSum();
                            return source;
                        }))).filter(source => !!source);
                        const client = new WorkerClient(new URL("merge-worker.js", window.location));
                        const sourceData = await new Promise((res, rej) => {
                            client.addHandler("error", e => rej(e));
                            client.addHandler("stop", data => rej("WORKER TERMINATED"));
                            client.addHandler("cmd-progress", v => progress(util.lerp(1/3, 1, v)));
                            client.addHandler("cmd-finish", data => {
                                res(data);
                                client.stop();
                            });
                            client.start({
                                opt: {
                                    affix: state.conflictAffix,
                                    count: state.conflictCount,
                                },
                                sources: sources.map(source => source.toSerialized()),
                            });
                        });
                        const source = new WPILOGSource();
                        source.fromSerialized(sourceData);
                        progress(null);
                        const result = util.ensure(await core.fileSaveDialog({
                            title: "Save merged log to...",
                            buttonLabel: "Save",
                        }), "obj");
                        if (!result.canceled && result.filePath) {
                            let pth = String(result.filePath);
                            if (!pth.endsWith(".wpilog")) pth += ".wpilog";
                            source.addHandler("progress", progress);
                            let data = await source.export(state.ePrefixInput.value);
                            source.remHandler("progress", progress);
                            await window.api.send("write", "wpilog", pth, data);
                        }
                    } catch (e) {
                        app.doError("Log Merge Error", "", e);
                    }
                    progress(null);
                    state.eSubmit.disabled = false;
                });

                state.refresh = () => {
                    Array.from(state.eLogs.querySelectorAll(":scope > div:not(.overlay)")).forEach(elem => elem.remove());
                    state.logs.forEach(log => {
                        let elem = document.createElement("div");
                        state.eLogs.appendChild(elem);
                        elem.innerHTML = "<div></div>";
                        elem.children[0].textContent = log;
                        let btn = document.createElement("button");
                        elem.appendChild(btn);
                        btn.innerHTML = "<ion-icon name='close'></ion-icon>";
                        btn.addEventListener("click", e => {
                            e.stopPropagation();
                            state.remLog(log);
                        });
                    });
                    let v = state.eSubmit.disabled = state.logs.length <= 0;
                    if (v == state.eLogs.classList.contains("empty")) return;
                    if (v) state.eLogs.classList.add("empty");
                    else state.eLogs.classList.remove("empty");
                };

                state.conflictAffix = "suffix";
                state.conflictCount = "numerical";
                state.refresh();
            },
            export: () => {
                this.elem.classList.add("form");

                this.displayName = this.title = "Export Logs";
                this.icon = "repeat";

                const portMap = {
                    session: {
                        name: "Current Session",
                        command: "session",
                    },
                    wpilog: {
                        command: "wpilog",
                        decoder: "../wpilog/decoder-worker.js",
                        encoder: "../wpilog/encoder-worker.js",
                        source: WPILOGSource,
                        tags: ["wpilog"],
                    },
                    "csv-time": {
                        command: "csv",
                        decoder: "../csv/time/decoder-worker.js",
                        encoder: "../csv/time/encoder-worker.js",
                        source: CSVTimeSource,
                        tags: ["time.csv"],
                    },
                    "csv-field": {
                        command: "csv",
                        decoder: "../csv/field/decoder-worker.js",
                        encoder: "../csv/field/encoder-worker.js",
                        source: CSVFieldSource,
                        tags: ["field.csv"],
                    },
                    ds: {
                        command: "ds",
                        decoder: "../ds/decoder-worker.js",
                        source: DSSource,
                        tags: ["dslog", "dsevents"],
                    },
                };
                for (let type in portMap)
                    portMap[type].getName = () => {
                        if (portMap[type].name) return portMap[type].name;
                        if (portMap[type].source) return portMap[type].source.getName();
                        return type;
                    };

                let importFrom = null;
                Object.defineProperty(state, "importFrom", {
                    get: () => importFrom,
                    set: v => {
                        v = String(v);
                        if (!(v in portMap)) return;
                        if (v != "session" && !portMap[v].decoder) return;
                        importFrom = v;
                        state.refresh();
                        state.eImportFromBtnName.textContent = portMap[state.importFrom].getName();
                        if (state.importFrom == "session") {
                            dropTarget.disabled = true;
                            return;
                        }
                        dropTarget.disabled = false;
                    },
                });
                let exportTo = null;
                Object.defineProperty(state, "exportTo", {
                    get: () => exportTo,
                    set: v => {
                        v = String(v);
                        if (!(v in portMap)) return;
                        if (v != "session" && !portMap[v].encoder) return;
                        exportTo = v;
                        state.refresh();
                        state.eExportToBtnName.textContent = portMap[state.exportTo].getName();
                    },
                });
                let logs = new Set();
                Object.defineProperty(state, "logs", {
                    get: () => [...logs],
                    set: v => {
                        v = util.ensure(v, "arr");
                        state.clearLogs();
                        v.forEach(v => state.addLog(v));
                    },
                });
                state.clearLogs = () => {
                    let logs = state.logs;
                    logs.forEach(log => state.remLog(log));
                    return logs;
                };
                state.hasLog = log => {
                    log = String(log);
                    return logs.has(log);
                };
                state.addLog = log => {
                    log = String(log);
                    if (state.hasLog(log)) return false;
                    logs.add(log);
                    state.refresh();
                    return true;
                };
                state.remLog = log => {
                    log = String(log);
                    if (!state.hasLog(log)) return false;
                    logs.delete(log);
                    state.refresh();
                    return true;
                };

                const validSubmit = () => {
                    if (state.importFrom == state.exportTo) return false;
                    if (!(state.importFrom in portMap)) return false;
                    if (!(state.exportTo in portMap)) return false;
                    if (state.importFrom != "session" && !portMap[state.importFrom].decoder) return false;
                    if (state.exportTo != "session" && !portMap[state.exportTo].encoder) return false;
                    if (state.importFrom == "session") return true;
                    if (state.exportTo == "session") return state.logs.length == 1;
                    return state.logs.length > 0;
                };

                let eHeader;

                eHeader = document.createElement("div");
                eHeader.classList.add("header");
                eHeader.textContent = "Export Configuration";
                this.eContent.appendChild(eHeader);
                state.eImport = document.createElement("div");
                this.eContent.appendChild(state.eImport);
                state.eImport.classList.add("select");
                state.eImport.innerHTML = "<div>Import from</div>";
                state.eImportFromBtn = document.createElement("button");
                state.eImport.appendChild(state.eImportFromBtn);
                state.eImportFromBtn.classList.add("normal");
                state.eImportFromBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
                state.eImportFromBtnName = state.eImportFromBtn.children[0];
                state.eImportFromBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.Menu();
                    Object.keys(portMap).forEach(type => {
                        if (type != "session" && !portMap[type].decoder) return;
                        itm = menu.addItem(new core.Menu.Item(portMap[type].getName(), (state.importFrom == type) ? "checkmark" : ""));
                        itm.addHandler("trigger", e => {
                            state.importFrom = type;
                        });
                    });
                    core.Menu.contextMenu = menu;
                    let r = state.eImportFromBtn.getBoundingClientRect();
                    core.Menu.placeContextMenu(r.left, r.bottom);
                    menu.elem.style.minWidth = r.width+"px";
                });
                state.eExport = document.createElement("div");
                this.eContent.appendChild(state.eExport);
                state.eExport.classList.add("select");
                state.eExport.innerHTML = "<div>Export to</div>";
                state.eExportToBtn = document.createElement("button");
                state.eExport.appendChild(state.eExportToBtn);
                state.eExportToBtn.classList.add("normal");
                state.eExportToBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
                state.eExportToBtnName = state.eExportToBtn.children[0];
                state.eExportToBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.Menu();
                    Object.keys(portMap).forEach(type => {
                        if (type != "session" && !portMap[type].encoder) return;
                        itm = menu.addItem(new core.Menu.Item(portMap[type].getName(), (state.exportTo == type) ? "checkmark" : ""));
                        itm.addHandler("trigger", e => {
                            state.exportTo = type;
                        });
                    });
                    core.Menu.contextMenu = menu;
                    let r = state.eExportToBtn.getBoundingClientRect();
                    core.Menu.placeContextMenu(r.left, r.bottom);
                    menu.elem.style.minWidth = r.width+"px";
                });
                state.ePrefix = document.createElement("div");
                this.eContent.appendChild(state.ePrefix);
                state.ePrefix.classList.add("prefix");
                state.ePrefix.innerHTML = "<div>Global prefix</div>";
                state.ePrefixInput = document.createElement("input");
                state.ePrefix.appendChild(state.ePrefixInput);
                state.ePrefixInput.type = "text";
                state.ePrefixInput.placeholder = "No prefix";
                state.ePrefixInput.autocomplete = "off";
                state.ePrefixInput.spellcheck = false;
                eHeader = document.createElement("div");
                eHeader.classList.add("header");
                eHeader.textContent = "Logs to Export";
                this.eContent.appendChild(eHeader);
                state.eLogs = document.createElement("div");
                this.eContent.appendChild(state.eLogs);
                state.eLogs.classList.add("logs");
                const dropTarget = new core.DropTarget(state.eLogs);
                dropTarget.addHandler("files", files => {
                    files = util.ensure(files, "arr").filter(file => file instanceof File);
                    if (files.length <= 0) return;
                    files.forEach(file => state.addLog(file.path));
                });
                state.eSubmit = document.createElement("button");
                this.eContent.appendChild(state.eSubmit);
                state.eSubmit.classList.add("special");
                state.eSubmit.textContent = "Export";
                state.eSubmit.addEventListener("click", async e => {
                    e.stopPropagation();
                    const app = this.app;
                    const page = this.page;
                    if (!validSubmit()) return;
                    if (state.exportTo == "session") {
                        if (!page.hasProject()) return;
                        const project = page.project;
                        project.config.sourceType = state.importFrom;
                        project.config.source = state.logs[0];
                        page.update(0);
                        app.post("cmd-action");
                        return;
                    }
                    state.eSubmit.disabled = true;
                    const progress = v => {
                        app.progress = v;
                    };
                    try {
                        progress(0);
                        let sum, a, b;
                        const updateSum = () => progress(util.lerp(a, b, sum.sum()/sum.length));
                        [sum, a, b] = [[], 0, 0.5];
                        const sources = 
                            ((state.importFrom == "session") ?
                                [{ pth: null, source: this.page.source }] :
                            (await Promise.all(state.logs.map(async (pth, i) => {
                                sum.push(0);
                                updateSum();
                                let data = null;
                                try {
                                    const source = new portMap[state.importFrom].source();
                                    const progress = v => {
                                        sum[i] = v;
                                        updateSum();
                                    };
                                    source.addHandler("progress", progress);
                                    await source.importFrom(pth);
                                    source.remHandler("progress", progress);
                                    data = { pth: pth, source: source };
                                } catch (e) { await this.app.doError("Source Import Error", pth, e); }
                                sum[i] = 1;
                                updateSum();
                                return data;
                            }))))
                            .filter(data => (!!data && !!data.source));
                        [sum, a, b] = [[], 0.5, 1];
                        const datas = (await Promise.all(sources.map(async (data, i) => {
                            const { pth, source } = data;
                            sum.push(0);
                            updateSum();
                            data = null;
                            try {
                                const progress = v => {
                                    sum[i] = v;
                                    updateSum();
                                };
                                source.addHandler("progress", progress);
                                data = await portMap[state.exportTo].source.export(source, state.ePrefixInput.value);
                                source.remHandler("progress", progress);
                                data = { pth: pth, source: source, data: data };
                            } catch (e) { await this.app.doError("Source Export Error", pth, e); }
                            sum[i] = 1;
                            updateSum();
                            return data;
                        }))).filter(data => (!!data && !!data.data));
                        const importTags = util.ensure(portMap[state.importFrom].tags, "arr").map(tag => "."+tag);
                        const exportTags = util.ensure(portMap[state.exportTo].tags, "arr").map(tag => "."+tag);
                        for (const data of datas) {
                            const content = data.data;
                            let pth = data.pth;
                            if (pth == null) {
                                const result = util.ensure(await core.fileSaveDialog({
                                    title: "Save exported file to...",
                                    buttonLabel: "Save",
                                }), "obj");
                                if (result.canceled || !result.filePath) continue;
                                pth = String(result.filePath);
                            } else {
                                for (let tag of importTags) {
                                    if (!pth.endsWith(tag)) continue;
                                    pth = pth.slice(0, -tag.length);
                                    break;
                                }
                            }
                            pth = String(pth);
                            if (!pth.endsWith(exportTags[0])) pth += exportTags[0];
                            await window.api.send("write", portMap[state.exportTo].command, pth, content);
                        }
                    } catch (e) {
                        app.doError("Log Export Error", "", e);
                    }
                    progress(null);
                    state.refresh();
                });

                state.refresh = () => {
                    Array.from(state.eLogs.querySelectorAll(":scope > div:not(.overlay)")).forEach(elem => elem.remove());
                    let logs = state.logs;
                    if (state.importFrom == "ds") {
                        logs = logs.map(pth => {
                            let {logPth, eventsPth} = lib.getDSPaths(pth);
                            return [logPth, eventsPth];
                        }).collapse();
                    }
                    logs.forEach(log => {
                        let elem = document.createElement("div");
                        state.eLogs.appendChild(elem);
                        elem.innerHTML = "<div></div>";
                        elem.children[0].textContent = log;
                        if (!state.logs.includes(log)) return;
                        let btn = document.createElement("button");
                        elem.appendChild(btn);
                        btn.innerHTML = "<ion-icon name='close'></ion-icon>";
                        btn.addEventListener("click", e => {
                            e.stopPropagation();
                            state.remLog(log);
                        });
                    });
                    state.eSubmit.disabled = !validSubmit();
                    let v = state.logs.length <= 0;
                    if (v == state.eLogs.classList.contains("empty")) return;
                    if (v) state.eLogs.classList.add("empty");
                    else state.eLogs.classList.remove("empty");
                };

                state.importFrom = "session";
                state.exportTo = "wpilog";
                state.refresh();
            },
        };
        if (this.name in namefs) namefs[this.name]();
    }

    update(delta) { this.post("update", delta); }

    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }

    get displayName() { return this.eName.textContent; }
    set displayName(v) { this.eName.textContent = v; }

    get title() { return this.eTitle.textContent; }
    set title(v) { this.eTitle.textContent = v; }

    get isShown() { return this.elem.classList.contains("this"); }
    set isShown(v) {
        v = !!v;
        if (this.isShown == v) return;
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
    }
    get isHidden() { return !this.isShown; }
    set isHidden(v) { this.isShown = !v; }
    show() { return this.isShown = true; }
    hide() { return this.isHidden = true; }

    get eBtn() { return this.#eBtn; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get elem() { return this.#elem; }
    get eHeader() { return this.#eHeader; }
    get eBackBtn() { return this.#eBackBtn; }
    get eTitle() { return this.#eTitle; }
    get eContent() { return this.#eContent; }
};
