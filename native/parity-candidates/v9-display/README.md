# Isolated v9 display package for the primary migration conversation

User authorized this secondary conversation to finish **separate display work**.
This directory is **not linked to either Xcode target**. It does not replace the
primary closed snapshot or change its Scene, cadence, HUD, pause, rules or saves.
It is a finished, executable display candidate, ready for primary integration.
Phone visual/animation acceptance remains **NEEDS PHYSICAL TEST**.

## Ready pieces

1. `NativeBoardGeometry.swift`: source final board scale/position, with existing
   cell hit behavior retained. `GeometryCheck.swift` is a macOS proof adapter,
   not shipping code.675 original final-layout cases execute via immutable-v9
   owner slices. Maximum error1.14e-13; every grid center retains its cell.
   Primary can copy this file and use its viewport/safeInsets initializer from
   its single geometry owner. Existing provisional-bounds initializer remains.
2. `NativeRegularSixMultiplierGlyph.swift`: original uncapped ×2/×3/×12/×99,
   Arial800(default installed bold face),33px, white fill/brown2px outline.
   It draws outline then fill, matching actual Pixi CanvasTextSystem, so the
   outline cannot eat the bold white ink.12 actual UIKit density/depth raster
   cases prove fully opaque source-fill pixels survive and nothing clips.
   `multiplier-integration.patch` applies to the primary closed snapshot's
   existing ordinary6 carrier; `multiplier-tests-integration.patch` updates its
   SKLabel-specific regression assertions. Copy helper into
   `native/gameplay-ordinary-six/`, then integrate those small patches. The
   full candidate carrier is provided for review, not a second runtime owner.
3. `NativeNoMovesPlan.swift`, `NativeNoMovesCloudPlan.swift`,
   `NativeNoMovesPresentation.swift`: original **No Moves** casing, separate
   Baloo2-ExtraBold glyphs, randomized sizes/alpha/tilt,8 staggered3D letters,
   original yoyo idle motion and captured3D exit, plus5 original finite clouds.
   Letter motion matches20,832 executed original GSAP poses within5.01e-7;
   clouds match45 plans/9,906 poses within9.60e-7. These bounds cover GSAP's
   six-decimal property/seven-decimal timeline rounding; no relaxed aesthetic
   acceptance is inferred. Actual UIKit probe checks resources, casing,
   no autonomous CA clock, finite cloud completion, captured/duplicate exit,
   dispose twice, late paint and missing-resource rejection.

## NO MOVES integration boundary

The primary conversation owns the canonical candidate and terminal receipts.
Create one display per **captured generation/candidate identity**, as a sibling
above gameplay rather than inside the HUD, with original Baloo2-ExtraBold font
and four original cloud images prepared through existing scoped resources.
The renderer never chooses whether moves remain and never acquires input locks.

Supply **decorative RNG**, never the gameplay random-choice stream. Pass local
elapsed seconds from the existing primary clock to `paint(at:)`. Stop paint
calls during hidden/background/modal suspension; no second ticker or listener
is needed. Capture the exact current local time with `beginExit(at:random:)`;
its original finite exit duration is1.07s. `onExitFinished` reports true only
once after the caller supplies the final elapsed sample. Disposal/replacement
reports false once. Only the primary receipt may continue the fail flow.
Do not add a new1500ms candidate timer or alter confirmation/commit ordering.
Existing primary NO MOVES audio remains sole sound owner; this view is silent.

Clouds finish independently within their authored finite tails. Enter/reveal,
modal pause, ReduceMotion and primary typed rendering leases remain primary
integration responsibilities. `owners.json` maps these boundaries;
`feature-runtime-record.json` is a ready registry record to adapt to the final
shipping paths at integration. Neither file claims shipping admission.

## Evidence and reproduction

From repository root, `./native/parity-candidates/v9-display/verify.sh` reruns
all source/math proofs. Supply an already booted QA Simulator UUID to also run
the small actual UIKit/SpriteKit probes (no game install or launch).

Individual oracle regeneration:

```
node native/parity-candidates/v9-display/export-geometry.cjs
node native/parity-candidates/v9-display/export-multiplier.cjs
node native/parity-candidates/v9-display/export-no-moves.cjs
node native/parity-candidates/v9-display/export-no-moves-clouds.cjs
```

Each exporter reads `git show production-benchmark-v9:<source>`; it cannot
silently compare against a changing current source. JSONs are raw deterministic
oracle receipts. Swift check drivers accompany all probes. UIKit probes are
small command-line Simulator executables, **not installed apps**, and never
launch the game or its target. Previews are diagnostic UIKit rasters with seeded
randomness, not accepted phone screenshots.

`verification.txt` contains final probe/gate receipts. Feature gate and qa:fast
PASS; KING24suites/330tests PASS. These existing source gates do not replace the
new native probe receipts. Full qa:full/whole primary Xcode suite is not rerun
here: primary owns final integrated source/build admission. No phone operation,
PWA sync, assets mutation, commit or push was performed.
