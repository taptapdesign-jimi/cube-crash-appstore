import Foundation

/// Captured logical opening. The renderer owns only its actual callback/arrival transport.
public struct NativeWildSpawnAction: Equatable, Sendable {
    public enum Kind: Sendable { case primary, hardPrimary, locked, wait }
    public let id:String
    public let transactionID:String
    public let generation:UInt64
    public let phaseID:String
    public let kind:Kind
    public let cell:NativeCell?
    public let tileID:String?
    public let delayMilliseconds:Int
    /// Captured literal level-flow promise owner, before its wall callback.
    /// Force/manual locked branches never manufacture this marker.
    public let sourceLevelFlow:Bool
    /// The manual emergency opening assigns its face without a spawnBounce.
    /// Renderers must not hide that face while waiting for an absent publication.
    public let publishesBounce:Bool
    public init(id:String,transactionID:String,generation:UInt64,phaseID:String,kind:Kind,
                cell:NativeCell?,tileID:String?,delayMilliseconds:Int,sourceLevelFlow:Bool,
                publishesBounce:Bool=true) {
        self.id=id;self.transactionID=transactionID;self.generation=generation;self.phaseID=phaseID
        self.kind=kind;self.cell=cell;self.tileID=tileID;self.delayMilliseconds=delayMilliseconds
        self.sourceLevelFlow=sourceLevelFlow;self.publishesBounce=publishesBounce
    }
    public var awaitsBounce:Bool {kind == .primary}
}
public struct NativeWildSpawnArrival: Equatable, Sendable {
    public let id:String
    public let transactionID:String
    public let generation:UInt64
    public let tileID:String
    public let cell:NativeCell
}

/// Original generation-owned scheduleCheckLevelEnd(.12) after terminal-owner abort.
public struct NativeWildRecoveryCheck:Equatable,Sendable {
    public let id:String
    public let generation:UInt64
    public let delayMilliseconds:Int
    public let reason:String
}

/// Captured original spawnBounce random direction; decorative transport has no RNG authority.
public struct NativeWildSpawnPresentation:Equatable,Sendable {
    public let tileID:String
    public let transactionID:String
    public let generation:UInt64
    public let direction:Int
    /// Only literal level-flow locked callback owns completed-bounce +160 repair.
    public let sourceLevelFlowReinforcement:Bool
}
