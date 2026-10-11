# Native frame pipeline audit — 2026-10-11

## Verdict and evidence boundary

**NEEDS PHYSICAL TEST.** This audit identifies measured CPU work and bounded
repairs; it does not establish sustained 60 FPS or a GPU bottleneck. Final coherent SDK146/146 and full QA4010/4010 plus gameplay-lock330/330 pass.
Signed Release/source/compiled audit/signature and Native-only install pass.
Post-install physical comparison remains pending. The profiled installed Native
was UUID `77AC452A-95F8-3D96-BE43-9B1CB5EC2799`, PID26002, bundle
`com.taptapdesign.stacktosix.native`. The preserved PWA was not modified.

The user capture ran from KRENI19:57:39.398 CEST through explicit GOTOVO
19:58:55.500. Source and app remained frozen during capture. Console and markers:
`/tmp/native-arrival-opacity-final-console.log` and
`/tmp/native-arrival-opacity-final-markers.jsonl`.

## Measured work

The active mixed gameplay/NoMoves/restart Time Profiler interval was
19:58:01.439–19:58:22.280, duration20.841s. It is not a continuous-drag interval
and does not capture the earlier19:57:56 callback gap. The mostly-idle comparison
was19:57:21.680–19:57:42.716. Trace exports:
`/tmp/native-drag-{active,idle}-time-profile.xml`, with corresponding
`/tmp/native-drag-{active,idle}-process-toc.xml`.

| Owner/work | Sampled CPU cost | Meaning |
| --- | ---: | --- |
| Source clock delivery | 422ms inclusive | Overlaps its RAF/ticker/render children; do not add these totals together. |
| Source RAF / ticker / render | 407 / 330 / 316ms inclusive | Existing frame transport, not new timers. |
| Repeated original texture receipt validation | 73ms | Thirty-path readiness checks repeatedly reached from current-owner admission. |
| NoMoves glyph painting | 125ms | Layer transaction/commit work under the glyph painter. |
| Cold fresh-entry texture preparation | 225ms | Restart preparation; about220ms attributed to fresh-entry decoding near15s. |
| Source physical capture | 32ms | Includes actual physical ownership checks. |
| Save calls | 50ms | Includes38ms canonical writes,8ms result commit and4ms flush. |
| Initial active shape-render work | 256ms in first8s | SpriteKit CPU work, not measured GPU frame duration. |

The separate idle audit attributed about397ms to shape-render CPU work. Regular
idle availability had no sampled hits in the active interval, so its source
complexity alone cannot establish it as the observed drag bottleneck. These
costs are sampling estimates, may overlap, and must not be interpreted as one
frame's latency.

Console telemetry confirms some Source/Scene gaps around300ms and earlier
drawable-exhaustion messages. Small touch/update CPU counters do not explain
those gaps. A requested or delivered callback rate is not a presented FPS count.

The bounded15s process-only GamePerformance capture after GOTOVO is
`/tmp/native-fps-before-game-performance-15s.trace`. Its independently resolved
rows are retained in `/tmp/native-fps-before-game-performance-independent.json`:
67 displayed-surface rows and63 presented-handler rows, across roughly1.335–
9.996s of trace time. The actual retained interval was20:06:42.373–52.373,
with zero drawable-wait rows. Surface gaps have median16.676ms, p9533.372ms and
maximum3654.610ms; handler gaps median17.305ms, p9534.175ms and
maximum3721.352ms. The retained image holds were3.655/3.405s; three roughly0.53s
bursts were38.7–43.1Hz, with some50ms gaps. Route/activity was idle or unknown. Long retained surfaces
can reflect unchanged idle content; these rows cannot certify or reject active
drag fluidity. The non-opaque direct-display labels also do not prove the cause
of stutter. No active-drag GPU duration or dominant GPU owner is established.

## Five bounded repairs in the current batch

1. **Original-resource receipt:** `NativeWildMeterDropResources` fully validates
   the actual texture publication before issuing its receipt. Repeated current
   checks use exact owner, immutable publication identity, epoch and readiness
   flags. Foreign owners, disposal, late completion and cancellation remain
   fenced. This removes repeated thirty-path scans without admitting substitutes.
2. **Static Source pips:** the two fixed15px/radius6 Source pip branches in
   `NativeDiceNode` borrow the existing shared `pipTexture()`. Centers, counts,
   embedded0.9 fill alpha, face ownership and RNG stay unchanged. Variable
   tutorial pips and stack overlays are outside this repair.
3. **Drag trail silhouettes:** `NativeDragTrail` uses shared circle/square
   rasters and bounded reusable sprites instead of recurring filled vector
   nodes. Existing Source particle plans, palettes, doubled fill/node alpha,
   positions, scales, timing, draw order and random draws remain owned by the
   same recipe; pooled nodes reset their presentation state.
4. **UIKit frame batching:** the existing Source RAF delivery in
   `NativeSourceAnimationClockService` encloses its captured callbacks in one
   outer `CATransaction`. Existing local painters retain their own transaction
   policies. There is no global action-disable, extra timer, callback reorder or
   microtask-boundary change.
5. **Fresh-entry preparation:** Bootstrap prepares the selected original
   foundation asynchronously and transfers its actual lease to restart/clean
   continuation. Generation/current-owner cancellation and resource disposal
   remain explicit. It moves cold preparation out of the synchronous entry
   constructor rather than replacing original textures.

## PWA v9 and Native ownership

The immutable `production-benchmark-v9` remains the behavioral reference. Its
latest-pointer handling schedules one existing RAF; Native's previously tested
Source drag queue now follows that model, including a synchronous final release
flush and exact Scope/generation/node admission. Programmatic moves keep their
existing synchronous seam. Neither implementation needs a second drag timer.

The PWA retains reusable empty-cell objects; Native's prior per-cell ghost pool
preserves row-major presentation/exit order. Particle pooling similarly keeps
finite lifetime and bounded reuse. Pixi Graphics uses its renderer's geometry
pipeline; a Swift `SKShapeNode` is not automatically the same implementation or
cost. Native shared raster silhouettes preserve the selected static visual
recipe while avoiding repeated SpriteKit shape work. This establishes selected
recipe/ownership parity, not identical whole-renderer or shared-RNG execution.

Canonical equality was independently checked before considering a mutation
epoch. The shipped Swift Array equality has a shared-buffer identity fast path.
The actual producer's `base=engine.state` normally retains that shared buffer.
A500k-comparison host benchmark against existing Core objects measured135ns per
45-tile shared-buffer comparison versus3192ns for independently allocated equal
tiles (`/tmp/native-state-equality-benchmark.swift`). No epoch was introduced.
Physical roster validation remains separate work and retains reentrancy fences.

## Verification and remaining acceptance

The initial grouped SDK run exposed fixture failures. The static-pip initial
fixture lacked the genuine Source outer timeline driver; it now installs that
existing driver before synchronization and keeps all45 physical-marker
assertions. No product guard was removed. Initial compile/fixture corrections
include the Continue test's missing SpriteKit import. The corrected final batch passes146 tests with zero failures, including all
5 actual restart/Continue/cancellation paths, Source clock37, drag dispatch5,
NoMoves graph10, trail raster3 and both static-pip tests. Terminal0 /
TEST SUCCEEDED: `/tmp/native-fps-repair-final-sdk-v2.log`.
Full QA4010/4010 plus gameplay-lock330/330: `/tmp/native-fps-repair-final-full.log`,
terminal0; production web QA uses SKIP_NATIVE_BUNDLE_SYNC=true and does not sync
or install the separate PWA. Current Native source audit also passes:
`/tmp/native-fps-repair-source-audit.log`.

Next acceptance requires the rebuilt exact Native on iPhone13blue, sustained
ordinary drag before merge6, Wild/Special arrival and merge6, restart/continue,
and a bounded active capture with route, target history, touch paint and actual
presentation evidence aligned. Physical touch/visual acceptance and measured
presented-frame cadence remain open even if deterministic checks pass.

## Current structure and product quality comparison

Read-only comparison to immutable v9: the preserved app-core.ts has17426 lines,
app-merge.ts2314 and uses @ts-nocheck, but also has extracted transaction,
tile-lifecycle, renderer and terminal owners. Native has typed Foundation state
and explicit application/Scope/resource receipts, but NativeBoardScene9141,
NativeGameplayEngine4530 and many Source render callbacks/flags remain coupled.
Two frame transports plus Source microtask/timeline ordering add integration
complexity. Neither language nor class length alone establishes quality.
V9 has the stronger physical stability/fluidity acceptance receipt; Native's
selected owner boundaries are useful foundations, not proof that its complete
structure or current product is superior. Owner extraction should preserve
behavior and follow measured hot paths; no broad rewrite is part of this batch.

## Delivery receipt

Signed Native Release20:22:58 install-over on iPhone13blue, UUID
`5067CFEA-5C5A-3040-963A-A9772A8EDDB0`, container
`F29507AC-1E26-4FF6-9A56-4A9CC3FABAD7`, actual bootPID26258.
`/tmp/native-fps-repair-{release,built-audit,signature-verified,install}.log`
terminal0. Both Native save files are byte-identical before/after prelaunch;
primary SHA256 `ba2eedc7497fc83a25e10991ee78852416afe6a96c8ca9240447c30289bfd56e`.
Console `/tmp/native-fps-repair-console.log` is armed. No postinstall KRENI or
active drag/presentation FPS acceptance is claimed. Preserved PWA untouched.

## Apple references

- [Maximizing Node Drawing Performance](https://developer.apple.com/documentation/spritekit/maximizing-node-drawing-performance): shared texture/node organization and detached-node work.
- [CATransaction](https://developer.apple.com/documentation/quartzcore/catransaction): grouping layer-tree mutations and retaining nested transaction policies.
- [CADisplayLink](https://developer.apple.com/documentation/quartzcore/cadisplaylink): callback timing and system-controlled frame-rate availability; callback preference is not a presentation guarantee.
- [Getting Started with Sprite Nodes](https://developer.apple.com/documentation/spritekit/getting-started-with-sprite-nodes): texture-backed sprite ownership.
