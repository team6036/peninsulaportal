<a href="../MAIN.md" class="back">← Back</a>

# Graph Tab

Graphs numerical and discrete fields from the log source. Includes range selection along any point of the graph.

## Navigation

### Main Display
Shows graph of fields between wanted timestamps. Hovering over a line will show the value of the line at that timestamp. If multiple lines intersect, clicking <kbd>tab</kbd> will toggle between overlapping data points. Additionally, also shows the current hovering timestamp and the global project timestamp within the log source. Clicking anywhere on the graph will set the project timestamp within the log source to the hovered timestamp. Scrolling here will zoom in or out on the graph about the hovered timestamp. Holding <kbd>shift</kbd> down will show ALL values at the hovered timestamp, even if you are not hovering over the line exactly. Right-clicking and dragging will create a time-delta measurement and will show the value of the hovered line at the beginning and at the end. This works with the <kbd>shift</kbd> key, as holding it down will show ALL graphed values at the beginning and end.

### Options Menu
Below the main display is the options menu. It has a small thumb button, which you can drag or click. Dragging allows you to either close it completely, open it halfway over the main display, or have it cover the display entirely.

The menu consists of three sections: left axis, viewing window, and right axis.

#### Left Axis
You can drag topics or tables into this section from the sidebar or the [Browser](../tabs/BROWSER.md) tab. The topics dragged here will be graphed on the left axis. Clicking on the dot next to each topic toggles its visibility. Clicking the <kbd>x</kbd> button removes the topic from the graph. If the topic is crossed out and semi-transparent, that means there was no data found to graph. Clicking on the topic will also open an extensive menu including:
- Color selection
- Ghost (transparency) toggle
- Hooks:
    - Visibility hook
    - Ghost hook
- Expression mapping

**Hooks** —
Hooks are a way to attach a boolean topic to a boolean option. So, you can have a graphed field hide itself when another field contains the value `true`, or have it be semi-transparent.

**Expression Mapping** —
Expressions are a way to change the graphed values without actually editing the log file. This text input field expects you to input a math expression, with the active variable being `x`. For example, some proper expressions can be `x^2` or `abs(x)`. This would apply the appropriate mathematical operation to all values being graphed.

#### View Window
You can select your view window here. There are four options available:
- **All**  
    Views entire graph from `t0` to `t1`
- **Section**  
    Gives you the ability to select a viewing range from the secified beginning to the specified end. Feel free to change the units if necessary.
- **Right**  
    This view mode has two separate behaviors depending on whether or not you are using the playback pointer or the log itself.  
    **Log End**: Views log from `t1-x` to `t1` where `x` is the backwards view time. Essentially, viewing the "right" side of the log.  
    **Pointer**: Views log from `t` to `t+x` where `x` is the forward view time. Essentially, viewing to the "right" of the pointer.  
- **Left**  
    Similar to the right view mode, with two different behaviors.
    **Log Start**: Views log from `t0` to `t0+x` where `x` is the forward view time. Essentially, viewing the "left" side of the log.  
    **Pointer**: Views log from `t-x` to `t` where `x` is the backward view time. Essentially, viewing to the "left" of the pointer.  

There is also an option to apply this specific view window to all graph tabs.

#### Right Axis
See [Left Axis](#left-axis)
