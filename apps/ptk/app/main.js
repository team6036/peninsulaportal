(async () => {
    const path = require("path");
    const fs = require("fs");

    const cp = require("child_process");

    const TEXTDECODER = new TextDecoder();

    // key and id for pipe setup
    const findArg = k => process.argv.find(arg => {
        arg = arg.split("=");
        if (arg.length != 2) return false;
        if (arg[0] != k) return false;
        return true;
    }).split("=")[1];

    const KEY = findArg("key");
    const ID = findArg("id");

    const electron = require("electron");
    
    const app = electron.app;
    const ipc = electron.ipcMain;

    await app.whenReady();

    // queue data until when window is ready, then dequeue
    let ready = false, t0 = new Date().getTime()+1500;
    const queue = [];
    const queueData = data => {
        t0 = Math.max(t0, new Date().getTime());
        if (data != "poll") queue.push(data);
        dequeueData();
    };
    const dequeueData = () => {
        if (!ready) return;
        if (window.isDestroyed()) return;
        if (window.webContents.isDestroyed()) return;
        while (queue.length > 0) window.webContents.send("data", queue.shift());
    };
    ipc.on("ready", () => {
        ready = true;
        dequeueData();
    });
    const window = new electron.BrowserWindow({
        width: 1250,
        height: 750,

        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    });
    // load key and id into url parameters
    window.loadURL("file://"+path.join(__dirname, "index.html")+"?key="+KEY+"&id="+ID);

    // setup pipe
    const pipePath = path.join(process.cwd(), `._${KEY}_${ID}`);
    const child = cp.spawn("mkfifo", [pipePath]);

    // process completion
    child.on("exit", () => {
        const file = fs.openSync(pipePath, "r+");
        const stream = fs.createReadStream(null, { fd: file });
        // carry-over data in case we somehow get PART of a message
        let predata = "";
        stream.on("data", data => {
            data = predata+TEXTDECODER.decode(data);
            // split by goofy delimiter
            if (data.endsWith("§§§")) data = data.slice(0, -3);
            data = data.split("§§§");
            predata = "";
            let l = data.length;
            data.forEach((data, i) => {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    // assume json parse error means partial message, queue to next data
                    return predata += data + (i+1<l ? "§§§" : "");
                }
                queueData(data);
            });
        });
    });

    // disconnection detection
    const id = setInterval(() => {
        let t1 = new Date().getTime();
        if (t1-t0 < 1000) return;
        clearInterval(id);
        if (window.isDestroyed()) return;
        window.close();
    }, 500);

    // quit
    app.on("window-all-closed", () => {
        app.quit();
    });

})();
