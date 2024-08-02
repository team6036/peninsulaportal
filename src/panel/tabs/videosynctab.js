import * as util from "../../util.mjs";
import { V } from "../../util.mjs";
import * as lib from "../../lib.mjs";

import * as core from "../../core.mjs";
import { PROPERTYCACHE, GLOBALSTATE } from "../../core.mjs";

import * as app from "../../app.mjs";


import PanelToolTab from "./tooltab.js";


export default class PanelVideoSyncTab extends PanelToolTab {
    #video;

    #duration;

    #eVideoBox;
    #eVideo;
    #eNav;
    #eSource;
    #eSourceTitle;
    #eTime;
    #eTimeTitle;
    #eTimeBox;
    #eTimeSourceBox;
    #eTimeVideoBox;
    #eTimeNav;
    #eTimeNavBack;
    #eTimeNavAction;
    #eTimeNavForward;
    #eTimeNavZeroLeft;
    #eTimeNavZeroRight;
    #eTimeNavEdit;
    #eTimeNavLock;

    static NAME = "VideoSync";
    static NICKNAME = "VidSync";
    static ICON = "play-outline";
    static ICONSRC = null;
    static ICONCOLOR = "var(--cc)";

    constructor(a) {
        super(a);

        this.elem.classList.add("videosync");

        this.#video = null;

        this.#duration = 0;

        this.#eVideoBox = document.createElement("div");
        this.elem.appendChild(this.eVideoBox);
        this.eVideoBox.classList.add("video");
        this.#eVideo = document.createElement("video");
        this.eVideoBox.appendChild(this.eVideo);
        this.eVideo.muted = true;
        this.eVideo.loop = false;

        this.#eNav = document.createElement("div");
        this.elem.appendChild(this.eNav);
        this.eNav.classList.add("nav");

        this.#eSource = document.createElement("div");
        this.eNav.appendChild(this.eSource);
        this.eSource.classList.add("source");
        this.#eSourceTitle = document.createElement("div");
        this.eSource.appendChild(this.eSourceTitle);
        this.eSourceTitle.classList.add("title");
        this.eSourceTitle.innerHTML = "<div>Videos</div>";

        ["yt", "file"].forEach(name => {
            let elem = document.createElement("button");
            this.eSourceTitle.appendChild(elem);
            elem.style.setProperty("--color", {
                yt: "var(--cr)",
                file: "var(--a)",
            }[name]);
            elem.innerHTML = "<ion-icon></ion-icon>";
            elem.children[0].name = {
                yt: "logo-youtube",
                file: "document",
            }[name];
            elem.addEventListener("click", async e => {
                e.stopPropagation();
                let namefs = {
                    yt: async () => {
                        elem.disabled = true;
                        let pop = this.app.prompt("Youtube Video URL", "");
                        pop.doCast = v => {
                            v = String(v);
                            if (v.length <= 0) return v;
                            if (v.startsWith("https://www.youtube.com/watch?v=")) v = v.slice("https://".length);
                            if (v.startsWith("www.youtube.com/watch?v=")) v = v.slice("www.".length);
                            if (!v.startsWith("youtube.com/watch?v=")) {
                                if (v.length != 11) return v;
                                v = "youtube.com/watch?v="+v;
                            }
                            return v;
                        };
                        pop.type = null;
                        pop.icon = "logo-youtube";
                        pop.iconColor = "var(--cr)";
                        let result = await pop.whenResult();
                        if (result == null) return elem.disabled = false;
                        result = "https://"+result;
                        try {
                            await window.api.send("video-add-url", result);
                        } catch (e) { this.app.doError("Youtube Add Error", result, e); }
                        elem.disabled = false;
                    },
                    file: async () => {
                        elem.disabled = true;
                        let file = await core.fileOpenDialog({
                            title: "Choose a video",
                            filters: [{
                                name: "Video",
                                extensions: ["mp4", "mov"],
                            }],
                            properties: [
                                "openFile",
                            ],
                        });
                        file = util.ensure(file, "obj");
                        if (file.canceled) return elem.disabled = false;
                        file = util.ensure(file.filePaths, "arr")[0];
                        let name = await this.app.doPrompt("Name", "Will take file name if not defined");
                        try {
                            await window.api.send("video-add-file", file, name);
                        } catch (e) { this.app.doError("File Add Error", file+" -> "+name, e); }
                        elem.disabled = false;
                    },
                };
                if (name in namefs)
                    await namefs[name]();
            });
        });

        this.#eTime = document.createElement("div");
        this.eNav.appendChild(this.eTime);
        this.eTime.classList.add("time");
        this.#eTimeTitle = document.createElement("div");
        this.eTimeTitle.classList.add("title");
        this.eTimeTitle.textContent = "<div>Sync</div>";
        this.#eTimeBox = document.createElement("div");
        this.eTime.appendChild(this.eTimeBox);
        this.eTimeBox.classList.add("box");
        this.#eTimeSourceBox = document.createElement("div");
        this.eTimeBox.appendChild(this.eTimeSourceBox);
        this.eTimeSourceBox.classList.add("source");
        this.#eTimeVideoBox = document.createElement("div");
        this.eTimeBox.appendChild(this.eTimeVideoBox);
        this.eTimeVideoBox.classList.add("video");
        this.eTimeVideoBox.addEventListener("mousedown", e => {
            if (e.button != 0) return;
            e.preventDefault();
            e.stopPropagation();
            let r = this.eTimeVideoBox.getBoundingClientRect();
            let offset = r.left-e.pageX;
            const mouseup = () => {
                document.body.removeEventListener("mouseup", mouseup);
                document.body.removeEventListener("mousemove", mousemove);
            };
            const mousemove = e => {
                let x = e.pageX+offset;
                let r = this.eTimeBox.getBoundingClientRect();
                let p = Math.min(1, Math.max(0, (x-r.left)/r.width));
                if (!this.page.hasSource()) return;
                const len = this.duration * 1000;
                const playback = this.page.source.playback;
                const slen = playback.tsMax-playback.tsMin;
                const blen = slen+2*len;
                let t = blen*p - len;
                this.offset = -t;
            };
            document.body.addEventListener("mouseup", mouseup);
            document.body.addEventListener("mousemove", mousemove);
            mousemove(e);
        });
        this.#eTimeNav = document.createElement("div");
        this.eTime.appendChild(this.eTimeNav);
        this.eTimeNav.classList.add("nav");

        this.#eTimeNavEdit = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavEdit);
        this.eTimeNavEdit.innerHTML = "<ion-icon name='pencil'></ion-icon>";
        this.eTimeNavEdit.addEventListener("click", async e => {
            e.stopPropagation();
            let pop = this.app.prompt("Time Offset", "Shift video this many seconds", String(-this.offset/1000), "time");
            pop.type = "num";
            let result = await pop.whenResult();
            if (result == null) return;
            result = util.ensure(parseFloat(result), "num");
            this.offset = -result*1000;
        });

        this.#eTimeNavZeroLeft = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavZeroLeft);
        this.eTimeNavZeroLeft.innerHTML = "<ion-icon name='arrow-back'></ion-icon>";
        this.eTimeNavZeroLeft.addEventListener("click", e => {
            e.stopPropagation();
            this.offset = 0;
        });

        this.#eTimeNavBack = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavBack);
        this.eTimeNavBack.innerHTML = "<ion-icon name='play-skip-back'></ion-icon>";
        this.eTimeNavBack.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.page.hasSource()) return;
            const playback = this.page.source.playback;
            playback.ts = playback.tsMin - this.offset;
        });

        this.#eTimeNavAction = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavAction);
        this.eTimeNavAction.innerHTML = "<ion-icon></ion-icon>";
        this.eTimeNavAction.addEventListener("click", e => {
            e.stopPropagation();
            this.page.eNavActionButton.click();
        });
        const actionIcon = this.eTimeNavAction.children[0];

        this.#eTimeNavForward = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavForward);
        this.eTimeNavForward.innerHTML = "<ion-icon name='play-skip-forward'></ion-icon>";
        this.eTimeNavForward.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.page.hasSource()) return;
            const playback = this.page.source.playback;
            playback.ts = this.duration*1000 + playback.tsMin - this.offset;
        });

        this.#eTimeNavZeroRight = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavZeroRight);
        this.eTimeNavZeroRight.innerHTML = "<ion-icon name='arrow-forward'></ion-icon>";
        this.eTimeNavZeroRight.addEventListener("click", e => {
            e.stopPropagation();
            if (!this.page.hasSource()) return;
            const len = this.duration * 1000;
            const playback = this.page.source.playback;
            const slen = playback.tsMax-playback.tsMin;
            this.offset = len-slen;
        });

        this.#eTimeNavLock = document.createElement("button");
        this.eTimeNav.appendChild(this.eTimeNavLock);
        this.eTimeNavLock.innerHTML = "<ion-icon></ion-icon>";
        this.eTimeNavLock.addEventListener("click", e => {
            e.stopPropagation();
            this.locked = !this.locked;
        });
        const lockIcon = this.eTimeNavLock.children[0];

        const updateLocked = () => {
            if (this.locked)
                this.eTimeBox.classList.add("disabled");
            else this.eTimeBox.classList.remove("disabled");
            this.eTimeNavZeroLeft.disabled = this.locked;
            this.eTimeNavZeroRight.disabled = this.locked;
            this.eTimeNavEdit.disabled = this.locked;
            lockIcon.name = this.locked ? "lock-closed" : "lock-open";
        };
        this.addHandler("change", updateLocked);
        this.addHandler("add", updateLocked);
        this.addHandler("rem", updateLocked);

        let elems = {};

        const timer = new util.Timer(true);
        this.addHandler("change", () => timer.set(1000));
        let desync = 0;
        this.#duration = 0;
        this.addHandler("update", async delta => {
            if (this.isClosed) return;
            if (this.hasVideo()) {
                if (util.is(this.eVideo.duration, "num")) this.#duration = this.eVideo.duration;
            } else this.#duration = 0;
            const len = this.duration * 1000;
            let time = 0;
            let thresh = 0.05;
            if (this.page.hasSource()) {
                const offset = this.offset;
                const playback = this.page.source.playback;
                const slen = playback.tsMax-playback.tsMin;
                let stime = playback.ts-playback.tsMin;
                time = stime + offset;
                time = Math.min(len, Math.max(0, time)) / 1000;
                if (this.eVideo.readyState > 0) {
                    if (playback.paused || playback.finished || time < 0 || time >= len/1000) {
                        thresh = 0.001;
                        if (!this.eVideo.paused)
                            this.eVideo.pause();
                    } else {
                        if (this.eVideo.paused)
                            this.eVideo.play();
                    }
                }
                const blen = slen + 2*len;
                let l, r;
                [l, r] = [len, slen+len];
                l = Math.min(1, Math.max(0, l/blen));
                r = Math.min(1, Math.max(0, r/blen));
                this.eTimeSourceBox.style.setProperty("--l", (l*100)+"%");
                this.eTimeSourceBox.style.setProperty("--r", (r*100)+"%");
                [l, r] = [len-offset, 2*len-offset];
                l = Math.min(1, Math.max(0, l/blen));
                r = Math.min(1, Math.max(0, r/blen));
                this.eTimeVideoBox.style.setProperty("--l", (l*100)+"%");
                this.eTimeVideoBox.style.setProperty("--r", (r*100)+"%");
                if (this.page.eNavActionButton.children[0])
                    actionIcon.name = this.page.eNavActionButton.children[0].name;
            } else {
                this.eTimeSourceBox.style.setProperty("--l", "0%");
                this.eTimeSourceBox.style.setProperty("--r", "0%");
                this.eTimeVideoBox.style.setProperty("--l", "0%");
                this.eTimeVideoBox.style.setProperty("--r", "0%");
                actionIcon.name = "play";
            }
            if (Math.abs(this.eVideo.currentTime-time) > thresh) {
                desync++;
                if (desync >= 5)
                    this.eVideo.currentTime = time;
            } else desync = 0;
            if (!timer.dequeueAll(1000)) return;
            const videos = util.ensure(await window.api.send("videos"), "arr").map(name => String(name));
            videos.forEach(name => {
                if (name in elems) return;
                let elem = document.createElement("div");
                elems[name] = elem;
                this.eSource.appendChild(elem);
                elem.classList.add("item");
                elem.innerHTML = "<div></div><button><ion-icon name='ellipsis-vertical'></ion-icon></button>";
                elem.addEventListener("click", e => {
                    e.stopPropagation();
                    this.video = name;
                });
                const [eName, eBtn] = elem.children;
                eName.textContent = name;
                eBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    let itm;
                    let menu = new core.Menu();
                    itm = menu.addItem(new core.Menu.Item("Remove", "close"));
                    itm.addHandler("trigger", async e => {
                        if (this.video == name) this.video = null;
                        try {
                            await window.api.send("video-rem", name);
                        } catch (e) { this.app.doError("Video Remove Error", name, e); }
                    });
                    itm = menu.addItem(new core.Menu.Item("Rename"));
                    itm.addHandler("trigger", async e => {
                        let result = await this.app.doPrompt("Rename", name, name);
                        if (result == null) return;
                        try {
                            result = await window.api.send("video-rename", name, result);
                            if (this.video == name) this.video = result;
                        } catch (e) { this.app.doError("Video Rename Error", name, e); }
                    });
                    core.Menu.contextMenu = menu;
                    let r = eBtn.getBoundingClientRect();
                    core.Menu.placeContextMenu(r.left, r.bottom);
                });
            });
            Object.keys(elems).forEach(name => {
                if (videos.includes(name)) return;
                let elem = elems[name];
                delete elems[name];
                elem.remove();
            });
            videos.forEach((name, i) => {
                elems[name].style.order = i+1;
                if (this.video == name)
                    elems[name].classList.add("this");
                else elems[name].classList.remove("this");
            });
        });

        this.addHandler("change-video", async () => {
            this.eVideo.src = "file://"+(await window.api.send("video-get", this.video));
        });

        if (util.is(a, "str")) a = { video: a };

        a = util.ensure(a, "obj");
        this.video = a.video;
    }

    get video() { return this.#video; }
    set video(v) {
        v = (v == null) ? null : String(v);
        if (this.video == v) return;
        this.change("video", this.video, this.#video=v);
    }
    hasVideo() { return this.video != null; }

    get offset() {
        if (!this.hasVideo()) return 0;
        if (!this.page.hasProject()) return 0;
        const k = "vidsync:"+this.video;
        if (!this.page.project.hasProfile(k)) return 0;
        return util.ensure(this.page.project.getProfile(k).value, "num");
    }
    set offset(v) {
        if (!this.hasVideo()) return;
        v = util.ensure(v, "num");
        if (!this.page.hasProject()) return;
        const k = "vidsync:"+this.video;
        if (!this.page.project.hasProfile(k))
            this.page.project.addProfile(new this.page.project.constructor.Profile(k));
        [v, this.page.project.getProfile(k).value] = [this.page.project.getProfile(k).value, v];
        this.change("offset", v, this.offset);
    }

    get locked() {
        if (!this.hasVideo()) return true;
        if (!this.page.hasProject()) return true;
        const k = "vidsync:"+this.video+":lock";
        if (!this.page.project.hasProfile(k)) return false;
        return !!this.page.project.getProfile(k).value;
    }
    set locked(v) {
        if (!this.hasVideo()) return;
        if (!this.page.hasProject()) return;
        const k = "vidsync:"+this.video+":lock";
        if (!v) {
            this.page.project.remProfile(k);
            return this.change("locked", true, false);
        }
        if (!this.page.project.hasProfile(k))
            this.page.project.addProfile(new this.page.project.constructor.Profile(k));
        this.page.project.getProfile(k).value = true;
        this.change("locked", false, true);
    }
    get unlocked() { return !this.locked; }
    set unlocked(v) { this.locked = !v; }
    lock() { return this.locked = true; }
    unlock() { return this.unlocked = true; }

    get duration() { return this.#duration; }

    get eVideoBox() { return this.#eVideoBox; }
    get eVideo() { return this.#eVideo; }
    get eNav() { return this.#eNav; }
    get eSource() { return this.#eSource; }
    get eSourceTitle() { return this.#eSourceTitle; }
    get eTime() { return this.#eTime; }
    get eTimeTitle() { return this.#eTimeTitle; }
    get eTimeBox() { return this.#eTimeBox; }
    get eTimeSourceBox() { return this.#eTimeSourceBox; }
    get eTimeVideoBox() { return this.#eTimeVideoBox; }
    get eTimeNav() { return this.#eTimeNav; }
    get eTimeNavBack() { return this.#eTimeNavBack; }
    get eTimeNavAction() { return this.#eTimeNavAction; }
    get eTimeNavForward() { return this.#eTimeNavForward; }
    get eTimeNavZeroLeft() { return this.#eTimeNavZeroLeft; }
    get eTimeNavZeroRight() { return this.#eTimeNavZeroRight; }
    get eTimeNavEdit() { return this.#eTimeNavEdit; }
    get eTimeNavLock() { return this.#eTimeNavLock; }

    toJSON() {
        return util.Reviver.revivable(this.constructor, {
            video: this.video,
            offsets: this.offsets,
            locked: this.locked,
        });
    }
}
