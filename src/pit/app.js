import * as util from "../util.mjs";
import { V } from "../util.mjs";
import * as lib from "../lib.mjs";

import * as core from "../core.mjs";

import * as THREE from "three";


export default class App extends core.App {
    #eCanvas;

    constructor() {
        super();

        this.addHandler("post-setup", async () => {
            this.#eCanvas = document.getElementById("canvas");
            if (this.hasECanvas()) {
                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
                camera.position.set(0, 1, 2);

                const useShadow = true;

                const renderer = new THREE.WebGLRenderer({ canvas: this.eCanvas, alpha: true, powerPreference: "default" });
                renderer.shadowMap.enabled = useShadow;

                const shadowQ = 1024;

                const light1 = new THREE.SpotLight(0xffffff, 75, 0, 60*(Math.PI/180), 0.25, 2);
                scene.add(light1);
                light1.position.set(2, 4, 2);
                light1.target.position.set(0, 0, 0);
                if (useShadow) {
                    light1.castShadow = true;
                    light1.shadow.mapSize.width = shadowQ;
                    light1.shadow.mapSize.height = shadowQ;
                    light1.shadow.bias = -0.01;
                }
                const light2 = new THREE.SpotLight(0xffffff, 300, 0, 60*(Math.PI/180), 0.25, 2);
                // scene.add(light2);
                light2.position.set(-2, -2, -2);
                light2.target.position.set(0, 0, 0);
                if (useShadow) {
                    light2.castShadow = true;
                    light2.shadow.mapSize.width = shadowQ;
                    light2.shadow.mapSize.height = shadowQ;
                    light2.shadow.bias = -0.01;
                }

                const specks = [];

                const flatShading = true;

                const geometries = [
                    new THREE.SphereGeometry(0.015, 8, 8),
                    new THREE.SphereGeometry(0.01, 8, 8),
                    new THREE.SphereGeometry(0.005, 8, 8),
                ];
                const materials = [
                    new THREE.MeshBasicMaterial({ color: 0xffffff }),
                    new THREE.MeshBasicMaterial({ color: 0xffffff }),
                    new THREE.MeshBasicMaterial({ color: 0xffffff }),
                    new THREE.MeshBasicMaterial({ color: 0xffffff }),
                    new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: flatShading, shininess: 200 }),
                    new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: flatShading, shininess: 200 }),
                    new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: flatShading, shininess: 200 }),
                ];
                for (let i = 0; i < 100; i++) {
                    const mesh = new THREE.Mesh(
                        geometries[Math.floor(3*Math.random())],
                        materials[Math.floor(2*Math.random())],
                    );
                    const light = new THREE.PointLight(0xffffff, 0.1);
                    specks.push({
                        y: util.lerp(-0.25, 2.25, Math.random()),
                        r: util.lerp(0.5, 2, util.ease.cubicO(Math.random())),
                        d: 360*Math.random(),
                        s: util.lerp(0.75, 1.25, Math.random()),
                        mesh: mesh,
                        light: light,
                    });
                    scene.add(mesh);
                    if (specks.at(-1).r < 1) scene.add(light);
                }

                const update = () => {
                    let r = this.eCanvas.parentElement.getBoundingClientRect();
                    renderer.setSize(Math.ceil(r.width), Math.ceil(r.height));
                    renderer.setPixelRatio(2);
                    if (camera.aspect != r.width/r.height) {
                        camera.aspect = r.width/r.height;
                        camera.updateProjectionMatrix();
                    }
                };
                new ResizeObserver(update).observe(this.eCanvas.parentElement);
                update();

                let model = null;
                // core.LOADER.load("../../temp/model.glb", gltf => {
                //     model = gltf.scene;
                //     model.traverse(obj => {
                //         if (!obj.isMesh) return;
                //         obj.material.metalness = 0;
                //         obj.material.shininess = 0;
                //         obj.castShadow = !obj.material.transparent;
                //         obj.receiveShadow = !obj.material.transparent;
                //     });
                //     const scale = 1.25;
                //     model.scale.set(scale, scale, scale);
                //     const bbox = new THREE.Box3().setFromObject(model);
                //     model.position.set(0, (bbox.max.y-bbox.min.y)/2, 0);
                //     scene.add(model);
                // });

                const makeMesh = (n, d, r1, r2, w, i) => {
                    const kk = n;
                    const geo = new THREE.BufferGeometry();
                    let verts = [];
                    let vertsMap = [];
                    for (let i = 0; i < 2; i++) {
                        vertsMap.push([]);
                        const r = i ? r2 : r1;
                        for (let j = 0; j < 2; j++) {
                            vertsMap.at(-1).push([]);
                            const z = ((j*2)-1) * w/2;
                            for (let k = 0; k < kk; k++) {
                                let angle = 360*(k/kk) + d;
                                vertsMap.at(-1).at(-1).push(verts.length);
                                const vert = [util.cos(angle)*r, util.sin(angle)*r, z];
                                verts.push(vert);
                            }
                        }
                    }
                    let verts2 = [];
                    verts.forEach(vert => verts2.push(...vert));
                    const vertsArr = new Float32Array(verts2);
                    let indicies = [];
                    for (let i = 0; i < 2; i++) {
                        for (let k = 0; k < kk; k++) {
                            let k2 = (k+1)%kk;
                            indicies.push([
                                vertsMap[i][0][k],
                                vertsMap[i][1][k],
                                vertsMap[i][1][k2],
                            ]);
                            if (i) indicies.at(-1).reverse();
                            indicies.push([
                                vertsMap[i][0][k],
                                vertsMap[i][0][k2],
                                vertsMap[i][1][k2],
                            ]);
                            if (!i) indicies.at(-1).reverse();
                        }
                    }
                    for (let j = 0; j < 2; j++) {
                        for (let k = 0; k < kk; k++) {
                            let k2 = (k+1)%kk;
                            indicies.push([
                                vertsMap[0][j][k],
                                vertsMap[1][j][k],
                                vertsMap[1][j][k2],
                            ]);
                            if (!j) indicies.at(-1).reverse();
                            indicies.push([
                                vertsMap[0][j][k],
                                vertsMap[0][j][k2],
                                vertsMap[1][j][k2],
                            ]);
                            if (j) indicies.at(-1).reverse();
                        }
                    }
                    let indicies2 = [];
                    indicies.forEach(index => indicies2.push(...index));
                    const indiciesArr = indicies2;
                    geo.setIndex(indiciesArr);
                    geo.setAttribute("position", new THREE.BufferAttribute(vertsArr, 3));
                    geo.computeVertexNormals();
                    const mesh = new THREE.Mesh(geo, materials[i]);
                    mesh.castShadow = mesh.receiveShadow = true;
                    return mesh;
                };

                model = new THREE.Group();
                scene.add(model);
                const group = new THREE.Group();
                model.add(group);
                group.position.set(-0.1, 0, 0);
                const m1 = makeMesh(3, -30, 1/1.5-0.25, 1/1.5, 0.25, 4);
                m1.position.set(-1, 0.5-1/1.5, 0);
                group.add(m1);
                const m2 = makeMesh(60, 0, 0.5-0.125, 0.5, 0.25, 5);
                m2.position.set(0, 0, 0);
                group.add(m2);
                const m3 = makeMesh(4, 45, 0.5*Math.sqrt(2)-0.2, 0.5*Math.sqrt(2), 0.25, 6);
                m3.position.set(+1.1, 0, 0);
                group.add(m3);
                const scale = 0.5;
                model.scale.set(scale, scale, scale);
                model.position.set(0, 0.75, 0);
                [m1, m2, m3].forEach(m => {
                    m.y = m.position.y;
                    m.d = 0;
                });

                let angle = 0, color = null;

                this.addHandler("update", delta => {
                    let colorW = core.PROPERTYCACHE.getColor("--v8");
                    let colorA = core.PROPERTYCACHE.getColor("--a");
                    let colorV = core.PROPERTYCACHE.getColor("--v2");
                    // let color1 = core.PROPERTYCACHE.getColor("--cr");
                    // let color2 = core.PROPERTYCACHE.getColor("--cy");
                    // let color3 = core.PROPERTYCACHE.getColor("--cb");
                    materials[0].color.set(colorW.toHex(false));
                    materials[1].color.set(colorA.toHex(false));
                    // materials[0].color.set(color1.toHex(false));
                    // materials[1].color.set(color2.toHex(false));
                    // materials[2].color.set(color3.toHex(false));
                    // materials[3].color.set(colorW.toHex(false));
                    materials[4].color.set(colorV.toHex(false));
                    materials[5].color.set(colorV.toHex(false));
                    materials[6].color.set(colorV.toHex(false));
                    light1.color.set(colorW.toHex(false));
                    light2.color.set(colorA.toHex(false));

                    const dir = 360*(util.getTime()/30000);
                    if (model) {
                        let angle2 = dir*(Math.PI/180);
                        model.rotateY(angle-angle2);
                        angle = angle2;
                        if (color != colorV.toHex(false)) {
                            color = colorV.toHex(false);
                            model.traverse(obj => {
                                if (!obj.isMesh) return;
                                obj.material.color.set(color);
                            });
                        }
                    }

                    [m1, m2, m3].forEach((m, i) => {
                        let x = 360*util.getTime()/2500+60*i;
                        m.position.setY(m.y+0.1*util.sin(x));
                        const d = (Math.PI/180) * (5*util.sin(x+90));
                        m.rotateZ(m.d-d);
                        m.d = d;
                    });

                    specks.forEach(speck => {
                        const { y, r, d, s, mesh, light } = speck;
                        mesh.position.set(r*util.cos(dir*s+d), y, r*util.sin(dir*s+d));
                        light.color.copy(mesh.material.color);
                        light.position.copy(mesh.position);
                    });

                    renderer.render(scene, camera);
                });
            }
        });
    }

    get eCanvas() { return this.#eCanvas; }
    hasECanvas() { return this.eCanvas instanceof HTMLCanvasElement; }
}
