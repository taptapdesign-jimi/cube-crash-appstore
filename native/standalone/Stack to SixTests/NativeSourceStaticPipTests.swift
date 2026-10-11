import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceStaticPipTests:XCTestCase {
    private let maps=[1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]]
    private func assertPips(_ node:NativeDiceNode,value:Int,texture:SKTexture,file:StaticString=#filePath,line:UInt=#line)throws {
        let indices=maps[value] ?? []
        XCTAssertEqual(node.sourcePipNodes.count,indices.count,file:file,line:line)
        for (pip,index) in zip(node.sourcePipNodes,indices) {
            let sprite=try XCTUnwrap(pip as? SKSpriteNode,file:file,line:line)
            XCTAssertTrue(sprite.texture === texture,file:file,line:line)
            XCTAssertEqual(sprite.size,CGSize(width:15,height:15),file:file,line:line)
            XCTAssertEqual(sprite.position.x,CGFloat(index%3-1)*25.6,accuracy:0.0001,file:file,line:line)
            XCTAssertEqual(sprite.position.y,-CGFloat(index/3-1)*25.6,accuracy:0.0001,file:file,line:line)
            XCTAssertEqual(sprite.alpha,1,file:file,line:line)
            XCTAssertEqual(sprite.parent?.alpha,1,file:file,line:line)
            XCTAssertEqual(sprite.xScale,1,file:file,line:line);XCTAssertEqual(sprite.yScale,1,file:file,line:line)
        }
    }
    func testActualInitialHolderBatchUsesSharedPipsWithoutChangingRngOrPhysicalReceipts()throws {
        var draws=0,onDraw:(()->Void)?
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,columns:5,tutorialDemo:false,random:{draws+=1;onDraw?();return Double((draws*37)%97)/97}))
        let state=try XCTUnwrap(construction.recipe?.state)
        let timeline=NativeSourceOuterTimelineAdapter(service:service)
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844),sourceInitialConstruction:construction)
        scene.sourceOuterTimelineDriver=timeline
        defer{onDraw=nil;scene.dispose();construction.dispose();timeline.dispose();service.dispose()}
        scene.synchronize();let before=draws
        XCTAssertTrue(construction.nodes.values.allSatisfy{$0.sourcePipNodes.isEmpty})
        var batchObserved=false
        onDraw={
            guard draws==before+1 else{return};batchObserved=true
            for opening in construction.recipe?.openings ?? [] {
                XCTAssertTrue(construction.nodes[opening.tileID]?.sourcePipNodes.allSatisfy{$0 is SKSpriteNode}==true)
                XCTAssertFalse(construction.nodes[opening.tileID]?.sourcePipNodes.isEmpty ?? true)
            }
        }
        service.deliver(wallMilliseconds:16)
        XCTAssertTrue(batchObserved)
        XCTAssertEqual(draws,before+(construction.recipe?.openings.count ?? 0),"Only the actual initial face skin draws consume Source entropy")
        let texture=construction.textures.pipTexture()
        for tile in state.tiles {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id))
            if !tile.locked && tile.value>0 {try assertPips(node,value:tile.value,texture:texture)}else{XCTAssertTrue(node.sourcePipNodes.isEmpty)}
            XCTAssertTrue(node.sourcePhysicalMarkersCovered);XCTAssertEqual(node.sourceStackDepth,1)
        }
        let capture=try XCTUnwrap(scene.captureSourcePhysicalBoard())
        XCTAssertEqual(capture.canonicalState,state);XCTAssertTrue(capture.isStillCurrent())
        scene.dispose();XCTAssertFalse(capture.isStillCurrent())
    }
    func testActualStackRafKeepsSharedPipGeometryFaceAndLifecycleGuards()throws {
        let textures=NativeBoardTextures(root:NativeTestResources.root),canvas=SKNode()
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let timeline=NativeSourceOuterTimelineAdapter(service:service)
        defer{timeline.dispose();textures.dispose();service.dispose()}
        let node=NativeDiceNode(id:"stack",value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:textures)
        canvas.addChild(node)
        XCTAssertTrue(node.prepareSourceInitialHolder(rotation:0,generation:1,cell:.init(column:0,row:0)))
        node.installSourceOuterDriver(timeline,generation:1,geometryScale:1)
        XCTAssertTrue(node.prepareSourceHardPrimaryBeforeValue())
        node.sourceValue=1;node.flushSourceInitialHolderVisuals()
        let pipTexture=textures.pipTexture();try assertPips(node,value:1,texture:pipTexture)
        var draws=0,commits=0,canceled=0
        XCTAssertTrue(node.queueSourceStackValue(5,addStack:1,service:service,random:{draws+=1;return 0.1},current:{node.parent === canvas && node.sourceContactNodeAlive},onPhysicalCommit:{commits+=1;return true},onCancelled:{canceled+=1}))
        XCTAssertTrue(node.sourceRegularFramePending)
        service.deliver(wallMilliseconds:16)
        XCTAssertEqual(commits,1);XCTAssertEqual(canceled,0);XCTAssertEqual(node.sourceStackDepth,2)
        XCTAssertFalse(node.sourceRegularFramePending);XCTAssertTrue(node.sourcePhysicalMarkersCovered)
        XCTAssertNotNil(node.sourceCurrentRegularSkin);XCTAssertNotNil(node.sourcePaintedNumbersTexture)
        try assertPips(node,value:5,texture:pipTexture)
        let after=draws,retainedPips=node.sourcePipNodes
        XCTAssertTrue(node.queueSourceStackValue(3,addStack:0,service:service,random:{draws+=1;return 0.1},current:{node.parent === canvas && node.sourceContactNodeAlive},onCancelled:{canceled+=1}))
        node.dispose();service.deliver(wallMilliseconds:32)
        XCTAssertEqual(draws,after);XCTAssertEqual(canceled,1)
        XCTAssertEqual(node.sourcePipNodes.map(ObjectIdentifier.init),retainedPips.map(ObjectIdentifier.init),"A retired RAF cannot redraw retained pip children")
        XCTAssertFalse(node.sourceContactNodeAlive);XCTAssertFalse(node.sourcePhysicalMarkersCovered)
    }
}
