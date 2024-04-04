import time, math

from podom2d import POdometry2d

odom2d = POdometry2d(wordy=True)

robot = POdometry2d.Robot(odom2d, (4, 3), "I-Hate-This-So-Much", (2, 0.5), (2, 1), math.pi/4)
# robot.show_velocity = True
robot.type = POdometry2d.Robot.Types.P_2024_NOTE
robot.color = "o"

while True:
    odom2d.update()
    time.sleep(1/60)
    robot.pos = (math.cos(math.pi*time.time())*1+4, math.sin(math.pi*time.time())*2+3)
