import math
import random
import time

import os
import subprocess
import json


CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
def random_id(l=10):
    return "".join(CHARS[math.floor(random.random()*len(CHARS))] for _ in range(l))


class Process:
    def __init__(self, *, name, key, wordy=False):
        self._ID = random_id()

        self._name = str(name)
        self._key = str(key)

        self._wordy = wordy

        self._process = None
        self._process_periodic = time.time()

        self._pipe = None
        self._pipe_periodic = time.time()

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
    def name(self):
        return self._name
    @property
    def key(self):
        return self._key

    @property
    def wordy(self):
        return self._wordy
    @wordy.setter
    def wordy(self, v):
        self._wordy = not not v
    def log(self, *a):
        if not self.wordy:
            return
        print(f"[{self.name}@{self.ID}]", *a)

    @property
    def has_active_process(self):
        return isinstance(self._process, subprocess.Popen) and self._process.poll() is None
    def start_process(self):
        if self.has_active_process:
            self.log("starting process", "PREEXISTING")
            return False
        self.log("starting process")
        try:
            print(os.path.split(os.path.abspath(__file__))[0])
            self._process = subprocess.Popen(
                ["npm", "start", f"key={self.key}", f"id={self.ID}"],
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
            self._pipe = os.open(os.path.join(os.path.split(os.path.abspath(__file__))[0], f"._{self.key}_{self.ID}"),
                                 os.O_WRONLY)
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
            os.remove(os.path.join(os.path.split(os.path.abspath(__file__))[0], f"._{self.key}_{self.ID}"))
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

    def queue(self, data):
        self._queue.append(data)
        self.attempt_dequeue()
    def attempt_dequeue(self):
        if not self.has_active_pipe:
            return False
        if len(self._queue) > 0:
            os.write(self._pipe, (json.dumps(self._queue)+"§§§").encode("utf-8"))
            self._queue.clear()
        return True
