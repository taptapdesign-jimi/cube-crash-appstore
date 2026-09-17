# Runtime quality priorities — 2026-09-17

Objective: retain authored gameplay, input, animation, audio, art and timing while eliminating avoidable work. No engine migration, global FPS reduction or asset modification is proposed.

## Evidence and priorities

1. **Avoid unrelated core-TNT preloads on variant spawn (implemented; full QA PASS).** Variant-aware spawning warms Flower/LaserGun FX, then `openAtCellCore` independently warms default TNT before variant identity is applied. Pass the existing variant warmup promise through the wrapper to the cell owner; retain default preload for ordinary TNT and the existing merge-time readiness/retry barrier. Twelve unrelated TNT frames estimate23.85MiB decoded RGBA when not already cached. Tests must cover variant forwarding, absent extra default preload, default TNT readiness and rejected warmup handling. No texture eviction or asset edits.
2. **Remove duplicate Fish style reads (implemented; full QA PASS).** Fish `syncController` pins its wrapper every frame. The pinned-root helper unconditionally re-reads canvas computed style, although the shared layer already read it. N Fish-like owners therefore produce 1+N reads per warmed shared update. Guard helper synchronization on root creation/reparenting, retaining shared frame synchronization and explicit drag/finale refresh. Acceptance: one shared read for multiple warmed owners; live depth changes, portal attachment and cleanup stay correct. CPU/thermal savings are unmeasured.
3. **Bound inactive general FX texture retention (TNT/Flower session retirement implemented 2026-09-17).** `tnt-animation.ts` retains successful `preloadPromises` and Assets textures; pooled frame sprites retain texture references. TNT/Flower source dimensions estimate approximately 44.62 MiB RGBA combined after both families have loaded, outside the shared-idle-sheet cache policy. This is an estimate of decoded source sizes, not measured WebContent resident/GPU memory, and not proof of Jetsam. Implemented a conservative gameplay-exit boundary in TNT_FRAME_RETIREMENT_2026-09-17.md: narrow source ownership, pending-load settlement, unload/reentry serialization, active-consumer veto and pooled texture detachment. Other variants remain untouched; there is no global byte cap or mid-game eviction. Physical savings unmeasured.

4. **Close native reset telemetry gap (not implemented here).** Native lacks the public WebContent termination delegate callback. Persist a small bounded record with native PID, page/session identity, version, thermal state, route breadcrumb and last memory warning; pair with OS reports. Callback alone cannot distinguish crash from memory eviction. No blind reload. Last user test had stable native/WebContent/GPU PIDs; original reset remains unresolved.
5. **Batch stable geometry reads only where invalidation can be proven (audit candidate).** Shared artwork update still reads canvas/root geometry; owners can read then write their own geometry. Any cache must invalidate on viewport, scroll, transforms, modal flight, drag and reparenting. Do not substitute a stale screen-space cache for correct animation alignment. Measure this board-specific cost before a larger rewrite.
6. **Smooth transition preparation (measured symptoms, owner attribution pending).** Latest trace records isolated transition frames of 40–56 ms. Inspect decode/upload/layout around those exact timestamps; schedule optional preload away from input/transition, retain critical asset readiness and visible timing. Averages do not establish absence of stutter.

## Already repaired; do not count twice

- Ambient scrollTop caching removed a per-frame synchronous style/layout read identified in prior trace (~548 ms per20 s inferred map window).
- Main-cloud painted-leaf visibility replaces a full-map wrapper as visibility target.
- Artwork root style setters skip unchanged writes.
- Existing mobile controller already separates 60 FPS activity from30 FPS settled idle; adding another global throttle is not the next optimization.

## Validation and delivery

Use deterministic actual-owner tests first, then qa:full including gameplay-lock. Compare CPU time, retained-resource counts and worst frame separately; require one bounded equal-condition physical before/after to claim thermal benefit. A diagnostic run itself adds sampling overhead. Preserve native identity, save state and all assets. Show web changes at localhost:5174 and obtain web approval before phone delivery per LIVE_DEBUG_WORKFLOW.

This document is an implementation priority list, not a claim that the dominant thermal cause or previous spontaneous reset is solved.

## Current change review

Independent reviewer found no blocker in both scoped changes. Exact variant warmup is passed without awaiting it at spawn, preserving spawn timing; merge readiness remains the existing barrier. Artwork creation/reparenting and explicit drag/finale depth owners remain synchronous. Focused artwork tests:2 suites/30 tests passed. Full QA exit0 PASS:13 gates,350 suites/2312 tests; gameplay-lock24 suites/306 tests. Physical thermal effect remains NEEDS PHYSICAL TEST. Web source on localhost:5174 was fetched and verified for both repairs. No native sync, native build or install performed.
