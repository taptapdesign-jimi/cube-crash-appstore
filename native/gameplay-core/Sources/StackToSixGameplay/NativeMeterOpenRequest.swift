import Foundation

/// Actual native hidden-node creation is injected, not a timer or texture-ready flag.
public struct NativeMeterOpenRequest:Equatable,Sendable {
 public let id:String,generation:UInt64,spawnToken:UInt64,attempt:Int,tile:NativeTile
 public let expectedHolderID:String?
}
public enum NativeMeterOpenReceipt:Equatable,Sendable {
 case created(tileID:String),refused,creationFailed
}
/// Original no-empty-cell waitTrackedResult40; outer failed-spawn retry600 is separate.
public struct NativeMeterOpenRetry:Equatable,Sendable {
 public let id:String,generation:UInt64,spawnToken:UInt64,milliseconds:Int
}
