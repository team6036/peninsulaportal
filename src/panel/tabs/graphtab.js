import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";

import Source from "../../sources/source.js";


import PanelBrowserTab from "./browsertab.js";
import PanelToolCanvasTab from "./toolcanvastab.js";


export default class PanelGraphTab extends PanelToolCanvasTab {
    #padding;
    #axisInteriorX;
    #axisInteriorY;

    #lVars; #rVars;

    #viewMode;
    #viewParams;

    static NAME = "Graph";
    static NICKNAME = "Graph";
    static ICON = "analytics";
    static ICONSRC = null;
    static ICONCOLOR = "var(--cb)";

    constructor(a) {
        super(a);

        this.elem.classList.add("graph");

        this.#padding = new util.V4();
        this.#axisInteriorX = false;
        this.#axisInteriorY = false;

        this.#lVars = new Set();
        this.#rVars = new Set();

        this.#viewMode = "all";
        this.#viewParams = {};

        this.padding = 40;

        ["l", "v", "r"].forEach(id => {
            const elem = document.createElement("div");
            elem.id = id;
            this.addEOptionSection(elem);
            elem.classList.add("section");
            let form = new core.Form();
            elem.appendChild(form.elem);
            form.side = "center";
            form.addField(new core.Form.Header({ l: "Left Axis", v: "View Window", r: "Right Axis" }[id]));
            let idfs = {
                l: () => {
                    elem.classList.add("list");
                    const update = () => {
                        if (this.lVars.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    };
                    this.addHandler("change-addLVar", update);
                    this.addHandler("change-remLVar", update);
                    update();
                },
                r: () => {
                    elem.classList.add("list");
                    const update = () => {
                        if (this.rVars.length > 0) elem.classList.remove("empty");
                        else elem.classList.add("empty");
                    };
                    this.addHandler("change-addRVar", update);
                    this.addHandler("change-remRVar", update);
                    update();
                },
                v: () => {
                    elem.classList.add("view");
                    const viewModes = ["left", "right", "section", "all"];
                    let fViewMode = form.addField(new core.Form.SelectInput("view-mode", viewModes));
                    fViewMode.showHeader = false;
                    fViewMode.useOutline = false;
                    fViewMode.addHandler("change-value", () => (this.viewMode = fViewMode.value));
                    const updateResize = () => {
                        let r = fViewMode.elem.getBoundingClientRect();
                        let small = r.width < 250;
                        fViewMode.values = fViewMode.values.map(data => {
                            if (small) {
                                if (util.is(data, "obj")) return data;
                                return { value: data, name: {
                                    left: "L", right: "R",
                                    section: "Sect",
                                    all: "*",
                                }[data] };
                            } else {
                                if (util.is(data, "obj")) return data.value;
                                return data;
                            }
                        });
                    };
                    new ResizeObserver(updateResize).observe(fViewMode.elem);
                    this.addHandler("add", updateResize);
                    form.addField(new core.Form.Line());
                    let forms = {};
                    viewModes.forEach(mode => {
                        let form = forms[mode] = new core.Form();
                        elem.appendChild(form.elem);
                        let modefs = {
                            _: side => {
                                let input = form.addField(new core.Form.Input1d("view-time"));
                                input.types = ["ms", "s", "min"];
                                input.baseType = "ms";
                                input.activeType = "s";
                                input.step = 0.1;
                                input.inputs.forEach(inp => {
                                    inp.placeholder = "...";
                                    inp.min = 0;
                                });
                                input.addHandler("change-value", () => {
                                    let v = Math.max(0, input.value);
                                    this.change("viewParams.time", this.viewParams.time, this.viewParams.time=v);
                                });
                                let use = form.addField(new core.Form.SelectInput("use", [{ value: false, name: "Use log "+{ l: "start", r: "end" }[side] }, { value: true, name: "Use pointer" }]));
                                use.addHandler("change-value", () => {
                                    let v = !!use.value;
                                    this.change("viewParams.use", this.viewParams.use, this.viewParams.use=v);
                                });
                                this.addHandler("change-viewParams.time", () => (input.value = this.viewParams.time));
                                this.addHandler("change-viewParams.use", () => {
                                    input.header =
                                        this.viewParams.use ?
                                            {
                                                l: "Backward",
                                                r: "Forward",
                                            }[side]+" View Time" :
                                        {
                                            l: "Forward",
                                            r: "Backward",
                                        }[side]+" View Time"
                                    ;
                                    use.value = this.viewParams.use;
                                });
                                this.change("viewParams.time", null, this.viewParams.time=5000);
                                this.change("viewParams.use", null, this.viewParams.use=false);
                            },
                            left: () => modefs._("l"),
                            right: () => modefs._("r"),
                            section: () => {
                                let startInput = form.addField(new core.Form.Input1d("range-start"));
                                startInput.types = ["ms", "s", "min"];
                                startInput.baseType = "ms";
                                startInput.activeType = "s";
                                startInput.step = 0.1;
                                startInput.inputs.forEach(inp => {
                                    inp.placeholder = "...";
                                });
                                startInput.addHandler("change-value", () => {
                                    let v = Math.max(0, startInput.value);
                                    this.change("viewParams.start", this.viewParams.start, this.viewParams.start=v);
                                });
                                let stopInput = form.addField(new core.Form.Input1d("range-start"));
                                stopInput.types = ["ms", "s", "min"];
                                stopInput.baseType = "ms";
                                stopInput.activeType = "s";
                                stopInput.step = 0.1;
                                stopInput.inputs.forEach(inp => {
                                    inp.placeholder = "...";
                                });
                                stopInput.addHandler("change-value", () => {
                                    let v = Math.max(0, stopInput.value);
                                    this.change("viewParams.stop", this.viewParams.stop, this.viewParams.stop=v);
                                });
                                this.addHandler("change-viewParams.start", () => (startInput.value = this.viewParams.start));
                                this.addHandler("change-viewParams.stop", () => (stopInput.value = this.viewParams.stop));
                                this.change("viewParams.start", null, this.viewParams.start=0);
                                this.change("viewParams.stop", null, this.viewParams.stop=5000);
                            },
                        };
                        if (mode in modefs) modefs[mode]();
                        let fApply = form.addField(new core.Form.Button("apply-all", "Apply To All Graphs"));
                        fApply.showHeader = false;
                        fApply.addHandler("trigger", e => {
                            if (!this.page.hasWidget()) return;
                            const dfs = widget => {
                                if (widget instanceof Container) return widget.children.forEach(widget => dfs(widget));
                                widget.tabs.forEach(tab => {
                                    if (!(tab instanceof PanelGraphTab)) return;
                                    tab.viewMode = this.viewMode;
                                    tab.viewParams = this.viewParams;
                                });
                            };
                            dfs(this.page.widget);
                        });
                    });
                    const update = () => {
                        fViewMode.value = this.viewMode;
                        for (let mode in forms)
                            forms[mode].isShown = mode == this.viewMode;
                    };
                    this.addHandler("change-viewMode", update);
                    update();
                },
            };
            if (id in idfs) idfs[id]();
        });

        this.quality = 2;

        let mouseX = null, mouseY = null, mouseDown = false, mouseAlt = false;
        this.canvas.addEventListener("mousemove", e => {
            let r = this.canvas.getBoundingClientRect();
            let x = e.pageX;
            x -= r.left + this.paddingLeft;
            x /= r.width - (this.paddingLeft+this.paddingRight);
            mouseX = x;
            let y = e.pageY;
            y -= r.top + this.paddingTop;
            y /= r.height - (this.paddingTop+this.paddingBottom);
            mouseY = y;
        });
        this.canvas.addEventListener("mouseleave", e => {
            this.app.remHint(hints);
            mouseX = null;
            mouseY = null;
        });
        this.canvas.addEventListener("mousedown", e => {
            e.preventDefault();
            e.stopPropagation();
            mouseDown = true;
            mouseAlt = e.button != 0;
        });
        this.canvas.addEventListener("mouseup", e => {
            mouseDown = false;
            mouseAlt = false;
        });
        let scrollX = 0, scrollY = 0, scrollAxis = null;
        this.canvas.addEventListener("wheel", e => {
            scrollX += e.deltaX;
            scrollY += e.deltaY;
        });

        let hints = [];

        let hintCycle = 0, hintAlt = false;
        const onKeyDown = e => {
            if (e.code == "ShiftLeft" || e.code == "ShiftRight") {
                hintAlt = true;
            }
            if (e.code == "Tab") {
                e.preventDefault();
                e.stopPropagation();
                hintCycle++;
            }
        };
        const onKeyUp = e => {
            if (e.code == "ShiftLeft" || e.code == "ShiftRight") {
                hintAlt = false;
            }
        };
        this.addHandler("add", () => {
            document.body.addEventListener("keydown", onKeyDown);
            document.body.addEventListener("keyup", onKeyUp);
            this.app.addHint(hints.map(hint => hint.hint));
        });
        this.addHandler("rem", () => {
            document.body.removeEventListener("keydown", onKeyDown);
            document.body.removeEventListener("keyup", onKeyUp);
            this.app.remHint(hints.map(hint => hint.hint));
        });

        let mouseX0 = null, t0 = null;
        this.addHandler("update", delta => {
            if (this.isClosed) return;
            
            const ctx = this.ctx, quality = this.quality;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            if (!this.page.hasSource()) return;
            const source = this.page.source;
            let minTime = source.tsMin, maxTime = source.tsMax, time = source.ts;
            const graphRange = {
                left: () => (
                    this.viewParams.use ?
                        [
                            Math.max(minTime, time-Math.max(0, util.ensure(this.viewParams.time, "num"))),
                            time,
                        ] :
                    [
                        minTime,
                        Math.min(maxTime, minTime+Math.max(0, util.ensure(this.viewParams.time, "num"))),
                    ]
                ),
                right: () => (
                    this.viewParams.use ?
                        [
                            time,
                            Math.min(maxTime, time+Math.max(0, util.ensure(this.viewParams.time, "num"))),
                        ] :
                    [
                        Math.max(minTime, maxTime-Math.max(0, util.ensure(this.viewParams.time, "num"))),
                        maxTime,
                    ]
                ),
                section: () => {
                    let start = util.ensure(this.viewParams.start, "num", minTime);
                    let stop = util.ensure(this.viewParams.stop, "num", maxTime);
                    start = Math.min(maxTime, Math.max(minTime, start));
                    stop = Math.min(maxTime, Math.max(minTime, stop));
                    stop = Math.max(start, stop);
                    return [start, stop];
                },
                all: () => [minTime, maxTime],
            }[this.viewMode]();
            let graphVars = [this.lVars, this.rVars].map(vars => {
                return {
                    vars: vars,
                    nodes: {}, logs: {}, ranges: {},
                    range: [null, null], step: 0,
                };
            });
            graphVars.forEach(o => {
                const { vars, nodes, logs, ranges, range } = o;
                vars.forEach(v => {
                    v.hooks.forEach(hook => {
                        let node = hook.hasPath() ? source.tree.lookup(hook.path) : null;
                        hook.setFrom((node && node.hasField()) ? node.field.type : "*", (node && node.hasField()) ? node.field.get() : null);
                    });

                    if (!v.isShown) return;

                    let node;
                    if (v.path in nodes) node = nodes[v.path];
                    else {
                        node = source.tree.lookup(v.path);
                        if (!node) return v.disable();
                        if (!node.hasField()) return v.disable();
                        if (!node.field.isJustPrimitive) return v.disable();
                        nodes[v.path] = node;
                    }

                    let log, subrange;
                    if (v.path in logs) {
                        log = logs[v.path];
                        subrange = ranges[v.path];
                    } else {
                        subrange = [null, null];
                        log = node.field.getRange(...graphRange);
                        const start = node.field.get(graphRange[0]), stop = node.field.get(graphRange[1]);
                        if (start != null) {
                            log.start--;
                            log.n++;
                            log.ts.unshift(graphRange[0]);
                            log.v.unshift(node.field.isNumerical ? v.execExpr(start) : start);
                        }
                        if (stop != null) {
                            log.stop++;
                            log.n++;
                            log.ts.push(graphRange[1]);
                            log.v.push(node.field.isNumerical ? v.execExpr(stop) : stop);
                        }
                        if (node.field.isNumerical)
                            // TODO: fix performance
                            log.v = log.v.map(v2 => {
                                v2 = v.execExpr(v2);
                                if (subrange[0] == null) subrange[0] = v2;
                                else subrange[0] = Math.min(subrange[0], v2);
                                if (subrange[1] == null) subrange[1] = v2;
                                else subrange[1] = Math.max(subrange[1], v2);
                                return v2;
                            });
                            // end todo
                        if (log.length <= 0) return v.disable();
                        logs[v.path] = log;
                        ranges[v.path] = subrange;
                    }

                    v.enable();

                    if (!node.field.isNumerical) return;

                    if (range[0] == null) range[0] = subrange[0];
                    else range[0] = Math.min(range[0], subrange[0]);
                    if (range[1] == null) range[1] = subrange[1];
                    else range[1] = Math.max(range[1], subrange[1]);
                });
                range[0] = util.ensure(range[0], "num");
                range[1] = util.ensure(range[1], "num");
                let step = lib.findStep(range[1]-range[0], 5);
                range[0] = Math.floor(range[0]/step) - 1;
                range[1] = Math.ceil(range[1]/step) + 1;
                o.step = step;
            });
            const nStepsMax = Math.max(...graphVars.map(o => o.range[1]-o.range[0]));
            graphVars.forEach(o => {
                const { range } = o;
                const nSteps = range[1]-range[0];
                let addAbove = Math.ceil((nStepsMax-nSteps) / 2);
                let addBelow = (nStepsMax-nSteps) - addAbove;
                range[0] -= addBelow;
                range[1] += addAbove;
            });
            const timeStep = lib.findStep(graphRange[1]-graphRange[0], 10);
            const mnx = this.paddingLeft*quality, mxx = ctx.canvas.width - this.paddingRight*quality;
            const mny = this.paddingTop*quality, mxy = ctx.canvas.height - this.paddingBottom*quality;
            let y0 = mny, y1 = mxy;
            let y2 = mxy + 5*quality * (this.axisInteriorX ? -1 : 1);
            let y3 = mxy + 10*quality * (this.axisInteriorX ? -1 : 1);
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.fillStyle = PROPERTYCACHE.get("--v6");
            ctx.font = (12*quality)+"px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = this.axisInteriorX ? "bottom" : "top";
            for (let i = Math.ceil(graphRange[0]/timeStep); i <= Math.floor(graphRange[1]/timeStep); i++) {
                let x = (i*timeStep - graphRange[0]) / (graphRange[1]-graphRange[0]);
                x = util.lerp(mnx, mxx, x);
                ctx.strokeStyle = PROPERTYCACHE.get("--v2");
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, y1);
                ctx.stroke();
                ctx.strokeStyle = PROPERTYCACHE.get("--v6");
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
                let t = i*timeStep, unit = "ms";
                if (t/1000 >= 1) {
                    t /= 1000;
                    unit = "s";
                }
                ctx.fillText(t+unit, x, y3);
            }
            ctx.strokeStyle = PROPERTYCACHE.get("--v2");
            for (let i = 0; i <= nStepsMax; i++) {
                let y = i / nStepsMax;
                y = util.lerp(mny, mxy, 1-y);
                ctx.beginPath();
                ctx.moveTo(mnx, y);
                ctx.lineTo(mxx, y);
                ctx.stroke();
            }
            let mouseXCanv = (mouseX == null) ? null : util.lerp(mnx, mxx, mouseX);
            let mouseYCanv = (mouseY == null) ? null : util.lerp(mny, mxy, mouseY);
            let mouseXCanv0 = (mouseX0 == null) ? null : util.lerp(mnx, mxx, mouseX0);
            let foundHints = [];
            let nDiscrete = 0;
            graphVars.forEach((o, i) => {
                const { vars, nodes, logs, range, step } = o;
                let v = this.axisInteriorY ? -1 : 1;
                let x1 = [mnx, mxx][i];
                let x2 = [mnx - 5*quality*v, mxx + 5*quality*v][i];
                let x3 = [mnx - 10*quality*v, mxx + 10*quality*v][i];
                ctx.strokeStyle = ctx.fillStyle = PROPERTYCACHE.get("--v6");
                ctx.lineWidth = 1*quality;
                ctx.lineJoin = "miter";
                ctx.lineCap = "square";
                ctx.font = (12*quality)+"px monospace";
                ctx.textAlign = ["right", "left"][this.axisInteriorY ? 1-i : i];
                ctx.textBaseline = "middle";
                for (let j = range[0]; j <= range[1]; j++) {
                    if (this.axisInteriorX && (j == range[0] || j == range[1])) continue;
                    let y = (j-range[0]) / (range[1]-range[0]);
                    y = util.lerp(mny, mxy, 1-y);
                    ctx.beginPath();
                    ctx.moveTo(x1, y);
                    ctx.lineTo(x2, y);
                    ctx.stroke();
                    ctx.fillText(j*step, x3, y);
                }
                vars.forEach(v => {
                    if (!(v.path in logs)) return;
                    if (!(v.path in nodes)) return;
                    ctx.globalAlpha = v.isGhost ? 0.5 : 1;
                    const log = logs[v.path];
                    const node = nodes[v.path];
                    if (!node.field.isNumerical) {
                        for (let i = 0; i < log.n; i++) {
                            const odd = (((log.start+i)%2)+2)%2 == 0;
                            let pts = log.ts[i], pv = log.v[i];
                            let npts = (i+1 >= log.n) ? graphRange[1] : log.ts[i+1];
                            let x = util.lerp(mnx, mxx, (pts-graphRange[0])/(graphRange[1]-graphRange[0]));
                            let nx = util.lerp(mnx, mxx, (npts-graphRange[0])/(graphRange[1]-graphRange[0]));
                            ctx.fillStyle = (v.color.startsWith("var(") && v.color.endsWith(")")) ? PROPERTYCACHE.get(v.color.slice(4, -1)+(odd?"2":"")) : v.color;
                            ctx.fillRect(
                                x, mnx+(10+20*nDiscrete)*quality,
                                Math.max(0, nx-x), 15*quality,
                            );
                            ctx.fillStyle = PROPERTYCACHE.get("--v"+(odd?"8":"1"));
                            ctx.font = (12*quality)+"px monospace";
                            ctx.textAlign = "left";
                            ctx.textBaseline = "middle";
                            ctx.fillText(pv, x+5*quality, mnx+(10+20*nDiscrete+7.5)*quality);
                        }
                        nDiscrete++;
                        return;
                    }
                    // TODO: fix performance
                    const ranges = [];
                    for (let i = 0; i < log.n; i++) {
                        let ts = log.ts[i], v = log.v[i];
                        let x = util.lerp(mnx, mxx, (ts-graphRange[0])/(graphRange[1]-graphRange[0]));
                        if (ranges.length > 0) {
                            let px = ranges.at(-1).x;
                            let r = ranges.at(-1).r;
                            let ends = ranges.at(-1).ends;
                            if (x-px > quality) ranges.push({
                                x: x, r: [v, v], v: v,
                                ends: {
                                    l: [x, v],
                                    r: [x, v],
                                },
                            });
                            else {
                                r[0] = Math.min(r[0], v);
                                r[1] = Math.max(r[1], v);
                                if (x < ends.l[0]) ends.l = [x, v];
                                if (x > ends.r[0]) ends.r = [x, v];
                            }
                        } else ranges.push({
                            x: x, r: [v, v], v: v,
                            ends: {
                                l: [x, v],
                                r: [x, v],
                            },
                        });
                    }
                    // end todo
                    ctx.strokeStyle = (v.color.startsWith("var(") && v.color.endsWith(")")) ? PROPERTYCACHE.get(v.color.slice(4, -1)) : v.color;
                    ctx.lineWidth = 1*quality;
                    ctx.lineJoin = "round";
                    ctx.lineCap = "square";
                    ctx.beginPath();
                    let py = null;
                    let potentialFoundHints = [], usePotential = false;
                    ranges.forEach((ri, i) => {
                        let {x, r, v, ends } = ri;
                        let y1 = r[0], y2 = r[1], yl = ends.l[1], yr = ends.r[1];
                        y1 = (y1-(step*range[0])) / (step*(range[1]-range[0]));
                        y2 = (y2-(step*range[0])) / (step*(range[1]-range[0]));
                        yl = (yl-(step*range[0])) / (step*(range[1]-range[0]));
                        yr = (yr-(step*range[0])) / (step*(range[1]-range[0]));
                        y1 = util.lerp(mny, mxy, 1-y1);
                        y2 = util.lerp(mny, mxy, 1-y2);
                        yl = util.lerp(mny, mxy, 1-yl);
                        yr = util.lerp(mny, mxy, 1-yr);
                        if (i > 0) {
                            ctx.lineTo(x, py);
                            ctx.lineTo(x, yl);
                        } else ctx.moveTo(x, yl);
                        ctx.lineTo(x, y1);
                        ctx.lineTo(x, y2);
                        ctx.lineTo(x, yr);
                        py = yr;
                        if (
                            (mouseXCanv != null) &&
                            (mouseYCanv != null) &&
                            (mouseXCanv >= x && (i+1 >= ranges.length || mouseXCanv < ranges[i+1].x)) &&
                            (hintAlt || (mouseYCanv > y1-2*quality && mouseYCanv < y2+5*quality))
                        ) {
                            foundHints.push({
                                x: mouseXCanv, y: yl,
                                name: node.path,
                                color: ctx.strokeStyle,
                                value: v,
                            });
                            usePotential = true;
                        }
                        if (
                            (mouseXCanv0 != null) &&
                            (mouseXCanv0 >= x && (i+1 >= ranges.length || mouseXCanv0 < ranges[i+1].x))
                        ) {
                            potentialFoundHints.push({
                                x: mouseXCanv0, y: yl,
                                name: node.path,
                                color: ctx.strokeStyle,
                                value: v,
                            });
                        }
                    });
                    if (usePotential) foundHints.push(...potentialFoundHints);
                    ctx.stroke();
                });
                ctx.globalAlpha = 1;
            });
            if (!mouseAlt && !hintAlt) {
                if (foundHints.length > 0) {
                    hintCycle %= foundHints.length;
                    foundHints = [foundHints[hintCycle]];
                }
            }
            let r = ctx.canvas.getBoundingClientRect();
            if (hints.length > foundHints.length) this.app.remHint(hints.splice(foundHints.length).map(hint => hint.hint));
            while (hints.length < foundHints.length) {
                let hint = this.app.addHint(new core.Hint());
                let hName = hint.addEntry(new core.Hint.NameEntry(""));
                let hValue = hint.addEntry(new core.Hint.ValueEntry(0));
                hints.push({
                    hint: hint,
                    hName: hName,
                    hValue: hValue,
                });
            }
            for (let i = 0; i < foundHints.length; i++) {
                let foundHint = foundHints[i];
                const hint = hints[i];
                hint.hName.name = foundHint.name;
                hint.hName.eName.style.color = foundHint.color;
                hint.hValue.value = foundHint.value;
                hint.hint.place(r.left+foundHint.x/quality, r.top+foundHint.y/quality);
            }
            ctx.strokeStyle = PROPERTYCACHE.get("--v6");
            ctx.lineWidth = 1*quality;
            ctx.lineJoin = "miter";
            ctx.lineCap = "square";
            ctx.beginPath();
            ctx.strokeRect(mnx, mny, mxx-mnx, mxy-mny);
            ctx.font = (12*quality)+"px monospace";
            ctx.textBaseline = "top";
            ctx.textAlign = "left";
            const ranges = [];
            [
                {
                    value: this.page.hasSource() ? this.page.source.ts : 0,
                    color: "v4",
                },
                {
                    value: util.lerp(...graphRange, mouseX),
                    color: "v4-8",
                    show: mouseX != null && (!mouseDown || mouseAlt),
                },
                {
                    value: t0,
                    color: "v4-8",
                    show: mouseAlt,
                },
            ].forEach(data => {
                if (("show" in data) && !data.show) return;
                ctx.fillStyle = ctx.strokeStyle = PROPERTYCACHE.get("--"+data.color);
                let progress = (data.value-graphRange[0]) / (graphRange[1]-graphRange[0]);
                if (progress < 0) return;
                if (progress > 1) return;
                let x = util.lerp(mnx, mxx, progress);
                ctx.setLineDash([5*quality, 5*quality]);
                ctx.beginPath();
                ctx.moveTo(x, mny);
                ctx.lineTo(x, mxy);
                ctx.stroke();
                ctx.setLineDash([]);
                let text = util.formatTime(data.value);
                let newRange = [x, x+ctx.measureText(text).width+10*quality];
                if (newRange[1] > mxx) newRange = [newRange[0]-(newRange[1]-newRange[0]), newRange[1]-(newRange[1]-newRange[0])];
                let rangeY = 0;
                while (true) {
                    let any = false;
                    while (ranges.length <= rangeY) ranges.push([]);
                    for (let range of ranges[rangeY]) {
                        if (newRange[1] < range[0]) continue;
                        if (newRange[0] > range[1]) continue;
                        any = true;
                        break;
                    }
                    if (!any) break;
                    rangeY++;
                }
                ranges[rangeY].push(newRange);
                ctx.fillText(text, newRange[0]+5*quality, mny + 10*quality + 20*quality*nDiscrete + (12+5)*rangeY*quality);
            });
            if (
                (mouseX != null) &&
                (mouseDown && !mouseAlt) &&
                this.page.hasSource()
            ) this.page.source.ts = util.lerp(...graphRange, mouseX);
            if (mouseAlt) {
                if (mouseX0 == null) {
                    mouseX0 = mouseX;
                    if (mouseX0 != null) t0 = util.lerp(...graphRange, mouseX0);
                }
            } else mouseX0 = null;
            if (mouseX != null && mouseAlt) {
                let t1 = util.lerp(...graphRange, mouseX);
                let t0Value = Math.min(graphRange[1], Math.max(graphRange[0], t0));
                let t1Value = Math.min(graphRange[1], Math.max(graphRange[0], t1));
                let x0 = util.lerp(mnx, mxx, (t0Value-graphRange[0])/(graphRange[1]-graphRange[0]));
                let x1 = util.lerp(mnx, mxx, (t1Value-graphRange[0])/(graphRange[1]-graphRange[0]));
                let y = mxy-10*quality;
                ctx.strokeStyle = ctx.fillStyle = PROPERTYCACHE.get("--a");
                ctx.beginPath();
                ctx.moveTo(x0, y);
                ctx.lineTo(x1, y);
                if (t0 == t0Value) {
                    ctx.moveTo(x0, y-5*quality);
                    ctx.lineTo(x0, y+5*quality);
                }
                if (t1 == t1Value) {
                    ctx.moveTo(x1, y-5*quality);
                    ctx.lineTo(x1, y+5*quality);
                }
                ctx.stroke();
                ctx.textBaseline = "bottom";
                ctx.textAlign = "center";
                ctx.fillText("∆ "+util.formatTime(t1-t0), (x0+x1)/2, y-5*quality);
            }
            let scroll = new V(scrollX, scrollY);
            let scrollAngle = util.clampAngle(scroll.towards(0, 0)+180);
            let scrollMag = scroll.dist();
            if (scrollMag > 3) {
                if (scrollAxis == null)
                    scrollAxis = (Math.min(Math.abs(scrollAngle-90), Math.abs(scrollAngle-270)) < 45) ? "y" : "x";
                if (Math.min(Math.abs(scrollAngle-180), Math.abs(scrollAngle-270)) < 45) scrollMag *= -1;
                scrollMag *= 0.0005;
                let newGraphRange = [...graphRange];
                if (scrollAxis == "x") {
                    let shift = (newGraphRange[1]-newGraphRange[0]) * scrollMag;
                    newGraphRange = newGraphRange.map(v => v+shift);
                } else {
                    if (mouseX != null) {
                        let ts = util.lerp(...graphRange, mouseX);
                        newGraphRange = newGraphRange.map(v => util.lerp(v, ts, scrollMag));
                    }
                }
                if (newGraphRange[1]-newGraphRange[0] <= 0) newGraphRange[1] = newGraphRange[0]+0.001;
                if (newGraphRange[1]-newGraphRange[0] > maxTime-minTime) newGraphRange[1] = newGraphRange[0]+(maxTime-minTime);
                if (newGraphRange[0] < minTime) newGraphRange = newGraphRange.map(v => v+(minTime-newGraphRange[0]));
                if (newGraphRange[1] > maxTime) newGraphRange = newGraphRange.map(v => v+(maxTime-newGraphRange[1]));
                newGraphRange = newGraphRange.map(v => Math.min(maxTime, Math.max(minTime, Math.round(v*1000000)/1000000)));
                if (newGraphRange[0] <= minTime && newGraphRange[1] >= maxTime)
                    this.viewMode = "all";
                else {
                    this.viewMode = "section";
                    this.change("viewParams.start", this.viewParams.start, this.viewParams.start=newGraphRange[0]);
                    this.change("viewPrams.stop", this.viewParams.stop, this.viewParams.stop=newGraphRange[1]);
                }
            } else scrollAxis = null;
            scrollX = scrollY = 0;
        });

        if (util.is(a, "arr")) a = { lVars: a };
        else if (a instanceof PanelGraphTab.Variable) a = { lVars: [a] };

        a = util.ensure(a, "obj");
        this.lVars = a.lVars;
        this.rVars = a.rVars;
        this.viewMode = a.viewMode || "all";
        this.viewParams = a.viewParams;
    }

    compute() {
        super.compute();
        try {
            this.lVars.forEach(v => v.compute());
            this.rVars.forEach(v => v.compute());
        } catch (e) {}
    }

    get padding() { return this.#padding; }
    set padding(v) { this.#padding.set(v); }
    get paddingTop() { return this.padding.t; }
    set paddingTop(v) { this.padding.t = v; }
    get paddingBottom() { return this.padding.b; }
    set paddingBottom(v) { this.padding.b = v; }
    get paddingLeft() { return this.padding.l; }
    set paddingLeft(v) { this.padding.l = v; }
    get paddingRight() { return this.padding.r; }
    set paddingRight(v) { this.padding.r = v; }

    get axisInteriorX() { return this.#axisInteriorX; }
    set axisInteriorX(v) {
        v = !!v;
        if (this.axisInteriorX == v) return;
        this.#axisInteriorX = v;
    }
    get axisExteriorX() { return !this.axisInteriorX; }
    set axisExteriorX(v) { this.axisInteriorX = !v; }
    get axisInteriorY() { return this.#axisInteriorY; }
    set axisInteriorY(v) {
        v = !!v;
        if (this.axisInteriorY == v) return;
        this.#axisInteriorY = v;
    }
    get axisExteriorY() { return !this.axisInteriorY; }
    set axisExteriorY(v) { this.axisInteriorY = !v; }

    get lVars() { return [...this.#lVars]; }
    set lVars(v) {
        v = util.ensure(v, "arr");
        this.clearLVars();
        this.addLVar(v);
    }
    clearLVars() {
        let lVars = this.lVars;
        this.remLVar(lVars);
        return lVars;
    }
    hasLVar(lVar) {
        if (!(lVar instanceof PanelGraphTab.Variable)) return false;
        return this.#lVars.has(lVar) && lVar.tab == this;
    }
    addLVar(...lVars) {
        return util.Target.resultingForEach(lVars, lVar => {
            if (!(lVar instanceof PanelGraphTab.Variable)) return false;
            if (this.hasLVar(lVar)) return false;
            if (lVar.tab != null) return false;
            this.#lVars.add(lVar);
            lVar.addLinkedHandler(this, "remove", () => this.remLVar(lVar));
            lVar.addLinkedHandler(this, "change", (c, f, t) => this.change("lVars["+this.lVars.indexOf(lVar)+"."+c, f, t));
            if (this.hasEOptionSection("l"))
                this.getEOptionSection("l").appendChild(lVar.elem);
            this.change("addLVar", null, lVar);
            lVar.tab = this;
            lVar.onAdd();
            return lVar;
        });
    }
    remLVar(...lVars) {
        return util.Target.resultingForEach(lVars, lVar => {
            if (!(lVar instanceof PanelGraphTab.Variable)) return false;
            if (!this.hasLVar(lVar)) return false;
            if (lVar.tab != this) return false;
            lVar.onRem();
            lVar.tab = null;
            this.#lVars.delete(lVar);
            lVar.clearLinkedHandlers(this, "remove");
            lVar.clearLinkedHandlers(this, "change");
            if (this.hasEOptionSection("l"))
                this.getEOptionSection("l").removeChild(lVar.elem);
            this.change("remLVar", lVar, null);
            return lVar;
        });
    }
    get rVars() { return [...this.#rVars]; }
    set rVars(v) {
        v = util.ensure(v, "arr");
        this.clearRVars();
        this.addRVar(v);
    }
    clearRVars() {
        let rVars = this.rVars;
        this.remRVar(rVars);
        return rVars;
    }
    hasRVar(rVar) {
        if (!(rVar instanceof PanelGraphTab.Variable)) return false;
        return this.#rVars.has(rVar) && rVar.tab == this;
    }
    addRVar(...rVars) {
        return util.Target.resultingForEach(rVars, rVar => {
            if (!(rVar instanceof PanelGraphTab.Variable)) return false;
            if (this.hasRVar(rVar)) return false;
            if (rVar.tab != null) return false;
            this.#rVars.add(rVar);
            rVar.addLinkedHandler(this, "remove", () => this.remRVar(rVar));
            rVar.addLinkedHandler(this, "change", (c, f, t) => this.change("rVars["+this.rVars.indexOf(rVar)+"."+c, f, t));
            if (this.hasEOptionSection("r"))
                this.getEOptionSection("r").appendChild(rVar.elem);
            this.change("addRVar", null, rVar);
            rVar.tab = this;
            rVar.onAdd();
            return rVar;
        });
    }
    remRVar(...rVars) {
        return util.Target.resultingForEach(rVars, rVar => {
            if (!(rVar instanceof PanelGraphTab.Variable)) return false;
            if (!this.hasRVar(rVar)) return false;
            if (rVar.tab != this) return false;
            rVar.onRem();
            rVar.tab = null;
            this.#rVars.delete(rVar);
            rVar.clearLinkedHandlers(this, "remove");
            rVar.clearLinkedHandlers(this, "change");
            if (this.hasEOptionSection("r"))
                this.getEOptionSection("r").removeChild(rVar.elem);
            this.change("remRVar", rVar, null);
            return rVar;
        });
    }

    get viewMode() { return this.#viewMode; }
    set viewMode(v) {
        v = String(v);
        if (this.viewMode == v) return;
        if (!["right", "left", "section", "all"].includes(v)) return;
        this.change("viewMode", this.viewMode, this.#viewMode=v);
    }
    get viewParams() { return this.#viewParams; }
    set viewParams(v) {
        v = util.ensure(v, "obj");
        this.#viewParams = {};
        for (let k in v) {
            this.#viewParams[k] = v[k];
            this.change("viewParams."+k, null, this.viewParams[k]);
        }
    }

    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.optionState == 0) return null;
        if (data instanceof PanelBrowserTab) data = this.page.hasSource() ? this.page.source.tree.lookup(data.path) : null;
        if (!(data instanceof Source.Node)) return null;
        const idfs = {
            _: side => {
                for (let v of this[side+"Vars"]) {
                    let hovered = v.getHovered(data, pos, options);
                    if (hovered) return hovered;
                }
                return {
                    r: r,
                    round: round,
                    submit: () => {
                        const colors = "rybgpocm";
                        const addVar = node => {
                            let pth = node.path;
                            if (node.hasField() && node.field.isJustPrimitive) {
                                let taken = new Array(colors.length).fill(false);
                                [...this.lVars, ...this.rVars].forEach(v => {
                                    colors.split("").forEach((c, i) => {
                                        if (v.color == "var(--c"+c+")")
                                            taken[i] = true;
                                    });
                                });
                                let nextColor = null;
                                taken.forEach((v, i) => {
                                    if (v) return;
                                    if (nextColor != null) return;
                                    nextColor = colors[i];
                                });
                                if (nextColor == null) nextColor = colors[(this.lVars.length+this.rVars.length)%colors.length];
                                this["add"+side.toUpperCase()+"Var"](new PanelGraphTab.Variable({
                                    path: pth,
                                    color: "var(--c"+nextColor+")",
                                }));
                            }
                            node.nodeObjects.forEach(node => addVar(node));
                        };
                        addVar(data);
                    },
                };
            },
            l: () => idfs._("l"),
            r: () => idfs._("r"),
        };
        let r, round;
        r = this.eOptions.getBoundingClientRect();
        round = true;
        if (
            pos.x >= r.left && pos.x <= r.right &&
            pos.y >= r.top && pos.y <= r.bottom
        ) {
            for (let i = 0; i < this.eOptionSections.length; i++) {
                let id = this.eOptionSections[i];
                let elem = this.getEOptionSection(id);
                r = elem.getBoundingClientRect();
                if (pos.x < r.left || pos.x > r.right) continue;
                if (pos.y < r.top || pos.y > r.bottom) continue;
                if (elem.id in idfs) {
                    let data = idfs[elem.id]();
                    if (util.is(data, "obj")) return data;
                }
            }
            return null;
        }
        r = this.elem.getBoundingClientRect();
        round = false;
        if (
            pos.x >= r.left && pos.x <= r.right &&
            pos.y >= r.top && pos.y <= r.bottom
        ) return idfs.l();
        return null;
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            lVars: this.lVars,
            rVars: this.rVars,
            viewMode: this.viewMode,
            viewParams: this.viewParams,
            optionState: this.optionState,
        });
    }
}
PanelGraphTab.Variable = class PanelGraphTabVariable extends util.Target {
    #tab;
    #parent;

    #path;
    #shown;
    #color;
    #ghost;

    #shownHook;
    #ghostHook;

    #expr;
    #exprCompiled;
    #fExpr;

    #elem;
    #eDisplay;
    #eShowBox;
    #eShow;
    #eShowDisplay;
    #eDisplayName;
    #eRemoveBtn;
    #eContent;
    #eColorPicker;
    #eColorPickerColors;
    #eGhostBtn;

    constructor(a) {
        super();

        this.#tab = null;
        this.#parent = null;

        this.#path = "";
        this.#shown = null;
        this.#color = "var(--v8)";
        this.#ghost = null;

        const form = new core.Form();
        form.isHorizontal = true;

        this.#shownHook = new PanelToolCanvasTab.Hook("Visibility Hook", null);
        this.shownHook.toggle.show();
        this.shownHook.addHandler("change", (c, f, t) => this.change("shownHook."+c, f, t));
        this.#ghostHook = new PanelToolCanvasTab.Hook("Ghost Hook", null);
        this.ghostHook.toggle.show();
        this.ghostHook.addHandler("change", (c, f, t) => this.change("ghostHook."+c, f, t));

        const hooksSubformField = form.addField(new core.Form.SubForm("hooks"));
        const hooksSubform = hooksSubformField.form;
        hooksSubform.addField(
            new core.Form.HTML("visibility-hook", this.shownHook.elem),
            new core.Form.HTML("ghost-hook", this.ghostHook.elem),
        );

        this.#expr = null;
        this.#exprCompiled = null;
        this.#fExpr = form.addField(new core.Form.TextInput("expression"));
        this.fExpr.type = "";
        this.fExpr.addHandler("change-value", () => {
            const value = this.fExpr.value;
            this.expr = (value.length > 0) ? value : null;
        });

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eDisplay = document.createElement("button");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eShowBox = document.createElement("label");
        this.eDisplay.appendChild(this.eShowBox);
        this.eShowBox.classList.add("checkbox");
        this.eShowBox.style.setProperty("--size", "10px");
        this.eShowBox.innerHTML = "<input type='checkbox'><span></span>";
        this.#eShow = this.eShowBox.children[0];
        this.#eShowDisplay = this.eShowBox.children[1];
        this.#eDisplayName = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayName);
        this.eDisplayName.classList.add("name");
        this.#eRemoveBtn = document.createElement("button");
        this.eDisplay.appendChild(this.eRemoveBtn);
        this.eRemoveBtn.classList.add("icon");
        this.eRemoveBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eColorPicker = document.createElement("div");
        this.eContent.appendChild(this.eColorPicker);
        this.eColorPicker.classList.add("colorpicker");
        this.#eColorPickerColors = [];
        lib.COLORS.forEach(colors => {
            let btn = document.createElement("button");
            this.eColorPicker.appendChild(btn);
            this.#eColorPickerColors.push(btn);
            btn.classList.add("color");
            btn.color = "var(--"+colors._+")";
            btn.style.setProperty("--bg", "var(--"+colors._+")");
            btn.style.setProperty("--bgh", "var(--"+colors.h+")");
            btn.style.setProperty("--bgd", "var(--"+colors.d+")");
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.color = btn.color;
            });
        });
        this.#eGhostBtn = document.createElement("button");
        this.eColorPicker.appendChild(this.eGhostBtn);
        this.eGhostBtn.textContent = "Ghost";
        this.eGhostBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.ghost = !this.ghost;
        });

        this.eContent.appendChild(form.elem);

        this.eDisplay.addEventListener("contextmenu", e => {
            let itm;
            let menu = new core.Menu();
            itm = menu.addItem(new core.Menu.Item(this.isOpen ? "Close" : "Open"));
            itm.addHandler("trigger", e => {
                this.isOpen = !this.isOpen;
            });
            itm = menu.addItem(new core.Menu.Item(this.shown ? "Hide" : "Show"));
            itm.addHandler("trigger", e => {
                this.shown = !this.shown;
            });
            itm = menu.addItem(new core.Menu.Item("Remove"));
            itm.addHandler("trigger", e => {
                this.eRemoveBtn.click();
            });
            menu.addItem(new core.Menu.Divider());
            itm = menu.addItem(new core.Menu.Item("Colors"));
            let submenu = itm.menu;
            lib.COLORS.forEach(colors => {
                itm = submenu.addItem(new core.Menu.Item(colors.name));
                itm.eLabel.style.color = "var(--"+colors._+")";
                itm.addHandler("trigger", e => {
                    this.color = "var(--"+colors._+")";
                });
            });
            core.Menu.contextMenu = menu;
            core.Menu.placeContextMenu(e.pageX, e.pageY);
        });

        this.eShowBox.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.eShow.addEventListener("change", e => {
            this.shown = this.eShow.checked;
        });
        this.eRemoveBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove");
        });
        this.eDisplay.addEventListener("click", e => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
        });

        if (util.is(a, "str")) a = { path: a };

        a = util.ensure(a, "obj");
        this.path = a.path;
        this.shown = util.ensure(a.shown, "bool", true);
        this.color = a.color;
        this.ghost = a.ghost;
        this.shownHook = a.shownHook;
        this.ghostHook = a.ghostHook;
        this.expr = a.expr;
    }

    get tab() { return this.#tab; }
    set tab(v) {
        v = (v instanceof PanelGraphTab) ? v : null;
        if (this.tab == v) return;
        this.#tab = v;
        this.compute();
    }
    hasTab() { return !!this.tab; }
    get parent() { return this.#parent; }
    hasParent() { return !!this.parent; }
    compute() {
        this.#parent = this.hasTab() ? this.tab.parent : null;
    }
    get app() { return app.App.instance; }
    get page() { return this.app.projectPage; }

    get path() { return this.#path; }
    set path(v) {
        v = util.generatePath(v);
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
        this.eDisplayName.textContent = this.path;
    }
    get shown() { return this.#shown; }
    set shown(v) {
        v = !!v;
        if (this.shown == v) return;
        this.change("shown", this.shown, this.#shown=v);
        this.eShow.checked = this.shown;
    }
    get hidden() { return !this.shown; }
    set hidden(v) { this.shown = !v; }
    show() { return this.shown = true; }
    hide() { return this.hidden = true; }
    get color() { return this.#color; }
    set color(v) {
        v = String(v);
        if (this.color == v) return;
        this.change("color", this.color, this.#color=v);
        const color = (this.color.startsWith("var(") && this.color.endsWith(")")) ? PROPERTYCACHE.get(this.color.slice(4, -1)) : this.color;
        this.eShowBox.style.setProperty("--bgc", color);
        this.eShowBox.style.setProperty("--bgch", color);
        this.eDisplayName.style.color = color;
        this.eColorPickerColors.forEach(btn => {
            if (btn.color == this.color)
                btn.classList.add("this");
            else btn.classList.remove("this");
        });
    }
    get ghost() { return this.#ghost; }
    set ghost(v) {
        v = !!v;
        if (this.ghost == v) return;
        this.change("ghost", this.ghost, this.#ghost=v);
        if (this.ghost)
            this.eGhostBtn.classList.add("this");
        else this.eGhostBtn.classList.remove("this");
    }

    get hooks() { return [this.shownHook, this.ghostHook]; }
    get shownHook() { return this.#shownHook; }
    set shownHook(o) { this.shownHook.from(o); }
    get isShown() {
        if (!this.shown) return false;
        if (this.shownHook.value == null) return true;
        if (this.shownHook.toggle.value)
            return !this.shownHook.value;
        return this.shownHook.value;
    }
    get ghostHook() { return this.#ghostHook; }
    set ghostHook(o) { this.ghostHook.from(o); }
    get isGhost() {
        if (this.ghost) return true;
        if (this.ghostHook.value == null) return false;
        if (this.ghostHook.toggle.value)
            return !this.ghostHook.value;
        return this.ghostHook.value;
    }

    get expr() { return this.#expr; }
    set expr(v) {
        v = (v == null) ? null : String(v);
        if (this.expr == v) return;
        this.change("expr", this.expr, this.#expr=v);
        this.fExpr.value = this.hasExpr() ? this.expr : "";
        this.compileExpr();
    }
    hasExpr() { return this.expr != null; }
    get exprCompiled() { return this.#exprCompiled; }
    compileExpr() {
        if (!this.hasExpr()) return this.#exprCompiled = null;
        return this.#exprCompiled = lib.mathjs.compile(this.expr);
    }
    execExpr(x) {
        if (!this.hasExpr()) return x;
        if (!this.#exprCompiled) return x;
        return this.exprCompiled.evaluate({ x: x });
    }
    get fExpr() { return this.#fExpr; }
    
    getHovered(data, pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        if (this.isClosed) return null;
        if (data instanceof PanelBrowserTab) data = this.page.hasSource() ? this.page.source.tree.lookup(data.path) : null;
        if (!(data instanceof Source.Node)) return null;
        if (!data.hasField()) return null;
        if (!data.field.isJustPrimitive) return null;
        for (let hook of this.hooks) {
            let r = hook.eBox.getBoundingClientRect();
            if (pos.x < r.left || pos.x > r.right) continue;
            if (pos.y < r.top || pos.y > r.bottom) continue;
            return {
                r: r,
                round: true,
                submit: () => {
                    hook.path = data.path;
                },
            };
        }
        return null;
    }

    get elem() { return this.#elem; }
    get eDisplay() { return this.#eDisplay; }
    get eShowBox() { return this.#eShowBox; }
    get eShow() { return this.#eShow; }
    get eShowDisplay() { return this.#eShowDisplay; }
    get eDisplayName() { return this.#eDisplayName; }
    get eRemoveBtn() { return this.#eRemoveBtn; }
    get eContent() { return this.#eContent; }
    get eColorPicker() { return this.#eColorPicker; }
    get eColorPickerColors() { return [...this.#eColorPickerColors]; }
    get eGhostBtn() { return this.#eGhostBtn; }

    get isOpen() { return this.elem.classList.contains("open"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        if (v) this.elem.classList.add("open");
        else this.elem.classList.remove("open");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get disabled() { return this.elem.classList.contains("disabled"); }
    set disabled(v) {
        v = !!v;
        if (this.disabled == v) return;
        if (v) this.elem.classList.add("disabled");
        else this.elem.classList.remove("disabled");
    }
    get enabled() { return !this.enabled; }
    set enabled(v) { this.disabled = !v; }
    disable() { return this.disabled = true; }
    enable() { return this.enabled = true; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            path: this.path,
            shown: this.shown,
            color: this.color,
            ghost: this.ghost,
            shownHook: this.shownHook.to(),
            ghostHook: this.ghostHook.to(),
            expr: this.expr,
        });
    }
};
