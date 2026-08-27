# Stack to Six App Store Connect Submission Copy

Prepared: 2026-08-27
Target release: `1.0 (3)`
Bundle ID: `com.taptapdesign.stacktosix.Stack-to-Six`

Current signing state: the verified archive exists, but App Store distribution export is blocked by
Apple team permission/profile state. Resolve `APP_STORE_ACCOUNT_UNBLOCK.md` before upload.

This document is the copy-and-paste source of truth for the first App Store submission. Do not
change gameplay, the KING contract, or assets to satisfy metadata work. Re-check each field in App
Store Connect immediately before submission because Apple can change the portal and questionnaire.

The machine-readable release lock is `release/stacktosix-app-store-profile.json`. Its intended
submission is **general audience**, expected Apple-calculated **4+**, **Made for Kids / Kids
Category off**, and **Game Center off**. Local tests and the native audit prevent those decisions
from drifting silently. This file documents the values; it cannot click or replace App Store Connect.

## Before opening App Store Connect

1. Upload `release/stacktosix-privacy-policy/index.html` and `support.html` into the existing public
   `/stacktosix-privacy-policy/` directory, beside its existing `images/` folder.
2. Verify Privacy links to Support and Support links back to Privacy. Keep the existing
   `images/stack-to-six-logo.png`.
3. Verify both HTTPS pages and both logo URLs return `200` and that email/privacy links work.
4. Resolve the Apple distribution permission/profile blocker in `APP_STORE_ACCOUNT_UNBLOCK.md`, then
   export and validate the saved authoritative Stack to Six Release archive `1.0 (3)`.
5. Capture real screenshots from that same release candidate. Do not use development overlays,
   debug menus, placeholder art, or a different build.

## App Information

App Store Connect location: **My Apps → Stack to Six → App Information**.

| Field | Value |
| --- | --- |
| Name | `Stack to Six` |
| Subtitle | `Merge. Stack. Reach Six.` |
| Primary category | `Games` |
| Primary subcategory | `Puzzle` |
| Secondary Games subcategory | `Casual` |
| Content rights | The app does not contain third-party content requiring separate rights |
| Age rating | Complete the questionnaire using the answers below; accept Apple's calculated result |

The name is under Apple's 30-character limit and the subtitle is under its 30-character limit.
Name availability is controlled by App Store Connect and cannot be guaranteed locally.

## Version Information

App Store Connect location: **My Apps → Stack to Six → iOS App → 1.0**.

### Promotional text

```text
Merge matching dice, build clever stacks, and reach six through handcrafted Journey worlds or endless Arcade play.
```

### Description

```text
Stack to Six is a tactile dice-merging puzzle built around one simple goal: combine matching dice, shape your stack, and reach six.

Every move matters. Plan where each die lands, set up satisfying chains, and use special dice to turn difficult boards into playful bursts of motion.

PLAY YOUR WAY
• Journey — travel through handcrafted worlds, stages, and visual surprises.
• Arcade — keep building through an open-ended sequence of rounds.

MADE TO FEEL ALIVE
• Responsive drag-and-drop play
• Expressive handcrafted animation
• Optional on-device 3D Motion effects
• Sound, music, and haptic controls

NO ACCOUNT REQUIRED
The current version contains no advertising, no analytics, no in-app purchases, and no Game Center integration. Core gameplay is bundled with the app and can be played offline.

Stack to Six was independently designed and developed by Igor Jimi Ivankovic, the creator behind Tap Tap Design.
```

### Keywords

```text
puzzle,merge,dice,logic,casual,offline,brain,number,journey,arcade,strategy
```

Do not add `Stack to Six` or `Tap Tap Design` to keywords: the app name and developer name are
already indexed fields. Keep the comma-separated keywords within Apple's 100-byte limit.

### URLs and copyright

| Field | Value |
| --- | --- |
| Support URL | `https://taptapdesign.com/stacktosix-privacy-policy/support.html` |
| Marketing URL | `https://taptapdesign.com/` (optional) |
| Privacy Policy URL | `https://taptapdesign.com/stacktosix-privacy-policy/` |
| Copyright | `2026 Igor Jimi Ivankovic` |

Do not enter the old double-slash privacy URL. Do not enter the site homepage as Support URL because
it does not currently expose direct contact information.

## App Privacy

App Store Connect location: **My Apps → Stack to Six → App Privacy**.

Use these answers only while they remain true for the exact submitted binary:

- Data collection: **No, we do not collect data from this app**.
- Tracking: **No**.
- Tracking permission/ATT: **Not used**.

Evidence in the current release source:

- no account or registration;
- no ads or advertising SDK;
- no analytics or crash-reporting SDK;
- no server receiving gameplay data;
- progress and preferences remain locally on the device;
- optional device motion is processed on-device and is not recorded or transmitted;
- Game Center and in-app purchases are not integrated.

If Game Center, analytics, crash reporting, ads, cloud saves, accounts, sharing, or any networked
service is added later, stop and reassess both App Privacy and the public policy before uploading.

## Age Rating Questionnaire

App Store Connect location: **My Apps → Stack to Six → App Information → Age Rating**.

### Recommended positioning

- Expected Apple-calculated rating: **4+**, subject to Apple's final questionnaire calculation and
  any region-specific result.
- Age Categories and Override: choose **Not Applicable**.
- Do **not** select **Made for Kids / Kids Category** for version 1.0. Stack to Six is a child-safe
  general-audience puzzle game, not an app marketed primarily to children.
- Do not use `For Kids`, `For Children`, or equivalent child-directed wording in the app name,
  subtitle, icon, screenshots, promotional text, or description.

Children can still download and play a general-audience 4+ app, subject to their family device and
parental-control settings. Selecting Kids Category would add stricter permanent requirements to this
app and future updates, including a parental gate around external links such as the online Privacy
Policy. That category is unnecessary for the stated goal that the game simply be suitable for all
ages.

### Expected current answers

- Parental controls: none.
- Age assurance: none.
- Unrestricted web access: none. The app does not contain a browser or permit free web navigation;
  its single explicit Privacy Policy link opens the fixed HTTPS page outside the game WebView.
- User-generated content: none.
- Messaging or chat: none.
- Social media: none.
- Advertising: none.
- In-app purchases: none.
- Loot boxes: no. Random special dice are earned puzzle elements, not purchased randomized containers.
- Gambling: no.
- Contests: none. Arcade is local single-player progression with no opponent, public ranking, prize,
  or player-versus-player competition.
- Simulated gambling: none. Dice are visual puzzle pieces; there is no wagering, casino play,
  prize, stake, or cash-out mechanic.
- Profanity or crude humor: none.
- Horror or fear themes: none.
- Mature or suggestive themes: none.
- Medical, health, or treatment information: none.
- Alcohol, tobacco, or drug use or references: none.
- Sexual content, nudity, and graphic sexual content: none.
- Cartoon or fantasy violence: none. TNT, BOOM, smoke, and other special-die effects are abstract
  puzzle feedback; no person, animal, or character is attacked, injured, killed, or placed in combat.
- Realistic violence and prolonged graphic or sadistic violence: none.
- Guns or other weapons: none. The TNT-themed puzzle effect is not presented as a weapon used against
  a living target.

Read every current portal definition before confirming. Apple calculates the displayed age rating;
do not manually promise a specific rating in metadata.

## App Review Information

App Store Connect location: **iOS App → 1.0 → App Review Information**.

| Field | Value/action |
| --- | --- |
| Contact first name | `Igor Jimi` |
| Contact last name | `Ivankovic` |
| Contact email | `stacktosix@gmail.com` |
| Contact phone | Enter a phone number that Igor actively answers; do not invent one |
| Sign-in required | `No` |
| Demo account | Leave blank |

### Review notes

```text
Stack to Six is a self-contained puzzle game. No account, sign-in, internet connection, in-app purchase, advertising, analytics, or Game Center access is required.

The app has two play modes: Journey and Arcade. Core gameplay uses drag and drop: move matching dice onto a stack to merge them and work toward a six. Journey can be opened from the main menu to review the staged world progression; Arcade provides open-ended rounds.

The optional “3D Motion” setting uses device motion only for an on-device visual tilt effect. It can be disabled at any time in Settings → 3D Motion. Motion data is not recorded or transmitted.

The Privacy Policy is available in Settings and at:
https://taptapdesign.com/stacktosix-privacy-policy/

Support:
https://taptapdesign.com/stacktosix-privacy-policy/support.html
```

## Screenshots

App Store Connect location: **iOS App → 1.0 → App Previews and Screenshots**.

- Supply 1–10 screenshots for each device set Apple requires in the portal.
- Supply both the required iPhone portrait set and the required iPad portrait set because Stack to Six is now a universal iPhone + iPad app.
- For iPhone, Apple's current 6.9-inch portrait sizes include `1260×2736`, `1290×2796`, and `1320×2868` pixels; use the iPad size App Store Connect requests for the universal binary.
- Upload PNG or JPEG without alpha transparency.
- Use screenshots from the final `1.0 (3)` build and preserve the real UI.
- Recommended honest sequence: main menu, Journey worlds, live Journey board, a readable special-die
  moment, Arcade play, and a satisfying completed-stack/result moment.
- Avoid screenshots where an animation clips at the safe area, a modal is half-transitioned, FPS
  diagnostics are visible, or content implies features not present in the submitted binary.

App previews are optional. A strong set of real screenshots is safer than a rushed preview video.

## Build selection and submission order

1. Upload signed build `1.0 (3)` from Xcode Organizer only after archive validation passes.
2. Wait for Apple processing and answer any export-compliance prompt truthfully. The current app is
   not expected to implement proprietary encryption, but the final binary/plist must be checked.
3. Select build `3` on the iOS `1.0` version page.
4. Complete App Privacy, age rating, review contact, review notes, URLs, description, keywords,
   categories, copyright, and screenshots.
5. Resolve every warning shown by App Store Connect.
6. Send the processed build to internal TestFlight first and run the physical acceptance matrix.
7. Only after TestFlight acceptance, choose the release option and add the version to review.
8. Submit to App Review. Apple approval cannot be guaranteed by local QA.

## TestFlight acceptance before review

On the actual release candidate verify cold launch, offline launch, first-play tutorial, Journey,
Arcade, drag and rapid drag, regular merge, each special archetype, final merge, NO MOVES, fail,
Play Again, restart, save/load, background/foreground, sound, haptics, 3D Motion on/off, safe areas,
sustained FPS, thermal state, memory behavior, and absence of crash/termination logs.
