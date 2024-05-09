<a href="../../README.md" class="back">← Back</a>

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

## Navigation

### Title Page
Click on <kbd>Create</kbd> to create a new project, or click on <kbd>Projects</kbd> to open the list of projects.
> [!NOTE]
> To return to the title page at any point while this application is open, simply click on the logo in the top left corner.

### Projects Page
Click on <kbd>Create</kbd> to create a new project. Additionally, you can select a template to create a project from. Double-clicking a project opens that project. Single clicking a project selects or unselects it. Right-clicking anywhere to open the context menu allows for editing of the selected projects. To switch between list display and grid display, simply click the list or grid icon next to the search bar. Use the search bar to filter out projects by name if needed.
> [!NOTE]
> To return to the projects page at any point while this application is open, simply click on the folder icon in the top right corner. To quickly create a project, simply click the <kbd>+</kbd> icon in the top right corner.

### Project Page

#### Title Bar Navigation
Clicking on the File, Edit, and View menus will open up a menu similar to the native system's file, edit, and view menus. Feel free to look at the options provided. Clicking on the project name provides more information about the project, including its name, source type, and actions relating to that source. Options listed are as follows:

- Project name input
- Save / Copy / Delete project actions

Clicking on the <kbd>Save</kbd> button will save the current project. The button will also display the current save status of the project as Saved, Saving, or Save (to manually save).

#### Main Display
Displays the active field that this project uses as a template. You can drag, move, and edit nodes from this field. Additionally, the playback menu, similar to YouTube, will also appear here, so you can navigate the generated path your script created. Clicking the fullscreen button in the top-right corner will close the Side Menu, and clicking it again will return the display to the unmaximized state.

#### Side Menu

##### Objects Panel
Allows you to edit selected objects or drag in new ones. Options include:
- **Position** — The position of the object (or center of objects if multiple are selected).
- **Robot Heading** <kbd>Nodes only</kbd> — The wanted heading of the robot, toggleable.
- **Robot Velocity** <kbd>Nodes only</kbd> — The wanted velocity of the robot, toggleable.
- **Robot Rotational Velocity** <kbd>Nodes only</kbd> — The wanted rotational velocity, toggleable.
- **Options** <kbd>Nodes only</kbd> — The custom properties of the selected node. This feature only works when you have selected one node only.
- **Display Type** <kbd>Nodes only</kbd> — The display type of the selected node. Available types include:
    - Default
    - Node
    - Box
    - Arrow (Centered)
    - Arrow (Head centered)
    - Arrow (Tail centered)

    There are also year-specific game piece types.
- **Display Color** <kbd>Nodes only</kbd> — The color of the displayed node.
- **Display Ghost** <kbd>Nodes only</kbd> — Whether or not the node is semi-transparent.
- **Radius** <kbd>Obstacles only</kbd> — The size of the circular obstacle.
- **Enabled** <kbd>Obstacles only</kbd> — Disabling an obstacle will result in it not showing up within the input file of your Python script.

##### Paths Panel
Click on <kbd>+</kbd> to create a new path. Click on the pencil icon next to each path to edit that path. Click on the waypoints to add them. Hold shift while clicking on nodes within the path to remove them. Click on <kbd>x</kbd> to remove that path. Click on <kbd>Generate</kbd> to run the Python generator script on the currently selected path.

##### Options Panel
Changing of project settings. Options include:
- **Template** — current project template. Changing the dropdown menu's selection will change the background and map size, but will not change robot size and mass. To fully apply those settings, simply click <kbd>Apply Template</kbd>
- **Map Size** <kbd>No template only</kbd> — size of the map.
- **Robot Size** — size of robot (assuming square).
- **Robot Mass** — mass of robot
- **Script Options** — additional script options.
- **Generator Script** — if not using the default generator, this python script will be executed.
- **Script Python** — the Python command used.
- **Default Generator** — toggles the default generator script.

## Development Notes
If you are writing your own Python script to generate the path, expect a file as input, generated in the same directory as your python script.

`data.in`
```json
{
   "config": {
       "map_w": 0, "map_h": 0,
       "side_length": 0,
       "mass": 0
       // any additional options as provided in Script Options will be inserted here
   },
   "nodes": [
       {
           "x": 0, "y": 0,
           "vx": 0, "vy": 0,
           "vt": 0,
           "theta": 0
           // any additional options as provided by Node Options will be inserted here
       }
       // ...
   ],
   "obstacles": [
       {
           "x": 0, "y": 0,
           "radius": 0
       }
       // ...
   ]
}
```

> [!IMPORTANT]
> Remember, that if you disabled Robot Heading, `theta` will be `null`. If you disabled Robot Velocity, `vx`, `vy`, and `vt` will all be `null`. In Python, that translates to `None`.

For our code to properly process and generate a visual, your output path must match this schema. It must be created with the name `data.out` and in the same directory as your script.

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
       // ...
   ]
}
```
