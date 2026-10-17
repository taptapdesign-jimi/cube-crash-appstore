# Native Arcade modes — 2026-10-17

## Contract and ownership

- [x] Select existing original artwork in assets/arcade; preserve bytes and filenames.
- [x] Hub owner: NativeArcadeHubView with reused Journey cloud/island lifecycle; modal title, description, artwork, Play.
- [x] Rules owner: NativeArcadeVariant + NativeGameplayEngine and both board construction paths.
- [x] Persistence owner: NativeSaveEnvelope selected independent slots + NativeProgressionState variant records; legacy defaults Endurance.
- [x] Root integration: Home Arcade -> hub -> selected modal -> preparation -> existing round cue/gameplay; return to Arcade hub.
- [x] Endurance unchanged gameplay. Pure Dice disables reward meter/drop; rounds1–4 small-value bias80/65/50/35percent, round5+ unchanged RNG. Slow Burn half meter progress and next-round charge carry.
- [ ] Coordinated SDK build, mounted integration tests and required QA gates.
- [ ] Install complete working tree on retained shared Simulator and normal launch.
- [ ] User visual/touch acceptance; physical FPS/thermal/audio acceptance remains separate.

Entry waits for existing preparation and finite exit completion. Root generation rejects stale callbacks. Covered/hidden/background Hub stops existing idle; modal finite animation settles on background and disposes on route exit. Three density-aware world artworks only; no new scheduler/audio transport. Saves and records are selected-profile scoped; Journey remains independent. Pure Dice refers to the gameplay reward meter, not removal of application resource readiness.
