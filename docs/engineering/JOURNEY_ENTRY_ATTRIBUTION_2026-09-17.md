# Journey entry follow-up — 2026-09-17

The user rejected installed `07baf7f3` subjectively: “i dalje izgleda isto ko svaki put nije onako superiorno”. Physical acceptance is FAIL. Passing source tests and nominal thermal telemetry do not override this.

## Automatic device probe

After the user ended the capture, launched the same installed Stack to Six bundle on iPhone 13 blue, attached LLDB to PID53436 and evaluated bounded JavaScript probes through its WKWebView. The probes invoked the actual Homepage Journey hero and Forest World click handlers, without gameplay or save edits. Temporary wrappers automatically restored after six seconds; debugger detached cleanly. This is a synthetic navigation probe with debugger overhead, not a replacement for physical touch acceptance or a directly comparable benchmark.

- Homepage: synchronous click20ms; `showCollectiblesScreenWithAnimation`9ms. Fresh Homepage had no CC cleanup bridge. Later callback intervals52/53ms occurred around the reveal boundary. Board-cleanup removal is not justified by this evidence. It does not resolve the prior167ms first-input interval.
- World: synchronous click25ms; first14 cloud drawImage calls totaled1ms of synchronous time. This does not measure deferred GPU work. Callback intervals37/47/39/61ms.
-118 decode calls were observed (many repeated sources, not118 distinct assets). Optional `cardflip@22.png` decode promise took53ms and overlapped critical World preparation; other collectible image promises took21–26ms. Promise latency is not synchronous CPU cost and does not prove that one asset caused the stalls.
- Existing production source begins overlay/reminder preload in `renderBoardsFixed`, concurrently with critical World images and the JS-driven Hub exit. That unnecessary overlap is directly confirmed by the probe.

Raw evidence: `logs/journey-entry-attribution-20260917/{homepage-probe.json,world-probe.json,probe-summary.json}`. No console stream remains active.

## Scoped repair

Optional card overlay/reminder preload now starts only after the current visible World entrance completes, followed by a short quiet period and idle callback (bounded tracked fallback). Generation, motion epoch, view, World ID, phase, connection and page visibility are rechecked. Actual runtime idle and the separate interaction-pause flag are also required, so modal, scrolling and settling reject the optional work. Cancelled enters and stale callbacks cannot warm assets. On-demand modal/reminder loading remains unchanged. World images now consistently request asynchronous decoding; readiness promises remain mandatory.

Added compact, opt-in synchronous Homepage setup phase attribution and World prepaint async boundary marks. No authored motion, artwork files, save/progression or gameplay semantics changed. No speculative global cleanup removal or animation retiming.

## Remaining limits

This removes proven optional work from the critical entry interval, but does not establish that all observed hitches are fixed. The first-input167ms event and reveal-boundary rendering still require attribution. A possible next structural change is moving JS-driven visible transitions onto compositor timelines while preserving the exact curves and cancellation contract; it must be treated as an independently validated change, not a guaranteed fix for raster pressure.

Source QA and web availability are recorded in CURRENT_HANDOFF. Installed phone remains `07baf7f3`; this repair is not yet deployed.

Final QA: `qa-release.log` PASS all13 gates,337 suites/2228 tests, including KING24/306, type/unused/lint, productionbuild with native sync disabled, visual and bundle audits. Independent final review PASS; HTTP5174 serves the final interaction guard. New physical acceptance remains pending.

## Installed repair capture

Installed925e25cb9; 00:19:00.922–00:19:43.280 CEST. Buffered log preserved before intentional console stop. Three Hub entries/two World visits and one card flip/dismiss. No logged errors/reloads;8 thermal samples nominal. World prepaint maxima41/39ms versus previous103ms single visit; total147/65ms. This is encouraging but not causal proof from equal workloads. Hub and World cascades at most32ms. First Homepage exit still has124ms callback gap (global138ms, predominantly inside exit), repeats19/24ms. Input setup16/3/3ms, with first schedule-exit15ms and cleanup0ms; remaining post-setup work unresolved. Viewport45/36/39ms. Strict no-stall verdict FAIL; subjective feedback pending. Raw evidence: `logs/journey-idle-warmup-device-20260917/`.
