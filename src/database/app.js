import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";


const FEATURES = ["PANEL", "PLANNER"];


class Field extends util.Target {
    #app;

    #name;

    #size;
    #robotSize;
    #robotMass;

    #fSize;
    #fRobotSize;
    #fRobotMass;
    #fOptions;

    #odometry2d;
    #odometry3d;

    #elem;
    #eBtn;
    #eActive;
    #eNameInput;
    #eContent;
    #eSide;
    #eDisplay;
    #eDisplayNext;
    #eDisplayPrev;
    #eDisplayNav;

    constructor(app, name, size, robotSize, robotMass) {
        super();

        if (!(app instanceof App)) throw new Error("App is not of class App");
        this.#app = app;

        this.#name = String(name);

        this.#size = new V();
        this.size.addHandler("change", (c, f, t) => this.change("size."+c, f, t));
        this.#robotSize = new V();
        this.robotSize.addHandler("change", (c, f, t) => this.change("robotSize."+c, f, t));
        this.#robotMass = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eBtn = document.createElement("button");
        this.eBtn.innerHTML = "<div class='active'></div><input><div class='space'></div><ion-icon name='chevron-down'></ion-icon>";
        this.#eActive = this.eBtn.children[0];
        this.#eNameInput = this.eBtn.children[1];
        this.eNameInput.value = this.name;
        this.elem.appendChild(this.eBtn);
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eSide = document.createElement("div");
        this.eContent.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.#eDisplay = document.createElement("div");
        this.eContent.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eDisplayNext = document.createElement("button");
        this.eDisplay.appendChild(this.eDisplayNext);
        this.eDisplayNext.classList.add("next");
        this.eDisplayNext.innerHTML = "<ion-icon name='chevron-forward'></ion-icon>";
        this.#eDisplayPrev = document.createElement("button");
        this.eDisplay.appendChild(this.eDisplayPrev);
        this.eDisplayPrev.classList.add("prev");
        this.eDisplayPrev.innerHTML = "<ion-icon name='chevron-back'></ion-icon>";
        this.#eDisplayNav = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayNav);
        this.eDisplayNav.classList.add("nav");
        this.#odometry2d = new core.Odometry2d();
        this.eDisplay.appendChild(this.odometry2d.elem);
        this.odometry2d.padding = 20;
        this.addHandler("change", () => (this.odometry2d.size = this.size));
        this.#odometry3d = new core.Odometry3d();
        this.eDisplay.appendChild(this.odometry3d.elem);
        this.addHandler("change", () => (this.odometry3d.size = this.size));

        this.eActive.addEventListener("click", e => {
            e.stopPropagation();
            this.active = !this.active;
        });

        let n = 0, i = 0, btns = [];
        Array.from(this.eDisplay.querySelectorAll(":scope > .odom")).forEach((elem, di) => {
            n++;
            elem.style.setProperty("--di", di);
            let btn = document.createElement("button");
            this.eDisplayNav.appendChild(btn);
            btn.classList.add("override");
            btn.addEventListener("click", e => {
                i = di;
                update();
            });
            btns.push(btn);
        });
        const update = () => {
            this.eDisplay.style.setProperty("--i", i);
            this.eDisplayNext.disabled = i >= n-1;
            this.eDisplayPrev.disabled = i <= 0;
            btns.forEach((btn, di) => {
                if (di == i) btn.classList.add("this");
                else btn.classList.remove("this");
            });
        };
        this.eDisplayNext.addEventListener("click", e => {
            i = Math.min(n-1, Math.max(0, i+1));
            update();
        });
        this.eDisplayPrev.addEventListener("click", e => {
            i = Math.min(n-1, Math.max(0, i-1));
            update();
        });
        update();

        this.eBtn.addEventListener("click", e => {
            if (this.elem.classList.contains("this")) this.elem.classList.remove("this");
            else this.elem.classList.add("this");
            this.eNameInput.disabled = !this.elem.classList.contains("this");
        });
        this.eNameInput.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.eBtn.click();
        this.eBtn.click();

        let apply;

        let form = new core.Form();
        this.eSide.appendChild(form.elem);
        this.#fSize = form.addField(new core.Form.Input2d("field-size"));
        this.fSize.app = this.app;
        this.fSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fSize.baseType = "cm";
        this.fSize.activeType = "m";
        this.fSize.step = 0.1;
        this.fSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
        });
        this.fSize.addHandler("change-value", () => {
            this.size.set(this.fSize.value);
        });
        apply = () => {
            this.fSize.value = this.size;
        };
        this.addHandler("change-size.x", apply);
        this.addHandler("change-size.y", apply);
        this.#fRobotSize = form.addField(new core.Form.Input1d("robot-size"));
        this.fRobotSize.app = this.app;
        this.fRobotSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fRobotSize.baseType = "cm";
        this.fRobotSize.activeType = "m";
        this.fRobotSize.step = 0.1;
        this.fRobotSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["...", "Height"][i];
            inp.min = 0;
        });
        this.fRobotSize.addHandler("change-value", () => {
            this.robotSize = this.fRobotSize.value;
        });
        apply = () => {
            this.fRobotSize.value = this.robotSize.x;
        };
        this.addHandler("change-robotSize.x", apply);
        this.addHandler("change-robotSize.y", apply);
        this.#fRobotMass = form.addField(new core.Form.Input1d("robot-mass"));
        this.fRobotMass.app = this.app;
        this.fRobotMass.types = ["kg", "lb"];
        this.fRobotMass.baseType = this.fRobotMass.activeType = "kg";
        this.fRobotMass.step = 0.1;
        this.fRobotMass.inputs.forEach((inp, i) => {
            inp.placeholder = "...";
            inp.min = 0;
        });
        this.fRobotMass.addHandler("change-value", () => {
            this.robotMass = this.fRobotMass.value;
        });
        this.addHandler("change-robotMass", () => {
            this.fRobotMass.value = this.robotMass;
        });

        this.#fOptions = form.addField(new core.Form.JSONInput("options"));
        this.fOptions.addHandler("set", (k, v0, v1) => {
            try {
                v0 = JSON.parse(v0);
            } catch (e) { v0 = null; }
            try {
                v1 = JSON.parse(v1);
            } catch (e) { v1 = null; }
            this.change("options."+k, v0, v1);
        });
        this.fOptions.addHandler("del", (k, v) => {
            try {
                v = JSON.parse(v);
            } catch (e) { v = null; }
            this.change("options."+k, v, "§null");
        });
        
        this.size = size;
        this.robotSize = robotSize;
        this.robotMass = robotMass;

        this.addHandler("update", delta => {
            this.odometry2d.update(delta);
            this.odometry3d.update(delta);
        });
    }

    get app() { return this.#app; }

    get name() { return this.#name; }

    get size() { return this.#size; }
    set size(v) { this.size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }

    get robotSize() { return this.#robotSize; }
    set robotSize(v) { this.robotSize.set(v); }
    get robotW() { return this.robotSize.x; }
    set robotW(v) { this.robotSize.x = v; }
    get robotH() { return this.robotSize.y; }
    set robotH(v) { this.robotSize.y = v; }

    get options() { return this.fOptions.map; }
    set options(v) { this.fOptions.map = v; }
    clearOptions() { return this.fOptions.clear(); }
    hasOption(k) { return this.fOptions.has(k); }
    getOption(k) { return this.fOptions.get(k); }
    setOption(k, v) { return this.fOptions.set(k, v); }
    delOption(k) { return this.fOptions.del(k); }

    get robotMass() { return this.#robotMass; }
    set robotMass(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.robotMass == v) return;
        this.change("robotMass", this.robotMass, this.#robotMass=v);
    }

    get fSize() { return this.#fSize; }
    get fRobotSize() { return this.#fRobotSize; }
    get fRobotMass() { return this.#fRobotMass; }
    get fOptions() { return this.#fOptions; }

    get odometry2d() { return this.#odometry2d; }
    get odometry3d() { return this.#odometry3d; }

    get elem() { return this.#elem; }
    get eBtn() { return this.#eBtn; }
    get eActive() { return this.#eActive; }
    get eNameInput() { return this.#eNameInput; }
    get eContent() { return this.#eContent; }
    get eSide() { return this.#eSide; }
    get eDisplay() { return this.#eDisplay; }
    get eDisplayNext() { return this.#eDisplayNext; }
    get eDisplayPrev() { return this.#eDisplayPrev; }
    get eDisplayNav() { return this.#eDisplayNav; }

    get active() { return this.eActive.classList.contains("this"); }
    set active(v) {
        v = !!v;
        if (this.active == v) return;
        if (v) this.eActive.classList.add("this");
        else this.eActive.classList.remove("this");
        this.change("active", !this.active, this.active);
    }

    update(delta) { this.post("update", delta); }
}

export default class App extends core.App {
    constructor() {
        super();

        this.addHandler("pre-setup", () => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("post-setup", async () => {
            const sideButtons = Array.from(document.body.querySelectorAll("#PAGE > .side button"));
            sideButtons.forEach(btn => {
                const elem = document.querySelector("#PAGE > .content > div#"+btn.id);
                const activate = e => {
                    sideButtons.forEach(btn => btn.classList.remove("this"));
                    btn.classList.add("this");
                    Array.from(document.body.querySelectorAll("#PAGE > .content > div")).forEach(elem => elem.classList.remove("this"));
                    let elem = document.body.querySelector("#PAGE > .content > div#"+btn.id);
                    if (!elem) return;
                    elem.classList.add("this");
                };
                let idfs = {
                    templates: () => {
                        if (!(elem instanceof HTMLDivElement)) return;
                        const eList = elem.querySelector(":scope > .list");
                        if (!(eList instanceof HTMLDivElement)) return;
                        let fields = {};
                        this.addHandler("update", delta => {
                            for (let id in fields)
                                fields[id].update(delta);
                        });
                        this.addHandler("refresh-templates", async () => {
                            const host = String(await window.api.get("socket-host")) + "/api/templates";
                            let data = null;
                            try {
                                let resp = await fetch(host);
                                if (resp.status != 200) throw resp.status;
                                data = await resp.json();
                            } catch (e) {
                                this.doError("Templates Fetch Error", "", e);
                                data = util.ensure(await window.api.get("_fulltemplates"), "obj");
                            }
                            data = util.ensure(data, "obj");
                            let templates = util.ensure(data.templates, "obj");
                            let activeTemplate = data.active in templates ? data.active : null;
                            let templateImages = util.ensure(await window.api.get("template-images"), "obj");
                            for (let id in fields) {
                                if (id in templates) continue;
                                let field = fields[id];
                                eList.removeChild(field.elem);
                                field.clearLinkedHandlers(this, "change");
                                delete fields[id];
                            }
                            for (let id in templates) {
                                if (!(id in fields)) {
                                    let field = fields[id] = new Field(this, id, 0, 0, 0);
                                    eList.appendChild(field.elem);
                                    field.addLinkedHandler(this, "change", async (c, f, t) => {
                                        if (field.ignore) return;
                                        if (c == "active") {
                                            t = t ? id : null;
                                            try {
                                                let resp = await fetch(host, {
                                                    method: "PUT",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                        attr: "active",
                                                        value: t,
                                                    }),
                                                });
                                                if (resp.status != 200) throw resp.status;
                                            } catch (e) {
                                                this.doError("Template Update Error", "Put active = "+JSON.stringify(t), e);
                                            }
                                            return this.refreshTemplates();
                                        }
                                        if (c.endsWith(".x")) c = c.substring(0, c.length-2)+".0";
                                        if (c.endsWith(".y")) c = c.substring(0, c.length-2)+".1";
                                        if (util.is(t, "num")) t = Math.round(t*1000000)/1000000;
                                        try {
                                            let resp = await fetch(host, {
                                                method: "DELETE",
                                                headers: {
                                                    "Content-Type": "application/json",
                                                },
                                                body: JSON.stringify({
                                                    attr: "templates."+id+"."+c,
                                                }),
                                            });
                                            if (resp.status != 200) throw resp.status;
                                        } catch (e) {
                                            this.doError("Template Update Error", "Delete templates."+id+"."+c, e);
                                            return this.refreshTemplates();
                                        }
                                        if (c.startsWith("options.") && t != "§null") {
                                            try {
                                                let resp = await fetch(host, {
                                                    method: "PUT",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                        attr: "templates."+id+"."+c,
                                                        value: t,
                                                    }),
                                                });
                                                if (resp.status != 200) throw resp.status;
                                            } catch (e) {
                                                this.doError("Template Update Error", "Put templates."+id+"."+c+" = "+JSON.stringify(t), e);
                                                return this.refreshTemplates();
                                            }
                                        }
                                        this.refreshTemplates();
                                    });
                                }
                                let field = fields[id];
                                field.ignore = true;
                                field.active = id == activeTemplate;
                                field.size = templates[id].size;
                                field.robotSize = templates[id].robotSize;
                                field.robotMass = templates[id].robotMass;
                                field.options = templates[id].options;
                                delete field.ignore;
                                field.odometry2d.imageSrc = templateImages[id];
                                field.odometry3d.template = id;
                            }
                        });
                        btn.addEventListener("click", activate);
                    },
                    features: () => {
                        btn.addEventListener("click", e => {
                            if (btn.parentElement.classList.contains("this")) btn.parentElement.classList.remove("this");
                            else btn.parentElement.classList.add("this");
                            if (
                                btn.parentElement.querySelector(":scope > .sub button.this") &&
                                !btn.parentElement.classList.contains("this")
                            ) btn.classList.add("this");
                            else btn.classList.remove("this");
                        });
                    },
                };
                if (btn.id in idfs) idfs[btn.id]();
                else btn.addEventListener("click", activate);
            });
            sideButtons[0].click();
            const side = document.body.querySelector("#PAGE > .side");
            this.addHandler("update", delta => {
                if (!side) return;
                for (let btn of sideButtons) {
                    if (!btn.classList.contains("this")) continue;
                    side.style.setProperty("--top", btn.getBoundingClientRect().top-side.getBoundingClientRect().top+"px");
                    break;
                }
            });

            this.addHandler("refresh", () => {
                this.refreshTemplates();
                this.refreshRobots();
                this.refreshThemes();
                this.refreshFeatures();
                this.refreshConfig();
            });
            this.addHandler("refresh-features", () => {
                FEATURES.forEach(name => this.refreshFeature(name));
            });

            this.refresh();
        });
    }

    refresh() { this.post("refresh"); }
    refreshTemplates() { this.post("refresh-templates"); }
    refreshRobots() { this.post("refresh-robots"); }
    refreshThemes() { this.post("refresh-themes"); }
    refreshFeatures() { this.post("refresh-features"); }
    refreshFeature(name) { this.post("refresh-feature", name); }
    refreshConfig() { this.post("refresh-config"); }
}
