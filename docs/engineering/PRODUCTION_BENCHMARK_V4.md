# Production Benchmark v4

Date: 2026-09-18

## Identity

- Product: Stack to Six
- Source version: `2.0.653`
- Canonical branch: `main`
- Immutable tag: `production-benchmark-v4`
- Previous approved benchmark: `production-benchmark-v3`
- Native state: source/local-dist checkpoint only; no Stack to Six native bundle
  sync, Xcode build, device install or launch belongs to this promotion.

## Complete change record

This benchmark captures the complete working tree requested by the user. Git is
the authoritative path-level inventory; the sections below record the behavior,
ownership and validation meaning of those files.

### Gameplay, save and lifecycle stability

- Repaired Arcade continuation input ownership, stale terminal finalizers, HUD
  exit activity ownership, cold launch routing, saved-board generation, write
  deduplication and fallback entry behavior.
- Added board cube tracking, play-time tracking, runtime transition sampling,
  native memory-pressure cleanup, object-pool cleanup and bounded recovery paths.
- Preserved gameplay merge, drag, Wild reward and no-moves ownership contracts,
  with expanded KING coverage for repeated boot, resume and interrupted flows.
- Removed the obsolete `fx-special-effects.ts` owner after its live behavior and
  call sites were migrated and audited.

### Journey and navigation

- Stabilized Journey prepaint, outgoing cleanup, retained incoming subtrees,
  card flip/recoil ownership, freely scrollable return behavior, World/Hub
  preparation and first-touch focus handling.
- Repaired rapid taps on New Reward so reveal/collect cannot strand an invisible
  or untappable card; buffered input is consumed once after reveal ownership.
- Added bounded background preparation, warmup eligibility, queued navigation,
  ambient visibility and diagnostic instrumentation without taking over active
  transition owners.
- Added the background-work contract plus detailed Journey, thermal, CPU,
  memory, animation and live-capture investigation records.

### Area55 and Board Transition

- Shows alien beams on every Area55 Unit, including Units without cards.
- Gives every Unit its own phase and timing while keeping beams continuously
  visible at a soft 50–60% opacity instead of synchronized full flashes.
- Rebuilt Clean Board ship motion as independent buoyant paths in separated
  corridors and retained both Board Transition fighters in the viewport until
  their final one-way exit.
- Added continuous combat hover, bounded bank/scale motion and deterministic
  cleanup while preserving ship assets, scene timing and depth crossovers.

### Special dice and visual presentation

- Extended shared Pixi special-artwork ownership, warmup eligibility, idle
  eviction, hidden-work suspension, texture health, foreground depth and hard
  reset protection across all registered families.
- Moved Wild Star orbiting baby stars in front of the animated Wild Star using
  the existing HUD foreground while preserving the original orbit container,
  timing, opacity and cleanup.
- Matched Fish idle bubbles to Ball bubble color and circle treatment while
  retaining Fish foreground, drag and media lifecycle ownership.
- Spread Juice cup, lid and straw across distant randomized lanes with shuffled
  launch order, delay and speed so they no longer travel as a cluster.
- Removed the LaserGun centre-screen SVG/video energy owner while retaining
  guns, beams, impacts, ZAP timing and the original source assets.
- Preserved and expanded Barrel, Flower, Mushroom, Robo, Juice, Beach Ball,
  Wild Star, TNT, Fish, Honey, Bottle, Kanta and carrier foreground contracts.
- Softened the shared merge-6 replacement pop-in and repaired Clean Board Star
  exit continuity by handing the rendered transform pose directly to GSAP.

### Kanta and other audio

- Added the original Kanta merge-6 foundation plus `tup`, `spacesound`, `bibis`
  and `kanta4`; removed `horn` from active playback while preserving its file.
- Final Kanta action gains are bibis 50%, spacesound 80%, kanta4 90%, tup 100%.
  Bibis fades during the final 0.5 seconds of its scene.
- Each exiting can independently selects `kanta1`, `kanta2` or `kanta3` once at
  its real exit start. Robo walking starts one `hodanje.wav` voice at 50% and
  fades it during the final 0.5 seconds, with interruption-safe cleanup.
- Retained feature-specific Bottle, Honey, Flower, Ball, Robo, Magnet, Forest,
  Board Transition, card-reveal and soundtrack routing; added native/web audio
  clock recovery, volume and warmup coverage.
- Includes every supplied Kanta and card-reveal sound asset unchanged, together
  with the updated Stack to Six sound inventory.

### Performance, diagnostics and QA

- Added startup dependency, special-dice performance and native-source audits;
  special-dice ownership records now block missing runtime/performance contracts.
- Expanded deterministic coverage for lifecycle cleanup, hidden work, GPU/media
  retirement, thermal isolation, long-session sampling, navigation preparation,
  sound fallback and exact animation ownership.
- Recorded all related engineering investigations, physical-capture evidence,
  unresolved physical limits and current handoff state in the repository.
- The benchmark requires a clean `npm run qa:full` result before its tag is
  created. The final gate and test totals are recorded in `CURRENT_HANDOFF.md`
  and the annotated Git tag message.

## Acceptance boundary

This tag is the immutable source recovery point requested on 2026-09-18. Source
behavior and deterministic checks may pass while presentation on the physical
iPhone remains unverified. The benchmark therefore does not claim new physical
acceptance for animation feel, speaker balance, touch latency, thermals, battery
or sustained FPS, and it does not replace the separately recorded installed-app
identity.
