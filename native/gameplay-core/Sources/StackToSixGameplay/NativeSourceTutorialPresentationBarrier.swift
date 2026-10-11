import Foundation

/// Transient presentation boundary after a committed first merge. Canonical
/// save already describes step two, so relaunch never persists a wall timer or
/// an input lock. Only the captured UI completion may release this live run.
public struct NativeSourceTutorialPresentationBarrier:Equatable,Sendable {
    public enum Phase:String,Equatable,Sendable {case firstMerge,secondMerge}
    public let phase:Phase
    public let id:String,generation:UInt64,mergedID:String,oneID:String
    init(id:String,generation:UInt64,mergedID:String,oneID:String,phase:Phase = .firstMerge){self.phase=phase;self.id=id;self.generation=generation;self.mergedID=mergedID;self.oneID=oneID}
}
