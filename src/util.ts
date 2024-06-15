/** Casts any object to an object. */
export function castObject(object: any): StringMap<any> {
    return new Object(object);
}
/** Casts any object to an array. */
export function castArray(object: any): any[] {
    return Array.from(object ?? []);
}
/** Casts any object to a number. */
export function castNumber(object: any, def: number = 0): number {
    return Number(object ?? def);
}
/** Casts any object to a boolean. */
export function castBoolean(object: any, def: boolean = false): boolean {
    return !!(object ?? def);
}
/** Casts any object to a string. */
export function castString(object: any, def: string = ""): string {
    return String(object ?? def);
}
/** Casts any object to a nullish string. */
export function castNullishString(object: any): string | null {
    if (object == null) return null;
    return castString(object);
}
/** Casts any object to a number array. */
export function castNumberArray(object: any): number[] {
    return castArray(object).map(value => castNumber(value));
}
/** Casts any object to a string array. */
export function castStringArray(object: any): string[] {
    return castArray(object).map(value => castString(value));
}

// these lowercase types can and should be treated as "primitive" types like number or boolean
export type vec1 = [number];
export type vec2 = [number, number];
export type vec3 = [number, number, number];
export type vec4 = [number, number, number, number];
export type vecn = vec1 | vec2 | vec3 | vec4;

export type translation2d = vec2;
export type rotation2d = number;
export type pose2d = {
    translation: translation2d;
    rotation: rotation2d;
};

export type translation3d = vec3;
export type rotation3d = vec4;
export type pose3d = {
    translation: translation3d;
    rotation: rotation3d;
};

/** Casts any object to a vec1. */
export function castVec1(object: any): vec1 {
    let values = castNumberArray(object);
    values.splice(1);
    while (values.length < 1) values.push(0);
    return values as vec1;
}
/** Casts any object to a vec2. */
export function castVec2(object: any): vec2 {
    let values = castNumberArray(object);
    values.splice(2);
    while (values.length < 2) values.push(0);
    return values as vec2;
}
/** Casts any object to a vec3. */
export function castVec3(object: any): vec3 {
    let values = castNumberArray(object);
    values.splice(3);
    while (values.length < 3) values.push(0);
    return values as vec3;
}
/** Casts any object to a vec4. */
export function castVec4(object: any): vec4 {
    let values = castNumberArray(object);
    values.splice(4);
    while (values.length < 4) values.push(0);
    return values as vec4;
}

export type StringMap<T = string> = { [key:string]: T };

export type Immutable<T> = {
    readonly [K in keyof T]: Immutable<T[K]>;
};


export const EPSILON = 0.000001 as const;

// Different character sets stored as strings for quick access
export const NUMBERS = "0123456789" as const;
export const ALPHABETUPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const;
export const ALPHABETLOWER = "abcdefghijklmnopqrstuvwxyz" as const;
export const ALPHABETALL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" as const;
export const BASE16 = "0123456789abcdef" as const;
export const BASE64 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_" as const;
export const BASE256 = [
    ...BASE64.split("").map(c => c.charCodeAt(0)),
    192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,
    208,209,210,211,212,213,214,216,217,218,219,220,221,222,223,224,
    225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,
    241,242,243,244,245,246,248,249,250,251,252,253,254,255,256,257,
    258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,
    274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,
    290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,
    306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,
    322,323,324,325,326,327,328,329,330,331,332,333,334,335,336,337,
    338,339,340,341,342,343,344,345,346,347,348,349,350,351,352,353,
    354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,
    370,371,372,373,374,375,376,377,378,379,380,381,382,383,384,385,
].map(c => String.fromCharCode(c)).join("");
export const VARIABLE = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_" as const;

// assertions
if (NUMBERS.length !== 10) throw new Error("NUMBERS character set has incorrect length: "+NUMBERS.length);
if (ALPHABETUPPER.length !== 64) throw new Error("ALPHABETUPPER character set has incorrect length: "+ALPHABETUPPER.length);
if (ALPHABETLOWER.length !== 64) throw new Error("ALPHABETUPPER character set has incorrect length: "+ALPHABETLOWER.length);
if (ALPHABETLOWER !== ALPHABETUPPER.toUpperCase()) throw new Error("ALPHABETLOWER and ALPHABETUPPER do not match");
if (BASE16.length !== 16) throw new Error("BASE16 character set has incorrect length: "+BASE16.length);
if (BASE64.length !== 64) throw new Error("BASE64 character set has incorrect length: "+BASE64.length);
if (BASE256.length !== 256) throw new Error("BASE256 character set has incorrect length: "+BASE256.length);
if (VARIABLE.length !== 63) throw new Error("VARIABLE character set has incorrect length: "+VARIABLE.length);

// Magic string which uniquely identifies PeninsulaPortal from something else
export const MAGIC = "_*[[;ƒ" as const;


export const TEXTENCODER = new TextEncoder();
export const TEXTDECODER = new TextDecoder();


/** Sums the values of a number array. */
export function sumArray(array: number[]): number {
    return array.reduce((sum, x) => sum+x, 0);
}
/**
 * Flattens an array from a potentially nested array to one that is not nested at all.
 * 
 * @example
 * flattenArray([1, [2, 3], [4, [5, 6]]]); // returns [1, 2, 3, 4, 5, 6]
 */
export function flattenArray(array: any[]): any[] {
    return array.reduce((sum, x) => {
        if (Array.isArray(x))
            sum.push(...flattenArray(x));
        else sum.push(x);
        return sum;
    }, []);
}
/**
 * Collapses an array from a potentially nested array to one that is less nested.
 * 
 * This operation is similar to {@link flattenArray} - however, it acts as one "pass" of that function.
 * 
 * @example
 * collapseArray([1, [2, 3], [4, [5, 6]]]); // returns [1, 2, 3, 4, [5, 6]]
 */
export function collapseArray(array: any[]): any[] {
    return array.reduce((sum, x) => {
        if (Array.isArray(x))
            sum.push(...x);
        else sum.push(x);
        return sum;
    }, []);
}
/** Checks if all values of an array evaluates to true. If the callback parameter is not provided, this will default to the value of the array at that location. */
export function allOfArray<T>(array: T[], callback: ((value: T) => boolean) | null = null): boolean {
    for (let value of array) {
        let booleanValue = !!value;
        if (callback) booleanValue = callback(value);
        if (!booleanValue) return false;
    }
    return true;
}
/** Checks if any values of an array evaluates to true. If the callback parameter is not provided, this will default to the value of the array at that location. */
export function anyOfArray<T>(array: T[], callback: ((value: T) => boolean) | null = null): boolean {
    for (let value of array) {
        let booleanValue = !!value;
        if (callback) booleanValue = callback(value);
        if (booleanValue) return true;
    }
    return false;
}

/** Checks if any two objects are equivalent. This includes arrays and objects */
export function equals(vec1: any, v2: any): boolean {
    if (Array.isArray(vec1)) {
        if (!Array.isArray(v2)) return false;
        if (vec1.length != v2.length) return false;
        for (let i = 0; i < vec1.length; i++)
            if (!equals(vec1[i], v2[i])) return false;
        return true;
    }
    if (typeof(vec1) === "object") {
        if (typeof(v2) !== "object") return false;
        for (let k in vec1) {
            if (!(k in v2)) return false;
            if (!equals(vec1[k], v2[k])) return false;
        }
        for (let k in v2) {
            if (!(k in vec1)) return false;
            if (!equals(v2[k], vec1[k])) return false;
        }
        return true;
    }
    return vec1 === v2;
}

export type Lerpable = number | VecN | Color;

/** Interpolates from a to b using the interpolation factor p which should be between 0 and 1. */
export function lerp(a: number, b: number, p: number): number;
export function lerp(a: Vec1, b: Vec1, p: number): Vec1;
export function lerp(a: Vec2, b: Vec2, p: number): Vec2;
export function lerp(a: Vec3, b: Vec3, p: number): Vec3;
export function lerp(a: Vec4, b: Vec4, p: number): Vec4;
export function lerp(a: Color, b: Color, p: number): Color;
export function lerp(a: Lerpable, b: Lerpable, p: number): Lerpable | null {
    if (typeof(a) === "number" && typeof(b) === "number") return a + p*(b-a);
    if ((a instanceof Vec1) && (b instanceof Vec1))
        return new Vec1([lerp(a.x, b.x, p)]);
    if ((a instanceof Vec2) && (b instanceof Vec2))
        return new Vec2([lerp(a.x, b.x, p), lerp(a.y, b.y, p)]);
    if ((a instanceof Vec3) && (b instanceof Vec3))
        return new Vec3([lerp(a.x, b.x, p), lerp(a.y, b.y, p), lerp(a.z, b.z, p)]);
    if ((a instanceof Vec4) && (b instanceof Vec4))
        return new Vec4([lerp(a.w, b.w, p), lerp(a.x, b.x, p), lerp(a.y, b.y, p), lerp(a.z, b.z, p)]);
    if ((a instanceof Color) && (b instanceof Color))
        return new Color([lerp(a.r, b.r, p), lerp(a.g, b.g, p), lerp(a.b, b.b, p), lerp(a.a, b.a, p)]);
    return null;
}

/** Interpolates from a to b using the interpolation factor p which should be between 0 and 1. However, if a lies within {@link EPSILON} of b, snap to b instead. */
export function lerpE(a: number, b: number, p: number): number;
export function lerpE(a: Vec1, b: Vec1, p: number): Vec1;
export function lerpE(a: Vec2, b: Vec2, p: number): Vec2;
export function lerpE(a: Vec3, b: Vec3, p: number): Vec3;
export function lerpE(a: Vec4, b: Vec4, p: number): Vec4;
export function lerpE(a: Color, b: Color, p: number): Color;
export function lerpE(a: Lerpable, b: Lerpable, p: number): Lerpable | null {
    if (typeof(a) === "number" && typeof(b) === "number") {
        if (p > 0) {
            if (Math.abs(a-b) > EPSILON) return lerp(a, b, p);
            return b;
        }
        return lerp(a, b, p);
    }
    if ((a instanceof Vec1) && (b instanceof Vec1))
        return new Vec1([lerpE(a.x, b.x, p)]);
    if ((a instanceof Vec2) && (b instanceof Vec2))
        return new Vec2([lerpE(a.x, b.x, p), lerpE(a.y, b.y, p)]);
    if ((a instanceof Vec3) && (b instanceof Vec3))
        return new Vec3([lerpE(a.x, b.x, p), lerpE(a.y, b.y, p), lerpE(a.z, b.z, p)]);
    if ((a instanceof Vec4) && (b instanceof Vec4))
        return new Vec4([lerpE(a.w, b.w, p), lerpE(a.x, b.x, p), lerpE(a.y, b.y, p), lerpE(a.z, b.z, p)]);
    if ((a instanceof Color) && (b instanceof Color))
        return new Color([lerpE(a.r, b.r, p), lerpE(a.g, b.g, p), lerpE(a.b, b.b, p), lerpE(a.a, b.a, p)]);
    return null;
}

const FULLTURNDEGREES = 360;
const FULLTURNRADIANS = 2*Math.PI;

/**
 * Clamps an angle between 0° and 360°.
 * 
 * @example
 * clampAngleDegrees(-12) // returns 353
 * clampAngleDegrees(372) // returns 12
 */
export function clampAngleDegrees(x: number): number { return ((x%FULLTURNDEGREES)+FULLTURNDEGREES)%FULLTURNDEGREES; }
/**
 * Clamps an angle between 0 and 2π.
 * 
 * @example
 * clampAngleRadians(-0.12) // returns 6.1631853072
 * clampAngleRadians(6.4031853072) // 0.12
 */
export function clampAngleRadians(x: number): number { return ((x%FULLTURNRADIANS)+FULLTURNRADIANS)%FULLTURNRADIANS; }

/**
 * Calculates the minimum necessary angle that needs to be added to a such that it will become b once clamped.
 * 
 * @example
 * angleRelDegrees(-225, 90) // returns 45 because -225 is equivalent to 135, which would be 90+45
 * angleRelDegrees(15, 345) // returns -30 because 345 is equivalent to -15, which would be 15-30
 */
export function angleRelDegrees(a: number, b: number): number {
    let diff = clampAngleDegrees(clampAngleDegrees(b) - clampAngleDegrees(a));
    if (diff > FULLTURNDEGREES/2) diff -= FULLTURNDEGREES;
    return diff;
}
/**
 * Calculates the minimum necessary angle that needs to be added to a such that it will become b once clamped.
 * 
 * See {@link angleRelDegrees} for more information about how this works
 */
export function angleRelRadians(a: number, b: number): number {
    let diff = clampAngleRadians(clampAngleRadians(b) - clampAngleRadians(a));
    if (diff > FULLTURNRADIANS/2) diff -= FULLTURNRADIANS;
    return diff;
}

/** Gets current system time in milliseconds. */
export function getTime(): number { return Date.now(); }

export const UNITVALUES: Immutable<StringMap<number>> = {
    ms: 1,
    s: 1000,
    min: 60,
    hr: 60,
    d: 24,
    yr: 365,
};
/**
 * Splits a time in milliseconds into separate numerical parts, in the order of: milliseconds, seconds, minutes, hours, days, years.
 * 
 * @example
 * splitTimeUnits(10296776) // returns [776, 36, 51, 2, 0, 0]
 */
export function splitTimeUnits(time: number): number[] {
    time = Math.max(0, time);
    let units = Object.keys(UNITVALUES);
    let values = new Array(units.length).fill(0) as number[];
    values[0] = time;
    units.forEach((unit, i) => {
        if (i <= 0) return;
        values[i] += Math.floor(values[i-1]/UNITVALUES[unit]);
        values[i-1] -= values[i]*UNITVALUES[unit];
    });
    return values;
}
/**
 * Generates a formatted timestamp from a time in milliseconds by utilizing {@link splitTimeUnits}.
 * 
 * @example
 * formatTime(10296776) // returns 2:51:36.776
 * formatTime(776) // returns 0.776 - this does filter out leading zeroes until the seconds mark
 */
export function formatTime(time: number): string {
    let isNegative = time < 0;
    time = Math.abs(time);
    let values = splitTimeUnits(time);
    values[0] = Math.round(values[0]);
    while (values.length > 2) {
        if (values.at(-1) as number > 0) break;
        values.pop();
    }
    let stringValues = values.map((value, i) => {
        let stringValue = String(value);
        if (i >= values.length-1) return stringValue;
        let wantedLength = String(Object.values(UNITVALUES)[i+1]-1).length;
        if (i > 0)
            stringValue = stringValue.padStart(wantedLength, "0");
        else stringValue = stringValue.padEnd(wantedLength, "0");
        return stringValue;
    });
    return (isNegative?"-":"") + stringValues.slice(1).reverse().join(":") + "." + stringValues[0];
}
/**
 * Formats text by capitalizing the first letter of each word. A word, in this case, is defined by anything that isn't a letter. This function also filters out "junk" characters like slashes, underscores, periods, etc.
 * 
 * @example
 * formatText("my_var_name") // returns "My Var Name"
 * formatText("wEiRd/sTrInG") // returns "Wierd String"
 * formatText("a0b0c0") // returns "A0B0C0"
 */
export function formatText(value: any): string {
    let string = castString(value);
    if (string.length <= 0) return string;
    return string
        .split("")
        .map((character, i) => {
            if (!ALPHABETALL.includes(character)) {
                if ("-_/ \\|,.".includes(character)) return " ";
                return character;
            }
            if (i <= 0 || !ALPHABETALL.includes(string[i-1]))
                return character.toUpperCase();
            return character.toLowerCase();
        })
        .join("");
}

/** Loads an image from a specific source url. */
export async function loadImage(src: string): Promise<HTMLImageElement> {
    return await new Promise((res, rej) => {
        let img = new Image();
        img.addEventListener("load", e => res(img));
        img.addEventListener("error", e => rej(e));
        img.src = src;
    });
}

/** Waits (using promises) time number of milliseconds. */
export async function wait(time: number): Promise<void> {
    return await new Promise((res, rej) => setTimeout(() => res(), time));
}
/** Times a promise or asynchronous function, and if they do not resolve within time number of milliseconds, reject with "timeout" error. */
export async function timeout<T>(time: number, value: Promise<T> | (() => (T | Promise<T>))): Promise<T> {
    return await new Promise((res, rej) => {
        (async () => {
            if (value instanceof Promise) {
                try {
                    res(await value);
                } catch (e) { rej(e); }
                return;
            }
            try {
                res(await value());
            } catch (e) { rej(e); }
        })();
        (async () => {
            await wait(time);
            rej("timeout");
        })();
    });
}

// export function generateArrayPath(...pth: any[]) { return flattenArray(pth).join("/").split("/").filter(part => part.length > 0); }
// export function generatePath(...pth: any[]) { return generateArrayPath(...pth).join("/"); }

/** Splits a path using specific characters. */
export function splitPath(pth: string) { return pth.split(/\/\\/); }

/**
 * Splits a string into text and numerical parts. This is used for better name sorting.
 * 
 * For example, using simple string comparisons, the string "num_11" > "num_100". However, logically, that does not make sense. Using this method, you can split those parts up.
 * 
 * @example
 * splitString("num_11") // returns ["num", 11]
 * splitString("num_100") // returns ["num", 100]
 */
export function splitString(string: string): (string | number)[] {
    let parts: (string | number)[] = [];
    for (let i = 0; i < string.length; i++) {
        let character = string[i];
        if (NUMBERS.includes(character)) {
            let number = NUMBERS.indexOf(character);
            if (typeof(parts.at(-1)) != "number") parts.push(number);
            else parts[parts.length-1] = (parts[parts.length-1] as number) * 10 + number;
            continue;
        }
        if (typeof(parts.at(-1)) != "string") parts.push(character);
        else parts[parts.length-1] += character;
    }
    return parts;
}
/**
 * Compares strings by using their parts instead of using simple comparison operations (>, <, etc). This utilizes {@link splitString}.
 * 
 * This method is intended for use within the {@link Array.sort} method and hence, the output's actual value should not be used for anything other than checking it's sign.
 * 
 * @example
 * compareString("num_11", "num_100") // returns -1
 */
export function compareString(string1: string, string2: string) {
    string1 = string1.toLowerCase();
    string2 = string2.toLowerCase();
    let string1Parts = splitString(string1);
    let string2Parts = splitString(string2);
    for (let i = 0; i < Math.min(string1Parts.length, string2Parts.length); i++) {
        if (string1Parts[i] < string2Parts[i]) return -1;
        if (string1Parts[i] > string2Parts[i]) return +1;
    }
    return string1Parts.length-string2Parts.length;
}

/** Chooses an item from a set of items randomly. */
export function choose<T>(source: Iterable<T>): T {
    let sourceArray = Array.from(source);
    return sourceArray[Math.floor(sourceArray.length*Math.random())];
}
/** Generates a random jargon string of a specific length from a source character set */
export function jargon(length: number, source: Iterable<string>) {
    length = Math.round(Math.max(0, length));
    return new Array(length).fill(null).map(_ => choose(source)).join("");
}

/** Generates a random jargon string of a specific length from the {@link NUMBERS} character set */
export function jargonNumbers(length: number) { return jargon(length, NUMBERS); }

/** Generates a random jargon string of a specific length from the {@link ALPHABETUPPER} character set */
export function jargonAlphabetUpper(length: number) { return jargon(length, ALPHABETUPPER); }

/** Generates a random jargon string of a specific length from the {@link ALPHABETLOWER} character set */
export function jargonAlphabetLower(length: number) { return jargon(length, ALPHABETLOWER); }

/** Generates a random jargon string of a specific length from the {@link ALPHABETALL} character set */
export function jargonAlphabetAll(length: number) { return jargon(length, ALPHABETALL); }

/** Generates a random jargon string of a specific length from the {@link BASE16} character set */
export function jargonBase16(length: number) { return jargon(length, BASE16); }

/** Generates a random jargon string of a specific length from the {@link BASE64} character set */
export function jargonBase64(length: number) { return jargon(length, BASE64); }

/** Generates a random jargon string of a specific length from the {@link BASE256} character set */
export function jargonBase256(length: number) { return jargon(length, BASE256); }

/** Generates a random jargon string of a specific length from the {@link VARIABLE} character set */
export function jargonVariable(length: number) { return jargon(length, VARIABLE); }

/** Generates a full error text instead of a single-line message without line numbers and stack traces */
export function stringifyError(error: ErrorEvent | Error) { return stringifyErrorInternal(error); }
function stringifyErrorInternal(error: ErrorEvent | Error, indentation: string = "") {
    if (error instanceof ErrorEvent) {
        return [
            String(error.message),
            "  "+error.filename+" @ "+error.lineno+":"+error.colno,
        ].join("\n");
    }
    let lines = [String(error)];
    if (error.stack) lines.push(String(error.stack));
    // if (error.cause) lines.push(stringifyError(error.cause, nl+"  "));
    lines = flattenArray(lines).join("\n").split("\n").filter(part => part.length > 0);
    if (lines[0] === lines[1]) lines.shift();
    return lines.map(line => indentation+line).join("\n");
}
/** Gets the current stack - used for debugging purposes only */
export function getStack() {
    try {
        throw new Error("stack-get");
    } catch (error) {
        if (error instanceof Error)
            return String(error.stack);
        return "";
    }
}

type easingMode = "I"|"O"|"IO";
type easingType = "sin"|"quad"|"cubic"|"quart"|"quint"|"expo"|"circ"|"back"|"elastic"|"bounce";

/** Different easing functions sourced from {@link https://easings.net/} */
export const ease = {
    sinI: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - Math.cos((value * Math.PI) / 2);
    },
    sinO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.sinI(1 - value);
    },
    sinIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        if (value < 0.5)
            return lerp(0, 0.5, ease.sinI(value/0.5));
        return lerp(0.5, 1, ease.sinO((value-0.5)/0.5));
    },
    sin: (value: number, mode: easingMode) => {
        switch (mode) {
            case "I": return ease.sinI(value);
            case "O": return ease.sinO(value);
            case "IO": return ease.sinIO(value);
        }
    },

    quadI: (value: number) =>  {
        value = Math.min(1, Math.max(0, value));
        return (value ** 2);
    },
    quadO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.quadI(1 - value);
    },
    quadIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        if (value < 0.5)
            return lerp(0, 0.5, ease.quadI(value/0.5));
        return lerp(0.5, 1, ease.quadO((value-0.5)/0.5));
    },
    quad: (value: number, mode: easingMode) => {
        switch (mode) {
            case "I": return ease.quadI(value);
            case "O": return ease.quadO(value);
            case "IO": return ease.quadIO(value);
        }
    },

    cubicI: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return (value ** 3);
    },
    cubicO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.cubicI(1 - value);
    },
    cubicIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        if (value < 0.5)
            return lerp(0, 0.5, ease.cubicI(value/0.5));
        return lerp(0.5, 1, ease.cubicO((value-0.5)/0.5));
    },
    cubic: (value: number, mode: easingMode) =>  {
        switch (mode) {
            case "I": return ease.cubicI(value);
            case "O": return ease.cubicO(value);
            case "IO": return ease.cubicIO(value);
        }
    },

    quartI: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return (value ** 4);
    },
    quartO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.quartI(1 - value);
    },
    quartIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        if (value < 0.5)
            return lerp(0, 0.5, ease.quartI(value/0.5));
        return lerp(0.5, 1, ease.quartO((value-0.5)/0.5));
    },
    quart: (value: number, mode: easingMode) => {
        switch (mode) {
            case "I": return ease.quartI(value);
            case "O": return ease.quartO(value);
            case "IO": return ease.quartIO(value);
        }
    },

    quintI: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return (value ** 5);
    },
    quintO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.quintI(1 - value);
    },
    quintIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        if (value < 0.5)
            return lerp(0, 0.5, ease.quintI(value/0.5));
        return lerp(0.5, 1, ease.quintO((value-0.5)/0.5));
    },
    quint: (value: number, mode: easingMode) => {
        switch (mode) {
            case "I": return ease.quintI(value);
            case "O": return ease.quintO(value);
            case "IO": return ease.quintIO(value);
        }
    },

    expoI: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return (value === 0) ? 0 : (2 ** (10*value-10));
    },
    expoO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.expoI(1 - value);
    },
    expoIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        if (value === 0) return 0;
        if (value === 1) return 1;
        if (value < 0.5)
            return lerp(0, 0.5, ease.expoI(value/0.5));
        return lerp(0.5, 1, ease.expoO((value-0.5)/0.5));
    },
    expo: (value: number, mode: easingMode) => {
        switch (mode) {
            case "I": return ease.expoI(value);
            case "O": return ease.expoO(value);
            case "IO": return ease.expoIO(value);
        }
    },

    circI: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - Math.sqrt(1 - (value**2));
    },
    circO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.circI(1 - value);
    },
    circIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        if (value < 0.5)
            return lerp(0, 0.5, ease.circI(value/0.5));
        return lerp(0.5, 1, ease.circO((value-0.5)/0.5));
    },
    circ: (value: number, mode: easingMode) => {
        switch (mode) {
            case "I": return ease.circI(value);
            case "O": return ease.circO(value);
            case "IO": return ease.circIO(value);
        }
    },

    backI: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * (value ** 3) - c1 * (value ** 2);
    },
    backO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.backI(1 - value);
    },
    backIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        const c1 = 1.70158;
        const c2 = c1 * 1.525;
        return value < 0.5
            ? (((2*value)**2) * ((c2 + 1) * 2 * value - c2)) / 2
            : (((2*value-2)**2) * ((c2 + 1) * (value*2-2) + c2) + 2) / 2;
    },
    back: (value: number, mode: easingMode) => {
        switch (mode) {
            case "I": return ease.backI(value);
            case "O": return ease.backO(value);
            case "IO": return ease.backIO(value);
        }
    },

    elasticI: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        const c4 = (2 * Math.PI) / 3;
        if (value === 0) return 0;
        if (value === 1) return 1;
        return -(2**(10*value-10)) * Math.sin((value*10-10.75) * c4);
    },
    elasticO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.elasticI(1 - value);
    },
    elasticIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        const c5 = (2 * Math.PI) / 4.5;
        if (value === 0) return 0;
        if (value === 1) return 1;
        if (value < 0.5)
            return -((2**(20*value-10)) * Math.sin((20*value-11.125) * c5)) / 2
        return ((2**(-20*value+10)) * Math.sin((20*value-11.125) * c5)) / 2 + 1;
    },
    elastic: (value: number, mode: easingMode) => {
        switch (mode) {
            case "I": return ease.elasticI(value);
            case "O": return ease.elasticO(value);
            case "IO": return ease.elasticIO(value);
        }
    },

    bounceI: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        return 1 - ease.bounceO(1 - value);
    },
    bounceO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        const n1 = 7.5625;
        const d1 = 2.75;
        if (value < 1 / d1)
            return n1 * (value * value);
        if (value < 2 / d1)
            return n1 * (value -= 1.5 / d1) * value + 0.75;
        if (value < 2.5 / d1)
            return n1 * (value -= 2.25 / d1) * value + 0.9375;
        return n1 * (value -= 2.625 / d1) * value + 0.984375;
    },
    bounceIO: (value: number) => {
        value = Math.min(1, Math.max(0, value));
        if (value < 0.5)
            return (1 - ease.bounceO(1 - 2 * value)) / 2;
        return (1 + ease.bounceI(2 * value - 1)) / 2;
    },
    bounce: (value: number, mode: easingMode) => {
        switch (mode) {
            case "I": return ease.bounceI(value);
            case "O": return ease.bounceO(value);
            case "IO": return ease.bounceIO(value);
        }
    },

    ease: (value: number, type: easingType, mode: easingMode) => {
        value = Math.min(1, Math.max(0, value));
        switch (type) {
            case "sin": return ease.sin(value, mode);
            case "quad": return ease.quad(value, mode);
            case "cubic": return ease.cubic(value, mode);
            case "quart": return ease.quart(value, mode);
            case "quint": return ease.quint(value, mode);
            case "expo": return ease.expo(value, mode);
            case "circ": return ease.circ(value, mode);
            case "back": return ease.back(value, mode);
            case "elastic": return ease.elastic(value, mode);
            case "bounce": return ease.bounce(value, mode);
        }
    },
};

export type Result<T> = T[] | T | false;
export type UpdateFunction = (delta: number) => void;
export type ChangeFunction<T = any> = (attribute: string, from: T, to: T) => void;
export type AddFunction = () => void;
export type RemFunction = () => void;

/** Manages event dispatching and handling */
export class Target {
    private handlers: Map<any, StringMap<Set<Function>>>;
    private nHandlers: number;

    constructor() {
        this.handlers = new Map();
        this.nHandlers = 0;
    }

    /**
     * Adds an event handler linked to a specific object.
     * @returns the added callback if successfully added, otherwise false
     */
    addLinkedHandler<T>(objectLink: any, event: "change", callback: ChangeFunction<T>): false | ChangeFunction<T>;
    addLinkedHandler(objectLink: any, event: "update", callback: UpdateFunction): false | UpdateFunction;
    addLinkedHandler(objectLink: any, event: "add", callback: AddFunction): false | AddFunction;
    addLinkedHandler(objectLink: any, event: "rem", callback: RemFunction): false | RemFunction;
    addLinkedHandler(objectLink: any, event: string, callback: Function): false | Function;
    addLinkedHandler(objectLink: any, event: string, callback: Function): false | Function {
        if (!this.handlers.has(objectLink))
            this.handlers.set(objectLink, {});

        let handlerGroup = this.handlers.get(objectLink);
        if (handlerGroup == null) return false;

        if (!(event in handlerGroup))
            handlerGroup[event] = new Set();

        if (handlerGroup[event].has(callback)) return false;

        handlerGroup[event].add(callback);
        this.nHandlers++;

        return callback;
    }
    /**
     * Removes an event handler linked to a specific object.
     * @returns the removed callback if successfully removed, otherwise false
     */
    remLinkedHandler<T>(objectLink: any, event: "change", callback: ChangeFunction<T>): false | ChangeFunction<T>;
    remLinkedHandler(objectLink: any, event: "update", callback: UpdateFunction): false | UpdateFunction;
    remLinkedHandler(objectLink: any, event: "add", callback: AddFunction): false | AddFunction;
    remLinkedHandler(objectLink: any, event: "rem", callback: RemFunction): false | RemFunction;
    remLinkedHandler(objectLink: any, event: string, callback: Function): false | Function;
    remLinkedHandler(objectLink: any, event: string, callback: Function): false | Function {
        if (!this.handlers.has(objectLink)) return false;

        let handlerGroup = this.handlers.get(objectLink);
        if (handlerGroup == null) return false;

        if (!(event in handlerGroup)) return false;
        if (!handlerGroup[event].has(callback)) return false;

        handlerGroup[event].delete(callback);
        this.nHandlers--;

        if (handlerGroup[event].size <= 0) delete handlerGroup[event];
        if (Object.keys(handlerGroup).length <= 0) this.handlers.delete(objectLink);

        return callback;
    }
    /** Checks if an event handler linked to an object exists. */
    hasLinkedHandler(objectLink: any, event: "change", callback: ChangeFunction): boolean;
    hasLinkedHandler(objectLink: any, event: "update", callback: UpdateFunction): boolean;
    hasLinkedHandler(objectLink: any, event: "add", callback: AddFunction): boolean;
    hasLinkedHandler(objectLink: any, event: "rem", callback: RemFunction): boolean;
    hasLinkedHandler(objectLink: any, event: string, callback: Function): boolean;
    hasLinkedHandler(objectLink: any, event: string, callback: Function): boolean {
        if (!this.handlers.has(objectLink)) return false;

        let handlerGroup = this.handlers.get(objectLink);
        if (handlerGroup == null) return false;

        if (!(event in handlerGroup)) return false;

        return handlerGroup[event].has(callback);
    }
    /** Gets all callbacks linked with a specific event and object. */
    getLinkedHandlers(objectLink: any, event: "change"): ChangeFunction[];
    getLinkedHandlers(objectLink: any, event: "update"): UpdateFunction[];
    getLinkedHandlers(objectLink: any, event: "add"): AddFunction[];
    getLinkedHandlers(objectLink: any, event: "rem"): RemFunction[];
    getLinkedHandlers(objectLink: any, event: string): Function[];
    getLinkedHandlers(objectLink: any, event: string): Function[] {
        if (!this.handlers.has(objectLink)) return [];

        let handlerGroup = this.handlers.get(objectLink);
        if (handlerGroup == null) return [];

        if (!(event in handlerGroup)) return [];

        return [...handlerGroup[event]];
    }
    /**
     * Clears callbacks linked with a specific event and object.
     * @returns a list of the original callbacks before clearing
     */
    clearLinkedHandlers(objectLink: any, event: "change"): ChangeFunction[];
    clearLinkedHandlers(objectLink: any, event: "update"): UpdateFunction[];
    clearLinkedHandlers(objectLink: any, event: "add"): AddFunction[];
    clearLinkedHandlers(objectLink: any, event: "rem"): RemFunction[];
    clearLinkedHandlers(objectLink: any, event: string): Function[];
    clearLinkedHandlers(objectLink: any, event: string): Function[] {
        let callbacks = this.getLinkedHandlers(objectLink, event);
        callbacks.forEach(callback => this.remLinkedHandler(objectLink, event, callback));
        return callbacks;
    }

    /**
     * Adds an event handler linked to an event (with the linked object being `null`).
     * @returns the added callback if successfully added, otherwise false
     */
    addHandler(event: "change", callback: ChangeFunction): false | ChangeFunction;
    addHandler(event: "update", callback: UpdateFunction): false | UpdateFunction;
    addHandler(event: "add", callback: AddFunction): false | AddFunction;
    addHandler(event: "rem", callback: RemFunction): false | RemFunction;
    addHandler(event: string, callback: Function): false | Function;
    addHandler(event: string, callback: Function): false | Function { return this.addLinkedHandler(null, event, callback); }
    /**
     * Removes an event handler linked to an event (with the linked object being `null`).
     * @returns the removed callback if successfully removed, otherwise false
     */
    remHandler(event: "change", callback: ChangeFunction): false | ChangeFunction;
    remHandler(event: "update", callback: UpdateFunction): false | UpdateFunction;
    remHandler(event: "add", callback: AddFunction): false | AddFunction;
    remHandler(event: "rem", callback: RemFunction): false | RemFunction;
    remHandler(event: string, callback: Function): false | Function;
    remHandler(event: string, callback: Function): false | Function { return this.remLinkedHandler(null, event, callback); }
    /** Checks if an event handler linked to an event exists (with the linked object being `null`). */
    hasHandler(event: "change", callback: ChangeFunction): boolean;
    hasHandler(event: "update", callback: UpdateFunction): boolean;
    hasHandler(event: "add", callback: AddFunction): boolean;
    hasHandler(event: "rem", callback: RemFunction): boolean;
    hasHandler(event: string, callback: Function): boolean;
    hasHandler(event: string, callback: Function): boolean { return this.hasLinkedHandler(null, event, callback); }
    /** Gets all callbacks linked to an event (with the linked object being `null`). */
    getHandlers(event: "change"): ChangeFunction[];
    getHandlers(event: "update"): UpdateFunction[];
    getHandlers(event: "add"): AddFunction[];
    getHandlers(event: "rem"): RemFunction[];
    getHandlers(event: string): Function[];
    getHandlers(event: string): Function[] { return this.getLinkedHandlers(null, event); }
    /**
     * Clears all callbacks linked to an event (with the linked object being `null`).
     * @returns a list of the original callbacks before clearing
     */
    clearHandlers(event: "change"): ChangeFunction[];
    clearHandlers(event: "update"): UpdateFunction[];
    clearHandlers(event: "add"): AddFunction[];
    clearHandlers(event: "rem"): RemFunction[];
    clearHandlers(event: string): Function[];
    clearHandlers(event: string): Function[] { return this.clearLinkedHandlers(null, event); }

    /** Posts an event by calling every linked callback with the specified arguments. */
    post<T>(event: "change", attribute: string, from: T, to: T): void;
    post(event: "update", delta: number): void;
    post(event: "add"): void;
    post(event: "rem"): void;
    post(event: string, ...args: any[]): void;
    post(event: string, ...args: any[]): void {
        if (this.nHandlers <= 0) return;

        for (let handlerGroup of this.handlers.values()) {
            if (!(event in handlerGroup)) continue;
            handlerGroup[event].forEach(callback => callback(...args));
        }
    }
    /** Posts an event by calling every linked callback with the specified arguments, but requests that the return values of all the callbacks be saved as well. */
    async postResult(event: string, ...args: any[]): Promise<any[]> {
        if (this.nHandlers <= 0) return [];

        let callbacks: Function[] = [];
        for (let handlerGroup of this.handlers.values()) {
            if (!(event in handlerGroup)) continue;
            callbacks.push(...handlerGroup[event]);
        }
        return await Promise.all(callbacks.map(async callback => await callback(...args)));
    }
    /** Posts a change event with the specific attribute that is changed and what its previous and current value is. */
    change<T>(attribute: string, from: T, to: T): void {
        if (this.nHandlers <= 0) return;
        this.post("change", attribute, from, to);
        this.post("change-"+attribute, from, to);
    }
    /** Posts an add event - used whenever an object is "added" to another. */
    onAdd(): void { return this.post("add"); }
    /** Posts a remove event - used whenever an object is "removed" from another. */
    onRem(): void { return this.post("rem"); }
}

/** A mutable data type for monitoring the addition and removing of values. */
export abstract class Collection<T, TAlt = T> extends Target {
    constructor() {
        super();
    }

    /** Adds a value to an internal property. */
    protected abstract addInternal(value: T): void;
    /** Removes a value from an internal property. */
    protected abstract remInternal(value: T): void;

    /** Converts an alternate value fto its proper type. */
    abstract convert(value: TAlt | T): T | false;

    /** Given a value, check whether it should be allowed to be added. */
    addFilter(value: T): boolean { return !this.has(value); }
    /** Called on every added value. */
    protected addCallback(value: T): void {}
    /** Called after any values were added. */
    addFinal(): void {}

    /** Given a value, check whether it should be allowed to be removed. */
    remFilter(value: T): boolean { return this.has(value); }
    /** Called on every removed value. */
    protected remCallback(value: T): void {}
    /** Called after any values were removed. */
    remFinal(): void {}

    /**
     * Adds one value to this collection.
     * @returns false if unsuccessful, the value itself otherwise
     */
    add(value: TAlt | T): T | false {
        let newValue = this.convert(value);
        if (newValue === false) return false;
        if (!this.addFilter(newValue)) return false;
        this.addInternal(newValue);
        this.change("add", null, newValue);
        this.addCallback(newValue);
        this.addFinal();
        return newValue;
    }
    /**
     * Adds multiple values to this collection.
     * @returns a list of the successfully added values
     */
    addMultiple(...values: (TAlt | T)[]): T[] {
        let newValues = values
            .map(value => this.convert(value))
            .filter(value => value !== false) as T[];
        newValues
            .filter(value => !this.addFilter(value))
            .forEach(value => {
                this.addInternal(value);
                this.change("add", null, value);
                this.addCallback(value);
            });
            if (newValues.length > 0) this.addFinal();
        return newValues;
    }
    /**
     * Removes one value from this collection.
     * @returns false if unsuccessful, the value itself otherwise
     */
    rem(value: TAlt | T): T | false {
        let newValue = this.convert(value);
        if (newValue === false) return false;
        if (!this.remFilter(newValue)) return false;
        this.remCallback(newValue);
        this.change("rem", newValue, null);
        this.remInternal(newValue);
        this.remFinal();
        return newValue;
    }
    /**
     * Removes multiple values from this collection.
     * @returns a list of the successfully removed values
     */
    remMultiple(...values: (TAlt | T)[]): T[] {
        let newValues = values
            .map(value => this.convert(value))
            .filter(value => value !== false) as T[];
        newValues
            .filter(value => !this.remFilter(value))
            .forEach(value => {
                this.remCallback(value);
                this.change("rem", value, null);
                this.remInternal(value);
            });
        if (newValues.length > 0) this.remFinal();
        return newValues;
    }
    /** Checks if a value exists within this collection. */
    has(value: TAlt | T): boolean {
        let newValue = this.convert(value);
        if (newValue === false) return false;
        return this.hasInternal(newValue);
    }
    protected abstract hasInternal(vlaue: T): boolean;
}

/** A mutable list for monitoring the addition and removing of values. */
export abstract class List<T, TAlt = T> extends Collection<T, TAlt> {
    protected _list: T[];

    constructor() {
        super();

        this._list = [];
    }

    get list() { return [...this._list]; }
    set list(values) {
        this.remMultiple(...this._list);
        this.addMultiple(...values);
    }

    protected addInternal(value: T): void { this._list.push(value); }
    protected remInternal(value: T): void { this._list.splice(this._list.indexOf(value), 1); }
    protected hasInternal(value: T): boolean { return this._list.includes(value); }

    get length() { return this._list.length; }

    /**
     * Inserts a value at a specific location.
     * @returns false if unsuccessful, the value itself otherwise
     */
    insert(value: TAlt | T, at: number): T | false {
        let returnValue = this.add(value);
        if (returnValue === false) return false;
        this.remInternal(returnValue);
        this._list.splice(Math.round(at), 0, returnValue);
        return returnValue;
    }

    /** Gets a value by its index. */
    get(i: number): T | null {
        if (i < 0) return null;
        if (i >= this._list.length) return null;
        return this._list[i];
    }
    /** Clears all values from this list. */
    clear(): T[] {
        let list = this.list;
        this.list = [];
        return list;
    }
    
    /** Copies another list of the same type */
    copy(other: List<T, TAlt>): this {
        this.list = other.list;
        return this;
    }
}

/** A mutable dictionary for monitoring the addition and removing of values. */
export abstract class Dict<T, TAlt = T> extends Collection<T, TAlt> {
    protected _dict: Map<string, T>;

    constructor() {
        super();

        this._dict = new Map();
    }

    get keys() { return [...this._dict.keys()]; }
    get values() { return [...this._dict.values()]; }
    get map() {
        let map = new Map<string, T>();
        this.keys.forEach(key => map.set(key, this.get(key) as T));
        return map;
    }
    set map(values) {
        this.remMultiple(...this.values);
        this.addMultiple(...values.values());
    }

    protected hasInternal(value: T): boolean { return this.values.includes(value); }

    /** Gets a value by its key. */
    get(key: string): T | null { return this._dict.get(key) || null; }
    /** Clears all values from this dictionary. */
    clear(): Map<string, T> {
        let map = this.map;
        this.map = new Map();
        return map;
    }

    /** Copies another dictionary of the same type */
    copy(other: Dict<T, TAlt>): this {
        this.map = other.map;
        return this;
    }
}

export type Constructable = new (...args: any[]) => Target;
export type Revivable = {
    "%cstm": true,
    "%o": string,
    "%a": any[],
};
/** Internal Reviver rule dict. */
class ReviverRuleDict extends Dict<Constructable, Constructable | string> {
    convert(value: Constructable | string): Constructable | false {
        if (typeof(value) === "string") {
            let newValue = this.get(value);
            return newValue ?? false;
        }
        return value;
    }
    protected addInternal(value: Constructable): void { this._dict.set(value.name, value); }
    protected remInternal(value: Constructable): void { this._dict.delete(value.name); }
    protected hasInternal(value: Constructable): boolean { return super.hasInternal(value) && this.keys.includes(value.name); }
}
/** Manages the reviving of objects from JSON objects. */
export class Reviver extends Target {
    // private _rules: StringMap<Constructable>;
    readonly rules;

    constructor(reviver?: Reviver) {
        super();
        
        // this._rules = {};
        this.rules = new ReviverRuleDict();
        this.rules.addHandler("change", (attribute: string, from: any, to: any) => this.change("rules."+attribute, from, to));

        // if (reviver) reviver.rules.forEach(constructor => this.addRule(constructor));
        if (reviver) this.rules.copy(reviver.rules);
    }

    /** Clones this object into a new one. */
    clone() { return new Reviver(this); }

    get revivalFunction(): (key: string, value: any) => any {
        return (key: string, value: any) => {
            if (typeof(value) !== "object") return value;

            if (!("%cstm" in value)) return value;
            let useCustom = castBoolean(value["%cstm"]);

            if (!("%o" in value)) return value;
            let objectType = castString(value["%o"]);

            if (!("%a" in value)) return value;
            let args = castArray(value["%a"]);

            if (!useCustom) return value;
            if (!this.rules.has(objectType)) return value;
            let rule = this.rules.get(objectType) as Constructable;
            return new rule(...args);
        };
    }

    /** Generates a revivable signature from a specific constructor and their constructor arguments */
    static revivable(constructor: Constructable, ...args: any[]): Revivable {
        return {
            "%cstm": true,
            "%o": constructor.name,
            "%a": args,
        };
    }
}
export const REVIVER = new Reviver();

export type ColorLike =
    Color |
    VecN | vecn |
    number | string |
    { r?: number, g?: number, b?: number, a?: number }
;

/** Color data structure with utility methods. */
export class Color extends Target {
    static { REVIVER.rules.add(this); }

    private _r: number;
    private _g: number;
    private _b: number;
    private _a: number;

    private hsvCache: vec3 | null;
    private hexCache: string | null;
    private hexCacheNoAlpha: string | null;
    private rgbaCache: string | null;
    private rgbCache: string | null;

    constructor(source?: ColorLike) {
        super();

        this._r = this._g = this._b = this._a = 0;

        this.hsvCache = this.hexCache = this.hexCacheNoAlpha = this.rgbaCache = this.rgbCache = null;

        this.uncache();

        this.set(source);
    }

    /**
     * Generates the correct properties given the constructor arguments.
     * 
     * Essentially bypassess the need for calling the constructor to get a properly *formatted* "Color" object. This saves some overhead performance during operations when many color objects might need to be instantiated.
     */
    static args(source?: ColorLike): vec4 {
        if (source instanceof Color) return source.rgba;
        if (source instanceof Vec1) return this.args(source.x);
        if (source instanceof Vec2) return this.args(source.xy);
        if (source instanceof Vec3) return this.args(source.xyz);
        if (source instanceof Vec4) return this.args(source.wxyz);
        if (Array.isArray(source)) {
            if (source.length === 1) return this.args(source[0]);
            if (source.length === 2) {
                let rgb = [0, 0, 0] as vec3;
                let hexadecimal = source[0];
                for (let i = 3; i >= 0; i--) {
                    let value = hexadecimal % 256;
                    hexadecimal = Math.floor(hexadecimal / 256);
                    rgb[i] = value;
                }
                return this.args(rgb);
            }
            if (source.length === 3) return [...source, 1];
            return source;
        }
        if (typeof(source) === "string") {
            if (source.startsWith("#")) {
                source = source.slice(1).toLowerCase();
                for (let character of source) {
                    if (BASE16.includes(character)) continue;
                    return this.args([0, 1]);
                }
                let values = this.args([0, 1]);
                if (source.length === 3 || source.length === 4) {
                    for (let i = 0; i < source.length; i++) {
                        let value = BASE16.indexOf(source[i]);
                        value = value*16 + value;
                        values[i] = value;
                    }
                    return values;
                }
                if (source.length === 6 || source.length === 8) {
                    for (let i = 0; i < source.length/2; i++) {
                        let value = BASE16.indexOf(source[i*2])*16 + BASE16.indexOf(source[i*2+1]);
                        values[i] = value;
                    }
                }
                return values;
            }
            if ((source.startsWith("rgb(") || source.startsWith("rgba(")) && source.endsWith(")")) {
                source = source.slice(source.startsWith("rgb(") ? 4 : 5, -1);
                let parts = source.split(",").map(part => part.trim());
                if (parts.length !== 3 && parts.length !== 4) return this.args([0, 1]);
                let values = this.args([0, 1]);
                for (let i = 0; i < parts.length; i++)
                    values[i] = parseFloat(parts[i]);
                return values;
            }
            if (source.startsWith("--")) return this.args(getComputedStyle(document.body).getPropertyValue(source));
            return this.args([0, 1]);
        }
        if (typeof(source) === "object") return [castNumber(source.r), castNumber(source.g), castNumber(source.b), castNumber(source.a)];
        if (typeof(source) !== "number") return this.args([0, 1]);
        return this.args([source, 1]);
    }
    /** Sets this object to whatever arguments are provided. */
    set(source?: ColorLike): this {
        [this.r, this.g, this.b, this.a] = Color.args(source);
        return this;
    }
    /** Clones this object into a new one. */
    clone() { return new Color(this); }

    /** Uncaches some computationally heavy values that are calculated for specific properties, like hue, saturation, and value, among some others. */
    private uncache() { this.hsvCache = this.hexCache = this.hexCacheNoAlpha = this.rgbaCache = this.rgbCache = null; }

    get r() { return this._r; }
    set r(value) {
        value = Math.min(255, Math.max(0, value));
        if (this.r === value) return;
        this.uncache();
        this.change("r", this.r, this._r=value);
    }
    get g() { return this._g; }
    set g(value) {
        value = Math.min(255, Math.max(0, value));
        if (this.g === value) return;
        this.uncache();
        this.change("g", this.g, this._g=value);
    }
    get b() { return this._b; }
    set b(value) {
        value = Math.min(255, Math.max(0, value));
        if (this.b === value) return;
        this.uncache();
        this.change("b", this.b, this._b=value);
    }
    get a() { return this._a; }
    set a(value) {
        value = Math.min(1, Math.max(0, value));
        if (this.a === value) return;
        this.uncache();
        this.change("a", this.a, this._a=value);
    }
    get rgb(): vec3 { return [this.r, this.g, this.b]; }
    set rgb(value) { [this.r, this.g, this.b] = value }
    get rgba(): vec4 { return [this.r, this.g, this.b, this.a]; }
    set rgba(value) { [this.r, this.g, this.b, this.a] = value; }

    /** Calculates the average difference between one color and another on a scale of 0-255 (each RGB value), with 0 being identical and 255 being opposite */
    averageDifference(source: ColorLike): number {
        let [ r, g, b, a ] = Color.args(source);
        return sumArray([
            Math.abs(this.r-r),
            Math.abs(this.g-g),
            Math.abs(this.b-b),
            Math.abs(this.a*255-a*255),
        ]) / 4;
    }

    get hsva(): vec4 {
        if (this.hsvCache == null) {
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
            this.hsvCache = [h, s, v];
        }
        return [...this.hsvCache, this.a];
    }
    set hsva(hsva) {
        hsva[0] = clampAngleDegrees(hsva[0]);
        for (let i = 1; i < 4; i++) hsva[i] = Math.min(1, Math.max(0, hsva[i]));
        let [h, s, v, a] = hsva;
        let c = v * s;
        let x = c * (1-Math.abs(((h/60)%2)-1));
        let m = v - c;
        let rgb: vec3 = [0, 0, 0];
        for (let i = 0; i < 3; i++) {
            if (h >= (i+1)*120) continue;
            let u = i, v = (i+1)%3;
            if (h >= (i+0.5)*120) [u, v] = [v, u];
            rgb[u] = c;
            rgb[v] = x;
            break;
        }
        rgb = rgb.map(v => (v+m)*255) as vec3;
        this.rgba = [...rgb, a];
    }
    get h() { return this.hsva[0]; }
    set h(value) {
        let hsva = this.hsva;
        hsva[0] = value;
        this.hsva = hsva;
    }
    get s() { return this.hsva[1]; }
    set s(value) {
        let hsva = this.hsva;
        hsva[1] = value;
        this.hsva = hsva;
    }
    get v() { return this.hsva[2]; }
    set v(value) {
        let hsva = this.hsva;
        hsva[2] = value;
        this.hsva = hsva;
    }
    get hsv(): vec3 { return this.hsva.slice(0, 3) as vec3; }
    set hsv(hsv) {
        let hsva = this.hsva;
        [hsva[0], hsva[1], hsva[2]] = hsv;
        this.hsva = hsva;
    }

    /** Checks if two Color objects are equal */
    equals(source: ColorLike): boolean {
        let [ r, g, b, a ] = Color.args(source);
        if (this.r != r) return false;
        if (this.g != g) return false;
        if (this.b != b) return false;
        if (this.a != a) return false;
        return true;
    }

    /** Generates the hex color code for this Color object, with the ability to specify alpha channel inclusion */
    toHex(useAlpha = true): string {
        let value = useAlpha ? this.hexCache : this.hexCacheNoAlpha;
        if (value == null) {
            value = "#"+(useAlpha ? this.rgba : this.rgb).map((v, i) => {
                if (i === 3) v *= 255;
                v = Math.round(v);
                return BASE16[Math.floor(v/16)]+BASE16[v%16];
            }).join("");
            if (useAlpha) this.hexCache = value;
            else this.hexCacheNoAlpha = value;
        }
        return value;
    }
    /** Generates the RGBA color code for this Color object */
    toRGBA(): string {
        if (this.rgbaCache == null) this.rgbaCache = "rgba("+this.rgba.join(",")+")";
        return this.rgbaCache;
    }
    /** Generates the RGB color code for this Color object */
    toRGB(): string {
        if (this.rgbCache == null) this.rgbCache = "rgb("+this.rgb.join(",")+")";
        return this.rgbCache;
    }

    toJSON() {
        return Reviver.revivable(Color, {
            r: this.r,
            g: this.g,
            b: this.b,
            a: this.a,
        });
    }
}

export type RangeLike =
    Range |
    Vec1 | Vec2 |
    vec1 | vec2 |
    number |
    { l?: number, r?: number, lInclude?: boolean, rInclude?: boolean }
;
export type RangeArgs = [number, number, boolean, boolean];

/** A range/interval class */
export class Range extends Target {
    static { REVIVER.rules.add(this); }

    private _l: number;
    private _r: number;
    private _lInclude: boolean;
    private _rInclude: boolean;

    constructor(source?: RangeLike) {
        super();

        this._l = this._r = 0;
        this._lInclude = this._rInclude = true;

        this.set(source);
    }

    /**
     * Generates the correct properties given the constructor arguments.
     * 
     * Essentially bypassess the need for calling the constructor to get a properly *formatted* "Range" object. This saves some overhead performance during operations when many range objects might need to be instantiated.
     */
    static args(source?: RangeLike): RangeArgs {
        if (source instanceof Range) return [source.l, source.r, source.lInclude, source.rInclude];
        if (source instanceof Vec1) return this.args(source.x);
        if (source instanceof Vec2) return this.args(source.xy);
        if (Array.isArray(source)) {
            if (source.length === 1) return this.args([source[0], source[0]]);
            return [...source, true, true];
        }
        if (typeof(source) === "object") return [castNumber(source.l), castNumber(source.r), castBoolean(source.lInclude, true), castBoolean(source.rInclude, true)];
        if (typeof(source) !== "number") return this.args(0);
        return this.args([source]);
    }
    /** Sets this object to whatever arguments are provided. */
    set(source?: RangeLike): this {
        [this.l, this.r, this.lInclude, this.rInclude] = Range.args(source);
        return this;
    }
    /** Clones this object into a new one. */
    clone() { return new Range(this); }

    get l() { return this._l; }
    set l(value) {
        if (this.l === value) return;
        this.change("l", this.l, this._l=value);
    }
    get r() { return this._r; }
    set r(value) {
        if (this.r === value) return;
        this.change("r", this.r, this._r=value);
    }

    get lInclude() { return this._lInclude; }
    set lInclude(value) {
        if (this.lInclude === value) return;
        this.change("lInclude", this.lInclude, this._lInclude=value);
    }
    get rInclude() { return this._rInclude; }
    set rInclude(value) {
        if (this.rInclude === value) return;
        this.change("rInclude", this.rInclude, this._rInclude=value);
    }

    /** Normalizes the range so that if somehow the left and right bounds are reversed, they will be sorted properly. */
    normalize(): this {
        if (this.l > this.r) [this.l, this.r] = [this.r, this.l];
        return this;
    }

    /** Tests whether or not a value lies within this range. */
    test(value: number): boolean {
        if (this.lInclude && value < this.l) return false;
        if (!this.lInclude && value <= this.l) return false;
        if (this.rInclude && value > this.r) return false;
        if (!this.rInclude && value >= this.r) return false;
        return true;
    }
    /** Clamps a value between the left and right bounds of this range. This does not account for inclusion as we have no way of enforcing that. */
    clamp(value: number): number { return Math.min(this.r, Math.max(this.l, value)); }
    /** Interpolates a number between the left and right bounds of this range using the interpolation factor. However, if any of the bounds are Infinity, NaN is returned */
    lerp(p: number): number {
        if (!Number.isFinite(this.l) || !Number.isFinite(this.r)) return NaN;
        return lerp(this.l, this.r, p);
    }

    /** Checks if two Range objects are equal */
    equals(source: RangeLike): boolean {
        let args = Range.args(source);
        if (this.l !== args[0]) return false;
        if (this.r !== args[1]) return false;
        if (this.lInclude !== args[2]) return false;
        if (this.rInclude !== args[3]) return false;
        return true;
    }

    toString() { return (this.lInclude ? "[" : "(") + this.l + ", " + this.r + (this.rInclude ? "]" : ")"); }

    toJSON() {
        return Reviver.revivable(Range, {
            l: this.l, r: this.r,
            lInclude: this.lInclude, rInclude: this.rInclude,
        });
    }
}

export type VecN = Vec1 | Vec2 | Vec3 | Vec4;
export type VectorLike = VecN | vecn | number | { w?: number, x?: number, y?: number, z?: number } | null;


/** A Vector1d class */
export class Vec1 extends Target {
    static { REVIVER.rules.add(this); }

    private _x: number;

    constructor(source?: VectorLike) {
        super();

        this._x = 0;

        this.set(source);
    }

    /**
     * Generates the correct properties given the constructor arguments.
     * 
     * Essentially bypassess the need for calling the constructor to get a properly *formatted* "Vec1" object. This saves some overhead performance during operations when many vector1d objects might need to be instantiated.
     */
    static args(source?: VectorLike): vec1 {
        if (source instanceof Vec1 || source instanceof Vec2 || source instanceof Vec3 || source instanceof Vec4) return this.args(source.x);
        if (Array.isArray(source)) {
            return source.slice(0, 1) as vec1;
        }
        if (typeof(source) === "object" && source) return [castNumber(source.x)];
        if (typeof(source) !== "number") return this.args(0);
        return this.args([source]);
    }
    /** Sets this object to whatever arguments are provided. */
    set(source?: VectorLike): this {
        [this.x] = Vec1.args(source);
        return this;
    }
    /** Clones this object into a new one. */
    clone() { return new Vec1(this); }

    get x() { return this._x; }
    set x(value) {
        if (this.x === value) return;
        this.change("x", this.x, this._x=value);
    }

    /**
     * Adds another vector to this one.
     * @returns a new instance of Vec1
     */
    add(addend: VectorLike): Vec1 {
        let args = Vec1.args(addend);
        return new Vec1([this.x+args[0]]);
    }
    /**
     * Subtracts another vector from this one.
     * @returns a new instance of Vec1
     */
    sub(subtrahend: VectorLike): Vec1 {
        let args = Vec1.args(subtrahend);
        return new Vec1([this.x-args[0]]);
    }
    /**
     * Multiplies this vector by another one.
     * @returns a new instance of Vec1
     */
    mul(factor: VectorLike): Vec1 {
        let args = Vec1.args(factor);
        return new Vec1([this.x*args[0]]);
    }
    /**
     * Divides this vector by another one.
     * @returns a new instance of Vec1
     */
    div(divisor: VectorLike): Vec1 {
        let args = Vec1.args(divisor);
        return new Vec1([this.x/args[0]]);
    }
    /**
     * Raises this vector to the power another one.
     * @returns a new instance of Vec1
     */
    pow(exponent: VectorLike): Vec1 {
        let args = Vec1.args(exponent);
        return new Vec1([this.x**args[0]]);
    }

    /**
     * Maps each dimension of this vector through a callback function.
     * @returns a new instance of Vec1
     */
    map(callback: (value: number) => number): Vec1 { return new Vec1([callback(this.x)]); }
    /** Utilizes {@link map} with {@link Math.abs} */
    abs(): Vec1 { return this.map(Math.abs); }
    /** Utilizes {@link map} with {@link Math.floor} */
    floor(): Vec1 { return this.map(Math.floor); }
    /** Utilizes {@link map} with {@link Math.ceil} */
    ceil(): Vec1 { return this.map(Math.ceil); }
    /** Utilizes {@link map} with {@link Math.round} */
    round(): Vec1 { return this.map(Math.round); }

    /**
     * Adds another vector to this one.
     * @returns this vector instance
     */
    iadd(addend: VectorLike): this {
        let [ x ] = Vec1.args(addend);
        this.x += x;
        return this;
    }
    /**
     * Subtracts another vector from this one.
     * @returns this vector instance
     */
    isub(subtrahend: VectorLike): this {
        let [ x ] = Vec1.args(subtrahend);
        this.x -= x;
        return this;
    }
    /**
     * Multiplies this vector by another one.
     * @returns this vector instance
     */
    imul(factor: VectorLike): this {
        let [ x ] = Vec1.args(factor);
        this.x *= x;
        return this;
    }
    /**
     * Divides this vector by another one.
     * @returns this vector instance
     */
    idiv(divisor: VectorLike): this {
        let [ x ] = Vec1.args(divisor);
        this.x /= x;
        return this;
    }
    /**
     * Raises this vector to the power another one.
     * @returns this vector instance
     */
    ipow(exponent: VectorLike): this {
        let [ x ] = Vec1.args(exponent);
        this.x **= x;
        return this;
    }

    /**
     * Maps each dimension of this vector through a callback function.
     * @returns this vector instance
     */
    imap(callback: (value: number) => number): this {
        this.x = callback(this.x);
        return this;   
    }
    /** Utilizes {@link imap} with {@link Math.abs} */
    iabs(): this { return this.imap(Math.abs); }
    /** Utilizes {@link imap} with {@link Math.floor} */
    ifloor(): this { return this.imap(Math.floor); }
    /** Utilizes {@link imap} with {@link Math.ceil} */
    iceil(): this { return this.imap(Math.ceil); }
    /** Utilizes {@link imap} with {@link Math.round} */
    iround(): this { return this.imap(Math.round); }

    /** Calculates the distance between this vector and another. */
    dist(dest: VectorLike): number {
        let [ x ] = Vec1.args(dest);
        return Math.abs(this.x - x);
    }
    /** Checks whether this vector is equal to another. */
    equals(comparand: VectorLike): boolean {
        let [ x ] = Vec1.args(comparand);
        return (this.x === x);
    }

    toString() { return "<"+this.x+">" }

    toJSON() {
        return Reviver.revivable(Vec1, {
            x: this.x,
        });
    }
}

/** A Vector2d class */
export class Vec2 extends Target {
    static { REVIVER.rules.add(this); }

    private _x: number;
    private _y: number;

    constructor(source?: VectorLike) {
        super();

        this._x = this._y = 0;

        this.set(source);
    }

    /**
     * Generates the correct properties given the constructor arguments.
     * 
     * Essentially bypassess the need for calling the constructor to get a properly *formatted* "V" object. This saves some overhead performance during operations when many vector2d objects might need to be instantiated.
     */
    static args(source?: VectorLike): vec2 {
        if (source instanceof Vec1) return this.args([source.x, 0]);
        if (source instanceof Vec2 || source instanceof Vec3 || source instanceof Vec4) return this.args([source.x, source.y]);
        if (Array.isArray(source)) {
            if (source.length === 1) return this.args([source[0], source[0]]);
            return source.slice(0, 2) as vec2;
        }
        if (typeof(source) === "object" && source) return [castNumber(source.x), castNumber(source.y)];
        if (typeof(source) !== "number") return this.args(0);
        return this.args([source]);
    }
    /** Sets this object to whatever arguments are provided. */
    set(source?: VectorLike): this {
        [this.x, this.y] = Vec2.args(source);
        return this;
    }
    /** Clones this object into a new one. */
    clone() { return new Vec2(this); }

    get x() { return this._x; }
    set x(value) {
        if (this.x === value) return;
        this.change("x", this.x, this._x=value);
    }
    get y() { return this._y; }
    set y(value) {
        if (this.y === value) return;
        this.change("y", this.y, this._y=value);
    }
    get xy(): vec2 { return [this.x, this.y]; }
    set xy(value: vec2) { [this.x, this.y] = value; }

    /**
     * Adds another vector to this one.
     * @returns a new instance of Vec2
     */
    add(addend: VectorLike): Vec2 {
        let [ x, y ] = Vec2.args(addend);
        return new Vec2([this.x+x, this.y+y]);
    }
    /**
     * Subtracts another vector from this one.
     * @returns a new instance of Vec2
     */
    sub(subtrahend: VectorLike): Vec2 {
        let [ x, y ] = Vec2.args(subtrahend);
        return new Vec2([this.x-x, this.y-y]);
    }
    /**
     * Multiplies this vector by another one.
     * 
     * It is important to note that the definition of vector2d multiplication is dot product. The "multiply" referenced here is a simple dimension multiplication. Essentially, given vector `<x1, y1>` and `<x2, y2>`, the output would be `<x1*x2, y1*y2>`. Not true vector multiplication, but helpful.
     * 
     * @returns a new instance of Vec2
     */
    mul(factor: VectorLike): Vec2 {
        let [ x, y ] = Vec2.args(factor);
        return new Vec2([this.x*x, this.y*y]);
    }
    /**
     * Divides this vector by another one.
     * 
     * It is important to note that there is no such thing as vector2d division. The "divide" referenced here is a simple dimension division. Essentially, given vector `<x1, y1>` and `<x2, y2>`, the output would be `<x1/x2, y1/y2>`.
     * 
     * @returns a new instance of Vec2
     */
    div(divisor: VectorLike): Vec2 {
        let [ x, y ] = Vec2.args(divisor);
        return new Vec2([this.x/x, this.y/y]);
    }
    /**
     * Raises this vector to the power another one.
     * 
     * It is important to note that there is no such thing as vector2d power raising. The "power" referenced here is a simple dimension power raising. Essentially, given vector `<x1, y1>` and `<x2, y2>`, the output would be `<x1^x2, y1^y2>`.
     * 
     * @returns a new instance of Vec2
     */
    pow(exponent: VectorLike): Vec2 {
        let [ x, y ] = Vec2.args(exponent);
        return new Vec2([this.x**x, this.y**y]);
    }

    /**
     * Maps each dimension of this vector through a callback function.
     * @returns a new instance of Vec2
     */
    map(callback: (value: number) => number): Vec2 { return new Vec2([callback(this.x), callback(this.y)]); }
    /** Utilizes {@link map} with {@link Math.abs} */
    abs(): Vec2 { return this.map(Math.abs); }
    /** Utilizes {@link map} with {@link Math.floor} */
    floor(): Vec2 { return this.map(Math.floor); }
    /** Utilizes {@link map} with {@link Math.ceil} */
    ceil(): Vec2 { return this.map(Math.ceil); }
    /** Utilizes {@link map} with {@link Math.round} */
    round(): Vec2 { return this.map(Math.round); }
    
    /**
     * Rotates this vector around the origin a specific angle.
     * @returns a new instance of Vec2
     */
    rotateOrigin(angleDegrees: number): Vec2 {
        let angleRadians = angleDegrees * Math.PI/180;
        return new Vec2([
            this.x*Math.cos(angleRadians)+this.y*Math.sin(angleRadians),
            this.x*Math.cos(angleRadians-Math.PI/2)+this.y*Math.sin(angleRadians-Math.PI/2),
        ]);
    }
    /**
     * Rotates this vector around a point a specific angle.
     * @returns a new instance of Vec2
     */
    rotate(angleDegrees: number, origin: any): Vec2 { return this.sub(origin).irotateOrigin(angleDegrees).iadd(origin); }
    /**
     * Normalizes this vector so that the magnitude is 1. This does not apply to zero vectors.
     * @returns a new instance of Vec2
     */
    normalize(): Vec2 { return (this.dist(0) > 0) ? this.div(this.dist(0)) : new Vec2(this); }

    /**
     * Adds another vector to this one.
     * @returns this vector instance
     */
    iadd(addend: VectorLike): this {
        let [ x, y ] = Vec2.args(addend);
        this.x += x; this.y += y;
        return this;
    }
    /**
     * Subtracts another vector from this one.
     * @returns this vector instance
     */
    isub(subtrahend: VectorLike): this {
        let [ x, y ] = Vec2.args(subtrahend);
        this.x -= x; this.y -= y;
        return this;
    }
    /**
     * Multiplies this vector by another one.
     * 
     * It is important to note that there are multiple types of vector2d multiplication. The "multiply" referenced here is a simple dimension multiplication. Essentially, given vector `<x1, y1>` and `<x2, y2>`, the output would be `<x1*x2, y1*y2>`. Not true vector multiplication, but helpful.
     * 
     * @returns this vector instance
     */
    imul(factor: VectorLike): this {
        let [ x, y ] = Vec2.args(factor);
        this.x *= x; this.y *= y;
        return this;
    }
    /**
     * Divides this vector by another one.
     * 
     * It is important to note that there is no such thing as vector2d division. The "divide" referenced here is a simple dimension division. Essentially, given vector `<x1, y1>` and `<x2, y2>`, the output would be `<x1/x2, y1/y2>`.
     * 
     * @returns this vector instance
     */
    idiv(divisor: VectorLike): this {
        let [ x, y ] = Vec2.args(divisor);
        this.x /= x; this.y /= y;
        return this;
    }
    /**
     * Raises this vector to the power another one.
     * 
     * It is important to note that there is no such thing as vector2d power raising. The "power" referenced here is a simple dimension power raising. Essentially, given vector `<x1, y1>` and `<x2, y2>`, the output would be `<x1^x2, y1^y2>`.
     * 
     * @returns this vector instance
     */
    ipow(exponent: VectorLike): this {
        let [ x, y ] = Vec2.args(exponent);
        this.x **= x; this.y **= y;
        return this;
    }

    /**
     * Maps each dimension of this vector through a callback function.
     * @returns this vector instance
     */
    imap(callback: (value: number) => number): this {
        this.x = callback(this.x);
        this.y = callback(this.y);
        return this;   
    }
    /** Utilizes {@link imap} with {@link Math.abs} */
    iabs(): this { return this.imap(Math.abs); }
    /** Utilizes {@link imap} with {@link Math.floor} */
    ifloor(): this { return this.imap(Math.floor); }
    /** Utilizes {@link imap} with {@link Math.ceil} */
    iceil(): this { return this.imap(Math.ceil); }
    /** Utilizes {@link imap} with {@link Math.round} */
    iround(): this { return this.imap(Math.round); }

    /**
     * Rotates this vector around the origin a specific angle.
     * @returns this vector instance
     */
    irotateOrigin(angleDegrees: number): this {
        let angleRadians = angleDegrees * Math.PI/180;
        [this.x, this.y] = [
            this.x*Math.cos(angleRadians)+this.y*Math.sin(angleRadians),
            this.x*Math.cos(angleRadians-Math.PI/2)+this.y*Math.sin(angleRadians-Math.PI/2),
        ];
        return this;
    }
    /**
     * Rotates this vector around a point a specific angle.
     * @returns this vector instance
     */
    irotate(angleDegrees: number, origin: any): this { return this.isub(origin).irotateOrigin(angleDegrees).iadd(origin); }
    /**
     * Normalizes this vector so that the magnitude is 1. This does not apply to zero vectors.
     * @returns this vector instance
     */
    inormalize(): this { return (this.dist(0) > 0) ? this.idiv(this.dist(0)) : this; }

    /** Calculates the squared distance between this vector and another. */
    distSquared(dest: VectorLike): number {
        let [ x, y ] = Vec2.args(dest);
        return (this.x-x)**2 + (this.y-y)**2;
    }

    /** Calculates the distance between this vector and another. */
    dist(dest: VectorLike): number { return Math.sqrt(this.distSquared(dest)); }

    /** Calculates the heading angle (relative to the positive x axis) from this vector to another. */
    towards(dest: VectorLike): number {
        let [ x, y ] = Vec2.args(dest);
        return (180/Math.PI)*Math.atan2(y-this.y, x-this.x);
    }

    /** Checks whether this vector is equal to another. */
    equals(comparand: VectorLike): boolean {
        let [ x, y ] = Vec2.args(comparand);
        return (this.x === x) && (this.y === y); 
    }

    /** Instantiate a directional vector with a heading angle (relative to the positive x axis) and a magnitude. */
    static dir(headingDegrees: number, magnitude: number = 1): Vec2 {
        let headingRadians = headingDegrees * Math.PI/180;
        return new Vec2([Math.cos(headingRadians), Math.sin(headingRadians)]).imul(magnitude);
    }

    toString() { return "<"+this.xy.join(", ")+">" }

    toJSON() {
        return Reviver.revivable(Vec2, {
            x: this.x,
            y: this.y,
        });
    }
}

/** A Vector3d class */
export class Vec3 extends Target {
    static { REVIVER.rules.add(this); }

    private _x: number;
    private _y: number;
    private _z: number;

    constructor(source?: VectorLike) {
        super();

        this._x = this._y = this._z = 0;
        
        this.set(source);
    }

    /**
     * Generates the correct properties given the constructor arguments.
     * 
     * Essentially bypassess the need for calling the constructor to get a properly *formatted* "Vec3" object. This saves some overhead performance during operations when many vector3d objects might need to be instantiated.
     */
    static args(source?: VectorLike): vec3 {
        if (source instanceof Vec1) return this.args([source.x, 0]);
        if (source instanceof Vec2) return this.args(source.xy);
        if (source instanceof Vec3 || source instanceof Vec4) return this.args([source.x, source.y, source.z]);
        if (Array.isArray(source)) {
            if (source.length === 1) return this.args([source[0], source[0], source[0]]);
            if (source.length === 2) return this.args([...source, 0]);
            return source.slice(0, 3) as vec3;
        }
        if (typeof(source) === "object" && source) return [castNumber(source.x), castNumber(source.y), castNumber(source.z)];
        if (typeof(source) !== "number") return this.args(0);
        return this.args([source]);
    }
    /** Sets this object to whatever arguments are provided. */
    set(source?: VectorLike): this {
        [this.x, this.y, this.z] = Vec3.args(source);
        return this;
    }
    /** Clones this object into a new one. */
    clone() { return new Vec3(this); }

    get x() { return this._x; }
    set x(value) {
        if (this.x === value) return;
        this.change("x", this.x, this._x=value);
    }
    get y() { return this._y; }
    set y(value) {
        if (this.y === value) return;
        this.change("y", this.y, this._y=value);
    }
    get z() { return this._z; }
    set z(value) {
        if (this.z === value) return;
        this.change("z", this.z, this._z=value);
    }
    get xyz(): vec3 { return [this.x, this.y, this.z]; }
    set xyz(value: vec3) { [this.x, this.y, this.z] = value; }

    /**
     * Adds another vector to this one.
     * @returns a new instance of Vec3
     */
    add(addend: VectorLike): Vec3 {
        let [ x, y, z ] = Vec3.args(addend);
        return new Vec3([this.x+x, this.y+y, this.z+z]);
    }
    /**
     * Subtracts another vector from this one.
     * @returns a new instance of Vec3
     */
    sub(subtrahend: VectorLike): Vec3 {
        let [ x, y, z ] = Vec3.args(subtrahend);
        return new Vec3([this.x-x, this.y-y, this.z-z]);
    }
    /**
     * Multiplies this vector by another one.
     * 
     * It is important to note that there are multiple types of vector3d multiplication. The "multiply" referenced here is a simple dimension multiplication. Essentially, given vector `<x1, y1, z1>` and `<x2, y2, z2>`, the output would be `<x1*x2, y1*y2, z1*z2>`. Not true vector multiplication, but helpful.
     * 
     * @returns a new instance of Vec3
     */
    mul(factor: VectorLike): Vec3 {
        let [ x, y, z ] = Vec3.args(factor);
        return new Vec3([this.x*x, this.y*y, this.z*z]);
    }
    /**
     * Divides this vector by another one.
     * 
     * It is important to note that there is no such thing as vector3d division. The "divide" referenced here is a simple dimension division. Essentially, given vector `<x1, y1, z1>` and `<x2, y2, z3>`, the output would be `<x1/x2, y1/y2, z1/z2>`.
     * 
     * @returns a new instance of Vec3
     */
    div(divisor: VectorLike): Vec3 {
        let [ x, y, z ] = Vec3.args(divisor);
        return new Vec3([this.x/x, this.y/y, this.z/z]);
    }
    /**
     * Raises this vector to the power another one.
     * 
     * It is important to note that there is no such thing as vector3d power raising. The "power" referenced here is a simple dimension power raising. Essentially, given vector `<x1, y1, z1>` and `<x2, y2, z2>`, the output would be `<x1^x2, y1^y2, z1^z2>`.
     * 
     * @returns a new instance of Vec3
     */
    pow(exponent: VectorLike): Vec3 {
        let [ x, y, z ] = Vec3.args(exponent);
        return new Vec3([this.x**x, this.y**y, this.z**z]);
    }

    /**
     * Maps each dimension of this vector through a callback function.
     * @returns a new instance of Vec3
     */
    map(callback: (value: number) => number): Vec3 {
        return new Vec3([callback(this.x), callback(this.y), callback(this.z)]);
    }
    /** Utilizes {@link map} with {@link Math.abs} */
    abs(): Vec3 { return this.map(Math.abs); }
    /** Utilizes {@link map} with {@link Math.floor} */
    floor(): Vec3 { return this.map(Math.floor); }
    /** Utilizes {@link map} with {@link Math.ceil} */
    ceil(): Vec3 { return this.map(Math.ceil); }
    /** Utilizes {@link map} with {@link Math.round} */
    round(): Vec3 { return this.map(Math.round); }

    /**
     * Normalizes this vector so that the magnitude is 1. This does not apply to zero vectors.
     * @returns a new instance of Vec3
     */
    normalize(): Vec3 { return (this.dist(0) > 0) ? this.div(this.dist(0)) : new Vec3(this); }

    /**
     * Adds another vector to this one.
     * @returns this vector instance
     */
    iadd(addend: VectorLike): this {
        let [ x, y, z ] = Vec3.args(addend);
        this.x += x; this.y += y; this.z += z;
        return this;
    }
    /**
     * Subtracts another vector from this one.
     * @returns this vector instance
     */
    isub(subtrahend: VectorLike): this {
        let [ x, y, z ] = Vec3.args(subtrahend);
        this.x -= x; this.y -= y; this.z -= z;
        return this;
    }
    /**
     * Multiplies this vector by another one.
     * 
     * It is important to note that there are multiple types of vector3d multiplication. The "multiply" referenced here is a simple dimension multiplication. Essentially, given vector `<x1, y1, z1>` and `<x2, y2, z2>`, the output would be `<x1*x2, y1*y2, z1*z2>`. Not true vector multiplication, but helpful.
     * 
     * @returns this vector instance
     */
    imul(factor: VectorLike): this {
        let [ x, y, z ] = Vec3.args(factor);
        this.x *= x; this.y *= y; this.z *= z;
        return this;
    }
    /**
     * Divides this vector by another one.
     * 
     * It is important to note that there is no such thing as vector3d division. The "divide" referenced here is a simple dimension division. Essentially, given vector `<x1, y1, z1>` and `<x2, y2, z3>`, the output would be `<x1/x2, y1/y2, z1/z2>`.
     * 
     * @returns this vector instance
     */
    idiv(divisor: VectorLike): this {
        let [ x, y, z ] = Vec3.args(divisor);
        this.x /= x; this.y /= y; this.z /= z;
        return this;
    }
    /**
     * Raises this vector to the power another one.
     * 
     * It is important to note that there is no such thing as vector3d power raising. The "power" referenced here is a simple dimension power raising. Essentially, given vector `<x1, y1, z1>` and `<x2, y2, z2>`, the output would be `<x1^x2, y1^y2, z1^z2>`.
     * 
     * @returns this vector instance
     */
    ipow(exponent: VectorLike): this {
        let [ x, y, z ] = Vec3.args(exponent);
        this.x **= x; this.y **= y; this.z **= z;
        return this;
    }

    /**
     * Maps each dimension of this vector through a callback function.
     * @returns this vector instance
     */
    imap(callback: (value: number) => number): this {
        this.x = callback(this.x);
        this.y = callback(this.y);
        this.z = callback(this.z);
        return this;
    }
    /** Utilizes {@link imap} with {@link Math.abs} */
    iabs(): this { return this.imap(Math.abs); }
    /** Utilizes {@link imap} with {@link Math.floor} */
    ifloor(): this { return this.imap(Math.floor); }
    /** Utilizes {@link imap} with {@link Math.ceil} */
    iceil(): this { return this.imap(Math.ceil); }
    /** Utilizes {@link imap} with {@link Math.round} */
    iround(): this { return this.imap(Math.round); }

    /**
     * Normalizes this vector so that the magnitude is 1. This does not apply to zero vectors.
     * @returns this vector instance
     */
    inormalize(): this { return (this.dist(0) > 0) ? this.idiv(this.dist(0)) : this; }

    /** Calculates the squared distance between this vector and another. */
    distSquared(dest: VectorLike): number {
        let [ x, y, z ] = Vec3.args(dest);
        return (this.x-x)**2 + (this.y-y)**2 + (this.z-z)**2;
    }

    /** Calculates the distance between this vector and another. */
    dist(dest: VectorLike): number { return Math.sqrt(this.distSquared(dest)); }

    /** Checks whether this vector is equal to another. */
    equals(comparand: VectorLike): boolean {
        let [ x, y, z ] = Vec3.args(comparand);
        return (this.x === x) && (this.y === y) && (this.z === z);
    }

    toString() { return "<"+this.xyz.join(", ")+">" }

    toJSON() {
        return Reviver.revivable(Vec3, {
            x: this.x,
            y: this.y,
            z: this.z,
        });
    }
}

/** A Vector4d class */
export class Vec4 extends Target {
    static { REVIVER.rules.add(this); }

    private _w: number;
    private _x: number;
    private _y: number;
    private _z: number;

    constructor(source?: VectorLike) {
        super();

        this._w = this._x = this._y = this._z = 0;

        this.set(source);
    }

    /**
     * Generates the correct properties given the constructor arguments.
     * 
     * Essentially bypassess the need for calling the constructor to get a properly *formatted* "Vec4" object. This saves some overhead performance during operations when many vector4d objects might need to be instantiated.
     */
    static args(source?: VectorLike): vec4 {
        if (source instanceof Vec1) return this.args([source.x, 0]);
        if (source instanceof Vec2) return this.args(source.xy);
        if (source instanceof Vec3) return this.args(source.xyz);
        if (source instanceof Vec4) return this.args([source.w, source.x, source.y, source.z]);
        if (Array.isArray(source)) {
            if (source.length === 1) return this.args([source[0], source[0], source[0], source[0]]);
            if (source.length === 2) return this.args([...source, 0]);
            if (source.length === 3) return this.args([0, ...source]);
            return source.slice(0, 4) as vec4;
        }
        if (typeof(source) === "object" && source) return [castNumber(source.w), castNumber(source.x), castNumber(source.y), castNumber(source.z)];
        if (typeof(source) !== "number") return this.args(0);
        return this.args([source]);
    }
    /** Sets this object to whatever arguments are provided. */
    set(source?: VectorLike): this {
        [this.w, this.x, this.y, this.z] = Vec4.args(source);
        return this;
    }
    /** Clones this object into a new one. */
    clone() { return new Vec4(this); }

    get w() { return this._w; }
    set w(value) {
        if (this.w === value) return;
        this.change("w", this.w, this._w=value);
    }
    get x() { return this._x; }
    set x(value) {
        if (this.x === value) return;
        this.change("x", this.x, this._x=value);
    }
    get y() { return this._y; }
    set y(value) {
        if (this.y === value) return;
        this.change("y", this.y, this._y=value);
    }
    get z() { return this._z; }
    set z(value) {
        if (this.z === value) return;
        this.change("z", this.z, this._z=value);
    }
    get wxyz(): vec4 { return [this.w, this.x, this.y, this.z]; }
    set wxyz(value: vec4) { [this.w, this.x, this.y, this.z] = value; }

    get t() { return this.w; }
    set t(v) { this.w = v; }
    get b() { return this.x; }
    set b(v) { this.x = v; }
    get l() { return this.y; }
    set l(v) { this.y = v; }
    get r() { return this.z; }
    set r(v) { this.z = v; }
    get tblr(): vec4 { return [this.t, this.b, this.l, this.r]; }
    set tblr(value: vec4) { [this.t, this.b, this.l, this.r] = value; }

    /**
     * Adds another vector to this one.
     * @returns a new instance of Vec4
     */
    add(addend: VectorLike): Vec4 {
        let [ w, x, y, z ] = Vec4.args(addend);
        return new Vec4([this.w+w, this.x+x, this.y+y, this.z+z]);
    }
    /**
     * Subtracts another vector from this one.
     * @returns a new instance of Vec4
     */
    sub(subtrahend: VectorLike): Vec4 {
        let [ w, x, y, z ] = Vec4.args(subtrahend);
        return new Vec4([this.w-w, this.x-x, this.y-y, this.z-z]);
    }
    /**
     * Multiplies this vector by another one.
     * 
     * It is important to note that there is no such thing as vector4d division. The "multiply" referenced here is a simple dimension multiplication. Essentially, given vector `<w1, x1, y1, z1>` and `<w2, x2, y2, z2>`, the output would be `<w1*w2, x1*x2, y1*y2, z1*z2>`.
     * 
     * @returns a new instance of Vec4
     */
    mul(factor: VectorLike): Vec4 {
        let [ w, x, y, z ] = Vec4.args(factor);
        return new Vec4([this.w*w, this.x*x, this.y*y, this.z*z]);
    }
    /**
     * Divides this vector by another one.
     * 
     * It is important to note that there is no such thing as vector4d division. The "divide" referenced here is a simple dimension division. Essentially, given vector `<w1, x1, y1, z1>` and `<w2, x2, y2, z2>`, the output would be `<w1/w2, x1/x2, y1/y2, z1/z2>`.
     * 
     * @returns a new instance of Vec4
     */
    div(divisor: VectorLike): Vec4 {
        let [ w, x, y, z ] = Vec4.args(divisor);
        return new Vec4([this.w/w, this.x/x, this.y/y, this.z/z]);
    }
    /**
     * Raises this vector to the power another one.
     * 
     * It is important to note that there is no such thing as vector4d power raising. The "power" referenced here is a simple dimension power raising. Essentially, given vector `<w1, x1, y1, z1>` and `<w2, x2, y2, z2>`, the output would be `<w1^w2, x1^x2, y1^y2, z1^z2>`.
     * 
     * @returns a new instance of Vec4
     */
    pow(exponent: VectorLike): Vec4 {
        let [ w, x, y, z ] = Vec4.args(exponent);
        return new Vec4([this.w**w, this.x**x, this.y**y, this.z**z]);
    }

    /**
     * Maps each dimension of this vector through a callback function.
     * @returns a new instance of Vec4
     */
    map(callback: (value: number) => number): Vec4 {
        return new Vec4([callback(this.w), callback(this.x), callback(this.y), callback(this.z)]);
    }
    /** Utilizes {@link map} with {@link Math.abs} */
    abs(): Vec4 { return this.map(Math.abs); }
    /** Utilizes {@link map} with {@link Math.floor} */
    floor(): Vec4 { return this.map(Math.floor); }
    /** Utilizes {@link map} with {@link Math.ceil} */
    ceil(): Vec4 { return this.map(Math.ceil); }
    /** Utilizes {@link map} with {@link Math.round} */
    round(): Vec4 { return this.map(Math.round); }

    /**
     * Normalizes this vector so that the magnitude is 1. This does not apply to zero vectors.
     * @returns a new instance of Vec4
     */
    normalize(): Vec4 { return (this.dist(0) > 0) ? this.div(this.dist(0)) : new Vec4(this); }

    /**
     * Adds another vector to this one.
     * @returns this vector instance
     */
    iadd(addend: VectorLike): this { return this.set(this.add(addend)); }
    /**
     * Subtracts another vector from this one.
     * @returns this vector instance
     */
    isub(subtrahend: VectorLike): this { return this.set(this.sub(subtrahend)); }
    /**
     * Multiplies this vector by another one.
     * 
     * It is important to note that there is no such thing as vector4d division. The "multiply" referenced here is a simple dimension multiplication. Essentially, given vector `<w1, x1, y1, z1>` and `<w2, x2, y2, z2>`, the output would be `<w1*w2, x1*x2, y1*y2, z1*z2>`.
     * 
     * @returns this vector instance
     */
    imul(factor: VectorLike): this { return this.set(this.mul(factor)); }
    /**
     * Divides this vector by another one.
     * 
     * It is important to note that there is no such thing as vector4d division. The "divide" referenced here is a simple dimension division. Essentially, given vector `<w1, x1, y1, z1>` and `<w2, x2, y2, z2>`, the output would be `<w1/w2, x1/x2, y1/y2, z1/z2>`.
     * 
     * @returns this vector instance
     */
    idiv(divisor: VectorLike): this { return this.set(this.div(divisor)); }
    /**
     * Raises this vector to the power another one.
     * 
     * It is important to note that there is no such thing as vector4d power raising. The "power" referenced here is a simple dimension power raising. Essentially, given vector `<w1, x1, y1, z1>` and `<w2, x2, y2, z2>`, the output would be `<w1^w2, x1^x2, y1^y2, z1^z2>`.
     * 
     * @returns this vector instance
     */
    ipow(exponent: VectorLike): this { return this.set(this.pow(exponent)); }

    /**
     * Maps each dimension of this vector through a callback function.
     * @returns this vector instance
     */
    imap(callback: (value: number) => number): this { return this.set(this.map(callback)); }
    /** Utilizes {@link imap} with {@link Math.abs} */
    iabs(): this { return this.set(this.abs()); }
    /** Utilizes {@link imap} with {@link Math.floor} */
    ifloor(): this { return this.set(this.floor()); }
    /** Utilizes {@link imap} with {@link Math.ceil} */
    iceil(): this { return this.set(this.ceil()); }
    /** Utilizes {@link imap} with {@link Math.round} */
    iround(): this { return this.set(this.round()); }

    /**
     * Normalizes this vector so that the magnitude is 1. This does not apply to zero vectors.
     * @returns this vector instance
     */
    inormalize(): this { return this.set(this.normalize()); }

    /** Calculates the squared distance between this vector and another. */
    distSquared(dest: VectorLike): number {
        let [ w, x, y, z ] = Vec4.args(dest);
        return (this.w-w)**2 + (this.x-x)**2 + (this.y-y)**2 + (this.z-z)**2;
    }

    /** Calculates the distance between this vector and another. */
    dist(dest: VectorLike): number { return Math.sqrt(this.distSquared(dest)); }
    
    /** Checks whether this vector is equal to another. */
    equals(comparand: VectorLike): boolean {
        let [ w, x, y, z ] = Vec4.args(comparand);
        return (this.w === w) && (this.x === x) && (this.y === y) && (this.z === z);
    }

    toString() { return "<"+this.wxyz.join(", ")+">" }

    toJSON() {
        return Reviver.revivable(Vec4, {
            w: this.w,
            x: this.x,
            y: this.y,
            z: this.z,
        });
    }
}


/** A promisified state storage unit that allows for "waiting" until some condition is met */
export class Resolver<T> extends Target {
    private _state: T;

    private resolves: {
        resolveCondition: (value: T) => boolean,
        resolve: Function,
    }[];

    constructor(state: T) {
        super();

        this._state = state;

        this.resolves = [];
    }

    get state() { return this._state; }
    set state(value: T) {
        if (this.state == value) return;
        this.change("state", this.state, this._state=value);
        let filteredResolves = this.resolves.filter(o => o.resolveCondition(this.state));
        for (let resolve of filteredResolves) {
            this.resolves.splice(this.resolves.indexOf(resolve), 1);
            
            let stateChanged = false;
            const stateChange = () => (stateChanged = true);
            this.addHandler("change-state", stateChange);
            
            resolve.resolve();

            this.remHandler("change-state", stateChange);
            if (stateChanged) break;
        }
    }

    /** Returns a Promise that resolves when a certain condition is met */
    async whenCondition(condition: (value: T) => boolean): Promise<void> {
        if (condition(this.state)) return;
        return await new Promise((resolve, reject) => this.resolves.push({
            resolveCondition: condition,
            resolve: resolve,
        }));
    }
    /** Returns a Promise that resolves when the state is equal to the argument */
    async when(value: T): Promise<void> { return await this.whenCondition(state => (state === value)); }
    /** Returns a Promise that resolves when the state is not equal to the argument */
    async whenNot(value: T): Promise<void> { return await this.whenCondition(state => (state !== value)); }
}

export type PlaybackArguments = {
    ts?: number,
    tsMin?: number,
    tsMax?: number,
    paused?: boolean,
} | Playback | null;

/** A playback time management class */
export class Playback extends Target {
    private _ts: number;
    private _tsMin: number;
    private _tsMax: number;

    private _paused: boolean;

    private restartTimer: number;

    private _signal: {
        ts: number,
        tsMin: number,
        tsMax: number,
    } | null;

    constructor(args: PlaybackArguments = null) {
        super();

        this._ts = this._tsMin = this._tsMax = 0;
        this._paused = false;

        this.restartTimer = 0;

        this._signal = null;

        this.addHandler("update", (delta: number) => {
            if (this.paused) return;
            this.ts += delta;
            if (this.ts < this.tsMax) return this.restartTimer = 0;
            if (this.restartTimer >= 10) return;
            this.restartTimer++;
        });

        if (args == null) args = {};

        this.ts = args.ts || 0;
        this.tsMin = args.tsMin || 0;
        this.tsMax = args.tsMax || 0;
        this.paused = !!args.paused;
    }

    get ts() { return this.signal ? this.signal.ts : this._ts; }
    set ts(value: number) {
        if (this.signal) {
            this.signal.ts = value;
            return;
        }
        value = Math.min(this.tsMax, Math.max(this.tsMin, value));
        if (this.ts == value) return;
        this.change("ts", this.ts, this._ts=value);
    }
    get tsMin() { return this.signal ? this.signal.tsMin : this._tsMin; }
    set tsMin(value: number) {
        if (this.signal) {
            this.signal.tsMin = value;
            return;
        }
        if (this.tsMin == value) return;
        this.change("tsMin", this.tsMin, this._tsMin=value);
        if (this.tsMin > this.tsMax) [this.tsMin, this.tsMax] = [this.tsMax, this.tsMin];
        this.ts = this.ts;
    }
    get tsMax() { return this.signal ? this.signal.tsMax : this._tsMax; }
    set tsMax(value: number) {
        if (this.signal) {
            this.signal.tsMax = value;
            return;
        }
        if (this.tsMax == value) return;
        this.change("tsMax", this.tsMax, this._tsMax=value);
        if (this.tsMin > this.tsMax) [this.tsMin, this.tsMax] = [this.tsMax, this.tsMin];
        this.ts = this.ts;
    }
    get progress() { return (this.ts-this.tsMin) / (this.tsMax-this.tsMin); }
    set progress(value: number) {
        value = Math.min(1, Math.max(0, value));
        this.ts = lerp(this.tsMin, this.tsMax, value);
    }

    get paused() { return this._paused; }
    set paused(value) {
        if (this.paused == value) return;
        this.change("paused", this.paused, this._paused=value);
    }
    get playing() { return !this.paused; }
    set playing(value) { this.paused = !value; }
    pause() { return this.paused = true; }
    play() { return this.playing = true; }
    get finished() { return this.restartTimer >= 10; }

    get signal() { return this._signal; }
    set signal(value) {
        if (this.signal == value) return;
        this.change("signal", this.signal, this._signal=value);
    }

    update(delta: number) { this.post("update", delta); }
}

/** A simple timer class */
export class Timer extends Target {
    private timeSum: number;
    private timeStarted: number;
    private _paused: boolean;

    constructor(autoStart=false) {
        super();

        this.timeSum = 0;
        this.timeStarted = 0;
        this._paused = true;

        if (autoStart) this.play();
    }

    get paused() { return this._paused; }
    set paused(value: boolean) {
        if (this.paused == value) return;
        if (value)
            this.timeSum += getTime() - this.timeStarted;
        else this.timeStarted = getTime();
        this.change("paused", this.paused, this._paused=value);
    }
    get playing() { return !this.paused; }
    set playing(value) { this.paused = !value; }
    pause() { return this.paused = true; }
    play() { return this.playing = true; }

    /**
     * Clears the timer, zeroing everything.
     * @returns the time on the timer, before clearing
     */
    clear(): number {
        let time = this.time;
        this.timeSum = 0;
        this.timeStarted = getTime();
        return time;
    }
    /** Adds milliseconds to the time. */
    add(value: number): this {
        this.timeSum += value;
        return this;
    }
    /** Subtracts milliseconds from the time. */
    sub(value: number): this {
        this.timeSum -= value;
        return this;
    }
    get time() { return this.timeSum + (+this.playing)*(getTime()-this.timeStarted); }
    set time(value: number) {
        value = Math.max(0, value);
        this.timeSum += value-this.time;
    }

    /** @returns the time on the timer, before clearing. */
    pauseAndClear(): number { this.pause(); return this.clear(); }
    /** @returns the time on the timer, before clearing. */
    playAndClear(): number { this.play(); return this.clear(); }

    /** Decrements the timer by the period time and return true if more than periodTime milliseconds has passed. Otherwise, do nothing and return false. */
    dequeue(periodTime: number): boolean {
        periodTime = Math.max(0, periodTime);
        if (periodTime > this.time) return false;
        this.time -= periodTime;
        return true;
    }
    /** Continuously decrement the timer by the period time while possible and return the number of times it was decremented. */
    dequeueAll(periodTime: number): number {
        periodTime = Math.max(0, periodTime);
        let n = Math.floor(this.time/periodTime);
        if (n > 0) this.time -= n*periodTime;
        return n;
    }
}
