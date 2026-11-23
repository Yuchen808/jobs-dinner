"""Original short melancholy loop for the dinner video, synthesised from scratch (no samples, nothing licensed).
The loop is exactly as long as the video and a whole number of bars, and every step (notes, pad, reverb) wraps round
the end, so the last sample runs straight into the first.

  python make-music.py <bars: 3 | 2> <out.wav> [seconds=10.3]
"""
import sys, wave
import numpy as np

BARS = float(sys.argv[1]) if len(sys.argv) > 1 else 3
OUT = sys.argv[2] if len(sys.argv) > 2 else "out/music.wav"
LOOP = float(sys.argv[3]) if len(sys.argv) > 3 else 10.3
SR = 48000
# Softness: higher SOFT = fewer overtones, longer ATTACK = no hammer click, lower TOP = darker, higher WET = further away.
SOFT, ATTACK, TOP, WET = 2.6, 0.035, 2400, 0.75
N = int(round(LOOP * SR))
BEAT = LOOP / round(BARS * 4)
rng = np.random.default_rng(7)

NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"])}


def hz(name):
    return 440.0 * 2 ** ((NOTE[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)


def add_wrapped(buf, sig, start):
    """Mix a note into the loop; whatever runs past the end comes back in at the start."""
    i = int(round(start * SR)) % N
    idx = (i + np.arange(len(sig))) % N
    np.add.at(buf, idx, sig)


def felt_piano(freq, vel, length=6.0):
    """Soft, dark piano-like tone: a few harmonics, the high ones dying first, slow-ish attack."""
    t = np.arange(int(length * SR)) / SR
    out = np.zeros_like(t)
    for k in range(1, 9):
        f = freq * k * (1 + 0.0004 * k * k)          # strings are slightly sharp in the upper harmonics
        if f > 5000:
            break
        amp = vel / k ** SOFT
        out += amp * np.exp(-t * (0.55 + 0.5 * k)) * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
    attack = np.minimum(1, t / ATTACK) ** 2
    return out * attack * np.exp(-t * 0.25)


def pad(freqs, start, length, level):
    """Held chord with a slow swell and fade; two slightly detuned sines per note for a little movement."""
    t = np.arange(int(length * SR)) / SR
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 1.5
    sig = np.zeros_like(t)
    for f in freqs:
        for d in (-0.0015, 0.0015):
            sig += np.sin(2 * np.pi * f * (1 + d) * t + rng.uniform(0, 6.28))
    return sig * env * level / len(freqs), start


# D minor, one chord per bar. The phrase ends on a held note that leans back into the first bar.
LONG = [("D2", ["A3", "D4", "E4", "F4"]), ("G1", ["G3", "Bb3", "D4", "F4"]), ("Bb1", ["F3", "A3", "D4", "F4"]), ("A1", ["E3", "G3", "C4", "E4"]),
        ("G1", ["D3", "G3", "Bb3", "D4"]), ("D2", ["F3", "A3", "D4", "F4"]), ("A1", ["E3", "G3", "A3", "C4"])]   # minor chords only, bar 3 aside
LONG_TUNE = [(1.0, "F4", .5), (2.0, "A4", .6), (4.0, "Bb4", .65), (6.0, "A4", .5), (7.0, "G4", .45), (8.0, "F4", .5), (10.0, "A4", .55),
             (12.0, "C5", .65), (14.0, "A4", .5), (15.0, "G4", .45), (16.0, "Bb4", .55), (18.0, "G4", .45)]
if BARS == 7:     # one long phrase over seven chords, ending on the dominant so it falls back into bar one
    chords = LONG
    tune = LONG_TUNE + [(20.0, "F4", .5), (22.0, "D4", .45), (24.0, "G4", .5), (26.0, "E4", .4)]
elif BARS == 6:   # ends by stepping down F - E - D onto the home note over the home chord: a close, not a question
    chords = [LONG[0], LONG[1], LONG[2], LONG[4], LONG[3], ("D2", ["F4", "D4", "A3"])]
    tune = LONG_TUNE[:7] + [(12.0, "Bb4", .6), (14.0, "A4", .5), (15.0, "G4", .45), (16.0, "G4", .5), (18.0, "E4", .45),
                            (20.0, "F4", .42), (21.0, "E4", .4), (22.0, "D4", .5), (22.0, "D3", .45)]
    import os                                    # the last sound: one more low note after the landing
    if os.environ.get("TAIL") == "low":          # a deep D two octaves under the landing note
        tune += [(23.0, "D2", 1.0), (23.0, "D3", .5)]
    elif os.environ.get("TAIL") == "step":       # the tune keeps falling: D, then down to A, over a deep D
        tune += [(23.0, "A3", .5), (23.0, "D2", .8)]
elif BARS == 3.5:   # three bars and a two-beat turnaround: 14 beats, about 82 BPM
    chords = [("D2", ["A3", "D4", "E4", "F4"]), ("Bb1", ["F3", "A3", "D4", "F4"]), ("A1", ["E3", "G3", "C4", "E4"]), ("C2", ["G3", "C4", "E4"])]
    tune = [(1.0, "F4", .55), (2.0, "A4", .7), (4.0, "D5", .8), (6.0, "C5", .6), (7.0, "A4", .55), (8.0, "G4", .7), (10.0, "E4", .6), (12.5, "G4", .5)]
elif BARS == 3:
    chords = [("D2", ["A3", "D4", "E4", "F4"]), ("Bb1", ["F3", "A3", "D4", "F4"]), ("A1", ["E3", "G3", "C4", "E4"])]
    tune = [(1.0, "F4", .55), (2.0, "A4", .7), (4.0, "D5", .8), (6.0, "C5", .6), (7.0, "A4", .55), (8.0, "G4", .7), (10.0, "E4", .6)]
else:   # two slow bars: almost no pulse, just two chords breathing
    chords = [("D2", ["A3", "D4", "F4", "E4"]), ("Bb1", ["F3", "Bb3", "D4", "A4"])]
    tune = [(1.0, "A4", .7), (3.0, "F4", .5), (5.0, "D5", .7), (7.0, "C5", .5)]

dry = np.zeros(N)
bed = np.zeros(N)
for b, (bass, notes) in enumerate(chords):
    t0 = b * 4 * BEAT
    add_wrapped(dry, felt_piano(hz(bass), 0.9, 8.0), t0)
    for i, n in enumerate(notes):                    # slow broken chord, never quite on the grid
        add_wrapped(dry, felt_piano(hz(n), 0.42), t0 + (0.5 + i * (0.9 if BARS == 2 else 0.5 if len(notes) == 3 else 0.75)) * BEAT + rng.uniform(-0.012, 0.012))
    sig, st = pad([hz(n) for n in notes[:3]] + [hz(bass) * 2], t0 - 1.2 * BEAT, (6.4 if len(notes) == 4 else 4.2) * BEAT, 0.16)
    add_wrapped(bed, sig, st)
for beat, n, v in tune:
    add_wrapped(dry, felt_piano(hz(n), v * 0.8), beat * BEAT + rng.uniform(-0.01, 0.015))

# Room: a 3-second tail made of filtered noise, applied as a circular convolution so the tail wraps too.
def tail(seed):
    r = np.random.default_rng(seed)
    t = np.arange(int(3.0 * SR)) / SR
    n = r.standard_normal(len(t)) * np.exp(-t * 2.2)
    spec = np.fft.rfft(n)
    f = np.fft.rfftfreq(len(n), 1 / SR)
    spec *= 1 / (1 + (f / 2200) ** 2) * (f > 120)     # dark, no rumble
    n = np.fft.irfft(spec, len(n))
    full = np.zeros(N)
    full[:len(n)] = n
    return full / np.sqrt((n ** 2).sum())

mix = dry + bed
stereo = []
for seed in (11, 23):
    wet = np.fft.irfft(np.fft.rfft(mix) * np.fft.rfft(tail(seed)), N)
    stereo.append(mix * 0.7 + wet * WET)
s = np.stack(stereo, 1)

# Gentle top roll-off (felt), then level. Done in the frequency domain on the whole loop, so it stays seamless.
spec = np.fft.rfft(s, axis=0)
f = np.fft.rfftfreq(N, 1 / SR)[:, None]
s = np.fft.irfft(spec / (1 + (f / TOP) ** 4), N, axis=0)
s = s / np.abs(s).max() * 10 ** (-3 / 20)            # peak at -3 dB

seam = float(np.abs(s[0] - s[-1]).max())
step = float(np.abs(np.diff(s, axis=0)).max())
print(f"{BARS:g} bars, {60 / BEAT:.1f} BPM, {N / SR:.3f} s, seam jump {seam:.4f} (largest ordinary step {step:.4f})")
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((s * 32767).astype("<i2").tobytes())
