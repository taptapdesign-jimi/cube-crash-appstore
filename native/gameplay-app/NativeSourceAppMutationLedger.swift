import Foundation
import StackToSixGameplay

/// App-lived transport of only actual Core Source writer state. This owner never
/// writes Date/revision/signature itself and installs no clock or timer.
@MainActor final class NativeSourceAppMutationLedger {
    private var captured:NativeSourceMeterMutationLedger?
    private weak var knownEngine:NativeGameplayEngine?
    private var active:Binding?
    private var disposed=false
    var snapshot:NativeSourceMeterMutationLedger? {captured}
    /// Fresh Core adoption must succeed BEFORE the first genuine Source writer.
    /// A known same-object Core preserves its own current ledger, including a
    /// genuine restart's resetTransientGuards, rather than adopting over it.
    func bind(_ engine:NativeGameplayEngine)->Binding? {
        guard !disposed,active==nil else{return nil}
        if knownEngine === engine {
            captured=engine.sourceMeterMutationSnapshot
        } else {
            let source=captured ?? NativeSourceMeterMutationLedger(generation:engine.state.generation)
            guard engine.adoptSourceMeterMutationSnapshot(source,generation:engine.state.generation) else{return nil}
            captured=engine.sourceMeterMutationSnapshot
        }
        let binding=Binding(owner:self,engine:engine);knownEngine=engine;active=binding;return binding
    }
    private func retire(_ binding:Binding,engine:NativeGameplayEngine) {
        guard !disposed,active === binding else{return}
        // Capture BEFORE arbitrary caller retirement can bind/write new Core C.
        captured=engine.sourceMeterMutationSnapshot;knownEngine=engine;active=nil
    }
    func dispose(){guard !disposed else{return};active?.captureBeforeRetirement();disposed=true;active=nil}
    @MainActor final class Binding {
        private weak var owner:NativeSourceAppMutationLedger?
        private var engine:NativeGameplayEngine?
        private var retired=false
        fileprivate init(owner:NativeSourceAppMutationLedger,engine:NativeGameplayEngine){self.owner=owner;self.engine=engine}
        /// Retains real Core until this synchronous capture; no weak-Core loss.
        func captureBeforeRetirement() {
            guard !retired else{return};retired=true
            let capturedEngine=engine;engine=nil
            if let capturedEngine {owner?.retire(self,engine:capturedEngine)}
            owner=nil
        }
        func owns(_ candidate:NativeGameplayEngine)->Bool {!retired && engine === candidate}
    }
}
