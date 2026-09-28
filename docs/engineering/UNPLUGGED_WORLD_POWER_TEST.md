# Unplugged World power comparison

This is diagnostic attribution, not a gameplay or thermal fix.

## Prerequisite evidence

On 2026-09-27 the iPhone 13 blue was confirmed on `localNetwork` after the user
unplugged it. A 20-second attached-app Power Profiler preflight saved a trace
with 25 numeric SystemPowerLevel samples, 25 numeric process CPU-impact samples
and 2,609 native-app time-profile samples. `verify-instruments-capture.py` passed.
System power units are percent of full battery per hour, not CPU percent or watts.
The native-app CPU table does not substitute for a WebContent CPU profile.
Preflight evidence: `logs/unplugged-world-test-20260927/`; raw trace:
`/tmp/sts-unplugged-power-preflight-20260927.trace`.

## Controlled run

- Cool naturally to native `nominal`; unplugged, constant brightness, fixed Forest
  viewport with the brown card visible, no gameplay or touches during measurement.
- Keep audio unchanged throughout. Record current audio-isolation status; do not
  compare a silently isolated launch with a normal audio launch.
- Start Power Profiler wirelessly, attached by exact app name `Stack to Six`.
- Press `Unplugged · static / animated · 12 min` once. The panel hides.
- Five seconds lead-in, then four three-minute windows: static / animated /
  animated / static. Each window discards 15 seconds before 165-second measurement.
- Static holds the existing interim owner, GSAP global timeline, currently running
  Web Animations and existing ambient/Unit paint gates. It retains the image and
  canvas contents. It does not sleep the global ticker or change gameplay state.
- The existing one-second guard samples inline DOM state in both conditions.
  Static samples must stay identical, Web Animations must remain paused, and
  owner suppression counters must be nonzero. These checks are sampled evidence,
  not GPU measurements or proof that every possible rendering source is covered.
- Input, scene changes, backgrounding, stale native data, cable connection,
  brightness drift over two percentage points, persistence loss or serious/
  critical thermal state cancels the run and restores its held owners.
- Report progress every20–30 seconds from native receipts; system power comparisons
  are available after trace export. Do not invent live energy values.

## Persistence and analysis

The existing bounded native `Library/Caches/CCNativeThermal` file now includes
wall timestamps and selected thermal-test/soak messages, capped at720 total rows
per session and eight sessions. Native five-second cadence is unchanged. Fetch
the file after GOTOVO before any relaunch. Raw Power Profiler samples remain in
its separately saved trace. A Wi-Fi interruption can preserve native receipts
while invalidating power coverage; it is not proof of an app crash.

Export trace TOC and SystemPowerLevel, then run:

```
python3 scripts/analyze-unplugged-world-power.py CAPTURE.jsonl toc.xml SystemPowerLevel.xml
```

The analyzer rejects incomplete phases, insufficient power coverage, missing
static-owner receipts, sampled DOM changes and brightness changes. Report each
window plus initial/final static baseline drift. More than20% static-baseline
drift requires repetition rather than a causal claim. Native thermal states lag
workload; do not attribute a thermal transition to the immediately preceding
second. Any external notifications/background work are possible confounders.

A reproducible animated-minus-static power increase identifies aggregate visual
work as a contributor. It does not select a particular card, bee, Unit or leak.
If little difference remains, inspect shared/background work and a separately
controlled app/screen baseline. This run cannot promise exact Celsius readings
or identify a single culprit by itself.
