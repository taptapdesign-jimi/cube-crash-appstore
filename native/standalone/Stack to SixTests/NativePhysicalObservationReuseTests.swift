import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativePhysicalObservationReuseTests:XCTestCase {
    private func fixture(random:@escaping()->Double={0.1})throws -> (NativeBoardScene,NativeSourceInitialBoardConstruction,NativeSourceAnimationClockService,NativeSourceOuterTimelineAdapter) {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,columns:5,tutorialDemo:false,random:random))
        let state=try XCTUnwrap(construction.recipe?.state)
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844),sourceInitialConstruction:construction)
        let timeline=NativeSourceOuterTimelineAdapter(service:service)
        scene.sourceOuterTimelineDriver=timeline;scene.synchronize();service.deliver(wallMilliseconds:16)
        return (scene,construction,service,timeline)
    }
    func testActualFortyFiveTileCaptureReusesObserversAcrossRepeatedWholeBoardFences()throws {
        let (scene,construction,service,timeline)=try fixture()
        defer{scene.dispose();construction.dispose();timeline.dispose();service.dispose()}
        let canonical=scene.engine.state,board=try XCTUnwrap(scene.captureSourcePhysicalBoard())
        XCTAssertEqual(canonical.tiles.count,45)
        XCTAssertEqual(scene.sourcePhysicalObserverCreationCount,45)
        for _ in 0..<64 {XCTAssertTrue(board.isStillCurrent())}
        XCTAssertEqual(scene.sourcePhysicalObserverCreationCount,45,"Repeated reads retain the actual node/generation observer instead of allocating 45 observers per fence")
        XCTAssertEqual(scene.sourcePhysicalObserverCacheCount,45)
        XCTAssertEqual(scene.engine.state,canonical)
        let model=try XCTUnwrap(canonical.tiles.first),node=try XCTUnwrap(scene.sourceNativeTileNode(model.id))
        let alpha=node.alpha;node.alpha=0.37
        XCTAssertFalse(board.isStillCurrent(),"Reused observers must re-read actual physical fields")
        XCTAssertEqual(try XCTUnwrap(scene.sourcePhysicalTileObservation(model)).tile.alpha,0.37,accuracy:0.0001)
        node.alpha=alpha;XCTAssertTrue(board.isStillCurrent())
        XCTAssertEqual(scene.sourcePhysicalObserverCreationCount,45)
        node.removeFromParent();XCTAssertFalse(board.isStillCurrent())
        XCTAssertNil(scene.sourcePhysicalTileObservation(model),"Retained observer must still require its actual canvas parent")
        scene.dispose();XCTAssertEqual(scene.sourcePhysicalObserverCacheCount,0);XCTAssertFalse(board.isStillCurrent())
    }
    func testGenerationReplacementRetiresOldObserverAndReadsSameIdSuccessorOnly()throws {
        let (scene,construction,service,timeline)=try fixture()
        defer{scene.dispose();construction.dispose();timeline.dispose();service.dispose()}
        let original=try XCTUnwrap(scene.captureSourcePhysicalBoard()),oldModel=try XCTUnwrap(scene.engine.state.tiles.first)
        let oldNode=try XCTUnwrap(scene.sourceNativeTileNode(oldModel.id)),before=scene.sourcePhysicalObserverCreationCount
        let successor=NativeTile(id:oldModel.id,cell:oldModel.cell,value:0,locked:true)
        scene.engine.restart(state:.init(tiles:[successor],mode:.arcade,generation:2))
        XCTAssertFalse(original.isStillCurrent());XCTAssertNil(scene.sourcePhysicalTileObservation(successor))
        scene.synchronize()
        let newNode=try XCTUnwrap(scene.sourceNativeTileNode(successor.id))
        XCTAssertFalse(newNode === oldNode)
        XCTAssertTrue(newNode.prepareSourceInitialHolder(rotation:0,generation:2,cell:successor.cell))
        XCTAssertEqual(try XCTUnwrap(scene.sourcePhysicalTileObservation(successor)).tile.value,0)
        XCTAssertEqual(scene.sourcePhysicalObserverCreationCount,before+2,"An old-generation refusal and its actual new-node replacement each require an exact new observer")
        let current=try XCTUnwrap(scene.captureSourcePhysicalBoard());XCTAssertTrue(current.isStillCurrent())
        XCTAssertEqual(scene.sourcePhysicalObserverCacheCount,1);XCTAssertFalse(original.isStillCurrent())
    }
    func testActualOrdinaryIdleBatchChecksWholeBoardTwiceAndPreservesOrderedEligibilityWithoutRng()throws {
        var draws=0
        let (scene,construction,service,timeline)=try fixture(random:{draws+=1;return 0.1})
        defer{scene.dispose();construction.dispose();timeline.dispose();service.dispose()}
        for tile in scene.engine.state.tiles where !tile.locked && tile.value>0 {scene.sourceNativeTileNode(tile.id)?.isHidden=false}
        let board=try XCTUnwrap(scene.captureSourcePhysicalBoard()),before=draws
        var fences=0
        let counted=NativeBoardScene.SourcePhysicalBoardCapture(canonicalState:board.canonicalState,observedState:board.observedState,tiles:board.tiles,isStillCurrent:{fences+=1;return board.isStillCurrent()})
        let expected=board.observedState.tiles.filter{!$0.locked && $0.visible && $0.value>0}.map(\.id)
        XCTAssertFalse(expected.isEmpty)
        XCTAssertEqual(try XCTUnwrap(scene.captureSourceRegularIdleEligibleIDs(counted)),expected)
        XCTAssertEqual(fences,2,"The actual45-holder ordinary batch requires two complete roster checks rather than one per tile")
        XCTAssertEqual(draws,before);XCTAssertEqual(scene.engine.state,board.canonicalState)
        let id=try XCTUnwrap(expected.first),node=try XCTUnwrap(scene.sourceNativeTileNode(id))
        node.sourceEventMode="dynamic"
        let changed=try XCTUnwrap(scene.captureSourcePhysicalBoard())
        XCTAssertEqual(try XCTUnwrap(scene.captureSourceRegularIdleEligibleIDs(changed)),expected.filter{$0 != id})
        XCTAssertEqual(draws,before)
        scene.dispose();XCTAssertNil(scene.captureSourceRegularIdleEligibleIDs(counted))
    }
    func testExternalSpecialMarkerCallbackCannotMutateEarlierNodeOrFallbackWhenMissing()throws {
        let (scene,construction,service,timeline)=try fixture()
        defer{scene.dispose();construction.dispose();timeline.dispose();service.dispose()}
        let models=scene.engine.state.tiles
        let first=try XCTUnwrap(models.first),second=try XCTUnwrap(models.dropFirst().first)
        let firstNode=try XCTUnwrap(scene.sourceNativeTileNode(first.id)),secondNode=try XCTUnwrap(scene.sourceNativeTileNode(second.id))
        let retainedMarker=try XCTUnwrap(scene.captureSourceGameplayTileMarkers(second.id))
        secondNode.update(value:secondNode.value,kind:"wild",variant:nil,depth:1,locked:false)
        let board=try XCTUnwrap(scene.captureSourcePhysicalBoard())
        var calls:[String]=[]
        XCTAssertNil(scene.captureSourceRegularIdleEligibleIDs(board,externalMarkerReader:{id in
            calls.append(id)
            if id==second.id {firstNode.isHidden.toggle();return retainedMarker}
            return scene.captureSourceGameplayTileMarkers(id)
        }))
        XCTAssertEqual(calls,[first.id,second.id],"The full fence immediately following the Special callback catches its mutation of a previously read node")
        XCTAssertFalse(board.isStillCurrent())
        let fresh=try XCTUnwrap(scene.captureSourcePhysicalBoard())
        XCTAssertNil(scene.captureSourceRegularIdleEligibleIDs(fresh,externalMarkerReader:{_ in nil}),"An absent external marker has no constructor-field fallback")
        secondNode.update(value:6,kind:"wild",variant:nil,depth:1,locked:false)
        secondNode.sourceEventMode="static";secondNode.isHidden=false
        let special=try XCTUnwrap(scene.captureSourcePhysicalBoard())
        let provider:(String)->NativeSourceTileOwnerMarkers?={id in id==second.id ? retainedMarker:scene.captureSourceGameplayTileMarkers(id)}
        XCTAssertTrue(try XCTUnwrap(scene.captureSourceRegularIdleEligibleIDs(special,externalMarkerReader:provider)).contains(second.id),"Source valued Wild tiles remain eligible; do not blanket-exclude Special archetypes")
        secondNode.update(value:6,kind:"wild-juice",variant:"kanta",depth:1,locked:false)
        let kanta=try XCTUnwrap(scene.captureSourcePhysicalBoard())
        XCTAssertFalse(try XCTUnwrap(scene.captureSourceRegularIdleEligibleIDs(kanta,externalMarkerReader:provider)).contains(second.id),"Immutable v9 excludes the rigid Kanta idle family")
    }
    func testSynchronousFortyFiveTileMarkerScanUsesTwoPhysicalFencesAndPreservesOrder()throws {
        let (scene,construction,service,timeline)=try fixture()
        defer{scene.dispose();construction.dispose();timeline.dispose();service.dispose()}
        let board=try XCTUnwrap(scene.captureSourcePhysicalBoard());XCTAssertEqual(board.observedState.tiles.count,45)
        var fences=0,ids:[String]=[]
        let counted=NativeBoardScene.SourcePhysicalBoardCapture(canonicalState:board.canonicalState,observedState:board.observedState,tiles:board.tiles,isStillCurrent:{fences+=1;return board.isStillCurrent()})
        XCTAssertEqual(scene.scanSourceSynchronousPhysicalBoard(counted,current:{true},readsExternalOwner:{$0.isSpecial || $0.sourceResidualWildPresence},read:{model,node in
            XCTAssertEqual(node.tileID,model.id)
            guard scene.captureSourceGameplayTileMarkers(model.id) != nil else{return nil}
            ids.append(model.id);return false
        }),false)
        XCTAssertEqual(ids,board.observedState.tiles.map(\.id))
        XCTAssertEqual(fences,2,"45 ordinary rows require90 physical re-observations, not45×45")
        XCTAssertEqual(scene.engine.state,board.canonicalState)
    }
    func testSynchronousWildOwnerReadFencesDestructiveSiblingMutationsBeforeNextRow()throws {
        for mutation in 0..<3 {
            let (scene,construction,service,timeline)=try fixture()
            defer{scene.dispose();construction.dispose();timeline.dispose();service.dispose()}
            let models=scene.engine.state.tiles,first=try XCTUnwrap(models.first),second=try XCTUnwrap(models.dropFirst().first)
            let earlier=try XCTUnwrap(scene.sourceNativeTileNode(first.id)),wild=try XCTUnwrap(scene.sourceNativeTileNode(second.id))
            wild.update(value:6,kind:"wild",variant:nil,depth:1,locked:false)
            let board=try XCTUnwrap(scene.captureSourcePhysicalBoard());var calls:[String]=[]
            XCTAssertNil(scene.scanSourceSynchronousPhysicalBoard(board,current:{true},readsExternalOwner:{$0.isSpecial || $0.sourceResidualWildPresence},read:{model,_ in
                calls.append(model.id)
                if model.id==second.id {
                    switch mutation {
                    case 0:earlier.isHidden.toggle()
                    case 1:earlier.removeFromParent()
                    default:var fresh=scene.engine.state;fresh.generation+=1;scene.engine.restart(state:fresh)
                    }
                }
                return false
            }))
            XCTAssertEqual(calls,[first.id,second.id],"A Wild/carrier callback may not invalidate an earlier row and then continue")
        }
    }
    func testSynchronousExternalReadRetainsPositiveAdmissionAndOrderedEarlyReturn()throws {
        let (scene,construction,service,timeline)=try fixture()
        defer{scene.dispose();construction.dispose();timeline.dispose();service.dispose()}
        let board=try XCTUnwrap(scene.captureSourcePhysicalBoard()),first=try XCTUnwrap(board.observedState.tiles.first)
        var calls=0,fences=0
        let counted=NativeBoardScene.SourcePhysicalBoardCapture(canonicalState:board.canonicalState,observedState:board.observedState,tiles:board.tiles,isStillCurrent:{fences+=1;return board.isStillCurrent()})
        XCTAssertEqual(scene.scanSourceSynchronousPhysicalBoard(counted,current:{true},readsExternalOwner:{_ in true},read:{model,_ in
            calls+=1;XCTAssertEqual(model.id,first.id);return true
        }),true)
        XCTAssertEqual(calls,1,"Save cleanup/mutation short-circuit must not query later owners")
        XCTAssertEqual(fences,4,"Entry, both external-owner fences and final early-return fence remain real")
    }
}
