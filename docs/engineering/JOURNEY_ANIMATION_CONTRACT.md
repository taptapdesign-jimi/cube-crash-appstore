# Journey Animation Contract

This document defines what the user means by **enter animation**, **exit animation**, and **cjelina / Unit** when discussing the Journey screen. Treat these values and lifecycle rules as the project benchmark unless the user explicitly requests a different motion.

## VS Code Codex Handoff

Use this section as the compact handoff when continuing the project in VS Code Codex.

Project/context:

- Repo: `/Users/user/cube-crash`
- Current Journey branch: `feature/v700-journey-hub`
- Last named stable animation anchors: **v701** for world-screen Units, **v702** for Homepage-to-Journey-Worlds visible enter, **v706** for shared Journey navigation tap/exit behavior.
- The iOS app is **Stack to Six**, not Kockice Crash. Do not uninstall the app from the phone unless the user explicitly asks; reinstall over the existing app so the user does not need to trust the developer profile again.

Primary files:

- `src/modules/journey-boards-manager.ts` — Journey hub/world rendering, world-screen content, Forest/Beach/Area 55 Units, card modal flow, board-game return flow, Journey-specific nav.
- `src/collectibles-manager.ts` — Journey screen show/hide, Homepage handoff, Journey hub back flow, generic collectibles/detail integration.
- `src/ui/collectibles-animations.ts` — Journey viewport enter/exit animation, cleanup locks, Homepage transition coordination.
- `src/collectibles-screen.css` — Journey hub/world/nav/modal styles and positions.
- `src/modules/journey-v700-motion.ts` — shared motion profile for V700 Journey movement.
- `src/utils/nav-icon-bounce.ts` — shared cartoon tap bounce for every Journey X/back/nav icon. Reuse this; do not create duplicate tap-bounce helpers.

Build/install commands:

```bash
npm run type-check
npm run build
xcodebuild -project "/Users/user/Stack to Six/Stack to Six.xcodeproj" -scheme "Stack to Six" -configuration Debug -destination 'id=0F62B71E-0B04-53C3-906E-EC28F5D2390B' build
xcrun devicectl device install app --device 0F62B71E-0B04-53C3-906E-EC28F5D2390B "/Users/user/Library/Developer/Xcode/DerivedData/Stack_to_Six-ecsveioqnzuvvgcxshslsqgqdbhc/Build/Products/Debug-iphoneos/Stack to Six.app"
```

Validation rule: run `npm run type-check` for TypeScript changes and `npm run build` for CSS/runtime/bundle changes. Commit/push only when the user asks.

User vocabulary:

- **cjelina / Unit** means the complete visual group, not one DOM element. For board areas this means island, clouds behind it, stars, stump, card/number/badge, smoke/shards if active, and related decorative pieces.
- **enter animation** means fast cartoon bounce-in from hidden/smaller state with a tiny sequential offset. It must not be one instant all-at-once reveal, and it must not have long slow delays.
- **exit animation** means fast cartoon bounce-out/scale-in as one coordinated lifecycle. Navigation exits with the content, not after the content.
- **benchmark** means copy the timing/lifecycle behavior, not only approximate the CSS transform.

Do not regress these rules:

- No 1-frame flashes. Prime elements into hidden start state before making a screen visible.
- No opacity fade-out before card scale-in visually completes. The tapped card should read as scaling into itself; opacity can be finalized at the end for cleanup.
- No clouds in front of Journey worlds. World clouds belong behind the world and should follow the same active/inactive state as their world.
- No drag-to-open bug. Vertical dragging over a Journey world must scroll/overshoot, not open the world.
- Preserve springy drag/overshoot on Journey Worlds and Forest/Beach/Area 55 world screens.
- Preserve scroll interactivity after returning from card modal or board game.
- Avoid old/new animation conflicts. Before adding a helper, search existing helpers/classes/listeners and remove or reuse stale paths.

Journey hub layout notes:

- Hub world positions are controlled in `src/collectibles-screen.css` by `.journey-v700-world-forest`, `.journey-v700-world-beach`, and `.journey-v700-world-robo`.
- Hub clouds are created near `renderJourneyV700Hub` in `src/modules/journey-boards-manager.ts`.
- Current cloud-to-world mapping is by Y position: top clouds belong to Forest, middle to Beach, bottom to Area 55. Locked/inactive clouds use `.journey-v700-world-cloud.is-locked`.

Navigation rules:

- Every Journey X/back/nav tap should call `playNavIconCartoonBounce(...)` from `src/utils/nav-icon-bounce.ts`.
- Forest/Beach/Area 55 screen nav, Journey Worlds nav, and card-modal nav should use the same cartoon tap feeling.
- Nav/header exit starts immediately with the relevant content exit. Do not leave header/nav visible while content waits to begin exit.
- Card modal X/header exit should begin immediately on X tap, not after the card/stat content has mostly finished exiting.

## Standard Journey Worlds Enter

Context: **Homepage slider → Journey Worlds hub**.

Order: **Forest → Beach → Area 55** (top to bottom).

Each World Unit starts at:

```ts
{
  opacity: 0,
  scale: 0.65,
  y: 30,
}
```

Each World Unit animates to:

```ts
{
  opacity: 1,
  scale: 1,
  y: 0,
  duration: 0.56,
  ease: 'back.out(1.8)',
}
```

Timing:

```ts
baseDelay = 0.08;
stagger = 0.09;
```

Lifecycle requirement: background preparation may render the Hub, but it must not consume the visible enter animation. Immediately before the Journey viewport begins its real visible enter, prime all three World Units into the hidden start state. Start the World cascade in that same visible-enter lifecycle. Idle may begin only after all three World Units complete.

## Standard Journey Worlds Exit

Context: **Journey Worlds hub → Homepage slider**.

Order: **Area 55 → Beach → Forest** (bottom to top).

Each World Unit animates from its idle/base state to:

```ts
{
  opacity: 0,
  scale: 0.65,
  y: 28,
  duration: 0.48,
  ease: 'back.in(1.25)',
}
```

Timing:

```ts
baseDelay = 0;
stagger = 0.065;
```

Lifecycle requirement: stop idle first, complete the entire reverse cascade, and only then switch to the Homepage slider and clean up the Journey state.

## Meaning of Cjelina / Unit

A **cjelina** is one logical visual object whose internal pieces animate together.

For a Journey World hub item, the World image and its clouds form one Unit.

For a Forest, Beach, or Area 55 board-area item, one Unit includes:

- the floating-island PNG;
- stump;
- left, center, and right stars when present;
- card or locked number;
- clouds belonging to that board area.

There is no stagger between pieces inside one Unit. They share the same enter start, exit start, vertical idle offset, and lifecycle. Clouds may additionally drift horizontally during idle.

## Standard Journey Card Tap Exit

Context: tapping either a regular unlocked card or the interim card inside Forest, Beach, or Area 55.

Both card types use the same shared V625-style animation before modal/game navigation:

```ts
// Punch
{
  scale: 1.12,
  opacity: 1,
  duration: 0.10,
  ease: 'back.out(2.4)',
}

// Exit
{
  scale: 0,
  opacity: 1, // keep visible during scale-in; final cleanup may set opacity: 0 after scale completes
  duration: 0.40,
  ease: 'back.in(1.7)',
}
```

Lifecycle requirement: lock duplicate input, stop the card idle animation, play the shared punch-and-shrink exit with its smoke feedback, then continue the existing Unit/World exit. The card must visibly scale into itself; do not fade it away halfway through the shrink. Open the regular-card detail modal or continue the interim game only after the Journey exit promise completes. On interruption, resolve the handoff and remove animation ownership flags so navigation cannot deadlock.

## Replication Rule

When the user says **replicate the standard enter/exit**, preserve all of the following:

- start and end transforms;
- `back.out` enter and `back.in` exit easing;
- enter and exit ordering;
- short stagger timing;
- Unit grouping with no internal stagger;
- correct visible-screen lifecycle trigger;
- idle only after enter completes;
- navigation only after exit completes;
- identical tapped-card exit for regular and interim cards;
- tween cleanup and no duplicate lifecycle runs.

Benchmarks: **v701** defines the accepted World-screen Unit behavior; **v702** defines the accepted Homepage-to-Journey-Worlds visible enter lifecycle.
