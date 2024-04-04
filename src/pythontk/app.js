import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";


export default class App extends core.App {
    #eInfo;
    #eLoads;

    constructor() {
        super();

        this.addHandler("pre-setup", () => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("post-setup", async () => {
        });
    }

    get eInfo() { return this.#eInfo; }
    hasEInfo() { return this.eInfo instanceof HTMLDivElement; }
    get eLoads() { return this.#eLoads; }
    hasELoads() { return this.eLoads instanceof HTMLDivElement; }
}
