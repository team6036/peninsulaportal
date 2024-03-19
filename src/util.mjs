export const EPSILON = 0.000001;

export const NUMBERS = "0123456789";
export const ALPHABETUPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const ALPHABETLOWER = ALPHABETUPPER.toLowerCase();
export const ALPHABETALL = ALPHABETLOWER+ALPHABETUPPER;
export const BASE16 = NUMBERS+ALPHABETLOWER.slice(0, 6);
export const BASE64 = NUMBERS+ALPHABETALL+"-_";
export const VARIABLE = NUMBERS+ALPHABETALL+"_";

export const MAGIC = "_*[[;ƒ";


Array.prototype.sum = function() {
    return this.reduce((sum, x) => sum+x, 0);
};
Array.prototype.flatten = function() {
    return this.reduce((sum, x) => {
        if (!is(x, "arr")) sum.push(x);
        else sum.push(...Array.from(x).flatten());
        return sum;
    }, []);
};
Array.prototype.collapse = function() {
    return this.reduce((sum, x) => {
        if (!is(x, "arr")) sum.push(x);
        else sum.push(...x);
        return sum;
    }, []);
};
Array.prototype.all = function(f=null) {
    for (let v of this) {
        if (f == null) {
            if (!v) return false;
        } else if (!f(v)) return false;
    }
    return true;
};
Array.prototype.any = function(f=null) {
    for (let v of this) {
        if (f == null) {
            if (v) return true;
        } else if (f(v)) return true;
    }
    return false;
};


export function is(o, type) {
    if (type == "num" || type == "float")
        return (typeof(o) == "number") && !Number.isNaN(o) && Number.isFinite(o);
    if (type == "int")
        return (typeof(o) == "number") && !Number.isNaN(o) && Number.isFinite(o) && (o % 1 == 0);
    if (type == "any_num")
        return (typeof(o) == "number") && !Number.isNaN(o);
    let typefs = {
        bool: () => {
            return typeof(o) == "boolean";
        },
        str: () => {
            return typeof(o) == "string";
        },
        arr: () => {
            return Array.isArray(o) || (
                o &&
                typefs.obj() &&
                is(o.length, "num") && 
                ((o.length == 0) || (o.length > 0 && (o.length - 1) in o)) &&
                !(o instanceof Target)
            );
        },
        obj: () => {
            return (typeof(o) == "object") && !is(o, "null");
        },
        func: () => {
            return typeof(o) == "function";
        },
        async_func: () => {
            return typefs.func() && o.constructor.name == "AsyncFunction";
        },
        null: () => {
            return o == null;
        },
    };
    if (type in typefs) return typefs[type]();
    if (is(type, "func")) return o instanceof type;
    return o == type;
}

export function ensure(o, type) {
    let useDef = arguments.length != 3;
    let def = arguments[2];
    if (type == "num" || type == "float")
        return ((typeof(o) == "number") && !Number.isNaN(o) && Number.isFinite(o)) ? o : useDef ? 0 : def;
    if (type == "int")
        return ((typeof(o) == "number") && !Number.isNaN(o) && Number.isFinite(o)) ? Math.round(o) : useDef ? 0 : def;
    if (type == "any_num")
        return ((typeof(o) == "number") && !Number.isNaN(o)) ? o : useDef ? 0 : def;
    let typefs = {
        bool: () => {
            return !!o;
        },
        str: () => {
            if (is(o, "str")) return o;
            return useDef ? "" : def;
        },
        arr: () => {
            if (is(o, "arr")) return Array.from(o);
            return useDef ? [] : def;
        },
        obj: () => {
            if (is(o, "obj")) return o;
            return useDef ? {} : def;
        },
        func: () => {
            if (is(o, "func")) return o;
            return useDef ? ()=>{} : def;
        },
        async_func: () => {
            if (is(o, "async_func")) return o;
            if (is(o, "func")) return async () => o();
            return useDef ? async()=>{} : def;
        },
        null: () => {
            return null;
        },
    };
    if (type in typefs) return typefs[type]();
    if (is(o, type)) return o;
    return useDef ? null : def;
}

export function arrEquals(a1, a2) {
    a1 = ensure(a1, "arr");
    a2 = ensure(a2, "arr");
    if (a1.length != a2.length) return false;
    for (let i = 0; i < a1.length; i++)
        if (a1[i] != a2[i]) return false;
    return true;
}

export function sin(x) { return Math.sin(x * (Math.PI/180)); }
export function cos(x) { return Math.cos(x * (Math.PI/180)); }

export function lerp(a, b, p) {
    p = ensure(p, "num");
    if (is(a, "num") && is(b, "num")) return a + p*(b-a);
    if ((a instanceof V) || (b instanceof V)) {
        a = new V(a);
        b = new V(b);
        return new V(lerp(a.x, b.x, p), lerp(a.y, b.y, p));
    }
    if ((a instanceof V3) || (b instanceof V3)) {
        a = new V3(a);
        b = new V3(b);
        return new V3(lerp(a.x, b.x, p), lerp(a.y, b.y, p), lerp(a.z, b.z, p));
    }
    if ((a instanceof Color) && (b instanceof Color)) {
        return new Color(lerp(a.r, b.r, p), lerp(a.g, b.g, p), lerp(a.b, b.b, p), lerp(a.a, b.a, p));
    }
    return null;
}

export function lerpE(a, b, p) {
    p = ensure(p, "num");
    if (is(a, "num") && is(b, "num")) {
        if (p > 0) {
            if (Math.abs(a-b) > EPSILON) return lerp(a, b, p);
            return b;
        }
        return lerp(a, b, p);
    }
    if ((a instanceof V) || (b instanceof V)) {
        a = new V(a);
        b = new V(b);
        return new V(lerpE(a.x, b.x, p), lerpE(a.y, b.y, p));
    }
    if ((a instanceof V3) || (b instanceof V3)) {
        a = new V3(a);
        b = new V3(b);
        return new V3(lerpE(a.x, b.x, p), lerpE(a.y, b.y, p), lerpE(a.z, b.z, p));
    }
    if ((a instanceof Color) && (b instanceof Color)) {
        return new Color(lerpE(a.r, b.r, p), lerpE(a.g, b.g, p), lerpE(a.b, b.b, p), lerpE(a.a, b.a, p));
    }
    return null;
}

export function clampAngle(x) { return ((ensure(x, "num")%360)+360)%360; }
const FULLTURN = 2*Math.PI;
export function clamAngleRadians(x) { return ((ensure(x, "num")%FULLTURN)+FULLTURN)%FULLTURN; }

export function angleRel(a, b) {
    let r = clampAngle(clampAngle(b) - clampAngle(a));
    if (r > 180) r -= 360;
    return r;
}
export function angleRelRadians(a, b) {
    let r = clamAngleRadians(clamAngleRadians(b) - clamAngleRadians(a));
    if (r > FULLTURN/2) r -= FULLTURN;
    return r;
}

export function getTime() {
    return new Date().getTime();
}
export const UNITVALUES = {
    ms: 1,
    s: 1000,
    min: 60,
    hr: 60,
    d: 24,
    yr: 365,
};
export function splitTimeUnits(t) {
    t = Math.max(0, ensure(t, "num"));
    let units = Object.keys(UNITVALUES);
    let values = new Array(units.length).fill(0);
    values[0] = t;
    units.forEach((unit, i) => {
        if (i <= 0) return;
        values[i] += Math.floor(values[i-1]/UNITVALUES[unit]);
        values[i-1] -= values[i]*UNITVALUES[unit];
    });
    return values;
}
export function formatTime(t) {
    t = ensure(t, "num");
    let negative = t < 0;
    t = Math.abs(t);
    let split = splitTimeUnits(t);
    split[0] = Math.round(split[0]);
    while (split.length > 2) {
        if (split.at(-1) > 0) break;
        split.pop();
    }
    split = split.map((v, i) => {
        v = String(v);
        if (i >= split.length-1) return v;
        let l = String(Object.values(UNITVALUES)[i+1]-1).length;
        if (i > 0) v = v.padStart(l, "0");
        else v = v.padEnd(l, "0");
        return v;
    });
    return (negative?"-":"")+split.slice(1).reverse().join(":")+"."+split[0];
}
export function formatText(s) {
    s = String(s);
    if (s.length <= 0) return s;
    return s.split("").map((c, i) => {
        if (!ALPHABETALL.includes(c)) {
            if ("-_/ \\|,.".includes(c)) return " ";
            return c;
        }
        if (i <= 0 || !ALPHABETALL.includes(s[i-1]))
            return c.toUpperCase();
        return c.toLowerCase();
    }).join("");
}

export function loadImage(src) {
    return new Promise((res, rej) => {
        let img = new Image();
        img.addEventListener("load", e => res(img));
        img.addEventListener("error", e => rej(e));
        img.src = src;
    });
}

export async function wait(t) {
    return await new Promise((res, rej) => setTimeout(() => res(), t));
}
export async function timeout(t, v) {
    return await new Promise((res, rej) => {
        (async () => {
            if (is(v, "async_func")) {
                try {
                    res(await v());
                } catch (e) { rej(e); }
                return;
            }
            if (is(v, "func")) {
                try {
                    res(v());
                } catch (e) { rej(e); }
                return;
            }
            if (v instanceof Promise) {
                try {
                    res(await v);
                } catch (e) { rej(e); }
                return;
            }
            return rej(v);
        })();
        (async () => {
            await wait(t);
            rej("timeout");
        })();
    });
}

export function generateArrayPath(...path) { return path.flatten().join("/").split("/").filter(part => part.length > 0); }
export function generatePath(...path) { return generateArrayPath(...path).join("/"); }

export function compareStr(s1, s2) {
    s1 = String(s1).toLowerCase();
    s2 = String(s2).toLowerCase();
    if (is(parseInt(s1), "int") && is(parseInt(s2), "int")) return s1 - s2;
    if (s1 < s2) return -1;
    if (s1 > s2) return +1;
    return 0;
}

export function choose(source) {
    if (!is(source, "arr") && !is(source, "str")) source = [];
    return source[Math.floor(source.length*Math.random())];
}
export function jargon(l, source) {
    l = Math.max(0, ensure(l, "int"));
    source = String(source);
    return new Array(l).fill(null).map(_ => choose(source)).join("");
}
export function jargonNumbers(l) { return jargon(l, NUMBERS); }
export function jargonAlphabetUpper() { return jargon(l, ALPHABETUPPER); }
export function jargonAlphabetLower() { return jargon(l, ALPHABETLOWER); }
export function jargonAlphabetAll() { return jargon(l, ALPHABETALL); }
export function jargonBase16(l) { return jargon(l, BASE16); }
export function jargonBase64(l) { return jargon(l, BASE64); }
export function jargonVariable(l) { return jargon(l, VARIABLE); }

export const ease = {
    // https://easings.net/

    sinI: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - Math.cos((t * Math.PI) / 2);
    },
    sinO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.sinI(1 - t);
    },
    sinIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return -(Math.cos(Math.PI * t) - 1) / 2;
    },
    sin: (t, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("sin"+m in ease) return ease["sin"+m](t);
        return t;
    },

    quadI: t =>  {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t * t;
    },
    quadO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.quadI(1 - t);
    },
    quadIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    },
    quad: (t, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("quad"+m in ease) return ease["quad"+m](t);
        return t;
    },

    cubicI: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t * t * t;
    },
    cubicO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.cubicI(1 - t);
    },
    cubicIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    cubic: (t, m) =>  {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("cubic"+m in ease) return ease["cubic"+m](t);
        return t;
    },

    quartI: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t * t * t * t;
    },
    quartO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.quartI(1 - t);
    },
    quartIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    },
    quart: (t, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("quart"+m in ease) return ease["quart"+m](t);
        return t;
    },

    quintI: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t * t * t * t * t;
    },
    quintO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.quintI(1 - t);
    },
    quintIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
    },
    quint: (t, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("quint"+m in ease) return ease["quint"+m](t);
        return t;
    },

    expoI: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    },
    expoO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.expoI(1 - t);
    },
    expoIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t === 0
            ? 0
            : t === 1
            ? 1
            : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2
            : (2 - Math.pow(2, -20 * t + 10)) / 2;
    },
    expo: (t, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("expo"+m in ease) return ease["expo"+m](t);
        return t;
    },

    circI: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - Math.sqrt(1 - Math.pow(t, 2));
    },
    circO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.circI(1 - t);
    },
    circIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t < 0.5
            ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
            : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
    },
    circ: (t, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("circ"+m in ease) return ease["circ"+m](t);
        return t;
    },

    backI: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * t * t * t - c1 * t * t;
    },
    backO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.backI(1 - t);
    },
    backIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        const c1 = 1.70158;
        const c2 = c1 * 1.525;
        return t < 0.5
            ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
            : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    },
    back: (t, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("back"+m in ease) return ease["back"+m](t);
        return t;
    },

    elasticI: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        const c4 = (2 * Math.PI) / 3;
        return t === 0
            ? 0
            : t === 1
            ? 1
            : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    },
    elasticO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.elasticI(1 - t);
    },
    elasticIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        const c5 = (2 * Math.PI) / 4.5;
        return t === 0
            ? 0
            : t === 1
            ? 1
            : t < 0.5
            ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
            : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
    },
    elastic: (t, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("elastic"+m in ease) return ease["elastic"+m](t);
        return t;
    },

    bounceI: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return 1 - ease.bounceO(1 - t);
    },
    bounceO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    },
    bounceIO: t => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        return t < 0.5
            ? (1 - ease.bounceO(1 - 2 * t)) / 2
            : (1 + ease.bounceI(2 * t - 1)) / 2;
    },
    bounce: (t, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        m = String(m).toUpperCase();
        if ("bounce"+m in ease) return ease["bounce"+m](t);
        return t;
    },

    ease: (t, e, m) => {
        t = Math.min(1, Math.max(0, ensure(t, "num")));
        e = String(e).toLowerCase();
        m = String(m).toUpperCase();
        if (e in ease) return ease[e](t, m);
        return t;
    },
}

export class Target {
    #handlers;
    #nHandlers;

    constructor() {
        this.#handlers = new Map();
        this.#nHandlers = 0;
    }

    static resultingForEach(input, callback) {
        input = [input].flatten();
        if (input.length == 1) {
            let r = callback(input[0]);
            if (r == false) return false;
            return r;
        }
        let r = [];
        input.forEach(input => {
            let r2 = callback(input);
            if (r2 == false) return;
            r.push(r2);
        });
        return r;
    }

    addLinkedHandler(o, e, f) {
        e = String(e);
        if (!is(f, "func")) return false;
        if (!this.#handlers.has(o)) this.#handlers.set(o, {});
        let handlers = this.#handlers.get(o);
        if (!(e in handlers)) handlers[e] = new Set();
        if (handlers[e].has(f)) return false;
        handlers[e].add(f);
        this.#nHandlers++;
        return f;
    }
    remLinkedHandler(o, e, f) {
        e = String(e);
        if (!is(f, "func")) return false;
        if (!this.#handlers.has(o)) return false;
        let handlers = this.#handlers.get(o);
        if (!(e in handlers)) return false;
        if (!handlers[e].has(f)) return false;
        handlers[e].delete(f);
        this.#nHandlers--;
        if (handlers[e].size <= 0) delete handlers[e];
        if (Object.keys(handlers).length <= 0) this.#handlers.delete(o);
        return f;
    }
    hasLinkedHandler(o, e, f) {
        e = String(e);
        if (!is(f, "func")) return false;
        if (!this.#handlers.has(o)) return false;
        let handlers = this.#handlers.get(o);
        if (!(e in handlers)) return false;
        return handlers[e].has(f);
    }
    getLinkedHandlers(o, e) {
        e = String(e);
        if (!this.#handlers.has(o)) return [];
        let handlers = this.#handlers.get(o);
        if (!(e in handlers)) return [];
        return [...handlers[e]];
    }
    clearLinkedHandlers(o, e) {
        let fs = this.getLinkedHandlers(o, e);
        fs.forEach(f => this.remLinkedHandler(o, e, f));
        return fs;
    }

    addHandler(e, f) { return this.addLinkedHandler(null, e, f); }
    remHandler(e, f) { return this.remLinkedHandler(null, e, f); }
    hasHandler(e, f) { return this.hasLinkedHandler(null, e, f); }
    getHandlers(e) { return this.getLinkedHandlers(null, e); }
    clearHandlers(e) { return this.clearLinkedHandlers(null, e); }
    post(e, ...a) {
        if (this.#nHandlers <= 0) return;
        e = String(e);
        for (let handlers of this.#handlers.values()) {
            if (!(e in handlers)) continue;
            handlers[e].forEach(f => f(...a));
        }
    }
    async postResult(e, ...a) {
        if (this.#nHandlers <= 0) return [];
        e = String(e);
        let fs = [];
        for (let handlers of this.#handlers.values()) {
            if (!(e in handlers)) continue;
            fs.push(...handlers[e]);
        }
        fs = fs.map(f => (async () => {
            if (f.constructor.name == "AsyncFunction") return await f(...a);
            else if (f.constructor.name == "Function") return f(...a);
        }));
        return await Promise.all(fs.map(f => f()));
    }
    change(attr, f, t) {
        if (this.#nHandlers <= 0) return [];
        attr = String(attr);
        this.post("change", attr, f, t);
        this.post("change-"+attr, f, t);
    }
    onAdd() { return this.post("add"); }
    onRem() { return this.post("rem"); }
}

export class Color extends Target {
    #r; #g; #b; #a;
    #hsv;

    #hex;
    #hexNoAlpha;
    #rgba;
    #rgb;

    constructor(...a) {
        super();

        this.#r = this.#g = this.#b = this.#a = null;
        this.#hsv = null;

        if (a.length <= 0 || a.length == 2 || a.length > 4) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Color) a = a.rgba;
            else if (a instanceof V3) a = [...a.xyz, 1];
            else if (a instanceof V4) a = a.wxyz;
            else if (is(a, "arr")) a = new Color(...a).rgba;
            else if (is(a, "obj")) a = [a.r, a.g, a.b, a.a];
            else if (is(a, "num")) {
                if (a < 0) a = new Array(3).fill(-a);
                else if (a <= 0xffff) {
                    let rgba = new Array(4).fill(null).map(_ => {
                        let x = a % 16;
                        a = Math.floor(a / 16);
                        return x;
                    }).reverse();
                    a = rgba.map(x => x*16+x);
                    a[3] /= 255;
                } else if (a <= 0xffffffff) {
                    let rgba = new Array(4).fill(null).map(_ => {
                        let x = a % 256;
                        a = Math.floor(a / 256);
                        return x;
                    }).reverse();
                    a = rgba;
                    a[3] /= 255;
                } else a = [0, 0, 0];
            }
            else if (is(a, "str")) {
                if (a[0] == "#") {
                    a = a.slice(1).toLowerCase();
                    let all = true;
                    for (let c of a) {
                        if (BASE16.includes(c)) continue;
                        all = false;
                        break;
                    }
                    if (!all) a = [0, 0, 0];
                    else {
                        if (a.length == 3 || a.length == 4)
                            a = new Array(a.length).fill(null).map((_, i) => BASE16.indexOf(a[i])).map(x => x*16+x);
                        else if (a.length == 6 || a.length == 8)
                            a = new Array(a.length/2).fill(null).map((_, i) => BASE16.indexOf(a[2*i])*16+BASE16.indexOf(a[2*i+1]));
                        else a = [0, 0, 0];
                    }
                    if (a.length == 4) a[3] /= 255;
                } else if (a.startsWith("rgb")) {
                    a = a.slice(a.startsWith("rgba") ? 4 : 3);
                    if (a.at(0) == "(" && a.at(-1) == ")") {
                        a = a.slice(1, -1);
                        a = a.split(",").map(v => v.trim()).map(v => parseFloat(v));
                        a = new Color(...a).rgba;
                    } else a = [0, 0, 0];
                } else if (a.startsWith("--")) {
                    a = new Color(getComputedStyle(document.body).getPropertyValue(a)).rgba;
                } else a = [0, 0, 0];
            }
            else a = [0, 0, 0];
        }
        if (a.length == 3) a = [...a, 1];

        [this.r, this.g, this.b, this.a] = a;
    }

    set(...a) { this.rgba = new Color(...a).rgba; return this; }

    #uncache() { this.#hsv = this.#hex = this.#hexNoAlpha = this.#rgba = this.#rgb = null; }

    get r() { return this.#r; }
    set r(v) {
        v = Math.min(255, Math.max(0, ensure(v, "num")));
        if (this.r == v) return;
        this.#uncache();
        this.change("r", this.r, this.#r=v);
    }
    get g() { return this.#g; }
    set g(v) {
        v = Math.min(255, Math.max(0, ensure(v, "num")));
        if (this.g == v) return;
        this.#uncache();
        this.change("g", this.g, this.#g=v);
    }
    get b() { return this.#b; }
    set b(v) {
        v = Math.min(255, Math.max(0, ensure(v, "num")));
        if (this.b == v) return;
        this.#uncache();
        this.change("b", this.b, this.#b=v);
    }
    get a() { return this.#a; }
    set a(v) {
        v = Math.min(1, Math.max(0, ensure(v, "num")));
        if (this.a == v) return;
        this.#uncache();
        this.change("a", this.a, this.#a=v);
    }
    get rgb() { return [this.r, this.g, this.b]; }
    set rgb(v) { [this.r, this.g, this.b] = new Color(v).rgb; }
    get rgba() { return [this.r, this.g, this.b, this.a]; }
    set rgba(v) { [this.r, this.g, this.b, this.a] = new Color(v).rgba; }

    diff(...v) {
        v = new Color(...v);
        return (
            Math.abs(this.r-v.r) +
            Math.abs(this.g-v.g) +
            Math.abs(this.b-v.b) +
            Math.abs(this.a-v.a)
        ) / 4;
    }

    get hsva() {
        if (this.#hsv == null) {
            let r = this.r/255, g = this.g/255, b = this.b/255;
            let cMax = Math.max(r, g, b), cMin = Math.min(r, g, b);
            let delta = cMax - cMin;
            let h = 0;
            if (delta > 0) {
                let rgb = [r, g, b];
                for (let i = 0; i < 3; i++) {
                    if (cMax != rgb[i]) continue;
                    h = 60 * (((((rgb[(i+1)%3]-rgb[(i+2)%3])/delta + i*2)%6)+6)%6);
                    break;
                }
            }
            let s = (cMax > 0) ? (delta/cMax) : 0;
            let v = cMax;
            this.#hsv = [h, s, v];
        }
        return [...this.#hsv, this.a];
    }
    set hsva(hsva) {
        hsva = ensure(hsva, "arr");
        if (hsva.length != 4) hsva = [0, 0, 0, 1];
        hsva = hsva.map(v => ensure(v, "num"));
        hsva[0] = clampAngle(hsva[0]);
        for (let i = 1; i < 4; i++) hsva[i] = Math.min(1, Math.max(0, hsva[i]));
        let h, s, v, a;
        [h, s, v, a] = hsva;
        let c = v * s;
        let x = c * (1-Math.abs(((h/60)%2)-1));
        let m = v - c;
        let rgb = [0, 0, 0];
        for (let i = 0; i < 3; i++) {
            if (h >= (i+1)*120) continue;
            let u = i, v = (i+1)%3;
            if (h >= (i+0.5)*120) [u, v] = [v, u];
            rgb[u] = c;
            rgb[v] = x;
            break;
        }
        rgb = rgb.map(v => (v+m)*255);
        this.rgba = [...rgb, a];
    }
    get h() { return this.hsva[0]; }
    set h(v) {
        let hsva = this.hsva;
        hsva[0] = v;
        this.hsva = hsva;
    }
    get s() { return this.hsva[1]; }
    set s(v) {
        let hsva = this.hsva;
        hsva[1] = v;
        this.hsva = hsva;
    }
    get v() { return this.hsva[2]; }
    set v(v) {
        let hsva = this.hsva;
        hsva[2] = v;
        this.hsva = hsva;
    }
    get hsv() { return this.hsva.slice(0, 3); }
    set hsv(hsv) {
        hsv = ensure(hsv, "arr");
        if (hsv.length != 3) hsv = [0, 0, 0];
        let hsva = this.hsva;
        [hsva[0], hsva[1], hsva[2]] = hsv;
        this.hsva = hsva;
    }

    toHex(a=true) {
        let v = a ? this.#hex : this.#hexNoAlpha;
        if (v == null) {
            v = "#"+(a ? this.rgba : this.rgb).map((v, i) => {
                if (i == 3) v *= 255;
                v = Math.round(v);
                return BASE16[Math.floor(v/16)]+BASE16[v%16];
            }).join("");
            a ? (this.#hex=v) : (this.#hexNoAlpha=v);
        }
        return v;
    }
    toRGBA() {
        if (this.#rgba == null) this.#rgba = "rgba("+this.rgba.join(",")+")";
        return this.#rgba;
    }
    toRGB() {
        if (this.#rgb == null) this.#rgb = "rgb("+this.rgb.join(",")+")";
        return this.#rgb;
    }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            r: this.r,
            g: this.g,
            b: this.b,
            a: this.a,
        });
    }
}

export class Range extends Target {
    #l; #r;
    #lInclude; #rInclude;

    constructor(...a) {
        super();

        if (a.length <= 0 || [3].includes(a.length) || a.length > 2) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Range) a = [a.l, a.r, a.lInclude, a.rInclude];
            else if (is(a, "arr")) {
                a = new Range(...a);
                a = [a.l, a.r, a.lInclude, a.rInclude];
            }
            else if (is(a, "obj")) a = [a.l, a.r, a.lInclude, a.rInclude];
            else if (is(a, "any_num")) a = [a, Infinity];
            else a = [-Infinity, Infinity];
        }
        if (a.length == 2) a = [...a, true, true];
        [this.l, this.r, this.lInclude, this.rInclude] = a;
    }

    get l() { return this.#l; }
    set l(v) {
        v = ensure(v, "any_num");
        if (this.l == v) return;
        this.change("l", this.l, this.#l=v);
    }
    get r() { return this.#r; }
    set r(v) {
        v = ensure(v, "any_num");
        if (this.r == v) return;
        this.change("r", this.r, this.#r=v);
    }

    get lInclude() { return this.#lInclude; }
    set lInclude(v) {
        v = !!v;
        if (this.lInclude == v) return;
        this.change("lInclude", this.lInclude, this.#lInclude=v);
    }
    get rInclude() { return this.#rInclude; }
    set rInclude(v) {
        v = !!v;
        if (this.rInclude == v) return;
        this.change("rInclude", this.rInclude, this.#rInclude=v);
    }

    normalize() {
        if (this.l > this.r) [this.l, this.r] = [this.r, this.l];
        return this;
    }

    test(v) {
        v = ensure(v, "any_num");
        if ((this.lInclude && v < this.l) || (!this.lInclude && v <= this.l)) return false;
        if ((this.rInclude && v > this.r) || (!this.rInclude && v >= this.r)) return false;
        return true;
    }
    clamp(v) {
        v = ensure(v, "any_num");
        return Math.min(this.r, Math.max(this.l, v));
    }
    lerp(v) {
        if (!Number.isFinite(this.l) || !Number.isFinite(this.r)) return null;
        return lerp(this.l, this.r, v);
    }

    toString() { return (this.lInclude ? "[" : "(") + this.l + ", " + this.r + (this.rInclude ? "]" : ")"); }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            l: this.l, r: this.r,
            lInclude: this.lInclude, rInclude: this.rInclude,
        });
    }
}

export class V extends Target {
    #x; #y;

    constructor(...a) {
        super();

        if (a.length <= 0 || a.length > 2) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof V) a = a.xy;
            else if (a instanceof V3) a = [a.x, a.y];
            else if (a instanceof V4) a = [a.x, a.y];
            else if (is(a, "arr")) a = new V(...a).xy;
            else if (is(a, "obj")) a = [a.x, a.y];
            else if (is(a, "num")) a = [a, a];
            else a = [0, 0];
        }
        [this.x, this.y] = a;
    }

    get x() { return this.#x; }
    set x(v) {
        v = ensure(v, "num");
        if (this.x == v) return;
        this.change("x", this.x, this.#x=v);
    }
    get y() { return this.#y; }
    set y(v) {
        v = ensure(v, "num");
        if (this.y == v) return;
        this.change("y", this.y, this.#y=v);
    }
    get xy() { return [this.x, this.y]; }
    set xy(v) { [this.x, this.y] = new V(v).xy; }

    set(...a) { this.xy = a; return this; }

    add(...a) {
        a = new V(...a);
        return new V(this.x+a.x, this.y+a.y);
    }
    sub(...a) {
        a = new V(...a);
        return new V(this.x-a.x, this.y-a.y);
    }
    mul(...a) {
        a = new V(...a);
        return new V(this.x*a.x, this.y*a.y);
    }
    div(...a) {
        a = new V(...a);
        return new V(this.x/a.x, this.y/a.y);
    }
    pow(...a) {
        a = new V(...a);
        return new V(this.x**a.x, this.y**a.y);
    }

    map(f) {
        return new V(f(this.x), f(this.y));
    }
    abs() { return this.map(Math.abs); }
    floor() { return this.map(Math.floor); }
    ceil() { return this.map(Math.ceil); }
    round() { return this.map(Math.round); }
    
    rotateOrigin(d) {
        d = ensure(d, "num");
        return new V(this.x*cos(d)+this.y*sin(d), this.x*cos(d-90)+this.y*sin(d-90));
    }
    rotate(d, o) {
        o = new V(o);
        return this.sub(o).rotateOrigin(d).add(o);
    }
    normalize() { return (this.dist(0) > 0) ? this.div(this.dist(0)) : new V(this); }

    iadd(...a) {
        a = new V(...a);
        this.x += a.x; this.y += a.y;
        return this;
    }
    isub(...a) {
        a = new V(...a);
        this.x -= a.x; this.y -= a.y;
        return this;
    }
    imul(...a) {
        a = new V(...a);
        this.x *= a.x; this.y *= a.y;
        return this;
    }
    idiv(...a) {
        a = new V(...a);
        this.x /= a.x; this.y /= a.y;
        return this;
    }
    ipow(...a) {
        a = new V(...a);
        this.x **= a.x; this.y **= a.y;
        return this;
    }

    imap(f) {
        this.x = f(this.x); this.y = f(this.y);
        return this;   
    }
    iabs() { return this.imap(Math.abs); }
    ifloor() { return this.imap(Math.floor); }
    iceil() { return this.imap(Math.ceil); }
    iround() { return this.imap(Math.round); }

    irotateOrigin(d) { return this.set(this.rotateOrigin(d)); }
    irotate(d, o) { return this.set(this.rotate(d, o)); }
    inormalize() { return this.set(this.normalize()); }

    distSquared(...v) {
        v = new V(...v);
        return (this.x-v.x)**2 + (this.y-v.y)**2;
    }
    dist(...v) { return Math.sqrt(this.distSquared(...v)); }
    towards(...v) {
        v = new V(...v);
        return (180/Math.PI)*Math.atan2(v.y-this.y, v.x-this.x);
    }
    equals(...v) {
        v = new V(...v);
        return (this.x == v.x) && (this.y == v.y); 
    }

    static dir(d, m=1) {
        d = ensure(d, "num");
        m = ensure(m, "num");
        return new V(cos(d)*m, sin(d)*m);
    }

    toString() { return "<"+this.xy.join(", ")+">" }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            x: this.x,
            y: this.y,
        });
    }
}

export class V3 extends Target {
    #x; #y; #z;

    constructor(...a) {
        super();

        if (a.length <= 0 || a.length > 3) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof V3) a = [a.x, a.y, a.z];
            else if (a instanceof V) a = [a.x, a.y, 0];
            else if (a instanceof V4) a = [a.x, a.y, a.z];
            else if (is(a, "arr")) a = new V3(...a).xyz;
            else if (is(a, "obj")) a = [a.x, a.y, a.z];
            else if (is(a, "num")) a = [a, a, a];
            else a = [0, 0, 0];
        }
        if (a.length == 2) a = [...a, 0];
        [this.x, this.y, this.z] = a;
    }

    get x() { return this.#x; }
    set x(v) {
        v = ensure(v, "num");
        if (this.x == v) return;
        this.change("x", this.x, this.#x=v);
    }
    get y() { return this.#y; }
    set y(v) {
        v = ensure(v, "num");
        if (this.y == v) return;
        this.change("y", this.y, this.#y=v);
    }
    get z() { return this.#z; }
    set z(v) {
        v = ensure(v, "num");
        if (this.z == v) return;
        this.change("z", this.z, this.#z=v);
    }
    get xyz() { return [this.x, this.y, this.z]; }
    set xyz(v) { [this.x, this.y, this.z] = new V3(v).xyz; }

    set(...a) { this.xyz = a; return this; }

    add(...a) {
        a = new V3(...a);
        return new V3(this.x+a.x, this.y+a.y, this.z+a.z);
    }
    sub(...a) {
        a = new V3(...a);
        return new V3(this.x-a.x, this.y-a.y, this.z-a.z);
    }
    mul(...a) {
        a = new V3(...a);
        return new V3(this.x*a.x, this.y*a.y, this.z*a.z);
    }
    div(...a) {
        a = new V3(...a);
        return new V3(this.x/a.x, this.y/a.y, this.z/a.z);
    }
    pow(...a) {
        a = new V3(...a);
        return new V3(this.x**a.x, this.y**a.y, this.z**a.z);
    }

    map(f) {
        return new V3(f(this.x), f(this.y), f(this.z));
    }
    abs() { return this.map(v => Math.abs(v)); }
    floor() { return this.map(v => Math.floor(v)); }
    ceil() { return this.map(v => Math.ceil(v)); }
    round() { return this.map(v => Math.round(v)); }

    rotateOrigin(...d) {
        d = new V3(...d);
        d.iadd(new V3().towards(this));
        let m = this.dist(0);
        return V3.dir(d, m);
    }
    rotate(d, o) {
        o = new V3(o);
        return this.sub(o).rotateOrigin(d).add(o);
    }
    normalize() { return (this.dist(0) > 0) ? this.div(this.dist(0)) : new V3(this); }

    iadd(...a) { return this.set(this.add(...a)); }
    isub(...a) { return this.set(this.sub(...a)); }
    imul(...a) { return this.set(this.mul(...a)); }
    idiv(...a) { return this.set(this.div(...a)); }
    ipow(...a) { return this.set(this.pow(...a)); }

    imap(f) { return this.set(this.map(f)); }
    iabs() { return this.set(this.abs()); }
    ifloor() { return this.set(this.floor()); }
    iceil() { return this.set(this.ceil()); }
    iround() { return this.set(this.round()); }

    irotateOrigin(d) { return this.set(this.rotateOrigin(d)); }
    irotate(d, o) { return this.set(this.rotate(d, o)); }
    inormalize() { return this.set(this.normalize()); }

    distSquared(...v) {
        v = new V3(...v);
        return (this.x-v.x)**2 + (this.y-v.y)**2 + (this.z-v.z)**2;
    }
    dist(...v) { return Math.sqrt(this.distSquared(...v)); }
    towards(...v) {
        v = new V3(...v);
        let thisFlat = new V(this.x, this.z);
        let thatFlat = new V(v.x, v.z);
        let azimuth = thisFlat.towards(thatFlat);
        let elevation = new V().towards(thisFlat.dist(thatFlat), v.y-this.y);
        return new V3(elevation, azimuth, 0);
    }
    equals(...v) {
        v = new V3(...v);
        return (this.x == v.x) && (this.y == v.y) && (this.z == v.z);
    }

    static dir(d, m=1) {
        d = new V3(d);
        m = ensure(m, "num");
        let azimuth = V.dir(d.y);
        let elevation = V.dir(d.x);
        azimuth.imul(elevation.x);
        return new V3(azimuth.x, elevation.y, azimuth.y).mul(m);
    }

    toString() { return "<"+this.xyz.join(", ")+">" }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            x: this.x,
            y: this.y,
            z: this.z,
        });
    }
}

export class V4 extends Target {
    #w; #x; #y; #z;

    constructor(...a) {
        super();

        if (a.length <= 0 || a.length > 4) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof V4) a = a.wxyz;
            else if (a instanceof V) a = [0, a.x, a.y, 0];
            else if (a instanceof V3) a = [0, a.x, a.y, a.z];
            else if (is(a, "arr")) a = new V4(...a).wxyz;
            else if (is(a, "obj")) a = [a.w, a.x, a.y, a.z];
            else if (is(a, "num")) a = [a, a, a, a];
            else a = [0, 0, 0, 0];
        }
        if (a.length == 2) a = [...a, 0];
        if (a.length == 3) a = [0, ...a];
        [this.w, this.x, this.y, this.z] = a;
    }

    get w() { return this.#w; }
    set w(v) {
        v = ensure(v, "num");
        if (this.w == v) return;
        this.change("w", this.w, this.#w=v);
    }
    get x() { return this.#x; }
    set x(v) {
        v = ensure(v, "num");
        if (this.x == v) return;
        this.change("x", this.x, this.#x=v);
    }
    get y() { return this.#y; }
    set y(v) {
        v = ensure(v, "num");
        if (this.y == v) return;
        this.change("y", this.y, this.#y=v);
    }
    get z() { return this.#z; }
    set z(v) {
        v = ensure(v, "num");
        if (this.z == v) return;
        this.change("z", this.z, this.#z=v);
    }
    get wxyz() { return [this.w, this.x, this.y, this.z]; }
    set wxyz(v) { [this.w, this.x, this.y, this.z] = new V4(v).wxyz; }

    set(...a) { this.wxyz = a; return this; }

    add(...a) {
        a = new V4(...a);
        return new V4(this.w+a.w, this.x+a.x, this.y+a.y, this.z+a.z);
    }
    sub(...a) {
        a = new V4(...a);
        return new V4(this.w-a.w, this.x-a.x, this.y-a.y, this.z-a.z);
    }
    mul(...a) {
        a = new V4(...a);
        return new V4(this.w*a.w, this.x*a.x, this.y*a.y, this.z*a.z);
    }
    div(...a) {
        a = new V4(...a);
        return new V4(this.w/a.w, this.x/a.x, this.y/a.y, this.z/a.z);
    }
    pow(...a) {
        a = new V4(...a);
        return new V4(this.w**a.w, this.x**a.x, this.y**a.y, this.z**a.z);
    }

    map(f) {
        return new V4(f(this.w), f(this.x), f(this.y), f(this.z));
    }
    abs() { return this.map(v => Math.abs(v)); }
    floor() { return this.map(v => Math.floor(v)); }
    ceil() { return this.map(v => Math.ceil(v)); }
    round() { return this.map(v => Math.round(v)); }

    normalize() { return (this.dist(0) > 0) ? this.div(this.dist(0)) : new V4(this); }

    iadd(...a) { return this.set(this.add(...a)); }
    isub(...a) { return this.set(this.sub(...a)); }
    imul(...a) { return this.set(this.mul(...a)); }
    idiv(...a) { return this.set(this.div(...a)); }
    ipow(...a) { return this.set(this.pow(...a)); }

    imap(f) { return this.set(this.map(f)); }
    iabs() { return this.set(this.abs()); }
    ifloor() { return this.set(this.floor()); }
    iceil() { return this.set(this.ceil()); }
    iround() { return this.set(this.round()); }

    inormalize() { return this.set(this.normalize()); }

    distSquared(...v) {
        v = new V4(...v);
        return (this.w-v.w)**2 + (this.x-v.x)**2 + (this.y-v.y)**2 + (this.z-v.z)**2;
    }
    dist(...v) { return Math.sqrt(this.distSquared(...v)); }
    equals(...v) {
        v = new V4(...v);
        return (this.w == v.w) && (this.x == v.x) && (this.y == v.y) && (this.z == v.z);
    }

    toString() { return "<"+this.wxyz.join(", ")+">" }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            x: this.x,
            y: this.y,
            z: this.z,
        });
    }
}

export class Shape extends Target {
    get p() { return new V(); }
    set p(v) { return; }

    set(...a) { return this; }

    getBounding() { return new Rect(); }

    move(...v) { return this; }
    scaleOrigin(...s) { return this; }
    scale(s, o=null) {
        o = (o == null) ? new V(this.p) : new V(o);
        return this.move(o.mul(-1)).scaleOrigin(s).move(o.mul(+1));
    }

    collides(o) { return false; }
}

export class Line extends Shape {
    #p1; #p2;

    constructor(...a) {
        super();

        if (a.length <= 0 || a.length == 3 || a.length > 4) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Line) a = [a.p1, a.p2];
            else if (is(a, "arr")) {
                a = new Line(...a);
                a = [a.p1, a.p2];
            }
            else if (a instanceof V) a = [a, a];
            else if (is(a, "obj")) a = [a.x1, a.y1, a.x2, a.y2];
            else if (is(a, "num")) a = [[a, a], [a, a]];
            else a = [0, 0];
        }
        if (a.length == 2) {
            a = [...new V(a[0]).xy, ...new V(a[1]).xy];
        }

        this.#p1 = new V();
        this.#p2 = new V();
        this.p1.addHandler("change", (c, f, t) => this.change("p1."+c, f, t));
        this.p2.addHandler("change", (c, f, t) => this.change("p2."+c, f, t));

        [this.x1, this.y1, this.x2, this.y2] = a;
    }

    set(...a) {
        a = new Line(...a);
        [this.x1, this.y1, this.x2, this.y2] = [a.x1, a.y1, a.x2, a.y2];
        return this;
    }

    get p1() { return this.#p1; }
    set p1(v) { this.#p1.set(v); }
    get x1() { return this.p1.x; }
    set x1(v) { this.p1.x = v; }
    get y1() { return this.p1.y; }
    set y1(v) { this.p1.y = v; }
    get p2() { return this.#p2; }
    set p2(v) { this.#p2.set(v); }
    get x2() { return this.p2.x; }
    set x2(v) { this.p2.x = v; }
    get y2() { return this.p2.y; }
    set y2(v) { this.p2.y = v; }
    get p() { return this.p1.add(this.p2); }
    set p(v) {
        p1 = this.p;
        p2 = new V(v);
        this.move(p2.sub(p1));
    }

    get len() { return this.p1.dist(this.p2); }

    getBounding() { return new Rect(
        Math.min(this.x1,this.x2), Math.min(this.y1,this.y2),
        Math.max(this.x1,this.x2)-Math.min(this.x1,this.x2), Math.max(this.y1,this.y2)-Math.min(this.y1,this.y2),
    ); }

    move(...v) {
        v = new V(...v);
        this.p1.iadd(v);
        this.p2.iadd(v);
        return this;
    }
    scaleOrigin(...s) {
        s = new V(...s);
        this.p1.imul(s);
        this.p2.imul(s);
        return this;
    }
    
    collides(o) {
        if (!is(o, "obj")) return false;
        if (o instanceof V) {
            let d1 = this.p1.distSquared(o);
            let d2 = this.p2.distSquared(o);
            let d = this.p1.distSquared(this.p2);
            return (Math.abs((d1+d2) - d) < 0.01);
        }
        if (o.constructor == Line) {
            let u1 = ((o.x2-o.x1)*(this.y1-o.y1) - (o.y2-o.y1)*(this.x1-o.x1)) / ((o.y2-o.y1)*(this.x2-this.x1) - (o.x2-o.x1)*(this.y2-this.y1));
            let u2 = ((this.x2-this.x1)*(this.y1-o.y1) - (this.y2-this.y1)*(this.x1-o.x1)) / ((o.y2-o.y1)*(this.x2-this.x1) - (o.x2-o.x1)*(this.y2-this.y1));
            return (0 <= u1 && u1 <= 1) && (0 <= u2 && u2 <= 1);
        }
        if (o instanceof Shape) return o.collides(this);
        return false;
    }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            x1: this.x1, y1: this.y1,
            x2: this.x2, y2: this.y2,
        });
    }
}
Shape.Line = Line;

export class Circle extends Shape {
    #p;
    #r;

    constructor(...a) {
        super();

        if (a.length <= 0 || a.length > 3) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Circle) a = [a.p, a.r];
            else if (is(a, "arr")) {
                a = new Circle(...a);
                a = [a.p, a.r];
            }
            else if (a instanceof V) a = [a, 0];
            else if (is(a, "obj")) a = [a.x, a.y, a.r];
            else if (is(a, "num")) a = [0, a];
            else a = [0, 0];
        }
        if (a.length == 2) {
            a = [...new V(a[0]).xy, a[1]];
        }

        this.#p = new V();
        this.p.addHandler("change", (c, f, t) => this.change("p."+c, f, t));
        this.#r = 0;

        [this.x, this.y, this.r] = a;
    }

    set(...a) {
        a = new Circle(...a);
        [this.x, this.y, this.a] = [a.x, a.y, a.r];
        return this;
    }

    get p() { return this.#p; }
    set p(v) { this.#p.set(v); }
    get x() { return this.p.x; }
    set x(v) { this.p.x = v; }
    get y() { return this.p.y; }
    set y(v) { this.p.y = v; }
    get r() { return this.#r; }
    set r(v) {
        v = Math.max(0, ensure(v, "num"));
        if (this.r == v) return;
        this.change("r", this.r, this.#r=v);
    }

    getBounding() { return new Rect(this.p.sub(this.r), this.r*2); }

    move(...v) {
        this.p.iadd(...v);
        return this;
    }
    scaleOrigin(...s) {
        s = new V(...s);
        this.p.imul(s);
        this.r *= (s.x+s.y)/2;
        return this;
    }
    
    collides(o) {
        if (!is(o, "obj")) return false;
        if (o instanceof V) {
            return this.p.distSquared(o) <= this.r**2;
        }
        if (o.constructor == Line) {
            if (this.collides(o.p1)) return true;
            if (this.collides(o.p2)) return true;
            let dot = (((this.x-o.x1)*(o.x2-o.x1)) + ((this.y-o.y1)*(o.y2-o.y1))) / o.p1.distSquared(o.p2);
            let p = lerp(o.p1, o.p2, dot);
            return this.collides(p);
        }
        if (o.constructor == Circle) {
            return this.p.distSquared(o.p) <= (this.r+o.r)**2;
        }
        if (o instanceof Shape) return o.collides(this);
        return false;
    }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            x: this.x, y: this.y,
            r: this.r,
        });
    }
}
Shape.Circle = Circle;

export class Rect extends Shape {
    #xy; #wh;

    constructor(...a) {
        super();

        if (a.length <= 0 || a.length == 3 || a.length > 4) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Rect) a = [a.x, a.y, a.w, a.h];
            else if (a instanceof DOMRect) a = [a.left, a.top, a.width, a.height];
            else if (is(a, "arr")) {
                a = new Rect(...a);
                a = [a.x, a.y, a.w, a.h];
            }
            else if (a instanceof V) a = [0, a];
            else if (a instanceof Shape) {
                a = a.getBounding();
                a = [a.x, a.y, a.w, a.h];
            }
            else if (is(a, "obj")) a = [a.x, a.y, a.w, a.h];
            else if (is(a, "num")) a = [0, a];
            else a = [0, 0];
        }
        if (a.length == 2) {
            if (is(a[0], "num") && is(a[1], "num")) a = [0, 0, ...a];
            else a = [...new V(a[0]).xy, ...new V(a[1]).xy];
        }

        this.#xy = new V();
        this.#wh = new V();
        this.xy.addHandler("change", (c, f, t) => this.change("xy."+c, f, t));
        this.wh.addHandler("change", (c, f, t) => this.change("wh."+c, f, t));

        [this.x, this.y, this.w, this.h] = a;
    }

    set(...a) {
        a = new Rect(...a);
        [this.x, this.y, this.w, this.h] = [a.x, a.y, a.w, a.h];
        return this;
    }

    get xy() { return this.#xy; }
    set xy(v) { this.#xy.set(v); }
    get x() { return this.xy.x; }
    set x(v) { this.xy.x = v; }
    get y() { return this.xy.y; }
    set y(v) { this.xy.y = v; }
    get wh() { return this.#wh; }
    set wh(v) { this.#wh.set(v); }
    get w() { return this.wh.x; }
    set w(v) { this.wh.x = v; }
    get h() { return this.wh.y; }
    set h(v) { this.wh.y = v; }

    get r() { return this.x+this.w; }
    set r(v) { this.w = v-this.l; }
    get l() { return this.x; }
    set l(v) { [this.x, this.w] = [v, this.r-v]; }
    get t() { return this.y+this.h; }
    set t(v) { this.h = v-this.b; }
    get b() { return this.y; }
    set b(v) { [this.y, this.h] = [v, this.t-v]; }
    get cx() { return this.x+this.w/2;}
    set cx(v) { this.x = v-this.w/2; }
    get cy() { return this.y+this.h/2; }
    set cy(v) { this.y = v-this.h/2; }

    get tr() { return new V(this.r, this.t); }
    set tr(v) {
        v = new V(v);
        [this.r, this.t] = v.xy;
    }
    get tc() { return new V(this.cx, this.t); }
    set tc(v) {
        v = new V(v);
        [this.cx, this.t] = v.xy;
    }
    get tl() { return new V(this.l, this.t); }
    set tl(v) {
        v = new V(v);
        [this.l, this.t] = v.xy;
    }
    get cr() { return new V(this.r, this.cy); }
    set cr(v) {
        v = new V(v);
        [this.r, this.cy] = v.xy;
    }
    get cl() { return new V(this.l, this.cy); }
    set cl(v) {
        v = new V(v);
        [this.l, this.cy] = v.xy;
    }
    get br() { return new V(this.r, this.b); }
    set br(v) {
        v = new V(v);
        [this.r, this.t] = v.xy;
    }
    get bc() { return new V(this.cx, this.b); }
    set bc(v) {
        v = new V(v);
        [this.cx, this.t] = v.xy;
    }
    get bl() { return new V(this.l, this.b); }
    set bl(v) {
        v = new V(v);
        [this.l, this.b] = v.xy;
    }
    get p() { return new V(this.cx, this.cy); }
    set p(v) {
        v = new V(v);
        [this.cx, this.cy] = v.xy;
    }
    get px() { return this.cx; }
    set px(v) { this.cx = v; }
    get py() { return this.cy; }
    set py(v) { this.cy = v; }

    normalize() {
        if (this.w < 0) [this.x, this.w] = [this.x+this.w, -this.w];
        if (this.h < 0) [this.y, this.h] = [this.y+this.h, -this.h];
        return this;
    }

    getBounding() { return new Rect(this); }

    move(...v) {
        v = new V(...v);
        this.xy.iadd(v);
        return this;
    }
    scaleOrigin(...s) {
        s = new V(...s);
        this.xy.imul(s);
        this.wh.imul(s);
        return this;
    }

    collides(o) {
        if (!is(o, "obj")) return false;
        if (o instanceof V) {
            let l = Math.min(this.l, this.r);
            let r = Math.max(this.l, this.r);
            let b = Math.min(this.b, this.t);
            let t = Math.max(this.b, this.t);
            if (o.x < l) return false;
            if (o.x > r) return false;
            if (o.y < b) return false;
            if (o.y > t) return false;
            return true;
        }
        if (o.constructor == Line) {
            if (this.collides(o.p1)) return true;
            if (this.collides(o.p2)) return true;
            if (new Line(this.tr, this.br).collides(o)) return true;
            if (new Line(this.tl, this.bl).collides(o)) return true;
            if (new Line(this.tr, this.tl).collides(o)) return true;
            if (new Line(this.br, this.bl).collides(o)) return true;
            return false;
        }
        if (o.constructor == Circle) {
            if (this.collides(o.p)) return true;
            if (new Line(this.tr, this.br).collides(o)) return true;
            if (new Line(this.tl, this.bl).collides(o)) return true;
            if (new Line(this.tr, this.tl).collides(o)) return true;
            if (new Line(this.br, this.bl).collides(o)) return true;
            return false;
        }
        if (o.constructor == Rect) {
            let l1 = Math.min(this.l, this.r);
            let r1 = Math.max(this.l, this.r);
            let b1 = Math.min(this.b, this.t);
            let t1 = Math.max(this.b, this.t);
            let l2 = Math.min(o.l, o.r);
            let r2 = Math.max(o.l, o.r);
            let b2 = Math.min(o.b, o.t);
            let t2 = Math.max(o.b, o.t);
            if (r2 < l1) return false;
            if (l2 > r1) return false;
            if (t2 < b1) return false;
            if (b2 > t1) return false;
            return true;
        }
        if (o instanceof Shape) return o.collides(this);
        return false;
    }
    
    toJSON() {
        return Reviver.revivable(this.constructor, {
            x: this.x, y: this.y,
            w: this.w, h: this.h,
        });
    }
}
Shape.Rect = Rect;

export class Polygon extends Shape {
    #p;
    #d;
    #points;
    #pointsmx; #pointsmn;

    constructor(...a) {
        if (a.length <= 0) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Polygon) a = [a.p, ...a.points];
            else if (is(a, "arr")) {
                a = new Polygon(...a);
                a = [a.p, ...a.points];
            }
            else if (a instanceof V) a = [a];
            else if (a instanceof Circle) a = [a.p, ...new Array(12).fill(null).map((_, i) => V.dir(360*(i/12), a.r))];
            else if (a instanceof Rect) a = [a.p, ...[a.tr, a.tl, a.bl, a.br].map(v => v.sub(a.p))];
            else if (is(a, "obj")) a = [a.p, ...ensure(a.points, "arr")];
            else if (is(a, "num")) a = [a];
            else a = [0];
        }
        if (a.length == 2) {
            if (is(a[0], "num") && is(a[1], "num")) a = [a];
            else if (is(a[1], "arr") && a[1].length >= 3) a = [a[0], ...a[1]];
        }
        a = a.map(v => new V(v));
        
        this.#p = new V();
        this.p.addHandler("change", (c, f, t) => this.change("p."+c, f, t));
        this.#d = 0;
        this.#points = [];
        this.#pointsmx = new V();
        this.#pointsmn = new V();

        this.p = a.shift();
        this.points = a;
    }

    set(...a) {
        a = new Polygon(...a);
        [this.p, this.d, this.points] = [a.p, a.d, a.points];
        return this;
    }

    get p() { return this.#p; }
    set p(v) { this.#p.set(v); }
    get x() { return this.p.x; }
    set x(v) { this.p.x = v; }
    get y() { return this.p.y; }
    set y(v) { this.p.y = v; }
    get d() { return this.#d; }
    set d(v) {
        v = clampAngle(v);
        if (this.d == v) return;
        this.change("d", this.d, this.#d=v);
    }
    get points() { return this.#points.map(v => new V(v)); }
    set points(v) {
        v = ensure(v, "arr");
        v = v.map((v, i) => {
            v = new V(v);
            if (i == 0) {
                this.#pointsmx.set(v);
                this.#pointsmn.set(v);
            } else {
                this.#pointsmx.x = Math.max(this.#pointsmx.x, v.x);
                this.#pointsmx.y = Math.max(this.#pointsmx.y, v.y);
                this.#pointsmn.x = Math.min(this.#pointsmn.x, v.x);
                this.#pointsmn.y = Math.min(this.#pointsmn.y, v.y);
            }
            return v;
        });
        this.change("points", this.points, [...(this.#points=v)]);
    }
    get finalPoints() { return this.points.map(v => v.rotateOrigin(this.d).add(this.p)); }

    getBounding() { return new Rect(this.#pointsmn.add(this.p), this.#pointsmx.sub(this.#pointsmn)); }

    move(...v) {
        v = new V(...v);
        this.p.iadd(v);
        return this;
    }
    scaleOrigin(...s) {
        this.p.imul(...s);
        this.#points.forEach(v => v.imul(...s));
        return this;
    }

    collides(o) {
        if (!is(o, "obj")) return false;
        if (o instanceof V) {
            let points = this.finalPoints;
            let c = false;
            for (let i = 0; i < points.length; i++) {
                let j = (i+1) % points.length;
                let pi = points[i], pj = points[j];
                if (((pi.y > o.y) != (pj.y > o.y)) && (o.x < (pj.x-pi.x) * (o.y-pi.y) / (pj.y-pi.y) + pi.x)) c = !c;
            }
            return c;
        }
        if (o.constructor == Line) {
            if (this.collides(o.p1)) return true;
            if (this.collides(o.p2)) return true;
            let points = this.finalPoints;
            for (let i = 0; i < points.length; i++) {
                let j = (i+1) % points.length;
                let pi = points[i], pj = points[j];
                if (new Line(pi, pj).collides(o)) return true;
            }
            return false;
        }
        if (o.constructor == Circle) {
            if (this.collides(o.p)) return true;
            let points = this.finalPoints;
            for (let i = 0; i < points.length; i++) {
                let j = (i+1) % points.length;
                let pi = points[i], pj = points[j];
                if (new Line(pi, pj).collides(o)) return true;
            }
            return false;
        }
        if (o.constructor == Rect) {
            if (!this.getBounding().collides(o)) return false;
            return this.collides(new Polygon(o));
        }
        if (o.constructor == Polygon) {
            if (!this.getBounding().collides(o.getBounding())) return false;
            let points = o.finalPoints;
            for (let i = 0; i < points.length; i++) {
                let j = (i+1) % points.length;
                let pi = points[i], pj = points[j];
                if (this.collides(pi)) return true;
                if (this.collides(new Line(pi, pj))) return true;
            }
            return false;
        }
        if (o instanceof Shape) return o.collides(this);
        return false;
    }
    
    toJSON() {
        return Reviver.revivable(this.constructor, {
            p: this.p,
            points: this.points,
        });
    }
}
Shape.Polygon = Polygon;


export class Resolver extends Target {
    #state;

    #resolves;

    constructor(state) {
        super();

        this.#state = state;

        this.#resolves = [];
    }

    get state() { return this.#state; }
    set state(v) {
        if (this.state == v) return;
        this.change("state", this.state, this.#state=v);
        let resolves = this.#resolves.filter(o => {
            let methodfs = {
                "==": o.v == this.state,
                "!=": o.v != this.state,
            };
            return methodfs[o.method];
        });
        for (let o of resolves) {
            this.#resolves.splice(this.#resolves.indexOf(o), 1);
            let stateChanged = false;
            const stateChange = () => (stateChanged = true);
            this.addHandler("change-state", stateChange);
            o.res();
            this.remHandler("change-state", stateChange);
            if (stateChanged) break;
        }
    }

    async when(v) {
        if (this.state == v) return;
        return await new Promise((res, rej) => this.#resolves.push({ v: v, res: res, method: "==" }));
    }
    async whenNot(v) {
        if (this.state != v) return;
        return await new Promise((res, rej) => this.#resolves.push({ v: v, res: res, method: "!=" }));
    }
    async whenTrue() { return await this.when(true); }
    async whenFalse() { return await this.when(false); }
}


export class Reviver extends Target {
    #rules;

    constructor(reviver=null) {
        super();
        
        this.#rules = {};

        if (reviver instanceof Reviver)
            reviver.rules.forEach(cons => this.addRule(cons));
    }

    isConstructor(constructor) {
        if (!is(constructor, "func")) return false;
        try {
            new constructor();
            return true;
        } catch (e) {}
        return false;
    }

    get rules() { return Object.values(this.#rules); }
    set rules(v) {
        v = ensure(v, "arr");
        this.clearRules();
        this.addRule(v);
    }
    clearRules() {
        let rules = this.rules;
        this.remRule(rules);
        return rules;
    }
    hasRule(v) {
        if (is(v, "str")) return v in this.#rules;
        if (is(v, "func")) return this.hasRule(v.name) && Object.values(this.#rules).includes(v);
        return false;
    }
    getRule(name) {
        name = String(name);
        if (!this.hasRule(name)) return null;
        return this.#rules[name];
    }
    addRule(...constructors) {
        return Target.resultingForEach(constructors, constructor => {
            if (!is(constructor, "func")) return false;
            if (!(constructor.prototype instanceof Target || constructor == Target)) return false;
            this.#rules[constructor.name] = constructor;
            return constructor;
        });
    }
    remRule(...constructors) {
        return Target.resultingForEach(constructors, constructor => {
            if (!is(constructor, "func")) return false;
            if (!(constructor.prototype instanceof Target || constructor == Target)) return false;
            delete this.#rules[constructor.name];
            return constructor;
        });
    }
    addRuleAndAllSub(...constructors) {
        return Target.resultingForEach(constructors, constructor => {
            if (!is(constructor, "func")) return false;
            if (!(constructor.prototype instanceof Target || constructor == Target)) return false;
            if (this.hasRule(constructor)) return constructor;
            this.addRule(constructor);
            for (let k in constructor) this.addRuleAndAllSub(constructor[k]);
            return constructor;
        });
    }

    get f() {
        return (k, v) =>  {
            if (is(v, "obj")) {
                if (!("%cstm" in v) && !("%CUSTOM" in v)) return v;
                let custom = ("%cstm" in v) ? v["%cstm"] : v["%CUSTOM"];
                if (!("%o" in v) && !("%OBJ" in v)) return v;
                let o = ("%o" in v) ? v["%o"] : v["%OBJ"];
                if (!("%a" in v) && !("%ARGS" in v)) return v;
                let a = ("%a" in v) ? v["%a"] : v["%ARGS"];
                if (!custom) return v;
                if (!this.hasRule(o)) return v;
                let rule = this.getRule(o);
                return new rule(...ensure(a, "arr"));
            }
            return v;
        };
    }

    static revivable(constructor, ...a) {
        if (!is(constructor, "func")) return null;
        return {
            "%cstm": true,
            "%o": constructor.name,
            "%a": a,
        };
    }
}

export const REVIVER = new Reviver();
REVIVER.addRuleAndAllSub(Color, Range, V, V3, V4, Shape);

export class Playback extends Target {
    #ts;
    #tsMin;
    #tsMax;

    #paused;

    #restartTimer;

    #signal;

    constructor(...a) {
        super();

        this.#ts = this.#tsMin = this.#tsMax = 0;
        this.#paused = false;

        this.#restartTimer = 0;

        this.#signal = null;

        if (a.length <= 0 || a.length > 4) a = [null];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Playback) a = [a.ts, a.tsMin, a.tsMax, a.paused];
            else if (is(a, "arr")) {
                a = new Playback(...a);
                a = [a.ts, a.tsMin, a.tsMax, a.paused];
            }
            else if (is(a, "num")) a = [0, a];
            else if (is(a, "obj")) a = [a.ts, a.tsMin, a.tsMax, a.paused];
            else a = [0, 0];
        }
        if (a.length == 2) a = [a[0], ...a];
        if (a.length == 3) a = [...a, false];

        [this.ts, this.tsMin, this.tsMax, this.paused] = a;

        this.addHandler("update", delta => {
            if (this.paused) return;
            this.ts += delta;
            if (this.ts < this.tsMax) return this.#restartTimer = 0;
            if (this.#restartTimer >= 10) return;
            this.#restartTimer++;
        });
    }

    get ts() { return this.hasSignal() ? this.signal.ts : this.#ts; }
    set ts(v) {
        if (this.hasSignal()) return this.signal.ts = v;
        v = Math.min(this.tsMax, Math.max(this.tsMin, ensure(v, "num")));
        if (this.ts == v) return;
        this.change("ts", this.ts, this.#ts=v);
    }
    get tsMin() { return this.hasSignal() ? this.signal.tsMin : this.#tsMin; }
    set tsMin(v) {
        if (this.hasSignal()) return this.signal.tsMin = v;
        v = ensure(v, "num");
        if (this.tsMin == v) return;
        this.change("tsMin", this.tsMin, this.#tsMin=v);
        if (this.tsMin > this.tsMax) [this.tsMin, this.tsMax] = [this.tsMax, this.tsMin];
        this.ts = this.ts;
    }
    get tsMax() { return this.hasSignal() ? this.signal.tsMax : this.#tsMax; }
    set tsMax(v) {
        if (this.hasSignal()) return this.signal.tsMax = v;
        v = ensure(v, "num");
        if (this.tsMax == v) return;
        this.change("tsMax", this.tsMax, this.#tsMax=v);
        if (this.tsMin > this.tsMax) [this.tsMin, this.tsMax] = [this.tsMax, this.tsMin];
        this.ts = this.ts;
    }
    get progress() { return (this.ts-this.tsMin) / (this.tsMax-this.tsMin); }
    set progress(v) {
        v = Math.min(1, Math.max(0, ensure(v, "num")));
        this.ts = lerp(this.tsMin, this.tsMax, v);
    }

    get paused() { return this.#paused; }
    set paused(v) {
        v = !!v;
        if (this.paused == v) return;
        this.change("paused", this.paused, this.#paused=v);
    }
    get playing() { return !this.paused; }
    set playing(v) { this.paused = !v; }
    pause() { return this.paused = true; }
    play() { return this.playing = true; }
    get finished() { return this.#restartTimer >= 10; }

    get signal() { return this.#signal; }
    set signal(v) {
        v = is(v, "obj") ? v : null;
        if (this.signal == v) return;
        this.change("signal", this.signal, this.#signal=v);
    }
    hasSignal() { return this.signal != null; }

    update(delta) { this.post("update", delta); }
}

export class Timer extends Target {
    #tSum;
    #t;
    #paused;

    constructor() {
        super();

        this.#tSum = 0;
        this.#t = 0;
        this.#paused = true;
    }

    get paused() { return this.#paused; }
    set paused(v) {
        v = !!v;
        if (this.paused == v) return;
        if (v) this.#tSum += getTime() - this.#t;
        else this.#t = getTime();
        this.change("paused", this.paused, this.#paused=v);
    }
    get playing() { return !this.paused; }
    set playing(v) { this.paused = !v; }
    pause() { return this.paused = true; }
    play() { return this.playing = true; }

    clear() {
        let time = this.time;
        this.#tSum = 0;
        this.#t = getTime();
        return time;
    }
    add(v) {
        this.#tSum += ensure(v, "num");
        return this;
    }
    sub(v) {
        this.#tSum -= ensure(v, "num");
        return this;
    }
    mul(v) {
        this.#tSum *= ensure(v, "num");
        return this;
    }
    div(v) {
        this.#tSum *= ensure(v, "num");
        return this;
    }
    set(v) {
        this.#tSum = ensure(v, "num");
        return this;
    }
    get time() { return this.#tSum + this.playing*(getTime()-this.#t); }

    pauseAndClear() { this.pause(); return this.clear(); }
    playAndClear() { this.play(); return this.clear(); }
}
