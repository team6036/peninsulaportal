import * as util from "../util.mjs";
import { V } from "../util.mjs";

import { toUint8Array } from "./source.js";


function Uint82BoolArray(v) {
    v = toUint8Array(v);
    let arr = [];
    v.forEach(v => {
        for (let i = 0; i < 8; i++)
            arr.push(((1 << i) & v) > 0);
    });
    return arr;
}
function Bool2Uint8Array(v) {
    v = util.ensure(v, "arr").map(v => !!v);
    let arr = new Uint8Array(Math.ceil(v.length/8));
    v.forEach((v, i) => {
        if (!v) return;
        let byte = Math.floor(i/8);
        let bit = i%8;
        arr[byte] |= 1 << bit;
    });
    return arr;
}

export default class StructHelper extends util.Target {
    #patterns;

    static TYPES = [
        "bool",
        "char",
        "int8", "int16", "int32", "int64",
        "uint8", "uint16", "uint32", "uint64",
        "float", "float32",
        "double", "float64",
    ];
    static BITFIELDTYPES = [
        "bool",
        "int8", "int16", "int32", "int64",
        "uint8", "uint16", "uint32", "uint64",
    ];
    static BITFIELDLENGTHS = {
        "bool": 1,
        "char": 8,
        "int8": 8, "int16": 16, "int32": 32, "int64": 64,
        "uint8": 8, "uint16": 16, "uint32": 32, "uint64": 64,
        "float": 32, "float32": 32,
        "double": 64, "float64": 64,
    };

    constructor() {
        super();

        this.#patterns = {};
    }

    get patterns() { return Object.keys(this.#patterns); }
    set patterns(v) {
        v = util.ensure(v, "arr");
        this.clearPatterns();
        for (let k in v) this.addPattern(v[k]);
    }
    clearPatterns() {
        let patterns = this.patterns;
        patterns.forEach(name => this.remPattern(name));
        return patterns;
    }
    hasPattern(v) {
        if (util.is(v, "str"))
            return v in this.#patterns;
        if (v instanceof StructHelper.Pattern)
            return Object.values(this.#patterns).includes(v) && v.helper == this;
        return false;
    }
    getPattern(name) {
        name = String(name);
        if (!this.hasPattern(name)) return null;
        return this.#patterns[name];
    }
    addPattern(pattern) {
        if (!(pattern instanceof StructHelper.Pattern)) return false;
        if (this.hasPattern(pattern.name) || this.hasPattern(pattern)) return false;
        if (pattern.helper != this) return false;
        this.#patterns[pattern.name] = pattern;
        pattern.addLinkedHandler(this, "change", () => this.post("change"));
        this.post("change");
        return pattern;
    }
    remPattern(name) {
        name = String(name);
        if (!this.hasPattern(name)) return false;
        let pattern = this.getPattern(name);
        delete this.#patterns[name];
        pattern.clearLinkedHandlers(this, "change");
        this.post("change");
        return pattern;
    }

    build() { this.patterns.forEach(name => this.getPattern(name).build()); }
}
StructHelper.Pattern = class StructHelperPattern extends util.Target {
    #helper;

    #name;

    #pattern;

    #fields;
    #length;

    constructor(helper, name, pattern) {
        super();

        if (!(helper instanceof StructHelper)) throw "Helper is not of class StructHelper";
        this.#helper = helper;

        this.#name = String(name);

        this.#pattern = "";

        this.#fields = [];
        this.#length = null;

        this.pattern = pattern;
    }

    get helper() { return this.#helper; }

    get name() { return this.#name; }

    get pattern() { return this.#pattern; }
    set pattern(v) { this.#pattern = String(v); }
    get fields() { return [...this.#fields]; }
    set fields(v) {
        v = util.ensure(v, "arr");
        this.clearFields();
        v.forEach(v => this.addField(v));
    }
    clearFields() {
        let fields = this.fields;
        fields.forEach(field => this.remField(field));
        return fields;
    }
    hasField(field) {
        if (!(field instanceof StructHelper.Pattern.Field)) return false;
        return this.#fields.includes(field) && field.pattern == this;
    }
    addField(field) {
        if (!(field instanceof StructHelper.Pattern.Field)) return false;
        if (this.hasField(field)) return false;
        if (field.pattern != this) return false;
        this.#fields.push(field);
        return field;
    }
    remField(field) {
        if (!(field instanceof StructHelper.Pattern.Field)) return false;
        if (!this.hasField(field)) return false;
        if (field.pattern != this) return false;
        this.#fields.splice(this.#fields.indexOf(field), 1);
        return field;
    }
    get length() { return this.#length; }

    build() {
        this.clearFields();
        let lines = this.pattern.split(";").map(line => line.trim());
        lines.forEach((line, linei) => {
            let oline = line;
            let enums = {};
            if (line.startsWith("enum")) {
                line = line.substring(4).trim();
                if (line[0] != "{") throw `Line ${linei}, '${oline}' does not have valid '{' for keyword 'enum'`;
                let i = line.indexOf("}");
                if (i < 0) throw `Line ${linei}, '${oline}' does not have valid '}' for keyword 'enum'`;
                let enumStr = line.substring(1, i).split("").filter(c => c != " ").join("");
                line = line.substring(i+1);
                enumStr.split(",").map(pair => {
                    let opair = pair;
                    pair = pair.split("=");
                    if (pair.length != 2) throw `Line ${linei}, '${oline}' does not have a valid key-value pair '${opair}' for keyword 'enum'`;
                    let key = pair[0], value = parseInt(pair[1]);
                    if (!util.is(value, "int")) throw `Line ${linei}, '${oline}' does not have a valid value pair '${value}' for keyword 'enum'`;
                    enums[value] = key;
                });
            }
            let declaration = line.split(" ").filter(kw => kw.length > 0);
            let type = declaration.shift(), name = declaration.join("");
            let length = 0, bfLength = 0;
            if (name.includes(":")) {
                if (!StructHelper.BITFIELDTYPES.includes(type)) throw `Line ${linei}, '${oline}' is not a valid bitfield type '${type}'`;
                let split = name.split(":");
                if (split.length != 2) throw `Line ${linei}, '${oline}' has an invalid bitfield declaration '${name}'`;
                [name, length] = split;
                length = parseInt(length);
                if (!util.is(length, "int") || length < 1) throw `Line ${linei}, '${oline}' has an invalid bitfield length '${length}'`;
                if (length > StructHelper.BITFIELDLENGTHS[type]) throw `Line ${linei}, '${oline}' has an oversized bitfield length '${length}' which should be less than '${StructHelper.BITFIELDLENGTHS[type]}' for type '${type}'`;
            } else if (name.includes("[") && name.includes("]")) {
                let split, oname = name;
                split = name.split("[");
                if (split.length != 2) throw `Line ${linei}, '${oline}' has an invalid array declaration '${oname}' ('[' check)`;
                name = split[0];
                split = split[1].split("]");
                if (split.length != 2) throw `Line ${linei}, '${oline}' has an invalid array declaration '${oname}' (']' check)`;
                bfLength = split[0];
                split = split[1];
                if (split.length > 0) throw `Line ${linei}, '${oline}' has an invalid array declaration '${oname}' (trailing check)`;
                bfLength = parseInt(bfLength);
                if (!util.is(bfLength, "int") || bfLength < 1) throw `Line ${linei}, '${oline}' has an invalid array length '${bfLength}'`;
            }
            let field = this.addField(new StructHelper.Pattern.Field(this, name, type, length, bfLength));
            field.enums = enums;
        });
        let failed = false, bX = 0, bfX = null, bfL = null;
        this.fields.forEach(field => {
            if (field.isBF) {
                let tL = StructHelper.BITFIELDLENGTHS[field.type];
                let l = Math.min(field.bfLength, tL);
                if (
                    (bfX == null && bfL == null) ||
                    (field.type != "bool" && bfL != tL) ||
                    bfX+l > bfL
                ) {
                    if (bfX != null && bfL != null) bX += bfL - bfX;
                    bfX = 0;
                    bfL = tL;
                }
                field.range = [bX, bX+l];
                bX += l;
            } else {
                if (bfX != null && bfL != null) bX += bfL - bfX;
                bfX = bfL = null;
                let l = field.isStruct ? (this.helper.hasPattern(field.type) ? this.helper.getPattern(field.type).length : null) : StructHelper.BITFIELDLENGTHS[field.type];
                if (l == null) {
                    failed = true;
                    l = 0;
                }
                l *= field.isArray ? field.length : 1;
                field.range = [bX, bX+l];
                bX += l;
            }
        });
        if (bfX != null && bfL != null) bX += bfL - bfX;
        this.#length = failed ? null : bX;
        this.helper.patterns.forEach(name => {
            let pattern = this.helper.getPattern(name);
            for (let field of pattern.fields) {
                if (field.type != this.name) continue;
                pattern.build();
                break;
            }
        });
        this.post("change");
    }

    decode(data) {
        data = Uint82BoolArray(data);
        let output = {};
        this.fields.forEach(field => {
            let subdata = data.slice(field.rangeMin, field.rangeMax);
            if (field.isStruct) {
                output[field.name] = Bool2Uint8Array(subdata);
            } else {
                if (field.isArray) {
                    let value = [];
                    let l = (field.rangeMax-field.rangeMin) / field.length;
                    for (let x = 0; x < subdata.length; x += l)
                        value.push(StructHelper.Pattern.decodeData(
                            Bool2Uint8Array(subdata.slice(x, x+l)),
                            field.type,
                            field.fullEnums,
                        ));
                    if (field.type == "char") value = value.join("");
                    output[field.name] = value;
                } else {
                    output[field.name] = StructHelper.Pattern.decodeData(
                        Bool2Uint8Array(subdata),
                        field.type,
                        field.fullEnums,
                    );
                }
            }
        });
        return output;
    }
    /*
    decodeArr(data) {
        data = toUint8Array(data);
        let outputs = [];
        let patternL = this.length / 8;
        let l = data.length / patternL;
        for (let i = 0; i < l; i++) {
            let suboutput = this.decode(data.slice(i*patternL, (i+1)*patternL));
            outputs.push(suboutput);
        }
        return outputs;
    }
    */
    splitData(data) {
        data = toUint8Array(data);
        let datas = [];
        let patternL = this.length / 8;
        let l = data.length / patternL;
        for (let i = 0; i < l; i++)
            datas.push(data.slice(i*patternL, (i+1)*patternL));
        return datas;
    }

    static decodeData(data, type, enums) {
        data = toUint8Array(data);
        type = String(type);
        enums = (enums == null) ? null : util.ensure(enums, "obj");
        if (!StructHelper.TYPES.includes(type)) throw "Invalid type "+type;
        let pdata = new Uint8Array(StructHelper.BITFIELDLENGTHS[type]/8);
        pdata.set(data);
        let dataView = new DataView(pdata.buffer);
        let typefs = {
            "bool": () => dataView.getUint8(0) > 0,
            "char": () => util.TEXTDECODER.decode(data),
            "int8": () => data.getInt8(0),
            "int16": () => data.getInt16(0, true),
            "int32": () => data.getInt32(0, true),
            "int64": () => Number(dataView.getBigInt64(0, true)),
            "uint8": () => dataView.getUint8(0),
            "uint16": () => dataView.getUint16(0, true),
            "uint32": () => dataView.getUint32(0, true),
            "uint64": () => Number(dataView.getBigUint64(0, true)),
            "float": () => dataView.getFloat32(0, true),
            "float32": () => typefs["float"](),
            "double": () => dataView.getFloat64(0, true),
            "float64": () => typefs["double"](),
        };
        let output = (type in typefs) ? typefs[type]() : data;
        if (util.is(enums, "obj") && (output in enums)) output = enums[output];
        return output;
    }
};
StructHelper.Pattern.Field = class StructHelperPatternField extends util.Target {
    #pattern;

    #name;

    #type;
    #length;
    #bfLength;
    #enums;

    #range;

    constructor(pattern, name, type, length, bfLength) {
        super();

        if (!(pattern instanceof StructHelper.Pattern)) throw "Pattern is not of class StructHelper.Pattern";
        this.#pattern = pattern;

        this.#name = String(name);

        this.#type = String(type);

        this.#length = Math.max(0, util.ensure(length, "int"));
        this.#bfLength = Math.min((this.isBFable ? StructHelper.BITFIELDLENGTHS[this.type] : 0), Math.max(0, util.ensure(bfLength, "int")));
        this.#enums = {};

        this.#range = new V();
    }

    get pattern() { return this.#pattern; }

    get name() { return this.#name; }

    get type() { return this.#type; }
    get isStruct() { return !StructHelper.TYPES.includes(this.type); }
    get isBFable() { return StructHelper.BITFIELDTYPES.includes(this.type); }
    get length() { return this.#length; }
    get isArray() { return this.length > 0; }
    get bfLength() { return this.#bfLength; }
    get isBF() { return this.bfLength > 0; }

    get enums() { return Object.keys(this.#enums); }
    get fullEnums() {
        let enums = {};
        this.enums.forEach(i => (enums[i] = this.getEnum(i)));
        return enums;
    }
    set enums(v) {
        v = util.ensure(v, "obj");
        this.clearEnums();
        for (let i in v) this.addEnum(parseInt(i), v[i]);
    }
    clearEnums() {
        let enums = this.enums;
        enums.forEach(i => this.remEnum(parseInt(i)));
        return enums;
    }
    hasEnum(i) {
        if (!util.is(i, "int")) return false;
        return i in this.#enums;
    }
    getEnum(i) {
        if (!util.is(i, "int")) return null;
        if (!this.hasEnum(i)) return null;
        return this.#enums[i];
    }
    addEnum(i, name) {
        if (!util.is(i, "int")) return false;
        return this.#enums[i] = name;
    }
    remEnum(i) {
        if (!util.is(i, "int")) return false;
        if (!this.hasEnum(i)) return null;
        let name = this.getEnum(i);
        delete this.#enums[i];
        return name;
    }

    get range() { return this.#range.xy; }
    set range(v) { this.#range.set(v); }
    get rangeMin() { return this.range[0]; }
    set rangeMin(v) { this.#range.x = v; }
    get rangeMax() { return this.range[1]; }
    set rangeMax(v) { this.#range.y = v; }
};
