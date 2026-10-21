import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeSoundtrackRouteTests:XCTestCase {
    func testOverallThemeReductionSurvivesRoutesResultHookAndForegroundRecovery() {
        let transport=Transport()
        let owner=NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true})
        defer{owner.dispose()}
        owner.setMenu()
        XCTAssertEqual(transport.volumes.last!,0.578*0.8*0.7,accuracy:0.00000001)
        owner.setJourneyGameplay()
        XCTAssertEqual(transport.volumes.last!,0.19074*0.8*0.7,accuracy:0.00000001)
        let release=owner.beginResultHook()
        XCTAssertEqual(transport.volumes.last!,0)
        release()
        XCTAssertEqual(transport.volumes.last!,0.578*0.8*0.7,accuracy:0.00000001)
        owner.setJourneyGameplay()
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.volumes.last!,0.19074*0.8*0.7,accuracy:0.00000001)
        owner.apply(enabled:false);owner.apply(enabled:true)
        XCTAssertEqual(transport.volumes.last!,0.19074*0.8*0.7,accuracy:0.00000001)
    }
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
        var volumes:[Double] = []
        func perform(id:String,op:String,body:[String:Any],replyHandler:@escaping (Any?,String?)->Void) {
            XCTAssertEqual(id,"soundtrack-native-main")
            if let volume=body["volume"] as? Double {volumes.append(volume)}
            commands.append(op);replyHandler(["position":0],nil)
        }
    }
}
