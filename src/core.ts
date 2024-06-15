import * as util from "./util";
import { Vec1, Vec2, Vec3, Vec4 } from "./util";
import * as lib from "./lib";

import * as THREE from "three";
import * as ionicons from "ionicons";
import {
    Rectangle,
    OpenDialogOptions, OpenDialogReturnValue,
    SaveDialogOptions, SaveDialogReturnValue, FileFilter,
} from "electron";

import * as electronAPI from "./ElectronAPI";


import Source from "./sources/source";


// window.f = () => {
//     ["space-steel", "moon-steel", "blue-marine", "legacy"].forEach((theme, i) => setTimeout(() => window.api.set("active-theme", theme), 10000 + i*1000));
// };


const buttonTypes = ["normal", "lightest", "light", "heavy", "special", "on", "off"];
export type ButtonType = "normal" | "lightest" | "light" | "heavy" | "special" | "on" | "off" | null;
const inputTypes = [
    "checkbox", "radio",
    "color",
    "date", "datetime-local", "month", "time", "week",
    "email", "password", "search", "tel", "text", "url",
    "file",
    "number", "range",
];
export type InputType =  "checkbox" | "radio" | "color" | "date" | "datetime-local" | "month" | "time" | "week" | "email" | "password" | "search" | "tel" | "text" | "url" | "file" | "number" | "range";


/** Captures a portion of the screen using window.api and Electron. */
export async function capture(rect?: Rectangle): Promise<string> {
    return util.castString(await window.api.send("capture", rect));
}
/** Initiates a file open dialog prompt through window.api and Electron. */
export async function fileOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    return (await window.api.send("file-open-dialog", options)) as OpenDialogReturnValue;
}
/** Initiates a file save dialog prompt through window.api and Electron. */
export async function fileSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
    return (await window.api.send("file-save-dialog", options)) as SaveDialogReturnValue;
}


/** A singleton css property cache manager */
class PropertyCache extends util.Target {
    private static _instance: PropertyCache | null = null;
    static get instance() {
        if (!this._instance) this._instance = new this();
        return this._instance;
    }

    private cache: util.StringMap;
    private colorCache: util.StringMap<util.Color>;

    private constructor() {
        super();

        this.cache = {};
        this.colorCache = {};
    }

    get(key: string): string {
        if (key in this.cache) return this.cache[key];
        this.cache[key] = getComputedStyle(document.body).getPropertyValue(key);
        return this.get(key);
    }
    getColor(key: string): util.Color {
        if (key in this.colorCache) return this.colorCache[key];
        this.colorCache[key] = new util.Color(this.get(key));
        return this.getColor(key);
    }
    clear(): void {
        this.cache = {};
        this.colorCache = {};
    }
}
export const PROPERTYCACHE = PropertyCache.instance;

class GlobalStatePropertyDict extends util.Dict<GlobalStateProperty<any>> {
    convert(value: GlobalStateProperty<any>): GlobalStateProperty<any> | false { return value; }
    protected addInternal(value: GlobalStateProperty<any>): void { this._dict.set(value.name, value); }
    protected remInternal(value: GlobalStateProperty<any>): void { this._dict.delete(value.name); }
    protected hasInternal(value: GlobalStateProperty<any>): boolean { return super.hasInternal(value) && this.keys.includes(value.name); }
}
/** A singleton global state manager */
export class GlobalState extends util.Target {
    private static _instance: GlobalState | null = null;
    static get instance() {
        if (!this._instance) this._instance = new this();
        return this._instance;
    }

    readonly properties;
    private gettingResolver: util.Resolver<number>;

    constructor() {
        super();

        this.properties = new GlobalStatePropertyDict();
        this.gettingResolver = new util.Resolver(0);
    }

    get getting() { return this.gettingResolver.state > 0; }
    /** Waits until the global state is in the "getting" state. */
    async whenGetting(): Promise<void> { await this.gettingResolver.whenNot(0); }
    /** Waits until the global state is in not the "getting" state. */
    async whenNotGetting(): Promise<void> { await this.gettingResolver.when(0); }
    /** Triggers the `get()` methods of each property and sets the global state to the "getting" state. */
    async get(): Promise<this> {
        this.gettingResolver.state++;
        await Promise.all(this.properties.values.map(property => property.get()));
        this.gettingResolver.state--;
        return this;
    }
}
/** A property class for the GlobalState singleton */
export class GlobalStateProperty<T> extends util.Target {
    private _name: string;
    private _getter: () => (Promise<T> | T | null);
    private _value: T | null;

    constructor(name: string, getter: () => (Promise<T> | T | null)) {
        super();

        this._name = name;
        this._getter = () => null;
        this._value = null;

        this.getter = getter;
    }

    get name() { return this._name; }
    get getter() { return this._getter; }
    set getter(value) {
        if (this.getter === value) return;
        this.change("getter", this.getter, this._getter=value);
    }
    get value() { return this._value; }

    /** Triggers this property's getter and stores the output into the value. */
    async get(): Promise<T | null> {
        this._value = await this.getter();
        return this.value;
    }
};
export const GLOBALSTATE = GlobalState.instance;
GLOBALSTATE.properties.add(new GlobalStateProperty(
    "templates",
    async () => lib.castTemplates(await window.api.get("templates")),
));
GLOBALSTATE.properties.add(new GlobalStateProperty(
    "template-images",
    async () => lib.castTemplateImages(await window.api.get("template-images")),
));
GLOBALSTATE.properties.add(new GlobalStateProperty(
    "template-models",
    async () => lib.castTemplateModels(await window.api.get("template-models")),
));
GLOBALSTATE.properties.add(new GlobalStateProperty(
    "active-template",
    async () => util.castNullishString(await window.api.get("active-template")),
));
GLOBALSTATE.properties.add(new GlobalStateProperty(
    "robots",
    async () => lib.castRobots(await window.api.get("robots")),
));
GLOBALSTATE.properties.add(new GlobalStateProperty(
    "robot-models",
    async () => lib.castRobotModels(await window.api.get("robot-models")),
));
GLOBALSTATE.properties.add(new GlobalStateProperty(
    "active-robot",
    async () => util.castNullishString(await window.api.get("active-robot")),
));


/** PLoadingElement - custom HTML loading element */
export class PLoadingElement extends HTMLElement {
    static observedAttributes = ["type", "axis"];

    private first: boolean;

    private _type: "scroll"|"bounce";
    private _axis: "x"|"y";

    constructor() {
        super();

        this.first = true;

        this._type = "scroll";
        this._axis = "x";
    }

    get type() { return this._type; }
    set type(value) {
        if (this.type === value) return;
        this._type = value;
        this.setAttribute("type", this.type);
    }
    get axis() { return this._axis; }
    set axis(value) {
        if (this.axis === value) return;
        this._axis = value;
        this.setAttribute("axis", this.axis);
    }

    connectedCallback() {
        if (!this.first) return;

        this.first = false;

        this.innerHTML = "<div>"+Array.from(new Array(4).keys()).map(i => "<div style='--i:"+i+";'></div>").join("")+"</div>";
    }
    attributeChangedCallback(name: string, prev: any, curr: any) { (this as any)[name] = curr; }
}
window.customElements.define("p-loading", PLoadingElement);


/** PTooltip - custom HTML tooltip element including a color picker */
export class PTooltip extends HTMLElement {
    static observedAttributes = ["type"];

    private intervalId: NodeJS.Timer | null;

    private _type: "normal"|"color";

    private ignore: boolean;

    private _swatches: util.List<util.Color> | null;
    private _color: util.Color;

    private _showPicker: boolean;
    private _showH: boolean;
    private _showS: boolean;
    private _showV: boolean;
    private _showA: boolean;
    private _useA: boolean;

    private readonly eTitle;
    private readonly ePicker;
    private readonly ePickerThumb;
    private readonly eSliders;
    private readonly eSliderInputs: util.StringMap<HTMLInputElement>;
    private readonly eSwatches;

    constructor() {
        super();

        this.intervalId = null;

        this._type = "normal";

        this.ignore = false;

        this._swatches = null;
        this._color = new util.Color();
        this.color.addHandler("change", (attribute: string, from: any, t: any) => {
            if (this.ignore) return;
            this.format();
        });

        this._showPicker = this._showH = this._showS = this._showV = this._showA = this._useA = true;

        this.eTitle = document.createElement("div");
        this.eTitle.classList.add("title");

        this.ePicker = document.createElement("div");
        this.ePicker.classList.add("picker");
        this.ePicker.addEventListener("mousedown", e => {
            e.stopPropagation();
            e.preventDefault();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = (e: MouseEvent) => {
                let rect = this.ePicker.getBoundingClientRect();
                let x = (e.pageX - rect.left) / rect.width;
                let y = (e.pageY - rect.top) / rect.height;
                this.color.s = x;
                this.color.v = 1-y;
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.ePickerThumb = document.createElement("div");
        this.ePicker.appendChild(this.ePickerThumb);

        this.eSliders = document.createElement("div");
        this.eSliders.classList.add("sliders");
        this.eSliderInputs = {};
        "hsva".split("").forEach(key => {
            const eSlider = this.eSliderInputs[key] = document.createElement("input");
            this.eSliders.appendChild(eSlider);
            eSlider.type = "range";
            eSlider.min = "0";
            eSlider.max = "10000";
            eSlider.addEventListener("input", (e: Event) => {
                let value = eSlider.valueAsNumber;
                value /= 10000;
                if (key === "h") value *= 360;
                this.ignore = true;
                (this.color as any)[key] = value;
                this.ignore = false;
            });
        });

        this.eSwatches = document.createElement("div");
        this.eSwatches.classList.add("swatches");
    }

    get type() { return this._type; }
    set type(value) {
        if (this.type === value) return;
        this._type = value;
        this.setAttribute("type", this.type);
        this.format();
    }

    get swatches() { return this._swatches; }

    get color() { return this._color; }
    set color(value) { this._color.set(value); }

    get showPicker() { return this._showPicker; }
    set showPicker(value) {
        if (this.showPicker === value) return;
        this._showPicker = value;
        this.format();
    }
    get showH() { return this._showH; }
    set showH(value) {
        if (this.showH === value) return;
        this._showH = value;
        this.format();
    }
    get showS() { return this._showS; }
    set showS(value) {
        if (this.showS === value) return;
        this._showS = value;
        this.format();
    }
    get showV() { return this._showV; }
    set showV(value) {
        if (this.showV === value) return;
        this._showV = value;
        this.format();
    }
    get showA() { return this._showA; }
    set showA(value) {
        if (this.showA === value) return;
        this._showA = value;
        this.format();
    }
    get useA() { return this._useA; }
    set useA(value) {
        if (this.useA === value) return;
        this._useA = value;
        this.format();
    }

    get title() { return util.castString(this.eTitle.textContent); }
    set title(value) { this.eTitle.textContent = value; }

    /** Formats the element properly. */
    format(): void {
        if (this.type !== "color") {
            this.eTitle.remove();
            this.ePicker.remove();
            this.eSliders.remove();
            this.eSwatches.remove();
            return;
        }

        this.appendChild(this.eTitle);
        this.appendChild(this.ePicker);
        this.appendChild(this.eSliders);
        this.appendChild(this.eSwatches);

        this.ePicker.style.display = this.showPicker ? "" : "none";
        this.eSliders.style.display = (this.showH || this.showS || this.showV || (this.showA && this.useA)) ? "" : "none";

        if (!this.useA) this.color.a = 1;

        let color = new util.Color(0xff0000);
        color.h = this.color.h;
        this.ePicker.style.background = "linear-gradient(90deg, #fff, "+color.toHex(false)+")";
        this.ePicker.style.setProperty("--thumb", this.color.toHex(false));
        this.ePickerThumb.style.left = (100*this.color.s)+"%";
        this.ePickerThumb.style.top = (100*(1-this.color.v))+"%";

        for (let key in this.eSliderInputs) {
            let value = util.castNumber((this.color as any)[key]);
            if (key === "h") value /= 360;
            value *= 10000;

            const useSlider =
                (key === "h") ? this.showH :
                (key === "s") ? this.showS :
                (key === "v") ? this.showV :
                (this.showA && this.useA);

            const eSlider = this.eSliderInputs[key];
            eSlider.disabled = !useSlider;
            eSlider.style.display = useSlider ? "" : "none";

            if (Math.abs(eSlider.valueAsNumber - value) >= 1) eSlider.valueAsNumber = Math.round(value);

            let colorThumb = new util.Color(0xff0000);
            let colorGradientArray: util.Color[] = [];
            if (key == "h") {
                colorThumb.h = this.color.h;
                for (let i = 0; i < 7; i++) {
                    let color = new util.Color();
                    color.hsv = [util.lerp(0, 360, i/6), 1, 1];
                    colorGradientArray.push(color);
                }
            } else if (key == "s") {
                colorThumb.h = this.color.h;
                colorThumb.s = this.color.s;
                let color = new util.Color(0xff0000);
                color.h = this.color.h;
                colorGradientArray.push(new util.Color(0xffffff), color);
            } else if (key == "v") {
                colorThumb.h = this.color.h;
                colorThumb.s = this.color.s;
                colorThumb.v = this.color.v;
                let color = new util.Color(0xff0000);
                color.h = this.color.h;
                color.s = this.color.s;
                colorGradientArray.push(new util.Color(0), color);
            } else {
                colorThumb.hsva = this.color.hsva;
                let color = new util.Color();
                color.hsv = this.color.hsv;
                colorGradientArray.push(new util.Color([color.r, color.g, color.b, 0]), color);
            }

            eSlider.style.background = "linear-gradient(90deg, "+colorGradientArray.map(color => color.toHex()).join(", ")+")";
            eSlider.style.setProperty("--thumb", colorThumb.toHex());
        }

        this.eSwatches.innerHTML = "";
        if (this.swatches) {
            for (let color of this.swatches.list) {
                let eBtn = document.createElement("button");
                this.eSwatches.appendChild(eBtn);
                eBtn.classList.add("override");
                eBtn.style.backgroundColor = color.toHex();
                eBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.color = color;
                });
            }
        } else {
            for (let colorKey of "roygcbpm") {
                let color = PROPERTYCACHE.getColor("--c"+colorKey);
                let eBtn = document.createElement("button");
                this.eSwatches.appendChild(eBtn);
                eBtn.classList.add("override");
                eBtn.style.backgroundColor = color.toHex();
                eBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.color = color;
                });
            }
        }
    }

    connectedCallback() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.format(), 1000);

        this.format();
    }
    disconnectedCallback() {
        if (this.intervalId) clearInterval(this.intervalId);

        this.format();
    }
    attributeChangedCallback(name: string, prev: any, curr: any) { (this as any)[name] = curr; }
}
window.customElements.define("p-tooltip", PTooltip);

class HintEntryList extends util.List<HintEntry> {
    readonly hint;
    constructor(hint: Hint) {
        super();
        this.hint = hint;
    }
    convert(value: HintEntry): HintEntry | false { return value; }
    protected addCallback(value: HintEntry): void { this.hint.elem.appendChild(value.elem); }
    protected remCallback(value: HintEntry): void { this.hint.elem.removeChild(value.elem); }
}
/** A Hint object for using tooltip-like displays that are not linked to a specific HTML element like {@link PTooltip} is */
export class Hint extends util.Target {
    readonly elem;

    readonly entries;

    constructor() {
        super();

        this.elem = document.createElement("div");
        this.elem.classList.add("hint");

        this.entries = new HintEntryList(this);
    }

    /** Places this hint at a specific location on screen. */
    place(place: util.VectorLike): this {
        let pos = new Vec2(place);
        this.elem.style.transform = "translate("+pos.xy.map(axis => axis+"px").join(",")+")";
        return this;
    }
}
/** An entry within a Hint object */
export class HintEntry extends util.Target {
    readonly elem;

    constructor() {
        super();

        this.elem = document.createElement("div");
        this.elem.classList.add("entry");
    }
}
/** An entry of solely a name within a Hint object */
export class HintNameEntry extends HintEntry {
    readonly eName;

    constructor(name: string) {
        super();

        this.eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        
        this.name = name;
    }
    
    get name() { return util.castString(this.eName.textContent); }
    set name(value) { this.eName.textContent = value; }
}
/** An entry of solely a value within a Hint object */
export class HintValueEntry extends HintEntry {
    readonly eValue;

    constructor(value: any) {
        super();

        const eIcon = document.createElement("ion-icon");
        this.elem.appendChild(eIcon);
        eIcon.name = "return-down-forward";

        this.eValue = document.createElement("div");
        this.elem.appendChild(this.eValue);

        this.value = value;
    }

    get value() { return util.castString(this.eValue.textContent); }
    set value(value) { this.eValue.textContent = value; }
}
/** An entry of a key and a value pair within a Hint object */
export class HintKeyValueEntry extends HintEntry {
    readonly eKey;
    readonly eValue;

    constructor(key: any, value: any) {
        super();

        this.eKey = document.createElement("div");
        this.elem.appendChild(this.eKey);

        this.eValue = document.createElement("div");
        this.elem.appendChild(this.eValue);

        this.key = key;
        this.value = value;
    }

    get key() { return util.castString(this.eKey.textContent); }
    set key(v) { this.eKey.textContent = v; }
    get value() { return util.castString(this.eValue.textContent); }
    set value(v) { this.eValue.textContent = v; }
}

export type MenuData = MenuItemData[];
export type MenuItemData = {
    id?: string,

    role?: string | null,
    type?: string | null,
    label?: string | null,
    accelerator?: string | null,

    enabled?: boolean,
    visible?: boolean,
    checked?: boolean,

    submenu?: MenuData,

    click?: Function,
} | "separator";

class MenuItemList extends util.List<MenuItem> {
    readonly menu;
    constructor(menu: Menu) {
        super();
        this.menu = menu;
    }
    convert(value: MenuItem): MenuItem | false { return value; }
    protected addCallback(value: MenuItem): void {
        value.addLinkedHandler(this, "format", () => this.menu.format());
        value.addLinkedHandler(this, "change", (attribute: string, from: any, to: any) => this.change("list."+attribute, from, to));
        value.onAdd();
    }
    protected remCallback(value: MenuItem): void {
        value.onRem();
        value.clearLinkedHandlers(this, "format");
        value.clearLinkedHandlers(this, "change");
    }
    addFinal(): void { this.menu.format(); }
    remFinal(): void { this.menu.format(); }

    /** Gets a menu item by their id. */
    getItemById(id: string): MenuItem | null {
        for (let value of this.list) {
            let foundItem = value.getItemById(id);
            if (!foundItem) continue;
            return foundItem;
        }
        return null;
    }
}
/** A Menu class for showing context menus among other menus within the app */
export class Menu extends util.Target {
    private static _contextMenu: Menu | null = null;
    static get contextMenu() { return this._contextMenu; }
    static set contextMenu(value) {
        if (this.contextMenu === value) return;
        if (this._contextMenu) document.body.removeChild(this._contextMenu.elem);
        this._contextMenu = value;
        if (this._contextMenu) document.body.appendChild(this._contextMenu.elem);
    }
    /** Place the static context menu at this location on screen. */
    static placeContextMenu(place: util.VectorLike): Menu | false {
        let pos = new Vec2(place);
        if (this._contextMenu == null) return false;
        this._contextMenu.elem.style.left = pos.x+"px";
        this._contextMenu.elem.style.top = pos.y+"px";
        setTimeout(() => {
            if (this._contextMenu == null) return;
            this._contextMenu.fix();
        }, 10);
        return this._contextMenu;
    }
    static {
        document.body.addEventListener("click", e => {
            if (this._contextMenu == null) return;
            if (!(e.target instanceof HTMLElement)) return;
            if (this._contextMenu.elem.contains(e.target) && e.target.classList.contains("blocking")) return;
            this.contextMenu = null;
        }, { capture: true });
    }

    readonly items;

    readonly elem;

    constructor() {
        super();

        this.items = new MenuItemList(this);

        this.elem = document.createElement("div");
        this.elem.classList.add("contextmenu");
    }

    /** Fixes positioning of this menu. Essentially pushes the context menu out of the borders of the window if necessary. */
    fix(): void {
        this.elem.style.transform = "";
        this.elem.offsetWidth; // force reflow

        let rect = this.elem.getBoundingClientRect();
        let shiftX = 0, shiftY = 0;

        if (rect.right > window.innerWidth) shiftX = window.innerWidth-rect.right;
        if (rect.left < 0) shiftX = 0-rect.left;
        if (rect.bottom > window.innerHeight) shiftY = window.innerHeight-rect.bottom;
        if (rect.top < 0) shiftY = 0-rect.top;

        this.elem.style.transform = "translate("+shiftX+"px, "+shiftY+"px)";
    }
    /** Formats this menu by hiding repeated dividers and recursively formatting. */
    format(): void {
        this.elem.innerHTML = "";

        let items = this.items.list;
        let prevItem: MenuItem | null = null;

        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            if (item.type === "separator") {
                if (!prevItem || prevItem.type === "separator")
                    return;
            } else if (item.role) return;
            this.elem.appendChild(item.elem);
            prevItem = item;
        }

        if (prevItem == null) return;
        if (prevItem.type === "separator") return;
        this.elem.removeChild(prevItem.elem);
    }

    /** Generates a serializable object from this menu. */
    toObj(): MenuData {
        return this.items.list
            .filter(item => item.exists && item.type !== "input")
            .map(item => item.toObj());
    }
    /** Generates a Menu from a serializable object. */
    static fromObj(menuData: MenuData) {
        let menu = new Menu();
        menu.items.list = menuData.map(menuItemData => MenuItem.fromObj(menuItemData));
        return menu;
    }

    /** Builds a list of menu items each with a specific role and matching id. */
    static buildRoleItems(...roles: string[]): MenuItem[] {
        return roles.map(role => {
            let item = new MenuItem();
            item.role = role;
            if (item.role) item.id = item.role;
            return item;
        });
    }

    /** Builds menu items associated with information about this app. */
    static buildAboutItems(): MenuItem[] {
        let item = new MenuItem("About Peninsula "+lib.getAppName(window.agent().name));
        item.id = "about";
        return [item];
    }
    /** Builds menu items associated with settings. */
    static buildSettingsItems(): MenuItem[] {
        let item = new MenuItem("Settings", "settings-outline");
        item.id = "settings";
        item.accelerator = "CmdOrCtrl+,";
        return [item];
    }
    /** Builds menu items associated with hiding windows. */
    static buildHideItems(): MenuItem[] { return this.buildRoleItems("hide", "hideOthers", "unhide"); }
    /** Builds menu items associated with qutting the app. */
    static buildQuitItems(): MenuItem[] { return this.buildRoleItems("quit"); }
    /** Builds menu items associated with closing windows.  */
    static buildCloseItems(): MenuItem[] { return this.buildRoleItems("close"); }
    /** Builds menu items associated with undos and redos. */
    static buildUndoRedoItems(): MenuItem[] { return this.buildRoleItems("undo", "redo"); }
    /** Builds menu items associated with copy and pasting. */
    static buildCutCopyPasteItems(): MenuItem[] { return this.buildRoleItems("cut", "copy", "paste"); }
    /** Builds menu items associated with fullscreen mode. */
    static buildFullscreenItems(): MenuItem[] { return this.buildRoleItems("togglefullscreen"); }
    /** Builds menu items associated with miscellaneous window controls. */
    static buildWindowItems(): MenuItem[] { return this.buildRoleItems("minimize", "zoom"); }
    /** Builds menu items associated with window movements. */
    static buildFrontItems(): MenuItem[] { return this.buildRoleItems("front"); }
    /** Builds menu items associated with resource location and help. */
    static buildHelpItems(): MenuItem[] {
        let items = [];
        let item = new MenuItem("Documentation...", "document-text-outline");
        items.push(item);
        item.id = "documentation";
        items.push(...["Github Repository", "Open Database", "Scout URL"].map((label, i) => {
            let item = new MenuItem(label);
            item.id = ["repo", "db-host", "scout-url"][i];
            return item;
        }));
        return items;
    }
    /** Build menu items associated with window reloading. */
    static buildReloadItems(): MenuItem[] {
        let item = new MenuItem("Reload");
        item.id = "reload";
        item.accelerator = "CmdOrCtrl+R";
        return [item];
    }
    /** Build menu items associated with spawning more windows and features. */
    static buildSpawnItems(): MenuItem[] {
        let item = new MenuItem("Features...");
        item.id = "spawn";
        item.menu.items.addMultiple(...lib.APPFEATURES.map((name, i) => {
            let subitem = new MenuItem(lib.getAppName(name));
            subitem.id = "spawn:"+name;
            subitem.accelerator = "CmdOrCtrl+"+(i+1);
            return subitem;
        }));
        return [item];
    }
    /** Build menus associated with developer tools. */
    static buildDevToolsItems(): MenuItem[] { return this.buildRoleItems("toggledevtools"); }
    /** Build the main menu of the app. Includes many crucial resources and commands. */
    static buildMainMenu(): Menu {
        let menu = new Menu();
        let items = [
            ...this.buildAboutItems(),
            new MenuDivider(),
            ...this.buildSettingsItems(),
            new MenuDivider(),
            ...this.buildHideItems(),
            new MenuDivider(),
            ...this.buildQuitItems(),
        ];
        menu.items.addMultiple(...items);
        return menu;
    }
    /** Builds the file menu of the app. Includes many file or project creation or deletion commands. */
    static buildFileMenu(): Menu {
        let menu = new Menu();
        let items = [
            ...this.buildReloadItems(),
            ...this.buildSpawnItems(),
            new MenuDivider(),
            ...this.buildCloseItems(),
        ];
        menu.items.addMultiple(...items);
        return menu;
    }
    /** Builds the edit menu of the app. Includes many file and project editing commands. */
    static buildEditMenu(): Menu {
        let menu = new Menu();
        let items = [
            ...this.buildUndoRedoItems(),
            new MenuDivider(),
            ...this.buildCutCopyPasteItems(),
        ];
        menu.items.addMultiple(...items);
        return menu;
    }
    /** Builds the view menu of the app. Includes many display or appearance related commands. */
    static buildViewMenu(): Menu {
        let menu = new Menu();
        let items = [
            ...this.buildFullscreenItems(),
        ];
        menu.items.addMultiple(...items);
        return menu;
    }
    /** Builds the window menu of the app. Includes many window-related (such as closing, fullscreen, etc) commands. */
    static buildWindowMenu(): Menu {
        let agent = window.agent();
        let menu = new Menu();
        let items = [
            ...this.buildWindowItems(),
            ...this.buildDevToolsItems(),
        ];
        if ((typeof(agent.os) === "object") && (agent.os.platform == "darwin"))
            items.splice(2, 0, new MenuDivider(), ...this.buildFrontItems(), new MenuDivider());
        menu.items.addMultiple(...items);
        return menu;
    }
    /** Builds the help menu of the app. Includes helpful resources, and on Mac, defaults to having a search bar. */
    static buildHelpMenu(): Menu {
        let menu = new Menu();
        let items = [
            ...this.buildHelpItems(),
        ];
        menu.items.addMultiple(...items);
        return menu;
    }
    /** Builds most of menu, including all submenus such as file, edit, view, etc. This excludes the main menu. */
    static buildMenu(): Menu {
        let menu = new Menu();
        let menus = [
            this.buildFileMenu(),
            this.buildEditMenu(),
            this.buildViewMenu(),
            this.buildWindowMenu(),
            this.buildHelpMenu(),
        ];
        menu.items.addMultiple(...menus.map((submenu, i) => {
            let name = ["file", "edit", "view", "window", "help"][i];
            let item = new MenuItem(util.formatText(name));
            item.id = "menu:"+name;
            if (name == "help") item.role = "help";
            item.menu.items.addMultiple(...submenu.items.list);
            return item;
        }));
        return menu;
    }
    /** Builds the entirety of the menu, including all submenus such as file, edit, view, etc. This includes the main menu. */
    static buildWholeMenu(name: string = ""): Menu {
        let menu = new Menu();
        let item = new MenuItem((name.length > 0) ? lib.getAppName(name) : "Peninsula", "navigate");
        item.id = "menu:main";
        item.menu.items.addMultiple(...this.buildMainMenu().items.list);
        menu.items.addMultiple(
            item,
            ...this.buildMenu().items.list,
        );
        return menu;
    }
}
/** An item in a Menu object */
export class MenuItem extends util.Target {
    private _id: string;

    private _role: string | null;
    private _type: string | null;
    private _label: string | null;
    private _accelerator: string | null;
    private _enabled: boolean;
    private _visible: boolean;
    private _checked: boolean;
    private _exists: boolean;
    private _menu: Menu;

    readonly elem;
    readonly eIcon;
    readonly eLabel;
    readonly eAccelerator;
    readonly eSubIcon;
    readonly eInput;

    constructor(label: string | null = null, icon: string | null = null) {
        super();

        this._id = util.jargonBase64(64);

        this._role = null;
        this._type = null;
        this._label = null;
        this._accelerator = null;
        this._enabled = true;
        this._visible = true;
        this._checked = false;
        this._exists = true;
        this._menu = new Menu();
        this.menu.addHandler("change", (attribute: string, from: any, to: any) => this.change("menu."+attribute, from, to));

        this.elem = document.createElement("div");
        this.elem.classList.add("item");

        this.eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.eIcon.classList.add("icon");

        this.eLabel = document.createElement("div");
        this.elem.appendChild(this.eLabel);
        this.eLabel.classList.add("label");

        this.eAccelerator = document.createElement("div");
        this.elem.appendChild(this.eAccelerator);
        this.eAccelerator.classList.add("accelerator");

        this.eSubIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eSubIcon);
        this.eSubIcon.classList.add("sub");
        this.eSubIcon.name = "chevron-forward";

        this.eInput = document.createElement("input");
        this.elem.appendChild(this.eInput);
        this.eInput.classList.add("blocking");

        this.elem.appendChild(this.menu.elem);

        this.elem.addEventListener("mouseenter", e => setTimeout(() => this.fix(), 10));
        this.elem.addEventListener("click", e => {
            if (this.type === "input") return;
            if (this.disabled) return;
            e.stopPropagation();
            this.post("trigger", e);
        });
        this.eInput.addEventListener("change", e => {
            if (this.type !== "input") return;
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

    get id() { return this._id; }
    set id(value) {
        if (this.id === value) return;
        this.change("id", this.id, this._id=value);
    }

    get role() { return this._role; }
    set role(value) {
        if (this.role === value) return;
        this.change("role", this.role, this._role=value);
        if (this.role == null) return;
        (async () => {
            let prevRole = this.role;
            let label = util.castString(await window.api.send("menu-role-label", prevRole));
            if (this.role !== prevRole) return;
            this.eLabel.textContent = label;
        })();
        this.check();
    }
    get type() { return this._type; }
    set type(value) {
        if (this.type === value) return;
        this.change("type", this.type, this._type=value);

        if (this.type === "separator")
            this.elem.classList.add("divider");
        else this.elem.classList.remove("divider");

        if (this.type === "input")
            this.elem.classList.add("input");
        else this.elem.classList.remove("input");

        this.check();
    }
    get label() { return this._label; }
    set label(value) {
        if (this.label === value) return;
        this.change("label", this.label, this._label=value);
        if (this.role == null) {
            this.eLabel.textContent = this.eInput.placeholder = util.castString(this.label);
            return;
        }
        (async () => {
            let prevRole = this.role;
            let label = util.castString(await window.api.send("menu-role-label", prevRole));
            if (this.role !== prevRole) return;
            this.eLabel.textContent = this.eInput.placeholder = label;
        })();
        this.check();
    }
    get accelerator() { return this._accelerator; }
    set accelerator(value) {
        if (this.accelerator === value) return;
        this.change("accelerator", this.accelerator, this._accelerator=value);
        let parts = (this.accelerator == null) ? [] : this.accelerator.split("+");
        parts = parts.map(part => {
            if (["CommandOrControl", "CmdOrCtrl", "Command", "Cmd"].includes(part)) return "⌘";
            if (["Control", "Ctrl"].includes(part)) return "⌃";
            if (part === "Alt") return "⎇";
            if (part === "Option") return "⌥";
            if (part === "Shift") return "⇧";
            if (part === "Super") return "❖";
            if (part === "Meta") return "⌘";
            if (part === "Plus") return "+";
            if (part === "Tab") return "⇥";
            if (part === "Backspace") return "⌫";
            if (part === "Delete") return "⌦";
            if (["Return", "Enter"].includes(part)) return "↩︎";
            if (part === "Up") return "▲";
            if (part === "Down") return "▼";
            if (part === "Left") return "◀︎";
            if (part === "Right") return "▶︎";
            if (part === "Home") return "↑";
            if (part === "End") return "↓";
            if (part === "PageUp") return "↑";
            if (part === "PageDown") return "↓";
            if (["Escape", "Esc"].includes(part)) return "⎋";
            if (part === "numdec") return ".";
            if (part === "numadd") return "+";
            if (part === "numsub") return "-";
            if (part === "nummult") return "*";
            if (part === "numdiv") return "/";
            for (let i = 0; i < 10; i++)
                if (part === "num"+i)
                    return String(i);
            return part;
        });
        this.eAccelerator.textContent = parts.join("");
        this.eAccelerator.style.display = (this.eAccelerator.textContent.length > 0) ? "" : "none";
        this.check();
    }
    get enabled() { return this._enabled; }
    set enabled(value) {
        if (this.enabled === value) return;
        this.change("enabled", this.enabled, this._enabled=value);
        if (this.disabled)
            this.elem.classList.add("disabled");
        else this.elem.classList.remove("disabled");
        this.eInput.disabled = this.disabled;
        this.check();
    }
    get disabled() { return !this.enabled; }
    set disabled(value) { this.enabled = !value; }
    get visible() { return this._visible; }
    set visible(value) {
        if (this.visible === value) return;
        this.change("visible", this.visible, this._visible=value);
        this.check();
    }
    get hidden() { return !this.visible; }
    set hidden(value) { this.visible = !value; }
    get checked() { return this._checked; }
    set checked(value) {
        if (this.checked === value) return;
        this.change("checked", this.checked, this._checked=value);
        this.check();
    }
    get unchecked() { return !this.checked; }
    set unchecked(value) { this.checked = !value; }
    get exists() { return this._exists; }
    set exists(value) {
        if (this.exists === value) return;
        this.change("exists", this.exists, this._exists=value);
        this.check();
    }

    /** Checks some properties and updates display. */
    private check(): void {
        if (this.visible && this.role == null)
            this.elem.style.display = "";
        else this.elem.style.display = "none";
        if (this.type === "checkbox") this.icon = this.checked ? "checkmark" : "";
        else if (this.type === "radio") this.icon = this.checked ? "ellipse" : "ellipse-outline";
        this.post("format");
    }
    
    get menu() { return this._menu; }
    set menu(value) { this.menu.items.copy(value.items); }

    /** Gets a menu item by their id. */
    getItemById(id: string): MenuItem | null {
        if (this.id === id) return this;
        return this.menu.items.getItemById(id);
    }

    get icon() { return this.eIcon.name || null; }
    set icon(value) {
        this.eIcon.removeAttribute("src");
        if (this.icon === value) return;
        this.eIcon.name = value || undefined;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(value) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", util.castString(value));
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }

    /** Fixes positioning of this menu item's submenu. */
    fix(): void { return this.menu.fix(); }
    /** Formats this menu item's submenu. */
    format(): void { return this.menu.format(); }

    /** Generates a serializable object from this menu item. */
    toObj(): MenuItemData {
        let data: MenuItemData = { id: this.id };
        if (this.role != null) data.role = this.role;
        if (this.type != null) data.type = this.type;
        if (this.label != null) data.label = this.label;
        if (this.accelerator != null) data.accelerator = this.accelerator;
        data.enabled = this.enabled;
        data.visible = this.visible;
        data.checked = this.checked;
        let submenu = this.menu.toObj();
        if (submenu.length > 0) data.submenu = submenu;
        return data;
    }
    /** Generates a MenuItem from a serializable object. */
    static fromObj(data: MenuItemData): MenuItem {
        if (data === "separator") return this.fromObj({ type: "separator" });

        let item = new MenuItem();

        if (data.id) item.id = data.id;

        item.role = data.role || null;
        item.type = data.type || null
        item.label = data.label || null;
        item.accelerator = data.accelerator || null;

        item.enabled = ("enabled" in data) ? !!data.enabled : true;
        item.visible = ("visible" in data) ? !!data.visible : true;
        item.checked = ("checked" in data) ? !!data.checked : false;

        if (data.submenu) item.menu = Menu.fromObj(data.submenu);

        if (data.click) {
            let click = data.click;
            item.addHandler("trigger", (e: MouseEvent) => click(e));
        }

        return item;
    }
}
/** A simple MenuItem subclass that defines the type to be "separator" */
export class MenuDivider extends MenuItem {
    constructor() {
        super();

        this.type = "separator";
    }
}

/** A speck of the Parallax background display */
export class ParallaxSpeck extends util.Target {
    static sphereGeometryCache: { [key:number]: THREE.SphereGeometry } = {};
    static cylinderGeometryCache: { [key:number]: { [key:number]: THREE.CylinderGeometry } } = {};
    static materials: THREE.MeshBasicMaterial[] = [
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
    ];

    private _type: number;
    private _radius: number;
    private _length: number;

    private _vel: util.vec3;
    private _velConstant: util.vec3;

    private sphereGeometry: THREE.SphereGeometry | null;
    private cylinderGeometry: THREE.CylinderGeometry | null;
    private material: THREE.Material | null;
    private headMesh: THREE.Mesh | null;
    private tailMesh: THREE.Mesh | null;
    private midMesh: THREE.Mesh | null;
    private _object: THREE.Object3D | null;

    constructor(type: number, radius: number, length: number) {
        super();

        this._type = 0;
        this._radius = 0;
        this._length = 0;

        this._vel = [0, 0, 0];
        this._velConstant = [0, 0, 0];

        this.sphereGeometry = this.cylinderGeometry = this.material = this.headMesh = this.tailMesh = this.midMesh = this._object = null;

        this.type = type;
        this.radius = radius;
        this.length = length;

        let prevVel: util.vec3 = [NaN, NaN, NaN];

        this.addHandler("update", (delta: number) => {
            let currVel: util.vec3 = [
                this.velX+this.velConstantX,
                this.velY+this.velConstantY,
                this.velZ+this.velConstantZ,
            ];
            let changed = false;
            for (let i = 0; i < 3; i++) {
                if (prevVel[i] === currVel[i]) continue;
                prevVel[i] = currVel[i];
                changed = true;
            }
            let distance = Math.sqrt(currVel[0]**2 + currVel[1]**2 + currVel[2]**2);
            this.length = Math.min(2.5, distance * 2.5);
            if (this.object) {
                this.object.position.set(
                    this.object.position.x+currVel[0]*(delta/5),
                    this.object.position.y+currVel[1]*(delta/5),
                    this.object.position.z+currVel[2]*(delta/5),
                );
                if (changed) this.object.lookAt(
                    this.object.position.x+currVel[0],
                    this.object.position.y+currVel[1],
                    this.object.position.z+currVel[2],
                );
            }
            if (this.headMesh) this.headMesh.position.setZ(+this.length/2);
            if (this.tailMesh) this.tailMesh.position.setZ(-this.length/2);
            let p = 0.99 ** (5/delta);
            this.velX *= p;
            this.velY *= p;
            this.velZ *= p;
        });
    }

    /** Checks properties and updates ThreeJS objects appropriately. */
    private check(): void {
        if (!Parallax.Speck.sphereGeometryCache[this.radius])
            Parallax.Speck.sphereGeometryCache[this.radius] = new THREE.SphereGeometry(this.radius, 8, 8);
        if (!Parallax.Speck.cylinderGeometryCache[this.radius])
            Parallax.Speck.cylinderGeometryCache[this.radius] = {};
        if (!Parallax.Speck.cylinderGeometryCache[this.length])
            Parallax.Speck.cylinderGeometryCache[this.radius][this.length] = new THREE.CylinderGeometry(this.radius, this.radius, this.length, 8, 1, true);
        this.sphereGeometry = Parallax.Speck.sphereGeometryCache[this.radius];
        this.cylinderGeometry = Parallax.Speck.cylinderGeometryCache[this.radius][this.length];
        this.material = Parallax.Speck.materials[this.type];
        if (!this.headMesh) this.headMesh = new THREE.Mesh(this.sphereGeometry, this.material);
        if (!this.tailMesh) this.tailMesh = new THREE.Mesh(this.sphereGeometry, this.material);
        if (!this.midMesh) {
            this.midMesh = new THREE.Mesh(this.cylinderGeometry, this.material);
            this.midMesh.rotateX(Math.PI/2);
        }
        this.headMesh.geometry = this.tailMesh.geometry = this.sphereGeometry;
        this.midMesh.geometry = this.cylinderGeometry;
        this.headMesh.material = this.tailMesh.material = this.midMesh.material = this.material;
        if (!this.object) this._object = new THREE.Object3D();
        if (!this.object) return;
        this.object.add(this.headMesh);
        this.object.add(this.tailMesh);
        this.object.add(this.midMesh);
    }

    get type() { return this._type; }
    set type(value) {
        value = Math.min(Parallax.Speck.materials.length-1, Math.max(0, Math.round(value)));
        if (this.type === value) return;
        this._type = value;
        this.check();
    }

    get radius() { return this._radius; }
    set radius(value) {
        value = Math.max(0, Math.floor(value*100)/100);
        if (this.radius === value) return;
        this._radius = value;
        this.check();
    }
    get length() { return this._length; }
    set length(value) {
        value = Math.max(0, Math.floor(value*100)/100);
        if (this.length === value) return;
        this._length = value;
        this.check();
    }

    get velX() { return this._vel[0]; }
    set velX(value) { this._vel[0] = value; }
    get velY() { return this._vel[1]; }
    set velY(value) { this._vel[1] = value; }
    get velZ() { return this._vel[2]; }
    set velZ(value) { this._vel[2] = value; }
    get velConstantX() { return this._velConstant[0]; }
    set velConstantX(value) { this._velConstant[0] = value; }
    get velConstantY() { return this._velConstant[1]; }
    set velConstantY(value) { this._velConstant[1] = value; }
    get velConstantZ() { return this._velConstant[2]; }
    set velConstantZ(value) { this._velConstant[2] = value; }

    get object() { return this._object; }

    update(delta: number): void { this.post("update", delta); }
}
/**  */
export class Parallax extends util.Target {
    static readonly Speck: typeof ParallaxSpeck = ParallaxSpeck;

    readonly canvas: HTMLCanvasElement;
    private _quality: number;
    readonly size;
    private _runCount: number;
    private _type: string | null;

    readonly scene: THREE.Scene;
    readonly camera: THREE.PerspectiveCamera;

    readonly renderer: THREE.WebGLRenderer;

    private _speed: number;

    constructor(canvas: HTMLCanvasElement) {
        super();

        this.canvas = canvas;
        this._quality = 2;
        this.size = new Vec2([300, 150]);
        this.size.addHandler("change", (attribute: string, from: any, to: any) => this.change("size."+attribute, from, to));
        this._runCount = 1;
        this._type = null;

        this.scene = new THREE.Scene();
        const fog = this.scene.fog = new THREE.Fog(0x000000, 7.5, 10);
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, powerPreference: "default" });

        const hemLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
        this.scene.add(hemLight);

        const specks: ParallaxSpeck[] = [];

        let spawn = 0;

        const update = () => {
            const w = Math.max(0, Math.ceil(this.w));
            const h = Math.max(0, Math.ceil(this.h));
            this.renderer.setSize(w, h);
            this.renderer.setPixelRatio(this.quality);
            if (this.camera.aspect !== w/h) {
                this.camera.aspect = w/h;
                this.camera.updateProjectionMatrix();
            }
        };
        if (this.canvas.parentElement)
            new ResizeObserver(update).observe(this.canvas.parentElement);
        this.addHandler("change-quality", update);
        this.addHandler("change-size.x", update);
        this.addHandler("change-size.y", update);
        update();

        this._speed = 0;

        this.addHandler("update", (delta: number) => {
            const height = 2 * Math.tan((this.camera.fov*(Math.PI/180))/2) * this.camera.near;
            const width = height * this.camera.aspect;

            for (let i = 0; i < this.runCount; i++) {
                if (specks.length < 1000) {
                    while (spawn < 0) {
                        if (this.type === "july4") {

                            spawn += util.lerp(1, 10, Math.random());

                            let radii = [0.02, 0.015, 0.01];
                            let pos = new Vec3([util.lerp(-5, +5, Math.random()), util.lerp(-5, +5, Math.random()), -5]);

                            for (let i = 0; i < 20; i++) {
                                let azimuth = util.lerp(0, 360, Math.random());
                                let elevation = util.lerp(0, 360, Math.random());
                                let xz = Vec2.dir(azimuth);
                                let y = Vec2.dir(elevation);
                                xz.imul(y.x);
                                let magnitude = new Vec3([xz.x, y.y, xz.y])
                                    .imul(util.lerp(0.05, 0.15, Math.random()));
                                
                                const speck = new Parallax.Speck(
                                    Math.floor(Parallax.Speck.materials.length*Math.random()),
                                    util.choose(radii), 0,
                                );
                                if (speck.object) {
                                    this.scene.add(speck.object);
                                    speck.object.position.set(...pos.xyz);
                                }

                                [speck.velX, speck.velY, speck.velZ] = magnitude.xyz;

                                specks.push(speck);

                                speck.addHandler("update", (delta: number) => {
                                    speck.velY -= 0.001 * (delta/5);
                                    if (!speck.object) return;
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

                            let pos;
                            do {
                                pos = new Vec2([Math.random(), Math.random()]).map(v => util.lerp(-15, +15, v));
                            } while (Math.abs(pos.x) < width && Math.abs(pos.y) < height);
                            
                            const speck = new Parallax.Speck(
                                Math.floor(Parallax.Speck.materials.length*Math.random()),
                                util.choose(radii), 0,
                            );
                            if (speck.object) {
                                this.scene.add(speck.object);
                                speck.object.position.set(pos.x, pos.y, -15);
                            }

                            specks.push(speck);

                            speck.addHandler("update", (delta: number) => {
                                speck.velX = speck.velY = speck.velZ = 0;
                                speck.velConstantX = speck.velConstantY = 0;
                                speck.velConstantZ = this.speed;
                                if (!speck.object) return;
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

                    if (this.type == "july4")
                        spawn -= 0.1;
                    else spawn -= 2*this.speed;
                }
                [...specks].forEach(speck => speck.update(delta));
            }

            let colorW = PROPERTYCACHE.getColor("--v8");
            let colorA = PROPERTYCACHE.getColor("--a");
            let colorV = PROPERTYCACHE.getColor("--v2");
            Parallax.Speck.materials[0].color.set(colorW.toHex(false));
            Parallax.Speck.materials[1].color.set(colorA.toHex(false));
            fog.color.set(colorV.toHex(false));
            
            this.renderer.render(this.scene, this.camera);
        });
    }

    get quality() { return this._quality; }
    set quality(value) {
        value = Math.max(1, value);
        if (this.quality === value) return;
        this.change("quality", this.quality, this._quality=value);
    }
    get w() { return this.size.x; }
    set w(value) { this.size.x = value; }
    get h() { return this.size.y; }
    set h(value) { this.size.y = value; }
    get runCount() { return this._runCount; }
    set runCount(value) {
        value = Math.round(Math.max(0, value));
        if (this.runCount === value) return;
        this.change("runCount", this.runCount, this._runCount=value);
    }
    get type() { return this._type; }
    set type(value) {
        if (this.type === value) return;
        this.change("type", this.type, this._type=value);
    }

    get speed() { return this._speed; }
    set speed(value) {
        value = Math.max(0, value);
        if (this.speed === value) return;
        this.change("speed", this.speed, this._speed=value);
    }

    update(delta: number): void { this.post("update", delta); }
}

/** A class which builds something similar to a file explorer */
export class Explorer extends util.Dict<ExplorerNode, ExplorerNode | string> {
    protected static SORT = false;

    private _keys: string[];
    private _values: ExplorerNode[];

    readonly elem;

    constructor() {
        super();

        this._keys = [];
        this._values = [];

        this.elem = document.createElement("div");
        this.elem.classList.add("explorer");
    }

    convert(value: string | ExplorerNode): ExplorerNode | false {
        if (typeof(value) === "string") {
            let newValue = this.get(value);
            return newValue ?? false;
        }
        return value;
    }
    protected addInternal(value: ExplorerNode): void {
        this._dict.set(value.name, value);
        this._keys.push(value.name);
        this._values.push(value);
    }
    protected remInternal(value: ExplorerNode): void {
        this._dict.delete(value.name);
        this._keys.splice(this._keys.indexOf(value.name), 1);
        this._values.splice(this._values.indexOf(value), 1);
    }
    protected hasInternal(value: ExplorerNode): boolean { return super.hasInternal(value) && this.keys.includes(value.name); }
    protected addCallback(value: ExplorerNode): void {
        value.addLinkedHandler(this, "trigger", (e: MouseEvent, pth: string) => this.post("trigger", e, pth));
        value.addLinkedHandler(this, "trigger2", (e: MouseEvent, pth: string) => this.post("trigger2", e, pth));
        value.addLinkedHandler(this, "contextmenu", (e: MouseEvent, pth: string) => this.post("contextmenu", e, pth));
        value.addLinkedHandler(this, "drag", (e: MouseEvent, pth: string) => this.post("drag", e, pth));
        this.elem.appendChild(value.elem);
        value.onAdd();
    }
    protected remCallback(value: ExplorerNode): void {
        value.onRem();
        this.elem.removeChild(value.elem);
        value.clearLinkedHandlers(this, "trigger");
        value.clearLinkedHandlers(this, "trigger2");
        value.clearLinkedHandlers(this, "contextmenu");
        value.clearLinkedHandlers(this, "drag");
    }
    addFinal(): void { this.format(); }
    remFinal(): void { this.format(); }

    get nodes() { return this.keys; }
    get nodeObjects() { return this.values; }
    get nNodes() {
        let n = 1;
        this.nodeObjects.forEach(node => (n += node.explorer.nNodes));
        return n;
    }
    /** Looks up the node associated with this path. */
    lookup(pth: string): ExplorerNode | null {
        let splitPth = util.splitPath(pth);
        let explorer: Explorer = this;
        while (splitPth.length > 0) {
            let name = splitPth.shift() as string;
            if (!explorer.has(name)) return null;
            let node = explorer.get(name) as ExplorerNode;
            if (splitPth.length <= 0) return node;
            explorer = node.explorer;
        }
        return null;
    }

    get showHidden() { return this.elem.classList.contains("hidden"); }
    set showHidden(value) {
        if (this.showHidden === value) return;
        if (value)
            this.elem.classList.add("hidden");
        else this.elem.classList.remove("hidden");
        this.change("showHidden", !value, value);
    }

    /** Formats this explorer by conditionally sorting the nodes and recursively formatting them as well. */
    format(): void {
        if ((this.constructor as typeof Explorer).SORT)
            this._values.sort((nodeA, nodeB) => util.compareString(nodeA.name, nodeB.name));
        
        this._values.forEach((node, i) => {
            node.elem.style.order = String(i);
            node.format();
        });
        this._keys = this._values.map(node => node.name);
    }
}
export type ExplorerNodeLike = {
    name: string,

    nodeObjects: ExplorerNodeLike[],

    info: string | null,
    value: any,
    tooltip: string | null,

    dump?: (enode: ExplorerNode) => void,
};
/** A node of the Explorer class */
export class ExplorerNode extends util.Target {
    static EXPLORER: typeof Explorer = Explorer;

    /** A double DFS algorithm to dually traverse a "model" and the actual explorer tree, syncing the explorer tree with that model. */
    static doubleTraverse(
        nodeArr: ExplorerNodeLike[], enodeArr: ExplorerNode[],
        addFunc: (...enodes: ExplorerNode[]) => void,
        remFunc: (...enodes: ExplorerNode[]) => void,
        dumpFunc: ((node: ExplorerNodeLike, enode: ExplorerNode) => void) | null = null,
    ) {
        let nodeMap: util.StringMap<ExplorerNodeLike> = {};
        let enodeMap: util.StringMap<ExplorerNode> = {};

        nodeArr.forEach(node => {
            if (!node.name) return;
            nodeMap[node.name] = node;
        });
        enodeArr.forEach(enode => {
            enodeMap[enode.name] = enode;
        });

        let enodesToAdd = [];
        for (let name in nodeMap) {
            let node = nodeMap[name];
            if (name in enodeMap) continue;
            let enode = enodeMap[node.name] = new this(node.name);
            enodesToAdd.push(enode);
        }
        addFunc(...enodesToAdd);

        let enodesToRem = [];
        for (let name in enodeMap) {
            let enode = enodeMap[name];
            if (name in nodeMap) continue;
            enodesToRem.push(enode);
        }
        remFunc(...enodesToRem);

        for (let name in nodeMap) {
            let node = nodeMap[name];
            let enode = enodeMap[name];
            if (enode.isOpen)
                this.doubleTraverse(
                    node.nodeObjects,
                    enode.explorer.nodeObjects,
                    (...en) => enode.explorer.addMultiple(...en),
                    (...en) => enode.explorer.remMultiple(...en),
                    dumpFunc,
                );
            else enode.explorer.clear();
            enode.info = node.info;
            enode.value = node.value;
            enode.tooltip = node.tooltip;
            if (node.dump) node.dump(enode);
            if (dumpFunc) dumpFunc(node, enode);
        }
    }

    readonly explorer: Explorer;

    readonly name: string;
    readonly isHidden: boolean;
    private _info: string | null;
    private _value: any;
    private _showValue: boolean;

    readonly elem;
    readonly eDisplay;
    readonly eTooltip;
    readonly eMain;
    readonly eIcon;
    readonly eName;
    readonly eTag;
    readonly eValueBox;
    readonly eValue;
    readonly eSide;

    constructor(name: string) {
        super();

        this.explorer = new (this.constructor as typeof ExplorerNode).EXPLORER();
        this.explorer.addHandler("trigger", (e: MouseEvent, pth: string) => {
            if (this.name.length > 0) pth = this.name+"/"+pth;
            this.post("trigger", e, pth);
        });
        this.explorer.addHandler("trigger2", (e: MouseEvent, pth: string) => {
            if (this.name.length > 0) pth = this.name+"/"+pth;
            this.post("trigger2", e, pth);
        });
        this.explorer.addHandler("contextmenu", (e: MouseEvent, pth: string) => {
            if (this.name.length > 0) pth = this.name+"/"+pth;
            this.post("contextmenu", e, pth);
        });
        this.explorer.addHandler("drag", (e: MouseEvent, pth: string) => {
            if (this.name.length > 0) pth = this.name+"/"+pth;
            this.post("drag", e, pth);
        });

        this.name = name;
        this.isHidden = this.name.startsWith(".");
        this._info = null;
        this._value = null;

        this._showValue = true;

        this.elem = document.createElement("div");
        this.elem.classList.add("node");
        if (this.isHidden) this.elem.classList.add("hidden");

        this.eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.eDisplay.innerHTML = "<p-tooltip class='tog swx'></p-tooltip>";

        let enterId: NodeJS.Timer | null = null, leaveId: NodeJS.Timer | null = null;
        this.eDisplay.addEventListener("mouseenter", e => {
            if (enterId) clearTimeout(enterId);
            if (leaveId) clearTimeout(leaveId);
            enterId = setTimeout(() => {
                this.eDisplay.classList.add("active");
            }, 2000);
        });
        this.eDisplay.addEventListener("mouseleave", e => {
            if (enterId) clearTimeout(enterId);
            if (leaveId) clearTimeout(leaveId);
            leaveId = setTimeout(() => {
                this.eDisplay.classList.remove("active");
            }, 100);
        });

        this.eTooltip = this.eDisplay.children[0];

        this.eMain = document.createElement("div");
        this.eDisplay.appendChild(this.eMain);
        this.eMain.classList.add("main");

        this.eIcon = document.createElement("ion-icon");
        this.eMain.appendChild(this.eIcon);

        this.eName = document.createElement("div");
        this.eMain.appendChild(this.eName);
        this.eName.classList.add("name");
        this.eName.textContent = this.name;

        this.eTag = document.createElement("div");
        this.eMain.appendChild(this.eTag);
        this.eTag.classList.add("tag");

        this.eValueBox = document.createElement("div");
        this.eDisplay.appendChild(this.eValueBox);
        this.eValueBox.classList.add("value");
        this.eValueBox.innerHTML = "<ion-icon name='return-down-forward'></ion-icon>";

        this.eValue = document.createElement("div");
        this.eValueBox.appendChild(this.eValue);
        this.elem.appendChild(this.explorer.elem);

        this.eSide = document.createElement("button");
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

    get info() { return this._info; }
    set info(value) {
        if (this.info === value) return;
        this._info = value;
        this.eTag.textContent = util.castString(this.info);
    }

    get value() { return this._value; }
    set value(value) {
        this._value = value;
        this.updateDisplay();
    }

    /** Looks up the node associated with this path. */
    lookup(pth: string): ExplorerNode | null {
        if (pth.length <= 0) return this;
        return this.explorer.lookup(pth);
    }

    get showValue() { return this._showValue; }
    set showValue(value) {
        if (this.showValue === value) return;
        this._showValue = value;
        if (this.showValue)
            this.eValueBox.classList.add("this");
        else this.eValueBox.classList.remove("this");
        this.updateDisplay();
    }

    get icon() { return this.eIcon.name || null; }
    set icon(value) {
        this.eIcon.removeAttribute("src");
        if (this.icon === value) return;
        this.eIcon.name = value || undefined;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(value) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", util.castString(value));
    }
    /** Updates the display whenever certain attributes are changed. */
    updateDisplay() {
        if (this.showValue) this.eValue.textContent = this.value;
    }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(value) {
        if (this.isOpen === value) return;
        if (value)
            this.elem.classList.add("this");
        else this.elem.classList.remove("this");
        this.updateDisplay();
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(value) { this.isOpen = !value; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get tooltip() { return this.eTooltip.innerHTML || null; }
    set tooltip(value) { this.eTooltip.innerHTML = value ? value.replaceAll("<", "&lt").replaceAll(">", "&gt") : ""; }

    /** Formats this node by updating the display and recursively calling format. */
    format() {
        this.updateDisplay();
        this.explorer.format();
    }
}

/** An Explorer but for SourceFields only */
export class FieldExplorer extends Explorer {
    protected static SORT = true;
}
/** An ExplorerNode but for SourceFields only */
export class FieldExplorerNode extends ExplorerNode {
    private _canShowValue: boolean;

    static EXPLORER = FieldExplorer;

    static doubleTraverse(
        nodeArr: Source.Node[],
        enodeArr: ExplorerNode[],
        addFunc: (...enodes: ExplorerNode[]) => void,
        remFunc: (...enodes: ExplorerNode[]) => void,
        dumpFunc: ((node: Source.Field, enode: ExplorerNode) => void) | null = null,
    ) {
        return super.doubleTraverse(
            nodeArr.map(node => {
                node.info = node.hasField() ? node.field.type : null;
                node.value = node.hasField() ? node.field.get() : null;
                node.tooltip = node.hasField() ? lib.stringifyJSON(node.field.getMeta()) : null;
                return node;
            }),
            enodeArr,
            addFunc,
            remFunc,
            dumpFunc,
        );
    }

    constructor(name: string) {
        super(name);

        this._canShowValue = false;

        this.addHandler("trigger", (e: MouseEvent) => {
            if (!(e.target instanceof HTMLElement)) return;
            if (!this.eDisplay.contains(e.target)) return;
            if (this.isJustPrimitive || e.shiftKey) this.showValue = this.canShowValue && !this.showValue;
            else this.isOpen = !this.isOpen;
        });

        this.canShowValue = true;
    }

    get canShowValue() { return this._canShowValue; }
    set canShowValue(value) {
        if (this.canShowValue === value) return;
        this._canShowValue = value;
        this.showValue &&= this.canShowValue;
    }

    get type() { return this.info; }
    get isStruct() { return (this.type != null) && this.type.startsWith("struct:"); }
    get isArray() { return (this.type != null) && this.type.endsWith("[]"); }
    get baseType() {
        if (this.type == null) return null;
        return this.type.slice(this.isStruct ? 7 : 0, this.type.length - (this.isArray ? 2 : 0));
    }
    get isPrimitive() { return (this.type != null) && Source.Field.TYPES.includes(this.baseType) && (this.type != "json"); }
    get isJustPrimitive() { return this.isPrimitive && !this.isArray; }

    get value() {
        if (this.type == null) return this.isOpen;
        return this.isArray ? [...util.castArray(super.value)] : super.value;
    }
    set value(value) {
        value = Source.Field.ensureType(this.type, value);
        super.value = value;
    }

    updateDisplay() {
        this.icon = null;
        this.iconSrc = null;
        let display = Source.Field.getDisplay(this.type, this.value);
        if (display) {
            if ("src" in display) this.iconSrc = display.src;
            else this.icon = display.name;
            let color = util.castString(display.color);
            if (this.eIcon.style.color != color) this.eIcon.style.color = this.eValue.style.color = display.color;
        } else {
            this.icon = "";
            this.eIcon.style.color = this.eValue.style.color = "";
        }
        if (this.showValue) this.eValue.textContent = Source.Field.getRepresentation(this.value, this.type === "structschema");
    }
}

class FormFieldList extends util.List<FormField, FormField | string> {
    readonly form;
    constructor(form: Form) {
        super();
        this.form = form;
    }
    convert(value: FormField | string): FormField | false {
        if (typeof(value) === "string")
            return this.get(value) ?? false;
        return value;
    }
    protected addCallback(value: FormField): void {
        this.form.elem.appendChild(value.elem);
    }
    protected remCallback(value: FormField): void {
        this.form.elem.removeChild(value.elem);
    }

    get(i: string | number): FormField | null {
        if (typeof(i) === "string") {
            for (let actualValue of this._list)
                if (actualValue.name === i)
                    return actualValue;
            return null;
        }
        return super.get(i);
    }
}
/** A way of creating more customizable forms compared to native HTML, with a wider variety of input types */
export class Form extends util.Target {
    readonly fields;

    readonly elem;
    
    constructor() {
        super();

        this.fields = new FormFieldList(this);

        this.elem = document.createElement("div");
        this.elem.classList.add("form");

        this.isHorizontal = false;

        this.isShown = true;
    }

    get side() {
        if (this.elem.classList.contains("right")) return "right";
        if (this.elem.classList.contains("center")) return "center";
        return "left";
    }
    set side(value) {
        this.elem.classList.remove("right");
        this.elem.classList.remove("center");
        if (value === "left") return;
        if (!["right", "center"].includes(value)) return;
        this.elem.classList.add(value);
    }

    get isHorizontal() { return this.elem.classList.contains("horizontal"); }
    set isHorizontal(value) {
        if (value)
            this.elem.classList.add("horizontal");
        else this.elem.classList.remove("horizontal");
    }
    get isVertical() { return !this.isHorizontal; }
    set isVertical(value) { this.isHorizontal = !value; }

    get isShown() { return this.elem.classList.contains("show"); }
    set isShown(value) {
        if (value)
            this.elem.classList.add("show");
        else this.elem.classList.remove("show");
    }
}
/** A field of the Form class */
export class FormField extends util.Target {
    readonly name;

    private _value: any;
    private _toggleOn: boolean;

    private _disabled: boolean;
    private _toggleDisabled: boolean;

    readonly elem;
    readonly eHeader;
    readonly eName;
    readonly eType;
    readonly eToggle;
    readonly eToggleInput;
    readonly eContent;

    constructor(name: string) {
        super();

        this.name = name;

        this._value = null;
        this._toggleOn = true;

        this._disabled = true;
        this._toggleDisabled = true;

        this.elem = document.createElement("div");
        this.elem.classList.add("item");

        this.eHeader = document.createElement("div");
        this.elem.appendChild(this.eHeader);
        this.eHeader.classList.add("header");

        this.eName = document.createElement("div");
        this.eHeader.appendChild(this.eName);
        this.eName.classList.add("name");

        this.eType = document.createElement("div");
        this.eHeader.appendChild(this.eType);
        this.eType.classList.add("type");

        this.eToggle = document.createElement("label");
        this.eHeader.appendChild(this.eToggle);
        this.eToggle.classList.add("switch");
        this.eToggle.innerHTML = "<input type='checkbox'><span><ion-icon name='checkmark'></ion-icon></span>";
        this.eToggleInput = this.eToggle.children[0] as HTMLInputElement;
        this.eToggleInput.addEventListener("change", e => {
            if (this.toggleDisabled) return;
            this.toggleOn = this.eToggleInput.checked;
        });

        this.eContent = document.createElement("div");
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

    get value() { return this._value; }
    set value(value) { this.change("value", this.value, this._value=value); }

    get toggleOn() { return this._toggleOn; }
    set toggleOn(value) {
        if (this.toggleOn === value) return;
        this.change("toggleOn", this.toggleOn, this._toggleOn=value);
    }
    get toggleOff() { return !this.toggleOn; }
    set toggleOff(value) { this.toggleOn = !value; }

    get disabled() { return this._disabled; }
    set disabled(value) {
        if (this.disabled === value) return;
        this.change("disabled", this.disabled, this._disabled=value);
    }
    get enabled() { return !this.disabled; }
    set enabled(value) { this.disabled = !value; }
    disable() { return this.disabled = true; }
    enable() { return this.enabled = true; }
    get toggleDisabled() { return this._toggleDisabled; }
    set toggleDisabled(value) {
        if (this.toggleDisabled === value) return;
        this.change("toggleDisabled", this.toggleDisabled, this._toggleDisabled=value);
    }
    get toggleEnabled() { return !this.toggleDisabled; }
    set toggleEnabled(value) { this.toggleDisabled = !value; }
    disableToggle() { return this.toggleDisabled = true; }
    enableToggle() { return this.toggleEnabled = true; }

    get isHorizontal() {
        if (this.elem.classList.contains("horizontal")) return true;
        if (this.elem.classList.contains("not-horizontal")) return false;
        return null;
    }
    set isHorizontal(v) {
        if (v === true) this.elem.classList.add("horizontal");
        else this.elem.classList.remove("horizontal");
        if (v === false) this.elem.classList.add("not-horizontal");
        else this.elem.classList.remove("not-horizontal");
    }
    get isVertical() {
        let value = this.isHorizontal;
        if (value == null) return null;
        return !value;
    }
    set isVertical(value) {
        if (value != null) value = !value;
        this.isHorizontal = value;
    }

    get isShown() { return this.elem.classList.contains("show"); }
    set isShown(value) {
        if (value)
            this.elem.classList.add("show");
        else this.elem.classList.remove("show");
    }
    get isHidden() { return !this.isShown; }
    set isHidden(value) { this.isShown = !value; }
    get showHeader() { return this.eHeader.classList.contains("show"); }
    set showHeader(value) {
        if (value)
            this.eHeader.classList.add("show");
        else this.eHeader.classList.remove("show");
    }
    get showToggle() { return this.eToggle.classList.contains("show"); }
    set showToggle(value) {
        if (value)
            this.eToggle.classList.add("show");
        else this.eToggle.classList.remove("show");
    }
    get showContent() { return this.eContent.classList.contains("show"); }
    set showContent(value) {
        if (value)
            this.eContent.classList.add("show");
        else this.eContent.classList.remove("show");
    }

    get header() { return util.castString(this.eName.textContent); }
    set header(value) { this.eName.textContent = value; }
    get isSubHeader() { return this.eHeader.classList.contains("sub"); }
    set isSubHeader(value) {
        if (value)
            this.eHeader.classList.add("sub");
        else this.eHeader.classList.remove("sub");
    }
    get isHeader() { return !this.isSubHeader; }
    set isHeader(value) { this.isSubHeader = !value; }

    get isSwitch() { return this.eToggle.classList.contains("switch"); }
    set isSwitch(value) {
        if (value) {
            this.eToggle.classList.add("switch");
            this.eToggle.classList.remove("checkbox");
        } else {
            this.eToggle.classList.remove("switch");
            this.eToggle.classList.add("checkbox");
        }
    }
    get isCheckbox() { return !this.isSwitch; }
    set isCheckbox(value) { this.isSwitch = !value; }

    get type() { return util.castString(this.eType.textContent); }
    set type(value) { this.eType.textContent = value; }
}
export type FormNameValuePair = {
    name: string,
    value: any,
    sub?: FormNameValuePair[],
    click?: () => void,
} | string | null;
/** A subclass of FormField that is just a header */
export class FormHeader extends FormField {
    constructor(name: string) {
        super("§header");

        this.elem.classList.add("header");

        this.showContent = false;

        this.header = name;

        this.isHeader = true;
    }

    get value() { return null; }
    set value(value) {}
}
/** A subclass of FormField that is just a subheader */
export class FormSubHeader extends FormField {
    constructor(name: string) {
        super("§subheader");

        this.elem.classList.add("subheader");

        this.showContent = false;

        this.header = name;
        
        this.isSubHeader = true;
    }

    get value() { return null; }
    set value(value) {}
}
export type InputValueType = boolean | util.Color | Date | string | string[] | number | null;
export type FormNInputCallback = (e: Event, i: number) => void;
/** A subclass of FormField that instantiates n inputs of a specific type */
export class FormNInput extends FormField {
    private _eInputs: HTMLInputElement[];
    private hooks: Set<FormNInputCallback>[];
    private realHooks: { inputElement: HTMLInputElement, callback: (e: Event) => void }[];

    private _inputType: InputType;

    constructor(name: string, n: number, inputType: InputType) {
        super(name);

        super.value = { values: [], hasValues: [] };

        this.elem.classList.add("input");

        this._eInputs = [];
        this.hooks = [new Set()];
        this.realHooks = [];

        this._inputType = "search";

        this.addHandler("hook", () => {
            for (let i = 0; i < this.n; i++) {
                let hooks = [...this.hooks[0], ...this.hooks[i+1]];
                hooks.forEach(callback => {
                    let linkedCallback = (e: Event) => callback(e, i);
                    this.realHooks.push({ inputElement: this.eInputs[i], callback: linkedCallback });
                    this.eInputs[i].addEventListener("change", linkedCallback);
                });
            }
        });
        this.addHandler("unhook", () => {
            this.realHooks.forEach(({ inputElement, callback }) => {
                inputElement.removeEventListener("change", callback);
            });
        });

        this.addHandler("apply", () => {
            for (let i = 0; i < this.n; i++) {
                this.eInputs[i].disabled = this.disabled;
                this.eInputs[i].type = this.inputType;
                if (this.hasValue(i)) this.setInputValue(i, this.getValue(i));
                else this.eInputs[i].value = "";
            }
        });
        this.addHandler("change", () => this.apply());

        this.n = n;
        this.inputType = "text";
        this.inputType = inputType;
    }

    get value() { return Array.from(new Array(this.n).keys()).map(i => this.getValue(i)); }
    set value(value) {
        let array = util.castArray(value);
        if (array.length > this.n) array.splice(this.n);
        if (array.length < this.n) array.push(...new Array(this.n-array.length).fill(null));
        for (let i = 0; i < this.n; i++) this.setValue(i, array[i]);
    }

    get n() { return this._eInputs.length; }
    set n(value) {
        let newN = Math.round(Math.max(0, value));
        if (this.n === value) return;
        let oldN = this.n;
        this.unhook();
        this._eInputs.forEach(eInput => eInput.remove());
        this._eInputs = [];
        this.hooks = [new Set()];
        super.value.values = [];
        super.value.hasValues = [];
        for (let i = 0; i < newN; i++) {
            let eInput = document.createElement("input");
            this.eContent.appendChild(eInput);
            this._eInputs.push(eInput);
            this.hooks.push(new Set());
            super.value.values.push(this.cast(null));
            super.value.hasValues.push(true);
        }
        this.hook();
        this.change("n", oldN, newN);
    }
    get eInputs() { return [...this._eInputs]; }

    /** Unhooks defined callbacks. */
    unhook(): void { this.post("unhook"); }
    /** Hooks defined callbacks. */
    hook(): void { this.post("hook"); }
    /** Applies current values to the input elements. */
    apply(): void { this.post("apply"); }

    /** Casts a value to the type specified by the input. */
    cast(value: any): InputValueType {
        if (this.isBool) return !!value;
        if (this.isColor) return new util.Color(value);
        if (this.isDate) return new Date(value);
        if (this.isText) return util.castString(value);
        if (this.isFile) return util.castStringArray(value);
        if (this.isNum) return util.castNumber(value);
        return null;
    }
    /** Casts each of the input's values. */
    castAll(): void {
        for (let i = 0; i < this.n; i++)
            this.setValue(i, this.getValue(i));
    }
    /** Gets the input value at this index. */
    getValue(i: number): InputValueType {
        i = Math.round(i);
        if (i < 0 || i >= this.n) return null;
        return this.cast(super.value.values[i]);
    }
    /**
     * Sets the input value at this index.
     * @returns the previous value of the input
     */
    setValue(i: number, value: any): InputValueType {
        i = Math.round(i);
        if (i < 0 || i >= this.n) return null;
        let prevValue = this.getValue(i);
        value = this.cast(value);
        if (this.isBool || this.isText || this.isNum)
            if (value === super.value.values[i])
                return value;
        if (this.isColor)
            if (value.equals(super.value.values[i]))
                return value;
        if (this.isDate)
            if (value.getTime() === (this.cast(super.value.values[i]) as Date).getTime())
                return value;
        if (this.isFile)
            if (util.equals(value, super.value.values[i]))
                return value;
        super.value.values[i] = value;
        this.change("value", prevValue, value);
        return prevValue;
    }
    /** Checks if the value at this input index exists. */
    hasValue(i: number | null = null): boolean {
        if (i == null) {
            for (let i = 0; i < this.n; i++)
                if (this.hasValue(i)) return true;
            return false;
        }
        i = Math.round(i);
        if (i < 0 || i >= this.n) return false;
        return !!super.value.hasValues[i];
    }
    /** Sets if the value at this input index exists. */
    setHasValue(i: number | boolean, value: boolean | null = null): boolean {
        if (typeof(i) === "boolean" && typeof(value) === "boolean")
            throw new Error("Expected either (number, boolean) or (boolean, null) as input, not (boolean, boolean)");
        if (typeof(i) === "boolean") {
            value = i;
            for (let i = 0; i < this.n; i++)
                this.setHasValue(i, value);
            return value;
        }
        i = Math.round(i as number);
        if (i < 0 || i >= this.n) return false;
        if (super.value.hasValues[i] === value) return false;
        this.change("hasValue", super.value.hasValues[i], super.value.hasValue[i]=value);
        return !!value;
    }
    /** Gets the raw input value at this index. */
    protected getInputValue(i: number): InputValueType {
        i = Math.round(i);
        if (i < 0 || i >= this.n) return null;
        let eInput = this.eInputs[i];
        let v = null;
        if (this.isBool) v = eInput.checked;
        if (this.isColor) v = eInput.value;
        if (this.isDate) v = eInput.valueAsDate;
        if (this.isText) v = eInput.value;
        if (this.isFile) v = eInput.files;
        if (this.isNum) v = eInput.valueAsNumber;
        return this.cast(v);
    }
    /** Sets the raw input value at this index. */
    protected setInputValue(i: number, value: any): InputValueType {
        i = Math.round(i);
        if (i < 0 || i >= this.n) return null;
        let eInput = this.eInputs[i];
        let castedValue = this.cast(value);
        if (this.isBool) eInput.checked = !!castedValue;
        if (this.isColor) eInput.value = (castedValue as util.Color).toHex();
        if (this.isDate) eInput.valueAsDate = castedValue as Date;
        if (this.isText) eInput.value = util.castString(castedValue);
        if (this.isFile) {} // TODO: find a way to set files if possible
        if (this.isNum) eInput.valueAsNumber = util.castNumber(castedValue);
        return castedValue;
    }

    /** Define a hook for a specific input index. Providing an index of -1 means to apply this callback to every input. */
    defineHook(i: number, callback: FormNInputCallback): FormNInputCallback | null {
        i = Math.round(i);
        if (i < -1 || i >= this.n) return null;
        if (this.hooks[i+1].has(callback)) return callback;
        this.unhook();
        this.hooks[i+1].add(callback);
        this.hook();
        return callback;
    }
    /** Undefine (remove) a hook for a specific input index. Providing an index of -1 means remove this callback from every input. */
    undefineHook(i: number, callback: FormNInputCallback): FormNInputCallback | null {
        i = Math.round(i);
        if (i < -1 || i >= this.n) return null;
        if (!this.hooks[i+1].has(callback)) return null;
        this.unhook();
        this.hooks[i+1].delete(callback);
        this.hook();
        return callback;
    }
    /** Define a default hook, which basically sets the value to the input value. Without using this function, this input essentially has no functionality because there actually is no piping of the values from the inputs to the internal value reference. */
    defineDefaultHook(): void {
        this.defineHook(-1, (e, i) => {
            this.setValue(i, this.getInputValue(i));
        });
    }

    get inputType() { return this._inputType; }
    set inputType(value) {
        if (this.inputType === value) return;
        this.change("inputType", this.inputType, this._inputType=value);
        this.castAll();
    }
    get isBool() { return ["checkbox", "radio"].includes(this.inputType); }
    get isColor() { return ["color"].includes(this.inputType); }
    get isDate() { return ["date", "datetime-local", "month", "time", "week"].includes(this.inputType); }
    get isText() { return ["email", "password", "search", "tel", "text", "url"].includes(this.inputType); }
    get isFile() { return ["file"].includes(this.inputType); }
    get isNum() { return ["number", "range"].includes(this.inputType); }

    get focused() {
        for (let eInput of this.eInputs)
            if (document.activeElement === eInput)
                return true;
        return false;
    }
}
class FormNNumberInputTypeList extends util.List<FormNameValuePair> {
    readonly field;
    constructor(field: FormNNumberInput) {
        super();
        this.field = field;
    }
    convert(value: FormNameValuePair): FormNameValuePair | false { return value; }
    addFinal(): void { this.field.applyType(); }
    remFinal(): void { this.field.applyType(); }
}
/** A subclass of FornNInput that is guranteed to be a number */
export class FormNNumberInput extends FormNInput {
    private _step: number | null;

    readonly types;
    private _baseType: string;
    private _activeType: string;

    private _eTypeBtn: HTMLButtonElement | null;

    constructor(name: string, n: number) {
        super(name, n, "number");

        this._step = 0;

        this.types = new FormNNumberInputTypeList(this);
        this._baseType = "";
        this._activeType = "";

        this._eTypeBtn = null;


        this.defineHook(-1, (e, i) => {
            this.setValue(i, this.fix(lib.Unit.convert(this.getInputValue(i) as number, this.activeType || "#", this.baseType || "#")));
        });

        this.addHandler("apply", () => {
            for (let i = 0; i < this.n; i++) {
                if (this.step != null)
                    this.eInputs[i].step = String(this.step);
                else this.eInputs[i].removeAttribute("step");

                if (this.hasValue(i))
                    this.setInputValue(i, this.fix(lib.Unit.convert(this.getValue(i) as number, this.baseType || "#", this.activeType || "#")));
                else this.eInputs[i].value = "";
            }
        });

        this.step = null;

        this.types.list = ["#"];
        this.baseType = "#";
        this.activeType = "#";
    }

    get value() { return super.value as number[]; }
    set value(value) { super.value = value; }

    get inputType() { return super.inputType; }
    set inputType(v) {
        if (this.inputType != null) return;
        super.inputType = v;
    }

    get step() { return this._step; }
    set step(value) {
        if (this.step === value) return;
        this.change("step", this.step, this._step=value);
    }

    get baseType() { return this._baseType; }
    set baseType(value) {
        if (this.baseType === value) return;
        this.change("baseType", this.baseType, this._baseType=value);
    }
    get activeType() { return this._activeType; }
    set activeType(value) {
        if (this.activeType === value) return;
        this.change("activeType", this.activeType, this._activeType=value);
        this.applyType();
    }

    /** Applies current types to the type dropdown. */
    applyType(): void {
        this.eType.innerHTML = "";
        this._eTypeBtn = document.createElement("button");
        if (!this.eTypeBtn) return;
        this.eType.appendChild(this.eTypeBtn);
        this.eTypeBtn.classList.add("normal");
        this.eTypeBtn.textContent = this.activeType;
        this.eTypeBtn.addEventListener("click", e => {
            if (!this.eTypeBtn) return;
            e.stopPropagation();
            let item;
            let menu = new Menu();
            this.types.list.forEach(data => {
                if (data == null) return;
                item = menu.items.add(new MenuItem(
                    (typeof(data) === "string") ? data : data.name,
                    ((typeof(data) === "string") ? data : data.value) === this.activeType ? "checkmark" : "",
                )) as MenuItem;
                item.addHandler("trigger", (e: MouseEvent) => (this.activeType = ((typeof(data) === "string") ? data : data.value)));
            });
            Menu.contextMenu = menu;
            let rect = this.eTypeBtn.getBoundingClientRect();
            Menu.placeContextMenu([rect.left, rect.bottom]);
            menu.elem.style.minWidth = rect.width+"px";
        });
    }
    /** Fixes a number so that it has no rounding issues. */
    fix(value: number): number { return Math.round(value*1e6)/1e6; }

    get eTypeBtn() { return this._eTypeBtn; }
}
/** A 1 dimensional vector input form field */
export class FormInput1d extends FormNNumberInput {
    readonly vectorValue;

    constructor(name: string, value: util.VectorLike) {
        super(name, 1);

        let ignore = false;

        super.addHandler("change-value", () => {
            ignore = true;
            for (let i = 0; i < this.n; i++)
                (this.vectorValue as any)["x"[i]] = this.getValue(i);
            ignore = false;
        });

        this.vectorValue = new Vec1();
        this.vectorValue.addHandler("change", (attribute: string, from: any, to: any) => {
            if (!ignore) super.setValue("xy".indexOf(attribute), to);
            super.setHasValue("xy".indexOf(attribute), true);
        });

        this.vectorValue.set(value);
    }

    get n() { return super.n; }
    set n(value) {
        if (this.n != 0) return;
        super.n = value;
    }

    get numericalValue() { return this.hasValue(0) ? this.vectorValue.x : null; }
    set numericalValue(value) {
        if (value != null) this.vectorValue.x = value;
        this.setHasValue(0, value != null);
    }

    get value() { return super.value as util.vec1; }
    set value(value) { super.value = value; }
}
/** A 2 dimensional vector input form field */
export class FormInput2d extends FormNNumberInput {
    readonly vectorValue;

    constructor(name: string, value: util.VectorLike) {
        super(name, 2);

        let ignore = false;

        super.addHandler("change-value", () => {
            ignore = true;
            for (let i = 0; i < this.n; i++)
                (this.vectorValue as any)["xy"[i]] = this.getValue(i);
            ignore = false;
        });

        this.vectorValue = new Vec2();
        this.vectorValue.addHandler("change", (attribute: string, from: any, to: any) => {
            if (!ignore) super.setValue("xy".indexOf(attribute), to);
            super.setHasValue("xy".indexOf(attribute), true);
        });

        this.vectorValue.set(value);
    }

    get n() { return super.n ;}
    set n(v) {
        if (this.n != 0) return;
        super.n = v;
    }

    get x() { return this.vectorValue.x; }
    set x(value) { this.vectorValue.x = value; }
    get y() { return this.vectorValue.y; }
    set y(value) { this.vectorValue.y = value; }

    get value() { return super.value as util.vec2; }
    set value(value) { super.value = value; }
}
/** A 3 dimensional vector input form field */
export class FormInput3d extends FormNNumberInput {
    readonly vectorValue;

    constructor(name: string, value: util.VectorLike) {
        super(name, 3);

        super.addHandler("change-value", () => {
            for (let i = 0; i < this.n; i++)
                (this.vectorValue as any)["xyz"[i]] = this.getValue(i);
        });

        this.vectorValue = new Vec3();
        this.vectorValue.addHandler("change", (attribute: string, from: any, to: any) => {
            super.setValue("xyz".indexOf(attribute), to);
            super.setHasValue("xyz".indexOf(attribute), true);
        });

        this.vectorValue.set(value);
    }

    get n() { return super.n ;}
    set n(v) {
        if (this.n != 0) return;
        super.n = v;
    }

    get x() { return this.vectorValue.x; }
    set x(value) { this.vectorValue.x = value; }
    get y() { return this.vectorValue.y; }
    set y(value) { this.vectorValue.y = value; }
    get z() { return this.vectorValue.z; }
    set z(value) { this.vectorValue.z = value; }

    get value() { return super.value as util.vec3; }
    set value(value) { super.value = value; }
}
/** A form field text input */
export class FormTextInput extends FormNInput {
    constructor(name: string) {
        super(name, 1, "text");

        this.defineDefaultHook();

        this.eInputs.forEach(eInput => {
            eInput.autocomplete = "off";
            eInput.spellcheck = false;
        });

        this.textValue = "";

        this.type = "str";
    }

    get n() { return super.n; }
    set n(value) {
        if (this.n != 0) return;
        super.n = value;
    }

    get inputType() { return super.inputType; }
    set inputType(value) {
        if (this.inputType != null) return;
        super.inputType = value;
    }

    get textValue() { return util.castString(super.getValue(0)); }
    set textValue(value) { super.setValue(0, value); }
}
/** A form field dirent input with file choosing */
export class FormDirentInput extends FormField {
    private _dialogTitle: string;
    private _dialogFilters: FileFilter[];
    private _dialogProperties: string[];

    readonly eInput;
    readonly eBtn;

    constructor(name: string, value: string | null) {
        super(name);

        this.elem.classList.add("dirent");

        super.value = null;

        this._dialogTitle = "";
        this._dialogFilters = [];
        this._dialogProperties = [];

        this.dialogTitle = "Choose a dirent";
        this.dialogFilters = [];
        this.dialogProperties = ["openFile"];

        this.eInput = document.createElement("input");
        this.eContent.appendChild(this.eInput);
        this.eInput.type = "text";
        this.eInput.autocomplete = "off";
        this.eInput.spellcheck = false;
        this.eInput.addEventListener("change", e => {
            this.value = this.eInput.value;
        });

        this.eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.classList.add("normal");
        this.eBtn.textContent = "Browse";
        this.eBtn.addEventListener("click", async e => {
            e.stopPropagation();
            let result = await fileOpenDialog({
                title: this.dialogTitle,
                filters: this.dialogFilters,
                properties: this.dialogProperties.filter(property => property !== "multiSelections") as any,
            });
            this.value = result.canceled ? null : result.filePaths[0];
        });

        this.addHandler("change", () => {
            this.eInput.value = util.castString(this.value);
        });

        this.value = value;

        this.type = ".*";
    }

    get value(): string | null { return super.value; }
    set value(value) {
        if (this.value === value) return;
        super.value = value;
    }

    get dialogTitle() { return this._dialogTitle; }
    set dialogTitle(value) { this._dialogTitle = value; }
    get dialogFilters() { return this._dialogFilters; }
    set dialogFilters(value) { this._dialogFilters = value; }
    get dialogProperties() { return this._dialogProperties; }
    set dialogProperties(value) { this._dialogProperties = value; }

    get focused() { return document.activeElement === this.eInput; }
}
/** A form field color input utilizing {@link PTooltip} as a color picker */
export class FormColorInput extends FormField {
    private _useAlpha: boolean;

    readonly eColorbox;
    readonly eColorPicker;
    readonly eInput;

    constructor(name: string, value: any) {
        super(name);

        this.elem.classList.add("color");
        
        super.value = new util.Color();
        
        this.value.addHandler("change", (attribute: string, from: any, to: any) => this.change("value", null, this.value));
        this._useAlpha = false;

        this.eContent.innerHTML = "<p-tooltip type='color' class='tog swx'></p-tooltip>";
        this.eColorPicker = this.eContent.children[0] as PTooltip;
        let ignore = false;
        this.eColorPicker.color.addHandler("change", () => {
            if (ignore) return;
            this.value = this.eColorPicker.color;
        });

        this.eColorbox = document.createElement("button");
        this.eContent.appendChild(this.eColorbox);
        this.eColorbox.classList.add("override");
        this.eColorbox.addEventListener("click", e => {
            e.stopPropagation();
            this.eContent.classList.add("active");
            const onClick = (e: MouseEvent) => {
                if (!(e.target instanceof HTMLElement)) return;
                if (this.eColorPicker.contains(e.target)) return;
                e.stopPropagation();
                this.eContent.classList.remove("active");
                document.body.removeEventListener("click", onClick, true);
            };
            document.body.addEventListener("click", onClick, true);
        });
        this.eInput = document.createElement("input");
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

    get value(): util.Color { return super.value; }
    set value(value) { super.value.set(value); }
    get useAlpha() { return this._useAlpha; }
    set useAlpha(value) {
        if (this.useAlpha === value) return;
        this.change("useAlpha", this.useAlpha, this._useAlpha=value);
    }
    
    get focused() { return document.activeElement === this.eInput; }
}
/** A simple enum form field input */
export class FormEnumInput extends FormField {
    private _values: FormNameValuePair[];

    constructor(name: string, values: FormNameValuePair[], value: any) {
        super(name);

        this.elem.classList.add("enum");

        this._values = [];

        this.values = values;
        this.value = value;
    }

    get values() { return this._values; }
    set values(values) {
        this._values = values;
        this.change("values", null, this.values);
    }
    get value() { return super.value; }
    set value(value) {
        if (this.value === value) return;
        super.value = value;
    }
}
/** A dropdown form field input using enum input */
export class FormDropdownInput extends FormEnumInput {
    private _menuGenerator: Menu | (() => Menu) | null;

    readonly eBtn;
    readonly eBtnText;

    constructor(name: string, values: FormNameValuePair[], value: any) {
        super(name, values, value);

        this.elem.classList.add("dropdown");

        this._menuGenerator = null;

        this.eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.classList.add("normal");
        this.eBtn.innerHTML = "<div></div><ion-icon name='chevron-forward'></ion-icon>";
        this.eBtnText = this.eBtn.children[0] as HTMLDivElement;
        
        this.eBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
            let menu =
                (this.menuGenerator instanceof Menu) ? this.menuGenerator :
                (typeof(this.menuGenerator) === "function") ? this.menuGenerator() :
                null;
            if (!menu) {
                menu = new Menu();
                const dfs = (data: FormNameValuePair[], menu: Menu) => {
                    data.forEach(data => {
                        if (data == null) return menu.items.add(new MenuDivider());
                        let item = menu.items.add(new MenuItem(
                            (typeof(data) === "string") ? data : data.name,
                            (((typeof(data) === "string") ? data : data.value) === this.value) ? "checkmark" : "",
                        )) as MenuItem;
                        item.addHandler("trigger", (e: MouseEvent) => {
                            this.value = (typeof(data) === "string") ? data : data.value;
                        });
                        if (typeof(data) !== "string" && data.sub) dfs(data.sub, item.menu);
                    });
                };
                dfs(this.values, menu);
            }
            Menu.contextMenu = menu;
            let rect = this.eBtn.getBoundingClientRect();
            Menu.placeContextMenu([rect.left, rect.bottom]);
            menu.elem.style.minWidth = rect.width+"px";
        });

        this.addHandler("change-disabled", () => {
            this.eBtn.disabled = this.disabled;
        });

        const apply = () => {
            if (this.menuGenerator) return;
            this.btnText = "None";
            const dfs = (data: FormNameValuePair[]) => {
                data.forEach(data => {
                    if (data == null) return;
                    if (typeof(data) === "string") {
                        if (data === this.value)
                            this.btnText = data;
                        return;
                    }
                    if (data.value === this.value)
                        this.btnText = data.name;
                });
            };
            dfs(this.values);
        };
        this.addHandler("change", apply);
        apply();
    }

    get menuGenerator() { return this._menuGenerator; }
    set menuGenerator(value) { this._menuGenerator = value; }

    get btnText() { return util.castString(this.eBtnText.textContent); }
    set btnText(value) { this.eBtnText.textContent = value; }
}
/** A swatch selector form field input using enum input */
export class FormSelectInput extends FormEnumInput {
    private _useOutline: boolean;
    private _mergeTop: boolean;
    private _mergeBottom: boolean;

    constructor(name: string, values: FormNameValuePair[], value: any) {
        super(name, values, value);

        this.elem.classList.add("select");

        this._useOutline = false;
        this._mergeTop = true;
        this._mergeBottom = true;

        this.useOutline = true;
        this.mergeTop = false;
        this.mergeBottom = false;

        let eBtns: HTMLButtonElement[] = [];

        this.addHandler("change-disabled", () => {
            eBtns.forEach(eBtn => (eBtn.disabled = this.disabled));
        });

        const apply = () => {
            this.eContent.innerHTML = "";
            eBtns = [];
            this.values.forEach(data => {
                if (data == null) return;

                let eBtn = document.createElement("button");
                this.eContent.appendChild(eBtn);

                if (((typeof(data) === "string") ? data : data.value) === this.value)
                    eBtn.classList.add("this");
                
                eBtn.textContent = ((typeof(data) === "string") ? data : data.name);

                eBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.value = ((typeof(data) === "string") ? data : data.value);
                    if (typeof(data) === "string") return;
                    if (data.click) data.click();
                });

                eBtn.style.setProperty("--n", String(this.values.length));
            });
        };
        this.addHandler("change", apply);
        apply();
    }

    get useOutline() { return this._useOutline; }
    set useOutline(value) {
        this._useOutline = value;
        this.elem.style.setProperty("--use-o", String(+this.useOutline));
    }

    get mergeTop() { return this._mergeTop; }
    set mergeTop(value) {
        this._mergeTop = value;
        this.elem.style.setProperty("--merge-t", String(+this.mergeTop));
    }
    get mergeBottom() { return this._mergeBottom; }
    set mergeBottom(value) {
        this._mergeBottom = value;
        this.elem.style.setProperty("--merge-b", String(+this.mergeBottom));
    }
}
/** A boolean form field input using the built-in toggle switch */
export class FormBooleanInput extends FormField {
    constructor(name: string, value: boolean) {
        super(name);

        this.showToggle = true;
        this.showContent = false;

        this.addHandler("change-toggleOn", () => (this.value = this.toggleOn));
        this.addHandler("change-toggleDisabled", () => (super.disabled = this.toggleDisabled));

        this.value = value;
    }

    get value() { return !!super.value; }
    set value(value) { this.toggleOn = value; }

    get disabled() { return super.disabled; }
    set disabled(v) { this.toggleDisabled = v; }
}
/** A boolean form field input using a custom button similar to that of the selector swatch input */
export class FormToggleInput extends FormBooleanInput {
    readonly eBtn;

    constructor(name: string, toggleName: string, value: boolean) {
        super(name, value);
        
        this.showToggle = false;
        this.showContent = true;

        this.elem.classList.add("enum");
        this.elem.classList.add("select");

        this.eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.style.setProperty("--n", "1");
        this.eBtn.addEventListener("click", e => {
            this.value = !this.value;
        });

        const apply = () => {
            this.eBtn.disabled = this.disabled;
            if (this.value)
                this.eBtn.classList.add("this");
            else this.eBtn.classList.remove("this");
        };
        this.addHandler("change", apply);
        apply();

        this.toggleName = toggleName;
    }

    get toggleName() { return util.castString(this.eBtn.textContent); }
    set toggleName(value) { this.eBtn.textContent = value; }
}
/** A json input for a form field */
export class FormJSONInput extends FormField {
    private _map: util.StringMap;

    readonly eAdd;

    constructor(name: string, map: util.StringMap) {
        super(name);
        
        this.elem.classList.add("json");

        this._map = {};

        this.eAdd = document.createElement("button");
        this.eContent.appendChild(this.eAdd);
        this.eAdd.classList.add("special");
        this.eAdd.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.eAdd.addEventListener("click", e => {
            e.stopPropagation();
            let keys = this.keys;
            let newKey = "new-key";
            if (keys.includes(newKey)) {
                let count = 1;
                while (true) {
                    if (!keys.includes(newKey+"-"+count)) break;
                    count++;
                }
                newKey += "-"+count;
            }
            this.set(newKey, "null");
        });

        this.addHandler("change-disabled", () => {
            this.eAdd.disabled = this.disabled;
            Array.from(this.eContent.querySelectorAll("input"))
                .forEach(eInput => (eInput.disabled = this.disabled));
        });

        this.addHandler("change", () => {
            Array.from(this.eContent.querySelectorAll(":scope > .item")).forEach(elem => elem.remove());
            this.keys.forEach(key => {
                let value = this.get(key) as string;

                let elem = document.createElement("div");
                this.eContent.insertBefore(elem, this.eAdd);
                elem.classList.add("item");

                let eKeyInput = document.createElement("input");
                elem.appendChild(eKeyInput);
                eKeyInput.type = "text";
                eKeyInput.placeholder = "Key...";
                eKeyInput.autocomplete = "off";
                eKeyInput.spellcheck = false;
                eKeyInput.value = key;

                let eSeparator = document.createElement("div");
                elem.appendChild(eSeparator);
                eSeparator.classList.add("separator");
                eSeparator.textContent = ":";

                let eValueInput = document.createElement("input");
                elem.appendChild(eValueInput);
                eValueInput.type = "text";
                eValueInput.placeholder = "Value...";
                eValueInput.autocomplete = "off";
                eValueInput.spellcheck = false;
                eValueInput.value = value;

                let color = "v4";
                try {
                    let actualValue = JSON.parse(value);
                    if (typeof(actualValue) === "string") color = "cy";
                    else if (typeof(actualValue) === "number") color = "cb";
                    else if (actualValue == null) color = "co";
                    else if (actualValue === true || actualValue === false) color = ["cr", "cg"][+actualValue];
                    else color = "v8";
                } catch (e) {}

                eValueInput.style.color = "var(--"+color+")";

                let eRemove = document.createElement("button");
                elem.appendChild(eRemove);
                eRemove.classList.add("remove");
                eRemove.innerHTML = "<ion-icon name='close'></ion-icon>";

                eKeyInput.addEventListener("change", e => {
                    this.del(key);
                    this.set(eKeyInput.value, value);
                });
                eValueInput.addEventListener("change", e => {
                    this.set(key, eValueInput.value);
                });
                eRemove.addEventListener("click", e => {
                    e.stopPropagation();
                    this.del(key);
                });
            });
        });

        this.map = map;
    }

    get keys() { return Object.keys(this._map); }
    get values() { return Object.values(this._map); }
    get map() {
        let map: util.StringMap = {};
        this.keys.forEach(key => (map[key] = this.get(key) as string));
        return map;
    }
    set map(value) {
        this.clear();
        for (let key in value) this.set(key, value[key]);
    }
    /**
     * Clears the JSON values.
     * @returns the previous value of the map before clearing
     */
    clear(): util.StringMap {
        let map = this.map;
        this.keys.forEach(key => this.del(key));
        return map;
    }
    /** Checks if a specific string key exists in the JSON value. */
    has(key: string): boolean { return key in this._map; }
    /** Gets a value for a specific string key. */
    get(key: string): string | null {
        if (!this.has(key)) return null;
        return this._map[key];
    }
    /**
     * Sets a value for a specific string key.
     * @returns the previous value originally stored, or null if this key is new
     */
    set(key: string, value: string): string | null {
        let prevValue = this.get(key);
        if (value === prevValue) return prevValue;
        this._map[key] = value;
        this.post("set", key, prevValue, value);
        this.change("map", null, this.keys);
        return prevValue;
    }
    /**
     * Removes a specific key from the JSON map.
     * @returns the previous value originally stored, or null if this key never existed
     */
    del(key: string): string | null {
        let value = this.get(key);
        if (value == null) return value;
        delete this._map[key];
        this.post("del", key, value);
        this.change("map", null, this.keys);
        return value;
    }
}
/** A simple button within a form field */
export class FormButton extends FormField {
    readonly eBtn;

    constructor(name: string, text: string, type: ButtonType = "normal") {
        super(name);

        this.elem.classList.add("button");

        this.addHandler("change-disabled", () => (this.eBtn.disabled = this.disabled));

        this.eBtn = document.createElement("button");
        this.eContent.appendChild(this.eBtn);
        this.eBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
        });

        this.text = text;

        this.btnType = type;
    }

    get text() { return util.castString(this.eBtn.textContent); }
    set text(value) { this.eBtn.textContent = value; }

    get btnType() {
        for (let name of buttonTypes)
            if (this.eBtn.classList.contains(name))
                return name as ButtonType;
        return null;
    }
    set btnType(value) {
        buttonTypes.forEach(name => {
            if (name === value)
                this.eBtn.classList.add(name);
            else this.eBtn.classList.remove(name);
        });
    }
}
/** Multiple buttons within a form field */
export class FormButtons extends FormField {
    constructor(name: string, btns: { text: string, type?: string }[]) {
        super(name);

        this.elem.classList.add("button");
        
        const eBtns = btns.map((data, i) => {
            const eBtn = document.createElement("button");
            this.eContent.appendChild(eBtn);
            eBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.post("trigger", i, e);
            });
            eBtn.textContent = data.text;
            buttonTypes.forEach(name => {
                if (name === data.type)
                    eBtn.classList.add(name);
                else eBtn.classList.remove(name);
            });
            return eBtn;
        });

        this.addHandler("change-disabled", () => {
            eBtns.forEach(eBtn => (eBtn.disabled = this.disabled));
        });
    }
}
/** A line in a form */
export class FormLine extends FormField {
    constructor(color: string = "var(--v2)") {
        super("§");

        this.elem.classList.add("line");

        this.color = color;
    }

    get color() { return this.elem.style.backgroundColor; }
    set color(value) { this.elem.style.backgroundColor = value; }
}
/** A subform within a form field that is collapsible */
export class FormSubForm extends FormField {
    readonly form;

    constructor(name: string) {
        super(name);

        this.elem.classList.add("subform");

        const eIcon = document.createElement("ion-icon");
        this.eHeader.insertBefore(eIcon, this.eHeader.firstChild);
        eIcon.name = "chevron-forward";
        this.eHeader.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        this.form = new Form();
        this.eContent.appendChild(this.form.elem);

        this.isHorizontal = false;
    }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(value) {
        if (value)
            this.elem.classList.add("this");
        else this.elem.classList.remove("this");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(value) { this.isOpen = !value; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }
}
/** A raw HTML form field */
export class FormHTML extends FormField {
    constructor(name: string, ...elems: HTMLElement[]) {
        super(name);

        this.elem.classList.add("html");

        this.showHeader = false;

        elems.forEach(elem => this.eContent.appendChild(elem));
    }
}

/** A way to manage drag-and-dropping of files */
export class DropTarget extends util.Target {

    private readonly dragIn: (e: DragEvent | null) => void;
    private readonly dragOut: (e: DragEvent | null) => void;
    private readonly drop: (e: DragEvent | null) => void;

    private _disabled;

    private _elem: HTMLElement | null;
    readonly eOverlay;

    private readonly observer;
    private readonly observerCallback;

    constructor(elem: HTMLElement | null) {
        super();

        this._disabled = false;

        this._elem = null;

        this.eOverlay = document.createElement("div");
        this.eOverlay.classList.add("overlay");
        this.eOverlay.innerHTML = "<div></div><div></div>";

        this.observerCallback = () => {
            if (this.elem == null) return;
            let rect = this.elem.getBoundingClientRect();
            this.eOverlay.style.setProperty("--size", Math.min(rect.width, rect.height)+"px");
        };
        this.observer = new ResizeObserver(this.observerCallback);

        this.dragIn = e => {
            if (this.disabled) return this.dragOut(null);
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.eOverlay.classList.add("this");
        };
        this.dragOut = e => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.eOverlay.classList.remove("this");
        };
        this.drop = e => this.post("drop", e);
        this.addHandler("drop", (e: DragEvent | null) => {
            if (!e) return;
            if (!e.dataTransfer) return;
            let dataItems = e.dataTransfer.items ? [...e.dataTransfer.items] : [];
            let files = dataItems.map(item => item.getAsFile()).filter(file => file instanceof File) as File[];
            if (files.length <= 0) files = e.dataTransfer.files ? [...e.dataTransfer.files] : [];
            files = files.filter(file => file instanceof File);
            this.post("files", files);
        });

        this.elem = elem;
    }

    get elem() { return this._elem; }
    set elem(value) {
        if (this.elem === value) return;
        this.unhook();
        this._elem = value;
        this.hook();
    }
    /** Unhooks internal callbacks from the HTML element. */
    unhook() {
        if (this.elem == null) return;
        this.elem.classList.remove("droptarget");
        if (this.disabled)
            this.elem.classList.remove("disabled");
        this.eOverlay.remove();
        this.observer.disconnect();
        for (let name of ["dragenter", "dragover"])
            this.elem.removeEventListener(name, this.dragIn as ((e: Event) => void));
        for (let name of ["dragleave", "dragend", "drop"])
            this.elem.removeEventListener(name, this.dragOut as ((e: Event) => void));
        this.elem.removeEventListener("drop", this.drop);
        this.dragOut(null);
        this.observerCallback();
    }
    /** Hooks internal callbacks from the HTML element. */
    hook() {
        if (this.disabled) return this.unhook();
        if (this.elem == null) return;
        this.elem.classList.add("droptarget");
        this.elem.classList.remove("disabled");
        if (this.disabled)
            this.elem.classList.add("disabled");
        this.elem.appendChild(this.eOverlay);
        this.observer.observe(this.elem);
        for (let name of ["dragenter", "dragover"])
            this.elem.addEventListener(name, this.dragIn as ((e: Event) => void));
        for (let name of ["dragleave", "dragend", "drop"])
            this.elem.addEventListener(name, this.dragOut  as ((e: Event) => void));
        this.elem.addEventListener("drop", this.drop);
        this.dragOut(null);
        this.observerCallback();
    }

    get disabled() { return this._disabled; }
    set disabled(value) {
        if (this.disabled === value) return;
        this.change("disabled", this.disabled, this._disabled=value);
        this.unhook();
        this.hook();
    }
    get enabled() { return !this.disabled; }
    set enabled(value) { this.disabled = !value; }
    disable() { return this.disabled = true; }
    enable() { return this.enabled = true; }
}
