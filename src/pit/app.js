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
                scene.add(light2);
                light2.position.set(-2, -2, -2);
                light2.target.position.set(0, 0, 0);
                if (useShadow) {
                    light2.castShadow = true;
                    light2.shadow.mapSize.width = shadowQ;
                    light2.shadow.mapSize.height = shadowQ;
                    light2.shadow.bias = -0.01;
                }

                const specks = [];

                const geometries = [
                    new THREE.SphereGeometry(0.015, 8, 8),
                    new THREE.SphereGeometry(0.01, 8, 8),
                    new THREE.SphereGeometry(0.005, 8, 8),
                ];
                const materials = [
                    new THREE.MeshBasicMaterial({ color: 0xffffff }),
                    new THREE.MeshBasicMaterial({ color: 0xffffff }),
                ];
                for (let i = 0; i < 50; i++) {
                    const mesh = new THREE.Mesh(
                        geometries[Math.floor(geometries.length*Math.random())],
                        materials[Math.floor(materials.length*Math.random())],
                    );
                    const light = new THREE.PointLight(0xffffff, 0.1);
                    specks.push({
                        y: util.lerp(-0.25, 2.25, Math.random()),
                        r: util.lerp(0.75, 2, util.ease.cubicO(Math.random())),
                        d: 360*Math.random(),
                        mesh: mesh,
                        light: light,
                    });
                    scene.add(mesh);
                    // if (specks.at(-1).r < 1) scene.add(light);
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
                core.LOADER.load("../../temp/model.glb", gltf => {
                    throw "error";
                    model = gltf.scene;
                    model.traverse(obj => {
                        if (!obj.isMesh) return;
                        obj.material.metalness = 0;
                        obj.material.shininess = 0;
                        obj.castShadow = !obj.material.transparent;
                        obj.receiveShadow = !obj.material.transparent;
                    });
                    const scale = 1.25;
                    model.scale.set(scale, scale, scale);
                    const bbox = new THREE.Box3().setFromObject(model);
                    model.position.set(0, (bbox.max.y-bbox.min.y)/2, 0);
                    scene.add(model);
                });

                let angle = 0, color = null;

                this.addHandler("update", delta => {
                    let colorW = core.PROPERTYCACHE.getColor("--v8");
                    let colorA = core.PROPERTYCACHE.getColor("--a");
                    let colorV = core.PROPERTYCACHE.getColor("--v2");
                    materials[0].color.set(colorW.toHex(false));
                    materials[1].color.set(colorA.toHex(false));
                    light1.color.set(colorW.toHex(false));
                    light2.color.set(colorA.toHex(false));

                    const dir = 360*((util.getTime()/30000)%1);
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

                    specks.forEach(speck => {
                        const { y, r, d, mesh, light } = speck;
                        mesh.position.set(r*util.cos(dir+d), y, r*util.sin(dir+d));
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
