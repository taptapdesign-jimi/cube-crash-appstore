# Native Arcade implementation TODO — 2026-10-18

## Implemented, awaiting consolidated final checks

- [x] Arcade Hub and Endurance / One Lucky Drop / Slow Burn world modals, original assets/arcade art.
- [x] Endurance existing gameplay; One Lucky Drop one random Special drop per round; rounds1–4 gentler,5+ normal; Slow Burn half meter gain plus round carry.
- [x] Independent saves, pending rounds, highscore/combo/stage records; old saves remain Endurance.
- [x] Gameplay footer Mode - NN.
- [x] Hub left/right/left;20percent enlargement then requested4percent reduction; PureDice+15pt / SlowBurn+34pt. Crate icon also4percent smaller.
- [x] World tap gently scales up and returns over0.5s before modal; exact identity cancels stale/repeated taps on hide/background/route exit.
- [x] Compact modal art20percent smaller; standard CTA226×64 centered with40pt paper below; descriptions measured; safe-area bounds.
- [x] Modal shared Backpack idle, inner artwork gentle idle, short drag returns and long downward drag dismisses; foreground/pause/disposal ownership.
- [x] Hub top-right crate icon -> Crate screen;3 Arcade dice,2+1, Forest Backpack-sized cells; detail and return to same Hub.
- [x] Endurance and SlowBurn gameplay crate -> Crate modal,3dice2+1 matching Journey gameplay Backpack cell sizes.
- [x] One Lucky Drop gameplay no crate icon or hit target/programmatic opening.
- [x] One Lucky Drop slowly fills once; consumed meter stays empty through resume, next round starts fresh.
- [x] Journey original layout/Backpack behavior preserved; exact paused board resumes after gameplay collection.
- [x] Consolidated SDK18 tests PASS; final visual/lifecycle12 tests PASS, screenshots390/320 reviewed.
- [x] FullQA530suites/4010tests plus KING330/type/lint/build/audits; feature admission, Native identity and diff review PASS.
- [x] Complete-tree normal Debug build; verified .native bundle, in-place shared Simulator installation and normal launch PID76205.
- [ ] User visual/touch review; physical performance/audio/thermal acceptance separate.

## Owners

Hub/view/modal: NativeArcadeHubView + JimiV9HubView, shared finite motion/drag/idle owners. Root: NativeAppController routes/generations and cached collection replacement. Rules: NativeArcadeVariant / NativeGameplayEngine. Save: NativeSaveEnvelope / NativeProgressionState. Collection: NativeBackpackView presentation configuration / NativeGameplayBackpackController / selected NativeBackpackDetail. No new renderer, scheduler, audio transport or asset bytes.

- [x] Latest modal correction: Play CTA and paper exit immediately together like Exit Game; prior300ms delay removed. Stable bounds/centers and frozen painted idle pose prevent lower-paper narrowing on relayout. SDK10/fullQA PASS, shared Simulator normal launch84166.
