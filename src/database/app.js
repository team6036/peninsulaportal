import * as util from "../util.mjs";
import { V } from "../util.mjs";

import * as core from "../core.mjs";


export default class App extends core.App {
    constructor() {
        super();

        this.addHandler("pre-setup", () => {
            this.eLoadingTo = document.querySelector("#titlebar > .logo > .title");
        });
        this.addHandler("post-setup", async () => {
            const sideButtons = Array.from(document.body.querySelectorAll("#PAGE > .side button"));
            sideButtons.forEach(btn => {
                let idfs = {
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
                else btn.addEventListener("click", e => {
                    sideButtons.forEach(btn => btn.classList.remove("this"));
                    btn.classList.add("this");
                    Array.from(document.body.querySelectorAll("#PAGE > .content > div")).forEach(elem => elem.classList.remove("this"));
                    let elem = document.body.querySelector("#PAGE > .content > div#"+btn.id);
                    if (!elem) return;
                    elem.classList.add("this");
                });
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
            let form = new core.Form();
            let arr = form.addField(
                new core.Form.Input2d("field-size"),
                new core.Form.Input1d("robot-size"),
                new core.Form.Input1d("robot-mass"),
            );
            document.body.querySelector("#templates > #templates-list > .item > .content > .content").appendChild(form.elem);
        });
    }
}
