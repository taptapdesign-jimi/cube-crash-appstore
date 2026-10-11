import Foundation

/// Immutable provenance from the captured Special plan and its actual first RAF.
public struct NativeSourceSpecialWildDestinationFaceReceipt:Equatable,Sendable {
 public let transactionID:String
 public let archetype:NativeWildArchetype
 public let face:NativeSourceWildDestinationFaceReceipt
}
