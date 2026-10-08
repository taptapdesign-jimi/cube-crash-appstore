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
        pending.elapsed()
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
