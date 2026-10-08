import XCTest
@testable import Stack_to_Six

@MainActor final class NativeGameplaySourceContextTests: XCTestCase {
    @MainActor private final class Participant: NativeSourceAnimationParticipant {
        var frames: [Double] = []
        func advanceSourceAnimation(seconds: Double) {frames.append(seconds)}
    }
    func testReplacementKeepsAppHistoryAndRejectsOldLifecycleWithoutRetiringRaw() throws {
        let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0)
        var draw = 0.0, retired = 0
        let context = NativeGameplaySourceContext(service: service, appOriginMilliseconds: 0, visualRandom: {draw += 0.1; return draw})
        let a = try XCTUnwrap(context.beginScene {retired += 1})
        XCTAssertEqual(a.smokeSession.nextVisualRandom(), 0.1)
        XCTAssertEqual(a.smokeSession.nextRegularSixPattern(), 0)
        let raw = Participant()
        let rawLease = try XCTUnwrap(service.register(participant: raw, duration: 5, domain: .nativeRaw, cleanup: {_ in}))
        let b = try XCTUnwrap(context.beginScene {})
        XCTAssertEqual(retired, 1); XCTAssertFalse(a.current); XCTAssertTrue(b.current)
        XCTAssertTrue(a.smokeSession === b.smokeSession); XCTAssertTrue(a.sixResources === b.sixResources)
        XCTAssertEqual(b.smokeSession.nextVisualRandom(), 0.2)
        XCTAssertEqual(b.smokeSession.nextRegularSixPattern(), 1)
        XCTAssertFalse(a.update(foreground: false, globalPaused: true, terminalSuspended: false))
        XCTAssertTrue(b.update(foreground: true, globalPaused: false, terminalSuspended: false))
        service.deliver(wallMilliseconds: 0); service.deliver(wallMilliseconds: 100)
        XCTAssertEqual(raw.frames.last!, 0.1, accuracy: 1e-12)
        context.dispose(); XCTAssertTrue(rawLease.active)
        rawLease.cancel(success: false); service.dispose()
    }
    func testRetirementReentryCannotOverwriteNewSceneOrReviveDisposedContext() throws {
        let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0)
        let context = NativeGameplaySourceContext(service: service, appOriginMilliseconds: 0)
        var c: NativeGameplaySourceContext.Scope?
        let a = try XCTUnwrap(context.beginScene {c = context.beginScene {}})
        XCTAssertNil(context.beginScene {})
        XCTAssertTrue(try XCTUnwrap(c).current); XCTAssertFalse(a.current)
        context.dispose(); XCTAssertFalse(c!.current); XCTAssertNil(context.beginScene {})
        service.dispose()
    }
    func testForegroundGlobalPauseAndTerminalResumeRemainSeparate() throws {
        let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0)
        let context = NativeGameplaySourceContext(service: service, appOriginMilliseconds: 0)
        let scope = try XCTUnwrap(context.beginScene {})
        let participant = Participant()
        let lease = try XCTUnwrap(service.register(participant: participant, duration: 3, domain: .sourceGSAP(.timeline), wallMilliseconds: 0, cleanup: {_ in}))
        service.deliver(wallMilliseconds: 0); service.deliver(wallMilliseconds: 100)
        let before = participant.frames.last
        XCTAssertTrue(scope.update(foreground: true, globalPaused: true, terminalSuspended: false))
        service.deliver(wallMilliseconds: 200)
        XCTAssertEqual(participant.frames.last, before)
        XCTAssertTrue(service.hasActiveClock)
        XCTAssertFalse(scope.update(foreground: true, globalPaused: false, terminalSuspended: true))
        service.deliver(wallMilliseconds: 300); XCTAssertEqual(participant.frames.last, before)
        XCTAssertTrue(scope.update(foreground: false, globalPaused: true, terminalSuspended: false))
        XCTAssertFalse(service.hasActiveClock)
        XCTAssertTrue(scope.update(foreground: true, globalPaused: false, terminalSuspended: false))
        service.deliver(wallMilliseconds: 324)
        XCTAssertGreaterThan(participant.frames.last!, before!)
        lease.cancel(success: false); context.dispose(); service.dispose()
    }
}
