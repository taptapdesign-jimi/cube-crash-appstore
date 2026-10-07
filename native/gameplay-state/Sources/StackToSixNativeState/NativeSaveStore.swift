import Foundation
import StackToSixGameplay

public enum NativeSaveError: Error, Equatable { case unsupportedVersion(Int), wrongProduct, invalidState([String]), requiresLegacyImport, corruptSave }
public struct NativePendingArcadeRound: Codable, Equatable, Sendable {
    public var round: Int
    public var score: Int
    public var ownerID: String?
    public init(round:Int,score:Int,ownerID:String?=nil) {self.round=round;self.score=score;self.ownerID=ownerID}
}
public struct NativeSaveEnvelope: Codable, Equatable, Sendable {
    public static let currentVersion = 1
    public var version = currentVersion
    public var product = "com.taptapdesign.stacktosix.native"
    public var savedAt = Date().timeIntervalSince1970
    public var settings: NativeSettingsPreferences
    public var progression: NativeProgressionState
    public var journeyRuns: [Int: NativeBoardState]
    public var arcadeRun: NativeBoardState?
    public var pendingArcadeRound: NativePendingArcadeRound?
    public var journeyRunSavedAt: [Int: TimeInterval] = [:]
    public var arcadeRunSavedAt: TimeInterval?
    public var importedHybrid: Bool
    public init(settings: NativeSettingsPreferences = .init(), progression: NativeProgressionState = .init(), journeyRuns: [Int: NativeBoardState] = [:], arcadeRun: NativeBoardState? = nil, importedHybrid: Bool = false) {
        self.settings = settings; self.progression = progression; self.journeyRuns = journeyRuns; self.arcadeRun = arcadeRun; self.importedHybrid = importedHybrid
    }
    private enum CodingKeys:String,CodingKey {case version,product,savedAt,settings,progression,journeyRuns,arcadeRun,pendingArcadeRound,journeyRunSavedAt,arcadeRunSavedAt,importedHybrid}
    public init(from decoder:Decoder) throws {
        let fields=try decoder.container(keyedBy:CodingKeys.self)
        // Identity and schema remain required. Only additive Native-v1 fields
        // have compatibility defaults; malformed present fields still throw.
        version=try fields.decode(Int.self,forKey:.version)
        product=try fields.decode(String.self,forKey:.product)
        guard product=="com.taptapdesign.stacktosix.native" else {throw NativeSaveError.wrongProduct}
        guard version==Self.currentVersion else {throw NativeSaveError.unsupportedVersion(version)}
        savedAt=try fields.decode(TimeInterval.self,forKey:.savedAt)
        settings=try fields.decode(NativeSettingsPreferences.self,forKey:.settings)
        progression=try fields.decode(NativeProgressionState.self,forKey:.progression)
        journeyRuns=try fields.decode([Int:NativeBoardState].self,forKey:.journeyRuns)
        arcadeRun=try fields.decodeIfPresent(NativeBoardState.self,forKey:.arcadeRun)
        pendingArcadeRound=try fields.decodeIfPresent(NativePendingArcadeRound.self,forKey:.pendingArcadeRound)
        journeyRunSavedAt=try fields.decodeIfPresent([Int:TimeInterval].self,forKey:.journeyRunSavedAt) ?? [:]
        arcadeRunSavedAt=try fields.decodeIfPresent(TimeInterval.self,forKey:.arcadeRunSavedAt)
        importedHybrid=try fields.decode(Bool.self,forKey:.importedHybrid)
    }
    public func validate() throws {
        guard product == "com.taptapdesign.stacktosix.native" else { throw NativeSaveError.wrongProduct }
        guard version == Self.currentVersion else { throw NativeSaveError.unsupportedVersion(version) }
        var issues: [String] = []
        if !progression.unlockedSpecialDice.allSatisfy({["flower","juice"].contains($0)}) {issues.append("invalid-special-unlock")}
        if !savedAt.isFinite || !journeyRunSavedAt.allSatisfy({(1...30).contains($0.key) && $0.value.isFinite && $0.value >= 0}) || arcadeRunSavedAt.map({!$0.isFinite || $0 < 0}) == true || !progression.completedJourneyBoards.allSatisfy({(1...30).contains($0)}) || !progression.viewedJourneyBoards.allSatisfy({(1...30).contains($0)}) { issues.append("invalid-progression") }
        for (key, board) in journeyRuns {
            if key != board.board || board.mode != .journey || !(1...30).contains(key) { issues.append("journey-run-mode-mismatch") }
            issues += Self.boardIssues(board)
        }
        if let board = arcadeRun {
            if board.mode != .arcade { issues.append("arcade-run-mode-mismatch") }
            issues += Self.boardIssues(board)
        }
        if let pending=pendingArcadeRound,pending.round < 1 || pending.score < 0 {issues.append("invalid-pending-arcade-round")}
        if !issues.isEmpty { throw NativeSaveError.invalidState(issues) }
    }
    /// Runtime record admission shares the exact durable-document validator.
    /// Protected hero/reservation phases must retain the last coherent save.
    public static func isCoherentRun(_ board:NativeBoardState)->Bool {boardIssues(board).isEmpty}
    private static func boardIssues(_ board: NativeBoardState) -> [String] {
        var issues = board.validationIssues()
        if board.board < 1 || board.wildSpawnCount < 0 || board.earnedComboBonus < 0 { issues.append("invalid-board-counter") }
        if board.tiles.contains(where: { $0.pendingRemoval || $0.transientSpawn || $0.magnetOwned || $0.resolutionOwned || $0.merge6CleanupOwned || (!$0.isWild && $0.value == 6) || ($0.isWild && $0.value != 6) || ($0.value == 0 && !$0.locked) || (!$0.locked && (!$0.visible || $0.alpha <= 0.01)) }) { issues.append("transient-or-incoherent-save") }
        return issues
    }
    public func resumedRun(mode: NativeRunMode, board: Int, now: TimeInterval = Date().timeIntervalSince1970) -> NativeBoardState? {
        let timestamp = mode == .journey ? (journeyRunSavedAt[board] ?? savedAt) : (arcadeRunSavedAt ?? savedAt)
        guard now - timestamp < 7 * 24 * 60 * 60, now >= timestamp - 60 else { return nil }
        guard var run = mode == .journey ? journeyRuns[board] : arcadeRun, run.board == board else { return nil }
        run.combo = 0 // Earned current-attempt reward survives; live timing streak does not.
        run.generation &+= 1; run.revision &+= 1
        return run
    }
}
/// One atomic document owns preferences, progress and both mode saves. No PWA paths or defaults domains.
/// A previous coherent document is the only recovery fallback; never merge partial saves.
public final class NativeSaveStore {
    public let directory: URL
    private let legacyLibrary: URL?
    private var successfulContent: Data?
    private var successfulSerialized: Data?
    public init(directory: URL, legacyLibrary: URL? = nil) { self.directory = directory; self.legacyLibrary = legacyLibrary }
    public static func applicationStore() throws -> NativeSaveStore {
        guard Bundle.main.bundleIdentifier == "com.taptapdesign.stacktosix.native" else { throw NativeSaveError.wrongProduct }
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return NativeSaveStore(directory: support.appendingPathComponent("StackToSixNative", isDirectory: true), legacyLibrary: support.deletingLastPathComponent())
    }
    private var primary: URL { directory.appendingPathComponent("state-v1.json") }
    private var backup: URL { directory.appendingPathComponent("state-v1.previous.json") }
    private func decode(_ url: URL) throws -> NativeSaveEnvelope {
        let value = try JSONDecoder().decode(NativeSaveEnvelope.self, from: Data(contentsOf: url))
        try value.validate(); return value
    }
    public func load() throws -> NativeSaveEnvelope? {
        if FileManager.default.fileExists(atPath: primary.path) {
            do { return try decode(primary) }
            catch NativeSaveError.unsupportedVersion(let version) { throw NativeSaveError.unsupportedVersion(version) }
            catch NativeSaveError.wrongProduct { throw NativeSaveError.wrongProduct }
            catch { if let previous = try? decode(backup) { return previous }; throw NativeSaveError.corruptSave }
        }
        if let previous = try? decode(backup) { return previous }
        if let legacyLibrary {
            let legacy = ["WebKit", "Caches/WebKit", "Application Support/WebKit"].contains { FileManager.default.fileExists(atPath: legacyLibrary.appendingPathComponent($0).path) }
            if legacy { throw NativeSaveError.requiresLegacyImport }
        }
        return nil
    }
    @discardableResult
    public func save(_ envelope: NativeSaveEnvelope) throws -> Bool {
        try envelope.validate()
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(envelope)
        var contentEnvelope=envelope
        contentEnvelope.savedAt=0;contentEnvelope.journeyRunSavedAt=[:];contentEnvelope.arcadeRunSavedAt=nil
        let content=try encoder.encode(contentEnvelope)
        if successfulContent==content,let serialized=successfulSerialized,(try? Data(contentsOf:primary))==serialized {return false}
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if (try? decode(primary)) != nil { try Data(contentsOf: primary).write(to: backup, options: .atomic) }
        try data.write(to: primary, options: .atomic)
        successfulContent=content;successfulSerialized=data
        return true
    }
}
