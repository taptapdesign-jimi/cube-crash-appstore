# Audio runtime architecture

Updated: 2026-09-25

This is the runtime ownership contract. Authored sources, gains and contact-frame
ordering remain in [the sound inventory](STACK_TO_SIX_INTERACTION_SOUND_INVENTORY.md)
and their feature modules. Gameplay KING and the asset-preservation order apply.

## Transports

| Transport | Runtime owner | Responsibility |
| --- | --- | --- |
| Decoded SFX Web Audio | `gameplay-audio-buffer-player.ts` | One lazy AudioContext, shared decoded-buffer cache, bounded/namespaced voice IDs, pending decode/start receipts, gain/rate/delay/stop automation, context recovery and voice cleanup. |
| Soundtrack Web Audio | `soundtrack-manager.ts` + `main-theme-web-audio-transport.ts` | Separate context for the main theme and Arcade Calm/Active voices; sample-accurate loops, audio-clock fades, route/result mix and foreground recovery. |
| Detached HTMLAudio | Feature `*-sound.ts` owners | SFX fallback when Web Audio is unavailable; mobile Journey Worlds, Forest World and Forest gameplay loops intentionally use this transport. Soundtrack has its own media fallback. |

`SoundtrackContextRecovery` deduplicates resume attempts. `soundtrack-audio-clock-volume.ts`
owns native gain envelopes. Do not add another context, global player or generic
media cache to implement a feature cue.

The SFX cache normally retains up to32 MiB on mobile and64 MiB on desktop. Active
and pending sources are protected, so the budget is not a hard total-process
memory cap. The compatibility long-loop slot accepts one loop above24 MiB and
at most36 MiB plus16 MiB of effects; mobile Journey loops no longer use that slot.
The separate soundtrack, media decoder memory, in-flight decode allocations and
native allocations are outside this accounting. Idle buffers under budget are
intentional reuse. Stop does not imply cache eviction; OS pressure releases idle
entries. Never flush the cache routinely on Continue or Play Again.

## Ownership boundaries

| Event | Authoritative behavior |
| --- | --- |
| Committed gesture/merge/visual contact | Feature module selects its authored cue once and requests its own voice. Settings must be checked before starting. |
| Board entry or committed Special spawn | `special-sound-warmup.ts` prepares the actual live/restored families; carrier preparation selects Arcade crate versus Journey backpack. Explicit family preload can prepare the package. Single-cue playback must touch only that cue's sources. |
| Sounds OFF/ON | UI commits Settings, then calls `applyGameSoundsSettingToAudio` for **both** values. OFF immediately retires all decoded active/pending voices, then lazily stops every registered SFX owner. ON invalidates the prior cleanup generation; it does not replay sound. Music remains separate. |
| Diagnostic audio isolation | `thermal-audio-isolation.ts` controls opt-in suppression. Engine and soundtrack block context/fetch/decode/start, retire their current runtime and expose draining work. Thermal SFX fallback cleanup delegates to the same owner registry as Settings. |
| Hidden/pagehide | The SFX engine invalidates pending playback generations, stops decoded voices and suspends its context without purging reusable buffers. Old transients never replay on foreground. Journey long-loop lifecycle pauses detached media and restores only a still-current logical owner. |
| Foreground/native active | Context recovery is centralized. A native-active receipt may compensate for stale WKWebView `document.hidden`; timers and ordinary route callbacks may not. Only a current route/loop owner may reacquire playback. |
| Board reset, route exit, result replacement | Existing board/scene/modal owners stop their sound families synchronously. Result hooks release the current soundtrack receipt on natural end or explicit stop. These local boundaries remain independent of global Settings. |
| Normal visual completion | Explicitly permitted authored one-shot tails may finish. Forest/Area55 Board Transition completion preserves tails; replacement, error and hard abort stop the package and delayed cues. Never substitute global cleanup for an intentional visual-tail boundary. |

`gameplay-sound-owner-registry.ts` is the **only global SFX full-stop list**. Its
39 lazy module loaders reference40 full-stop functions, including both Arcade
and Board Transition digit owners and decoded-only UI cues. Imports are serial;
caller generation/predicate is checked before import and before every stop.
One failed import/stop does not prevent remaining families from being attempted.
Completion means the cleanup sweep finished, not proof of native decoder silence.

The three Journey loop owners use `journey-long-loop-lifecycle.ts`, with a maximum
of four retained media elements. Their sessions own visibility/pagehide/pageshow/
native-active listeners and remove them on retirement. The World hold uses one
absolute5s deadline followed by its1s fade; a return does not extend that deadline.
Detached short SFX still belong to their feature owners; they must release their
own fallback handlers/timers and are not counted as decoded voices.

## Feature modules and shared infrastructure

Feature modules retain cue IDs, variants, gain/rate, delay and authored stop/tail
policy. The engine owns transport and cache policy. The global registry owns only
full-stop enumeration; it must not import the board, choose routes or start cues.

Families remain distinct:

- Gameplay: pickup/return, ordinary stack, regular merge6, landing and NO MOVES.
- Navigation/CTA/Home: activation, icon, close, slider and exit-modal enter.
- Journey/carriers: card flip, three loop owners, backpack and Arcade crate.
- Results/transition: Fail, Clean Board, Arcade Stage Clear, digit and Forest/Area55.
- Specials: Star, Bee, Flower, Honey, TNT/Barrel, Fish, Beach Ball, Bottle,
  Juice, Magnet, Robo Cube, Kanta, LaserGun and Spaceship.

LaserGun/Spaceship decoded preloads keep their explicit family APIs. HTML fallback
allocates the exact requested cue only when playback becomes unavailable; there
is no separate unused media preload pool. Bottle's single-cue call does not
refresh/redecode its other five package members. Juice's media fade releases its
interval on natural end, error, replacement, stop and rejected playback; callbacks
from a prior generation cannot retire the replacement.

## Contract for a new cue owner

1. Name the semantic event owner and family; preserve authored assets and gain.
2. Use the existing decoded engine or an explicitly justified existing media
   transport. `pending` is accepted playback, not a request to start a fallback. Native
   startup rollback releases only that failed attempt; it must not emit the
   lifecycle cancellation receipt before a still-owned fallback can run.
3. Give each simultaneously audible cue a stable or bounded sequence-scoped voice
   ID. Guard delayed/deferred callbacks with the owner's generation/token.
4. Export an idempotent no-argument full stop. It must invalidate pending starts,
   cancel every timer/fade, detach media completion/error handlers, stop all owned
   decoded/media voices and settle lifecycle receipts once. Partial/tail-preserving
   stops may coexist but are not substitutes in the global registry.
5. Register that full stop once in `gameplay-sound-owner-registry.ts`. Do not add
   another Settings/thermal stop list. Do not put playback or asset warming in a
   stop callback or module initialization.
6. Cover cold decode failure, replacement, stop, Settings OFF→ON→OFF, background
   and any deferred fallback with behavior tests against the actual owner.
   Registry completeness tests cover every media/timer/decoded cue module and
   explicitly distinguish partial stops from full stops.
7. Add or update the owner in `audio-runtime-owners.json`. New feature SFX owners
   must name their semantic event, family, transport, voice/preload/Settings/
   interruption policies, sound sources, idempotent full-stop export, registry
   membership, behavioral tests and physical acceptance boundary.

`npm run qa:audio-runtime` blocks a new audio-like source module or sound asset
reference without that record. It also blocks growth in raw Audio elements,
AudioContexts, buffer/decode primitives and audio-owned interval/RAF work outside
the frozen baseline. The baseline only describes pre-existing code and must not
be expanded to admit a new cue.

Forbidden patterns: fire-and-forget async cleanup without a current-owner check;
full-family cache probes for a selected single cue; preloaded media never consumed
by playback; timers whose only exit depends on media time advancing; old callbacks
mutating a reused element's newer handlers; natural-tail cleanup used as a hard
abort; constructor/preload work merely to answer a pure eligibility question.

## Diagnostics and acceptance

SFX decoded bytes/voice counts, soundtrack bytes/voices and
`getJourneyLongLoopAudioStats()` describe different owners. No one counter measures
all audio memory or all detached short media. Per-source decode/eviction diagnostics
are opt-in and bounded; normal resource sampling uses compact cumulative summaries.
A retained cache or a running empty context is not measured thermal causality.

Required source checks are focused owner/engine/registry regressions, type/unused
checks, lint, Gameplay KING and full QA. A successful source gate does not validate
iPhone media gain/fades, route continuity, decode CPU cost or sustained heat.
Those remain **NEEDS PHYSICAL TEST** on the authorized Stack to Six app.
