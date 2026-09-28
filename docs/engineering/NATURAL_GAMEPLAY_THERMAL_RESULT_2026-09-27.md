# Natural Gameplay Thermal Result — 2026-09-27

## Verdict

**FAIL — reproduced severe device heating during natural play.** The iPhone 13 blue moved from native `nominal` to `fair`, then to `serious`, while unplugged at fixed 55% brightness. The user independently reported the phone as **vruc** at the final Forest return.

This run does not show a duplicated Journey owner, retained gameplay ticker, Special/Wild atlas leak, or growing GSAP/WAAPI population. It instead points to cumulative active rendering during real play: the 390x844 Pixi board renders at 1.5 resolution and repeatedly runs at 60 FPS during interaction, followed by continuously animated result and World compositing. Static Forest alone previously stayed nominal for 12 minutes, so idle Forest is not the sufficient cause.

## Route and setup

- Installed Stack to Six 1.0 build 3, bundle `com.taptapdesign.stacktosix.Stack-to-Six`.
- Diagnostic launch flags: `--cc-performance-diagnostics --cc-thermal-isolation`.
- iPhone 13 blue, iOS 26.6 beta, brightness 55%, Low Power Mode off.
- Cable disconnected at 22:45:06 CEST; battery state remained unplugged until 23:00:56.
- Route: Forest baseline; Forest board Fail; Play Again and second Fail; Forest return; third Forest board to Clean Board; closed and opened New Reward waits; Forest return; Beach idle; Area 55 idle; final Forest return.
- User observations: Forest returns and Beach were smooth. Area 55 had no definite hitch but did not feel perfect. Final Forest return was smooth. Phone was hot.

## Native thermal evidence

| Time | Phase | Thermal | Battery | Haptic impacts |
| --- | --- | --- | --- | --- |
| 22:45:06 | unplugged | nominal | 90% | 2 |
| 22:46:20 | Forest baseline | nominal | 85% | 4 |
| 22:48:19 | first Forest board | **fair** | 85% | 41 |
| 22:49:00 | first Fail | fair | 85% | 97 |
| 22:54:46 | opened reward | fair | 80% | 198 |
| 22:58:59 | Beach to Area 55 handoff | **serious** | 80% | 230 |
| 23:00:26 | final Forest | serious | 80% | 232 |

iOS battery reporting is coarse. The observed 90% to 80% change is evidence of nontrivial use, not a precise energy rate. The test started native nominal, so the native thermal escalation is valid even though no temperature sensor degrees are available.

## Lifecycle and resource findings

- Initial and returned Forest held the expected 65 admitted idle elements, two ambient canvases, and one infinite GSAP timeline. These counts did not grow after board/result cycles.
- Gameplay Pixi ran at 60 FPS during active play and settled to 30 FPS on Fail. `suspendGameplayRendererForTerminal` worked: result samples showed `terminalSuspended=true`, `tickerStarted=false`, zero live tiles, and hidden board/stage.
- Special/Wild sheet residency reached about 11.99 MB during gameplay and returned to zero after terminal exit. No retained atlas accumulation was observed.
- Forest returned with one active long-loop owner and two playing media elements, matching its initial stable state after transient handoffs settled.
- Web Animation and GSAP counts did not grow cycle over cycle. The final Forest had fewer GSAP children than the initial Forest.
- Media canvas count ended one above the initial Forest count after visiting Beach and Area 55. This is bounded in this run and is not enough to explain the thermal escalation; it should remain covered by lifecycle QA.
- Gameplay decoded audio grew from about 1.65 MB to a bounded 32.6 MB working set and the context remained running while voices were idle. This is avoidable residency/state work but previous matched audio-isolation evidence rejects managed audio as the dominant heat owner.
- The session emitted 232 physical impact requests, mostly during boards. Previous matched enabled-versus-suppressed haptic evidence rejects the actuator as the dominant owner, though the density remains high.

## Frame behavior

The five-second RAF windows were generally smooth despite heating. Weighted averages remained near 16.7 ms. There were short transition/gameplay outliers, including roughly 125 ms during first-board entry and roughly 96–103 ms around Journey/result handoffs, but no measured post-start frame exceeded 250 ms. This confirms that a phone can become thermally serious while the visible route still feels mostly smooth.

## Attribution boundary

The cable-started Power Profiler ended when the cable was removed, and a wireless reattach timed out on iOS 26.6. Therefore this run has no continuous Instruments watt/CPU/GPU series. The persistent native/JS JSONL is complete. Full performance diagnostics also owns one measurement RAF, so its absolute thermal time is not a production acceptance number. A prior native-only natural route also reached `fair`, and the user's normal-build reports reproduce heat, so diagnostics are not a sufficient explanation for the product issue.

The strongest supported category is **sustained render/compositor work during active gameplay and animated screen handoffs**, with the 1.5-resolution Pixi board at interaction-driven 60 FPS as the highest-priority remaining production target. The evidence does not support another broad audio, haptic, Forest-only, reward-only, or cleanup rewrite.

## Evidence

- Complete current session: `logs/natural-cycle-power-20260927/CCNativeThermal/thermal-1790541861086-53281.jsonl`
- Short pre-disconnect Power Profiler trace: `logs/natural-cycle-power-20260927/natural-cycle-2.trace`
- Failed wireless trace attempts are retained separately and must not be treated as measured gameplay power.

## Next bounded change

Optimize the board render pipeline while preserving authored Special/Wild leases and direct-manipulation smoothness. The change should reduce generic interaction-driven 60 FPS residence and/or the mobile 1.5 backing-store cost, then be accepted with a native-only, diagnostics-off, nominal-start replay of this same route. Result screens and World screens must retain their current verified cleanup counts.
