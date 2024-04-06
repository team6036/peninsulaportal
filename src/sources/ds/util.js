import * as util from "../../util.mjs";
import * as lib from "../../lib.mjs";


export function convertTime(s, part) {
    s = util.ensure(s, "num");
    part = util.ensure(part, "num");
    return -2082826800 + s + part/(2**64);
}
  
export function getPowerDistro(id) {
    if (id == 33) return "REV";
    if (id == 25) return "CTRE";
    return null;
}
