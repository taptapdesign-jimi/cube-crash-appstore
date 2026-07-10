# Cube Crash documentation

Project docs live under `docs/` in four categories plus planning notes.

## Guides — start here

Living reference for development and onboarding.

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](guides/ARCHITECTURE.md) | High-level app architecture |
| [MODULES.md](guides/MODULES.md) | Module map and responsibilities |
| [DEBUGGING_GUIDE.md](guides/DEBUGGING_GUIDE.md) | Debugging workflows |
| [WINDOW_CC_FLAGS.md](guides/WINDOW_CC_FLAGS.md) | `window.__cc*` runtime flags |
| [BOARD_LEVELS.md](guides/BOARD_LEVELS.md) | Board level configuration |
| [BOARD_CUSTOMIZATION_GUIDE.md](guides/BOARD_CUSTOMIZATION_GUIDE.md) | Board customization examples |
| [BOARD_SPECIFIC_RULES_README.md](guides/BOARD_SPECIFIC_RULES_README.md) | Board rules API |
| [TEMPLATE_SYSTEM_README.md](guides/TEMPLATE_SYSTEM_README.md) | Template system overview |
| [TNT_ANIMATION_SPRITE_GUIDE.md](guides/TNT_ANIMATION_SPRITE_GUIDE.md) | TNT animation sprites |
| [SANITY_TEST.md](guides/SANITY_TEST.md) | Manual sanity test checklist |
| [REFACTOR_SUMMARY.md](guides/REFACTOR_SUMMARY.md) | Refactor history summary |
| [FAILING_ASSETS_LIST.md](guides/FAILING_ASSETS_LIST.md) | Known asset issues |

## Engineering

Technical deep dives, performance, and subsystem analysis.

| Document | Description |
|----------|-------------|
| [PERFORMANCE_OPTIMIZATION.md](engineering/PERFORMANCE_OPTIMIZATION.md) | Performance notes |
| [ANIMATION_EFFECTS.md](engineering/ANIMATION_EFFECTS.md) | Animation effects |
| [IOS_WEBVIEW_CRASH_MITIGATION.md](engineering/IOS_WEBVIEW_CRASH_MITIGATION.md) | iOS WebView crash mitigation |
| [BOARD_LIMIT_ANALYSIS.md](engineering/BOARD_LIMIT_ANALYSIS.md) | Board limit analysis |
| [BOARD_TRANSITION_CLEANUP_IMPROVEMENTS.md](engineering/BOARD_TRANSITION_CLEANUP_IMPROVEMENTS.md) | Board transition cleanup |
| [SPRITE_CONTAINER_POOLING_ANALYSIS.md](engineering/SPRITE_CONTAINER_POOLING_ANALYSIS.md) | Sprite pooling |
| [TEMPLATE_SYSTEM_PERFORMANCE.md](engineering/TEMPLATE_SYSTEM_PERFORMANCE.md) | Template perf notes |
| [TEMPLATE_STATUS_CHECK.md](engineering/TEMPLATE_STATUS_CHECK.md) | Template status |
| [TNT_WILD_ANIMATION_CLEANUP_ASSESSMENT.md](engineering/TNT_WILD_ANIMATION_CLEANUP_ASSESSMENT.md) | TNT/wild animation cleanup |

### Bubbles subsystem

All bubble animation assessments: [engineering/bubbles/](engineering/bubbles/)

## Release

App Store readiness and version milestone reports.

| Document | Description |
|----------|-------------|
| [LAST_STABLE_VERSION.md](release/LAST_STABLE_VERSION.md) | **Flag: last stable release** (`__CC_LAST_STABLE_VERSION__`) |
| [APP_STORE_READINESS_CHECKLIST.md](release/APP_STORE_READINESS_CHECKLIST.md) | Store readiness checklist |
| [RELEASE_READINESS_CENTER.md](release/RELEASE_READINESS_CENTER.md) | Daily release gate and iOS smoke flow |
| [APP_STORE_FINAL_CHECKLIST.md](release/APP_STORE_FINAL_CHECKLIST.md) | Final checklist |
| [APP_STORE_READINESS_FULL_AUDIT.md](release/APP_STORE_READINESS_FULL_AUDIT.md) | Full audit |
| [APP_STORE_QUALITY_DEEP_DIVE.md](release/APP_STORE_QUALITY_DEEP_DIVE.md) | Quality deep dive |
| [APP_STORE_RISK_ASSESSMENT.md](release/APP_STORE_RISK_ASSESSMENT.md) | Risk assessment |
| [APP_STORE_FINAL_ANALYSIS_V131.md](release/APP_STORE_FINAL_ANALYSIS_V131.md) | v131 final analysis |
| [V131_FINAL_REPORT.md](release/V131_FINAL_REPORT.md) | v131 report |
| [V112 / V117 / V118 reports](release/) | Version milestone analyses |

## Archive

Closed incidents and one-off postmortems — historical reference only.

| Document | Description |
|----------|-------------|
| [BOARD_13_CRASH_ASSESSMENT.md](archive/BOARD_13_CRASH_ASSESSMENT.md) | Board 13 crash |
| [STATS_SLIDE_INSTANT_JUMP_BUG_FIX.md](archive/STATS_SLIDE_INSTANT_JUMP_BUG_FIX.md) | Stats slide jump fix |
| [INTERIM_BOARD_CLEAN_MODAL_BUG.md](archive/INTERIM_BOARD_CLEAN_MODAL_BUG.md) | Interim board modal bug |
| [ANALYSIS_RESET_INTERIM_CLEAN_BOARD.md](archive/ANALYSIS_RESET_INTERIM_CLEAN_BOARD.md) | Reset interim clean board |

## Planning

Roadmap, ideas, and design briefs.

| Document | Description |
|----------|-------------|
| [ROADMAP.md](planning/ROADMAP.md) | Product/engineering roadmap |
| [BOSS_LEVEL_IDEAS.md](planning/BOSS_LEVEL_IDEAS.md) | Boss level ideas |
| [SHOP_DESIGN_BRIEF.md](planning/SHOP_DESIGN_BRIEF.md) | Shop design brief |
| [WILD_TNT_IMPLEMENTATION_PLAN.md](planning/WILD_TNT_IMPLEMENTATION_PLAN.md) | Wild/TNT implementation plan |

## Platform-specific

| Document | Location |
|----------|----------|
| Haptic setup (iOS) | [ios/App/HAPTIC_SETUP.md](../ios/App/HAPTIC_SETUP.md) |

## Conventions

- **New docs** go in the matching folder — never in the repo root.
- **Bug postmortems** → `archive/` once resolved.
- **Version reports** → `release/`.
- **How-to / reference** → `guides/`.
