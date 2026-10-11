import Foundation

@MainActor protocol NativeRegularStackFeedbackTarget:AnyObject {
    var sourceFeedbackAlive:Bool {get}
    var sourceFeedbackRotation:Double {get set}
    var sourceFeedbackAlpha:Double {get set}
}

/// Literal sourceDepth>1 old-stack suffix, AFTER authored ordinary sound.
/// Existing app service owns the two finite default-lazy roots per captured
/// child. Removed stack children keep their finite root tail but cannot paint.
@MainActor final class NativeRegularStackFeedbackOwner {
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        let paint:(Double)->Void
        init(_ paint:@escaping(Double)->Void){self.paint=paint}
        func advanceSourceAnimation(seconds:Double){paint(seconds)}
    }
    @MainActor private final class Entry {
        let id=UUID(),target:any NativeRegularStackFeedbackTarget
        var participant:Participant?,lease:NativeSourceAnimationClockService.Lease?
        var from:Double?
        init(_ target:any NativeRegularStackFeedbackTarget){self.target=target}
    }
    private let service:NativeSourceAnimationClockService
    private var disposed=false,entries:[UUID:Entry]=[:]
    var activeCount:Int {entries.count}
    init(service:NativeSourceAnimationClockService){self.service=service}
    @discardableResult func start(children:[NativeRegularStackLayerCapture],sourceDepth:Int,random:()->Double,
        layer:(NativeRegularStackLayerCapture)->(any NativeRegularStackFeedbackTarget)?,
        appendOverlay:(NativeRegularStackLayerCapture)->(any NativeRegularStackFeedbackTarget)?,
        removeOverlay:@escaping(any NativeRegularStackFeedbackTarget)->Void)->Bool {
        guard !disposed else{return false}
        guard sourceDepth>1 else{return true}
        var direction=0
        for child in children {
            guard !disposed,let target=layer(child),target.sourceFeedbackAlive else{return false}
            // Source appends the overlay BEFORE the direction/rotation draws.
            guard let overlay=appendOverlay(child),!disposed,overlay.sourceFeedbackAlive else{return false}
            if direction==0 {direction=random()>0.5 ? 1:-1}
            let finalRotation=Double(direction)*(5+random()*5)*Double.pi/180
            guard !disposed,target.sourceFeedbackAlive,overlay.sourceFeedbackAlive else{return false}
            guard install(target,duration:0.2,delay:0,paint:{entry,seconds in
                if entry.from==nil {entry.from=target.sourceFeedbackRotation}
                let p=max(0,min(1,seconds/0.2)),ease=1-pow(1-p,3)
                target.sourceFeedbackRotation=entry.from!+(finalRotation-entry.from!)*ease
            },completed:{}) else{return false}
            guard !disposed else{return false}
            guard install(overlay,duration:0.4,delay:0.2,paint:{entry,seconds in
                if entry.from==nil {entry.from=overlay.sourceFeedbackAlpha}
                let p=max(0,min(1,seconds/0.4))
                overlay.sourceFeedbackAlpha=entry.from!*pow(1-p,2)
            },completed:{removeOverlay(overlay)}) else{return false}
            direction = -direction
        }
        return true
    }
    private func install(_ target:any NativeRegularStackFeedbackTarget,duration:Double,delay:Double,
                         paint:@escaping(Entry,Double)->Void,completed:@escaping()->Void)->Bool {
        guard !disposed else{return false}
        let entry=Entry(target);entries[entry.id]=entry
        let participant=Participant{[weak self,weak entry] seconds in
            guard let self,let entry,!self.disposed,self.entries[entry.id] === entry,entry.target.sourceFeedbackAlive else{return}
            guard !self.disposed,self.entries[entry.id] === entry else{return}
            paint(entry,seconds)
        };entry.participant=participant
        let lease=service.register(participant:participant,duration:duration,domain:.sourceGSAP(.defaultLazyTween),delay:delay,cleanup:{[weak self,weak entry] success in
            guard let self,let entry,self.entries[entry.id] === entry else{return}
            self.entries.removeValue(forKey:entry.id)
            if success,!self.disposed {completed()}
        })
        guard let lease,!disposed,entries[entry.id] === entry else{entries.removeValue(forKey:entry.id);lease?.cancel(success:false);return false}
        entry.lease=lease;return true
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        let captured=Array(entries.values);entries.removeAll()
        for entry in captured {entry.lease?.cancel(success:false)}
    }
    isolated deinit {dispose()}
}
