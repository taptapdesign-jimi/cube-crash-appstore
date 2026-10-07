# Native gameplay parity inventory

Visual reference: immutable `production-benchmark-v9` plus later changes explicitly accepted by the user (reaffirmed2026-10-07). Same CTA, textures, fonts, colors, shadows, spacing, shapes and motion recipes; original asset/audio bytes preserved. Migration checkpoint: `native-benchmark-v1`, current accepted authored TypeScript owners and Gameplay KING. Native app identity: `com.taptapdesign.stacktosix.native`. The matrix tracks implementation and evidence separately. A source port or successful build is not full gameplay/visual acceptance.

## State and content owners

| Concern | Preserved source owner | Native owner | Evidence / remaining requirement |
| --- | --- | --- | --- |
| Mode identity and board identifiers | `run-mode.ts`, `board-save-utils.ts` | `NativeRunMode`, `NativeSaveEnvelope` | Journey runs keyed by existing board integers; Arcade distinct run/stats/pending receipt. |
| Initial phone/tablet board | `constants.ts`, `app-core-board-build.ts`, `app-core-open-tiles.ts`, `app-core-utils.ts:randVal` | `NativeBoardFactory` | 5×9 phone / supplied 7×9 tablet; all placeholders; 30% shuffled opening; same opening weighted values and Journey bias. Tutorial demo cells retained. |
| Settings | `index.html:loadSettings/saveSettings`, `settings-preferences.ts` | `NativeSettingsPreferences`, `NativeSaveStore` | SFX false / music true / haptics true defaults. Toggle haptic order and interruption feel remain UI/audio integration tests. |
| Per-World completion and interim | `journey-world-stage.ts`, `journey-boards-manager.ts` | `NativeProgressionState` | Independent starters 1,11,21, highest completed+next locked in each World; Arcade never changes Journey. |
| Score/stars/rarity and authored card order | `journey-stage-balance.ts`, `journey-card-assets.ts` | `NativeJourneyContent` | Repeating ten-stage thresholds; all three current authored reorder maps preserved; rarity derived from score. |
| Forest reward pool | `journey-forest-wild-progression.ts` | `NativeJourneyContent` | Star → Bee → Flower → Honey → Mushroom → Barrel intro; TNT enters board7 cumulative pool; persisted spawn count stays run-scoped. |
| Beach reward pool | `special-dice-registry.ts`, `journey-world-intro-wild.ts`, `app-core-wild-type.ts` | `NativeWildRewardPolicy`, `NativeJourneyContent` | Board11 Fish intro and 60% Juice cadence / forced Juice after Star; board12 Juice intro; subsequent five equal slots and exact independent RNG draw boundaries. |
| Area55 reward pool | `journey-area55-wild-progression.ts` | `NativeJourneyContent` | Current order Kanta21, Robo22, Spaceship23, LaserGun24; cumulative Star+introduced variants. |
| Arcade meter reward + repeat guard | `app-core-wild-type.ts`, `board-specific-rules.ts`, registry callsite | `NativeWildRewardPolicy` | First Arcade Magnet, stage1 Bottle/Barrel registry indices, board-filtered weighted types and two-drop repeat guard; 15,200 independent TS fixtures include exact additional RNG consumption. |
| Versioned coherent save / recovery | `app-core-save-schema.ts`, `app-core-save-tiles.ts`, atomic storage owners | `NativeSaveStore`, `NativeSaveEnvelope` | Atomic native document+previous coherent fallback, product/version guards, transient/grid rejection, successful-write dedup. No external PWA storage reads. |
| Resume attempt reward and expiry | `run-combo-bonus.ts`, Journey save validity | `NativeSaveEnvelope.resumedRun` | Earned attempt combo reward survives; live combo resets; generation advances; per-import-run original age preserves seven-day validity. |
| Separate Native hybrid save import | Web localStorage keys inside Native sandbox | `NativeHybridImporter`, migration-only `NativeHybridExport` | Strict explicit Native product export; settings/stats/current board grids/variants/spawn counts/tombstones/Arcade pending receipt and explicit Flower/Juice unlock flags. Existing WebKit data without native envelope blocks fresh boot with `requiresLegacyImport`. Blank original-origin default-profile export reads canonical `cc_saved_game_board_NN` keys without starting the old game; actual dedicated Simulator transport test PASS, including unchanged source values and durable coherent import. |
| Authored World Units | `journey-boards-manager.ts:renderForestMapAssets/readNativeForestSnapshot` | `NativeWorldLayouts` + build-time JSON | Exact original specification producer exports nine viewport widths; Swift reciprocal-width geometry verified against all exports. Constant protocol integers keep original numeric types for direct native consumer admission. Native state overlays complete/interim/locked/actions/card art/stars. |
| Beach bubbles / Area55 ships | `createNativeBeachBubbleProjection`, `createNativeArea55ShipProjection` and canonical samplers | `NativeWorldPlanning` | Swift retained plans match independent TypeScript oracle over two 11-second cycles. All direct frame fields preserve Double transport, including delayed zero opacity; JSON round-trip coercion is not acceptance evidence. Native renewal callback must be generation scoped. |
| Forest bee flight/gate/direction/depth | `journey-forest-bee-orbits.ts` | `NativeForestBeePlanning` | Five retained mobile IDs, Float32 Catmull-Rom/gate/depth/direction-blend/size recovery match independent canonical TS oracle across eight cycles (88 seconds). Generation-scoped native renewal and physical appearance remain integration/acceptance checks. |

Swift package: `native/gameplay-state`, depending on `native/gameplay-core`. 22 package tests PASS (2026-10-07 22:28): deterministic opening, thresholds/intros, mode isolation, coherent save recovery, invalid-write refusal, legacy guard/import, explicit unlock flags, additive Native-v1 save compatibility, expiry/dedup, every authored viewport and retained ambient parity, direct native protocol identity/frame numeric types, 308 independent pure gameplay/score fixtures and 15,200 authored reward policy fixtures. Physical behavior: **NEEDS PHYSICAL TEST**.

## Additional finite native presentation evidence

| Concern | Native owner | Evidence / remaining requirement |
| --- | --- | --- |
| New Reward cold reveal, component transforms and foil | `NativeJourneyRewardController`, `NativeRewardMotion`, `NativeRewardFoil` | Immediate mount; required selected artwork admission queues rapid cold taps. Original nested transform order, CSS ease-in-out tilt, drag return and 26 independent TS foil samples. Common smoke planner matches 576 original particle fixtures. UIKit route and physical visual acceptance are separately reported by root. |
| Flower, Barrel and Beach Ball | `NativeTntVariantPresentation`, `NativeBeachBallPresentation`, typed planners | 216 Flower particles, 256 Barrel debris paths and 72 original GSAP Ball samples match independent source oracle. Real frame-6 / first-visible-paint callbacks hand immutable captured gameplay transactions to the board owner. Individual target impact smoke/shards still require remaining source parity work. |
| Clean/Fail geometry, headline inventory and component motion | `NativeResultPresentationPlan`, `NativeResultExitPlan`, `NativeResultHeadlines` | Original 114 Clean / 98 Fail headlines, nested responsive layout, 64px shared CTA carriers, dynamic score counter duration and distinct CSS transform order retained. Pure source plans and actual AuthoredResult5/RootResult9 tests PASS; root consumes the plans with source-owned status wrapper, separate CTA carriers and native persistence/action receipts. Long Fail title glyphs were inspected without clipping; Clean/Fail captured opaque handoff and actual Fail→same World return passed the272-test Simulator snapshot. Physical raster/return continuity remains separate. |
| Clean Board themed celebration | `NativeResultConfettiPlan`, `NativeResultConfettiCanvas`, shared `NativeBeeLeafMotion` | All three original themes: Area55 300 pieces, Forest 42 leaves, Beach 40 bubbles. 1,528 independent executed TS plans and 4,584 poses match, including exact random consumption. Selected six-image preparation, single pixel canvas, no separate clock, stale/background/dispose guards, hard 9.8s lifetime. Actual AuthoredResult5/RootResult9 integration PASS; physical visual acceptance remains separate. |
| Area55 result ship flybys | `NativeResultArea55FlightPlan`, `NativeResultArea55Flybys` + parent result clock | 36 independent executed TS plans, 7,272 poses and exact RNG draws PASS. Selected one preserved ship image, opposite depth0/2 around result content1, native6.7s retirement; foreground/stale/disposal and actual connected result tests PASS in the272-test Simulator snapshot; physical depth/glow remains separate. |
| Finite result SAX receipt | `NativeGameplayAudioOwner`, `NativeAVGameplayAudioTransport` | Result music hook releases from actual native authored SAX end/stop/unavailable receipt. No visual timer supplies an audio completion. Actual-file test awaits callback with bounded 1.5s timeout; source gains, pooling and per-shot Laser identities remain independent of generic navigation taps. |
| Journey themed Board Transitions | `NativeThemedBoardTransitionController`, `NativeTransitionScenePlan`, `NativeTransitionCloudPlan`, `NativeForestTransitionBees`, `NativeTransitionRoboCombatPlan` | Forest/Beach/Area55 source scene geometry and tracks retained: 36 cloud scenes, 1,446 actual GSAP arrival poses, 618 executed ambient poses, 1,050 captured exit poses, 128 original randomized exit-order/draw fixtures, Forest bees 113,373 scalar/state checks and Area55 combat 10,335 numeric checks PASS. Original selected assets, paper texture/tint/gradient, local Stage01–10, source166px tabular font, scene/cloud/fighter depth contexts, original beam1/2 and digit-enter sound contacts. Source theme mix phases 62% arrival → 50% hold → 20% exit/320ms soft tail → 33% lift use the existing native voice and actual fade-end receipts; active generation lease blocks route-gain overwrite. Native finite clock pauses in background; stale-generation/preparation/dispose guards; required asset failures stop admission; scene cleanup retains opaque paper until coordinator explicitly releases after prepared board frames. Actual full controller lifecycle, all3 fresh scene routes, resumed/completed World CTA admission, Continue-next-board and Music4 fade receipt tests PASS in the272-test Simulator snapshot. Original-art render snapshots inspected; physical raster/motion/speaker acceptance remains pending. |

| Ordinary move phases | `NativeOrdinaryMovePlan`, `NativeGameplayEngine`, actual SpriteKit absorb/postcheck receipts | Linked pure core69 and actual Ordinary5/Board27 PASS. Small-stack contact/counters are immediate, source carrier removal at80ms; conditional100/0 postcheck owns move debit. Ordinary6 contact/audio at0 and captured main at80; exact logical assignment admission remains separate from interruptible decorative bounce. Source delayed locked180/280/380 and primary130/cleanup180 assignment draft79 tests remains isolated before joint integration. |
| Native stable save admission | `NativeSaveEnvelope.isCoherentRun`, `NativeBootstrap.record` | State23 tests PASS. Reserved transient/removal/protected6 cannot overwrite the durable coherent snapshot; background settles or cancels source-owned receipts before flush. |
| HUD chrome / body decor | `hud-helpers.ts`, `app-core.ts`, source selected World decor | Native Arcade-only bottom Round pill and top10px orange/beige Wild meter replace prototype placement; displayed Moves counter removed.35 executed original viewport/safe-area samples and actual Chrome3/Paper2 PASS. Canonical paper is one fixed UIKit surface below transparent gameplay canvas; Result reuses source texture100%/gradient/tint0.4. Full HUD entry/close geometry, animated meter decor, exact final Wild-measured board geometry and selected Journey bottom decor remain OPEN. |

## All registered visual variants

Canonical native registry must retain each identity and its shared rule owner. Authored assets remain unchanged.

| Variant | Gameplay archetype | Authored presentation reference |
| --- | --- | --- |
| Fish (`fish`) | Star | `fish-swim`, Fish bubbles finale |
| Kanta (`kanta`) | Star | Two-sprite squeeze/stretch idle, Kanta center sequence |
| Bee (`bee`) | Star | Four-frame drag-safe cycle, Forest leaf/bush flight; orbit suppression |
| LaserGun (`laser-gun`) | TNT | Gun/beam crossfire; dedicated timing/layers/audio |
| Spaceship (`spaceship`) | Magnet | Hover/beam, abduction composition |
| Bottle (`bottle`) | Magnet | Float, ocean/palm/bubbles finale |
| Honey (`honey`) | Magnet | Honey drop / bees / authored impact family |
| Flower (`flower`) | TNT | Animated flower, authored leaf explosion |
| Barrel (`barell`) | TNT | Existing immutable `barell` spelling, authored crate/backpack explosion |
| Mushroom (`mushroom`) | Juice | Pop/growth/drop sequence |
| Robo Cube (`robo-cube`) | Juice | Four-frame idle, Robo/neon finale |
| Cubero (`cubero`) | Star | Hop/flag/debris composition |
| Beach Ball (`beach-ball`) | TNT | Juice-style visual finale; older Juice/Magnet save variants normalize to TNT, per source compatibility owner |

Generic Star/Juice/Magnet/TNT idle/finale/audio families are additional presentation owners, not replacements for these thirteen variants.

## Required gameplay parity scenarios

| Scenario | Authority / required evidence |
| --- | --- |
| Ordinary legal/rejected drag, repeated rapid drags, exactly-one commit | `drag-core.ts`, `input-gate.ts`; Swift transaction fixture + touch UI test |
| Ordinary sum below six / non-final six / only-pair final six | Canonical resolver and final snapshot fixture; continuation spawn counts/values match |
| Wild final pair, mixed specials, last-tile special | All-archetypes KING matrix; no skin invents rules |
| Magnet consumed IDs/survivor and continuation | Mutation transaction and survivor fixture; exact input release |
| Juice spawn and TNT mutation extent/order | Current source transactions; visual finish never authors next state |
| Late visual tail and new ordinary merge-six | KING shared-lock matrix; ordinary play remains admitted |
| NO MOVES candidate / visible confirmation / mutation or drag cancellation | Source two-stage revalidation; navigation lock begins at visible candidate; terminal commit only after atomic check |
| Non-final lingering-six rescue | Capture cell, coherent removal and exactly-one replacement attempt; excludes final/magnet/pull owned six |
| Fail/Clean exactly once, combo/efficiency captured once | Shared terminal owner plus attempt reward fixture; same result projection and persisted progress |
| Restart / exit mid-action / background and relaunch | Generation cancel/reject stale callbacks, coherent save snapshots, isolated application service disposal |
| Arcade next stage and result score carryover | Pending continuation receipt consumed before older save; Journey untouched |

These rows are not complete merely because the implementation compiles. Root integration records actual Swift fixture, Simulator route and physical evidence in the handoff.

## Remaining bridge and surface inventory

The legacy `native/standalone/Stack to Six/GameViewController.swift` still contains WKWebView transport, script-message handlers, JavaScript thermal/recovery/preferences/music/route hooks and web diagnostics. The new native coordinator must enter its Swift owners before WKWebView creation to prove a no-web route. Preserve the archived source while call-site and acceptance evidence are incomplete.

| Surface / operation | Required native boundary |
| --- | --- |
| Home, Hub, Settings/Privacy, all World Units/cards | Reuse accepted `JimiV9*` / `JimiNative*` UIKit geometry and motion, native state injection |
| Play/Continue and card return | Native generation/route owner, saved-board gating and native accepted transition receipt |
| Board and HUD | SpriteKit rendering and typed pure-Swift command/result, no JS board calls |
| Tutorial, Wild Meter guidance and hand animation | Existing authored tutorial sequence and request/completion preferences, native input admission |
| End Run, NO MOVES, Fail, Clean Board, Arcade stage clear, New Reward | Native modal lifecycle and exact canonical result/progression routing; preserve artwork/audio |
| Background/foreground, memory/thermal, audio interruption | Native lifecycle/services plus safe coherent persistence; no web recovery hook |
| Developer diagnostics | Native internal surfaces, no hidden web escape |
| Native hybrid migration | One-time export/import inside this Native app only; never PWA sandbox |
| Packaging and ordinary launch | Native-only resource library, intended Debug/Release feature admission, no Web.bundle runtime dependency |

Full closure requires no web entry in shipping configuration, all gameplay/presentation parity rows, actual isolated-save migration and physical regression/soak acceptance. Until then the immutable starting benchmark remains a hybrid recovery reference.

## Migration-only WebKit exception

`NativeHybridExport` temporarily creates a blank WKWebView on `app://localhost` using this Native bundle's original default WebKit profile. It reads localStorage because those existing saves are origin/profile scoped; it never opens another app container, serves `Web.bundle`, boots gameplay, mutates the source values, or supplies normal Native UI/gameplay. Product identity is checked before construction. Export validates into one envelope and writes atomically before success; errors preserve the old profile and block silent reset. The view and navigation callbacks are disposed at completion/cancellation/12-second timeout. After successful migration the native save file is the startup owner and normal launch needs no exporter. This scoped migration transport is the only intentional WebKit exception in the new Native entry. `NativeHybridExportTests` seeds the original origin only on the dedicated QA Simulator, verifies unchanged source values and coherent durable Native save, and restores the source profile on success or failure.

## Captured ordinary assignment and regular-six checkpoint

Core85/85 PASS includes source outer50ms/preparation, locked180/280/380ms
assignments, retained placeholder IDs, primary130ms awaiting actual0.56s bounce
or valid pickup, independent180ms identity-safe cleanup, zero-success forced
recovery0/100ms and background once-only settlement. Original callback oracle
includes busy-ending during the awaited postcheck; exact-font admission rejects
before revision/RNG/reservation. Actual Ordinary8 and source-layer/translated-touch
RegularSixScene2 PASS in the66-test snapshot; an initial logical-release frame gap
was caught and fixed before that run. Native regular-six vector smoke/shards/uncapped
multiplier/shake match74,303 executed original TS/actual GSAP checks and six actual
carrier tests. Latest shake owns cleanup while older accepted1s decoration finishes.
Shared hot-factor notifications, native source frame-budget policy, Journey bottom
decor shake and remaining generic Wild impact effects remain OPEN.

The66-test snapshot passed65; its remaining Board fixture expected the former
root UIImageView. The fixture now checks the canonical paper, its actual texture
frame and first-child ordering while preserving initial-entry once-only checks.
Recovery1/1PASS and actual gesture UI1PASS20.811s are recorded in CURRENT_HANDOFF. Physical verdict
remains NEEDS PHYSICAL TEST.
