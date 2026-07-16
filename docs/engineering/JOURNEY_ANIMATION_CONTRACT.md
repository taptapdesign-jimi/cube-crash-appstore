# Journey Animation Contract

This document defines what the user means by **enter animation**, **exit animation**, and **cjelina / Unit** when discussing the Journey screen. Treat these values and lifecycle rules as the project benchmark unless the user explicitly requests a different motion.

## Standard Journey Worlds Enter

Context: **Homepage slider → Journey Worlds hub**.

Order: **Forest → Beach → Area 51** (top to bottom).

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

Order: **Area 51 → Beach → Forest** (bottom to top).

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

For a Forest, Beach, or Area 51 board-area item, one Unit includes:

- the floating-island PNG;
- stump;
- left, center, and right stars when present;
- card or locked number;
- clouds belonging to that board area.

There is no stagger between pieces inside one Unit. They share the same enter start, exit start, vertical idle offset, and lifecycle. Clouds may additionally drift horizontally during idle.

## Standard Journey Card Tap Exit

Context: tapping either a regular unlocked card or the interim card inside Forest, Beach, or Area 51.

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
  opacity: 0,
  duration: 0.24,
  ease: 'back.in(1.7)',
}
```

Lifecycle requirement: lock duplicate input, stop the card idle animation, play the shared punch-and-shrink exit with its smoke feedback, then continue the existing Unit/World exit. Open the regular-card detail modal or continue the interim game only after the Journey exit promise completes. On interruption, resolve the handoff and remove animation ownership flags so navigation cannot deadlock.

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
