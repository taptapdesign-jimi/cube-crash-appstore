# Secondary Clean Board result repair

User physical report during wired KRENI/GOTOVO: missing stars, perceived score decimals and wrong Play Again/Exit CTA. This three-file packet is independent of primary Scene/clock/Core integration. Exact candidate `/tmp/native-cleanboard-repair` is previously accepted Home/drop/pip plus existing tested Juice/TNT correction and this result packet; no phone installation.

Root cause proved: setting UIImageView.frame while filled-star transform is zero collapses bounds. Original setter with new real mounted test fails six dimensions; unchanged fixed candidate passed11/11 NativeResultOwnerTests, including repeated zero-scale relayout and plain1234 score. Fixed result uses existing bounds/center placement. Source empty-to-filled animation/earnedStars thresholds unchanged. Screenshot `/tmp/native-cleanboard-attachments/FF379582-DBD9-473B-8776-BAC30C20DF2F.png` reviewed: one gold/two empty, score650 and outside-card CTAs visible.

Score Int.formatted() supplied locale grouping, not fractional arithmetic. User explicitly requests plain digits; String(Int) now prints1234 without a dot/comma/group separator. Bonuses/rules unchanged.

CTA v9 primary#e97a55/text#fffbf2/shadow#c24921 at8px/textshadow2px; secondary white/text#ad8675/border#eaded7/shadow#d8c7bb at8px. Mobile/tablet CTA width restored to v9 249px (64px height); larger viewports retain310px and all widths retain the80vw cap. Original result entry/exit/admission retained. This packet corrects static style; does not introduce a duplicate global CTA animation owner.

SDK1 10/10 PASS; before-fix single regression FAIL6 assertions (expected proof); final SDK2 11/11 PASS, actual results `/tmp/native-cleanboard-{qa,qa2,before-qa}.xcresult`. Full shared source18/19 PASS,530suites4010tests/KING24/330 PASS; feature-runtime FAIL for nine primary registered helper/test files not materialized in shared tree. Do not fix that by overwriting primary private integration or declare full PASS. Evidence `/tmp/native-cleanboard-full.log`. Physical acceptance NEEDS PHYSICAL TEST. No asset/save/PWA mutation, commit/push/install.

Width correction: `/tmp/native-cleanboard-width-qa.xcresult` PASS11/11 NativeResultOwnerTests, including Clean Board and Fail249px geometry. No phone install.
