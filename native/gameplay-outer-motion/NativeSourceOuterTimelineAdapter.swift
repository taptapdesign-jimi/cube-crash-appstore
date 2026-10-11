import Foundation

// PRIVATE UIKit/service bridge. Inject one APP-owned canonical service; no new
// CADisplayLink, per-node timer, renderer activity or manufactured callback.
@MainActor final class NativeSourceOuterTimelineAdapter:NativeTileOuterTimelineDriver {
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        let paint:(Double)->Void
        init(paint:@escaping(Double)->Void){self.paint=paint}
        func advanceSourceAnimation(seconds:Double){paint(seconds)}
    }
    @MainActor private final class Entry {
        let receipt:NativeTileOuterReceipt,participant:Participant
        var lease:NativeSourceAnimationClockService.Lease?
        let completed:()->Void,interrupted:()->Void
        init(receipt:NativeTileOuterReceipt,participant:Participant,completed:@escaping()->Void,interrupted:@escaping()->Void){self.receipt=receipt;self.participant=participant;self.completed=completed;self.interrupted=interrupted}
    }
    @MainActor private final class Cleanup {
        private var callbacks:(completed:()->Void,interrupted:()->Void)?
        init(completed:@escaping()->Void,interrupted:@escaping()->Void){callbacks=(completed,interrupted)}
        func finish(_ success:Bool){guard let captured=callbacks else{return};callbacks=nil;if success{captured.completed()}else{captured.interrupted()}}
    }
    private let service:NativeSourceAnimationClockService
    private var disposed=false
    private var entries:[UUID:Entry]=[:]
    init(service:NativeSourceAnimationClockService){self.service=service}
    func start(receipt:NativeTileOuterReceipt,duration:Double,paint:@escaping(Double)->Void,completed:@escaping()->Void,interrupted:@escaping()->Void)->Bool {
        guard !disposed,entries[receipt.id]==nil,duration.isFinite,duration>=0 else{return false}
        let entry=Entry(receipt:receipt,participant:Participant(paint:paint),completed:completed,interrupted:interrupted)
        entries[receipt.id]=entry
        let cleanup=Cleanup(completed:completed,interrupted:interrupted)
        let lease=service.register(participant:entry.participant,duration:duration,domain:.sourceGSAP(.timeline),cleanup:{[weak self,weak entry] success in
            if let self,let entry,self.entries[receipt.id] === entry {self.entries.removeValue(forKey:receipt.id)}
            // Token survives adapter/entry deallocation but does not retain the
            // participant. Canonical service weak retirement still emits false.
            cleanup.finish(success)
        })
        guard let lease else{entries.removeValue(forKey:receipt.id);return false}
        guard entries[receipt.id] === entry else{lease.cancel(success:false);return true}
        entry.lease=lease
        paint(0) // Authored initial creation pose, not a synthetic time advance.
        return true
    }
    func completeAtSourceBoundary(receipt:NativeTileOuterReceipt) {
        guard let entry=entries[receipt.id],entry.receipt==receipt else{return}
        if let lease=entry.lease {lease.cancel(success:true)}
        else {entries.removeValue(forKey:receipt.id);entry.completed()}
    }
    func interrupt(receipt:NativeTileOuterReceipt) {
        guard let entry=entries[receipt.id],entry.receipt==receipt else{return}
        if let lease=entry.lease {lease.cancel(success:false)}
        else {entries.removeValue(forKey:receipt.id);entry.interrupted()}
    }
    func dispose(){guard !disposed else{return};disposed=true;for receipt in entries.values.map(\.receipt){interrupt(receipt:receipt)}}
    isolated deinit {dispose()}

}
