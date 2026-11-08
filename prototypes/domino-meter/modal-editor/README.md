# Modal editor

Development-only static design tool: http://127.0.0.1:5188/modal-editor/

Uses the existing domino-meter server (port5188), original Baloo fonts, modal/button/board PNGs. No Native application, bundle or save access.

- Select a layer from the left or preview. Select Cijeli modal to drag the entire composition.
- Move with drag/arrow keys; Shift locks drag axis or nudges4pt. Center preserves worldY.
- Paper variants and editable paper/button/text colors retain PNG alpha and shaded volume. Non-default recoloring is an SVG grayscale-lighting tint preview; final Native color/render parity requires separate implementation.
- Text wraps to its width. Dimensions, font, scale, opacity, rotation and visibility are independent per layer.
- Scene dim/color and paper shadow amount/offset/softness are separate.
- Undo/Redo and draft persist in dedicated IndexedDB sts-modal-editor/data. Saved versions are separate named snapshots in that database. No board-editor storage mutation.
- JSON export/import uses stack-to-six-modal-layout/v1,390×844 top-left coordinates. Import accepts known scalar properties only,clamps geometry,validates hex colors and known materials,never imports markup/asset URLs.
- This preview does not apply changes to Native automatically.

Manual Safari inspection: loaded preview/original art; primary green swatch changed actual button with highlights retained; Undo restored original; saved Exit Stage · original and refreshed,retaining saved card/draft. JS syntax checked. No QA suites,Native build/install or modal/runtime change.

Native material correction: installed main .native bundle was inspected read-only and contains original01/02/03 papers. Their @3x source bytes match bundled images. Native Cut/Worn/Cracked now reuse those exact PNGs plus the Native source-atop white wash (RGB255,254.142857,252 at0.7),width-preserving adaptive middle joins and original alpha. Close BG uses the center96pt crop of selected source with the same wash,rounded mask,and original X PNG at0.8alpha. Default no icon recolor. Previous concept papers remain selectable;legacy default balanced drafts migrate to Native Cut. One bounded fitted-paper cache and3small Close crops;no game resources modified. Safari selected Native Cut and rendered paper/X inspected;no pixel-exact cross-platform claim.
