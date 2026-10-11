import XCTest
import UIKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeAppCoordinatorTests:XCTestCase {
    private func resources()->URL {
        Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!
    }
    func testHomeInputWaitsForActualEnterCompletion()async throws {
        let services=NativeAppServices(settings:{["gameSoundsEnabled":false,"musicEnabled":false,"hapticsEnabled":false]},
            setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},
            makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true}
        XCTAssertFalse(controller.home.isUserInteractionEnabled)
        let deadline=Date().addingTimeInterval(5)
        while !controller.home.isUserInteractionEnabled,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(controller.home.isUserInteractionEnabled)
        XCTAssertEqual(controller.route,.home)
        controller.home.navigationButtonViews[1].sendActions(for:.touchUpInside)
        XCTAssertEqual(controller.home.selectedSlide,1)
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
    func testHubWorldPreparationOverlapsExitAndReadinessCannotRevealEarly()async throws {
        var replies:[()->Void]=[]
        let (controller,window)=try worldEntryFixture{_,completion in replies.append(completion)}
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1))
        XCTAssertEqual(replies.count,1,"Destination work must start at the tap, while Hub exit still owns the screen")
        XCTAssertEqual(controller.route,.hub);XCTAssertFalse(controller.hub.isHidden)
        XCTAssertTrue(try XCTUnwrap(controller.world).isHidden)
        replies[0]()
        XCTAssertEqual(controller.route,.hub,"Resource completion cannot replace the actual exit completion")
        try await waitFor{controller.route == .world(1) && controller.world?.isReadyForInput==true}
        XCTAssertEqual(replies.count,1,"Reveal must consume the same prepared destination")
    }
    func testCancelledHubWorldPreparationCannotRevealAndWarmWorldIsReused()async throws {
        var replies:[()->Void]=[]
        let (controller,window)=try worldEntryFixture{_,completion in replies.append(completion)}
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1));let prepared=try XCTUnwrap(controller.world)
        controller.navigate(.home,interrupt:true);replies[0]()
        try await waitFor{controller.route == .home && controller.home.isUserInteractionEnabled}
        XCTAssertTrue(prepared.isHidden)
        controller.navigate(.hub)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1));XCTAssertEqual(replies.count,2)
        XCTAssertTrue(controller.world === prepared,"Cancellation must retain the same warm World")
        replies[0]();XCTAssertEqual(controller.route,.hub)
        replies[1]()
        try await waitFor{controller.route == .world(1) && controller.world?.isReadyForInput==true}
    }
    func testBackgroundRetiresPendingWorldPreparationAndResumeUsesFreshReceipt()async throws {
        var replies:[()->Void]=[]
        let (controller,window)=try worldEntryFixture{_,completion in replies.append(completion)}
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1))
        try await waitFor{controller.route == .world(1)}
        let prepared=try XCTUnwrap(controller.world)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        replies[0]();XCTAssertTrue(prepared.isHidden)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(replies.count,2);XCTAssertTrue(controller.world === prepared)
        replies[0]();XCTAssertTrue(prepared.isHidden)
        replies[1]()
        try await waitFor{controller.world?.isReadyForInput==true}
    }
    func testBackgroundDuringHubExitRestartsRetiredDestinationAfterActualExit()async throws {
        var replies:[()->Void]=[]
        let (controller,window)=try worldEntryFixture{_,completion in replies.append(completion)}
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.hub,interrupt:true)
        try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
        controller.navigate(.world(1));XCTAssertEqual(replies.count,1)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        replies[0]();XCTAssertEqual(controller.route,.hub)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await waitFor{replies.count==2 && controller.route == .world(1)}
        replies[0]();XCTAssertTrue(try XCTUnwrap(controller.world).isHidden)
        replies[1]()
        try await waitFor{controller.world?.isReadyForInput==true}
    }
    private func worldEntryFixture(prepare:@escaping(JimiNativeWorldView,@escaping()->Void)->Void)throws->(NativeAppController,UIWindow){
        let layouts=try NativeWorldLayouts()
        var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},
            worldSnapshot:{world,size,generation in try layouts.snapshot(world:world,width:size.width,height:size.height,generation:generation,progression:progression)},
            markViewed:{_ in},makeGameplay:{_,_ in throw FixtureError.unavailable},flush:{})
        services.prepareWorldEntry=prepare
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        return (controller,window)
    }
    private func waitFor(_ condition:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(5)
        while !condition(),Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(condition())
    }
    func testSelectedGameplayPreparationOverlapsWorldExitAndJoinsBothReceipts()async throws {
        for resourcesFinishFirst in [true,false] {
            var replies:[(Bool)->Void]=[],made=0
            let layouts=try NativeWorldLayouts()
            var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
            var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{world,size,generation in
                try layouts.snapshot(world:world,width:size.width,height:size.height,generation:generation,progression:progression)
            },markViewed:{_ in},makeGameplay:{_,_ in made+=1;return UIViewController()},flush:{})
            services.prepareGameplayEntry={_,completion in replies.append(completion)}
            let controller=NativeAppController(resourceRoot:resources(),services:services)
            let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
            defer{controller.dispose();window.isHidden=true}
            controller.navigate(.hub,interrupt:true)
            try await waitFor{controller.route == .hub && controller.hub.scrollView.isUserInteractionEnabled}
            controller.navigate(.world(1))
            try await waitFor{controller.world?.isReadyForInput==true}
            controller.world?.onRequest?("play",1)
            XCTAssertEqual(replies.count,1,"Selected resources start at Play alongside the authored World exit")
            XCTAssertEqual(made,0);XCTAssertEqual(controller.route,.world(1))
            if resourcesFinishFirst {
                replies[0](true);XCTAssertEqual(made,0,"Ready textures cannot bypass actual World exit")
            }else{
                try await Task.sleep(for:.seconds(2))
                XCTAssertEqual(made,0,"Finished exit cannot bypass the real resource receipt")
                replies[0](true)
            }
            try await waitFor{controller.route == .gameplay}
            XCTAssertEqual(made,1);replies[0](true);XCTAssertEqual(made,1)
        }
    }
    func testBackgroundCancellationCannotLaunchFromLateSelectedEntryReceipt()async throws {
        var replies:[(Bool)->Void]=[],made=0,cancels=0
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw FixtureError.unavailable},markViewed:{_ in},makeGameplay:{_,_ in made+=1;return UIViewController()},flush:{})
        services.prepareGameplayEntry={_,completion in replies.append(completion)}
        services.cancelGameplayEntry={cancels+=1}
        let controller=NativeAppController(resourceRoot:resources(),services:services)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true}
        controller.navigate(.gameplay,interrupt:true)
        try await waitFor{replies.count==1}
        let oldCancels=cancels
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertGreaterThan(cancels,oldCancels)
        replies[0](true);XCTAssertEqual(made,0)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await waitFor{controller.route == .home && controller.home.isUserInteractionEnabled}
        replies[0](true);XCTAssertEqual(made,0)
    }
    private func containsWebView(_ view:UIView)->Bool {
        NSStringFromClass(type(of:view)).contains("WKWebView") || view.subviews.contains(where:containsWebView)
    }
}
private enum FixtureError:Error {case unavailable}
