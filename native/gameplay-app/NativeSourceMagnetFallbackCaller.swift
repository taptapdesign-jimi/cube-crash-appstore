import Foundation
import StackToSixGameplay

/// Literal sequential await openAtCell continuation. Core allocates every cell,
/// value and holder. Actual Scene callbacks construct/bind the captured object;
/// the existing Source animation service supplies the real 560ms timeline.
@MainActor final class NativeSourceMagnetFallbackCaller {
    enum Completion: Equatable { case completed, cancelled, unavailable }
    struct Hooks {
        let current: () -> Bool
        let resourcesReady: () -> Bool
        let random: () -> Double
        let enqueue: (@escaping () -> Void) -> Bool
        let removeHolder: (String) -> Void
        let construct: (NativeSourceMagnetFallbackOpen, Double?) -> NativeDiceNode?
        let owns: (NativeDiceNode, NativeSourceMagnetFallbackOpen) -> Bool
        let publish: (NativeMoveResult, NativeBoardState) -> Void
        let acquireFrames: (String, UInt64) -> (() -> Void)?
        var frameCurrent:((NativeDiceNode,NativeSourceMagnetFallbackOpen)->Bool)?=nil
    }
    private let engine: NativeGameplayEngine
    private let service: NativeSourceAnimationClockService
    private let hooks: Hooks
    private var plan: NativeSourceMagnetFallbackPlan?
    private var bounce: NativeSourceAppSpawnBounceOwner?
    private var node: NativeDiceNode?
    private var open: NativeSourceMagnetFallbackOpen?
    private var complete: ((Completion) -> Void)?
    private var closed = false, index = 0
    init(engine: NativeGameplayEngine, service: NativeSourceAnimationClockService, hooks: Hooks) {
        self.engine = engine; self.service = service; self.hooks = hooks
    }
    var active: Bool { !closed && plan != nil }
    func owns(_ candidate: NativeDiceNode) -> Bool { active && node === candidate }
    func ownsSpawnEvent(_ event: NativeGameplayEvent) -> Bool {
        active && event.kind == .spawned && event.reason == open?.id
    }
    private func current() -> Bool {
        guard !closed else { return false }
        let accepted = hooks.current()
        return accepted && !closed && (plan == nil || engine.state.generation == plan?.generation)
    }
    @discardableResult func start(transactionID: String, generation: UInt64, count: Int,
        finished: @escaping (Completion) -> Void) -> Bool {
        guard !closed, plan == nil, current(), service.sourceFrameTransportAdmissionOpen else { return false }
        let ready = hooks.resourcesReady()
        guard current(), ready, let receipt = engine.sourceMagnetPostCommit,
              receipt.transactionID == transactionID, receipt.generation == generation,
              count == max(1,min(receipt.spawnCount,2)) else { return false }
        guard let captured = engine.prepareSourceMagnetFallback(transactionID: transactionID,
            generation: generation, sourceCurrent: current, sourceRandom: hooks.random), current() else { return false }
        plan = captured; complete = finished
        openNext()
        return true
    }
    private func openNext() {
        guard active, current(), let plan else { finish(.cancelled); return }
        guard index < plan.cells.count else {
            guard engine.finishSourceMagnetFallback(planID: plan.id,generation: plan.generation) else { finish(.unavailable); return }
            finish(.completed); return
        }
        guard let captured = engine.beginSourceMagnetFallbackOpen(planID: plan.id,
            generation: plan.generation,index: index,sourceCurrent: current,sourceRandom: hooks.random), current() else {
            finish(.cancelled); return
        }
        open = captured
        if captured.skipped {
            guard engine.finishSourceMagnetFallbackOpen(openID: captured.id,generation: plan.generation,interrupted: false) else { finish(.unavailable); return }
            open = nil; index += 1; resumeOpen(); return
        }
        if let removed = captured.removedHolderID {
            hooks.removeHolder(removed)
            guard current(), open == captured else { finish(.cancelled); return }
        }
        var rotation: Double?
        if captured.createdHolder {
            let roll = hooks.random()
            guard current(), open == captured, roll.isFinite, roll >= 0, roll < 1 else { finish(.cancelled); return }
            rotation = roll*0.12-0.06
        }
        guard let holder = hooks.construct(captured,rotation), current(), hooks.owns(holder,captured), current() else {
            finish(.unavailable); return
        }
        node = holder
        let frameCurrent:(()->Bool)? = hooks.frameCurrent.map{callback in
            {[weak holder] in guard let holder else{return false};return callback(holder,captured)}
        }
        let admitted = holder.openSourceAppSpawnHolder(captured.value,service: service,random: hooks.random,
            current: { [weak self,weak holder] in
                guard let self,let holder,self.current(),self.open == captured,self.node === holder else { return false }
                let accepted = self.hooks.owns(holder,captured)
                return accepted && self.current() && self.open == captured && self.node === holder
            }, frameCurrent:frameCurrent,beforeSetValue: { [weak self] in
                guard let self,self.current(),self.open == captured else { return false }
                let previous = self.engine.state
                let result = self.engine.commitSourceMagnetFallbackValue(openID: captured.id,generation: captured.generation)
                guard result.accepted else { return false }
                self.hooks.publish(result,previous)
                return self.current() && self.open == captured
            }, onCancelled: { [weak self] in self?.finish(.cancelled) })
        guard admitted, current(), open == captured, node === holder else { finish(.unavailable); return }
        let owner = NativeSourceAppSpawnBounceOwner(service: service,hooks: .init(
            current: { [weak self,weak holder] in
                guard let self,let holder,self.current(),self.open == captured,self.node === holder else { return false }
                let accepted = self.hooks.owns(holder,captured)
                return accepted && self.current() && self.open == captured && self.node === holder
            }, readRotation: { [weak holder] in holder.map { Double($0.dragInnerTilt) } },
            paintScale: { [weak holder] scale in holder?.paintSourceOuterScale(.init(x:scale,y:scale)) },
            paintRotation: { [weak holder] angle in holder?.dragInnerTilt = CGFloat(angle) },
            ensureFullOpacity: { [weak holder] in holder?.ensureSourceAppSpawnFullOpacity() },
            random: hooks.random,
            acquireFrames: { [hooks] in hooks.acquireFrames(captured.id,captured.generation) },
            finished: { [weak self] outcome in self?.bounceFinished(outcome,open:captured) }),initialScale:NativeSourceAppSpawnBounceOwner.nativeEntryScale)
        bounce = owner
        guard holder.bindSourceAppSpawnInterruption(id: captured.id, pickup: { [weak owner] in owner?.removeChildrenForPickup() }, interrupted: { [weak owner] in owner?.interrupt() }) else { finish(.unavailable); return }
        guard current(),open == captured,owner.start(),current(),open == captured else { finish(.unavailable); return }
    }
    private func bounceFinished(_ outcome: NativeSourceAppSpawnBounceOwner.Completion,open captured: NativeSourceMagnetFallbackOpen) {
        guard !closed,open == captured,let plan else { return }
        bounce = nil
        node?.unbindSourceAppSpawnInterruption(id: captured.id)
        node = nil; open = nil
        let success = outcome == .completed
        guard engine.finishSourceMagnetFallbackOpen(openID: captured.id,generation: plan.generation,interrupted: !success) else {
            finish(.cancelled); return
        }
        if !success { finish(outcome == .unavailable ? .unavailable : .cancelled); return }
        index += 1; resumeOpen()
    }
    private func resumeOpen() {
        guard active,current() else { finish(.cancelled); return }
        let accepted = hooks.enqueue { [weak self] in self?.openNext() }
        if !accepted, active { finish(.unavailable) }
    }
    private func finish(_ outcome: Completion) {
        guard !closed else { return }; closed = true
        let capturedBounce = bounce; bounce = nil
        let capturedOpen = open; open = nil
        let capturedNode = node; node = nil
        let callback = complete; complete = nil
        if let capturedOpen {
            capturedNode?.unbindSourceAppSpawnInterruption(id: capturedOpen.id)
            _ = engine.finishSourceMagnetFallbackOpen(openID: capturedOpen.id,generation: capturedOpen.generation,interrupted: true)
        }
        if outcome != .completed,let plan {
            _ = engine.retireSourceMagnetPostCommit(transactionID:plan.transactionID,generation:plan.generation)
        }
        capturedBounce?.interrupt()
        callback?(outcome)
    }
    func retire() { finish(.cancelled) }
    isolated deinit { retire() }
}
