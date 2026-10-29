# Native Journey card identity audit — 2026-10-27

Scope: all 30 Journey slots, card titles, authored artwork selection, unlock copy and open/Play destinations. Existing slot-to-art ordering is preserved. No artwork bytes changed by this task.

## Resolution — 2026-10-29

User explicitly authorizes fixing the single wrong Legendary @2x asset. Restored `assets/colelctibles/Area55/legendary/01-gold@2x.png` byte-for-byte from `f23d6864`; correct BIBI-RIBI, 1032×1528, SHA256 `3669d2656cd231e48f43fcff0860de045b7bb339eebb44dd143f90dd938724ad`. Previous wrong PEEKABOO bytes retained at `/tmp/bibi-ribi-restore-20261029/previous-peekaboo-under-01-gold@2x.png`. No other source asset or slot/name/routing changed. Fresh Vision OCR of all120canonical variants now matches120/120; `/tmp/bibi-ribi-restored-ocr.json` and `/tmp/bibi-ribi-restore-20261029/artwork-audit.json`. Historical findings below describe the pre-restoration audit, not the current asset.

## Findings and correction

Seven stale titles in `NativeJourneyContent.cardNamesByArt` now match their artwork: Forest 03 Flower Day, Forest 07 Pooof, Forest 08 CHAAARGE!, Beach 08 Fly Away, Area 55 06 Peekaboo, Area 55 07 Hello, Goo!, Area 55 09 Bloob Spill. Reveal subtitles and accessibility consume this shared identity source. Beach 06 Bonkers remains correct: COCO-LOCO is the separate Coconut animation caption.

Vision OCR of the bottom title banner across all 120 canonical PNG variants (30 cards × common/legendary × 1x/2x), with visual inspection of the seven renamed cards and the mismatch, found 119 matching titles and one wrong original asset:

- `assets/colelctibles/Area55/legendary/01-gold@2x.png` contains PEEKABOO, while card 01 and its other three variants are BIBI-RIBI.
- Current file: 516×764, SHA-256 `bc548bd2d471bfe03ed4fbcb9cfc154637ad451396977260e77eeb13e28e8e74`.
- Correct original exists at `f23d6864:assets/colelctibles/Area55/legendary/01-gold@2x.png` (1032×1528); recovered for review to `/tmp/area55-01-original-gold2x.png` only.
- Original asset remains untouched under the explicit asset-preservation order in `GAMEPLAY_KING_CONTRACT.md`, section 3. Overall artwork identity verdict: **FAIL — this single asset still requires explicit authorization to restore**.

## Canonical progression

| World | Slot | Authored art | Title |
|---|---:|---:|---|
| Forest | 01 | 03 | Weee - Beee |
| Forest | 02 | 01 | Star Is Out |
| Forest | 03 | 09 | Flower Day |
| Forest | 04 | 04 | Honey Splat |
| Forest | 05 | 05 | Dreamy |
| Forest | 06 | 06 | Shroomy |
| Forest | 07 | 07 | Pooof |
| Forest | 08 | 08 | CHAAARGE! |
| Forest | 09 | 02 | Flying Tent |
| Forest | 10 | 10 | Winner |
| Beach | 01 | 02 | Fresh Juice |
| Beach | 02 | 01 | Fishy |
| Beach | 03 | 03 | Bouncy Day |
| Beach | 04 | 04 | Bottle Tips |
| Beach | 05 | 06 | Castle Ruins |
| Beach | 06 | 05 | Bonkers |
| Beach | 07 | 07 | Looky Here |
| Beach | 08 | 09 | Fly Away |
| Beach | 09 | 08 | The Letter |
| Beach | 10 | 10 | Life Saver |
| Area 55 | 01 | 01 | Bibi - Ribi |
| Area 55 | 02 | 04 | The Bloob |
| Area 55 | 03 | 03 | Woombuu |
| Area 55 | 04 | 02 | Zap - Zap |
| Area 55 | 05 | 05 | Beam Up |
| Area 55 | 06 | 06 | Peekaboo |
| Area 55 | 07 | 07 | Hello, Goo! |
| Area 55 | 08 | 08 | Transport |
| Area 55 | 09 | 09 | Bloob Spill |
| Area 55 | 10 | 10 | Take Over |

## Verification

- State-package regression covers all 30 names and 120 generated paths across rarity/density: PASS (`/tmp/card-title-state-after.log`).
- `qa:fast`, `qa:full`, `qa:ios`: PASS (logs `/tmp/card-title-audit-{fast,full,ios}.log`).
- Mounted Simulator test opens and closes all 30 unlocked cards and invokes their actual Play CTA, checking the captured destination board ID: PASS (74.947 seconds). Reward copy/oracle test: PASS. Log `/tmp/card-title-audit-sdk.log`. Retained normal-app preview is recorded in CURRENT_HANDOFF.md.
- OCR evidence `/tmp/card-title-ocr.json`; mismatch summary `/tmp/card-title-artwork-audit.json`; visual review sheet `/tmp/card-titles-changed.png`.
