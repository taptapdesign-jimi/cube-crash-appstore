# Native Wild/Special effects against approved PWA v9

Reference: immutable `production-benchmark-v9`, commit
`fc085599e759369900d5dc4135246a9f1355a897`. Native application only;
no preserved PWA source, bundle, asset byte or save changes.

## Connected family matrix

All trails now use the actual v9 registry/wooden-template palette, effective
shape, sizes, opacity, rotation, distance and lifetime. Main particles and
screen shakes run at the actual Source main boundary, not a later generic
finale or inferred gameplay callback.

| Family | Drag shape | Main shard family | Main shared smoke | Shake family |
| --- | --- | --- | --- | --- |
| Core Star | rectangle | Star | Special | Star/Juice |
| Core Juice | circle | Juice | Special | Star/Juice |
| Core Magnet | rectangle | Magnet | Magnet | Magnet + pull |
| Core TNT | rectangle | none, as v9 | none, as v9 | TNT |
| Fish | circle | Star | Special | Star/Juice |
| Kanta | rectangle, beige/cyan | Star | Special | Star/Juice |
| Bee | rectangle | Star | Special | Star/Juice |
| Cubero | rectangle | Star | Special | Star/Juice |
| Mushroom | rectangle | Juice | Special | Star/Juice |
| Robo Cube | rectangle | Juice | Special | Star/Juice |
| Bottle | circle | Magnet | Magnet | Magnet + pull |
| Honey | rectangle | Magnet | Magnet | Magnet + pull |
| Spaceship | rectangle | Magnet | Magnet | Magnet + pull |
| LaserGun | rectangle | TNT | Laser primary | TNT + beam contacts |
| Flower | rectangle | TNT | none, as v9 | TNT |
| Barrel (`barell`) | rectangle | TNT, original 0.7 size | none, as v9 | TNT |
| Beach Ball | rectangle | Juice visual family | none, as v9 | TNT gameplay family |

TNT-family target impacts use the original ordinary target shard profile and
family-specific shared smoke. Laser impact uses its smoke-only recipe. Magnet
pull has its separate original shard templates and impulse. Each admission is
fenced by transaction ID/phase so a late-final handoff cannot repeat main RNG.

Main shake now draws before main shards. Star/Juice capture eligible old board
objects without RNG at entry, then start their short blast after the main shake
and before publication creates new holders. Magnet pull retains the opposite
literal ordering: pull shards before pull shake. The actual complete-root matrix
records these phases from a varied deterministic RNG provider.

Direct and late-final Wild paths now separate main shards from main smoke,
with their actual hero/HUD publication between those phases. Each stage has its
own transaction fence so synchronous late-final publication cannot repeat RNG.
The matrix observes this connected boundary as well as actual RNG phases.
TNT mounts its authored presentation before shake. Shake captures the actual
transaction's weak physical carrier; old Laser callbacks cannot move a newer
TNT carrier. Core TNT's art and BOOM glyph field share that offset, matching the
original TNT overlay parent, and independently ignore retirement/replacement.
This verifies the selected recipes and boundaries, not equality of the entire
PWA event/RNG graph. Full multiplier/wild-impact event ordering and physical
acceptance remain separate verification work.

## Actual differences corrected

Native previously used one yellow trail for all Wilds, square geometry and
128px radial distance; v9 uses family palettes, rectangular dimensions and
96px distance. Native now preserves original effective TNT shape precedence,
including Beach Ball. Counts, distance cadence and lifetimes are retained.
Scene generation/effect retirement clears old trails; disposal releases the
pool. Pointer release and pure pause preserve the same finite tails.

Wild main/pull shards and screen shakes were absent from actual Source callers.
Defined special/Laser smoke recipes were also explicitly rejected by the root
renderer because deferred grouped bursts were unimplemented. Native now uses
actual delayed Source roots, draws each burst only when its callback runs, and
retains the parent's last rendered local time on reentry. No extra timer,
display link, SpriteKit shard action or gameplay decision owner was added.

## Spaceship continuation defect corrected

The complete Native root matrix exposed a real Spaceship destination stall:
`source_magnet_pull_unavailable`. Its pull called the canonical audio owner,
but Spaceship was omitted from both force-pull admission and the Magnet pull
cue mapping. Even Sounds OFF produced no typed captured silence receipt, so
the pending canonical special mutation could not finish.

The original v9 `playMagnetPullForceSounds(magnetVariantAtMergeEntry.id)` handles
Spaceship as core Magnet: foundation plus boiing, action gain1 and effective
Native gain0.6. Native now admits that existing authored group for Spaceship,
including once-only known-silence cleanup. No gameplay safety guard, voice
identity fence, authored cue or transport was replaced. Actual root source and
destination both settle and accept the next drag; captured cleanup tests also
verify old pull receipts cannot stop newer voices.

## Deliberate safety boundary in original pooled Source effects

The independent oracle executes the tagged smoke function AND its actual
GraphicsPool with GSAP 3.13. Normal selected Special/Magnet/Laser profiles
are compared exactly. It also records wide-gap and late-first-frame traces.
Those traces expose an original v9 defect: adding an empty child to a completed
parent invokes old completion against a recycled Graphics under a newer lease.
Independently observed at479/490ms; the original pool reset changes the visible
population59→58. Native keeps captured pool leases and fully authored children,
so old completion cannot steal the newly acquired carrier. Wide-gap/coarse
traces are evidence of that defect, not an expected safe visual output. They
have separate retirement/pause/reuse tests. This is an explicit safety
improvement, not a claim of exact equivalence to the pooled Source defect.

## Verification owners

- `scripts/native-oracles/drag-trail.cjs`: execute tagged original magicSparkles
  construction for all17 families,51 particle captures.
- `scripts/native-oracles/wild-screen-shake.cjs`: actual tagged screenShake +
  GSAP CSSPlugin for all9 distinct configurations and overlay baselines.
- `scripts/native-oracles/shared-smoke-deferred.cjs`: tagged actual smoke,
  actual pool, selected profiles plus separate pathological captures.
- `NativeWildMergeSixShardTests`: tagged actual shard construction for every
  variant/template, RNG order; shared Source clock pause and stale pool reuse.
- `NativeWildMergeSixRootTests`: actual complete Native app, all17 identities,
  both merge directions; active disposal, exactly-once main/pull/impact
  admissions, ordinary continuation and route ownership.
- `NativeBoardTests`: actual Scene pickup/movement/release for all17 trails.

Final compiled root matrix PASS34/34 scenarios (all17 identities, both merge
directions; one method/0 failures). Destination cases settle and continue;
Source cases verify active-main retirement. Separate Spaceship source and
destination full-continuation fixtures PASS. Selected final SDK batch PASS25/0,
including14 Source surface and7 captured-force audio tests. Final `qa:fast`,
`qa:full` (4010/4010; gameplay-lock330/330), audio runtime and Native original-byte
source audit PASS. Logs, compiled/install identity and physical acceptance are
recorded in CURRENT_HANDOFF. This FX patch was subsequently installed and launched on iPhone13blue at
17:24–17:25 CEST with the primary save byte-identical across installation;
see CURRENT_HANDOFF for exact Release identity and receipts. Deterministic
output and installation are not physical FPS or feel.
