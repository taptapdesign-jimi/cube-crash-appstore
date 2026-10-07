import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeSoundtrackRouteTests:XCTestCase {
    func testMusicOffAndDisposalRevokeForegroundRecovery() {
        let transport = Transport()
        let owner = NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport)
        owner.apply(enabled:false)
        let count = transport.commands.count
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.commands.count,count)
        XCTAssertEqual(transport.commands.last,"dispose")
        owner.dispose()
        let disposedCount = transport.commands.count
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.commands.count,disposedCount)
    }
    func testBackgroundRetiresCurrentVoiceWithoutNewAllocation() {
        let transport = Transport()
        let owner = NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(transport.commands,["pause"])
        owner.setMenu();owner.setJourneyGameplay()
        XCTAssertEqual(transport.commands,["pause"])
        owner.dispose()
    }
    private final class Transport:NativeSoundtrackTransport {
        var commands:[String] = []
        func perform(id:String,op:String,body:[String:Any],replyHandler:@escaping (Any?,String?)->Void) {
            commands.append(op);replyHandler(["position":0],nil)
        }
    }
}
