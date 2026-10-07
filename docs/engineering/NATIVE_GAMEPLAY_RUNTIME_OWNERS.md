# Native gameplay migration owner boundaries

Work started 2026-10-07 at explicit user request, with all available agents.
Recovery: native-benchmark-v1. Main target is com.taptapdesign.stacktosix.native.
This is implementation work in progress, not physical parity acceptance.

| Boundary | Owner | Prohibited second owner |
| --- | --- | --- |
| Board state, legal moves, finality, transactions, RNG | StackToSixGameplay Swift package | SpriteKit callbacks deciding rules; concurrent web resolver |
| State/save, mode progression, reward pools, authored content | StackToSixNativeState Swift package | UI-local unlock model; PWA sandbox import/reset |
| Board rendering, pointer admission, finite visual feedback | NativeBoardScene / NativeGameplayViewController | A second board renderer; logic inferred from artwork |
| Home/Hub/Settings/World visibility and motion handoff | NativeAppController / NativeRouteMotion | Web route bridge in the native-only entry |
| Pause/save/restart/exit receipt | NativeEndRunOwner + existing authored UIKit modal | Action before visual exit completion; terminal navigation bypass |
| Persistent native music route/Settings lease | NativeSoundtrackRouteOwner + JimiNativeMusic transport | JS soundtrack ownership in the same native board session |
| HUD score flights and terminal receipts | NativeBoardScene + pure core pending score receipts | Result commits before the score arrival/settlement owner |
| Tutorial policy / sheet / first-play completion | NativeTutorialRules + NativeTutorialOwner + NativeTutorialCompleteController + NativeBootstrap | Presentation marking tutorial done before Continue persistence |
| High Score / Combo | NativeScoreOwner + NativeScoreModalModel | UI-local stats or tutorial HUD bypass |
| Clean / Fail / Arcade continuation | NativeResultOwner + NativeResultController + NativeArcadeRoundPresentation | A separate reward/progression commit |
| Result geometry / themed confetti / Area55 flybys | NativeResultPresentationPlan + NativeResultExitPlan + parent-clock-driven NativeResultConfettiCanvas / NativeResultArea55Flybys | A second clock, result commit or route resolver |
| Result-to-World opaque handoff | NativeResultController + NativeAppController.prepareGameplayReturn / captured parked World | Fading before resources/prime are ready; repeating cold destination preparation; old background receipt publishing input |
| Next-board entry receipt | NativeGameplayViewController.prepareNextBoardEntry + generation-bound NativeBoardScene wave | An expired transition starting another board or input admitted under opaque coverage |
| Journey reward / Flower unlock | NativeJourneyRewardController + NativeSpecialDiceUnlockPresentation + native save | Revealing an unprepared card; local-only unlock flag |
| Gameplay semantic sound / ambient / Arcade mix | NativeGameplayAudioOwner + NativeJourneyAmbientOwner + NativeArcadeMusicOwner | Generic tap replacing authored special cues; new audio transport |
| Native finite special presentation | NativeFinitePresentation + typed Fish/Bottle/Honey/Juice/Area55/TNT-variant carriers | UIKit timers deciding board legality; stale-generation completion |
| Source asset identity / skin runtime inventory | native-special-dice-performance-owners.json + qa:native:admission | Registering a skin without preload/cleanup/test ownership |
| Asset packaging | prepare-native-artwork.mjs | PWA Web.bundle sync; source asset conversion/deletion |

Use the separate Simulator native-gameplay entry to prove a native dependency
chain before default activation. It must never silently create a fresh save if
legacy hybrid data exists. An explicitly isolated QA store may be used only in
Simulator; it is not a production save migration.

Porting code or passing old TypeScript KING checks does not establish Swift
parity. Native fixture/unit/integration checks and physical acceptance are
separate gates. Record unresolved mechanics/visuals in the parity matrix and
leave the final migration checklist open until each has actual evidence.
