# Runtime work repair — 2026-09-17

User authorized the complete confirmed findings from RUNTIME_WORK_AUDIT_2026-09-17.md. Three agents implemented separate owner changes; independent reviews and parent integration checks cover their intersections. Existing dirty work and supplied assets are preserved.

## Repairs

- Laser media failure callbacks retire with their scene. A late play rejection after cleanup cannot disable HEVC for a subsequent scene; active media errors still select the authored fallback.
- Journey smoke captures the old card for bookkeeping, clears its own reference, then returns to the shared DOM pool. Reuse no longer retains the detached card/world.
- GraphicsPool reduces global GSAP searches from 15 to 3 per reused acquire/release cycle while preserving cleanup before detach, after synchronous removed callbacks, and on reuse. Fresh unpublished allocation and prewarm skip tween searches. Tests use actual GSAP/Pixi behavior, including paused/delayed and multi-target tweens; killing a whole array naively is insufficient for dormant tweens.
- Drag retains synchronous foreground/artwork refresh and reference-counted ownership while retiring unused bounds publication and its layout reads. Pointer diagnostics check enablement before geometry collection. The retired overlap path's remaining hidden Fish footprint producer is removed as well.
- Global cubes-cracked accounting remains at the gameplay owner; direct per-board tracking avoids calling the combined compatibility bridge a second time. The existing public bridge remains global-plus-board. Board identity is captured before lazy imports.
- Save equality excludes timestamp metadata and includes the destination key. Only successful writes update the cache; a removed or externally changed durable copy is written again. Restore/reset integrate the same owner. Save schema, immediate lifecycle persistence and transient-state guards remain intact.
- High-score persistence has one verification owner instead of repeating normal-path reads. Exceptional mismatch/retry and storage failure handling stay bounded.
- Merge diagnostics check logging enablement before collecting their board snapshot. The central final-merge resolver and actual terminal checks are unchanged.

## Future safeguards

BACKGROUND_WORK_CONTRACT.md now covers pool boundaries, former-owner references, single statistics ownership, keyed durable save deduplication and early diagnostics guards. SPECIAL_DICE_PERFORMANCE_CONTRACT.md explicitly requires disposed-media rejection and immediate-reentry coverage. Behavioral regression tests accompany the implementation.

## Deliberately retained

Robo's 16 finale texture cache entries are bounded reusable resources (about 3.53 MiB calculated RGBA pixels, not measured device residency). There is no demonstrated unbounded leak. Unloading on each finale would risk active/pending shared resources and introduce repeat decoding. No asset is deleted, recompressed or replaced, and no shared texture is destroyed speculatively.

## Evidence and verification

Original reproduction output remains in logs/runtime-audit-round2-20260917. Running the same actual-source probe after repair writes logs/runtime-work-repair-20260917/resource-owner-after.json: both retained-card flags and the disposed-Laser failure flag are false; the next scene contains video. Regression tests also exercise active fallback and overlap bookkeeping.

- Independent effect/memory, pool/drag and save/statistics reviews: PASS; reviewer logs retained in the evidence folder.
- Initial qa:fast failed three extraction-fixture suites because they still injected the retired save string/bounds helper. Updated fixtures inject the real save writer and renamed refresh dependency; original behavioral assertions remain. Kanta extraction boundaries now explicitly assert valid anchors. Original failure output is preserved as qa-fast.log.
- Final qa:fast: PASS, all 10 gates; 197 suites / 1,572 tests (qa-fast-final.log).
- Final qa:full: exit 0, all 16 gates; 371 suites / 2,399 tests (qa-full.log). Gameplay KING independently passed 24 suites / 306 tests in that run.
- TypeScript, unused-code audit, lint, visual contracts, production build without native sync, built-bundle audit and native source guard: PASS.
- Built entry index-DMZVjhOO.js retains deferred app-core-Ccb6h8H3.js; startup source graph has 166 eager modules and the gameplay runtime remains deferred.
- HTTP localhost:5174 returns 200 and serves the new save/foreground owners. This is source-serving evidence, not a browser visual acceptance or physical performance test.
- Final diff hygiene: PASS.

## Delivery and limits

Source and local dist are updated. No native sync, native build, install or physical capture is part of this repair. Phone build remains unchanged. Source work counts and lifecycle correctness do not prove sustained FPS or the dominant thermal cause. Physical animation/drag/thermal acceptance remains NEEDS PHYSICAL TEST after web acceptance and authorized bundled delivery.

## Subsequent user-authorized native delivery

On September 17, the user explicitly requested installation. Official Web.bundle synchronized; qa:ios PASS, Xcode BUILD SUCCEEDED, signed bundle verified. Entry SHA fffc507587a30d878579f6bd03941eb826e509824ad0766433ca79ff2224397c matches dist/Web.bundle/final app; all 1,766 raw assets match. Explicit App installed on iPhone 13 blue, container B1DD42B3-A28B-45BE-81B9-6A43F1334E17, followed by successful exact-bundle launch. Existing app data preserved by install-over; bundled mode retained. This supersedes the earlier not-installed status. No physical performance acceptance or active capture is implied.
