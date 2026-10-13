import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceVariantSheetLifecycleTests:XCTestCase {
    private let sheetIDs=["barell","mushroom","robo-cube","beach-ball"]
    @MainActor private final class Fixture {
        let service:NativeSourceAnimationClockService
        let construction:NativeSourceInitialBoardConstruction
        let scene:NativeBoardScene
        let registry=NativeSourceSpecialIdleRegistry()
        let scope:NativeSourceSpecialIdleScope
        init(tiles:[NativeTile])throws {
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            scope=NativeSourceSpecialIdleScope(registry:registry,current:{true})
            let state=NativeBoardState(tiles:tiles,generation:9)
            construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.makeRestored(root:NativeTestResources.root,service:service,saved:state,random:{0.5}))
            scene=NativeBoardScene(engine:NativeGameplayEngine(state:try XCTUnwrap(construction.recipe).state),resourceRoot:NativeTestResources.root,
                                  size:CGSize(width:390,height:844),sourceInitialConstruction:construction)
            scene.synchronize()
        }
        func dispose(){scene.dispose();scope.dispose();registry.dispose();construction.dispose();service.dispose()}
    }
    func testEveryRegistryVariantRestoresItsActualSourceConstructorAndReadyStaticFace()throws {
        let variants=NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}
        let tiles=variants.enumerated().map{index,variant in NativeTile(id:variant.id,cell:.init(column:index%5,row:index/5),value:6,archetype:variant.archetype,variant:variant.id)}
        let f=try Fixture(tiles:tiles);defer{f.dispose()}
        XCTAssertEqual(f.construction.nodes.count,13)
        let before=f.scene.engine.state
        f.service.deliver(wallMilliseconds:16)
        for variant in variants {
            let node=try XCTUnwrap(f.construction.nodes[variant.id])
            let definition=try XCTUnwrap(NativeDiceArtwork.sourceWildSkinDefinition(kind:variant.archetype.rawValue,variant:variant.id))
            XCTAssertTrue(node.sourceRestoredWildConstructorCurrent,variant.id)
            XCTAssertFalse(node.sourceRestoreWildFacePending,variant.id)
            XCTAssertTrue(node.sourcePaintedNumbersTexture === f.construction.textures.texture(definition.path,densityAware:false),variant.id)
            XCTAssertTrue(node.sourceIdleDeferred,variant.id)
            XCTAssertEqual(node.sourceIdleOwnerCount,0,variant.id)
            XCTAssertEqual(node.kind,variant.archetype.rawValue)
            XCTAssertEqual(node.variant,variant.id)
        }
        XCTAssertEqual(f.scene.engine.state,before)
    }
    func testRestoredVariantSheetsAdvanceAfterLandedAdmissionAndRespectLifecycle()async throws {
        let tiles=sheetIDs.enumerated().map{index,id in NativeTile(id:id,cell:.init(column:index,row:0),value:6,archetype:NativeSpecialDiceRegistry.variants[id]!.archetype,variant:id)}
        let f=try Fixture(tiles:tiles);defer{f.dispose()}
        f.service.deliver(wallMilliseconds:16)
        for id in sheetIDs {try await exerciseSheet(try XCTUnwrap(f.construction.nodes[id]),fixture:f)}
    }
    func testOpenedVariantSheetsRetainActualSelectedIdentityAndAnimateAfterRawFace()async throws {
        let tiles=sheetIDs.enumerated().map{index,id in NativeTile(id:id,cell:.init(column:index,row:0),value:0,locked:true)}
        let f=try Fixture(tiles:tiles);defer{f.dispose()}
        f.service.deliver(wallMilliseconds:16)
        for id in sheetIDs {
            let node=try XCTUnwrap(f.construction.nodes[id]),variant=try XCTUnwrap(NativeSpecialDiceRegistry.variants[id])
            node.setSourceIdleDeferred(true)
            XCTAssertTrue(node.openSourceWildCore(variant.archetype.rawValue,selectedVariant:id,service:f.service,current:{true},onCancelled:{}))
            XCTAssertTrue(node.applySourceOpenedWildVariant(id))
        }
        f.service.deliver(wallMilliseconds:32)
        for id in sheetIDs {
            let node=try XCTUnwrap(f.construction.nodes[id])
            XCTAssertTrue(node.sourceOpenedWildFaceCurrent,id)
            try await exerciseSheet(node,fixture:f)
        }
    }
    func testActualTypedSkinRepairKeepsRunningVariantSheetAboveItsStaticFace()async throws {
        let tiles=sheetIDs.enumerated().map{index,id in NativeTile(id:id,cell:.init(column:index,row:0),value:6,archetype:NativeSpecialDiceRegistry.variants[id]!.archetype,variant:id)}
        let f=try Fixture(tiles:tiles);defer{f.dispose()}
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        f.service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:f.service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
        let captured=f.scene
        let scope=try XCTUnwrap(context.beginScene(engine:f.scene.engine,retire:{[weak captured] in captured?.retireSourceAnimationBindings()}))
        defer{context.dispose();fifo.dispose()}
        f.scene.sourceOuterTimelineDriver=scope.timeline;f.scene.sourceDragTweenDriver=scope.tween
        XCTAssertTrue(f.scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
        f.scene.synchronize();f.service.deliver(wallMilliseconds:16)
        for id in sheetIDs {
            let node=try XCTUnwrap(f.construction.nodes[id])
            XCTAssertTrue(tasks.inputTask{XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:id,scope:scope,startSourceIdle:{XCTFail("Deferred idle must not start from static repair");return false}))})
            let deadline=CACurrentMediaTime()+5
            while !node.sourceWildSkinReceiptCurrent,CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(node.sourceWildSkinReceiptCurrent,id)
            try await exerciseSheet(node,fixture:f,repairPaint:{
                let artwork=node.visual.children.compactMap{$0 as? SKSpriteNode}.first{$0.zPosition==2}
                let texture=artwork?.texture,receipt=node.authoredArtworkReceipt
                XCTAssertTrue(node.repairSourceWildSkinPaint(generation:node.sourceGeneration,current:{scope.current}),id)
                XCTAssertEqual(artwork?.isHidden,false,id)
                XCTAssertTrue(artwork?.texture === texture,id)
                XCTAssertEqual(node.authoredArtworkReceipt.frame,receipt.frame,id)
                let base=node.visual.children.compactMap{$0 as? SKSpriteNode}.first{$0.zPosition==0}
                XCTAssertEqual(base?.isHidden,true,"Repair must not show static face over running sheet: \(id)")
            })
        }
    }
    func testActualRestoredFlowerContinuesPoseUnderPressureButHonorsPointerAndSceneSuspension()throws {
        let f=try Fixture(tiles:[NativeTile(id:"flower",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:"flower")])
        defer{f.dispose()}
        f.service.deliver(wallMilliseconds:16)
        let node=try XCTUnwrap(f.construction.nodes["flower"])
        node.isHidden=false;node.alpha=1
        XCTAssertTrue(node.configureSourceSpecialIdle(f.scope));node.setSourceIdleDeferred(false)
        let canvas=try XCTUnwrap(node.visual.children.first{$0.zPosition==2 && !($0 is SKSpriteNode)})
        let movingRoot=try XCTUnwrap(canvas.children.first)
        node.tick(0.1,suspended:false,viewportCenter:195)
        let first=movingRoot.position
        XCTAssertFalse(canvas.isHidden)
        let release=f.scope.acquire(reason:"flower-pressure")
        node.tick(0.2,suspended:false,viewportCenter:195)
        XCTAssertNotEqual(movingRoot.position,first,"The actual Flower SVG pose must continue under shared registry pressure")
        XCTAssertFalse(canvas.isHidden);XCTAssertTrue(node.hasAnimatedArtwork)
        let held=movingRoot.position,phase=node.authoredArtworkReceipt.elapsed
        node.tick(0.3,suspended:true,viewportCenter:195)
        XCTAssertEqual(movingRoot.position,held);XCTAssertEqual(node.authoredArtworkReceipt.elapsed,phase)
        node.setDragging(true);node.tick(0.1,suspended:false,viewportCenter:195)
        XCTAssertTrue(canvas.isHidden,"Actual pointer owns Flower visibility")
        node.setDragging(false);node.tick(0.1,suspended:false,viewportCenter:195)
        XCTAssertFalse(canvas.isHidden,"Registry pressure alone must not hide released Flower")
        release?();f.scope.retire(node)
        let retired=node.authoredArtworkReceipt.elapsed
        node.tick(1,suspended:false,viewportCenter:195)
        XCTAssertEqual(node.authoredArtworkReceipt.elapsed,retired);XCTAssertFalse(node.hasAnimatedArtwork)
    }
    private func exerciseSheet(_ node:NativeDiceNode,fixture f:Fixture,repairPaint:(()->Void)?=nil)async throws {
        let id=try XCTUnwrap(node.variant)
        let sheet=try XCTUnwrap(NativeDiceArtwork.sourceWildSkinDefinition(kind:node.kind,variant:id)?.idleSheet)
        node.isHidden=false;node.alpha=1
        XCTAssertTrue(node.configureSourceSpecialIdle(f.scope))
        node.setSourceIdleDeferred(false)
        let artwork=try XCTUnwrap(node.visual.children.compactMap{$0 as? SKSpriteNode}.first{$0.zPosition==2})
        let deadline=CACurrentMediaTime()+5
        while (artwork.texture==nil || artwork.isHidden),CACurrentMediaTime()<deadline {
            node.tick(0.02,suspended:false,viewportCenter:195)
            try await Task.sleep(for:.milliseconds(20))
        }
        XCTAssertNotNil(artwork.texture,"Actual selected atlas did not decode: \(id)")
        XCTAssertFalse(artwork.isHidden,id)
        XCTAssertTrue(node.hasAnimatedArtwork,id)
        XCTAssertEqual(artwork.size.width,sheet.cell.width*sheet.displayScale,accuracy:1e-3)
        node.tick(0.1,suspended:false,viewportCenter:195)
        let first=artwork.texture,firstFrame=node.authoredArtworkReceipt.frame
        node.tick(0.15,suspended:false,viewportCenter:195)
        XCTAssertNotEqual(node.authoredArtworkReceipt.frame,firstFrame,id)
        XCTAssertFalse(artwork.texture === first,id)
        let held=node.authoredArtworkReceipt
        node.tick(0.3,suspended:true,viewportCenter:195)
        XCTAssertEqual(node.authoredArtworkReceipt.elapsed,held.elapsed,id)
        let release=f.scope.acquire(reason:"variant-sheet-regression")
        node.tick(0.3,suspended:false,viewportCenter:195)
        XCTAssertGreaterThan(node.authoredArtworkReceipt.elapsed,held.elapsed,"Direct authored sheet continues under registry pressure: \(id)")
        XCTAssertTrue(node.hasAnimatedArtwork,id)
        XCTAssertFalse(artwork.isHidden,id)
        release?();node.setDragging(true)
        node.tick(0.1,suspended:false,viewportCenter:195)
        XCTAssertEqual(artwork.isHidden,!sheet.animateDuringDrag,id)
        node.setDragging(false);node.resumeIdleAfterLanding()
        node.tick(0.1,suspended:false,viewportCenter:195)
        XCTAssertFalse(artwork.isHidden,id)
        repairPaint?()
        f.scope.retire(node)
        let retired=node.authoredArtworkReceipt
        node.tick(1,suspended:false,viewportCenter:195)
        XCTAssertEqual(node.authoredArtworkReceipt.elapsed,retired.elapsed,id)
        XCTAssertFalse(node.hasAnimatedArtwork,id)
    }
}
