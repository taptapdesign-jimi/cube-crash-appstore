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
5. Install the new Stack to Six build only on `iPhone 13 blue`. If it is unavailable, stop and wait; never fall back to another iPhone or iPad unless the user explicitly changes the target.

Use this guarded install cycle after user-visible changes. The build and sync steps are intentionally explicit so a successful build cannot silently package an incomplete asset tree:

```bash
SKIP_NATIVE_BUNDLE_SYNC=true npm run build
mkdir -p dist/assets
rsync -a assets/ dist/assets/
rsync -a --delete dist/ "/Users/user/Stack to Six/Stack to Six/Web.bundle/"
xcodebuild -project "/Users/user/Stack to Six/Stack to Six.xcodeproj" -scheme "Stack to Six" -configuration Debug -destination 'generic/platform=iOS' -derivedDataPath /tmp/stack-to-six-derived CODE_SIGNING_ALLOWED=YES build
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "/tmp/stack-to-six-derived/Build/Products/Debug-iphoneos/Stack to Six.app/Info.plist"
xcrun devicectl device install app --device 0F62B71E-0B04-53C3-906E-EC28F5D2390B "/tmp/stack-to-six-derived/Build/Products/Debug-iphoneos/Stack to Six.app"
xcrun devicectl device process launch --terminate-existing --device 0F62B71E-0B04-53C3-906E-EC28F5D2390B com.taptapdesign.stacktosix.Stack-to-Six
```

The expected `PlistBuddy` output is exactly:

```text
com.taptapdesign.stacktosix.Stack-to-Six
```

If it differs, stop before installation. Never substitute the Kockice Crash project, app path, or bundle identifier. Resolve the current CoreDevice identifier again if the phone has been re-paired.

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

Also verify a representative runtime asset and launch assets inside the final app:

```bash
test -f "/tmp/stack-to-six-derived/Build/Products/Debug-iphoneos/Stack to Six.app/Web.bundle/assets/tile.png"
grep -o 'taplogo-[A-Za-z0-9_-]*\.png' "/tmp/stack-to-six-derived/Build/Products/Debug-iphoneos/Stack to Six.app/Web.bundle/index.html"
grep -o 'lik-board-[A-Za-z0-9_-]*\.png' "/tmp/stack-to-six-derived/Build/Products/Debug-iphoneos/Stack to Six.app/Web.bundle/index.html"
```
