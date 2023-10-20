import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";


class Action extends core.Target {
    #app;
    #elem;

    #checkDisabled;

    constructor(app, elem) {
        super();

        this.#app = app;
        this.#elem = elem;

        this.#checkDisabled = true;

        if (!this.hasElem()) return;

        const action = this.action.bind(this);
        let idfs = {
            "cleanup-app-data-dir": () => {
                this.action = async () => {
                    let confirmed = await new Promise((res, rej) => {
                        let pop = this.confirm();
                        pop.eContent.innerText = "Are you sure you want to cleanup application data?\nThis might accidentally delete some files - backup the entire application directory!\n(Or trust that I wrote this code well)";
                        pop.addHandler("result", async data => res(!!util.ensure(data, "obj").v));
                    });
                    if (!confirmed) return;
                    await action();
                };
            },
            "clear-app-log-dir": () => {
                this.action = async () => {
                    let id = setInterval(() => {
                        const progress = Math.min(1, Math.max(0, util.ensure(window.api.cacheGet(this.id+"-progress"), "num")));
                        if (this.hasApp()) this.app.progress = progress;
                        if (progress < 1) return;
                        if (this.hasApp()) this.app.progress = null;
                    }, 10);
                    await action();
                    clearInterval(id);
                    if (!this.hasApp()) return;
                    this.app.progress = 1;
                    this.app.progress = null;
                };
            },
            "poll-db-host": () => {
                this.#checkDisabled = false;
                this.init = async () => {
                    setInterval(async () => {
                        let isLoading = await window.api.get("loading");
                        elem.disabled = isLoading;
                    }, 250);
                };
            },
        };
        if (this.id in idfs) idfs[this.id]();
        this.elem.addEventListener("click", e => this.click());
    }

    get app() { return this.#app; }
    hasApp() { return this.app instanceof App; }
    get elem() { return this.#elem; }
    hasElem() { return this.elem instanceof HTMLButtonElement; }
    get id() { return this.hasElem() ? this.elem.id : null; }

    async init() {}
    async click() {
        if (!this.hasElem()) return;
        let disabled;
        console.log("action-s");
        if (this.#checkDisabled) {
            disabled = this.elem.disabled;
            this.elem.disabled = true;
        }
        await this.action();
        if (this.#checkDisabled) this.elem.disabled = disabled;
        console.log("action-f");
    }
    async action() { await window.api.send("cmd-"+this.id); }
}


export default class App extends core.App {
    #eInfo;
    #eLoads;

    constructor() {
        super();

        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("start-complete", async data => {
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
                    const action = new Action(this, elem);
                    await action.init();
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
                            let checked = !!(await window.api.get("val-"+elem.id));
                            if (elem.checked == checked) {
                                elem.disabled = disabled;
                                lock = false;
                                return;
                            }
                            elem.checked = checked;
                        } else {
                            let value = String(await window.api.get("val-"+elem.id));
                            let idfs = {
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
                const eThemeBtn = document.getElementById("theme");
                if (eThemeBtn instanceof HTMLButtonElement) {
                    eThemeBtn.addEventListener("click", async e => {
                        e.stopPropagation();
                        const themes = util.ensure(await window.api.get("themes"), "obj");
                        const theme = await window.api.get("theme");
                        let itm;
                        let menu = new core.App.ContextMenu();
                        for (let id in themes) {
                            itm = menu.addItem(new core.App.ContextMenu.Item(util.ensure(themes[id], "obj").name, (theme == id) ? "checkmark" : ""));
                            itm.addHandler("trigger", data => {
                                window.api.set("theme", [id]);
                            });
                        }
                        this.contextMenu = menu;
                        let r = eThemeBtn.getBoundingClientRect();
                        this.placeContextMenu(r.left, r.bottom);
                    });
                    setInterval(async () => {
                        if (eThemeBtn.children[0] instanceof HTMLDivElement)
                            eThemeBtn.children[0].textContent = util.ensure(util.ensure(await window.api.get("themes"), "obj")[await window.api.get("theme")], "obj").name;
                    }, 250);
                }
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
                    if (dbHostAnchor instanceof HTMLAnchorElement)
                        dbHostAnchor.href = await window.api.get("val-db-host");
                    const repoAnchor = this.eInfo.querySelector(":scope > .nav > a#repo");
                    if (repoAnchor instanceof HTMLAnchorElement)
                        repoAnchor.href = await window.api.get("val-repo");
                }, 250);
            }
            this.#eLoads = document.querySelector("#PAGE > .content > .loads");

            let prevLoads = [];
            let lock = false;
            this.addHandler("update", async data => {
                if (lock) return;
                lock = true;
                let loads = util.ensure(await window.api.get("loads"), "arr");
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
