---
name: stack-to-six-art-style
description: Create or review Stack to Six artwork using its local visual library, including the recurring human and dog, Home hero illustrations, ordinary and Wild/Special dice, effects and Journey worlds.
---

# Stack to Six art direction

Use this folder as the persistent source of visual knowledge for new Stack to Six artwork. Read [STYLE_GUIDE.md](STYLE_GUIDE.md), then find the relevant family in [REFERENCE_INDEX.md](REFERENCE_INDEX.md). Resolve paths relative to this skill directory.

For every new illustration first read [APPROVED_RENDER_MASTER.md](APPROVED_RENDER_MASTER.md)
and open `style-masters/journey-approved-20261028.png`. User decision2026-10-28
replaces older character/render authorities with this single approved image.
It controls both visible Jimbo/Nala appearance and shared light, color, clean
surface treatment and roundness. Earlier paired/standalone character pictures
are historical unless explicitly needed for an edit pose/composition; they do
not override the new master. The dog's anatomical left ear may sometimes fold;
upright ears are valid. Consult actual prop/World/die references for shapes and
marks while retaining this render. Attach the master plus only relevant objects.
A master containing people/dog does not insert them into unrequested scenes.

Separate subject/action/composition from stable render and identity requirements. Preserve silhouette, face, proportions, costume, dog markings, materials, edge softness, lighting and palette from the chosen references. State which images informed the output. A new theme can introduce requested colors without abandoning the render language. Do not promise exact identity or automatic first-pass success.

For bitmap generation/editing, use the available image-generation capability and provide the selected reference images, following its local-image inspection requirements. Read its applicable skill first. For existing SVG/code-native assets, use the appropriate vector workflow. Do not generate images merely because this skill was loaded.

Before delivery, view the actual result and compare identity, proportions, materials, light/shadow, palette, perspective, silhouette and alpha edges against those references. Correct visible drift where the tool permits. Report limitations candidly; a generated image is not physical game acceptance.

Original assets remain protected: this library contains reference copies. Do not alter or refresh originals, change gameplay, integrate new runtime art, or change animation timing as a side effect. Generated candidates go in a task-specific subfolder of `game design/output/` unless another destination was requested. Only explicitly approved runtime art belongs in application resources.

This folder is development material outside app resources. Read [PACKAGING.md](PACKAGING.md) before changing its location or importing its contents into runtime code. Run `python3 "game design/scripts/verify_library.py"` from the repository root to verify reference copies and links. Copies are a dated snapshot; if originals changed, report drift and refresh only when requested.

Example request: “Use game design: create the existing human and dog playing in a Forest scene.” Read the pair and Forest references, attach them to generation, preserve both identities and the shared soft 3D render, then visually compare the result.

Explicit user correction2026-10-28: no drawn outlines/strokes/ink or colored contour lines, including thin beige/brown/peach borders. Full volumetric stylized3D with natural light/shadow/material-defined edges; no cel/toon-outline or line-art hybrid. Preserve physical glasses and intended graphic marks. Inspect the actual candidate edges against the approved master.

Latest explicit Jimbo correction2026-10-28: the Journey image remains the overall render/Nala master, while the two current Jimbo head/teeth details configured in `data/art-direction.json` supplement ONLY selected Jimbo. Inspect both originals: reference-matched oval skull, restrained cheeks and original jaw, proportionate glasses/nose, fewer larger rounded cartoon teeth. Do not elongate the head to act tired. See the latest correction section in APPROVED_RENDER_MASTER.md; it overrides older tooth-size prose. Never restore all historical identities or copy the detail scenes/props.

Latest explicit Jimbo face lock, 2026-10-29 (supersedes older two-head-only roles):
read the latest section in APPROVED_RENDER_MASTER.md. Studio automatically attaches
the original Journey @3x face source matching user reference 2 as PRIMARY Jimbo
face/design/material authority. Other approved heads are EXPRESSION ONLY, never
alternative skull/material masters. Preserve head, glasses, nose, jaw, ears, hair/
beard silhouette and teeth while changing expression. Remove linen/cloth weave,
fibrous skin and editor grid; retain quiet short hair detail and smooth warm 3D
shading with no drawn strokes. Existing original files remain unchanged.

Latest user correction2026-10-29: no puffed/bulging cheek or fat/widened head. Match the locked original Journey oval face contour; prior full-cheeks/broad-head wording is revoked. Fatigue changes eyelids/brows/mouth, never cheek volume. Read the latest cheek correction in the master guide.

Latest explicit Jimbo body-proportion correction, 2026-10-29: open the original Endurance full-body runner specified in APPROVED_RENDER_MASTER.md. Preserve long thin upper arms/forearms, narrow wrists, slim thighs/calves/ankles, narrow torso and a relatively large original head. Rounded hands and sneakers are larger relative to thin wrists/ankles without becoming dominant. No stocky torso, thick/padded limbs or baby proportions. Body reference does not override locked Journey face, Nala or shared rendering; running props/action remain scene-specific. Review actual limb thickness and head-to-body balance before delivery.

Latest explicit Nala correction, 2026-10-29: match the approved Journey dog with a slightly longer, forward-projecting but softly rounded muzzle, broad warm-brown nose, expressive eyes and playful continuous smile/jaw. No shortened baby-puppy face, pointed wolf muzzle or realistic long skull. Preserve the same cartoony rounded design and soft warm creamy volumetric 3D rendering with quiet fur detail; no drawn outlines or flat cel shading. Read the Nala muzzle/render section in APPROVED_RENDER_MASTER.md and inspect the actual reference before generation.
