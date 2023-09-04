const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("version", {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,

    os: () => ipcRenderer.invoke("os"),
});

contextBridge.exposeInMainWorld("api", {
    onPerm: f => ipcRenderer.on("perm", f),
    sendPerm: perm => ipcRenderer.send("perm", perm),

    on: f => ipcRenderer.on("ask", f),

    getFeature: () => ipcRenderer.invoke("get-feature"),
    getFullScreen: () => ipcRenderer.invoke("get-fullscreen"),
    getDevMode: () => ipcRenderer.invoke("get-devmode"),
    getLoads: () => ipcRenderer.invoke("get-loads"),

    fileHas: path => ipcRenderer.invoke("file-has", path),
    fileRead: path => ipcRenderer.invoke("file-read", path),
    fileWrite: (path, content) => ipcRenderer.invoke("file-write", path, content),
    fileAppend: (path, content) => ipcRenderer.invoke("file-append", path, content),
    fileDelete: path => ipcRenderer.invoke("file-delete", path),

    dirHas: path => ipcRenderer.invoke("dir-has", path),
    dirList: path => ipcRenderer.invoke("dir-list", path),
    dirMake: path => ipcRenderer.invoke("dir-make", path),
    dirDelete: path => ipcRenderer.invoke("dir-delete", path),

    menuChange: changes => ipcRenderer.invoke("menu-change", changes),

    ask: (cmd, args) => ipcRenderer.invoke("ask", cmd, args),
});