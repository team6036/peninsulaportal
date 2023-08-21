# Peninsula Portal
A toolbox of all apps developed by 6036

Tools include:
* Panel - <kbd>WIP</kbd>
* [Planner](#planner)
* Pursuit - <kbd>WIP</kbd>
* Perception - <kbd>WIP</kbd>

### **USAGE**
No binaries yet

### **DEVELOPING**
- [Install NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- Open project and navigate within terminal
```shell
npm install
npm start
```

# Planner
A path planning software which provides a visual way to edit and create paths
- Easy navigable UI
    - Project management
    - Fancy selection and mass modification of nodes / obstacles
    - Looks nice :)
- Nodes (waypoints) can be configured with a velocity (movement / rotational) and heading
- Obstacles can be configured with a radius
- Allows for multiple paths per project, including naming / editing specific paths
### **DEVELOPMENT DOCUMENTATION**
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
### **REMINDER**
`vx`, `vy`, `vt`, and `theta` of `data.in` can be `null` to ignore a velocity or angle override. Adjust your script accordingly.
