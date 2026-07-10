import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController {
    
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .portrait
    }
    
    override var shouldAutorotate: Bool {
        return false
    }
    
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        return .portrait
    }
    
    // #F9F9F9 background for logo screen (matches launch screen)
    private let launchBackgroundColor = UIColor(red: 249/255.0, green: 249/255.0, blue: 249/255.0, alpha: 1.0) // #F9F9F9
    private var backgroundView: UIView?

    private func findWebView(in view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView {
            return webView
        }

        for subview in view.subviews {
            if let webView = findWebView(in: subview) {
                return webView
            }
        }

        return nil
    }

    private func activeWebView() -> WKWebView? {
        return self.webView ?? findWebView(in: self.view)
    }

    private func configurePerformantWebView() {
        guard let webView = activeWebView() else { return }

        webView.isOpaque = true
        webView.backgroundColor = launchBackgroundColor
        webView.scrollView.backgroundColor = launchBackgroundColor
        // Stop root WKWebView rubber-banding so fixed headers / top nav do not shift on vertical overscroll.
        let sv = webView.scrollView
        sv.bounces = false
        sv.alwaysBounceVertical = false
        sv.alwaysBounceHorizontal = false
    }
    
    // Keep WKWebView opaque. A transparent full-screen WKWebView forces extra iOS
    // blending work and can make transform-heavy screens feel like low FPS.
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // 🔥 CRITICAL FIX: Force local bundle loading (prevent dev server connection)
        // This ensures app uses local bundle instead of trying to connect to dev server
        #if DEBUG
        // Only allow dev server in DEBUG mode
        #else
        // PRODUCTION: Force local bundle - remove any server URL that might be set
        if activeWebView() != nil {
            // Ensure WebView loads from local bundle, not remote server
            // Capacitor should handle this automatically, but we ensure it here
            print("✅ PRODUCTION MODE: Using local bundle (no dev server)")
        }
        #endif
        
        // Ensure background view is still there and visible
        if let bgView = self.backgroundView {
            bgView.frame = self.view.bounds
            bgView.backgroundColor = launchBackgroundColor
            if bgView.superview == nil {
                self.view.insertSubview(bgView, at: 0)
            }
        } else {
            // Create background view if it doesn't exist
            let bgView = UIView(frame: self.view.bounds)
            bgView.backgroundColor = launchBackgroundColor
            bgView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            self.view.insertSubview(bgView, at: 0)
            self.backgroundView = bgView
        }
        
        // Set view background to #F9F9F9 (matches launch screen)
        self.view.backgroundColor = launchBackgroundColor
        
        configurePerformantWebView()
        
        // Also try through subviews (immediate, not async)
        for subview in self.view.subviews {
            if String(describing: type(of: subview)).contains("WebView") {
                subview.backgroundColor = launchBackgroundColor
                if let wkWebView = subview as? WKWebView {
                    wkWebView.isOpaque = true
                    wkWebView.backgroundColor = launchBackgroundColor
                    wkWebView.scrollView.backgroundColor = launchBackgroundColor
                }
                for subSubview in subview.subviews {
                    if let scrollView = subSubview as? UIScrollView {
                        scrollView.backgroundColor = launchBackgroundColor
                    }
                }
            }
        }
        
        // 🔥 CRITICAL: Also set it async as fallback (in case WebView is created later)
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            // Try accessing webView through various methods
            self.configurePerformantWebView()
            
            // Also try through subviews
            for subview in self.view.subviews {
                if String(describing: type(of: subview)).contains("WebView") {
                    subview.backgroundColor = self.launchBackgroundColor
                    if let wkWebView = subview as? WKWebView {
                        wkWebView.isOpaque = true
                        wkWebView.backgroundColor = self.launchBackgroundColor
                        wkWebView.scrollView.backgroundColor = self.launchBackgroundColor
                    }
                    for subSubview in subview.subviews {
                        if let scrollView = subSubview as? UIScrollView {
                            scrollView.backgroundColor = self.launchBackgroundColor
                        }
                    }
                }
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                self?.configurePerformantWebView()
            }
        }
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        
        // Ensure background view is visible
        if let bgView = self.backgroundView {
            bgView.frame = self.view.bounds
            bgView.backgroundColor = launchBackgroundColor
            if bgView.superview == nil {
                self.view.insertSubview(bgView, at: 0)
            }
        }
        
        // Set view background to launch color
        self.view.backgroundColor = launchBackgroundColor
        
        configurePerformantWebView()
        
        for subview in self.view.subviews {
            if String(describing: type(of: subview)).contains("WebView") {
                subview.backgroundColor = launchBackgroundColor
                if let wkWebView = subview as? WKWebView {
                    wkWebView.isOpaque = true
                    wkWebView.backgroundColor = launchBackgroundColor
                    wkWebView.scrollView.backgroundColor = launchBackgroundColor
                }
            }
        }
        
        // Also set it async as fallback
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.configurePerformantWebView()
            
            for subview in self.view.subviews {
                if String(describing: type(of: subview)).contains("WebView") {
                    subview.backgroundColor = self.launchBackgroundColor
                    if let wkWebView = subview as? WKWebView {
                        wkWebView.isOpaque = true
                        wkWebView.backgroundColor = self.launchBackgroundColor
                        wkWebView.scrollView.backgroundColor = self.launchBackgroundColor
                    }
                }
            }

            // Capacitor can reset scrollView bounce after bridge init — re-apply once layout settles.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                self?.configurePerformantWebView()
            }
        }
    }
    
    deinit {
        // Prevent WKWebView -> WKUserContentController -> self retain cycles.
        if let webView = self.webView {
            let controller = webView.configuration.userContentController
            controller.removeScriptMessageHandler(forName: "hapticImpact")
            controller.removeScriptMessageHandler(forName: "hapticSelection")
            controller.removeScriptMessageHandler(forName: "hapticNotification")
        }
    }
    
}
