<img src="./assets/icon.png" width="200px" style="filter: drop-shadow(0px 5px 5px #0008)"><br>
# Peninsula Portal
A toolbox of all apps developed by 6036

Tools include:
* Panel - <kbd>WIP</kbd>
* [Planner](#planner)
* Pursuit - <kbd>WIP</kbd>
* Perception - <kbd>WIP</kbd>

### **USAGE**
Check the releases for different packages  
Darwin requires running a few more commands to authorize the application - otherwise application will be marked as "damaged"
1. `cd` to the directory containing the application
2. `xattr -cr Peninsula.app`

### **DEVELOPING**
- [Install NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- Open project and navigate within terminal
```shell
npm install
npm start
```

## Planner
A path planning software which provides a visual way to edit and create paths
- Easy navigable UI
    - Project management
    - Fancy selection and mass modification of nodes / obstacles
    - Looks nice :)
- Nodes (waypoints) can be configured with a velocity (movement / rotational) and heading
- Obstacles can be configured with a radius
- Allows for multiple paths per project, including naming / editing specific paths
### FAQ
> How can I reset the divider to it's original position?  

On the view menu of the app, click "Reset divider"
> How can I delete nodes when creating or editing a path?  

When clicking a node, hold down <kbd>shift</kbd> to remove it instead
> How can I select multiple nodes or obstacles at once?

By dragging on the display area, you can create a rectangular seletion. This allows you to select multiple objects at once. Additionally, holding down <kbd>shift</kbd> while clicking adds or removes objects to your selection
### DEVELOPMENT DOCUMENTATION
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
### REMINDER
`vx`, `vy`, `vt`, and `theta` of `data.in` can be `null` to ignore a velocity or angle override. Adjust your script accordingly.
