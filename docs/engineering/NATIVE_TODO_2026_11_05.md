# Native tasks · 2026-11-05

- [x] Verify enhanced Efficiency flows through completed-level 1/2/3 stars; fix stale calibration/test paths.
- [x] Verify independent Endurance, Slow Burn and Pure Dice scores, saves and selected-mode presentation.
- [x] Remove Home balloon clipping while crossing adjacent slides.
- [x] Increase phone Poof/TNT/Barrel sprite animations by 20%; retain iPad sizes.
- [x] Increase idle cloud travel on Worlds Hub and Journey Unit screens using existing owners.
- [x] Forest entry: 50% behind wooden gate; 50% current bee behavior.
- [x] Integrated review, required QA, current-tree build and retained Native Simulator preview with saves preserved.
- [x] Record actual validation and delivery in CURRENT_HANDOFF.md.

Settings WAV replacement deferred by explicit user reply in this task.

Work ownership: scores agent handles scoring/stars and selected-mode UI; home_clouds_bees agent handles Home/World ambient motion; sprite_scale agent handles phone sprite scaling; root handles integration, metadata, QA and delivery. Original assets remain unchanged.

User confirmed POOOF means Barrel smoke, covered by its single phone-only20percent increase.

Validation: state scoring/persistence10/10 and Forest planner5/5; mounted Native
coverage29 unique tests passed after repairing stale test fixtures. Initial
source contract tests expected old header source spelling and spacing; current
RowLayout/CTA guard assertions now pass. Final no-sync qa:full530suites/4010tests,
Gameplay KING330, qa:fast, qa:ios and runtime admission gates PASS.

Visual feel and physical iPhone acceptance remain NEEDS PHYSICAL TEST.

Delivery: normal complete-current-tree Debug build succeeded; retained iPhone13
Simulator install-over and normal launch PID14441. Exact Native bundle, no web
bundle/test plugins;2958original assets byte-identical. Both canonical saves
match pre-test bytes through final Home review. Actual SpringBoard SilentMode1,
toolbar MuteOn. Evidence:/tmp/native-batch-20261105/. No physical install.

Current unsigned iOS Release also builds and passes compiled Native identity,
original-assets and dependency audit. Debug contains test-only framework
references and is not the shipping dependency artifact. Release was not installed.
