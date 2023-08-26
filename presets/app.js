import * as util from "../util.js";
import { V } from "../util.js";

import * as core from "../core.js";


export default class App extends core.App {
    constructor() {
        super();

        this.addHandler("start-complete", data => {
            const quality = 5;
            let tileSize = new V(20);
            let mapSize = new V(50, 30);
            let map = new Array(mapSize.x).fill(null).map((_, x) => new Array(mapSize.y).fill(null).map((_, y) => 0));
            let heads = [], headSpawn = 0;

            let canvas = document.getElementById("canvas");
            if (!(canvas instanceof HTMLCanvasElement)) return;
            const ctx = canvas.getContext("2d");
            ctx.canvas.width = mapSize.x*tileSize.x*quality;
            ctx.canvas.height = mapSize.y*tileSize.y*quality;

            const forwards = [[+1,0], [+1,+1], [0,+1], [-1,+1], [-1,0], [-1,-1], [0,-1], [+1,-1]].map(v => new V(v));

            const convert = (...v) => {
                v = new V(...v);
                v.isub(mapSize.sub(1).div(2));
                v.y *= -1;
                v.imul(tileSize);
                v.imul(quality);
                v.iadd(ctx.canvas.width/2, ctx.canvas.height/2);
                return v;
            };

            let t = 0;
            let frame = 1000/10;
            this.addHandler("update", data => {
                let ct = util.getTime();
                let p = Math.min(1, Math.max(0, (ct-t)/frame));
                let scale = Math.max(window.innerWidth / ((mapSize.x-2)*tileSize.x*quality), window.innerHeight / ((mapSize.y-2)*tileSize.y*quality));
                ctx.canvas.style.width = (mapSize.x*tileSize.x*quality * scale) + "px";
                ctx.canvas.style.height = (mapSize.y*tileSize.y*quality * scale) + "px";
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                let color = String(getComputedStyle(document.body).getPropertyValue("--v2"));
                color = color.slice(5, color.length-1).split(",").map(v => v.replaceAll(" ", "")).map(v => Math.min(255, Math.max(0, util.ensure(parseFloat(v), "num"))));
                while (color.length > 3) color.pop();
                while (color.length < 3) color.push(0);
                heads.forEach(head => {
                    let pos = convert(head.pos.add(forwards[head.heading].mul(p)));
                    if (head.mode == "add") {
                        let a = (head.list.length > 0) ? (head.list.length-1+0.5)/60 : 0;
                        ctx.strokeStyle = "rgba("+[...color, a].join(",")+")";
                        ctx.lineWidth = 5*quality;
                        ctx.beginPath();
                        ctx.arc(...pos.xy, 10*quality, 0, 2*Math.PI);
                        ctx.stroke();
                        if (head.list.length > 0) {
                            ctx.strokeStyle = "rgba("+[...color, a].join(",")+")";
                            ctx.lineWidth = 10*quality;
                            ctx.lineCap = "square";
                            ctx.lineJoin = "round";
                            ctx.beginPath();
                            let end = convert(head.list.at(-1));
                            let start = pos.add(V.dir(pos.towards(end), 10*quality + ctx.lineWidth/2));
                            ctx.moveTo(...end.xy);
                            ctx.lineTo(...start.xy);
                            ctx.stroke();
                        }
                    }
                    let polygons = [];
                    for (let i = 0; i+1 < head.list.length; i++) {
                        let j = i+1;
                        let pi = convert(head.list[i]), pj = convert(head.list[j]);
                        let w = 10*quality;
                        let dir = pi.towards(pj), dist = pi.dist(pj);
                        let center = pi.add(pj).div(2);
                        polygons.push({
                            l: [
                                center.add(V.dir(dir, -dist/2 + w/2)).add(V.dir(dir+90, w/2)),
                                center.add(V.dir(dir, +dist/2 - w/2)).add(V.dir(dir+90, w/2)),
                            ],
                            r: [
                                center.add(V.dir(dir, -dist/2 + w/2)).add(V.dir(dir-90, w/2)),
                                center.add(V.dir(dir, +dist/2 - w/2)).add(V.dir(dir-90, w/2)),
                            ],
                            a: (i+0.5)/60,
                        });
                    }
                    polygons.forEach(polygon => {
                        let points = [polygon.l[0], polygon.l[1], polygon.r[1], polygon.r[0]];
                        ctx.fillStyle = "rgba("+[...color, polygon.a].join(",")+")";
                        ctx.beginPath();
                        for (let i = 0; i <= points.length; i++) {
                            let j = i % points.length;
                            if (i > 0) ctx.lineTo(...points[j].xy);
                            else ctx.moveTo(...points[j].xy);
                        }
                        ctx.fill();
                    });
                    for (let i = 0; i+1 < polygons.length; i++) {
                        let j = i+1;
                        let pi = polygons[i], pj = polygons[j];
                        let points = [pi.l[1], pj.l[0], pj.r[0], pi.r[1]];
                        ctx.fillStyle = "rgba("+[...color, ((pi.a+pj.a)/2)].join(",")+")";
                        ctx.beginPath();
                        for (let i = 0; i <= points.length; i++) {
                            let j = i % points.length;
                            if (i > 0) ctx.lineTo(...points[j].xy);
                            else ctx.moveTo(...points[j].xy);
                        }
                        ctx.fill();
                    }
                });
                if (ct-t < frame) return;
                t = ct;
                for (let x = 0; x < mapSize.x; x++) {
                    for (let y = 0; y < mapSize.y; y++) {
                        if (map[x][y] <= 0) continue;
                        map[x][y]--;
                    }
                }
                [...heads].forEach(head => {
                    if (head.mode == "rem") {
                        if (head.list.length > 0) head.list.shift();
                        else heads.splice(heads.indexOf(head), 1);
                        return;
                    }
                    head.list.push(new V(head.pos));
                    if (head.list.length > 60) head.list.shift();
                    map[head.pos.x][head.pos.y] = 30;
                    let priority = [];
                    if (head.count > util.lerp(45, 75, Math.random())) {
                        head.count = 0;
                        priority = [[+2,+1,-1,-2], [0]];
                    } else {
                        head.count++;
                        priority = [[0], [+2,+1,-1,-2]];
                    }
                    let found = false;
                    priority.forEach(section => {
                        if (found) return;
                        let possible = [];
                        section.forEach(offset => {
                            let newHeading = (((head.heading+offset)%8)+8)%8;
                            let newPos = head.pos.add(forwards[newHeading]);
                            if (newPos.x < 0 || newPos.x >= mapSize.x) return;
                            if (newPos.y < 0 || newPos.y >= mapSize.y) return;
                            if (map[newPos.x][newPos.y] > 0) return;
                            possible.push(offset);
                        });
                        if (possible.length <= 0) return;
                        found = true;
                        let offset = possible[Math.floor(Math.random()*possible.length)];
                        head.heading = (((head.heading+offset)%8)+8)%8;
                        head.pos.iadd(forwards[head.heading]);
                    });
                    if (
                        head.pos.x < 0 || head.pos.x >= mapSize.x ||
                        head.pos.y < 0 || head.pos.y >= mapSize.y ||
                        !found
                    ) head.mode = "rem";
                });
                if (heads.length < 20) {
                    if (headSpawn > util.lerp(15, 45, Math.random())) {
                        headSpawn = 0;
                        let possible = [], pos = new V();
                        for (let heading = 0; heading < 8; heading += 2) {
                            while (1) {
                                let next = pos.add(forwards[heading]);
                                if (next.x < 0 || next.x >= mapSize.x) break;
                                if (next.y < 0 || next.y >= mapSize.y) break;
                                pos.set(next);
                                if (map[pos.x][pos.y] > 0) continue;
                                possible.push({
                                    pos: new V(pos),
                                    heading: (((heading+2)%8)+8)%8,
                                });
                            }
                        }
                        if (possible.length > 0) {
                            let spawn = possible[Math.floor(Math.random()*possible.length)];
                            heads.push({
                                pos: spawn.pos,
                                heading: spawn.heading,
                                count: 0, list: [], mode: "add",
                            });
                        }
                    } else headSpawn++;
                }
            });

            const update = () => {
                this.post("update", null);
                window.requestAnimationFrame(update);
            };
            update();
        });
    }
}
