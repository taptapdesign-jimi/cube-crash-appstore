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

## Mobile-first thermal and stability policy

- Stack to Six is a phone/tablet game. Runtime performance decisions target iPhone, iPad/iPadOS, and Android devices; desktop web behavior is a development aid, not the optimization benchmark.
- Mobile detection and shared thermal limits belong in `src/modules/mobile-runtime-profile.ts`. Do not add isolated iPhone-only user-agent checks for settled idle cadence, ambient canvas density, or similar cross-mobile budgets.
- Preserve authored animation quality: enter, exit, drag, merge, modal flip, and active FX may use the display refresh rate. Reduce only settled idle, off-screen, hidden, background, duplicate, or redundant work.
- A mobile optimization must not remove accepted Units, bees, bubbles, depth layering, or animation paths merely to improve a synthetic benchmark. Prefer elapsed-time 30 FPS settled motion, viewport culling, scoped compositor promotion, pooling, and deterministic suspend/resume cleanup.
- Desktop-only smoothness does not close thermal, sustained FPS, memory-growth, touch, or WebView lifecycle work. Those remain `NEEDS PHYSICAL TEST` until verified on the physical target device.

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

## Automated QA workflow

- Repository QA instructions live in `.agents/skills/stack-to-six-qa/SKILL.md`; `AGENTS.md` requires them for validation and release work.
- Use `npm run qa:fast` during implementation and `npm run qa:full` before handoff, commit, push, or release preparation.
- Use `npm run qa:ios` before a native build/install. It is read-only and verifies the authoritative Stack to Six project, scheme, bundle ID, bundled-mode flag, complete raw assets, and `dist`/`Web.bundle` freshness.
- The generic Capacitor `ios:sync`/`ios:build` scripts are intentionally absent because the repository Capacitor shell is not the visible Stack to Six app.
- GitHub Actions runs `qa:full` on pull requests and pushes to `main` or `feature/**`.
- Deterministic QA does not replace physical verification of animation feel, clipping at real safe areas, haptics, sustained FPS/memory, touch, or WebView lifecycle on `iPhone 13 blue`.

## Current launch/preloader design

- First-frame markup and fallback assets: `index.html`.
- Launch animation/lifecycle owner: `src/modules/launch-screen.ts`.
- Shared paper definition and lifecycle owner: `src/utils/app-paper-background.ts`. `body` is the single visible viewport-relative paper owner; HTML is only a solid fallback, `#global-bg` and the launch container stay transparent. Full-screen gameplay-occluding surfaces such as Fail/Clear Board must use `applyAppPaperSurfaceToElement()` so they match the same canonical opacity, texture position, and gradient without introducing another background recipe.
- Studio logo: `assets/logo addons/taplogo.png`.
- Random character source: non-`@2x` files matching `assets/logo addons/lik-*.png`.
- Current randomized character set: `lik-game`, `lik-gitara`, `lik-kauc`, `lik-lajna`, `lik-laptop`, `lik-nogomet`, `lik-pas`, `lik slikanje`, `lik-cvijet`, and `lik-speceraj`. `lik-board`, `lik-dron`, `lik-klizanje`, and `lik-vrt` are explicitly excluded from random launch selection; the user has also removed the former `lik-cekic` and `lik-vrecice` source files.
- The logo and character are independent animation units. The character exits first, followed by the TapTap logo. The launch owner must dispose listeners, abort pending work, and release tracked animations after handoff.
- Do not restore the removed old combined TapTap/Stack to Six preloader branch or duplicate background ownership.

## Major ownership map

- Ultimate gameplay behavior and cleanup guardrail: [`GAMEPLAY_KING_CONTRACT.md`](GAMEPLAY_KING_CONTRACT.md). It is the highest-priority contract for end-game, drag/input, merge, lifecycle, save/load and legacy strangler work. Its asset-preservation order remains active until the user explicitly revokes it.
- Browser-global compatibility inventory: [`RUNTIME_BRIDGE_CONTRACT.md`](RUNTIME_BRIDGE_CONTRACT.md).
- App Store preparation checklist: [`APP_STORE_RELEASE_READINESS.md`](APP_STORE_RELEASE_READINESS.md). This is a readiness audit, not proof of Apple approval.
- Completed source-cleanup record: [`POST_KING_CLEANUP_CLOSURE.md`](POST_KING_CLEANUP_CLOSURE.md). It closes packages 1-8 without closing native, physical-device or App Store submission work.

- App/game orchestration: `src/modules/app-core.ts` and extracted `app-core-*` modules.
- Incremental app-core strangler boundaries: [`APP_CORE_OWNERSHIP_MAP.md`](APP_CORE_OWNERSHIP_MAP.md). It records protected orchestration zones and the established extracted-owner families; it does not authorize a broad rewrite.
- Gameplay decisions/final merge: `gameplay-resolution-engine.ts`, `final-merge-rules.ts`, `endgame-checker.ts`.
- Merge/FX: `merge-animations.ts`, `fx.ts`, `fx-*`, `wild-stars.ts`, and `stars-collector.ts`.
- Authored Journey special progression uses cumulative player-facing pools. `journey-forest-wild-progression.ts` owns Forest (01 Star; 02 Bee; 03 Flower; 04 Honey; 06 Mushroom; 07 TNT). `journey-area55-wild-progression.ts` owns Area 55: Cjelina 01 has only Star and Robo Cube, Cjelina 02 introduces LaserGun on its first reward, and Cjelina 03 introduces Spaceship on its first reward; later Area 55 rewards use only those earned four dice. Bee reuses Wild Star gameplay without orbiting stars and owns a four-frame drag-safe idle plus its dedicated bush/leaf flight finale. `special-dice-registry.ts` continues to own visual-to-gameplay archetype mapping; generic Juice and Magnet do not enter the Forest or Area 55 pools.
- Regular cube stack-contact and no-input board-idle stretch/squash tuning: `src/modules/gameplay-tile-cartoon-motion.ts`. Both Journey and Arcade consume this one profile; retune its `stack.strength` and `idle.strength` rather than introducing mode-specific motion copies.
- Run origin: `run-mode.ts`; Arcade is `arcade_home`, Journey is `journey`.
- Player-facing progression terminology is centralized in `src/modules/gameplay-terminology.ts`: Journey boards are shown as **Stage / Stages**, while Arcade stages are shown as **Round / Rounds**. Keep internal `board` state/save identifiers and Pixi `stage` identifiers unchanged for compatibility.
- Homepage slider/navigation: `slider-manager.ts`, `navigation-control.ts`, `utils/animations.ts`, and `independent-navigation.css`.
- Journey hub/world screens: `collectibles-manager.ts` and `journey-boards-manager.ts`.
- Journey motion contract: [`JOURNEY_ANIMATION_CONTRACT.md`](JOURNEY_ANIMATION_CONTRACT.md).
- Physical iOS performance workflow: [`IOS_LIVE_PERFORMANCE_INVESTIGATION.md`](IOS_LIVE_PERFORMANCE_INVESTIGATION.md).
- Interactive phone-to-web debugging workflow: [`LIVE_DEBUG_WORKFLOW.md`](LIVE_DEBUG_WORKFLOW.md). `http://localhost:5174` is the authoritative Stack to Six web test server. For live captures, say **KRENI** only after the exact app console is connected, retain all user problem markers until **GOTOVO**, validate the fix on web first, and install on the phone only after explicit web approval.

Journey Worlds hub and an individual Journey world are different surfaces. Every Journey Worlds hub entry starts at the absolute top, including returns from Forest/Beach/Area 55; the user scrolls the hub manually from there. Auto-scroll to an active interim card belongs only to individual Forest/Beach/Area 55 screens.

## Engineering guardrails

- Inspect `git status` before editing. Preserve unrelated uncommitted user changes.
- Fix the owning module, not a duplicate CSS/timeout workaround.
- Keep Arcade and Journey behavior explicitly scoped through the existing run-mode source of truth.
- Every GSAP/Pixi ticker, timeline, listener, timer, particle container, or temporary sprite needs an interruption and cleanup path.
- Do not destroy shared Pixi textures from a local effect.
- Validate proportionally: targeted tests where logic changes, then type-check and production build when practical.
- Never claim a phone has the latest change merely because web build passed; verify sync, final `.app`, install result, and launched bundle separately.
- Run `npm run qa:gameplay-lock` for gameplay changes and gameplay-adjacent legacy cleanup. Do not add a second decision owner for final merge, end-game, active-tile filtering, input gating or run origin.
- Assets are intentionally excluded from the current cleanup program. Do not optimize, deduplicate, rename, relocate, replace or delete them without a later explicit user request.
