import Foundation
import CoreFoundation
import StackToSixGameplay

/// Import receives an explicit export made INSIDE the separate Native app sandbox.
/// It never discovers/opens WKWebView databases, external app containers or PWA data.
public enum NativeHybridImporter {
    public static func importExport(_ data: Data, columns:Int=5,rows:Int=9, now: TimeInterval = Date().timeIntervalSince1970) throws -> NativeSaveEnvelope {
        guard let root=try JSONSerialization.jsonObject(with:data) as? [String:Any],root["product"] as? String == "com.taptapdesign.stacktosix.native",let storage=root["storage"] as? [String:String] else { throw NativeSaveError.wrongProduct }
        func object(_ key:String) throws -> [String:Any]? {
            guard let text=storage[key],let bytes=text.data(using:.utf8) else { return nil }
            guard let object=try JSONSerialization.jsonObject(with:bytes) as? [String:Any] else { throw NativeSaveError.invalidState(["invalid-legacy-object:\(key)"]) };return object
        }
        func array(_ key:String) throws -> [Any]? {
            guard let text=storage[key],let bytes=text.data(using:.utf8) else { return nil }
            guard let object=try JSONSerialization.jsonObject(with:bytes) as? [Any] else { throw NativeSaveError.invalidState(["invalid-legacy-array:\(key)"]) };return object
        }
        var result=NativeSaveEnvelope(importedHybrid:true);result.savedAt=now
        result.progression.firstPlayTutorialComplete=storage["cc_first_play_tutorial_done"] == "true"
        result.progression.unlockedSpecialDice=Set(["flower","juice"].filter{storage["cc_special_dice_unlocked_\($0)"] == "true"})
        if let settings=try object("cc_settings") {
            result.settings=NativeSettingsPreferences(gameSoundsEnabled:settings["gameSoundsEnabled"] as? Bool == true,musicEnabled:settings["musicEnabled"] as? Bool != false,hapticsEnabled:settings["hapticsEnabled"] as? Bool != false)
        }
        if let boards=try array("journey_boards_state") {
            for entry in boards {
                guard let raw=entry as? [String:Any],let id=raw["id"] as? Int,(1...30).contains(id) else { throw NativeSaveError.invalidState(["invalid-legacy-journey-board"]) }
                if raw["unlocked"] as? Bool == true { result.progression.completedJourneyBoards.insert(id) }
            }
        }
        if let viewed=try array("journey_viewed_boards") {
            result.progression.viewedJourneyBoards=Set(viewed.compactMap { value in (value as? Int) ?? (value as? String).flatMap(Int.init) }.filter {(1...30).contains($0)})
        }
        if let highest=storage["journey_highest_unlocked_board_id"].flatMap(Int.init),highest > 0 { result.progression.highestUnlockedJourneyBoard=highest }
        if let last=storage["journey_last_opened_board_id"].flatMap(Int.init),(1...30).contains(last) { result.progression.lastOpenedJourneyBoard=last }
        if let stats=try object("cc_board_stats_v1") {
            for (key,value) in stats {
                guard let board=Int(key),(1...30).contains(board),let raw=value as? [String:Any] else { throw NativeSaveError.invalidState(["invalid-legacy-board-stats"]) }
                var stat=NativeBoardStats();stat.highScore=try counter(raw,"highScore");stat.longestCombo=try counter(raw,"longestCombo");stat.cubesCracked=try counter(raw,"cubesCracked");stat.timesPlayed=try counter(raw,"timesPlayed");stat.lastPlayed=(raw["lastPlayed"] as? Double ?? 0)/1000
                result.progression.boardStats[board]=stat
            }
        }
        if let raw=try object("cc_arcade_stats_v1") {
            result.progression.arcadeStats.highScore=try counter(raw,"highScore");result.progression.arcadeStats.longestCombo=try counter(raw,"longestCombo");result.progression.arcadeStats.cubesCracked=try counter(raw,"cubesCracked");result.progression.arcadeStats.highestStageOpened=max(1,try counter(raw,"highestStageOpened"));result.progression.arcadeStats.lastPlayed=(raw["lastPlayed"] as? Double ?? 0)/1000
        }
        let completedReceipt=try object("cc_board_completed")
        for board in 1...30 {
            let suffix=String(format:"%02d",board)
            let tombstone=storage["cc_journey_completed_board_\(suffix)"] == "1"
            let receipt=completedReceipt?["completedLevel"] as? Int == board && completedReceipt?["nextLevel"] as? Int == board+1
            guard !tombstone && !receipt,let raw=try object("cc_saved_game_board_\(suffix)") else {continue}
            let run=try decodeBoard(raw,mode:.journey,expectedBoard:board,columns:columns,rows:rows)
            result.journeyRuns[board]=run;result.journeyRunSavedAt[board]=(raw["timestamp"] as? Double ?? 0)/1000
        }
        if let raw=try object("cc_arcade_run_state_v1") {
            let board=try counter(raw,"boardNumber",fallback:try counter(raw,"level",fallback:1))
            result.arcadeRun=try decodeBoard(raw,mode:.arcade,expectedBoard:board,columns:columns,rows:rows);result.arcadeRunSavedAt=(raw["timestamp"] as? Double ?? 0)/1000
        }
        if let pending=try object("cc_arcade_pending_round_v1") {
            let round=try counter(pending,"round")
            guard round>=1 else {throw NativeSaveError.invalidState(["invalid-pending-arcade-round"])}
            result.pendingArcadeRound=NativePendingArcadeRound(round:round,score:try counter(pending,"score"),ownerID:pending["ownerId"] as? String)
        }
        try result.validate();return result
    }
    private static func counter(_ raw:[String:Any],_ key:String,fallback:Int=0) throws -> Int {
        guard let value=raw[key] else {return fallback}
        guard let number=value as? NSNumber,CFGetTypeID(number) != CFBooleanGetTypeID(),number.doubleValue.isFinite,number.doubleValue>=0,number.doubleValue<=Double(Int.max),number.doubleValue.rounded(.towardZero)==number.doubleValue else {throw NativeSaveError.invalidState(["invalid-legacy-counter:\(key)"])}
        return number.intValue
    }
    private static func decodeBoard(_ raw:[String:Any],mode:NativeRunMode,expectedBoard:Int,columns:Int,rows:Int) throws -> NativeBoardState {
        let version=try counter(raw,"schemaVersion",fallback:1)
        guard (1...2).contains(version) else {throw NativeSaveError.unsupportedVersion(version)}
        let board=try counter(raw,"boardNumber",fallback:try counter(raw,"level",fallback:1))
        var sourceGrid=raw["grid"] as? [[Any]]
        if (sourceGrid == nil || sourceGrid!.isEmpty),let legacy=raw["tiles"] as? [[String:Any]] {
            guard columns>0,rows>0,columns*rows<=4096 else {throw NativeSaveError.invalidState(["invalid-legacy-dimensions"])}
            var grid=[[Any]](repeating:[Any](repeating:NSNull(),count:columns),count:rows)
            for tile in legacy where tile["destroyed"] as? Bool != true {
                guard let c=tile["gridX"] as? Int,let r=tile["gridY"] as? Int,c>=0,c<columns,r>=0,r<rows,grid[r][c] is NSNull else {throw NativeSaveError.invalidState(["duplicate-or-out-of-bounds-legacy-cell"])}
                grid[r][c]=tile
            }
            sourceGrid=grid
        }
        guard board==expectedBoard,let grid=sourceGrid,!grid.isEmpty,let first=grid.first,!first.isEmpty,grid.allSatisfy({$0.count==first.count}) else {throw NativeSaveError.invalidState(["invalid-legacy-grid"])}
        var tiles:[NativeTile]=[]
        for row in grid.indices { for column in grid[row].indices {
            let value=grid[row][column];if value is NSNull {continue}
            guard let tile=value as? [String:Any] else {throw NativeSaveError.invalidState(["invalid-legacy-tile"])}
            if let x=tile["gridX"] as? Int,x != column {throw NativeSaveError.invalidState(["legacy-coordinate-mismatch"])}
            if let y=tile["gridY"] as? Int,y != row {throw NativeSaveError.invalidState(["legacy-coordinate-mismatch"])}
            let number=try counter(tile,"value")
            let rawSpecial=tile["special"] as? String
            let special=rawSpecial=="wild-beer" ? "wild-juice" : rawSpecial
            let archetype=special.flatMap(NativeWildArchetype.init(rawValue:))
            if special != nil && archetype == nil {throw NativeSaveError.invalidState(["unknown-legacy-special"])}
            let locked=tile["locked"] as? Bool == true
            if let open=tile["open"] as? Bool,open==locked {throw NativeSaveError.invalidState(["legacy-lock-open-conflict"])}
            let variant=tile["specialDiceVariant"] as? String ?? tile["_ccSpecialDiceVariant"] as? String
            if let variant {
                guard let definition=NativeSpecialDiceRegistry.variants[variant],definition.archetype==archetype || (variant=="beach-ball" && (archetype == .juice || archetype == .magnet)) else {throw NativeSaveError.invalidState(["legacy-variant-archetype-mismatch"])}
            }
            tiles.append(NativeTile(id:"import-\(mode.rawValue)-\(board)-\(row)-\(column)",cell:NativeCell(column:column,row:row),value:number,archetype:archetype,variant:variant,locked:locked))
        } }
        let bonus=raw["runComboBonus"] as? [String:Any]
        let meter=raw["wildMeter"] as? Double ?? 0
        guard meter.isFinite,(0...10).contains(meter) else {throw NativeSaveError.invalidState(["invalid-legacy-wild-meter"])}
        return NativeBoardState(columns:first.count,rows:grid.count,tiles:tiles,mode:mode,board:board,stage:board,moves:try counter(raw,"moves",fallback:50),score:try counter(raw,"score"),starsCount:try counter(raw,"starsCount"),bestScore:try counter(raw,"bestScore"),maxStackDepth:try counter(raw,"maxStackDepth",fallback:1),longestCombo:try counter(raw,"longestCombo"),cubesCracked:try counter(raw,"cubesCracked"),earnedComboBonus:bonus?["version"] as? Int == 1 ? min(999999,try counter(bonus ?? [:],"earnedBonus")) : 0,wildMeter:meter,wildSpawnCount:try counter(raw,"wildSpawnCount"),rngState:UInt64(max(1,board)))
    }
}
