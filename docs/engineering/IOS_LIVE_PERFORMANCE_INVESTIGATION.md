# iOS Live Performance Investigation

Use this playbook when Cube Crash feels laggy, jerky, heavy, or inconsistent on a physical iPhone even when web testing looks smooth. It formalizes the successful **SPOJI SE → KRENI → GOTOVO** workflow.

## Outcome standard

Do not call the issue solved from code inspection, tests, or a single improved trace. Completion requires:

1. the physical-device trace identifies and removes the measured bottleneck;
2. a fresh build is installed with the complete asset bundle;
3. the same interaction is measured again;
4. the user confirms the build feels fluid;
5. the new trace agrees with that feeling.

If the user still feels lag, continue investigating even when average FPS looks acceptable. A single 80–120 ms frame can explain a visible hitch.

## Protocol

### 1. Prepare a measurable build

- Preserve the current animation contract and visual feel.
- Add narrow diagnostics around the reported lifecycle only.
- Emit performance samples directly through the native `consoleLog` bridge when available. Do not rely only on Safari console forwarding.
- Capture one-second frame windows plus event-level drag/merge summaries.
- Include enough state to identify hidden work:
  - transition and enter-animation flags;
  - DOM child/image counts for hidden screens;
  - computed visibility/display/opacity;
  - active CSS animations and `will-change` count;
  - GSAP global timeline counts;
  - Pixi/animation-manager/resource counts;
  - board frame-budget state;
  - drag and merge durations/milestones.

### 2. Install the real iOS package

For the current native wrapper:

```bash
SKIP_NATIVE_BUNDLE_SYNC=true npm run build
mkdir -p dist/assets
rsync -a assets/ dist/assets/
rsync -a --delete dist/ "/Users/user/Stack to Six/Stack to Six/Web.bundle/"
xcodebuild -project "/Users/user/Stack to Six/Stack to Six.xcodeproj" \
  -scheme "Stack to Six" \
  -configuration Debug \
  -destination "generic/platform=iOS" \
  -derivedDataPath /tmp/stack-to-six-derived \
  CODE_SIGNING_ALLOWED=YES build
```

Before installation, verify the built app contains `Web.bundle/assets/tile.png` and the expected asset count. Never sync bare Vite output without restoring `assets/`; that produces an apparently installed but visually empty app.

Install only to the explicitly targeted device. Current test target:

- name: `iPhone 13 blue`
- CoreDevice ID: `0F62B71E-0B04-53C3-906E-EC28F5D2390B`
- bundle ID: `com.taptapdesign.stacktosix.Stack-to-Six`

### 3. SPOJI SE

Launch a fresh process and attach the native console:

```bash
xcrun devicectl device process launch \
  --terminate-existing \
  --console \
  --timeout 300 \
  --device 0F62B71E-0B04-53C3-906E-EC28F5D2390B \
  com.taptapdesign.stacktosix.Stack-to-Six
```

Keep the returned session ID. Confirm the app launched before telling the user **KRENI**.

### 4. KRENI

Give one short reproduction instruction. Ask the user to reproduce the natural interaction, not an artificial benchmark. For board performance, include transition, board pop-in, several drags, stacks, regular merges, and special/wild merges when relevant.

Do not interrupt or restart the stream while the user plays.

### 5. GOTOVO

When the user says **gotovo**:

1. poll the live session without sending Ctrl-C;
2. read the buffered output first;
3. only then stop the stream if needed;
4. compare exact one-second windows with lifecycle events;
5. state what is proven, what is only inferred, and what remains unknown.

Stopping first can lose the JavaScript telemetry and leave only native WebView/haptic messages.

## Investigation order

Follow evidence, but check these ownership layers in order:

1. **Hidden screen work** — DOM count, images, CSS animations, `will-change` layers.
2. **Async lifecycle races** — promises/imports/timeouts that finish after cleanup and rebuild hidden UI.
3. **Direct render paths** — callbacks that bypass a preparation guard and call `renderBoards()` directly.
4. **Asset work** — missing-path probes, decode/upload bursts, post-critical preloads running during transition/gameplay.
5. **Pixi/GSAP bursts** — object/timeline spikes correlated with the bad frame.
6. **Input cost** — distinguish slow pointer processing from slow renderer frames. A 0–2 ms drag handler with 40 ms ticker frames means drag code is not the bottleneck.
7. **Thermal/frame-budget response** — verify whether `reducedFx` activates because of real sustained pressure or one unrelated spike.

## Required reasoning discipline

- After one failed fix, stop adding speculative flags. Add provenance or ownership diagnostics at the bypass point.
- Compare counts over time. A hidden screen changing from 11/2 to 398/316 is stronger evidence than a generic “cleanup completed” log.
- Cleanup is not cancellation. Every async continuation must re-check ownership after each `await` and immediately before mutation/render.
- Guard both the initiating API and any direct renderer that can bypass it.
- Treat repeated 404/native scheme lookups as performance work, not harmless warnings.
- Remove unused fallback candidate lists instead of optimizing dead code.
- Pause post-critical work when Journey, transition, or board owns iOS. Critical gameplay assets remain exempt.
- Preserve premium bounce and enter/exit behavior unless the trace proves it is the bottleneck.
- Add a focused regression test for each lifecycle policy or decision extracted from the incident.

## Before/after report

Report concrete changes such as:

- hidden Journey stayed `11 children / 2 images` instead of `398 / 316`;
- transition worst frame changed from `114 ms` to `17–21 ms`;
- drag processing stayed `0–3 ms`;
- stable gameplay held about `16.67 ms/frame`;
- missing asset requests disappeared;
- `reducedFx` remained false or recovered normally.

Also report any remaining isolated spikes honestly. Do not hide a rare 80 ms special-FX frame behind a good average.

## Finalization

Run the strongest practical checks:

```bash
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
```

Install and repeat the same physical-device trace. Commit and push only when requested. Keep diagnostic utilities if they are cheap and reusable; remove noisy temporary logs that would distort normal profiling.
