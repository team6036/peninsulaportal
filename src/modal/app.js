import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";


export default class AppModal extends core.App {
    #id;

    #iinfos;

    #eModalStyle;

    #ielem;
    #iinner;
    #ieIconBox;
    #ieIcon;
    #ieSubIcon;
    #ieTitle;
    #ieContent;

    constructor() {
        super();

        this.#id = null;

        let finished = false, modifyQueue = [];
        const checkModify = () => {
            if (!finished) return;
            while (modifyQueue.length > 0) {
                const data = util.ensure(modifyQueue.shift(), "obj");
                if ("id" in data) this.#id = String(data.id);
                const props = util.ensure(data.props, "obj");
                const cmds = util.ensure(data.cmds, "arr");
                for (let k in props)
                    this["i"+k] = props[k];
                cmds.forEach(cmd => this.post("modal-cmd-"+cmd));
            }
            this.resize();
            this.post("modify");
        };

        this.addHandler("modal-cmd-close", async () => await window.api.send("close"));

        this.addHandler("setup", async () => {
            this.menu.getItemById("about").disabled = true;
            this.menu.getItemById("reload").disabled = true;
            this.menu.getItemById("spawn").disabled = true;

            const addModify = data => {
                modifyQueue.push(data);
                checkModify();
            };
            this.addHandler("msg-init", addModify);
            this.addHandler("msg-modify", addModify);

            this.#eModalStyle = document.createElement("link");
            document.head.appendChild(this.eModalStyle);
            this.eModalStyle.rel = "stylesheet";
            this.eModalStyle.href = new URL("style-modal.css", window.location);

            document.body.innerHTML = `
<div id="mount">
    <div id="PAGE" class="page this popup core override in">
        <div class="inner">
            <div class="icon">
                <ion-icon></ion-icon>
                <ion-icon></ion-icon>
            </div>
            <div class="title"></div>
            <div class="content"></div>
        </div>
    </div>
</div>
            `;
            this.#ielem = document.querySelector(".popup.core");
            this.#iinner = document.querySelector(".popup.core > .inner");
            this.#ieIconBox = document.querySelector(".popup.core > .inner > .icon");
            this.#ieIcon = document.querySelector(".popup.core > .inner > .icon > ion-icon:first-child");
            this.#ieSubIcon = document.querySelector(".popup.core > .inner > .icon > ion-icon:last-child");
            this.#ieTitle = document.querySelector(".popup.core > .inner > .title");
            this.#ieContent = document.querySelector(".popup.core > .inner > .content");

            this.ititle = "";
            this.icontent = "";
            this.iicon = "";
            this.iinfos = [];

            await this.postResult("pre-post-setup");

            await this.resize();

            finished = true;
            checkModify();
        });
    }

    async resize() {
        await util.wait(50);
        let r = this.iinner.getBoundingClientRect();
        await window.api.set("size", [r.width, r.height]);
    }

    get id() { return this.#id; }
    async doModify(data) { return await window.api.sendMessage(this.id, "modify", data); }

    get eModalStyle() { return this.#eModalStyle; }

    get ielem() { return this.#ielem; }
    get iinner() { return this.#iinner; }
    get ieIconBox() { return this.#ieIconBox; }
    get ieIcon() { return this.#ieIcon; }
    get ieSubIcon() { return this.#ieSubIcon; }
    get ieTitle() { return this.#ieTitle; }
    get ieContent() { return this.#ieContent; }

    get iicon() { return this.ieIcon.name; }
    set iicon(v) {
        this.ieIcon.removeAttribute("src");
        if (this.iicon == v) return;
        this.ieIcon.name = v;
    }
    get iiconSrc() { return this.ieIcon.getAttribute("src"); }
    set iiconSrc(v) { this.ieIcon.setAttribute("src", v); }
    get iiconColor() { return this.ieIcon.style.color; }
    set iiconColor(v) { this.ieIcon.style.color = v; }

    get isubIcon() { return this.ieSubIcon.name; }
    set isubIcon(v) {
        this.ieSubIcon.removeAttribute("src");
        if (this.isubIcon == v) return;
        this.ieSubIcon.name = v;
    }
    get isubIconSrc() { return this.ieSubIcon.getAttribute("src"); }
    set isubIconSrc(v) { this.ieSubIcon.setAttribute("src", v); }
    get isubIconColor() { return this.ieSubIcon.style.color; }
    set isubIconColor(v) { this.ieSubIcon.style.color = v; }
    
    get ititle() { return this.ieTitle.textContent; }
    set ititle(v) { this.ieTitle.textContent = v; }

    get icontent() { return this.eContent.textContent; }
    set icontent(v) { this.ieContent.textContent = v; }

    get iinfos() { return [...this.#iinfos]; }
    set iinfos(v) {
        this.#iinfos = util.ensure(v, "arr").map(v => String(v));
        Array.from(this.iinner.querySelectorAll(":scope > .info")).forEach(elem => elem.remove());
        let sibling = this.ieContent.nextElementSibling;
        this.iinfos.forEach(info => {
            let elem = document.createElement("div");
            this.iinner.insertBefore(elem, sibling);
            elem.classList.add("info");
            elem.innerHTML = String(info).replaceAll("<", "&lt").replaceAll(">", "&gt");
            let btn = document.createElement("button");
            elem.appendChild(btn);
            btn.innerHTML = "<ion-icon name='copy-outline'></ion-icon>";
            btn.addEventListener("click", e => {
                e.stopPropagation();
                navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([info], { type: "text/plain" })})]);
            });
        });
    }
}