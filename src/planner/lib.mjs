import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";


export class Project extends lib.Project {
    #template;
    #items;
    #paths;
    #size;
    #robotSize;
    #robotMass;
    #sidePos;
    #maximized;

    constructor(...a) {
        super();

        this.#template = null;
        this.#items = {};
        this.#paths = {};
        this.#size = new V();
        this.#robotSize = new V();
        this.#robotMass = 0;
        this.#sidePos = 0.25;
        this.#maximized = false;

        this.size.addHandler("change", (c, f, t) => this.change("size."+c, f, t));
        this.robotSize.addHandler("change", (c, f, t) => this.change("robotSize."+c, f, t));

        if (a.length <= 0 || a.length > 11) a = [null];
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
                a = [a.id, a.template, itms, pths, a.size, a.robotSize, a.robotMass, a.sidePos, a.maximized, a.config, a.meta];
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
                a = [a.id, a.template, itms, pths, a.size, a.robotSize, a.robotMass, a.sidePos, a.maximized, a.config, a.meta];
            }
            else if (a instanceof Project.Config) a = [null, {}, {}, [1000, 1000], [100, 100], 0, a, null];
            else if (a instanceof Project.Meta) a = [null, {}, {}, [1000, 1000], [100, 100], 0, null, a];
            else if (util.is(a, "str")) a = [null, {}, {}, [1000, 1000], [100, 100], 0, null, a];
            else if (util.is(a, "obj")) a = [a.id, a.template, a.items, a.paths, a.size, a.robotSize, a.robotMass, a.sidePos, a.maximized, a.config, a.meta];
            else a = [{}, {}];
        }
        if (a.length == 2)
            a = [null, ...a];
        if (a.length == 3)
            a = [...a, [1000, 1000]];
        if (a.length == 4)
            a = [...a, [100, 100], null, null];
        if (a.length == 5)
            a = [...a.slice(0, 4), [100, 100], 0, ...((a[4] instanceof Project.Config) ? [a[4], null] : (a[4] instanceof Project.Meta) ? [null, a[4]] : [null, null])];
        if (a.length == 6)
            a = [...a.slice(0, 4), [100, 100], 0, ...a.slice(4)];
        if (a.length == 7)
            a = [...a.slice(0, 5), 0, ...a.slice(5)];
        if (a.length == 8)
            a = [...a.slice(0, 6), 0.25, ...a.slice(6)];
        if (a.length == 9)
            a = [...a.slice(0, 7), false, ...a.slice(7)];
        if (a.length == 10)
            a = [null, ...a];

        [this.id, this.template, this.items, this.paths, this.size, this.robotSize, this.robotMass, this.sidePos, this.maximized, this.config, this.meta] = a;

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

    get template() { return this.#template; }
    set template(v) {
        v = (v == null) ? null : String(v);
        if (this.template == v) return;
        this.change("template", this.template, this.#template=v);
    }
    hasTemplate() { return this.template != null; }

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
        this.remItem(itms);
        return itms;
    }
    hasItem(id) {
        if (id instanceof Project.Item) return this.hasItem(id.id);
        return id in this.#items;
    }
    getItem(id) {
        id = String(id);
        if (!this.hasItem(id)) return null;
        return this.#items[id];
    }
    addItem(...itms) {
        return util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof Project.Item)) return false;
            if (this.hasItem(itm)) return false;
            while (itm.id == null || this.hasItem(itm.id))
                itm.id = util.jargonBase64(10);
            this.#items[itm.id] = itm;
            itm.addLinkedHandler(this, "change", (c, f, t) => this.change("getItem("+itm.id+")."+c, f, t));
            this.change("addItem", null, itm);
            itm.onAdd();
            return itm;
        });
    }
    remItem(...ids) {
        return util.Target.resultingForEach(ids, id => {
            if (id instanceof Project.Item) id = id.id;
            if (!this.hasItem(id)) return false;
            let itm = this.getItem(id);
            itm.onRem();
            itm.clearLinkedHandlers(this, "change");
            itm.id = null;
            delete this.#items[id];
            this.paths.forEach(id => {
                let pth = this.getPath(id);
                pth.nodes = pth.nodes.filter(id => this.hasItem(id) && this.getItem(id) instanceof Project.Node);
            });
            this.change("remItem", itm, null);
            return itm;
        });
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
        this.remPath(pths);
        return pths;
    }
    hasPath(id) {
        if (id instanceof Project.Path) return this.hasPath(id.id);
        return id in this.#paths;
    }
    getPath(id) {
        id = String(id);
        if (!this.hasPath(id)) return null;
        return this.#paths[id];
    }
    addPath(...pths) {
        return util.Target.resultingForEach(pths, pth => {
            if (!(pth instanceof Project.Path)) return false;
            if (this.hasPath(pth)) return false;
            while (pth.id == null || this.hasPath(pth.id))
                pth.id = util.jargonBase64(10);
            this.#paths[pth.id] = pth;
            pth.nodes = pth.nodes.filter(id => this.hasItem(id) && this.getItem(id) instanceof Project.Node);
            pth.addLinkedHandler(this, "change", (c, f, t) => this.change("getPath("+pth.id+")."+c, f, t));
            this.change("addPath", null, pth);
            pth.onAdd();
            return pth;
        });
    }
    remPath(...ids) {
        return util.Target.resultingForEach(ids, id => {
            if (id instanceof Project.Path) id = id.id;
            if (!this.hasPath(id)) return false;
            let pth = this.getPath(id);
            pth.onRem();
            pth.clearLinkedHandlers(this, "change");
            pth.id = null;
            delete this.#paths[id];
            this.change("remPath", pth, null);
            return pth;
        });
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

    get sidePos() { return this.#sidePos; }
    set sidePos(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num", 0.25)));
        if (this.sidePos == v) return;
        this.change("sidePos", this.sidePos, this.#sidePos=v);
    }

    get maximized() { return this.#maximized; }
    set maximized(v) {
        v = !!v;
        if (this.maximized == v) return;
        this.change("maximized", this.maximized, this.#maximized=v);
    }
    get minimized() { return !this.maximized; }
    set minimized(v) { this.maximized = !v; }
    maximize() { return this.maximized = true; }
    minimize() { return this.minimized = true; }
    
    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            id: this.id,
            template: this.template,
            items: this.#items,
            paths: this.#paths,
            size: this.size,
            robotSize: this.robotSize, robotMass: this.robotMass,
            sidePos: this.sidePos,
            maximized: this.maximized,
            config: this.config, meta: this.meta,
        });
    }
}
Project.Config = class ProjectConfig extends Project.Config {
    #script;
    #scriptPython;
    #scriptUseDefault;

    #options;

    constructor(...a) {
        super();

        this.#script = null;
        this.#scriptPython = "";
        this.#scriptUseDefault = false;

        this.#options = {};

        if (a.length <= 0 || ![1, 4].includes(a.length)) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Config) a = [a.script, a.scriptPython, a.scriptUseDefault, a.options];
            else if (util.is(a, "arr")) {
                a = new Project.Config(...a);
                a = [a.script, a.scriptPython, a.scriptUseDefault, a.options];
            }
            else if (util.is(a, "str")) a = [a, 0, 0, false];
            else if (util.is(a, "obj")) a = [a.script, a.scriptPython, a.scriptUseDefault, a.options];
            else a = [null, 0, 0, null];
        }

        [this.script, this.scriptPython, this.scriptUseDefault, this.options] = a;
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

    get optionKeys() { return Object.keys(this.#options); }
    get optionValues() { return Object.values(this.#options); }
    get options() {
        let options = {};
        this.optionKeys.forEach(k => (options[k] = this.getOption(k)));
        return options;
    }
    set options(v) {
        v = util.ensure(v, "obj");
        this.clearOptions();
        for (let k in v) this.setOption(k, v[k]);
    }
    clearOptions() {
        let options = this.options;
        this.optionKeys.forEach(k => this.delOption(k));
        return options;
    }
    hasOption(k) { return String(k) in this.#options; }
    getOption(k) {
        if (!this.hasOption(k)) return null;
        return this.#options[String(k)];
    }
    setOption(k, v) {
        k = String(k);
        v = String(v);
        let v2 = this.getOption(k);
        if (v == v2) return v2;
        this.#options[k] = v;
        this.change("setOption", v2, v);
        return v;
    }
    delOption(k) {
        let v = this.getOption(k);
        if (v == null) return v;
        delete this.#options[String(k)];
        this.change("delOption", v, null);
        return v;
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            script: this.script, scriptPython: this.scriptPython, scriptUseDefault: this.scriptUseDefault,
            options: this.options,
        });
    }
};
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
            if (a instanceof Project.Item) a = [a.id, a.pos];
            else if (util.is(a, "arr")) {
                a = new Project.Item(...a);
                a = [a.id, a.pos];
            }
            else if (util.is(a, "obj")) a = [a.id, a.pos];
            else a = [null, new V(a)];
        }

        [this.id, this.pos] = a;
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
            id: this.id,
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

    #options;

    constructor(...a) {
        super();

        this.#heading = 0;
        this.#useHeading = false;
        this.#velocity = new V();
        this.#velocityRot = 0;
        this.#useVelocity = true;

        this.#options = {};

        this.velocity.addHandler("change", (c, f, t) => this.change("velocity."+c, f, t));

        if (a.length <= 0 || a.length > 8) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Node) a = [a.id, a.pos, a.heading, a.useHeading, a.velocity, a.velocityRot, a.useVelocity, a.options];
            else if (a instanceof Project.Item) a = [a.id, a.pos, 0];
            else if (util.is(a, "arr")) {
                a = new Project.Node(...a);
                a = [a.id, a.pos, a.heading, a.useHeading, a.velocity, a.velocityRot, a.useVelocity, a.options];
            }
            else if (util.is(a, "obj")) a = [a.id, a.pos, a.heading, a.useHeading, a.velocity, a.velocityRot, a.useVelocity, a.options];
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
        if (a.length == 6)
            a = [...a, {}];
        if (a.length == 7)
            a = [null, ...a];
        
        [this.id, this.pos, this.heading, this.useHeading, this.velocity, this.velocityRot, this.useVelocity, this.options] = a;
    }

    get heading() { return this.#heading; }
    set heading(v) {
        v = util.clamAngleRadians(v);
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

    get optionKeys() { return Object.keys(this.#options); }
    get optionValues() { return Object.values(this.#options); }
    get options() {
        let options = {};
        this.optionKeys.forEach(k => (options[k] = this.getOption(k)));
        return options;
    }
    set options(v) {
        v = util.ensure(v, "obj");
        this.clearOptions();
        for (let k in v) this.setOption(k, v[k]);
    }
    clearOptions() {
        let options = this.options;
        this.optionKeys.forEach(k => this.delOption(k));
        return options;
    }
    hasOption(k) { return String(k) in this.#options; }
    getOption(k) {
        if (!this.hasOption(k)) return null;
        return this.#options[String(k)];
    }
    setOption(k, v) {
        k = String(k);
        v = String(v);
        let v2 = this.getOption(k);
        if (v == v2) return v2;
        this.#options[k] = v;
        this.change("setOption", v2, v);
        return v;
    }
    delOption(k) {
        let v = this.getOption(k);
        if (v == null) return v;
        delete this.#options[String(k)];
        this.change("delOption", v, null);
        return v;
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            id: this.id,
            pos: this.pos,
            heading: this.heading, useHeading: this.useHeading,
            velocity: this.velocity, velocityRot: this.velocityRot, useVelocity: this.useVelocity,
            options: this.options,
        });
    }
}
Project.Obstacle = class ProjectObstacle extends Project.Item {
    #radius;

    constructor(...a) {
        super();

        this.#radius = 0;

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Obstacle) a = [a.id, a.pos, a.radius];
            else if (a instanceof Project.Item) a = [a.id, a.pos, 100];
            else if (util.is(a, "arr")) {
                a = new Project.Obstacle(...a);
                a = [a.id, a.pos, a.radius];
            }
            else if (a instanceof V) a = [a, 100];
            else if (util.is(a, "obj")) a = [a.id, a.pos, a.radius];
            else a = [0, a];
        }
        if (a.length == 2) a = [null, ...a];

        [this.id, this.pos, this.radius] = a;
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
            id: this.id,
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

        if (a.length <= 0 || a.length > 3) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Project.Path) a = [a.name, a.nodes];
            else if (util.is(a, "arr")) {
                a = new Project.Path(...a);
                a = [a.name, a.nodes];
            }
            else if (util.is(a, "str")) a = [a, []];
            else if (util.is(a, "obj")) a = [a.id, a.name, a.nodes];
            else a = ["", []];
        }
        if (a.length == 2) a = [null, ...a];

        [this.id, this.name, this.nodes] = a;
    }

    get id() { return this.#id; }
    set id(v) { this.#id = (v == null) ? null : String(v); }

    get name() { return this.#name; }
    set name(v) {
        v = (v == null) ? "" : String(v);
        if (this.name == v) return;
        this.change("name", this.name, this.#name=v);
    }

    get nodes() { return [...this.#nodes]; }
    set nodes(v) {
        v = util.ensure(v, "arr");
        this.clearNodes(v);
        this.addNode(v);
    }
    clearNodes() {
        let nodes = this.nodes;
        this.remNode(nodes);
        return nodes;
    }
    hasNode(node) {
        if (node instanceof Project.Node) return this.hasNode(node.id);
        return this.#nodes.includes(String(node));
    }
    addNode(...nodes) {
        return util.Target.resultingForEach(nodes, node => {
            if (node instanceof Project.Node) node = node.id;
            node = String(node);
            this.#nodes.push(node);
            this.change("addNode", null, node);
            return node;
        });
    }
    remNode(...nodes) {
        return util.Target.resultingForEach(nodes, node => {
            if (node instanceof Project.Node) node = node.id;
            if (!this.hasNode(node)) return false;
            node = String(node);
            this.#nodes.splice(this.#nodes.lastIndexOf(node), 1);
            this.change("remNode", node, null);
            return node;
        });
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            id: this.id,
            name: this.name,
            nodes: this.nodes,
        });
    }
}

export const REVIVER = new util.Reviver(util.REVIVER);
REVIVER.addRuleAndAllSub(Project);