import Foundation

public enum NativeRunMode: String, Codable, Sendable { case arcade = "arcade_home", journey }
public enum NativeWildArchetype: String, Codable, CaseIterable, Sendable { case star = "wild", juice = "wild-juice", magnet = "wild-magnet", tnt = "wild-tnt" }
public struct NativeCell: Hashable, Codable, Sendable {
    public var column: Int
    public var row: Int
    public init(column: Int, row: Int) { self.column = column; self.row = row }
}
public struct NativeTile: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var cell: NativeCell
    public var value: Int
    public var stackDepth: Int
    public var starOrbitCount: Int
    public var archetype: NativeWildArchetype?
    public var variant: String?
    /// Literal first-face Wild re-entry with special still nil, only within captured Source transaction.
    public var sourceResidualWildPresence:Bool
    public var sourceWildStateCleared: Bool
    public var locked: Bool
    public var visible: Bool
    public var alpha: Double
    public var pendingRemoval: Bool
    public var transientSpawn: Bool
    public var magnetOwned: Bool
    public var resolutionOwned: Bool
    public var merge6CleanupOwned: Bool
    public var nonFinalMerge6: Bool
    public init(id: String, cell: NativeCell, value: Int, stackDepth: Int = 1, starOrbitCount: Int = 3, archetype: NativeWildArchetype? = nil, variant: String? = nil, sourceWildStateCleared: Bool = false, sourceResidualWildPresence:Bool = false, locked: Bool = false, visible: Bool = true, alpha: Double = 1, pendingRemoval: Bool = false, transientSpawn: Bool = false, magnetOwned: Bool = false, resolutionOwned: Bool = false, merge6CleanupOwned: Bool = false, nonFinalMerge6: Bool = false) {
        self.id = id; self.cell = cell; self.value = value; self.stackDepth = stackDepth; self.starOrbitCount = starOrbitCount; self.archetype = archetype; self.variant = variant; self.sourceWildStateCleared = sourceWildStateCleared; self.sourceResidualWildPresence=sourceResidualWildPresence; self.locked = locked; self.visible = visible; self.alpha = alpha; self.pendingRemoval = pendingRemoval; self.transientSpawn = transientSpawn; self.magnetOwned = magnetOwned; self.resolutionOwned = resolutionOwned; self.merge6CleanupOwned = merge6CleanupOwned; self.nonFinalMerge6 = nonFinalMerge6
    }
    public var gameplayArchetype: NativeWildArchetype? { sourceWildStateCleared ? nil:variant.flatMap { NativeSpecialDiceRegistry.variants[$0]?.archetype } ?? archetype }
    public var isWild: Bool { sourceResidualWildPresence || gameplayArchetype != nil }
    public var countsAsFinalMergeActive: Bool {
        guard !pendingRemoval, visible, alpha > 0.01 else { return false }
        if isWild { return !magnetOwned && (!locked || alpha > 0.35) }
        return !locked && value > 0
    }
    public var isActive: Bool { countsAsFinalMergeActive && !transientSpawn && !magnetOwned }
    public var isPlayable: Bool { isActive && !locked && !resolutionOwned && !merge6CleanupOwned }
}
public struct NativeBoardState: Equatable, Codable, Sendable {
    public var columns: Int
    public var rows: Int
    public var tiles: [NativeTile]
    public var mode: NativeRunMode
    public var board: Int
    public var stage: Int
    public var generation: UInt64
    public var revision: UInt64
    public var moves: Int
    public var maxMoves: Int
    public var score: Int
    public var starsCount: Int
    public var bestScore: Int
    public var maxStackDepth: Int
    public var longestCombo: Int
    public var cubesCracked: Int
    public var combo: Int
    public var earnedComboBonus: Int
    public var wildMeter: Double
    public var wildSpawnCount: Int
    public var lastWildDropType: NativeWildArchetype?
    public var wildDropTypeStreak: Int
    public var rngState: UInt64
    public var tutorial: NativeTutorialState?
    public var terminal: NativeResolution?
    public init(columns: Int = 5, rows: Int = 9, tiles: [NativeTile], mode: NativeRunMode = .journey, board: Int = 1, stage: Int = 1, generation: UInt64 = 1, revision: UInt64 = 0, moves: Int = 50, maxMoves: Int = 50, score: Int = 0, starsCount: Int = 0, bestScore: Int = 0, maxStackDepth: Int = 1, longestCombo: Int = 0, cubesCracked: Int = 0, combo: Int = 0, earnedComboBonus: Int = 0, wildMeter: Double = 0, wildSpawnCount: Int = 0, lastWildDropType: NativeWildArchetype? = nil, wildDropTypeStreak: Int = 0, rngState: UInt64 = 1, terminal: NativeResolution? = nil, tutorial: NativeTutorialState? = nil) {
        self.columns = columns; self.rows = rows; self.tiles = tiles; self.mode = mode; self.board = board; self.stage = stage; self.generation = generation; self.revision = revision; self.moves = moves; self.maxMoves = maxMoves; self.score = score; self.starsCount = starsCount; self.bestScore = bestScore; self.maxStackDepth = maxStackDepth; self.longestCombo = longestCombo; self.cubesCracked = cubesCracked; self.combo = combo; self.earnedComboBonus = earnedComboBonus; self.wildMeter = wildMeter; self.wildSpawnCount = wildSpawnCount; self.lastWildDropType = lastWildDropType; self.wildDropTypeStreak = wildDropTypeStreak; self.rngState = rngState; self.terminal = terminal; self.tutorial = tutorial
    }
    public var activeTiles: [NativeTile] { tiles.filter(\.isActive) }
    public func tile(at cell: NativeCell) -> NativeTile? { tiles.first { $0.cell == cell && !$0.pendingRemoval } }
    public var signature: String { "\(generation):\(revision):" + tiles.sorted { $0.id < $1.id }.map { "\($0.id),\($0.cell.column),\($0.cell.row),\($0.value),\($0.stackDepth),\($0.gameplayArchetype?.rawValue ?? "regular"),\($0.locked),\($0.visible),\($0.alpha),\($0.transientSpawn),\($0.pendingRemoval),\($0.magnetOwned),\($0.resolutionOwned),\($0.merge6CleanupOwned)" }.joined(separator: "|") }
    public func validationIssues() -> [String] {
        var issues: [String] = []
        if columns <= 0 || rows <= 0 || columns * rows > 4096 { issues.append("invalid-grid-shape") }
        if Set(tiles.map(\.id)).count != tiles.count { issues.append("duplicate-die-id") }
        let live = tiles.filter { !$0.pendingRemoval }
        if Set(live.map(\.cell)).count != live.count { issues.append("duplicate-grid-owner") }
        if live.contains(where: { $0.cell.column < 0 || $0.cell.column >= columns || $0.cell.row < 0 || $0.cell.row >= rows }) { issues.append("coordinate-mismatch") }
        if tiles.contains(where: { $0.id.isEmpty || $0.stackDepth < 1 || !(0...6).contains($0.value) || !$0.alpha.isFinite || ($0.variant != nil && NativeSpecialDiceRegistry.variants[$0.variant!] == nil) }) { issues.append("invalid-die") }
        if moves < 0 || maxMoves < 0 || score < 0 || starsCount < 0 || bestScore < 0 || !(0...99).contains(combo) || !wildMeter.isFinite || !(0...10).contains(wildMeter) { issues.append("invalid-run-counters") }
        return issues
    }
}
public struct NativeResolution: Equatable, Codable, Sendable {
    public enum Kind: String, Codable, Sendable { case wait, `continue`, spawn, complete, fail }
    public var kind: Kind
    public var reason: String
    public var target: String?
    public init(_ kind: Kind, reason: String, target: String? = nil) { self.kind = kind; self.reason = reason; self.target = target }
}
public struct NativeGameplayEvent: Equatable, Sendable {
    public enum Kind: String, Sendable { case sourceMagnetPullInterrupted, mergeSixAbsorbInterrupted, meterDropWillOpen, meterDropOpenCreated, meterDropOpenRejected, meterDropOpenCanceled, meterDropOpenRetryPrepared, meterDropOpenFailed, meterDropChargeConsumed, meterDropContinuationReset, meterDropCancellationRequested, meterDropCanceled, meterDropReserved, meterDropPrepared, meterDropRevealed, meterDropImpact, meterDropLanded, meterDropTravelCompleted, meterDropWarmupCompleted, meterDropHandoffUnlocked, meterDropCompleted, wildRecoveryCheckPrepared, wildLockedBonusPrepared, wildSpawnActionsPrepared, dragBegan, dragCancelled, merged, removed, spawned, comboChanged, noMovesCandidate, terminal, blocked, specialReserved, specialImpact, specialBoardCommitted, hudStarsPrepared, hudStarArrived, meterRewardPrepared, meterRewardCommitted, directWildReserved, ordinarySpawnsPrepareRequested, ordinaryAssignmentsPrepared, ordinaryDestinationCleanupPrepared, ordinaryStackReserved, ordinarySixReserved, ordinaryPostcheckPrepared }
    public var kind: Kind
    public var tileIDs: [String]
    public var value: Int?
    public var archetype: NativeWildArchetype?
    public var reason: String?
    public var variant: String?
    public init(_ kind: Kind, tileIDs: [String] = [], value: Int? = nil, archetype: NativeWildArchetype? = nil, reason: String? = nil, variant: String? = nil) { self.variant = variant; self.kind = kind; self.tileIDs = tileIDs; self.value = value; self.archetype = archetype; self.reason = reason }
}
public struct NativeMoveResult: Sendable {
    public var accepted: Bool
    public var state: NativeBoardState
    public var events: [NativeGameplayEvent]
    public var resolution: NativeResolution
    public init(accepted: Bool, state: NativeBoardState, events: [NativeGameplayEvent], resolution: NativeResolution) { self.accepted = accepted; self.state = state; self.events = events; self.resolution = resolution }
}

public struct NativeWildRewardChoice: Equatable, Sendable {
    public let archetype: NativeWildArchetype
    public let variant: String?
    public init(_ archetype: NativeWildArchetype, variant: String? = nil) { self.archetype = archetype; self.variant = variant }
}

/// Immutable Special receipt. Targets and replacement faces are captured before any visual owner runs.
public struct NativeSpecialMovePlan: Equatable, Sendable {
    public let id: String
    public let generation: UInt64
    public let revision: UInt64
    public let archetype: NativeWildArchetype
    public let variant: String?
    public let source: NativeTile
    public let destination: NativeTile
    public let targets: [NativeTile]
    public let replacementValues: [Int]
}

/// Captured before the source's 80 ms absorb callback. Decorative release is a separate lease.
public struct NativeDirectWildMovePlan: Equatable, Sendable {
    public let id: String
    public let generation: UInt64
    public let revision: UInt64
    public let archetype: NativeWildArchetype
    public let variant: String?
    public let source: NativeTile
    public let destination: NativeTile
    public let startedAt: Double
    public let isFinal: Bool
}

/// Captured after the pulls converge. Cells and values cannot be redrawn by animation callbacks.
public struct NativeMagnetRespawnPlan: Equatable, Sendable {
    public let transactionID: String
    public let replacements: [NativeTile]
    public let survivor: NativeTile
    public let placeholders: [NativeTile]
}

/// One captured HUD flight awards score once at its authored arrival boundary.
public struct NativeHUDStarReceipt: Equatable, Sendable {
    public let id: String
    public let generation: UInt64
    public let origin: NativeCell
    public let ordinal: Int
    public let batchCount: Int
    public let variant: String?
}

extension NativeTile {
    private enum CodingKeys: String, CodingKey { case id,cell,value,stackDepth,starOrbitCount,archetype,variant,sourceWildStateCleared,sourceResidualWildPresence,locked,visible,alpha,pendingRemoval,transientSpawn,magnetOwned,resolutionOwned,merge6CleanupOwned,nonFinalMerge6 }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy:CodingKeys.self)
        self.init(id:try c.decode(String.self,forKey:.id),cell:try c.decode(NativeCell.self,forKey:.cell),value:try c.decode(Int.self,forKey:.value),
            stackDepth:try c.decodeIfPresent(Int.self,forKey:.stackDepth) ?? 1,starOrbitCount:try c.decodeIfPresent(Int.self,forKey:.starOrbitCount) ?? 3,
            archetype:try c.decodeIfPresent(NativeWildArchetype.self,forKey:.archetype),variant:try c.decodeIfPresent(String.self,forKey:.variant),sourceWildStateCleared:try c.decodeIfPresent(Bool.self,forKey:.sourceWildStateCleared) ?? false,sourceResidualWildPresence:try c.decodeIfPresent(Bool.self,forKey:.sourceResidualWildPresence) ?? false,
            locked:try c.decodeIfPresent(Bool.self,forKey:.locked) ?? false,visible:try c.decodeIfPresent(Bool.self,forKey:.visible) ?? true,alpha:try c.decodeIfPresent(Double.self,forKey:.alpha) ?? 1,
            pendingRemoval:try c.decodeIfPresent(Bool.self,forKey:.pendingRemoval) ?? false,transientSpawn:try c.decodeIfPresent(Bool.self,forKey:.transientSpawn) ?? false,
            magnetOwned:try c.decodeIfPresent(Bool.self,forKey:.magnetOwned) ?? false,resolutionOwned:try c.decodeIfPresent(Bool.self,forKey:.resolutionOwned) ?? false,
            merge6CleanupOwned:try c.decodeIfPresent(Bool.self,forKey:.merge6CleanupOwned) ?? false,nonFinalMerge6:try c.decodeIfPresent(Bool.self,forKey:.nonFinalMerge6) ?? false)
    }
}
extension NativeBoardState {
    private enum CodingKeys: String, CodingKey { case columns,rows,tiles,mode,board,stage,generation,revision,moves,maxMoves,score,starsCount,bestScore,maxStackDepth,longestCombo,cubesCracked,combo,earnedComboBonus,wildMeter,wildSpawnCount,lastWildDropType,wildDropTypeStreak,rngState,terminal,tutorial }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy:CodingKeys.self)
        self.init(columns:try c.decode(Int.self,forKey:.columns),rows:try c.decode(Int.self,forKey:.rows),tiles:try c.decode([NativeTile].self,forKey:.tiles),
            mode:try c.decode(NativeRunMode.self,forKey:.mode),board:try c.decode(Int.self,forKey:.board),stage:try c.decode(Int.self,forKey:.stage),
            generation:try c.decodeIfPresent(UInt64.self,forKey:.generation) ?? 1,revision:try c.decodeIfPresent(UInt64.self,forKey:.revision) ?? 0,
            moves:try c.decodeIfPresent(Int.self,forKey:.moves) ?? 50,maxMoves:try c.decodeIfPresent(Int.self,forKey:.maxMoves) ?? 50,
            score:try c.decodeIfPresent(Int.self,forKey:.score) ?? 0,starsCount:try c.decodeIfPresent(Int.self,forKey:.starsCount) ?? 0,bestScore:try c.decodeIfPresent(Int.self,forKey:.bestScore) ?? 0,
            maxStackDepth:try c.decodeIfPresent(Int.self,forKey:.maxStackDepth) ?? 1,longestCombo:try c.decodeIfPresent(Int.self,forKey:.longestCombo) ?? 0,cubesCracked:try c.decodeIfPresent(Int.self,forKey:.cubesCracked) ?? 0,
            combo:try c.decodeIfPresent(Int.self,forKey:.combo) ?? 0,earnedComboBonus:try c.decodeIfPresent(Int.self,forKey:.earnedComboBonus) ?? 0,wildMeter:try c.decodeIfPresent(Double.self,forKey:.wildMeter) ?? 0,
            wildSpawnCount:try c.decodeIfPresent(Int.self,forKey:.wildSpawnCount) ?? 0,lastWildDropType:try c.decodeIfPresent(NativeWildArchetype.self,forKey:.lastWildDropType),
            wildDropTypeStreak:try c.decodeIfPresent(Int.self,forKey:.wildDropTypeStreak) ?? 0,rngState:try c.decodeIfPresent(UInt64.self,forKey:.rngState) ?? 1,
            terminal:try c.decodeIfPresent(NativeResolution.self,forKey:.terminal),tutorial:try c.decodeIfPresent(NativeTutorialState.self,forKey:.tutorial))
    }
}

/// Captured delayed TNT charge; the source evaluates the active meter multiplier at arrival.
public struct NativeMeterRewardReceipt: Equatable, Sendable {
    public let id: String
    public let generation: UInt64
    public let transactionID: String
    public let impactIndex: Int
    public let base: Double
    public let delay: Double
}
