# Background work, loading and dead-code audit — 2026-09-17

Read-only source audit requested after special-dice repairs. Three agents plus parent audio call-chain verification. No runtime, assets, bundle or phone changes. Installed app remains 36aac656; newer repairs are source/dist only.

## Prioritized findings

### 1. All-family audio preparation on every Journey Play

`journey-boards-manager.ts:12930–12946` prepares Fish, Beach Ball, Flower, Bee, Robo, Bottle, Honey and core/shared sounds without board-family eligibility. For example, Forest prepares Fish/Robo and Area55 prepares Flower. `gameplay-audio-buffer-player.ts:186–224` deduplicates already decoded/pending sources, so repeated calls are not automatically repeated decoding. However, a cold cache or native pressure release (`:428`) causes fetch/decode again, even for unavailable rewards. Concurrent preload requests have no local decode-concurrency queue. Shared 64 MiB cache protects live voices and trims idle buffers.

Concrete source-rate Float32 estimates from WAV headers: Fish five files 2.61 MiB, Flower six files 5.15 MiB, Robo three files 3.13 MiB. These are family totals, not all simultaneously unnecessary and not measured device residency; AudioContext resampling can alter allocation. Evidence `logs/background-work-audit-20260917/audio-estimates.json`.

Recommended: reuse actual pool/restored-tile eligibility for special-only layers, retaining ordinary/shared foundation and on-demand playback fallback. Preserve Settings gates, asset bytes, effective gain and timing. This requires dedicated sound-family review, not deleting sound assets.

### 2. Queued slider request has two unowned timeout paths

`slider-manager.ts:1040–1087` polls enter completion, then schedules a completion timeout. Its fallback timeout remains armed even after successful completion and commits the same slide again. Both timeout IDs are untracked; `destroy()` clears intervals/RAFs, not these closures. They can mutate currentSlide and call updateSlider after destruction/replacement. Concrete lifecycle race and redundant work; not proof of sustained heating.

Recommended: one owned request with success/fallback mutual exclusion, cancellation and generation validation. Test ordinary success, fallback, rapid replacement and destroy before callback.

### 3. Journey DOM decoration unnecessarily enters Pixi cache

`src/utils/board-asset-warmup.ts:125–127,166–195` prepares both density files through Pixi. `app-core.ts:6380–6393` displays the decoration as DOM img/srcset; no Pixi consumer found. Area55 Unit4 pair is 120,919 encoded bytes / 705,500 estimated RGBA bytes. This is selected-board work, not loading every world's assets at once.

Recommended: warm the route-owned DOM representation with its actual density selection. Preserve all supplied files and sharpness.

### 4. Independent Wild Star ticker lacks hidden-document guard

`wild-stars.ts:332–358` performs orbit calculations on its own GSAP callback (`:602`), with destroyed/parent/cadence guards but no document.hidden guard. Journey spawn reaches it through app-spawn/app-core-open-cell. `app-core.ts:2521` stops Pixi on hidden, not this independent callback. Work can run for any GSAP ticks delivered while hidden; actual background scheduling is WebKit-dependent.

Recommended: skip hidden work and reset elapsed-time baseline appropriately on resume. No Home leak demonstrated: cleanupGame stops star owners and last-owner removal detaches the ticker.

### 5. Two small mobile startup preload mismatches

`asset-preloader.ts:365–370` selects ghost @2x for all DPR>=1.5, while board consumers select @3x at DPR3. This loads an unused density on iPhone13 (4,263 encoded / 222,784 estimated RGBA bytes). Share a canonical density selector.

`close-button.png` remains in critical preload lists, but src/index searches find no display consumer; current buttons use close-icon. 14,651 encoded / 37,248 estimated RGBA bytes. Remove only the preload after final broader reference verification; preserve the asset.

### 6. Gameplay chunk is already a startup dependency

Broad manualChunks rules (`vite.config.js:23–37`) put statically imported shared entry/FX owners and app-core in one game-runtime chunk. Current dist has a static startup import/modulepreload of roughly 1.32 MB despite dynamic getGameCoreModule. Thus dynamic API alone does not defer the full chunk.

Recommended: inspect actual build graph before separating safe eager shared owners from deferred gameplay. Avoid changing module evaluation order blindly. This concerns startup parse/load, not perpetual background execution.

### 7. Disconnected FX code

`fx.ts:601` triggerJuiceMergeFizz only reaches its own createMerge6Bubbles implementation; no external runtime caller found. `fx-special-effects.ts` has no runtime imports. These are cleanup candidates, not demonstrated active heat sources. Before removal, complete compatibility/global/dynamic reference checks and gameplay regression gates. Asset preservation still applies.

### 8. Separate play-time accounting defect

`main.ts:1437–1442` stops and immediately restarts tracking while hidden. stopTimeTracking (`:3259`) retains gameStartTime; startTimeTracking (`:3242`) counts prior elapsed time again. This can double-count and include background time. No hot loop involved; fix as statistics correctness, not thermal optimization.

## Existing safeguards verified

- Homepage hide kills animation owners, pauses CSS and destroys slider.
- Journey snapshot/entry suspends ambient owners; Unit idle has visibility/suspension guards and settled cadence cap.
- Ambient disposal removes ticker/listeners/observer and reduces canvas backing stores.
- cleanupGame stops Pixi/special idle/stars/FX/timers and pending Juice work.
- Detailed continuous diagnostics are opt-in. Broad post-critical image warmups already skip mobile.
- Cache hits are not duplicate decode; unused source files are not necessarily shipped/executed code.

## Scope of conclusion

No new physical capture or tests were run for this read-only audit. Findings are source-supported, with arithmetic image/audio estimates where specified. They do not identify the dominant thermal consumer. Prioritize eligible audio, slider lifecycle and duplicate texture ownership before low-impact dead-code removal. Physical FPS/thermal remains NEEDS PHYSICAL TEST.
