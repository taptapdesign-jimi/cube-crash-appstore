# Opt-in native soundtrack prototype

2026-10-06: the separately authorized `../standalone` app enables this transport
by its exact `.native` bundle identity on device and Simulator, including normal
icon launches. The original app still does not acquire this bridge. The following
flag instructions apply only to the earlier isolated Simulator host. Audible
playback, interruptions and physical thermal behavior remain unaccepted.

Keep the official project and physical phone unchanged. Source implementation:
`JimiNativeMusic.swift`; web factory `native-soundtrack-transport.ts` via the
existing `createSampleAccurateMainThemeVoice` factory. No supplied assets change.

The isolated host GameViewController owns `private var jimiMusic: JimiNativeMusic?`
inside its existing DEBUG/Simulator section. During WKUserContentController setup,
only when `jimiHomeHubEnabled` and launch flag `--jimi-native-music` are true:

```swift
if let root = Bundle.main.resourceURL?.appendingPathComponent("Web.bundle") {
    let music = JimiNativeMusic(root: root)
    jimiMusic = music
    userContentController.addScriptMessageHandler(music, contentWorld: .page, name: "jimiMusic")
}
```

On host teardown remove that named reply handler and transfer the retained music
owner into a main-actor Task that calls `dispose()`. No host reference is captured
by that task. Gate remains tied to QA Simulator1018BE2D-491B-465F-8F75-3E5BEB38C22A.

Native source allowlist: original theme runtime-intro-loop, Arcade calm and Arcade
active files only. One native engine, four voices maximum, two queued segments per
loop. Theme uses original loop start/end; Arcade uses the complete source file.
Native and web cannot own the same selected voice. Startup failure is observable,
not a trigger for concurrent fallback. Music setting stays separate from SFX.

Still required: actual intro seam and repeated-loop audition, Arcade phase and
crossfade, music OFF/ON, background/foreground, interrupts/media reset, failure,
native allocations/CPU A/B and physical thermal comparison. Web decodedBytes=0 is
not evidence of zero native memory. Journey ambient loops and SFX migration are
not implemented by this slice.
