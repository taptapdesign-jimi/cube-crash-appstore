import Foundation

/// Only an actual mounted Source ordinary-main callback may claim its existing
/// Core postcheck. This provenance is separate from a fresh checker verdict.
public struct NativeSourceOrdinaryPreDebitReceipt:Equatable,Sendable {
    public let id:UUID,ownerID:String,generation:UInt64,admissionID:UUID
    init(ownerID:String,generation:UInt64,admissionID:UUID){id=UUID();self.ownerID=ownerID;self.generation=generation;self.admissionID=admissionID}
}

/// Presence endpoint only; it must not query/prune runtime registries ahead of
/// the literal Source callback. Full Source markers remain mandatory separately.
public final class NativeSourceOrdinaryPreDebitAdmission {
    public let id=UUID(),callerAdmissionID:UUID,generation:UInt64
    public private(set) var retired=false
    public let isCurrent:()->Bool
    public init(callerAdmissionID:UUID,generation:UInt64,isCurrent:@escaping()->Bool){self.callerAdmissionID=callerAdmissionID;self.generation=generation;self.isCurrent=isCurrent}
    public func retire(){retired=true}
}
public enum NativeSourceOrdinaryPreDebitOutcome:Equatable,Sendable {case continueToDebit,returned,cancelled}
