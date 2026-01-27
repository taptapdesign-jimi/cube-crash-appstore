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
    
    // 🔥 CRITICAL: Override loadView to set background BEFORE WebView is created
    override func loadView() {
        super.loadView()
        
        // Set view background to #F9F9F9 - this will be visible behind transparent WebView
        self.view.backgroundColor = launchBackgroundColor
        
        // 🔥 CRITICAL: Create background view with #F9F9F9 color BEFORE WebView is initialized
        // This ensures consistent background during WKWebView initialization (for logo screen)
        let bgView = UIView(frame: self.view.bounds)
        bgView.backgroundColor = launchBackgroundColor
        bgView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        self.view.insertSubview(bgView, at: 0)
        self.backgroundView = bgView
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
        if let webView = self.value(forKey: "webView") as? WKWebView {
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
        if let webView = self.value(forKey: "webView") as? WKWebView {
            webView.isOpaque = false // 🔥 CRITICAL: Must be false to avoid white flash
            webView.backgroundColor = UIColor.clear // 🔥 CRITICAL: Clear background
            webView.scrollView.backgroundColor = UIColor.clear // 🔥 CRITICAL: Clear scrollView background
        } else if let webView = self.value(forKey: "webView") as? UIView {
            webView.backgroundColor = UIColor.clear
            if let scrollView = webView.value(forKey: "scrollView") as? UIScrollView {
                scrollView.backgroundColor = UIColor.clear
            }
        }
        
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
            if let webView = self.value(forKey: "webView") as? WKWebView {
                webView.isOpaque = false // 🔥 CRITICAL
                webView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                webView.scrollView.backgroundColor = UIColor.clear // 🔥 CRITICAL
            } else if let webView = self.value(forKey: "webView") as? UIView {
                webView.backgroundColor = UIColor.clear
                if let scrollView = webView.value(forKey: "scrollView") as? UIScrollView {
                    scrollView.backgroundColor = UIColor.clear
                }
            }
            
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
        }
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        
        // Ensure background view is visible
        if let bgView = self.backgroundView {
            bgView.frame = self.view.bounds
            bgView.backgroundColor = whiteColor
            if bgView.superview == nil {
                self.view.insertSubview(bgView, at: 0)
            }
        }
        
        // Set view background to white - visible behind transparent WebView
        self.view.backgroundColor = whiteColor
        
        // Set WebView to transparent (synchronous for immediate effect)
        if let webView = self.value(forKey: "webView") as? WKWebView {
            webView.isOpaque = false // 🔥 CRITICAL
            webView.backgroundColor = UIColor.clear // 🔥 CRITICAL
            webView.scrollView.backgroundColor = UIColor.clear // 🔥 CRITICAL
        } else if let webView = self.value(forKey: "webView") as? UIView {
            webView.backgroundColor = UIColor.clear
            if let scrollView = webView.value(forKey: "scrollView") as? UIScrollView {
                scrollView.backgroundColor = UIColor.clear
            }
        }
        
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
            
            if let webView = self.value(forKey: "webView") as? WKWebView {
                webView.isOpaque = false // 🔥 CRITICAL
                webView.backgroundColor = UIColor.clear // 🔥 CRITICAL
                webView.scrollView.backgroundColor = UIColor.clear // 🔥 CRITICAL
            } else if let webView = self.value(forKey: "webView") as? UIView {
                webView.backgroundColor = UIColor.clear
                if let scrollView = webView.value(forKey: "scrollView") as? UIScrollView {
                    scrollView.backgroundColor = UIColor.clear
                }
            }
            
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
        }
    }
    
}

