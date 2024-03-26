import casadi as ca
import math
import numpy as np
import matplotlib.pyplot as plt
from constants import m, l, I
import constants as cs
from motor import get_current, get_torque
from util import corners

def apply_dynamics(X, U, dt, i, opti):
    #X = [x, y, t, x_d, y_d, t_d]
    # 
    #   ^ +y
    #   |
    # F1--F2
    # |    | ---> +x
    # F3--F4
    Fx = U[i, :4]
    Fy = U[i, 4:]

    theta = X[i, 2]

    c = corners(theta)

    torque1 = c[0][1] * Fy[0] - c[0][0] * Fx[0]
    torque2 = c[1][1] * Fy[1] - c[1][0] * Fx[1]
    torque3 = c[2][1] * Fy[2] - c[2][0] * Fx[2]
    torque4 = c[3][1] * Fy[3] - c[3][0] * Fx[3]

    atT = (torque1 + torque2 + torque3 + torque4) / I

    axG = (Fx[0] + Fx[1] + Fx[2] + Fx[3]) / m
    ayG = (Fy[0] + Fy[1] + Fy[2] + Fy[3]) / m

    opti.subject_to(X[i+1, 0] == X[i, 0] + X[i, 3] * dt + 0.5 * axG * dt * dt)
    opti.subject_to(X[i+1, 1] == X[i, 1] + X[i, 4] * dt + 0.5 * ayG * dt * dt)
    opti.subject_to(X[i+1, 2] == X[i, 2] + X[i, 5] * dt + 0.5 * atT * dt * dt)

    opti.subject_to(X[i+1, 3] == X[i, 3] + axG * dt)
    opti.subject_to(X[i+1, 4] == X[i, 4] + ayG * dt)
    opti.subject_to(X[i+1, 5] == X[i, 5] + atT * dt)


m_dx = [-l * math.sqrt(2), l * math.sqrt(2), -l * math.sqrt(2), l * math.sqrt(2)]
m_dy = [l * math.sqrt(2), l * math.sqrt(2), -l * math.sqrt(2), -l * math.sqrt(2)]

def apply_kinematics(X, U, dt, i, opti, percent=1):

    cosi = ca.cos(X[i+1, 2]) - ca.cos(X[i, 2]) #DONE TWICE BECAUSE REPEATED METHOD
    sini = ca.sin(X[i, 2]) - ca.sin(X[i+1, 2])
    xi1 = X[i+1, 0] - X[i, 0]
    xi2 = X[i+1, 1] - X[i, 1]

    for mo in range(4):
        # dx0 = m_dx[mo] * ca.cos(X[i, 2]) - m_dy[mo] * ca.sin(X[i, 2])
        # dy0 = m_dy[mo] * ca.cos(X[i, 2]) + m_dx[mo] * ca.sin(X[i, 2])

        # dx1 = m_dx[mo] * ca.cos(X[i+1, 2]) - m_dy[mo] * ca.sin(X[i+1, 2])
        # dy1 = m_dy[mo] * ca.cos(X[i+1, 2]) + m_dx[mo] * ca.sin(X[i+1, 2])

        # x0 = X[i, 0] + dx0
        # y0 = X[i, 1] + dy0

        # x1 = X[i+1, 0] + dx1
        # y1 = X[i+1, 1] + dy1

        # vx = (x1 - x0) / dt
        # vy = (y1 - y0) / dt

        vx = (m_dx[mo] * (cosi) + m_dy[mo] * (sini) + xi1) / dt
        vy = (m_dy[mo] * (cosi) + m_dx[mo] * (sini) + xi2) / dt

        v = vx**2 + vy**2

        opti.subject_to(v < (cs.max_module_ground_speed * cs.free_speed_percent * percent) ** 2)

        c = get_current(ca.sqrt(v) / cs.wheel_radius, 12)
        t = get_torque(c)
        tm = get_torque(70)
        f = t / cs.wheel_radius
        fm = tm / cs.wheel_radius

        opti.subject_to(opti.bounded(-(fm**2), U[i, mo]**2 + U[i, mo + 4]**2, fm**2))



def apply_kinematics2(X, U, dt, i, opti):

    cosi = ca.cos(X[i+1, 2]) - ca.cos(X[i, 2])
    sini = ca.sin(X[i, 2]) - ca.sin(X[i+1, 2])
    xi1 = X[i+1, 0] - X[i, 0]
    xi2 = X[i+1, 1] - X[i, 1]

    for mo in range(4):
        #dx0 = m_dx[mo] * ca.cos(X[i, 2]) - m_dy[mo] * ca.sin(X[i, 2])
        #dy0 = m_dy[mo] * ca.cos(X[i, 2]) + m_dx[mo] * ca.sin(X[i, 2])

        #dx1 = m_dx[mo] * ca.cos(X[i+1, 2]) - m_dy[mo] * ca.sin(X[i+1, 2])
        #dy1 = m_dy[mo] * ca.cos(X[i+1, 2]) + m_dx[mo] * ca.sin(X[i+1, 2])

        # m_dx[mo] * ca.cos(X[i+1, 2]) - m_dy[mo] * ca.sin(X[i+1, 2]) - m_dx[mo] * ca.cos(X[i, 2]) + m_dy[mo] * ca.sin(X[i, 2]) + X[i+1, 0] - X[i, 0]
        #
        # m_dx[mo] * [ca.cos(X[i+1, 2]) - ca.cos(X[i, 2])] + m_dy[mo] * [ca.sin(X[i, 2]) - ca.sin(X[i+1, 2])] + X[i+1, 0] - X[i, 0]

        #x0 = X[i, 0] + dx0
        #y0 = X[i, 1] + dy0

        #x1 = X[i+1, 0] + dx1
        #y1 = X[i+1, 1] + dy1

        vx = (m_dx[mo] * (cosi) + m_dy[mo] * (sini) + xi1) / dt
        vy = (m_dy[mo] * (cosi) + m_dx[mo] * (sini) + xi2) / dt
        #vy = (y1 - y0) / dt

        v = vx**2 + vy**2

        # opti.subject_to(v < cs.max_module_ground_speed ** 2)

        c = get_current(ca.sqrt(v) / cs.wheel_radius, 12)
        t = get_torque(c)
        f = t / cs.wheel_radius

        opti.subject_to(opti.bounded(-(f**2), U[i, mo]**2 + U[i, mo + 4]**2, f**2))

        #opti.subject_to(U[i, mo]**2 + U[i, mo + 4]**2 < f**2)