const { ipcRenderer, contextBridge } = require("electron");

let AGENT = null;
contextBridge.exposeInMainWorld("agent", () => AGENT);
const buildAgent = async () => {
    AGENT = {
        os: await ipcRenderer.invoke("os"),

        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,

        app: await ipcRenderer.invoke("get", "version"),

        public: ((await ipcRenderer.invoke("get", "db-host")) == null),
    };
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

    getAppRoot: () => ipcRenderer.invoke("get-root", "app"),
    getRoot: () => ipcRenderer.invoke("get-root", "window"),
    getRepoRoot: () => ipcRenderer.invoke("get-root", "repo"),

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

contextBridge.exposeInMainWorld("modal", {
    result: r => ipcRenderer.invoke("modal-result", r),
    onResult: f => {
        ipcRenderer.on("modal-result", f);
        return () => ipcRenderer.removeListener("modal-result", f);
    },

    cast: v => ipcRenderer.invoke("modal-cast", v),
    onCast: f => {
        ipcRenderer.on("modal-cast", f);
        return () => ipcRenderer.removeListener("modal-cast", f);
    },

    modify: (id, params) => ipcRenderer.invoke("modal-modify", id, params),
    onModify: f => {
        ipcRenderer.on("modal-modify", f);
        return () => ipcRenderer.removeListener("modal-modify", f);
    },

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
