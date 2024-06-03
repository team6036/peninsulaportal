import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";


let Panel = null;

export default class PanelTab extends util.Target {
    #parent;

    #elem;
    #eTab;
    #eTabIcon;
    #eTabName;
    #eTabClose;

    static NAME = "Tab";
    static NICKNAME = "Tab";
    static ICON = "bookmark";
    static ICONSRC = null;
    static ICONCOLOR = "";

    static registerPanel(panel) {
        if (Panel) return;
        if (!util.is(panel, "func")) return;
        if (!(panel.prototype instanceof util.Target)) return;
        Panel = panel;
    }

    constructor(a) {
        super();

        this.#parent = 0;

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eTab = document.createElement("div");
        this.eTab.classList.add("item");
        this.#eTabIcon = document.createElement("ion-icon");
        this.eTab.appendChild(this.eTabIcon);
        this.#eTabName = document.createElement("div");
        this.eTab.appendChild(this.eTabName);
        this.eTabName.classList.add("name");
        this.#eTabClose = document.createElement("button");
        this.eTab.appendChild(this.eTabClose);
        this.eTabClose.classList.add("icon");
        this.eTabClose.innerHTML = "<ion-icon name='close'></ion-icon>";

        let cancel = 10;
        this.eTab.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            if (!this.hasParent()) return;
            this.parent.tabIndex = this.parent.tabs.indexOf(this);
        });
        this.eTab.addEventListener("contextmenu", e => {
            let itm;
            let menu = new core.Menu();
            itm = menu.addItem(new core.Menu.Item("Open"));
            itm.addHandler("trigger", e => {
                this.eTab.click();
            });
            itm = menu.addItem(new core.Menu.Item("Close"));
            itm.addHandler("trigger", e => {
                this.eTabClose.click();
            });
            itm = menu.addItem(new core.Menu.Item("Start Dragging"));
            itm.addHandler("trigger", e => {
                onDrag(e);
            });
            core.Menu.contextMenu = menu;
            core.Menu.placeContextMenu(e.pageX, e.pageY);
        });
        const onDrag = e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = () => {
                if (cancel > 0) return cancel--;
                mouseup();
                if (!this.hasParent()) return;
                this.parent.remTab(this);
                this.app.dragData = this;
                this.app.dragging = true;
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        };
        this.eTab.addEventListener("mousedown", onDrag);
        this.eTabClose.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.hasParent()) return;
            this.parent.remTab(this);
        });
        
        let isOpen = null;
        new MutationObserver(() => {
            if (isOpen != this.isOpen)
                this.change("isOpen", isOpen, isOpen=this.isOpen);
        }).observe(this.elem, { attributes: true, attributeFilter: ["class"] });

        this.parent = null;

        this.name = this.constructor.NAME;
        if (this.constructor.ICONSRC) this.iconSrc = this.constructor.ICONSRC;
        else if (this.constructor.ICON) this.icon = this.constructor.ICON;
        else this.hasIcon = false;
        if (this.constructor.ICONCOLOR) this.iconColor = this.constructor.ICONCOLOR;
    }

    get parent() { return this.#parent; }
    set parent(v) {
        v = (v instanceof Panel) ? v : null;
        if (this.parent == v) return;
        this.#parent = v;
    }
    hasParent() { return !!this.parent; }
    get app() { return app.App.instance; }
    get page() { return this.app.projectPage; }

    get elem() { return this.#elem; }
    get eTab() { return this.#eTab; }
    get eTabIcon() { return this.#eTabIcon; }
    get eTabName() { return this.#eTabName; }
    get eTabClose() { return this.#eTabClose; }

    get isOpen() { return this.elem.classList.contains("this"); }
    set isOpen(v) {
        v = !!v;
        if (this.isOpen == v) return;
        this.post("openState", this.isOpen, v);
        if (v) this.post("open");
        else this.post("close");
        if (v) this.elem.classList.add("this");
        else this.elem.classList.remove("this");
        if (v) this.eTab.classList.add("this");
        else this.eTab.classList.remove("this");
    }
    get isClosed() { return !this.isOpen; }
    set isClosed(v) { this.isOpen = !v; }
    open() { return this.isOpen = true; }
    close() { return this.isClosed = true; }

    get icon() { return this.eTabIcon.name; }
    set icon(v) {
        this.eTabIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eTabIcon.name = v;
    }
    get iconSrc() { return this.eTabIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eTabIcon.removeAttribute("name");
        this.eTabIcon.setAttribute("src", v);
    }
    get iconColor() { return this.eTabIcon.style.color; }
    set iconColor(v) { this.eTabIcon.style.color = v; }
    get hasIcon() { return this.eTab.contains(this.eTabIcon); }
    set hasIcon(v) {
        v = !!v;
        if (this.hasIcon == v) return;
        if (v) this.eTab.appendChild(this.eTabIcon);
        else this.eTab.removeChild(this.eTabIcon);
    }

    get name() { return this.eTabName.textContent; }
    set name(v) { this.eTabName.textContent = v; }

    update(delta) { this.post("update", delta); }
    format() { this.post("format"); }

    getHovered(pos, options) {
        pos = new V(pos);
        options = util.ensure(options, "obj");
        return null;
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {});
    }
};
