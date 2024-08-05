import * as util from "./util.mjs";
import { V } from "./util.mjs";
import * as lib from "./lib.mjs";

import * as THREE from "three";


import Source from "./sources/source.js";


// window.f = () => {
//     ["space-steel", "moon-steel", "blue-marine", "legacy"].forEach((theme, i) => setTimeout(() => window.api.set("active-theme", theme), 10000 + i*1000));
// };


export async function capture(rect) { return await window.api.send("capture", rect); }
export async function fileOpenDialog(options) { return await window.api.send("file-open-dialog", options); }
export async function fileSaveDialog(options) { return await window.api.send("file-save-dialog", options); }


class PropertyCache extends util.Target {
    #cache;
    #colorCache;

    constructor() {
        super();

        this.#cache = {};
        this.#colorCache = {};
    }

    get(k) {
        k = String(k);
        if (k in this.#cache) return this.#cache[k];
        this.#cache[k] = getComputedStyle(document.body).getPropertyValue(k);
        return this.get(k);
    }
    getColor(k) {
        k = String(k);
        if (k in this.#colorCache) return this.#colorCache[k];
        this.#colorCache[k] = new util.Color(this.get(k));
        return this.getColor(k);
    }
    clear() {
        this.#cache = {};
        this.#colorCache = {};
    }
}
export const PROPERTYCACHE = new PropertyCache();

export class GlobalState extends util.Target {
    #properties;
    #gettingResolver;

    constructor() {
        super();

        this.#properties = {};
        this.#gettingResolver = new util.Resolver(0);
    }

    get properties() { return Object.values(this.#properties); }
    set properties(v) {
        v = util.ensure(v, "arr");
        this.clearProperties();
        this.addProperty(v);
    }
    clearProperties() {
        let properties = this.properties;
        this.remProperty(properties);
        return properties;
    }
    hasProperty(prop) {
        if (prop instanceof GlobalState.Property)
            return this.hasProperty(prop.name) && this.getProperty(prop.name) == prop;
        return String(prop) in this.#properties;
    }
    getProperty(name) {
        name = String(name);
        if (!this.hasProperty(name)) return null;
        return this.#properties[name];
    }
    addProperty(...props) {
        return util.Target.resultingForEach(props, prop => {
            if (!(prop instanceof GlobalState.Property)) return false;
            if (this.hasProperty(prop.name) || this.hasProperty(prop)) return false;
            this.#properties[prop.name] = prop;
            return prop;
        });
    }
    remProperty(...props) {
        return util.Target.resultingForEach(props, prop => {
            if (!(prop instanceof GlobalState.Property)) prop = this.getProperty(prop);
            if (!this.hasProperty(prop)) return false;
            delete this.#properties[prop.name];
            return prop;
        });
    }

    get getting() { return this.#gettingResolver.state > 0; }
    async whenGetting() { return await this.#gettingResolver.whenNot(0); }
    async whenNotGetting() { return await this.#gettingResolver.when(0); }
    async get() {
        this.#gettingResolver.state++;
        await Promise.all(this.properties.map(prop => prop.get()));
        this.#gettingResolver.state--;
        return this;
    }
}
GlobalState.Property = class GlobalStateProperty extends util.Target {
    #name;
    #getter;
    #value;

    constructor(name, getter) {
        super();

        this.#name = String(name);
        this.#getter = () => null;
        this.#value = null;

        this.getter = getter;
    }

    get name() { return this.#name; }
    get getter() { return this.#getter; }
    set getter(v) {
        v = util.ensure(v, "func");
        if (this.getter == v) return;
        this.change("getter", this.getter, this.#getter=v);
    }
    get value() { return this.#value; }

    async get() {
        this.#value = await this.getter();
        return this.value;
    }
};
export const GLOBALSTATE = new GlobalState();
GLOBALSTATE.addProperty(new GlobalState.Property(
    "templates",
    async () => util.ensure(await window.api.get("templates"), "obj"),
));
GLOBALSTATE.addProperty(new GlobalState.Property(
    "template-images",
    async () => util.ensure(await window.api.get("template-images"), "obj"),
));
GLOBALSTATE.addProperty(new GlobalState.Property(
    "template-models",
    async () => util.ensure(await window.api.get("template-models"), "obj"),
));
GLOBALSTATE.addProperty(new GlobalState.Property(
    "active-template",
    async () => {
        let v = await window.api.get("active-template");
        if (v == null) return null;
        return String(v);
    },
));
GLOBALSTATE.addProperty(new GlobalState.Property(
    "robots",
    async () => util.ensure(await window.api.get("robots"), "obj"),
));
GLOBALSTATE.addProperty(new GlobalState.Property(
    "robot-models",
    async () => util.ensure(await window.api.get("robot-models"), "obj"),
));
GLOBALSTATE.addProperty(new GlobalState.Property(
    "active-robot",
    async () => {
        let v = await window.api.get("active-robot");
        if (v == null) return null;
        return String(v);
    },
));


export class PLoadingElement extends HTMLElement {
    #first;

    #type;
    #axis;

    static observedAttributes = ["type", "axis"];

    constructor() {
        super();

        this.#first = true;

        this.#type = "scroll";
        this.#axis = "x";
    }

    get type() { return this.#type; }
    set type(v) {
        v = String(v);
        if (!["scroll", "bounce"].includes(v)) return;
        if (this.type == v) return;
        this.#type = v;
        this.setAttribute("type", this.type);
    }
    get axis() { return this.#axis; }
    set axis(v) {
        v = String(v);
        if (!["x", "y"].includes(v)) return;
        if (this.axis == v) return;
        this.#axis = v;
        this.setAttribute("axis", this.axis);
    }

    connectedCallback() {
        if (!this.#first) return;

        this.#first = false;

        this.innerHTML = "<div>"+Array.from(new Array(4).keys()).map(i => "<div style='--i:"+i+";'></div>").join("")+"</div>";
    }
    attributeChangedCallback(name, prev, curr) { this[name] = curr; }
}
window.customElements.define("p-loading", PLoadingElement);

export class PTooltip extends HTMLElement {
    #first;
    #id;

    #type;

    #ignore;

    #swatches;
    #color;

    #showPicker;
    #showH;
    #showS;
    #showV;
    #showA;
    #useA;

    #eTitle;
    #ePicker;
    #ePickerThumb;
    #eSliders;
    #eSliderInputs;
    #eSwatches;

    static observedAttributes = ["type"];

    constructor() {
        super();

        this.#first = true;
        this.#id = null;

        this.#type = "normal";

        this.#ignore = false;

        this.#swatches = null;
        this.#color = new util.Color();
        this.color.addHandler("change", (c, f, t) => {
            if (this.#ignore) return;
            this.format();
        });

        this.#showPicker = this.#showH = this.#showS = this.#showV = this.#showA = this.#useA = true;
    }

    get type() { return this.#type; }
    set type(v) {
        v = String(v);
        if (!["color", "normal"].includes(v)) return;
        if (this.type == v) return;
        this.#type = v;
        this.setAttribute("type", this.type);
        this.format();
    }

    get swatches() {
        if (!this.hasSwatches()) return null;
        return [...this.#swatches];
    }
    set swatches(v) {
        if (v == null) {
            this.clearSwatches();
            return this.#swatches = null;
        }
        v = util.ensure(v, "arr");
        this.clearSwatches();
        this.addSwatch(v);
    }
    hasSwatches() { return this.#swatches != null; }
    findSwatch(swatch) {
        if (!this.hasSwatches()) return -1;
        for (let i = 0; i < this.#swatches.length; i++)
            if (this.#swatches[i].diff(swatch) < 2)
                return i;
        return -1;
    }
    hasSwatch(swatch) { return this.findSwatch(swatch) >= 0; }
    addSwatch(...swatches) {
        let r = util.Target.resultingForEach(swatches, swatch => {
            swatch = new util.Color(swatch);
            if (this.hasSwatch(swatch)) return false;
            this.#swatches.push(swatch);
            swatch.addLinkedHandler(this, "change", () => this.format());
            return swatch;
        });
        this.format();
        return r;
    }
    remSwatch(...swatches) {
        let r = util.Target.resultingForEach(swatches, swatch => {
            if (!this.hasSwatch(swatch)) return false;
            swatch = this.#swatches[this.findSwatch(swatch)];
            this.#swatches.splice(this.#swatches.indexOf(swatch), 1);
            swatch.clearLinkedHandlers(this, "change");
            return swatch;
        });
        this.format();
        return r;
    }
    get color() { return this.#color; }
    set color(v) { this.#color.set(v); }

    get showPicker() { return this.#showPicker; }
    set showPicker(v) {
        v = !!v;
        if (this.showPicker == v) return;
        this.#showPicker = v;
        this.format();
    }
    get showH() { return this.#showH; }
    set showH(v) {
        v = !!v;
        if (this.showH == v) return;
        this.#showH = v;
        this.format();
    }
    get showS() { return this.#showS; }
    set showS(v) {
        v = !!v;
        if (this.showS == v) return;
        this.#showS = v;
        this.format();
    }
    get showV() { return this.#showV; }
    set showV(v) {
        v = !!v;
        if (this.showV == v) return;
        this.#showV = v;
        this.format();
    }
    get showA() { return this.#showA; }
    set showA(v) {
        v = !!v;
        if (this.showA == v) return;
        this.#showA = v;
        this.format();
    }
    get useA() { return this.#useA; }
    set useA(v) {
        v = !!v;
        if (this.useA == v) return;
        this.#useA = v;
        this.format();
    }

    get title() { return this.#eTitle.textContent; }
    set title(v) { this.#eTitle.textContent = v; }

    format() {
        if (this.#first) return;

        if (this.type != "color") {
            this.#eTitle.remove();
            this.#ePicker.remove();
            this.#eSliders.remove();
            this.#eSwatches.remove();
            return;
        }

        this.appendChild(this.#eTitle);
        this.appendChild(this.#ePicker);
        this.appendChild(this.#eSliders);
        this.appendChild(this.#eSwatches);

        if (this.hasSwatches()) this.#swatches.sort((a, b) => a.h-b.h);
        this.#ePicker.style.display = this.showPicker ? "" : "none";
        this.#eSliders.style.display = (this.showH || this.showS || this.showV || (this.showA && this.useA)) ? "" : "none";
        if (!this.useA) this.color.a = 1;
        let c = new util.Color(255, 0, 0);
        c.h = this.color.h;
        this.#ePicker.style.background = "linear-gradient(90deg, #fff, "+c.toHex(false)+")";
        this.#ePicker.style.setProperty("--thumb", this.color.toHex(false));
        this.#ePickerThumb.style.left = (100*this.color.s)+"%";
        this.#ePickerThumb.style.top = (100*(1-this.color.v))+"%";
        for (let k in this.#eSliderInputs) {
            let v = this.color[k];
            if (k == "h") v /= 360;
            v *= 10000;
            let on = (k == "a") ? (this.showA && this.useA) : this["show"+k.toUpperCase()];
            const eSlider = this.#eSliderInputs[k];
            eSlider.disabled = !on;
            eSlider.style.display = on ? "" : "none";
            if (Math.abs(eSlider.valueAsNumber - v) >= 1) eSlider.value = Math.round(v);
            let cthumb = new util.Color(255, 0, 0);
            let carr = [];
            if (k == "h") {
                cthumb.h = this.color.h;
                for (let i = 0; i < 7; i++) {
                    let c = new util.Color();
                    c.hsv = [util.lerp(0, 360, i/6), 1, 1];
                    carr.push(c);
                }
            } else if (k == "s") {
                cthumb.h = this.color.h;
                cthumb.s = this.color.s;
                let c = new util.Color(255, 0, 0);
                c.h = this.color.h;
                carr.push(new util.Color(255, 255, 255), c);
            } else if (k == "v") {
                cthumb.h = this.color.h;
                cthumb.s = this.color.s;
                cthumb.v = this.color.v;
                let c = new util.Color(255, 0, 0);
                c.h = this.color.h;
                c.s = this.color.s;
                carr.push(new util.Color(0, 0, 0), c);
            } else {
                cthumb.hsva = this.color.hsva;
                let c = new util.Color();
                c.hsv = this.color.hsv;
                carr.push(new util.Color(c.r, c.g, c.b, 0), c);
            }
            eSlider.style.background = "linear-gradient(90deg, "+carr.map(c => c.toHex()).join(", ")+")";
            eSlider.style.setProperty("--thumb", cthumb.toHex());
        }
        this.#eSwatches.innerHTML = "";
        if (this.hasSwatches()) {
            for (let c of this.#swatches) {
                let btn = document.createElement("button");
                this.#eSwatches.appendChild(btn);
                btn.classList.add("override");
                btn.style.backgroundColor = c.toHex();
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.color = c;
                });
            }
        } else {
            for (let c of "roygcbpm") {
                c = PROPERTYCACHE.getColor("--c"+c);
                let btn = document.createElement("button");
                this.#eSwatches.appendChild(btn);
                btn.classList.add("override");
                btn.style.backgroundColor = c.toHex();
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.color = c;
                });
            }
        }
    }

    connectedCallback() {
        clearInterval(this.#id);
        this.#id = setInterval(() => this.format(), 1000);

        if (!this.#first) return this.format();

        this.#first = false;

        this.#eTitle = document.createElement("div");
        this.#eTitle.classList.add("title");
        this.#ePicker = document.createElement("div");
        this.#ePicker.classList.add("picker");
        this.#ePicker.addEventListener("mousedown", e => {
            e.stopPropagation();
            e.preventDefault();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                let r = this.#ePicker.getBoundingClientRect();
                let x = (e.pageX - r.left) / r.width;
                let y = (e.pageY - r.top) / r.height;
                this.color.s = x;
                this.color.v = 1-y;
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.#ePickerThumb = document.createElement("div");
        this.#ePicker.appendChild(this.#ePickerThumb);
        this.#eSliders = document.createElement("div");
        this.#eSliders.classList.add("sliders");
        this.#eSliderInputs = {};
        "hsva".split("").forEach(k => {
            const eSlider = this.#eSliderInputs[k] = document.createElement("input");
            this.#eSliders.appendChild(eSlider);
            eSlider.type = "range";
            eSlider.min = 0;
            eSlider.max = 10000;
            eSlider.addEventListener("input", e => {
                let v = eSlider.valueAsNumber;
                v /= 10000;
                if (k == "h") v *= 360;
                this.#ignore = true;
                this.color[k] = v;
                this.#ignore = false;
            });
        });
        this.#eSwatches = document.createElement("div");
        this.#eSwatches.classList.add("swatches");

        this.format();
    }
    disconnectedCallback() {
        clearInterval(this.#id);

        this.format();
    }
    attributeChangedCallback(name, prev, curr) { this[name] = curr; }
}
window.customElements.define("p-tooltip", PTooltip);


export class Hint extends util.Target {
    #elem;

    #entries;

    constructor() {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("hint");

        this.#entries = new Set();
    }

    get elem() { return this.#elem; }

    get entries() { return [...this.#entries]; }
    set entries(v) {
        v = util.ensure(v, "arr");
        this.clearEntries();
        this.addEntry(v);
    }
    clearEntries() {
        let entries = this.entries;
        this.remEntry(entries);
        return entries;
    }
    hasEntry(entry) {
        if (!(entry instanceof Hint.Entry)) return false;
        return this.#entries.has(entry);
    }
    addEntry(...entries) {
        return util.Target.resultingForEach(entries, entry => {
            if (!(entry instanceof Hint.Entry)) return false;
            if (this.hasEntry(entry)) return false;
            this.#entries.add(entry);
            this.elem.appendChild(entry.elem);
            return entry;
        });
    }
    remEntry(...entries) {
        return util.Target.resultingForEach(entries, entry => {
            if (!(entry instanceof Hint.Entry)) return false;
            if (!this.hasEntry(entry)) return false;
            this.#entries.delete(entry);
            this.elem.removeChild(entry.elem);
            return entry;
        });
    }

    place(...v) {
        v = new V(...v);
        this.elem.style.transform = "translate("+v.xy.map(v => v+"px").join(",")+")";
        return this;
    }
};
Hint.Entry = class HintEntry extends util.Target {
    #elem;

    constructor() {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("entry");
    }

    get elem() { return this.#elem; }
};
Hint.NameEntry = class HintNameEntry extends Hint.Entry {
    #eName;

    constructor(name) {
        super();

        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        
        this.name = name;
    }

    get eName() { return this.#eName; }
    
    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }
};
Hint.ValueEntry = class HintValueEntry extends Hint.Entry {
    #eValue;

    constructor(value) {
        super();

        const eIcon = document.createElement("ion-icon");
        this.elem.appendChild(eIcon);
        eIcon.name = "return-down-forward";

        this.#eValue = document.createElement("div");
        this.elem.appendChild(this.eValue);

        this.value = value;
    }

    get eValue() { return this.#eValue; }

    get value() { return this.eValue.textContent; }
    set value(v) { this.eValue.textContent = v; }
};
Hint.KeyValueEntry = class HintKeyValueEntry extends Hint.Entry {
    #eKey;
    #eValue;

    constructor(key, value) {
        super();

        this.#eKey = document.createElement("div");
        this.elem.appendChild(this.eKey);

        this.#eValue = document.createElement("div");
        this.elem.appendChild(this.eValue);

        this.key = key;
        this.value = value;
    }

    get eKey() { return this.#eKey; }
    get eValue() { return this.#eValue; }

    get key() { return this.eKey.textContent; }
    set key(v) { this.eKey.textContent = v; }
    get value() { return this.eValue.textContent; }
    set value(v) { this.eValue.textContent = v; }
};

export class Menu extends util.Target {
    #items;

    #elem;

    static #contextMenu;
    static get contextMenu() { return this.#contextMenu; }
    static set contextMenu(v) {
        v = (v instanceof Menu) ? v : null;
        if (this.contextMenu == v) return;
        if (this.hasContextMenu())
            document.body.removeChild(this.contextMenu.elem);
        this.#contextMenu = v;
        if (this.hasContextMenu())
            document.body.appendChild(this.contextMenu.elem);
    }
    static hasContextMenu() { return !!this.contextMenu; }
    static placeContextMenu(...v) {
        v = new V(...v);
        if (!this.hasContextMenu()) return false;
        this.contextMenu.elem.style.left = v.x+"px";
        this.contextMenu.elem.style.top = v.y+"px";
        setTimeout(() => this.contextMenu.fix(), 10);
        return this.contextMenu;
    }
    static {
        document.body.addEventListener("click", e => {
            if (!this.hasContextMenu()) return;
            if (this.contextMenu.elem.contains(e.target) && e.target.classList.contains("blocking")) return;
            e.stopPropagation();
            this.contextMenu = null;
        }, { capture: true });
    }

    constructor() {
        super();

        this.#items = [];

        this.#elem = document.createElement("div");
        this.elem.classList.add("contextmenu");
    }

    get items() { return [...this.#items]; }
    set items(v) {
        v = util.ensure(v, "arr");
        this.clearItems();
        this.addItem(v);
    }
    clearItems() {
        let itms = this.items;
        this.remItem(itms);
        return itms;
    }
    hasItem(itm) {
        if (!(itm instanceof Menu.Item)) return false;
        return this.#items.includes(itm);
    }
    insertItem(itm, at) {
        if (!(itm instanceof Menu.Item)) return false;
        if (this.hasItem(itm)) return false;
        at = Math.min(this.items.length, Math.max(0, util.ensure(at, "int")));
        this.#items.splice(at, 0, itm);
        itm.addLinkedHandler(this, "format", () => this.format());
        itm.addLinkedHandler(this, "change", (c, f, t) => this.change("items["+this.#items.indexOf(itm)+"."+c, f, t));
        this.change("insertItem", null, itm);
        this.format();
        itm.onAdd();
        return itm;
    }
    addItem(...itms) {
        let r = util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof Menu.Item)) return false;
            if (this.hasItem(itm)) return false;
            this.#items.push(itm);
            itm.addLinkedHandler(this, "format", () => this.format());
            itm.addLinkedHandler(this, "change", (c, f, t) => this.change("items["+this.#items.indexOf(itm)+"."+c, f, t));
            this.change("addItem", null, itm);
            itm.onAdd();
            return itm;
        });
        this.format();
        return r;
    }
    remItem(itm) {
        if (!(itm instanceof Menu.Item)) return false;
        if (!this.hasItem(itm)) return false;
        itm.onRem();
        this.#items.splice(this.#items.indexOf(itm), 1);
        itm.clearLinkedHandlers(this, "format");
        itm.clearLinkedHandlers(this, "change");
        this.change("remItem", itm, null);
        this.format();
        return itm;
    }
    getItemById(id) {
        for (let itm of this.items) {
            let foundItm = itm.getItemById(id);
            if (!foundItm) continue;
            return foundItm;
        }
        return null;
    }

    get elem() { return this.#elem; }

    fix() {
        this.elem.style.transform = "";
        this.elem.offsetWidth;
        let r = this.elem.getBoundingClientRect();
        let ox = 0, oy = 0;
        if (r.right > window.innerWidth) ox = window.innerWidth-r.right;
        if (r.left < 0) ox = 0-r.left;
        if (r.bottom > window.innerHeight) oy = window.innerHeight-r.bottom;
        if (r.top < 0) oy = 0-r.top;
        this.elem.style.transform = "translate("+ox+"px, "+oy+"px)";
    }
    format() {
        this.elem.innerHTML = "";
        let itms = this.items;
        let prevItm = null;
        for (let i = 0; i < itms.length; i++) {
            let itm = itms[i];
            if (itm.type == "separator") {
                if (prevItm != null)
                    if (prevItm.type == "separator")
                        continue;
            } else if (itm.hasRole()) continue;
            this.elem.appendChild(itm.elem);
            prevItm = itm;
        }
        if (prevItm != null)
            if (prevItm.type == "separator")
                this.elem.removeChild(prevItm.elem);
    }

    toObj() {
        return this.items.filter(itm => itm.exists && itm.type != "input").map(itm => itm.toObj());
    }
    static fromObj(data) {
        let menu = new Menu();
        menu.items = util.ensure(data, "arr").map(data => Menu.Item.fromObj(data));
        return menu;
    }

    static buildRoleItems(...roles) {
        return roles.map(role => {
            let itm = new Menu.Item(null);
            itm.role = role;
            if (itm.hasRole()) itm.id = itm.role;
            return itm;
        });
    }

    static buildAboutItems() {
        let itm = new Menu.Item("About Peninsula "+lib.getName(window.agent().name));
        itm.id = "about";
        return [itm];
    }
    static buildSettingsItems() {
        let itm = new Menu.Item("Settings", "settings-outline");
        itm.id = "settings";
        itm.accelerator = "CmdOrCtrl+,";
        return [itm];
    }
    static buildHideItems() { return this.buildRoleItems("hide", "hideOthers", "unhide"); }
    static buildQuitItems() { return this.buildRoleItems("quit"); }
    static buildCloseItems() { return this.buildRoleItems("close"); }
    static buildUndoRedoItems() { return this.buildRoleItems("undo", "redo"); }
    static buildCutCopyPasteItems() { return this.buildRoleItems("cut", "copy", "paste"); }
    static buildFullscreenItems() { return this.buildRoleItems("togglefullscreen"); }
    static buildWindowItems() { return this.buildRoleItems("minimize", "zoom"); }
    static buildFrontItems() { return this.buildRoleItems("front"); }
    static buildHelpItems() {
        let itms = [];
        let itm = new Menu.Item("Documentation...", "document-text-outline");
        itms.push(itm);
        itm.id = "documentation";
        itms.push(...["Github Repository", "Open Database", "Scout URL"].map((label, i) => {
            let itm = new Menu.Item(label);
            itm.id = ["repo", "db-host", "scout-url"][i];
            return itm;
        }));
        return itms;
    }
    static buildReloadItems() {
        let itm = new Menu.Item("Reload");
        itm.id = "reload";
        itm.accelerator = "CmdOrCtrl+R";
        return [itm];
    }
    static buildSpawnItems() {
        let itm = new Menu.Item("Features...");
        itm.id = "spawn";
        lib.APPFEATURES.forEach((name, i) => {
            let subitm = new Menu.Item(lib.getName(name));
            subitm.id = "spawn:"+name;
            subitm.accelerator = "CmdOrCtrl+"+(i+1);
            itm.menu.addItem(subitm);
        });
        return [itm];
    }
    static buildDevToolsItems() { return this.buildRoleItems("toggledevtools"); }
    static buildMainMenu() {
        let menu = new Menu();
        let itms = [
            ...this.buildAboutItems(),
            new Menu.Divider(),
            ...this.buildSettingsItems(),
            new Menu.Divider(),
            ...this.buildHideItems(),
            new Menu.Divider(),
            ...this.buildQuitItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildFileMenu() {
        let menu = new Menu();
        let itms = [
            ...this.buildReloadItems(),
            ...this.buildSpawnItems(),
            new Menu.Divider(),
            ...this.buildCloseItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildEditMenu() {
        let menu = new Menu();
        let itms = [
            ...this.buildUndoRedoItems(),
            new Menu.Divider(),
            ...this.buildCutCopyPasteItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildViewMenu() {
        let menu = new Menu();
        let itms = [
            ...this.buildFullscreenItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildWindowMenu() {
        let agent = window.agent();
        let menu = new Menu();
        let itms = [
            ...this.buildWindowItems(),
            ...this.buildDevToolsItems(),
        ];
        if (util.is(agent.os, "obj") && (agent.os.platform == "darwin"))
            itms.splice(2, 0, new Menu.Divider(), ...this.buildFrontItems(), new Menu.Divider());
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildHelpMenu() {
        let menu = new Menu();
        let itms = [
            ...this.buildHelpItems(),
        ];
        itms.forEach(itm => menu.addItem(itm));
        return menu;
    }
    static buildMenu() {
        let menu = new Menu();
        let menus = [
            this.buildFileMenu(),
            this.buildEditMenu(),
            this.buildViewMenu(),
            this.buildWindowMenu(),
            this.buildHelpMenu(),
        ];
        menus.forEach((submenu, i) => {
            let name = ["file", "edit", "view", "window", "help"][i];
            let itm = new Menu.Item(util.formatText(name));
            itm.id = "menu:"+name;
            if (name == "help") itm.role = "help";
            submenu.items.forEach(subitm => itm.menu.addItem(subitm));
            menu.addItem(itm);
        });
        return menu;
    }
    static buildWholeMenu(name) {
        name = String(name);
        let menu = new Menu();
        let itm = new Menu.Item((name.length > 0) ? name : "Peninsula", "navigate");
        itm.id = "menu:main";
        this.buildMainMenu().items.forEach(subitm => itm.menu.addItem(subitm));
        menu.addItem(itm);
        this.buildMenu().items.forEach(itm => menu.addItem(itm));
        return menu;
    }
};
Menu.Item = class MenuItem extends util.Target {
    #id;

    #role;
    #type;
    #label;
    #accelerator;
    #enabled;
    #visible;
    #checked;
    #exists;
    #menu;

    #elem;
    #eIcon;
    #eLabel;
    #eAccelerator;
    #eSubIcon;
    #eInput;

    constructor(label, icon="") {
        super();

        this.#id = util.jargonBase64(64);

        this.#role = null;
        this.#type = null;
        this.#label = null;
        this.#accelerator = null;
        this.#enabled = true;
        this.#visible = true;
        this.#checked = false;
        this.#exists = true;
        this.#menu = new Menu();
        this.menu.addHandler("change", (c, f, t) => this.change("menu."+c, f, t));

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.eIcon.classList.add("icon");
        this.#eLabel = document.createElement("div");
        this.elem.appendChild(this.eLabel);
        this.eLabel.classList.add("label");
        this.#eAccelerator = document.createElement("div");
        this.elem.appendChild(this.eAccelerator);
        this.eAccelerator.classList.add("accelerator");
        this.#eSubIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eSubIcon);
        this.eSubIcon.classList.add("sub");
        this.eSubIcon.name = "chevron-forward";
        this.#eInput = document.createElement("input");
        this.elem.appendChild(this.eInput);
        this.eInput.classList.add("blocking");

        this.elem.appendChild(this.menu.elem);

        this.elem.addEventListener("mouseenter", e => setTimeout(() => this.fix(), 10));
        this.elem.addEventListener("click", e => {
            if (this.type == "input") return;
            if (this.disabled) return;
            e.stopPropagation();
            this.post("trigger", e);
        });
        this.eInput.addEventListener("change", e => {
            if (this.type != "input") return;
            if (this.disabled) return;
            this.post("trigger", e, this.eInput.value);
        });

        this.icon = icon;
        this.label = label;

        this.addHandler("change", () => {
            this.eSubIcon.style.display = (this.menu.items.length > 0) ? "" : "none";
        });
        this.eSubIcon.style.display = (this.menu.items.length > 0) ? "" : "none";
    }

    get id() { return this.#id; }
    set id(v) {
        v = String(v);
        if (this.id == v) return;
        this.change("id", this.id, this.#id=v);
    }

    get role() { return this.#role; }
    set role(v) {
        v = (v == null) ? null : String(v);
        if (this.role == v) return;
        this.change("role", this.role, this.#role=v);
        if (!this.hasRole()) return;
        (async () => {
            let v = this.role;
            let label = await window.api.send("menu-role-label", v);
            if (this.role != v) return;
            this.eLabel.textContent = label;
        })();
        this.#check();
    }
    hasRole() { return this.role != null; }
    get type() { return this.#type; }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
        if (this.type == "separator") this.elem.classList.add("divider");
        else this.elem.classList.remove("divider");
        if (this.type == "input") this.elem.classList.add("input");
        else this.elem.classList.remove("input");
        this.#check();
    }
    hasType() { return this.type != null; }
    get label() { return this.#label; }
    set label(v) {
        v = (v == null) ? null : String(v);
        if (this.label == v) return;
        this.change("label", this.label, this.#label=v);
        if (!this.hasRole())
            return this.eLabel.textContent = this.eInput.placeholder = this.hasLabel() ? this.label : "";
        (async () => {
            let v = this.role;
            let label = await window.api.send("menu-role-label", v);
            if (this.role != v) return;
            this.eLabel.textContent = this.eInput.placeholder = label;
        })();
        this.#check();
    }
    hasLabel() { return this.label != null; }
    get accelerator() { return this.#accelerator; }
    set accelerator(v) {
        v = (v == null) ? null : String(v);
        if (this.accelerator == v) return;
        this.change("accelerator", this.accelerator, this.#accelerator=v);
        let parts = this.hasAccelerator() ? this.accelerator.split("+") : [];
        parts = parts.map(part => {
            if (["CommandOrControl", "CmdOrCtrl", "Command", "Cmd"].includes(part)) return "⌘";
            if (["Control", "Ctrl"].includes(part)) return "⌃";
            if (part == "Alt") return "⎇";
            if (part == "Option") return "⌥";
            if (part == "Shift") return "⇧";
            if (part == "Super") return "❖";
            if (part == "Meta") return "⌘";
            if (part == "Plus") return "+";
            if (part == "Tab") return "⇥";
            if (part == "Backspace") return "⌫";
            if (part == "Delete") return "⌦";
            if (["Return", "Enter"].includes(part)) return "↩︎";
            if (part == "Up") return "▲";
            if (part == "Down") return "▼";
            if (part == "Left") return "◀︎";
            if (part == "Right") return "▶︎";
            if (part == "Home") return "↑";
            if (part == "End") return "↓";
            if (part == "PageUp") return "↑";
            if (part == "PageDown") return "↓";
            if (["Escape", "Esc"].includes(part)) return "⎋";
            if (part == "numdec") return ".";
            if (part == "numadd") return "+";
            if (part == "numsub") return "-";
            if (part == "nummult") return "*";
            if (part == "numdiv") return "/";
            for (let i = 0; i < 10; i++)
                if (part == "num"+i)
                    return String(i);
            return part;
        });
        this.eAccelerator.textContent = parts.join("");
        this.eAccelerator.style.display = (this.eAccelerator.textContent.length > 0) ? "" : "none";
        this.#check();
    }
    hasAccelerator() { return this.accelerator != null; }
    get enabled() { return this.#enabled; }
    set enabled(v) {
        v = !!v;
        if (this.enabled == v) return;
        this.change("enabled", this.enabled, this.#enabled=v);
        if (this.disabled) this.elem.classList.add("disabled");
        else this.elem.classList.remove("disabled");
        this.eInput.disabled = this.disabled;
        this.#check();
    }
    get disabled() { return !this.enabled; }
    set disabled(v) { this.enabled = !v; }
    get visible() { return this.#visible; }
    set visible(v) {
        v = !!v;
        if (this.visible == v) return;
        this.change("visible", this.visible, this.#visible=v);
        this.#check();
    }
    get hidden() { return !this.visible; }
    set hidden(v) { this.visible = !v; }
    get checked() { return this.#checked; }
    set checked(v) {
        v = !!v;
        if (this.checked == v) return;
        this.change("checked", this.checked, this.#checked=v);
        this.#check();
    }
    get unchecked() { return !this.unchecked; }
    set unchecked(v) { this.unchecked = !v; }
    get exists() { return this.#exists; }
    set exists(v) {
        v = !!v;
        if (this.exists == v) return;
        this.change("exists", this.exists, this.#exists=v);
        this.#check();
    }

    #check() {
        if (this.visible && !this.hasRole()) this.elem.style.display = "";
        else this.elem.style.display = "none";
        if (this.type == "checkbox") this.icon = this.checked ? "checkmark" : "";
        else if (this.type == "radio") this.icon = this.checked ? "ellipse" : "ellipse-outline";
        this.post("format");
    }
    
    get menu() { return this.#menu; }
    set menu(v) {
        if (v instanceof Menu) this.menu.items = v.items;
        else if (util.is(v, "arr")) this.menu.items = v;
        else this.menu.items = [];
    }

    getItemById(id) {
        if (this.id == id) return this;
        return this.menu.getItemById(id);
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eLabel() { return this.#eLabel; }
    get eAccelerator() { return this.#eAccelerator; }
    get eSubIcon() { return this.#eSubIcon; }
    get eInput() { return this.#eInput; }

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
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }

    fix() { return this.menu.fix(); }
    format() { return this.menu.format(); }

    toObj() {
        let data = { id: this.id };
        if (this.hasRole()) data.role = this.role;
        if (this.hasType()) data.type = this.type;
        if (this.hasLabel()) data.label = this.label;
        if (this.hasAccelerator()) data.accelerator = this.accelerator;
        data.enabled = this.enabled;
        data.visible = this.visible;
        data.checked = this.checked;
        let submenu = this.menu.toObj();
        if (submenu.length > 0) data.submenu = submenu;
        return data;
    }
    static fromObj(data) {
        if (data == "separator") return this.fromObj({ type: "separator" });
        data = util.ensure(data, "obj");
        let itm = new Menu.Item();
        if ("id" in data) itm.id = data.id;
        itm.role = ("role" in data) ? data.role : null;
        itm.type = ("type" in data) ? data.type : null;
        itm.label = ("label" in data) ? data.label : null;
        itm.accelerator = ("accelerator" in data) ? data.accelerator : null;
        itm.enabled = ("enabled" in data) ? data.enabled : true;
        itm.visible = ("visible" in data) ? data.visible : true;
        itm.checked = ("checked" in data) ? data.checked : false;
        if (util.is(data.click, "func"))
            itm.addHandler("trigger", e => data.click(e));
        itm.menu = Menu.fromObj(data.submenu);
        return itm;
    }
};
Menu.Divider = class MenuDivider extends Menu.Item {
    constructor() {
        super();

        this.type = "separator";
    }
};

export class Parallax extends util.Target {
    #canvas;
    #quality;
    #size;
    #run;
    #type;

    #scene;
    #camera;

    #renderer;

    #speed;

    constructor(canvas) {
        super();

        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Canvas is not of class HTMLCanvasElement");
        this.#canvas = canvas;
        this.#quality = 2;
        this.#size = new V(300, 150);
        this.size.addHandler("change", (c, f, t) => this.change("size."+c, f, t));
        this.#run = 1;
        this.#type = null;

        this.#scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 7.5, 10);
        this.#camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

        this.#renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, powerPreference: "default" });

        const hemLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
        this.scene.add(hemLight);

        const specks = [];

        let spawn = 0;

        const update = () => {
            const w = Math.max(0, Math.ceil(this.w));
            const h = Math.max(0, Math.ceil(this.h));
            this.renderer.setSize(w, h);
            this.renderer.setPixelRatio(this.quality);
            if (this.camera.aspect != w/h) {
                this.camera.aspect = w/h;
                this.camera.updateProjectionMatrix();
            }
        };
        new ResizeObserver(update).observe(this.canvas.parentElement);
        this.addHandler("change-quality", update);
        this.addHandler("change-size.x", update);
        this.addHandler("change-size.y", update);
        update();

        this.#speed = 0;

        this.addHandler("update", delta => {
            const height = 2 * Math.tan((this.camera.fov*(Math.PI/180))/2) * this.camera.near;
            const width = height * this.camera.aspect;

            for (let i = 0; i < this.run; i++) {
                if (specks.length < 1000) {
                    while (spawn < 0) {
                        if (this.type == "july4") {
                            spawn += util.lerp(1, 10, Math.random());
                            let radii = [0.02, 0.015, 0.01];
                            let pos = new util.V3(util.lerp(-5, +5, Math.random()), util.lerp(-5, +5, Math.random()), -5);
                            for (let i = 0; i < 20; i++) {
                                let azimuth = util.lerp(0, 360, Math.random());
                                let elevation = util.lerp(0, 360, Math.random());
                                let xz = V.dir(azimuth);
                                let y = V.dir(elevation);
                                xz.imul(y.x);
                                let mag = new util.V3(xz.x, y.y, xz.y);
                                const speck = new Parallax.Speck(
                                    Math.floor(Parallax.Speck.materials.length*Math.random()),
                                    util.choose(radii), 0,
                                );
                                speck.object.position.set(...pos.xyz);
                                [speck.velX, speck.velY, speck.velZ] = mag.imul(util.lerp(0.05, 0.15, Math.random())).xyz;
                                this.scene.add(speck.object);
                                specks.push(speck);
                                speck.addHandler("update", delta => {
                                    speck.velY -= 0.001 * (delta/5);
                                    if (
                                        Math.abs(speck.object.position.x) <= +15 &&
                                        Math.abs(speck.object.position.y) <= +15 &&
                                        Math.abs(speck.object.position.z) <= +15
                                    ) return;
                                    specks.splice(specks.indexOf(speck), 1);
                                    this.scene.remove(speck.object);
                                });
                            }
                        } else {
                            spawn += util.lerp(0.01, 0.1, Math.random());
                            let radii = [0.02, 0.015, 0.01];
                            const speck = new Parallax.Speck(
                                Math.floor(Parallax.Speck.materials.length*Math.random()),
                                util.choose(radii), 0,
                            );
                            let pos;
                            do {
                                pos = new V(Math.random(), Math.random()).map(v => util.lerp(-15, +15, v));
                            } while (Math.abs(pos.x) < width && Math.abs(pos.y) < height);
                            speck.object.position.set(pos.x, pos.y, -15);
                            this.scene.add(speck.object);
                            specks.push(speck);
                            speck.addHandler("update", delta => {
                                speck.velX = speck.velY = speck.velZ = 0;
                                speck.cvelX = speck.cvelY = 0;
                                speck.cvelZ = this.speed;
                                if (
                                    Math.abs(speck.object.position.x) <= +15 &&
                                    Math.abs(speck.object.position.y) <= +15 &&
                                    Math.abs(speck.object.position.z) <= +15
                                ) return;
                                specks.splice(specks.indexOf(speck), 1);
                                this.scene.remove(speck.object);
                            });
                        }
                    }
                    if (this.type == "july4") spawn -= 0.1;
                    else spawn -= 2*this.speed;
                }
                [...specks].forEach(speck => speck.update(delta));
            }

            let colorW = PROPERTYCACHE.getColor("--v8");
            let colorA = PROPERTYCACHE.getColor("--a");
            let colorV = PROPERTYCACHE.getColor("--v2");
            Parallax.Speck.materials[0].color.set(colorW.toHex(false));
            Parallax.Speck.materials[1].color.set(colorA.toHex(false));
            this.scene.fog.color.set(colorV.toHex(false));
            
            this.renderer.render(this.scene, this.camera);
        });
    }

    get canvas() { return this.#canvas; }
    get quality() { return this.#quality; }
    set quality(v) {
        v = Math.max(1, util.ensure(v, "int"));
        if (this.quality == v) return;
        this.change("quality", this.quality, this.#quality=v);
    }
    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }
    get run() { return this.#run; }
    set run(v) {
        v = Math.max(0, util.ensure(v, "int"));
        if (this.run == v) return;
        this.change("run", this.run, this.#run=v);
    }
    get type() { return this.#type; }
    set type(v) {
        v = (v == null) ? null : String(v);
        if (this.type == v) return;
        this.change("type", this.type, this.#type=v);
    }
    hasType() { return this.type != null; }

    get scene() { return this.#scene; }
    get camera() { return this.#camera; }

    get renderer() { return this.#renderer; }

    get speed() { return this.#speed; }
    set speed(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.speed == v) return;
        this.change("speed", this.speed, this.#speed=v);
    }

    update(delta) { this.post("update", delta); }
}
Parallax.Speck = class ParallaxSpeck extends util.Target {
    #type;
    #r; #l;

    #vel;
    #cvel;

    #sphereGeometry;
    #cylinderGeometry;
    #material;
    #headMesh; #tailMesh; #midMesh;
    #object;

    static sphereGeometryCache = {};
    static cylinderGeometryCache = {};
    static materials = [
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
    ];

    constructor(type, r, l) {
        super();

        this.#type = 0;
        this.#r = 0;
        this.#l = 0;

        this.#vel = [0, 0, 0];
        this.#cvel = [0, 0, 0];

        this.type = type;
        this.r = r;
        this.l = l;

        let vel = [null, null, null];

        this.addHandler("update", delta => {
            let newVel = [
                this.velX+this.cvelX,
                this.velY+this.cvelY,
                this.velZ+this.cvelZ,
            ];
            let changed = false;
            for (let i = 0; i < 3; i++) {
                if (vel[i] == newVel[i]) continue;
                vel[i] = newVel[i];
                changed = true;
            }
            let d = Math.sqrt(vel[0]**2 + vel[1]**2 + vel[2]**2);
            this.l = Math.min(2.5, d * 2.5);
            this.object.position.set(
                this.object.position.x+vel[0]*(delta/5),
                this.object.position.y+vel[1]*(delta/5),
                this.object.position.z+vel[2]*(delta/5),
            );
            this.#headMesh.position.setZ(+this.l/2);
            this.#tailMesh.position.setZ(-this.l/2);
            if (changed) {
                this.object.lookAt(
                    this.object.position.x+vel[0],
                    this.object.position.y+vel[1],
                    this.object.position.z+vel[2],
                );
            }
            let p = 0.99 ** (5/delta);
            this.velX *= p;
            this.velY *= p;
            this.velZ *= p;
        });
    }

    #check() {
        if (!(this.r in Parallax.Speck.sphereGeometryCache))
            Parallax.Speck.sphereGeometryCache[this.r] = new THREE.SphereGeometry(this.r, 8, 8);
        if (!(this.r in Parallax.Speck.cylinderGeometryCache))
            Parallax.Speck.cylinderGeometryCache[this.r] = {};
        if (!(this.l in Parallax.Speck.cylinderGeometryCache[this.r]))
            Parallax.Speck.cylinderGeometryCache[this.r][this.l] = new THREE.CylinderGeometry(this.r, this.r, this.l, 8, 1, true);
        this.#sphereGeometry = Parallax.Speck.sphereGeometryCache[this.r];
        this.#cylinderGeometry = Parallax.Speck.cylinderGeometryCache[this.r][this.l];
        this.#material = Parallax.Speck.materials[this.type];
        if (!this.#headMesh) this.#headMesh = new THREE.Mesh(this.#sphereGeometry, this.#material);
        if (!this.#tailMesh) this.#tailMesh = new THREE.Mesh(this.#sphereGeometry, this.#material);
        if (!this.#midMesh) {
            this.#midMesh = new THREE.Mesh(this.#cylinderGeometry, this.#material);
            this.#midMesh.rotateX(Math.PI/2);
        }
        this.#headMesh.geometry = this.#tailMesh.geometry = this.#sphereGeometry;
        this.#midMesh.geometry = this.#cylinderGeometry;
        this.#headMesh.material = this.#tailMesh.material = this.#midMesh.material = this.#material;
        if (!this.#object) {
            this.#object = new THREE.Object3D();
            this.#object.add(this.#headMesh);
            this.#object.add(this.#tailMesh);
            this.#object.add(this.#midMesh);
        }
    }

    get type() { return this.#type; }
    set type(v) {
        v = Math.min(Parallax.Speck.materials.length-1, Math.max(0, util.ensure(v, "int")));
        if (this.type == v) return;
        this.#type = v;
        this.#check();
    }

    get r() { return this.#r; }
    set r(v) {
        v = Math.max(0, Math.floor(util.ensure(v, "num")*100)/100);
        if (this.r == v) return;
        this.#r = v;
        this.#check();
    }
    get l() { return this.#l; }
    set l(v) {
        v = Math.max(0, Math.floor(util.ensure(v, "num")*100)/100);
        if (this.l == v) return;
        this.#l = v;
        this.#check();
    }

    get velX() { return this.#vel[0]; }
    set velX(v) { this.#vel[0] = util.ensure(v, "num"); }
    get velY() { return this.#vel[1]; }
    set velY(v) { this.#vel[1] = util.ensure(v, "num"); }
    get velZ() { return this.#vel[2]; }
    set velZ(v) { this.#vel[2] = util.ensure(v, "num"); }
    get cvelX() { return this.#cvel[0]; }
    set cvelX(v) { this.#cvel[0] = util.ensure(v, "num"); }
    get cvelY() { return this.#cvel[1]; }
    set cvelY(v) { this.#cvel[1] = util.ensure(v, "num"); }
    get cvelZ() { return this.#cvel[2]; }
    set cvelZ(v) { this.#cvel[2] = util.ensure(v, "num"); }

    get object() { return this.#object; }

    update(delta) { this.post("update", delta); }
}

export class Explorer extends util.Target {
    #nodes;
    #nodeKeys;
    #nodeObjects;

    #elem;

    static SORT = false;

    constructor() {
        super();

        this.#nodes = {};
        this.#nodeKeys = [];
        this.#nodeObjects = [];

        this.#elem = document.createElement("div");
        this.elem.classList.add("explorer");
    }

    get nodes() { return [...this.#nodeKeys]; }
    get nodeObjects() { return [...this.#nodeObjects]; }
    get nNodes() {
        let n = 1;
        this.nodeObjects.forEach(node => (n += node.explorer.nNodes));
        return n;
    }
    clear() {
        let nodes = this.nodeObjects;
        this.rem(nodes);
        return nodes;
    }
    has(v) {
        if (v instanceof Explorer.Node) return this.has(v.name) && this.nodeObjects.includes(v);
        return v in this.#nodes;
    }
    get(name) {
        if (!this.has(name)) return null;
        return this.#nodes[name];
    }
    add(...nodes) {
        let rr = false;
        let r = util.Target.resultingForEach(nodes, node => {
            if (!(node instanceof Explorer.Node)) return false;
            if (this.has(node)) return false;
            this.#nodes[node.name] = node;
            this.#nodeKeys.push(node.name);
            this.#nodeObjects.push(node);
            node.addLinkedHandler(this, "trigger", (e, pth) => this.post("trigger", e, pth));
            node.addLinkedHandler(this, "trigger2", (e, pth) => this.post("trigger2", e, pth));
            node.addLinkedHandler(this, "contextmenu", (e, pth) => this.post("contextmenu", e, pth));
            node.addLinkedHandler(this, "drag", (e, pth) => this.post("drag", e, pth));
            this.elem.appendChild(node.elem);
            node.onAdd();
            rr = true;
            return node;
        });
        if (rr) this.format();
        return r;
    }
    rem(...nodes) {
        let rr = false;
        let r = util.Target.resultingForEach(nodes, node => {
            if (!(node instanceof Explorer.Node)) return false;
            if (!this.has(node)) return false;
            node.onRem();
            delete this.#nodes[node.name];
            this.#nodeKeys.splice(this.#nodeKeys.indexOf(node.name), 1);
            this.#nodeObjects.splice(this.#nodeObjects.indexOf(node), 1);
            node.clearLinkedHandlers(this, "trigger");
            node.clearLinkedHandlers(this, "drag");
            this.elem.removeChild(node.elem);
            rr = true;
            return node;
        });
        if (rr) this.format();
        return r;
    }
    lookup(pth) {
        pth = util.generateArrayPath(pth);
        let explorer = this;
        while (pth.length > 0) {
            let name = pth.shift();
            if (!explorer.has(name)) return null;
            let node = explorer.get(name);
            if (pth.length <= 0) return node;
            explorer = node.explorer;
        }
        return null;
    }

    get elem() { return this.#elem; }

    get showHidden() { return this.elem.classList.contains("hidden"); }
    set showHidden(v) {
        v = !!v;
        if (this.showHidden == v) return;
        if (v) this.elem.classList.add("hidden");
        else this.elem.classList.remove("hidden");
        this.change("showHidden", !v, v);
    }

    format() {
        if (this.constructor.SORT) this.#nodeObjects.sort((a, b) => util.compareStr(a.name, b.name));
        this.#nodeObjects.forEach((node, i) => {
            node.elem.style.order = i;
            node.format();
        });
        this.#nodeKeys = this.#nodeObjects.map(node => node.name);
    }
}
Explorer.Node = class ExplorerNode extends util.Target {
    #explorer;

    #name;
    #isHidden;
    #info;
    #value;
    #showValue;

    #elem;
    #eDisplay;
    #eMain;
    #eIcon;
    #eName;
    #eTag;
    #eValueBox;
    #eValue;
    #eSide;

    static EXPLORER = Explorer;

    static doubleTraverse(nodeArr, enodeArr, addFunc, remFunc, dumpFunc=null) {
        let nodeMap = {}, enodeMap = {};
        util.ensure(nodeArr, "arr").forEach(node => {
            if (!node) return;
            nodeMap[node.name] = node;
        });
        util.ensure(enodeArr, "arr").forEach(enode => {
            if (!(enode instanceof this)) return;
            enodeMap[enode.name] = enode;
        });
        let add = [];
        for (let name in nodeMap) {
            let node = nodeMap[name];
            if (name in enodeMap) continue;
            let enode = enodeMap[node.name] = new this(node.name);
            add.push(enode);
        }
        if (util.is(addFunc, "func")) addFunc(...add);
        let rem = [];
        for (let name in enodeMap) {
            let enode = enodeMap[name];
            if (name in nodeMap) continue;
            rem.push(enode);
        }
        if (util.is(remFunc, "func")) remFunc(...rem);
        for (let name in nodeMap) {
            let node = nodeMap[name];
            let enode = enodeMap[name];
            if (enode.isOpen)
                this.doubleTraverse(
                    node.nodeObjects,
                    enode.explorer.nodeObjects,
                    (...en) => enode.explorer.add(...en),
                    (...en) => enode.explorer.rem(...en),
                    dumpFunc,
                );
            else enode.explorer.clear();
            enode.info = node.info;
            enode.value = node.value;
            if (util.is(node.dump, "func")) node.dump(enode);
            if (util.is(dumpFunc, "func")) dumpFunc(node, enode);
        }
    }

    constructor(name) {
        super();

        this.#explorer = new this.constructor.EXPLORER();
        this.explorer.addHandler("trigger", (e, pth) => {
            pth = util.generatePath(pth);
            if (this.name.length > 0) pth = this.name+"/"+pth;
            this.post("trigger", e, pth);
        });
        this.explorer.addHandler("trigger2", (e, pth) => {
            pth = util.generatePath(pth);
            if (this.name.length > 0) pth = this.name+"/"+pth;
            this.post("trigger2", e, pth);
        });
        this.explorer.addHandler("contextmenu", (e, pth) => {
            pth = util.generatePath(pth);
            if (this.name.length > 0) pth = this.name+"/"+pth;
            this.post("contextmenu", e, pth);
        });
        this.explorer.addHandler("drag", (e, pth) => {
            pth = util.generatePath(pth);
            if (this.name.length > 0) pth = this.name+"/"+pth;
            this.post("drag", e, pth);
        });

        this.#name = String(name);
        this.#isHidden = this.name.startsWith(".");
        this.#info = "";
        this.#value = null;

        this.#showValue = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("node");
        if (this.isHidden) this.elem.classList.add("hidden");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eMain = document.createElement("div");
        this.eDisplay.appendChild(this.eMain);
        this.eMain.classList.add("main");
        this.#eIcon = document.createElement("ion-icon");
        this.eMain.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.eMain.appendChild(this.eName);
        this.eName.classList.add("name");
        this.eName.textContent = this.name;
        this.#eTag = document.createElement("div");
        this.eMain.appendChild(this.eTag);
        this.eTag.classList.add("tag");
        this.#eValueBox = document.createElement("div");
        this.eDisplay.appendChild(this.eValueBox);
        this.eValueBox.classList.add("value");
        this.eValueBox.innerHTML = "<ion-icon name='return-down-forward'></ion-icon>";
        this.#eValue = document.createElement("div");
        this.eValueBox.appendChild(this.eValue);
        this.elem.appendChild(this.explorer.elem);
        this.#eSide = document.createElement("button");
        this.explorer.elem.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.eSide.classList.add("override");

        let cancel = 10;
        this.eDisplay.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            this.post("trigger", e, [this.name]);
        });
        this.eDisplay.addEventListener("dblclick", e => {
            this.post("trigger2", e, this.name);
        });
        this.eDisplay.addEventListener("contextmenu", e => {
            this.post("contextmenu", e, this.name);
        });
        this.eDisplay.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                if (cancel > 0) return cancel--;
                mouseup();
                this.post("drag", e, [this.name]);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.eSide.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        this.showValue = false;

        this.info = null;
    }

    get explorer() { return this.#explorer; }

    get name() { return this.#name; }
    get isHidden() { return this.#isHidden; }

    get info() { return this.#info; }
    set info(v) {
        v = (v == null) ? null : String(v);
        if (this.info == v) return;
        this.#info = v;
        this.eTag.textContent = util.ensure(this.info, "str");
    }

    get value() { return this.#value; }
    set value(v) {
        this.#value = v;
        this.updateDisplay();
    }

    lookup(pth) {
        pth = util.generateArrayPath(pth);
        if (pth.length <= 0) return this;
        return this.explorer.lookup(pth);
    }

    get showValue() { return this.#showValue; }
    set showValue(v) {
        v = !!v;
        if (this.showValue == v) return;
        this.#showValue = v;
        if (this.showValue) this.eValueBox.classList.add("this");
        else this.eValueBox.classList.remove("this");
        this.updateDisplay();
    }
    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eMain() { return this.#eMain; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get eTag() { return this.#eTag; }
    get eValueBox() { return this.#eValueBox; }
    get eValue() { return this.#eValue; }
    get eSide() { return this.#eSide; }

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
    updateDisplay() {
        if (this.showValue) this.eValue.textContent = this.value;
    }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
        this.updateDisplay();
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    format() {
        this.updateDisplay();
        this.explorer.format();
    }
};
export class FieldExplorer extends Explorer {
    static SORT = true;
}
FieldExplorer.Node = class FieldExplorerNode extends FieldExplorer.Node {
    #canShowValue;

    static EXPLORER = FieldExplorer;

    static doubleTraverse(nodeArr, enodeArr, addFunc, remFunc, dumpFunc=null) {
        return super.doubleTraverse(
            util.ensure(nodeArr, "arr").filter(node => (node instanceof Source.Node)).map(node => {
                node.info = node.hasField() ? node.field.type : null;
                node.value = node.hasField() ? node.field.get() : null;
                return node;
            }),
            enodeArr,
            addFunc,
            remFunc,
            dumpFunc,
        );
    }

    constructor(name, type) {
        super(name, type);

        this.addHandler("trigger", e => {
            if (!this.eDisplay.contains(e.target)) return;
            if (this.isJustPrimitive || e.shiftKey) this.showValue = this.canShowValue && !this.showValue;
            else this.isOpen = !this.isOpen;
        });

        this.canShowValue = true;
    }

    get canShowValue() { return this.#canShowValue; }
    set canShowValue(v) {
        v = !!v;
        if (this.canShowValue == v) return;
        this.#canShowValue = v;
        this.showValue &&= this.canShowValue;
    }

    get type() { return this.info; }
    hasType() { return this.info != null; }
    get isStruct() { return this.hasType() && this.type.startsWith("struct:"); }
    get isArray() { return this.hasType() && this.type.endsWith("[]"); }
    get baseType() {
        return this.type.slice(this.isStruct ? 7 : 0, this.type.length - (this.isArray ? 2 : 0));
    }
    get isPrimitive() { return this.hasType() && Source.Field.TYPES.includes(this.baseType) && (this.type != "json"); }
    get isJustPrimitive() { return this.isPrimitive && !this.isArray; }

    get value() {
        if (!this.hasType()) return this.isOpen;
        return this.isArray ? [...util.ensure(super.value, "arr")] : super.value;
    }
    set value(v) {
        v = Source.Field.ensureType(this.type, v);
        super.value = v;
    }

    updateDisplay() {
        this.icon = null;
        this.iconSrc = null;
        let display = Source.Field.getDisplay(this.type, this.value);
        if (display != null) {
            if ("src" in display) this.iconSrc = display.src;
            else this.icon = display.name;
            let color = util.ensure(display.color, "str");
            if (this.eIcon.style.color != color) this.eIcon.style.color = this.eValue.style.color = display.color;
        } else {
            this.icon = "";
            this.eIcon.style.color = this.eValue.style.color = "";
        }
        if (this.showValue) this.eValue.textContent = Source.Field.getRepresentation(this.value, this.type == "structschema");
    }
};

export class Form extends util.Target {
    #fields;

    #elem;
    
    constructor() {
        super();

        this.#fields = [];

        this.#elem = document.createElement("div");
        this.elem.classList.add("form");

        this.isHorizontal = null;

        this.isShown = true;
    }

    get fields() { return [...this.#fields]; }
    set fields(v) {
        v = util.ensure(v, "arr");
        this.clearFields();
        this.addField(v);
    }
    clearFields() {
        let fields = this.fields;
        this.remField(fields);
        return fields;
    }
    hasField(field) {
        if (util.is(field, "str")) return !!this.getField(field);
        if (!(field instanceof Form.Field)) return false;
        return this.#fields.includes(field);
    }
    getField(name) {
        for (let field of this.#fields)
            if (field.name == name)
                return field;
        return null;
    }
    addField(...fields) {
        return util.Target.resultingForEach(fields, field => {
            if (!(field instanceof Form.Field)) return false;
            if (this.hasField(field)) return false;
            this.#fields.push(field);
            this.elem.appendChild(field.elem);
            return field;
        });
    }
    remField(...fields) {
        return util.Target.resultingForEach(fields, field => {
            if (!(field instanceof Form.Field)) field = this.getField(field);
            if (!this.hasField(field)) return false;
            this.#fields.splice(this.#fields.indexOf(field), 1);
            this.elem.removeChild(field.elem);
            return field;
        });
    }

    get elem() { return this.#elem; }

    get side() {
        if (this.elem.classList.contains("right")) return "right";
        if (this.elem.classList.contains("center")) return "center";
        return "left";
    }
    set side(v) {
        v = String(v);
        this.elem.classList.remove("right");
        this.elem.classList.remove("center");
        if (v == "left") return;
        if (!["right", "center"].includes(v)) return;
        this.elem.classList.add(v);
    }

    get isHorizontal() { return this.elem.classList.contains("horizontal"); }
    set isHorizontal(v) {
        if (v) this.elem.classList.add("horizontal");
        else this.elem.classList.remove("horizontal");
    }
    get isVertical() { return !this.isHorizontal; }
    set isVertical(v) { this.isHorizontal = !v; }

    get isShown() { return this.elem.classList.contains("show"); }
    set isShown(v) {
        if (v) this.elem.classList.add("show");
        else this.elem.classList.remove("show");
    }
}
Form.Field = class FormField extends util.Target {
    #name;

    #value;
    #toggleOn;

    #disabled;
    #toggleDisabled;

    #elem;
    #eHeader;
    #eName;
    #eType;
    #eToggle;
    #eToggleInput;
    #eContent;

    constructor(name) {
        super();

        this.#name = String(name);

        this.#value = null;
        this.#toggleOn = null;

        this.#disabled = null;
        this.#toggleDisabled = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eHeader = document.createElement("div");
        this.elem.appendChild(this.eHeader);
        this.eHeader.classList.add("header");
        this.#eName = document.createElement("div");
        this.eHeader.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eType = document.createElement("div");
        this.eHeader.appendChild(this.eType);
        this.eType.classList.add("type");
        this.#eToggle = document.createElement("label");
        this.eHeader.appendChild(this.eToggle);
        this.eToggle.classList.add("switch");
        this.eToggle.innerHTML = "<input type='checkbox'><span><ion-icon name='checkmark'></ion-icon></span>";
        this.#eToggleInput = this.eToggle.children[0];
        this.eToggleInput.addEventListener("change", e => {
            if (this.toggleDisabled) return;
            this.toggleOn = this.eToggleInput.checked;
        });
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.addHandler("change-toggleOn", () => (this.eToggleInput.checked = this.toggleOn));
        this.addHandler("change-toggleDisabled", () => (this.eToggleInput.disabled = this.toggleDisabled));

        this.isHorizontal = null;

        this.isShown = this.showHeader = this.showContent = true;
        this.showToggle = false;

        this.isSwitch = true;

        this.toggleOn = false;
        this.disabled = false;
        this.toggleDisabled = false;

        this.isSubHeader = true;

        this.header = util.formatText(this.name);

        this.type = "";
    }

    get name() { return this.#name; }

    get value() { return this.#value; }
    set value(v) { this.change("value", this.#value, this.#value=v); }
    get toggleOn() { return this.#toggleOn; }
    set toggleOn(v) {
        v = !!v;
        if (this.toggleOn == v) return;
        this.change("toggleOn", this.toggleOn, this.#toggleOn=v);
    }
    get toggleOff() { return !this.toggleOn; }
    set toggleOff(v) { this.toggleOn = !v; }

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
    get toggleDisabled() { return this.#toggleDisabled; }
    set toggleDisabled(v) {
        v = !!v;
        if (this.toggleDisabled == v) return;
        this.change("toggleDisabled", this.toggleDisabled, this.#toggleDisabled=v);
    }
    get toggleEnabled() { return !this.toggleDisabled; }
    set toggleEnabled(v) { this.toggleDisabled = !v; }
    disableToggle() { return this.toggleDisabled = true; }
    enableToggle() { return this.toggleEnabled = true; }

    get elem() { return this.#elem; }
    get eHeader() { return this.#eHeader; }
    get eName() { return this.#eName; }
    get eType() { return this.#eType; }
    get eToggle() { return this.#eToggle; }
    get eToggleInput() { return this.#eToggleInput; }
    get eContent() { return this.#eContent; }

    get isHorizontal() {
        if (this.elem.classList.contains("horizontal")) return true;
        if (this.elem.classList.contains("not-horizontal")) return false;
        return null;
    }
    set isHorizontal(v) {
        if (v == true) this.elem.classList.add("horizontal");
        else this.elem.classList.remove("horizontal");
        if (v == false) this.elem.classList.add("not-horizontal");
        else this.elem.classList.remove("not-horizontal");
    }
    get isVertical() {
        let v = this.isHorizontal;
        if (v == null) return null;
        return !v;
    }
    set isVertical(v) {
        if (v == null) return this.isHorizontal = null;
        this.isHorizontal = !v;
    }

    get isShown() { return this.elem.classList.contains("show"); }
    set isShown(v) {
        if (v) this.elem.classList.add("show");
        else this.elem.classList.remove("show");
    }
    get isHidden() { return !this.isShown; }
    set isHidden(v) { this.isShown = !v; }
    get showHeader() { return this.eHeader.classList.contains("show"); }
    set showHeader(v) {
        if (v) this.eHeader.classList.add("show");
        else this.eHeader.classList.remove("show");
    }
    get showToggle() { return this.eToggle.classList.contains("show"); }
    set showToggle(v) {
        if (v) this.eToggle.classList.add("show");
        else this.eToggle.classList.remove("show");
    }
    get showContent() { return this.eContent.classList.contains("show"); }
    set showContent(v) {
        if (v) this.eContent.classList.add("show");
        else this.eContent.classList.remove("show");
    }

    get header() { return this.eName.textContent; }
    set header(v) { this.eName.textContent = v; }
    get isSubHeader() { return this.eHeader.classList.contains("sub"); }
    set isSubHeader(v) {
        if (v) this.eHeader.classList.add("sub");
        else this.eHeader.classList.remove("sub");
    }
    get isHeader() { return !this.isSubHeader; }
    set isHeader(v) { this.isSubHeader = !v; }

    get isSwitch() { return this.eToggle.classList.contains("switch"); }
    set isSwitch(v) {
        if (v) {
            this.eToggle.classList.add("switch");
            this.eToggle.classList.remove("checkbox");
        } else {
            this.eToggle.classList.remove("switch");
            this.eToggle.classList.add("checkbox");
        }
    }
    get isCheckbox() { return !this.isSwitch; }
    set isCheckbox(v) { this.isSwitch = !v; }

    get type() { return this.eType.textContent; }
    set type(v) { this.eType.textContent = v; }
};
Form.Header = class FormHeader extends Form.Field {
    constructor(name) {
        super("§header");

        this.elem.classList.add("header");

        this.showContent = false;

        this.header = name;

        this.isHeader = true;
    }

    get value() { return null; }
    set value(v) {}
};
Form.SubHeader = class FormHeader extends Form.Field {
    constructor(name) {
        super("§subheader");

        this.elem.classList.add("subheader");

        this.showContent = false;

        this.header = name;
        
        this.isSubHeader = true;
    }

    get value() { return null; }
    set value(v) {}
};
Form.NInput = class FormNInput extends Form.Field {
    #inputs;
    #hooks;
    #realHooks;

    #inputType;

    constructor(name, n, inputType) {
        super(name);

        super.value = { value: [], has: [] };

        this.elem.classList.add("input");

        this.#inputs = [];
        this.#hooks = [new Set()];
        this.#realHooks = [];

        this.#inputType = null;

        this.addHandler("hook", () => {
            for (let i = 0; i < this.n; i++) {
                let hooks = [...this.#hooks[0], ...this.#hooks[i+1]];
                hooks.forEach(f => {
                    let realf = e => f(e, i);
                    this.#realHooks.push({ inp: this.#inputs[i], f: realf });
                    this.#inputs[i].addEventListener("change", realf);
                });
            }
        });
        this.addHandler("unhook", () => {
            this.#realHooks.forEach(({ inp, f }) => {
                inp.removeEventListener("change", f);
            });
        });

        this.addHandler("apply", () => {
            for (let i = 0; i < this.n; i++) {
                this.inputs[i].disabled = this.disabled;
                this.inputs[i].type = this.inputType;
                if (this.hasValue(i)) this.setInputValue(i, this.getValue(i));
                else this.inputs[i].value = "";
            }
        });
        this.addHandler("change", () => this.apply());

        this.n = n;
        this.inputType = inputType;
    }

    get value() { return Array.from(new Array(this.n).keys()).map(i => this.getValue(i)); }
    set value(v) {
        v = util.ensure(v, "arr");
        if (v.length > this.n) v.splice(this.n);
        if (v.length < this.n) v.push(...new Array(this.n-v.length).fill(null));
        for (let i = 0; i < this.n; i++) this.setValue(i, v[i]);
    }

    get n() { return this.#inputs.length; }
    set n(v) {
        v = Math.max(0, util.ensure(v, "int"));
        if (this.n == v) return;
        let n = this.n;
        this.unhook();
        this.#inputs.forEach(inp => inp.remove());
        this.#inputs = [];
        this.#hooks = [new Set()];
        super.value.value = [];
        super.value.has = [];
        for (let i = 0; i < v; i++) {
            let inp = document.createElement("input");
            this.eContent.appendChild(inp);
            this.#inputs.push(inp);
            this.#hooks.push(new Set());
            super.value.value.push(this.cast(null));
            super.value.has.push(true);
        }
        this.hook();
        this.change("n", n, this.n);
    }
    get inputs() { return [...this.#inputs]; }

    unhook() { this.post("unhook"); }
    hook() { this.post("hook"); }
    apply() { this.post("apply"); }

    cast(v) {
        if (this.isBool) return !!v;
        if (this.isColor) return new util.Color(v);
        if (this.isDate) return new Date(v);
        if (this.isText) return String(v);
        if (this.isFile) return [...util.ensure(v, "arr").map(v => String(v))];
        if (this.isNum) return util.ensure(v, "num");
        return null;
    }
    castAll() {
        for (let i = 0; i < this.n; i++)
            this.setValue(i, this.getValue(i));
    }
    getValue(i) {
        i = util.ensure(i, "int", -1);
        if (i < 0 || i >= this.n) return null;
        return this.cast(super.value.value[i]);
    }
    setValue(i, v) {
        i = util.ensure(i, "int", -1);
        if (i < 0 || i >= this.n) return null;
        let v0 = this.getValue(i);
        v = this.cast(v);
        if (this.isBool || this.isText || this.isNum)
            if (v == super.value.value[i])
                return v;
        if (this.isColor)
            if (v.equals(super.value.value[i]))
                return v;
        if (this.isDate)
            if (v.getTime() == this.cast(super.value.value[i]).getTime())
                return v;
        if (this.isFile)
            if (util.equals(v, super.value.value[i]))
                return v;
        super.value.value[i] = v;
        this.change("value", v0, v);
        return v0;
    }
    hasValue(i) {
        if (arguments.length == 0) {
            for (let i = 0; i < this.n; i++)
                if (this.hasValue(i)) return true;
            return false;
        }
        i = util.ensure(i, "int", -1);
        if (i < 0 || i >= this.n) return null;
        return !!super.value.has[i];
    }
    setHasValue(i, v) {
        if (arguments.length == 1) {
            for (let i = 0; i < this.n; i++)
                this.setHasValue(i, arguments[0]);
            return !!arguments[0];
        }
        i = util.ensure(i, "int", -1);
        if (i < 0 || i >= this.n) return null;
        v = !!v;
        if (super.value.has[i] == v) return null;
        this.change("hasValue", super.value.has[i], super.value.has[i]=v);
        return v;
    }
    getInputValue(i) {
        i = util.ensure(i, "int", -1);
        if (i < 0 || i >= this.n) return null;
        let inp = this.#inputs[i];
        let v = null;
        if (this.isBool) v = inp.checked;
        if (this.isColor) v = inp.value;
        if (this.isDate) v = inp.valueAsDate;
        if (this.isText) v = inp.value;
        if (this.isFile) v = inp.files;
        if (this.isNum) v = inp.valueAsNumber;
        return this.cast(v);
    }
    setInputValue(i, v) {
        i = util.ensure(i, "int", -1);
        if (i < 0 || i >= this.n) return null;
        let inp = this.#inputs[i];
        v = this.cast(v);
        if (this.isBool) inp.checked = v;
        if (this.isColor) inp.value = v.toHex();
        if (this.isDate) inp.valueAsDate = v;
        if (this.isText) inp.value = v;
        if (this.isFile) inp.files = v;
        if (this.isNum) inp.valueAsNumber = v;
        return v;
    }

    defineHook(i, f) {
        i = util.ensure(i, "int", -1);
        if (i < -1 || i >= this.n) return null;
        f = util.ensure(f, "func");
        if (this.#hooks[i+1].has(f)) return f;
        this.unhook();
        this.#hooks[i+1].add(f);
        this.hook();
        return f;
    }
    undefineHook(i, f) {
        i = util.ensure(i, "int", -1);
        if (i < -1 || i >= this.n) return null;
        f = util.ensure(f, "func");
        if (!this.#hooks[i+1].has(f)) return null;
        this.unhook();
        this.#hooks[i+1].delete(f);
        this.hook();
        return f;
    }
    defineDefaultHook() {
        this.defineHook(-1, (e, i) => {
            this.setValue(i, this.getInputValue(i));
        });
    }

    get inputType() { return this.#inputType; }
    set inputType(v) {
        v = String(v);
        if (this.inputType == v) return;
        this.change("inputType", this.inputType, this.#inputType=v);
        this.castAll();
    }
    get isBool() { return ["checkbox", "radio"].includes(this.inputType); }
    get isColor() { return ["color"].includes(this.inputType); }
    get isDate() { return ["date", "datetime-local", "month", "time", "week"].includes(this.inputType); }
    get isText() { return ["email", "password", "search", "tel", "text", "url"].includes(this.inputType); }
    get isFile() { return ["file"].includes(this.inputType); }
    get isNum() { return ["number", "range"].includes(this.inputType); }

    get focused() {
        for (let inp of this.inputs)
            if (document.activeElement == inp)
                return true;
        return false;
    }
};
Form.NNumberInput = class FormNNumberInput extends Form.NInput {
    #step;

    #types;
    #baseType;
    #activeType;

    #eTypeBtn;

    constructor(name, n) {
        super(name, n, "number");

        this.#step = 0;

        this.#types = new Set();
        this.#baseType = null;
        this.#activeType = null;

        const fix = v => Math.floor(v*(10**6))/(10**6);

        this.defineHook(-1, (e, i) => {
            this.setValue(i, fix(lib.Unit.convert(this.getInputValue(i), this.activeType || "#", this.baseType || "#")));
        });

        this.addHandler("apply", () => {
            for (let i = 0; i < this.n; i++) {
                if (this.hasStep()) this.inputs[i].step = this.step;
                else this.inputs[i].removeAttribute("step");
                if (this.hasValue(i))
                    this.setInputValue(i, fix(lib.Unit.convert(this.getValue(i), this.baseType || "#", this.activeType || "#")));
                else this.inputs[i].value = "";
            }
        });

        this.step = null;

        this.types = ["#"];
        this.baseType = "#";
        this.activeType = "#";
    }

    get inputType() { return super.inputType; }
    set inputType(v) {
        if (this.inputType != null) return;
        super.inputType = v;
    }

    get step() { return this.#step; }
    set step(v) {
        v = (v == null) ? null : Math.max(0, util.ensure(v, "num"));
        if (this.step == v) return;
        this.change("step", this.step, this.#step=v);
    }
    hasStep() { return this.step != null; }

    get types() { return [...this.#types]; }
    set types(v) {
        v = util.ensure(v, "arr");
        this.clearTypes();
        this.addType(v);
    }
    clearTypes() {
        let types = this.types;
        this.remType(types);
        return types;
    }
    hasType(type) { return this.#types.has(String(type)); }
    addType(...types) {
        let r = util.Target.resultingForEach(types, type => {
            type = String(type);
            this.#types.add(type);
            return type;
        });
        this.applyType();
        return r;
    }
    remType(...types) {
        let r = util.Target.resultingForEach(types, type => {
            type = String(type);
            this.#types.delete(type);
            return type;
        });
        this.applyType();
        return r;
    }
    get baseType() { return this.#baseType; }
    set baseType(v) {
        v = String(v);
        if (this.baseType == v) return;
        this.change("baseType", this.baseType, this.#baseType=v);
    }
    get activeType() { return this.#activeType; }
    set activeType(v) {
        v = String(v);
        if (this.activeType == v) return;
        this.change("activeType", this.activeType, this.#activeType=v);
        this.applyType();
    }

    applyType() {
        this.eType.innerHTML = "";
        this.#eTypeBtn = document.createElement("button");
        this.eType.appendChild(this.eTypeBtn);
        this.eTypeBtn.classList.add("normal");
        this.eTypeBtn.textContent = this.activeType;
        this.eTypeBtn.addEventListener("click", e => {
            e.stopPropagation();
            let itm;
            let menu = new Menu();
            this.types.forEach(data => {
                itm = menu.addItem(new Menu.Item(
                    util.is(data, "obj") ? data.name : data,
                    (util.is(data, "obj") ? data.value : data) == this.activeType ? "checkmark" : "",
                ));
                itm.addHandler("trigger", e => (this.activeType = (util.is(data, "obj") ? data.value : data)));
            });
            Menu.contextMenu = menu;
            let r = this.eTypeBtn.getBoundingClientRect();
            Menu.placeContextMenu(r.left, r.bottom);
            menu.elem.style.minWidth = r.width+"px";
        });
    }
    fix(v) { return Math.round(util.ensure(v, "num")*1000000)/1000000; }

    get eTypeBtn() { return this.#eTypeBtn; }
};
Form.Input1d = class FormInput1d extends Form.NNumberInput {
    constructor(name, value) {
        super(name, 1);

        this.value = value;
    }

    get n() { return super.n ;}
    set n(v) {
        if (this.n != 0) return;
        super.n = v;
    }

    get value() { return super.value[0]; }
    set value(v) {
        if (v != null) super.setValue(0, v);
        this.setHasValue(0, v != null);
    }
    hasValue() { return super.hasValue(0); }
};
Form.Input2d = class FormInput2d extends Form.NNumberInput {
    #value;

    constructor(name, value) {
        super(name, 2);

        let ignore = false;

        super.addHandler("change-value", () => {
            ignore = true;
            for (let i = 0; i < this.n; i++)
                this.value["xy"[i]] = this.getValue(i);
            ignore = false;
        });

        this.#value = new V();
        this.value.addHandler("change", (c, f, t) => {
            if (!ignore) super.setValue("xy".indexOf(c), t);
            super.setHasValue("xy".indexOf(c), true);
        });

        this.value = value;
    }

    get n() { return super.n ;}
    set n(v) {
        if (this.n != 0) return;
        super.n = v;
    }

    get value() { return this.#value; }
    set value(v) {
        if (v != null) this.#value.set(v);
        this.setHasValue(v != null);
    }
    get x() { return this.value.x; }
    set x(v) {
        if (v != null) this.value.x = v;
        this.setHasValue(0, v != null);
    }
    get y() { return this.value.y; }
    set y(v) {
        if (v != null) this.value.y = v;
        this.setHasValue(1, v != null);
    }
    hasValue(i) {
        if (i == "x") return super.hasValue(0);
        if (i == "y") return super.hasValue(1);
        return super.hasValue(...arguments);
    }
};
Form.Input3d = class FormInput3d extends Form.NNumberInput {
    #value;

    constructor(name, value) {
        super(name, 3);

        super.addHandler("change-value", () => {
            for (let i = 0; i < this.n; i++)
                this.value["xyz"[i]] = this.getValue(i);
        });

        this.#value = new util.V3();
        this.value.addHandler("change", (c, f, t) => {
            super.setValue("xyz".indexOf(c), t);
            super.setHasValue("xyz".indexOf(c), true);
        });

        this.value = value;
    }

    get n() { return super.n ;}
    set n(v) {
        if (this.n != 0) return;
        super.n = v;
    }

    get value() { return this.#value; }
    set value(v) {
        if (v != null) this.#value.set(v);
        this.setHasValue(v != null);
    }
    get x() { return this.value.x; }
    set x(v) {
        if (v != null) this.value.x = v;
        this.setHasValue(0, v != null);
    }
    get y() { return this.value.y; }
    set y(v) {
        if (v != null) this.value.y = v;
        this.setHasValue(1, v != null);
    }
    get z() { return this.value.z; }
    set z(v) {
        if (v != null) this.value.z = v;
        this.setHasValue(2, v != null);
    }
    hasValue(i) {
        if (i == "x") return super.hasValue(0);
        if (i == "y") return super.hasValue(1);
        if (i == "z") return super.hasValue(2);
        return super.hasValue(...arguments);
    }
};
Form.TextInput = class FormTextInput extends Form.NInput {
    constructor(name) {
        super(name, 1, "text");

        this.defineDefaultHook();

        this.inputs.forEach(inp => {
            inp.autocomplete = "off";
            inp.spellcheck = false;
        });

        this.value = "";

        this.type = "str";
    }

    get inputType() { return super.inputType; }
    set inputType(v) {
        if (this.inputType != null) return;
        super.inputType = v;
    }

    get value() { return super.getValue(0); }
    set value(v) { super.setValue(0, v); }

    get n() { return super.n; }
    set n(v) {
        if (this.n != 0) return;
        super.n = v;
    }

    get inputType() { return super.inputType; }
    set inputType(v) {
        if (this.inputType != null) return;
        super.inputType = v;
    }
};
Form.DirentInput = class FormDirentInput extends Form.Field {
    #dialogTitle;
    #dialogFilters;
    #dialogProperties;

    #eInput;
    #eBtn;

    constructor(name, value) {
        super(name, 0, "");

        this.elem.classList.add("dirent");

        super.value = null;

        this.dialogTitle = "Choose a dirent";
        this.dialogFilters = [];
        this.dialogProperties = ["openFile"];

        this.#eInput = document.createElement("input");
        this.eContent.appendChild(this.eInput);
        this.eInput.type = "text";
        this.eInput.autocomplete = "off";
        this.eInput.spellcheck = false;
        this.eInput.addEventListener("change", e => {
            this.value = this.eInput.value;
        });
        this.#eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.classList.add("normal");
        this.eBtn.textContent = "Browse";
        this.eBtn.addEventListener("click", async e => {
            e.stopPropagation();
            let result = await fileOpenDialog({
                title: this.dialogTitle,
                filters: this.dialogFilters,
                properties: this.dialogProperties.filter(v => v != "multiSelections"),
            });
            result = util.ensure(result, "obj");
            this.value = result.canceled ? null : util.ensure(result.filePaths, "arr")[0];
        });

        this.addHandler("change", () => {
            this.eInput.value = (this.value == null) ? "" : this.value;
        });

        this.value = value;

        this.type = ".*";
    }

    get n() { return super.n; }
    set n(v) {}

    get eInput() { return this.#eInput; }
    get eBtn() { return this.#eBtn; }

    get value() { return super.value; }
    set value(v) {
        v = (v == null) ? null : util.ensure(v, "str");
        if (this.value == v) return;
        super.value = v;
    }
    hasValue() { return this.value != null; }

    get dialogTitle() { return this.#dialogTitle; }
    set dialogTitle(v) { this.#dialogTitle = String(v); }
    get dialogFilters() { return this.#dialogFilters; }
    set dialogFilters(v) { this.#dialogFilters = util.ensure(v, "arr"); }
    get dialogProperties() { return this.#dialogProperties; }
    set dialogProperties(v) { this.#dialogProperties = util.ensure(v, "arr"); }

    get focused() { return this.eInput.focused; }
};
Form.ColorInput = class FormColorInput extends Form.Field {
    #useAlpha;

    #eColorbox;
    #eColorPicker;
    #eInput;

    constructor(name, value) {
        super(name);

        this.elem.classList.add("color");
        
        super.value = new util.Color();
        
        this.value.addHandler("change", (c, f, t) => this.change("value", null, this.value));
        this.#useAlpha = null;

        this.eContent.innerHTML = "<p-tooltip type='color' class='tog swx'></p-tooltip>";
        this.#eColorPicker = this.eContent.children[0];
        let ignore = false;
        this.eColorPicker.color.addHandler("change", () => {
            if (ignore) return;
            this.value = this.eColorPicker.color;
        });

        this.#eColorbox = document.createElement("button");
        this.eContent.appendChild(this.eColorbox);
        this.eColorbox.classList.add("override");
        this.eColorbox.addEventListener("click", e => {
            e.stopPropagation();
            this.eContent.classList.add("active");
            const onClick = e => {
                if (this.eColorPicker.contains(e.target)) return;
                e.stopPropagation();
                this.eContent.classList.remove("active");
                document.body.removeEventListener("click", onClick, true);
            };
            document.body.addEventListener("click", onClick, true);
        });
        this.#eInput = document.createElement("input");
        this.eContent.appendChild(this.eInput);
        this.eInput.type = "text";
        this.eInput.addEventListener("change", e => {
            this.value.set(this.eInput.value);
        });
        const apply = () => {
            this.eInput.disabled = this.eColorbox.disabled = this.disabled;

            this.eInput.value = this.value.toHex(this.useAlpha);
            this.eColorbox.style.backgroundColor = this.value.toHex(this.useAlpha);
            ignore = true;
            this.eColorPicker.color = this.value;
            this.eColorPicker.useA = this.useAlpha;
            ignore = false;
        };
        this.addHandler("change", apply);

        this.value = value;
        this.useAlpha = true;
    }

    get value() { return super.value; }
    set value(v) { super.value.set(v); }
    get useAlpha() { return this.#useAlpha; }
    set useAlpha(v) {
        v = !!v;
        if (this.useAlpha == v) return;
        this.change("useAlpha", this.useAlpha, this.#useAlpha=v);
    }
    
    get eColorbox() { return this.#eColorbox; }
    get eColorPicker() { return this.#eColorPicker; }
    get eInput() { return this.#eInput; }

    get focused() { return this.eInput.focused; }
};
Form.EnumInput = class FormEnumInput extends Form.Field {
    #values;

    constructor(name, values, value) {
        super(name);

        this.elem.classList.add("enum");

        this.#values = [];

        this.values = values;
        this.value = value;
    }

    get values() { return this.#values; }
    set values(v) {
        this.#values = v;
        this.change("values", null, this.values);
    }
    get value() { return super.value; }
    set value(v) {
        if (this.value == v) return;
        super.value = v;
    }
    hasValue() { return this.#values.map(data => (util.is(data, "obj") ? data.value : data)).includes(this.value); }
};
Form.DropdownInput = class FormDropdownInput extends Form.EnumInput {
    #eBtn;

    constructor(name, values, value) {
        super(name, values, value);

        this.elem.classList.add("dropdown");

        this.#eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.classList.add("normal");
        this.eBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        
        this.eBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
            let menu = (this.values instanceof Menu) ? this.values : util.is(this.values, "func") ? this.values() : null;
            if (!(menu instanceof Menu)) {
                menu = new Menu();
                const dfs = (data, menu) => {
                    util.ensure(data, "arr").forEach(data => {
                        if (data == null) return menu.addItem(new Menu.Divider());
                        let itm = menu.addItem(new Menu.Item(
                            util.is(data, "obj") ? data.name : data,
                            ((util.is(data, "obj") ? data.value : data) == this.value) ? "checkmark" : "",
                        ));
                        itm.addHandler("trigger", e => {
                            if (util.is(data, "obj"))
                                if (!("value" in data)) return;
                            this.value = util.is(data, "obj") ? data.value : data;
                        });
                        dfs(data.sub, itm.menu);
                    });
                };
                dfs(this.values, menu);
            }
            Menu.contextMenu = menu;
            let r = this.eBtn.getBoundingClientRect();
            Menu.placeContextMenu(r.left, r.bottom);
            menu.elem.style.minWidth = r.width+"px";
        });

        this.addHandler("change-disabled", () => {
            this.eBtn.disabled = this.disabled;
        });

        const apply = () => {
            if (this.values instanceof Menu) return;
            if (util.is(this.values, "func")) return;
            this.btn = "None";
            const dfs = data => {
                util.ensure(data, "arr").forEach(data => {
                    if (data == null) return;
                    if (util.is(data, "obj")) {
                        if (!("value" in data)) return;
                        if (data.value == this.value) this.btn = data.name;
                        dfs(data.sub);
                    }
                    if (data == this.value) this.btn = data;
                });
            };
            dfs(this.values);
        };
        this.addHandler("change", apply);
        apply();
    }

    get eBtn() { return this.#eBtn; }
    get btn() {
        if (!this.eBtn.children[0]) return;
        this.eBtn.children[0].textContent;
    }
    set btn(v) {
        if (!this.eBtn.children[0]) return;
        this.eBtn.children[0].textContent = v;
    }
};
Form.SelectInput = class FormSelectInput extends Form.EnumInput {
    #useOutline;
    #mergeTop;
    #mergeBottom;

    constructor(name, values, value) {
        super(name, values, value);

        this.elem.classList.add("select");

        this.#useOutline = null;
        this.#mergeTop = null;
        this.#mergeBottom = null;
        this.useOutline = true;
        this.mergeTop = false;
        this.mergeBottom = false;

        this.addHandler("change-disabled", () => {
            for (let btn of this.eContent.children)
                btn.disabled = this.disabled;
        });

        const apply = () => {
            this.eContent.innerHTML = "";
            this.values.forEach(data => {
                if (data == null) return;
                let btn = document.createElement("button");
                this.eContent.appendChild(btn);
                if ((util.is(data, "obj") ? data.value : data) == this.value) btn.classList.add("this");
                btn.textContent = (util.is(data, "obj") ? data.name : data);
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.value = (util.is(data, "obj") ? data.value : data);
                    if (util.is(data.click, "func")) data.click();
                });
                btn.style.setProperty("--n", this.values.length);
            });
        };
        this.addHandler("change", apply);
        apply();
    }

    get values() { return [...super.values]; }
    set values(v) { super.values = util.ensure(v, "arr"); }

    get useOutline() { return this.#useOutline; }
    set useOutline(v) {
        this.#useOutline = !!v;
        this.elem.style.setProperty("--use-o", +this.useOutline);
    }

    get mergeTop() { return this.#mergeTop; }
    set mergeTop(v) {
        this.#mergeTop = !!v;
        this.elem.style.setProperty("--merge-t", +this.mergeTop);
    }
    get mergeBottom() { return this.#mergeBottom; }
    set mergeBottom(v) {
        this.#mergeBottom = !!v;
        this.elem.style.setProperty("--merge-b", +this.mergeBottom);
    }
};
Form.BooleanInput = class FormBooleanInput extends Form.Field {
    constructor(name, value) {
        super(name);

        this.showToggle = true;
        this.showContent = false;

        this.addHandler("change-toggleOn", () => (super.value = this.toggleOn));
        this.addHandler("change-toggleDisabled", () => (super.disabled = this.toggleDisabled));

        this.value = value;
    }

    get value() { return super.value; }
    set value(v) { this.toggleOn = v; }

    get disabled() { return super.disabled; }
    set disabled(v) { this.toggleDisabled = v; }
};
Form.ToggleInput = class FormToggleInput extends Form.BooleanInput {
    #eBtn;

    constructor(name, toggleName, value) {
        super(name, value);
        
        this.showToggle = false;
        this.showContent = true;

        this.elem.classList.add("enum");
        this.elem.classList.add("select");

        this.#eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.style.setProperty("--n", 1);
        this.eBtn.addEventListener("click", e => {
            this.value = !this.value;
        });

        const apply = () => {
            this.eBtn.disabled = this.disabled;
            if (this.value) this.eBtn.classList.add("this");
            else this.eBtn.classList.remove("this");
        };
        this.addHandler("change", apply);
        apply();

        this.toggleName = toggleName;
    }

    get eBtn() { return this.#eBtn; }

    get toggleName() { return this.eBtn.textContent; }
    set toggleName(v) { this.eBtn.textContent = v; }
};
Form.JSONInput = class FormJSONInput extends Form.Field {
    #map;

    #eAdd;

    constructor(name, map) {
        super(name);
        
        this.elem.classList.add("json");

        this.#map = {};

        this.#eAdd = document.createElement("button");
        this.eContent.appendChild(this.eAdd);
        this.eAdd.classList.add("special");
        this.eAdd.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.eAdd.addEventListener("click", e => {
            e.stopPropagation();
            let keys = this.keys;
            let k = "new-key";
            if (keys.includes(k)) {
                let n = 1;
                while (true) {
                    if (!keys.includes(k+"-"+n)) break;
                    n++;
                }
                k += "-"+n;
            }
            this.set(k, "null");
        });

        this.addHandler("change-disabled", () => {
            this.eAdd.disabled = this.disabled;
            Array.from(this.eContent.querySelectorAll("input")).forEach(inp => (inp.disabled = this.disabled));
        });

        this.addHandler("change", () => {
            Array.from(this.eContent.querySelectorAll(":scope > .item")).forEach(elem => elem.remove());
            this.keys.forEach(k => {
                let v = this.get(k);
                let elem = document.createElement("div");
                this.eContent.insertBefore(elem, this.eAdd);
                elem.classList.add("item");
                let kinput = document.createElement("input");
                elem.appendChild(kinput);
                kinput.type = "text";
                kinput.placeholder = "Key...";
                kinput.autocomplete = "off";
                kinput.spellcheck = false;
                kinput.value = k;
                let separator = document.createElement("div");
                elem.appendChild(separator);
                separator.classList.add("separator");
                separator.textContent = ":";
                let vinput = document.createElement("input");
                elem.appendChild(vinput);
                vinput.type = "text";
                vinput.placeholder = "Value...";
                vinput.autocomplete = "off";
                vinput.spellcheck = false;
                vinput.value = v;
                let color = "v4";
                try {
                    let v2 = JSON.parse(v);
                    if (util.is(v2, "str")) color = "cy";
                    else if (util.is(v2, "num")) color = "cb";
                    else if (v2 == null) color = "co";
                    else if (v2 == true || v2 == false) color = ["cr", "cg"][+v2];
                    else color = "v8";
                } catch (e) {}
                vinput.style.color = "var(--"+color+")";
                let remove = document.createElement("button");
                elem.appendChild(remove);
                remove.classList.add("remove");
                remove.innerHTML = "<ion-icon name='close'></ion-icon>";
                kinput.addEventListener("change", e => {
                    this.del(k);
                    this.set(kinput.value, v);
                });
                vinput.addEventListener("change", e => {
                    this.set(k, vinput.value);
                });
                remove.addEventListener("click", e => {
                    e.stopPropagation();
                    this.del(k);
                });
            });
        });

        this.map = map;
    }

    get keys() { return Object.keys(this.#map); }
    get values() { return Object.values(this.#map); }
    get map() {
        let map = {};
        this.keys.forEach(k => (map[k] = this.get(k)));
        return map;
    }
    set map(v) {
        v = util.ensure(v, "obj");
        this.clear();
        for (let k in v) this.set(k, v[k]);
    }
    clear() {
        let map = this.map;
        this.keys.forEach(k => this.del(k));
        return map;
    }
    has(k) { return String(k) in this.#map; }
    get(k) {
        if (!this.has(k)) return null;
        return this.#map[String(k)];
    }
    set(k, v) {
        k = String(k);
        v = String(v);
        let v2 = this.get(k);
        if (v == v2) return v2;
        this.#map[k] = v;
        this.post("set", k, v2, v);
        this.change("map", null, this.keys);
        return v;
    }
    del(k) {
        let v = this.get(k);
        if (v == null) return v;
        delete this.#map[String(k)];
        this.post("del", k, v);
        this.change("map", null, this.keys);
        return v;
    }

    get eAdd() { return this.#eAdd; }
};
Form.Button = class FormButton extends Form.Field {
    #eBtn;

    constructor(name, text, type="normal") {
        super(name);

        this.elem.classList.add("button");

        this.addHandler("change-disabled", () => (this.eBtn.disabled = this.disabled));

        this.#eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
        });

        this.text = text;

        this.btnType = type;
    }

    get eBtn() { return this.#eBtn; }

    get text() { return this.eBtn.textContent; }
    set text(v) { this.eBtn.textContent = v; }

    get btnType() {
        for (let name of ["normal", "special", "on", "off"])
            if (this.eBtn.classList.contains(name))
                return name;
        return null;
    }
    set btnType(v) {
        ["normal", "special", "on", "off"].forEach(name => {
            if (name == v) this.eBtn.classList.add(name);
            else this.eBtn.classList.remove(name);
        });
    }
};
Form.Buttons = class FormButtons extends Form.Field {
    constructor(name, buttons) {
        super(name);

        this.elem.classList.add("button");
        
        const btns = util.ensure(buttons, "arr").map((data, i) => {
            data = util.ensure(data, "obj");
            const btn = document.createElement("button");
            this.eContent.appendChild(btn);
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("trigger", i, e);
            });
            btn.textContent = data.text;
            ["normal", "special", "on", "off"].forEach(name => {
                if (name == data.type) btn.classList.add(name);
                else btn.classList.remove(name);
            });
            return btn;
        });

        this.addHandler("change-disabled", () => {
            btns.forEach(btn => (btn.disabled = this.disabled));
        });
    }
};
Form.Line = class FormLine extends Form.Field {
    constructor(color="var(--v2)") {
        super("§");

        this.elem.classList.add("line");

        this.color = color;
    }

    get color() { return this.elem.style.backgroundColor; }
    set color(v) { this.elem.style.backgroundColor = v; }
};
Form.SubForm = class FormSubForm extends Form.Field {
    #form;

    constructor(name) {
        super(name);

        this.elem.classList.add("subform");

        this.eHeader.insertBefore(document.createElement("ion-icon"), this.eHeader.firstChild);
        this.eHeader.firstChild.name = "chevron-forward";
        this.eHeader.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        this.#form = new Form();
        this.eContent.appendChild(this.form.elem);

        this.isHorizontal = false;
    }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(v) {
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get form() { return this.#form; }
};
Form.HTML = class FormHTML extends Form.Field {
    constructor(name, ...elems) {
        super(name);

        this.elem.classList.add("html");

        this.showHeader = false;

        elems.flatten().forEach(elem => {
            if (elem instanceof HTMLElement)
                this.eContent.appendChild(elem);
        });
    }
};

export class DropTarget extends util.Target {
    #elem;
    #eOverlay;
    #observer;
    #observed;

    #dragIn;
    #dragOut;
    #drop;

    #disabled;

    constructor(elem) {
        super();

        this.#disabled = false;

        this.#elem = null;
        this.#eOverlay = document.createElement("div");
        this.#eOverlay.classList.add("overlay");
        this.#eOverlay.innerHTML = "<div></div><div></div>";
        this.#observed = () => {
            if (!this.hasElem()) return;
            let r = this.elem.getBoundingClientRect();
            this.#eOverlay.style.setProperty("--size", Math.min(r.width, r.height)+"px");
        };
        this.#observer = new ResizeObserver(this.#observed);

        this.#dragIn = e => {
            if (this.disabled) return this.#dragOut();
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.#eOverlay.classList.add("this");
        };
        this.#dragOut = e => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.#eOverlay.classList.remove("this");
        };
        this.#drop = e => this.post("drop", e);
        this.addHandler("drop", e => {
            if (!e) return;
            if (!e.dataTransfer) return;
            let files = e.dataTransfer.items ? [...e.dataTransfer.items] : [];
            files = files.map(item => item.getAsFile()).filter(file => file instanceof File);
            if (files.length <= 0) files = e.dataTransfer.files ? [...e.dataTransfer.files] : [];
            files = files.filter(file => file instanceof File);
            this.post("files", files);
        });

        this.elem = elem;
    }

    get elem() { return this.#elem; }
    set elem(v) {
        v = (v instanceof HTMLElement) ? v : null;
        if (this.elem == v) return;
        this.unhook();
        this.#elem = v;
        this.hook();
    }
    hasElem() { return !!this.elem; }
    unhook() {
        if (!this.hasElem()) return;
        this.elem.classList.remove("droptarget");
        if (this.disabled)
            this.elem.classList.remove("disabled");
        this.#eOverlay.remove();
        this.#observer.disconnect();
        ["dragenter", "dragover"].forEach(name => this.elem.removeEventListener(name, this.#dragIn));
        ["dragleave", "dragend", "drop"].forEach(name => this.elem.removeEventListener(name, this.#dragOut));
        this.elem.removeEventListener("drop", this.#drop);
        this.#dragOut(null);
        this.#observed();
    }
    hook() {
        if (this.disabled) return this.unhook();
        if (!this.hasElem()) return;
        this.elem.classList.add("droptarget");
        this.elem.classList.remove("disabled");
        if (this.disabled)
            this.elem.classList.add("disabled");
        this.elem.appendChild(this.#eOverlay);
        this.#observer.observe(this.elem);
        ["dragenter", "dragover"].forEach(name => this.elem.addEventListener(name, this.#dragIn));
        ["dragleave", "dragend", "drop"].forEach(name => this.elem.addEventListener(name, this.#dragOut));
        this.elem.addEventListener("drop", this.#drop);
        this.#dragOut(null);
        this.#observed();
    }

    get disabled() { return this.#disabled; }
    set disabled(v) {
        v = !!v;
        if (this.disabled == v) return;
        this.change("disabled", this.disabled, this.#disabled=v);
        this.unhook();
        this.hook();
    }
    get enabled() { return !this.disabled; }
    set enabled(v) { this.disabled = !v; }
    disable() { return this.disabled = true; }
    enable() { return this.enabled = true; }
}
