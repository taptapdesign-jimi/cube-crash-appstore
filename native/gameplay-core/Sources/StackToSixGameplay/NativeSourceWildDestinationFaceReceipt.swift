import Foundation

/// Actual remembered-Wild first face callback. Source special stays nil while
/// isWild/isWildFace reassert and physical depth becomes1; main keeps originals.
public struct NativeSourceWildDestinationFaceReceipt:Equatable,Sendable {
    public let id:String,transactionID:String
    public let generation:UInt64,revision:UInt64
    public let originalDestination:NativeTile,beforeFace:NativeTile,afterFace:NativeTile
    public let assetPath:String
    /// board._setValueVisuals reads the cleared special but retains the registry
    /// identity. The remembered core only admits Wild presence; it does not
    /// choose the old TNT/Juice texture. Normal Magnet owns its separate pull;
    /// a confirmed no-pull final Magnet uses the same Direct prefix.
    public static func selectedAssetPath(for tile:NativeTile)->String? {
        guard tile.isWild,let core=tile.gameplayArchetype else{return nil}
        guard let variant=tile.variant else{return "assets/wild.png"}
        return NativeSpecialDiceRegistry.compatibleVariant(variant,core:core)?.texture
    }
}
