# Native first-touch attribution — 2026-09-17

User requested attribution and repair after repeated broad measurements. All-process Time Profiler captured installed web package bb676c411, native host53828, WebContent53829, GPU53830. Trace start00:39:04.658 CEST,61.956555s. User window00:39:18.728309–00:39:59.281199 (40.55289s). Console was read before stopping; profiler saved successfully despite overlapping-system-dylib symbol warnings. Both processes are closed.

## Evidence

`logs/journey-allprocess-20260917/` contains raw trace, console, markers, XML exports, reproducible `attribute.py`, per-process samples, first-responder samples and attribution JSON. JS/trace alignment uses median host-receipt minus JS-clock offset; sampling and receipt delay limit precision. CPU sample weights are statistical and overlapping inclusive weights must not be added.

Seven complete five-second windows:2071frame intervals,mean16.909ms,worst163ms,19>34ms,0>250ms. Eight thermal samples nominal; no in-range logged error/reload/crash candidates. Three Homepage→Hub entries,two World visits; this is not sustained gameplay thermal evidence.

The163ms intervalJS30005–30168 starts155ms before Journeyinputsetup30160. Setup3ms,Journeyprepare3ms; exit itself worst21ms. Native host samples in aligned interval:45ms main-thread weight,39ms inclusive `WKContentView _singleTapRecognized:` → `WKWebView becomeFirstResponder` → `WKContentView becomeFirstResponderForWebView`, with24ms dlopen/22ms loader notification inside that same path. WebContent main19ms. This establishes cold native responder work as a contributor before game handler entry, not an explanation of every163ms.

Other gaps differ:55ms before Hub reveal has42ms WebContent main,35ms inclusive JSC microtasks and7ms function compilation. Later World-entry59ms gap has32ms WebContent main,27ms inclusive microtasks. JS function symbols are not available, so these do not establish a particular TS function. Source review found full-tree GSAP retirement traversing retained prepaint content, diagnostic subtree counts, and zero-delay hit-target geometry after DOM/GSAP writes. Those candidates remain unmodified in this isolated native experiment.

## Scoped repair

Authoritative native `GameViewController.swift` now requests public `WKWebView.becomeFirstResponder()` on initial `viewDidAppear` only. The one-attempt flag is consumed before guards; bundled mode, non-background state, key window, same-window attachment, no presented controller and responder eligibility are required. Initial inactive state is permitted, as UIKit focus eligibility does not require active state. No later foreground/navigation retry, private API, DOM text focus or immediate resign is added. Diagnostic-only result/duration marker proves whether preparation happened; successful startup and keyboard behavior still need device validation.

Original native file and precise patch are preserved beside trace evidence because the native directory is not a Git repository. Public API reference: https://developer.apple.com/documentation/uikit/uiresponder/becomefirstresponder()

Independent scoped review PASS. qa:ios PASS, Xcode BUILD SUCCEEDED, final-app native audit and codesign PASS. Web/runtime source unchanged from13gates341suites2257testsPASS; accepted motion/assets/save unchanged. Native binary hashes saved separately from unchanged web index hash.

Delivery/physical acceptance: see CURRENT_HANDOFF. This is a targeted mitigation pending physical comparison, not proof all stalls are eliminated.

## First physical comparison

Installed native mitigation; diagnostic accepted=true,122.095ms at00:44:49.301 before document navigation00:44:49.509. User began interaction before formal KRENI, so full-session data is retained. FirstinputJS6484 sits in44ms interval6457–6501. FourHomepageexits20/62/17/19ms; no recorded interval afterfirstinput exceeds62ms. The prior163/187ms event did not recur in this small test, supporting but not proving permanent mitigation. Remainingviewport23–42ms, Worldhandoff54–58ms andsecondHomepageexit62ms are still unresolved. Official22.670s markerwindowworst54ms is not the whole-session maximum. Thermalnominal, no loggederrors. Consoleclosedcleanlyafterbufferpreservation; uservisual/keyboard/touchacceptancepending.

User acceptance: “Da, prvi klik je bolji i sve reagira normalno” (2026-09-17), answering improved first Journey click and normal touch/drag without keyboard. Native first-touch mitigation accepted; residual Journey/World stalls remain open.
