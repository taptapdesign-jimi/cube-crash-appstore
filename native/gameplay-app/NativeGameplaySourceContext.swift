import UIKit

/// App-lived original visual RNG, smoke hot history and shard pattern pools.
/// Scene scopes borrow the existing union service; they never own its Raw roots.
@MainActor final class NativeGameplaySourceContext {
    let service: NativeSourceAnimationClockService
    let smokeSession: NativeSharedSmokeRootSession
    let sixResources: NativeRegularSixSharedResources
    private var active: Scope?
    private var epoch: UInt64 = 0
    private var disposed = false

    init(service: NativeSourceAnimationClockService = .shared,
         appOriginMilliseconds: Double = CACurrentMediaTime()*1000,
         visualRandom: @escaping () -> Double = {Double.random(in: 0..<1)}) {
        self.service = service
        smokeSession = NativeSharedSmokeRootSession(appOriginMilliseconds: appOriginMilliseconds, visualRandom: visualRandom)
        sixResources = NativeRegularSixSharedResources(smoke: smokeSession)
    }

    func beginScene(retire: @escaping () -> Void) -> Scope? {
        guard !disposed else {return nil}
        epoch &+= 1
        let captured = epoch, previous = active
        active = nil
        previous?.dispose()
        // A retirement callback may have installed a newer Scene.
        guard !disposed, epoch == captured, active == nil else {return nil}
        let scope = Scope(context: self, epoch: captured, retire: retire)
        active = scope
        return scope
    }

    private func isCurrent(_ scope: Scope) -> Bool { !disposed && active === scope && epoch == scope.epoch }
    private func release(_ scope: Scope) { if active === scope {active = nil} }
    func dispose() {
        guard !disposed else {return}; disposed = true; epoch &+= 1
        let previous = active; active = nil; previous?.dispose()
    }
    isolated deinit {active?.dispose()}

    @MainActor final class Scope {
        fileprivate let epoch: UInt64
        private weak var context: NativeGameplaySourceContext?
        let service: NativeSourceAnimationClockService
        let smokeSession: NativeSharedSmokeRootSession
        let sixResources: NativeRegularSixSharedResources
        let timeline: NativeSourceOuterTimelineAdapter
        let tween: NativeSourceDragTweenAdapter
        let smoke: NativeSharedSmokeRootRenderer
        private var retire: (() -> Void)?
        private(set) var disposed = false
        var current: Bool { !disposed && context?.isCurrent(self) == true }
        fileprivate init(context: NativeGameplaySourceContext, epoch: UInt64, retire: @escaping () -> Void) {
            self.context = context; self.epoch = epoch; self.retire = retire
            service = context.service; smokeSession = context.smokeSession; sixResources = context.sixResources
            timeline = NativeSourceOuterTimelineAdapter(service: service)
            tween = NativeSourceDragTweenAdapter(service: service)
            smoke = smokeSession.makeRenderer(service: service)
        }
        @discardableResult func update(foreground: Bool, globalPaused: Bool, terminalSuspended: Bool) -> Bool {
            guard current else {return false}
            service.setSourceForeground(foreground)
            return service.setSourceGlobalPaused(globalPaused, terminalSuspended: terminalSuspended)
        }
        func dispose() {
            guard !disposed else {return}; disposed = true
            context?.release(self)
            let callback = retire; retire = nil
            // Caller first removes captured Scene bindings, then their roots.
            callback?(); timeline.dispose(); tween.dispose(); smoke.dispose()
        }
        isolated deinit {dispose()}
    }
}
