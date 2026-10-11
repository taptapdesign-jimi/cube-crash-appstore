import Foundation

/// PRIVATE default-lazy Source tween adapter. Inject the same APP service used
/// by outer timelines; no creation paint0 and no frame/activity owner added.
@MainActor final class NativeSourceDragTweenAdapter:NativeDragTweenDriver {
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        let paint:(Double)->Void
        init(_ paint:@escaping(Double)->Void){self.paint=paint}
        func advanceSourceAnimation(seconds:Double){paint(seconds)}
    }
    @MainActor private final class Cleanup {
        var callback:((Bool)->Void)?
        init(_ callback:@escaping(Bool)->Void){self.callback=callback}
        func finish(_ success:Bool){let captured=callback;callback=nil;captured?(success)}
    }
    @MainActor private final class Entry {
        let participant:Participant,cleanup:Cleanup
        var lease:NativeSourceAnimationClockService.Lease?
        init(paint:@escaping(Double)->Void,finished:@escaping(Bool)->Void){participant=Participant(paint);cleanup=Cleanup(finished)}
    }
    private let service:NativeSourceAnimationClockService
    private var disposed=false
    private var entries:[UUID:Entry]=[:]
    init(service:NativeSourceAnimationClockService){self.service=service}
    func start(receipt:NativeDragTweenReceipt,duration:Double,paint:@escaping(Double)->Void,finished:@escaping(Bool)->Void)->Bool {
        guard !disposed,entries[receipt.id]==nil,duration.isFinite,duration>=0 else{return false}
        let entry=Entry(paint:paint,finished:finished),cleanup=entry.cleanup;entries[receipt.id]=entry
        guard let lease=service.register(participant:entry.participant,duration:duration,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self,weak entry] success in
            if let self,let entry,self.entries[receipt.id] === entry {self.entries.removeValue(forKey:receipt.id)}
            cleanup.finish(success)
        }) else{entries.removeValue(forKey:receipt.id);return false}
        guard entries[receipt.id] === entry else{lease.cancel(success:false);return true}
        entry.lease=lease;return true
    }
    func cancel(receipt:NativeDragTweenReceipt) {guard let captured=entries[receipt.id] else{return};if let lease=captured.lease {lease.cancel(success:false)}else{entries.removeValue(forKey:receipt.id);captured.cleanup.finish(false)}}
    func dispose(){
        guard !disposed else{return};disposed=true
        let captured=Array(entries.values);entries.removeAll()
        for entry in captured {
            if let lease=entry.lease {lease.cancel(success:false)}
            else {entry.cleanup.finish(false)}
        }
    }
    isolated deinit {dispose()}

}
