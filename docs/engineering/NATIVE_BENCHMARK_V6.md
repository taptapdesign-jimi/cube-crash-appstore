# Native benchmark v6 — Backpack animation and navigation polish

User-requested continuation checkpoint, 2026-10-16, on `main` in the existing
PUBLIC repository `https://github.com/taptapdesign-jimi/cube-crash-appstore`.
Immutable recovery tag: `native-benchmark-v6`. Continue Native work from this tag.
All earlier Native benchmark tags and the separate approved PWA recovery
reference `production-benchmark-v9` remain unchanged.

## Included work

- All tracked and non-ignored pending work since v5: Native source, original
  supplied Cubero PNG/SVG artwork, regression tests and ownership/handoff docs.
- Backpack detail uses the shared authored modal entry/exit/drag, rounded paper
  without the folded bottom edge, no yellow area badge, and body-based spacing.
  Selected animation resources prepare under existing cancellation/visibility
  owners; no gameplay engine or gallery-wide animation renderer is introduced.
- Selected Barrel uses its full original SVG atlas; Flower pollen, Honey bees,
  continuous gentle TNT/Magnet/Bottle/Laser float, Fish original SVG playback
  at1.625x/60Hz, and Wee Bee at0.4356x board elapsed time are retained.
  Laser uses the original icon and a1s pause before each0.52s twitch.
- Ball retains the full original jump and body scale, highest point16pt below
  subtitle and landing64pt above card bottom. Per-open84-frame alpha scanning
  is replaced by independently verified immutable atlas geometry; original
  raw-pixel preparation overlaps base/atlas readiness. Actual Simulator modal
  entry measured0.230s; this is not a physical-device timing guarantee.
- Cubero detail uses supplied `cubero-animation.svg` and its authored warm RGB
  matrix, baked once into the selected atlas with exact original alpha bytes.
  Modal scale is1.33x baseline with previous spacing; original board SVG source
  and grid PNG remain separate. Requested grid-only icon reductions are included.
- Forest, Beach and Area55 expose the original Backpack icon. Closing Backpack
  returns to the same retained World and scroll position; Hub-origin returns to
  Hub. Backpack X starts all screen exit tracks immediately without stagger.
- Journey/Settings/Backpack/all three Worlds share Forest row Y centering.
  Backpack X matches24pt World artwork. Existing fonts, touch targets, header
  surfaces, shadows and route motion are preserved. Independent source and
  rendered-header review found no remaining alignment issue.
- Accumulated canonical progression/NEW-ribbon reconciliation, finite navigation
  feedback and shared Exit Game/High Score/Backpack modal entry refinements.

## Validation

- Full deterministic QA PASS530 suites/4010 tests, plus Gameplay KING330 and all
  selected source/build/admission gates: `/tmp/nav-consistency-full.log`.
- Fresh pure Swift gameplay PASS483/483 and state/save PASS43/43:
  `/tmp/native-benchmark-v6-{core,state}.log`.
- Latest focused Native SDK4/4 PASS covers actual six-screen label/button/image
  alignment, X size, navigation shadow and all World/Hub Backpack roundtrips:
  `/tmp/nav-consistency-sdk.log` and `.xcresult`.
- Cubero source/filter/alpha/timing/geometry SDK4/4 PASS:
  `/tmp/cubero-new-svg-alpha-sdk.log` and `.xcresult`.
- Ball actual-entry/pixel geometry/all84-frame metadata/preview lifecycle SDK4/4
  PASS: `/tmp/ball-final-parallel-sdk.log` and `.xcresult`.
- Selected Laser pause/float/preview lifecycle PASS:
  `/tmp/laser-pause-sdk.log`. Earlier focused Native receipts remain in
  CURRENT_HANDOFF; these results do not imply a full Native SDK suite rerun.
- Native original asset packaging PASS1979 byte-exact files; final source,
  compiled Release asset/dependency audit and strict codesign verification PASS:
  `/tmp/nav-phone-{ios,release,release-audit}.log`.

## Phone delivery and limits

Latest runtime source installed in place on iPhone13blue on2026-10-16, exact
bundle `com.taptapdesign.stacktosix.native`, signed Release1.0/build1.
Executable SHA256:
`b19c76a9accd5e0e79676e281e8cbfd6499b46a7b10d00f3fbd07d67c0611fc1`.
Normal launch and exact installed process confirmed. Both current/previous
state-v1 JSON files were byte-identical before build, immediately preinstall,
after install and after launch: `/tmp/nav-phone-save-comparison.json`.

Publication adds only checkpoint/continuation documentation beyond that runtime.
It does not rebuild/reinstall the phone, touch the preserved PWA/legacy shell,
reset saves, rewrite earlier tags, or publish ignored binaries/private saves.
This is a user-selected source checkpoint, not complete Native/PWA parity or
physical touch/audio/haptic/FPS/thermal acceptance. Those remain NEEDS PHYSICAL TEST.
