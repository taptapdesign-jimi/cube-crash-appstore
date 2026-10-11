import Foundation

struct NativeDragTweenReceipt:Hashable {let id:UUID;let tileID:String;let generation:UInt64}
@MainActor protocol NativeDragTweenDriver:AnyObject {
    /// Literal trackTween gsap.to default-lazy root. No creation paint0.
    func start(receipt:NativeDragTweenReceipt,duration:Double,paint:@escaping(Double)->Void,finished:@escaping(Bool)->Void)->Bool
    func cancel(receipt:NativeDragTweenReceipt)
}
@MainActor protocol NativeDragShadowHost:AnyObject {
    var dragShadowTileID:String {get}
    var dragShadowGeneration:UInt64 {get}
    var dragShadowIsWild:Bool {get}
    var dragShadowAlpha:CGFloat {get set}
    var dragShadowLiftScale:CGFloat {get set}
    var dragShadowVisible:Bool {get set}
    var dragInnerTilt:CGFloat {get set}
    func paintDragShadow(_ pose:NativeDragShadowPose)
}

@MainActor final class NativeDragShadowPresentationOwner {
    private enum Target {case alpha,scale,tilt}
    private struct Entry {let receipt:NativeDragTweenReceipt;let target:Target}
    private weak var host:(any NativeDragShadowHost)?
    private let driver:NativeDragTweenDriver
    private var entries:[UUID:Entry]=[:]
    private var direction=NativeDragShadowDirection()
    init(host:any NativeDragShadowHost,driver:NativeDragTweenDriver){self.host=host;self.driver=driver}
    private func current(_ receipt:NativeDragTweenReceipt)->Bool {host?.dragShadowTileID==receipt.tileID && host?.dragShadowGeneration==receipt.generation}
    private func cancel(_ target:Target,excluding:UUID?=nil) {
        let captured=entries.values.filter{$0.target==target && $0.receipt.id != excluding};for entry in captured {entries.removeValue(forKey:entry.receipt.id);driver.cancel(receipt:entry.receipt)}
    }
    private func tween(_ target:Target,to value:CGFloat,duration:Double,curve:NativeDragScalarTween.Curve,overwriteOnFirstPaint:Bool=false,completed:@escaping()->Void={}) {
        guard let host else{return}
        let receipt=NativeDragTweenReceipt(id:UUID(),tileID:host.dragShadowTileID,generation:host.dragShadowGeneration)
        entries[receipt.id]=Entry(receipt:receipt,target:target)
        var capturedStart:CGFloat?
        let accepted=driver.start(receipt:receipt,duration:duration,paint:{[weak self] seconds in
            guard let self,self.entries[receipt.id] != nil,self.current(receipt),let host=self.host else{return}
            // gsap.to captures source values on actual first lazy render.
            if capturedStart==nil {
                switch target {case .alpha:capturedStart=host.dragShadowAlpha;case .scale:capturedStart=host.dragShadowLiftScale;case .tilt:capturedStart=host.dragInnerTilt}
                if overwriteOnFirstPaint {self.cancel(target,excluding:receipt.id)}
            }
            let result=NativeDragScalarTween(start:capturedStart!,target:value,duration:duration,curve:curve).sample(seconds)
            switch target {case .alpha:host.dragShadowAlpha=result;case .scale:host.dragShadowLiftScale=result;case .tilt:host.dragInnerTilt=result}
        },finished:{[weak self] success in
            guard let self,self.entries.removeValue(forKey:receipt.id) != nil,self.current(receipt) else{return}
            if success {completed()}
        })
        if !accepted {entries.removeValue(forKey:receipt.id)}
    }
    func pickup() {
        guard let host else{return}
        if host.dragShadowIsWild {host.dragShadowVisible=false;return}
        direction.reset();paint()
        host.dragShadowVisible=true
        cancel(.alpha);tween(.alpha,to:0.18,duration:0.08,curve:.power2Out)
        cancel(.scale);tween(.scale,to:1.03,duration:0.1,curve:.power2Out)
    }
    func update(filteredVelocity:CGPoint) {
        guard host?.dragShadowVisible==true else{return}
        direction.update(filteredVelocity:filteredVelocity);paint()
    }
    private func paint() {guard let host else{return};host.paintDragShadow(.resolve(direction:direction.cast,tilt:host.dragInnerTilt))}
    func release(keepsInnerIdle:Bool,baseAlpha:CGFloat=0) {
        guard let host else{return}
        if !keepsInnerIdle {tween(.tilt,to:0,duration:0.5,curve:.power2Out)}
        // Alpha release deliberately does not cancel unfinished pickup alpha;
        // original gsap.to has no overwrite option here. Canonical roots retain order.
        tween(.alpha,to:baseAlpha,duration:0.12,curve:.power2Out,completed:{[weak self] in
            guard let self,let host=self.host else{return};host.dragShadowVisible=baseAlpha>0;self.direction.reset();self.paint()
        })
        tween(.scale,to:1,duration:0.14,curve:.backOut18,overwriteOnFirstPaint:true)
    }
    func snapBackCompleted(baseAlpha:CGFloat=0) {
        // Literal snapBack timeline.add schedules a separate0.12 alpha tween.
        tween(.alpha,to:baseAlpha,duration:0.12,curve:.power2Out,completed:{[weak self] in
            guard let self,let host=self.host else{return};host.dragShadowVisible=baseAlpha>0;self.direction.reset();self.paint()
        })
    }
    func cancelInnerTiltReturn(){cancel(.tilt)}
    func dispose(){let captured=entries.values;entries.removeAll();for entry in captured {driver.cancel(receipt:entry.receipt)};host=nil}
}
