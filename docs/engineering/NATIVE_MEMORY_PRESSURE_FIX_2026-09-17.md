# Native memory-pressure repair — 2026-09-17

## Proven defect

`src/main.ts` native warning handler called `memoryManager.performCleanup()` inside an empty catch. The actual manager exports `cleanup()` and no `performCleanup`; main is ts-nocheck, so the missing method survived compilation and every warning silently skipped this step. Calling generic cleanup instead would remove registered listeners independent of gameplay ownership, so the repair uses feature-owned idle release.

Recorded second thermal run: gameplay warning17:59:10 retained24,352,700 idle decoded audio bytes and11,986,380 idle shared-sheet bytes (~34.7MiB combined) unchanged in before/after snapshots. Home warning18:01:00 retained34,431,560 idle audio bytes (~32.8MiB). These are known reclaimable cache references, not total physical RAM or proven heat contribution. Map-entry warning had only1,715,848 idle audio bytes and0 sheet bytes, so this repair does not explain or solve the entire map pressure event.

## Change

- `releaseIdleDecodedGameplayAudio()` trims the existing cache against zero only on explicit OS memory pressure, protecting active voices and pending playback users. Routine64MiB budget and playback behavior unchanged; cache can refill on demand.
- `releaseIdleSharedPixiSheets()` releases only zero-reference families through existing generation-safe unloading and cancels their eviction timers. Live controllers/resource leases retained.
- Native handler invokes both owners and retains renderer textureGC; async completion emits its own resource snapshot. Does not call generic listener/object cleanup.
- No asset files removed/optimized, no visual/FPS changes, no native sync/install.

## Validation

Targeted audio/sheet tests34 PASS; actual native-handler callback regression1 PASS; Gameplay KING24suites306tests PASS. qa:fast8/8 PASS; qa:full13/13 PASS,345suites2282tests. Production dist built without native sync; HTTP localhost:5174 verified serving corrected handler. Physical thermal effect remains NEEDS PHYSICAL TEST. Pending predecode audio may still finish after warning; this patch clears resident idle buffers, does not cancel decoding or alter pending voice scheduling.
