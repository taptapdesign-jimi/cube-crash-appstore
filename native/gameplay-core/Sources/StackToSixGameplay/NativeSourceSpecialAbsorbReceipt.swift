import Foundation

/// A renderer must install an actual same-source main80 animation owner before
/// claiming this receipt. No phase is inferred from a texture, timer or respawn.
public struct NativeSourceSpecialAbsorbReceipt:Equatable,Sendable {
 public let id:String,transactionID:String,sourceID:String,destinationID:String
 public let generation:UInt64
}
