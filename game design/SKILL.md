---
name: stack-to-six-art-style
description: Create or review Stack to Six artwork using its local visual library, including the recurring human and dog, Home hero illustrations, ordinary and Wild/Special dice, effects and Journey worlds.
---

# Stack to Six art direction

Use this folder as the persistent source of visual knowledge for new Stack to Six artwork. Read [STYLE_GUIDE.md](STYLE_GUIDE.md), then find the relevant family in [REFERENCE_INDEX.md](REFERENCE_INDEX.md). Resolve paths relative to this skill directory.

Open the actual reference PNGs before defining a prompt. For a recurring character, inspect its face and full-body identity references; for the human with dog, inspect `lik-pas.png` and `lik-lajna.png`. For a new scene, combine identity, environment and render references. Use a small relevant set, not all 1,000+ files. The text guide never replaces the visual references.

Separate subject/action/composition from stable render and identity requirements. Preserve silhouette, face, proportions, costume, dog markings, materials, edge softness, lighting and palette from the chosen references. State which images informed the output. A new theme can introduce requested colors without abandoning the render language. Do not promise exact identity or automatic first-pass success.

For bitmap generation/editing, use the available image-generation capability and provide the selected reference images, following its local-image inspection requirements. Read its applicable skill first. For existing SVG/code-native assets, use the appropriate vector workflow. Do not generate images merely because this skill was loaded.

Before delivery, view the actual result and compare identity, proportions, materials, light/shadow, palette, perspective, silhouette and alpha edges against those references. Correct visible drift where the tool permits. Report limitations candidly; a generated image is not physical game acceptance.

Original assets remain protected: this library contains reference copies. Do not alter or refresh originals, change gameplay, integrate new runtime art, or change animation timing as a side effect. Generated candidates go in a task-specific subfolder of `game design/output/` unless another destination was requested. Only explicitly approved runtime art belongs in application resources.

This folder is development material outside app resources. Read [PACKAGING.md](PACKAGING.md) before changing its location or importing its contents into runtime code. Run `python3 "game design/scripts/verify_library.py"` from the repository root to verify reference copies and links. Copies are a dated snapshot; if originals changed, report drift and refresh only when requested.

Example request: “Use game design: create the existing human and dog playing in a Forest scene.” Read the pair and Forest references, attach them to generation, preserve both identities and the shared soft 3D render, then visually compare the result.
