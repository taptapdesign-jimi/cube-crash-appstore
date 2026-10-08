import Foundation

/// Literal setValue one-shot caller. The app supplies its existing Source
/// service and visual RNG; this owner adds no animation or activity lease.
@MainActor final class NativeRegularStackFrameBinding {
    @MainActor private final class Host:NativeRegularStackFrameHost {
        weak var target:(any NativeRegularStackFrameHost)?
        weak var binding:NativeRegularStackFrameBinding?
        let tileID:String,generation:UInt64
        init(_ target:any NativeRegularStackFrameHost) {self.target=target;tileID=target.sourceTileID;generation=target.sourceGeneration}
        var sourceTileID:String {tileID}
        var sourceGeneration:UInt64 {generation}
        var sourceAlive:Bool {
            guard let binding,let target,!binding.disposed,target.sourceAlive,target.sourceTileID==tileID,target.sourceGeneration==generation else{return false}
            let accepted=binding.current()
            return accepted && !binding.disposed && self.target === target && target.sourceAlive && target.sourceTileID==tileID && target.sourceGeneration==generation
        }
        var sourceValue:Int {get{target?.sourceValue ?? 0}set{if sourceAlive {target?.sourceValue=newValue}}}
        var sourceAlpha:Double {get{target?.sourceAlpha ?? 0}set{if sourceAlive {target?.sourceAlpha=newValue}}}
        var sourceLocked:Bool {target?.sourceLocked ?? true}
        var sourceStackDepth:Int {get{target?.sourceStackDepth ?? 1}set{if sourceAlive {target?.sourceStackDepth=newValue}}}
        var sourceMaxStackDepth:Int {get{target?.sourceMaxStackDepth ?? 1}set{if sourceAlive {target?.sourceMaxStackDepth=newValue}}}
        var sourceBaseScaleX:Double {target?.sourceBaseScaleX ?? 1}
        var sourceBaseScaleY:Double {target?.sourceBaseScaleY ?? 1}
        var sourceBaseAnchorX:Double {target?.sourceBaseAnchorX ?? 0.5}
        var sourceBaseAnchorY:Double {target?.sourceBaseAnchorY ?? 0.5}
        var sourceBaseX:Double {target?.sourceBaseX ?? 0}
        var sourceBaseY:Double {target?.sourceBaseY ?? 0}
        func prepareSourceStackSkin(_ skin:NativeRegularStackLayout.Skin){if sourceAlive {target?.prepareSourceStackSkin(skin)}}
        func installSourceStackFace(_ layout:NativeRegularStackLayout){if sourceAlive {target?.installSourceStackFace(layout)}}
    }
    private let host:Host,service:NativeSourceAnimationClockService,current:()->Bool,random:()->Double,available:Set<NativeRegularStackLayout.Skin>
    private var disposed=false,frames:[NativeRegularStackFrameReceipt:NativeSourceAnimationClockService.SourceFrameLease]=[:]
    private lazy var owner=NativeRegularStackFrameOwner(host:host,schedule:{[weak self] receipt,callback in self?.schedule(receipt,callback)},available:available,random:random)
    var pendingReceipts:[NativeRegularStackFrameReceipt] {disposed ? []:owner.pendingReceipts}
    var pendingFrameCount:Int {frames.count}
    init(host:any NativeRegularStackFrameHost,service:NativeSourceAnimationClockService,available:Set<NativeRegularStackLayout.Skin>,random:@escaping()->Double,current:@escaping()->Bool) {
        self.host=Host(host);self.service=service;self.available=available;self.random=random;self.current=current
        self.host.binding=self
    }
    @discardableResult func setValue(_ value:Int,addStack:Int)->Bool {
        guard !disposed,host.sourceAlive else{return false}
        guard let receipt=owner.setValue(value,addStack:addStack) else{return false}
        return !disposed && frames[receipt]?.active==true
    }
    private func schedule(_ receipt:NativeRegularStackFrameReceipt,_ callback:@escaping @MainActor ()->Void) {
        guard !disposed,host.sourceAlive else{owner.cancel(receipt);return}
        let lease=service.requestSourceAnimationFrame(ownerID:"setValue:\(receipt.tileID):\(receipt.id)",generation:receipt.generation,callback:{[weak self] in
            guard let self else{return}
            self.frames.removeValue(forKey:receipt) // retire captured lease BEFORE any paint/RNG callback
            guard !self.disposed else{return}
            callback()
        },onCancelled:{[weak self] in
            guard let self else{return}
            self.frames.removeValue(forKey:receipt);self.owner.cancel(receipt)
        })
        guard let lease,!disposed,host.sourceAlive else{lease?.cancel();owner.cancel(receipt);return}
        frames[receipt]=lease
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        let captured=Array(frames.values);frames.removeAll();owner.dispose();host.target=nil
        for frame in captured {frame.cancel()}
    }
    isolated deinit {dispose()}
}
