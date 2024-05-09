<a href="../../README.md" class="back">← Back</a>

<div>
    <h1 id="peninsula-panel" align="center">Peninsula Panel</h1>
    <p align="center">A networktables and WPILOG viewing software for a visual debugging process</p>
</div>

## Capabilities
- Connection to specified ip with port `5810` with NT4
- WPILOG loading
- Paneled visualization of log values
    - Table/Topic browsing
    - Graphing of numerical and discrete topics
    - Odometry 2D/3D displaying

## Tabs

### Basic Tabs
[Add Tab →](./tabs/ADD.md)

[Browser Tab →](./tabs/BROWSER.md)

### Numerical Analysis Tabs
[Graph Tab →](./tabs/GRAPH.md)

[Table Tab →](./tabs/TABLE.md)

### Odometry Tabs
[Odometry 2D Tab →](./tabs/ODOMETRY2D.md)

[Odometry 3D Tab →](./tabs/ODOMETRY3D.md)

### External Tooling Tabs
[Scout Tab →](./tabs/SCOUT.md)

[VidSync Tab →](./tabs/VIDSYNC.md)

[Logger Tab →](./tabs/LOGGER.md) *See note*

[LogWorks Tab →](./tabs/LOGWORKS.md)

[WebView Tab →](./tabs/WEBVIEW.md)

> [!NOTE]
> The Logger tab requires a database. Without a database, the Logger is disabled. Currently, there is no way to set one up.

## Navigation

### Title Page
Click on <kbd>Create</kbd> to create a new project, or click on <kbd>Projects</kbd> to open the list of projects.
> [!NOTE]
> To return to the title page at any point while this application is open, simply click on the logo in the top left corner.

### Projects Page
Click on <kbd>Create</kbd> to create a new project. Double-clicking a project opens that project. Single clicking a project selects or unselects it. Right-clicking anywhere to open the context menu allows for editing of the selected projects. To switch between list display and grid display, simply click the list or grid icon next to the search bar. Use the search bar to filter out projects by name if needed.
> [!NOTE]
> To return to the projects page at any point while this application is open, simply click on the folder icon in the top right corner. To quickly create a project, simply click the <kbd>+</kbd> icon in the top right corner.

### Project Page
From this point forward, we will refer to the timestamp at the beginning of the log as `t0`, the timestamp at the end of the log as `t1`, and the current playback timestamp in the log to be `t`.

#### Title Bar Navigation
Clicking on the File, Edit, and View menus will open up a menu similar to the native system's file, edit, and view menus. Feel free to look at the options provided. Clicking on the project name provides more information about the project, including its name, source type, and actions relating to that source. Options listed are as follows:

- Project name input
- Save / Copy / Delete project actions
- Source selection (NT4, WPILOG, CSV-Time, CSV-Field)
- NT4:
    - IP address (without port or prefix `https://` or `ws://`)
    - Connect / Disconnect action button
- WPILOG, CSV-Time, CSV-Field:
    - File path input
    - Import action button

Clicking on the <kbd>Save</kbd> button will save the current project. The button will also display the current save status of the project as Saved, Saving, or Save (to manually save).

#### Side Bar
Consists of three submenus: Source, Browser, and Tools.

The Source submenu allows viewing of source metadata, like duration, number of fields, imported / connected state, and more.

The Browser submenu is identical to the [Browser](./tabs/BROWSER.md) tab: it lists the current topics and tables as read from the appropriate source. Any of these topics or tables can also be dragged into a Panel, which will automatically add a [Browser](./tabs/BROWSER.md) tab.

The Tools submenu is a gallery of the available tools that you can drag and drop into your panels.

#### Bottom Navigation
Consists of progress play bar and multiple actions. On the left, the <kbd>...</kbd> allows you to open more options for moving the timestamp within the log. To the right of that is the "action" button, which will play, pause, or restart the log, just like Youtube navigation! Next to that are two buttons to skip to the end and beginning of the log. Next to that are two timestamps separated by a `/`. The timestamps are formatted like so: `(t-t0) / (t1-t0)`. So, the first timestamp is the time since the beginning of the log. The second number is the total duration of the log. To the right of the progress bar is something similar, but with three separate timestamps. The format is as follows: `t0 / t / t1`. So, the first timestamp is the start of the log, the middle is the current playback position, and the final number is the end of the log.

#### Panels
The entire project consists of movable and draggable panels, each having multiple tabs. To resize them, simply drag the dividers between them. To add a tab, click the <kbd>+</kbd>. To access more features of the Panel, simply click on the <kbd>...</kbd> located in the top-right corner. You can also drag tabs out of each panel, and into other panels or drop targets like the [Table](./tabs/TABLE.md), [Graph](./tabs/GRAPH.md), [Odometry2d](./tabs/ODOMETRY2D.md), and [Odometry3d](./tabs/ODOMETRY3D.md) tabs.
