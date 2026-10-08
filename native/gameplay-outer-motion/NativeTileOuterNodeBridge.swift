import Foundation

// Host owns the native geometry factor. Source scale is tile-local; bridge never
// writes node geometry to1 or reparented frame coordinates to a guessed origin.
@MainActor protocol NativeTileOuterPoseHost:AnyObject {
    var sourceTileID:String {get}
    var sourceGeneration:UInt64 {get}
    var sourceLocalScale:CGPoint {get}
    var sourceLocalPosition:CGPoint {get}
    var sourceRotation:CGFloat {get}
    var sourceSkipIdleScaleReset:Bool {get}
    func paintSourceOuter(_ pose:NativeTileOuterMotion.Pose)
    func paintSourceOuterPosition(_ position:CGPoint)
    func paintSourceOuterScale(_ scale:CGPoint)
    func paintSourceIdleRotation(_ rotation:CGFloat)
    func paintSourceOuterPositionRotation(_ pose:NativeTileOuterMotion.Pose)
    func paintSourceIdle(_ pose:NativeRegularIdleMotion.Pose)
}

@MainActor extension NativeTileOuterPoseHost {
    func paintSourceIdleRotation(_ rotation:CGFloat) {paintSourceIdle(.init(x:sourceLocalScale.x,y:sourceLocalScale.y,rotation:rotation))}
    func paintSourceOuterPositionRotation(_ pose:NativeTileOuterMotion.Pose) {paintSourceOuter(.init(position:pose.position,scale:sourceLocalScale,rotation:pose.rotation))}
    func paintSourceOuterPosition(_ position:CGPoint) {
        paintSourceOuter(.init(position:position,scale:sourceLocalScale,rotation:sourceRotation))
    }
}

@MainActor final class NativeTileOuterNodeBridge {
    private weak var host:(any NativeTileOuterPoseHost)?
    private let owner:NativeTileOuterPresentationOwner
    private var cachedBase:CGPoint?
    init(host:any NativeTileOuterPoseHost,driver:NativeTileOuterTimelineDriver) {
        self.host=host;owner=NativeTileOuterPresentationOwner(driver:driver)
    }
    var receipt:NativeTileOuterReceipt? {owner.receipt}
    var owners:NativeTileOuterEligibility.Owners {owner.ownership.flags}
    var idleTimelinePresent:Bool {owner.ownership.idleTimelinePresent}
    var activeIdle:Bool {owner.activeIdle}
    func killActiveScaleChildren(){owner.killScaleChildren(onlyActive:true)}
    func mergeImpact(_ motion:NativeMergeImpactMotion)->Bool {
        guard let host else{return false};let id=host.sourceTileID,generation=host.sourceGeneration
        return owner.beginMergeImpact(tileID:id,generation:generation,motion:motion,isCurrent:{[weak self] in self?.current(id,generation)==true},paintScale:{[weak self] in self?.host?.paintSourceOuterScale($0)})
    }
    private func current(_ id:String,_ generation:UInt64)->Bool {host?.sourceTileID==id && host?.sourceGeneration==generation}
    func pickup()->Bool {
        guard let host else{return false}
        let id=host.sourceTileID,generation=host.sourceGeneration
        let base=NativeTileOuterMotion.canonicalBase(cached:cachedBase,live:host.sourceLocalScale)
        cachedBase=base
        // Source captures base before killing old pickup/snapback/idle owners.
        owner.interrupt();host.paintSourceOuterScale(base)
        return owner.beginMotion(tileID:id,generation:generation,motion:.init(kind:.pickup,base:base,from:host.sourceLocalPosition,target:host.sourceLocalPosition,rotation:host.sourceRotation),isCurrent:{[weak self] in self?.current(id,generation)==true},paint:{[weak self] pose in self?.host?.paintSourceOuterScale(pose.scale)},restoreInterruptedScale:{[weak self] scale in self?.host?.paintSourceOuterScale(scale)})
    }
    func snapBack(to destination:CGPoint,onCompleted:@escaping()->Void)->Bool {
        guard let host else{return false}
        let id=host.sourceTileID,generation=host.sourceGeneration
        let base=NativeTileOuterMotion.canonicalBase(cached:cachedBase,live:host.sourceLocalScale)
        cachedBase=base;owner.interrupt();host.paintSourceOuterScale(base)
        return owner.beginMotion(tileID:id,generation:generation,motion:.init(kind:.snapBack,base:base,from:host.sourceLocalPosition,target:destination,rotation:host.sourceRotation),isCurrent:{[weak self] in self?.current(id,generation)==true},paint:{[weak self] pose in self?.host?.paintSourceOuter(pose)},paintWithoutScale:{[weak self] pose in self?.host?.paintSourceOuterPositionRotation(pose)},restoreInterruptedScale:{[weak self] scale in self?.host?.paintSourceOuterScale(scale)},onCompleted:onCompleted)
    }
    func idle(_ motion:NativeRegularIdleMotion,releaseSourceFrames:@escaping()->Void,onSmoke:@escaping()->Void,onFinished:@escaping()->Void)->Bool {
        guard let host else{releaseSourceFrames();return false}
        let id=host.sourceTileID,generation=host.sourceGeneration
        cachedBase=CGPoint(x:1,y:1)
        return owner.beginIdle(tileID:id,generation:generation,motion:motion,releaseSourceFrames:releaseSourceFrames,isCurrent:{[weak self] in self?.current(id,generation)==true},mayRestore:{[weak self] in self?.host?.sourceSkipIdleScaleReset==false},paint:{[weak self] pose in self?.host?.paintSourceIdle(pose)},paintRotationOnly:{[weak self] rotation in self?.host?.paintSourceIdleRotation(rotation)},onSmoke:onSmoke,onFinished:onFinished)
    }
    func interrupt(){owner.interrupt()}
    func interrupt(receipt:NativeTileOuterReceipt) {owner.interrupt(receipt:receipt)}
    func restoreForAcceptedDrop() {
        owner.interrupt()
        guard let host else{return}
        let base=NativeTileOuterMotion.canonicalBase(cached:cachedBase,live:host.sourceLocalScale)
        cachedBase=base;host.paintSourceOuterScale(base)
    }
    func dispose(){owner.interrupt();host=nil}
}
