# TNT / Flower frame retirement

User authorized the next runtime memory optimization while preserving gameplay and authored visuals.

## Change

Successful finale warmup promises and pooled Pixi sprites previously retained textures across gameplay exits. The new `TntFrameCache` retains them throughout gameplay and retires only on the explicit `cleanupGame` boundary, after TNT and generic FX cleanup. This is a bounded session lifetime, not a claim of a global app-memory cap.

Only exact TNT smoke and Flower bush/burst paths can be unloaded. Shared tile textures, idle artwork, other variants, audio, DOM images and asset files are untouched. Sprite pooling remains, but idle pooled sprites hold `Texture.EMPTY` instead of the previous frame.

Retirement waits for pending warmups. Parallel loads settle completely even when one fails, so late successful sibling loads are included. A new request cancels retirement before unload; after unload starts it waits for that operation, then reloads and revalidates. Failed unloads remain tracked for the next exit. Active finale/burst consumers veto release. Fulfilled warmup memoization is invalidated together with retirement. Existing merge preload readiness remains; the continuation now rechecks destination and gameplay generations after its await before applying any gameplay mutation.

No mid-game timer, global FPS change, texture downsizing or asset modification. Reentry after completed retirement needs fresh decoding; spawn warmup and merge readiness protect correctness, but physical reentry smoothness must be measured. This does not establish the cause of the reported reset or quantify thermal savings.

## Validation

Focused owner/cache suites:3 suites /15 tests PASS. Coverage includes actual preload→retire→reload, pending decode with sibling failure, active-consumer veto, fast reentry, reentry during unload, unload failure, shared-source exclusion, pool detachment and cleanup/merge wiring. Full run:352 suites/2323 tests PASS, KING24/306 PASS, lint/build/audits PASS. Initial full command exited1 on two TypeScript gates because of an overloaded Assets.load test-mock comparison. Test-only String(source) correction applied; both exact type gates rerun separately exit0, affected3 owner tests rerun PASS. All selected gates now pass; original failed command retained in raw log. Independent review found no blocking correctness issue and reran2 suites/11 tests PASS. A late new warmup can conservatively cancel retirement and retain resources until the next exit; safety takes precedence over reclaiming in that race. Localhost5174 serves the new cache module. No native sync/build/install; installed phone unchanged.
