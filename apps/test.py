import time
import math

import ptk

odom2d = ptk.Odometry2d(wordy=True)

robot = ptk.Odometry2d.Robot(odom2d, (4, 3), "I-Hate-This-So-Much", (2, 0.5), (2, 1), math.pi/4)
# robot.show_velocity = True
robot.type = ptk.Odometry2d.Robot.Types.P_2024_NOTE
robot.color = "o"

while True:
    odom2d.update()
    time.sleep(1/60)
    robot.pos = (math.cos(math.pi*time.time()/3)*1+4, math.sin(math.pi*time.time()/3)*2+3)
