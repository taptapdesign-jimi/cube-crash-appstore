# Stack to Six Live Debug Workflow

This is the authoritative workflow whenever the user asks to connect to the phone, observe one or more problems, reproduce an issue, or review a Native fix in the dedicated Simulator. User decision 2026-10-19 replaces the former web-first workflow: all Native checks and reviews use the dedicated Simulator, with no web approval step.

## Fixed targets

- Dedicated Native Simulator: `Jimi 2026 QA iPhone 13`, UUID `1018BE2D-491B-465F-8F75-3E5BEB38C22A`.
- Native project: `/Users/user/cube-crash/native/standalone/Stack to Six.xcodeproj`, scheme `Stack to Six`.
- Physical device: `iPhone 13 blue`.
- Native app: Stack to Six, bundle ID `com.taptapdesign.stacktosix.native`.
- Never use or modify the legacy Kockice Crash shell.

## Capture protocol

1. Read `AGENTS.md`, `PROJECT_CONTEXT.md`, `CURRENT_HANDOFF.md`, this file, and the applicable stability/QA instructions.
2. Inspect the dirty worktree and preserve unrelated work.
3. Connect the native console to the exact Stack to Six bundle on `iPhone 13 blue`.
4. Verify that the app launched. Only then tell the user **KRENI**.
5. After **KRENI**, keep the console stream alive and do not interrupt, restart, patch, build, or install while the user is reproducing.
6. Treat each user message such as `mili -problem -problem`, `problem`, or another reported symptom as a chronological incident marker. Record its arrival time and the user's exact wording. Continue capturing; do not assume the session is finished.
7. Wait for the user's explicit **GOTOVO**. A problem marker is not GOTOVO.
8. On **GOTOVO**, read the buffered console output before stopping the stream. Correlate every incident marker with the nearest device/runtime events and state what is proven, inferred, and still unknown.
9. Add narrow diagnostics with one searchable incident prefix when existing evidence is insufficient. Repeat the same KRENI-to-GOTOVO capture instead of guessing.

## Fix and approval order

1. Diagnose from the complete capture.
2. Implement the smallest owner-level fix with regression coverage.
3. Run the applicable deterministic and Native regression checks.
4. Build the normal Debug scheme from the complete current working tree, verify the Native bundle ID, install over the retained dedicated Simulator app, and launch normally for user review. Preserve data; do not leave a test runner as the preview.
5. Use this Simulator for all Native fix reviews. Do not require localhost, web approval, or a Web.bundle sync.
6. Install on the physical phone only when authorized by the user. Verify the final Native app identity and install over the existing app without uninstalling or resetting saves. Simulator approval is not physical acceptance.
7. When physical verification is requested, repeat the same physical capture. Physical completion requires the user to confirm phone behavior and the trace to agree.

If the user explicitly asks to skip or reorder a step, follow that instruction while preserving native identity and destructive-action safeguards.

## Persistent session record

After a live-debug session or meaningful fix, update `CURRENT_HANDOFF.md` with a concise record containing:

- local date/time and timezone for **KRENI**;
- each user problem marker in order, with local time and exact wording;
- local date/time for **GOTOVO**;
- relevant trace prefix and evidence;
- diagnosis and changed files;
- dedicated Simulator build/install/launch evidence and user review state;
- whether `dist`, Stack to Six `Web.bundle`, the built `.app`, or the phone changed;
- the remaining next step and QA verdict.

Never claim a phone installation or physical confirmation without separate evidence for both.
