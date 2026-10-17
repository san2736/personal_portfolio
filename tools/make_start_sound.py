"""Synthesise an F1-style race start, written from scratch with NumPy and SciPy (no recordings).

A grid of twelve V6 hybrid engines holds revs while the five lights come on, then launches at lights out:
clutch bite, quick upshifts, and the field pulling away into the distance, with the crowd rising.

The timings must match LIGHT_TIMES and LIGHTS_OUT in script.js.
Usage: python3 make_start_sound.py out.wav
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
LIGHT_TIMES = [0.45 + i * 0.6 for i in range(5)]
LIGHTS_OUT = 3.9
TOTAL = LIGHTS_OUT + 4.2
N = int(TOTAL * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(27)


def lowpass(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def smooth_noise(rate_hz):
    n = lowpass(rng.standard_normal(N), rate_hz)
    return n / (np.max(np.abs(n)) + 1e-9)


def engine_voice(rpm):
    """A V6 four-stroke fires three times per revolution: the firing frequency is rpm / 20."""
    f0 = rpm / 20.0
    phase = np.cumsum(f0) / SR
    x = np.zeros(N)
    for k in range(1, 11):
        x += (1 / k ** 0.75) * np.sin(2 * np.pi * k * phase + rng.uniform(0, 2 * np.pi))
    # Half-order harmonics give the rasp of uneven exhaust pulses
    for k in (0.5, 1.5, 2.5):
        x += (0.3 / k) * np.sin(2 * np.pi * k * phase + rng.uniform(0, 2 * np.pi))
    x = np.tanh(1.6 * x / 3)
    # Turbo whistle, rising and falling with the revs
    turbo = 0.035 * np.sin(2 * np.pi * np.cumsum(rpm * 0.62) / SR)
    return x + turbo


def car_rpm(launch):
    offset = rng.uniform(-350, 350)
    # Drivers bring the revs up as the lights come on, then hold them
    hold = np.interp(t, [0, 0.45, 2.85, LIGHTS_OUT + 0.3], [7200, 8800, 10400, 10600]) + offset
    hold += 260 * smooth_noise(6)  # throttle feathering
    # Launch: clutch bite, then upshifts every half second or so
    gears = np.array([0.55, 0.6, 0.68, 0.78, 0.9, 1.0]) * rng.uniform(0.92, 1.08)
    kt, kr = [0.0, 0.1], [hold[min(int(launch * SR), N - 1)], 8300]
    for g in gears:
        kt.append(kt[-1] + g)
        kr.append(12100)
        kt.append(kt[-1] + 0.04)
        kr.append(10300)
    te = t - launch
    run = np.interp(te, kt, kr)
    return np.where(te < 0, hold, run)


left = np.zeros(N)
right = np.zeros(N)

for i in range(12):
    launch = LIGHTS_OUT + rng.uniform(0.0, 0.12)
    rpm = car_rpm(launch)
    voice = engine_voice(rpm)
    bright = lowpass(voice, 9000)
    dull = lowpass(voice, 1500)

    te = t - launch
    # After launch each car pulls away: louder at first, then fading and dulling with distance
    reach = rng.uniform(1.3, 2.8)
    away = (np.maximum(te, 0) / reach) ** 1.5
    gain = np.where(te < 0, 0.42, 1.3 / (1 + away))
    gain *= np.where(te < 0, 1.0, np.minimum(1.0, 0.42 / 1.3 + te / 0.12))  # quick swell at launch
    mix = np.clip(away / 2.5, 0, 1)  # 0 = close and bright, 1 = far and dull
    car = gain * ((1 - mix) * bright + mix * dull)

    pan = rng.uniform(-0.8, 0.8)
    left += car * np.sqrt((1 - pan) / 2)
    right += car * np.sqrt((1 + pan) / 2)

# Crowd and wind, rising at lights out
crowd = bandpass(rng.standard_normal(N), 250, 3200)
crowd /= np.max(np.abs(crowd))
crowd_env = np.interp(t, [0, LIGHTS_OUT, LIGHTS_OUT + 0.6, TOTAL - 0.8, TOTAL], [0.06, 0.08, 0.22, 0.14, 0.0])
left += crowd * crowd_env * 3
right += crowd[::-1] * crowd_env * 3

# Fade in, and a gentle fade at the end
fade = np.clip(t / 0.25, 0, 1) * np.clip((TOTAL - t) / 1.2, 0, 1)
stereo = np.stack([left * fade, right * fade], axis=1)
stereo = stereo / np.max(np.abs(stereo)) * 0.89

wavfile.write(sys.argv[1], SR, (stereo * 32767).astype(np.int16))
print('seconds', round(TOTAL, 2))
