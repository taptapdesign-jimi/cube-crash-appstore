# Contextual first-play onboarding

User decision 2026-10-26. Supersedes the detached plain-Star tutorial.

- Journey CTA opens Worlds. First selected Unit Play starts the existing guide on
  the actual global board1/11/21, with Bee/Juice/Robo from the authored World pool.
  Successful clearing uses the existing CLEARED/result/card owner and atomically
  records this Unit and global tutorial completion. Other Worlds remain unchanged.
- Arcade practice retains the selected variant. Its eligible random Special is
  selected once and saved. Practice has no number announcement, real run stats,
  pending next-round receipt or Journey completion. Success persists the global
  receipt and presents Tutorial completed/thumb/Continue. Continue starts real01.
- At 70% of the actual Special animation, after canonical gameplay settlement,
  Great merge / Keep stacking and merging to clear the board / Continue uses the existing bottom sheet and its
  finite enter/exit. A generation-scoped input lock owns the pause. A persisted
  acknowledgement prevents replay. Background suspends through existing owners;
  disposal/replacement releases the lock, callback and presentation.

NativeAppController owns selection/preparation and return destination.
NativeBootstrap owns canonical routing, the NativeSaveStore atomic envelope and
result handoff. Optional firstPlayRun stores only a coherent guide checkpoint,
including selected reward; this is separate from real Arcade/Journey run slots.
Existing source constructor/restore, meter-drop, Special transaction and tutorial
focus owners own artwork/readiness/animation. No new ticker, scheduler, audio,
haptic, asset or independent progression owner is introduced. Failed/stale work
cannot publish a checkpoint or unlock. Existing old saves decode with no new slot.

Validation must cover World selection, all Arcade variants, typed reward identity,
checkpoint/relaunch, post-Special input/Continue/cleanup, Journey reward commit,
Arcade practice isolation, global completion, and actual Source Special movement.
Physical motion, touch, audio and thermal acceptance remain separate.

Tutorial HUD admission explicitly retains target opacity1 while the actual HUD
entry is pending or owns its finite action. The guide never captures a transient
zero/overshoot as its settled parent opacity. NativeSourceTutorialHUDTests covers
pending reveal, actual enter ownership, release and disposal.

User timing refinement2026-10-27 (latest): Great merge samples the exact captured
Wild transaction's existing authored animation progress. At70% it may overlap
visual tails, while canonical mutation, drag, navigation, generation and foreground
gates remain enforced. Restored guides without a captured progress receipt retain
full finite-settlement fallback. No fixed timer or second animation clock.
The second guide sheet remains visible while its merge/HUD receipts settle,then
Special Bar enters directly on its actual exit completion. Native removes the
Source reference90ms activation gap; preserved oracle fixtures keep their default.

Special Bar takes the outgoing sheet's painted board focus directly: prior
board/HUD restore writers stop before the new dim owner begins. Entry starts
from captured alpha;exit restores the normal baseline and preserves an active
physical pickup scale. This prevents restore/dim writers flashing between sheets.

All Native tutorial sheets share NativeTutorialSheetMotion:0.68s entrance with
overshoot and soft rebound; paper extends25% below its content to cover the bottom.
Source reference/oracle callers keep their0.42s default. Special Bar pulse now uses
a1.6s cosine cycle and a softer fill stretch, on its existing lifecycle-owned clock.
Second-merge focus transfers captured alpha ownership without a synchronize flash.
Special sheet starts on genuine carrier first-contact, not the later0.43s impact
completion; physical input preparation still waits for restored tile ownership.
Card collect uses0.08s anticipation+0.16s collapse; backdrop fade overlaps the last
0.08s and the existing result handoff fires at visible exit end, with no extra gap.

Latest size feedback: every tutorial sheet shares compact copy/CTA slots:28pt
top,16pt CTA gap, bottom max(12pt,safe-area). Subtitle is capped at two lines,
with56pt reserved copy height; Great merge uses only Keep stacking and merging /
to clear the board. Hidden CTAs retain their slot. Special Bar has no taller layout.

Video regression20261027155045368 (user rejected previous visual acceptance):
Native sheets use0.78s smooth travel/4.5% overshoot/0.8% return. Final Scene alpha
projection owns tutorial board opacity from its last painted value across logical
updates (0.42s smooth ease),excluding authored spawn/removal/Special outer channels.
Adjacent Special Bar→Clear retains the paper and crossfades only content0.38s.
The old pointer/instruction exits at Special animation start;the same tutorial
owner presents Great merge on the real70% callback and keeps Continue locked until
canonical settlement. First-contact admission also covers non-Source/restored
presentation. Post-interim Journey result starts at the readable0.47s frame even
when the transient CLEARED controller has already retired. No gameplay receipt,
reward commit, save, asset, audio or physical delivery boundary changes.

### Latest tutorial presentation revision — 2026-10-27

Special Bar→Clear now fully exits the previous sheet, restores dice opacity through the existing0.42s final paint owner, then starts Clear's independent soft entry and hand. This supersedes the retained-paper crossfade above. Special dice guidance keeps ordinary dice visible. Great merge is removed from the UI; after genuine Special completion and readiness the existing encouragement acknowledgement is committed automatically. Canonical guide/reward/endgame safeguards remain. Reward-card first spring peak changes from1.25 to1.125 (50percent reduction of overshoot);later spring stops,rest size and duration remain.

Special dice now exposes the ordinary CTA labelled exactly `Got it`;it is admitted after the sheet's real entry completion. It exits only the paper sheet,retaining the hand/selected gesture targets and genuine merge/input/completion ownership. Special Bar orange pulse runs at1.1x speed (1.6/1.1seconds per cycle),with the same amplitude/shape and original bubble cadence.

On the first completed Journey tutorial result only,Continue routes through the existing prepared Journey return/Exit pipeline to the retained origin World. The captured clean result state must have requiresResultCompletion;ordinary later Journey Continue and Arcade retain their previous next-Unit/round behavior. The reward/progression commit remains unchanged.
