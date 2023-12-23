import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

import * as subcore from "./core.mjs";


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
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--cg-8");
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
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--v8");
            let p = this.odometry.worldToCanvas(this.pos).add(new V(0,15).add(offset).mul(+1,-1).mul(quality));
            ctx.fillText(this.text, ...p.xy);
        });
    }

    get item() { return this.#item; }
    set item(v) {
        v = (v instanceof subcore.Project.Item) ? v : null;
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
            if (a.dist(b) < this.odometry.pageLenToWorld((7.5+5)*2)) return;
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--cg-8");
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
        v = (v instanceof subcore.Project.Item) ? v : null;
        if (this.item == v) return;
        this.#itemA = v;
    }
    hasItemA() { return !!this.itemA; }
    get itemB() { return this.#itemB; }
    set itemB(v) {
        v = (v instanceof subcore.Project.Item) ? v : null;
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
                g: new util.Color(getComputedStyle(document.body).getPropertyValue("--cg")),
                y: new util.Color(getComputedStyle(document.body).getPropertyValue("--cy")),
                r: new util.Color(getComputedStyle(document.body).getPropertyValue("--cr")),
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
                if (i > 0 && nj.pos.dist(ni.pos) < 1) continue;
                let pi = this.odometry.worldToCanvas(ni.pos);
                let vi = ni.velocity.dist();
                let ci = getColor(vi);
                if (i <= 0) {
                    [nj, pj, vj, cj] = [ni, pi, vi, ci];
                    continue;
                }
                let grad = ctx.createLinearGradient(...pj.xy, ...pi.xy);
                grad.addColorStop(0, cj.toRGBA());
                grad.addColorStop(1, ci.toRGBA());
                ctx.strokeStyle = grad;
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
        this.#nodes = v.map(v => new subcore.Project.Node(v));
    }
}
class RVisualItem extends core.Odometry2d.Robot {
    #visual;
    #interp;

    constructor(odometry, visual) {
        super(odometry);

        this.z2 = -1;

        this.#visual = null;
        this.#interp = 0;

        this.addHandler("render", () => {
            if (!this.hasVisual()) return;
            let p = this.interp;
            let nodes = this.visual.nodes;
            let i = Math.floor((nodes.length-1)*p);
            let j = Math.min(i+1, nodes.length-1);
            let ni = nodes[i], nj = nodes[j];
            p = ((nodes.length-1)*p) - i;
            let node = new subcore.Project.Node(
                util.lerp(ni.pos, nj.pos, p),
                ni.heading + util.angleRelRadians(ni.heading, nj.heading)*p, true,
                util.lerp(ni.velocity, nj.velocity),
                0, true,
            );
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
class RSelect extends core.Odometry2d.Render {
    #a; #b;

    constructor(odometry) {
        super(odometry);

        this.z2 = 3;

        this.#a = new V();
        this.#b = new V();

        this.addHandler("render", () => {
            const ctx = this.odometry.ctx, quality = this.odometry.quality, padding = this.odometry.padding, scale = this.odometry.scale;
            ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--v8");
            ctx.lineWidth = 2*quality;
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
    #ghost;

    #item;
    #renderObject;

    constructor(odometry, item) {
        super(odometry);

        this.#ghost = false;

        this.#item = null;
        this.#renderObject = null;

        this.addHandler("change-item", () => {
            this.renderObject = null;
            if (!this.hasItem()) return;
            if (this.item instanceof subcore.Project.Node) {
                this.renderObject = new core.Odometry2d.Robot(this);
            } else if (this.item instanceof subcore.Project.Obstacle) {
                this.renderObject = new core.Odometry2d.Obstacle(this);
            }
        });

        this.addHandler("render", () => {
            if (!this.hasItem()) return;
            if (!this.hasRenderObject()) return;
            const render = this.renderObject;
            render.pos = this.item.pos;
            render.alpha = this.ghost ? 0.5 : 1;
            if (this.item instanceof subcore.Project.Node) {
                render.velocity = this.item.velocity;
                render.showVelocity = this.item.useVelocity;
                render.heading = this.item.heading * (180/Math.PI);
            } else if (this.item instanceof subcore.Project.Obstacle) {
                render.radius = this.item.radius;
            }
        });

        this.item = item;
    }

    get ghost() { return this.#ghost; }
    set ghost(v) { this.#ghost = !!v; }

    get item() { return this.#item; }
    set item(v) {
        v = (v instanceof subcore.Project.Item) ? v : null;
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
        if (this.item instanceof subcore.Project.Node) {
            let partfs = {
                velocity: "grab",
                heading: "grab",
            };
            if (part in partfs) return partfs[part];
        } else if (this.item instanceof subcore.Project.Obstacle) {
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
        if (this.item instanceof subcore.Project.Node) {
            let partfs = {
                velocity: () => {
                    this.item.velocity = pos.sub(this.item.pos);
                },
                heading: () => {
                    this.item.heading = (Math.PI/180) * this.item.pos.towards(pos);
                },
            };
            if (part in partfs) partfs[part]();
        } else if (this.item instanceof subcore.Project.Obstacle) {
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
    static PROJECTCLASS = subcore.Project;
    static REVIVER = subcore.REVIVER;

    constructor() {
        super();

        this.addHandler("pre-post-setup", () => {
            ["file", "edit", "view"].forEach(name => {
                let id = "menu:"+name;
                let menu = this.menu.findItemWithId(id);
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
            const globalTemplates = util.ensure(await window.api.get("templates"), "obj");
            this.eTemplates.innerHTML = "";
            for (let name in globalTemplates) {
                let btn = document.createElement("button");
                this.eTemplates.appendChild(btn);
                btn.textContent = name;
                btn.addEventListener("click", e => {
                    this.app.setPage("PROJECT", { template: name });
                });
            }
            let btn = document.createElement("button");
            this.eTemplates.appendChild(btn);
            btn.textContent = "Blank Project";
            btn.addEventListener("click", e => {
                this.app.setPage("PROJECT", { template: null });
            });
        });
    }

    get eTemplates() { return this.#eTemplates; }
};
App.ProjectPage = class AppProjectPage extends App.ProjectPage {
    #odometry;

    #selected;
    #selectedPaths;

    #choosing;
    #chooseState;

    #displayPath;

    #maximized;
    #divPos;

    #panels;
    #panel;

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

        document.body.addEventListener("click", e => {
            if (this.choosing) return;
            if (this.eDisplay.contains(e.target)) return;
            if (this.eNav.contains(e.target)) return;
            // this.clearSelectedPaths();
        });

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
                node: new subcore.Project.Node({ pos: 0, heading: 0, useHeading: true, velocity: 0, velocityRot: 0, useVelocity: false }),
                obstacle: new subcore.Project.Obstacle({ pos: 0, radius: 100 }),
            }[this.app.dragData];
            this.app.dragState.addHandler("move", e => {
                let pos = new V(e.pageX, e.pageY);
                let r;
                r = this.odometry.canvas.getBoundingClientRect();
                let overRender = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                if (prevOverRender != overRender) {
                    prevOverRender = overRender;
                    if (overRender) {
                        ghostItem = this.odometry.render.addRender(new RSelectable(this.odometry.render, item));
                        ghostItem.ghost = true;
                    } else {
                        this.odometry.render.remRender(ghostItem);
                        ghostItem = null;
                    }
                }
                if (this.app.eDrag.children[0])
                    this.app.eDrag.children[0].style.visibility = overRender ? "hidden" : "inherit";
                if (ghostItem && ghostItem.hasItem())
                    ghostItem.item.pos.set(this.odometry.pageToWorld(pos));
                if (!this.hasPanel("objects")) return;
                const panel = this.getPanel("objects");
                r = panel.eSpawnDelete.getBoundingClientRect();
                let over = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                if (over) panel.eSpawnDelete.classList.add("hover");
                else panel.eSpawnDelete.classList.remove("hover");
            });
            const stop = cancel => {
                this.odometry.render.remRender(ghostItem);
                this.app.eDrag.innerHTML = "";
                if (!cancel && prevOverRender && this.hasProject()) this.project.addItem(item);
                if (!this.hasPanel("objects")) return;
                const panel = this.getPanel("objects");
                panel.eSpawnBox.classList.remove("delete");
            };
            this.app.dragState.addHandler("submit", () => stop(false));
            this.app.dragState.addHandler("cancel", () => stop(true));
            if (!this.hasPanel("objects")) return;
            const panel = this.getPanel("objects");
            panel.eSpawnBox.classList.add("delete");
        };
        this.app.addHandler("cmd-addnode", () => cmdAdd("node"));
        this.app.addHandler("cmd-addobstacle", () => cmdAdd("obstacle"));
        this.app.addHandler("cmd-addpath", () => {
            if (this.choosing) return;
            if (!this.hasProject()) return;
            this.choosing = true;
            this.displayPath = new subcore.Project.Path();
            this.chooseState.addHandler("choose", (itm, shift) => {
                if (!this.hasDisplayPath()) return;
                let path = this.displayPath;
                shift = !!shift;
                if (!(itm instanceof subcore.Project.Node)) return;
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
            this.maximized = !this.maximized;
        });
        this.app.addHandler("cmd-resetdivider", () => {
            this.divPos = 0.75;
        });

        this.#odometry = new core.Odometry2d();

        this.#selected = new Set();
        this.#selectedPaths = new Set();

        this.#choosing = false;
        this.#chooseState = null;

        this.#displayPath = null;

        this.#maximized = null;
        this.#divPos = null;

        this.#panels = {};
        this.#panel = null;

        this.#eDisplay = document.createElement("div");
        this.eMain.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");

        this.#eBlockage = document.createElement("div");
        this.eDisplay.appendChild(this.eBlockage);
        this.eBlockage.classList.add("blockage");

        this.odometry.canvas = document.createElement("canvas");
        this.eDisplay.appendChild(this.odometry.canvas);
        this.odometry.canvas.tabIndex = 1;
        new ResizeObserver(() => {
            let r = this.eDisplay.getBoundingClientRect();
            this.odometry.canvas.width = r.width*this.odometry.quality;
            this.odometry.canvas.height = r.height*this.odometry.quality;
            this.odometry.canvas.style.width = r.width+"px";
            this.odometry.canvas.style.height = r.height+"px";
        }).observe(this.eDisplay);
        this.odometry.canvas.addEventListener("keydown", e => {
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
        });
        this.odometry.canvas.addEventListener("contextmenu", e => {
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
        });
        this.odometry.canvas.addEventListener("mousedown", e => {
            const hovered = this.odometry.hovered;
            const hoveredPart = this.odometry.hoveredPart;
            if (this.choosing) {
                if (!(hovered instanceof core.Odometry2d.Render)) return;
                if (!(hovered.parent instanceof RSelectable)) return;
                this.chooseState.post("choose", hovered.parent.item, !!e.shiftKey);
                return;
            }
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            if (!(hovered instanceof core.Odometry2d.Render && hovered.parent instanceof RSelectable)) {
                this.clearSelected();
                let selectItem = this.odometry.render.addRender(new RSelect(this.odometry.render));
                selectItem.a = this.odometry.pageToWorld(e.pageX, e.pageY);
                selectItem.b = selectItem.a;
                const mouseup = () => {
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                    this.odometry.render.remRender(selectItem);
                    let a = selectItem.a, b = selectItem.b;
                    let r = new util.Rect(a, b.sub(a)).normalize();
                    if (!this.hasProject()) return;
                    this.project.items.forEach(id => {
                        let itm = this.project.getItem(id);
                        if (r.collides(itm.getBBox())) this.addSelected(itm);
                    });
                };
                const mousemove = e => {
                    selectItem.b = this.odometry.pageToWorld(e.pageX, e.pageY);
                };
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
            } else {
                if (hoveredPart != null && hoveredPart != "main") {
                    const mouseup = () => {
                        document.body.removeEventListener("mouseup", mouseup);
                        document.body.removeEventListener("mousemove", mousemove);
                        this.odometry.canvas.style.cursor = "";
                    };
                    const mousemove = e => {
                        this.odometry.canvas.style.cursor = hovered.parent.drag(hoveredPart, this.odometry.pageToWorld(e.pageX, e.pageY));
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
                let oldPos = this.odometry.pageToWorld(e.pageX, e.pageY);
                const mouseup = () => {
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                    this.odometry.canvas.style.cursor = "";
                };
                const mousemove = e => {
                    let newPos = this.odometry.pageToWorld(e.pageX, e.pageY);
                    let rel = newPos.sub(oldPos);
                    this.selected.forEach(id => {
                        if (!this.hasProject() || !this.project.hasItem(id)) return;
                        let itm = this.project.getItem(id);
                        itm.pos.iadd(rel);
                    });
                    oldPos.set(newPos);
                    this.editorRefresh();
                    this.odometry.canvas.style.cursor = "move";
                };
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
            }
        });

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
        this.eChooseDoneBtn.id = "donebtn";
        this.eChooseDoneBtn.textContent = "Done";
        this.#eChooseCancelBtn = document.createElement("button");
        this.eChooseNav.appendChild(this.eChooseCancelBtn);
        this.eChooseCancelBtn.id = "cancelbtn";
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
        this.eEditNav.addEventListener("click", e => e.stopPropagation());
        
        this.#eDivider = document.createElement("div");
        this.eMain.insertBefore(this.eDivider, this.eEdit);
        this.eDivider.classList.add("divider");
        this.eDivider.addEventListener("mousedown", e => {
            e.preventDefault();
            e.stopPropagation();
            if (this.choosing) return;
            if (e.button != 0) return;
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                this.eDivider.classList.remove("this");
            };
            const mousemove = e => {
                let parent = this.eDivider.parentElement;
                if (!parent) return;
                let r = parent.getBoundingClientRect();
                this.divPos = Math.min(0.9, Math.max(0.1, (e.pageX-r.left) / r.width));
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
            this.eDivider.classList.add("this");
        });

        this.addPanel(new App.ProjectPage.ObjectsPanel(this));
        this.addPanel(new App.ProjectPage.PathsPanel(this));
        this.addPanel(new App.ProjectPage.OptionsPanel(this));

        this.panel = "objects";

        this.addHandler("change-project", (...a) => {
            this.editorRefresh();
        });

        let displayPathRenders = {};

        let itemRenders = {};

        let timer = 0;
        this.addHandler("update", delta => {
            this.odometry.update(delta);
            this.odometry.size = this.hasProject() ? this.project.size : 0;
            this.odometry.imageSrc = this.hasProject() ? this.project.meta.backgroundImage : null;
            this.odometry.autoScale();

            this.pruneSelected();
            this.pruneSelectedPaths();

            if (!this.choosing) {
                let id = this.selectedPaths.length > 0 ? this.selectedPaths[0] : null;
                this.displayPath = (this.hasProject() && this.project.hasPath(id)) ? this.project.getPath(id) : null;
            }

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
                if (!(id in displayPathRenders))
                    displayPathRenders[id] = this.odometry.render.addRender(new RLabel(this.odometry.render, null));
                delete toDelete[id];
                let label = displayPathRenders[id];
                label.item = node;
                if (label.text.length <= 0) label.text = i+1;
                else label.text += ", "+(i+1);
                if (i <= 0) continue;
                let id2 = nodes[i-1];
                let node2 = this.project.getItem(id2);
                let lid = (i-1)+"~"+i;
                if (!(lid in displayPathRenders))
                    displayPathRenders[lid] = this.odometry.render.addRender(new RLine(this.odometry.render, null, null));
                delete toDelete[lid];
                let line = displayPathRenders[lid];
                line.itemA = node2;
                line.itemB = node;
            }
            for (let id in toDelete) {
                this.odometry.render.remRender(displayPathRenders[id]);
                delete displayPathRenders[id];
            }

            let itms = {};
            if (this.hasProject())
                this.project.items.forEach(id => (itms[id] = this.project.getItem(id)));
            for (let id in itemRenders) {
                if (id in itms) continue;
                this.odometry.render.remRender(itemRenders[id]);
                delete itemRenders[id];
            }
            for (let id in itms) {
                if (!(id in itemRenders))
                    itemRenders[id] = this.odometry.render.addRender(new RSelectable(this.odometry.render, null));
                let render = itemRenders[id];
                render.item = itms[id];
                render.selected = this.isSelected(render);
                if (render.renderObject instanceof core.Odometry2d.Robot)
                    render.renderObject.size = this.project.robotW;
            }

            this.panels.forEach(name => this.getPanel(name).update(delta));

            const hovered = this.odometry.hovered;
            const hoveredPart = this.odometry.hoveredPart;
            if (!(hovered instanceof core.Odometry2d.Render)) this.odometry.canvas.style.cursor = "crosshair";
            else if (!(hovered.source instanceof RSelectable)) this.odometry.canvas.style.cursor = "crosshair";
            else this.odometry.canvas.style.cursor = hovered.source.hover(hoveredPart);

            if (timer > 0) return timer -= delta;
            timer = 1000;
            if (!this.hasProject()) return;
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
            this.maximized = false;
            this.divPos = 0.75;
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
                if (!selectItem) selectItem = this.odometry.render.addRender(new RSelect(this.odometry.render));
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
                this.odometry.render.remRender(selectItem);
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
                let itm = this.app.menu.findItemWithId(id);
                if (!itm) return;
                itm.exists = true;
            });
            await this.refresh();
            await this.editorRefresh();
            this.odometry.canvas.focus();
            const globalTemplates = util.ensure(await window.api.get("templates"), "obj");
            const globalTemplateImages = util.ensure(await window.api.get("template-images"), "obj");
            const activeTemplate = await window.api.get("active-template");
            let templatesContent = "";
            try {
                templatesContent = await window.api.fileRead("templates.json");
            } catch (e) {}
            let templates = null;
            try {
                templates = JSON.parse(templatesContent);
            } catch (e) {}
            templates = util.ensure(util.ensure(templates, "obj").templates, "obj");
            if (this.app.hasProject(data.id)) {
                this.project = this.app.getProject(data.id);
            } else if (data.project instanceof subcore.Project) {
                this.project = data.project;
            } else {
                this.project = new subcore.Project();
                this.project.meta.created = this.project.meta.modified = util.getTime();
                this.project.meta.backgroundImage = globalTemplateImages[("template" in data) ? data.template : activeTemplate];
                this.editorRefresh();
            }
            if (this.hasProject()) {
                for (let name in globalTemplates) {
                    if (this.project.meta.backgroundImage != globalTemplateImages[name]) continue;
                    const globalTemplate = util.ensure(globalTemplates[name], "obj");
                    let template = util.ensure(templates[name], "obj");
                    template[".size"] = globalTemplate["size"];
                    template[".robotW"] = globalTemplate["robotSize"];
                    template[".robotMass"] = globalTemplate["robotMass"];
                    template[".meta.backgroundImage"] = globalTemplateImages[name];
                    for (let k in template) {
                        let v = template[k];
                        k = String(k).split(".");
                        while (k.length > 0 && k.at(0).length <= 0) k.shift();
                        while (k.length > 0 && k.at(-1).length <= 0) k.pop();
                        let obj = this.project;
                        while (k.length > 1) {
                            if (!util.is(obj, "obj")) {
                                obj = null;
                                break;
                            }
                            obj = obj[k.shift()];
                        }
                        if (obj == null || k.length != 1) continue;
                        obj[k] = v;
                    }
                    break;
                }
                this.editorRefresh();
            }
        });
        this.addHandler("leave", async data => {
            let projectOnly = [
                "addnode", "addobstacle", "addpath",
                "maxmin", "resetdivider",
            ];
            projectOnly.forEach(id => {
                let itm = this.app.menu.findItemWithId(id);
                if (!itm) return;
                itm.exists = false;
            });
        });
    }

    get odometry() { return this.#odometry; }

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
        if (id instanceof subcore.Project.Item) return this.isSelected(id.id);
        if (id instanceof RSelectable) return this.isSelected(id.item);
        return this.#selected.has(String(id));
    }
    addSelected(...ids) {
        let r = util.Target.resultingForEach(ids, id => {
            if (id instanceof RSelectable) id = id.item;
            if (id instanceof subcore.Project.Item) id = id.id;
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
            if (id instanceof subcore.Project.Item) id = id.id;
            if (!this.isSelected(id)) return false;
            id = String(id);
            this.#selected.delete(id);
            return id;
        });
        this.editorRefresh();
        return r;
    }
    pruneSelected() {
        this.selected.forEach(id => {
            if (this.hasProject() && this.project.hasItem(id)) return;
            this.remSelected(id);
        });
    }

    get selectedPaths() { return [...this.#selectedPaths]; }
    set selectedPaths(v) {
        v = util.ensure(v, "arr");
        this.clearSelectedPaths();
        this.addSelectedPath(v);
    }
    clearSelectedPaths() {
        let pths = this.selectedPaths;
        this.remSelectedPath(pths);
        return pths;
    }
    isPathSelected(id) {
        if (id instanceof subcore.Project.Path) return this.isPathSelected(id.id);
        return this.#selectedPaths.has(String(id));
    }
    addSelectedPath(...ids) {
        let r = util.Target.resultingForEach(ids, id => {
            if (id instanceof subcore.Project.Path) id = id.id;
            if (this.isPathSelected(id)) return false;
            id = String(id);
            if (this.hasProject() && this.project.hasPath(id)) {
                this.#selectedPaths.add(id);
                return id;
            }
            return false;
        });
        this.editorRefresh();
        return r;
    }
    remSelectedPath(...ids) {
        let r = util.Target.resultingForEach(ids, id => {
            if (id instanceof subcore.Project.Path) id = id.id;
            if (!this.isPathSelected(id)) return false;
            id = String(id);
            this.#selectedPaths.delete(id);
            return id;
        });
        this.editorRefresh();
        return r;
    }
    pruneSelectedPaths() {
        this.selectedPaths.forEach(id => {
            if (this.hasProject() && this.project.hasPath(id)) return;
            this.remSelectedPath(id);
        });
    }

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
        v = (v instanceof subcore.Project.Path) ? v : null;
        if (this.displayPath == v) return;
        this.#displayPath = v;
    }
    hasDisplayPath() { return !!this.displayPath; }

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
                text = text.substring(util.MAGIC.length);
                try {
                    let data = JSON.parse(text, subcore.REVIVER.f);
                    if (!util.is(data, "arr")) return;
                    if (!this.hasProject()) return;
                    data.forEach(itm => this.project.addItem(itm));
                } catch (e) {}
            });
        });
        return true;
    }

    get maximized() { return this.#maximized; }
    set maximized(v) {
        v = !!v;
        if (this.maximized == v) return;
        this.#maximized = v;
        this.format();
    }
    get minimized() { return !this.maximized; }
    set minimized(v) { this.maximized = !v; }
    maximize() { return this.maximized = true; }
    minimize() { return this.minimized = true; }
    get divPos() { return this.#divPos; }
    set divPos(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.divPos == v) return;
        this.#divPos = v;
        this.format();
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
            return panel;
        });
    }
    remPanel(...panels) {
        return util.Target.resultingForEach(panels, panel => {
            if (!(panel instanceof App.ProjectPage.Panel)) panel = this.getPanel(panel);
            if (panel.page != this) return false;
            if (!this.hasPanel(panel)) return false;
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
            this.eMaxMinBtn.children[0].setAttribute("name", this.maximized ? "contract" : "expand");
        if (this.maximized) {
            this.eDisplay.style.width = "100%";
            this.eDisplay.style.maxWidth = "100%";
            this.eEdit.style.display = "none";
            this.eDivider.style.display = "none";
        } else {
            this.eDisplay.style.width = "calc("+(this.divPos*100)+"% - 1px)";
            this.eDisplay.style.maxWidth = "calc("+(this.divPos*100)+"% - 1px)";
            this.eEdit.style.display = "";
            this.eEdit.style.width = "calc("+((1-this.divPos)*100)+"% - 1px)";
            this.eEdit.style.maxWidth = "calc("+((1-this.divPos)*100)+"% - 1px)";
            this.eDivider.style.display = "";
        }
    }

    async editorRefresh() { await this.post("editor-refresh"); }

    get state() {
        return {
            id: this.projectId,
        };
    }
    async loadState(state) {
        state = util.ensure(state, "obj");
        await this.app.loadProjects();
        await this.app.setPage(this.name, { id: state.id });
    }

    async determineSame(data) {
        if (this.app.hasProject(data.id)) return this.projectId == data.id;
        else if (data.project instanceof subcore.Project) return this.project == data.project;
        return false;
    }
};
App.ProjectPage.Panel = class AppProjectPagePanel extends util.Target {
    #name;

    #page;
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
            this.page.panel = this.name;
        });

        this.icon = icon;
        this.btnName = this.name.split(" ").map(v => util.capitalize(v)).join(" ");
    }

    get name() { return this.#name; }

    get page() { return this.#page; }
    get app() { return this.page.app; }

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
            return itm;
        });
    }
    remItem(...itms) {
        return util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof App.ProjectPage.Panel.Item) && !(itm instanceof HTMLElement)) return false;
            if (!this.hasItem(itm)) return false;
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

    get icon() { return this.eIcon.getAttribute("name"); }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        this.eIcon.setAttribute("name", v);
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }
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
App.ProjectPage.Panel.Input1d = class AppProjectPagePanelInput1d extends App.ProjectPage.Panel.Item {
    #inputs;

    constructor() {
        super();

        this.elem.classList.add("input");
        this.elem.classList.add("d1");

        this.#inputs = [document.createElement("input")];
        this.inputs.forEach(inp => this.elem.appendChild(inp));
    }

    get inputs() { return [...this.#inputs]; }
};
App.ProjectPage.Panel.Input2d = class AppProjectPagePanelInput2d extends App.ProjectPage.Panel.Item {
    #inputs;

    constructor() {
        super();

        this.elem.classList.add("input");
        this.elem.classList.add("d2");

        this.#inputs = [document.createElement("input"), document.createElement("input")];
        this.inputs.forEach(inp => this.elem.appendChild(inp));
    }

    get inputs() { return [...this.#inputs]; }
};
App.ProjectPage.Panel.Input3d = class AppProjectPagePanelInput3d extends App.ProjectPage.Panel.Item {
    #inputs;

    constructor() {
        super();

        this.elem.classList.add("input");
        this.elem.classList.add("d3");

        this.#inputs = [document.createElement("input"), document.createElement("input"), document.createElement("input")];

        this.elem.innerHTML = "<div></div>";
        this.elem.children[0].appendChild(this.inputs[0]);
        this.elem.children[0].appendChild(this.inputs[1]);
        this.elem.appendChild(this.inputs[2]);
    }

    get inputs() { return [...this.#inputs]; }
};
App.ProjectPage.ObjectsPanel = class AppProjectPageObjectsPanel extends App.ProjectPage.Panel {
    #position;
    #useRobotHeading;
    #robotHeading;
    #robotHeadingDrag;
    #useRobotVelocity;
    #robotVelocity;
    #robotRotVelocity;
    #radius;
    #eOptions;
    #eOptionsAdd;
    #itemControls;
    #remove;

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
        this.eSpawnDelete.innerHTML = "<ion-icon name='trash'></ion-icon>";
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
            eName.textContent = name.split(" ").map(v => util.capitalize(v)).join(" ");
            btn.addEventListener("mousedown", e => {
                e.preventDefault();
                e.stopPropagation();
                if (this.page.choosing) return;
                this.app.post("cmd-add"+name);
            });
        });

        const getSelected = () => {
            if (!this.page.hasProject()) return [];
            return this.page.selected.filter(id => this.page.project.hasItem(id)).map(id => this.page.project.getItem(id));
        };

        let header;

        this.addItem(new App.ProjectPage.Panel.Header("Item Options")).elem.classList.add("forany");

        this.addItem(new App.ProjectPage.Panel.SubHeader("Position", "m")).elem.classList.add("forany");
        this.#position = this.addItem(new App.ProjectPage.Panel.Input2d());
        this.position.elem.classList.add("forany");
        this.position.inputs.forEach((inp, i) => {
            inp.type = "number";
            inp.placeholder = "XY"[i];
            inp.min = 0;
            inp.step = 0.1;
            inp.addEventListener("change", e => {
                let v = inp.value;
                if (v.length > 0) {
                    let itms = getSelected();
                    let xyList = itms.map(itm => itm["xy"[i]]);
                    let newCenter = util.ensure(parseFloat(v), "num")*100;
                    let oldCenter = (Math.max(...xyList) + Math.min(...xyList)) / 2;
                    let rel = newCenter - oldCenter;
                    itms.forEach(itm => (itm["xy"[i]] += rel));
                }
                this.page.editorRefresh();
            });
        });

        header = this.addItem(new App.ProjectPage.Panel.SubHeader("Robot Heading", "rad"));
        header.elem.classList.add("fornode");
        this.#useRobotHeading = document.createElement("label");
        this.useRobotHeading.classList.add("switch");
        this.useRobotHeading.innerHTML = "<input type='checkbox'><span></span>";
        header.elem.appendChild(this.useRobotHeading);
        this.#useRobotHeading = this.useRobotHeading.children[0];
        this.useRobotHeading.addEventListener("change", e => {
            let v = this.useRobotHeading.checked;
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof subcore.Project.Node)) return;
                itm.useHeading = v;
            });
            this.page.editorRefresh();
        });

        this.#robotHeading = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.robotHeading.elem.id = "heading";
        this.robotHeading.elem.classList.add("fornode");
        this.robotHeading.elem.style.flexDirection = "column";
        this.robotHeading.inputs.forEach(inp => {
            inp.type = "number";
            inp.placeholder = "Angle";
            inp.min = 0;
            inp.max = Math.PI*2;
            inp.style.flexBasis = "auto";
            inp.addEventListener("change", e => {
                let v = inp.value;
                if (v.length > 0) {
                    const fullTurn = 2*Math.PI;
                    v = util.ensure(parseFloat(v), "num");
                    while (v >= fullTurn) v -= fullTurn;
                    while (v < 0) v += fullTurn;
                    let itms = getSelected();
                    itms.forEach(itm => {
                        if (!(itm instanceof subcore.Project.Node)) return;
                        itm.heading = v;
                    });
                }
                this.page.editorRefresh();
            });
        });
        this.#robotHeadingDrag = document.createElement("div");
        this.robotHeadingDrag.classList.add("dragbox");
        this.robotHeadingDrag.innerHTML = "<div><button></button></div>";
        this.robotHeading.elem.appendChild(this.robotHeadingDrag);
        this.robotHeadingDrag.addEventListener("mousedown", e => {
            e.preventDefault();
            e.stopPropagation();
            const place = e => {
                let r = this.robotHeadingDrag.getBoundingClientRect();
                let center = new V(r.left + r.width/2, r.top + r.height/2).mul(+1, -1);
                let to = new V(e.pageX, e.pageY).mul(+1, -1);
                let v = (Math.PI/180)*center.towards(to);
                let itms = getSelected();
                itms.forEach(itm => {
                    if (!(itm instanceof subcore.Project.Node)) return;
                    itm.heading = v;
                });
                this.page.editorRefresh();
            };
            place(e);
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                place(e);
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        header = this.addItem(new App.ProjectPage.Panel.SubHeader("Robot Velocity", "m/s"));
        header.elem.classList.add("fornode");
        this.#useRobotVelocity = document.createElement("label");
        this.useRobotVelocity.classList.add("switch");
        this.useRobotVelocity.innerHTML = "<input type='checkbox'><span></span>";
        header.elem.appendChild(this.useRobotVelocity);
        this.#useRobotVelocity = this.useRobotVelocity.children[0];
        this.useRobotVelocity.addEventListener("change", e => {
            let v = this.useRobotVelocity.checked;
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof subcore.Project.Node)) return;
                itm.useVelocity = v;
            });
            this.page.editorRefresh();
        });

        this.#robotVelocity = this.addItem(new App.ProjectPage.Panel.Input2d());
        this.robotVelocity.elem.classList.add("fornode");
        this.robotVelocity.inputs.forEach((inp, i) => {
            inp.type = "number";
            inp.placeholder = "XY"[i];
            inp.step = 0.1;
            inp.addEventListener("change", e => {
                let v = inp.value;
                if (v.length > 0) {
                    v = util.ensure(parseFloat(v), "num");
                    let itms = getSelected();
                    itms.forEach(itm => {
                        if (!(itm instanceof subcore.Project.Node)) return;
                        itm["velocity"+"XY"[i]] = v*100;
                    });
                }
                this.page.editorRefresh();
            });
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Robot Rotational Velocity", "rad/s")).elem.classList.add("fornode");
        this.#robotRotVelocity = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.robotRotVelocity.elem.classList.add("fornode");
        this.robotRotVelocity.inputs.forEach(inp => {
            inp.type = "number";
            inp.placeholder = "...";
            inp.addEventListener("change", e => {
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(0, util.ensure(parseFloat(v), "num"));
                    let itms = getSelected();
                    itms.forEach(itm => {
                        if (!(itm instanceof subcore.Project.Node)) return;
                        itm.velocityRot = v;
                    });
                }
                this.page.editorRefresh();
            });
        });
        
        this.addItem(new App.ProjectPage.Panel.SubHeader("Radius", "m")).elem.classList.add("forobstacle");
        this.#radius = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.radius.elem.classList.add("forobstacle");
        this.radius.inputs.forEach(inp => {
            inp.type = "number";
            inp.placeholder = "...";
            inp.min = 0;
            inp.step = 0.1;
            inp.addEventListener("change", e => {
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(0, util.ensure(parseFloat(v), "num"));
                    let itms = getSelected();
                    itms.forEach(itm => {
                        if (!(itm instanceof subcore.Project.Obstacle)) return;
                        itm.radius = v*100;
                    });
                }
                this.page.editorRefresh();
            });
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Options")).elem.classList.add("fornode");
        this.#eOptions = document.createElement("div");
        this.addItem(this.eOptions);
        this.eOptions.classList.add("options");
        this.eOptions.classList.add("fornode");
        this.#eOptionsAdd = document.createElement("button");
        this.eOptions.appendChild(this.eOptionsAdd);
        this.eOptionsAdd.innerHTML = "<ion-icon name='add'></ion-icon>";
        let optionAdd = () => {};
        this.eOptionsAdd.addEventListener("click", e => {
            if (!this.page.hasProject()) return;
            optionAdd();
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Controls")).elem.classList.add("forany");
        this.#itemControls = document.createElement("div");
        this.addItem(this.itemControls);
        this.itemControls.id = "itemcontrols";
        this.itemControls.classList.add("forany");

        this.#remove = document.createElement("button");
        this.itemControls.appendChild(this.remove);
        this.remove.id = "removebtn";
        this.remove.textContent = "Remove";
        this.remove.addEventListener("click", e => {
            if (this.page.choosing) return;
            if (!this.page.hasProject()) return;
            this.page.selected.forEach(id => this.page.project.remItem(id));
        });

        this.addHandler("refresh", () => {
            let has = this.page.hasProject();
            this.btn.disabled = !has;
            this.position.inputs.forEach(inp => (inp.disabled = !has));
            this.remove.disabled = !has;
            let forAny = Array.from(this.elem.querySelectorAll(":scope .forany"));
            let forNode = Array.from(this.elem.querySelectorAll(":scope .fornode"));
            let forObstacle = Array.from(this.elem.querySelectorAll(":scope .forobstacle"));
            let itms = getSelected();
            let allNode = (itms.length > 0), allObstacle = (itms.length > 0);
            itms.forEach(itm => {
                if (!(itm instanceof subcore.Project.Node)) allNode = false;
                if (!(itm instanceof subcore.Project.Obstacle)) allObstacle = false;
            });
            forAny.forEach(elem => (itms.length > 0) ? elem.classList.add("this") : elem.classList.remove("this"));
            forNode.forEach(elem => (allNode ? elem.classList.add("this") : elem.classList.remove("this")));
            forObstacle.forEach(elem => (allObstacle ? elem.classList.add("this") : elem.classList.remove("this")));
            let xList = itms.map(itm => itm.x);
            let xCenter = (Math.max(...xList) + Math.min(...xList)) / 2;
            let yList = itms.map(itm => itm.y);
            let yCenter = (Math.max(...yList) + Math.min(...yList)) / 2;
            this.position.inputs[0].value = xCenter/100;
            this.position.inputs[1].value = yCenter/100;
            this.useRobotHeading.disabled = !has || !allNode;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                for (let itm of itms) {
                    if (first) {
                        first = false;
                        sameValue = itm.useHeading;
                        continue;
                    }
                    if (sameValue == itm.useHeading) continue;
                    same = false;
                    break;
                }
                this.useRobotHeading.checked = same ? sameValue : false;
            } else this.useRobotHeading.checked = false;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                for (let itm of itms) {
                    if (first) {
                        first = false;
                        sameValue = itm.heading;
                        continue;
                    }
                    if (sameValue == itm.heading) continue;
                    same = false;
                    break;
                }
                this.robotHeading.inputs[0].value = same ? sameValue : "";
                this.robotHeadingDrag.style.setProperty("--dir", (-(180/Math.PI)*(same ? sameValue : 0))+"deg");
            } else {
                this.robotHeading.inputs[0].value = "";
                this.robotHeadingDrag.style.setProperty("--dir", "0deg");
            }
            this.useRobotVelocity.disabled = !has || !allNode;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                for (let itm of itms) {
                    if (first) {
                        first = false;
                        sameValue = itm.useVelocity;
                        continue;
                    }
                    if (sameValue == itm.useVelocity) continue;
                    same = false;
                    break;
                }
                this.useRobotVelocity.checked = same ? sameValue : false;
            } else this.useRobotVelocity.checked = false;
            this.robotVelocity.inputs[0].disabled = !has || !allNode || !this.useRobotVelocity.checked;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                for (let itm of itms) {
                    if (first) {
                        first = false;
                        sameValue = itm.velocityX;
                        continue;
                    }
                    if (sameValue == itm.velocityX) continue;
                    same = false;
                    break;
                }
                this.robotVelocity.inputs[0].value = same ? sameValue/100 : "";
            } else this.robotVelocity.inputs[0].value = "";
            this.robotVelocity.inputs[1].disabled = !has || !allNode || !this.useRobotVelocity.checked;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                for (let itm of itms) {
                    if (first) {
                        first = false;
                        sameValue = itm.velocityY;
                        continue;
                    }
                    if (sameValue == itm.velocityY) continue;
                    same = false;
                    break;
                }
                this.robotVelocity.inputs[1].value = same ? sameValue/100 : "";
            } else this.robotVelocity.inputs[1].value = "";
            this.robotRotVelocity.inputs[0].disabled = !has || !allNode || !this.useRobotVelocity.checked;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                for (let itm of itms) {
                    if (first) {
                        first = false;
                        sameValue = itm.velocityRot;
                        continue;
                    }
                    if (sameValue == itm.velocityRot) continue;
                    same = false;
                    break;
                }
                this.robotRotVelocity.inputs[0].value = same ? sameValue : "";
            } else this.robotRotVelocity.inputs[0].value = "";
            this.radius.inputs[0].disabled = !has || !allObstacle;
            if (allObstacle) {
                let same = true, sameValue = null, first = true;
                for (let itm of itms) {
                    if (first) {
                        first = false;
                        sameValue = itm.radius;
                        continue;
                    }
                    if (sameValue == itm.radius) continue;
                    same = false;
                    break;
                }
                this.radius.inputs[0].value = same ? sameValue/100 : "";
            } else this.radius.inputs[0].value = "";
            let node = (allNode && itms.length == 1) ? itms[0] : null;
            this.eOptionsAdd.disabled = !node;
            optionAdd = () => {
                if (!node) return;
                let options = node.options;
                let k = "new-key";
                if (options.includes(k)) {
                    let n = 1;
                    while (true) {
                        if (!options.includes(k+"-"+n)) break;
                        n++;
                    }
                    k += "-"+n;
                }
                node.addOption(k, "null");
                this.page.editorRefresh();
            };
            Array.from(this.eOptions.querySelectorAll(":scope > .item")).forEach(elem => elem.remove());
            if (node)
                node.options.forEach(k => {
                    let v = node.getOption(k);
                    let elem = document.createElement("div");
                    this.eOptions.insertBefore(elem, this.eOptionsAdd);
                    elem.classList.add("item");
                    let kinput = document.createElement("input");
                    elem.appendChild(kinput);
                    kinput.type = "text";
                    kinput.placeholder = "Key...";
                    kinput.autocomplete = "off";
                    kinput.spellcheck = false;
                    kinput.value = k;
                    let separator = document.createElement("div");
                    elem.appendChild(separator);
                    separator.classList.add("separator");
                    separator.textContent = ":";
                    let vinput = document.createElement("input");
                    elem.appendChild(vinput);
                    vinput.type = "text";
                    vinput.placeholder = "Value...";
                    vinput.autocomplete = "off";
                    vinput.spellcheck = false;
                    vinput.value = v;
                    let color = "v4";
                    try {
                        let v2 = JSON.parse(v);
                        if (util.is(v2, "str")) color = "cy";
                        else if (util.is(v2, "num")) color = "cb";
                        else if (v2 == null) color = "co";
                        else if (v2 == true || v2 == false) color = ["cr", "cg"][+v2];
                        else color = "v8";
                    } catch (e) {}
                    vinput.style.color = "var(--"+color+")";
                    let remove = document.createElement("button");
                    elem.appendChild(remove);
                    remove.classList.add("remove");
                    remove.innerHTML = "<ion-icon name='close'></ion-icon>";
                    kinput.addEventListener("change", e => {
                        node.remOption(k);
                        node.addOption(kinput.value, v);
                        this.page.editorRefresh();
                    });
                    vinput.addEventListener("change", e => {
                        node.addOption(k, vinput.value);
                        this.page.editorRefresh();
                    });
                    remove.addEventListener("click", e => {
                        node.remOption(k);
                        this.page.editorRefresh();
                    });
                });
        });
    }

    get position() { return this.#position; }
    get useRobotHeading() { return this.#useRobotHeading; }
    get robotHeading() { return this.#robotHeading; }
    get robotHeadingDrag() { return this.#robotHeadingDrag; }
    get useRobotVelocity() { return this.#useRobotVelocity; }
    get robotVelocity() { return this.#robotVelocity; }
    get robotRotVelocity() { return this.#robotRotVelocity; }
    get radius() { return this.#radius; }
    get eOptions() { return this.#eOptions; }
    get eOptionsAdd() { return this.#eOptionsAdd; }
    get itemControls() { return this.#itemControls; }
    get remove() { return this.#remove; }

    get eSpawnBox() { return this.#eSpawnBox; }
    get eSpawnDelete() { return this.#eSpawnDelete; }
    get eSpawns() { return Object.keys(this.#eSpawns); }
    hasESpawn(name) { return name in this.#eSpawns; }
    getESpawn(name) { return this.hasESpawn(name) ? this.#eSpawns[name] : null; }
};
App.ProjectPage.PathsPanel = class AppProjectPagePathsPanel extends App.ProjectPage.Panel {
    #generating;
    #buttons;
    #visuals;

    #eAddBtn;
    #ePathsBox;
    #eActivateBtn;

    constructor(page) {
        super(page, "paths", "analytics");

        this.elem.addEventListener("click", e => this.page.clearSelectedPaths());

        this.#generating = null;
        this.#buttons = new Set();
        this.#visuals = {};

        let header = this.addItem(new App.ProjectPage.Panel.Header("Paths"));
        this.#eAddBtn = document.createElement("button");
        header.elem.appendChild(this.eAddBtn);
        this.eAddBtn.id = "pathaddbtn";
        this.eAddBtn.classList.add("icon");
        this.eAddBtn.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.eAddBtn.addEventListener("click", e => {
            if (this.page.choosing) return;
            if (!this.page.hasProject()) return;
            this.page.choosing = true;
            this.page.displayPath = new subcore.Project.Path();
            this.page.chooseState.addHandler("choose", (itm, shift) => {
                if (!this.page.hasDisplayPath()) return;
                let path = this.page.displayPath;
                shift = !!shift;
                if (!(itm instanceof subcore.Project.Node)) return;
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
                } catch (e) { await this.app.doError("Exec Termination Error", e); }
                return;
            }
            const projectId = this.page.projectId;
            if (!this.app.hasProject(projectId)) return;
            const project = this.app.getProject(projectId);
            if (this.page.selectedPaths.length <= 0) return;
            let id = this.page.selectedPaths[0];
            if (!project.hasPath(id)) return;
            let path = project.getPath(id);
            this.generating = true;
            this.app.markChange("*all");
            await this.app.post("cmd-save");
            try {
                await window.api.send("exec", project.id, path.id);
                await this.checkVisuals();
                this.visuals.forEach(id => {
                    let visual = this.getVisual(id);
                    if (!this.page.isPathSelected(id)) return;
                    visual.play();
                });
                this.generating = false;
            } catch (e) {
                this.generating = false;
                this.app.error("Exec Error", null, e);
            }
        });

        this.generating = false;
        
        this.addHandler("update", delta => {
            let pthsUsed = new Set();
            this.buttons.forEach(btn => {
                btn.showLines = btn.hasPath() ? !this.hasVisual(btn.path.id) : true;
                btn.update(delta);
                if (!this.page.hasProject() || !this.page.project.hasPath(btn.path))
                    btn.path = null;
                if (btn.hasPath()) {
                    pthsUsed.add(btn.path.id);
                    btn.selected = this.page.isPathSelected(btn.path);
                } else this.remButton(btn);
            });
            if (this.page.hasProject()) {
                let need;
                need = new Set(this.page.project.paths);
                pthsUsed.forEach(id => need.delete(id));
                need.forEach(id => this.addButton(new App.ProjectPage.PathsPanel.Button(this, this.page.project.getPath(id))));
            }
        });

        this.addHandler("refresh", () => {
            let has = this.page.hasProject();
            this.btn.disabled = !has;
            this.eAddBtn.disabled = !has;
            this.checkVisuals();
            this.eActivateBtn.disabled = !this.generating && (!has || this.page.selectedPaths.length <= 0);
            this.eActivateBtn.textContent = this.generating ? "Terminate" : "Generate";
            this.eActivateBtn.classList.remove("on");
            this.eActivateBtn.classList.remove("off");
            this.generating ? this.eActivateBtn.classList.add("off") : this.eActivateBtn.classList.add("on");
        });

        this.page.eNavProgress.addEventListener("mousedown", e => {
            if (this.page.choosing) return;
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                let visuals = this.visuals.filter(id => this.page.isPathSelected(id));
                if (visuals.length <= 0) return;
                let id = visuals[0];
                let visual = this.getVisual(id);
                visual.nowTime = visual.totalTime*this.page.progressHover;
            };
            mousemove(e);
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });
        this.page.eNavActionButton.addEventListener("click", e => {
            let visuals = this.visuals.filter(id => this.page.isPathSelected(id));
            if (visuals.length <= 0) return;
            let id = visuals[0];
            let visual = this.getVisual(id);
            if (visual.isFinished) {
                visual.nowTime = 0;
                visual.play();
            } else visual.paused = !visual.paused;
        });
        this.page.eNavBackButton.addEventListener("click", e => {
            let visuals = this.visuals.filter(id => this.page.isPathSelected(id));
            if (visuals.length <= 0) return;
            let id = visuals[0];
            let visual = this.getVisual(id);
            visual.nowTime = 0;
        });
        this.page.eNavForwardButton.addEventListener("click", e => {
            let visuals = this.visuals.filter(id => this.page.isPathSelected(id));
            if (visuals.length <= 0) return;
            let id = visuals[0];
            let visual = this.getVisual(id);
            visual.nowTime = visual.totalTime;
        });
        
        this.addHandler("update", delta => {
            let visuals = [];
            this.visuals.forEach(id => {
                let visual = this.getVisual(id);
                visual.show = this.page.isPathSelected(id);
                if (visual.show) visuals.push(id);
                visual.update(delta);
                if (!this.page.hasProject() || !this.page.project.hasPath(id))
                    this.remVisual(id);
            });
            if (visuals.length <= 0) {
                this.page.navOpen = false;
                return;
            }
            this.page.navOpen = true;
            let id = visuals[0];
            let visual = this.getVisual(id);
            this.page.progress = visual.item.interp;
            if (this.page.eNavActionButton.children[0])
                this.page.eNavActionButton.children[0].setAttribute("name", visual.isFinished ? "refresh" : visual.paused ? "play" : "pause");
            this.page.eNavProgressTooltip.textContent = util.formatTime(visual.totalTime*this.page.progressHover);
            this.page.eNavInfo.textContent = util.formatTime(visual.nowTime) + " / " + util.formatTime(visual.totalTime);
        });
    }

    get generating() { return this.#generating; }
    set generating(v) {
        v = !!v;
        if (this.generating == v) return true;
        this.#generating = v;
        this.page.editorRefresh();
        return true;
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
                this.page.clearSelectedPaths();
                this.page.addSelectedPath(btn.path);
            };
            const onEdit = () => {
                onTrigger(null);
                if (this.page.choosing) return;
                if (!this.page.hasProject()) return;
                let pths = this.page.selectedPaths;
                if (pths.length <= 0) return;
                let id = pths[0];
                if (!this.page.project.hasPath(id)) return;
                let pth = this.page.project.getPath(id);
                this.page.choosing = true;
                this.page.displayPath = pth;
                let nodes = pth.nodes;
                this.page.chooseState.addHandler("choose", (itm, shift) => {
                    if (!this.page.hasDisplayPath()) return;
                    let path = this.page.displayPath;
                    shift = !!shift;
                    if (!(itm instanceof subcore.Project.Node)) return;
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
                this.page.selectedPaths.forEach(id => this.page.project.remPath(id));
            };
            const onChange = () => {
                this.page.editorRefresh();
            };
            btn.addLinkedHandler(this, "trigger", onTrigger);
            btn.addLinkedHandler(this, "edit", onEdit);
            btn.addLinkedHandler(this, "remove", onRemove);
            btn.addLinkedHandler(this, "change", onChange);
            this.ePathsBox.appendChild(btn.elem);
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

    get visuals() { return Object.keys(this.#visuals); }
    set visuals(v) {
        v = util.ensure(v, "obj");
        this.clearVisuals();
        for (let id in v) this.addVisual(id, v[id]);
    }
    clearVisuals() {
        let visuals = this.visuals;
        visuals.forEach(id => this.remVisual(id));
        return visuals;
    }
    hasVisual(v) {
        if (util.is(v, "str")) return v in this.#visuals;
        if (v instanceof App.ProjectPage.PathsPanel.Visual) return this.hasVisual(v.id) && v.panel == this;
        return false;
    }
    getVisual(id) {
        id = String(id);
        if (!this.hasVisual(id)) return null;
        return this.#visuals[id];
    }
    addVisual(id, visual) {
        id = String(id);
        if (!(visual instanceof App.ProjectPage.PathsPanel.Visual)) return false;
        if (visual.panel != this || visual.id != null) return false;
        if (this.hasVisual(id)) return false;
        this.#visuals[id] = visual;
        visual.id = id;
        visual.check();
        return visual;
    }
    remVisual(v) {
        if (util.is(v, "str")) {
            if (!this.hasVisual(v)) return false;
            let visual = this.getVisual(v);
            delete this.#visuals[v];
            visual.id = null;
            visual.show = false;
            return visual;
        }
        if (v instanceof App.ProjectPage.PathsPanel.Visual) return this.remVisual(v.id);
        return false;
    }

    async checkVisuals() {
        this.clearVisuals();
        if (!this.page.hasProject()) return;
        try {
            let projectId = this.page.projectId;
            let datas = await window.api.send("exec-get", projectId);
            if (!util.is(datas, "obj")) return;
            if (this.page.projectId != projectId) return;
            for (let id in datas) {
                let data = datas[id];
                if (!util.is(data, "obj")) continue;
                let visual = this.addVisual(id, new App.ProjectPage.PathsPanel.Visual(this));
                visual.visual.dt = data.dt*1000;
                visual.visual.nodes = util.ensure(data.state, "arr").map(node => {
                    node = util.ensure(node, "obj");
                    node = new subcore.Project.Node(
                        new V(node.x, node.y).mul(100),
                        node.theta, true,
                        new V(node.vx, node.vy).mul(100),
                        0, true,
                    );
                    return node;
                });
            }
        } catch (e) {
            return;
            this.app.error("Exec Data Get Error", null, e);
        }
    };

    get eAddBtn() { return this.#eAddBtn; }
    get ePathsBox() { return this.#ePathsBox; }
    get eActivateBtn() { return this.#eActivateBtn; }
};
App.ProjectPage.PathsPanel.Visual = class AppProjectPagePathsPanelVisual extends util.Target {
    #panel;

    #id;

    #show;

    #visual;
    #item;

    #t;
    #paused;

    constructor(panel) {
        super();

        if (!(panel instanceof App.ProjectPage.PathsPanel)) throw new Error("Panel is not of class PathsPanel");
        this.#panel = panel;

        this.#id = null;

        this.#show = false;

        this.#visual = new RVisual(this.page.odometry.render);
        this.#item = new RVisualItem(this.page.odometry.render, this.visual);

        this.#t = 0;
        this.#paused = true;
    }

    get panel() { return this.#panel; }
    get page() { return this.panel.page; }
    get app() { return this.page.app; }

    get id() { return this.#id; }
    set id(v) {
        v = (v == null) ? null : String(v);
        if (this.id == v) return;
        this.#id = v;
    }

    get show() { return this.#show; }
    set show(v) {
        v = !!v;
        if (this.show == v) return;
        this.#show = v;
        this.check();
    }
    check() {
        if (this.show) this.page.odometry.render.addRender(this.visual, this.item);
        else this.page.odometry.render.remRender(this.visual, this.item);
    }

    get visual() { return this.#visual; }
    get item() { return this.#item; }

    get totalTime() { return this.visual.dt * this.visual.nodes.length; }
    get nowTime() { return this.#t; }
    set nowTime(v) {
        v = Math.min(this.totalTime, Math.max(0, util.ensure(v, "num")));
        if (this.nowTime == v) return;
        this.#t = v;
        this.item.interp = this.nowTime / this.totalTime;
    }
    get isFinished() { return this.nowTime >= this.totalTime; }

    get paused() { return this.#paused; }
    set paused(v) {
        v = !!v;
        if (this.paused == v) return;
        this.#paused = v;
    }
    get playing() { return !this.paused; }
    set playing(v) { this.paused = !v; }
    pause() { return this.paused = true; }
    play() { return this.playing = true; }

    update(delta) {
        if (this.show && this.playing) this.nowTime += delta;
    }
};
App.ProjectPage.PathsPanel.Button = class AppProjectPagePathsPanelButton extends util.Target {
    #panel;

    #path;
    #showIndices;
    #showLines;

    #elem;
    #eName;
    #eEdit;
    #eRemove;

    constructor(panel, path) {
        super();

        if (!(panel instanceof App.ProjectPage.PathsPanel)) throw new Error("Panel is not of class PathsPanel");
        this.#panel = panel;

        this.#path = null;
        this.#showIndices = true;
        this.#showLines = true;

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
        this.eRemove.innerHTML = "<ion-icon name='trash'></ion-icon>";

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
            this.post("change");
        });

        this.addHandler("update", delta => {
            if (document.activeElement != this.eName)
                this.eName.value = this.hasPath() ? this.path.name : "";
        });

        this.path = path;
    }

    get panel() { return this.#panel; }
    get page() { return this.panel.page; }
    get app() { return this.page.app; }

    get path() { return this.#path; }
    set path(v) {
        v = (v instanceof subcore.Project.Path) ? v : null;
        if (this.path == v) return;
        this.change("path", this.path, this.#path=v);
    }
    hasPath() { return !!this.path; }
    get showIndices() { return this.#showIndices; }
    set showIndices(v) {
        v = !!v;
        if (this.showIndices == v) return;
        this.#showIndices = v;
    }
    get showLines() { return this.#showLines; }
    set showLines(v) {
        v = !!v;
        if (this.showLines == v) return;
        this.#showLines = v;
    }

    get selected() { return this.elem.classList.contains("this"); }
    set selected(v) { v ? this.elem.classList.add("this") : this.elem.classList.remove("this"); }

    get elem() { return this.#elem; }
    get eName() { return this.#eName; }
    get eEdit() { return this.#eEdit; }
    get eRemove() { return this.#eRemove; }

    update(delta) { this.post("update", delta); }
};
App.ProjectPage.OptionsPanel = class AppProjectPageOptionsPanel extends App.ProjectPage.Panel {
    #size;
    #robotSize;
    #robotMass;
    #eOptions;
    #eOptionsAdd;
    #eScript;
    #eScriptInput;
    #eScriptBtn;
    #scriptPython;
    #scriptUseDefault;

    constructor(page) {
        super(page, "options", "settings-outline");

        let header;

        this.addItem(new App.ProjectPage.Panel.Header("Map Options"));

        this.addItem(new App.ProjectPage.Panel.SubHeader("Map Size", "m"));
        this.#size = this.addItem(new App.ProjectPage.Panel.Input2d());
        this.size.inputs.forEach((inp, i) => {
            inp.type = "number";
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
            inp.addEventListener("change", e => {
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(util.ensure(parseFloat(v), "num"));
                    if (this.page.hasProject())
                        this.page.project["wh"[i]] = v*100;
                }
                this.page.editorRefresh();
            });
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Robot Size", "m"));
        this.#robotSize = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.robotSize.inputs.forEach((inp, i) => {
            inp.type = "number";
            inp.placeholder = ["...", "Height"][i];
            inp.min = 0;
            inp.step = 0.1;
            inp.addEventListener("change", e => {
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(0, util.ensure(parseFloat(v), "num"));
                    if (this.page.hasProject())
                        this.page.project["robot"+"WH"[i]] = v*100;
                }
                this.page.editorRefresh();
            });
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Robot Mass", "kg"));
        this.#robotMass = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.robotMass.inputs.forEach(inp => {
            inp.type = "number";
            inp.placeholder = "...";
            inp.min = 0;
            inp.step = 0.1;
            inp.addEventListener("change", e => {
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(0, util.ensure(parseFloat(v), "num"));
                    if (this.page.hasProject())
                        this.page.project.robotMass = v;
                }
                this.page.editorRefresh();
            });
        });

        this.addItem(new App.ProjectPage.Panel.Header("Script Options"));

        this.#eOptions = document.createElement("div");
        this.addItem(this.eOptions);
        this.eOptions.classList.add("options");
        this.#eOptionsAdd = document.createElement("button");
        this.eOptions.appendChild(this.eOptionsAdd);
        this.eOptionsAdd.innerHTML = "<ion-icon name='add'></ion-icon>";
        this.eOptionsAdd.addEventListener("click", e => {
            if (!this.page.hasProject()) return;
            let options = this.page.project.config.options;
            let k = "new-key";
            if (options.includes(k)) {
                let n = 1;
                while (true) {
                    if (!options.includes(k+"-"+n)) break;
                    n++;
                }
                k += "-"+n;
            }
            this.page.project.config.addOption(k, "null");
            this.page.editorRefresh();
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Generator Script", ".py"));
        this.#eScript = document.createElement("div");
        this.addItem(this.eScript);
        this.eScript.id = "script";
        this.eScript.appendChild(document.createElement("div"));
        this.#eScript = this.eScript.children[0];
        this.eScript.classList.add("filedialog");
        this.#eScriptInput = document.createElement("input");
        this.eScript.appendChild(this.eScriptInput);
        this.eScriptInput.type = "text";
        this.eScriptInput.placeholder = "File path...";
        this.eScriptInput.autocomplete = "off";
        this.eScriptInput.spellcheck = false;
        this.#eScriptBtn = document.createElement("button");
        this.eScript.appendChild(this.eScriptBtn);
        this.eScriptBtn.textContent = "Browse";
        this.eScriptInput.addEventListener("change", e => {
            let v = this.eScriptInput.value;
            if (this.page.hasProject())
                this.page.project.config.script = (v.length > 0) ? v : null;
            this.page.editorRefresh();
        });
        this.eScriptBtn.addEventListener("click", async e => {
            let result = await this.app.fileOpenDialog({
                title: "Choose a python script",
                filters: [{
                    name: "Python",
                    extensions: ["py"],
                }],
                properties: [
                    "openFile",
                ],
            });
            result = util.ensure(result, "obj");
            let path = result.canceled ? null : util.ensure(result.filePaths, "arr")[0];
            if (this.page.hasProject())
                this.page.project.config.script = path;
            this.page.editorRefresh();
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Script Python", "shell"));
        this.#scriptPython = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.scriptPython.inputs.forEach(inp => {
            inp.type = "text";
            inp.placeholder = "Python command";
            inp.addEventListener("change", e => {
                let v = inp.value;
                if (this.page.hasProject())
                    this.page.project.config.scriptPython = v;
                this.page.editorRefresh();
            });
        });

        header = this.addItem(new App.ProjectPage.Panel.SubHeader("Default Generator Script"));
        this.#scriptUseDefault = document.createElement("label");
        this.scriptUseDefault.classList.add("switch");
        this.scriptUseDefault.innerHTML = "<input type='checkbox'><span></span>";
        header.elem.appendChild(this.scriptUseDefault);
        this.#scriptUseDefault = this.scriptUseDefault.children[0];
        this.scriptUseDefault.addEventListener("change", e => {
            let v = this.scriptUseDefault.checked;
            if (this.page.hasProject())
                this.page.project.config.scriptUseDefault = v;
            this.page.editorRefresh();
        });

        this.addHandler("refresh", () => {
            let has = this.page.hasProject();
            this.btn.disabled = !has;
            this.size.inputs.forEach(inp => (inp.disabled = !has));
            this.robotSize.inputs.forEach(inp => (inp.disabled = !has));
            this.robotMass.inputs.forEach(inp => (inp.disabled = !has));
            this.eOptionsAdd.disabled = !has;
            this.scriptPython.inputs.forEach(inp => (inp.disabled = !has));
            this.scriptUseDefault.disabled = !has;
            this.size.inputs.forEach((inp, i) => (inp.value = has ? this.page.project["wh"[i]]/100 : ""));
            this.robotSize.inputs.forEach((inp, i) => (inp.value = has ? this.page.project["robot"+"WH"[i]]/100 : ""));
            this.robotMass.inputs.forEach(inp => (inp.value = has ? this.page.project.robotMass : ""));
            Array.from(this.eOptions.querySelectorAll(":scope > .item")).forEach(elem => elem.remove());
            if (has)
                this.page.project.config.options.forEach(k => {
                    let v = this.page.project.config.getOption(k);
                    let elem = document.createElement("div");
                    this.eOptions.insertBefore(elem, this.eOptionsAdd);
                    elem.classList.add("item");
                    let kinput = document.createElement("input");
                    elem.appendChild(kinput);
                    kinput.type = "text";
                    kinput.placeholder = "Key...";
                    kinput.autocomplete = "off";
                    kinput.spellcheck = false;
                    kinput.value = k;
                    let separator = document.createElement("div");
                    elem.appendChild(separator);
                    separator.classList.add("separator");
                    separator.textContent = ":";
                    let vinput = document.createElement("input");
                    elem.appendChild(vinput);
                    vinput.type = "text";
                    vinput.placeholder = "Value...";
                    vinput.autocomplete = "off";
                    vinput.spellcheck = false;
                    vinput.value = v;
                    let color = "v4";
                    try {
                        let v2 = JSON.parse(v);
                        if (util.is(v2, "str")) color = "cy";
                        else if (util.is(v2, "num")) color = "cb";
                        else if (v2 == null) color = "co";
                        else if (v2 == true || v2 == false) color = ["cr", "cg"][+v2];
                        else color = "v8";
                    } catch (e) {}
                    vinput.style.color = "var(--"+color+")";
                    let remove = document.createElement("button");
                    elem.appendChild(remove);
                    remove.classList.add("remove");
                    remove.innerHTML = "<ion-icon name='close'></ion-icon>";
                    kinput.addEventListener("change", e => {
                        if (!this.page.hasProject()) return;
                        if (!this.page.project.config.hasOption(k)) return;
                        this.page.project.config.remOption(k);
                        this.page.project.config.addOption(kinput.value, v);
                        this.page.editorRefresh();
                    });
                    vinput.addEventListener("change", e => {
                        if (!this.page.hasProject()) return;
                        if (!this.page.project.config.hasOption(k)) return;
                        this.page.project.config.addOption(k, vinput.value);
                        this.page.editorRefresh();
                    });
                    remove.addEventListener("click", e => {
                        if (!this.page.hasProject()) return;
                        if (!this.page.project.config.hasOption(k)) return;
                        this.page.project.config.remOption(k);
                        this.page.editorRefresh();
                    });
                });
            this.eScriptInput.value = has ? this.page.project.config.script : "";
            this.eScriptInput.disabled = !has || this.page.project.config.scriptUseDefault;
            this.eScriptBtn.disabled = !has || this.page.project.config.scriptUseDefault;
            this.scriptPython.inputs.forEach(inp => (inp.value = has ? this.page.project.config.scriptPython : ""));
            this.scriptUseDefault.checked = has ? this.page.project.config.scriptUseDefault : false;
        });
    }

    get size() { return this.#size; }
    get robotSize() { return this.#robotSize; }
    get robotMass() { return this.#robotMass; }
    get eOptions() { return this.#eOptions; }
    get eOptionsAdd() { return this.#eOptionsAdd; }
    get eScript() { return this.#eScript; }
    get eScriptInput() { return this.#eScriptInput; }
    get eScriptBtn() { return this.#eScriptBtn; }
    get scriptPython() { return this.#scriptPython; }
    get scriptUseDefault() { return this.#scriptUseDefault; }
}
