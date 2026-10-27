import Foundation
import StackToSixGameplay

public enum NativeSaveError: Error, Equatable { case unsupportedVersion(Int), wrongProduct, invalidState([String]), requiresLegacyImport, corruptSave }
public struct NativePendingArcadeRound: Codable, Equatable, Sendable {
    public var round: Int
    public var score: Int
    public var ownerID: String?
    public var meterProgress: Double?
    public var lastSpecialMergeWorld: String?
    public init(round:Int,score:Int,ownerID:String?=nil,meterProgress:Double?=nil,lastSpecialMergeWorld:String?=nil) {self.round=round;self.score=score;self.ownerID=ownerID;self.meterProgress=meterProgress;self.lastSpecialMergeWorld=lastSpecialMergeWorld}
}
public struct NativeSaveEnvelope: Codable, Equatable, Sendable {
    public static let currentVersion = 1
    public var version = currentVersion
    public var product = "com.taptapdesign.stacktosix.native"
    public var savedAt = Date().timeIntervalSince1970
    public var settings: NativeSettingsPreferences
    public var progression: NativeProgressionState
    public var journeyRuns: [Int: NativeBoardState]
    /// Legacy document keys always own Endurance. Runtime accessors below select
    /// one isolated slot; switching modes never overwrites another run.
    public var activeArcadeVariant: NativeArcadeVariant = .endurance
    private var enduranceRun: NativeBoardState?
    private var endurancePendingRound: NativePendingArcadeRound?
    fileprivate var enduranceRunSavedAt: TimeInterval?
    public var arcadeVariantRuns: [String: NativeBoardState] = [:]
    public var arcadeVariantPendingRounds: [String: NativePendingArcadeRound] = [:]
    public var arcadeVariantRunSavedAt: [String: TimeInterval] = [:]
    public var arcadeRun: NativeBoardState? {
        get { activeArcadeVariant == .endurance ? enduranceRun : arcadeVariantRuns[activeArcadeVariant.rawValue] }
        set { if activeArcadeVariant == .endurance { enduranceRun = newValue } else { arcadeVariantRuns[activeArcadeVariant.rawValue] = newValue } }
    }
    public var pendingArcadeRound: NativePendingArcadeRound? {
        get { activeArcadeVariant == .endurance ? endurancePendingRound : arcadeVariantPendingRounds[activeArcadeVariant.rawValue] }
        set { if activeArcadeVariant == .endurance { endurancePendingRound = newValue } else { arcadeVariantPendingRounds[activeArcadeVariant.rawValue] = newValue } }
    }
    public var journeyRunSavedAt: [Int: TimeInterval] = [:]
    public var arcadeRunSavedAt: TimeInterval? {
        get { activeArcadeVariant == .endurance ? enduranceRunSavedAt : arcadeVariantRunSavedAt[activeArcadeVariant.rawValue] }
        set { if activeArcadeVariant == .endurance { enduranceRunSavedAt = newValue } else { arcadeVariantRunSavedAt[activeArcadeVariant.rawValue] = newValue } }
    }
    public var firstPlayRun: NativeBoardState?
    public var importedHybrid: Bool
    public init(settings: NativeSettingsPreferences = .init(), progression: NativeProgressionState = .init(), journeyRuns: [Int: NativeBoardState] = [:], arcadeRun: NativeBoardState? = nil, importedHybrid: Bool = false) {
        self.settings = settings; self.progression = progression; self.journeyRuns = journeyRuns; self.enduranceRun = arcadeRun; self.importedHybrid = importedHybrid
    }
    private enum CodingKeys:String,CodingKey {case firstPlayRun,activeArcadeVariant,arcadeVariantRuns,arcadeVariantPendingRounds,arcadeVariantRunSavedAt,version,product,savedAt,settings,progression,journeyRuns,arcadeRun,pendingArcadeRound,journeyRunSavedAt,arcadeRunSavedAt,importedHybrid}
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
        firstPlayRun=try fields.decodeIfPresent(NativeBoardState.self,forKey:.firstPlayRun)
        journeyRuns=try fields.decode([Int:NativeBoardState].self,forKey:.journeyRuns)
        enduranceRun=try fields.decodeIfPresent(NativeBoardState.self,forKey:.arcadeRun)
        endurancePendingRound=try fields.decodeIfPresent(NativePendingArcadeRound.self,forKey:.pendingArcadeRound)
        journeyRunSavedAt=try fields.decodeIfPresent([Int:TimeInterval].self,forKey:.journeyRunSavedAt) ?? [:]
        enduranceRunSavedAt=try fields.decodeIfPresent(TimeInterval.self,forKey:.arcadeRunSavedAt)
        importedHybrid=try fields.decode(Bool.self,forKey:.importedHybrid)
        activeArcadeVariant=try fields.decodeIfPresent(NativeArcadeVariant.self,forKey:.activeArcadeVariant) ?? .endurance
        arcadeVariantRuns=try fields.decodeIfPresent([String:NativeBoardState].self,forKey:.arcadeVariantRuns) ?? [:]
        arcadeVariantPendingRounds=try fields.decodeIfPresent([String:NativePendingArcadeRound].self,forKey:.arcadeVariantPendingRounds) ?? [:]
        arcadeVariantRunSavedAt=try fields.decodeIfPresent([String:TimeInterval].self,forKey:.arcadeVariantRunSavedAt) ?? [:]
    }
    public func encode(to encoder: Encoder) throws {
        var fields = encoder.container(keyedBy: CodingKeys.self)
        try fields.encode(version, forKey: .version)
        try fields.encode(product, forKey: .product)
        try fields.encode(savedAt, forKey: .savedAt)
        try fields.encode(settings, forKey: .settings)
        try fields.encode(progression, forKey: .progression)
        try fields.encodeIfPresent(firstPlayRun,forKey:.firstPlayRun)
        try fields.encode(journeyRuns, forKey: .journeyRuns)
        try fields.encode(journeyRunSavedAt, forKey: .journeyRunSavedAt)
        try fields.encode(importedHybrid, forKey: .importedHybrid)
        try fields.encode(activeArcadeVariant, forKey: .activeArcadeVariant)
        try fields.encode(arcadeVariantRuns, forKey: .arcadeVariantRuns)
        try fields.encode(arcadeVariantPendingRounds, forKey: .arcadeVariantPendingRounds)
        try fields.encode(arcadeVariantRunSavedAt, forKey: .arcadeVariantRunSavedAt)
        try fields.encodeIfPresent(enduranceRun, forKey: .arcadeRun)
        try fields.encodeIfPresent(endurancePendingRound, forKey: .pendingArcadeRound)
        try fields.encodeIfPresent(enduranceRunSavedAt, forKey: .arcadeRunSavedAt)
    }
    public func validate() throws {
        guard product == "com.taptapdesign.stacktosix.native" else { throw NativeSaveError.wrongProduct }
        guard version == Self.currentVersion else { throw NativeSaveError.unsupportedVersion(version) }
        var issues: [String] = []
        let knownDice=Set((1...30).flatMap{NativeJourneyContent.rewardPool(board:$0)})
        if !progression.announcedJourneyDice.isSubset(of:knownDice) || !progression.unreadJourneyDice.isSubset(of:progression.announcedJourneyDice) {issues.append("invalid-backpack-alert-state")}
        if !progression.unlockedSpecialDice.allSatisfy({["flower","juice"].contains($0)}) {issues.append("invalid-special-unlock")}
        if !savedAt.isFinite || !journeyRunSavedAt.allSatisfy({(1...30).contains($0.key) && $0.value.isFinite && $0.value >= 0}) || enduranceRunSavedAt.map({!$0.isFinite || $0 < 0}) == true || !progression.completedJourneyBoards.allSatisfy({(1...30).contains($0)}) || !progression.viewedJourneyBoards.allSatisfy({(1...30).contains($0)}) { issues.append("invalid-progression") }
        if let run=firstPlayRun {
            issues += Self.boardIssues(run)
            if run.tutorial == nil || run.mode == .journey && !(1...30).contains(run.board) {issues.append("invalid-first-play-run")}
        }
        for (key, board) in journeyRuns {
            if key != board.board || board.mode != .journey || !(1...30).contains(key) { issues.append("journey-run-mode-mismatch") }
            issues += Self.boardIssues(board)
        }
        for (key, board) in arcadeVariantRuns {
            guard let variant = NativeArcadeVariant(rawValue:key), variant != .endurance else {issues.append("invalid-arcade-variant");continue}
            if board.mode != .arcade || board.effectiveArcadeVariant != variant {issues.append("arcade-variant-run-mismatch")}
            issues += Self.boardIssues(board)
        }
        if let board = enduranceRun {
            if board.mode != .arcade || board.effectiveArcadeVariant != .endurance { issues.append("arcade-run-mode-mismatch") }
            issues += Self.boardIssues(board)
        }
        for pending in Array(arcadeVariantPendingRounds.values) + [endurancePendingRound].compactMap({$0}) {
            if pending.round < 1 || pending.score < 0 || pending.meterProgress.map({!$0.isFinite || $0 < 0}) == true {issues.append("invalid-pending-arcade-round")}
        }
        let variantKeys = Set(arcadeVariantPendingRounds.keys).union(arcadeVariantRunSavedAt.keys).union(progression.arcadeVariantStats.keys)
        if variantKeys.contains(where: {NativeArcadeVariant(rawValue:$0) == nil || $0 == NativeArcadeVariant.endurance.rawValue}) || arcadeVariantRunSavedAt.values.contains(where:{!$0.isFinite || $0 < 0}) {issues.append("invalid-arcade-variant")}
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
    /// Entry/preparation is not a played attempt. Only committed move accounting
    /// authorizes a resumable layout; Arcade progression survives as metadata.
    public static func hasRecordedMove(_ state:NativeBoardState)->Bool {state.moves < state.maxMoves}
    public mutating func recordPlayableRun(_ state:NativeBoardState,now:TimeInterval) {
        if !progression.firstPlayTutorialComplete,state.tutorial != nil {firstPlayRun=state;return}
        let played=Self.hasRecordedMove(state)
        if state.mode == .journey {
            journeyRuns[state.board]=played ? state:nil
            journeyRunSavedAt[state.board]=played ? now:nil
        } else {
            arcadeRun=played ? state:nil
            arcadeRunSavedAt=played ? now:nil
            pendingArcadeRound=played ? nil:.init(round:state.board,score:state.score,meterProgress:state.wildMeter,lastSpecialMergeWorld:state.lastSpecialMergeWorld)
        }
    }
    /// Discard legacy entry-only layouts without losing earned Arcade progression.
    public mutating func discardUntouchedLayouts() {
        for board in Array(journeyRuns.keys) where journeyRuns[board].map({!Self.hasRecordedMove($0)}) == true {
            journeyRuns[board]=nil;journeyRunSavedAt[board]=nil
        }
        let selected=activeArcadeVariant
        for variant in NativeArcadeVariant.allCases {
            activeArcadeVariant=variant
            if let run=arcadeRun,!Self.hasRecordedMove(run) {
                if pendingArcadeRound==nil {pendingArcadeRound = .init(round:run.board,score:run.score,meterProgress:run.wildMeter,lastSpecialMergeWorld:run.lastSpecialMergeWorld)}
                arcadeRun=nil;arcadeRunSavedAt=nil
            }
        }
        activeArcadeVariant=selected
    }
    public func resumedRun(mode: NativeRunMode, board: Int, now: TimeInterval = Date().timeIntervalSince1970) -> NativeBoardState? {
        let timestamp = mode == .journey ? (journeyRunSavedAt[board] ?? savedAt) : (arcadeRunSavedAt ?? savedAt)
        guard now - timestamp < 7 * 24 * 60 * 60, now >= timestamp - 60 else { return nil }
        guard var run = mode == .journey ? journeyRuns[board] : arcadeRun, run.board == board, Self.hasRecordedMove(run) else { return nil }
        // Old Forest7–10 pools accidentally admitted Arcade-only OG TNT.
        // Barrel is the same gameplay archetype and already unlocked here:
        // preserve the board, score and RNG while repairing only its artwork identity.
        if mode == .journey,(7...10).contains(board) {
            for index in run.tiles.indices where run.tiles[index].archetype == .tnt && run.tiles[index].variant == nil {
                run.tiles[index].variant="barell"
            }
        }
        run.combo = 0 // Earned current-attempt reward survives; live timing streak does not.
        run.generation &+= 1; run.revision &+= 1
        return run
    }
}
/// One atomic document owns preferences, progress, Journey and all Arcade variant saves. No PWA paths or defaults domains.
/// A previous coherent document is the only recovery fallback; never merge partial saves.
public final class NativeSaveStore {
    public let directory: URL
    private let legacyLibrary: URL?
    /// Same sandbox boundary used by load(); transport must not select another profile.
    public var legacyImportLibraryRoot:URL? {legacyLibrary}
    private var successfulContent: NativeSaveEnvelope?
    private var successfulSerialized: Data?
    public init(directory: URL, legacyLibrary: URL? = nil) { self.directory = directory; self.legacyLibrary = legacyLibrary }
    public static func applicationStore() throws -> NativeSaveStore {
        guard Bundle.main.bundleIdentifier == "com.taptapdesign.stacktosix.native" else { throw NativeSaveError.wrongProduct }
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return NativeSaveStore(directory: support.appendingPathComponent("StackToSixNative", isDirectory: true), legacyLibrary: support.deletingLastPathComponent())
    }
    private var primary: URL { directory.appendingPathComponent("state-v1.json") }
    private var backup: URL { directory.appendingPathComponent("state-v1.previous.json") }
    private func decode(_ data:Data) throws -> NativeSaveEnvelope {
        let value = try JSONDecoder().decode(NativeSaveEnvelope.self, from:data)
        try value.validate(); return value
    }
    private func decode(_ url: URL) throws -> NativeSaveEnvelope {try decode(Data(contentsOf:url))}
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
        var contentEnvelope=envelope
        contentEnvelope.savedAt=0;contentEnvelope.journeyRunSavedAt=[:];contentEnvelope.enduranceRunSavedAt=nil;contentEnvelope.arcadeVariantRunSavedAt=[:]
        // The whole Journey document can contain thirty boards. Comparing its
        // value avoids encoding it twice on the synchronous Source save wall.
        // Still read the actual primary: an externally missing/corrupt copy
        // must be repaired even when the last accepted content is unchanged.
        let previousData=try? Data(contentsOf:primary)
        if successfulContent==contentEnvelope,let serialized=successfulSerialized,previousData==serialized {return false}
        // JSON object key order is not durable authority. Keep the original
        // synchronous atomic write, without sorting every field in every run.
        let encoder = JSONEncoder()
        let data = try encoder.encode(envelope)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        // Bytes from our last successful validated atomic write are already
        // coherent. Foreign bytes still pass the original decoder/validator.
        if let previousData,previousData==successfulSerialized || (try? decode(previousData)) != nil {
            try previousData.write(to:backup,options:.atomic)
        }
        try data.write(to: primary, options: .atomic)
        successfulContent=contentEnvelope;successfulSerialized=data
        return true
    }
}
