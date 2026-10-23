# TapTapDesign gameplay theme v1

Source: `assets/sound/soundtrack/TapTapDesign-Stacktosixtheme.wav` (unchanged). Rebuild: `node scripts/build-taptap-gameplay-loop-v1.mjs`.

Two-bar original opening with an 80ms soft entrance, followed by a 32-bar circular loop. The last two bars blend back into the original opening on a complementary cosine curve; the source's final cadence/fade is excluded. Original pitch, stereo and speed are preserved. Tempo estimate: 118.08 BPM.

Native starts at zero and repeats from 4.065041666666667s to 69.10570833333334s using the existing sample-clock file transport. No recurring crossfade or second simultaneous gameplay layer. The separate `taptap-gameplay-loop.wav` is the same loop region without the one-time intro and can repeat from file start.

Automated sample/level checks are recorded in analysis.json. Musical seam and speaker mix require listening acceptance.
