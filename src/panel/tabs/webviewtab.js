import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";


import PanelToolTab from "./tooltab.js";


export default class PanelWebViewTab extends PanelToolTab {
    #src;

    #eNav;
    #eBackBtn;
    #eForwardBtn;
    #eLoadBtn;
    #eSrcInput;
    #eWebView;

    static NAME = "WebView";
    static NICKNAME = "WebView";
    static ICON = "globe-outline";
    static ICONSRC = null;
    static ICONCOLOR = "var(--cc)";

    constructor(a) {
        super(a);

        this.elem.classList.add("webview");

        this.#src = "";

        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");
        this.#eBackBtn = document.createElement("button");
        this.eNav.appendChild(this.eBackBtn);
        this.eBackBtn.innerHTML = "<ion-icon name='arrow-back'></ion-icon>";
        this.#eForwardBtn = document.createElement("button");
        this.eNav.appendChild(this.eForwardBtn);
        this.eForwardBtn.innerHTML = "<ion-icon name='arrow-forward'></ion-icon>";
        this.#eLoadBtn = document.createElement("button");
        this.eNav.appendChild(this.eLoadBtn);
        this.eLoadBtn.innerHTML = "<ion-icon></ion-icon>";
        this.#eSrcInput = document.createElement("input");
        this.eNav.appendChild(this.eSrcInput);
        this.eSrcInput.type = "text";
        this.eSrcInput.placeholder = "URL";
        this.#eWebView = document.createElement("webview");
        this.elem.appendChild(this.eWebView);
        this.eWebView.setAttribute("src", "https://www.example.com");

        this.eBackBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!ready) return;
            this.eWebView.goBack();
        });
        this.eForwardBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!ready) return;
            this.eWebView.goForward();
        });
        this.eLoadBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (!ready) return;
            if (this.eWebView.isLoading()) this.eWebView.stop();
            else this.eWebView.reload();
        });
        this.eSrcInput.addEventListener("change", e => (this.src = this.eSrcInput.value));

        let ready = false;
        this.eWebView.addEventListener("dom-ready", () => (ready = true));
        this.addHandler("rem", () => (ready = false));

        let src = null;

        this.addHandler("update", delta => {
            if (!ready || !document.body.contains(this.eWebView)) return;
            if (this.isOpen) {
                if (document.activeElement != this.eSrcInput)
                    this.eSrcInput.value = this.eWebView.getURL();
                if (this.eLoadBtn.children[0])
                    this.eLoadBtn.children[0].name = this.eWebView.isLoading() ? "close" : "refresh";
                this.eBackBtn.disabled = !this.eWebView.canGoBack();
                this.eForwardBtn.disabled = !this.eWebView.canGoForward();
            }
            if (this.eWebView.isLoading()) return;
            if (src == this.src) return;
            src = this.src;
            this.eWebView.loadURL(this.src);
        });

        if (util.is(a, "str")) a = { src: a };

        a = util.ensure(a, "obj");
        this.src = a.src;
    }

    get src() { return this.#src; }
    set src(v) {
        v = util.ensure(v, "str");
        if (this.src == v) return;
        this.change("src", this.src, this.#src=v);
    }

    get eNav() { return this.#eNav; }
    get eBackBtn() { return this.#eBackBtn; }
    get eForwardBtn() { return this.#eForwardBtn; }
    get eLoadBtn() { return this.#eLoadBtn; }
    get eSrcInput() { return this.#eSrcInput; }
    get eWebView() { return this.#eWebView; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            src: this.src,
        });
    }
}
