# Mobile navigation and audio ownership

Working acceptance record, 2026-10-02. The installed 16:24 build failed physical
acceptance. This refactor must pass web review and a fresh phone run before release.

## Evidence and scope

The six connected surfaces are Homepage sliders, Worlds Hub, Forest/Beach/Area55,
the Journey Unit card, gameplay and Clean Board. Existing AppZoneManager epochs
own route validity; existing screen/modal owners own presentation and cleanup.
No second router, renderer, AudioContext or progression model is introduced.

The latest capture reproduced an Area55 return with 109 targets: 383ms transform
reset, 387ms post-result preparation and a 408ms no-frame interval. An earlier
memory warning permanently disabled incremental preparation. Forest used that
same fallback but finished in 23ms, explaining why its Exit felt good. Native
thermal changed from fair to serious. The timing proves the blocking preparation;
it does not establish the total contribution of graphics, audio or brightness to heat.

## Owner map and implementation

| Surface | Entry/exit and validity | Settled/hidden work and resources |
| --- | --- | --- |
| Homepage sliders | HomepageEnterTransitionOwner, SliderManager and AppZoneManager epoch; UIManager cleanup checks the exact epoch | Existing active-slide mobile CSS and navigation ownership; cold Hub construction starts only after Slider exit has settled under its static final pose |
| Worlds Hub | Journey Hub enter/exit owner and HubRuntimeScheduler | Existing visibility/viewport policy; one destination stage, no parallel full World trees |
| Three Journey Worlds | One shared detached World builder and budgeted priming, followed by the canonical WorldAnimationCoordinator | WorldRuntimeScheduler owns transition/modal/scroll/background admission; existing visible Unit budget and ambient teardown |
| Unit card | JourneyCardOverlayModal lifetime, manager interaction/landing transaction | World ambient paused during modal; existing surface idle/coach cleanup, bounded image preparation and scoped speculative-audio lease |
| Board game | Existing board-entry/run token, Gameplay KING input/final-merge owners | Existing renderer cadence, Special idle budget and terminal renderer suspension; no gameplay/progression rule changes |
| Clean Board | Result lifetime and accepted terminal-return token; visible Exit keeps authored timing | Confetti/ships advance through authored result motion, then retire before one connected paint lease runs behind the still-opaque paper cover; reveal follows the paper fade |

World construction is shared by Hub activation and terminal return. Build main
scenery and each board Unit separately using manager-owned frame/timeout turns.
Fresh detached cards already have their authored base transforms; do not run
old-tween repair on them. Prime fresh targets in measured slices (4ms target,
at most eight elements); one browser operation cannot be preempted. A finished
plan is committed/transferred once and never re-primed at visible enter.

Memory pressure cancels optional preparation and releases hidden content. It
cannot permanently turn off required incremental construction. Cancelled Hub
preparation retries through the same builder; failure restores the Hub instead
of invoking a synchronous full-World renderer. Terminal structural recovery
awaits the accepted destination promise before checking mounted content.
Generations and tokens reject late work; normal cleanup cancels tracked waits.

The shared decoded SFX engine separates explicit preload, observational readiness
and exact-cue playback. A readiness probe no longer rewarms an entire family.
Known decoded sizes survive eviction as metadata so repeated optional preloads
can be refused before expensive decoding when they cannot stay resident. Active
and pending playback retain priority. The first native memory warning trims the
cache to the hottest 16 MiB working set instead of flushing to zero and forcing
an immediate refill; a repeated warning escalates to a full idle release.
Authored sources, gains, timing and sound-family owners remain in force.

## Acceptance

Deterministic gates: feature/audio admission, focused lifecycle/cancellation and
audio residency tests, Gameplay KING, fast QA and full QA. Review the actual web
flow on localhost:5174. Native sync/install follows the live workflow approval.

Physical run starts on a cooled iPhone 13 blue and traverses all six surfaces in
both directions repeatedly. Include early Exit, pressure before/during prepare,
background/foreground, and Forest/Beach/Area55 returns. Measure worst frames and
first-visible latency separately from averages; compare resource/voice/decoder
counts across cycles and thermal state over minutes. Audit image decode/raster
and any indivisible expensive target if the 4ms slices still hitch. No claim of
zero heat, zero dropped frames or App Store readiness follows from source QA alone.

## Completion checklist

- [x] Homepage return no longer awaits the mixed 100+ image HTML preload; it
  joins one memoized, DPR-specific set containing only the three Homepage heroes.
- [x] Delayed Journey scroll restore, active-area enter and idle-start callbacks
  belong to one replaceable presentation owner and are cancelled on exit.
- [x] Clean Board optional World preparation starts after both coin counters,
  behind two owned paint boundaries, instead of 250ms into combo counting.
- [x] Board-transition art is prepared from the settled Unit detail owner and
  the visible transition joins the same cache instead of creating a cold burst.
- [x] New Reward, Special Dice and board-transition images share one global
  two-job decode ceiling; stale presentations stop admitting queued sources.
- [x] Replaced New Reward and Special Dice presentations settle as cancelled,
  so a retired completion flow cannot continue into Clean Board or progression.
- [x] Homepage-to-Hub cold construction no longer competes with the moving
  Slider exit; the settled Homepage pose is its static preparation cover.
- [x] A ready terminal World pays its connected WebKit raster/compositor cost
  behind the static Clean Board paper, after celebration motion retires and
  before result-last-visible releases the Unit enter.
- [x] First memory pressure preserves the hottest bounded 16 MiB SFX working
  set; only repeated pressure flushes all idle decoded buffers. No AudioContext,
  cue, gain, authored timing or transport was added.
- [x] Focused lifecycle, cancellation, timing and concurrency regressions added.
- [ ] Run the exact six-surface route on a cooled iPhone 13 blue and record
  worst frame, first-visible latency, thermal state and subjective motion.
- [ ] Promote to App Store candidate only after that physical acceptance passes.

## Source verification receipt

Final fast QA passed all 12 gates (164 suites / 1,447 tests). Final full QA passed
all 18 gates (467 suites / 3,194 tests), including Gameplay KING (308 tests),
feature/audio admission, lint, type/unused checks and a 1,104-module production
build with native sync disabled. Native Web.bundle and installed phone were not
updated by this refactor.
Physical thermal, frame pacing, audio onset and end-to-end feel remain open.

## World transform preparation follow-up (2026-10-02)

The rapid physical run recorded a 139ms Beach prepaint callback gap between
image readiness and geometry commit. That localizes a suspect interval; it does
not establish whether JavaScript, style, layout, raster or compositor work caused
all of that gap. No new audio cache misses/decodes/evictions occurred in that
specific stress interval. This follow-up changes only World preparation.

The former cold per-target `gsap.set` interleaved pose writes with CSSPlugin's
computed-style reads. Even batching eight targets retained that pattern. The
shared finite preparation helper now performs, per bounded batch:

1. Snapshot the independent CSS transform longhands without writing poses.
2. Normalize only axes measured as `none`, together. CSSPlugin otherwise writes
   those neutral longhands while parsing each target, invalidating style again.
3. Hydrate transforms through public `gsap.getProperty`, preserving authored
   rotation/percentage translation, and yield at the measured budget.
4. Write enter poses using cached transforms and direct opacity/visibility.

Descendant clouds receive only their existing x reset, not a parent Unit scale.
The generation-validated plan records cloud readiness so visible entry does not
perform that reset again. No new router, animation profile, renderer, timer,
resource cache, audio/haptic owner, save-state rule or asset change was introduced.
The existing manager stage owns cancellation, disposal and all presentation turns.

An isolated headless Chrome probe at 390x844/DPR3 used the real renderer, current
fresh-profile progression, all three World target groups and decoded artwork.
Three alternating-order before/after repeats produced the same counts each time:

| World | Targets | Style recalculations before | After |
| --- | ---: | ---: | ---: |
| Forest | 70 | 148 | 17 |
| Beach | 65 | 138 | 17 |
| Area 55 | 85 | 180 | 21 |

Adding a final computed-pose equality check adds exactly one style recalculation
to each side (149/18, 139/18, 181/22); every comparison matched transform, origin,
opacity and visibility. Probe receipt: `/tmp/stack-world-prime-browser-ab.json`.
This is approximately 88% fewer style recalculations in the isolated prime loop,
**not** 88% faster navigation. LayoutCount was zero on both sides of that probe;
CPU times were small/noisy and slice counts stayed 9/9/11. It does not reproduce
or prove removal of the phone's 139ms gap, GPU raster stalls or thermal load.
The actual manager's prepaint + commit also succeeded for all three Worlds with
connected prepared targets and clouds reset before publication.

Opt-in transition diagnostics now include prime start/end and bounded per-phase
totals (style read, neutral-axis normalization, transform hydration, pose writes),
including each phase's worst synchronous operation. They do not consume the
milestone slots or add a production ticker. A stall outside those measured tasks
must still be investigated as browser-frame/raster work, not relabelled as JS.

Next acceptance: web review at localhost:5174, then approved bundled delivery
and the same cooled-phone rapid World/Hub route. Preserve the accepted Clean
Board confetti behavior. Spaceship fly-out and gameplay audio residency are
separate concerns, not silently included in this patch.

Verification for this follow-up: `qa:feature-runtime` PASS; final `qa:fast` PASS
all 12 gates / 167 suites / 1,475 tests; final `SKIP_NATIVE_BUNDLE_SYNC=true npm
run qa:full` PASS all 18 gates / 468 suites / 3,211 tests, including Gameplay KING
(24 suites / 308 tests). Source/local dist updated; native bundle and installed
phone unchanged. Physical verdict remains **NEEDS PHYSICAL TEST**.
