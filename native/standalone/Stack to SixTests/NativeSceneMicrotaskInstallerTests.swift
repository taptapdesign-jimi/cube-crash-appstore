import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six
@testable import StackToSixGameplay

nonisolated final class NativeSceneMicrotaskInstallerTests:XCTestCase {
    @MainActor private final class Touch:UITouch {
        weak var host:SKView?
        var point=CGPoint.zero
        override var view:UIView?{host}
        override func location(in view:UIView?)->CGPoint {
            guard let host else{return point}
            return host.convert(point,to:view)
        }
    }
    @MainActor private func originalRoot()throws->URL {
        try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
    }
    @MainActor private func warm(_ resources:NativeWildMeterDropResources)async throws {
        let ready=expectation(description:"actual original30 resource/preload owner completed outside Source admission")
        var failure:NativeWildMeterDropResources.Failure?
        resources.prepare(arcade:false,capture:.init(id:"test-prewarm",generation:1,epoch:1)){result in
            if case .failure(let reason)=result{failure=reason};ready.fulfill()
        }
        await fulfillment(of:[ready],timeout:8)
        XCTAssertNil(failure);XCTAssertNotNil(resources.sourceSynchronousPreparationReceipt())
    }
    @MainActor func testActualTouchesOverridesDrainPointerReactionBeforeReturningFromDispatch()async throws {
        let root=try originalRoot(),fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000,sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3)]))
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:view.frame),controller=UIViewController()
        controller.view=view;window.rootViewController=controller
        let scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        scene.onRenderingDemand={demand in if demand{view.isPaused=false}}
        defer{scene.dispose();context.dispose();service.dispose();fifo.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible();view.presentScene(scene)
        let entered=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in scene.isBoardEntryComplete},object:nil)
        await fulfillment(of:[entered],timeout:5)
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
        let reactions=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{scope.current}))
        defer{reactions.dispose()}
        var trace:[String]=[]
        scene.onPointerState={down in
            trace.append(down ? "pointer-down":"pointer-up")
            XCTAssertTrue(reactions.enqueue{trace.append(down ? "down-reaction":"up-reaction")})
        }
        let geometry=try XCTUnwrap(scene.boardGeometry),touch=Touch()
        touch.host=view;touch.point=view.convert(geometry.center(row:0,column:0),from:scene)
        // Actual public UITouch dispatch overrides and their real bodies are
        // invoked; synthetic coordinates are a component fixture, not a phone.
        scene.touchesBegan([touch],with:nil)
        XCTAssertEqual(trace,["pointer-down","down-reaction"])
        scene.touchesCancelled([touch],with:nil)
        XCTAssertEqual(trace,["pointer-down","down-reaction","pointer-up","up-reaction"])
        XCTAssertEqual(fifo.pendingCount,0);XCTAssertFalse(fifo.isAcceptingJobs)
    }
    @MainActor func testActualMountedMeterRenderedHandoffCompletesInsideAppFIFOCheckpoint()async throws {
        let root=try originalRoot(),resources=NativeWildMeterDropResources(root:root)
        try await warm(resources) // no unproven async callback is mapped into Source
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000,sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3),.init(id:"far",cell:.init(column:4,row:8),value:1)],wildMeter:0.95),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star,variant:"cubero")})
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        let view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:view.frame),controller=UIViewController()
        controller.view=view;window.rootViewController=controller
        let completed=expectation(description:"actual same-node rendered receipt completes Source bookkeeping reaction")
        var completions=0,landingProbe=0
        let probes=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{scope.current}))
        defer{probes.dispose()}
        scene.onRenderingDemand={demand in if demand{view.isPaused=false}}
        scene.onPresentationFailure={XCTFail($0)}
        scene.onGameplayEvent={event in
            if event.kind == .meterDropLanded {
                XCTAssertFalse(fifo.isInsideCheckpoint,"restore/onLanded remain synchronous Source travel callbacks")
                XCTAssertTrue(probes.enqueue{landingProbe=1;XCTAssertTrue(probes.enqueue{landingProbe=2})})
            }
            if event.kind == .meterDropCompleted {
                completions+=1;XCTAssertTrue(fifo.isInsideCheckpoint)
                XCTAssertEqual(landingProbe,2,"literal finally awaits even fulfilled selected Promise after the first travel continuation")
                completed.fulfill()
            }
        }
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
        // The real initial entry remains Raw; it is not an admitted Promise
        // producer. Start below full charge, then earn it through an actual
        // pointer-dispatched ordinary contact and Source same-node80 root.
        scene.sourceOuterTimelineDriver=scope.timeline
        scene.sourceDragTweenDriver=scope.tween
        scene.sourceSameNodeStackAbsorbsEnabled=true
        scene.sourceStackAbsorbAdmission={_,_ in scope.current}
        scene.sourceContactVisualRandom={scope.smokeSession.nextVisualRandom()}
        XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in},carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in}))
        defer{scene.dispose();context.dispose();service.dispose();resources.dispose();fifo.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible();view.presentScene(scene)
        let entered=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in scene.isBoardEntryComplete},object:nil)
        await fulfillment(of:[entered],timeout:5)
        XCTAssertEqual(engine.state.wildSpawnCount,0)
        let geometry=try XCTUnwrap(scene.boardGeometry),touch=Touch();touch.host=view
        touch.point=view.convert(geometry.center(row:0,column:0),from:scene)
        scene.touchesBegan([touch],with:nil)
        XCTAssertTrue(engine.isDragging)
        touch.point=view.convert(geometry.center(row:0,column:1),from:scene)
        scene.touchesMoved([touch],with:nil)
        scene.touchesEnded([touch],with:nil)
        XCTAssertNotNil(engine.pendingOrdinaryStack)
        // Real existing displaylink, actual Scene.didFinishUpdate, same Node.
        // No manual painted epoch, service.deliver, cloned node or final packet.
        await fulfillment(of:[completed],timeout:8)
        XCTAssertEqual(completions,1);XCTAssertEqual(engine.state.wildSpawnCount,1);XCTAssertEqual(fifo.pendingCount,0)
        let tile=try XCTUnwrap(engine.state.tiles.first{$0.variant=="cubero"})
        let node=try XCTUnwrap(scene.childNode(withName:"native-gameplay-canvas")?.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==tile.id})
        XCTAssertFalse(node.isHidden);XCTAssertEqual(node.alpha,1);XCTAssertFalse(node.sourceIdleDeferred)
    }
    @MainActor func testActualPlainStarLandedHaloUsesMountedMeterAndAPPFIFO()async throws {
        let root=try originalRoot(),resources=NativeWildMeterDropResources(root:root)
        try await warm(resources) // no unproven async callback is mapped into Source
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000,sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        var draws=0,landedDraws:Int?
        let context=NativeGameplaySourceContext(service:service,visualRandom:{draws+=1;return 0.5},sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3),.init(id:"far",cell:.init(column:4,row:8),value:1)],wildMeter:0.95),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star)},sourceMathRandom:context.mathRandom)
        engine.sourceStarOrbitCountAtPresentationEnabled=true
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        let view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:view.frame),controller=UIViewController()
        controller.view=view;window.rootViewController=controller
        let completed=expectation(description:"actual same-node rendered receipt completes Source bookkeeping reaction")
        var completions=0,landingProbe=0
        let probes=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{scope.current}))
        defer{probes.dispose()}
        scene.onRenderingDemand={demand in if demand{view.isPaused=false}}
        scene.onPresentationFailure={XCTFail($0)}
        scene.onGameplayEvent={event in
            if event.kind == .meterDropLanded {
                XCTAssertNil(landedDraws);landedDraws=draws
                XCTAssertFalse(fifo.isInsideCheckpoint,"restore/onLanded remain synchronous Source travel callbacks")
                XCTAssertTrue(probes.enqueue{landingProbe=1;XCTAssertTrue(probes.enqueue{landingProbe=2})})
            }
            if event.kind == .meterDropCompleted {
                completions+=1;XCTAssertTrue(fifo.isInsideCheckpoint)
                XCTAssertEqual(landingProbe,2,"literal finally awaits even fulfilled selected Promise after the first travel continuation")
                completed.fulfill()
            }
        }
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
        // The real initial entry remains Raw; it is not an admitted Promise
        // producer. Start below full charge, then earn it through an actual
        // pointer-dispatched ordinary contact and Source same-node80 root.
        scene.sourceOuterTimelineDriver=scope.timeline
        scene.sourceDragTweenDriver=scope.tween
        scene.sourceSameNodeStackAbsorbsEnabled=true
        scene.sourceStackAbsorbAdmission={_,_ in scope.current}
        scene.sourceContactVisualRandom={scope.smokeSession.nextVisualRandom()}
        XCTAssertTrue(scene.configureSourcePlainStarHalos(scope:scope))
        scene.onSourcePresentationFailure={reason,_ in XCTFail(reason)}
        XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{tile,_ in
            XCTAssertTrue(scene.sourceNativeTileNode(tile.id)?.sourcePhysicalMarkersCovered==true,"actual fresh meter zero constructor establishes coverage")
            XCTAssertEqual(tile.starOrbitCount,0,"actual shared-Math Core creator defers the count until landed presentation")
            let node=scene.childNode(withName:"native-gameplay-canvas")?.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==tile.id}
            XCTAssertEqual(node?.sourceLiveStarHaloCount,0);XCTAssertTrue(node?.sourceIdleDeferred==true)
        },carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in}))
        defer{scene.dispose();context.dispose();service.dispose();resources.dispose();fifo.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible();view.presentScene(scene)
        let entered=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in scene.isBoardEntryComplete},object:nil)
        await fulfillment(of:[entered],timeout:5)
        XCTAssertEqual(engine.state.wildSpawnCount,0)
        let geometry=try XCTUnwrap(scene.boardGeometry),touch=Touch();touch.host=view
        touch.point=view.convert(geometry.center(row:0,column:0),from:scene)
        scene.touchesBegan([touch],with:nil)
        XCTAssertTrue(engine.isDragging)
        touch.point=view.convert(geometry.center(row:0,column:1),from:scene)
        scene.touchesMoved([touch],with:nil)
        scene.touchesEnded([touch],with:nil)
        XCTAssertNotNil(engine.pendingOrdinaryStack)
        // Real existing displaylink, actual Scene.didFinishUpdate, same Node.
        // No manual painted epoch, service.deliver, cloned node or final packet.
        await fulfillment(of:[completed],timeout:8)
        XCTAssertEqual(completions,1);XCTAssertEqual(engine.state.wildSpawnCount,1);XCTAssertEqual(fifo.pendingCount,0)
        let tile=try XCTUnwrap(engine.state.tiles.first{$0.archetype == .star && $0.variant==nil})
        let node=try XCTUnwrap(scene.childNode(withName:"native-gameplay-canvas")?.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==tile.id})
        for _ in 0..<500 {if node.sourceLiveStarHaloCount>0{break};try await Task.sleep(for:.milliseconds(10))}
        let face=try XCTUnwrap(node.visual.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === node.sourcePaintedNumbersTexture})
        XCTAssertEqual(abs(face.frame.width),128,accuracy:0.001,"fresh Source holder→Wild keeps authored logical face width")
        XCTAssertEqual(node.sourceEventMode,"static")
        XCTAssertEqual(node.sourceLiveStarHaloCount,2);XCTAssertEqual(service.sourceTickerListenerCount,1)
        XCTAssertEqual(draws-(try XCTUnwrap(landedDraws)),21,"one count draw then ten draws for each of the two actual stars")
        XCTAssertFalse(node.isHidden);XCTAssertEqual(node.alpha,1);XCTAssertFalse(node.sourceIdleDeferred)
    }
    @MainActor func testActualControllerBindsEarnedMeterStarAndRetiresItsScope()async throws {
        let root=try originalRoot(),resources=NativeWildMeterDropResources(root:root)
        try await warm(resources) // no unproven async callback is mapped into Source
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000,sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        var draws=0,landedDraws:Int?
        let context=NativeGameplaySourceContext(service:service,visualRandom:{draws+=1;return 0.5},sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3),.init(id:"far",cell:.init(column:4,row:8),value:1)],wildMeter:0.95),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star)},sourceMathRandom:context.mathRandom)
        engine.sourceStarOrbitCountAtPresentationEnabled=true
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        controller.sourceContext=context;controller.sourceSmallStackPresentationEnabled=true
        controller.loadViewIfNeeded();controller.view.frame = .init(x:0,y:0,width:390,height:844)
        let scene=try XCTUnwrap(controller.boardScene),scope=try XCTUnwrap(controller.sourceScope)
        let view=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? SKView}.first)
        let window=UIWindow(frame:controller.view.frame);window.rootViewController=controller
        let completed=expectation(description:"actual same-node rendered receipt completes Source bookkeeping reaction")
        var completions=0,landingProbe=0,landingSounds=0
        let probes=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{scope.current}))
        defer{probes.dispose()}
        scene.onRenderingDemand={demand in if demand{view.isPaused=false}}
        scene.onPresentationFailure={XCTFail($0)}
        scene.onGameplayEvent={event in
            if event.kind == .meterDropLanded {
                XCTAssertNil(landedDraws);landedDraws=draws
                XCTAssertFalse(fifo.isInsideCheckpoint,"restore/onLanded remain synchronous Source travel callbacks")
                XCTAssertTrue(probes.enqueue{landingProbe=1;XCTAssertTrue(probes.enqueue{landingProbe=2})})
            }
            if event.kind == .meterDropCompleted {
                completions+=1;XCTAssertTrue(fifo.isInsideCheckpoint)
                XCTAssertEqual(landingProbe,2,"literal finally awaits even fulfilled selected Promise after the first travel continuation")
                completed.fulfill()
            }
        }
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
        // The real initial entry remains Raw; it is not an admitted Promise
        // producer. Start below full charge, then earn it through an actual
        // pointer-dispatched ordinary contact and Source same-node80 root.
        scene.sourceOuterTimelineDriver=scope.timeline
        scene.sourceDragTweenDriver=scope.tween
        scene.sourceSameNodeStackAbsorbsEnabled=true
        scene.sourceStackAbsorbAdmission={_,_ in scope.current}
        scene.sourceContactVisualRandom={scope.smokeSession.nextVisualRandom()}
        scene.onSourcePresentationFailure={reason,_ in XCTFail(reason)}
        XCTAssertTrue(controller.configureSourceMeterAndStarPresentation(resources:resources,texturesCurrent:{true},selectedAudio:{tile,_ in
            XCTAssertEqual(tile.starOrbitCount,0,"actual shared-Math Core creator defers the count until landed presentation")
            let node=scene.childNode(withName:"native-gameplay-canvas")?.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==tile.id}
            XCTAssertEqual(node?.sourceLiveStarHaloCount,0);XCTAssertTrue(node?.sourceIdleDeferred==true)
        },carrierAudio:{_,_,_ in {}},landingSound:{landingSounds+=1}))
        defer{controller.dispose();context.dispose();service.dispose();resources.dispose();fifo.dispose();window.isHidden=true;window.rootViewController=nil}
        window.makeKeyAndVisible()
        let entered=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in scene.isBoardEntryComplete},object:nil)
        await fulfillment(of:[entered],timeout:5)
        XCTAssertEqual(engine.state.wildSpawnCount,0)
        let geometry=try XCTUnwrap(scene.boardGeometry),touch=Touch();touch.host=view
        touch.point=view.convert(geometry.center(row:0,column:0),from:scene)
        scene.touchesBegan([touch],with:nil)
        XCTAssertTrue(engine.isDragging)
        touch.point=view.convert(geometry.center(row:0,column:1),from:scene)
        scene.touchesMoved([touch],with:nil)
        scene.touchesEnded([touch],with:nil)
        XCTAssertNotNil(engine.pendingOrdinaryStack)
        // Real existing displaylink, actual Scene.didFinishUpdate, same Node.
        // No manual painted epoch, service.deliver, cloned node or final packet.
        await fulfillment(of:[completed],timeout:8)
        XCTAssertEqual(completions,1);XCTAssertEqual(engine.state.wildSpawnCount,1);XCTAssertEqual(fifo.pendingCount,0)
        let tile=try XCTUnwrap(engine.state.tiles.first{$0.archetype == .star && $0.variant==nil})
        let node=try XCTUnwrap(scene.childNode(withName:"native-gameplay-canvas")?.children.compactMap{$0 as? NativeDiceNode}.first{$0.tileID==tile.id})
        for _ in 0..<500 {if node.sourceLiveStarHaloCount>0{break};try await Task.sleep(for:.milliseconds(10))}
        XCTAssertEqual(node.sourceLiveStarHaloCount,2);XCTAssertEqual(service.sourceTickerListenerCount,1)
        XCTAssertNotNil(landedDraws);XCTAssertEqual(landingSounds,1)
        // Landing smoke is a genuine shared Math caller. Isolated halo exact21
        // remains asserted by the independent actual Scene FIFO test.
        XCTAssertFalse(node.isHidden);XCTAssertEqual(node.alpha,1);XCTAssertFalse(node.sourceIdleDeferred)
        controller.dispose();XCTAssertFalse(scope.current);XCTAssertEqual(service.sourceTickerListenerCount,0)
        XCTAssertFalse(controller.configureSourceMeterAndStarPresentation(resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in XCTFail("retired")},carrierAudio:{_,_,_ in {}},landingSound:{XCTFail("retired")}))
    }
    @MainActor func testActualIndicatorDividerMaskRetainsOtherDropsAndRejectsDuplicateRelease() {
        let indicator=NativeRoundIndicator(font:.systemFont(ofSize:18))
        indicator.synchronize(round:1,arcade:true,viewport:.init(width:390,height:844),alpha:1)
        XCTAssertFalse(indicator.sourceDividerLinesHidden)
        let first=indicator.beginSourceBackpackDividerMask(),second=indicator.beginSourceBackpackDividerMask()
        XCTAssertEqual(indicator.sourceDividerMaskCount,2);XCTAssertTrue(indicator.sourceDividerLinesHidden)
        first();XCTAssertEqual(indicator.sourceDividerMaskCount,1);XCTAssertTrue(indicator.sourceDividerLinesHidden)
        first();XCTAssertEqual(indicator.sourceDividerMaskCount,1);XCTAssertTrue(indicator.sourceDividerLinesHidden)
        indicator.synchronize(round:2,arcade:true,viewport:.init(width:390,height:844),alpha:0.7)
        XCTAssertTrue(indicator.sourceDividerLinesHidden);XCTAssertEqual(indicator.alpha,0.7,accuracy:0.00001)
        second();XCTAssertEqual(indicator.sourceDividerMaskCount,0);XCTAssertFalse(indicator.sourceDividerLinesHidden)
        second();XCTAssertEqual(indicator.sourceDividerMaskCount,0)
    }
    @MainActor func testColdSourceConfigurationRefusesBeforeChargeAndDefaultMissingAppBindingRemainsUninstalled()throws {
        let root=try originalRoot(),fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let missing=NativeGameplaySourceContext(service:service),context=NativeGameplaySourceContext(service:service,sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2)],wildMeter:1.25))
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844)),resources=NativeWildMeterDropResources(root:root)
        let missingScope=try XCTUnwrap(missing.beginScene{}),scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        defer{scene.dispose();context.dispose();missing.dispose();service.dispose();resources.dispose();fifo.dispose()}
        XCTAssertFalse(scene.configureSourceMicrotaskBoundaries(scope:missingScope,fifo:fifo));XCTAssertFalse(scene.sourceMicrotaskBoundariesInstalled)
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
        let before=engine.state
        tasks.inputTask{
            XCTAssertFalse(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in XCTFail("cold must not prepare/charge")},carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in XCTFail("cold") }))
        }
        XCTAssertEqual(engine.state,before);XCTAssertNil(engine.pendingMeterOpen);XCTAssertFalse(engine.stagedMeterOpen)
        XCTAssertEqual(resources.loadCount,0);XCTAssertEqual(fifo.pendingCount,0)
    }
    @MainActor func testCapturedScopeRetirementSealsJobsAndCannotEraseNewInstallation()throws {
        let root=try originalRoot(),fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2)])),scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let a=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:a,fifo:fifo))
        let c=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()})
        XCTAssertFalse(scene.sourceMicrotaskBoundariesInstalled)
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:c,fifo:fifo))
        a.dispose();XCTAssertTrue(scene.sourceMicrotaskBoundariesInstalled)
        scene.dispose();XCTAssertFalse(scene.sourceMicrotaskBoundariesInstalled)
        XCTAssertFalse(scene.configureSourceMicrotaskBoundaries(scope:c,fifo:fifo));XCTAssertEqual(fifo.pendingCount,0)
        context.dispose();service.dispose();fifo.dispose()
    }
    @MainActor func testActualRetainedOriginalTextureReceiptRejectsColdMissingCrossOwnerAndTerminalEpoch()async throws {
        let root=try originalRoot(),ready=NativeWildMeterDropResources(root:root)
        XCTAssertNil(ready.sourceSynchronousPreparationReceipt())
        try await warm(ready)
        let capture=try XCTUnwrap(ready.sourceSynchronousPreparationReceipt())
        XCTAssertTrue(ready.sourceSynchronousPreparationIsCurrent(capture))
        let missing=NativeWildMeterDropResources(root:URL(fileURLWithPath:NSTemporaryDirectory()).appendingPathComponent(UUID().uuidString))
        let failed=expectation(description:"actual missing required original identities refuse resource publication")
        missing.prepare(arcade:true,capture:.init(id:"missing",generation:1,epoch:1)){result in if case .success=result{XCTFail("no asset success fallback")};failed.fulfill()}
        await fulfillment(of:[failed],timeout:5)
        XCTAssertNil(missing.sourceSynchronousPreparationReceipt());XCTAssertFalse(missing.sourceSynchronousPreparationIsCurrent(capture))
        ready.dispose();XCTAssertNil(ready.sourceSynchronousPreparationReceipt());XCTAssertFalse(ready.sourceSynchronousPreparationIsCurrent(capture))
        missing.dispose()
    }
}
