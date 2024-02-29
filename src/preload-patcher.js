import * as util from "./util.mjs";
import * as lib from "./lib.mjs";


class VirtualFS extends util.Target {
    constructor() {
        super();
    }
}


const PATCH = () => {
    const operator = new lib.FSOperator();
    const AGENT = {
        os: "web",

        app: "web",
    };
    window.agent = () => AGENT;
    window.buildAgent = async () => AGENT;
    window.onBuildAgent = f => (() => {});
    window.api = {
    };
};
if (!window.api) PATCH();