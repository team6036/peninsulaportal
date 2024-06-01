import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import tba from "tba-api-v3client";


export class TBAClient extends util.Target {
    #id;
    #tags;

    #client;
    #tbaAPI;
    #listAPI;
    #teamAPI;
    #eventAPI;
    #matchAPI;
    #districtAPI;

    constructor() {
        super();

        this.#id = null;
        this.#tags = new Set();

        this.#client = tba.ApiClient.instance;
        this.#tbaAPI = new tba.TBAApi();
        this.#listAPI = new tba.ListApi();
        this.#teamAPI = new tba.TeamApi();
        this.#eventAPI = new tba.EventApi();
        this.#matchAPI = new tba.MatchApi();
        this.#districtAPI = new tba.DistrictApi();
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

    get client() { return this.#client; }
    get tbaAPI() { return this.#tbaAPI; }
    get listAPI() { return this.#listAPI; }
    get teamAPI() { return this.#teamAPI; }
    get eventAPI() { return this.#eventAPI; }
    get matchAPI() { return this.#matchAPI; }
    get districtAPI() { return this.#districtAPI; }

    async invoke(invoke, ...a) {
        let ref = String(invoke).split(".");
        if (ref.length != 2) throw new Error(`Invalid invocation (split length) (${invoke})`);
        let [api, f] = ref;
        if (!api.endsWith("API")) throw new Error(`Invalid invocation (api name) (${invoke})`);
        if (!(api in this)) throw new Error(`Invalid invocation (api existence) (${invoke})`);
        api = this[api];
        if (!(f in api)) throw new Error(`Invalid invocation (method existence) (${invoke})`);
        let l = 1;
        let apifs = {
            tbaAPI: {
                getStatus: 0,
            },
            listAPI: {
                getTeamEventsStatusesByYear: 2,
                getTeamsByYear: 2,
                getTeamsByYearKeys: 2,
                getTeamsByYearSimple: 2,
            },
            teamAPI: {
                getTeamAwardsByYear: 2,
                getTeamEventAwards: 2,
                getTeamEventMatches: 2,
                getTeamEventMatchesKeys: 2,
                getTeamEventMatchesSimple: 2,
                getTeamEventStatus: 2,
                getTeamEventsByYear: 2,
                getTeamEventsByYearKeys: 2,
                getTeamEventsByYearSimple: 2,
                getTeamEventsStatusesByYear: 2,
                getTeamMatchesByYear: 2,
                getTeamMatchesByYearKeys: 2,
                getTeamMatchesByYearSimple: 2,
                getTeamMediaByTag: 2,
                getTeamMediaByTagYear: 3,
                getTeamMediaByYear: 2,
                getTeamsByYear: 2,
                getTeamsByYearKeys: 2,
                getTeamsByYearSimple: 2,
            },
            eventAPI: {
                getTeamEventAwards: 2,
                getTeamEventMatches: 2,
                getTeamEventMatchesKeys: 2,
                getTeamEventMatchesSimple: 2,
                getTeamEventStatus: 2,
                getTeamEventsByYear: 2,
                getTeamEventsByYearKeys: 2,
                getTeamEventsByYearSimple: 2,
                getTeamEventsStatusesByYear: 2,
            },
            matchAPI: {
                getTeamEventMatches: 2,
                getTeamEventMatchesKeys: 2,
                getTeamEventMatchesSimple: 2,
                getTeamMatchesByYear: 2,
                getTeamMatchesByYearKeys: 2,
                getTeamMatchesByYearSimple: 2,
            },
        };
        if ((api in apifs) && (f in apifs[api])) l = apifs[api][f];
        while (a.length > l+1) a.pop();
        while (a.length < l) a.push(null);
        if (a.length == l) a.push({});
        a[l] = util.ensure(a[l], "obj");
        return await new Promise((res, rej) => {
            api[f](...a, (e, data, resp) => {
                if (e) return rej(e);
                res(data);
            });
        });
    }
}

export class TBAClientManager extends util.Target {
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
        if (!(client instanceof TBAClient)) return false;
        return this.#clients.has(client);
    }
    addClient(...clients) {
        return util.Target.resultingForEach(clients, client => {
            if (!(client instanceof TBAClient)) return false;
            if (this.hasClient(client)) return false;
            this.#clients.add(client);
            client.onAdd();
            return client;
        });
    }
    remClient(...clients) {
        return util.Target.resultingForEach(clients, client => {
            if (!(client instanceof TBAClient)) return false;
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
