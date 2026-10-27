# DESIGN SYSTEM — Stack to Six Native

Current measured design reference: [Full design system inventory](design-library/typography/DESIGN_SYSTEM.md).

Visual reference: [DESIGN SYSTEM](design-library/typography/index.html), served locally at http://127.0.0.1:8766/.

Before typography, title, subtitle, CTA or design-consistency work, read the inventory and inspect the relevant annotated screenshot. User-facing sizes use logical design px.

Whenever UI styles change, update the affected actual Native captures, measured values, visual page, generated Markdown and portable ZIP in the same task. The generator is `design-library/typography/capture/build_library.py`; capture workflow is in `design-library/typography/capture/README.txt`. Runtime Swift source remains authoritative.

On-page dog inspector: [ASSISTANT.md](design-library/typography/ASSISTANT.md). Start `python3 design-library/typography/serve.py --port 8766` for optional AI endpoints; local comparisons also work offline.

Focused manual comparison: choose an element, pin A with Usporedi, browse and choose B. The A/B dialog compares captured crops and base font/size/color values; no API connection is required.
