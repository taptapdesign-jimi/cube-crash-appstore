import Foundation

/// Literal app-core hasUnsavableTransientGameplayState admission. These are source
/// lifecycle markers, not generic native action/particle/HUD animation presence.
public struct NativeSourceSaveTileMarkers:Equatable,Sendable {
    public var destroyed=false
    public var wildSpawnDropping=false
    public var wildSpawnHandoffLock=false
    public var isBeingSpawned=false
    public var pendingRemoval=false
    public var beingRemoved=false
    public var cleanupQueued=false
    public var ccSpawnAnimating=false
    public var spawnAnimating=false
    public var isSpawning=false
    public var hasSpawnTween=false
    public init(){}
    var blocksSave:Bool {!destroyed && (wildSpawnDropping || wildSpawnHandoffLock || isBeingSpawned || pendingRemoval || beingRemoved || cleanupQueued || ccSpawnAnimating || spawnAnimating || isSpawning || hasSpawnTween)}
}
public struct NativeSourceSaveRuntime:Equatable,Sendable {
    public var busyEnding=false
    public var wildSpawnInProgress=false
    public var merge6SpawnInProgress=false
    public var wildMagnetPullInProgress=false
    public var specialTransactionActive=false
    public var regularHandoffActive=false
    public var cleanupOwned=false
    public var activeDrag=false
    public var wildDropInProgress=false
    public var tileMarkers:[NativeSourceSaveTileMarkers]=[]
    public init(){}
    public var hasUnsavableTransientGameplayState:Bool {
        busyEnding || wildSpawnInProgress || merge6SpawnInProgress || wildMagnetPullInProgress || specialTransactionActive || regularHandoffActive || cleanupOwned || activeDrag || wildDropInProgress || tileMarkers.contains(where:{$0.blocksSave})
    }
}
