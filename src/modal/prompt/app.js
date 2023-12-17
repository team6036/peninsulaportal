import * as util from "../../util.mjs";
import { V } from "../../util.mjs";

import * as core from "../../core.mjs";


export default class App extends core.AppModal {
    #ieInput;
    #ieConfirm;
    #ieCancel;

    constructor() {
        super();

        this.addHandler("post-setup", async () => {
            this.ielem.classList.add("prompt");

            this.#ieInput = document.createElement("input");
            this.iinner.appendChild(this.ieInput);
            this.ieInput.autocomplete = "off";
            this.ieInput.spellcheck = false;
            this.#ieConfirm = document.createElement("button");
            this.iinner.appendChild(this.ieConfirm); 
            this.ieConfirm.classList.add("special");
            this.#ieCancel = document.createElement("button");
            this.iinner.appendChild(this.ieCancel);

            this.ieConfirm.addEventListener("click", e => this.result(this.ivalue));
            this.ieCancel.addEventListener("click", e => this.result(null));
        });
    }

    get ieInput() { return this.#ieInput; }
    get ieCancel() { return this.#ieCancel; }
    get ieConfirm() { return this.#ieConfirm; }

    get iconfirm() { return this.ieConfirm.textContent; }
    set iconfirm(v) { this.ieConfirm.textContent = v; }
    get icancel() { return this.eCancel.textContent; }
    set icancel(v) { this.ieCancel.textContent = v; }

    get ivalue() { return this.ieInput.value; }
    set ivalue(v) { this.ieInput.value = v; }

    get iplaceholder() { return this.ieInput.placeholder; }
    set iplaceholder(v) { this.ieInput.placeholder = v; }
}
