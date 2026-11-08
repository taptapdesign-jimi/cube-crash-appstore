# Modal paper candidates

Three blank transparent PNG resources generated with built-in image_gen. No runtime assets replaced or code changed.

- paper-01-worn: soft worn fibres and shallow creases.
- paper-02-cracked: branching edge fissures.
- paper-03-cut: more edge cuts and tears; no curled or folded-over corners.

## Dimensions

Consistent candidate exports: 390 x 544 (1x), 780 x 1088 (2x), 1170 x 1632 (3x). Original generated masters retained separately. Export scaling uses macOS sips; alpha verified in alpha-verification.json. These are standardized exports, not native generated 3x detail.

The existing assets/modals/paper@3x.png is 1170 x 1632 and @2x is 780 x 1088. Existing 1x is 390 x 525, unlike its density variants; candidates intentionally use consistent 390 x 544 logical geometry.

## Shared use requires adaptive drawing

No single fixed aspect ratio matches all current modal frames. NativeTabletLayout.paperWidth varies by viewport and padding; modal heights depend on content. Journey stage frame uses 326 x 481.76 scaled, and separate stage-info-card backgrounds. Current JimiNativeModalV10.paperLayout applies cover/cropping with contentsRect and masks corners. Directly replacing the original paper would crop new edge details and cannot preserve all torn silhouettes.

For future integration, use a shared adaptive paper renderer with preserved corner regions, alpha-aware silhouette and independently drawn edges/center. Nine-slice is a starting point but can elongate side cuts; repeating or separately placing edge wear is preferable for full fidelity. Start evaluation with 64pt corner caps (192px at 3x); this is a proposal, not validated runtime configuration. Keep external modal shadows owned by existing runtime. Content must remain inset from the deepest tear.

Resources are candidates for user review. Full fit on all phone/tablet modal sizes has not been rendered or accepted. Integration, runtime masking, stage-specific backgrounds and physical acceptance are separate work.

Prompts: prompts.json. References: prior three Cubero paper mockups in ../2026-11-06-modal-paper-variants/.
