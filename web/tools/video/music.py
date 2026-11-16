"""Gentle background music, synthesized locally (no samples, no licences).
F major, 80 BPM, I–V6–vi–IV. Intro is sparse (the black opening), then arpeggios, bass and a
light pentatonic melody; a soft ending. Writes a 48 kHz stereo WAV.
python music.py out.wav [seconds]"""
import sys
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000
OUT = sys.argv[1]
TOTAL = float(sys.argv[2]) if len(sys.argv) > 2 else 104.0
BPM = 80.0
BEAT = 60.0 / BPM
rng = np.random.default_rng(7)
L = np.zeros(int(SR * (TOTAL + 6)))
R = np.zeros_like(L)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def piano(freq, dur, vel=0.5, bright=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, amp in enumerate([1.0, 0.42, 0.22, 0.12, 0.06, 0.035], start=1):
        f = freq * k * (1 + 0.0004 * k * k)  # slight inharmonicity
        if f > 9000:
            break
        decay = (2.2 + 1.4 * k) / max(0.6, bright)
        out += amp * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-decay * t)
    attack = np.minimum(1, t / 0.006)
    release = np.minimum(1, (dur - t) / 0.08).clip(0, 1)
    return vel * out * attack * release


def pad(freq, dur, vel=0.08):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = sum(np.sin(2 * np.pi * freq * d * t + rng.uniform(0, 6.28)) for d in (0.997, 1.0, 1.004))
    out += 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    env = np.minimum(1, t / 1.6) * np.minimum(1, (dur - t) / 1.8).clip(0, 1)
    return vel * out * env / 3


def place(sig, start, pan=0.0):
    i = int(start * SR)
    j = min(len(L), i + len(sig))
    if i >= len(L):
        return
    s = sig[: j - i]
    L[i:j] += s * np.sqrt(0.5 * (1 - pan))
    R[i:j] += s * np.sqrt(0.5 * (1 + pan))


# F major: F=65(F4). Chords as MIDI (root position voicings around C4..C5)
chords = [
    ("F", [53, 60, 65, 69, 72]),   # F  (F3 C4 F4 A4 C5)
    ("C/E", [52, 60, 64, 67, 72]), # C/E
    ("Dm", [50, 57, 62, 65, 69]),  # Dm
    ("Bb", [46, 58, 62, 65, 70]),  # Bb
]
BAR = 4 * BEAT
CHORD_LEN = 2 * BAR  # 6 s
intro_end = 10.5      # black opening: sparse
outro_start = TOTAL - 9.0

t = 0.0
ci = 0
while t < TOTAL:
    name, notes = chords[ci % 4]
    bass = notes[0] - 12
    # pad all the way
    for m in notes[1:4]:
        place(pad(midi_hz(m), CHORD_LEN + 1.5, 0.05 if t < intro_end else 0.06), t, pan=rng.uniform(-0.4, 0.4))
    if t < intro_end:
        # sparse single notes, like drops
        for k, m in enumerate([notes[2] + 12, notes[3] + 12, notes[4] + 12]):
            place(piano(midi_hz(m), 3.0, 0.16, bright=0.8), t + k * 1.9 + 0.4, pan=0.3 - 0.3 * k)
    else:
        fade = 1.0 if t < outro_start else max(0.35, 1 - (t - outro_start) / 10)
        # bass on each bar
        for b in range(2):
            place(piano(midi_hz(bass), 2.6, 0.30 * fade, bright=0.6), t + b * BAR, pan=-0.1)
        # eighth-note arpeggio, broken pattern
        pattern = [1, 2, 3, 4, 3, 2, 3, 4]
        for e in range(16):
            m = notes[pattern[e % 8]]
            vel = (0.17 if e % 2 == 0 else 0.12) * fade
            place(piano(midi_hz(m), 1.6, vel, bright=1.1), t + e * BEAT / 2 + rng.normal(0, 0.004), pan=0.25 * np.sin(e))
    t += CHORD_LEN
    ci += 1

# light pentatonic melody (F G A C D), enters after the intro, rests often
penta = [65, 67, 69, 72, 74, 77, 79, 81]
phrases = [
    [(0, 3, 1.0), (1.0, 4, 0.5), (1.5, 3, 0.5), (2.0, 2, 1.5), (4.0, 1, 0.5), (4.5, 2, 1.5)],
    [(0, 2, 1.0), (1.0, 3, 1.0), (2.0, 5, 1.5), (4.0, 4, 0.5), (4.5, 3, 1.5)],
    [(0, 4, 0.5), (0.5, 5, 0.5), (1.0, 6, 1.5), (3.0, 5, 0.5), (3.5, 4, 0.5), (4.0, 3, 2.0)],
    [(0, 3, 1.0), (1.0, 2, 1.0), (2.0, 1, 1.0), (3.0, 0, 3.0)],
]
start = intro_end + 4 * BAR
p = 0
while start < outro_start + 2:
    for (b, idx, d) in phrases[p % len(phrases)]:
        place(piano(midi_hz(penta[idx] + 12 * (p % 3 == 2)), d * BEAT + 1.4, 0.13, bright=1.3), start + b * BEAT, pan=0.15)
    start += 2 * BAR + (BAR if p % 2 else 0)
    p += 1

# final chord
place(piano(midi_hz(41), 6, 0.3, 0.6), TOTAL - 4.5)
for m in [60, 65, 69, 72]:
    place(piano(midi_hz(m), 6, 0.14, 0.9), TOTAL - 4.5 + rng.uniform(0, 0.05))

# reverb: decaying stereo noise impulse
ir_n = int(SR * 2.6)
tt = np.arange(ir_n) / SR
sos = butter(2, 5000, "low", fs=SR, output="sos")
irL = sosfilt(sos, rng.normal(0, 1, ir_n)) * np.exp(-tt / 0.55)
irR = sosfilt(sos, rng.normal(0, 1, ir_n)) * np.exp(-tt / 0.55)
irL[0] = irR[0] = 0
wetL = fftconvolve(L, irL)[: len(L)]
wetR = fftconvolve(R, irR)[: len(R)]
wetL /= np.max(np.abs(wetL)) + 1e-9
wetR /= np.max(np.abs(wetR)) + 1e-9
dry = max(np.max(np.abs(L)), np.max(np.abs(R))) + 1e-9
mixL = L / dry + 0.32 * wetL
mixR = R / dry + 0.32 * wetR
n = int(SR * TOTAL)
mixL, mixR = mixL[:n], mixR[:n]
tt = np.arange(n) / SR
env = np.minimum(1, tt / 2.0) * np.minimum(1, (TOTAL - tt) / 3.0).clip(0, 1)
stereo = np.stack([mixL * env, mixR * env], axis=1)
stereo *= 0.6 / np.max(np.abs(stereo))  # peak about -4.4 dBFS
from scipy.io import wavfile
wavfile.write(OUT, SR, (stereo * 32767).astype(np.int16))
print("wrote", OUT, f"{TOTAL:.1f}s")
