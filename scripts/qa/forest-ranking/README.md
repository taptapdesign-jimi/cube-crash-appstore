# Offline Forest ranking experiment

This is an analysis tool, not a runtime feature, solver proof, or release gate.
It never connects to a Simulator/phone or reads/writes a player profile.

Run from the repository root (requires the installed Swift toolchain):

```sh
python3 scripts/qa/forest-ranking/run.py --seeds 300 --output /tmp/forest-ranking-raw.jsonl
python3 scripts/qa/forest-ranking/analyze.py /tmp/forest-ranking-raw.jsonl --output output/forest-ranking-analysis
```

The runner copies the existing `NativeSourceInitialBoardRecipe.swift` unchanged
into an isolated temporary executable and links the current gameplay-core and
gameplay-state packages. It invokes their real move legality, merge, special
transactions, meter receipts, HUD coin arrivals, streak reward and efficiency
arithmetic. No replacement gameplay/scoring engine or fabricated score inputs.

## Experiment

- Ten Forest boards, independently starting at score zero.
- Identical opening seed across three visible-state move heuristics: conserve
  special dice, build deeper stacks, or prioritize special activation.
- No heuristic can inspect future random draws. These are limited greedy bots,
  **not optimal solvers**. Their failure rate is not a human failure estimate.
- Replay each exact action path with four timing policies: continuous (0.65s
  logical intervals); pauses to keep the streak near half its continuous peak;
  pauses before exceeding four; pauses between every move.
- A 6s logical wait expires either real combo window (3.5/5.5s). No direct write
  to combo, score, tiles, reward count or terminal state is used.
- Magnet/Honey can add five combo increments atomically. A cap of four or one
  cannot prevent this; overshoots are recorded rather than altering gameplay or
  banning that special die. Thus low policies limit manually chained moves,
  not every atomic special increment.
- Complete all accepted special mutation and delayed meter receipts, then coin
  arrivals before choosing the next move. This is an explicit serial schedule,
  not a reproduction of concurrent rendered animations.
- TNT/Flower/Barrel explicitly use staged activation: commit activation/spawns,
  reserve live targets, commit each impact in captured order, then board commit,
  delayed meter arrivals and HUD coins. Impact-before-activation pilots are
  superseded and must not be used to fit thresholds.
- Stop each attempt at complete/fail or a strict 600-action diagnostic bound.
  Exhausting remainingMoves alone is not fabricated into a terminal outcome;
  only the existing resolver may complete/fail. Full Source NO MOVES coroutine
  timing is outside the experiment.

## Validation and output

The analyzer requires unique rows, legal paired trace equivalence, equal terminal
outcome/action/drop counts across timing policies, zero rejected receipt/state
validation errors, and independently checks every final-score sum. Failures and
bounded attempts remain in the denominator; only genuine completions receive
candidate stars. All failed attempts count as zero stars.

`runs.csv` contains every attempt without the bulky trace. `summary.csv` has
completion rates and completed-score distributions. `representative-traces.json`
retains the highest observed completed path for each board for reproducibility;
it is **not a certified maximum**. `analysis.json` contains checks, provisional
thresholds and held-out results. The first 60% of seeds fit the thresholds; the
remaining 40% evaluate them. Strategy variants sharing a seed are correlated,
not independent statistical samples. No human star/drop probability is inferred.

Experimental thresholds round up to 500 points: two stars is the midpoint of
the training cap-four and half-combo score medians; three stars is the midpoint
of the half-combo and continuous medians. Single-move timing is a diagnostic
lower reference, excluded from threshold fitting. These synthetic style anchors
are **candidates only**, not an endorsement of production fairness.

## Essential limits before changing the app

The production app uses a mounted Source presentation graph and a shared logical/
visual random stream. This tool uses synchronous core transitions and its own
seeded schedule. It does not emulate constructor/face/FX random consumption,
Source physical snapshots, overlapping transactions, mounted terminal ownership,
drag distance, animation duration, or realistic human decision time. App parity
must be established on representative production replays before applying numbers.

User clarification: Journey Continue follows Clean Board and opens a separate
level; each level is evaluated from zero. Cross-level score carry is an Arcade
concept. Every experiment follows that rule. An earlier inference from static
Journey continuation code is **not accepted evidence** of observed app behavior
and is excluded from this report's diagnosis. This experiment does not change
any continuation, save or score owner. Same-attempt save/resume is separate from
starting the next level and must preserve that attempt's earned score.

Do not derive a new three-star score from a theoretical perfect bot, impose an
unreachable mandatory combo, infer player odds from equal synthetic style counts,
or downgrade earned cards. Existing stars/Legendary require a durable non-decreasing
award before any threshold increase. A shared ranking function does not make
Forest thresholds valid for Beach/Area55, whose special pools differ.
