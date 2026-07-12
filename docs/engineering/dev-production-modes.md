# Stack to Six Web/App Sync Workflow

This project uses `/Users/user/cube-crash` as the web source and `/Users/user/Stack to Six/Stack to Six.xcodeproj` as the only active native iPhone shell.

Do not use the legacy `/Users/user/Kockice Crash/Kockice Crash.xcodeproj` workflow unless the user explicitly asks for it.

## Default Workflow

When a change must be visible both on web and in the iPhone app:

1. Edit the source in `/Users/user/cube-crash`.
2. Verify on web at `http://localhost:5174` when useful.
3. Run `npm run build`.
   - `postbuild` runs `scripts/postbuild.mjs`.
   - It syncs `dist/` into `/Users/user/Stack to Six/Stack to Six/Web.bundle`.
   - It must not sync or modify the legacy Kockice Crash project.
4. Build the Stack to Six native app.
5. Install the new Stack to Six build on `iPhone 13 blue`.

Use this install cycle after user-visible changes:

```bash
npm run build
xcodebuild -project "/Users/user/Stack to Six/Stack to Six.xcodeproj" -scheme "Stack to Six" -configuration Debug -destination 'id=00008110-001E39961AFA801E' -derivedDataPath /Users/user/cube-crash/.xcode-derived-stack build
xcrun devicectl device install app --device 00008110-001E39961AFA801E "/Users/user/cube-crash/.xcode-derived-stack/Build/Products/Debug-iphoneos/Stack to Six.app"
```

## Current Native Mode

Stack to Six is normally kept in bundled mode:

- File: `/Users/user/Stack to Six/Stack to Six/GameViewController.swift`.
- Expected setting: `useDevServer = false`.
- Expected load path: `app://localhost/index.html`.
- The app runs from `Web.bundle`, works without internet, and does not require Wi-Fi.
- Web `localhost:5174` updates immediately after refresh, but the installed app updates only after the build/install cycle above.

This mode is App Store-friendly in principle because the app does not depend on a development server. A real App Store/TestFlight release still requires the normal release checks: version/build number, signing, archive, icons, privacy/orientation checks, and upload validation.

## LAN DEV Mode Is Not Default

The live iPhone DEV server path was tested with:

- iPhone URL: `http://192.168.1.189:5174/native-dev/`.
- Mac Chrome URL: `http://localhost:5174`.
- `useDevServer = true`.

It produced a white/empty screen on the physical iPhone because the native preflight timed out, even after Local Network permission was accepted:

```text
Native dev preflight failed: The request timed out.
```

Do not switch Stack to Six back to live `5174` loading unless the user explicitly requests another LAN DEV experiment and accepts the risk of the white screen returning.

Do not point the iPhone wrapper at:

- `http://192.168.1.189:5174/` root endpoint.
- old ports such as `5155`.
- the previous IPv6 `fdf2:...` address that failed with `No network route`.
- free localtunnel URLs that show interstitial pages.

## Always Verify

Before comparing performance or debugging mode-specific behavior:

```bash
rg -n "useDevServer|devServerURL" "/Users/user/Stack to Six/Stack to Six/GameViewController.swift"
```

Expected normal output should show bundled mode:

```text
useDevServer = false
devServerURL = ""
```

Also verify the app bundle receives the latest web build:

```bash
cmp -s dist/index.html "/Users/user/Stack to Six/Stack to Six/Web.bundle/index.html"; echo $?
```

`0` means the bundled native web entrypoint matches `dist`.
