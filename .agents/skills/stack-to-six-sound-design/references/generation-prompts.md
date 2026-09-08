# Sound generation prompts

## Reusable master prompt

Create an original, production-ready one-shot sound effect for **Stack to Six**, a cheerful tactile puzzle game made of animated painted wooden cubes. The sound must feel **cartoony, bouncy, rich, happy, fast, warm, wooden, juicy and clean**. Synchronize the primary transient to the exact visible contact frame.

Build the cue from two to four compact layers: a readable transient, a damped wooden toy-block body, a playful rubber/pluck pitch gesture, and only a very short air or swoosh sweetener when motion needs it. Keep the useful energy in the phone-speaker midrange. The result must remain pleasant after many repetitions and leave headroom for music, haptics and larger Wild/Special effects.

Do not use long reverb, cinematic sub-bass, harsh realistic destruction, glass/metal dominance, casino chimes, generic notification clicks, piercing highs, clipped transients or a musical phrase. No ambience and no silence before the action. Export a clean mono 48 kHz lossless WAV master with a click-free tail.

Action: **[ACTION]**
Visual timing: **[CONTACT AND MOTION DESCRIPTION]**
Target duration: **[DURATION]**
Target peak: **[PEAK DBFS]**
Variant instruction: **preserve the identity but vary pitch 2-5%, transient texture and internal timing 8-25 ms**.

## Gameplay Board action inserts

- `tile-pickup`: tiny rising brushed-air lift, light painted-wood tick and soft rubber pluck; 110-160 ms; -9 dBFS.
- `invalid-drop`: friendly downward wooden tuck with a rounded pitch fall; no error buzzer; 140-200 ms; -11 dBFS.
- `stack-light`: immediate compact toy-block contact, warm hollow wood body and tiny settled boing; 170-230 ms; -7 dBFS.
- `stack-heavy`: deeper double wooden bump with a short restrained low body and small upper crack; 230-320 ms; -5.5 dBFS.
- `spawn-pop`: quick upward air scoop into a soft bubble/rubber pop and miniature wood landing; 170-230 ms; -8 dBFS.
- `combo-step`: short bright wooden/plucked punctuation, rising but not melodic; 120-180 ms; -9 dBFS.
- `combo-milestone`: compact happy two-part knock/pluck reward, clearly above combo-step but below merge-6; 260-340 ms; -6.5 dBFS.
- `hud-tap`: dry miniature wooden interface tick with a soft rounded tail; 55-100 ms; -11 dBFS.
- `hud-sheet-open`: short soft upward paper/air swoosh resolving into a wooden pop; 190-260 ms; -8.5 dBFS.
- `hud-sheet-close`: short downward air tuck and light wooden settle; 150-210 ms; -9.5 dBFS.

Generate two to four genuinely related variants for frequent actions. Never bake Wild/Special identity or board-transition scenery into this ordinary Gameplay Board family.
