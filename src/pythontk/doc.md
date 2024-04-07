<h1 id="util">ptk.util</h1>

<h1 id="util.classes">Classes</h1>

<h1 id="util.classes.Process">Class: <code>Process</code></h1>

> Initiate one-way interprocess communications with a JS script

<br>

**`Process(*, name, key, wordy=False)`**
- `name` (`str`) - the display name of the process when logging, if `wordy`
- `key` (`str`) - the key (aka programmic name) of the process used when creating and naming the stream
- `wordy` (`bool`) - whether or not the object should continuously log

## Instance Properties

---

**`process.ID` (`str`) — <kbd>get</kbd>**

A unique 10-long string made up of alphanumeric characters (uppercase, lowercase, and numbers), specific to each process. There is no checking for whether any overlapping ids will be generated, but the probability of collision is low

---

**`process.name` (`str`) — <kbd>get</kbd>**

The display name of the process, shown when logging and `wordy`

---

**`process.key` (`str`) — <kbd>get</kbd>**

The key (aka programmic name) of the process used when creating and naming the stream created to communicate with JS. Usually indicates the type of process you are making.

---

**`process.wordy` (`bool`) — <kbd>get</kbd> <kbd>set</kbd>**

Whether or not the process should log its actions while completing them.

---

**`process.has_active_process` (`bool`) — <kbd>get</kbd>**

Whether or not the process has an active internal `subprocess.Popen` process.

---

**`process.has_active_pipe` (`bool`) — <kbd>get</kbd>**

Whether or not the process has an active `os.open` pipe. Does not matter whether or not the JS process is connected.

<br>

## Instance Methods

---

**`process.start_process()` → `bool`**

Attempts to start the internal process. Will return `False` if there exists an internal process (based on `process.has_active_process`) or an error occured when starting. Will return `True` if the internal process started successfully.

---

**`process.kill_process()` → `bool`**

Attempts to kill the internal process. Will return `False` if there doesn't exists an internal (based on `process.has_active_pipe`) or an error occured when killing the process. Will return `True` if the process died successfully.  

> [!NOTE]
> This method is run when the object is out of scope, aka the `__del__` dunder method is called, to avoid memory leaks

---

**`process.update_process()` → `bool`**

Runs the automatic process restart if necessary. Using an internal timer, every 3 seconds, it will check whether or not the interal process has died. If so, it will attempt to restart it. Will return `True` if an attempted restart was done, and `False` otherwise.

---

**`process.open_pipe()` → `bool`**

Attempts to open the IPC pipe. Will return `False` if there exists an open pipe (based on `process.has_active_pipe`) or an error occured when opening. Will return `True` if the pipe opened successfully.

---

**`process.close_pipe()` → `bool`**

Attempts to close the IPC pipe. Will return `False` if there doesn't exists an open pipe (based on `process.has_active_pipe`) or an error occured when closing. Will return `True` if the pipe closed successfully.  

> [!NOTE]
> This method is run when the object is out of scope, aka the `__del__` dunder method is called, to avoid memory leaks

---

**`process.update_pipe()` → `bool`**

Runs the automatic pipe reopen if necessary. Using an internal timer, every second, it will check whether or not the pipe has closed. If so, it will attempt to reopen it. Will return `True` if an attempted reopen was done, and `False` otherwise.

---

**`process.update_pipe_poll()` → `bool`**

Runs the automatic pipe polling if possible. Using an internal timer, every 0.5s, it send a `"poll"` message packet through the pipe. Returns `True` if attempted poll, and `False` otherwise.

---

**`process.queue(data)` → `bool`**
- `data` (`any`) - the queued data packet

Pushes the data packet to the message queue. It will call the `attempt_dequeue()` method, so that the message is sent as soon as possible. The return value of that call is passed through this method.

---

**`process.attempt_dequeue()` → `bool`**

Attempts to dequeue the message queue. If no pipe exists (as per `process.has_active_pipe`), it will return `False`. Otherwise, it will send all existing packets through, and return `True`.

---

**`process.update()` → `None`**

Updates all internal processes. Run this somewhat frequently within your program, depending on how often you want message dequeueing to occur. Will also run `update_process()` and `update_pipe()`.

<br>

<h1 id="util.methods">Methods</h1>

<h1 id="util.methods.random_id">Method: <code>random_id</code></h1>

**`random_id(l=10)` → `str`**
- `l` (`int`) - length of the output id

Generates a string of length `l` full of random alphanumeric characters. This includes the alphabet in upper and lowercase, and numbers. I understand this means the character set is 62 characters instead of 64. I know. But to prevent potential issues with transfering the id through CLI, `-`s were omitted. This makes 63, but to make the set of characters "more rounded," I just got rid of `_`, another common character in base64, to make it purely alphanumeric. I could not include `=` as it is used for key-value detection.

<br>

<h1 s0 id="odom2d">ptk.Odometry2d</h1>

<h1 id="odom2d.classes">Classes</h1>

<h1 id="odom2d.classes.Odometry2d">Class: <code>Odometry2d</code></h1>

*Child of `util.Process`*

> Odometry2d display API

<br>

**`Odometry2d(*, wordy=False)`**
- `wordy` (`bool`) - passed through to `util.Process`

## Instance Properties

---

**`odometry.robots` (`list[Odometry2d.Robot]`) — <kbd>get</kbd> <kbd>set</kbd>**

The currently listed robots to be displayed by the odometry widget.

## Instance Methods

---

**`odometry.clear()` → `list[Odometry2d.Robot]`**

Clears the robot list and returns the original.

---

**`odometry.has(robot)` → `bool`**
- `robot` (`Odometry2d.Robot`) - the robot to check for existence

Checks whether or not `robot` exists in the robot list.

---

**`odometry.add(*robots)` → `None`**
- `robots` (`list[Odometry2d.Robot]`) - the arguments passed in, which must all be robots

Adds the robots to the robot list if possible.  

> [!IMPORTANT]
> Attempting to use `odometry.robots.append(robot)` will not work

---

**`odometry.remove(*robots)` → `None`**
- `robots` (`list[Odometry2d.Robot]`) - the arguments passed in, which must all be robots

Removes the robots from the robot list if possible.  

> [!IMPORTANT]
> Attempting to use `odometry.robots.remove(robot)` will not work

---

**`odometry.queue_command(name, *a)` → `bool`**
- `name` (`str`) - the command name to be sent
- `a` (`list[any]`) - the arguments to be received as a part of the command

Queues a command with specified arguments into the message queue. The return value of `odometry.queue()` will be passed through and returned.

---

**`odometry.queue_change(id, k, v)` → `bool`**
- `id` (`str`) - the id of the robot to be changed
- `k` (`str`) - the attribute of the robot to be changed
- `v` (`any`) - the new value of that attribute

Queues a change command (`"c"`) into the message queue, which requests that the `id` robot's `k` attribute to be set to `v`. The return value of `odometry.queue_command()` will be passed through and returned.

---

**`odometry.queue_change_all()` → `None`**

Queues all change commands of every attribute from every robot in the list. Essentially calls `robot.queue_change_all()` on every robot.

---

**`odometry.update()` → `None`**

Updates the superclass and also does periodic flashing of the existing robots. Every second, `odometry.queue_change_all()` is run to ensure that if messages are dropped in the JS process, resulting in desync, they will be fixed as soon as possible.

<br>

<h1 id="odom2d.classes.Odometry2d.Robot">Class: <code>Odometry2d.Robot</code></h1>

> Robot of the Odometry2d display API

<br>

**`Odometry2d.Robot(odometry, *, pos=(0, 0), size=(1, 1), velocity=(0, 0), heading=0)`**
- `odometry` (`Odometry2d`) - the parent odometry object of the robot. Will automatically call `odometry.add()`
- `pos` (`tuple[number, number]`) - the position of the robot, in meters
- `size` (`tuple[number, number]`) - the size of the robot, in meters
- `velocity` (`tuple[number, number]`) - the velocity of the robot, in meters
- `heading` (`number`) - the heading of the robot, in radians

## Static Properties

---

**`Odometry2d.Robot.Types` (`Enum`)**
- `DEFAULT` - default display
- `NODE` - node display (only the center of `DEFAULT`)
- `BOX` - box display (only the border of `DEFAULT`)
- `ARROW` - arrow
- `ARROW_HEAD` - arrow centered by head
- `ARROW_TAIL` - arrow centered by tail
- `P_2023_CONE` - 2023's cone piece
- `P_2023_CUBE` - 2023's cube piece
- `P_2024_NOTE` - 2024's note piece

## Instance Properties

---

**`robot.ID` (`str`) — <kbd>get</kbd>**

A unique 10-long string made up of alphanumeric characters (uppercase, lowercase, and numbers), specific to each robot. There is no checking for whether any overlapping ids will be generated, but the probability of collision is low

---

**`robot.odometry` (`Odometry2d`) — <kbd>get</kbd>**

The parent odometry of the robot. There is no way to change this.

---

**`robot.type` (`Odometry2d.Robot.Types`) — <kbd>get</kbd> <kbd>set</kbd>**

The type of the robot display. See the enum for more info, or try it out yourself!

---

**`robot.x` (`number`) — <kbd>get</kbd> <kbd>set</kbd>**

The x position of the robot, in meters.

**`robot.y` (`number`) — <kbd>get</kbd> <kbd>set</kbd>**

The y position of the robot, in meters.

**`robot.pos` (`tuple[number, number]`) — <kbd>get</kbd> <kbd>set</kbd>**

The position of the robot in the form (`x`, `y`).

---

**`robot.w` (`number`) — <kbd>get</kbd> <kbd>set</kbd>**

The width of the robot, in meters.

**`robot.h` (`number`) — <kbd>get</kbd> <kbd>set</kbd>**

The height of the robot, in meters.

**`robot.size` (`tuple[number, number]`) — <kbd>get</kbd> <kbd>set</kbd>**

The size of the robot in the form (`w`, `h`).

---

**`robot.velocity_x` (`number`) — <kbd>get</kbd> <kbd>set</kbd>**

The x velocity of the robot, in meters/second.

**`robot.velocity_y` (`number`) — <kbd>get</kbd> <kbd>set</kbd>**

The y velocity of the robot, in meters/second.

**`robot.velocity` (`tuple[number, number]`) — <kbd>get</kbd> <kbd>set</kbd>**

The velocity of the robot in the form (`x`, `y`).

**`robot.show_velocity` (`bool`) — <kbd>get</kbd> <kbd>set</kbd>**

Whether or not to show the velocity arrow in the display.

---

**`robot.heading` (`number`) — <kbd>get</kbd> <kbd>set</kbd>**

The heading of the robot, in radians.

---

**`robot.color` (`str`) — <kbd>get</kbd> <kbd>set</kbd>**

The color of the robot. This can be from any of the strings below:
- `"r"` - red
- `"o"` - orange
- `"y"` - yellow
- `"g"` - green
- `"c"` - cyan
- `"b"` - blue
- `"p"` - purple
- `"m"` - magenta

## Instance Methods

---

**`robot.queue_change(k)` → `bool`**
- `k` (`str`) - the attribute to be changed

Queues a change command into the `robot.odometry`'s message queue, which requests that the this robot's `k` attribute to be set to `getattr(self, k)`. The return value of `odometry.queue_change()` will be passed through and returned.

---

**`robot.queue_change_all()` → `None`**

Queues change commands of every attribute. The list includes all the mentioned <kbd>set</kbd>-able properties from above.
