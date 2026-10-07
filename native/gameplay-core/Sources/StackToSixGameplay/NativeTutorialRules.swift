import Foundation

/// Pure tutorial policy. The UIKit overlay owns its transitions; ordinary completion cannot mark this run done.
public struct NativeTutorialState: Equatable, Codable, Sendable {
    public enum Step: Int, Codable, Sendable { case stack = 1, mergeSix, freePlay, special }
    public var active = true
    public var step: Step = .stack
    public var guidedPair: [String] = []
    public var oneTileID: String?
    public var waitingForWild = false
    public var wildTileID: String?
    public var guideCompleted = false
    public var completionAssist = false
    public var done = false
    public var finalChanceSpawnCount = 0
    public init() {}
    public var shouldLockHUD: Bool { active }
    public var requiresResultCompletion: Bool { guideCompleted && !done }
    public var usesLowValues: Bool { active || completionAssist }
    public var meterMultiplier: Double { completionAssist ? 0.05 : 1 }
}
public enum NativeTutorialRules {
    public static func guidedCells(columns: Int, rows: Int) -> (three: NativeCell, two: NativeCell, one: NativeCell) {
        let centerRow = max(0,min(rows-3,rows/2-1))
        let left = max(0,min(columns-3,columns/2-1))
        return (NativeCell(column:left,row:centerRow),NativeCell(column:max(2,min(columns-1,left+2)),row:max(2,min(rows-1,centerRow+2))),NativeCell(column:max(0,columns-2),row:min(rows-1,1)))
    }
    public static func allowsPickup(_ tile: NativeTile, tutorial: NativeTutorialState?, rows: Int) -> Bool {
        guard let tutorial, tutorial.active else { return true }
        if tutorial.step == .freePlay { return true }
        if tutorial.step == .special { return tile.gameplayArchetype == .star || isSpecialTarget(tile,rows:rows) }
        return tutorial.guidedPair.contains(tile.id)
    }
    public static func allowsDrop(source: NativeTile, destination: NativeTile, tutorial: NativeTutorialState?, rows: Int) -> Bool {
        guard let tutorial, tutorial.active else { return true }
        switch tutorial.step {
        case .stack, .mergeSix:
            guard tutorial.guidedPair.count == 2, Set([source.id,destination.id]) == Set(tutorial.guidedPair) else { return false }
            return [source.value,destination.value].sorted() == (tutorial.step == .stack ? [2,3] : [1,5])
        case .freePlay: return true
        case .special:
            let srcWild = source.gameplayArchetype == .star, dstWild = destination.gameplayArchetype == .star
            return srcWild != dstWild && isSpecialTarget(srcWild ? destination : source,rows:rows)
        }
    }
    public static func isSpecialTarget(_ tile: NativeTile, rows: Int) -> Bool { tile.isPlayable && !tile.isWild && tile.value > 0 && tile.cell.row <= min(rows-1,5) }
    public static func preferredWildCell(state: NativeBoardState) -> NativeCell? {
        let preferred = NativeCell(column:max(0,min(state.columns-1,state.columns/2)),row:min(state.rows-1,1))
        var cells: [NativeCell] = []
        for row in 0...min(state.rows-1,1) { for column in 0..<state.columns { cells.append(NativeCell(column:column,row:row)) } }
        cells.sort { a,b in
            let da = abs(a.column-preferred.column)+abs(a.row-preferred.row), db = abs(b.column-preferred.column)+abs(b.row-preferred.row)
            return da != db ? da < db : a.row != b.row ? a.row < b.row : a.column < b.column
        }
        return cells.first { cell in guard let tile = state.tile(at:cell) else { return true }; return tile.locked || (!tile.isWild && tile.value <= 0) }
    }
    public static func lowValue(excluding: Int? = nil, roll: Double) -> Int {
        let weighted: [Int] = [1,1,1,1,1,2,2,2,2,2,3]
        let pool: [Int] = weighted.filter { value in excluding == nil || value != excluding! }
        let boundedRoll = roll.isFinite ? max(0,min(1-Double.ulpOfOne,roll)) : 0
        let index = min(pool.count-1,max(0,Int(boundedRoll*Double(pool.count))))
        return pool[index]
    }
    public static func finalChanceValue(state: NativeBoardState) -> Int? {
        guard state.tutorial?.completionAssist == true, (state.tutorial?.finalChanceSpawnCount ?? 99) < 99 else { return nil }
        guard let highest = state.activeTiles.filter({ !$0.isWild && !$0.locked && (1...5).contains($0.value) }).max(by: { $0.value < $1.value }) else { return nil }
        return max(1,min(5,6-highest.value))
    }
}
