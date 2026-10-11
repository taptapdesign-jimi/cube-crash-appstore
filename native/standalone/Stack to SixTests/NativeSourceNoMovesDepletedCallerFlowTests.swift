import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceNoMovesDepletedCallerFlowTests:XCTestCase {
    struct Oracle:Decodable {let rows:[Row];struct Row:Decodable {let input:Input,trace:[String]};struct Input:Decodable {let mode:String,busy:Bool,cancelled:Bool,ensure:Bool,wild:Bool,tutorial:Bool,busyAfter:Bool,type:String}}
    @MainActor final class Fixture {
        let engine:NativeGameplayEngine
        let receipt:NativeSourceNoMovesCallerReceipt
        var trace:[String]=[],waits:[(Int,()->Void,()->Void)]=[],returns:[NativeSourceNoMovesDepletedCallerFlow.ReturnReason]=[]
        var reply:(()->Void)?
        var candidate:NativeNoMovesCandidateOwner.Plan?
        var flow:NativeSourceNoMovesDepletedCallerFlow!
        var invalid=false
        init(kind:NativeSourceNoMovesCallerReceipt.Kind)throws {
            let six=kind == .mergeMovesDepleted
            engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:six ? 3:1),.init(id:"d",cell:.init(column:1,row:0),value:six ? 3:1),.init(id:"other",cell:.init(column:2,row:0),value:six ? 5:1)],moves:1))
            engine.stagedOrdinaryMoves=true;engine.stagedOrdinaryAssignments=true;engine.stagedSourceNoMoves=true
            engine.sourceNoMovesCallerReceiptsEnabled=true;engine.sourceNoMovesCallerAdmission = .init(generation:engine.state.generation,kinds:[kind])
            let e=engine
            // Controlled Source checker result; this fixture is not publication
            // of unported physical/global marker capabilities in the product.
            engine.sourceNoMovesRuntimeAuthority = .init(isCurrent:{true},capture:{
                .init(state:e.state,tiles:Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,.init())}),wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:.init(.fail,reason:"controlled-original-branch"),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
            })
            XCTAssertTrue(engine.beginDrag(tileID:"s"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            let id:String
            if six {let p=try XCTUnwrap(engine.pendingOrdinarySix);id=p.id;XCTAssertTrue(engine.commitOrdinarySix(receiptID:id,generation:p.generation).accepted)}
            else {let p=try XCTUnwrap(engine.pendingOrdinaryStack);id=p.id;XCTAssertTrue(engine.finishOrdinaryStackAbsorb(receiptID:id,generation:p.generation).accepted);XCTAssertTrue(engine.commitOrdinaryPostcheck(receiptID:id,generation:p.generation).accepted)}
            receipt=try XCTUnwrap(engine.sourceNoMovesCaller(ownerID:id,generation:engine.state.generation,kind:kind))
        }
        func install(_ input:Oracle.Input) {
            flow=NativeSourceNoMovesDepletedCallerFlow(hooks:.init(current:{[weak self] r in self?.invalid==false && self?.engine.sourceNoMovesCallerIsCurrent(r)==true},busyEnding:{[weak self] in
                guard let self else{return nil};return self.trace.contains(where:{$0.hasPrefix("tutorial:")}) ? input.busyAfter:input.busy
            },wait:{[weak self] _,_,ms,elapsed,cancelled in
                guard let self else{return {}};if ms==100{self.trace.append("wait:100")};self.waits.append((ms,elapsed,cancelled));return {}
            },ensureTutorialSingleTile:{[weak self] _,done in self?.trace.append("ensure:moves_depleted_single_regular_tile");done(input.ensure)},fresh:{[weak self] request in
                self?.trace.append("fresh:\(request.moves):\(request.forceRefresh)");return NativeResolution(input.type=="stuck" ? .fail:input.type=="clean" ? .complete:.continue,reason:"controlled-original-"+input.type)
            },resetHint:{[weak self] in self?.trace.append("hint")},deferWild:{[weak self] reason in self?.trace.append("wild:"+reason);return input.wild},tutorialFinalChance:{[weak self] reason,done in self?.trace.append("tutorial:"+reason);done(input.tutorial)},cleanVisibility:{[weak self] in self?.trace.append("visibility");return (false,false)},clean:{[weak self] reason in self?.trace.append("clean:"+reason)},beginNoMoves:{[weak self] r,reply in
                guard let self else{return};let options=r.kind == .ordinaryMovesDepleted ? "{\"reason\":\"moves_depleted_stuck\"}":"{\"reason\":\"merge_moves_depleted_stuck\",\"resetHint\":false}"
                self.trace.append("noMoves:"+options);self.reply=reply
                if case .candidate(let p)=self.engine.beginSourceNoMovesFromCaller(r){XCTAssertEqual(p.waitMilliseconds,1500);self.candidate=p}
            },continueMergeSix:{[weak self] _ in self?.trace.append("continue-merge6")},returned:{[weak self] _,reason in self?.returns.append(reason)}))
        }
        func deliverOuterAndInner(cancelInner:Bool=false) {
            while !waits.isEmpty {let next=waits.removeFirst();if next.0==100 && cancelInner {next.2()}else{next.1()}}
        }
        func genuineRollbackReturn()throws {
            let p=try XCTUnwrap(candidate),callback=try XCTUnwrap(reply)
            engine.sourceNoMovesCallerCompletionBinding = .init(admissionID:receipt.admissionID,deliver:{_ in callback()})
            guard case .rollback=engine.deliverSourceNoMovesWait(plan:p,generation:receipt.generation,cancelled:true) else{return XCTFail("actual rollback")}
            XCTAssertEqual(flow.pendingCount,1)
            XCTAssertTrue(engine.finishSourceNoMovesCallerRollback(planToken:p.token,generation:receipt.generation))
        }
    }
    func testLiteralOriginal384CallerPathsAndPromiseAwaitUseGenuineCoreProvenance()throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SourceNoMovesGenuineCallersOracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url));XCTAssertEqual(oracle.rows.count,384)
        for (index,row) in oracle.rows.enumerated() {
            let f=try Fixture(kind:row.input.mode=="ordinary" ? .ordinaryMovesDepleted:.mergeMovesDepleted);f.install(row.input)
            XCTAssertTrue(f.flow.start(f.receipt));f.deliverOuterAndInner(cancelInner:row.input.cancelled)
            XCTAssertEqual(f.trace,row.trace,"literal Original row \(index)")
            if row.trace.contains(where:{$0.hasPrefix("noMoves:")}) {XCTAssertEqual(f.flow.pendingCount,1);XCTAssertTrue(f.returns.isEmpty);try f.genuineRollbackReturn();XCTAssertEqual(f.returns,[.noMovesRequested])}
            else {XCTAssertEqual(f.flow.pendingCount,0);XCTAssertEqual(f.returns.count,1)}
            XCTAssertFalse(f.flow.start(f.receipt))
            f.flow.dispose()
        }
    }
    func testCapturedCallerDisposalRejectsLateWallAndTutorialReplies()throws {
        let input=Oracle.Input(mode:"ordinary",busy:false,cancelled:false,ensure:false,wild:false,tutorial:false,busyAfter:false,type:"stuck")
        let f=try Fixture(kind:.ordinaryMovesDepleted);f.install(input);XCTAssertTrue(f.flow.start(f.receipt));let old=try XCTUnwrap(f.waits.first)
        f.flow.dispose();f.invalid=true;old.1();old.2();XCTAssertEqual(f.returns,[.retired]);XCTAssertTrue(f.trace.isEmpty);XCTAssertEqual(f.flow.pendingCount,0)
    }
    func testMissingFreshProducerReturnsUnsupportedWithoutCreatingCandidate()throws {
        let f=try Fixture(kind:.mergeMovesDepleted)
        f.flow=NativeSourceNoMovesDepletedCallerFlow(hooks:.init(current:{f.engine.sourceNoMovesCallerIsCurrent($0)},busyEnding:{false},wait:{_,_,_,_,_ in {}},ensureTutorialSingleTile:{_,done in done(false)},fresh:{_ in nil},resetHint:{XCTFail()},deferWild:{_ in XCTFail();return false},tutorialFinalChance:{_,_ in XCTFail()},cleanVisibility:{nil},clean:{_ in XCTFail()},beginNoMoves:{_,_ in XCTFail()},continueMergeSix:{_ in XCTFail()},returned:{_,reason in f.returns.append(reason)}))
        XCTAssertTrue(f.flow.start(f.receipt));XCTAssertEqual(f.returns,[.unsupported]);XCTAssertNil(f.engine.pendingSourceNoMoves)
    }
    func testRealAppWall400Then100ContinueWhileGlobalAnimationClockPaused()async throws {
        let f=try Fixture(kind:.ordinaryMovesDepleted),timeouts=NativeSourceAppTimeoutOwner(),finished=expectation(description:"real two app wall callbacks")
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.setSourceGlobalPaused(true) // no Scene/FPS delivery or substitute idle clock.
        f.flow=NativeSourceNoMovesDepletedCallerFlow(hooks:.init(current:{f.engine.sourceNoMovesCallerIsCurrent($0)},busyEnding:{false},wait:{key,gen,ms,elapsed,cancelled in
            f.trace.append("wall:\(ms)");let r=timeouts.schedule(sourceID:key,generation:gen,delayMilliseconds:ms,elapsed:elapsed,cancelled:cancelled);return{_ = timeouts.cancel(r)}
        },ensureTutorialSingleTile:{_,done in f.trace.append("ensure");done(false)},fresh:{_ in f.trace.append("fresh");return NativeResolution(.continue,reason:"controlled-original-playable")},resetHint:{XCTFail()},deferWild:{_ in XCTFail();return false},tutorialFinalChance:{_,_ in XCTFail()},cleanVisibility:{nil},clean:{_ in XCTFail()},beginNoMoves:{_,_ in XCTFail()},continueMergeSix:{_ in XCTFail()},returned:{_,reason in f.returns.append(reason);finished.fulfill()}))
        XCTAssertTrue(f.flow.start(f.receipt));XCTAssertEqual(f.trace,["wall:400"])
        await fulfillment(of:[finished],timeout:2)
        XCTAssertEqual(f.trace,["wall:400","wall:100","ensure","fresh"]);XCTAssertEqual(f.returns,[.continued]);XCTAssertEqual(timeouts.pendingCount,0)
        f.flow.dispose();timeouts.cancelAll();service.dispose()
    }
}
