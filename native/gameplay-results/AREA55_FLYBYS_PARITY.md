# Native Clean Board Area55 ship flybys

`NativeResultArea55Flybys` ports `clean-board-area55-ship-flybys.ts` through the result owner's existing clock. It mounts exactly two original `ship1@2x.png` images as siblings behind/front of result content (depth0/1/2), with source62/74point widths and0.7/0.9 opacity. Plans preserve disjoint left/right corridors, edge selection, random draw order, quintic entry/exit blending, wobble frequencies, velocity bank bounded30degrees, depth scales and complete6700ms offscreen path.

The source bakes202 transform samples at30samples/second and rounds components to three decimals before linear compositor interpolation. Native stores those exact samples and interpolates their components, preserving translate3d's zero z geometry. The parent result clock owns foreground time. No second display link, timer, gameplay mutation or audio owner is introduced.

Only the selected original ship asset is prepared through `NativeResultConfettiResources`; a distinct per-generation lease covers both image users. Late preparation after disposal cannot read or attach the asset. Normal completion, source reduced motion and interruption clean up exactly once. Source reduced motion creates no ship/preparation work. Retired images are removed and release their shared lease.

Independent original TypeScript oracle:36plans /7272rounded poses /36360numeric assertions plus random draw counts PASS. Actual UIKit/shared-resource SDK typecheck PASS; four XCTest cases typecheck PASS and await Simulator execution/integration. Original PNG bytes remain unchanged. These checks do not certify physical iPhone visual feel, heat or audio acceptance.
