import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialPreparationMountedTests:XCTestCase {
    @MainActor private final class Counter {var draws=0,now=0.0;func next()->Double{draws+=1;return Double((draws*37)%97)/97}}
    @MainActor private final class Fixture {
        let counter=Counter(),service:NativeSourceAnimationClockService,driver:NativeSourceOuterTimelineAdapter,construction:NativeSourceInitialBoardConstruction,scene:NativeBoardScene,receipt:NativeSourceTutorialDemoActivationReceipt
        var owner:NativeSourceTutorialStepOnePreparation?,updates=0,layouts=0
        init(columns:Int=5)throws {
            let counter=counter
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{counter.now},sourceFrameTransportEnabled:true)
            driver=NativeSourceOuterTimelineAdapter(service:service)
            construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,columns:columns,tutorialDemo:true,random:counter.next))
            scene=NativeBoardScene(engine:NativeGameplayEngine(state:try XCTUnwrap(construction.recipe?.state)),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844),sourceInitialConstruction:construction)
            scene.sourceOuterTimelineDriver=driver
            scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
            counter.now=16;service.deliver(wallMilliseconds:16)
            XCTAssertEqual(construction.pendingFaceCount,0)
            scene.engine.sourceTutorialDemoActivationEnabled=true
            receipt=try XCTUnwrap(scene.engine.beginSourceTutorialDemoActivation())
        }
        func install(layout:(()->Void)?=nil)throws {
            let geometry=try XCTUnwrap(scene.boardGeometry),tiles=scene.engine.state.tiles
            let positions=Dictionary(uniqueKeysWithValues:tiles.map{($0.id,geometry.center(row:$0.cell.row,column:$0.cell.column))})
            owner=try XCTUnwrap(NativeSourceTutorialStepOnePreparation(engine:scene.engine,receipt:receipt,service:service,random:counter.next,nodes:construction.nodes,parent:construction.canvas,positions:positions,current:{[weak scene] in scene?.sourceAnimationBindingAdmissionOpen==true},layoutBoard:{[weak self] in self?.layouts+=1;layout?()},updateFocus:{[weak self] in self?.updates+=1}))
        }
        func deliver(_ ms:Double){counter.now=ms;service.deliver(wallMilliseconds:ms)}
        func dispose(){owner?.dispose();owner=nil;scene.dispose();construction.dispose();driver.dispose();service.dispose()}
    }
    func testOriginalDemoPreservesValuesAndUsesExactSynchronousThenNestedRepairDrawOrder()throws {
        let f=try Fixture();defer{f.dispose()};try f.install();let before=f.scene.engine.state,draws=f.counter.draws
        XCTAssertTrue(try XCTUnwrap(f.owner).prepare());XCTAssertEqual(f.layouts,1);XCTAssertEqual(f.counter.draws-draws,88);XCTAssertEqual(f.owner?.pendingRepairCount,1)
        XCTAssertEqual(f.scene.engine.state.tiles.map(\.value),before.tiles.map(\.value));XCTAssertEqual(f.scene.engine.state.tiles.map(\.locked),before.tiles.map(\.locked));XCTAssertEqual(f.scene.engine.state.rngState,before.rngState);XCTAssertEqual(f.scene.engine.state.moves,before.moves);XCTAssertEqual(f.scene.engine.state.revision,before.revision)
        let pair=Set([f.receipt.threeID,f.receipt.twoID]);let geometry=try XCTUnwrap(f.scene.boardGeometry)
        for tile in f.scene.engine.state.tiles {
            let node=try XCTUnwrap(f.construction.nodes[tile.id]);XCTAssertTrue(f.scene.sourceNativeTileNode(tile.id) === node);XCTAssertTrue(f.owner?.owns(node)==true)
            XCTAssertFalse(node.isHidden);XCTAssertEqual(node.depth,1);XCTAssertEqual(node.sourceEventMode,pair.contains(tile.id) ? "static":"none")
            if pair.contains(tile.id){XCTAssertEqual(node.position.x,geometry.center(row:tile.cell.row,column:tile.cell.column).x,accuracy:2e-5)}
        }
        f.deliver(32);XCTAssertEqual(f.counter.draws-draws,90);XCTAssertEqual(f.updates,0);XCTAssertEqual(f.owner?.pendingRepairCount,1)
        f.deliver(48);XCTAssertEqual(f.counter.draws-draws,92);XCTAssertEqual(f.updates,1);XCTAssertEqual(f.owner?.pendingRepairCount,0)
    }
    func testTabletUsesLiteral124FocusDrawsThenFourRepairDraws()throws {
        let f=try Fixture(columns:7);defer{f.dispose()};try f.install();let draws=f.counter.draws
        XCTAssertTrue(try XCTUnwrap(f.owner).prepare());XCTAssertEqual(f.counter.draws-draws,124)
        f.deliver(32);f.deliver(48);XCTAssertEqual(f.counter.draws-draws,128)
    }
    func testRetirementKillsOnlyCapturedFocusAndRepairRootsWithoutForcedArrivalOrMath()throws {
        let f=try Fixture();defer{f.dispose()};try f.install();XCTAssertTrue(try XCTUnwrap(f.owner).prepare())
        let original=f.scene.engine.state,draws=f.counter.draws;f.owner?.dispose();XCTAssertEqual(f.owner?.activeFocusRootCount,0);XCTAssertEqual(f.owner?.pendingRepairCount,0)
        f.deliver(32);f.deliver(48);XCTAssertEqual(f.counter.draws,draws);XCTAssertEqual(f.updates,0);XCTAssertEqual(f.scene.engine.state,original)
        XCTAssertNotNil(f.construction.nodes[f.receipt.threeID]?.parent)
    }
    func testActualLayoutCallbackRetirementCannotStartFocusOrRevivePreparedRoute()throws {
        let f=try Fixture();defer{f.dispose()};try f.install(layout:{[weak f] in f?.owner?.dispose()});let draws=f.counter.draws
        XCTAssertFalse(try XCTUnwrap(f.owner).prepare());XCTAssertEqual(f.counter.draws,draws);XCTAssertEqual(f.owner?.activeFocusRootCount,0);XCTAssertEqual(f.owner?.pendingRepairCount,0)
        f.deliver(32);XCTAssertEqual(f.counter.draws,draws);XCTAssertEqual(f.updates,0)
        // The genuine Core writer already ran before layout. Disposal cannot
        // invent an inverse value/score mutation or restore old guide state.
        XCTAssertNil(f.scene.engine.pendingSourceTutorialDemoActivation);XCTAssertEqual(f.scene.engine.state.moves,50)
    }
}
