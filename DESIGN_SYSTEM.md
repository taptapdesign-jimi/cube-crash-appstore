Journey score-history copy (Native, 2026-10-31): title “High score”;subtitle “Your best scores so far” for all history counts. Combo and gameplay HUD copy unchanged. Same layout/fonts/colors. Historical captures retained under standing no-QA/no-recapture policy.

Arcade modal title accents (Native, 2026-10-31): “One Lucky” and “Slow” use orange#E8744A;“Drop”/“Burn” retain brown#BE7C59. Endurance unchanged. Same28px ExtraBold font/layout. Historical measured captures retained under standing no-QA/no-recapture policy.

Slow Burn subtitle line break (Native, 2026-10-31): explicit two lines, “Special dice take longer” / “to drop onto your board.” Existing typography and CTA geometry unchanged. Historical captures remain under standing no-QA/no-recapture policy.

Endurance subtitle line break (Native, 2026-10-31): explicit two lines, “Clear rounds until” / “you run out of moves.” Font and CTA geometry unchanged. Historical measured captures are not refreshed under standing no-QA/no-recapture policy.

Arcade mode modals (Native, 2026-10-31): Endurance subtitle is “Clear rounds until you run out of moves.” All three mode Play/Continue buttons use90percent of their previous clamped width, retaining height,font,center and motion. Existing measured captures are historical; no recapture/tests under standing user policy.

Result paired CTA width (Native, 2026-10-30):Play Again/Exit result actions use previous local width×1.10,capped by existing viewport-48px bound. Same height,font,center and pair gap;Home/Journey card CTA metrics unchanged.

Journey selected-card CTA (Native, 2026-10-30):Play/Continue width is90percent of previous width;nominal238→214.2px. Height,font,center and vertical position unchanged.

History paper texture correction (Native, 2026-10-30):reduce bottom extension96→16px to retain original texture density/edge detail,while hiding only the narrow torn source fringe behind existing smooth corners.40px visible-icon padding retained.

History pixel padding / paper finish (Native, 2026-10-30):40px to first nontransparent trophy/combo pixel,compensating original transparent image margins. Main paper keeps aspect ratio via uniform cover and96px bottom extension crop behind smooth32px corners;source texture unchanged.

History modal vertical padding (Native, 2026-10-30):40px top to icon frame and40px below final result strip. Header and first-row offset shift together26px,retaining existing gaps.

Visible paper modal idle (Native, 2026-10-30):Best scores/Best combo and HUD Score/Combo now use shared6.8s modal float after entry,matching existing Backpack/Box/Arcade/Exit/Privacy popup ownership. Reduced Motion skips;existing suspension/drag clock and close/dispose retirement retained. Backpack Area55 section title is entirely #BE7C59 brown;selected two-word dice titles retain their existing first-word accent.

HUD current label (Native, 2026-10-30):both Combo/High Score use only Current in16px Medium,#BE7C59 brown. Saved dates keep16px Regular subtitle color.

Gameplay HUD High Score (Native, 2026-10-30):keep High Score/Your best score so far.;first row is exact current state.score labeled Current score,then up to2 saved best dated scores. Journey history unchanged.

Gameplay HUD Combo (Native, 2026-10-30):title Combo;restore Stack and merge quickly/to boost your score. First row shows actual current combo with Current combo label,followed by up to2 best saved combos with dates. Journey Best combo and High Score retain their existing presentation.

Combo wording (Native, 2026-10-30): title Best combo;subtitle Your longest combo in the game. in one line with width fitting,for Journey history and gameplay HUD.

History strip spacing (Native, 2026-10-30):4px between result cards, superseding8px;strip height62px and internal spacing unchanged.

History strip height (Native, 2026-10-30):72→62px, another5px less above/below centered result/date.

History strip height (Native, 2026-10-30):82→72px, reducing internal space5px above/below centered result/date. Other spacing unchanged.

History date divider gap (Native, 2026-10-30):16px, superseding24px.

History date divider gap (Native, 2026-10-30):24px between divider and date column;result-to-divider8px remains.

History paper-to-strip gutter (Native, 2026-10-30):32px, superseding40px. Inner result/date24px and inter-row8px remain.

Result history no ranks (Native, 2026-10-30): remove01./02./03.;score starts24px from strip left edge,date remains24px from right edge with divider. Paper-to-strip40px and inter-row8px unchanged. Supersedes rank notes below.

History paper-to-strip gutter (Native, 2026-10-30):40px from main paper edge to inner result cards;row rank/date insets remain24px.

Gameplay stat history and padding (Native, 2026-10-30): Combo/High Score HUD modals put mode icon above title, original explanation below, then up to3 actual best results with dates. HUD retains own backdrop;source gameplay remains paused. History outer side margins40px,score-row left rank/right date padding24px,strip gap8px. Width fitting retained.

Result history count (Native, 2026-10-30): show only existing saved results, up to3;no placeholder rows. Modal height and subtitle follow actual count. Zero history shows No saved runs yet. Actual records without a date use --/--. Supersedes all fixed-three/empty-row notes below.

Best scores empty dates (Native, 2026-10-30): empty score rows show --/-- in the date column, replacing Keep merging.

Best scores rank refinement (Native, 2026-10-30): brown ranks 01., 02., 03.; a vertical subtitle-colored divider separates score from the right-aligned date/hint. Rank column is44px;8px gaps retained.

Best scores rank layout (Native, 2026-10-30): replace inner trophies with brown 26px Bold ranks 1/2/3; score shares the same centered row, date aligns at far right. Keep 8px column/strip gaps, outer trophy, paper and title. Supersedes the earlier stacked score/date row.

Best scores update (Native, 2026-10-30): Journey High score tile opens Best scores. Each of the three paper strips places a 62px trophy left, 30px Bold orange result above 16px Regular date on the right, both left aligned; no vertical divider. Empty slots keep a dash above Keep merging. Top combos keeps its existing layout. This supersedes the score-row layout described below.

# DESIGN SYSTEM — Stack to Six Native

Result history (Native source, 2026-10-30): titles Top scores and Top combos; exactly three layered paper strips, without rank labels. Missing records use centered 18px Bold/16px Regular brand-voice copy, never fake scores or dates. Mode-specific trophy for high scores and lightning for combos. 32px ExtraBold title #BE7C59; 30px Bold orange result with dot grouping and width fitting; 16px Regular date #CF9373 to the right of a vertical divider. Density-aware original paper grain keeps its aspect ratio, with 22px continuous rounded strip corners and a soft warm shadow; outer paper corners are 32px. This supersedes the rejected rank-badge draft; captures remain pending under the no-tests/no-recapture instruction.

Backpack/Box section headings (2026-10-30): Forest, Beach, Area55 and Arcade use **#BE7C59**, **28logicalpx ExtraBold**.

Current Native source palette (2026-10-30): modal and navigation titles **#BE7C59**, subtitles and secondary stat/result labels **#CF9373**. Historical captures below have not been refreshed under the current no-tests/no-recapture instruction; their measured colors describe the old captures.

Current measured design reference: [Full design system inventory](design-library/typography/DESIGN_SYSTEM.md).

Visual reference: [DESIGN SYSTEM](design-library/typography/index.html), served locally at http://127.0.0.1:8766/.

Before typography, title, subtitle, CTA or design-consistency work, read the inventory and inspect the relevant annotated screenshot. User-facing sizes use logical design px.

Whenever UI styles change, update the affected actual Native captures, measured values, visual page, generated Markdown and portable ZIP in the same task. The generator is `design-library/typography/capture/build_library.py`; capture workflow is in `design-library/typography/capture/README.txt`. Runtime Swift source remains authoritative.

On-page dog inspector: [ASSISTANT.md](design-library/typography/ASSISTANT.md). Start `python3 design-library/typography/serve.py --port 8766` for optional AI endpoints; local comparisons also work offline.

Focused manual comparison: choose an element, pin A with Usporedi, browse and choose B. The A/B dialog compares captured crops and base font/size/color values; no API connection is required.
