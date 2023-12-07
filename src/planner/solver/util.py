from constants import l
import casadi as ca
import math

def corners(theta):
    c = ca.cos(theta)
    s = ca.sin(theta)

    return [rotate(-l*math.sqrt(2), l*math.sqrt(2), c, s),
            rotate(l*math.sqrt(2), l*math.sqrt(2),  c, s),
            rotate(-l*math.sqrt(2), -l*math.sqrt(2), c, s),
            rotate(l*math.sqrt(2), -l*math.sqrt(2), c, s)]

def rotate(x, y, c, s):
    return [x * c - y * s, y * c + x * s]

def interpolate(t0, t1, t2, a, b):
    w = (t1 - t0) / (t2 - t0)
    return a * (1 -w) + b * (w)

def split_even_dt(dts, way_i, x, y, theta):
    timestamp = [0]
    for i in range(1, len(way_i)):
        from_i = way_i[i - 1]
        to_i = way_i[i]
        dt_seg = dts[i-1]
        for j in range(from_i, to_i):
            timestamp.append(timestamp[-1] + dt_seg)

    split_dt = 0.02

    split_x = []
    split_y = []
    split_theta = []

    time = 0
    i = 0

    while (i < way_i[-1]):
        if (time >= timestamp[i] and time <= timestamp[i+1]):
            split_x.append(interpolate(timestamp[i], time, timestamp[i+1], x[i], x[i+1]))
            split_y.append(interpolate(timestamp[i], time, timestamp[i+1], y[i], y[i+1]))
            split_theta.append(interpolate(timestamp[i], time, timestamp[i+1], theta[i], theta[i+1]))
            time += split_dt
        else:
            i+=1

    return [split_x, split_y, split_theta]
