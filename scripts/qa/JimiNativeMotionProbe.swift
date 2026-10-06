import UIKit
import WebKit

// QA fixture only. Copy into the temporary Simulator project, never production.
// One controller owns finite trials, animation, sampling and background abort.
#if DEBUG && targetEnvironment(simulator)
final class JimiNativeMotionProbe: UIViewController, WKScriptMessageHandler {
    static var enabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--jimi-native-motion-probe") &&
        ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A"
    }
    private var web: WKWebView!
    private let surface = UIView()
    private let label = UILabel()
    private var units: [UIView] = []
    private var link: CADisplayLink?
    private var pending: DispatchWorkItem?
    private var observer: NSObjectProtocol?
    private var stopped = false
    private var trial = 0
    private var start = 0.0
    private var previous = 0.0
    private var gaps: [Double] = []
    private var rows: [[String: Any]] = []
    // Rotate order between blocks; eight trials per backend, not all native first.
    private let order = ["native", "web-waapi", "web-raf", "web-raf", "web-waapi", "native"]
    private var mode: String { order[trial % order.count] }
    private let duration = 1.65
    private let artwork = ProcessInfo.processInfo.arguments.contains("--jimi-probe-artwork")

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.953, green: 0.933, blue: 0.91, alpha: 1)
        surface.frame = view.bounds; surface.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(surface)
        var imageURLs: [String] = []
        let paths = ["assets/journey assets/forest/forest world/1Forest main.png",
                     "assets/journey assets/robo/robo world/robo-main.png",
                     "assets/journey assets/beach/Beacj world/beach-main.png"]
        for i in 0..<3 {
            let unit = UIView(frame: CGRect(x: 85, y: 150 + 190 * i, width: 220, height: 120))
            unit.backgroundColor = [UIColor(red: 0.4, green: 0.8, blue: 0.8, alpha: 1),
                                    UIColor(red: 0.8, green: 0.6, blue: 0.8, alpha: 1),
                                    UIColor(red: 0.93, green: 0.8, blue: 0.53, alpha: 1)][i]
            unit.layer.cornerRadius = 20; surface.addSubview(unit); units.append(unit)
            if artwork {
                guard let bundle = Bundle.main.resourceURL,
                      let data = try? Data(contentsOf: bundle.appendingPathComponent("Web.bundle/" + paths[i])),
                      let image = UIImage(data: data) else { fatalError("Missing original probe artwork") }
                let imageView = UIImageView(image: image)
                imageView.frame = unit.bounds; imageView.contentMode = .scaleAspectFit
                unit.backgroundColor = .clear; unit.addSubview(imageView)
                imageURLs.append("data:image/png;base64," + data.base64EncodedString())
            }
        }
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "probe")
        config.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: view.bounds, configuration: config)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.scrollView.isScrollEnabled = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(web)
        label.frame = CGRect(x: 20, y: 55, width: 350, height: 65)
        label.numberOfLines = 3; label.font = .systemFont(ofSize: 16)
        label.text = "QA motion comparison — not gameplay\nPreparing…"
        view.addSubview(label)
        observer = NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,
                                                          object: nil, queue: .main) { [weak self] _ in self?.abort() }
        let encoded = String(data: try! JSONSerialization.data(withJSONObject: imageURLs), encoding: .utf8)!
        later(15) { [weak self] in self?.abort() }
        web.loadHTMLString(Self.html.replacingOccurrences(of: "/*IMAGE_URLS*/[]", with: encoded), baseURL: nil)
    }

    private func later(_ seconds: Double, _ action: @escaping () -> Void) {
        pending?.cancel()
        let item = DispatchWorkItem { [weak self] in guard self?.stopped == false else { return }; action() }
        pending = item; DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: item)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard !stopped, let body = message.body as? [String: Any], let kind = body["kind"] as? String else { return }
        if kind == "ready" {
            print("[JIMI_NATIVE_PROBE] READY 24 trials; no gameplay/audio; callbacks are not GPU FPS")
            later(3) { [weak self] in self?.prepare() }
        } else if kind == "done", body["trial"] as? Int == trial {
            finish(extra: body)
        } else if kind == "error" { abort() }
    }

    // Identical bounded scalar path in Swift and JavaScript. Diagnostic path only:
    // standard 560ms back.out(1.8) enter and 180+336ms bounce exit, 90ms stagger.
    private func scale(_ seconds: Double) -> Double {
        if seconds <= 0 { return 0.65 }
        if seconds < 0.56 {
            let u = seconds / 0.56 - 1
            return 0.65 + 0.35 * (1 + 2.8*u*u*u + 1.8*u*u)
        }
        if seconds < 0.80 { return 1 }
        if seconds < 0.98 { return 1 + 0.144 * pow((seconds-0.80)/0.18, 3) }
        if seconds < 1.316 {
            let u = (seconds-0.98)/0.336
            return 1.144 * (1 - (2.7*u*u*u - 1.7*u*u))
        }
        return 0
    }

    private func prepare() {
        guard trial < 24 else { complete(); return }
        label.text = "QA motion comparison — not gameplay\n\(mode) · trial \(trial + 1)/24"
        web.isHidden = mode == "native"; surface.isHidden = mode != "native"
        for unit in units { unit.layer.removeAllAnimations(); unit.transform = CGAffineTransform(scaleX: 0.65, y: 0.65) }
        web.evaluateJavaScript("resetProbe()") { [weak self] _, error in
            guard let self, !self.stopped else { return }
            guard error == nil else { self.abort(); return }
            // Surface reveal/reset is outside timed animation; explicitly warm-motion test.
            self.later(0.8) { [weak self] in self?.run() }
        }
    }

    private func run() {
        gaps.removeAll(keepingCapacity: true); gaps.reserveCapacity(160)
        start = CACurrentMediaTime(); previous = start
        link = CADisplayLink(target: self, selector: #selector(sample))
        link?.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 60, preferred: 60)
        link?.add(to: .main, forMode: .common)
        if mode == "native" {
            CATransaction.begin(); CATransaction.setDisableActions(true)
            for (index, unit) in units.enumerated() {
                let animation = CAKeyframeAnimation(keyPath: "transform.scale")
                animation.values = (0...330).map { scale(Double($0)*duration/330 - Double(index)*0.09) }
                animation.duration = duration; animation.calculationMode = .linear
                unit.layer.setAffineTransform(CGAffineTransform(scaleX: 0, y: 0))
                unit.layer.add(animation, forKey: "probe")
            }
            CATransaction.commit()
            later(duration + 0.05) { [weak self] in self?.finish(extra: [:]) }
        } else {
            web.evaluateJavaScript("runProbe('\(mode)', \(trial))") { [weak self] _, error in
                if error != nil { self?.abort() }
            }
            later(4) { [weak self] in self?.abort() } // Missing completion is failure, never a sample.
        }
    }

    @objc private func sample() {
        let now = CACurrentMediaTime()
        // Include the interval that crosses the deadline, as the JS probe does.
        if previous - start < duration { gaps.append((now - previous)*1000) }
        previous = now
    }

    private func finish(extra: [String: Any]) {
        guard !gaps.isEmpty else { abort(); return }
        link?.invalidate(); link = nil; pending?.cancel(); pending = nil
        let sorted = gaps.sorted()
        let row: [String: Any] = ["trial": trial, "mode": mode, "artwork": artwork, "nativeCallbackGapsMs": gaps,
                                 "nativeWorstMs": sorted.last ?? 0,
                                 "nativeP95Ms": sorted.isEmpty ? 0 : sorted[Int(Double(sorted.count-1)*0.95)],
                                 "web": extra]
        rows.append(row)
        trial += 1
        later(0.5) { [weak self] in self?.prepare() }
    }

    private func complete() {
        let data = try! JSONSerialization.data(withJSONObject: rows, options: [.sortedKeys])
        print("[JIMI_NATIVE_PROBE] COMPLETE " + String(data: data, encoding: .utf8)!)
        label.text = "QA comparison complete · 24/24\nNot a physical-device acceptance"
        cleanup()
    }

    private func abort() {
        guard !stopped else { return }
        print("[JIMI_NATIVE_PROBE] ABORT at trial \(trial)")
        label.text = "QA comparison aborted — invalid run"
        cleanup()
    }

    private func cleanup() {
        stopped = true; pending?.cancel(); pending = nil; link?.invalidate(); link = nil
        units.forEach { $0.layer.removeAllAnimations() }
        web.evaluateJavaScript("resetProbe()", completionHandler: nil)
        web.configuration.userContentController.removeScriptMessageHandler(forName: "probe")
        if let observer { NotificationCenter.default.removeObserver(observer) }; observer = nil
    }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); abort() }

    private static let html = #"""
    <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
    <style>html,body{margin:0;overflow:hidden;background:#f3eee8}.unit{position:absolute;left:85px;top:150px;width:220px;height:120px;border-radius:20px;background:#6cc;transform:scale(.65)}.unit:nth-child(2){top:340px;background:#c9c}.unit:nth-child(3){top:530px;background:#ec8}</style>
    <div class="unit"></div><div class="unit"></div><div class="unit"></div><script>
    const units=[...document.querySelectorAll('.unit')];let raf=0,animations=[],token=0;
    function scale(t){if(t<=0)return .65;if(t<.56){const u=t/.56-1;return .65+.35*(1+2.8*u*u*u+1.8*u*u)}if(t<.80)return 1;if(t<.98)return 1+.144*Math.pow((t-.80)/.18,3);if(t<1.316){const u=(t-.98)/.336;return 1.144*(1-(2.7*u*u*u-1.7*u*u))}return 0}
    function resetProbe(){token++;cancelAnimationFrame(raf);raf=0;animations.forEach(a=>a.cancel());animations=[];units.forEach(u=>u.style.transform='scale(.65)')}
    function runProbe(mode,trial){resetProbe();const mine=token,start=performance.now();let prev=start;const gaps=[];
      if(mode==='web-waapi')animations=units.map((u,i)=>u.animate(Array.from({length:331},(_,j)=>({offset:j/330,transform:'scale('+scale(j*1.65/330-i*.09)+')'})),{duration:1650,fill:'forwards',easing:'linear'}));
      function tick(){if(mine!==token)return;const now=performance.now(),elapsed=(now-start)/1000;gaps.push(now-prev);prev=now;
        if(mode==='web-raf')units.forEach((u,i)=>u.style.transform='scale('+scale(elapsed-i*.09)+')');
        if(elapsed>=1.65){window.webkit.messageHandlers.probe.postMessage({kind:'done',trial,rafGapsMs:gaps,rafWorstMs:Math.max(...gaps)});return}raf=requestAnimationFrame(tick)}raf=requestAnimationFrame(tick)
    }
    addEventListener('pagehide',resetProbe);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetProbe()});
    const imageURLs=/*IMAGE_URLS*/[];
    Promise.all(imageURLs.map((src,i)=>{const img=new Image();img.src=src;img.style.cssText='width:100%;height:100%;object-fit:contain';units[i].style.background='transparent';units[i].append(img);return img.decode()})).then(()=>window.webkit.messageHandlers.probe.postMessage({kind:'ready'})).catch(()=>window.webkit.messageHandlers.probe.postMessage({kind:'error'}));
    </script>
    """#
}
#endif
