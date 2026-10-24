import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
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
    func testOriginalFramesStayVisibleThroughPointerWithoutPNGHandoffOrPhaseReset() async throws {
        let fish=NativeTile(id:"fish",cell:NativeCell(column:0,row:0),value:0,archetype:.juice,variant:"fish")
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[fish,NativeTile(id:"a",cell:NativeCell(column:1,row:0),value:1),NativeTile(id:"b",cell:NativeCell(column:2,row:0),value:2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true}
        let host=try XCTUnwrap(controller.view.subviews.compactMap {$0 as? NativeFishIdleOwner}.first)
        let deadline=CACurrentMediaTime()+8
        while host.presentation(tileID:"fish")?.mediaReady != true,CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(25))}
        let owner=try XCTUnwrap(host.presentation(tileID:"fish")),scene=try XCTUnwrap(controller.boardScene)
        XCTAssertTrue(owner.mediaReady,"Actual unchanged original SVG must prepare and enter its captured phase")
        XCTAssertEqual(owner.playbackRate,0);XCTAssertEqual(owner.bubbleCarrierCount,6)
        XCTAssertTrue(owner.usesOriginalSVGFallback,"Board Fish must avoid video queue replacement at each loop")
        XCTAssertEqual(owner.retainedItemCount,0)
        XCTAssertEqual(host.selectedSVGFrameCount,72)
        let node=try XCTUnwrap(scene.childNode(withName:"//native-die-fish") as? NativeDiceNode)
        let field=try XCTUnwrap(node.visual.children.compactMap {$0 as? NativeIdleBubbleField}.first)
        XCTAssertTrue(field.isHidden,"The same bubble producer is mirrored once above source foreground video")
        let entryDeadline=CACurrentMediaTime()+3
        while (!scene.isBoardEntryComplete || owner.isHidden),CACurrentMediaTime()<entryDeadline {try await Task.sleep(for:.milliseconds(25))}
        XCTAssertTrue(scene.isBoardEntryComplete,"Wait for the actual authored entry completion and input admission");XCTAssertFalse(owner.isHidden)
        let face=try XCTUnwrap(node.visual.children.compactMap {$0 as? SKSpriteNode}.first)
        XCTAssertTrue(face.isHidden)
        // A sibling stack/merge suspends shared registry motion, never this
        // admitted direct-media identity or its already hidden static base.
        scene.onSpecialIdleSuspended?(true)
        XCTAssertFalse(owner.isHidden);XCTAssertEqual(owner.playbackRate,0)
        controller.refreshFromEngine()
        XCTAssertTrue(host.presentation(tileID:"fish") === owner)
        XCTAssertTrue(face.isHidden)
        scene.onSpecialIdleSuspended?(false)
        XCTAssertFalse(owner.isHidden);XCTAssertEqual(owner.playbackRate,0)
        let point=scene.boardGeometry!.center(row:0,column:0)
        XCTAssertTrue(scene.beginDrag(at:point));XCTAssertFalse(owner.isHidden);XCTAssertTrue(face.isHidden);XCTAssertEqual(owner.playbackRate,0)
        XCTAssertEqual(field.activeCount,0);XCTAssertTrue(field.isHidden)
        let held=owner.originalSVGFrame
        try await Task.sleep(for:.milliseconds(120))
        XCTAssertFalse(owner.isHidden);XCTAssertTrue(face.isHidden)
        XCTAssertNotEqual(owner.originalSVGFrame,held,"The same SVG clock keeps swimming while held")
        let image=UIGraphicsImageRenderer(size:window.bounds.size).image{window.layer.render(in:$0.cgContext)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/fishy-drag-svg.png"))
        XCTAssertEqual(scene.finishDrag(at:point,now:1)?.accepted,false)
        XCTAssertFalse(owner.isHidden,"Source media resumes on pointer-up while actual snapback still owns emitter restart")
        XCTAssertFalse(field.isRunning)
        let snapbackDeadline=CACurrentMediaTime()+2
        while !field.isRunning,CACurrentMediaTime()<snapbackDeadline {try await Task.sleep(for:.milliseconds(25))}
        XCTAssertTrue(field.isRunning,"Actual snapback must resume its bubble owner")
        controller.setSuspended(true);XCTAssertTrue(owner.isHidden);XCTAssertEqual(owner.playbackRate,0)
        controller.setSuspended(false)
        engine.restart(state:NativeBoardState(columns:5,rows:9,tiles:[NativeTile(id:"a2",cell:NativeCell(column:1,row:0),value:1),NativeTile(id:"b2",cell:NativeCell(column:2,row:0),value:2)]))
        controller.refreshFromEngine()
        XCTAssertEqual(host.activeMediaCount,0);XCTAssertEqual(owner.retainedItemCount,0);XCTAssertEqual(owner.playbackRate,0)
    }
    func testTwoBoardFishShareOriginalFramesAndNeverRenderEmptyAtLoopWrap() async throws {
        let tiles=[NativeTile(id:"f1",cell:.init(column:0,row:0),value:0,archetype:.juice,variant:"fish"),
                   NativeTile(id:"f2",cell:.init(column:4,row:5),value:0,archetype:.juice,variant:"fish"),
                   NativeTile(id:"a",cell:.init(column:2,row:0),value:1),NativeTile(id:"b",cell:.init(column:3,row:0),value:2)]
        let engine=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller
        window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true}
        let host=try XCTUnwrap(controller.view.subviews.compactMap {$0 as? NativeFishIdleOwner}.first)
        let deadline=CACurrentMediaTime()+8
        while (host.presentation(tileID:"f1")?.mediaReady != true || host.presentation(tileID:"f2")?.mediaReady != true || controller.boardScene?.isBoardEntryComplete != true),CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(25))}
        XCTAssertEqual(host.activeMediaCount,2);XCTAssertEqual(host.selectedSVGFrameCount,72)
        let owners=try ["f1","f2"].map {try XCTUnwrap(host.presentation(tileID:$0))}
        let format=UIGraphicsImageRendererFormat();format.scale=1;format.opaque=false
        let renderer=UIGraphicsImageRenderer(size:NativeFishIdlePresentation.logicalMediaSize,format:format)
        for owner in owners {
            XCTAssertTrue(owner.usesOriginalSVGFallback);XCTAssertEqual(owner.retainedItemCount,0)
            var seen=Set<Int>()
            // Three full source cycles, including the exact71→0 boundary.
            let start=CACurrentMediaTime()
            for tick in 0..<216 {
                let pointer=NativeFishIdleFrame.project(center:.init(x:150,y:400),horizontalUnit:.init(x:151,y:400),verticalUnit:.init(x:150,y:399),sceneHeight:844,alpha:1,dragging:tick%20<10,phaseStarted:true,visible:true,bubbles:[])
                owner.paint(pointer,now:start+Double(tick)/64,force:true)
                XCTAssertFalse(owner.isHidden);XCTAssertTrue(owner.mediaReady)
                seen.insert(try XCTUnwrap(owner.originalSVGFrame))
                let image=try XCTUnwrap(renderer.image {owner.layer.render(in:$0.cgContext)}.cgImage)
                var pixels=[UInt8](repeating:0,count:image.width*image.height*4)
                let occupied=pixels.withUnsafeMutableBytes {bytes -> Int in
                    let context=CGContext(data:bytes.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                    context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
                    return stride(from:3,to:bytes.count,by:4).reduce(0){$0+(bytes[$1]>16 ? 1:0)}
                }
                XCTAssertGreaterThan(occupied,500,"Fish must retain visible pixels through wrap, tick \(tick)")
            }
            XCTAssertEqual(seen.count,72)
        }
        XCTAssertEqual(engine.state.tiles,tiles,"Presentation sampling must not mutate the board")
        controller.dispose();XCTAssertEqual(host.activeMediaCount,0);XCTAssertEqual(host.selectedSVGFrameCount,0)
    }
    func testRestoredSourceFishAdvanceFromAcceptedClockWithoutManualPaint() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("fish-source-clock-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var saved=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        saved.progression.firstPlayTutorialComplete=true
        saved.arcadeRun = .init(tiles:[.init(id:"f1",cell:.init(column:0,row:5),value:6,starOrbitCount:1,archetype:.star,variant:"fish"),.init(id:"f2",cell:.init(column:4,row:7),value:6,starOrbitCount:1,archetype:.star,variant:"fish"),.init(id:"a",cell:.init(column:1,row:0),value:1),.init(id:"b",cell:.init(column:2,row:0),value:2)],mode:.arcade,board:1,generation:9,moves:30)
        try store.save(saved)
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
        let bootstrap=try NativeBootstrap(root:root,store:store,showStudioIntro:false,sourceContext:context)
        bootstrap.sourceInitialWildResumeEnabled=true;bootstrap.sourceSpecialIdlePresentationEnabled=true
        let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;try? FileManager.default.removeItem(at:directory)}
        let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
        let deadline=CACurrentMediaTime()+15
        while app.children.compactMap({$0 as? NativeGameplayViewController}).first==nil,CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(20))}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let media=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeFishIdleOwner}.first)
        var wall=0.0
        while (media.presentation(tileID:"f1")?.mediaReady != true || media.presentation(tileID:"f2")?.mediaReady != true),CACurrentMediaTime()<deadline {
            wall+=20;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(20))
        }
        let owners=try ["f1","f2"].map {try XCTUnwrap(media.presentation(tileID:$0))}
        var frames=[Set<Int>(),Set<Int>()]
        for _ in 0..<120 {
            wall+=20;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(20))
            for (i,owner) in owners.enumerated() {XCTAssertFalse(owner.isHidden);if let frame=owner.originalSVGFrame {frames[i].insert(frame)}}
        }
        for (i,seen) in frames.enumerated() {
            let node=try XCTUnwrap(game.boardScene?.sourceNativeTileNode(i==0 ? "f1":"f2"))
            XCTAssertGreaterThan(seen.count,20,"Accepted board clock must animate each Fish: \(node.authoredArtworkReceipt)")
        }
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
        XCTAssertEqual(pose.transform.a,-0.432,accuracy:1e-5);XCTAssertEqual(pose.transform.d,0.432,accuracy:1e-5)
        XCTAssertEqual(pose.alpha,0.56,accuracy:1e-5);XCTAssertTrue(pose.dragging);XCTAssertEqual(pose.bubbles.count,0)
        let face=try XCTUnwrap(fish.visual.children.compactMap {$0 as? SKSpriteNode}.first)
        XCTAssertEqual(face.xScale,-1)
        fish.position.x=90;_ = fish.fishFrame(in:scene,visible:true);XCTAssertEqual(face.xScale,1)
        fish.setDragging(false);fish.setFishMediaReady(true);XCTAssertTrue(face.isHidden)
        fish.setFishMediaReady(false);XCTAssertFalse(face.isHidden)
    }
    func testMediaVisibilityPreservesPaintedFacingAndPointerReleaseAloneRestoresRestFacing()throws {
        let scene=SKScene(size:.init(width:390,height:844)),canvas=SKNode();scene.addChild(canvas)
        let textures=NativeBoardTextures(root:root)
        let fish=NativeDiceNode(id:"f",value:6,kind:"wild",variant:"fish",depth:1,locked:false,textures:textures)
        defer{fish.dispose();textures.dispose()};canvas.addChild(fish);fish.position = .init(x:260,y:300)
        let face=try XCTUnwrap(fish.visual.children.compactMap{$0 as? SKSpriteNode}.first)
        face.xScale = -1;fish.setFishMediaReady(true)
        XCTAssertTrue(face.isHidden);XCTAssertEqual(face.xScale,-1,"Media readiness owns visibility, not the repaired face's sign")
        fish.setFishMediaReady(false);XCTAssertFalse(face.isHidden);XCTAssertEqual(face.xScale,-1)
        fish.setDragging(true);_ = fish.fishFrame(in:scene,visible:true)
        XCTAssertEqual(face.xScale,-1);XCTAssertFalse(face.isHidden)
        fish.setFishMediaReady(true);XCTAssertTrue(face.isHidden);XCTAssertEqual(face.xScale,-1)
        fish.setDragging(false)
        XCTAssertEqual(face.xScale,1,"Actual pointer release restores the authored resting direction")
        XCTAssertTrue(face.isHidden,"The ready media still hides its static base on release")
        fish.setDragging(true);fish.position.x=90;_ = fish.fishFrame(in:scene,visible:true)
        XCTAssertEqual(face.xScale,1);XCTAssertTrue(face.isHidden)
    }
}
