import XCTest
@testable import StackToSixGameplay

final class NativeSourceWildConstructorIntegrationTests:XCTestCase {
    func testHardConstructorPrecedesValueAndFaceThenCapturedDirectionPublication()throws {
        var trace:[String]=[]
        let math=NativeSourceMathRandomStream{trace.append("draw");return 0.2}
        let engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.juice),
            .init(id:"dst",cell:.init(column:1,row:0),value:5),
            .init(id:"other",cell:.init(column:4,row:8),value:2)],board:10),sourceMathRandom:math)
        engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
        var denied=0,hardID:String?
        engine.wildSpawnPermitAdmission={purpose in
            if purpose == .primary,denied<2{denied+=1;return false};return true
        }
        engine.sourceWildHardPrimaryConstruct={tile,generation in
            XCTAssertEqual(tile.value,0);XCTAssertTrue(tile.locked)
            XCTAssertTrue(engine.state.tiles.contains{$0.id==tile.id});XCTAssertEqual(generation,engine.state.generation)
            trace.append("hard-constructor");_=math.next();hardID=tile.id;return true
        }
        engine.sourceWildPrimaryFaceCommit={action,tile in
            if action.kind == .hardPrimary {trace.append("hard-face");XCTAssertEqual(tile.id,hardID);XCTAssertEqual(tile.value,1)}
            else {_=math.next()}
            return true
        }
        engine.sourceWildSpawnBouncePublish={presentation,_ in
            if presentation.tileID==hardID {trace.append("hard-bounce");XCTAssertEqual(presentation.direction,1)}
            return true
        }
        XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingDirectWild)
        XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
        for _ in 0..<20 {
            if let action=engine.pendingWildSpawnActions.first {
                XCTAssertTrue(engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
            } else if let arrival=engine.pendingWildSpawnArrivals.first {
                XCTAssertTrue(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
            } else {break}
            if trace.contains("hard-bounce"){break}
        }
        let start=try XCTUnwrap(trace.firstIndex(of:"hard-constructor"))
        XCTAssertEqual(Array(trace[start...].prefix(6)),["hard-constructor","draw","draw","hard-face","draw","hard-bounce"])
        XCTAssertEqual(engine.state.tiles.first{$0.id==hardID}?.value,1)
    }
    func testSourceFalsePrimaryDoesNotIssueRetryUntilCapturedFIFOResume()throws {
        let engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.juice),
            .init(id:"dst",cell:.init(column:1,row:0),value:5),
            .init(id:"other",cell:.init(column:4,row:8),value:2)],board:10),recordedRandomChoices:Array(repeating:0.2,count:200))
        engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
        engine.wildSpawnPermitAdmission={purpose in purpose != .primary}
        var scheduled:[(String,UInt64)]=[]
        engine.sourceWildCoroutineResume={scheduled.append(($0,$1));return true}
        XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingDirectWild)
        XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
        let first=try XCTUnwrap(engine.pendingWildSpawnActions.first)
        XCTAssertTrue(engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:first.id).accepted)
        XCTAssertEqual(scheduled.count,1);XCTAssertTrue(engine.pendingWildSpawnActions.isEmpty)
        XCTAssertTrue(engine.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        let retry=try XCTUnwrap(engine.pendingWildSpawnActions.first)
        XCTAssertNotEqual(first.id,retry.id);XCTAssertEqual(retry.kind,.primary)
        engine.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:3)]))
        let before=engine.state
        XCTAssertFalse(engine.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(engine.state,before)
    }
    func testBonusDirectionReentryCannotPublishIntoSuccessorGeneration()throws {
        var retireOnDirection=false,engine:NativeGameplayEngine!
        let math=NativeSourceMathRandomStream{
            if retireOnDirection {retireOnDirection=false;engine.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:3)]))}
            return 0.2
        }
        engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.juice),
            .init(id:"dst",cell:.init(column:1,row:0),value:5),
            .init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true),
            .init(id:"other",cell:.init(column:4,row:8),value:2)],board:10),sourceMathRandom:math)
        engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
        var constructors=0
        engine.sourceWildLockedBonusConstruct={_,_ in constructors+=1;retireOnDirection=true;return true}
        var pops=0;engine.sourceWildLockedBonusPop={_ in pops+=1;return true}
        XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingDirectWild)
        _=engine.commitDirectWildGameplay(transactionID:plan.id)
        XCTAssertEqual(constructors,1,"No next-cell constructor runs after RNG retires the captured generation")
        XCTAssertEqual(pops,0);XCTAssertEqual(engine.state.generation,plan.generation+1)
        XCTAssertEqual(engine.state.tiles.map(\.id),["successor"])
        XCTAssertTrue(engine.pendingWildLockedBonusPresentations.isEmpty)
    }
    func testSourceFinallyIsPublishedOnceAfterAllAwaitedSpawnPhasesAndRetiresOnRestart()throws {
        let engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.juice),
            .init(id:"dst",cell:.init(column:1,row:0),value:5),
            .init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true),
            .init(id:"other",cell:.init(column:4,row:8),value:2)],board:10),recordedRandomChoices:Array(repeating:0.2,count:200))
        engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
        var resumePending=false,finallys=0
        engine.sourceWildCoroutineResume={_,_ in resumePending=true;return true}
        engine.sourceWildCoroutineFinally={id,generation in
            finallys+=1
            XCTAssertTrue(engine.hasSettledSourceWildSpawnCoroutine(transactionID:id,generation:generation))
            XCTAssertTrue(engine.pendingWildSpawnArrivals.isEmpty)
            XCTAssertTrue(engine.pendingWildSpawnActions.isEmpty)
            return true
        }
        XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingDirectWild)
        XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
        XCTAssertEqual(finallys,0)
        var arrivals=0
        for _ in 0..<100 {
            if let action=engine.pendingWildSpawnActions.first {
                XCTAssertTrue(engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
            } else if let arrival=engine.pendingWildSpawnArrivals.first {
                arrivals+=1
                XCTAssertTrue(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
                if arrivals==1 {XCTAssertEqual(finallys,0,"Primary arrival does not run coroutine finally")}
            } else if resumePending {
                resumePending=false
                XCTAssertTrue(engine.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
            } else {break}
        }
        XCTAssertEqual(arrivals,1);XCTAssertEqual(finallys,1)
        XCTAssertTrue(engine.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertEqual(engine.pendingDirectWild?.id,plan.id,"Visual release still owns the pending Direct identity")
        XCTAssertTrue(engine.hasSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation),"Finally ownership must remain visible to the Scene cleanup caller")
        XCTAssertFalse(engine.canResumeSourceDirectWildCoroutine(transactionID:plan.id,generation:plan.generation),"A retained visual lease does not own another coroutine resume")
        let settled=engine.state
        XCTAssertFalse(engine.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(engine.state,settled);XCTAssertEqual(finallys,1)
        engine.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:3)]))
        XCTAssertFalse(engine.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertFalse(engine.hasSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
    }

    func testRejectedAwaitedArrivalRunsCapturedFinallyWithoutPrimaryAccounting()throws {
        let engine=makeAwaitedSourceEngine()
        var scheduled=0
        engine.sourceWildCoroutineFinally={id,generation in
            scheduled+=1
            XCTAssertTrue(engine.hasSettledSourceWildSpawnCoroutine(transactionID:id,generation:generation))
            XCTAssertTrue(engine.pendingWildSpawnArrivals.isEmpty)
            return true
        }
        let plan=try beginAwaitedSource(engine)
        let arrival=try XCTUnwrap(engine.pendingWildSpawnArrivals.first)
        XCTAssertTrue(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id,interrupted:true).accepted)
        XCTAssertEqual(scheduled,1)
        XCTAssertFalse(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id,interrupted:true).accepted)
        XCTAssertEqual(scheduled,1)
        XCTAssertEqual(engine.pendingDirectWild?.id,plan.id,"Rejected primary retains captured lifecycle abort authority")
        XCTAssertTrue(engine.hasSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
        XCTAssertFalse(engine.canResumeSourceDirectWildCoroutine(transactionID:plan.id,generation:plan.generation),"Cancelled primary keeps abort authority without admitting queued coroutine work")
    }
    func testReentrantFinallyCannotRetireReplacementGeneration()throws {
        let engine=makeAwaitedSourceEngine()
        engine.sourceWildCoroutineFinally={_,_ in
            engine.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:3)]))
            return true
        }
        let plan=try beginAwaitedSource(engine)
        let arrival=try XCTUnwrap(engine.pendingWildSpawnArrivals.first)
        XCTAssertFalse(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id,interrupted:true).accepted)
        XCTAssertEqual(engine.state.tiles.map(\.id),["successor"])
        XCTAssertEqual(engine.state.generation,plan.generation+1)
        XCTAssertNil(engine.pendingDirectWild)
        XCTAssertFalse(engine.hasSettledSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
    }
    func testQueuedDirectPrimaryReactionRetiresAfterInterruptedArrivalInJourneyAndArcade()throws {
        for mode in [NativeRunMode.journey,.arcade] {
            for archetype in [NativeWildArchetype.star,.juice] {
                let engine=NativeGameplayEngine(state:.init(tiles:[
                    .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:archetype),
                    .init(id:"dst",cell:.init(column:1,row:0),value:5),
                    .init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true),
                    .init(id:"other",cell:.init(column:4,row:8),value:2)],mode:mode,board:10),recordedRandomChoices:Array(repeating:0.2,count:400))
                engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
                var queued:[(String,UInt64)]=[],finallys=0
                engine.sourceWildCoroutineResume={queued.append(($0,$1));return true}
                engine.sourceWildCoroutineFinally={_,_ in finallys+=1;return true}
                XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
                let plan=try XCTUnwrap(engine.pendingDirectWild)
                XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
                for _ in 0..<20 where engine.pendingWildSpawnArrivals.isEmpty {
                    if let action=engine.pendingWildSpawnActions.first {
                        XCTAssertTrue(engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
                    } else if !queued.isEmpty {
                        let (id,g)=queued.removeFirst()
                        XCTAssertTrue(engine.resumeSourceWildSpawnCoroutine(transactionID:id,generation:g).accepted)
                    }
                }
                let arrival=try XCTUnwrap(engine.pendingWildSpawnArrivals.first)
                XCTAssertFalse(queued.isEmpty,"The actual primary assignment queues a coroutine reaction")
                XCTAssertTrue(engine.canResumeSourceDirectWildCoroutine(transactionID:plan.id,generation:plan.generation))
                XCTAssertTrue(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id,interrupted:true).accepted)
                let captured=engine.state
                XCTAssertEqual(finallys,1);XCTAssertEqual(engine.pendingDirectWild?.id,plan.id)
                var retired=0
                for (id,g) in queued {
                    if engine.canResumeSourceDirectWildCoroutine(transactionID:id,generation:g) {
                        XCTFail("A retained abort identity admitted a retired primary reaction: \(mode)/\(archetype)")
                    } else {retired+=1}
                }
                XCTAssertGreaterThan(retired,0)
                XCTAssertTrue(engine.hasSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
                XCTAssertEqual(engine.state,captured);XCTAssertEqual(finallys,1)
            }
        }
    }
    private func makeAwaitedSourceEngine()->NativeGameplayEngine {
        let engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.juice),
            .init(id:"dst",cell:.init(column:1,row:0),value:5),
            .init(id:"other",cell:.init(column:4,row:8),value:2)],board:10),recordedRandomChoices:Array(repeating:0.2,count:200))
        engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
        engine.sourceWildCoroutineResume={_,_ in true}
        return engine
    }
    private func beginAwaitedSource(_ engine:NativeGameplayEngine)throws->NativeDirectWildMovePlan {
        XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingDirectWild)
        XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
        if let action=engine.pendingWildSpawnActions.first {
            XCTAssertTrue(engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
        }
        return plan
    }

    func testDirectWildSpawnBeginIsGenuineAndPrecedesConstructorAndRNG()throws {
        let engine=makeAwaitedSourceEngine()
        var begins=0,constructed=0
        engine.sourceWildSpawnBegin={receipt in
            begins+=1
            XCTAssertTrue(engine.sourceWildSpawnBeginIsCurrent(receipt))
            XCTAssertTrue(engine.pendingWildSpawnActions.isEmpty)
            XCTAssertTrue(engine.pendingWildSpawnArrivals.isEmpty)
            XCTAssertTrue(engine.pendingWildLockedBonusPresentations.isEmpty)
            return true
        }
        engine.sourceWildPrimaryFaceCommit={_,_ in constructed+=1;XCTAssertEqual(begins,1);return true}
        let plan=try beginAwaitedSource(engine)
        XCTAssertEqual(begins,1);XCTAssertEqual(constructed,1)
        let receipt=try XCTUnwrap(engine.sourceWildSpawnBeginReceipt)
        XCTAssertEqual(receipt.ownerID,plan.id)
        engine.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:3)]))
        XCTAssertFalse(engine.sourceWildSpawnBeginIsCurrent(receipt));XCTAssertNil(engine.sourceWildSpawnBeginReceipt)
    }
    func testRefusedDirectSpawnOwnerCannotSelectOrConstructSpawns()throws {
        let engine=makeAwaitedSourceEngine()
        var begins=0
        engine.sourceWildSpawnBegin={receipt in begins+=1;XCTAssertTrue(engine.sourceWildSpawnBeginIsCurrent(receipt));return false}
        engine.sourceWildPrimaryFaceCommit={_,_ in XCTFail("Refused owner cannot construct primary");return true}
        XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingDirectWild)
        _=engine.commitDirectWildGameplay(transactionID:plan.id)
        XCTAssertEqual(begins,1)
        XCTAssertTrue(engine.pendingWildSpawnActions.isEmpty);XCTAssertTrue(engine.pendingWildSpawnArrivals.isEmpty)
        XCTAssertTrue(engine.pendingWildLockedBonusPresentations.isEmpty)
        XCTAssertEqual(engine.pendingDirectWild?.id,plan.id,"Captured owner is retained for explicit abort; no Raw fallback")
    }

    private func makeNormalMinimumEngine()->NativeGameplayEngine {
        let engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.juice),
            .init(id:"dst",cell:.init(column:1,row:0),value:5),
            .init(id:"other",cell:.init(column:4,row:8),value:2),
            .init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true)],board:10),recordedRandomChoices:Array(repeating:0.2,count:200))
        engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
        engine.sourceWildCoroutineResume={_,_ in true}
        return engine
    }
    private func driveMinimum(_ engine:NativeGameplayEngine,plan:NativeDirectWildMovePlan,captured:()->Bool)throws->NativeMoveResult {
        for _ in 0..<100 {
            let result:NativeMoveResult
            if let action=engine.pendingWildSpawnActions.first {
                result=engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id)
            } else if let arrival=engine.pendingWildSpawnArrivals.first {
                result=engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id)
            } else {
                result=engine.resumeSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation)
            }
            if captured(){return result}
            XCTAssertTrue(result.accepted)
        }
        throw NSError(domain:"WildMinimumCaptureNotReached",code:1)
    }
    func testWildMinimumUsesPaintedTilePredicateAndCreatesActualRescueWithoutGlobalAuthority()throws {
        let engine=makeNormalMinimumEngine();var captures=0,canonicalActive=0
        engine.sourceWildMinimumTileAuthority = .init(isCurrent:{true},capture:{
            captures+=1;let canonical=engine.state;canonicalActive=canonical.tiles.filter(\.isActive).count
            var painted=canonical
            for i in painted.tiles.indices where painted.tiles[i].id != "other" {painted.tiles[i].visible=false}
            guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:canonical,paintedState:painted) else{return nil}
            return .init(paint:paint,tiles:Dictionary(uniqueKeysWithValues:canonical.tiles.map{($0.id,NativeNoMovesTileRuntime())}))
        })
        let plan=try beginAwaitedSource(engine),result=try driveMinimum(engine,plan:plan,captured:{captures>0})
        XCTAssertTrue(result.accepted);XCTAssertGreaterThan(canonicalActive,1);XCTAssertEqual(captures,1)
        XCTAssertEqual(engine.pendingWildSpawnActions.first?.kind,.locked,"Painted count1 requires real rescue; canonical count must not skip it")
        XCTAssertNil(engine.sourceNoMovesRuntimeAuthority)
    }
    func testWildMissingMinimumCaptureRefusesWithoutInventingZeroOrFinishingOwner()throws {
        let engine=makeNormalMinimumEngine();var captures=0
        engine.sourceWildMinimumTileAuthority = .init(isCurrent:{true},capture:{captures+=1;return nil})
        let plan=try beginAwaitedSource(engine),result=try driveMinimum(engine,plan:plan,captured:{captures>0})
        XCTAssertFalse(result.accepted);XCTAssertTrue(result.events.contains{$0.reason=="source_wild_minimum_capture_missing"})
        XCTAssertEqual(engine.pendingDirectWild?.id,plan.id);XCTAssertTrue(engine.pendingWildSpawnActions.isEmpty)
        XCTAssertTrue(engine.hasSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
    }
    func testWildMinimumCaptureReentryCannotMutateReplacementGraph()throws {
        let engine=makeNormalMinimumEngine();var captures=0
        engine.sourceWildMinimumTileAuthority = .init(isCurrent:{true},capture:{
            captures+=1;engine.restart(state:.init(tiles:[.init(id:"successor",cell:.init(column:0,row:0),value:3)]));return nil
        })
        let plan=try beginAwaitedSource(engine),result=try driveMinimum(engine,plan:plan,captured:{captures>0})
        XCTAssertFalse(result.accepted);XCTAssertEqual(engine.state.tiles.map(\.id),["successor"])
        XCTAssertNil(engine.pendingDirectWild);XCTAssertTrue(engine.pendingWildSpawnActions.isEmpty)
        XCTAssertFalse(engine.hasSourceWildSpawnCoroutine(transactionID:plan.id,generation:plan.generation))
    }

}
