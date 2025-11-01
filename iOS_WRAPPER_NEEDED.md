# iOS Native Wrapper Required for App Store

## Current State
- ✅ **Web app fully working** in Safari (PWA)
- ✅ **Orientation locked** via manifest + meta tags + JS
- ❌ **No App Store submission** possible without native wrapper

## What's Missing

### Option 1: SwiftUI + WKWebView (Recommended - Minimal)

Create a new Xcode project with this single file:

**ContentView.swift**
```swift
import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WebView(url: Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "dist")!)
            .edgesIgnoringSafeArea(.all)
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        let request = URLRequest(url: url)
        webView.load(request)
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated {
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        }
    }
}
```

**Info.plist** (Key additions):
```xml
<key>UIRequiresPersistentWiFi</key>
<false/>
<key>UIInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
<key>UIInterfaceOrientations~ipad</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
```

### Option 2: Capacitor (Full SDK)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "CubeCrash" "com.yourcompany.cubecrash"
npx cap add ios
# Copy your dist/ folder to www/
npx cap sync
npx cap open ios
```

**Info.plist** edits:
- Set `UIInterfaceOrientations` arrays to portrait only
- Keep existing `manifest.webmanifest` and meta tags for consistency

### Build Steps (SwiftUI Option)

1. **Build web app:**
   ```bash
   npm run build  # Creates dist/ folder
   ```

2. **Create Xcode project:**
   - Open Xcode → New Project → iOS App
   - Product Name: "CubeCrash"
   - Interface: SwiftUI
   - Lifecycle: SwiftUI App

3. **Add web content:**
   - Drag `dist/` folder into Xcode project
   - Copy items: ✅
   - Create folder references: ✅

4. **Update ContentView.swift** (see above)

5. **Configure Info.plist** (see above)

6. **Build and run:**
   - Select your device/simulator
   - Product → Run

7. **Archive for App Store:**
   - Product → Archive
   - Upload to App Store Connect

## Testing in Xcode Simulator

Your current setup (`npm run dev`) is perfect for development testing. Once you create the native wrapper, you can still use `npm run dev` for hot reload during web development, then `npm run build` when ready to test the native wrapper.

## Why This is Needed

Apple App Store requires:
- Native iOS app (not just Safari web app)
- Signed binary (.ipa file)
- Info.plist with proper configurations
- App Store Connect submission process

Your current web app is perfect and production-ready, but needs this wrapper to be submitted to the App Store.

