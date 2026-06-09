#!/usr/bin/env python3
"""Generate license-clean drum breaks for AgentScore's slicer.

Every sound here is synthesized from scratch (sine/noise + envelopes), so the
output is 100% original — nothing sampled, no copyright. Each break is a one-bar
loop laid out on a 16-step grid so the slicer's default 16 equal slices line up
with the steps. Run from the repo root:

    python3 tools/make_breaks.py

Writes samples/breaks/*.wav (mono, 44.1 kHz, 16-bit).
"""
import numpy as np, struct, os, wave

SR = 44100

def env(n, attack, decay):
    a = max(1, int(attack * SR))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    d = np.exp(-np.linspace(0, 1, n) * (1.0 / max(1e-3, decay)))
    return e * d

def kick(dur=0.28, f0=150, f1=48):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * env(n, 0.001, 0.18)

def sub_kick(dur=0.45, f0=120, f1=38):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 14)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * env(n, 0.001, 0.32)

def snare(dur=0.22, tone=190):
    n = int(dur * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * tone * t) * env(n, 0.001, 0.06) * 0.6
    noise = (np.random.rand(n) * 2 - 1) * env(n, 0.001, 0.10)
    return body + noise

def hat(dur=0.05, decay=0.03):
    n = int(dur * SR)
    return (np.random.rand(n) * 2 - 1) * env(n, 0.0005, decay) * 0.6

def openhat(dur=0.18):
    n = int(dur * SR)
    return (np.random.rand(n) * 2 - 1) * env(n, 0.0005, 0.12) * 0.5

def rim(dur=0.04):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1700 * t) + (np.random.rand(n) * 2 - 1) * 0.4) * env(n, 0.0005, 0.02) * 0.7

def place(buf, sound, step, step_len, gain=1.0):
    start = int(step * step_len)
    end = min(len(buf), start + len(sound))
    buf[start:end] += sound[:end - start] * gain

def normalize(buf, peak=0.89):
    m = np.max(np.abs(buf))
    return buf * (peak / m) if m > 0 else buf

def render(bpm, layout):
    """layout: dict step -> list of (sound_fn, gain). 16 steps = 1 bar 4/4."""
    bar = 60.0 / bpm * 4
    n = int(bar * SR)
    buf = np.zeros(n + SR // 2)            # headroom for tails; trimmed to n
    step_len = n / 16.0
    for step, hits in layout.items():
        for fn, g in hits:
            place(buf, fn(), step, step_len, g)
    return normalize(buf[:n])

def write_wav(path, data):
    pcm = np.clip(data, -1, 1)
    ints = (pcm * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(ints.tobytes())
    print("wrote", path, f"({len(data)/SR:.3f}s)")

# step grid helpers
def H(): return (hat, 0.8)
def OH(): return (openhat, 0.7)

BREAKS = {
    # busy amen-ish jungle feel (NOT the Amen — fully synthesized), ~170
    "jungle.wav": (170, {
        0:  [(kick, 1.0), H()], 1: [H()], 2: [(snare, 0.9), H()], 3: [H()],
        4:  [(kick, 0.8), H()], 5: [H()], 6: [(snare, 1.0)], 7: [(kick, 0.7), H()],
        8:  [(snare, 0.9), H()], 9: [H()], 10: [(kick, 0.8), H()], 11: [(rim, 0.8)],
        12: [(snare, 1.0), H()], 13: [(kick, 0.7)], 14: [(snare, 0.8), OH()], 15: [(rim, 0.7)],
    }),
    # funky one-bar break, ~96
    "funk.wav": (96, {
        0:  [(kick, 1.0), H()], 2: [H()], 4: [(snare, 1.0), H()], 6: [H()],
        7:  [(kick, 0.7)], 8: [(kick, 0.9), H()], 10: [(rim, 0.7), H()],
        12: [(snare, 1.0), H()], 14: [(snare, 0.6), OH()], 15: [(kick, 0.6)],
    }),
    # four-on-the-floor house, ~124
    "fourfloor.wav": (124, {
        0:  [(sub_kick, 1.0)], 2: [(hat, 0.7)], 4: [(sub_kick, 1.0), (snare, 0.7)],
        6:  [(hat, 0.7)], 8: [(sub_kick, 1.0)], 10: [(openhat, 0.6)],
        12: [(sub_kick, 1.0), (snare, 0.7)], 14: [(hat, 0.7)],
    }),
}

if __name__ == "__main__":
    np.random.seed(7)                       # reproducible noise
    out = os.path.join(os.path.dirname(__file__), "..", "samples", "breaks")
    os.makedirs(out, exist_ok=True)
    for name, (bpm, layout) in BREAKS.items():
        write_wav(os.path.join(out, name), render(bpm, layout))
