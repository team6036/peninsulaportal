import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import sc from "socket.io-client";
import ss from "socket.io-stream";


export class Client extends util.Target {
    #id;
    #tags;

    #location;

    #socket;

    constructor(location) {
        super();

        this.#id = null;
        this.#tags = new Set();

        this.#location = String(location);

        this.#socket = sc.connect(this.location, {
            autoConnect: false,
        });
        const msg = async (data, ack) => {
            data = util.ensure(data, "obj");
            const name = String(data.name);
            const payload = data.payload;
            const meta = {
                location: this.location,
                connected: this.connected,
                socketId: this.socketId,
            };
            let results = [];
            results.push(...(await this.postResult("msg", name, payload, meta)));
            results.push(...(await this.postResult("msg-"+name, payload, meta)));
            ack = util.ensure(ack, "func");
            let r = util.ensure(results[0], "obj");
            r.success = ("success" in r) ? (!!r.success) : true;
            r.ts = util.getTime();
            ack(r);
        };
        this.#socket.on("connect", () => msg({ name: "connect", ts: util.getTime() }));
        this.#socket.on("disconnect", () => msg({ name: "disconnect", ts: util.getTime() }));
        this.#socket.on("msg", (data, ack) => msg(data, ack));
        ss(this.#socket).on("stream", async (ssStream, data, ack) => {
            data = util.ensure(data, "obj");
            const name = String(data.name);
            const fname = String(data.fname);
            const payload = data.payload;
            const meta = {
                location: this.location,
                connected: this.connected,
                socketId: this.socketId,
            };
            let results = [];
            results.push(...(await this.postResult("stream", name, fname, payload, meta, ssStream)));
            results.push(...(await this.postResult("stream-"+name, fname, payload, meta, ssStream)));
            ack = util.ensure(ack, "func");
            let r = util.ensure(results[0], "obj");
            r.success = ("success" in r) ? (!!r.success) : true;
            r.ts = util.getTime();
            ack(r);
        });
    }

    get id() { return this.#id; }
    set id(v) {
        v = (v == null) ? null : String(v);
        if (this.id == v) return;
        this.#id = v;
    }
    get tags() { return [...this.#tags]; }
    set tags(v) {
        v = util.ensure(v, "arr");
        this.clearTags();
        this.addTag(v);
    }
    clearTags() {
        let tags = this.tags;
        this.remTag(tags);
        return tags;
    }
    hasTag(tag) {
        return this.#tags.has(tag);
    }
    addTag(...tags) {
        return util.Target.resultingForEach(tags, tag => {
            this.#tags.add(tag);
            return tag;
        });
    }
    remTag(...tags) {
        return util.Target.resultingForEach(tags, tag => {
            this.#tags.delete(tag);
            return tag;
        });
    }

    get location() { return this.#location; }

    get connected() { return this.#socket.connected; }
    get disconnected() { return !this.connected; }
    get socketId() { return this.#socket.id; }

    connect() { this.#socket.connect(); }
    disconnect() { this.#socket.disconnect(); }

    #parseResponse(res, rej, response) {
        response = util.ensure(response, "obj");
        const serverTs = util.ensure(response.ts, "num");
        const clientTs = util.getTime();
        if (!response.success) return rej(response.reason);
        return res(response.payload);
    }
    async emit(name, payload) {
        name = String(name);
        return await new Promise((res, rej) => {
            this.#socket.emit(
                "msg",
                {
                    name: name,
                    ts: util.getTime(),
                    payload: payload,
                },
                response => this.#parseResponse(res, rej, response),
            );
        });
    }
    async stream(pth, name, payload) {
        pth = WindowManager.makePath(pth);
        if (!WindowManager.fileHas(pth)) return null;
        const stream = fs.createReadStream(pth);
        name = String(name);
        const fname = path.basename(pth);
        const ssStream = ss.createStream();
        return await new Promise((res, rej) => {
            ss(this.#socket).emit(
                "stream",
                ssStream,
                {
                    name: name,
                    fname: fname,
                    payload: payload,
                },
                response => this.#parseResponse(res, rej, response),
            );
            stream.pipe(ssStream);
        });
    }
}

export class ClientManager extends util.Target {
    #clients;

    constructor() {
        super();

        this.#clients = new Set();
    }

    get clients() { return [...this.#clients]; }
    set clients(v) {
        v = util.ensure(v, "arr");
        this.clearClients();
        this.addClient(v);
    }
    clearClients() {
        let clients = this.clients;
        this.remClient(clients);
        return clients;
    }
    hasClient(client) {
        if (!(client instanceof Client)) return false;
        return this.#clients.has(client);
    }
    addClient(...clients) {
        return util.Target.resultingForEach(clients, client => {
            if (!(client instanceof Client)) return false;
            if (this.hasClient(client)) return false;
            this.#clients.add(client);
            client.onAdd();
            return client;
        });
    }
    remClient(...clients) {
        return util.Target.resultingForEach(clients, client => {
            if (!(client instanceof Client)) return false;
            if (!this.hasClient(client)) return false;
            client.onRem();
            this.#clients.delete(client);
            return client;
        });
    }

    getClientById(id) {
        for (let client of this.clients)
            if (client.id == id)
                return client;
        return null;
    }
    getClientsByTag(tag) {
        tag = String(tag);
        return this.clients.filter(client => client.hasTag(tag));
    }
}
