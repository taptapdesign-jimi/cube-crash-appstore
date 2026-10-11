import Foundation

/// PRIVATE per-invocation bounded registration owner. Its global scheduler is
/// injected app-lived; it does not bundle all effects in a Scene tick or install
/// a timer/render activity. Generation validation belongs to the caller AFTER
/// captured old cleanup; IDs remain scoped to one immutable invocation UUID.
@MainActor
final class NativeSharedSmokeRegisteredRoots {
    typealias Kind=NativeSharedSmokeRootPlan.Kind
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        var advance:(Double)->Void
        init(_ advance:@escaping(Double)->Void){self.advance=advance}
        func advanceSourceAnimation(seconds:Double){advance(seconds)}
    }
    @MainActor private final class Entry {
        let id:UUID,kind:Kind,participant:Participant
        var cancellation:NativeSharedSmokeRootCancellation?
        var emptyTimeline=false
        let family:NativeSourceAnimationRuntime.RootFamily
        init(id:UUID,kind:Kind,family:NativeSourceAnimationRuntime.RootFamily,participant:Participant){self.id=id;self.kind=kind;self.family=family;self.participant=participant}
    }
    private let scheduler:any NativeSharedSmokeRootScheduler
    private var entries:[UUID:Entry]=[:],disposed=false
    // Source pool kills child tweens, leaving empty timeline containers for
    // the already captured global traversal. Finite captured self-retention
    // ends at actual root cleanup or authoritative service disposal.
    private var emptyTailOwner:NativeSharedSmokeRegisteredRoots?
    var onDrained:(()->Void)?
    let invocationID=UUID()
    var activeRootCount:Int{entries.count}
    init(scheduler:any NativeSharedSmokeRootScheduler){self.scheduler=scheduler}
    @discardableResult
    func register(_ root:NativeSharedSmokeRootPlan.Registration,
                  advance:@escaping(Kind,Double)->Void,
                  retired:@escaping(Kind,Bool)->Void)->Bool {
        guard !disposed else{return false}
        let id=UUID(),kind=root.kind
        let entry=Entry(id:id,kind:kind,family:root.family,participant:Participant{_ in})
        entry.participant.advance={[weak entry] seconds in
            guard let entry else{return}
            if entry.emptyTimeline{entry.cancellation?.cancel(success:true)}else{advance(kind,seconds)}
        }
        entries[id]=entry
        // Captured independent once token is not participant/Scene ownership.
        // Weak owner deallocation must still deliver the old cleanup receipt.
        let token=RootCleanupToken{success in retired(kind,success)}
        let cancellation=scheduler.registerSourceRoot(participant:entry.participant,family:root.family,duration:root.duration,delay:root.delay){[weak self,weak entry] success in
            if let self,let entry,self.entries[id] === entry{self.entries.removeValue(forKey:id);if self.entries.isEmpty{self.emptyTailOwner=nil;let drained=self.onDrained;self.onDrained=nil;drained?()}}
            token.finish(success)
        }
        guard let cancellation else{entries.removeValue(forKey:id);return false}
        guard entries[id] === entry else{cancellation.cancel();return true}
        entry.cancellation=cancellation;return true
    }
    func cancel(kind:Kind,success:Bool=false){for entry in entries.values.filter({$0.kind==kind}){entry.cancellation?.cancel(success:success)}}
    func retainEmptyTimelineTail(){
        guard !disposed else{return};disposed=true
        let captured=Array(entries.values)
        for entry in captured where entry.family == .timeline{entry.emptyTimeline=true}
        emptyTailOwner=self
        for entry in captured where entry.family != .timeline{entry.cancellation?.cancel()}
        if entries.isEmpty{emptyTailOwner=nil}
    }
    func dispose(){
        disposed=true
        let captured=Array(entries.values)
        for entry in captured {entry.cancellation?.cancel()}
        emptyTailOwner=nil
    }
    isolated deinit {
        // Last paused participant need not have a future clock delivery.
        for entry in entries.values {entry.cancellation?.cancel()}
    }
}
@MainActor
private final class RootCleanupToken {
    private var callback:((Bool)->Void)?
    init(_ callback:@escaping(Bool)->Void){self.callback=callback}
    func finish(_ success:Bool){let captured=callback;callback=nil;captured?(success)}
}
