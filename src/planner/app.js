import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";

import * as sublib from "./lib.mjs";


core.GLOBALSTATE.addProperty(new core.GlobalState.Property(
    "subtemplates",
    async () => {
        let content = "";
        try {
            content = await window.api.fileRead("templates.json");
        } catch (e) {}
        try {
            return JSON.parse(content);
        } catch (e) {}
        return {};
    },
));


class RLabel extends core.Odometry2d.Render {
    #item;

    #text;

    constructor(odometry, item) {
        super(odometry);

        this.z2 = 2;

        this.#item = null;

        this.#text = "";
        
        this.item = item;

        this.addHandler("render", () => {
            if (this.hasItem()) this.pos = this.item.pos;
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            ctx.font = (12*quality)+"px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = core.PROPERTYCACHE.get("--cg-8");
            const width = ctx.measureText(this.text).width/quality;
            ctx.beginPath();
            let path = [
                [0, 0],
                [+5, 5],
                [+width/2+5, 5],
                [+width/2+5, 25],
                [-width/2-5, 25],
                [-width/2-5, 5],
                [-5, 5],
            ];
            let offset = [0, 5];
            for (let i = 0; i <= path.length; i++) {
                let j = i%path.length;
                let p = this.odometry.worldToCanvas(this.pos).add(new V(path[j]).add(offset).mul(+1,-1).mul(quality));
                if (i > 0) ctx.lineTo(...p.xy);
                else ctx.moveTo(...p.xy);
            }
            ctx.fill();
            ctx.fillStyle = core.PROPERTYCACHE.get("--v8");
            let p = this.odometry.worldToCanvas(this.pos).add(new V(0,15).add(offset).mul(+1,-1).mul(quality));
            ctx.fillText(this.text, ...p.xy);
        });
    }

    get item() { return this.#item; }
    set item(v) {
        v = (v instanceof sublib.Project.Item) ? v : null;
        if (this.item == v) return;
        this.#item = v;
    }
    hasItem() { return !!this.item; }

    get text() { return this.#text; }
    set text(v) { this.#text = String(v); }
}
class RLine extends core.Odometry2d.Render {
    #itemA; #itemB;

    constructor(odometry, itemA, itemB) {
        super(odometry);

        this.z2 = 1;

        this.#itemA = null;
        this.#itemB = null;

        let a = new V(), b = new V();

        this.addHandler("render", () => {
            if (this.hasItemA()) a.set(this.itemA.pos);
            if (this.hasItemB()) b.set(this.itemB.pos);
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            if (a.distSquared(b) < this.odometry.pageLenToWorld((7.5+5)*2)**2) return;
            ctx.strokeStyle = core.PROPERTYCACHE.get("--cg-8");
            ctx.lineWidth = 5*quality;
            ctx.beginPath();
            ctx.moveTo(...this.odometry.worldToCanvas(a.add(V.dir(a.towards(b), this.odometry.pageLenToWorld(7.5+5)))).xy);
            ctx.lineTo(...this.odometry.worldToCanvas(b.add(V.dir(b.towards(a), this.odometry.pageLenToWorld(7.5+5)))).xy);
            ctx.stroke();
        });

        this.itemA = itemA;
        this.itemB = itemB;
    }

    get itemA() { return this.#itemA; }
    set itemA(v) {
        v = (v instanceof sublib.Project.Item) ? v : null;
        if (this.item == v) return;
        this.#itemA = v;
    }
    hasItemA() { return !!this.itemA; }
    get itemB() { return this.#itemB; }
    set itemB(v) {
        v = (v instanceof sublib.Project.Item) ? v : null;
        if (this.item == v) return;
        this.#itemB = v;
    }
    hasItemB() { return !!this.itemB; }
}
class RVisual extends core.Odometry2d.Render {
    #dt;
    #nodes;

    constructor(odometry, dt, nodes) {
        super(odometry);

        this.z2 = -2;

        this.#dt = 0;
        this.#nodes = [];

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            const colors = {
                g: core.PROPERTYCACHE.getColor("--cg"),
                y: core.PROPERTYCACHE.getColor("--cy"),
                r: core.PROPERTYCACHE.getColor("--cr"),
            };
            const thresh1 = 0, thresh2 = 500;
            const getColor = v => {
                const ks = Object.keys(colors);
                if (v < thresh1) return colors[ks.at(0)];
                if (v >= thresh2) return colors[ks.at(-1)];
                for (let i = 0; i+1 < ks.length; i++) {
                    let j = i+1;
                    let ki = ks[i], kj = ks[j];
                    let p = (v-thresh1)/(thresh2-thresh1);
                    let pi = i / (ks.length-1), pj = j / (ks.length-1);
                    if (p < pi) continue;
                    if (p >= pj) continue;
                    p = (p-pi)/(pj-pi);
                    return util.lerp(colors[ki], colors[kj], p);
                }
                return colors[ks[0]];
            };
            let nj, pj, vj, cj;
            for (let i = 0; i < this.#nodes.length; i++) {
                let ni = this.#nodes[i];
                if (i > 0 && nj.pos.distSquared(ni.pos) < 1) continue;
                let pi = this.odometry.worldToCanvas(ni.pos);
                let vi = ni.velocity.dist();
                let ci = getColor(vi);
                if (i <= 0) {
                    [nj, pj, vj, cj] = [ni, pi, vi, ci];
                    continue;
                }
                if (pj.distSquared(pi) > 10**2) {
                    let grad = ctx.createLinearGradient(...pj.xy, ...pi.xy);
                    grad.addColorStop(0, cj.toRGBA());
                    grad.addColorStop(1, ci.toRGBA());
                    ctx.strokeStyle = grad;
                } else ctx.strokeStyle = ci.toRGBA();
                ctx.lineWidth = 2*quality;
                ctx.beginPath();
                ctx.moveTo(...pj.xy);
                ctx.lineTo(...pi.xy);
                ctx.stroke();
                [nj, pj, vj, cj] = [ni, pi, vi, ci];
            }
        });

        this.dt = dt;
        this.nodes = nodes;
    }

    get dt() { return this.#dt; }
    set dt(v) {
        v = Math.max(0, util.ensure(v, "num"));
        if (this.dt == v) return;
        this.#dt = v;
    }

    get nodes() { return [...this.#nodes]; }
    set nodes(v) {
        v = util.ensure(v, "arr");
        this.#nodes = v.map(v => new sublib.Project.Node(v));
    }
}
class RVisualItem2d extends core.Odometry2d.Robot {
    #visual;
    #interp;

    constructor(odometry, visual) {
        super(odometry, 0, "Path Playback");

        this.z2 = -1;

        this.#visual = null;
        this.#interp = 0;

        this.addHandler("render", () => {
            if (!this.hasVisual()) return;
            let p = this.interp;
            let nodes = this.visual.nodes;
            if (nodes.length <= 0) {
                this.pos = 0;
                this.velocity = 0;
                this.heading = 0;
                return;
            }
            let node;
            if (nodes.length > 1) {
                let i = Math.floor((nodes.length-1)*p);
                let j = Math.min(i+1, nodes.length-1);
                let ni = nodes[i], nj = nodes[j];
                p = ((nodes.length-1)*p) - i;
                node = new sublib.Project.Node(
                    util.lerp(ni.pos, nj.pos, p),
                    ni.heading + util.angleRelRadians(ni.heading, nj.heading)*p, true,
                    util.lerp(ni.velocity, nj.velocity),
                    0, true,
                );
            } else node = nodes[0];
            this.pos = node.pos;
            this.velocity = node.velocity;
            this.heading = node.heading * (180/Math.PI);
        });

        this.visual = visual;
    }

    get visual() { return this.#visual; }
    set visual(v) {
        v = (v instanceof RVisual) ? v : null;
        if (this.visual == v) return;
        this.#visual = v;
    }
    hasVisual() { return !!this.visual; }

    get interp() { return this.#interp; }
    set interp(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.interp == v) return;
        this.#interp = v;
    }
}
class RVisualItem3d extends core.Odometry3d.Render {
    #visual;
    #interp;

    constructor(odometry, visual) {
        super(odometry, 0, 0, "KitBot");

        this.#visual = null;
        this.#interp = 0;

        this.addHandler("update", delta => {
            if (!this.hasVisual()) return;
            let p = this.interp;
            let nodes = this.visual.nodes;
            if (nodes.length <= 0) {
                this.pos = 0;
                return;
            }
            let node;
            if (nodes.length > 1) {
                let i = Math.floor((nodes.length-1)*p);
                let j = Math.min(i+1, nodes.length-1);
                let ni = nodes[i], nj = nodes[j];
                p = ((nodes.length-1)*p) - i;
                node = new sublib.Project.Node(
                    util.lerp(ni.pos, nj.pos, p),
                    ni.heading + util.angleRelRadians(ni.heading, nj.heading)*p, true,
                    util.lerp(ni.velocity, nj.velocity),
                    0, true,
                );
            } else node = nodes[0];
            this.pos = node.pos.div(100);
            this.q = [Math.cos(node.heading/2), 0, 0, Math.sin(node.heading/2)];
        });

        this.visual = visual;
    }

    get visual() { return this.#visual; }
    set visual(v) {
        v = (v instanceof RVisual) ? v : null;
        if (this.visual == v) return;
        this.#visual = v;
    }
    hasVisual() { return !!this.visual; }

    get interp() { return this.#interp; }
    set interp(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.interp == v) return;
        this.#interp = v;
    }
}
class RSelect extends core.Odometry2d.Render {
    #a; #b;

    constructor(odometry) {
        super(odometry);

        this.z2 = 3;

        this.#a = new V();
        this.#b = new V();

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            ctx.strokeStyle = core.PROPERTYCACHE.get("--v8");
            ctx.lineWidth = 1*quality;
            let a = this.odometry.worldToCanvas(this.a);
            let b = this.odometry.worldToCanvas(this.b);
            ctx.strokeRect(
                Math.min(a.x, b.x),
                Math.min(a.y, b.y),
                Math.max(a.x, b.x)-Math.min(a.x, b.x),
                Math.max(a.y, b.y)-Math.min(a.y, b.y),
            );
        });
    }

    get a() { return this.#a; }
    set a(v) { this.a.set(v); }
    get aX() { return this.a.x; }
    set aX(v) { this.a.x = v; }
    get aY() { return this.a.y; }
    set aY(v) { this.a.y = v; }
    get b() { return this.#b; }
    set b(v) { this.b.set(v); }
    get bX() { return this.b.x; }
    set bX(v) { this.b.x = v; }
    get bY() { return this.b.y; }
    set bY(v) { this.b.y = v; }
}
class RSelectable extends core.Odometry2d.Render {
    #item;
    #renderObject;

    constructor(odometry, item) {
        super(odometry);

        this.#item = null;
        this.#renderObject = null;

        let type = null;
        this.addHandler("change-item", () => {
            this.renderObject = null;
            if (!this.hasItem()) return;
            type = (this.item instanceof sublib.Project.Node) ? "node" : (this.item instanceof sublib.Project.Obstacle) ? "obstacle" : null;
            if (type == "node") {
                this.renderObject = new core.Odometry2d.Robot(this, 0, "Waypoint");
            } else if (type == "obstacle") {
                this.renderObject = new core.Odometry2d.Obstacle(this);
            }
        });

        this.addHandler("render", () => {
            if (!this.hasItem()) return;
            if (!this.hasRenderObject()) return;
            const render = this.renderObject;
            render.pos = this.item.pos;
            if (type == "node") {
                render.velocity = this.item.velocity;
                render.showVelocity = this.item.useVelocity;
                render.heading = this.item.heading * (180/Math.PI);
                render.type = this.item.type;
                render.color = this.item.color;
                render.alpha = this.item.ghost ? 0.5 : 1;
            } else if (type == "obstacle") {
                render.radius = this.item.radius;
                render.alpha = this.item.disabled ? 0.5 : 1;
            }
        });

        this.item = item;
    }

    get ghost() { return this.alpha < 0.75; }
    set ghost(v) { this.alpha = v ? 0.5 : 1; }

    get item() { return this.#item; }
    set item(v) {
        v = (v instanceof sublib.Project.Item) ? v : null;
        if (this.item == v) return;
        this.change("item", this.item, this.#item=v);
    }
    hasItem() { return !!this.item; }
    get renderObject() { return this.#renderObject; }
    set renderObject(v) {
        v = (v instanceof core.Odometry2d.Render) ? v : null;
        if (this.renderObject == v) return;
        if (this.hasRenderObject())
            this.remRender(this.renderObject);
        this.#renderObject = v;
        if (this.hasRenderObject())
            if (!this.addRender(this.renderObject))
                this.renderObject = null;
    }
    hasRenderObject() { return !!this.renderObject; }

    get selected() { return this.hasRenderObject() ? this.renderObject.selected : false; }
    set selected(v) { if (this.hasRenderObject()) this.renderObject.selected = v; }

    hover(part) {
        part = String(part);
        if (!this.hasItem()) return "";
        if (part == "main") return "move";
        if (this.item instanceof sublib.Project.Node) {
            let partfs = {
                velocity: "grab",
                heading: "grab",
            };
            if (part in partfs) return partfs[part];
        } else if (this.item instanceof sublib.Project.Obstacle) {
            let partfs = {
                radius: "grab",
            };
            if (part in partfs) return partfs[part];
        }
        return "";
    }
    drag(part, pos) {
        part = String(part);
        pos = new V(pos);
        if (!this.hasItem()) return "";
        if (this.item instanceof sublib.Project.Node) {
            let partfs = {
                velocity: () => {
                    this.item.velocity = pos.sub(this.item.pos);
                },
                heading: () => {
                    this.item.heading = (Math.PI/180) * this.item.pos.towards(pos);
                },
            };
            if (part in partfs) partfs[part]();
        } else if (this.item instanceof sublib.Project.Obstacle) {
            let partfs = {
                radius: () => {
                    this.item.radius = this.item.pos.dist(pos);
                    this.renderObject.dir = this.item.pos.towards(pos);
                },
            };
            if (part in partfs) partfs[part]();
        }
    }
}

export default class App extends core.AppFeature {
    static ICON = "analytics";
    static PROJECTCLASS = sublib.Project;
    static REVIVER = sublib.REVIVER;

    constructor() {
        super();

        this.addHandler("pre-post-setup", () => {
            ["file", "edit", "view"].forEach(name => {
                let id = "menu:"+name;
                let menu = this.menu.getItemById(id);
                let namefs = {
                    file: () => {
                        let itms = [
                            { id: "addnode", label: "Add Node" },
                            { id: "addobstacle", label: "Add Obstacle" },
                            { id: "addpath", label: "Add Path" },
                            "separator",
                        ];
                        itms.forEach((data, i) => {
                            let itm = App.Menu.Item.fromObj(data);
                            if (util.is(data, "obj")) {
                                if (!("click" in data)) data.click = () => this.post("cmd-"+data.id);
                                itm.addHandler("trigger", e => data.click());
                            }
                            menu.menu.insertItem(itm, 5+i);
                        });
                    },
                    view: () => {
                        let itms = [
                            { id: "maxmin", label: "Toggle Maximized", accelerator: "Ctrl+F" },
                            { id: "resetdivider", label: "Reset Divider" },
                            "separator",
                        ];
                        itms.forEach((data, i) => {
                            let itm = App.Menu.Item.fromObj(data);
                            if (util.is(data, "obj")) {
                                if (!("click" in data)) data.click = () => this.post("cmd-"+data.id);
                                itm.addHandler("trigger", e => data.click());
                            }
                            menu.menu.insertItem(itm, 0+i);
                        });
                    },
                };
                if (name in namefs) namefs[name]();
            });
        });
    }
}
App.TitlePage = class AppTitlePage extends App.TitlePage {
    static DESCRIPTION = "The tool for planning trajectories";
};
App.ProjectsPage = class AppProjectsPage extends App.ProjectsPage {
    #eTemplates;

    constructor(app) {
        super(app);

        this.#eTemplates = document.createElement("div");
        this.eSubNav.appendChild(this.eTemplates);
        this.eTemplates.classList.add("templates");

        this.addHandler("refresh", async () => {
            const templates = core.GLOBALSTATE.getProperty("templates").value;
            this.eTemplates.innerHTML = "";
            for (let name in templates) {
                let btn = document.createElement("button");
                this.eTemplates.appendChild(btn);
                btn.classList.add("normal");
                btn.textContent = name;
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    this.app.setPage("PROJECT", { template: name });
                });
            }
            let btn = document.createElement("button");
            this.eTemplates.appendChild(btn);
            btn.classList.add("normal");
            btn.textContent = "Blank Project";
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this.app.setPage("PROJECT", { template: null });
            });
        });
    }

    get eTemplates() { return this.#eTemplates; }
};
App.ProjectPage = class AppProjectPage extends App.ProjectPage {
    #odometry2d;
    #odometry3d;

    #selected;
    #selectedPath;

    #choosing;
    #chooseState;

    #displayPath;
    #displayPathIndices;
    #displayPathLines;

    #panels;
    #panel;
    #objectsPanel;
    #pathsPanel;
    #optionsPanel;

    #eDisplay;
    #eBlockage;
    #eMaxMinBtn;
    #eChooseNav;
    #eChooseDoneBtn;
    #eChooseCancelBtn;
    #eEdit;
    #eEditContent;
    #eEditNav;
    #eDivider;

    constructor(app) {
        super(app);

        this.app.eProjectInfoNameInput.addEventListener("change", e => {
            if (this.choosing) return;
            if (!this.hasProject()) return;
            this.project.meta.name = this.app.eProjectInfoNameInput.value;
            this.editorRefresh();
        });
        const cmdAdd = name => {
            if (this.app.dragging) return;
            name = String(name);
            if (this.choosing) return;
            if (!this.hasProject()) return;
            this.app.dragData = name;
            this.app.dragging = true;
            this.app.eDrag.innerHTML = {
                node: "<div class='global item selectable node'><div class='button'></div></div>",
                obstacle: "<div class='global item selectable obstacle'><div class='button'></div><div class='radius'></div><div class='button radiusdrag'></div></div>"
            }[this.app.dragData];
            let prevOverRender = false;
            let ghostItem = null;
            let item = {
                node: new sublib.Project.Node({ pos: 0, heading: 0, useHeading: true, velocity: 0, velocityRot: 0, useVelocity: false }),
                obstacle: new sublib.Project.Obstacle({ pos: 0, radius: 100 }),
            }[this.app.dragData];
            this.app.dragState.addHandler("move", e => {
                let pos = new V(e.pageX, e.pageY);
                let r;
                r = this.odometry2d.canvas.getBoundingClientRect();
                let overRender = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                if (prevOverRender != overRender) {
                    prevOverRender = overRender;
                    if (overRender) {
                        ghostItem = this.odometry2d.render.addRender(new RSelectable(this.odometry2d.render, item));
                        ghostItem.ghost = true;
                    } else {
                        this.odometry2d.render.remRender(ghostItem);
                        ghostItem = null;
                    }
                }
                if (this.app.eDrag.children[0])
                    this.app.eDrag.children[0].style.visibility = overRender ? "hidden" : "inherit";
                if (ghostItem && ghostItem.hasItem())
                    ghostItem.item.pos.set(this.odometry2d.pageToWorld(pos));
                const panel = this.objectsPanel;
                r = panel.eSpawnDelete.getBoundingClientRect();
                let over = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                if (over) panel.eSpawnDelete.classList.add("hover");
                else panel.eSpawnDelete.classList.remove("hover");
            });
            const stop = cancel => {
                this.odometry2d.render.remRender(ghostItem);
                this.app.eDrag.innerHTML = "";
                if (!cancel && prevOverRender && this.hasProject()) this.project.addItem(item);
                const panel = this.objectsPanel;
                panel.eSpawnBox.classList.remove("delete");
            };
            this.app.dragState.addHandler("submit", () => stop(false));
            this.app.dragState.addHandler("cancel", () => stop(true));
            const panel = this.objectsPanel;
            panel.eSpawnBox.classList.add("delete");
        };
        this.app.addHandler("cmd-addnode", () => cmdAdd("node"));
        this.app.addHandler("cmd-addobstacle", () => cmdAdd("obstacle"));
        this.app.addHandler("cmd-addpath", () => {
            if (this.choosing) return;
            if (!this.hasProject()) return;
            this.choosing = true;
            this.displayPath = new sublib.Project.Path();
            this.chooseState.addHandler("choose", (itm, shift) => {
                if (!this.hasDisplayPath()) return;
                let path = this.displayPath;
                shift = !!shift;
                if (!(itm instanceof sublib.Project.Node)) return;
                if (shift) path.remNode(itm);
                else path.addNode(itm);
            });
            this.chooseState.addHandler("done", () => {
                if (!this.hasDisplayPath()) return;
                let path = this.displayPath;
                if (!this.hasProject()) return;
                this.project.addPath(path);
            });
            this.chooseState.addHandler("cancel", () => {
            });
        });
        this.app.addHandler("cmd-maxmin", () => {
            if (!this.hasProject()) return;
            this.project.maximized = !this.project.maximized;
        });
        this.app.addHandler("cmd-resetdivider", () => {
            if (!this.hasProject()) return;
            this.project.sidePos = null;
        });

        this.#selected = new Set();
        this.#selectedPath = null;

        this.#choosing = false;
        this.#chooseState = null;

        this.#displayPath = null;
        this.#displayPathIndices = true;
        this.#displayPathLines = true;

        this.#panels = {};
        this.#panel = null;

        this.#eDisplay = document.createElement("div");
        this.eMain.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");

        this.#eBlockage = document.createElement("div");
        this.eDisplay.appendChild(this.eBlockage);
        this.eBlockage.classList.add("blockage");

        const odometryKeyDown = e => {
            if (this.choosing) return;
            if (!this.hasProject()) return;
            if (["Backspace", "Delete"].includes(e.code)) {
                this.selected.forEach(id => this.project.remItem(id));
            } else if (e.code == "KeyA") {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.selected = this.project.items;
                }
            } else if (e.code == "KeyX") {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.cut();
                }
            } else if (e.code == "KeyC") {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.copy();
                }
            } else if (e.code == "KeyV") {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.paste();
                }
            }
        };
        const odometryContextMenu = e => {
            if (this.choosing) return;
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item("Add Node", "add"));
            itm.addHandler("trigger", e => {
                this.app.post("cmd-addnode");
            });
            itm = menu.addItem(new core.App.Menu.Item("Add Obstacle", "add"));
            itm.addHandler("trigger", e => {
                this.app.post("cmd-addobstacle");
            });
            itm = menu.addItem(new core.App.Menu.Item("Add Path", "add"));
            itm.addHandler("trigger", e => {
                this.app.post("cmd-addpath");
            });
            menu.addItem(new core.App.Menu.Divider());
            itm = menu.addItem(new core.App.Menu.Item("Cut"));
            itm.accelerator = "CmdOrCtrl+X";
            itm.addHandler("trigger", e => {
                if (this.choosing) return;
                this.cut();
            });
            itm = menu.addItem(new core.App.Menu.Item("Copy"));
            itm.accelerator = "CmdOrCtrl+C";
            itm.addHandler("trigger", e => {
                if (this.choosing) return;
                this.copy();
            });
            itm = menu.addItem(new core.App.Menu.Item("Paste"));
            itm.accelerator = "CmdOrCtrl+V";
            itm.addHandler("trigger", e => {
                if (this.choosing) return;
                this.paste();
            });
            itm = menu.addItem(new core.App.Menu.Item("Select All"));
            itm.accelerator = "CmdOrCtrl+A";
            itm.addHandler("trigger", e => {
                if (this.choosing) return;
                if (!this.hasProject()) return;
                this.selected = this.project.items;
            });
            menu.addItem(new core.App.Menu.Divider());
            itm = menu.addItem(new core.App.Menu.Item("Edit"));
            itm.addHandler("trigger", e => {
                this.panel = "objects";
            });
            itm = menu.addItem(new core.App.Menu.Item("Delete"));
            itm.addHandler("trigger", e => {
                if (this.choosing) return;
                if (!this.hasProject()) return;
                this.selected.forEach(id => this.project.remItem(id));
            });
            this.app.contextMenu = menu;
            this.app.placeContextMenu(e.pageX, e.pageY);
        };

        let cursorOverride = false;

        this.#odometry2d = new core.Odometry2d();
        this.eDisplay.appendChild(this.odometry2d.elem);
        this.odometry2d.elem.classList.add("this");
        this.odometry2d.canvas.tabIndex = 1;
        this.odometry2d.canvas.addEventListener("keydown", odometryKeyDown);
        this.odometry2d.canvas.addEventListener("contextmenu", odometryContextMenu);
        this.odometry2d.canvas.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.stopPropagation();
            const hovered = this.odometry2d.hovered;
            const hoveredPart = this.odometry2d.hoveredPart;
            if (this.choosing) {
                if (!(hovered instanceof core.Odometry2d.Render)) return;
                if (!(hovered.parent instanceof RSelectable)) return;
                this.chooseState.post("choose", hovered.parent.item, !!e.shiftKey);
                return;
            }
            if (!(hovered instanceof core.Odometry2d.Render && hovered.parent instanceof RSelectable)) {
                this.clearSelected();
                let selectItem = this.odometry2d.render.addRender(new RSelect(this.odometry2d.render));
                selectItem.a = this.odometry2d.pageToWorld(e.pageX, e.pageY);
                selectItem.b = selectItem.a;
                const mouseup = () => {
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                    this.odometry2d.render.remRender(selectItem);
                    let a = selectItem.a, b = selectItem.b;
                    let r = new util.Rect(a, b.sub(a)).normalize();
                    if (!this.hasProject()) return;
                    this.project.items.forEach(id => {
                        let itm = this.project.getItem(id);
                        if (r.collides(itm.getBBox())) this.addSelected(itm);
                    });
                };
                const mousemove = e => {
                    selectItem.b = this.odometry2d.pageToWorld(e.pageX, e.pageY);
                };
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
            } else {
                if (hoveredPart != null && hoveredPart != "main") {
                    const mouseup = () => {
                        document.body.removeEventListener("mouseup", mouseup);
                        document.body.removeEventListener("mousemove", mousemove);
                        cursorOverride = false;
                        this.odometry2d.canvas.style.cursor = "";
                    };
                    const mousemove = e => {
                        cursorOverride = true;
                        this.odometry2d.canvas.style.cursor = hovered.parent.drag(hoveredPart, this.odometry2d.pageToWorld(e.pageX, e.pageY));
                        this.editorRefresh();
                    };
                    document.body.addEventListener("mouseup", mouseup);
                    document.body.addEventListener("mousemove", mousemove);
                    return;
                }
                if (e.shiftKey) {
                    if (this.isSelected(hovered.parent.item)) this.remSelected(hovered.parent.item);
                    else this.addSelected(hovered.parent.item);
                } else {
                    if (!this.isSelected(hovered.parent.item)) {
                        this.clearSelected();
                        this.addSelected(hovered.parent.item);
                    }
                }
                let oldPos = this.odometry2d.pageToWorld(e.pageX, e.pageY);
                const mouseup = () => {
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                    cursorOverride = false;
                    this.odometry2d.canvas.style.cursor = "";
                };
                const mousemove = e => {
                    let newPos = this.odometry2d.pageToWorld(e.pageX, e.pageY);
                    let rel = newPos.sub(oldPos);
                    this.selected.forEach(id => {
                        if (!this.hasProject() || !this.project.hasItem(id)) return;
                        let itm = this.project.getItem(id);
                        itm.pos.iadd(rel);
                    });
                    oldPos.set(newPos);
                    this.editorRefresh();
                    cursorOverride = true;
                    this.odometry2d.canvas.style.cursor = "move";
                };
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
            }
        });

        this.#odometry3d = new core.Odometry3d();
        this.eDisplay.appendChild(this.odometry3d.elem);
        this.odometry3d.canvas.tabIndex = 1;
        this.odometry3d.canvas.addEventListener("keydown", odometryKeyDown);
        this.odometry3d.canvas.addEventListener("contextmenu", odometryContextMenu);
        this.odometry3d.controlType = null;
        this.odometry3d.camera.position.set(0, 10, -0.01);
        this.odometry3d.camera.lookAt(0, 0, 0);

        this.odometry2d.addHandler("change-addHint", (_, hint) => this.app.addHint(hint));
        this.odometry2d.addHandler("change-remHint", (hint, _) => this.app.remHint(hint));

        this.#eMaxMinBtn = document.createElement("button");
        this.eNavPost.appendChild(this.eMaxMinBtn);
        this.eMaxMinBtn.innerHTML = "<ion-icon></ion-icon>";
        this.eMaxMinBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.app.post("cmd-maxmin");
        });

        this.#eChooseNav = document.createElement("div");
        this.eDisplay.appendChild(this.eChooseNav);
        this.eChooseNav.classList.add("choosenav");
        this.#eChooseDoneBtn = document.createElement("button");
        this.eChooseNav.appendChild(this.eChooseDoneBtn);
        this.eChooseDoneBtn.classList.add("special");
        this.eChooseDoneBtn.textContent = "Done";
        this.#eChooseCancelBtn = document.createElement("button");
        this.eChooseNav.appendChild(this.eChooseCancelBtn);
        this.eChooseCancelBtn.classList.add("off");
        this.eChooseCancelBtn.textContent = "Cancel";
        this.eChooseDoneBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.choosing) return;
            let chooseState = this.chooseState;
            chooseState.post("done");
            this.choosing = false;
        });
        this.eChooseCancelBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.choosing) return;
            let chooseState = this.chooseState;
            chooseState.post("cancel");
            this.choosing = false;
        });

        this.#eEdit = document.createElement("div");
        this.eMain.appendChild(this.eEdit);
        this.eEdit.classList.add("edit");
        this.#eEditContent = document.createElement("div");
        this.eEdit.appendChild(this.eEditContent);
        this.eEditContent.classList.add("content");
        this.#eEditNav = document.createElement("div");
        this.eEdit.appendChild(this.eEditNav);
        this.eEditNav.classList.add("nav");
        this.eEditNav.addEventListener("click", e => {
            e.stopPropagation();
        });
        
        this.#eDivider = document.createElement("div");
        this.eMain.insertBefore(this.eDivider, this.eEdit);
        this.eDivider.classList.add("divider");
        this.eDivider.addEventListener("mousedown", e => {
            if (this.choosing) return;
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                this.eDivider.classList.remove("this");
            };
            const mousemove = e => {
                let r = this.eMain.getBoundingClientRect();
                let p = 1-Math.min(0.9, Math.max(0.1, (e.pageX-r.left) / r.width));
                if (!this.hasProject()) return;
                this.project.sidePos = p;
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
            this.eDivider.classList.add("this");
        });

        [this.#objectsPanel, this.#pathsPanel, this.#optionsPanel] = this.addPanel(
            new App.ProjectPage.ObjectsPanel(this),
            new App.ProjectPage.PathsPanel(this),
            new App.ProjectPage.OptionsPanel(this),
        );

        this.panel = "objects";

        this.addHandler("change-project", (...a) => {
            this.editorRefresh();
        });

        let displayPathRenders = {};

        let itemRenders = {};

        const updateSelected = () => {
            this.selected.forEach(id => {
                if (this.hasProject() && this.project.hasItem(id)) return;
                this.remSelected(id);
            });
            this.selectedPath = (this.hasProject() && this.project.hasPath(this.selectedPath)) ? this.selectedPath : null;
        };
        this.addHandler("change-project", updateSelected);
        this.addHandler("change-project.remItem", updateSelected);
        this.addHandler("change-project.remPath", updateSelected);

        this.addHandler("change-project", () => this.format());
        this.addHandler("change-project.maximized", () => this.format());
        this.addHandler("change-project.sidePos", () => this.format());

        const templates = core.GLOBALSTATE.getProperty("templates").value;
        const templateImages = core.GLOBALSTATE.getProperty("template-images").value;
        const subtemplates = core.GLOBALSTATE.getProperty("subtemplates").value;

        let timer = 0;
        this.addHandler("update", delta => {
            if (this.odometry2d.elem.classList.contains("this")) {
                this.odometry2d.update(delta);
                this.odometry2d.size = this.hasProject() ? this.project.size : 0;
                this.odometry2d.imageSrc = (this.hasProject() && this.project.hasTemplate()) ? "file://"+templateImages[this.project.template] : null;
            }

            if (this.odometry3d.elem.classList.contains("this")) {
                this.odometry3d.update(delta);
                this.odometry3d.size = this.hasProject() ? this.project.size : 0;
                this.odometry3d.template = this.hasProject() ? this.project.template : null;
            }

            if (!this.choosing)
                this.displayPath = (this.hasProject() && this.project.hasPath(this.selectedPath)) ? this.project.getPath(this.selectedPath) : null;

            let nodes = this.hasDisplayPath() ? this.displayPath.nodes.filter(id => this.hasProject() && this.project.hasItem(id)) : [];
            let toDelete = {};
            for (let id in displayPathRenders) {
                toDelete[id] = null;
                let render = displayPathRenders[id];
                if (!(render instanceof RLabel)) continue;
                render.text = "";
            }
            for (let i = 0; i < nodes.length; i++) {
                let id = nodes[i];
                let node = this.project.getItem(id);
                if (this.displayPathIndices) {
                    if (!(id in displayPathRenders))
                        displayPathRenders[id] = this.odometry2d.render.addRender(new RLabel(this.odometry2d.render, null));
                    delete toDelete[id];
                    let label = displayPathRenders[id];
                    label.item = node;
                    if (label.text.length <= 0) label.text = i+1;
                    else label.text += ", "+(i+1);
                }
                if (i <= 0) continue;
                let id2 = nodes[i-1];
                let node2 = this.project.getItem(id2);
                let lid = (i-1)+"~"+i;
                if (this.displayPathLines) {
                    if (!(lid in displayPathRenders))
                        displayPathRenders[lid] = this.odometry2d.render.addRender(new RLine(this.odometry2d.render, null, null));
                    delete toDelete[lid];
                    let line = displayPathRenders[lid];
                    line.itemA = node2;
                    line.itemB = node;
                }
            }
            for (let id in toDelete) {
                this.odometry2d.render.remRender(displayPathRenders[id]);
                delete displayPathRenders[id];
            }

            let itms = {};
            if (this.hasProject())
                this.project.items.forEach(id => (itms[id] = this.project.getItem(id)));
            for (let id in itemRenders) {
                if (id in itms) continue;
                this.odometry2d.render.remRender(itemRenders[id].d2);
                this.odometry3d.remRender(itemRenders[id].d3);
                delete itemRenders[id];
            }
            for (let id in itms) {
                if (!(id in itemRenders)) {
                    itemRenders[id] = {
                        d2: this.odometry2d.render.addRender(new RSelectable(this.odometry2d.render, null)),
                        d3: this.odometry3d.addRender(new core.Odometry3d.Render(this.odometry3d, 0, 0, "KitBot")),
                    };
                    itemRenders[id].d3.color = "--cb";
                }
                let render;
                render = itemRenders[id].d2;
                render.item = itms[id];
                render.selected = this.isSelected(render);
                if (render.renderObject instanceof core.Odometry2d.Robot)
                    render.renderObject.size = this.project.robotW;
                render = itemRenders[id].d3;
                render.pos = itms[id].pos.div(100);
                render.q = [Math.cos(itms[id].heading/2), 0, 0, Math.sin(itms[id].heading/2)];
            }

            this.panels.forEach(name => this.getPanel(name).update(delta));

            if (!cursorOverride) {
                const hovered = this.odometry2d.hovered;
                const hoveredPart = this.odometry2d.hoveredPart;
                if (!(hovered instanceof core.Odometry2d.Render)) this.odometry2d.canvas.style.cursor = "crosshair";
                else if (!(hovered.source instanceof RSelectable)) this.odometry2d.canvas.style.cursor = "crosshair";
                else this.odometry2d.canvas.style.cursor = hovered.source.hover(hoveredPart);
            }

            if (timer > 0) return timer -= delta;
            timer = 1000;
            if (!this.hasProject()) return;
            return;
            const canvas = document.createElement("canvas");
            canvas.width = this.odometry.w;
            canvas.height = this.odometry.h;
            canvas.getContext("2d").drawImage(
                this.odometry.canvas,
                (this.odometry.canvas.width-this.odometry.w*this.odometry.scale*this.odometry.quality)/2,
                (this.odometry.canvas.height-this.odometry.h*this.odometry.scale*this.odometry.quality)/2,
                this.odometry.w*this.odometry.scale*this.odometry.quality,
                this.odometry.h*this.odometry.scale*this.odometry.quality,
                0, 0, canvas.width, canvas.height,
            );
            this.project.meta.thumb = canvas.toDataURL();
        });

        this.addHandler("refresh", () => {
            this.panel = "objects";
            this.choosing = false;
        });

        let selectItem = null;
        this.addHandler("editor-refresh", () => {
            this.selected.forEach(id => {
                if (!this.hasProject() || !this.project.hasItem(id)) return;
                let itm = this.project.getItem(id);
                itm.x = Math.min(this.project.w, Math.max(0, itm.x));
                itm.y = Math.min(this.project.h, Math.max(0, itm.y));
            });
            if (this.selected.length > 1) {
                if (!selectItem) selectItem = this.odometry2d.render.addRender(new RSelect(this.odometry2d.render));
                let maxPos = new V(), minPos = new V();
                let first = true;
                this.selected.forEach(id => {
                    if (!this.hasProject() || !this.project.hasItem(id)) return;
                    let itm = this.project.getItem(id);
                    let bbox = itm.getBBox();
                    if (first) {
                        first = false;
                        maxPos.set(bbox.tr);
                        minPos.set(bbox.bl);
                        return;
                    }
                    maxPos.x = Math.max(maxPos.x, bbox.r);
                    maxPos.y = Math.max(maxPos.y, bbox.t);
                    minPos.x = Math.min(minPos.x, bbox.l);
                    minPos.y = Math.min(minPos.y, bbox.b);
                });
                selectItem.a = minPos;
                selectItem.b = maxPos;
            } else {
                this.odometry2d.render.remRender(selectItem);
                selectItem = null;
            }
            this.app.eProjectInfoNameInput.value = this.hasProject() ? this.project.meta.name : "";
            this.app.eProjectInfoBtnName.textContent = this.hasProject() ? this.project.meta.name : "";
            if (this.app.page == this.name) this.app.title = this.hasProject() ? this.project.meta.name : "?";
            this.panels.forEach(name => this.getPanel(name).refresh());
        });

        this.addHandler("enter", async data => {
            let projectOnly = [
                "addnode", "addobstacle", "addpath",
                "maxmin", "resetdivider",
            ];
            projectOnly.forEach(id => {
                let itm = this.app.menu.getItemById(id);
                if (!itm) return;
                itm.exists = true;
            });
            await this.refresh();
            await this.editorRefresh();
            this.odometry2d.canvas.focus();
            const activeTemplate = await window.api.get("active-template");
            if (this.app.hasProject(data.id)) {
                this.project = this.app.getProject(data.id);
            } else if (data.project instanceof sublib.Project) {
                this.project = data.project;
            } else {
                this.project = new sublib.Project();
                this.project.template = ("template" in data) ? data.template : activeTemplate;
                this.project.meta.created = this.project.meta.modified = util.getTime();
                await this.applyTemplate(this.project, this.project.template);
                this.editorRefresh();
            }
        });
        this.addHandler("leave", async data => {
            let projectOnly = [
                "addnode", "addobstacle", "addpath",
                "maxmin", "resetdivider",
            ];
            projectOnly.forEach(id => {
                let itm = this.app.menu.getItemById(id);
                if (!itm) return;
                itm.exists = false;
            });
        });
    }

    async applyTemplate(project, name) {
        if (!(project instanceof sublib.Project)) return false;
        const templates = core.GLOBALSTATE.getProperty("templates").value;
        let content = "";
        try {
            content = await window.api.fileRead("templates.json");
        } catch (e) {}
        let subtemplates = null;
        try {
            subtemplates = JSON.parse(content);
        } catch (e) {}
        subtemplates = util.ensure(util.ensure(subtemplates, "obj").templates, "obj");
        name = (name == null) ? null : String(name);
        if (!(name in templates)) return false;
        const globalTemplate = util.ensure(templates[name], "obj");
        const template = util.ensure(subtemplates[name], "obj");
        template[".size"] = globalTemplate["size"];
        template[".robotW"] = globalTemplate["robotSize"];
        template[".robotMass"] = globalTemplate["robotMass"];
        for (let k in template) {
            let v = template[k];
            k = String(k).split(".");
            while (k.length > 0 && k.at(0).length <= 0) k.shift();
            while (k.length > 0 && k.at(-1).length <= 0) k.pop();
            let obj = project;
            while (k.length > 1) {
                if (!util.is(obj, "obj")) {
                    obj = null;
                    break;
                }
                obj = obj[k.shift()];
            }
            if (!util.is(obj, "obj") || k.length != 1) continue;
            obj[k] = v;
        }
        return true;
    }

    get odometry2d() { return this.#odometry2d; }
    get odometry3d() { return this.#odometry3d; }

    get selected() { return [...this.#selected]; }
    set selected(v) {
        v = util.ensure(v, "arr");
        this.clearSelected();
        this.addSelected(v);
    }
    clearSelected() {
        let sels = this.selected;
        this.remSelected(sels);
        return sels;
    }
    isSelected(id) {
        if (id instanceof sublib.Project.Item) return this.isSelected(id.id);
        if (id instanceof RSelectable) return this.isSelected(id.item);
        return this.#selected.has(String(id));
    }
    addSelected(...ids) {
        let r = util.Target.resultingForEach(ids, id => {
            if (id instanceof RSelectable) id = id.item;
            if (id instanceof sublib.Project.Item) id = id.id;
            if (this.isSelected(id)) return false;
            id = String(id);
            if (!this.hasProject()) return false;
            if (!this.project.hasItem(id)) return false;
            this.#selected.add(id);
            return id;
        });
        this.editorRefresh();
        return r;
    }
    remSelected(...ids) {
        let r = util.Target.resultingForEach(ids, id => {
            if (id instanceof RSelectable) id = id.item;
            if (id instanceof sublib.Project.Item) id = id.id;
            if (!this.isSelected(id)) return false;
            id = String(id);
            this.#selected.delete(id);
            return id;
        });
        this.editorRefresh();
        return r;
    }
    
    get selectedPath() { return this.#selectedPath; }
    set selectedPath(v) {
        if (v instanceof sublib.Project.Path) return this.selectedPath = v.id;
        v = (v == null) ? null : String(v);
        if (!(this.hasProject() && this.project.hasPath(v))) v = null;
        if (this.selectedPath == v) return;
        this.change("selectedPath", this.selectedPath, this.#selectedPath=v);
        this.editorRefresh();
    }
    hasSelectedPath() { return this.selectedPath != null; }

    get choosing() { return this.#choosing; }
    set choosing(v) {
        v = !!v;
        if (this.choosing == v) return;
        this.#choosing = v;
        this.clearSelected();
        this.#chooseState = this.choosing ? new util.Target() : null;
        this.displayPath = null;
        this.choosing ? this.eDisplay.classList.add("choose") : this.eDisplay.classList.remove("choose");
    }
    get chooseState() { return this.#chooseState; }

    get displayPath() { return this.#displayPath; }
    set displayPath(v) {
        v = (v instanceof sublib.Project.Path) ? v : null;
        if (this.displayPath == v) return;
        this.#displayPath = v;
    }
    hasDisplayPath() { return !!this.displayPath; }
    get displayPathIndices() { return this.#displayPathIndices; }
    set displayPathIndices(v) { this.#displayPathIndices = !!v; }
    get displayPathLines() { return this.#displayPathLines; }
    set displayPathLines(v) { this.#displayPathLines = !!v; }

    async cut() {
        await this.copy();
        this.selected.filter(id => this.hasProject() && this.project.hasItem(id)).forEach(id => this.project.remItem(id));
        this.editorRefresh();
    }
    async copy() {
        let itms = this.selected.filter(id => this.hasProject() && this.project.hasItem(id)).map(id => this.project.getItem(id));
        if (itms.length <= 0) return;
        let itm = new ClipboardItem({ "text/plain": new Blob([util.MAGIC+JSON.stringify(itms)], { type: "text/plain" })});
        await navigator.clipboard.write([itm]);
        return true;
    }
    async paste() {
        let itms = await navigator.clipboard.read();
        itms.forEach(itm => {
            itm.types.forEach(async type => {
                if (type != "text/plain") return;
                let blob = await itm.getType(type);
                let text = await blob.text();
                if (!text.startsWith(util.MAGIC)) return;
                text = text.slice(util.MAGIC.length);
                try {
                    let data = JSON.parse(text, sublib.REVIVER.f);
                    if (!util.is(data, "arr")) return;
                    if (!this.hasProject()) return;
                    data.forEach(itm => this.project.addItem(itm));
                } catch (e) {}
            });
        });
        return true;
    }

    get panels() { return Object.keys(this.#panels); }
    set panels(v) {
        v = util.ensure(v, "arr");
        this.clearPanels();
        this.addPanel(v);
    }
    clearPanels() {
        let panels = this.panels;
        this.remPanel(panels);
        return panels;
    }
    hasPanel(name) {
        if (name instanceof App.ProjectPage.Panel) return this.hasPanel(name.name) && name.page == this;
        return name in this.#panels;
    }
    getPanel(name) {
        name = String(name);
        if (!this.hasPanel(name)) return null;
        return this.#panels[name];
    }
    addPanel(...panels) {
        return util.Target.resultingForEach(panels, panel => {
            if (!(panel instanceof App.ProjectPage.Panel)) return false;
            if (panel.page != this) return false;
            if (this.hasPanel(panel.name)) return false;
            this.#panels[panel.name] = panel;
            this.eEditContent.appendChild(panel.elem);
            this.eEditNav.appendChild(panel.btn);
            panel.onAdd();
            return panel;
        });
    }
    remPanel(...panels) {
        return util.Target.resultingForEach(panels, panel => {
            if (!(panel instanceof App.ProjectPage.Panel)) panel = this.getPanel(panel);
            if (panel.page != this) return false;
            if (!this.hasPanel(panel)) return false;
            panel.onRem();
            delete this.#panel[panel.name];
            this.eEditContent.removeChild(panel.elem);
            this.eEditNav.removeChild(panel.btn);
            return panel;
        });
    }
    get panel() { return this.#panel; }
    set panel(v) {
        v = String(v);
        if (this.panel == v) return;
        this.#panel = v;
        this.panels.forEach(name => (this.getPanel(name).isShown = (name == this.panel)));
    }
    get objectsPanel() { return this.#objectsPanel; }
    get pathsPanel() { return this.#pathsPanel; }
    get optionsPanel() { return this.#optionsPanel; }

    get eDisplay() { return this.#eDisplay; }
    get eBlockage() { return this.#eBlockage; }
    get eMaxMinBtn() { return this.#eMaxMinBtn; }
    get eChooseNav() { return this.#eChooseNav; }
    get eChooseDoneBtn() { return this.#eChooseDoneBtn; }
    get eChooseCancelBtn() { return this.#eChooseCancelBtn; }
    get eEdit() { return this.#eEdit; }
    get eEditContent() { return this.#eEditContent; }
    get eEditNav() { return this.#eEditNav; }
    get eDivider() { return this.#eDivider; }

    format() {
        if (this.eMaxMinBtn.children[0])
            this.eMaxMinBtn.children[0].name = (this.hasProject() && this.project.maximized) ? "contract" : "expand";
        if (this.hasProject() && this.project.maximized) {
            this.eDisplay.style.width = "100%";
            this.eDisplay.style.maxWidth = "100%";
            this.eEdit.style.display = "none";
            this.eDivider.style.display = "none";
        } else {
            const p = this.hasProject() ? this.project.sidePos : 0;
            this.eDisplay.style.width = "calc("+((1-p)*100)+"% - 1px)";
            this.eDisplay.style.maxWidth = "calc("+((1-p)*100)+"% - 1px)";
            this.eEdit.style.display = "";
            this.eEdit.style.width = "calc("+(p*100)+"% - 1px)";
            this.eEdit.style.maxWidth = "calc("+(p*100)+"% - 1px)";
            this.eDivider.style.display = "";
        }
    }

    async editorRefresh() { await this.postResult("editor-refresh"); }

    get state() {
        return {
            id: this.projectId,
            selected: this.selected,
            selectedPath: this.selectedPath,
            panel: this.panel,
        };
    }
    async loadState(state) {
        state = util.ensure(state, "obj");
        await this.app.loadProjects();
        await this.app.setPage(this.name, { id: state.id });
        this.selected = state.selected;
        this.selectedPath = state.selectedPath;
        this.panel = state.panel;
    }

    async determineSame(data) {
        if (this.app.hasProject(data.id)) return this.projectId == data.id;
        else if (data.project instanceof sublib.Project) return this.project == data.project;
        return false;
    }
};
App.ProjectPage.Panel = class AppProjectPagePanel extends util.Target {
    #name;

    #page;
    #app;
    #items;

    #elem;
    #btn;
    #eIcon;
    #eName;

    constructor(page, name, icon) {
        super(page);

        this.#name = String(name);

        if (!(page instanceof App.ProjectPage)) throw new Error("Page is not of class ProjectPage");
        this.#page = page;
        this.#app = this.page.app;
        this.#items = [];

        this.#elem = document.createElement("div");
        this.elem.id = this.name+"panel";
        this.elem.classList.add("panel");
        this.#btn = document.createElement("button");
        this.btn.classList.add("override")
        this.#eIcon = document.createElement("ion-icon");
        this.btn.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.btn.appendChild(this.eName);
        this.btn.addEventListener("click", e => {
            e.stopPropagation();
            this.page.panel = this.name;
        });

        this.icon = icon;
        this.btnName = util.formatText(this.name);
    }

    get name() { return this.#name; }

    get page() { return this.#page; }
    get app() { return this.#app; }

    get items() { return [...this.#items]; }
    set items(v) {
        v = util.ensure(v, "arr");
        this.clearItems();
        this.addItem(v);
    }
    clearItems() {
        let itms = this.items;
        this.remItem(itms);
        return itms;
    }
    hasItem(itm) {
        if (!(itm instanceof App.ProjectPage.Panel.Item) && !(itm instanceof HTMLElement)) return false;
        return this.#items.includes(itm);
    }
    addItem(...itms) {
        return util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof App.ProjectPage.Panel.Item) && !(itm instanceof HTMLElement)) return false;
            if (this.hasItem(itm)) return false;
            this.#items.push(itm);
            this.elem.appendChild((itm instanceof App.ProjectPage.Panel.Item) ? itm.elem : itm);
            if (itm instanceof App.ProjectPage.Panel.Item) itm.onAdd();
            return itm;
        });
    }
    remItem(...itms) {
        return util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof App.ProjectPage.Panel.Item) && !(itm instanceof HTMLElement)) return false;
            if (!this.hasItem(itm)) return false;
            if (itm instanceof App.ProjectPage.Panel.Item) itm.onRem();
            this.#items.splice(this.#items.indexOf(itm), 1);
            this.elem.removeChild((itm instanceof App.ProjectPage.Panel.Item) ? itm.elem : itm);
            return itm;
        });
    }

    get elem() { return this.#elem; }
    get btn() { return this.#btn; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }

    get isShown() { return this.elem.classList.contains("this"); }
    set isShown(v) {
        v = !!v;
        if (this.isShown == v) return;
        if (v) {
            this.elem.classList.add("this");
            this.btn.classList.add("this");
        } else {
            this.elem.classList.remove("this");
            this.btn.classList.remove("this");
        }
    }
    get isHidden() { return !this.isShown; }
    set isHidden(v) { this.isShown = !v; }
    show() { return this.isShown = true; }
    hide() { return this.isHidden = true; }

    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) { this.eIcon.setAttribute("src", v); }
    get btnName() { return this.eName.textContent; }
    set btnName(v) { this.eName.textContent = v; }

    refresh() { this.post("refresh"); }

    update(delta) { this.post("update", delta); }
};
App.ProjectPage.Panel.Item = class AppProjectPagePanelItem extends util.Target {
    #elem;

    constructor() {
        super();

        this.#elem = document.createElement("div");
    }

    get elem() { return this.#elem; }
};
App.ProjectPage.Panel.Header = class AppProjectPagePanelHeader extends App.ProjectPage.Panel.Item {
    #eName;
    #eUnits;
    
    constructor(name, units="") {
        super();

        this.elem.classList.add("header");

        this.#eName = document.createElement("span");
        this.elem.appendChild(this.eName);
        this.#eUnits = document.createElement("span");
        this.elem.appendChild(this.eUnits);
        this.eUnits.classList.add("units");

        this.name = name;
        this.units = units;
    }

    get eName() { return this.#eName; }
    get eUnits() { return this.#eUnits; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }
    get units() { return this.eUnits.textContent; }
    set units(v) { this.eUnits.textContent = v; }
};
App.ProjectPage.Panel.SubHeader = class AppProjectPagePanelSubHeader extends App.ProjectPage.Panel.Header {
    constructor(name, units="") {
        super(name, units);

        this.elem.classList.add("sub");
    }
};
App.ProjectPage.ObjectsPanel = class AppProjectPageObjectsPanel extends App.ProjectPage.Panel {
    #fPosition;
    #fRobotHeading;
    #fRobotVelocity;
    #fRobotRotVelocity;
    #fOptions;
    #fType;
    #fColor;
    #fGhost;
    #fObstacleRadius;
    #fObstacleEnabled;
    #fRemove;

    #eSpawnBox;
    #eSpawnDelete;
    #eSpawns;

    constructor(page) {
        super(page, "objects", "cube-outline");

        this.addItem(new App.ProjectPage.Panel.Header("Drag Items"));

        this.#eSpawnBox = document.createElement("div");
        this.addItem(this.eSpawnBox);
        this.eSpawnBox.id = "spawnbox";
        this.#eSpawnDelete = document.createElement("button");
        this.eSpawnBox.appendChild(this.eSpawnDelete);
        this.eSpawnDelete.classList.add("delete");
        this.eSpawnDelete.classList.add("off");
        this.eSpawnDelete.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eSpawns = {};
        ["node", "obstacle"].forEach(name => {
            let btn = this.#eSpawns[name] = document.createElement("button");
            this.eSpawnBox.appendChild(btn);
            btn.classList.add("item");
            btn.classList.add("override");
            let eIcon = document.createElement("div");
            btn.appendChild(eIcon);
            eIcon.classList.add("icon");
            eIcon.innerHTML = {
                node: `
                <div class="global item selectable node">
                    <div class="button"></div>
                </div>
                `,
                obstacle: `
                <div class="global item selectable obstacle">
                    <div class="button"></div>
                    <div class="radius"></div>
                    <div class="button radiusdrag"></div>
                </div>
                `,
            }[name];
            let eName = document.createElement("div");
            btn.appendChild(eName);
            eName.classList.add("name");
            eName.textContent = util.formatText(name);
            btn.addEventListener("mousedown", e => {
                if (this.page.choosing) return;
                if (e.button != 0) return;
                e.preventDefault();
                e.stopPropagation();
                this.app.post("cmd-add"+name);
            });
        });

        const getSelected = () => {
            if (!this.page.hasProject()) return [];
            return this.page.selected.filter(id => this.page.project.hasItem(id)).map(id => this.page.project.getItem(id));
        };

        let forAny = [], forNode = [], forObstacle = [];

        const form = new core.Form();
        this.addItem(form.elem);

        forAny.push(form.addField(new core.Form.Header("Item Options")));

        this.#fPosition = form.addField(new core.Form.Input2d("position"));
        forAny.push(this.fPosition);
        this.fPosition.app = this.app;
        this.fPosition.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fPosition.baseType = this.fPosition.activeType = "m";
        this.fPosition.step = 0.1;
        this.fPosition.inputs.forEach((inp, i) => {
            inp.placeholder = "XY"[i];
        });
        this.fPosition.addHandler("change-value", () => {
            if (!this.fPosition.hasValue()) return;
            const hasX = this.fPosition.hasValue("x");
            const hasY = this.fPosition.hasValue("y");
            let itms = getSelected();
            let xList = hasX ? itms.map(itm => itm.x) : null;
            let yList = hasY ? itms.map(itm => itm.y) : null;
            let newCenterX = hasX ? this.fPosition.value.x*100 : null;
            let newCenterY = hasY ? this.fPosition.value.y*100 : null;
            let oldCenterX = hasX ? (Math.max(...xList)+Math.min(...xList))/2 : null;
            let oldCenterY = hasY ? (Math.max(...yList)+Math.min(...yList))/2 : null;
            let relX = hasX ? newCenterX - oldCenterX : 0;
            let relY = hasY ? newCenterY - oldCenterY : 0;
            itms.forEach(itm => {
                itm.x += relX;
                itm.y += relY;
            });
            this.page.editorRefresh();
        });

        this.#fRobotHeading = form.addField(new core.Form.Input1d("robot-heading"));
        forNode.push(this.fRobotHeading);
        this.fRobotHeading.app = this.app;
        this.fRobotHeading.types = ["rad", "deg", "cycle"];
        this.fRobotHeading.baseType = "deg";
        this.fRobotHeading.activeType = "rad";
        this.fRobotHeading.showToggle = true;
        this.fRobotHeading.step = 0.1;
        this.fRobotHeading.inputs.forEach(inp => {
            inp.placeholder = "...";
        });
        this.fRobotHeading.addHandler("change-toggleOn", () => {
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Node)) return;
                itm.useHeading = this.fRobotHeading.toggleOn;
            });
            this.page.editorRefresh();
        });
        this.fRobotHeading.addHandler("change-value", () => {
            if (!this.fRobotHeading.hasValue()) return;
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Node)) return;
                itm.heading = this.fRobotHeading.value * (Math.PI/180);
            });
            this.page.editorRefresh();
        });

        this.#fRobotVelocity = form.addField(new core.Form.Input2d("robot-velocity"));
        forNode.push(this.fRobotVelocity);
        this.fRobotVelocity.app = this.app;
        this.fRobotVelocity.types = ["m/s", "ft/s"];
        this.fRobotVelocity.baseType = this.fRobotVelocity.activeType = "m/s";
        this.fRobotVelocity.showToggle = true;
        this.fRobotVelocity.step = 0.1;
        this.fRobotVelocity.inputs.forEach((inp, i) => {
            inp.placeholder = "XY"[i];
        });
        this.fRobotVelocity.addHandler("change-toggleOn", () => {
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Node)) return;
                itm.useVelocity = this.fRobotVelocity.toggleOn;
            });
            this.page.editorRefresh();
        });
        this.fRobotVelocity.addHandler("change-value", () => {
            if (!this.fRobotVelocity.hasValue()) return;
            const hasX = this.fRobotVelocity.hasValue("x");
            const hasY = this.fRobotVelocity.hasValue("y");
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Node)) return;
                if (hasX) itm.velocityX = this.fRobotVelocity.x*100;
                if (hasY) itm.velocityY = this.fRobotVelocity.y*100;
            });
            this.page.editorRefresh();
        });

        this.#fRobotRotVelocity = form.addField(new core.Form.Input1d("robot-rotational-velocity"));
        forNode.push(this.fRobotRotVelocity);
        this.fRobotRotVelocity.app = this.app;
        this.fRobotRotVelocity.types = ["rad/s", "deg/s", "cycle/s"];
        this.fRobotRotVelocity.baseType = this.fRobotRotVelocity.activeType = "rad/s";
        this.fRobotRotVelocity.step = 0.1;
        this.fRobotRotVelocity.inputs.forEach(inp => {
            inp.placeholder = "...";
        });
        this.fRobotRotVelocity.addHandler("change-value", () => {
            if (!this.fRobotRotVelocity.hasValue()) return;
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Node)) return;
                itm.velocityRot = this.fRobotRotVelocity.value;
            });
            this.page.editorRefresh();
        });

        this.#fOptions = form.addField(new core.Form.JSONInput("options"));
        this.fOptions.addHandler("set", (k, v0, v1) => {
            let itms = getSelected().filter(itm => (itm instanceof sublib.Project.Node));
            if (itms.length != 1) return;
            let itm = itms[0];
            itm.setOption(k, v1);
            this.page.editorRefresh();
        });
        this.fOptions.addHandler("del", (k, v) => {
            let itms = getSelected().filter(itm => (itm instanceof sublib.Project.Node));
            if (itms.length != 1) return;
            let itm = itms[0];
            itm.delOption(k);
            this.page.editorRefresh();
        });

        const subform = form.addField(new core.Form.SubForm("display")).form;

        this.#fType = subform.addField(new core.Form.DropdownInput("type", [
            "§default",
            "§node",
            "§box",
            "§arrow",
            "§arrow-h",
            "§arrow-t",
            "§target",
        ].map(type => { return { value: type, name: core.Odometry2d.Robot.getTypeName(type) }; })));
        forNode.push(this.fType);
        this.fType.app = this.app;
        this.fType.addHandler("change-value", () => {
            if (!this.fType.hasValue()) return;
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Node)) return;
                itm.type = this.fType.value;
            });
            this.page.editorRefresh();
        });

        this.#fColor = subform.addField(new core.Form.ColorInput("color"));
        forNode.push(this.fColor);
        this.fColor.eColorPicker.showPicker = this.fColor.eColorPicker.showH = this.fColor.eColorPicker.showS = this.fColor.eColorPicker.showV = this.fColor.useAlpha = false;
        this.fColor.eInput.style.display = "none";
        this.fColor.addHandler("change-value", () => {
            let color = null;
            for (let c of "roygcbpm") {
                let cc = core.PROPERTYCACHE.getColor("--c"+c);
                let diff = cc.diff(this.fColor.value);
                if (diff >= 1) continue;
                color = c;
            }
            if (color == null) return;
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Node)) return;
                itm.color = "c"+color;
            });
            this.page.editorRefresh();
        });

        this.#fGhost = subform.addField(new core.Form.BooleanInput("ghost"));
        forNode.push(this.fGhost);
        this.fGhost.addHandler("change-value", () => {
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Node)) return;
                itm.ghost = this.fGhost.value;
            });
            this.page.editorRefresh();
        });
        
        this.#fObstacleRadius = form.addField(new core.Form.Input1d("radius"));
        forObstacle.push(this.fObstacleRadius);
        this.fObstacleRadius.app = this.app;
        this.fObstacleRadius.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fObstacleRadius.baseType = this.fObstacleRadius.activeType = "m";
        this.fObstacleRadius.step = 0.1;
        this.fObstacleRadius.inputs.forEach(inp => {
            inp.placeholder = "...";
        });
        this.fObstacleRadius.addHandler("change-value", () => {
            if (!this.fObstacleRadius.hasValue()) return;
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Obstacle)) return;
                itm.radius = this.fObstacleRadius.value*100;
            });
            this.page.editorRefresh();
        });

        this.#fObstacleEnabled = form.addField(new core.Form.BooleanInput("enabled"));
        forObstacle.push(this.fObstacleEnabled);
        this.fObstacleEnabled.addHandler("change-value", () => {
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Obstacle)) return;
                itm.enabled = this.fObstacleEnabled.value;
            });
            this.page.editorRefresh();
        });

        forAny.push(form.addField(new core.Form.Header("Controls")));

        this.#fRemove = form.addField(new core.Form.Button("remove", "Remove", "off"));
        forAny.push(this.fRemove);
        this.fRemove.showHeader = false;
        this.fRemove.addHandler("trigger", e => {
            if (this.page.choosing) return;
            if (!this.page.hasProject()) return;
            this.page.selected.forEach(id => this.page.project.remItem(id));
        });

        this.addHandler("refresh", () => {
            let has = this.page.hasProject();
            this.btn.disabled = !has;
            let itms = getSelected();
            let xList = itms.map(itm => itm.x);
            let xCenter = (Math.max(...xList)+Math.min(...xList))/2;
            let yList = itms.map(itm => itm.y);
            let yCenter = (Math.max(...yList)+Math.min(...yList))/2;
            let allNode = (itms.length > 0), allObstacle = (itms.length > 0);
            itms.forEach(itm => {
                if (!(itm instanceof sublib.Project.Node)) allNode = false;
                if (!(itm instanceof sublib.Project.Obstacle)) allObstacle = false;
            });
            forAny.forEach(f => (f.isShown = (itms.length > 0)));
            forNode.forEach(f => (f.isShown = allNode));
            forObstacle.forEach(f => (f.isShown = allObstacle));
            const getSameValue = f => {
                let sameValue = null, first = true;
                for (let itm of itms) {
                    if (first) {
                        first = false;
                        sameValue = f(itm);
                        continue;
                    }
                    if (sameValue == f(itm)) continue;
                    return null;
                }
                return sameValue;
            };
            this.fPosition.disabled = !has;
            this.fPosition.value = has ? [xCenter/100, yCenter/100] : null;

            this.fRobotHeading.toggleDisabled = !has;
            if (allNode) {
                let v = getSameValue(itm => itm.useHeading);
                this.fRobotHeading.toggleOn = (v == null) ? false : v;
            } else this.fRobotHeading.toggleOn = false;
            this.fRobotHeading.disabled = !this.fRobotHeading.toggleOn || !has;
            if (allNode) {
                let v = getSameValue(itm => itm.heading);
                this.fRobotHeading.value = (v == null) ? null : v * (180/Math.PI);
            } else this.fRobotHeading.value = null;

            this.fRobotVelocity.toggleDisabled = !has;
            if (allNode) {
                let v = getSameValue(itm => itm.useVelocity);
                this.fRobotVelocity.toggleOn = (v == null) ? false : v;
            } else this.fRobotVelocity.toggleOn = false;
            this.fRobotVelocity.disabled = !this.fRobotVelocity.toggleOn || !has;
            if (allNode) {
                let vx = getSameValue(itm => itm.velocityX);
                let vy = getSameValue(itm => itm.velocityY);
                this.fRobotVelocity.x = (vx == null) ? null : vx/100;
                this.fRobotVelocity.y = (vy == null) ? null : vy/100;
            } else this.fRobotVelocity.value = null;
            this.fRobotRotVelocity.disabled = !this.fRobotVelocity.toggleOn || !has;
            if (allNode) {
                let v = getSameValue(itm => itm.velocityRot);
                this.fRobotRotVelocity.value = (v == null) ? null : v;
            } else this.fRobotRotVelocity.value = null;

            this.fOptions.isShown = has && allNode && itms.length == 1;
            this.fOptions.disabled = !this.fOptions.isShown;
            if (this.fOptions.isShown) {
                this.fOptions.keys.forEach(k => {
                    if (itms[0].hasOption(k)) return;
                    this.fOptions.del(k);
                });
                itms[0].optionKeys.forEach(k => {
                    this.fOptions.set(k, itms[0].getOption(k));
                });
            } else this.fOptions.map = null;

            this.fType.disabled = !has;
            if (allNode) {
                let v = getSameValue(itm => itm.type);
                this.fType.value = (v == null) ? null : v;
            } else this.fType.value = null;

            this.fColor.disabled = !has;
            if (allNode) {
                let v = getSameValue(itm => itm.color);
                if (v != null) this.fColor.value = core.PROPERTYCACHE.getColor("--"+v);
            }

            this.fGhost.disabled = !has;
            if (allNode) {
                let v = getSameValue(itm => itm.ghost);
                if (v != null) this.fGhost.value = v;
            }

            this.fObstacleRadius.disabled = !has;
            if (allObstacle) {
                let v = getSameValue(itm => itm.radius);
                this.fObstacleRadius.value = (v == null) ? null : v/100;
            } else this.fObstacleRadius.value = null;

            this.fObstacleEnabled.disabled = !has;
            if (allObstacle) {
                let v = getSameValue(itm => itm.enabled);
                if (v != null) this.fObstacleEnabled.value = v;
            }
        });
    }

    get fPosition() { return this.#fPosition; }
    get fRobotHeading() { return this.#fRobotHeading; }
    get fRobotVelocity() { return this.#fRobotVelocity; }
    get fRobotRotVelocity() { return this.#fRobotRotVelocity; }
    get fOptions() { return this.#fOptions; }
    get fType() { return this.#fType; }
    get fColor() { return this.#fColor; }
    get fGhost() { return this.#fGhost; }
    get fObstacleRadius() { return this.#fObstacleRadius; }
    get fObstacleEnabled() { return this.#fObstacleEnabled; }
    get fRemove() { return this.#fRemove; }

    get eSpawnBox() { return this.#eSpawnBox; }
    get eSpawnDelete() { return this.#eSpawnDelete; }
    get eSpawns() { return Object.keys(this.#eSpawns); }
    hasESpawn(name) { return name in this.#eSpawns; }
    getESpawn(name) { return this.hasESpawn(name) ? this.#eSpawns[name] : null; }
};
App.ProjectPage.PathsPanel = class AppProjectPagePathsPanel extends App.ProjectPage.Panel {
    #generating;
    #buttons;

    #eAddBtn;
    #ePathsBox;
    #eActivateBtn;

    constructor(page) {
        super(page, "paths", "analytics");

        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            this.page.selectedPath = null;
        });

        new core.DropTarget(this.elem, async e => {
            let items = e.dataTransfer.items ? [...e.dataTransfer.items] : [];
            items = items.map(item => item.getAsFile()).filter(file => file instanceof File);
            if (items.length <= 0) items = e.dataTransfer.files ? [...e.dataTransfer.files] : [];
            items = items.filter(item => item instanceof File);
            if (items.length <= 0) return;
            const file = items[0];
            const path = file.path;
            let content = null;
            try {
                content = await window.api.send("read-data", path);
            } catch (e) { return this.app.doError("DATA.IN Read Error", path, e); }
            let data = null;
            try {
                data = JSON.parse(content);
            } catch (e) { return this.app.doError("DATA.IN Parse Error", path, e); }
            data = util.ensure(data, "obj");
            const nodes = util.ensure(data.nodes, "arr");
            const obstacles = util.ensure(data.obstacles, "arr");
            if (!this.page.hasProject()) return;
            let ids = [];
            nodes.forEach(node => {
                node = util.ensure(node, "obj");
                const pnode = new sublib.Project.Node();
                this.page.project.addItem(pnode);
                ids.push(pnode.id);
                pnode.pos = new V(node.x, node.y).mul(100);
                pnode.heading = node.theta;
                pnode.useHeading = node.theta != null;
                pnode.velocity = new V(node.vx, node.vy).mul(100);
                pnode.velocityRot = node.vt;
                pnode.useVelocity = node.vx != null && node.vy != null && node.vt != null;
                const blacklist = ["x", "y", "vx", "vy", "vt", "theta"];
                for (const k in node) {
                    if (blacklist.includes(k)) continue;
                    pnode.setOption(k, node[k]);
                }
            });
            obstacles.forEach(obstacle => {
                obstacle = util.ensure(obstacle, "obj");
                const pobstacle = new sublib.Project.Obstacle();
                this.page.project.addItem(pobstacle);
                pobstacle.pos = new V(obstacle.x, obstacle.y).mul(100);
                pobstacle.radius = obstacle.radius*100;
            });
            const ppath = new sublib.Project.Path();
            this.page.project.addPath(ppath);
            ppath.nodes = ids;
        });

        this.#generating = null;
        this.#buttons = new Set();

        let header = this.addItem(new App.ProjectPage.Panel.Header("Paths"));
        this.#eAddBtn = document.createElement("button");
        header.elem.appendChild(this.eAddBtn);
        this.eAddBtn.classList.add("icon");
        this.eAddBtn.classList.add("special");
        this.eAddBtn.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.eAddBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (this.page.choosing) return;
            if (!this.page.hasProject()) return;
            this.page.choosing = true;
            this.page.displayPath = new sublib.Project.Path();
            this.page.chooseState.addHandler("choose", (itm, shift) => {
                if (!this.page.hasDisplayPath()) return;
                let path = this.page.displayPath;
                shift = !!shift;
                if (!(itm instanceof sublib.Project.Node)) return;
                if (shift) path.remNode(itm);
                else path.addNode(itm);
            });
            this.page.chooseState.addHandler("done", () => {
                if (!this.page.hasDisplayPath()) return;
                let path = this.page.displayPath;
                if (!this.page.hasProject()) return;
                this.page.project.addPath(path);
            });
            this.page.chooseState.addHandler("cancel", () => {
            });
        });

        this.#ePathsBox = document.createElement("div");
        this.addItem(this.ePathsBox);
        this.ePathsBox.id = "pathsbox";

        this.#eActivateBtn = document.createElement("button");
        this.addItem(this.eActivateBtn);
        this.eActivateBtn.id = "activatebtn";
        this.eActivateBtn.addEventListener("click", async e => {
            e.stopPropagation();
            if (this.generating) {
                try {
                    window.api.send("exec-term");
                } catch (e) { await this.app.doError("Exec Termination Error", "", e); }
                return;
            }
            if (!this.page.hasProject()) return;
            if (!this.page.project.hasPath(this.page.selectedPath)) return;
            let path = this.page.project.getPath(this.page.selectedPath);
            this.generating = true;
            this.app.markChange("*all");
            await this.app.post("cmd-save");
            try {
                await window.api.send("exec", this.page.project.id, path.id);
            } catch (e) { this.app.doError("Exec Error", "", e); }
            this.generating = false;
        });

        this.generating = false;

        let buttons = {};
        let visual = null, visualId = null;

        this.addHandler("revisualize", () => {
            if (visual) {
                this.page.odometry2d.render.remRender(visual.visual);
                this.page.odometry2d.render.remRender(visual.item.d2);
                this.page.odometry3d.remRender(visual.item.d3);
            }
            visual = null;
            visualId = null;
            updateVisual();
        });

        const updatePaths = () => {
            let paths = {};
            if (this.page.hasProject())
                this.page.project.paths.forEach(id => (paths[id] = this.page.project.getPath(id)));
            for (let id in buttons) {
                if (id in paths) continue;
                this.remButton(buttons[id]);
                delete buttons[id];
            }
            for (let id in paths) {
                if (!(id in buttons)) buttons[id] = this.addButton(new App.ProjectPage.PathsPanel.Button(this, null));
                let btn = buttons[id];
                btn.path = paths[id];
                btn.selected = this.page.selectedPath == btn.path.id;
            }
        };
        this.page.addHandler("change-project", updatePaths);
        this.page.addHandler("change-project.addPath", updatePaths);
        this.page.addHandler("change-project.remPath", updatePaths);
        this.page.addHandler("change-selectedPath", updatePaths);
        const updateVisual = () => {
            if (visualId == this.page.selectedPath) return;
            visualId = this.page.selectedPath;
            if (visual) {
                this.page.odometry2d.render.remRender(visual.visual);
                this.page.odometry2d.render.remRender(visual.item.d2);
                this.page.odometry3d.remRender(visual.item.d3);
            }
            visual = this.page.hasSelectedPath() ? { playback: new util.Playback() } : null;
            if (visual) {
                visual.visual = this.page.odometry2d.render.addRender(new RVisual(this.page.odometry2d.render));
                visual.item = {
                    d2: this.page.odometry2d.render.addRender(new RVisualItem2d(this.page.odometry2d.render, visual.visual)),
                    d3: this.page.odometry3d.addRender(new RVisualItem3d(this.page.odometry3d, visual.visual)),
                };
                visual.item.d3.color = "--cb";
                let theVisual = visual, theVisualId = visualId;
                (async () => {
                    const clear = () => {
                        if (visual) {
                            this.page.odometry2d.render.remRender(visual.visual);
                            this.page.odometry2d.render.remRender(visual.item.d2);
                            this.page.odometry3d.remRender(visual.item.d3);
                        }
                        visual = null;
                    };
                    let datas = await window.api.send("exec-get", this.page.projectId);
                    if (!util.is(datas, "obj")) return clear();
                    if (!(theVisualId in datas)) return clear();
                    let data = datas[theVisualId];
                    if (!util.is(data, "obj")) return clear();
                    theVisual.visual.dt = data.dt*1000;
                    theVisual.visual.nodes = util.ensure(data.state, "arr").map(node => {
                        node = util.ensure(node, "obj");
                        node = new sublib.Project.Node(
                            new V(node.x, node.y).mul(100),
                            node.theta, true,
                            new V(node.vx, node.vy).mul(100),
                            0, true,
                        );
                        return node;
                    });
                    theVisual.playback.tsMax = theVisual.visual.dt * theVisual.visual.nodes.length;
                    theVisual.playback.play();
                })();
            }
        };
        this.page.addHandler("change-selectedPath", updateVisual);

        let boolVisual = null;
        
        this.addHandler("update", delta => {
            if (boolVisual != !!visual) {
                boolVisual = !!visual;
                if (visual) {
                    this.page.displayPathLines = false;
                    this.page.eNavActionButton.disabled = this.page.eNavBackButton.disabled = this.page.eNavForwardButton.disabled = false;
                } else {
                    this.page.displayPathLines = true;
                    this.page.eNavActionButton.disabled = this.page.eNavBackButton.disabled = this.page.eNavForwardButton.disabled = true;
                    this.page.progress = 0;
                    if (this.page.eNavActionButton.children[0])
                        this.page.eNavActionButton.children[0].name = "play";
                    this.page.eNavProgressTooltip.textContent = "Select a Path";
                    this.page.eNavInfo.textContent = "No Path Selected";
                }
            }
            if (!visual) return;
            visual.playback.update(delta);
            visual.item.d2.interp = visual.playback.progress;
            visual.item.d3.interp = visual.playback.progress;
            visual.item.d2.size = this.page.hasProject() ? this.page.project.robotW : 0;
            this.page.progress = visual.playback.progress;
            if (this.page.eNavActionButton.children[0])
                this.page.eNavActionButton.children[0].name = visual.playback.finished ? "refresh" : visual.playback.paused ? "play" : "pause";
            this.page.eNavProgressTooltip.textContent = util.formatTime(visual.playback.tsMax*this.page.progressHover);
            this.page.eNavInfo.textContent = util.formatTime(visual.playback.ts) + " / " + util.formatTime(visual.playback.tsMax);
        });

        this.addHandler("refresh", () => {
            let has = this.page.hasProject();
            this.btn.disabled = !has;
            this.eAddBtn.disabled = !has;
            this.eActivateBtn.disabled = !this.generating && (!has || !this.page.hasSelectedPath());
            this.eActivateBtn.textContent = this.generating ? "Terminate" : "Generate";
            this.eActivateBtn.classList.remove("on");
            this.eActivateBtn.classList.remove("off");
            this.generating ? this.eActivateBtn.classList.add("off") : this.eActivateBtn.classList.add("on");
        });

        this.page.eNavProgress.addEventListener("mousedown", e => {
            if (this.page.choosing) return;
            if (e.button != 0) return;
            if (!visual) return;
            e.preventDefault();
            e.stopPropagation();
            let paused = visual.playback.paused;
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                if (!visual) return;
                visual.playback.paused = paused;
            };
            const mousemove = e => {
                if (!visual) return;
                visual.playback.paused = true;
                visual.playback.progress = this.page.progressHover;
            };
            mousemove(e);
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.page.eNavActionButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!visual) return;
            if (visual.isFinished) {
                visual.playback.ts = visual.playback.tsMin;
                visual.playback.play();
            } else visual.playback.paused = !visual.playback.paused;
        });
        this.page.eNavBackButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!visual) return;
            visual.playback.ts = visual.playback.tsMin;
        });
        this.page.eNavForwardButton.addEventListener("click", e => {
            e.stopPropagation();
            if (!visual) return;
            visual.playback.ts = visual.playback.tsMax;
        });
        this.page.addHandler("nav-back", () => {
            if (!visual) return;
            visual.playback.ts -= 5000;
        });
        this.page.addHandler("nav-forward", () => {
            if (!visual) return;
            visual.playback.ts += 5000;
        });
    }

    get generating() { return this.#generating; }
    set generating(v) {
        v = !!v;
        if (this.generating == v) return;
        this.#generating = v;
        this.page.editorRefresh();
        this.revisualize();
    }

    get buttons() { return [...this.#buttons]; }
    set buttons(v) {
        v = util.ensure(v, "arr");
        this.clearButtons();
        this.addButton(v);
    }
    clearButtons() {
        let btns = this.buttons;
        this.remButton(btns);
        return btns;
    }
    hasButton(btn) {
        if (!(btn instanceof App.ProjectPage.PathsPanel.Button)) return false;
        return this.#buttons.has(btn) && btn.panel == this;
    }
    addButton(...btns) {
        let r = util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof App.ProjectPage.PathsPanel.Button)) return false;
            if (btn.panel != this) return false;
            if (this.hasButton(btn)) return false;
            this.#buttons.add(btn);
            const onTrigger = e => {
                if (this.page.choosing) return;
                this.page.selectedPath = btn.path;
            };
            const onEdit = () => {
                onTrigger(null);
                if (this.page.choosing) return;
                if (!btn.hasPath()) return;
                let pth = btn.path;
                this.page.choosing = true;
                this.page.displayPath = pth;
                let nodes = pth.nodes;
                this.page.chooseState.addHandler("choose", (itm, shift) => {
                    if (!this.page.hasDisplayPath()) return;
                    let path = this.page.displayPath;
                    shift = !!shift;
                    if (!(itm instanceof sublib.Project.Node)) return;
                    if (shift) path.remNode(itm);
                    else path.addNode(itm);
                });
                this.page.chooseState.addHandler("done", () => {
                });
                this.page.chooseState.addHandler("cancel", () => {
                    if (!this.page.hasDisplayPath()) return;
                    this.page.displayPath.nodes = nodes;
                });
            };
            const onRemove = () => {
                onTrigger(null);
                if (this.page.choosing) return;
                if (!this.page.hasProject()) return;
                this.page.project.remPath(btn.path);
            };
            const onChange = () => {
                this.page.editorRefresh();
            };
            btn.addLinkedHandler(this, "trigger", onTrigger);
            btn.addLinkedHandler(this, "edit", onEdit);
            btn.addLinkedHandler(this, "remove", onRemove);
            btn.addLinkedHandler(this, "change", onChange);
            this.ePathsBox.appendChild(btn.elem);
            btn.onAdd();
            return btn;
        });
        this.page.editorRefresh();
        return r;
    }
    remButton(...btns) {
        let r = util.Target.resultingForEach(btns, btn => {
            if (!(btn instanceof App.ProjectPage.PathsPanel.Button)) return false;
            if (btn.panel != this) return false;
            if (!this.hasButton(btn)) return false;
            btn.onRem();
            this.#buttons.delete(btn);
            btn.clearLinkedHandlers(this, "trigger");
            btn.clearLinkedHandlers(this, "edit");
            btn.clearLinkedHandlers(this, "remove");
            btn.clearLinkedHandlers(this, "change");
            this.ePathsBox.removeChild(btn.elem);
            return btn;
        });
        this.page.editorRefresh();
        return r;
    }

    revisualize() { this.post("revisualize"); }

    get eAddBtn() { return this.#eAddBtn; }
    get ePathsBox() { return this.#ePathsBox; }
    get eActivateBtn() { return this.#eActivateBtn; }
};
App.ProjectPage.PathsPanel.Button = class AppProjectPagePathsPanelButton extends util.Target {
    #panel;
    #page;
    #app;

    #path;

    #elem;
    #eName;
    #eEdit;
    #eRemove;

    constructor(panel, path) {
        super();

        if (!(panel instanceof App.ProjectPage.PathsPanel)) throw new Error("Panel is not of class PathsPanel");
        this.#panel = panel;
        this.#page = this.panel.page;
        this.#app = this.page.app;

        this.#path = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eName = document.createElement("input");
        this.elem.appendChild(this.eName);
        this.eName.type = "text";
        this.eName.placeholder = "Path Name";
        this.eName.autocomplete = "off";
        this.eName.spellcheck = false;
        this.#eEdit = document.createElement("button");
        this.elem.appendChild(this.eEdit);
        this.eEdit.innerHTML = "<ion-icon name='pencil'></ion-icon>";
        this.#eRemove = document.createElement("button");
        this.elem.appendChild(this.eRemove);
        this.eRemove.innerHTML = "<ion-icon name='close'></ion-icon>";

        this.elem.addEventListener("click", e => {
            e.stopPropagation();
            this.post("trigger", e);
        });
        this.eEdit.addEventListener("click", e => {
            e.stopPropagation();
            this.post("edit");
        });
        this.eRemove.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove");
        });

        this.eName.addEventListener("change", e => {
            if (!this.hasPath()) return;
            this.path.name = this.eName.value;
        });

        const update = () => {
            this.eName.value = this.hasPath() ? this.path.name : "";
        };
        this.addHandler("change", update);

        this.path = path;
    }

    get panel() { return this.#panel; }
    get page() { return this.#page; }
    get app() { return this.#app; }

    get path() { return this.#path; }
    set path(v) {
        v = (v instanceof sublib.Project.Path) ? v : null;
        if (this.path == v) return;
        if (this.hasPath()) this.path.clearLinkedHandlers(this, "change");
        this.change("path", this.path, this.#path=v);
        if (this.hasPath()) this.path.addLinkedHandler(this, "change", (c, f, t) => this.change("path."+c, f, t));
    }
    hasPath() { return !!this.path; }

    get selected() { return this.elem.classList.contains("this"); }
    set selected(v) { v ? this.elem.classList.add("this") : this.elem.classList.remove("this"); }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }
    get eEdit() { return this.#eEdit; }
    get eRemove() { return this.#eRemove; }
};
App.ProjectPage.OptionsPanel = class AppProjectPageOptionsPanel extends App.ProjectPage.Panel {
    #fTemplate;
    #fTemplateApply;
    #fSize;
    #fRobotSize;
    #fRobotMass;
    #fOptions;
    #fScript;
    #fScriptPython;
    #fScriptUseDefault;

    constructor(page) {
        super(page, "options", "settings-outline");

        const templates = core.GLOBALSTATE.getProperty("templates").value;
        const subtemplates = core.GLOBALSTATE.getProperty("subtemplates").value;

        let form = new core.Form();
        this.addItem(form.elem);

        this.#fTemplate = form.addField(new core.Form.DropdownInput("template", [], "§null"));
        this.fTemplate.app = this.app;
        this.fTemplate.isSubHeader = false;
        this.fTemplate.values = [{ value: "§null", name: "No Template" }, null, ...Object.keys(templates)];
        this.fTemplate.addHandler("change-value", () => {
            if (!this.fTemplate.hasValue()) return;
            if (this.page.hasProject())
                this.page.project.template = (this.fTemplate.value == "§null") ? null : this.fTemplate.value;
            this.page.editorRefresh();
        });
        this.#fTemplateApply = form.addField(new core.Form.Button("template-apply", "Apply Template", "special"));
        this.fTemplateApply.showHeader = false;
        this.fTemplateApply.addHandler("trigger", async e => {
            if (!this.page.hasProject()) return;
            await this.page.applyTemplate(this.page.project, this.page.project.template);
            this.page.editorRefresh();
        });

        form.addField(new core.Form.Header("Map Options"));

        this.#fSize = form.addField(new core.Form.Input2d("map-size"));
        this.fSize.app = this.app;
        this.fSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fSize.baseType = this.fSize.activeType = "m";
        this.fSize.step = 0.1;
        this.fSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
        });
        this.fSize.addHandler("change-value", () => {
            if (!this.fSize.hasValue()) return;
            const hasX = this.fSize.hasValue("x");
            const hasY = this.fSize.hasValue("y");
            if (this.page.hasProject()) {
                if (hasX) this.page.project.x = this.fSize.x;
                if (hasY) this.page.project.y = this.fSize.y;
            }
            this.page.editorRefresh();
        });

        this.#fRobotSize = form.addField(new core.Form.Input1d("robot-size"));
        this.fRobotSize.app = this.app;
        this.fRobotSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fRobotSize.baseType = this.fRobotSize.activeType = "m";
        this.fRobotSize.step = 0.1;
        this.fRobotSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["...", "Height"][i];
            inp.min = 0;
        });
        this.fRobotSize.addHandler("change-value", () => {
            if (!this.fRobotSize.hasValue()) return;
            if (this.page.hasProject())
                this.page.project.robotSize = this.fRobotSize.value * 100;
            this.page.editorRefresh();
        });

        this.#fRobotMass = form.addField(new core.Form.Input1d("robot-mass"));
        this.fRobotMass.app = this.app;
        this.fRobotMass.types = ["kg", "lb"];
        this.fRobotMass.baseType = this.fRobotMass.activeType = "kg";
        this.fRobotMass.step = 0.1;
        this.fRobotMass.inputs.forEach(inp => {
            inp.placeholder = "...";
            inp.min = 0;
        });
        this.fRobotMass.addHandler("change-value", () => {
            if (!this.fRobotMass.hasValue()) return;
            if (this.page.hasProject())
                this.page.project.robotMass = this.fRobotMass.value;
            this.page.editorRefresh();
        });

        form.addField(new core.Form.Header("Script Options"));

        this.#fOptions = form.addField(new core.Form.JSONInput("options"));
        this.fOptions.addHandler("set", (k, v0, v1) => {
            if (this.page.hasProject())
                this.page.project.config.setOption(k, v1);
            this.page.editorRefresh();
        });
        this.fOptions.addHandler("del", (k, v) => {
            if (this.page.hasProject())
                this.page.project.config.delOption(k);
            this.page.editorRefresh();
        });

        this.#fScript = form.addField(new core.Form.DirentInput("generator-script"));
        this.fScript.dialogTitle = "Choose a python script";
        this.fScript.dialogFilters = [{ name: "Python", extensions: ["py"] }];
        this.fScript.type = ".py";
        this.fScript.eInput.placeholder = "File path...";
        this.fScript.addHandler("change-value", () => {
            if (this.page.hasProject())
                this.page.project.config.script = util.ensure(this.fScript.value, "str");
            this.page.editorRefresh();
        });

        this.#fScriptPython = form.addField(new core.Form.TextInput("script-python"));
        this.fScriptPython.type = "shell";
        this.fScriptPython.inputs.forEach(inp => {
            inp.placeholder = "Python command";
        });
        this.fScriptPython.addHandler("change-value", () => {
            if (this.page.hasProject())
                this.page.project.config.scriptPython = util.ensure(this.fScriptPython.value, "str");
            this.page.editorRefresh();
        });

        this.#fScriptUseDefault = form.addField(new core.Form.BooleanInput("default-generator-script"));
        this.fScriptUseDefault.addHandler("change-value", () => {
            if (this.page.hasProject())
                this.page.project.config.scriptUseDefault = this.fScriptUseDefault.value;
            this.page.editorRefresh();
        });

        this.addHandler("refresh", () => {
            let has = this.page.hasProject();
            this.btn.disabled = !has;
            this.fTemplate.disabled = !has;
            this.fTemplate.value = has ? this.page.project.hasTemplate() ? this.page.project.template : "§null" : null;
            this.fTemplateApply.disabled = !has || !this.page.project.hasTemplate();
            this.fSize.isShown = has && !this.page.project.hasTemplate();
            this.fSize.disabled = !has;
            this.fSize.value = has ? this.page.project.size.div(100) : null;
            this.fRobotSize.disabled = !has;
            this.fRobotSize.value = has ? this.page.project.robotSize.div(100).x : null;
            this.fRobotMass.disabled = !has;
            this.fRobotMass.value = has ? this.page.project.robotMass : null;
            this.fOptions.disabled = !has;
            if (has) {
                this.fOptions.keys.forEach(k => {
                    if (this.page.project.config.hasOption(k)) return;
                    this.fOptions.del(k);
                });
                this.page.project.config.optionKeys.forEach(k => {
                    this.fOptions.set(k, this.page.project.config.getOption(k));
                });
            } else this.fOptions.map = null;
            this.fScript.disabled = !has;
            this.fScript.value = has ? this.page.project.config.script : null;
            this.fScriptPython.disabled = !has;
            this.fScriptPython.value = has ? this.page.project.config.scriptPython : null;
            this.fScriptUseDefault.disabled = !has;
            this.fScriptUseDefault.value = has ? this.page.project.config.scriptUseDefault : null;
        });
    }

    get fTemplate() { return this.#fTemplate; }
    get fTemplateApply() { return this.#fTemplateApply; }
    get fSize() { return this.#fSize; }
    get fRobotSize() { return this.#fRobotSize; }
    get fRobotMass() { return this.#fRobotMass; }
    get fOptions() { return this.#fOptions; }
    get fScript() { return this.#fScript; }
    get fScriptPython() { return this.#fScriptPython; }
    get fScriptUseDefault() { return this.#fScriptUseDefault; }
}
