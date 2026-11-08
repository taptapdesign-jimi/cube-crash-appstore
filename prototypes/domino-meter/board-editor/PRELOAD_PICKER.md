# Preloader preview and inspector navigation

The Preloader chip contains Cube editor preset selection and refresh for its saved versions. Profiles are copied into board design state; changing style never copies profile geometry over the existing meter transform,count,gap,width orarch. Snapshots share Cube editor material/color/gradient/front-mask functions and preset definitions. Continuous bars warp along the existing curve;tiles/stars use tangent rotation. This remains a static layout editor (no animation loop). Switching to the legacy meter control retires the copied profile.

Saved Cube editor versions are read from sts-cube-editor/data,never modified. Current profile snapshot persists through board Undo/history/versions/JSON even when that Cube version is unavailable later. Refresh reloads versions without overwriting current choice. PNG previews use one bounded latest raster cache;two decoded shape sources. Saved-board thumbnail sanitizer permits only bounded PNG data URLs in addition to existing local asset names.

Right inspector: Position/Appearance/Preloader/Arch & sync/Export chips retain original controls/handlers. Desktop body and board remain fixed;left item list and right controls own independent bounded scrolling. Header/layer picker/chips remain above the right scroll region;mobile keeps an internal55vh inspector scroll area.

Safari observed all chips and Preloader panel;actual curved Liquid row displayed with existing geometry. JS syntax checked,no QA suites/tests or Native change.

Bar silhouette: Tanki krajevi with independentstart/end taper lengths andtip thickness;shared withCube editor. Arch & sync:eachdivider canmaskpreloader onlyonBelow;above-curve navigationplane hidespreloader independentlyofartopacity. Navigationarch link matchesactualNativeheadercurvatureandcompensateswidth/scale;manualbendunlink. Neither checkbox changesdividerposition. Mask defaults off.

Live controls belowtitle:Auto/+1/+6/100/reset. OneRAFupdatesonlyaCanvaspreloadersurface;pauseswhenhidden andbakesstaticPNGbeforeexport/save. Fullboarddoesnotrerendereachframe. TreasuretrailmarkerssharedecodedSVGflag/HQgamechestbetweenbothviews,followarchandkeepreservedspace.
