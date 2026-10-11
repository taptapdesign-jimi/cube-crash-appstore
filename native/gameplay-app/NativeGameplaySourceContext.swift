import UIKit
import StackToSixGameplay

/// App-lived original visual RNG, smoke hot history and shard pattern pools.
/// Scene scopes borrow the existing union service; they never own its Raw roots.
@MainActor final class NativeGameplaySourceContext {
    let service: NativeSourceAnimationClockService
    let mathRandom:NativeSourceMathRandomStream
    let smokeSession: NativeSharedSmokeRootSession
    let hudStarTextures=NativeSourceHUDStarTexturePreparation()
    let sixResources: NativeRegularSixSharedResources
    let registrySession: NativeGameplaySourceRegistrySession
    let canonicalSave=NativeSourceCanonicalSaveOwner<NativeBoardState>()
    let mutationLedger=NativeSourceAppMutationLedger()
    let endgameMutations:NativeSourceEndgameMutationLedger
    let mergeSixDestinationCleanup=NativeSourceMergeSixDestinationCleanupOwner()
    let meterQueueSignals=NativeMeterQueueSignals()
    private let boardTransitionState=NativeSourceBoardTransitionState()
    let contactMutations=NativeSourceContactMutationOwner()
    let specialIdleRegistry=NativeSourceSpecialIdleRegistry()
    let sourceMicrotaskTasks:NativeSourceMicrotaskAdapters?
    private var active: Scope?
    private var epoch: UInt64 = 0
    private var disposed = false
    private let sourceDateMilliseconds:()->Double
    private(set) var nonFinalMergeSixGuardUntil:Double=0
    private var nonFinalMutationEpoch:UInt64=0
    private(set) var tntBonusGuardUntil:Double=0,lastTntBonusChangeAt:Double=0
    private var tntBonusMutationEpoch:UInt64=0

    init(service: NativeSourceAnimationClockService? = nil,
         appOriginMilliseconds: Double = CACurrentMediaTime()*1000,
         visualRandom: @escaping () -> Double = {Double.random(in: 0..<1)},
         sourceDateMilliseconds: @escaping () -> Double = {floor(Date().timeIntervalSince1970*1000)},
         sourceMicrotaskTasks:NativeSourceMicrotaskAdapters?=nil) {
        self.sourceDateMilliseconds=sourceDateMilliseconds
        self.service = service ?? .shared;self.sourceMicrotaskTasks=sourceMicrotaskTasks
        registrySession = NativeGameplaySourceRegistrySession(sourceDateMilliseconds: sourceDateMilliseconds)
        endgameMutations = NativeSourceEndgameMutationLedger(sourceDateMilliseconds:sourceDateMilliseconds)
        let common=NativeSourceMathRandomStream(draw:visualRandom);mathRandom=common
        smokeSession = NativeSharedSmokeRootSession(appOriginMilliseconds: appOriginMilliseconds, visualRandom: {common.next()})
        sixResources = NativeRegularSixSharedResources(smoke: smokeSession)
    }

    func beginScene(engine:NativeGameplayEngine?=nil,retire: @escaping () -> Void) -> Scope? {
        guard !disposed else {return nil}
        epoch &+= 1
        let captured = epoch, previous = active
        active = nil
        previous?.dispose()
        // A retirement callback may have installed a newer Scene.
        guard !disposed, epoch == captured, active == nil else {return nil}
        let binding:NativeSourceAppMutationLedger.Binding?
        if let engine {
            guard let accepted=mutationLedger.bind(engine) else{return nil}
            binding=accepted
        } else {binding=nil}
        let scope = Scope(context: self, epoch: captured, mutationBinding:binding, retire: retire)
        active = scope
        scope.registries.bindParentCurrent { [weak scope] in scope?.current == true }
        return scope
    }

    private func isCurrent(_ scope: Scope) -> Bool { !disposed && active === scope && epoch == scope.epoch }
    private func release(_ scope: Scope) { if active === scope {active = nil} }
    func dispose() {
        guard !disposed else {return}; disposed = true; epoch &+= 1
        let previous = active; active = nil; previous?.dispose()
        meterQueueSignals.dispose();registrySession.dispose();canonicalSave.dispose();mutationLedger.dispose();endgameMutations.dispose();contactMutations.dispose();hudStarTextures.dispose();specialIdleRegistry.dispose();boardTransitionState.dispose()
    }
    isolated deinit {active?.dispose();meterQueueSignals.dispose();registrySession.dispose();canonicalSave.dispose();mutationLedger.dispose();endgameMutations.dispose();contactMutations.dispose();hudStarTextures.dispose();specialIdleRegistry.dispose();boardTransitionState.dispose()}

    @MainActor final class Scope {
        fileprivate let epoch: UInt64
        private weak var context: NativeGameplaySourceContext?
        let service: NativeSourceAnimationClockService
        let mathRandom:NativeSourceMathRandomStream
        let smokeSession: NativeSharedSmokeRootSession
        let hudStarTextures:NativeSourceHUDStarTexturePreparation
        let sixResources: NativeRegularSixSharedResources
        let registries: NativeGameplaySourceRegistrySession.Scope
        let sourceMicrotaskTasks:NativeSourceMicrotaskAdapters?
        let mergeSixDestinationCleanup:NativeSourceMergeSixDestinationCleanupOwner
        let meterQueueSignals:NativeMeterQueueSignals
        let contactMutations:NativeSourceContactMutationOwner
        let specialIdle:NativeSourceSpecialIdleScope
        private let canonicalSave:NativeSourceCanonicalSaveOwner<NativeBoardState>
        private var canonicalSaveBinding:NativeSourceCanonicalSaveOwner<NativeBoardState>.Binding?
        private var canonicalSaveEpoch:UInt64=0
        private var mutationBinding:NativeSourceAppMutationLedger.Binding?
        private let endgameMutations:NativeSourceEndgameMutationLedger
        private var endgameBinding:NativeSourceEndgameMutationLedger.Binding?
        private var endgameBindingEpoch:UInt64=0
        private var boardTransitionClaim:NativeSourceBoardTransitionState.Claim?
        let timeline: NativeSourceOuterTimelineAdapter
        let tween: NativeSourceDragTweenAdapter
        let smoke: NativeSharedSmokeRootRenderer
        /// Original accepted non-final prefix writes the tile flag before Date.
        /// These are genuine writes, separate from Core's conservative metadata.
        func markNonFinalMergeSix(_ node:NativeDiceNode,generation:UInt64)->Bool {
            guard current,let context,node.sourceContactNodeAlive,
                  node.sourceGeneration==generation else{return false}
            node.sourceNonFinalMergeSix=true
            context.nonFinalMutationEpoch &+= 1;let epoch=context.nonFinalMutationEpoch
            let date=context.sourceDateMilliseconds()
            guard current,context.nonFinalMutationEpoch==epoch,node.sourceContactNodeAlive,node.sourceGeneration==generation,date.isFinite else{return false}
            node.sourceNonFinalMergeSixAt=date
            return true
        }
        func extendNonFinalMergeSixGuard()->Bool {
            guard current,let context else{return false}
            context.nonFinalMutationEpoch &+= 1;let epoch=context.nonFinalMutationEpoch
            let date=context.sourceDateMilliseconds()
            guard current,!context.disposed,context.nonFinalMutationEpoch==epoch,date.isFinite else{return false}
            context.nonFinalMergeSixGuardUntil=max(context.nonFinalMergeSixGuardUntil,date+2500)
            return true
        }
        func captureNonFinalMergeSixGuardActive()->Bool? {
            guard current,let context else{return nil}
            let epoch=context.nonFinalMutationEpoch
            let date=context.sourceDateMilliseconds()
            guard current,!context.disposed,context.nonFinalMutationEpoch==epoch,date.isFinite else{return nil}
            return context.nonFinalMergeSixGuardUntil>date
        }
        /// Distinct original app-lived TNT Date writers. Reads do not extend
        /// a lease, and an old Scope cannot overwrite a reentrant successor.
        func extendTntBonusGuard(milliseconds:Double)->Bool {
            guard current,let context,milliseconds.isFinite,milliseconds>=0 else{return false}
            context.tntBonusMutationEpoch &+= 1;let epoch=context.tntBonusMutationEpoch
            let date=context.sourceDateMilliseconds()
            guard current,!context.disposed,context.tntBonusMutationEpoch==epoch,date.isFinite else{return false}
            context.tntBonusGuardUntil=max(context.tntBonusGuardUntil,date+milliseconds);return true
        }
        func recordTntBonusReplacement()->Bool {
            guard current,let context else{return false}
            context.tntBonusMutationEpoch &+= 1;let epoch=context.tntBonusMutationEpoch
            let date=context.sourceDateMilliseconds()
            guard current,!context.disposed,context.tntBonusMutationEpoch==epoch,date.isFinite else{return false}
            context.lastTntBonusChangeAt=date
            return extendTntBonusGuard(milliseconds:1200)
        }
        func captureTntBonusDates()->(lastChangeAt:Double,guardUntil:Double)? {
            guard current,let context,!context.disposed else{return nil}
            return(context.lastTntBonusChangeAt,context.tntBonusGuardUntil)
        }
        private var retire: (() -> Void)?
        private(set) var disposed = false
        var current: Bool { !disposed && context?.isCurrent(self) == true }
        fileprivate init(context: NativeGameplaySourceContext, epoch: UInt64, mutationBinding:NativeSourceAppMutationLedger.Binding?,retire: @escaping () -> Void) {
            self.context = context; self.epoch = epoch; self.retire = retire
            self.mutationBinding=mutationBinding;sourceMicrotaskTasks=context.sourceMicrotaskTasks
            endgameMutations=context.endgameMutations
            registries = context.registrySession.beginScope(epoch: epoch)
            mergeSixDestinationCleanup=context.mergeSixDestinationCleanup
            meterQueueSignals=context.meterQueueSignals
            contactMutations=context.contactMutations;canonicalSave=context.canonicalSave
            specialIdle=NativeSourceSpecialIdleScope(registry:context.specialIdleRegistry,sourceMathRandom:context.mathRandom,current:{[weak context] in
                guard let context,!context.disposed,context.epoch==epoch else{return false}
                return context.active?.epoch==epoch && !context.disposed
            })
            service = context.service; mathRandom=context.mathRandom; smokeSession = context.smokeSession; sixResources = context.sixResources;hudStarTextures=context.hudStarTextures
            timeline = NativeSourceOuterTimelineAdapter(service: service)
            tween = NativeSourceDragTweenAdapter(service: service)
            smoke = smokeSession.makeRenderer(service: service)
        }
        func captureSourceBoardTransitionActive()->Bool? {
            guard current,let context else{return nil}
            let value=context.boardTransitionState.snapshot
            return current ? value:nil
        }
        func beginSourceBoardTransition()->NativeSourceBoardTransitionState.Claim? {
            guard current,boardTransitionClaim==nil,let context else{return nil}
            let claim=context.boardTransitionState.begin(current:{self.current})
            guard current,boardTransitionClaim==nil else{claim?.release();return nil}
            boardTransitionClaim=claim;return claim
        }
        @discardableResult func completeSourceBoardTransition(_ claim:NativeSourceBoardTransitionState.Claim)->Bool {
            guard boardTransitionClaim === claim else{return false}
            boardTransitionClaim=nil;return claim.release()
        }
        func captureSourceDateMilliseconds()->Double? {
            guard current,let context else{return nil}
            let value=context.sourceDateMilliseconds()
            return current && value.isFinite ? value:nil
        }
        @discardableResult func bindEndgameMutations(current externalCurrent:@escaping()->Bool)->NativeSourceEndgameMutationLedger.Binding? {
            guard current,endgameBinding==nil else{return nil};endgameBindingEpoch &+= 1;let epoch=endgameBindingEpoch
            let binding=endgameMutations.bind(current:{[weak self] in
                guard let self,self.current,self.endgameBindingEpoch==epoch else{return false}
                let accepted=externalCurrent()
                return accepted && self.current && self.endgameBindingEpoch==epoch
            })
            guard current,endgameBindingEpoch==epoch,endgameBinding==nil else{binding?.retire();return nil}
            endgameBinding=binding;return binding
        }
        func retireEndgameMutations(_ binding:NativeSourceEndgameMutationLedger.Binding) {
            guard endgameBinding === binding else{binding.retire();return}
            endgameBinding=nil;endgameBindingEpoch &+= 1;binding.retire()
        }
        @discardableResult func installCanonicalSave(hooks:NativeSourceCanonicalSaveOwner<NativeBoardState>.Hooks)->NativeSourceCanonicalSaveOwner<NativeBoardState>.Binding? {
            guard current else{return nil};canonicalSaveEpoch &+= 1;let e=canonicalSaveEpoch
            let previous=canonicalSaveBinding;canonicalSaveBinding=nil;previous?.retire()
            guard current,canonicalSaveEpoch==e,canonicalSaveBinding==nil else{return nil}
            var sealed=NativeSourceCanonicalSaveOwner<NativeBoardState>.Hooks(current:{[weak self] in
                guard let self,self.current,self.canonicalSaveEpoch==e else{return false}
                let admitted=hooks.current()
                return admitted && self.current && self.canonicalSaveEpoch==e
            },capture:hooks.capture,stillMatches:hooks.stillMatches,write:hooks.write,wall:hooks.wall)
            sealed.writeWithRequest=hooks.writeWithRequest
            guard let binding=canonicalSave.install(hooks:sealed) else{return nil}
            let admitted=current
            guard admitted,current,canonicalSaveEpoch==e,canonicalSaveBinding==nil else{binding.retire();return nil}
            canonicalSaveBinding=binding;return binding
        }
        func retireCanonicalSave(_ binding:NativeSourceCanonicalSaveOwner<NativeBoardState>.Binding) {
            guard canonicalSaveBinding === binding else{binding.retire();return}
            canonicalSaveBinding=nil;canonicalSaveEpoch &+= 1;binding.retire()
        }
        @discardableResult func update(foreground: Bool, globalPaused: Bool, terminalSuspended: Bool) -> Bool {
            guard current else {return false}
            service.setSourceForeground(foreground)
            return service.setSourceGlobalPaused(globalPaused, terminalSuspended: terminalSuspended)
        }
        func dispose() {
            guard !disposed else {return}; disposed = true
            let transition=boardTransitionClaim;boardTransitionClaim=nil;transition?.release()
            let mutation=mutationBinding;mutationBinding=nil
            mutation?.captureBeforeRetirement() // before ANY external cleanup
            endgameBindingEpoch &+= 1;let endgame=endgameBinding;endgameBinding=nil;endgame?.retire()
            canonicalSaveEpoch &+= 1;let save=canonicalSaveBinding;canonicalSaveBinding=nil;save?.retire()
            context?.release(self)
            specialIdle.dispose()
            registries.dispose() // seal new claims before external caller retirement
            let callback = retire; retire = nil
            // Caller first removes captured Scene bindings, then their roots.
            callback?(); timeline.dispose(); tween.dispose(); smoke.dispose()
        }
        isolated deinit {dispose()}
    }
}
