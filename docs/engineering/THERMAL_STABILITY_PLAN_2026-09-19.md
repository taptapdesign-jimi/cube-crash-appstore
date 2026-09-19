# Stack to Six thermal-stability plan — 2026-09-19

## Goal

Find and remove the sustained CPU, GPU and memory owners that make the iPhone 13 blue reach `serious`, lose its WebGL context and terminate WebContent, while preserving current gameplay, timing, animation, artwork, audio, progression and touch feel.

This is an evidence-first plan. Resolution, FPS, effects or assets do not change permanently until a controlled comparison proves a meaningful thermal or memory benefit and the user accepts the physical appearance and feel.

## What `resolution: 1.5` means

The main Pixi renderer uses `min(1.5, devicePixelRatio)` on mobile, with antialiasing disabled and low-power GPU preference. On an iPhone 13 portrait CSS viewport near 390 × 844:

| Pixi resolution | Approximate backing buffer | Relative pixel count | Change from 1.5 |
| --- | ---: | ---: | ---: |
| 1.5 current | 585 × 1266 | 2.25× CSS pixels | baseline |
| 1.25 candidate | 488 × 1055 | 1.5625× CSS pixels | about 31% fewer pixels |
| 1.0 candidate | 390 × 844 | 1.0× CSS pixels | about 56% fewer pixels |

The setting affects the main gameplay Pixi canvas: dice, Pixi HUD/text, particles and board rendering. It does not directly lower the cost of DOM/CSS screens, HTML images/video, audio decoding or independent Journey canvases. Lowering it can reduce fill-rate, compositing and render-target memory, but 1.0 may soften Pixi text, thin edges, particles and dice detail. Asset bytes and logical geometry do not change.

## Proven starting point

- In the 2026-09-18 natural stress run, thermal moved `nominal → fair` at about six minutes and `fair → serious` at about eight minutes.
- A native memory warning followed, then dense 35–125ms frame stalls, WebGL context restoration with blank core textures, an 18-asset repair, and WKWebView WebContent termination.
- Charging and 85–100% brightness added heat, but do not explain the complete renderer/memory failure.
- Current mobile gameplay drops to 30 FPS only when settled. Continuous pointer movement and animation leases keep it at 60 FPS, with a 2.4-second interaction tail.
- Current reduced-FX policy starts after sustained play or bad frame windows, but it is not driven by native thermal state and does not control renderer resolution or all resource owners.
- Native thermal state is logged but is not sent to the JavaScript runtime as a production governor input.
- The diagnostic build logs every merge and adds sampling overhead. It can exaggerate load, so attribution must include a normal low-overhead confirmation run.

## Phase 1 — measurement package

Add bounded, low-overhead diagnostics with one thermal incident prefix. Record at screen/board boundaries and every 30 seconds, not every frame:

- native host, associated WebContent and GPU process identity and resident-memory trend;
- native thermal state, brightness, battery/charging and memory warnings;
- Pixi renderer resolution, ticker `maxFPS`, active cadence leases and interaction-tail state;
- live/idle shared sheets, Pixi textures and estimated GPU-backed bytes;
- decoded audio active/idle bytes and pending decodes;
- live image, video/HEVC, canvas, DOM, GSAP, ticker and hidden-screen owner counts;
- current route, board generation, transition/finale owner and cleanup completion;
- context loss/restoration and texture-health results.

Use lossless file-backed console capture. Validate Instruments sample tables before the user performs a long run. Do not use continuous DOM/layout walks or verbose per-merge logging in the final thermal baseline.

## Phase 2 — controlled renderer-resolution comparison

Provide a diagnostic-only startup selection for 1.5, 1.25 and 1.0 so the same bundled code and save can be compared without unrelated changes.

Run cooled, fixed-condition A/B/B/A comparisons on iPhone 13 blue:

- fixed measured brightness, initially 50–60%; same case, sound and network state;
- prefer unplugged battery operation after wireless capture is verified;
- identical route and play duration;
- no profiler in the first visual/thermal pass, then one validated profiler pass for the best candidates.

Compare thermal transition time, WebContent/GPU memory slope, GPU/power impact, frame pacing and physical sharpness at:

- ordinary dice and numbers;
- HUD score/combo/bonus text;
- drag shadow and moving dice;
- Wild/Special idle and merge finales;
- smoke, particles and board transitions.

Choose 1.25 or 1.0 only if it measurably reduces load and the user cannot see an unacceptable loss. The likely first candidate is 1.25, but measurement and physical review decide.

## Phase 3 — isolate sustained heat owners

Use one reversible change at a time. Preserve the same route and environment.

1. **Pixi cadence:** verify whether gameplay stays at 60 FPS because of legitimate interaction or a leaked activity lease/tail. Measure 60 FPS time by owner. Test shorter post-input tails without changing drag or active animation cadence.
2. **Renderer fill cost:** compare 1.5/1.25/1.0 while keeping all effects and timing identical.
3. **Resource growth:** repeat Area 55 → Arena → Play Again cycles and identify which texture, image/video, decoded-audio or hidden-screen class grows instead of returning to a bounded plateau.
4. **Special/runtime work:** use the existing diagnostic isolation groups for shared sheets, Pixi rendering, CSS idle and GSAP idle. Do not repeat the already inconclusive ambient-only claim as if it were proven.
5. **Route cleanup:** verify Area 55 transition, Ship/Kanta/finale and Journey owners release at route exit and cannot complete an old async decode/load into Arena.
6. **Normal-build confirmation:** repeat the winning candidate without verbose performance diagnostics to separate game cost from observer overhead.

## Phase 4 — owner-level repairs

Implement only repairs supported by Phase 2/3 evidence. Preferred order:

1. Cancel stale async decode/preload work and release route-owned image/video/texture resources at the real exit boundary.
2. Enforce proactive mobile cache budgets before iOS sends a memory warning; protect active voices and live visual owners.
3. Fix any leaked Pixi cadence lease, ticker, GSAP animation, DOM subtree or hidden screen.
4. Shorten unnecessary 60 FPS interaction tails while keeping drag, enter, exit, merge and active finales at their accepted cadence.
5. Add a native thermal bridge with hysteresis:
   - `nominal`: current accepted presentation;
   - `fair`: pause post-critical preparation, reclaim idle resources and reduce only settled/background work;
   - `serious`: temporary emergency protection such as lower renderer resolution/cadence and reduced nonessential particles;
   - restore gradually only after a sustained cooler state.

Thermal protection must not change gameplay rules, input geometry, scoring, progression, save/load, animation paths, sound triggers or assets. It must never destroy a resource still owned by a visible tile or active finale.

## Validation and acceptance

For every code change: focused owner/lifecycle tests, `npm run qa:gameplay-lock`, `npm run qa:fast`, then `npm run qa:full`. Before delivery: `npm run qa:ios`, authoritative Stack to Six bundle verification, Xcode build, final bundle-ID/hash verification and install-over only.

Physical acceptance on iPhone 13 blue requires:

- user accepts dice, HUD, drag, transitions and every sampled Special at the selected resolution;
- no `serious`/`critical`, native memory warning, WebGL context loss or WebContent termination during a 15-minute natural route at fixed 50–60% brightness on battery;
- no monotonic process-memory growth across at least three Area 55 → Arena/Play Again cycles;
- no sustained bad five-second frame windows and no recurring 100ms+ gameplay stalls;
- a separate 85–100% brightness/charging stress run may be warmer, but must not corrupt visuals or terminate WebContent;
- current animation timing, sound, gameplay and visual content remain intact.

The final verdict remains `NEEDS PHYSICAL TEST` until both telemetry and the user's physical assessment pass the same installed candidate.
