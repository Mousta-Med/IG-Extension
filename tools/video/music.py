"""Synthesize the promo soundtrack (original, royalty-free): pad + pluck arpeggio + soft drums,
with sound effects placed on the video's cues.

Usage:  python music.py cues.json out.wav
cues.json comes from promo.js (window.__timeline): {"duration": s, "cues": {"whoosh": [...], ...}}
"""
import json
import sys
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(7)

BPM = 100
BEAT = 60 / BPM
CHORD_LEN = 8 * BEAT  # two bars per chord
# Fmaj7 – G6 – Em7 – Am7 (MIDI notes)
CHORDS = [[53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 67]]


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(seconds):
    return np.arange(int(seconds * SR)) / SR


def add(buf, start, sig, gain=1.0, pan=0.0):
    """Mix a mono `sig` into stereo `buf` at `start` seconds (equal-power pan, -1..1)."""
    i = int(start * SR)
    if i >= buf.shape[1] or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: buf.shape[1] - i]
    angle = (pan + 1) * np.pi / 4
    buf[0, i:i + len(sig)] += sig * gain * np.cos(angle)
    buf[1, i:i + len(sig)] += sig * gain * np.sin(angle)


def lowpass(x, alpha):
    """One-pole lowpass; `alpha` may be an array (time-varying cutoff)."""
    y = np.empty_like(x)
    acc = 0.0
    a = np.broadcast_to(alpha, x.shape)
    for k in range(len(x)):
        acc += a[k] * (x[k] - acc)
        y[k] = acc
    return y


# ── Instruments ──
def pad(freq, length, detune):
    t = tt(length)
    sig = sum(amp * np.sin(2 * np.pi * freq * h * (1 + detune) * t + h)
              for h, amp in ((1, 1.0), (2, 0.32), (3, 0.14), (4, 0.06)))
    env = np.minimum(1, t / 0.9) * np.minimum(1, (length - t) / 1.2).clip(0)
    return sig * env


def pluck(freq, length=0.7):
    t = tt(length)
    sig = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.22) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t / 0.1)
    return sig * np.minimum(1, t / 0.004)


def bass(freq, length=1.1):
    t = tt(length)
    sig = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)
    return sig * np.exp(-t / 0.55) * np.minimum(1, t / 0.008)


def kick():
    t = tt(0.35)
    f = 46 + 75 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)


def snare():
    t = tt(0.25)
    n = rng.standard_normal(len(t))
    n = n - lowpass(n, 0.08)               # high-pass the body away
    return (lowpass(n, 0.45) * 0.8 + 0.25 * np.sin(2 * np.pi * 190 * t)) * np.exp(-t / 0.07)


def hat():
    t = tt(0.06)
    n = np.diff(rng.standard_normal(len(t) + 1))
    return n * np.exp(-t / 0.018)


def whoosh(length=0.8):
    t = tt(length)
    n = rng.standard_normal(len(t))
    sweep = 0.02 + 0.25 * np.sin(np.pi * t / length) ** 2   # filter opens then closes
    return lowpass(n, sweep) * np.sin(np.pi * t / length) ** 1.5


def swish():
    return whoosh(0.32) * 0.6


def click(freq=1900):
    t = tt(0.05)
    return (np.sin(2 * np.pi * freq * t) * 0.7 + rng.standard_normal(len(t)) * 0.25) * np.exp(-t / 0.011)


def bell(freqs, length=2.2):
    t = tt(length)
    sig = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.9) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.3) for f in freqs)
    return sig * np.minimum(1, t / 0.003) / len(freqs)


def main():
    cues_path, out_path = sys.argv[1], sys.argv[2]
    tl = json.load(open(cues_path, encoding="utf-8"))
    duration = float(tl["duration"])
    cues = tl["cues"]
    groove_start = cues["whoosh"][0]       # drums and arpeggio enter with the first feature
    groove_end = cues["whoosh"][-1]        # and leave for the outro

    music = np.zeros((2, int(duration * SR) + SR))
    sfx = np.zeros_like(music)

    # Pad: whole track, chords overlapping slightly for smooth changes.
    n_chords = int(np.ceil(duration / CHORD_LEN)) + 1
    for c in range(n_chords):
        start = c * CHORD_LEN - 0.4
        for m in CHORDS[c % len(CHORDS)]:
            f = mtof(m)
            add(music, start, pad(f, CHORD_LEN + 1.2, +0.0025), 0.05, -0.5)
            add(music, start, pad(f, CHORD_LEN + 1.2, -0.0025), 0.05, +0.5)

    # Groove: 8th-note pluck arpeggio, bass on beats 1 & 3, kick 1 & 3, snare 2 & 4, offbeat hats.
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    step = BEAT / 2
    k = int(np.ceil(2.4 / step))  # arpeggio starts softly during the intro
    while k * step < duration - 3:
        t0 = k * step
        chord = CHORDS[int(t0 // CHORD_LEN) % len(CHORDS)]
        in_groove = groove_start <= t0 < groove_end
        note = chord[pattern[k % len(pattern)]] + 12
        add(music, t0, pluck(mtof(note)), 0.09 if in_groove else 0.05, -0.35 if k % 2 else 0.35)
        if in_groove:
            beat_i = k // 2
            if k % 2 == 0:
                if beat_i % 2 == 0:
                    add(music, t0, kick(), 0.42)
                    add(music, t0, bass(mtof(chord[0] - 12)), 0.2)
                else:
                    add(music, t0, snare(), 0.09)
            else:
                add(music, t0, hat(), 0.05, 0.25)
        k += 1

    # Sound effects on the video's cues.
    for c in cues.get("whoosh", []):
        add(sfx, c - 0.45, whoosh(), 0.16)
    for c in cues.get("swish", []):
        add(sfx, c - 0.05, swish(), 0.12)
    for c in cues.get("click", []):
        add(sfx, c, click(), 0.22)
    for c in cues.get("key", []):
        add(sfx, c, click(1300), 0.16)
        add(sfx, c + 0.09, click(1500), 0.12)
    for i, c in enumerate(cues.get("bell", [])):
        root = mtof(72 if i == 0 else 77)
        add(sfx, c, bell([root, root * 1.5, root * 2]), 0.18)

    mix = music + sfx
    n = int(duration * SR)
    mix = mix[:, :n]
    t = np.arange(n) / SR
    fade = np.minimum(1, t / 0.4) * np.clip((duration - t) / 2.5, 0, 1)
    mix *= fade
    mix = np.tanh(mix * 1.4) / np.tanh(1.4)                 # gentle glue / soft clip
    mix *= 0.89 / max(1e-9, np.abs(mix).max())               # peak at about -1 dBFS

    pcm = (mix.T * 32767).astype(np.int16)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"wrote {out_path} ({duration:.1f}s)")


if __name__ == "__main__":
    main()
