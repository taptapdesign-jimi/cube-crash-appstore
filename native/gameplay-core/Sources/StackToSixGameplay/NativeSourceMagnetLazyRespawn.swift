import Foundation

/// Source app-merge captures cells/forced values before its wall50/150i waits.
/// Holder allocation and survivor value draw remain actual callback actions.
public struct NativeSourceMagnetLazySlot:Equatable,Sendable {
    public let index:Int
    public let cell:NativeCell
    public let forcedValue:Int
}
public struct NativeSourceMagnetLazyRespawnPlan:Equatable,Sendable {
    public let transactionID:String
    public let generation:UInt64
    public let revision:UInt64
    public let slots:[NativeSourceMagnetLazySlot]
    public let reserved:[NativeCell]
    public let destinationID:String
    public let avoiding:Int
}
public struct NativeSourceMagnetLazyOpen:Equatable,Sendable {
    public let id:String
    public let transactionID:String
    public let generation:UInt64
    public let slot:NativeSourceMagnetLazySlot
    public let holder:NativeTile?
    public let removedHolderID:String?
    public let skipped:Bool
}
public struct NativeSourceMagnetReserveFill:Equatable,Sendable {
    public let transactionID:String
    public let generation:UInt64
    public let holders:[NativeTile]
}
public struct NativeSourceMagnetSurvivorConversion:Equatable,Sendable {
    public let transactionID:String
    public let generation:UInt64
    public let survivor:NativeTile
}
