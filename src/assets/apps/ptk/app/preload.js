const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("api", {
    sendReady: () => ipcRenderer.send("ready"),
    onData: f => {
        ipcRenderer.on("data", f);
        return () => ipcRenderer.removeListener("data", f);
    },
});
