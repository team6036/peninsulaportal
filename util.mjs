export const EPSILON = 0.000001;

export const NUMBERS = "0123456789";
export const ALPHABETUPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const ALPHABETLOWER = ALPHABETUPPER.toLowerCase();
export const ALPHABETALL = ALPHABETLOWER+ALPHABETUPPER;
export const BASE64 = ALPHABETALL+NUMBERS+"-_";

export const MAGIC = "_*[[;ƒ";

export const VERSION = 1;


export function is(o, type) {
    let typefs = {
        any_num: () => {
            return (typeof(o) == "number") && !Number.isNaN(o);
        },
        num: () => {
            return typefs.any_num() && Number.isFinite(o);
        },
        float: () => {
            return typefs.num();
        },
        int: () => {
            return typefs.num() && (o % 1 == 0);
        },
        bool: () => {
            return typeof(o) == "boolean";
        },
        str: () => {
            return typeof(o) == "string";
        },
        arr: () => {
            return Array.isArray(o);
        },
        obj: () => {
            return (typeof(o) == "object") && !typefs.null();
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
    if (is(type, "obj")) return o instanceof type;
    return o == type;
}

const ENSURE_NONE = Symbol("ENSURE_NONE");
export function ensure(o, type, def=ENSURE_NONE) {
    let typefs = {
        any_num: () => {
            if (is(o, "any_num")) return o;
            return (def == ENSURE_NONE) ? 0 : def;
        },
        num: () => {
            if (is(o, "num")) return o;
            return (def == ENSURE_NONE) ? 0 : def;
        },
        float: () => {
            return typefs.num();
        },
        int: () => {
            if (is(o, "num")) return Math.round(o);
            return (def == ENSURE_NONE) ? 0 : def;
        },
        bool: () => {
            return !!o;
        },
        str: () => {
            if (is(o, "str")) return o;
            return (def == ENSURE_NONE) ? "" : def;
        },
        arr: () => {
            if (is(o, "arr")) return o;
            return (def == ENSURE_NONE) ? [] : def;
        },
        obj: () => {
            if (is(o, "obj")) return o;
            return (def == ENSURE_NONE) ? {} : def;
        },
        func: () => {
            if (is(o, "func")) return o;
            return (def == ENSURE_NONE) ? ()=>{} : def;
        },
        async_func: () => {
            if (is(o, "async_func")) return o;
            if (is(o, "func")) return async () => o();
            return (def == ENSURE_NONE) ? async()=>{} : def;
        },
        null: () => {
            return null;
        },
    };
    if (type in typefs) return typefs[type]();
    if (is(o, type)) return o;
    return (def == ENSURE_NONE) ? null : def;
}

export function strictlyIs(o, cls) {
    if (!is(o, "obj")) return false;
    if (!is(cls, "func")) return false;
    return (o instanceof cls) && !(o.constructor.prototype instanceof cls);
}

export function arrEquals(a1, a2) {
    a1 = ensure(a1, "arr");
    a2 = ensure(a2, "arr");
    if (a1.length != a2.length) return false;
    for (let i = 0; i < a1.length; i++)
        if (a1[i] != a2[i]) return false;
    return true;
}

export function sin(x) {
    x = ensure(x, "num");
    return Math.sin(x * (Math.PI/180));
}
export function cos(x) {
    x = ensure(x, "num");
    return Math.cos(x * (Math.PI/180));
}

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

export function angleRel(a, b) {
    a = ((ensure(a, "num")%360)+360)%360;
    b = ((ensure(b, "num")%360)+360)%360;
    let r = (((b - a)%360)+360)%360;
    if (r > 180) r -= 360;
    return r;
}
export function angleRelRadians(a, b) {
    const fullTurn = 2*Math.PI;
    a = ensure(a, "num");
    b = ensure(b, "num");
    while (a >= fullTurn) a -= fullTurn;
    while (a < 0) a += fullTurn;
    while (b >= fullTurn) b -= fullTurn;
    while (b < 0) b += fullTurn;
    let r = b - a;
    while (r >= fullTurn) r -= fullTurn;
    while (r < 0) r += fullTurn;
    if (r > fullTurn/2) r -= fullTurn;
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

export function search(items, keys, query) {
    items = ensure(items, "arr");
    keys = ensure(keys, "arr");
    query = String(query);
    if (query.length <= 0) return items;
    const fuse = new Fuse(items, {
        isCaseSensitive: false,
        keys: keys,
    });
    items = fuse.search(query).map(item => item.item);
    return items;
}

export function capitalize(s) {
    s = String(s);
    if (s.length <= 0) return s;
    return s[0].toUpperCase() + s.substring(1).toLowerCase();
}

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

export class Color {
    #r; #g; #b; #a;

    constructor(...a) {
        if (a.length <= 0 || a.length == 2 || a.length > 4) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof Color) a = a.rgba;
            else if (is(a, "arr")) a = new Color(...a).rgba;
            else if (is(a, "obj")) a = [a.r, a.g, a.b, a.a];
            else if (is(a, "num")) {
                if (a < 0) a = new Array(3).fill(-a);
                else if (a < 0xffff) {
                    let rgba = new Array(4).fill(null).map(_ => {
                        let x = a % 16;
                        a = Math.floor(a / 16);
                        return x;
                    }).reverse();
                    a = rgba.map(x => x*16+x);
                    a[3] /= 255;
                } else if (a < 0xffffff) {
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
                    a = a.substring(1).toLowerCase();
                    const hex = "0123456789abcdef";
                    let all = true;
                    a.split("").forEach(c => (hex.includes(c) ? null : (all = false)));
                    if (!all) a = [0, 0, 0];
                    else {
                        if (a.length == 3 || a.length == 4) a = new Array(a.length).fill(null).map((_, i) => hex.indexOf(a[i])).map(x => x*16+x);
                        else if (a.length == 6 || a.length == 8) a = new Array(a.length/2).fill(null).map((_, i) => hex.indexOf(a[i])*16+hex.indexOf(a[i+1]));
                        else a = [0, 0, 0];
                    }
                    if (a.length == 4) a[3] /= 255;
                } else if (a.startsWith("rgb")) {
                    a = a.substring(a.startsWith("rgba") ? 4 : 3);
                    if (a.at(0) == "(" && a.at(-1) == ")") {
                        a = a.substring(1, a.length-1);
                        a = a.split(",").map(v => v.trim()).map(v => parseFloat(v));
                        a = new Color(...a).rgba;
                    } else a = [0, 0, 0];
                } else if (a.startsWith("--")) {
                    a = new Color(getComputedStyle(document.body).getPropertyValue(a)).rgba;
                } else a = [0, 0, 0];
            }
            else a = [0, 0, 0];
        }
        if (a.length == 3) a = [...a, 255];

        [this.r, this.g, this.b, this.a] = a;
    }

    get r() { return this.#r; }
    set r(v) { this.#r = Math.min(255, Math.max(0, ensure(v, "num"))); }
    get g() { return this.#g; }
    set g(v) { this.#g = Math.min(255, Math.max(0, ensure(v, "num"))); }
    get b() { return this.#b; }
    set b(v) { this.#b = Math.min(255, Math.max(0, ensure(v, "num"))); }
    get a() { return this.#a; }
    set a(v) { this.#a = Math.min(1, Math.max(0, ensure(v, "num"))); }
    get rgb() { return [this.r, this.g, this.b]; }
    set rgb(v) { [this.r, this.g, this.b] = new Color(v).rgb; }
    get rgba() { return [this.r, this.g, this.b, this.a]; }
    set rgba(v) { [this.r, this.g, this.b, this.a] = new Color(v).rgba; }

    get hsva() {
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
        return [h, s, v, this.a];
    }
    set hsva(hsva) {
        hsva = ensure(hsva, "arr");
        if (hsva.length != 4) hsva = [0, 0, 0, 1];
        hsva = hsva.map(v => ensure(v, "num"));
        hsva[0] = ((ensure(hsva[0], "num")%360)+360)%360;
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
        hsv = ensure(v, "arr");
        if (hsv.length != 3) hsv = [0, 0, 0];
        let hsva = this.hsva;
        [hsva[0], hsva[1], hsva[2]] = hsv;
        this.hsva = hsva;
    }

    toHex(a=true) {
        const hex = "0123456789abcdef";
        let vals = (a ? this.rgba : this.rgb).map(v => {
            v = Math.round(v);
            return hex[Math.floor(v/16)]+hex[v%16];
        });
        return "#"+vals.join("");
    }
    toRGBA() {
        return "rgba("+this.rgba.join(",")+")";
    }
    toRGB() {
        return "rgb("+this.rgb.join(",")+")";
    }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            r: this.r,
            g: this.g,
            b: this.b,
            a: this.a,
        });
    }
}

export class Range {
    #l; #r;
    #lInclude; #rInclude;

    constructor(...a) {
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
    set l(v) { this.#l = ensure(v, "any_num"); }
    get r() { return this.#r; }
    set r(v) { this.#r = ensure(v, "any_num"); }

    get lInclude() { return this.#lInclude; }
    set lInclude(v) { this.#lInclude = !!v; }
    get rInclude() { return this.#rInclude; }
    set rInclude(v) { this.#rInclude = !!v; }

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
            VERSION: VERSION,
            l: this.l, r: this.r,
            lInclude: this.lInclude, rInclude: this.rInclude,
        });
    }
}

export class V {
    #x; #y;

    constructor(...a) {
        if (a.length <= 0 || a.length > 2) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof V) a = a.xy;
            else if (a instanceof V3) a = [a.x, a.y];
            else if (is(a, "arr")) a = new V(...a).xy;
            else if (is(a, "obj")) a = [a.x, a.y];
            else if (is(a, "num")) a = [a, a];
            else a = [0, 0];
        }
        [this.x, this.y] = a;
    }

    get x() { return this.#x; }
    set x(v) { this.#x = ensure(v, "num"); }
    get y() { return this.#y; }
    set y(v) { this.#y = ensure(v, "num"); }
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
    abs() { return this.map(v => Math.abs(v)); }
    floor() { return this.map(v => Math.floor(v)); }
    ceil() { return this.map(v => Math.ceil(v)); }
    round() { return this.map(v => Math.round(v)); }
    
    rotateOrigin(d) {
        d = ensure(d, "num");
        return V.dir(d, this.x).add(V.dir(d-90, this.y));
    }
    rotate(d, o) {
        o = new V(o);
        return this.sub(o).rotateOrigin(d).add(o);
    }
    normalize() { return (this.dist(0) > 0) ? this.div(this.dist(0)) : new V(this); }

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
        return new V(cos(d), sin(d)).mul(m);
    }

    toString() { return "<"+this.xy.join(", ")+">" }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            x: this.x,
            y: this.y,
        });
    }
}

export class V3 {
    #x; #y; #z;

    constructor(...a) {
        if (a.length <= 0 || a.length > 3) a = [0];
        if (a.length == 1) {
            a = a[0];
            if (a instanceof V3) a = [a.x, a.y, a.z];
            else if (a instanceof V) a = [a.x, a.y, 0];
            else if (is(a, "arr")) a = new V3(...a).xyz;
            else if (is(a, "obj")) a = [a.x, a.y, a.z];
            else if (is(a, "num")) a = [a, a, a];
            else a = [0, 0, 0];
        }
        if (a.length == 2) a = [...a, 0];
        [this.x, this.y, this.z] = a;
    }

    get x() { return this.#x; }
    set x(v) { this.#x = ensure(v, "num"); }
    get y() { return this.#y; }
    set y(v) { this.#y = ensure(v, "num"); }
    get z() { return this.#z; }
    set z(v) { this.#z = ensure(v, "num"); }
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
        return (this.x-v.x)**2 + (this.y-v.y)**2 + (this.z-v.z);
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
            VERSION: VERSION,
            x: this.x,
            y: this.y,
            z: this.z,
        });
    }
}

export class Shape {
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
        if (strictlyIs(o, Line)) {
            let u1 = ((o.x2-o.x1)*(this.y1-o.y1) - (o.y2-o.y1)*(this.x1-o.x1)) / ((o.y2-o.y1)*(this.x2-this.x1) - (o.x2-o.x1)*(this.y2-this.y1));
            let u2 = ((this.x2-this.x1)*(this.y1-o.y1) - (this.y2-this.y1)*(this.x1-o.x1)) / ((o.y2-o.y1)*(this.x2-this.x1) - (o.x2-o.x1)*(this.y2-this.y1));
            return (0 <= u1 && u1 <= 1) && (0 <= u2 && u2 <= 1);
        }
        if (o instanceof Shape) return o.collides(this);
        return false;
    }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            VERSION: VERSION,
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
    set r(v) { this.#r = Math.max(0, ensure(v, "num")); }

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
        if (strictlyIs(o, Line)) {
            if (this.collides(o.p1)) return true;
            if (this.collides(o.p2)) return true;
            let dot = (((this.x-o.x1)*(o.x2-o.x1)) + ((this.y-o.y1)*(o.y2-o.y1))) / o.p1.distSquared(o.p2);
            let p = lerp(o.p1, o.p2, dot);
            return this.collides(p);
        }
        if (strictlyIs(o, Circle)) {
            return this.p.distSquared(o.p) <= (this.r+o.r)**2;
        }
        if (o instanceof Shape) return o.collides(this);
        return false;
    }

    toJSON() {
        return Reviver.revivable(this.constructor, {
            VERSION: VERSION,
            x: this.x, y: this.y,
            r: this.r,
        });
    }
}
Shape.Circle = Circle;

export class InvertedCircle extends Circle {
    constructor(...a) {
        super(...a);
    }

    collides(o) {
        if (!is(o, "obj")) return false;
        if (o instanceof V) {
            return this.p.distSquared(o) >= this.r**2;
        }
        if (strictlyIs(o, Line)) {
            if (this.collides(o.p1)) return true;
            if (this.collides(o.p2)) return true;
            return false;
        }
        if (strictlyIs(o, Circle)) {
            return this.p.distSquared(o.p) >= Math.max(0, this.r-o.r)**2;
        }
        if (strictlyIs(o, InvertedCircle)) {
            return true;
        }
        if (strictlyIs(o, Rect)) {
            if (this.collides(o.tr)) return true;
            if (this.collides(o.br)) return true;
            if (this.collides(o.tl)) return true;
            if (this.collides(o.bl)) return true;
            return false;
        }
        if (strictlyIs(o, Polygon)) {
            let points = o.finalPoints;
            for (let i = 0; i < points.length; i++)
                if (this.collides(points[i]))
                    return true;
            return false;
        }
        if (o instanceof Shape) return o.collides(this);
        return false;
    }
}
Shape.InvertedCircle = InvertedCircle;

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
        if (strictlyIs(o, Line)) {
            if (this.collides(o.p1)) return true;
            if (this.collides(o.p2)) return true;
            if (new Line(this.tr, this.br).collides(o)) return true;
            if (new Line(this.tl, this.bl).collides(o)) return true;
            if (new Line(this.tr, this.tl).collides(o)) return true;
            if (new Line(this.br, this.bl).collides(o)) return true;
            return false;
        }
        if (strictlyIs(o, Circle)) {
            if (this.collides(o.p)) return true;
            if (new Line(this.tr, this.br).collides(o)) return true;
            if (new Line(this.tl, this.bl).collides(o)) return true;
            if (new Line(this.tr, this.tl).collides(o)) return true;
            if (new Line(this.br, this.bl).collides(o)) return true;
            return false;
        }
        if (strictlyIs(o, Rect)) {
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
            VERSION: VERSION,
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
    set d(v) { this.#d = ((ensure(v, "num")%360)+360)%360; }
    get points() { return [...this.#points]; }
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
        this.#points = v;
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
        if (strictlyIs(o, Line)) {
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
        if (strictlyIs(o, Circle)) {
            if (this.collides(o.p)) return true;
            let points = this.finalPoints;
            for (let i = 0; i < points.length; i++) {
                let j = (i+1) % points.length;
                let pi = points[i], pj = points[j];
                if (new Line(pi, pj).collides(o)) return true;
            }
            return false;
        }
        if (strictlyIs(o, Rect)) {
            if (!this.getBounding().collides(o)) return false;
            return this.collides(new Polygon(o));
        }
        if (strictlyIs(o, Polygon)) {
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
            VERSION: VERSION,
            p: this.p,
            points: this.points,
        });
    }
}
Shape.Polygon = Polygon;


export class Reviver {
    #rules;

    constructor(reviver=null) {
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
        v.forEach(v => this.addRule(v));
    }
    clearRules() {
        let rules = this.rules;
        rules.forEach(cons => this.remRule(cons));
        return rules;
    }
    hasRule(v) {
        if (is(v, "str")) return v in this.#rules;
        if (is(v, "func")) return this.hasRule(v.name);
        return false;
    }
    getRule(name) {
        name = String(name);
        if (!this.hasRule(name)) return null;
        return this.#rules[name];
    }
    addRule(constructor) {
        if (!is(constructor, "func")) return false;
        this.#rules[constructor.name] = constructor;
        return constructor;
    }
    remRule(constructor) {
        if (!is(constructor, "func")) return false;
        delete this.#rules[constructor.name];
        return constructor;
    }
    addRuleAndAllSub(constructor) {
        if (!is(constructor, "func")) return false;
        if (this.hasRule(constructor)) return constructor;
        this.addRule(constructor);
        for (let k in constructor) this.addRuleAndAllSub(constructor[k]);
        return constructor;
    }

    get f() {
        return (k, v) =>  {
            if (is(v, "obj")) {
                if (!("%CUSTOM" in v)) return v;
                if (!("%OBJ" in v)) return v;
                if (!("%ARGS" in v)) return v;
                if (!v["%CUSTOM"]) return v;
                if (!this.hasRule(v["%OBJ"])) return v;
                let rule = this.getRule(v["%OBJ"]);
                return new rule(...ensure(v["%ARGS"], "arr"));
            }
            return v;
        };
    }

    static revivable(constructor, ...a) {
        if (!is(constructor, "func")) return null;
        return {
            "%OBJ": constructor.name,
            "%CUSTOM": true,
            "%ARGS": a,
        };
    }
}

export const REVIVER = new Reviver();
REVIVER.addRuleAndAllSub(Color);
REVIVER.addRuleAndAllSub(Range);
REVIVER.addRuleAndAllSub(V);
REVIVER.addRuleAndAllSub(V3);
REVIVER.addRuleAndAllSub(Shape);
