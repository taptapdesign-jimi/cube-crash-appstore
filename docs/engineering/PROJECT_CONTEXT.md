# Stack to Six Project Context

This file is the stable, authoritative onboarding map for new Codex chats. Verify mutable facts from disk or the connected device; do not rely on old conversation memory when it conflicts with this file.

## Product identity and repositories

- Product/app name: **Stack to Six**.
- Web/game source repository: `/Users/user/cube-crash`.
- Active native iOS shell: `/Users/user/Stack to Six/Stack to Six.xcodeproj`.
- Active Xcode scheme/target: `Stack to Six`.
- Active bundle identifier: `com.taptapdesign.stacktosix.Stack-to-Six`.
- Bundled web destination: `/Users/user/Stack to Six/Stack to Six/Web.bundle`.
- Legacy shell `/Users/user/Kockice Crash/Kockice Crash.xcodeproj` and bundle `com.taptapdesign.kockice.Kockice-Crash` are not part of the normal workflow. Never modify, sync, build, install, launch, or uninstall them unless the user explicitly requests Kockice Crash.
- `/Users/user/cube-crash/ios/App/App.xcworkspace` is a separate Capacitor shell and is not the visible Stack to Six app.

The repository retains historical `cube-crash` names in paths and code. That does not change the current product/native target identity.

## Native mode and device

- Physical-device checks normally use the bundled `Web.bundle` mode with `useDevServer = false` in `/Users/user/Stack to Six/Stack to Six/GameViewController.swift`.
- Do not switch to LAN/Vite loading unless the user explicitly requests that experiment. The prior LAN workflow produced white-screen and routing failures.
- The only normal physical test/install target is `iPhone 13 blue`. Never fall back to another iPhone or iPad unless the user explicitly names that device and asks to change targets.
- Hardware destination ID used by `xcodebuild`: `00008110-001E39961AFA801E`.
- CoreDevice ID used successfully by `xcrun devicectl`: `0F62B71E-0B04-53C3-906E-EC28F5D2390B`.
- Resolve and verify the connected device before an install; identifiers may change after device re-pairing.
- Install over the existing Stack to Six app. Do not uninstall it unless explicitly asked, because uninstalling destroys app data and can reintroduce developer-profile trust friction.

Read [`dev-production-modes.md`](dev-production-modes.md) before every native build/install. Before installation, verify the final `.app/Info.plist` bundle ID and bundled intro/assets. A successful Xcode build alone is not proof that the correct app was targeted.

## Web-to-iOS ownership

1. Edit source only in `/Users/user/cube-crash`.
2. Build the Vite app.
3. Ensure the complete raw `assets/` tree is present under `dist/assets/`; bare hashed Vite output is insufficient for runtime-relative assets.
4. Sync only `dist/` to the Stack to Six `Web.bundle`.
5. Build only the Stack to Six Xcode project/scheme.
6. Verify `CFBundleIdentifier=com.taptapdesign.stacktosix.Stack-to-Six` inside the final `.app`.
7. Install and launch that exact bundle ID.

Use `SKIP_NATIVE_BUNDLE_SYNC=true npm run build` when validating web code without changing the native bundle. `npm run build` normally invokes `scripts/postbuild.mjs`, whose only allowed native destination is Stack to Six.

## Current launch/preloader design

- First-frame markup and fallback assets: `index.html`.
- Launch animation/lifecycle owner: `src/modules/launch-screen.ts`.
- Shared paper surface owner: `src/utils/app-paper-background.ts`; screen code should call the shared helper rather than introduce another paper-background string.
- Studio logo: `assets/logo addons/taplogo.png`.
- Random character source: non-`@2x` files matching `assets/logo addons/lik-*.png`.
- Current character set: `lik-board`, `lik-game`, `lik-gitara`, `lik-kauc`, `lik-klizanje`, `lik-lajna`, `lik-pas`, and `lik-vrt`.
- The logo and character are independent animation units. The character exits first, followed by the TapTap logo. The launch owner must dispose listeners, abort pending work, and release tracked animations after handoff.
- Do not restore the removed old combined TapTap/Stack to Six preloader branch or duplicate background ownership.

## Major ownership map

- App/game orchestration: `src/modules/app-core.ts` and extracted `app-core-*` modules.
- Gameplay decisions/final merge: `gameplay-resolution-engine.ts`, `final-merge-rules.ts`, `endgame-checker.ts`.
- Merge/FX: `merge-animations.ts`, `fx.ts`, `fx-*`, `wild-stars.ts`, and `stars-collector.ts`.
- Run origin: `run-mode.ts`; Arcade is `arcade_home`, Journey is `journey`.
- Homepage slider/navigation: `slider-manager.ts`, `navigation-control.ts`, `utils/animations.ts`, and `independent-navigation.css`.
- Journey hub/world screens: `collectibles-manager.ts` and `journey-boards-manager.ts`.
- Journey motion contract: [`JOURNEY_ANIMATION_CONTRACT.md`](JOURNEY_ANIMATION_CONTRACT.md).
- Physical iOS performance workflow: [`IOS_LIVE_PERFORMANCE_INVESTIGATION.md`](IOS_LIVE_PERFORMANCE_INVESTIGATION.md).

Journey Worlds hub and an individual Journey world are different surfaces. Every Journey Worlds hub entry starts at the absolute top, including returns from Forest/Beach/Area 51; the user scrolls the hub manually from there. Auto-scroll to an active interim card belongs only to individual Forest/Beach/Area 51 screens.

## Engineering guardrails

- Inspect `git status` before editing. Preserve unrelated uncommitted user changes.
- Fix the owning module, not a duplicate CSS/timeout workaround.
- Keep Arcade and Journey behavior explicitly scoped through the existing run-mode source of truth.
- Every GSAP/Pixi ticker, timeline, listener, timer, particle container, or temporary sprite needs an interruption and cleanup path.
- Do not destroy shared Pixi textures from a local effect.
- Validate proportionally: targeted tests where logic changes, then type-check and production build when practical.
- Never claim a phone has the latest change merely because web build passed; verify sync, final `.app`, install result, and launched bundle separately.
