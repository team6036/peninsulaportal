import * as util from "./util";

import { CpuInfo, UserInfo } from "os";


export type UserAgent = {
    os: {
        arch: string,
        platform: NodeJS.Platform,
        cpus: CpuInfo[],
        user: UserInfo<string>,
    } | "web",
    bootParams: util.StringMap<any>,

    node: string,
    chrome: string,
    electron: string,

    app: string,
    name: string,
    id: string,

    public: boolean,
} 

declare global {
    interface Window {
        agent: () => UserAgent,
        buildAgent: () => Promise<UserAgent>,
        onBuildAgent: (callback: () => void) => (() => void),

        api: PreloadAPI,
        modal: PreloadModal,
        tba: PreloadTBA,
        cache: PreloadCache,
    }
}

export type PreloadAPI = {
    onPerm: (callback: () => void) => (() => void),
    sendPermAck: () => void,
    sendPerm: (granted: boolean) => void,
    sendReady: () => void,

    get: (key: string, ...args: any[]) => Promise<any>,
    set: (key: string, ...args: any[]) => Promise<any>,
    del: (key: string, ...args: any[]) => Promise<any>,

    on: (callback: (_: any, command: string, ...args: any[]) => void) => (() => void),
    send: (command: string, ...args: any[]) => Promise<any>,

    fileHas: (pth: string) => Promise<void>,
    fileRead: (pth: string) => Promise<void>,
    fileReadRaw: (pth: string) => Promise<void>,
    fileWrite: (pth: string, content: string) => Promise<void>,
    fileWriteRaw: (pth: string, content: Uint8Array) => Promise<void>,
    fileAppend: (pth: string, content: string) => Promise<void>,
    fileDelete: (pth: string) => Promise<void>,

    dirHas: (pth: string) => Promise<void>,
    dirList: (pth: string) => Promise<void>,
    dirMake: (pth: string) => Promise<void>,
    dirDelete: (pth: string) => Promise<void>,

    sendMessage: (id: string, name: string, ...args: any) => Promise<void>,
    onMessage: (callback: (...args: any[]) => void) => (() => void),

    console: {
        log: (...args: any[]) => void,
        warn: (...args: any[]) => void,
        error: (...args: any[]) => void,
    },
}

export type PreloadModal = {
    spawnAlert: (cnf: object) => Promise<string>,
    spawnConfirm: (cnf: object) => Promise<string>,
    spawnPrompt: (cnf: object) => Promise<string>,
    spawnProgress: (cnf: object) => Promise<string>,
    spawn: (name: string, params: object) => Promise<string>,
}

export type PreloadTBA =  {
    clientMake: (id: string) => Promise<void>,
    clientDestroy: (id: string) => Promise<void>,
    clientHas: (id: string) => Promise<boolean>,
    clientInvoke: (id: string, invoke: string, ...args: any[]) => Promise<void>,
}

export type PreloadCache =  {
    get: (key: string) => any,
    del: (key: string) => void,
    clear: () => void,
}
