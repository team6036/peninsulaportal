const { ipcRenderer, contextBridge } = require("electron");

let AGENT = null;
contextBridge.exposeInMainWorld("agent", () => AGENT);
const buildAgent = async () => {
    AGENT = Object.freeze({
        os: Object.freeze(await ipcRenderer.invoke("os")),
        bootParams: Object.freeze(await ipcRenderer.invoke("boot-params")),

        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,

        app: await ipcRenderer.invoke("get", "version"),
        name: await ipcRenderer.invoke("get", "name"),
        id: await ipcRenderer.invoke("get", "id"),

        public: ((await ipcRenderer.invoke("get", "db-host")) == null),
    });
    handlers.forEach(f => f());
    return AGENT;
};
let handlers = new Set();
contextBridge.exposeInMainWorld("buildAgent", buildAgent);
ipcRenderer.on("build-agent", () => buildAgent());
buildAgent();
contextBridge.exposeInMainWorld("onBuildAgent", f => {
    handlers.add(f);
    return () => handlers.delete(f);
});

contextBridge.exposeInMainWorld("api", {
    onPerm: f => {
        ipcRenderer.on("perm", f);
        return () => ipcRenderer.removeListener("perm", f);
    },
    sendPermAck: () => ipcRenderer.send("permack", perm),
    sendPerm: perm => ipcRenderer.send("perm", perm),
    sendReady: () => ipcRenderer.send("ready"),

    get: (k, ...a) => ipcRenderer.invoke("get", k, ...a),
    set: (k, ...a) => ipcRenderer.invoke("set", k, ...a),
    del: (k, ...a) => ipcRenderer.invoke("del", k, ...a),
    
    on: f => {
        ipcRenderer.on("send", f);
        return () => ipcRenderer.removeListener("send", f);
    },
    send: (k, ...a) => ipcRenderer.invoke("on", k, ...a),

    fileHas: pth => ipcRenderer.invoke("file-has", pth),
    fileRead: pth => ipcRenderer.invoke("file-read", pth),
    fileReadRaw: pth => ipcRenderer.invoke("file-read-raw", pth),
    fileWrite: (pth, content) => ipcRenderer.invoke("file-write", pth, content),
    fileWriteRaw: (pth, content) => ipcRenderer.invoke("file-write-raw", pth, content),
    fileAppend: (pth, content) => ipcRenderer.invoke("file-append", pth, content),
    fileDelete: pth => ipcRenderer.invoke("file-delete", pth),

    dirHas: pth => ipcRenderer.invoke("dir-has", pth),
    dirList: pth => ipcRenderer.invoke("dir-list", pth),
    dirMake: pth => ipcRenderer.invoke("dir-make", pth),
    dirDelete: pth => ipcRenderer.invoke("dir-delete", pth),

    sendMessage: (id, name, ...a) => ipcRenderer.invoke("message", id, name, ...a),
    onMessage: f => {
        ipcRenderer.on("message", f);
        return () => ipcRenderer.removeListener("message", f);
    },

    console: {
        log: (...a) => ipcRenderer.send("log", ...a),
        warn: (...a) => ipcRenderer.send("warn", ...a),
        error: (...a) => ipcRenderer.send("error", ...a),
    },
});

contextBridge.exposeInMainWorld("modal", {
    spawnAlert: params => ipcRenderer.invoke("modal-spawn", "ALERT", params),
    spawnConfirm: params => ipcRenderer.invoke("modal-spawn", "CONFIRM", params),
    spawnPrompt: params => ipcRenderer.invoke("modal-spawn", "PROMPT", params),
    spawnProgress: params => ipcRenderer.invoke("modal-spawn", "PROGRESS", params),
    spawn: (name, params) => ipcRenderer.invoke("modal-spawn", name, params),
});

contextBridge.exposeInMainWorld("tba", {
    clientMake: id => ipcRenderer.invoke("tba-client-make", id),
    clientDestroy: id => ipcRenderer.invoke("tba-client-destroy", id),
    clientHas: id => ipcRenderer.invoke("tba-client-has", id),
    clientInvoke: (id, invoke, ...a) => ipcRenderer.invoke("tba-client-invoke", id, invoke, ...a),
});

const cache = {};

ipcRenderer.on("cache-set", (_, k, v) => (cache[k] = v));
ipcRenderer.on("cache-del", (_, k) => (cache[k] = null));
ipcRenderer.on("cache-clear", _ => (cache = {}));

contextBridge.exposeInMainWorld("cache", {
    get: k => cache[k],
    del: k => (cache[k] = null),
    clear: () => (cache = {}),
});
