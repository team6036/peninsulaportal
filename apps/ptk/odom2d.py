import time

import enum

import ptk.util as util


class Odometry2d(util.Process):
    def __init__(self, *, wordy=False):
        super().__init__(name="Odometry2d", key="ptk_odom2d", wordy=wordy)

        self._robots = []
        self._robots_periodic = time.time()
    
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
            self.queue_command("add", robot.ID)
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
            self.queue_command("rem", robot.ID)
    
    def queue_command(self, name, *a):
        return self.queue([name, *a])
    def queue_change(self, id_, k, v):
        return self.queue_command("c", id_, k, v)
    def queue_change_all(self):
        for robot in self._robots:
            robot.queue_change_all()
        
    def update(self):
        super().update()
        t = time.time()
        if t - self._robots_periodic < 1:
            return
        self.log("flash")
        self._robots_periodic = t
        self.queue_change_all()
    
    class Robot:
        class Types(enum.Enum):
            DEFAULT = "§default"
            NODE = "§node"
            BOX = "§box"
            ARROW = "§arrow"
            ARROW_HEAD = "§arrow-h"
            ARROW_TAIL = "§arrow-t"
            P_2023_CONE = "§2023-cone"
            P_2023_CUBE = "§2023-cube"
            P_2024_NOTE = "§2024-note"

        def __init__(self, odometry, *, pos=(0, 0), size=(1, 1), velocity=(0, 0), heading=0):
            self._ID = util.random_id()
            if not isinstance(odometry, Odometry2d):
                raise Exception("Odometry parameter is not of class Odometry2d")
            self._odometry = odometry

            self._type = self.__class__.Types.DEFAULT

            self._x = self._y = 0
            # self._name = ""
            self._w = self._h = 0
            self._velocity_x = self._velocity_y = 0
            self._show_velocity = False
            self._heading = 0

            self._color = "b"

            self.pos = pos
            # self.name = name
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
            self.queue_change("type")
        
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
            self.queue_change("x")
        @property
        def y(self):
            return self._y
        @y.setter
        def y(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.y == v:
                return
            self._y = v
            self.queue_change("y")
        @property
        def pos(self):
            return self.x, self.y
        @pos.setter
        def pos(self, v):
            v = v if isinstance(v, tuple) and len(v) == 2 else (0, 0)
            self.x, self.y = v
        
        # NAME
        # @property
        # def name(self):
        #     return self._name
        # @name.setter
        # def name(self, v):
        #     v = str(v)
        #     if self.name == v:
        #         return
        #     self._name = v
        #     self.queue_change("name")
        
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
            self.queue_change("w")
        @property
        def h(self):
            return self._h
        @h.setter
        def h(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.h == v:
                return
            self._h = v
            self.queue_change("h")
        @property
        def size(self):
            return self.w, self.h
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
            self.queue_change("velocity_x")
        @property
        def velocity_y(self):
            return self._velocity_y
        @velocity_y.setter
        def velocity_y(self, v):
            v = v if isinstance(v, int) or isinstance(v, float) else 0
            if self.velocity_y == v:
                return
            self._velocity_y = v
            self.queue_change("velocity_y")
        @property
        def velocity(self):
            return self.velocity_x, self.velocity_y
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
            self.queue_change("show_velocity")

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
            self.queue_change("heading")
        
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
            self.queue_change("color")

        def queue_change(self, k):
            k = str(k)
            v = getattr(self, k)
            if isinstance(v, enum.Enum):
                v = v.value
            return self.odometry.queue_change(self.ID, k, v)
        def queue_change_all(self):
            [self.queue_change(k) for k in [
                "type",
                "x", "y",
                # "name",
                "w", "h",
                "velocity_x", "velocity_y",
                "show_velocity",
                "heading",
                "color",
            ]]
