"""Synthesise the start sequence: five light beeps over an idling grid, then the engine at lights out.
Timings must match LIGHT_TIMES / LIGHTS_OUT in script.js."""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
LIGHT_TIMES = [0.45 + i * 0.6 for i in range(5)]
LIGHTS_OUT = 3.9
ENGINE = 3.2
TOTAL = LIGHTS_OUT + ENGINE + 0.2
rng = np.random.default_rng(27)

t = np.arange(int(TOTAL * SR)) / SR
out = np.zeros_like(t)

def saw_from_freq(freq):
    phase = np.cumsum(freq) / SR
    return 2 * (phase - np.floor(phase + 0.5))

def lowpass(x, fc, order=4):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)

def bandpass(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)

# Idling grid during the countdown: low burble with small blips as each light comes on
idle_mask = t < LIGHTS_OUT
f_idle = 62 + 4 * np.sin(2 * np.pi * 1.3 * t)
for lt in LIGHT_TIMES:
    f_idle += 38 * np.exp(-((t - lt - 0.12) ** 2) / (2 * 0.08 ** 2))
idle = np.tanh(2.5 * (saw_from_freq(f_idle) + 0.5 * saw_from_freq(f_idle * 0.5)))
idle = lowpass(idle, 700)
fade_in = np.clip(t / 0.4, 0, 1)
out += 0.13 * idle * idle_mask * fade_in

# Beeps
for lt in LIGHT_TIMES:
    n = int(0.16 * SR)
    i0 = int(lt * SR)
    tt = np.arange(n) / SR
    env = np.minimum(1, tt / 0.005) * np.exp(-tt / 0.06)
    tone = np.sin(2 * np.pi * 760 * tt) + 0.3 * np.sin(2 * np.pi * 1520 * tt) + 0.15 * np.sin(2 * np.pi * 2280 * tt)
    out[i0:i0 + n] += 0.35 * env * tone

# Lights out: rev, upshift, rev, upshift, rev, then away down the straight
te = t - LIGHTS_OUT
eng_mask = te >= 0
keys = [(0, 70), (0.85, 195), (0.93, 132), (1.75, 210), (1.83, 152), (2.6, 220), (ENGINE, 205)]
kt, kf = zip(*keys)
f_eng = np.interp(np.clip(te, 0, ENGINE), kt, kf)
f_eng = np.exp(np.interp(np.clip(te, 0, ENGINE), kt, np.log(kf)))
eng = saw_from_freq(f_eng) * 0.55 + saw_from_freq(f_eng * 2.01) * 0.3 + saw_from_freq(f_eng * 0.5) * 0.35
eng = np.tanh(3.2 * eng)
eng = lowpass(eng, 2600)
noise = bandpass(rng.standard_normal(len(t)), 600, 2400) * 0.25
env = np.clip(te / 0.06, 0, 1) * np.where(te < 2.2, 1, np.exp(-(te - 2.2) / 0.45))
out += 0.6 * (eng + noise) * env * eng_mask

out = out / np.max(np.abs(out)) * 0.89
wavfile.write(sys.argv[1], SR, (out * 32767).astype(np.int16))
print('seconds', round(TOTAL, 2))
