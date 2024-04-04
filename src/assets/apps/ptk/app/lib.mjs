import * as util from "./util.mjs";


let math = null;
if (typeof(window) != "undefined") {
    try {
        math = (await import("../node_modules/mathjs/lib/browser/math.js")).default;
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
            math = window.math;
            delete window.math;
        } catch (e) {
            console.log("MATHJS IMPORT TRY 2 ERR", e);
        }
    }
}
export { math as mathjs }


export const TEXTENCODER = new TextEncoder();
export const TEXTDECODER = new TextDecoder();


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
        if (this.unit != "#" && to != "#" && math) {
            try {
                return new Unit(math.unit(this.value, this.unit).toNumber(to), to);
            } catch (e) {}
        }
        return new Unit(this.value, to);
    }

    static convert(v, u1, u2) {
        v = util.ensure(v, "num");
        u1 = String(u1).toLowerCase();
        u2 = String(u2).toLowerCase();
        if (u1 != "#" && u2 != "#" && math) {
            try {
                return math.unit(v, u1).toNumber(u2);
            } catch (e) {}
        }
        return v;
    }
}
