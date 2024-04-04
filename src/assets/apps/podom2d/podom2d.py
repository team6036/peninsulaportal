import math, random, time

import os, subprocess, json

import enum


CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
def random_id():
    return "".join(CHARS[math.floor(random.random()*len(CHARS))] for _ in range(10))


class POdometry2d:
    def __init__(self, *, wordy=False):
        self._wordy = wordy

        self._ID = random_id()

        self._process = None
        self._process_periodic = time.time()

        self._pipe = None
        self._pipe_periodic = time.time()

        self._robots = []
        self._queue = []

        self.start_process()

        self.open_pipe()
    
    def __del__(self):
        self.kill_process()
        self.close_pipe()
    
    @property
    def ID(self):
        return self._ID

    @property
    def wordy(self):
        return self._wordy
    @wordy.setter
    def wordy(self, v):
        self._wordy = not not v
    def log(self, *a):
        if not self.wordy:
            return
        print(f"[POdometry2d@{self.ID}]", *a)
    
    @property
    def has_active_process(self):
        return isinstance(self._process, subprocess.Popen) and self._process.poll() is None
    
    def start_process(self):
        if self.has_active_process:
            self.log("starting process", "PREEXISTING")
            return False
        self.log("starting process")
        try:
            self._process = subprocess.Popen(
                ["npm", "start", "--id", self.ID],
                cwd=os.path.split(os.path.abspath(__file__))[0],
            )
            self.log("started process")
        except Exception as e:
            self.log("starting process", "ERROR", e)
            return False
        return True
    def kill_process(self):
        if not self.has_active_process:
            self.log("killing process", "NONEXISTENT")
            return False
        self.log("killing process")
        try:
            self._process.kill()
            self.log("killed process")
        except Exception as e:
            self.log("killing process", "ERROR", e)
            return False
        return True
    def update_process(self):
        t = time.time()
        if t - self._process_periodic < 3:
            return False
        self._process_periodic = t
        if not self.has_active_process:
            self.start_process()
        return True
    
    @property
    def has_active_pipe(self):
        return isinstance(self._pipe, int)

    def open_pipe(self):
        if not self.has_active_process:
            self.log("opening pipe", "NOPROCESS")
            return False
        if self.has_active_pipe:
            self.log("opening pipe", "PREEXISTING")
            return False
        self.log("opening pipe")
        try:
            self._pipe = os.open("podom2d_"+self.ID, os.O_WRONLY)
            self.log("opened pipe")
        except Exception as e:
            self.log("opening pipe", "ERROR", e)
            return False
        return True
    def close_pipe(self):
        if not self.has_active_pipe:
            self.log("closing pipe", "NONEXISTENT")
            return False
        self.log("closing pipe")
        try:
            os.close(self._pipe)
            os.remove("podom2d_"+self.ID)
            self.log("closed pipe")
        except Exception as e:
            self.log("closing pipe", "ERROR", e)
            return False
        return True
    def update_pipe(self):
        t = time.time()
        if t - self._pipe_periodic < 1:
            return False
        self._pipe_periodic = t
        if not self.has_active_pipe:
            self.open_pipe()
        return True
    
    def update(self):
        self.update_process()
        self.update_pipe()
        self.attempt_dequeue()
    
    @property
    def robots(self):
        return [*self._robots]
    @robots.setter
    def robots(self, v):
        v = v if isinstance(v, list) else []
        self.clear()
        self.add(*v)
    def clear(self):
        robots = self.robots
        self.remove(*robots)
        return robots
    def has(self, robot):
        return robot in self._robots
    def add(self, *robots):
        for robot in robots:
            if not isinstance(robot, self.__class__.Robot):
                continue
            if robot.odometry is not self:
                continue
            if self.has(robot):
                continue
            self._robots.append(robot)
            robot.queue_change_all()
    def remove(self, *robots):
        for robot in robots:
            if not isinstance(robot, self.__class__.Robot):
                continue
            if robot.odometry is not self:
                continue
            if not self.has(robot):
                continue
            self._robots.remove(robot)
            self.queue_change(robot.ID, "rem", None)
    
    def queue_change(self, id, k, v):
        self._queue.append([id, k, v])
        self.attempt_dequeue()
    def attempt_dequeue(self):
        if not self.has_active_pipe:
            return False
        if len(self._queue) > 0:
            os.write(self._pipe, (json.dumps(self._queue)+"§§§").encode("utf-8"))
            self._queue.clear()
        return True
    
    class Robot:
        class Types(enum.Enum):
            DEFAULT = "§default"
            NODE = "§node"
            BOX = "§box"
            ARROW = "§arrow"
            ARROW_HEAD = "§head"
            ARROW_TAIL = "§tail"
            P_2023_CONE = "§2023-cone"
            P_2023_CUBE = "§2023-cube"
            P_2024_NOTE = "§2024-note"

        def __init__(self, odometry, pos=(0, 0), name="Robot", size=(1, 1), velocity=(0, 0), heading=0):
            self._ID = random_id()
            if not isinstance(odometry, POdometry2d):
                raise Exception("Odometry parameter is not of class POdometry2d")
            self._odometry = odometry

            self._type = self.__class__.Types.DEFAULT

            self._x = self._y = 0
            self._name = ""
            self._w = self._h = 0
            self._velocity_x = self._velocity_y = 0
            self._show_velocity = False
            self._heading = 0

            self._color = "b"

            self.pos = pos
            self.name = name
            self.size = size
            self.heading = heading
            self.velocity = velocity

            self.odometry.add(self)
        
        @property
        def ID(self):
            return self._ID
        @property
        def odometry(self):
            return self._odometry
        
        # TYPE
        @property
        def type(self):
            return self._type
        @type.setter
        def type(self, v):
            if not isinstance(v, self.__class__.Types):
                v = self.__class__.Types.DEFAULT
            self._type = v
            self.queue_change("type", self.type.value)
        
        # POS
        @property
        def x(self):
            return self._x
        @x.setter
        def x(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.x == v:
                return
            self._x = v
            self.queue_change("x", self.x)
        @property
        def y(self):
            return self._y
        @y.setter
        def y(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.y == v:
                return
            self._y = v
            self.queue_change("y", self.y)
        @property
        def pos(self):
            return (self.x, self.y)
        @pos.setter
        def pos(self, v):
            v = v if isinstance(v, tuple) and len(v) == 2 else (0, 0)
            self.x, self.y = v
        
        # NAME
        @property
        def name(self):
            return self._name
        @name.setter
        def name(self, v):
            v = str(v)
            if self.name == v:
                return
            self._name = v
            self.queue_change("name", self.name)
        
        # SIZE
        @property
        def w(self):
            return self._w
        @w.setter
        def w(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.w == v:
                return
            self._w = v
            self.queue_change("w", self.w)
        @property
        def h(self):
            return self._h
        @h.setter
        def h(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.h == v:
                return
            self._h = v
            self.queue_change("h", self.h)
        @property
        def size(self):
            return (self.w, self.h)
        @size.setter
        def size(self, v):
            v = v if isinstance(v, tuple) and len(v) == 2 else (0, 0)
            self.w, self.h = v

        # VELOCITY
        @property
        def velocity_x(self):
            return self._velocity_x
        @velocity_x.setter
        def velocity_x(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.velocity_x == v:
                return
            self._velocity_x = v
            self.queue_change("velocity_x", self.velocity_x)
        @property
        def velocity_y(self):
            return self._velocity_y
        @velocity_y.setter
        def velocity_y(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.velocity_y == v:
                return
            self._velocity_y = v
            self.queue_change("velocity_y", self.velocity_y)
        @property
        def velocity(self):
            return (self.velocity_x, self.velocity_y)
        @velocity.setter
        def velocity(self, v):
            v = v if isinstance(v, tuple) and len(v) == 2 else (0, 0)
            self.velocity_x, self.velocity_y = v
        @property
        def show_velocity(self):
            return self._show_velocity
        @show_velocity.setter
        def show_velocity(self, v):
            v = not not v
            if self.show_velocity == v:
                return
            self._show_velocity = v
            self.queue_change("show_velocity", self.show_velocity)

        # HEADING
        @property
        def heading(self):
            return self._heading
        @heading.setter
        def heading(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.heading == v:
                return
            self._heading = v
            self.queue_change("heading", self.heading)
        
        # COLOR
        @property
        def color(self):
            return self._color
        @color.setter
        def color(self, v):
            v = str(v)
            if self.color == v:
                return
            self._color = v
            self.queue_change("color", self.color)

        def queue_change(self, k, v):
            self.odometry.queue_change(self.ID, k, v)
        def queue_change_all(self):
            self.queue_change("type", self.type.value)
            self.queue_change("x", self.x)
            self.queue_change("y", self.y)
            self.queue_change("name", self.name)
            self.queue_change("w", self.w)
            self.queue_change("h", self.h)
            self.queue_change("velocity_x", self.velocity_x)
            self.queue_change("velocity_y", self.velocity_y)
            self.queue_change("show_velocity", self.show_velocity)
            self.queue_change("heading", self.heading)
            self.queue_change("color", self.color)
