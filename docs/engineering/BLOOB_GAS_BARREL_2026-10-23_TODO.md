# Bloob Gas / Barrel replacement — 2026-10-23

User contract: replace Bloob merge-six gameplay and finale with whole-board Barrel/TNT behavior; use supplied gas1…12 instead of TNT smoke; same Barrel smoke/wood/dice timing; gas-only image scale0.7, captured random signed10–20degree progressive rotation and smooth opposing-axis squeeze/stretch up20percent; original Bloob white/cyan glowing caption reads GASSS!; inherited Barrel audio layer gain0.5 plus retained Bloob sounds. Existing Barrel unchanged. Old source assets and recorded Shards Float Hovering recipe remain preserved; old finale is removed from active runtime.

## Owner map

- Identity/save: NativeSpecialDiceRegistry canonical bloob-ball TNT; accept historical star-tagged Bloob saves without rewriting identity or progress. Journey/Arcade selection remains in existing owners.
- Gameplay/input/endgame/score/coins: existing Barrel whole-board target selection and shared TNT transaction, both merge directions and no-target/final routes. No extra two Star bonus dice or six bespoke coin receipts.
- Visual entry/return/exit: NativeBoardScene authored TNT/Barrel graph; NativeTntVariantPresentation gas skin shares existing finite clock and .51s frame6/.91s smoke boundary, cleanup and background suspension.
- Resources: selected UIKit artwork owner + selected meter warmup; 12 supplied gas frames/density variants and inherited wood/die assets. No idle preloading of obsolete floating/finale SVGs. Original board/Backpack idle remains.
- Audio: NativeBloobBallAudio through NativeGameplayAudioOwner existing bounded transport/Settings/generation/route cancellation. Borrow Barrel layers at half gain using unique Bloob voices; overlay original merge/rise/burst cues on corresponding gas clock moments.
- Haptics: canonical TNT/Barrel existing committed feedback only.
- Old floating finale/motion and bespoke coin plumbing: remove active code and tests, preserve immutable recipe and original artwork/audio bytes.

## Acceptance

- PASS: canonical TNT and historical-save roundtrip; all ordinary targets once, Wild/locked protection, Journey/Arcade, both directions, final/no-target/background/stale callbacks.
- PASS: actual gas frames/GASSS! style, Barrel timing/debris parity, once-only receipts, pause/resume/dispose/weak release and bounded selected resources.
- PASS: borrowed Barrel layer50percent plus retained Bloob cues, unique voices, Settings/background/generation stop and preload coverage.
- PASS: core/Native tests, KING, audio/special/feature gates, fast/full QA, native identity/assets.
- PASS: complete-tree normal Debug preview on retained Jimi1018, install-over/no reset, normal launch, audio SilentModeOff verified.
- NEEDS PHYSICAL TEST: speaker mix/visual feel/FPS/thermal; phone installation separate.

Coverage clarification: isolated NativeBoardTests controller fixtures intentionally lack the complete app Source bootstrap and show the static coin-hud.png fallback. They validate impacts/return, not HUD animation appearance. Complete NativeWildMergeSixRootTests use the actual app bootstrap; NativeSourceHUDStarMountedTests separately assert SVG-derived frame identity, advancing textures, pause/resume and genuine receipt arrival. No memory-saving coin substitution was introduced.
