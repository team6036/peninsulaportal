/*.lw{*/
import * as util from "./util.mjs";
/*.lw}*/

import Fuse from "../node_modules/fuse.js/dist/fuse.min.mjs";

/*.lw{*/
let mathjs = null;
if (typeof(window) != "undefined") {
    try {
        mathjs = (await import("../node_modules/mathjs/lib/browser/math.js")).default;
    } catch (e) {
        console.log("MATHJS IMPORT TRY 1 ERR", e);
        try {
            // THIS IS SO BAD - FIND ME A SOLUTION NOW
            const script = document.createElement("script");
            document.head.appendChild(script);
            await new Promise(async (res, rej) => {
                script.addEventListener("load", () => res());
                script.addEventListener("error", e => rej(e));
                script.src = "../node_modules/mathjs/lib/browser/math.js";
            });
            mathjs = window.math;
            delete window.math;
        } catch (e) {
            console.log("MATHJS IMPORT TRY 2 ERR", e);
        }
    }
}
export { mathjs };
/*.lw}*/

export function search(items, keys, query) {
    items = util.ensure(items, "arr");
    keys = util.ensure(keys, "arr");
    query = String(query);
    if (query.length <= 0) return items.map(item => { return { item: item, refIndex: 0, matches: [] }; });
    const fuse = new Fuse(items, {
        isCaseSensitive: false,
        includeMatches: true,
        keys: keys,
    });
    return fuse.search(query);
}

/*.lw{*/
export function findStep(v, n=10) {
    v = Math.max(0, util.ensure(v, "num"));
    n = Math.max(0, util.ensure(n, "int"));
    if (v <= 0) return 1;
    let factors = [1, 2, 5];
    let pow1 = 10 ** Math.floor(Math.log10(v/n));
    let pow2 = 10 * pow1;
    factors = [
        ...factors.map(f => { return {
            f: f*pow1,
            v: Math.abs(n-Math.round(v/(f*pow1))),
        }; }),
        ...factors.map(f => { return {
            f: f*pow2,
            v: Math.abs(n-Math.round(v/(f*pow2))),
        }; }),
    ];
    factors.sort((a, b) => a.v-b.v);
    return factors[0].f;
}
/*.lw}*/

export function keyify(s) {
    return String(s).split("").filter(c => util.BASE64.includes(c)).join("");
}
export function sanitize(s) {
    s = String(s)
        .replaceAll(/[\/\\<>:"\|\?\*%,;=]/g, "-")
        .split("")
        .map(c => c.charCodeAt(0) >= 32 ? c : "")
        .join("");
    while (s.endsWith(".") || s.endsWith(" ")) s = s.slice(0, -1);
    while (s.startsWith(".") || s.startsWith(" ")) s = s.slice(1);
    return s;
}

export const APPFEATURES = ["PANEL", "PLANNER", "PIT", "PYTHONTK"];
export const FEATURES = ["PORTAL", "PRESETS", ...APPFEATURES];
export const MODALS = ["ALERT", "CONFIRM", "PROMPT", "PROGRESS"];
const namefs = {
    PORTAL: "Portal",
    PRESETS: "Presets",
    PANEL: "Panel",
    PLANNER: "Planner",
    PIT: "Pit",
    PYTHONTK: "PythonTK",
};
const modalnamefs = {
    ALERT: "Alert",
    CONFIRM: "Confirm",
    PROMPT: "Prompt",
    PROGRESS: "Progress",
};
const iconfs = {
    PORTAL: "navigate",
    PRESETS: "settings-outline",
    PANEL: "grid",
    PLANNER: "analytics",
    PIT: "build",
    PYTHONTK: "logo-python",
};
export function getName(name) {
    name = String(name);
    if (name in namefs) return namefs[name];
    if (name.startsWith("modal:")) {
        name = name.slice(6);
        if (name in modalnamefs) return modalnamefs[name];
    }
    return name;
}
export function getIcon(name) {
    name = String(name);
    if (name in iconfs) return iconfs[name];
    if (name.startsWith("modal:")) return "browsers";
    return null;
}

export function getDSPaths(pth) {
    pth = String(pth);
    let logPth, eventsPth;
    if (pth.endsWith(".dslog")) {
        logPth = pth;
        eventsPth = pth.slice(0, -3)+"events";
    } else if (pth.endsWith(".dsevents")) {
        logPth = pth.slice(0, -6)+"log";
        eventsPth = pth;
    } else {
        logPth = pth+".dslog";
        eventsPth = pth+".dsevents";
    }
    return {
        logPth: logPth,
        eventsPth: eventsPth,
    };
}

export function simplify(s) {
    s = String(s);
    if (s.length > 20) s = s.slice(0, 20)+"...";
    return s;
}
export function stringify(data) {
    const dfs = (data, indent=0) => {
        const space = new Array(indent).fill("  ").join("");
        indent++;
        if (util.is(data, "obj"))
            return "\n"+Object.keys(data).map(k => space+k+": "+dfs(data[k], indent)).join("\n");
        if (util.is(data, "arr"))
            return "\n"+data.map((v, i) => space+i+": "+dfs(v, indent)).join("\n");
        return String(data);
    };
    return dfs(data).trim();
}

export function mergeThings(dest, src) {
    if (util.is(dest, "arr")) {
        dest.push(...util.ensure(src, "arr"));
        return dest;
    } else if (util.is(dest, "obj")) {
        src = util.ensure(src, "obj");
        for (let k in src) {
            if (k in dest) dest[k] = mergeThings(dest[k], src[k]);
            else dest[k] = src[k];
        }
        return dest;
    }
    return (src == null) ? dest : src;
}
export function isEmpty(o) {
    if (util.is(o, "arr")) return o.length <= 0;
    if (util.is(o, "obj")) return isEmpty(Object.keys(o));
    return o == null;
}
export function cleanupEmpties(o) {
    if (util.is(o, "arr"))
        return Array.from(o).map(o => cleanupEmpties(o)).filter(o => !isEmpty(o));
    if (util.is(o, "obj")) {
        for (let k in o) {
            o[k] = cleanupEmpties(o[k]);
            if (isEmpty(o[k])) delete o[k];
        }
        return o;
    }
    return isEmpty(o) ? null : o;
}

let FS = null, PATH = null, FSLOGFUNC = null;
export class FSOperator extends util.Target {
    #root;

    static get fs() { return FS; }
    static set fs(v) { FS = util.is(v, "obj") ? v : null; }
    static hasFS() { return this.fs != null; }
    static get path() { return PATH; }
    static set path(v) { PATH = util.is(v, "obj") ? v : null; }
    static hasPath() { return this.path != null; }
    static hasModules() { return this.hasFS() && this.hasPath(); }
    static get fsLogFunc() { return FSLOGFUNC; }
    static set fsLogFunc(v) { FSLOGFUNC = util.is(v, "func") ? v : null; }
    static hasFSLogFunc() { return this.fsLogFunc != null; }

    constructor(root) {
        super();

        this.#root = null;

        this.root = root;
    }

    get root() { return this.#root; }
    set root(v) { this.#root = v; }

    static makePath(...pth) {
        if (!this.hasModules()) return null;
        return this.path.join(...pth.flatten());
    }
    static async fileHas(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:file-has ${pth}`);
        try {
            await this.fs.promises.access(pth);
            return true;
        } catch (e) {}
        return false;
    }
    static async fileRead(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:file-read ${pth}`);
        return await this.fs.promises.readFile(pth, { encoding: "utf-8" });
    }
    static async fileReadRaw(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:file-read-raw ${pth}`);
        return new Uint8Array(await this.fs.promises.readFile(pth));
    }
    static async fileWrite(pth, content) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        content = String(content);
        this.fsLog(`fs:file-write ${pth}`);
        return await this.fs.promises.writeFile(pth, content, { encoding: "utf-8" });
    }
    static async fileWriteRaw(pth, content) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        content = Buffer.from(content);
        this.fsLog(`fs:file-write-raw ${pth}`);
        return await this.fs.promises.writeFile(pth, content);
    }
    static async fileAppend(pth, content) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:file-append ${pth}`);
        return await this.fs.promises.appendFile(pth, content, { encoding: "utf-8" });
    }
    static async fileDelete(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:file-delete ${pth}`);
        return await this.fs.promises.unlink(pth);
    }
    static async fileAffirm(pth, content="") {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:file-affirm ${pth}`);
        if (await this.fileHas(pth)) return false;
        await this.fileWrite(pth, content);
        return true;
    }
    static async fileDeny(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:file-deny ${pth}`);
        if (!(await this.fileHas(pth))) return false;
        await this.fileDelete(pth);
        return true;
    }

    static async dirHas(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:dir-has ${pth}`);
        try {
            await this.fs.promises.access(pth);
            return true;
        } catch (e) {}
        return false;
    }
    static async dirList(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:dir-list ${pth}`);
        let dirents = await this.fs.promises.readdir(pth, { withFileTypes: true });
        return dirents.map(dirent => {
            return {
                type: dirent.isFile() ? "file" : "dir",
                name: dirent.name,
            };
        });
    }
    static async dirMake(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:dir-make ${pth}`);
        return await this.fs.promises.mkdir(pth);
    }
    static async dirDelete(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:dir-delete ${pth}`);
        return await this.fs.promises.rm(pth, { force: true, recursive: true });
    }
    static async dirAffirm(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:dir-affirm ${pth}`);
        if (await this.dirHas(pth)) return false;
        await this.dirMake(pth);
        return true;
    }
    static async dirDeny(pth) {
        if (!this.hasModules()) return null;
        pth = this.makePath(pth);
        this.fsLog(`fs:dir-deny ${pth}`);
        if (!(await this.dirHas(pth))) return false;
        await this.dirDelete(pth);
        return true;
    }

    async fileHas(pth) { return await this.constructor.fileHas([this.root, pth]); }
    async fileRead(pth) { return await this.constructor.fileRead([this.root, pth]); }
    async fileReadRaw(pth) { return await this.constructor.fileReadRaw([this.root, pth]); }
    async fileWrite(pth, content) { return await this.constructor.fileWrite([this.root, pth], content); }
    async fileWriteRaw(pth, content) { return await this.constructor.fileWriteRaw([this.root, pth], content); }
    async fileAppend(pth, content) { return await this.constructor.fileAppend([this.root, pth], content); }
    async fileDelete(pth) { return await this.constructor.fileDelete([this.root, pth]); }
    async fileAffirm(pth, content="") { return await this.constructor.fileAffirm([this.root, pth], content); }
    async fileDeny(pth) { return await this.constructor.fileDeny([this.root, pth]); }

    async dirHas(pth) { return await this.constructor.dirHas([this.root, pth]); }
    async dirList(pth) { return await this.constructor.dirList([this.root, pth]); }
    async dirMake(pth) { return await this.constructor.dirMake([this.root, pth]); }
    async dirDelete(pth) { return await this.constructor.dirDelete([this.root, pth]); }
    async dirAffirm(pth) { return await this.constructor.dirAffirm([this.root, pth]); }
    async dirDeny(pth) { return await this.constructor.dirDeny([this.root, pth]); }

    static fsLog(...a) { return this.hasFSLogFunc() ? this.fsLogFunc(...a) : null; }
}

/*.lw{*/
export class Unit extends util.Target {
    #value;
    #unit;

    constructor(...a) {
        super();

        this.#value = 0;
        this.#unit = null;

        if (a.length <= 0 || a.length > 2) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Unit) a = [a.value, a.unit];
            else if (util.is(a, "arr")) {
                a = new Unit(...a);
                a = [a.value, a.unit];
            }
            else if (util.is(a, "obj")) a = [a.value, a.unit];
            else if (util.is(a, "num")) a = [a, "#"];
            else a = [0, "#"];
        }
        
        [this.value, this.unit] = a;
    }

    get value() { return this.#value; }
    set value(v) {
        v = util.ensure(v, "num");
        if (this.value == v) return;
        this.change("value", this.value, this.#value=v);
    }
    get unit() { return this.#unit; }
    set unit(v) {
        v = String(v).toLowerCase();
        if (this.unit == v) return;
        this.change("unit", this.unit, this.#unit=v);
    }

    convert(to) {
        to = String(to).toLowerCase();
        if (this.unit != "#" && to != "#" && mathjs) {
            try {
                return new Unit(mathjs.unit(this.value, this.unit).toNumber(to), to);
            } catch (e) {}
        }
        return new Unit(this.value, to);
    }

    static convert(v, u1, u2) {
        v = util.ensure(v, "num");
        u1 = String(u1).toLowerCase();
        u2 = String(u2).toLowerCase();
        if (u1 != "#" && u2 != "#" && mathjs) {
            try {
                return mathjs.unit(v, u1).toNumber(u2);
            } catch (e) {}
        }
        return v;
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            value: this.value,
            unit: this.unit,
        });
    }
}
util.REVIVER.addRule(Unit);
/*.lw}*/

export class Option extends util.Target {
    #name;
    #nickname;
    #dname;

    #data;

    constructor(o) {
        super();

        o = util.ensure(o, "obj");

        this.#name = null;
        this.#nickname = null;
        this.#dname = null;

        this.name = o.name;
        this.nickname = o.nickname;
        this.dname = o.dname || util.formatText(this.name);

        this.#data = util.ensure(o.data, "obj");
    }

    get name() { return this.#name; }
    set name(v) {
        v = String(v);
        if (this.name == v) return;
        this.change("name", this.name, this.#name=v);
    }
    get nickname() { return this.#nickname; }
    set nickname(v) {
        v = String(v);
        if (this.nickname == v) return;
        this.change("nickname", this.nickname, this.#nickname=v);
    }
    get dname() { return this.#dname; }
    set dname(v) {
        v = String(v);
        if (this.dname == v) return;
        this.change("dname", this.dname, this.#dname=v);
    }

    get data() { return this.#data; }
}
export class OptionList extends util.Target {
    #list;

    constructor(list) {
        super();

        this.#list = new Set();

        this.list = list;
    }

    get list() { return this.#list; }
    set list(v) {
        v = util.ensure(v, "arr");
        this.clear();
        this.add(v);
    }
    clear() {
        let list = this.list;
        this.rem(list);
        return list;
    }
    has(o) {
        if (!(o instanceof Option)) return false;
        return this.#list.has(o);
    }
    add(...os) {
        return util.Target.resultingForEach(os, o => {
            if (!(o instanceof Option)) return false;
            if (this.has(o)) return false;
            this.#list.add(o);
            return o;
        });
    }
    rem(...os) {
        return util.Target.resultingForEach(os, o => {
            if (!(o instanceof Option)) return false;
            if (!this.has(o)) return false;
            this.#list.delete(o);
            return o;
        });
    }

    findByName(name) {
        name = String(name);
        for (let o of this.#list)
            if (o.name == name)
                return o;
        return null;
    }
    findByNickname(nickname) {
        nickname = String(nickname);
        for (let o of this.#list)
            if (o.nickname == nickname)
                return o;
        return null;
    }
    findByDName(dname) {
        dname = String(dname);
        for (let o of this.#list)
            if (o.dname == dname)
                return o;
        return null;
    }
    findBy(f) {
        f = util.ensure(f, "func");
        for (let o of this.#list)
            if (f(o))
                return o;
        return null;
    }
}

export class Project extends util.Target {
    #id;

    #config;
    #meta;

    constructor(a) {
        super();

        this.#id = null;

        this.#config = null;
        this.#meta = null;

        if (a instanceof this.constructor.Config) a = { config: a };
        else if (a instanceof this.constructor.Meta) a = { meta: a };
        else if (util.is(a, "str")) a = { meta: a };
        
        a = util.ensure(a, "obj");
        this.id = a.id;
        this.config = a.config;
        this.meta = a.meta;
    }

    get id() { return this.#id; }
    set id(v) { this.#id = (v == null) ? null : String(v); }

    get config() { return this.#config; }
    set config(v) {
        v = new this.constructor.Config(v);
        if (this.config == v) return;
        if (this.config instanceof this.constructor.Config)
            this.config.clearLinkedHandlers(this, "change");
        this.change("config", this.config, this.#config=v);
        if (this.config instanceof this.constructor.Config)
            this.config.addLinkedHandler(this, "change", (c, f, t) => this.change("config."+c, f, t));
    }

    get meta() { return this.#meta; }
    set meta(v) {
        v = new this.constructor.Meta(v);
        if (this.meta == v) return;
        if (this.meta instanceof this.constructor.Meta) {
            this.meta.clearLinkedHandlers(this, "change");
            this.meta.clearLinkedHandlers(this, "thumb");
        }
        this.change("meta", this.meta, this.#meta=v);
        if (this.meta instanceof this.constructor.Meta) {
            this.meta.addLinkedHandler(this, "change", (c, f, t) => this.change("meta."+c, f, t));
            this.meta.addLinkedHandler(this, "thumb", () => this.post("thumb"));
        }
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            id: this.id,
            config: this.config, meta: this.meta,
        });
    }
}
Project.Config = class ProjectConfig extends util.Target {
    constructor(a) {
        super();
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {});
    }
};
Project.Meta = class ProjectMeta extends util.Target {
    #name;
    #modified;
    #created;
    #thumb;

    constructor(a) {
        super();

        this.#name = "New Project";
        this.#modified = 0;
        this.#created = 0;
        this.#thumb = null;

        if (util.is(a, "str")) a = { name: a };

        a = util.ensure(a, "obj");
        this.name = a.name;
        this.modified = a.modified;
        this.created = a.created;
        this.thumb = a.thumb;
    }

    get name() { return this.#name; }
    set name(v) {
        v = (v == null) ? "New Project" : String(v);
        if (this.name == v) return;
        this.change("name", this.name, this.#name=v);
    }
    get modified() { return this.#modified; }
    set modified(v) {
        v = util.ensure(v, "num");
        if (this.modified == v) return;
        this.#modified = v;
    }
    get created() { return this.#created; }
    set created(v) {
        v = util.ensure(v, "num");
        if (this.created == v) return;
        this.change("created", this.created, this.#created=v);
    }
    get thumb() { return this.#thumb; }
    set thumb(v) {
        v = (v == null) ? null : String(v);
        if (this.thumb == v) return;
        this.#thumb = v;
        this.post("thumb");
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            name: this.name,
            modified: this.modified, created: this.created,
            // thumb: this.thumb,
        });
    }
};
