# Native caption glow comparison — 2026-10-24

Recommendation: keep the current short-lived glow; do not deploy the tested explicit-shadowPath prototype on these results. Physical iPhone GPU/frame pacing remains unmeasured. No production appearance changed.

## Method

Native Debug, retained Jimi iPhone13 Simulator, isolated BLOOMING! caption,390×844pt,3×bitmap snapshots,constant visual RNG. Three rotated orders,120measured CADisplayLink callbacks per mode per repetition,20warmup callbacks. The callback timestamps are pacing proxies,not actual presented-frame or GPU measurements. Paint elapsed wall time includes UIKit writes;it is not total process CPU or GPU time. Software layer.render snapshots are an offline CPU path and must never be interpreted as live game-frame costs. No simultaneous gameplay finale was mounted.

Modes:none=9white labels;current=9faces+36dynamic shadow labels;paths=same45labels and retained CoreText glyph shadowPaths,with0.9text-alpha compensation inside existing disabled-action paint transaction. Native rendering defaults were untouched.

| Mode | Mean paint ms/call | Median trial p95 paint ms | Timestamp p95 ms | Timestamp gaps >25ms | Retained caption views after60 |
|---|---:|---:|---:|---:|---:|
| none | 0.464 | 0.715 | 16.667 | 0 | 0 |
| current | 0.449 | 0.689 | 16.667 | 0 | 0 |
| paths | 1.247 | 1.763 | 16.667 | 0 | 0 |

Mean current/no-glow difference is within trial noise;do not claim current is faster. Paths increased paint-call time about2.8×;software blur cost stayed similar(about4.10s vs4.04s for a full-caption3×snapshot). These seconds are offline CPU Gaussian convolution,not runtime frame time. An app-process sample confirms CoreGraphics/vImage blur in that software path: /tmp/glow-benchmark-live-sample.txt. Explicit paths eliminate unknown alpha-derived shadow shapes structurally,but no actual GPU pass/timing savings were measured.

## Memory and visual boundaries

All180caption UIView weak references released. Resident-memory growth from checkpoint10→60:
- none: 0.156MiB.
- current: 1.031MiB.
- paths: 0.875MiB.

Process resident memory includes UIKit/CoreAnimation/font/cache state and previous modes;absolute resident values are not per-caption allocations. Small monotonic growth did not establish a plateau. This is not a full layer-allocation leak audit or proof that the game has no leaks. Layer/server caches and delayed retirement remain unseparated.

One saved pose pixel comparison:RGBA RMS1.394/255 across the fullviewport;0.639percent of channels differ by>8. A near visual match is not pixel-identical. Other fonts,poses,longer captions and simultaneous finale effects were not compared.

## Evidence

- /tmp/glow-benchmark-verified-sdk.log:PASS1test58.064s,0fail. Raw measurements in adjacent JSON.
- /tmp/glow-benchmark-sdk.log:initial run intentionally interrupted because30software snapshots per trial were disproportionately expensive.
- /tmp/glow-benchmark-final-sdk.log:first bounded runPASS87.765s;prototype applied opacity compensation as a second write and overcounted its live CPU cost. Superseded by verified run using the existing paint transaction.
- The benchmark is test-only in NativeCoconutTests.testOptInGlyphGlowComparison. No production rollout or physical install.

Apple guidance explains why explicit shadow paths can avoid alpha-derived shadow work,not why this prototype is automatically faster: https://developer.apple.com/documentation/quartzcore/calayer/shadowpath and https://developer.apple.com/videos/play/tech-talks/10857/

Next useful validation before a global rollout: paired physical Instruments capture during the same heavy Special finale,including render-server/GPU timing,hitches,peak allocations and post-effect retirement. If that reveals a cost,compare prepared glow masks/textures rather than assuming this path prototype wins.
