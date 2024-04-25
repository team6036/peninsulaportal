import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";

import AppModal from "../app.js";


export default class App extends AppModal {
    #ieButton;

    constructor() {
        super();

        this.addHandler("pre-post-setup", async () => {
            this.ielem.classList.add("alert");

            this.#ieButton = document.createElement("button");
            this.iinner.appendChild(this.ieButton);
            this.ieButton.classList.add("special");

            this.ieButton.addEventListener("click", async e => {
                e.stopPropagation();
                await this.doModify({
                    cmds: ["button"],
                });
            });

            this.iicon = "alert-circle";
            this.ibutton = "OK";
        });
        this.addHandler("post-setup", async () => {
            this.ieButton.focus();
        });
    }

    get ieButton() { return this.#ieButton; }

    get ibutton() { return this.ieButton.textContent; }
    set ibutton(v) { this.ieButton.textContent = v; }
}
