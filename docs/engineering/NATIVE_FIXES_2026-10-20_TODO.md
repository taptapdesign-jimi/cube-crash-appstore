# Native fixes — 2026-10-20

Scope: Native only; preserve saves, original assets, PWA and legacy targets.

## Audio — agent audio
- [x] Reduce coin TNT money cue playback gain by 50%.
- [x] Later user request: HUD coin contact gain scales linearly from +5% for smallest to +25% for largest, using captured flight size before trophy shrink.
- [x] Preserve Forest gameplay ambient through Unit 02 → 03 Continue and transition.

## Gameplay and discovery — agent gameplay
- [x] Globally keep new Backpack dice locked until actual landed Wild/Special discovery; cover modal and collection screen, every World.
- [x] Preserve durable discovered dice after reading, closing and restoring saves.
- [x] Bee center pose chooses one random facing; remove repeated turning.

## Backpack presentation — agent backpack_motion
- [x] HUD alert leaves Backpack closed; accepted modal open animates closed → open and holds it.
- [x] Accepted modal X/close starts open → closed immediately alongside modal exit, including interruption/reopen ownership.
- [x] Navigation opens during Journey exit and closes on Backpack return; align existing icon artwork seamlessly.

## Journey motion — root
- [x] Main World illustration moves opposite to first two Units with continuous, orderly enter/idle handoff.

## Integration and validation — root plus agents
- [x] Focused regression tests for actual owners, persistence, lifecycle and affected variants.
- [x] Required gameplay, audio, feature, special, fast/full and Native identity gates.
- [x] Independent final diff review and resolve findings.
- [x] Build complete current tree, verify .native identity, install over retained dedicated Simulator, launch normal app.
- [x] Verify actual Silent Mode Off for audio review; inspect affected Simulator flows.
- [x] Record evidence and remaining physical acceptance boundaries in CURRENT_HANDOFF.
- [x] Deliver completed checklist and concise user test steps.

## Completion evidence

PASS final qa:full: KING330,530 suites/4010 tests. State73/0. Mounted affected
regressions cover all14 discovery introductions, durable read/reload, actual Bee,
40 audio tests, all-World inverse clock/modal/reentry, actual meter/input roots,
Backpack lifecycle and navigation. Final actual Metal-host roundtrip4/0 PASS;
late resource completion cannot pause finite HUD switch, and host quiets afterward.
Normal complete-tree Debug build/install-over/launch verified, Native bundle identity
confirmed, normal CUA navigation/gameplay modal reviewed, actual Silent Mode Off verified.
See CURRENT_HANDOFF for logs and the corrected initial failed-test chronology.

## User review steps

1. Complete Forest 01, then open Forest 02 before earning its first drop. Bee remains discovered; Star stays locked in both Backpack views until Star really lands. Repeat the same introduction/drop flow in other Worlds.
2. With a fresh unread alert, check the HUD Backpack stays closed. Open the collection: it switches open and stays open through detail open/close. Dismiss the collection: it switches closed and the same paused board resumes.
3. Open Backpack from Journey Hub and an individual World. Check open switch during exit and reverse switch on return; repeat rapidly and background/foreground once.
4. Watch a centered Bee across idle hover, pause/resume and dragging: settled facing stays stable.
5. Continue Forest 02 → 03 through Clean Board/board transition; ambient returns and remains audible. Repeat quick Continue before the old fade finishes.
6. Trigger TNT coin payout: coin cue plays at half its previous gain; unrelated HUD coin cues retain their gain.
7. In Forest, Beach and Area 55, watch main artwork against first two Units. Open/close a card, then scroll away/back: inverse motion stays continuous.

Simulator and automated evidence are recorded in CURRENT_HANDOFF. Physical speaker mix,
touch, sustained FPS/thermal behavior and subjective motion acceptance remain separate.
