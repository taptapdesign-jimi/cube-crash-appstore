import Foundation

/// Literal current Source save admission, with explicit Native capability proof.
/// Source does not gate saves on decorative HUD/smoke/idle or endgameGuard alone.
nonisolated struct NativeSourceCanonicalSaveGuard:Equatable {
    let runMode:String
    let skipRebuildBoard:Bool
    let journeyCompletedSaveVeto:Bool
    let gameHasEnded:Bool
    let gridReady:Bool
    let gameplayTransientBusy:Bool
    let freshArcadeEntryAuthorized:Bool
    func admits(freshArcadeEntry:Bool)->Bool {
        if skipRebuildBoard{return false}
        let arcade=runMode=="arcade_home"
        if !arcade && journeyCompletedSaveVeto{return false}
        let fresh=freshArcadeEntry && freshArcadeEntryAuthorized && arcade
        if !fresh && (gameHasEnded || gameplayTransientBusy){return false}
        return gridReady
    }
}

/// App-lived one canonical pending save, borrowed finite Source wall transport.
/// A receipt is published only with an actual current complete owner snapshot.
/// No state-change observer starts arbitrary timers or caches a transient state.
@MainActor final class NativeSourceCanonicalSaveOwner<State:Equatable> {
    nonisolated enum Producer:String {case wildQueueFinally,ordinarySubSixContact,levelCheckContinue,noMovesPersistStuck,lifecycle,preparedArcadeEntry}
    nonisolated enum Result:Equatable {case scheduled(Int),written,vetoed,missingOwners,obsolete,writeFailed}
    struct Observation {
        let state:State,guardFields:NativeSourceCanonicalSaveGuard,missingOwners:[String],nativeCoherent:Bool
        let physicalStillMatches:(()->Bool)?
        init(state:State,guardFields:NativeSourceCanonicalSaveGuard,missingOwners:[String],nativeCoherent:Bool,
             physicalStillMatches:(()->Bool)?=nil) {
            self.state=state;self.guardFields=guardFields;self.missingOwners=missingOwners;self.nativeCoherent=nativeCoherent
            self.physicalStillMatches=physicalStillMatches
        }
    }
    typealias Cancel=()->Void
    nonisolated enum CaptureRequest {case admission,save(freshArcadeEntry:Bool)}
    struct Hooks {
        let current:()->Bool
        let capture:(CaptureRequest)->Observation?
        let stillMatches:(State)->Bool
        let write:(State)->Bool
        let wall:(_ milliseconds:Int,_ elapsed:@escaping()->Void)->Cancel?
        /// Prepared entry is an operation receipt, never mutable capture state.
        /// Existing owners keep their ordinary writer; production can commit
        /// fresh Arcade continuation atomically from this exact save request.
        var writeWithRequest:((State,CaptureRequest)->Bool)?=nil
    }
    @MainActor final class Binding {
        fileprivate weak var owner:NativeSourceCanonicalSaveOwner?
        fileprivate let id=UUID(),hooks:Hooks
        fileprivate var retired=false
        fileprivate init(owner:NativeSourceCanonicalSaveOwner,hooks:Hooks){self.owner=owner;self.hooks=hooks}
        var current:Bool{owner?.current(self)==true}
        @discardableResult func notify(_ producer:Producer)->Result {
            guard let owner else{return .obsolete};return owner.notify(producer,binding:self)
        }
        @discardableResult func wildQueueFinallySave(milliseconds:Int)->Result {
            guard milliseconds==400 else{return .missingOwners}
            return notify(.wildQueueFinally)
        }
        func retire(){owner?.retire(self)}
        @_optimize(none) deinit {}
    }
    private struct Pending {let id:UUID,binding:Binding,producer:Producer;var cancel:Cancel?}
    private var active:Binding?,pending:Pending?,disposed=false,epoch:UInt64=0
    var hasPendingSave:Bool{pending != nil}
    private func owned(_ binding:Binding)->Bool{!disposed && !binding.retired && active === binding}
    private func current(_ binding:Binding)->Bool {
        guard owned(binding) else{return false}
        let accepted=binding.hooks.current()
        return accepted && owned(binding)
    }
    func install(hooks:Hooks)->Binding? {
        guard !disposed else{return nil};epoch &+= 1;let e=epoch
        let previous=active;active=nil;if let previous{retire(previous)}
        guard !disposed,epoch==e,active==nil else{return nil}
        let accepted=hooks.current();guard accepted,!disposed,epoch==e,active==nil else{return nil}
        let observation=hooks.capture(.admission)
        guard !disposed,epoch==e,active==nil,let observation,observation.missingOwners.isEmpty else{return nil}
        let matched=hooks.stillMatches(observation.state)
        guard matched,!disposed,epoch==e,active==nil else{return nil}
        if let physical=observation.physicalStillMatches {
            guard physical(),!disposed,epoch==e,active==nil else{return nil}
        }
        let again=hooks.current();guard again,!disposed,epoch==e,active==nil else{return nil}
        let binding=Binding(owner:self,hooks:hooks);active=binding;return binding
    }
    private func notify(_ producer:Producer,binding:Binding)->Result {
        guard current(binding) else{return .obsolete}
        switch producer {
        case .wildQueueFinally:return schedule(400,producer:producer,binding:binding)
        case .ordinarySubSixContact:return schedule(1200,producer:producer,binding:binding)
        default:return save(producer,binding:binding)
        }
    }
    private func schedule(_ ms:Int,producer:Producer,binding:Binding)->Result {
        guard current(binding) else{return .obsolete}
        let old=pending;pending=nil;old?.cancel?()
        guard current(binding) else{return .obsolete}
        let id=UUID();pending=Pending(id:id,binding:binding,producer:producer,cancel:nil)
        let cancel=binding.hooks.wall(ms){[weak self,weak binding] in
            guard let self,let binding,self.pending?.id==id else{return}
            // Literal callback clears saveGameTimer BEFORE saveGameState.
            self.pending=nil;_ = self.save(producer,binding:binding)
        }
        guard current(binding),pending?.id==id else{cancel?();return .obsolete}
        guard let cancel else{pending=nil;return .missingOwners}
        pending?.cancel=cancel;return .scheduled(ms) // accepted schedule; no eager write.
    }
    private func save(_ producer:Producer,binding:Binding)->Result {
        guard current(binding) else{return .obsolete}
        let observation=binding.hooks.capture(.save(freshArcadeEntry:producer == .preparedArcadeEntry))
        guard current(binding) else{return .obsolete}
        guard let observation,observation.missingOwners.isEmpty else{return .missingOwners}
        let matched=binding.hooks.stillMatches(observation.state)
        guard matched,current(binding) else{return .obsolete}
        guard observation.guardFields.admits(freshArcadeEntry:producer == .preparedArcadeEntry),observation.nativeCoherent else{return .vetoed}
        if let physical=observation.physicalStillMatches {
            guard physical(),current(binding),binding.hooks.stillMatches(observation.state) else{return .obsolete}
        }
        let wrote:Bool
        if let write=binding.hooks.writeWithRequest {
            wrote=write(observation.state,.save(freshArcadeEntry:producer == .preparedArcadeEntry))
        } else {wrote=binding.hooks.write(observation.state)}
        // A real accepted synchronous atomic write may retire this binding;
        // do not undo it, publish another state or clear a newer C timer.
        return wrote ? .written:.writeFailed
    }
    private func retire(_ binding:Binding){
        guard !binding.retired else{return};binding.retired=true
        if active === binding{active=nil}
        let work=pending?.binding === binding ? pending:nil
        if work != nil{pending=nil};work?.cancel?()
    }
    func dispose(){guard !disposed else{return};disposed=true;epoch &+= 1
        let binding=active;active=nil;if let binding{retire(binding)}
        let work=pending;pending=nil;work?.cancel?()
    }
    // Swift6.3.3 EarlyPerfInliner crashes on the synthesized generic ARC
    // destroyer. Keep gameplay/save methods optimized; only this empty
    // explicit destructor uses the established local compiler workaround.
    @_optimize(none) deinit {}
}
