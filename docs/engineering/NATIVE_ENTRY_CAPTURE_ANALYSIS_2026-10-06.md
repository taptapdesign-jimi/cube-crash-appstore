# Native entry capture analysis — 2026-10-06

Read-only investigation of wireless PID3323/.native capture; source mainba45caf2. Raw evidence: logs/native-wireless-fluidity-20261006/wireless-console.log. No runtime change/build/install.

## 104ms interval

RAF interval118468→118572ms overlaps Journey2 fresh-run route marker118511ms (43ms before marker,61ms after). Texture GPU-probe receipt118609ms is37ms after that interval ended; both tile and numbers healthy, three samples each. Hidden layout commits118630/118635ms move y152→136 before pop-in118638ms. These timestamps do not locate a104ms function or prove which screen visibly hitched. Initial gameplay preparation overlaps the interval; layout/pop-in receipts follow it.

Owners: src/main.ts startNewRunFromJourney2033: tutorial guard, origin transition, progression/save cleanup, Homepage parking, level-flow cleanup, bootGame, hidden final layout, showApp/entry commit. src/modules/app-core.ts startLevel7424+ starts preparation/preloads/old-generation cleanup, cadence, GPU texture readiness. ensureCoreRenderTexturesGpuReady2562 calls required asset validation then GPU probe. src/utils/pixi-image-texture-health.ts95 invokes synchronous renderer.extract.pixels for three samples per core asset (six readbacks total). GPU readback is a candidate to time, but its logged completion occurs after the offending callback interval. It must not be blamed or removed from this trace alone; missing-texture safeguards stay protected.

No texture repair, missing pixels, thermal escalation or audio eviction appears around entry. Source/capture do not support blaming double visible layout: both hidden commits precede pop-in. Missing data: fresh-run handler start, boot/asset validation/probe begin+end, scheduler/CPU stack and native motion/presentation intervals. Narrow phase timings + valid physical profiling are needed to attribute cost; keep canonical owners and assets unchanged.

## Fail2 return

CTA175829ms; preparation175832(+3); result-last-visible176852(+1023); resources retired176875(+1046); route handoff176882(+1053); native enter scheduled176933(+1103); enter complete177774(+1945). Last visible result→scheduled enter80ms overlaps RAF176840→176935(95ms). Most total time is authored result/enter animation; no1600ms fallback wait observed in this Fail route. It is not the same Clean Board route as earlier captures.

## Renderer cadence and measurement correction

RAF16.72ms is callback scheduling, not game-presentedFPS. Visible-game snapshots: initial settled15FPS; active samples60FPS; one settled motion30FPS. Mobile controller uses60 for activity leases,30 for settled animation leases,15 for static board; this is authored resource policy, not evidence of thermal throttling. TargetFPS means configured cap, not delivered frames. Final previous feedback correctly calls59.8 callbacks/sec, but cannot certify59.8 gameFPS.

Verdict: initial game preparation and Fail→World handoff have timing correlations worth profiling. Exact104ms root cause and native60FPS remain NEEDS PHYSICAL TEST; no speculative behavior fix.
