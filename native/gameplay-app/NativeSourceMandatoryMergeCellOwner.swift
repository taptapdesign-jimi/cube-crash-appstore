import Foundation
import StackToSixGameplay

/// Literal pendingMandatoryMergeCellSpawn. Date is read by actual phase/repair
/// writers; neither observation nor physical verification manufactures expiry.
@MainActor final class NativeSourceMandatoryMergeCellOwner {
    struct Claim:Equatable {let id:UUID,ownerID:String,generation:UInt64,cell:NativeCell,expiresAt:Double}
    private let date:()->Double,current:()->Bool
    private var epoch:UInt64=0,retired=false
    private(set) var pending:Claim?
    init(date:@escaping()->Double,current:@escaping()->Bool){self.date=date;self.current=current}
    @discardableResult func begin(ownerID:String,generation:UInt64,cell:NativeCell,ttl:Int=2500)->Bool {
        guard !retired,current(),!retired else{return false}
        epoch &+= 1;let captured=epoch,now=date()
        guard now.isFinite,!retired,epoch==captured,current(),!retired,epoch==captured else{return false}
        pending = .init(id:UUID(),ownerID:ownerID,generation:generation,cell:cell,expiresAt:now+Double(ttl));return true
    }
    @discardableResult func verifiedActive(ownerID:String,generation:UInt64,cell:NativeCell)->Bool {
        guard !retired,current(),let pending,pending.ownerID==ownerID,pending.generation==generation,pending.cell==cell else{return false}
        epoch &+= 1;self.pending=nil;return true
    }
    @discardableResult func verifiedActive(_ claim:Claim)->Bool {
        guard pending==claim else{return false};return verifiedActive(ownerID:claim.ownerID,generation:claim.generation,cell:claim.cell)
    }
    /// Actual repair Promise returned false; cancellation never calls this.
    @discardableResult func repairFailed(_ claim:Claim)->Bool {
        guard !retired,pending==claim,current(),!retired,pending==claim else{return false}
        epoch &+= 1;pending=nil;return true
    }
    func renewForRepair(_ claim:Claim)->Claim? {
        guard pending==claim,begin(ownerID:claim.ownerID,generation:claim.generation,cell:claim.cell,ttl:1200) else{return nil};return pending
    }
    func retire(){retired=true;epoch &+= 1;pending=nil}
}
