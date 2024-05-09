<a href="../MAIN.md" class="back">← Back</a>

# Odometry 2D Tab

Displays parsable poses located within the log, including additional debug features.

## Navigation

### Main Display
Shows the graphed poses on the field.

### Options Menu
Below the main display is the options menu. It has a small thumb button, which you can drag or click. Dragging allows you to either close it completely, open it halfway over the main display, or have it cover the display entirely.

The menu consists of three sections: poses, field selection, and the more options.

#### Poses
You can drag topics into this section from the sidebar or the [Browser](../tabs/BROWSER.md) tab. Clicking on the dot next to each topic toggles its visibility. Clicking the <kbd>x</kbd> button removes the topic from the field. If the topic is crossed out and semi-transparent, that means there was no data found to graph or there was an error. Hover over the yellow warning sign to find out more. Clicking on the topic will also open an extensive menu including:
- Color selection
- Ghost (transparency) toggle
- Hooks:
    - Visibility hook
    - Ghost hook
- Trail customization
- Display type selection

**Hooks** —
Hooks are a way to attach a boolean topic to a boolean option. So, for example, you can have a pose hide itself when another field contains the value `true`, or have it be semi-transparent.

**Trails** —
Trails are a way to show the path of the specified pose. Simply enable the toggle, then input the lookback time - aka the time into the past that the trail will display.

**Display Types** —
Available types include:
- Default
- Node
- Box
- Arrow (Centered)
- Arrow (Head centered)
- Arrow (Tail centered)

There are also year-specific game piece types.

#### Field
Select the wanted field template from the menu, or select a blank field to customize the field and robot size.

#### Options
- **Quality**  
    The rendering quality of the canvas used.
    - **High (4x)** — canvas dimensions are doubled, so 4 times the number of pixels
    - **Low (1x)** — canvas dimensions are unaltered
- **Length Units**  
    Units used for all lengths, including coordinates
    - Meters
    - Centimeters
    - Yards
    - Feet
- **Angle Units**  
    Units used for all angles
    - Degrees
    - Radians
    - Cycles (2π = 360° = 1 cycle)
- **Origin**  
    Origin of field, automatically converts poses
    - **+Blue** — Bottom left
    - **-Blue** — Top left
    - **+Red** — Bottom right
    - **-Red** — Top right
