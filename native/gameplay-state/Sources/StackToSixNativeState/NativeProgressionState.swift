import Foundation
import StackToSixGameplay

public struct NativeSettingsPreferences: Codable, Equatable, Sendable {
    public var gameSoundsEnabled = false
    public var musicEnabled = true
    public var hapticsEnabled = true
    public init(gameSoundsEnabled: Bool = false, musicEnabled: Bool = true, hapticsEnabled: Bool = true) {
        self.gameSoundsEnabled = gameSoundsEnabled; self.musicEnabled = musicEnabled; self.hapticsEnabled = hapticsEnabled
    }
}
public struct NativeBoardStats: Codable, Equatable, Sendable {
    public var highScore = 0
    public var longestCombo = 0
    public var cubesCracked = 0
    public var timesPlayed = 0
    public var lastPlayed: TimeInterval = 0
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
    public var highestUnlockedJourneyBoard = 1
    public var lastOpenedJourneyBoard: Int?
    public var firstPlayTutorialComplete = false
    public var unlockedSpecialDice: Set<String> = []
    public init() {}
    private enum CodingKeys:String,CodingKey {case completedJourneyBoards,viewedJourneyBoards,boardStats,arcadeStats,highestUnlockedJourneyBoard,lastOpenedJourneyBoard,firstPlayTutorialComplete,unlockedSpecialDice}
    public init(from decoder:Decoder) throws {
        let fields=try decoder.container(keyedBy:CodingKeys.self)
        completedJourneyBoards=try fields.decode(Set<Int>.self,forKey:.completedJourneyBoards)
        viewedJourneyBoards=try fields.decode(Set<Int>.self,forKey:.viewedJourneyBoards)
        boardStats=try fields.decode([Int:NativeBoardStats].self,forKey:.boardStats)
        arcadeStats=try fields.decode(NativeArcadeStats.self,forKey:.arcadeStats)
        highestUnlockedJourneyBoard=try fields.decode(Int.self,forKey:.highestUnlockedJourneyBoard)
        lastOpenedJourneyBoard=try fields.decodeIfPresent(Int.self,forKey:.lastOpenedJourneyBoard)
        firstPlayTutorialComplete=try fields.decode(Bool.self,forKey:.firstPlayTutorialComplete)
        unlockedSpecialDice=try fields.decodeIfPresent(Set<String>.self,forKey:.unlockedSpecialDice) ?? []
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
    public mutating func beginAttempt(mode: NativeRunMode, board: Int, now: TimeInterval = Date().timeIntervalSince1970) {
        guard board >= 1 else { return }
        if mode == .journey {
            guard isPlayable(board: board) else { return }
            lastOpenedJourneyBoard = board
            var stats = boardStats[board] ?? NativeBoardStats()
            stats.timesPlayed += 1; stats.lastPlayed = now; boardStats[board] = stats
        } else {
            arcadeStats.highestStageOpened = max(arcadeStats.highestStageOpened, board)
            arcadeStats.lastPlayed = now
        }
    }
    /// Called once by the result owner for a committed attempt, never from animation completion.
    public mutating func finishAttempt(mode: NativeRunMode, board: Int, score: Int, longestCombo: Int, cubesCracked: Int, clean: Bool, now: TimeInterval = Date().timeIntervalSince1970) {
        guard board >= 1, score >= 0, longestCombo >= 0, cubesCracked >= 0 else { return }
        if mode == .arcade {
            arcadeStats.highScore = max(arcadeStats.highScore, score)
            arcadeStats.longestCombo = max(arcadeStats.longestCombo, longestCombo)
            arcadeStats.cubesCracked += cubesCracked; arcadeStats.lastPlayed = now
            if clean { arcadeStats.highestStageOpened = max(arcadeStats.highestStageOpened, board + 1) }
            return
        }
        guard (1...30).contains(board) else { return }
        var stats = boardStats[board] ?? NativeBoardStats()
        stats.highScore = max(stats.highScore, score); stats.longestCombo = max(stats.longestCombo, longestCombo)
        stats.cubesCracked += cubesCracked; stats.lastPlayed = now; boardStats[board] = stats
        if clean {
            completedJourneyBoards.insert(board)
            highestUnlockedJourneyBoard = max(highestUnlockedJourneyBoard, board)
        }
    }
}
