import XCTest
import AVFoundation
import UIKit
@testable import Stack_to_Six

@MainActor
final class JimiNativeMusicLifecycleTests: XCTestCase {
    func testWebCueCoexistenceKeepsSilentSwitchCategory() {
        XCTAssertEqual(JimiNativeMusic.sessionCategory, .ambient)
    }

    func testOnlyInterruptionBeganSuspendsCurrentVoice() {
        for (type, expected) in [(AVAudioSession.InterruptionType.began, true), (.ended, false)] {
            let notification = Notification(name: AVAudioSession.interruptionNotification,
                object: AVAudioSession.sharedInstance(),
                userInfo: [AVAudioSessionInterruptionTypeKey: type.rawValue])
            XCTAssertEqual(JimiNativeMusic.shouldSuspend(for: notification), expected)
        }
        XCTAssertFalse(JimiNativeMusic.shouldSuspend(for: Notification(name: AVAudioSession.interruptionNotification)))
        XCTAssertFalse(JimiNativeMusic.shouldSuspend(for: Notification(name: AVAudioSession.interruptionNotification,
            userInfo: [AVAudioSessionInterruptionTypeKey: UInt(99)])))
    }

    func testBackgroundAndMediaResetRemainHardSuspendBoundaries() {
        XCTAssertTrue(JimiNativeMusic.shouldSuspend(for: Notification(name: UIApplication.willResignActiveNotification)))
        XCTAssertTrue(JimiNativeMusic.shouldSuspend(for: Notification(name: AVAudioSession.mediaServicesWereResetNotification)))
        XCTAssertFalse(JimiNativeMusic.shouldSuspend(for: Notification(name: UIApplication.didBecomeActiveNotification)))
        XCTAssertFalse(JimiNativeMusic.shouldSuspend(for: Notification(name: AVAudioSession.routeChangeNotification)))
    }
}
