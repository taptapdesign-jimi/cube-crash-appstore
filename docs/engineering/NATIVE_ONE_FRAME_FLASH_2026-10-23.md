# Native one-frame flash investigation — 2026-10-23

Status: **PASS deterministic fix; refreshed Simulator ready; user review OPEN.**

User supplied a single recorded frame and confirmed **Native Simulator**, during
**ordinary merging**, not specifically a Special finale. In that frame some
ordinary faces sample white circles and HUD artwork samples small primitive-like
marks; other faces, pips, text and paper remain visible. This is an observation,
not proof of a CSS, mipmap, atlas or GPU-command failure.

## Evidence and boundaries

- Active standalone surface is `NativeOwnedMetalGameplayView` / `SKRenderer`,
  without a CSS gameplay renderer.
- Three parallel source reviews found no scene-level assignment transferring
  smoke/pip artwork into HUD/ordinary faces. Affected texture categories use
  mipmaps; **not every mipmapped sprite is corrupted**. Correlation only.
- Original host permitted three outstanding GPU commands on one mutable
  `SKRenderer`. A changing-texture raster reproducer now proves incorrect
  texture assignment while prior command buffers remain outstanding.
- Existing isolated HUD quality tests wait for completion of each sample and
  therefore do not establish temporal stability under concurrent submissions.
- Retained Simulator log query `/tmp/native-flash-retained-render.log` returned
  no matching Metal/texture/GPU/error event in the last20minutes. Its time window
  is not established as the recording's time; absence is not causal evidence.

## Changes

- `NativeOwnedMetalGameplayView`: bounded, lock-protected submitted/completed/
  failed command counters; one bounded last failure including captured epoch
  and generation; first four failures log `CC_NATIVE_RENDER_FAILURE`. Completion
  handlers do not access Scene or UIKit. No render scheduling/quality change.
- `NativeOwnedMetalProjectionTests`: per-frame GPU readback with three separate
  targets and multiple commands in flight, authored ordinary/HUD/pip textures,
  fresh circle/dot rasters and interleaved transient shapes, mipmaps on/off.
  Generic raster stress does not reproduce actual gameplay automatically.
- Final control changes ordinary skins and four fractional poses each frame,
  comparing every output to its matching serial reference. One-flight controls
  passed120frames per mipmap setting. Three-flight failed328/1200frames with
  mipmaps and667/1200without, `/tmp/native-flash-flight-control.log`.
  All GPU commands completed successfully. Actual/reference PNGs were visually
  inspected: one face samples a different ordinary skin while its geometry and
  surrounding artwork remain correct. Evidence retained at
  `/tmp/flash-flights-3-mips-{true,false}-{actual,reference}.png` and xcresult
  attachments. This proves an overlapping-render resource defect, not a mipmap
  defect. The exact recorded white-circle frame was not replayed.
- Fix limits the existing nonblocking admission to one outstanding frame.
  An occupied slot skips that display callback without updating/encoding the
  renderer. No main-thread wait, FPS cap, asset/filter/density/mipmap change.
  Slot remains owned through command completion, including failed commands,
  across Scene replacement. Wall-clock animation ownership is unchanged.

## Validation ledger

- **PASS** `qa:ios`, `/tmp/native-flash-ios.log`.
- **PASS** initial240frame test + projection tests,
  `/tmp/native-flash-stress-sdk2.log`.
- **PASS** expanded2400frame stress + renderer lifecycle/projection17tests,
  `/tmp/native-flash-stress-sdk3.log`; no detected texture substitution.
- **PASS** initial full QA `/tmp/native-flash-full.log`, before one-flight fix.
- **PASS** final2400frame one-flight changing-skin/pose regression, both mipmap
  settings;18Native admission/lifecycle/projection tests,0failures10.466s,
  `/tmp/native-flash-final-sdk.log`. Test reads production admission constant;
  `CC_NATIVE_UNSAFE_RENDER_REPRO=1` explicitly adds the old three-flight
  forensic comparison, intentionally failing on reproduced corruption.
- **PASS** final fast QA `/tmp/native-flash-final-fast.log`; final Native target/
  original-byte audit `/tmp/native-flash-final-ios.log`.
- **PASS** final full QA `/tmp/native-flash-final-full.log`:530suites/4010tests,
  Gameplay KING330 and all admission/build/source gates; no native bundle sync.
- **PASS** normal complete-tree Debug build `/tmp/native-flash-preview.log`,
  exact `.native` bundle/no test PlugIns. Install-over retained Jimi1018app,
  normal launchPID13963 (`/tmp/native-flash-{install,launch}.log`). Both primary
  and previous save files byte-identical before/after install/normal launch,
  `/tmp/native-flash-save-{before,after,afterlaunch}.json`.
  CUA verifies normal Home and visible iOS **Silent Mode On** banner.
  No uninstall/reset, physical install, PWA sync or publication. QA rebuiltdist.
- **OPEN** exact ordinary-merge incident reproduction/correlation and user review.
- **NEEDS PHYSICAL TEST** any claim about physical iPhone behavior; user reported
  this incident on Simulator. No physical installation authorized/performed.

Do not disable mipmaps, reduce render density/FPS, replace artwork or switch
renderers to address this defect. Preserve original assets, retained app data and
unrelated dirty work. User acceptance of ordinary merging on the refreshed
Simulator remains separate from the deterministic rendering regression.
