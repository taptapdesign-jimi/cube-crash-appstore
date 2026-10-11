import Foundation
import CoreGraphics
import StackToSixGameplay

/// Clockless capture connecting the genuine installed Source main tween to
/// the canonical Core. The same captured physical objects survive pre-main
/// synchronization; neither a pause nor an elapsed native timer is an arrival.
@MainActor final class NativeSourceMergeSixMainCapture<Node:AnyObject> {
    enum Plan {
        case ordinary(NativeOrdinaryMovePlan),direct(NativeDirectWildMovePlan)
        var id:String {switch self {case .ordinary(let p):p.id;case .direct(let p):p.id}}
        var generation:UInt64 {switch self {case .ordinary(let p):p.generation;case .direct(let p):p.generation}}
        var source:NativeTile {switch self {case .ordinary(let p):p.source;case .direct(let p):p.source}}
        var destination:NativeTile {switch self {case .ordinary(let p):p.destination;case .direct(let p):p.destination}}
    }
    enum Phase:Equatable {case captured,installed,entered,interrupted,retired}
    struct MainGeometry:Equatable {let destinationScreen:CGPoint}
    struct Hooks {
        var contextCurrent:()->Bool
        var nodeCurrent:(Node,String,UInt64)->Bool
        /// Actual destination pose at main80, before Core removes its identity.
        /// No cell lookup, geometry-center reset, or new RNG draw is permitted.
        var captureGeometry:(Node)->MainGeometry?
        var removeCapturedPair:(Node,Node)->Void
        var releaseFramesAndIdle:()->Void
        var releaseSpecialAndQueue:()->Void
        var publish:(NativeMoveResult,MainGeometry?)->Void
        var retireNativeRoots:()->Void
    }
    let plan:Plan,source:Node,destination:Node
    private weak var engine:NativeGameplayEngine?
    private let hooks:Hooks
    private(set) var phase=Phase.captured
    private(set) var nativeMainID:UUID?
    private(set) var geometry:MainGeometry?
    private var rootsRetired=false,cleanupAttempted=false,publishing=false
    private(set) var destinationWatchdogRemoved=false
    init(plan:Plan,engine:NativeGameplayEngine,source:Node,destination:Node,hooks:Hooks) {
        self.plan=plan;self.engine=engine;self.source=source;self.destination=destination;self.hooks=hooks
    }
    private func pending(in engine:NativeGameplayEngine)->Bool {
        switch plan {
        case .ordinary(let p):return engine.pendingOrdinarySix==p && !engine.ordinarySixGameplayCommitted
        case .direct(let p):return engine.pendingDirectWild==p && !engine.directWildGameplayCommitted
        }
    }
    private func current(in expected:Phase,includeNodes:Bool=true)->Bool {
        guard phase==expected,let engine,engine.state.generation==plan.generation else{return false}
        let context=hooks.contextCurrent()
        guard context,phase==expected,self.engine === engine,engine.state.generation==plan.generation else{return false}
        if !includeNodes{return true}
        let src=hooks.nodeCurrent(source,plan.source.id,plan.generation)
        guard src,phase==expected,engine.state.generation==plan.generation else{return false}
        if destinationWatchdogRemoved {return true}
        let dst=hooks.nodeCurrent(destination,plan.destination.id,plan.generation)
        return dst && phase==expected && engine.state.generation==plan.generation
    }
    func retains(_ node:Node,id:String,generation:UInt64)->Bool {
        let expected=phase
        guard generation==plan.generation,expected == .captured || expected == .installed || (expected == .entered && publishing),
              current(in:expected),phase==expected else{return false}
        return id==plan.source.id && node === source || !destinationWatchdogRemoved && id==plan.destination.id && node === destination
    }
    /// Only the real APP watchdog may establish destination-only retirement.
    /// Canonical removal succeeds before any physical disposal callback runs.
    func removeDestinationByWatchdog()->NativeMoveResult? {
        guard phase == .installed,current(in:.installed),let engine,pending(in:engine),
              case .ordinary(let ordinary)=plan,!ordinary.isFinal,!destinationWatchdogRemoved else{return nil}
        let result=engine.removeSourceOrdinarySixWatchdogDestination(receiptID:plan.id,generation:plan.generation)
        guard result.accepted else{return nil}
        destinationWatchdogRemoved=true
        return result
    }
    var destinationWatchdogKeepsSource:Bool {
        destinationWatchdogRemoved && phase == .installed && current(in:.installed)
    }
    var mainPaintCurrent:Bool {
        let expected=phase
        return (expected == .captured || expected == .installed) && current(in:expected)
    }
    func destinationFaceRetired() {
        if destinationWatchdogKeepsSource {return}
        capturedObjectRetired()
    }
    @discardableResult func mainInstalled(_ id:UUID)->Bool {
        guard phase == .captured,current(in:.captured),let engine,pending(in:engine),phase == .captured else{return false}
        nativeMainID=id;phase = .installed;return true
    }
    @discardableResult func mainCompleted(_ id:UUID)->Bool {
        guard phase == .installed,nativeMainID==id else{return false}
        guard current(in:.installed),let engine,pending(in:engine) else {
            if phase == .installed {capturedObjectRetired()}
            return false
        }
        if destinationWatchdogRemoved {
            phase = .interrupted
            return cancelCaptured() // genuine main callback; never normal arrival
        }
        let captured=hooks.captureGeometry(destination)
        guard phase == .installed,current(in:.installed),let captured else{
            if phase == .installed {_=mainInterrupted(id)}
            return false
        }
        geometry=captured;phase = .entered // before Core commit/external consume
        let result:NativeMoveResult
        switch plan {
        case .ordinary:result=engine.commitOrdinarySix(receiptID:plan.id,generation:plan.generation)
        case .direct:result=engine.commitDirectWildGameplay(transactionID:plan.id)
        }
        guard result.accepted,current(in:.entered,includeNodes:false) else{retireRootsOnce();return false}
        publishing=true
        hooks.publish(result,captured)
        publishing=false
        return current(in:.entered,includeNodes:false)
    }
    @discardableResult func mainInterrupted(_ id:UUID)->Bool {
        guard phase == .installed,nativeMainID==id else{return false}
        phase = .interrupted
        return cancelCaptured()
    }
    /// Setup failure before actual main installation still owns the accepted
    /// atomic pair. It cannot be left as a passive transaction after teardown.
    func capturedObjectRetired() {
        guard phase == .captured || phase == .installed else{return}
        phase = .interrupted;_=cancelCaptured()
    }
    private func cancelCaptured()->Bool {
        defer{retireRootsOnce()}
        guard !cleanupAttempted,let engine,engine.state.generation==plan.generation else{return false}
        cleanupAttempted=true
        let result=engine.cancelSourceMergeSixAbsorb(receiptID:plan.id,generation:plan.generation)
        guard result.accepted,phase == .interrupted,engine.state.generation==plan.generation else{return false}
        hooks.removeCapturedPair(source,destination)
        guard phase == .interrupted,engine.state.generation==plan.generation else{return true}
        hooks.releaseFramesAndIdle()
        guard phase == .interrupted,engine.state.generation==plan.generation else{return true}
        hooks.releaseSpecialAndQueue()
        guard phase == .interrupted,engine.state.generation==plan.generation else{return true}
        hooks.publish(result,nil)
        return true
    }
    private func retireRootsOnce(){guard !rootsRetired else{return};rootsRetired=true;hooks.retireNativeRoots()}
    func retireObsolete(){guard phase != .retired else{return};phase = .retired;retireRootsOnce()}
    @_optimize(none) deinit {} // localized Swift6.3.3 generic ARC optimizer workaround
}
