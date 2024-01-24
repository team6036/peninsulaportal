import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";


const FEATURES = ["PANEL", "PLANNER"];


class Collection extends util.Target {
    #app;
    #elem;
    #name;

    #host;
    #ignore;

    #items;

    constructor(app, elem, name, host) {
        super();

        if (!(app instanceof App)) throw new Error("App is not of class App");
        this.#app = app;
        this.#elem = (elem instanceof HTMLDivElement) ? elem : document.createElement("div");
        this.elem.classList.add("collection");
        let line = document.createElement("div");
        line.classList.add("line");
        const getAt = e => {
            let order = this.order;
            order = order.filter(id => this.hasItem(id));
            const moveId = e.dataTransfer.getData("text/plain");
            if (order.length > 0 && order.at(-1) == moveId) order.pop();
            for (let i = 0; i < order.length; i++) {
                let id = order[i];
                if (id == moveId) continue;
                if (!this.hasItem(id)) return;
                let item = this.getItem(id);
                let r = item.eBtn.getBoundingClientRect();
                if (e.pageY < r.top+r.height/2) return i;
                if (i+1 < order.length) continue;
                if (e.pageY >= r.top+r.height/2)
                    return i+1;
            }
            return 0;
        };
        this.elem.addEventListener("dragover", e => {
            e.preventDefault();
            this.items.forEach(id => this.getItem(id).close());
            const at = getAt(e);
            this.elem.appendChild(line);
            line.style.order = 2*at;
        });
        this.elem.addEventListener("drop", e => {
            e.preventDefault();
            const at = getAt(e);
            let order = this.order;
            order = order.filter(id => this.hasItem(id));
            const moveId = e.dataTransfer.getData("text/plain");
            order.splice(order.indexOf(moveId), 1);
            order.splice(at, 0, moveId);
            this.order = order;
            this.format();
        });
        this.elem.addEventListener("dragend", e => {
            line.remove();
        });
        this.#name = String(name);

        this.#host = null;
        this.#ignore = false;

        this.#items = {};

        this.host = host;

        this.addHandler("update", delta => this.items.forEach(id => this.getItem(id).update(delta)));
    }

    get app() { return this.#app; }
    get elem() { return this.#elem; }
    get name() { return this.#name; }

    get host() { return this.#host; }
    set host(v) {
        v = (v == null) ? null : String(v);
        if (this.host == v) return;
        this.#host = v;
        this.pullItems();
    }
    hasHost() { return this.host != null; }
    async get(ignoreIgnore=false) {
        if (this.#ignore && !ignoreIgnore) return null;
        if (!this.hasHost()) return null;
        try {
            let resp = await fetch(this.host+"/api/"+this.name);
            if (resp.status != 200) throw resp.status;
            return await resp.json();
        } catch (e) { this.app.doError(util.formatText(this.name)+" Get Error", "", e); }
        return null;
    }
    async put(k, v, ignoreIgnore=false) {
        if (this.#ignore && !ignoreIgnore) return false;
        if (!this.hasHost()) return false;
        try {
            let resp = await fetch(this.host+"/api/"+this.name, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    attr: k,
                    value: v,
                }),
            });
            if (resp.status != 200) throw resp.status;
            return true;
        } catch (e) { this.app.doError(util.formatText(this.name)+" Update Error", "Put "+k+" = "+JSON.stringify(v), e); }
        return false;
    }
    async del(k, ignoreIgnore=false) {
        if (this.#ignore && !ignoreIgnore) return false;
        if (!this.hasHost()) return false;
        try {
            let resp = await fetch(this.host+"/api/"+this.name, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    attr: k,
                }),
            });
            if (resp.status != 200) throw resp.status;
            return true;
        } catch (e) { this.app.doError(util.formatText(this.name)+" Update Error", "Delete "+k, e); }
        return false;
    }

    get items() { return Object.keys(this.#items); }
    set items(v) {
        let items = util.ensure(v, "arr");
        this.clearItems();
        this.addItem(items);
    }
    clearItems() {
        let items = this.items.map(id => this.getItem(id));
        this.remItem(items);
        return items;
    }
    hasItem(v) {
        if (!(v instanceof this.constructor.Item)) return String(v) in this.#items;
        return this.hasItem(v.id) && v.collection == this;
    }
    getItem(id) {
        id = String(id);
        if (!this.hasItem(id)) return null;
        return this.#items[id];
    }
    addItem(...items) {
        let r = util.Target.resultingForEach(items, item => {
            if (!(item instanceof this.constructor.Item)) return false;
            if (this.hasItem(item.id) || this.hasItem(item)) return false;
            this.#items[item.id] = item;
            this.elem.appendChild(item.elem);
            item.addHandler("change", async (c, f, t) => {
                if (this.#ignore) return;
                if (c == "id") {
                    await this.del(this.name+"."+f);
                    if (t != null) {
                        let data = item.data;
                        if (data != null) await this.put(this.name+"."+t, data);
                        if (item.active) await this.put("active", t);
                    }
                    return this.pullItems();
                }
                if (c == "active") {
                    await this.put("active", t ? item.id : null);
                    return this.pullItems();
                }
                let data = item.data;
                if (data != null) await this.put(this.name+"."+item.id, data);
                return this.pullItems();
            });
            (async () => {
                if (this.#ignore) return;
                let data = item.data;
                if (data == null) data = {};
                await this.put(this.name+"."+item.id, data);
                await this.pullItems();
            })();
            item.onAdd();
            return item;
        });
        this.format();
        return r;
    }
    remItem(...items) {
        let r = util.Target.resultingForEach(items, item => {
            if (!(item instanceof this.constructor.Item)) item = this.getItem(item);
            if (!(item instanceof this.constructor.Item)) return false;
            if (!this.hasItem(item)) return false;
            item.onRem();
            delete this.#items[item.id];
            this.elem.removeChild(item.elem);
            (async () => {
                if (this.#ignore) return;
                await this.del(this.name+"."+item.id);
                await this.pullItems();
            })();
            return item;
        });
        this.format();
        return r;
    }
    async pullItems() {
        if (this.#ignore) return;
        this.#ignore = true;
        for (let id in this.#items) {
            let item = this.#items[id];
            if (id == item.id) continue;
            delete this.#items[id];
            this.#items[item.id] = item;
        }
        let data = util.ensure(await this.get(true), "obj");
        let items = util.ensure(data[this.name], "obj");
        this.items.forEach(id => {
            if (id in items) return;
            this.remItem(this.getItem(id));
        });
        for (let id in items) {
            if (!this.hasItem(id)) this.addItem(new this.constructor.Item(this, id, false));
            let item = this.getItem(id);
            item.active = data.active == id;
            item.load(items[id]);
        }
        this.#ignore = false;
    }

    get order() {
        let state, order;
        state = util.ensure(this.app.state[this.name], "obj");
        order = util.ensure(state.order, "arr");
        this.order = order;
        state = util.ensure(this.app.state[this.name], "obj");
        order = util.ensure(state.order, "arr");
        return [...order];
    }
    set order(order) {
        order = util.ensure(order, "arr");
        order = order.map(id => String(id));
        let existing = {};
        for (let i = 0; i < order.length; i++) {
            let id = order[i];
            if (!(id in existing)) {
                existing[id] = id;
                continue;
            }
            order.splice(i, 1);
            i--;
        }
        this.items.forEach(id => {
            if (order.includes(id)) return;
            order.push(id);
        });
        let state = util.ensure(this.app.state[this.name], "obj");
        state.order = order;
        this.app.state[this.name] = state;
    }
    format() {
        this.order.forEach((id, i) => {
            if (!this.hasItem(id)) return;
            let item = this.getItem(id);
            item.elem.style.order = 2*i+1;
        });
    }

    update(delta) { this.post("update", delta); }
}
Collection.Item = class CollectionItem extends util.Target {
    #collection;

    #id;

    #form;

    #elem;
    #eBtn;
    #eActive;
    #eIdInput;
    #eContent;
    #eSide;
    #eDisplay;
    #eDisplayNext;
    #eDisplayPrev;
    #eDisplayNav;

    constructor(collection, id, active) {
        super();

        if (!(collection instanceof Collection)) throw new Error("Collection is not of class Collection");
        this.#collection = collection;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");

        this.#eBtn = document.createElement("button");
        this.elem.appendChild(this.eBtn);
        this.eBtn.innerHTML = "<div class='active'></div><input><div class='space'></div><ion-icon name='chevron-down'></ion-icon>";
        this.eBtn.draggable = true;
        this.eBtn.addEventListener("dragstart", e => {
            e.dataTransfer.dropEffect = "move";
            e.dataTransfer.setData("text/plain", this.id);
            this.close();
            setTimeout(() => (this.elem.style.display = "none"), 10);
        });
        this.eBtn.addEventListener("dragend", e => {
            this.elem.style.display = "";
        });
        this.#eActive = this.eBtn.children[0];
        this.#eIdInput = this.eBtn.children[1];

        this.eActive.addEventListener("click", e => {
            e.stopPropagation();
            this.active = !this.active;
        });
        this.eIdInput.addEventListener("change", e => {
            this.id = this.eIdInput.value;
        });
        this.eBtn.addEventListener("click", e => {
            this.isOpen = !this.isOpen;
        });
        this.eBtn.addEventListener("contextmenu", e => {
            let itm;
            let menu = new core.App.Menu();
            itm = menu.addItem(new core.App.Menu.Item(this.isOpen ? "Close" : "Open"));
            itm.addHandler("trigger", e => {
                this.isOpen = !this.isOpen;
            });
            itm = menu.addItem(new core.App.Menu.Item("Delete"));
            itm.addHandler("trigger", e => {
                this.id = null;
            });
            this.app.contextMenu = menu;
            this.app.placeContextMenu(e.pageX, e.pageY);
        });
        this.eIdInput.addEventListener("click", e => {
            e.stopPropagation();
        });
        this.open();
        this.close();

        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");
        this.#eSide = document.createElement("div");
        this.eContent.appendChild(this.eSide);
        this.eSide.classList.add("side");
        this.#eDisplay = document.createElement("div");
        this.eContent.appendChild(this.eDisplay);
        this.eDisplay.classList.add("display");
        this.#eDisplayNext = document.createElement("button");
        this.eDisplay.appendChild(this.eDisplayNext);
        this.eDisplayNext.classList.add("next");
        this.eDisplayNext.innerHTML = "<ion-icon name='chevron-forward'></ion-icon>";
        this.#eDisplayPrev = document.createElement("button");
        this.eDisplay.appendChild(this.eDisplayPrev);
        this.eDisplayPrev.classList.add("prev");
        this.eDisplayPrev.innerHTML = "<ion-icon name='chevron-back'></ion-icon>";
        this.#eDisplayNav = document.createElement("div");
        this.eDisplay.appendChild(this.eDisplayNav);
        this.eDisplayNav.classList.add("nav");

        let i = 0;
        const update = () => {
            let elems = Array.from(this.eDisplay.querySelectorAll(":scope > .odom"));
            let n = elems.length;
            i = Math.min(n-1, Math.max(0, i));
            this.eDisplay.style.setProperty("--i", i);
            this.eDisplayNext.disabled = i >= n-1;
            this.eDisplayPrev.disabled = i <= 0;
            this.eDisplayNav.innerHTML = "";
            elems.forEach((elem, j) => {
                elem.style.setProperty("--j", j);
                let btn = document.createElement("button");
                this.eDisplayNav.appendChild(btn);
                btn.classList.add("override");
                if (i == j) btn.classList.add("this");
                btn.addEventListener("click", e => {
                    i = j;
                    update();
                });
            });
        };
        new MutationObserver(update).observe(this.eDisplay, {
            childList: true,
        });
        this.eDisplayNext.addEventListener("click", e => {
            i++;
            update();
        });
        this.eDisplayPrev.addEventListener("click", e => {
            i--;
            update();
        });
        update();

        this.#form = new core.Form();
        this.eSide.appendChild(this.form.elem);

        this.id = id;

        this.active = active;
    }

    get collection() { return this.#collection; }
    get app() { return this.collection.app; }

    get id() { return this.#id; }
    set id(v) {
        v = (v == null) ? null : String(v);
        if (this.id == v) return;
        this.change("id", this.id, this.#id=v);
        this.eIdInput.value = this.id;
    }
    hasId() { return this.id != null; }

    get data() { return null; }
    load(data) {}

    get form() { return this.#form; }

    get elem() { return this.#elem; }
    get eBtn() { return this.#eBtn; }
    get eActive() { return this.#eActive; }
    get eIdInput() { return this.#eIdInput; }
    get eContent() { return this.#eContent; }
    get eSide() { return this.#eSide; }
    get eDisplay() { return this.#eDisplay; }
    get eDisplayNext() { return this.#eDisplayNext; }
    get eDisplayPrev() { return this.#eDisplayPrev; }
    get eDisplayNav() { return this.#eDisplayNav; }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(v) {
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
        this.eIdInput.disabled = !this.isOpen;
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get active() { return this.eActive.classList.contains("this"); }
    set active(v) {
        v = !!v;
        if (this.active == v) return;
        if (v) this.eActive.classList.add("this");
        else this.eActive.classList.remove("this");
        this.change("active", !this.active, this.active);
    }

    update(delta) { this.post("update", delta); }
};

class TemplateCollection extends Collection {
    constructor(app, elem, host) {
        super(app, elem, "templates", host);
    }
}
TemplateCollection.Item = class TemplateCollectionItem extends TemplateCollection.Item {
    #odometry2d;
    #odometry3d;

    #fSize;
    #fRobotSize;
    #fRobotMass;
    #fOptions;

    constructor(...a) {
        super(...a);

        this.addHandler("rem", () => {
            this.odometry3d.renderer.dispose();
            this.odometry3d.renderer.forceContextLoss();
        });

        let apply = async () => {
            this.odometry2d.size = this.size;
            this.odometry3d.size = this.size;
            let templateImages = util.ensure(await window.api.get("template-images"), "obj");
            this.odometry2d.imageSrc = templateImages[this.id];
            this.odometry3d.template = this.id;
        };
        this.addHandler("change", apply);

        this.#odometry2d = new core.Odometry2d();
        this.eDisplay.appendChild(this.odometry2d.elem);
        this.odometry2d.padding = 20;
        this.#odometry3d = new core.Odometry3d();
        this.eDisplay.appendChild(this.odometry3d.elem);

        this.#fSize = this.form.addField(new core.Form.Input2d("field-size", 0));
        this.fSize.app = this.app;
        this.fSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fSize.baseType = "cm";
        this.fSize.activeType = "m";
        this.fSize.step = 0.1;
        this.fSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["Width", "Height"][i];
            inp.min = 0;
        });
        this.fSize.addHandler("change-value", (f, t) => this.change("size", f, t));
        this.#fRobotSize = this.form.addField(new core.Form.Input1d("robot-size", 0));
        this.fRobotSize.app = this.app;
        this.fRobotSize.types = ["m", "cm", "mm", "yd", "ft", "in"];
        this.fRobotSize.baseType = "cm";
        this.fRobotSize.activeType = "m";
        this.fRobotSize.step = 0.1;
        this.fRobotSize.inputs.forEach((inp, i) => {
            inp.placeholder = ["...", "Height"][i];
            inp.min = 0;
        });
        this.fRobotSize.addHandler("change-value", (f, t) => this.change("robotSize", f, t));
        this.#fRobotMass = this.form.addField(new core.Form.Input1d("robot-mass", 0));
        this.fRobotMass.app = this.app;
        this.fRobotMass.types = ["kg", "lb"];
        this.fRobotMass.baseType = this.fRobotMass.activeType = "kg";
        this.fRobotMass.step = 0.1;
        this.fRobotMass.inputs.forEach((inp, i) => {
            inp.placeholder = "...";
            inp.min = 0;
        });
        this.fRobotMass.addHandler("change-value", (f, t) => this.change("robotMass", f, t));
        this.#fOptions = this.form.addField(new core.Form.JSONInput("options"));
        this.fOptions.addHandler("set", (k, v0, v1) => this.change("options."+k, v0, v1));
        this.fOptions.addHandler("del", (k, v) => this.change("options."+k, v, null));

        this.addHandler("update", delta => {
            this.odometry2d.update(delta);
            this.odometry3d.update(delta);
        });

        apply();
    }

    get odometry2d() { return this.#odometry2d; }
    get odometry3d() { return this.#odometry3d; }

    get fSize() { return this.#fSize; }
    get fRobotSize() { return this.#fRobotSize; }
    get fRobotMass() { return this.#fRobotMass; }
    get fOptions() { return this.#fOptions; }

    get size() { return this.fSize.value; }
    set size(v) { this.fSize.value = v; }
    get robotSize() { return this.fRobotSize.value; }
    set robotSize(v) { this.fRobotSize.value = v; }
    get robotMass() { return this.fRobotMass.value; }
    set robotMass(v) { this.fRobotMass.value = v; }
    get options() {
        let options = {};
        this.fOptions.keys.forEach(k => {
            let v = this.fOptions.get(k);
            try {
                v = JSON.parse(v);
            } catch (e) { v = null; }
            options[k] = v;
        });
        return options;
    }
    set options(options) {
        options = util.ensure(options, "obj");
        for (let k in options) {
            let v = options[k];
            try {
                v = JSON.stringify(v);
            } catch (e) { v = "null"; }
            options[k] = v;
        }
        this.fOptions.map = options;
    }

    get data() {
        return {
            size: this.size.xy,
            robotSize: this.robotSize,
            robotMass: this.robotMass,
            options: this.options,
        };
    }
    load(data) {
        data = util.ensure(data, "obj");
        this.size = data.size;
        this.robotSize = data.robotSize;
        this.robotMass = data.robotMass;
        this.options = data.options;
    }
};

class RobotCollection extends Collection {
    constructor(app, elem, host) {
        super(app, elem, "robots", host);
    }
}
RobotCollection.Item = class RobotCollectionItem extends RobotCollection.Item {
    #odometry3d;

    constructor(...a) {
        super(...a);
        
        this.addHandler("rem", () => {
            this.odometry3d.renderer.dispose();
            this.odometry3d.renderer.forceContextLoss();
        });

        let apply = async () => {
            robot.name = this.id;
            robot.robot = this.id;
        };
        this.addHandler("change-id", apply);

        this.#odometry3d = new core.Odometry3d();
        this.eDisplay.appendChild(this.odometry3d.elem);
        this.odometry3d.size = 0;
        this.odometry3d.camera.position.set(0, 5, -5);
        let robot = this.odometry3d.addRender(new core.Odometry3d.Render(this.odometry3d, 0, "", null));
        robot.color = "--a";

        this.addHandler("update", delta => {
            this.odometry3d.update(delta);
        });

        apply();
    }

    get odometry3d() { return this.#odometry3d; }
};

class ThemeCollection extends Collection {
    static prevthemeId = null;
    static currThemeId = null;
    static async tryTheme(id, data) {
        if (id == null) {
            if (this.prevthemeId != null) await window.api.set("theme", this.prevthemeId);
            this.prevthemeId = this.currThemeId = null;
            return;
        }
        if (this.prevthemeId == null) this.prevthemeId = String(await window.api.get("theme"));
        this.currThemeId = String(id);
        await window.api.set("theme", data);
    }

    constructor(app, elem, host) {
        super(app, elem, "themes", host);
    }
};
ThemeCollection.Item = class ThemeCollectionItem extends ThemeCollection.Item {
    #fName;

    #colors;
    #base;
    #accent;

    constructor(...a) {
        super(...a);

        this.eDisplay.style.display = "none";

        let eContents = [];
        for (let i = 0; i < 4; i++) {
            let eContent = document.createElement("div");
            this.eContent.appendChild(eContent);
            eContent.classList.add("content");
            eContents.push(eContent);
        }
        let forms = [];
        for (let i = 0; i < eContents.length; i++) {
            let form = new core.Form();
            eContents[i].appendChild(form.elem);
            forms.push(form);
        }

        this.#fName = this.form.addField(new core.Form.TextInput("name"));
        this.fName.app = this.app;
        this.fName.inputs.forEach((inp, i) => {
            inp.placeholder = "...";
        });
        this.fName.addHandler("change-value", (f, t) => this.change("name", f, t));

        forms[0].addField(new core.Form.Header("Colors"));
        forms[1].addField(new core.Form.Header("")).type = "color";

        "roygcbpm".split("").forEach((k, i) => {
            let form = (i < 4) ? forms[0] : forms[1];
            let f = form.addField(new core.Form.ColorInput({
                r: "Red",
                o: "Orange",
                y: "Yellow",
                g: "Green",
                c: "Cyan",
                b: "Blue",
                p: "Purple",
                m: "Magenta",
            }[k], null));
            f.type = "--c"+k;
            let ignore = false;
            f.addHandler("change", () => {
                if (ignore) return;
                this.#colors[k].set(f.value);
            });
            this.addHandler("load", () => {
                ignore = true;
                f.value = this.#colors[k];
                ignore = false;
            });
        });
        
        forms[2].addField(new core.Form.Header("Base Values"));
        forms[3].addField(new core.Form.Header("")).type = "color";

        for (let i = 0; i < 9; i++) {
            let form = (i < 5) ? forms[2] : forms[3];
            let f = form.addField(new core.Form.ColorInput("", null));
            f.showHeader = false;
            f.disabled = (i == 0) || (i == 8);
            let ignore = false;
            f.addHandler("change", () => {
                if (ignore) return;
                this.#base[i].set(f.value);
            });
            this.addHandler("load", () => {
                ignore = true;
                f.value = this.#base[i];
                ignore = false;
            });
        }

        let fTry = this.form.addField(new core.Form.Button("try", "Try Theme", ));
        fTry.showHeader = false;
        fTry.addHandler("trigger", e => {
            ThemeCollection.tryTheme(this.id, this.data);
        });
    }

    get fName() { return this.#fName; }

    get name() { return this.fName.value; }
    set name(v) { this.fName.value = v; }

    get data() {
        let colors = {};
        for (let k in this.#colors)
            colors[k] = this.#colors[k].toHex(false);
        let base = this.#base.map(c => c.toHex(false));
        return {
            name: this.name,
            colors: colors,
            base: base,
            accent: this.#accent,
        };
    }
    load(data) {
        data = util.ensure(data, "obj");
        this.name = data.name;
        this.#colors = util.ensure(data.colors, "obj");
        for (let k in this.#colors) {
            this.#colors[k] = new util.Color(this.#colors[k]);
            this.#colors[k].addHandler("change", () => this.change("data", null, this.data));
        }
        this.#base = util.ensure(data.base, "arr");
        for (let i = 0; i < this.#base.length; i++) {
            this.#base[i] = new util.Color(this.#base[i]);
            this.#base[i].addHandler("change", () => this.change("data", null, this.data));
        }
        this.post("load");
        this.#accent = data.accent;
    }
};


export default class App extends core.App {
    #state;

    constructor() {
        super();

        this.#state = {};

        this.addHandler("pre-setup", () => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("post-setup", async () => {
            const sideButtons = Array.from(document.body.querySelectorAll("#PAGE > .side button:not(.override)"));
            sideButtons.forEach(btn => {
                const elem = document.querySelector("#PAGE > .content > div#"+btn.id);
                const activate = e => {
                    sideButtons.forEach(btn => btn.classList.remove("this"));
                    btn.classList.add("this");
                    Array.from(document.body.querySelectorAll("#PAGE > .content > div")).forEach(elem => elem.classList.remove("this"));
                    let elem = document.body.querySelector("#PAGE > .content > div#"+btn.id);
                    if (!elem) return;
                    elem.classList.add("this");
                };
                let idfs = {
                    templates: () => {
                        if (!(elem instanceof HTMLDivElement)) return;
                        const eCollection = elem.querySelector(":scope > .collection");
                        const eAdd = elem.querySelector(":scope > .title > button");
                        if (!(eCollection instanceof HTMLDivElement)) return;
                        if (!(eAdd instanceof HTMLButtonElement)) return;
                        const collection = new TemplateCollection(this, eCollection);
                        this.addHandler("refresh-templates", async () => {
                            collection.host = String(await window.api.get("db-host"));
                        });
                        this.addHandler("load", () => collection.format());
                        this.addHandler("update", delta => collection.update(delta));
                        btn.addEventListener("click", activate);
                        eAdd.addEventListener("click", async e => {
                            e.stopPropagation();
                            let id = String(new Date().getFullYear());
                            if (collection.hasItem(id)) {
                                let n = 1;
                                while (collection.hasItem(id+"-"+n)) n++;
                                id += "-"+n;
                            }
                            let item = new collection.constructor.Item(collection, id, false);
                            collection.addItem(item);
                        });
                    },
                    robots: () => {
                        if (!(elem instanceof HTMLDivElement)) return;
                        const eCollection = elem.querySelector(":scope > .collection");
                        const eAdd = elem.querySelector(":scope > .title > button");
                        if (!(eCollection instanceof HTMLDivElement)) return;
                        if (!(eAdd instanceof HTMLButtonElement)) return;
                        const collection = new RobotCollection(this, eCollection);
                        this.addHandler("refresh-robots", async () => {
                            collection.host = String(await window.api.get("db-host"));
                        });
                        this.addHandler("load", () => collection.format());
                        this.addHandler("update", delta => collection.update(delta));
                        btn.addEventListener("click", activate);
                        eAdd.addEventListener("click", async e => {
                            e.stopPropagation();
                            let id = "Robot";
                            if (collection.hasItem(id)) {
                                let n = 1;
                                while (collection.hasItem(id+"-"+n)) n++;
                                id += "-"+n;
                            }
                            let item = new collection.constructor.Item(collection, id, false);
                            collection.addItem(item);
                        });
                    },
                    themes: () => {
                        if (!(elem instanceof HTMLDivElement)) return;
                        const eCollection = elem.querySelector(":scope > .collection");
                        const eAdd = elem.querySelector(":scope > .title > button");
                        if (!(eCollection instanceof HTMLDivElement)) return;
                        if (!(eAdd instanceof HTMLButtonElement)) return;
                        const collection = new ThemeCollection(this, eCollection);
                        this.addHandler("refresh-themes", async () => {
                            collection.host = String(await window.api.get("db-host"));
                        });
                        this.addHandler("load", () => collection.format());
                        this.addHandler("update", delta => collection.update(delta));
                        btn.addEventListener("click", activate);
                        eAdd.addEventListener("click", async e => {
                            e.stopPropagation();
                            let id = "new-theme";
                            if (collection.hasItem(id)) {
                                let n = 1;
                                while (collection.hasItem(id+"-"+n)) n++;
                                id += "-"+n;
                            }
                            let item = new collection.constructor.Item(collection, id, false);
                            item.load({
                                name: "New Theme",
                                colors: {
                                    r: "#ff0000",
                                    o: "#ff8800",
                                    y: "#ffff00",
                                    g: "#00ff00",
                                    c: "#00ffff",
                                    b: "#0088ff",
                                    p: "#8800ff",
                                    m: "#ff00ff",
                                },
                                base: new Array(9).fill(null).map((_, i) => new Array(3).fill(i/8*255)),
                                accent: "b",
                            });
                            collection.addItem(item);
                        });
                        new MutationObserver(() => {
                            if (elem.classList.contains("this")) return;
                            ThemeCollection.tryTheme(null);
                        }).observe(elem, { attributeFilter: ["class"] })
                    },
                    features: () => {
                        btn.addEventListener("click", e => {
                            if (btn.parentElement.classList.contains("this")) btn.parentElement.classList.remove("this");
                            else btn.parentElement.classList.add("this");
                            if (
                                btn.parentElement.querySelector(":scope > .sub button.this") &&
                                !btn.parentElement.classList.contains("this")
                            ) btn.classList.add("this");
                            else btn.classList.remove("this");
                        });
                    },
                };
                if (btn.id in idfs) idfs[btn.id]();
                else btn.addEventListener("click", activate);
            });
            sideButtons[0].click();
            const side = document.body.querySelector("#PAGE > .side");
            this.addHandler("update", delta => {
                if (!side) return;
                for (let btn of sideButtons) {
                    if (!btn.classList.contains("this")) continue;
                    side.style.setProperty("--top", btn.getBoundingClientRect().top-side.getBoundingClientRect().top+"px");
                    break;
                }
            });

            this.addHandler("refresh", () => {
                this.refreshTemplates();
                this.refreshRobots();
                this.refreshThemes();
                this.refreshFeatures();
                this.refreshConfig();
            });
            this.addHandler("refresh-features", () => {
                FEATURES.forEach(name => this.refreshFeature(name));
            });

            this.refresh();
        });
        this.addHandler("perm", async () => {
            await ThemeCollection.tryTheme(null);
            return true;
        });
    }

    refresh() { this.post("refresh"); }
    refreshTemplates() { this.post("refresh-templates"); }
    refreshRobots() { this.post("refresh-robots"); }
    refreshThemes() { this.post("refresh-themes"); }
    refreshFeatures() { this.post("refresh-features"); }
    refreshFeature(name) { this.post("refresh-feature", name); }
    refreshConfig() { this.post("refresh-config"); }

    get state() { return this.#state; }
    async loadState(state) {
        this.#state = util.ensure(state, "obj");
        this.post("load");
    }
}
