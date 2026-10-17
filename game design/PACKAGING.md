# Development-only packaging boundary

`game design/` lives at the repository root, alongside `assets/` and `native/`. It is not inside `assets/`, `public/`, `dist/`, an Xcode synchronized source group, or `NativeAssets.bundle`.

The current Native resource preparation (`scripts/prepare-native-artwork.mjs`) copies only root `assets/` into `native/standalone/Stack to Six/NativeAssets.bundle/assets`. The Xcode project lists individual Native source groups; it does not include the repository root or this folder. The web postbuild (`scripts/postbuild.mjs`) also copies only `assets/` into `dist/assets`. Therefore these reference copies, Markdown and manifest are outside current app packaging. The original game artwork still ships where the app needs it; this reference library does not add a second copy to the app.

Keep this folder outside resource roots and never add it to Copy Bundle Resources, source imports, build globs or distribution copy steps. Git tracking and App Store packaging are separate: a folder can be versioned without shipping in the app.

No App Store archive was produced for this documentation-only task. At release, inspect the final `.app` or extracted IPA with:

```sh
python3 "game design/scripts/verify_library.py" --app "/absolute/path/Stack to Six.app"
```

This verifies the library and rejects library names/marker documents in the supplied final bundle. The release's ordinary Native identity/dependency/asset audit still applies. A future packaging change requires a fresh check.

The skill and reference images work in agents with access to this repository. Another ChatGPT conversation needs access to the package/references; uploading only the MD cannot grant filesystem access or permanently train the image model.
