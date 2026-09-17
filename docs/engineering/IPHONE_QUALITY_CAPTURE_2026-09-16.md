# iPhone quality capture — 2026-09-16

## Verdict

**FAIL — premium interaction/visual acceptance.** Three user-observed problems failed the captured build. Automated QA PASS did not establish physical quality. The capture itself made no runtime or asset edits. Source repairs were subsequently authorized and are documented below; the installed phone still contains the captured build.

## Delivery identity

User explicitly requested immediate installation and five minutes of intensive play, overriding the usual web-first approval order for this delivery. Bundled Stack to Six on iPhone 13 blue only; installed over existing data. `useDevServer=false`. Source QA from the just-completed unchanged runtime: all 13 gates, 318 suites /2113 tests. `qa:ios` PASS, Xcode BUILD SUCCEEDED, final codesign verification PASS. Exact final bundle: `com.taptapdesign.stacktosix.Stack-to-Six`, native 1.0 build3, source d2bd53ac plus authorized dirty worktree. All 1766 runtime assets present; Xcode-excluded .DS_Store metadata is not a runtime asset.

`dist` → official Web.bundle → signed app index SHA-256: `136fabbc0020aac852d4d09ee5efe764b08d8363fe2622dd56d09e8e4f324761`. Apple returned **App installed**, installation container `4F754D46-8379-4D9C-B98B-ADCC6FDDECF1`. Exact bundle launch confirmed 20:29:26 CEST, `app://localhost/index.html`, diagnostic argument `--cc-performance-diagnostics` verified by native thermal and web CC_SOAK output.

## Capture and incident markers

Host timestamps are Europe/Zagreb (CEST, UTC+02). Incident times are the host time when the assistant recorded each received message, not an exact touch/frame timestamp.

| Time | Marker / exact user wording |
|---|---|
|20:29:36.221|KRENI|
|20:30:39.449|problem flipanje nije fluidno ne prati prst preskace|
|20:31:33.199|problem kada pada kokica na board special ili wild iz ruksaka cloud iza njih nije fluidan vec nekako zabljesne pa izgleda cudno|
|20:32:22.732|problem -  svaka special kockica koja dode na board zabljesne jedan frame kao da se resetira|
|20:34:51.446|gotovo|

KRENI–GOTOVO duration **315.23s**. Buffered output was read before stopping capture. Closing devicectl forwarded SIGINT; the test app terminated due to signal2 at **20:35:06**, intentionally after GOTOVO, not an in-test crash.

Durable local raw evidence (gitignored): `logs/apple-style-20260916/console.log`, `markers.jsonl`, `identity.json`, `install.log`, `events.json`, `analysis.json`. Original capture and analysis utilities are in `/tmp/stack-to-six-apple-style-20260916/`.

## Measured behavior

- 63 SOAK samples in requested interval. Excluding the first frame window that straddles KRENI: 62 windows, **18,339 frames**, weighted mean **16.768ms**, worst **178ms**, **65 frames >34ms**, zero measured >250ms. Diagnostic resource traversal and background gaps are excluded by the existing sampler; this is not compositor/GPU video capture.
- Worst 178ms occurred in the window ending20:29:52 while Journey was entering (50children/21images). Other peaks91ms,85ms,83ms,81ms. These are visible-hitch risks despite the good mean.
- 93 merge summaries:56 regular merge6,26 regular stack,11 wild merge. Worst merge window **91ms** during Fish HEVC finale (20:33:31 summary,186samples,17.18msmean). This correlates with the finale; it does not prove decoding caused that frame.
- All **66 thermal samples inside KRENI–GOTOVO were nominal**, lowPowerMode=false, battery100%. Crucially, buffered post-GOTOVO telemetry changed to **fair at20:35:03.283**, ~12s later. This is early accumulated thermal pressure, not proof of serious throttling or screen dimming. Brightness and touch/auditory feel require user evidence.
- No logged JavaScript errors/warnings, memory warning, in-test WebView reload or crash. Only initial navigation; final signal2 was capture shutdown. Absence in logs is not proof every class of error was instrumented.
- GSAP children peaked539/175roots and ended1/1. Shared sheets peaked30,174,000bytes and ended0bytes/0refs. Runtime textures ended0; tracked timeouts/RAF/intervals/listeners ended0. Hidden Journey during gameplay normally returned to11children/2images. This argues against persistent retention in those owners; total process/GPU memory was not measured.
- Gameplay audio sampled maximum63.831MiB under64MiB soft budget, ended59.638MiB entirely idle. Main soundtrack retained21.860MiB; combined sampled decoded peak85.691MiB. Evictions0→62, stable after20:32:52; pressure is proven, repeated decode churn is not (asset-specific decode history absent). No sampled failed/pending loads or queued starts.
- Main soundtrack reported one nonpaused voice until final zero. Counts do not expose source gains or audibility and cannot prove correct mute/crossfade/no overlap. No audio recording was captured. User audio/heat feedback remains pending.

## Findings and causal confidence

### 1. Flip — demonstrated state-machine defect

222 pointer records,33 complete owned gestures, no rejected/cancel/lost-pointer events.14 automatic flip commits happened with finger still down;10 were interrupted by the same finger16–17ms later;8 returned to the original face. Example console lines122–125 at20:30:12.013–12.391:177.67px swipe commits at72degrees, next move cancels/rebases, release sees only14.33px at77.69degrees, next gesture starts front0degrees. The first user marker is retrospective; the pointer cluster ends20:30:26, so no exact marker-to-single-gesture claim.

Source `journey-card-overlay-modal.ts`: `interruptCommittedFlipForPointerMove` (~1993) permits takeover after >1px, cancels automatic motion, resets dragStartX/Y and clears committed state. Live threshold branch (~2110) starts automatic flip under the held finger. Release (~2223) uses the rebased residual and snaps back (~2257). The accumulated movement and chosen face are lost across these competing owners. Fix should keep one continuous finger-owned pose and commit/snap from consistent gesture state, with a regression replay of the observed sequence.

### 2. Special arrival flash — proven unsynchronized handoff, visual cause strongly supported but not frame-captured

`app-core-open-cell.ts` defers idle artwork. Flight uses a static DOM foreground image. `wild-spawn-drop.ts` releases that image and exposes the Pixi base before `app-core.ts` enables the animated idle owner. Shared-sheet idle starts at elapsedMs=0, potentially after async readiness/phase delay.

Pixi render runs at LOW priority; DOM overlay sync runs LOW-1. `wild-spawn-carrier-foreground.ts` suppresses the canvas base while DOM owns presentation, then removes DOM immediately and sets base.renderable=true without waiting for the next canvas render. This creates a real uncoordinated frame boundary, potentially blank/doubled/static-to-animated. The trace contains no exact rendered-owner frame identity, so the reported one-frame flash is not directly photographed. Fix direction: continuous presentation ownership until the replacement has painted, retaining idle phase where appropriate.

### 3. Backpack cloud flash — source timing established, precise visual cause unproven

Landing calls generic additive white smoke (`app-core.ts` around7267; `fx.ts` around5048/5099/5218):18–40ms fade-in,160–280ms motion,80–140ms fade-out, five35ms-spaced bursts. Visible sequence about0.28–0.67s; cleanupTTL1.15s does not extend visible motion. This is a short bright puff consistent with the report. Nearby five-second averages were~16.6ms with worst39ms/31ms around the two arrival markers, which does not establish a large frame stall as the cause. Inspect/measure opacity and presentation handoff before changing authored smoke timing.

## Authorized source repairs after capture

- **Flip:** the held pointer owns the rotor continuously. Removed automatic commit under the finger and its cancel/rebase path. The same angular gain now continues beyond the former 72-degree plateau, up to one turn. Release consumes the final pointer position and completes from the current pose using the existing release-intent threshold. Backtracking keeps the original gesture baseline. Actual pointer-handler regressions cover continuous travel, reversal, back face, final pointer sample, cancellation, foreign pointers, taps and vertical dismissal.
- **Arrival:** restore the identical canvas fallback before starting idle, retain the flight DOM image until a paired on-screen renderer prerender/postrender completes, and only then retire it. Offscreen or already-underway renders cannot retire it. Cleanup detaches observers and images on cancellation or renderer destruction; late image synchronization cannot suppress the new presentation. Idle starts once after the dropping flag clears. No forced render, GPU readback, arbitrary delay or longer input lock was added. This closes the demonstrated presentation gap; it does not establish identical authored poses across all static and animated artwork.
- **Cloud:** Wild/Special landing gets a scoped normal-blend profile, softened opacity and 120ms sine entrance with a longer existing motion profile. Geometry and particle density remain; one grouped timeline owns the effect. Other smoke profiles retain their prior entrance and blending. A regression runs the real smoke function and GSAP timeline: the initial version failed the first-frame alpha check (0.336 against a <0.15 limit); the repair passes that check and verifies complete pooled-particle release before the existing 1.15s expiry.

Independent read-only reviews found no concrete new issue in flip, arrival lifecycle or cloud. Four Journey suites pass 55 tests, including the mounted modal with controlled WAAPI clocks: both directions at seven interruption timings, old preview completion, mid-turn tap takeover, and zero manual sounds while held/exactly one on release. `qa:fast` passes all 8 gates (110 suites /953 tests); final `qa:full` passes all 13 gates (320 suites /2127 tests), including Gameplay KING 24 suites /306 tests, TypeScript, lint, static contracts, a 1042-module production build, bundle audit and native source guard. The initial fast pass exposed two legacy tests expecting held-pointer auto-commit; those tests were updated to the release-owned contract while retaining mounted animation/recoil coverage. Local `dist` is refreshed. HTTP checks confirm Vite serves the new drag and handoff source. Browser inventory exposed no enabled browser; selecting native Chrome then stalled ~819s without a game inspection. No visual web pass is claimed. Assets remain unchanged. No Web.bundle sync, native build or installation was performed for these repairs.

## Remaining acceptance

Show repairs on localhost:5174 and obtain web approval before another phone install, unless the user explicitly reorders that workflow again. Repeat the same physical capture for finger tracking, Special arrival, cloud, thermal behavior and audible transition quality. The first Journey 178ms window had zero audio evictions; the first/second Fish windows do not establish an eviction-caused stall. No speculative cache/timing change was added on that evidence. Neither deterministic QA nor the mean frame rate constitutes Apple-level acceptance.


## Subsequent native delivery

At the user's explicit “prebaci na mobitel sada”, the source repairs above were delivered on 2026-09-16 at 21:07 CEST. `qa:ios`, Xcode and final signed-app audits passed. Dist/Web.bundle/final-app entrypoints match SHA-256 `f153d45717fc6b6c678b6f7d37a79496c8e2f455cdfd95d74ac6d97363213a81`; 1766 raw assets verified. iPhone 13 blue install-over returned **App installed**, container `CDE8D58C-3E8D-4A23-AF3A-882AEF95DB18`; exact Stack to Six bundle launched at 21:07:01 CEST. Normal bundled mode, no diagnostic capture started. This supersedes the installed-package state above, not the original capture findings. Physical acceptance still needs a new test. Delivery logs: `logs/physical-polish-delivery-20260916/`.


## Post-repair physical repeat, 21:43–21:45 CEST

User first confirmed the repaired build looked good, then requested live observation. Existing installed build was relaunched with diagnostics (no source/build/install changes). KRENI **21:43:27.519**, GOTOVO **21:45:43.350**, duration **135.831s**. One reported incident, host arrival **21:44:26.408**: “problem kada dolazi barrell na stage prvo je ultra malena i onda se poveca?!” This is a retrospective user marker, not an exact rendered-frame timestamp.

- 26 complete five-second windows, **7708 measured frames**, weighted mean **16.821ms**, worst **114ms**, **38 >34ms**, zero >250ms. Worst window ended21:43:35.939 during visible Journey entry. Later isolated windows peaked66/65/64/61/60ms. These are not a zero-hitch result.
- All **27 in-range thermal samples nominal**. A 136s repeat is shorter than the original315s session and does not establish sustained thermal/brightness improvement.
- **12 owned and completed pointer gestures**, including10 horizontal and2 vertical; no logged reject/cancel/lost-pointer events. All finish records show `flipping=false` while pointer still owns the pose. Horizontal poses reach beyond the previous72-degree plateau; no held auto-commit/rebase events. This agrees with user acceptance of the repaired flip, while visual appearance is user-observed, not video captured.
- **56 merge summaries**:35 regular merge6,14 regular stack,7 wild. Two Barrel merges report60ms and25ms worst frames respectively; these are merge windows, not proof of the arrival sizing cause.
- Last in-range sample: GSAP0children/0roots; tracked cleanup timeouts/RAF/interval/listener counts0; runtime textures0; shared sheets0bytes/0refs. Audio remains active in Journey, which is not evidence of an audio leak. No logged in-range JS warning/error, reload, memory warning or crash.
- Buffered output read before terminating devicectl. App ended from **signal2 at21:45:57**, intentionally afterGOTOVO. This was not an in-test crash.

Raw evidence and parsed results: `logs/physical-polish-repeat-20260916-214302/` (`console.log`, `markers.jsonl`, `events.json`, `analysis.json`). Initial repair acceptance is supported; overall polish remains **FAIL** because the user observed Barrel sizing discontinuity. Barrel source diagnosis follows separately. No runtime edits during this observation task.


### Barrel sizing investigation (read-only)

Independent source/asset geometry check found no large static-to-idle mismatch. Static PNG is270×351 with visible alpha bbox(44,124)–(226,318), i.e.182×194; sheet frame0 has the identical bbox. Registry static display160.2×207.9 gives visible107.99×114.91; Barrel sheet display115.2/194 gives108.07×115.20 (<0.3% difference). Across all54frames, artwork widths180–226 and heights170–249: no ultra-small firstframe.

`wild-spawn-drop.ts` initializes scale0.18 while hidden, then visible emergence begins at0.5 with alpha0 and grows over360ms to~0.86, settling0.8. Landing uses0.76→1.18→0.9→1.06→1. This authored emergence can explain a small-to-large effect while leaving the carrier. It does not prove the user's exact moment, nor explain an ultra-small reset after contact. Need distinguish carrier emergence from after-contact handoff; if the latter, capture targeted per-frame base/idle/foreground dimensions and parent world scales before changing behavior. No speculative runtime patch or asset modification.


### Barrel follow-up: whole-flight size race reproduced and repaired

User clarified that Barrel stays tiny all the way from backpack to board and enlarges only when seated. That excludes the initial reveal alone as an adequate explanation. Further review reproduced the actual foreground module with cold Pixi decoding: the DOM Barrel image can become ready while `base.texture` is still the119×119 TNT fallback. `createSpawnForeground` cached that texture's dimensions only when its image URL changed. `applyWildSkinLocalCore` then asynchronously loads270×351 Barrel and adjusts the base scale, but the same-source DOM image kept119×119 geometry for the entire flight. It therefore displayed visible art47.59×38.96 instead107.99×114.91; retiring the mirror exposed the correctly sized idle. The race is executable and source-proven; the physical log did not record per-frame texture geometry.

The foreground now refreshes dimensions with the current texture while the same source is displayed, so geometry, anchor offsets and world transform stay consistent. While a different carrier frame is still loading, the previous ready frame retains its stored dimensions. The existing flight clock, authored scale curve, landing animation and assets were preserved. Regression failed before repair (full display width70.6067 instead160.2) and passes after; it also checks height, noncentral anchor and image identity. Independent read-only review PASS, seven foreground tests PASS. `qa:fast` PASS8gates /110suites /954tests; final `qa:full` PASS13gates /320suites /2128tests, including KING24suites /306tests, TypeScript, lint,1042-module production build with native sync disabled and package/source identity audits. Local `dist` refreshed. Localhost serves the current same-source synchronization. No new native delivery in this change; installed phone still has the Barrel race until a later approved install.
