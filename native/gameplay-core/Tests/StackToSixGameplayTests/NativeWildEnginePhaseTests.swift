import XCTest
@testable import StackToSixGameplay
final class NativeWildEnginePhaseTests:XCTestCase {
    private func make(_ archetype:NativeWildArchetype,locked:Int,orbit:Int=1,mode:NativeRunMode = .journey)->NativeGameplayEngine {
        var tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:6,starOrbitCount:orbit,archetype:archetype),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"survivor",cell:.init(column:4,row:8),value:2)]
        tiles += (0..<locked).map{NativeTile(id:"locked\($0)",cell:.init(column:$0%5,row:1+$0/5),value:0,locked:true,alpha:0.2)}
        let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,mode:mode,board:10),recordedRandomChoices:Array(repeating:0.2,count:2000))
        e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
        XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        return e
    }
    func testLiveEngineCallbacksMatchSixteenOriginalSourceCoroutinesIncludingCapturedBonusPools()throws {
        let rows=try JSONDecoder().decode([NativeWildSpawnPhaseTests.Row].self,from:NativeWildSpawnPhaseOracle.data)
        var capturedInputs:[[String:Any]]=[]
        for mode in [NativeRunMode.journey,.arcade] {for kind in [NativeWildArchetype.star,.juice] {for count in [0,1] {for orbit in [1,3] {
            let e=make(kind,locked:count,orbit:orbit,mode:mode),p=try XCTUnwrap(e.pendingDirectWild)
            XCTAssertEqual(e.state.moves,50)
            let first=e.commitDirectWildGameplay(transactionID:p.id);XCTAssertTrue(first.accepted)
            XCTAssertEqual(e.state.moves,49);XCTAssertFalse(e.beginDrag(tileID:"survivor"))
            let pool=e.state.tiles.filter(\.locked).count
            let sourceMode=mode == .arcade ? "arcade":count==0 ? "endgame":"normal"
            let tag="\(sourceMode):\(kind.rawValue):\(count):\(orbit)"
            capturedInputs.append(["inputTag":tag,"mode":sourceMode,"archetype":kind == .star ? "star":"juice","lockedCount":pool,"multiplier":2,"orbitCount":orbit,"lockedCells":e.state.tiles.filter(\.locked).map{["c":$0.cell.column,"r":$0.cell.row]}])
            let row=try XCTUnwrap(rows.first{$0.inputTag==tag})
            var now=80,sequence=0,assignments=first.events.filter{$0.kind == .spawned && ($0.value ?? 0)>0}.map{_ in 80}
            var scheduled:Set<String>=[],timers:[(at:Int,id:Int,fn:()->Void)]=[]
            func schedule(_ delay:Int,_ fn:@escaping()->Void){sequence+=1;timers.append((now+delay,sequence,fn))}
            func pump(){
                for action in e.pendingWildSpawnActions where scheduled.insert(action.id).inserted {
                    schedule(action.delayMilliseconds){let result=e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:action.id);XCTAssertTrue(result.accepted);assignments += result.events.filter{$0.kind == .spawned && ($0.value ?? 0)>0}.map{_ in now};pump()}
                }
                for arrival in e.pendingWildSpawnArrivals where scheduled.insert("arrival:"+arrival.id).inserted {
                    schedule(560){XCTAssertTrue(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id).accepted);pump()}
                }
            }
            pump();var callbacks=0
            while !timers.isEmpty {timers.sort{$0.at != $1.at ? $0.at<$1.at:$0.id<$1.id};let t=timers.removeFirst();now=t.at;t.fn();callbacks+=1;XCTAssertLessThan(callbacks,100)}
            XCTAssertEqual(assignments,row.trace.filter{$0.kind=="assignment"}.map(\.at),"\(sourceMode)/\(kind)/\(count)/\(orbit)")
            XCTAssertEqual(e.state.tiles.filter(\.locked).count,row.tiles.filter(\.locked).count)
            XCTAssertEqual(e.state.tiles.filter(\.isActive).count,row.tiles.filter{!$0.locked}.count)
            XCTAssertTrue(e.beginDrag(tileID:"survivor"));e.cancelDrag()
            XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
            XCTAssertTrue(e.releaseDirectWildPresentation(transactionID:p.id,generation:p.generation).accepted)
            XCTAssertNil(e.pendingDirectWild);XCTAssertTrue(e.state.validationIssues().isEmpty)
        }}}}
        try JSONSerialization.data(withJSONObject:capturedInputs).write(to:URL(fileURLWithPath:"/tmp/NativeWildCapturedPools.json"))
    }
    func testPrimaryActualArrivalReleasesOnlyOrdinaryInputAndNewEpochRejectsRemainingLockedFaces()throws {
        let e=make(.star,locked:1,orbit:3),p=try XCTUnwrap(e.pendingDirectWild)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted)
        let arrival=try XCTUnwrap(e.pendingWildSpawnArrivals.first);XCTAssertFalse(e.beginDrag(tileID:arrival.tileID))
        XCTAssertTrue(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id).accepted)
        XCTAssertFalse(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id).accepted)
        XCTAssertTrue(e.beginDrag(tileID:arrival.tileID));XCTAssertTrue(e.drop(target:.init(column:4,row:8)).accepted)
        let accepted=e.state,moves=e.state.moves
        while let action=e.pendingWildSpawnActions.first {XCTAssertTrue(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:action.id).accepted)}
        XCTAssertEqual(e.state,accepted);XCTAssertEqual(e.state.moves,moves)
        XCTAssertTrue(e.releaseDirectWildPresentation(transactionID:p.id,generation:p.generation).accepted)
    }
    func testBackgroundDrainsCurrentWildReceiptsOnceAndRestartRevokesEveryOldAction()throws {
        for kind in [NativeWildArchetype.star,.juice] {for count in [0,1] {
            let e=make(kind,locked:count,orbit:3),p=try XCTUnwrap(e.pendingDirectWild)
            e.cancelForBackground();let saved=e.state
            XCTAssertNil(e.pendingDirectWild);XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
            XCTAssertEqual(saved.moves,49);XCTAssertTrue(saved.validationIssues().isEmpty)
            e.cancelForBackground();XCTAssertEqual(e.state,saved)
            XCTAssertEqual(try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(saved)),saved)
            e.restart(state:NativeBoardState(tiles:[]));let fresh=e.state
            XCTAssertFalse(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:"old").accepted)
            XCTAssertFalse(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:"old").accepted);XCTAssertEqual(e.state,fresh)
        }}
    }
    struct Callsite:Decodable {
        struct Event:Decodable {let at:Int;let kind:String;let c,r:Int?;let value:Int?}
        let mode,archetype:String;let lockedCount,multiplier,orbitCount:Int;let trace:[Event]
    }
    func testEightExecutedOriginalMainCallsitesMatchPrimaryBeforeBonusAndVirtualPlaceholderMultiplier()throws {
        let rows=try JSONDecoder().decode([Callsite].self,from:NativeWildCallsiteOracle.data);XCTAssertEqual(rows.count,8)
        for row in rows {
            let e=make(row.archetype=="star" ? .star:.juice,locked:row.lockedCount,orbit:row.orbitCount),p=try XCTUnwrap(e.pendingDirectWild)
            let result=e.commitDirectWildGameplay(transactionID:p.id);XCTAssertTrue(result.accepted)
            XCTAssertEqual(row.multiplier,2)
            let bonusCells=e.pendingWildLockedBonusPresentations.map{receipt in e.state.tiles.first{$0.id==receipt.tileID}!.cell}
            let originalBonusCells=row.trace.filter{$0.at==80 && $0.kind=="logical-create" && !($0.c==1 && $0.r==0)}.map{NativeCell(column:$0.c!,row:$0.r!)}
            XCTAssertEqual(bonusCells,originalBonusCells)
            let firstActive=try XCTUnwrap(row.trace.first{$0.kind=="assignment"})
            if row.mode=="normal" {
                XCTAssertEqual(firstActive.at,80);XCTAssertNotNil(e.pendingWildSpawnArrivals.first)
                let originalFirst=row.trace.first{$0.kind=="logical-create" && !($0.c==1 && $0.r==0)}!
                XCTAssertTrue(row.trace.firstIndex{$0.kind=="assignment"}! < row.trace.firstIndex{$0.at==originalFirst.at && $0.c==originalFirst.c && $0.r==originalFirst.r}!)
            } else {
                XCTAssertEqual(firstActive.at,130);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
                XCTAssertEqual(e.pendingWildSpawnActions.first?.delayMilliseconds,50)
            }
        }
    }

    func testEarnedMeterCannotSpawnOverCapturedWildOwnershipAndVisualReleaseIsOnce()throws {
        let tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:6,archetype:.star),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"survivor",cell:.init(column:4,row:8),value:2)]
        let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,mode:.arcade,board:10,wildMeter:0.9),recordedRandomChoices:Array(repeating:0.2,count:100),rewardPicker:{_,_ in NativeWildRewardChoice(.star)})
        e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
        XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let p=try XCTUnwrap(e.pendingDirectWild);XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted)
        XCTAssertGreaterThan(e.state.wildMeter,1);XCTAssertFalse(e.claimMeterReward().accepted);XCTAssertNil(e.beginNoMovesConfirmation())
        XCTAssertTrue(e.releaseDirectWildPresentation(transactionID:p.id,generation:p.generation).accepted)
        XCTAssertFalse(e.releaseDirectWildPresentation(transactionID:p.id,generation:p.generation).accepted)
        XCTAssertFalse(e.beginDrag(tileID:"survivor"));XCTAssertFalse(e.claimMeterReward().accepted)
        let action=try XCTUnwrap(e.pendingWildSpawnActions.first);XCTAssertTrue(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:action.id).accepted)
        let arrival=try XCTUnwrap(e.pendingWildSpawnArrivals.first);XCTAssertTrue(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id).accepted)
        XCTAssertNil(e.pendingDirectWild);let moves=e.state.moves,surplus=e.state.wildMeter-1
        XCTAssertTrue(e.claimMeterReward().accepted);XCTAssertEqual(e.state.moves,moves);XCTAssertEqual(e.state.wildMeter,surplus,accuracy:0.000001)
        XCTAssertEqual(e.state.tiles.filter(\.isWild).count,1);XCTAssertFalse(e.claimMeterReward().accepted)
    }
    func testValidExtraPrimaryInterruptionRetiresRemainingCoroutineWithoutInventingAnotherSpawn()throws {
        let e=make(.juice,locked:0),p=try XCTUnwrap(e.pendingDirectWild)
        XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted)
        let first=try XCTUnwrap(e.pendingWildSpawnActions.first);XCTAssertTrue(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:first.id).accepted)
        let primary=try XCTUnwrap(e.pendingWildSpawnArrivals.first);XCTAssertTrue(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:primary.id).accepted)
        let extra=try XCTUnwrap(e.pendingWildSpawnActions.first);XCTAssertTrue(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:extra.id).accepted)
        let arrival=try XCTUnwrap(e.pendingWildSpawnArrivals.first);XCTAssertTrue(e.beginDrag(tileID:arrival.tileID));e.cancelDrag()
        let before=e.state
        XCTAssertTrue(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id,interrupted:true).accepted)
        XCTAssertEqual(e.state,before);XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
        XCTAssertFalse(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id).accepted)
        XCTAssertTrue(e.releaseDirectWildPresentation(transactionID:p.id,generation:p.generation).accepted)
        XCTAssertNil(e.pendingDirectWild)
    }

    struct CancellationRow:Decodable {
        struct Event:Decodable {let kind:String;let ordinaryAllowed:Bool?;let accepted:Bool?}
        let mode:String;let interruptAt:Int;let trace:[Event]
    }
    func testFirstPrimaryInterruptionMatchesOriginalFailedAccountingAndOwnedBackgroundAbort()throws {
        let rows=try JSONDecoder().decode([CancellationRow].self,from:NativeWildCancellationOracle.data)
        XCTAssertEqual(rows.count,4)
        for count in [0,1] {
            let source=try XCTUnwrap(rows.first{$0.interruptAt==1 && $0.mode==(count==0 ? "endgame":"normal")})
            XCTAssertEqual(source.trace.first{$0.kind=="settled-guard"}?.ordinaryAllowed,false)
            XCTAssertEqual(source.trace.first{$0.kind=="abort-recovery-result"}?.accepted,true)
            let e=make(.juice,locked:count),p=try XCTUnwrap(e.pendingDirectWild)
            XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted)
            if let action=e.pendingWildSpawnActions.first {XCTAssertTrue(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:action.id).accepted)}
            let arrival=try XCTUnwrap(e.pendingWildSpawnArrivals.first),captured=e.state
            XCTAssertTrue(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id,interrupted:true).accepted)
            XCTAssertEqual(e.state,captured);XCTAssertFalse(e.beginDrag(tileID:arrival.tileID))
            XCTAssertFalse(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id).accepted)
            XCTAssertTrue(e.releaseDirectWildPresentation(transactionID:p.id,generation:p.generation).accepted)
            XCTAssertNotNil(e.pendingDirectWild);XCTAssertFalse(e.beginDrag(tileID:"survivor"))
            e.cancelForBackground();XCTAssertNil(e.pendingDirectWild);XCTAssertEqual(e.state.tiles,captured.tiles)
            XCTAssertEqual(e.state.moves,captured.moves) // Earned HUD arrivals settle separately during background flush.
            XCTAssertTrue(e.beginDrag(tileID:arrival.tileID));e.cancelDrag()
            let saved=e.state;e.cancelForBackground();XCTAssertEqual(e.state,saved)
        }
    }

    struct MeterLeaseRow:Decodable {
        struct Permission:Decodable {let action:String}
        let archetype:String;let activeReceipt,activeContinuation,wildAllowed:Bool;let permission:Permission
    }
    func testSettledLogicalWildOwnerAllowsEarnedMeterWhileOriginalVisualWildInputLeaseRemains()throws {
        let rows=try JSONDecoder().decode([MeterLeaseRow].self,from:NativeWildMeterLeaseOracle.data);XCTAssertEqual(rows.count,8)
        for kind in [NativeWildArchetype.star,.juice] {
            let source=try XCTUnwrap(rows.first{$0.archetype==(kind == .star ? "star":"juice") && !$0.activeReceipt && !$0.activeContinuation})
            XCTAssertEqual(source.permission.action,"allow");XCTAssertFalse(source.wildAllowed)
            let tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:6,archetype:kind),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"survivor",cell:.init(column:4,row:8),value:2)]
            let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,mode:kind == .star ? .arcade:.journey,board:10,wildMeter:0.9),recordedRandomChoices:Array(repeating:0.2,count:200),rewardPicker:{_,_ in NativeWildRewardChoice(.star)})
            e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
            XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
            let p=try XCTUnwrap(e.pendingDirectWild);XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted)
            var callbacks=0
            while callbacks<20 && (!e.pendingWildSpawnActions.isEmpty || !e.pendingWildSpawnArrivals.isEmpty) {
                callbacks+=1
                if let action=e.pendingWildSpawnActions.first {XCTAssertTrue(e.commitWildSpawnAction(transactionID:p.id,generation:p.generation,actionID:action.id).accepted)}
                else if let arrival=e.pendingWildSpawnArrivals.first {XCTAssertTrue(e.finishWildSpawnArrival(transactionID:p.id,generation:p.generation,arrivalID:arrival.id).accepted)}
            }
            XCTAssertLessThan(callbacks,20);XCTAssertTrue(e.pendingWildSpawnActions.isEmpty);XCTAssertTrue(e.pendingWildSpawnArrivals.isEmpty)
            XCTAssertNotNil(e.pendingDirectWild);let moves=e.state.moves
            XCTAssertTrue(e.claimMeterReward().accepted);XCTAssertEqual(e.state.moves,moves)
            let reward=try XCTUnwrap(e.state.tiles.first(where: \.isWild))
            XCTAssertFalse(e.beginDrag(tileID:reward.id));XCTAssertTrue(e.beginDrag(tileID:"survivor"));e.cancelDrag()
            XCTAssertTrue(e.releaseDirectWildPresentation(transactionID:p.id,generation:p.generation).accepted)
            XCTAssertTrue(e.beginDrag(tileID:reward.id));e.cancelDrag()
            XCTAssertFalse(e.claimMeterReward().accepted)
        }
    }

}
