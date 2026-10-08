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
    /// Actual Source setValue resets alpha and final hide suppresses children only.
    /// Default false preserves previously admitted Raw stage projection.
    public let usesSourceDestinationParentState:Bool
    public let prepare:(NativeTile,NativeTile,UInt64)->NativeSourceMergeSixAutoCenterLease?
    public init(usesSourceDestinationParentState:Bool=false,prepare:@escaping(NativeTile,NativeTile,UInt64)->NativeSourceMergeSixAutoCenterLease?){self.usesSourceDestinationParentState=usesSourceDestinationParentState;self.prepare=prepare}
}
