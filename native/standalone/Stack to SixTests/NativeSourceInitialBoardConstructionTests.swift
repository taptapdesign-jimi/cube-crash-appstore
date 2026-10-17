import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeSourceInitialBoardConstructionTests:XCTestCase {
    @MainActor private final class Counter {
        var count=0,onDraw:(()->Void)?
        func next()->Double {count+=1;onDraw?();return Double((count*37)%97)/97}
    }
    @MainActor private final class Fixture {
        let counter:Counter,service:NativeSourceAnimationClockService,construction:NativeSourceInitialBoardConstruction,scene:NativeBoardScene
        init(columns:Int=5,tutorial:Bool=false) throws {
            let counter=Counter();self.counter=counter
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,columns:columns,tutorialDemo:tutorial,random:{counter.next()}))
            let state=try XCTUnwrap(construction.recipe?.state)
            scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844),sourceInitialConstruction:construction)
            scene.synchronize()
        }
        func dispose(){counter.onDraw=nil;scene.dispose();construction.dispose();service.dispose()}
    }
    func testArcadeVariantsUseActualSourceRecipeAndNormalRoundsKeepDrawIdentity() throws {
        for round in [1,4,5,10] {
            let normal=Counter(),pure=Counter()
            let a=try XCTUnwrap(NativeSourceInitialBoardRecipe.capture(mode:.arcade,board:round,random:{normal.next()}))
            let b=try XCTUnwrap(NativeSourceInitialBoardRecipe.capture(mode:.arcade,board:round,arcadeVariant:.pureDice,random:{pure.next()}))
            XCTAssertEqual(b.state.effectiveArcadeVariant,.pureDice)
            XCTAssertEqual(a.holders,b.holders)
            XCTAssertFalse(b.state.tiles.contains(where: \.isWild))
            if round>=5 {XCTAssertEqual(a.openings,b.openings);XCTAssertEqual(normal.count,pure.count)}
            else {XCTAssertEqual(pure.count,normal.count+b.openings.count)}
        }
    }
    func testExactSameObjectsAndTextureOwnerReachSceneWithOriginalTiltAndHiddenBase() throws {
        let f=try Fixture();defer{f.dispose()}
        let recipe=try XCTUnwrap(f.construction.recipe)
        XCTAssertTrue(f.scene.sourceInitialStartupReady);XCTAssertEqual(f.counter.count,103)
        XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,15)
        for holder in recipe.holders {
            let node=try XCTUnwrap(f.scene.sourceNativeTileNode(holder.tileID))
            XCTAssertTrue(node === f.construction.nodes[holder.tileID]);XCTAssertTrue(node.parent === f.construction.canvas)
            XCTAssertEqual(node.sourceGridCell,holder.cell)
            XCTAssertTrue(node.isHidden);XCTAssertTrue(node.sourcePaintedNumbersTexture === f.construction.textures.texture("assets/tile.png",densityAware:false))
            XCTAssertEqual(Double(node.dragInnerTilt),holder.rotation,accuracy:2e-5)
            XCTAssertEqual(Double(node.visual.position.x),-64*sin(holder.rotation),accuracy:2e-5)
            XCTAssertEqual(Double(node.visual.position.y),64*(1-cos(holder.rotation)),accuracy:2e-5)
            XCTAssertTrue(node.sourcePipNodes.isEmpty);XCTAssertEqual(node.depth,1);XCTAssertEqual(node.sourceBaseScaleX,0.25,accuracy:1e-6)
        }
    }
    func testActualNodeCellObservationDoesNotBorrowCoreCellOrPaintedPosition() throws {
        let f=try Fixture();defer{f.dispose()}
        let model=try XCTUnwrap(f.scene.engine.state.tiles.first)
        let node=try XCTUnwrap(f.scene.sourceNativeTileNode(model.id))
        let board=try XCTUnwrap(f.scene.captureSourcePhysicalBoard())
        XCTAssertEqual(board.canonicalState,f.scene.engine.state);XCTAssertTrue(board.isStillCurrent())
        let observer=NativeSourceNodeRuntimeObservation(node:node,canvas:f.construction.canvas,
            generation:f.scene.engine.state.generation,
            lookup:{[weak scene=f.scene] in scene?.sourceNativeTileNode($0)},current:{[weak construction=f.construction] in construction?.isCurrent==true})
        node.position=CGPoint(x:900,y:-1500)
        XCTAssertTrue(board.isStillCurrent(),"Painted position cannot replace Source grid identity")
        var different=model;different.cell = .init(column:99,row:99)
        XCTAssertEqual(try XCTUnwrap(observer.read(different)).tile.cell,model.cell)
        XCTAssertFalse(node.bindSourceGridCell(.init(column:2,row:2),generation:f.scene.engine.state.generation+1))
        XCTAssertEqual(node.sourceGridCell,model.cell)
        XCTAssertTrue(node.bindSourceGridCell(.init(column:2,row:2),generation:f.scene.engine.state.generation))
        XCTAssertEqual(try XCTUnwrap(observer.read(model)).tile.cell,.init(column:2,row:2))
        XCTAssertNil(f.scene.captureSourcePhysicalBoard(),"Conflicting actual grid identity must refuse the entire capture")
        XCTAssertFalse(board.isStillCurrent())
        XCTAssertTrue(node.bindSourceGridCell(model.cell,generation:f.scene.engine.state.generation))
        XCTAssertNotNil(f.scene.captureSourcePhysicalBoard())
        node.dispose();XCTAssertNil(node.sourceGridCell);XCTAssertNil(observer.read(model))
        XCTAssertFalse(board.isStillCurrent())
        XCTAssertNil(f.scene.captureSourcePhysicalBoard())
    }
    func testFullPhysicalCaptureRejectsLateTilePaintAndRosterChanges() throws {
        let f=try Fixture(columns:7);defer{f.dispose()}
        let model=try XCTUnwrap(f.scene.engine.state.tiles.last)
        let node=try XCTUnwrap(f.scene.sourceNativeTileNode(model.id))
        let captured=try XCTUnwrap(f.scene.captureSourcePhysicalBoard())
        XCTAssertEqual(captured.tiles.count,f.scene.engine.state.tiles.count)
        XCTAssertTrue(captured.isStillCurrent())
        let originalAlpha=node.alpha
        node.alpha=0.37
        XCTAssertFalse(captured.isStillCurrent(),"The last tile must remain part of the escaped physical fence")
        node.alpha=originalAlpha
        XCTAssertTrue(captured.isStillCurrent())
        node.removeFromParent()
        XCTAssertFalse(captured.isStillCurrent())
        XCTAssertNil(f.scene.captureSourcePhysicalBoard())
        f.construction.canvas.addChild(node)
        XCTAssertTrue(captured.isStillCurrent())
        f.scene.dispose()
        XCTAssertFalse(captured.isStillCurrent())
        XCTAssertNil(f.scene.captureSourcePhysicalBoard())
    }

    func testOneConstructorBatchPaintsImmediatePipsBeforeFirstRawSkinDraw() throws {
        let f=try Fixture();defer{f.dispose()};let original=f.scene.engine.state;var observed=false
        f.counter.onDraw={ [weak construction=f.construction,weak counter=f.counter] in
            guard counter?.count==104,let construction else{return};observed=true
            for opening in construction.recipe?.openings ?? [] {
                let node=construction.nodes[opening.tileID]
                XCTAssertFalse(node?.sourcePipNodes.isEmpty ?? true)
                XCTAssertTrue(node?.sourcePaintedNumbersTexture === construction.textures.texture("assets/tile.png",densityAware:false))
            }
        }
        f.service.deliver(wallMilliseconds:16)
        XCTAssertTrue(observed);XCTAssertEqual(f.counter.count,117);XCTAssertEqual(f.construction.pendingFaceCount,0)
        XCTAssertEqual(f.scene.engine.state,original);XCTAssertFalse(f.construction.constructorBatchPending)
        for node in f.construction.nodes.values where !node.locked {XCTAssertFalse(node.sourcePipNodes.isEmpty);XCTAssertEqual(node.sourceBaseScaleX,0.25,accuracy:1e-6)}
    }
    func testLiteralTrackedBatchCancellationLeavesRawFacesAndTheirRNG() throws {
        let f=try Fixture();defer{f.dispose()};f.construction.cancelTrackedConstructorBatch()
        XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,14)
        var beforeFirstSkin=false
        f.counter.onDraw={ [weak construction=f.construction,weak counter=f.counter] in
            if counter?.count==104 {beforeFirstSkin=true;XCTAssertTrue(construction?.nodes.values.allSatisfy{$0.sourcePipNodes.isEmpty} == true)}
        }
        f.service.deliver(wallMilliseconds:16)
        XCTAssertTrue(beforeFirstSkin);XCTAssertEqual(f.counter.count,117);XCTAssertEqual(f.construction.pendingFaceCount,0)
    }
    func testGlobalPauseStillDeliversActualInitialFacesWhileBackgroundKeepsThemQueued() throws {
        let f=try Fixture();defer{f.dispose()};f.scene.setSuspended(true);f.service.setSourceGlobalPaused(true);f.service.setSourceForeground(false)
        let original=f.scene.engine.state
        f.service.deliver(wallMilliseconds:1000);XCTAssertEqual(f.counter.count,103);XCTAssertEqual(f.construction.pendingFaceCount,14)
        f.service.setSourceForeground(true);f.service.deliver(wallMilliseconds:1016)
        XCTAssertEqual(f.counter.count,117);XCTAssertEqual(f.construction.pendingFaceCount,0);XCTAssertEqual(f.scene.engine.state,original)
    }
    func testNoDrawingBeforeAdoptionAndNoSyntheticRetryWhenRouteMissesReadiness() throws {
        let counter=Counter(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        let construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,random:{counter.next()}))
        let engine=NativeGameplayEngine(state:try XCTUnwrap(construction.recipe?.state))
        service.deliver(wallMilliseconds:16)
        XCTAssertFalse(construction.readyToAdopt);let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844));defer{scene.dispose()};XCTAssertFalse(construction.adopt(engine:engine,scene:scene));XCTAssertEqual(counter.count,103)
        XCTAssertTrue(construction.nodes.isEmpty);XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        service.deliver(wallMilliseconds:32);XCTAssertEqual(counter.count,103)
    }
    func testOldGenerationCallbackCannotPaintOrDrawAfterRestartAndScopeRetirementPreservesPaint() throws {
        let f=try Fixture();defer{f.dispose()};let id=try XCTUnwrap(f.construction.recipe?.openings.first?.tileID),node=try XCTUnwrap(f.scene.sourceNativeTileNode(id)),texture=node.sourcePaintedNumbersTexture
        f.scene.retireSourceAnimationBindings()
        XCTAssertTrue(node.sourceContactNodeAlive);XCTAssertNotNil(node.parent);XCTAssertTrue(node.sourcePaintedNumbersTexture === texture)
        f.service.deliver(wallMilliseconds:16);XCTAssertEqual(f.counter.count,103)
        f.scene.engine.restart(state:NativeBoardState(tiles:[.init(id:id,cell:.init(column:0,row:0),value:5)],generation:1))
        let newState=f.scene.engine.state;f.service.deliver(wallMilliseconds:32);XCTAssertEqual(f.scene.engine.state,newState);XCTAssertEqual(f.counter.count,103)
    }
    func testTabletAndTutorialActualOpeningCallbacksDoNotReuseHashedSkinOrRotation() throws {
        let f=try Fixture(columns:7,tutorial:true);defer{f.dispose()}
        XCTAssertEqual(f.counter.count,63);XCTAssertEqual(f.construction.pendingFaceCount,18)
        f.service.deliver(wallMilliseconds:16);XCTAssertEqual(f.counter.count,81)
        for opening in f.construction.recipe?.openings ?? [] {XCTAssertEqual(f.scene.sourceNativeTileNode(opening.tileID)?.value,opening.value)}
    }
    func testUnavailableAPPFrameCapabilityRefusesBeforeAnyRandomOrResourceConstruction() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0);defer{service.dispose()};var count=0
        XCTAssertNil(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,random:{count+=1;return 0.5}))
        XCTAssertEqual(count,0)
    }
}
