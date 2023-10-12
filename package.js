const path = require("path");
const fs = require("fs");

const cp = require("child_process");

const appName = "Peninsula";
const outDir = "./build";
const icons = {
    win32: "./assets/app/icon.ico",
    darwin: "./assets/app/icon.icns",
    linux: null,
};
const ignores = [
    "^build*",
    "^temp*",
    "^.gitignore",
    "^package.js$",
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
        ignores.forEach(ignore => command.push(`--ignore='${ignore}'`));
        let icon = icons[platform];
        if (icon != null) command.push(`--icon='${icon}'`);
        commands.push(command.join(" "));
    });
}
let n = 0;
async function cleanup() {
    n++;
    if (n < commands.length) return;
    console.log("cleanup");
    const root = path.join(__dirname, outDir);
    let dirents = await fs.promises.readdir(root, { withFileTypes: true });
    await Promise.all(dirents.map(async dirent => {
        if (!dirent.isDirectory()) return;
        const subroot = path.join(root, dirent.name);
        console.log(dirent.name+" - cleaning");
        let subdirents = await fs.promises.readdir(subroot, { withFileTypes: true });
        await Promise.all(subdirents.map(async subdirent => {
            if (subdirent.name.startsWith(appName)) return;
            console.log(dirent.name+" { "+subdirent.name+" } - deleting");
            try {
                await fs.promises.unlink(path.join(subroot, subdirent.name));
            } catch (e) {
                console.log(dirent.name+" { "+subdirent.name+" } - deletion error: "+e);
                return;
            }
            console.log(dirent.name+" { "+subdirent.name+" } - deleted");
        }));
    }));
}
commands.forEach(command => {
    const subprocess = cp.exec(command);
    subprocess.stdout.on("data", data => process.stdout.write(data));
    subprocess.stderr.on("data", data => process.stderr.write(data));
    subprocess.on("close", code => {
        console.log("closed with "+code);
        cleanup();
    });
});
