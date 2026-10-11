import Foundation
import CoreGraphics

@MainActor protocol NativeRegularContactTarget:AnyObject {
    var contactIdentity:ObjectIdentifier {get}
    var contactTileID:String {get}
    var contactGeneration:UInt64 {get}
    var contactAlive:Bool {get}
    var contactRotation:CGFloat {get set}
    var contactPosition:CGPoint {get set}
}

/// Captured actual layer/rotG target channels. Source click kill has no
/// onInterrupt restoration; neighbor completion restores only its captured
/// living visual. Shared clock drivers are injected by the app.
@MainActor final class NativeRegularContactPresentationOwner {
    private final class Entry {
        let target:any NativeRegularContactTarget,tween:NativeDragTweenReceipt?,timeline:NativeTileOuterReceipt?
        init(target:any NativeRegularContactTarget,tween:NativeDragTweenReceipt?=nil,timeline:NativeTileOuterReceipt?=nil){self.target=target;self.tween=tween;self.timeline=timeline}
    }
    private let tween:NativeDragTweenDriver,timeline:NativeTileOuterTimelineDriver
    private var entries:[ObjectIdentifier:Entry]=[:],disposed=false
    init(tween:NativeDragTweenDriver,timeline:NativeTileOuterTimelineDriver){self.tween=tween;self.timeline=timeline}
    var activeCount:Int{entries.count}
    private func current(_ entry:Entry)->Bool {
        !disposed && entry.target.contactAlive && entries[entry.target.contactIdentity] === entry
            && entry.target.contactGeneration == (entry.tween?.generation ?? entry.timeline!.generation)
    }
    private func cancel(_ captured:Entry) {
        let key=captured.target.contactIdentity
        if entries[key] === captured {entries.removeValue(forKey:key)}
        if let receipt=captured.tween {tween.cancel(receipt:receipt)}
        if let receipt=captured.timeline {timeline.interrupt(receipt:receipt)}
    }
    @discardableResult func click(target:any NativeRegularContactTarget,random:()->Double)->Bool {
        guard !disposed,target.contactAlive else{return false}
        let base=target.contactRotation
        let direction=random(),angle=random()
        guard !disposed,target.contactAlive else{return false}
        if let old=entries[target.contactIdentity] {cancel(old)}
        guard !disposed,target.contactAlive else{return false}
        target.contactRotation=NativeRegularContactClickMotion(base:base,directionDraw:direction,angleDraw:angle,durationDraw:0).immediate
        let durationDraw=random(),motion=NativeRegularContactClickMotion(base:base,directionDraw:direction,angleDraw:angle,durationDraw:durationDraw)
        guard !disposed,target.contactAlive else{return false}
        let receipt=NativeDragTweenReceipt(id:UUID(),tileID:target.contactTileID,generation:target.contactGeneration)
        let entry=Entry(target:target,tween:receipt),key=target.contactIdentity;entries[key]=entry
        var from:CGFloat?
        let admitted=tween.start(receipt:receipt,duration:motion.duration,paint:{[weak self] seconds in
            guard let self,self.current(entry) else{return}
            if from==nil {from=target.contactRotation}
            target.contactRotation=motion.sample(seconds:seconds,capturedStart:from!)
        },finished:{[weak self] _ in
            guard let self,self.entries[key] === entry else{return};self.entries.removeValue(forKey:key)
        })
        if !admitted,entries[key] === entry {entries.removeValue(forKey:key);if target.contactAlive {target.contactRotation=base}}
        return admitted
    }
    @discardableResult func neighbor(target:any NativeRegularContactTarget,offset:CGPoint,renderScale:CGFloat,random:()->Double,killOtherVisualTweens:()->Void)->Bool {
        guard !disposed,target.contactAlive else{return false}
        let base=target.contactPosition,motion=NativeRegularContactNeighborMotion(base:base,offset:offset,impulseDraw:random(),renderScale:renderScale)
        guard !disposed,target.contactAlive else{return false}
        if let old=entries[target.contactIdentity] {cancel(old)}
        killOtherVisualTweens()
        guard !disposed,target.contactAlive else{return false}
        let receipt=NativeTileOuterReceipt(id:UUID(),tileID:target.contactTileID,generation:target.contactGeneration,kind:.mergeImpact)
        let entry=Entry(target:target,timeline:receipt),key=target.contactIdentity;entries[key]=entry
        let admitted=timeline.start(receipt:receipt,duration:NativeRegularContactNeighborMotion.duration,paint:{[weak self] seconds in
            guard let self,self.current(entry) else{return};target.contactPosition=motion.sample(seconds:seconds)
        },completed:{[weak self] in
            guard let self,self.entries[key] === entry else{return};let restore=self.current(entry);self.entries.removeValue(forKey:key);if restore {target.contactPosition=base}
        },interrupted:{[weak self] in
            guard let self,self.entries[key] === entry else{return};self.entries.removeValue(forKey:key)
        })
        if !admitted,entries[key] === entry {entries.removeValue(forKey:key)}
        return admitted
    }
    func interruptTarget(_ identity:ObjectIdentifier){if let entry=entries[identity]{cancel(entry)}}
    func retire(generation:UInt64){let old=entries.values.filter{$0.target.contactGeneration==generation};for entry in old{cancel(entry)}}
    func dispose(){guard !disposed else{return};disposed=true;let old=Array(entries.values);entries.removeAll();for entry in old{cancel(entry)}}
    isolated deinit {dispose()}
}
