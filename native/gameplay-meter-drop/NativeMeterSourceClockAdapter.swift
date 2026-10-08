import Foundation

/// Strong participant belongs to one captured finite root. The shared clock
/// retains it weakly; this wrapper's cleanup retires precisely that capture.
@MainActor
final class NativeMeterSourceClockAdapter:NativeSourceAnimationParticipant {
    private var phase:((Double)->Void)?
    private var cleanup:((Bool)->Void)?
    private var lease:NativeSourceAnimationClockService.Lease?
    private var disposed=false
    private init(phase:@escaping(Double)->Void,cleanup:@escaping(Bool)->Void) {
        self.phase=phase;self.cleanup=cleanup
    }
    static func attach(service:NativeSourceAnimationClockService,duration:Double,
                       advance:@escaping(Double)->Void,finish:@escaping(Bool)->Void)->NativeWildMeterDropSceneOwner.MotionLease? {
        let owner=NativeMeterSourceClockAdapter(phase:advance,cleanup:finish)
        guard let lease=service.register(participant:owner,duration:duration,domain:.sourceGSAP(.timeline),cleanup:{ [weak owner] success in owner?.finish(success) }) else{return nil}
        owner.lease=lease
        // Closures strongly retain this participant for its captured finite phase.
        return .init(cancel:{owner.cancel()},suspend:{owner.lease?.setSuspended($0)})
    }
    func advanceSourceAnimation(seconds:Double) {guard !disposed else{return};phase?(seconds)}
    private func finish(_ success:Bool) {guard !disposed else{return};disposed=true;lease=nil;phase=nil;let done=cleanup;cleanup=nil;done?(success)}
    private func cancel() {guard !disposed else{return};let lease=lease;self.lease=nil;lease?.cancel();if !disposed {finish(false)}}
}
