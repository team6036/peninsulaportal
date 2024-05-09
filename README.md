<div>
    <p align="center">
        <img src="./src/assets/app/icon.png" width="100px" style="filter: drop-shadow(0px 5px 5px #0008)" class="docs-icon">
    </p>
    <h1 align="center">Peninsula Portal</h1>
    <p align="center">A toolbox of all apps developed by 6036</p>
</div>

<div>
    <h1 id="quick-start" align="center">Quick Start</h1>
</div>

### Installations
Check out the [latest release](https://github.com/team6036/peninsulaportal/releases) or browse past [releases](https://github.com/team6036/peninsulaportal/releases/latest).  
MacOS (Darwin) requires running a few more commands to authorize the application - otherwise application will be marked as "damaged."
1. `cd` to the directory containing the application
2. `xattr -cr Peninsula.app`

### Development
To set up the project
- [Install NPM / Node](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- Navigate to the project directory within terminal
```shell
npm install
```
To start the application
```shell
npm start
```
To package the application
```shell
npm run package
```
This should create a `./build` directory with the packaged apps. Check with `package.js` to see the build options.

<div>
    <h1 id="doc-and-help" align="center">Documentation & Help</h1>
</div>

[Peninsula Presets →](./docs/presets/MAIN.md)

[Peninsula Panel →](./docs/panel/MAIN.md)

[Peninsula Planner →](./docs/planner/MAIN.md)

[Peninsula Pit →](./docs/pit/MAIN.md)

[Peninsula PythonTK →](./docs/pythontk/MAIN.md)

<div>
    <h1 id="resources" align="center">Resources</h1>
</div>

[Peninsula Portal Assets](https://github.com/12Jeef/peninsulaportal-assets)
- [Electron](https://www.electronjs.org/) - Window display and management
- [Fuse.js](https://www.fusejs.io/) - Fuzzy search
- [Highlight.js](https://highlightjs.org/) - Syntax coloring for code blocks in `.md`
- [Ionicons](https://ionic.io/ionicons) - App icons
- [Showdown.js](https://showdownjs.com/) - `.md` to `HTML`
- [Three.js](https://threejs.org/) - 3D rendering
