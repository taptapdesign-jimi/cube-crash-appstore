# Native board design editor

Open http://127.0.0.1:5188/board-editor/. Static phone composition uses390x844Native points,safe47/34 and source formulas/assets recorded in native-source-manifest.json. Existing previews remain separate. No game,animation,audio or save owner is imported.

Select a layer,drag it or edit X/Y/scale. Divider supports width,opacity,original PNG or flat line and line thickness. One outer responsive scale preserves all Native distances. JSON export/copy includes original anchors and explicit top-left/NativeY mapping. Export does not apply source automatically.

Undo/Redo tracks edits to every design value and reset. One drag is one history entry;arrow nudges and inspector events are individual entries. Cmd/Ctrl+Z undoes,Cmd/Ctrl+Shift+Z redoes(Ctrl+Y too). History includes initial Native baseline and persists across refresh in localStorage. A new edit after Undo starts a new branch. No arbitrary history depth cap;browser quota failure reports that persistence is unavailable while in-session Undo remains. Edits before this feature existed cannot be recovered individually;existing saved draft is retained as one entry above baseline.

Native source geometric positions are literal;sample cell occupancy/skins are illustrative. Browser/SpriteKit pixel raster parity is not certified. No QA suites/tests run per user instruction. Native Safari preview showed assets,divider4pt move and reset before Undo addition;Undo source syntax checked.


## Item area and per-element controls

12left-side slots hold board layers. Drag any layer into a slot to snap it there;drag it back onto board,or use inspector return/button,Enter or double-click. Dropping near its last position(18Nativept) snaps exactly back;otherwise positions stay free. Occupied-slot drops swap stored items. Cancel/outside drops restore the prior position. Position,scale,width,opacity,rotation,parking andslot assignment participate in persistent Undo/Redo. Existing drafts/history are normalized without losing prior entries.

Three initially parked navigation items use the original shared-header formula:transparent arched divider(32affine slices,no background fill),close X andbackpack with original tangent-based rotations. Their source/hash/formulas are in manifest. All elements have scale,width,opacity,rotation controls. Normal andarched dividers keep independent width/opacity. Small-cube count6..48,gap-2..60percent androw width determine side=availableWidth/(count+(count-1)*gapFraction);lower count automatically makes remaining cubes larger andalways fills exact width. Overall scale remains available. Export includes all new values and item states.

Source syntax checked. Native Safari visibly rendered slots andtransparent arch items. Actual pointer drag moved the HUD backpack into slot4 andback toboard;both were single Undo entries. No QA suites/tests or Native build/install.

## Independent cube arch

Select Male kockice,adjust Arch kockica directly(0flat,negative reverse,positive curved),or click Sync with divider arch to copy divider curvature once. Copy accounts for the cube row's current rendered span andboth scales. Position,width,rotation,count andgap stay unchanged;subsequent divider edits have no effect on cubes. Curve is centered on the row's existing floor anchor;each rigid PNG follows its own tangent.

This supersedes the earlier live-follow checkbox. Existing linked saved designs/history migrate into equivalent independent poses;existing unlinked drafts remain unchanged. Curve andsync participate in persistent Undo/Redo andJSON export. Safari actual Sync click retained pose/count/width andchanged0to47.7percent arch. Syntax checked,noQA/tests/Native build/install.

## Visual layer chooser

Odabrani sloj now shows an actual thumbnail of the selected current layer,its name andboard/inventory status. Expand it for12clickable visual cards;selected card is highlighted andparked items are marked. Thumbnails reuse SVG layer clones,current curve/count/fill andoriginal artwork. Choosing an item only selects inspector controls,without mutating design orUndo history. Safari expanded rendering observed;syntax checked,no QA/tests/Native build.

## Navigation backdrop andopacity colors

Divider · arch now includes original navigation background PNG clipped to its same lower parabola,behind content. Moving/scaling/rotating/arching orparking divider moves both. Opacity pozadine navigacije independently controls backdrop0..100(default100);divider opacity remains separate. All opacity ranges are yellow;other controls orange. New value persists in normalized drafts,Undo/Redo andJSON. Source/hash recorded in manifest;original artwork unchanged. Safari visible100percent backdrop/yellow controls inspected;syntax checked,noQA/tests/Native build/install.

## One-shot HUD rotation sync

Close,Backpack,Trophy+score,Combo andarched X/bag have Sync rotation with divider arch. It samples tangent at actual element anchor in divider local coordinates,respects both nestedHUD anddivider transforms,andchanges only elementrotation. No persistent follow orposition shift. Undo/Redo/export retain angle. Actual Safari Combo sync0to-3degrees observed.

## Saved versions

Below left itemarea,enter a name andclick Spremi ovaj raspored. New immutable card includes whole-state snapshot andfullboard SVG thumbnail. Click to load all positions/parking/scales/colors/arches/opacity/count/fill as one Undo step. Named snapshots persist independently of current draft/history in this browser/localStorage. Saving does not overwrite older cards. Errors retain prior list andofferJSON export. Safe generated SVG thumbnail copy uses namespaced clip/gradient IDs andoriginal localassets. Thumbnails rebuild only when saved list changes. Safari save→refresh→changeX→load restored originalX andrendered card/art. No QA/tests/Native build/install.

## Worn navigation paper candidate

Divider · arch → Papir navigacije selects original or Pohabani papir · pregibi i poderotine. New built-in-imagegen sibling has soft torn fiber details andfolded/crumpled planes,clipped by unchanged arch. Original stays default for oldlayouts. Choice persists in draft/history/savedversions/export. Source/prompt under game design/output/2026-11-07-worn-navigation-paper;manifest records editor PNGhash. Actual selectedSafari preview inspected,noNative integration.

White refinement: Papir navigacije also includes Izblijedjeli bijeli papir,generated bybuilt-in imagegen color-only edit ofwornv1. Nearwhite finish retains folds/peels;oldvariants preserved. Exactsource/prompt andeditorhash recorded. SelectedSafari preview inspected,geometry/opacity retained.

Wood candidate: Materijal navigacije → Blijeda pohabana drvena daska uses newbuilt-in-imagegen sibling guidedby actualgame tilewood andlogo palecream palette. Horizontalgrain,quietcenter,faintsideknot,wornsoftgrooves;allpaper options preserved. Source/prompt under game design/output/2026-11-07-bleached-wood-navigation. CurrentSafari selectedwood preview inspected at100opacity;noNative integration.

Solidwood correction: Pohabana daska · napukline i iverje uses v3freshwood candidate withangular splits,knot andchipped dents. Paperlike peels/folds removed;edge-to-edge paleivory finish. Oldwood preserved as firstconcept. Source/exactprompts andmanifesthash recorded;selectedSafari preview inspected,noNative integration.

Savedcard storage repair: versions nowuse IndexedDB(sts-native-board-editor/versions),independent oflocalStorageUndo limit. PriorlocalStorageversions migrate without deleting originals;newsave writes atomically thenimmediately shows small106px item-style card. Fullsnapshot loaded oncardclick,oneUndo entry. Safari save/refreshedretention/old-newcard switching observed. No broadQA/tests.

Secondarch divider: Divider · arch2startsparked infirstfreeitemslot. Ownpose,width,opacity,bend andbackground material/opacity(default0). Sharedrenderer uses uniqueclipIDs. Inventory14slots;oldlayout/history normalization preservesotheritems. CurrentSyncbuttons stillsample originalDivider · arch. Exportincludesbothprofiles. Safari newcard inspected,noQA/tests/Native change.
