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
| Native marketing/build version | PASS ARCHIVE | Xcode, in-app Settings and saved Release archive align on public version `1.0`; authoritative app target build is `3` |
| Deployment/device family | PASS source / NEEDS NEW ARCHIVE | iOS 17.0 minimum, universal iPhone + iPad family, portrait orientation; the earlier iPhone-only archive is superseded |
| Privacy manifest source | PASS ARCHIVE | Declares no tracking/collection, UserDefaults `CA92.1` and System Boot Time `35F9.1`; the saved `1.0 (3)` Release archive packages the verified manifest |
| Motion permission disclosure | PASS in current app copy | WebKit motion is optional, used only on-device for visual effects, and the in-app policy identifies Settings → 3D Motion as the revocation control |
| Analytics/advertising surface | PASS in source | No analytics or advertising SDK is integrated; the dormant `window.gtag` exception-reporting adapter and type were removed |
| Game Center | LOCKED OFF / NEEDS APP STORE CONNECT | `stacktosix-app-store-profile.json` locks it off; native audit rejects GameKit, Game Center project references and the Game Center entitlement; leave the App Store Connect feature disabled |
| Public privacy-policy URL | PASS URL / NEEDS FTP REFRESH + APP STORE CONNECT | `https://taptapdesign.com/stacktosix-privacy-policy/` is the clean canonical URL; the local current policy now adds direct email/support contact and must be re-uploaded before its live hash is re-certified |
| Public support URL | PACKAGE PASS / NEEDS FTP | Upload `release/stacktosix-privacy-policy/support.html` beside the live privacy `index.html`; use `https://taptapdesign.com/stacktosix-privacy-policy/support.html` in App Store Connect |
| Development URL residue | PASS ARCHIVE | `useDevServer=false`, native `devServerURL` is empty, the former private LAN URL is absent, and the saved archive passed the built-app audit |
| App Store submission copy | PASS PREPARED / NEEDS APP STORE CONNECT | Exact metadata, privacy answers, age-rating guidance, review notes, screenshot plan and submission order are in `APP_STORE_CONNECT_SUBMISSION_COPY.md` |
| All-ages content position | LOCKED LOCALLY / NEEDS APPLE CALCULATION | `stacktosix-app-store-profile.json` and contract tests lock the expected `4+` general-audience answers: use `Not Applicable`, keep Made for Kids/Kids Category off, and let Apple calculate the final regional rating |
| Export compliance declaration | PASS ARCHIVE | Native source and final archive declare `ITSAppUsesNonExemptEncryption=false`; the release audit locks the value |
| Release archive | PASS DEVELOPMENT-SIGNED / BLOCKED DISTRIBUTION EXPORT | Verified 355 MB `1.0 (3)` archive is saved in Xcode Archives; App Store export fails because team `L3H6B843AL` cannot create an iOS App Store profile |
| Deterministic web QA | PASS after final release integration on 2026-08-27 | `qa:full`: 199 suites / 1252 tests, 954-module production build and bundle audit |
| Gameplay regression lock | PASS after post-KING cleanup on 2026-08-27 | `qa:gameplay-lock`: 24 suites / 268 tests plus contract audit |
| Asset mutation | OUT OF SCOPE | Preserve all assets; only packaging presence may be audited |

## Must be closed before Archive upload

### Build identity and signing

- `PASS in source`: marketing version is `1.0`; native build is monotonically advanced to `3`.
- `BLOCKED APPLE ACCOUNT`: obtain/authorize an Apple Distribution certificate and App Store Connect provisioning profile for team `L3H6B843AL`; follow `APP_STORE_ACCOUNT_UNBLOCK.md`.
- `PASS`: authoritative Stack to Six Release Archive `1.0 (3)` created and retained in Xcode Archives.
- `PASS local archive / OPEN distribution export`: local archive validation and deterministic app audit pass; App Store export validation waits for the Apple account fix.
- `PASS`: final local archive bundle ID is `com.taptapdesign.stacktosix.Stack-to-Six`.
- `PASS source and local archive / OPEN exported IPA`: the private LAN development URL and legacy native identity are absent; the final App Store-resigned export must also prove no debug `get-task-allow` entitlement.

### Privacy and platform declarations

- `PASS local archive / OPEN exported IPA`: the saved archive contains the verified `PrivacyInfo.xcprivacy`; repeat aggregation inspection after App Store export.
- `OPEN`: declare every collected/linked/tracking data category consistently in App Store Connect.
- `PASS local archive`: UserDefaults and System Boot Time required-reason declarations are locked by `qa:ios:source` and present in the saved archive; repeat after App Store export.
- `OPEN`: verify Info.plist usage descriptions for every permission the binary can request.
- `NEEDS FTP REFRESH + APP STORE CONNECT`: upload the current privacy `index.html`, re-verify it over HTTPS, enter `https://taptapdesign.com/stacktosix-privacy-policy/`, and retain the in-app link in the final bundled build.
- `NEEDS FTP + APP STORE CONNECT`: deploy and verify `https://taptapdesign.com/stacktosix-privacy-policy/support.html`, then use it as the Support URL.

### Product completeness

- `PREPARED / NEEDS APP STORE CONNECT`: final proposed name, subtitle, description, keywords, categories, age-rating answers, copyright, support URL, privacy URL and review notes are locked in `APP_STORE_CONNECT_SUBMISSION_COPY.md`.
- `NEEDS APP STORE CONNECT`: screenshots/app previews for every required device class.
- `OPEN`: no placeholder copy, broken link, unavailable screen or reviewer-blocking flow.
- `PREPARED / NEEDS APP STORE CONNECT`: review notes explain the optional on-device 3D Motion behavior and Settings revocation path.
- `PASS current product / NEEDS APP STORE CONNECT`: no account or login exists, so no demo account or reviewer credentials are required.

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
