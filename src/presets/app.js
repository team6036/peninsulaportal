import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";


export default class App extends core.App {
    #eInfo;
    #eMain;

    #forms;
    #form;

    constructor() {
        super();

        this.#forms = new Set();
        this.#form = null;

        this.addHandler("pre-setup", () => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("post-setup", async () => {
            this.#eInfo = document.querySelector("#PAGE > .side > .info");
            if (this.hasEInfo()) {
                const putAgent = () => {
                    Array.from(this.eInfo.querySelectorAll(":scope > div:not(.nav)")).forEach(elem => elem.remove());
                    this.getAgent().forEach(line => {
                        let elem = document.createElement("div");
                        this.eInfo.appendChild(elem);
                        elem.textContent = line;
                    });
                }
                putAgent();
                window.onBuildAgent(putAgent);
                const timer = new util.Timer(true);
                this.addHandler("update", async () => {
                    if (!timer.dequeueAll(250)) return;
                    await Promise.all(["repo", "db-host", "scout-url"].map(async name => {
                        const anchor = this.eInfo.querySelector(":scope > .nav > a#"+name);
                        if (!(anchor instanceof HTMLAnchorElement)) return;
                        anchor.href = await window.api.get(name);
                    }));
                });
            }
            this.#eMain = document.querySelector("#PAGE > .main");
            if (this.hasEMain()) {
                let first = true;
                Array.from(document.querySelectorAll("#PAGE > .side > button")).forEach(btn => {
                    this.addHandler("change-form", () => {
                        if (btn.id == this.form)
                            btn.classList.add("this");
                        else btn.classList.remove("this");
                    });
                    btn.addEventListener("click", e => {
                        e.stopPropagation();
                        this.form = btn.id;
                    });
                    if (!first) return;
                    first = false;
                    btn.click();
                });
            }

            this.forms = [
                new App.ApplicationForm(this),
                new App.AppearanceForm(this),
                new App.ThemesForm(this),
                new App.TemplatesForm(this),
                new App.RobotsForm(this),
                new App.HolidaysForm(this),
            ];
            const pull = () => this.forms.forEach(form => form.pull());
            const timer = new util.Timer(true);
            this.addHandler("update", delta => {
                this.forms.forEach(form => form.update(delta));
                if (!timer.dequeueAll(1000)) return;
                pull();
            });
            this.addHandler("cmd-check", pull);
        });
    }

    get forms() { return [...this.#forms]; }
    set forms(v) {
        v = util.ensure(v, "arr");
        this.clearForms();
        this.addForm(v);
    }
    clearForms() {
        let forms = this.forms;
        this.remForm(forms);
        return forms;
    }
    hasForm(form) {
        if (!(form instanceof App.Form)) return false;
        return this.#forms.has(form);
    }
    addForm(...forms) {
        let r = util.Target.resultingForEach(forms, form => {
            if (!(form instanceof App.Form)) return false;
            if (this.hasForm(form)) return false;
            this.#forms.add(form);
            if (this.hasEMain()) this.eMain.appendChild(form.elem);
            return form;
        });
        let form = this.form;
        this.form = null;
        this.form = form;
        return r;
    }
    remForm(...forms) {
        let r = util.Target.resultingForEach(forms, form => {
            if (!(form instanceof App.Form)) return false;
            if (!this.hasForm(form)) return false;
            this.#forms.delete(form);
            if (this.hasEMain()) this.eMain.removeChild(form.elem);
            return form;
        });
        let form = this.form;
        this.form = null;
        this.form = form;
        return r;
    }

    get form() { return this.#form; }
    set form(v) {
        v = (v == null) ? null : String(v);
        if (this.form == v) return;
        this.change("form", this.form, this.#form=v);
        this.forms.forEach(form => form.isOpen = (form.name == this.form));
    }

    get eMain() { return this.#eMain; }
    hasEMain() { return this.eMain instanceof HTMLDivElement; }
    get eInfo() { return this.#eInfo; }
    hasEInfo() { return this.eInfo instanceof HTMLDivElement; }

    get state() {
        return {
            form: this.form,
        };
    }
    async loadState(state) {
        state = util.ensure(state, "obj");
        this.form = state.form || ((this.forms.length > 0) ? this.forms[0].name : null);
    }
}
App.Form = class AppForm extends util.Target {
    #name;
    #app;
    
    #elem;

    #form;
    #fHeader;
    
    constructor(name, app, header=null) {
        super();

        this.#name = String(name);
        if (!(app instanceof App)) throw new Error("App is not instance of class App");
        this.#app = app;

        this.#elem = document.createElement("div");

        this.#form = new core.Form();
        this.elem.appendChild(this.form.elem);
        this.form.isHorizontal = true;
        this.#fHeader = this.form.addField(new core.Form.Header(""));

        this.form.addField(new core.Form.Line());

        this.header = header || util.formatText(this.name);
    }

    get name() { return this.#name; }
    get app() { return this.#app; }

    get elem() { return this.#elem; }

    get form() { return this.#form; }
    get fHeader() { return this.#fHeader; }

    get header() { return this.fHeader.header; }
    set header(v) { this.fHeader.header = v; }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        this.change("isOpen", this.isOpen, v);
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    update(delta) { this.post("update", delta); }
    pull() { this.post("pull"); }
};
App.ApplicationForm = class AppApplicationForm extends App.Form {
    #fAppData;
    #fAppLogs;
    #fAppDataCleanup;
    #fAppLogsClear;

    #fDBHost;
    #fDBPoll;
    #fAssetsOwner;
    #fAssetsRepo;
    #fAssetsTag;
    #fSocketHost;
    #fScoutURL;

    constructor(app) {
        super("application", app);

        let ignore = false;

        this.#fAppData = this.form.addField(new core.Form.Button("application-data-directory", "Open"));
        this.fAppData.addHandler("trigger", async e => await window.api.send("cmd-app-data"));

        this.#fAppLogs = this.form.addField(new core.Form.Button("application-log-directory", "Open"));
        this.fAppLogs.addHandler("trigger", async e => await window.api.send("cmd-app-logs"));

        this.#fAppDataCleanup = this.form.addField(new core.Form.Button("cleanup-application-directory", "Cleanup", "special"));
        this.fAppDataCleanup.addHandler("trigger", async e => {
            let pop = this.app.confirm(
                "Cleanup",
                "Are you sure you want to cleanup application data?\nHere's the files that will be deleted!",
            );
            pop.infos = [(await window.api.get("cleanup")).join("\n")];
            let result = await pop.whenResult();
            if (!result) return;
            await window.api.send("cmd-app-data-cleanup");
        });

        this.#fAppLogsClear = this.form.addField(new core.Form.Button("clear-application-log-directory", "Clear", "off"));
        this.fAppLogsClear.addHandler("trigger", async e => {
            const id = setInterval(() => {
                const progress = Math.min(1, Math.max(0, util.ensure(window.cache.get("app-logs-clear-progress"), "num")));
                if (this.hasApp()) this.app.progress = progress;
                if (progress < 1) return;
                if (this.hasApp()) this.app.progress = null;
            }, 10);
            await window.api.send("cmd-app-logs-clear");
            clearInterval(id);
        });

        this.form.addField(new core.Form.Line());

        this.#fDBHost = this.form.addField(new core.Form.NInput("database-host", 1, "url"));
        this.fDBHost.defineDefaultHook();
        this.fDBHost.showToggle = true;
        this.fDBHost.type = "";
        this.fDBHost.addHandler("change-value", async () => {
            if (ignore) return;
            await window.api.set("db-host", this.fDBHost.value[0]);
        });
        this.fDBHost.addHandler("change-toggleOn", async () => {
            if (ignore) return;
            await window.api.set("comp-mode", this.fDBHost.toggleOff);
        });

        this.#fDBPoll = this.form.addField(new core.Form.Button("poll-database", "Repoll Database"));
        this.fDBPoll.header = "";

        this.#fAssetsOwner = this.form.addField(new core.Form.NInput("assets-github-owner", 1, "url"));
        this.#fAssetsRepo = this.form.addField(new core.Form.NInput("assets-github-repo", 1, "url"));
        this.#fAssetsTag = this.form.addField(new core.Form.NInput("assets-github-tag", 1, "url"));
        this.fAssetsOwner.type = this.fAssetsRepo.type = this.fAssetsTag.type = "";

        this.#fSocketHost = this.form.addField(new core.Form.NInput("socket-host", 1, "url"));
        this.fSocketHost.type = "";

        this.#fScoutURL = this.form.addField(new core.Form.NInput("scout-url", 1, "url"));
        this.fScoutURL.type = "";

        [
            this.fSocketHost,
            this.fAssetsOwner,
            this.fAssetsRepo,
            this.fAssetsTag,
            this.fScoutURL,
        ].flatten().forEach(o => (o.disabled = true));

        this.addHandler("pull", async () => {
            ignore = true;
            await Promise.all([
                async () => {
                    this.fDBHost.toggleOff = await window.api.get("comp-mode");
                    if (this.fDBHost.focused) return;
                    this.fDBHost.value = [await window.api.get("db-host")];
                },
                async () => {
                    this.fAssetsOwner.value = [await window.api.get("assets-owner")];
                },
                async () => {
                    this.fAssetsRepo.value = [await window.api.get("assets-repo")];
                },
                async () => {
                    this.fAssetsTag.value = [await window.api.get("assets-tag")];
                },
                async () => {
                    this.fSocketHost.value = [await window.api.get("socket-host")];
                },
                async () => {
                    this.fScoutURL.value = [await window.api.get("scout-url")];
                },
            ].map(f => f()));
            ignore = false;
        });
    }

    get fAppData() { return this.#fAppData; }
    get fAppLogs() { return this.#fAppLogs; }
    get fAppDataCleanup() { return this.#fAppDataCleanup; }
    get fAppLogsClear() { return this.#fAppLogsClear; }

    get fDBHost() { return this.#fDBHost; }
    get fDBPoll() { return this.#fDBPoll; }
    get fAssetsOwner() { return this.#fAssetsOwner; }
    get fAssetsRepo() { return this.#fAssetsRepo; }
    get fAssetsTag() { return this.#fAssetsTag; }
    get fSocketHost() { return this.#fSocketHost; }
    get fScoutURL() { return this.#fScoutURL; }
};
App.AppearanceForm = class AppAppearanceForm extends App.Form {
    #fTheme;
    #fNativeTheme;
    #fHoliday;
    #fReducedMotion;

    constructor(app) {
        super("appearance", app);

        let ignore = false;

        this.#fTheme = this.form.addField(new core.Form.DropdownInput("theme", [], null));
        this.fTheme.addHandler("change-value", async () => {
            if (ignore) return;
            if (!this.fTheme.hasValue()) return;
            await window.api.set("active-theme", this.fTheme.value);
        });

        this.#fNativeTheme = this.form.addField(new core.Form.DropdownInput("native-theme", [
            { value: "light", name: "Light" },
            { value: "dark", name: "Dark" },
            { value: "system", name: "System" },
        ], null));
        this.fNativeTheme.addHandler("change-value", async () => {
            if (ignore) return;
            if (!this.fNativeTheme.hasValue()) return;
            await window.api.set("native-theme", this.fNativeTheme.value);
        });

        this.#fHoliday = this.form.addField(new core.Form.NInput("holiday", 1, "url"));
        this.fHoliday.inputs[0].placeholder = "No holiday";
        this.fHoliday.showToggle = true;
        this.fHoliday.type = "";
        this.fHoliday.disabled = true;
        this.fHoliday.addHandler("change-toggleOn", async () => {
            if (ignore) return;
            await window.api.set("holiday-opt", this.fHoliday.toggleOff);
        });

        this.#fReducedMotion = this.form.addField(new core.Form.BooleanInput("reduced-motion"));
        this.fReducedMotion.addHandler("change-value", async () => {
            if (ignore) return;
            await window.api.set("reduced-motion", this.fReducedMotion.value);
        });

        this.fTheme.app = this.fNativeTheme.app = this.app;

        this.addHandler("pull", async () => {
            ignore = true;
            await Promise.all([
                async () => {
                    let themes = util.ensure(await window.api.get("themes"), "obj");
                    this.fTheme.values = Object.keys(themes).map(k => {
                        let v = util.ensure(themes[k], "obj");
                        return { value: k, name: v.name || k };
                    });
                    this.fTheme.value = await window.api.get("active-theme");
                },
                async () => {
                    this.fNativeTheme.value = await window.api.get("native-theme");
                },
                async () => {
                    this.fHoliday.toggleOff = await window.api.get("holiday-opt");
                    this.fHoliday.value = [util.formatText(util.ensure(await window.api.get("active-holiday"), "str"))];
                },
                async () => {
                    this.fReducedMotion.value = await window.api.get("reduced-motion");
                },
            ].map(f => f()));
            ignore = false;
        });
    }

    get fTheme() { return this.#fTheme; }
    get fNativeTheme() { return this.#fNativeTheme; }
    get fHoliday() { return this.#fHoliday; }
    get fReducedMotion() { return this.#fReducedMotion; }
};
App.OverrideForm = class AppOverrideForm extends App.Form {
    #fImport;
    #fAdd;

    constructor(name, app) {
        super(name, app);

        const fInherited = this.form.addField(new core.Form.SubForm("Database Inherited"));
        const inheritedForm = fInherited.form;
        
        this.form.addField(new core.Form.Line());

        this.#fImport = this.form.addField(new core.Form.Button("import", "Import", "special"));
        this.fImport.addHandler("trigger", e => this.post("import", e));
        this.#fAdd = this.form.addField(new core.Form.Button("create", "+", "special"));
        this.fAdd.addHandler("trigger", e => this.post("add", e));

        this.form.addField(new core.Form.Line());

        const dataItems = {};

        const overrides = {};
        const overrideItems = {};

        let lock = false;
        this.addHandler("pull", async () => {
            await Promise.all([
                async () => {
                    const data = util.ensure(await this.getInherited(), "obj");
                    for (let k in data) {
                        if (!(k in dataItems)) {
                            dataItems[k] = new this.constructor.Item(k, this);
                            inheritedForm.addField(dataItems[k].fForm);
                            dataItems[k].onAdd();
                            dataItems[k].disable();
                        }
                        dataItems[k].apply(data[k]);
                    }
                    for (let k in dataItems) {
                        if (k in data) continue;
                        dataItems[k].onRem();
                        inheritedForm.remField(dataItems[k].fForm);
                        delete dataItems[k];
                    }
                },
            ].map(f => f()));
            if (lock) return;
            lock = true;
            for (let id in changes)
                for (let k in changes[id])
                    await this.applyChange(id, k, changes[id][k]);
            changes = {};
            let overrides2 = util.ensure(await this.getOverrides(), "obj");
            for (let k in overrides2)
                overrides[k] = overrides2[k];
            for (let k in overrides)
                if (!(k in overrides2))
                    delete overrides[k];
            update();
            lock = false;
        });

        let changes = {};
        const update = () => {
            for (let k in overrides) {
                if (!(k in overrideItems)) {
                    overrideItems[k] = new this.constructor.Item(k, this);
                    this.form.addField(overrideItems[k].fForm);
                    overrideItems[k].addLinkedHandler(this, "change", (c, f, t) => {
                        if (!c.startsWith("data.")) return;
                        c = c.slice(5);
                        if (!changes[k]) changes[k] = {};
                        changes[k][c] = t;
                    });
                    overrideItems[k].onAdd();
                }
                overrideItems[k].apply(overrides[k]);
            }
            for (let k in overrideItems) {
                if (k in overrides) continue;
                overrideItems[k].clearLinkedHandlers(this, "change");
                overrideItems[k].onRem();
                this.form.remField(overrideItems[k].fForm);
                delete overrideItems[k];
            }
        };

        this.addHandler("update", delta => {
            for (let k in dataItems)
                dataItems[k].update(delta);
            for (let k in overrideItems)
                overrideItems[k].update(delta);
        });
    }

    get fImport() { return this.#fImport; }
    get fAdd() { return this.#fAdd; }

    async getInherited() { return null; }
    async getOverrides() { return null; }

    async applyChange(id, k, v) {}
};
App.OverrideForm.Item = class AppOverrideFormItem extends util.Target {
    #k;

    #appForm;
    #fForm;

    #disabled;

    constructor(k, appForm) {
        super();

        this.#k = String(k);

        if (!(appForm instanceof App.OverrideForm)) throw new Error("AppForm is not of class AppOverrideForm");
        this.#appForm = appForm;
        this.#fForm = new core.Form.SubForm(this.k);

        this.#disabled = false;
    }

    get k() { return this.#k; }

    get appForm() { return this.#appForm; }
    get app() { return this.appForm.app; }
    get fForm() { return this.#fForm; }
    get form() { return this.fForm.form; }

    get disabled() { return this.#disabled; }
    set disabled(v) {
        v = !!v;
        if (this.disabled == v) return;
        this.change("disabled", this.disabled, this.#disabled=v);
    }
    get enabled() { return !this.disabled; }
    set enabled(v) { this.disabled = !v; }
    disable() { return this.disabled = true; }
    enable() { return this.enabled = true; }

    apply(data) { this.post("apply", data); }

    update(delta) { this.post("update", delta); }
};
App.ThemesForm = class AppThemesForm extends App.OverrideForm {
    constructor(app) {
        super("themes", app);

        this.fImport.header = "Import Theme";
        this.fAdd.header = "Create Theme";

        this.addHandler("import", async e => {
            const result = util.ensure(await App.fileOpenDialog({
                title: "Import Theme...",
                buttonLabel: "Open",
                filters: [{
                    name: "PDTheme",
                    extensions: ["pdtheme"],
                }],
                properties: [
                    "openFile",
                ],
            }), "obj");
            if (result.canceled) return;
            const pth = result.filePaths[0];
            try {
                await window.api.send("theme-import", pth);
            } catch (e) { this.app.doError("Theme Import Error", pth, e); }
        });

        this.addHandler("add", async () => {
            let k = await this.app.doPrompt("Theme Key", "Enter a unique key identifier");
            if (k == null) return;
            if (await window.api.get("theme", k))
                return this.app.doWarn("Theme Key", "This key ("+k+") already exists!");
            await window.api.send("theme-make", k, {
                name: util.formatText(k),
                colors: {
                    r: "#ff0000",
                    o: "#ff8800",
                    y: "#ffff00",
                    g: "#00ff00",
                    c: "#00ffff",
                    b: "#0088ff",
                    p: "#8800ff",
                    m: "#ff00ff",
                },
                base: Array.from(new Array(9).keys()).map(i => new util.Color(new Array(3).fill(255*i/8)).toHex(false)),
            });
            this.update(null);
        });
    }

    async getInherited() { return await window.api.get("themes", "data"); }
    async getOverrides() { return await window.api.get("themes", "override"); }

    async applyChange(id, k, v) { await window.api.set("theme", id, k, v); }
};
App.ThemesForm.Item = class AppThemesFormItem extends App.ThemesForm.Item {
    constructor(...a) {
        super(...a);

        let ignore = false;

        this.form.isHorizontal = true;
        const fButtons = this.form.addField(new core.Form.Buttons("", [
            { text: "Export", type: "special" },
            { text: "Remove", type: "off" },
            { text: "Change Key", type: "normal" },
        ]));
        fButtons.header = "";
        fButtons.addHandler("trigger", async (i, e) => {
            if (i == 0) {
                const result = util.ensure(await App.fileSaveDialog({
                    title: "Export Theme...",
                    buttonLabel: "Save",
                }), "obj");
                if (result.canceled) return;
                const pth = result.filePath;
                try {
                    await window.api.send("theme-export", pth, this.k, "data");
                } catch (e) { this.app.doError("Theme Export Error", this.k+", "+pth, e); }
                return;
            }
            if (i == 1) {
                try {
                    await window.api.del("theme", this.k);
                } catch (e) { this.app.doError("Theme Delete Error", this.k, e); }
                return;
            }
            if (i == 2) {
                let k = await this.app.doPrompt("Theme Key", "Enter a unique key identifier", this.k);
                if (k == null) return;
                if (await window.api.get("theme", k))
                    return this.app.doWarn("Theme Key", "This key ("+k+") already exists!");
                try {
                    await window.api.send("theme-rekey", this.k, k);
                } catch (e) { this.app.doError("Theme Rekey Error", this.k+", "+k, e); }
                return;
            }
        });

        const fName = this.form.addField(new core.Form.TextInput("name"));
        fName.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.name", null, (fName.value.length > 0) ? fName.value : null);
        });
        fName.type = "";

        const fColorsForm = this.form.addField(new core.Form.SubForm("colors"));
        const colorsForm = fColorsForm.form;
        colorsForm.isHorizontal = true;
        colorsForm.elem.style.padding = "0px";
        const fColorsHTML = colorsForm.addField(new core.Form.HTML(""));
        const colorForms = new Array(2).fill(null).map(_ => {
            const form = new core.Form();
            form.isHorizontal = true;
            form.elem.style.padding = "0px";
            fColorsHTML.eContent.appendChild(form.elem);
            return form;
        });
        const fColors = {};

        const fBaseForm = this.form.addField(new core.Form.SubForm("base"));
        const baseForm = fBaseForm.form;
        baseForm.isHorizontal = true;
        const fBases = [];

        const update = () => {
            [
                fButtons.eContent.children[1],
                fButtons.eContent.children[2],
                fName,
                Object.keys(fColors).map(k => [fColors[k].field]),
                fBases.map(o => o.field),
            ].flatten().forEach(o => (o.disabled = this.disabled));
        };

        this.addHandler("change-disable", update);

        this.addHandler("apply", data => {
            ignore = true;

            data = util.ensure(data, "obj");

            this.fForm.header = data.name || this.k;
            this.fForm.type = this.k;

            if (!fName.focused) fName.value = util.ensure(data.name, "str");

            const colors = util.ensure(data.colors, "obj");
            for (let k in colors) {
                if (!(k in fColors)) {
                    let j = 0;
                    for (let jj = 1; jj < colorForms.length; jj++)
                        if (colorForms[jj].fields.length < colorForms[j].fields.length)
                            j = jj;
                    fColors[k] = {
                        form: colorForms[j],
                        field: colorForms[j].addField(new core.Form.ColorInput({
                            r: "Red",
                            o: "Orange",
                            y: "Yellow",
                            g: "Green",
                            c: "Cyan",
                            b: "Blue",
                            p: "Purple",
                            m: "Magenta",
                        }[k] || k, null)),
                    };
                    fColors[k].field.useAlpha = false;
                    fColors[k].field.addLinkedHandler(this, "change-value", () => {
                        if (ignore) return;
                        this.change("data.colors."+k, null, fColors[k].field.value.toHex(false));
                    });
                }
                const field = fColors[k].field;
                if (!field.focused) field.value = colors[k];
                field.type = "--c"+k;
            }
            for (let k in fColors) {
                if (k in colors) continue;
                fColors[k].field.clearLinkedHandlers(this, "change-value");
                fColors[k].form.remField(fColors[k].field);
                delete fColors[k];
            }

            const base = util.ensure(data.base, "arr");
            while (fBases.length < base.length) {
                let i = fBases.length;
                fBases.push({
                    field: baseForm.addField(new core.Form.ColorInput(i, null)),
                });
                fBases[i].field.addLinkedHandler(this, "change-value", () => {
                    if (ignore) return;
                    this.change("data.base."+i, null, fBases[i].field.value.toHex(false));
                });
            }
            while (fBases.length > base.length) {
                let i = fBases.length-1;
                fBases[i].field.clearLinkedHandlers(this, "change-value");
                baseForm.remField(fBases.pop().field);
            }
            base.forEach((color, i) => {
                const field = fBases[i].field;
                if (!field.focused) field.value = color;
                field.type = "--v"+i;
            });

            ignore = false;

            update();
        });
    }
};
App.TemplatesForm = class AppTemplatesForm extends App.OverrideForm {
    constructor(app) {
        super("templates", app);

        this.fImport.header = "Import Template";
        this.fAdd.header = "Create Template";

        this.addHandler("import", async e => {
            const result = util.ensure(await App.fileOpenDialog({
                title: "Import Template...",
                buttonLabel: "Open",
                filters: [{
                    name: "PDTemplate",
                    extensions: ["pdtemplate"],
                }],
                properties: [
                    "openFile",
                ],
            }), "obj");
            if (result.canceled) return;
            const pth = result.filePaths[0];
            try {
                await window.api.send("template-import", pth);
            } catch (e) { this.app.doError("Template Import Error", pth, e); }
        });

        this.addHandler("add", async () => {
            let k = await this.app.doPrompt("Template Key", "Enter a unique key identifier");
            if (k == null) return;
            if (await window.api.get("template", k))
                return this.app.doWarn("Template Key", "This key ("+k+") already exists!");
            await window.api.send("template-make", k, {
                name: util.formatText(k),
                size: [10, 10],
                robotSize: 1,
                robotMass: 100,
            });
            this.update(null);
        });
    }

    async getInherited() { return await window.api.get("templates", "data"); }
    async getOverrides() { return await window.api.get("templates", "override"); }

    async applyChange(id, k, v) { await window.api.set("template", id, k, v); }
};
App.TemplatesForm.Item = class AppTemplatesFormItem extends App.TemplatesForm.Item {
    constructor(...a) {
        super(...a);

        let ignore = false;

        this.form.isHorizontal = true;

        const fButtons = this.form.addField(new core.Form.Buttons("", [
            { text: "Export", type: "special" },
            { text: "Remove", type: "off" },
            { text: "Change Key", type: "normal" },
        ]));
        fButtons.header = "";
        fButtons.addHandler("trigger", async (i, e) => {
            if (i == 0) {
                const result = util.ensure(await App.fileSaveDialog({
                    title: "Export Template...",
                    buttonLabel: "Save",
                }), "obj");
                if (result.canceled) return;
                const pth = result.filePath;
                try {
                    await window.api.send("template-export", pth, this.k, "data");
                } catch (e) { this.app.doError("Template Export Error", this.k+", "+pth, e); }
                return;
            }
            if (i == 1) {
                try {
                    await window.api.del("template", this.k);
                } catch (e) { this.app.doError("Template Delete Error", this.k, e); }
                return;
            }
            if (i == 2) {
                let k = await this.app.doPrompt("Template Key", "Enter a unique key identifier", this.k);
                if (k == null) return;
                if (await window.api.get("template", k))
                    return this.app.doWarn("Template Key", "This key ("+k+") already exists!");
                try {
                    await window.api.send("template-rekey", this.k, k);
                } catch (e) { this.app.doError("Template Rekey Error", this.k+", "+k, e); }
                return;
            }
        });

        const fName = this.form.addField(new core.Form.TextInput("name"));
        fName.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.name", null, (fName.value.length > 0) ? fName.value : null);
        });
        fName.type = "";

        const fSize = this.form.addField(new core.Form.Input2d("size"));
        this.addHandler("add", () => (fSize.app = this.app));
        this.addHandler("rem", () => (fSize.app = null));
        fSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        fSize.baseType = fSize.activeType = "m";
        fSize.step = 0.1;
        fSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
        });
        fSize.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.size", null, fSize.value.xy);
        });

        const fRobotSize = this.form.addField(new core.Form.Input1d("robot-size"));
        this.addHandler("add", () => (fRobotSize.app = this.app));
        this.addHandler("rem", () => (fRobotSize.app = null));
        fRobotSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        fRobotSize.baseType = fRobotSize.activeType = "m";
        fRobotSize.step = 0.1;
        fRobotSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["...", "Height"][i];
            inp.min = 0;
        });
        fRobotSize.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.robotSize", null, fRobotSize.value);
        });

        const fRobotMass = this.form.addField(new core.Form.Input1d("robot-mass"));
        this.addHandler("add", () => (fRobotMass.app = this.app));
        this.addHandler("rem", () => (fRobotMass.app = null));
        fRobotMass.types = ["kg", "lb"];
        fRobotMass.baseType = fRobotMass.activeType = "kg";
        fRobotMass.step = 0.1;
        fRobotMass.inputs.forEach((inp, i) => {
            inp.placeholder = "...";
            inp.min = 0;
        });
        fRobotMass.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.robotMass", null, fRobotMass.value);
        });

        const odometry2d = new core.Odometry2d();
        const odometry3d = new core.Odometry3d();
        odometry2d.template = odometry3d.template = this.k;
        odometry2d.imageAlpha = 0.5;
        odometry2d.drawGrid = false;

        const setImage = async pth => {
            try {
                await window.api.set("template-image", this.k, pth);
            } catch (e) { this.app.doError("Template Image Set Error", this.k+", "+pth, e); }
        }
        const setModel = async pth => {
            try {
                await window.api.set("template-model", this.k, pth);
            } catch (e) { this.app.doError("Template Model Set Error", this.k+", "+pth, e); }
        }

        let fForm;

        fForm = this.form.addField(new core.Form.SubForm("2D"));
        fForm.form.isHorizontal = true;
        const fOdom2dChange = fForm.form.addField(new core.Form.Button("change-image", "Change", "special"));
        fOdom2dChange.addHandler("trigger", async e => {
            let result = util.ensure(await App.fileOpenDialog({
                title: "Select New Image...",
                buttonLabel: "Use",
                filters: [{
                    name: "Image",
                    extensions: ["png"],
                }],
                properties: [
                    "openFile",
                ],
            }));
            if (result.canceled) return;
            await setImage(result.filePaths[0]);
        });
        const fOdom2dRemove = fForm.form.addField(new core.Form.Button("remove-image", "Remove", "off"));
        fOdom2dRemove.addHandler("trigger", async e => {
            try {
                await window.api.del("template-image", this.k);
            } catch (e) { this.app.doError("Template Image Removal Error", this.k, e); }
        });
        const fOdom2d = fForm.form.addField(new core.Form.HTML("odom2d", odometry2d.elem));
        const odom2dDropTarget = new core.DropTarget(fOdom2d.eContent);
        odom2dDropTarget.addHandler("files", async files => {
            files = util.ensure(files, "arr").filter(file => file instanceof File);
            if (files.length <= 0) return;
            await setImage(files[0].path);
        });

        fForm = this.form.addField(new core.Form.SubForm("3D"));
        fForm.form.isHorizontal = true;
        const fOdom3dChange = fForm.form.addField(new core.Form.Button("change-model", "Change", "special"));
        fOdom3dChange.addHandler("trigger", async e => {
            let result = util.ensure(await App.fileOpenDialog({
                title: "Select New Model...",
                buttonLabel: "Use",
                filters: [{
                    name: "GLTF Model",
                    extensions: ["glb"],
                }],
                properties: [
                    "openFile",
                ],
            }));
            if (result.canceled) return;
            await setModel(result.filePaths[0]);
        });
        const fOdom3dRemove = fForm.form.addField(new core.Form.Button("remove-model", "Remove", "off"));
        fOdom3dRemove.addHandler("trigger", async e => {
            try {
                await window.api.del("template-model", this.k);
            } catch (e) { this.app.doError("Template Model Removal Error", this.k, e); }
        });
        const fOdom3d = fForm.form.addField(new core.Form.HTML("odom3d", odometry3d.elem));
        const odom3dDropTarget = new core.DropTarget(fOdom3d.eContent);
        odom3dDropTarget.addHandler("files", async files => {
            files = util.ensure(files, "arr").filter(file => file instanceof File);
            if (files.length <= 0) return;
            await setModel(files[0].path);
        });

        this.addHandler("rem", () => {
            odometry3d.renderer.forceContextLoss();
        });

        const update = () => {
            [
                fButtons.eContent.children[1],
                fButtons.eContent.children[2],
                fName, fSize,
                fRobotSize, fRobotMass,
                fOdom2dChange, fOdom2dRemove, odom2dDropTarget,
                fOdom3dChange, fOdom3dRemove, odom3dDropTarget,
            ].flatten().forEach(o => (o.disabled = this.disabled));
        };

        this.addHandler("change-disabled", update);

        this.addHandler("apply", data => {
            ignore = true;

            data = util.ensure(data, "obj");

            this.fForm.header = data.name || this.k;
            this.fForm.type = this.k;

            if (!fName.focused) fName.value = util.ensure(data.name, "str");

            if (!fSize.focused) fSize.value = data.size;

            if (!fRobotSize.focused) fRobotSize.value = data.robotSize;

            if (!fRobotMass.focused) fRobotMass.value = data.robotMass;

            ignore = false;

            update();
        });

        this.addHandler("update", delta => {
            if (this.fForm.isClosed) return odometry3d.repositionCamera();
            odometry2d.update(delta);
            odometry3d.update(delta);
        });
    }
};
App.RobotsForm = class AppRobotsForm extends App.OverrideForm {
    constructor(app) {
        super("robots", app);

        this.fImport.header = "Import Robot";
        this.fAdd.header = "Create Robot";

        this.addHandler("import", async e => {
            const result = util.ensure(await App.fileOpenDialog({
                title: "Import Robot...",
                buttonLabel: "Open",
                filters: [{
                    name: "PDRobot",
                    extensions: ["pdrobot"],
                }],
                properties: [
                    "openFile",
                ],
            }), "obj");
            if (result.canceled) return;
            const pth = result.filePaths[0];
            try {
                await window.api.send("robot-import", pth);
            } catch (e) { this.app.doError("Robot Import Error", pth, e); }
        });

        this.addHandler("add", async () => {
            let k = await this.app.doPrompt("Robot Key", "Enter a unique key identifier");
            if (k == null) return;
            if (await window.api.get("robot", k))
                return this.app.doWarn("Robot Key", "This key ("+k+") already exists!");
            await window.api.send("robot-make", k, {
                name: util.formatText(k),
                components: {},
            });
            this.update(null);
        });
    }

    async getInherited() { return await window.api.get("robots", "data"); }
    async getOverrides() { return await window.api.get("robots", "override"); }

    async applyChange(id, k, v) { await window.api.set("robot", id, k, v); }
};
App.RobotsForm.Item = class AppRobotsFormItem extends App.RobotsForm.Item {
    constructor(...a) {
        super(...a);

        let ignore = false;

        this.form.isHorizontal = true;

        const fButtons = this.form.addField(new core.Form.Buttons("", [
            { text: "Export", type: "special" },
            { text: "Remove", type: "off" },
            { text: "Change Key", type: "normal" },
        ]));
        fButtons.header = "";
        fButtons.addHandler("trigger", async (i, e) => {
            if (i == 0) {
                const result = util.ensure(await App.fileSaveDialog({
                    title: "Export Robot...",
                    buttonLabel: "Save",
                }), "obj");
                if (result.canceled) return;
                const pth = result.filePath;
                try {
                    await window.api.send("robot-export", pth, this.k, "data");
                } catch (e) { this.app.doError("Robot Export Error", this.k+", "+pth, e); }
                return;
            }
            if (i == 1) {
                try {
                    await window.api.del("robot", this.k);
                } catch (e) { this.app.doError("Robot Delete Error", this.k, e); }
                return;
            }
            if (i == 2) {
                let k = await this.app.doPrompt("Robot Key", "Enter a unique key identifier", this.k);
                if (k == null) return;
                if (await window.api.get("robot", k))
                    return this.app.doWarn("Robot Key", "This key ("+k+") already exists!");
                try {
                    await window.api.send("robot-rekey", this.k, k);
                } catch (e) { this.app.doError("Robot Rekey Error", this.k+", "+k, e); }
                return;
            }
        });

        const fName = this.form.addField(new core.Form.TextInput("name"));
        fName.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.name", null, (fName.value.length > 0) ? fName.value : null);
        });
        fName.type = "";

        const fBumperDetect = this.form.addField(new core.Form.BooleanInput("bumper-detect"));
        fBumperDetect.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.bumperDetect", null, fBumperDetect.value);
        });

        const fDefault = this.form.addField(new core.Form.TextInput("default-model-name"));
        fDefault.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.default", null, (fDefault.value.length > 0) ? fDefault.value : null);
        });
        fDefault.type = "(no file extension)";

        const setDefaultModel = async pth => {
            try {
                await window.api.set("robot-default", this.k, pth);
            } catch (e) { this.app.doError("Robot Default Model Set Error", this.k+", "+pth, e); }
        };
        const setComponentModel = async (k, pth) => {
            try {
                await window.api.set("robot-component", this.k, k, pth);
            } catch (e) { this.app.doError("Robot Component Model Set Error", this.k+", "+k+", "+pth, e); }
        };

        const fDefaultChange = this.form.addField(new core.Form.Button("change-default-model", "Change", "special"));
        fDefaultChange.addHandler("trigger", async e => {
            let result = util.ensure(await App.fileOpenDialog({
                title: "Select New Model...",
                buttonLabel: "Use",
                filters: [{
                    name: "GLTF Model",
                    extensions: ["glb"],
                }],
                properties: [
                    "openFile",
                ],
            }));
            if (result.canceled) return;
            await setDefaultModel(result.filePaths[0]);
        });
        const fDefaultRemove = this.form.addField(new core.Form.Button("remove-default-model", "Remove", "off"));
        fDefaultRemove.addHandler("trigger", async e => {
            try {
                await window.api.del("robot-default", this.k);
            } catch (e) { this.app.doError("Robot Default Model Removal Error", this.k, e); }
        });
        const odometry3d = new core.Odometry3d();
        const fOdom3d = this.form.addField(new core.Form.HTML("odom3d", odometry3d.elem));
        const odom3dDropTarget = new core.DropTarget(fOdom3d.elem);
        odom3dDropTarget.addHandler("files", async files => {
            files = util.ensure(files, "arr").filter(file => file instanceof File);
            if (files.length <= 0) return;
            await setDefaultModel(files[0].path);
        });

        const fZeroForm = this.form.addField(new core.Form.SubForm("default-model-zero"));
        const fRotationsForm = fZeroForm.form.addField(new core.Form.SubForm("rotations"));
        const rotationsForm = fRotationsForm.form;
        rotationsForm.isHorizontal = true;
        const fRotationsAdd = rotationsForm.addField(new core.Form.Button("add-rotation-transform", "Add", "special"));
        fRotationsAdd.addHandler("trigger", e => {
            const robots = core.GLOBALSTATE.getProperty("robots").value;
            const robot = util.ensure(robots[this.k], "obj");
            const zero = util.ensure(robot.zero, "obj");
            const rotations = util.ensure(zero.rotations, "arr");
            this.change("data.zero.rotations."+rotations.length, null, { axis: "x", angle: 0 });
        });
        const fRotations = [];
        const fTranslations = fZeroForm.form.addField(new core.Form.Input3d("translation"));
        fTranslations.types = ["m", "cm", "mm", "yd", "ft", "in"];
        fTranslations.baseType = fTranslations.activeType = "m";
        fTranslations.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.zero.translations", null, fTranslations.value.xyz);
        });

        const fComponentsForm = this.form.addField(new core.Form.SubForm("components"));
        const componentsForm = fComponentsForm.form;
        componentsForm.isHorizontal = true;
        const fAddComponent = componentsForm.addField(new core.Form.Button("add-component", "Add", "special"));
        fAddComponent.addHandler("trigger", async e => {
            let k = await this.app.doPrompt("Robot Component Key", "Enter a unique key identifier");
            if (k == null) return;
            const robot = util.ensure(await window.api.get("robot", k), "obj");
            const components = util.ensure(robot.components, "obj");
            if (k in components)
                return this.app.doWarn("Robot Component Key", "This key ("+k+") already exists!");
            this.change("data.components."+k, null, {
                name: util.formatText(k),
            });
        });
        const fComponents = {};

        const update = () => {
            [
                fButtons.eContent.children[1],
                fButtons.eContent.children[2],
                fName,
                fBumperDetect,
                fDefault,
                fDefaultChange,
                fDefaultRemove,
                odom3dDropTarget,
                fRotations.map(o => [
                    o.fRemove,
                    o.fAxis,
                    o.fAngle,
                ]),
                fTranslations,
                Object.keys(fComponents).map(k => [
                    fComponents[k].fRemove,
                    fComponents[k].fName,
                    fComponents[k].fModelChange,
                    fComponents[k].fModelRemove,
                    fComponents[k].dropTarget,
                ]),
            ].flatten().forEach(o => (o.disabled = this.disabled));
        };

        this.addHandler("change-disabled", update);

        this.addHandler("apply", data => {
            ignore = true;

            data = util.ensure(data, "obj");

            this.fForm.header = data.name || this.k;
            this.fForm.type = this.k;

            if (!fName.focused) fName.value = util.ensure(data.name, "str");

            fBumperDetect.value = ("bumperDetect" in data) ? !!data.bumperDetect : true;

            if (!fDefault.focused) fDefault.value = data.default || "model";

            const zero = util.ensure(data.zero, "obj");
            const rotations = util.ensure(zero.rotations, "arr");
            const translations = new util.V3(zero.translations);

            while (fRotations.length < rotations.length) {
                let i = fRotations.length;
                const fForm = rotationsForm.addField(new core.Form.SubForm(i+1));
                const fRemove = fForm.form.addField(new core.Form.Button("remove-rotation", "Remove", "off"));
                fRemove.addHandler("trigger", async e => {
                    if (ignore) return;
                    try {
                        await window.api.del("robot", this.k, "zero.rotations."+i);
                    } catch (e) { this.app.doError("Robot Default Rotation Delete Error", this.k+", "+i, e); }
                });
                fRemove.isHorizontal = true;
                const fAxis = fForm.form.addField(new core.Form.SelectInput("axis", ["x", "y", "z"], "x"));
                fAxis.showHeader = false;
                fAxis.addHandler("change-value", () => {
                    if (ignore) return;
                    this.change("data.zero.rotations."+i+".axis", null, fAxis.value);
                });
                const fAngle = fForm.form.addField(new core.Form.Input1d("angle"));
                fAngle.isHorizontal = true;
                fAngle.types = ["rad", "deg", "cycle"];
                fAngle.baseType = fAngle.activeType = "deg";
                fAngle.addHandler("change-value", () => {
                    if (ignore) return;
                    this.change("data.zero.rotations."+i+".angle", null, fAngle.value);
                });
                fRotations.push({
                    fForm: fForm,
                    fRemove: fRemove,
                    fAxis: fAxis,
                    fAngle: fAngle,
                });
            }
            while (fRotations.length > rotations.length)
                rotationsForm.remField(fRotations.pop().fForm);
            for (let i = 0; i < rotations.length; i++) {
                const rotation = util.ensure(rotations[i], "obj");
                const { fForm, fAxis, fAngle } = fRotations[i];
                let axis = String(rotation.axis).toLowerCase();
                if (!["x", "y", "z"].includes(axis)) axis = "x";
                fAxis.value = axis;
                let angle = util.ensure(rotation.angle, "num");
                fAngle.value = angle;
                fForm.type = axis.toUpperCase()+" : "+angle;
            }

            if (!fTranslations.focused) fTranslations.value = translations;

            const components = util.ensure(data.components, "obj");
            for (let k in components) {
                const component = util.ensure(components[k], "obj");
                if (!(k in fComponents)) {
                    fComponents[k] = {};
                    const fForm = fComponents[k].fForm = componentsForm.addField(new core.Form.SubForm(k));
                    fForm.form.isHorizontal = true;
                    const fRemove = fComponents[k].fRemove = fForm.form.addField(new core.Form.Button("remove-component", "Remove", "off"));
                    fRemove.addHandler("trigger", async e => {
                        if (ignore) return;
                        try {
                            try {
                                await window.api.del("robot-component", this.k, k);
                            } catch (e) {}
                            await window.api.del("robot", this.k, "components."+k);
                        } catch (e) { this.app.doError("Robot Component Removal Error", this.k+", "+k, e); }
                    });
                    const fName = fComponents[k].fName = fForm.form.addField(new core.Form.TextInput("name"));
                    fName.addHandler("change-value", async () => {
                        if (ignore) return;
                        this.change("data.components."+k+".name", null, (fName.value.length > 0) ? fName.value : null);
                    });
                    fName.type = "";
                    const fModelChange = fComponents[k].fModelChange = fForm.form.addField(new core.Form.Button("change-model", "Change", "special"));
                    fModelChange.addHandler("trigger", async e => {
                        let result = util.ensure(await App.fileOpenDialog({
                            title: "Select New Model...",
                            buttonLabel: "Use",
                            filters: [{
                                name: "GLTF Model",
                                extensions: ["glb"],
                            }],
                            properties: [
                                "openFile",
                            ],
                        }));
                        if (result.canceled) return;
                        await setComponentModel(k, result.filePaths[0]);
                    });
                    const fModelRemove = fComponents[k].fModelRemove = fForm.form.addField(new core.Form.Button("remove-model", "Remove", "off"));
                    fModelRemove.addHandler("trigger", async e => {
                        try {
                            await window.api.del("robot-component", this.k, k);
                        } catch (e) { this.app.doError("Robot Component Model Removal Error", this.k+", "+k, e); }
                    });
                    const odometry3d = fComponents[k].odometry3d = new core.Odometry3d();
                    const fOdom3d = fComponents[k].fOdom3d = fForm.form.addField(new core.Form.HTML("odom3d", odometry3d.elem));
                    const dropTarget = fComponents[k].dropTarget = new core.DropTarget(fOdom3d.eContent);
                    dropTarget.addHandler("files", async files => {
                        files = util.ensure(files, "arr").filter(file => file instanceof File);
                        if (files.length <= 0) return;
                        await setComponentModel(k, files[0].path);
                    });
                }
                const fForm = fComponents[k].fForm;
                fForm.header = component.name || k;
                fForm.type = k;
                const fName = fComponents[k].fName;
                fName.value = util.ensure(component.name, "str");
            }
            for (let k in fComponents) {
                if (k in components) continue;
                fComponents[k].odometry3d.renderer.forceContextLoss();
                componentsForm.remField(fComponents[k].fForm);
                delete fComponents[k];
            }

            ignore = false;

            update();
        });

        let loadLock = false;
        let object = null, theObject = null, wantedObject = null;
        this.addHandler("update", delta => {
            for (let k in fComponents) {
                if (this.fForm.isOpen && fComponents[k].fForm.isOpen) {
                    fComponents[k].odometry3d.update(delta);
                    if (!fComponents[k].loadLock)
                        (async () => {
                            fComponents[k].loadLock = true;
                            fComponents[k].wantedObject = await core.Odometry3d.loadRobot(this.k, "basic", k);
                            fComponents[k].loadLock = false;
                        })();
                    if (fComponents[k].object != fComponents[k].wantedObject) {
                        if (fComponents[k].theObject) fComponents[k].odometry3d.wpilibGroup.remove(fComponents[k].theObject);
                        fComponents[k].object = fComponents[k].wantedObject;
                        fComponents[k].theObject = fComponents[k].object ? fComponents[k].object.clone() : null;
                        if (fComponents[k].theObject) fComponents[k].odometry3d.wpilibGroup.add(fComponents[k].theObject);
                    }
                } else fComponents[k].odometry3d.repositionCamera(0.1);
            }
            if (this.fForm.isClosed) return odometry3d.repositionCamera(0.1);
            odometry3d.update(delta);
            if (!loadLock)
                (async () => {
                    loadLock = true;
                    wantedObject = await core.Odometry3d.loadRobot(this.k, "basic");
                    loadLock = false;
                })();
            if (object != wantedObject) {
                if (theObject) odometry3d.wpilibGroup.remove(theObject);
                object = wantedObject;
                theObject = object ? object.clone() : null;
                if (theObject) odometry3d.wpilibGroup.add(theObject);
            }
        });
    }
};
App.HolidaysForm = class AppHolidaysForm extends App.OverrideForm {
    constructor(app) {
        super("holidays", app);

        this.fImport.header = "Import Holiday";
        this.fAdd.header = "Create Holiday";

        this.addHandler("import", async e => {
            const result = util.ensure(await App.fileOpenDialog({
                title: "Import Holiday...",
                buttonLabel: "Open",
                filters: [{
                    name: "PDHoliday",
                    extensions: ["pdholiday"],
                }],
                properties: [
                    "openFile",
                ],
            }), "obj");
            if (result.canceled) return;
            const pth = result.filePaths[0];
            try {
                await window.api.send("holiday-import", pth);
            } catch (e) { this.app.doError("Holiday Import Error", pth, e); }
        });
    }

    async getInherited() { return await window.api.get("holidays", "data"); }
    async getOverrides() { return await window.api.get("holidays", "override"); }

    async applyChange(id, k, v) { await window.api.set("holiday", id, k, v); }
};
App.HolidaysForm.Item = class AppHolidaysFormItem extends App.HolidaysForm.Item {
    constructor(...a) {
        super(...a);

        let ignore = false;

        this.form.isHorizontal = true;

        const fButtons = this.form.addField(new core.Form.Buttons("", [
            { text: "Export", type: "special" },
            { text: "Remove", type: "off" },
            { text: "Change Key", type: "normal" },
        ]));
        fButtons.header = "";
        fButtons.addHandler("trigger", async (i, e) => {
            if (i == 0) {
                const result = util.ensure(await App.fileSaveDialog({
                    title: "Export Holiday...",
                    buttonLabel: "Save",
                }), "obj");
                if (result.canceled) return;
                const pth = result.filePath;
                try {
                    await window.api.send("holiday-export", pth, this.k, "data");
                } catch (e) { this.app.doError("Holiday Export Error", this.k+", "+pth, e); }
                return;
            }
            if (i == 1) {
                try {
                    await window.api.del("holiday", this.k);
                } catch (e) { this.app.doError("Holiday Delete Error", this.k, e); }
                return;
            }
            if (i == 2) {
                let k = await this.app.doPrompt("Holiday Key", "Enter a unique key identifier", this.k);
                if (k == null) return;
                if (await window.api.get("holiday", k))
                    return this.app.doWarn("Holiday Key", "This key ("+k+") already exists!");
                try {
                    await window.api.send("holiday-rekey", this.k, k);
                } catch (e) { this.app.doError("Holiday Rekey Error", this.k+", "+k, e); }
                return;
            }
        });

        const fName = this.form.addField(new core.Form.TextInput("name"));
        fName.addHandler("change-value", () => {
            if (ignore) return;
            this.change("data.name", null, (fName.value.length > 0) ? fName.value : null);
        });
        fName.type = "";

        const update = () => {
            [
                fButtons.eContent.children[1],
                fButtons.eContent.children[2],
                fName,
            ].flatten().forEach(o => (o.disabled = this.disabled));
        };

        this.addHandler("change-disabled", update);

        this.addHandler("apply", data => {
            ignore = true;

            data = util.ensure(data, "obj");

            this.fForm.header = data.name || this.k;
            this.fForm.type = this.k;

            if (!fName.focused) fName.value = util.ensure(data.name, "str");
            
            ignore = false;

            update();
        });
    }
};
