# Native ordinary spawn visual safety: actual Source authority

2026-10-09. Scope: private continuation Source. Implementation/admission OPEN.

## Required production behavior

`src/modules/app-core.ts:14086–14160` schedules two **APP wall timeouts**, 600 and 1200 ms, before the ordinary coroutine finally. Each timeout first calls the full `repairBoardTileVisuals` owner, then performs the local opacity sweep. It is not a single immediate alpha reset and not an animation-clock deadline.

`repairBoardTileVisuals` at 869–1038 also restores an unowned regular outer rest pose when scale differs from 1 by >0.005 or rotation by >0.005. Therefore this safety path handles enlarged unowned outer scale as well as collapsed scale; the local <0.86 sweep alone cannot represent it. This is an authority finding, NOT proof that the reported huge-cube phone bug has this cause.

The full owner preserves active drag/idle/merge/pickup/snapback/Laser/TNT/spawn/removal/skip-idle ownership (`tile-visual-repair-policy.ts:1–15`), skips destroyed/hidden/wild-dropping tiles, and separately repairs unowned inner squash/tilt. It restores authored face geometry, regular texture and pips; Wild face refresh belongs to the existing generation-owned asset broker. Preserve original resources.

The later local sweep restores visible locked zero-value alpha <0.08 to 0.2, skips locked/zero/Wild-like tiles before regular opacity reset, and repairs hidden pips. Do not conflate these with minimum-active counting or change canonical gameplay state during a paint repair.

## Native mapping and unresolved dependencies

NativeDiceNode.sourceLocalScale divides by its private geometry scale; paintSourceOuterScale multiplies by geometry scale. Comparing or resetting raw SKNode xScale/yScale to 1 would corrupt tile sizing. Borrow these existing local-pose methods. sourceOuterOwners is only the outer bridge flags: it is NOT a complete substitute for APP drag/Laser/TNT/removal and skip-idle marker writers. sourceSkipIdleScaleReset is separately stored.

NativeDiceNode.ensureSourceAppSpawnFullOpacity restores outer/visual/face/pips alpha and pips visibility. It does not implement the full prepass, two APP deadlines, original face geometry restoration, overlay or asset-broker ownership. Do not admit this helper alone as scheduleOpacitySafetySweep.

Scene.configureSourceOrdinaryMinimumPhase currently requires a supplied true scheduler, complete owned lifecycle capture and real spawn/FIFO bindings. No production caller yet supplies the complete visual repair owner. Keep the flag OFF until these actual owners and enabled Scene behavior are proved.

Next implementation: capture the existing exact Scope/generation, schedule the two deadlines on SourceAppTimeoutOwner, operate on the current live covered roster under complete transform ownership, borrow actual node paint/asset APIs, retire both jobs with scope/restart/dispose, and prove delayed repair plus active-owner exclusions on mounted nodes. Then enable the positive minimum/rescue/finally test using the genuine token/Date fixture; its null-Special/queue companions remain bounded test endpoints, not startup admission.

## Reentry correction made in this checkpoint

The minimum-finally producer invokes an external opacity scheduler. After that call it now rechecks engine generation before queuing finally; stale rejection also cannot publish a presentation failure for the old generation. This extends the existing exact Scope/FIFO checks across a reentrant callback. Compile/runtime QA pending in the checkpoint manifest; the enabled scheduler-restart path is not yet covered by the old mounted spawn-owner tests.

No live main Swift integration, phone installation, PWA sync or grey-flash change.

## Current finite APP scheduler implementation

NativeSourceSpawnVisualSafetyOwner now schedules both real 600/1200 APP jobs on the existing shared timeout owner, invokes required full repair before required opacity repair, and validates generation/Scope currentness after each external callback. Its own exact receipt set is detached before cancellation; unrelated APP jobs remain alive. Scene overload connects that scheduler to the existing normal minimum-finally producer and retires it on spawn-owner/scope retirement, generation transport invalidation and destruction.

The original scheduler-supplied minimum API remains available for bounded ownership tests; the new overload requires both real repair owners. Neither creates missing physical-marker coverage or a Wild broker. All flags remain OFF. Tests exercise actual wall deadlines/reentrant cancellation/generation replacement with explicit bounded callbacks; they do not prove production repairs or resolve the reported oversized phone cubes. See NativeSpawnVisualSafetyWallValidation.json for terminal test evidence.

## Actual marker writer audit

A current Swift reference search finds sourceOuterTileMarkers only declared, read with `?? .init()`, and cleared in NativeBoardScene; there are no producer writes in the private native source. sourceOuterEligibility also ORs generic Core transientSpawn, meter reservations and noMoves runtime fields. That existing idle-eligibility adapter does not establish exact Source APP transform ownership for the visual repair prepass. Do not pass it as a complete repair snapshot merely because all absent fields default false.

The actual outer bridge exposes idleTimelinePresent plus mergeImpact/pickup/snapBack; NativeDiceNode stores sourceSkipIdleScaleReset and genuine selected-slot markers separately. The next repair binding must read those actual owners and connect the missing Laser/TNT/removal/drag writers under explicit constructor/archetype coverage. If coverage is absent, reject admission rather than resetting a live animated tile. No change to the existing generic idle adapter was made in this checkpoint.

## Regular physical Node repair implemented, full admission still OPEN

NativeDiceNode now implements regular full-prepass and local-opacity primitives on genuine Source-covered objects. It combines supplied complete APP flags with actual node idle/outer/drag/skip-idle/locked-slot ownership. It restores unowned local rest pose and inner squash/tilt only with required actual inner retirement authority, preserves numbers skin/texture, normalizes face logical128x128, restores alpha, and handles visible locked-zero faint alpha/local hidden-root pips. No Core or RNG writes. Special/variant/residual-Wild objects refuse this regular primitive and still need the full actual broker branch.

Mounted tests initially lacked actual outer driver and correctly refused physical coverage. The fixture now installs a real Source context/Scope and Scene driver. The next run exposed a512-vs128 face growth when assigning SKSpriteNode.size without first clearing the old scale. New repair now resets face scale before size then restores128-based Source scale, matching the existing Source face constructors. Repeated repair and genuine pickup ownership are tested. This discovery is local to the newly implemented primitive; it is not a phone-root-cause claim. Preserve both failed raw SDK logs and current terminal evidence in NativeRegularSpawnVisualRepairValidation.json.

## Connected Scene repair adapter, remaining production owners

Scene.repairSourceSpawnVisuals now captures each exact current Source-covered Node's mandatory APP owner record before painting any node. Full board pass invokes tested regular primitives or the required phase-aware Special delegate; local opacity pass delegates non-regular faces too, so hidden non-Wild variants are not incorrectly treated as Wild-like. Missing records reject. The minimum configuration overload wires these actual callbacks into the600/1200 owner.

Generation alone is insufficient: each record additionally requires its actual capture/owner epoch predicate. Scene rechecks it before paint and after callbacks, and the regular Node checks it around inner retirement to avoid resetting a new owner's same-generation pose. Bounded mounted tests cover roster repair, missing capture, restart, earlier-record invalidation during later capture, and owner replacement inside inner retirement. Production marker writers and special broker remain to be supplied; do not publish the test endpoints as capabilities.

Special broker authority is `app-core-wild-skin.ts:48–280`: synchronous hit geometry, pips/num/shadow and conditional idle, independent async generation-owned asset handle, exact path revalidation and one-shot decode recovery, then FIFO texture receipt. NativeBoardTextures already owns selected decode/upload/preload dedup and invalidates preparation generation on invalidatePendingPreparation/dispose; purgeUnused only filters retained textures and does not increment generation. Its raw cached texture is not yet a Source broker handle. Reuse that existing decode/upload owner for future typed path/provider-generation handles and exact Source FIFO reactions; preserve all original resources and conditional idle ownership. Static artwork/paint success must not imply request/idle/transport acceptance.

## Typed Special resource receipt implemented

NativeBoardTextures.SourceTextureHandle captures the actual provider UUID, preparation epoch, normalized exact asset path and cache/upload texture identity. prepareSourceSpecialTexture reuses prepareSelectedFinaleAsset, including GPU-preload receipt on cached sources, and publishes only via the bound APP asset task and Source FIFO reaction. A foreign provider, invalidated epoch or removed cache identity cannot validate it; retired Scope drops publication rather than using an async fallback. Native preparation epoch is NOT yet a SpriteKit renderer-context-loss signal.

Five focused actual resource tests PASS (real upload/FIFO, cached upload dedup, invalidation during pending preload, foreign FIFO/reentrant provider disposal, Scope retirement inside current validation). Further Scope.admissionOpen borrows the existing exact Scope.valid predicate so a logically retired but still bound Scope rejects before asset work. This final addition is pending current SDK/full QA in NativeSpecialTextureReceiptValidation.json. Actual Wild/variant paint, synchronous hit/pips/idle ownership and one-shot decode recovery caller remain to connect; the handle alone is not whole broker/skin acceptance.

## Next synchronous skin/input gap

The receipt provides actual resource ownership, not synchronous skin/input setup. Source `app-core-wild-skin.ts:98–142,196–280` sets logical variant hit area immediately, hides/clears pips and num/shadow, sets Wild-face metadata, grants Magnet 1.10 TILE static input, then owns conditional shimmer/bubbles/TNT/Star/Magnet RAF/special idle independently of texture completion. Native `NativeBoardScene.beginDrag` currently selects by geometry.cell(at:) and static eventMode; there is no equivalent per-Node Source hit-area endpoint in that path. Actual Source skin integration must port and connect that geometry to real input, not merely store an unused rectangle. NativeDiceArtwork.definition already records original variant paths/sizes/anchors; preserve assets and admitted archetype rules. Source async skin guards exact path/current handle; repeated same-path requests are legal and must not create extra idle owners or perturb APP Math.


## Actual Wild Node/Scene skin draft — 2026-10-09

Private Node/Scene now borrow the real typed asset/FIFO owner, match live provider/path/cache receipt, retain canonical mobile registry resources, install synchronous hit/pips/shadow prefix and select input using the painted Node transform. Magnet hit is1.10×128; normal Source skin face defaults to122.88 for Magnet-based Bottle/Honey without explicit size override. Repeated uploads reset SpriteKit face scale before size. Active Bottle/Kanta require an actual live anchor reader at texture paint; missing ownership refuses admission. Deferred idle is preserved; active caller callback is mandatory and rejection invalidates pending paint/hit claim. Scene/Scope retirement clears ownership. Tests use explicit bounded active-idle endpoints, not production admission. One-shot decode recovery, actual renderer context mapping, complete idle composer, constructor coverage/marker producers and whole minimum/finally/startup remain OPEN. See NativeWildSkinSceneValidation.json for current terminal/pending evidence.


## One-shot actual Special decode recovery

`prepareSourceSpecialTexture` retries a nil decode once only while the captured provider epoch/path/Scope/current owner remain live. Actual asset checkpoints can drain inline before `finishSelectedFinale` removes its waiter cohort, so recovery borrows the existing serial I/O→MainActor boundary and actual asset/FIFO reaction before reacquiring. Reentrant provider invalidation at that boundary suppresses decoding/publication. SDK cohort and retirement suites each3/3PASS; full current production implementation QA terminalexit0 all selected deterministic gates PASS. This preparation epoch is still not a real SpriteKit renderer-context generation.

Next production gap: Source skin admission currently requires caller idle endpoint; compose exact Source shimmer (except plain Star), Juice/BeachBall bubbles plus TNT stop, conditional TNT particles/shake with defer flag, Star stars, and Magnet particles on tracked next frame, retaining per-variant inner artwork idle. `NativeDiceNode.update` unconditionally calls raw `rebuild()` even on unchanged identity: that producer can replace typed Source texture/anchor after a successful receipt. Cover actual same-identity updates and ownership transitions before declaring the skin owner admitted globally. Raw constructor Source markers and full Scene repair transform writers remain open.


## Actual same-identity model update — validated

Private `NativeDiceNode.update` updates value/depth/lock bookkeeping but preserves Source-owned special static face, live pivot and inner hierarchy when kind+variant are unchanged, including a pending real texture request. A kind/variant change clears the hit/receipt and advances a separate skin revision before callbacks: old A→B→A uploads cannot reclaim the new identity. SDK actual Scene4/4 and full current deterministic QA terminalexit0PASS; raw logs/SHA and two-file draft in NativeWildSkinModelUpdateValidation.json. No native shipping/phone integration.

Remaining activation writers: `setSourceIdleDeferred` calls `rebuild()` after phase reset, and `configureSourceSpecialIdle` starts a pending registration with `rebuild()`. Their raw face/anchor/locked-alpha recipe and Bottle Raw128 pivot geometry remain inconsistent with Source122.88 typed skin. Do not simply suppress the whole rebuild: the actual per-variant inner phase/media allocation must still start at the genuine landed boundary. Split static-face ownership from real idle allocation, then compose original shimmer/bubbles/TNT/Star/Magnet conditional owners with their Source clocks/randomness and retirement. Raw constructors and complete marker capture remain open.


## Actual idle activation and logical face baseline — validated

Private `rebuild` retains Source-owned static texture/size/anchor while allocating the existing actual family idle hierarchy; defer reset no longer resets typed face scale. Bottle grounded motion uses cached requested face height122.88, avoiding per-frame registry/Set work. Typed Wild paint uses SpriteKit logical requested size at baseline scale1 instead of carrying texture-pixel ratio: actual Fish idle activation and drag flip at ±1 retain128 logical dimensions. Current SDK five-test suite5/5PASS and complete current provider/skin/recovery/model/idle matrix24/24PASS; full current deterministic QA terminalexit0PASS, Source/QA frozen with SHA match. No phone/PWA/main Swift integration.

Exact Source conditional FX composer remains OPEN, as do typed animated frame receipts (Raw Bee frame changes still use cache), actual Fish media, complete Source constructors/markers and startup. Existing per-family allocation tested here is not whole Source idle admission. Current consolidated 745-file private code/config/test snapshot and SHA manifest are saved separately; original media stays in the immutable base asset tree.


## Actual Bee mobile frame cohort — 2026-10-10

Private Scene/Node producer loads four exact `bee1…4@2x.png` paths through actual typed provider/APP asset/FIFO receipts. All results settle before playback; usable frames retain original order and minimum2. Current animated face gets a current typed receipt and every cohort path stays pinned in Node resources. Pending/insufficient Source cohort cannot fall through to Raw cached frame swaps. Defer/identity/Scope retirement invalidates publication and playback. SDK actual Scene3/3 and current skin/provider/input/idle/Bee matrix27/27PASS; full frozen production deterministic QA terminalexit0PASS. Corrected/added Swift test files were exercised separately in SDK, not copied during active full QA. Raw evidence/SHA and three-file archive: NativeBeeSourceFrameReceiptValidation.json / Draft.tar.gz. Consolidated current code snapshot refreshed; original assets remain preserved.

Remaining Bee production fidelity: connect Scene producer to actual Source landed/startup caller, capture original settled rotG pose (5% anisotropy predicate), run decoration on the correct host, preserve painted face dimensions and viewport-facing magnitude, restore only its own captured pose on drag/dispose, and match visibility/timeline clocks. Existing Raw face decorative motion is not the Source host owner. Whole conditional shimmer/bubbles/TNT/Star/Magnet composer and global constructor/marker/repair/minimum/finally/startup remain open. No phone/PWA/main Swift integration or whole Native acceptance.


## Actual captured Bee host motion — validated

Typed Bee playback now decorates captured actual inner rotG host instead of scaling/moving the face. Native body/root position and face logical128 remain unchanged; exact original Source motion helper at0.04 was executed locally through TypeScript transpile+Node vm and its SHA/golden values recorded. Capture waits for original min0.01/5% anisotropy predicate. Drag restores only last owned pose and releases its channels; decoration resumes only when the actual captured neutral pose returns. Foreign host replacement prevents old decorative writes/restoration; Scope retirement keeps painted pose. Mounted global facing is computed after decoration. Current SDK30/30 and full current frozen production QA terminalexit0PASS; initial strict float-equality failures and corrected SDK evidence preserved. Two-file current draft/manifest and consolidated code snapshot updated.

Still not whole Bee startup admission: actual Source landed/startup callers, Source frame/visibility clocks, inner transform markers, every registry suspend/resume/dispose path and shared full FX composer remain open. Existing Raw and Source controller stop/paint-preservation semantics must be matched at their actual production boundaries; a pure host test is not phone or full-game acceptance.


## Actual shared registry Bee lifecycle — validated

Registry stop now marks actual family allocation pending and discards Bee frame cohort. While Scope is admitted, it restores only its captured still-owned typed original skin/host; when Scope is closed, it keeps last paint for old Scene exit. Restart waits for new real uploads rather than reusing old phase. Pause/release holds phase and a single actual shared registration; release is idempotent. Source Bee animated demand requires current≥2 uploaded handles. Focused shared Scope SDK3/3PASS and expanded current33 cases plus four existing regression classes51/51PASS; full frozen current deterministic QA terminalexit0PASS, Source/QA/SDK hashes match. Two-file current lifecycle draft, evidence and consolidated code snapshot updated.

Original safe skin/constructor capture when idle begins before typed static texture settles remains open; active restore uses a genuine current typed original receipt only, never synthesizes one from Raw cache. Global startup/landed callbacks, all Source clock/visibility/background/offline routes, inner writer/constructor coverage and full conditional FX composer remain open. No main Swift integration, fresh shipping resource/signing proof, phone install or physical acceptance.


## Actual cold Bee prefix and disposed resource release — validated

Actual Scene `startSourceIdle` now can admit its Bee frame cohort synchronously before static upload. While that cohort remains pending, the real static Source receipt becomes a safe typed retirement fallback; no synthetic Raw-cache handle. This covers late actual static image fallback, not complete original constructor ownership/marker admission. `Node.dispose` also clears original-skin/motion capture even if no idle registry was bound. A real weak SKTexture test confirms original texture release after provider/render teardown while the disposed Node remains strongly held. Targeted2/2 and current extended53/53SDK PASS; full current frozen production deterministic QA terminalexit0PASS, Source/QA/SDK SHA match. Updated two-file cold draft/log manifest and consolidated source snapshot. No main/phone/PWA integration.

Whole original constructor/safe-initial-face ownership remains OPEN, together with startup/landed callers, complete Source clocks/visibility/inner markers/conditional FX, all background/offline routes, fresh shipping resource signing and physical acceptance. Cold fallback does not prove the previously painted Raw constructor texture has a Source receipt.
