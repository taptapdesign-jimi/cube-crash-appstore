# Physical Native render performance — 2026-10-21

Current signed Release installed over iPhone 13 blue; primary and previous saves byte-identical across install/normal launch. No render or gameplay code changed. Opt-in diagnostics and Instruments Game Performance Overview attached to Native PID31112. Wired, battery100%, brightness100%, Low Power Mode off; profiling adds overhead. Raw evidence: `/tmp/phone-render-performance/`.

## Results

- Recording23:42:25.899–23:47:27.206 local,301.307 seconds; gameplay approximately2.5 minutes, two board generations.
- Actual drawable1170×2532, scale3. This is3× screen density, not fixed2×.
- Thermal: Nominal for entire Instruments interval and all77 parsed native samples. No reported elevated thermal state in this run; no temperature in Celsius measured.
- Metal displayed-frame interval aggregates:123 nonzero average bins,7225 frames; frame-count-weighted16.923ms ≈59.09FPS. Worst interval66.782ms; worst average bin24.761ms. Not locked60.
- Scene callback windows:115 mostly60-target windows,mean59.51callbacks/s,minimum56.93/s; maximum active gap73.1ms. These are separate from display FPS.
- Valid GPU timings:72 bins /4277 frames, weighted GPU active2.781ms, GPU begin-to-end3.263ms. Max active7.359ms; max begin-to-end22.309ms. Missing timing bins excluded, not treated as zero.
- Gameplay CPU30.57% mean /38.34% max of one core. Native sampled footprint213.9–321.8MiB; Instruments peak327.61MiB. No baseline establishing memory regression/leak.
- Worst callback gap23:46:06 coincides with TNT/merge effects: source delivery58.72ms, layer commit38.07ms, root cleanup17.44ms, ticker17.56ms. Metrics overlap; do not sum them. Supports investigating animation/commit work before assuming sustained GPU saturation.
- Sampled owned-Metal counters: no unavailable drawable or in-flight skips.

## Evidence quality and verdict

CPU export49131 rows; process110; thermal1; Metal duration aggregates4000. Per-frame metric export crashed xctrace(exit139); interval table empty. Display interval conclusions use successful duration aggregates (variant0 average, variant2 maximum), not callback FPS. GPU timing is only partially available.

Thermal PASS for this measured interval. Intermittent frame hitches observed; smooth locked60 FAIL. Long-session/heat-soak acceptance NEEDS PHYSICAL TEST. No controlled1× baseline, so cannot attribute differences to render scaling. No code fix or setting change made. Both local captures ended after GOTOVO; app remains running without restart.
