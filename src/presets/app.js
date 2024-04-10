import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";


class Action extends util.Target {
    #app;
    #elem;

    #checkDisabled;

    constructor(app, elem) {
        super();

        this.#app = (app instanceof App) ? app : null;
        this.#elem = (elem instanceof HTMLButtonElement) ? elem : null;

        this.#checkDisabled = true;

        if (!this.hasElem()) return;

        const action = this.action.bind(this);
        let idfs = {
            "cleanup-app-data-dir": () => {
                this.action = async () => {
                    let pop = this.app.confirm(
                        "Cleanup",
                        "Are you sure you want to cleanup application data?\nDo not forget to back up!",
                    );
                    let result = await pop.whenResult();
                    if (!result) return;
                    await action();
                };
            },
            "clear-app-log-dir": () => {
                this.action = async () => {
                    let id = setInterval(() => {
                        const progress = Math.min(1, Math.max(0, util.ensure(window.cache.get(this.id+"-progress"), "num")));
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
        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            this.click();
        });
    }

    get app() { return this.#app; }
    hasApp() { return !!this.app; }
    get elem() { return this.#elem; }
    hasElem() { return !!this.elem; }
    get id() { return this.hasElem() ? this.elem.id : null; }

    async init() {}
    async click() {
        if (!this.hasElem()) return;
        let disabled;
        if (this.#checkDisabled) {
            disabled = this.elem.disabled;
            this.elem.disabled = true;
        }
        await this.action();
        if (this.#checkDisabled) this.elem.disabled = disabled;
    }
    async action() {
        try {
            await window.api.send("cmd-"+this.id);
        } catch (e) { await this.app.doError("Action Error", "ActionId: "+this.id, e); }
    }
}


export default class App extends core.App {
    #eInfo;
    #eLoads;

    constructor() {
        super();

        this.addHandler("pre-setup", () => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("post-setup", async () => {
            (async () => {
                let signal = new util.Target();
                signal.addHandler("nav", (e, href) => this.addPopup(new App.MarkdownPopup(href)));
                document.querySelector("#PAGE > .content").appendChild(await this.createMarkdown(new URL("display.md", window.location), signal));
                const eColorsheet = document.getElementById("colorsheet");
                if (eColorsheet instanceof HTMLDivElement) {
                    let headers = ["v", "a", ...this.colorNames.map(c => "c"+c)];
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
                ["PANEL", "PLANNER"].forEach(async name => {
                    let elem = document.getElementById(name.toLowerCase()+"-root");
                    if (!(elem instanceof HTMLLabelElement)) return;
                    let input = elem.querySelector(":scope > input");
                    if (!(input instanceof HTMLInputElement)) return;
                    let btn = elem.querySelector(":scope > button");
                    if (!(btn instanceof HTMLButtonElement)) return;
                    input.addEventListener("change", async e => {
                        input.disabled = btn.disabled = true;
                        try {
                            await window.api.send("feature", name, "set", "root", input.value);
                        } catch (e) { await this.doError("Feature Root Set Error", "FeatureName: "+name, e); }
                        let value = "";
                        try {
                            value = await window.api.send("feature", name, "get", "root");
                        } catch (e) { await this.doError("Feature Root Get Root", "FeatureName: "+name, e); }
                        input.value = value;
                        input.disabled = btn.disabled = false;
                    });
                    btn.addEventListener("click", async e => {
                        e.stopPropagation();
                        input.disabled = btn.disabled = true;
                        let result = await App.fileOpenDialog({
                            title: "Choose a directory",
                            properties: [
                                "openDirectory",
                                "createDirectory",
                                "promptToCreate",
                            ],
                        });
                        result = util.ensure(result, "obj");
                        let path = result.canceled ? null : util.ensure(result.filePaths, "arr")[0];
                        try {
                            await window.api.send("feature", name, "set", "root", path);
                        } catch (e) { await this.doError("Feature Root Set Error", "FeatureName: "+name, e); }
                        let value = "";
                        try {
                            value = await window.api.send("feature", name, "get", "root");
                        } catch (e) { await this.doError("Feature Root Get Error", "FeatureName: "+name, e); }
                        input.value = value;
                        input.disabled = btn.disabled = false;
                    });
                    let value = "";
                    try {
                        value = await window.api.send("feature", name, "get", "root");
                    } catch (e) { await this.doError("Feature Root Get Error", "FeatureName: "+name, e); }
                    input.value = value;
                });
                Array.from(document.querySelectorAll("#PAGE > .content > article button.cmd")).forEach(async elem => {
                    const action = new Action(this, elem);
                    await action.init();
                });
                Array.from(document.querySelectorAll("#PAGE > .content > article input.val")).forEach(async elem => {
                    let type = {
                        "version": "str",
                        "db-host": "str",
                        "assets-host": "str",
                        "socket-host": "str",
                        "scout-url": "str",
                        "comp-mode": "bool",
                        "holiday": "str",
                        "holiday-opt": "bool",
                    }[elem.id];
                    let lock = false;
                    const updateValue = async () => {
                        if (lock) return;
                        lock = true;
                        const disabled = elem.disabled;
                        elem.disabled = true;
                        if (type == "bool") {
                            let checked = false;
                            try {
                                checked = !!(await window.api.get("val-"+elem.id));
                            } catch (e) { await this.doError("Input Boolean Get Error", "InputId: "+elem.id, e); }
                            if (elem.checked == checked) {
                                elem.disabled = disabled;
                                lock = false;
                                return;
                            }
                            elem.checked = checked;
                        } else {
                            let value = "";
                            try {
                                value = await window.api.get("val-"+elem.id);
                            } catch (e) { await this.doError("Input Get Error", "InputId: "+elem.id, e); }
                            let idfs = {
                                "db-host": async () => {
                                    value = (value == null) ? "" : String(value);
                                },
                                "socket-host": async () => {
                                    value = (value == null) ? "" : String(value);
                                },
                                "scout-url": async () => {
                                    value = (value == null) ? "" : String(value);
                                },
                                "holiday": async () => {
                                    value = (value == null) ? "" : util.formatText(value);
                                },
                            };
                            if (elem.id in idfs) await idfs[elem.id]();
                            else value = String(value);
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
                        if (["any_num", "num", "float"].includes(type)) v = parseFloat(v);
                        else if (["int"].includes(type)) v = parseInt(v);
                        v = util.ensure(v, type);
                        let idfs = {
                            "db-host": async () => {
                                v = (v.length <= 0) ? null : String(v);
                            },
                            "socket-host": async () => {
                                v = (v.length <= 0) ? null : String(v);
                            },
                            "scout-url": async () => {
                                v = (v.length <= 0) ? null : String(v);
                            },
                        };
                        if (elem.id in idfs) await idfs[elem.id]();
                        if (lock) return;
                        lock = true;
                        const disabled = elem.disabled;
                        elem.disabled = true;
                        try {
                            await window.api.set("val-"+elem.id, v);
                        } catch (e) { await this.doError("Input Set Error", "InputId: "+elem.id, e); }
                        elem.disabled = disabled;
                        lock = false;
                        await updateValue();
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
                        let menu = new core.App.Menu();
                        for (let id in themes) {
                            itm = menu.addItem(new core.App.Menu.Item(util.ensure(themes[id], "obj").name, (theme == id) ? "checkmark" : ""));
                            itm.addHandler("trigger", async e => {
                                try {
                                    await window.api.set("theme", id);
                                } catch (e) { await this.doError("Theme Set Error", "ThemeId: "+id, e); }
                            });
                        }
                        this.contextMenu = menu;
                        let r = eThemeBtn.getBoundingClientRect();
                        this.placeContextMenu(r.left, r.bottom);
                        menu.elem.style.minWidth = r.width+"px";
                    });
                    setInterval(async () => {
                        if (eThemeBtn.children[0] instanceof HTMLDivElement) {
                            let theme = await window.api.get("theme");
                            theme = util.is(theme, "obj") ? theme : String(theme);
                            eThemeBtn.children[0].textContent = util.is(theme, "obj") ? "Custom" : util.ensure(util.ensure(await window.api.get("themes"), "obj")[theme], "obj").name;
                        }
                    }, 250);
                }
                const eNativeThemeBtn = document.getElementById("native-theme");
                if (eNativeThemeBtn instanceof HTMLButtonElement) {
                    const nativeThemes = {
                        system: { name: "Use System" },
                        dark: { name: "Dark" },
                        light: { name: "Light" },
                    };
                    eNativeThemeBtn.addEventListener("click", async e => {
                        e.stopPropagation();
                        const nativeTheme = await window.api.get("native-theme");
                        let itm;
                        let menu = new core.App.Menu();
                        for (let id in nativeThemes) {
                            itm = menu.addItem(new core.App.Menu.Item(util.ensure(nativeThemes[id], "obj").name, (nativeTheme == id) ? "checkmark" : ""));
                            itm.addHandler("trigger", async e => {
                                try {
                                    window.api.set("native-theme", id);
                                } catch (e) { await this.doError("Native Theme Set Error", "NativeThemeId: "+id, e); }
                            });
                        }
                        this.contextMenu = menu;
                        let r = eNativeThemeBtn.getBoundingClientRect();
                        this.placeContextMenu(r.left, r.bottom);
                        menu.elem.style.minWidth = r.width+"px";
                    });
                    setInterval(async () => {
                        const nativeThemes = {
                            system: { name: "Use System" },
                            dark: { name: "Dark" },
                            light: { name: "Light" },
                        };
                        if (eNativeThemeBtn.children[0] instanceof HTMLDivElement)
                            eNativeThemeBtn.children[0].textContent = util.ensure(nativeThemes[await window.api.get("native-theme")], "obj").name;
                    }, 250);
                }
            })();

            this.#eInfo = document.querySelector("#PAGE > .content > .info");
            if (this.hasEInfo()) {
                const putAgent = () => {
                    Array.from(this.eInfo.querySelectorAll(":scope > div:not(.nav)")).forEach(elem => elem.remove());
                    this.getAgent().forEach(line => {
                        let elem = document.createElement("div");
                        this.eInfo.appendChild(elem);
                        elem.textContent = line;
                    });
                };
                putAgent();
                window.onBuildAgent(putAgent);
                setInterval(async () => {
                    const repoAnchor = this.eInfo.querySelector(":scope > .nav > a#repo");
                    if (repoAnchor instanceof HTMLAnchorElement)
                        repoAnchor.href = await window.api.get("val-repo");
                    const dbHostAnchor = this.eInfo.querySelector(":scope > .nav > a#db-host");
                    if (dbHostAnchor instanceof HTMLAnchorElement)
                        dbHostAnchor.href = await window.api.get("db-host");
                    const assetsHostAnchor = this.eInfo.querySelector(":scope > .nav > a#assets-host");
                    if (assetsHostAnchor instanceof HTMLAnchorElement)
                        assetsHostAnchor.href = await window.api.get("assets-host");
                    const scoutURLAnchor = this.eInfo.querySelector(":scope > .nav > a#scout-url");
                    if (scoutURLAnchor instanceof HTMLAnchorElement)
                        scoutURLAnchor.href = await window.api.get("scout-url");
                }, 250);
            }
            this.#eLoads = document.querySelector("#PAGE > .content > .loads");

            let prevLoads = [];
            let lock = false;
            this.addHandler("update", async delta => {
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
