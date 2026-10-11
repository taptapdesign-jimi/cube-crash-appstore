import XCTest
import SpriteKit
@testable import Stack_to_Six
@testable import StackToSixGameplay

nonisolated final class NativeMeterSceneCapabilitiesTests:XCTestCase {
    @MainActor private final class Wall {var value=0.0}
    @MainActor func testActualSceneQueueFullGridDeliversTwelveEmptyWaitsThenCanonicalSaveAndCaptured600Retry()async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let wall=Wall(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall.value})
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5}),signals=NativeMeterQueueSignals()
        let tiles=(0..<9).flatMap{row in (0..<5).map{col in NativeTile(id:"full:\(row):\(col)",cell:.init(column:col,row:row),value:1)}}
        let engine=NativeGameplayEngine(state:.init(tiles:tiles,wildMeter:1.25)),scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let resources=NativeWildMeterDropResources(root:root),view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let controller=UIViewController();controller.view=view;window.rootViewController=controller
        let scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        var waits=0,failed=0,progress=false,saves:[Int]=[]
        let saved=expectation(description:"actual Scene queue finally requests canonical save400")
        scene.onRenderingDemand={if $0{view.isPaused=false}}
        scene.onGameplayEvent={event in if event.kind == .meterDropOpenRetryPrepared {waits+=1};if event.kind == .meterDropOpenFailed {failed+=1}}
        scene.onPresentationFailure={XCTFail($0)}
        XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in XCTFail("full grid cannot select a tile")},carrierAudio:{_,_,_ in XCTFail("full grid cannot start carrier");return {}},dividerMask:{{}},landing:{_,_ in XCTFail("full grid cannot land")}))
        XCTAssertTrue(scene.configureSourceMeterQueue(scope:scope,signals:signals,permission:{inProgress in inProgress ? .block("wild-spawn-in-progress"):.allow},continuation:{engine.state.wildMeter>=1-0.000001 && !engine.flags.busyEnding},meterReady:{engine.state.wildMeter>=1-0.000001},enqueue:{action in DispatchQueue.main.async{action()}},queueInProgress:{progress=$0},shimmer:{},canonicalSave:{saves.append($0);saved.fulfill()},validateInstallation:{
            XCTAssertEqual(scene.captureSourceMeterQueueSignals(),.init(generation:engine.state.generation,inProgress:false,retryPending:false))
            return true
        }))
        defer{scene.dispose();signals.dispose();context.dispose();service.dispose();resources.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible();view.presentScene(scene)
        // Entry invokes real Scene.evaluate and consume. No bridge.receive or
        // fake wall callbacks: only the existing app timeout owner delivers.
        await fulfillment(of:[saved],timeout:10)
        XCTAssertEqual(waits,12);XCTAssertEqual(failed,1);XCTAssertEqual(saves,[400]);XCTAssertFalse(progress)
        XCTAssertEqual(scene.captureSourceMeterQueueSignals(),.init(generation:engine.state.generation,inProgress:false,retryPending:true))
        XCTAssertTrue(engine.sourceWildRetryPending);XCTAssertNil(engine.pendingMeterOpenRetry)
        XCTAssertEqual(engine.state.wildMeter,1.25);XCTAssertEqual(engine.state.wildSpawnCount,0)
        scene.dispose();XCTAssertFalse(engine.sourceWildRetryPending)
        XCTAssertNil(scene.captureSourceMeterQueueSignals())
        XCTAssertFalse(scene.configureSourceMeterQueue(scope:scope,signals:signals,permission:{_ in XCTFail("retired admission");return .allow},continuation:{true},meterReady:{true},enqueue:{$0()},queueInProgress:{_ in},shimmer:{},canonicalSave:{_ in XCTFail("retired save")}))
    }
    @MainActor func testMissingInitialEnvironmentRetiresOnlyItsInstalledQueueAndAllowsRealRetry()throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let context=NativeGameplaySourceContext(service:service),signals=NativeMeterQueueSignals()
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2)]))
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844)),resources=NativeWildMeterDropResources(root:root)
        let scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        defer{scene.dispose();signals.dispose();context.dispose();service.dispose();resources.dispose()}
        XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in},carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in}))
        func install(_ accepted:Bool)->Bool {
            scene.configureSourceMeterQueue(scope:scope,signals:signals,permission:{_ in XCTFail("installation cannot query permission");return .block("unavailable")},continuation:{true},meterReady:{true},enqueue:{_ in XCTFail("installation cannot enqueue")},queueInProgress:{_ in},shimmer:{XCTFail("installation cannot shimmer")},canonicalSave:{_ in XCTFail("installation cannot save")},validateInstallation:{
                XCTAssertEqual(scene.captureSourceMeterQueueSignals(),.init(generation:engine.state.generation,inProgress:false,retryPending:false))
                return accepted
            })
        }
        let before=engine.state
        XCTAssertFalse(install(false));XCTAssertNil(scene.captureSourceMeterQueueSignals())
        XCTAssertTrue(scope.current);XCTAssertEqual(engine.state,before)
        XCTAssertTrue(install(true));XCTAssertNotNil(scene.captureSourceMeterQueueSignals())
        XCTAssertEqual(engine.state,before)
    }
    @MainActor func testActualSceneLandingUsesCapturedBoardOriginAndExistingSourceUnionThenRetires()async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let wall=Wall(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall.value})
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5}),signals=NativeMeterQueueSignals()
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3)],wildMeter:1.25),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star,variant:"cubero")})
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844)),resources=NativeWildMeterDropResources(root:root)
        let view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844)),controller=UIViewController();controller.view=view;window.rootViewController=controller
        let scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        var prepared=false,landings=0,saves:[Int]=[]
        let ready=expectation(description:"actual selected carrier prepared"),saved=expectation(description:"successful actual queue finally"),unlock=expectation(description:"independent real wall140 after Source finally")
        scene.onRenderingDemand={if $0{view.isPaused=false}};scene.onPresentationFailure={XCTFail($0)}
        scene.onGameplayEvent={event in if event.kind == .meterDropPrepared,!prepared{prepared=true;ready.fulfill()};if event.kind == .meterDropHandoffUnlocked{unlock.fulfill()}}
        XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in},carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in XCTFail("configured source must not call legacy landing")}))
        XCTAssertTrue(scene.configureSourceMeterQueue(scope:scope,signals:signals,permission:{$0 ? .block("wild-spawn-in-progress"):.allow},continuation:{engine.state.wildMeter>=1-0.000001 && !engine.flags.busyEnding},meterReady:{engine.state.wildMeter>=1-0.000001},enqueue:{action in DispatchQueue.main.async{action()}},queueInProgress:{_ in},shimmer:{},canonicalSave:{saves.append($0);saved.fulfill()}))
        XCTAssertTrue(scene.configureSourceMeterLanding(scope:scope,sound:{landings+=1}))
        defer{scene.dispose();signals.dispose();context.dispose();service.dispose();resources.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible();view.presentScene(scene)
        await fulfillment(of:[ready],timeout:10)
        let drop=try XCTUnwrap(engine.meterDropReservations.values.first),canvas=try XCTUnwrap(scene.childNode(withName:"native-gameplay-canvas")),node=try XCTUnwrap(canvas.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==drop.tileID})
        for time in stride(from:16.0,through:2000.0,by:16){wall.value=time;service.deliver(wallMilliseconds:time)}
        await fulfillment(of:[saved,unlock],timeout:10)
        XCTAssertEqual(landings,1);XCTAssertEqual(saves,[400]);XCTAssertEqual(engine.state.wildSpawnCount,1)
        XCTAssertFalse(node.isHidden);XCTAssertEqual(node.alpha,1);XCTAssertFalse(node.sourceIdleDeferred)
        XCTAssertEqual(scope.smoke.activeOwnerCount,1);XCTAssertGreaterThan(scope.smokeSession.pool.activeCount,0)
        let layers=canvas.children.filter{$0.zPosition==CGFloat(Float(-0.001)) && !$0.children.isEmpty}
        XCTAssertEqual(layers.count,1)
        if let smoke=layers.first{XCTAssertEqual(smoke.position,node.position);XCTAssertEqual(smoke.xScale,node.xScale)}
        for time in stride(from:2016.0,through:3400.0,by:16){wall.value=time;service.deliver(wallMilliseconds:time)}
        XCTAssertEqual(scope.smoke.activeOwnerCount,0);XCTAssertEqual(scope.smokeSession.pool.activeCount,0);XCTAssertEqual(service.activeParticipantCount,0)
        scene.dispose();XCTAssertFalse(scene.configureSourceMeterLanding(scope:scope,sound:{XCTFail("retired sound")}))
    }
}
