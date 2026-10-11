import XCTest
import SpriteKit
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
