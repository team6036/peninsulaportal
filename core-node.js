const util = require("./util-node");
const V = util.V;

class Target {
    #handlers;

    constructor() {
        this.#handlers = {};
    }

    addHandler(e, f) {
        e = String(e);
        if (!util.is(f, "func")) return false;
        if (!(e in this.#handlers)) this.#handlers[e] = new Set();
        if (this.#handlers[e].has(f)) return false;
        this.#handlers[e].add(f);
        return f;
    }
    remHandler(e, f) {
        e = String(e);
        if (!util.is(f, "func")) return false;
        if (!(e in this.#handlers)) return false;
        if (!this.#handlers[e].has(e)) return false;
        this.#handlers[e].delete(f);
        return f;
    }
    hasHandler(e, f) {
        e = String(e);
        if (!util.is(f, "func")) return false;
        if (!(e in this.#handlers)) return false;
        return this.#handlers[e].has(f);
    }
    async post(e, data) {
        if (!(e in this.#handlers)) return [];
        let fs = [...this.#handlers[e]];
        fs = fs.map(f => (async () => {
            if (f.constructor.name == "AsyncFunction") return await f(data);
            else if (f.constructor.name == "Function") return f(data);
        }));
        return await Promise.all(fs.map(f => f()));
    }
}

class Reviver {
    #rules;

    constructor(reviver=null) {
        this.#rules = {};

        if (reviver instanceof Reviver)
            reviver.rules.forEach(cons => this.addRule(cons));
    }

    get rules() { return Object.values(this.#rules); }
    set rules(v) {
        v = util.ensure(v, "arr");
        this.clearRules();
        v.forEach(v => this.addRule(v));
    }
    clearRules() {
        let rules = this.rules;
        rules.forEach(cons => this.remRule(cons));
        return rules;
    }
    hasRule(v) {
        if (util.is(v, "str")) return v in this.#rules;
        if (util.is(v, "func")) return this.hasRule(v.name);
        return false;
    }
    getRule(name) {
        name = String(name);
        if (!this.hasRule(name)) return null;
        return this.#rules[name];
    }
    addRule(constructor) {
        if (!util.is(constructor, "func")) return false;
        this.#rules[constructor.name] = constructor;
        return constructor;
    }
    remRule(constructor) {
        if (!util.is(constructor, "func")) return false;
        delete this.#rules[constructor.name];
        return constructor;
    }
    addRuleAndAllSub(constructor) {
        if (!util.is(constructor, "func")) return false;
        if (this.hasRule(constructor)) return constructor;
        this.addRule(constructor);
        for (let k in constructor) this.addRuleAndAllSub(constructor[k]);
        return constructor;
    }

    get f() {
        return (k, v) =>  {
            if (util.is(v, "obj")) {
                if (!("%CUSTOM" in v)) return v;
                if (!("%OBJ" in v)) return v;
                if (!("%ARGS" in v)) return v;
                if (!v["%CUSTOM"]) return v;
                if (!this.hasRule(v["%OBJ"])) return v;
                let rule = this.getRule(v["%OBJ"]);
                return new rule(...util.ensure(v["%ARGS"], "arr"));
            }
            return v;
        };
    }
}

const REVIVER = new Reviver();
REVIVER.addRuleAndAllSub(V);
REVIVER.addRuleAndAllSub(util.V3);
REVIVER.addRuleAndAllSub(util.Shape);

exports.Target = Target;
exports.Reviver = Reviver;
exports.REVIVER = REVIVER;
