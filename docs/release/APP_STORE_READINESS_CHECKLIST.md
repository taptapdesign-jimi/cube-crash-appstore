# App Store Readiness Checklist

This checklist is written to be followed top to bottom. Each item should be checked off with an owner and date.

---

## 1) Build + Package Health

- [ ] Clean install: `npm ci` (or fresh `npm install`) succeeds on a clean machine.
- [ ] Type check passes: `npm run type-check`.
- [ ] Lint passes with zero warnings: `npm run lint`.
- [ ] Tests pass: `npm run test:ci`.
- [ ] Deterministic web/release QA passes: `npm run qa:full`.
- [ ] The complete `dist/` tree is explicitly synced only to the Stack to Six `Web.bundle`, following `docs/engineering/dev-production-modes.md`.
- [ ] Read-only native audit passes after that sync: `npm run qa:ios`.
- [ ] Xcode archive succeeds with no warnings or errors.
- [ ] No debug flags, dev servers, or mock data in production build.

---

## 2) Performance & Stability

- [ ] Cold start under target time on a mid-range iPhone.
- [ ] No memory spikes during:
  - [ ] first launch
  - [ ] board start
  - [ ] endgame sequence
  - [ ] return to menu
- [ ] No FPS drops below target during heavy effects (merge, magnet, bubbles).
- [ ] No main-thread long tasks > 50ms during gameplay.
- [ ] No texture leaks after multiple rounds (memory stable over 5+ runs).
- [ ] Object pools are used for particle-heavy effects.

---

## 3) App Store Compliance

- [ ] No console logging in production builds.
- [ ] No debug UI visible in production.
- [ ] No external URLs or dev-only endpoints.
- [ ] Privacy policy link present and working.
- [ ] App permissions are minimal and justified.
- [ ] No tracking without explicit user consent.

---

## 4) UI/UX Quality

- [ ] All buttons and gestures respond correctly.
- [ ] Pause/resume/restart/exit flows work reliably.
- [ ] Error states show a clear, friendly message.
- [ ] Loading states visible and not frozen.
- [ ] Animations are consistent and not jarring.
- [ ] No visual flicker on splash or transitions.

---

## 5) Gameplay Integrity

- [ ] Endgame logic never fails early (no false fail screens).
- [ ] Wild/magnet edge cases behave correctly.
- [ ] Save/restore works for all supported boards.
- [ ] No stuck states when moves are available.
- [ ] No duplicate spawns or invalid tile states.

---

## 6) Asset & Resource Hygiene

- [ ] Only required assets are preloaded.
- [ ] Large PNGs compressed and sized correctly.
- [ ] Texture atlas usage is optimized.
- [ ] Audio files are sized and encoded for mobile.
- [ ] Fonts are bundled correctly and render as expected.

---

## 7) Observability & Diagnostics

- [ ] A lightweight performance monitor can be enabled in dev.
- [ ] Crash reporting enabled (if used).
- [ ] Errors are logged with actionable context.
- [ ] Analytics events are correct and not spammy.

---

## 8) Store Metadata

- [ ] App name, subtitle, and description finalized.
- [ ] Screenshots up to date and match current UI.
- [ ] App icon and launch screens correct.
- [ ] Version and build numbers incremented.
- [ ] Review notes prepared (if special login/flow exists).

---

## 9) Final Sign-off

- [ ] QA checklist passed.
- [ ] Performance sign-off on iPhone low/mid/high tiers.
- [ ] App Store reviewer test plan prepared.
- [ ] Release candidate tagged in git.
