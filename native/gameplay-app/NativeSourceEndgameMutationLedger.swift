import Foundation
import StackToSixGameplay

/// App-lived lastEndgameBoardMutationAt is DISTINCT from lastBoardMutationAt.
/// Date reads happen only at genuine writers, never snapshot/age/coverage reads.
/// There is no timer, revision proxy, wall-clock lease or persisted save field.
@MainActor final class NativeSourceEndgameMutationLedger {
    nonisolated struct Snapshot:Equatable {let lastMutationAt:Double,lastSignature:String;let sequence:UInt64}
    private let sourceDateMilliseconds:()->Double
    private var lastMutationAt:Double=0,lastSignature="",sequence:UInt64=0
    private var epoch:UInt64=0,disposed=false
    let mergeSixSpawns=NativeSourceMergeSixSpawnOwner()
    private var acceptedSpawnRequests:[UUID:UUID]=[:]
    private var writerCoverage:[UUID:(writers:Set<Writer>,current:()->Bool)]=[:]
    enum Writer:Hashable {case handoff,ordinarySpawn,wildSpawn,tntSpawn,levelCheck}
    private var active:[UUID:UUID]=[:] // captured handoff id -> exact binding id
    init(sourceDateMilliseconds:@escaping()->Double){self.sourceDateMilliseconds=sourceDateMilliseconds}
    var snapshot:Snapshot {.init(lastMutationAt:lastMutationAt,lastSignature:lastSignature,sequence:sequence)}
    func sinceMutation(at actualDateMilliseconds:Double)->Double {lastMutationAt != 0 ? actualDateMilliseconds-lastMutationAt:Double.infinity}
    func bind(current:@escaping()->Bool)->Binding? {
        guard !disposed else{return nil};let e=epoch,accepted=current()
        guard accepted,!disposed,epoch==e else{return nil}
        return Binding(owner:self,current:current)
    }
    private func record(_ receipt:NativeSourceRegularHandoffMutationReceipt,phase:NativeSourceRegularHandoffMutationReceipt.Phase,binding:Binding)->Bool {
        guard binding.admitted, !disposed else{return false}
        if phase == .began {guard active[receipt.id]==nil else{return false};active[receipt.id]=binding.id}
        else {guard active[receipt.id]==binding.id else{return false};active.removeValue(forKey:receipt.id)}
        // Ownership is accepted/removed before Date injection. A reentrant C may
        // mutate/dispose; old A must not overwrite C's later genuine timestamp.
        epoch &+= 1;let captured=epoch,date=sourceDateMilliseconds()
        guard !disposed,epoch==captured,binding.admitted,!disposed,epoch==captured,
              phase == .released || active[receipt.id]==binding.id else{return false}
        lastMutationAt=date;sequence &+= 1;return true
    }
    private func beginSpawn(_ receipt:NativeSourceOrdinarySixSpawnBeginReceipt,binding:Binding,
                            service:NativeSourceAnimationClockService,resets:NativeSourceMergeSixSpawnOwner.ResetBindings,
                            coreCurrent:@escaping()->Bool)->NativeSourceMergeSixSpawnOwner.Claim? {
        beginSpawn(requestID:receipt.id,ownerID:receipt.ownerID,generation:receipt.generation,binding:binding,
                   service:service,resets:resets,coreCurrent:coreCurrent)
    }
    private func beginSpawn(requestID:UUID,ownerID:String,generation:UInt64,binding:Binding,
                            service:NativeSourceAnimationClockService,resets:NativeSourceMergeSixSpawnOwner.ResetBindings,
                            coreCurrent:@escaping()->Bool)->NativeSourceMergeSixSpawnOwner.Claim? {
        guard !disposed,binding.admitted,!disposed,acceptedSpawnRequests[requestID]==nil,!mergeSixSpawns.inProgress else{return nil}
        let captured=epoch,accepted=coreCurrent()
        guard accepted,!disposed,epoch==captured,binding.admitted,!disposed,epoch==captured,
            acceptedSpawnRequests[requestID]==nil,!mergeSixSpawns.inProgress else{return nil}
        // Remove-before-external/once publication: the same dispatched request
        // cannot allocate another token after reset or reentrant callbacks.
        acceptedSpawnRequests[requestID]=binding.id
        return mergeSixSpawns.begin(ownerID:ownerID,generation:generation,bindingID:binding.id,
            service:service,bindings:resets,current:{[weak self,weak binding] in
                guard let self,let binding,!self.disposed,binding.admitted else{return false}
                let accepted=coreCurrent()
                return accepted && !self.disposed && binding.admitted
            },recordDate:{[weak self,weak binding] claim in
                guard let self,let binding,!self.disposed,self.mergeSixSpawns.owns(claim),binding.admitted,
                    !self.disposed,self.mergeSixSpawns.owns(claim) else{return false}
                self.epoch &+= 1;let captured=self.epoch,date=self.sourceDateMilliseconds()
                guard !self.disposed,self.epoch==captured,self.mergeSixSpawns.owns(claim),binding.admitted,
                    !self.disposed,self.epoch==captured,self.mergeSixSpawns.owns(claim) else{return false}
                let accepted=coreCurrent()
                guard accepted,!self.disposed,self.epoch==captured,self.mergeSixSpawns.owns(claim),binding.admitted,
                    !self.disposed,self.epoch==captured,self.mergeSixSpawns.owns(claim) else{return false}
                self.lastMutationAt=date;self.sequence &+= 1;return true
            })
    }
    private func retire(_ binding:Binding) {
        writerCoverage.removeValue(forKey:binding.id);active=active.filter{$0.value != binding.id};acceptedSpawnRequests=acceptedSpawnRequests.filter{$0.value != binding.id};epoch &+= 1
        mergeSixSpawns.retire(bindingID:binding.id)
    }
    func dispose(){guard !disposed else{return};disposed=true;epoch &+= 1;active=[:];acceptedSpawnRequests=[:];writerCoverage=[:];mergeSixSpawns.dispose()}
    /// Actual Direct Wild acquisition/finally and selected ordinary token
    /// admission share this ledger. Ordinary/default/Special caller coverage
    /// and physical signature are incomplete; whole levelEnd still refuses.
    var allFourWritersConnected:Bool {writerCoverage.values.contains{$0.writers == [.handoff,.ordinarySpawn,.wildSpawn,.tntSpawn,.levelCheck] && $0.current() && !disposed}}
    private func observeSignature(_ signature:String,binding:Binding,current:()->Bool)->Bool? {
        guard !disposed,binding.admitted,current(),!disposed,binding.admitted else{return nil}
        if signature == lastSignature {return false}
        epoch &+= 1;let captured=epoch,date=sourceDateMilliseconds()
        guard date.isFinite,!disposed,epoch==captured,binding.admitted,current(),
            !disposed,epoch==captured,binding.admitted else{return nil}
        lastSignature=signature;lastMutationAt=date;sequence &+= 1;return true
    }
    @MainActor final class Binding {
        fileprivate let id=UUID()
        private weak var owner:NativeSourceEndgameMutationLedger?
        private let current:()->Bool
        private(set) var retired=false
        fileprivate init(owner:NativeSourceEndgameMutationLedger,current:@escaping()->Bool){self.owner=owner;self.current=current}
        fileprivate var admitted:Bool {
            guard !retired,owner != nil else{return false};let accepted=current()
            return accepted && !retired && owner != nil
        }
        var snapshot:Snapshot? {guard admitted,let owner else{return nil};return owner.snapshot}
        /// Installation publication is separate from runtime observation. The
        /// caller must verify all captured endpoints before publishing a set.
        @discardableResult func publishInstalledWriters(_ writers:Set<Writer>,current:@escaping()->Bool)->Bool {
            guard admitted,let owner,current(),admitted,!owner.disposed else{return false}
            owner.writerCoverage[id]=(writers,current);return true
        }
        @discardableResult func connectLevelCheckWriter(current:@escaping()->Bool)->Bool {
            guard admitted,let owner,let installed=owner.writerCoverage[id],
                installed.writers.isSuperset(of:[.handoff,.ordinarySpawn,.wildSpawn,.tntSpawn]),installed.current(),current(),admitted else{return false}
            owner.writerCoverage[id]=(installed.writers.union([.levelCheck]),{installed.current() && current()})
            return true
        }
        /// Only the actual checkLevelEnd coroutine after awaited repair/current gates.
        /// nil means refused; false is a genuine unchanged physical signature.
        func observeLevelCheckSignature(_ signature:String,current:()->Bool)->Bool? {
            guard admitted,let owner else{return nil}
            return owner.observeSignature(signature,binding:self,current:current)
        }
        /// A genuine active shared token proves true. Missing caller coverage
        /// can never turn an idle token owner into a whole-app false receipt.
        func captureSpawnInProgress()->Bool? {
            guard admitted,let owner else{return nil}
            let value:Bool?=owner.mergeSixSpawns.inProgress ? true:owner.writerCoverage[id].map{$0.writers.isSuperset(of:[.ordinarySpawn,.wildSpawn,.tntSpawn]) && $0.current()} == true ? false:nil
            return admitted ? value:nil
        }
        @discardableResult func handoff(_ receipt:NativeSourceRegularHandoffMutationReceipt,phase:NativeSourceRegularHandoffMutationReceipt.Phase)->Bool {
            guard admitted,let owner else{return false};return owner.record(receipt,phase:phase,binding:self)
        }
        func beginSpawn(_ receipt:NativeSourceOrdinarySixSpawnBeginReceipt,service:NativeSourceAnimationClockService,
                        resets:NativeSourceMergeSixSpawnOwner.ResetBindings,current:@escaping()->Bool)->NativeSourceMergeSixSpawnOwner.Claim? {
            guard admitted,let owner else{return nil}
            return owner.beginSpawn(receipt,binding:self,service:service,resets:resets,coreCurrent:current)
        }
        func beginWildSpawn(_ receipt:NativeSourceWildSpawnBeginReceipt,service:NativeSourceAnimationClockService,
                            resets:NativeSourceMergeSixSpawnOwner.ResetBindings,current:@escaping()->Bool)->NativeSourceMergeSixSpawnOwner.Claim? {
            guard admitted,let owner else{return nil}
            return owner.beginSpawn(requestID:receipt.id,ownerID:receipt.ownerID,generation:receipt.generation,
                                    binding:self,service:service,resets:resets,coreCurrent:current)
        }
        func beginTntSpawn(_ receipt:NativeSourceTntSpawnBeginReceipt,service:NativeSourceAnimationClockService,
                           resets:NativeSourceMergeSixSpawnOwner.ResetBindings,current:@escaping()->Bool)->NativeSourceMergeSixSpawnOwner.Claim? {
            guard admitted,let owner else{return nil}
            return owner.beginSpawn(requestID:receipt.id,ownerID:receipt.ownerID,generation:receipt.generation,
                                    binding:self,service:service,resets:resets,coreCurrent:current)
        }
        @discardableResult func resetSpawn(_ claim:NativeSourceMergeSixSpawnOwner.Claim,releaseSpecial:Bool=true)->Bool {
            guard admitted,let owner,claim.bindingID==id else{return false}
            return owner.mergeSixSpawns.reset(claim,releaseSpecial:releaseSpecial)
        }
        func retire(){guard !retired else{return};retired=true;let captured=owner;owner=nil;captured?.retire(self)}
    }
}
