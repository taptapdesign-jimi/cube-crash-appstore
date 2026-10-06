# Jimi native motion feasibility probe

## Verdict

**Bounded Simulator experiment completed. Native is a promising candidate, not a proven full-game fix. NEEDS PHYSICAL TEST.**

The layout-matched experiment has 48 complete trials: 8 per backend with three
rectangles and 8 per backend with the same original Forest, Area 55 and Beach PNG
bytes. No game, audio, saves, progression or production route was changed.

## Matched results

The SAME app-process CADisplayLink arrival-gap sampler runs in every arm. Values
below are callback intervals, **not presented GPU frame intervals or FPS**.

| Condition | Backend | Worst interval | P95 interval | Intervals >25 ms |
| --- | --- | ---: | ---: | ---: |
| Rectangles | Native Core Animation | 18.53 ms | 18.25 ms | 0 |
| Rectangles | WebView WAAPI | 33.36 ms | 16.77 ms | 8 |
| Rectangles | WebView JS RAF | 33.47 ms | 16.77 ms | 8 |
| Original images | Native Core Animation | 18.37 ms | 18.10 ms | 0 |
| Original images | WebView WAAPI | 33.41 ms | 16.77 ms | 8 |
| Original images | WebView JS RAF | 33.49 ms | 16.76 ms | 7 |

Native has better worst-case callback cadence here, **not better every metric**:
its P95 is slightly higher. Do not describe this as “twice the FPS.” Separate
WebContent RAF metrics remain in the raw receipts; they are not directly compared
against native CADisplayLink to declare a winner.

Independent raw-log review locates **every shared-sampler interval above25ms in
the first few callbacks (sample indices1–4)** in both final captures; none appears
later in a trial. The observed advantage is therefore concentrated at animation
start/handoff, not sustained motion. Bridge initiation and display-link startup
remain possible contributors. Both backends have substantially regular later
callback cadence in this bounded test.

## Method and limits

- Isolated iPhone 13 Simulator `1018BE2D-491B-465F-8F75-3E5BEB38C22A`, iOS 26.5.
- Same temporary Stack to Six shell, UIKit root instead of the unused SKView.
- Finite 1.65-second scale cascade: 560 ms back.out(1.8), short hold, 180 ms
  power2.in inflation, 336 ms back.in(1.7) collapse; 90 ms inter-Unit offset.
  This is a diagnostic path, not the complete canonical Journey choreography.
- Native CA keyframes and WAAPI keyframes share 331 numeric samples; RAF evaluates
  the same scalar formula. Same 220×120 pt/pixel containers, centred aspect-fit PNGs.
- Order rotates native/WAAPI/RAF/RAF/WAAPI/native, repeated four times. No CUA/AX
  queries, screenshots, video capture, builds or source tests during final runs.
- WebView uses nonpersistent data and no automatic content inset. No game runtime
  boots. No audio/haptics/network/save writes. PNG decoding precedes readiness.
- 800 ms surface reset/reveal settling is OUTSIDE measurement. This measures warm
  motion, NOT cold decode, tap latency, screen-reveal latency or game return.
- Native begins directly; web receives one evaluateJavaScript start command.
  That bridge and process scheduling remain part of this harness, unlike a real
  DOM-local tap. Their cost is not isolated, so results cannot prove a WebKit bug.
- CADisplayLink is a main-process callback observation, not visibility of the
  WebContent compositor or a dropped-presented-frame detector. Its lifetime is
  restarted for every trial. The sampler includes a crossing interval when it
  arrives before completion. One web-RAF artwork trial ended at1649.37ms in the
  shared samples, approximately0.63ms before the nominal boundary because the web
  completion arrived first. This limitation does not hide its early32.48ms gap.
- The final web callback is received via IPC; native uses a completion timer.
  These different completion paths and the Simulator/host environment limit
  causal interpretation. This is a feasibility signal, not migration acceptance.
- Startup and completion timeouts, background/disappearance abort, one cancellable
  timer, finite animations and invalidation prevent a missing completion being PASS.

## Evidence and rejected measurements

- `logs/native-motion-probe-20261005/matched-shapes.log`
- `logs/native-motion-probe-20261005/matched-artwork.log`
- Reproduce summaries with `node scripts/qa/summarize-native-motion-probe.mjs <log>`.
- Earlier `shapes.log` and `artwork.log` are preliminary: WebView automatic safe-area
  inset had not yet been disabled. They support direction only, not matched layout.
- First developmental run also excluded its final native crossing interval and
  overlapped compilation. It is excluded entirely from reported results.
- Separate video `/tmp/jimi-native-probe-visual.mov` confirms original artwork is
  visible in all three backends. It predates the inset correction and is NOT a
  timing sample. Offline frames inspected at 11, 15.5, 18.5 and 21.5 seconds.
  Its variable cadence, nominal 24.14 fps and two invalid PTS samples do not support
  a 60 fps continuity verdict. No visual smoothness PASS is inferred from thumbnails.
- Review by measurement agent found the crossing-interval bias, fixed before final
  runs, and warned against interpreting callback cadence as presentation cadence.

## Scope, ownership and validation

`scripts/qa/JimiNativeMotionProbe.swift` is a QA-only fixture, not imported by the
web product or added to the official native project. One controller owns prepare,
run, sampling, completion and cleanup. It requires DEBUG, Simulator, the exact
isolated UUID and `--jimi-native-motion-probe`; `--jimi-probe-artwork` selects PNGs.
Copy it only into the temporary native project's synchronized source folder. The
temporary GameViewController intercepts viewDidLoad before game/audio initialization,
replaces the SpriteKit root, and mounts this child controller. Normal launch does
not invoke it. No feature/audio production owner was added.

- Native temporary Debug build: PASS.
- `qa:ios`: PASS before native work; official bundle remains unchanged.
- Summary parser: 3 Node tests PASS (including missing/aborted/mixed/empty capture rejection).
- Final full source QA: PASS 18 gates /510 suites /3688 tests;
  `/tmp/jimi-native-probe-final-full-qa.log`, after the final fixture inset correction.
- No physical install, original incident-Simulator action, asset change, audio
  migration, gameplay change, commit or push.

## Restoration and next decision

Normal Jimi app restored from `/tmp/jimi-xcuitest-20261005/Build/Products/Debug-iphonesimulator/Stack to Six.app`.
Its Web.bundle index SHA256 is
`a6984584bc3bc1450f909887c930b88f28485efd8dec61e19d2faedbb29509e8`.
Restored Home telemetry: `/tmp/jimi-native-probe-final-restoration.log`.
CUA screenshot also inspected: original logo, hero, Journey CTA and bottom tabs present.

Recommended next proof, NOT implemented by this test: a native Home→Hub→one World
presentation including actual reveal, retained-view return and user input; then
connection to existing gameplay through its canonical entry/exit/save owners.
Do not expand into whole-game or audio migration based on this microbenchmark.
The original fluidity and no-moves bugs remain unresolved.
