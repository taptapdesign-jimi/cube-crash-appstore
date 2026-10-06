# Jimi 2026 native Home / Hub candidate

**2026-10-06 deployment update:** the user explicitly authorized a separate phone
app. `../standalone` now consumes these Swift sources directly, under bundle ID
`com.taptapdesign.stacktosix.native`. Its native presentation/music do not require
Simulator flags. The Simulator-only restrictions below describe the original
test host, not the separately authorized app. This is still an unaccepted hybrid
candidate; it does not replace the original app or promote a new stable baseline.

This is a real UIKit/Core Animation presentation prototype, not a WebView skin.
It is **not a production migration or a whole-game fluidity fix**. World screens,
gameplay, progression, save/load and existing audio remain owned by the complete
web runtime. Original assets are read from its `Web.bundle`; none are rewritten.

## Ownership

- `JimiHomeHubController`: one visibility/input/finite-motion owner, request IDs,
  cancellation, background handling, error fallback and native/web handoff.
- `JimiV9HomeView`, `JimiV9HubView`: retained original-art layouts; continuous Home
  drag and visible-only Hub idle. No save or gameplay decisions.
- `JimiV9Motion`: original part-specific v9 curves and timings, independently
  checked by `scripts/qa/JimiV9MotionChecks.swift`.
- `native-home-hub-bridge.ts`: validated asynchronous transport, not a router.
- `native-home-hub-runtime.ts`: opt-in adapter to existing canonical web owners.
  It quiesces covered web surfaces, projects actual progress and preserves the
  canonical first-play Journey decision. Settings/Arcade/tutorial keep their
  original Home source/action handshake. World taps instead prepare the selected
  canonical World concurrently with native Hub exit; `activateWorld` completes
  only after its actual enter. No hidden web Hub enter/exit is replayed.
  World return keeps canonical stage retention but suppresses web Hub motion,
  then sends one explicit native Hub enter receipt. Failed transport restores
  only the same canonical Hub, without automatic second native adoption.

## Isolated integration

The current test host is a copy at `/tmp/jimi-native-test-source.Jd5oSW`.
The official `/Users/user/Stack to Six` project is unchanged. The only permitted
prototype destination is Simulator `1018BE2D-491B-465F-8F75-3E5BEB38C22A`.
Do not install this candidate on a phone or erase Simulator data.

Build the **complete** normal web payload with
`SKIP_NATIVE_BUNDLE_SYNC=true npm run build`, not `build:jimi`. Copy that payload
only to the temporary host's `Web.bundle`, and these Swift files to its synchronized
app source folder. Copy `JimiNativeHomeHubUITests.swift` to its UI-test folder.

The temporary `GameViewController` integration is DEBUG + Simulator only:

1. Require both the exact QA UUID and launch argument `--jimi-native-home-hub`.
2. Register `jimiHomeHub` on the WK content controller and inject only
   `window.__jimiNativeHomeHubEnabled = true` at document start.
3. After creating the WKWebView, add `JimiHomeHubController(web:resourceRoot:)`
   as a child above it. Its root remains hidden until an explicit ready receipt.
4. Forward `jimiHomeHub` script-message dictionaries to `receive`.
5. Build into `/tmp/jimi-native-home-hub-build` for that Simulator only.

Run XCUITest with `-parallel-testing-enabled NO`; Xcode's default parallel clone
has a different UUID and the fixture deliberately skips it. A skipped test is not
acceptance. The fixture activates an already-running candidate, never resets
data or starts gameplay. Screenshots/accessibility tests are functional evidence,
not FPS measurements.

## Remaining acceptance boundaries

Actual repeated Simulator routes and visual comparisons are required. Pure Swift
curves and source tests do not certify UIKit cancellation, pixel parity or frame
delivery. Native semantic sound/haptic events now reuse existing web cue owners;
this is not native audio transport or complete v9 audio parity. Web-source
preparation still uses the existing web route, so this slice
does not prove fluid World/game/result transitions or solve the separate no-moves
incident. Physical fluidity/thermal/audio acceptance remains untested and requires
new explicit installation authorization.

## 2026-10-05 post-tutorial verification

The user completed the tutorial normally. No tutorial or progression flags were
edited. The updated Simulator app preserved that state across installation.

- Full source QA: **18 gates / 514 suites / 3,750 tests PASS**; fast QA PASS;
  Gameplay KING: **24 suites / 330 tests PASS**.
- Native build PASS. Complete normal web entry SHA256:
  `19ca3c67c318cec36ce0be84b235471363e38005cb56414aac1b5dad5120df6e`.
  Source dist, temporary bundle and final Simulator app entry hashes match.
- Actual functional XCUITest: **1 test / 0 failures / 192.663s**, including all
  three slides, pan snap/edge behavior, repeated native Home/Hub returns,
  background/foreground, canonical Settings and all three World return paths.
  This was not the earlier skipped-clone or fresh-tutorial run.
- Results: `/tmp/jimi-native-home-hub-post-tutorial.xcresult`; 21 screenshot
  attachments exported alongside it. Home, Hub and Beach captures inspected;
  exact pixel parity is not thereby certified.
- Five-cycle cadence XCUITest: **1 test / 0 failures / 33.606s**. Measurement used
  the explicit `--jimi-native-route-probe` flag, not web performance diagnostics.
  No builds/source QA/video/screenshots ran during the measured test. XCTest's
  own post-tap idle observation still adds overhead.

The sequence-consistent automated cohort is requests **2–11**, five each way;
startup is request 1. The retained console also contains four later interactions
(requests12–15); these are not silently counted as part of the five-loop test.
There are no absolute timestamps in these summaries to independently correlate
the cohort with XCTest wall time.

| Native callback measurement | Home → Hub | Hub → Home |
| --- | ---: | ---: |
| Worst callback interval | 33.336ms | 33.487ms |
| Maximum per-route p95 | 17.326ms | 17.303ms |
| Intervals above25ms / above50ms | 5 / 0 | 10 / 0 |
| First callback latency range | 8.956–32.821ms | 4.196–32.786ms |
| Motion scheduling start range | 0.120–0.268ms | 0.517–1.364ms |
| Native input-ready duration | 1567.828–1584.275ms | 1382.870–1400.069ms |

These are **CADisplayLink callback intervals, not presented-frame FPS**. Six first
callbacks also exceeded25ms; those are separate from interval-tail counts. This
run does not establish superiority over v9 without a matched control. The
functional run's existing web World transitions still showed long JS intervals,
including a276ms sample; it used different diagnostics/AX/screenshot work and is
not a fair A/B performance control.

Raw retained logs: `logs/native-home-hub-20261005/`. QA helper source:
`scripts/qa/JimiNativeRouteProbe.swift`. Copy it into the temporary project and
connect the controller's optional diagnostic callback to a host-retained probe;
the production controller has no dependency on that helper.

Open parity findings: outgoing Home/Hub sound waits for bridge readiness although
visual motion starts immediately; forced-tutorial Journey tab omits the separate
CTA-wrapper sound; geometry-owned Hub Unit-enter audio is not yet ported. No new
sound assets/transports are introduced. Physical audio/haptics remain untested.

Official `qa:ios` correctly reports **NEEDS SYNC** because the official bundle is
intentionally unchanged. This is not authorization to sync/install the phone.
Verdict: source and selected Simulator functionality **PASS**; complete v9 parity
and whole-journey fluidity **not accepted**, physical behavior **NEEDS PHYSICAL TEST**.

## 2026-10-05 direct World handoff verified

The later candidate removes the hidden web Hub enter/exit from native World
taps. Native exit begins immediately; the canonical manager prepares only the
selected World concurrently. Matching readiness releases coverage, and actual
World enter completion—not preparation—settles the native request. A failed
request can restore native coverage only with exact-epoch recovery permission.

World close retains the existing canonical stage swap and outgoing World nodes,
but suppresses web Hub/nav enter. One explicit epoch-validated native Hub enter
follows. Background delivery defers without motion/idle; committed native enters
settle safely on background. Failed native admission restores only the same web
Hub and cannot trigger a second generic adoption. Existing World ambience
transfer is preserved; no audio transport, art, shadows, or gameplay rules changed.

Final full web entry SHA256:
`e91ed25cb76bd7b350f23ba8314077adfa9e01073f150dd50face03e4c2babc7`.
Dist, temporary Web.bundle and built Simulator app match. Full source QA:
**18 gates / 516 suites / 3,837 tests PASS**; Gameplay KING **330 tests PASS**.
The first full run exposed outdated extraction/source-contract fixtures; those
were updated with explicit cancellation and default-web ownership assertions,
not by weakening runtime cleanup. Independent runtime/bridge tests and real
manager-method tests cover stale ownership, cancellation, hidden roots, failed
transport, retained-node identity and fallback.

Actual Simulator receipts:

- Full original-art/slides/Settings/World/background matrix: **2 tests, 0 failures,
  227.134s** on the immediately preceding `5b73c7bc…` artifact (before the final
  two-call canonical World audio transfer restoration). Original Forest, Hub,
  Homepage and real gameplay captures inspected.
- Final-artifact repeated World test: **1 test, 0 failures, 184.276s**. Sequence:
  Forest ×3, Area55 ×3, Beach ×3, then Home. No concurrent heavy QA/build/video or
  screenshot work during this capture; XCTest tap/idle/AX observation remains.
- Final-artifact actual Stage1 interim → game → Exit modal cancel → Exit confirm
  → Forest → native Hub → Home: **1 test, 0 failures, 75.151s**, not skipped. No
  board moves, tutorial/progression edits, reset or developer cheats. Ordinary
  canonical gameplay save/exit behavior was exercised.
- Final-artifact background-return repeat: **1 test, 0 failures, 38.064s**,
  `/tmp/jimi-native-direct-world-final-background.xcresult`. Extended diagnostics
  were disabled again; the Simulator was left on native Home after this test.
- Separate diagnostic repeat of the same gameplay route: **1 test, 0 failures,
  75.406s**. Existing JS diagnostics were verified in the growing console before
  the test. This run is diagnostic evidence, not the quiet cadence condition.

| Selected World preparation, ms | First visit | Repeat 1 | Repeat 2 |
| --- | ---: | ---: | ---: |
| Forest | 305.845 | 96.231 | 14.344 |
| Area55 | 471.021 | 30.415 | 17.884 |
| Beach | 270.265 | 17.347 | 9.422 |

The final cadence file contains exactly21 completed records: startup, Home→Hub,
nine World entries, nine native Hub incoming segments, Hub→Home. Across1,436
callback intervals, six exceeded25ms, none50ms; worst33.362ms. Separate first
callback latency reached34.401ms (nine above25ms). World motion scheduling began
0.388–1.097ms after the native handler; that is not touch-to-photon latency.
World entries settled1417–1488ms, including authored exit and enter motion.
Nine native Hub incoming segments settled836–842ms; worst callback16.831ms.
Those Hub segments **exclude outgoing World motion, stage commit, quiescence and
epoch validation**, so they are not end-to-end return latency. These remain
CADisplayLink callback intervals, not displayed FPS or a matched v9 comparison.

Actual game→Forest diagnostic return prepared its retained destination21ms after
CTA acceptance, during the outgoing board animation. Last outgoing visible pose
to first World Unit start was28ms: cleanup8ms, route handoff at11ms, first Unit at
28ms. Its two named reveal callbacks occurred in the same task; the old audit's
96-image/three-paint-frame explanation does not describe this matching retained
return. A41ms JS interval remained at visible World entry; gameplay entry also
recorded59/72ms intervals under diagnostics. Do not hide these or claim all
WebKit/gameplay motion is now hitch-free.

Evidence: `logs/native-home-hub-20261005/direct-world/`; result bundles are
`/tmp/jimi-native-direct-world-cadence.xcresult`,
`/tmp/jimi-native-journey-game-exit.xcresult`,
`/tmp/jimi-native-game-return-diagnostic.xcresult`, and
`/tmp/jimi-native-direct-world-final-functional.xcresult`.

Verdict: implemented route ownership and selected Simulator flows **PASS**.
Fail/Clean Board terminal visual matrix, the separate original no-moves incident,
complete audio parity and physical sustained fluidity remain unaccepted.
The phone and official native project/Web.bundle remain untouched.
