import rollupPluginCommonJS from "@rollup/plugin-commonjs";
import rollupPluginJSON from "@rollup/plugin-json";
import rollupPluginNodeResolve from "@rollup/plugin-node-resolve";
import rollupPluginTypescript from "@rollup/plugin-typescript";
import rollupPluginCleanup from "rollup-plugin-cleanup";
import rollupPluginMinify from "rollup-plugin-minify";

import path from "path";


let doMinify = false;
function build(input, output, isMain, externals=[]) {
    let plugins = [
        rollupPluginCommonJS(),
        rollupPluginJSON(),
        rollupPluginNodeResolve(),
        rollupPluginTypescript(),
        rollupPluginCleanup(),
    ];
    if (doMinify) plugins.push(rollupPluginMinify());
    return {
        input: path.join("src", input),
        output: {
            file: path.join("build", output),
            format: isMain ? "cjs" : "es",
        },
        context: "this",
        external: externals,
        plugins: plugins,
    };
}

export default args => {
    doMinify = args.minify === true;

    const mainBuilds = [
        build(
            path.join("main", "main.ts"),
            path.join("main.js"),
            true, [
                "os", "path", "fs",

                "electron", "electron-fetch",

                "png2icons",
                "compare-versions",
                "ytdl-core",
                "octokit",

                "zlib",

                "tar",
            ],
        ),
        build(path.join("main", "preload.ts"), path.join("preload.js"), true, ["electron"]),
    ];

    const renderFeatureBuilds = ["PORTAL", "PRESETS", "PANEL", "PLANNER", "PIT", "PYTHONTK"]
        .map(name => name.toLowerCase())
        .map(name => build(path.join(name, "app.ts"), path.join(name+".js"), false));
    
    const renderModalBuilds = ["ALERT", "CONFIRM", "PROMPT", "PROGRESS"]
        .map(name => name.toLowerCase())
        .map(name => build(path.join("modal", name, "app.ts"), path.join("modal", name+".js")));
    
    return [...mainBuilds, ...renderFeatureBuilds, ...renderModalBuilds];
};
