# Animated Special Artwork Playbook

This playbook records the accepted integration pattern for animated board artwork such as `juice-bounce.svg`. It is a repeatable procedure, not permission to replace gameplay rules, special-die identities, or existing assets.

## Canonical reference

The first proven implementation is the generic core Juice die:

- asset: `assets/shop/juice/juice-bounce.svg`;
- artwork/lifecycle owner: `src/modules/juice-bounce-artwork.ts`;
- idle start, stop, and drag handoff: `src/modules/special-dice-idle.ts`;
- existing Juice bubble owner: `startWildJuiceBubbles()` in `src/modules/fx.ts`;
- browser-image prewarm: `src/utils/comprehensive-image-preloader.ts`;
- focused contract: `src/modules/__tests__/juice-bounce-artwork.test.ts`.

The SVG remains a directly mounted DOM `<img>`. Do not turn a live SMIL SVG into a Pixi texture or draw it into a canvas: iOS Simulator Safari proved that direct image playback remains animated while canvas sampling freezes the sampled frame.

## Before adding another animated die

Record this manifest before editing code:

| Field | Required answer |
| --- | --- |
| Player-facing die | Exact special/variant name |
| Gameplay archetype | Existing registry archetype; visuals must not change it |
| Asset URL and format | SVG, image sequence, animated WebP, or another supplied format |
| Authored stage | Exact `viewBox` or pixel dimensions |
| Resting artwork bounds | Centre, width, and height inside the authored stage |
| Motion corridor | Maximum bounds used by every frame, including jumps and particles |
| Board footprint | Usually the existing 128x128 die footprint |
| Eligibility predicate | Exact tile/variant match and explicit exclusions |
| Fallback | Existing proven static Pixi artwork |
| Depth contract | What is behind art, above art, and above a dragged die |
| Runtime owner | Existing Pixi ticker, GSAP timeline, or other canonical owner |
| Cleanup boundary | Stop, tile destruction, restart, route exit, and runtime teardown |
| Physical acceptance | Device, scenario, duration, FPS/thermal observations |

Do not infer resting bounds from the full SVG stage. Transparent motion space is normally much taller than the resting die. Measure the visible resting art and preserve the complete motion corridor separately.

## Choose the rendering path

Use the narrowest path compatible with the supplied asset:

1. Use a normal Pixi sprite or frame sequence when Pixi can paint every authored frame correctly.
2. Use a direct DOM `<img>` bridge for a self-animating SVG only when live SVG playback must remain under WebKit ownership.
3. Do not add a second Pixi `Application`, ticker, perpetual `requestAnimationFrame`, or duplicate GSAP timeline.
4. Do not add a DOM bridge merely to solve z-order inside Pixi. Use Pixi hierarchy first when all participants are Pixi objects.

The Juice bridge exists because the live SVG and Pixi canvas require different renderers. It is not the default for every new animation.

## Implementation contract

### 1. Preserve identity and gameplay

- Match only the intended visual variant.
- Resolve registry-backed variants before claiming a generic archetype.
- Keep drag, merge, value, input, final-merge, save/load, and Journey/Arcade behavior unchanged.
- Never rename, replace, optimize, or delete supplied or fallback assets under the Gameplay KING asset-preservation order.

For Juice, `isPlainJuiceBounceTile()` accepts only generic `special === 'wild-juice'` with no registered variant. Mushroom, Robo Cube, and every other Juice-archetype visual remain excluded.

### 2. Keep one lifecycle owner

- Create at most one controller per live tile and make repeated `start` calls idempotent.
- Attach all controllers to one shared callback on `STATE.app.ticker`.
- Capture every value that the controller temporarily changes.
- On stop or invalid ownership, remove DOM nodes, listeners, callbacks, and controller references, then restore the captured Pixi fallback state.
- Detach the shared ticker and remove the overlay root when the last controller is gone.

The lifecycle must tolerate tile destruction, interrupted drag, restart, route exit, app teardown, and a failed or late asset load.

### 3. Keep the fallback visible until success

- Create the animated image while the existing Pixi art is still visible.
- Hide the fallback only from the image's successful `load` callback and only if the original tile still owns the controller.
- On load failure, keep the fallback visible and hide the incomplete DOM owner.
- On cleanup, restore the fallback to its captured `renderable` value rather than assuming `true`.

This prevents a blank die during slow loading, bundle mistakes, WebKit decode failure, or stale callbacks.

### 4. Map Pixi space to DOM space

- Follow the tile's real transform owner, normally `tile.rotG || tile`.
- Use its current `worldTransform`, the renderer screen dimensions, and the canvas bounding rectangle.
- Convert the authored resting-art centre into the DOM wrapper anchor.
- Propagate the complete parent-chain visibility and multiplied alpha.
- Run the DOM sync after Pixi's transform/render update so drag does not visibly trail by one frame.
- Keep the wrapper non-interactive: `pointer-events:none`, empty alt text, and `aria-hidden=true`.

Do not position the overlay from grid coordinates or stale tile coordinates; drag, board scaling, shake, and parent transforms would diverge.

### 5. Define layer ownership explicitly

For each implementation, record the complete stack instead of relying on incidental DOM order.

The current Juice stack is:

1. static Pixi fallback while the SVG is loading;
2. live SVG image at local DOM z-index `1`;
3. redirected idle bubbles at local DOM z-index `2`;
4. dragged Juice wrapper at z-index `12001`, one step above the canonical Pixi drag layer `12000`.

If an existing Pixi effect must paint above a DOM asset, keep its existing emitter/tweens as the only motion owner. Mirror only its current paint state into bounded DOM nodes, disable the duplicate Pixi paint while bridged, and restore the original Pixi `renderable` state during cleanup.

The shared direct-DOM SVG root normally paints above the transparent Pixi canvas. Every accepted merge-6 finale family must acquire the reference-counted finale-depth lease from `animated-special-artwork-layer.ts` before its first finale paint. While at least one lease is live, the complete SVG root sits one stacking level below the canvas, so Pixi particles, debris and characters cross in front of every SVG die. Normal completion, interruption, replacement and failure cleanup must release the lease; only the last release restores the root above the canvas. Do not replace this shared ownership with per-die z-index exceptions or an unowned timeout.

Active drag uses the same central depth boundary without pausing unrelated board animation. The reference-counted gameplay drag foreground owner raises the Pixi canvas above the DOM HUD and publishes the active tile's exact client-space bounds once per owned drag frame. The shared idle-SVG root stays live above the canvas, so every non-dragged Juice, Ball, Star, Robo, Mushroom and Flower keeps its authored SMIL/foreground animation. Only when one SVG wrapper's actual rendered DOM bounds overlap the dragged tile does that controller hide the wrapper and restore its captured Pixi PNG fallback; the fallback is then below the tile inside Pixi's `GAMEPLAY_DRAG_OVERLAY`. Leaving the overlap restores the same live SVG without resetting its phase. A wrapper belonging to a live dragged SVG is still portalled into the sibling `animated-special-artwork-drag-layer`; variants with an accepted PNG-on-drag contract stay hidden only for their own drag. Every direct-SVG controller must call `setAnimatedSpecialArtworkDragging()` from its existing `setSpecialDiceIdleDragging()` route and use `doesAnimatedSpecialArtworkOverlapGameplayDrag()` for the non-owner collision fallback. A real pointer owner also outranks any stale overlapping finale-depth lease. Opt-in `window.__ccDragDepthDiagnostics=true` emits transition-only `[CC_DRAG_DEPTH]` evidence for the canvas, both roots and live wrapper count.

### 6. Prewarm through the correct loader

- A direct DOM image belongs in the browser-image preload path.
- Do not decode a DOM-only animated SVG into the Pixi texture cache.
- Keep preload and displayed URLs identical.
- When multiple live copies of the same self-animating SVG are possible, the
  shared `animated-svg-phase-scheduler.ts` may append only its bounded
  `cc-svg-phase` cache-identity query. This is the one exception to byte-for-byte
  URL identity: it gives WebKit a separate SMIL clock per active copy while the
  base asset path and preloaded bytes remain unchanged.
- Verify the raw asset is copied into `dist/assets` and, during a later native delivery, the authoritative Stack to Six `Web.bundle`.

### 7. Integrate with the established idle contract

Connect the new visual owner through `startSpecialDiceIdleMotion()`, `stopSpecialDiceIdleMotion()`, and `setSpecialDiceIdleDragging()` rather than inventing parallel tile lifecycle hooks. Drag may keep an accepted idle animation running, but it must use the same controller and must not restart the asset.

## Focused test checklist

Every new animated-board-art implementation must prove:

- exact resting-art dimensions map to the intended board footprint;
- the crop retains the complete rest art and full motion corridor;
- the supplied asset contains the expected animation mechanism;
- eligibility accepts the intended die and rejects every adjacent registry variant;
- repeated start calls return one owner;
- successful load hides the fallback;
- failed or absent load leaves the fallback visible;
- drag uses the intended foreground layer and release restores normal depth;
- another die's drag leaves this idle SVG live until their rendered bounds overlap, exposes exactly one Pixi fallback only during that overlap, and restores the same live SVG phase after separation;
- optional foreground FX paint above the artwork without duplicate rendering;
- stop, destruction, and global teardown restore state and leave zero controllers/tickers/overlay roots;
- a late `load` callback cannot resurrect a disposed owner.
- the first live copy of a direct-SVG family uses SVG; every additional Wild
  Star also uses SVG, while later copies in the other families keep one
  lifetime-stable 50/50 choice between the original Pixi PNG and SVG;
- every duplicate that selects SVG reserves a distinct phase slot, starts on a
  different clock, and cancels its pending stagger during cleanup;
- PNG-selected duplicates preserve that decision through drag and release it
  only at tile stop/destruction or family runtime teardown.

Run focused tests first. Because this touches board visuals and tile lifecycle, then run `npm run qa:gameplay-lock`, `npm run qa:fast`, and `npm run qa:full` before release handoff. Use `npm run qa:ios` before any native build or install.

## iOS visual and performance acceptance

Simulator WebKit compatibility is necessary but does not close the physical test. On `iPhone 13 blue`, verify at minimum:

1. cold load and fallback handoff;
2. idle playback for five minutes;
3. drag above every ordinary and special die, including rapid direction changes;
4. release, invalid-drop snap-back, valid stack, merge, and tile removal;
5. multiple simultaneous eligible dice when the game can create them;
6. gameplay exit/re-entry, restart, background/foreground, and device rotation if supported;
7. no retained overlay, bubble, ticker, or invisible hit target after cleanup;
8. perceived cadence, sustained FPS, memory trend, and thermal state.

Record source QA, local WebKit proof, `dist`, `Web.bundle`, final app, installed app, and physical acceptance separately. Until the physical pass is observed, report animation feel and sustained mobile performance as `NEEDS PHYSICAL TEST`.

## Asset and runtime budget record

For every candidate, record raw size, transfer-like compressed size, embedded raster dimensions, number of animation nodes, and maximum concurrent DOM/Pixi objects. Useful read-only checks include:

```bash
stat -f '%z %N' path/to/asset
gzip -c path/to/asset | wc -c
sips -g pixelWidth -g pixelHeight path/to/fallback.png
rg -o '<animateTransform|<animate[ >]|<image[ >]' path/to/asset | sort | uniq -c
```

The current optimized Juice reference is 205,685 bytes raw, 149,928 bytes with deterministic gzip (`-9 -n`), embeds the same 384x384 PNG, and contains 1 `<animate>` plus 9 `<animateTransform>` nodes. Six simultaneous instances therefore expose 60 SMIL animation nodes instead of the original 510. The internal fizz groups were intentionally removed while the established external Juice bubble owner remains unchanged. Direct Safari/WKWebView playback and sustained six-instance performance still require physical verification.

The current Beach Ball asset is 179,826 bytes raw, 126,511 bytes with deterministic gzip (`-9 -n`), embeds one 368x368 PNG, and contains 3 `<animateTransform>` nodes. Its calibrated resting ball maps to the existing 128px board footprint while the complete 390x440 motion stage remains available for the bounce, squash, spin and shadow. `ball-bouncy-artwork.ts` is an exact `beach-ball`-only lifecycle owner; the preceding GSAP Ball bounce is not allowed to run beside the SVG. Its idle composition is offset 56 local pixels downward: the preceding 16px calibration plus the requested additional 40px. The established Juice-style Pixi bubble system remains the only emitter/tween owner, while the Ball bridge mirrors its paint at local DOM z-index 2 above the SVG at 1. Mirrored bubbles receive an exact -56px local compensation, so the wrapper's artwork-only lowering cancels out and their world-space origin stays at the canonical static PNG position. Pointer acquisition synchronously hides the SVG, releases the paint bridge and reveals the existing `ball.png`; pointer release returns through the same controller without restarting the asset. Direct Safari/WKWebView playback, full motion clearance, perceived ground alignment and renderer swap still require physical verification.

The generic Wild Star uses only `star.svg` through `wild-star-bouncy-artwork.ts`. The restored supplied file is 231,632 bytes raw, SHA-256 `62f2b0b6730a377c98dd03375d1997c9fd14c335aef8aae1dd3bbe8499f808bd`, contains 28 `<animate>` and 34 `<animateTransform>` nodes on one two-second loop, and embeds the preserved `wild@3x.png`. Its authored `0 0 520 560` stage places the 432-unit image inside `translate(260 465) scale(.85)`; runtime maps that effective 367.2-unit resting canvas exactly to the established 128px PNG board footprint while retaining the complete bounce, squeeze, shine and sparkle corridor. The original Pixi orbit system is restored for the surrounding one-to-three baby stars and remains the sole owner of their randomized count, direction, radius, pulse, rotation, intro bounce and merge-to-HUD state. Because the direct-DOM Star sits above the Pixi canvas, the same artwork controller mirrors only each live Pixi star's current paint with the existing `small-star.png` density set in a local z-index-2 layer above `star.svg`; it adds no second motion clock, ticker or emitter. Pixi paint is disabled only after every corresponding foreground image is load-ready, and is restored on a pending/failed image, orbit replacement, SVG failure, stop or teardown. `stars.svg` and `slow-star.svg` are preserved in the asset folder but have no gameplay runtime or preload reference. The superseded separate Pixi shimmer is not started for this exact generic tile. Registry variants remain excluded. Direct Safari/WKWebView playback, exact perceived size, orbit depth, additive-blend appearance, the SVG-to-HUD flight handoff and sustained multi-instance performance still require physical verification.

The Robo Cube uses `robo-bouncy.svg` through the exact `robo-cube`-only `robo-bouncy-artwork.ts` owner. Its authored 256-unit resting composition at centre `(195,239)` maps to the existing 128px board footprint while retaining the complete 390x440 bounce/rotation stage. The supplied file is 831,834 bytes raw / 620,358 bytes with deterministic gzip (`-9 -n`), contains 15 `<animate>` plus 4 `<animateTransform>` nodes on a 2.4-second loop, and embeds fourteen losslessly compressed PNG pose sources: seven 128x128 sources plus seven larger sources between 256x256 and 256x294. The former GSAP four-frame crossfade and antenna-trail idle do not run behind the SVG. The registry PNG remains visible until successful SVG load and on any load failure; pointer acquisition immediately returns paint to the established static second Robo frame, and release resumes the same SVG controller. Finale assets retain their bounded three-at-a-time warmup without becoming part of the idle render owner. Six simultaneous Robo instances expose 114 SMIL nodes, so direct Safari/WKWebView fidelity, decoded-memory behavior, sustained FPS and thermal state remain required physical checks.

The Mushroom uses `mushroom.svg` through the exact `mushroom`-only `mushroom-bouncy-artwork.ts` owner. Its authored viewBox is `-26 -34 180 180`; the original 128x128 resting die canvas centred at `(64,64)` maps one-to-one onto the existing 128px board footprint while the complete 180x180 jump/rotation corridor remains available. The supplied file is 731,369 bytes raw / 512,515 bytes with deterministic gzip (`-9 -n`), SHA-256 `b09ab5d29a5d8df42985c28b9f0bb9da2ab390a7661272f11e9773561bed1a26`, contains 10 `<animate>` plus 34 `<animateTransform>` nodes on one two-second loop, and embeds two 448x448 PNG sources. The SVG replaces only the former GSAP Mushroom pop/squash transform; the established three-puff Pixi smoke remains its sole smoke motion owner. The registry `mushroom.png` remains visible through the bounded phase wait, load failure and drag; drag pauses and hides the smoke, then release resumes the same SVG controller and smoke master without restarting either owner. Six simultaneous Mushroom instances expose 264 SMIL nodes, so direct Safari/WKWebView fidelity, decoded-memory behavior, sustained FPS and thermal state remain required physical checks.

The Flower uses `flower.svg` through the exact `flower`-only `flower-bouncy-artwork.ts` owner while retaining Wild TNT gameplay and its existing Pixi pollen emitter. The authored `0 0 160 160` stage places a 108.36-unit resting image canvas at centre `(79.33,74.78)`; that canvas scales to the established 128px board footprint while the complete 160x160 hop/tilt corridor remains available. The supplied file is 772,783 bytes raw / 531,173 bytes with deterministic gzip (`-9 -n`), SHA-256 `85c49c63a0d7ef4bbb520873719d698e221607995cdaf5fd66c221e05cb37830`, contains three `<animateTransform>` nodes on one 1.6-second loop, and embeds one 2048x2048 PNG source. The existing pooled Pixi pollen system remains the only emitter/timeline/motion owner, but each live grain records its authored ellipse, polygon or double-ellipse paint geometry. While the SVG is active, `flower-bouncy-artwork.ts` redirects only that live paint into a local DOM foreground layer at z-index 2 above the image at 1; its shared ticker reads the particle's current position, rotation, scale and alpha, so no second animation clock is introduced. Drag, SVG failure, stop and teardown synchronously remove the mirror and restore each original particle's Pixi `renderable` state before pool release. The registry `flower.png` remains visible through the bounded phase wait, load failure and drag; release resumes the same SVG controller without changing Flower merge-6. Six simultaneous Flower instances expose 18 SMIL nodes, but direct Safari/WKWebView fidelity, pollen depth, the large embedded raster's decoded-memory cost, sustained FPS and thermal state remain required physical checks.

All seven direct animated-artwork owners (Juice, Beach Ball, Wild Star, Fish, Robo Cube, Mushroom and Flower)
use one shared visual-mode owner plus one shared phase scheduler. The first live
copy of each family always uses SVG and starts immediately. Every additional
Wild Star and Fish also stay animated; their separately reserved phases ensure
that their loops do not share the first copy's start or end. Fish uses the same
phase lifecycle for its iOS HEVC proxy and its SVG fallback. Additional tiles
in the other families make one 50/50 choice for their complete tile lifetime:
retain the original Pixi PNG, or use SVG. SVG-selected duplicates reserve the lowest
free cache-identity slot and a different start clock, targeting at least one
twelfth of the asset loop between nearby starts (minimum 100ms, maximum
one-second fallback wait). The existing static Pixi artwork remains visible
during that bounded wait. PNG-selected duplicates never create a DOM image or
phase lease, and pointer acquisition does not reroll their choice. If removal
leaves only PNG copies, the next arriving same-family tile is forced to SVG.
Each Wild Star reserves one phase lease for `star.svg`; each Fish reserves one
phase lease for its `fish.svg` or iOS HEVC timeline. The restored baby-star orbit
keeps the established Pixi motion clock and is therefore outside the SMIL phase scheduler. Tile stop,
restart, route teardown and late-load cleanup release the slot and cancel
pending work; family runtime teardown also clears every retained PNG/SVG mode
assignment.

## When to extract a shared adapter

Do not copy `juice-bounce-artwork.ts` and rename symbols. Each animated asset should begin as a small dedicated owner following this contract. Juice and the Beach Ball candidate share only `animated-special-artwork-layer.ts`, because a single overlay/ticker owner is required for correct cross-special depth and drag ordering. Keep geometry, eligibility, fallback and special-specific cleanup in their dedicated owners until two implementations are physically accepted. Only then consider extracting the remaining common DOM/Pixi bridge behind a typed profile similar to:

```ts
type AnimatedSpecialArtworkProfile = {
  id: string;
  assetUrl: string;
  viewBox: { width: number; height: number };
  crop: { x: number; y: number; width: number; height: number };
  restArt: { centerX: number; centerY: number; width: number; height: number };
  displaySize: number;
  dragZIndex: number;
  matches(tile: unknown): boolean;
};
```

Keep eligibility, optional foreground-effect bridging, and special-specific cleanup outside the generic geometry renderer. This avoids a universal runtime that silently changes unrelated special dice.
