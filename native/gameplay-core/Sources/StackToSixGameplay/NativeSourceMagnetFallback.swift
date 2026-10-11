import Foundation

/// Authentic post-commit continuation record, created from captured Magnet
/// respawn plan before pendingSpecial retires. Public construction unavailable.
public struct NativeSourceMagnetPostCommitReceipt:Equatable,Sendable {
    public let transactionID:String,generation:UInt64,spawnCount:Int,reserved:[NativeCell]
}
public struct NativeSourceMagnetFallbackPlan:Equatable,Sendable {
    public let id:String,transactionID:String,generation:UInt64,cells:[NativeCell]
}
public struct NativeSourceMagnetFallbackOpen:Equatable,Sendable {
    public let id:String,planID:String,generation:UInt64,index:Int,cell:NativeCell,value:Int
    public let holder:NativeTile?,removedHolderID:String?,createdHolder:Bool,skipped:Bool
}
