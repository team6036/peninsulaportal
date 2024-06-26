import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";

import Source from "../../sources/source.js";


import PanelTab from "./tab.js";
import PanelBrowserTab from "./browsertab.js";


export default class PanelAddTab extends PanelTab {
    #searchPart;
    #tags;
    #items;

    #eSearch;
    #eSearchTags;
    #eSearchInput;
    #eSearchClear;
    #eContent;

    static NAME = "New Tab";
    static NICKNAME = "New";
    static ICON = null;
    static ICONSRC = null;

    constructor(a) {
        super(a);

        this.elem.classList.add("add");

        this.#searchPart = "";
        this.#tags = [];
        this.#items = [];

        this.#eSearch = document.createElement("div");
        this.elem.appendChild(this.eSearch);
        this.eSearch.classList.add("search");
        this.#eSearchTags = document.createElement("div");
        this.eSearch.appendChild(this.eSearchTags);
        this.eSearchTags.classList.add("tags");
        this.#eSearchInput = document.createElement("input");
        this.eSearch.appendChild(this.eSearchInput);
        this.eSearchInput.type = "text";
        this.eSearchInput.placeholder = "";
        this.eSearchInput.autocomplete = "off";
        this.eSearchInput.spellcheck = false;
        this.#eSearchClear = document.createElement("button");
        this.eSearch.appendChild(this.eSearchClear);
        this.eSearchClear.innerHTML = "<ion-icon name='close'></ion-icon>";
        this.#eContent = document.createElement("div");
        this.elem.appendChild(this.eContent);
        this.eContent.classList.add("content");

        this.eSearchInput.addEventListener("keydown", e => {
            e.stopPropagation();
            if (!["Backspace", "Delete"].includes(e.code)) return;
            if (this.eSearchInput.value.length > 0) return;
            this.searchPart = null;
        });
        this.eSearchInput.addEventListener("input", e => {
            this.change("query", null, this.eSearchInput.value);
            this.refresh();
        });
        this.eSearchClear.addEventListener("click", e => {
            e.stopPropagation();
            this.searchPart = null;
        });

        this.addHandler("update", delta => {
            if (this.isClosed) return;
            this.items.forEach(itm => itm.update(delta));
        });

        this.addHandler("add", () => this.refresh());
        this.addHandler("rem", () => this.refresh());

        if (util.is(a, "str")) a = { query: a };

        a = util.ensure(a, "obj");
        this.searchPart = a.searchPart;
        this.query = a.query;

        this.refresh();
    }

    refresh() {
        this.clearTags();
        this.placeholder = "";
        this.clearItems();
        let toolItems = this.Panel.getTools();
        toolItems = toolItems.map(data => {
            let itm = new PanelAddTab.Button(data.class.NAME, "", "");
            let btn = itm;
            itm.btn.disabled = !!data.disabled;
            if (data.class.ICONSRC) itm.iconSrc = data.class.ICONSRC;
            else if (data.class.ICON) itm.icon = data.class.ICON;
            if (data.class.ICONCOLOR) itm.iconColor = data.class.ICONCOLOR;
            return {
                item: itm,
                trigger: () => {
                    if (!this.hasParent()) return;
                    if (!!data.disabled) return;
                    let index = this.parent.tabs.indexOf(this);
                    this.parent.addTab(new data.class(), index);
                    this.parent.remTab(this);
                },
                contextmenu: e => {
                    let itm;
                    let menu = new core.Menu();
                    itm = menu.addItem(new core.Menu.Item("Open"));
                    itm.addHandler("trigger", e => {
                        btn.post("trigger", e);
                    });
                    itm = menu.addItem(new core.Menu.Item("Start Dragging"));
                    itm.addHandler("trigger", e => {
                        btn.post("drag", e);
                    });
                    core.Menu.contextMenu = menu;
                    core.Menu.placeContextMenu(e.pageX, e.pageY);
                },
                drag: () => {
                    if (!!data.disabled) return;
                    this.app.dragData = new data.class();
                    this.app.dragging = true;
                },
            };
        });
        toolItems = toolItems.map(item => {
            if (item.init) item.init(item.item);
            item.item.addHandler("trigger", item.trigger);
            item.item.addHandler("contextmenu", item.contextmenu);
            item.item.addHandler("drag", item.drag);
            return item.item;
        });
        const toolItemSelect = itm => {
            itm.item.selectName(null);
            itm.matches.forEach(match => itm.item.selectName(match.indices));
            return itm.item;
        };
        const nodeItemSelect = itm => {
            itm.item.selectName(null);
            itm.item.selectInfo(null);
            itm.matches.forEach(match => {
                if (match.key == "node.path") itm.item.selectName(match.indices);
                if (match.key == "node.field.type") itm.item.selectInfo(match.indices);
            });
            return itm.item;
        };
        if (this.searchPart == null) {
            this.tags = [];
            this.placeholder = "Search tools, tables, and topics";
            toolItems = lib.search(toolItems, ["name"], this.query).map(toolItemSelect);
            if (this.query.length > 0) {
                let nodeItems = [];
                if (this.page.hasSource()) {
                    let node = this.page.source.tree;
                    const dfs = node => {
                        let itm = new PanelAddTab.NodeButton(node);
                        let btn = itm;
                        nodeItems.push({
                            item: itm,
                            trigger: () => {
                                if (!this.hasParent()) return;
                                let index = this.parent.tabs.indexOf(this);
                                this.parent.addTab(new PanelBrowserTab(node.path), index);
                                this.parent.remTab(this);
                            },
                            contextmenu: e => {
                                let itm;
                                let menu = new core.Menu();
                                itm = menu.addItem(new core.Menu.Item("Open"));
                                itm.addHandler("trigger", e => {
                                    btn.post("trigger", e);
                                });
                                itm = menu.addItem(new core.Menu.Item("Start Dragging"));
                                itm.addHandler("trigger", e => {
                                    btn.post("drag", e);
                                });
                                core.Menu.contextMenu = menu;
                                core.Menu.placeContextMenu(e.pageX, e.pageY);
                            },
                            drag: () => {
                                this.app.dragData = this.page.hasSource() ? this.page.source.tree.lookup(node.path) : null;
                                this.app.dragging = true;
                            },
                        });
                        node.nodeObjects.forEach(node => dfs(node));
                    };
                    dfs(node);
                }
                nodeItems = nodeItems.map(item => {
                    if (item.init) item.init(item.item);
                    item.item.addHandler("trigger", item.trigger);
                    item.item.addHandler("contextmenu", item.contextmenu);
                    item.item.addHandler("drag", item.drag);
                    return item.item;
                });
                nodeItems = lib.search(nodeItems, ["node.path", "node.field.type"], this.query).map(nodeItemSelect);
                this.items = [
                    new PanelAddTab.Header("Tools"),
                    ...toolItems,
                    new PanelAddTab.Header("Tables and Topics"),
                    ...nodeItems,
                ];
            } else {
                this.items = [
                    new PanelAddTab.Button("Tables", "folder-outline", "", true),
                    new PanelAddTab.Button("Topics", "document-outline", "", true),
                    new PanelAddTab.Button("All", "", "", true),
                    new PanelAddTab.Divider(),
                    new PanelAddTab.Header("Tools"),
                    new PanelAddTab.Button("Tools", "hammer", "", true),
                    ...toolItems,
                ];
                this.items[0].addHandler("trigger", () => {
                    this.searchPart = "tables";
                });
                this.items[1].addHandler("trigger", () => {
                    this.searchPart = "topics";
                });
                this.items[2].iconSrc = "./assets/icons/variable.svg";
                this.items[2].addHandler("trigger", () => {
                    this.searchPart = "all";
                });
                this.items[5].addHandler("trigger", () => {
                    this.searchPart = "tools";
                });
            }
        } else if (this.searchPart == "tools") {
            this.tags = [new PanelAddTab.Tag("Tools", "hammer")];
            this.placeholder = "Search tools";
            toolItems = lib.search(toolItems, ["name"], this.query).map(toolItemSelect);
            this.items = toolItems;
        } else if (["tables", "topics", "all"].includes(this.searchPart)) {
            this.tags = [new PanelAddTab.Tag(
                util.formatText(this.searchPart),
                { tables: "folder-outline", topics: "document-outline", all: "" }[this.searchPart],
            )];
            if (this.searchPart == "all") this.tags[0].iconSrc = "./assets/icons/variable.svg";
            this.placeholder = "Search "+this.searchPart.toLowerCase();
            let items = [];
            if (this.page.hasSource()) {
                let node = this.page.source.tree;
                const dfs = node => {
                    let itm = new PanelAddTab.NodeButton(node);
                    let btn = itm;
                    if ({
                        tables: !node.hasField(),
                        topics: node.hasField(),
                        all: true,
                    }[this.searchPart])
                        items.push({
                            item: itm,
                            trigger: () => {
                                if (!this.hasParent()) return;
                                let index = this.parent.tabs.indexOf(this);
                                this.parent.addTab(new PanelBrowserTab(node.path), index);
                                this.parent.remTab(this);
                            },
                            contextmenu: e => {
                                let itm;
                                let menu = new core.Menu();
                                itm = menu.addItem(new core.Menu.Item("Open"));
                                itm.addHandler("trigger", e => {
                                    btn.post("trigger", e);
                                });
                                itm = menu.addItem(new core.Menu.Item("Start Dragging"));
                                itm.addHandler("trigger", e => {
                                    btn.post("drag", e);
                                });
                                core.Menu.contextMenu = menu;
                                core.Menu.placeContextMenu(e.pageX, e.pageY);
                            },
                            drag: () => {
                                this.app.dragData = this.page.hasSource() ? this.page.source.tree.lookup(node.path) : null;
                                this.app.dragging = true;
                            },
                        });
                    node.nodeObjects.forEach(node => dfs(node));
                };
                dfs(node);
            }
            items = items.map(item => {
                if (item.init) item.init(item.item);
                item.item.addHandler("trigger", item.trigger);
                item.item.addHandler("contextmenu", item.contextmenu);
                item.item.addHandler("drag", item.drag);
                return item.item;
            });
            items = lib.search(items, ["node.path", "node.field.type"], this.query).map(nodeItemSelect);
            this.items = items;
        }
        this.eSearchInput.focus();
    }

    get searchPart() { return this.#searchPart; }
    set searchPart(v) {
        v = (v == null) ? null : String(v);
        if (this.searchPart == v) return;
        this.change("searchPart", this.searchPart, this.#searchPart=v);
        this.query = "";
        this.refresh();
    }
    hasSearchPart() { return this.searchPart != null; }

    get tags() { return [...this.#tags]; }
    set tags(v) {
        v = util.ensure(v, "arr");
        this.clearTags();
        this.addTag(v);
    }
    clearTags() {
        let tags = this.tags;
        this.remTag(tags);
        return tags;
    }
    hasTag(tag) {
        if (!(tag instanceof PanelAddTab.Tag)) return false;
        return this.#tags.includes(tag);
    }
    addTag(...tags) {
        return util.Target.resultingForEach(tags, tag => {
            if (!(tag instanceof PanelAddTab.Tag)) return false;
            if (this.hasTag(tag)) return false;
            this.#tags.push(tag);
            this.eSearchTags.appendChild(tag.elem);
            return tag;
        });
    }
    remTag(...tags) {
        return util.Target.resultingForEach(tags, tag => {
            if (!(tag instanceof PanelAddTab.Tag)) return false;
            if (!this.hasTag(tag)) return false;
            this.#tags.splice(this.#tags.indexOf(tag), 1);
            this.eSearchTags.removeChild(tag.elem);
            return tag;
        });
    }

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
        if (!(itm instanceof PanelAddTab.Item)) return false;
        return this.#items.includes(itm);
    }
    addItem(...itms) {
        return util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof PanelAddTab.Item)) return false;
            if (this.hasItem(itm)) return false;
            this.#items.push(itm);
            this.eContent.appendChild(itm.elem);
            itm.onAdd();
            return itm;
        });
    }
    remItem(...itms) {
        return util.Target.resultingForEach(itms, itm => {
            if (!(itm instanceof PanelAddTab.Item)) return false;
            if (!this.hasItem(itm)) return false;
            itm.onRem();
            this.#items.splice(this.#items.indexOf(itm), 1);
            this.eContent.removeChild(itm.elem);
            return itm;
        });
    }

    get eSearch() { return this.#eSearch; }
    get eSearchTags() { return this.#eSearchTags; }
    get eSearchInput() { return this.#eSearchInput; }
    get eSearchClear() { return this.#eSearchClear; }
    get eContent() { return this.#eContent; }

    get placeholder() { return this.eSearchInput.placeholder; }
    set placeholder(v) { this.eSearchInput.placeholder = v; }

    get query() { return this.eSearchInput.value; }
    set query(v) {
        v = util.ensure(v, "str");
        this.change("query", this.query, this.eSearchInput.value=v);
    }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            searchPart: this.searchPart,
            query: this.query,
        });
    }
}
PanelAddTab.Tag = class PanelAddTabTag extends util.Target {
    #elem;
    #eIcon;
    #eName;

    constructor(name, icon="") {
        super();

        this.#elem = document.createElement("div");
        this.elem.classList.add("item");
        this.#eIcon = document.createElement("ion-icon");
        this.elem.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.elem.appendChild(this.eName);
        let chevron = document.createElement("ion-icon");
        this.elem.appendChild(chevron);
        chevron.name = "chevron-forward";

        this.name = name;
        this.icon = icon;
    }

    get elem() { return this.#elem; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }

    get name() { return this.eName.textContent; }
    set name(v) { this.eName.textContent = v; }
    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.children[0].getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }
};
PanelAddTab.Item = class PanelAddTabItem extends util.Target {
    #elem;

    constructor() {
        super();

        this.#elem = document.createElement("div");
    }

    get elem() { return this.#elem; }

    update(delta) { this.post("update", delta); }
};
PanelAddTab.Header = class PanelAddTabHeader extends PanelAddTab.Item {
    constructor(value) {
        super();

        this.elem.classList.add("header");

        this.value = value;
    }

    get value() { return this.elem.textContent; }
    set value(v) { this.elem.textContent = v; }
};
PanelAddTab.Divider = class PanelAddTabDivider extends PanelAddTab.Item {
    constructor() {
        super();

        this.elem.classList.add("divider");
    }
};
PanelAddTab.Button = class PanelAddTabButton extends PanelAddTab.Item {
    #nameIndices;
    #infoIndices;

    #btn;
    #eIcon;
    #eName;
    #eInfo;
    #eChevron;

    constructor(name, icon="", color="", hasChevron=false) {
        super();

        this.elem.classList.add("item");

        this.#nameIndices = null;
        this.#infoIndices = null;
        
        this.#btn = document.createElement("button");
        this.elem.appendChild(this.btn);
        this.#eIcon = document.createElement("ion-icon");
        this.btn.appendChild(this.eIcon);
        this.#eName = document.createElement("div");
        this.btn.appendChild(this.eName);
        this.eName.classList.add("name");
        this.#eInfo = document.createElement("div");
        this.btn.appendChild(this.eInfo);
        this.eInfo.classList.add("info");
        this.#eChevron = document.createElement("ion-icon");
        this.btn.appendChild(this.eChevron);
        this.eChevron.name = "chevron-forward";

        let cancel = 10;
        this.btn.addEventListener("click", e => {
            e.stopPropagation();
            if (cancel <= 0) return cancel = 10;
            this.post("trigger", e);
        });
        this.btn.addEventListener("contextmenu", e => {
            this.post("contextmenu", e);
        });
        this.btn.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            const mouseup = e => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
                if (cancel > 0) return;
                this.post("drag");
            };
            const mousemove = e => {
                if (cancel > 0) return cancel--;
                mouseup();
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
        });

        this.name = name;
        this.icon = icon;
        this.iconColor = color;
        this.hasChevron = hasChevron;
    }

    get btn() { return this.#btn; }
    get eIcon() { return this.#eIcon; }
    get eName() { return this.#eName; }
    get eInfo() { return this.#eInfo; }
    get eChevron() { return this.#eChevron; }

    get icon() { return this.eIcon.name; }
    set icon(v) {
        this.eIcon.removeAttribute("src");
        if (this.icon == v) return;
        this.eIcon.name = v;
    }
    get iconSrc() { return this.eIcon.getAttribute("src"); }
    set iconSrc(v) {
        this.eIcon.removeAttribute("name");
        this.eIcon.setAttribute("src", v);
    }
    get iconColor() { return this.eIcon.style.color; }
    set iconColor(v) { this.eIcon.style.color = v; }

    get name() { return this.eName.textContent; }
    set name(v) {
        this.eName.textContent = v;
        v = this.name;
        let indices = this.#nameIndices;
        if (indices == null) return;
        let chunks = [];
        indices.forEach((range, i) => {
            chunks.push(v.slice((i > 0) ? indices[i-1][1] : 0, range[0]));
            chunks.push(v.slice(...range));
        });
        chunks.push(v.slice((indices.length > 0) ? indices.at(-1)[1] : 0, v.length));
        this.eName.innerHTML = "";
        chunks.forEach((chunk, i) => {
            let elem = document.createElement("span");
            this.eName.appendChild(elem);
            elem.textContent = chunk;
            elem.style.color = (i%2 == 0) ? "var(--v5)" : "";
            elem.style.fontWeight = (i%2 == 0) ? "" : "bold";
        });
    }

    get info() { return this.eInfo.textContent; }
    set info(v) {
        this.eInfo.textContent = v;
        v = this.info;
        let indices = this.#infoIndices;
        if (indices == null) return;
        let chunks = [];
        indices.forEach((range, i) => {
            chunks.push(v.slice((i > 0) ? indices[i-1][1] : 0, range[0]));
            chunks.push(v.slice(...range));
        });
        chunks.push(v.slice((indices.length > 0) ? indices.at(-1)[1] : 0, v.length));
        this.eInfo.innerHTML = "";
        chunks.forEach((chunk, i) => {
            let elem = document.createElement("span");
            this.eInfo.appendChild(elem);
            elem.textContent = chunk;
            elem.style.opacity = (i%2 == 0) ? "50%" : "";
        });
    }

    selectName(indices) {
        if (indices != null) {
            indices = util.ensure(indices, "arr").map(range => util.ensure(range, "arr").map(v => util.ensure(v, "int")));
            indices = indices.filter(range => range.length == 2).map(range => [range[0], range[1]+1]).sort((a, b) => a[0]-b[0]);
            let indices2 = [];
            indices.forEach(range => {
                if (indices2.length <= 0 || range[0] > indices2.at(-1)[1])
                    return indices2.push(range);
                indices2.at(-1)[1] = range[1];
            });
            this.#nameIndices = indices2;
        }
        this.name = this.name;
    }
    selectInfo(indices) {
        if (indices != null) {
            indices = util.ensure(indices, "arr").map(range => util.ensure(range, "arr").map(v => util.ensure(v, "int")));
            indices = indices.filter(range => range.length == 2).map(range => [range[0], range[1]+1]).sort((a, b) => a[0]-b[0]);
            let indices2 = [];
            indices.forEach(range => {
                if (indices2.length <= 0 || range[0] > indices2.at(-1)[1])
                    return indices2.push(range);
                indices2.at(-1)[1] = range[1];
            });
            this.#infoIndices = indices2;
        }
        this.info = this.info;
    }

    get hasChevron() { return this.elem.contains(this.eChevron); }
    set hasChevron(v) {
        v = !!v;
        if (v == this.hasChevron) return;
        if (v) this.btn.appendChild(this.eChevron);
        else this.btn.removeChild(this.eChevron);
    }
};
PanelAddTab.NodeButton = class PanelAddTabNodeButton extends PanelAddTab.Button {
    #node;

    constructor(node) {
        super();

        this.elem.classList.remove("item");
        this.elem.classList.add("explorernode");
        this.btn.classList.add("display");
        let children = Array.from(this.btn.children);
        children.forEach(child => this.btn.removeChild(child));
        this.btn.innerHTML = "<div class='main'></div>";
        children.forEach(child => this.btn.children[0].appendChild(child));
        this.eInfo.classList.add("tag");

        const update = () => {
            if (!this.hasNode()) {
                this.icon = "document-outline";
                this.name = "?";
                return;
            }
            this.name = this.node.path;
            if (this.name.length <= 0) this.name = "/";
            this.info = util.ensure(this.node.hasField() ? this.node.field.type : "", "str");
        };
        this.addHandler("change", update);

        this.addHandler("update", delta => {
            if (!this.hasNode()) return;
            let display = Source.Field.getDisplay(this.node);
            if (display != null) {
                if ("src" in display) this.iconSrc = display.src;
                else this.icon = display.name;
                if ("color" in display) this.iconColor = display.color;
                else this.iconColor = "";
            } else {
                this.icon = "";
                this.iconColor = "";
            }
        });

        this.node = node;
    }

    get node() { return this.#node; }
    set node(v) {
        v = (v instanceof Source.Node) ? v : null;
        if (this.node == v) return;
        this.change("node", this.node, this.#node=v);
    }
    hasNode() { return !!this.node; }
};

