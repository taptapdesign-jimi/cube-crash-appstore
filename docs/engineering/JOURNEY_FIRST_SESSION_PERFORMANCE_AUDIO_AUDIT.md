# Journey first-session performance and audio audit

Date: 2026-09-16. Scope: source ownership, cold failures, repeated Journey audio transitions, retained resources and diagnostic coverage. No fresh install, save reset, seven-board playthrough or physical thermal measurement was performed. No runtime, assets, native bundle or installed app was changed by this audit. Existing Juice and Journey card fixes remain separate pending web acceptance.

## Original audit verdict (before repairs below)

**FAIL — cold audio recovery:** a reproduced initial main-theme load failure remains permanent for that transport instance.

**PASS — scoped deterministic checks:** 11 suites / 63 tests pass for soundtrack, transport, integration, decoded audio, Forest ambience/gameplay, mobile cadence, World scheduling, shared sheets, Barrel and repeated boot ownership.

**NEEDS PHYSICAL TEST — release-quality first-session experience:** sustained frame pacing, speaker transitions, thermal state, brightness and process memory are not established by these checks. No claim that the findings below caused the user's phone symptoms.

## Findings and proposed priority

### 1. Confirmed: failed initial theme load cannot recover on later play attempts

`src/modules/main-theme-web-audio-transport.ts:45,63,98` stores one readonly load promise and awaits it on every play. A controlled execution of the actual transpiled module with a first-fetch failure and subsequent available response produced three rejected play attempts but only one fetch. Ordinary retry gestures and Music toggles do not replace this transport.

Proposed repair: retryable load ownership with a bounded policy and generation/disposal guards; exercise failed fetch/decode followed by successful play and interrupted retry. This is a recovery defect, not evidence that bundled loading commonly fails.

### 2. Confirmed retention / potential pressure: decoded audio has no production byte budget

`src/modules/gameplay-audio-buffer-player.ts` retains successful decoded buffers in its module Map, without production eviction; failures also remain cached. Voice cleanup disconnects playback correctly, but does not release cached buffers. Current diagnostics count buffers without estimating retained bytes. This is a finite high-water cache, not proof of a per-level leak.

From runtime WAV frame counts at Float32 decoded sample size: main theme ~21.86 MiB, Forest World nature ~10.99 MiB, Forest World bees ~10.39 MiB, actual Forest gameplay ambience ~29.60 MiB: approximately **72.84 MiB** after those resources have been visited. They need not all be audible simultaneously. This excludes other effects, graphics, browser overhead and decoder transients; it is not measured process RSS.

Proposed repair: add byte accounting and an inactive-buffer budget, protect active loops and pending users, and permit bounded recovery of failed loads. Preserve every source asset and authored mix.

### 3. Confirmed unnecessary warmups / retained graphics outside shared budget

`src/modules/app-core.ts:6051-6080` schedules Juice art/audio and Barrel art/audio after board entry at +1200/+2000/+3000/+4200ms. Guards cover board generation, but not mode, stage or reward eligibility. Forest first exposes Barrel at Stage 07; generic Juice is not in the Forest progression pool.

`src/modules/barrel-bouncy-artwork.ts` caches its 2430x2106 sheet and pins its Pixi source through `pinPixiImageTexture`. Its RGBA backing is about **19.52 MiB**, without production eviction or inclusion in the general shared-sheet 48 MiB idle budget. Its controllers and ticker do clean up; the finding is fixed retained residency and early work, not accumulating Barrel copies.

Proposed repair: eligibility-aware warmups and explicit idle residency ownership. Do not alter assets, animation or gameplay rewards.

### 4. Confirmed implementation / unmeasured audible risk: theme fades depend on UI frame delivery

`soundtrack-manager.ts:151-173` steps fades with requestAnimationFrame. The main-theme transport volume setter cancels gain automation and sets each current value instead of scheduling an audio-clock ramp. A busy UI can therefore delay fade updates despite the sample-accurate loop transport.

Proposed repair: schedule gain ramps on the audio clock while preserving existing durations, targets, interruption and mute ownership. An audible glitch on the phone has not been reproduced in this audit.

Arcade, separately, still uses HTMLAudioElement voices and JS volume fades. Apple's archived iOS media guidance documents non-settable media volume on iOS; treat this as a platform compatibility risk requiring the current WKWebView device test, not a proven current-device failure or a Journey-specific explanation.

### 5. Confirmed diagnostic blind spots

`src/utils/runtime-soak-sampler.ts:117` drops frame intervals above 250ms without distinguishing a foreground stall from a lifecycle gap. Thus the worst visible stalls can be absent from reported frame samples. Existing resource counters omit decoded audio bytes and complete retained graphics residency. Native thermal logging does not establish screen brightness or absolute WebView memory.

Proposed repair: retain foreground long-stall counts and maximum duration, add audio residency/voice counters, and correlate a lossless physical trace with native thermal and process-memory measurements.

## What is working in the inspected paths

- Main theme uses one sample-accurate AudioBufferSourceNode; pause stops/disconnects it.
- Controlled execution of the actual soundtrack manager across seven Journey audio cycles kept exactly one main voice. Targets were menu 0.68, gameplay 0.2244, result hook 0 and return 0.68. Music OFF paused the voice with no pending fade callback. This simulates audio state transitions, not seven actual levels.
- Journey retains a ducked main theme alongside separately owned Forest ambience. It does not use Arcade's Calm/Active pair. Do not mistake an intended layered mix for duplicate theme instances.
- Mobile rendering has 60fps activity leases and 30fps settled cadence; shared animation owners and offscreen World scheduling have cleanup coverage. General shared sheets have reference counts and a 30-second / 48 MiB idle policy.

## Evidence and next acceptance run

Targeted test output: `/tmp/journey-player-audit-tests.log` (11 suites / 63 tests passed). Controlled probes: `/tmp/journey-theme-cold-failure-audit.cjs` and `/tmp/journey-seven-stage-audio-audit.cjs`. Temporary artifacts are local evidence, not durable regression tests. Earlier full QA in this task passed 13 gates / 309 suites / 2002 tests before this documentation-only audit.

After scoped repairs and explicit web approval, follow LIVE_DEBUG_WORKFLOW for a lossless KRENI/GOTOVO physical run through Journey 01-07, with repeated returns, Music toggles and background/resume. Record charging state, starting thermal conditions, frame outliers, retained resources, process memory and thermal/brightness changes for a sustained session. Do not reset user progress or install a new build without the applicable authorization.

Apple thermal behavior: https://support.apple.com/en-au/118431

Apple archived iOS media-volume guidance: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html

## Authorized repair pass — 2026-09-16

The user explicitly authorized repairs and parallel agents. The findings above describe the pre-repair state; the following source changes supersede them:

- Main-theme loading now shares pending work and retries on demand after a 2-second failed-load cooldown; constructor preload rejections are handled. Disposed/pause generations prevent late playback.
- Main-theme fades use GainNode audio-clock ramps. Retargeting samples the current envelope; Music OFF, route change and background cancellation stop automation and completion timers. Existing gain targets and durations are preserved.
- Arcade media streams route through GainNodes on the same soundtrack AudioContext, avoiding additional decoded long beds and dependence on iOS media-element volume in the Web Audio path. Unsupported construction retains the existing HTML fallback. Platform exceptions cannot leave teardown owners behind. Current WKWebView file-scheme routing and audible transitions still require physical acceptance.
- Decoded gameplay audio now has a 48 MiB soft total budget, oldest-idle eviction and one 30-second idle-expiry timer. Active and queued buffers are protected even above budget. Failed loads can retry on demand after 2 seconds; stale reset-generation decodes cannot repopulate the cache. Byte and eviction counters are available. Expired sounds may need cold decoding again; onset latency remains part of physical QA.
- Juice/Barrel warmups consult mode, canonical Journey pools and restored live tiles. Barrel resources now share the existing Pixi budget and 30-second idle policy, with explicit leases protecting each live renderer. A repeated idle-preload expiry bug found in independent review is also fixed.
- CC_SOAK counts foreground stalls above 250ms, resets baselines at real visibility/page lifecycle boundaries, and includes soundtrack, decoded gameplay audio and aggregate shared-Pixi residency stats. These are estimated resource bytes, not total process/GPU memory or a screen-brightness measurement.

Regression coverage includes failed-load recovery, canceled/during-load playback, fade ownership and no-RAF gain scheduling, protected oversized audio groups, queued starts, stale decodes, idle texture eviction/reacquisition, canceled late mounts, repeated preloads and a visible 400ms stall separated from background/resume gaps. Agents independently reviewed adjacent resource/audio owners.

No assets, save data, gameplay rules, native bundle or installed phone were changed. Localhost source delivery is verified separately from browser interaction; browser automation was unavailable. Integrated verification: `qa:fast` PASS (8 gates / 85 suites / 780 tests); `qa:full` PASS (13 gates / 310 suites / 2039 tests), including Gameplay KING 24 suites / 305 tests and the 1041-module production build with native sync disabled. Local dist was refreshed. Gate logs: `/tmp/journey-performance-fixes-fast-final.log`, `/tmp/journey-performance-fixes-full.log`. CURRENT_HANDOFF.md records delivery state. Physical thermal/audio/fluidity acceptance remains **NEEDS PHYSICAL TEST**. Per LIVE_DEBUG_WORKFLOW, explicit web acceptance is still required before native delivery.

## Skeptical second review — initial repair verdict withdrawn

A second review requested by the user reproduced gaps missed by the previous 2039 passing tests. Passing those gates did not establish successful physical performance or complete audio recovery.

1. **Introduced cache decode churn:** actual transpiled before/after cache and Forest owners under a controlled platform: seven World returns with 45-second gaps produced 2 decodes before versus 14 after the 30-second TTL. More strongly, seven World→gameplay→World cycles with only 1-second gaps produced 3 versus 15 decodes because the 48 MiB total budget was smaller than the ~51 MiB Forest working set. These measure decode counts, not CPU time or temperature. Evidence: `/tmp/resource-skeptical-audit.cjs`, `/tmp/resource-skeptical-pressure.cjs`.
2. **Existing consumer recovery gap exposed by additional cold loads:** a failed initial Forest gameplay decode followed by a play request 3 seconds later returned success twice but had one fetch and zero started sources, in both HEAD and repaired code. Forest consumers latch active before queued playback and omit failure callbacks, bypassing the new backend retry.
3. **Existing cold Journey transition race remains:** integrated actual soundtrack manager + transport + gain envelope shows a pending initial decode completing during gameplay transition can start at menu gain 0.68. Manager token invalidation alone does not cancel pending transport playback.
4. **Introduced Arcade context-recovery gap:** after a foreground resume rejection, the next user gesture takes the same-layer branch, which only fades gain and does not resume the context. Retry listeners are removed and music remains suspended. Evidence: `/tmp/audio-integrated-adversarial.cjs`.

### Second-review repairs

- Replaced the 48 MiB/30-second audio policy with a **64 MiB soft total LRU budget and no unconditional expiry**. This fits the measured ~51 MiB Forest working set; inactive buffers still evict under pressure, active/queued sources remain protected and main-theme allocation remains separately counted. This raises the configured budget by 16 MiB and permits warm buffers to remain below that limit, trading longer idle residency for avoiding proven recurring decode work. Both original probes now match baseline: 2 World-only decodes and 3 World/gameplay decodes across seven cycles.
- Forest World/gameplay owners clear their active latch on deferred or synchronous start failure and reject stale callbacks by generation. Partially failed World layers stop together. Interrupted HTML fallback fades stop before decoded replacement, preventing an additional overlap found during cross-review.
- Deferred backend native-start failures now report unavailable to the waiting consumer and release nodes; a source.start failure regression covers this path.
- Journey transition cancels the pending transport play itself. A cold theme starts after transition at the existing gameplay fade/target, rather than starting late at menu gain.
- Same-layer Arcade recovery now calls play/resume before fading and validates that interrupted resume really reached running.

Durable tests execute actual soundtrack manager + transport + envelope, and actual Forest consumers + decoded backend, with platform primitives mocked. They cover the original failures and generation/stop boundaries. Focused independent cache/Forest review passed 4 suites / 35 tests; focused soundtrack checks passed 3 suites / 28 tests. Final integrated gates: `qa:fast` PASS (8 gates / 87 suites / 790 tests), `qa:full` PASS (13 gates / 312 suites / 2049 tests), including Gameplay KING 24 suites / 305 tests. Source-only dist refreshed; localhost HTTP confirms corrected cache code. Logs: `/tmp/journey-rereview-fast.log`, `/tmp/journey-rereview-full.log`. CURRENT_HANDOFF.md records delivery state. No native delivery has occurred; physical results remain unverified.
