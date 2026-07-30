# Release Readiness Center

This is the working release gate for Stack to Six. Use it before TestFlight, before App Store submission, and before large stability refactors.

## Daily Gate

Run this before merging stability-sensitive work:

```bash
npm run release:check
```

The gate covers:

- static release audit for conflict markers, stale diagnostics, `debugger`, and required release docs
- production logging config verification
- TypeScript validation
- lint
- full Jest suite
- production Vite build
- built app chunk audit for `console.*`, `debugger`, and source map comments

## App Store Candidate Gate

Run this before creating an iOS archive:

1. Run `npm run app-store:preflight`.
2. If it reports `NEEDS SYNC`, follow `docs/engineering/dev-production-modes.md` to sync only `dist/` into `/Users/user/Stack to Six/Stack to Six/Web.bundle`.
3. Run `npm run qa:ios` again and require `PASS` before building.

Never use the repository Capacitor shell or a generic `cap sync ios`; it is not the visible Stack to Six app.

Then verify in Xcode:

- archive builds with the intended bundle identifier, version, and build number
- signing team and provisioning profile are correct
- `GameViewController.useDevServer` is `false` and the app loads its bundled `Web.bundle`
- app launches from a fresh install and from an upgrade install

## Manual iOS Smoke Flow

Run on at least one small iPhone viewport and one modern large iPhone viewport:

- cold launch to homepage
- homepage Play to board
- Journey open from homepage
- Journey board card open
- board Play from card
- End Run close back to board detail card
- board detail card close back to Journey
- fail/retry flow
- pause/resume flow
- background app during board, return, then continue
- repeat Journey -> board -> modal -> Journey at least 10 times and watch memory/FPS

Release blocker examples:

- blank screen after closing a modal or bottom sheet
- enter/exit animation starts from a visible final frame
- stats/card content appears without animation after board return
- board state restores to an impossible tile layout
- heap or WebView memory grows every loop without settling
- unhandled promise rejection, Pixi texture error, or GSAP teardown error

## Privacy And Review Inputs

Before App Store Connect submission, confirm:

- App Privacy Details match actual SDKs, analytics, crash reporting, and storage behavior
- `PrivacyInfo.xcprivacy` is present if the native app or bundled SDKs require it
- permission prompts are minimal and have clear purpose strings
- reviewer notes explain any non-obvious game flow
- screenshots match the current build
- age rating, support URL, and privacy policy URL are final

## Debugging Rule

If the same release-blocking bug reproduces after one attempted fix, add targeted diagnostics before the next behavioral change. Log one searchable prefix at each ownership boundary:

- event handler entry
- route/state decision
- animation start/end
- DOM visibility and computed style
- cleanup/disposal
- fallback path

Remove or demote temporary diagnostics before the release candidate.
