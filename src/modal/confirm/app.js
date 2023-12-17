import * as util from "../../util.mjs";
import { V } from "../../util.mjs";

import * as core from "../../core.mjs";


export default class App extends core.AppModal {
    #ieConfirm;
    #ieCancel;

    constructor() {
        super();

        this.addHandler("pre-post-setup", async () => {
            this.ielem.classList.add("confirm");

            this.#ieConfirm = document.createElement("button");
            this.iinner.appendChild(this.ieConfirm);
            this.ieConfirm.classList.add("special");
            this.#ieCancel = document.createElement("button");
            this.iinner.appendChild(this.ieCancel);

            this.ieConfirm.addEventListener("click", e => this.result(true));
            this.ieCancel.addEventListener("click", e => this.result(false));

            this.iicon = "help-circle";
            this.iconfirm = "OK";
            this.icancel = "Cancel";
        });
    }

    get ieCancel() { return this.#ieCancel; }
    get ieConfirm() { return this.#ieConfirm; }

    get iconfirm() { return this.ieConfirm.textContent; }
    set iconfirm(v) { this.ieConfirm.textContent = v; }
    get icancel() { return this.ieCancel.textContent; }
    set icancel(v) { this.ieCancel.textContent = v; }
}
