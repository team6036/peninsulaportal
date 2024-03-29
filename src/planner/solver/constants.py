import json

m = 67.5 #weight in kg cad
l = 0.53 / 2 #side length in meters

I = ((70979) * 1.829e-5) + ((2.811 * 10**5) * 1.829e-5) # from cCAD

with open('data.in', 'r') as file:
    data = json.load(file)

config = data['config']

l = config['side_length'] / 2
m = config['mass']
I = config['moment_of_inertia']

free_speed_percent = config['free_percent']

pi = 3.1415
pie = 3.142

plot = True

drive_gr = 1.0 / ((16.0 / 50) * (28.0 / 16) * (15.0 / 45))
    
motor_free_speed = 6000 #rpm

if config['FOC']:
    motor_free_speed = 5800

wheel_radius = 0.0504 #meters

max_module_ground_speed = wheel_radius * 2 * pi * ((motor_free_speed / 60) / drive_gr)
