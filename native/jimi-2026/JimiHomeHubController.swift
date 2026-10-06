import UIKit
import WebKit

/// Opt-in native presentation; gameplay and progression stay in the existing
/// web runtime. One owner for route visibility, animations and input admission.
@MainActor
final class JimiHomeHubController: UIViewController {
    enum Route { case home, hub }
    // Observation only. A temporary QA host may attach a bounded route probe;
    // the controller has no dependency on the scripts/qa instrumentation.
    enum DiagnosticEvent {
        case start(requestID: Int, label: String)
        case bridgeReady(requestID: Int)
        case motionStart(requestID: Int)
        case finish(requestID: Int, outcome: String)
        case cancel(reason: String)
    }
    var onDiagnosticEvent: ((DiagnosticEvent) -> Void)?
    private let web: WKWebView
    private let assets: JimiV9Artwork
    private(set) var home: JimiV9HomeView!
    private(set) var hub: JimiV9HubView!
    private let status = UILabel()
    private let policy = UILabel()
    private var route: Route = .home
    private var active = false
    private var disposed = false
    private var hasBootstrapped = false
    private var journeyRequiresTutorial = false
    private var transitioning = false
    private var generation = 0
    private var requestID = 0
    private var feedbackID = 0
    private var outgoingFeedbackSent = false
    private var expectedRequest: Int?
    private var activatingWorldRequest: Int?
    private var worldRequest: Int?
    private struct DeferredHubPresentation {
        let identity = UUID()
        let epoch: Int
        let snapshot: [String: Any]
    }
    private var deferredHubPresentation: DeferredHubPresentation?
    private var motionDone = false
    private var destinationReady: [String: Any]?
    private var timeout: DispatchWorkItem?
    private var observers: [NSObjectProtocol] = []
    private var animatedLayers: [CALayer] = []
    private var baseOpacity: [ObjectIdentifier: Float] = [:]
    private var baseAnchor: [ObjectIdentifier: CGPoint] = [:]

    init(web: WKWebView, resourceRoot: URL) {
        self.web = web; assets = JimiV9Artwork(resourceRoot: resourceRoot)
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("Use init(web:resourceRoot:)") }

    override func viewDidLoad() {
        super.viewDidLoad()
        let paperColor = UIColor(red: 243/255, green: 238/255, blue: 232/255, alpha: 1)
        view.backgroundColor = paperColor
        let paper = UIImageView(image: assets.image("assets/paper-bg.png"))
        paper.frame = view.bounds; paper.autoresizingMask = [.flexibleWidth, .flexibleHeight]; paper.contentMode = .scaleToFill
        view.addSubview(paper)
        let tint = UIView(frame: view.bounds); tint.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        tint.backgroundColor = paperColor.withAlphaComponent(0.4); view.addSubview(tint)
        home = JimiV9HomeView(frame: view.bounds, assets: assets)
        hub = JimiV9HubView(frame: view.bounds, assets: assets)
        for child in [home!, hub!] { child.autoresizingMask = [.flexibleWidth, .flexibleHeight]; view.addSubview(child) }
        hub.isHidden = true
        status.accessibilityIdentifier = "native.status"; status.isAccessibilityElement = true
        status.font = .systemFont(ofSize: 11); status.textColor = .secondaryLabel
        status.textAlignment = .center; status.accessibilityValue = "loading"
        status.frame = CGRect(x: 8, y: view.bounds.height-17, width: view.bounds.width-16, height: 14)
        status.autoresizingMask = [.flexibleWidth, .flexibleTopMargin]
        view.addSubview(status)
        policy.accessibilityIdentifier = "native.policy"; policy.isAccessibilityElement = true
        policy.frame = CGRect(x: 8, y: 1, width: 1, height: 1)
        view.addSubview(policy)
        view.isHidden = true
        home.onSlideSelected = { [weak self] index in self?.selectSlide(index) }
        home.onPanBegan = { [weak self] in
            guard let self, self.active, !self.transitioning, self.route == .home else { return false }
            self.cancelMotion(); return true
        }
        home.onPanEnded = { [weak self] index, _ in self?.selectSlide(index, snap: true) }
        home.onActivate = { [weak self] index in
            guard let self, self.active, !self.transitioning else { return }
            let destination: [String: Any] = index == 0
                ? (self.journeyRequiresTutorial ? ["kind": "web-home", "action": "journey"] : ["kind": "hub"])
                : ["kind": "web-home", "action": index == 1 ? "arcade" : "settings"]
            self.feedback("cta", extra: ["policy": destination["kind"] as? String == "hub" ? "native-only" : "web-home-source"])
            self.navigate(destination)
        }
        hub.onBack = { [weak self] in
            guard let self, self.active, !self.transitioning else { return }
            self.feedback("back"); self.navigate(["kind": "home"])
        }
        hub.onWorld = { [weak self] id in
            guard let self, self.active, !self.transitioning else { return }
            self.feedback("cta", extra: ["policy": "native-only"])
            self.navigate(["kind": "world", "worldId": id])
        }
        hub.onBackpack = { [weak self] in
            guard let self, !self.transitioning else { return }
            self.animate([(self.hub.backpackButton, JimiV9Motion.navigationTapBounce)]) {}
        }
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,
            object: nil, queue: .main) { [weak self] _ in self?.suspend() })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
            object: nil, queue: .main) { [weak self] _ in self?.resume() })
    }

    func receive(_ event: [String: Any]) {
        guard !disposed else { return }
        loadViewIfNeeded()
        let kind = event["kind"] as? String
        if kind == "snapshot", let snapshot = event["snapshot"] as? [String: Any] {
            update(snapshot)
            if !hasBootstrapped && expectedRequest == nil {
                deferredHubPresentation = nil
                hasBootstrapped = true; transitioning = true; active = true
                home.selectSlide(snapshot["homeSlide"] as? Int ?? 0, animated: false)
                requestID += 1; expectedRequest = requestID; motionDone = true
                let owner = requestID
                onDiagnosticEvent?(.start(requestID: owner, label: "startup:web-to-native-home"))
                web.evaluateJavaScript("void window.__jimiNativeHomeHub.request({id:\(owner),destination:{kind:'home'}})") { [weak self] _, error in
                    guard let self, !self.disposed, self.expectedRequest == owner else { return }
                    if error != nil { self.recover("Native startup bridge failed") }
                }
                let item = DispatchWorkItem { [weak self] in
                    guard self?.expectedRequest == owner else { return }; self?.recover("Native startup timed out")
                }
                timeout = item; DispatchQueue.main.asyncAfter(deadline: .now()+8, execute: item)
            }
        } else if kind == "present", let snapshot = event["snapshot"] as? [String: Any] {
            // A canonical settled receipt, never merely app-zone assignment.
            guard expectedRequest == nil, !transitioning else { return }
            deferredHubPresentation = nil
            adopt(event["route"] as? String == "hub" ? .hub : .home, snapshot: snapshot)
        } else if kind == "enter-hub", let snapshot = event["snapshot"] as? [String: Any],
                  let epoch = event["epoch"] as? Int {
            // The canonical World exit and hidden Hub commit already finished.
            // This receipt owns only the native Hub's incoming presentation.
            guard expectedRequest == nil, !transitioning else { return }
            deferredHubPresentation = DeferredHubPresentation(epoch: epoch, snapshot: snapshot)
            // Validate foreground deliveries too: queued native messages can
            // outlive the web epoch that originally published them.
            if UIApplication.shared.applicationState == .active { resumeDeferredHubPresentation() }
        } else if kind == "ready", event["requestId"] as? Int == expectedRequest {
            if let id = expectedRequest { onDiagnosticEvent?(.bridgeReady(requestID: id)) }
            destinationReady = event["destination"] as? [String: Any]
            let destinationKind = destinationReady?["kind"] as? String
            if !motionDone, !outgoingFeedbackSent, destinationKind == "home" || destinationKind == "hub" {
                outgoingFeedbackSent = true
                if route == .home { feedback("home-exit", extra: ["durationSeconds": 0.70]) }
                else { feedback("hub-exit") }
            }
            commitIfReady()
        } else if kind == "error", let id = event["requestId"] as? Int,
                  id == expectedRequest || id == activatingWorldRequest {
            recover("Action unavailable: \(event["code"] ?? "unknown")")
        }
    }

    private func update(_ snapshot: [String: Any]) {
        journeyRequiresTutorial = snapshot["journeyRequiresTutorial"] as? Bool ?? false
        policy.accessibilityValue = journeyRequiresTutorial ? "journey-tutorial-required" : "journey-tutorial-complete"
        hub.updateProgress(snapshot["worlds"] as? [[String: Any]] ?? [], activeWorldId: snapshot["activeWorldId"] as? Int)
    }
    private func adopt(_ next: Route, snapshot: [String: Any], animateHubEnter: Bool = false) {
        onDiagnosticEvent?(.cancel(reason: "canonical-source-adopted"))
        home.cancelPan()
        CATransaction.begin(); CATransaction.setDisableActions(true)
        defer { CATransaction.commit() }
        // A retained source may still have collapsed model layers. Hide it
        // BEFORE restoring them, and install the destination pose in this same
        // transaction. Neither a reset source nor an unprimed destination may
        // become an independently committed frame.
        home.isHidden = true; hub.isHidden = true
        cancelMotion(); route = next; active = true; transitioning = animateHubEnter
        let enterOwner: Int?
        if animateHubEnter {
            requestID += 1; enterOwner = requestID
            onDiagnosticEvent?(.start(requestID: requestID, label: "world-return-to-native-hub:incoming-only"))
        } else { enterOwner = nil }
        update(snapshot)
        if next == .home { home.selectSlide(snapshot["homeSlide"] as? Int ?? 0, animated: false) }
        home.isHidden = next != .home; hub.isHidden = next != .hub
        view.isHidden = false; web.accessibilityElementsHidden = true
        status.text = nil; status.accessibilityValue = animateHubEnter ? "transitioning" : "ready"
        home.isUserInteractionEnabled = !animateHubEnter; hub.isUserInteractionEnabled = !animateHubEnter
        if next == .hub {
            hub.resetScroll()
            if animateHubEnter { hub.resetIdlePose() }
            else { hub.startIdle() }
            feedback("hub-ambience")
        }
        if let id = enterOwner {
            // Installing the primed CA tracks in this same synchronous turn
            // prevents a settled-alpha frame between coverage and native enter.
            onDiagnosticEvent?(.motionStart(requestID: id))
            animate(hubTracks(enter: true)) { [weak self] in
                guard let self else { return }
                self.transitioning = false
                self.home.isUserInteractionEnabled = true; self.hub.isUserInteractionEnabled = true
                self.status.accessibilityValue = "ready"
                self.hub.startIdle()
                self.onDiagnosticEvent?(.finish(requestID: id, outcome: "native-input-ready"))
            }
        }
    }

    private func homeTracks(enter: Bool) -> [(UIView, JimiV9Motion.Track)] {
        var parts: [(UIView, JimiV9Motion.Part)] = [(home.heroView, .hero), (home.logoImageView, .logo),
            (home.ctaContainerView, .ctaContainer), (home.ctaView, .cta), (home.navView, .navigation),
            (home.fixedShadowView, .fixedShadow)]
        parts += home.shardViews.map { ($0, .shard) }
        return parts.map { target, part in
            let track = enter ? JimiV9Motion.homeEnter(part) : JimiV9Motion.homeExit(part, reducedMotion: UIAccessibility.isReduceMotionEnabled)
            if !enter, case .hero = part, let painted = target.layer.presentation(),
               target.layer.animation(forKey: "native-route") != nil, let first = track.tweens.first {
                // A tap can interrupt the selected-hero bounce. Retarget from
                // its painted scale, compensating the changed animation pivot.
                let t = painted.transform
                let dx = (track.anchorX-target.layer.anchorPoint.x)*target.bounds.width
                let dy = (track.anchorY-target.layer.anchorPoint.y)*target.bounds.height
                let pose = JimiV9Motion.Pose(scaleX: t.m11, scaleY: t.m22,
                    x: t.m41+dx*(t.m11-1), y: t.m42+dy*(t.m22-1), opacity: Double(painted.opacity))
                let replacement = JimiV9Motion.Tween(begin: first.begin, duration: first.duration,
                    from: pose, to: first.to, ease: first.ease)
                return (target, JimiV9Motion.Track(tweens: [replacement] + track.tweens.dropFirst(), anchorX: track.anchorX, anchorY: track.anchorY))
            }
            return (target, track)
        }
    }

    private func hubTracks(enter: Bool, selectedWorldID: Int? = nil) -> [(UIView, JimiV9Motion.Track)] {
        var tracks: [(UIView, JimiV9Motion.Track)] = []
        let reduced = UIAccessibility.isReduceMotionEnabled
        let order = enter ? hub.worldUnits : (selectedWorldID == nil ? hub.worldUnits.shuffled() : Array(hub.worldUnits.reversed()))
        for (i, unit) in order.enumerated() {
            let selected = selectedWorldID != nil && hub.worldUnits.firstIndex(of: unit).map { hub.worldIDs[$0] == selectedWorldID } == true
            if enter {
                tracks.append((unit, .init(tweens: [.init(begin: (reduced ? 0 : 0.08) + Double(i)*(reduced ? 0.02 : 0.09), duration: reduced ? 0.2 : 0.56,
                    from: .scale(reduced ? 0.96 : 0.65, y: reduced ? 8 : 30, opacity: 0), to: .scale(1), ease: reduced ? .powerOut(1) : .backOut(1.8))])))
            } else {
                if reduced && !selected {
                    tracks.append((unit, .init(tweens: [.init(begin: Double(i)*0.012, duration: 0.16, from: .scale(1), to: .scale(0.96, y: 8, opacity: 0), ease: .powerIn(1))])))
                    continue
                }
                let peak = JimiV9Motion.Pose(scaleX: selected ? 1.18 : 1.144, scaleY: selected ? 1.15 : 1.12)
                let delay = selected ? 0 : Double(i)*(selectedWorldID == nil ? 0.045 : 0.065)
                let bounceDuration = reduced ? 0.15 : 0.18
                let collapseDuration = reduced ? 0.28 : 0.336
                tracks.append((unit, .init(tweens: [
                    .init(begin: delay, duration: bounceDuration, from: .scale(1), to: peak, ease: .powerIn(2)),
                    .init(begin: delay+bounceDuration, duration: collapseDuration, from: peak, to: .scale(0), ease: .backIn(1.7))], anchorY: 0.54)))
            }
        }
        if enter {
            tracks.append((hub.header, .init(tweens: [.init(begin: 0, duration: reduced ? 0.2 : 0.56,
                from: .scale(reduced ? 0.96 : 0.65, y: reduced ? 8 : 30, opacity: 0),
                to: .scale(1), ease: reduced ? .powerOut(1) : .backOut(1.8))])))
        } else {
            tracks.append((hub.header, JimiV9Motion.journeyNavigationExit(reducedMotion: reduced)))
        }
        for target in hub.bannerRevealTargets {
            tracks.append((target.view, JimiV9Motion.hubBanner(worldID: target.worldID, enter: enter,
                width: Double(hub.bannerWidth(for: target.worldID)), firstWorldStart: reduced ? 0 : 0.08, reducedMotion: reduced)))
        }
        return tracks
    }

    private func navigate(_ destination: [String: Any]) {
        guard active, !transitioning else { return }
        deferredHubPresentation = nil
        let requestOwner = requestID + 1
        let sourceLabel = route == .home ? "home" : "hub"
        let destinationLabel = destination["kind"] as? String ?? "unknown"
        let actionLabel = destination["action"] as? String
            ?? (destination["worldId"] as? Int).map { "world-\($0)" }
        onDiagnosticEvent?(.start(requestID: requestOwner,
            label: sourceLabel + "->" + destinationLabel + (actionLabel.map { ":" + $0 } ?? "")))
        home.cancelPan()
        transitioning = true; motionDone = false; destinationReady = nil
        outgoingFeedbackSent = false
        hub.stopIdle(); home.isUserInteractionEnabled = false; hub.isUserInteractionEnabled = false
        status.accessibilityValue = "transitioning"
        requestID += 1; expectedRequest = requestID
        let selectedWorldID = destination["kind"] as? String == "world" ? destination["worldId"] as? Int : nil
        worldRequest = selectedWorldID == nil ? nil : requestID
        if selectedWorldID != nil {
            // The native Hub still owns feedback here. Direct preparation
            // revokes admission as soon as the following request is accepted.
            outgoingFeedbackSent = true
            feedback("hub-exit")
        }
        let payload: [String: Any] = ["id": requestID, "destination": destination]
        let json = String(data: try! JSONSerialization.data(withJSONObject: payload), encoding: .utf8)!
        web.evaluateJavaScript("void window.__jimiNativeHomeHub.request(\(json))") { [weak self] _, error in
            guard let self, !self.disposed, self.expectedRequest == requestOwner else { return }
            if error != nil { self.recover("Bridge unavailable") }
        }
        let isWebSource = (destination["kind"] as? String)?.hasPrefix("web-") == true
        if isWebSource {
            // Existing web route will own its original exit; don't play it twice.
            motionDone = true; commitIfReady()
        } else {
            onDiagnosticEvent?(.motionStart(requestID: requestOwner))
            animate(route == .home ? homeTracks(enter: false) : hubTracks(enter: false, selectedWorldID: selectedWorldID)) { [weak self] in
                self?.motionDone = true; self?.commitIfReady()
            }
        }
        let id = requestID
        let item = DispatchWorkItem { [weak self] in
            guard self?.expectedRequest == id else { return }; self?.recover("Destination preparation timed out")
        }
        timeout = item; DispatchQueue.main.asyncAfter(deadline: .now()+8, execute: item)
    }

    private func commitIfReady() {
        guard motionDone, let destination = destinationReady, let id = expectedRequest else { return }
        timeout?.cancel(); timeout = nil; expectedRequest = nil; destinationReady = nil
        CATransaction.begin(); CATransaction.setDisableActions(true)
        defer { CATransaction.commit() }
        // Cancellation restores reusable layers, including logo shards, to
        // full size. Retire the outgoing surface before that restoration and
        // commit retirement + destination priming as one coverage transfer.
        home.isHidden = true; hub.isHidden = true
        cancelMotion()
        let kind = destination["kind"] as? String
        if kind == "world" {
            // Ready means the exact World is prepared in its hidden enter pose,
            // not already animated. Native exit and preparation meet only here.
            activatingWorldRequest = id
            view.isHidden = true; web.accessibilityElementsHidden = false
            let handoff = generation
            let item = DispatchWorkItem { [weak self] in
                guard let self, self.activatingWorldRequest == id, self.generation == handoff else { return }
                self.recover("World activation timed out")
            }
            timeout = item; DispatchQueue.main.asyncAfter(deadline: .now()+8, execute: item)
            web.callAsyncJavaScript("return await window.__jimiNativeHomeHubRuntime.activateWorld(id)",
                arguments: ["id": id], in: nil, in: .page) { [weak self] result in
                guard let self, !self.disposed, self.activatingWorldRequest == id, self.generation == handoff else { return }
                guard case .success(let value) = result, value as? Bool == true else {
                    self.recover("World activation failed"); return
                }
                self.timeout?.cancel(); self.timeout = nil
                self.activatingWorldRequest = nil
                self.worldRequest = nil
                self.active = false; self.transitioning = false
                self.onDiagnosticEvent?(.finish(requestID: id, outcome: "web-world-input-ready"))
            }
            return
        }
        if kind == "web-home" || kind == "web-hub" {
            active = false; transitioning = false; view.isHidden = true; web.accessibilityElementsHidden = false
            // Only the native-to-canonical-source handoff is observed here.
            // The eventual web destination is outside this route's measurement.
            onDiagnosticEvent?(.finish(requestID: id, outcome: "web-source-handoff"))
            let handoff = generation
            web.callAsyncJavaScript("return await window.__jimiNativeHomeHubRuntime.activateSource(id)",
                arguments: ["id": id], in: nil, in: .page) { [weak self] result in
                guard let self, !self.disposed, self.generation == handoff else { return }
                if case .failure(let error) = result { print("[JIMI_NATIVE_HANDOFF] source action failed: \(error)") }
                // Runtime may only re-adopt if that exact source still owns its epoch.
                // An accepted action isn't a destination-ready/presentation receipt.
            }
            return
        }
        route = kind == "hub" ? .hub : .home
        active = true; view.isHidden = false; web.accessibilityElementsHidden = true
        home.isHidden = route != .home; hub.isHidden = route != .hub
        if route == .hub { hub.resetScroll(); hub.resetIdlePose() }
        let incoming = route == .home ? homeTracks(enter: true) : hubTracks(enter: true)
        if route == .home { feedback("home-enter", extra: ["durationSeconds": 0.745], renew: true) }
        else { feedback("hub-ambience", renew: true) }
        onDiagnosticEvent?(.motionStart(requestID: id))
        animate(incoming) { [weak self] in
            guard let self else { return }
            self.transitioning = false; self.home.isUserInteractionEnabled = true; self.hub.isUserInteractionEnabled = true
            self.status.accessibilityValue = "ready"
            if self.route == .hub { self.hub.startIdle() }
            self.onDiagnosticEvent?(.finish(requestID: id, outcome: "native-input-ready"))
        }
    }

    private func selectSlide(_ index: Int, snap: Bool = false) {
        if active, !transitioning, !snap, index == 0, journeyRequiresTutorial {
            feedback("tab", extra: ["policy": "web-home-source"])
            navigate(["kind": "web-home", "action": "journey"]); return
        }
        guard active, !transitioning else { return }
        let changed = index != home.selectedSlide
        if snap {
            if changed { feedback("swipe") }
        } else {
            feedback("tab", extra: ["policy": "native-only"])
            if !changed {
                animate([(home.navigationButtonViews[index], JimiV9Motion.navigationTapBounce)]) {}
                return
            }
        }
        let oldX = home.sliderTrack.layer.presentation()?.position.x ?? home.sliderTrack.layer.position.x
        let navigation = home.navigationLayoutTargets.map { target in
            let layer = target.view.layer.presentation() ?? target.view.layer
            return (target.view, target.slideIndex, layer.bounds, layer.position)
        }
        home.cancelPan()
        cancelMotion()
        home.selectSlide(index, animated: false)
        let newX = home.sliderTrack.layer.position.x
        let animation = CAKeyframeAnimation(keyPath: "position.x")
        animation.values = (0...80).map { oldX + (newX-oldX)*JimiV9Motion.sliderEase.value(Double($0)/80) }
        animation.duration = JimiV9Motion.sliderDuration
        home.sliderTrack.layer.add(animation, forKey: "native-slide-selection")
        if !animatedLayers.contains(where: { $0 === home.sliderTrack.layer }) { animatedLayers.append(home.sliderTrack.layer) }
        for (target, slide, oldBounds, oldPosition) in navigation {
            let layer = target.layer
            let newBounds = layer.bounds, newPosition = layer.position
            let sizeEase = JimiV9Motion.Ease.powerOut(slide == index ? 3 : 2)
            let positionEase = JimiV9Motion.Ease.powerOut(3)
            let boundsMotion = CAKeyframeAnimation(keyPath: "bounds")
            let positionMotion = CAKeyframeAnimation(keyPath: "position")
            boundsMotion.values = (0...80).map { step in
                let t = sizeEase.value(Double(step)/80)
                return NSValue(cgRect: CGRect(x: 0, y: 0, width: oldBounds.width+(newBounds.width-oldBounds.width)*t,
                    height: oldBounds.height+(newBounds.height-oldBounds.height)*t))
            }
            positionMotion.values = (0...80).map { step in
                let t = positionEase.value(Double(step)/80)
                return NSValue(cgPoint: CGPoint(x: oldPosition.x+(newPosition.x-oldPosition.x)*t,
                    y: oldPosition.y+(newPosition.y-oldPosition.y)*t))
            }
            boundsMotion.duration = 0.38; positionMotion.duration = 0.38
            let group = CAAnimationGroup(); group.animations = [boundsMotion, positionMotion]; group.duration = 0.38
            layer.add(group, forKey: "native-slide-selection")
            if !animatedLayers.contains(where: { $0 === layer }) { animatedLayers.append(layer) }
        }
        if changed { animate([(home.heroView, JimiV9Motion.selectedHeroBounce)]) {} }
        web.evaluateJavaScript("window.__jimiNativeHomeHubRuntime.selectSlide(\(index))", completionHandler: nil)
    }

    private func feedback(_ kind: String, extra: [String: Any] = [:], renew: Bool = false) {
        guard !disposed else { return }
        feedbackID += 1
        var event = extra; event["id"] = feedbackID; event["kind"] = kind
        guard let data = try? JSONSerialization.data(withJSONObject: event), let json = String(data: data, encoding: .utf8) else { return }
        let retireOutgoing = renew ? "r.suspendFeedback(); r.resumeFeedback();" : ""
        web.evaluateJavaScript("(()=>{const r=window.__jimiNativeHomeHubRuntime;if(r){\(retireOutgoing)return r.nativeFeedback(\(json));}})()", completionHandler: nil)
    }

    private func animate(_ entries: [(UIView, JimiV9Motion.Track)], completion: @escaping () -> Void) {
        generation += 1; let owner = generation
        // Banners are decorative continuations, not an extra 200ms input gate.
        // Install them outside the route completion transaction, with the same
        // generation and cancellation registry as all other owned layers.
        let bannerIDs = Set(hub.bannerRevealTargets.map { ObjectIdentifier($0.view) })
        let decoration = entries.filter { bannerIDs.contains(ObjectIdentifier($0.0)) }
        let routeEntries = entries.filter { !bannerIDs.contains(ObjectIdentifier($0.0)) }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        installTracks(decoration)
        CATransaction.commit()
        CATransaction.begin()
        CATransaction.setCompletionBlock { [weak self] in
            guard let self, self.generation == owner else { return }
            CATransaction.begin(); CATransaction.setDisableActions(true)
            for (target, _) in routeEntries { self.restoreAnchor(target.layer) }
            CATransaction.commit()
            completion()
        }
        installTracks(routeEntries, holdUntil: routeEntries.map { $0.1.duration }.max())
        CATransaction.commit()
    }

    private func installTracks(_ entries: [(UIView, JimiV9Motion.Track)], holdUntil: Double? = nil) {
        for (target, track) in entries {
            let layer = target.layer
            let key = ObjectIdentifier(layer)
            if baseOpacity[key] == nil { baseOpacity[key] = layer.opacity }
            if baseAnchor[key] == nil { baseAnchor[key] = layer.anchorPoint }
            let alpha = baseOpacity[key] ?? 1
            let oldAnchor = layer.anchorPoint
            layer.position.x += (track.anchorX-oldAnchor.x)*layer.bounds.width
            layer.position.y += (track.anchorY-oldAnchor.y)*layer.bounds.height
            layer.anchorPoint = CGPoint(x: track.anchorX, y: track.anchorY)
            let sampled = JimiV9Motion.sampledTrack(track, holdUntil: holdUntil)
            let poses = sampled.poses
            let transform = CAKeyframeAnimation(keyPath: "transform")
            transform.duration = sampled.duration
            transform.keyTimes = sampled.keyTimes?.map { NSNumber(value: $0) }
            transform.values = poses.map { pose -> NSValue in
                let value = CATransform3DScale(CATransform3DMakeTranslation(pose.x, pose.y, 0), pose.scaleX, pose.scaleY, 1)
                return NSValue(caTransform3D: value)
            }
            let opacity = CAKeyframeAnimation(keyPath: "opacity"); opacity.values = poses.map { $0.opacity * Double(alpha) }
            opacity.duration = sampled.duration
            opacity.keyTimes = sampled.keyTimes?.map { NSNumber(value: $0) }
            let group = CAAnimationGroup(); group.animations = [transform, opacity]; group.duration = sampled.duration
            group.timingFunction = CAMediaTimingFunction(name: .linear)
            CATransaction.setDisableActions(true)
            let final = poses.last!
            layer.transform = CATransform3DScale(CATransform3DMakeTranslation(final.x, final.y, 0), final.scaleX, final.scaleY, 1)
            layer.opacity = Float(final.opacity) * alpha
            layer.add(group, forKey: "native-route")
            if !animatedLayers.contains(where: { $0 === layer }) { animatedLayers.append(layer) }
        }
    }

    private func cancelMotion() {
        generation += 1
        CATransaction.begin(); CATransaction.setDisableActions(true)
        for layer in animatedLayers { layer.removeAnimation(forKey: "native-route"); layer.removeAnimation(forKey: "native-slide-selection"); layer.transform = CATransform3DIdentity; layer.opacity = baseOpacity[ObjectIdentifier(layer)] ?? 1; restoreAnchor(layer) }
        animatedLayers.removeAll(); CATransaction.commit()
    }
    private func restoreAnchor(_ layer: CALayer) {
        guard let anchor = baseAnchor[ObjectIdentifier(layer)] else { return }
        layer.position.x += (anchor.x-layer.anchorPoint.x)*layer.bounds.width
        layer.position.y += (anchor.y-layer.anchorPoint.y)*layer.bounds.height
        layer.anchorPoint = anchor
    }
    private func recover(_ message: String) {
        if let id = worldRequest {
            recoverWorld(id, message: message)
            return
        }
        onDiagnosticEvent?(.cancel(reason: "recovery: " + message))
        activatingWorldRequest = nil
        timeout?.cancel(); timeout = nil; expectedRequest = nil; destinationReady = nil
        cancelMotion(); transitioning = false
        // A startup preparation can hide the web source before rejecting. Keep
        // an explicit, interactive native fallback visible; never report ready.
        if active {
            view.isHidden = false; web.accessibilityElementsHidden = true
            home.isHidden = route != .home; hub.isHidden = route != .hub
            if route == .hub { hub.resetIdlePose() }
        }
        home.isUserInteractionEnabled = true; hub.isUserInteractionEnabled = true
        status.text = message; status.accessibilityValue = "error"
        web.evaluateJavaScript("window.__jimiNativeHomeHubRuntime?.suspendFeedback()", completionHandler: nil)
        web.evaluateJavaScript("(window.__jimiNativeHomeHubRuntime ?? window.__jimiNativeHomeHub)?.cancel()", completionHandler: nil)
    }

    private func recoverWorld(_ id: Int, message: String) {
        onDiagnosticEvent?(.cancel(reason: "world-recovery: " + message))
        timeout?.cancel(); timeout = nil
        expectedRequest = nil; activatingWorldRequest = nil; destinationReady = nil
        cancelMotion(); hub.stopIdle()
        let owner = generation
        // A failed activation may have lost its web app-zone epoch. Only the
        // runtime can authorize reclaiming this exact request's native cover.
        web.callAsyncJavaScript("return window.__jimiNativeHomeHubRuntime.recoverWorld(id)",
            arguments: ["id": id], in: nil, in: .page) { [weak self] result in
            guard let self, !self.disposed, self.generation == owner, self.worldRequest == id else { return }
            self.worldRequest = nil
            self.transitioning = false
            guard case .success(let value) = result, value as? Bool == true else {
                self.active = false; self.view.isHidden = true; self.web.accessibilityElementsHidden = false
                return // Never cancel or cover an unrelated web destination.
            }
            self.route = .hub; self.active = true
            self.home.isHidden = true; self.hub.isHidden = false
            self.hub.resetIdlePose()
            self.view.isHidden = false; self.web.accessibilityElementsHidden = true
            self.home.isUserInteractionEnabled = true; self.hub.isUserInteractionEnabled = true
            self.status.text = message; self.status.accessibilityValue = "error"
            if UIApplication.shared.applicationState == .active {
                // Restore guarded feedback admission, not a ready receipt or
                // replay of the failed route's one-shots/ambience.
                self.web.evaluateJavaScript("window.__jimiNativeHomeHubRuntime?.resumeFeedback()", completionHandler: nil)
            }
        }
    }

    private func resumeDeferredHubPresentation() {
        guard UIApplication.shared.applicationState == .active,
              let pending = deferredHubPresentation else { return }
        let owner = generation
        web.callAsyncJavaScript("return window.__jimiNativeHomeHubRuntime.isNativeHubPresentationCurrent(epoch)",
            arguments: ["epoch": pending.epoch], in: nil, in: .page) { [weak self] result in
            guard let self, !self.disposed, self.generation == owner,
                  self.deferredHubPresentation?.identity == pending.identity else { return }
            // Backgrounding during validation retains this receipt for the
            // next foreground; neither animation nor ownership is resumed now.
            guard UIApplication.shared.applicationState == .active else { return }
            self.deferredHubPresentation = nil
            guard case .success(let value) = result, value as? Bool == true else {
                self.active = false; self.transitioning = false
                self.view.isHidden = true; self.web.accessibilityElementsHidden = false
                return // No cancellation of a foreign web epoch.
            }
            guard self.expectedRequest == nil, !self.transitioning else { return }
            self.adopt(.hub, snapshot: pending.snapshot, animateHubEnter: true)
        }
    }

    private func suspend() {
        onDiagnosticEvent?(.cancel(reason: "background"))
        guard active else { return }
        home.cancelPan()
        web.evaluateJavaScript("window.__jimiNativeHomeHubRuntime?.suspendFeedback()", completionHandler: nil)
        if let kind = destinationReady?["kind"] as? String, kind == "home" || kind == "hub" {
            route = kind == "home" ? .home : .hub
            home.isHidden = route != .home; hub.isHidden = route != .hub
        }
        if transitioning {
            if expectedRequest == nil && worldRequest == nil {
                // The destination already owns a matching ready/presentation
                // receipt; only its native incoming motion was interrupted.
                // Settle it without inventing a failed bridge transaction.
                cancelMotion()
                if route == .hub { hub.resetIdlePose() }
                hub.stopIdle()
                transitioning = false
                home.isUserInteractionEnabled = true; hub.isUserInteractionEnabled = true
                status.text = nil; status.accessibilityValue = "ready"
                return
            }
            let recoveringWorld = worldRequest != nil
            recover("Interrupted — retry")
            if recoveringWorld { return } // Recovery already owns cancellation.
        }
        cancelMotion(); hub.stopIdle()
    }
    private func resume() {
        if deferredHubPresentation != nil {
            resumeDeferredHubPresentation()
            return
        }
        guard active else { return }
        // Foregrounding is not an acknowledgement of a failed bridge request.
        if status.accessibilityValue == "ready" || status.accessibilityValue == "error" {
            web.evaluateJavaScript("window.__jimiNativeHomeHubRuntime?.resumeFeedback()", completionHandler: nil)
            if status.accessibilityValue == "ready", route == .hub { hub.startIdle(); feedback("hub-ambience") }
        }
    }
    func dispose() {
        guard !disposed else { return }
        onDiagnosticEvent?(.cancel(reason: "disposed"))
        onDiagnosticEvent = nil
        home?.cancelPan()
        disposed = true; expectedRequest = nil; activatingWorldRequest = nil; worldRequest = nil; destinationReady = nil
        deferredHubPresentation = nil
        timeout?.cancel(); timeout = nil; cancelMotion(); hub?.stopIdle()
        observers.forEach(NotificationCenter.default.removeObserver); observers.removeAll()
        active = false; view.isHidden = true; web.accessibilityElementsHidden = false
        web.evaluateJavaScript("window.__jimiNativeHomeHubRuntime?.suspendFeedback()", completionHandler: nil)
        web.evaluateJavaScript("(window.__jimiNativeHomeHubRuntime ?? window.__jimiNativeHomeHub)?.cancel()", completionHandler: nil)
    }
}
