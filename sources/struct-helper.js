import * as util from "../util.mjs";


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
    static BITFIELDTYPES = {
        "bool": 1,
        "int8": 8, "int16": 16, "int32": 32, "int64": 64,
        "uint8": 8, "uint16": 16, "uint32": 32, "uint64": 64,
    };

    constructor() {
        super();

        this.#patterns = {};
    }

    get patterns() { return Object.keys(this.#patterns); }
    set patterns(v) {
        v = util.ensure(v, "obj");
        this.clearPatterns();
        for (let k in v) this.addPattern(k, v[k]);
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
    addPattern(name, pattern) {
        name = String(name);
        if (!(pattern instanceof StructHelper.Pattern)) return false;
        if (this.hasPattern(name) || this.hasPattern(pattern)) return false;
        if (pattern.helper != this) return false;
        this.#patterns[name] = pattern;
        return pattern;
    }
    remPattern(name) {
        name = String(name);
        if (!this.hasPattern()) return false;
        let pattern = this.getPattern(name);
        delete this.#patterns[name];
        return pattern;
    }
}
StructHelper.Pattern = class StructHelperPattern extends util.Target {
    #helper;

    #pattern;

    #fields;

    constructor(helper, pattern) {
        super();

        if (!(helper instanceof StructHelper)) throw "Helper is not of class StructHelper";
        this.#helper = helper;

        this.#pattern = "";

        this.#fields = [];

        this.pattern = pattern;
    }

    get helper() { return this.#helper; }
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

    build() {
        this.clearFields();
        let lines = this.pattern.split(";").map(line => line.trim());
        lines.forEach((line, linei) => {
            let oline = line;
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
                    // key value
                });
            }
            let odeclaration = line.split(" ").filter(kw => kw.length > 0).join(" ");
            let declaration = line.split(" ").filter(kw => kw.length > 0);
            let type = keywords.shift(), name = keywords.shift();
            if (declaration.length > 0) throw `Line ${linei}, '${oline}' has an invalid declaration '${odeclaration}'`;
            if (!StructHelper.TYPES.includes(type) && !StructHelper.hasPattern(type)) throw `Line ${linei}, '${oline}' has an invalid type declaration '${type}'`;
            if (name.includes(":")) {
                if (!(type in StructHelper.BITFIELDTYPES)) throw `Line ${linei}, '${oline}' is not a valid bitfield type '${type}'`;
                let split = name.split(":"), length;
                if (split.length != 2) throw `Line ${linei}, '${oline}' has an invalid bitfield declaration '${name}'`;
                [name, length] = split;
                length = parseInt(length);
                if (!util.is(length, "int") || length < 1) throw `Line ${linei}, '${oline}' has an invalid bitfield length '${length}'`;
                if (length > StructHelper.BITFIELDTYPES[type]) throw `Line ${linei}, '${oline}' has an oversized bitfield length '${length}' which should be less than '${StructHelper.BITFIELDTYPES[type]}' for type '${type}'`;
            } else if (name.includes("[") && name.includes("]")) {
                let split, oname = name;;
                split = name.split("[");
                if (split.length != 2) throw `Line ${linei}, '${oline}' has an invalid array declaration '${oname}' ('[' check)`;
                name = split[0];
                split = split[1].split("]");
                if (split.length != 2) throw `Line ${linei}, '${oline}' has an invalid array declaration '${oname}' (']' check)`;
                let length = split[0];
                split = split[1];
                if (split.length > 0) throw `Line ${linei}, '${oline}' has an invalid array declaration '${oname}' (trailing check)`;
                length = parseInt(length);
                if (!util.is(length, "int") || length < 1) throw `Line ${linei}, '${oline}' has an invalid array length '${length}'`;
            }
        });
    }
};
StructHelper.Pattern.Field = class StructHelperPatternField extends util.Target {
    #pattern;

    #type;
    #length;
    #bfLength;
    #enumData;

    constructor(pattern, type, length, bfLength) {
        super();

        if (!(pattern instanceof StructHelper.Pattern)) throw "Pattern is not of class StructHelper.Pattern";
        this.#pattern = pattern;

        if (!(type in StructHelper.TYPES) && !(this.pattern.helper.hasPattern(type))) throw `Type ${type} is not a valid type`;
        this.#type = String(type);

        this.#length = Math.max(0, util.ensure(length, "int"));
        this.#bfLength = Math.min((this.isBFable ? StructHelper.BITFIELDTYPES[this.type] : 0), Math.max(0, util.ensure(bfLength, "int")));
    }

    get pattern() { return this.#pattern; }

    get type() { return this.#type; }
    get isStruct() { return !(this.type in StructHelper.TYPES); }
    get isBFable() { return this.type in StructHelper.BITFIELDTYPES; }
    get length() { return this.#length; }
    get isArray() { return this.length > 0; }
    get bfLength() { return this.#bfLength; }

    get enumData() { return Object.keys(this.#enumData); }
    set enumData(v) {
        v = util.ensure(v, "obj");
    }
};
