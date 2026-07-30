# Stack to Six QA contract

## Verdicts

- `PASS`: every selected deterministic gate passed and no unresolved high- or medium-severity finding remains.
- `FAIL`: a command, invariant, acceptance criterion, or regression check failed.
- `NEEDS PHYSICAL TEST`: code and deterministic gates pass, but animation feel, haptics, touch behavior, sustained FPS, memory growth, or native lifecycle still requires the physical iPhone 13 blue.

Never turn `NEEDS PHYSICAL TEST` into `PASS` without performing that test.

## Coverage boundaries

Automated gates can verify types, lint, unit tests, production build, asset completeness, native identity, source/bundle freshness, forbidden legacy paths, and static viewport contracts.

Physical QA remains authoritative for animation quality, clipping at real safe areas, haptics, multi-touch, audio timing, WebView lifecycle, heat, sustained FPS, and memory behavior.

## Independent reviewer checklist

1. Read the raw diff and changed call sites.
2. Check lifecycle ownership and cleanup for timers, GSAP, PIXI, listeners, particles, and cached state.
3. Check both Journey and Arcade when shared gameplay code changed.
4. Check fresh install, tutorial completion, navigation return, and final-merge ordering when those flows are affected.
5. Confirm native operations target only Stack to Six.
6. Report findings first, ordered by severity, then the exact verdict.
