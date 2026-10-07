import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeArcadePresentationTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    private enum ReceiptFailure: Error { case rejected }

    func testContinuationReceiptPrecedesFirstRoundFrameAndCommitsExactlyOnce() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        let controller = UIViewController(); window.rootViewController = controller; window.makeKeyAndVisible()
        let owner = NativeArcadeRoundPresentation(resourceRoot: root,clearedRound: 1,nextRound: 2,continuationOnly: true,random: { 0.5 })
        owner.frame = window.bounds; controller.view.addSubview(owner)
        var commits = 0,rounds = 0,finishes = 0,digits = Set<Int>()
        let finished = expectation(description: "Actual finite native digit clock finishes")
        owner.onNextRoundPresented = { commits += 1 }
        owner.onCue = { cue in
            switch cue {
            case .roundShown: XCTAssertEqual(commits,1); rounds += 1
            case .digitEntered(let index): XCTAssertEqual(commits,1); digits.insert(index)
            default: break
            }
        }
        owner.onFinished = { completed in XCTAssertTrue(completed); finishes += 1; finished.fulfill() }
        owner.start(); owner.start()
        XCTAssertEqual(commits,1); XCTAssertEqual(rounds,1)
        // Original getArcadeRoundCueDurationMs: two digits = 2200ms.
        XCTAssertEqual(owner.duration,2.2,accuracy: 0.000001)
        await fulfillment(of: [finished],timeout: 5)
        XCTAssertEqual(digits,Set([0,1])); XCTAssertEqual(finishes,1)
        XCTAssertNil(owner.superview)
        owner.dispose(); XCTAssertEqual(finishes,1)
        window.isHidden = true
    }

    func testThrowingReceiptCancelsBeforeAnyVisibleRoundOrDigit() {
        let container = UIView(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        let owner = NativeArcadeRoundPresentation(resourceRoot: root,clearedRound: 1,nextRound: 2,continuationOnly: true)
        owner.frame = container.bounds; container.addSubview(owner)
        var attempted = 0,visible = 0,finishes = 0
        owner.onNextRoundPresented = { attempted += 1; throw ReceiptFailure.rejected }
        owner.onCue = { cue in
            switch cue { case .roundShown,.digitEntered: visible += 1; default: break }
        }
        owner.onFinished = { completed in XCTAssertFalse(completed); finishes += 1 }
        owner.start(); owner.start(); owner.dispose()
        XCTAssertEqual(attempted,1); XCTAssertEqual(visible,0); XCTAssertEqual(finishes,1)
        XCTAssertNil(owner.superview)
    }

    func testSuspendedDisposedOwnerCannotCompleteOrRetainDisplayClock() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        let controller = UIViewController(); window.rootViewController = controller; window.makeKeyAndVisible()
        var owner: NativeArcadeRoundPresentation? = NativeArcadeRoundPresentation(resourceRoot: root,clearedRound: 3,nextRound: 4,continuationOnly: true)
        weak var released = owner
        owner?.frame = window.bounds; controller.view.addSubview(owner!)
        var committed = 0,completed = 0,cancelled = 0
        owner?.onNextRoundPresented = { committed += 1 }
        owner?.onFinished = { success in if success { completed += 1 } else { cancelled += 1 } }
        owner?.start(); owner?.setSuspended(true); owner?.dispose(); owner?.setSuspended(false); owner?.start(); owner = nil
        try? await Task.sleep(nanoseconds: 150_000_000)
        XCTAssertEqual(committed,1); XCTAssertEqual(completed,0); XCTAssertEqual(cancelled,1)
        XCTAssertNil(released,"Finite clock target and notification callbacks must release the disposed owner")
        window.isHidden = true
    }

    func testFishNativeFlightMatchesSourceEndpointsAndExpiry() {
        let motion = NativeFishFinaleMotion(origin: CGPoint(x: 70,y: 200),viewport: CGSize(width: 390,height: 844))
        let first = motion.sample(seconds: 0),last = motion.sample(seconds: 2.4)
        XCTAssertEqual(first.point.x,70); XCTAssertEqual(first.point.y,200)
        XCTAssertEqual(first.scale,0.18,accuracy: 0.000001)
        XCTAssertEqual(last.point.x,390+motion.mediaSize.width/2+24,accuracy: 0.000001)
        XCTAssertEqual(last.point.y,844+motion.mediaSize.height/2+24,accuracy: 0.000001)
        XCTAssertEqual(last.alpha,0)
        let reversed = NativeFishFinaleMotion(origin: CGPoint(x: 300,y: 700),viewport: CGSize(width: 390,height: 844))
        XCTAssertEqual(reversed.direction,-1)
        XCTAssertLessThan(reversed.end.x,0); XCTAssertLessThan(reversed.end.y,0)
    }
}
