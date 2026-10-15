# Native benchmark v5 — Backpack and major Native updates

User-approved continuation checkpoint, 2026-10-16. Immutable tag:
`native-benchmark-v5`, on `main` in the existing PUBLIC repository
`https://github.com/taptapdesign-jimi/cube-crash-appstore`.

The user explicitly requested preserving all current work online as the new
Native benchmark before further improvements. Continue Native development from
this checkpoint. All prior Native and PWA benchmark tags remain unchanged;
`production-benchmark-v9` remains the separate approved PWA recovery reference.

## Included work

- Separate Native Backpack route with standard outgoing-screen exit, finite
  entry/exit, input admission, close/return, reusable static PNG grid and locked
  holders. Unlock counts project the existing per-World progression/save owner.
  Arcade contains TNT, Magnet and Cubero; Juice belongs only to Beach. TNT is
  10 percent larger than the preceding presentation, with all three Arcade
  icons normalized to its visible height and centered by original alpha bounds.
- Selected dice detail with approximately 180pt visible artwork, compact
  text-hugging Stage badge, original paper/X/shadow, bounded selected animation,
  background/cleanup ownership and distinct factual character copy. Approved
  names include STAR, FLOWER POWER, SHROOMY, BLOOB, BIBI RIBI and JUICE.
- Authored magic-card SVG reward presentation, privately prepared during the
  completed gameplay exit and visibly started only after dice/HUD retire.
  Preserves original blank-first-frame artwork, exact reveal ownership, late
  preparation/failure handling, reward collection and result handoff.
- Native Cubero playback from the original seven embedded SVG poses through
  one shared bounded atlas and the existing board clock. Current scale1.3248,
  resting foot alignment, authored1.56x playback, continuous held-drag motion
  and neutral SVG crate carrier/real landing handoff are retained. Earlier
  extra-pose prototype artifacts are preserved as inactive references only.
- Hidden persisted1–3 bonus drop counts for Fish, Kanta and Cubero, with genuine
  meter construction, save/resume, direct spawn/HUD and Magnet absorption
  ownership; no visible orbit experiment is active. Plain Star and Bee retain
  their existing canonical distinctions.
- Bounded original TNT fuse sparkles; Area55 beam variety/cadence and retirement;
  NEW ribbon, World card/modal geometry, shared navigation/paper surfaces,
  Arcade HUD/round continuity, reward/result and authored UI refinements.
- Accumulated Native regression tests, lifecycle/performance ownership records,
  original/new supplied artwork and all non-ignored visual previews in output/.
  The original Cubero SVG and inactive generated-pose comparison remain distinct.

## Validation

Publication validation is recorded in CURRENT_HANDOFF and local receipts:

- Full deterministic QA: PASS, 530 suites / 4010 tests and all selected gates,
  including Gameplay KING330, `/tmp/native-benchmark-v5-full.log`.
- Pure Swift gameplay package: PASS483/483, `/tmp/native-benchmark-v5-core.log`.
- Pure Swift state package: PASS43/43, `/tmp/native-benchmark-v5-state.log`.
- Final actual Backpack SDK regression: 7/7 PASS,
  `/tmp/backpack-consistent-arcade-sdk.log` and `.xcresult`.
- Earlier gameplay/drop-count and animation-specific SDK receipts remain in
  CURRENT_HANDOFF. The focused tests do not imply a complete Native SDK rerun.
- Final current signed Release build, strict signature and compiled Native
  target/assets/dependency audit PASS: `/tmp/backpack-phone-release.log`,
  `/tmp/backpack-phone-signature.log`, `/tmp/backpack-phone-audit.log`.

## Phone delivery and limits

Current source was installed over the existing Native app on iPhone13blue on
2026-10-16. Bundle `com.taptapdesign.stacktosix.native`, Release1.0/build1;
executable SHA256
`277bdbd81ab65dc858dca0e76894564f5c24c163df23a40c4667c0514b58ddcd`.
Normal launch PID6301 was independently confirmed in the exact installed bundle.
Both primary and previous saves were byte-identical before installation,
after installation and after launch. See the delivery entry in CURRENT_HANDOFF.
The Git checkpoint adds documentation/publication metadata and preserves the
new unused middle-holder PNG pair supplied after that delivery. That pair was
not in the earlier phone asset receipt; no active runtime code changed and
publication does not build or reinstall the phone app.

This is the user-selected source/recovery baseline. It does not assert complete
Native/PWA parity or measured physical touch, audio/haptic, animation, sustained
FPS or thermal acceptance. Those remaining checks stay NEEDS PHYSICAL TEST.
DEV Show Card changes Backpack eligibility through progression; Hide Card is
not a complete Backpack reset because played/opened/explicit unlock state may
retain eligibility. That known behavior is preserved, not silently changed.

No PWA/legacy shell operation, phone reinstall/reset or asset cleanup is performed
by publication. Ignored build products, private phone saves and temporary local
diagnostics are excluded; the existing earlier release-attachment recovery
references remain intact.
