import XCTest
@testable import StackToSixGameplay
final class NativeSourceNoMovesAuthorityTests:XCTestCase {
    typealias Snapshot=NativeSourceNoMovesRuntimeSnapshot
    typealias Authority=NativeSourceNoMovesRuntimeAuthority
    func engine()->NativeGameplayEngine {let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4)]));e.stagedSourceNoMoves=true;return e}
    func snapshot(_ e:NativeGameplayEngine,transaction:Bool=false,capabilities:Set<Snapshot.Capability>=Set(Snapshot.Capability.allCases))->Snapshot {
        let rows=Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeNoMovesTileRuntime())})
        return .init(state:e.state,tiles:rows,wildContinuationPending:false,gameplayTransactionActive:transaction,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:NativeSourceEndgameChecker.check(state:e.state,runtime:rows),capabilities:capabilities)
    }
    struct Oracle:Decodable {struct Row:Decodable {struct Input:Decodable {let wild,spawn,special,handoff,dragging,endguard,changed:Bool;let fresh:String};let input:Input,reason:String?,trace:[String]};struct Caller:Decodable{let reason:String,wait:Int,reset:Bool,exit:Int?,persist:Bool};let rows:[Row],callers:[Caller]}
    func oracle()throws->Oracle {try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:Bundle.module.url(forResource:"SourceNoMovesAuthorityOracle",withExtension:"json")!))}
    func test384LiteralOriginalGuardsAndSingleOrderedPhysicalCapture()throws {
        for row in try oracle().rows {
            let e=engine(),v=row.input;var trace:[String]=[],calls=0
            let kind:NativeResolution.Kind=v.fresh=="stuck" ? .fail:v.fresh=="clean" ? .complete:.continue
            let h=Authority.OrderedCaptureHooks(current:{true},livingDrag:{trace.append("drag");return v.dragging},endgameGuard:{trace.append("endguard");return v.endguard},physical:{calls+=1;trace.append("roster");return .init(state:e.state,tiles:["a":.init()],nonFinalMergeSixGuardActive:false)},fresh:{_,_ in trace.append("signature");trace.append("fresh");return .init(kind,reason:"original-fixture")},wildContinuation:{trace.append("wild");return v.wild},spawningOrPulling:{v.spawn},specialActive:{trace.append("special");return v.special},regularHandoff:{trace.append("handoff");return v.handoff},capabilities:Set(Snapshot.Capability.allCases))
            let captured=try XCTUnwrap(Authority.captureSourceOrdered(h))
            XCTAssertEqual(trace,row.trace);XCTAssertEqual(calls,1)
            var g=NativeNoMovesCandidateOwner.Guard(initialSignature:v.changed ? "prior":captured.signature.key,currentSignature:captured.signature.key)
            g.freshEndgameType=v.fresh;g.wildContinuation=captured.wildContinuationPending;g.gameplayTransaction=captured.gameplayTransactionActive;g.activeDrag=captured.livingDragActive;g.endgameGuard=captured.endgameGuardActive
            XCTAssertEqual(g.blockReason,row.reason)
        }
    }
    func testAllNineLiteralCallerOptionsRetainExistingTypedTriggers()throws {
        for (caller,trigger) in zip(try oracle().callers,NativeNoMovesCandidateOwner.Trigger.allCases) {
            XCTAssertEqual(trigger.rawValue,caller.reason);XCTAssertEqual(trigger.waitMilliseconds,caller.wait);XCTAssertEqual(trigger.resetHint,caller.reset);XCTAssertEqual(trigger.exitTimeoutMilliseconds,caller.exit);XCTAssertEqual(trigger.persistStuckState,caller.persist)
        }
    }
    func testNilAuthorityKeepsConservativePendingOwnerAndRawNeverReadsInjectedAuthority() {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:2),.init(id:"d",cell:.init(column:1,row:0),value:3)]));e.stagedOrdinaryMoves=true;e.stagedSourceNoMoves=true
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("gameplay-transaction-active"));XCTAssertNotNil(e.pendingOrdinaryStack)
        let raw=engine();raw.stagedSourceNoMoves=false;var count=0;raw.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{true},capture:{count+=1;return self.snapshot(raw)})
        XCTAssertEqual(raw.beginSourceNoMoves(origin:.levelEnd),.ignored);XCTAssertEqual(count,0)
    }
    func testExplicitCompleteRuntimeFixtureCanReplaceShortcutWithoutSettlingNativeOwner() {
        let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:2),.init(id:"d",cell:.init(column:1,row:0),value:3)]));e.stagedOrdinaryMoves=true;e.stagedSourceNoMoves=true
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        var count=0;e.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{true},capture:{count+=1;return self.snapshot(e)})
        // The physical Source snapshot still contains captured source (pending removal)
        // and destination5. Authority does not force finish/cancel/remove/reward.
        guard case .candidate=e.beginSourceNoMoves(origin:.levelEnd) else{return XCTFail()}
        XCTAssertEqual(count,1);XCTAssertNotNil(e.pendingOrdinaryStack);XCTAssertEqual(e.state.moves,50)
    }
    func testMissingCapabilityStaleGenerationAndPhysicalMismatchRefuseFreshCheck() {
        for change in 0..<3 {let e=engine();e.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{true},capture:{
            let s=self.snapshot(e,capabilities:change==0 ? [.physicalRoster]:Set(Snapshot.Capability.allCases));var state=s.state
            if change==1 {state.generation+=1};if change==2 {state.tiles[0].stackDepth+=1}
            return .init(state:state,tiles:s.tiles,wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:s.freshResult,capabilities:s.capabilities)
        });XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-check-error"));XCTAssertNil(e.pendingSourceNoMoves)}
    }
    func testGenuinePaintReceiptUsesSourceAlphaWithoutMutatingCanonicalGameplay() throws {
        let e=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.star),
            .init(id:"regular",cell:.init(column:1,row:0),value:4)]))
        e.stagedSourceNoMoves=true
        let canonical=e.state;var painted=canonical;painted.tiles[0].alpha=0.005
        let receipt=try XCTUnwrap(Snapshot.PaintedStateReceipt(canonicalState:canonical,paintedState:painted))
        let runtime=Dictionary(uniqueKeysWithValues:painted.tiles.map{($0.id,NativeNoMovesTileRuntime())})
        XCTAssertEqual(NativeSourceEndgameChecker.check(state:canonical,runtime:runtime).kind,.continue)
        let fresh=NativeSourceEndgameChecker.check(state:painted,runtime:runtime)
        XCTAssertEqual(fresh.kind,.fail)
        e.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{true},capture:{
            .init(state:painted,tiles:runtime,wildContinuationPending:false,gameplayTransactionActive:false,
                livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,
                freshResult:fresh,capabilities:Set(Snapshot.Capability.allCases),paintedStateReceipt:receipt)
        })
        guard case .candidate=e.beginSourceNoMoves(origin:.levelEnd) else{return XCTFail("Actual Source alpha must reach its forced checker")}
        XCTAssertEqual(e.state,canonical);XCTAssertNil(e.state.terminal)
        XCTAssertEqual(e.state.tiles[0].alpha,1)
    }
    func testPaintReceiptRefusesEveryLogicalIdentityAndLifecycleChange() {
        let canonical=engine().state
        for change in 0..<12 {
            var painted=canonical;painted.tiles[0].alpha=0.2
            switch change {
            case 0:painted.generation+=1
            case 1:painted.revision+=1
            case 2:painted.moves-=1
            case 3:painted.score+=1
            case 4:painted.tiles[0].cell.column+=1
            case 5:painted.tiles[0].value+=1
            case 6:painted.tiles[0].stackDepth+=1
            case 7:painted.tiles[0].locked=true
            case 8:painted.tiles[0].pendingRemoval=true
            case 9:painted.tiles[0].magnetOwned=true
            case 10:painted.tiles[0].sourceWildStateCleared=true
            default:painted.tiles[0].sourceResidualWildPresence=true
            }
            XCTAssertNil(Snapshot.PaintedStateReceipt(canonicalState:canonical,paintedState:painted),"Change \(change)")
        }
    }
    func testPaintReceiptCannotAuthenticateAnotherCoreOrAnotherPhysicalCapture() throws {
        for changedCore in [false,true] {
            let e=engine();var canonical=e.state,painted=e.state
            if changedCore {canonical.score+=1;painted.score+=1}
            painted.tiles[0].alpha=0.2
            let receipt=try XCTUnwrap(Snapshot.PaintedStateReceipt(canonicalState:canonical,paintedState:painted))
            if !changedCore {painted.tiles[0].visible=false}
            e.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{true},capture:{
                .init(state:painted,tiles:["a":.init()],wildContinuationPending:false,gameplayTransactionActive:false,
                    livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,
                    freshResult:.init(.fail,reason:"controlled-original-checker-result"),
                    capabilities:Set(Snapshot.Capability.allCases),paintedStateReceipt:receipt)
            })
            XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-check-error"))
            XCTAssertNil(e.pendingSourceNoMoves)
        }
    }
    func testCurrentPredicateReplacingAuthorityCannotPublishOldCapture() {
        let e=engine();var c:Authority!;c=Authority(isCurrent:{true},capture:{self.snapshot(e)})
        e.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{e.sourceNoMovesRuntimeAuthority=c;return true},capture:{XCTFail("replaced");return nil})
        XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-check-error"));XCTAssertTrue(e.sourceNoMovesRuntimeAuthority === c)
    }
    func testCaptureReentrantReplacementOrCoreStateMutationCannotAdmit() {
        for replace in [false,true] {let e=engine();let c=Authority(isCurrent:{true},capture:{self.snapshot(e)})
            e.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{true},capture:{let s=self.snapshot(e);if replace{e.sourceNoMovesRuntimeAuthority=c}else{e.restart(state:e.state)};return s})
            XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-check-error"));XCTAssertNil(e.pendingSourceNoMoves)
        }
    }
    func testNestedAuthorityQueryIsRefusedWithoutRecursiveCapture() {
        let e=engine();var count=0;e.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{true},capture:{count+=1;XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-check-error"));return self.snapshot(e)})
        guard case .candidate=e.beginSourceNoMoves(origin:.levelEnd) else{return XCTFail()};XCTAssertEqual(count,1)
    }
    func testFreshAuthorityIsQueriedAtAllFourSourcePhasesAndRealRestartInvalidatesPlan() {
        let e=engine();var count=0;e.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{true},capture:{count+=1;return self.snapshot(e)})
        guard case .candidate(let p)=e.beginSourceNoMoves(origin:.levelEnd) else{return XCTFail()}
        XCTAssertEqual(e.deliverSourceNoMovesWait(plan:p,generation:1),.exit(p))
        XCTAssertEqual(e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.exited),.acquireInputLock(p))
        XCTAssertEqual(e.acquireSourceNoMovesLock(plan:p,generation:1),.confirmedFinal(p));XCTAssertEqual(count,4)
        let other=engine();other.sourceNoMovesRuntimeAuthority=Authority(isCurrent:{true},capture:{self.snapshot(other)})
        guard case .candidate(let q)=other.beginSourceNoMoves(origin:.levelEnd) else{return XCTFail()}
        other.restart(state:other.state);XCTAssertEqual(other.deliverSourceNoMovesWait(plan:q,generation:1),.ignored)
    }
    func testOrderedCaptureRefusesMissingMarkerAndReentrantRetirementWithoutReadingLaterRegistry() {
        var current=true,later=0
        let state=engine().state
        let h=Authority.OrderedCaptureHooks(current:{current},livingDrag:{false},endgameGuard:{false},physical:{current=false;return .init(state:state,tiles:["a":.init()],nonFinalMergeSixGuardActive:false)},fresh:{_,_ in later+=1;return .init(.fail,reason:"stuck")},wildContinuation:{false},spawningOrPulling:{false},specialActive:{later+=1;return false},regularHandoff:{false},capabilities:Set(Snapshot.Capability.allCases))
        XCTAssertNil(Authority.captureSourceOrdered(h));XCTAssertEqual(later,0)
    }
    func testLiteralPreparedDirectSignatureClearsGameplaySpecialButRetainsProvenance()throws {
        struct Rows:Decodable {struct Row:Decodable {let cleared:Bool,special:String?};let signatureRows:[Row]}
        let rows=try JSONDecoder().decode(Rows.self,from:Data(contentsOf:Bundle.module.url(forResource:"SourceNoMovesAuthorityOracle",withExtension:"json")!))
        for row in rows.signatureRows {
            var tile=NativeTile(id:"a",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"fish")
            tile.sourceWildStateCleared=row.cleared
            let signature=NativeSourceGameplaySignature(tiles:[tile])
            XCTAssertEqual(signature.entries[0].special,row.special)
            XCTAssertEqual(tile.archetype,.star);XCTAssertEqual(tile.variant,"fish")
        }
    }

}
