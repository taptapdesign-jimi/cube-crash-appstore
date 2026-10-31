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
- Journey card-modal Play, Continue, X/Close, backdrop, Escape and a committed
  vertical drag (up or down) from the white stats/CTA face own a visible return flip before the
  Unit landing. A stats/back-facing card keeps the canonical half-turn; other
  artwork/front exits keep their full turn so they land on artwork. The flip
  flight remains marked as an active physical flip for WebKit face painting.
  A committed vertical drag (up or down) from the artwork/front face is the explicit exception:
  it travels to the same live Unit with its illustration facing forward for
  the whole flight, with no flip or `cardflip` image. At return-flight start it
  plays the existing single manual `flip soft.wav` whoosh, then uses the
  established landing and cleanup owners.
- Every Native Journey gameplay return to its World — Clean Board, Fail, and deliberate Exit Stage — runs the existing automatic return flip on the exact Unit that was played, once per accepted return. Ordinary World/Backpack navigation does not replay it. Existing Reduced Motion policy remains.
- Automatic native post-game return flip leaves visible Unit/cloud/ambient motion running. Its depth9 carrier inherits the exact source Unit compositor wave clock; completion must not stop/restart the World idle owner. Modal card presentation keeps its existing pause policy while open. On an accepted return flight, resume the exact paused Unit/cloud/ambient clocks immediately; sample the live Unit wave into the finite card flight so it lands without restarting or freezing the World idle owner. Background still pauses both owners.
- Keep the automatic post-game return reminder attached to its exact live Unit while the World screen scrolls. Launch, outbound flip, return and landing impact must all inherit the Unit's live viewport displacement, and the reminder must scroll out of view with that Unit instead of floating above unrelated content. Scrolling never blocks or recentres the player. An accepted World X/back action atomically cancels both a visible reminder and any still-waiting reminder receipt before World-to-Hub exit paint, so no reminder layer may survive onto Journey Worlds.
- Avoid old/new animation conflicts. Before adding a helper, search existing helpers/classes/listeners and remove or reuse stale paths.

Journey hub layout notes:

- Hub world positions are controlled in `src/collectibles-screen.css` by `.journey-v700-world-forest`, `.journey-v700-world-beach`, and `.journey-v700-world-robo`.
- Hub clouds are created near `renderJourneyV700Hub` in `src/modules/journey-boards-manager.ts`.
- Current cloud-to-world mapping is by Y position: top clouds belong to Forest, middle to Area 55, bottom to Beach. Locked/inactive clouds use `.journey-v700-world-cloud.is-locked`.

Navigation rules:

- Native Journey Hub Back and Forest/Beach/Area 55 X accept the first tap
  during incoming motion or inner presentation work (2026-10-07 user request).
  Stable 44pt navigation hit targets remain independent of animated headers and
  gated content. Hub Back also supersedes an outgoing World preparation: cancel
  its canonical request before starting Home, invalidate native receipts, and
  retarget from the painted pose. World X preempts incoming/card presentation
  work, cancels the return reminder, and exits from the painted pose. Retired
  callbacks cannot reveal a destination or unlock input; duplicates of the
  accepted return are inert. Already dispatched canonical gameplay is protected.
  Back receipt validation accepts the exact current `entering` or `active`
  World identity; it must not require the completed input-admission receipt.
  Hidden, parked, foreign, stale and replayed requests remain rejected.
  Body/card/scroll admission keeps its existing gate. Individual web World X
  retains its v10 policy: accept one request during enter and flush it when that
  World's enter completes.
- Every Journey X/back/nav tap should call `playNavIconCartoonBounce(...)` from `src/utils/nav-icon-bounce.ts`.
- Forest/Beach/Area 55 screen nav, Journey Worlds nav, and card-modal nav should use the same cartoon tap feeling.
- Nav/header exit starts immediately with the relevant content exit. Do not leave header/nav visible while content waits to begin exit.
- Native navigation's underside shadow begins its 160ms ease-out fade 200ms after the header bounce-out starts (Reduced Motion retains its 100ms hold plus 60ms fade). Keep the rectangle's existing motion; the same route group owns shadow pause/cancellation, and entry restores the accepted static shadow.
- Card modal X/header exit should begin immediately on X tap, not after the card/stat content has mostly finished exiting.
- An accepted ordinary Unit-card tap starts its portaled flight immediately, matching the preserved PWA (user2026-10-30 correction). No complete 0.40s resident-contact prefix before flight. One carrier owns the original PWA 520/0.98ms spatial path, overshoot/settle and rotor turn during32–68% of that same flight; the existing finite animation-start receipt owns its flip cue. Native flight and rotor must both use commit-relative beginTime=0, never an earlier absolute rotor timestamp: first32% stays front-facing, physical edge at50%, turn complete at68% of the same rendered flight. Star/input admission follows this opening timeline. Interim contact/launch remains unchanged; Reduced Motion retains its short entry. Exact 2x artwork, modal chrome decode, and front/back prepaint must never gate the first visible motion; the already-painted 1x World card is the entry carrier.
- Card-modal pointerdown and ordinary Common-card flip handoff are write-only: they
  sample the active WAAPI owner's cached pose and must not call computed-style,
  geometry or layout APIs. Ordinary flips remain compositor-owned without a
  per-frame JavaScript observer. Legendary may retain its bounded RAF shine/face
  observer because that authored holographic layer depends on the live angle;
  its RAF must stop on completion, interruption and cleanup.

For Forest, Beach and Area 55 X-to-Journey-Worlds exits, the active World's
large top main artwork exits first with the complete canonical Cartoon Bounce:
`1 -> 1.18/1.15 -> 0` over `0.234s + 0.4368s`, using the shared transform origin
and easing with no neutral frame or dwell. This is 30% longer than its preceding
`0.18s + 0.336s` main-image timing and applies only to the main image.
Its main clouds and all board-area Units keep their existing gentle World-exit
motion and cascade. Reduced Motion keeps the pre-existing non-bounce exit.

## Named Reusable Effect: Cartoon Bounce Enter

When the user asks for **Cartoon Bounce Enter**, reuse the exported
`JOURNEY_WORLD_CARTOON_BOUNCE_ENTER` preset from `journey-v700-motion.ts`.
For an accepted Journey World activation, the complete World Unit immediately
inflates to `scaleX: 1.18 / scaleY: 1.15` over `0.15s` with `power2.in` around
the stable `50% 54%` pivot. At that exact peak, without a settle, rebound,
neutral frame or dwell, it continues into a `0.28s` `back.in(1.7)` exit to
scale zero. The name refers to the complete continuous `0.43s` motion.

The accepted tap schedules the authored exit synchronously. The route then
reuses the most recent World or prepares only its selected cold destination in
bounded, cancellable turns concurrent with outgoing motion. A cold destination
remains detached until the atomic post-exit commit; preparation never exposes a
full-alpha screen. Homepage admission depends on the Hub's own images, not on
building Forest, Beach and Area 55. The stage retains one Hub and at most one
World; a different cold destination releases the previous inactive World first.
The manager owns quiescence, hidden enter poses and reactivation; the stage owns
generation-checked node transfer. Memory pressure releases optional resources,
not the accepted destination or the World parked by gameplay, and never leaves
Hub buttons permanently disabled. Full cleanup releases every retained surface.
DOM identity reuse is not a guarantee of browser GPU residency. Cold readiness
and first-painted-frame latency must still be measured on the phone.
Preserve the existing input guard, interruption
completion and opacity-through-collapse. The non-selected Worlds use the same
two-leg collapse timeline as the Back-to-Homepage Worlds, including the 20%
reduced `1.144 / 1.12` inflate peak, while the selected World retains the full
canonical `1.18 / 1.15` peak.

For a Homepage slider route activation, the large hero uses the **selected Hub
World activation motion** (click Forest/Beach/Area 55 to enter that World).
This is the user's explicit final reference, superseding the tutorial-thumb
comparison and the earlier independent inflate/hold experiments.

Use `JOURNEY_WORLD_CARTOON_BOUNCE_ENTER` with
`getJourneyV700HubWorldExitDuration`: **1 → 1.18/1.15 over180ms power2.in**, then
**peak → 0 over336ms back.in(1.7)**, around **50% 54%**. Reduced Motion uses the
same duration selection as the World owner. The scale path, including its
natural anticipation, must match both World legs exactly. One compositor
animation holds all three keyframes, with no callback handoff, extra pulse or
invented pause. The World screen itself is unchanged.

The surrounding controls retain their preceding150ms lead plus per-part
stagger, existing460ms exit and individual curves. Image and CTA activation
converge on the same `animateSliderExit()` owner. Cleanup happens only after
Homepage is hidden. The scale curve is compared against actual GSAP evaluation
of the World preset, including its duration helper.

## Standard Journey Worlds Enter

Context: **Homepage slider → Journey Worlds hub**.

Order: **Forest → Area 55 → Beach** (top to bottom).

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

Lifecycle requirement: background preparation may render the Hub, but it must not consume the visible enter animation. Immediately before the Journey viewport begins its real visible enter, prime all three World Units into the hidden start state. Start the World cascade in that same visible-enter lifecycle. The common scroll ancestor stays at its neutral transform; the outer World cards are the only owners of the standard enter transform. Banner reveal may start on the first real World tween, but nested World/cloud and banner idle animation is admitted atomically only after every World/cloud enter target settles. The single visible-enter completion boundary then unlocks scrolling and input. For an individual Forest/Beach/Area 55 screen, animate only complete Units inside or near the initial scroll viewport; settle farther offscreen Units before the visible frame and admit their idle only when the shared viewport observer sees them. The initially visible Units join the shared idle owner immediately after the complete visible cascade so settled transforms never compete with later enter transforms. Idle uses a short seamless ramp and must not introduce a separate delayed timer.

**Main-art exception (2026-10-05, explicit user request):** inside an individual
World, only the largest main artwork starts gentle upward idle immediately after
its own enter completes. It uses the same coordinator ticker and 520ms onset
envelope, and is not restarted at cascade completion. Main clouds, cards and
all other Units retain full-cascade admission and their existing motion.

Hub/World preparation must not perform per-target computed-style or GSAP transform
hydration after the accepted navigation tap. Newly built or retained Units receive
their known hidden start poses through one bounded write-only preparation owner;
authored rotation and percentage translation remain intact. A separate foreground
presentation lease stays active through the complete incoming Hub/World cascade,
not merely until its first visible tween, so optional decode, eviction, prepaint and
hidden-renderer work cannot compete with the display-cadence GSAP frames. This
lease must never wake a hidden Pixi ticker and must release on completion,
replacement, interruption and manager cleanup.

Individual World enter resolves its short Unit cascade over the full World
before viewport filtering. Raw sequential board-ID hashes can differ by less
than a millisecond (Area 55 21–30), accidentally starting all visible Units in
one paint frame. Collision normalization preserves their deterministic order
inside the existing 35–220ms offset window, keeps main artwork at zero and
retains explicit returning-card offsets. Cold and terminal entry use the same
resolved slots; terminal entry removes only the first lead-in. The 560ms bounce,
easing, Unit grouping and Hub's separate 80/90ms schedule remain unchanged.

## Standard Journey Worlds Exit

Context: **Journey Worlds hub → Homepage slider**.

Order on Back to Homepage: shuffle the visible complete Worlds once per accepted
Back action, then start them one by one with a **0.045s** stagger. The order may
therefore be Forest → Beach → Area 55 or another permutation, but the Worlds
must never start simultaneously and the full three-World start window remains
under `0.10s`.

Each standard exiting World Unit—including every Back-to-Homepage World and
every non-selected World during Hub→World activation—uses the complete
canonical Cartoon Bounce timeline, with only its inflate displacement reduced
by 20%. It inflates around `50% 54%` to
`scaleX: 1.144 / scaleY: 1.12` over `0.18s` with `power2.in`, then continues
from that peak directly to `scaleX: 0 / scaleY: 0` over `0.336s` with
`back.in(1.7)`. These two Hub-owned legs are 20% longer than the reusable
`0.15s / 0.28s` preset so their tempo matches the gentler individual-World
X-to-Hub reference. Opacity remains `1` through the collapse and the
card hides only on completion. There is no neutral frame, fade, old `0.65`
endpoint or dwell between the two legs. A World and its owned clouds remain
one Unit. Hub→World selection keeps its full `1.18 / 1.15` inflate and uses
the same `0.18s / 0.336s` Hub exit timing. Reduced Motion retains the original
unscaled timing.

The Hub cloud layer and navigation retain their surrounding structural exit:

```ts
{
  opacity: 0,
  scale: 0.65,
  y: 28,
  duration: 0.48,
  ease: 'back.in(1.25)',
}
```

Base exit timing after the per-World Cartoon Bounce:

```ts
baseDelay = 0;
backToHomepageStagger = 0.045;
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
- idle begins at the earliest transform-safe handoff: nested Hub visuals during parent enter, and each individual World Unit immediately after its own enter settles;
- navigation only after exit completes;
- identical tapped-card exit for regular and interim cards;
- tween cleanup and no duplicate lifecycle runs.

Benchmarks: **v701** defines the accepted World-screen Unit behavior; **v702** defines the accepted Homepage-to-Journey-Worlds visible enter lifecycle.

## Terminal result to Journey handoff (2026-09-20)

Clean Board and Fail exit choreography, durations, last-element completion and
board-exit ownership are explicitly accepted and must remain unchanged. Prepare
the owning World while the result exits, including ordinary non-interim Journey
returns. Only that result transaction's completed visual exit may release the
immediate World reveal through the normal authoritative navigation route.

After result completion, do not add two reveal RAF waits, the World's initial
80ms lead-in, or an opacity fade on the entire Journey shell. The already-primed
Units retain their exact enter duration, curve, relative cascade spacing and
input/idle cleanup; their first Unit starts at timeline zero. Cold entry,
Worlds-to-World, World-to-Worlds and card-modal returns keep standard timing.
Cancelled/replaced result or navigation ownership cannot reveal a stale World.
Physical first-painted-frame latency remains a device measurement, separate
from JavaScript/tween-start timing.

Fail, Clean Board and manual Exit Game use the same token-owned return readiness.
Gameplay parks its World; return reconciles changed card Units and prepares the
authored hidden pose once. Adopting a ready return does not traverse/decode all
World images again or require three full-alpha paint frames. Preparation cannot
write root visibility. Manual Exit Game retains board-exit completion ownership
but does not add the generic non-Journey two-frame/settle delay.

## Native main illustration opposite motion (2026-10-20)

The main illustration in each individual World moves opposite to the first two
complete Units on one shared vertical idle clock. This supersedes the earlier
main-art upward-direction exception only; keep its early enter-to-idle admission.
Use a continuous onset from the painted pose, retain the clock across admission,
shift it with modal pause/resume, and reuse it on viewport reentry. Main clouds,
other Units, enter/exit curves and existing visibility/cleanup remain unchanged.

## Native Journey World contact addition — 2026-10-20

Accepted World selection composes the shared0.40s Cartoon Bounce on its artwork child, beneath the existing idle and complete Unit route exit. Preserve the current exit timings, destination preparation overlap and actual-completion input gate. Start only after successful destination preparation admission; hide, detach and route reset remove contact. No added wait or recurring owner. This explicit user addition supersedes the prior Native single-pulse restriction; the authored Unit exit remains unchanged.

The same approved contact also composes on all three Arcade island artwork shells and Home slider hero shells, retaining their original contact/idle/route transforms and completion gates. Interim Unit gameplay launch multiplies the shared recipe into its existing inflate/collapse samples under one card transform owner; it does not replace card rotation or introduce a delay. Hidden/background/reset paths retire finite contacts.

## Native interim gameplay contact continuity (2026-10-22)

Explicit user update applies globally to Forest, Beach and Area55. Interim
card contact locks card/scroll input immediately but keeps the existing visible
World idle/ambient clocks running during the unchanged0.10s punch+0.40s collapse.
Only the selected card's interim effect retires before its contact transform.
World exit then transfers the painted pose into its existing finite tracks;
child cloud/beam poses use a finite1s compositor bridge until their parent hides;
the actual World exit completion explicitly removes the remaining bridges.
This supersedes stopping the whole World idle at the interim tap. Regular modal
pause policy,card choreography,route completion and Reduced Motion stay intact.
No new recurring clock,decode work or persistent pose mutation. Background,
park,replacement and cleanup retire the bridges through existing World ownership.


Native Journey info statistics (user2026-10-30): face flip is admitted only by horizontal drag/swipe; tapping blank/artwork is not a flip gesture. High score/Best combo tile taps use shared finite navigation contact and open Top3 result history. Retained info card exits on v10 modal planes, preserves its star/idle phase while covered, then resumes through v10 entry on detail close. Detail shows greatest3 values with dates from at most10 canonical records per metric/board. Legacy best dates remain unknown rather than fabricated. Existing Play/Continue, vertical dismissal and automatic post-game return semantics remain.

Journey Top3 detail close (latest user2026-10-30): the retained large info card begins its standard return entry at60percent of the detail exit timeline (0.39s of0.65s), overlapping its final40percent. The milestone shares the actual paused compositor clock; no wall-time delay. Reduced Motion returns immediately. Do not wait for dismissal/onClosed or return at close request. Exact selected controller/World identity and duplicate/navigation/disposal guards remain authoritative.

Journey Top3 opening (latest user2026-10-30): present the selected detail at60percent of the source info-card0.65s exit (0.39s), with the final40percent overlapping. Retain one pending selected detail; duplicate/background/navigation/cleanup cannot admit a stale presentation. The source-layer milestone follows its paused compositor clock, Reduced Motion enters immediately. Closing retains the60percent return rule.

Journey info-stat tiles (user2026-10-30): High score and Best combo independently float continuously while the info face is visible, using their existing disjoint tempo/phase profiles with gentle horizontal/vertical translation and tiny lean. This supersedes the three-cycle limit only for whole-tile float. Existing parent pause, flip/exit/cleanup retirement and Reduced Motion remain;finite background-stone breathing and rigid text stay unchanged.


### NEW card opening tilt (user2026-10-30)

For Native Journey selected-card presentation, the effective presentation NEW flag (explicit presentation override, otherwise Unit newRibbon) fixes artwork-face tilt to the existing negative/left direction, keeping NEW at the right edge. The authored4.75–6.25degree magnitude remains random. Without NEW, left/right direction remains random per presentation. Existing opposite info-face tilt, motion tracks, alert ownership, discovery/read state and cleanup remain unchanged.


### Selected info-stat contents (user2026-10-30)

High score and Best combo tile icon+number move4logicalpx toward the caption relative to the prior recipe. Then the combined icon/number/caption frame union is centered vertically inside its unchanged tile bounds;all children remain horizontally centered. Existing independent tile drift/surface breathing,paper art,hitbox and stat-history tap owners remain unchanged.


### All visible paper modals float (user2026-10-30)

Score/Combo history and HUD modals now use the same6.8s JimiNativeModalV10 idle after enter readiness,including Best scores/Best combo. This explicitly supersedes history settled-stillness. Existing Backpack/detail/Arcade/Exit/Privacy and selected Journey card floats remain under their current owners;do not stack a second float. Score modal pauses on existing parent clock for background/covered state,drag pauses its idle subtree,close freezes the painted idle pose before outer exit,and disposal removes its animation. Reduced Motion skips float. No new ticker/timer or asset work.


### Result score counter accent (user2026-10-30)

While the large clean-result score counts through its existing base/combo/efficiency phases,show faint vertical motion-blur trails,a small deterministic shake and warm glow behind the same text. Stop blur/shake outside active counting. Emit one finite glow burst only after the last nonzero phase settles,then leave the text sharp with no glow. Existing result elapsed clock owns all sampling and background pause;close/disposal reset it,Reduced Motion skips it. Do not change any displayed result,count duration,CTA,audio/haptic or saved state.


Result counter refinement(user2026-10-30):remove motion blur during counting. Once entire score finishes,sample exact shared0.4s NativeHUDTapMotion/Settings ON-OFF squash-stretch bounce,with1.5x motion-blur trail strength only over that bounce. Counting shake/glow and final single0.42s glow burst remain;after bounce text returns to identity/sharp. Same result clock,pause/cleanup/Reduced Motion gates,no new scheduler.

User duration refinement2026-10-30:final score bounce lasts0.6s;sample shared0.4s Settings pose with proportional time stretch (same shape/peaks). Motion blur spans only this0.6s bounce;normal Settings timing unchanged.

The final glow burst follows the end of this0.6s bounce (whole text settled),then fades over0.42s;it does not flash early at count completion.


Journey selected-card CTA width(user2026-10-30):Play and Continue share prior min(238*layoutScale,cardWidth-32) width multiplied by0.9 (10percent narrower). Height,vertical position,center,font,artwork/contact/entry/exit and routing stay unchanged;other CTA surfaces keep their existing metrics.


### Arcade selected-island contact with retained screen (user2026-10-31)

User explicitly rejects whole-Worlds exit for Arcade modal opening. Keep the
entire Arcade screen and all Units/header at their original size behind modal.
Only selected island illustration performs a clear stronger cartoon contact:
shared NativeHUDTapMotion phases,1.45x squash/stretch displacement,1.6x lift,
bounded3degree settling lean,0.48s duration. Latest quicker-response request:
Arcade disables scroll touch delay while retaining touchUpInside/drag cancellation.
Stop idle and submit/flush contact immediately on accepted tap,before feedback or
selected modal preparation. Mount/layout selected modal hidden,then precommit
standard entry on contact epoch+0.20s,overlapping the final0.28s (latest user:another200ms earlier);late preparation
enters immediately. Existing opacity fills hold paper/tint hidden until entry. No collapse,
background route exit,extra gentle-scale pulse or percentage delay. Close simply
uncovers retained Hub, preserving scroll and idle phase;Play alone retains
original complete Hub exit. Pending tokens and existing animation key own
background/hide/detach cancellation;Reduced Motion skips contact. Journey and
all original artwork remain unchanged. This supersedes prior2026-10-30 Arcade
whole-Worlds activation interpretation.
