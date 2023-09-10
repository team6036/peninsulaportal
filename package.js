const path = require("path");

const cp = require("child_process");

const appName = "Peninsula";
const outDir = "./build";
const icons = {
    win32: "./assets/app/icon.ico",
    darwin: "./assets/app/icon.icns",
    linux: null,
};
const ignores = [
    "build*",
    "temp*",
    "\\.gitignore",
    "\\.devconfig",
    "package\\.js",
];

const builds = {
    win32: [ "arm64", "x64" ],
    darwin: [ "arm64", "x64" ],
    linux: [ "arm64", "x64" ],
};

let commands = [];
for (let platform in builds) {
    let arches = builds[platform];
    arches.forEach(arch => {
        let command = [
            "electron-packager", ".", appName,
            `--platform='${platform}'`,
            `--arch='${arch}'`,
            `--out='${outDir}'`,
            "--overwrite",
            `--ignore='(${ignores.join("|")})'`,
        ];
        let icon = icons[platform];
        if (icon != null) command.push(`--icon='${icon}'`);
        commands.push(command.join(" "));
    });
}
commands.forEach(command => {
    const subprocess = cp.exec(command);
    subprocess.stdout.on("data", data => process.stdout.write(data));
    subprocess.stderr.on("data", data => process.stderr.write(data));
});
