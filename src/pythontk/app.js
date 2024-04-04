import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";


export default class App extends core.App {
    #eInstall;

    constructor() {
        super();

        this.addHandler("pre-setup", () => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("post-setup", async () => {
            this.#eInstall = document.getElementById("install");
            if (this.hasEInstall())
                this.eInstall.addEventListener("click", async e => {
                    e.stopPropagation();
                    const result = util.ensure(await App.fileOpenDialog({
                        title: "Install PTK in...",
                        buttonLabel: "Install",
                        properties: [
                            "openDirectory",
                        ],
                    }), "obj");
                    if (result.canceled) return;
                    const pths = util.ensure(result.filePaths, "arr").map(pth => String(pth));
                    if (pths.length != 1) return;
                    const pth = pths[0];
                    try {
                        await window.api.send("install", pth);
                    } catch (e) { this.doError("Installation Error", "", e); }
                });
        });
    }

    get eInstall() { return this.#eInstall; }
    hasEInstall() { return this.eInstall instanceof HTMLButtonElement; }
}
