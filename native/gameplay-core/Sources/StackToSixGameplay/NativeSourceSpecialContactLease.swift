import Foundation

/// Callback capability from the actual app Special registry. Cleanup belongs to
/// the captured claim, so rejection after reentry cannot release replacement C.
public struct NativeSourceStarOrbitCapture:Equatable,Sendable {
    public let tileID:String,generation:UInt64,savedPositions:Int,savedSystem:Int
    public init(tileID:String,generation:UInt64,savedPositions:Int,savedSystem:Int){self.tileID=tileID;self.generation=generation;self.savedPositions=savedPositions;self.savedSystem=savedSystem}
    public func matches(source:NativeTile,destination:NativeTile,generation:UInt64)->Bool {
        guard self.generation==generation,savedPositions>=0,savedSystem>=0,savedPositions<=savedSystem else{return false}
        guard let tile=[source,destination].first(where:{$0.id==tileID}) else{return false}
        return tile.archetype == .star && tile.variant==nil
    }
}
public struct NativeSourceSpecialContactLease {
    public let starOrbitCapture:NativeSourceStarOrbitCapture?
    public let isCurrent:()->Bool
    public let rejected:()->Void
    public init(isCurrent:@escaping()->Bool,rejected:@escaping()->Void,starOrbitCapture:NativeSourceStarOrbitCapture?=nil) {
        self.isCurrent=isCurrent;self.rejected=rejected;self.starOrbitCapture=starOrbitCapture
    }
}

/// Captured installation identity. An obsolete Scene may only unhook its own
/// object, and Core rejects replacement during synchronous admission.
public final class NativeSourceSpecialContactHook {
    public let claim:(NativeTile,NativeTile,NativeWildArchetype)->NativeSourceSpecialContactLease?
    public init(claim:@escaping(NativeTile,NativeTile,NativeWildArchetype)->NativeSourceSpecialContactLease?) {self.claim=claim}
}
