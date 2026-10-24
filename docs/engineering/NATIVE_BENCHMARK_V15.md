# Native benchmark v15 — BLOOB animation

2026-10-24. User requests saving the current Native working tree as the main benchmark. Immutable local tag: `native-benchmark-v15`; branch: `main`.

Includes the accepted BLOOB burst animation, collapse-hidden fake dice and immediate +4 dB bluub1–4 natural-tail voices, plus the saved current-tree Coconut, Bottle, Fishy, trail and Journey fixes. The current Coconut board-size follow-up was saved after the phone build; this source checkpoint therefore is not a claim that every file is already installed on the phone.

Evidence: signed Release `/tmp/bloob-phone-4db-build.log` succeeded; Native release audit and strict signature passed; iPhone13blue install-over and normal launch succeeded; both saves remained byte-identical. No broad QA rerun under the retained user instruction. Physical feel/audio acceptance remains NEEDS PHYSICAL TEST. No push, reinstall or Simulator operation in this checkpoint task.

Original asset deletions are deliberately excluded and remain unstaged. Historical benchmark tags remain unchanged.

## Explicit payload manifest

- `assets/shop/coconut/coconut.svg`
- `docs/audio/AUDIO_RUNTIME_ARCHITECTURE.md`
- `docs/audio/STACK_TO_SIX_INTERACTION_SOUND_INVENTORY.md`
- `docs/audio/audio-runtime-owners.json`
- `docs/engineering/CURRENT_HANDOFF.md`
- `docs/engineering/PROJECT_CONTEXT.md`
- `docs/engineering/feature-runtime-owners.json`
- `docs/engineering/native-special-dice-performance-owners.json`
- `docs/engineering/special-dice-performance-owners.json`
- `native/gameplay-app/NativeBloobAudio.swift`
- `native/gameplay-app/NativeGameplayAudioOwner.swift`
- `native/gameplay-app/NativeSourceAppSpawnBounceOwner.swift`
- `native/gameplay-collection/NativeBackpackCatalog.swift`
- `native/gameplay-tnt-variants/NativeCoconutFinaleMotion.swift`
- `native/gameplay-tnt-variants/NativeTntVariantPresentation.swift`
- `native/gameplay-ui/NativeBloobFinaleMotion.swift`
- `native/gameplay-ui/NativeBloobFinalePresentation.swift`
- `native/gameplay-ui/NativeBoardScene.swift`
- `native/gameplay-ui/NativeBottleFinalePresentation.swift`
- `native/gameplay-ui/NativeCoconutArt.swift`
- `native/gameplay-ui/NativeDiceNode.swift`
- `native/gameplay-ui/NativeDragTrail.swift`
- `native/gameplay-ui/NativeFishSVGFallbackResources.swift`
- `native/jimi-2026/JimiNativeWorldView.swift`
- `native/standalone/Stack to SixTests/JimiNativeWorldTests.swift`
- `native/standalone/Stack to SixTests/NativeBloobTests.swift`
- `native/standalone/Stack to SixTests/NativeBottleFinaleTests.swift`
- `native/standalone/Stack to SixTests/NativeCoconutTests.swift`
- `native/standalone/Stack to SixTests/NativeDragTrailRasterTests.swift`
- `native/standalone/Stack to SixTests/NativeFishSVGFallbackTests.swift`
- `native/standalone/Stack to SixTests/NativeSourceMagnetLazyNormalCallerTests.swift`
- `native/standalone/Stack to SixTests/NativeSourceMagnetNormalFrameLifetimeTests.swift`
- `native/standalone/Stack to SixTests/NativeSourceMagnetPhysicalBindingTests.swift`
- `native/standalone/Stack to SixTests/NativeSourceWildBounceTransportTests.swift`
- `native/standalone/Stack to SixTests/NativeWildMergeSixRootTests.swift`
- `native/gameplay-app/NativeCoconutContactAudio.swift`
- `native/gameplay-ui/NativeCoconutAtlasPlan.swift`
- `scripts/qa/generate-native-coconut-plan.py`
- `docs/engineering/NATIVE_BENCHMARK_V15.md`
