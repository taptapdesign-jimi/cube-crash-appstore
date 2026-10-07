import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeGameplayReturnPreparationTests:XCTestCase {
    @MainActor private final class Harness {
        var revision=1,snapshots=0,prepares=0,exit:(()->Void)?,pending:[()->Void]=[]
        let game=UIViewController()
        var delay=false
        func snapshot(_ id:Int,_ size:CGSize,_ generation:Int)->[String:Any] {
            snapshots += 1
            return ["version":1,"worldID":id,"requestID":"native-return-\(generation)","routeGeneration":generation,"stateRevision":revision,"title":"Forest","contentHeight":1500,
                "mainFrame":["x":0,"y":100,"width":size.width,"height":180],"mainParts":[],
                "units":[["id":"board-1","boardID":1,"frame":["x":30,"y":360,"width":150,"height":200],"cardArt":"assets/close-icon.png","locked":false,"interim":revision==1,"stars":revision==1 ? 0:3,"allowedActions":["play"],"stats":[],"parts":[["asset":"assets/close-icon.png","role":"card","x":20,"y":10,"width":90,"height":133,"rotation":0,"opacity":1,"zIndex":2]]]]]
        }
        func services()->NativeAppServices {
            NativeAppServices(settings:{["gameSoundsEnabled":false,"musicEnabled":false,"hapticsEnabled":false]},setPreference:{_,_ in},worldSnapshot:{[self] in snapshot($0,$1,$2)},markViewed:{_ in},makeGameplay:{[self] _,exit in self.exit=exit;return game},flush:{},prepareReturnWorld:{[self] world,completion in prepares += 1;if delay{pending.append{world.prepare(completion:completion)}}else{world.prepare(completion:completion)}})
        }
    }
    private func waitUntil(_ test:()->Bool) async throws {
        for _ in 0..<600 {if test(){return};try await Task.sleep(nanoseconds:10_000_000)}
        XCTFail("Native presentation receipt did not arrive within6s")
    }
    private func launch(_ harness:Harness) async throws ->(NativeAppController,UIWindow) {
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:harness.services())
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible();app.loadViewIfNeeded()
        app.navigate(.world(1),interrupt:true);try await waitUntil{app.world?.isReadyForInput==true}
        app.world?.onRequest?("play",1);try await waitUntil{app.route == .gameplay}
        return(app,window)
    }
    func testActualWorldPreparationReconcilesCurrentProgressAndConsumesWithoutColdRepeat() async throws {
        let harness=Harness(),(app,window)=try await launch(harness)
        defer{app.dispose();window.isHidden=true}
        harness.revision=2
        let prepared=expectation(description:"Original art and hidden World pose ready")
        app.prepareGameplayReturn{ready in XCTAssertTrue(ready);prepared.fulfill()}
        await fulfillment(of:[prepared],timeout:5)
        let world=try XCTUnwrap(app.world)
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(world.isHidden);XCTAssertFalse(world.isReadyForInput)
        XCTAssertTrue(app.hasPreparedGameplayReturn);XCTAssertEqual(harness.game.view.alpha,1)
        XCTAssertFalse(harness.game.view.isUserInteractionEnabled)
        XCTAssertEqual(world.snapshot.revision,2);XCTAssertEqual(world.snapshot.units.first?.stars,3)
        XCTAssertNotNil(world.header.layer.animation(forKey:"world.return.prime"))
        let count=harness.snapshots,prepares=harness.prepares
        XCTAssertTrue(app.hideGameplayForPreparedReturn());XCTAssertEqual(harness.game.view.alpha,0)
        harness.exit?();XCTAssertEqual(app.route,.world(1));XCTAssertTrue(app.world===world)
        XCTAssertEqual(harness.snapshots,count);XCTAssertEqual(harness.prepares,prepares)
        XCTAssertNil(world.header.layer.animation(forKey:"world.return.prime"))
        let enter=try XCTUnwrap(world.header.layer.animation(forKey:"world.enter") as? CAAnimationGroup)
        XCTAssertLessThanOrEqual(enter.beginTime-CACurrentMediaTime(),0.03,"Terminal enter has no source80ms World-entry lead")
        try await waitUntil{world.isReadyForInput};XCTAssertFalse(app.hasPreparedGameplayReturn)
    }
    func testBackgroundRejectsJoinedLateReceiptOnceAndFreshForegroundLeaseMayPrepare() async throws {
        let harness=Harness(),(app,window)=try await launch(harness)
        defer{app.dispose();window.isHidden=true}
        harness.delay=true;var receipts:[Bool]=[]
        app.prepareGameplayReturn{receipts.append($0)};app.prepareGameplayReturn{receipts.append($0)}
        XCTAssertEqual(harness.prepares,1);XCTAssertEqual(harness.pending.count,1)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(receipts,[false,false]);XCTAssertEqual(harness.game.view.alpha,1)
        XCTAssertFalse(app.hideGameplayForPreparedReturn())
        harness.pending.removeFirst()();try await Task.sleep(nanoseconds:50_000_000)
        XCTAssertEqual(receipts,[false,false]);XCTAssertFalse(app.hasPreparedGameplayReturn)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        harness.delay=false;let ready=expectation(description:"Fresh foreground readiness")
        app.prepareGameplayReturn{accepted in receipts.append(accepted);ready.fulfill()}
        await fulfillment(of:[ready],timeout:5);XCTAssertEqual(receipts,[false,false,true]);XCTAssertTrue(app.hasPreparedGameplayReturn)
        app.cancelGameplayReturnPreparation();XCTAssertFalse(app.hasPreparedGameplayReturn)
        XCTAssertNil(app.world?.header.layer.animation(forKey:"world.return.prime"))
    }
    func testDisposeRetiresPendingCallbackAndLateResourceCompletionCannotHideGameplay() async throws {
        let harness=Harness(),(app,window)=try await launch(harness)
        defer{window.isHidden=true}
        harness.delay=true;var receipts:[Bool]=[]
        app.prepareGameplayReturn{receipts.append($0)};app.dispose();app.dispose()
        XCTAssertEqual(receipts,[false]);harness.pending.removeFirst()()
        try await Task.sleep(nanoseconds:50_000_000)
        XCTAssertEqual(receipts,[false]);XCTAssertFalse(app.hasPreparedGameplayReturn)
        XCTAssertFalse(app.hideGameplayForPreparedReturn());XCTAssertEqual(harness.game.view.alpha,1)
    }
    func testActualNativeResourceCancellationRejectsQueuedAdoptionAndRetainsWarmArtwork() async throws {
        let resources=JimiNativeWorldResources(root:NativeTestResources.root)
        defer{resources.cleanup()}
        let retired=expectation(description:"Cancelled queued decode replies once")
        resources.prepare(["assets/close-icon.png"],owner:1){accepted in XCTAssertFalse(accepted);retired.fulfill()}
        resources.cancelPendingPreparation();await fulfillment(of:[retired],timeout:5)
        XCTAssertEqual(resources.decodedBytes,0)
        let ready=expectation(description:"Fresh original artwork request")
        resources.prepare(["assets/close-icon.png"],owner:1){accepted in XCTAssertTrue(accepted);ready.fulfill()}
        await fulfillment(of:[ready],timeout:5)
        let original=try XCTUnwrap(resources.image("assets/close-icon.png",owner:1)),bytes=resources.decodedBytes
        XCTAssertGreaterThan(bytes,0);resources.cancelPendingPreparation()
        XCTAssertEqual(resources.decodedBytes,bytes);XCTAssertTrue(resources.image("assets/close-icon.png",owner:1)===original)
    }
    func testActualBeachAmbientCancelledDecodeCannotPoisonFreshReturnAdmission() async throws {
        let frame:(Double)->[String:Any]={time in ["time":time,"x":50.0,"y":350.0,"width":10.0,"height":10.0,"rotation":0.0,"opacity":1.0,"depth":"front","asset":"./assets/shop/bottle/bottle animation pack/bubble1.png"]}
        let raw:[String:Any]=["version":1,"worldID":2,"requestID":"cancelled-beach","routeGeneration":2,"stateRevision":1,"title":"Beach","contentHeight":1500,
            "mainFrame":["x":0,"y":100,"width":390,"height":180],"mainParts":[],
            "units":[["id":"board-11","boardID":11,"frame":["x":30,"y":360,"width":150,"height":200],"locked":false,"interim":false,"parts":[]]],
            "ambientSessionID":1,"ambientPlans":[["worldID":2,"id":0,"duration":1.0,"frames":[frame(0),frame(1)]]]]
        let world=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root)))
        world.frame=CGRect(x:0,y:0,width:390,height:844);defer{world.cleanup()}
        let retired=expectation(description:"Cancelled World.prepare still settles its bounded callbacks")
        world.prepare{retired.fulfill()};world.cancelPendingPreparation()
        await fulfillment(of:[retired],timeout:5)
        XCTAssertFalse(world.preparationHasMissingResources,"Cancellation is distinct from unavailable authored artwork")
        let fresh=expectation(description:"Fresh Beach original bubble/artwork readiness")
        world.prepare{fresh.fulfill()};await fulfillment(of:[fresh],timeout:5)
        XCTAssertFalse(world.preparationHasMissingResources);XCTAssertTrue(world.primeHiddenReturnPose())
    }
}
