import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";

import Source from "../../sources/source.js";


import PanelToolTab from "./tooltab.js";


export default class PanelToolCanvasTab extends PanelToolTab {
    #quality;

    #eOpen;
    #eOptions;
    #eOptionSections;
    #eContent;
    #canvas; #ctx;

    static NAME = "ToolCanvas";
    static NICKNAME = "ToolCanv";

    static CREATECTX = true;

    constructor(a) {
        super(a);

        this.elem.classList.add("canvas");

        this.#quality = null;

        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#canvas = document.createElement("canvas");
        this.eContent.appendChild(this.canvas);
        this.canvas.tabIndex = 1;
        if (this.constructor.CREATECTX) this.#ctx = this.canvas.getContext("2d");
        this.#eOpen = document.createElement("div");
        this.elem.appendChild(this.eOpen);
        this.eOpen.classList.add("open");
        this.#eOptions = document.createElement("div");
        this.elem.appendChild(this.eOptions);
        this.eOptions.classList.add("options");
        this.#eOptionSections = {};

        let cancel = 10;
        this.eOpen.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            this.optionState = (this.optionState == 0) ? ((this.elem.getBoundingClientRect().height < 500) ? 1 : 0.5) : 0;
        });
        this.eOpen.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            let offset = e.offsetY;
            const mouseup = e => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                if (cancel > 0) return;
                this.elem.style.removeProperty("--options");
                this.elem.classList.remove("drag");
                let r = this.elem.getBoundingClientRect();
                let y = e.pageY;
                y -= r.top;
                y += offset;
                y /= r.height;
                this.optionState = (y < 0.25) ? 1 : (y < 0.75) ? 0.5 : 0;
            };
            const mousemove = e => {
                if (cancel > 0) return cancel--;
                let r = this.elem.getBoundingClientRect();
                let y = e.pageY;
                y -= r.top;
                y += offset;
                y /= r.height;
                this.elem.style.setProperty("--options", (y*100)+"%");
                this.elem.classList.add("drag");
                this.optionState = (y < 0.1) ? 1 : (y < 0.66) ? 0.5 : 0;
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.addHandler("openclose", () => {
            let x = this.optionState;
            if (x > 0) return this.optionState = 0;
            this.optionState = (this.elem.getBoundingClientRect().height < 500) ? 1 : 0.5;
        });

        if (this.constructor.CREATECTX) {
            const updateResize = () => {
                let r = this.eContent.getBoundingClientRect();
                this.canvas.width = r.width * this.quality;
                this.canvas.height = r.height * this.quality;
                this.canvas.style.width = r.width+"px";
                this.canvas.style.height = r.height+"px";
                this.update(0);
            };
            new ResizeObserver(updateResize).observe(this.eContent);
            this.addHandler("add", updateResize);
        }

        let optionState = null;
        new MutationObserver(() => {
            if (optionState != this.optionState)
                this.change("optionState", optionState, optionState=this.optionState);
        }).observe(this.elem, { attributes: true, attributeFilter: ["class"] });

        this.optionState = 1;
        this.optionState = 0;

        a = util.ensure(a, "obj");
        this.optionState = a.optionState;
    }

    get quality() { return this.#quality; }
    set quality(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (util.is(this.quality, "num")) return;
        this.change("quality", this.quality, this.#quality=v);
    }

    get eContent() { return this.#eContent; }
    get canvas() { return this.#canvas; }
    get ctx() { return this.#ctx; }
    get eOpen() { return this.#eOpen; }
    get eOptions() { return this.#eOptions; }
    get eOptionSections() { return Object.keys(this.#eOptionSections); }
    hasEOptionSection(id) { return id in this.#eOptionSections; }
    getEOptionSection(id) { return this.#eOptionSections[id]; }
    addEOptionSection(elem) {
        if (!(elem instanceof HTMLDivElement)) return false;
        if (this.hasEOptionSection(elem.id)) return false;
        this.#eOptionSections[elem.id] = elem;
        this.eOptions.appendChild(elem);
        return elem;
    }

    get optionState() {
        if (this.elem.classList.contains("open")) return 1;
        if (this.elem.classList.contains("half-open")) return 0.5;
        return 0;
    }
    set optionState(v) {
        v = [0, 0.5, 1].includes(v) ? v : 0.5;
        if (this.optionState == v) return;
        this.elem.classList.remove("open");
        this.elem.classList.remove("half-open");
        if (v == 1) {
            this.elem.classList.add("open");
            this.eOpen.innerHTML = "<ion-icon name='chevron-down'></ion-icon>";
        } else if (v == 0.5) {
            this.elem.classList.add("half-open");
            this.eOpen.innerHTML = "<ion-icon name='chevron-expand'></ion-icon>";
        } else {
            this.eOpen.innerHTML = "<ion-icon name='chevron-up'></ion-icon>";
        }
    }
    closeOptions() { return this.optionState = 0; }
}
PanelToolCanvasTab.Hook = class PanelToolCanvasTabHook extends util.Target {
    #path;
    #value;
    #toggle;
    #toggles;

    #elem;
    #eName;
    #eBox;
    #eIcon;

    constructor(name, path) {
        super();

        this.#path = 0;
        this.#value = null;
        this.#toggle = new PanelToolCanvasTab.Hook.Toggle("!");
        this.toggle.addHandler("change", (c, f, t) => this.change("toggle."+c, f, t));
        this.#toggles = new Set();

        this.#elem = document.createElement("div");
        this.elem.classList.add("hook");
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eBox = document.createElement("div");
        this.elem.appendChild(this.eBox);
        this.eBox.classList.add("box");
        this.#eIcon = null;

        this.elem.insertBefore(this.toggle.elem, this.eBox);

        this.name = name;
        this.path = path;
    }

    #update() {
        if (!this.hasPath()) {
            this.eBox.innerHTML = "";
            this.#eIcon = null;
            return;
        }
        this.eBox.innerHTML = "<div class='explorernode'><button class='display'><div class='main'><ion-icon></ion-icon><div class='name'></div><ion-icon name='close'></ion-icon></div></button></div>";
        this.#eIcon = this.eBox.children[0].children[0].children[0].children[0];
        const eName = this.eBox.children[0].children[0].children[0].children[1];
        eName.style.flexBasis = "100%";
        eName.style.textAlign = "left";
        eName.textContent = this.path;
        const eRem = this.eBox.children[0].children[0].children[0].children[2];
        eRem.addEventListener("click", e => {
            e.stopPropagation();
            this.path = null;
        });
    }

    get path() { return this.#path; }
    set path(v) {
        v = (v == null) ? null : util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.#update();
        this.setFrom("*", null);
    }
    hasPath() { return this.path != null; }

    setFrom(t, v) {
        this.#value = v;
        if (!this.eIcon) return;
        const icon = this.eIcon;
        let display = Source.Field.getDisplay(t, v);
        if (display != null) {
            if ("src" in display) icon.setAttribute("src", display.src);
            else icon.name = display.name;
            if ("color" in display) icon.style.color = display.color;
            else icon.style.color = "";
        } else {
            icon.name = "document";
            icon.style.color = "var(--cr)";
        }
    }
    get value() { return this.#value; }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }
    get eBox() { return this.#eBox; }
    get eIcon() { return this.#eIcon; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }

    get toggle() { return this.#toggle; }
    set toggle(v) { this.toggle.from(v); }
    get toggles() { return [...this.#toggles]; }
    set toggles(v) {
        v = util.ensure(v, "arr");
        this.clearToggles();
        this.addToggle(v);
    }
    clearToggles() {
        let toggles = this.toggles;
        this.remToggle(toggles);
        return toggles;
    }
    hasToggle(toggle) {
        if (!(toggle instanceof PanelToolCanvasTab.Hook.Toggle)) return false;
        return this.#toggles.has(toggle);
    }
    addToggle(...toggles) {
        return util.Target.resultingForEach(toggles, toggle => {
            if (!(toggle instanceof PanelToolCanvasTab.Hook.Toggle)) return;
            if (toggle == this.toggle) return false;
            if (this.hasToggle(toggle)) return false;
            this.#toggles.add(toggle);
            this.elem.insertBefore(toggle.elem, this.eBox);
            toggle.addLinkedHandler(this, "change", (c, f, t) => this.change("toggles."+c, f, t));
            this.change("addToggle", null, toggle);
            return toggle;
        });
    }
    remToggle(...toggles) {
        return util.Target.resultingForEach(toggles, toggle => {
            if (!(toggle instanceof PanelToolCanvasTab.Hook.Toggle)) return;
            if (toggle == this.toggle) return false;
            if (!this.hasToggle(toggle)) return false;
            this.#toggles.delete(toggle);
            this.elem.removeChild(toggle.elem);
            toggle.clearLinkedHandlers(this, "change");
            this.change("remToggle", toggle, null);
            return toggle;
        });
    }
    getToggleByName(name) {
        name = String(name);
        for (let toggle of this.toggles)
            if (toggle.name == name)
                return toggle;
        return null;
    }

    to() {
        return {
            path: this.path,
            toggle: this.toggle.to(),
            toggles: this.toggles.map(toggle => toggle.to()),
        };
    }
    from(o) {
        o = util.ensure(o, "obj");
        this.path = o.path;
        this.toggle = o.toggle;
        util.ensure(o.toggles, "arr").forEach(toggle => {
            toggle = util.ensure(toggle, "obj");
            if (!this.getToggleByName(toggle.name)) return;
            this.getToggleByName(toggle.name).from(toggle);
        });
        return this;
    }
};
PanelToolCanvasTab.Hook.Toggle = class PanelToolCanvasTabHookToggle extends util.Target {
    #name;
    #value;

    #elem;

    constructor(name, value=false) {
        super();

        this.#name = String(name);
        this.#value = null;

        this.#elem = document.createElement("button");
        this.elem.classList.add("normal");
        this.elem.textContent = this.name;
        this.elem.addEventListener("click", e => (this.value = !this.value));

        this.value = value;
    }

    get shown() { return this.elem.classList.contains("this"); }
    set shown(v) {
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
    }
    get hidden() { return !this.shown; }
    set hidden(v) { this.shown = !v; }
    show() { return this.shown = true; }
    hide() { return this.hidden = true; }
    get name() { return this.#name; }
    get value() { return this.#value; }
    set value(v) {
        v = !!v;
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
        if (v) this.elem.classList.add("on");
        else this.elem.classList.remove("on");
    }

    get elem() { return this.#elem; }

    to() {
        return {
            name: this.name,
            value: this.value,
        };
    }
    from(o) {
        o = util.ensure(o, "obj");
        this.value = o.value;
        return this;
    }
    static from(o) {
        o = util.ensure(o, "obj");
        return new this(o.name, o.value);
    }
};
