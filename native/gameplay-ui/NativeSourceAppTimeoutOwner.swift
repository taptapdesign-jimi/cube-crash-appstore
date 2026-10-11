import Foundation

/// Source app-core-utils/level-flow setTimeout ownership. Modal animation pause
/// does not pause these callbacks; real destruction cancels captured delivery.
/// This is finite logical work and acquires no renderer/cadence activity lease.
@MainActor
final class NativeSourceAppTimeoutOwner {
    struct Receipt:Hashable,Sendable {
        let id:UUID
        let sourceID:String
        let generation:UInt64
    }
    private struct Pending {
        let work:DispatchWorkItem
        let elapsed:()->Void
        let cancelled:(()->Void)?
    }
    /// PRIVATE nil preserves existing Raw dispatch. Install only app-owned FIFO.
    var sourceMicrotaskTasks:NativeSourceMicrotaskAdapters?
    private var records:[Receipt:Pending]=[:]
    private var order:[Receipt]=[]
    var pendingCount:Int {records.count}
    var pendingReceipts:[Receipt] {order.filter{records[$0] != nil}}

    @discardableResult
    func schedule(sourceID:String,generation:UInt64,delayMilliseconds:Int,
                  from deadline:DispatchTime = .now(),
                  elapsed:@escaping()->Void,cancelled:(()->Void)?=nil)->Receipt {
        let receipt=Receipt(id:UUID(),sourceID:sourceID,generation:generation)
        let work=DispatchWorkItem { [weak self] in
            MainActor.assumeIsolated {self?.deliver(receipt)}
        }
        records[receipt]=Pending(work:work,elapsed:elapsed,cancelled:cancelled)
        order.append(receipt)
        DispatchQueue.main.asyncAfter(deadline:deadline + .milliseconds(max(0,delayMilliseconds)),execute:work)
        return receipt
    }
    private func deliver(_ receipt:Receipt) {
        // Literal source scheduleAppTimeout removes its registry record before
        // calling user code, so reentrant global cleanup cannot settle it twice.
        guard let pending=records.removeValue(forKey:receipt) else{return}
        order.removeAll{$0==receipt}
        if let tasks=sourceMicrotaskTasks {tasks.timeoutCallback(pending.elapsed)()}
        else {pending.elapsed()}
    }
    @discardableResult
    func cancel(_ receipt:Receipt)->Bool {
        guard let pending=records.removeValue(forKey:receipt) else{return false}
        order.removeAll{$0==receipt}
        pending.work.cancel();pending.cancelled?()
        return true
    }
    func cancelGeneration(_ generation:UInt64) {
        for receipt in order.filter({$0.generation==generation}) {_=cancel(receipt)}
    }
    func cancelAll() {
        let pending=order.compactMap{records[$0]}
        records.removeAll();order.removeAll()
        for record in pending {record.work.cancel();record.cancelled?()}
    }
}

/// app-core scheduleSpawnOpacitySafetySweep: the full board repair precedes
/// the local opacity sweep at both APP wall deadlines. The caller supplies
/// actual repair owners; this scheduler does not invent physical coverage.
@MainActor final class NativeSourceSpawnVisualSafetyOwner {
    private let timeouts:NativeSourceAppTimeoutOwner
    private let generation:UInt64
    private let current:()->Bool
    private let repairBoard:()->Bool
    private let repairOpacity:()->Bool
    private let failure:()->Void
    private var pending:[UUID:NativeSourceAppTimeoutOwner.Receipt]=[:]
    private var disposed=false
    var pendingCount:Int {pending.count}
    init(timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,current:@escaping()->Bool,
         repairBoard:@escaping()->Bool,repairOpacity:@escaping()->Bool,failure:@escaping()->Void) {
        self.timeouts=timeouts;self.generation=generation;self.current=current
        self.repairBoard=repairBoard;self.repairOpacity=repairOpacity;self.failure=failure
    }
    private func admitted()->Bool {
        guard !disposed else{return false}
        let accepted=current()
        return accepted && !disposed
    }
    @discardableResult func schedule()->Bool {
        guard admitted() else{return false}
        for milliseconds in [600,1200] {
            let job=UUID()
            pending[job]=timeouts.schedule(sourceID:"spawn-opacity-safety:\(job)",generation:generation,
                delayMilliseconds:milliseconds,elapsed:{[weak self] in
                    guard let self,self.pending.removeValue(forKey:job) != nil,self.admitted() else{return}
                    let repaired=self.repairBoard()
                    guard self.admitted() else{return}
                    guard repaired else{self.failure();return}
                    let opacity=self.repairOpacity()
                    guard self.admitted() else{return}
                    if !opacity {self.failure()}
                },cancelled:{[weak self] in self?.pending.removeValue(forKey:job)})
        }
        return true
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        let receipts=Array(pending.values);pending.removeAll()
        for receipt in receipts {_=timeouts.cancel(receipt)}
    }
}
