import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeGameplaySourceBindingTests: XCTestCase {
    private var root: URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    private func engine() -> NativeGameplayEngine {
        NativeGameplayEngine(state: NativeBoardState(columns: 5, rows: 9, tiles: [
            .init(id: "a", cell: .init(column: 0, row: 0), value: 1),
            .init(id: "b", cell: .init(column: 1, row: 0), value: 2),
            .init(id: "c", cell: .init(column: 2, row: 0), value: 4)]))
    }
    private func controller(_ context: NativeGameplaySourceContext, enabled: Bool) -> NativeGameplayViewController {
        let controller = NativeGameplayViewController(engine: engine(), resourceRoot: root)
        controller.sourceContext = context; controller.sourceSmallStackPresentationEnabled = enabled
        controller.loadViewIfNeeded(); controller.view.frame = CGRect(x: 0,y: 0,width: 390,height: 844)
        controller.boardScene?.layout(size: controller.view.bounds.size, insets: .init(top: 47,left: 0,bottom: 34,right: 0),animateEntry: false)
        return controller
    }
    func testActualControllerRetainsSameNodeAndEmitsAudioOnlyAfterFullContactThenKeepsPausedAbsorb() throws {
        var now = 0.0
        let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0, sourceWallMillisecondsNow: {now})
        let context = NativeGameplaySourceContext(service: service, appOriginMilliseconds: 0, visualRandom: {0.5})
        let controller = controller(context, enabled: true)
        defer {controller.dispose(); context.dispose(); service.dispose()}
        let scene = try XCTUnwrap(controller.boardScene), geometry = try XCTUnwrap(scene.boardGeometry)
        let scope = try XCTUnwrap(controller.sourceScope), source = try XCTUnwrap(scene.sourceNativeTileNode("a"))
        var contacts = 0
        controller.onGameplayReceipt = {event,_,_,_ in
            if event.kind == .merged {
                contacts += 1
                XCTAssertTrue(scene.sourceNativeTileNode("b")?.sourceOuterOwners.mergeImpact == true)
                XCTAssertEqual(scope.smoke.activeOwnerCount, 1)
            }
        }
        XCTAssertTrue(scene.beginDrag(at: geometry.center(row: 0,column: 0)))
        now = 25; service.deliver(wallMilliseconds: now)
        scene.moveDrag(to: geometry.center(row: 0,column: 1), now: 0.025)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at: geometry.center(row: 0,column: 1),now: 0.025)).accepted)
        XCTAssertEqual(contacts, 1); XCTAssertTrue(scene.sourceNativeTileNode("a") === source)
        controller.setSuspended(true)
        now = 250; service.deliver(wallMilliseconds: now)
        XCTAssertNotNil(scene.engine.pendingOrdinaryStack); XCTAssertTrue(scope.current)
        XCTAssertTrue(service.hasActiveClock, "Foreground global pause retains Source transport")
        controller.setSuspended(false)
        now = 330; service.deliver(wallMilliseconds: now)
        XCTAssertNil(scene.engine.pendingOrdinaryStack); XCTAssertNil(scene.sourceNativeTileNode("a"))
        XCTAssertEqual(contacts, 1)
    }
    func testActualBackgroundNotificationStopsTransportWithoutDestructiveTransactionCancelAndRejectsOldController() throws {
        var now = 0.0
        let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0, sourceWallMillisecondsNow: {now})
        let context = NativeGameplaySourceContext(service: service, appOriginMilliseconds: 0, visualRandom: {0.5})
        let a = controller(context, enabled: true)
        let old = try XCTUnwrap(a.sourceScope)
        let participant = BindingParticipant()
        let lease = try XCTUnwrap(service.register(participant: participant, duration: 3, domain: .sourceGSAP(.timeline), wallMilliseconds: 0, cleanup: {_ in}))
        NotificationCenter.default.post(name: UIApplication.willResignActiveNotification, object: nil)
        XCTAssertFalse(service.hasActiveClock); XCTAssertTrue(old.current); XCTAssertTrue(lease.active)
        NotificationCenter.default.post(name: UIApplication.didBecomeActiveNotification, object: nil)
        XCTAssertTrue(service.hasActiveClock)
        let b = controller(context, enabled: true)
        defer {a.dispose(); b.dispose(); lease.cancel(success: false); context.dispose(); service.dispose()}
        XCTAssertFalse(old.current); XCTAssertTrue(try XCTUnwrap(b.sourceScope).current)
        a.setSuspended(true)
        now = 50; service.deliver(wallMilliseconds: now)
        XCTAssertFalse(participant.frames.isEmpty)
    }
    func testExistingControllerDefaultDoesNotActivatePrivateSourceStackMode() throws {
        let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0)
        let context = NativeGameplaySourceContext(service: service, appOriginMilliseconds: 0)
        let controller = controller(context, enabled: false)
        defer {controller.dispose(); context.dispose(); service.dispose()}
        XCTAssertNil(controller.sourceScope)
        XCTAssertFalse(try XCTUnwrap(controller.boardScene).sourceSameNodeStackAbsorbsEnabled)
    }
    @MainActor private final class BindingParticipant: NativeSourceAnimationParticipant {
        var frames: [Double] = []
        func advanceSourceAnimation(seconds: Double) {frames.append(seconds)}
    }
}
