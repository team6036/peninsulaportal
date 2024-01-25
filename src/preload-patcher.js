const PATCH = () => {
    const AGENT = {
        os: "web",

        app: "web",
    };
    Object.defineProperty(window, "agent", { value: AGENT, writable: false });
    window.buildAgent = async () => AGENT;
    window.onBuildAgent = f => (() => {});
    window.api = {
        // stub
    };
};
if (!window.api) PATCH();