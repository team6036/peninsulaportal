import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

export default class App extends core.App {
    constructor() {
        super();

        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("start-complete", data => {   
            this.addBackButton();
        });
    }
}
