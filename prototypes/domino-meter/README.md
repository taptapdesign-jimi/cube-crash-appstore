# Jump & Pop — isolated Stack to Six motion study

The existing demo URL/path is retained: http://127.0.0.1:5188/.

```sh
python3 -m http.server 5188 --bind 127.0.0.1 --directory prototypes/domino-meter
```

No dependency installation or Native/PWA build. This is a local standalone prototype; nothing imports it into the game.

- Add progress with the button/Space,finish,reset or enable auto cycles. Adjust final-wave onset duration,bounce strength and count.
- Actual generated PNGs are decoded once into four reusable sprite surfaces. The empty/30/60/100 states crossfade while airborne. Current width retains the40percent reduction; height equals width.
- Each tile has a fixed slot. Its first progress starts one620ms sequence:60ms squash,takeoff stretch,one full airborne turn,landing squash and one small rebound. Color develops during takeoff/flight. No domino lean/contact/spacing solver remains.
- Shape accents are adapted from `NativeBeachBallPlanning.pose`:contact1.26/.70,release.84/1.18,90ms back.out(1.7) settle. This is the Ball Special's shape language adapted to a cube,not identical whole-screen Ball motion.
- Ordinary jump/rebound heights are reduced20percent. Final hop height is reduced80percent from the first Jump&Pop version. On full charge,the last tile continues its active jump and breaks just after takeoff(at96ms charge-jump age);if it already landed,it takes a fresh low hop. While it shatters,the remaining tiles launch right-to-left(default200ms first-to-last reverse onset) and break150ms into their own low airborne turn. No settle phase remains. Reverse takeoffs blend from their actual current charging poses over120ms instead of snapping to the floor. A new cream row enters after fragments fade.
- Original merge6 template polygon shapes are retained at8of12definitions/tile. Debris is85percent orange/15percent original brown with captured random launch/spin,analytic gravity and one damped ground bounce. The rotated bounding radius stays above the floor.
- The same floor constraint applies to the entire rotating/stretched PNG. Ground shadows reuse one prepainted96x32texture,subtly shrinking/fading with height. No live blur.
- One demand-driven RAF owns all motion and both preview sizes. Hidden pages pause without catch-up; idle pages stop frames. Progress arriving during non-fill phases queues for the next cycle. Canvas sizes are cached by one ResizeObserver;unchanged HUD text is not rewritten.
- Original runtime art,Native/PWA code,saves,audio and build settings are untouched. The generated PNG remains a prototype candidate,not an approved runtime asset.

PNG source: `game design/output/2026-11-06-domino-tiles/upright-wide-fill-states.png`. The lower image is a material reference; the animated sprites render it at the current square proportions.

Validation: JS syntax,HTTP200 and isolated motion checks. Reverse ordering,airborne break locations,floor constraints and exact fill-to-ending pose continuity passed18 scenarios(count10/16/24,last-jump ages20/80/200/470/550/2000ms). Initial isolated checker lacked the template import;rerun supplied actual shardPatterns and passed. Earlier ordinary/final jump sampling covered bounce0/4/12 and segment boundaries. CUA native pipe closed during this revision,so the new airborne sequence has not been visually inspected in a browser. Earlier browser review applies only to the superseded domino version. Subjective motion and physical performance remain user review. No full QA suites/game build/install.

Latest tuning: default bounce12(Jak),preserving the strong squash/stretch and rotation. All authored vertical lift(main hop,landing rebound,final hop)is multiplied by0.30,an additional70percent reduction from the reverse-ending version. The floor/corner constraint still prevents rotated PNGs from crossing the ground.

New-row arrival: opaque PNGs enter from scale0 with560ms back.out(2.2),15ms stagger,strong Ball shape accents and a low hop+landing rebound. Entry finishes after the full620ms shape/hop of the last tile;queued progress starts only then. No entry fade or vertical travel below the floor.

Rotation variety:1/2/3full turns with60/30/10percent weights. Sampled once when each charging hop starts,and once for each planned reverse hop. Carrying jumps retain their original turn count through full-charge handoff. No paint-time randomness or timer added. New-row arrival remains a scale/hop without extra turns.

No empty beat between rows: new-row scale-hop starts at the final reverse destruction boundary. Existing debris retains its own captured epoch and continues falling/bouncing/fading over the new row. It is not cleared by row arrival or resumed filling. The same RAF remains active until both row motion and debris finish.

Arrival retuned: new row now starts when the full debris wave reaches80percent of its first descending apex-to-floor arc. Per-fragment analytic80percent crossing times determine the captured deadline;fragments remain alive through that crossing and220ms beyond it. This supersedes immediate-at-final-break arrival. Debris continues across row arrival using its own epoch.


## Cute endpoint accent / forward pop (2026-11-06)

Latest prototype supersedes reverse destruction above: default24 square PNG cubes,1.02-width slot pitch (near-touching),fitted across the full available strip width. +1 and +6 controls demonstrate a single three-stroke endpoint accent after each settled progress batch;strokes enter sequentially at65ms intervals with backOut2.8 scale bounce and retire within780ms. Accent follows the endpoint pose and disappears on its destruction. No per-cube accents or new timer. Existing cached ground shadows retained. Final low hop/destruction wave now runs left-to-right(user confirmed),preserving pose-continuous blending,orange debris and80percent-fall new-row admission. Single demand RAF includes finite accent lifetime and sleeps again. Native/LAB runtime unchanged.

Syntax/HTTP checks only;browser preview unavailable because the CUA browser access host is unavailable. Visual timing remains user review.


Latest shadow/smoke tuning: warm ground shadow core .48/shoulder .28 (previous .18/.10),1.65tilewidth footprint and .30tileheight. Two finite460ms cached cream cloud puffs per first landing of each arriving/charging cube;adjacent contacts produce a wider combined cloud. Same paused demand RAF,pending contacts cleared on reset,no live blur. Shards reduced40percent using cumulative rounding (24cubes:115 versus192). New-row admission deadline multiplied.80,clamped after last destruction. This is20percent earlier in time than the previous80percent-fall deadline,not a change to64percent fall distance. Cache shadow-smoke-early-15.

Individual shadow correction: strong warm shadow retained,but footprint narrowed from1.65to.88tilewidth and height.30to.22tileheight. Each cube has its own visibly separated contact shadow;no spanning strip. Cache individual-shadow-16.

Happy strokes now appear on every cube during row entry and its charging hop. Each event captures a random1–3stroke count once,with centred fan angles and existing65ms stagger/cartoon scale bounce. Finite lifetime,same RAF;no paint-time RNG. Supersedes endpoint-only accents. Cache random-happy-strokes-17.

Charging and final-hop variation now captures a small profile per hop:25percent gentle tilt/60percent one turn/15percent two turns,random clockwise or counterclockwise,55–145percent of existing low lift,and85–115percent shape emphasis. Profiles stay fixed through pose-continuous burst handoff;no paint-time RNG/timer. Entry remains its existing nonrotating scale-hop. Cache varied-hops-20.

Hop probabilities superseded: independent50/50 full single rotation versus zero rotation (including rebound),and50/50 previous maximum lift1.45 versus40percent lower1.45*.60=.87. Captured once per charging/final hop;rotating hops retain random direction. Cache equal-hop-chances-22.

New-row arrival advanced another30percent relative to current timing: captured descent deadline*.80*.70,with existing last-destruction lower bound retained. Entry animation duration and debris remain unchanged. Cache arrival-earlier30-23.

New-row entry chooses an origin once per row: left edge,middle or two-thirds position (equal chance). Delays follow distance outward from that origin,normalised to retain the previous overall entry duration. Same delays drive PNG entry,happy strokes and landing smoke. Existing earlier arrival preserved. Cache random-entry-wave-24.

Idle: after a quiet1.4–3.2s pause,a captured random3–6cube group makes a finite neighbour squeeze wave in either direction,6–10.5percent width squash with inverse height and tiny lateral nudge. No upward jump/rotation/new gap. One cancellable timeout sleeps between phrases;the existing RAF paints the roughly1s phrase then stops. Gain/reset/hidden/pagehide cancel it;no background catch-up. Cache idle-cuddle-25.

Emotion strokes capture a fresh random group tilt(±.32rad) plus individual angle variation(±.12rad) per appearance. Count remains1–3;angles remain stable throughout bounce/render. Cache random-accent-tilt-26.

Idle strengthened: pauses now450–1100ms(previous1400–3200),width swell18–30percent plus soft height inflation/squeeze. Each swollen cube pushes all neighbours outward by half its extra width,retaining touching adjacency;positions and shape restore together. Same finite phrase/single cancellable sleeping timeout. Cache strong-pushy-idle-27.

Living cubes supersede group idle waves: one captured cube stretches30–50percent taller,bulges sideways,pushes neighbours,and exhales.65percent chance of an eligible adjacent equally-filled settled cube hopping over it while it slides into that neighbour's place;identical charge-state textures preserve the meter at rest. Single phrases recur with120–420ms pauses throughout fill,including active/auto filling;gain no longer cancels them. Burst/reset/hidden still retire them. Existing charge poses layer underneath and retain floor bounds. Same owned timeout/RAF. Cache living-cubes-28.

Living-cube phrase/exchange now shares jumpDuration620ms with charge hops. Swap begins after60ms preparation and finishes within that same620ms phrase;breathing compressed to the same duration. Removes previous760ms wait and1600ms exchange phrase. Cache lively-exchange-29.

Exchange now reuses exact jumpPose charging motion for both cubes,with one full rotation each and captured ordinary lift/shape/direction. First moves along its60–440ms flight;second begins its own complete hop at first70percent flight(326ms after phrase start). Both retain full620ms squash/stretch/landing rebound;total overlap phrase946ms. Non-exchange breathing unchanged. Cache happy-hop-exchange70-30.

Additional charging switcharoo: a rotating newly charged cube can move to its already-filled settled left neighbour;that neighbour follows into the vacated slot only after the first reaches70percent horizontal arrival. Shared handoff now inverts smoothstep(.636742509)=.70 (about302ms),rather than70percent elapsed flight. Both reuse charging hop/rotation;first overlays waiting neighbour. Admitted only when charge will fully cover both cubes and outside final burst,to preserve progress order. Ambient phrases wait until completion. Cache charge-switcharoo-31.

Swaps now choose any settled matching-colour slot across the entire row,not just adjacent. Only fully orange/orange or empty/empty pairs whose target charge also matches are eligible. Removed changing-colour charge-switch admission;ordinary charge hops remain. New progress reaching a trading empty slot cancels that trade before charging,to avoid airborne recolouring. Same joyful hops and70percent-distance second launch retained. Cache random-same-color-trades-32.

Ambient motion now overlaps finite phrases with a maximum4reserved cube participants:two independent swaps,up to4breathers,or mixed groups. Each cube belongs to one phrase;charging cubes are excluded from new selection. One existing sleep timeout admits phrases,the shared RAF paints all. Reset/burst/background clear the collection. Cache four-active-cubes-33.

Swap destinations now limited to20percent of full meter width from the original slot (24cubes:max4slot distance). Same-colour eligibility/concurrency unchanged. Cache travel-limit20-34.

Latest limit supersedes20percent travel/four participant cap:destinations at most2slots away(skips at most one cube),maximum2simultaneous ambient animation phrases. A swap is one phrase with2participants;therefore2swaps may involve4cubes. Unique participant reservation retained. Cache two-idles-short-travel-35.

## Board lifecycle preview (HTML only,2026-11-07)

New buttons: **Dolazak ploče** and **Kraj igre · skoči i nestani**. Initial page load also runs board entry. Entry captures a Fisher–Yates shuffled slot order,random per-tile delay340–570ms flight duration,random start height and1–2rotations in either direction. Each tile falls vertically into its own slot,with the existing contact squash/rebound;the small HUD drops concurrently. No positional wave or render-time randomness.

Game exit captures current row poses/colors,stops ambient/auto/effects,then all visible cubes hop together. At440ms ground contact they shrink into their own bottom anchors over160ms and disappear,without below-floor travel or opacity fade. Closed state sleeps and disables gain/auto until entry/reset. Interruption/re-entry retires prior plans through same owner;hidden pages keep paused local clock. Existing full-meter shard cycle remains separate and unchanged.

Uses exact user-selected round Native LAB atlas copied into prototype assets/selected-round-fill-states.png. No Native/LAB build/install changes. Syntax/HTTP checks only;motion feel remains user review. Cache board-drop-and-sink-40.

CUA preview attempt: browser access host unavailable; no browser visual/motion acceptance claimed.

Board entry now captures2–4in-place ground rebounds per cube,with independent200–275ms durations,decreasing hop height,strong contact squash/release stretch and small final settle. Entry remains active through the last rebound. Game exit now shuffles takeoff order,per-tile delay,360–510ms flight,height,rotation count/direction/shape. Waiting cubes retain their captured pose;each collapses into its bottom anchor after its own landing. No uniform mass jump/disappearance. Same finite plans/RAF;no new timer. Cache random-exit-multi-bounce-41.

Entry rebound count reduced50percent:1–2instead of2–4;heights/shape/timing per rebound and exit unchanged. Cache entry-half-rebounds-42.

Entry gravity corrected:one shared48tile-heights/s² acceleration;fall duration is solved from captured height/initial velocity. Rebound launch speed derives from impact velocity with.30–.36restitution,then loses more energy each contact;flight duration follows the same gravity.26ms contact squash,subtler airborne shape,80ms settle.1–2rebounds retained. Exit rotation now an independently sampled fixed subset nearest14percent(3of24),one turn each;others zero extra turns. Random exit order/height/collapse retained. Cache gravity-entry-exit14-43.

Board entry now chooses50/50between existing gravity-drop and reverse exit. Reverse mode samples the exact shared exitTilePose backwards:grow from zero at the floor,hop/rotate with captured exit profile,settle into the slot. Same random delays/heights/14percent turns as exit. Whole-board mode is captured once;no per-frame resampling. Random dolazak chooses automatically;Samo drop/Samo reverse jump buttons let either variant be reviewed directly. Existing gravity entry,exit and charged-meter cycle retained. Cache two-random-board-entries-44.

Entry routing superseded:board load/reset ALWAYS gravity-drop with HUD drop. After full orange shatter,new row chooses50/50gravity-drop or zero-scale upward reverse-exit. No directional/wave arrival remains;removed obsolete wave planner/painter. Refill retains debris epoch,queued progress and auto;HUD stays still during refill. Review buttons now Dolazak ploče/Novi red·drop/Novi red·odozdo. Cache board-drop-refill-random-45.

Upward new-row entry now finishes with the same shared gravity/restitution rebound painter as top-drop. Captures1–2energy-losing rebounds from its hop height,26ms contact squash and80ms settle;entry deadline includes them. No extra drift/rotation during rebound. Cache reverse-gravity-rebound-46.

Latest steering:Restart uses upward entry. Downward entry starts2px below the mini HUD icons;physical fall time derives from the shorter height. Cache restart-up-hud-origin-47.


## Additional backpack/depth candidate · 2026-11-07

`backpack.html` is a separate candidate,linked from the retained original `index.html`. The original demo.js and its motion remain unchanged.24cubes form two12-cube arms,with stable per-slot depth/scale and back-to-front drawing. Original backpack artwork is cropped to its alpha bounds into prototype-only PNGs;the top HUD icon is removed in this candidate and the backpack sits centrally. Matching rank on both arms starts together,colors advance from both outer edges inward. Full charge gathers cubes toward the bag,then bag bounce->scale to zero->backOut enter->new row. Existing finite board entry/exit,controls,paused demand RAF,two-preview rendering,ResizeObserver and idle cadence stay candidate-owned. No audio/haptics/persistence/runtime-game imports. Two backpack images decode once alongside atlas;hidden/pagehide stop work as in original.

No QA suites/tests run per user request. JS syntax checked while fixing an initial depth/count initialization order issue. Native Safari preview visibly renders artwork,depth offsets,matched left/right25percent fill and inward progression;full-charge click returned to new row/Cycle1. Original variant remains linked and intact. No Native/LAB build/install or runtime artwork change.


## Reference-led depth and upper-cavity intake · 2026-11-07

Replaced random depth offsets with authored left/right profiles:continuous shallow sag/rise toward backpack,two stacked accents,stable back-to-front depth/scale. Endpoints moved outside bag sides so stacks stay visible. Ambient exchanges only use compatible height lanes. Full charge first opens bag through5existing animation poses,then paired inner-to-outer flights arc above the bag and descend into its upper cavity. Bag/cavity paints behind flying cubes;original foreground lip/body is repainted over them,so cubes pass inside instead of shrinking toward the front panel. Bag stays still/open until final arrival,then previous bounce/collapse/enter. Images are alpha-cropped prototype copies only. No QA/tests or Native changes.


## Left-to-right grey empty material,orange-only accents · 2026-11-07

User returns to original left-to-right HTML variant. Only fully orange displayed cubes(amount>=.999) can paint excitement strokes;charge accent starts at240ms after the orange crossfade completes. Empty/partial cubes have no strokes,including entry. Empty areas of the four original atlas poses are repainted once in prototype canvas decode using reference soft warm grey#E7DFD7,retaining luminance shading and alpha;orange fill remains unchanged. Original PNG files and separate backpack candidate untouched. No QA/tests or Native changes.


## Static Native HUD distance reference · 2026-11-07

User steers magnet idea to layout first:static fake Native HUD and first board row only. Added inline SVG390x235reference above original animated demo. Original Native backpack/trophy/combo/close/paper/tile/ghost/divider copies live under prototype-only assets/native-reference. NativeGameplayChromePlan and NativeBoardGeometry iPhone390x844/safe47+34 give row center67,Backpackx118/34pt,trophyx192/28pt,meterx24,width342,LAB cubes109.5..124,flat95percent divider y128,board top132,tile60.8/stride70.3. Close position and combo text slot are illustrative approximations. Not a pixel-identical Native screenshot. Static no clocks/audio/input/save;shard magnet remains pending layout review. No QA/tests or Native changes.


## Mini HUD shard magnet + late bag opening · 2026-11-07

Added requested animated preview in existing small HUD,with actual backpack image replacing placeholder and explicit Shardovi u ruksak button. Mini canvas spans HUD+meter;target cached from actual icon geometry on resize. Shards scatter65–140ms,then follow captured varied accelerating cubic magnet arcs230–430ms into icon,shrinking only near arrival. Existing single paused demand RAF paints both scales;new row still enters only from below at half lift and overlaps final arrivals. Receipt-owned finite bag bounce. No audio/save/Native change.

User further requests opening only once shards get very close and faster closing. Each preview admits opening only within18px of target;5existing image poses animate opening45ms and closing60ms immediately when intake empties. Late-opening/closing uses same paused clock and no new timer. Original PNGs preserved. No QA/tests. JS syntax checked;Safari page/preview button observed,but preview click tool timed out,so no final visual acceptance claimed.


## Static Native board layout editor · 2026-11-07

/board-editor/ is a standalone static390x844Native-point SVG layout using copied original density assets/fonts and literal Native phone geometry:safe47/34,HUD67,meterfloor124,divider128,gridtop136,tile60.8,stride70.3.5x9sample occupancy follows supplied reference. Select/drag/nudge/scale HUD,individual controls,meter,divider,grid/footer;divider width/alpha/art-or-line and fill/style controls;local draft retention,reset,JSON export/copy with Native y-direction mapping. No animation clock or runtime-game import. Source/assets SHA256 manifest included. Native source positions match;pixel-identical rasterization has not been certified. Native Safari visibly rendered full board/assets,4pt divider input moved reported128->132,and reset restored128. No QA suites/tests. Existing motion previews retained.

Latest motion steering applied both original HTML and LAB:only upward initial/refill entry(no top-drop solver),40percent higher hops,longer per-profile square-root-height timing and random captured lift.
