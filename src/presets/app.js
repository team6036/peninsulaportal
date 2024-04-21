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
                    const repoAnchor = this.eInfo.querySelector(":scope > .nav > a#repo");
                    if (repoAnchor instanceof HTMLAnchorElement)
                        repoAnchor.href = await window.api.get("repo");
                    const dbHostAnchor = this.eInfo.querySelector(":scope > .nav > a#db-host");
                    if (dbHostAnchor instanceof HTMLAnchorElement)
                        dbHostAnchor.href = await window.api.get("db-host");
                    const assetsHostAnchor = this.eInfo.querySelector(":scope > .nav > a#assets-host");
                    if (assetsHostAnchor instanceof HTMLAnchorElement)
                        assetsHostAnchor.href = await window.api.get("assets-host");
                    const scoutURLAnchor = this.eInfo.querySelector(":scope > .nav > a#scout-url");
                    if (scoutURLAnchor instanceof HTMLAnchorElement)
                        scoutURLAnchor.href = await window.api.get("scout-url");
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
            let t0 = null, t1 = null;
            const update = () => {
                t1 = util.getTime();
                if (t0 == null) return t0 = t1;
                this.forms.forEach(form => form.update(t1-t0));
                t0 = t1;
            };
            update();
            const timer = new util.Timer(true);
            this.addHandler("update", delta => {
                if (!timer.dequeueAll(1000)) return;
                update();
            });
            this.addHandler("cmd-check", update);
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
};
App.ApplicationForm = class AppApplicationForm extends App.Form {
    #fAppData;
    #fAppLogs;
    #fAppDataCleanup;
    #fAppLogsClear;

    #fDBHost;
    #fDBPoll;
    #fAssetsHost;
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

        this.#fDBHost = this.form.addField(new core.Form.TextInput("database-host"));
        this.fDBHost.showToggle = true;
        this.fDBHost.type = "";
        this.fDBHost.addHandler("change-value", async () => {
            if (ignore) return;
            await window.api.set("db-host", this.fDBHost.value);
        });
        this.fDBHost.addHandler("change-toggleOn", async () => {
            if (ignore) return;
            await window.api.set("comp-mode", this.fDBHost.toggleOff);
        });

        this.#fDBPoll = this.form.addField(new core.Form.Button("poll-database", "Repoll Database"));
        this.fDBPoll.header = "";

        this.#fAssetsHost = this.form.addField(new core.Form.TextInput("assets-host"));
        this.fAssetsHost.type = "";
        this.fAssetsHost.addHandler("change-value", async () => {
            if (ignore) return;
            await window.api.set("assets-host", this.fAssetsHost.value);
        });

        this.#fSocketHost = this.form.addField(new core.Form.TextInput("socket-host"));
        this.fSocketHost.type = "";

        this.#fScoutURL = this.form.addField(new core.Form.TextInput("scout-url"));
        this.fScoutURL.type = "";

        this.fSocketHost.disabled = this.fScoutURL.disabled = true;

        this.addHandler("update", async delta => {
            ignore = true;
            await Promise.all([
                async () => {
                    this.fDBHost.toggleOff = await window.api.get("comp-mode");
                    if (this.fDBHost.focused) return;
                    this.fDBHost.value = await window.api.get("db-host");
                },
                async () => {
                    this.fAssetsHost.value = await window.api.get("assets-host");
                },
                async () => {
                    this.fSocketHost.value = await window.api.get("socket-host");
                },
                async () => {
                    this.fScoutURL.value = await window.api.get("scout-url");
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
    get fAssetsHost() { return this.#fAssetsHost; }
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

        this.addHandler("update", async delta => {
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
    #fAdd;

    static async makeDBI(form) {}

    constructor(name, app) {
        super(name, app);

        let ignore = false;

        this.form.addField(new core.Form.Line());

        const DBIField = this.form.addField(new core.Form.SubForm("Database Inherited"));
        DBIField.isHorizontal = false;
        const DBIForm = DBIField.form;
        
        this.form.addField(new core.Form.Line());

        this.#fAdd = this.form.addField(new core.Form.Button("create", "+", "special"));

        this.addHandler("update", async delta => {
            ignore = true;
            await Promise.all([
                async () => await this.constructor.makeDBI(DBIForm),
            ].map(f => f()));
            ignore = false;
        });
    }

    get fAdd() { return this.#fAdd; }
};
App.ThemesForm = class AppThemesForm extends App.OverrideForm {
    static async makeDBI(form) {
        if (!(form instanceof core.Form)) return;
        const themes = util.ensure(await window.api.get("themes", "data"), "obj");
        for (let name in themes) {
            const theme = util.ensure(themes[name], "obj");
            if (!form.getField(name)) form.addField(new core.Form.SubForm(name));
            const formField = form.getField(name);
            const formForm = formField.form;
            formField.header = theme.name || name;
            formField.type = name;
            formForm.fields = [];
            formForm.isHorizontal = true;

            formForm.addField(new core.Form.Header("Colors"));
            const colors = util.ensure(theme.colors, "obj");
            for (let k in colors) {
                const field = formForm.addField(new core.Form.ColorInput(k, colors[k]));
                field.type = "--c"+k;
                field.disable();
            }

            formForm.addField(new core.Form.Header("Base"));
            const base = util.ensure(theme.base, "arr");
            base.forEach((color, i) => {
                const field = formForm.addField(new core.Form.ColorInput(i, color));
                field.type = "--v"+i;
                field.disable();
            });
        }
        form.fields.forEach(field => {
            if (field.name in themes) return;
            form.remField(field);
        });
    }

    constructor(app) {
        super("themes", app);

        this.fAdd.header = "Create Theme";
    }
};
App.TemplatesForm = class AppTemplatesForm extends App.OverrideForm {
    static async makeDBI(form) {
        if (!(form instanceof core.Form)) return;
        const templates = util.ensure(await window.api.get("templates", "data"), "obj");
        for (let name in templates) {
            const template = util.ensure(templates[name], "obj");
            if (!form.getField(name)) form.addField(new core.Form.SubForm(name));
            const formField = form.getField(name);
            const formForm = formField.form;
            formField.header = name;
            formField.type = name;
            formForm.fields = [];
            formForm.isHorizontal = true;

            const fHasImage = formForm.addField(new core.Form.BooleanInput("has-image", !("image" in template && !template.image)));
            const fHasModel = formForm.addField(new core.Form.BooleanInput("has-model", !("model" in template && !template.model)));
            fHasImage.disabled = fHasModel.disabled = true;
            fHasImage.isCheckbox = fHasModel.isCheckbox = true;
        }
        form.fields.forEach(field => {
            if (field.name in templates) return;
            form.remField(field);
        });
    }

    constructor(app) {
        super("templates", app);

        this.fAdd.header = "Create Template";
    }
};
App.RobotsForm = class AppRobotsForm extends App.OverrideForm {
    static async makeDBI(form) {
        if (!(form instanceof core.Form)) return;
        const robots = util.ensure(await window.api.get("robots", "data"), "obj");
        for (let name in robots) {
            const robot = util.ensure(robots[name], "obj");
            if (!form.getField(name)) form.addField(new core.Form.SubForm(name));
            const formField = form.getField(name);
            const formForm = formField.form;
            formField.header = name;
            formField.type = name;
            formForm.fields = [];
            formForm.isHorizontal = true;

            const fHasModel = formForm.addField(new core.Form.BooleanInput("has-model", !("model" in robot && !robot.model)));
            fHasModel.disabled = true;
            fHasModel.isCheckbox = true;
        }
        form.fields.forEach(field => {
            if (field.name in robots) return;
            form.remField(field);
        });
    }

    constructor(app) {
        super("robots", app);

        this.fAdd.header = "Create Robot";
    }
};
App.HolidaysForm = class AppHolidaysForm extends App.OverrideForm {
    static async makeDBI(form) {
        if (!(form instanceof core.Form)) return;
        const holidays = util.ensure(await window.api.get("holidays", "data"), "obj");
        for (let name in holidays) {
            const holiday = util.ensure(holidays[name], "obj");
            if (!form.getField(name)) form.addField(new core.Form.SubForm(name));
            const formField = form.getField(name);
            const formForm = formField.form;
            formField.header = holiday.name || name;
            formField.type = name;
            formForm.fields = [];
            formForm.isHorizontal = true;
        }
        form.fields.forEach(field => {
            if (field.name in holidays) return;
            form.remField(field);
        });
    }

    constructor(app) {
        super("holidays", app);

        this.fAdd.header = "Create Holiday";
    }
};
