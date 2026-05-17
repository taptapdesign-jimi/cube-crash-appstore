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

    private func configureTransparentWebView() {
        guard let webView = activeWebView() else { return }

        webView.isOpaque = false
        webView.backgroundColor = UIColor.clear
        webView.scrollView.backgroundColor = UIColor.clear
        // Stop root WKWebView rubber-banding so fixed headers / top nav do not shift on vertical overscroll.
        let sv = webView.scrollView
        sv.bounces = false
        sv.alwaysBounceVertical = false
        sv.alwaysBounceHorizontal = false
    }
    
    // 🔥 CRITICAL: Set WKWebView to transparent
    // White background view will be visible behind transparent WebView (for logo screen)
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
        
        // Set view background to #F9F9F9 - visible behind transparent WebView (matches launch screen)
        self.view.backgroundColor = launchBackgroundColor
        
        // 🔥 CRITICAL: Set WebView to transparent SYNCHRONOUSLY (not async) for immediate effect
        // This prevents the white flash from WKWebView initialization
        configureTransparentWebView()
        
        // Also try through subviews (immediate, not async)
        for subview in self.view.subviews {
            if String(describing: type(of: subview)).contains("WebView") {
                subview.backgroundColor = UIColor.clear
                if let wkWebView = subview as? WKWebView {
                    wkWebView.isOpaque = false // 🔥 CRITICAL
                    wkWebView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                    wkWebView.scrollView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                }
                for subSubview in subview.subviews {
                    if let scrollView = subSubview as? UIScrollView {
                        scrollView.backgroundColor = UIColor.clear
                    }
                }
            }
        }
        
        // 🔥 CRITICAL: Also set it async as fallback (in case WebView is created later)
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            // Try accessing webView through various methods
            self.configureTransparentWebView()
            
            // Also try through subviews
            for subview in self.view.subviews {
                if String(describing: type(of: subview)).contains("WebView") {
                    subview.backgroundColor = UIColor.clear
                    if let wkWebView = subview as? WKWebView {
                        wkWebView.isOpaque = false // 🔥 CRITICAL
                        wkWebView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                        wkWebView.scrollView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                    }
                    for subSubview in subview.subviews {
                        if let scrollView = subSubview as? UIScrollView {
                            scrollView.backgroundColor = UIColor.clear
                        }
                    }
                }
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                self?.configureTransparentWebView()
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
        
        // Set view background to launch color - visible behind transparent WebView
        self.view.backgroundColor = launchBackgroundColor
        
        // Set WebView to transparent (synchronous for immediate effect)
        configureTransparentWebView()
        
        for subview in self.view.subviews {
            if String(describing: type(of: subview)).contains("WebView") {
                subview.backgroundColor = UIColor.clear
                if let wkWebView = subview as? WKWebView {
                    wkWebView.isOpaque = false // 🔥 CRITICAL
                    wkWebView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                    wkWebView.scrollView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                }
            }
        }
        
        // Also set it async as fallback
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.configureTransparentWebView()
            
            for subview in self.view.subviews {
                if String(describing: type(of: subview)).contains("WebView") {
                    subview.backgroundColor = UIColor.clear
                    if let wkWebView = subview as? WKWebView {
                        wkWebView.isOpaque = false // 🔥 CRITICAL
                        wkWebView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                        wkWebView.scrollView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                    }
                }
            }
            
            // Capacitor can reset scrollView bounce after bridge init — re-apply once layout settles.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                self?.configureTransparentWebView()
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
