# iOS WKWebView / WebContent crash mitigation

## What the logs show

- **WebProcessProxy::didClose** / **WebPageProxy::processDidTerminate: reason=Crash** – the WebContent process (PID 5861) and GPU process (PID 5863) crashed.
- **AVIF/WEBP initImage failed** – image decoder errors in WebContent (err=-39, err=-50). The app does **not** use AVIF/WEBP; assets are PNG. These may be from system/WebKit or a favicon.
- **Sandbox: deny process-info-codesignature** – kernel sandbox denials for `com.apple.WebKit.WebContent`. Common in WKWebView and not necessarily the direct cause.
- **RBS assertion / ExtensionKit errors** – follow-on errors after the process already crashed (e.g. “No such process”, “target process does not exist”).

So the main event is: **WebContent (and then GPU) process crash**, with possible contribution from memory pressure or heavy work around the “Continue → board transition” flow.

## What we changed in code

1. **Pre-transition memory reduction** (`src/modules/endgame-flow.ts`)  
   Right before showing the board transition screen (when user taps Continue):
   - Call `memory-manager.performCleanup()` if the module is loaded (PIXI texture/tracked-object cleanup).
   - If not, do a local PIXI-only cleanup: `clearTextureCache` and destroy base textures with no remaining refs.
   - Then `requestAnimationFrame` once so the main thread can settle before starting the transition.

   Goal: lower JS/GPU memory and workload right before the transition and the next board load, to reduce the chance of WebContent being killed under iOS memory limits.

2. **Existing safeguards** (unchanged)  
   - Double-release fix in `stopTntIdleParticles` (fx.ts).  
   - Confetti spawn unblock via `allowConfettiSpawns()` before clean-board modal.  
   - iOS lifecycle listener removal in app-core cleanup.  
   - Stars/bubbles/TNT and FX cleanup before transition in endgame-flow.

## Recommendations

- **Profile on device**  
  Reproduce the crash with Xcode’s Memory debugger and Allocations/Leaks. Check whether heap or texture memory spikes just before the crash (e.g. around transition or level start).

- **Capacitor / WKWebView**  
  - In the native iOS project, check `WKWebView` configuration (e.g. `configuration.processPool`, `limits`, or any custom WebProcess/GPU process settings).  
  - Ensure no unnecessary heavy work or large allocations in the first 1–2 seconds after “Continue” (e.g. defer non-critical loading).

- **AVIF/WEBP**  
  If you ever add remote assets or a favicon, prefer PNG/JPEG or ensure fallbacks so WebKit isn’t forced to decode AVIF/WEBP in a tight memory situation.

- **Reduce peak load around transition**  
  - Keep pre-transition cleanup (memory + one rAF) as above.  
  - Consider delaying or spreading out work that runs in `onComplete` of the transition (e.g. startLevel/startNewRunFromJourney) by one frame or a short timeout if profiling shows a sharp spike there.

If you have a crash report (`.ips` or backtrace) from the WebContent or GPU process, that would give the exact crash reason (e.g. OOM, assertion, or specific API) and allow more targeted fixes.
