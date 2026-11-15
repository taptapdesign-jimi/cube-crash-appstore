Tutorial delivery landing latest clarification(user2026-11-13): BOTH iPhone
and iPad end the Box/Backpack jump at visible-ink center70percent viewport
height,20percent below screen midpoint,and open there. Supersedes phone-retains-
old-anchor policy;initial covered placement,slower spring jump and drop target stay.

Tutorial spring jump latest(user2026-11-13): slower370ms ascent,25percent
higher crest,stronger upward stretch,gentler260ms return and smaller contact
squash. Total1.26s supersedes1.02s. Shared Box/Backpack and device return anchors
remain;tablet opening-anchor transfer follows the same slower takeoff clock.

Tutorial carrier landing softness(user2026-11-13): shared Box/Backpack jump
settles over1.02s instead of0.88s. Descent eases to zero speed at contact,smaller
landing squash,longer recovery and55percent second-bounce squash at slower pace.
Takeoff height,half-sheet timing and device-specific opening positions stay.

iPad tutorial delivery (user2026-11-13): match current iPhone external covered
Backpack/Box,Open backpack/Open box CTA and half-sheet-descent jump. iPad only
returns the visible closed carrier center to70percent screen height before
opening,20percent below midpoint. Initial covered anchor and phone geometry stay.

Arcade tutorial clear policy (user2026-11-13): before Clean Board, reuse the
existing Journey CLEARED animation and original random thumb/paw. Admit at
settled tutorial terminal, wait for existing board exit, then show Clean Board
without another numbered-round cue. Ordinary Arcade remains unchanged.

Native tutorial round-label policy (user2026-11-13): no Arcade round indicator
or numbered entry announcement until firstPlayTutorialComplete is globally
true, including saved tutorial
checkpoints, locally completed guide flags and foreground/relaunch. Local HUD
lesson unlocks do not admit numbered rounds. Existing tutorial checkpoint and
normal game progression remain unchanged.

Latest user2026-11-13: tutorial narration finishes naturally after any Got it,
Continue,High five or collection action. One existing finite speech owner queues
subsequent admitted lessons until actual file completion;sheet exit/route changes
do not truncate human speech. Sounds OFF/background/system interruption/disposal
still cancel without replay. Arcade Open box now opens the actual collection
through the same path as Journey Open backpack;acknowledge only after actual
collection dismissal. No standalone hide-only Arcade CTA branch remains.

User2026-11-12 latest edge refinement:lower final high-five characters4layout pt
from prior+10position,leaving+14authored pt. The complete35pt anchor(21+14) scales with
tablet illustration size so the cut meets the paper top on both devices. CTA High five! and all other styling retained.

User2026-11-12 latest farewell refinement:CTA High five! only acknowledges/closes.
Raise characters14layout pt from prior+24position,leaving+10after existing
phone/tablet anchor scale. Two-line copy,modal backdrop and all lifecycle unchanged.

User2026-11-12 farewell visual refinement:subtitle is exactly2lines,
Discover new dice and cards. / Beat your best and have fun!,at existing font size.
Final step10 alone uses existing shared modal backdrop behind paper/characters.
High-five art shifts24layout pt down after existing phone/tablet scale. Other
lessons and final motion/audio/receipt/input lifecycle remain unchanged.

User2026-11-12 closing lesson: after the last in-board lesson is acknowledged,
first return to Journey selection (Continue or deliberate Exit) shows one
final tutorial paper with original hi five.png,You’re ready!,Discover new dice,
collect legendary cards,and chase your next high score.The fun starts now!,Got it.
Supplied SPEECH/have fun.mp3 says That’s it,you’re ready! Have fun! Existing
selected speech owner admits once at actual paper landing. Selection admission
holds all route input/motion behind the independently animated sheet;foreground
does not release that hold. Got it acknowledges and only closes/resumes.
Optional tutorialFarewellPending receipt is absent before enqueue,true while
pending,false after acknowledgement;old completed profiles do not acquire it.
Last-lesson saves and canonical completion enqueue only if absent,so later board
completion cannot replay an acknowledged farewell. Exiting an unfinished board
retains its existing tutorial checkpoint/global completion semantics. Latest
Arcade policy:practice Clean Board Continue/Exit both return to Arcade hub and
show this same farewell;early Exit before practice success does not admit it. Existing
finite paper motion,tablet art projection,Settings and lifecycle cleanup apply.

User2026-11-12 latest motion:Your backpack paper begins at50percent of captured Special animation;visual preview only until genuine canonical settlement enables collection action. Tutorial Backpack shimmer is700ms continuous sweep with quick fade,using existing shared clock;ordinary/Special shimmer defaults retained.

User2026-11-12 final lesson:Your combo / Stack and merge quickly / to boost your combo and score. / Next;then Clear the board! / Stack and merge anywhere. / Clear every die and have fun! / Keep going. Final clear board.png uses existing top-edge character slot. Canonical optional completionLessonAcknowledged restores pending final;input/combo remain paused until Keep going exits.

User2026-11-13 latest:both Journey and Arcade show Your combo immediately after the real tutorial Backpack/Box visit returns,before another gameplay move. Collection acknowledgement makes Combo ready in both modes;only legacy nil collection receipts retain the six-move fallback. A pending Combo lesson with absent comboHUDRevealed may recover;acknowledged or legacy-skipped lessons do not replay. Existing exact-generation UIKit dismissal and collectionVisitPending guards remain.

User2026-11-12 latest Journey delivery copy:Your backpack drops / a random Special die. Two lines,CTA Got it. Arcade Box copy retained.

Latest user2026-11-12 automatic-delivery explanation supersedes manual delivery
wording/tap:Special delivery saysWhen the Special bar fills,your backpack(or box)
drops a random Special die. CTA and prewarmed face sayGot it. This acknowledges
the teaching pause;the existing automatic drop demonstration then resumes.
Carrier art has no tap target or Open accessibility action. The later Journey
collection lesson still uses Open backpack for the actual inspectable collection.
Normal reward selection,drop,motion,save and later collection behavior stay.

Latest user2026-11-12:Journey Your backpack lesson CTA is Open backpack. Both CTA
and top-right tap open the actual collection while retaining the reading sheet
underneath. Covered hand animation pauses;input/combo lock and durable unacknowledged
lesson remain until actual collection dismissal returns to the same board. Then
existing sheet exit acknowledges once. Failed opening and canceled/retired visits
do not acknowledge. Existing collection/detail hand guidance remains advisory.
Arcade behavior and save schema remain unchanged.

Latest user2026-11-12:delivery header characters are static on their moving paper;
remove their scale/depth entrance. Real carrier still starts at80percent. Journey
Backpack jumps30percent higher,returns to original anchor/scale then has a second
Ball-style floor rebound before opening(880ms total);Arcade pulse stays480ms.
Idle held Journey Backpack borrows original-image alpha mask with shared gold
burn/shimmer clocks;both click routes stop effects before jumping. All hand
appearances/exits now bounce in/out on existing owners,including repeated Special
and free-play hints,combo and collection hands. Size,targets,X offsets,drag motion,
input and save receipts stay. No extra timer or original asset mutation.

Latest user2026-11-12 delivery motion:real Backpack/Box admission is80percent of
the780ms sheet entry(624ms),using the existing generation-owned timeout. Header
illustration uses the same sheet entrance clock,lower-edge anchored scale-in
backOut1.8,behind paper until its completed bounce then in front. Source borrows
sheet progress;restored UIKit uses finite inherited CA tracks. Reduced Motion
fades without scale. Close hints in both detail and collection move8physical pt
up and left from centred X alignment,with existing modal projection compensated.

Close hints now rotate the original hand180degrees around its actual index fingertip(20,35 of176px),centred on the visible X glyph. The palm stays above the text. Latest centred-fingertip request supersedes a separate16pt positional offset. Both detail and collection X use the same owner. User2026-11-12.

All tutorial hands use the initial3-on-2 step size (min34percent viewport width,190pt),including combo,collection,detail-close and collection-close. Collection compensates its existing modal projection;authored tap/drag motion remains. User2026-11-12.

Latest visual adjustment (user2026-11-12): Arcade delivery uses closed Box ink
bounds to match Journey Backpack visible height,28pt paper-top gap and24pt title
gap. Arcade header illustration sits24pt lower on both phone/tablet (tablet keeps
its existing24pt offset). First earned tutorial Special retains its ordinary
geometry in Journey and Arcade;the former1.3 emphasis scale is removed. Existing
burn,drop/open/pointer motion,input,save and asset owners remain unchanged.

# Contextual first-play onboarding

User decision 2026-10-26. Supersedes the detached plain-Star tutorial.

User2026-11-11 incomplete-guide routing: returning to the same mode resumes its
single firstPlayRun, including after app relaunch. Starting Journey while Arcade
practice is unfinished, or Arcade while Journey is unfinished, starts a fresh
contextual guide and discards the previous guide's board, lesson flags and Special.
Browsing/preparing and canceling does not discard a checkpoint. Successful new
construction commits replacement through the existing save owner; switching back
starts fresh again. Global completion ends this policy and retains normal gameplay.
Real Journey/Arcade run slots, progression, settings and rewards remain preserved.

- Journey CTA opens Worlds. First selected Unit Play starts the existing guide on
  the actual global board1/11/21, with Bee/Juice/Robo from the authored World pool.
  Successful clearing uses the existing CLEARED/result/card owner and atomically
  records this Unit and global tutorial completion. Other Worlds remain unchanged.
- Arcade practice uses Endurance gameplay for every selected variant, including
  incomplete checkpoint resume and restart. The selected real variant is preserved
  for normal games after the global tutorial completes. Its eligible random
  Special is selected once and saved. Practice has no number announcement, real
  run stats, pending next-round receipt or Journey completion. Genuine completion
  presents the full Clean Board result; Continue and Exit both return to Arcade
  selection, then show the existing final high-five sheet. Early practice Exit
  preserves the unfinished guide and does not show that farewell. User2026-11-12
  supersedes the former Tutorial completed cover and real01 continuation.
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

2026-10-27 tutorial interaction update: Drag to stack and Merge dice expose `Got it`; activating it exits only the paper sheet and retains the guided gesture/step until the real stack or merge completes. Special Bar uses `Continue`. Special dice retains `Got it` and its actual landed/entry admission. The special lesson permits the earned Special with any playable ordinary die anywhere on the board (both drag directions), including rows below5; tutorial focus and pointer candidate selection use the same whole-board scope. Canonical gameplay/transaction/drop-in-progress/terminal guards remain enforced. Merge subtitle: `Stack the dice to make 6.` This intentionally replaces the legacy Source tutorial's upper-row restriction without changing normal gameplay.

2026-10-27 first-stack incident: the Native first-step monitor waits for the canonical first-merge barrier and both guided nodes' actual normalization readiness before exiting. Second-step preparation keeps the first preparation alive until replacement preparation and barrier release succeed; a rejected handoff returns to the existing scoped poll instead of retiring the only monitor. Native delayed hand entrances are canceled when a real step exit takes ownership, while reference/oracle callers retain their original timer policy. Got it and snap-back hand restoration cannot overwrite an already advancing guided step. No forced step, guessed settlement delay, new scheduler or progression/save mutation is used to recover.

Latest timing/gesture feedback: first paper entry begins on the existing board-entry parent's actual last opacity endpoint, before its remaining movement/scale tails settle. Only paper is presented early; guided targets, hand and gameplay input retain genuine completed-entry/preparation admission. Clear the stage starts directly in the outgoing Special Bar sheet's real exit completion, with dice opacity restoration running in parallel; this supersedes the earlier wait-for-opacity rule. Special guidance cycles through every currently eligible ordinary die across the whole board before repeating, avoiding consecutive identical targets when alternatives exist. Target ordering borrows the existing shuffled candidate list and consumes no additional RNG or clock.

2026-10-28 next-sheet timing: Native first/second guided monitors start the hand and paper exits together. On the paper's actual exit completion, Merge dice or Special Bar enters immediately, with no wall90 gap or second hidden exit. Early paper does not release gameplay: first-step normalization/barrier preparation retries on the existing scoped120ms timeout, and Special Bar interaction/focus waits for the existing40ms settlement checks. Its committed second-merge barrier, not merely a changed pair, admits early Special Bar paper. Both CTAs require paper entry plus their real preparation; generation/scope retirement cancels waiting work. Source/oracle defaults retain their sequential exits and wall90. Tutorial CLEARED now bypasses the normal ordinary-contact/early-progress celebration and enters only from Scene's settled terminal callback, after final merge artwork and HUD receipts finish; ordinary non-tutorial celebration stays unchanged. No guessed500ms timer replaces actual final-artwork retirement.

User2026-10-28 Arcade completion decision supersedes automatic fresh round1: Continue on Tutorial completed returns to Arcade hub/mode selection through the existing native return owner, with paper coverage until the hub's entry tracks are ready. It persists tutorial completion and clears only firstPlayRun, without creating/scoring a real Arcade run or changing existing Arcade stats. Journey completion routing remains separate. Completion cover typography now groups the default heading into two compact44pt lines at40pt font (34/37.4pt narrow),12pt heading/subtitle spacing, shared subtitle paragraph and an adaptive thumb area above a safe-area anchored Continue. Artwork, copy, motion/audio and cleanup remain preserved.

User2026-11-12 collection walkthrough: while global onboarding is incomplete,
opening the gameplay Backpack/Box shows one advisory hand at the first visible
unlocked die. Actual detail entry points it to the detail X;completed return
points it to the main collection X. Existing modal interactions stay available.
The original hand performs two finite taps,then rests;Reduced Motion is static.
It shares the active modal transform/foreground clock and retires on exchange,
close or disposal. No extra saved lesson state,audio,haptic or scheduler.

### Collection guidance once per first-time profile (2026-11-12)

The first fully admitted tutorial Backpack or Box visit owns the die, detail-close and collection-close hands. NativeBootstrap persists `progression.tutorialCollectionGuidanceSeen` on entry admission, so subsequent visits and relaunches do not repeat them. Canceled preparation does not consume the receipt. Both modes point at the same lower-right card position (90% across and down). A fresh profile resets the receipt.

### Tutorial Box parity, 2026-11-13

iPhone Arcade delivery uses “Your box drops / a random Special die.” on two lines. The original illustration torso cutoff (row625of741 at3x) meets the paper top; Journey and iPad layout/copy remain unchanged. Tutorial Box reuses the approved Backpack880ms two-jump squash/stretch recipe on its existing Source clock, normalized to equal visible carrier ink height. Normal Arcade crate drops retain their existing motion.
