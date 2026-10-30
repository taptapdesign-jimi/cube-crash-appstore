import Foundation
import StackToSixGameplay

public struct NativeSettingsPreferences: Codable, Equatable, Sendable {
    public var gameSoundsEnabled = true
    public var musicEnabled = true
    public var hapticsEnabled = true
    public init(gameSoundsEnabled: Bool = true, musicEnabled: Bool = true, hapticsEnabled: Bool = true) {
        self.gameSoundsEnabled = gameSoundsEnabled; self.musicEnabled = musicEnabled; self.hapticsEnabled = hapticsEnabled
    }
}
public struct NativeJourneyStatPoint: Codable, Equatable, Sendable {
    public let value:Int
    /// Nil only for a retained best imported from a save without result dates.
    public let date:TimeInterval?
    public init(value:Int,date:TimeInterval?){self.value=value;self.date=date}
    public static func recording(_ point:Self,in history:[Self]?,legacyBest:Int)->[Self] {
        var result=history ?? (legacyBest>0 ? [.init(value:legacyBest,date:nil)]:[])
        result.append(point)
        return Array(result.sorted {a,b in a.value != b.value ? a.value>b.value:(a.date ?? 0)>(b.date ?? 0)}.prefix(10))
    }
}

public struct NativeBoardStats: Codable, Equatable, Sendable {
    public var highScore = 0
    public var longestCombo = 0
    public var scoreHistory:[NativeJourneyStatPoint]?
    public var comboHistory:[NativeJourneyStatPoint]?
    public var cubesCracked = 0
    public var timesPlayed = 0
    public var lastPlayed: TimeInterval = 0
    /// Durable best COMPLETION award. Nil identifies pre-ranking saves only.
    public var awardedStars: Int?
    public var starRankingVersion: Int?
    public init() {}
}
public struct NativeArcadeStats: Codable, Equatable, Sendable {
    public var highScore = 0
    public var longestCombo = 0
    public var cubesCracked = 0
    public var highestStageOpened = 1
    public var lastPlayed: TimeInterval = 0
    public init() {}
}
/// Journey `unlocked` means completed artwork; `interim` is the next playable board.
/// Each World has its own interim, exactly as reconcileJourneyWorldInterims.
public struct NativeProgressionState: Codable, Equatable, Sendable {
    public var completedJourneyBoards: Set<Int> = []
    public var viewedJourneyBoards: Set<Int> = []
    public var boardStats: [Int: NativeBoardStats] = [:]
    public var arcadeStats = NativeArcadeStats()
    public var arcadeVariantStats: [String: NativeArcadeStats] = [:]
    public func arcadeStats(for variant: NativeArcadeVariant) -> NativeArcadeStats {
        variant == .endurance ? arcadeStats : (arcadeVariantStats[variant.rawValue] ?? NativeArcadeStats())
    }
    public mutating func resetArcadeStats(for variant: NativeArcadeVariant) {
        if variant == .endurance { arcadeStats = .init() } else { arcadeVariantStats.removeValue(forKey: variant.rawValue) }
    }
    private mutating func setArcadeStats(_ stats: NativeArcadeStats, for variant: NativeArcadeVariant) {
        if variant == .endurance { arcadeStats = stats } else { arcadeVariantStats[variant.rawValue] = stats }
    }
    public var highestUnlockedJourneyBoard = 1
    public var lastOpenedJourneyBoard: Int?
    public var firstPlayTutorialComplete = false
    public var unlockedSpecialDice: Set<String> = []
    public private(set) var announcedJourneyDice: Set<String> = []
    public private(set) var unreadJourneyDice: Set<String> = []
    /// A landed eligible Journey die is the only producer; detail opening or a completed collection visit to its visible card consumes unread state.
    @discardableResult public mutating func announceJourneyDie(_ id:String,board:Int)->Bool {
        guard NativeJourneyContent.worldRewardPool(board:board).contains(id),
              announcedJourneyDice.insert(id).inserted else{return false}
        unreadJourneyDice.insert(id);return true
    }
    public mutating func readJourneyDie(_ id:String){unreadJourneyDice.remove(id)}
    /// DEV Hide re-arms only the die introduced by the selected Unit.
    public mutating func resetDeveloperJourneyDieAnnouncement(board:Int) {
        guard let id=NativeJourneyContent.introductionID(board:board) else{return}
        announcedJourneyDice.remove(id)
        unreadJourneyDice.remove(id)
    }
    public private(set) var wildStarUnlocked = false
    public init() {}
    private enum CodingKeys:String,CodingKey {case completedJourneyBoards,viewedJourneyBoards,boardStats,arcadeStats,arcadeVariantStats,highestUnlockedJourneyBoard,lastOpenedJourneyBoard,firstPlayTutorialComplete,unlockedSpecialDice,wildStarUnlocked,announcedJourneyDice,unreadJourneyDice}
    public init(from decoder:Decoder) throws {
        let fields=try decoder.container(keyedBy:CodingKeys.self)
        completedJourneyBoards=try fields.decode(Set<Int>.self,forKey:.completedJourneyBoards)
        viewedJourneyBoards=try fields.decode(Set<Int>.self,forKey:.viewedJourneyBoards)
        boardStats=try fields.decode([Int:NativeBoardStats].self,forKey:.boardStats)
        arcadeStats=try fields.decode(NativeArcadeStats.self,forKey:.arcadeStats)
        arcadeVariantStats=try fields.decodeIfPresent([String:NativeArcadeStats].self,forKey:.arcadeVariantStats) ?? [:]
        highestUnlockedJourneyBoard=try fields.decode(Int.self,forKey:.highestUnlockedJourneyBoard)
        lastOpenedJourneyBoard=try fields.decodeIfPresent(Int.self,forKey:.lastOpenedJourneyBoard)
        firstPlayTutorialComplete=try fields.decode(Bool.self,forKey:.firstPlayTutorialComplete)
        unlockedSpecialDice=try fields.decodeIfPresent(Set<String>.self,forKey:.unlockedSpecialDice) ?? []
        wildStarUnlocked=try fields.decodeIfPresent(Bool.self,forKey:.wildStarUnlocked) ?? false
        unreadJourneyDice=try fields.decodeIfPresent(Set<String>.self,forKey:.unreadJourneyDice) ?? []
        if let known=try fields.decodeIfPresent(Set<String>.self,forKey:.announcedJourneyDice) {announcedJourneyDice=known}
        else {
            // Older progression fields describe eligibility, never an actual drop.
            // Retain any explicit unread receipt, but do not invent discoveries
            // from opened/completed Units or legacy special-die unlock thresholds.
            announcedJourneyDice=unreadJourneyDice
        }
        // Freeze old earned stars before the new score thresholds can reinterpret
        // a collection. Never infer an award for an unfinished/failed board.
        for board in completedJourneyBoards where (1...30).contains(board) {
            var stats=boardStats[board] ?? NativeBoardStats()
            if stats.awardedStars == nil {
                stats.awardedStars=max(1,NativeJourneyContent.legacyEarnedStars(score:stats.highScore,board:board))
                stats.starRankingVersion=0
                boardStats[board]=stats
            }
        }
    }
    public func journeyStars(board:Int)->Int {
        guard (1...30).contains(board),completedJourneyBoards.contains(board) else{return 0}
        let stats=boardStats[board] ?? NativeBoardStats()
        return max(1,min(3,stats.awardedStars ?? NativeJourneyContent.legacyEarnedStars(score:stats.highScore,board:board)))
    }
    /// Star begins at Forest Unit2; completing Unit1 reaches that unlock. Default interim Unit1,
    /// tutorial completion, Arcade progress and other Worlds do not grant Star.
    /// The optional latch preserves legacy evidence across later World changes.
    public var hasUnlockedWildStar:Bool {
        wildStarUnlocked || completedJourneyBoards.contains(where:{(1...10).contains($0)}) ||
        boardStats.contains(where:{(2...10).contains($0.key) && $0.value.timesPlayed>0}) ||
        lastOpenedJourneyBoard.map{(2...10).contains($0)} == true ||
        (2...10).contains(highestUnlockedJourneyBoard)
    }
    /// DEV card removal revokes the latch too; normal progression never does.
    public mutating func reconcileDeveloperWildStarUnlock() {
        wildStarUnlocked = false
        wildStarUnlocked = hasUnlockedWildStar
    }
    public func interimBoard(world: Int) -> Int? {
        guard (1...3).contains(world) else { return nil }
        let range = ((world - 1) * 10 + 1)...(world * 10)
        guard !range.allSatisfy(completedJourneyBoards.contains) else { return nil }
        let highest = range.filter(completedJourneyBoards.contains).max() ?? (range.lowerBound - 1)
        return range.first { !completedJourneyBoards.contains($0) && $0 > highest }
            ?? range.first { !completedJourneyBoards.contains($0) }
    }
    public func isPlayable(board: Int) -> Bool {
        (1...30).contains(board) && (completedJourneyBoards.contains(board) || interimBoard(world: (board - 1) / 10 + 1) == board)
    }
    public mutating func markViewed(board: Int) { if (1...30).contains(board) { viewedJourneyBoards.insert(board) } }
    public mutating func beginAttempt(mode: NativeRunMode, board: Int, arcadeVariant: NativeArcadeVariant = .endurance, now: TimeInterval = Date().timeIntervalSince1970) {
        guard board >= 1 else { return }
        if mode == .journey {
            guard isPlayable(board: board) else { return }
            wildStarUnlocked = hasUnlockedWildStar || (2...10).contains(board)
            lastOpenedJourneyBoard = board
            var stats = boardStats[board] ?? NativeBoardStats()
            stats.timesPlayed += 1; stats.lastPlayed = now; boardStats[board] = stats
        } else {
            wildStarUnlocked = hasUnlockedWildStar
            var stats = arcadeStats(for: arcadeVariant)
            stats.highestStageOpened = max(stats.highestStageOpened, board)
            stats.lastPlayed = now
            setArcadeStats(stats, for: arcadeVariant)
        }
    }
    /// Called once by the result owner for a committed attempt, never from animation completion.
    public mutating func finishAttempt(mode: NativeRunMode, board: Int, score: Int, longestCombo: Int, cubesCracked: Int, clean: Bool, arcadeVariant: NativeArcadeVariant = .endurance, now: TimeInterval = Date().timeIntervalSince1970) {
        guard board >= 1, score >= 0, longestCombo >= 0, cubesCracked >= 0 else { return }
        if mode == .arcade {
            wildStarUnlocked = hasUnlockedWildStar
            var stats = arcadeStats(for: arcadeVariant)
            stats.highScore = max(stats.highScore, score)
            stats.longestCombo = max(stats.longestCombo, longestCombo)
            stats.cubesCracked += cubesCracked; stats.lastPlayed = now
            if clean { stats.highestStageOpened = max(stats.highestStageOpened, board + 1) }
            setArcadeStats(stats, for: arcadeVariant)
            return
        }
        // A failed Journey attempt has no result statistics. beginAttempt already
        // records the visit; result cleanup still retires its checkpoint normally.
        guard clean,(1...30).contains(board) else { return }
        let previousStars=journeyStars(board:board)
        wildStarUnlocked = hasUnlockedWildStar || (2...10).contains(board)
        var stats = boardStats[board] ?? NativeBoardStats()
        stats.awardedStars=max(previousStars,NativeJourneyContent.earnedStars(score:score,board:board,completed:clean))
        stats.starRankingVersion=NativeJourneyContent.starRankingVersion
        stats.scoreHistory=NativeJourneyStatPoint.recording(.init(value:score,date:now),in:stats.scoreHistory,legacyBest:stats.highScore)
        stats.comboHistory=NativeJourneyStatPoint.recording(.init(value:longestCombo,date:now),in:stats.comboHistory,legacyBest:stats.longestCombo)
        stats.highScore = max(stats.highScore, score); stats.longestCombo = max(stats.longestCombo, longestCombo)
        stats.cubesCracked += cubesCracked; stats.lastPlayed = now; boardStats[board] = stats
        if clean {
            completedJourneyBoards.insert(board)
            highestUnlockedJourneyBoard = max(highestUnlockedJourneyBoard, board)
        }
    }
}
