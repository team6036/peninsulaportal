import * as util from "../util.js";
import { V } from "../util.js";

import * as core from "../core.js";


export default class App extends core.App {
    constructor() {
        super();

        let info = document.body.querySelector("#mount > .info");

        this.addHandler("cmd-info-set", args => {
            let data = util.ensure(util.ensure(args, "arr")[0], "arr");
            if (!(info instanceof HTMLDivElement)) return;
            info.innerHTML = "";
            data.forEach(line => {
                let eLine = document.createElement("div");
                info.appendChild(eLine);
                eLine.textContent = line;
            });
        });
    }
}