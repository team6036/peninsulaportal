import json
import casadi as ca
import numpy as np
from system import apply_dynamics, apply_kinematics, apply_kinematics2
import math
from constants import *
import constants
from motor import *
import motor
from util import *

######### READ FILE ###########
with open('data.in', 'r') as file:
    data = json.load(file)

obx = [obstacle['x'] for obstacle in data['obstacles']]
oby = [obstacle['y'] for obstacle in data['obstacles']]
obr = [obstacle['radius'] for obstacle in data['obstacles']]

w_x = [node['x'] for node in data['nodes']]
w_y = [node['y'] for node in data['nodes']]
w_theta = []

ct = 25

config = data['config']
map_w = config['map_w']
map_h = config['map_h']

N = ct * len(w_x) - ct #control points

opti = ca.Opti()

T = 0

x_n = 6 #state vars [x, y, theta, x_dot, y_dot, theta_dot]
u_n = 8 #input vars [F1x, F2x, F3x, F4x, F1y, F2y, F3y, F4y]
X = opti.variable(N+1, x_n)
U = opti.variable(N+1, u_n)

def override_velo(i, vx, vy, vt):
    opti.subject_to(X[i, 3] == vx)
    opti.subject_to(X[i, 4] == vy)
    opti.subject_to(X[i, 5] == vt)

way_i = np.linspace(0, N, len(w_x))
way_i = way_i.astype(int)

percents = []

guess = []

i = 0
for node in data['nodes']:
    if node['vx'] is not None and node['vy'] is not None:
        override_velo(i * ct, node['vx'], node['vy'], node['vt'])
    if node['theta'] is not None:
        opti.subject_to(ca.cos(X[way_i[i], 2]) * math.sin(node['theta']) - ca.sin(X[way_i[i], 2]) * math.cos(node['theta']) == 0)
        w_theta.append(node['theta'])
    else:
        w_theta.append(w_theta[-1])

    if 'guess' in node and node['guess']:
        guess.append(True)
    else:
        guess.append(False)

    if 'theta_v' in node:
        opti.subject_to(X[way_i[i], 5] == 0)

    if 'percent' in node:
        percents.append(node['percent'])
    else:
        percents.append(1)
    i+=1


#Value constraints
for i in range(N+1):
    for o in range(len(obx)):
        c = corners(X[i, 2])
        x = X[i, 0]
        y = X[i, 1]

        opti.subject_to((X[i, 0] + c[0][0] - obx[o])**2 + (X[i, 1] + c[0][1] - oby[o])**2 > obr[o]**2)
        opti.subject_to((X[i, 0] + c[1][0] - obx[o])**2 + (X[i, 1] + c[1][1] - oby[o])**2 > obr[o]**2)
        opti.subject_to((X[i, 0] + c[2][0] - obx[o])**2 + (X[i, 1] + c[2][1] - oby[o])**2 > obr[o]**2)
        opti.subject_to((X[i, 0] + c[3][0] - obx[o])**2 + (X[i, 1] + c[3][1] - oby[o])**2 > obr[o]**2)

for i in range(0, len(w_x)):
    if not guess[i]:
        opti.subject_to(X[way_i[i], 0] == w_x[i])
        opti.subject_to(X[way_i[i], 1] == w_y[i])

dts = []
initDt = 4.95/ct

for i in range(1, len(way_i)):
    from_i = way_i[i - 1]
    to_i = way_i[i]
    percent = percents[i]

    dts.append(opti.variable())

    opti.subject_to(dts[i-1] > 0)
    opti.set_initial(dts[i-1], initDt)

    T += dts[i-1] * (to_i - from_i)

    for j in range(from_i, to_i):
        apply_dynamics(X, U, dts[i-1], j, opti)
        apply_kinematics(X, U, dts[i-1], j, opti, percent)


xSpace = []
ySpace = []
thetaSpace = []
vxSpace = []
vySpace = []
wSpace = []

def shortest_angle_lerp(a, b, t):
    result = ((b - a) + 180) % 360 - 180
    return a + result * t


def wrap_angles_to_least_delta(angles):
    wrapped_angles = np.zeros_like(angles)
    wrapped_angles[0] = angles[0]

    for i in range(1, len(angles)):
        delta = angles[i] - wrapped_angles[i - 1]
        # Wrap the delta to be within [-π, π] range
        delta = (delta + np.pi) % (2 * np.pi) - np.pi
        wrapped_angles[i] = wrapped_angles[i - 1] + delta

    return wrapped_angles

w_theta = wrap_angles_to_least_delta(w_theta)

# for i in range(0, len(w_theta) - 1):
#    w_theta[i+1] = w_theta[i] + ((w_theta[i+1] - w_theta[i]) + 180) % 360 - 180


for j in range(1, len(way_i)):
    from_i = way_i[j-1]
    to_i = way_i[j]
    for k in range(from_i, to_i):
        interp = (k - from_i) / (to_i - from_i)
        indexX = (1 - interp) * w_x[j-1] + interp * w_x[j]
        indexY = (1 - interp) * w_y[j-1] + interp * w_y[j]


        indexT = (1 - interp) * w_theta[j-1] + interp * w_theta[j]
        # indexT = shortest_angle_lerp(w_theta[j-1], w_theta[j], interp)
        # indexT = (indexT + 720) % 360


        xSpace.append(indexX)
        ySpace.append(indexY)
        thetaSpace.append(indexT)

xSpace.append(w_x[len(w_x) - 1])
ySpace.append(w_y[len(w_y) - 1])
thetaSpace.append(w_theta[len(w_theta) - 1])

opti.set_initial(X[:, 0], xSpace)
opti.set_initial(X[:, 1], ySpace)
opti.set_initial(X[:, 2], thetaSpace)

opti.minimize(T)
opti.solver("ipopt", {},  {"mu_init": 1e-6})

for i in range(1, len(way_i)):
    from_i = way_i[i-1]
    to_i = way_i[i]
    for j in range(from_i, to_i):
        apply_kinematics2(X, U, dts[i-1], j, opti)

sol = opti.solve()

timestamp = [0]

for i in range(1, len(way_i)):
    for j in range(way_i[i-1], way_i[i]):
        timestamp.append(timestamp[len(timestamp) - 1] + sol.value(dts[i-1]))

x = sol.value(X[:, 0])
y = sol.value(X[:, 1])
theta = sol.value(X[:, 2])

dtt = []
for i in range(len(dts)):
    dtt.append(sol.value(dts[i]))

split = split_even_dt(dtt, way_i, x, y, theta)
split_velo = split_even_dt(dtt, way_i, sol.value(X[:, 3]), sol.value(X[:, 4]), sol.value(X[:, 5]))

def create_json(dt, x, y, theta, xd, yd):
    states = [{'x': x[i], 'y': y[i], 'theta': theta[i], 'vx': xd[i], 'vy': yd[i]} for i in range(len(x))]
    result = {'dt': dt, 'state': states}

    with open('data.out', 'w') as f:
        json.dump(result, f, indent=4)

create_json(0.02, split[0][:], split[1][:], split[2][:], split_velo[0][:], split_velo[1][:])
