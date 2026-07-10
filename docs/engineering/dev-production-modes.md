# Cube Crash DEV vs Production Modes

This project uses the following meanings:

## DEV / Development

DEV means the Xcode-installed iPhone app loads the Mac's Vite dev server.

- Current native shell to use: `/Users/user/Stack to Six/Stack to Six.xcodeproj`.
- Current Xcode scheme/target: `Stack to Six`.
- Current bundle id: `com.taptapdesign.stacktosix.Stack-to-Six`.
- Current test device: always `iPhone 13 blue` for now.
- Web app source: Vite dev server, not bundled `dist`.
- iPhone URL: `http://192.168.1.189:5174/native-dev/`.
- Physical iPhone + Mac LAN dev server triggers the iOS Local Network permission prompt. That prompt is mandatory for this DEV topology.
- Mac Chrome URL: `http://localhost:5174`.
- In `Stack to Six/GameViewController.swift`, `useDevServer` must be `true`.
- In `Stack to Six/GameViewController.swift`, `devServerURL` must be `http://192.168.1.189:5174/native-dev/` for LAN DEV.
- Do not point the iPhone wrapper at the root `http://192.168.1.189:5174/` endpoint. That browser-style endpoint injects `/@vite/client` and can make WKWebView stall or show an empty screen.
- Do not point the iPhone wrapper at old ports such as `5155`, or at the IPv6 `fdf2:...` address that previously failed with `No network route`.
- Do not use free localtunnel URLs for the native app; they show an interstitial confirmation page and break WKWebView startup.
- To avoid the Local Network prompt, use production/standalone bundled files or a real stable HTTPS endpoint that does not show interstitial pages.

Use:

```bash
npm run dev
xcodebuild -project "/Users/user/Stack to Six/Stack to Six.xcodeproj" -scheme "Stack to Six" -configuration Debug -destination 'id=0F62B71E-0B04-53C3-906E-EC28F5D2390B' build
```

Historical warning: `/Users/user/cube-crash/ios/App/App.xcworkspace` is a different Capacitor shell with bundle id `com.taptapdesign.cubecrash`. Do not install that when the user is testing the visible `Kockice Crash` app.

## Production / Standalone

Production means the iPhone app runs bundled static files from `Web.bundle`/`dist`, without the dev server.

- Native shell: installed/launched from Xcode.
- Web app source: bundled `dist`.
- In the active native shell's `GameViewController.swift`, `useDevServer` should be `false`.
- Current emergency reset for `Stack to Six`: `/Users/user/Stack to Six/Stack to Six/GameViewController.swift` is set to `useDevServer = false` and loads `app://localhost/index.html` from `Web.bundle`.
- This mode must not show the iOS Local Network prompt because the app does not load `192.168.1.189`, `5174`, `loca.lt`, or any dev-server URL.

Use:

```bash
npm run build
CAPACITOR_USE_DEV_SERVER=false npx cap sync ios
```

## Always Verify

Before comparing performance or debugging mode-specific behavior:

```bash
rg -n "useDevServer|devServerURL" "/Users/user/Stack to Six/Stack to Six/GameViewController.swift"
```

If `useDevServer = true` and `devServerURL` points to `http://192.168.1.189:5174/native-dev/`, it is the correct LAN iPhone DEV mode.
