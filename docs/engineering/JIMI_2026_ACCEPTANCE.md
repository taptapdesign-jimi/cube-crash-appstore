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

Scroll investigation corrected on 2026-10-05: passive native receipts in `/tmp/jimi2-input-paint.log` show that CUA gesture 3 sent down/up only 4 ms apart with no pointermove/touchmove; this was not a real pan. Later trusted gestures 18–19 moved Beach through scrollTop 0→63→177→227 and 1126→966→829→766 with momentum. Native inner scrolling therefore works; no custom vertical scroller or native scroll-view change is justified. The old Journey elastic helper also leaves vertical panning to native scrolling. Retained scroll after navigation still needs its own real-input test. Preserve the existing incident Simulator. No full gameplay bridge, saves, sounds, haptics or terminal flows have been migrated; source QA is not production acceptance.

Detailed phase diagnostics now separate synchronous build, image wait, visibility and motion setup. One cold Beach build took 102 ms and its enter setup 33 ms; later retained setups were 2–6 ms. A diagnostic-only image-paint A/B kept DOM, image loading and animation unchanged: warm Beach worst RAF was 86 ms with art and 37/83 ms with art hidden; Hub was 63 ms with art and 69 ms hidden. This small sample does not isolate all causes, but hiding images does not eliminate the initial hitch. Art was restored to ON after the test. No image assets were changed.

## 2026-10-05 continuation: verified fixes and rejected hypotheses

The retained-root scroll bug is now fixed in the isolated entry. WebKit reset the detached Beach scroll container from 365 px to 0 even though the same DOM object was cached. Main now snapshots before visible hide/detach, restores after mounting before enter, and does not overwrite a snapshot from an already-hidden root. The enhanced XCUITest asserts Stage04's settled vertical position within 2 px; native input telemetry independently confirms 365 px before preview and 365 px at the first post-return touch. Before/after screenshots were inspected. The original incident Simulator and saves were not touched.

Implemented simplifications: GSAP animates plain numeric poses without DOM transform hydration; selected cold Beach assembly uses 11 cancellable Unit tasks (measured chunks 0–1 ms in the combined capture); conservative viewport admission leaves offscreen artwork mounted/static instead of animating it; warm immutable roots skip image traversal. Route phase diagnostics and passive input receipts have separate opt-ins (`data-jimi-metrics`, `data-jimi-input-metrics`). Input receipts default OFF because they read geometry and send native messages; their removal did not eliminate the remaining hitch.

Low-observer XCUITest results, three warm cycles in order, worst RAF callback gaps in ms:

| Candidate | Home→Hub | Hub→Beach | Beach→Hub | Hub→Home |
| --- | --- | --- | --- | --- |
| Numeric poses, all Units, input receipts ON | 28 / 40 / 29 | 25 / 37 / 32 | 47 / 139 / 50 | 43 / 37 / 34 |
| Viewport admission + assembly + scroll fix, input ON | 30 / 30 / 46 | 28 / 35 / 20 | 44 / 41 / 45 | 49 / 33 / 45 |
| Same implementation, input OFF — retained source | 26 / 27 / 31 | 46 / 46 / 44 | 47 / 64 / 46 | 34 / 31 / 49 |
| Settled identity-transform retention, input OFF — REJECTED | 32 / 30 / 26 | 44 / 47 / 47 | 46 / 46 / 47 | 47 / 34 / 44 |

These small diagnostic samples are not statistically controlled proof of a performance gain or presented GPU FPS. Native first/cold intervals remain separate. The identity-retention experiment did not convincingly help, introduced a permanent stacking-context risk, and was removed exactly; no experimental retention flag remains. No image assets were resized, repacked, renamed or deleted. Input-OFF captures contain zero `[JIMI_INPUT]` receipts while retaining route measurements.

Receipts: `/tmp/jimi-xcui-numeric-20261005.xcresult`, `/tmp/jimi-xcui-combined-20261005.xcresult`, `/tmp/jimi-xcui-input-off-20261005.xcresult`, `/tmp/jimi-xcui-retained-pose-20261005.xcresult`; matching logs end in `-native.log` and `-test.log`. Each executed one real XCUITest; the latter three include the strict scroll-position assertion. Inspected fixed-return image: `/tmp/jimi-xcui-combined-attachments/D59C0929-8405-41AD-B3AB-54574E6C2AE4.png`; inspected Home after three loops: `A3AEB910-BED3-4D9F-B96E-39532DE943E7.png` in the same directory. Reusable test source is `scripts/qa/JimiPresentationUITests.swift`; temporary native source `/tmp/jimi-native-test-source.Jd5oSW` and DerivedData `/tmp/jimi-xcuitest-20261005` are isolated from the official project. Rebuilding that temporary project requires copying the latest Jimi dist into its temporary Web.bundle first.

Final retained source full QA: **18 gates / 508 suites / 3657 tests PASS**, `/tmp/jimi-final-continuation-qa.log`. Final standalone and installed temporary app index SHA256: `249d445db70155656102d70ad0423aa4e0e220cd61de6a1e41ca25f4a4b83c6b`; JS `jimi-2026-YXA3tU-2.js`. The restored artifact exactly matches the input-OFF candidate, not the rejected identity experiment. Overall fluidity and whole-game migration are still **FAIL / incomplete**.

CPU diagnosis is separate from acceptance: `/tmp/jimi-webcontent-7080.sample.txt` and `/tmp/jimi-native-7079.sample.txt` sample only the app processes parented by isolated Simulator launchd 94478. Main threads are mostly idle; WebContent's active work includes style/layout/compositing and its separate remote-layer commit queue waits on rendering completion. No image-decode execution was sampled. Aggregated samples cannot assign a particular 45 ms gap to a function and are not GPU timing; profiled XCUITest `/tmp/jimi-xcui-profile-20261005.xcresult` must not be mixed into the unprofiled table.

### Deep-scroll input regression

The reused-app run `/tmp/jimi-xcui-gpu-profile-20261005.xcresult` failed opening the preview after a second long pan. This was not a scroll-return failure: the map's later, rotated Stage04 card at z-index 5 overlapped the earlier header at the same stacking level. At scroll around 765 px, tap (288, 67) landed inside the card. The scroll subtree now has `isolation: isolate`, keeping its local artwork/card layers below the fixed header without changing scrolling, assets or animation transforms. Two source-contract tests cover stacking policy and the reproducer geometry. The reusable native test now includes a second long pan and real preview tap/return assertion.

The follow-up GPU-service Time Profiler attempt is **FAILED tooling**, not evidence: explicit Simulator UUID resolved process discovery, but the bounded recorder hung and was stopped. No usable GPU profile was obtained; do not infer a GPU root cause from it.

Post-fix final verification: **18 gates /509 suites /3659 tests PASS** (`/tmp/jimi-layer-full-qa.log`), feature admission rerun PASS. `/tmp/jimi-xcui-layer-20261005.xcresult` executes **1 real test /0 failures**, including shallow and deep-scroll preview/return; shallow Stage04 y432→432, deep geometry within 2 px. Final deep-return screenshot inspected in Simulator. This functional run overlapped source QA and is deliberately excluded from performance comparisons. Final HTML/installed temporary app index SHA256 `b804973eaded275e0784db01520fc2dabb89948aa1c9b58d32b60d6fb7a6c151` supersedes the pre-layer hash above. No fluidity acceptance is claimed.

### Follow-up: shared cold-scene assembly and attribution controls

Cold Hub previously built all three complete World Units synchronously after starting Home exit. One recorded combined capture had 18 ms of Hub construction plus 7 ms exit setup before the first paint opportunity. Hub now uses the same cancellable Unit scheduler as Beach: exactly three tasks (Forest, Area 55, Beach), with no task for building the actual World screens. The immediate builder drains that same cursor, so there is no second artwork/geometry implementation. Main publishes only a complete, current result and reuses the committed Hub thereafter. This removes a measured cold-path synchronous batch; it does not explain or claim to cure warm stalls.

Attribution receipts on the unchanged layer-fixed baseline: `/tmp/jimi-next-baseline.xcresult` passed the real-input functional test; warm maxima in Home→Hub / Hub→Beach / Beach→Hub / Hub→Home order were `31/46/44`, `46/47/46`, `63/47/51`, `33/61/45` ms. A one-variable tap-highlight experiment (`/tmp/jimi-no-highlight.xcresult`, HTML hash `a10e3d187d92a03299b03417b4cac32572e2e714bae2e2851612d80afbce794e`) also passed functionality but had warm maxima `30/30/30`, `107/42/45`, `61/47/62`, `49/56/48` ms. It did not demonstrate a fluidity cure and its CSS change was reverted.

The finite synthetic-click control (`/tmp/jimi-route-control-native.log`) completed 16 route clicks and reproduced gaps, but its first version emitted native IPC immediately before each click. That is a confound, not proof that native input is irrelevant. `scripts/qa/jimi-route-control.js` now buffers at most 16 click receipts until the final settled destination, has one pending task and stops on background/pagehide, including synchronous cancellation inside click. Fifteen NodeVM tests execute the real helper. It is not imported or packaged by the production/Jimi build: use only as an opt-in document-end WKUserScript in the temporary DEBUG Simulator shell, guarded by exact Simulator UUID plus `--jimi-qa-route-control`. Synthetic clicks bypass trusted input and are never functional/touch acceptance. The earlier native capture does not validate the revised buffering helper's timing.

Final shared-assembly QA and real Simulator receipts are recorded in the latest handoff; overall fluidity remains FAIL until independently demonstrated.

Minimal rendering control: `/tmp/jimi-minimal-native.log` showed67/40/41ms worst RAF gaps with only three colored rectangles, no images, GSAP, navigation or gameplay. A fresh nine-tap sequence (`/tmp/jimi-minimal-variants-native.log`, source `scripts/qa/jimi-minimal-render-control.html`) gave82/33/45ms for3D+inert,42/45/48ms for3D without inert,47/40/46ms for2D without inert. CUA performed native clicks and a Simulator AX-state read afterward; these samples are neither observer-free nor a matched XCUITest comparison. The first run also had later gaps. This shows that the particular initial40–48ms signal can occur without game complexity; it does not assign all Jimi hitches to WebKit or Simulator and does not prove a physical-phone limitation. No corresponding game input/transform policy change was made. The labelled control temporarily replaced only the copied Simulator bundle index, never the official bundle; restore the exact Jimi index/hash after testing.

### Canonical gameplay migration remains separate

Do not import legacy `main.ts` into Jimi or create another resolver/save writer. Canonical start orchestration is currently inside legacy `main.ts`; `requestExitToMenu` readiness/recovery still expects legacy Journey DOM; unlock/interim persistence is embedded in `JourneyBoardsManager`. Migration therefore needs narrow shared progress, run-start and destination-presentation boundaries before wiring Beach→game→manual Exit/Fail/Clean→retained Beach. Existing `app-core`, gameplay-entry coordinator, terminal navigation lock, drag and endgame owners remain authoritative. This work is not implemented by the presentation changes above.

## Known no-moves incident: preserve evidence (unchanged)

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
