import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";

import Source from "../../sources/source.js";


import PanelToolTab from "./tooltab.js";


export default class PanelTableTab extends PanelToolTab {
    #vars;
    #ts;
    #visibleN; #scrollN;
    #tsNow;
    #tsOverride;

    #eSide;
    #eSideHeader;
    #eTSInput;
    #eFollowBtn;

    static NAME = "Table";
    static NICKNAME = "Table";
    static ICON = null;
    static ICONSRC = "./assets/icons/table.svg";
    static ICONCOLOR = "var(--cb)";

    static TW = 250;
    static TW2 = 150;
    static TH = 30;

    constructor(a) {
        super(a);

        this.elem.classList.add("table");

        this.#vars = [];
        this.#ts = [];
        this.#visibleN = this.#scrollN = 0;
        this.#tsNow = 0;

        this.#eSide = document.createElement("div");
        this.elem.appendChild(this.eSide);
        this.eSide.classList.add("column");
        this.eSide.classList.add("side");
        this.#eSideHeader = document.createElement("div");
        this.eSide.appendChild(this.eSideHeader);
        this.eSideHeader.classList.add("header");

        this.#eTSInput = document.createElement("input");
        this.eSideHeader.appendChild(this.eTSInput);
        this.eTSInput.type = "number";
        this.eTSInput.placeholder = "Timestamp...";
        this.eTSInput.step = 0.01;
        this.#eFollowBtn = document.createElement("button");
        this.eSideHeader.appendChild(this.eFollowBtn);
        this.eFollowBtn.innerHTML = "<ion-icon src='./assets/icons/jump.svg'></ion-icon>";

        this.eTSInput.addEventListener("change", e => {
            let v = this.eTSInput.value;
            if (v.length <= 0) return;
            v = parseFloat(v);
            if (!this.tsOverride) {
                if (this.page.hasSource())
                    this.page.source.ts = v;
            }
            else this.tsNow = v;
        });
        this.eFollowBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.tsOverride = !this.tsOverride;
        });

        let entries = [], tsI = null;
        this.addHandler("update", delta => {
            if (this.isClosed) return;
            const source = this.page.source;
            if (!this.tsOverride) this.tsNow = source ? source.ts : 0;
            let ts = new Set();
            this.vars.forEach(v => {
                v.node = source ? source.tree.lookup(v.path) : null;
                if (!v.hasNode() || !v.node.hasField()) return;
                v.node.field.logsTS.map(t => ts.add(t));
            });
            this.#ts = [...ts].sort((a, b) => a-b);
            this.elem.style.setProperty("--height", this.n);
            this.#visibleN = Math.ceil(this.elem.offsetHeight/PanelTableTab.TH)+2;
            this.#scrollN = Math.floor(this.elem.scrollTop/PanelTableTab.TH)-1;
            this.#visibleN = Math.min(this.n, this.visibleN);
            this.#scrollN = Math.min(this.n-this.visibleN, Math.max(0, this.scrollN));
            this.#visibleN = Math.min(this.n-this.scrollN, this.visibleN);
            while (entries.length < this.visibleN) {
                let elem = document.createElement("div");
                this.eSide.appendChild(elem);
                let content = document.createElement("div");
                elem.appendChild(content);
                entries.push({
                    elem: elem,
                    content: content,
                });
            }
            while (entries.length > this.visibleN) {
                let entry = entries.pop();
                this.eSide.removeChild(entry.elem);
            }
            if (entries.length > 0)
                entries[0].elem.style.setProperty("--top", this.scrollN);
            let tsI2 = Math.max(0, this.lookupTS());
            if (tsI != tsI2) {
                tsI = tsI2;
                this.elem.scrollTop = tsI*PanelTableTab.TH;
            }
            for (let i = 0; i < this.visibleN; i++) {
                let { elem, content } = entries[i];
                content.textContent = this.ts[this.scrollN+i];
                if (this.scrollN+i == tsI)
                    elem.classList.add("this");
                else elem.classList.remove("this");
            }
            this.vars.forEach(v => v.update(delta));
        });

        if (util.is(a, "arr")) a = { vars: a };

        a = util.ensure(a, "obj");
        this.vars = a.vars;
        this.tsNow = a.tsNow;
        this.tsOverride = a.tsOverride;
    }

    get vars() { return [...this.#vars]; }
    set vars(v) {
        v = util.ensure(v, "arr");
        this.clearVars();
        v.forEach(v => this.addVar(v));
    }
    clearVars() {
        let vars = this.vars;
        vars.forEach(v => this.remVar(v));
        return vars;
    }
    hasVar(v) {
        if (!(v instanceof PanelTableTab.Variable)) return false;
        return this.#vars.includes(v) && v.tab == this;
    }
    insertVar(v, at) {
        if (!(v instanceof PanelTableTab.Variable)) return false;
        if (v.tab != null) return false;
        if (this.hasVar(v)) return false;
        at = Math.min(this.vars.length, Math.max(0, util.ensure(at, "int")));
        this.#vars.splice(at, 0, v);
        v.tab = this;
        this.elem.appendChild(v.elem);
        v.addLinkedHandler(this, "remove", () => this.remVar(v));
        v.addLinkedHandler(this, "change", (c, f, t) => this.change("vars["+this.#vars.indexOf(v)+"."+c, f, t));
        v.addLinkedHandler(this, "drag", () => {
            this.app.dragData = this.page.source.tree.lookup(v.path);
            this.app.dragging = true;
            v.post("remove");
        });
        this.change("insertVar", null, v);
        v.onAdd();
        return v;
    }
    addVar(v) { return this.insertVar(v, this.vars.length); }
    remVar(v) {
        if (!(v instanceof PanelTableTab.Variable)) return false;
        if (v.tab != this) return false;
        if (!this.hasVar(v)) return false;
        v.onRem();
        this.#vars.splice(this.#vars.indexOf(v), 1);
        v.tab = null;
        this.elem.removeChild(v.elem);
        v.clearLinkedHandlers(this, "remove");
        v.clearLinkedHandlers(this, "change");
        v.clearLinkedHandlers(this, "drag");
        this.change("remVar", v, null);
        return v;
    }

    get ts() { return this.#ts; }
    lookupTS(ts=null) {
        ts = util.ensure(ts, "num", this.tsNow);
        if (this.ts.length <= 0) return -1;
        if (ts < this.ts.at(0)) return -1;
        if (ts >= this.ts.at(-1)) return this.ts.length-1;
        let l = 0, r = this.ts.length-2;
        while (l <= r) {
            let m = Math.floor((l+r)/2);
            if (ts < this.ts[m]) r = m-1;
            else if (ts >= this.ts[m+1]) l = m+1;
            else return m;
        }
        return -1;
    }
    lookupTSExact(ts=null) {
        ts = util.ensure(ts, "num", this.tsNow);
        if (this.ts.length <= 0) return -1;
        if (ts < this.ts.at(0)) return -1;
        if (ts > this.ts.at(-1)) return -1;
        let l = 0, r = this.ts.length-1;
        while (l <= r) {
            let m = Math.floor((l+r)/2);
            if (ts < this.ts[m]) r = m-1;
            else if (ts > this.ts[m]) l = m+1;
            else return m;
        }
        return -1;
    }
    get n() { return this.ts.length; }
    get visibleN() { return this.#visibleN; }
    get scrollN() { return this.#scrollN; }
    get tsNow() { return this.#tsNow; }
    set tsNow(v) {
        v = util.ensure(v, "num");
        if (this.tsNow == v) return;
        if (this.tsOverride) this.change("tsNow", this.tsNow, this.#tsNow=v);
        else this.#tsNow = v;
        this.eTSInput.value = this.tsNow;
    }
    get tsOverride() { return this.#tsOverride; }
    set tsOverride(v) {
        v = !!v;
        if (this.tsOverride == v) return;
        this.change("tsOverride", this.tsOverride, this.#tsOverride=v);
        if (this.tsOverride) this.eFollowBtn.classList.remove("this");
        else this.eFollowBtn.classList.add("this");
    }

    get eSide() { return this.#eSide; }
    get eSideHeader() { return this.#eSideHeader; }
    get eTSInput() { return this.#eTSInput; }
    get eFollowBtn() { return this.#eFollowBtn; }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        let r;
        r = this.elem.getBoundingClientRect();
        if (pos.x < r.left || pos.x > r.right) return null;
        if (pos.y < r.top || pos.y > r.bottom) return null;
        if (data instanceof PanelBrowserTab) data = this.page.hasSource() ? this.page.source.tree.lookup(data.path) : null;
        if (!(data instanceof Source.Node)) return null;
        let y = r.top, h = r.height;
        let at = 0;
        const addVar = node => {
            let pth = node.path;
            if (node.hasField() && node.field.isJustPrimitive) {
                this.insertVar(new PanelTableTab.Variable(pth), at);
                at++;
            }
            node.nodeObjects.forEach(node => addVar(node));
        };
        let vars = this.vars;
        for (let i = 0; i <= vars.length; i++) {
            if (vars.length <= 0) break;
            if (i <= 0) {
                r = vars.at(0).elem.getBoundingClientRect();
                if (pos.x < r.left+r.width/2) return {
                    r: [[r.left, y], [0, h]],
                    round: false,
                    submit: () => {
                        at = i;
                        addVar(data);
                    },
                };
                continue;
            }
            if (i >= vars.length) {
                r = vars.at(-1).elem.getBoundingClientRect();
                if (pos.x >= r.left+r.width/2) return {
                    r: [[r.right, y], [0, h]],
                    round: false,
                    submit: () => {
                        at = i;
                        addVar(data);
                    },
                };
                continue;
            }
            let rj = vars[i-1].elem.getBoundingClientRect(), ri = vars[i].elem.getBoundingClientRect();
            if (pos.x < rj.left+rj.width/2) continue;
            if (pos.x >= ri.left+ri.width/2) continue;
            return {
                r: [[ri.left, y], [0, h]],
                round: false,
                submit: () => {
                    at = i;
                    addVar(data);
                },
            };
        }
        r = this.eSide.getBoundingClientRect();
        return {
            r: [[r.right, y], [0, h]],
            round: false,
            submit: () => {
                at = 0;
                addVar(data);
            },
        };
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            vars: this.vars,
            tsNow: this.tsNow,
            tsOverride: this.tsOverride,
        });
    }
}
PanelTableTab.Variable = class PanelTableTabVariable extends util.Target {
    #tab;

    #path;

    #node;

    #elem;
    #eHeader;

    constructor(a) {
        super();

        this.#tab = null;

        this.#path = "";

        this.#node = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("column");
        this.#eHeader = document.createElement("div");
        this.elem.appendChild(this.eHeader);
        this.eHeader.classList.add("header");

        this.eHeader.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            let trigger = 0;
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                trigger++;
                if (trigger < 10) return;
                mouseup();
                this.post("drag", e);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        let entries = [];
        this.addHandler("update", delta => {
            if (!this.hasTab()) return;
            let n = this.tab.ts.length;
            if (!this.hasNode() || !this.node.hasField() || !this.node.field.isJustPrimitive || this.node.field.logsN <= 0) {
                while (entries.length > 0) {
                    let entry = entries.pop();
                    this.elem.removeChild(entry.elem);
                }
                return;
            }
            let logsN = this.node.field.logsN;
            let logsTS = this.node.field.logsTS;
            let logsV = this.node.field.logsV;
            let start = this.node.field.getIndex(this.tab.ts[Math.min(n, Math.max(0, this.tab.scrollN-1))])-1;
            let stop = this.node.field.getIndex(this.tab.ts[Math.min(n, Math.max(0, this.tab.scrollN+this.tab.visibleN-1))])+1;
            start = Math.min(logsN-1, Math.max(0, start));
            stop = Math.min(logsN-1, Math.max(0, stop));
            let len = stop-start+1;
            while (entries.length < len) {
                let elem = document.createElement("div");
                this.elem.appendChild(elem);
                elem.innerHTML = "<div></div><div></div>";
                let content = elem.children[0];
                let value = elem.children[1];
                entries.push({
                    elem: elem,
                    content: content,
                    value: value,
                });
            }
            while (entries.length > len) {
                let entry = entries.pop();
                this.elem.removeChild(entry.elem);
            }
            let tw = 250;
            let its = this.tab.lookupTS();
            let scrollTop = this.tab.elem.scrollTop;
            entries[0].elem.style.setProperty("--top", this.tab.lookupTSExact(logsTS[start]));
            for (let i = start; i <= stop; i++) {
                let ts = logsTS[i], v = logsV[i];
                let { elem, content, value } = entries[i-start];
                let i0 = this.tab.lookupTSExact(ts);
                let i1 = (i+1 < logsN) ? this.tab.lookupTSExact(logsTS[i+1]) : n;
                elem.style.setProperty("--h", i1-i0);
                content.textContent = value.textContent = String(v);
                if (its >= i0 && its < i1) {
                    elem.classList.add("this");
                    value.style.setProperty("--shift", its-i0);
                } else elem.classList.remove("this");
                tw = Math.max(tw, elem.scrollWidth+1);
            }
            this.tab.elem.scrollTop = scrollTop;
            this.elem.style.setProperty("--tw", tw+"px");
        });

        if (util.is(a, "str")) a = { path: a };

        a = util.ensure(a, "obj");
        this.path = a.path;
    }

    get tab() { return this.#tab; }
    set tab(v) {
        v = (v instanceof PanelTableTab) ? v : null;
        if (this.tab == v) return;
        this.#tab = v;
    }
    hasTab() { return !!this.tab; }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        let pth = this.path.split("/").filter(part => part.length > 0);
        this.eHeader.innerHTML = "";
        let name = document.createElement("div");
        this.eHeader.appendChild(name);
        name.textContent = (pth.length > 0) ? pth.at(-1) : "/";
        let tooltip = document.createElement("p-tooltip");
        tooltip.classList.add("hov");
        tooltip.classList.add("swx");
        tooltip.textContent = this.path;
        let removeBtn = document.createElement("button");
        this.eHeader.appendChild(removeBtn);
        removeBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        removeBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove");
        });
        removeBtn.addEventListener("mousedown", e => {
            e.stopPropagation();
        });
    }

    get node() { return this.#node; }
    set node(v) {
        v = (v instanceof Source.Node) ? v : null;
        if (this.node == v) return;
        this.#node = v;
    }
    hasNode() { return !!this.node; }

    get elem() { return this.#elem; }
    get eHeader() { return this.#eHeader; }

    update(delta) { this.post("update", delta); }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
        });
    }
};
