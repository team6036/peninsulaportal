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

        this.fSocketHost.disabled = this.fAssetsOwner.disabled = this.fAssetsRepo.disabled = this.fAssetsTag.disabled = this.fScoutURL.disabled = true;

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

        let ignore = false;

        this.form.addField(new core.Form.Line());

        const inheritedField = this.form.addField(new core.Form.SubForm("Database Inherited"));
        inheritedField.isHorizontal = false;
        const inheritedForm = inheritedField.form;
        
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
            ignore = true;
            await Promise.all([
                async () => {
                    const data = util.ensure(await this.getInherited(), "obj");
                    for (let k in data) {
                        if (!(k in dataItems)) {
                            dataItems[k] = new this.constructor.Item(k, this);
                            inheritedForm.addField(dataItems[k].formField);
                            dataItems[k].onAdd();
                            dataItems[k].disable();
                        }
                        dataItems[k].apply(data[k]);
                    }
                    for (let k in dataItems) {
                        if (k in data) continue;
                        dataItems[k].onRem();
                        inheritedForm.remField(dataItems[k].formField);
                        delete dataItems[k];
                    }
                },
            ].map(f => f()));
            ignore = false;
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
                    this.form.addField(overrideItems[k].formField);
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
                this.form.remField(overrideItems[k].formField);
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
    #formField;

    #disabled;

    constructor(k, appForm) {
        super();

        this.#k = String(k);

        if (!(appForm instanceof App.OverrideForm)) throw new Error("AppForm is not of class AppOverrideForm");
        this.#appForm = appForm;
        this.#formField = new core.Form.SubForm(this.k);
        this.formField.isHorizontal = false;

        this.#disabled = false;
    }

    get k() { return this.#k; }

    get appForm() { return this.#appForm; }
    get app() { return this.appForm.app; }
    get formField() { return this.#formField; }
    get form() { return this.formField.form; }

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

        this.form.isHorizontal = true;
        const buttonsField = this.form.addField(new core.Form.Buttons("", [
            { text: "Export", type: "special" },
            { text: "Remove", type: "off" },
            { text: "Change Key", type: "normal" },
        ]));
        buttonsField.showHeader = false;
        buttonsField.addHandler("trigger", async (i, e) => {
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

        let nameFieldIgnore = false;
        const nameField = this.form.addField(new core.Form.TextInput("name"));
        nameField.addHandler("change-value", () => {
            if (nameFieldIgnore) return;
            this.change("data.name", null, nameField.value);
        });
        nameField.type = "";

        const colorsFormField = this.form.addField(new core.Form.SubForm("colors"));
        colorsFormField.isHorizontal = false;
        const colorsForm = colorsFormField.form;
        colorsForm.isHorizontal = true;
        colorsForm.elem.style.padding = "0px";
        const colorsHTMLField = colorsForm.addField(new core.Form.HTML(""));
        const colorForms = new Array(2).fill(null).map(_ => {
            const form = new core.Form();
            form.isHorizontal = true;
            form.elem.style.padding = "0px";
            colorsHTMLField.eContent.appendChild(form.elem);
            return form;
        });
        const colorFields = {};

        const baseFormField = this.form.addField(new core.Form.SubForm("base"));
        baseFormField.isHorizontal = false;
        const baseForm = baseFormField.form;
        baseForm.isHorizontal = true;
        const baseFields = [];

        const update = () => {
            buttonsField.eContent.children[1].disabled = this.disabled;
            nameField.disabled = this.disabled;
            for (let k in colorFields)
                colorFields[k].field.disabled = this.disabled;
            baseFields.forEach(field => (field.disabled = this.disabled));
        };

        this.addHandler("change-disable", update);

        this.addHandler("apply", data => {
            data = util.ensure(data, "obj");

            this.formField.header = data.name || this.k;
            this.formField.type = this.k;

            nameFieldIgnore = true;
            if (!nameField.focused) nameField.value = util.ensure(data.name, "str");
            nameFieldIgnore = false;

            const colors = util.ensure(data.colors, "obj");
            for (let k in colors) {
                if (!(k in colorFields)) {
                    let j = 0;
                    for (let jj = 1; jj < colorForms.length; jj++)
                        if (colorForms[jj].fields.length < colorForms[j].fields.length)
                            j = jj;
                    colorFields[k] = {
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
                    colorFields[k].field.useAlpha = false;
                    colorFields[k].field.addLinkedHandler(this, "change-value", () => {
                        if (colorFields[k]._ignore) return;
                        this.change("data.colors."+k, null, colorFields[k].field.value.toHex(false));
                    });
                }
                const field = colorFields[k].field;
                colorFields[k]._ignore = true;
                if (!field.focused) field.value = colors[k];
                colorFields[k]._ignore = false;
                field.type = "--c"+k;
            }
            for (let k in colorFields) {
                if (k in colors) continue;
                colorFields[k].field.clearLinkedHandlers(this, "change-value");
                colorFields[k].form.remField(colorFields[k].field);
                delete colorFields[k];
            }

            const base = util.ensure(data.base, "arr");
            while (baseFields.length < base.length) {
                let i = baseFields.length;
                baseFields.push({
                    field: baseForm.addField(new core.Form.ColorInput(i, null)),
                });
                baseFields[i].field.addLinkedHandler(this, "change-value", () => {
                    if (baseFields[i]._ignore) return;
                    this.change("data.base."+i, null, baseFields[i].field.value.toHex(false));
                });
            }
            while (baseFields.length > base.length) {
                let i = baseFields.length-1;
                baseFields[i].field.clearLinkedHandlers(this, "change-value");
                baseForm.remField(baseFields.pop().field);
            }
            base.forEach((color, i) => {
                const field = baseFields[i].field;
                baseFields[i]._ignore = true;
                if (!field.focused) field.value = color;
                baseFields[i]._ignore = false;
                field.type = "--v"+i;
            });

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
    }

    async getInherited() { return await window.api.get("templates", "data"); }
    async getOverrides() { return await window.api.get("templates", "override"); }

    async applyChange(id, k, v) { await window.api.set("template", id, k, v); }
};
App.TemplatesForm.Item = class AppTemplatesFormItem extends App.TemplatesForm.Item {
    constructor(...a) {
        super(...a);

        this.form.isHorizontal = true;

        const buttonsField = this.form.addField(new core.Form.Buttons("", [
            { text: "Export", type: "special" },
            { text: "Remove", type: "off" },
            { text: "Change Key", type: "normal" },
        ]));
        buttonsField.showHeader = false;
        buttonsField.addHandler("trigger", async (i, e) => {
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

        let nameFieldIgnore = false;
        const nameField = this.form.addField(new core.Form.TextInput("name"));
        nameField.addHandler("change-value", () => {
            if (nameFieldIgnore) return;
            this.change("data.name", null, nameField.value);
        });
        nameField.type = "";

        const odometry2d = new core.Odometry2d();
        const odometry3d = new core.Odometry3d();
        odometry2d.template = odometry3d.template = this.k;
        odometry2d.imageAlpha = 0.5;
        odometry2d.drawGrid = false;

        this.form.addField(new core.Form.HTML("odom2d", odometry2d.elem, odometry3d.elem));

        this.addHandler("rem", () => {
            odometry3d.renderer.forceContextLoss();
        });

        const update = () => {
            buttonsField.eContent.children[1].disabled = this.disabled;
            nameField.disabled = this.disabled;
        };

        this.addHandler("change-disabled", update);

        this.addHandler("apply", data => {
            data = util.ensure(data, "obj");

            this.formField.header = data.name || this.k;
            this.formField.type = this.k;

            nameFieldIgnore = true;
            if (!nameField.focused) nameField.value = util.ensure(data.name, "str");
            nameFieldIgnore = false;

            update();
        });

        this.addHandler("update", delta => {
            if (this.formField.isClosed) return odometry3d.repositionCamera();
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
    }

    async getInherited() { return await window.api.get("robots", "data"); }
    async getOverrides() { return await window.api.get("robots", "override"); }

    async applyChange(id, k, v) { await window.api.set("robot", id, k, v); }
};
App.RobotsForm.Item = class AppRobotsFormItem extends App.RobotsForm.Item {
    constructor(...a) {
        super(...a);

        this.form.isHorizontal = true;

        const buttonsField = this.form.addField(new core.Form.Buttons("", [
            { text: "Export", type: "special" },
            { text: "Remove", type: "off" },
            { text: "Change Key", type: "normal" },
        ]));
        buttonsField.showHeader = false;
        buttonsField.addHandler("trigger", async (i, e) => {
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

        let nameFieldIgnore = false;
        const nameField = this.form.addField(new core.Form.TextInput("name"));
        nameField.addHandler("change-value", () => {
            if (nameFieldIgnore) return;
            this.change("data.name", null, nameField.value);
        });
        nameField.type = "";

        const update = () => {
            buttonsField.eContent.children[1].disabled = this.disabled;
            nameField.disabled = this.disabled;
        };

        this.addHandler("change-disabled", update);

        this.addHandler("apply", data => {
            data = util.ensure(data, "obj");

            this.formField.header = data.name || this.k;
            this.formField.type = this.k;

            nameFieldIgnore = true;
            if (!nameField.focused) nameField.value = util.ensure(data.name, "str");
            nameFieldIgnore = false;

            update();
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

        this.form.isHorizontal = true;

        const buttonsField = this.form.addField(new core.Form.Buttons("", [
            { text: "Export", type: "special" },
            { text: "Remove", type: "off" },
            { text: "Change Key", type: "normal" },
        ]));
        buttonsField.showHeader = false;
        buttonsField.addHandler("trigger", async (i, e) => {
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

        let nameFieldIgnore = false;
        const nameField = this.form.addField(new core.Form.TextInput("name"));
        nameField.addHandler("change-value", () => {
            if (nameFieldIgnore) return;
            this.change("data.name", null, nameField.value);
        });
        nameField.type = "";

        const update = () => {
            buttonsField.eContent.children[1].disabled = this.disabled;
            nameField.disabled = this.disabled;
        };

        this.addHandler("change-disabled", update);

        this.addHandler("apply", data => {
            data = util.ensure(data, "obj");

            this.formField.header = data.name || this.k;
            this.formField.type = this.k;

            nameFieldIgnore = true;
            if (!nameField.focused) nameField.value = util.ensure(data.name, "str");
            nameFieldIgnore = false;

            update();
        });
    }
};
