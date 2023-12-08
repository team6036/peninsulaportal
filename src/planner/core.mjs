import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";


export const VERSION = 2;


export class Project extends core.Project {
    #items;
    #paths;
    #size;
    #robotSize;
    #robotMass;

    constructor(...a) {
        super();

        this.#items = {};
        this.#paths = {};
        this.#size = new V();
        this.#robotSize = new V();
        this.#robotMass = 0;

        this.size.addHandler("change", (c, f, t) => this.change("size."+c, f, t));
        this.robotSize.addHandler("change", (c, f, t) => this.change("robotSize."+c, f, t));

        if (a.length <= 0 || a.length > 7) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project) {
                let itms = {};
                a.items.forEach(id => {
                    let itm = a.getItem(id);
                    itms[id] = new itm.constructor(itm);
                });
                let pths = {};
                a.paths.forEach(id => {
                    let pth = a.getPath(id);
                    pths[id] = new pth.constructor(pth);
                });
                a = [itms, pths, a.size, a.robotSize, a.robotMass, a.config, a.meta];
            }
            else if (util.is(a, "arr")) {
                a = new Project(...a);
                let itms = {};
                a.items.forEach(id => {
                    let itm = a.getItem(id);
                    itms[id] = new itm.constructor(itm);
                });
                let pths = {};
                a.paths.forEach(id => {
                    let pth = a.getPath(id);
                    pths[id] = new pth.constructor(pth);
                });
                a = [itms, pths, a.size, a.robotSize, a.robotMass, a.config, a.meta];
            }
            else if (a instanceof Project.Config) a = [{}, {}, [1000, 1000], [100, 100], 0, a, null];
            else if (a instanceof Project.Meta) a = [{}, {}, [1000, 1000], [100, 100], 0, null, a];
            else if (util.is(a, "str")) a = [{}, {}, [1000, 1000], [100, 100], 0, null, a];
            else if (util.is(a, "obj")) a = [a.items, a.paths, a.size, a.robotSize, a.robotMass, a.config, a.meta];
            else a = [{}, {}, [1000, 1000], [100, 100], 0, null, null];
        }
        if (a.length == 2)
            a = [...a, [1000, 1000], [100, 100], 0, null, null];
        if (a.length == 3)
            a = [...a, [100, 100], 0, null, null];
        if (a.length == 4)
            a = [...a.slice(0, 3), [100, 100], 0, ...((a[3] instanceof Project.Config) ? [a[3], null] : (a[3] instanceof Project.Meta) ? [null, a[3]] : [null, null])];
        if (a.length == 5)
            a = [...a.slice(0, 3), [100, 100], 0, ...a.slice(3)];
        if (a.length == 6)
            a = [...a.slice(0, 4), 0, ...a.slice(4)];

        [this.items, this.paths, this.size, this.robotSize, this.robotMass, this.config, this.meta] = a;

        this.addHandler("change", () => {
            let pathNames = new Set();
            this.paths.forEach(id => {
                let path = this.getPath(id);
                if (path.name.length <= 0) path.name = "New Path";
                if (pathNames.has(path.name)) {
                    let n = 1;
                    while (pathNames.has(path.name+ " ("+n+")")) n++;
                    path.name += " ("+n+")";
                }
                pathNames.add(path.name);
            });
        });
    }

    get items() { return Object.keys(this.#items); }
    set items(v) {
        v = util.ensure(v, "obj");
        this.clearItems();
        for (let id in v) {
            if (!(v[id] instanceof Project.Item)) continue;
            v[id].id = id;
            this.addItem(v[id]);
        }
    }
    clearItems() {
        let itms = this.items;
        itms.forEach(id => this.remItem(id));
        return itms;
    }
    hasItem(v) {
        if (util.is(v, "str")) return v in this.#items;
        if (v instanceof Project.Item) return this.hasItem(v.id);
        return false;
    }
    getItem(id) {
        id = String(id);
        if (!this.hasItem(id)) return null;
        return this.#items[id];
    }
    addItem(itm) {
        if (!(itm instanceof Project.Item)) return false;
        if (this.hasItem(itm)) return false;
        let id = itm.id;
        while (id == null || this.hasItem(id))
            id = new Array(10).fill(null).map(_ => util.BASE64[Math.floor(Math.random()*64)]).join("");
        this.#items[id] = itm;
        itm.id = id;
        itm.addLinkedHandler(this, "change", (c, f, t) => this.change("getItem("+id+")."+c, f, t));
        this.change("addItem", null, itm);
        return itm;
    }
    remItem(v) {
        if (util.is(v, "str")) {
            let itm = this.getItem(v);
            itm.clearLinkedHandlers(this, "change");
            itm.id = null;
            delete this.#items[v];
            this.paths.forEach(id => {
                let pth = this.getPath(id);
                pth.nodes = pth.nodes.filter(id => this.hasItem(id) && this.getItem(id) instanceof Project.Node);
            });
            this.change("remItem", itm, null);
            return itm;
        }
        if (v instanceof Project.Item) return this.remItem(v.id);
        return false;
    }
    get paths() { return Object.keys(this.#paths); }
    set paths(v) {
        v = util.ensure(v, "obj");
        this.clearPaths();
        for (let id in v) {
            if (!(v[id] instanceof Project.Path)) continue;
            v[id].id = id;
            this.addPath(v[id]);
        }
    }
    clearPaths() {
        let pths = this.paths;
        pths.forEach(id => this.remPath(id));
        return pths;
    }
    hasPath(v) {
        if (util.is(v, "str")) return v in this.#paths;
        if (v instanceof Project.Path) return this.hasPath(v.id);
        return false;
    }
    getPath(id) {
        id = String(id);
        if (!this.hasPath(id)) return null;
        return this.#paths[id];
    }
    addPath(pth) {
        if (!(pth instanceof Project.Path)) return false;
        if (this.hasPath(pth)) return false;
        let id = pth.id;
        while (id == null || this.hasPath(id))
            id = new Array(10).fill(null).map(_ => util.BASE64[Math.floor(Math.random()*64)]).join("");
        this.#paths[id] = pth;
        pth.id = id;
        pth.nodes = pth.nodes.filter(id => this.hasItem(id) && this.getItem(id) instanceof Project.Node);
        pth.addLinkedHandler(this, "change", (c, f, t) => this.change("getPath("+id+")."+c, f, t));
        this.change("addPath", null, pth);
        return pth;
    }
    remPath(v) {
        if (util.is(v, "str")) {
            let pth = this.getPath(v);
            pth.clearLinkedHandlers(this, "change");
            let id = pth.id;
            pth.id = null;
            delete this.#paths[v];
            this.change("remPath", pth, null);
            return pth;
        }
        if (v instanceof Project.Path) return this.remPath(v.id);
        return false;
    }

    get size() { return this.#size; }
    set size(v) { this.#size.set(v); }
    get w() { return this.size.x; }
    set w(v) { this.size.x = v; }
    get h() { return this.size.y; }
    set h(v) { this.size.y = v; }

    get robotSize() { return this.#robotSize; }
    set robotSize(v) { this.#robotSize.set(v); }
    get robotW() { return this.robotSize.x; }
    set robotW(v) { this.robotSize.x = v; }
    get robotH() { return this.robotSize.y; }
    set robotH(v) { this.robotSize.y = v; }
    
    get robotMass() { return this.#robotMass; }
    set robotMass(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.robotMass == v) return;
        this.change("robotMass", this.robotMass, this.#robotMass=v);
    }
    
    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            items: this.#items,
            paths: this.#paths,
            size: this.size,
            robotSize: this.robotSize, robotMass: this.robotMass,
            config: this.config, meta: this.meta,
        });
    }
}
Project.Config = class ProjectConfig extends Project.Config {
    #script;
    #scriptPython;
    #scriptUseDefault;

    #momentOfInertia;
    #efficiency;
    #is12MotorMode;

    constructor(...a) {
        super();

        this.#script = null;
        this.#scriptPython = "";
        this.#scriptUseDefault = false;

        this.#momentOfInertia = 0;
        this.#efficiency = 0;
        this.#is12MotorMode = false;

        if (a.length <= 0 || ![1, 4, 6].includes(a.length)) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Config) a = [a.script, a.scriptPython, a.scriptUseDefault, a.momentOfInertia, a.efficiency, a.is12MotorMode];
            else if (util.is(a, "arr")) {
                a = new Project.Config(...a);
                a = [a.script, a.scriptPython, a.scriptUseDefault, a.momentOfInertia, a.efficiency, a.is12MotorMode];
            }
            else if (util.is(a, "str")) a = [a, 0, 0, false];
            else if (util.is(a, "obj")) a = [a.script, a.scriptPython, a.scriptUseDefault, a.momentOfInertia, a.efficiency, a.is12MotorMode];
            else a = [null, 0, 0, false];
        }
        if (a.length == 4)
            a = [...a.slice(0, 1), "python3", false, ...a.slice(1)];

        [this.script, this.scriptPython, this.scriptUseDefault, this.momentOfInertia, this.efficiency, this.is12MotorMode] = a;
    }

    get script() { return this.#script; }
    set script(v) {
        v = (v == null) ? null : String(v);
        if (this.script == v) return;
        this.change("script", this.script, this.#script=v);
    }
    get scriptPython() { return this.#scriptPython; }
    set scriptPython(v) {
        v = (v == null) ? "python3" : String(v);
        if (this.scriptPython == v) return;
        this.change("scriptPython", this.scriptPython, this.#scriptPython=v);
    }
    get scriptUseDefault() { return this.#scriptUseDefault; }
    set scriptUseDefault(v) {
        v = !!v;
        if (this.scriptUseDefault == v) return;
        this.change("scriptUseDefault", this.scriptUseDefault, this.#scriptUseDefault=v);
    }

    get momentOfInertia() { return this.#momentOfInertia; }
    set momentOfInertia(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.momentOfInertia == v) return;
        this.change("momentOfInertia", this.momentOfInertia, this.#momentOfInertia=v);
    }

    get efficiency() { return this.#efficiency; }
    set efficiency(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.efficiency == v) return;
        this.change("efficiency", this.efficiency, this.#efficiency=v);
    }

    get is12MotorMode() { return this.#is12MotorMode; }
    set is12MotorMode(v) {
        v = !!v;
        if (this.is12MotorMode == v) return;
        this.change("is12MotorMode", this.is12MotorMode, this.#is12MotorMode=v);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            script: this.script, scriptPython: this.scriptPython, scriptUseDefault: this.scriptUseDefault,
            momentOfInertia: this.momentOfInertia,
            efficiency: this.efficiency,
            is12MotorMode: this.is12MotorMode,
        });
    }
};
Project.Meta = class ProjectMeta extends Project.Meta {
    #backgroundImage;
    #backgroundScale;

    constructor(...a) {
        super();

        this.#backgroundImage = null;
        this.#backgroundScale = 1;

        if (a.length <= 0 || [3, 5].includes(a.length) || a.length > 6) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Meta) a = [a.name, a.modified, a.created, a.thumb, a.backgroundImage, a.backgroundScale];
            else if (util.is(a, "arr")) {
                a = new Project.Meta(...a);
                a = [a.name, a.modified, a.created, a.thumb, a.backgroundImage, a.backgroundScale];
            }
            else if (util.is(a, "str")) a = [a, null];
            else if (util.is(a, "obj")) a = [a.name, a.modified, a.created, a.thumb, a.backgroundImage, a.backgroundScale];
            else a = ["New Project", null];
        }
        if (a.length == 2) a = [a[0], 0, 0, a[1]];
        if (a.length == 4) a = [...a, null, 0];
        
        [this.name, this.modified, this.created, this.thumb, this.backgroundImage, this.backgroundScale] = a;
    }

    get backgroundImage() { return this.#backgroundImage; }
    set backgroundImage(v) {
        v = (v == null) ? null : String(v);
        if (this.backgroundImage == v) return;
        this.change("backgroundImage", this.backgroundImage, this.#backgroundImage=v);
    }
    get backgroundScale() { return this.#backgroundScale; }
    set backgroundScale(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.backgroundScale == v) return;
        this.change("backgroundScale", this.backgroundScale, this.#backgroundScale=v);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            name: this.name,
            modified: this.modified, created: this.created,
            thumb: this.thumb,
            backgroundImage: this.backgroundImage,
            backgroundScale: this.backgroundScale,
        });
    }
}
Project.Item = class ProjectItem extends util.Target {
    #id;

    #pos;

    constructor(...a) {
        super();

        this.#id = null;

        this.#pos = new V();

        this.pos.addHandler("change", (c, f, t) => this.change("pos."+c, f, t));

        if (a.length <= 0 || a.length > 2) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Item) a = a.pos;
            else if (util.is(a, "arr")) {
                a = new Project.Item(...a);
                a = a.pos;
            }
            else if (util.is(a, "obj")) a = a.pos;
            else a = new V(a);
        }

        this.pos = a;
    }

    get id() { return this.#id; }
    set id(v) { this.#id = (v == null) ? null : String(v); }

    get pos() { return this.#pos; }
    set pos(v) { this.#pos.set(v); }
    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }

    getBBox() {
        return new util.Rect(this.pos, [0, 0]);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            pos: this.pos,
        });
    }
}
Project.Node = class ProjectNode extends Project.Item {
    #heading;
    #useHeading
    #velocity;
    #velocityRot;
    #useVelocity;

    constructor(...a) {
        super();

        this.#heading = 0;
        this.#useHeading = false;
        this.#velocity = new V();
        this.#velocityRot = 0;
        this.#useVelocity = true;

        this.velocity.addHandler("change", (c, f, t) => this.change("velocity."+c, f, t));

        if (a.length <= 0 || a.length > 6) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Node) a = [a.pos, a.heading, a.useHeading, a.velocity, a.velocityRot, a.useVelocity];
            else if (a instanceof Project.Item) a = [a.pos, 0];
            else if (util.is(a, "arr")) {
                a = new Project.Node(...a);
                a = [a.pos, a.heading, a.useHeading, a.velocity, a.velocityRot, a.useVelocity];
            }
            else if (util.is(a, "obj")) a = [a.pos, a.heading, a.useHeading, a.velocity, a.velocityRot, a.useVelocity];
            else a = [a, 0];
        }
        if (a.length == 2)
            a = [...a, 100];
        if (a.length == 3)
            a = [...a, true];
        if (a.length == 4)
            a = [...a.slice(0, 3), 0, ...a.slice(3)];
        if (a.length == 5)
            a = [...a.slice(0, 2), true, ...a.slice(2)];
        
        [this.pos, this.heading, this.useHeading, this.velocity, this.velocityRot, this.useVelocity] = a;
    }

    get heading() { return this.#heading; }
    set heading(v) {
        const fullTurn = 2*Math.PI;
        v = util.ensure(v, "num");
        while (v >= fullTurn) v -= fullTurn;
        while (v < 0) v += fullTurn;
        if (this.heading == v) return;
        this.change("heading", this.heading, this.#heading=v);
    }
    get useHeading() { return this.#useHeading; }
    set useHeading(v) {
        v = !!v;
        if (this.useHeading == v) return;
        this.change("useHeading", this.useHeading, this.#useHeading=v);
    }
    get velocity() { return this.#velocity; }
    set velocity(v) { this.#velocity.set(v); }
    get velocityX() { return this.velocity.x; }
    set velocityX(v) { this.velocity.x = v; }
    get velocityY() { return this.velocity.y; }
    set velocityY(v) { this.velocity.y = v; }
    get velocityRot() { return this.#velocityRot; }
    set velocityRot(v) {
        v = util.ensure(v, "num");
        if (this.velocityRot == v) return;
        this.change("velocityRot", this.velocityRot, this.#velocityRot=v);
    }
    get useVelocity() { return this.#useVelocity; }
    set useVelocity(v) {
        v = !!v;
        if (this.useVelocity == v) return;
        this.change("useVelocity", this.useVelocity, this.#useVelocity=v);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            pos: this.pos,
            heading: this.heading, useHeading: this.useHeading,
            velocity: this.velocity, velocityRot: this.velocityRot, useVelocity: this.useVelocity,
        });
    }
}
Project.Obstacle = class ProjectObstacle extends Project.Item {
    #radius;

    constructor(...a) {
        super();

        this.#radius = 0;

        if (a.length <= 0 || a.length > 2) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Obstacle) a = [a.pos, a.radius];
            else if (a instanceof Project.Item) a = [a.pos, 100];
            else if (util.is(a, "arr")) {
                a = new Project.Obstacle(...a);
                a = [a.pos, a.radius];
            }
            else if (a instanceof V) a = [a, 100];
            else if (util.is(a, "obj")) a = [a.pos, a.radius];
            else a = [0, a];
        }

        [this.pos, this.radius] = a;
    }

    get radius() { return this.#radius; }
    set radius(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.radius == v) return;
        this.change("radius", this.radius, this.#radius=v);
    }

    getBBox() {
        return new util.Rect(this.pos.sub(this.radius), new V(this.radius).mul(2));
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            pos: this.pos,
            radius: this.radius,
        });
    }
}
Project.Path = class ProjectPath extends util.Target {
    #id;

    #name;
    #nodes;

    constructor(...a) {
        super();

        this.#id = null;

        this.#name = null;
        this.#nodes = [];

        if (a.length <= 0 || a.length > 2) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Path) a = [a.name, a.nodes];
            else if (util.is(a, "arr")) {
                a = new Project.Path(...a);
                a = [a.name, a.nodes];
            }
            else if (util.is(a, "str")) a = [a, []];
            else if (util.is(a, "obj")) a = [a.name, a.nodes];
            else a = ["", []];
        }

        [this.name, this.nodes] = a;
    }

    get id() { return this.#id; }
    set id(v) { this.#id = (v == null) ? null : String(v); }

    get name() { return this.#name; }
    set name(v) {
        v = (v == null) ? "" : String(v);
        if (this.name == v) return;
        this.#name = v;
    }

    get nodes() { return [...this.#nodes]; }
    set nodes(v) {
        v = util.ensure(v, "arr");
        this.clearNodes(v);
        v.forEach(v => this.addNode(v));
    }
    clearNodes() {
        let nodes = this.nodes;
        nodes.forEach(node => this.remNode(node));
        return nodes;
    }
    hasNode(node) {
        if (util.is(node, "str")) return this.#nodes.includes(node);
        if (node instanceof Project.Node) return this.hasNode(node.id);
        return false;
    }
    addNode(node) {
        if (util.is(node, "str")) {
            this.#nodes.push(node);
            this.change("addNode", null, node);
            return node;
        }
        if (node instanceof Project.Node) return this.addNode(node.id);
        return false;
    }
    remNode(node) {
        if (!this.hasNode(node)) return false;
        if (util.is(node, "str")) {
            this.#nodes.splice(this.#nodes.lastIndexOf(node), 1);
            this.change("remNode", node, null);
            return node;
        }
        if (node instanceof Project.Node) return this.remNode(node.id);
        return false;
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            name: this.name,
            nodes: this.nodes,
        });
    }
}

export const REVIVER = new util.Reviver(util.REVIVER);
REVIVER.addRuleAndAllSub(Project);