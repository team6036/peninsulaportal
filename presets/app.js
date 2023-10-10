import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

export default class App extends core.App {
    #eLoads;

    constructor() {
        super();

        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("start-complete", async data => {   
            this.addBackButton();

            (async () => {
                let resp = await fetch("./display.md");
                let text = await resp.text();
                document.querySelector("#PAGE > .content").appendChild(await this.createMarkdown(text));
                Array.from(document.querySelectorAll("#PAGE > .content > article button.cmd")).forEach(async elem => {
                    if (elem.id == "poll-db-host") {
                        setInterval(async () => {
                            let isLoading = await window.api.get("loading");
                            elem.disabled = isLoading;
                        }, 250);
                    }
                    elem.addEventListener("click", async e => {
                        let disabled;
                        if (elem.id != "poll-db-host") {
                            disabled = elem.disabled;
                            elem.disabled = true;
                        }
                        await window.api.send("cmd-"+elem.id, []);
                        if (elem.id != "poll-db-host") {
                            elem.disabled = disabled;
                        }
                    });
                });
                Array.from(document.querySelectorAll("#PAGE > .content > article input.val")).forEach(async elem => {
                    let type = {
                        "db-host": "str",
                        "comp-mode": "bool",
                    }[elem.id];
                    elem.disabled = true;
                    if (type == "bool") elem.checked = await window.api.get("val-"+elem.id);
                    else elem.value = await window.api.get("val-"+elem.id);
                    elem.disabled = false;
                    let typefs = {
                        any_num: async () => await typefs.num(),
                        num: async () => {
                            elem.type = "number";
                        },
                        float: async () => await typefs.num(),
                        int: async () => {
                            await typefs.num();
                            elem.step = 1;
                        },
                        bool: async () => {
                            elem.type = "checkbox";
                        },
                        str: async () => {
                            elem.type = "text";
                        },
                    };
                    if (type in typefs) await typefs[type]();
                    let idfs = {
                    };
                    if (elem.id in idfs) await idfs[elem.id]();
                    elem.addEventListener("change", async e => {
                        let v = (type == "bool") ? elem.checked : elem.value;
                        if (type == "bool" || v.length > 0) {
                            v = util.ensure(v, type);
                            let idfs = {
                            };
                            if (elem.id in idfs) v = await idfs[elem.id](v);
                            elem.disabled = true;
                            await window.api.set("val-"+elem.id, v);
                            if (type == "bool") elem.checked = await window.api.get("val-"+elem.id);
                            else elem.value = await window.api.get("val-"+elem.id);
                            elem.disabled = false;
                        }
                    });
                    setInterval(async () => {
                        if (document.activeElement == elem) return;
                        if (type == "bool") return;
                        elem.value = await window.api.get("val-"+elem.id);
                    }, 250);
                });
            })();

            this.#eLoads = document.querySelector("#PAGE > .content > .loads");

            let prevLoads = [];
            let lock = false;
            this.addHandler("update", async data => {
                if (lock) return;
                lock = true;
                let loads = await window.api.get("loads");
                if (prevLoads.length == loads.length) {
                    let all = true;
                    for (let i = 0; i < loads.length; i++) {
                        if (loads[i] == prevLoads[i]) continue;
                        all = false;
                        break;
                    }
                    if (all) return lock = false;
                }
                prevLoads = loads;
                if (this.hasELoads()) {
                    this.eLoads.innerHTML = "";
                    loads.forEach(load => this.eLoads.appendChild(core.App.evaluateLoad(load)));
                }
                lock = false;
            });
        });
    }

    get eLoads() { return this.#eLoads; }
    hasELoads() { return this.eLoads instanceof HTMLDivElement; }
}
