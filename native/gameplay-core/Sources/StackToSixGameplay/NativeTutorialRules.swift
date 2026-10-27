import Foundation

/// Pure tutorial policy. The UIKit overlay owns its transitions; ordinary completion cannot mark this run done.
public struct NativeTutorialState: Equatable, Codable, Sendable {
    public enum Step: Int, Codable, Sendable { case stack = 1, mergeSix, freePlay, special }
    public var encouragementAcknowledged: Bool?
    public var needsEncouragement: Bool { guideCompleted && !done && encouragementAcknowledged != true }
    public var rewardArchetype: NativeWildArchetype?
    public var rewardVariant: String?
    public var reward: NativeWildRewardChoice { .init(rewardArchetype ?? .star,variant:rewardVariant) }
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
    /// Optional fields retain compatibility with tutorial saves predating this guide.
    public var specialBarSuccessfulActions: Int?
    public var specialBarAcknowledged: Bool?
    public var specialBarReady: Bool { (specialBarSuccessfulActions ?? 0) >= 2 && specialBarAcknowledged != true }
    public var specialBarDefersReward: Bool { active && specialBarSuccessfulActions != nil && !waitingForWild && step != .special }
    public init() {}
    public var shouldLockHUD: Bool { active || requiresResultCompletion }
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
        if tutorial.step == .special { return tile.id == tutorial.wildTileID || isSpecialTarget(tile,rows:rows) }
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
            let srcWild = source.id == tutorial.wildTileID, dstWild = destination.id == tutorial.wildTileID
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

/// Transient original tutorial window flags. The owner identity is Native
/// cancellation metadata, never APP Math/save/gameplay state.
public struct NativeSourceTutorialWildReservation:Equatable,Sendable {
    public let ownerID:String,generation:UInt64
    public var cell:NativeCell
}
extension NativeTutorialRules {
    private static func sourceTutorialCellAvailable(_ cell:NativeCell,state:NativeBoardState,wildID:String?,destroyedIDs:Set<String>,emptyGridCells:Set<NativeCell>)->Bool {
        guard cell.column>=0,cell.column<state.columns,cell.row>=0,cell.row<state.rows else{return false}
        guard !emptyGridCells.contains(cell),let tile=state.tile(at:cell) else{return true}
        return tile.id==wildID || destroyedIDs.contains(tile.id) || tile.locked || (tile.value<=0 && tile.gameplayArchetype==nil)
    }
    private static func sourceTutorialTopCells(state:NativeBoardState,preferred:NativeCell)->[NativeCell] {
        var cells:[NativeCell]=[]
        for row in 0...min(1,state.rows-1){for column in 0..<state.columns{cells.append(.init(column:column,row:row))}}
        return cells.sorted{a,b in
            let da=abs(a.column-preferred.column)+abs(a.row-preferred.row),db=abs(b.column-preferred.column)+abs(b.row-preferred.row)
            return da != db ? da<db:a.row != b.row ? a.row<b.row:a.column<b.column
        }
    }
    /// Literal first-play-tutorial findFourthStepWildCell. The temporary grid
    /// hole at a genuine active drag origin participates in reservation; the
    /// app spawn's separate exclusion guard is applied only on revalidation.
    public static func sourceFourthWildCell(state:NativeBoardState,wildID:String?=nil,destroyedIDs:Set<String>=[],emptyGridCells:Set<NativeCell>=[])->NativeCell? {
        guard state.columns>0,state.rows>0 else{return nil}
        let available:(NativeCell)->Bool={sourceTutorialCellAvailable($0,state:state,wildID:wildID,destroyedIDs:destroyedIDs,emptyGridCells:emptyGridCells)}
        if let wildID,let wild=state.tiles.first(where:{$0.id==wildID}),wild.cell.row<=min(1,state.rows-1),available(wild.cell){return wild.cell}
        let preferred=NativeCell(column:state.columns/2,row:min(state.rows-1,1))
        if available(preferred){return preferred}
        if let cell=sourceTutorialTopCells(state:state,preferred:preferred).first(where:available){return cell}
        // Literal findEmptyishCell fallback differs from the top-row predicate:
        // it accepts any locked or value<=0 occupant, including special zero.
        if emptyGridCells.contains(preferred){return preferred}
        if let tile=state.tile(at:preferred) {
            if destroyedIDs.contains(tile.id) || tile.locked || tile.value<=0{return preferred}
        } else{return preferred}
        for radius in 1...max(state.columns,state.rows){
            for row in 0..<state.rows{for column in 0..<state.columns{
                let cell=NativeCell(column:column,row:row)
                guard abs(column-preferred.column)+abs(row-preferred.row)==radius else{continue}
                if emptyGridCells.contains(cell){return cell}
                guard let tile=state.tile(at:cell) else{return cell}
                if destroyedIDs.contains(tile.id) || tile.locked || tile.value<=0{return cell}
            }}
        }
        return preferred
    }
    /// Literal app-core forcedTutorialWildCell before the retry loop. Excludes
    /// the active drag origin and searches around the ORIGINAL reservation,
    /// not around a newly chosen middle cell. No random draw or displacement.
    public static func sourceResolveReservedWildCell(state:NativeBoardState,reserved:NativeCell,destroyedIDs:Set<String>=[],excluded:Set<NativeCell>=[])->NativeCell? {
        guard state.columns>0,state.rows>0 else{return nil}
        let preferred=NativeCell(column:max(0,min(state.columns-1,Int(Int32(truncatingIfNeeded:reserved.column)))),row:max(0,min(state.rows-1,Int(Int32(truncatingIfNeeded:reserved.row)))))
        let available:(NativeCell)->Bool={cell in !excluded.contains(cell) && sourceTutorialCellAvailable(cell,state:state,wildID:nil,destroyedIDs:destroyedIDs,emptyGridCells:[])}
        if available(preferred){return preferred}
        return sourceTutorialTopCells(state:state,preferred:preferred).first(where:available)
    }
    /// Literal fourth-step target priority and original roster-order fallback.
    /// Ordinary zero/locked fallback is intentional; preparation unlocks it.
    public static func sourceFourthTarget(state:NativeBoardState,wildID:String?,destroyedIDs:Set<String>=[])->(id:String,value:Int)? {
        let preferred=NativeCell(column:max(0,min(state.columns-1,state.columns/2)),row:min(state.rows-1,1))
        let rowLimit=min(state.rows-1,5)
        let regular=state.tiles.enumerated().filter { _,tile in
            tile.id != wildID && !destroyedIDs.contains(tile.id) && tile.gameplayArchetype==nil && tile.cell.row<=rowLimit
        }
        let candidates=regular.filter { _,tile in !tile.locked && tile.value>0 && tile.cell != preferred }.sorted { a,b in
            if (a.element.value==2) != (b.element.value==2){return a.element.value==2}
            if a.element.cell.row != b.element.cell.row{return a.element.cell.row<b.element.cell.row}
            if a.element.cell.column != b.element.cell.column{return a.element.cell.column<b.element.cell.column}
            return a.offset<b.offset
        }
        guard let target=candidates.first?.element ?? regular.first?.element else{return nil}
        let value=Int(Int32(truncatingIfNeeded:target.value))
        return (target.id,max(1,min(5,value==0 ? 4:value)))
    }

}

/// Transient same-object tutorial preparation identity; never a saved lock.
public struct NativeSourceTutorialFourthPreparationReceipt:Equatable,Sendable {
    public let ownerID:String,generation:UInt64,wildID:String,targetID:String
    public let wildCell:NativeCell,targetValue:Int
}
