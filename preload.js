const { ipcRenderer, contextBridge } = require("electron");

const cache = {};

ipcRenderer.on("cache-set", (_, k, v) => (cache[k] = v));
ipcRenderer.on("cache-del", (_, k) => (cache[k] = null));
ipcRenderer.on("cache-clear", _ => (cache = {}));

contextBridge.exposeInMainWorld("cache", {
    get: k => cache[k],
    del: k => (cache[k] = null),
    clear: () => (cache = {}),
});

contextBridge.exposeInMainWorld("version", {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,

    os: () => ipcRenderer.invoke("os"),
});

contextBridge.exposeInMainWorld("sio", {
    clientMake: (id, location) => ipcRenderer.invoke("client-make", id, location),
    clientDestroy: id => ipcRenderer.invoke("client-destroy", id),
    clientConn: id => ipcRenderer.invoke("client-conn", id),
    clientDisconn: id => ipcRenderer.invoke("client-disconn", id),
    clientHas: id => ipcRenderer.invoke("client-has", id),
    clientEmit: (id, name, payload) => ipcRenderer.invoke("client-emit", id, name, payload),
    clientStream: (id, pth, name, payload) => ipcRenderer.invoke("client-stream", id, pth, name, payload),
    onClientMsg: f => {
        ipcRenderer.on("client-msg", f);
        return () => ipcRenderer.removeListener("client-msg", f);
    },
    onClientStreamStart: f => {
        ipcRenderer.on("client-stream-start", f);
        return () => ipcRenderer.removeListener("client-stream-start", f);
    },
    onClientStreamStop: f => {
        ipcRenderer.on("client-stream-stop", f);
        return () => ipcRenderer.removeListener("client-stream-stop", f);
    },
});

contextBridge.exposeInMainWorld("api", {
    onPerm: f => {
        ipcRenderer.on("perm", f);
        return () => ipcRenderer.removeListener("perm", f);
    },
    sendPermAck: () => ipcRenderer.send("permack", perm),
    sendPerm: perm => ipcRenderer.send("perm", perm),
    sendReady: () => ipcRenderer.send("ready"),

    getAppRoot: () => ipcRenderer.invoke("get-root", "app"),
    getRoot: () => ipcRenderer.invoke("get-root", "feature"),

    get: k => ipcRenderer.invoke("get", k),
    set: (k, v) => ipcRenderer.invoke("set", k, v),
    
    on: f => {
        ipcRenderer.on("send", f);
        return () => ipcRenderer.removeListener("send", f);
    },
    send: (k, ...a) => ipcRenderer.invoke("on", k, ...a),

    fileHas: path => ipcRenderer.invoke("file-has", path),
    fileRead: path => ipcRenderer.invoke("file-read", path),
    fileReadRaw: path => ipcRenderer.invoke("file-read-raw", path),
    fileWrite: (path, content) => ipcRenderer.invoke("file-write", path, content),
    fileWriteRaw: (path, content) => ipcRenderer.invoke("file-write-raw", path, content),
    fileAppend: (path, content) => ipcRenderer.invoke("file-append", path, content),
    fileDelete: path => ipcRenderer.invoke("file-delete", path),

    dirHas: path => ipcRenderer.invoke("dir-has", path),
    dirList: path => ipcRenderer.invoke("dir-list", path),
    dirMake: path => ipcRenderer.invoke("dir-make", path),
    dirDelete: path => ipcRenderer.invoke("dir-delete", path),
});