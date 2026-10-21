import XCTest
import UIKit
import SpriteKit
import MetalKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeOwnedGameplayRenderHostTests:XCTestCase {
    private func scene()->NativeBoardScene {
        let state=NativeBoardState(columns:5,rows:9,tiles:[
            .init(id:"source",cell:.init(column:0,row:0),value:1),
            .init(id:"target",cell:.init(column:1,row:0),value:2)])
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),
            resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),
            size:.init(width:390,height:844))
        scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
        return scene
    }
    private func host()throws->NativeOwnedMetalGameplayView {
        guard let host=NativeOwnedMetalGameplayView(frame:.init(x:0,y:0,width:390,height:844)) else {
            throw XCTSkip("A real Metal device and command queue are required")
        }
        return host
    }
    private func mount(_ host:NativeOwnedMetalGameplayView)->UIWindow {
        let window=UIWindow(frame:host.bounds),controller=UIViewController()
        controller.view=host;window.rootViewController=controller;window.isHidden=false
        return window
    }
    private func close(_ window:UIWindow){window.isHidden=true;window.rootViewController=nil}

    func testNativeColdLaunchControllerMountsOwnedRendererWithoutInjectedSurface()throws {
        guard MTLCreateSystemDefaultDevice() != nil else {throw XCTSkip("A real Metal device is required")}
        XCTAssertEqual(Bundle.main.bundleIdentifier,"com.taptapdesign.stacktosix.native")
        let engine=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:[
            .init(id:"source",cell:.init(column:0,row:0),value:1),
            .init(id:"target",cell:.init(column:1,row:0),value:2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        defer{controller.dispose();close(window)}
        window.rootViewController=controller;window.makeKeyAndVisible()
        controller.view.frame=window.bounds;controller.view.layoutIfNeeded()
        let actual=try XCTUnwrap(controller.boardScene)
        let owned=try XCTUnwrap(actual.gameplayRenderHost as? NativeOwnedMetalGameplayView,
            "Normal standalone controller construction must not require a delivery launch flag")
        XCTAssertTrue(owned.renderedScene === actual)
        let scale=window.screen.scale
        XCTAssertEqual(owned.contentScaleFactor,scale)
        XCTAssertEqual(owned.drawableSize,CGSize(width:390*scale,height:844*scale),
            "Controller layout must not restore a one-pixel-per-point surface")
        XCTAssertNil(actual.view)
        XCTAssertEqual(actual.scaleMode,.fill)
        let census=NativeDiagnosticsRenderCensus.capture(root:controller.view)
        XCTAssertEqual(census["mountedScenes"] as? Int,1)
        XCTAssertEqual(census["mountedSKViews"] as? Int,0)
        controller.dispose()
        XCTAssertNil(owned.renderedScene);XCTAssertNil(actual.gameplayRenderHost)
    }

    func testNonNativeRenderSurfaceKeepsIsolatedLegacyHost() {
        XCTAssertTrue(NativeGameplayViewController.makeRenderSurface(bundleIdentifier:"isolated.test.host") is SKView)
        XCTAssertTrue(NativeGameplayViewController.makeRenderSurface(bundleIdentifier:nil) is SKView)
    }

    func testActualOwnedHostMountsWithoutSKViewAndRetiresTwice()throws {
        let scene=scene(),host=try host(),window=mount(host)
        defer{host.retirePresentation();scene.dispose();close(window)}
        XCTAssertTrue(host.presentScene(scene))
        XCTAssertNil(scene.view,"SKRenderer attachment must not fabricate a hidden SKView")
        XCTAssertTrue(scene.gameplayRenderHost === host)
        XCTAssertTrue(host.renderedScene === scene)
        let census=NativeDiagnosticsRenderCensus.capture(root:host)
        XCTAssertEqual(census["mountedScenes"] as? Int,1)
        XCTAssertEqual(census["mountedSKViews"] as? Int,0)
        XCTAssertGreaterThan(census["sceneNodes"] as? Int ?? 0,1)
        XCTAssertEqual(host.renderingFPS,60)
        XCTAssertFalse(host.renderingPaused)
        let epoch=host.presentationEpoch
        XCTAssertTrue(host.presentScene(scene));XCTAssertEqual(host.presentationEpoch,epoch)
        host.retirePresentation();host.retirePresentation()
        XCTAssertNil(host.renderedScene);XCTAssertNil(scene.gameplayRenderHost)
        XCTAssertTrue(host.renderingPaused)
        XCTAssertEqual(host.presentationEpoch,epoch+1,"Idempotent retirement must not create another presentation")
    }

    func testCoordinatesMatchLegacySKViewIncludingAnchorAndResize()throws {
        let owned=try host(),actual=scene(),reference=scene(),legacy=SKView(frame:owned.bounds)
        defer{owned.retirePresentation();actual.dispose();reference.dispose();legacy.presentScene(nil)}
        XCTAssertTrue(owned.presentScene(actual));legacy.presentScene(reference)
        for size in [CGSize(width:390,height:844),CGSize(width:320,height:568)] {
            actual.anchorPoint = .zero;reference.anchorPoint = .zero
            let previousSize=actual.size,previousGeometry=try XCTUnwrap(actual.boardGeometry)
            owned.frame=CGRect(origin:.zero,size:size);owned.layoutSubviews()
            XCTAssertEqual(actual.size,previousSize,"Host bounds changes must not preempt the authoritative Scene layout")
            XCTAssertEqual(try XCTUnwrap(actual.boardGeometry).tileSize,previousGeometry.tileSize)
            XCTAssertEqual(try XCTUnwrap(actual.boardGeometry).origin,previousGeometry.origin)
            actual.layout(size:size,insets:.init(top:47,left:0,bottom:34,right:0))
            legacy.frame=CGRect(origin:.zero,size:size);reference.size=size
            XCTAssertEqual(actual.size,size)
            let geometry=try XCTUnwrap(actual.boardGeometry)
            if previousSize != size {XCTAssertNotEqual(geometry.tileSize,previousGeometry.tileSize)}
            let node=try XCTUnwrap(actual.sourceNativeTileNode("source")),expected=geometry.center(row:0,column:0)
            XCTAssertEqual(node.position.x,expected.x,accuracy:0.001)
            XCTAssertEqual(node.position.y,expected.y,accuracy:0.001)
            XCTAssertEqual(owned.drawableSize,CGSize(width:size.width*UIScreen.main.scale,height:size.height*UIScreen.main.scale),"Resize must retain display-density pixels while scene geometry stays in points")
            for anchor in [CGPoint.zero,CGPoint(x:0.5,y:0.5)] {
                actual.anchorPoint=anchor;reference.anchorPoint=anchor
                for point in [CGPoint.zero,CGPoint(x:37.25,y:83.5),CGPoint(x:-15,y:20)] {
                    let ownedPoint=owned.scenePointToView(point,scene:actual)
                    let legacyPoint=legacy.scenePointToView(point,scene:reference)
                    XCTAssertEqual(ownedPoint.x,legacyPoint.x,accuracy:0.001)
                    XCTAssertEqual(ownedPoint.y,legacyPoint.y,accuracy:0.001)
                    let roundTrip=owned.viewPointToScene(ownedPoint,scene:actual)
                    XCTAssertEqual(roundTrip.x,point.x,accuracy:0.001)
                    XCTAssertEqual(roundTrip.y,point.y,accuracy:0.001)
                }
            }
        }
    }

    func testForeignHostAndSKViewCannotTakeAttachedSceneAndStaleRetirementCannotDetachReplacement()throws {
        let scene=scene(),first=try host(),replacement=try host()
        defer{first.retirePresentation();replacement.retirePresentation();scene.dispose()}
        XCTAssertTrue(first.presentScene(scene))
        XCTAssertFalse(replacement.presentScene(scene));XCTAssertNil(replacement.renderedScene)
        XCTAssertTrue(scene.gameplayRenderHost === first)
        first.retirePresentation()
        XCTAssertTrue(replacement.presentScene(scene))
        scene.unmountOwnedRenderHost(first)
        first.retirePresentation()
        XCTAssertTrue(scene.gameplayRenderHost === replacement)
        XCTAssertTrue(replacement.renderedScene === scene)
        replacement.retirePresentation()
        let legacy=SKView(frame:first.bounds);legacy.presentScene(scene)
        defer{legacy.presentScene(nil)}
        XCTAssertFalse(first.presentScene(scene),"A real SKView attachment cannot have a second renderer")
        XCTAssertTrue(scene.gameplayRenderHost === legacy)
    }

    func testActualSKRendererCyclePaintsQueuedLatestTouchAndSuppressesIndependentSourceFrame()throws {
        let scene=scene(),host=try host(),window=mount(host)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{host.retirePresentation();scene.dispose();service.dispose();close(window)}
        scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
        XCTAssertTrue(host.presentScene(scene))
        let from=try XCTUnwrap(scene.boardGeometry).center(row:0,column:0)
        XCTAssertTrue(scene.beginDrag(at:from))
        let node=try XCTUnwrap(scene.sourceNativeTileNode("source")),pickup=node.position
        scene.dispatchSourceTouchMove(to:CGPoint(x:from.x+4,y:from.y))
        scene.dispatchSourceTouchMove(to:CGPoint(x:from.x+12,y:from.y))
        XCTAssertEqual(node.position,pickup);XCTAssertEqual(service.pendingSourceAnimationFrameCount,1)
        XCTAssertTrue(host.updateSceneForRendererFrame(atTime:1))
        XCTAssertEqual(node.position.x,from.x+12,accuracy:0.001)
        XCTAssertEqual(node.position.y,from.y,accuracy:0.001)
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        XCTAssertTrue(service.rendererDragDeliveryActive)
        XCTAssertFalse(service.deliverIndependentFrame(rawFrameMilliseconds:1001))
        scene.cancelDrag();XCTAssertFalse(service.rendererDragDeliveryActive)
        XCTAssertTrue(service.deliverIndependentFrame(rawFrameMilliseconds:1016))
    }

    func testSuspensionFreezesQueuedPaintAndResumeConsumesItOnceBeforeRetirement()throws {
        let scene=scene(),host=try host(),window=mount(host)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{host.retirePresentation();scene.dispose();service.dispose();close(window)}
        scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
        XCTAssertTrue(host.presentScene(scene))
        let from=try XCTUnwrap(scene.boardGeometry).center(row:0,column:0)
        XCTAssertTrue(scene.beginDrag(at:from))
        let node=try XCTUnwrap(scene.sourceNativeTileNode("source")),pickup=node.position
        scene.dispatchSourceTouchMove(to:CGPoint(x:from.x+12,y:from.y))
        scene.setSuspended(true);host.renderingPaused=true
        XCTAssertFalse(service.rendererDragDeliveryActive)
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,1,"Modal/background suspension preserves the captured Source RAF until resume")
        XCTAssertFalse(host.updateSceneForRendererFrame(atTime:1))
        XCTAssertEqual(node.position,pickup)
        XCTAssertFalse(scene.beginDrag(at:from))
        scene.setSuspended(false);host.renderingPaused=false
        XCTAssertTrue(host.updateSceneForRendererFrame(atTime:1.016))
        XCTAssertEqual(node.position.x,from.x+12,accuracy:0.001)
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        let painted=node.position
        XCTAssertTrue(host.updateSceneForRendererFrame(atTime:1.032))
        XCTAssertEqual(node.position,painted,"The retained latest sample is not replayed on another renderer cycle")
        scene.dispatchSourceTouchMove(to:CGPoint(x:from.x+16,y:from.y))
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,1)
        host.retirePresentation()
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0,"Actual host retirement cancels input ownership instead of freezing it")
        XCTAssertFalse(service.rendererDragDeliveryActive)
        XCTAssertFalse(host.updateSceneForRendererFrame(atTime:2))
        XCTAssertNil(scene.gameplayRenderHost)
    }

    func testHiddenAndDetachedActualHostCannotAdvanceRenderer()throws {
        let scene=scene(),host=try host(),window=mount(host)
        defer{host.retirePresentation();scene.dispose();close(window)}
        XCTAssertTrue(host.presentScene(scene))
        host.isHidden=true
        XCTAssertFalse(host.updateSceneForRendererFrame(atTime:1))
        host.isHidden=false;host.removeFromSuperview()
        XCTAssertNil(host.window)
        XCTAssertFalse(host.updateSceneForRendererFrame(atTime:2))
    }

    func testWindowDetachRetiresHeldPointerAndQueuedTouchWithoutRevivalOnReattach()throws {
        let scene=scene(),host=try host(),window=mount(host)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{host.retirePresentation();scene.dispose();service.dispose();close(window)}
        scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
        XCTAssertTrue(host.presentScene(scene))
        let before=scene.engine.state,from=try XCTUnwrap(scene.boardGeometry).center(row:0,column:0)
        let node=try XCTUnwrap(scene.sourceNativeTileNode("source")),originalZ=node.zPosition
        var pointerEnds=0
        scene.onPointerState={active in if !active {pointerEnds+=1}}
        XCTAssertTrue(scene.beginDrag(at:from))
        scene.dispatchSourceTouchMove(to:CGPoint(x:from.x+12,y:from.y))
        XCTAssertTrue(scene.engine.isDragging)
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,1)
        XCTAssertEqual(service.directManipulationTransportCount,1)
        XCTAssertTrue(service.rendererDragDeliveryActive)
        host.removeFromSuperview()
        XCTAssertNil(host.window)
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0,"This fixture has only the captured drag RAF, which detach must retire")
        XCTAssertEqual(service.directManipulationTransportCount,0)
        XCTAssertFalse(service.rendererDragDeliveryActive)
        XCTAssertFalse(scene.engine.isDragging)
        XCTAssertEqual(pointerEnds,1)
        XCTAssertEqual(node.zPosition,originalZ,"The held node relinquishes its pointer foreground ownership")
        XCTAssertEqual(scene.engine.state,before)
        XCTAssertFalse(host.updateSceneForRendererFrame(atTime:1))
        window.addSubview(host)
        XCTAssertTrue(host.window === window)
        XCTAssertTrue(host.updateSceneForRendererFrame(atTime:1.016))
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        XCTAssertEqual(service.directManipulationTransportCount,0)
        XCTAssertFalse(service.rendererDragDeliveryActive)
        XCTAssertFalse(scene.engine.isDragging)
        XCTAssertEqual(pointerEnds,1)
        XCTAssertEqual(scene.engine.state,before)
        scene.onPointerState=nil
    }

    func testActualSceneCallbackRetirementRejectsOldRendererFrame()throws {
        let scene=scene(),host=try host(),window=mount(host)
        defer{host.retirePresentation();scene.dispose();close(window)}
        XCTAssertTrue(host.presentScene(scene))
        var callbacks=0
        scene.onRenderSurfacePreparation={
            callbacks+=1
            host.retirePresentation()
        }
        XCTAssertFalse(host.updateSceneForRendererFrame(atTime:1),"A callback-retired Scene cannot proceed to old-frame encoding")
        XCTAssertEqual(callbacks,1,"The real SKRenderer must have reached the actual Scene handoff")
        XCTAssertNil(host.renderedScene);XCTAssertNil(scene.gameplayRenderHost)
        XCTAssertFalse(host.updateSceneForRendererFrame(atTime:2))
        XCTAssertEqual(callbacks,1)
        scene.onRenderSurfacePreparation=nil
    }

    func testMountCallbacksPreserveExplicitPauseAndReentrantSuccessor()throws {
        let first=scene(),next=scene(),host=try host()
        defer{host.retirePresentation();first.dispose();next.dispose()}
        first.onRenderingDemand={_ in host.renderingPaused=true}
        XCTAssertTrue(host.presentScene(first))
        XCTAssertTrue(host.renderingPaused,"A mount callback can intentionally keep gameplay suspended")
        host.retirePresentation()
        first.onRenderingDemand={_ in XCTAssertTrue(host.presentScene(next))}
        XCTAssertFalse(host.presentScene(first),"The original presentation lost its exact epoch during its mount callback")
        XCTAssertTrue(host.renderedScene === next)
        XCTAssertTrue(next.gameplayRenderHost === host)
        XCTAssertNil(first.gameplayRenderHost)
        first.onRenderingDemand=nil
    }

    func testSyntheticProbeUsesActualRendererCallbacksAndPreservesCanonicalStateAfterTwentySeconds()throws {
        let scene=scene(),host=try host(),window=mount(host)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        var receipts:[String]=[]
        let probe=NativeRenderPipelineProbe(warmupSeconds:0,durationSeconds:20,log:{receipts.append($0)})
        defer{host.retirePresentation();scene.dispose();service.dispose();close(window)}
        scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
        XCTAssertTrue(host.presentScene(scene))
        let before=scene.engine.state
        XCTAssertEqual(service.displayLinkCreationCount,0)
        XCTAssertNil(scene.renderPipelineProbe,"Normal Scene construction has no synthetic input")
        scene.renderPipelineProbe=probe
        XCTAssertTrue(host.updateSceneForRendererFrame(atTime:1))
        XCTAssertTrue(probe.active);XCTAssertEqual(probe.phase,"running")
        XCTAssertEqual(service.displayLinkCreationCount,1,"First genuine pickup lazily creates the canonical APP transport")
        let links=service.displayLinkCreationCount
        for frame in 1...1200 {
            XCTAssertTrue(host.updateSceneForRendererFrame(atTime:1+Double(frame)/60))
        }
        XCTAssertEqual(probe.phase,"finished");XCTAssertFalse(probe.active)
        XCTAssertEqual(probe.frameCount,1200)
        XCTAssertEqual(scene.engine.state,before,"Replay must not merge, debit, score, combo, spawn or persist a different board")
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        XCTAssertFalse(service.rendererDragDeliveryActive)
        XCTAssertEqual(service.displayLinkCreationCount,links,"The entire replay reuses the one canonical APP transport without another clock")
        XCTAssertTrue(receipts.contains{$0.contains("event=finish") && $0.contains("authority-preserved")})
        XCTAssertTrue(receipts.allSatisfy{$0.contains("input=synthetic-scene-queue")})
        host.retirePresentation();probe.cancel(scene:scene,reason:"late-test-cleanup")
        XCTAssertEqual(probe.phase,"finished");XCTAssertEqual(scene.engine.state,before)
    }

    func testActualOwnedControllerOrdinaryDropShowsSourceNoMovesAndDisposalRetiresIt()async throws {
        let host=try host(),root=NativeTestResources.root
        let engine=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:[
            .init(id:"a",cell:.init(column:0,row:0),value:2),
            .init(id:"b",cell:.init(column:1,row:0),value:3)]))
        engine.stagedSourceNoMoves=true
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
        let context=NativeGameplaySourceContext(service:service,visualRandom:{0.5})
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root,renderSurfaceFactory:{host})
        let window=UIWindow(frame:host.bounds)
        defer{controller.dispose();context.dispose();service.dispose();close(window)}
        controller.sourceContext=context
        controller.sourceSmallStackPresentationEnabled=true
        controller.sourceNoMovesPresentationEnabled=true
        controller.sourceNoMovesBindings = .init(visibleShowCue:{_,_ in},admitted:{[weak controller,weak context] generation in
            controller?.engine.state.generation==generation && controller?.sourceScope?.current==true && context != nil
        },refreshRuntime:{},ordinaryCallerReady:{_,_ in true},levelEndPreflight:{nil},
            stopIdleAndIdleSmoke:{},restartIdle:{},persistStuckState:{},resetHint:{},
            terminalFields:{_,_ in},queueGuardRelease:{_ in},scheduleGSAPRecheck:{_,_ in},exitFailure:{})
        window.rootViewController=controller;window.makeKeyAndVisible()
        controller.view.frame=window.bounds;controller.view.layoutIfNeeded()
        let ready=expectation(description:"Actual owned-controller Source no-moves assets")
        controller.prepareSourceNoMovesSceneBinding{ok in XCTAssertTrue(ok);ready.fulfill()}
        await fulfillment(of:[ready],timeout:5)
        let scene=try XCTUnwrap(controller.boardScene)
        let deadline=Date().addingTimeInterval(4)
        while !scene.isBoardEntryComplete,Date()<deadline {try await Task.sleep(nanoseconds:10_000_000)}
        XCTAssertTrue(scene.isBoardEntryComplete)
        XCTAssertNil(scene.view);XCTAssertTrue(scene.gameplayRenderHost === host)
        let geometry=try XCTUnwrap(scene.boardGeometry),shown=expectation(description:"Genuine Source ordinary postcheck mounts no-moves")
        var published=false
        controller.onStateChange={[weak controller] _ in
            if engine.pendingSourceNoMoves != nil,!published {
                published=true
                XCTAssertNotNil(controller?.sourceNoMovesUIKit?.presentation?.superview)
                shown.fulfill()
            }
        }
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)))
        let target=geometry.center(row:0,column:1)
        scene.moveDrag(to:target)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:target,now:1)).accepted)
        await fulfillment(of:[shown],timeout:3)
        XCTAssertEqual(engine.pendingSourceNoMoves?.trigger,.lastTwoRegular)
        XCTAssertTrue(scene.sourceNoMovesCandidateActive)
        XCTAssertNotNil(controller.sourceNoMovesUIKit?.presentation)
        controller.setSuspended(true)
        XCTAssertTrue(scene.sourceNoMovesCandidateActive,"Host suspension preserves the existing Source candidate")
        controller.dispose();controller.dispose()
        XCTAssertNil(host.renderedScene)
        XCTAssertNil(controller.sourceNoMovesUIKit?.presentation)
        XCTAssertNil(scene.gameplayRenderHost)
    }
}
