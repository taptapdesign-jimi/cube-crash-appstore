# Cube editor

Development-only HTML studio: http://127.0.0.1:5188/cube-editor/

Separate from Native and the original motion demo. Uses the original selected-round-fill-states.png alpha/lighting as a128×128 material source, recolored into two cached canvases (empty/full). No original asset mutations.

Controls:
- Independent count,width,height,gap and row arch.
- Fill right,left,up,down;sequential or simultaneous distribution.
- Solid,linear and radial color,gradient angle,empty color,highlight,volume and deterministic grain.
- Squash/stretch,jump height,rotation chance,shadow,glow,expressions,smoke,shard density.
- +1/+6/full,manual pop/refill,auto and static fill sliders. Enlarged single tile and HUD-scale row share the materials.
- Named IndexedDB versions,session history/draft,Undo/Redo,validated JSON export/import schema stack-to-six-cube-design/v1. No localStorage or other editor database writes.

One demand-driven RAF samples analytic hops/shards. Quiet preview sleeps. Auto runs only when user selected it. Hidden/pagehide cancels RAF,clock does not accumulate hidden wall time;pageshow restores resize observation. ResizeObserver tracks exactly3canvases;pixel density caps2. PNG materials rebuild only on style changes,not animation frames. Shards are bounded by48tiles×existing template size and retired at refill. No media/audio/gameplay/save owner.

Preview uses a lightweight motion study,not a claim of complete Native timing parity. Safari visually inspected loaded editor,three canvas views,material/partial horizontal fill and controls. JS syntax checked;no QA suites/tests or Native build/install.

Puffy star variants: original yellow texture copies assets/modals/star@2x.png byte-for-byte (same artwork as supplied reference); alternate star uses the same alpha/lighting with editable beige-to-orange gradient. Shape selector, presets, Undo/history/saved versions and JSON retain the shape. Older designs normalize to cube. Both variants visually inspected in Safari; orange star left selected.

Preload-bar mode adds a fixed gray rounded holder with independent width/height/color. Classic,Liquid→/↑,Sludge,Gas andJelly presets use shared gradients/light/shadow/glow and bounded analytic front waves/particles. Surface animation is explicit via preset or Animiraj površinu toggle;pauses whenhidden and can stop independently of auto fill. Wave/speed/bubble controls underPunjenje,all4directions. Bar-inapplicable tile-motion controls hidden;count controls fillstep resolution and boundedburst. Existingtile/star designs remain default-compatible throughnewknownfields. Safari inspectedLiquid andGas main/enlarged/HUD views. No Native changes or QA suites/tests.

Treasure trail preset: rounded dashed path plus X endpoint,subtlegeometry-stablewave andsharedliquidfill. Emptyholdercolor controlsunfilledroute. Trail thickness andspacing editable;Xfillswithprogress. Samepreset/renderpathinBoardeditor,samearchpreservation.
