import Foundation
import SpriteKit
import StackToSixGameplay

/// Literal v9 retained destination conversion + app-spawn tail. It borrows
/// the actual captured Node/service; no holder, clock, timer or value draw.
@MainActor final class NativeSourceMagnetSurvivorOwner {
    enum Completion:Equatable {case completed,interrupted,unavailable}
    struct Hooks {
        let current:()->Bool
        /// Stable captured Node/app scope, distinct from this finite tail.
        let frameCurrent:()->Bool
        let random:()->Double
        let acquireFrames:()->(()->Void)?
        let beforeSetValue:()->Bool
        let resolutionReleased:()->Void
        let inputBound:()->Void
        let finished:(Completion)->Void
    }
    let node:NativeDiceNode
    let transactionID:String,generation:UInt64
    private let service:NativeSourceAnimationClockService,driver:NativeTileOuterTimelineDriver,hooks:Hooks
    private var bounce:NativeSourceAppSpawnBounceOwner?
    private var closed=false,begun=false
    private var conversionRevision:UInt64?
    private var pendingEntry:UUID?
    private(set) var inputBound=false
    init(node:NativeDiceNode,transactionID:String,generation:UInt64,service:NativeSourceAnimationClockService,
         driver:NativeTileOuterTimelineDriver,hooks:Hooks) {
        self.node=node;self.transactionID=transactionID;self.generation=generation
        self.service=service;self.driver=driver;self.hooks=hooks
    }
    var active:Bool {begun && !closed}
    private func current()->Bool {
        guard !closed,node.sourceContactNodeAlive,node.sourceGeneration==generation,conversionRevision==nil || conversionRevision==node.sourceRetainedMagnetConversionRevision else{return false}
        let accepted=hooks.current()
        return accepted && !closed && node.sourceContactNodeAlive && node.sourceGeneration==generation && (conversionRevision==nil || conversionRevision==node.sourceRetainedMagnetConversionRevision)
    }
    @discardableResult func start(position:CGPoint,depthZ:CGFloat,selectSurvivor:()->NativeTile?)->Bool {
        guard !begun,current(),service.sourceFrameTransportAdmissionOpen else{return false}
        begun=true
        guard node.convertSourceMagnetSurvivor(position:position,depthZ:depthZ,selectValue:{
            guard current(),let survivor=selectSurvivor(),current(),survivor.id==node.tileID,
                  survivor.value>0,survivor.value<6,!survivor.isWild,!survivor.locked else{return nil}
            return survivor.value
        },
            service:service,driver:driver,random:hooks.random,current:{[weak self] in self?.current()==true},
            frameCurrent:hooks.frameCurrent,beforeSetValue:{[weak self] in
                guard let self,self.current() else{return false}
                // The retained container becomes a NEW numbered face. Hide it
                // before publishing the value, then atomically transfer to bounce.
                self.node.prepareSourceFreshFaceEntry();self.pendingEntry=self.node.sourcePendingFreshFaceEntryID
                return self.hooks.beforeSetValue()
            },onCancelled:{[weak self] in self?.finish(.interrupted)}),current() else {finish(.unavailable);return false}
        conversionRevision=node.sourceRetainedMagnetConversionRevision
        // Source releaseSpecialDiceResolution is after setValue and before the
        // decorative spawnBounce. This is distinct from its real drag bind.
        hooks.resolutionReleased();guard current() else{finish(.unavailable);return false}
        // PWA atomic survivor commit binds the regular input host before its
        // decorative bounce. Pickup may settle that tail without losing input.
        inputBound=true;hooks.inputBound()
        guard current() else{finish(.interrupted);return false}
        let ownerID="magnet-survivor:\(generation):\(transactionID)"
        let tail=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{[weak self] in self?.current()==true},
            readRotation:{[weak self] in self.map{Double($0.node.dragInnerTilt)}},
            paintScale:{[weak self] value in self?.node.paintSourceOuterScale(.init(x:value,y:value))},
            paintRotation:{[weak self] value in self?.node.dragInnerTilt=CGFloat(value)},
            ensureFullOpacity:{[weak self] in self?.node.ensureSourceAppSpawnFullOpacity()},random:hooks.random,
            acquireFrames:hooks.acquireFrames,finished:{[weak self] completion in
                guard let self else{return}
                self.node.unbindSourceAppSpawnInterruption(id:ownerID)
                switch completion {
                case .completed:
                    guard self.current() else{self.finish(.interrupted);return}
                    self.finish(.completed)
                case .interrupted:
                    // Once regular face/input are committed, cancellation of
                    // the decorative tail is a successful visual settlement.
                    self.finish(self.inputBound && self.current() ? .completed:.interrupted)
                case .unavailable:self.finish(.unavailable)
                }
            }),initialScale:NativeSourceAppSpawnBounceOwner.nativeEntryScale,nativeFreshFace:true,nativeFrameSerial:node.scene is NativeBoardScene ? {[weak node] in node?.sourceFreshFaceRenderSerial}:nil)
        bounce=tail
        guard node.bindSourceAppSpawnInterruption(id:ownerID,pickup:{[weak tail] in tail?.removeChildrenForPickup()},
            interrupted:{[weak tail] in tail?.interrupt()}),current(),tail.start(),current() else {
            tail.interrupt();finish(.unavailable);return false
        }
        return true
    }
    private func finish(_ completion:Completion) {
        guard !closed else{return};closed=true
        let captured=bounce;bounce=nil
        node.unbindSourceAppSpawnInterruption(id:"magnet-survivor:\(generation):\(transactionID)")
        captured?.interrupt()
        if let pendingEntry {node.retireSourcePendingFreshFaceEntry(expected:pendingEntry)}
        pendingEntry=nil
        hooks.finished(completion)
    }
    func retire(){finish(.interrupted)}
    isolated deinit {retire()}
}
