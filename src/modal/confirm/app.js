import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import AppModal from "../app.js";


export default class App extends AppModal {
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
            this.ieCancel.classList.add("heavy");

            this.ieConfirm.addEventListener("click", async e => {
                e.stopPropagation();
                await this.doModify({
                    cmds: ["confirm"],
                });
            });
            this.ieCancel.addEventListener("click", async e => {
                e.stopPropagation();
                await this.doModify({
                    cmds: ["cancel"],
                });
            });

            this.iicon = "help-circle";
            this.iconfirm = "OK";
            this.icancel = "Cancel";
        });
        this.addHandler("post-setup", async () => {
            this.ieConfirm.focus();
        });
    }

    get ieCancel() { return this.#ieCancel; }
    get ieConfirm() { return this.#ieConfirm; }

    get iconfirm() { return this.ieConfirm.textContent; }
    set iconfirm(v) { this.ieConfirm.textContent = v; }
    get icancel() { return this.ieCancel.textContent; }
    set icancel(v) { this.ieCancel.textContent = v; }
}
