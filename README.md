<div>
    <p align="center">
        <img src="./assets/icon.png" width="100px" style="filter: drop-shadow(0px 5px 5px #0008)">
    </p>
    <h1 align="center">Peninsula Portal</h1>
    <p align="center">A toolbox of all apps developed by 6036</p>
</div>

## Table of Contents
- [Getting Started](#getting-started)
    - [Releases](#releases)
    - [Development](#development)
- [Peninsula Panel](#peninsula-panel)
    - [Capabilities](#capabilities)
    - [Getting Started](#getting-started-1)
- [Peninsula Planner](#peninsula-planner)
    - [Capabilities](#capabilities-1)
    - [Getting Started](#getting-started-2)
- Peninsula Pursuit - <kbd>TBD</kbd>

## Getting Started

### Releases
Check the releases for different packages  
MacOS (Darwin) requires running a few more commands to authorize the application - otherwise application will be marked as "damaged"
1. `cd` to the directory containing the application
2. `xattr -cr Peninsula.app`

### Development
- [Install NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- Navigate to the project directory within terminal
```shell
npm install
npm start
```

<div>
    <h1 id="peninsula-panel" align="center">Peninsula Panel</h1>
    <p align="center">A networktables viewing software for a visual display</p>
</div>

## Capabilities

## Getting Started

### Usage

### FAQ

### Development

<div>
    <h1 id="peninsula-planner" align="center">Peninsula Planner</h1>
    <p align="center">A path planning software which provides a visual way to edit and create paths</p>
</div>

## Capabilities
- Secure project creation and management system
- Visual editing process
    - Sleek and streamline editing process of objects
    - Dynamic multi-path creation system with repeat-node support
- Playback feature for trajectory generation

## Getting Started

### Usage
Just navigate through portal using the "Planner" button

### FAQ
> How can I reset the divider to it's original position?  

On the view menu of the app, click "Reset divider"
> How can I delete nodes when creating or editing a path?  

When clicking a node, hold down <kbd>shift</kbd> to remove it instead
> How can I select multiple nodes or obstacles at once?

By dragging on the display area, you can create a rectangular seletion. This allows you to select multiple objects at once. Additionally, holding down <kbd>shift</kbd> while clicking adds or removes objects to your selection

### Development
This program does not generate the trajectory by itself. It relies on a python file, which you can change, to generate the path.
Here is what the python script should expect as input and what it should output:  
`data.in`
```json
{
   "config": {
       "map_w": 0, "map_h": 0,
       "side_length": 0,
       "mass": 0,
       "moment_of_inertia": 0,
       "efficiency_percent": 0,
       "12_motor_mode": false
   },
   "nodes": [
       {
           "x": 0, "y": 0,
           "vx": 0, "vy": 0,
           "vt": 0,
           "theta": 0
       }
   ],
   "obstacles": [
       {
           "x": 0, "y": 0,
           "radius": 0
       }
   ]
}
```
`data.out`
```json
{
   "dt": 0,
   "state": [
       {
           "x": 0, "y": 0,
           "vx": 0, "vy": 0,
           "theta": 0
       }
   ]
}
```
`vx`, `vy`, `vt`, and `theta` of `data.in` can be `null` to ignore a velocity or angle override. Adjust your script accordingly.
