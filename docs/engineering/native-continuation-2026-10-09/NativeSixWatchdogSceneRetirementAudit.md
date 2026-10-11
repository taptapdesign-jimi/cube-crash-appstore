# Ordinary-six watchdog: actual Scene retirement audit

Status: OPEN; no Scene watchdog integration or physical acceptance claimed.

The original `src/modules/app-core.ts:10389–10418` schedules the ordinary nonfinal destination watchdog at 1200 milliseconds, releases the exact cleanup token and removes only the destination. The genuine main onComplete at 11769–11808 separately removes the source if the destination was destroyed. This is not normal main arrival or reward/spawn accounting.

Current private implementation inspected at `/tmp/native-resume-20261009/source/native`:

1. `NativeBoardScene.swift:1557` claims the actual nonfinal destination, but does not schedule the watchdog.
2. `NativeSourceMergeSixMainCapture.swift` requires both captured nodes for retention and main completion; `capturedObjectRetired()` cancels the entire pair.
3. `NativeBoardScene.swift:1594–1596` supplies a main-animation current predicate requiring both physical nodes. `NativeSourceMergeSixAbsorbOwner.swift:40–45` calls this predicate on every paint, including initial lazy pose capture. Merely relaxing mainCompleted is insufficient: the source would stop painting after destination retirement.
4. `NativeBoardScene.swift:3280–3286` treats destination absence as invalidation and immediately retires the entire contact. Merely changing the animation predicate is insufficient.
5. Destination face cancellation callbacks call capturedObjectRetired; intentional watchdog disposal must be recognized before disposing that exact destination. Full Scope destruction and actual source destruction must still cancel immediately.

Required next implementation: an exact accepted ordinary-nonfinal capture receipt marking canonical destination-only removal, preserving the exact source node/current generation through main paint, retention and Scene synchronization; genuine main callback then retires the remaining source without normal main arrival. Whole-context/source destruction and actual main interruption retain existing pair cancellation. No timeout may synthesize main completion. Read actual live final flags for watchdog exemptions rather than elapsed-time or child-hidden inference.

Required mounted proof: genuine accepted contact, paused main before80ms, actual independent APP wall1200, destination-only canonical and physical removal, source identity/accounting/RNG preserved, then resume genuine main and verify separate source cleanup without reward/spawn. Include disposal while paused, stale generation/token, same-ID replacement and final exemptions. Existing component wall test and Core destination-only test do not prove these Scene paths.

No product assets, live Native implementation, PWA, phone installation or default activation flags changed by this audit.
