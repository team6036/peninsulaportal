const path = require("path");

const cp = require("child_process");

const appName = "Peninsula";
const outDir = "./build";
const icons = {
    win32: "./assets/icon.ico",
    darwin: "./assets/icon.icns",
    linux: null,
};
const ignores = [
    "./build",
    "./temp",
    "./.gitignore",
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
        ];
        let icon = icons[platform];
        if (icon != null) command.push(`--icon='${icon}'`);
        ignores.forEach(ignore => command.push(`--ignore='${ignore}'`));
        commands.push(command.join(" "));
    });
}
commands.forEach(command => {
    const subprocess = cp.exec(command);
    subprocess.stdout.on("data", data => process.stdout.write(data));
    subprocess.stderr.on("data", data => process.stderr.write(data));
});
