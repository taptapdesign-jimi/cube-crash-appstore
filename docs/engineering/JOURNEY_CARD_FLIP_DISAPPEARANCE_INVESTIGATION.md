# Journey open-card flip disappearance investigation

Date: 2026-09-16. Status: two source fixes implemented; web and physical acceptance pending.

## Reported route

User confirmed **iPhone, repeated artwork/stats flips within one open Journey
modal**, without closing it. This is separate from the post-game return reminder
and Journey scrolling incident.

## Proven source-level race

`src/modules/journey-card-overlay-modal.ts` has two overlapping owners:

- `animateInteractiveFlip`: a 200ms rotor flip, then a 260ms recoil. At flip
  completion it commits the target face and clears `flipping`; the recoil still
  owns the visible rotor transform and `flipEdgeRaf`.
- `finishPointer`: a 180ms impact-shell reset on pointer release. If a committed
  flip is still active, it captures the intermediate angle as `previewToAngle`.
  Its completion checks only the identity of the impact animation, then cancels
  the shared `flipEdgeRaf` and, when `!flipping`, writes that captured angle back
  through `setRotorAngle`.

When the automatic flip finishes before the impact reset, that reset's callback
mistakes `!flipping` for permission to control the rotor. It overwrites the newer
completed pose and paint-face selection while the recoil is still showing the
new face. It also cancels the recoil's corrective paint watcher.

The CSS at `src/collectibles-screen.css:241` hides the face opposite
`data-paint-face`. Its temporary override applies only during `.is-flipping`,
`.is-dragging` or `.is-face-settling`; none remains in this sequence. Consequently,
the physically forward face can be manually hidden while the opposite face is
backface-culled. At recoil completion, `setRotorAngle(stableRotorAngle())` repairs
the state, explaining the apparent disappearance and spontaneous return.

## Controlled reproduction

The temporary Node/TypeScript harness at
`/tmp/journey-card-race-full-repro.cjs` extracts and executes the actual
`animateInteractiveFlip`, `finishPointer`, rotor setters and paint setter from
current source. Only the DOM/WAAPI/RAF clock and ancillary services are simulated;
this is **not a browser screenshot or physical WebKit reproduction**.
Results: `/tmp/journey-card-race-results.jsonl`.

Example timeline, artwork target:

| Time relative to auto-flip start | State |
| --- | --- |
| 0ms | Start at -108 degrees, moving toward artwork at 0 degrees. |
| 25ms | Release at -94.5 degrees; start the independent 180ms impact reset. |
| 200ms | Flip commits artwork/front and starts its 260ms recoil. |
| 205ms | Impact completion restores -94.5 degrees, selects paint-face back and cancels the recoil RAF. Stable face remains front. |
| 460ms | Recoil completion restores 0 degrees and paint-face front. |

The corresponding stats-target case restores 85.5 degrees and paint-face front
while stable face is back. Release times 21/25/30ms reproduce the mismatch in
both directions; 40/100/190ms controls still overwrite the angle/cancel the RAF
but do not choose the opposite paint face. All cases recover at recoil completion.
The 255ms blank interval is a prediction from these modeled timings, not a
measurement on the user's phone.

No texture reload, image-source change, DOM replacement or modal recreation is
needed for this failure. The same conflicting completion pattern and CSS culling
already exist in immutable `production-benchmark-v3`; the Juice randomization did
not introduce it.

## Initial diagnosis validation and limits

Existing Journey modal tests pass **35/35**, but their relevant coverage inspects
source strings rather than executing this overlapping completion sequence.
The new controlled sequence demonstrates a real ownership failure: **FAIL**.

Computer-use reported no available browser. CoreDevice listed the exact iPhone 13
blue as available, but console launch failed with device error 1011. A subsequent
read-only details query reported interrupted tunnel connectivity,
`ddiServicesAvailable: false` and `tunnelState: connecting`. No confirmed app
launch, KRENI session, device trace, build, sync or installation occurred.
Attribution of the user's exact physical incident remains **NEEDS PHYSICAL TEST**.

## Initial repair boundary

Impact-shell completion must not write a rotor pose or cancel a RAF owned by the
committed flip/recoil. Keep rotor/paint cleanup tied to the exact preview animation
and generation that created it; retire only that owner's frame callback. Add an
executed regression covering release before/after the physical edge, both flip
directions, recoil and immediate next-pointer interruption. Preserve artwork,
geometry, motion timings, sounds and modal/CTA routing. Validate on localhost
before an approved iPhone delivery and repeat the physical sequence.

## Completed physical capture and scoped source repair

Capture successfully launched the existing bundled Stack to Six on the exact
`iPhone 13 blue` at **15:17:03 CEST**. KRENI followed at approximately 15:17:08;
GOTOVO was processed at **15:18:55 CEST**. Marker receipt times:

- 15:18:03 observed / 15:18:08 persisted: `problem vidi se trzanje micni preskakanje nekako`
- 15:18:25: `problem nije fluidan drag flip dosta je jerky`
- 15:18:47: `problem eovo nestalo je i odma hse pojavilo`

The full buffered stream was read before the console process was stopped.
Stopping it also ended the app process with signal 2, after GOTOVO.
It contains the confirmed bundled launch and initial WebView navigation, with
no later navigation/reload message. It contains **no pointer/runtime telemetry**,
so it does not independently correlate the code race with the physical event
or establish FPS. Inspection of the native source explains the missing bridge:
`consoleLog` is registered only with the existing performance-diagnostics opt-in.
A future authorized capture should launch with `--cc-performance-diagnostics`;
no native source change is required. The source diagnostic prefix is
`[CC_JOURNEY_CARD_POINTER]`.

After GOTOVO, the user additionally reported:
`dosta je klimavo onako okrecem pa me vrati brze kao da puca nije fluidno jako je jerky lose okretanje sada`.
This was still the unchanged installed build, not a post-fix regression.

The source repair now confines impact completion to its own transform. Only an
exact matching rotor-preview animation may retire its paint RAF and commit its
rotor angle; a flip/recoil retains those owners. Release cleanup also preserves
the active recoil shine.

A second executed regression identified a separate discontinuity: a fresh tap
interrupting a flip captured **-54deg**, but its release began the next flip at
**-180deg** and used the static tap direction. The release now passes the captured
angle and chooses the nearest target while interrupted; fully settled taps keep
their authored direction.

`journey-card-flip-ownership.test.ts` mounts the actual modal, dispatches real DOM
pointer events and controls only browser animation clocks. Before repair, six
release-order cases failed and the interrupted-tap test failed separately. It
covers both faces, early/late release, partial scrub, cancellation and a new
pointer overtaking old completion. Browser/compositor paint remains outside
jsdom coverage. `qa:fast` passes 8 gates / 13 suites / 130 tests. Final `qa:full` passes all 13 gates / 309 suites / 2002 tests, including Gameplay KING (24 suites / 305 tests), full lint/types and a source-only production build. Local `dist` was refreshed.

Local Vite is running at `http://localhost:5174`; direct HTTP inspection verifies
both new ownership branches. No computer-use browser was available for visual
verification in this session. User web approval is required before the physical
fix installation per LIVE_DEBUG_WORKFLOW.md. No native sync, build or install
has occurred; assets, flip durations, sound and gameplay routing remain unchanged.
