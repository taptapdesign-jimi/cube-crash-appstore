import Foundation

/// v9 app-core6482: finite APP wall batches after sweetPopIn completion.
/// Borrows the board's existing timeout owner and the app's existing pool.
/// No visual RNG, renderer lease, frame transport or animation is created.
@MainActor final class NativeSourceSmokePoolWarmup {
    typealias Schedule=(String,UInt64,Int,@escaping()->Void,@escaping()->Void)->NativeSourceAppTimeoutOwner.Receipt
    static let batches=(1...10).map{(milliseconds:260+$0*70,target:min(76,$0*8))}
    private let generation:UInt64,current:()->Bool,warm:(Int)->Void
    private let schedule:Schedule,cancel:(NativeSourceAppTimeoutOwner.Receipt)->Void
    private var pending:[Int:NativeSourceAppTimeoutOwner.Receipt]=[:]
    private var started=false
    private(set) var disposed=false,completedTargets:[Int]=[]
    var pendingCount:Int{pending.count}
    init(generation:UInt64,current:@escaping()->Bool,warm:@escaping(Int)->Void,
         schedule:@escaping Schedule,cancel:@escaping(NativeSourceAppTimeoutOwner.Receipt)->Void) {
        self.generation=generation;self.current=current;self.warm=warm;self.schedule=schedule;self.cancel=cancel
    }
    convenience init(timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,current:@escaping()->Bool,session:NativeSharedSmokeRootSession) {
        self.init(generation:generation,current:current,warm:{session.prewarm(to:$0)},
            schedule:{sourceID,generation,milliseconds,elapsed,cancelled in
                timeouts.schedule(sourceID:sourceID,generation:generation,delayMilliseconds:milliseconds,elapsed:elapsed,cancelled:cancelled)
            },cancel:{_=timeouts.cancel($0)})
    }
    private func admitted()->Bool {
        guard !disposed else{return false};let accepted=current();return accepted && !disposed
    }
    @discardableResult func start()->Bool {
        guard !started,admitted() else{return false};started=true
        let owner=UUID().uuidString
        for (index,batch) in Self.batches.enumerated() {
            guard admitted() else{dispose();return false}
            let receipt=schedule("wild-smoke-warm:\(owner):\(index+1)",generation,batch.milliseconds,{[weak self] in
                guard let self,self.pending.removeValue(forKey:index) != nil else{return}
                guard self.admitted() else{self.dispose();return}
                self.warm(batch.target)
                guard self.admitted() else{self.dispose();return}
                self.completedTargets.append(batch.target)
            },{[weak self] in self?.pending.removeValue(forKey:index)})
            guard admitted() else{cancel(receipt);dispose();return false}
            pending[index]=receipt
        }
        return true
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        let receipts=Array(pending.values);pending.removeAll()
        for receipt in receipts{cancel(receipt)}
    }
    isolated deinit{dispose()}
}
