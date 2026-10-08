import Foundation

/// Private candidate only: Source meter-spawn continuation is independent of
/// delayed TNT charge receipts, ordinary/Special spawn-coroutine assignments,
/// the carrier100 scope and a post-landing140ms wall marker.
public struct NativeMeterDropReservation:Equatable,Sendable {
    public let id:String,generation:UInt64,tileID:String,cell:NativeCell,archetype:NativeWildArchetype,variant:String?
    public var cancellationRequested=false,queueCanceled=false,warmupAwaitStarted=false
    public var assetsPrepared=false,revealed=false,impactOccurred=false,landed=false,dropCompleted=false,warmupCompleted=false,handoffLocked=false,bookkeepingCommitted=false
}
public enum NativeMeterDropReceipt:Equatable,Sendable {
    case assetsPrepared,revealed,impact,boardFallbackRestored,dropPromiseCompleted,selectedWarmupCompleted,wallHandoffUnlocked
}

/// Explicit Source cancelPendingWildContinuation resets the meter. A cancellation
/// detected by busyEnding/last-merge leaves already-consumed surplus unchanged.
public enum NativeMeterDropCancellation:Equatable,Sendable {
    case explicitPendingContinuation,busyEndingOrLastMerge
}
