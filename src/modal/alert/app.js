import * as util from "../../util.mjs";
import { V } from "../../util.mjs";

import * as core from "../../core.mjs";


export default class App extends core.AppModal {
    #ieButton;

    constructor() {
        super();

        this.addHandler("post-setup", async () => {
            this.ielem.classList.add("alert");

            this.#ieButton = document.createElement("button");
            this.iinner.appendChild(this.ieButton);
            this.ieButton.classList.add("special");

            this.ieButton.addEventListener("click", e => this.result(null));

            await this.resize();
        });
    }

    get ieButton() { return this.#ieButton; }

    get ibutton() { return this.ieButton.textContent; }
    set ibutton(v) { this.ieButton.textContent = v; }
}
