import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceDragMoveDispatchTests:XCTestCase {
    private func fixture()throws->(NativeBoardScene,NativeSourceAnimationClockService,CGPoint,CGPoint) {
        let state=NativeBoardState(columns:5,rows:9,tiles:[
            .init(id:"source",cell:.init(column:0,row:0),value:1),
            .init(id:"target",cell:.init(column:1,row:0),value:2),
            .init(id:"other",cell:.init(column:4,row:0),value:4)])
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),size:.init(width:390,height:844))
        scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        scene.configureSourceRegularStackHandoff(service:service,admitted:{true})
        let geometry=try XCTUnwrap(scene.boardGeometry)
        let from=geometry.center(row:0,column:0),to=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:from))
        return(scene,service,from,to)
    }
    func testMountedStackHoverMatchesPWAAndRejectsInvalidSum()throws {
        for (sourceValue,targetValue,valid) in [(2,3,true),(2,4,true),(5,4,false)] {
            let state=NativeBoardState(columns:5,rows:9,tiles:[
                .init(id:"source",cell:.init(column:0,row:0),value:sourceValue),
                .init(id:"target",cell:.init(column:1,row:0),value:targetValue)])
            let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),size:.init(width:390,height:844))
            scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
            defer {scene.dispose()}
            let geometry=try XCTUnwrap(scene.boardGeometry)
            XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)))
            scene.moveDrag(to:geometry.center(row:0,column:1))
            let hover=try XCTUnwrap(scene.childNode(withName:"//native-stack-hover") as? SKShapeNode)
            XCTAssertEqual(hover.isHidden,!valid)
            if valid {
                XCTAssertEqual(hover.lineWidth,10*geometry.scale,accuracy:0.0001)
                let reveal=try XCTUnwrap(hover.action(forKey:"stack-hover-enter"))
                XCTAssertEqual(reveal.duration,0.10,accuracy:0.0001)
                XCTAssertEqual(reveal.timingMode,.easeInEaseOut)
                XCTAssertEqual(hover.alpha,0,"The indicator starts transparent")
                var red:CGFloat=0,green:CGFloat=0,blue:CGFloat=0,alpha:CGFloat=0
                XCTAssertTrue(hover.strokeColor.getRed(&red,green:&green,blue:&blue,alpha:&alpha))
                XCTAssertEqual(red,138.0/255,accuracy:0.0001);XCTAssertEqual(green,110.0/255,accuracy:0.0001)
                XCTAssertEqual(blue,87.0/255,accuracy:0.0001);XCTAssertEqual(alpha,0.168,accuracy:0.0001)
                XCTAssertEqual(try XCTUnwrap(hover.path).boundingBox.width,geometry.tileSize-6*geometry.scale,accuracy:0.0001)
            }
            scene.cancelDrag();XCTAssertTrue(hover.isHidden);XCTAssertNil(hover.action(forKey:"stack-hover-enter"))
        }
    }
    func testActualTouchDispatcherCoalescesToLatestSampleOnExistingSourceRAF()throws {
        let(scene,service,from,to)=try fixture();defer{scene.dispose();service.dispose()}
        let node=try XCTUnwrap(scene.sourceNativeTileNode("source"))
        let pickupPosition=node.position
        for index in 1...12 {scene.dispatchSourceTouchMove(to:.init(x:from.x+(to.x-from.x)*CGFloat(index)/12,y:from.y))}
        XCTAssertEqual(node.position,pickupPosition,"v9 stores input without repeated position/trail/hover paints between RAF callbacks")
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,1)
        service.deliver(wallMilliseconds:16)
        XCTAssertEqual(node.position.x,to.x,accuracy:1e-4);XCTAssertEqual(node.position.y,to.y,accuracy:1e-4)
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        scene.dispatchSourceTouchMove(to:from);service.deliver(wallMilliseconds:32)
        XCTAssertEqual(node.position.x,from.x,accuracy:1e-4,"A later frame receives its own newest sample")
        XCTAssertEqual(node.position.y,from.y,accuracy:1e-4)
    }
    func testMountedScene60PaintsLatestTouchBeforeIndependentSourceFrameAndKeepsFIFOOrder()throws {
        let(scene,service,from,to)=try fixture()
        let view=SKView(frame:.init(x:0,y:0,width:390,height:844)),host=UIViewController()
        let window=UIWindow(frame:view.bounds)
        host.view=view;window.rootViewController=host;window.isHidden=false
        view.preferredFramesPerSecond=60;view.presentScene(scene)
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        service.sourceMicrotaskTasks=tasks
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        defer {scene.dispose();service.dispose();scope.dispose();fifo.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        XCTAssertTrue(scene.view === view);XCTAssertFalse(view.isPaused)
        // Begin with the real renderer mounted, so the production owner chooses
        // transport using its actual renderer/admission predicate.
        scene.cancelDrag();XCTAssertTrue(scene.beginDrag(at:from))
        let node=try XCTUnwrap(scene.sourceNativeTileNode("source")),pickup=node.position
        scene.dispatchSourceTouchMove(to:.init(x:from.x+4,y:from.y))
        scene.dispatchSourceTouchMove(to:to)
        var events:[String]=[]
        let first=try XCTUnwrap(service.requestSourceAnimationFrame(ownerID:"test-first",generation:scene.engine.state.generation,callback:{
            XCTAssertEqual(node.position.x,to.x,accuracy:1e-4,"Latest captured input must paint before the renderer's subsequent Source callbacks")
            events.append("raf-first")
            XCTAssertTrue(scope.enqueue{events.append("reaction")})
        }))
        let second=try XCTUnwrap(service.requestSourceAnimationFrame(ownerID:"test-second",generation:scene.engine.state.generation,callback:{events.append("raf-second")}))
        XCTAssertEqual(node.position,pickup)
        scene.update(1)
        XCTAssertEqual(node.position.x,to.x,accuracy:1e-4);XCTAssertEqual(node.position.y,to.y,accuracy:1e-4)
        XCTAssertEqual(events,["raf-first","reaction","raf-second"],"Borrowed delivery still checkpoints each literal Source RAF in FIFO order")
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        XCTAssertTrue(service.rendererDragDeliveryActive)
        XCTAssertFalse(service.deliverIndependentFrame(rawFrameMilliseconds:1001),"The independent CAD callback cannot deliver the same active drag batch twice")
        XCTAssertEqual(events,["raf-first","reaction","raf-second"])
        withExtendedLifetime((first,second)) {}
        scene.cancelDrag()
        XCTAssertFalse(service.rendererDragDeliveryActive)
        XCTAssertTrue(service.deliverIndependentFrame(rawFrameMilliseconds:1016),"Ending direct manipulation restores canonical independent transport")
    }
    func testMountedScene30LeavesQueuedTouchForIndependentSourceTransport()throws {
        let(scene,service,from,to)=try fixture()
        let view=SKView(frame:.init(x:0,y:0,width:390,height:844)),host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        host.view=view;window.rootViewController=host;window.isHidden=false
        view.preferredFramesPerSecond=30;view.presentScene(scene)
        defer {scene.dispose();service.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        scene.cancelDrag();XCTAssertTrue(scene.beginDrag(at:from))
        let node=try XCTUnwrap(scene.sourceNativeTileNode("source")),pickup=node.position
        scene.dispatchSourceTouchMove(to:to);scene.update(1)
        XCTAssertEqual(node.position,pickup,"Scene30 cannot become the Source60 clock")
        XCTAssertFalse(service.rendererDragDeliveryActive)
        XCTAssertTrue(service.deliverIndependentFrame(rawFrameMilliseconds:1016))
        XCTAssertEqual(node.position.x,to.x,accuracy:1e-4);XCTAssertEqual(node.position.y,to.y,accuracy:1e-4)
    }
    func testHoverReusesIdenticalGeometryAcrossDifferentValidTargets()throws {
        let(scene,service,_,to)=try fixture();defer {scene.dispose();service.dispose()}
        let geometry=try XCTUnwrap(scene.boardGeometry)
        scene.moveDrag(to:to,now:1)
        let hover=try XCTUnwrap(scene.childNode(withName:"//native-stack-hover") as? SKShapeNode)
        XCTAssertFalse(hover.isHidden)
        let firstPath=try XCTUnwrap(hover.path),firstWidth=hover.lineWidth,firstBounds=firstPath.boundingBox
        XCTAssertEqual(hover.position.x,to.x,accuracy:0.001);XCTAssertEqual(hover.position.y,to.y,accuracy:0.001)
        let other=geometry.center(row:0,column:4)
        scene.moveDrag(to:other,now:1.1)
        XCTAssertFalse(hover.isHidden);XCTAssertEqual(hover.position.x,other.x,accuracy:0.001);XCTAssertEqual(hover.position.y,other.y,accuracy:0.001)
        XCTAssertTrue(try XCTUnwrap(hover.path) === firstPath,"Changing target ownership must not allocate identical hover geometry")
        XCTAssertEqual(hover.lineWidth,firstWidth);XCTAssertEqual(try XCTUnwrap(hover.path).boundingBox,firstBounds)
    }
    func testActualReleaseConsumesReleaseSampleBeforeQueuedRAFAndRetiresOldPaint()throws {
        let(scene,service,from,to)=try fixture();defer{scene.dispose();service.dispose()}
        scene.dispatchSourceTouchMove(to:.init(x:from.x+4,y:from.y))
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,1)
        let result=try XCTUnwrap(scene.finishDrag(at:to,now:0.016))
        XCTAssertTrue(result.accepted);XCTAssertEqual(scene.engine.state.tiles.first{$0.id=="target"}?.value,3)
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        let other=try XCTUnwrap(scene.sourceNativeTileNode("other")),oldPosition=other.position
        XCTAssertTrue(scene.beginDrag(at:oldPosition))
        service.deliver(wallMilliseconds:32)
        XCTAssertEqual(other.position,oldPosition,"A cancelled prior touch frame cannot paint a successor drag")
    }
    func testCancellationRetiresQueuedPaintAndProgrammaticMoveRemainsImmediate()throws {
        let(scene,service,from,to)=try fixture();defer{scene.dispose();service.dispose()}
        scene.dispatchSourceTouchMove(to:to);scene.cancelDrag()
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        service.deliver(wallMilliseconds:16)
        let node=try XCTUnwrap(scene.sourceNativeTileNode("other")),origin=node.position
        XCTAssertTrue(scene.beginDrag(at:origin));scene.moveDrag(to:.init(x:origin.x-10,y:origin.y))
        XCTAssertEqual(node.position.x,origin.x-10,accuracy:1e-4)
        XCTAssertNotEqual(from,to)
    }
    func testOldGenerationQueuedTouchCannotPaintReplacementBoard()throws {
        let(scene,service,from,to)=try fixture();defer{scene.dispose();service.dispose()}
        scene.dispatchSourceTouchMove(to:to)
        let old=try XCTUnwrap(scene.sourceNativeTileNode("source")),oldPosition=old.position
        var fresh=scene.engine.state;fresh.generation+=1
        scene.engine.restart(state:fresh)
        service.deliver(wallMilliseconds:16)
        XCTAssertEqual(old.position,oldPosition,"Generation replacement cannot authorize an old captured node")
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        XCTAssertNotEqual(from,to)
    }
    func testLostSourceScopeAdmissionCannotPaintQueuedTouch()throws {
        let(scene,service,_,to)=try fixture();defer{scene.dispose();service.dispose()}
        let node=try XCTUnwrap(scene.sourceNativeTileNode("source")),position=node.position
        scene.dispatchSourceTouchMove(to:to)
        scene.configureSourceRegularStackHandoff(service:service,admitted:{false})
        service.deliver(wallMilliseconds:16)
        XCTAssertEqual(node.position,position);XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
    }
}
