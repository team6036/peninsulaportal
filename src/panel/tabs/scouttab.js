import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";


import PanelToolTab from "./tooltab.js";


export default class PanelScoutTab extends PanelToolTab {
    #eWebView;

    static NAME = "Scout";
    static NICKNAME = "Scout";
    static ICON = "search-outline";
    static ICONSRC = null;
    static ICONCOLOR = "var(--cc)";

    constructor(a) {
        super(a);

        this.elem.classList.add("scout");

        this.#eWebView = document.createElement("webview");
        this.elem.appendChild(this.eWebView);
        (async () => {
            const scoutURL = await window.api.get("scout-url");
            this.eWebView.setAttribute("src", scoutURL);
        })();
    }

    get eWebView() { return this.#eWebView; }
}
