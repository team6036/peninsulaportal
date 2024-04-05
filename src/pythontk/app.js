import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";


export default class App extends core.App {
    #eTitlePage;
    #eDocsPage;

    #eInstall;
    #eDocumentation;
    #eSide;
    #eArticle;

    constructor() {
        super();

        this.addHandler("pre-setup", () => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("post-setup", async () => {
            (async () => {
                let resp = await fetch("./doc.md");
                let text = await resp.text();
                let signal = new util.Target();
                signal.addHandler("nav", (e, href) => this.addPopup(new App.MarkdownPopup(href)));
                const eArticle = await this.createMarkdown(text, signal);
                const articleMap = {};
                let active = null;
                Array.from(eArticle.children).forEach(elem => {
                    elem.remove();
                    if (
                        elem instanceof HTMLHeadingElement &&
                        elem.tagName == "H1" &&
                        elem.hasAttribute("id")
                    ) {
                        let id = String(elem.id).split(".");
                        if (id.length > 3) id[2] += "."+id.splice(3).join(".");
                        let i = 0, o = articleMap;
                        while (id.length > 0) {
                            let k = id.shift();
                            if (i < 2) {
                                if (!(k in o)) {
                                    o[k] = {};
                                    active = null;
                                }
                            } else {
                                if (!(k in o)) {
                                    o[k] = [];
                                    active = o[k];
                                }
                            }
                            i++;
                            o = o[k];
                        }
                        return;
                    }
                    if (!util.is(active, "arr")) return;
                    active.push(elem);
                });
                // if (this.hasEDocsPage()) this.eDocsPage.appendChild(eArticle);
            })();

            this.#eTitlePage = document.getElementById("TITLEPAGE");
            this.#eDocsPage = document.getElementById("DOCSPAGE");

            this.#eInstall = document.getElementById("install");
            if (this.hasEInstall())
                this.eInstall.addEventListener("click", async e => {
                    e.stopPropagation();
                    const result = util.ensure(await App.fileOpenDialog({
                        title: "Install PTK in...",
                        buttonLabel: "Install",
                        properties: [
                            "openDirectory",
                        ],
                    }), "obj");
                    if (result.canceled) return;
                    const pths = util.ensure(result.filePaths, "arr").map(pth => String(pth));
                    if (pths.length != 1) return;
                    const pth = pths[0];
                    try {
                        await window.api.send("install", pth);
                    } catch (e) { this.doError("Installation Error", "", e); }
                });
            this.#eDocumentation = document.getElementById("documentation");
            if (this.hasEDocumentation())
                this.eDocumentation.addEventListener("click", async e => {
                    e.stopPropagation();
                    if (this.hasETitlePage()) this.eTitlePage.classList.remove("this");
                    if (this.hasEDocsPage()) this.eDocsPage.classList.add("this");
                });
            this.#eArticle = document.getElementById("article");
        });
    }

    get eTitlePage() { return this.#eTitlePage; }
    hasETitlePage() { return this.eTitlePage instanceof HTMLDivElement; }
    get eDocsPage() { return this.#eDocsPage; }
    hasEDocsPage() { return this.eDocsPage instanceof HTMLDivElement; }
    get eInstall() { return this.#eInstall; }
    hasEInstall() { return this.eInstall instanceof HTMLButtonElement; }
    get eDocumentation() { return this.#eDocumentation; }
    hasEDocumentation() { return this.eDocumentation instanceof HTMLButtonElement; }
    get eSide() { return this.#eSide; }
    hasESide() { return this.eSide instanceof HTMLElement; }
    get eArticle() { return this.#eArticle; }
    hasEArticle() { return this.eArticle instanceof HTMLElement; }
}
