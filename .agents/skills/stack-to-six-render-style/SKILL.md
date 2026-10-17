---
name: stack-to-six-render-style
description: Review or correct Stack to Six character illustration rendering when the user says "render style", asks to match their soft creamy character style, or requests lighter, gentler rendering. Supports image review, edit instructions and requested image edits; does not refer to SpriteKit, Metal or runtime rendering performance.
---

# Stack to Six render style

Use this skill when “render style” appears within a natural request, including
“daj mi pogledaj render style moj i popravi sliku”. Match the user's established
character illustrations rather than introducing a new art direction.

## Visual authority

Open these original project images before comparing or editing:

- `assets/logo addons/lik-game.png`: seated man with controller; authority for pale peach skin, light gray hair/beard, cream clothing, muted blue denim and soft material finish.
- `assets/logo addons/lik-lajna.png`: man playing tug with dog; authority for light cream/beige fur and muted taupe/brown markings, plus shared lighting and palette.

Paths are relative to the repository root. These match references 2 and 3 in the
user's style decision of 2026-10-17. Current user-supplied references and explicit
instructions take precedence. A candidate submitted for correction is the
composition reference, not automatically the rendering reference. If originals
are unavailable, use attached references; request missing images only when needed.
Do not pretend that a reference was inspected when it was not.

## Accepted finish

- Soft, friendly stylized 3D characters, rounded forms and expressive faces.
- The man has intentionally elongated cartoony arms and legs, a slim silhouette
  and expressive hands/feet. Keep these stylized proportions from the accepted
  references; do not shorten limbs, thicken the body or normalize anatomy toward
  realistic human proportions. Preserve foreshortening appropriate to the pose.
  In render-only edits retain the candidate's approved geometry. If the user also
  asks to match character proportions, use the references to correct them; do not
  stretch pixels or apply a uniform numeric limb multiplier.
- Light, airy, gently faded pastel palette. Warmth comes from creamy neutrals,
  pale peach and soft light, not an orange/yellow cast across the whole image.
- Man: pale peach skin rather than saturated orange/tan; light warm-gray hair
  and beard rather than dark, strongly contrasted strands; cream/off-white shirt.
- Dog: light cream/beige fur; subdued taupe/brown markings rather than rich
  reddish brown or golden-orange fur. Preserve the markings and character identity.
- Broad diffuse light, soft shadow transitions, restrained highlights and gentle
  local contrast. Keep rounded volume and readable facial features.
- Matte, soft materials with fine, quiet texture. References DO contain fabric,
  hair and fur detail: soften its prominence, do not erase it or blur the image.
- Denim stays muted dusty blue. Props harmonize with the references without
  making every material identical or bleaching purposeful accent colors.

Typical drift: excessive microdetail, etched/patterned skin or cloth, individually
emphasized hairs, crispy texture, dark creases/ambient occlusion, glossy edges,
HDR-like local contrast, saturated gold/orange lighting and over-realistic materials.

“Faded” means restrained saturation and contrast with lighter midtones. It does
not mean a white overlay, lost silhouette, clipped highlights, flat lighting or
an out-of-focus result. Do not invent numerical color/exposure corrections unless
requested or supported by a measured comparison.

## Follow the requested action

- **Review / “pogledaj”, “reci što ne valja”:** compare the actual candidate and
  references; explain the main visible differences concisely in Croatian. Do not
  generate or edit unless asked. For feedback to another creator, give short,
  paste-ready English feedback when appropriate.
- **Prompt / “napiši opis”:** provide a usable edit instruction with clear roles:
  candidate controls composition; accepted references control rendering/materials.
- **Edit / “popravi sliku”, “uskladi render style”:** perform the image edit using
  the available image editing tool and its imagegen skill. Supply both candidate
  and inspected style references. Preserve composition, pose, anatomy, proportions,
  expression, clothing design, objects, framing and transparency unless explicitly
  changed by the user. Correct rendering, color, lighting and texture emphasis.
  Do not stop at writing a prompt when an actual edit was requested.

Compare the result against the originals, especially skin orange cast, beard
brightness, dog fur, texture contrast and shadows. Report remaining visible
mismatches honestly; do not call the result a match without inspecting it.

For animation/SVG work, preserve authored timing, transforms and frame structure;
this skill does not authorize flattening animation into a still or replacing SVG
with a raster. Use the appropriate vector/animation workflow for that request.

Preserve supplied original assets. Produce a separate edited output; replacing a
runtime asset or installing the app requires the corresponding user task. A style
review or standalone image edit does not require an app build, Simulator refresh
or unrelated gameplay QA.

## Reusable edit brief

> Keep the existing composition, character identity, poses, expressions and objects.
> Preserve the character's elongated cartoony arms and legs and slim silhouette;
> do not normalize them toward realistic human proportions.
> Match the supplied Stack to Six style references for rendering only: light creamy
> colors, pale peach skin, light warm-gray hair and beard, muted dusty-blue denim,
> and a light cream/beige dog with subdued taupe-brown markings. Use broad soft
> lighting, gentle shadows, restrained highlights and a matte finish. Reduce texture
> contrast and excessive microdetail while retaining subtle fabric and fur texture
> and rounded 3D volume. Keep the result airy and softly faded, without an orange
> cast, HDR contrast, glossy edges, blur or washed-out facial features. Preserve the
> original background transparency.
