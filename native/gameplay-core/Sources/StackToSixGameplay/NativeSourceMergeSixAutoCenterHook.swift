import Foundation

/// Optional native transport preparation after canonical legality/readiness
/// but before a merge-six stage changes the board or allocates its plan. The
/// caller installs only the original drag-core autoCenter roots here. Original
/// ticker wake can run older callbacks; Core therefore revalidates afterwards.
public final class NativeSourceMergeSixAutoCenterLease {
    public let isCurrent:()->Bool,rejected:()->Void
    public init(isCurrent:@escaping()->Bool,rejected:@escaping()->Void){self.isCurrent=isCurrent;self.rejected=rejected}
}
public final class NativeSourceMergeSixAutoCenterHook {
    public let prepare:(NativeTile,NativeTile,UInt64)->NativeSourceMergeSixAutoCenterLease?
    public init(prepare:@escaping(NativeTile,NativeTile,UInt64)->NativeSourceMergeSixAutoCenterLease?){self.prepare=prepare}
}
