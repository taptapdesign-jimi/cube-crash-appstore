import XCTest
@testable import StackToSixGameplay

final class NativeSourceWildEmergencyFallbackTests:XCTestCase {
    func testManualEmergencyFaceCommitsWithoutBouncePublicationOrDirectionDraw()throws {
        var draws=0,minimumReads=0,deniedEmergency=false
        var tiles:[NativeTile]=[
            .init(id:"star",cell:.init(column:0,row:0),value:6,starOrbitCount:3,archetype:.star),
            .init(id:"destination",cell:.init(column:1,row:0),value:2),
            .init(id:"other",cell:.init(column:4,row:8),value:3)
        ]
        for row in 1...3 {
            for column in 0..<5 {
                tiles.append(.init(id:"locked-\(column)-\(row)",cell:.init(column:column,row:row),value:0,locked:true))
            }
        }
        let e=NativeGameplayEngine(state:.init(tiles:tiles,board:8),sourceMathRandom:NativeSourceMathRandomStream(draw:{draws+=1;return 0.2}))
        e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
        e.sourceWildExtraFinalGuardsEnabled=true
        e.sourceWildCoroutineResume={_,_ in true}
        e.sourceWildCoroutineFinally={_,_ in true}
        e.sourceFinalMergePresenceAuthority = .init(isCurrent:{true},capture:{[weak e] in
            guard let e else{return nil}
            return .init(canonicalState:e.state,physicalTiles:e.state.tiles,runtime:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        e.sourceWildMinimumTileAuthority = .init(isCurrent:{true},capture:{[weak e] in
            guard let e else{return nil}
            minimumReads+=1
            var painted=e.state
            for index in painted.tiles.indices {painted.tiles[index].visible=false}
            guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:e.state,paintedState:painted) else{return nil}
            return .init(paint:paint,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        // The real emergencyLocked phase fails to open its candidate. Its
        // manual fallback must still assign a visible face, without spawnBounce.
        e.wildSpawnPermitAdmission={purpose in
            if purpose == .locked,minimumReads>0,!deniedEmergency {
                deniedEmergency=true;return false
            }
            return true
        }
        var faces:[NativeWildSpawnAction]=[],publishedActions:[String]=[],order:[String]=[]
        e.sourceWildPrimaryFaceCommit={action,_ in
            XCTAssertTrue(action.publishesBounce);order.append("face:\(action.id)");return true
        }
        e.sourceWildLockedFaceCommit={action,tile in
            XCTAssertFalse(tile.locked);XCTAssertGreaterThan(tile.value,0)
            faces.append(action);order.append("face:\(action.id)");return true
        }
        e.sourceWildSpawnBouncePublish={_,actionID in
            XCTAssertEqual(order.last,"face:\(actionID)","Face ownership precedes direction publication")
            publishedActions.append(actionID);order.append("bounce:\(actionID)");return true
        }
        XCTAssertTrue(e.beginDrag(tileID:"star"))
        XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(e.pendingDirectWild)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:plan.id).accepted)
        var manual:NativeWildSpawnAction?
        for _ in 0..<128 {
            if let action=e.pendingWildSpawnActions.first {
                let beforeDraws=draws,beforePublications=publishedActions.count
                let result=e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id)
                XCTAssertTrue(result.accepted)
                if !action.publishesBounce {
                    manual=action
                    XCTAssertEqual(action.kind,.locked);XCTAssertFalse(action.sourceLevelFlow)
                    XCTAssertEqual(action.delayMilliseconds,0)
                    XCTAssertEqual(faces.last,action)
                    XCTAssertEqual(draws-beforeDraws,1,"Only the authoritative face value draws entropy")
                    XCTAssertEqual(publishedActions.count,beforePublications)
                    XCTAssertFalse(e.pendingWildSpawnPresentations.contains{$0.tileID==action.tileID})
                    XCTAssertTrue(result.events.contains{$0.kind == .spawned && $0.reason==action.id})
                    break
                }
            } else if let arrival=e.pendingWildSpawnArrivals.first {
                XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
            } else {
                XCTAssertTrue(e.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
            }
        }
        let action=try XCTUnwrap(manual)
        XCTAssertTrue(deniedEmergency);XCTAssertGreaterThan(minimumReads,0)
        XCTAssertFalse(publishedActions.isEmpty,"Ordinary successful openings retain their bounce")
        XCTAssertTrue(faces.filter{$0.id != action.id}.allSatisfy(\.publishesBounce))
        let opened=try XCTUnwrap(e.state.tiles.first{$0.id==action.tileID})
        XCTAssertTrue(opened.visible);XCTAssertEqual(opened.alpha,1);XCTAssertFalse(opened.locked)
    }
}
