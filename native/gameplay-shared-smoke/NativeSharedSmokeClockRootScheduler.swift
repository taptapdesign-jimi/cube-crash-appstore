import Foundation

/// PRIVATE SDK adapter. Reuses the canonical app union, no display link or
/// renderer lease is added by this bridge. Exact caller label admission remains
/// independently owned by its source FX container's captured activity receipt.
@MainActor
final class NativeSharedSmokeClockRootScheduler:NativeSharedSmokeRootScheduler {
    private let service:NativeSourceAnimationClockService
    init(service:NativeSourceAnimationClockService){self.service=service}
    func registerSourceRoot(participant:any NativeSourceAnimationParticipant,family:NativeSourceAnimationRuntime.RootFamily,
                            duration:Double,delay:Double,cleanup:@escaping(Bool)->Void)->NativeSharedSmokeRootCancellation? {
        guard let lease=service.register(participant:participant,duration:duration,domain:.sourceGSAP(family),delay:delay,cleanup:cleanup) else{return nil}
        return NativeSharedSmokeRootCancellation{lease.cancel(success:$0)}
    }
}
