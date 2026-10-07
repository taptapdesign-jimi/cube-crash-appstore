# Native mobile CTA and modal drag audit — 2026-10-07

Reference: immutable `journey-fluidity-v10` (`8e4364e8`), `src/styles/cta-system.css`, Home slider styles, Journey card styles and `modal-vertical-drag-dismiss.ts`. Scope: separate Native phone presentation; original assets and PWA bundle preserved.

| Surface | v10 mobile CTA | Native result |
|---|---|---|
| Home Journey / Arcade / Settings | centered 226 × 64 | already matches; existing authored hero-relative position preserved |
| Forest / Beach / Area55 Journey card back | centered 226 × 64, bottom56px | already matches; independent card drag/flip owner preserved |
| Exit Game / Exit Stage, both actions | centered249 ×64,16px gap | corrected from paper-width-minus48; first top184px, second264px, bottom36px preserved |
| Settings / Privacy | no primary CTA; authored controls, link and Close | no width replacement |
| Remaining web result/reward/tutorial/detail surfaces | surface-specific v10 CTA rules | `cta-system.css` has no diff against v10; no global width override introduced |

Exit and Privacy now share nonlinear edge resistance: available viewport distance ×0.7 travel limit, raw force ×0.72, displacement `limit*force/(limit+force)`. Vertical-only admission,96px raw dismissal,1.15-degree tilt and finite280ms cubic(0.34,1.56,0.64,1) snapback. Canonical exit receives the painted release Y/tilt. Background, rejection and disposal cancel owned gesture/return work. UIKit tests cover320/390/430px CTA geometry, diminishing resistance, spring curve, single dismissal, preserved release pose, rejected input and idempotent disposal.

Validation: selected native EndRun/Settings UIKit13 tests PASS (`/tmp/native-cta-drag-uikit.log`). Full deterministic QA18 gates PASS (`/tmp/native-cta-drag-full.log`), including gameplay lock and feature admission. Physical feel remains NEEDS PHYSICAL TEST. No phone installation performed by this task.
