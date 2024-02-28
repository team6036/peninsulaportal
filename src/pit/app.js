import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";


export default class App extends core.App {
    constructor() {
        super();

        this.addHandler("pre-setup", () => {
            // this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("post-setup", async () => {
            
        });
        // this.addHandler("perm", async () => {
        //     return true;
        // });
    }
}
