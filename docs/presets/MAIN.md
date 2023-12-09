<a href="../../README.md" class="back">← Back</a>

<div>
    <h1 id="peninsula-presets" align="center">Peninsula Presets</h1>
    <p align="center">Settings for Peninsula Portal</p>
</div>

### Version
The version of the application. The application version is usually written like so:
```
<year>.<major>.<patch>
```
Additionally, tags can be added to the version like so:
```
<year>.<major>.<patch>-<tag>
```
If you currently actively developing this application, an additional `-dev` tag will be applied to the version. It will not be considered interally and is entirely for visual comprehension.

## Application Data

### Application Data Directory
The location where any data stored within the application is located on the computer.
- Windows: `%APPDATA%`
- MacOS: `~/Library/Application Support/`
- Linux: `$XDG_CONFIG_HOME` or `~/.config`  

More information can be found on [Electron's documentation](https://www.electronjs.org/docs/latest/api/app#appgetpathname).

### Application Log Directory
The location where any logs are stored for the application, a subset of the app data directory called `./logs`.

### Database Host URL
The url of which is fetched to obtain globalized data for the application, such as configurations, templates, robots, themes, and holidays. The structure of the database is as follows:
```js
| config.json // contains redirect url + holiday
| templates.json // for ./templates dir
| robots.json // for ./robots dir
| themes.json // for ./themes dir
| holidays.json // for ./holidays dir
+ <feature-name> // different for each feature
| ...
```
Repolling the database will pull what it needs from this database, though assets are pulled from a different database.

### Database Assets URL
The url of which is fetched to obtain globalized assets for the application, such as 3D models, images, etc. The current structure is based on Github Releases and hence, please check the assets repo at the bottom of this page.

### Competition Mode
Toggling competition mode on disables polling of database, if constant repolling or rewriting of existing files causes lag.

## Appearance

### Theme
The current application theme. Feel free to pick from the list supplied.

### Holiday
The current application holiday!

### Data Root Directory
The directory where each feature's `projects.json` and `projects/*.json`s are stored. This mainly applies for [Panel](../panel/MAIN.md) and [Planner](../planner/MAIN.md), and other features do not apply.
