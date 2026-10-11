import Foundation

/// Created only by actual moves debit / regular-Six main prefix or captured
/// ordinary-main pre-debit branch.
/// Neither a resolver result nor elapsed time can manufacture this provenance.
public struct NativeSourceNoMovesCallerReceipt:Equatable,Sendable {
    public enum Kind:String,Hashable,Sendable {case ordinaryMovesDepleted,mergeMovesDepleted,lastTwoRegular,lastTwoSelf,lastThreeRegular,lastThreeSelf,singleRegular,postMerge}
    public let id:String,ownerID:String,generation:UInt64,sequence:UInt64,kind:Kind
    public let admissionID:UUID
    init(id:String,ownerID:String,generation:UInt64,sequence:UInt64,kind:Kind,admissionID:UUID){self.id=id;self.ownerID=ownerID;self.generation=generation;self.sequence=sequence;self.kind=kind;self.admissionID=admissionID}
    public var trigger:NativeNoMovesCandidateOwner.Trigger {
        switch kind {
        case .ordinaryMovesDepleted:return .movesDepleted
        case .mergeMovesDepleted:return .mergeMovesDepleted
        case .lastTwoRegular:return .lastTwoRegular
        case .lastTwoSelf:return .lastTwoSelf
        case .lastThreeRegular:return .lastThreeRegular
        case .lastThreeSelf:return .lastThreeSelf
        case .singleRegular:return .singleRegular
        case .postMerge:return .postMerge
        }
    }
    public var reason:String {trigger.rawValue}
    public var isPreDebit:Bool {kind != .ordinaryMovesDepleted && kind != .mergeMovesDepleted}
}

/// Captured publication of mandatory actual caller transports. No Source global
/// capability is manufactured; Scene can publish only after its real bind barrier.
public final class NativeSourceNoMovesCallerAdmission {
    public let id=UUID(),generation:UInt64
    public let kinds:Set<NativeSourceNoMovesCallerReceipt.Kind>
    public private(set) var retired=false
    public init(generation:UInt64,kinds:Set<NativeSourceNoMovesCallerReceipt.Kind>){self.generation=generation;self.kinds=kinds}
    public func retire(){retired=true}
}

/// Finishes only the genuine captured runNoMovesFailFlow return: rollback or
/// actual showFinalScreen invocation/return receipt. Modal final cleanup stays
/// independent; neither elapsed time nor board exit manufactures this reply.
public final class NativeSourceNoMovesCallerCompletionBinding {
    public let admissionID:UUID
    public let deliver:(NativeSourceNoMovesCallerReceipt)->Void
    public init(admissionID:UUID,deliver:@escaping(NativeSourceNoMovesCallerReceipt)->Void){self.admissionID=admissionID;self.deliver=deliver}
}
