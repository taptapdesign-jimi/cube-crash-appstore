import Foundation

/// Raw receipts from the actual Source marker owners. No alpha/action/plan inference.
public struct NativeSourceMeterQueueTileMarkers: Equatable, Sendable {
    public let tileID: String
    public let destroyed, cleanupClaim, magnetAffected: Bool
    public let wildDropping, wildHandoff, ccSpawnAnimating, spawnAnimating, isSpawning: Bool
    public init(tileID:String, destroyed:Bool, cleanupClaim:Bool, magnetAffected:Bool,
                wildDropping:Bool, wildHandoff:Bool, ccSpawnAnimating:Bool,
                spawnAnimating:Bool, isSpawning:Bool) {
        self.tileID=tileID; self.destroyed=destroyed; self.cleanupClaim=cleanupClaim
        self.magnetAffected=magnetAffected; self.wildDropping=wildDropping
        self.wildHandoff=wildHandoff; self.ccSpawnAnimating=ccSpawnAnimating
        self.spawnAnimating=spawnAnimating; self.isSpawning=isSpawning
    }
    var transientAnimation:Bool { wildDropping || wildHandoff || ccSpawnAnimating || spawnAnimating || isSpawning }
}

/// Every argument is mandatory: false is an actual owner receipt, not missing admission.
/// Outer queue keeps queueInProgress true until its real Promise.finally microtask.
/// The inner spawn permission intentionally supplies false for its own outer flag.
public struct NativeSourceMeterQueueEnvironment: Equatable, Sendable {
    public let generation: UInt64
    public let sourceDateMilliseconds: Int64
    public let boardMeterEnabled, boardSpawnEnabled, queueInProgress: Bool
    public let boardTransitionActive, failScreenPending, specialTransactionActive: Bool
    public let endgameGuardActive: Bool
    public let endgameGuardSources: [String]
    public let mergeSixSpawnInProgress, wildMagnetPullInProgress, wildDropInProgress: Bool
    public let tiles: [NativeSourceMeterQueueTileMarkers]
    public init(generation:UInt64, sourceDateMilliseconds:Int64, boardMeterEnabled:Bool,
                boardSpawnEnabled:Bool, queueInProgress:Bool, boardTransitionActive:Bool,
                failScreenPending:Bool, specialTransactionActive:Bool,
                endgameGuardActive:Bool, endgameGuardSources:[String],
                mergeSixSpawnInProgress:Bool, wildMagnetPullInProgress:Bool,
                wildDropInProgress:Bool, tiles:[NativeSourceMeterQueueTileMarkers]) {
        self.generation=generation; self.sourceDateMilliseconds=sourceDateMilliseconds
        self.boardMeterEnabled=boardMeterEnabled; self.boardSpawnEnabled=boardSpawnEnabled
        self.queueInProgress=queueInProgress; self.boardTransitionActive=boardTransitionActive
        self.failScreenPending=failScreenPending; self.specialTransactionActive=specialTransactionActive
        self.endgameGuardActive=endgameGuardActive; self.endgameGuardSources=endgameGuardSources
        self.mergeSixSpawnInProgress=mergeSixSpawnInProgress
        self.wildMagnetPullInProgress=wildMagnetPullInProgress
        self.wildDropInProgress=wildDropInProgress; self.tiles=tiles
    }
}

/// The exact eventMode name is a signature field. Classifier .normal alone cannot
/// distinguish static/auto/dynamic and must not be substituted here.
public struct NativeSourceMeterEventMode: Equatable, Sendable {
    public let name:String?
    public init(_ name:String?) { self.name=name.flatMap { $0.isEmpty ? nil:$0 } }
}

/// app-core buildEndgameBoardSignature, distinct from buildNoMovesBoardSignature.
public struct NativeSourceMeterEndgameSignature: Equatable, Sendable {
    public struct Entry: Equatable, Sendable {
        public let value:Int, special:String?, locked:Bool, depth:Int
        public let x:Int?, y:Int?, eventMode:String?
        public init(value:Int,special:String?,locked:Bool,depth:Int,x:Int?,y:Int?,eventMode:String?) {
            self.value=value;self.special=special.flatMap{$0.isEmpty ? nil:$0}
            self.locked=locked;self.depth=depth == 0 ? 1:depth;self.x=x;self.y=y
            self.eventMode=eventMode.flatMap{$0.isEmpty ? nil:$0}
        }
    }
    public let entries:[Entry]
    public init(activeEntries:[Entry]) {
        entries=activeEntries.enumerated().sorted { a,b in
            let l=a.element,r=b.element
            if l.y != r.y { let d=(l.y ?? -1)-(r.y ?? -1); return d == 0 ? a.offset<b.offset:d<0 }
            if l.x != r.x { let d=(l.x ?? -1)-(r.x ?? -1); return d == 0 ? a.offset<b.offset:d<0 }
            if l.value != r.value {return l.value<r.value}
            let order=(l.special ?? "null").compare(r.special ?? "null",locale:Locale(identifier:"en_US"))
            return order == .orderedSame ? a.offset<b.offset:order == .orderedAscending
        }.map(\.element)
    }
}

/// Four genuine Source writer receipts only. No generic state/revision mutation.
public struct NativeSourceMeterMutationLedger: Equatable, Sendable {
    public enum Writer: Equatable, Sendable {
        case regularHandoffBegan(UInt64)
        case regularHandoffReleased(UInt64)
        case mergeSixSpawnOwnerAllocated(UInt64)
        case checkLevelEndSignatureObserved(NativeSourceMeterEndgameSignature)
    }
    public private(set) var generation:UInt64
    public private(set) var lastMutationDateMilliseconds:Int64=0
    public private(set) var activeRegularHandoffs:Set<UInt64>=[]
    private var lastRegularToken:UInt64=0, lastMergeSixToken:UInt64=0
    private var endgameSignature:NativeSourceMeterEndgameSignature?
    public init(generation:UInt64) {self.generation=generation}
    /// Literal resetTransientRunGuards clears tokens but does not reset either
    /// app-lived Date/signature or monotonic Source owner sequences.
    public mutating func resetTransientGuards(generation:UInt64) {
        self.generation=generation;activeRegularHandoffs.removeAll()
    }
    @discardableResult public mutating func record(_ writer:Writer,generation:UInt64,sourceDateMilliseconds:Int64)->Bool {
        guard generation==self.generation else{return false}
        switch writer {
        case .regularHandoffBegan(let token):
            guard token>lastRegularToken else{return false}
            lastRegularToken=token;activeRegularHandoffs.insert(token)
        case .regularHandoffReleased(let token):
            guard activeRegularHandoffs.remove(token) != nil else{return false}
        case .mergeSixSpawnOwnerAllocated(let token):
            guard token>lastMergeSixToken else{return false};lastMergeSixToken=token
        case .checkLevelEndSignatureObserved(let signature):
            guard signature != endgameSignature else{return false};endgameSignature=signature
        }
        lastMutationDateMilliseconds=sourceDateMilliseconds;return true
    }
    public func isBoardSettling(sourceDateMilliseconds:Int64)->Bool {
        // Source truthiness and Date.now subtraction, including backwards wall jumps.
        lastMutationDateMilliseconds != 0 && Double(sourceDateMilliseconds)-Double(lastMutationDateMilliseconds)<80
    }
}
