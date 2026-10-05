# jimi2026 independent acceptance

Date: 2026-10-05. This is a prospective acceptance contract, not a record of completed tests.

## Scope and current verdict

`jimi2026` replaces presentation/navigation ownership. Existing gameplay, progression, saves, authored assets, audio and haptics remain authoritative. A new presentation must not introduce another gameplay resolver or conceal a stuck board by navigating away.

Current overall acceptance: **FAIL / incomplete**. The route implementation and measured acceptance matrix are not complete, and the reported no-moves incident remains unresolved. Source gates, Simulator behavior and physical acceptance must be recorded separately. No physical installation is authorized before the requested problems are resolved; this document is not installation authorization.

## Recorded isolated-Simulator experiments

Simulator: `1018BE2D-491B-465F-8F75-3E5BEB38C22A`, separate from the incident board. Same official native shell copied to a temporary app; only the copy's Web.bundle replaced. Original images are unchanged. CUA inspected Home hero, three Hub worlds, Beach scenery, card front/back, and restored Home. This is a presentation prototype with unknown progression and explicit artwork preview, not functional game migration.

| Candidate | Cold Hub worst RAF | Cold Beach worst RAF | Warm Hub worst RAF | Warm Beach worst RAF |
| --- | ---: | ---: | ---: | ---: |
| Initial isolated GSAP | 56 ms | 114 ms | 44 / 63 ms | 45 ms |
| WAAPI Unit experiment — rejected | 38 ms | 145 ms | 57 ms | 123 ms |
| GSAP direct cleanup / hidden Home exclusion — final development checkpoint | 62 ms | 144 ms | 60 ms | 53 ms |

Logs: `/tmp/jimi-2026-metrics.log`, `/tmp/jimi-2026-waapi-metrics.log`. WAAPI's cold Beach additionally recorded a 122 ms unsampled final `commitTailMs`. Initial GSAP did not record that field, so its final cleanup cost cannot be compared directly. These are a small diagnostic sample, not GPU-presented FPS or a controlled statistical benchmark. Startup was also unaccepted (190/149 ms worst RAF). User interaction changed the first Simulator session later; do not count unlabelled later receipts as controlled repetitions. Neither candidate proves desired fluidity.

The WAAPI replacement was rejected; final follow-up narrows the experiment to removing GSAP `clearProps` cleanup on hidden wrappers and excluding hidden Homepage panels. Installed CSSPlugin's `clearProps` reparses transforms and its hidden matrix path may temporarily reparent targets for geometry. That avoidable path is verified in source, but attribution of the observed stalls remains unproven. Do not turn this finding into a blanket performance claim.

Final checkpoint receipts: `/tmp/jimi-2026-direct-cleanup-metrics.log`; standalone entry SHA256 `58b1fcfa7bf1d01d54f485fae3c757c10791ae98cd9947ada4d70ccab99e51fc`, JS `jimi-2026-DCm1lTEh.js`. The direct-cleanup result does NOT establish a performance improvement and is not accepted as fluid. Its startup worst RAF was 76 ms. Source validation passed 18 gates, 505 suites / 3609 tests, including 63 isolated Jimi tests (`/tmp/jimi-2026-full-final.log`). Scope-specific independent owner review passed; native performance acceptance failed.

Additional native gap: CUA upward drag and wheel input on the final Beach map did not visibly move it. The copied native shell sets `webView.scrollView.isScrollEnabled = false`; the new standalone slice does not yet integrate the established custom elastic Journey scrolling. This is an observation plus a boundary to investigate, not proof that the native setting is the sole cause. Do not claim native scroll/scroll-return acceptance from jsdom identity tests. Preserve the existing incident Simulator while diagnosing the new slice separately. No full gameplay bridge, saves, sounds, haptics or terminal flows have been migrated; do not expand this candidate to production on the basis of source QA.

## Known no-moves incident: preserve evidence

The reported existing Simulator Area 55 board 24 shows three ordinary-looking value-5 dice without Fail. `/tmp/journey-homepage-regression-simulator.log` records board 24, `tileCount:9`, `visibleTileCount:9`, `specials:{}`, and one Special idle owner after the last observed changes. These observations do not establish the exact logical grid or its active mutation owner.

- `src/utils/runtime-soak-sampler.ts` counts non-destroyed `STATE.tiles`; visible counts only test visibility/renderability/alpha. Zero-value placeholders can be counted. These are not counts of legal moves or necessarily visible positive dice.
- `src/modules/final-merge-rules.ts` recognizes Wild identity through retained archetype/Wild flags as well as `special`. An empty SOAK `specials` map does not exclude logical Wild continuation.
- `src/modules/app-core.ts` builds the authoritative resolution collection from local tiles, `STATE.tiles` and grid entries. Their identity/membership must agree; a screenshot cannot exclude an orphan logical entry.
- The current source retains expired receipt-bearing Special transactions until postconditions are recovered. An unreleased owner defers endgame. The incident's installed bundle must first be matched to source before attributing the incident to these newer changes.

Three genuinely settled ordinary 5s, with no pending legitimate spawn or other continuation, have no legal merge and must reach exactly one Fail flow. Do not infer a root cause from a renderer count or fix this by clearing a lock on a timer.

Required evidence is a bounded read-only snapshot: tile identity and array/grid membership; value and every Special/Wild identity flag; lock/removal/spawn ownership; parent and effective visual state; transaction token/phase/age/receipt issues; pending continuation flags; last endgame scheduled/fired reason and authoritative decision. Prefer state-change diagnostics, not per-frame collection. Do not call `checkLevelEnd` as an observation API: that path can repair, remove or spawn tiles. Preserve the existing board/save; do not inject a terminal state or reset progress to manufacture a passing screenshot.

## Source and lifecycle gates

The primary implementation owner records exact commands and receipts. Independent review inspects the real adapter/builders/call sites, not only director tests.

- One route director; outgoing scene remains owned until incoming commit or rollback. Only the settled, current scene accepts input.
- Rapid requests have a bounded latest-request policy, not an unbounded FIFO. Same-route requests, replacement, cancellation and disposal settle their promises without duplicate entry/exit.
- Cancellation stops owned motion synchronously. Late preparation, load, callback, exit or enter completion cannot expose a stale scene, enable stale input, mutate progression or restart audio.
- Preparation, exit and enter failures restore a valid current scene and its settled pose; initial-load failure has an explicit visible retry/fallback. Visibility alone must not restore a scene whose opacity/transform still has its exit pose.
- Background/resume, reduced motion, cleanup twice and reopening release the same listeners, animations, resource leases and input blockers. Disposed/stale handles cannot detach a subsequently reused live root.
- Only eligible content is prepared. Retention has a documented bound; old Worlds and failed preparations release references. No all-World preparation barrier, invisible active animation owner, or second Pixi renderer is introduced.
- Scene state is presentation state only. Existing unlocks, tutorial completion, board selection, save version, result rewards and drag/endgame ownership remain connected to their canonical owners.
- Feature-runtime ownership registration, focused behavior tests, `qa:feature-runtime`, `qa:gameplay-lock`, `qa:fast`, and final `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full` must pass. Source-only build must not silently synchronize a native bundle.

## Simulator functional and visual matrix

Use the official bundled Stack to Six Simulator target and existing data. Record bundle identity and exact source before testing. Use real input/XCUITest; do not count an injected terminal state as a natural Fail/Clean test. Missing prerequisites remain explicitly untested.

| Route or stress case | Required observations |
| --- | --- |
| Homepage → Hub → Homepage, cold then five warm loops | Hero, logo, CTA and navigation are visibly present after first, fifth and final returns; no full-alpha Hub flash, occluding cover, blank dwell or dead input. Inspect pixels, not AX existence alone. |
| Hub ↔ Forest / Beach / Area 55, including switching Worlds | Correct original artwork, cards, progression, scroll target and hit geometry; no old World flash, stale card targets or clipped content. |
| Each World → card front/back → game | Real card taps/drag/flip and CTA work once; no covered scene input or duplicate board creation. |
| Game → manual Exit modal cancel | Same board, score, input and owned effects resume; no unintended navigation or save mutation. |
| Game → manual Exit confirm → same World | Canonical cleanup, correct World/scroll/selection and usable cards; gameplay never leaks through the return. |
| Naturally reached Fail → authored retry/exit destinations | Exactly one terminal flow, canonical retry and return behavior, no invisible board or retained input lock. Include the three-fives incident reproduction. |
| Naturally reached Clean/end-game → authored continuation/exit | Rewards/progression once; final-merge Special effects and result cleanup complete; correct destination and no extra spawn. |
| Rapid taps/back/reopen during prepare, exit and enter | Only accepted/latest route commits; no promise hang, duplicate audio/haptic or input on a hidden scene. |
| Background/resume during transition and settled gameplay | Safe current route/pose/input restoration without stale animation replay, lost board or hidden blocker. |
| Repeated full route cycles and World replacement | Live roots, listeners, tickers, animation/audio owners and retained resources return to the declared bounded baseline. |

Shared gameplay changes also require the corresponding Arcade and Journey tests: ordinary merge, final pair, remaining blocker, Special final/nonfinal merge, transaction release/recovery, spawn accounting and save/load identity. Do not accept a presentation-only improvement as closure of a gameplay regression.

## Fluidity evidence: no shifted stall

Measure the complete interval from accepted input through outgoing motion, preparation, destination first visible motion and settled destination. Report first-motion latency, longest callback interval, counts above the chosen frame budget, and the exact incident timestamps for each route; averages alone are insufficient. Callback spacing is not presented GPU FPS.

Use a controlled nominal 60 Hz Simulator run without concurrent builds, CPU sampling or heavy test suites. Separate screenshot/XCUITest overhead from a low-observer timing run; retain representative visual evidence. Compare cold entry and at least three warm returns on the same candidate. Include both outgoing and incoming windows so moving an 80 ms stall behind an outgoing animation is not called a cure.

Review all route windows exceeding 34 ms as regressions requiring attribution/retest. The 34 ms threshold detects dropped-frame candidates; it is not a promise that shorter gaps look smooth. A route cannot pass on metrics if visible hesitation, clipping, missing artwork or blank delay remains. Do not reduce required content, remove accepted shadows/effects without evidence, add artificial waits, or shorten the measured window to manufacture a pass.

## Evidence and release boundaries

Record independently: source commit/dirty snapshot; deterministic gate receipts; source/dist identity; official Web.bundle and final Simulator app identity; Simulator test/capture paths; observed failures and explicitly untested routes. Old candidate results do not validate a changed candidate.

Physical iPhone feel, touch/haptics, sustained thermal/resource behavior and final native lifecycle remain **NEEDS PHYSICAL TEST**, even after a complete Simulator pass. The user's current no-install boundary takes precedence. Do not touch the physical phone, uninstall/reset its data, or use the legacy Kockice Crash shell as part of this review.

Completion requires the entire functional matrix, measured and visually inspected Simulator fluidity, no unresolved high/medium correctness finding, and a truthful separate physical boundary. A green source suite or a newly styled scene is not completion.
