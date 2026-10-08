import Foundation

/// Actual remembered-Wild first face callback. Source special stays nil while
/// isWild/isWildFace reassert and physical depth becomes1; main keeps originals.
public struct NativeSourceWildDestinationFaceReceipt:Equatable,Sendable {
    public let id:String,transactionID:String
    public let generation:UInt64,revision:UInt64
    public let originalDestination:NativeTile,beforeFace:NativeTile,afterFace:NativeTile
    public let assetPath:String
}
