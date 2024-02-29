const PATCH = () => {
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