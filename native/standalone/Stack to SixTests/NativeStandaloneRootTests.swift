import XCTest
import UIKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeStandaloneRootTests:XCTestCase {
    func testNativeRootMountsFromNativeStoreWithoutHybridShellAndDisposesOnce()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-root-test-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store)
        host.loadViewIfNeeded()
        XCTAssertTrue(host.children.first is NativeAppController)
        func containsHybrid(_ view:UIView)->Bool {
            NSStringFromClass(type(of:view)).contains("WKWebView") || view.subviews.contains(where:containsHybrid)
        }
        XCTAssertFalse(containsHybrid(host.view))
        XCTAssertFalse(host.children.contains{$0 is GameViewController})
        XCTAssertEqual(try store.load()?.settings,seed.settings)
        host.dispose();host.dispose();XCTAssertTrue(host.disposed);XCTAssertTrue(host.children.isEmpty)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertTrue(host.children.isEmpty)
    }
    func testRetiredRootCannotMountAfterLateViewLoading()async throws {
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root)
        host.dispose();host.loadViewIfNeeded()
        XCTAssertTrue(host.children.isEmpty)
    }
}
