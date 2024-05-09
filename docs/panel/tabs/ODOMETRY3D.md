<a href="../MAIN.md" class="back">← Back</a>

# Odometry 3D Tab

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
- Solid (single color) toggle
- Hooks:
    - Visibility hook
    - Ghost hook
    - Solid hook
- Display type selection
- Components (if applicable)

**Hooks** —
Hooks are a way to attach a boolean topic to a boolean option. So, for example, you can have a pose hide itself when another field contains the value `true`, or have it be semi-transparent.

**Display Types** —
Available types include:
- Node
- Cube
- Arrow (+X)
- Arrow (-X)
- Arrow (+Y)
- Arrow (-Y)
- Arrow (+Z)
- Arrow (-Z)

There are also year-specific game piece types.

**Components** —
Similar to hooks, but instead, you drag in pose topics into the field, so that they are applied to each component of the robot.

#### Field
Select the wanted field template from the menu, or select a blank field.

#### Options
- **View Type**  
    The camera type for viewing
    - **Projection** — classic 3d projection camera
    - **Isometric** - isometric (no depth) 3d camera
- **Control Type**  
    The camera control type for manipulation of perspective
    - **Orbit** — Simple orbit controls: drag using left mouse to orbit around the field center. Scroll to zoom in or out
    - **Free** — Unlocked camera controls, similar to Minecraft: click on the field to lock your mouse, then use keys to move.
        - <kbd>W</kbd>/<kbd>↑</kbd> - forward
        - <kbd>S</kbd>/<kbd>↓</kbd> - backward
        - <kbd>A</kbd>/<kbd>←</kbd> - left
        - <kbd>D</kbd>/<kbd>→</kbd> - right
        - <kbd>Space</kbd> - up
        - <kbd>LeftShift (⇧L)</kbd> - down
        - Double clicking any of the keys above will cause you to move double normal speed
        - <kbd>RightShift (⇧R)</kbd> - holding down this key will make you move 20% normal speed
    - **Pan** — Similar to orbit controls, but slightly altered. Use left mouse to move the field around, use right mouse to rotate, and use scroll to zoom in or out
- **Cinematic**  
    Toggles fancier lighting
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

    See [Odometry2d](../tabs/ODOMETRY2D.md) for the better explanation of which corner is which
- **Camera Position**  
    The input box for manually configuring a camera position on the field. This coordinate system is different from the pose system, with (0, 0) being the center of the field.
- **Camera Position Hook**  
    The hook for the camera position. Toggling off the lock will ensure that all your actions within the camera controls, such as moving around, zooming in / out, will always be relative to the specified pose. However, toggling on the lock will prevent all user actions, ensuring that the camera is always exactly where the pose specifies it to be.
