import Foundation

/// Source: magnet-post-spawn-resolution.ts, magnet-pull-progress-decision.ts,
/// app-merge.ts forcedSpawnValues. These calculations do not acquire render ownership.
public enum NativeMagnetRules {
    public static func nearestPullTargets(state: NativeBoardState, source: NativeTile, destination: NativeTile) -> [NativeTile] {
        NativeGameplayResolver.magnetCandidates(state.tiles, source: source, destination: destination).enumerated().sorted { a, b in
            let ad = distanceSquared(a.element.cell, destination.cell), bd = distanceSquared(b.element.cell, destination.cell)
            return ad == bd ? a.offset < b.offset : ad < bd
        }.prefix(4).map(\.element)
    }
    public static func respawnCount(pulledCount: Int, hasTilesToRespawn: Bool) -> Int { hasTilesToRespawn ? max(0, pulledCount) : 0 }
    public static func respawnDelays(count: Int, intervalMs: Double = 150) -> [Double] { (0..<max(0,count)).map { Double($0) * max(0,intervalMs) } }
    public static func pullProgress(activeBeforePull: [NativeTile], mergeTile: NativeTile, pulledCount: Int) -> (addProgress: Bool, isLastMergeBeforePull: Bool) {
        let valid = (1...4).contains(pulledCount)
        let last = valid && activeBeforePull.count == 2 && activeBeforePull.contains { $0.id == mergeTile.id }
        return (valid && !last,last)
    }
    public static func forcedReplacementValues(count: Int, random: () -> Double) -> [Int] {
        guard (1...4).contains(count) else { return [] }
        if count == 1 { return [1 + randomIndex(3, random)] }
        if count == 2 { return [[1,5],[2,4],[3,3]][randomIndex(3,random)] }
        let options = count == 3 ? [[1,5,1],[2,4,2],[3,3,3],[1,1,4],[2,2,2],[1,2,3],[2,1,3],[1,3,2]] : [[1,5,2,4],[1,5,3,3],[2,4,3,3],[1,1,2,2],[1,2,2,1]]
        var values = options[randomIndex(options.count,random)]
        for i in stride(from:values.count-1,through:1,by:-1) { values.swapAt(i,randomIndex(i+1,random)) }
        return values
    }
    public static func emptyCells(state: NativeBoardState, excluding: Set<NativeCell> = []) -> [NativeCell] {
        var result: [NativeCell] = []
        for row in 0..<state.rows { for column in 0..<state.columns {
            let cell = NativeCell(column:column,row:row)
            guard !excluding.contains(cell) else { continue }
            if let tile = state.tile(at:cell) {
                if tile.value > 0 || tile.isWild || !tile.locked { continue }
            }
            result.append(cell)
        } }
        return result
    }
    private static func distanceSquared(_ a: NativeCell, _ b: NativeCell) -> Int { let dx = a.column-b.column,dy = a.row-b.row; return dx*dx+dy*dy }
    private static func randomIndex(_ count: Int, _ random: () -> Double) -> Int { let roll = random(); return min(count-1,max(0,Int((roll.isFinite ? roll : 0)*Double(count)))) }
}

/// Source: tnt-bonus-target-selection.ts and app-core.ts selectReplacementValue.
public enum NativeTntRules {
    public static func eligibleTargets(_ tiles: [NativeTile], excluding: Set<String> = []) -> [NativeTile] {
        tiles.filter { !$0.pendingRemoval && !excluding.contains($0.id) && !$0.isWild && (1...6).contains($0.value) }
    }
    public static func separatedTargets(_ candidates: [NativeTile], count: Int, random: () -> Double) -> [NativeTile] {
        var remaining = candidates
        let count = max(0,min(count,remaining.count))
        guard count > 0 else { return [] }
        let roll = random()
        let firstIndex = min(remaining.count-1,max(0,Int((roll.isFinite ? roll : 0)*Double(remaining.count))))
        var selected = [remaining.remove(at:firstIndex)]
        while selected.count < count && !remaining.isEmpty {
            var bestIndex = 0; var bestMinimumDistance = -1
            for (index,candidate) in remaining.enumerated() {
                let minimum = selected.map { target -> Int in
                    let dx = candidate.cell.column-target.cell.column,dy = candidate.cell.row-target.cell.row
                    return dx*dx+dy*dy
                }.min() ?? 0
                if minimum > bestMinimumDistance { bestIndex = index; bestMinimumDistance = minimum }
            }
            selected.append(remaining.remove(at:bestIndex))
        }
        return selected
    }
    public static func replacementValues(targets: [NativeTile], random: () -> Double) -> [Int] {
        var used: [Int] = []
        return targets.map { tile in
            var available = (1...5).filter { !used.contains($0) && $0 != tile.value }
            if available.isEmpty { available = (1...5).filter { $0 != tile.value } }
            let roll = random()
            let value = available[min(available.count-1,max(0,Int((roll.isFinite ? roll : 0)*Double(available.count))))]
            used.append(value); return value
        }
    }
    public static let progressPerImpact = 0.05
    public static let maximumTargets = 4
}

/// Source: wild-spawn-permission.ts, wild-meter-progress-decision.ts, app-core.ts addWildProgress.
public enum NativeWildMeterRules {
    public struct Permission: Equatable, Sendable {
        public enum Action: String, Sendable { case allow, block, retry }
        public let action: Action
        public let reason: String
        public let retryDelayMs: Int?
        public init(_ action: Action, _ reason: String, retryDelayMs: Int? = nil) { self.action = action; self.reason = reason; self.retryDelayMs = retryDelayMs }
    }
    public static func increment(base: Double, mode: NativeRunMode, board: Int, spawnCount: Int, fillRate: Double = 1, tutorialSlow: Bool = false) -> Double {
        let stage = max(1,board)
        let arcade: Double = mode == .journey ? 1 : stage <= 1 ? 1.15 : stage == 2 ? 1 : stage == 3 ? 0.9 : stage == 4 ? 0.8 : stage < 8 ? 0.7 : 0.6
        return max(0,base) * fillRate * (spawnCount >= 2 ? 0.6 : 1) * arcade * (tutorialSlow ? 0.05 : 1)
    }
    public static func permission(meter: Double, meterEnabled: Bool = true, spawnEnabled: Bool = true, spawnInProgress: Bool = false, busyEnding: Bool = false, boardTransition: Bool = false, failPending: Bool = false, lastMerge: Bool = false, animationBlock: String? = nil) -> Permission {
        if !meterEnabled { return Permission(.block,"wild-meter-disabled") }
        if !spawnEnabled { return Permission(.block,"wild-spawn-disabled") }
        if !meter.isFinite || meter < 1 - 0.000001 { return Permission(.block,"wild-meter-not-ready") }
        if spawnInProgress { return Permission(.block,"wild-spawn-in-progress") }
        if busyEnding { return Permission(.block,"busyEnding") }
        if boardTransition { return Permission(.block,"board-transition") }
        if failPending { return Permission(.block,"fail-screen-pending") }
        if lastMerge { return Permission(.block,"last-merge") }
        if let animationBlock { return Permission(.retry,animationBlock,retryDelayMs:["merge6-spawn-in-progress","board-settling"].contains(animationBlock) ? 80 : 220) }
        return Permission(.allow,"ready")
    }
    public static func progressAction(permission: Permission, confirmedNonFinal: Bool) -> (action: String, reason: String) {
        if permission.reason == "wild-meter-disabled" { return ("skip",permission.reason) }
        if permission.reason == "last-merge" { return confirmedNonFinal ? ("add","confirmed-non-final-merge") : ("reset","last-merge") }
        if permission.action == .block && permission.reason != "wild-spawn-disabled" { return ("skip",permission.reason) }
        return ("add",permission.reason)
    }
}
