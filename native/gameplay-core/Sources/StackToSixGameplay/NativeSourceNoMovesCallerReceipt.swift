import Foundation

/// Created only by actual successful moves debit / regular-Six main prefix.
/// Neither a resolver result nor elapsed time can manufacture this provenance.
public struct NativeSourceNoMovesCallerReceipt:Equatable,Sendable {
    public enum Kind:String,Hashable,Sendable {case ordinaryMovesDepleted,mergeMovesDepleted}
    public let id:String,ownerID:String,generation:UInt64,sequence:UInt64,kind:Kind
    public let admissionID:UUID
    init(id:String,ownerID:String,generation:UInt64,sequence:UInt64,kind:Kind,admissionID:UUID){self.id=id;self.ownerID=ownerID;self.generation=generation;self.sequence=sequence;self.kind=kind;self.admissionID=admissionID}
    public var reason:String {kind == .ordinaryMovesDepleted ? "moves_depleted_stuck":"merge_moves_depleted_stuck"}
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
/// actual confirmed-final finally after modal action/abort, never board exit.
public final class NativeSourceNoMovesCallerCompletionBinding {
    public let admissionID:UUID
    public let deliver:(NativeSourceNoMovesCallerReceipt)->Void
    public init(admissionID:UUID,deliver:@escaping(NativeSourceNoMovesCallerReceipt)->Void){self.admissionID=admissionID;self.deliver=deliver}
}
