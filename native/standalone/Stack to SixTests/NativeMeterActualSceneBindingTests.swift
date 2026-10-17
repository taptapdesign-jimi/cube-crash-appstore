import XCTest
import SpriteKit
@testable import Stack_to_Six
@testable import StackToSixGameplay

nonisolated final class NativeMeterActualSceneBindingTests:XCTestCase {
    @MainActor private final class Wall {var value=0.0}
    @MainActor func testConfigureActualSceneEvaluateHiddenSelectionAndActualDidFinishUpdateHandoff()async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let wall=Wall(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall.value})
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5})
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3)],wildMeter:1.25),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star,variant:"cubero")})
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let resources=NativeWildMeterDropResources(root:root),view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let controller=UIViewController();controller.view=view;window.rootViewController=controller
        let scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        let ready=expectation(description:"actual Scene consumed assets receipt"),bookkeeping=expectation(description:"actual Scene consumed Source finally bookkeeping"),unlock=expectation(description:"independent wall140 unlock")
        var selected=0,prepared=false
        scene.onRenderingDemand={demand in if demand{view.isPaused=false}}
        scene.onGameplayEvent={event in
            if event.kind == .meterDropPrepared,!prepared{prepared=true;ready.fulfill()}
            if event.kind == .meterDropCompleted{bookkeeping.fulfill()}
            if event.kind == .meterDropHandoffUnlocked{unlock.fulfill()}
        }
        scene.onPresentationFailure={XCTFail($0)}
        func actualNode(_ id:String)->NativeDiceNode? {scene.childNode(withName:"native-gameplay-canvas")?.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==id}}
        XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{tile,_ in
            selected+=1;XCTAssertEqual(engine.state.wildMeter,1.25)
            XCTAssertEqual(actualNode(tile.id)?.variant,"cubero");XCTAssertTrue(actualNode(tile.id)?.sourceIdleDeferred==true)
        },carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in}))
        defer{scene.dispose();context.dispose();service.dispose();resources.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible();view.presentScene(scene)
        // Board entry invokes real Scene.evaluate. No private caller.receive,
        // cloned Node, manual includesReplacement or synthetic Scene frame.
        await fulfillment(of:[ready],timeout:10)
        XCTAssertEqual(selected,1)
        let drop=try XCTUnwrap(engine.meterDropReservations.values.first),node=try XCTUnwrap(actualNode(drop.tileID))
        XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.alpha,0)
        var clock=0.0
        while clock<2000{clock=min(2000,clock+16);wall.value=clock;service.deliver(wallMilliseconds:clock)}
        await fulfillment(of:[bookkeeping,unlock],timeout:10)
        XCTAssertTrue(actualNode(drop.tileID) === node);XCTAssertFalse(node.isHidden);XCTAssertEqual(node.alpha,1);XCTAssertFalse(node.sourceIdleDeferred);XCTAssertFalse(engine.sourceMeterHandoffInProgress)
        XCTAssertEqual(engine.state.wildSpawnCount,1);XCTAssertEqual(service.activeParticipantCount,0)
        // Captured binding teardown leaves default caller staging unchanged;
        // the terminal Scene must reject new config before any construction.
        scene.dispose()
        XCTAssertFalse(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in XCTFail("retired preparation")},carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in XCTFail("retired landing")}))
    }
    @MainActor func testActualBeeMeterLandedStartsTypedFramesThroughSharedSourceIdle()async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let wall=Wall(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall.value},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3)],wildMeter:1.25),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star,variant:"bee")})
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let resources=NativeWildMeterDropResources(root:root),view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let controller=UIViewController();controller.view=view;window.rootViewController=controller
        let scope=try XCTUnwrap(context.beginScene(engine:engine,retire:{[weak scene] in scene?.retireSourceAnimationBindings()}))
        let ready=expectation(description:"actual Scene consumed assets receipt"),bookkeeping=expectation(description:"actual Scene consumed Source finally bookkeeping"),unlock=expectation(description:"independent wall140 unlock")
        var selected=0,prepared=false
        scene.onRenderingDemand={demand in if demand{view.isPaused=false}}
        scene.onGameplayEvent={event in
            if event.kind == .meterDropPrepared,!prepared{prepared=true;ready.fulfill()}
            if event.kind == .meterDropCompleted{bookkeeping.fulfill()}
            if event.kind == .meterDropHandoffUnlocked{unlock.fulfill()}
        }
        scene.onPresentationFailure={XCTFail($0)}
        func actualNode(_ id:String)->NativeDiceNode? {scene.childNode(withName:"native-gameplay-canvas")?.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==id}}
        scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
        scene.layout(size:scene.size,insets:.zero,animateEntry:false)
        XCTAssertTrue(scene.configureSourceSpecialIdle(scope:scope))
        scene.onSourcePresentationFailure={reason,_ in XCTFail(reason)}
        let warm=expectation(description:"actual retained meter assets")
        resources.prepare(arcade:false,capture:.init(id:"warm",generation:engine.state.generation,epoch:0)) {result in
            if case .failure(let failure)=result {XCTFail("\(failure)")};warm.fulfill()
        }
        await fulfillment(of:[warm],timeout:10)
        XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{tile,_ in
            selected+=1;XCTAssertEqual(engine.state.wildMeter,1.25)
            XCTAssertEqual(actualNode(tile.id)?.variant,"bee");XCTAssertTrue(actualNode(tile.id)?.sourceIdleDeferred==true)
        },carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in}))
        defer{scene.dispose();context.dispose();service.dispose();resources.dispose();fifo.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible()
        XCTAssertTrue(tasks.inputTask{scene.layout(size:scene.size,insets:.zero,animateEntry:false);view.presentScene(scene);scene.evaluate()})
        // Board entry invokes real Scene.evaluate. No private caller.receive,
        // cloned Node, manual includesReplacement or synthetic Scene frame.
        await fulfillment(of:[ready],timeout:10)
        XCTAssertEqual(selected,1)
        let drop=try XCTUnwrap(engine.meterDropReservations.values.first),node=try XCTUnwrap(actualNode(drop.tileID))
        XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.alpha,0)
        // The actual pending-meter APP upload must settle before carrier landing,
        // without releasing deferIdle or committing canonical spawn bookkeeping.
        for _ in 0..<400 {if node.sourceWildSkinReceiptCurrent {break};try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(node.sourceOpenedWildConstructorCurrent)
        XCTAssertTrue(node.sourceWildSkinReceiptCurrent)
        XCTAssertEqual(node.sourceWildSkinAssetPath,"assets/shop/bee/bee1@2x.png")
        XCTAssertTrue(node.sourceIdleDeferred);XCTAssertFalse(node.hasAnimatedArtwork)
        XCTAssertEqual(engine.state.wildSpawnCount,0);XCTAssertEqual(scope.specialIdle.snapshot.running,0)
        var clock=0.0
        while clock<2000{clock=min(2000,clock+16);wall.value=clock;service.deliver(wallMilliseconds:clock)}
        await fulfillment(of:[bookkeeping,unlock],timeout:10)
        XCTAssertTrue(actualNode(drop.tileID) === node);XCTAssertFalse(node.isHidden);XCTAssertEqual(node.alpha,1);XCTAssertFalse(node.sourceIdleDeferred);XCTAssertFalse(engine.sourceMeterHandoffInProgress)
        for _ in 0..<500 {if node.sourceWildSkinReceiptCurrent && node.hasAnimatedArtwork {break};try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(node.sourceWildSkinReceiptCurrent);XCTAssertTrue(node.hasSourceSkinHitArea)
        XCTAssertTrue(node.hasAnimatedArtwork);XCTAssertEqual(scope.specialIdle.snapshot.running,1)
        XCTAssertEqual(engine.state.wildSpawnCount,1)
        // Captured binding teardown leaves default caller staging unchanged;
        // the terminal Scene must reject new config before any construction.
        scene.dispose()
        XCTAssertFalse(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in XCTFail("retired preparation")},carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in XCTFail("retired landing")}))
    }
    @MainActor func testActualSourcePlainStarMeterDefersAtlasUntilGenuineLandingAndKeepsOneScopeOwner()async throws {
        try await runActualSourcePlainStarMeter(scenario:.ordinary)
    }
    @MainActor func testActualSourcePlainStarMeterWaitsForSuspendedRegistryBeforeAtlasResourceWork()async throws {
        try await runActualSourcePlainStarMeter(scenario:.suspended)
    }
    @MainActor func testActualSourcePlainStarMeterScopeRetirementRevokesPendingAtlasBeforeRegistryRelease()async throws {
        try await runActualSourcePlainStarMeter(scenario:.retirePending)
    }
    @MainActor func testActualLiveSourceStarSheetPreservesBaseSuppressionThroughFourthAndAsyncSkinPaint()async throws {
        try await runActualSourcePlainStarMeter(scenario:.staticRepaint)
    }
    @MainActor func testActualStarProjectionFollowsBoardExitWithoutAdvancingIdle()async throws {
        try await runActualSourcePlainStarMeter(scenario:.boardExit)
    }
    private enum SourceStarMeterScenario {case ordinary,suspended,retirePending,staticRepaint,boardExit}
    @MainActor private func runActualSourcePlainStarMeter(scenario:SourceStarMeterScenario)async throws {

        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let wall=Wall(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall.value},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3)],wildMeter:1.25),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star)})
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let resources=NativeWildMeterDropResources(root:root),view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let controller=UIViewController();controller.view=view;window.rootViewController=controller
        let scope=try XCTUnwrap(context.beginScene(engine:engine,retire:{[weak scene] in scene?.retireSourceAnimationBindings()}))
        let releaseIdle: (() -> Void)? = (scenario == .suspended || scenario == .retirePending) ? try XCTUnwrap(scope.specialIdle.acquire(reason:"actual-meter-star-before-landing")) : nil
        defer{releaseIdle?()}
        let ready=expectation(description:"actual Scene consumed assets receipt"),bookkeeping=expectation(description:"actual Scene consumed Source finally bookkeeping"),unlock=expectation(description:"independent wall140 unlock")
        var selected=0,prepared=false
        scene.onRenderingDemand={demand in if demand{view.isPaused=false}}
        scene.onGameplayEvent={event in
            if event.kind == .meterDropPrepared,!prepared{prepared=true;ready.fulfill()}
            if event.kind == .meterDropCompleted{bookkeeping.fulfill()}
            if event.kind == .meterDropHandoffUnlocked{unlock.fulfill()}
        }
        scene.onPresentationFailure={XCTFail($0)}
        func actualNode(_ id:String)->NativeDiceNode? {scene.childNode(withName:"native-gameplay-canvas")?.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==id}}
        scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
        scene.layout(size:scene.size,insets:.zero,animateEntry:false)
        XCTAssertTrue(scene.configureSourceSpecialIdle(scope:scope))
        XCTAssertTrue(scene.configureSourcePlainStarHalos(scope:scope,performanceNow:{wall.value},waitForSharedIdle:true))
        scene.onSourcePresentationFailure={reason,_ in XCTFail(reason)}
        let warm=expectation(description:"actual retained meter assets")
        resources.prepare(arcade:false,capture:.init(id:"warm",generation:engine.state.generation,epoch:0)) {result in
            if case .failure(let failure)=result {XCTFail("\(failure)")};warm.fulfill()
        }
        await fulfillment(of:[warm],timeout:10)
        XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{tile,_ in
            selected+=1;XCTAssertEqual(engine.state.wildMeter,1.25)
            XCTAssertNil(actualNode(tile.id)?.variant);XCTAssertTrue(actualNode(tile.id)?.sourceIdleDeferred==true)
        },carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in}))
        defer{scene.dispose();context.dispose();service.dispose();resources.dispose();fifo.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible()
        XCTAssertTrue(tasks.inputTask{scene.layout(size:scene.size,insets:.zero,animateEntry:false);view.presentScene(scene);scene.evaluate()})
        // Board entry invokes real Scene.evaluate. No private caller.receive,
        // cloned Node, manual includesReplacement or synthetic Scene frame.
        await fulfillment(of:[ready],timeout:10)
        XCTAssertEqual(selected,1)
        let drop=try XCTUnwrap(engine.meterDropReservations.values.first),node=try XCTUnwrap(actualNode(drop.tileID))
        XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.alpha,0)
        // The actual pending-meter APP upload must settle before carrier landing,
        // without releasing deferIdle or committing canonical spawn bookkeeping.
        for _ in 0..<400 {if node.sourceWildSkinReceiptCurrent {break};try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(node.sourceOpenedWildConstructorCurrent)
        XCTAssertTrue(node.sourceWildSkinReceiptCurrent)
        XCTAssertEqual(node.sourceWildSkinAssetPath,"assets/wild.png")
        XCTAssertTrue(node.sourceIdleDeferred);XCTAssertFalse(node.hasAnimatedArtwork)
        XCTAssertNil(node.sourcePlainStarArtworkSprite);XCTAssertEqual(node.sourceLiveStarHaloCount,0)
        XCTAssertEqual(engine.state.wildSpawnCount,0);XCTAssertEqual(scope.specialIdle.snapshot.running,0)
        var clock=0.0
        while clock<2000{clock=min(2000,clock+16);wall.value=clock;service.deliver(wallMilliseconds:clock)}
        await fulfillment(of:[bookkeeping,unlock],timeout:10)
        XCTAssertTrue(actualNode(drop.tileID) === node);XCTAssertFalse(node.isHidden);XCTAssertEqual(node.alpha,1);XCTAssertFalse(node.sourceIdleDeferred);XCTAssertFalse(engine.sourceMeterHandoffInProgress)
        if scenario == .suspended || scenario == .retirePending {
            XCTAssertEqual(scope.specialIdle.snapshot.pending,1);XCTAssertEqual(scope.specialIdle.snapshot.running,0)
            XCTAssertNil(node.sourcePlainStarArtworkSprite)
            XCTAssertNil(node.sourcePlainStarSharedAtlasTexture,"Original pending registry performs no atlas resource work")
            if scenario == .retirePending {
                scope.dispose();releaseIdle?()
                scene.didFinishUpdate();scene.didFinishUpdate()
                XCTAssertNil(node.sourcePlainStarArtworkSprite);XCTAssertNil(node.sourcePlainStarSharedAtlasTexture)
                XCTAssertEqual(node.sourceLiveStarHaloCount,0);XCTAssertTrue(scope.specialIdle.registeredKeys.isEmpty)
                XCTAssertEqual(engine.state.wildSpawnCount,1)
                return
            }
            XCTAssertTrue(tasks.inputTask{releaseIdle?()})
        }
        for _ in 0..<500 {if node.sourceWildSkinReceiptCurrent && node.sourcePlainStarArtworkSprite?.isHidden==false {break};try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(node.sourceWildSkinReceiptCurrent);XCTAssertTrue(node.hasSourceSkinHitArea)
        XCTAssertTrue(node.hasAnimatedArtwork);XCTAssertEqual(scope.specialIdle.snapshot.running,1)
        let artwork=try XCTUnwrap(node.sourcePlainStarArtworkSprite)
        XCTAssertFalse(artwork.isHidden);XCTAssertEqual(node.sourceLiveStarHaloCount,2)
        if scenario == .staticRepaint {
            let face=try XCTUnwrap(node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === node.sourcePaintedNumbersTexture})
            XCTAssertTrue(face.isHidden)
            let elapsedBeforePaint=node.sourcePlainStarArtworkElapsedMilliseconds
            XCTAssertTrue(node.paintSourceTutorialWildFace(generation:engine.state.generation,current:{scope.current}))
            XCTAssertEqual(node.sourcePlainStarArtworkElapsedMilliseconds,elapsedBeforePaint,"Repaint must retain the live sheet phase without advancing it")
            XCTAssertTrue(face.isHidden,"Original fourth Wild repaint keeps sheet-owned base render suppression")
            XCTAssertTrue(node.sourcePlainStarArtworkSprite === artwork)
            let done=expectation(description:"actual cached Source skin paint publication")
            let previousReady=node.onResourceReady
            var published=false
            node.onResourceReady={
                previousReady?()
                if !published {
                    published=true
                    XCTAssertTrue(face.isHidden,"Actual typed skin receipt must not expose static face under live sheet")
                    XCTAssertTrue(node.sourcePlainStarArtworkSprite === artwork)
                    done.fulfill()
                }
            }
            XCTAssertTrue(tasks.inputTask {
                XCTAssertTrue(scene.repairSourceWildSkin(tileID:node.tileID,scope:scope,startSourceIdle:{
                    scene.beginSourcePlainStarHalo(node,introBounce:false)
                }))
            })
            await fulfillment(of:[done],timeout:5)
            node.onResourceReady=previousReady
            XCTAssertTrue(node.sourcePlainStarArtworkSprite === artwork)
        }
        let orbitCount=node.sourceLiveStarHaloCount
        if scenario == .boardExit {
            let projection=try XCTUnwrap(scene.childNode(withName:"//wild-star-artwork-foreground"))
            let elapsed=node.sourcePlainStarArtworkElapsedMilliseconds
            let finished=expectation(description:"Wild board popout")
            scene.animateExit {XCTAssertTrue($0);finished.fulfill()}
            var followedShrink=false
            for _ in 0..<150 {
                if node.xScale>0.01 && node.xScale<0.8 {
                    followedShrink=true
                    XCTAssertLessThan(abs(projection.xScale),0.85)
                    XCTAssertEqual(projection.alpha,node.alpha,accuracy:0.01)
                    break
                }
                try await Task.sleep(for:.milliseconds(5))
            }
            XCTAssertTrue(followedShrink,"Projected Star must shrink during its own board-exit slot")
            await fulfillment(of:[finished],timeout:5)
            try await Task.sleep(for:.milliseconds(40))
            XCTAssertTrue(projection.isHidden || projection.alpha<0.001)
            XCTAssertEqual(node.sourcePlainStarArtworkElapsedMilliseconds,elapsed)
        }
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertTrue(node.sourcePlainStarArtworkSprite === artwork)
        XCTAssertEqual(node.sourceLiveStarHaloCount,orbitCount)
        scope.dispose();XCTAssertNil(node.sourcePlainStarArtworkSprite);XCTAssertNil(artwork.parent)
        XCTAssertEqual(node.sourceLiveStarHaloCount,0);XCTAssertTrue(scope.specialIdle.registeredKeys.isEmpty)
        XCTAssertEqual(engine.state.wildSpawnCount,1)
        // Captured binding teardown leaves default caller staging unchanged;
        // the terminal Scene must reject new config before any construction.
        scene.dispose()
        XCTAssertFalse(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in XCTFail("retired preparation")},carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in XCTFail("retired landing")}))
    }
    @MainActor func testActualPlainStarMeterLandsBeforeAttachingSharedScopeHalo()async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let wall=Wall(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall.value},sourceFrameTransportEnabled:true)
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3)],wildMeter:1.25),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star)})
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let resources=NativeWildMeterDropResources(root:root),view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let controller=UIViewController();controller.view=view;window.rootViewController=controller
        let scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        let ready=expectation(description:"actual Scene consumed assets receipt"),bookkeeping=expectation(description:"actual Scene consumed Source finally bookkeeping"),unlock=expectation(description:"independent wall140 unlock")
        var selected=0,prepared=false
        scene.onRenderingDemand={demand in if demand{view.isPaused=false}}
        scene.onGameplayEvent={event in
            if event.kind == .meterDropPrepared,!prepared{prepared=true;ready.fulfill()}
            if event.kind == .meterDropCompleted{bookkeeping.fulfill()}
            if event.kind == .meterDropHandoffUnlocked{unlock.fulfill()}
        }
        scene.onPresentationFailure={XCTFail($0)}
        func actualNode(_ id:String)->NativeDiceNode? {scene.childNode(withName:"native-gameplay-canvas")?.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==id}}
        scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
        scene.onSourcePresentationFailure={reason,_ in XCTFail(reason)}
        XCTAssertTrue(scene.configureSourcePlainStarHalos(scope:scope,performanceNow:{wall.value}))
        XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{tile,_ in
            selected+=1;XCTAssertEqual(engine.state.wildMeter,1.25)
            XCTAssertNil(actualNode(tile.id)?.variant);XCTAssertEqual(actualNode(tile.id)?.sourceLiveStarHaloCount,0);XCTAssertTrue(actualNode(tile.id)?.sourceIdleDeferred==true)
        },carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in}))
        defer{scene.dispose();context.dispose();service.dispose();resources.dispose();fifo.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible();view.presentScene(scene)
        // Board entry invokes real Scene.evaluate. No private caller.receive,
        // cloned Node, manual includesReplacement or synthetic Scene frame.
        await fulfillment(of:[ready],timeout:10)
        XCTAssertEqual(selected,1)
        let drop=try XCTUnwrap(engine.meterDropReservations.values.first),node=try XCTUnwrap(actualNode(drop.tileID))
        XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.alpha,0);XCTAssertEqual(node.sourceLiveStarHaloCount,0);XCTAssertEqual(node.sourceGeneration,engine.state.generation)
        var clock=0.0
        while clock<2000{clock=min(2000,clock+16);wall.value=clock;service.deliver(wallMilliseconds:clock)}
        await fulfillment(of:[bookkeeping,unlock],timeout:10)
        XCTAssertTrue(actualNode(drop.tileID) === node);XCTAssertFalse(node.isHidden);XCTAssertEqual(node.alpha,1);XCTAssertFalse(node.sourceIdleDeferred);XCTAssertFalse(engine.sourceMeterHandoffInProgress)
        for _ in 0..<500 {if node.sourceLiveStarHaloCount>0{break};try await Task.sleep(for:.milliseconds(10))}
        XCTAssertEqual(node.sourceLiveStarHaloCount,2)
        XCTAssertEqual(service.sourceTickerListenerCount,1)
        XCTAssertEqual(engine.state.wildSpawnCount,1)
        // Captured binding teardown leaves default caller staging unchanged;
        // the terminal Scene must reject new config before any construction.
        scene.dispose()
        XCTAssertFalse(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in XCTFail("retired preparation")},carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in XCTFail("retired landing")}))
    }
}
