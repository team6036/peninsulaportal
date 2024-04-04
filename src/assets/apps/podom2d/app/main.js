const path = require("path");
const fs = require("fs");

const cp = require("child_process");

const electron = require("electron");


(async () => {

    const TEXTDECODER = new TextDecoder();

    const ID = String(process.argv.at(-1));

    const app = electron.app;
    const ipc = electron.ipcMain;

    await app.whenReady();

    let ready = false;
    const queue = [];
    const queueData = data => {
        queue.push(data);
        dequeueData();
    };
    const dequeueData = () => {
        if (!ready) return;
        while (queue.length > 0) window.webContents.send("data", queue.shift());
    };
    ipc.on("ready", () => {
        ready = true;
        dequeueData();
    });
    const window = new electron.BrowserWindow({
        width: 1250,
        height: 750,

        closable: false,

        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    });
    window.loadFile(path.join(__dirname, "index.html"));

    cp.spawn("npm", ["install"]);

    const pipePath = path.join(process.cwd(), "podom2d_"+ID);
    const pipe = cp.spawn("mkfifo", [pipePath]);

    pipe.on("exit", () => {
        const file = fs.openSync(pipePath, "r+");
        const stream = fs.createReadStream(null, { fd: file });
        stream.on("data", data => {
            data = TEXTDECODER.decode(data).split("§§§");
            data.forEach(data => {
                if (!data) return;
                queueData(JSON.parse(data));
            });
        });
    });

})();
