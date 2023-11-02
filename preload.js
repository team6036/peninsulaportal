const { ipcRenderer, contextBridge } = require("electron");

const cache = {};

ipcRenderer.on("cache-set", (_, k, v) => (cache[k] = v));
ipcRenderer.on("cache-del", (_, k) => (cache[k] = null));
ipcRenderer.on("cache-clear", _ => (cache = {}));

contextBridge.exposeInMainWorld("version", {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,

    os: () => ipcRenderer.invoke("os"),
});

contextBridge.exposeInMainWorld("api", {
    onPerm: f => {
        ipcRenderer.on("perm", f);
        return () => ipcRenderer.removeListener("perm", f);
    },
    sendPerm: perm => ipcRenderer.send("perm", perm),

    get: k => ipcRenderer.invoke("get", k),
    set: (k, v) => ipcRenderer.invoke("set", k, v),
    
    on: f => {
        ipcRenderer.on("send", f);
        return () => ipcRenderer.removeListener("send", f);
    },
    send: (k, args) => ipcRenderer.invoke("on", k, args),

    fileHas: path => ipcRenderer.invoke("file-has", path),
    fileRead: path => ipcRenderer.invoke("file-read", path),
    fileReadRaw: path => ipcRenderer.invoke("file-read-raw", path),
    fileWrite: (path, content) => ipcRenderer.invoke("file-write", path, content),
    fileAppend: (path, content) => ipcRenderer.invoke("file-append", path, content),
    fileDelete: path => ipcRenderer.invoke("file-delete", path),

    dirHas: path => ipcRenderer.invoke("dir-has", path),
    dirList: path => ipcRenderer.invoke("dir-list", path),
    dirMake: path => ipcRenderer.invoke("dir-make", path),
    dirDelete: path => ipcRenderer.invoke("dir-delete", path),

    clientMake: (id, location) => ipcRenderer.invoke("client-make", id, location),
    clientDestroy: id => ipcRenderer.invoke("client-destroy", id),
    clientConn: id => ipcRenderer.invoke("client-conn", id),
    clientDisconn: id => ipcRenderer.invoke("client-disconn", id),
    clientHas: id => ipcRenderer.invoke("client-has", id),
    // clientGet: (id, attr) => ipcRenderer.invoke("client-get", id, attr),
    clientEmit: (id, name, a) => ipcRenderer.invoke("client-emit", id, name, a),
    onClientMsg: f => {
        ipcRenderer.on("client-msg", f);
        return () => ipcRenderer.removeListener("client-msg", f);
    },

    cacheGet: k => cache[k],
    cacheDel: k => (cache[k] = null),
    cacheClear: () => (cache = {}),
});