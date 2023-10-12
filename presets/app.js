import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

export default class App extends core.App {
    #eInfo;
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
                const eColorsheet = document.getElementById("colorsheet");
                if (eColorsheet instanceof HTMLDivElement) {
                    let headers = ["v", "a", ...this.colors.map(c => "c"+c)];
                    eColorsheet.style.gridTemplateRows = "repeat("+headers.length+", 20px)";
                    eColorsheet.innerHTML = "";
                    headers.forEach((header, i) => {
                        for (let x = 0; x <= 8; x++) {
                            let elem = document.createElement("div");
                            eColorsheet.appendChild(elem);
                            elem.style.gridRow = (i+1)+" / "+(i+2);
                            elem.style.gridColumn = (x+1)+" / "+(x+2);
                            elem.style.backgroundColor = "var(--"+header+x+")";
                        }
                    });
                }
                Array.from(document.querySelectorAll("#PAGE > .content > article button.cmd")).forEach(async elem => {
                    if (elem.id == "poll-db-host") {
                        setInterval(async () => {
                            let isLoading = await window.api.get("loading");
                            elem.disabled = isLoading;
                        }, 250);
                    }
                    elem.addEventListener("click", async e => {
                        let disabled, willDo = true;
                        if (elem.id != "poll-db-host") {
                            disabled = elem.disabled;
                            elem.disabled = true;
                        }
                        if (elem.id == "cleanup-app-data-dir") {
                            willDo = await new Promise((res, rej) => {
                                let pop = this.confirm();
                                pop.eContent.innerText = "Are you sure you want to cleanup application data?\nThis might accidentally delete some files - backup the entire application directory!\n(Or trust that I wrote this code well)";
                                pop.addHandler("result", async data => res(!!util.ensure(data, "obj").v));
                            });
                        }
                        if (willDo) await window.api.send("cmd-"+elem.id, []);
                        if (elem.id != "poll-db-host") {
                            elem.disabled = disabled;
                        }
                    });
                });
                Array.from(document.querySelectorAll("#PAGE > .content > article input.val")).forEach(async elem => {
                    let type = {
                        "version": "str",
                        "db-host": "str",
                        "comp-mode": "bool",
                        "holiday": "str",
                    }[elem.id];
                    let lock = false;
                    const updateValue = async () => {
                        if (lock) return;
                        lock = true;
                        const disabled = elem.disabled;
                        elem.disabled = true;
                        if (type == "bool") {
                            let checked = !!await window.api.get("val-"+elem.id);
                            if (elem.checked == checked) {
                                elem.disabled = disabled;
                                lock = false;
                                return;
                            }
                            elem.checked = checked;
                        } else {
                            let value = String(await window.api.get("val-"+elem.id));
                            let idfs = {
                                "version": async () => {
                                    let isProduction = !!await window.api.get("production");
                                    if (!isProduction) value += "-dev";
                                },
                                "holiday": async () => {
                                    value = (value == "null") ? "" : value.split(" ").map(v => util.capitalize(v)).join(" ");
                                },
                            };
                            if (elem.id in idfs) await idfs[elem.id]();
                            if (elem.value == value) {
                                elem.disabled = disabled;
                                lock = false;
                                return;
                            }
                            elem.value = value;
                        }
                        elem.disabled = disabled;
                        lock = false;
                    };
                    await updateValue();
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
                        "version": async () => {
                            elem.disabled = true;
                        },
                        "holiday": async () => {
                            elem.disabled = true;
                        },
                    };
                    if (elem.id in idfs) await idfs[elem.id]();
                    elem.addEventListener("change", async e => {
                        let v = (type == "bool") ? elem.checked : elem.value;
                        if (type == "bool" || v.length > 0) {
                            v = util.ensure(v, type);
                            let idfs = {
                            };
                            if (elem.id in idfs) v = await idfs[elem.id](v);
                            if (lock) return;
                            lock = true;
                            const disabled = elem.disabled;
                            elem.disabled = true;
                            await window.api.set("val-"+elem.id, v);
                            elem.disabled = disabled;
                            lock = false;
                            await updateValue();
                        }
                    });
                    setInterval(async () => {
                        if (document.activeElement == elem) return;
                        await updateValue();
                    }, 250);
                });
            })();

            this.#eInfo = document.querySelector("#PAGE > .content > .info");
            if (this.hasEInfo()) {
                let eLoading = document.createElement("div");
                eLoading.classList.add("loading");
                eLoading.style.setProperty("--size", "5px");
                eLoading.style.setProperty("--color", "var(--v2)");
                eLoading.style.padding = "5px";
                this.eInfo.appendChild(eLoading);
                (async () => {
                    eLoading.remove();
                    (await this.getAboutLines()).forEach(line => {
                        let elem = document.createElement("div");
                        this.eInfo.appendChild(elem);
                        elem.textContent = line;
                    });
                })();
                setInterval(async () => {
                    const dbHostAnchor = this.eInfo.querySelector(":scope > .nav > a#db-host");
                    if (!(dbHostAnchor instanceof HTMLAnchorElement)) return;
                    dbHostAnchor.href = await window.api.get("val-db-host");
                }, 250);
            }
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

    get eInfo() { return this.#eInfo; }
    hasEInfo() { return this.eInfo instanceof HTMLDivElement; }
    get eLoads() { return this.#eLoads; }
    hasELoads() { return this.eLoads instanceof HTMLDivElement; }
}
