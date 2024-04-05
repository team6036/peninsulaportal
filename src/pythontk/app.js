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
                if (!this.hasESide()) return;
                if (!this.hasEArticle()) return;
                const dfsArticle = elem => {
                    if (
                        elem.tagName == "KBD" &&
                        ["get", "set"].includes(elem.textContent)
                    ) {
                        elem.style.backgroundColor = "var(--a)";
                        elem.style.filter = "none";
                        return;
                    }
                    Array.from(elem.children).map(dfsArticle);
                };
                dfsArticle(eArticle);
                const articleMap = {};
                let active = null;
                Array.from(eArticle.children).forEach(elem => {
                    elem.remove();
                    if (
                        elem instanceof HTMLHeadingElement &&
                        elem.tagName == "H1" &&
                        elem.hasAttribute("id")
                    ) {
                        let id = String(elem.id);
                        let parts = id.split(".");
                        if (parts.length > 3) parts[2] += "."+parts.splice(3).join(".");
                        let i = 0, o = articleMap;
                        while (parts.length > 0) {
                            let k = parts.shift();
                            if (!(k in o)) {
                                o[k] = {
                                    id: id,
                                    name: elem.textContent,
                                    children: {},
                                    article: [elem],
                                };
                            }
                            i++;
                            o = o[k];
                            active = o.article;
                            o = o.children;
                        }
                        return;
                    }
                    if (!util.is(active, "arr")) return;
                    active.push(elem);
                });
                let first = null;
                const dfsMap = (children, elem, from) => {
                    children = util.ensure(children, "obj");
                    let n = 0;
                    for (let id in children) {
                        let child = children[id];
                        n++;

                        let elem2 = document.createElement("div");
                        elem.appendChild(elem2);
                        elem2.classList.add("item");

                        let btn = document.createElement("button");
                        elem2.appendChild(btn);
                        btn.textContent = child.name;

                        let content = document.createElement("div");
                        elem2.appendChild(content);
                        content.classList.add("content");

                        btn.addEventListener("click", e => {
                            e.stopPropagation();
                            if (from && from.parentElement && !from.parentElement.classList.contains("this")) from.click();
                            if (m <= 0) {
                                this.eArticle.innerHTML = "";
                                util.ensure(child.article, "arr").forEach(elem => this.eArticle.appendChild(elem));
                                return;
                            }
                            if (elem2.classList.contains("this"))
                                elem2.classList.remove("this");
                            else elem2.classList.add("this");
                        });

                        let m = dfsMap(child.children, content, btn);
                        if (!first && m <= 0) first = btn;
                    }
                    return n;
                };
                dfsMap(articleMap, this.eSide, null);
                if (first) first.click();
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
            this.#eSide = document.getElementById("side");
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
