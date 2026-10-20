# Native haptic parity — 2026-10-12

Active standalone Native uses Swift → UIKit directly. NativeHapticRuntime is
owned by NativeBootstrap, with cached UIImpactFeedbackGenerator (light/medium/
heavy/rigid/soft), UISelectionFeedbackGenerator and UINotificationFeedbackGenerator.
The archived GameViewController/WKScriptMessage bridge is excluded from the
active target; preserved PWA code is a behavioral reference only.

## Accepted source and policy

production-benchmark-v9 src/utils/haptic-runtime-governor.ts is byte-identical
to the current preserved source. Its exact policy is ported: five impacts per
2 seconds, ten per 10 seconds, six light impacts per 10 seconds; style-specific
minimum/same-style gaps; selection180ms and notification260ms. Protected
committed Merge6, board entry, Laser contacts and Clean counter impacts bypass
the burst budget without mutating it. Every output still checks Settings and
foreground. UIKit generators are reused and no new recurring primitive is added.

## Connected event map

| PWA owner | Native contact owner | Policy |
| --- | --- | --- |
| animations.ts Home enter | NativeAppController actual Home reveal | light at200/355/485ms, governed |
| UIManager/Home/Hub navigation | Bootstrap route feedback | authored light interaction; Home swipe has no extra impact |
| native-world-feedback / journey-card-overlay-modal | World/card committed feedback | tap/manual flip light, card Play medium; entry/return flip does not invent an impact |
| settings-preferences.ts | Bootstrap durable preference adapter | OFF light before change, ON light after successful save; sound/music light gated by current haptics preference |
| hud-helpers / score-bottom-sheet | NativeScoreOwner | light on actual modal opening |
| end-run-modal | NativeEndRunOwner | open light, Restart/Exit selection |
| app-core ordinary merge6 | actual gameplay receipt | protected medium at ordinary reservation, matched later merge receipt cannot duplicate |
| user-requested small stack contact | actual committed merged receipt with value1..5 | one cached light impact at intensity0.35, prepared before each accepted stack; Settings/foreground/disposal gated, independent of finale burst budgets |
| app-core Wild merge6 | actual gameplay receipt | protected heavy then governed heavy150ms |
| special-merge-haptic-policy / TNT-like merge6 | actual gameplay receipt | protected heavy then governed light450/850ms |
| app-core LaserGun | NativeBoardScene confirmed beam contact | one protected heavy per contact, no leading/finale duplicate |
| app-merge Magnet pull | special board commit receipt |1..4 captured-count pulses; last two medium with original extra50ms |
| app-board | Source board-entry owner / existing finite entry fallback | protected light, captured bounded schedule |
| wild-spawn-drop | existing NativeMeterSceneCaller | actual landing medium |
| Star/Juice and custom finale sources | existing Star/Juice/Kanta/Bee/Bottle/Mushroom/Robo/Cubero owners | original finite contact schedules retained, all now governed by the shared Native transport |
| board-transition-screen | NativeThemedBoardTransitionController | actual digit enter/exit light; existing captured clock retained |
| clean-board-modal | NativeResultController / Bootstrap | hero and earned stars medium; changed score counter protected light50ms; CTA entrance medium and actions selection |
| app-core fail/Arcade summary | Bootstrap terminal receipt | error notification, or medium for Arcade round2+ summary; one terminal pulse per generation |
| journey-new-card-screen | NativeJourneyRewardController | existing reveal/contact schedule; Collect selection |
| tutorial-complete-modal | NativeTutorialCompleteController | existing authored light/medium/selection schedule |

Existing source guards still admit each authored callback. New delayed merge/Home/
pull patterns use NativeFinitePresentation and the existing shared animation
service, with weak captured route/gameplay/generation and presentation-failure
checks. Route replacement/exit cancels outstanding sequences. Background cancels
sequences, resets governor history and suppresses all output until foreground;
foreground does not replay old contacts. Disposing Bootstrap retires transport
observers and sequences. Haptics are independent of audio preferences.

## Validation boundary

NativeHapticRuntimeTests covers exact governor windows/styles, protected bypass,
Settings/foreground refusal, stale/retired sequence suppression,17 Wild identities
in both directions, real mounted Settings touches and an accepted actual board
merge reaching the direct transport. Clean counter cadence has its own test.
Adjacent result, board entry, Laser and reward regressions are run separately.
See CURRENT_HANDOFF for terminal receipts. No phone install/save mutation in this
task. Physical actuator intensity, perceived timing and prolonged-play acceptance
remain NEEDS PHYSICAL TEST; Simulator evidence does not prove tactile feel.
