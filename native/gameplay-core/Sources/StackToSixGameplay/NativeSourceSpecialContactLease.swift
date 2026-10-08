import Foundation

/// Callback capability from the actual app Special registry. Cleanup belongs to
/// the captured claim, so rejection after reentry cannot release replacement C.
public struct NativeSourceSpecialContactLease {
    public let isCurrent:()->Bool
    public let rejected:()->Void
    public init(isCurrent:@escaping()->Bool,rejected:@escaping()->Void) {
        self.isCurrent=isCurrent;self.rejected=rejected
    }
}

/// Captured installation identity. An obsolete Scene may only unhook its own
/// object, and Core rejects replacement during synchronous admission.
public final class NativeSourceSpecialContactHook {
    public let claim:(NativeTile,NativeTile,NativeWildArchetype)->NativeSourceSpecialContactLease?
    public init(claim:@escaping(NativeTile,NativeTile,NativeWildArchetype)->NativeSourceSpecialContactLease?) {self.claim=claim}
}
