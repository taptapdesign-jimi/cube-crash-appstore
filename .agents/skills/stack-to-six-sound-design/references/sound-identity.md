# Stack to Six sound identity

## Core feel

Stack to Six is a cheerful tactile puzzle toy, not a sterile UI and not a cinematic action game. Cubes should feel like friendly painted wooden pieces with elastic cartoon life. Every successful action should be legible, rewarding and slightly surprising without becoming loud or exhausting during repeated play.

Keywords: **cartoony, bouncy, rich, happy, quick, warm, wooden, juicy, playful, clean, tactile**.

Material vocabulary:

- warm wood knocks, hollow toy-block bodies and soft mallet contacts;
- tiny cracks, chips and papery splinters for break detail;
- rubbery boings, pitch scoops and compact pops for cartoon life;
- brushed-air swooshes for movement;
- layered bumps, drops and restrained boom-boom impacts for weight;
- bright marimba, pluck or bubble-like tonal accents for rewards.

## Shape and amplitude

- Frequent taps: 55-120 ms, normally peak around -12 to -9 dBFS.
- Pickup, drop and stack: 90-260 ms, normally peak around -10 to -6 dBFS.
- Merge/reward accents: 180-550 ms, normally peak around -8 to -4.5 dBFS.
- Major authored finales may be longer, but belong to Wild/Special or Board Transition work.
- Keep at least 3 dB of mix headroom. Loudness must come from readable layering and midrange body, not clipping or excessive low bass.
- Put useful energy in the phone-speaker range, roughly 180 Hz-6 kHz. Sub-bass may support a major boom but must never carry the cue alone.
- Use very short attacks for contact, 5-20 ms attacks for pops/swooshes, and decisive tails. Silence after the idea is complete.

## Layer recipe

A rich cue usually needs only two to four small layers:

1. **Transient:** tap, click, crack or noise tick that locates the frame.
2. **Body:** damped wooden resonance or compact rounded thump.
3. **Character:** pitch bend, boing, pluck or second offset impact.
4. **Air:** optional short swoosh or sparkle; never a permanent reverb wash.

Vary timing by 8-25 ms, pitch by about 2-5%, body resonance and transient texture. Preserve the action's identity across variants.

## Hierarchy

- Empty/invalid action is softest and slightly downward in pitch.
- Pickup is light and rising.
- Valid stack is warmer, firmer and downward-to-settled.
- Deeper stack adds body, not merely volume.
- Merge-6 is clearly above a normal stack but must leave space for Wild/Special finales.
- HUD taps are smaller and drier than board contacts.
- Success may rise in pitch; rejection should settle downward without sounding punitive.

## Avoid

- long whooshes on tiny movements;
- identical repeated samples for high-frequency actions;
- glass, metal or sci-fi dominance in ordinary wooden gameplay;
- realistic gunshots, gore-like breaks or threatening explosions;
- piercing 2-5 kHz clicks, crushed limiting, audible DC pops or clipped tails;
- musical phrases that fight the soundtrack;
- sound on every drag frame, score increment or ambient loop.

## Export baseline

- Master candidate: mono PCM WAV, 48 kHz, 16-bit or 24-bit.
- Keep lossless masters. Encode delivery formats only after approval and native verification.
- File names: lowercase kebab case plus two-digit variant, for example `stack-light-02.wav`.
- Record duration, peak target, intended trigger and approval state in a manifest.
