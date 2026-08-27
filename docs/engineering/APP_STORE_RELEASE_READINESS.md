# Stack to Six App Store Release Readiness

Audit date: 2026-08-27
Scope: source/native configuration and release process
Explicit exclusion: asset optimization, deduplication, renaming, recompression and deletion

## Verdict vocabulary

- `PASS`: verified deterministically in the current workspace/build.
- `OPEN`: required before submission but not yet proven by this audit.
- `NEEDS APP STORE CONNECT`: requires account metadata or Apple portal state.
- `NEEDS PHYSICAL TEST`: requires the physical iPhone 13 blue/TestFlight behavior.

## Current foundation

| Item | Status | Evidence/required action |
| --- | --- | --- |
| Authoritative source | PASS | `/Users/user/cube-crash` |
| Native target identity | PASS in current engineering contract | Stack to Six project/scheme and exact bundle ID only |
| Bundled/offline runtime | PASS in current installed checkpoint | `useDevServer=false`; App Store release must retain it |
| Native source guard | PASS on 2026-08-27 | `npm run qa:ios:source` targets only Stack to Six |
| Native bundle ID | PASS in project source | `com.taptapdesign.stacktosix.Stack-to-Six` in Debug and Release settings |
| Native marketing/build version | OPEN | Xcode currently reports marketing `1.0`, build `2`; align intentionally for submission |
| Deployment/device family | PASS as current product choice | iOS 17.0 minimum, iPhone family, portrait orientation |
| Privacy manifest source | PARTIAL PASS | `PrivacyInfo.xcprivacy` exists, declares no tracking/collection and UserDefaults reason `CA92.1`; final archive/dependency merge still requires verification |
| Motion permission disclosure | OPEN | WebKit requests device orientation/motion permission; verify whether final binary/SDK requires an Info.plist usage description and ensure reviewer-facing wording is accurate |
| Development URL residue | OPEN | `useDevServer=false`, but a private LAN dev URL string remains in native source; remove or compile-gate it in the final release-hardening session |
| Deterministic web QA | PASS at `v2.0.653`; rerun required after lockdown | `qa:full` |
| Gameplay regression lock | PASS on 2026-08-27 | `qa:gameplay-lock`: 19 suites / 249 tests plus contract audit |
| Asset mutation | OUT OF SCOPE | Preserve all assets; only packaging presence may be audited |

## Must be closed before Archive upload

### Build identity and signing

- `OPEN`: choose final marketing version and monotonically increasing native build number.
- `OPEN`: verify Release configuration, distribution certificate, provisioning and selected team.
- `OPEN`: create a Release Archive for the authoritative Stack to Six scheme.
- `OPEN`: validate the archive in Xcode/App Store Connect before upload.
- `OPEN`: prove final archive bundle ID is `com.taptapdesign.stacktosix.Stack-to-Six`.
- `OPEN`: prove no development server URL, debug-only entitlement or legacy Kockice Crash identifier is present.

### Privacy and platform declarations

- `OPEN`: inspect the final dependency graph and archive for privacy manifests (`PrivacyInfo.xcprivacy`).
- `OPEN`: declare every collected/linked/tracking data category consistently in App Store Connect.
- `OPEN`: verify Required Reason API declarations used by app or bundled SDKs.
- `OPEN`: verify Info.plist usage descriptions for every permission the binary can request.
- `OPEN`: ensure privacy policy URL and in-app behavior match the submitted declarations.

### Product completeness

- `NEEDS APP STORE CONNECT`: final name, subtitle, description, keywords, category, age rating, copyright, support URL and privacy URL.
- `NEEDS APP STORE CONNECT`: screenshots/app previews for every required device class.
- `OPEN`: no placeholder copy, broken link, unavailable screen or reviewer-blocking flow.
- `OPEN`: provide review notes for non-obvious gyro/spatial permission behavior if relevant.
- `OPEN`: verify any account/login requirement and reviewer access; currently expected to be unnecessary for core play.

### Runtime quality

- `NEEDS PHYSICAL TEST`: cold launch, first-play tutorial, Journey, Arcade, drag/rapid drag, every special archetype, final merge, NO MOVES, fail, Play Again, restart and save/load.
- `NEEDS PHYSICAL TEST`: background/foreground, interruption, audio/haptics, orientation/safe areas and offline launch.
- `NEEDS PHYSICAL TEST`: sustained FPS, thermal state and memory growth in a release/TestFlight build.
- `OPEN`: crash/termination log review after the final physical run.

## Release gate sequence

1. `npm run qa:gameplay-lock`
2. `npm run qa:full`
3. Explicit asset packaging verification only; no asset cleanup
4. `npm run qa:ios`
5. Build signed Release Archive for Stack to Six
6. Verify final archive identity, mode, privacy manifests and entitlements
7. Xcode/App Store validation
8. TestFlight install and physical acceptance matrix
9. Complete App Store Connect privacy/metadata/review notes
10. Upload/submit only after every `OPEN` relevant to submission is closed

## Non-guarantee

Passing local QA materially reduces rejection and regression risk but cannot guarantee Apple approval. Apple review also evaluates current policy compliance, metadata, privacy declarations, final binary behavior and reviewer access. Re-check Apple's current official requirements immediately before submission.
