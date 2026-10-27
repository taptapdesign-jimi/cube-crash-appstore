# Tutorial video regression — 20261027155045368.mp4

Visual baseline: FAIL. User recording reviewed at original30fps; artifacts under
/tmp/tutorial-video-review/. Previous SDK green did not establish motion acceptance.

- [x] 8.3/11.0/13.5s: readable soft travel, small overshoot, gentle return; compact shared height and max2 subtitle lines retained.
- [x] 12–13.3s: continuous dice alpha across canonical updates, new dice and focus changes; no full-opacity flash.
- [x] 15.7–16.7s: Special Bar→Clear keeps the paper onscreen and crossfades its content; no empty interstitial.
- [x] 22.6–23.5s: exact first-contact opens Special dice also on restored/fallback presentation; input waits actual landing+entry.
- [x] 27–30s: retire old pointer/instruction when Special starts; Great merge visually enters at70% while canonical completion/input remain protected.
- [x] 62.7–63.3s: post-reward result starts at a readable frame even if the transient CLEARED owner was retired.
- [x] Validate mounted owners, actual normal-storyboard OS gestures/recording, source oracles, all authored World guides, lifecycle/retirement, required gates and retained Simulator delivery.

Evidence: actual normal-storyboard Area55 OS gesture flow PASS (`/tmp/tutorial-video-fix-os-final-sdk.log`); reviewed recording `/tmp/tutorial-video-fix-review.mp4`. All three authored World fourth-step flows PASS (`/tmp/tutorial-video-fix-worlds-final-sdk.log`); shared-height/safe-area, soft trajectory, continuous paper, final opacity and post-reward readable-frame tests PASS (`/tmp/tutorial-video-fix-regression-sdk.log`, excluding subsequently corrected test synchronization). Restored non-Source test waits canonical acknowledgement after the content crossfade, rather than its visual midpoint. Final fast/full/iOS and retained delivery logs are recorded in CURRENT_HANDOFF. Physical motion/touch/FPS/thermal: NEEDS PHYSICAL TEST.
