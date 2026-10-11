# Native deep drag / Wild merge-6 audit — 2026-10-11

## Verdict and evidence boundary

**Physical: FAIL / OPEN.** The user reports severe Wild merge-6 lag in the
installed Native candidate whose UUID begins `5067`. The three repairs below
are bounded implementation work, not a new physical acceptance receipt.
No after-repair SDK PASS, Release, install or physical result is asserted here.
The immutable PWA `production-benchmark-v9` remains the accepted reference.

`/tmp/native-fps-repair-console.log` records real active-work stalls:

- 20:23:56.635: Source delivery worst 59.60 ms.
- 20:24:04.689: active-60 callback gap 130.0 ms; Source delivery 28.33 ms.
- 20:24:05.755: active-60 callback gap 283.3 ms; Source delivery 74.78 ms.

Scene update and drag-paint callback counters in these windows were below
1 ms. They do not cover all Source callbacks, renderer preparation, audio,
persistence or actual presentation. A 60 Hz target or callback count does not
prove presented 60 FPS. The same log also records an SKView drawable-unavailable
message at 20:24:42.591; this alone does not identify its cause.

The subsequent Time Profiler capture actually ran approximately
**20:25:44–20:27:46**, while the user's later active dragging occurred
**20:28:25–20:29:07**. It missed that active incident. Export:
`/tmp/native-fps-repair-after-time-profile.xml`.
Global XML `id`/`ref` resolution gives 959 main-thread weighted 1 ms samples
in the exported 96.587672583–116.828670541-second subset. Overlapping inclusive
counts include SKCRenderer render 256, regular-idle availability 136,
physical-board revalidation 120, Source clock delivery 114 and Scene update 29.
These are idle-subset CPU evidence, not active merge causality, GPU duration or
presented FPS. They cannot establish that a repair fixes the reported incident.

## Three bounded repairs

1. **Retain the existing Source display link during genuine direct manipulation.**
   `NativeSourceAnimationClockService.DirectManipulationTransportLease` and its
   Scene drag lifecycle binding retain the existing transport while an accepted
   drag owns it. A finite queued move no longer needs to recreate the display
   link after every consumed move. Cancellation, foreground and generation
   guards remain owned by the existing Source service and Scene. This receipt
   creates no GSAP participant, RAF callback, visual RNG draw or decorative
   activity. `NativeDirectManipulationTransportTests` contains three targeted
   tests, including a before/after creation-count comparison using the genuine
   move queue. Their presence is not an executed after-SDK verdict.

2. **Reuse the physical observer, while rereading actual physical state.**
   Scene observation caches are keyed by tile ID and require the exact weak
   node identity and generation. Each read still validates its actual object,
   parent, generation and painted fields; whole-board current checks remain.
   Pruning requires a nonnil currently installed node before comparing identity.
   This removes repeated observer allocation and destruction, not the physical
   authority or regular-idle batch fences. `NativePhysicalObservationReuseTests`
   contains two tests for repeated 45-tile captures and same-ID generation
   replacement, including changed-alpha, detached-parent and disposal refusal.

3. **Connect the previously unused v9 smoke-pool warmup.**
   Immutable v9 `src/modules/app-core.ts:6482–6489` schedules ten tracked APP
   wall batches after sweetPopIn completion; `src/modules/fx.ts:5190` warms its
   existing pool. Native previously had `NativeSharedSmokeRootSession.prewarm`
   but no production caller.

   The initial expected-failure SDK evidence is preserved in
   `/tmp/native-deep-warm-before-sdk.log`: the real Native root fixture
   `testActualSourceBoardEntryWarmsExistingSmokePoolThroughAllTenBatches` failed
   in 9.632 seconds with completed targets `[]` instead of
   `[8,16,24,32,40,48,56,64,72,76]`, and retained-node count **0**, below 76.
   **Fixture correction:** this fixture seeded an ordinary Arcade resume.
   `NativeBootstrap` deliberately omits fresh Source sweetPopIn for that path,
   so this expected **FAIL** does not prove a missing connection at actual fresh
   entry. The first after-SDK also rejected the same incorrect fixture in both
   normal and modal cases (`/tmp/native-deep-after-sdk.log`). The production gap
   was established by the unused prewarm callsite audit, not these failures.
   Warmup fixtures now launch fresh Arcade and require the actual enabled entry
   owner and its completed Source receipt before checking batches. Fresh after-SDK
   verification remains pending here; resumed ordinary entry stays unchanged.

   `NativeSourceSmokePoolWarmup` now borrows the Scene's existing
   `NativeSourceAppTimeoutOwner` and the app-lived smoke pool. Deadlines are
   **330,400,470,540,610,680,750,820,890,960 ms** after actual entry completion.
   Admission fences the exact Source scope, generation, entry epoch, completed
   entry identity and actual foreground state. Entry retirement cancels its
   exact receipts. Background cancels immediately through the existing Scene
   suspension seam, before suspended timers could accumulate and warm on resume;
   a modal pause remains foreground and preserves APP wall work. Incomplete
   background warming is optional and is not resumed as a preload guarantee.

   Four `NativeSourceSmokePoolWarmupTests` cover exact batches, zero RNG,
   app-pool reuse, stale/background refusal, cancellation and late callbacks.
   Three real `NativeSourceFreshRebuildTests` fixtures cover production entry,
   actual End Run modal pause and actual background/resume lifecycle. Source
   parse passes; after-SDK execution is pending in this record.

## Preserved ownership and next verification

No repair changes gameplay rules, save semantics, RNG order, animation duration,
particle count, trails, randomized vector geometry, textures or original assets.
The Native target remains `native/standalone/Stack to Six.xcodeproj` /
`com.taptapdesign.stacktosix.native`; PWA source, saves and immutable tags remain
separate. No second renderer clock or raw timeout owner is introduced.

Opt-in aggregate `[CC_NATIVE_HITCH_WORK]` counters expose display-link creation,
retained drag receipts, board captures/revalidations, tile-observation reads and
observer creation. They provide work-count evidence, not an FPS verdict.

Run the coherent SDK regression batch and required repository gates, then audit
the signed Native build separately. A subsequent bounded physical capture must
include the user's actual drag and Wild merge-6 interval, correlate these counters
with CPU stacks and renderer evidence, and obtain explicit physical acceptance.
Warm pool objects still rebuild randomized shape paths on use; this patch does
not establish that SpriteKit tessellation or the full main-80 work fits a frame.

## Final SDK receipts

First-after and second full selected runs retained their fixture failures. The
second fixture also treated default `isBoardEntryComplete` as actual Source entry;
it is now required to wait completed Source receipt, attached Scene and admitted
input. No product guard was removed. Final focused SDK17/17 terminal0:
`/tmp/native-deep-final-lifecycle-sdk.log`, including all8 genuine entry/restart/
continue/modal/background methods and9 new owner methods. The frozen product's
other164 selected methods passed in `/tmp/native-deep-final-sdk.log`; combined
coverage172 distinct methods, not an all-green receipt for that failed run.
Full QA4010/4010, KING330/330 and Native source audit terminal0. Physical
acceptance remains open; signed Release build pending delivery.

## Native delivery

Signed Release4CA38959-9B19-3F97-8429-06A6D41374E0 installed-over iPhone13blue
20:54 CEST. Native compiled audit and strict deep signature PASS terminal0.
Primary and previous saves byte-identical across prelaunch install. New boot
PID26424 exactcontainer82445209 verified, webRuntime absent, nominal thermal
and lowPowerfalse. Console `/tmp/native-deep-console.log`, host81186/exec50837
connected, waiting user actually ready/onboard before arming profile and KRENI.
Physical result of this checkpoint: NEEDS PHYSICAL TEST. Prior rejected
checkpoint5067 remains FAIL; no presented60FPS or Wild-merge closure claimed.
