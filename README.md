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
       "map_w": 0, "map_h": 0, // map size
       "side_length": 0, // robot side length - assume square
       "mass": 0, // robot mass
       "moment_of_inertia": 0,
       "efficiency_percent": 0,
       "12_motor_mode": false
   },
   "nodes": [
       {
           "x": 0, "y": 0, // position
           "vx": 0, "vy": 0, // wanted velocity (if null, ignore velocity override)
           "vt": 0, // wanted rotational velocity (if null, ignore velocity override)
           "theta": 0 // wanted heading angle
       }
       /* ... */
   ],
   "obstacles": [
       {
           "x": 0, "y": 0, // position
           "radius": 0 // radius
       }
       /* ... */
   ]
}
```
`data.out`
```json
{
   "dt": 0, // time difference per state
   "state": [
       {
           "x": 0, "y": 0, // position
           "velo_x": 0, "velo_y": 0, // velocity
           "theta": 0 // heading angle
       }
       /* ... */
   ]
}
```
