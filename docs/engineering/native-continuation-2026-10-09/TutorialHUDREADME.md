# Native Source tutorial HUD dim continuation — 2026-10-09

## Recovery / scope

Recover verified pause source/media →Entry delta →Tutorial delta →TutorialIntro delta, then apply ONLY the eight files in `TutorialHUDSourceDelta.tar.gz` against `TutorialHUDManifest.json` base hashes. Null means new/absent. Verify every resulting hash. Never overwrite dirty live source or a later composition with full-file deltas. Current isolated source `/tmp/native-resume-20261009/source`; Native Swift is byte-identical to SDK host/final QA snapshot.

New `sourceTutorialHUDEnabled` and all whole Source flags remain **OFF by default**. It is a bounded fresh guided-phase dim owner, not full tutorial admission. Actual Scene preparation first calls the existing reveal callback (render overlay), then starts HUD dim in original order. Before preparation, Source opt-in HUD stays at original alpha, while canonical Engine input rules remain authoritative.

`NativeSourceTutorialHUDOwner` captures genuine root/children plus the Native unified round indicator. It borrows APP service/FIFO and Scene's actual timeout registry, starts original420ms sine.inOut alpha roots, then runs the separate wall120 interval in its original monotonic phase. First interval kills captured fades and clamps ordinary children to.2; wildLoader retains captured original alpha. Root remains visible at original alpha. Subtree interaction flags are disabled; no Engine decision, RNG, save or audio owner is introduced. Once fades are canceled, only the captured wall interval remains; no additional display link is created.

Scene synchronization and resize retain HUD-owned alpha. Reparented child captures cannot be repainted. Generation/route/Scope retirement cancels exact roots and timer without touching other owners and preserves current paint. Leaving the guided dim phase releases this owner; full Source animated restore (alpha delays/scale bounce/Math), later interactivity and monitor/step handoffs remain **OPEN**. Existing prototype behavior is not Source restore acceptance.

## Proof

Final actual Native SDK **31/31 PASS**, zero skips/failures: HUD5, actual Scene8 (including genuine HUD Scope disposal), activation6, tutorial Bootstrap1 and intro11. `/tmp/native-resume-20261009/hud-final-sdk.xcresult`; durable `hud-final-sdk.log`. Earlier30/30 excludes the final real Scope case; do not sum runs.

Actual Bootstrap demonstrates original alpha before genuine preparation, real HUD owner afterward, wall clamp, synchronize retention and unchanged saved tile state. Owner cases cover independent pause/background clock domains, precise disposal, other owner's timeout retention, reparenting, stale scope and original loader alpha. Actual Scene Scope case proves interval cancellation, retained paint and no late Math/state mutation.

Full Source QA final receipt/log is recorded in CURRENT_HANDOFF and `hud-final-full.log`; separate from Native SDK. Same documented QA-only precompiled storyboard/Assets.car workaround as TutorialREADME: SDK proves exact Swift behavior, not fresh original-resource compilation, Release, physical GPU/FPS or phone acceptance.

No phone install, PWA sync, artwork mutation, main/index/remote operation. **NEEDS PHYSICAL TEST**.

## Exact monitor work next

Original `prepareTutorialBoard` calls `startFirstStepMonitor` before renderOverlay/startHudDim. It tracks pointerdown on bound tutorial tile objects (markTutorialPointerDown), not an arbitrary wait or an endgame marker. Its independent120ms interval does nothing before user interaction, then finds the first surviving actual captured Three/Two object whose value is5. Detection cancels polling, runs actual pointer pop-out200ms back.in(1.7), actual sheet exit280ms power2.in, then real-wall90ms activation of step2. These are sequential completion boundaries, not a summed timeout.

Current Native `advanceTutorialAfterMerge` changes `.stack` →`.mergeSix` immediately at logical merge. Current Scene also retires preparation on that step change, and NativeTutorialOwner refresh immediately presents the next sheet. Merely adding a polling helper would observe a transition already committed, rather than own it. First establish the actual step-one presentation/input/state boundary and captured surviving-node receipt, then wire the real monitor/exit callbacks; preserve pending face/stack objects, source input legality, save compatibility, FIFO, nested initial repair RAFs, independent intro timers and Math. Actual 3+2 merge tests must demonstrate no premature1+5 admission or next-sheet reveal, cancellation on route/generation replacement, exact completions and no fake arrival. Source tutorial resume/restart remains separately unadmitted.

After monitor: Source subsequent steps/input/cleanup and HUD restore →tutorial resume/restart →original Magnet/regular-six/statistics/TNT order. Grey Journey→Play flash **OPEN and LAST**.
