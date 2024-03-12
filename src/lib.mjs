import * as util from "./util.mjs";


export const TEXTENCODER = new TextEncoder();
export const TEXTDECODER = new TextDecoder();


export function stringifyError(e, nl="") {
    let lines = [String(e)];
    if (e instanceof Error) {
        if (e.stack) lines.push(String(e.stack));
        if (e.cause) lines.push(stringifyError(e.cause, nl+"  "));
    }
    lines = lines.flatten().join("\n").split("\n").filter(part => part.length > 0);
    if (lines[0] == lines[1]) lines.shift();
    return lines.map(line => nl+line).join("\n");
}

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

    async fileHas(pth) { return await this.constructor.fileHas([this.root, pth]); }
    async fileRead(pth) { return await this.constructor.fileRead([this.root, pth]); }
    async fileReadRaw(pth) { return await this.constructor.fileReadRaw([this.root, pth]); }
    async fileWrite(pth, content) { return await this.constructor.fileWrite([this.root, pth], content); }
    async fileWriteRaw(pth, content) { return await this.constructor.fileWriteRaw([this.root, pth], content); }
    async fileAppend(pth, content) { return await this.constructor.fileAppend([this.root, pth], content); }
    async fileDelete(pth) { return await this.constructor.fileDelete([this.root, pth]); }

    async dirHas(pth) { return await this.constructor.dirHas([this.root, pth]); }
    async dirList(pth) { return await this.constructor.dirList([this.root, pth]); }
    async dirMake(pth) { return await this.constructor.dirMake([this.root, pth]); }
    async dirDelete(pth) { return await this.constructor.dirDelete([this.root, pth]); }

    static fsLog(...a) { return this.hasFSLogFunc() ? this.fsLogFunc(...a) : null; }
}
