# Wild/Special runtime and gameplay-boundary review

Date: 2026-09-16. User requested another general optimization/stability review including new animated Wild/Special dice. This is a bounded source and executable-regression review, not a claim that software cannot fail or that phone thermals are proven.

## Reviewed ownership

- Current renderer/preload map: Juice, Ball, Star, Robo, Mushroom use the shared Pixi sheet owner; Barrel retains its authored frame/rest player with a shared-resource lease; Flower uses one small source texture and procedural transforms; Fish retains the iOS HEVC/direct-SVG media bridge.
- Shared resources are not decoded per tile; live copies keep independent phases. Mobile settled Pixi cadence is 30fps and activity leases restore 60fps without a second RAF owner. Active resources cannot be evicted by idle cache policy.
- Reviewed cold/late load, variant invalidation, destroyed tile/base/host, drag/fallback continuity, shared ticker disposal, terminal residual hiding, hidden/background media and native media fallback completion.
- Gameplay decisions, saves, rewards, authored art/timings and assets remain protected. Broad deterministic Gameplay KING tests cover the locked behavior; source review is not an exhaustive playthrough of all possible board states.

## Proven findings

### Invalid late loads retained controllers before any ticker existed

Actual transpiled shared-sheet and Flower owners were started with deferred asset loads. The tile became ineligible before load resolution. Both retained one not-ready, undisposed controller with zero ticker callbacks; the shared sheet retained one reference, preventing eviction. No future frame existed to run ordinary invalid-owner cleanup. Evidence: `/tmp/special-animation-stale-mount.cjs`.

Repair: validate tile, base, host and eligibility at load completion, dispose invalid owners immediately, and keep fallback/normal active rendering intact. Durable regressions cover four invalidation variants for both renderers.

### Terminal residual cleanup omitted special-specific owners

The actual terminal helper and Kanta owner retained one controller, one bubble ticker and one registered infinite timeline until eventual tile removal. Ordinary removal already cleaned up; the proven defect is the residual-handoff window, not evidence of an indefinite per-level leak. Evidence: `/tmp/residual-owner-audit.test.ts`.

The repair retires special idle owners after a residual is hidden, while preserving visible artwork through its accepted pop-out. Five durable runtime regressions cover this boundary. Do not indiscriminately swap a still-visible animated die to its static fallback.

### Fish obsolete media completion could expose an unloaded fallback

When video error selected SVG fallback, the old video play promise could later resolve and mark the controller ready before the SVG image loaded. Evidence: `/tmp/fish-late-media-ready.cjs`. Media callbacks now verify they still own the active rendering mode and generation; the static artwork remains visible until the replacement is ready. Error/fallback hides the complete subtree immediately, even with no subsequent Pixi tick.

### Fish hidden media continued work

Hiding a DOM bridge does not itself pause a video. The shared layer now publishes suspension to media owners and uses display:none for hidden roots, preventing explicitly visible descendants from escaping. Fish pauses for hidden canvas/tile, drag and document background, then resumes the same video without resetting its playhead. The document listener is removed with the last layer owner. Tests exercise actual Fish and layer owners, including background suspension without a Pixi tick. Direct SVG fallback has no native pause API through img; its remaining WebKit work is not claimed eliminated by hiding, and stays a physical measurement concern.

## Limits and acceptance

A source fix or passing tests do not establish superior subjective flow, zero risk, sustained FPS, actual GPU/RSS, battery use or thermal brightness behavior. Verify the natural cold load → multiple specials → drag/merge → final result → next level/return sequence, with background/resume and repeated route changes, in a sustained physical iPhone 13 blue run after explicit web approval. No asset changes, native sync or installation in this pass. Final gates and delivery state are recorded in CURRENT_HANDOFF.md.

## Final verification

- `qa:fast`: PASS, 8 gates / 95 suites / 842 tests.
- `qa:full`: PASS, 13 gates / 314 suites / 2064 tests; Gameplay KING 24 suites / 305 tests, TypeScript/unused/lint, source-only production build, package audit and native-source guard included.
- Focused Fish tests additionally assert static fallback and display:none immediately on media/SVG error without another frame.
- `git diff --check` passes; no asset diff. Local dist refreshed. Localhost returns HTTP 200 with current Fish suspension/generation source. No browser-automation or physical-playthrough claim; that surface was unavailable.
- Logs: `/tmp/wild-special-focused.log`, `/tmp/wild-special-fast.log`, `/tmp/wild-special-full.log`.
- Deterministic verdict **PASS**. Actual long-session iPhone FPS/thermal/visual/audio/touch behavior remains **NEEDS PHYSICAL TEST**. Native Web.bundle, final installed app and phone remain unchanged.
