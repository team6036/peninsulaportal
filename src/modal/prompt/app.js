import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import AppModal from "../app.js";


export default class App extends AppModal {
    #itype;

    #ieInput;
    #ieConfirm;
    #ieCancel;

    constructor() {
        super();

        this.addHandler("pre-post-setup", async () => {
            this.ielem.classList.add("prompt");

            this.#itype = "str";

            this.#ieInput = document.createElement("input");
            this.iinner.appendChild(this.ieInput);
            this.ieInput.autocomplete = "off";
            this.ieInput.spellcheck = false;
            this.#ieConfirm = document.createElement("button");
            this.iinner.appendChild(this.ieConfirm); 
            this.ieConfirm.classList.add("special");
            this.#ieCancel = document.createElement("button");
            this.iinner.appendChild(this.ieCancel);
            this.ieCancel.classList.add("heavy");

            this.ieInput.addEventListener("change", async e => {
                await this.doModify({
                    props: {
                        value: this.ieInput.value,
                    },
                });
            });
            this.ieInput.addEventListener("keydown", async e => {
                if (e.code != "Enter" && e.code != "Return") return;
                e.preventDefault();
                await this.doModify({
                    props: {
                        value: this.ieInput.value,
                    },
                });
                await this.doModify({
                    cmds: ["confirm"],
                });
            });
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

            this.ivalue = "";
            this.iicon = "pencil";
            this.iconfirm = "OK";
            this.icancel = "Cancel";
            this.iplaceholder = "...";
        });
        this.addHandler("post-setup", async () => {
            this.ieInput.focus();
        });
    }

    get itype() { return this.#itype; }
    set itype(v) {
        v = (v == null) ? null : String(v);
        if (this.itype == v) return;
        this.#itype = v;
        this.ieInput.type = ["any_num", "num", "float", "int"].includes(this.itype) ? "number" : "text";
        if (["int"].includes(this.itype)) this.ieInput.step = 1;
        else this.ieInput.removeAttribute("step");
    }
    customType() { return this.itype == null; }

    get ieInput() { return this.#ieInput; }
    get ieCancel() { return this.#ieCancel; }
    get ieConfirm() { return this.#ieConfirm; }

    get iconfirm() { return this.ieConfirm.textContent; }
    set iconfirm(v) { this.ieConfirm.textContent = v; }
    get icancel() { return this.eCancel.textContent; }
    set icancel(v) { this.ieCancel.textContent = v; }

    get ivalue() { return this.ieInput.value; }
    set ivalue(v) {
        v = String(v);
        if (this.ivalue == v) return;
        this.ieInput.value = v;
    }

    get iplaceholder() { return this.ieInput.placeholder; }
    set iplaceholder(v) { this.ieInput.placeholder = v; }
}
