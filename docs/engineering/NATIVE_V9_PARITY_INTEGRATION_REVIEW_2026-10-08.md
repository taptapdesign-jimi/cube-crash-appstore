# Secondary conversation review of its own v9 parity draft

User decision: **the other conversation is primary**. This conversation now
reviews only; it must not integrate, revert, build, install or change shared
runtime code. Findings apply to the live worktree inspected 2026-10-08, not the
primary conversation's isolated `/tmp/native-resume-owned-snapshot`.

Verdict: **FAIL for direct integration of the complete draft**. Existing focused
Simulator receipt is 41/41 Board/Bootstrap/HUDClose tests, zero skipped/failures.
It proves those tested behaviors on that compiled snapshot, not ten new visual
requirements, sustained60FPS, intro correctness or Wild arrival lifecycle.

## Concrete blocking findings

1. **Cadence overlaps primary ownership.** `NativeBoardScene.swift:30–45,1393–1397`
   inserts generic300ms activity on synchronize/all actions, uses generation as
   renderer identity and stops cadence/renderer on static boards. It bypasses
   source typed100/60/180/250ms leases and static15FPS. Do not merge this adapter;
   use the primary source frame runtime and connect trails/Wild to its typed
   leases. Shared pip raster is a separate candidate, not a measured FPS fix.
2. **Modal pause overlaps primary ownership.** `NativeBoardScene.swift:1427`
   leaves Scene and HUD parent SKActions running to finish close feedback.
   Pausing their children does not stop parent movement/completion callbacks.
   Use primary canonical global pause; port close feedback into an isolated UI
   owner that cannot keep the gameplay timeline advancing.
3. **Wild carrier renderer/lifecycle defect.** `NativeBoardScene.swift:1390`
   omits `wildDrops` actions from render demand; owner lives under canvasRoot,
   while checked actions belong to Scene/dice/effects/HUD. A static eligible
   board can pause its flight; animated boards can fall to settled30FPS.
   `dispose()` does not call cancelWildDrops or dragTrail.dispose and leaves
   Wild locks/callback state until engine replacement. Generation cancellation
   invokes the same success path and may start impact while retiring nodes.
   Missing all frames calls finish inside init, before dictionary admission,
   then caller inserts an already completed owner. Use explicit success/cancel
   receipts and admission-before-start, idempotent lock cleanup on every exit.
4. **Wild carrier is approximate, not source-exact.**
   `NativeWildSpawnPresentation.swift:16,35–41,60` decodes20textures synchronously;
   backpack original20frames are reduced to frames1–10 then hold/close. Crate
   reversal alone follows source opening/closing split. It lacks original
   foreground occlusion and uses generic spawnBounce rather than source four
   landing phases. Two overlapping carrier squash tweens use linear pieces.
   Do not admit this owner to primary Wild core/recovery work as complete.
5. **HUD arbitration/interruption overlaps primary owner.** Midpoint is timer
   only; didFinishUpdate counts the same action frame before next frame, unlike
   literal nested future RAF callbacks. `cancelEntry():405` returns early after
   dice admission even if hud-enter still runs; rise can compete with drop and
   resets painted pose. Rise alpha remains linear rather than power2.in. Prefer
   primary proved HUD motion/reveal owners. The readiness reset now exists in
   prepareNextBoardEntry (earlier lifetime-cache finding was partially corrected),
   but callbacks/waiters still lack generation receipts and two update callbacks
   do not prove a GPU-presented frame.
6. **ReduceMotion footer lost.** `NativeGameplayViewController.swift:385,499`
   removed independent initial/release enter; footer now relies on onHUDDrop,
   which optional board entry can skip. Retain primary artwork admission path.
7. **Home has independent uncancelled CA owner.** `JimiV9HomeView.swift:206`
   adds layer animations outside NativeRouteMotion. NativeAppController pan
   begin only pauses hero, so previous slider CA can override finger movement;
   its suspend does not stop those CA keys. cancelPan removes them by snapping
   to model pose, and selectSlide(animated:false) does not retire old keys.
   Integrate track/nav into one route owner, capturing painted pose on cancel.
   The shared view also serves JimiHomeHubController; it can affect that route
   if any animated:true caller already owns slider/nav CA actions.
8. **Intro/audio has no admission proof.** Original selected HEVC assets are
   reused, but composition uses fallbackPNG aspect rather than sourceSVG ratio,
   sheen is missing, opacity is linear and logo model pose is not primed.
   Per-character multi-cue gains were mapped, but native execution against
   the immutable source and Settings/interruption lifecycle remains untested.
   Native audio/source and finite intro ownership records are absent from
   audio-runtime/feature-runtime JSON; no default-intro tests. Bootstrap tests
   explicitly skip intro and therefore do not validate the new default launch.
9. **Trails are approximate.** `NativeDragTrail.swift:41–44` uses square wild
   rectangles/generic gold palette rather than original independent width/
   height/archetype palettes; no original random rotation and no connected
   lifetime/cancellation tests. Preserve original source emitter geometry/policy.
10. **Help hit area shrinks with art.** Scene:245 sets icon maximum28px, but
    touchesBegan tests rendered sprite bounds rather than independent44px HUD
    target. Keep semantic44px target while resizing the visual.

## Ten-request disposition for primary integration

| Request | Secondary candidate | Primary action |
| --- | --- | --- |
| Home swipe/nav | correct v9 duration/ease candidates | unify CA cancellation/route owner before cherry-picking |
| Studio intro | preserved assets and finite composition draft | exact source layout/motion/audio and admission tests |
| Gray frame/HUD | callback cover plus HUD draft | primary generation receipt/HUD owner, physical visual check |
|60FPS | shared pip raster; generic cadence draft | keep raster separately; replace cadence adapter; physical profiling |
| Trails | bounded distance emitter | restore source palette/shape, integrate typed lease and cleanup |
| Merge6 bold badge | attributed string raster using source ArialBold33/outline2 | pixel/baseline comparison; source exact glyph is ×2/×3 |
| Board scale | v9 final geometry formula candidate | independent viewport oracle; main scene uses one geometry owner |
| Help book | aspect-preserving28px art | retain44px touch target |
| HUD X | source220ms close curve | retain main curve; isolate from paused gameplay clock |
| Wild arrival | original backpack/crate assets + trajectory draft | do not admit whole owner; finish exact source/proved Wild recovery |

No Swift/runtime changes were made during this review. No new build, install,
PWA operation, commit, push or asset edit. Preserve primary Fish/Rules/State/
shared-smoke work. Primary owns whether to replace or salvage each candidate.
Physical verdict for visual/touch/performance acceptance: **NEEDS PHYSICAL TEST**.
