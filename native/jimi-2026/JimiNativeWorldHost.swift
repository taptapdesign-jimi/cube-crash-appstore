import UIKit
import WebKit

@MainActor
protocol JimiNativeWorldTransport {
    func call(_ body: String, arguments: [String: Any], completion: @escaping @MainActor @Sendable (Result<Any, Error>) -> Void)
}

@MainActor
private final class JimiNativeWorldWebTransport: JimiNativeWorldTransport {
    let web: WKWebView
    init(web: WKWebView) { self.web = web }
    func call(_ body: String, arguments: [String: Any], completion: @escaping @MainActor @Sendable (Result<Any, Error>) -> Void) {
        web.callAsyncJavaScript(body, arguments: arguments, in: nil, in: .page, completionHandler: completion)
    }
}

/// Presentation/action adapter inside the existing route controller. Web owns
/// admission and gameplay; this lease owns only one retained UIKit World.
@MainActor
final class JimiNativeWorldHost {
    private let web: WKWebView
    private let artwork: JimiV9Artwork
    private let transport: JimiNativeWorldTransport
    private(set) var snapshotValue: [String: Any]?
    private(set) var worldView: JimiNativeWorldView?
    private var actionID = 0
    private var feedbackID = 0
    private var generation = 0
    private var pending = false
    private var committingLaunch = false
    private var launchPresentation: (token: String, owner: Int, routeGeneration: Int, stateRevision: Int)?
    private var launchCoverageReleased = false
    private var launchPresentationAcknowledged = false
    private(set) var requiresPresentationRecovery = false
    private var timeout: DispatchWorkItem?
    private var disposed = false
    var onBack: (() -> Void)?
    var onGameplayCommitted: (() -> Void)?
    var onLaunchRejected: (() -> Void)?
    var onBusy: ((Bool) -> Void)?
    var onError: ((String) -> Void)?

    init(web: WKWebView, artwork: JimiV9Artwork, transport: JimiNativeWorldTransport? = nil) {
        self.web = web; self.artwork = artwork
        self.transport = transport ?? JimiNativeWorldWebTransport(web: web)
    }

    @discardableResult
    func prepare(_ snapshot: [String: Any], in container: UIView) -> Bool {
        guard let model = JimiNativeWorldSnapshot(snapshot) else {return false}
        return prepare(model,rawSnapshot:snapshot,in:container)
    }

    /// The route owner carries the already validated immutable model from the same bridge receipt.
    @discardableResult
    func prepare(_ model:JimiNativeWorldSnapshot,rawSnapshot snapshot:[String:Any],in container:UIView)->Bool {
        guard !disposed,(1...3).contains(model.worldID) else {return false}
        if let retained = worldView {
            guard model.generation >= retained.snapshot.generation,
                  model.generation > retained.snapshot.generation || model.revision >= retained.snapshot.revision else { return false }
        }
        snapshotValue = snapshot
        requiresPresentationRecovery = false
        invalidateAction()
        if let retained = worldView, retained.snapshot.worldID == model.worldID {
            retained.isHidden = true; retained.reconcile(model)
        } else {
            worldView?.cleanup(); worldView?.removeFromSuperview()
            guard let created = JimiNativeWorldView(snapshot: snapshot, assets: artwork,validatedSnapshot:model) else { return false }
            created.isHidden = true; created.frame = container.bounds
            created.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            container.addSubview(created); worldView = created
            created.onRequest = { [weak self] action, boardID in self?.request(action, boardID: boardID) }
            created.onFeedback = { [weak self] kind, boardID, duration in
                self?.feedback(kind, boardID: boardID, duration: duration)
            }
            created.onBeePlansRequest = { [weak self,weak created] ids,completion in
                guard let self,let created,!self.disposed,self.worldView === created,created.isReadyForInput,!created.hasActiveCard else {completion(nil);return}
                let generation = created.snapshot.generation,revision = created.snapshot.revision,session = created.snapshot.beeSessionID
                self.transport.call("return window.__jimiNativeHomeHubRuntime.requestNativeForestBeePlans(generation, revision, ids)",arguments:["generation":generation,"revision":revision,"ids":ids]) { [weak self,weak created] result in
                    guard let self,let created,!self.disposed,self.worldView === created,created.snapshot.beeSessionID == session else {completion(nil);return}
                    if case .success(let value) = result {completion(value as? [[String:Any]])} else {completion(nil)}
                }
            }
            created.onAmbientPlansRequest = { [weak self,weak created] viewport,ids,completion in
                guard let self,let created,!self.disposed,self.worldView === created,created.isReadyForInput,!created.hasActiveCard else {completion(nil);return}
                let generation = created.snapshot.generation,revision = created.snapshot.revision,session = created.snapshot.ambientSessionID
                self.transport.call("return window.__jimiNativeHomeHubRuntime.requestNativeWorldAmbientPlans(generation, revision, viewport, ids)",arguments:["generation":generation,"revision":revision,"viewport":["top":viewport.minY,"bottom":viewport.maxY],"ids":ids]) { [weak self,weak created] result in
                    guard let self,let created,!self.disposed,self.worldView === created,created.snapshot.ambientSessionID == session else {completion(nil);return}
                    if case .success(let value) = result {completion(value as? [[String:Any]])} else {completion(nil)}
                }
            }
            created.onResourceFailure = { [weak self] asset in self?.onError?("Missing World artwork: \(asset)") }
        }
        worldView?.frame = container.bounds
        worldView?.setNeedsLayout(); worldView?.layoutIfNeeded()
        return true
    }

    func enter(terminal: Bool, completion: @escaping () -> Void) {
        guard !disposed, let worldView else { return }
        worldView.isHidden = false
        worldView.enter(terminal: terminal, completion: completion)
    }

    func exit(completion: @escaping () -> Void) {
        invalidateAction()
        guard let worldView else { completion(); return }
        worldView.exit(completion: completion)
    }

    func hide() {
        requiresPresentationRecovery = false
        if !committingLaunch { invalidateAction() }
        worldView?.park(); worldView?.isHidden = true
    }

    func suspend() {
        // Once canonical gameplay has been dispatched, retain its receipt:
        // foreground cannot resurrect the World over an accepted game start.
        if !committingLaunch {
            if pending {
                requiresPresentationRecovery = true
                worldView?.park(); worldView?.isHidden = true
            }
            invalidateAction()
        }
        worldView?.setActive(false)
    }
    func resume() {
        guard !disposed, worldView?.isHidden == false else { return }
        worldView?.setActive(true)
    }

    private func feedback(_ kind: String, boardID: Int?, duration: Double?) {
        guard !disposed, UIApplication.shared.applicationState == .active,
              let worldView, !worldView.isHidden else { return }
        feedbackID += 1
        let state = worldView.snapshot
        var event: [String: Any] = ["id": feedbackID, "worldID": state.worldID,
            "routeGeneration": state.generation, "stateRevision": state.revision, "kind": kind]
        if let boardID { event["boardID"] = boardID }
        if let duration { event["durationSeconds"] = duration }
        guard let data = try? JSONSerialization.data(withJSONObject: event), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.__jimiNativeHomeHubRuntime?.nativeWorldFeedback(\(json))", completionHandler: nil)
    }

    private func request(_ action: String, boardID: Int?, retryStaleBack: Bool = true) {
        guard !disposed, UIApplication.shared.applicationState == .active,
              let worldView, !worldView.isHidden else { return }
        // Back preempts presentation work, never an already dispatched game.
        if action == "back" {
            guard !committingLaunch else { worldView.rejectBackRequest(); return }
            if pending { invalidateAction() }
        } else if pending { return }
        let state = worldView.snapshot
        let presentationHasNewRibbon = action == "openCard" && state.units.first(where:{$0.boardID == boardID})?.newRibbon == true
        actionID += 1; generation += 1; let owner = generation
        pending = true; onBusy?(true)
        var payload: [String: Any] = ["id": actionID, "worldID": state.worldID,
            "routeGeneration": state.generation, "stateRevision": state.revision, "action": action]
        if let boardID { payload["boardID"] = boardID }
        armTimeout(owner: owner)
        transport.call("return await window.__jimiNativeHomeHubRuntime.requestNativeWorldAction(action)",
            arguments: ["action": payload]) { [weak self] result in
            guard let self, !self.disposed, self.generation == owner, self.pending else { return }
            self.timeout?.cancel(); self.timeout = nil
            guard UIApplication.shared.applicationState == .active else { self.invalidateAction(); return }
            guard case .success(let value) = result, let receipt = value as? [String: Any] else {
                if action == "back" { worldView.rejectBackRequest() }
                self.finishAction(); self.onError?("World action unavailable"); return
            }
            if let snapshot = receipt["snapshot"] as? [String: Any] { self.snapshotValue = snapshot; worldView.reconcile(snapshot) }
            guard receipt["accepted"] as? Bool == true else {
                // Opening a card may have advanced viewed-state just before Back.
                // Retry only that same retained route, once, using its fresh revision.
                if action == "back", retryStaleBack, receipt["code"] as? String == "stale-request",
                   worldView.snapshot.generation == state.generation,
                   worldView.snapshot.worldID == state.worldID, worldView.snapshot.revision != state.revision {
                    self.finishAction(); self.request("back",boardID:nil,retryStaleBack:false); return
                }
                if action == "back" { worldView.rejectBackRequest() }
                NSLog("[CC_NATIVE_FOREST_ACTION] rejected action=%@ code=%@ generation=%d revision=%d", action, receipt["code"] as? String ?? "unknown", state.generation, state.revision)
                self.finishAction(); self.onError?("World action unavailable"); return
            }
            switch action {
            case "openCard":
                if let boardID { worldView.openCard(boardID: boardID,presentationHasNewRibbon:presentationHasNewRibbon) }
                self.finishAction()
            case "close":
                worldView.closeCard { [weak self] in
                    guard self?.generation == owner else { return }; self?.finishAction()
                }
            case "back":
                self.finishAction(); self.onBack?()
            case "play", "continue":
                guard let token = receipt["launchToken"] as? String else {
                    self.finishAction(); self.onError?("World launch was not admitted"); return
                }
                worldView.prepareGameplayExit(boardID: boardID) { [weak self] in
                    guard let self, !self.disposed, self.generation == owner, self.pending,
                          UIApplication.shared.applicationState == .active else { return }
                    self.commitLaunch(token, owner: owner)
                }
            default:
                self.finishAction()
            }
        }
    }

    private func commitLaunch(_ token: String, owner: Int) {
        guard let state = worldView?.snapshot else { finishAction(); onLaunchRejected?(); return }
        committingLaunch = true
        launchPresentation = (token, owner, state.generation, state.revision)
        launchCoverageReleased = false; launchPresentationAcknowledged = false
        armTimeout(owner: owner)
        transport.call("return await window.__jimiNativeHomeHubRuntime.commitNativeWorldLaunch(token)",
            arguments: ["token": token]) { [weak self] result in
            guard let self, !self.disposed, self.generation == owner, self.pending else { return }
            self.timeout?.cancel(); self.timeout = nil
            guard case .success(let accepted) = result, accepted as? Bool == true else {
                self.finishAction()
                self.onLaunchRejected?(); return
            }
            self.releaseGameplayCoverage()
            self.finishAction()
        }
    }

    /// The canonical WebKit transition is prepared and paused, awaiting this exact cover transfer.
    @discardableResult
    func acceptTransitionPresentation(token: String, routeGeneration: Int, stateRevision: Int) -> Bool {
        guard !disposed, pending, committingLaunch, !launchPresentationAcknowledged,
              UIApplication.shared.applicationState == .active,
              let receipt = launchPresentation, receipt.token == token, receipt.owner == generation,
              receipt.routeGeneration == routeGeneration, receipt.stateRevision == stateRevision,
              worldView?.snapshot.generation == routeGeneration, worldView?.snapshot.revision == stateRevision else { return false }
        launchPresentationAcknowledged = true
        releaseGameplayCoverage()
        acknowledgeTransitionPresentation(token)
        return true
    }

    private func releaseGameplayCoverage() {
        guard !launchCoverageReleased else { return }
        launchCoverageReleased = true
        worldView?.park()
        onGameplayCommitted?()
    }

    private func acknowledgeTransitionPresentation(_ token: String) {
        transport.call("return window.__jimiNativeHomeHubRuntime.ackNativeWorldTransitionPresentation(token)",
            arguments: ["token": token]) { _ in }
    }

    private func armTimeout(owner: Int) {
        timeout?.cancel()
        let task = DispatchWorkItem { [weak self] in
            guard let self, !self.disposed, self.generation == owner, self.pending else { return }
            if self.committingLaunch {
                // Dispatch already crossed into canonical gameplay. A timeout
                // cannot cancel that owner or resurrect native presentation.
                // Relinquish coverage, retain the result callback, and let the
                // canonical entry/error owner finish its accepted transaction.
                self.timeout = nil; self.releaseGameplayCoverage()
                if let receipt = self.launchPresentation { self.acknowledgeTransitionPresentation(receipt.token) }
                return
            }
            self.worldView?.rejectBackRequest()
            self.invalidateAction()
            self.onError?("World action timed out")
        }
        timeout = task; DispatchQueue.main.asyncAfter(deadline: .now() + 8, execute: task)
    }

    private func finishAction() { timeout?.cancel(); timeout = nil; pending = false; committingLaunch = false; launchPresentation = nil; launchCoverageReleased = false; launchPresentationAcknowledged = false; onBusy?(false) }
    private func invalidateAction() { generation += 1; finishAction() }

    func dispose() {
        guard !disposed else { return }
        disposed = true; invalidateAction(); worldView?.cleanup(); worldView?.removeFromSuperview(); worldView = nil
        onBack = nil; onGameplayCommitted = nil; onLaunchRejected = nil; onBusy = nil; onError = nil
    }
}
