# Native regressions — 2026-10-25

User requested all-agent systematic repair. Existing worktree and assets preserved.

- PASS (implemented + mounted regression): Final merge: ghost popout → Code Cleared/thumb → retire board/HUD → separate New Card Unlocked → Clean Board.
- PASS (implemented + mounted regression): Interim fail return: Beach08 card remains aligned to its World island; shared Worlds regression.
- PASS (66 focused Native tests PASS): Exit modal: orange then white CTA use Fail bounce/tempo, begin earlier; restore pre-redesign CTA widths.
- PASS (66 focused Native tests PASS): Stacked orange/white CTA idle never expands their default gap.
- PASS (66 focused Native tests PASS): Background/foreground audio failure cannot replace playable board; bounded session recovery.
- PASS: 66 focused Native tests, gameplay/audio/feature gates, source qa:fast/full and independent read-only review (physical acceptance remains separate).
- PASS: Normal Debug BUILD SUCCEEDED; retained Jimi install-over/normal launchPID90840, exact binary hash and both saves verified; visible Exit pair and same-process foreground-return reviewed. Actual Silent Mode OFF.
- NEEDS PHYSICAL TEST: iPhone foreground audio recovery, final flow and animation feel; no phone install authorized in this task.

Owners: result_flow agent, journey_geometry agent, audio_resume agent, primary CTA/integration/QA.

Source qa:fast, qa:ios and no-sync qa:full PASS. Initial broad Bootstrap run exposes older renderer/untouched-save assumptions; preserved as evidence, no gameplay/save semantics changed to satisfy stale tests. Final targeted regression run follows.

Final focused Native run:66 tests,0 failures94.161s,`/tmp/native-five-fixes-final-sdk.log`. Includes real reward→result transaction, Journey HUD/footer retirement, Arcade HUD retention, all-World interim return390/768, paired CTA and audio bounded retries. Two test-only corrections: floating geometry comparison tolerance and existing0–1.6degree tilt range. Initial broader Bootstrap run has8 older failing methods (13assertions), documented separately from passing focused regression coverage.

Final no-sync qa:full PASS `/tmp/native-five-fixes-final-full.log`; final qa:ios PASS. Normal preview delivery receipt `/tmp/native-five-fixes-delivery.json`; build `/tmp/native-five-fixes-preview.log`. Current handoff contains exact evidence and historical test limitations. All requested source fixes/Simulator regression checks complete; physical acceptance remains NEEDS PHYSICAL TEST.

## Restart then Exit correction — 2026-10-25

User clarified Restart must visibly appear before Exit Stage as on Fail. Independent face-ready callbacks could invert order or consume the180ms stagger. Both bitmaps now join one entrance cohort;Restart0ms,Exit180ms,full340ms bounce each. Mounted regression deliberately delays Restart and proves faster Exit stays hidden until both can enter;24focusedEndRun/HUD tests PASS `/tmp/cta-order-sdk.log`. Independent read-only lifecycle review PASS. Normal build/install/hash/both-save checks PASS `/tmp/cta-order-delivery.json`;final fullQA/visible review recorded in handoff.
