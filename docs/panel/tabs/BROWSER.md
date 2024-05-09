<a href="../MAIN.md" class="back">← Back</a>

# Browser Tab

Views any table or topic, similar to your operating system's file explorer.

## Navigation

### Top Navigation Bar
Consists of the path to your topic. Clicking on different parts of the path can take you to different parent tables. Clicking on the <kbd><</kbd> brings you up one table.

### Tab Body
Depending on which path you have open, the tab body will look different.

If you have a table open, it will show a browser with all the subtables and subtopics displayed in list fashion, sorted by name. If you click on a subtopic, it will show the value of that topic currently. Double-clicking on a subtopic or subtable will "enter" that subfield. You can also drag fields out from this tab.

If you have a topic open, it will show a graphic display of the value. To edit how this display looks, click on the <kbd>...</kbd> in the top right corner of the display. It should be automatically set to default, meaning the display adapts based on the type of the topic being shown. For example, by default, boolean topics are shown as the "Boolean" type. Normally, it defaults to "Raw." Here is a list of the available display types and their functions:

- **Raw**  
    Displays the raw value of the topic as text. Will color as necessary, depending on what the expected color of the type and value should be. For example, blue for numbers, yellow for strings, green for `true`, and red for `false`.
- **Boolean**  
    Displays a green checkmark for truthy values and a red cross for falsy values. Obviously, `true` is truthy, `false` is falsy. But `0` is falsy as well, while all other numbers are truthy. This relies on Javascript's [truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy) and [falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy) evaluations.
- **Speedometer**  
    Using a circular range format with customizable minimum and maximum to display a number. Will work with booleans, as they cast to 0 and 1.
- **Horizontal Range**  
    Using a horizontally oriented range format - functions identically to the speedometer.
- **Vertical Range**  
    Using a vertically oriented range format - functions identically to the speedometer.

> [!NOTE]
> This tab can be dragged out of the panel, and functions *identically* to just dragging out a topic or table from the side menu.
