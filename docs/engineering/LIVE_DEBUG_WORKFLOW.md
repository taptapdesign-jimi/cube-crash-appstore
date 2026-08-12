# Stack to Six Live Debug Workflow

This is the authoritative workflow whenever the user asks to connect to the phone, observe one or more problems, reproduce an issue, or compare a physical build with the web build.

## Fixed targets

- Web test server: `http://localhost:5174`.
- Web source: `/Users/user/cube-crash`.
- Physical device: `iPhone 13 blue`.
- Native app: Stack to Six, bundle ID `com.taptapdesign.stacktosix.Stack-to-Six`.
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
3. Make the fix visible first on `http://localhost:5174` and prove that Vite is serving the current source.
4. Ask the user to test the natural flow on the web.
5. Do not sync, build, or install the fix on the phone until the user explicitly says the web result is satisfactory (for example **RADI**, **ZADOVOLJAN**, or an equally clear approval).
6. After approval, run the required deterministic and iOS gates, sync only Stack to Six `Web.bundle`, verify the final `.app` bundle ID and packaged source, and install over the existing app without uninstalling.
7. Repeat the same physical capture. Completion requires the user to confirm the phone behavior and the trace to agree.

If the user explicitly asks to skip or reorder a step, follow that instruction while preserving native identity and destructive-action safeguards.

## Persistent session record

After a live-debug session or meaningful fix, update `CURRENT_HANDOFF.md` with a concise record containing:

- local date/time and timezone for **KRENI**;
- each user problem marker in order, with local time and exact wording;
- local date/time for **GOTOVO**;
- relevant trace prefix and evidence;
- diagnosis and changed files;
- web URL and user approval state;
- whether `dist`, Stack to Six `Web.bundle`, the built `.app`, or the phone changed;
- the remaining next step and QA verdict.

Never claim a phone installation or physical confirmation without separate evidence for both.
