<a href="../../README.md" class="back">← Back</a>

<div>
    <h1 id="peninsula-presets" align="center">Peninsula Presets</h1>
    <p align="center">Settings for Peninsula Portal</p>
</div>

## Application Page

### Application Data Directory
The application data directory, aka where all data files are stored, of Peninsula Portal. Click on <kbd>Open</kbd> to open that directory.

### Application Log Directory
The application log directory, aka where all log files are stored, of Peninsula Portal. Click on <kbd>Open</kbd> to open that directory.

### Cleanup Application Directory
Searches application data directory for unnecessary or leftover files from version upgrades. Prompts clean up.

### Clear Application Log Directory
Clears logs from log directory.

### Database Host
IP or web address of database which will respond with JSON containing a Github repository to poll for assets and configurations. This schema goes as follows:
```js
{
    "dbHost": string, // your web address or ip here
    "assetsOwner": string, // owner of assets repo
    "assetsRepo": string, // repo name
    "assetsTag": string, // release tag
    "assetsAuth": string | null, // authorization key (or null if not needed)
}
```

## Appearance Page

### Theme
The application theme. Feel free to explore!

### Native Theme
How to match native theme, which on most operating systems, means whether or not its light or dark mode. Selecting `Light` forces the theme to be light. Selecting `Dark` forces the theme to be dark. Selecting `System` allows the theme to switch depending on how your OS is configured.

### Holiday
The current active holiday! Disable the toggle to opt out of holiday fun...

### Reduced Motion
Disables almost all animations for motion-sensitive individuals.

## Theme Overrides

### Database Inherited
Includes all inherited themes from the assets repo. You cannot edit these. Use the <kbd>Export</kbd> button to export them to a custom file (`.pdtheme`)

### Import Theme
Imports a theme from a `.pdtheme` file.

### Create Theme
Creates a theme customized only to your application. Feel free to export and share to others.

## Template Overrides

### Database Inherited
Includes all inherited templates from the assets repo. You cannot edit these. Use the <kbd>Export</kbd> button to export them to a custom file (`.pdtemplate`)

### Import Template
Imports a template from a `.pdtemplate` file.

### Create Template
Creates a template customized only to your application. It has the following configurations:
- **Name** — the display name of the template, for nicer reading
- **Size** — the size of the field
- **Robot Size** — size of robot (assuming square)
- **Robot Mass** - mass of robot

#### 2D Image Asset & 3D Model Asset
You can drag and drop a file into the section, or manually select it.

## Robot Overrides

### Database Inherited
Includes all inherited robots from the assets repo. You cannot edit these. Use the <kbd>Export</kbd> button to export them to a custom file (`.pdrobot`)

### Import Robot
Imports a robot from a `.pdrobot` file.

### Create Robot
Creates a robot customized only to your application. It has the following configurations:
- **Name** — the display name of the robot, for nicer reading
- **Bumper Detect** — whether or not to use color to detect bumpers. For example, any shade of blue or red automatically is taken as a bumper, which makes its color change when changing the color of the pose.
- **Default Model Name** — the name of the file that the base model is. Defaults to `model`.
- **Components** — the components of the robot, which will be displayed offset to the base. Each component has a readable name and a model associated with it.

#### 3D Model Assets
You can drag and drop a file into the view, or manually select it from the buttons.

#### Zeroing
Zeroing consists of two operations: a rotation, then a translation. The rotation consists of multiple steps, each rotating around an axis a specific angle. Feel free to mess around with the zeroing menus provided until you feel that it has been zeroed properly. Remember, those three colored axes you see represent the positive x, y and z axes. The center (0, 0, 0) is where they intersect.

## Holiday Overrides
There is no documentation for this currently.
