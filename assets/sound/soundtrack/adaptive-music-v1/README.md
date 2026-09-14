# Stack to Six adaptive music prototype v1

These source-audition layers are derived from the preserved current theme and are runtime-integrated for Arcade evaluation.

- Detected working tempo: **116.6 BPM**
- Structure: **24 bars**, stereo, 48 kHz, 24-bit PCM WAV
- Seam: one-bar equal-power musical overlap
- Calm: stronger centre-band reduction to create SFX and sax headroom
- Active: retains more thematic midrange for higher gameplay energy
- Original theme bytes are unchanged

Runtime map:

- Menu / Homepage / Journey Hub: original full theme
- Arcade gameplay entry and each new round: Calm
- First committed Merge-6 or Wild Merge-6 in the round: Active, phase-matched on the next bar
- Clean / Fail result: current Arcade bed lowered under saxophone and result cues
- Journey gameplay: existing original-theme duck plus authored World ambience; these Arcade layers do not replace it

Because the only source is a 64 kbps MP3 stream inside a WAV container, these are production-direction prototypes rather than final lossless stem masters.
