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
                new App.DatabaseForm(),
            ];
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
        this.forms.forEach(form => (form.isOpen = (form.name == this.form)));
    }

    get eMain() { return this.#eMain; }
    hasEMain() { return this.eMain instanceof HTMLDivElement; }
    get eInfo() { return this.#eInfo; }
    hasEInfo() { return this.eInfo instanceof HTMLDivElement; }
}
App.Form = class AppForm extends util.Target {
    #name;
    
    #elem;

    #form;
    #fHeader;
    
    constructor(name, header=null) {
        super();

        this.#name = String(name);

        this.#elem = document.createElement("div");

        this.#form = new core.Form();
        this.elem.appendChild(this.form.elem);
        this.form.isHorizontal = true;
        this.#fHeader = this.form.addField(new core.Form.Header(""));
        this.fHeader.eName.style.fontSize = "20px";

        this.header = header || util.formatText(this.name);
    }

    get name() { return this.#name; }

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
};
App.DatabaseForm = class AppDatabaseForm extends App.Form {
    #fDBHost;
    #fAssetsHost;
    #fSocketHost;
    #fScoutURL;

    constructor() {
        super("database");

        this.#fDBHost = this.form.addField(new core.Form.TextInput("database-host"));
        this.fDBHost.type = "";
        this.#fAssetsHost = this.form.addField(new core.Form.TextInput("assets-host"));
        this.fAssetsHost.type = "";
        this.#fSocketHost = this.form.addField(new core.Form.TextInput("socket-host"));
        this.fSocketHost.type = "";
        this.#fScoutURL = this.form.addField(new core.Form.TextInput("scout-url"));
        this.fScoutURL.type = "";
    }

    get fDBHost() { return this.#fDBHost; }
    get fAssetsHost() { return this.#fAssetsHost; }
    get fSocketHost() { return this.#fSocketHost; }
    get fScoutURL() { return this.#fScoutURL; }
};
