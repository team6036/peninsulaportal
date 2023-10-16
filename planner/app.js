import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";

import * as subcore from "./core.mjs";


class RLabel extends core.Odometry2d.Render {
    #item;

    #text;

    constructor(item) {
        super();

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
    hasItem() { return this.item instanceof subcore.Project.Item; }

    get text() { return this.#text; }
    set text(v) { this.#text = String(v); }
}
class RLine extends core.Odometry2d.Render {
    #itemA; #itemB;

    constructor(itemA, itemB) {
        super();

        this.z2 = 1;

        this.#itemA = null;
        this.#itemB = null;

        let a = new V(), b = new V();

        this.addHandler("render", data => {
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
    hasItemA() { return this.itemA instanceof subcore.Project.Item; }
    get itemB() { return this.#itemB; }
    set itemB(v) {
        v = (v instanceof subcore.Project.Item) ? v : null;
        if (this.item == v) return;
        this.#itemB = v;
    }
    hasItemB() { return this.itemB instanceof subcore.Project.Item; }
}
class RVisual extends core.Odometry2d.Render {
    #dt;
    #nodes;

    constructor(dt, nodes) {
        super();

        this.z2 = -2;

        this.#dt = 0;
        this.#nodes = [];

        this.addHandler("render", data => {
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
            for (let i = 0; i+1 < this.nodes.length; i++) {
                let j = i+1;
                let ni = this.nodes[i], nj = this.nodes[j];
                let pi = this.odometry.worldToCanvas(ni.pos), pj = this.odometry.worldToCanvas(nj.pos);
                let vi = ni.velocity.dist(), vj = nj.velocity.dist();
                let ci = getColor(vi), cj = getColor(vj);
                let grad = ctx.createLinearGradient(...pi.xy, ...pj.xy);
                grad.addColorStop(0, ci.toRGBA());
                grad.addColorStop(1, cj.toRGBA());
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2*quality;
                ctx.beginPath();
                ctx.moveTo(...pi.xy);
                ctx.lineTo(...pj.xy);
                ctx.stroke();
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

    constructor(visual) {
        super();

        this.z2 = -1;

        this.#visual = null;
        this.#interp = 0;

        this.addHandler("render", data => {
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
    hasVisual() { return this.visual instanceof RVisual; }

    get interp() { return this.#interp; }
    set interp(v) {
        v = Math.min(1, Math.max(0, util.ensure(v, "num")));
        if (this.interp == v) return;
        this.#interp = v;
    }
}
class RSelect extends core.Odometry2d.Render {
    #a; #b;

    constructor() {
        super();

        this.z2 = 3;

        this.#a = new V();
        this.#b = new V();

        this.addHandler("render", data => {
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

    constructor(item) {
        super();

        this.#ghost = false;

        this.#item = null;
        this.#renderObject = null;

        const check = () => {
            if (!this.hasRenderObject()) return;
            if (this.hasOdometry()) {
                if (this.renderObject.hasOdometry()) return;
                this.odometry.addRender(this.renderObject);
            } else {
                if (!this.renderObject.hasOdometry()) return;
                this.renderObject.odometry.remRender(this.renderObject);
            }
            this.renderObject.alpha = this.ghost ? 0.5 : 1;
        };

        this.addHandler("set", data => {
            if (this.hasRenderObject()) this.renderObject.remHandler("render", check);
            if (this.hasOdometry()) this.odometry.remRender(this.renderObject);
            this.#renderObject = null;
            if (!this.hasItem()) return;
            if (this.item instanceof subcore.Project.Node) {
                this.#renderObject = new core.Odometry2d.Robot();
            } else if (this.item instanceof subcore.Project.Obstacle) {
                this.#renderObject = new core.Odometry2d.Obstacle();
            }
            if (this.hasRenderObject()) this.renderObject.addHandler("render", check);
        });

        this.addHandler("render", data => {
            check();
            if (!this.hasItem()) return;
            if (!this.hasRenderObject()) return;
            const render = this.renderObject;
            render.source = this;
            render.pos = this.item.pos;
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
        this.#item = v;
        this.post("set", { v: v });
    }
    hasItem() { return this.item instanceof subcore.Project.Item; }
    get renderObject() { return this.#renderObject; }
    hasRenderObject() { return this.#renderObject instanceof core.Odometry2d.Render; }

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
                    this.item.post("change", null);
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

export default class App extends core.App {
    #changes;

    #projects;

    #eTitleBtn;
    #eProjectsBtn;
    #eCreateBtn;
    #eFileBtn;
    #eEditBtn;
    #eViewBtn;
    #eProjectInfo;
    #eProjectInfoBtn;
    #eProjectInfoNameInput;
    #eProjectInfoSaveBtn;
    #eProjectInfoCopyBtn;
    #eProjectInfoDeleteBtn;
    #eSaveBtn;

    constructor() {
        super();

        this.#changes = new Set();

        this.#projects = {};

        this.addHandler("setup", async data => {
            try {
                await this.syncWithFiles();
            } catch (e) {
                let alert = this.alert("There was an error loading your projects!", "warning");
                alert.hasInfo = true;
                alert.info = String(e);
                alert.iconColor = "var(--cr)";
            }
        });
        this.addHandler("start-begin", data => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("start-complete", data => {
            this.addBackButton();

            this.#eTitleBtn = document.getElementById("titlebtn");
            if (this.hasETitleBtn())
                this.eTitleBtn.addEventListener("click", e => {
                    this.page = "TITLE";
                });
            this.#eProjectsBtn = document.querySelector("#titlebar > button.nav#projectsbtn");
            if (this.hasEProjectsBtn())
                this.eProjectsBtn.addEventListener("click", e => {
                    this.page = "PROJECTS";
                });
            this.#eCreateBtn = document.querySelector("#titlebar > button.nav#createbtn");
            if (this.hasECreateBtn())
                this.eCreateBtn.addEventListener("click", async e => {
                    this.page = "PROJECT";
                });

            this.#eFileBtn = document.querySelector("#titlebar > button.nav#filebtn");
            if (this.hasEFileBtn())
                this.eFileBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.ContextMenu();
                    itm = menu.addItem(new core.App.ContextMenu.Item("New Project", "add"));
                    itm.shortcut = "⌘N";
                    itm.addHandler("trigger", data => {
                        this.post("cmd-newproject", null);
                    });
                    menu.addItem(new core.App.ContextMenu.Divider());
                    itm = menu.addItem(new core.App.ContextMenu.Item("Add Node", "add"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-addnode", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Add Obstacle", "add"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-addobstacle", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Add Path", "add"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-addpath", null);
                    });
                    menu.addItem(new core.App.ContextMenu.Divider());
                    itm = menu.addItem(new core.App.ContextMenu.Item("Save", "document-outline"));
                    itm.shortcut = "⌘S";
                    itm.addHandler("trigger", async data => {
                        this.post("cmd-save", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Save as copy", "documents-outline"));
                    itm.shortcut = "⇧⌘S";
                    itm.addHandler("trigger", data => {
                        this.post("cmd-savecopy", null);
                    });
                    menu.addItem(new core.App.ContextMenu.Divider());
                    itm = menu.addItem(new core.App.ContextMenu.Item("Delete Project"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-delete", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Close Project"));
                    itm.shortcut = "⇧⌘W";
                    itm.addHandler("trigger", data => {
                        this.post("cmd-close", null);
                    });
                    this.contextMenu = menu;
                    let r = this.eFileBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eEditBtn = document.querySelector("#titlebar > button.nav#editbtn");
            if (this.hasEEditBtn())
                this.eEditBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.ContextMenu();
                    itm = menu.addItem(new core.App.ContextMenu.Item("Cut"));
                    itm.shortcut = "⌘X";
                    itm.addHandler("trigger", data => {
                        if (!this.hasPage("PROJECT")) return;
                        this.getPage("PROJECT").cut();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Copy"));
                    itm.shortcut = "⌘C";
                    itm.addHandler("trigger", data => {
                        if (!this.hasPage("PROJECT")) return;
                        this.getPage("PROJECT").copy();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Paste"));
                    itm.shortcut = "⌘V";
                    itm.addHandler("trigger", data => {
                        if (!this.hasPage("PROJECT")) return;
                        this.getPage("PROJECT").paste();
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Select All"));
                    itm.shortcut = "⌘A";
                    itm.addHandler("trigger", data => {
                        if (!this.hasPage("PROJECT")) return;
                        this.getPage("PROJECT").selected = this.getPage("PROJECT").project.items;
                    });
                    this.contextMenu = menu;
                    let r = this.eEditBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eViewBtn = document.querySelector("#titlebar > button.nav#viewbtn");
            if (this.hasEViewBtn())
                this.eViewBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.App.ContextMenu();
                    itm = menu.addItem(new core.App.ContextMenu.Item("Toggle Maximized"));
                    itm.shortcut = "⌃F";
                    itm.addHandler("trigger", data => {
                        this.post("cmd-maxmin", null);
                    });
                    itm = menu.addItem(new core.App.ContextMenu.Item("Reset Divider"));
                    itm.addHandler("trigger", data => {
                        this.post("cmd-resetdivider", null);
                    });
                    this.contextMenu = menu;
                    let r = this.eViewBtn.getBoundingClientRect();
                    this.placeContextMenu(r.left, r.bottom);
                });
            this.#eProjectInfo = document.querySelector("#titlebar > #projectinfo");
            if (this.hasEProjectInfo()) {
                this.#eProjectInfoBtn = this.eProjectInfo.querySelector(":scope > button.display");
                if (this.hasEProjectInfoBtn())
                    this.eProjectInfoBtn.addEventListener("click", e => {
                        e.stopPropagation();
                        if (this.eProjectInfo.classList.contains("this")) this.eProjectInfo.classList.remove("this");
                        else {
                            this.eProjectInfo.classList.add("this");
                            const click = e => {
                                if (this.eProjectInfo.contains(e.target)) return;
                                document.body.removeEventListener("click", click);
                                this.eProjectInfo.classList.remove("this");
                            };
                            document.body.addEventListener("click", click);
                        }
                    });
                this.#eProjectInfoNameInput = this.eProjectInfo.querySelector(":scope > .content > input#infoname");
                this.#eProjectInfoSaveBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infosave");
                this.#eProjectInfoCopyBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infocopy");
                this.#eProjectInfoDeleteBtn = this.eProjectInfo.querySelector(":scope > .content > .nav > button#infodelete");
                if (this.hasEProjectInfoSaveBtn())
                    this.eProjectInfoSaveBtn.addEventListener("click", e => this.post("cmd-save"));
                if (this.hasEProjectInfoCopyBtn())
                    this.eProjectInfoCopyBtn.addEventListener("click", e => this.post("cmd-savecopy"));
                if (this.hasEProjectInfoDeleteBtn())
                    this.eProjectInfoDeleteBtn.addEventListener("click", e => this.post("cmd-delete"));
            }
            this.#eSaveBtn = document.querySelector("#save");
            if (this.hasESaveBtn())
                this.eSaveBtn.addEventListener("click", async e => {
                    e.stopPropagation();
                    this.post("cmd-save", null);
                });
            let saving = false;
            this.addHandler("sync-files-with", data => {
                saving = true;
            });
            this.addHandler("synced-files-with", data => {
                saving = false;
            });
            this.addHandler("update", data => {
                if (this.hasESaveBtn()) this.eSaveBtn.textContent = saving ? "Saving" : (this.changes.length > 0) ? "Save" : "Saved";
            });

            this.clearChanges();

            this.addHandler("cmd-newproject", async () => {
                this.page = "PROJECT";
            });
            const cmdAdd = name => {
                if (this.dragging) return;
                name = String(name);
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (page.choosing) return;
                if (!page.hasProject()) return;
                this.dragData = name;
                this.dragging = true;
                this.eDrag.innerHTML = {
                    node: "<div class='global item selectable node'><div class='button'></div></div>",
                    obstacle: "<div class='global item selectable obstacle'><div class='button'></div><div class='radius'></div><div class='button radiusdrag'></div></div>"
                }[this.dragData];
                let prevOverRender = false;
                let ghostItem = null;
                let item = {
                    node: new subcore.Project.Node(
                        0,
                        0, true,
                        0, 0, false,
                    ),
                    obstacle: new subcore.Project.Obstacle(0, 100),
                }[this.dragData];
                this.dragState.addHandler("move", e => {
                    let pos = new V(e.pageX, e.pageY);
                    let r;
                    r = page.odometry.canvas.getBoundingClientRect();
                    let overRender = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                    if (prevOverRender != overRender) {
                        prevOverRender = overRender;
                        if (overRender) {
                            ghostItem = page.odometry.addRender(new RSelectable(item));
                            ghostItem.ghost = true;
                        } else {
                            page.odometry.remRender(ghostItem);
                            ghostItem = null;
                        }
                    }
                    if (this.eDrag.children[0] instanceof HTMLElement)
                        this.eDrag.children[0].style.visibility = overRender ? "hidden" : "inherit";
                    if (ghostItem instanceof RSelectable)
                        if (ghostItem.hasItem())
                            ghostItem.item.pos.set(page.odometry.pageToWorld(pos));
                    if (!page.hasPanel("objects")) return;
                    const panel = page.getPanel("objects");
                    r = panel.eSpawnDelete.getBoundingClientRect();
                    let over = (pos.x > r.left) && (pos.x < r.right) && (pos.y > r.top) && (pos.y < r.bottom);
                    if (over) panel.eSpawnDelete.classList.add("hover");
                    else panel.eSpawnDelete.classList.remove("hover");
                });
                const stop = cancel => {
                    page.odometry.remRender(ghostItem);
                    this.eDrag.innerHTML = "";
                    if (!cancel && prevOverRender && page.hasProject()) page.project.addItem(item);
                    if (!page.hasPanel("objects")) return;
                    const panel = page.getPanel("objects");
                    panel.eSpawnBox.classList.remove("delete");
                };
                this.dragState.addHandler("submit", data => stop(false));
                this.dragState.addHandler("cancel", data => stop(true));
                if (!page.hasPanel("objects")) return;
                const panel = page.getPanel("objects");
                panel.eSpawnBox.classList.add("delete");
            };
            this.addHandler("cmd-addnode", () => cmdAdd("node"));
            this.addHandler("cmd-addobstacle", () => cmdAdd("obstacle"));
            this.addHandler("cmd-addpath", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (page.choosing) return;
                if (!page.hasProject()) return;
                page.choosing = true;
                let chooseState = page.chooseState;
                chooseState.path = new subcore.Project.Path();
                chooseState.addHandler("choose", data => {
                    if (!(chooseState.path instanceof subcore.Project.Path)) return;
                    let path = chooseState.path;
                    data = util.ensure(data, "obj");
                    let itm = data.itm, shift = data.shift;
                    if (!(itm instanceof subcore.Project.Node)) return;
                    if (shift) path.remNode(itm);
                    else path.addNode(itm);
                    for (let id in chooseState.temp) page.odometry.remRender(chooseState.temp[id]);
                    chooseState.temp = {};
                    let nodes = path.nodes.filter(id => page.hasProject() && page.project.hasItem(id));
                    for (let i = 0; i < nodes.length; i++) {
                        let id = nodes[i];
                        let node = page.project.getItem(id);
                        if (id in chooseState.temp) {
                            chooseState.temp[id].text += ", "+(i+1);
                        } else {
                            chooseState.temp[id] = page.odometry.addRender(new RLabel(node));
                            chooseState.temp[id].text = i+1;
                        }
                        if (i > 0) {
                            let id2 = nodes[i-1];
                            page.project.getItem(id2);
                            chooseState.temp[id+"~"+id2] = page.odometry.addRender(new RLine(node, node2));
                        }
                    }
                });
                chooseState.addHandler("done", data => {
                    if (!(chooseState.path instanceof subcore.Project.Path)) return;
                    let path = chooseState.path;
                    if (!page.hasProject()) return;
                    page.project.addPath(path);
                });
                chooseState.addHandler("cancel", data => {
                });
            });
            this.addHandler("cmd-save", async () => {
                try {
                    await this.syncFilesWith();
                } catch (e) {
                    let alert = this.alert("There was an error saving your projects!", "warning");
                    alert.hasInfo = true;
                    alert.info = String(e);
                    alert.iconColor = "var(--cr)";
                }
            });
            this.addHandler("cmd-savecopy", async source => {
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (page.choosing) return;
                if (!(source instanceof subcore.Project)) source = page.project;
                if (!(source instanceof subcore.Project)) return;
                let project = new subcore.Project(source);
                project.meta.name += " copy";
                await this.setPage("PROJECT", { project: project });
                await this.post("cmd-save", null);
            });
            this.addHandler("cmd-delete", id => {
                if (!this.hasPage("PROJECT")) return;
                const page = this.getPage("PROJECT");
                if (page.choosing) return;
                if (!this.hasProject(String(id))) id = page.projectId;
                if (!this.hasProject(String(id))) return;
                let pop = this.confirm();
                pop.eContent.innerText = "Are you sure you want to delete this project?\nThis action is not reversible!";
                pop.addHandler("result", async data => {
                    let v = !!util.ensure(data, "obj").v;
                    if (v) {
                        this.remProject(id);
                        await this.post("cmd-save", null);
                        this.page = "PROJECTS";
                    }
                });
            });
            this.addHandler("cmd-close", () => {
                if (this.page != "PROJECT") return;
                this.page = "PROJECTS";
            });
            this.addHandler("cmd-maxmin", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                this.getPage("PROJECT").maximized = !this.getPage("PROJECT").maximized;
            });
            this.addHandler("cmd-resetdivider", () => {
                if (this.page != "PROJECT") return;
                if (!this.hasPage("PROJECT")) return;
                this.getPage("PROJECT").divPos = 0.75;
            });

            this.addPage(new App.TitlePage(this));
            this.addPage(new App.ProjectsPage(this));
            this.addPage(new App.ProjectPage(this));

            this.page = "TITLE";
        });
    }

    get changes() { return [...this.#changes]; }
    markChange(change) {
        change = String(change);
        if (this.hasChange(change)) return true;
        this.#changes.add(change);
        this.post("change", { change: change });
        return true;
    }
    hasChange(change) {
        change = String(change);
        return this.#changes.has(change);
    }
    clearChanges() {
        let changes = this.changes;
        this.#changes.clear();
        this.post("change-clear", { changes: changes });
        return changes;
    }
    async syncWithFiles() {
        const log = () => {};
        // const log = console.log;
        try {
            await this.post("sync-with-files", null);
        } catch (e) {}
        let hasProjectIds = await window.api.fileHas("projects.json");
        if (!hasProjectIds) {
            log("no projects.json found > creating");
            await window.api.fileWrite("projects.json", "[]");
        }
        let projectIdsContent = "";
        try {
            projectIdsContent = await window.api.fileRead("projects.json");
        } catch (e) {
            log("error reading projects.json:");
            log(e);
            projectIdsContent = "";
        }
        let projectIds = null;
        try {
            projectIds = JSON.parse(projectIdsContent, subcore.REVIVER.f);
        } catch (e) {
            log("error parsing projects.json:", projectIdsContent);
            log(e);
            projectIds = null;
        }
        projectIds = util.ensure(projectIds, "arr").map(id => String(id));
        log("projects.json: ", projectIds);
        let hasProjectsDir = await window.api.dirHas("projects");
        if (!hasProjectsDir) {
            log("no projects directory found > creating");
            await window.api.dirMake("projects");
        }
        let projects = {};
        for (let i = 0; i < projectIds.length; i++) {
            let id = projectIds[i];
            let projectContent = "";
            try {
                projectContent = await window.api.fileRead(["projects", id+".json"]);
            } catch (e) {
                log("error reading projects/"+id+".json:");
                log(e);
                projectContent = "";
            }
            let project = null;
            try {
                project = JSON.parse(projectContent, subcore.REVIVER.f);
            } catch (e) {
                log("error parsing projects/"+id+".json:", projectContent);
                log(e);
                project = null;
            }
            if (!(project instanceof subcore.Project)) continue;
            log("projects/"+id+".json: ", project);
            projects[id] = project;
        }
        this.projects = projects;
        this.clearChanges();
        try {
            await this.post("synced-with-files", null);
        } catch (e) {}
    }
    async syncFilesWith() {
        const log = () => {};
        // const log = console.log;
        try {
            await this.post("sync-files-with", null);
        } catch (e) {}
        let changes = new Set(this.changes);
        this.clearChanges();
        log("CHANGES:", [...changes]);
        if (changes.has("*all")) {
            log("CHANGE:*all > updating global list");
            let projectIds = this.projects;
            let projectIdsContent = JSON.stringify(projectIds, null, "\t");
            await window.api.fileWrite("projects.json", projectIdsContent);
            for (let i = 0; i < projectIds.length; i++) {
                let id = projectIds[i];
                log("CHANGE:*all > creating/updating project id:"+id);
                let project = this.getProject(id);
                let projectContent = JSON.stringify(project, null, "\t");
                await window.api.fileWrite(["projects", id+".json"], projectContent);
            }
            if (await window.api.dirHas("projects")) {
                let dirents = await window.api.dirList("projects");
                for (let i = 0; i < dirents.length; i++) {
                    let dirent = dirents[i];
                    if (dirent.type != "file") continue;
                    let id = dirent.name.split(".")[0];
                    if (this.hasProject(id)) continue;
                    log("CHANGE:*all > removing project id:"+id);
                    if (await window.api.fileHas(["projects", id+".json"]))
                        await window.api.fileDelete(["projects", id+".json"]);
                }
            }
        } else {
            let projectIds = this.projects;
            if (changes.has("*")) {
                log("CHANGE:* > updating global list");
                let projectIdsContent = JSON.stringify(projectIds, null, "\t");
                await window.api.fileWrite("projects.json", projectIdsContent);
            }
            for (let i = 0; i < projectIds.length; i++) {
                let id = projectIds[i];
                if (!changes.has("proj:"+id)) continue;
                log("CHANGE:proj:"+id+" > creating/updating project id:"+id);
                let project = this.getProject(id);
                project.meta.modified = util.getTime();
                let projectContent = JSON.stringify(project, null, "\t");
                await window.api.fileWrite(["projects", id+".json"], projectContent);
            }
            for (let i = 0; i < [...changes].length; i++) {
                let change = [...changes][i];
                if (!change.startsWith("proj:")) continue;
                let id = change.substring(5);
                if (this.hasProject(id)) continue;
                log("CHANGE:proj:"+id+" > removing project id:"+id);
                if (await window.api.fileHas(["projects", id+".json"]))
                    await window.api.fileDelete(["projects", id+".json"]);
            }
        }
        try {
            await this.post("synced-files-with", null);
        } catch (e) {}
    }
    get projects() { return Object.keys(this.#projects); }
    set projects(v) {
        v = util.ensure(v, "obj");
        this.clearProjects();
        for (let id in v) this.addProject(id, v[id]);
    }
    clearProjects() {
        let projs = this.projects;
        projs.forEach(id => this.remProject(id));
        return projs;
    }
    hasProject(id) {
        id = String(id);
        return id in this.#projects;
    }
    getProject(id) {
        id = String(id);
        if (!this.hasProject(id)) return null;
        return this.#projects[id];
    }
    addProject(id, proj) {
        id = String(id);
        if (!(proj instanceof subcore.Project)) return false;
        if (this.hasProject(proj.id)) return false;
        if (this.hasProject(id)) return false;
        this.#projects[id] = proj;
        proj.id = id;
        proj._onChange = () => this.markChange("proj:"+proj.id);
        proj.addHandler("change", proj._onChange);
        this.markChange("*");
        this.markChange("proj:"+id);
        return proj;
    }
    remProject(id) {
        id = String(id);
        if (!this.hasProject(id)) return false;
        let proj = this.getProject(id);
        delete this.#projects[id];
        proj.remHandler("change", proj._onChange);
        delete proj._onChange;
        proj.id = null;
        this.markChange("*");
        this.markChange("proj:"+id);
        return proj;
    }

    get eTitleBtn() { return this.#eTitleBtn; }
    hasETitleBtn() { return this.eTitleBtn instanceof HTMLButtonElement; }
    get eProjectsBtn() { return this.#eProjectsBtn; }
    hasEProjectsBtn() { return this.eProjectsBtn instanceof HTMLButtonElement; }
    get eCreateBtn() { return this.#eCreateBtn; }
    hasECreateBtn() { return this.eCreateBtn instanceof HTMLButtonElement; }
    get eFileBtn() { return this.#eFileBtn; }
    hasEFileBtn() { return this.eFileBtn instanceof HTMLButtonElement; }
    get eEditBtn() { return this.#eEditBtn; }
    hasEEditBtn() { return this.eEditBtn instanceof HTMLButtonElement; }
    get eViewBtn() { return this.#eViewBtn; }
    hasEViewBtn() { return this.eViewBtn instanceof HTMLButtonElement; }
    get eProjectInfo() { return this.#eProjectInfo; }
    hasEProjectInfo() { return this.eProjectInfo instanceof HTMLDivElement; }
    get eProjectInfoBtn() { return this.#eProjectInfoBtn; }
    hasEProjectInfoBtn() { return this.eProjectInfoBtn instanceof HTMLButtonElement; }
    get eProjectInfoNameInput() { return this.#eProjectInfoNameInput; }
    hasEProjectInfoNameInput() { return this.eProjectInfoNameInput instanceof HTMLInputElement; }
    get eProjectInfoSaveBtn() { return this.#eProjectInfoSaveBtn; }
    hasEProjectInfoSaveBtn() { return this.eProjectInfoSaveBtn instanceof HTMLButtonElement; }
    get eProjectInfoCopyBtn() { return this.#eProjectInfoCopyBtn; }
    hasEProjectInfoCopyBtn() { return this.eProjectInfoCopyBtn instanceof HTMLButtonElement; }
    get eProjectInfoDeleteBtn() { return this.#eProjectInfoDeleteBtn; }
    hasEProjectInfoDeleteBtn() { return this.eProjectInfoDeleteBtn instanceof HTMLButtonElement; }
    get eSaveBtn() { return this.#eSaveBtn; }
    hasESaveBtn() { return this.eSaveBtn instanceof HTMLButtonElement; }
}
App.TitlePage = class AppTitlePage extends core.App.Page {
    #eTitle;
    #eSubtitle;
    #eNav;
    #eCreateBtn;
    #eProjectsBtn;

    constructor(app) {
        super("TITLE", app);

        this.#eTitle = document.createElement("div");
        this.elem.appendChild(this.eTitle);
        this.eTitle.classList.add("title");
        this.eTitle.innerHTML = "<span>Peninsula</span><span>Planner</span>";
        this.#eSubtitle = document.createElement("div");
        this.elem.appendChild(this.eSubtitle);
        this.eSubtitle.classList.add("subtitle");
        this.eSubtitle.textContent = "The tool for planning trajectories";
        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");

        this.#eCreateBtn = document.createElement("button");
        this.eNav.appendChild(this.eCreateBtn);
        this.eCreateBtn.classList.add("special");
        this.eCreateBtn.innerHTML = "Create<ion-icon name='add'></ion-icon>";
        this.eCreateBtn.addEventListener("click", e => {
            if (!this.hasApp()) return;
            this.app.page = "PROJECT";
        });
        this.#eProjectsBtn = document.createElement("button");
        this.eNav.appendChild(this.eProjectsBtn);
        this.eProjectsBtn.innerHTML = "Projects<ion-icon name='chevron-forward'></ion-icon>";
        this.eProjectsBtn.addEventListener("click", e => {
            if (!this.hasApp()) return;
            this.app.page = "PROJECTS";
        });
    }

    get eTitle() { return this.#eTitle; }
    get eSubtitle() { return this.#eSubtitle; }
    get eNav() { return this.#eNav; }
    get eCreateBtn() { return this.#eCreateBtn; }
    get eProjectsBtn() { return this.#eProjectsBtn; }

    async enter(data) {
        if (this.hasApp()) this.app.title = "";
    }
};
App.ProjectsPage = class AppProjectsPage extends core.App.Page {
    #buttons;

    #eTitle;
    #eNav;
    #eSubNav;
    #eCreateBtn;
    #eTemplates;
    #eSearchBox;
    #eSearchInput;
    #eSearchBtn;
    #eContent;
    #eLoading;
    #eEmpty;

    constructor(app) {
        super("PROJECTS", app);

        this.#buttons = new Set();

        this.addHandler("update", data => this.buttons.forEach(btn => btn.update()));

        this.#eTitle = document.createElement("div");
        this.elem.appendChild(this.eTitle);
        this.eTitle.classList.add("title");
        this.eTitle.textContent = "Projects";
        this.#eNav = document.createElement("div");
        this.elem.append(this.eNav);
        this.eNav.classList.add("nav");
        this.#eSubNav = document.createElement("div");
        this.eNav.append(this.eSubNav);
        this.eSubNav.classList.add("nav");
        this.#eCreateBtn = document.createElement("button");
        this.eSubNav.appendChild(this.eCreateBtn);
        this.eCreateBtn.innerHTML = "Create<ion-icon name='add'></ion-icon>";
        this.eCreateBtn.addEventListener("click", e => {
            if (!this.hasApp()) return;
            this.app.page = "PROJECT";
        });
        this.#eTemplates = document.createElement("div");
        this.eSubNav.appendChild(this.eTemplates);
        this.eTemplates.classList.add("templates");
        this.#eSearchBox = document.createElement("div");
        this.eNav.appendChild(this.eSearchBox);
        this.eSearchBox.classList.add("search");
        this.#eSearchInput = document.createElement("input");
        this.eSearchBox.appendChild(this.eSearchInput);
        this.eSearchInput.type = "text";
        this.eSearchInput.placeholder = "Search...";
        this.eSearchInput.autocomplete = "off";
        this.eSearchInput.spellcheck = false;
        this.eSearchInput.addEventListener("input", e => {
            this.refresh();
        });
        this.#eSearchBtn = document.createElement("button");
        this.eSearchBox.appendChild(this.eSearchBtn);
        this.eSearchBtn.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.eSearchBtn.addEventListener("click", e => {
            if (this.eSearchInput instanceof HTMLInputElement)
                this.eSearchInput.value = "";
            this.refresh();
        });
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eLoading = document.createElement("div");
        this.eContent.appendChild(this.eLoading);
        this.#eEmpty = document.createElement("div");
        this.eContent.appendChild(this.eEmpty);
        this.eEmpty.classList.add("empty");
        this.eEmpty.textContent = "No projects here yet!";
        if (this.hasApp()) {
            this.app.addHandler("synced-files-with", () => this.refresh());
            this.app.addHandler("synced-with-files", () => this.refresh());
        }

        this.addHandler("update", data => this.buttons.forEach(btn => btn.update()));
    }

    async refresh() {
        this.clearButtons();
        this.eTemplates.innerHTML = "";
        const globalTemplates = util.ensure(await window.api.get("templates"), "obj");
        for (let name in globalTemplates) {
            let btn = document.createElement("button");
            this.eTemplates.appendChild(btn);
            btn.textContent = name;
            btn.addEventListener("click", e => {
                if (!this.hasApp()) return;
                this.app.setPage("PROJECT", { template: name });
            });
        }
        let btn = document.createElement("button");
        this.eTemplates.appendChild(btn);
        btn.textContent = "Blank Project";
        btn.addEventListener("click", e => {
            if (!this.hasApp()) return;
            this.app.setPage("PROJECT", { template: null });
        });
        this.eLoading.style.display = "block";
        this.eEmpty.style.display = "none";
        this.eLoading.style.display = "none";
        let projects = (this.hasApp() ? this.app.projects : []).map(id => this.app.getProject(id));
        if (projects.length > 0) {
            projects = util.search(projects, [ "meta.name" ], this.eSearchInput.value);
            projects.forEach(project => this.addButton(new App.ProjectsPage.Button(project)));
        } else this.eEmpty.style.display = "block";
    }

    get buttons() { return [...this.#buttons]; }
    set buttons(v) {
        v = util.ensure(v, "arr");
        this.clearButtons();
        v.forEach(v => this.addButton(v));
    }
    clearButtons() {
        let btns = this.buttons;
        btns.forEach(btn => this.remButton(btn));
        return btns;
    }
    hasButton(btn) {
        if (!(btn instanceof App.ProjectsPage.Button)) return false;
        return this.#buttons.has(btn);
    }
    addButton(btn) {
        if (!(btn instanceof App.ProjectsPage.Button)) return false;
        if (this.hasButton(btn)) return false;
        this.#buttons.add(btn);
        btn.page = this;
        this.eContent.appendChild(btn.elem);
        return btn;
    }
    remButton(btn) {
        if (!(btn instanceof App.ProjectsPage.Button)) return false;
        if (!this.hasButton(btn)) return false;
        this.#buttons.delete(btn);
        btn.page = null;
        this.eContent.removeChild(btn.elem);
        return btn;
    }

    get eTitle() { return this.#eTitle; }
    get eNav() { return this.#eNav; }
    get eSubNav() { return this.#eSubNav; }
    get eCreateBtn() { return this.#eCreateBtn; }
    get eTemplates() { return this.#eTemplates; }
    get eSearchBox() { return this.#eSearchBox; }
    get eSearchInput() { return this.#eSearchInput; }
    get eSearchBtn() { return this.#eSearchBtn; }
    get eContent() { return this.#eContent; }
    get eLoading() { return this.#eLoading; }
    get eEmpty() { return this.#eEmpty; }

    get state() {
        return {
            query: this.eSearchInput.value,
        };
    }
    async loadState(state) {
        state = util.ensure(state, "obj");
        this.eSearchInput.value = state.query || "";
        await this.refresh();
    }

    async enter(data) {
        if (this.hasApp()) this.app.title = "Projects";
        if (this.hasApp() && this.app.hasEProjectsBtn())
            this.app.eProjectsBtn.classList.add("this");
        await this.refresh();
    }
    async leave(data) {
        if (this.hasApp() && this.app.hasEProjectsBtn())
            this.app.eProjectsBtn.classList.remove("this");
    }
};
App.ProjectsPage.Button = class AppProjectsPageButton extends core.Target {
    #page;

    #project;

    #time;

    #elem;
    #eImage;
    #eInfo;
    #eName;
    #eTime;
    #eNav;
    #eEdit;

    constructor(project) {
        super();

        this.#page = null;

        this.#project = null;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eImage = document.createElement("div");
        this.elem.appendChild(this.eImage);
        this.eImage.classList.add("image");
        this.#eInfo = document.createElement("div");
        this.elem.appendChild(this.eInfo);
        this.eInfo.classList.add("info");
        this.#eName = document.createElement("div");
        this.eInfo.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eTime = document.createElement("div");
        this.eInfo.appendChild(this.eTime);
        this.eTime.classList.add("time");
        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");
        this.#eEdit = document.createElement("button");
        this.eNav.appendChild(this.eEdit);
        this.eEdit.innerHTML = "Edit <ion-icon name='arrow-forward'></ion-icon>";

        this.elem.addEventListener("contextmenu", e => {
            let itm;
            let menu = new core.App.ContextMenu();
            itm = menu.addItem(new core.App.ContextMenu.Item("Open"));
            itm.addHandler("trigger", data => {
                this.eEdit.click();
            });
            menu.addItem(new core.App.ContextMenu.Divider());
            itm = menu.addItem(new core.App.ContextMenu.Item("Delete"));
            itm.addHandler("trigger", data => {
                this.app.post("cmd-delete", this.project.id);
            });
            itm = menu.addItem(new core.App.ContextMenu.Item("Duplicate"));
            itm.addHandler("trigger", data => {
                this.app.post("cmd-savecopy", this.project);
            });
            if (!this.hasApp()) return;
            this.app.contextMenu = menu;
            this.app.placeContextMenu(e.pageX, e.pageY);
        });
        this.eEdit.addEventListener("click", e => {
            if (!this.hasApp()) return;
            this.app.setPage("PROJECT", { id: this.project.id });
        });

        this.project = project;

        this.addHandler("update", data => {
            if (!this.hasProject()) return;
            this.name = this.project.meta.name;
            this.time = this.project.meta.modified;
            this.eImage.style.backgroundImage = "url('"+this.project.meta.thumb+"')";
        });
    }

    get page() { return this.#page; }
    set page(v) {
        v = (v instanceof App.ProjectsPage) ? v : null;
        if (this.page == v) return;
        this.#page = v;
    }
    hasPage() { return this.page instanceof App.ProjectsPage; }
    get app() { return this.hasPage() ? this.page.app : null; }
    hasApp() { return this.app instanceof App; }

    get project() { return this.#project; }
    set project(v) {
        v = (v instanceof subcore.Project) ? v : null;
        if (this.project == v) return;
        this.#project = v;
        this.post("set", { v: v });
    }
    hasProject() { return this.project instanceof subcore.Project; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }

    get time() { return this.#time; }
    set time(v) {
        v = util.ensure(v, "num");
        if (this.time == v) return;
        this.#time = v;
        let date = new Date(this.time);
        this.eTime.textContent = "Modified "+[date.getMonth()+1, date.getDate(), date.getFullYear()].join("-");
    }

    get elem() { return this.#elem; }
    get eImage() { return this.#eImage; }
    get eInfo() { return this.#eInfo; }
    get eName() { return this.#eName; }
    get eTime() { return this.#eTime; }
    get eNav() { return this.#eNav; }
    get eEdit() { return this.#eEdit; }

    update() { this.post("update", null); }
};
App.ProjectPage = class AppProjectPage extends core.App.Page {
    #projectId;

    #odometry;

    #selected;
    #selectedPaths;

    #choosing;
    #chooseState;

    #maximized;
    #divPos;

    #panels;
    #panel;

    #eDisplay;
    #eBlockage;
    #eDisplayNav;
    #eProgress;
    #eDisplaySubNav;
    #ePlayPauseBtn;
    #eTimeDisplay;
    #eMaxMinBtn;
    #eChooseNav;
    #eChooseDoneBtn;
    #eChooseCancelBtn;
    #eEdit;
    #eEditContent;
    #eEditNav;
    #eDivider;

    constructor(app) {
        super("PROJECT", app);

        if (!this.hasApp()) return;

        this.app.addHandler("perm", async data => {
            this.app.markChange("*all");
            try {
                await this.app.syncFilesWith();
            } catch (e) {
                let alert = this.app.alert("There was an error saving your projects!", "warning");
                alert.hasInfo = true;
                alert.info = String(e);
                alert.iconColor = "var(--cr)";
                return false;
            }
            return true;
        });

        let lock = false;
        setInterval(async () => {
            if (lock) return;
            lock = true;
            await this.app.post("cmd-save", null);
            lock = false;
        }, 10000);

        document.body.addEventListener("click", e => {
            if (this.choosing) return;
            if (this.eDisplay.contains(e.target)) return;
            this.clearSelectedPaths();
        });

        if (this.app.hasEProjectInfoNameInput())
            this.app.eProjectInfoNameInput.addEventListener("change", e => {
                if (this.choosing) return;
                if (!this.hasProject()) return;
                this.project.meta.name = this.app.eProjectInfoNameInput.value;
                this.post("refresh-options", null);
            });
        
        this.#projectId = null;

        this.#odometry = new core.Odometry2d();

        this.#selected = new Set();

        this.#selectedPaths = new Set();

        this.#choosing = false;
        this.#chooseState = null;

        this.#maximized = null;
        this.#divPos = null;

        this.#panels = {};
        this.#panel = null;

        this.#eDisplay = document.createElement("div");
        this.elem.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.eDisplay.tabIndex = 0;
        this.eDisplay.addEventListener("keydown", e => {
            if (this.choosing) return;
            if (!this.hasProject()) return;
            if (["Backspace", "Delete"].includes(e.code)) {
                this.selected.forEach(id => this.project.remItem(id));
                this.selected = this.selected;
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
        this.#eBlockage = document.createElement("div");
        this.eDisplay.appendChild(this.eBlockage);
        this.eBlockage.classList.add("blockage");
        this.odometry.canvas = document.createElement("canvas");
        this.eDisplay.appendChild(this.odometry.canvas);
        new ResizeObserver(() => {
            let r = this.eDisplay.getBoundingClientRect();
            this.odometry.canvas.width = r.width*this.odometry.quality;
            this.odometry.canvas.height = r.height*this.odometry.quality;
            this.odometry.canvas.style.width = r.width+"px";
            this.odometry.canvas.style.height = r.height+"px";
        }).observe(this.eDisplay);
        this.odometry.canvas.addEventListener("contextmenu", e => {
            if (this.choosing) return;
            let itm;
            let menu = new core.App.ContextMenu();
            itm = menu.addItem(new core.App.ContextMenu.Item("Add Node", "add"));
            itm.addHandler("trigger", data => {
                this.app.post("cmd-addnode", null);
            });
            itm = menu.addItem(new core.App.ContextMenu.Item("Add Obstacle", "add"));
            itm.addHandler("trigger", data => {
                this.app.post("cmd-addobstacle", null);
            });
            itm = menu.addItem(new core.App.ContextMenu.Item("Add Path", "add"));
            itm.addHandler("trigger", data => {
                this.app.post("cmd-addpath", null);
            });
            menu.addItem(new core.App.ContextMenu.Divider());
            itm = menu.addItem(new core.App.ContextMenu.Item("Cut"));
            itm.shortcut = "⌘X";
            itm.addHandler("trigger", data => {
                if (this.choosing) return;
                this.cut();
            });
            itm = menu.addItem(new core.App.ContextMenu.Item("Copy"));
            itm.shortcut = "⌘C";
            itm.addHandler("trigger", data => {
                if (this.choosing) return;
                this.copy();
            });
            itm = menu.addItem(new core.App.ContextMenu.Item("Paste"));
            itm.shortcut = "⌘V";
            itm.addHandler("trigger", data => {
                if (this.choosing) return;
                this.paste();
            });
            itm = menu.addItem(new core.App.ContextMenu.Item("Select All"));
            itm.shortcut = "⌘A";
            itm.addHandler("trigger", data => {
                if (this.choosing) return;
                if (!this.hasProject()) return;
                this.selected = this.project.items;
            });
            menu.addItem(new core.App.ContextMenu.Divider());
            itm = menu.addItem(new core.App.ContextMenu.Item("Edit"));
            itm.addHandler("trigger", data => {
                this.panel = "objects";
            });
            itm = menu.addItem(new core.App.ContextMenu.Item("Delete"));
            itm.shortcut = "⌫";
            itm.addHandler("trigger", data => {
                if (this.choosing) return;
                if (!this.hasProject()) return;
                this.selected.forEach(id => this.project.remItem(id));
                this.selected = this.selected;
            });
            this.app.contextMenu = menu;
            this.app.placeContextMenu(e.pageX, e.pageY);
        });
        this.odometry.canvas.addEventListener("mousedown", e => {
            const hovered = this.odometry.hovered;
            const hoveredPart = this.odometry.hoveredPart;
            if (this.choosing) {
                if (!(hovered instanceof core.Odometry2d.Render)) return;
                if (!(hovered.source instanceof RSelectable)) return;
                this.chooseState.post("choose", { itm: hovered.source.item, shift: e.shiftKey });
                return;
            }
            if (e.button != 0) return;
            if (!(hovered instanceof core.Odometry2d.Render) || !(hovered.source instanceof RSelectable)) {
                this.clearSelected();
                let selectItem = this.odometry.addRender(new RSelect());
                selectItem.a = this.odometry.pageToWorld(e.pageX, e.pageY);
                selectItem.b = selectItem.a;
                const mouseup = () => {
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                    this.odometry.remRender(selectItem);
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
                        this.odometry.canvas.style.cursor = hovered.source.drag(hoveredPart, this.odometry.pageToWorld(e.pageX, e.pageY));
                        this.post("refresh-selectitem", null);
                        this.post("refresh-options", null);
                    };
                    document.body.addEventListener("mouseup", mouseup);
                    document.body.addEventListener("mousemove", mousemove);
                    return;
                }
                if (e.shiftKey) {
                    if (this.isSelected(hovered.source.item)) this.remSelected(hovered.source.item);
                    else this.addSelected(hovered.source.item);
                } else {
                    if (!this.isSelected(hovered.source.item)) {
                        this.clearSelected();
                        this.addSelected(hovered.source.item);
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
                        itm.post("change", null);
                    });
                    oldPos.set(newPos);
                    this.post("refresh-selectitem", null);
                    this.post("refresh-options", null);
                    this.odometry.canvas.style.cursor = "move";
                };
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
            }
        });

        this.#eDisplayNav = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayNav);
        this.eDisplayNav.classList.add("nav");
        this.#eProgress = document.createElement("div");
        this.eDisplayNav.appendChild(this.eProgress);
        this.eProgress.classList.add("progress");
        this.#eDisplaySubNav = document.createElement("div");
        this.eDisplayNav.appendChild(this.eDisplaySubNav);
        this.eDisplaySubNav.classList.add("nav");
        this.#ePlayPauseBtn = document.createElement("button");
        this.eDisplaySubNav.appendChild(this.ePlayPauseBtn);
        this.ePlayPauseBtn.innerHTML = "<ion-icon></ion-icon>";
        this.#eTimeDisplay = document.createElement("div");
        this.eDisplaySubNav.appendChild(this.eTimeDisplay);
        this.eTimeDisplay.textContent = "0:00 / 0:00";
        let space = document.createElement("div");
        this.eDisplaySubNav.appendChild(space);
        space.style.flexBasis = "100%";
        this.#eMaxMinBtn = document.createElement("button");
        this.eDisplaySubNav.appendChild(this.eMaxMinBtn);
        this.eMaxMinBtn.innerHTML = "<ion-icon></ion-icon>";
        this.eMaxMinBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasApp()) return;
            this.app.post("cmd-maxmin", null);
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
            for (let id in chooseState.temp) this.odometry.remRender(chooseState.temp[id]);
            chooseState.post("done", null);
            this.choosing = false;
        });
        this.eChooseCancelBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.choosing) return;
            let chooseState = this.chooseState;
            for (let id in chooseState.temp) this.odometry.remRender(chooseState.temp[id]);
            chooseState.post("cancel", null);
            this.choosing = false;
        });

        this.#eEdit = document.createElement("div");
        this.elem.appendChild(this.eEdit);
        this.eEdit.classList.add("edit");
        this.#eEditContent = document.createElement("div");
        this.eEdit.appendChild(this.eEditContent);
        this.eEditContent.classList.add("content");
        this.#eEditNav = document.createElement("div");
        this.eEdit.appendChild(this.eEditNav);
        this.eEditNav.classList.add("nav");
        this.eEditNav.addEventListener("click", e => e.stopPropagation());
        
        this.#eDivider = document.createElement("div");
        this.elem.insertBefore(this.eDivider, this.eEdit);
        this.eDivider.classList.add("divider");
        this.eDivider.addEventListener("mousedown", e => {
            if (this.choosing) return;
            if (e.button != 0) return;
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                this.eDivider.classList.remove("this");
            };
            const mousemove = e => {
                let parent = this.eDivider.parentElement;
                if (!(parent instanceof HTMLDivElement)) return;
                let r = parent.getBoundingClientRect();
                this.divPos = Math.min(0.9, Math.max(0.1, (e.pageX-r.left) / r.width));
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
            this.eDivider.classList.add("this");
        });

        let selectItem = null;
        this.addHandler("refresh-selectitem", data => {
            this.selected.forEach(id => {
                if (!this.hasProject() || !this.project.hasItem(id)) return;
                let itm = this.project.getItem(id);
                itm.x = Math.min(this.project.w, Math.max(0, itm.x));
                itm.y = Math.min(this.project.h, Math.max(0, itm.y));
                itm.post("change", null);
            });
            if (this.selected.length > 1) {
                if (!(selectItem instanceof RSelect))
                    selectItem = this.odometry.addRender(new RSelect());
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
                this.odometry.remRender(selectItem);
                selectItem = null;
            }
        });
        this.addHandler("refresh-options", data => {
            let names = new Set();
            this.app.projects.forEach(id => {
                let project = this.app.getProject(id);
                if (project.meta.name.length <= 0) project.meta.name = "Unnamed";
                if (names.has(project.meta.name)) {
                    let n = 2;
                    while (names.has(project.meta.name+" "+n)) n++;
                    project.meta.name += " "+n;
                }
                names.add(project.meta.name);
                let pathNames = new Set();
                project.paths.forEach(id => {
                    let path = project.getPath(id);
                    if (path.name.length <= 0) path.name = "Unnamed";
                    if (pathNames.has(path.name)) {
                        let n = 2;
                        while (pathNames.has(path.name+" "+n)) n++;
                        path.name += " "+n;
                    }
                    pathNames.add(path.name);
                });
            });
            if (this.app.hasEProjectInfoNameInput())
                this.app.eProjectInfoNameInput.value = this.hasProject() ? this.project.meta.name : "";
            if (this.app.hasEProjectInfoBtn())
                if (this.app.eProjectInfoBtn.querySelector(":scope > .value") instanceof HTMLDivElement)
                    this.app.eProjectInfoBtn.querySelector(":scope > .value").textContent = this.hasProject() ? this.project.meta.name : "";
            if (this.app.page == this.name) this.app.title = this.hasProject() ? this.project.meta.name : "?";
        });

        this.addHandler("project-set", data => {
            this.panels.forEach(name => this.getPanel(name).post("project-set", data));
            this.post("refresh-options", null);
        });
        this.addHandler("refresh-options", () => {
            this.panels.forEach(name => this.getPanel(name).refresh());
        });

        let timer = 0;
        this.addHandler("update", data => {
            this.odometry.update();
            this.odometry.size = this.hasProject() ? this.project.size : 0;
            this.odometry.imageSrc = this.hasProject() ? this.project.meta.backgroundImage : null;
            this.odometry.imageScale = this.hasProject() ? this.project.meta.backgroundScale : 0;
            this.panels.forEach(name => this.getPanel(name).update());
            let itmsUsed = new Set();
            this.odometry.renders.forEach(render => {
                if (render instanceof core.Odometry2d.Robot)
                    render.size = this.hasProject() ? this.project.robotW : 0;
                if (!(render instanceof RSelectable)) return;
                if (!render.ghost && (!this.hasProject() || !this.project.hasItem(render.item)))
                    render.item = null;
                if (render.hasItem()) {
                    itmsUsed.add(render.item.id);
                    render.selected = this.isSelected(render);
                } else this.odometry.remRender(render);
            });
            if (this.hasProject()) {
                let need;
                need = new Set(this.project.items);
                itmsUsed.forEach(id => need.delete(id));
                need.forEach(id => this.odometry.addRender(new RSelectable(this.project.getItem(id))));
            }
            const hovered = this.odometry.hovered;
            const hoveredPart = this.odometry.hoveredPart;
            if (!(hovered instanceof core.Odometry2d.Render)) this.odometry.canvas.style.cursor = "crosshair";
            else if (!(hovered.source instanceof RSelectable)) this.odometry.canvas.style.cursor = "crosshair";
            else this.odometry.canvas.style.cursor = hovered.source.hover(hoveredPart);
            if (util.getTime()-timer < 1000) return;
            timer = util.getTime();
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

        this.addPanel(new App.ProjectPage.ObjectsPanel());
        this.addPanel(new App.ProjectPage.PathsPanel());
        this.addPanel(new App.ProjectPage.OptionsPanel());

        this.panel = "objects";
    }

    async refresh() {
        if (!this.hasApp()) return;
        try {
            await this.app.syncWithFiles();
        } catch (e) {
            let alert = this.app.alert("There was an error loading your projects!", "warning");
            alert.hasInfo = true;
            alert.info = String(e);
            alert.iconColor = "var(--cr)";
        }
        this.panel = "objects";
        this.maximized = false;
        this.divPos = 0.75;
        this.choosing = false;
        this.app.dragging = false;
    }

    get projectId() { return this.#projectId; }
    set projectId(v) {
        v = String(v);
        v = (this.hasApp() && this.app.hasProject(v)) ? v : null;
        if (this.projectId == v) return;
        this.#projectId = v;
        this.post("project-set", { v: this.projectId });
    }
    get project() { return this.hasApp() ? this.app.getProject(this.projectId) : null; }
    set project(v) {
        v = (v instanceof subcore.Project) ? v : null;
        if (this.project == v) return;
        if (!this.hasApp()) return;
        if (v instanceof subcore.Project) {
            if (!this.app.hasProject(v.id)) {
                let id;
                do {
                    id = new Array(10).fill(null).map(_ => util.BASE64[Math.floor(64*Math.random())]).join("");
                } while (this.app.hasProject(id));
                this.app.addProject(id, v);
            }
            this.projectId = v.id;
        } else this.projectId = null;
    }
    hasProject() { return this.project instanceof subcore.Project; }

    get odometry() { return this.#odometry; }

    get selected() { return [...this.#selected]; }
    set selected(v) {
        v = util.ensure(v, "arr");
        this.clearSelected();
        v.forEach(v => this.addSelected(v));
    }
    clearSelected() {
        let sels = this.selected;
        sels.forEach(id => this.remSelected(id));
        return sels;
    }
    isSelected(v) {
        if (util.is(v, "str")) return this.#selected.has(v);
        if (v instanceof subcore.Project.Item) return this.isSelected(v.id);
        if (v instanceof RSelectable) return this.isSelected(v.item);
        return false;
    }
    addSelected(v) {
        if (util.is(v, "str")) {
            if (this.hasProject() && this.project.hasItem(v)) {
                this.#selected.add(v);
                this.post("refresh-selectitem", null);
                this.post("refresh-options", null);
                return v;
            }
            return false;
        }
        if (v instanceof subcore.Project.Item) return this.addSelected(v.id);
        if (v instanceof RSelectable) return this.addSelected(v.item);
        return false;
    }
    remSelected(v) {
        if (util.is(v, "str")) {
            this.#selected.delete(v);
            this.post("refresh-selectitem", null);
            this.post("refresh-options", null);
            return v;
        }
        if (v instanceof subcore.Project.Item) return this.remSelected(v.id);
        if (v instanceof RSelectable) return this.remSelected(v.item);
        return false;
    }

    get selectedPaths() { return [...this.#selectedPaths]; }
    set selectedPaths(v) {
        v = util.ensure(v, "arr");
        this.clearSelectedPaths();
        v.forEach(v => this.addSelectedPath(v));
    }
    clearSelectedPaths() {
        let pths = this.selectedPaths;
        pths.forEach(id => this.remSelectedPath(id));
        return pths;
    }
    isPathSelected(v) {
        if (util.is(v, "str")) return this.#selectedPaths.has(v);
        if (v instanceof subcore.Project.Path) return this.isPathSelected(v.id);
        return false;
    }
    addSelectedPath(v) {
        if (util.is(v, "str")) {
            if (this.hasProject() && this.project.hasPath(v)) {
                this.#selectedPaths.add(v);
                this.post("refresh-options", null);
                return v;
            }
            return false;
        }
        if (v instanceof subcore.Project.Path) return this.addSelectedPath(v.id);
        return false;
    }
    remSelectedPath(v) {
        if (util.is(v, "str")) {
            this.#selectedPaths.delete(v);
            this.post("refresh-options", null);
            return v;
        }
        if (v instanceof subcore.Project.Path) return this.remSelectedPath(v.id);
        return false;
    }

    async cut() {
        await this.copy();
        this.selected.filter(id => this.hasProject() && this.project.hasItem(id)).forEach(id => this.project.remItem(id));
        this.post("refresh-selectitem");
        this.post("refresh-options");
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

    get choosing() { return this.#choosing; }
    set choosing(v) {
        v = !!v;
        if (this.choosing == v) return;
        this.#choosing = v;
        this.clearSelected();
        this.#chooseState = this.choosing ? new core.Target() : null;
        if (this.choosing) this.chooseState.temp = {};
        this.choosing ? this.eDisplay.classList.add("choose") : this.eDisplay.classList.remove("choose");
    }
    get chooseState() { return this.#chooseState; }

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
        v.forEach(v => this.addPanel(v));
    }
    clearPanels() {
        let panels = this.panels;
        panels.forEach(panel => this.remPanel(panel));
        return panels;
    }
    hasPanel(name) {
        name = String(name);
        return name in this.#panels;
    }
    getPanel(name) {
        name = String(name);
        if (!this.hasPanel(name)) return null;
        return this.#panels[name];
    }
    addPanel(panel) {
        if (!(panel instanceof App.ProjectPage.Panel)) return false;
        if (this.hasPanel(panel.name)) return false;
        this.#panels[panel.name] = panel;
        panel.page = this;
        this.eEditContent.appendChild(panel.elem);
        this.eEditNav.appendChild(panel.btn);
    }
    remPanel(v) {
        if (v instanceof App.ProjectPage.Panel) {
            if (!this.hasPanel(v.name)) return false;
            delete this.#panel[v.name];
            v.page = null;
            this.eEditContent.removeChild(v.elem);
            this.eEditNav.removeChild(v.btn);
            return v;
        }
        return this.remPanel(this.getPanel(v));
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
    get eDisplayNav() { return this.#eDisplayNav; }
    get eProgress() { return this.#eProgress; }
    get eDisplaySubNav() { return this.#eDisplaySubNav; }
    get ePlayPauseBtn() { return this.#ePlayPauseBtn; }
    get eTimeDisplay() { return this.#eTimeDisplay; }
    get eMaxMinBtn() { return this.#eMaxMinBtn; }
    get eChooseNav() { return this.#eChooseNav; }
    get eChooseDoneBtn() { return this.#eChooseDoneBtn; }
    get eChooseCancelBtn() { return this.#eChooseCancelBtn; }
    get eEdit() { return this.#eEdit; }
    get eEditContent() { return this.#eEditContent; }
    get eEditNav() { return this.#eEditNav; }
    get eDivider() { return this.#eDivider; }

    format() {
        if (this.eMaxMinBtn.children[0] instanceof HTMLElement)
            this.eMaxMinBtn.children[0].setAttribute("name", this.maximized ? "contract" : "expand");
        if (this.maximized) {
            this.eDisplay.style.width = "100%";
            this.eEdit.style.display = "none";
            this.eDivider.style.display = "none";
        } else {
            this.eDisplay.style.width = "calc("+(this.divPos*100)+"% - 6px)";
            this.eEdit.style.display = "";
            this.eEdit.style.width = "calc("+((1-this.divPos)*100)+"% - 6px)";
            this.eDivider.style.display = "";
        }
    }

    get state() {
        return {
            id: this.projectId,
        };
    }
    async loadState(state) {
        state = util.ensure(state, "obj");
        if (!this.hasApp()) return;
        await this.app.setPage(this.name, { id: state.id });
    }

    async enter(data) {
        let projectOnly = [
            "addnode", "addobstacle", "addpath",
            "savecopy",
            "delete", "close",
            "maxmin", "resetdivider",
        ];
        let ables = {};
        projectOnly.forEach(id => (ables[id] = true));
        await window.api.send("menu-ables", [ables]);
        Array.from(document.querySelectorAll(".forproject")).forEach(elem => { elem.style.display = ""; });
        if (!this.hasApp()) return;
        await this.refresh();
        this.eDisplay.focus();
        const globalTemplates = util.ensure(await window.api.get("templates"), "obj");
        const globalTemplateImages = util.ensure(await window.api.get("template-images"), "obj");
        const activeTemplate = util.ensure(await window.api.get("active-template"), "obj");
        let templatesContent = "";
        try {
            templatesContent = await window.api.fileRead("templates.json");
        } catch (e) {}
        let templates = null;
        try {
            templates = JSON.parse(templatesContent);
        } catch (e) {}
        templates = util.ensure(templates, "obj");
        if (this.app.hasProject(data.id)) {
            this.project = this.app.getProject(data.id);
        } else if (data.project instanceof subcore.Project) {
            this.project = data.project;
        } else {
            this.project = new subcore.Project();
            this.project.meta.created = this.project.meta.modified = util.getTime();
            this.project.meta.backgroundImage = globalTemplateImages[("template" in data) ? data.template : activeTemplate];
            this.post("refresh-options", null);
        }
        if (this.hasProject()) {
            for (let name in globalTemplates) {
                if (this.project.meta.backgroundImage != globalTemplateImages[name]) continue;
                const globalTemplate = util.ensure(globalTemplates[name], "obj");
                let template = util.ensure(templates[name], "obj");
                template[".size"] = globalTemplate["size"];
                template[".robotW"] = globalTemplate["robotSize"];
                template[".robotMass"] = globalTemplate["robotMass"];
                template[".meta.backgroundScale"] = globalTemplate["imageScale"];
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
        }
    }
    async leave(data) {
        let projectOnly = [
            "addnode", "addobstacle", "addpath",
            "savecopy",
            "delete", "close",
            "maxmin", "resetdivider",
        ];
        let ables = {};
        projectOnly.forEach(id => (ables[id] = false));
        await window.api.send("menu-ables", [ables]);
        Array.from(document.querySelectorAll(".forproject")).forEach(elem => { elem.style.display = "none"; });
        if (!this.hasApp()) return;
        this.app.markChange("*all");
        await this.app.post("cmd-save", null);
        this.project = null;
    }
    async determineSame(data) {
        if (!this.hasApp()) return false;
        if (this.app.hasProject(data.id)) return this.projectId == data.id;
        else if (data.project instanceof subcore.Project) return this.project == data.project;
        return false;
    }
};
App.ProjectPage.Panel = class AppProjectPagePanel extends core.Target {
    #name;

    #page;
    #items;

    #elem;
    #btn;
    #eIcon;
    #eName;

    constructor(name, icon) {
        super();

        this.#name = String(name);

        this.#page = null;
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
            if (!this.hasPage()) return;
            this.page.panel = this.name;
        });

        this.icon = icon;
        this.btnName = this.name.split(" ").map(v => util.capitalize(v)).join(" ");
    }

    get name() { return this.#name; }

    get page() { return this.#page; }
    set page(v) {
        v = (v instanceof App.ProjectPage) ? v : null;
        if (this.page == v) return;
        this.post("pre-page-set", { page: this.page });
        this.#page = v;
        this.post("post-page-set", { page: this.page });
    }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() { return this.hasPage() ? this.page.app : null; }
    hasApp() { return this.app instanceof App; }

    get items() { return [...this.#items]; }
    set items(v) {
        v = util.ensure(v, "arr");
        this.clearItems();
        v.forEach(v => this.addItem(v));
    }
    clearItems() {
        let itms = this.items;
        itms.forEach(itm => this.remItem(itm));
        return itms;
    }
    hasItem(itm) {
        if (!(itm instanceof App.ProjectPage.Panel.Item) && !(itm instanceof HTMLElement)) return false;
        return this.#items.includes(itm);
    }
    addItem(itm) {
        if (!(itm instanceof App.ProjectPage.Panel.Item) && !(itm instanceof HTMLElement)) return false;
        if (this.hasItem(itm)) return false;
        this.#items.push(itm);
        this.elem.appendChild((itm instanceof App.ProjectPage.Panel.Item) ? itm.elem : itm);
        return itm;
    }
    remItem(itm) {
        if (!(itm instanceof App.ProjectPage.Panel.Item) && !(itm instanceof HTMLElement)) return false;
        if (!this.hasItem(itm)) return false;
        this.#items.splice(this.#items.indexOf(itm), 1);
        this.elem.removeChild((itm instanceof App.ProjectPage.Panel.Item) ? itm.elem : itm);
        return itm;
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

    refresh() { this.post("refresh", null); }

    update() { this.post("update", null); }
};
App.ProjectPage.Panel.Item = class AppProjectPagePanelItem extends core.Target {
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
    #itemControls;
    #remove;

    #eSpawnBox;
    #eSpawnDelete;
    #eSpawns;

    constructor() {
        super("objects", "cube-outline");

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
                if (!this.hasPage() || !this.hasApp()) return;
                if (this.page.choosing) return;
                this.app.post("cmd-add"+name, null);
            });
        });

        const getSelected = () => {
            if (!this.hasPage()) return [];
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
                if (!this.hasPage()) return;
                let v = inp.value;
                if (v.length > 0) {
                    let itms = getSelected();
                    let xyList = itms.map(itm => itm["xy"[i]]);
                    let newCenter = util.ensure(parseFloat(v), "num")*100;
                    let oldCenter = (Math.max(...xyList) + Math.min(...xyList)) / 2;
                    let rel = newCenter - oldCenter;
                    itms.forEach(itm => {
                        itm["xy"[i]] += rel;
                        itm.post("change", null);
                    });
                    this.page.post("refresh-selectitem", null);
                }
                this.page.post("refresh-options", null);
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
            if (!this.hasPage()) return;
            let v = this.useRobotHeading.checked;
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof subcore.Project.Node)) return;
                itm.useHeading = v;
            });
            this.page.post("refresh-selectitem", null);
            this.page.post("refresh-options", null);
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
                if (!this.hasPage()) return;
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
                    this.page.post("refresh-selectitem", null);
                }
                this.page.post("refresh-options", null);
            });
        });
        this.#robotHeadingDrag = document.createElement("div");
        this.robotHeadingDrag.classList.add("dragbox");
        this.robotHeadingDrag.innerHTML = "<div><button></button></div>";
        this.robotHeading.elem.appendChild(this.robotHeadingDrag);
        this.robotHeadingDrag.addEventListener("mousedown", e => {
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
                if (!this.hasPage()) return;
                this.page.post("refresh-selectitem", null);
                this.page.post("refresh-options", null);
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
            if (!this.hasPage()) return;
            let v = this.useRobotVelocity.checked;
            let itms = getSelected();
            itms.forEach(itm => {
                if (!(itm instanceof subcore.Project.Node)) return;
                itm.useVelocity = v;
            });
            this.page.post("refresh-selectitem", null);
            this.page.post("refresh-options", null);
        });

        this.#robotVelocity = this.addItem(new App.ProjectPage.Panel.Input2d());
        this.robotVelocity.elem.classList.add("fornode");
        this.robotVelocity.inputs.forEach((inp, i) => {
            inp.type = "number";
            inp.placeholder = "XY"[i];
            inp.step = 0.1;
            inp.addEventListener("change", e => {
                if (!this.hasPage()) return;
                let v = inp.value;
                if (v.length > 0) {
                    v = util.ensure(parseFloat(v), "num");
                    let itms = getSelected();
                    itms.forEach(itm => {
                        if (!(itm instanceof subcore.Project.Node)) return;
                        itm["velocity"+"XY"[i]] = v*100;
                        itm.post("change", null);
                    });
                    this.page.post("refresh-selectitem", null);
                }
                this.page.post("refresh-options", null);
            });
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Robot Rotational Velocity", "rad/s")).elem.classList.add("fornode");
        this.#robotRotVelocity = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.robotRotVelocity.elem.classList.add("fornode");
        this.robotRotVelocity.inputs.forEach(inp => {
            inp.type = "number";
            inp.placeholder = "...";
            inp.addEventListener("change", e => {
                if (!this.hasPage()) return;
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(0, util.ensure(parseFloat(v), "num"));
                    let itms = getSelected();
                    itms.forEach(itm => {
                        if (!(itm instanceof subcore.Project.Node)) return;
                        itm.velocityRot = v;
                    });
                    this.page.post("refresh-selectitem", null);
                }
                this.page.post("refresh-options", null);
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
                if (!this.hasPage()) return;
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(0, util.ensure(parseFloat(v), "num"));
                    let itms = getSelected();
                    itms.forEach(itm => {
                        if (!(itm instanceof subcore.Project.Obstacle)) return;
                        itm.radius = v*100;
                    });
                    this.page.post("refresh-selectitem", null);
                }
                this.page.post("refresh-options", null);
            });
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
            if (!this.hasPage()) return;
            if (this.page.choosing) return;
            if (!this.page.hasProject()) return;
            this.page.selected.forEach(id => this.page.project.remItem(id));
            this.page.selected = this.page.selected;
        });

        this.addHandler("project-set", data => {
            let has = this.hasPage() && this.page.hasProject();
            this.btn.disabled = !has;
            this.position.inputs.forEach(inp => (inp.disabled = !has));
            this.remove.disabled = !has;
        });
        this.addHandler("refresh", data => {
            let has = this.hasPage() && this.page.hasProject();
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
                itms.forEach(itm => {
                    if (!same) return;
                    if (first) {
                        first = false;
                        sameValue = itm.useHeading;
                        return;
                    }
                    if (itm.useHeading != sameValue) same = false;
                });
                this.useRobotHeading.checked = same ? sameValue : false;
            } else this.useRobotHeading.checked = false;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                itms.forEach(itm => {
                    if (!same) return;
                    if (first) {
                        first = false;
                        sameValue = itm.heading;
                        return;
                    }
                    if (itm.heading != sameValue) same = false;
                });
                this.robotHeading.inputs[0].value = same ? sameValue : "";
                this.robotHeadingDrag.style.setProperty("--dir", (-(180/Math.PI)*(same ? sameValue : 0))+"deg");
            } else {
                this.robotHeading.inputs[0].value = "";
                this.robotHeadingDrag.style.setProperty("--dir", "0deg");
            }
            this.useRobotVelocity.disabled = !has || !allNode;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                itms.forEach(itm => {
                    if (!same) return;
                    if (first) {
                        first = false;
                        sameValue = itm.useVelocity;
                        return;
                    }
                    if (itm.useVelocity != sameValue) same = false;
                });
                this.useRobotVelocity.checked = same ? sameValue : false;
            } else this.useRobotVelocity.checked = false;
            this.robotVelocity.inputs[0].disabled = !has || !allNode || !this.useRobotVelocity.checked;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                itms.forEach(itm => {
                    if (!same) return;
                    if (first) {
                        first = false;
                        sameValue = itm.velocityX;
                        return;
                    }
                    if (itm.velocityX != sameValue) same = false;
                });
                this.robotVelocity.inputs[0].value = same ? sameValue/100 : "";
            } else this.robotVelocity.inputs[0].value = "";
            this.robotVelocity.inputs[1].disabled = !has || !allNode || !this.useRobotVelocity.checked;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                itms.forEach(itm => {
                    if (!same) return;
                    if (first) {
                        first = false;
                        sameValue = itm.velocityY;
                        return;
                    }
                    if (itm.velocityY != sameValue) same = false;
                });
                this.robotVelocity.inputs[1].value = same ? sameValue/100 : "";
            } else this.robotVelocity.inputs[1].value = "";
            this.robotRotVelocity.inputs[0].disabled = !has || !allNode || !this.useRobotVelocity.checked;
            if (allNode) {
                let same = true, sameValue = null, first = true;
                itms.forEach(itm => {
                    if (!same) return;
                    if (first) {
                        first = false;
                        sameValue = itm.velocityRot;
                        return;
                    }
                    if (itm.velocityRot != sameValue) same = false;
                });
                this.robotRotVelocity.inputs[0].value = same ? sameValue : "";
            } else this.robotRotVelocity.inputs[0].value = "";
            this.radius.inputs[0].disabled = !has || !allObstacle;
            if (allObstacle) {
                let same = true, sameValue = null, first = true;
                itms.forEach(itm => {
                    if (!same) return;
                    if (first) {
                        first = false;
                        sameValue = itm.radius;
                        return;
                    }
                    if (itm.radius != sameValue) same = false;
                });
                this.radius.inputs[0].value = same ? sameValue/100 : "";
            } else this.radius.inputs[0].value = "";
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

    constructor() {
        super("paths", "analytics");

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
            if (!this.hasPage()) return;
            if (this.page.choosing) return;
            if (!this.page.hasProject()) return;
            this.page.choosing = true;
            let chooseState = this.page.chooseState;
            chooseState.path = new subcore.Project.Path();
            chooseState.addHandler("choose", data => {
                if (!(chooseState.path instanceof subcore.Project.Path)) return;
                let path = chooseState.path;
                data = util.ensure(data, "obj");
                let itm = data.itm, shift = data.shift;
                if (!(itm instanceof subcore.Project.Node)) return;
                if (shift) path.remNode(itm);
                else path.addNode(itm);
                for (let id in chooseState.temp) this.page.odometry.remRender(chooseState.temp[id]);
                chooseState.temp = {};
                let nodes = path.nodes.filter(id => this.hasPage() && this.page.hasProject() && this.page.project.hasItem(id));
                for (let i = 0; i < nodes.length; i++) {
                    let id = nodes[i];
                    let node = this.page.project.getItem(id);
                    if (id in chooseState.temp) {
                        chooseState.temp[id].text += ", "+(i+1);
                    } else {
                        chooseState.temp[id] = this.page.odometry.addRender(new RLabel(node));
                        chooseState.temp[id].text = i+1;
                    }
                    if (i > 0) {
                        let id2 = nodes[i-1];
                        let node2 = this.page.project.getItem(id2);
                        chooseState.temp[id+"~"+id2] = this.page.odometry.addRender(new RLine(node, node2));
                    }
                }
            });
            chooseState.addHandler("done", data => {
                if (!(chooseState.path instanceof subcore.Project.Path)) return;
                let path = chooseState.path;
                if (!this.hasPage() || !this.page.hasProject()) return;
                this.page.project.addPath(path);
            });
            chooseState.addHandler("cancel", data => {
            });
        });

        this.#ePathsBox = document.createElement("div");
        this.addItem(this.ePathsBox);
        this.ePathsBox.id = "pathsbox";

        this.#eActivateBtn = document.createElement("button");
        this.addItem(this.eActivateBtn);
        this.eActivateBtn.id = "activatebtn";
        this.eActivateBtn.addEventListener("click", e => {
            if (!this.hasApp()) return;
            if (!this.hasPage()) return;
            e.stopPropagation();
            if (this.generating) {
                window.api.send("exec-term");
                return;
            }
            const projectId = this.page.projectId;
            if (!this.app.hasProject(projectId)) return;
            const project = this.app.getProject(projectId);
            if (this.page.selectedPaths.length <= 0) return;
            let id = this.page.selectedPaths[0];
            if (!project.hasPath(id)) return;
            let path = project.getPath(id);
            (async () => {
                this.generating = true;
                this.app.markChange("*all");
                await this.app.post("cmd-save", null);
                try {
                    await window.api.send("exec", [project.id, path.id]);
                    await this.checkVisuals();
                    this.visuals.forEach(id => {
                        let visual = this.getVisual(id);
                        if (!this.page.isPathSelected(id)) return;
                        visual.play();
                    });
                    this.generating = false;
                } catch (e) {
                    this.generating = false;
                    let alert = this.app.alert("There was an error executing the generation script!", "warning");
                    alert.hasInfo = true;
                    alert.info = String(e);
                    alert.iconColor = "var(--cr)";
                }
            })();
        });

        this.generating = false;
        
        this.addHandler("update", data => {
            if (!this.hasPage()) return;
            let pthsUsed = new Set();
            this.buttons.forEach(btn => {
                btn.showLines = btn.hasPath() ? !this.hasVisual(btn.path.id) : true;
                btn.update();
                if (!this.hasPage() || !this.page.hasProject() || !this.page.project.hasPath(btn.path))
                    btn.path = null;
                if (btn.hasPath()) {
                    pthsUsed.add(btn.path.id);
                    btn.selected = this.page.isPathSelected(btn.path);
                } else this.remButton(btn);
            });
            if (this.hasPage() && this.page.hasProject()) {
                let need;
                need = new Set(this.page.project.paths);
                pthsUsed.forEach(id => need.delete(id));
                need.forEach(id => this.addButton(new App.ProjectPage.PathsPanel.Button(this.page.project.getPath(id))));
            }
        });

        this.addHandler("project-set", data => {
            let has = this.hasPage() && this.page.hasProject();
            this.btn.disabled = !has;
            this.eAddBtn.disabled = !has;
            this.checkVisuals();
        });
        this.addHandler("refresh", data => {
            let has = this.hasPage() && this.page.hasProject();
            this.eActivateBtn.disabled = !this.generating && (!has || this.page.selectedPaths.length <= 0);
            this.eActivateBtn.textContent = this.generating ? "Terminate" : "Generate";
            this.eActivateBtn.classList.remove("on");
            this.eActivateBtn.classList.remove("off");
            this.generating ? this.eActivateBtn.classList.add("off") : this.eActivateBtn.classList.add("on");
            this.buttons.forEach(btn => {
                btn.post("set", data);
                if (this.hasPage() && this.page.isPathSelected(btn.path)) btn.post("add", null);
                else btn.post("rem", null);
            });
        });


        this.addHandler("pre-page-set", data => {
            if (!this.hasPage()) return;
            this.page.ePlayPauseBtn.removeEventListener("click", this.page.ePlayPauseBtn._onClick);
            delete this.page.ePlayPauseBtn._onClick;
            this.page.eProgress.removeEventListener("mousedown", this.page.eProgress._onMouseDown);
            delete this.page.eProgress._onMouseDown;
        });
        this.addHandler("post-page-set", data => {
            if (!this.hasPage()) return;
            this.page.ePlayPauseBtn._onClick = () => {
                let visuals = this.visuals.filter(id => this.page.isPathSelected(id));
                if (visuals.length <= 0) return;
                let id = visuals[0];
                let visual = this.getVisual(id);
                if (visual.isFinished) {
                    visual.nowTime = 0;
                    visual.play();
                } else visual.paused = !visual.paused;
            };
            this.page.ePlayPauseBtn.addEventListener("click", this.page.ePlayPauseBtn._onClick);
            this.page.eProgress._onMouseDown = e => {
                if (this.page.choosing) return;
                if (e.button != 0) return;
                e.stopPropagation();
                const mouseup = () => {
                    document.body.removeEventListener("mouseup", mouseup);
                    document.body.removeEventListener("mousemove", mousemove);
                };
                const mousemove = e => {
                    let r = this.page.eProgress.getBoundingClientRect();
                    let p = (e.pageX-r.left) / r.width;
                    let visuals = this.visuals.filter(id => this.page.isPathSelected(id));
                    if (visuals.length <= 0) return;
                    let id = visuals[0];
                    let visual = this.getVisual(id);
                    visual.nowTime = visual.totalTime*p;
                };
                mousemove(e);
                document.body.addEventListener("mouseup", mouseup);
                document.body.addEventListener("mousemove", mousemove);
            };
            this.page.eProgress.addEventListener("mousedown", this.page.eProgress._onMouseDown);
        });
        
        this.addHandler("update", data => {
            if (!this.hasPage()) return;
            let visuals = [];
            this.visuals.forEach(id => {
                let visual = this.getVisual(id);
                visual.show = this.page.isPathSelected(id);
                if (visual.show) visuals.push(id);
                visual.update();
                if (!this.page.hasProject() || !this.page.project.hasPath(id))
                    this.remVisual(id);
            });
            if (visuals.length <= 0) {
                if (this.hasPage()) {
                    this.page.eProgress.style.display = "none";
                    this.page.ePlayPauseBtn.style.display = "none";
                    this.page.eTimeDisplay.style.display = "none";
                }
                return;
            }
            if (this.hasPage()) {
                this.page.eProgress.style.display = "";
                this.page.ePlayPauseBtn.style.display = "";
                this.page.eTimeDisplay.style.display = "";
            }
            let id = visuals[0];
            let visual = this.getVisual(id);
            if (!this.hasPage()) return;
            this.page.eProgress.style.setProperty("--progress", (100*visual.item.interp)+"%");
            if (this.page.ePlayPauseBtn.children[0] instanceof HTMLElement)
                this.page.ePlayPauseBtn.children[0].setAttribute("name", visual.isFinished ? "refresh" : visual.paused ? "play" : "pause");
            let split;
            split = util.splitTimeUnits(visual.nowTime);
            split[0] = Math.round(split[0]);
            while (split.length > 3) {
                if (split.at(-1) > 0) break;
                split.pop();
            }
            split = split.map((v, i) => {
                v = String(v);
                if (i >= split.length-1) return v;
                let l = String(Object.values(util.UNITVALUES)[i+1]).length;
                while (v.length < l) {
                    if (i > 0) v = "0"+v;
                    else v += "0";
                }
                return v;
            });
            this.page.eTimeDisplay.textContent = split.slice(1).reverse().join(":")+"."+split[0];
            split = util.splitTimeUnits(visual.totalTime);
            split[0] = Math.round(split[0]);
            while (split.length > 3) {
                if (split.at(-1) > 0) break;
                split.pop();
            }
            split = split.map((v, i) => {
                v = String(v);
                if (i >= split.length-1) return v;
                let l = String(Object.values(util.UNITVALUES)[i+1]).length;
                while (v.length < l) {
                    if (i > 0) v = "0"+v;
                    else v += "0";
                }
                return v;
            });
            this.page.eTimeDisplay.textContent += " / " + split.slice(1).reverse().join(":")+"."+split[0];
        });
    }

    get generating() { return this.#generating; }
    set generating(v) {
        v = !!v;
        if (this.generating == v) return true;
        this.#generating = v;
        if (this.hasPage()) this.page.post("refresh-options", null);
        return true;
    }

    get buttons() { return [...this.#buttons]; }
    set buttons(v) {
        v = util.ensure(v, "arr");
        this.clearButtons();
        v.forEach(v => this.addButton(v));
    }
    clearButtons() {
        let btns = this.buttons;
        btns.forEach(btn => this.remButton(btn));
        return btns;
    }
    hasButton(btn) {
        if (!(btn instanceof App.ProjectPage.PathsPanel.Button)) return false;
        return this.#buttons.has(btn) && btn.panel == this;
    }
    addButton(btn) {
        if (!(btn instanceof App.ProjectPage.PathsPanel.Button)) return false;
        if (btn.panel != null) return false;
        if (this.hasButton(btn)) return false;
        this.#buttons.add(btn);
        btn.panel = this;
        btn._onTrigger = () => {
            if (!this.hasPage()) return;
            this.page.clearSelectedPaths();
            this.page.addSelectedPath(btn.path);
        };
        btn._onEdit = () => {
            btn._onTrigger();
            if (!this.hasPage()) return;
            if (this.page.choosing) return;
            if (!this.page.hasProject()) return;
            let pths = this.page.selectedPaths;
            if (pths.length <= 0) return;
            let id = pths[0];
            if (!this.page.project.hasPath(id)) return;
            let pth = this.page.project.getPath(id);
            this.page.choosing = true;
            let chooseState = this.page.chooseState;
            chooseState.path = pth;
            let nodes = pth.nodes;
            chooseState.addHandler("choose", data => {
                if (!(chooseState.path instanceof subcore.Project.Path)) return;
                let path = chooseState.path;
                data = util.ensure(data, "obj");
                let itm = data.itm, shift = data.shift;
                if (!(itm instanceof subcore.Project.Node)) return;
                if (shift) path.remNode(itm);
                else path.addNode(itm);
                for (let id in chooseState.temp) this.page.odometry.remRender(chooseState.temp[id]);
                chooseState.temp = {};
                let nodes = path.nodes.filter(id => this.page.hasProject() && this.page.project.hasItem(id));
                for (let i = 0; i < nodes.length; i++) {
                    let id = nodes[i];
                    let node = this.page.project.getItem(id);
                    if (id in chooseState.temp) {
                        chooseState.temp[id].text += ", "+(i+1);
                    } else {
                        chooseState.temp[id] = this.page.odometry.addRender(new RLabel(node));
                        chooseState.temp[id].text = i+1;
                    }
                    if (i > 0) {
                        let id2 = nodes[i-1];
                        let node2 = this.page.project.getItem(id2);
                        chooseState.temp[id+"~"+id2] = this.page.odometry.addRender(new RLine(node, node2));
                    }
                }
            });
            chooseState.addHandler("done", data => {
            });
            chooseState.addHandler("cancel", data => {
                if (!(chooseState.path instanceof subcore.Project.Path)) return;
                chooseState.path.nodes = nodes;
            });
        };
        btn._onRemove = () => {
            btn._onTrigger();
            if (!this.hasPage()) return;
            if (this.page.choosing) return;
            if (!this.page.hasProject()) return;
            this.page.selectedPaths.forEach(id => this.page.project.remPath(id));
            this.page.selectedPaths = this.page.selectedPaths;
        };
        btn._onChange = () => {
            if (!this.hasPage()) return;
            this.page.post("refresh-selectitem", null);
            this.page.post("refresh-options", null);
        };
        btn.addHandler("trigger", btn._onTrigger);
        btn.addHandler("edit", btn._onEdit);
        btn.addHandler("remove", btn._onRemove);
        btn.addHandler("change", btn._onChange);
        this.ePathsBox.appendChild(btn.elem);
        if (this.hasPage()) this.page.post("refresh-options", null);
        return btn;
    }
    remButton(btn) {
        if (!(btn instanceof App.ProjectPage.PathsPanel.Button)) return false;
        if (btn.panel != this) return false;
        if (!this.hasButton(btn)) return false;
        this.#buttons.delete(btn);
        btn.panel = null;
        btn.remHandler("trigger", btn._onTrigger);
        btn.remHandler("edit", btn._onEdit);
        btn.remHandler("remove", btn._onRemove);
        btn.remHandler("change", btn._onChange);
        delete btn._onTrigger;
        delete btn._onEdit;
        delete btn._onRemove;
        delete btn._onChange;
        btn.post("rem", null);
        this.ePathsBox.removeChild(btn.elem);
        if (this.hasPage()) this.page.post("refresh-options", null);
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
        if (v instanceof App.ProjectPage.PathsPanel.Visual) return this.hasVisual(v.id);
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
        if (visual.panel != null || visual.id != null) return false;
        if (this.hasVisual(id)) return false;
        this.#visuals[id] = visual;
        visual.id = id;
        visual.panel = this;
        return visual;
    }
    remVisual(v) {
        if (util.is(v, "str")) {
            if (!this.hasVisual(v)) return false;
            let visual = this.getVisual(v);
            delete this.#visuals[v];
            visual.id = null;
            visual.panel = null;
            return visual;
        }
        if (v instanceof App.ProjectPage.PathsPanel.Visual) return this.remVisual(v.id);
        return false;
    }

    async checkVisuals() {
        this.clearVisuals();
        if (!this.hasPage()) return;
        if (!this.page.hasProject()) return;
        try {
            let projectId = this.page.projectId;
            let datas = await window.api.send("exec-get", [projectId]);
            if (!util.is(datas, "obj")) return;
            if (this.page.projectId != projectId) return;
            for (let id in datas) {
                let data = datas[id];
                if (!util.is(data, "obj")) continue;
                let visual = this.addVisual(id, new App.ProjectPage.PathsPanel.Visual());
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
            if (!this.hasApp()) return;
            let alert = this.app.alert("There was an error checking for generated trajectories!", "warning");
            alert.hasInfo = true;
            alert.info = String(e);
            alert.iconColor = "var(--cr)";
        }
    };

    get eAddBtn() { return this.#eAddBtn; }
    get ePathsBox() { return this.#ePathsBox; }
    get eActivateBtn() { return this.#eActivateBtn; }
};
App.ProjectPage.PathsPanel.Visual = class AppProjectPagePathsPanelVisual extends core.Target {
    #panel;

    #id;

    #show;

    #visual;
    #item;

    #t;
    #tPrev;
    #paused;

    constructor() {
        super();

        this.#panel = null;

        this.#id = null;

        this.#show = false;

        this.#visual = new RVisual();
        this.#item = new RVisualItem(this.visual);

        this.#t = 0;
        this.#tPrev = 0;
        this.#paused = true;
    }

    get panel() { return this.#panel; }
    set panel(v) {
        v = (v instanceof App.ProjectPage.PathsPanel) ? v : null;
        if (this.panel == v) return;
        if (this.hasPage()) {
            this.page.odometry.remRender(this.visual);
            this.page.odometry.remRender(this.item);
        }
        this.#panel = v;
        if (this.hasPage() && this.show) {
            this.page.odometry.addRender(this.visual);
            this.page.odometry.addRender(this.item);
        }
    }
    hasPanel() { return this.panel instanceof App.ProjectPage.PathsPanel; }
    get page() { return this.hasPanel() ? this.panel.page : null; }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() { return this.hasPage() ? this.page.app : null; }
    hasApp() { return this.app instanceof App; }

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
        if (!this.hasPage()) return;
        if (this.show) {
            this.page.odometry.addRender(this.visual);
            this.page.odometry.addRender(this.item);
        } else {
            this.page.odometry.remRender(this.visual);
            this.page.odometry.remRender(this.item);
        }
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
        this.post("change", null);
    }
    get isFinished() { return this.nowTime >= this.totalTime; }

    get paused() { return this.#paused; }
    set paused(v) {
        v = !!v;
        if (this.paused == v) return;
        this.#paused = v;
        this.post("change", null);
    }
    get playing() { return !this.paused; }
    set playing(v) { this.paused = !v; }
    pause() { return this.paused = true; }
    play() { return this.playing = true; }

    update() {
        let deltaTime = util.getTime() - this.#tPrev;
        if (this.show && this.playing) this.nowTime += deltaTime;
        this.#tPrev += deltaTime;
    }
};
App.ProjectPage.PathsPanel.Button = class AppProjectPagePathsPanelButton extends core.Target {
    #panel;

    #path;
    #showIndices;
    #showLines;

    #elem;
    #eName;
    #eEdit;
    #eRemove;

    constructor(path) {
        super();

        this.#panel = null;

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
            this.post("trigger", null);
        });
        this.eEdit.addEventListener("click", e => {
            e.stopPropagation();
            this.post("edit", null);
        });
        this.eRemove.addEventListener("click", e => {
            e.stopPropagation();
            this.post("remove", null);
        });

        this.eName.addEventListener("change", e => {
            if (!this.hasPath()) return;
            this.path.name = this.eName.value;
            this.post("change", null);
        });

        this.addHandler("set", data => {
            this.eName.value = this.hasPath() ? this.path.name : "";
        });

        let show = false;
        this.addHandler("add", data => {
            show = true;
            this.post("udpate", null);
        });
        this.addHandler("rem", data => {
            show = false;
            this.post("udpate", null);
        });
        let prevPath = "";
        let prevShowIndicies = null, prevShowLines = null;
        let pthItems = {};
        this.addHandler("udpate", data => {
            if (!this.hasPage()) return;
            if (!this.page.hasProject()) return;
            let nodes = (show && this.hasPath()) ? this.path.nodes : [];
            let path = nodes.join("");
            if (prevPath == path && prevShowIndicies == this.showIndices && prevShowLines == this.showLines) return;
            for (let id in pthItems) this.page.odometry.remRender(pthItems[id]);
            pthItems = {};
            prevPath = path;
            prevShowIndicies = this.showIndices;
            prevShowLines = this.showLines;
            for (let i = 0; i < nodes.length; i++) {
                let id = nodes[i];
                let node = this.page.project.getItem(id);
                if (this.showIndices) {
                    if (id in pthItems) {
                        pthItems[id].text += ", "+(i+1);
                    } else {
                        pthItems[id] = this.page.odometry.addRender(new RLabel(node));
                        pthItems[id].text = i+1;
                    }
                }
                if (i > 0 && this.showLines) {
                    let id2 = nodes[i-1];
                    let node2 = this.page.project.getItem(id2);
                    pthItems[id+"~"+id2] = this.page.odometry.addRender(new RLine(node, node2));
                }
            }
        });

        this.path = path;
    }

    get panel() { return this.#panel; }
    set panel(v) {
        v = (v instanceof App.ProjectPage.PathsPanel) ? v : null;
        if (this.panel == v) return;
        this.#panel = v;
    }
    hasPanel() { return this.panel instanceof App.ProjectPage.PathsPanel; }
    get page() { return this.hasPanel() ? this.panel.page : null; }
    hasPage() { return this.page instanceof App.ProjectPage; }
    get app() { return this.hasPage() ? this.page.app : null; }
    hasApp() { return this.app instanceof App; }

    get path() { return this.#path; }
    set path(v) {
        v = (v instanceof subcore.Project.Path) ? v : null;
        if (this.path == v) return;
        this.#path = v;
        this.post("set", { v: v });
    }
    hasPath() { return this.path instanceof subcore.Project.Path; }
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

    update() { this.post("udpate", null); }
};
App.ProjectPage.OptionsPanel = class AppProjectPageOptionsPanel extends App.ProjectPage.Panel {
    #size;
    #robotSize;
    #robotMass;
    #momentOfInertia;
    #efficiency;
    #is12MotorMode;
    #eScript;
    #eScriptInput;
    #eScriptBtn;
    #scriptPython;
    #scriptUseDefault;

    constructor() {
        super("options", "settings-outline");

        let header;

        this.addItem(new App.ProjectPage.Panel.Header("Map Options"));

        this.addItem(new App.ProjectPage.Panel.SubHeader("Map Size", "m"));
        this.#size = this.addItem(new App.ProjectPage.Panel.Input2d());
        this.size.inputs.forEach((inp, i) => {
            inp.type = "number";
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
            inp.addEventListener("change", e => {
                if (!this.hasPage()) return;
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(util.ensure(parseFloat(v), "num"));
                    if (this.page.hasProject()) {
                        this.page.project["wh"[i]] = v*100;
                        this.page.project.post("change", null);
                        this.page.post("refresh-selectitem");
                    }
                }
                this.page.post("refresh-options", null);
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
                if (!this.hasPage()) return;
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(0, util.ensure(parseFloat(v), "num"));
                    if (this.page.hasProject()) {
                        this.page.project["robot"+"WH"[i]] = v*100;
                        this.page.project.post("change", null);
                        this.page.post("refresh-selectitem");
                    }
                }
                this.page.post("refresh-options", null);
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
                if (!this.hasPage()) return;
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(0, util.ensure(parseFloat(v), "num"));
                    if (this.page.hasProject())
                        this.page.project.robotMass = v;
                }
                this.page.post("refresh-options", null);
            });
        });

        this.addItem(new App.ProjectPage.Panel.Header("Script Options"));

        this.addItem(new App.ProjectPage.Panel.SubHeader("Moment of Inertia", "kg-m"));
        this.#momentOfInertia = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.momentOfInertia.inputs.forEach(inp => {
            inp.type = "number";
            inp.placeholder = "...";
            inp.min = 0;
            inp.step = 0.1;
            inp.addEventListener("change", e => {
                if (!this.hasPage()) return;
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.max(0, util.ensure(parseFloat(v), "num"));
                    if (this.page.hasProject())
                        this.page.project.config.momentOfInertia = v;
                }
                this.page.post("refresh-options", null);
            });
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Efficiency", "%"));
        this.#efficiency = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.efficiency.inputs.forEach(inp => {
            inp.type = "number";
            inp.placeholder = "...";
            inp.min = 0;
            inp.max = 100;
            inp.addEventListener("change", e => {
                if (!this.hasPage()) return;
                let v = inp.value;
                if (v.length > 0) {
                    v = Math.min(100, Math.max(0, util.ensure(parseFloat(v), "num")));
                    if (this.page.hasProject())
                        this.page.project.config.efficiency = v/100;
                }
                this.page.post("refresh-options", null);
            });
        });

        header = this.addItem(new App.ProjectPage.Panel.SubHeader("12 Motor Mode"));
        this.#is12MotorMode = document.createElement("label");
        this.is12MotorMode.classList.add("switch");
        this.is12MotorMode.innerHTML = "<input type='checkbox'><span></span>";
        header.elem.appendChild(this.is12MotorMode);
        this.#is12MotorMode = this.is12MotorMode.children[0];
        this.is12MotorMode.addEventListener("change", e => {
            if (!this.hasPage()) return;
            let v = this.is12MotorMode.checked;
            this.page.project.config.is12MotorMode = v;
            this.page.post("refresh-options", null);
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
            if (!this.hasPage()) return;
            let v = this.eScriptInput.value;
            if (this.page.hasProject())
                this.page.project.config.script = (v.length > 0) ? v : null;
            this.page.post("refresh-options", null);
        });
        this.eScriptBtn.addEventListener("click", e => {
            let dialog = document.createElement("input");
            dialog.type = "file";
            dialog.accept = ".py";
            dialog.addEventListener("change", e => {
                if (!this.hasPage()) return;
                let v = this.eScriptInput.value = (dialog.files[0] instanceof File) ? dialog.files[0].path : "";
                if (this.page.hasProject())
                    this.page.project.config.script = (v.length > 0) ? v : null;
                this.page.post("refresh-options", null);
            });
            dialog.click();
        });

        this.addItem(new App.ProjectPage.Panel.SubHeader("Script Python", "shell"));
        this.#scriptPython = this.addItem(new App.ProjectPage.Panel.Input1d());
        this.scriptPython.inputs.forEach(inp => {
            inp.type = "text";
            inp.placeholder = "Python command";
            inp.addEventListener("change", e => {
                if (!this.hasPage()) return;
                let v = inp.value;
                if (this.page.hasProject())
                    this.page.project.config.scriptPython = v;
                this.page.post("refresh-options", null);
            });
        });

        header = this.addItem(new App.ProjectPage.Panel.SubHeader("Default Generator Script"));
        this.#scriptUseDefault = document.createElement("label");
        this.scriptUseDefault.classList.add("switch");
        this.scriptUseDefault.innerHTML = "<input type='checkbox'><span></span>";
        header.elem.appendChild(this.scriptUseDefault);
        this.#scriptUseDefault = this.scriptUseDefault.children[0];
        this.scriptUseDefault.addEventListener("change", e => {
            if (!this.hasPage()) return;
            let v = this.scriptUseDefault.checked;
            if (this.page.hasProject())
                this.page.project.config.scriptUseDefault = v;
            this.page.post("refresh-options", null);
        });

        this.addHandler("project-set", data => {
            let has = this.hasPage() && this.page.hasProject();
            this.btn.disabled = !has;
            this.size.inputs.forEach(inp => (inp.disabled = !has));
            this.robotSize.inputs.forEach(inp => (inp.disabled = !has));
            this.robotMass.inputs.forEach(inp => (inp.disabled = !has));
            this.momentOfInertia.inputs.forEach(inp => (inp.disabled = !has));
            this.efficiency.inputs.forEach(inp => (inp.disabled = !has));
            this.is12MotorMode.disabled = !has;
            this.scriptPython.inputs.forEach(inp => (inp.disabled = !has));
            this.scriptUseDefault.disabled = !has;
        });
        this.addHandler("refresh", data => {
            let has = this.hasPage() && this.page.hasProject();
            this.size.inputs.forEach((inp, i) => (inp.value = has ? this.page.project["wh"[i]]/100 : ""));
            this.robotSize.inputs.forEach((inp, i) => (inp.value = has ? this.page.project["robot"+"WH"[i]]/100 : ""));
            this.robotMass.inputs.forEach(inp => (inp.value = has ? this.page.project.robotMass : ""));
            this.momentOfInertia.inputs.forEach(inp => (inp.value = has ? this.page.project.config.momentOfInertia : ""));
            this.efficiency.inputs.forEach(inp => (inp.value = has ? this.page.project.config.efficiency*100 : ""));
            this.is12MotorMode.checked = has ? this.page.project.config.is12MotorMode : false;
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
    get momentOfInertia() { return this.#momentOfInertia; }
    get efficiency() { return this.#efficiency; }
    get is12MotorMode() { return this.#is12MotorMode; }
    get eScript() { return this.#eScript; }
    get eScriptInput() { return this.#eScriptInput; }
    get eScriptBtn() { return this.#eScriptBtn; }
    get scriptPython() { return this.#scriptPython; }
    get scriptUseDefault() { return this.#scriptUseDefault; }
}
