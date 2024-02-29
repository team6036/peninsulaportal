import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";


export default class App extends core.AppModal {
    #ieProgress;

    #ivalue;

    constructor() {
        super();

        this.addHandler("pre-post-setup", async () => {
            this.ielem.classList.add("progress");

            this.ieIconBox.style.display = "none";
    
            this.#ieProgress = document.createElement("div");
            this.iinner.appendChild(this.ieProgress);
            this.ieProgress.classList.add("progress");
    
            this.#ivalue = null;

            this.ivalue = 0;
        });
    }

    get ieProgress() { return this.#ieProgress; }

    get ivalue() { return this.#ivalue; }
    set ivalue(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.ivalue == v) return;
        this.#ivalue = v;
        this.ieProgress.style.setProperty("--progress", (100*this.ivalue)+"%");
    }
}
