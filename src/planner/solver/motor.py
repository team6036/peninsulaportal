import json

high_tide_mode = False

efficiency_tweak = 0.7

with open('data.in', 'r') as file:
    data = json.load(file)

config = data['config']

efficiency_tweak = config['efficiency_percent']
FOC = config['FOC']

nominal_voltage = 12

drive_gr_falcon = 6.75
drive_gr_kraken = 1.0 / ((16.0 / 50) * (28.0 / 16) * (15.0 / 45))

stall_torque = 7.09 * drive_gr_kraken * efficiency_tweak

stall_current = 366
free_current = 2.0

free_speed = 6000 / drive_gr_kraken

if FOC:
    stall_torque = 9.37 * drive_gr_kraken * efficiency_tweak
    stall_current = 483
    free_current = 2
    free_speed = 5800 / drive_gr_kraken

rOhms = nominal_voltage / stall_current

Kv_rad_per_sec_per_volt = (2 * 3.1415 * free_speed / 60) / (nominal_voltage - rOhms * free_current)

Kt_NM_per_amp = stall_torque / stall_current

def get_current(rad_per_s, voltage):
    return -1 / Kv_rad_per_sec_per_volt / rOhms * rad_per_s + 1 / rOhms * voltage

def get_torque(current):
    return current * Kt_NM_per_amp
