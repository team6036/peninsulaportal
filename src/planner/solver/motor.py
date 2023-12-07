import json

high_tide_mode = False

efficiency_tweak = 0.7

with open('data.in', 'r') as file:
    data = json.load(file)

config = data['config']

efficiency_tweak = config['efficiency_percent']
high_tide_mode = config['12_motor_mode']

nominal_voltage = 12

stall_torque = 4.69 * 6.75 * efficiency_tweak
if(high_tide_mode):
    stall_torque = 4.69 * 4.6 * 2 * efficiency_tweak

stall_current = 257
free_current = 1.5

free_speed = 6380 / 6.75
if(high_tide_mode):
    free_speed = 6380 / 4.6

rOhms = nominal_voltage / stall_current

Kv_rad_per_sec_per_volt = (2 * 3.1415 * free_speed / 60) / (nominal_voltage - rOhms * free_current)

Kt_NM_per_amp = stall_torque / stall_current

def get_current(rad_per_s, voltage):
    return -1 / Kv_rad_per_sec_per_volt / rOhms * rad_per_s + 1 / rOhms * voltage

def get_torque(current):
    return current * Kt_NM_per_amp
