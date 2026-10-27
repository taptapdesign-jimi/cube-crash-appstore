DESIGN SYSTEM — STACK TO SIX NATIVE
Snapshot: 2026-10-26; viewport390x844 logical UIKit points, PNG capture at3x.

Open ../index.html directly (offline), or serve the parent directory on localhost.
The HTML embeds the measured JSON, so file:// also works; it makes no remote requests.
Screenshots, local Baloo2 fonts, and data.json travel with the HTML.

Every reference is a mounted production Native UIKit/SpriteKit component with
controlled example data, not a reconstruction of the interface in HTML and not
a screenshot of the user's saved game. Controller callbacks do not commit saves.
Text font/point size/base UIColor, accessibility identity, view hierarchy,
converted text frame and UIButton base dimensions were read from live objects.
The library's numbered circles are documentation overlays only.

The list captures representative consumer typography families, screens, states,
and CTA contexts. It is not a promise that every transient animation frame,
DEV-only message, image-baked lettering or every localized string is catalogued.
Animated CLEARED uses separately sized glyphs; world-modal stats respond to height.
Primary CTA text is an ivory gradient, so it has multiple stops rather than one HEX.
Native CTA surface #EE8158 is the authored core color; lights/shades remain.

REGENERATE
1. Copy NativeTypographyCaptureTests.swift from this directory into
   native/standalone/Stack to SixTests/ temporarily.
2. Build/test scheme "Stack to Six Native Gameplay QA" on retained Simulator
   1018BE2D-491B-465F-8F75-3E5BEB38C22A, selecting testCaptureTypographyLibrary.
3. Run testCaptureTypographyLibrarySupplement for selected visible coach/HUD samples.
4. Remove ONLY that temporary copy from the test target; keep this dev-only source.
5. Run python3 design-library/typography/capture/build_library.py (requires Pillow).
6. Restore the normal Debug Stack to Six app preview by build/install-over/launch.
   Preserve both current saves; never uninstall or reset the retained app.

Raw3x Native PNGs and captured measurements: /tmp/native-typography-library/.
The portable gallery uses full-resolution quality95 WebP derivatives, with no
change to original game assets or font files. Source-file links in prompts identify
owners; typography is measured from the captured state, not inferred from a source
line. The screenshot/point coordinates refer to this snapshot and are not stable
layout constants across other viewports. The STS IDs identify this library snapshot.

Title audit: title-audit.js / title-audit.css add exact-size and semantic-family filters, actual screenshot crops, location links, and editorial consistency findings. Search shortcuts: titlovi, titlovi 32, 32px (interpreted as Native logical point size). Bonus numbers and TAP TO COLLECT are excluded from headings. No runtime style changes.

DESIGN SYSTEM.md is regenerated with measured typography and CTA inventory by build_library.py. Root DESIGN_SYSTEM.md and PROJECT_CONTEXT.md route future UI tasks here. For navigation-only refresh run testCaptureNavigationTitles; for Arcade heading refresh run testCaptureArcadeTitles.

All dice details: run testCaptureAllDiceDetails to capture22catalog entries (18Journey+4Arcade), waiting for actual artwork readiness. Dedicated sidebar category Backpack · Kockice details. Mixed heading unstyled suffix color is resolved from the explicit Swift palette because UILabel.textColor reports the first attributed accent; data.json records colorResolution.

Dog chat: serve with `python3 design-library/typography/serve.py --port 8766` (not plain http.server) for optional AI endpoints. See ../ASSISTANT.md. UI compares measured roles locally, takes microphone dictation without answer playback, and optionally connects a memory-only API key. Chat CSS/JS links are retained by generator.
