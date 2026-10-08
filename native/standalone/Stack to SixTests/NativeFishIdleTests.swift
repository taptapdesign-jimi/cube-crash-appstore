import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeFishIdleTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    private struct Matrix:Decodable {let a,b,c,d,tx,ty:Double}
    private struct Gold:Decodable {let width,height,alpha,opacity:Double,matrix:Matrix,css:[Double],facing:Bool}
    func testPoseAndOpacityMatchExecutedImmutableV9WorldMatrixAtThreeViewportFamilies() throws {
        let gold=try JSONDecoder().decode([Gold].self,from:Data(NativeFishIdleSourceOracle.json.utf8))
        XCTAssertEqual(gold.count,64)
        XCTAssertEqual(NativeFishIdlePresentation.logicalMediaSize.width,272*128.0/224,accuracy:1e-12)
        XCTAssertEqual(NativeFishIdlePresentation.logicalMediaSize.height,160,accuracy:1e-12)
        for fixture in gold {
            let m=fixture.matrix,center=CGPoint(x:m.tx,y:fixture.height-m.ty)
            let pose=NativeFishIdleFrame.project(center:center,horizontalUnit:CGPoint(x:center.x+m.a,y:center.y-m.b),verticalUnit:CGPoint(x:center.x+m.c,y:center.y-m.d),sceneHeight:fixture.height,alpha:fixture.alpha*0.7*0.8,dragging:false,phaseStarted:true,visible:true,bubbles:[])
            let transform=pose.transform,w=NativeFishIdlePresentation.logicalMediaSize.width,h=NativeFishIdlePresentation.logicalMediaSize.height
            let actual=[transform.a,transform.b,transform.c,transform.d,pose.point.x-transform.a*w/2-transform.c*h/2,pose.point.y-transform.b*w/2-transform.d*h/2]
            for (value,source) in zip(actual,fixture.css) {XCTAssertEqual(value,source,accuracy:1e-10)}
            XCTAssertEqual(pose.alpha,fixture.opacity,accuracy:1e-12)
            XCTAssertEqual(center.x>fixture.width/2,fixture.facing)
        }
    }
    func testOriginalMoviePlaysAtSourceRateAndPointerHidesItBeforeReturningNativePose() async throws {
        let fish=NativeTile(id:"fish",cell:NativeCell(column:0,row:0),value:0,archetype:.juice,variant:"fish")
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[fish,NativeTile(id:"a",cell:NativeCell(column:1,row:0),value:1),NativeTile(id:"b",cell:NativeCell(column:2,row:0),value:2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true}
        let host=try XCTUnwrap(controller.view.subviews.compactMap {$0 as? NativeFishIdleOwner}.first)
        let deadline=CACurrentMediaTime()+8
        while host.presentation(tileID:"fish")?.mediaReady != true,CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(25))}
        let owner=try XCTUnwrap(host.presentation(tileID:"fish")),scene=try XCTUnwrap(controller.boardScene)
        XCTAssertTrue(owner.mediaReady,"Actual unchanged original1x HEVC must prepare and enter its captured phase")
        XCTAssertEqual(owner.playbackRate,1);XCTAssertFalse(owner.isHidden);XCTAssertEqual(owner.bubbleCarrierCount,6)
        let node=try XCTUnwrap(scene.childNode(withName:"//native-die-fish") as? NativeDiceNode)
        let field=try XCTUnwrap(node.visual.children.compactMap {$0 as? NativeIdleBubbleField}.first)
        XCTAssertTrue(field.isHidden,"The same bubble producer is mirrored once above source foreground video")
        let entryDeadline=CACurrentMediaTime()+3
        while !scene.isBoardEntryComplete,CACurrentMediaTime()<entryDeadline {try await Task.sleep(for:.milliseconds(25))}
        XCTAssertTrue(scene.isBoardEntryComplete,"Wait for the actual authored entry completion and input admission")
        let point=scene.boardGeometry!.center(row:0,column:0)
        XCTAssertTrue(scene.beginDrag(at:point));XCTAssertTrue(owner.isHidden);XCTAssertEqual(owner.playbackRate,0)
        XCTAssertEqual(field.activeCount,0);XCTAssertFalse(field.isHidden)
        XCTAssertEqual(scene.finishDrag(at:point,now:1)?.accepted,false)
        XCTAssertFalse(owner.isHidden,"Source media resumes on pointer-up while actual snapback still owns emitter restart")
        XCTAssertFalse(field.isRunning)
        try await Task.sleep(for:.milliseconds(350));XCTAssertTrue(field.isRunning)
        controller.setSuspended(true);XCTAssertTrue(owner.isHidden);XCTAssertEqual(owner.playbackRate,0)
        controller.setSuspended(false)
        engine.restart(state:NativeBoardState(columns:5,rows:9,tiles:[NativeTile(id:"a2",cell:NativeCell(column:1,row:0),value:1),NativeTile(id:"b2",cell:NativeCell(column:2,row:0),value:2)]))
        controller.refreshFromEngine()
        XCTAssertEqual(host.activeMediaCount,0);XCTAssertEqual(owner.retainedItemCount,0);XCTAssertEqual(owner.playbackRate,0)
    }
    func testMissingMediaKeepsOriginalStaticArtworkAndReleasesFailedPlayerItems() {
        let host=NativeFishIdleOwner(resourceRoot:root.appendingPathComponent("missing-original-media"),mediaPolicy:NativeFishMediaPolicy())
        let frame=NativeFishIdleFrame.project(center:CGPoint(x:90,y:100),horizontalUnit:CGPoint(x:91,y:100),verticalUnit:CGPoint(x:90,y:99),sceneHeight:844,alpha:1,dragging:false,phaseStarted:true,visible:true,bubbles:[])
        var failures=0;host.onMediaReady={id,generation,ready in XCTAssertEqual(id,"f");XCTAssertEqual(generation,7);XCTAssertFalse(ready);failures+=1}
        host.paint(["f":frame],generation:7,force:true)
        let player=host.presentation(tileID:"f")
        XCTAssertEqual(failures,1);XCTAssertEqual(player?.retainedItemCount,0);XCTAssertEqual(player?.mediaReady,false);XCTAssertEqual(player?.isHidden,true)
        host.paint([:],generation:8,force:true);XCTAssertEqual(host.activeMediaCount,0)
        host.dispose();host.dispose();host.paint(["f":frame],generation:9,force:true)
        XCTAssertEqual(host.activeMediaCount,0);XCTAssertEqual(failures,1)
    }
    func testActualNativeBranchProjectionPreservesShakeAndSourceDragFacingWithoutASecondIdleOwner() throws {
        let scene=SKScene(size:CGSize(width:390,height:844)),canvas=SKNode();scene.addChild(canvas);canvas.position=CGPoint(x:8,y:-6)
        let textures=NativeBoardTextures(root:root),fish=NativeDiceNode(id:"f",value:0,kind:"wild-juice",variant:"fish",depth:1,locked:false,textures:textures)
        canvas.addChild(fish);fish.position=CGPoint(x:260,y:300);fish.setScale(0.4);fish.alpha=0.8;fish.visual.alpha=0.7
        defer {fish.dispose();textures.dispose()}
        fish.setDragging(true)
        let pose=try XCTUnwrap(fish.fishFrame(in:scene,visible:true))
        XCTAssertEqual(pose.point.x,268,accuracy:1e-5);XCTAssertEqual(pose.point.y,550,accuracy:1e-5)
        XCTAssertEqual(pose.transform.a,0.432,accuracy:1e-5);XCTAssertEqual(pose.transform.d,0.432,accuracy:1e-5)
        XCTAssertEqual(pose.alpha,0.56,accuracy:1e-5);XCTAssertTrue(pose.dragging);XCTAssertEqual(pose.bubbles.count,0)
        let face=try XCTUnwrap(fish.visual.children.compactMap {$0 as? SKSpriteNode}.first)
        XCTAssertEqual(face.xScale,-1)
        fish.position.x=90;_ = fish.fishFrame(in:scene,visible:true);XCTAssertEqual(face.xScale,1)
        fish.setDragging(false);fish.setFishMediaReady(true);XCTAssertTrue(face.isHidden)
        fish.setFishMediaReady(false);XCTAssertFalse(face.isHidden)
    }
}
