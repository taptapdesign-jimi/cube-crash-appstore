import XCTest
import WebKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

/// Exercises the real default profile and original origin only in the isolated QA Simulator.
/// Source values are captured and restored even if import or an assertion fails.
@MainActor
final class NativeHybridExportTests:XCTestCase {
    func testOriginalOriginExportPreservesSourceAndPersistsCoherentNativeProfile() async throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Save transport writes are QA Simulator only")
        #else
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {throw XCTSkip("Isolated QA Simulator only")}
        let probe = OriginProbe();try await probe.open()
        let original = try await probe.readGameKeys()
        let fixture:[String:String] = [
            "cc_settings":"{\"gameSoundsEnabled\":true,\"musicEnabled\":false,\"hapticsEnabled\":false}",
            "journey_boards_state":"[{\"id\":1,\"unlocked\":true}]",
            "journey_viewed_boards":"[1]",
            "journey_highest_unlocked_board_id":"2",
            "cc_saved_game_board_02":"{\"schemaVersion\":2,\"boardNumber\":2,\"level\":2,\"score\":777,\"starsCount\":4,\"bestScore\":888,\"moves\":31,\"wildMeter\":0.75,\"wildSpawnCount\":3,\"grid\":[[{\"value\":3,\"locked\":false,\"open\":true}]],\"timestamp\":1791374400000}",
            "cc_arcade_pending_round_v1":"{\"round\":4,\"score\":1234,\"ownerId\":\"transport-fixture\"}"
        ]
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("native-transport-"+UUID().uuidString)
        defer {try? FileManager.default.removeItem(at:directory);probe.dispose()}
        do {
            try await probe.replaceGameKeys(fixture)
            let exporter = NativeHybridExport()
            let store = NativeSaveStore(directory:directory)
            let imported:NativeSaveEnvelope = try await withCheckedThrowingContinuation { continuation in
                exporter.importInto(store) {continuation.resume(with:$0)}
            }
            XCTAssertTrue(imported.importedHybrid)
            XCTAssertEqual(imported.journeyRuns[2]?.score,777)
            XCTAssertEqual(imported.journeyRuns[2]?.starsCount,4)
            XCTAssertEqual(imported.journeyRuns[2]?.bestScore,888)
            XCTAssertEqual(imported.pendingArcadeRound?.ownerID,"transport-fixture")
            XCTAssertEqual(imported.progression.completedJourneyBoards,[1])
            XCTAssertTrue(imported.settings.gameSoundsEnabled)
            XCTAssertFalse(imported.settings.musicEnabled)
            XCTAssertEqual(try store.load(),imported)
            let after = try await probe.readGameKeys()
            XCTAssertEqual(after,fixture,"Export/import must preserve every source value")
            try await probe.replaceGameKeys(original)
        } catch {
            try await probe.replaceGameKeys(original)
            throw error
        }
        #endif
    }

    private final class OriginProbe:NSObject,WKNavigationDelegate,WKURLSchemeHandler {
        private var web:WKWebView!
        private var loaded:CheckedContinuation<Void,Error>?
        private let url = URL(string:"app://localhost/__native_migration_test__.html")!
        private let predicate = "(k)=>['cc_settings','cc_board_stats_v1','cc_arcade_stats_v1','cc_arcade_run_state_v1','cc_arcade_pending_round_v1','journey_boards_state','journey_viewed_boards','journey_highest_unlocked_board_id','journey_last_opened_board_id','journey_current_run_state','cc_board_completed','cc_first_play_tutorial_done','cc_first_play_tutorial_force_next','cc_saved_game'].includes(k)||/^cc_saved_game_board_\\d+$/.test(k)||/^cc_journey_completed_board_\\d+$/.test(k)"
        func open() async throws {
            let configuration = WKWebViewConfiguration();configuration.websiteDataStore = .default()
            configuration.setURLSchemeHandler(self,forURLScheme:"app")
            web = WKWebView(frame:.zero,configuration:configuration);web.navigationDelegate = self
            try await withCheckedThrowingContinuation { continuation in loaded = continuation;web.load(URLRequest(url:url)) }
        }
        func readGameKeys() async throws -> [String:String] {
            let value = try await evaluate("(()=>{const accepts=\(predicate),result={};for(let i=0;i<localStorage.length;i++){let k=localStorage.key(i);if(accepts(k))result[k]=localStorage.getItem(k);}return JSON.stringify(result)})()")
            return try JSONDecoder().decode([String:String].self,from:Data((value as! String).utf8))
        }
        func replaceGameKeys(_ values:[String:String]) async throws {
            let json = String(data:try JSONEncoder().encode(values),encoding:.utf8)!
            _ = try await evaluate("(()=>{const accepts=\(predicate),keys=[];for(let i=0;i<localStorage.length;i++){let k=localStorage.key(i);if(accepts(k))keys.push(k);}keys.forEach(k=>localStorage.removeItem(k));const values=\(json);Object.keys(values).forEach(k=>localStorage.setItem(k,values[k]));return true})()")
        }
        private func evaluate(_ script:String) async throws -> Any {
            try await withCheckedThrowingContinuation { continuation in web.evaluateJavaScript(script) {value,error in
                if let error {continuation.resume(throwing:error)} else {continuation.resume(returning:value ?? NSNull())}
            } }
        }
        func dispose() {web?.navigationDelegate = nil;web?.stopLoading();web = nil}
        func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!) {loaded?.resume();loaded = nil}
        func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error) {loaded?.resume(throwing:error);loaded = nil}
        func webView(_ webView:WKWebView,start urlSchemeTask:WKURLSchemeTask) {
            let data = Data("<!doctype html><meta charset=utf-8>".utf8)
            urlSchemeTask.didReceive(URLResponse(url:url,mimeType:"text/html",expectedContentLength:data.count,textEncodingName:"utf-8"));urlSchemeTask.didReceive(data);urlSchemeTask.didFinish()
        }
        func webView(_ webView:WKWebView,stop urlSchemeTask:WKURLSchemeTask) {}
    }
}
