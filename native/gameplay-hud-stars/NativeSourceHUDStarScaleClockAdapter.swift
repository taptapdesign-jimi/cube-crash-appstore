import Foundation

/// Borrowed existing APP Source clock. Timeline roots retain their participants;
/// no extra ticker, rendering lease or global pause/foreground mutation here.
@MainActor final class NativeSourceHUDStarScaleClockAdapter {
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        let paint:(Double)->Void
        init(_ paint:@escaping(Double)->Void){self.paint=paint}
        func advanceSourceAnimation(seconds:Double){paint(seconds)}
    }
    @MainActor private final class Entry {let id=UUID(),participant:Participant;var lease:NativeSourceAnimationClockService.Lease?,finished:((Bool)->Void)?
        init(paint:@escaping(Double)->Void,finished:@escaping(Bool)->Void){participant=Participant(paint);self.finished=finished}}
    private let service:NativeSourceAnimationClockService
    private var roots:[UUID:Entry]=[:],disposed=false
    var activeCount:Int{roots.count}
    init(service:NativeSourceAnimationClockService){self.service=service}
    func timeline(label:String,duration:Double,paint:@escaping(Double)->Void,finished:@escaping(Bool)->Void)->(()->Void)? {
        guard !disposed else{return nil}
        let entry=Entry(paint:paint,finished:finished);roots[entry.id]=entry
        guard let lease=service.register(participant:entry.participant,duration:duration,domain:.sourceGSAP(.timeline),cleanup:{[weak self,weak entry] success in
            guard let self,let entry,self.roots[entry.id] === entry else{return}
            self.roots.removeValue(forKey:entry.id);let callback=entry.finished;entry.finished=nil;callback?(success)
        }) else{roots.removeValue(forKey:entry.id);return nil}
        guard !disposed,roots[entry.id] === entry else{lease.cancel(success:false);return nil}
        entry.lease=lease
        return{[weak self,weak entry] in guard let self,let entry,self.roots[entry.id] === entry else{return};self.cancel(entry)}
    }
    private func cancel(_ entry:Entry){
        guard roots[entry.id] === entry else{return}
        // Remove exact captured root before any external cleanup callback.
        roots.removeValue(forKey:entry.id);let callback=entry.finished;entry.finished=nil
        entry.lease?.cancel(success:false);callback?(false)
    }
    func dispose(){guard !disposed else{return};disposed=true;let captured=Array(roots.values)
        for entry in captured{cancel(entry)}
    }
}
