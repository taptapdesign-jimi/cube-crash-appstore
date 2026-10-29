# DESIGN SYSTEM — Stack to Six Native

Visual library: design-library/typography/index.html

## Working agreement

A/B comparison: click a text/marker (or mark action), press Usporedi to pin A, then explicitly choose B in another modal. Navigation alone does not select B. A focused dialog shows real crops, a shared2×font sample, large sizes/colors, differences, context and editable comparison prompt. Each entry also has Usporedi A ↔ B; optional searchable B picker and swap are available.

Navigation categories are collapsible via their headings. Backpack dice details initially shows only the first die; Vidi sve / Prikaži manje expands or reduces the remaining21links.

- Read this file and the measured data before changing typography or CTA styles.
- Display sizes use logical design px: numeric values map 1:1 to UIKit points, not physical screenshot pixels.
- After a requested UI style change, update the Native implementation, capture the affected actual components, regenerate this document, HTML, data and portable ZIP.
- Keep screenshots and measurements in agreement. Do not relabel old images as updated captures.
- Navigation titles: 28 px across Journey, Arcade, Forest, Beach, Area 55, Settings and Backpack. Preserve existing font weights and colors unless asked to change them.
- Stage stats modals across every world and Play/Continue: title 28 px ExtraBold, both numbers 28 px Bold, High score / Longest combo labels 18 px Medium. Sizes stay fixed across compact layouts.
- Arcade mode modal titles: 28 px ExtraBold, #AD8775 across Endurance, One Lucky Drop and Slow Burn.
- Standard body descriptions / subtitles formerly20px now18px across Exit, details, Settings, score/backpack info, tutorial and result labels. Existing weights/colors are preserved; hero/celebration text keeps its separate hierarchy.
- Former 19 px text is standardized to 18 px: Journey world-progress counters and Arcade mode descriptions. Preserve existing font weights and colors.
- All white secondary CTA labels use #BDA08E, Baloo2-ExtraBold28; primary ivory text and button surfaces retain their authored styling.
- Modal titles, subtitles, hero/result headings, numeric statistics and CTA labels are separate roles; compare consistency within the same role.
- Backpack · Kockice details has one clickable actual modal capture for every catalog die: Forest6, Beach6, Area556, Arcade4. Existing Wee Bee reference remains stable.
- Screen examples are controlled production-component snapshots at 390 × 844 logical px; they are not player save screenshots.
- Runtime Swift source is authoritative. This inventory represents the captured states; regenerate affected captures after changes.

Documentation action: screenshot-location buttons use orange #EE8158.

## Pas — pomoćnik na stranici

Otvoriti **Pitaj psa** dolje desno. Odabrani tekst/gumb postaje kontekst za usporedbu sa sličnim ulogama, prikaz razlika i označavanje rezultata. Lokalna usporedba i pretraga veličina rade odmah. Tipkanje i mikrofon služe unosu pitanja; nema čitanja odgovora. Slobodan AI razgovor uključuje se zasebno preko **Spoji AI**. Upute i granice: [ASSISTANT.md](ASSISTANT.md). Pokretanje: `python3 design-library/typography/serve.py --port 8766`.

## Captured typography and CTA inventory

### Home · Journey CTA

Route: Home

Screenshot: [home](../typography/screens/home.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-HOME-01 | Journey · Navigacijski naslov | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 211.78 × 80.64 |

Source: `native/jimi-2026/JimiV9HomeView.swift`

### Exit Stage? · paired actions

Route: Gameplay → X

Screenshot: [exit-stage](../typography/screens/exit-stage.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-EXIT-STAGE-01 | Exit Stage? · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-EXIT-STAGE-02 | Come back anytime. / Stage 7 progress saved. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-EXIT-STAGE-03 | Restart · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 216.2 × 70 |
| STS-EXIT-STAGE-04 | Exit Stage · CTA | Baloo2-ExtraBold | 28 | #BDA08E | 216.2 × 70 |

Source: `native/jimi-2026/JimiNativeEndRunModal.swift`

### Exit Game? · paired actions

Route: Gameplay → X

Screenshot: [exit-game](../typography/screens/exit-game.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-EXIT-GAME-01 | Exit Game? · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-EXIT-GAME-02 | Come back anytime. / Stage 7 progress saved. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-EXIT-GAME-03 | Restart · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 216.2 × 70 |
| STS-EXIT-GAME-04 | Exit Game · CTA | Baloo2-ExtraBold | 28 | #BDA08E | 216.2 × 70 |

Source: `native/jimi-2026/JimiNativeEndRunModal.swift`

### Endurance

Route: Home → Arcade → mode card

Screenshot: [arcade-mode-0](../typography/screens/arcade-mode-0.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-ARCADE-MODE-0-01 | Endurance · Naslov | Baloo2-ExtraBold | 28 | #AD8775 | — |
| STS-ARCADE-MODE-0-02 | Clear rounds and keep going until you run out of moves. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-ARCADE-MODE-0-03 | Play · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 237.3 × 80.64 |

Source: `native/gameplay-app/NativeArcadeHubView.swift`

### One Lucky Drop

Route: Home → Arcade → mode card

Screenshot: [arcade-mode-1](../typography/screens/arcade-mode-1.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-ARCADE-MODE-1-01 | One Lucky Drop · Naslov | Baloo2-ExtraBold | 28 | #AD8775 | — |
| STS-ARCADE-MODE-1-02 | Get one lucky Special die / to help you per round. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-ARCADE-MODE-1-03 | Play · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 237.3 × 80.64 |

Source: `native/gameplay-app/NativeArcadeHubView.swift`

### Slow Burn

Route: Home → Arcade → mode card

Screenshot: [arcade-mode-2](../typography/screens/arcade-mode-2.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-ARCADE-MODE-2-01 | Slow Burn · Naslov | Baloo2-ExtraBold | 28 | #AD8775 | — |
| STS-ARCADE-MODE-2-02 | Special dice take longer to drop onto your board. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-ARCADE-MODE-2-03 | Play · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 237.3 × 80.64 |

Source: `native/gameplay-app/NativeArcadeHubView.swift`

### High score HUD modal

Route: Gameplay → trophy

Screenshot: [score-modal](../typography/screens/score-modal.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-SCORE-MODAL-01 | High Score · Naslov | Baloo2-ExtraBold | 32 | #AD8775 | — |
| STS-SCORE-MODAL-02 | Your best score so far. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-SCORE-MODAL-03 | 0 · Broj / statistika | Baloo2-Bold | 32 | #E8744A | — |
| STS-SCORE-MODAL-04 | High score · Podnaslov / labela | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-app/NativeScoreModal.swift`

### Backpack gameplay modal

Route: Gameplay → Backpack

Screenshot: [backpack-info](../typography/screens/backpack-info.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-BACKPACK-INFO-01 | Backpack · Naslov modala | Baloo2-ExtraBold | 28 | #AD8775 | — |
| STS-BACKPACK-INFO-02 | Forest backpack items / Little wonders, big forest magic! · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-app/NativeScoreOwner.swift`

### Result · Combo bonus

Route: Gameplay → clean result → combo phase

Screenshot: [result-combo](../typography/screens/result-combo.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-RESULT-COMBO-01 | Splendid! · Naslov | Baloo2-ExtraBold | 40 | #B07F69 | — |
| STS-RESULT-COMBO-02 | +30 · Broj / statistika | Baloo2-ExtraBold | 36 | #E77449 | — |
| STS-RESULT-COMBO-03 | Combo bonus · Podnaslov | Baloo2-SemiBold | 18 | #C48A6D | — |
| STS-RESULT-COMBO-04 | Your score · Podnaslov / labela | Baloo2-SemiBold | 18 | #B69077 | — |
| STS-RESULT-COMBO-05 | 42677 · Broj / statistika | Baloo2-ExtraBold | 80 | #E77449 | — |

Source: `native/gameplay-app/NativeResultOwner.swift`

### Result · Efficiency bonus

Route: Gameplay → clean result → efficiency phase

Screenshot: [result-efficiency](../typography/screens/result-efficiency.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-RESULT-EFFICIENCY-01 | Splendid! · Naslov | Baloo2-ExtraBold | 40 | #B07F69 | — |
| STS-RESULT-EFFICIENCY-02 | +547 · Broj / statistika | Baloo2-ExtraBold | 36 | #E77449 | — |
| STS-RESULT-EFFICIENCY-03 | Efficiency · Podnaslov | Baloo2-SemiBold | 18 | #C48A6D | — |
| STS-RESULT-EFFICIENCY-04 | Your score · Podnaslov / labela | Baloo2-SemiBold | 18 | #B69077 | — |
| STS-RESULT-EFFICIENCY-05 | 43587 · Broj / statistika | Baloo2-ExtraBold | 80 | #E77449 | — |

Source: `native/gameplay-app/NativeResultOwner.swift`

### Clean result

Route: Gameplay → cleared → result

Screenshot: [result-clean](../typography/screens/result-clean.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-RESULT-CLEAN-01 | Splendid! · Naslov | Baloo2-ExtraBold | 40 | #B07F69 | — |
| STS-RESULT-CLEAN-02 | Forest 07 cleared · Podnaslov | Baloo2-SemiBold | 18 | #B69077 | — |
| STS-RESULT-CLEAN-03 | Your score · Podnaslov / labela | Baloo2-SemiBold | 18 | #B69077 | — |
| STS-RESULT-CLEAN-04 | 44179 · Broj / statistika | Baloo2-ExtraBold | 80 | #E77449 | — |
| STS-RESULT-CLEAN-05 | Play Again · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 216.2 × 70 |
| STS-RESULT-CLEAN-06 | Exit · CTA | Baloo2-ExtraBold | 28 | #BDA08E | 216.2 × 70 |

Source: `native/gameplay-app/NativeResultOwner.swift`

### Failed result

Route: Gameplay → no moves → result

Screenshot: [result-fail](../typography/screens/result-fail.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-RESULT-FAIL-01 | Nearly! · Naslov | Baloo2-ExtraBold | 56 | #E77449 | — |
| STS-RESULT-FAIL-02 | Forest 07 not cleared · Podnaslov | Baloo2-SemiBold | 18 | #B69077 | — |
| STS-RESULT-FAIL-03 | Play Again · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 216.2 × 70 |
| STS-RESULT-FAIL-04 | Exit · CTA | Baloo2-ExtraBold | 28 | #BDA08E | 216.2 × 70 |

Source: `native/gameplay-app/NativeResultOwner.swift`

### New Reward · interim card

Route: First completed Unit → New Reward

Screenshot: [reward-interim](../typography/screens/reward-interim.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-REWARD-INTERIM-01 | New Reward · Naslov | Baloo2-ExtraBold | 44 | #EF744D | — |
| STS-REWARD-INTERIM-02 | Tap the card to reveal · Podnaslov | Baloo2-SemiBold | 23 | #BD9788 | — |

Source: `native/gameplay-reward/NativeJourneyRewardController.swift`

### Drag to stack · Got it

Route: First play → tutorial sheet

Screenshot: [tutorial](../typography/screens/tutorial.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-TUTORIAL-01 | Drag to stack · Naslov | Baloo2-ExtraBold | 32 | Drag: #E97A55 · to stack: #AD8775 | — |
| STS-TUTORIAL-02 | Drag a dice onto another dice. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-TUTORIAL-03 | Got it · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 127.54 × 80.64 |

Source: `native/gameplay-app/NativeTutorialOverlay.swift`

### CLEARED · animated glyph sizes

Route: Final merge → CLEARED celebration

Screenshot: [cleared-celebration](../typography/screens/cleared-celebration.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-CLEARED-CELEBRATION-01 | C · Naslov | Baloo2-ExtraBold | 75 | #E77449 | — |
| STS-CLEARED-CELEBRATION-02 | L · Naslov | Baloo2-ExtraBold | 97 | #E77449 | — |
| STS-CLEARED-CELEBRATION-03 | E · Naslov | Baloo2-ExtraBold | 35 | #E77449 | — |
| STS-CLEARED-CELEBRATION-04 | A · Naslov | Baloo2-ExtraBold | 71 | #E77449 | — |
| STS-CLEARED-CELEBRATION-05 | R · Naslov | Baloo2-ExtraBold | 35 | #E77449 | — |
| STS-CLEARED-CELEBRATION-06 | E · Naslov | Baloo2-ExtraBold | 97 | #E77449 | — |
| STS-CLEARED-CELEBRATION-07 | D · Naslov | Baloo2-ExtraBold | 97 | #E77449 | — |

Source: `native/gameplay-ui/NativeArcadeRoundPresentation.swift`

### Common reward

Route: New Reward → tap card → unlocked

Screenshot: [reward-common](../typography/screens/reward-common.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-REWARD-COMMON-01 | Common · Naslov | Baloo2-ExtraBold | 44 | #EF744D | — |
| STS-REWARD-COMMON-02 | Unlocked Weee - Beee · Podnaslov / labela | Baloo2-SemiBold | 23 | #BD9788 | — |
| STS-REWARD-COMMON-03 | TAP TO COLLECT · Uputa / interakcija | Baloo2-ExtraBold | 32 | #FFFFFF | — |

Source: `native/gameplay-reward/NativeJourneyRewardController.swift`

### Legendary! reward

Route: New Reward → tap card → unlocked

Screenshot: [reward-legendary](../typography/screens/reward-legendary.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-REWARD-LEGENDARY-01 | Legendary! · Naslov | Baloo2-ExtraBold | 44 | #EF744D | — |
| STS-REWARD-LEGENDARY-02 | Unlocked Weee - Beee · Podnaslov / labela | Baloo2-SemiBold | 23 | #BD9788 | — |
| STS-REWARD-LEGENDARY-03 | TAP TO COLLECT · Uputa / interakcija | Baloo2-ExtraBold | 32 | #FFFFFF | — |

Source: `native/gameplay-reward/NativeJourneyRewardController.swift`

### Gameplay HUD

Route: Journey → Stage 07 → Play

Screenshot: [gameplay-hud](../typography/screens/gameplay-hud.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-GAMEPLAY-HUD-01 | 42179 · Broj / statistika | Baloo2-Bold | 18 | #B58573 | — |
| STS-GAMEPLAY-HUD-02 | x · Opis / pomoćni tekst | Baloo2-Bold | 14 | #E77449 | — |
| STS-GAMEPLAY-HUD-03 | 0 · Broj / statistika | Baloo2-Bold | 18 | #E77449 | — |

Source: `native/gameplay-ui/NativeBoardScene.swift`

### Forest · Wee Bee

Route: Home → Backpack → Forest → Wee Bee

Screenshot: [dice-detail](../typography/screens/dice-detail.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-01 | Wee Bee · Naslov | Baloo2-ExtraBold | 32 | Wee: #E8744A · Bee: #AD8675 | — |
| STS-DICE-DETAIL-02 | Merge me to create the main merge die and 1 bonus die. That makes 2 fresh dice! · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Forest · STAR

Route: Home → Backpack → Forest → STAR

Screenshot: [dice-detail-wild-star](../typography/screens/dice-detail-wild-star.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-WILD-STAR-01 | Star · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-WILD-STAR-02 | Merge me to add 1–3 bonus dice, plus the main merge die. Closed dice appear for later moves. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Forest · Flower

Route: Home → Backpack → Forest → Flower

Screenshot: [dice-detail-flower](../typography/screens/dice-detail-flower.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-FLOWER-01 | Flower · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-FLOWER-02 | Merge me to scatter petals over up to 4 ordinary dice. Each one gets a different number. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Forest · HONEY

Route: Home → Backpack → Forest → HONEY

Screenshot: [dice-detail-honey](../typography/screens/dice-detail-honey.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-HONEY-01 | Honey · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-HONEY-02 | Merge me to scoop up to 4 dice, then return the same number of fresh dice to the board. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Forest · SHROOMY

Route: Home → Backpack → Forest → SHROOMY

Screenshot: [dice-detail-mushroom](../typography/screens/dice-detail-mushroom.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-MUSHROOM-01 | Shroomy · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-MUSHROOM-02 | Sprouts 4–6 bonus dice, plus the main die, and adds 7–9 closed dice when space allows. A rare find! · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Forest · BARREL

Route: Home → Backpack → Forest → BARREL

Screenshot: [dice-detail-barell](../typography/screens/dice-detail-barell.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-BARELL-01 | Barrel · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-BARELL-02 | Merge me to explode across the whole board! Every ordinary die is replaced with a different number. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Beach · JUICE

Route: Home → Backpack → Beach → JUICE

Screenshot: [dice-detail-wild-juice](../typography/screens/dice-detail-wild-juice.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-WILD-JUICE-01 | Juice · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-WILD-JUICE-02 | Merge me to pour a fresh number die onto the board. It appears where the merge happened. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Beach · FISHY

Route: Home → Backpack → Beach → FISHY

Screenshot: [dice-detail-fish](../typography/screens/dice-detail-fish.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-FISH-01 | Fishy · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-FISH-02 | Merge me to bring in 1–3 bonus dice, plus the main merge die. Closed dice appear for later moves. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Beach · BEACH BALL

Route: Home → Backpack → Beach → BEACH BALL

Screenshot: [dice-detail-beach-ball](../typography/screens/dice-detail-beach-ball.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-BEACH-BALL-01 | Beach Ball · Naslov | Baloo2-ExtraBold | 32 | Beach: #E8744A · Ball: #AD8675 | — |
| STS-DICE-DETAIL-BEACH-BALL-02 | Merge me to bounce into up to 4 ordinary dice. Every hit gives that die a different number. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Beach · BOTTLE

Route: Home → Backpack → Beach → BOTTLE

Screenshot: [dice-detail-bottle](../typography/screens/dice-detail-bottle.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-BOTTLE-01 | Bottle · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-BOTTLE-02 | Merge me to wash away up to 4 dice, then bring back the same number of fresh dice. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Beach · COCONUT

Route: Home → Backpack → Beach → COCONUT

Screenshot: [dice-detail-coconut](../typography/screens/dice-detail-coconut.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-COCONUT-01 | Coconut · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-COCONUT-02 | Merge me to shake the palms! Every ordinary die changes to a different number. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Beach · KITE

Route: Home → Backpack → Beach → KITE

Screenshot: [dice-detail-kite](../typography/screens/dice-detail-kite.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-KITE-01 | Kite · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-KITE-02 | Merge me to create the main merge die and 1 bonus die. Fly away! · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Area 55 · BIBI RIBI

Route: Home → Backpack → Area 55 → BIBI RIBI

Screenshot: [dice-detail-robo-cube](../typography/screens/dice-detail-robo-cube.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-ROBO-CUBE-01 | Bibi Ribi · Naslov | Baloo2-ExtraBold | 32 | Bibi: #E8744A · Ribi: #AD8675 | — |
| STS-DICE-DETAIL-ROBO-CUBE-02 | Merge me to build a fresh number die. The new die lands where the merge happened. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Area 55 · BLOOB BUCKET

Route: Home → Backpack → Area 55 → BLOOB BUCKET

Screenshot: [dice-detail-kanta](../typography/screens/dice-detail-kanta.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-KANTA-01 | Bloob Bucket · Naslov | Baloo2-ExtraBold | 32 | Bloob: #E8744A · Bucket: #AD8675 | — |
| STS-DICE-DETAIL-KANTA-02 | Merge me to release 1–3 bonus dice, plus the main merge die. Closed dice appear for later moves. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Area 55 · SPACESHIP

Route: Home → Backpack → Area 55 → SPACESHIP

Screenshot: [dice-detail-spaceship](../typography/screens/dice-detail-spaceship.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-SPACESHIP-01 | Spaceship · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-SPACESHIP-02 | Merge me to beam up to 4 dice aboard, then beam the same number of replacements back down. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Area 55 · LASER GUN

Route: Home → Backpack → Area 55 → LASER GUN

Screenshot: [dice-detail-laser-gun](../typography/screens/dice-detail-laser-gun.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-LASER-GUN-01 | Laser Gun · Naslov | Baloo2-ExtraBold | 32 | Laser: #E8744A · Gun: #AD8675 | — |
| STS-DICE-DETAIL-LASER-GUN-02 | Merge me to shoot up to 4 ordinary dice. Each target stays in place and gets a different number. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Area 55 · BLOOB POD

Route: Home → Backpack → Area 55 → BLOOB POD

Screenshot: [dice-detail-bloob-ball](../typography/screens/dice-detail-bloob-ball.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-BLOOB-BALL-01 | Bloob Pod · Naslov | Baloo2-ExtraBold | 32 | Bloob: #E8744A · Pod: #AD8675 | — |
| STS-DICE-DETAIL-BLOOB-BALL-02 | Gassy fumes sweep the board, changing every ordinary die to a different number! · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Area 55 · BLOOB

Route: Home → Backpack → Area 55 → BLOOB

Screenshot: [dice-detail-bloob](../typography/screens/dice-detail-bloob.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-BLOOB-01 | Bloob · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-BLOOB-02 | Creates 4–6 bonus dice, plus the main die, and adds 7–9 closed dice when space allows. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Arcade · CUBERO

Route: Home → Arcade → Crate → CUBERO

Screenshot: [dice-detail-cubero](../typography/screens/dice-detail-cubero.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-CUBERO-01 | Cubero · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-CUBERO-02 | Merge me to add 1–3 bonus dice, plus the main merge die. Closed dice appear for later moves. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Arcade · BALLOON

Route: Home → Arcade → Crate → BALLOON

Screenshot: [dice-detail-baloon](../typography/screens/dice-detail-baloon.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-BALOON-01 | Balloon · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-BALOON-02 | Merge me to release a fresh number die. I float away as the new die lands. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Arcade · TNT

Route: Home → Arcade → Crate → TNT

Screenshot: [dice-detail-tnt](../typography/screens/dice-detail-tnt.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-TNT-01 | TNT · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-TNT-02 | Merge me to blast up to 4 ordinary dice. Each hit replaces a die with a different number. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Arcade · MAGNET

Route: Home → Arcade → Crate → MAGNET

Screenshot: [dice-detail-wild-magnet](../typography/screens/dice-detail-wild-magnet.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-DICE-DETAIL-WILD-MAGNET-01 | Magnet · Naslov | Baloo2-ExtraBold | 32 | #AD8675 | — |
| STS-DICE-DETAIL-WILD-MAGNET-02 | Merge me to pull in up to 4 dice, then send the same number of replacements back to the board. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |

Source: `native/gameplay-collection/NativeBackpackDetail.swift`

### Great merge · tutorial follow-up

Route: First play → Special merge animation completes

Screenshot: [tutorial-encouragement](../typography/screens/tutorial-encouragement.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-TUTORIAL-ENCOURAGEMENT-01 | Great merge! · Naslov | Baloo2-ExtraBold | 32 | Great: #E97A55 · merge!: #AD8775 | — |
| STS-TUTORIAL-ENCOURAGEMENT-02 | You’re doing great! Keep merging / to clear the board. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-TUTORIAL-ENCOURAGEMENT-03 | Continue · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 208.03 × 80.64 |

Source: `native/gameplay-app/NativeTutorialOverlay.swift`

### Tutorial completed · Arcade

Route: Arcade first play → tutorial cleared → Continue → real round 01

Screenshot: [tutorial-completed](../typography/screens/tutorial-completed.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-TUTORIAL-COMPLETED-01 | Tutorial completed · Naslov | Baloo2-ExtraBold | 44 | #EF744D | — |
| STS-TUTORIAL-COMPLETED-02 | You’re ready to play! · Podnaslov | Baloo2-SemiBold | 23 | #BD9788 | — |
| STS-TUTORIAL-COMPLETED-03 | Continue · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 208.03 × 80.64 |

Source: `native/gameplay-tutorial-complete/NativeTutorialCompleteController.swift`

### Merge dice · Got it

Route: First play → tutorial sheet

Screenshot: [tutorial-merge](../typography/screens/tutorial-merge.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-TUTORIAL-MERGE-01 | Merge dice · Naslov | Baloo2-ExtraBold | 32 | Merge: #E97A55 · dice: #AD8775 | — |
| STS-TUTORIAL-MERGE-02 | Stack the dice to make 6. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-TUTORIAL-MERGE-03 | Got it · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 127.54 × 80.64 |

Source: `native/gameplay-app/NativeTutorialOverlay.swift`

### Special dice · Got it

Route: First play → tutorial sheet

Screenshot: [tutorial-special](../typography/screens/tutorial-special.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-TUTORIAL-SPECIAL-01 | Special dice · Naslov | Baloo2-ExtraBold | 32 | Special: #E97A55 · dice: #AD8775 | — |
| STS-TUTORIAL-SPECIAL-02 | They can merge with any regular / dice to get the value 6 · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-TUTORIAL-SPECIAL-03 | Got it · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 127.54 × 80.64 |

Source: `native/gameplay-app/NativeTutorialOverlay.swift`

### Special Bar · Continue

Route: First play → earned meter guide

Screenshot: [tutorial-special-bar](../typography/screens/tutorial-special-bar.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-TUTORIAL-SPECIAL-BAR-01 | Special Bar · Naslov | Baloo2-ExtraBold | 32 | Special: #E97A55 · Bar: #AD8775 | — |
| STS-TUTORIAL-SPECIAL-BAR-02 | Stack and merge dice to fill the bar and earn special dice. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-TUTORIAL-SPECIAL-BAR-03 | Continue · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 208.03 × 80.64 |

Source: `native/gameplay-app/NativeTutorialOverlay.swift`

### Clear the stage · free movement

Route: First play → Clear the stage

Screenshot: [tutorial-clear](../typography/screens/tutorial-clear.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-TUTORIAL-CLEAR-01 | Clear the stage · Naslov | Baloo2-ExtraBold | 32 | Clear: #E97A55 · the stage: #AD8775 | — |
| STS-TUTORIAL-CLEAR-02 | The whole board is yours. / Stack and merge anywhere. · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-TUTORIAL-CLEAR-03 | Got it · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 127.54 × 80.64 |

Source: `native/gameplay-app/NativeTutorialOverlay.swift`

### Journey navigation

Route: Home → Journey

Screenshot: [nav-journey](../typography/screens/nav-journey.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-NAV-JOURNEY-01 | 7 / 10 · Broj / statistika | Baloo2-ExtraBold | 18 | #E8734A | 263.64 × 182.52 |
| STS-NAV-JOURNEY-02 | 2 / 10 · Broj / statistika | Baloo2-ExtraBold | 18 | #E8734A | 263.64 × 182.52 |
| STS-NAV-JOURNEY-03 | 4 / 10 · Broj / statistika | Baloo2-ExtraBold | 18 | #E8734A | 263.64 × 182.52 |
| STS-NAV-JOURNEY-04 | Journey · Navigacijski naslov | Baloo2-ExtraBold | 28 | #AD8775 | — |

Source: `native/jimi-2026/JimiV9HubView.swift`

### Arcade navigation

Route: Home → Arcade

Screenshot: [nav-arcade](../typography/screens/nav-arcade.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-NAV-ARCADE-01 | Arcade · Navigacijski naslov | Baloo2-ExtraBold | 28 | #AD8775 | — |

Source: `native/jimi-2026/JimiV9HubView.swift`

### Forest navigation

Route: Home → Journey → Forest

Screenshot: [nav-forest](../typography/screens/nav-forest.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-NAV-FOREST-01 | Forest · Navigacijski naslov | Baloo2-ExtraBold | 28 | #AD8775 | — |

Source: `native/jimi-2026/JimiNativeWorldView.swift`

### Stage 07 · Forest

Route: Journey → Forest → Unit 07 → stats back

Screenshot: [stage-forest](../typography/screens/stage-forest.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-STAGE-FOREST-02 | Stage 07 · Naslov modala | Baloo2-ExtraBold | 28 | #AD8675 | — |
| STS-STAGE-FOREST-03 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-FOREST-04 | High score · Podnaslov / labela | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-FOREST-05 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-FOREST-06 | Best combo · Podnaslov | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-FOREST-07 | Play · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 238 × 80.64 |

Source: `native/jimi-2026/JimiNativeWorldCardView.swift`

### Beach navigation

Route: Home → Journey → Beach

Screenshot: [nav-beach](../typography/screens/nav-beach.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-NAV-BEACH-01 | Beach · Navigacijski naslov | Baloo2-ExtraBold | 28 | #AD8775 | — |

Source: `native/jimi-2026/JimiNativeWorldView.swift`

### Stage 07 · Beach

Route: Journey → Beach → Unit 07 → stats back

Screenshot: [stage-beach](../typography/screens/stage-beach.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-STAGE-BEACH-02 | Stage 07 · Naslov modala | Baloo2-ExtraBold | 28 | #AD8675 | — |
| STS-STAGE-BEACH-03 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-BEACH-04 | High score · Podnaslov / labela | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-BEACH-05 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-BEACH-06 | Best combo · Podnaslov | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-BEACH-07 | Play · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 238 × 80.64 |

Source: `native/jimi-2026/JimiNativeWorldCardView.swift`

### Area 55 navigation

Route: Home → Journey → Area 55

Screenshot: [nav-area55](../typography/screens/nav-area55.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-NAV-AREA55-01 | Area 55 · Navigacijski naslov | Baloo2-ExtraBold | 28 | #AD8775 | — |

Source: `native/jimi-2026/JimiNativeWorldView.swift`

### Stage 07 · Area 55

Route: Journey → Area 55 → Unit 07 → stats back

Screenshot: [stage-area55](../typography/screens/stage-area55.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-STAGE-AREA55-02 | Stage 07 · Naslov modala | Baloo2-ExtraBold | 28 | #AD8675 | — |
| STS-STAGE-AREA55-03 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-AREA55-04 | High score · Podnaslov / labela | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-AREA55-05 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-AREA55-06 | Best combo · Podnaslov | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-AREA55-07 | Play · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 238 × 80.64 |

Source: `native/jimi-2026/JimiNativeWorldCardView.swift`

### Settings navigation and rows

Route: Home → Settings

Screenshot: [settings](../typography/screens/settings.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-SETTINGS-01 | Settings · Navigacijski naslov | Baloo2-Bold | 28 | #AD8775 | — |
| STS-SETTINGS-02 | Game sounds · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-SETTINGS-03 | Music · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-SETTINGS-04 | Vibration · Podnaslov | Baloo2-Medium | 18 | #BD9788 | — |
| STS-SETTINGS-05 | Made with ❤️ in Croatia / by Tap Tap Design /  / Version: 1.0 · Opis / pomoćni tekst | Baloo2-Bold | 16 | #996754 | — |
| STS-SETTINGS-06 | Privacy Policy · Opis / pomoćni tekst | Baloo2-Bold | 14 | #996754 | 342 × 44 |

Source: `native/jimi-2026/JimiNativeSettingsView.swift`

### Backpack navigation and section

Route: Home → Backpack

Screenshot: [backpack](../typography/screens/backpack.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-BACKPACK-01 | Forest · Naslov sekcije | Baloo2-ExtraBold | 28 | #AD8775 | — |
| STS-BACKPACK-02 | 6 / 6 · Broj / statistika | Baloo2-ExtraBold | 24 | #E8744A | — |
| STS-BACKPACK-03 | Backpack · Navigacijski naslov | Baloo2-Bold | 28 | #AD8775 | — |

Source: `native/gameplay-collection/NativeBackpackView.swift`

### Stage · Play CTA

Route: Journey → Forest → Unit 07 → stats back

Screenshot: [stage-play](../typography/screens/stage-play.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-STAGE-PLAY-01 | Stage 07 · Naslov modala | Baloo2-ExtraBold | 28 | #AD8675 | — |
| STS-STAGE-PLAY-02 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-PLAY-03 | High score · Podnaslov / labela | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-PLAY-04 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-PLAY-05 | Best combo · Podnaslov | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-PLAY-06 | Play · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 238 × 80.64 |

Source: `native/jimi-2026/JimiNativeWorldCardView.swift`

### Stage · Continue CTA

Route: Journey → Forest → Unit 07 → stats back

Screenshot: [stage-continue](../typography/screens/stage-continue.webp)

| Reference | Element / role | Font | Size (px) | Color | CTA / control size (px) |
|---|---|---|---:|---|---|
| STS-STAGE-CONTINUE-01 | Stage 07 · Naslov modala | Baloo2-ExtraBold | 28 | #AD8675 | — |
| STS-STAGE-CONTINUE-02 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-CONTINUE-03 | High score · Podnaslov / labela | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-CONTINUE-04 | 0 · Broj / statistika | Baloo2-Bold | 34 | #EC7045 | — |
| STS-STAGE-CONTINUE-05 | Best combo · Podnaslov | Baloo2-Regular | 18 | #9E694F | — |
| STS-STAGE-CONTINUE-06 | Continue · CTA | Baloo2-ExtraBold | 28 | Ivory gradient · #FFFCED → #FFF6E1 → #F7E8CE | 238 × 80.64 |

Source: `native/jimi-2026/JimiNativeWorldCardView.swift`

