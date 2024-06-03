import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";


import PanelTab from "./tab.js";


export default class PanelToolTab extends PanelTab {
    static NAME = "Tool";
    static NICKNAME = "Tool";
    static ICON = "build";
    static ICONSRC = null;
    static ICONCOLOR = "var(--cp)";

    constructor(a) {
        super();

        this.elem.classList.add("tool");
    }
}
