import Foundation

/// One captured finite Source root; the board's union service owns delivery.
@MainActor final class NativeWildMeterSourceDriver: NativeWildMeterHUDDriving {
    private final class Root: NativeSourceAnimationParticipant {
        var paint: ((Double) -> Void)?
        var completed: (() -> Void)?
        var interrupted: (() -> Void)?
        var lease: NativeSourceAnimationClockService.Lease?
        var finished = false
        init(paint: @escaping(Double) -> Void, completed: @escaping() -> Void, interrupted: @escaping() -> Void) {
            self.paint = paint; self.completed = completed; self.interrupted = interrupted
        }
        func advanceSourceAnimation(seconds: Double) { if !finished { paint?(seconds) } }
        func finish(_ success: Bool) {
            guard !finished else { return }
            finished = true; lease = nil; paint = nil
            let callback = success ? completed : interrupted
            completed = nil; interrupted = nil; callback?()
        }
        func cancel() {
            guard !finished else { return }
            let captured = lease; lease = nil; captured?.cancel()
            if !finished { finish(false) }
        }
    }
    private let service: NativeSourceAnimationClockService
    init(service: NativeSourceAnimationClockService) { self.service = service }
    func start(duration: Double, paint: @escaping(Double) -> Void, completed: @escaping() -> Void, interrupted: @escaping() -> Void) -> (() -> Void)? {
        start(duration: duration, family: .timeline, paint: paint, completed: completed, interrupted: interrupted)
    }
    func start(duration: Double, family: NativeSourceAnimationRuntime.RootFamily, paint: @escaping(Double) -> Void, completed: @escaping() -> Void, interrupted: @escaping() -> Void) -> (() -> Void)? {
        let root = Root(paint: paint, completed: completed, interrupted: interrupted)
        guard let lease = service.register(participant: root, duration: duration, domain: .sourceGSAP(family), cleanup: { [weak root] success in root?.finish(success) }) else { return nil }
        root.lease = lease
        return { root.cancel() }
    }
}
