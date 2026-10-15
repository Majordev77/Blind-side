# Stereo test: pan_sweep.py

## What it proves
We can create a stereo audio file offline with code (no phone recording),
and the left and right channels carry different sound. This is the path
the Blind Side demo clip will use.

## How to run it
From the repo root:

    python scripts/pan_sweep.py

This creates `pan_sweep.wav` in the repo root (not committed: re-run to regenerate).

## What you should hear
A 3-second 440 Hz beep (the note A):
- 0 to 1.5 s: left ear only
- 1.5 to 3 s: right ear only

Tested on Windows and on a phone with wired headphones.

## How it works
1. The file is 44,100 samples per second, 2 channels, 16-bit.
   The loop runs 132,300 times (3 seconds), once per moment.
2. `pan` is 0 (left) for the first half and 1 (right) for the second half.
   Left volume = 1 - pan, right volume = pan.
3. `math.sin` gives the beep between -1 and 1. We multiply by 32767 and
   use `int` because 16-bit WAV stores whole numbers from -32767 to 32767.
4. `struct.pack("<hh", left, right)` packs both numbers into 4 bytes,
   and `f.writeframes` writes them into the file.

## Gotcha
If both ears sound the same, check Windows: Settings > Accessibility >
Audio > Mono audio must be Off. Test with a known "left right stereo
test" video before blaming the code.

## Known issue
There is a small "pop" at the end because the sound stops abruptly.
A short fade-out would fix it.