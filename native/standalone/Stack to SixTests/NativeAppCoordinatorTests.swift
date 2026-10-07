import XCTest
import UIKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeAppCoordinatorTests:XCTestCase {
    private func resources()->URL {
        Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!
    }
    func testNativeHomeNeverRequestsWebDataAndRetainsAuthoredViews() {
        var writes = 0
        let services = NativeAppServices(settings:{["gameSoundsEnabled":false,"musicEnabled":true,"hapticsEnabled":true]},
            setPreference:{_,_ in writes += 1},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},
            makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller = NativeAppController(resourceRoot:resources(),services:services)
        controller.loadViewIfNeeded()
        XCTAssertEqual(controller.route,.home)
        XCTAssertFalse(controller.home.isHidden)
        XCTAssertTrue(controller.hub.isHidden)
        XCTAssertEqual(writes,0)
        XCTAssertFalse(containsWebView(controller.view))
    }
    func testLateNavigationCompletionCannotReplaceNewerDestination() async {
        let services = NativeAppServices(settings:{["gameSoundsEnabled":false,"musicEnabled":true,"hapticsEnabled":true]},
            setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},
            makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller = NativeAppController(resourceRoot:resources(),services:services)
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController = controller;window.makeKeyAndVisible()
        controller.loadViewIfNeeded()
        controller.navigate(.hub,interrupt:true)
        controller.navigate(.settings,interrupt:true)
        try? await Task.sleep(for:.seconds(2))
        XCTAssertEqual(controller.route,.settings)
        XCTAssertFalse(controller.settingsView.isHidden)
        XCTAssertTrue(controller.hub.isHidden)
        window.isHidden = true
    }
    func testNativeAuthoredWorldSnapshotsAreAcceptedByActualUIKitConsumerAtPhoneAndTabletSizes() throws {
        let layouts=try NativeWorldLayouts()
        var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
        progression.completedJourneyBoards=[1,11,21]
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:768,height:1024)] {
            for world in 1...3 {
                let raw=try layouts.snapshot(world:world,width:size.width,height:size.height,generation:4,progression:progression)
                guard let snapshot=JimiNativeWorldSnapshot(raw) else {
                    let dump=FileManager.default.temporaryDirectory.appendingPathComponent("native-world-reject-\(world)-\(Int(size.width)).json")
                    try JSONSerialization.data(withJSONObject:raw,options:[.sortedKeys]).write(to:dump)
                    let invalidAmbient=(raw["ambientPlans"] as? [[String:Any]] ?? []).enumerated().filter{JimiNativeWorldAmbient.Plan.parse($0.element,worldID:world)==nil}.map(\.offset)
                    print("[NATIVE_WORLD_REJECT_DUMP] \(dump.path) ambient=\(invalidAmbient)")
                    XCTFail("Native world \(world) at \(size) must satisfy actual UIKit consumer");continue
                }
                XCTAssertEqual(snapshot.worldID,world);XCTAssertEqual(snapshot.generation,4)
                XCTAssertEqual(snapshot.units.count,10)
                XCTAssertEqual(snapshot.units.map(\.boardID),Array((world-1)*10+1...world*10))
                XCTAssertEqual(snapshot.units.first(where:{$0.interim})?.boardID,(world-1)*10+2)
            }
        }
    }
    private func containsWebView(_ view:UIView)->Bool {
        NSStringFromClass(type(of:view)).contains("WKWebView") || view.subviews.contains(where:containsWebView)
    }
}
private enum FixtureError:Error {case unavailable}
