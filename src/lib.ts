import * as util from "./util";
import { Vec1, Vec2, Vec3, Vec4 } from "./util";

import Fuse, { FuseResult } from "fuse.js";

import mathjs from "mathjs";


// Template types
export type Template = {
    name: string,
    size: util.vec2,
    robotSize: number,
    robotMass: number,
};
export type Templates = util.StringMap<Template>;
export type TemplateImages = util.StringMap;
export type TemplateModels = util.StringMap;
/** Casts any object to a template object. */
export function castTemplate(object: any): Template {
    object = util.castObject(object);

    object.name = util.castString(object.name);
    object.size = util.castVec2(object.size);
    object.robotSize = util.castNumber(object.robotSize);
    object.robotMass = util.castNumber(object.robotMass);

    return object;
}
/** Casts any object to a templates object. */
export function castTemplates(object: any): Templates {
    object = util.castObject(object);

    for (let id of object) object[id] = castTemplate(object[id]);

    return object;
}
/** Casts any object to a template images object. */
export function castTemplateImages(object: any): TemplateImages {
    object = util.castObject(object);

    for (let id of object) object[id] = util.castString(object);

    return object;
}
/** Casts any object to a template models object. */
export function castTemplateModels(object: any): TemplateModels {
    object = util.castObject(object);

    for (let id of object) object[id] = util.castString(object);

    return object;
}

// Robot types
export type RobotRotation = {
    axis: "x"|"y"|"z",
    angle: number,
};
export type RobotRotations = RobotRotation[];
export type RobotTranslations = util.vec3 | "auto";
export type RobotZero = {
    rotations: RobotRotations,
    translations: RobotTranslations,
};
export type RobotComponent = {
    name: string,
    zero: RobotZero,
};
export type RobotComponents = util.StringMap<RobotComponent>;
export type Robot = {
    name: string,

    bumperDetect: boolean,
    default: string,

    zero: RobotZero,

    components: RobotComponents,
};
export type Robots = util.StringMap<Robot>;
export type RobotModels = util.StringMap<{
    default: string | null,
    components: util.StringMap<string | null>,
}>;
/** Casts any object to a robot rotation object. */
export function castRobotRotation(object: any): RobotRotation {
    object = util.castObject(object);

    object.axis = util.castString(object.axis);
    if (!["x", "y", "z"].includes(object.axis)) object.axis = "x";
    object.angle = util.castNumber(object.angle);

    return object;
}
/** Casts any object to a robot rotations object. */
export function castRobotRotations(object: any): RobotRotations {
    object = util.castArray(object);

    object = object.map((object: any) => castRobotRotation(object));

    return object;
}
/** Casts any object to a robot translation. */
export function castRobotTranslations(object: any): RobotTranslations {
    if (typeof(object) === "string") {
        if (object === "auto") return "auto";
        return castRobotTranslations(null);
    }

    object = util.castVec3(object);
    
    return object;
}
/** Casts any object to a robot zero object. */
export function castRobotZero(object: any): RobotZero {
    object = util.castObject(object);
    
    object.rotations = castRobotRotations(object.rotations);
    object.translations = castRobotRotations(object.translations);

    return object;
}
/** Casts any object to a robot component object. */
export function castRobotComponent(object: any): RobotComponent {
    object = util.castObject(object);

    object.name = util.castString(object.name);
    object.zero = castRobotZero(object.zero);

    return object;
}
/** Casts any object to a robot component object. */
export function castRobotComponents(object: any): RobotComponents {
    object = util.castObject(object);

    for (let id in object) object[id] = castRobotComponent(object[id]);

    return object;
}
/** Casts any object to a robot object. */
export function castRobot(object: any): Robot {
    object = util.castObject(object);

    object.name = util.castString(object.name);

    object.bumperDetect = util.castBoolean(object.bumperDetect, true);
    object.default = util.castString(object.default, "model");

    object.zero = castRobotZero(object.zero);

    object.components = castRobotComponents(object.components);

    return object;
}
/** Casts any object to a robots object. */
export function castRobots(object: any): Robots {
    object = util.castObject(object);

    for (let id in object) object[id] = castRobot(object[id]);

    return object;
}
/** Casts any object to a robot models object. */
export function castRobotModels(object: any): RobotModels {
    object = util.castObject(object);

    for (let id of object) {
        object[id] = util.castObject(object[id]);
        object[id].default = util.castNullishString(object[id].default);
        object[id].components = util.castObject(object[id].components);
        for (let id2 in object[id].components) object[id].components[id2] = util.castNullishString(object[id].components[id2]);
    }

    return object;
}

// Theme types
export type Theme = {
    name: string,
    colors: util.StringMap;
    base: string[],
    accent: string | null,
};
export type Themes = util.StringMap<Theme>;
/** Casts any object to a theme object. */
export function castTheme(object: any): Theme {
    object = util.castObject(object);

    object.name = util.castString(object.name);
    object.colors = util.castObject(object.colors);
    for (let name in object.colors) object.colors[name] = util.castString(object.colors[name]);
    object.base = util.castStringArray(object.base);
    object.accent = util.castNullishString(object.accent);

    return object;
}
/** Casts any object to a themes object. */
export function castThemes(object: any): Themes {
    object = util.castObject(object);

    for (let id in object) object[id] = castTheme(object[id]);

    return object;
}

// Holiday types
export type Holiday = {
    name: string,
    days: util.vec2[],
    accent: string | null,

    icon: boolean,
    hat: boolean,
};
export type Holidays = util.StringMap<Holiday>;
export type HolidayIcon = {
    svg: string,
    png: string,
    ico: string,
    icns: string,
    hat1: string | null,
    hat2: string | null,
};
export type HolidayIcons = util.StringMap<HolidayIcon>;
/** Casts any object to a holiday object. */
export function castHoliday(object: any): Holiday {
    object = util.castObject(object);

    object.name = util.castString(object);
    object.days = util.castArray(object.days).map(day => util.castVec2(day));
    object.accent = util.castNullishString(object.accent);

    object.icon = util.castBoolean(object.icon, true);
    object.hat = util.castBoolean(object.hat, true);

    return object;
}
/** Casts any object to a holidays object. */
export function castHolidays(object: any): Holidays {
    object = util.castObject(object);

    for (let id in object) object[id] = castHoliday(object[id]);

    return object;
}
/** Casts any object to a holiday icon object. */
export function castHolidayIcon(object: any): HolidayIcon {
    object = util.castObject(object);

    object.svg = util.castString(object.svg);
    object.png = util.castString(object.png);
    object.ico = util.castString(object.ico);
    object.icns = util.castString(object.icns);
    object.hat1 = util.castNullishString(object.hat1);
    object.hat2 = util.castNullishString(object.hat2);

    return object;
}
/** Casts any object to a holiday icons object. */
export function castHolidayIcons(object: any): HolidayIcons {
    object = util.castObject(object);

    for (let id in object) object[id] = castHolidayIcon(object[id]);

    return object;
}

/** Using [Fuse.js](https://www.fusejs.io/), search through an item array to look for a specific query string. */
export function search<T>(items: T[], keys: string[], query: string): FuseResult<T>[] {
    if (query.length <= 0) return items.map(item => { return { item: item, refIndex: 0, matches: [] }; }) as FuseResult<T>[];
    const fuse = new Fuse(items, {
        isCaseSensitive: false,
        includeMatches: true,
        keys: keys,
    });
    return fuse.search(query);
}

/*.lw{*/
/**
 * Find the most optimal step value such that there are approximately n steps within a specified distance.
 * 
 * This algorithm uses a few key factors of 10: 1, 2, and 5. So, the step value generated will be one of these factors multiplied by some power of 10.
 * 
 * @example
 * findStepValue(11, 5) // returns 2
 * // Our distance is 11, and we want about 5 steps. The closest we can get to that value is 2, as 5.5 steps fit within 11, the closest we can get
 * // Trying other values like 1, 5, and 10 don't work because their step numbers are 11, 2.2, and 1.1, all of which are pretty far from the wanted value of 5 steps
 */
export function findStepValue(distance: number, numberWanted: number = 10): number {
    distance = Math.max(0, distance);
    numberWanted = Math.round(Math.max(0, numberWanted));
    if (distance <= 0) return 1;
    let factors = [1, 2, 5];
    let power = 10 ** Math.floor(Math.log10(distance / numberWanted));
    let stepValues: { step: number, countDistance: number }[] = [];
    for (let i = 0; i < 2; i++) {
        stepValues.push(...factors.map(factor => {
            let step = factor * power;
            return {
                step: step,
                countDistance: numberWanted - distance/step,
            };
        }));
        power *= 10;
    }
    stepValues.sort((valueA, valueB) => valueA.countDistance-valueB.countDistance);
    return stepValues[0].step;
}
/*.lw}*/

/**
 * Formats a string so that it becomes a valid key. A valid key can only include characters from the {@link util.BASE64} character set.
 * 
 * @example
 * formatKeyString("[a]_val?id_k*e*y-1") // returns "a_valid_key-1"
 */
export function formatKeyString(string: string): string {
    return string.split("").filter(c => util.BASE64.includes(c)).join("");
}
/** Removes potential characters that can cause filesystem issues from a string.
 * 
 * Rules:
 * - These characters (`\/<>:"|?*%,;=`) are replaced with dashes
 * - Any character codes < 32 are filtered out
 * - No trailing or leading periods or whitespace
 * 
 * @example
 * sanitizeString(".:cle?an s;t;r;in\"g  .") // returns "-cle-an s-t-r-in-g"
 */
export function sanitizeString(string: string): string {
    string = string
        .replaceAll(/[\/\\<>:"\|\?\*%,;=]/g, "-")
        .split("")
        .map(c => c.charCodeAt(0) >= 32 ? c : "")
        .join("");
    while (string.endsWith(".") || string.endsWith(" ")) string = string.slice(0, -1);
    while (string.startsWith(".") || string.startsWith(" ")) string = string.slice(1);
    return string;
}

export type ColorProfile = {
    cssProperty: string,
    cssHoverProperty: string,
    cssDisabledProperty: string,
    name: string,
};
export const COLORS: ColorProfile[] = [
    { cssProperty: "cr", cssHoverProperty: "cr5", cssDisabledProperty: "cr3", name: "Red" },
    { cssProperty: "co", cssHoverProperty: "co5", cssDisabledProperty: "co3", name: "Orange" },
    { cssProperty: "cy", cssHoverProperty: "cy5", cssDisabledProperty: "cy3", name: "Yellow" },
    { cssProperty: "cg", cssHoverProperty: "cg5", cssDisabledProperty: "cg3", name: "Green" },
    { cssProperty: "cc", cssHoverProperty: "cc5", cssDisabledProperty: "cc3", name: "Cyan" },
    { cssProperty: "cb", cssHoverProperty: "cb5", cssDisabledProperty: "cb3", name: "Blue" },
    { cssProperty: "cp", cssHoverProperty: "cp5", cssDisabledProperty: "cp3", name: "Purple" },
    { cssProperty: "cm", cssHoverProperty: "cm5", cssDisabledProperty: "cm3", name: "Magenta" },
    { cssProperty: "v8", cssHoverProperty: "v8", cssDisabledProperty: "v6", name: "White" },
    { cssProperty: "v4", cssHoverProperty: "v5", cssDisabledProperty: "v2", name: "Grey" },
];

export const APPFEATURES = ["PANEL", "PLANNER", "PIT", "PYTHONTK"];
export const FEATURES = ["PORTAL", "PRESETS", ...APPFEATURES];
export const MODALS = ["ALERT", "CONFIRM", "PROMPT", "PROGRESS"];
const featureNameMap: util.StringMap = {
    PORTAL: "Portal",
    PRESETS: "Presets",
    PANEL: "Panel",
    PLANNER: "Planner",
    PIT: "Pit",
    PYTHONTK: "PythonTK",
};
const modalNameMap: util.StringMap = {
    ALERT: "Alert",
    CONFIRM: "Confirm",
    PROMPT: "Prompt",
    PROGRESS: "Progress",
};
const featureIconMap: util.StringMap = {
    PORTAL: "navigate",
    PRESETS: "settings-outline",
    PANEL: "grid",
    PLANNER: "analytics",
    PIT: "build",
    PYTHONTK: "logo-python",
};
const modalIconMap: util.StringMap = {
    ALERT: "alert-circle",
    CONFIRM: "help-circle",
    PROMPT: "pencil",
    PROGRESS: "ellipsis-horizontal",
};
/** Given the app's programmic name, return the readable name */
export function getAppName(name: string): string {
    if (name in featureNameMap) return featureNameMap[name];
    if (name.startsWith("modal:")) {
        name = name.slice(6);
        if (name in modalNameMap) return modalNameMap[name];
    }
    return util.formatText(name);
}
/** Given the app's programmic name, return an associated icon  */
export function getAppIcon(name: string): string {
    if (name in featureIconMap) return featureIconMap[name];
    if (name.startsWith("modal:")) {
        name = name.slice(6);
        if (name in modalIconMap) return modalIconMap[name];
    }
    return "browsers";
}

export type DriverStationPaths = {
    logPath: string,
    eventsPath: string,
};
/**
 * Given a driverstation file's path, attempt to extrapolate the log and events paths.
 * 
 * If the path ends in `.dslog`, truncate and add `.dsevents` to get both paths.
 * 
 * If the path ends in `.dsevents`, truncate and add `.dslog` to get both paths.
 * 
 * Othwerise, just append `.dslog` and `.dsevents` to both and hope nothing goes wrong.
 */
export function getDriverStationPaths(pth: string): DriverStationPaths {
    let logPath, eventsPath;
    if (pth.endsWith(".dslog")) {
        logPath = pth;
        eventsPath = pth.slice(0, -3)+"events";
    } else if (pth.endsWith(".dsevents")) {
        logPath = pth.slice(0, -6)+"log";
        eventsPath = pth;
    } else {
        logPath = pth+".dslog";
        eventsPath = pth+".dsevents";
    }
    return {
        logPath: logPath,
        eventsPath: eventsPath,
    };
}

/** Truncates a string past length 20 and appends ellipsis. Used only once in main.ts. */
export function truncateString(string: string): string {
    if (string.length > 20)
        string = string.slice(0, 20)+"...";
    return string;
}
/**
 * Stringifies a JSON object with indentations and colons.
 * 
 * @example
 * stringifyJSON({
 *     object: { keyA: 1, keyB: false },
 *     property: "string",
 *     array: [null, [2.34]],
 * })
 * // returns:
 * `
 * object:
 *   keyA: 1
 *   keyB: false
 * property: string
 * array:
 *   0: null
 *   1:
 *     0: 2.34
 * `
 */
export function stringifyJSON(data: any): string {
    const dfs = (data: any, indent=0): string => {
        const space = new Array(indent).fill("  ").join("");
        indent++;
        if (data instanceof Array)
            return "\n"+data.map((value, index) => space+index+": "+dfs(value, indent)).join("\n");
        if (typeof(data) === "object")
            return "\n"+Object.keys(data).map(key => space+key+": "+dfs(data[key], indent)).join("\n");
        return String(data);
    };
    return dfs(data).trim();
}

/**
 * Attempts to merge two separate objects together.
 * 
 * - Merging of arrays means just a union of their values
 * - Merging of objects means adding properties if nonexistent or recursively merging existing properties
 * - Merging of values means if `src` is `null`, take `dest`, otherwise take `src`
 */
export function mergeValues(dest: any, src: any): any {
    if (dest instanceof Array) {
        dest.push(...util.castArray(src));
        return dest;
    } else if (typeof(dest) === "object") {
        src = util.castObject(src);
        for (let key in src) {
            if (key in dest)
                dest[key] = mergeValues(dest[key], src[key]);
            else dest[key] = src[key];
        }
        return dest;
    }
    return (src == null) ? dest : src;
}
/**
 * Determines whether a value is empty-ish.
 * 
 * - Arrays are empty if they have length of zero
 * - Objects are empty if they have no keys
 * - Values are empty if they are null
 */
export function isValueEmpty(value: any): boolean {
    if (value instanceof Array) return value.length <= 0;
    if (typeof(value) === "object") return isValueEmpty(Object.keys(value));
    return value == null;
}
/**
 * Removes empty values from an object, essentially collapsing it into its most minimal form.
 * 
 * - Arrays are iterated through and each item is recursively emptied. Those empty items are then filtered out
 * - Objects are iterated through and each value is recursively emptied. Those empty values are then filtered out
 * - Values are returned as null if deemed empty, otherwise returned without modification
 */
export function removeEmptyValues(value: any): any {
    if (value instanceof Array)
        return value.map(item => removeEmptyValues(item)).filter(o => !isValueEmpty(o));
    if (typeof(value) === "object") {
        for (let key in value) {
            value[key] = removeEmptyValues(value[key]);
            if (isValueEmpty(value[key])) delete value[key];
        }
        return value;
    }
    return isValueEmpty(value) ? null : value;
}

/*.lw{*/
export type UnitLike = Unit | Vec1 | util.vec1 | number | { value?: number, unit?: string } | null;

/** A way of managing different numerical numbers with units */
export class Unit extends util.Target {
    static { util.REVIVER.rules.add(this); }

    private _value: number;
    private _unit: string;

    constructor(source?: UnitLike) {
        super();

        this._value = 0;
        this._unit = "#";
        
        const args = (source?: UnitLike): [number, string] => {
            if (source instanceof Unit) return [source.value, source.unit];
            if (source instanceof Vec1) return args(source.x);
            if (Array.isArray(source)) {
                return args(source[0]);
            }
            if (typeof(source) === "object" && source) return [util.castNumber(source.value), util.castString(source.unit, "#")];
            if (typeof(source) !== "number") return args(0);
            return [source, "#"];
        };
        [this.value, this.unit] = args(source);
    }

    get value() { return this._value; }
    set value(value) {
        if (this.value === value) return;
        this.change("value", this.value, this._value=value);
    }
    get unit() { return this._unit; }
    set unit(value: string) {
        value = value.toLowerCase();
        if (this.unit === value) return;
        this.change("unit", this.unit, this._unit=value);
    }

    /** Converts this unit to another one using MathJS. */
    convert(to: string): Unit {
        to = to.toLowerCase();
        if (this.unit !== "#" && to !== "#" && mathjs) {
            try {
                return new Unit({ value: mathjs.unit(this.value, this.unit).toNumber(to), unit: to });
            } catch (e) {}
        }
        return new Unit({ value: this.value, unit: to });
    }

    /** Converts a number from one unit to another using MathJS. */
    static convert(value: number, fromUnit: string, toUnit: string): number {
        fromUnit = fromUnit.toLowerCase();
        toUnit = toUnit.toLowerCase();
        if (fromUnit !== "#" && toUnit !== "#" && mathjs) {
            try {
                return mathjs.unit(value, fromUnit).toNumber(toUnit);
            } catch (e) {}
        }
        return value;
    }

    toJSON() {
        return util.Reviver.revivable(Unit, {
            value: this.value,
            unit: this.unit,
        });
    }
}
/*.lw}*/

export type OptionConfig = {
    name?: string,
    nickname?: string,
    displayName?: string,
    data?: any,
} | Option | null;

/** An Option class for configuring options */
export class Option extends util.Target {
    private _name: string;
    private _nickname: string;
    private _displayName: string;

    private _data: any;

    constructor(cnf?: OptionConfig) {
        super();

        this._name = "";
        this._nickname = "";
        this._displayName = "";

        if (cnf == null) cnf = {};

        this.name = util.castString(cnf.name, "");
        this.nickname = util.castString(cnf.nickname, "");
        this.displayName = util.castString(cnf.displayName, util.formatText(this.name));

        this._data = cnf.data;
    }

    get name() { return this._name; }
    set name(value: string) {
        if (this.name === value) return;
        this.change("name", this.name, this._name=value);
    }
    get nickname() { return this._nickname; }
    set nickname(value: string) {
        if (this.nickname === value) return;
        this.change("nickname", this.nickname, this._nickname=value);
    }
    get displayName() { return this._displayName; }
    set displayName(value) {
        if (this.displayName === value) return;
        this.change("displayName", this.displayName, this._displayName=value);
    }

    get data() { return this._data; }
}
/** An OptionList class for managing multiple Options */
export class OptionList extends util.List<Option> {
    constructor(list: Option[]) {
        super();

        this.list = list;
    }

    convert(value: Option): Option | false { return value; }

    /** Finds an option with a specific name. */
    findByName(name: string): Option | null {
        for (let o of this._list)
            if (o.name == name) return o;
        return null;
    }
    /** Finds an option with a specific nickname. */
    findByNickname(nickname: string): Option | null {
        for (let o of this._list)
            if (o.nickname == nickname) return o;
        return null;
    }
    /** Finds an option with a specific display name. */
    findByDisplayName(displayName: string): Option | null {
        for (let o of this._list)
            if (o.displayName == displayName)
                return o;
        return null;
    }
    /** Finds an option which satisfies a specific callback. */
    findBy(callback: (option: Option) => boolean): Option | null {
        for (let o of this._list)
            if (callback(o)) return o;
        return null;
    }
}

export type ProjectConfigConfig = {} | ProjectConfig | null;

/** The configuration class for projects */
export class ProjectConfig extends util.Target {
    constructor(cnf?: ProjectConfigConfig) {
        super();
    }

    toJSON() {
        return util.Reviver.revivable(Project.Config, {});
    }
}

export type ProjectMetaConfig = {
    name?: string,
    modified?: number,
    created?: number,
    thumb?: string | null,
} | ProjectMeta | string | null;

/** The metadata class for projects */
export class ProjectMeta extends util.Target {
    private _name: string;
    private _modified: number;
    private _created: number;
    private _thumb: string | null;

    constructor(cnf?: ProjectMetaConfig) {
        super();

        this._name = "New Project";
        this._modified = 0;
        this._created = 0;
        this._thumb = null;

        if (typeof(cnf) === "string") cnf = { name: cnf };
        if (cnf == null) cnf = {};

        this.name = util.castString(cnf.name, "New Project");
        this.modified = util.castNumber(cnf.modified);
        this.created = util.castNumber(cnf.created);
        this.thumb = util.castNullishString(cnf.thumb);
    }

    get name() { return this._name; }
    set name(value) {
        if (this.name === value) return;
        this.change("name", this.name, this._name=value);
    }
    get modified() { return this._modified; }
    set modified(value) {
        if (this.modified === value) return;
        this._modified = value;
    }
    get created() { return this._created; }
    set created(value) {
        if (this.created === value) return;
        this.change("created", this.created, this._created=value);
    }
    get thumb() { return this._thumb; }
    set thumb(value) {
        if (this.thumb === value) return;
        this._thumb = value;
        this.post("thumb");
    }

    toJSON() {
        return util.Reviver.revivable(Project.Meta, {
            name: this.name,
            modified: this.modified, created: this.created,
            // thumb: this.thumb,
        });
    }
}

export type ProjectArguments = {
    id?: string | null,
    config?: ProjectConfigConfig,
    meta?: ProjectMetaConfig,
} | Project | ProjectConfig | ProjectMeta | string | null;

/** The Project class which manages all saved projects in the app */
export class Project extends util.Target {
    private _id: string | null;

    private _config: ProjectConfig;
    private _meta: ProjectMeta;

    static Config: typeof ProjectConfig = ProjectConfig;
    static Meta: typeof ProjectMeta = ProjectMeta;

    constructor(cnf?: ProjectArguments) {
        super();

        this._id = null;

        this._config = new (this.constructor as typeof Project).Config();
        this._meta = new (this.constructor as typeof Project).Meta();

        if (cnf instanceof Project.Config) cnf = { config: cnf };
        else if (cnf instanceof Project.Meta) cnf = { meta: cnf };
        else if (typeof(cnf) === "string") cnf = { meta: cnf };
        if (cnf == null) cnf = {};
        
        this.id = util.castNullishString(cnf.id);
        this.config = new (this.constructor as typeof Project).Config(cnf.config);
        this.meta = new (this.constructor as typeof Project).Meta(cnf.meta);
    }

    get id() { return this._id; }
    set id(value) { this._id = value; }

    get config() { return this._config; }
    set config(value) {
        if (this.config === value) return;
        this.config.clearLinkedHandlers(this, "change");
        this.change("config", this.config, this._config=value);
        this.config.addLinkedHandler(this, "change", (attribute: string, from: any, to: any) => this.change("config."+attribute, from, to));
    }

    get meta() { return this._meta; }
    set meta(value) {
        if (this.meta === value) return;
        this.meta.clearLinkedHandlers(this, "change");
        this.meta.clearLinkedHandlers(this, "thumb");
        this.change("meta", this.meta, this._meta=value);
        this.meta.addLinkedHandler(this, "change", (attribute: string, from: any, to: any) => this.change("meta."+attribute, from, to));
        this.meta.addLinkedHandler(this, "thumb", () => this.post("thumb"));
    }

    toJSON() {
        return util.Reviver.revivable(Project, {
            id: this.id,
            config: this.config, meta: this.meta,
        });
    }
}
