import * as util from "../util.js";
import { V } from "../util.js";

import * as core from "../core.js";


export default class App extends core.App {
    constructor() {
        super();

        let info = document.body.querySelector("#mount > .info");

        window.api.on((_, cmd, args) => {
            cmd = String(cmd).replace("-", "_");
            args = util.ensure(args, "arr");
            let cmdfs = {
                info_set: data => {
                    data = util.ensure(data, "arr");
                    if (!(info instanceof HTMLDivElement)) return;
                    info.innerHTML = "";
                    data.forEach(line => {
                        let eLine = document.createElement("div");
                        info.appendChild(eLine);
                        eLine.textContent = line;
                    });
                },
            };
            if (cmd in cmdfs) cmdfs[cmd](...args);
        });
    }
}